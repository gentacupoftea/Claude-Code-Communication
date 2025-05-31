"""
データマッピングサービス - データソース間のフィールドマッピング管理
"""
import json
import logging
from typing import Dict, List, Any, Optional
from pathlib import Path

logger = logging.getLogger(__name__)

class DataMappingService:
    """データマッピングの管理と適用"""
    
    def __init__(self, mapping_file: Optional[str] = None):
        self.mappings = {}
        if mapping_file:
            self.load_mappings(mapping_file)
        else:
            self._initialize_default_mappings()
    
    def _initialize_default_mappings(self):
        """デフォルトのマッピングを初期化"""
        self.mappings = {
            'shopify': {
                'customer': {
                    'customer_id': 'id',
                    'email': 'email',
                    'name': 'display_name',
                    'phone': 'phone',
                    'address': 'default_address',
                    'orders_count': 'orders_count',
                    'total_spent': 'total_spent',
                    'tags': 'tags',
                    'created_at': 'created_at',
                    'updated_at': 'updated_at'
                },
                'product': {
                    'product_id': 'id',
                    'title': 'title',
                    'description': 'body_html',
                    'price': 'price',
                    'vendor': 'vendor',
                    'product_type': 'product_type',
                    'tags': 'tags',
                    'created_at': 'created_at',
                    'updated_at': 'updated_at'
                },
                'order': {
                    'order_id': 'id',
                    'customer_id': 'customer.id',
                    'order_date': 'created_at',
                    'total_amount': 'total_price',
                    'status': 'financial_status',
                    'fulfillment_status': 'fulfillment_status',
                    'items': 'line_items'
                }
            },
            'google_analytics': {
                'customer': {
                    'customer_id': 'user_id',
                    'engagement_score': 'engagement_rate',
                    'device_preference': 'primary_device',
                    'channel_preference': 'acquisition_channel'
                },
                'product': {
                    'product_id': 'item_id',
                    'view_count': 'page_views',
                    'bounce_rate': 'bounce_rate',
                    'conversion_rate': 'ecommerce_conversion_rate'
                }
            },
            'email_marketing': {
                'customer': {
                    'customer_id': 'subscriber_id',
                    'email': 'email_address',
                    'engagement_score': 'open_rate',
                    'communication_preferences': 'email_preferences',
                    'segments': 'lists'
                }
            }
        }
    
    def load_mappings(self, filename: str):
        """マッピング定義をファイルから読み込む"""
        try:
            with open(filename, 'r') as f:
                self.mappings = json.load(f)
            logger.info(f"Loaded mappings from {filename}")
        except Exception as e:
            logger.error(f"Error loading mappings from {filename}: {e}")
            self._initialize_default_mappings()
    
    def save_mappings(self, filename: str):
        """マッピング定義をファイルに保存"""
        try:
            with open(filename, 'w') as f:
                json.dump(self.mappings, f, indent=2)
            logger.info(f"Saved mappings to {filename}")
        except Exception as e:
            logger.error(f"Error saving mappings to {filename}: {e}")
    
    def get_mapping(self, source: str, entity_type: str) -> Dict[str, str]:
        """特定のソースとエンティティタイプのマッピングを取得"""
        if source not in self.mappings:
            logger.warning(f"No mapping found for source: {source}")
            return {}
        
        if entity_type not in self.mappings[source]:
            logger.warning(f"No mapping found for entity type: {entity_type} in source: {source}")
            return {}
        
        return self.mappings[source][entity_type]
    
    def add_mapping(self, source: str, entity_type: str, mapping: Dict[str, str]):
        """新しいマッピングを追加"""
        if source not in self.mappings:
            self.mappings[source] = {}
        
        if entity_type not in self.mappings[source]:
            self.mappings[source][entity_type] = {}
        
        self.mappings[source][entity_type].update(mapping)
        logger.info(f"Added mapping for {source}.{entity_type}")
    
    def remove_mapping(self, source: str, entity_type: str, field: Optional[str] = None):
        """マッピングを削除"""
        if source not in self.mappings:
            return
        
        if entity_type not in self.mappings[source]:
            return
        
        if field:
            # 特定のフィールドのみ削除
            if field in self.mappings[source][entity_type]:
                del self.mappings[source][entity_type][field]
                logger.info(f"Removed mapping for {source}.{entity_type}.{field}")
        else:
            # エンティティタイプ全体を削除
            del self.mappings[source][entity_type]
            logger.info(f"Removed all mappings for {source}.{entity_type}")
    
    def apply_mapping(self, data: Dict[str, Any], source: str, entity_type: str) -> Dict[str, Any]:
        """データにマッピングを適用"""
        mapping = self.get_mapping(source, entity_type)
        if not mapping:
            return data
        
        mapped_data = {}
        for target_field, source_field in mapping.items():
            value = self._get_nested_value(data, source_field)
            if value is not None:
                mapped_data[target_field] = value
        
        return mapped_data
    
    def reverse_mapping(self, data: Dict[str, Any], source: str, entity_type: str) -> Dict[str, Any]:
        """逆マッピングを適用（統合データから元のフォーマットへ）"""
        mapping = self.get_mapping(source, entity_type)
        if not mapping:
            return data
        
        reversed_mapping = {v: k for k, v in mapping.items()}
        reversed_data = {}
        
        for source_field, target_field in reversed_mapping.items():
            if target_field in data:
                self._set_nested_value(reversed_data, source_field, data[target_field])
        
        return reversed_data
    
    def _get_nested_value(self, data: Dict, path: str) -> Any:
        """ネストされたパスから値を取得（例: 'customer.id' -> data['customer']['id']）"""
        parts = path.split('.')
        value = data
        
        for part in parts:
            if isinstance(value, dict) and part in value:
                value = value[part]
            else:
                return None
        
        return value
    
    def _set_nested_value(self, data: Dict, path: str, value: Any):
        """ネストされたパスに値を設定"""
        parts = path.split('.')
        current = data
        
        for part in parts[:-1]:
            if part not in current:
                current[part] = {}
            current = current[part]
        
        current[parts[-1]] = value
    
    def validate_mapping(self, source: str, entity_type: str, sample_data: Dict) -> Dict[str, bool]:
        """マッピングの妥当性を検証"""
        mapping = self.get_mapping(source, entity_type)
        validation_result = {}
        
        for target_field, source_field in mapping.items():
            value = self._get_nested_value(sample_data, source_field)
            validation_result[target_field] = value is not None
        
        return validation_result
    
    def suggest_mappings(self, source_data: Dict, target_fields: List[str]) -> Dict[str, str]:
        """ソースデータとターゲットフィールドから自動的にマッピングを提案"""
        suggestions = {}
        source_fields = self._get_all_fields(source_data)
        
        for target_field in target_fields:
            # シンプルな名前マッチング
            for source_field in source_fields:
                if self._fields_match(target_field, source_field):
                    suggestions[target_field] = source_field
                    break
        
        return suggestions
    
    def _get_all_fields(self, data: Dict, prefix: str = '') -> List[str]:
        """データ構造からすべてのフィールドパスを取得"""
        fields = []
        
        for key, value in data.items():
            field_path = f"{prefix}.{key}" if prefix else key
            fields.append(field_path)
            
            if isinstance(value, dict):
                fields.extend(self._get_all_fields(value, field_path))
        
        return fields
    
    def _fields_match(self, field1: str, field2: str) -> bool:
        """フィールド名がマッチするかチェック"""
        # 簡単な名前マッチング
        field1_parts = field1.lower().split('_')
        field2_parts = field2.lower().split('_')
        
        # 完全一致
        if field1.lower() == field2.lower():
            return True
        
        # 部分一致
        common_parts = set(field1_parts) & set(field2_parts)
        if len(common_parts) >= len(field1_parts) * 0.5:
            return True
        
        # 一般的な同義語
        synonyms = {
            'customer': ['user', 'client', 'buyer'],
            'product': ['item', 'sku', 'merchandise'],
            'order': ['purchase', 'transaction'],
            'email': ['email_address', 'mail'],
            'phone': ['phone_number', 'tel', 'mobile'],
            'address': ['location', 'addr']
        }
        
        for key, values in synonyms.items():
            if key in field1_parts:
                for value in values:
                    if value in field2_parts:
                        return True
        
        return False
    
    def create_mapping_report(self) -> Dict[str, Any]:
        """マッピング設定のレポートを生成"""
        report = {
            'total_sources': len(self.mappings),
            'sources': {}
        }
        
        for source, entity_mappings in self.mappings.items():
            report['sources'][source] = {
                'entity_types': len(entity_mappings),
                'mappings': {}
            }
            
            for entity_type, fields in entity_mappings.items():
                report['sources'][source]['mappings'][entity_type] = {
                    'field_count': len(fields),
                    'fields': list(fields.keys())
                }
        
        return report