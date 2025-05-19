"""
Performance tests for export functionality
エクスポート機能のパフォーマンステスト
"""

import pytest
import pandas as pd
import numpy as np
import time
import memory_profiler
import concurrent.futures
import asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, patch
import psutil
import os

from src.analytics.dashboard.analytics_processor import AnalyticsProcessor
from src.api.shopify_api import ShopifyAPI


class TestExportPerformance:
    """エクスポート機能のパフォーマンステスト"""
    
    @pytest.fixture
    def large_dataset_10k(self):
        """10,000レコードのテストデータ"""
        return self._generate_test_data(10000)
    
    @pytest.fixture
    def large_dataset_100k(self):
        """100,000レコードのテストデータ"""
        return self._generate_test_data(100000)
    
    @pytest.fixture
    def large_dataset_1m(self):
        """1,000,000レコードのテストデータ"""
        return self._generate_test_data(1000000)
    
    def _generate_test_data(self, num_records):
        """テストデータ生成"""
        np.random.seed(42)
        return [
            {
                'id': str(i),
                'order_number': f'ORDER-{i:08d}',
                'customer_id': f'CUST-{i % 10000:05d}',
                'customer_email': f'customer{i % 10000}@example.com',
                'total_price': round(np.random.uniform(10, 10000), 2),
                'currency': np.random.choice(['JPY', 'USD', 'EUR']),
                'status': np.random.choice(['pending', 'processing', 'completed', 'cancelled']),
                'created_at': (datetime.now() - timedelta(days=np.random.randint(0, 365))).isoformat(),
                'updated_at': datetime.now().isoformat(),
                'line_items': [
                    {
                        'product_id': f'PROD-{j:04d}',
                        'variant_id': f'VAR-{j:04d}-{k:02d}',
                        'quantity': np.random.randint(1, 5),
                        'price': round(np.random.uniform(10, 1000), 2)
                    }
                    for j in range(np.random.randint(1, 10))
                    for k in range(np.random.randint(1, 3))
                ],
                'shipping_address': {
                    'country': np.random.choice(['JP', 'US', 'GB', 'FR', 'DE']),
                    'state': f'State-{np.random.randint(1, 50)}',
                    'city': f'City-{np.random.randint(1, 100)}',
                    'postal_code': f'{np.random.randint(10000, 99999)}'
                },
                'tags': [f'tag-{i}' for i in range(np.random.randint(0, 5))],
                'metadata': {
                    'source': np.random.choice(['web', 'mobile', 'api']),
                    'user_agent': 'Mozilla/5.0',
                    'ip_address': f'{np.random.randint(1, 255)}.{np.random.randint(1, 255)}.{np.random.randint(1, 255)}.{np.random.randint(1, 255)}'
                }
            }
            for i in range(num_records)
        ]
    
    def test_csv_export_10k_records(self, large_dataset_10k):
        """10,000レコードのCSVエクスポートパフォーマンス"""
        processor = AnalyticsProcessor(Mock())
        
        start_time = time.time()
        result = processor.export_data(large_dataset_10k, format='csv')
        end_time = time.time()
        
        execution_time = end_time - start_time
        file_size_mb = len(result) / (1024 * 1024)
        
        print(f"\n10K CSV Export: {execution_time:.2f}s, Size: {file_size_mb:.2f}MB")
        assert execution_time < 2.0  # Should complete within 2 seconds
        assert len(result) > 0
    
    def test_json_export_10k_records(self, large_dataset_10k):
        """10,000レコードのJSONエクスポートパフォーマンス"""
        processor = AnalyticsProcessor(Mock())
        
        start_time = time.time()
        result = processor.export_data(large_dataset_10k, format='json')
        end_time = time.time()
        
        execution_time = end_time - start_time
        file_size_mb = len(result) / (1024 * 1024)
        
        print(f"\n10K JSON Export: {execution_time:.2f}s, Size: {file_size_mb:.2f}MB")
        assert execution_time < 3.0  # JSON is typically slower than CSV
        assert len(result) > 0
    
    def test_excel_export_10k_records(self, large_dataset_10k):
        """10,000レコードのExcelエクスポートパフォーマンス"""
        processor = AnalyticsProcessor(Mock())
        
        start_time = time.time()
        result = processor.export_data(large_dataset_10k, format='excel')
        end_time = time.time()
        
        execution_time = end_time - start_time
        file_size_mb = len(result) / (1024 * 1024)
        
        print(f"\n10K Excel Export: {execution_time:.2f}s, Size: {file_size_mb:.2f}MB")
        assert execution_time < 5.0  # Excel is typically slowest
        assert len(result) > 0
    
    @pytest.mark.slow
    def test_large_dataset_100k_records(self, large_dataset_100k):
        """100,000レコードのエクスポートパフォーマンス"""
        processor = AnalyticsProcessor(Mock())
        
        # Test all formats
        formats = ['csv', 'json', 'excel']
        results = {}
        
        for format_type in formats:
            start_time = time.time()
            result = processor.export_data(large_dataset_100k, format=format_type)
            end_time = time.time()
            
            results[format_type] = {
                'time': end_time - start_time,
                'size': len(result) / (1024 * 1024)
            }
        
        # Print results
        print("\n100K Records Export Performance:")
        for format_type, metrics in results.items():
            print(f"{format_type.upper()}: {metrics['time']:.2f}s, {metrics['size']:.2f}MB")
        
        # Performance assertions
        assert results['csv']['time'] < 20.0
        assert results['json']['time'] < 30.0
        assert results['excel']['time'] < 60.0
    
    def test_memory_usage_export(self, large_dataset_10k):
        """メモリ使用量のテスト"""
        processor = AnalyticsProcessor(Mock())
        process = psutil.Process(os.getpid())
        
        # Initial memory
        initial_memory = process.memory_info().rss / (1024 * 1024)  # MB
        
        # Export data
        result = processor.export_data(large_dataset_10k, format='csv')
        
        # Peak memory
        peak_memory = process.memory_info().rss / (1024 * 1024)  # MB
        memory_increase = peak_memory - initial_memory
        
        print(f"\nMemory Usage - Initial: {initial_memory:.2f}MB, Peak: {peak_memory:.2f}MB, Increase: {memory_increase:.2f}MB")
        
        # Memory increase should be reasonable
        assert memory_increase < 500  # Less than 500MB increase
    
    def test_concurrent_exports_performance(self, large_dataset_10k):
        """並列エクスポートのパフォーマンステスト"""
        processor = AnalyticsProcessor(Mock())
        
        def export_task(format_type):
            return processor.export_data(large_dataset_10k[:1000], format=format_type)
        
        # Single threaded
        start_time = time.time()
        results_sequential = []
        for format_type in ['csv', 'json', 'excel']:
            results_sequential.append(export_task(format_type))
        sequential_time = time.time() - start_time
        
        # Multi-threaded
        start_time = time.time()
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            futures = [
                executor.submit(export_task, 'csv'),
                executor.submit(export_task, 'json'),
                executor.submit(export_task, 'excel')
            ]
            results_concurrent = [f.result() for f in futures]
        concurrent_time = time.time() - start_time
        
        print(f"\nConcurrent Export Performance:")
        print(f"Sequential: {sequential_time:.2f}s")
        print(f"Concurrent: {concurrent_time:.2f}s")
        print(f"Speedup: {sequential_time/concurrent_time:.2f}x")
        
        # Concurrent should be faster
        assert concurrent_time < sequential_time
        assert all(len(r) > 0 for r in results_concurrent)
    
    def test_streaming_export_performance(self, large_dataset_100k):
        """ストリーミングエクスポートのパフォーマンステスト"""
        processor = AnalyticsProcessor(Mock())
        
        # Simulate streaming by processing in chunks
        chunk_size = 10000
        total_time = 0
        total_size = 0
        
        for i in range(0, len(large_dataset_100k), chunk_size):
            chunk = large_dataset_100k[i:i + chunk_size]
            
            start_time = time.time()
            result = processor.export_data(chunk, format='csv')
            end_time = time.time()
            
            total_time += (end_time - start_time)
            total_size += len(result)
        
        print(f"\nStreaming Export (100K in 10K chunks):")
        print(f"Total Time: {total_time:.2f}s")
        print(f"Total Size: {total_size / (1024 * 1024):.2f}MB")
        print(f"Average chunk time: {total_time / (len(large_dataset_100k) / chunk_size):.2f}s")
        
        assert total_time < 30.0  # Should be efficient
    
    def test_format_comparison_performance(self, large_dataset_10k):
        """異なるフォーマットのパフォーマンス比較"""
        processor = AnalyticsProcessor(Mock())
        
        results = {}
        formats = ['csv', 'json', 'excel']
        
        for format_type in formats:
            # Time the export
            start_time = time.time()
            exported_data = processor.export_data(large_dataset_10k, format=format_type)
            end_time = time.time()
            
            # Measure metrics
            export_time = end_time - start_time
            file_size = len(exported_data)
            records_per_second = len(large_dataset_10k) / export_time
            
            results[format_type] = {
                'time': export_time,
                'size': file_size,
                'size_mb': file_size / (1024 * 1024),
                'records_per_second': records_per_second,
                'mb_per_second': (file_size / (1024 * 1024)) / export_time
            }
        
        # Print comparison
        print("\nFormat Performance Comparison (10K records):")
        print(f"{'Format':<10} {'Time(s)':<10} {'Size(MB)':<10} {'Rec/s':<15} {'MB/s':<10}")
        print("-" * 60)
        for format_type, metrics in results.items():
            print(f"{format_type:<10} {metrics['time']:<10.2f} {metrics['size_mb']:<10.2f} "
                  f"{metrics['records_per_second']:<15.0f} {metrics['mb_per_second']:<10.2f}")
        
        # CSV should be fastest
        assert results['csv']['time'] <= results['json']['time']
        assert results['csv']['time'] <= results['excel']['time']
    
    @pytest.mark.slow
    def test_worst_case_scenario(self):
        """最悪ケースシナリオのテスト"""
        # Generate worst-case data (maximum nesting, long strings)
        worst_case_data = []
        for i in range(1000):
            record = {
                'id': str(i),
                'deep_nested': self._create_deep_nested_structure(5),
                'long_string': 'x' * 10000,  # 10KB string
                'many_fields': {f'field_{j}': f'value_{j}' * 100 for j in range(100)},
                'unicode_heavy': '漢字テスト' * 1000,
                'special_chars': '!@#$%^&*()_+{}[]|\\:";\'<>,.?/' * 100
            }
            worst_case_data.append(record)
        
        processor = AnalyticsProcessor(Mock())
        
        # Test export performance
        start_time = time.time()
        result = processor.export_data(worst_case_data, format='json')
        end_time = time.time()
        
        execution_time = end_time - start_time
        print(f"\nWorst Case Export (1K complex records): {execution_time:.2f}s")
        
        # Should still complete in reasonable time
        assert execution_time < 30.0
        assert len(result) > 0
    
    def _create_deep_nested_structure(self, depth):
        """深くネストされた構造を作成"""
        if depth == 0:
            return "leaf_value"
        return {
            f'level_{depth}': self._create_deep_nested_structure(depth - 1),
            f'array_{depth}': [self._create_deep_nested_structure(depth - 1) for _ in range(3)]
        }
    
    def test_memory_leak_detection(self, large_dataset_10k):
        """メモリリークの検出テスト"""
        processor = AnalyticsProcessor(Mock())
        process = psutil.Process(os.getpid())
        
        initial_memory = process.memory_info().rss / (1024 * 1024)
        memory_readings = []
        
        # Perform multiple exports
        for i in range(10):
            result = processor.export_data(large_dataset_10k[:1000], format='csv')
            current_memory = process.memory_info().rss / (1024 * 1024)
            memory_readings.append(current_memory)
            
            # Force garbage collection
            import gc
            gc.collect()
        
        final_memory = process.memory_info().rss / (1024 * 1024)
        
        print(f"\nMemory Leak Test:")
        print(f"Initial: {initial_memory:.2f}MB")
        print(f"Final: {final_memory:.2f}MB")
        print(f"Max during test: {max(memory_readings):.2f}MB")
        
        # Memory should not grow significantly
        memory_growth = final_memory - initial_memory
        assert memory_growth < 50  # Less than 50MB growth after 10 iterations


