"""
GraphQL Pagination helpers
Based on PR #20 pagination approach with unified error handling
"""

import asyncio
from typing import AsyncIterator, Dict, Any, Optional, TypeVar, Generic
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)

T = TypeVar('T')


@dataclass
class PageInfo:
    """GraphQL PageInfo object"""
    has_next_page: bool
    has_previous_page: bool = False
    end_cursor: Optional[str] = None
    start_cursor: Optional[str] = None


class GraphQLPaginator(Generic[T]):
    """
    Generic GraphQL paginator for cursor-based pagination
    PR #20のアプローチを採用し、統一されたページネーション処理を提供
    """
    
    def __init__(self, 
                 client: 'ShopifyGraphQLAPI',
                 query_func,
                 first: int = 50,
                 **query_kwargs):
        """
        Initialize paginator with a GraphQL client and query function
        
        Args:
            client: ShopifyGraphQLAPI instance
            query_func: Async function that executes the GraphQL query
            first: Number of items per page
            **query_kwargs: Additional arguments for the query function
        """
        self.client = client
        self.query_func = query_func
        self.first = first
        self.query_kwargs = query_kwargs
        self.current_cursor = None
        self.has_next_page = True
        
    async def __aiter__(self) -> AsyncIterator[T]:
        """Async iterator support for paginating through results"""
        while self.has_next_page:
            page_data = await self.fetch_page()
            
            if not page_data:
                break
                
            # Extract edges and page info
            edges = self._extract_edges(page_data)
            page_info = self._extract_page_info(page_data)
            
            self.has_next_page = page_info.has_next_page
            self.current_cursor = page_info.end_cursor
            
            # Yield each item from the page
            for edge in edges:
                node = edge.get('node')
                if node:
                    yield node
    
    async def fetch_page(self) -> Dict[str, Any]:
        """Fetch a single page of results"""
        try:
            return await self.query_func(
                first=self.first,
                after=self.current_cursor,
                **self.query_kwargs
            )
        except Exception as e:
            logger.error(f"Error fetching page: {e}")
            # Return empty result on error to stop pagination
            return {}
    
    def _extract_edges(self, data: Dict[str, Any]) -> list:
        """Extract edges from the GraphQL response"""
        # Handle different response structures
        for key in data:
            if isinstance(data[key], dict) and 'edges' in data[key]:
                return data[key]['edges']
        return []
    
    def _extract_page_info(self, data: Dict[str, Any]) -> PageInfo:
        """Extract PageInfo from the GraphQL response"""
        # Handle different response structures
        for key in data:
            if isinstance(data[key], dict) and 'pageInfo' in data[key]:
                info = data[key]['pageInfo']
                return PageInfo(
                    has_next_page=info.get('hasNextPage', False),
                    has_previous_page=info.get('hasPreviousPage', False),
                    end_cursor=info.get('endCursor'),
                    start_cursor=info.get('startCursor')
                )
        
        # Default page info if not found
        return PageInfo(has_next_page=False)


class AsyncBatchPaginator:
    """
    Async batch paginator for fetching multiple pages concurrently
    High-performance pagination for large datasets
    """
    
    def __init__(self,
                 client: 'ShopifyGraphQLAPI',
                 query_func,
                 batch_size: int = 5,
                 first: int = 50,
                 **query_kwargs):
        """
        Initialize batch paginator
        
        Args:
            client: ShopifyGraphQLAPI instance
            query_func: Async function that executes the GraphQL query
            batch_size: Number of pages to fetch concurrently
            first: Number of items per page
            **query_kwargs: Additional arguments for the query function
        """
        self.client = client
        self.query_func = query_func
        self.batch_size = batch_size
        self.first = first
        self.query_kwargs = query_kwargs
        
    async def fetch_all(self, max_pages: Optional[int] = None) -> list:
        """
        Fetch all pages using concurrent batch processing
        
        Args:
            max_pages: Maximum number of pages to fetch (optional)
            
        Returns:
            List of all items from all pages
        """
        all_items = []
        page_count = 0
        cursor = None
        has_next = True
        
        while has_next and (max_pages is None or page_count < max_pages):
            # Prepare batch of page fetches
            tasks = []
            cursors = []
            
            for i in range(self.batch_size):
                if not has_next or (max_pages and page_count >= max_pages):
                    break
                    
                task = self.query_func(
                    first=self.first,
                    after=cursor,
                    **self.query_kwargs
                )
                tasks.append(task)
                cursors.append(cursor)
                page_count += 1
                
                # For subsequent tasks in the batch, we don't have cursors yet
                # This is a limitation of concurrent fetching
                if i == 0:
                    # Fetch first page to get the cursor for next iteration
                    first_page = await task
                    edges = self._extract_edges(first_page)
                    page_info = self._extract_page_info(first_page)
                    
                    if edges:
                        all_items.extend([edge['node'] for edge in edges if 'node' in edge])
                    
                    cursor = page_info.end_cursor
                    has_next = page_info.has_next_page
                    
                    # Remove the completed task
                    tasks.pop(0)
            
            # Fetch remaining pages in the batch
            if tasks:
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                for result in results:
                    if isinstance(result, Exception):
                        logger.error(f"Error in batch fetch: {result}")
                        continue
                        
                    edges = self._extract_edges(result)
                    if edges:
                        all_items.extend([edge['node'] for edge in edges if 'node' in edge])
                    
                    # Update pagination info from last result
                    page_info = self._extract_page_info(result)
                    cursor = page_info.end_cursor
                    has_next = page_info.has_next_page
        
        return all_items
    
    def _extract_edges(self, data: Dict[str, Any]) -> list:
        """Extract edges from the GraphQL response"""
        for key in data:
            if isinstance(data[key], dict) and 'edges' in data[key]:
                return data[key]['edges']
        return []
    
    def _extract_page_info(self, data: Dict[str, Any]) -> PageInfo:
        """Extract PageInfo from the GraphQL response"""
        for key in data:
            if isinstance(data[key], dict) and 'pageInfo' in data[key]:
                info = data[key]['pageInfo']
                return PageInfo(
                    has_next_page=info.get('hasNextPage', False),
                    has_previous_page=info.get('hasPreviousPage', False),
                    end_cursor=info.get('endCursor'),
                    start_cursor=info.get('startCursor')
                )
        
        return PageInfo(has_next_page=False)