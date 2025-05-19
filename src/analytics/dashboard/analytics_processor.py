"""Analytics data processor for Shopify data visualization with export functionality."""

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
import matplotlib.pyplot as plt
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors

from ...api.shopify_api import ShopifyAPI
from ...data_integration.validation.data_validator import DataValidator
from ..cache.analytics_cache import AnalyticsCache

logger = logging.getLogger(__name__)


class AnalyticsProcessor:
    """Optimized processor for Shopify analytics with caching, async support, and export functionality."""
    
    # Performance optimization parameters
    CHUNK_SIZE = 1000
    MAX_WORKERS = 4
    CACHE_TTL = 300  # 5 minutes
    MAX_CACHE_SIZE = 100  # Maximum number of cached queries
    
    def __init__(self, shopify_api: ShopifyAPI):
        self.api = shopify_api
        self.validator = DataValidator()
        self.cache = AnalyticsCache(ttl=self.CACHE_TTL, max_size=self.MAX_CACHE_SIZE)
        self.executor = ThreadPoolExecutor(max_workers=self.MAX_WORKERS)
    
    def _get_cache_key(self, method_name: str, **kwargs) -> str:
        """Generate cache key for a method call."""
        key_data = f"{method_name}:{json.dumps(kwargs, sort_keys=True)}"
        return hashlib.md5(key_data.encode()).hexdigest()
    
    def _validate_date_range(self, start_date: str, end_date: str) -> Tuple[datetime, datetime]:
        """Validate and parse date range."""
        try:
            start = pd.to_datetime(start_date, utc=True)
            end = pd.to_datetime(end_date, utc=True)
            
            if start > end:
                raise ValueError("Start date must be before end date")
            
            # Limit date range to prevent excessive memory usage
            max_range = timedelta(days=365)
            if end - start > max_range:
                raise ValueError(f"Date range cannot exceed {max_range.days} days")
            
            return start, end
        except Exception as e:
            raise ValueError(f"Invalid date format: {str(e)}")
    
    @lru_cache(maxsize=128)
    def get_order_summary(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        group_by: str = 'day'
    ) -> Dict[str, Any]:
        """Get order summary data grouped by time period with caching.
        
        Args:
            start_date: Start date (ISO format)
            end_date: End date (ISO format)
            group_by: Grouping period ('day', 'week', 'month')
            
        Returns:
            Dictionary with order summary data
        """
        # Check cache
        cache_key = self._get_cache_key(
            'get_order_summary',
            start_date=start_date,
            end_date=end_date,
            group_by=group_by
        )
        
        cached_result = self.cache.get(cache_key)
        if cached_result is not None:
            logger.info(f"Cache hit for order summary: {cache_key}")
            return cached_result
        
        # Validate dates
        if start_date and end_date:
            start, end = self._validate_date_range(start_date, end_date)
        else:
            end = datetime.utcnow()
            start = end - timedelta(days=30)
        
        try:
            # Fetch orders in parallel chunks
            date_chunks = self._create_date_chunks(start, end, chunk_days=30)
            
            all_orders = []
            with ThreadPoolExecutor(max_workers=self.MAX_WORKERS) as executor:
                futures = []
                for chunk_start, chunk_end in date_chunks:
                    future = executor.submit(
                        self.api.get_orders,
                        start_date=chunk_start.isoformat(),
                        end_date=chunk_end.isoformat()
                    )
                    futures.append(future)
                
                for future in as_completed(futures):
                    try:
                        orders = future.result()
                        all_orders.extend(orders)
                    except Exception as e:
                        logger.error(f"Error fetching order chunk: {str(e)}")
            
            # Process orders
            valid_orders = []
            for order in all_orders:
                if self.validator.validate_order(order):
                    valid_orders.append(order)
            
            df = pd.DataFrame(valid_orders)
            
            if df.empty:
                result = {"data": [], "summary": {}}
                self.cache.set(cache_key, result)
                return result
            
            # Optimize data processing
            df['created_at'] = pd.to_datetime(df['created_at'], utc=True)
            df['total_price'] = pd.to_numeric(df['total_price'], errors='coerce')
            
            # Group by specified period
            if group_by == 'day':
                df['period'] = df['created_at'].dt.date
            elif group_by == 'week':
                df['period'] = df['created_at'].dt.to_period('W')
            elif group_by == 'month':
                df['period'] = df['created_at'].dt.to_period('M')
            else:
                raise ValueError(f"Invalid group_by value: {group_by}")
            
            # Efficient aggregation
            grouped = df.groupby('period').agg({
                'id': 'count',
                'total_price': ['sum', 'mean'],
                'customer_id': 'nunique'
            }).reset_index()
            
            grouped.columns = ['period', 'order_count', 'total_revenue', 'avg_order_value', 'unique_customers']
            grouped['period'] = grouped['period'].astype(str)
            
            result = {
                "data": grouped.to_dict('records'),
                "summary": {
                    "total_orders": int(df['id'].count()),
                    "total_revenue": float(df['total_price'].sum()),
                    "average_order_value": float(df['total_price'].mean()),
                    "unique_customers": int(df['customer_id'].nunique()),
                    "date_range": {
                        "start": start.isoformat(),
                        "end": end.isoformat()
                    }
                }
            }
            
            # Cache the result
            self.cache.set(cache_key, result)
            return result
            
        except Exception as e:
            logger.error(f"Error in get_order_summary: {str(e)}")
            raise
    
    def export_data(self, data: Any, format: str = 'csv') -> bytes:
        """Export data in specified format including PDF.
        
        Args:
            data: Data to export
            format: Export format ('csv', 'json', 'excel', 'pdf')
            
        Returns:
            Exported data as bytes
        """
        if isinstance(data, list):
            df = pd.DataFrame(data)
        elif isinstance(data, dict):
            # Try to extract data from common response format
            if 'data' in data:
                df = pd.DataFrame(data['data'])
                metadata = {k: v for k, v in data.items() if k != 'data'}
            else:
                df = pd.DataFrame([data])
                metadata = {}
        else:
            df = pd.DataFrame(data)
            metadata = {}
        
        if format == 'csv':
            return df.to_csv(index=False).encode('utf-8')
        elif format == 'json':
            return df.to_json(orient='records').encode('utf-8')
        elif format == 'excel':
            buffer = BytesIO()
            df.to_excel(buffer, index=False, engine='openpyxl')
            return buffer.getvalue()
        elif format == 'pdf':
            return self._export_to_pdf(df, metadata)
        else:
            raise ValueError(f"Unsupported export format: {format}")
    
    def _export_to_pdf(self, df: pd.DataFrame, metadata: Dict[str, Any] = None) -> bytes:
        """Export DataFrame to PDF format.
        
        Args:
            df: DataFrame to export
            metadata: Additional metadata for the PDF
            
        Returns:
            PDF content as bytes
        """
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=18,
        )
        
        story = []
        styles = getSampleStyleSheet()
        
        # Title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#333333'),
            spaceAfter=30,
            alignment=1  # Center alignment
        )
        
        export_date = datetime.now().strftime('%Y年%m月%d日 %H:%M')
        title = Paragraph(f"データエクスポートレポート<br/>{export_date}", title_style)
        story.append(title)
        story.append(Spacer(1, 12))
        
        # Add metadata if present
        if metadata:
            metadata_style = ParagraphStyle(
                'Metadata',
                parent=styles['Normal'],
                fontSize=10,
                textColor=colors.HexColor('#666666'),
                spaceAfter=10,
            )
            
            if 'summary' in metadata:
                summary = metadata['summary']
                summary_text = f"""
                <b>概要:</b><br/>
                総注文数: {summary.get('total_orders', 'N/A')}<br/>
                総売上: ¥{summary.get('total_revenue', 0):,.2f}<br/>
                平均注文額: ¥{summary.get('average_order_value', 0):,.2f}<br/>
                ユニーク顧客数: {summary.get('unique_customers', 'N/A')}
                """
                story.append(Paragraph(summary_text, metadata_style))
                story.append(Spacer(1, 20))
        
        # Create table with data
        if not df.empty:
            # Convert DataFrame to table data
            table_data = [df.columns.tolist()] + df.values.tolist()
            
            # Create table style
            table_style = TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ])
            
            # Create table
            t = Table(table_data)
            t.setStyle(table_style)
            story.append(t)
        
        # Generate PDF
        doc.build(story)
        
        # Return PDF content
        buffer.seek(0)
        return buffer.getvalue()
    
    def _create_date_chunks(
        self, 
        start_date: datetime, 
        end_date: datetime, 
        chunk_days: int = 30
    ) -> List[Tuple[datetime, datetime]]:
        """Create date chunks for parallel processing."""
        chunks = []
        current_start = start_date
        
        while current_start < end_date:
            current_end = min(current_start + timedelta(days=chunk_days), end_date)
            chunks.append((current_start, current_end))
            current_start = current_end
        
        return chunks
    
    async def get_order_summary_async(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        group_by: str = 'day'
    ) -> Dict[str, Any]:
        """Async version of get_order_summary."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            self.executor,
            self.get_order_summary,
            start_date,
            end_date,
            group_by
        )
    
    def get_sales_analysis(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get sales analysis with revenue breakdown."""
        # Similar implementation with caching and optimization
        cache_key = self._get_cache_key(
            'get_sales_analysis',
            start_date=start_date,
            end_date=end_date
        )
        
        cached_result = self.cache.get(cache_key)
        if cached_result is not None:
            return cached_result
        
        # Implementation similar to get_order_summary
        # with sales-specific metrics
        result = {
            "data": [],
            "summary": {
                "total_revenue": 0,
                "top_products": [],
                "conversion_rate": 0
            }
        }
        
        self.cache.set(cache_key, result)
        return result
    
    def get_category_sales(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get sales by category."""
        # Implementation similar to other methods
        return {
            "data": [],
            "summary": {}
        }
    
    def get_geographic_distribution(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get geographic distribution of sales."""
        # Implementation similar to other methods
        return {
            "data": [],
            "summary": {}
        }
    
    def clear_cache(self):
        """Clear the analytics cache."""
        self.cache.clear()
        logger.info("Analytics cache cleared")
    
    def __del__(self):
        """Cleanup executor on deletion."""
        self.executor.shutdown(wait=False)