# Authentication and Authorization System

The Shopify-MCP-Server uses a comprehensive authentication and authorization system to secure API access and manage user permissions across organizations.

## Overview

The authentication system provides:
- User registration and login
- JWT-based authentication
- API token support
- Multi-tenant organization management
- Role-based access control (RBAC)
- Permission-based authorization

## Key Components

### 1. User Management

Users can register, login, and manage their profiles:
- Email-based registration with password requirements
- JWT tokens for session management
- Profile updates
- Password changes

### 2. Organization Management

Multi-tenant support with organizations:
- Create and manage organizations
- Add/remove organization members
- Assign roles to members
- Organization-scoped data isolation

### 3. Role-Based Access Control

Four predefined roles with different permission levels:
- **Owner**: Full access to all organization resources
- **Admin**: Manage users and most resources
- **Member**: Read/write access to analytics and stores
- **Viewer**: Read-only access

### 4. API Token Management

Long-lived tokens for programmatic access:
- Create named tokens with specific scopes
- Set expiration dates
- Revoke tokens when needed
- Track token usage

## Authentication Flow

### 1. User Registration

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "full_name": "John Doe"
}
```

### 2. User Login

```http
POST /api/v1/auth/login
Content-Type: application/x-www-form-urlencoded

username=user@example.com&password=SecurePass123!
```

Response:
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer"
}
```

### 3. Token Refresh

```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

### 4. Authenticated Requests

Include the access token in the Authorization header:

```http
GET /api/v1/some-protected-endpoint
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc...
```

## API Token Usage

### Creating an API Token

```http
POST /api/v1/auth/tokens
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc...
Content-Type: application/json

{
  "name": "Production API Token",
  "scopes": ["read:analytics", "read:store"],
  "expires_in_days": 365
}
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Production API Token",
  "token": "mcp_live_a1b2c3d4e5f6...",  // Only shown once!
  "scopes": ["read:analytics", "read:store"],
  "expires_at": "2025-05-18T12:00:00Z"
}
```

### Using API Tokens

Include the token in the X-API-Key header:

```http
GET /api/v1/some-protected-endpoint
X-API-Key: mcp_live_a1b2c3d4e5f6...
```

## Permissions

Available permissions:
- `read:analytics` - Read analytics data
- `write:analytics` - Modify analytics data
- `read:store` - Read store information
- `write:store` - Modify store settings
- `manage:users` - Manage organization members
- `manage:organization` - Manage organization settings
- `admin` - Full administrative access

## Security Best Practices

1. **Password Requirements**
   - Minimum 8 characters
   - At least one uppercase letter
   - At least one lowercase letter
   - At least one digit

2. **Token Management**
   - Access tokens expire in 15 minutes
   - Refresh tokens expire in 7 days
   - API tokens should have minimal required scopes
   - Revoke unused tokens

3. **HTTPS Only**
   - All authentication endpoints require HTTPS
   - Tokens should never be transmitted over HTTP

4. **Rate Limiting**
   - Registration: 5 requests per hour
   - Login: 10 requests per minute
   - General API: 100 requests per minute

## Error Responses

Common authentication errors:

```json
{
  "detail": "Invalid credentials",
  "status_code": 401
}
```

```json
{
  "detail": "Token expired",
  "status_code": 401
}
```

```json
{
  "detail": "Not enough permissions",
  "status_code": 403
}
```

## Database Schema

The authentication system uses the following main tables:
- `users` - User accounts
- `organizations` - Multi-tenant organizations
- `organization_members` - User-organization relationships
- `api_tokens` - API access tokens
- `shopify_stores` - Shopify store configurations

## Configuration

Key environment variables:

```env
# JWT Configuration
JWT_SECRET_KEY=your-secret-key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15

# Database
DATABASE_URL=postgresql://user:pass@localhost/db

# Security
BCRYPT_ROUNDS=12
```

## Testing

The authentication system includes comprehensive tests:

```bash
# Run authentication tests
pytest tests/auth/

# Run specific test files
pytest tests/auth/test_services.py
pytest tests/auth/test_routes.py
```

## Migration Guide

For existing installations, run the database migrations:

```bash
# Initialize the database
python -m src.auth.database init_db

# Create initial superuser
python -m src.auth.cli create_superuser
```

## Troubleshooting

Common issues and solutions:

1. **JWT Token Invalid**
   - Check if the token has expired
   - Verify the JWT_SECRET_KEY is consistent
   - Ensure the token is properly formatted

2. **Permission Denied**
   - Verify user's role in the organization
   - Check if the required permission is granted
   - Ensure the user is a member of the organization

3. **API Token Not Working**
   - Check token expiration
   - Verify the token hasn't been revoked
   - Ensure required scopes are included

## Next Steps

1. Integrate with Shopify OAuth flow
2. Add two-factor authentication
3. Implement audit logging
4. Add password reset functionality
5. Create admin dashboard UI