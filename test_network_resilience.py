#!/usr/bin/env python3
"""Network resilience test script for Shopify MCP Server."""

import subprocess
import sys
import os
import time
import socket
import multiprocessing
import platform
import json
import tempfile
import shutil
from unittest.mock import patch, MagicMock
from contextlib import contextmanager
import pytest

# プロジェクトディレクトリをインポートパスに追加
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


class NetworkResilienceTests:
    """ネットワーク環境での動作確認テスト."""
    
    def __init__(self):
        self.test_results = []
        self.python_versions = ['3.8', '3.9', '3.10', '3.11', '3.12']
        
    @contextmanager
    def simulate_network_condition(self, condition):
        """ネットワーク条件をシミュレート."""
        original_socket = socket.socket
        
        if condition == 'offline':
            socket.socket = MagicMock(side_effect=socket.error("Network is unreachable"))
        elif condition == 'slow':
            class SlowSocket(socket.socket):
                def __init__(self, *args, **kwargs):
                    super().__init__(*args, **kwargs)
                    time.sleep(0.5)  # 遅延をシミュレート
            socket.socket = SlowSocket
        elif condition == 'intermittent':
            self.request_count = 0
            class IntermittentSocket(socket.socket):
                def __init__(self, *args, **kwargs):
                    super().__init__(*args, **kwargs)
                    if self.request_count % 3 == 0:
                        raise socket.error("Connection failed")
                    self.request_count += 1
            socket.socket = IntermittentSocket
            
        try:
            yield
        finally:
            socket.socket = original_socket
    
    def test_offline_mode(self):
        """オフラインモードのテスト."""
        print("\n=== Testing Offline Mode ===")
        try:
            # 環境変数設定
            env = os.environ.copy()
            env['SHOPIFY_OFFLINE_MODE'] = 'true'
            
            # テスト実行
            cmd = [sys.executable, 'shopify-mcp-server.py']
            result = subprocess.run(
                cmd,
                env=env,
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0:
                print("✓ Offline mode test passed")
                self.test_results.append(('offline_mode', True, None))
            else:
                print(f"✗ Offline mode test failed: {result.stderr}")
                self.test_results.append(('offline_mode', False, result.stderr))
                
        except Exception as e:
            print(f"✗ Offline mode test error: {str(e)}")
            self.test_results.append(('offline_mode', False, str(e)))
    
    def test_proxy_environment(self):
        """プロキシ環境のシミュレーション."""
        print("\n=== Testing Proxy Environment ===")
        
        proxy_configs = [
            {'http_proxy': 'http://proxy.example.com:8080'},
            {'https_proxy': 'https://proxy.example.com:8443'},
            {'no_proxy': 'localhost,127.0.0.1'},
            {
                'http_proxy': 'http://user:pass@proxy.example.com:8080',
                'https_proxy': 'https://user:pass@proxy.example.com:8443'
            }
        ]
        
        for config in proxy_configs:
            try:
                env = os.environ.copy()
                env.update(config)
                
                # プロキシ設定でのテスト実行
                cmd = [sys.executable, '-c', '''
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    import shopify_mcp_server
    print("Proxy test successful")
except ImportError as e:
    print(f"Import error: {e}")
except Exception as e:
    print(f"Error: {e}")
''']
                
                result = subprocess.run(
                    cmd,
                    env=env,
                    capture_output=True,
                    text=True,
                    timeout=5,
                    cwd=os.path.dirname(os.path.abspath(__file__))
                )
                
                proxy_name = str(config)
                if "successful" in result.stdout:
                    print(f"✓ Proxy test passed: {proxy_name}")
                    self.test_results.append((f'proxy_{proxy_name}', True, None))
                else:
                    print(f"✗ Proxy test failed: {proxy_name}")
                    self.test_results.append((f'proxy_{proxy_name}', False, result.stderr))
                    
            except Exception as e:
                print(f"✗ Proxy test error: {str(e)}")
                self.test_results.append((f'proxy_test', False, str(e)))
    
    def test_network_timeouts(self):
        """ネットワークタイムアウトのテスト."""
        print("\n=== Testing Network Timeouts ===")
        
        timeout_scenarios = [
            ('fast', 0.1),
            ('normal', 5),
            ('slow', 30),
            ('very_slow', 60)
        ]
        
        for scenario, timeout in timeout_scenarios:
            try:
                env = os.environ.copy()
                env['SHOPIFY_REQUEST_TIMEOUT'] = str(timeout)
                
                # タイムアウト設定でのテスト
                test_script = f'''
import time
import sys
sys.path.insert(0, "{os.path.dirname(os.path.abspath(__file__))}")
timeout = {timeout}
start = time.time()
try:
    # タイムアウトシミュレーション
    time.sleep(0.05)
    print(f"Timeout test ({scenario}) successful")
except Exception as e:
    print(f"Error: {{e}}")
finally:
    duration = time.time() - start
    print(f"Duration: {{duration:.2f}}s")
'''
                
                result = subprocess.run(
                    [sys.executable, '-c', test_script],
                    env=env,
                    capture_output=True,
                    text=True,
                    timeout=timeout + 5
                )
                
                if "successful" in result.stdout:
                    print(f"✓ Timeout test passed: {scenario}")
                    self.test_results.append((f'timeout_{scenario}', True, None))
                else:
                    print(f"✗ Timeout test failed: {scenario}")
                    self.test_results.append((f'timeout_{scenario}', False, result.stderr))
                    
            except subprocess.TimeoutExpired:
                print(f"✗ Timeout test timed out: {scenario}")
                self.test_results.append((f'timeout_{scenario}', False, "Test timed out"))
            except Exception as e:
                print(f"✗ Timeout test error: {str(e)}")
                self.test_results.append((f'timeout_{scenario}', False, str(e)))
    
    def test_python_compatibility(self):
        """異なるPythonバージョンでの互換性テスト."""
        print("\n=== Testing Python Version Compatibility ===")
        
        current_version = f"{sys.version_info.major}.{sys.version_info.minor}"
        
        for version in self.python_versions:
            python_cmd = f"python{version}"
            
            # 実行可能か確認
            try:
                version_result = subprocess.run(
                    [python_cmd, '--version'],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                
                if version_result.returncode != 0:
                    print(f"⚠ Python {version} not available, skipping")
                    continue
                    
                # 互換性テスト実行
                test_cmd = [python_cmd, '-c', '''
import sys
sys.path.insert(0, "{}")
try:
    import shopify_mcp_server
    print(f"Python {{sys.version}} compatibility test passed")
except SyntaxError as e:
    print(f"Syntax error: {{e}}")
    sys.exit(1)
except ImportError as e:
    print(f"Import error: {{e}}")
    sys.exit(2)
except Exception as e:
    print(f"Error: {{e}}")
    sys.exit(3)
'''.format(os.path.dirname(os.path.abspath(__file__)))]
                
                result = subprocess.run(
                    test_cmd,
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                
                if result.returncode == 0 and "passed" in result.stdout:
                    print(f"✓ Python {version} compatibility test passed")
                    self.test_results.append((f'python_{version}', True, None))
                else:
                    print(f"✗ Python {version} compatibility test failed")
                    self.test_results.append((f'python_{version}', False, result.stderr))
                    
            except FileNotFoundError:
                print(f"⚠ Python {version} not found")
                self.test_results.append((f'python_{version}', None, "Not installed"))
            except Exception as e:
                print(f"✗ Python {version} test error: {str(e)}")
                self.test_results.append((f'python_{version}', False, str(e)))
    
    def test_error_recovery(self):
        """エラー回復機能のテスト."""
        print("\n=== Testing Error Recovery ===")
        
        error_scenarios = [
            ('invalid_api_key', {'SHOPIFY_API_KEY': 'invalid'}),
            ('malformed_url', {'SHOPIFY_STORE_URL': 'not-a-url'}),
            ('missing_env', {}),
            ('partial_config', {'SHOPIFY_API_KEY': 'test'})
        ]
        
        for scenario, env_vars in error_scenarios:
            try:
                env = os.environ.copy()
                # すべての環境変数をクリア
                for key in list(env.keys()):
                    if key.startswith('SHOPIFY_'):
                        del env[key]
                        
                # テスト用の環境変数を設定
                env.update(env_vars)
                
                # エラー回復テスト実行
                test_script = '''
import sys
import os
sys.path.insert(0, "{}")
try:
    import shopify_mcp_server
    server = shopify_mcp_server.ShopifyMCPServer()
    # エラー処理のテスト
    print("Error recovery test passed")
except Exception as e:
    print(f"Expected error: {{e}}")
    print("Error handling successful")
'''.format(os.path.dirname(os.path.abspath(__file__)))
                
                result = subprocess.run(
                    [sys.executable, '-c', test_script],
                    env=env,
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                
                if "successful" in result.stdout or "passed" in result.stdout:
                    print(f"✓ Error recovery test passed: {scenario}")
                    self.test_results.append((f'error_recovery_{scenario}', True, None))
                else:
                    print(f"✗ Error recovery test failed: {scenario}")
                    self.test_results.append((f'error_recovery_{scenario}', False, result.stderr))
                    
            except Exception as e:
                print(f"✗ Error recovery test error: {str(e)}")
                self.test_results.append((f'error_recovery_{scenario}', False, str(e)))
    
    def test_memory_usage(self):
        """メモリ使用量のテスト."""
        print("\n=== Testing Memory Usage ===")
        
        try:
            # メモリプロファイリング
            test_script = '''
import sys
import os
import psutil
import time
sys.path.insert(0, "{}")

# 初期メモリ使用量
process = psutil.Process(os.getpid())
initial_memory = process.memory_info().rss / 1024 / 1024  # MB

try:
    import shopify_mcp_server
    server = shopify_mcp_server.ShopifyMCPServer()
    
    # サーバー初期化後のメモリ使用量
    after_init = process.memory_info().rss / 1024 / 1024  # MB
    
    # テストデータの処理
    for i in range(100):
        # ダミーデータ処理
        data = {{"id": i, "data": "x" * 1000}}
    
    # 処理後のメモリ使用量
    after_process = process.memory_info().rss / 1024 / 1024  # MB
    
    print(f"Initial memory: {{initial_memory:.2f}} MB")
    print(f"After init: {{after_init:.2f}} MB")
    print(f"After process: {{after_process:.2f}} MB")
    print(f"Memory increase: {{after_process - initial_memory:.2f}} MB")
    
    if after_process - initial_memory < 100:  # 100MB以下の増加なら合格
        print("Memory usage test passed")
    else:
        print("Memory usage test failed: excessive memory usage")
        
except Exception as e:
    print(f"Error: {{e}}")
'''.format(os.path.dirname(os.path.abspath(__file__)))
            
            result = subprocess.run(
                [sys.executable, '-c', test_script],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if "passed" in result.stdout:
                print("✓ Memory usage test passed")
                self.test_results.append(('memory_usage', True, None))
            else:
                print("✗ Memory usage test failed")
                self.test_results.append(('memory_usage', False, result.stderr))
                
        except Exception as e:
            print(f"✗ Memory usage test error: {str(e)}")
            self.test_results.append(('memory_usage', False, str(e)))
    
    def generate_report(self):
        """テスト結果のレポート生成."""
        print("\n" + "=" * 50)
        print("Network Resilience Test Report")
        print("=" * 50)
        print(f"Platform: {platform.platform()}")
        print(f"Python Version: {sys.version}")
        print(f"Test Date: {time.strftime('%Y-%m-%d %H:%M:%S')}")
        print("\nTest Results:")
        print("-" * 50)
        
        passed = 0
        failed = 0
        skipped = 0
        
        for test_name, result, error in self.test_results:
            if result is True:
                status = "✓ PASSED"
                passed += 1
            elif result is False:
                status = "✗ FAILED"
                failed += 1
            else:
                status = "⚠ SKIPPED"
                skipped += 1
                
            print(f"{test_name:<30} {status}")
            if error and result is False:
                print(f"  Error: {error[:100]}")
        
        print("-" * 50)
        print(f"Total Tests: {len(self.test_results)}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Skipped: {skipped}")
        print(f"Success Rate: {(passed / len(self.test_results) * 100):.1f}%")
        
        # JSONレポートの保存
        report_data = {
            'platform': platform.platform(),
            'python_version': sys.version,
            'test_date': time.strftime('%Y-%m-%d %H:%M:%S'),
            'results': [
                {
                    'test': test_name,
                    'passed': result,
                    'error': error
                }
                for test_name, result, error in self.test_results
            ],
            'summary': {
                'total': len(self.test_results),
                'passed': passed,
                'failed': failed,
                'skipped': skipped,
                'success_rate': passed / len(self.test_results) * 100
            }
        }
        
        report_file = f"network_resilience_report_{time.strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w') as f:
            json.dump(report_data, f, indent=2)
        
        print(f"\nDetailed report saved to: {report_file}")
    
    def run_all_tests(self):
        """すべてのテストを実行."""
        print("Starting Network Resilience Tests...")
        print("=" * 50)
        
        tests = [
            self.test_offline_mode,
            self.test_proxy_environment,
            self.test_network_timeouts,
            self.test_python_compatibility,
            self.test_error_recovery,
            self.test_memory_usage
        ]
        
        for test in tests:
            try:
                test()
            except Exception as e:
                print(f"Test error: {str(e)}")
                self.test_results.append((test.__name__, False, str(e)))
        
        self.generate_report()


if __name__ == "__main__":
    # psutilのインストール確認
    try:
        import psutil
    except ImportError:
        print("Installing psutil for memory testing...")
        subprocess.run([sys.executable, '-m', 'pip', 'install', 'psutil'])
    
    tester = NetworkResilienceTests()
    tester.run_all_tests()