class TestPerformanceBenchmarks:
    """パフォーマンスベンチマーク"""
    
    def test_benchmark_suite(self):
        """総合ベンチマークテスト"""
        processor = AnalyticsProcessor(Mock())
        
        # Different data sizes
        sizes = [100, 1000, 10000, 50000]
        formats = ['csv', 'json', 'excel']
        
        results = {}
        
        for size in sizes:
            data = self._generate_test_data(size)
            results[size] = {}
            
            for format_type in formats:
                start_time = time.time()
                exported = processor.export_data(data, format=format_type)
                end_time = time.time()
                
                results[size][format_type] = {
                    'time': end_time - start_time,
                    'size': len(exported),
                    'throughput': size / (end_time - start_time)
                }
        
        # Print benchmark results
        print("\nPerformance Benchmark Results:")
        print(f"{'Size':<10} {'Format':<10} {'Time(s)':<10} {'Size(MB)':<10} {'Throughput(rec/s)':<20}")
        print("-" * 70)
        
        for size, format_results in results.items():
            for format_type, metrics in format_results.items():
                print(f"{size:<10} {format_type:<10} {metrics['time']:<10.3f} "
                      f"{metrics['size']/(1024*1024):<10.2f} {metrics['throughput']:<20.0f}")
        
        # Verify performance scales appropriately
        for format_type in formats:
            times = [results[size][format_type]['time'] for size in sizes]
            # Time should not grow exponentially
            growth_rate = times[-1] / times[0]
            size_growth = sizes[-1] / sizes[0]
            assert growth_rate < size_growth * 2  # Allow for some overhead
    
    def _generate_test_data(self, num_records):
        """テストデータ生成（簡易版）"""
        return [
            {
                'id': str(i),
                'value': i * 10,
                'name': f'Record {i}',
                'timestamp': datetime.now().isoformat()
            }
            for i in range(num_records)
        ]


if __name__ == '__main__':
    pytest.main([__file__, '-v', '-s'])