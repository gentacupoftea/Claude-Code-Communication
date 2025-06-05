"""
ベースマッパークラス
データソースからDWHスキーマへのマッピング処理の基底クラス
"""

import logging
import asyncio
from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional, Union, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

from .schema_registry import DWHSchema, TableDefinition, FieldDefinition, FieldType

logger = logging.getLogger(__name__)


class MappingStatus(Enum):
    """マッピング処理の状態"""
    SUCCESS = "success"
    PARTIAL_SUCCESS = "partial_success"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class FieldMappingResult:
    """フィールドマッピング結果"""
    target_field: str
    source_field: Optional[str] = None
    mapped_value: Optional[Any] = None
    original_value: Optional[Any] = None
    status: MappingStatus = MappingStatus.SUCCESS
    error_message: Optional[str] = None
    transformation_applied: Optional[str] = None


@dataclass 
class RecordMappingResult:
    """レコードマッピング結果"""
    source_record: Dict[str, Any]
    mapped_record: Optional[Dict[str, Any]] = None
    field_results: List[FieldMappingResult] = field(default_factory=list)
    status: MappingStatus = MappingStatus.SUCCESS
    error_message: Optional[str] = None
    warnings: List[str] = field(default_factory=list)


@dataclass
class MappingResult:
    """マッピング処理全体の結果"""
    table_name: str
    total_records: int
    successful_records: int = 0
    failed_records: int = 0
    skipped_records: int = 0
    mapped_data: List[Dict[str, Any]] = field(default_factory=list)
    record_results: List[RecordMappingResult] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    processing_time: float = 0.0
    
    @property
    def success_rate(self) -> float:
        """成功率を計算"""
        if self.total_records == 0:
            return 0.0
        return (self.successful_records / self.total_records) * 100


