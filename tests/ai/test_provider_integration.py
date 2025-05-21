#!/usr/bin/env python3
"""
AIプロバイダー連携テスト

このモジュールでは、Coneaとさまざまなプロバイダー（OpenAI、Claude、Gemini）との
連携が正しく動作するかを検証します。
"""

import os
import json
import unittest
from unittest.mock import patch, MagicMock
import pytest


# テスト対象のモジュールをインポート
# 注：プロジェクトの構造によってインポートパスが異なる場合があります
try:
    from conea.ai.providers import OpenAIProvider, ClaudeProvider, GeminiProvider
    from conea.ai.factory import AIProviderFactory
    from conea.ai.adapter import BaseAIAdapter
except ImportError:
    # テスト実行環境に応じてインポートパスを調整
    import sys
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
    try:
        from src.ai.providers import OpenAIProvider, ClaudeProvider, GeminiProvider
        from src.ai.factory import AIProviderFactory
        from src.ai.adapter import BaseAIAdapter
    except ImportError:
        # モックオブジェクトを使用してテストを続行
        OpenAIProvider = MagicMock()
        ClaudeProvider = MagicMock()
        GeminiProvider = MagicMock()
        AIProviderFactory = MagicMock()
        BaseAIAdapter = MagicMock()


class MockResponse:
    """モックレスポンスクラス"""
    def __init__(self, json_data, status_code=200):
        self.json_data = json_data
        self.status_code = status_code
        self.text = json.dumps(json_data)
    
    def json(self):
        return self.json_data


