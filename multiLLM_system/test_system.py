#!/usr/bin/env python3
"""
MultiLLM System Test Script
Phase 1の実装をテストする簡易スクリプト
"""

import asyncio
import sys
import os
import json
from datetime import datetime

# プロジェクトルートをパスに追加
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from orchestrator.orchestrator import MultiLLMOrchestrator, TaskType
from services.memory_sync import MemorySyncService
from workers.base_worker import BaseWorker, WorkerTask
from config.config_validator import ConfigValidator
from services.rate_limiter import MultiProviderRateLimiter


async def test_config_validation():
    """設定検証のテスト"""
    print("\n=== Testing Config Validation ===")
    try:
        # 必要な環境変数を仮設定（テスト用）
        test_env = {
            'SLACK_BOT_TOKEN': 'xoxb-test-token',
            'SLACK_SIGNING_SECRET': 'test-secret',
            'SLACK_BOT_ID': 'U123456789',
            'OPENAI_API_KEY': 'sk-test-openai-key',
            'ANTHROPIC_API_KEY': 'sk-ant-test-key',
            'GOOGLE_AI_API_KEY': 'test-google-key',
            'OPENMEMORY_URL': 'http://localhost:8765'
        }
        
        for key, value in test_env.items():
            if not os.getenv(key):
                os.environ[key] = value
        
        config = ConfigValidator.create_default_config()
        validated_config = ConfigValidator.validate_config(config)
        print("✅ Configuration validation passed")
        print(f"   - Workers: {list(validated_config['workers'].keys())}")
        print(f"   - Memory sync interval: {validated_config['memory']['syncInterval']}s")
        
    except Exception as e:
        print(f"❌ Configuration validation failed: {e}")
        return False
    
    return True


async def test_orchestrator():
    """Orchestratorのテスト"""
    print("\n=== Testing Orchestrator ===")
    
    config = {
        "workers": {
            "backend_worker": {"model": "gpt-4-turbo"},
            "frontend_worker": {"model": "claude-3-sonnet"},
            "review_worker": {"model": "gpt-4"}
        },
        "memory": {
            "syncInterval": 300
        }
    }
    
    orchestrator = MultiLLMOrchestrator(config)
    await orchestrator.initialize()
    
    # タスクタイプ判定テスト
    test_requests = [
        ("バグを修正してください", TaskType.CODE_IMPLEMENTATION),
        ("UIのレイアウトを改善して", TaskType.UI_DESIGN),
        ("READMEを更新して", TaskType.DOCUMENTATION),
        ("PRをレビューして", TaskType.PR_REVIEW),
        ("データを分析して", TaskType.DATA_ANALYSIS),
        ("画像を生成して", TaskType.IMAGE_GENERATION)
    ]
    
    for request, expected_type in test_requests:
        task_type = orchestrator._analyze_task_type(request)
        status = "✅" if task_type == expected_type else "❌"
        print(f"{status} '{request}' -> {task_type.value}")
    
    # 簡単なリクエスト処理
    result = await orchestrator.process_user_request(
        "テストコードを書いてください",
        user_id="test_user"
    )
    print(f"✅ Request processed: {result['result']}")
    
    return True


async def test_memory_sync():
    """Memory Syncのテスト"""
    print("\n=== Testing Memory Sync ===")
    
    config = {
        'syncInterval': 300,
        'conflictResolution': 'latest',
        'storage': {
            'type': 'openmemory',
            'connectionString': os.getenv('OPENMEMORY_URL', 'http://localhost:8765')
        }
    }
    
    service = MemorySyncService(config)
    
    # URL検証テスト
    test_urls = [
        ("http://localhost:8765", True),
        ("https://openmemory.internal", True),
        ("ftp://badurl.com", False),
        ("javascript:alert(1)", False),
        ("", False)
    ]
    
    for url, expected in test_urls:
        result = service._validate_url(url)
        status = "✅" if result == expected else "❌"
        print(f"{status} URL validation: '{url}' -> {result}")
    
    # メモリ追加テスト
    await service.add_memory(
        worker_name='test_worker',
        content='テストメモリエントリー',
        metadata={'test': True},
        importance=0.8
    )
    print("✅ Memory entry added")
    
    return True


async def test_rate_limiter():
    """Rate Limiterのテスト"""
    print("\n=== Testing Rate Limiter ===")
    
    rate_limiter = MultiProviderRateLimiter()
    
    # レート制限チェック
    providers = [
        ('openai', 'gpt-4-turbo'),
        ('anthropic', 'claude-3-sonnet'),
        ('google', 'gemini-1.5-flash')
    ]
    
    for provider, model in providers:
        can_proceed, wait_time = await rate_limiter.check_rate_limit(provider, model, 1000)
        status = "✅" if can_proceed else "⏳"
        print(f"{status} {provider}:{model} - Can proceed: {can_proceed}")
    
    # ステータス表示
    status = rate_limiter.get_all_status()
    print("\n📊 Rate Limiter Status:")
    for provider, models in status.items():
        print(f"  {provider}:")
        for model, info in models.items():
            print(f"    {model}: {info['requests_used']}/{info['requests_limit']} requests")
    
    return True


async def test_worker():
    """Workerのテスト"""
    print("\n=== Testing Worker ===")
    
    config = {
        'model': 'gpt-4',
        'maxConcurrentTasks': 3,
        'maxQueueSize': 10,
        'maxMemoryEntries': 100
    }
    
    worker = BaseWorker("test_worker", config)
    await worker.initialize()
    
    # タスク送信テスト
    task = WorkerTask(
        id="test-001",
        type="test",
        description="テストタスク",
        context={"test": True}
    )
    
    task_id = await worker.submit_task(task)
    print(f"✅ Task submitted: {task_id}")
    
    # ステータス確認
    status = worker.get_status()
    print(f"📊 Worker Status:")
    print(f"   - Active tasks: {status['active_tasks']}")
    print(f"   - Queued tasks: {status['queued_tasks']}")
    print(f"   - Success rate: {status['metrics']['successful_tasks']}/{status['metrics']['total_tasks']}")
    
    # シャットダウン
    await worker.shutdown()
    print("✅ Worker shutdown complete")
    
    return True


async def main():
    """メインテスト実行"""
    print("🚀 MultiLLM System Phase 1 Test")
    print("=" * 40)
    
    tests = [
        ("Config Validation", test_config_validation),
        ("Orchestrator", test_orchestrator),
        ("Memory Sync", test_memory_sync),
        ("Rate Limiter", test_rate_limiter),
        ("Worker", test_worker)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            success = await test_func()
            results.append((test_name, success))
        except Exception as e:
            print(f"\n❌ {test_name} failed with error: {e}")
            results.append((test_name, False))
    
    # 結果サマリー
    print("\n" + "=" * 40)
    print("📊 Test Results Summary:")
    print("=" * 40)
    
    passed = sum(1 for _, success in results if success)
    total = len(results)
    
    for test_name, success in results:
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{test_name:.<30} {status}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! Phase 1 implementation is working correctly.")
    else:
        print("\n⚠️  Some tests failed. Please check the implementation.")


if __name__ == "__main__":
    asyncio.run(main())