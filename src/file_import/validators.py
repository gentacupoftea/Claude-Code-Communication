"""
ファイルバリデーション機能
アップロードされたファイルのセキュリティチェックを行う
"""

import logging
import magic
import hashlib
from typing import Dict, List, Any, Optional, Set, Union
from dataclasses import dataclass
from pathlib import Path
import re

logger = logging.getLogger(__name__)


@dataclass
class ValidationResult:
    """バリデーション結果"""
    is_valid: bool
    errors: List[str]
    warnings: List[str]
    file_info: Dict[str, Any]


class FileValidator:
    """
    ファイルのセキュリティ検証を行うクラス
    """
    
    # 許可するMIMEタイプ
    ALLOWED_MIME_TYPES = {
        'text/csv',
        'application/csv',
        'text/plain',  # CSVファイルがtext/plainと判定される場合がある
        'application/vnd.ms-excel',  # .xls
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',  # .xlsx
        'application/vnd.ms-excel.sheet.macroEnabled.12',  # .xlsm
    }
    
    # 許可するファイル拡張子
    ALLOWED_EXTENSIONS = {
        '.csv', '.txt', '.xls', '.xlsx', '.xlsm'
    }
    
    # 危険なファイル拡張子（ブラックリスト）
    DANGEROUS_EXTENSIONS = {
        '.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.js', '.jar',
        '.ps1', '.sh', '.php', '.asp', '.aspx', '.jsp', '.dll', '.sys'
    }
    
    # 危険なファイル署名（マジックナンバー）
    DANGEROUS_SIGNATURES = {
        b'MZ',  # PE executable
        b'\x7fELF',  # ELF executable
        b'PK\x03\x04',  # ZIP (要注意、正当なOfficeファイルも同じ署名)
    }
    
    # デフォルト制限
    DEFAULT_MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
    DEFAULT_MIN_FILE_SIZE = 1  # 1 byte
    
    def __init__(self,
                 max_file_size: int = DEFAULT_MAX_FILE_SIZE,
                 min_file_size: int = DEFAULT_MIN_FILE_SIZE,
                 allowed_mime_types: Optional[Set[str]] = None,
                 allowed_extensions: Optional[Set[str]] = None,
                 scan_content: bool = True):
        """
        ファイルバリデーターを初期化
        
        Args:
            max_file_size: 最大ファイルサイズ（バイト）
            min_file_size: 最小ファイルサイズ（バイト）
            allowed_mime_types: 許可するMIMEタイプ
            allowed_extensions: 許可する拡張子
            scan_content: ファイル内容をスキャンするかどうか
        """
        self.max_file_size = max_file_size
        self.min_file_size = min_file_size
        self.allowed_mime_types = allowed_mime_types or self.ALLOWED_MIME_TYPES
        self.allowed_extensions = allowed_extensions or self.ALLOWED_EXTENSIONS
        self.scan_content = scan_content
    
    def validate_file(self, file_path: Union[str, Path]) -> ValidationResult:
        """
        ファイルを検証
        
        Args:
            file_path: ファイルパス
            
        Returns:
            ValidationResult: 検証結果
        """
        file_path = Path(file_path)
        
        if not file_path.exists():
            return ValidationResult(
                is_valid=False,
                errors=[f"File not found: {file_path}"],
                warnings=[],
                file_info={}
            )
        
        with open(file_path, 'rb') as f:
            content = f.read()
        
        return self.validate_content(content, file_path.name)
    
    def validate_content(self, content: bytes, filename: str) -> ValidationResult:
        """
        ファイル内容を検証
        
        Args:
            content: ファイル内容
            filename: ファイル名
            
        Returns:
            ValidationResult: 検証結果
        """
        errors = []
        warnings = []
        file_info = {}
        
        try:
            # 基本情報を収集
            file_info.update({
                'filename': filename,
                'size': len(content),
                'md5': hashlib.md5(content).hexdigest(),
                'sha256': hashlib.sha256(content).hexdigest()
            })
            
            # ファイルサイズチェック
            size_check = self._validate_file_size(len(content))
            if not size_check['is_valid']:
                errors.extend(size_check['errors'])
            warnings.extend(size_check['warnings'])
            
            # ファイル名チェック
            name_check = self._validate_filename(filename)
            if not name_check['is_valid']:
                errors.extend(name_check['errors'])
            warnings.extend(name_check['warnings'])
            
            # MIMEタイプチェック
            mime_check = self._validate_mime_type(content)
            file_info.update(mime_check['info'])
            if not mime_check['is_valid']:
                errors.extend(mime_check['errors'])
            warnings.extend(mime_check['warnings'])
            
            # ファイル署名チェック
            signature_check = self._validate_file_signature(content)
            if not signature_check['is_valid']:
                errors.extend(signature_check['errors'])
            warnings.extend(signature_check['warnings'])
            
            # 内容スキャン
            if self.scan_content:
                content_check = self._scan_file_content(content)
                if not content_check['is_valid']:
                    errors.extend(content_check['errors'])
                warnings.extend(content_check['warnings'])
            
            is_valid = len(errors) == 0
            
            return ValidationResult(
                is_valid=is_valid,
                errors=errors,
                warnings=warnings,
                file_info=file_info
            )
            
        except Exception as e:
            logger.exception(f"File validation failed: {e}")
            return ValidationResult(
                is_valid=False,
                errors=[f"Validation failed: {str(e)}"],
                warnings=warnings,
                file_info=file_info
            )
    
    def _validate_file_size(self, size: int) -> Dict[str, Any]:
        """
        ファイルサイズを検証
        
        Args:
            size: ファイルサイズ（バイト）
            
        Returns:
            Dict: 検証結果
        """
        errors = []
        warnings = []
        
        if size < self.min_file_size:
            errors.append(f"File too small: {size} bytes (minimum: {self.min_file_size} bytes)")
        
        if size > self.max_file_size:
            errors.append(f"File too large: {size} bytes (maximum: {self.max_file_size} bytes)")
        
        # 大きなファイルの警告
        if size > 10 * 1024 * 1024:  # 10MB
            warnings.append(f"Large file detected: {size / (1024*1024):.1f} MB")
        
        return {
            'is_valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings
        }
    
    def _validate_filename(self, filename: str) -> Dict[str, Any]:
        """
        ファイル名を検証
        
        Args:
            filename: ファイル名
            
        Returns:
            Dict: 検証結果
        """
        errors = []
        warnings = []
        
        # 拡張子チェック
        file_path = Path(filename)
        extension = file_path.suffix.lower()
        
        # 危険な拡張子チェック
        if extension in self.DANGEROUS_EXTENSIONS:
            errors.append(f"Dangerous file extension: {extension}")
        
        # 許可された拡張子チェック
        if extension not in self.allowed_extensions:
            errors.append(f"File extension not allowed: {extension}")
        
        # ファイル名パターンチェック
        filename_issues = self._check_filename_patterns(filename)
        errors.extend(filename_issues['errors'])
        warnings.extend(filename_issues['warnings'])
        
        return {
            'is_valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings
        }
    
    def _check_filename_patterns(self, filename: str) -> Dict[str, List[str]]:
        """
        ファイル名の危険なパターンをチェック
        
        Args:
            filename: ファイル名
            
        Returns:
            Dict: エラーと警告のリスト
        """
        errors = []
        warnings = []
        
        # 危険な文字をチェック
        dangerous_chars = r'[<>:"|?*\x00-\x1f]'
        if re.search(dangerous_chars, filename):
            errors.append("Filename contains dangerous characters")
        
        # 予約語チェック（Windows）
        reserved_names = {
            'CON', 'PRN', 'AUX', 'NUL',
            'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
            'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
        }
        
        base_name = Path(filename).stem.upper()
        if base_name in reserved_names:
            errors.append(f"Filename uses reserved name: {base_name}")
        
        # 長すぎるファイル名
        if len(filename) > 255:
            errors.append("Filename too long")
        
        # 複数の拡張子（例: file.txt.exe）
        if filename.count('.') > 1:
            warnings.append("Multiple extensions detected")
        
        # 隠しファイル
        if filename.startswith('.'):
            warnings.append("Hidden file detected")
        
        return {'errors': errors, 'warnings': warnings}
    
    def _validate_mime_type(self, content: bytes) -> Dict[str, Any]:
        """
        MIMEタイプを検証
        
        Args:
            content: ファイル内容
            
        Returns:
            Dict: 検証結果
        """
        errors = []
        warnings = []
        info = {}
        
        try:
            # python-magicを使用してMIMEタイプを検出
            mime_type = magic.from_buffer(content, mime=True)
            info['detected_mime_type'] = mime_type
            
            # 許可されたMIMEタイプかチェック
            if mime_type not in self.allowed_mime_types:
                # 特別なケース: text/plainもCSVとして許可
                if mime_type == 'text/plain':
                    warnings.append("File detected as text/plain, treating as CSV")
                else:
                    errors.append(f"MIME type not allowed: {mime_type}")
            
        except Exception as e:
            logger.warning(f"MIME type detection failed: {e}")
            warnings.append("Could not detect MIME type")
            info['detected_mime_type'] = 'unknown'
        
        return {
            'is_valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings,
            'info': info
        }
    
    def _validate_file_signature(self, content: bytes) -> Dict[str, Any]:
        """
        ファイル署名（マジックナンバー）を検証
        
        Args:
            content: ファイル内容
            
        Returns:
            Dict: 検証結果
        """
        errors = []
        warnings = []
        
        if len(content) < 4:
            warnings.append("File too small for signature analysis")
            return {'is_valid': True, 'errors': errors, 'warnings': warnings}
        
        # 最初の4バイトをチェック
        header = content[:4]
        
        # 実行ファイルの署名をチェック
        if header.startswith(b'MZ'):
            errors.append("Executable file detected (PE format)")
        elif header.startswith(b'\x7fELF'):
            errors.append("Executable file detected (ELF format)")
        
        # Office文書の特別なチェック
        if header.startswith(b'PK\x03\x04'):
            # ZIP形式（Office文書も含む）
            # より詳細なチェックが必要な場合はここで実装
            pass
        
        # その他の危険な署名
        for dangerous_sig in self.DANGEROUS_SIGNATURES:
            if header.startswith(dangerous_sig) and dangerous_sig != b'PK\x03\x04':
                errors.append(f"Dangerous file signature detected")
                break
        
        return {
            'is_valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings
        }
    
    def _scan_file_content(self, content: bytes) -> Dict[str, Any]:
        """
        ファイル内容をスキャンして危険なパターンを検出
        
        Args:
            content: ファイル内容
            
        Returns:
            Dict: 検証結果
        """
        errors = []
        warnings = []
        
        try:
            # テキストとして内容を読める場合のみスキャン
            text_content = content.decode('utf-8', errors='ignore')
            
            # 危険なスクリプトパターンを検索
            dangerous_patterns = [
                r'<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>',  # JavaScript
                r'javascript:',  # JavaScript URL
                r'vbscript:',  # VBScript URL
                r'data:text/html',  # Data URL with HTML
                r'<?php',  # PHP
                r'<%.*%>',  # ASP/JSP
                r'<\?.*\?>',  # Generic server-side includes
            ]
            
            for pattern in dangerous_patterns:
                if re.search(pattern, text_content, re.IGNORECASE):
                    warnings.append(f"Suspicious script pattern detected")
                    break
            
            # 非常に長い行（異常なデータの兆候）
            lines = text_content.split('\n')
            max_line_length = max(len(line) for line in lines) if lines else 0
            if max_line_length > 50000:  # 50KB
                warnings.append(f"Very long line detected: {max_line_length} characters")
            
            # バイナリデータの混入チェック
            null_bytes = content.count(b'\x00')
            if null_bytes > len(content) * 0.01:  # 1%以上がnullバイト
                warnings.append("High ratio of null bytes detected")
            
        except Exception as e:
            logger.debug(f"Content scanning failed: {e}")
            # テキストとして読めない場合は警告のみ
            warnings.append("Could not scan file content as text")
        
        return {
            'is_valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings
        }