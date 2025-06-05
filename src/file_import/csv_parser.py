"""
CSVファイルパーサー
セキュアで柔軟なCSVファイル解析機能を提供
"""

import csv
import io
import logging
from typing import Dict, List, Any, Optional, Iterator, Union
from dataclasses import dataclass
from pathlib import Path
import chardet
import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class CSVParseResult:
    """CSV解析結果"""
    data: List[Dict[str, Any]]
    headers: List[str]
    row_count: int
    encoding: str
    has_header: bool
    errors: List[str]
    warnings: List[str]


class CSVParser:
    """
    CSVファイルの安全で柔軟な解析を行うクラス
    """
    
    # サポートする文字エンコーディング
    SUPPORTED_ENCODINGS = ['utf-8', 'shift_jis', 'cp932', 'euc-jp', 'iso-2022-jp']
    
    # デフォルト設定
    DEFAULT_MAX_ROWS = 50000
    DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
    
    def __init__(self, 
                 max_rows: int = DEFAULT_MAX_ROWS,
                 max_file_size: int = DEFAULT_MAX_FILE_SIZE,
                 auto_detect_encoding: bool = True,
                 auto_detect_delimiter: bool = True):
        """
        CSVパーサーを初期化
        
        Args:
            max_rows: 最大読み込み行数
            max_file_size: 最大ファイルサイズ（バイト）
            auto_detect_encoding: 文字エンコーディングの自動検出
            auto_detect_delimiter: 区切り文字の自動検出
        """
        self.max_rows = max_rows
        self.max_file_size = max_file_size
        self.auto_detect_encoding = auto_detect_encoding
        self.auto_detect_delimiter = auto_detect_delimiter
    
    def parse_file(self, file_path: Union[str, Path], 
                   encoding: Optional[str] = None,
                   delimiter: Optional[str] = None,
                   has_header: Optional[bool] = None) -> CSVParseResult:
        """
        CSVファイルを解析
        
        Args:
            file_path: CSVファイルのパス
            encoding: 文字エンコーディング（Noneの場合は自動検出）
            delimiter: 区切り文字（Noneの場合は自動検出）
            has_header: ヘッダー行の有無（Noneの場合は自動判定）
            
        Returns:
            CSVParseResult: 解析結果
        """
        file_path = Path(file_path)
        
        # ファイル存在チェック
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        
        # ファイルサイズチェック
        if file_path.stat().st_size > self.max_file_size:
            raise ValueError(f"File size exceeds maximum allowed size: {self.max_file_size}")
        
        # ファイル読み込み
        with open(file_path, 'rb') as f:
            raw_data = f.read()
        
        return self.parse_content(raw_data, encoding, delimiter, has_header)
    
    def parse_content(self, content: bytes,
                     encoding: Optional[str] = None,
                     delimiter: Optional[str] = None,
                     has_header: Optional[bool] = None) -> CSVParseResult:
        """
        CSVコンテンツを解析
        
        Args:
            content: CSVファイルの内容（バイト）
            encoding: 文字エンコーディング
            delimiter: 区切り文字
            has_header: ヘッダー行の有無
            
        Returns:
            CSVParseResult: 解析結果
        """
        errors = []
        warnings = []
        
        # 文字エンコーディング検出
        if encoding is None and self.auto_detect_encoding:
            encoding = self._detect_encoding(content)
        elif encoding is None:
            encoding = 'utf-8'
        
        try:
            # テキストに変換
            text_content = content.decode(encoding)
        except UnicodeDecodeError as e:
            logger.error(f"Failed to decode content with encoding {encoding}: {e}")
            # フォールバック
            text_content = content.decode('utf-8', errors='replace')
            encoding = 'utf-8'
            warnings.append(f"Failed to decode with {encoding}, using UTF-8 with error replacement")
        
        # 区切り文字検出
        if delimiter is None and self.auto_detect_delimiter:
            delimiter = self._detect_delimiter(text_content)
        elif delimiter is None:
            delimiter = ','
        
        # CSV解析
        try:
            data, headers, detected_has_header = self._parse_csv_content(
                text_content, delimiter, has_header
            )
            
            # 行数制限チェック
            if len(data) > self.max_rows:
                warnings.append(f"Data truncated to {self.max_rows} rows (original: {len(data)} rows)")
                data = data[:self.max_rows]
            
            return CSVParseResult(
                data=data,
                headers=headers,
                row_count=len(data),
                encoding=encoding,
                has_header=detected_has_header,
                errors=errors,
                warnings=warnings
            )
            
        except Exception as e:
            logger.exception(f"Failed to parse CSV content: {e}")
            errors.append(f"CSV parsing failed: {str(e)}")
            
            return CSVParseResult(
                data=[],
                headers=[],
                row_count=0,
                encoding=encoding,
                has_header=False,
                errors=errors,
                warnings=warnings
            )
    
    def _detect_encoding(self, content: bytes) -> str:
        """
        文字エンコーディングを検出
        
        Args:
            content: ファイル内容
            
        Returns:
            str: 検出されたエンコーディング
        """
        try:
            detected = chardet.detect(content)
            detected_encoding = detected.get('encoding', 'utf-8').lower()
            confidence = detected.get('confidence', 0)
            
            logger.debug(f"Detected encoding: {detected_encoding} (confidence: {confidence})")
            
            # 信頼度が低い場合はUTF-8を使用
            if confidence < 0.7:
                logger.warning(f"Low confidence for detected encoding: {detected_encoding}")
                return 'utf-8'
            
            # サポートされているエンコーディングかチェック
            for supported in self.SUPPORTED_ENCODINGS:
                if supported in detected_encoding:
                    return supported
            
            # マッピング
            encoding_map = {
                'windows-1252': 'cp932',
                'ascii': 'utf-8'
            }
            
            return encoding_map.get(detected_encoding, 'utf-8')
            
        except Exception as e:
            logger.warning(f"Encoding detection failed: {e}")
            return 'utf-8'
    
    def _detect_delimiter(self, content: str) -> str:
        """
        区切り文字を検出
        
        Args:
            content: CSV内容
            
        Returns:
            str: 検出された区切り文字
        """
        try:
            # pandas の read_csv で区切り文字を自動検出
            sample = content[:10000]  # 最初の10KB をサンプルとして使用
            sniffer = csv.Sniffer()
            
            # 候補となる区切り文字
            delimiters = [',', '\t', ';', '|', ':']
            
            for delimiter in delimiters:
                try:
                    # 各区切り文字で試してみる
                    reader = csv.reader(io.StringIO(sample), delimiter=delimiter)
                    rows = list(reader)[:5]  # 最初の5行をチェック
                    
                    if len(rows) > 1:
                        # 各行の列数をチェック
                        col_counts = [len(row) for row in rows]
                        # 列数が一致し、2列以上あれば有効とみなす
                        if len(set(col_counts)) == 1 and col_counts[0] >= 2:
                            logger.debug(f"Detected delimiter: '{delimiter}'")
                            return delimiter
                            
                except Exception:
                    continue
            
            # デフォルトとしてカンマを返す
            logger.debug("Using default delimiter: ','")
            return ','
            
        except Exception as e:
            logger.warning(f"Delimiter detection failed: {e}")
            return ','
    
    def _parse_csv_content(self, content: str, delimiter: str, 
                          has_header: Optional[bool] = None) -> tuple[List[Dict[str, Any]], List[str], bool]:
        """
        CSV内容を解析してデータとヘッダーを抽出
        
        Args:
            content: CSV内容
            delimiter: 区切り文字
            has_header: ヘッダー行の有無
            
        Returns:
            tuple: (データ, ヘッダー, ヘッダー検出結果)
        """
        reader = csv.reader(io.StringIO(content), delimiter=delimiter)
        rows = list(reader)
        
        if not rows:
            return [], [], False
        
        # ヘッダー判定
        if has_header is None:
            has_header = self._detect_header(rows)
        
        if has_header and len(rows) > 1:
            headers = rows[0]
            data_rows = rows[1:]
        else:
            # ヘッダーがない場合は自動生成
            if rows:
                num_cols = len(rows[0])
                headers = [f"Column_{i+1}" for i in range(num_cols)]
                data_rows = rows
            else:
                headers = []
                data_rows = []
        
        # データを辞書形式に変換
        data = []
        for row_idx, row in enumerate(data_rows):
            # 行が空の場合はスキップ
            if not row or all(cell.strip() == '' for cell in row):
                continue
            
            # ヘッダー数に合わせて行を調整
            while len(row) < len(headers):
                row.append('')
            
            # 余分な列は無視
            row = row[:len(headers)]
            
            # 辞書に変換
            row_dict = {}
            for col_idx, (header, value) in enumerate(zip(headers, row)):
                # データ型の自動推定
                cleaned_value = self._clean_cell_value(value)
                row_dict[header] = cleaned_value
            
            data.append(row_dict)
        
        return data, headers, has_header
    
    def _detect_header(self, rows: List[List[str]]) -> bool:
        """
        ヘッダー行の存在を検出
        
        Args:
            rows: CSV行データ
            
        Returns:
            bool: ヘッダー行が存在するかどうか
        """
        if len(rows) < 2:
            return False
        
        first_row = rows[0]
        second_row = rows[1]
        
        # 基本的なヒューリスティック
        # 1. 最初の行に数値が少ない
        # 2. 最初の行の文字列が長い
        # 3. 最初の行と2行目のデータ型が異なる
        
        first_row_numeric_count = 0
        second_row_numeric_count = 0
        
        for i in range(min(len(first_row), len(second_row))):
            cell1 = first_row[i].strip()
            cell2 = second_row[i].strip()
            
            # 数値判定
            if self._is_numeric(cell1):
                first_row_numeric_count += 1
            if self._is_numeric(cell2):
                second_row_numeric_count += 1
        
        # 2行目の方が数値が多い場合、1行目はヘッダーの可能性が高い
        if second_row_numeric_count > first_row_numeric_count:
            return True
        
        # 1行目の平均文字数が2行目より長い場合
        first_row_avg_len = sum(len(cell) for cell in first_row) / len(first_row)
        second_row_avg_len = sum(len(cell) for cell in second_row) / len(second_row)
        
        if first_row_avg_len > second_row_avg_len * 1.5:
            return True
        
        return False
    
    def _is_numeric(self, value: str) -> bool:
        """
        文字列が数値かどうかを判定
        
        Args:
            value: 判定する文字列
            
        Returns:
            bool: 数値かどうか
        """
        try:
            float(value.replace(',', ''))
            return True
        except (ValueError, AttributeError):
            return False
    
    def _clean_cell_value(self, value: str) -> Any:
        """
        セル値をクリーニングし、適切な型に変換
        
        Args:
            value: セル値
            
        Returns:
            Any: クリーニング済みの値
        """
        if not isinstance(value, str):
            return value
        
        # 前後の空白を除去
        value = value.strip()
        
        # 空文字の場合
        if value == '':
            return None
        
        # 数値変換を試行
        try:
            # カンマ区切りの数値に対応
            cleaned_number = value.replace(',', '')
            
            # 整数判定
            if cleaned_number.isdigit() or (cleaned_number.startswith('-') and cleaned_number[1:].isdigit()):
                return int(cleaned_number)
            
            # 浮動小数点数判定
            if '.' in cleaned_number:
                return float(cleaned_number)
                
        except ValueError:
            pass
        
        # 真偽値判定
        lower_value = value.lower()
        if lower_value in ('true', 'yes', 'y', '1', 'on', 'はい', '真'):
            return True
        elif lower_value in ('false', 'no', 'n', '0', 'off', 'いいえ', '偽'):
            return False
        
        # そのまま文字列として返す
        return value