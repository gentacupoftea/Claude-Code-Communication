#!/usr/bin/env python3
"""
Run all export functionality tests
エクスポート機能のテスト実行スクリプト
"""

import os
import sys
import subprocess
import time
from datetime import datetime


def run_tests():
    """Run all export tests and generate report."""
    print("=" * 60)
    print(f"エクスポート機能テスト実行 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    test_suites = [
        {
            'name': '単体テスト',
            'path': 'tests/analytics/test_export_functionality.py',
            'description': '各エクスポート形式の機能テスト'
        },
        {
            'name': '統合テスト',
            'path': 'tests/integration/test_export_integration.py',
            'description': 'API統合とプラットフォーム連携テスト'
        },
        {
            'name': 'パフォーマンステスト',
            'path': 'tests/performance/test_export_performance.py',
            'description': '大規模データのパフォーマンステスト'
        }
    ]
    
    results = []
    total_start = time.time()
    
    for suite in test_suites:
        print(f"\n--- {suite['name']} ---")
        print(f"説明: {suite['description']}")
        print(f"ファイル: {suite['path']}")
        
        start_time = time.time()
        
        # Run pytest with coverage and junit output
        cmd = [
            'pytest',
            suite['path'],
            '-v',
            '--cov=src/analytics',
            '--cov-report=term-missing',
            f'--junit-xml=test_results/{os.path.basename(suite["path"])}.xml'
        ]
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True)
            end_time = time.time()
            
            if result.returncode == 0:
                status = '✅ 成功'
            else:
                status = '❌ 失敗'
            
            results.append({
                'name': suite['name'],
                'status': status,
                'duration': end_time - start_time,
                'returncode': result.returncode,
                'stdout': result.stdout,
                'stderr': result.stderr
            })
            
            print(f"結果: {status}")
            print(f"実行時間: {end_time - start_time:.2f}秒")
            
        except Exception as e:
            print(f"エラー: {e}")
            results.append({
                'name': suite['name'],
                'status': '❌ エラー',
                'error': str(e)
            })
    
    total_end = time.time()
    
    # Generate summary report
    print("\n" + "=" * 60)
    print("テスト結果サマリー")
    print("=" * 60)
    
    for result in results:
        print(f"{result['name']}: {result['status']}")
        if 'duration' in result:
            print(f"  実行時間: {result['duration']:.2f}秒")
        if 'error' in result:
            print(f"  エラー: {result['error']}")
    
    print(f"\n総実行時間: {total_end - total_start:.2f}秒")
    
    # Create HTML report
    create_html_report(results, total_end - total_start)
    
    # Check if all tests passed
    all_passed = all(r.get('returncode', 1) == 0 for r in results)
    return 0 if all_passed else 1


def create_html_report(results, total_duration):
    """Create HTML test report."""
    html_content = f"""
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <title>エクスポート機能テストレポート</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        .header {{ background-color: #f0f0f0; padding: 20px; }}
        .success {{ color: green; }}
        .failure {{ color: red; }}
        .test-results {{ margin-top: 20px; }}
        table {{ border-collapse: collapse; width: 100%; }}
        th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
        th {{ background-color: #f2f2f2; }}
        pre {{ background-color: #f5f5f5; padding: 10px; overflow-x: auto; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>エクスポート機能テストレポート</h1>
        <p>実行日時: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        <p>総実行時間: {total_duration:.2f}秒</p>
    </div>
    
    <div class="test-results">
        <h2>テスト結果</h2>
        <table>
            <tr>
                <th>テストスイート</th>
                <th>状態</th>
                <th>実行時間</th>
                <th>詳細</th>
            </tr>
"""
    
    for result in results:
        status_class = 'success' if '成功' in result['status'] else 'failure'
        html_content += f"""
            <tr>
                <td>{result['name']}</td>
                <td class="{status_class}">{result['status']}</td>
                <td>{result.get('duration', '-'):.2f}秒</td>
                <td>
                    <details>
                        <summary>詳細を表示</summary>
                        <pre>{result.get('stdout', result.get('error', ''))}</pre>
                    </details>
                </td>
            </tr>
"""
    
    html_content += """
        </table>
    </div>
    
    <div class="coverage">
        <h2>カバレッジ情報</h2>
        <p>※ 各テストの出力を参照してください</p>
    </div>
</body>
</html>
"""
    
    # Save HTML report
    os.makedirs('test_results', exist_ok=True)
    report_path = 'test_results/export_test_report.html'
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print(f"\nHTMLレポートを作成しました: {report_path}")


def install_dependencies():
    """Install required test dependencies."""
    print("テスト依存関係をインストール...")
    dependencies = [
        'pytest',
        'pytest-cov',
        'pytest-asyncio',
        'pandas',
        'numpy',
        'matplotlib',
        'reportlab',
        'psutil',
        'memory_profiler',
        'fastapi',
        'httpx'
    ]
    
    cmd = [sys.executable, '-m', 'pip', 'install'] + dependencies
    subprocess.run(cmd)


if __name__ == '__main__':
    # Check if dependencies are installed
    try:
        import pytest
        import pandas
        import reportlab
    except ImportError:
        print("必要な依存関係をインストールします...")
        install_dependencies()
    
    # Create test results directory
    os.makedirs('test_results', exist_ok=True)
    
    # Run tests
    exit_code = run_tests()
    sys.exit(exit_code)