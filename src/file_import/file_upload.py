"""
ファイルアップロードハンドラー
セキュアなファイルアップロードとデータ処理を統合する
"""

import logging
import tempfile
import uuid
from typing import Dict, List, Any, Optional, Union, BinaryIO
from dataclasses import dataclass
from pathlib import Path
import hashlib
import shutil
from datetime import datetime

from .csv_parser import CSVParser, CSVParseResult
from .excel_parser import ExcelParser, ExcelParseResult
from .validators import FileValidator, ValidationResult

logger = logging.getLogger(__name__)


@dataclass
class UploadResult:
    """ファイルアップロード結果"""
    success: bool
    file_id: str
    original_filename: str
    file_type: str
    data: Union[CSVParseResult, ExcelParseResult, None]
    validation: ValidationResult
    processing_time: float
    errors: List[str]
    warnings: List[str]


class FileUploadHandler:
    """
    ファイルアップロードの統合ハンドラー
    バリデーション、パース、データ変換を一元的に処理
    """
    
    def __init__(self,
                 temp_dir: Optional[str] = None,
                 max_file_size: int = 100 * 1024 * 1024,  # 100MB
                 cleanup_temp_files: bool = True):
        """
        ファイルアップロードハンドラーを初期化
        
        Args:
            temp_dir: 一時ファイル保存ディレクトリ
            max_file_size: 最大ファイルサイズ
            cleanup_temp_files: 処理後に一時ファイルを削除するか
        """
        self.temp_dir = Path(temp_dir) if temp_dir else Path(tempfile.gettempdir())
        self.max_file_size = max_file_size
        self.cleanup_temp_files = cleanup_temp_files
        
        # コンポーネントを初期化
        self.validator = FileValidator(max_file_size=max_file_size)
        self.csv_parser = CSVParser(max_file_size=max_file_size)
        self.excel_parser = ExcelParser(max_file_size=max_file_size)
        
        # 一時ディレクトリを作成
        self.temp_dir.mkdir(exist_ok=True)
        
        logger.info(f"FileUploadHandler initialized with temp_dir: {self.temp_dir}")
    
    def handle_upload(self, 
                     file_content: bytes,
                     filename: str,
                     content_type: Optional[str] = None) -> UploadResult:
        """
        ファイルアップロードを処理
        
        Args:
            file_content: ファイル内容
            filename: ファイル名
            content_type: コンテンツタイプ（オプション）
            
        Returns:
            UploadResult: アップロード結果
        """
        start_time = datetime.now()
        file_id = str(uuid.uuid4())
        temp_file_path = None
        
        try:
            logger.info(f"Processing file upload: {filename} ({len(file_content)} bytes)")
            
            # ファイルバリデーション
            validation_result = self.validator.validate_content(file_content, filename)
            
            if not validation_result.is_valid:
                logger.warning(f"File validation failed for {filename}: {validation_result.errors}")
                return UploadResult(
                    success=False,
                    file_id=file_id,
                    original_filename=filename,
                    file_type='unknown',
                    data=None,
                    validation=validation_result,
                    processing_time=self._get_processing_time(start_time),
                    errors=validation_result.errors,
                    warnings=validation_result.warnings
                )
            
            # ファイルタイプ判定
            file_type = self._detect_file_type(filename, file_content)
            
            # 一時ファイルに保存（必要な場合）
            temp_file_path = self._save_temp_file(file_content, filename, file_id)
            
            # ファイル形式に応じて解析
            parse_result = self._parse_file_content(file_content, file_type, filename)
            
            # 成功結果を作成
            result = UploadResult(
                success=True,
                file_id=file_id,
                original_filename=filename,
                file_type=file_type,
                data=parse_result,
                validation=validation_result,
                processing_time=self._get_processing_time(start_time),
                errors=[],
                warnings=validation_result.warnings
            )
            
            # パース結果のエラーと警告を追加
            if parse_result:
                if hasattr(parse_result, 'errors'):
                    result.errors.extend(parse_result.errors)
                if hasattr(parse_result, 'warnings'):
                    result.warnings.extend(parse_result.warnings)
            
            logger.info(f"File upload processed successfully: {filename} -> {file_id}")
            return result
            
        except Exception as e:
            logger.exception(f"File upload processing failed for {filename}: {e}")
            return UploadResult(
                success=False,
                file_id=file_id,
                original_filename=filename,
                file_type='unknown',
                data=None,
                validation=validation_result if 'validation_result' in locals() else ValidationResult(
                    is_valid=False, errors=[str(e)], warnings=[], file_info={}
                ),
                processing_time=self._get_processing_time(start_time),
                errors=[f"Processing failed: {str(e)}"],
                warnings=[]
            )
        
        finally:
            # 一時ファイルのクリーンアップ
            if self.cleanup_temp_files and temp_file_path and temp_file_path.exists():
                try:
                    temp_file_path.unlink()
                    logger.debug(f"Cleaned up temp file: {temp_file_path}")
                except Exception as e:
                    logger.warning(f"Failed to cleanup temp file {temp_file_path}: {e}")
    
    def handle_file_stream(self,
                          file_stream: BinaryIO,
                          filename: str,
                          content_type: Optional[str] = None) -> UploadResult:
        """
        ファイルストリームを処理
        
        Args:
            file_stream: ファイルストリーム
            filename: ファイル名
            content_type: コンテンツタイプ
            
        Returns:
            UploadResult: アップロード結果
        """
        try:
            # ストリームからコンテンツを読み込み
            file_content = file_stream.read()
            return self.handle_upload(file_content, filename, content_type)
            
        except Exception as e:
            logger.exception(f"Failed to read file stream for {filename}: {e}")
            return UploadResult(
                success=False,
                file_id=str(uuid.uuid4()),
                original_filename=filename,
                file_type='unknown',
                data=None,
                validation=ValidationResult(
                    is_valid=False, errors=[f"Stream read failed: {str(e)}"], 
                    warnings=[], file_info={}
                ),
                processing_time=0.0,
                errors=[f"Stream read failed: {str(e)}"],
                warnings=[]
            )
    
    def _detect_file_type(self, filename: str, content: bytes) -> str:
        """
        ファイルタイプを検出
        
        Args:
            filename: ファイル名
            content: ファイル内容
            
        Returns:
            str: ファイルタイプ
        """
        # 拡張子ベースの判定
        extension = Path(filename).suffix.lower()
        
        if extension == '.csv':
            return 'csv'
        elif extension in ['.xls', '.xlsx', '.xlsm']:
            return 'excel'
        elif extension == '.txt':
            # テキストファイルの場合は内容を確認してCSVかどうか判定
            try:
                text_content = content[:1000].decode('utf-8', errors='ignore')
                # カンマやタブが含まれていればCSVとみなす
                if ',' in text_content or '\t' in text_content:
                    return 'csv'
                else:
                    return 'text'
            except Exception:
                return 'text'
        
        return 'unknown'
    
    def _parse_file_content(self, content: bytes, file_type: str, filename: str) -> Union[CSVParseResult, ExcelParseResult, None]:
        """
        ファイル内容を解析
        
        Args:
            content: ファイル内容
            file_type: ファイルタイプ
            filename: ファイル名
            
        Returns:
            解析結果
        """
        try:
            if file_type == 'csv':
                return self.csv_parser.parse_content(content)
            elif file_type == 'excel':
                return self.excel_parser.parse_content(content)
            else:
                logger.warning(f"Unsupported file type for parsing: {file_type}")
                return None
                
        except Exception as e:
            logger.exception(f"Failed to parse {file_type} file {filename}: {e}")
            raise
    
    def _save_temp_file(self, content: bytes, filename: str, file_id: str) -> Path:
        """
        一時ファイルに保存
        
        Args:
            content: ファイル内容
            filename: 元のファイル名
            file_id: ファイルID
            
        Returns:
            Path: 一時ファイルのパス
        """
        # 安全なファイル名を生成
        safe_filename = self._sanitize_filename(filename)
        temp_filename = f"{file_id}_{safe_filename}"
        temp_file_path = self.temp_dir / temp_filename
        
        # ファイルに書き込み
        with open(temp_file_path, 'wb') as f:
            f.write(content)
        
        logger.debug(f"Saved temp file: {temp_file_path}")
        return temp_file_path
    
    def _sanitize_filename(self, filename: str) -> str:
        """
        ファイル名をサニタイズ
        
        Args:
            filename: 元のファイル名
            
        Returns:
            str: サニタイズされたファイル名
        """
        # 危険な文字を除去
        import re
        safe_filename = re.sub(r'[^\w\-_\.]', '_', filename)
        
        # 長さ制限
        if len(safe_filename) > 100:
            name, ext = Path(safe_filename).stem, Path(safe_filename).suffix
            safe_filename = name[:100-len(ext)] + ext
        
        return safe_filename
    
    def _get_processing_time(self, start_time: datetime) -> float:
        """
        処理時間を計算
        
        Args:
            start_time: 開始時刻
            
        Returns:
            float: 処理時間（秒）
        """
        return (datetime.now() - start_time).total_seconds()
    
    def get_file_info(self, file_id: str) -> Optional[Dict[str, Any]]:
        """
        ファイル情報を取得
        
        Args:
            file_id: ファイルID
            
        Returns:
            ファイル情報（見つからない場合はNone）
        """
        # 実装では、データベースやキャッシュからファイル情報を取得
        # ここではプレースホルダーとして実装
        logger.debug(f"Getting file info for: {file_id}")
        return None
    
    def cleanup_temp_files(self, older_than_hours: int = 24) -> int:
        """
        古い一時ファイルをクリーンアップ
        
        Args:
            older_than_hours: この時間より古いファイルを削除
            
        Returns:
            int: 削除されたファイル数
        """
        deleted_count = 0
        cutoff_time = datetime.now().timestamp() - (older_than_hours * 3600)
        
        try:
            for temp_file in self.temp_dir.glob('*'):
                if temp_file.is_file() and temp_file.stat().st_mtime < cutoff_time:
                    try:
                        temp_file.unlink()
                        deleted_count += 1
                        logger.debug(f"Deleted old temp file: {temp_file}")
                    except Exception as e:
                        logger.warning(f"Failed to delete temp file {temp_file}: {e}")
            
            logger.info(f"Cleaned up {deleted_count} old temp files")
            return deleted_count
            
        except Exception as e:
            logger.exception(f"Temp file cleanup failed: {e}")
            return deleted_count


class FastAPIFileUploadAdapter:
    """
    FastAPI用のファイルアップロードアダプター
    """
    
    def __init__(self, upload_handler: FileUploadHandler):
        """
        Args:
            upload_handler: ファイルアップロードハンドラー
        """
        self.upload_handler = upload_handler
    
    async def handle_upload_file(self, upload_file) -> UploadResult:
        """
        FastAPIのUploadFileを処理
        
        Args:
            upload_file: FastAPIのUploadFile
            
        Returns:
            UploadResult: アップロード結果
        """
        try:
            # ファイル内容を読み込み
            content = await upload_file.read()
            
            # アップロード処理
            return self.upload_handler.handle_upload(
                file_content=content,
                filename=upload_file.filename or 'unknown',
                content_type=upload_file.content_type
            )
            
        except Exception as e:
            logger.exception(f"FastAPI file upload failed: {e}")
            return UploadResult(
                success=False,
                file_id=str(uuid.uuid4()),
                original_filename=upload_file.filename or 'unknown',
                file_type='unknown',
                data=None,
                validation=ValidationResult(
                    is_valid=False, errors=[str(e)], warnings=[], file_info={}
                ),
                processing_time=0.0,
                errors=[str(e)],
                warnings=[]
            )