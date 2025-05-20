"""
Tests for the Shopify GraphQL Fragment Library
"""

import pytest
from src.api.shopify.fragment_library import SharedGraphQLFragments, fragment_library


class TestSharedGraphQLFragments:
    """Tests for the SharedGraphQLFragments class"""
    
    def test_singleton_instance(self):
        """Test that the singleton instance exists"""
        assert fragment_library is not None
        assert isinstance(fragment_library, SharedGraphQLFragments)
    
    def test_standard_fragments_exist(self):
        """Test that standard fragments are registered"""
        # Order fragments
        assert fragment_library.get_fragment("Order", "CoreOrderFields") is not None
        assert fragment_library.get_fragment("Order", "OrderWithLineItems") is not None
        
        # Product fragments
        assert fragment_library.get_fragment("Product", "CoreProductFields") is not None
        assert fragment_library.get_fragment("Product", "ProductWithVariants") is not None
        
        # Customer fragments
        assert fragment_library.get_fragment("Customer", "CoreCustomerFields") is not None
        assert fragment_library.get_fragment("Customer", "CustomerWithOrders") is not None
    
    def test_register_custom_fragment(self):
        """Test registering custom fragments"""
        # Create a new instance for isolated testing
        library = SharedGraphQLFragments()
        
        # Register a custom fragment
        test_fragment = """
        fragment TestFragment on Checkout {
            id
            totalPrice
            lineItems {
                edges {
                    node {
                        id
                        title
                    }
                }
            }
        }
        """
        
        library.register_fragment(
            entity_type="Checkout",
            fragment_name="TestFragment",
            fragment_body=test_fragment,
            version="v1"
        )
        
        # Retrieve the fragment
        retrieved = library.get_fragment("Checkout", "TestFragment")
        assert retrieved is not None
        assert "TestFragment" in retrieved
        assert "lineItems" in retrieved
    
    def test_analyze_query(self):
        """Test query analysis"""
        # Sample query
        query = """
        query GetOrders($first: Int!) {
            orders(first: $first) {
                edges {
                    node {
                        id
                        name
                        lineItems(first: 10) {
                            edges {
                                node {
                                    id
                                    title
                                }
                            }
                        }
                        customer {
                            id
                            email
                        }
                    }
                }
                pageInfo {
                    hasNextPage
                    endCursor
                }
            }
        }
        """
        
        # Analyze query
        analysis = fragment_library.analyze_query(query)
        
        # Check analysis
        assert "Order" in analysis["entity_types"]
        assert analysis["connection_count"] > 0
        assert analysis["pagination_used"] is True
        assert analysis["query_depth"] > 0
        assert analysis["has_fragments"] is False
    
    def test_optimize_query(self):
        """Test query optimization with fragments"""
        # Sample query without fragments
        query = """
        query GetOrder($id: ID!) {
            order(id: $id) {
                id
                name
                createdAt
                totalPrice
                currencyCode
                displayFinancialStatus
                displayFulfillmentStatus
                customerLocale
                email
                phone
            }
        }
        """
        
        # Optimize query
        optimized = fragment_library.optimize_query(query)
        
        # Optimized query should include fragments
        assert "fragment CoreOrderFields" in optimized
    
    def test_build_optimized_query(self):
        """Test building optimized query with fragments"""
        # Build optimized query
        query = fragment_library.build_optimized_query(
            operation_type="query",
            entity_type="Order",
            fragment_name="OrderWithLineItems",
            pagination={"first": 50, "after": None}
        )
        
        # Check query structure
        assert "fragment OrderWithLineItems on Order" in query
        assert "query QueryOrders" in query
        assert "orders(first: $first)" in query
        assert "...OrderWithLineItems" in query
        assert "pageInfo" in query