"""
GraphQLクエリ深度制限のテスト
v0.2.0のGraphQL機能強化の一環として実装
"""

import pytest
import asyncio
from src.api.shopify_graphql import ShopifyGraphQLAPI, ShopifyGraphQLDepthError


class TestGraphQLDepthLimit:
    """GraphQLクエリ深度制限のテストクラス"""
    
    @pytest.fixture
    def api_client(self):
        """テスト用APIクライアントのフィクスチャ"""
        return ShopifyGraphQLAPI(
            shop_url="https://test-shop.myshopify.com",
            access_token="test-token"
        )
    
    def test_calculate_query_depth_simple(self, api_client):
        """シンプルなクエリの深度計算テスト"""
        query = """
        query {
            shop {
                name
            }
        }
        """
        assert api_client.calculate_query_depth(query) == 2
    
    def test_calculate_query_depth_nested(self, api_client):
        """ネストされたクエリの深度計算テスト"""
        query = """
        query {
            products(first: 10) {
                edges {
                    node {
                        variants(first: 5) {
                            edges {
                                node {
                                    price
                                }
                            }
                        }
                    }
                }
            }
        }
        """
        assert api_client.calculate_query_depth(query) == 7
    
    def test_calculate_query_depth_with_fragments(self, api_client):
        """フラグメントを含むクエリの深度計算テスト"""
        query = """
        fragment ProductFields on Product {
            title
            variants {
                edges {
                    node {
                        price
                    }
                }
            }
        }
        
        query {
            products(first: 10) {
                edges {
                    node {
                        ...ProductFields
                    }
                }
            }
        }
        """
        # フラグメント展開後の実質的な深度をチェック
        assert api_client.calculate_query_depth(query) == 6
    
    def test_query_depth_exceeds_limit(self, api_client):
        """深度制限を超えるクエリのテスト"""
        # 深度7のクエリ（制限は6）
        query = """
        query {
            products(first: 10) {
                edges {
                    node {
                        variants(first: 5) {
                            edges {
                                node {
                                    price
                                }
                            }
                        }
                    }
                }
            }
        }
        """
        
        with pytest.raises(ShopifyGraphQLDepthError) as exc_info:
            asyncio.run(api_client.execute_query(query))
        
        error = exc_info.value
        assert error.depth == 7
        assert error.max_depth == 6
        assert "exceeds maximum allowed depth" in str(error)
    
    def test_query_within_depth_limit(self, api_client):
        """深度制限内のクエリのテスト"""
        query = """
        query {
            shop {
                name
                products(first: 10) {
                    edges {
                        node {
                            title
                        }
                    }
                }
            }
        }
        """
        
        # このクエリは深度5なので実行可能
        try:
            # execute_queryは非同期関数なので、実際のテストでは
            # モックを使用するか、テスト環境でのエラーチェックのみ行う
            depth = api_client.calculate_query_depth(query)
            assert depth <= api_client.max_query_depth
        except ShopifyGraphQLDepthError:
            pytest.fail("Query should not exceed depth limit")
    
    def test_depth_with_string_literals(self, api_client):
        """文字列リテラルを含むクエリの深度計算テスト"""
        query = '''
        query {
            product(id: "gid://shopify/Product/{123}") {
                title
                description
            }
        }
        '''
        assert api_client.calculate_query_depth(query) == 2
    
    def test_depth_with_variables(self, api_client):
        """変数を含むクエリの深度計算テスト"""
        query = """
        query GetProduct($id: ID!) {
            product(id: $id) {
                title
                variants {
                    edges {
                        node {
                            price
                        }
                    }
                }
            }
        }
        """
        assert api_client.calculate_query_depth(query) == 5