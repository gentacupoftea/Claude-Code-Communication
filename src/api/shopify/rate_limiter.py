"""
Shopify GraphQL Rate Limiter
Enhanced rate limiting with query cost calculation and predictive throttling
"""

import asyncio
import time
import logging
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass, field
from collections import deque
import math

logger = logging.getLogger(__name__)


@dataclass
class QueryCostEstimate:
    """Query cost estimation result"""
    base_cost: int = 0
    connection_cost: int = 0
    field_cost: int = 0
    total_cost: int = 0
    confidence: float = 0.0
    
    def __post_init__(self):
        self.total_cost = self.base_cost + self.connection_cost + self.field_cost


@dataclass
class RateLimitState:
    """Current rate limit state"""
    timestamp: float = field(default_factory=time.time)
    cost_available: int = 1000
    cost_limit: int = 1000
    restore_rate: int = 50
    bucket_size: int = 1000
    queries_queued: int = 0
    queries_executing: int = 0
    
    @property
    def usage_percentage(self) -> float:
        """Calculate current usage percentage"""
        return 1.0 - (self.cost_available / self.cost_limit)
    
    @property
    def time_to_full_restore(self) -> float:
        """Calculate time to full restore in seconds"""
        cost_to_restore = self.cost_limit - self.cost_available
        return cost_to_restore / self.restore_rate if self.restore_rate > 0 else 0


@dataclass
class QueryExecution:
    """Query execution tracking"""
    query_id: str
    estimated_cost: int
    actual_cost: Optional[int] = None
    start_time: float = field(default_factory=time.time)
    end_time: Optional[float] = None
    wait_time: float = 0
    execution_time: float = 0
    success: bool = False
    error: Optional[str] = None


class CostCalculator:
    """Calculate query costs based on GraphQL structure"""
    
    # Cost factors based on Shopify's documentation
    FIELD_COSTS = {
        'id': 0,
        'createdAt': 0,
        'updatedAt': 0,
        # Simple fields
        'title': 1,
        'name': 1,
        'email': 1,
        'description': 1,
        # Complex fields
        'metafields': 2,
        'tags': 2,
        # Computed fields
        'totalPrice': 3,
        'subtotalPrice': 3,
        'availableForSale': 3,
    }
    
    CONNECTION_COSTS = {
        'edges': 2,
        'node': 1,
        'pageInfo': 1,
        'hasNextPage': 0,
        'hasPreviousPage': 0,
    }
    
    MULTIPLIER_FIELDS = {
        'first': 1.0,
        'last': 1.0,
        'after': 0.5,
        'before': 0.5,
    }
    
    def estimate_query_cost(self, query: str) -> QueryCostEstimate:
        """Estimate the cost of a GraphQL query"""
        estimate = QueryCostEstimate()
        
        # Base cost
        estimate.base_cost = 1
        
        # Parse query structure
        lines = query.strip().split('\n')
        
        # Count fields and connections
        field_count = 0
        connection_count = 0
        max_items = 50  # Default
        
        for line in lines:
            line = line.strip()
            
            # Extract field name
            field_match = line.split(':')[0].split('(')[0].strip()
            
            # Check field costs
            for field, cost in self.FIELD_COSTS.items():
                if field in field_match:
                    field_count += 1
                    estimate.field_cost += cost
            
            # Check connection costs
            for conn, cost in self.CONNECTION_COSTS.items():
                if conn in field_match:
                    connection_count += 1
                    estimate.connection_cost += cost
            
            # Check for first/last parameters
            if 'first:' in line or 'last:' in line:
                try:
                    # Extract number
                    parts = line.split(':')
                    for i, part in enumerate(parts):
                        if 'first' in part or 'last' in part:
                            num_str = parts[i+1].split(')')[0].split(',')[0].strip()
                            max_items = max(max_items, int(num_str))
                except:
                    pass
        
        # Apply multipliers based on pagination
        if max_items > 50:
            multiplier = max_items / 50
            estimate.connection_cost = int(estimate.connection_cost * multiplier)
        
        # Calculate total
        estimate.total_cost = estimate.base_cost + estimate.field_cost + estimate.connection_cost
        
        # Estimate confidence based on query complexity
        if field_count > 0 or connection_count > 0:
            estimate.confidence = 0.7 + (0.3 * min(1.0, (field_count + connection_count) / 20))
        else:
            estimate.confidence = 0.5
        
        return estimate
    
    def learn_from_execution(self, query: str, estimated_cost: int, actual_cost: int):
        """Learn from actual execution costs to improve estimates"""
        # This could be enhanced with ML in the future
        error_rate = abs(estimated_cost - actual_cost) / max(actual_cost, 1)
        
        if error_rate > 0.3:
            logger.warning(f"High cost estimation error: estimated={estimated_cost}, "
                         f"actual={actual_cost}, error_rate={error_rate:.2f}")


