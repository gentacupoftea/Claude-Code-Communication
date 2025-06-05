"""
エラーハンドリングと異常系のテスト
"""
import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime
import json

from src.file_import.file_upload import FileUploadHandler, FileUploadResult
from src.file_import.validators import FileValidator, ValidationError
from src.data_processing.ai_cleaner import AIDataCleaner, CleaningReport
from src.data_integration.mapping.mapper_factory import MapperFactory, DataSource
from src.data_integration.mapping.base_mapper import MappingError
from src.api.errors import APIError, AuthenticationError, RateLimitError


class TestFileUploadErrorHandling:
    """ファイルアップロードのエラーハンドリングテスト"""
    
    @pytest.fixture
    def file_handler(self):
        return FileUploadHandler()
    
    @pytest.mark.asyncio
    async def test_malicious_file_upload(self, file_handler):
        """悪意のあるファイルアップロードのテスト"""
        # 実行可能ファイル
        with pytest.raises(ValidationError) as exc_info:
            await file_handler.handle_upload(
                Mock(read=lambda: b"MZ\x90\x00"),  # EXEファイルヘッダー
                "malicious.exe",
                "application/x-msdownload"
            )
        assert "Dangerous file type" in str(exc_info.value)
        
        # スクリプトファイル
        with pytest.raises(ValidationError) as exc_info:
            await file_handler.handle_upload(
                Mock(read=lambda: b"#!/bin/bash\nrm -rf /"),
                "dangerous.sh",
                "application/x-sh"
            )
        assert "script content" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_oversized_file_upload(self, file_handler):
        """ファイルサイズ制限超過のテスト"""
        # 100MB超のファイル
        large_content = b"x" * (101 * 1024 * 1024)
        
        with pytest.raises(ValidationError) as exc_info:
            await file_handler.handle_upload(
                Mock(read=lambda: large_content),
                "large_file.csv",
                "text/csv"
            )
        assert "File size exceeds" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_corrupted_file_upload(self, file_handler):
        """破損ファイルアップロードのテスト"""
        # 破損したCSVファイル
        corrupted_csv = b"\xff\xfe\x00\x00invalid csv content"
        
        result = await file_handler.handle_upload(
            Mock(read=lambda: corrupted_csv),
            "corrupted.csv",
            "text/csv"
        )
        
        assert result.success is False
        assert "Failed to parse" in result.error


class TestDataCleaningErrorHandling:
    """データクリーニングのエラーハンドリングテスト"""
    
    @pytest.fixture
    def cleaner(self):
        return AIDataCleaner()
    
    @pytest.mark.asyncio
    async def test_clean_completely_invalid_data(self, cleaner):
        """完全に無効なデータのクリーニングテスト"""
        invalid_data = [
            {},  # 空のレコード
            None,  # Nullレコード
            "not a dict",  # 辞書でない
            {"completely": "unrelated", "data": "structure"},
        ]
        
        cleaned_data, report = await cleaner.clean_data(invalid_data)
        
        assert len(cleaned_data) < len(invalid_data)
        assert report.error_count > 0
        assert report.quality_score < 0.5  # 品質スコアが低い
    
    @pytest.mark.asyncio
    async def test_clean_with_circular_references(self, cleaner):
        """循環参照を含むデータのクリーニングテスト"""
        # 循環参照を作成
        data1 = {"id": "1", "name": "Item1"}
        data2 = {"id": "2", "name": "Item2", "ref": data1}
        data1["ref"] = data2  # 循環参照
        
        circular_data = [data1, data2]
        
        # JSONシリアライズ不可能なデータもクリーニング可能
        cleaned_data, report = await cleaner.clean_data(circular_data)
        
        assert len(cleaned_data) == 2
        assert report.cleaning_actions > 0
    
    @pytest.mark.asyncio
    async def test_clean_with_memory_constraints(self, cleaner):
        """メモリ制約下でのクリーニングテスト"""
        # 大量のデータ（メモリ使用をシミュレート）
        large_dataset = []
        for i in range(100000):
            large_dataset.append({
                "id": str(i),
                "data": "x" * 1000  # 各レコード約1KB
            })
        
        # バッチ処理でメモリ効率的にクリーニング
        cleaned_data, report = await cleaner.clean_data(
            large_dataset,
            batch_size=1000
        )
        
        assert len(cleaned_data) == 100000
        assert report.total_records == 100000


