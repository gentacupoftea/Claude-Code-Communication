#!/usr/bin/env python3
"""
インポートテストスクリプト
モジュールが正しくインポートできるかテスト
"""

import sys
import os

# パスを追加
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("Testing imports...")
print(f"Python path: {sys.path[0]}")

try:
    print("\n1. Testing orchestrator import...")
    from orchestrator import MultiLLMOrchestrator
    print("✅ orchestrator imported successfully")
except Exception as e:
    print(f"❌ orchestrator import failed: {e}")

try:
    print("\n2. Testing orchestrator submodules...")
    from orchestrator.orchestrator import MultiLLMOrchestrator
    from orchestrator.llm_client import ClaudeClient
    from orchestrator.response_formatter import ResponseFormatter
    print("✅ All submodules imported successfully")
except Exception as e:
    print(f"❌ Submodule import failed: {e}")

try:
    print("\n3. Testing API server import...")
    from api.server import app
    print("✅ API server imported successfully")
except Exception as e:
    print(f"❌ API server import failed: {e}")

print("\n✅ All imports completed!")