class BaseDataMapper(ABC):
    """
    データマッピング処理の基底クラス
    各データソース用のマッパーはこのクラスを継承する
    """
    
    def __init__(self, 
                 dwh_schema: DWHSchema,
                 source_name: str,
                 strict_mode: bool = False):
        """
        ベースマッパーを初期化
        
        Args:
            dwh_schema: DWHスキーマ
            source_name: データソース名
            strict_mode: 厳密モード（エラー時に処理を停止）
        """
        self.dwh_schema = dwh_schema
        self.source_name = source_name
        self.strict_mode = strict_mode
        
        # キャッシュ
        self._field_mapping_cache: Dict[str, Dict[str, str]] = {}
        self._transformation_cache: Dict[str, Any] = {}
        
        logger.info(f"Initialized {self.__class__.__name__} for source: {source_name}")
    
    @abstractmethod
    def get_field_mappings(self, table_name: str) -> Dict[str, str]:
        """
        フィールドマッピング定義を取得
        
        Args:
            table_name: ターゲットテーブル名
            
        Returns:
            Dict[str, str]: {ターゲットフィールド: ソースフィールド}
        """
        pass
    
    @abstractmethod
    def transform_field_value(self, 
                            source_field: str,
                            target_field: str, 
                            value: Any,
                            target_type: FieldType,
                            record_context: Dict[str, Any]) -> Any:
        """
        フィールド値を変換
        
        Args:
            source_field: ソースフィールド名
            target_field: ターゲットフィールド名
            value: 元の値
            target_type: ターゲットのデータ型
            record_context: レコード全体のコンテキスト
            
        Returns:
            Any: 変換後の値
        """
        pass
    
    async def map_data(self, 
                      source_data: List[Dict[str, Any]], 
                      table_name: str) -> MappingResult:
        """
        データをマッピング
        
        Args:
            source_data: ソースデータ
            table_name: ターゲットテーブル名
            
        Returns:
            MappingResult: マッピング結果
        """
        start_time = datetime.now()
        
        # ターゲットテーブル定義を取得
        table_def = self.dwh_schema.get_table(table_name)
        if not table_def:
            raise ValueError(f"Table '{table_name}' not found in DWH schema")
        
        # フィールドマッピング定義を取得
        field_mappings = self.get_field_mappings(table_name)
        
        result = MappingResult(
            table_name=table_name,
            total_records=len(source_data)
        )
        
        logger.info(f"Starting mapping for table '{table_name}': {len(source_data)} records")
        
        # レコードごとに処理
        for i, source_record in enumerate(source_data):
            try:
                record_result = await self._map_single_record(
                    source_record, table_def, field_mappings
                )
                
                result.record_results.append(record_result)
                
                if record_result.status == MappingStatus.SUCCESS:
                    result.successful_records += 1
                    if record_result.mapped_record:
                        result.mapped_data.append(record_result.mapped_record)
                elif record_result.status == MappingStatus.FAILED:
                    result.failed_records += 1
                    if record_result.error_message:
                        result.errors.append(f"Record {i}: {record_result.error_message}")
                else:
                    result.skipped_records += 1
                
                # 警告を収集
                result.warnings.extend(record_result.warnings)
                
                # 厳密モードでエラーがある場合は処理を停止
                if self.strict_mode and record_result.status == MappingStatus.FAILED:
                    break
                    
            except Exception as e:
                logger.exception(f"Unexpected error mapping record {i}: {e}")
                result.failed_records += 1
                result.errors.append(f"Record {i}: Unexpected error: {str(e)}")
                
                if self.strict_mode:
                    break
        
        # 処理時間を計算
        result.processing_time = (datetime.now() - start_time).total_seconds()
        
        logger.info(f"Mapping completed for table '{table_name}': "
                   f"{result.successful_records}/{result.total_records} successful "
                   f"({result.success_rate:.1f}%)")
        
        return result
    
    async def _map_single_record(self, 
                                source_record: Dict[str, Any],
                                table_def: TableDefinition,
                                field_mappings: Dict[str, str]) -> RecordMappingResult:
        """
        単一レコードをマッピング
        
        Args:
            source_record: ソースレコード
            table_def: テーブル定義
            field_mappings: フィールドマッピング
            
        Returns:
            RecordMappingResult: レコードマッピング結果
        """
        record_result = RecordMappingResult(source_record=source_record)
        mapped_record = {}
        
        try:
            # 各フィールドをマッピング
            for field_def in table_def.fields:
                field_result = await self._map_single_field(
                    field_def, source_record, field_mappings, source_record
                )
                
                record_result.field_results.append(field_result)
                
                # 成功した場合は値を設定
                if field_result.status == MappingStatus.SUCCESS:
                    mapped_record[field_result.target_field] = field_result.mapped_value
                elif field_result.status == MappingStatus.FAILED:
                    # 必須フィールドのエラーはレコード全体をエラーとする
                    if not field_def.nullable and field_def.default_value is None:
                        record_result.status = MappingStatus.FAILED
                        record_result.error_message = f"Required field '{field_def.name}' mapping failed: {field_result.error_message}"
                        return record_result
                    else:
                        # 非必須フィールドのエラーは警告
                        record_result.warnings.append(f"Field '{field_def.name}': {field_result.error_message}")
                        mapped_record[field_result.target_field] = field_def.default_value
            
            record_result.mapped_record = mapped_record
            record_result.status = MappingStatus.SUCCESS
            
        except Exception as e:
            logger.exception(f"Error mapping record: {e}")
            record_result.status = MappingStatus.FAILED
            record_result.error_message = str(e)
        
        return record_result
    
    async def _map_single_field(self,
                               field_def: FieldDefinition,
                               source_record: Dict[str, Any],
                               field_mappings: Dict[str, str],
                               record_context: Dict[str, Any]) -> FieldMappingResult:
        """
        単一フィールドをマッピング
        
        Args:
            field_def: フィールド定義
            source_record: ソースレコード
            field_mappings: フィールドマッピング
            record_context: レコードコンテキスト
            
        Returns:
            FieldMappingResult: フィールドマッピング結果
        """
        target_field = field_def.name
        field_result = FieldMappingResult(target_field=target_field)
        
        try:
            # ソースフィールドを決定
            source_field = field_mappings.get(target_field)
            
            # マッピングが定義されていない場合はヒントから検索
            if not source_field:
                source_field = self._find_source_field(field_def, source_record)
            
            field_result.source_field = source_field
            
            # 値を取得
            if source_field and source_field in source_record:
                original_value = source_record[source_field]
                field_result.original_value = original_value
                
                # 値を変換
                try:
                    mapped_value = self.transform_field_value(
                        source_field, target_field, original_value, 
                        field_def.type, record_context
                    )
                    field_result.mapped_value = mapped_value
                    field_result.status = MappingStatus.SUCCESS
                    
                except Exception as e:
                    logger.warning(f"Field transformation failed for {target_field}: {e}")
                    field_result.status = MappingStatus.FAILED
                    field_result.error_message = f"Transformation failed: {str(e)}"
                    
                    # デフォルト値を使用
                    if field_def.default_value is not None:
                        field_result.mapped_value = field_def.default_value
                        field_result.status = MappingStatus.PARTIAL_SUCCESS
            
            else:
                # ソースにフィールドが存在しない場合
                if field_def.default_value is not None:
                    field_result.mapped_value = field_def.default_value
                    field_result.status = MappingStatus.SUCCESS
                elif field_def.nullable:
                    field_result.mapped_value = None
                    field_result.status = MappingStatus.SUCCESS
                else:
                    field_result.status = MappingStatus.FAILED
                    field_result.error_message = f"Required field '{target_field}' not found in source"
        
        except Exception as e:
            logger.exception(f"Unexpected error mapping field {target_field}: {e}")
            field_result.status = MappingStatus.FAILED
            field_result.error_message = f"Unexpected error: {str(e)}"
        
        return field_result
    
    def _find_source_field(self, 
                          field_def: FieldDefinition, 
                          source_record: Dict[str, Any]) -> Optional[str]:
        """
        ソースフィールドをヒントから検索
        
        Args:
            field_def: フィールド定義
            source_record: ソースレコード
            
        Returns:
            Optional[str]: 見つかったソースフィールド名
        """
        # 直接一致を確認
        if field_def.name in source_record:
            return field_def.name
        
        # ヒントから検索
        for hint in field_def.source_hints:
            if hint in source_record:
                return hint
        
        # 大文字小文字を無視して検索
        source_keys_lower = {key.lower(): key for key in source_record.keys()}
        
        for hint in [field_def.name] + field_def.source_hints:
            if hint.lower() in source_keys_lower:
                return source_keys_lower[hint.lower()]
        
        return None
    
    def _convert_type(self, value: Any, target_type: FieldType) -> Any:
        """
        値を指定されたデータ型に変換
        
        Args:
            value: 変換する値
            target_type: ターゲット型
            
        Returns:
            Any: 変換後の値
        """
        if value is None:
            return None
        
        try:
            if target_type == FieldType.STRING:
                return str(value)
            elif target_type == FieldType.INTEGER:
                if isinstance(value, str):
                    # カンマを除去して数値変換
                    cleaned = value.replace(',', '').strip()
                    return int(float(cleaned))  # 小数点があっても処理
                return int(value)
            elif target_type == FieldType.FLOAT:
                if isinstance(value, str):
                    cleaned = value.replace(',', '').strip()
                    return float(cleaned)
                return float(value)
            elif target_type == FieldType.DECIMAL:
                from decimal import Decimal
                if isinstance(value, str):
                    cleaned = value.replace(',', '').strip()
                    return Decimal(cleaned)
                return Decimal(str(value))
            elif target_type == FieldType.BOOLEAN:
                if isinstance(value, str):
                    return value.lower() in ('true', 'yes', '1', 'on', 'はい')
                return bool(value)
            elif target_type == FieldType.DATE:
                from datetime import datetime
                if isinstance(value, str):
                    # 複数の日付フォーマットを試行
                    formats = ['%Y-%m-%d', '%Y/%m/%d', '%d/%m/%Y', '%m/%d/%Y']
                    for fmt in formats:
                        try:
                            return datetime.strptime(value, fmt).date()
                        except ValueError:
                            continue
                    raise ValueError(f"Could not parse date: {value}")
                return value
            elif target_type == FieldType.DATETIME:
                from datetime import datetime
                if isinstance(value, str):
                    # ISO形式を試行
                    try:
                        return datetime.fromisoformat(value.replace('Z', '+00:00'))
                    except ValueError:
                        # その他のフォーマットを試行
                        formats = [
                            '%Y-%m-%d %H:%M:%S',
                            '%Y-%m-%dT%H:%M:%S',
                            '%Y/%m/%d %H:%M:%S'
                        ]
                        for fmt in formats:
                            try:
                                return datetime.strptime(value, fmt)
                            except ValueError:
                                continue
                        raise ValueError(f"Could not parse datetime: {value}")
                return value
            elif target_type == FieldType.JSON:
                if isinstance(value, str):
                    import json
                    return json.loads(value)
                return value
            else:
                return value
                
        except Exception as e:
            raise ValueError(f"Type conversion failed: {e}")
    
    def validate_mapped_data(self, 
                           mapped_data: List[Dict[str, Any]], 
                           table_def: TableDefinition) -> List[str]:
        """
        マッピング済みデータを検証
        
        Args:
            mapped_data: マッピング済みデータ
            table_def: テーブル定義
            
        Returns:
            List[str]: 検証エラーメッセージ
        """
        errors = []
        
        for i, record in enumerate(mapped_data):
            for field_def in table_def.fields:
                field_name = field_def.name
                value = record.get(field_name)
                
                # 必須チェック
                if not field_def.nullable and value is None:
                    errors.append(f"Record {i}: Required field '{field_name}' is null")
                
                # バリデーションルールをチェック
                if value is not None:
                    field_errors = self._validate_field_value(value, field_def, i)
                    errors.extend(field_errors)
        
        return errors
    
    def _validate_field_value(self, 
                             value: Any, 
                             field_def: FieldDefinition, 
                             record_index: int) -> List[str]:
        """
        フィールド値を検証
        
        Args:
            value: 検証する値
            field_def: フィールド定義
            record_index: レコードインデックス
            
        Returns:
            List[str]: エラーメッセージ
        """
        errors = []
        field_name = field_def.name
        
        try:
            from .schema_registry import ValidationRule
            
            for rule, rule_value in field_def.validation_rules.items():
                if rule == ValidationRule.MIN_LENGTH and isinstance(value, str):
                    if len(value) < rule_value:
                        errors.append(f"Record {record_index}: Field '{field_name}' too short (min: {rule_value})")
                
                elif rule == ValidationRule.MAX_LENGTH and isinstance(value, str):
                    if len(value) > rule_value:
                        errors.append(f"Record {record_index}: Field '{field_name}' too long (max: {rule_value})")
                
                elif rule == ValidationRule.MIN_VALUE and isinstance(value, (int, float)):
                    if value < rule_value:
                        errors.append(f"Record {record_index}: Field '{field_name}' too small (min: {rule_value})")
                
                elif rule == ValidationRule.MAX_VALUE and isinstance(value, (int, float)):
                    if value > rule_value:
                        errors.append(f"Record {record_index}: Field '{field_name}' too large (max: {rule_value})")
                
                elif rule == ValidationRule.EMAIL and isinstance(value, str):
                    import re
                    email_pattern = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
                    if not email_pattern.match(value):
                        errors.append(f"Record {record_index}: Field '{field_name}' invalid email format")
                
                elif rule == ValidationRule.REGEX and isinstance(value, str):
                    import re
                    if not re.match(rule_value, value):
                        errors.append(f"Record {record_index}: Field '{field_name}' does not match pattern")
        
        except Exception as e:
            logger.warning(f"Validation error for field {field_name}: {e}")
        
        return errors