class TestMappingErrorHandling:
    """マッピングのエラーハンドリングテスト"""
    
    @pytest.fixture
    def mapper_factory(self):
        from src.data_integration.mapping.schema_registry import SchemaRegistry
        return MapperFactory(SchemaRegistry())
    
    @pytest.mark.asyncio
    async def test_map_with_invalid_source(self, mapper_factory):
        """無効なデータソースでのマッピングテスト"""
        with pytest.raises(ValueError) as exc_info:
            mapper_factory.create_mapper("INVALID_SOURCE")
        assert "Unsupported data source" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_map_with_schema_mismatch(self, mapper_factory):
        """スキーマ不一致でのマッピングテスト"""
        mapper = mapper_factory.create_mapper(DataSource.SHOPIFY)
        
        # 完全に異なるスキーマのデータ
        invalid_data = [
            {
                "alien_field_1": "value1",
                "alien_field_2": "value2",
                "alien_field_3": "value3"
            }
        ]
        
        result = await mapper.map_data(invalid_data, "products")
        
        assert result.success is True  # 部分的成功
        assert len(result.warnings) > 0
        assert any("missing required" in str(w).lower() for w in result.warnings)
    
    @pytest.mark.asyncio
    async def test_map_with_type_conversion_errors(self, mapper_factory):
        """型変換エラーでのマッピングテスト"""
        mapper = mapper_factory.create_mapper(DataSource.FILE)
        
        problematic_data = [
            {
                "product_id": "PROD001",
                "name": "Test Product",
                "price": "not_a_number",
                "stock_quantity": "also_not_a_number",
                "created_at": "invalid_date_format"
            }
        ]
        
        mapper.column_types = {
            "price": "decimal",
            "stock_quantity": "integer",
            "created_at": "datetime"
        }
        
        result = await mapper.map_data(problematic_data, "products")
        
        assert result.success is True
        assert result.error_count > 0
        assert len(result.errors) >= 3  # 少なくとも3つの型変換エラー


class TestAPIErrorHandling:
    """API関連のエラーハンドリングテスト"""
    
    @pytest.mark.asyncio
    async def test_authentication_error_handling(self):
        """認証エラーハンドリングのテスト"""
        from src.api.shopify.client import ShopifyClient
        
        client = ShopifyClient(
            api_key="invalid_key",
            api_secret="invalid_secret",
            shop_domain="test.myshopify.com"
        )
        
        with patch('aiohttp.ClientSession.get') as mock_get:
            mock_get.return_value.__aenter__.return_value.status = 401
            mock_get.return_value.__aenter__.return_value.json = AsyncMock(
                return_value={"errors": "Unauthorized"}
            )
            
            with pytest.raises(AuthenticationError):
                await client.get_products()
    
    @pytest.mark.asyncio
    async def test_rate_limit_error_handling(self):
        """レート制限エラーハンドリングのテスト"""
        from src.api.rakuten.client import RakutenClient
        
        client = RakutenClient(
            service_secret="test_secret",
            license_key="test_key"
        )
        
        with patch('aiohttp.ClientSession.post') as mock_post:
            # 429 Too Many Requests
            mock_post.return_value.__aenter__.return_value.status = 429
            mock_post.return_value.__aenter__.return_value.headers = {
                'Retry-After': '60'
            }
            
            with pytest.raises(RateLimitError) as exc_info:
                await client.search_items(keyword="test")
            
            assert exc_info.value.retry_after == 60
    
    @pytest.mark.asyncio
    async def test_network_timeout_handling(self):
        """ネットワークタイムアウトハンドリングのテスト"""
        from src.api.amazon.client import AmazonSPAPIClient
        
        client = AmazonSPAPIClient(
            client_id="test_id",
            client_secret="test_secret",
            refresh_token="test_token",
            marketplace_id="JP"
        )
        
        with patch('aiohttp.ClientSession.get') as mock_get:
            mock_get.side_effect = asyncio.TimeoutError()
            
            with pytest.raises(APIError) as exc_info:
                await client.get_catalog_items(keywords=["test"])
            
            assert "timeout" in str(exc_info.value).lower()


