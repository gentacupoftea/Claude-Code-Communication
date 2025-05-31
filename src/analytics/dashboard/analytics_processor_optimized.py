"""Optimized analytics data processor for Shopify data visualization."""

import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from functools import lru_cache
from concurrent.futures import ThreadPoolExecutor, as_completed
import asyncio
import logging

from ...api.shopify_api import ShopifyAPI
from ...data_integration.validation.data_validator import DataValidator

logger = logging.getLogger(__name__)


class OptimizedAnalyticsProcessor:
    """Process Shopify data for analytics and visualization with performance optimizations."""
    
    def __init__(self, shopify_api: ShopifyAPI):
        self.api = shopify_api
        self.validator = DataValidator()
        self._executor = ThreadPoolExecutor(max_workers=4)
        self._cache_ttl = 300  # 5 minutes cache TTL
    
    @lru_cache(maxsize=128)
    def _get_cached_orders(
        self,
        start_date: str,
        end_date: str
    ) -> List[Dict[str, Any]]:
        """Get orders with caching."""
        cache_key = f"{start_date}_{end_date}"
        logger.info(f"Fetching orders for cache key: {cache_key}")
        
        return self.api.get_orders(
            start_date=start_date,
            end_date=end_date
        )
    
    def _validate_orders_batch(self, orders: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Validate orders in batch for better performance."""
        valid_orders = []
        
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = {
                executor.submit(self.validator.validate_order, order): order
                for order in orders
            }
            
            for future in as_completed(futures):
                order = futures[future]
                try:
                    if future.result():
                        valid_orders.append(order)
                except Exception as e:
                    logger.error(f"Error validating order: {e}")
        
        return valid_orders
    
    def get_order_summary(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        group_by: str = 'day'
    ) -> Dict[str, Any]:
        """Get order summary data grouped by time period with optimization."""
        try:
            # Use cached orders if available
            orders = self._get_cached_orders(start_date, end_date)
            
            # Batch validation for performance
            valid_orders = self._validate_orders_batch(orders)
            
            if not valid_orders:
                return {"data": [], "summary": {}}
            
            # Use pandas with optimized data types
            df = pd.DataFrame(valid_orders)
            
            # Optimize data types for memory efficiency
            df['created_at'] = pd.to_datetime(df['created_at'], utc=True)
            df['total_price'] = pd.to_numeric(df['total_price'], downcast='float')
            
            # Efficient grouping
            if group_by == 'day':
                df['period'] = df['created_at'].dt.floor('D')
            elif group_by == 'week':
                df['period'] = df['created_at'].dt.to_period('W').astype(str)
            elif group_by == 'month':
                df['period'] = df['created_at'].dt.to_period('M').astype(str)
            else:
                raise ValueError(f"Invalid group_by value: {group_by}")
            
            # Use vectorized operations
            summary = df.groupby('period').agg({
                'order_id': 'count',
                'total_price': ['sum', 'mean'],
                'customer': lambda x: x.notna().sum()
            }).round(2)
            
            # Flatten column names
            summary.columns = ['order_count', 'total_revenue', 'average_order_value', 'unique_customers']
            
            # Efficient conversion to list
            data = summary.reset_index().to_dict('records')
            
            # Calculate overall summary using numpy for efficiency
            overall_summary = {
                'total_orders': int(len(df)),
                'total_revenue': float(df['total_price'].sum()),
                'average_order_value': float(df['total_price'].mean()),
                'total_customers': int(df['customer'].notna().sum()),
                'conversion_rate': float(df['customer'].notna().sum() / len(df) * 100) if len(df) > 0 else 0
            }
            
            return {
                'data': data,
                'summary': overall_summary,
                'group_by': group_by
            }
            
        except Exception as e:
            logger.error(f"Error in get_order_summary: {e}")
            raise
    
    async def get_category_sales_async(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get sales data by product category using async operations."""
        loop = asyncio.get_event_loop()
        
        # Fetch orders asynchronously
        orders = await loop.run_in_executor(
            self._executor,
            self._get_cached_orders,
            start_date,
            end_date
        )
        
        # Process categories in parallel
        category_sales = {}
        
        def process_order(order):
            if 'line_items' in order:
                for item in order['line_items']:
                    category = item.get('product_type', 'Uncategorized')
                    price = float(item.get('price', 0))
                    quantity = int(item.get('quantity', 1))
                    total = price * quantity
                    
                    if category in category_sales:
                        category_sales[category] += total
                    else:
                        category_sales[category] = total
        
        # Process orders concurrently
        futures = [
            loop.run_in_executor(self._executor, process_order, order)
            for order in orders
        ]
        
        await asyncio.gather(*futures)
        
        # Convert to sorted list
        result = [
            {
                'category': category,
                'sales': round(sales, 2),
                'percentage': 0  # Will be calculated client-side
            }
            for category, sales in category_sales.items()
        ]
        
        result.sort(key=lambda x: x['sales'], reverse=True)
        return result
    
    def get_sales_trend(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        compare_previous: bool = True
    ) -> Dict[str, Any]:
        """Get sales trend data with parallel processing for comparisons."""
        futures = {}
        
        with ThreadPoolExecutor() as executor:
            # Fetch current period data
            current_future = executor.submit(
                self._get_cached_orders,
                start_date,
                end_date
            )
            futures['current'] = current_future
            
            # Fetch previous period data if needed
            if compare_previous and start_date and end_date:
                start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                prev_start = (start - relativedelta(years=1)).isoformat()
                prev_end = (end - relativedelta(years=1)).isoformat()
                
                previous_future = executor.submit(
                    self._get_cached_orders,
                    prev_start,
                    prev_end
                )
                futures['previous'] = previous_future
        
        # Process results
        result = {
            'current': self._process_trend_data(futures['current'].result()),
            'previous': None,
            'growth_rate': None
        }
        
        if 'previous' in futures:
            result['previous'] = self._process_trend_data(futures['previous'].result())
            
            # Calculate growth rate efficiently
            current_total = sum(item['sales'] for item in result['current'])
            previous_total = sum(item['sales'] for item in result['previous'])
            
            if previous_total > 0:
                growth_rate = ((current_total - previous_total) / previous_total) * 100
                result['growth_rate'] = round(growth_rate, 2)
        
        return result
    
    def _process_trend_data(self, orders: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Process orders into trend data format with optimizations."""
        if not orders:
            return []
        
        # Use pandas with optimized types
        df = pd.DataFrame(orders)
        df['created_at'] = pd.to_datetime(df['created_at'], utc=True)
        df['date'] = df['created_at'].dt.date
        df['total_price'] = pd.to_numeric(df['total_price'], downcast='float')
        
        # Efficient grouping
        daily_sales = df.groupby('date')['total_price'].sum().round(2)
        
        # Convert to list efficiently
        trend_data = [
            {
                'date': date.isoformat(),
                'sales': float(sales)
            }
            for date, sales in daily_sales.items()
        ]
        
        return trend_data
    
    def export_data(self, data: Any, format: str = 'csv') -> bytes:
        """Export data in specified format with memory optimization."""
        try:
            # Determine DataFrame creation method
            if isinstance(data, list):
                df = pd.DataFrame(data)
            elif isinstance(data, dict):
                if 'data' in data:
                    df = pd.DataFrame(data['data'])
                else:
                    df = pd.DataFrame([data])
            else:
                df = pd.DataFrame(data)
            
            # Optimize data types for export
            for col in df.select_dtypes(['object']).columns:
                df[col] = df[col].astype(str)
            
            # Export based on format
            if format == 'csv':
                # Use chunking for large datasets
                return df.to_csv(index=False, chunksize=1000).encode('utf-8')
            elif format == 'json':
                # Use compression for JSON
                return df.to_json(orient='records', compression='gzip').encode('utf-8')
            elif format == 'excel':
                from io import BytesIO
                buffer = BytesIO()
                
                # Use xlsxwriter for better performance
                with pd.ExcelWriter(buffer, engine='xlsxwriter') as writer:
                    df.to_excel(writer, index=False, sheet_name='Data')
                    
                    # Get the xlsxwriter workbook and worksheet objects
                    workbook = writer.book
                    worksheet = writer.sheets['Data']
                    
                    # Add some formatting
                    format_header = workbook.add_format({
                        'bold': True,
                        'bg_color': '#f0f0f0',
                        'border': 1
                    })
                    
                    # Format the header row
                    for col_num, value in enumerate(df.columns.values):
                        worksheet.write(0, col_num, value, format_header)
                
                return buffer.getvalue()
            else:
                raise ValueError(f"Unsupported export format: {format}")
        
        except Exception as e:
            logger.error(f"Error exporting data: {e}")
            raise
    
    def __del__(self):
        """Clean up executor on deletion."""
        self._executor.shutdown(wait=True)