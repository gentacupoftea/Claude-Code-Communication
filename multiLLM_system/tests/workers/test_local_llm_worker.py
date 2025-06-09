# multiLLM_system/tests/workers/test_local_llm_worker.py

import unittest
import asyncio
from unittest.mock import patch, MagicMock, AsyncMock
import requests
from datetime import datetime

from multiLLM_system.workers.local_llm_worker import LocalLLMWorker
from multiLLM_system.workers.base_worker import WorkerTask
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
        
        # サンプルタスクの作成
        self.task = WorkerTask(
            id="test-task-1",
            type="query",
            description=self.prompt,
            context={"user": "test_user"},
            priority=1,
            created_at=datetime.now()
        )

    def test_initialization(self):
        """
        Test that LocalLLMWorker initializes correctly.
        """
        self.assertEqual(self.worker.model_id, settings.LOCAL_LLM_MODEL)
        self.assertEqual(self.worker.api_url, self.api_url)
        self.assertIn('general', self.worker.config.get('specialization', []))

    @patch('requests.post')
    def test_process_task_success(self, mock_post):
        """
        Test the successful processing of a task.
        """
        # Arrange: Configure the mock response for a successful API call
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "response": "Tokyo",
            "done": True,
            "context": [],
            "total_duration": 1000000,
            "load_duration": 500000,
            "prompt_eval_count": 10,
            "eval_count": 5
        }
        mock_post.return_value = mock_response

        # Act: Call the async method to be tested
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(self.worker.process(self.task))

        # Assert: Verify the behavior
        mock_post.assert_called_once()
        call_args = mock_post.call_args
        self.assertEqual(call_args[0][0], self.api_url)
        
        # Verify the payload
        payload = call_args[1]['json']
        self.assertEqual(payload['model'], settings.LOCAL_LLM_MODEL)
        self.assertIn(self.prompt, payload['prompt'])
        self.assertEqual(payload['stream'], False)
        
        # Verify the result
        self.assertEqual(result['type'], 'query')
        self.assertEqual(result['model'], settings.LOCAL_LLM_MODEL)
        self.assertEqual(result['response'], 'Tokyo')
        self.assertTrue(result['done'])
        self.assertIn('timestamp', result)

    @patch('requests.post')
    def test_process_task_with_context(self, mock_post):
        """
        Test processing a task with additional context.
        """
        # Arrange: Task with context
        task_with_context = WorkerTask(
            id="test-task-2",
            type="analysis",
            description="Analyze this data",
            context={"data": "sample data", "format": "json"},
            priority=1,
            created_at=datetime.now()
        )
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"response": "Analysis complete", "done": True}
        mock_post.return_value = mock_response

        # Act
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(self.worker.process(task_with_context))

        # Assert: Check that context was included in prompt
        call_args = mock_post.call_args
        payload = call_args[1]['json']
        self.assertIn("Context:", payload['prompt'])
        self.assertIn("data: sample data", payload['prompt'])
        self.assertIn("format: json", payload['prompt'])

    @patch('requests.post')
    def test_process_task_api_error(self, mock_post):
        """
        Test the worker's behavior when the Ollama API returns an error.
        """
        # Arrange: Configure the mock to raise a RequestException
        mock_post.side_effect = requests.exceptions.RequestException("API connection failed")

        # Act & Assert: Verify that the exception is raised
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        with self.assertRaises(requests.exceptions.RequestException):
            loop.run_until_complete(self.worker.process(self.task))

        mock_post.assert_called_once()

    @patch('requests.post')
    def test_process_task_timeout(self, mock_post):
        """
        Test handling of timeout errors.
        """
        # Arrange: Configure timeout exception
        mock_post.side_effect = requests.exceptions.Timeout("Request timed out")

        # Act & Assert
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        with self.assertRaises(requests.exceptions.Timeout):
            loop.run_until_complete(self.worker.process(self.task))

    def test_get_supported_models(self):
        """
        Test that the worker correctly returns its supported model.
        """
        # Act
        supported_models = self.worker.get_supported_models()
        
        # Assert
        self.assertEqual(supported_models, [settings.LOCAL_LLM_MODEL])
        self.assertIsInstance(supported_models, list)
        self.assertEqual(len(supported_models), 1)

    @patch('requests.get')
    def test_health_check_success(self, mock_get):
        """
        Test successful health check when model is available.
        """
        # Arrange: Mock successful response with available models
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "models": [
                {"name": settings.LOCAL_LLM_MODEL, "size": "3.8GB"},
                {"name": "llama2:7b", "size": "7GB"}
            ]
        }
        mock_get.return_value = mock_response

        # Act
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(self.worker.health_check())

        # Assert
        self.assertEqual(result['status'], 'healthy')
        self.assertEqual(result['model'], settings.LOCAL_LLM_MODEL)
        self.assertTrue(result['model_available'])
        self.assertIn(settings.LOCAL_LLM_MODEL, result['available_models'])

    @patch('requests.get')
    def test_health_check_model_unavailable(self, mock_get):
        """
        Test health check when the configured model is not available.
        """
        # Arrange: Mock response without our model
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "models": [
                {"name": "other-model:latest", "size": "5GB"}
            ]
        }
        mock_get.return_value = mock_response

        # Act
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(self.worker.health_check())

        # Assert
        self.assertEqual(result['status'], 'unhealthy')
        self.assertFalse(result['model_available'])
        self.assertNotIn(settings.LOCAL_LLM_MODEL, result['available_models'])

    @patch('requests.get')
    def test_health_check_api_error(self, mock_get):
        """
        Test health check when API is down.
        """
        # Arrange: Mock API error
        mock_get.side_effect = requests.exceptions.ConnectionError("Connection refused")

        # Act
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(self.worker.health_check())

        # Assert
        self.assertEqual(result['status'], 'unhealthy')
        self.assertIn('error', result)
        self.assertIn("Connection refused", result['error'])

    def test_emergency_response_model_unavailable(self):
        """
        Test emergency response for model unavailable scenario.
        """
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        # Should not raise exception
        loop.run_until_complete(
            self.worker.emergency_response("model_unavailable", {"model": settings.LOCAL_LLM_MODEL})
        )

    def test_emergency_response_api_down(self):
        """
        Test emergency response for API down scenario.
        """
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        # Should not raise exception
        loop.run_until_complete(
            self.worker.emergency_response("api_down", {"url": settings.OLLAMA_API_URL})
        )

    def test_custom_config_initialization(self):
        """
        Test initialization with custom configuration.
        """
        custom_config = {
            'model': 'custom-model:latest',
            'specialization': ['custom', 'task'],
            'maxConcurrentTasks': 5,
            'temperature': 0.9
        }
        
        custom_worker = LocalLLMWorker(name="custom_worker", config=custom_config)
        
        self.assertEqual(custom_worker.model_id, 'custom-model:latest')
        self.assertEqual(custom_worker.config['temperature'], 0.9)
        self.assertEqual(custom_worker.config['maxConcurrentTasks'], 5)

if __name__ == '__main__':
    unittest.main()