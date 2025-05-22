"""
Shopify GraphQL Batch Processor
Combines multiple queries into single requests for efficiency
"""

import asyncio
import json
import logging
from typing import Dict, List, Any, Optional, Tuple, Set
from dataclasses import dataclass, field
from collections import defaultdict
import time

logger = logging.getLogger(__name__)


@dataclass
class QueryRequest:
    """Individual query request"""
    id: str
    query: str
    variables: Optional[Dict[str, Any]] = None
    priority: int = 1
    cost_estimate: int = 0
    dependencies: Set[str] = field(default_factory=set)
    timestamp: float = field(default_factory=time.time)
    callback: Optional[asyncio.Future] = None


@dataclass 
class BatchQuery:
    """Batched query for execution"""
    query: str
    variables: Dict[str, Any]
    request_ids: List[str]
    total_cost: int = 0
    timestamp: float = field(default_factory=time.time)


class GraphQLBatchProcessor:
    """
    Batches multiple GraphQL queries into single requests
    Optimizes for:
    - Query cost efficiency
    - Response time
    - Rate limit compliance
    """
    
    def __init__(self, 
                 graphql_client,
                 batch_size: int = 10,
                 batch_timeout: float = 0.1,
                 max_query_cost: int = 1000):
        """
        Initialize batch processor
        
        Args:
            graphql_client: Shopify GraphQL client
            batch_size: Maximum queries per batch
            batch_timeout: Max time to wait for batch fill (seconds)
            max_query_cost: Maximum cost per batched query
        """
        self.client = graphql_client
        self.batch_size = batch_size
        self.batch_timeout = batch_timeout
        self.max_query_cost = max_query_cost
        
        # Query queue and processing
        self.queue: asyncio.Queue[QueryRequest] = asyncio.Queue()
        self.pending_requests: Dict[str, QueryRequest] = {}
        self.processing = False
        self.processor_task: Optional[asyncio.Task] = None
        
        # Performance metrics
        self.metrics = {
            'total_queries': 0,
            'total_batches': 0,
            'total_cost': 0,
            'avg_batch_size': 0,
            'avg_response_time': 0,
        }
    
    async def start(self):
        """Start the batch processor"""
        if not self.processing:
            self.processing = True
            self.processor_task = asyncio.create_task(self._process_batches())
            logger.info("Batch processor started")
    
    async def stop(self):
        """Stop the batch processor"""
        self.processing = False
        if self.processor_task:
            await self.processor_task
            logger.info("Batch processor stopped")
    
    async def add_query(self, 
                       query: str,
                       variables: Optional[Dict[str, Any]] = None,
                       priority: int = 1,
                       dependencies: Optional[Set[str]] = None) -> Any:
        """
        Add a query to the batch queue
        
        Args:
            query: GraphQL query string
            variables: Query variables
            priority: Priority level (higher = more important)
            dependencies: Set of query IDs this depends on
            
        Returns:
            Query result
        """
        request_id = f"{time.time()}_{id(query)}"
        future = asyncio.get_event_loop().create_future()
        
        request = QueryRequest(
            id=request_id,
            query=query,
            variables=variables,
            priority=priority,
            dependencies=dependencies or set(),
            cost_estimate=self._estimate_query_cost(query),
            callback=future
        )
        
        await self.queue.put(request)
        self.pending_requests[request_id] = request
        
        return await future
    
    async def _process_batches(self):
        """Main batch processing loop"""
        batch_buffer: List[QueryRequest] = []
        last_batch_time = time.time()
        
        while self.processing:
            try:
                # Get queries from queue with timeout
                timeout = max(0.01, self.batch_timeout - (time.time() - last_batch_time))
                
                try:
                    request = await asyncio.wait_for(
                        self.queue.get(), 
                        timeout=timeout
                    )
                    batch_buffer.append(request)
                except asyncio.TimeoutError:
                    pass
                
                # Check if we should process the batch
                should_process = (
                    len(batch_buffer) >= self.batch_size or
                    (time.time() - last_batch_time) >= self.batch_timeout or
                    (batch_buffer and self._estimate_batch_cost(batch_buffer) >= self.max_query_cost)
                )
                
                if should_process and batch_buffer:
                    # Process ready queries
                    ready_queries = self._filter_ready_queries(batch_buffer)
                    
                    if ready_queries:
                        batch = self._create_batch(ready_queries)
                        await self._execute_batch(batch)
                        
                        # Remove processed queries from buffer
                        for req in ready_queries:
                            batch_buffer.remove(req)
                            if req.id in self.pending_requests:
                                del self.pending_requests[req.id]
                    
                    last_batch_time = time.time()
                    
            except Exception as e:
                logger.error(f"Error in batch processor: {e}")
                # Fail all queries in the current batch
                for req in batch_buffer:
                    if req.callback and not req.callback.done():
                        req.callback.set_exception(e)
                batch_buffer.clear()
    
    def _filter_ready_queries(self, queries: List[QueryRequest]) -> List[QueryRequest]:
        """Filter queries that are ready to execute (no pending dependencies)"""
        ready = []
        
        for query in queries:
            if not query.dependencies:
                ready.append(query)
            else:
                # Check if all dependencies are completed
                pending_deps = query.dependencies.intersection(set(self.pending_requests.keys()))
                if not pending_deps:
                    ready.append(query)
        
        # Sort by priority (descending) and timestamp (ascending)
        ready.sort(key=lambda q: (-q.priority, q.timestamp))
        
        return ready[:self.batch_size]
    
    def _create_batch(self, queries: List[QueryRequest]) -> BatchQuery:
        """Create a batched query from individual queries"""
        # Combine queries into a single GraphQL query
        combined_query = "query BatchedQuery {\n"
        combined_variables = {}
        request_ids = []
        total_cost = 0
        
        for i, req in enumerate(queries):
            alias = f"q{i}"
            
            # Extract operation from query
            operation = self._extract_operation(req.query)
            
            # Add aliased operation
            combined_query += f"  {alias}: {operation}\n"
            
            # Merge variables with prefixed names
            if req.variables:
                for key, value in req.variables.items():
                    combined_variables[f"{alias}_{key}"] = value
            
            request_ids.append(req.id)
            total_cost += req.cost_estimate
        
        combined_query += "}"
        
        return BatchQuery(
            query=combined_query,
            variables=combined_variables,
            request_ids=request_ids,
            total_cost=total_cost
        )
    
    def _extract_operation(self, query: str) -> str:
        """Extract the operation from a GraphQL query"""
        # Remove query declaration and extract the operation
        lines = query.strip().split('\n')
        
        # Find the start of the operation
        start_idx = 0
        for i, line in enumerate(lines):
            if '{' in line and 'query' in line:
                start_idx = i + 1
                break
        
        # Extract operation lines
        operation_lines = []
        brace_count = 0
        
        for line in lines[start_idx:]:
            if '{' in line:
                brace_count += line.count('{')
            if '}' in line:
                brace_count -= line.count('}')
                
            operation_lines.append(line)
            
            if brace_count == 0:
                break
        
        # Remove the closing brace if present
        if operation_lines and operation_lines[-1].strip() == '}':
            operation_lines.pop()
        
        return '\n'.join(operation_lines)
    
    async def _execute_batch(self, batch: BatchQuery):
        """Execute a batched query"""
        start_time = time.time()
        
        try:
            # Execute the batched query
            results = await self.client.execute_query(
                batch.query,
                batch.variables
            )
            
            # Distribute results to individual callbacks
            for i, request_id in enumerate(batch.request_ids):
                alias = f"q{i}"
                request = self.pending_requests.get(request_id)
                
                if request and request.callback and not request.callback.done():
                    if alias in results:
                        request.callback.set_result(results[alias])
                    else:
                        request.callback.set_exception(
                            Exception(f"No result for query {alias}")
                        )
            
            # Update metrics
            elapsed = time.time() - start_time
            self._update_metrics(batch, elapsed)
            
            logger.info(f"Executed batch of {len(batch.request_ids)} queries "
                       f"in {elapsed:.3f}s (cost: {batch.total_cost})")
            
        except Exception as e:
            logger.error(f"Batch execution failed: {e}")
            # Fail all queries in the batch
            for request_id in batch.request_ids:
                request = self.pending_requests.get(request_id)
                if request and request.callback and not request.callback.done():
                    request.callback.set_exception(e)
    
    def _estimate_query_cost(self, query: str) -> int:
        """Estimate the cost of a query based on its structure"""
        # Simple heuristic: count fields and connections
        cost = 1  # Base cost
        
        # Count fields
        cost += query.count('\n') * 0.5
        
        # Count connections (edges, nodes)
        cost += query.count('edges') * 10
        cost += query.count('nodes') * 10
        
        # Count pagination parameters
        cost += query.count('first:') * 5
        cost += query.count('last:') * 5
        
        return int(cost)
    
    def _estimate_batch_cost(self, queries: List[QueryRequest]) -> int:
        """Estimate total cost of a batch of queries"""
        return sum(q.cost_estimate for q in queries)
    
    def _update_metrics(self, batch: BatchQuery, elapsed: float):
        """Update performance metrics"""
        self.metrics['total_queries'] += len(batch.request_ids)
        self.metrics['total_batches'] += 1
        self.metrics['total_cost'] += batch.total_cost
        
        # Update averages
        total_batches = self.metrics['total_batches']
        
        self.metrics['avg_batch_size'] = (
            (self.metrics['avg_batch_size'] * (total_batches - 1) + len(batch.request_ids))
            / total_batches
        )
        
        self.metrics['avg_response_time'] = (
            (self.metrics['avg_response_time'] * (total_batches - 1) + elapsed)
            / total_batches
        )
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get current performance metrics"""
        return {
            **self.metrics,
            'queue_size': self.queue.qsize(),
            'pending_requests': len(self.pending_requests),
            'processing': self.processing,
        }
    
    # Context manager support
    async def __aenter__(self):
        await self.start()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.stop()


class QueryOptimizer:
    """
    Optimizes GraphQL queries by:
    - Removing unnecessary fields
    - Combining similar queries
    - Reusing fragments
    """
    
    def __init__(self):
        self.field_usage_stats: Dict[str, int] = defaultdict(int)
        self.fragment_cache: Dict[str, str] = {}
    
    def optimize_query(self, query: str, required_fields: Set[str]) -> str:
        """Optimize a query by removing unnecessary fields"""
        # Track field usage
        for field in required_fields:
            self.field_usage_stats[field] += 1
        
        # TODO: Implement query optimization logic
        # This is a placeholder for future implementation
        return query
    
    def suggest_fragments(self) -> List[str]:
        """Suggest common fragments based on usage patterns"""
        # Analyze field usage and suggest fragments
        common_patterns = []
        
        # Find frequently used field combinations
        # TODO: Implement pattern detection
        
        return common_patterns