@pytest.mark.ai
class AIProviderTests(unittest.TestCase):
    """AIプロバイダーの統合テスト"""

    def setUp(self):
        """テストの前準備"""
        # テスト用の環境変数設定
        os.environ["API_KEY_OPENAI"] = "test-openai-key"
        os.environ["API_KEY_ANTHROPIC"] = "test-anthropic-key"
        os.environ["API_KEY_GEMINI"] = "test-gemini-key"

    def tearDown(self):
        """テスト後のクリーンアップ"""
        # テスト用の環境変数をクリア
        for key in ["API_KEY_OPENAI", "API_KEY_ANTHROPIC", "API_KEY_GEMINI"]:
            if key in os.environ:
                del os.environ[key]

    def test_provider_factory(self):
        """AIプロバイダーファクトリーのテスト"""
        factory = AIProviderFactory()
        
        # 各プロバイダーを取得するテスト
        openai_provider = factory.get_provider("openai")
        self.assertIsNotNone(openai_provider)
        self.assertIsInstance(openai_provider, OpenAIProvider)
        
        claude_provider = factory.get_provider("claude")
        self.assertIsNotNone(claude_provider)
        self.assertIsInstance(claude_provider, ClaudeProvider)
        
        gemini_provider = factory.get_provider("gemini")
        self.assertIsNotNone(gemini_provider)
        self.assertIsInstance(gemini_provider, GeminiProvider)
        
        # 存在しないプロバイダーのテスト
        with self.assertRaises(ValueError):
            factory.get_provider("nonexistent")

    @patch('requests.post')
    def test_openai_provider(self, mock_post):
        """OpenAIプロバイダーのテスト"""
        # モックレスポンスの設定
        mock_response = MockResponse({
            "id": "chatcmpl-test123",
            "object": "chat.completion",
            "created": 1677858242,
            "model": "gpt-4",
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": "This is a test response from OpenAI"
                    },
                    "finish_reason": "stop",
                    "index": 0
                }
            ],
            "usage": {
                "prompt_tokens": 10,
                "completion_tokens": 10,
                "total_tokens": 20
            }
        })
        mock_post.return_value = mock_response
        
        # プロバイダーのインスタンス化とテスト
        provider = OpenAIProvider(api_key="test-openai-key")
        response = provider.generate_text("This is a test prompt")
        
        # レスポンスの検証
        self.assertEqual(response.text, "This is a test response from OpenAI")
        self.assertEqual(response.provider, "openai")
        self.assertEqual(response.token_usage, 20)

    @patch('requests.post')
    def test_claude_provider(self, mock_post):
        """Claudeプロバイダーのテスト"""
        # モックレスポンスの設定
        mock_response = MockResponse({
            "id": "msg_test123",
            "type": "message",
            "role": "assistant",
            "content": [
                {
                    "type": "text",
                    "text": "This is a test response from Claude"
                }
            ],
            "model": "claude-3-sonnet-20240229",
            "usage": {
                "input_tokens": 15,
                "output_tokens": 12
            }
        })
        mock_post.return_value = mock_response
        
        # プロバイダーのインスタンス化とテスト
        provider = ClaudeProvider(api_key="test-anthropic-key")
        response = provider.generate_text("This is a test prompt")
        
        # レスポンスの検証
        self.assertEqual(response.text, "This is a test response from Claude")
        self.assertEqual(response.provider, "claude")
        self.assertEqual(response.token_usage, 27)  # 入力+出力トークン

    @patch('requests.post')
    def test_gemini_provider(self, mock_post):
        """Geminiプロバイダーのテスト"""
        # モックレスポンスの設定
        mock_response = MockResponse({
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "text": "This is a test response from Gemini"
                            }
                        ],
                        "role": "model"
                    },
                    "finishReason": "STOP"
                }
            ],
            "usageMetadata": {
                "promptTokenCount": 12,
                "candidatesTokenCount": 10,
                "totalTokenCount": 22
            }
        })
        mock_post.return_value = mock_response
        
        # プロバイダーのインスタンス化とテスト
        provider = GeminiProvider(api_key="test-gemini-key")
        response = provider.generate_text("This is a test prompt")
        
        # レスポンスの検証
        self.assertEqual(response.text, "This is a test response from Gemini")
        self.assertEqual(response.provider, "gemini")
        self.assertEqual(response.token_usage, 22)

    @patch.object(OpenAIProvider, 'generate_text')
    @patch.object(ClaudeProvider, 'generate_text')
    def test_failover_mechanism(self, mock_claude_generate, mock_openai_generate):
        """フェイルオーバーメカニズムのテスト"""
        # OpenAIが例外をスローするように設定
        mock_openai_generate.side_effect = Exception("OpenAI API error")
        
        # Claudeが正常に応答するように設定
        claude_response = MagicMock()
        claude_response.text = "Fallback response from Claude"
        claude_response.provider = "claude"
        claude_response.token_usage = 15
        mock_claude_generate.return_value = claude_response
        
        # アダプタークラスでフェイルオーバーをテスト
        adapter = BaseAIAdapter()
        response = adapter.generate_with_fallback("This is a test prompt", ["openai", "claude"])
        
        # フェイルオーバーの検証
        self.assertEqual(response.text, "Fallback response from Claude")
        self.assertEqual(response.provider, "claude")
        
        # OpenAIが呼び出された後、Claudeが呼び出されたことを確認
        mock_openai_generate.assert_called_once()
        mock_claude_generate.assert_called_once()

    def test_token_management(self):
        """トークン管理機能のテスト"""
        # トークン管理機能を持つアダプターをテスト
        adapter = BaseAIAdapter()
        
        # トークン制限設定（例：モデルごとの最大トークン数）
        token_limits = {
            "openai": {"gpt-4": 8192, "gpt-3.5-turbo": 4096},
            "claude": {"claude-3-sonnet": 100000, "claude-3-haiku": 200000},
            "gemini": {"gemini-1.0-pro": 32768}
        }
        
        # トークン制限の検証
        for provider, models in token_limits.items():
            for model, limit in models.items():
                self.assertTrue(adapter.check_token_limit(provider, model, limit - 1))
                self.assertTrue(adapter.check_token_limit(provider, model, limit))
                self.assertFalse(adapter.check_token_limit(provider, model, limit + 1))


if __name__ == "__main__":
    unittest.main()