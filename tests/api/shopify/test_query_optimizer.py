"""
Tests for the Shopify GraphQL Query Optimizer
"""

import pytest
from src.api.shopify.query_optimizer import QueryOptimizer, query_optimizer


class TestQueryOptimizer:
    """Tests for the QueryOptimizer class"""
    
    def test_singleton_instance(self):
        """Test singleton instance exists"""
        assert query_optimizer is not None
        assert isinstance(query_optimizer, QueryOptimizer)
    
    def test_estimate_query_cost(self):
        """Test estimating query cost"""
        # Simple query
        simple_query = """
        query {
          shop {
            name
            email
          }
        }
        """
        
        simple_cost = query_optimizer.estimate_query_cost(simple_query)
        assert simple_cost > 0
        
        # Complex query with connections
        complex_query = """
        query {
          orders(first: 50) {
            edges {
              node {
                id
                name
                lineItems(first: 20) {
                  edges {
                    node {
                      id
                      title
                      product {
                        id
                        title
                      }
                    }
                  }
                }
                customer {
                  id
                  email
                  orders(first: 10) {
                    edges {
                      node {
                        id
                      }
                    }
                  }
                }
              }
            }
          }
        }
        """
        
        complex_cost = query_optimizer.estimate_query_cost(complex_query)
        
        # Complex query should cost more
        assert complex_cost > simple_cost
        assert complex_cost > 50  # Due to connections and depth
    
    def test_optimize(self):
        """Test query optimization"""
        # Query with excessive page size
        query = """
        query {
          products(first: 250) {
            edges {
              node {
                id
                title
                variants(first: 150) {
                  edges {
                    node {
                      id
                      title
                    }
                  }
                }
                images(first: 80) {
                  edges {
                    node {
                      id
                      url
                    }
                  }
                }
              }
            }
          }
        }
        """
        
        # Optimize query
        result = query_optimizer.optimize(query)
        
        # Check result
        assert result.original_query == query
        assert result.optimized_query != query
        assert "products(first: 50)" in result.optimized_query  # Reduced from 250
        assert result.estimated_cost_optimized < result.estimated_cost_original
        assert result.optimization_ratio > 0
    
    def test_optimize_with_fragments(self):
        """Test optimization with fragment addition"""
        # Query that can benefit from fragments
        query = """
        query {
          orders(first: 50) {
            edges {
              node {
                id
                name
                createdAt
                totalPrice
                currencyCode
                displayFinancialStatus
                customer {
                  id
                  displayName
                  email
                }
              }
            }
          }
        }
        """
        
        # Optimize query
        result = query_optimizer.optimize(query)
        
        # Should add fragments
        assert "fragment " in result.optimized_query
        assert len(result.fragments_added) > 0
    
    def test_optimize_empty_query(self):
        """Test optimizing empty query"""
        # Empty query should be handled gracefully
        result = query_optimizer.optimize("")
        assert result.original_query == ""
        assert result.optimized_query == ""
    
    def test_combine_queries(self):
        """Test combining multiple queries"""
        # Prepare test queries
        queries = [
            "query { product(id: \"1\") { id title } }",
            "query { product(id: \"2\") { id title } }",
            "query { product(id: \"3\") { id title } }"
        ]
        
        # Combine queries
        combined, mapping = query_optimizer.combine_queries(queries)
        
        # Check result
        assert "BatchedQuery" in combined
        assert "q0:" in combined
        assert "q1:" in combined
        assert "q2:" in combined
        assert len(mapping) == 3
    
    def test_combine_single_query(self):
        """Test combining a single query"""
        queries = ["query { shop { name } }"]
        
        # Combine single query
        combined, mapping = query_optimizer.combine_queries(queries)
        
        # For a single query, should return as-is
        assert combined == queries[0]
        assert "0" in mapping