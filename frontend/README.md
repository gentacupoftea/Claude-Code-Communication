# 🚀 Conea Frontend

A modern React dashboard for comprehensive e-commerce analytics and management.

![Conea Dashboard](https://img.shields.io/badge/Conea-Dashboard-blue)
![React](https://img.shields.io/badge/React-18.2.0-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.1.6-blue)
![Material-UI](https://img.shields.io/badge/MUI-5.14.0-blue)

## ✨ Features

- 📊 **Advanced Analytics** - Real-time data visualization and insights
- 🛒 **E-commerce Integration** - Shopify, Amazon, Rakuten support
- 📱 **Responsive Design** - Mobile-first, progressive web app
- 🔒 **Secure Authentication** - JWT-based auth with role management
- 🌐 **Multi-language Support** - i18n with Japanese/English
- 📡 **Real-time Updates** - WebSocket connections for live data
- 💾 **Offline Support** - PWA with offline caching
- 🎨 **Modern UI** - Material-UI with custom theming
- 🧪 **Comprehensive Testing** - Unit, integration, and E2E tests

## 🏗️ Architecture

```
src/
├── components/          # Reusable UI components
│   ├── analytics/      # Analytics-specific components
│   ├── auth/           # Authentication components
│   ├── layout/         # Layout and navigation
│   └── ...
├── pages/              # Page components
├── hooks/              # Custom React hooks
├── services/           # API and business logic
├── contexts/           # React contexts
├── store/              # Redux store and slices
├── types/              # TypeScript type definitions
└── utils/              # Utility functions
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Docker (for containerized deployment)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/your-org/conea-frontend.git
cd shopify-mcp-server/frontend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm start
```

The application will be available at `http://localhost:3001`.

### Environment Variables

```bash
# Application
REACT_APP_NAME=Conea Dashboard
REACT_APP_VERSION=1.0.0
REACT_APP_ENVIRONMENT=development

# API Configuration
REACT_APP_API_URL=http://localhost:8000/api
REACT_APP_WS_URL=ws://localhost:8000/ws

# Feature Flags
REACT_APP_ENABLE_ANALYTICS=true
REACT_APP_ENABLE_REAL_TIME=true
REACT_APP_ENABLE_OFFLINE_MODE=true
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- --testPathPattern=Dashboard

# Run tests in watch mode
npm test -- --watch
```

## 🔧 Development Commands

```bash
# Linting
npm run lint              # Check for linting errors
npm run lint:fix          # Fix auto-fixable linting errors

# Formatting
npm run format            # Format code with Prettier

# Type checking
npm run type-check        # Run TypeScript compiler

# Bundle analysis
npm run analyze           # Analyze bundle size
```

## 🚀 Deployment

### Local Development

```bash
npm run deploy:local
```

### Staging Environment

```bash
npm run deploy:staging
```

### Production Deployment

```bash
npm run deploy:production
```

### Docker Deployment

```bash
# Build Docker image
npm run docker:build

# Run container
npm run docker:run
```

### Manual Docker Deployment

```bash
# Build and run with Docker Compose
cd deployment
docker-compose up -d

# Check logs
docker-compose logs -f frontend

# Scale services
docker-compose up -d --scale frontend=3
```

## 🌐 Production Infrastructure

### Tech Stack

- **Frontend**: React 18, TypeScript, Material-UI
- **State Management**: Redux Toolkit, React Query
- **Routing**: React Router v6
- **Charts**: Chart.js, Recharts
- **Testing**: Jest, React Testing Library
- **Build**: Create React App, Webpack
- **Deployment**: Docker, Nginx
- **CI/CD**: GitHub Actions

### Performance Optimizations

- ⚡ Code splitting with React.lazy()
- 🗜️ Bundle optimization with Webpack
- 💾 Service Worker for caching
- 🖼️ Image optimization
- 📦 Tree shaking for smaller bundles
- 🔄 HTTP/2 and gzip compression

### Security Features

- 🛡️ Content Security Policy (CSP)
- 🔒 HTTPS enforcement
- 🚫 XSS protection headers
- 🔐 JWT token management
- 🛂 Role-based access control
- 🔍 Security audit automation

## 📊 Monitoring & Analytics

### Health Checks

- **Application**: `GET /health`
- **API Connectivity**: Automated health monitoring
- **Performance**: Lighthouse CI integration

### Metrics Collection

- Performance metrics via Web Vitals
- User analytics with privacy compliance
- Error tracking and monitoring
- Real-time system metrics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript strict mode
- Write comprehensive tests
- Use semantic commit messages
- Update documentation
- Ensure accessibility compliance

## 🔧 Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   # Clear cache and reinstall
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Performance Issues**
   ```bash
   # Analyze bundle size
   npm run analyze
   ```

3. **Development Server Issues**
   ```bash
   # Reset development environment
   npm start -- --reset-cache
   ```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <strong>🌟 Built with ❤️ by the Conea Team</strong>
</p>