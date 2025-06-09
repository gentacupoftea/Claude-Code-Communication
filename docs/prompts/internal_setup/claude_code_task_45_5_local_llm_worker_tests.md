# Claude Code 実行プロンプト: Task 45.5 - `LocalLLMWorker` の単体テスト作成

## 概要 (Overview)

こんにちは、Claude Code！

このタスクでは、`Task 45.1`で作成される`LocalLLMWorker`の単体テストを実装します。堅牢性を担保するため、成功ケースと失敗ケースの両方を網羅するテストを作成してください。

## 背景 (Background)

`LocalLLMWorker`は外部のOllama APIと通信するため、テスト時にはこのAPIコールをモック化する必要があります。`unittest.mock`ライブラリの`patch`を使用して、`requests.post`メソッドを完全にシミュレートします。これにより、外部依存なくワーカーのロジックのみを検証できます。

## ターゲットファイルと実装内容 (Target Files and Implementation Details)

### 1. **新規作成**: `multiLLM_system/tests/workers/test_local_llm_worker.py`

このファイルに、`LocalLLMWorker`のテストケースを実装します。

```python
# multiLLM_system/tests/workers/test_local_llm_worker.py

import unittest
from unittest.mock import patch, MagicMock
import requests

from multiLLM_system.workers.local_llm_worker import LocalLLMWorker
from multiLLM_system.config.settings import settings

class TestLocalLLMWorker(unittest.TestCase):
    """
    Unit tests for the LocalLLMWorker.
    """

    def setUp(self):
        """
        Set up the test environment before each test.
        """
        self.worker = LocalLLMWorker()
        self.prompt = "What is the capital of Japan?"
        self.api_url = f"{settings.OLLAMA_API_URL}/api/generate"

    @patch('requests.post')
    def test_process_task_success(self, mock_post):
        """
        Test the successful processing of a task.
        """
        # Arrange: Configure the mock response for a successful API call
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"response": "Tokyo"}
        mock_post.return_value = mock_response

        # Act: Call the method to be tested
        result = self.worker.process_task(self.prompt)

        # Assert: Verify the behavior
        mock_post.assert_called_once_with(
            self.api_url,
            json={
                "model": settings.LOCAL_LLM_MODEL,
                "prompt": self.prompt,
                "stream": False
            },
            timeout=settings.LLM_TIMEOUT
        )
        self.assertEqual(result, {"response": "Tokyo"})

    @patch('requests.post')
    def test_process_task_api_error(self, mock_post):
        """
        Test the worker's behavior when the Ollama API returns an error.
        """
        # Arrange: Configure the mock to raise a RequestException
        mock_post.side_effect = requests.exceptions.RequestException("API connection failed")

        # Act & Assert: Verify that the exception is raised
        with self.assertRaises(requests.exceptions.RequestException):
            self.worker.process_task(self.prompt)

        mock_post.assert_called_once()

    def test_get_supported_models(self):
        """
        Test that the worker correctly returns its supported model.
        """
        # Act
        supported_models = self.worker.get_supported_models()
        
        # Assert
        self.assertEqual(supported_models, [settings.LOCAL_LLM_MODEL])

if __name__ == '__main__':
    unittest.main()

```

### 2. **必要に応じて作成**: `multiLLM_system/tests/__init__.py` と `multiLLM_system/tests/workers/__init__.py`

テストランナーがモジュールを正しく認識できるよう、これらのディレクトリに空の `__init__.py` ファイルが存在することを確認してください。なければ作成してください。

## 最終確認

- `requests.post`のモックが正しく設定されていることを確認してください。
- 成功時のレスポンス検証と、失敗時の例外送出の検証が両方含まれていることを確認してください。
- ファイルパスが正しいことを確認してください。

このテストにより、`LocalLLMWorker`が予期せぬAPIの挙動にも対応できることを保証できます。よろしくお願いします！ 