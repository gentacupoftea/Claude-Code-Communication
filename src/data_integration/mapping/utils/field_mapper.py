"""
フィールドマッパー
フィールドマッピング処理を提供
"""
import logging
import re
from typing import Dict, List, Any, Optional, Union, Callable
from enum import Enum
from dataclasses import dataclass

logger = logging.getLogger(__name__)


class MappingStrategy(Enum):
    """マッピング戦略"""
    EXACT_MATCH = "exact_match"
    CASE_INSENSITIVE = "case_insensitive"
    FUZZY_MATCH = "fuzzy_match"
    PATTERN_MATCH = "pattern_match"
    AUTO_DETECT = "auto_detect"


@dataclass
class FieldMapping:
    """フィールドマッピング定義"""
    source_field: str
    target_field: str
    converter: Optional[Callable[[Any], Any]] = None
    default_value: Any = None
    required: bool = False
    description: Optional[str] = None


class FieldMapper:
    """フィールドマッピングクラス"""
    
    def __init__(self):
        self.mappings: Dict[str, FieldMapping] = {}
        self.similarity_threshold = 0.8
        
        # 一般的なフィールド名パターン
        self.common_patterns = {
            "id": [
                r"^(id|識別子|identifier)$",
                r".*_?id$",
                r"^(primary_?key|pk)$"
            ],
            "name": [
                r"^(name|名前|氏名|title|タイトル)$",
                r".*_?name$",
                r".*_?title$"
            ],
            "email": [
                r"^(email|メール|mail|e_?mail).*$"
            ],
            "phone": [
                r"^(phone|電話|tel|telephone).*$"
            ],
            "address": [
                r"^(address|住所|addr).*$"
            ],
            "price": [
                r"^(price|価格|金額|amount|料金).*$"
            ],
            "date": [
                r"^(date|日付|datetime|timestamp).*$",
                r".*_(date|at)$"
            ]
        }

    def add_mapping(self, mapping: FieldMapping):
        """マッピングを追加"""
        self.mappings[mapping.source_field] = mapping
        logger.debug(f"フィールドマッピングを追加: {mapping.source_field} -> {mapping.target_field}")

    def remove_mapping(self, source_field: str):
        """マッピングを削除"""
        if source_field in self.mappings:
            del self.mappings[source_field]
            logger.debug(f"フィールドマッピングを削除: {source_field}")

    def clear_mappings(self):
        """全てのマッピングをクリア"""
        self.mappings.clear()
        logger.debug("全てのフィールドマッピングをクリア")

    def map_fields(self, source_data: Dict[str, Any], 
                   strategy: MappingStrategy = MappingStrategy.EXACT_MATCH) -> Dict[str, Any]:
        """
        フィールドマッピングを実行
        
        Args:
            source_data: ソースデータ
            strategy: マッピング戦略
            
        Returns:
            マッピング済みデータ
        """
        mapped_data = {}
        
        for source_field, value in source_data.items():
            target_field = self._find_target_field(source_field, strategy)
            
            if target_field:
                mapping = self.mappings.get(source_field)
                if mapping and mapping.converter:
                    try:
                        converted_value = mapping.converter(value)
                        mapped_data[target_field] = converted_value
                    except Exception as e:
                        logger.warning(f"フィールド変換エラー: {source_field} -> {target_field}, {e}")
                        mapped_data[target_field] = value
                else:
                    mapped_data[target_field] = value
            else:
                # マッピングが見つからない場合はそのまま
                mapped_data[source_field] = value
        
        # 必須フィールドのデフォルト値設定
        self._apply_default_values(mapped_data)
        
        return mapped_data

    def _find_target_field(self, source_field: str, strategy: MappingStrategy) -> Optional[str]:
        """ターゲットフィールドを検索"""
        # 直接マッピングがある場合
        if source_field in self.mappings:
            return self.mappings[source_field].target_field
        
        # 戦略に応じた検索
        if strategy == MappingStrategy.EXACT_MATCH:
            return None
        elif strategy == MappingStrategy.CASE_INSENSITIVE:
            return self._find_case_insensitive_match(source_field)
        elif strategy == MappingStrategy.FUZZY_MATCH:
            return self._find_fuzzy_match(source_field)
        elif strategy == MappingStrategy.PATTERN_MATCH:
            return self._find_pattern_match(source_field)
        elif strategy == MappingStrategy.AUTO_DETECT:
            return self._auto_detect_field(source_field)
        
        return None

    def _find_case_insensitive_match(self, source_field: str) -> Optional[str]:
        """大文字小文字を無視してマッチング"""
        source_lower = source_field.lower()
        for mapped_source, mapping in self.mappings.items():
            if mapped_source.lower() == source_lower:
                return mapping.target_field
        return None

    def _find_fuzzy_match(self, source_field: str) -> Optional[str]:
        """あいまいマッチング"""
        best_match = None
        best_similarity = 0
        
        for mapped_source, mapping in self.mappings.items():
            similarity = self._calculate_similarity(source_field, mapped_source)
            if similarity > best_similarity and similarity >= self.similarity_threshold:
                best_similarity = similarity
                best_match = mapping.target_field
        
        return best_match

    def _find_pattern_match(self, source_field: str) -> Optional[str]:
        """パターンマッチング"""
        normalized_field = self._normalize_field_name(source_field)
        
        for target_pattern, patterns in self.common_patterns.items():
            for pattern in patterns:
                if re.match(pattern, normalized_field, re.IGNORECASE):
                    return target_pattern
        
        return None

    def _auto_detect_field(self, source_field: str) -> Optional[str]:
        """自動検出"""
        # パターンマッチングを優先
        pattern_match = self._find_pattern_match(source_field)
        if pattern_match:
            return pattern_match
        
        # あいまいマッチングを試行
        fuzzy_match = self._find_fuzzy_match(source_field)
        if fuzzy_match:
            return fuzzy_match
        
        # 大文字小文字を無視したマッチング
        case_match = self._find_case_insensitive_match(source_field)
        if case_match:
            return case_match
        
        return None

    def _normalize_field_name(self, field_name: str) -> str:
        """フィールド名を正規化"""
        # 全角英数字を半角に変換
        normalized = field_name.translate(str.maketrans(
            'ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ０１２３４５６７８９',
            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        ))
        
        # 特殊文字をアンダースコアに変換
        normalized = re.sub(r'[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]', '_', normalized)
        
        # 連続するアンダースコアを単一に
        normalized = re.sub(r'_+', '_', normalized)
        
        # 前後のアンダースコアを除去
        return normalized.strip('_').lower()

    def _calculate_similarity(self, str1: str, str2: str) -> float:
        """文字列の類似度を計算（Levenshtein距離ベース）"""
        if str1 == str2:
            return 1.0
        
        len1, len2 = len(str1), len(str2)
        if len1 == 0 or len2 == 0:
            return 0.0
        
        # 動的計画法でLevenshtein距離を計算
        dp = [[0] * (len2 + 1) for _ in range(len1 + 1)]
        
        for i in range(len1 + 1):
            dp[i][0] = i
        for j in range(len2 + 1):
            dp[0][j] = j
        
        for i in range(1, len1 + 1):
            for j in range(1, len2 + 1):
                cost = 0 if str1[i-1] == str2[j-1] else 1
                dp[i][j] = min(
                    dp[i-1][j] + 1,      # 削除
                    dp[i][j-1] + 1,      # 挿入
                    dp[i-1][j-1] + cost  # 置換
                )
        
        distance = dp[len1][len2]
        return 1.0 - (distance / max(len1, len2))

    def _apply_default_values(self, mapped_data: Dict[str, Any]):
        """デフォルト値を適用"""
        for mapping in self.mappings.values():
            if mapping.required and mapping.target_field not in mapped_data:
                if mapping.default_value is not None:
                    mapped_data[mapping.target_field] = mapping.default_value
                else:
                    logger.warning(f"必須フィールドが見つかりません: {mapping.target_field}")

    def create_mapping_from_sample(self, sample_data: Dict[str, Any], 
                                  target_schema: Dict[str, Any]) -> List[FieldMapping]:
        """サンプルデータからマッピングを作成"""
        suggested_mappings = []
        
        for source_field in sample_data.keys():
            # 自動検出を試行
            target_field = self._auto_detect_field(source_field)
            
            if target_field and target_field in target_schema:
                mapping = FieldMapping(
                    source_field=source_field,
                    target_field=target_field,
                    description=f"自動検出: {source_field} -> {target_field}"
                )
                suggested_mappings.append(mapping)
        
        return suggested_mappings

    def validate_mapping(self, source_data: Dict[str, Any]) -> List[str]:
        """マッピングの検証"""
        errors = []
        
        # 必須フィールドのチェック
        for mapping in self.mappings.values():
            if mapping.required and mapping.source_field not in source_data:
                if mapping.default_value is None:
                    errors.append(f"必須フィールドが見つかりません: {mapping.source_field}")
        
        # ソースフィールドの存在チェック
        for source_field in self.mappings.keys():
            if source_field not in source_data:
                errors.append(f"マッピング対象フィールドが見つかりません: {source_field}")
        
        return errors

    def get_mapping_summary(self) -> Dict[str, Any]:
        """マッピングサマリーを取得"""
        return {
            "total_mappings": len(self.mappings),
            "required_mappings": sum(1 for m in self.mappings.values() if m.required),
            "mappings_with_converters": sum(1 for m in self.mappings.values() if m.converter),
            "mappings_with_defaults": sum(1 for m in self.mappings.values() if m.default_value is not None),
            "field_mappings": {
                source: mapping.target_field 
                for source, mapping in self.mappings.items()
            }
        }

    def export_mapping_config(self) -> Dict[str, Any]:
        """マッピング設定をエクスポート"""
        config = {
            "mappings": [],
            "settings": {
                "similarity_threshold": self.similarity_threshold
            }
        }
        
        for source_field, mapping in self.mappings.items():
            mapping_config = {
                "source_field": mapping.source_field,
                "target_field": mapping.target_field,
                "required": mapping.required,
                "description": mapping.description
            }
            
            if mapping.default_value is not None:
                mapping_config["default_value"] = mapping.default_value
            
            config["mappings"].append(mapping_config)
        
        return config

    def import_mapping_config(self, config: Dict[str, Any]):
        """マッピング設定をインポート"""
        self.clear_mappings()
        
        # 設定を読み込み
        settings = config.get("settings", {})
        self.similarity_threshold = settings.get("similarity_threshold", 0.8)
        
        # マッピングを読み込み
        for mapping_config in config.get("mappings", []):
            mapping = FieldMapping(
                source_field=mapping_config["source_field"],
                target_field=mapping_config["target_field"],
                required=mapping_config.get("required", False),
                default_value=mapping_config.get("default_value"),
                description=mapping_config.get("description")
            )
            self.add_mapping(mapping)