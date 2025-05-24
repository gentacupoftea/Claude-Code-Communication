# Authentication Setup

## Current Configuration

The frontend is configured to work with mock authentication since the backend (Conea Backend Server) doesn't have authentication endpoints yet.

### Environment Variables

In `.env`:
```
PORT=3001
REACT_APP_API_URL=https://shopify-mcp-server-staging-259335331171.asia-northeast1.run.app
REACT_APP_USE_MOCK_AUTH=true
```

### Mock Authentication

When `REACT_APP_USE_MOCK_AUTH=true`:
- Any email/password combination will work for signup
- The system creates a mock user with mock tokens
- User data is stored in localStorage
- No actual backend authentication calls are made

### Usage

1. **Signup**: Go to `/signup` and enter any email, password, and name
2. **Login**: Go to `/login` and use the same credentials
3. **Dashboard**: After authentication, you'll be redirected to `/dashboard`

### Backend Integration

When the backend auth endpoints are ready:
1. Set `REACT_APP_USE_MOCK_AUTH=false` in `.env`
2. Ensure the backend has these endpoints:
   - `POST /api/v1/auth/register` - User registration
   - `POST /api/v1/auth/login` - User login
   - `GET /api/v1/auth/me` - Get current user
   - `POST /api/v1/auth/refresh` - Refresh token
   - `POST /api/v1/auth/logout` - Logout

### Current Backend Status

The backend at `https://shopify-mcp-server-staging-259335331171.asia-northeast1.run.app` currently provides:
- `/health` - Health check
- `/api/shopify/test-connection` - Shopify connection test
- `/api/llm/generate` - LLM generation
- `/api/llm/health` - LLM health check

No authentication endpoints are available yet.