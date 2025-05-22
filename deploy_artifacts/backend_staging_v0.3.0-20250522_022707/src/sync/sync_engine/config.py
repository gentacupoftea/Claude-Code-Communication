"""
同期エンジン設定
"""

from dataclasses import dataclass, field
from typing import Dict, Any, List


@dataclass
class SyncConfig:
    """データ同期エンジンの設定"""
    
    # 基本設定
    batch_size: int = 50
    sync_interval: int = 300  # 秒
    retry_attempts: int = 3
    retry_delay: int = 5
    
    # 同期方向
    amazon_to_nextengine: bool = True
    nextengine_to_amazon: bool = True
    
    # 同期データタイプ
    sync_products: bool = True
    sync_inventory: bool = True
    sync_orders: bool = True
    sync_customers: bool = False  # プライバシー上の理由により無効化
    
    # 競合解決戦略
    # newest: 最新のデータを優先
    # amazon_priority: Amazonデータを優先
    # nextengine_priority: NextEngineデータを優先
    conflict_resolution: str = "newest"
    
    # 同期フィルター
    product_filters: Dict[str, Any] = field(default_factory=dict)
    order_filters: Dict[str, Any] = field(default_factory=dict)
    
    # API制限
    api_rate_limit_amazon: float = 0.5  # リクエスト/秒 (2秒に1リクエスト)
    api_rate_limit_nextengine: float = 1.0  # リクエスト/秒
    api_rate_limit_shopify: float = 2.0  # リクエスト/秒
    
    # Shopify固有設定
    use_graphql: bool = True  # GraphQL APIを使用する
    
    # ロギング設定
    log_level: str = "INFO"
    log_detailed_errors: bool = True
    
    # メトリクス設定
    collect_metrics: bool = True
    metrics_namespace: str = "conea/sync_engine"
    
    # セキュリティ設定
    validate_data: bool = True
    
    def get_product_filters(self) -> Dict[str, Any]:
        """
        商品フィルターを取得
        
        Returns:
            フィルターの辞書
        """
        return self.product_filters.copy()
    
    def get_order_filters(self) -> Dict[str, Any]:
        """
        注文フィルターを取得
        
        Returns:
            フィルターの辞書
        """
        return self.order_filters.copy()
    
    def is_bidirectional(self) -> bool:
        """
        双方向同期かどうかを確認
        
        Returns:
            双方向同期の場合はTrue
        """
        return self.amazon_to_nextengine and self.nextengine_to_amazon