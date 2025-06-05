"""
DWHスキーマレジストリ
共通のデータウェアハウススキーマ定義と管理を行う
"""

import logging
import json
import yaml
from typing import Dict, List, Any, Optional, Union, Type
from dataclasses import dataclass, field
from pathlib import Path
from enum import Enum
from datetime import datetime

logger = logging.getLogger(__name__)


class FieldType(Enum):
    """フィールドデータ型の定義"""
    STRING = "string"
    INTEGER = "integer"
    FLOAT = "float"
    DECIMAL = "decimal"
    BOOLEAN = "boolean"
    DATE = "date"
    DATETIME = "datetime"
    JSON = "json"
    ARRAY = "array"


class ValidationRule(Enum):
    """バリデーションルールの定義"""
    REQUIRED = "required"
    UNIQUE = "unique"
    MIN_LENGTH = "min_length"
    MAX_LENGTH = "max_length"
    MIN_VALUE = "min_value"
    MAX_VALUE = "max_value"
    REGEX = "regex"
    EMAIL = "email"
    URL = "url"
    PHONE = "phone"


@dataclass
class FieldDefinition:
    """フィールド定義"""
    name: str
    type: FieldType
    nullable: bool = True
    default_value: Optional[Any] = None
    description: Optional[str] = None
    validation_rules: Dict[ValidationRule, Any] = field(default_factory=dict)
    source_hints: List[str] = field(default_factory=list)  # ソースフィールド名のヒント
    
    def to_dict(self) -> Dict[str, Any]:
        """辞書形式に変換"""
        return {
            'name': self.name,
            'type': self.type.value,
            'nullable': self.nullable,
            'default_value': self.default_value,
            'description': self.description,
            'validation_rules': {rule.value: value for rule, value in self.validation_rules.items()},
            'source_hints': self.source_hints
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'FieldDefinition':
        """辞書から作成"""
        validation_rules = {}
        if 'validation_rules' in data:
            for rule_name, value in data['validation_rules'].items():
                try:
                    rule = ValidationRule(rule_name)
                    validation_rules[rule] = value
                except ValueError:
                    logger.warning(f"Unknown validation rule: {rule_name}")
        
        return cls(
            name=data['name'],
            type=FieldType(data['type']),
            nullable=data.get('nullable', True),
            default_value=data.get('default_value'),
            description=data.get('description'),
            validation_rules=validation_rules,
            source_hints=data.get('source_hints', [])
        )


@dataclass
class TableDefinition:
    """テーブル定義"""
    name: str
    fields: List[FieldDefinition]
    primary_key: List[str] = field(default_factory=list)
    indexes: List[List[str]] = field(default_factory=list)
    description: Optional[str] = None
    source_tables: List[str] = field(default_factory=list)  # ソーステーブル名
    
    def get_field(self, name: str) -> Optional[FieldDefinition]:
        """フィールドを名前で取得"""
        for field in self.fields:
            if field.name == name:
                return field
        return None
    
    def get_field_names(self) -> List[str]:
        """全フィールド名を取得"""
        return [field.name for field in self.fields]
    
    def to_dict(self) -> Dict[str, Any]:
        """辞書形式に変換"""
        return {
            'name': self.name,
            'fields': [field.to_dict() for field in self.fields],
            'primary_key': self.primary_key,
            'indexes': self.indexes,
            'description': self.description,
            'source_tables': self.source_tables
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'TableDefinition':
        """辞書から作成"""
        fields = [FieldDefinition.from_dict(field_data) for field_data in data.get('fields', [])]
        
        return cls(
            name=data['name'],
            fields=fields,
            primary_key=data.get('primary_key', []),
            indexes=data.get('indexes', []),
            description=data.get('description'),
            source_tables=data.get('source_tables', [])
        )


@dataclass
class DWHSchema:
    """DWHスキーマ定義"""
    version: str
    tables: List[TableDefinition]
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    def get_table(self, name: str) -> Optional[TableDefinition]:
        """テーブルを名前で取得"""
        for table in self.tables:
            if table.name == name:
                return table
        return None
    
    def get_table_names(self) -> List[str]:
        """全テーブル名を取得"""
        return [table.name for table in self.tables]
    
    def to_dict(self) -> Dict[str, Any]:
        """辞書形式に変換"""
        return {
            'version': self.version,
            'tables': [table.to_dict() for table in self.tables],
            'metadata': self.metadata,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'DWHSchema':
        """辞書から作成"""
        tables = [TableDefinition.from_dict(table_data) for table_data in data.get('tables', [])]
        
        created_at = None
        if data.get('created_at'):
            try:
                created_at = datetime.fromisoformat(data['created_at'])
            except ValueError:
                pass
        
        updated_at = None
        if data.get('updated_at'):
            try:
                updated_at = datetime.fromisoformat(data['updated_at'])
            except ValueError:
                pass
        
        return cls(
            version=data['version'],
            tables=tables,
            metadata=data.get('metadata', {}),
            created_at=created_at,
            updated_at=updated_at
        )


class SchemaRegistry:
    """
    スキーマレジストリ
    DWHスキーマの管理と読み込みを行う
    """
    
    def __init__(self, schema_dir: Union[str, Path]):
        """
        スキーマレジストリを初期化
        
        Args:
            schema_dir: スキーマファイルが格納されているディレクトリ
        """
        self.schema_dir = Path(schema_dir)
        self.schemas: Dict[str, DWHSchema] = {}
        self.current_schema: Optional[DWHSchema] = None
        
        # ディレクトリを作成
        self.schema_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"Schema registry initialized with directory: {self.schema_dir}")
    
    def load_schema(self, version: Optional[str] = None) -> DWHSchema:
        """
        スキーマを読み込み
        
        Args:
            version: スキーマバージョン（Noneの場合は最新）
            
        Returns:
            DWHSchema: 読み込まれたスキーマ
        """
        if version is None:
            version = self._get_latest_version()
        
        if version in self.schemas:
            return self.schemas[version]
        
        schema_file = self.schema_dir / f"schema_v{version}.yaml"
        if not schema_file.exists():
            # JSON形式も試す
            schema_file = self.schema_dir / f"schema_v{version}.json"
        
        if not schema_file.exists():
            raise FileNotFoundError(f"Schema file not found for version {version}")
        
        schema_data = self._load_schema_file(schema_file)
        schema = DWHSchema.from_dict(schema_data)
        
        self.schemas[version] = schema
        self.current_schema = schema
        
        logger.info(f"Loaded schema version {version} with {len(schema.tables)} tables")
        return schema
    
    def save_schema(self, schema: DWHSchema, format: str = 'yaml') -> Path:
        """
        スキーマを保存
        
        Args:
            schema: 保存するスキーマ
            format: ファイル形式（'yaml' または 'json'）
            
        Returns:
            Path: 保存されたファイルのパス
        """
        schema.updated_at = datetime.now()
        
        if format == 'yaml':
            schema_file = self.schema_dir / f"schema_v{schema.version}.yaml"
            with open(schema_file, 'w', encoding='utf-8') as f:
                yaml.dump(schema.to_dict(), f, default_flow_style=False, allow_unicode=True)
        elif format == 'json':
            schema_file = self.schema_dir / f"schema_v{schema.version}.json"
            with open(schema_file, 'w', encoding='utf-8') as f:
                json.dump(schema.to_dict(), f, indent=2, ensure_ascii=False)
        else:
            raise ValueError(f"Unsupported format: {format}")
        
        self.schemas[schema.version] = schema
        
        logger.info(f"Saved schema version {schema.version} to {schema_file}")
        return schema_file
    
    def get_current_schema(self) -> Optional[DWHSchema]:
        """現在のスキーマを取得"""
        return self.current_schema
    
    def list_versions(self) -> List[str]:
        """利用可能なスキーマバージョンをリスト"""
        versions = set()
        
        # ファイルシステムから検索
        for file_path in self.schema_dir.glob("schema_v*.yaml"):
            version = file_path.stem.replace("schema_v", "")
            versions.add(version)
        
        for file_path in self.schema_dir.glob("schema_v*.json"):
            version = file_path.stem.replace("schema_v", "")
            versions.add(version)
        
        # メモリから追加
        versions.update(self.schemas.keys())
        
        return sorted(versions)
    
    def _get_latest_version(self) -> str:
        """最新のスキーマバージョンを取得"""
        versions = self.list_versions()
        if not versions:
            raise ValueError("No schema versions found")
        
        # セマンティックバージョニングでソート
        try:
            from packaging import version
            sorted_versions = sorted(versions, key=version.parse, reverse=True)
            return sorted_versions[0]
        except ImportError:
            # packagingが利用できない場合は文字列ソート
            return sorted(versions, reverse=True)[0]
    
    def _load_schema_file(self, file_path: Path) -> Dict[str, Any]:
        """スキーマファイルを読み込み"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                if file_path.suffix == '.yaml' or file_path.suffix == '.yml':
                    return yaml.safe_load(f)
                elif file_path.suffix == '.json':
                    return json.load(f)
                else:
                    raise ValueError(f"Unsupported file format: {file_path.suffix}")
        except Exception as e:
            logger.error(f"Failed to load schema file {file_path}: {e}")
            raise
    
    def create_default_schema(self) -> DWHSchema:
        """
        デフォルトのDWHスキーマを作成
        ECプラットフォーム統合に適したスキーマ
        """
        # 商品テーブル
        product_fields = [
            FieldDefinition(
                name="product_id",
                type=FieldType.STRING,
                nullable=False,
                description="商品ID（プラットフォーム横断で一意）",
                validation_rules={ValidationRule.REQUIRED: True, ValidationRule.MAX_LENGTH: 100},
                source_hints=["id", "product_id", "sku", "asin", "item_code"]
            ),
            FieldDefinition(
                name="source_platform",
                type=FieldType.STRING,
                nullable=False,
                description="データソースプラットフォーム",
                validation_rules={ValidationRule.REQUIRED: True},
                source_hints=["platform", "source"]
            ),
            FieldDefinition(
                name="external_id",
                type=FieldType.STRING,
                nullable=False,
                description="外部システムでの商品ID",
                validation_rules={ValidationRule.REQUIRED: True}
            ),
            FieldDefinition(
                name="title",
                type=FieldType.STRING,
                nullable=False,
                description="商品名",
                validation_rules={ValidationRule.REQUIRED: True, ValidationRule.MAX_LENGTH: 500},
                source_hints=["title", "name", "product_name", "item_name"]
            ),
            FieldDefinition(
                name="description",
                type=FieldType.STRING,
                nullable=True,
                description="商品説明",
                source_hints=["description", "body_html", "product_description"]
            ),
            FieldDefinition(
                name="price",
                type=FieldType.DECIMAL,
                nullable=True,
                description="価格",
                validation_rules={ValidationRule.MIN_VALUE: 0},
                source_hints=["price", "unit_price", "selling_price"]
            ),
            FieldDefinition(
                name="currency",
                type=FieldType.STRING,
                nullable=True,
                default_value="JPY",
                description="通貨コード",
                validation_rules={ValidationRule.MAX_LENGTH: 3},
                source_hints=["currency", "currency_code"]
            ),
            FieldDefinition(
                name="category",
                type=FieldType.STRING,
                nullable=True,
                description="商品カテゴリ",
                source_hints=["category", "product_type", "category_name"]
            ),
            FieldDefinition(
                name="brand",
                type=FieldType.STRING,
                nullable=True,
                description="ブランド",
                source_hints=["brand", "vendor", "manufacturer"]
            ),
            FieldDefinition(
                name="sku",
                type=FieldType.STRING,
                nullable=True,
                description="SKU",
                source_hints=["sku", "variant_sku", "item_code"]
            ),
            FieldDefinition(
                name="inventory_quantity",
                type=FieldType.INTEGER,
                nullable=True,
                description="在庫数量",
                validation_rules={ValidationRule.MIN_VALUE: 0},
                source_hints=["inventory_quantity", "stock", "quantity"]
            ),
            FieldDefinition(
                name="status",
                type=FieldType.STRING,
                nullable=True,
                description="商品ステータス",
                source_hints=["status", "published", "active"]
            ),
            FieldDefinition(
                name="images",
                type=FieldType.JSON,
                nullable=True,
                description="商品画像URLs（JSON配列）"
            ),
            FieldDefinition(
                name="attributes",
                type=FieldType.JSON,
                nullable=True,
                description="その他の属性（JSON）"
            ),
            FieldDefinition(
                name="created_at",
                type=FieldType.DATETIME,
                nullable=True,
                description="作成日時"
            ),
            FieldDefinition(
                name="updated_at",
                type=FieldType.DATETIME,
                nullable=True,
                description="更新日時"
            )
        ]
        
        products_table = TableDefinition(
            name="products",
            fields=product_fields,
            primary_key=["product_id"],
            indexes=[["source_platform"], ["external_id"], ["sku"]],
            description="統合商品マスターテーブル",
            source_tables=["shopify_products", "amazon_products", "rakuten_products", "nextengine_products"]
        )
        
        # 注文テーブル
        order_fields = [
            FieldDefinition(
                name="order_id",
                type=FieldType.STRING,
                nullable=False,
                description="注文ID（プラットフォーム横断で一意）",
                validation_rules={ValidationRule.REQUIRED: True},
                source_hints=["id", "order_id", "order_number"]
            ),
            FieldDefinition(
                name="source_platform",
                type=FieldType.STRING,
                nullable=False,
                description="データソースプラットフォーム",
                validation_rules={ValidationRule.REQUIRED: True}
            ),
            FieldDefinition(
                name="external_id",
                type=FieldType.STRING,
                nullable=False,
                description="外部システムでの注文ID",
                validation_rules={ValidationRule.REQUIRED: True}
            ),
            FieldDefinition(
                name="customer_id",
                type=FieldType.STRING,
                nullable=True,
                description="顧客ID",
                source_hints=["customer_id", "user_id", "buyer_id"]
            ),
            FieldDefinition(
                name="email",
                type=FieldType.STRING,
                nullable=True,
                description="顧客メールアドレス",
                validation_rules={ValidationRule.EMAIL: True},
                source_hints=["email", "customer_email", "billing_email"]
            ),
            FieldDefinition(
                name="total_price",
                type=FieldType.DECIMAL,
                nullable=True,
                description="合計金額",
                validation_rules={ValidationRule.MIN_VALUE: 0},
                source_hints=["total_price", "total", "amount"]
            ),
            FieldDefinition(
                name="subtotal_price",
                type=FieldType.DECIMAL,
                nullable=True,
                description="小計金額",
                source_hints=["subtotal_price", "subtotal"]
            ),
            FieldDefinition(
                name="tax_amount",
                type=FieldType.DECIMAL,
                nullable=True,
                description="税額",
                source_hints=["tax_amount", "total_tax", "tax"]
            ),
            FieldDefinition(
                name="shipping_amount",
                type=FieldType.DECIMAL,
                nullable=True,
                description="送料",
                source_hints=["shipping_amount", "shipping_price", "shipping_cost"]
            ),
            FieldDefinition(
                name="currency",
                type=FieldType.STRING,
                nullable=True,
                default_value="JPY",
                description="通貨コード",
                validation_rules={ValidationRule.MAX_LENGTH: 3}
            ),
            FieldDefinition(
                name="status",
                type=FieldType.STRING,
                nullable=True,
                description="注文ステータス",
                source_hints=["status", "fulfillment_status", "financial_status"]
            ),
            FieldDefinition(
                name="order_date",
                type=FieldType.DATETIME,
                nullable=True,
                description="注文日時",
                source_hints=["created_at", "order_date", "processed_at"]
            ),
            FieldDefinition(
                name="shipping_address",
                type=FieldType.JSON,
                nullable=True,
                description="配送先住所（JSON）"
            ),
            FieldDefinition(
                name="billing_address",
                type=FieldType.JSON,
                nullable=True,
                description="請求先住所（JSON）"
            ),
            FieldDefinition(
                name="line_items",
                type=FieldType.JSON,
                nullable=True,
                description="注文明細（JSON配列）"
            ),
            FieldDefinition(
                name="attributes",
                type=FieldType.JSON,
                nullable=True,
                description="その他の属性（JSON）"
            ),
            FieldDefinition(
                name="created_at",
                type=FieldType.DATETIME,
                nullable=True,
                description="作成日時"
            ),
            FieldDefinition(
                name="updated_at",
                type=FieldType.DATETIME,
                nullable=True,
                description="更新日時"
            )
        ]
        
        orders_table = TableDefinition(
            name="orders",
            fields=order_fields,
            primary_key=["order_id"],
            indexes=[["source_platform"], ["external_id"], ["customer_id"], ["order_date"]],
            description="統合注文テーブル",
            source_tables=["shopify_orders", "amazon_orders", "rakuten_orders", "nextengine_orders"]
        )
        
        # 顧客テーブル
        customer_fields = [
            FieldDefinition(
                name="customer_id",
                type=FieldType.STRING,
                nullable=False,
                description="顧客ID（プラットフォーム横断で一意）",
                validation_rules={ValidationRule.REQUIRED: True}
            ),
            FieldDefinition(
                name="source_platform",
                type=FieldType.STRING,
                nullable=False,
                description="データソースプラットフォーム",
                validation_rules={ValidationRule.REQUIRED: True}
            ),
            FieldDefinition(
                name="external_id",
                type=FieldType.STRING,
                nullable=False,
                description="外部システムでの顧客ID",
                validation_rules={ValidationRule.REQUIRED: True}
            ),
            FieldDefinition(
                name="email",
                type=FieldType.STRING,
                nullable=True,
                description="メールアドレス",
                validation_rules={ValidationRule.EMAIL: True},
                source_hints=["email"]
            ),
            FieldDefinition(
                name="first_name",
                type=FieldType.STRING,
                nullable=True,
                description="名",
                source_hints=["first_name", "given_name"]
            ),
            FieldDefinition(
                name="last_name",
                type=FieldType.STRING,
                nullable=True,
                description="姓",
                source_hints=["last_name", "family_name"]
            ),
            FieldDefinition(
                name="phone",
                type=FieldType.STRING,
                nullable=True,
                description="電話番号",
                validation_rules={ValidationRule.PHONE: True},
                source_hints=["phone"]
            ),
            FieldDefinition(
                name="total_orders",
                type=FieldType.INTEGER,
                nullable=True,
                description="総注文数",
                validation_rules={ValidationRule.MIN_VALUE: 0}
            ),
            FieldDefinition(
                name="total_spent",
                type=FieldType.DECIMAL,
                nullable=True,
                description="総購入金額",
                validation_rules={ValidationRule.MIN_VALUE: 0}
            ),
            FieldDefinition(
                name="addresses",
                type=FieldType.JSON,
                nullable=True,
                description="住所情報（JSON配列）"
            ),
            FieldDefinition(
                name="attributes",
                type=FieldType.JSON,
                nullable=True,
                description="その他の属性（JSON）"
            ),
            FieldDefinition(
                name="created_at",
                type=FieldType.DATETIME,
                nullable=True,
                description="作成日時"
            ),
            FieldDefinition(
                name="updated_at",
                type=FieldType.DATETIME,
                nullable=True,
                description="更新日時"
            )
        ]
        
        customers_table = TableDefinition(
            name="customers",
            fields=customer_fields,
            primary_key=["customer_id"],
            indexes=[["source_platform"], ["external_id"], ["email"]],
            description="統合顧客テーブル",
            source_tables=["shopify_customers", "amazon_customers", "rakuten_customers"]
        )
        
        # スキーマ作成
        schema = DWHSchema(
            version="1.0.0",
            tables=[products_table, orders_table, customers_table],
            metadata={
                "description": "ECプラットフォーム統合DWHスキーマ",
                "author": "Conea AI MCP System",
                "compatible_platforms": ["shopify", "amazon", "rakuten", "nextengine", "csv_upload", "google_sheets"]
            },
            created_at=datetime.now()
        )
        
        return schema