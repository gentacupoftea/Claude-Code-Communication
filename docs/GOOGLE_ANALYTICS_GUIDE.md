# Google Analytics Integration Guide

This guide provides detailed instructions for using the Google Analytics integration with the Shopify MCP Server.

## Table of Contents

1. [Setup](#setup)
2. [Configuration](#configuration)
3. [Authentication](#authentication)
4. [API Endpoints](#api-endpoints)
5. [Data Models](#data-models)
6. [Examples](#examples)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

## Setup

### Prerequisites

- Google Analytics 4 property
- Service account with Google Analytics Data API access
- Python 3.9+
- Redis (for caching)

### Installation

1. Install dependencies:
```bash
pip install -r requirements-ga.txt
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Configure Google Analytics credentials:
```bash
# Either set the path to your service account JSON
GA_CREDENTIALS_PATH=/path/to/service-account.json

# Or provide the JSON content directly
GA_CREDENTIALS_JSON='{"type": "service_account", ...}'
```

## Configuration

### Environment Variables

```env
# Google Analytics
GA_CREDENTIALS_PATH=/path/to/service-account.json
GA_PROPERTY_ID=123456789
GA_CACHE_ENABLED=true
GA_CACHE_TTL=300
GA_API_TIMEOUT=30

# Redis
REDIS_URL=redis://localhost:6379/0

# Application
GA_LOG_LEVEL=INFO
GA_CORS_ORIGINS=http://localhost:3000
```

### Service Account Setup

1. Create a service account in Google Cloud Console
2. Enable Google Analytics Data API
3. Grant service account access to your GA4 property
4. Download the service account JSON key

## Authentication

The API uses Bearer token authentication. Include the token in your requests:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:8000/api/v1/google-analytics/reports
```

## API Endpoints

### Run Report

```http
POST /api/v1/google-analytics/reports
```

Request body:
```json
{
  "property_id": "123456789",
  "metrics": [
    {"name": "sessions"},
    {"name": "users"}
  ],
  "dimensions": [
    {"name": "date"},
    {"name": "country"}
  ],
  "date_ranges": [{
    "start_date": "2024-01-01",
    "end_date": "2024-01-31"
  }],
  "dimension_filter": {
    "field": "country",
    "operation": "EXACT",
    "value": "Japan"
  },
  "order_bys": [{
    "field": "sessions",
    "desc": true
  }],
  "limit": 100
}
```

### Run Realtime Report

```http
POST /api/v1/google-analytics/realtime/reports
```

Request body:
```json
{
  "property_id": "123456789",
  "metrics": [
    {"name": "activeUsers"}
  ],
  "dimensions": [
    {"name": "country"},
    {"name": "deviceCategory"}
  ]
}
```

### List Saved Reports

```http
GET /api/v1/google-analytics/reports
```

### Create Saved Report

```http
POST /api/v1/google-analytics/reports/save
```

### Invalidate Cache

```http
POST /api/v1/google-analytics/cache/invalidate/{property_id}
```

## Data Models

### Metric

```python
{
  "name": "sessions",
  "expression": "sessions + 1"  # Optional custom expression
}
```

### Dimension

```python
{
  "name": "country"
}
```

### DateRange

```python
{
  "start_date": "2024-01-01",  # Or "7daysAgo"
  "end_date": "2024-01-31"     # Or "today"
}
```

### FilterExpression

```python
{
  "field": "country",
  "operation": "EXACT",  # EXACT, CONTAINS, BEGINS_WITH, etc.
  "value": "Japan",
  "not": false
}
```

### AnalyticsReport

```python
{
  "dimension_headers": ["date", "country"],
  "metric_headers": ["sessions", "users"],
  "rows": [
    {
      "dimension_values": ["2024-01-01", "Japan"],
      "metric_values": [1000, 800]
    }
  ],
  "total_rows": 100,
  "row_count": 100,
  "metadata": {...}
}
```

## Examples

### Basic Usage

```python
import httpx
from datetime import date, timedelta

# Set up client
client = httpx.Client(
    base_url="http://localhost:8000",
    headers={"Authorization": "Bearer YOUR_TOKEN"}
)

# Run a simple report
response = client.post("/api/v1/google-analytics/reports", json={
    "property_id": "123456789",
    "metrics": [{"name": "sessions"}],
    "dimensions": [{"name": "date"}],
    "date_ranges": [{
        "start_date": (date.today() - timedelta(days=7)).isoformat(),
        "end_date": date.today().isoformat()
    }]
})

report = response.json()
print(f"Total sessions: {sum(row['metric_values'][0] for row in report['rows'])}")
```

### Traffic by Country

```python
# Get traffic by country for the last 30 days
response = client.post("/api/v1/google-analytics/reports", json={
    "property_id": "123456789",
    "metrics": [
        {"name": "sessions"},
        {"name": "users"},
        {"name": "bounceRate"}
    ],
    "dimensions": [{"name": "country"}],
    "date_ranges": [{
        "start_date": "30daysAgo",
        "end_date": "today"
    }],
    "order_bys": [{
        "field": "sessions",
        "desc": True
    }],
    "limit": 10
})

report = response.json()
for row in report['rows']:
    country = row['dimension_values'][0]
    sessions = row['metric_values'][0]
    users = row['metric_values'][1]
    bounce_rate = row['metric_values'][2]
    print(f"{country}: {sessions} sessions, {users} users, {bounce_rate:.1%} bounce rate")
```

### Realtime Data

```python
# Get current active users
response = client.post("/api/v1/google-analytics/realtime/reports", json={
    "property_id": "123456789",
    "metrics": [{"name": "activeUsers"}],
    "dimensions": [
        {"name": "country"},
        {"name": "deviceCategory"}
    ]
})

realtime_data = response.json()
total_active = sum(row['metric_values'][0] for row in realtime_data['rows'])
print(f"Total active users: {total_active}")
```

### Conversion Tracking

```python
# Track conversions with custom events
response = client.post("/api/v1/google-analytics/reports", json={
    "property_id": "123456789",
    "metrics": [
        {"name": "eventCount"},
        {"name": "conversions"}
    ],
    "dimensions": [
        {"name": "eventName"},
        {"name": "date"}
    ],
    "date_ranges": [{
        "start_date": "7daysAgo",
        "end_date": "today"
    }],
    "dimension_filter": {
        "field": "eventName",
        "operation": "IN_LIST",
        "value": "purchase,add_to_cart,view_item"
    }
})
```

## Best Practices

### 1. Use Caching Effectively

```python
# Reports are cached by default
# Use the same parameters to get cached results
# Invalidate cache when data changes significantly
client.post(f"/api/v1/google-analytics/cache/invalidate/{property_id}")
```

### 2. Batch Requests

```python
# Use batch endpoint for multiple reports
response = client.post("/api/v1/google-analytics/reports/batch", json={
    "requests": [
        # Up to 5 report requests
        {...},
        {...}
    ]
})
```

### 3. Use Date Ranges Efficiently

```python
# Relative dates for dynamic reports
date_ranges = [{
    "start_date": "30daysAgo",
    "end_date": "today"
}]

# Multiple date ranges for comparisons
date_ranges = [
    {"start_date": "30daysAgo", "end_date": "today"},
    {"start_date": "60daysAgo", "end_date": "31daysAgo"}
]
```

### 4. Filter Data Appropriately

```python
# Reduce data transfer with filters
dimension_filter = {
    "field": "country",
    "operation": "IN_LIST",
    "value": "US,UK,JP,DE,FR"
}

# Combine filters with AND/OR
dimension_filter = {
    "and": [
        {"field": "country", "operation": "EXACT", "value": "US"},
        {"field": "deviceCategory", "operation": "EXACT", "value": "mobile"}
    ]
}
```

### 5. Optimize for Performance

```python
# Limit results when possible
"limit": 100,
"offset": 0

# Request only needed metrics/dimensions
"metrics": [{"name": "sessions"}],  # Not all available metrics

# Use appropriate date ranges
"date_ranges": [{"start_date": "7daysAgo", "end_date": "today"}]
```

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Verify service account has correct permissions
   - Check if GA Data API is enabled
   - Ensure property ID is correct

2. **No Data Returned**
   - Check date ranges
   - Verify dimensions/metrics are valid
   - Ensure filters aren't too restrictive

3. **Rate Limiting**
   - Use caching to reduce API calls
   - Implement exponential backoff
   - Monitor quota usage

4. **Cache Issues**
   - Check Redis connection
   - Verify cache TTL settings
   - Clear cache if needed

### Debug Mode

Enable debug logging:
```env
GA_LOG_LEVEL=DEBUG
```

Check logs for detailed error messages:
```bash
docker logs ga-mcp-server
```

### API Quotas

Monitor your API usage:
- Default quota: 50,000 requests per day
- Check quota in Google Cloud Console
- Use `property_quota` in response to track usage

## Advanced Features

### Custom Metrics

```python
# Calculate custom metrics
{
  "metrics": [
    {"name": "sessions"},
    {"name": "users"},
    {
      "name": "sessions_per_user",
      "expression": "sessions / users"
    }
  ]
}
```

### Cohort Analysis

```python
# Analyze user cohorts
{
  "dimensions": [
    {"name": "cohort"},
    {"name": "cohortNthDay"}
  ],
  "metrics": [
    {"name": "cohortActiveUsers"},
    {"name": "cohortRetentionRate"}
  ],
  "cohort_spec": {
    "cohorts": [{
      "name": "Jan_2024_Cohort",
      "date_range": {
        "start_date": "2024-01-01",
        "end_date": "2024-01-31"
      }
    }]
  }
}
```

### Funnel Analysis

```python
# Track conversion funnel
dimensions = [{"name": "eventName"}]
metrics = [{"name": "eventCount"}]
dimension_filter = {
  "filter": {
    "field_name": "eventName",
    "in_list_filter": {
      "values": [
        "view_item",
        "add_to_cart",
        "begin_checkout",
        "purchase"
      ]
    }
  }
}
```

## Security Considerations

1. **Service Account Security**
   - Store credentials securely
   - Use minimal required permissions
   - Rotate keys regularly

2. **API Security**
   - Use HTTPS in production
   - Implement proper authentication
   - Validate all inputs

3. **Data Privacy**
   - Follow GDPR/privacy regulations
   - Anonymize sensitive data
   - Implement data retention policies