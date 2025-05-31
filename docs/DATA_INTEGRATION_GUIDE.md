# Data Integration Module Guide

The Data Integration Module provides a comprehensive solution for integrating data from multiple sources including Shopify, analytics platforms, and email marketing tools.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Data Integration Module                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐        │
│  │   Services   │  │  Analytics  │  │     API      │        │
│  │             │  │   Engine    │  │  Endpoints   │        │
│  ├─────────────┤  ├─────────────┤  ├──────────────┤        │
│  │ • Shopify   │  │ • Unified   │  │ • Dashboard  │        │
│  │ • Analytics │  │ • Predictive│  │ • Search     │        │
│  │ • Email     │  │ • Behavioral│  │ • Reports    │        │
│  └─────────────┘  └─────────────┘  └──────────────┘        │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐        │
│  │    Tasks    │  │   Utils     │  │   Config     │        │
│  ├─────────────┤  ├─────────────┤  ├──────────────┤        │
│  │ • Sync      │  │ • Cache     │  │ • Settings   │        │
│  │ • Analytics │  │ • Metrics   │  │ • Database   │        │
│  │ • Scheduler │  │ • Error     │  │ • Security   │        │
│  └─────────────┘  └─────────────┘  └──────────────┘        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Features

### 1. Multi-Source Data Integration
- **Shopify Integration**: Products, orders, customers
- **Analytics Integration**: Page views, conversions, events
- **Email Marketing Integration**: Campaigns, subscribers, metrics

### 2. Advanced Analytics
- **Unified Analytics Engine**: Cross-channel insights
- **Predictive Analytics**: Churn prediction, demand forecasting
- **Behavioral Analytics**: Customer segmentation, journey analysis
- **Recommendation Engine**: Product recommendations, cross-selling

### 3. Real-time Processing
- **Async Operations**: Non-blocking data processing
- **Batch Processing**: Efficient large-scale data handling
- **Streaming Support**: Real-time data ingestion

### 4. Performance Optimization
- **Caching**: Redis-based caching for fast data access
- **Connection Pooling**: Efficient resource management
- **Batch Processing**: Optimized for large datasets

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/shopify-mcp-server.git
cd shopify-mcp-server
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Run database migrations:
```bash
alembic upgrade head
```

5. Start the application:
```bash
python -m src.data_integration.main
```

## Configuration

Create a `.env` file with the following variables:

```env
# Application
ENVIRONMENT=development
DEBUG=true
SECRET_KEY=your-secret-key-here

# Shopify
SHOPIFY_API_VERSION=2023-10
SHOPIFY_WEBHOOK_SECRET=your-webhook-secret

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Database
DATABASE_URL=postgresql://user:password@localhost/dbname

# API Keys
ANALYTICS_API_KEY=your-analytics-key
EMAIL_API_KEY=your-email-key

# Performance
MAX_CONCURRENT_REQUESTS=100
BATCH_PROCESSING_SIZE=100
```

## API Documentation

### Authentication

All API endpoints require authentication using API keys:

```
Authorization: Bearer <api-key>
```

### Endpoints

#### Dashboard
```http
GET /api/v1/dashboard?store_domain=example.myshopify.com
```

Returns unified dashboard data including:
- Revenue metrics
- Customer analytics
- Product performance
- Channel metrics

#### Predictions
```http
GET /api/v1/predictions?store_domain=example.myshopify.com
```

Returns predictive analytics:
- Churn predictions
- Demand forecast
- LTV predictions

#### Search
```http
GET /api/v1/search/products?query=shirt&store_domain=example.myshopify.com
GET /api/v1/search/customers?query=john@example.com&store_domain=example.myshopify.com
```

Search across products or customers with relevance scoring.

#### Reports
```http
POST /api/v1/reports/generate
{
    "report_type": "monthly_performance",
    "store_domain": "example.myshopify.com",
    "start_date": "2023-01-01",
    "end_date": "2023-01-31"
}
```

Generate custom reports.

## Task Scheduling

The module includes automated tasks:

### Sync Tasks
- **Shopify Data Sync**: Every 30 minutes
- **Analytics Data Sync**: Every hour
- **Email Data Sync**: Every hour

### Analytics Tasks
- **Daily Metrics Calculation**: Daily at 2 AM
- **Prediction Updates**: Every hour
- **Insight Generation**: Every 6 hours
- **Data Cleanup**: Weekly on Sunday at 4 AM

## Development

### Running Tests

```bash
# Run all tests
pytest

# Run specific test module
pytest tests/test_data_integration/test_services.py

# Run with coverage
pytest --cov=src.data_integration
```

### Code Style

```bash
# Format code
black src/data_integration

# Check linting
flake8 src/data_integration

# Type checking
mypy src/data_integration
```

### Adding New Services

1. Create service class in `src/data_integration/services/`
2. Implement required methods
3. Add to dependency injection in `dependencies.py`
4. Create tests in `tests/test_data_integration/`

### Adding New Analytics

1. Create analytics class in `src/data_integration/analytics/`
2. Integrate with `UnifiedAnalyticsEngine`
3. Add API endpoints if needed
4. Create tests

## Monitoring

### Metrics

Access metrics at `/metrics` endpoint for Prometheus integration.

### Logs

Logs are structured in JSON format for easy parsing:

```json
{
    "timestamp": "2023-12-01T10:00:00Z",
    "level": "INFO",
    "module": "shopify_service",
    "message": "Synced 100 products",
    "extra": {
        "store_domain": "example.myshopify.com",
        "duration": 2.5
    }
}
```

### Health Checks

Health check endpoint: `/health`

## Best Practices

1. **Error Handling**: Always handle exceptions gracefully
2. **Caching**: Use caching for frequently accessed data
3. **Batch Processing**: Process large datasets in batches
4. **Async Operations**: Use async for I/O operations
5. **Monitoring**: Track metrics and logs
6. **Testing**: Write comprehensive tests

## Troubleshooting

### Common Issues

1. **Redis Connection Failed**
   - Check Redis server is running
   - Verify connection parameters in `.env`

2. **Database Connection Error**
   - Check database server is running
   - Verify DATABASE_URL in `.env`

3. **API Rate Limits**
   - Check rate limit configuration
   - Implement exponential backoff

4. **Memory Issues**
   - Increase batch processing size
   - Optimize data structures
   - Use streaming for large datasets

## Support

For issues and questions:
1. Check the documentation
2. Search existing issues on GitHub
3. Create a new issue with details

## License

This project is licensed under the MIT License.
