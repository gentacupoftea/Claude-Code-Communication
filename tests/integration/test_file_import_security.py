"""
ファイルインポートセキュリティ機能の統合テスト
PR #59で指摘されたセキュリティ問題の修正を検証
"""

import pytest
import os
import tempfile
from pathlib import Path
import zipfile
import io

from src.file_import.validators import FileValidator, ValidationResult
from src.file_import.file_upload import FileUploadHandler
from src.middleware.upload_rate_limit import UploadRateLimiter


class TestFileValidatorSecurity:
    """ファイルバリデーターのセキュリティテスト"""
    
    def setup_method(self):
        """テストセットアップ"""
        self.validator = FileValidator()
    
    def test_office_file_with_zip_signature(self):
        """OfficeファイルがZIP署名で誤って拒否されないことを確認"""
        # 簡易的なOfficeファイル構造を作成
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w') as zf:
            # Excelファイルの基本構造
            zf.writestr('[Content_Types].xml', '<?xml version="1.0"?>')
            zf.writestr('_rels/.rels', '<?xml version="1.0"?>')
            zf.writestr('xl/workbook.xml', '<?xml version="1.0"?>')
            zf.writestr('xl/worksheets/sheet1.xml', '<?xml version="1.0"?>')
        
        content = buffer.getvalue()
        
        # .xlsxファイルとして検証
        result = self.validator.validate_content(content, 'test.xlsx')
        
        # Officeファイルは許可されるべき
        assert result.is_valid is True
        assert not any('ZIP archive detected - not allowed' in error for error in result.errors)
        assert any('Office document detected' in warning for warning in result.warnings)
    
    def test_regular_zip_file_rejected(self):
        """通常のZIPファイルが正しく拒否されることを確認"""
        # 通常のZIPファイルを作成
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w') as zf:
            zf.writestr('test.txt', 'This is a test file')
            zf.writestr('another.txt', 'Another file')
        
        content = buffer.getvalue()
        
        # .zipファイルとして検証
        result = self.validator.validate_content(content, 'test.zip')
        
        # 通常のZIPファイルは拒否されるべき
        assert result.is_valid is False
        assert any('File extension not allowed: .zip' in error for error in result.errors)
    
    def test_excel_macro_detection(self):
        """ExcelマクロファイルのVBA検出テスト"""
        # マクロ付きExcelファイルの簡易構造
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w') as zf:
            # 基本的なExcel構造
            zf.writestr('[Content_Types].xml', '<?xml version="1.0"?>')
            zf.writestr('_rels/.rels', '<?xml version="1.0"?>')
            zf.writestr('xl/workbook.xml', '<?xml version="1.0"?>')
            # VBAプロジェクトファイル
            zf.writestr('xl/vbaProject.bin', b'VBA_PROJECT_DATA')
            zf.writestr('xl/activeX/activeX1.xml', '<?xml version="1.0"?>')
        
        content = buffer.getvalue()
        
        # .xlsmファイルとして検証
        result = self.validator.validate_content(content, 'test.xlsm')
        
        # マクロは警告として検出されるべき
        assert any('VBA macros detected' in warning for warning in result.warnings)
        assert any('Potentially dangerous content detected: xl/activeX/' in warning for warning in result.warnings)
    
    def test_executable_file_rejection(self):
        """実行ファイルが正しく拒否されることを確認"""
        # PE形式の実行ファイルヘッダー
        content = b'MZ' + b'\x00' * 100
        
        result = self.validator.validate_content(content, 'test.exe')
        
        assert result.is_valid is False
        assert any('Dangerous file extension: .exe' in error for error in result.errors)
        assert any('Executable file detected (PE format)' in error for error in result.errors)


