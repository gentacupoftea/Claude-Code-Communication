"""
Officeファイル検証のテスト
ZIPシグネチャの誤検出修正を確認
"""

import pytest
import io
import zipfile
from pathlib import Path
from src.file_import.validators import FileValidator, ValidationResult


class TestOfficeFileValidation:
    """Officeファイル検証のテスト"""
    
    @pytest.fixture
    def validator(self):
        return FileValidator()
    
    def create_mock_office_file(self, file_type: str = 'excel') -> bytes:
        """
        モックのOfficeファイルを作成
        
        Args:
            file_type: 'excel', 'word', 'powerpoint'のいずれか
            
        Returns:
            bytes: ZIPベースのOfficeファイル風のバイトデータ
        """
        buffer = io.BytesIO()
        
        with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            # 共通ファイル
            zf.writestr('[Content_Types].xml', '<?xml version="1.0"?><Types></Types>')
            zf.writestr('_rels/.rels', '<?xml version="1.0"?><Relationships></Relationships>')
            zf.writestr('docProps/core.xml', '<?xml version="1.0"?><coreProperties></coreProperties>')
            
            if file_type == 'excel':
                # Excel固有のファイル
                zf.writestr('xl/workbook.xml', '<?xml version="1.0"?><workbook></workbook>')
                zf.writestr('xl/worksheets/sheet1.xml', '<?xml version="1.0"?><worksheet></worksheet>')
                zf.writestr('xl/styles.xml', '<?xml version="1.0"?><styleSheet></styleSheet>')
            elif file_type == 'word':
                # Word固有のファイル
                zf.writestr('word/document.xml', '<?xml version="1.0"?><document></document>')
                zf.writestr('word/_rels/document.xml.rels', '<?xml version="1.0"?><Relationships></Relationships>')
                zf.writestr('word/styles.xml', '<?xml version="1.0"?><styles></styles>')
            elif file_type == 'powerpoint':
                # PowerPoint固有のファイル
                zf.writestr('ppt/presentation.xml', '<?xml version="1.0"?><presentation></presentation>')
                zf.writestr('ppt/slides/slide1.xml', '<?xml version="1.0"?><slide></slide>')
                zf.writestr('ppt/slideLayouts/slideLayout1.xml', '<?xml version="1.0"?><slideLayout></slideLayout>')
        
        return buffer.getvalue()
    
    def create_mock_zip_file(self) -> bytes:
        """通常のZIPファイルを作成"""
        buffer = io.BytesIO()
        
        with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            zf.writestr('file1.txt', 'This is a text file')
            zf.writestr('file2.txt', 'Another text file')
            zf.writestr('folder/file3.txt', 'File in a folder')
        
        return buffer.getvalue()
    
    def test_excel_file_validation(self, validator, tmp_path):
        """Excelファイルが正しく検証されることを確認"""
        # モックExcelファイルを作成
        excel_content = self.create_mock_office_file('excel')
        excel_file = tmp_path / "test.xlsx"
        excel_file.write_bytes(excel_content)
        
        # 検証実行
        result = validator.validate_file(excel_file)
        
        # 検証結果の確認
        assert result.is_valid is True
        assert len(result.errors) == 0
        
        # Office文書として検出されたことを確認
        office_warning_found = any('Office document detected' in w for w in result.warnings)
        assert office_warning_found is True
    
    def test_word_file_validation(self, validator, tmp_path):
        """Wordファイルが正しく検証されることを確認"""
        # モックWordファイルを作成
        word_content = self.create_mock_office_file('word')
        word_file = tmp_path / "test.docx"
        word_file.write_bytes(word_content)
        
        # 検証実行
        result = validator.validate_file(word_file)
        
        # 検証結果の確認
        assert result.is_valid is True
        assert len(result.errors) == 0
        
        # Office文書として検出されたことを確認
        office_warning_found = any('Office document detected' in w for w in result.warnings)
        assert office_warning_found is True
    
    def test_powerpoint_file_validation(self, validator, tmp_path):
        """PowerPointファイルが正しく検証されることを確認"""
        # モックPowerPointファイルを作成
        ppt_content = self.create_mock_office_file('powerpoint')
        ppt_file = tmp_path / "test.pptx"
        ppt_file.write_bytes(ppt_content)
        
        # 検証実行
        result = validator.validate_file(ppt_file)
        
        # 検証結果の確認
        assert result.is_valid is True
        assert len(result.errors) == 0
    
    def test_regular_zip_file_warning(self, validator, tmp_path):
        """通常のZIPファイルには警告が出ることを確認"""
        # 通常のZIPファイルを作成
        zip_content = self.create_mock_zip_file()
        zip_file = tmp_path / "test.zip"
        zip_file.write_bytes(zip_content)
        
        # 許可されていない拡張子なのでエラーになるはず
        result = validator.validate_file(zip_file)
        
        # .zipは許可されていない拡張子
        assert result.is_valid is False
        assert any('File extension not allowed' in e for e in result.errors)
        
        # ZIP形式として検出される警告
        zip_warning_found = any('ZIP-based file detected' in w for w in result.warnings)
        assert zip_warning_found is True
    
    def test_malicious_executable_detection(self, validator, tmp_path):
        """実行ファイルが正しく検出されることを確認"""
        # PE実行ファイルのヘッダー
        exe_content = b'MZ\x90\x00' + b'\x00' * 100
        exe_file = tmp_path / "malicious.exe"
        exe_file.write_bytes(exe_content)
        
        # 検証実行
        result = validator.validate_file(exe_file)
        
        # エラーとして検出されることを確認
        assert result.is_valid is False
        assert any('Executable file detected' in e for e in result.errors)
        assert any('Dangerous file extension' in e for e in result.errors)
    
    def test_corrupted_office_file(self, validator, tmp_path):
        """破損したOfficeファイルの処理"""
        # ZIPヘッダーだけで中身が不正なファイル
        corrupted_content = b'PK\x03\x04' + b'corrupted data' * 100
        corrupted_file = tmp_path / "corrupted.xlsx"
        corrupted_file.write_bytes(corrupted_content)
        
        # 検証実行
        result = validator.validate_file(corrupted_file)
        
        # ZIPとして解析できないため、通常のZIPファイルとして扱われる
        assert result.is_valid is True  # 拡張子は許可されている
        zip_warning_found = any('ZIP-based file detected' in w for w in result.warnings)
        assert zip_warning_found is True
    
    def test_open_document_format(self, validator, tmp_path):
        """OpenDocument形式（LibreOffice等）のファイル検証"""
        buffer = io.BytesIO()
        
        with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            # OpenDocument形式のmimetypeファイル
            zf.writestr('mimetype', 'application/vnd.oasis.opendocument.spreadsheet')
            zf.writestr('META-INF/manifest.xml', '<?xml version="1.0"?><manifest></manifest>')
            zf.writestr('content.xml', '<?xml version="1.0"?><content></content>')
        
        odf_content = buffer.getvalue()
        odf_file = tmp_path / "test.ods"
        odf_file.write_bytes(odf_content)
        
        # .odsは許可されていない拡張子だが、テスト用に一時的に追加
        validator.allowed_extensions.add('.ods')
        
        # 検証実行
        result = validator.validate_file(odf_file)
        
        # 検証結果の確認
        assert result.is_valid is True
        assert len(result.errors) == 0
        
        # Office文書として検出されたことを確認
        office_warning_found = any('Office document detected' in w for w in result.warnings)
        assert office_warning_found is True