class AdaptiveRateLimiter:
    """
    Adaptive rate limiter with:
    - Query cost calculation
    - Predictive throttling
    - Adaptive backoff
    - Priority queuing
    """
    
    def __init__(self,
                 initial_limit: int = 1000,
                 restore_rate: int = 50,
                 bucket_size: int = 1000):
        """
        Initialize rate limiter
        
        Args:
            initial_limit: Initial cost limit
            restore_rate: Cost restoration per second
            bucket_size: Maximum bucket size
        """
        self.state = RateLimitState(
            cost_limit=initial_limit,
            restore_rate=restore_rate,
            bucket_size=bucket_size,
            cost_available=initial_limit
        )
        
        # Components
        self.cost_calculator = CostCalculator()
        self.execution_history: deque = deque(maxlen=100)
        self.cost_history: deque = deque(maxlen=1000)
        
        # Queues
        self.priority_queue: asyncio.PriorityQueue = asyncio.PriorityQueue()
        self.semaphore = asyncio.Semaphore(10)  # Max concurrent queries
        
        # Adaptive parameters
        self.backoff_factor = 1.0
        self.throttle_threshold = 0.8  # Start throttling at 80% usage
        
        # Background tasks
        self.restore_task: Optional[asyncio.Task] = None
        self.running = False
    
    async def start(self):
        """Start the rate limiter"""
        self.running = True
        self.restore_task = asyncio.create_task(self._restore_loop())
        logger.info("Rate limiter started")
    
    async def stop(self):
        """Stop the rate limiter"""
        self.running = False
        if self.restore_task:
            await self.restore_task
        logger.info("Rate limiter stopped")
    
    async def _restore_loop(self):
        """Background task to restore available cost"""
        while self.running:
            try:
                # Restore cost
                elapsed = time.time() - self.state.timestamp
                restore_amount = int(elapsed * self.state.restore_rate)
                
                if restore_amount > 0:
                    self.state.cost_available = min(
                        self.state.cost_limit,
                        self.state.cost_available + restore_amount
                    )
                    self.state.timestamp = time.time()
                    
                    # Adjust backoff factor based on restoration
                    if self.state.usage_percentage < 0.5:
                        self.backoff_factor = max(0.5, self.backoff_factor * 0.9)
                
                await asyncio.sleep(1)
                
            except Exception as e:
                logger.error(f"Error in restore loop: {e}")
    
    async def acquire(self, 
                     query: str,
                     priority: int = 5,
                     timeout: Optional[float] = None) -> QueryExecution:
        """
        Acquire permission to execute a query
        
        Args:
            query: GraphQL query string
            priority: Query priority (1=highest, 10=lowest)
            timeout: Maximum wait time
            
        Returns:
            QueryExecution object
        """
        query_id = f"{time.time()}_{id(query)}"
        
        # Estimate query cost
        cost_estimate = self.cost_calculator.estimate_query_cost(query)
        estimated_cost = cost_estimate.total_cost
        
        execution = QueryExecution(
            query_id=query_id,
            estimated_cost=estimated_cost
        )
        
        # Add to priority queue
        await self.priority_queue.put((priority, execution))
        self.state.queries_queued += 1
        
        try:
            # Wait for our turn
            while True:
                # Check if we're next
                if self.priority_queue.qsize() > 0:
                    next_priority, next_execution = await self.priority_queue.get()
                    
                    if next_execution.query_id == query_id:
                        # Our turn - check if we can proceed
                        wait_time = await self._wait_for_capacity(estimated_cost, timeout)
                        execution.wait_time = wait_time
                        
                        # Acquire semaphore
                        await self.semaphore.acquire()
                        
                        # Reserve cost
                        self.state.cost_available -= estimated_cost
                        self.state.queries_executing += 1
                        
                        return execution
                    else:
                        # Not our turn - put it back
                        await self.priority_queue.put((next_priority, next_execution))
                
                await asyncio.sleep(0.01)
                
        except asyncio.TimeoutError:
            execution.error = "Timeout waiting for rate limit"
            raise
        finally:
            self.state.queries_queued = max(0, self.state.queries_queued - 1)
    
    async def _wait_for_capacity(self, 
                               required_cost: int,
                               timeout: Optional[float] = None) -> float:
        """Wait for sufficient capacity"""
        start_time = time.time()
        
        while True:
            # Check if we have capacity
            if self.state.cost_available >= required_cost:
                return time.time() - start_time
            
            # Calculate wait time
            wait_time = self._calculate_wait_time(required_cost)
            
            # Apply adaptive backoff
            wait_time *= self.backoff_factor
            
            # Check timeout
            if timeout and (time.time() - start_time + wait_time) > timeout:
                raise asyncio.TimeoutError()
            
            await asyncio.sleep(wait_time)
    
    def _calculate_wait_time(self, required_cost: int) -> float:
        """Calculate wait time based on cost and restoration rate"""
        if self.state.restore_rate <= 0:
            return 1.0
        
        # Basic wait time
        cost_deficit = required_cost - self.state.cost_available
        base_wait = cost_deficit / self.state.restore_rate
        
        # Apply throttling based on usage
        if self.state.usage_percentage > self.throttle_threshold:
            # Exponential backoff when highly utilized
            throttle_factor = math.exp(
                (self.state.usage_percentage - self.throttle_threshold) * 5
            )
            base_wait *= throttle_factor
        
        return max(0.1, min(base_wait, 60.0))  # Between 0.1s and 60s
    
    def release(self, execution: QueryExecution, actual_cost: Optional[int] = None):
        """Release query execution and update state"""
        execution.end_time = time.time()
        execution.execution_time = execution.end_time - execution.start_time - execution.wait_time
        
        if actual_cost is not None:
            execution.actual_cost = actual_cost
            
            # Adjust for actual cost
            cost_difference = actual_cost - execution.estimated_cost
            self.state.cost_available -= cost_difference
            
            # Learn from execution
            self.cost_calculator.learn_from_execution(
                "",  # Query not stored for privacy
                execution.estimated_cost,
                actual_cost
            )
        
        # Update state
        self.state.queries_executing = max(0, self.state.queries_executing - 1)
        self.semaphore.release()
        
        # Record execution
        self.execution_history.append(execution)
        self.cost_history.append(execution.actual_cost or execution.estimated_cost)
        
        # Adjust adaptive parameters
        self._adjust_parameters()
    
    def _adjust_parameters(self):
        """Adjust adaptive parameters based on history"""
        if len(self.cost_history) < 10:
            return
        
        # Calculate recent cost accuracy
        recent_executions = list(self.execution_history)[-10:]
        
        accuracy_sum = 0
        accuracy_count = 0
        
        for exec in recent_executions:
            if exec.actual_cost is not None:
                error = abs(exec.actual_cost - exec.estimated_cost)
                accuracy = 1.0 - (error / max(exec.actual_cost, 1))
                accuracy_sum += accuracy
                accuracy_count += 1
        
        if accuracy_count > 0:
            avg_accuracy = accuracy_sum / accuracy_count
            
            # Adjust backoff based on accuracy
            if avg_accuracy > 0.8:
                self.backoff_factor = max(0.5, self.backoff_factor * 0.95)
            elif avg_accuracy < 0.6:
                self.backoff_factor = min(2.0, self.backoff_factor * 1.05)
    
    def update_limits(self, headers: Dict[str, str]):
        """Update rate limits from response headers"""
        if 'X-Shopify-API-Call-Limit' in headers:
            parts = headers['X-Shopify-API-Call-Limit'].split('/')
            if len(parts) == 2:
                used = int(parts[0])
                limit = int(parts[1])
                
                self.state.cost_available = limit - used
                self.state.cost_limit = limit
                self.state.timestamp = time.time()
    
    def get_state(self) -> Dict[str, Any]:
        """Get current rate limiter state"""
        recent_executions = list(self.execution_history)[-10:]
        
        avg_wait_time = sum(e.wait_time for e in recent_executions) / len(recent_executions) if recent_executions else 0
        avg_execution_time = sum(e.execution_time for e in recent_executions) / len(recent_executions) if recent_executions else 0
        
        return {
            'cost_available': self.state.cost_available,
            'cost_limit': self.state.cost_limit,
            'usage_percentage': self.state.usage_percentage,
            'restore_rate': self.state.restore_rate,
            'queries_queued': self.state.queries_queued,
            'queries_executing': self.state.queries_executing,
            'backoff_factor': self.backoff_factor,
            'avg_wait_time': avg_wait_time,
            'avg_execution_time': avg_execution_time,
            'time_to_full_restore': self.state.time_to_full_restore,
        }
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get performance metrics"""
        total_executions = len(self.execution_history)
        if total_executions == 0:
            return {}
        
        successful = sum(1 for e in self.execution_history if e.success)
        failed = total_executions - successful
        
        # Cost statistics
        if self.cost_history:
            avg_cost = sum(self.cost_history) / len(self.cost_history)
            max_cost = max(self.cost_history)
            min_cost = min(self.cost_history)
        else:
            avg_cost = max_cost = min_cost = 0
        
        return {
            'total_executions': total_executions,
            'successful': successful,
            'failed': failed,
            'success_rate': successful / total_executions,
            'avg_cost': avg_cost,
            'max_cost': max_cost,
            'min_cost': min_cost,
            'queue_size': self.priority_queue.qsize(),
        }
    
    # Context manager support
    async def __aenter__(self):
        await self.start()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.stop()