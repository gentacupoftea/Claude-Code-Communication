"""
AIクレンジング処理システム
外部データソースから取り込んだデータの自動クリーニングを行う
"""

import logging
import re
import asyncio
from typing import Dict, List, Any, Optional, Union, Tuple, Set
from dataclasses import dataclass, field
from datetime import datetime, date
from decimal import Decimal, InvalidOperation
import pandas as pd
import numpy as np
from enum import Enum

logger = logging.getLogger(__name__)


class DataType(Enum):
    """データ型の定義"""
    STRING = "string"
    INTEGER = "integer"
    FLOAT = "float"
    DECIMAL = "decimal"
    BOOLEAN = "boolean"
    DATE = "date"
    DATETIME = "datetime"
    EMAIL = "email"
    PHONE = "phone"
    URL = "url"
    JSON = "json"
    UNKNOWN = "unknown"


class CleaningRule(Enum):
    """クリーニングルールの定義"""
    REMOVE_DUPLICATES = "remove_duplicates"
    NORMALIZE_WHITESPACE = "normalize_whitespace"
    REMOVE_HTML_TAGS = "remove_html_tags"
    STANDARDIZE_PHONE = "standardize_phone"
    VALIDATE_EMAIL = "validate_email"
    NORMALIZE_DATES = "normalize_dates"
    REMOVE_OUTLIERS = "remove_outliers"
    FILL_MISSING_VALUES = "fill_missing_values"
    STANDARDIZE_CASE = "standardize_case"
    REMOVE_SPECIAL_CHARS = "remove_special_chars"
    VALIDATE_URLS = "validate_urls"
    NORMALIZE_CURRENCY = "normalize_currency"


@dataclass
class ColumnProfile:
    """列のプロファイル情報"""
    name: str
    data_type: DataType
    null_count: int = 0
    unique_count: int = 0
    min_value: Optional[Any] = None
    max_value: Optional[Any] = None
    avg_length: float = 0.0
    common_patterns: List[str] = field(default_factory=list)
    suggested_rules: List[CleaningRule] = field(default_factory=list)
    quality_score: float = 0.0


@dataclass
class CleaningReport:
    """クリーニング処理レポート"""
    original_row_count: int
    cleaned_row_count: int
    columns_processed: int
    rules_applied: List[CleaningRule]
    errors_fixed: int
    warnings: List[str] = field(default_factory=list)
    column_profiles: Dict[str, ColumnProfile] = field(default_factory=dict)
    processing_time: float = 0.0
    quality_improvement: float = 0.0


