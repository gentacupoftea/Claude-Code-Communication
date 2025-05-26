# Shopify MCP Server 🚀

Enterprise-grade E-Commerce Integration Platform - Unifying Shopify, Amazon, Rakuten, and Next Engine with AI-powered automation and real-time synchronization.

## 🚀 Features

### Security & Authentication
- **Email Verification** - Required email confirmation before account access
- **Two-Factor Authentication (2FA)** - TOTP-based with QR codes and backup codes
- **Account Lockout** - Automatic lockout after 5 failed login attempts
- **Session Management** - Track and manage all active sessions
- **Password Security** - Strong password policy with history tracking
- **Audit Logging** - Complete audit trail of all security events

### Core Capabilities
- **Multi-Platform Integration** - Shopify, Amazon SP-API, Rakuten RMS, Next Engine
- **Real-time Synchronization** - WebSocket-based instant updates across all platforms
- **AI/ML Analytics** - Sales forecasting, inventory optimization, customer insights
- **GraphQL API** - High-performance API with depth limiting and security
- **Kubernetes Ready** - Scalable microservices architecture
- **Event Streaming** - Apache Kafka integration for real-time processing

## 📋 Requirements

- Python 3.9+
- PostgreSQL or SQLite
- Redis (optional, for caching)
- Node.js 16+ (for frontend)

## 🛠️ Installation

### Backend Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/shopify-mcp-server.git
cd shopify-mcp-server
```

2. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

5. Run database migrations:
```bash
alembic upgrade head
```

6. Start the server:
```bash
uvicorn src.main:app --reload
```

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment:
```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

4. Start development server:
```bash
npm start
```

## 🔐 Security Configuration

### Environment Variables

```env
# Security Settings
PASSWORD_MIN_LENGTH=8
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION_MINUTES=30
SESSION_EXPIRY_HOURS=24
EMAIL_VERIFICATION_EXPIRY_HOURS=24

# JWT Settings
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Database
DATABASE_URL=postgresql://user:password@localhost/shopify_mcp

# Email Service
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

## 📚 API Documentation

Once the server is running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Key Endpoints

#### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/verify-email` - Email verification
- `POST /api/v1/auth/2fa/setup` - Setup 2FA
- `GET /api/v1/auth/sessions` - List active sessions

#### Organizations
- `POST /api/v1/organizations` - Create organization
- `GET /api/v1/organizations` - List user's organizations
- `POST /api/v1/organizations/{id}/members` - Add member

#### Shopify Integration
- `POST /api/v1/shopify/stores` - Connect Shopify store
- `GET /api/v1/shopify/products` - List products
- `GET /api/v1/shopify/orders` - List orders

## 🧪 Testing

Run all tests:
```bash
pytest tests/ -v
```

Run with coverage:
```bash
pytest tests/ --cov=src --cov-report=html
```

## 🚀 Deployment

### Using Docker

1. Build the image:
```bash
docker build -t shopify-mcp-server .
```

2. Run the container:
```bash
docker run -p 8000:8000 --env-file .env shopify-mcp-server
```

### Using Docker Compose

```bash
docker-compose up -d
```

## 📈 Monitoring

- Health check: http://localhost:8000/health
- Metrics: http://localhost:8000/metrics

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- FastAPI for the amazing web framework
- Shopify for their comprehensive API
- The Python community for excellent libraries

## 📞 Support

For support, email support@shopify-mcp-server.com or open an issue on GitHub.