"""
ファイルデータマッパー
CSV/ExcelファイルからのデータをDWHスキーマにマッピング
"""
import logging
from typing import Dict, List, Any, Optional, Union
from datetime import datetime, timezone
from decimal import Decimal
import re

from ..base_mapper import BaseDataMapper, MappingResult, MappingError
from ..schema_registry import SchemaRegistry

logger = logging.getLogger(__name__)


class FileDataMapper(BaseDataMapper):
    """ファイルデータ専用マッパー"""
    
    def __init__(self, schema_registry: SchemaRegistry):
        super().__init__(schema_registry)
        self.data_source = "file_import"
        
        # 一般的なフィールド名パターンマッピング
        self.common_field_patterns = {
            # 商品関連
            "product": {
                r"^(id|商品id|product_?id|item_?id|goods_?id)$": "external_id",
                r"^(name|商品名|product_?name|item_?name|title|タイトル)$": "name",
                r"^(description|説明|詳細|商品説明|product_?description)$": "description",
                r"^(price|価格|単価|金額|product_?price)$": "price",
                r"^(sku|商品コード|product_?code|item_?code)$": "sku",
                r"^(category|カテゴリ|分類|product_?category)$": "category",
                r"^(brand|ブランド|メーカー|manufacturer|maker)$": "brand",
                r"^(stock|在庫|inventory|在庫数|stock_?quantity)$": "inventory_quantity",
                r"^(status|ステータス|状態|display)$": "status",
                r"^(tags|タグ|キーワード|keywords)$": "tags",
                r"^(created|作成日|登録日|created_?at|created_?date)$": "created_at",
                r"^(updated|更新日|modified|updated_?at|modified_?date)$": "updated_at"
            },
            # 注文関連
            "order": {
                r"^(id|order_?id|注文id|受注id)$": "external_id",
                r"^(order_?number|注文番号|受注番号)$": "order_number",
                r"^(date|order_?date|注文日|受注日|purchase_?date)$": "order_date",
                r"^(total|合計|total_?amount|order_?total)$": "total_amount",
                r"^(subtotal|小計|subtotal_?amount)$": "subtotal_amount",
                r"^(tax|税額|tax_?amount|消費税)$": "tax_amount",
                r"^(shipping|送料|delivery_?fee|shipping_?amount)$": "shipping_amount",
                r"^(currency|通貨|通貨コード)$": "currency",
                r"^(status|ステータス|状態|order_?status)$": "status",
                r"^(payment|支払|payment_?method|支払方法)$": "payment_method",
                r"^(customer|顧客|customer_?name|お客様名)$": "customer_name",
                r"^(email|メール|customer_?email|顧客email)$": "customer_email",
                r"^(updated|更新日|modified|updated_?at)$": "updated_at"
            },
            # 顧客関連
            "customer": {
                r"^(id|customer_?id|顧客id)$": "external_id",
                r"^(name|氏名|顧客名|customer_?name|お客様名)$": "name",
                r"^(first_?name|名|名前)$": "first_name",
                r"^(last_?name|姓|苗字)$": "last_name",
                r"^(email|メール|customer_?email)$": "email",
                r"^(phone|電話|tel|customer_?phone|電話番号)$": "phone",
                r"^(address|住所|customer_?address)$": "address",
                r"^(zip|郵便番号|postal_?code|zipcode)$": "zip",
                r"^(country|国|国名)$": "country",
                r"^(province|都道府県|state|県)$": "province",
                r"^(city|市区町村|city_?name)$": "city",
                r"^(created|登録日|created_?at|created_?date)$": "created_at",
                r"^(updated|更新日|modified|updated_?at)$": "updated_at"
            }
        }

    async def map_data(self, source_data: List[Dict[str, Any]], table_name: str, 
                      column_mapping: Optional[Dict[str, str]] = None,
                      auto_detect: bool = True) -> MappingResult:
        """
        ファイルデータをDWHスキーマにマッピング
        
        Args:
            source_data: ソースデータ
            table_name: 対象テーブル名
            column_mapping: カラムマッピング定義（手動設定）
            auto_detect: 自動検出を有効にするか
        """
        try:
            if not source_data:
                return MappingResult(
                    mapped_data=[],
                    errors=[],
                    total_records=0,
                    successful_records=0
                )
            
            # カラムマッピングの決定
            if column_mapping:
                # 手動設定を優先
                field_mapping = column_mapping
            elif auto_detect:
                # 自動検出
                field_mapping = self._auto_detect_field_mapping(source_data[0], table_name)
            else:
                # そのまま使用
                field_mapping = {k: k for k in source_data[0].keys()}
            
            logger.info(f"ファイルマッピング開始: テーブル={table_name}, レコード数={len(source_data)}, マッピング={field_mapping}")
            
            mapped_records = []
            errors = []
            
            for i, record in enumerate(source_data):
                try:
                    mapped_record = await self._map_single_record(record, field_mapping, table_name)
                    mapped_records.append(mapped_record)
                except Exception as e:
                    error = MappingError(
                        field="record",
                        value=str(i),
                        error_type="mapping_error",
                        message=str(e)
                    )
                    errors.append(error)
                    logger.error(f"レコードマッピングエラー (行{i+1}): {e}")
            
            return MappingResult(
                mapped_data=mapped_records,
                errors=errors,
                total_records=len(source_data),
                successful_records=len(mapped_records)
            )
            
        except Exception as e:
            logger.error(f"ファイルマッピング処理エラー: {e}")
            raise

    def _auto_detect_field_mapping(self, sample_record: Dict[str, Any], table_name: str) -> Dict[str, str]:
        """カラム名からフィールドマッピングを自動検出"""
        patterns = self.common_field_patterns.get(table_name, {})
        mapping = {}
        
        for column_name in sample_record.keys():
            normalized_name = self._normalize_column_name(column_name)
            
            # パターンマッチング
            mapped_field = None
            for pattern, field in patterns.items():
                if re.match(pattern, normalized_name, re.IGNORECASE):
                    mapped_field = field
                    break
            
            if mapped_field:
                mapping[column_name] = mapped_field
            else:
                # マッチしない場合はそのまま使用
                mapping[column_name] = normalized_name
        
        logger.info(f"自動検出されたマッピング: {mapping}")
        return mapping

    def _normalize_column_name(self, column_name: str) -> str:
        """カラム名の正規化"""
        if not column_name:
            return ""
        
        # 日本語と英語の混在に対応
        normalized = column_name.strip().lower()
        
        # 特殊文字を除去
        normalized = re.sub(r'[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]', '_', normalized)
        
        # 連続するアンダースコアを単一に
        normalized = re.sub(r'_+', '_', normalized)
        
        # 前後のアンダースコアを除去
        normalized = normalized.strip('_')
        
        return normalized

    async def _map_single_record(self, record: Dict[str, Any], 
                                field_mapping: Dict[str, str], 
                                table_name: str) -> Dict[str, Any]:
        """単一レコードのマッピング処理"""
        mapped = {}
        
        # 基本フィールドのマッピング
        for source_field, target_field in field_mapping.items():
            if source_field in record:
                value = record[source_field]
                mapped[target_field] = self._convert_field_value(value, target_field)
        
        # ファイルインポート固有の処理
        mapped["data_source"] = self.data_source
        
        # 日付フィールドの処理
        for date_field in ["created_at", "updated_at", "order_date"]:
            if date_field in mapped and mapped[date_field]:
                mapped[date_field] = self._parse_file_date(mapped[date_field])
        
        # 金額フィールドの処理
        for amount_field in ["price", "total_amount", "subtotal_amount", "tax_amount", "shipping_amount"]:
            if amount_field in mapped and mapped[amount_field] is not None:
                mapped[amount_field] = self._parse_decimal(mapped[amount_field])
        
        # 整数フィールドの処理
        for int_field in ["inventory_quantity", "total_orders"]:
            if int_field in mapped and mapped[int_field] is not None:
                mapped[int_field] = self._parse_integer(mapped[int_field])
        
        # ブールフィールドの処理
        for bool_field in ["is_active"]:
            if bool_field in mapped and mapped[bool_field] is not None:
                mapped[bool_field] = self._parse_boolean(mapped[bool_field])
        
        # タグフィールドの処理
        if "tags" in mapped and mapped["tags"]:
            mapped["tags"] = self._process_file_tags(mapped["tags"])
        
        # ステータスの正規化
        if "status" in mapped and mapped["status"]:
            mapped["status"] = self._normalize_file_status(mapped["status"])
        
        # デフォルト値の設定
        self._set_default_values(mapped, table_name)
        
        return mapped

    def _convert_field_value(self, value: Any, field_name: str) -> Any:
        """フィールド値の基本変換"""
        if value is None or value == "":
            return None
        
        # 文字列の場合は前後の空白を除去
        if isinstance(value, str):
            value = value.strip()
            if value == "":
                return None
        
        return value

    def _parse_file_date(self, date_value: Any) -> Optional[datetime]:
        """ファイルの日付値をdatetimeに変換"""
        if not date_value:
            return None
        
        if isinstance(date_value, datetime):
            return date_value
        
        date_str = str(date_value).strip()
        if not date_str:
            return None
        
        # 様々な日付フォーマットに対応
        date_formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
            "%Y/%m/%d",
            "%m/%d/%Y %H:%M:%S",
            "%m/%d/%Y %H:%M",
            "%m/%d/%Y",
            "%d/%m/%Y %H:%M:%S",
            "%d/%m/%Y %H:%M",
            "%d/%m/%Y",
            "%Y年%m月%d日 %H:%M:%S",
            "%Y年%m月%d日 %H:%M",
            "%Y年%m月%d日"
        ]
        
        for fmt in date_formats:
            try:
                dt = datetime.strptime(date_str, fmt)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt
            except ValueError:
                continue
        
        logger.warning(f"日付解析に失敗: {date_value}")
        return None

    def _parse_decimal(self, value: Any) -> Optional[Decimal]:
        """数値をDecimalに変換"""
        if value is None:
            return None
        
        try:
            # 文字列の場合、カンマやカンマ、通貨記号を除去
            if isinstance(value, str):
                # 通貨記号や区切り文字を除去
                cleaned = re.sub(r'[^\d.-]', '', value)
                if not cleaned:
                    return None
                value = cleaned
            
            return Decimal(str(value))
        except (ValueError, TypeError, InvalidOperation):
            logger.warning(f"数値変換エラー: {value}")
            return None

    def _parse_integer(self, value: Any) -> Optional[int]:
        """整数に変換"""
        if value is None:
            return None
        
        try:
            # 小数点がある場合は整数部分を取得
            if isinstance(value, str):
                cleaned = re.sub(r'[^\d.-]', '', value)
                if not cleaned:
                    return None
                value = float(cleaned)
            
            return int(float(value))
        except (ValueError, TypeError):
            logger.warning(f"整数変換エラー: {value}")
            return 0

    def _parse_boolean(self, value: Any) -> bool:
        """ブール値に変換"""
        if value is None:
            return False
        
        if isinstance(value, bool):
            return value
        
        str_value = str(value).lower().strip()
        
        # True値のパターン
        true_values = {"true", "yes", "y", "1", "on", "有効", "はい", "○", "✓"}
        # False値のパターン
        false_values = {"false", "no", "n", "0", "off", "無効", "いいえ", "×", ""}
        
        if str_value in true_values:
            return True
        elif str_value in false_values:
            return False
        else:
            # デフォルトはFalse
            return False

    def _process_file_tags(self, tags_value: Any) -> List[str]:
        """タグ値をリストに変換"""
        if not tags_value:
            return []
        
        if isinstance(tags_value, list):
            return [str(tag).strip() for tag in tags_value if tag]
        
        tags_str = str(tags_value)
        
        # 様々な区切り文字に対応
        delimiters = [',', ';', '|', '\n', '\t']
        for delimiter in delimiters:
            if delimiter in tags_str:
                tags = [tag.strip() for tag in tags_str.split(delimiter)]
                return [tag for tag in tags if tag]
        
        # 区切り文字がない場合はスペースで分割
        return [tag.strip() for tag in tags_str.split() if tag.strip()]

    def _normalize_file_status(self, status_value: Any) -> str:
        """ステータス値の正規化"""
        if not status_value:
            return "unknown"
        
        status_str = str(status_value).lower().strip()
        
        # 一般的なステータスマッピング
        status_mapping = {
            # 英語
            "active": "active",
            "inactive": "inactive",
            "enabled": "active",
            "disabled": "inactive",
            "published": "active",
            "unpublished": "inactive",
            "draft": "draft",
            "pending": "pending",
            "completed": "completed",
            "cancelled": "cancelled",
            "canceled": "cancelled",
            # 日本語
            "有効": "active",
            "無効": "inactive",
            "公開": "active",
            "非公開": "inactive",
            "下書き": "draft",
            "保留": "pending",
            "完了": "completed",
            "キャンセル": "cancelled",
            # 数値
            "1": "active",
            "0": "inactive",
            # 記号
            "○": "active",
            "×": "inactive",
            "✓": "active"
        }
        
        return status_mapping.get(status_str, status_str)

    def _set_default_values(self, mapped: Dict[str, Any], table_name: str):
        """デフォルト値の設定"""
        current_time = datetime.now(timezone.utc)
        
        # 共通デフォルト値
        if "created_at" not in mapped or mapped["created_at"] is None:
            mapped["created_at"] = current_time
        
        if "updated_at" not in mapped or mapped["updated_at"] is None:
            mapped["updated_at"] = current_time
        
        # テーブル固有のデフォルト値
        if table_name == "products":
            if "status" not in mapped or mapped["status"] is None:
                mapped["status"] = "active"
            if "inventory_quantity" not in mapped:
                mapped["inventory_quantity"] = 0
            if "tags" not in mapped:
                mapped["tags"] = []
                
        elif table_name == "orders":
            if "currency" not in mapped or mapped["currency"] is None:
                mapped["currency"] = "JPY"
            if "payment_status" not in mapped:
                mapped["payment_status"] = "unknown"
            if "fulfillment_status" not in mapped:
                mapped["fulfillment_status"] = "unfulfilled"
                
        elif table_name == "customers":
            if "total_orders" not in mapped:
                mapped["total_orders"] = 0
            if "total_spent" not in mapped:
                mapped["total_spent"] = Decimal('0')

    def get_suggested_mappings(self, sample_data: Dict[str, Any], table_name: str) -> Dict[str, List[str]]:
        """マッピング候補を提案"""
        suggestions = {}
        patterns = self.common_field_patterns.get(table_name, {})
        
        for source_field in sample_data.keys():
            normalized_name = self._normalize_column_name(source_field)
            candidates = []
            
            # パターンマッチングで候補を検索
            for pattern, target_field in patterns.items():
                if re.match(pattern, normalized_name, re.IGNORECASE):
                    candidates.append(target_field)
            
            if candidates:
                suggestions[source_field] = candidates
            
        return suggestions