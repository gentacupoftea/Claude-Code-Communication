"""
Shopify GraphQL Query Optimizer
Optimizes GraphQL queries for performance and efficiency
"""

import logging
import re
import hashlib
import json
from typing import Dict, List, Optional, Set, Any, Tuple
from dataclasses import dataclass, field
from functools import lru_cache

from .fragment_library import fragment_library

logger = logging.getLogger(__name__)


@dataclass
class QueryOptimizationResult:
    """Results of query optimization"""
    original_query: str
    optimized_query: str
    fields_removed: List[str] = field(default_factory=list)
    fields_added: List[str] = field(default_factory=list)
    fragments_added: List[str] = field(default_factory=list)
    estimated_cost_original: int = 0
    estimated_cost_optimized: int = 0
    optimization_ratio: float = 0.0
    
    def __post_init__(self):
        if self.estimated_cost_original > 0:
            self.optimization_ratio = 1.0 - (self.estimated_cost_optimized / self.estimated_cost_original)


class QueryOptimizer:
    """
    GraphQL query optimizer for Shopify API
    
    Features:
    - Removes unnecessary fields
    - Combines similar queries
    - Reuses fragments
    - Limits query depth
    - Optimizes pagination
    """
    
    # Field usage impact (estimated cost multiplier)
    FIELD_IMPACT = {
        # Basic fields (negligible impact)
        'id': 0,
        'createdAt': 0,
        'updatedAt': 0,
        'title': 0.1,
        'name': 0.1,
        
        # Medium impact fields
        'metafields': 2.0,
        'tags': 1.5,
        'description': 1.2,
        'descriptionHtml': 1.5,
        
        # High impact fields (computations)
        'inventoryQuantity': 3.0,
        'totalPrice': 2.5,
        'subtotalPriceSet': 2.0,
        
        # Connection fields
        'lineItems': 5.0,
        'variants': 5.0,
        'images': 4.0,
        'orders': 8.0,
        'products': 8.0,
        'collections': 6.0,
    }
    
    # Maximum recommended depth for queries
    MAX_RECOMMENDED_DEPTH = 8
    
    # Optimal page sizes for different entity types
    OPTIMAL_PAGE_SIZES = {
        'default': 50,
        'orders': 50,
        'products': 50,
        'customers': 100,
        'lineItems': 50,
        'variants': 100,
        'images': 10,
    }
    
    def __init__(self, usage_stats: Optional[Dict[str, int]] = None):
        """
        Initialize query optimizer
        
        Args:
            usage_stats: Optional field usage statistics for adaptive optimization
        """
        self.usage_stats = usage_stats or {}
        
        # Track fields that should be preserved
        self.essential_fields = {
            'id',  # Always preserve ID fields
            'cursor',  # Pagination cursors
            'pageInfo',  # Pagination info
            'hasNextPage',  # Pagination
            'endCursor',  # Pagination
        }
    
    @lru_cache(maxsize=64)
    def estimate_query_cost(self, query: str) -> int:
        """
        Estimate the cost of a GraphQL query
        
        Args:
            query: GraphQL query
            
        Returns:
            Estimated cost
        """
        # Base cost
        cost = 1
        
        # Analyze query structure
        analysis = fragment_library.analyze_query(query)
        
        # Field count cost
        cost += analysis['field_count'] * 0.5
        
        # Connection cost
        cost += analysis['connection_count'] * 10
        
        # Depth penalty
        if analysis['query_depth'] > self.MAX_RECOMMENDED_DEPTH:
            depth_penalty = (analysis['query_depth'] - self.MAX_RECOMMENDED_DEPTH) * 5
            cost += depth_penalty
        
        # Check for pagination parameters
        pagination_matches = re.findall(r'first:\s*(\d+)', query)
        for match in pagination_matches:
            page_size = int(match)
            # Penalize excessive page sizes
            if page_size > 100:
                cost += (page_size - 100) * 0.1
        
        # Calculate impact from specific fields
        for field, impact in self.FIELD_IMPACT.items():
            if f" {field}" in query or f"\n{field}" in query:
                cost += impact
        
        return int(cost)
    
    def optimize(self, query: str) -> QueryOptimizationResult:
        """
        Optimize a GraphQL query
        
        Args:
            query: GraphQL query
            
        Returns:
            Optimization result
        """
        if not query.strip():
            return QueryOptimizationResult(
                original_query=query,
                optimized_query=query
            )
        
        # Estimate original cost
        original_cost = self.estimate_query_cost(query)
        
        # Track optimization changes
        fields_removed = []
        fields_added = []
        fragments_added = []
        
        # Step 1: Apply fragments for common patterns
        optimized_query = fragment_library.optimize_query(query)
        if "fragment " in optimized_query and "fragment " not in query:
            # Extract fragment names that were added
            fragment_matches = re.findall(r'fragment\s+(\w+)\s+on', optimized_query)
            fragments_added.extend(fragment_matches)
        
        # Step 2: Optimize page sizes
        optimized_query = self._optimize_page_sizes(optimized_query)
        
        # Step 3: Remove unnecessary fields based on usage patterns
        if self.usage_stats:
            optimized_query, removed_fields = self._remove_unused_fields(
                optimized_query, self.usage_stats
            )
            fields_removed.extend(removed_fields)
        
        # Step 4: Limit query depth if excessive
        current_analysis = fragment_library.analyze_query(optimized_query)
        if current_analysis['query_depth'] > self.MAX_RECOMMENDED_DEPTH:
            optimized_query = self._limit_query_depth(
                optimized_query, current_analysis['query_depth']
            )
        
        # Estimate optimized cost
        optimized_cost = self.estimate_query_cost(optimized_query)
        
        return QueryOptimizationResult(
            original_query=query,
            optimized_query=optimized_query,
            fields_removed=fields_removed,
            fields_added=fields_added,
            fragments_added=fragments_added,
            estimated_cost_original=original_cost,
            estimated_cost_optimized=optimized_cost
        )
    
    def _optimize_page_sizes(self, query: str) -> str:
        """Optimize pagination page sizes"""
        optimized = query
        
        # Find pagination parameters with large page sizes
        for entity, optimal_size in self.OPTIMAL_PAGE_SIZES.items():
            # Look for pagination with too many items
            pattern = rf'({entity}.*?first:\s*)(\d+)(\s*\))'
            matches = re.findall(pattern, query, re.IGNORECASE | re.DOTALL)
            
            for match in matches:
                try:
                    prefix, size_str, suffix = match
                    size = int(size_str)
                    
                    # If size is larger than optimal, replace it
                    if size > optimal_size:
                        old_pagination = f"{prefix}{size_str}{suffix}"
                        new_pagination = f"{prefix}{optimal_size}{suffix}"
                        optimized = optimized.replace(old_pagination, new_pagination)
                        logger.info(
                            f"Optimized page size for {entity}: {size} -> {optimal_size}"
                        )
                except (ValueError, IndexError) as e:
                    logger.warning(f"Error optimizing page size: {e}")
        
        return optimized
    
    def _remove_unused_fields(self, query: str, usage_stats: Dict[str, int]) -> Tuple[str, List[str]]:
        """
        Remove fields that are rarely used based on usage statistics
        
        Args:
            query: GraphQL query
            usage_stats: Field usage statistics
            
        Returns:
            Optimized query and list of removed fields
        """
        removed_fields = []
        optimized = query
        
        # Calculate usage threshold (fields used less than 10% of the time)
        if not usage_stats:
            return query, []
            
        max_usage = max(usage_stats.values()) if usage_stats else 1
        threshold = max(1, max_usage * 0.1)
        
        # Identify rarely used fields
        rarely_used = {
            field for field, count in usage_stats.items()
            if count < threshold and field not in self.essential_fields
        }
        
        if not rarely_used:
            return query, []
        
        # Parse query and remove rarely used fields
        lines = optimized.split('\n')
        filtered_lines = []
        
        for line in lines:
            should_remove = False
            
            # Check if line contains a rarely used field
            for field in rarely_used:
                field_pattern = rf'\s+{re.escape(field)}(\s*{{|\s*$|\s*\()'
                if re.search(field_pattern, line):
                    should_remove = True
                    removed_fields.append(field)
                    break
            
            if not should_remove:
                filtered_lines.append(line)
        
        return '\n'.join(filtered_lines), removed_fields
    
    def _limit_query_depth(self, query: str, current_depth: int) -> str:
        """
        Limit query depth if it exceeds recommendations
        
        Args:
            query: GraphQL query
            current_depth: Current query depth
            
        Returns:
            Depth-limited query
        """
        if current_depth <= self.MAX_RECOMMENDED_DEPTH:
            return query
        
        # This is a simplified implementation that would need to be
        # more sophisticated in a real-world application
        
        # Replace deeply nested structures with their IDs
        depth_to_remove = current_depth - self.MAX_RECOMMENDED_DEPTH
        
        # Find the deepest nesting level
        lines = query.split('\n')
        depth_counts = [line.count('{') - line.count('}') for line in lines]
        cum_depth = 0
        depth_map = []
        
        for d in depth_counts:
            cum_depth += d
            depth_map.append(cum_depth)
        
        # Identify lines at the deepest levels
        deep_line_indices = []
        for i, depth in enumerate(depth_map):
            if depth >= self.MAX_RECOMMENDED_DEPTH:
                # Check if opening a new block at a deep level
                if '{' in lines[i] and depth > self.MAX_RECOMMENDED_DEPTH:
                    deep_line_indices.append(i)
        
        # Replace deep structures with simple ID fields
        for i in sorted(deep_line_indices, reverse=True):
            # Find matching closing brace
            depth = depth_map[i]
            closing_idx = i
            
            for j in range(i + 1, len(lines)):
                if depth_map[j] < depth:
                    closing_idx = j
                    break
            
            # Replace deep structure with ID
            if closing_idx > i:
                # Keep opening line but simplify contents
                simplified = lines[i].split('{')[0] + "{ id }"
                
                # Replace the entire block
                lines = lines[:i] + [simplified] + lines[closing_idx+1:]
                
                # Recalculate depth map
                depth_counts = [line.count('{') - line.count('}') for line in lines]
                cum_depth = 0
                depth_map = []
                
                for d in depth_counts:
                    cum_depth += d
                    depth_map.append(cum_depth)
        
        return '\n'.join(lines)
    
    def combine_queries(self, queries: List[str]) -> Tuple[str, Dict[str, Any]]:
        """
        Combine multiple similar queries into a single batched query
        
        Args:
            queries: List of GraphQL queries
            
        Returns:
            Combined query and mapping information
        """
        if not queries:
            return "", {}
            
        if len(queries) == 1:
            return queries[0], {"0": 0}
        
        # Simple implementation for combining two or more queries
        combined_query = "query BatchedQuery {\n"
        query_map = {}
        
        # Add each query as an alias
        for i, query in enumerate(queries):
            # Extract operation from query
            operation = self._extract_operation(query)
            if not operation:
                continue
                
            alias = f"q{i}"
            combined_query += f"  {alias}: {operation}\n"
            query_map[alias] = i
        
        combined_query += "}"
        
        return combined_query, query_map
    
    def _extract_operation(self, query: str) -> Optional[str]:
        """Extract operation from a GraphQL query"""
        # Find the operation
        match = re.search(r'{([^{}]*)({[^}]*})}', query, re.DOTALL)
        if not match:
            return None
            
        return match.group(0).strip()


# Singleton instance
query_optimizer = QueryOptimizer()