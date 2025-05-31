"""
Shopify GraphQL Fragment Library
Provides reusable fragments for common entity types
"""

import logging
from typing import Dict, List, Set, Optional, Any
import re
import hashlib
import json
from functools import lru_cache

logger = logging.getLogger(__name__)


class SharedGraphQLFragments:
    """
    A library of reusable GraphQL fragments for common Shopify entities
    - Standardizes fragment structure
    - Provides versioning for fragments
    - Enables efficient fragment reuse
    - Supports dynamic fragment generation
    """
    
    # Default fragment versions
    DEFAULT_VERSION = "v1"
    
    # Entity types
    ENTITY_TYPES = [
        "Order", "Product", "Customer", 
        "Collection", "Variant", "Metafield",
        "Shop", "Checkout", "Cart", "ProductImage"
    ]
    
    def __init__(self):
        """Initialize fragment library"""
        # Fragment storage by entity type and version
        self.fragments: Dict[str, Dict[str, str]] = {}
        
        # Fragment usage statistics
        self.usage_stats: Dict[str, int] = {}
        
        # Initialize standard fragments
        self._initialize_standard_fragments()
    
    def _initialize_standard_fragments(self):
        """Initialize standard fragments for common entities"""
        # Order fragments
        self.register_fragment(
            entity_type="Order",
            fragment_name="CoreOrderFields",
            fragment_body="""
            fragment CoreOrderFields on Order {
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
              processedAt
            }
            """.strip(),
            version=self.DEFAULT_VERSION
        )
        
        self.register_fragment(
            entity_type="Order",
            fragment_name="OrderWithCustomer",
            fragment_body="""
            fragment OrderWithCustomer on Order {
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
              processedAt
              customer {
                id
                displayName
                email
                phone
                defaultAddress {
                  id
                  address1
                  address2
                  city
                  province
                  country
                  zip
                }
              }
            }
            """.strip(),
            version=self.DEFAULT_VERSION
        )
        
        self.register_fragment(
            entity_type="Order",
            fragment_name="OrderWithLineItems",
            fragment_body="""
            fragment OrderWithLineItems on Order {
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
              processedAt
              lineItems(first: 50) {
                edges {
                  node {
                    id
                    title
                    quantity
                    originalUnitPrice
                    discountedUnitPrice
                    variant {
                      id
                      title
                      sku
                      price
                      product {
                        id
                        title
                      }
                    }
                  }
                }
                pageInfo {
                  hasNextPage
                  endCursor
                }
              }
            }
            """.strip(),
            version=self.DEFAULT_VERSION
        )
        
        self.register_fragment(
            entity_type="Order",
            fragment_name="OrderWithFulfillments",
            fragment_body="""
            fragment OrderWithFulfillments on Order {
              id
              name
              createdAt
              totalPrice
              displayFinancialStatus
              displayFulfillmentStatus
              customerLocale
              email
              phone
              processedAt
              fulfillments(first: 5) {
                edges {
                  node {
                    id
                    createdAt
                    status
                    trackingInfo {
                      company
                      number
                      url
                    }
                  }
                }
              }
            }
            """.strip(),
            version=self.DEFAULT_VERSION
        )
        
        # Product fragments
        self.register_fragment(
            entity_type="Product",
            fragment_name="CoreProductFields",
            fragment_body="""
            fragment CoreProductFields on Product {
              id
              title
              handle
              description
              descriptionHtml
              createdAt
              updatedAt
              publishedAt
              vendor
              productType
              tags
              status
            }
            """.strip(),
            version=self.DEFAULT_VERSION
        )
        
        self.register_fragment(
            entity_type="Product",
            fragment_name="ProductWithVariants",
            fragment_body="""
            fragment ProductWithVariants on Product {
              id
              title
              handle
              description
              descriptionHtml
              createdAt
              updatedAt
              publishedAt
              vendor
              productType
              tags
              status
              variants(first: 50) {
                edges {
                  node {
                    id
                    title
                    sku
                    price
                    compareAtPrice
                    availableForSale
                    selectedOptions {
                      name
                      value
                    }
                    inventoryQuantity
                    inventoryPolicy
                  }
                }
                pageInfo {
                  hasNextPage
                  endCursor
                }
              }
            }
            """.strip(),
            version=self.DEFAULT_VERSION
        )
        
        self.register_fragment(
            entity_type="Product",
            fragment_name="ProductWithImages",
            fragment_body="""
            fragment ProductWithImages on Product {
              id
              title
              handle
              description
              createdAt
              updatedAt
              publishedAt
              vendor
              productType
              tags
              status
              images(first: 10) {
                edges {
                  node {
                    id
                    url
                    altText
                    width
                    height
                  }
                }
                pageInfo {
                  hasNextPage
                  endCursor
                }
              }
            }
            """.strip(),
            version=self.DEFAULT_VERSION
        )
        
        # Customer fragments
        self.register_fragment(
            entity_type="Customer",
            fragment_name="CoreCustomerFields",
            fragment_body="""
            fragment CoreCustomerFields on Customer {
              id
              displayName
              firstName
              lastName
              email
              phone
              createdAt
              updatedAt
              acceptsMarketing
              emailMarketingConsent {
                consentUpdatedAt
                marketingOptInLevel
                marketingState
              }
              defaultAddress {
                id
                address1
                address2
                city
                province
                country
                zip
              }
            }
            """.strip(),
            version=self.DEFAULT_VERSION
        )
        
        self.register_fragment(
            entity_type="Customer",
            fragment_name="CustomerWithAddresses",
            fragment_body="""
            fragment CustomerWithAddresses on Customer {
              id
              displayName
              firstName
              lastName
              email
              phone
              createdAt
              updatedAt
              acceptsMarketing
              emailMarketingConsent {
                consentUpdatedAt
                marketingOptInLevel
                marketingState
              }
              defaultAddress {
                id
                address1
                address2
                city
                province
                country
                zip
              }
              addresses(first: 10) {
                edges {
                  node {
                    id
                    address1
                    address2
                    city
                    province
                    country
                    zip
                    phone
                    firstName
                    lastName
                  }
                }
              }
            }
            """.strip(),
            version=self.DEFAULT_VERSION
        )
        
        self.register_fragment(
            entity_type="Customer",
            fragment_name="CustomerWithOrders",
            fragment_body="""
            fragment CustomerWithOrders on Customer {
              id
              displayName
              firstName
              lastName
              email
              phone
              createdAt
              updatedAt
              acceptsMarketing
              emailMarketingConsent {
                consentUpdatedAt
                marketingOptInLevel
                marketingState
              }
              defaultAddress {
                id
                address1
                address2
                city
                province
                country
                zip
              }
              orders(first: 10) {
                edges {
                  node {
                    id
                    name
                    totalPrice
                    currencyCode
                    createdAt
                    displayFinancialStatus
                    displayFulfillmentStatus
                  }
                }
                pageInfo {
                  hasNextPage
                  endCursor
                }
              }
            }
            """.strip(),
            version=self.DEFAULT_VERSION
        )
    
    def register_fragment(self, 
                          entity_type: str,
                          fragment_name: str,
                          fragment_body: str,
                          version: str = DEFAULT_VERSION):
        """
        Register a fragment in the library
        
        Args:
            entity_type: Entity type (Order, Product, etc.)
            fragment_name: Name of the fragment
            fragment_body: Full fragment definition
            version: Fragment version (default: v1)
        """
        if entity_type not in self.ENTITY_TYPES:
            logger.warning(f"Unknown entity type: {entity_type}, creating anyway")
        
        # Initialize entity dict if needed
        if entity_type not in self.fragments:
            self.fragments[entity_type] = {}
            
        # Create version dict if needed
        version_key = f"{entity_type}_{version}"
        if version_key not in self.fragments[entity_type]:
            self.fragments[entity_type][version_key] = {}
            
        # Register fragment
        full_key = f"{entity_type}_{fragment_name}_{version}"
        self.fragments[entity_type][version_key] = fragment_body
        
        logger.debug(f"Registered fragment: {full_key}")
    
    def get_fragment(self, 
                    entity_type: str,
                    fragment_name: str,
                    version: Optional[str] = None) -> Optional[str]:
        """
        Get a fragment by name and entity type
        
        Args:
            entity_type: Entity type
            fragment_name: Fragment name
            version: Fragment version (default: latest)
            
        Returns:
            Fragment definition or None if not found
        """
        if entity_type not in self.fragments:
            return None
            
        # Use specified version or default
        version = version or self.DEFAULT_VERSION
        version_key = f"{entity_type}_{version}"
        
        if version_key not in self.fragments[entity_type]:
            return None
            
        # Update usage stats
        full_key = f"{entity_type}_{fragment_name}_{version}"
        self.usage_stats[full_key] = self.usage_stats.get(full_key, 0) + 1
        
        return self.fragments[entity_type][version_key]
    
    def get_all_fragments_for_entity(self, 
                                   entity_type: str, 
                                   version: Optional[str] = None) -> List[str]:
        """
        Get all fragments for an entity type
        
        Args:
            entity_type: Entity type
            version: Fragment version (default: latest)
            
        Returns:
            List of fragment definitions
        """
        if entity_type not in self.fragments:
            return []
            
        # Use specified version or default
        version = version or self.DEFAULT_VERSION
        version_key = f"{entity_type}_{version}"
        
        if version_key not in self.fragments[entity_type]:
            return []
            
        return [self.fragments[entity_type][version_key]]
    
    @lru_cache(maxsize=128)
    def analyze_query(self, query: str) -> Dict[str, Any]:
        """
        Analyze a GraphQL query to identify entity types, fields, and patterns
        
        Args:
            query: GraphQL query
            
        Returns:
            Analysis results
        """
        # Basic analysis
        analysis = {
            'entity_types': set(),
            'field_count': 0,
            'connection_count': 0,
            'query_depth': 0,
            'pagination_used': False,
            'has_fragments': False
        }
        
        # Check for fragments
        analysis['has_fragments'] = 'fragment ' in query.lower()
        
        # Identify entity types
        for entity_type in self.ENTITY_TYPES:
            if f"on {entity_type} " in query or f"on {entity_type}{" in query:
                analysis['entity_types'].add(entity_type)
                
        # Count fields and measure depth
        lines = query.strip().split('\n')
        max_depth = 0
        current_depth = 0
        
        for line in lines:
            stripped = line.strip()
            
            # Skip empty lines and fragment/query declarations
            if not stripped or 'fragment ' in stripped or 'query ' in stripped:
                continue
                
            # Count opening and closing braces to track depth
            current_depth += stripped.count('{')
            current_depth -= stripped.count('}')
            max_depth = max(max_depth, current_depth)
            
            # Count fields (non-brace, non-empty lines with potential field names)
            if '{' not in stripped and '}' not in stripped and stripped:
                analysis['field_count'] += 1
                
            # Check for connections
            if 'edges' in stripped or 'nodes' in stripped:
                analysis['connection_count'] += 1
                
            # Check for pagination
            if 'first:' in stripped or 'last:' in stripped:
                analysis['pagination_used'] = True
        
        analysis['query_depth'] = max_depth
        return analysis
    
    def optimize_query(self, query: str) -> str:
        """
        Optimize a GraphQL query by applying appropriate fragments
        
        Args:
            query: Original GraphQL query
            
        Returns:
            Optimized query with fragments
        """
        # Analyze query
        analysis = self.analyze_query(query)
        
        # Already has fragments, return as-is
        if analysis['has_fragments']:
            return query
            
        # Identify entity types and substitute with fragments
        optimized_query = query
        
        for entity_type in analysis['entity_types']:
            # Get appropriate fragment based on analysis
            fragment = self._select_fragment_for_query(entity_type, analysis)
            
            if fragment:
                # Extract fragment body
                fragment_body = self._extract_fragment_body(fragment)
                
                # Insert fragment at the beginning of the query
                optimized_query = f"{fragment}\n\n{optimized_query}"
                
                # Replace field lists with fragment spreads
                optimized_query = self._replace_field_lists_with_fragment(
                    optimized_query, entity_type, fragment
                )
        
        return optimized_query
    
    def _select_fragment_for_query(self, entity_type: str, analysis: Dict[str, Any]) -> Optional[str]:
        """Select an appropriate fragment for a query based on analysis"""
        # Default to core fields fragment
        core_fragment_name = f"Core{entity_type}Fields"
        core_fragment = self.get_fragment(entity_type, core_fragment_name)
        
        # For orders with connections, use OrderWithLineItems
        if entity_type == "Order" and analysis['connection_count'] > 0:
            return self.get_fragment(entity_type, "OrderWithLineItems")
            
        # For products with images
        if entity_type == "Product" and analysis['connection_count'] > 0:
            for img_indicator in ["image", "Image", "images", "Images"]:
                if img_indicator in analysis:
                    return self.get_fragment(entity_type, "ProductWithImages")
            
            # Default to variants
            return self.get_fragment(entity_type, "ProductWithVariants")
            
        # Default to core fields
        return core_fragment
    
    def _extract_fragment_body(self, fragment: str) -> str:
        """Extract fragment body for insertion"""
        return fragment.strip()
    
    def _replace_field_lists_with_fragment(self, query: str, entity_type: str, fragment: str) -> str:
        """Replace field lists with fragment spreads"""
        # Extract fragment name
        fragment_name_match = re.search(r'fragment\s+(\w+)\s+on', fragment)
        if not fragment_name_match:
            return query
            
        fragment_name = fragment_name_match.group(1)
        
        # Replace field lists with fragment spread
        # This is a simplified implementation that would need to be more
        # sophisticated in a real-world application
        pattern = rf'on\s+{entity_type}\s+{{\s+([^}}]+)\s+}}'
        replacement = f'on {entity_type} {{\n    ...{fragment_name}\n  }}'
        
        return re.sub(pattern, replacement, query)
    
    def build_optimized_query(self, 
                             operation_type: str,
                             entity_type: str,
                             variables: Optional[Dict[str, Any]] = None,
                             fragment_name: Optional[str] = None,
                             pagination: Optional[Dict[str, Any]] = None) -> str:
        """
        Build an optimized query with appropriate fragments
        
        Args:
            operation_type: Query or mutation
            entity_type: Entity type
            variables: Query variables
            fragment_name: Fragment name to use
            pagination: Pagination parameters
            
        Returns:
            Optimized GraphQL query
        """
        # Determine fragment to use
        fragment = None
        
        if fragment_name:
            fragment = self.get_fragment(entity_type, fragment_name)
        else:
            # Use appropriate fragment based on entity type
            if entity_type == "Order":
                fragment = self.get_fragment(entity_type, "OrderWithLineItems")
            elif entity_type == "Product":
                fragment = self.get_fragment(entity_type, "ProductWithVariants")
            elif entity_type == "Customer":
                fragment = self.get_fragment(entity_type, "CoreCustomerFields")
            else:
                # Try to get a core fragment
                fragment = self.get_fragment(entity_type, f"Core{entity_type}Fields")
        
        if not fragment:
            logger.warning(f"No fragment found for {entity_type}")
            return ""
            
        # Extract fragment name
        fragment_name_match = re.search(r'fragment\s+(\w+)\s+on', fragment)
        if not fragment_name_match:
            return ""
            
        fragment_name = fragment_name_match.group(1)
        
        # Build query
        query = f"{fragment}\n\n"
        
        # Add operation
        operation_name = f"{operation_type.capitalize()}{entity_type}s"
        
        # Build variable declarations
        var_declarations = []
        
        if variables:
            for var_name, var_type in variables.items():
                var_declarations.append(f"${var_name}: {var_type}")
                
        if pagination:
            if "first" in pagination:
                var_declarations.append("$first: Int!")
            if "after" in pagination:
                var_declarations.append("$after: String")
                
        var_declaration_str = ", ".join(var_declarations)
        
        query += f"query {operation_name}({var_declaration_str}) {{\n"
        
        # Entity name (pluralized)
        entity_name = f"{entity_type.lower()}s"
        
        # Add query parameters
        query_params = []
        
        if pagination:
            if "first" in pagination:
                query_params.append("first: $first")
            if "after" in pagination:
                query_params.append("after: $after")
                
        query_param_str = ", ".join(query_params)
        
        # Add query body
        query += f"  {entity_name}({query_param_str}) {{\n"
        query += "    edges {\n"
        query += "      node {\n"
        query += f"        ...{fragment_name}\n"
        query += "      }\n"
        query += "    }\n"
        query += "    pageInfo {\n"
        query += "      hasNextPage\n"
        query += "      endCursor\n"
        query += "    }\n"
        query += "  }\n"
        query += "}"
        
        return query


# Singleton instance
fragment_library = SharedGraphQLFragments()