class TestRateLimiter:
    """レート制限機能のテスト"""
    
    def setup_method(self):
        """テストセットアップ"""
        self.limiter = UploadRateLimiter(
            requests_per_hour=10,
            requests_per_minute=5,
            burst_size=3,
            block_duration_minutes=1
        )
    
    def test_burst_limit(self):
        """バースト制限のテスト"""
        from fastapi import Request
        from starlette.datastructures import Headers
        from datetime import datetime
        
        # モックリクエストを作成
        class MockClient:
            host = "192.168.1.1"
        
        headers = Headers({'user-agent': 'test'})
        
        # バースト制限内のリクエスト
        for i in range(3):
            request = Request({
                'type': 'http',
                'client': MockClient(),
                'headers': headers,
                'method': 'POST',
                'url': '/upload',
                'query_string': b'',
                'path_params': {},
                'route': None,
                'root_path': '',
            })
            request.state = type('State', (), {})()  # state属性を追加
            
            # asyncioイベントループ内で実行
            import asyncio
            result = asyncio.run(self.limiter.check_limit(request))
            assert result is None  # 制限内
        
        # バースト制限を超えるリクエスト
        request = Request({
            'type': 'http',
            'client': MockClient(),
            'headers': headers,
            'method': 'POST',
            'url': '/upload',
            'query_string': b'',
            'path_params': {},
            'route': None,
            'root_path': '',
        })
        request.state = type('State', (), {})()
        
        result = asyncio.run(self.limiter.check_limit(request))
        assert result is not None  # 制限超過
        assert result.status_code == 429
    
    def test_ip_extraction(self):
        """IPアドレス抽出のテスト"""
        from fastapi import Request
        from starlette.datastructures import Headers
        
        class MockClient:
            host = "192.168.1.1"
        
        # X-Forwarded-Forヘッダーのテスト
        headers = Headers({
            'X-Forwarded-For': '10.0.0.1, 192.168.1.1',
            'user-agent': 'test'
        })
        
        request = Request({
            'type': 'http',
            'client': MockClient(),
            'headers': headers,
            'method': 'POST',
            'url': '/upload',
            'query_string': b'',
            'path_params': {},
            'route': None,
            'root_path': '',
        })
        
        ip = self.limiter._get_client_ip(request)
        assert ip == '10.0.0.1'  # 最初のIPが使用される


class TestFileUploadIntegration:
    """ファイルアップロード統合テスト"""
    
    def setup_method(self):
        """テストセットアップ"""
        self.temp_dir = tempfile.mkdtemp()
        self.handler = FileUploadHandler(temp_dir=self.temp_dir)
    
    def teardown_method(self):
        """テストクリーンアップ"""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_valid_csv_upload(self):
        """有効なCSVファイルのアップロードテスト"""
        content = b"name,age,city\nJohn,30,Tokyo\nJane,25,Osaka"
        
        result = self.handler.handle_upload(content, "test.csv")
        
        assert result.success is True
        assert result.file_type == 'csv'
        assert result.data is not None
        assert result.data.row_count == 2
        assert result.data.headers == ['name', 'age', 'city']
    
    def test_malicious_file_rejection(self):
        """悪意のあるファイルの拒否テスト"""
        # スクリプトを含むCSV
        content = b"name,script\ntest,<script>alert('xss')</script>"
        
        result = self.handler.handle_upload(content, "malicious.csv")
        
        # ファイル自体は処理されるが、警告が出る
        assert any('Suspicious script pattern detected' in warning for warning in result.warnings)
    
    def test_temp_file_cleanup(self):
        """一時ファイルのクリーンアップテスト"""
        content = b"test,data\n1,2"
        
        # ファイルアップロード
        result = self.handler.handle_upload(content, "test.csv")
        
        # 一時ファイルが作成されているか確認
        temp_files = list(Path(self.temp_dir).glob('*'))
        assert len(temp_files) > 0
        
        # クリーンアップ実行
        deleted_count = self.handler.cleanup_temp_files(older_than_hours=0)
        assert deleted_count > 0
        
        # ファイルが削除されているか確認
        temp_files_after = list(Path(self.temp_dir).glob('*'))
        assert len(temp_files_after) == 0


if __name__ == '__main__':
    pytest.main([__file__, '-v'])