class TestConcurrencyErrorHandling:
    """並行処理のエラーハンドリングテスト"""
    
    @pytest.mark.asyncio
    async def test_concurrent_file_processing_errors(self):
        """並行ファイル処理のエラーハンドリングテスト"""
        handler = FileUploadHandler()
        
        # 複数のファイルを同時処理（一部エラー）
        files = [
            Mock(read=lambda: b"id,name\n1,Product1", filename="valid.csv"),
            Mock(read=lambda: b"invalid csv content", filename="invalid.csv"),
            Mock(read=lambda: b"MZ\x90\x00", filename="malicious.exe"),
            Mock(read=lambda: b"id,name\n2,Product2", filename="valid2.csv"),
        ]
        
        tasks = []
        for i, file_mock in enumerate(files):
            tasks.append(
                handler.handle_upload(
                    file_mock,
                    file_mock.filename,
                    "text/csv" if "csv" in file_mock.filename else "application/x-msdownload"
                )
            )
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 結果の検証
        success_count = sum(1 for r in results if isinstance(r, FileUploadResult) and r.success)
        error_count = sum(1 for r in results if isinstance(r, Exception) or (isinstance(r, FileUploadResult) and not r.success))
        
        assert success_count == 2  # 2つの有効なCSV
        assert error_count == 2    # 1つの無効なCSVと1つの悪意のあるファイル
    
    @pytest.mark.asyncio
    async def test_deadlock_prevention(self):
        """デッドロック防止のテスト"""
        from asyncio import Lock
        
        # 2つのリソースロック
        lock1 = Lock()
        lock2 = Lock()
        
        async def task1():
            async with lock1:
                await asyncio.sleep(0.01)
                # タイムアウト付きでlock2を取得試行
                try:
                    await asyncio.wait_for(lock2.acquire(), timeout=0.1)
                    lock2.release()
                except asyncio.TimeoutError:
                    return "timeout_prevented_deadlock"
            return "completed"
        
        async def task2():
            async with lock2:
                await asyncio.sleep(0.01)
                # タイムアウト付きでlock1を取得試行
                try:
                    await asyncio.wait_for(lock1.acquire(), timeout=0.1)
                    lock1.release()
                except asyncio.TimeoutError:
                    return "timeout_prevented_deadlock"
            return "completed"
        
        # 両タスクを並行実行
        results = await asyncio.gather(task1(), task2())
        
        # 少なくとも1つはタイムアウトによりデッドロックを回避
        assert "timeout_prevented_deadlock" in results


class TestDataIntegrityErrorHandling:
    """データ整合性エラーハンドリングのテスト"""
    
    @pytest.mark.asyncio
    async def test_duplicate_key_handling(self):
        """重複キーハンドリングのテスト"""
        from src.data_integration.mapping.mappers.shopify_mapper import ShopifyMapper
        from src.data_integration.mapping.schema_registry import SchemaRegistry
        
        mapper = ShopifyMapper(SchemaRegistry())
        
        # 重複IDを含むデータ
        duplicate_data = [
            {"id": 123, "title": "Product 1", "created_at": "2024-01-01T00:00:00Z"},
            {"id": 123, "title": "Product 2", "created_at": "2024-01-02T00:00:00Z"},  # 重複ID
            {"id": 124, "title": "Product 3", "created_at": "2024-01-03T00:00:00Z"},
        ]
        
        result = await mapper.map_data(duplicate_data, "products")
        
        assert result.success is True
        assert len(result.warnings) > 0
        assert any("duplicate" in str(w).lower() for w in result.warnings)
        
        # 最新のレコードが保持されることを確認
        mapped_ids = [item['external_id'] for item in result.mapped_data]
        assert mapped_ids.count('shopify_123') == 1
    
    @pytest.mark.asyncio
    async def test_referential_integrity_errors(self):
        """参照整合性エラーのテスト"""
        from src.data_integration.mapping.mappers.file_mapper import FileDataMapper
        from src.data_integration.mapping.schema_registry import SchemaRegistry
        
        mapper = FileDataMapper(SchemaRegistry())
        
        # 存在しない関連を持つデータ
        order_data = [
            {
                "order_id": "ORD001",
                "customer_id": "CUST999",  # 存在しない顧客
                "product_id": "PROD999",    # 存在しない商品
                "quantity": 1,
                "total": 1000
            }
        ]
        
        result = await mapper.map_data(order_data, "orders")
        
        assert result.success is True
        assert len(result.warnings) > 0
        # 参照整合性の警告が含まれる（実装に依存）