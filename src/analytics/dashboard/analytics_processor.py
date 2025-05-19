"""Optimized analytics data processor with caching and async operations."""

import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from functools import lru_cache
from concurrent.futures import ThreadPoolExecutor, as_completed
import asyncio
import logging
import hashlib
import json
from io import BytesIO

from ...api.shopify_api import ShopifyAPI
from ...data_integration.validation.data_validator import DataValidator
from ..cache.analytics_cache import AnalyticsCache

logger = logging.getLogger(__name__)


class AnalyticsProcessor:
    """Optimized processor for Shopify analytics with caching and async support."""
    
    # Performance optimization parameters
    CHUNK_SIZE = 1000
    MAX_WORKERS = 4
    CACHE_TTL = 300  # 5 minutes
    MAX_CACHE_SIZE = 100  # Maximum number of cached queries
    
    def __init__(self, shopify_api: ShopifyAPI):
        self.api = shopify_api
        self.validator = DataValidator()
        self._executor = ThreadPoolExecutor(max_workers=self.MAX_WORKERS)
        self._cache = AnalyticsCache(ttl=self.CACHE_TTL, max_size=self.MAX_CACHE_SIZE)
        self._semaphore = asyncio.Semaphore(10)  # Limit concurrent operations
    
    def _get_cache_key(self, operation: str, **kwargs) -> str:
        """Generate a unique cache key for the operation."""
        key_data = f"{operation}:{json.dumps(kwargs, sort_keys=True)}"
        return hashlib.md5(key_data.encode()).hexdigest()
    
    async def _fetch_with_cache_async(
        self,
        operation: str,
        fetch_func,
        **kwargs
    ) -> Any:
        """Fetch data with caching support (async version)."""
        cache_key = self._get_cache_key(operation, **kwargs)
        
        # Check cache first
        cached_data = await self._cache.get_async(cache_key)
        if cached_data is not None:
            logger.info(f"Cache hit for {operation}")
            return cached_data
        
        # Fetch data if not in cache
        try:
            async with self._semaphore:
                # Run synchronous function in executor
                loop = asyncio.get_event_loop()
                data = await loop.run_in_executor(
                    self._executor,
                    fetch_func,
                    **kwargs
                )
                
                # Cache the result
                await self._cache.set_async(cache_key, data)
                logger.info(f"Cache miss for {operation}, data fetched and cached")
                return data
        except Exception as e:
            logger.error(f"Error fetching data for {operation}: {e}")
            raise
    
    def _fetch_with_cache(self, operation: str, fetch_func, **kwargs) -> Any:
        """Fetch data with caching support (sync version)."""
        cache_key = self._get_cache_key(operation, **kwargs)
        
        # Check cache first
        cached_data = self._cache.get(cache_key)
        if cached_data is not None:
            logger.info(f"Cache hit for {operation}")
            return cached_data
        
        # Fetch data if not in cache
        try:
            data = fetch_func(**kwargs)
            self._cache.set(cache_key, data)
            logger.info(f"Cache miss for {operation}, data fetched and cached")
            return data
        except Exception as e:
            logger.error(f"Error fetching data for {operation}: {e}")
            raise
    
    def _validate_orders_batch(self, orders: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Validate orders in batch for better performance."""
        valid_orders = []
        
        # Process in chunks to avoid memory issues
        for i in range(0, len(orders), self.CHUNK_SIZE):
            chunk = orders[i:i + self.CHUNK_SIZE]
            
            with ThreadPoolExecutor(max_workers=self.MAX_WORKERS) as executor:
                futures = {
                    executor.submit(self.validator.validate_order, order): order
                    for order in chunk
                }
                
                for future in as_completed(futures):
                    order = futures[future]
                    try:
                        if future.result():
                            valid_orders.append(order)
                    except Exception as e:
                        logger.error(f"Error validating order: {e}")
        
        return valid_orders
    
    def _process_dataframe_efficiently(
        self,
        df: pd.DataFrame,
        group_by: str
    ) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """Process DataFrame with memory and performance optimizations."""
        if df.empty:
            return pd.DataFrame(), {}
        
        # Optimize data types
        df['created_at'] = pd.to_datetime(df['created_at'], utc=True)
        df['total_price'] = pd.to_numeric(df['total_price'], downcast='float')
        
        # Use categorical data type for grouping columns
        if group_by == 'day':
            df['period'] = df['created_at'].dt.floor('D')
        elif group_by == 'week':
            df['period'] = df['created_at'].dt.to_period('W').astype(str)
        elif group_by == 'month':
            df['period'] = df['created_at'].dt.to_period('M').astype(str)
        
        # Use numpy for faster aggregations
        summary = df.groupby('period').agg({
            'order_id': 'count',
            'total_price': ['sum', 'mean'],
            'customer': lambda x: x.notna().sum()
        }).round(2)
        
        # Flatten column names
        summary.columns = ['order_count', 'total_revenue', 'average_order_value', 'unique_customers']
        
        # Calculate overall summary using numpy
        overall_summary = {
            'total_orders': int(len(df)),
            'total_revenue': float(np.sum(df['total_price'])),
            'average_order_value': float(np.mean(df['total_price'])),
            'total_customers': int(df['customer'].notna().sum()),
            'conversion_rate': float(df['customer'].notna().sum() / len(df) * 100) if len(df) > 0 else 0
        }
        
        return summary, overall_summary
    
    def get_order_summary(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        group_by: str = 'day'
    ) -> Dict[str, Any]:
        """Get order summary with caching and optimization."""
        # Fetch orders with caching
        orders = self._fetch_with_cache(
            'get_orders',
            self.api.get_orders,
            start_date=start_date,
            end_date=end_date
        )
        
        # Validate orders in batch
        valid_orders = self._validate_orders_batch(orders)
        
        if not valid_orders:
            return {"data": [], "summary": {}}
        
        # Convert to DataFrame
        df = pd.DataFrame(valid_orders)
        
        # Process efficiently
        summary_df, overall_summary = self._process_dataframe_efficiently(df, group_by)
        
        # Convert to list format
        data = summary_df.reset_index().to_dict('records')
        
        return {
            'data': data,
            'summary': overall_summary,
            'group_by': group_by
        }
    
    async def get_category_sales_async(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get category sales with async operations."""
        # Fetch orders asynchronously
        orders = await self._fetch_with_cache_async(
            'get_orders',
            self.api.get_orders,
            start_date=start_date,
            end_date=end_date
        )
        
        # Process categories in parallel
        category_sales = {}
        
        def process_order_chunk(chunk: List[Dict]) -> Dict[str, float]:
            chunk_sales = {}
            for order in chunk:
                if 'line_items' in order:
                    for item in order['line_items']:
                        category = item.get('product_type', 'Uncategorized')
                        price = float(item.get('price', 0))
                        quantity = int(item.get('quantity', 1))
                        total = price * quantity
                        
                        if category in chunk_sales:
                            chunk_sales[category] += total
                        else:
                            chunk_sales[category] = total
            return chunk_sales
        
        # Process in chunks
        tasks = []
        for i in range(0, len(orders), self.CHUNK_SIZE):
            chunk = orders[i:i + self.CHUNK_SIZE]
            task = asyncio.create_task(
                asyncio.get_event_loop().run_in_executor(
                    self._executor,
                    process_order_chunk,
                    chunk
                )
            )
            tasks.append(task)
        
        # Combine results
        chunk_results = await asyncio.gather(*tasks)
        for chunk_sales in chunk_results:
            for category, sales in chunk_sales.items():
                if category in category_sales:
                    category_sales[category] += sales
                else:
                    category_sales[category] = sales
        
        # Convert to list format
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
    
    def get_category_sales(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Sync wrapper for category sales."""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(
                self.get_category_sales_async(start_date, end_date)
            )
        finally:
            loop.close()
    
    def get_sales_trend(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        compare_previous: bool = True
    ) -> Dict[str, Any]:
        """Get sales trend with parallel processing."""
        futures = {}
        
        with ThreadPoolExecutor(max_workers=2) as executor:
            # Fetch current period data
            current_future = executor.submit(
                self._fetch_with_cache,
                'get_orders',
                self.api.get_orders,
                start_date=start_date,
                end_date=end_date
            )
            futures['current'] = current_future
            
            # Fetch previous period data if needed
            if compare_previous and start_date and end_date:
                start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                prev_start = (start - relativedelta(years=1)).isoformat() + 'Z'
                prev_end = (end - relativedelta(years=1)).isoformat() + 'Z'
                
                previous_future = executor.submit(
                    self._fetch_with_cache,
                    'get_orders',
                    self.api.get_orders,
                    start_date=prev_start,
                    end_date=prev_end
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
            
            # Calculate growth rate
            current_total = sum(item['sales'] for item in result['current'])
            previous_total = sum(item['sales'] for item in result['previous'])
            
            if previous_total > 0:
                growth_rate = ((current_total - previous_total) / previous_total) * 100
                result['growth_rate'] = round(growth_rate, 2)
        
        return result
    
    def _process_trend_data(self, orders: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Process trend data with optimization."""
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
    
    def get_geographic_distribution(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get geographic distribution with optimized processing."""
        orders = self._fetch_with_cache(
            'get_orders',
            self.api.get_orders,
            start_date=start_date,
            end_date=end_date
        )
        
        # Use vectorized operations for geographic data
        geo_data = []
        for order in orders:
            if 'shipping_address' in order and order['shipping_address']:
                country = order['shipping_address'].get('country_code', 'Unknown')
                province = order['shipping_address'].get('province_code', '')
                sales = float(order.get('total_price', 0))
                
                geo_data.append({
                    'country': country,
                    'province': province,
                    'sales': sales,
                    'location': f"{country}-{province}" if province else country
                })
        
        if not geo_data:
            return []
        
        # Use pandas for efficient aggregation
        df = pd.DataFrame(geo_data)
        grouped = df.groupby(['location', 'country', 'province']).agg({
            'sales': ['sum', 'count']
        }).round(2)
        
        # Flatten and convert to list
        result = []
        for (location, country, province), (sales_sum, order_count) in grouped.iterrows():
            result.append({
                'location': location,
                'country': country,
                'province': province,
                'sales': float(sales_sum),
                'order_count': int(order_count)
            })
        
        # Sort by sales
        result.sort(key=lambda x: x['sales'], reverse=True)
        return result
    
    def export_data(self, data: Any, format: str = 'csv') -> bytes:
        """Export data with streaming for large datasets."""
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
        
        # Use chunking for large exports
        if len(df) > 10000:
            return self._export_large_dataset(df, format)
        
        # Regular export for smaller datasets
        if format == 'csv':
            return df.to_csv(index=False).encode('utf-8')
        elif format == 'json':
            return df.to_json(orient='records', compression='gzip').encode('utf-8')
        elif format == 'excel':
            buffer = BytesIO()
            with pd.ExcelWriter(buffer, engine='xlsxwriter') as writer:
                df.to_excel(writer, index=False, sheet_name='Data')
                
                # Add formatting
                workbook = writer.book
                worksheet = writer.sheets['Data']
                
                # Format header
                header_format = workbook.add_format({
                    'bold': True,
                    'bg_color': '#f0f0f0',
                    'border': 1
                })
                
                for col_num, value in enumerate(df.columns.values):
                    worksheet.write(0, col_num, value, header_format)
            
            return buffer.getvalue()
        else:
            raise ValueError(f"Unsupported export format: {format}")
    
    def _export_large_dataset(self, df: pd.DataFrame, format: str) -> bytes:
        """Export large datasets with streaming."""
        if format == 'csv':
            # Stream CSV in chunks
            buffer = BytesIO()
            for i in range(0, len(df), self.CHUNK_SIZE):
                chunk = df.iloc[i:i + self.CHUNK_SIZE]
                if i == 0:
                    chunk.to_csv(buffer, index=False, mode='w')
                else:
                    chunk.to_csv(buffer, index=False, mode='a', header=False)
            
            return buffer.getvalue()
        
        elif format == 'json':
            # Stream JSON in chunks
            buffer = BytesIO()
            buffer.write(b'[')
            
            for i in range(0, len(df), self.CHUNK_SIZE):
                chunk = df.iloc[i:i + self.CHUNK_SIZE]
                json_chunk = chunk.to_json(orient='records')
                
                if i > 0:
                    buffer.write(b',')
                buffer.write(json_chunk[1:-1].encode('utf-8'))  # Remove [ and ]
            
            buffer.write(b']')
            return buffer.getvalue()
        
        else:
            # Excel doesn't support streaming well, use regular export
            return self.export_data(df, format)
    
    def clear_cache(self):
        """Clear the analytics cache."""
        self._cache.clear()
        logger.info("Analytics cache cleared")
    
    def __del__(self):
        """Clean up resources on deletion."""
        self._executor.shutdown(wait=True)
        if hasattr(self, '_cache'):
            self._cache.close()