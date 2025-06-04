# MCP プロバイダー実装ガイド - Phase 3 Complete Edition

🎯 **Production-Ready** なMCPプロバイダーの実装方法を詳しく解説します。Phase 3では統一ページネーション、OAuth永続化、標準データモデル変換、統一エラーハンドリングに完全対応したプロバイダーの実装が可能です。

## 📋 目次

1. [Phase 3 プロバイダー要件](#phase-3-プロバイダー要件)
2. [基底クラスの理解](#基底クラスの理解)
3. [Phase 3 実装パターン](#phase-3-実装パターン)
4. [統一ページネーション実装](#統一ページネーション実装)
5. [OAuth永続化対応](#oauth永続化対応)
6. [標準データモデル変換](#標準データモデル変換)
7. [統一エラーハンドリング](#統一エラーハンドリング)
8. [実装例: CustomAPIProvider](#実装例-customapiprovider)
9. [テストとデバッグ](#テストとデバッグ)
10. [デプロイとモニタリング](#デプロイとモニタリング)
11. [ベストプラクティス](#ベストプラクティス)

## Phase 3 プロバイダー要件

### 🌟 必須機能

Phase 3完全対応プロバイダーは以下の機能を実装する必要があります：

```python
# Phase 3 プロバイダー機能チェックリスト
PHASE_3_REQUIREMENTS = {
    'unified_pagination': True,       # 統一ページネーション対応
    'oauth_persistence': True,        # OAuth永続化サポート  
    'standard_conversion': True,      # 標準データモデル変換
    'unified_error_handling': True,   # 統一エラーハンドリング
    'comprehensive_monitoring': True, # 包括的監視機能
    'performance_optimization': True, # パフォーマンス最適化
    'security_compliance': True,      # セキュリティ準拠
    'production_ready': True          # 本番運用対応
}
```

### 📊 品質基準

- **テストカバレッジ**: 95%以上
- **エラーハンドリング**: 17種類のエラータイプ完全対応
- **パフォーマンス**: レスポンス時間 < 1000ms (95%ile)
- **信頼性**: 99.5%以上の成功率
- **監視**: リアルタイム メトリクス とアラート

## 基底クラスの理解

### 🏗️ MCPProvider基底クラス

Phase 3では大幅に強化された基底クラスを使用します：

```python
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List, AsyncGenerator
from services.common_data_models import *
from services.persistence import OAuthPersistenceManager
import asyncio
import aiohttp
import logging

logger = logging.getLogger(__name__)

class MCPProvider(ABC):
    """
    Phase 3 MCP プロバイダー基底クラス
    
    新機能:
    - 統一ページネーション
    - OAuth永続化
    - 標準データモデル変換
    - 統一エラーハンドリング
    """
    
    def __init__(self, name: str, config: Dict[str, Any]):
        self.name = name
        self.config = config
        self.session = None
        
        # Phase 3 新機能
        self.oauth_manager = config.get('oauth_manager')
        self.enable_pagination = config.get('enable_unified_pagination', True)
        self.enable_conversion = config.get('enable_standard_conversion', True)
        self.enable_monitoring = config.get('enable_comprehensive_monitoring', True)
        
        # エラーハンドリング
        self.error_metrics = {
            'total_errors': 0,
            'error_types': {},
            'last_error_time': None,
            'error_rate_window': []
        }
        
        # パフォーマンス メトリクス
        self.performance_metrics = {
            'total_requests': 0,
            'successful_requests': 0,
            'avg_response_time': 0,
            'response_times': []
        }
        
        # レート制限管理
        self.rate_limiter = None
        self.rate_limit_status = {}
    
    async def initialize(self):
        """プロバイダー初期化"""
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=self.config.get('timeout', 30))
        )
        
        # OAuth永続化初期化
        if self.oauth_manager and self.supports_oauth():
            await self._initialize_oauth()
        
        # レート制限初期化
        if self.config.get('rate_limit_enabled', True):
            await self._initialize_rate_limiting()
        
        await self._initialize_provider()
        
        logger.info(f"✅ {self.name} プロバイダー初期化完了 (Phase 3)")
    
    async def shutdown(self):
        """プロバイダー終了処理"""
        if self.session:
            await self.session.close()
        
        # OAuth情報の保存
        if self.oauth_manager and self.supports_oauth():
            await self._save_oauth_state()
        
        await self._cleanup_provider()
    
    # 抽象メソッド（必須実装）
    @abstractmethod
    async def _initialize_provider(self):
        """プロバイダー固有の初期化処理"""
        pass
    
    @abstractmethod
    async def execute_request(self, request: MCPRequest) -> MCPResponse:
        """リクエスト実行（Phase 3対応）"""
        pass
    
    @abstractmethod
    def get_supported_methods(self) -> List[str]:
        """サポートするメソッド一覧"""
        pass
    
    # Phase 3 新規メソッド
    def supports_pagination(self) -> bool:
        """ページネーション対応の確認"""
        return True
    
    def supports_oauth(self) -> bool:
        """OAuth対応の確認"""
        return False
    
    def supports_standard_conversion(self) -> bool:
        """標準データモデル変換対応の確認"""
        return True
    
    def get_pagination_config(self) -> Dict[str, Any]:
        """ページネーション設定"""
        return {
            'default_page_size': 100,
            'max_page_size': 1000,
            'supports_cursor': False,
            'supports_offset': True
        }
    
    def get_oauth_config(self) -> Dict[str, Any]:
        """OAuth設定"""
        return {
            'token_url': None,
            'refresh_url': None,
            'scopes': [],
            'token_expires': True
        }
    
    def get_standard_models(self) -> List[str]:
        """対応する標準データモデル"""
        return ['Product', 'Order', 'Customer', 'Campaign', 'Analytics']
```

## Phase 3 実装パターン

### 🚀 完全対応プロバイダーテンプレート

```python
class ExampleMCPProvider(MCPProvider):
    """Phase 3完全対応プロバイダーのテンプレート"""
    
    async def _initialize_provider(self):
        """プロバイダー固有初期化"""
        self.api_key = self.config.get('api_key')
        self.base_url = self.config.get('base_url', 'https://api.example.com')
        
        # API固有の設定
        self.api_version = self.config.get('api_version', 'v1')
        self.timeout = self.config.get('timeout', 30)
        
        logger.info(f"✅ Example API プロバイダー初期化完了")
    
    def get_supported_methods(self) -> List[str]:
        """Phase 3対応メソッド一覧"""
        return [
            'example.products.list',      # ページネーション対応
            'example.products.get',       # 個別取得
            'example.orders.list',        # ページネーション + 標準変換
            'example.analytics.report',   # Analytics型変換
            'example.auth.refresh'        # OAuth管理
        ]
    
    def supports_oauth(self) -> bool:
        """OAuth対応"""
        return True
    
    def get_oauth_config(self) -> Dict[str, Any]:
        """OAuth設定"""
        return {
            'token_url': f'{self.base_url}/oauth/token',
            'refresh_url': f'{self.base_url}/oauth/refresh',
            'scopes': ['read', 'write'],
            'token_expires': True,
            'refresh_threshold_minutes': 30
        }
    
    def get_pagination_config(self) -> Dict[str, Any]:
        """ページネーション設定"""
        return {
            'default_page_size': 100,
            'max_page_size': 500,
            'supports_cursor': True,
            'supports_offset': True,
            'cursor_param': 'next_cursor',
            'limit_param': 'limit'
        }
    
    async def execute_request(self, request: MCPRequest) -> MCPResponse:
        """Phase 3対応リクエスト実行"""
        method = request.method
        params = request.params
        
        try:
            # OAuth自動リフレッシュ
            if self.supports_oauth() and params.get('oauth_refresh', True):
                await self._ensure_valid_oauth()
            
            # レート制限チェック
            if not await self._check_rate_limit(method):
                return self._create_rate_limit_error_response(request.id)
            
            # メソッド実行
            result = await self._execute_method(method, params)
            
            # 標準データモデル変換
            if params.get('convert_response', False):
                result = await self._convert_to_standard_models(method, result)
            
            # ページネーション処理
            if params.get('get_all_pages', False) and self.supports_pagination():
                result = await self._handle_pagination(method, params, result)
            
            # 成功メトリクス記録
            self._record_success_metrics()
            
            return MCPResponse(id=request.id, result=result)
            
        except Exception as e:
            # 統一エラーハンドリング
            error_info = self._extract_error_info(e, method, params)
            self._record_error_metrics(error_info)
            
            return MCPResponse(id=request.id, error=error_info)
    
    async def _execute_method(self, method: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """メソッド実行の実装"""
        if method == 'example.products.list':
            return await self._list_products(params)
        elif method == 'example.products.get':
            return await self._get_product(params)
        elif method == 'example.orders.list':
            return await self._list_orders(params)
        elif method == 'example.analytics.report':
            return await self._get_analytics(params)
        else:
            raise ValueError(f"Unsupported method: {method}")
```

## 統一ページネーション実装

### 🔄 ページネーション対応実装

```python
async def _handle_pagination(
    self, 
    method: str, 
    params: Dict[str, Any], 
    initial_result: Dict[str, Any]
) -> Dict[str, Any]:
    """統一ページネーション処理"""
    
    if not self.supports_pagination():
        return initial_result
    
    # ページネーション設定
    config = self.get_pagination_config()
    max_pages = params.get('max_pages', 10)
    page_delay = params.get('page_delay', 0.5)
    
    all_items = []
    current_result = initial_result
    page_count = 1
    
    # 最初のページのデータを追加
    items_key = self._get_items_key(method)
    if items_key in current_result:
        all_items.extend(current_result[items_key])
    
    # 追加ページの取得
    while page_count < max_pages:
        next_page_params = self._get_next_page_params(current_result, params, config)
        
        if not next_page_params:
            break  # これ以上ページがない
        
        # レート制限を考慮した待機
        if page_delay > 0:
            await asyncio.sleep(page_delay)
        
        try:
            # 次のページを取得
            next_result = await self._execute_method(method, next_page_params)
            
            if items_key in next_result and next_result[items_key]:
                all_items.extend(next_result[items_key])
                current_result = next_result
                page_count += 1
            else:
                break  # データがない
                
        except Exception as e:
            logger.warning(f"ページネーション中にエラー (ページ {page_count + 1}): {e}")
            break
    
    # 統合結果の作成
    result = current_result.copy()
    result[items_key] = all_items
    result['pagination_info'] = {
        'total_pages': page_count,
        'total_items': len(all_items),
        'page_size': params.get('limit', config['default_page_size']),
        'completed': page_count < max_pages
    }
    
    logger.info(f"📄 ページネーション完了: {page_count}ページ, {len(all_items)}アイテム")
    return result

def _get_items_key(self, method: str) -> str:
    """メソッドに応じたアイテムキーの取得"""
    method_to_key = {
        'example.products.list': 'products',
        'example.orders.list': 'orders',
        'example.customers.list': 'customers',
        'example.campaigns.list': 'campaigns'
    }
    return method_to_key.get(method, 'items')

def _get_next_page_params(
    self, 
    current_result: Dict[str, Any], 
    original_params: Dict[str, Any],
    config: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """次のページのパラメータ生成"""
    
    next_params = original_params.copy()
    
    # カーソルベースページネーション
    if config.get('supports_cursor') and 'next_cursor' in current_result:
        next_cursor = current_result['next_cursor']
        if next_cursor:
            next_params[config['cursor_param']] = next_cursor
            return next_params
    
    # オフセットベースページネーション
    if config.get('supports_offset'):
        current_offset = original_params.get('offset', 0)
        page_size = original_params.get('limit', config['default_page_size'])
        
        next_params['offset'] = current_offset + page_size
        return next_params
    
    return None
```

## OAuth永続化対応

### 🔐 OAuth自動管理実装

```python
async def _initialize_oauth(self):
    """OAuth永続化の初期化"""
    if not self.oauth_manager:
        return
    
    # 保存されたトークンの読み込み
    try:
        token_data = await self.oauth_manager.load_token(self.name)
        if token_data:
            self.access_token = token_data.get('access_token')
            self.refresh_token = token_data.get('refresh_token')
            self.token_expires_at = token_data.get('expires_at')
            
            logger.info(f"🔐 {self.name}: 保存されたOAuthトークンを読み込み")
    except Exception as e:
        logger.warning(f"OAuthトークン読み込み失敗: {e}")

async def _ensure_valid_oauth(self):
    """有効なOAuthトークンの確保"""
    if not self.supports_oauth() or not self.oauth_manager:
        return
    
    # トークンの有効性チェック
    if self._is_token_expired():
        logger.info(f"🔄 {self.name}: OAuthトークンの自動リフレッシュを実行")
        await self._refresh_oauth_token()

def _is_token_expired(self) -> bool:
    """トークン期限の確認"""
    if not hasattr(self, 'token_expires_at') or not self.token_expires_at:
        return False
    
    from datetime import datetime, timezone
    
    current_time = datetime.now(timezone.utc)
    expires_at = datetime.fromisoformat(self.token_expires_at)
    
    # 設定された閾値前にリフレッシュ
    config = self.get_oauth_config()
    threshold_minutes = config.get('refresh_threshold_minutes', 30)
    threshold_delta = timedelta(minutes=threshold_minutes)
    
    return (expires_at - current_time) <= threshold_delta

async def _refresh_oauth_token(self):
    """OAuthトークンのリフレッシュ"""
    if not self.refresh_token:
        raise Exception("リフレッシュトークンが利用できません")
    
    config = self.get_oauth_config()
    refresh_url = config['refresh_url']
    
    data = {
        'grant_type': 'refresh_token',
        'refresh_token': self.refresh_token,
        'client_id': self.config.get('client_id'),
        'client_secret': self.config.get('client_secret')
    }
    
    async with self.session.post(refresh_url, data=data) as response:
        if response.status == 200:
            token_data = await response.json()
            
            # 新しいトークン情報の更新
            self.access_token = token_data['access_token']
            if 'refresh_token' in token_data:
                self.refresh_token = token_data['refresh_token']
            
            # 有効期限の計算
            expires_in = token_data.get('expires_in', 3600)
            expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
            self.token_expires_at = expires_at.isoformat()
            
            # 永続化保存
            await self._save_oauth_state()
            
            logger.info(f"✅ {self.name}: OAuthトークンリフレッシュ成功")
        else:
            error_detail = await response.text()
            raise Exception(f"OAuthトークンリフレッシュ失敗: {response.status} - {error_detail}")

async def _save_oauth_state(self):
    """OAuth状態の保存"""
    if not self.oauth_manager:
        return
    
    token_data = {
        'access_token': getattr(self, 'access_token', None),
        'refresh_token': getattr(self, 'refresh_token', None),
        'expires_at': getattr(self, 'token_expires_at', None),
        'scope': self.get_oauth_config().get('scopes', []),
        'updated_at': datetime.now(timezone.utc).isoformat()
    }
    
    try:
        await self.oauth_manager.save_token(self.name, token_data)
        logger.debug(f"💾 {self.name}: OAuth状態を保存")
    except Exception as e:
        logger.error(f"OAuth状態保存失敗: {e}")
```

## 標準データモデル変換

### 📊 データモデル変換実装

```python
async def _convert_to_standard_models(
    self, 
    method: str, 
    raw_result: Dict[str, Any]
) -> Dict[str, Any]:
    """標準データモデルへの変換"""
    
    if not self.supports_standard_conversion():
        return raw_result
    
    converter_map = {
        'example.products.list': self._convert_products,
        'example.products.get': self._convert_product,
        'example.orders.list': self._convert_orders,
        'example.campaigns.list': self._convert_campaigns,
        'example.analytics.report': self._convert_analytics
    }
    
    converter = converter_map.get(method)
    if not converter:
        return raw_result
    
    try:
        converted_result = await converter(raw_result)
        logger.debug(f"🔄 {method}: 標準データモデルに変換完了")
        return converted_result
    except Exception as e:
        logger.warning(f"データモデル変換エラー: {e}")
        return raw_result

async def _convert_products(self, raw_result: Dict[str, Any]) -> Dict[str, Any]:
    """Product型への変換"""
    from services.common_data_models import Product, ProductStatus, Money, ProductVariant
    
    raw_products = raw_result.get('products', [])
    converted_products = []
    
    for raw_product in raw_products:
        try:
            # 標準Product型に変換
            product = Product(
                id=str(raw_product.get('id', '')),
                title=raw_product.get('name', ''),
                description=raw_product.get('description', ''),
                price=Money(
                    amount=float(raw_product.get('price', 0)),
                    currency=raw_product.get('currency', 'USD')
                ),
                status=self._convert_product_status(raw_product.get('status')),
                provider=self.name,
                variants=[
                    ProductVariant(
                        id=str(var.get('id', '')),
                        title=var.get('name', ''),
                        price=Money(
                            amount=float(var.get('price', 0)),
                            currency=var.get('currency', 'USD')
                        ),
                        inventory_quantity=var.get('inventory', 0)
                    ) for var in raw_product.get('variants', [])
                ],
                tags=raw_product.get('tags', []),
                created_at=normalize_datetime(raw_product.get('created_at')),
                updated_at=normalize_datetime(raw_product.get('updated_at'))
            )
            
            converted_products.append(product)
            
        except Exception as e:
            logger.warning(f"商品変換エラー (ID: {raw_product.get('id')}): {e}")
            continue
    
    result = raw_result.copy()
    result['products'] = converted_products
    return result

def _convert_product_status(self, raw_status: str) -> ProductStatus:
    """商品ステータスの変換"""
    status_map = {
        'active': ProductStatus.ACTIVE,
        'inactive': ProductStatus.INACTIVE,
        'draft': ProductStatus.DRAFT,
        'archived': ProductStatus.ARCHIVED
    }
    return status_map.get(raw_status.lower() if raw_status else '', ProductStatus.ACTIVE)

async def _convert_orders(self, raw_result: Dict[str, Any]) -> Dict[str, Any]:
    """Order型への変換"""
    from services.common_data_models import Order, OrderStatus, PaymentStatus, OrderLineItem, Address
    
    raw_orders = raw_result.get('orders', [])
    converted_orders = []
    
    for raw_order in raw_orders:
        try:
            order = Order(
                id=str(raw_order.get('id', '')),
                order_number=raw_order.get('order_number', ''),
                customer_id=str(raw_order.get('customer_id', '')),
                total_amount=Money(
                    amount=float(raw_order.get('total', 0)),
                    currency=raw_order.get('currency', 'USD')
                ),
                tax_amount=Money(
                    amount=float(raw_order.get('tax', 0)),
                    currency=raw_order.get('currency', 'USD')
                ),
                status=self._convert_order_status(raw_order.get('status')),
                payment_status=self._convert_payment_status(raw_order.get('payment_status')),
                line_items=[
                    OrderLineItem(
                        product_id=str(item.get('product_id', '')),
                        variant_id=str(item.get('variant_id', '')),
                        quantity=item.get('quantity', 1),
                        price=Money(
                            amount=float(item.get('price', 0)),
                            currency=item.get('currency', 'USD')
                        )
                    ) for item in raw_order.get('items', [])
                ],
                shipping_address=self._convert_address(raw_order.get('shipping_address')),
                billing_address=self._convert_address(raw_order.get('billing_address')),
                provider=self.name,
                created_at=normalize_datetime(raw_order.get('created_at')),
                updated_at=normalize_datetime(raw_order.get('updated_at'))
            )
            
            converted_orders.append(order)
            
        except Exception as e:
            logger.warning(f"注文変換エラー (ID: {raw_order.get('id')}): {e}")
            continue
    
    result = raw_result.copy()
    result['orders'] = converted_orders
    return result

def _convert_address(self, raw_address: Optional[Dict]) -> Optional[Address]:
    """住所の変換"""
    if not raw_address:
        return None
    
    return Address(
        first_name=raw_address.get('first_name', ''),
        last_name=raw_address.get('last_name', ''),
        company=raw_address.get('company', ''),
        address1=raw_address.get('address1', ''),
        address2=raw_address.get('address2', ''),
        city=raw_address.get('city', ''),
        province=raw_address.get('province', ''),
        country=raw_address.get('country', ''),
        zip=raw_address.get('zip', ''),
        phone=raw_address.get('phone', '')
    )
```

## 統一エラーハンドリング

### 🛡️ Phase 3 エラーハンドリング実装

```python
def _extract_error_info(
    self, 
    exception: Exception, 
    method: str, 
    params: Dict[str, Any]
) -> Dict[str, Any]:
    """統一エラー情報の抽出"""
    
    # HTTPレスポンスエラーの場合
    if hasattr(exception, 'status') and hasattr(exception, 'response'):
        status_code = exception.status
        response_text = getattr(exception, 'response_text', str(exception))
    else:
        # その他の例外
        status_code = 500
        response_text = str(exception)
    
    # エラータイプの分類
    error_type = self._classify_error_type(status_code)
    error_category = self._get_error_category(status_code)
    retryable = self._is_retryable_error(status_code)
    
    # プロバイダー固有情報の抽出
    provider_specific = self._extract_provider_specific_error(exception, status_code)
    
    # 解決提案の生成
    resolution_suggestions = self._generate_resolution_suggestions(
        error_type, error_category, status_code
    )
    
    # 統一エラー形式
    error_info = {
        'status_code': status_code,
        'error_code': getattr(exception, 'error_code', f'{self.name.upper()}_ERROR'),
        'error_message': response_text,
        'error_type': error_type,
        'error_category': error_category,
        'retryable': retryable,
        'retry_after': self._extract_retry_after(exception),
        'provider': self.name,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'request_id': f"{self.name}_{int(time.time() * 1000)}",
        'request_method': method,
        'request_url': getattr(exception, 'url', 'unknown'),
        'request_operation': method,
        'provider_specific_info': provider_specific,
        'resolution_suggestions': resolution_suggestions
    }
    
    return error_info

def _classify_error_type(self, status_code: int) -> str:
    """Phase 3 エラータイプ分類 (17種類)"""
    error_types = {
        400: 'bad_request',
        401: 'unauthorized', 
        403: 'forbidden',
        404: 'not_found',
        405: 'method_not_allowed',
        409: 'conflict',
        422: 'unprocessable_entity',
        429: 'rate_limited',
        500: 'internal_server_error',
        502: 'bad_gateway',
        503: 'service_unavailable',
        504: 'gateway_timeout'
    }
    
    if status_code in error_types:
        return error_types[status_code]
    elif 400 <= status_code < 500:
        return 'client_error'
    elif 500 <= status_code < 600:
        return 'server_error'
    else:
        return 'unknown'

def _get_error_category(self, status_code: int) -> str:
    """Phase 3 エラーカテゴリ分類 (7種類)"""
    if status_code in [401, 403]:
        return 'authentication'
    elif status_code == 429:
        return 'rate_limiting'
    elif status_code == 404:
        return 'not_found'
    elif status_code in [400, 422]:
        return 'validation'
    elif 500 <= status_code < 600:
        return 'server_error'
    elif status_code >= 600:
        return 'network'
    else:
        return 'general'

def _is_retryable_error(self, status_code: int) -> bool:
    """リトライ可能性判定"""
    retryable_codes = [429, 500, 502, 503, 504]
    return status_code in retryable_codes

def _extract_provider_specific_error(
    self, 
    exception: Exception, 
    status_code: int
) -> Dict[str, Any]:
    """プロバイダー固有エラー情報の抽出"""
    
    # 基本情報
    specific_info = {
        'provider_name': self.name,
        'provider_type': self.__class__.__name__
    }
    
    # HTTPレスポンスヘッダー情報
    if hasattr(exception, 'headers'):
        headers = exception.headers
        
        # レート制限情報
        if 'X-RateLimit-Limit' in headers:
            specific_info['rate_limit'] = {
                'limit': headers.get('X-RateLimit-Limit'),
                'remaining': headers.get('X-RateLimit-Remaining'),
                'reset': headers.get('X-RateLimit-Reset')
            }
        
        # リクエストID
        if 'X-Request-ID' in headers:
            specific_info['provider_request_id'] = headers['X-Request-ID']
    
    # Example API固有のエラー処理
    if hasattr(exception, 'error_details'):
        specific_info['api_error_details'] = exception.error_details
    
    return specific_info

def _generate_resolution_suggestions(
    self, 
    error_type: str, 
    error_category: str, 
    status_code: int
) -> List[str]:
    """解決提案の自動生成"""
    
    suggestions = []
    
    if error_category == 'authentication':
        suggestions.extend([
            'APIキーまたはアクセストークンを確認してください',
            'OAuth認証の有効期限を確認してください',
            '必要な権限（スコープ）が付与されているか確認してください'
        ])
    
    elif error_category == 'rate_limiting':
        suggestions.extend([
            'APIリクエスト頻度を調整してください',
            'バックオフ戦略を実装してください',
            'バッチ処理の使用を検討してください',
            'キャッシュ機能の活用を推奨します'
        ])
    
    elif error_category == 'validation':
        suggestions.extend([
            'リクエストパラメータの形式を確認してください',
            '必須パラメータが不足していないか確認してください',
            'データ型と値の範囲を確認してください'
        ])
    
    elif error_category == 'server_error':
        suggestions.extend([
            'しばらく待ってから再試行してください',
            'システム管理者に連絡してください',
            'エラーログを保存して報告してください'
        ])
    
    elif error_category == 'network':
        suggestions.extend([
            'ネットワーク接続を確認してください',
            'タイムアウト設定を調整してください',
            'プロキシ設定を確認してください'
        ])
    
    # プロバイダー固有の提案
    suggestions.extend(self._get_provider_specific_suggestions(error_type))
    
    return suggestions

def _get_provider_specific_suggestions(self, error_type: str) -> List[str]:
    """プロバイダー固有の解決提案"""
    # Example API固有の提案
    provider_suggestions = {
        'rate_limited': [
            f'{self.name} APIの利用制限ドキュメントを参照してください',
            f'{self.name}のレート制限を確認し、適切な間隔でリクエストしてください'
        ],
        'unauthorized': [
            f'{self.name} ダッシュボードでAPIキーを再生成してください',
            f'{self.name} アカウントの権限設定を確認してください'
        ]
    }
    
    return provider_suggestions.get(error_type, [])
```

## 実装例: CustomAPIProvider

### 🔧 完全実装例

```python
class CustomAPIMCPProvider(MCPProvider):
    """
    Phase 3完全対応のカスタムAPIプロバイダー実装例
    
    機能:
    - 統一ページネーション
    - OAuth永続化
    - 標準データモデル変換
    - 統一エラーハンドリング
    - 包括的監視
    """
    
    async def _initialize_provider(self):
        """プロバイダー初期化"""
        
        # API設定
        self.api_key = self.config.get('api_key')
        self.base_url = self.config.get('base_url', 'https://api.custom.com')
        self.api_version = self.config.get('api_version', 'v2')
        
        # OAuth設定
        if self.supports_oauth():
            self.client_id = self.config.get('client_id')
            self.client_secret = self.config.get('client_secret')
        
        # カスタムヘッダー
        self.default_headers = {
            'User-Agent': f'MCP-Integration/{self.name}',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
        
        if self.api_key:
            self.default_headers['Authorization'] = f'Bearer {self.api_key}'
        
        logger.info(f"✅ Custom API プロバイダー ({self.name}) 初期化完了")
    
    def get_supported_methods(self) -> List[str]:
        """サポートメソッド一覧"""
        return [
            'custom.products.list',
            'custom.products.get', 
            'custom.products.create',
            'custom.products.update',
            'custom.orders.list',
            'custom.orders.get',
            'custom.customers.list',
            'custom.analytics.sales',
            'custom.webhooks.create'
        ]
    
    def supports_oauth(self) -> bool:
        """OAuth対応"""
        return self.config.get('oauth_enabled', True)
    
    def get_oauth_config(self) -> Dict[str, Any]:
        """OAuth設定"""
        return {
            'token_url': f'{self.base_url}/oauth/token',
            'refresh_url': f'{self.base_url}/oauth/refresh',
            'scopes': ['products:read', 'orders:read', 'analytics:read'],
            'token_expires': True,
            'refresh_threshold_minutes': 30
        }
    
    def get_pagination_config(self) -> Dict[str, Any]:
        """ページネーション設定"""
        return {
            'default_page_size': 100,
            'max_page_size': 1000,
            'supports_cursor': True,
            'supports_offset': False,
            'cursor_param': 'cursor',
            'limit_param': 'limit'
        }
    
    # メソッド実装
    async def _list_products(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """商品一覧取得"""
        
        # パラメータ準備
        query_params = {
            'limit': params.get('limit', 100),
            'status': params.get('status', 'active')
        }
        
        # カーソルページネーション
        if 'cursor' in params:
            query_params['cursor'] = params['cursor']
        
        # OAuth認証ヘッダー追加
        headers = self.default_headers.copy()
        if hasattr(self, 'access_token'):
            headers['Authorization'] = f'Bearer {self.access_token}'
        
        # API呼び出し
        url = f'{self.base_url}/{self.api_version}/products'
        
        async with self.session.get(url, headers=headers, params=query_params) as response:
            if response.status == 200:
                data = await response.json()
                
                result = {
                    'products': data.get('data', []),
                    'count': len(data.get('data', [])),
                    'next_cursor': data.get('next_cursor'),
                    'has_more': data.get('has_more', False),
                    'timestamp': datetime.now().isoformat()
                }
                
                return result
            
            elif response.status == 401:
                # OAuth自動リフレッシュ
                if self.supports_oauth():
                    await self._refresh_oauth_token()
                    return await self._list_products(params)
                else:
                    raise Exception(f"認証エラー: {response.status}")
            
            else:
                error_text = await response.text()
                raise aiohttp.ClientResponseError(
                    request_info=response.request_info,
                    history=response.history,
                    status=response.status,
                    message=error_text
                )
    
    async def _get_product(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """商品詳細取得"""
        
        product_id = params.get('product_id')
        if not product_id:
            raise ValueError("product_id パラメータが必要です")
        
        headers = self.default_headers.copy()
        if hasattr(self, 'access_token'):
            headers['Authorization'] = f'Bearer {self.access_token}'
        
        url = f'{self.base_url}/{self.api_version}/products/{product_id}'
        
        async with self.session.get(url, headers=headers) as response:
            if response.status == 200:
                data = await response.json()
                return {
                    'product': data,
                    'timestamp': datetime.now().isoformat()
                }
            
            elif response.status == 404:
                raise Exception(f"商品が見つかりません: {product_id}")
            
            else:
                error_text = await response.text()
                raise aiohttp.ClientResponseError(
                    request_info=response.request_info,
                    history=response.history,
                    status=response.status,
                    message=error_text
                )
    
    async def _list_orders(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """注文一覧取得"""
        
        query_params = {
            'limit': params.get('limit', 100),
            'status': params.get('status', 'all')
        }
        
        if 'cursor' in params:
            query_params['cursor'] = params['cursor']
        
        if 'created_after' in params:
            query_params['created_after'] = params['created_after']
        
        headers = self.default_headers.copy()
        if hasattr(self, 'access_token'):
            headers['Authorization'] = f'Bearer {self.access_token}'
        
        url = f'{self.base_url}/{self.api_version}/orders'
        
        async with self.session.get(url, headers=headers, params=query_params) as response:
            if response.status == 200:
                data = await response.json()
                
                return {
                    'orders': data.get('data', []),
                    'count': len(data.get('data', [])),
                    'next_cursor': data.get('next_cursor'),
                    'has_more': data.get('has_more', False),
                    'timestamp': datetime.now().isoformat()
                }
            
            else:
                error_text = await response.text()
                raise aiohttp.ClientResponseError(
                    request_info=response.request_info,
                    history=response.history,
                    status=response.status,
                    message=error_text
                )
    
    async def _get_analytics(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """分析データ取得"""
        
        # 日付範囲の設定
        start_date = params.get('start_date', '2024-01-01')
        end_date = params.get('end_date', datetime.now().strftime('%Y-%m-%d'))
        metrics = params.get('metrics', ['sales', 'orders'])
        
        query_params = {
            'start_date': start_date,
            'end_date': end_date,
            'metrics': ','.join(metrics)
        }
        
        headers = self.default_headers.copy()
        if hasattr(self, 'access_token'):
            headers['Authorization'] = f'Bearer {self.access_token}'
        
        url = f'{self.base_url}/{self.api_version}/analytics/reports'
        
        async with self.session.get(url, headers=headers, params=query_params) as response:
            if response.status == 200:
                data = await response.json()
                
                return {
                    'report_type': 'sales_overview',
                    'date_range': {
                        'start_date': start_date,
                        'end_date': end_date
                    },
                    'metrics': data.get('metrics', []),
                    'summary': data.get('summary', {}),
                    'timestamp': datetime.now().isoformat()
                }
            
            else:
                error_text = await response.text()
                raise aiohttp.ClientResponseError(
                    request_info=response.request_info,
                    history=response.history,
                    status=response.status,
                    message=error_text
                )
```

## テストとデバッグ

### 🧪 Phase 3 プロバイダーテスト

```python
import pytest
import asyncio
from unittest.mock import AsyncMock, patch
from services.mcp_integration import MCPRequest, MCPResponse

class TestCustomAPIMCPProvider:
    """Phase 3プロバイダーのテストスイート"""
    
    @pytest.fixture
    async def provider(self):
        """テスト用プロバイダー"""
        config = {
            'api_key': 'test-key',
            'base_url': 'https://api.test.com',
            'oauth_enabled': True,
            'client_id': 'test-client',
            'client_secret': 'test-secret'
        }
        
        provider = CustomAPIMCPProvider('custom_test', config)
        await provider.initialize()
        yield provider
        await provider.shutdown()
    
    @pytest.mark.asyncio
    async def test_basic_request_execution(self, provider):
        """基本リクエスト実行テスト"""
        
        # モックレスポンス設定
        mock_response = {
            'data': [
                {'id': '1', 'name': 'Test Product', 'price': 29.99}
            ],
            'next_cursor': None,
            'has_more': False
        }
        
        with patch.object(provider.session, 'get') as mock_get:
            mock_get.return_value.__aenter__.return_value.status = 200
            mock_get.return_value.__aenter__.return_value.json.return_value = mock_response
            
            request = MCPRequest(
                id='test-1',
                method='custom.products.list',
                params={'limit': 10},
                timestamp=datetime.now()
            )
            
            response = await provider.execute_request(request)
            
            assert response.result is not None
            assert response.error is None
            assert len(response.result['products']) == 1
    
    @pytest.mark.asyncio
    async def test_pagination_support(self, provider):
        """ページネーション機能テスト"""
        
        # 最初のページ
        first_page = {
            'data': [{'id': '1', 'name': 'Product 1'}],
            'next_cursor': 'cursor-123',
            'has_more': True
        }
        
        # 2ページ目
        second_page = {
            'data': [{'id': '2', 'name': 'Product 2'}],
            'next_cursor': None,
            'has_more': False
        }
        
        with patch.object(provider.session, 'get') as mock_get:
            mock_get.return_value.__aenter__.return_value.status = 200
            mock_get.return_value.__aenter__.return_value.json.side_effect = [
                first_page, second_page
            ]
            
            request = MCPRequest(
                id='test-pagination',
                method='custom.products.list',
                params={
                    'limit': 1,
                    'get_all_pages': True,
                    'max_pages': 5
                },
                timestamp=datetime.now()
            )
            
            response = await provider.execute_request(request)
            
            assert response.result is not None
            assert len(response.result['products']) == 2
            assert response.result['pagination_info']['total_pages'] == 2
    
    @pytest.mark.asyncio
    async def test_oauth_refresh(self, provider):
        """OAuth自動リフレッシュテスト"""
        
        # 期限切れトークンを設定
        provider.access_token = 'expired-token'
        provider.refresh_token = 'refresh-token'
        provider.token_expires_at = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        
        # OAuth リフレッシュレスポンス
        refresh_response = {
            'access_token': 'new-access-token',
            'refresh_token': 'new-refresh-token',
            'expires_in': 3600
        }
        
        with patch.object(provider.session, 'post') as mock_post, \
             patch.object(provider.session, 'get') as mock_get, \
             patch.object(provider, '_save_oauth_state') as mock_save:
            
            # OAuth リフレッシュのモック
            mock_post.return_value.__aenter__.return_value.status = 200
            mock_post.return_value.__aenter__.return_value.json.return_value = refresh_response
            
            # 商品取得のモック
            mock_get.return_value.__aenter__.return_value.status = 200
            mock_get.return_value.__aenter__.return_value.json.return_value = {
                'data': [{'id': '1', 'name': 'Test'}]
            }
            
            request = MCPRequest(
                id='test-oauth',
                method='custom.products.list',
                params={'oauth_refresh': True},
                timestamp=datetime.now()
            )
            
            response = await provider.execute_request(request)
            
            assert response.result is not None
            assert provider.access_token == 'new-access-token'
            mock_save.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_standard_model_conversion(self, provider):
        """標準データモデル変換テスト"""
        
        raw_response = {
            'data': [
                {
                    'id': '123',
                    'name': 'Test Product',
                    'description': 'A test product',
                    'price': 29.99,
                    'currency': 'USD',
                    'status': 'active',
                    'created_at': '2024-01-01T00:00:00Z'
                }
            ]
        }
        
        with patch.object(provider.session, 'get') as mock_get:
            mock_get.return_value.__aenter__.return_value.status = 200
            mock_get.return_value.__aenter__.return_value.json.return_value = raw_response
            
            request = MCPRequest(
                id='test-conversion',
                method='custom.products.list',
                params={'convert_response': True},
                timestamp=datetime.now()
            )
            
            response = await provider.execute_request(request)
            
            assert response.result is not None
            products = response.result['products']
            assert len(products) == 1
            
            # 標準Product型の確認
            product = products[0]
            assert hasattr(product, 'id')
            assert hasattr(product, 'title')
            assert hasattr(product, 'price')
            assert product.provider == 'custom_test'
    
    @pytest.mark.asyncio
    async def test_error_handling(self, provider):
        """エラーハンドリングテスト"""
        
        with patch.object(provider.session, 'get') as mock_get:
            # 429レート制限エラーをシミュレート
            mock_get.return_value.__aenter__.return_value.status = 429
            mock_get.return_value.__aenter__.return_value.text.return_value = 'Rate limit exceeded'
            
            request = MCPRequest(
                id='test-error',
                method='custom.products.list',
                params={},
                timestamp=datetime.now()
            )
            
            response = await provider.execute_request(request)
            
            assert response.error is not None
            assert response.error['error_type'] == 'rate_limited'
            assert response.error['error_category'] == 'rate_limiting'
            assert response.error['retryable'] is True
            assert len(response.error['resolution_suggestions']) > 0
    
    def test_pagination_config(self, provider):
        """ページネーション設定テスト"""
        config = provider.get_pagination_config()
        
        assert config['supports_cursor'] is True
        assert config['default_page_size'] == 100
        assert config['max_page_size'] == 1000
    
    def test_oauth_config(self, provider):
        """OAuth設定テスト"""
        config = provider.get_oauth_config()
        
        assert 'token_url' in config
        assert 'refresh_url' in config
        assert 'scopes' in config
        assert config['token_expires'] is True

# テスト実行
if __name__ == '__main__':
    pytest.main([__file__, '-v'])
```

### 🐛 デバッグとログ

```python
import logging
from datetime import datetime

# デバッグ用ログ設定
def setup_debug_logging():
    """デバッグ用ログ設定"""
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(f'mcp_debug_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'),
            logging.StreamHandler()
        ]
    )

# プロバイダーでのデバッグログ活用
class DebuggableProvider(MCPProvider):
    """デバッグ機能付きプロバイダー"""
    
    async def execute_request(self, request: MCPRequest) -> MCPResponse:
        """デバッグ情報付きリクエスト実行"""
        
        start_time = time.time()
        
        logger.debug(f"🔍 リクエスト開始: {request.method}")
        logger.debug(f"📝 パラメータ: {request.params}")
        
        try:
            response = await super().execute_request(request)
            
            end_time = time.time()
            duration = (end_time - start_time) * 1000  # ms
            
            if response.error:
                logger.error(f"❌ リクエスト失敗: {request.method} ({duration:.1f}ms)")
                logger.error(f"🚨 エラー詳細: {response.error}")
            else:
                logger.debug(f"✅ リクエスト成功: {request.method} ({duration:.1f}ms)")
                
                # 結果サイズの記録
                if response.result:
                    result_size = len(str(response.result))
                    logger.debug(f"📦 結果サイズ: {result_size} 文字")
            
            return response
            
        except Exception as e:
            end_time = time.time()
            duration = (end_time - start_time) * 1000
            
            logger.exception(f"💥 予期しないエラー: {request.method} ({duration:.1f}ms)")
            raise
```

## デプロイとモニタリング

### 🚀 Production デプロイ

```python
# production_deployment.py
async def deploy_custom_provider():
    """カスタムプロバイダーのProductionデプロイ"""
    
    # 本番設定
    production_config = {
        'api_key': os.getenv('CUSTOM_API_KEY'),
        'base_url': os.getenv('CUSTOM_API_URL', 'https://api.custom.com'),
        'oauth_enabled': True,
        'client_id': os.getenv('CUSTOM_CLIENT_ID'),
        'client_secret': os.getenv('CUSTOM_CLIENT_SECRET'),
        
        # Phase 3 機能有効化
        'enable_unified_pagination': True,
        'enable_standard_conversion': True,
        'enable_comprehensive_monitoring': True,
        
        # Production設定
        'timeout': 30,
        'max_retries': 5,
        'rate_limit_enabled': True,
        'oauth_refresh_threshold_minutes': 30,
        
        # セキュリティ設定
        'ssl_verify': True,
        'request_encryption': True,
        'audit_logging': True
    }
    
    # OAuth永続化マネージャー
    oauth_manager = OAuthPersistenceManager(
        storage_path='/secure/oauth_tokens',
        encryption_key=os.getenv('OAUTH_ENCRYPTION_KEY'),
        auto_refresh=True,
        backup_enabled=True
    )
    
    production_config['oauth_manager'] = oauth_manager
    
    # プロバイダー初期化
    provider = CustomAPIMCPProvider('custom_production', production_config)
    await provider.initialize()
    
    # ヘルスチェック
    health_check = await run_health_check(provider)
    if not health_check['healthy']:
        raise Exception(f"ヘルスチェック失敗: {health_check['issues']}")
    
    logger.info("✅ カスタムプロバイダーのProductionデプロイ完了")
    return provider

async def run_health_check(provider: MCPProvider) -> Dict[str, Any]:
    """プロバイダーヘルスチェック"""
    
    issues = []
    
    try:
        # 基本接続テスト
        test_request = MCPRequest(
            id='health-check',
            method='custom.products.list',
            params={'limit': 1},
            timestamp=datetime.now()
        )
        
        response = await provider.execute_request(test_request)
        
        if response.error:
            issues.append(f"基本接続エラー: {response.error['error_message']}")
        
        # OAuth状態チェック
        if provider.supports_oauth():
            if not hasattr(provider, 'access_token') or not provider.access_token:
                issues.append("OAuthトークンが未設定")
        
        # 設定検証
        required_config = ['api_key', 'base_url']
        for key in required_config:
            if not provider.config.get(key):
                issues.append(f"必須設定が未設定: {key}")
        
    except Exception as e:
        issues.append(f"ヘルスチェック例外: {str(e)}")
    
    return {
        'healthy': len(issues) == 0,
        'issues': issues,
        'timestamp': datetime.now().isoformat()
    }
```

### 📊 監視とアラート

```python
# monitoring.py
class ProviderMonitoring:
    """プロバイダー監視システム"""
    
    def __init__(self, provider: MCPProvider):
        self.provider = provider
        self.alerts = []
        self.metrics_history = []
    
    async def start_monitoring(self):
        """監視開始"""
        while True:
            try:
                await self.collect_metrics()
                await self.check_alerts()
                await asyncio.sleep(60)  # 1分間隔
            except Exception as e:
                logger.error(f"監視エラー: {e}")
                await asyncio.sleep(60)
    
    async def collect_metrics(self):
        """メトリクス収集"""
        metrics = {
            'timestamp': datetime.now().isoformat(),
            'provider': self.provider.name,
            'total_requests': self.provider.performance_metrics['total_requests'],
            'success_rate': self.provider.performance_metrics['successful_requests'] / 
                           max(self.provider.performance_metrics['total_requests'], 1),
            'avg_response_time': self.provider.performance_metrics['avg_response_time'],
            'error_rate': self.provider.error_metrics['total_errors'] / 
                         max(self.provider.performance_metrics['total_requests'], 1),
            'oauth_status': await self._check_oauth_status()
        }
        
        self.metrics_history.append(metrics)
        
        # 履歴の制限（直近24時間）
        if len(self.metrics_history) > 1440:  # 24時間 * 60分
            self.metrics_history = self.metrics_history[-1440:]
        
        return metrics
    
    async def check_alerts(self):
        """アラートチェック"""
        if not self.metrics_history:
            return
        
        latest = self.metrics_history[-1]
        
        # エラー率アラート
        if latest['error_rate'] > 0.05:  # 5%以上
            await self.send_alert(
                'HIGH_ERROR_RATE',
                f"エラー率が{latest['error_rate']:.1%}に上昇",
                'critical'
            )
        
        # レスポンス時間アラート
        if latest['avg_response_time'] > 5000:  # 5秒以上
            await self.send_alert(
                'SLOW_RESPONSE',
                f"平均レスポンス時間が{latest['avg_response_time']:.0f}msに悪化",
                'warning'
            )
        
        # OAuth期限アラート
        oauth_status = latest['oauth_status']
        if oauth_status and oauth_status.get('expires_soon'):
            await self.send_alert(
                'OAUTH_EXPIRY',
                f"OAuthトークンが{oauth_status['expires_in']}秒後に期限切れ",
                'warning'
            )
    
    async def _check_oauth_status(self) -> Optional[Dict[str, Any]]:
        """OAuth状態確認"""
        if not self.provider.supports_oauth():
            return None
        
        if hasattr(self.provider, 'token_expires_at') and self.provider.token_expires_at:
            expires_at = datetime.fromisoformat(self.provider.token_expires_at)
            now = datetime.now(timezone.utc)
            expires_in = (expires_at - now).total_seconds()
            
            return {
                'expires_in': expires_in,
                'expires_soon': expires_in < 3600,  # 1時間以内
                'expires_at': self.provider.token_expires_at
            }
        
        return None
    
    async def send_alert(self, alert_type: str, message: str, severity: str):
        """アラート送信"""
        alert = {
            'type': alert_type,
            'message': message,
            'severity': severity,
            'provider': self.provider.name,
            'timestamp': datetime.now().isoformat()
        }
        
        self.alerts.append(alert)
        
        # アラート送信（Slack、メール等）
        logger.warning(f"🚨 アラート: {message}")
        
        # 実際の通知システムとの連携
        # await send_slack_notification(alert)
        # await send_email_alert(alert)
```

## ベストプラクティス

### 🎯 Phase 3 開発ベストプラクティス

#### 1. セキュリティ

```python
# セキュリティベストプラクティス
class SecureProvider(MCPProvider):
    """セキュア実装例"""
    
    def __init__(self, name: str, config: Dict[str, Any]):
        super().__init__(name, config)
        
        # 機密情報の暗号化
        self.encrypted_credentials = self._encrypt_credentials()
        
        # リクエスト署名
        self.request_signer = RequestSigner(config.get('signing_key'))
        
        # レート制限の厳格化
        self.security_rate_limiter = SecurityRateLimiter()
    
    def _encrypt_credentials(self) -> Dict[str, str]:
        """認証情報の暗号化"""
        # 実装例（実際は適切な暗号化ライブラリを使用）
        return {
            'api_key': encrypt(self.config.get('api_key', '')),
            'client_secret': encrypt(self.config.get('client_secret', ''))
        }
    
    async def _sign_request(self, url: str, params: Dict) -> str:
        """リクエスト署名"""
        return self.request_signer.sign(url, params)
    
    def _validate_input(self, params: Dict[str, Any]) -> bool:
        """入力検証"""
        # SQLインジェクション対策
        dangerous_patterns = ['--', ';', 'DROP', 'DELETE', 'INSERT']
        
        for value in params.values():
            if isinstance(value, str):
                for pattern in dangerous_patterns:
                    if pattern.lower() in value.lower():
                        raise ValueError(f"危険なパターンが検出されました: {pattern}")
        
        return True
```

#### 2. パフォーマンス最適化

```python
# パフォーマンス最適化
class OptimizedProvider(MCPProvider):
    """パフォーマンス最適化実装例"""
    
    def __init__(self, name: str, config: Dict[str, Any]):
        super().__init__(name, config)
        
        # 接続プール
        self.connection_pool = aiohttp.TCPConnector(
            limit=100,  # 最大接続数
            limit_per_host=30,  # ホスト別最大接続数
            ttl_dns_cache=300,  # DNS キャッシュ
            use_dns_cache=True
        )
        
        # レスポンスキャッシュ
        self.response_cache = {}
        self.cache_ttl = 300  # 5分
    
    async def initialize(self):
        """最適化されたセッション初期化"""
        self.session = aiohttp.ClientSession(
            connector=self.connection_pool,
            timeout=aiohttp.ClientTimeout(total=30),
            headers={'Connection': 'keep-alive'}
        )
        await super().initialize()
    
    async def _cached_request(self, url: str, params: Dict) -> Dict:
        """キャッシュ付きリクエスト"""
        cache_key = f"{url}:{hash(str(sorted(params.items())))}"
        
        # キャッシュチェック
        if cache_key in self.response_cache:
            cached_data, timestamp = self.response_cache[cache_key]
            if (datetime.now() - timestamp).seconds < self.cache_ttl:
                logger.debug(f"📋 キャッシュヒット: {url}")
                return cached_data
        
        # API呼び出し
        async with self.session.get(url, params=params) as response:
            if response.status == 200:
                data = await response.json()
                
                # キャッシュ保存
                self.response_cache[cache_key] = (data, datetime.now())
                
                return data
            else:
                raise Exception(f"Request failed: {response.status}")
    
    def _batch_requests(self, requests: List[Dict]) -> List[List[Dict]]:
        """リクエストのバッチ化"""
        batch_size = 10
        return [requests[i:i + batch_size] for i in range(0, len(requests), batch_size)]
```

#### 3. エラー回復

```python
# エラー回復戦略
class ResilientProvider(MCPProvider):
    """回復力のある実装例"""
    
    async def execute_request_with_recovery(self, request: MCPRequest) -> MCPResponse:
        """回復機能付きリクエスト実行"""
        
        max_attempts = 5
        base_delay = 1.0
        
        for attempt in range(max_attempts):
            try:
                response = await self.execute_request(request)
                
                if response.error:
                    error_type = response.error.get('error_type')
                    
                    # 回復可能なエラーの場合
                    if self._is_recoverable_error(error_type):
                        if attempt < max_attempts - 1:
                            delay = base_delay * (2 ** attempt)
                            logger.info(f"🔄 回復可能エラー、{delay}秒後に再試行: {error_type}")
                            await asyncio.sleep(delay)
                            continue
                
                return response
                
            except Exception as e:
                if attempt < max_attempts - 1:
                    delay = base_delay * (2 ** attempt)
                    logger.warning(f"🔄 例外発生、{delay}秒後に再試行: {e}")
                    await asyncio.sleep(delay)
                else:
                    logger.error(f"💥 最大試行回数に到達: {e}")
                    raise
        
        # すべて失敗した場合のフォールバック
        return self._create_fallback_response(request)
    
    def _is_recoverable_error(self, error_type: str) -> bool:
        """回復可能エラーの判定"""
        recoverable_errors = [
            'rate_limited',
            'service_unavailable',
            'gateway_timeout',
            'internal_server_error'
        ]
        return error_type in recoverable_errors
    
    def _create_fallback_response(self, request: MCPRequest) -> MCPResponse:
        """フォールバックレスポンス"""
        return MCPResponse(
            id=request.id,
            result={
                'fallback': True,
                'message': 'フォールバックモードで動作中',
                'timestamp': datetime.now().isoformat()
            }
        )
```

---

## 🎊 Phase 3 プロバイダー実装完成

このガイドにより、**Production-Ready**なMCPプロバイダーの実装が可能になります。

### ✨ 実装で得られる価値

- **🔄 統一ページネーション**: 大量データの効率的な処理
- **🔐 OAuth永続化**: 中断のない認証管理
- **📊 標準データモデル**: プロバイダー間での完全な互換性
- **🛡️ 統一エラーハンドリング**: 予測可能で信頼性の高いエラー処理
- **📈 包括的監視**: リアルタイムでの運用状況把握

### 🚀 次のステップ

1. **実装開始**: このガイドを参考にプロバイダーを実装
2. **テスト実行**: 提供されたテストスイートで品質確認
3. **Production展開**: 監視システムと共にデプロイ
4. **継続改善**: メトリクスを基にした最適化

**🎯 Phase 3の威力を体験して、次世代のMCP統合ソリューションを構築してください！**