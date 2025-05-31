"""Google Analytics Data API Client

This module provides a client for interacting with Google Analytics 4 (GA4) Data API,
with built-in support for caching, pagination, and retry mechanisms.
"""

import os
import json
import logging
from typing import Any, Dict, List, Optional, Union, Iterator
from datetime import datetime, timedelta

from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    Dimension,
    Metric,
    DateRange,
    RunReportRequest,
    RunReportResponse,
    FilterExpression,
    Filter,
    MetricType,
    OrderBy,
)
from google.oauth2 import service_account
from google.auth.exceptions import RefreshError
import backoff

from .cache import GACache
from .schemas import (
    GAReportRequest,
    GAReportResponse,
    GADimension,
    GAMetric,
    GADateRange,
)
from .utils import (
    format_date,
    parse_date_range,
    validate_dimensions,
    validate_metrics,
)

# Configure logging
logger = logging.getLogger(__name__)


class GoogleAnalyticsClient:
    """Client for interacting with Google Analytics 4 Data API
    
    This client provides methods for retrieving analytics data, with built-in
    support for caching, pagination, and error handling.
    """
    
    def __init__(
        self,
        credentials_path: Optional[str] = None,
        cache_enabled: bool = True,
        cache_ttl: int = 3600,
        max_retries: int = 3,
        timeout: int = 60,
    ):
        """Initialize Google Analytics client
        
        Args:
            credentials_path: Path to service account credentials JSON file
            cache_enabled: Whether to enable caching
            cache_ttl: Cache time-to-live in seconds
            max_retries: Maximum number of retry attempts
            timeout: Request timeout in seconds
        """
        self.credentials_path = credentials_path or os.getenv('GA_CREDENTIALS_PATH')
        if not self.credentials_path:
            raise ValueError("Credentials path must be provided or set via GA_CREDENTIALS_PATH")
        
        self.cache_enabled = cache_enabled
        self.cache_ttl = cache_ttl
        self.max_retries = max_retries
        self.timeout = timeout
        
        # Initialize cache if enabled
        self.cache = GACache(ttl=cache_ttl) if cache_enabled else None
        
        # Initialize GA4 client
        self._client = None
        self._credentials = None
        self._initialize_client()
    
    def _initialize_client(self) -> None:
        """Initialize Google Analytics Data API client"""
        try:
            # Load service account credentials
            self._credentials = service_account.Credentials.from_service_account_file(
                self.credentials_path,
                scopes=['https://www.googleapis.com/auth/analytics.readonly']
            )
            
            # Create GA4 client
            self._client = BetaAnalyticsDataClient(credentials=self._credentials)
            
            logger.info("Successfully initialized Google Analytics client")
        except Exception as e:
            logger.error(f"Failed to initialize Google Analytics client: {e}")
            raise
    
    @backoff.on_exception(
        backoff.expo,
        Exception,
        max_tries=3,
        max_time=60,
        on_backoff=lambda details: logger.warning(
            f"Retrying GA API request (attempt {details['tries']})"
        )
    )
    def _make_api_request(self, request: RunReportRequest) -> RunReportResponse:
        """Make API request with retry logic
        
        Args:
            request: Report request to execute
            
        Returns:
            API response
        """
        try:
            response = self._client.run_report(request, timeout=self.timeout)
            return response
        except RefreshError:
            # Re-initialize client on authentication errors
            logger.warning("Authentication error, re-initializing client")
            self._initialize_client()
            return self._client.run_report(request, timeout=self.timeout)
    
    def run_report(
        self,
        property_id: str,
        dimensions: List[str],
        metrics: List[str],
        date_ranges: List[Dict[str, str]],
        dimension_filter: Optional[Dict[str, Any]] = None,
        metric_filter: Optional[Dict[str, Any]] = None,
        order_bys: Optional[List[Dict[str, Any]]] = None,
        limit: Optional[int] = None,
        offset: int = 0,
        keep_empty_rows: bool = False,
        return_property_quota: bool = False,
    ) -> GAReportResponse:
        """Run a report query against Google Analytics
        
        Args:
            property_id: GA4 property ID (format: properties/XXXXXXXXX)
            dimensions: List of dimension names
            metrics: List of metric names
            date_ranges: List of date ranges
            dimension_filter: Dimension filter expression
            metric_filter: Metric filter expression
            order_bys: Ordering criteria
            limit: Maximum number of rows to return
            offset: Starting row offset
            keep_empty_rows: Whether to include empty metric rows
            return_property_quota: Whether to return property quota usage
            
        Returns:
            Report response with dimensions, metrics, and metadata
        """
        # Validate inputs
        validate_dimensions(dimensions)
        validate_metrics(metrics)
        
        # Create cache key if caching is enabled
        cache_key = None
        if self.cache_enabled:
            cache_key = self._generate_cache_key(
                property_id=property_id,
                dimensions=dimensions,
                metrics=metrics,
                date_ranges=date_ranges,
                dimension_filter=dimension_filter,
                metric_filter=metric_filter,
                order_bys=order_bys,
                limit=limit,
                offset=offset,
            )
            
            # Check cache
            cached_response = self.cache.get(cache_key)
            if cached_response:
                logger.debug(f"Cache hit for key: {cache_key}")
                return cached_response
        
        # Build API request
        request = self._build_report_request(
            property_id=property_id,
            dimensions=dimensions,
            metrics=metrics,
            date_ranges=date_ranges,
            dimension_filter=dimension_filter,
            metric_filter=metric_filter,
            order_bys=order_bys,
            limit=limit,
            offset=offset,
            keep_empty_rows=keep_empty_rows,
            return_property_quota=return_property_quota,
        )
        
        # Make API request
        api_response = self._make_api_request(request)
        
        # Convert to schema response
        response = self._convert_api_response(api_response)
        
        # Cache response if enabled
        if self.cache_enabled and cache_key:
            self.cache.set(cache_key, response)
            logger.debug(f"Cached response for key: {cache_key}")
        
        return response
    
    def run_report_paginated(
        self,
        property_id: str,
        dimensions: List[str],
        metrics: List[str],
        date_ranges: List[Dict[str, str]],
        dimension_filter: Optional[Dict[str, Any]] = None,
        metric_filter: Optional[Dict[str, Any]] = None,
        order_bys: Optional[List[Dict[str, Any]]] = None,
        page_size: int = 10000,
        max_rows: Optional[int] = None,
    ) -> Iterator[GAReportResponse]:
        """Run a paginated report query
        
        Args:
            property_id: GA4 property ID
            dimensions: List of dimension names
            metrics: List of metric names
            date_ranges: List of date ranges
            dimension_filter: Dimension filter expression
            metric_filter: Metric filter expression
            order_bys: Ordering criteria
            page_size: Number of rows per page
            max_rows: Maximum total rows to retrieve
            
        Yields:
            Report response pages
        """
        offset = 0
        total_rows = 0
        
        while True:
            # Calculate limit for this page
            limit = page_size
            if max_rows and total_rows + page_size > max_rows:
                limit = max_rows - total_rows
            
            # Get page of results
            response = self.run_report(
                property_id=property_id,
                dimensions=dimensions,
                metrics=metrics,
                date_ranges=date_ranges,
                dimension_filter=dimension_filter,
                metric_filter=metric_filter,
                order_bys=order_bys,
                limit=limit,
                offset=offset,
            )
            
            # Yield response
            yield response
            
            # Update counters
            row_count = response.row_count
            total_rows += row_count
            offset += row_count
            
            # Check if we're done
            if row_count < limit:
                break
            if max_rows and total_rows >= max_rows:
                break
    
    def _build_report_request(
        self,
        property_id: str,
        dimensions: List[str],
        metrics: List[str],
        date_ranges: List[Dict[str, str]],
        dimension_filter: Optional[Dict[str, Any]] = None,
        metric_filter: Optional[Dict[str, Any]] = None,
        order_bys: Optional[List[Dict[str, Any]]] = None,
        limit: Optional[int] = None,
        offset: int = 0,
        keep_empty_rows: bool = False,
        return_property_quota: bool = False,
    ) -> RunReportRequest:
        """Build RunReportRequest from parameters"""
        # Convert dimensions
        request_dimensions = [
            Dimension(name=dim) for dim in dimensions
        ]
        
        # Convert metrics
        request_metrics = [
            Metric(name=metric) for metric in metrics
        ]
        
        # Convert date ranges
        request_date_ranges = []
        for date_range in date_ranges:
            request_date_ranges.append(
                DateRange(
                    start_date=date_range['start_date'],
                    end_date=date_range['end_date'],
                )
            )
        
        # Build request
        request = RunReportRequest(
            property=property_id,
            dimensions=request_dimensions,
            metrics=request_metrics,
            date_ranges=request_date_ranges,
            keep_empty_rows=keep_empty_rows,
            return_property_quota=return_property_quota,
            offset=offset,
        )
        
        # Add filters if provided
        if dimension_filter:
            request.dimension_filter = self._build_filter_expression(dimension_filter)
        
        if metric_filter:
            request.metric_filter = self._build_filter_expression(metric_filter)
        
        # Add ordering if provided
        if order_bys:
            request.order_bys = self._build_order_bys(order_bys)
        
        # Add limit if provided
        if limit:
            request.limit = limit
        
        return request
    
    def _build_filter_expression(self, filter_dict: Dict[str, Any]) -> FilterExpression:
        """Build FilterExpression from dictionary"""
        # This is a simplified implementation
        # In production, you'd want to support more complex filter expressions
        if 'field_name' in filter_dict and 'value' in filter_dict:
            return FilterExpression(
                filter=Filter(
                    field_name=filter_dict['field_name'],
                    string_filter=Filter.StringFilter(
                        match_type=Filter.StringFilter.MatchType.EXACT,
                        value=filter_dict['value'],
                    )
                )
            )
        else:
            raise ValueError("Invalid filter format")
    
    def _build_order_bys(self, order_bys: List[Dict[str, Any]]) -> List[OrderBy]:
        """Build OrderBy list from dictionaries"""
        result = []
        for order_by in order_bys:
            if 'metric' in order_by:
                result.append(
                    OrderBy(
                        metric=OrderBy.MetricOrderBy(
                            metric_name=order_by['metric']
                        ),
                        desc=order_by.get('desc', False),
                    )
                )
            elif 'dimension' in order_by:
                result.append(
                    OrderBy(
                        dimension=OrderBy.DimensionOrderBy(
                            dimension_name=order_by['dimension']
                        ),
                        desc=order_by.get('desc', False),
                    )
                )
        return result
    
    def _convert_api_response(self, api_response: RunReportResponse) -> GAReportResponse:
        """Convert API response to schema response"""
        # Extract dimension headers
        dimension_headers = [
            GADimension(name=header.name)
            for header in api_response.dimension_headers
        ]
        
        # Extract metric headers
        metric_headers = [
            GAMetric(
                name=header.name,
                type=header.type_.name if header.type_ else None,
            )
            for header in api_response.metric_headers
        ]
        
        # Extract rows
        rows = []
        for row in api_response.rows:
            row_data = {
                'dimensions': [dim.value for dim in row.dimension_values],
                'metrics': [metric.value for metric in row.metric_values],
            }
            rows.append(row_data)
        
        # Create response
        return GAReportResponse(
            dimension_headers=dimension_headers,
            metric_headers=metric_headers,
            rows=rows,
            row_count=api_response.row_count,
            metadata=api_response.metadata,
            property_quota=api_response.property_quota,
        )
    
    def _generate_cache_key(self, **kwargs) -> str:
        """Generate cache key from request parameters"""
        # Sort parameters for consistent key generation
        sorted_params = sorted(kwargs.items())
        key_string = json.dumps(sorted_params, sort_keys=True)
        return f"ga_report:{hash(key_string)}"
    
    def clear_cache(self) -> None:
        """Clear all cached data"""
        if self.cache:
            self.cache.clear()
            logger.info("Cleared Google Analytics cache")
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        if self.cache:
            return self.cache.get_stats()
        return {}