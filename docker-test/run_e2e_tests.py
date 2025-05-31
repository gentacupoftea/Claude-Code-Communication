#!/usr/bin/env python3
"""
E2E テスト実行スクリプト
環境検証と自動セットアップ機能付き
"""
import os
import sys
import subprocess
import argparse

def check_environment():
    """環境変数の検証"""
    required_vars = {
        'DATABASE_URL': 'postgresql://test_user:test_password@test-db:5432/conea_test',
        'REDIS_URL': 'redis://:test_redis_password@test-redis:6379/0',
        'SHOPIFY_BASE_URL': 'http://mock-shopify:8080',
        'GA_BASE_URL': 'http://mock-ga:8081',
        'JWT_SECRET_KEY': 'test_jwt_secret_key_for_testing',
        'PYTHONPATH': '/app',
        'TEST_ENVIRONMENT': 'docker'
    }
    
    missing_vars = []
    for var, default_value in required_vars.items():
        if not os.getenv(var):
            os.environ[var] = default_value
            print(f"Set {var} to default value")
        
    return True

def install_dependencies():
    """必要な依存関係をインストール"""
    try:
        # Check if pytest is installed
        subprocess.run(['python', '-m', 'pytest', '--version'], check=True, capture_output=True)
        print("pytest is already installed")
    except subprocess.CalledProcessError:
        print("Installing pytest...")
        try:
            subprocess.run(['pip', 'install', 'pytest', 'pytest-asyncio', 'pytest-cov'], check=True)
            print("pytest installed successfully")
        except subprocess.CalledProcessError as e:
            print(f"Failed to install pytest: {e}")
            return False
    
    # Check if Playwright is installed
    try:
        subprocess.run(['python', '-m', 'playwright', '--version'], check=True, capture_output=True)
        print("Playwright is already installed")
    except subprocess.CalledProcessError:
        print("Installing Playwright...")
        try:
            subprocess.run(['pip', 'install', 'playwright'], check=True)
            subprocess.run(['python', '-m', 'playwright', 'install', 'chromium'], check=True)
            print("Playwright installed successfully")
        except subprocess.CalledProcessError as e:
            print(f"Failed to install Playwright: {e}")
            return False
    
    return True

def run_tests(test_type='all', parallel=False):
    """テストを実行"""
    cmd = ['python', '-m', 'pytest', 'tests/', '-v']
    
    if test_type != 'all':
        cmd.extend(['-k', test_type])
    
    if parallel:
        cmd.extend(['-n', 'auto'])
    
    # Add coverage options
    cmd.extend(['--cov=src', '--cov-report=html', '--cov-report=term'])
    
    try:
        print(f"Running {test_type} tests...")
        subprocess.run(cmd, check=True)
        print(f"{test_type} tests completed successfully")
    except subprocess.CalledProcessError as e:
        print(f"Tests failed with exit code {e.returncode}")
        sys.exit(e.returncode)

def main():
    parser = argparse.ArgumentParser(description='Run E2E tests')
    parser.add_argument('test_type', nargs='?', default='all', 
                      choices=['unit', 'integration', 'e2e', 'all'],
                      help='Type of tests to run')
    parser.add_argument('--parallel', action='store_true',
                      help='Run tests in parallel')
    parser.add_argument('--skip-install', action='store_true',
                      help='Skip dependency installation')
    
    args = parser.parse_args()
    
    print("E2E Test Runner")
    print("===============")
    
    # 環境検証
    print("\n1. Checking environment...")
    if not check_environment():
        print("Environment check failed")
        sys.exit(1)
    print("Environment check passed")
    
    # 依存関係インストール
    if not args.skip_install:
        print("\n2. Installing dependencies...")
        if not install_dependencies():
            print("Dependency installation failed")
            sys.exit(1)
        print("Dependencies installed")
    
    # テスト実行
    print(f"\n3. Running {args.test_type} tests...")
    run_tests(args.test_type, args.parallel)
    
    print("\nAll tests completed!")

if __name__ == '__main__':
    main()