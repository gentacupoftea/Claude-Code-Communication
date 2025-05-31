# Data Visualization Guide

This guide covers the enhanced data visualization components in the Shopify MCP Server.

## Overview

The data visualization dashboard provides real-time insights into your Shopify store data with interactive charts and analytics.

## Features

### 1. Order Summary
- Daily, weekly, and monthly aggregations
- Order count and revenue trends
- Average order value tracking
- Customer metrics

### 2. Sales Analytics
- Category-wise sales breakdown
- Product performance metrics
- Revenue distribution visualization

### 3. Geographic Analysis
- Sales by country/region
- Order distribution mapping
- Location-based performance metrics

### 4. Trend Analysis
- Year-over-year comparisons
- Growth rate calculations
- Predictive trend lines

## Usage

### Accessing the Dashboard

Navigate to `/analytics/dashboard` in your application to access the main analytics dashboard.

### Date Range Selection

Use the date range picker to filter data:

```jsx
<DateRangePicker
  startDate={startDate}
  endDate={endDate}
  onChange={(start, end) => setDateRange({ startDate: start, endDate: end })}
/>
```

### Exporting Data

Export data in multiple formats:
- CSV for spreadsheets
- JSON for API integration
- Excel for advanced analysis

```javascript
// Export example
const handleExport = async (dataType, format) => {
  const response = await api.get(`/analytics/export/${dataType}`, {
    params: { format }
  });
  // Handle download
};
```

## API Endpoints

### Order Summary
```
GET /api/v1/analytics/orders/summary
Query params:
- start_date: ISO date string
- end_date: ISO date string
- group_by: day|week|month
```

### Category Sales
```
GET /api/v1/analytics/sales/by-category
Query params:
- start_date: ISO date string
- end_date: ISO date string
```

### Sales Trend
```
GET /api/v1/analytics/sales/trend
Query params:
- start_date: ISO date string
- end_date: ISO date string
- compare_previous: boolean
```

### Geographic Distribution
```
GET /api/v1/analytics/sales/geographic
Query params:
- start_date: ISO date string
- end_date: ISO date string
```

### Data Export
```
GET /api/v1/analytics/export/{data_type}
Query params:
- format: csv|json|excel
- start_date: ISO date string
- end_date: ISO date string
```

## Components

### MetricCard
Displays key metrics with trend indicators:

```jsx
<MetricCard
  title="Total Orders"
  value={orderCount}
  icon={<Icon />}
  trend="up"
  trendValue={15.5}
/>
```

### Chart Components
- `OrderSummaryChart`: Bar chart for order data
- `CategoryPieChart`: Pie chart for category breakdown
- `SalesTrendChart`: Line chart for trend analysis
- `GeographicMap`: Map visualization for location data

## Configuration

### Chart Options
Customize chart appearance:

```javascript
const chartOptions = {
  colors: ['#3B82F6', '#10B981', '#F59E0B'],
  animation: true,
  responsive: true
};
```

### Performance Optimization
- Data is cached for 5 minutes
- Lazy loading for large datasets
- Virtualized lists for better performance

## Troubleshooting

### Common Issues

1. **No data displayed**
   - Check date range selection
   - Verify API connection
   - Ensure proper permissions

2. **Slow loading**
   - Check network connection
   - Verify backend performance
   - Consider implementing pagination

3. **Export failures**
   - Check file permissions
   - Verify export format support
   - Check available disk space

## Best Practices

1. Use appropriate date ranges for better performance
2. Implement error boundaries for chart components
3. Cache frequently accessed data
4. Use loading states for better UX
5. Implement proper error handling

## Future Enhancements

- Real-time data updates
- Custom dashboard layouts
- Advanced filtering options
- Machine learning predictions
- Mobile app integration