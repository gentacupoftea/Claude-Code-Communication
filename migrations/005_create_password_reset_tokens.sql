-- Create password_reset_tokens table for managing password reset requests
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Index for faster lookups
    INDEX idx_password_reset_token (token),
    INDEX idx_password_reset_user_expires (user_id, expires_at)
);

-- Add comment to table
COMMENT ON TABLE password_reset_tokens IS 'Stores password reset tokens for secure password recovery';
COMMENT ON COLUMN password_reset_tokens.token IS 'Hashed version of the reset token sent to user';
COMMENT ON COLUMN password_reset_tokens.expires_at IS 'Token expiration time (typically 1 hour from creation)';
COMMENT ON COLUMN password_reset_tokens.used IS 'Whether this token has been used to reset password';