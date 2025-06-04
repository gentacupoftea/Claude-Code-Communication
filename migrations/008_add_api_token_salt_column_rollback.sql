-- Rollback script for migration 008_add_api_token_salt_column.sql
-- Date: 2024-01-15
-- Purpose: Rollback API token security enhancements

-- Remove JWT blacklist table
DROP TABLE IF EXISTS jwt_blacklist CASCADE;

-- Remove function for JWT blacklist cleanup
DROP FUNCTION IF EXISTS cleanup_expired_jwt_blacklist();

-- Remove indexes
DROP INDEX IF EXISTS idx_api_tokens_is_active;

-- Remove columns from api_tokens table
ALTER TABLE api_tokens 
DROP COLUMN IF EXISTS salt;

ALTER TABLE api_tokens 
DROP COLUMN IF EXISTS is_active;

-- Note: This rollback will cause all API tokens to become invalid
-- New tokens will need to be generated after rolling back