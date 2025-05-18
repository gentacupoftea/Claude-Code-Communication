# Shopify MCP Dashboard

A modern React dashboard for managing Shopify store data through the MCP Server.

## Features

- 🔐 Secure authentication with JWT
- 📊 Real-time data visualization
- 📱 Responsive design
- 🌙 Dark mode support
- 🚀 Fast and performant

## Tech Stack

- React + TypeScript
- TailwindCSS for styling
- React Query for data fetching
- React Router for navigation
- Recharts for data visualization
- Axios for API calls

## Prerequisites

- Node.js 16+ and npm
- Running Shopify MCP Server backend

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the environment file:
   ```bash
   cp .env.example .env
   ```

3. Update `.env` with your API URL:
   ```
   REACT_APP_API_URL=http://localhost:8000/api/v1
   ```

## Development

Start the development server:

```bash
npm start
```

The app will run at `http://localhost:3000`

## Building

Build for production:

```bash
npm run build
```

## Project Structure

```
src/
├── components/     # Reusable UI components
├── contexts/       # React contexts
├── hooks/          # Custom React hooks
├── pages/          # Page components
├── services/       # API services
├── types/          # TypeScript types
├── utils/          # Utility functions
└── App.tsx         # Main app component
```

## Available Scripts

- `npm start` - Run development server
- `npm build` - Build for production
- `npm test` - Run tests
- `npm run lint` - Lint code

## Authentication

The app uses JWT authentication with automatic token refresh. Login credentials are stored securely in localStorage.

## API Integration

All API calls go through the centralized `api.ts` service which handles:
- Authentication headers
- Token refresh
- Error handling
- Request/response interceptors

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT