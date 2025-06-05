"""
Googleスプレッドシートデータマッパー
GoogleスプレッドシートからのデータをDWHスキーマにマッピング
"""
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone
from decimal import Decimal

from ..base_mapper import BaseDataMapper, MappingResult, MappingError
from ..schema_registry import SchemaRegistry
from .file_mapper import FileDataMapper

logger = logging.getLogger(__name__)


class GoogleSheetsMapper(BaseDataMapper):
    """Googleスプレッドシート データ専用マッパー"""
    
    def __init__(self, schema_registry: SchemaRegistry):
        super().__init__(schema_registry)
        self.data_source = "google_sheets"
        
        # ファイルマッパーのロジックを再利用
        self.file_mapper = FileDataMapper(schema_registry)
        
        # Googleスプレッドシート固有の設定
        self.sheet_metadata = {}

    async def map_sheet_data(self, sheet_data: Dict[str, Any], 
                           table_name: str,
                           column_mapping: Optional[Dict[str, str]] = None,
                           auto_detect: bool = True) -> MappingResult:
        """
        Googleスプレッドシートデータをマッピング
        
        Args:
            sheet_data: スプレッドシートデータ（メタデータ含む）
            table_name: 対象テーブル名
            column_mapping: カラムマッピング定義
            auto_detect: 自動検出を有効にするか
        """
        try:
            # メタデータの保存
            self.sheet_metadata = {
                "spreadsheet_id": sheet_data.get("spreadsheet_id"),
                "sheet_name": sheet_data.get("sheet_name"),
                "range": sheet_data.get("range"),
                "last_modified": sheet_data.get("last_modified"),
                "total_rows": sheet_data.get("total_rows"),
                "total_columns": sheet_data.get("total_columns")
            }
            
            # データ部分を取得
            records = sheet_data.get("data", [])
            if not records:
                return MappingResult(
                    mapped_data=[],
                    errors=[],
                    total_records=0,
                    successful_records=0
                )
            
            logger.info(f"Googleスプレッドシートマッピング開始: {self.sheet_metadata}")
            
            # ファイルマッパーのロジックを使用してマッピング
            mapping_result = await self.file_mapper.map_data(
                source_data=records,
                table_name=table_name,
                column_mapping=column_mapping,
                auto_detect=auto_detect
            )
            
            # Googleスプレッドシート固有の後処理
            for mapped_record in mapping_result.mapped_data:
                await self._apply_sheets_specific_processing(mapped_record)
            
            logger.info(f"Googleスプレッドシートマッピング完了: 成功={mapping_result.successful_records}, エラー={len(mapping_result.errors)}")
            
            return mapping_result
            
        except Exception as e:
            logger.error(f"Googleスプレッドシートマッピング処理エラー: {e}")
            raise

    async def _apply_sheets_specific_processing(self, mapped_record: Dict[str, Any]):
        """Googleスプレッドシート固有の後処理"""
        # データソースをGoogleスプレッドシートに変更
        mapped_record["data_source"] = self.data_source
        
        # スプレッドシート情報の追加
        mapped_record["_source_metadata"] = {
            "spreadsheet_id": self.sheet_metadata.get("spreadsheet_id"),
            "sheet_name": self.sheet_metadata.get("sheet_name"),
            "range": self.sheet_metadata.get("range"),
            "imported_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Googleスプレッドシート特有のデータ処理
        await self._process_sheets_formulas(mapped_record)
        await self._process_sheets_links(mapped_record)

    async def _process_sheets_formulas(self, mapped_record: Dict[str, Any]):
        """スプレッドシートの数式結果を処理"""
        # 数式の結果値を適切に処理
        for field_name, value in mapped_record.items():
            if isinstance(value, str) and value.startswith("="):
                # 数式の場合は警告ログを出力（数式結果が取得されているはず）
                logger.warning(f"数式が検出されました: {field_name} = {value}")
                # 数式文字列は空値として扱う
                mapped_record[field_name] = None

    async def _process_sheets_links(self, mapped_record: Dict[str, Any]):
        """スプレッドシートのリンクを処理"""
        # URL形式の値を検出してリンクフィールドとして処理
        for field_name, value in mapped_record.items():
            if isinstance(value, str) and (value.startswith("http://") or value.startswith("https://")):
                # URLの場合は専用フィールドを作成
                mapped_record[f"{field_name}_url"] = value
                
                # 元のフィールドがimage関連の場合は画像URLとして設定
                if "image" in field_name.lower() or "photo" in field_name.lower():
                    mapped_record["image_url"] = value

    def get_sheet_mapping_suggestions(self, sheet_data: Dict[str, Any], 
                                    table_name: str) -> Dict[str, Any]:
        """
        スプレッドシートのカラムマッピング候補を提案
        
        Returns:
            マッピング提案情報
        """
        records = sheet_data.get("data", [])
        if not records:
            return {"suggestions": {}, "confidence": 0}
        
        sample_record = records[0]
        
        # ファイルマッパーの提案機能を使用
        suggestions = self.file_mapper.get_suggested_mappings(sample_record, table_name)
        
        # Googleスプレッドシート固有の分析を追加
        analysis = self._analyze_sheet_structure(sheet_data, sample_record)
        
        return {
            "suggestions": suggestions,
            "analysis": analysis,
            "confidence": self._calculate_mapping_confidence(suggestions, sample_record),
            "metadata": self.sheet_metadata
        }

    def _analyze_sheet_structure(self, sheet_data: Dict[str, Any], 
                                sample_record: Dict[str, Any]) -> Dict[str, Any]:
        """スプレッドシートの構造を分析"""
        analysis = {
            "total_columns": len(sample_record),
            "column_names": list(sample_record.keys()),
            "data_types": {},
            "has_formulas": False,
            "has_links": False,
            "empty_columns": []
        }
        
        # 各カラムのデータ型を分析
        records = sheet_data.get("data", [])
        for column_name in sample_record.keys():
            values = [record.get(column_name) for record in records[:10]]  # 最初の10行をサンプル
            analysis["data_types"][column_name] = self._detect_column_type(values)
            
            # 空のカラムを検出
            if all(v is None or v == "" for v in values):
                analysis["empty_columns"].append(column_name)
            
            # 数式やリンクの検出
            for value in values:
                if isinstance(value, str):
                    if value.startswith("="):
                        analysis["has_formulas"] = True
                    if value.startswith("http"):
                        analysis["has_links"] = True
        
        return analysis

    def _detect_column_type(self, values: List[Any]) -> str:
        """カラムのデータ型を検出"""
        non_empty_values = [v for v in values if v is not None and v != ""]
        
        if not non_empty_values:
            return "empty"
        
        # データ型の統計
        type_counts = {}
        for value in non_empty_values:
            value_type = self._get_value_type(value)
            type_counts[value_type] = type_counts.get(value_type, 0) + 1
        
        # 最も多いデータ型を返す
        return max(type_counts, key=type_counts.get) if type_counts else "unknown"

    def _get_value_type(self, value: Any) -> str:
        """値のデータ型を判定"""
        if isinstance(value, bool):
            return "boolean"
        elif isinstance(value, int):
            return "integer"
        elif isinstance(value, float):
            return "decimal"
        elif isinstance(value, str):
            value = value.strip()
            
            # 数値かどうかチェック
            try:
                float(value.replace(",", ""))
                return "decimal" if "." in value else "integer"
            except ValueError:
                pass
            
            # 日付かどうかチェック
            if self._is_date_string(value):
                return "date"
            
            # URLかどうかチェック
            if value.startswith("http"):
                return "url"
            
            # 数式かどうかチェック
            if value.startswith("="):
                return "formula"
            
            return "text"
        else:
            return "unknown"

    def _is_date_string(self, value: str) -> bool:
        """文字列が日付かどうか判定"""
        date_patterns = [
            r'\d{4}-\d{2}-\d{2}',
            r'\d{4}/\d{2}/\d{2}',
            r'\d{2}/\d{2}/\d{4}',
            r'\d{4}年\d{1,2}月\d{1,2}日'
        ]
        
        import re
        for pattern in date_patterns:
            if re.match(pattern, value):
                return True
        return False

    def _calculate_mapping_confidence(self, suggestions: Dict[str, List[str]], 
                                    sample_record: Dict[str, Any]) -> float:
        """マッピングの信頼度を計算"""
        total_columns = len(sample_record)
        if total_columns == 0:
            return 0.0
        
        mapped_columns = len(suggestions)
        confidence = mapped_columns / total_columns
        
        # 重要フィールドがマッピングされている場合はボーナス
        important_fields = ["id", "name", "email", "price", "total_amount"]
        bonus = 0
        for column_suggestions in suggestions.values():
            for suggestion in column_suggestions:
                if any(important in suggestion for important in important_fields):
                    bonus += 0.1
                    break
        
        return min(confidence + bonus, 1.0)

    async def map_data(self, source_data: List[Dict[str, Any]], table_name: str) -> MappingResult:
        """データマッピングのメインメソッド（BaseDataMapperインターフェース）"""
        # 通常のリストデータの場合はファイルマッパーに委譲
        return await self.file_mapper.map_data(source_data, table_name)

    def create_mapping_template(self, sheet_data: Dict[str, Any], 
                              table_name: str) -> Dict[str, Any]:
        """マッピング設定のテンプレートを作成"""
        suggestions_data = self.get_sheet_mapping_suggestions(sheet_data, table_name)
        
        template = {
            "spreadsheet_id": sheet_data.get("spreadsheet_id"),
            "sheet_name": sheet_data.get("sheet_name"),
            "table_name": table_name,
            "mapping": {},
            "settings": {
                "auto_detect": True,
                "skip_empty_rows": True,
                "header_row": 1,
                "data_start_row": 2
            },
            "suggestions": suggestions_data["suggestions"],
            "analysis": suggestions_data["analysis"]
        }
        
        # デフォルトマッピングを設定
        for column_name, suggestions in suggestions_data["suggestions"].items():
            if suggestions:
                template["mapping"][column_name] = suggestions[0]
        
        return template