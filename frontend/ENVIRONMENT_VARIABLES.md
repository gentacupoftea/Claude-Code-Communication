# Environment Variables Configuration Guide

This guide documents all environment variables used in the Shopify MCP Server frontend application.

## Frontend Environment Variables

Copy `.env.example` to `.env.local` and configure the following variables:

### Core API Configuration
- `REACT_APP_API_URL` - Backend API endpoint (default: `http://localhost:8000/api/v1`)
- `REACT_APP_WS_URL` - WebSocket endpoint for real-time updates (default: `ws://localhost:8000/ws`)
- `REACT_APP_MCP_API_URL` - MCP API endpoint (default: `http://localhost:8765`)

### Environment Settings
- `REACT_APP_ENVIRONMENT` - Application environment (`development`, `staging`, `production`)
- `REACT_APP_ENV` - Alternative environment flag

### Authentication
- `REACT_APP_USE_MOCK_AUTH` - Enable mock authentication for development (default: `false`)

### Monitoring & Analytics
- `REACT_APP_ANALYTICS_ENDPOINT` - Analytics data collection endpoint
- `REACT_APP_ERROR_TRACKING_ENDPOINT` - Error tracking endpoint
- `REACT_APP_ENABLE_DEV_ANALYTICS` - Enable analytics in development (default: `false`)

### Build Information
- `REACT_APP_VERSION` - Application version
- `REACT_APP_BUILD_DATE` - Build timestamp

### Feature Flags
- `REACT_APP_ENABLE_OFFLINE_MODE` - Enable offline functionality (default: `true`)
- `REACT_APP_ENABLE_NOTIFICATIONS` - Enable notification features (default: `true`)
- `REACT_APP_ENABLE_AI_FEATURES` - Enable AI-powered features (default: `false`)

### Cache Configuration
- `REACT_APP_CACHE_TTL` - Cache time-to-live in milliseconds (default: `300000`)

### Debug
- `REACT_APP_DEBUG_MODE` - Enable debug mode (default: `false`)

## Backend Environment Variables (Managed by Backend)

These Shopify-specific variables are typically managed on the backend but are documented here for reference:

### Shopify Configuration
- `SHOPIFY_SHOP_NAME` - Your Shopify store name
- `SHOPIFY_ACCESS_TOKEN` - Shopify API access token
- `SHOPIFY_API_VERSION` - Shopify API version (e.g., `2025-04`)
- `SHOPIFY_API_KEY` - Shopify API key
- `SHOPIFY_API_SECRET` - Shopify API secret
- `SHOPIFY_SCOPES` - Required Shopify permissions
- `SHOPIFY_WEBHOOK_URL` - Webhook endpoint URL

### Rate Limiting
- `SHOPIFY_RATE_LIMIT_RPS` - Requests per second limit
- `SHOPIFY_RATE_LIMIT_BURST` - Burst limit
- `SHOPIFY_RATE_LIMIT_LOG` - Enable rate limit logging

## Environment-Specific Configuration

### Development
```bash
REACT_APP_API_URL=http://localhost:8000/api/v1
REACT_APP_WS_URL=ws://localhost:8000/ws
REACT_APP_USE_MOCK_AUTH=true
REACT_APP_DEBUG_MODE=true
```

### Staging
```bash
REACT_APP_API_URL=https://staging-api.your-domain.com/api/v1
REACT_APP_WS_URL=wss://staging-api.your-domain.com/ws
REACT_APP_USE_MOCK_AUTH=false
REACT_APP_DEBUG_MODE=false
```

### Production
```bash
REACT_APP_API_URL=https://api.your-domain.com/api/v1
REACT_APP_WS_URL=wss://api.your-domain.com/ws
REACT_APP_USE_MOCK_AUTH=false
REACT_APP_DEBUG_MODE=false
```

## Environment Settings Page

The application includes an Environment Settings page at `/settings/environment` where administrators can:

1. View all configured environment variables by category
2. Edit environment variable values (for editable variables)
3. View change history for each variable
4. Import/export environment configurations
5. Manage environment-specific settings

Categories include:
- API Settings
- Authentication Settings
- Feature Flags
- System Settings
- External Integrations
- Database Settings
- Security Settings

## Security Notes

1. Never commit `.env.local` or any file containing actual credentials
2. Use the Environment Settings page to manage sensitive values securely
3. Backend manages Shopify API credentials - do not store them in frontend
4. All sensitive values should be encrypted when stored
5. Use proper access controls for environment variable management

## Troubleshooting

If environment variables are not loading:
1. Ensure `.env.local` exists in the frontend root directory
2. Restart the development server after changing environment variables
3. Check that variable names start with `REACT_APP_`
4. Verify the Environment Settings page is accessible at `/settings/environment`
5. Check browser console for any environment-related errors