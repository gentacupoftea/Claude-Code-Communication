"""
統合サービス - データソースの統合と処理
"""
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
from pydantic import BaseModel

from ..models.integrated import (
    IntegratedCustomerData,
    IntegratedProductData,
    IntegratedOrderData,
    DataIntegrationConfig
)

logger = logging.getLogger(__name__)

class DataIntegrationService:
    """データ統合サービスのメインクラス"""
    
    def __init__(self, config: DataIntegrationConfig):
        self.config = config
        self.data_sources = {}
        self.field_mappings = config.field_mappings
        self.merge_strategy = config.merge_strategy
        self.conflict_resolution = config.conflict_resolution
        self.quality_thresholds = config.quality_thresholds
        
    def register_data_source(self, name: str, source: Any):
        """データソースを登録"""
        self.data_sources[name] = source
        logger.info(f"Registered data source: {name}")
    
    def integrate_customer_data(self, customer_id: str) -> IntegratedCustomerData:
        """複数のソースから顧客データを統合"""
        integrated_data = {
            'customer_id': customer_id,
            'data_sources': []
        }
        
        for source_name, source in self.data_sources.items():
            try:
                # 各ソースから顧客データを取得
                source_data = source.get_customer_data(customer_id)
                if source_data:
                    integrated_data['data_sources'].append(source_name)
                    self._merge_customer_data(integrated_data, source_data, source_name)
            except Exception as e:
                logger.error(f"Error fetching customer data from {source_name}: {e}")
        
        return IntegratedCustomerData(**integrated_data)
    
    def integrate_product_data(self, product_id: str) -> IntegratedProductData:
        """複数のソースから商品データを統合"""
        integrated_data = {
            'product_id': product_id,
            'data_sources': []
        }
        
        for source_name, source in self.data_sources.items():
            try:
                # 各ソースから商品データを取得
                source_data = source.get_product_data(product_id)
                if source_data:
                    integrated_data['data_sources'].append(source_name)
                    self._merge_product_data(integrated_data, source_data, source_name)
            except Exception as e:
                logger.error(f"Error fetching product data from {source_name}: {e}")
        
        return IntegratedProductData(**integrated_data)
    
    def integrate_order_data(self, order_id: str) -> IntegratedOrderData:
        """複数のソースから注文データを統合"""
        integrated_data = {
            'order_id': order_id,
            'data_sources': []
        }
        
        for source_name, source in self.data_sources.items():
            try:
                # 各ソースから注文データを取得
                source_data = source.get_order_data(order_id)
                if source_data:
                    integrated_data['data_sources'].append(source_name)
                    self._merge_order_data(integrated_data, source_data, source_name)
            except Exception as e:
                logger.error(f"Error fetching order data from {source_name}: {e}")
        
        return IntegratedOrderData(**integrated_data)
    
    def _merge_customer_data(self, target: Dict, source: Dict, source_name: str):
        """顧客データをマージ"""
        # フィールドマッピングを適用
        mapped_data = self._apply_field_mapping(source, source_name)
        
        # マージ戦略に基づいてデータを統合
        if self.merge_strategy == 'latest':
            self._merge_latest(target, mapped_data)
        elif self.merge_strategy == 'weighted':
            self._merge_weighted(target, mapped_data, source_name)
        else:
            self._merge_manual(target, mapped_data, source_name)
    
    def _merge_product_data(self, target: Dict, source: Dict, source_name: str):
        """商品データをマージ"""
        mapped_data = self._apply_field_mapping(source, source_name)
        
        if self.merge_strategy == 'latest':
            self._merge_latest(target, mapped_data)
        elif self.merge_strategy == 'weighted':
            self._merge_weighted(target, mapped_data, source_name)
        else:
            self._merge_manual(target, mapped_data, source_name)
    
    def _merge_order_data(self, target: Dict, source: Dict, source_name: str):
        """注文データをマージ"""
        mapped_data = self._apply_field_mapping(source, source_name)
        
        if self.merge_strategy == 'latest':
            self._merge_latest(target, mapped_data)
        elif self.merge_strategy == 'weighted':
            self._merge_weighted(target, mapped_data, source_name)
        else:
            self._merge_manual(target, mapped_data, source_name)
    
    def _apply_field_mapping(self, data: Dict, source_name: str) -> Dict:
        """フィールドマッピングを適用"""
        if source_name not in self.field_mappings:
            return data
        
        mapping = self.field_mappings[source_name]
        mapped_data = {}
        
        for target_field, source_field in mapping.items():
            if source_field in data:
                mapped_data[target_field] = data[source_field]
        
        return mapped_data
    
    def _merge_latest(self, target: Dict, source: Dict):
        """最新のデータでマージ"""
        for key, value in source.items():
            if value is not None:
                target[key] = value
    
    def _merge_weighted(self, target: Dict, source: Dict, source_name: str):
        """重み付けマージ（ソースの信頼度に基づく）"""
        # TODO: ソースごとの重みを実装
        weight = self._get_source_weight(source_name)
        
        for key, value in source.items():
            if value is not None:
                if key not in target:
                    target[key] = value
                else:
                    # 重み付け平均などの処理
                    if isinstance(value, (int, float)):
                        current_value = target.get(key, 0)
                        target[key] = (current_value + value * weight) / 2
                    else:
                        target[key] = value
    
    def _merge_manual(self, target: Dict, source: Dict, source_name: str):
        """手動マージ（ルールベース）"""
        # カスタムルールに基づいてマージ
        for key, value in source.items():
            if key in target and target[key] != value:
                # 競合解決
                resolved_value = self._resolve_conflict(key, target[key], value, source_name)
                target[key] = resolved_value
            elif value is not None:
                target[key] = value
    
    def _resolve_conflict(self, field: str, current_value: Any, new_value: Any, source_name: str) -> Any:
        """データの競合を解決"""
        if self.conflict_resolution == 'highest_confidence':
            # 信頼度の高い方を選択
            current_confidence = self._calculate_confidence(current_value, field)
            new_confidence = self._calculate_confidence(new_value, field)
            return new_value if new_confidence > current_confidence else current_value
        elif self.conflict_resolution == 'most_recent':
            # より新しいデータを選択
            return new_value  # 簡略化
        else:
            # 手動解決（デフォルトは新しい値）
            return new_value
    
    def _get_source_weight(self, source_name: str) -> float:
        """データソースの重みを取得"""
        # TODO: ソースごとの重みを設定可能にする
        default_weights = {
            'shopify': 1.0,
            'analytics': 0.8,
            'email': 0.6,
            'social': 0.4
        }
        return default_weights.get(source_name, 0.5)
    
    def _calculate_confidence(self, value: Any, field: str) -> float:
        """データの信頼度を計算"""
        # 簡単な信頼度計算
        if value is None:
            return 0.0
        
        # フィールドによって異なる計算
        if field == 'email':
            # メールアドレスの検証
            return 1.0 if '@' in str(value) else 0.0
        elif field == 'phone':
            # 電話番号の検証
            return 1.0 if len(str(value)) >= 10 else 0.0
        
        return 0.5  # デフォルト
    
    def validate_integrated_data(self, data: BaseModel) -> bool:
        """統合データの検証"""
        # 品質しきい値のチェック
        for field, threshold in self.quality_thresholds.items():
            value = getattr(data, field, None)
            if value is not None and isinstance(value, (int, float)):
                if value < threshold:
                    logger.warning(f"Quality threshold not met for {field}: {value} < {threshold}")
                    return False
        
        return True
    
    def batch_integrate(self, entity_type: str, entity_ids: List[str]) -> List[BaseModel]:
        """バッチ統合処理"""
        results = []
        
        for entity_id in entity_ids:
            try:
                if entity_type == 'customer':
                    result = self.integrate_customer_data(entity_id)
                elif entity_type == 'product':
                    result = self.integrate_product_data(entity_id)
                elif entity_type == 'order':
                    result = self.integrate_order_data(entity_id)
                else:
                    logger.error(f"Unknown entity type: {entity_type}")
                    continue
                
                if self.validate_integrated_data(result):
                    results.append(result)
            except Exception as e:
                logger.error(f"Error integrating {entity_type} {entity_id}: {e}")
        
        return results