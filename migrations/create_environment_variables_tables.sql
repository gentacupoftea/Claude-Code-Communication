-- Create environment variables management tables
-- Migration: create_environment_variables_tables
-- Created: 2025-05-22

-- Create environment_variables table
CREATE TABLE environment_variables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(50) NOT NULL,
    key VARCHAR(100) NOT NULL,
    value TEXT,
    value_type VARCHAR(20) NOT NULL DEFAULT 'string',
    description TEXT,
    is_editable BOOLEAN NOT NULL DEFAULT TRUE,
    validation_regex VARCHAR(255),
    options JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_modified_by VARCHAR(100),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    CONSTRAINT uix_category_key_org UNIQUE(category, key, organization_id)
);

-- Create environment_variable_history table
CREATE TABLE environment_variable_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variable_id UUID NOT NULL REFERENCES environment_variables(id) ON DELETE CASCADE,
    previous_value TEXT,
    new_value TEXT,
    changed_by VARCHAR(100) NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    notes TEXT
);

-- Create environment_variable_templates table
CREATE TABLE environment_variable_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    template_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    is_global BOOLEAN NOT NULL DEFAULT FALSE,
    
    CONSTRAINT uix_template_name_org UNIQUE(name, organization_id)
);

-- Create indexes for performance
CREATE INDEX idx_env_var_category ON environment_variables(category);
CREATE INDEX idx_env_var_category_org ON environment_variables(category, organization_id);
CREATE INDEX idx_env_var_organization ON environment_variables(organization_id);
CREATE INDEX idx_env_var_history_variable_id ON environment_variable_history(variable_id);
CREATE INDEX idx_env_var_history_changed_at ON environment_variable_history(changed_at);
CREATE INDEX idx_template_category ON environment_variable_templates(category);
CREATE INDEX idx_template_organization ON environment_variable_templates(organization_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_environment_variables_updated_at
    BEFORE UPDATE ON environment_variables
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_environment_variable_templates_updated_at
    BEFORE UPDATE ON environment_variable_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default environment variable categories and templates
INSERT INTO environment_variables (category, key, value, value_type, description, is_editable, organization_id)
VALUES
    -- API Configuration
    ('api', 'BASE_URL', 'https://conea-service.run.app', 'string', 'Base URL for API endpoints', true, NULL),
    ('api', 'RATE_LIMIT_PER_MINUTE', '100', 'number', 'API rate limit per minute', true, NULL),
    ('api', 'REQUEST_TIMEOUT', '30', 'number', 'API request timeout in seconds', true, NULL),
    ('api', 'MAX_RETRIES', '3', 'number', 'Maximum number of retry attempts', true, NULL),
    ('api', 'RETRY_DELAY', '1000', 'number', 'Delay between retries in milliseconds', true, NULL),
    
    -- Authentication Configuration
    ('auth', 'JWT_EXPIRATION', '86400', 'number', 'JWT token expiration time in seconds (24 hours)', true, NULL),
    ('auth', 'REFRESH_TOKEN_EXPIRATION', '604800', 'number', 'Refresh token expiration time in seconds (7 days)', true, NULL),
    ('auth', 'PASSWORD_MIN_LENGTH', '8', 'number', 'Minimum password length', true, NULL),
    ('auth', 'REQUIRE_EMAIL_VERIFICATION', 'true', 'boolean', 'Whether email verification is required', true, NULL),
    ('auth', 'ALLOW_REGISTRATION', 'true', 'boolean', 'Whether new user registration is allowed', true, NULL),
    
    -- Feature Flags
    ('features', 'ENABLE_GRAPHQL', 'false', 'boolean', 'Enable GraphQL API endpoint', true, NULL),
    ('features', 'ENABLE_WEBSOCKETS', 'true', 'boolean', 'Enable WebSocket connections', true, NULL),
    ('features', 'ENABLE_EXPORT', 'true', 'boolean', 'Enable data export functionality', true, NULL),
    ('features', 'ENABLE_IMPORT', 'true', 'boolean', 'Enable data import functionality', true, NULL),
    ('features', 'ENABLE_AUDIT_LOG', 'true', 'boolean', 'Enable audit logging', true, NULL),
    
    -- System Configuration
    ('system', 'LOG_LEVEL', 'info', 'string', 'Application log level', true, NULL),
    ('system', 'MAINTENANCE_MODE', 'false', 'boolean', 'Enable maintenance mode', true, NULL),
    ('system', 'MAX_UPLOAD_SIZE', '10485760', 'number', 'Maximum file upload size in bytes (10MB)', true, NULL),
    ('system', 'SESSION_TIMEOUT', '3600', 'number', 'Session timeout in seconds (1 hour)', true, NULL),
    ('system', 'CLEANUP_INTERVAL', '86400', 'number', 'Cleanup interval in seconds (24 hours)', true, NULL),
    
    -- Integration Configuration
    ('integrations', 'SHOPIFY_API_VERSION', '2024-01', 'string', 'Shopify API version to use', true, NULL),
    ('integrations', 'SHOPIFY_WEBHOOK_VERIFY', 'true', 'boolean', 'Whether to verify Shopify webhooks', true, NULL),
    ('integrations', 'EXTERNAL_API_TIMEOUT', '30', 'number', 'External API timeout in seconds', true, NULL),
    ('integrations', 'CACHE_TTL', '3600', 'number', 'Cache time-to-live in seconds (1 hour)', true, NULL),
    
    -- Database Configuration
    ('database', 'POOL_SIZE', '10', 'number', 'Database connection pool size', true, NULL),
    ('database', 'MAX_OVERFLOW', '20', 'number', 'Maximum connection pool overflow', true, NULL),
    ('database', 'POOL_TIMEOUT', '30', 'number', 'Connection pool timeout in seconds', true, NULL),
    ('database', 'POOL_RECYCLE', '3600', 'number', 'Connection pool recycle time in seconds', true, NULL),
    
    -- Cache Configuration
    ('cache', 'REDIS_MAX_CONNECTIONS', '10', 'number', 'Maximum Redis connections', true, NULL),
    ('cache', 'REDIS_TIMEOUT', '5', 'number', 'Redis operation timeout in seconds', true, NULL),
    ('cache', 'DEFAULT_TTL', '3600', 'number', 'Default cache TTL in seconds', true, NULL),
    
    -- Security Configuration
    ('security', 'CORS_ORIGINS', '["*"]', 'json', 'Allowed CORS origins', true, NULL),
    ('security', 'TRUSTED_HOSTS', '["*"]', 'json', 'Trusted host names', true, NULL),
    ('security', 'SECURE_COOKIES', 'true', 'boolean', 'Use secure cookies', true, NULL),
    ('security', 'CSRF_PROTECTION', 'true', 'boolean', 'Enable CSRF protection', true, NULL);

-- Insert default environment variable templates
INSERT INTO environment_variable_templates (name, description, category, template_data, is_global, created_by)
VALUES
    ('Development Environment', 'Default settings for development environment', 'development', 
     '{"api": {"BASE_URL": "http://localhost:8000", "RATE_LIMIT_PER_MINUTE": 1000}, "auth": {"JWT_EXPIRATION": 86400}, "features": {"ENABLE_GRAPHQL": true}, "system": {"LOG_LEVEL": "debug", "MAINTENANCE_MODE": false}}', 
     true, 'system'),
    
    ('Production Environment', 'Default settings for production environment', 'production',
     '{"api": {"BASE_URL": "https://api.conea.com", "RATE_LIMIT_PER_MINUTE": 100}, "auth": {"JWT_EXPIRATION": 3600}, "features": {"ENABLE_GRAPHQL": false}, "system": {"LOG_LEVEL": "error", "MAINTENANCE_MODE": false}}',
     true, 'system'),
     
    ('Staging Environment', 'Default settings for staging environment', 'staging',
     '{"api": {"BASE_URL": "https://staging-api.conea.com", "RATE_LIMIT_PER_MINUTE": 500}, "auth": {"JWT_EXPIRATION": 7200}, "features": {"ENABLE_GRAPHQL": true}, "system": {"LOG_LEVEL": "info", "MAINTENANCE_MODE": false}}',
     true, 'system'),
     
    ('High Performance', 'Settings optimized for high performance', 'performance',
     '{"api": {"RATE_LIMIT_PER_MINUTE": 10000, "REQUEST_TIMEOUT": 10}, "database": {"POOL_SIZE": 50, "MAX_OVERFLOW": 100}, "cache": {"REDIS_MAX_CONNECTIONS": 50, "DEFAULT_TTL": 7200}}',
     true, 'system'),
     
    ('Security Focused', 'Settings with enhanced security', 'security',
     '{"auth": {"JWT_EXPIRATION": 900, "REQUIRE_EMAIL_VERIFICATION": true, "PASSWORD_MIN_LENGTH": 12}, "security": {"CORS_ORIGINS": ["https://conea.com"], "TRUSTED_HOSTS": ["conea.com"], "SECURE_COOKIES": true, "CSRF_PROTECTION": true}}',
     true, 'system');

-- Add comments to tables
COMMENT ON TABLE environment_variables IS 'Stores environment variables that can be managed through the UI';
COMMENT ON TABLE environment_variable_history IS 'Tracks changes to environment variables for audit purposes';
COMMENT ON TABLE environment_variable_templates IS 'Predefined templates for common environment variable configurations';

-- Add comments to important columns
COMMENT ON COLUMN environment_variables.value_type IS 'Data type: string, number, boolean, json, secret';
COMMENT ON COLUMN environment_variables.validation_regex IS 'Regular expression for validating the value';
COMMENT ON COLUMN environment_variables.options IS 'JSON array of valid options for enum-type variables';
COMMENT ON COLUMN environment_variable_templates.template_data IS 'JSON structure containing the template configuration';
COMMENT ON COLUMN environment_variable_templates.is_global IS 'Whether the template is available to all organizations';