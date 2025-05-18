"""Analytics data processor for Shopify data visualization."""

import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta

from ...api.shopify_api import ShopifyAPI
from ...data_integration.validation.data_validator import DataValidator


class AnalyticsProcessor:
    """Process Shopify data for analytics and visualization."""
    
    def __init__(self, shopify_api: ShopifyAPI):
        self.api = shopify_api
        self.validator = DataValidator()
    
    def get_order_summary(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        group_by: str = 'day'
    ) -> Dict[str, Any]:
        """Get order summary data grouped by time period.
        
        Args:
            start_date: Start date (ISO format)
            end_date: End date (ISO format)
            group_by: Grouping period ('day', 'week', 'month')
            
        Returns:
            Dictionary with order summary data
        """
        # Fetch orders from API
        orders = self.api.get_orders(
            start_date=start_date,
            end_date=end_date
        )
        
        # Validate and convert to DataFrame
        valid_orders = []
        for order in orders:
            if self.validator.validate_order(order):
                valid_orders.append(order)
        
        df = pd.DataFrame(valid_orders)
        
        if df.empty:
            return {"data": [], "summary": {}}
        
        # Parse dates
        df['created_at'] = pd.to_datetime(df['created_at'], utc=True)
        
        # Group by specified period
        if group_by == 'day':
            df['period'] = df['created_at'].dt.date
        elif group_by == 'week':
            df['period'] = df['created_at'].dt.to_period('W')
        elif group_by == 'month':
            df['period'] = df['created_at'].dt.to_period('M')
        else:
            raise ValueError(f"Invalid group_by value: {group_by}")
        
        # Calculate aggregations
        summary = df.groupby('period').agg({
            'order_id': 'count',
            'total_price': ['sum', 'mean'],
            'customer': lambda x: x.notna().sum()
        }).round(2)
        
        # Flatten column names
        summary.columns = ['order_count', 'total_revenue', 'average_order_value', 'unique_customers']
        
        # Convert to list of dictionaries
        data = []
        for period, row in summary.iterrows():
            data.append({
                'period': str(period),
                'order_count': int(row['order_count']),
                'total_revenue': float(row['total_revenue']),
                'average_order_value': float(row['average_order_value']),
                'unique_customers': int(row['unique_customers'])
            })
        
        # Calculate overall summary
        overall_summary = {
            'total_orders': int(df.shape[0]),
            'total_revenue': float(df['total_price'].sum()),
            'average_order_value': float(df['total_price'].mean()),
            'total_customers': int(df['customer'].notna().sum()),
            'conversion_rate': float(df['customer'].notna().sum() / df.shape[0] * 100)
        }
        
        return {
            'data': data,
            'summary': overall_summary,
            'group_by': group_by
        }
    
    def get_category_sales(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get sales data by product category.
        
        Args:
            start_date: Start date (ISO format)
            end_date: End date (ISO format)
            
        Returns:
            List of category sales data
        """
        orders = self.api.get_orders(
            start_date=start_date,
            end_date=end_date
        )
        
        # Extract line items and calculate category sales
        category_sales = {}
        
        for order in orders:
            if 'line_items' in order:
                for item in order['line_items']:
                    # Use product type as category
                    category = item.get('product_type', 'Uncategorized')
                    price = float(item.get('price', 0))
                    quantity = int(item.get('quantity', 1))
                    total = price * quantity
                    
                    if category in category_sales:
                        category_sales[category] += total
                    else:
                        category_sales[category] = total
        
        # Convert to list format for charts
        result = []
        for category, sales in category_sales.items():
            result.append({
                'category': category,
                'sales': round(sales, 2),
                'percentage': 0  # Will be calculated client-side
            })
        
        # Sort by sales descending
        result.sort(key=lambda x: x['sales'], reverse=True)
        
        return result
    
    def get_sales_trend(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        compare_previous: bool = True
    ) -> Dict[str, Any]:
        """Get sales trend data with optional year-over-year comparison.
        
        Args:
            start_date: Start date (ISO format)
            end_date: End date (ISO format)
            compare_previous: Whether to include previous year data
            
        Returns:
            Dictionary with current and previous period data
        """
        current_orders = self.api.get_orders(
            start_date=start_date,
            end_date=end_date
        )
        
        result = {
            'current': self._process_trend_data(current_orders),
            'previous': None,
            'growth_rate': None
        }
        
        if compare_previous and start_date and end_date:
            # Calculate previous year dates
            start = datetime.fromisoformat(start_date)
            end = datetime.fromisoformat(end_date)
            prev_start = start - relativedelta(years=1)
            prev_end = end - relativedelta(years=1)
            
            previous_orders = self.api.get_orders(
                start_date=prev_start.isoformat(),
                end_date=prev_end.isoformat()
            )
            
            result['previous'] = self._process_trend_data(previous_orders)
            
            # Calculate growth rate
            current_total = sum(item['sales'] for item in result['current'])
            previous_total = sum(item['sales'] for item in result['previous'])
            
            if previous_total > 0:
                growth_rate = ((current_total - previous_total) / previous_total) * 100
                result['growth_rate'] = round(growth_rate, 2)
        
        return result
    
    def _process_trend_data(self, orders: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Process orders into trend data format."""
        df = pd.DataFrame(orders)
        
        if df.empty:
            return []
        
        df['created_at'] = pd.to_datetime(df['created_at'], utc=True)
        df['date'] = df['created_at'].dt.date
        
        daily_sales = df.groupby('date')['total_price'].sum().round(2)
        
        trend_data = []
        for date, sales in daily_sales.items():
            trend_data.append({
                'date': date.isoformat(),
                'sales': float(sales)
            })
        
        return trend_data
    
    def get_geographic_distribution(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get sales distribution by geographic location.
        
        Args:
            start_date: Start date (ISO format)
            end_date: End date (ISO format)
            
        Returns:
            List of geographic sales data
        """
        orders = self.api.get_orders(
            start_date=start_date,
            end_date=end_date
        )
        
        geo_sales = {}
        
        for order in orders:
            if 'shipping_address' in order and order['shipping_address']:
                country = order['shipping_address'].get('country_code', 'Unknown')
                province = order['shipping_address'].get('province_code', '')
                
                # Use country-province as key
                location = f"{country}-{province}" if province else country
                
                sales = float(order.get('total_price', 0))
                
                if location in geo_sales:
                    geo_sales[location]['sales'] += sales
                    geo_sales[location]['order_count'] += 1
                else:
                    geo_sales[location] = {
                        'sales': sales,
                        'order_count': 1,
                        'country': country,
                        'province': province
                    }
        
        # Convert to list format
        result = []
        for location, data in geo_sales.items():
            result.append({
                'location': location,
                'country': data['country'],
                'province': data['province'],
                'sales': round(data['sales'], 2),
                'order_count': data['order_count']
            })
        
        # Sort by sales descending
        result.sort(key=lambda x: x['sales'], reverse=True)
        
        return result
    
    def export_data(self, data: Any, format: str = 'csv') -> bytes:
        """Export data in specified format.
        
        Args:
            data: Data to export
            format: Export format ('csv', 'json', 'excel')
            
        Returns:
            Exported data as bytes
        """
        if isinstance(data, list):
            df = pd.DataFrame(data)
        elif isinstance(data, dict):
            # Try to extract data from common response format
            if 'data' in data:
                df = pd.DataFrame(data['data'])
            else:
                df = pd.DataFrame([data])
        else:
            df = pd.DataFrame(data)
        
        if format == 'csv':
            return df.to_csv(index=False).encode('utf-8')
        elif format == 'json':
            return df.to_json(orient='records').encode('utf-8')
        elif format == 'excel':
            # Use BytesIO for Excel format
            from io import BytesIO
            buffer = BytesIO()
            df.to_excel(buffer, index=False, engine='openpyxl')
            return buffer.getvalue()
        else:
            raise ValueError(f"Unsupported export format: {format}")