class AIDataCleaner:
    """
    AIベースのデータクリーニングシステム
    機械学習とルールベースの手法を組み合わせて自動的にデータを清浄化
    """
    
    def __init__(self,
                 aggressive_cleaning: bool = False,
                 preserve_original: bool = True,
                 auto_detect_types: bool = True):
        """
        AIデータクリーナーを初期化
        
        Args:
            aggressive_cleaning: 積極的なクリーニングを行うか
            preserve_original: 元データを保持するか
            auto_detect_types: データ型を自動検出するか
        """
        self.aggressive_cleaning = aggressive_cleaning
        self.preserve_original = preserve_original
        self.auto_detect_types = auto_detect_types
        
        # パターン定義
        self.email_pattern = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
        self.phone_pattern = re.compile(r'[\d\-\(\)\+\s]+')
        self.url_pattern = re.compile(r'https?://[^\s]+')
        self.html_pattern = re.compile(r'<[^>]+>')
        
        # 日本の電話番号パターン
        self.jp_phone_patterns = [
            re.compile(r'^0\d{1,4}-\d{1,4}-\d{4}$'),  # 固定電話
            re.compile(r'^0[789]0-\d{4}-\d{4}$'),     # 携帯電話
            re.compile(r'^050-\d{4}-\d{4}$'),         # IP電話
        ]
        
        logger.info("AI Data Cleaner initialized")
    
    async def clean_data(self, 
                        data: List[Dict[str, Any]],
                        column_types: Optional[Dict[str, DataType]] = None,
                        custom_rules: Optional[List[CleaningRule]] = None) -> Tuple[List[Dict[str, Any]], CleaningReport]:
        """
        データを自動的にクリーニング
        
        Args:
            data: クリーニング対象のデータ
            column_types: 列のデータ型指定
            custom_rules: カスタムルール
            
        Returns:
            Tuple[List[Dict[str, Any]], CleaningReport]: クリーニング済みデータとレポート
        """
        start_time = datetime.now()
        
        if not data:
            logger.warning("Empty data provided for cleaning")
            return data, CleaningReport(
                original_row_count=0,
                cleaned_row_count=0,
                columns_processed=0,
                rules_applied=[],
                errors_fixed=0
            )
        
        logger.info(f"Starting data cleaning for {len(data)} rows")
        
        # 元データのコピーを作成
        if self.preserve_original:
            cleaned_data = [row.copy() for row in data]
        else:
            cleaned_data = data
        
        # データフレームに変換（pandas使用）
        df = pd.DataFrame(cleaned_data)
        original_df = df.copy()
        
        # 列プロファイリング
        column_profiles = {}
        if self.auto_detect_types:
            for column in df.columns:
                profile = await self._profile_column(df, column)
                column_profiles[column] = profile
                
                # 列のデータ型を更新
                if column_types is None:
                    column_types = {}
                if column not in column_types:
                    column_types[column] = profile.data_type
        
        # クリーニングルールを決定
        rules_to_apply = self._determine_cleaning_rules(column_profiles, custom_rules)
        
        # クリーニング処理を実行
        errors_fixed = 0
        warnings = []
        
        for rule in rules_to_apply:
            try:
                df, fixed_count = await self._apply_cleaning_rule(df, rule, column_types)
                errors_fixed += fixed_count
            except Exception as e:
                logger.warning(f"Failed to apply rule {rule}: {e}")
                warnings.append(f"Rule {rule.value} failed: {str(e)}")
        
        # 結果をリストに変換
        cleaned_data = df.to_dict('records')
        
        # 品質改善の計算
        quality_improvement = self._calculate_quality_improvement(original_df, df)
        
        # レポート作成
        processing_time = (datetime.now() - start_time).total_seconds()
        
        report = CleaningReport(
            original_row_count=len(data),
            cleaned_row_count=len(cleaned_data),
            columns_processed=len(df.columns),
            rules_applied=rules_to_apply,
            errors_fixed=errors_fixed,
            warnings=warnings,
            column_profiles=column_profiles,
            processing_time=processing_time,
            quality_improvement=quality_improvement
        )
        
        logger.info(f"Data cleaning completed: {len(data)} -> {len(cleaned_data)} rows, "
                   f"{errors_fixed} errors fixed, {quality_improvement:.1f}% quality improvement")
        
        return cleaned_data, report
    
    async def _profile_column(self, df: pd.DataFrame, column: str) -> ColumnProfile:
        """
        列のプロファイリングを実行
        
        Args:
            df: データフレーム
            column: 列名
            
        Returns:
            ColumnProfile: 列プロファイル
        """
        series = df[column]
        
        # 基本統計
        null_count = series.isna().sum()
        unique_count = series.nunique()
        
        # データ型の推定
        detected_type = self._detect_data_type(series)
        
        # 文字列長の平均（文字列の場合）
        avg_length = 0.0
        if detected_type == DataType.STRING:
            string_lengths = series.astype(str).str.len()
            avg_length = string_lengths.mean()
        
        # 最小・最大値
        min_value = None
        max_value = None
        if detected_type in [DataType.INTEGER, DataType.FLOAT, DataType.DECIMAL]:
            try:
                min_value = series.min()
                max_value = series.max()
            except Exception:
                pass
        
        # パターン分析
        common_patterns = self._extract_patterns(series)
        
        # 推奨ルールの決定
        suggested_rules = self._suggest_cleaning_rules(series, detected_type)
        
        # 品質スコアの計算
        quality_score = self._calculate_column_quality(series, detected_type)
        
        return ColumnProfile(
            name=column,
            data_type=detected_type,
            null_count=null_count,
            unique_count=unique_count,
            min_value=min_value,
            max_value=max_value,
            avg_length=avg_length,
            common_patterns=common_patterns,
            suggested_rules=suggested_rules,
            quality_score=quality_score
        )
    
    def _detect_data_type(self, series: pd.Series) -> DataType:
        """
        列のデータ型を検出
        
        Args:
            series: pandas Series
            
        Returns:
            DataType: 検出されたデータ型
        """
        # 空の列
        if series.isna().all():
            return DataType.UNKNOWN
        
        # サンプル値を取得（非null値のみ）
        non_null_series = series.dropna()
        if len(non_null_series) == 0:
            return DataType.UNKNOWN
        
        sample_values = non_null_series.head(100).astype(str)
        
        # パターンマッチング
        email_matches = sum(1 for val in sample_values if self.email_pattern.match(val))
        if email_matches / len(sample_values) > 0.8:
            return DataType.EMAIL
        
        url_matches = sum(1 for val in sample_values if self.url_pattern.match(val))
        if url_matches / len(sample_values) > 0.8:
            return DataType.URL
        
        # 電話番号パターン
        phone_matches = sum(1 for val in sample_values 
                          if any(pattern.match(val.replace(' ', '').replace('-', '')) 
                                for pattern in self.jp_phone_patterns))
        if phone_matches / len(sample_values) > 0.8:
            return DataType.PHONE
        
        # 数値型の判定
        try:
            pd.to_numeric(non_null_series)
            # 整数かどうか判定
            if (non_null_series.astype(str).str.contains(r'^\d+$')).all():
                return DataType.INTEGER
            else:
                return DataType.FLOAT
        except (ValueError, TypeError):
            pass
        
        # 日付型の判定
        try:
            pd.to_datetime(non_null_series)
            return DataType.DATETIME
        except (ValueError, TypeError):
            pass
        
        # ブール型の判定
        boolean_values = {'true', 'false', 'yes', 'no', '1', '0', 'はい', 'いいえ'}
        unique_lower = set(non_null_series.astype(str).str.lower().unique())
        if unique_lower.issubset(boolean_values):
            return DataType.BOOLEAN
        
        # デフォルトは文字列
        return DataType.STRING
    
    def _extract_patterns(self, series: pd.Series) -> List[str]:
        """
        列から共通パターンを抽出
        
        Args:
            series: pandas Series
            
        Returns:
            List[str]: 共通パターンのリスト
        """
        patterns = []
        non_null_series = series.dropna().astype(str)
        
        if len(non_null_series) == 0:
            return patterns
        
        # 長さのパターン
        lengths = non_null_series.str.len()
        most_common_length = lengths.mode().iloc[0] if not lengths.mode().empty else None
        if most_common_length:
            patterns.append(f"length_{most_common_length}")
        
        # 文字種のパターン
        if (non_null_series.str.match(r'^\d+$')).mean() > 0.8:
            patterns.append("numeric_only")
        elif (non_null_series.str.match(r'^[A-Za-z]+$')).mean() > 0.8:
            patterns.append("alpha_only")
        elif (non_null_series.str.match(r'^[A-Za-z0-9]+$')).mean() > 0.8:
            patterns.append("alphanumeric")
        
        return patterns
    
    def _suggest_cleaning_rules(self, series: pd.Series, data_type: DataType) -> List[CleaningRule]:
        """
        データ型に基づいてクリーニングルールを提案
        
        Args:
            series: pandas Series
            data_type: データ型
            
        Returns:
            List[CleaningRule]: 推奨ルール
        """
        rules = []
        
        # 全データ型共通
        rules.append(CleaningRule.NORMALIZE_WHITESPACE)
        
        # 欠損値が多い場合
        null_ratio = series.isna().mean()
        if null_ratio > 0.1:
            rules.append(CleaningRule.FILL_MISSING_VALUES)
        
        # データ型別のルール
        if data_type == DataType.STRING:
            rules.extend([
                CleaningRule.REMOVE_HTML_TAGS,
                CleaningRule.STANDARDIZE_CASE
            ])
        elif data_type == DataType.EMAIL:
            rules.append(CleaningRule.VALIDATE_EMAIL)
        elif data_type == DataType.PHONE:
            rules.append(CleaningRule.STANDARDIZE_PHONE)
        elif data_type == DataType.URL:
            rules.append(CleaningRule.VALIDATE_URLS)
        elif data_type in [DataType.DATE, DataType.DATETIME]:
            rules.append(CleaningRule.NORMALIZE_DATES)
        elif data_type in [DataType.INTEGER, DataType.FLOAT]:
            rules.append(CleaningRule.REMOVE_OUTLIERS)
        
        return rules
    
    def _calculate_column_quality(self, series: pd.Series, data_type: DataType) -> float:
        """
        列の品質スコアを計算
        
        Args:
            series: pandas Series
            data_type: データ型
            
        Returns:
            float: 品質スコア（0-100）
        """
        if len(series) == 0:
            return 0.0
        
        score = 100.0
        
        # 欠損値ペナルティ
        null_ratio = series.isna().mean()
        score -= null_ratio * 30
        
        # データ型適合性
        non_null_series = series.dropna()
        if len(non_null_series) > 0:
            if data_type == DataType.EMAIL:
                valid_emails = sum(1 for val in non_null_series.astype(str) 
                                 if self.email_pattern.match(val))
                score *= (valid_emails / len(non_null_series))
            elif data_type == DataType.URL:
                valid_urls = sum(1 for val in non_null_series.astype(str) 
                               if self.url_pattern.match(val))
                score *= (valid_urls / len(non_null_series))
        
        # 重複値ペナルティ
        unique_ratio = series.nunique() / len(series)
        if unique_ratio < 0.1:  # 90%以上が重複
            score *= 0.7
        
        return max(0.0, min(100.0, score))
    
    def _determine_cleaning_rules(self, 
                                column_profiles: Dict[str, ColumnProfile],
                                custom_rules: Optional[List[CleaningRule]] = None) -> List[CleaningRule]:
        """
        適用するクリーニングルールを決定
        
        Args:
            column_profiles: 列プロファイル
            custom_rules: カスタムルール
            
        Returns:
            List[CleaningRule]: 適用するルール
        """
        rules_set = set()
        
        # カスタムルールを追加
        if custom_rules:
            rules_set.update(custom_rules)
        
        # 列プロファイルから推奨ルールを追加
        for profile in column_profiles.values():
            rules_set.update(profile.suggested_rules)
        
        # 基本的なルールを追加
        rules_set.add(CleaningRule.NORMALIZE_WHITESPACE)
        rules_set.add(CleaningRule.REMOVE_DUPLICATES)
        
        return list(rules_set)
    
    async def _apply_cleaning_rule(self, 
                                 df: pd.DataFrame, 
                                 rule: CleaningRule,
                                 column_types: Dict[str, DataType]) -> Tuple[pd.DataFrame, int]:
        """
        特定のクリーニングルールを適用
        
        Args:
            df: データフレーム
            rule: クリーニングルール
            column_types: 列のデータ型
            
        Returns:
            Tuple[pd.DataFrame, int]: 処理済みデータフレームと修正件数
        """
        errors_fixed = 0
        
        if rule == CleaningRule.NORMALIZE_WHITESPACE:
            for column in df.columns:
                if column_types.get(column) == DataType.STRING:
                    before_count = df[column].astype(str).str.strip().ne(df[column].astype(str)).sum()
                    df[column] = df[column].astype(str).str.strip()
                    errors_fixed += before_count
        
        elif rule == CleaningRule.REMOVE_DUPLICATES:
            original_count = len(df)
            df = df.drop_duplicates()
            errors_fixed = original_count - len(df)
        
        elif rule == CleaningRule.REMOVE_HTML_TAGS:
            for column in df.columns:
                if column_types.get(column) == DataType.STRING:
                    html_count = df[column].astype(str).str.contains('<[^>]+>', regex=True).sum()
                    df[column] = df[column].astype(str).str.replace('<[^>]+>', '', regex=True)
                    errors_fixed += html_count
        
        elif rule == CleaningRule.VALIDATE_EMAIL:
            for column in df.columns:
                if column_types.get(column) == DataType.EMAIL:
                    invalid_emails = ~df[column].astype(str).str.match(self.email_pattern.pattern)
                    errors_fixed += invalid_emails.sum()
                    df.loc[invalid_emails, column] = None
        
        elif rule == CleaningRule.STANDARDIZE_PHONE:
            for column in df.columns:
                if column_types.get(column) == DataType.PHONE:
                    # 電話番号の標準化
                    df[column] = df[column].astype(str).str.replace(r'[^\d\-]', '', regex=True)
                    errors_fixed += len(df)  # 全件処理として計算
        
        elif rule == CleaningRule.FILL_MISSING_VALUES:
            for column in df.columns:
                null_count = df[column].isna().sum()
                if null_count > 0:
                    data_type = column_types.get(column, DataType.STRING)
                    
                    if data_type in [DataType.INTEGER, DataType.FLOAT]:
                        # 数値は平均値で埋める
                        df[column] = df[column].fillna(df[column].mean())
                    elif data_type == DataType.STRING:
                        # 文字列は最頻値で埋める
                        mode_value = df[column].mode()
                        if not mode_value.empty:
                            df[column] = df[column].fillna(mode_value.iloc[0])
                        else:
                            df[column] = df[column].fillna("N/A")
                    
                    errors_fixed += null_count
        
        return df, errors_fixed
    
    def _calculate_quality_improvement(self, original_df: pd.DataFrame, cleaned_df: pd.DataFrame) -> float:
        """
        品質改善度を計算
        
        Args:
            original_df: 元のデータフレーム
            cleaned_df: クリーニング後のデータフレーム
            
        Returns:
            float: 品質改善度（パーセント）
        """
        if len(original_df) == 0:
            return 0.0
        
        # 欠損値の改善
        original_nulls = original_df.isna().sum().sum()
        cleaned_nulls = cleaned_df.isna().sum().sum()
        null_improvement = max(0, original_nulls - cleaned_nulls)
        
        # 重複の改善
        original_duplicates = len(original_df) - len(original_df.drop_duplicates())
        cleaned_duplicates = len(cleaned_df) - len(cleaned_df.drop_duplicates())
        duplicate_improvement = max(0, original_duplicates - cleaned_duplicates)
        
        # 総データポイント数
        total_data_points = len(original_df) * len(original_df.columns)
        
        # 改善度の計算
        total_improvement = null_improvement + duplicate_improvement
        improvement_ratio = total_improvement / total_data_points if total_data_points > 0 else 0
        
        return improvement_ratio * 100