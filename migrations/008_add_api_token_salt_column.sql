-- Migration: Add salt column to api_tokens table for secure hashing
-- Date: 2024-01-15
-- Purpose: Enhance API token security with salted hashing

-- Add salt column to api_tokens table
ALTER TABLE api_tokens 
ADD COLUMN IF NOT EXISTS salt VARCHAR(32);

-- Add is_active column for token revocation
ALTER TABLE api_tokens 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE NOT NULL;

-- Create index on is_active for performance
CREATE INDEX IF NOT EXISTS idx_api_tokens_is_active 
ON api_tokens(is_active) 
WHERE is_active = TRUE;

-- Deactivate existing tokens for security (they lack salt)
UPDATE api_tokens 
SET is_active = FALSE 
WHERE salt IS NULL;

-- Generate secure salts for new tokens only
-- Existing tokens must be regenerated through the application
UPDATE api_tokens 
SET salt = encode(gen_random_bytes(16), 'hex')
WHERE salt IS NULL AND is_active = TRUE;

-- Make salt column NOT NULL after handling existing rows
ALTER TABLE api_tokens 
ALTER COLUMN salt SET NOT NULL;

-- Add comment to document the columns
COMMENT ON COLUMN api_tokens.salt IS 'Salt for secure token hashing using HMAC';
COMMENT ON COLUMN api_tokens.is_active IS 'Flag for token revocation without deletion';

-- Create JWT blacklist table for token revocation
CREATE TABLE IF NOT EXISTS jwt_blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jti VARCHAR(255) UNIQUE NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    blacklisted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason VARCHAR(255),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for JWT blacklist
CREATE INDEX IF NOT EXISTS idx_jwt_blacklist_jti ON jwt_blacklist(jti);
CREATE INDEX IF NOT EXISTS idx_jwt_blacklist_expires_at ON jwt_blacklist(expires_at);
CREATE INDEX IF NOT EXISTS idx_jwt_blacklist_user_id ON jwt_blacklist(user_id);

-- Add comments
COMMENT ON TABLE jwt_blacklist IS 'Blacklisted JWT tokens for revocation before expiry';
COMMENT ON COLUMN jwt_blacklist.jti IS 'JWT ID from token payload';
COMMENT ON COLUMN jwt_blacklist.token_hash IS 'Hash of the token for verification';
COMMENT ON COLUMN jwt_blacklist.expires_at IS 'Original token expiration time';
COMMENT ON COLUMN jwt_blacklist.reason IS 'Reason for blacklisting (logout, security, etc.)';

-- Create function to clean up expired blacklist entries
CREATE OR REPLACE FUNCTION cleanup_expired_jwt_blacklist()
RETURNS void AS $$
BEGIN
    DELETE FROM jwt_blacklist 
    WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run cleanup daily (requires pg_cron extension)
-- Note: This requires pg_cron extension to be installed
-- If not available, run cleanup manually or via application
-- SELECT cron.schedule('cleanup-jwt-blacklist', '0 2 * * *', 'SELECT cleanup_expired_jwt_blacklist();');