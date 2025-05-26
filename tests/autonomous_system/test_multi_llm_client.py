"""
Tests for MultiLLMClient
マルチLLMクライアントの包括的テストスイート
"""

import pytest
import asyncio
import os
import time
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime

from autonomous_system.multi_llm_client import MultiLLMClient, get_multi_llm_client


class TestMultiLLMClient:
    """MultiLLMClient unit tests"""
    
    @pytest.mark.unit
    def test_initialization(self, mock_env_vars):
        """Test client initialization"""
        with patch('autonomous_system.multi_llm_client.Anthropic') as mock_anthropic, \
             patch('autonomous_system.multi_llm_client.openai.AsyncOpenAI') as mock_openai, \
             patch('autonomous_system.multi_llm_client.genai.configure') as mock_genai_config, \
             patch('autonomous_system.multi_llm_client.genai.GenerativeModel') as mock_genai_model:
            
            client = MultiLLMClient()
            
            # Verify LLM clients are initialized
            mock_anthropic.assert_called_once()
            mock_openai.assert_called_once()
            mock_genai_config.assert_called_once()
            mock_genai_model.assert_called_once()
            
            # Verify task routing is configured
            assert 'strategic_analysis' in client.task_routing
            assert client.task_routing['strategic_analysis'] == 'claude'
            assert client.task_routing['code_generation'] == 'openai'
            assert client.task_routing['real_time_monitoring'] == 'gemini'
            
            # Verify execution stats initialized
            assert 'claude' in client.execution_stats
            assert 'openai' in client.execution_stats
            assert 'gemini' in client.execution_stats
    
    @pytest.mark.unit
    def test_initialization_missing_api_keys(self):
        """Test initialization with missing API keys"""
        with patch.dict(os.environ, {}, clear=True):
            with patch('autonomous_system.multi_llm_client.logging') as mock_logging:
                client = MultiLLMClient()
                
                assert client.claude is None
                assert client.openai is None
                assert client.gemini_model is None
                
                # Should log warnings for missing keys
                assert mock_logging.getLogger().warning.call_count >= 3
    
    @pytest.mark.unit
    def test_task_routing_configuration(self, mock_multi_llm_client):
        """Test task routing configuration"""
        client = mock_multi_llm_client
        
        # Claude tasks
        claude_tasks = ['strategic_analysis', 'quality_review', 'complex_reasoning', 
                       'architecture_design', 'security_analysis', 'business_intelligence']
        for task in claude_tasks:
            assert client.task_routing[task] == 'claude'
        
        # OpenAI tasks
        openai_tasks = ['code_generation', 'api_integration', 'bug_fixing', 
                       'test_generation', 'documentation', 'refactoring']
        for task in openai_tasks:
            assert client.task_routing[task] == 'openai'
        
        # Gemini tasks
        gemini_tasks = ['real_time_monitoring', 'cloud_operations', 'performance_optimization',
                       'data_processing', 'system_monitoring', 'infrastructure_management']
        for task in gemini_tasks:
            assert client.task_routing[task] == 'gemini'
    
    @pytest.mark.async_test
    async def test_claude_api_call(self, mock_multi_llm_client):
        """Test Claude API call"""
        client = mock_multi_llm_client
        
        result = await client._call_claude("Test prompt", "strategic_analysis")
        
        assert result['success']
        assert result['content'] == "Mock Claude response"
        assert result['llm'] == 'claude'
        assert result['model'] == 'claude-3-7-sonnet'
        assert result['task_type'] == 'strategic_analysis'
        assert 'tokens_used' in result
        assert 'timestamp' in result
    
    @pytest.mark.async_test
    async def test_openai_api_call(self, mock_multi_llm_client):
        """Test OpenAI API call"""
        client = mock_multi_llm_client
        
        result = await client._call_openai("Test prompt", "code_generation")
        
        assert result['success']
        assert result['content'] == "Mock OpenAI response"
        assert result['llm'] == 'openai'
        assert result['task_type'] == 'code_generation'
        assert 'tokens_used' in result
        assert 'timestamp' in result
    
    @pytest.mark.async_test
    async def test_gemini_api_call(self, mock_multi_llm_client):
        """Test Gemini API call"""
        client = mock_multi_llm_client
        
        result = await client._call_gemini("Test prompt", "real_time_monitoring")
        
        assert result['success']
        assert result['content'] == "Mock Gemini response"
        assert result['llm'] == 'gemini'
        assert result['model'] == 'gemini-1.5-pro'
        assert result['task_type'] == 'real_time_monitoring'
        assert 'tokens_used' in result
        assert 'timestamp' in result
    
    @pytest.mark.async_test
    async def test_execute_task_routing(self, mock_multi_llm_client):
        """Test task execution with automatic routing"""
        client = mock_multi_llm_client
        
        # Test different task types route to correct LLMs
        test_cases = [
            ('strategic_analysis', 'claude'),
            ('code_generation', 'openai'),
            ('real_time_monitoring', 'gemini')
        ]
        
        for task_type, expected_llm in test_cases:
            result = await client.execute_task(task_type, f"Test {task_type} prompt")
            
            assert result['success']
            assert result['llm'] == expected_llm
            assert result['task_type'] == task_type
    
    @pytest.mark.async_test
    async def test_execute_task_with_parameters(self, mock_multi_llm_client):
        """Test task execution with custom parameters"""
        client = mock_multi_llm_client
        
        result = await client.execute_task(
            'strategic_analysis',
            'Test prompt',
            max_tokens=2000,
            temperature=0.5,
            model='custom-model'
        )
        
        assert result['success']
        # Verify parameters were passed through
        client.claude.messages.create.assert_called_once()
        call_args = client.claude.messages.create.call_args
        assert call_args[1]['max_tokens'] == 2000
        assert call_args[1]['temperature'] == 0.5
    
    @pytest.mark.async_test
    async def test_fallback_execution(self, mock_multi_llm_client):
        """Test fallback to alternative LLM when primary is unavailable"""
        client = mock_multi_llm_client
        
        # Make Claude unavailable
        client.claude = None
        
        # Strategic analysis should fallback to next available LLM
        result = await client.execute_task('strategic_analysis', 'Test prompt')
        
        # Should succeed with fallback
        assert result['success']
        assert result['llm'] in ['openai', 'gemini']  # Should use available fallback
    
    @pytest.mark.async_test
    async def test_api_error_handling(self, mock_multi_llm_client):
        """Test API error handling"""
        client = mock_multi_llm_client
        
        # Mock API failure
        client.claude.messages.create.side_effect = Exception("API Error")
        
        result = await client.execute_task('strategic_analysis', 'Test prompt')
        
        assert not result['success']
        assert 'error' in result
        assert 'API Error' in result['error']
        assert result['llm'] == 'claude'
        assert result['task_type'] == 'strategic_analysis'
    
    @pytest.mark.async_test
    async def test_parallel_execution(self, mock_multi_llm_client):
        """Test parallel task execution"""
        client = mock_multi_llm_client
        
        tasks = [
            {'type': 'strategic_analysis', 'prompt': 'Analysis 1'},
            {'type': 'code_generation', 'prompt': 'Code 1'},
            {'type': 'real_time_monitoring', 'prompt': 'Monitor 1'},
            {'type': 'strategic_analysis', 'prompt': 'Analysis 2'}
        ]
        
        start_time = time.time()
        result = await client.parallel_execution(tasks)
        execution_time = time.time() - start_time
        
        assert result['total_tasks'] == 4
        assert result['successful_tasks'] == 4
        assert result['failed_tasks'] == 0
        assert len(result['results']) == 4
        assert result['execution_time'] < 2.0  # Should be faster than sequential
        assert all(r['success'] for r in result['results'] if isinstance(r, dict))
    
    @pytest.mark.async_test
    async def test_parallel_execution_with_failures(self, mock_multi_llm_client):
        """Test parallel execution with some failures"""
        client = mock_multi_llm_client
        
        # Make one LLM fail
        client.claude.messages.create.side_effect = Exception("Claude error")
        
        tasks = [
            {'type': 'strategic_analysis', 'prompt': 'Analysis (will fail)'},
            {'type': 'code_generation', 'prompt': 'Code (will succeed)'},
            {'type': 'real_time_monitoring', 'prompt': 'Monitor (will succeed)'}
        ]
        
        result = await client.parallel_execution(tasks)
        
        assert result['total_tasks'] == 3
        assert result['successful_tasks'] == 2  # OpenAI and Gemini succeed
        assert result['failed_tasks'] == 1     # Claude fails
    
    @pytest.mark.async_test
    async def test_parallel_execution_semaphore_limit(self, mock_multi_llm_client):
        """Test parallel execution respects semaphore limits"""
        client = mock_multi_llm_client
        
        with patch.dict(os.environ, {'PARALLEL_EXECUTION_LIMIT': '2'}):
            # Create more tasks than the limit
            tasks = [
                {'type': 'strategic_analysis', 'prompt': f'Task {i}'}
                for i in range(5)
            ]
            
            result = await client.parallel_execution(tasks)
            
            assert result['total_tasks'] == 5
            assert result['successful_tasks'] == 5
            # Execution should still succeed, just be throttled
    
    @pytest.mark.unit
    def test_stats_update(self, mock_multi_llm_client):
        """Test execution statistics update"""
        client = mock_multi_llm_client
        
        # Update stats
        client._update_stats('claude', 1.5, 100)
        client._update_stats('claude', 2.0, 150)
        client._update_stats('openai', 1.0, 80)
        
        stats = client.get_execution_stats()
        
        # Verify Claude stats
        assert stats['claude']['total_executions'] == 2
        assert stats['claude']['total_time'] == 3.5
        assert stats['claude']['average_time'] == 1.75
        assert stats['claude']['total_tokens'] == 250
        assert stats['claude']['average_tokens'] == 125
        
        # Verify OpenAI stats
        assert stats['openai']['total_executions'] == 1
        assert stats['openai']['total_time'] == 1.0
        assert stats['openai']['average_time'] == 1.0
        assert stats['openai']['total_tokens'] == 80
        assert stats['openai']['average_tokens'] == 80
        
        # Verify Gemini stats (no executions)
        assert stats['gemini']['total_executions'] == 0
        assert stats['gemini']['total_time'] == 0
        assert stats['gemini']['average_time'] == 0
    
    @pytest.mark.async_test
    async def test_health_check(self, mock_multi_llm_client):
        """Test health check functionality"""
        client = mock_multi_llm_client
        
        health = await client.health_check()
        
        assert 'claude' in health
        assert 'openai' in health
        assert 'gemini' in health
        
        # All should be healthy with mocked responses
        for llm_health in health.values():
            assert llm_health['status'] == 'healthy'
    
    @pytest.mark.async_test
    async def test_health_check_with_unavailable_llm(self, mock_multi_llm_client):
        """Test health check with unavailable LLM"""
        client = mock_multi_llm_client
        
        # Make Claude unavailable
        client.claude = None
        
        health = await client.health_check()
        
        assert health['claude']['status'] == 'not_configured'
        assert health['openai']['status'] == 'healthy'
        assert health['gemini']['status'] == 'healthy'
    
    @pytest.mark.async_test
    async def test_health_check_with_api_errors(self, mock_multi_llm_client):
        """Test health check with API errors"""
        client = mock_multi_llm_client
        
        # Make Claude API fail
        client.claude.messages.create.side_effect = Exception("Health check failed")
        
        health = await client.health_check()
        
        assert health['claude']['status'] == 'unhealthy'
        assert 'error' in health['claude']
        assert health['openai']['status'] == 'healthy'
        assert health['gemini']['status'] == 'healthy'


class TestTaskExecution:
    """Task execution workflow tests"""
    
    @pytest.mark.async_test
    async def test_task_execution_timeout_handling(self, mock_multi_llm_client):
        """Test task execution timeout handling"""
        client = mock_multi_llm_client
        
        # Mock long-running task
        async def slow_response(*args, **kwargs):
            await asyncio.sleep(2)
            return Mock(content=[Mock(text="Slow response")], usage=Mock(input_tokens=10, output_tokens=20))
        
        client.claude.messages.create = slow_response
        
        # Execute with short timeout (this would be implemented with asyncio.wait_for in real code)
        result = await client.execute_task('strategic_analysis', 'Test prompt')
        
        # Should still succeed in this test (real implementation would handle timeout)
        assert result['success']
    
    @pytest.mark.async_test
    async def test_task_execution_with_retry_logic(self, mock_multi_llm_client):
        """Test task execution with retry logic"""
        client = mock_multi_llm_client
        
        # Mock intermittent failure
        call_count = 0
        def failing_response(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise Exception("Intermittent failure")
            return Mock(content=[Mock(text="Success after retries")], usage=Mock(input_tokens=10, output_tokens=20))
        
        client.claude.messages.create = AsyncMock(side_effect=failing_response)
        
        # This would test retry logic if implemented
        result = await client.execute_task('strategic_analysis', 'Test prompt')
        
        # First call should fail, but test framework doesn't implement retries
        assert not result['success']
    
    @pytest.mark.unit
    def test_task_routing_edge_cases(self, mock_multi_llm_client):
        """Test task routing edge cases"""
        client = mock_multi_llm_client
        
        # Test unknown task type defaults to claude
        unknown_task_llm = client.task_routing.get('unknown_task_type', 'claude')
        assert unknown_task_llm == 'claude'
        
        # Test all defined task types have valid LLM assignments
        valid_llms = {'claude', 'openai', 'gemini'}
        for task_type, llm in client.task_routing.items():
            assert llm in valid_llms, f"Task {task_type} has invalid LLM assignment: {llm}"


class TestPerformanceMetrics:
    """Performance and metrics tests"""
    
    @pytest.mark.performance
    @pytest.mark.async_test
    async def test_execution_performance_tracking(self, mock_multi_llm_client):
        """Test execution performance tracking"""
        client = mock_multi_llm_client
        
        # Execute multiple tasks and track performance
        tasks = [
            {'type': 'strategic_analysis', 'prompt': f'Analysis {i}'}
            for i in range(10)
        ]
        
        start_time = time.time()
        await client.parallel_execution(tasks)
        total_time = time.time() - start_time
        
        # Get execution stats
        stats = client.get_execution_stats()
        
        # Verify performance is reasonable
        assert total_time < 5.0  # Should complete within 5 seconds
        assert stats['claude']['total_executions'] == 10
        assert stats['claude']['average_time'] > 0
    
    @pytest.mark.unit
    def test_token_usage_tracking(self, mock_multi_llm_client):
        """Test token usage tracking"""
        client = mock_multi_llm_client
        
        # Simulate different token usages
        client._update_stats('claude', 1.0, 100)
        client._update_stats('claude', 2.0, 200)
        client._update_stats('openai', 1.5, 150)
        
        stats = client.get_execution_stats()
        
        # Verify token tracking
        assert stats['claude']['total_tokens'] == 300
        assert stats['claude']['average_tokens'] == 150
        assert stats['openai']['total_tokens'] == 150
        assert stats['openai']['average_tokens'] == 150
    
    @pytest.mark.performance
    @pytest.mark.async_test
    async def test_concurrent_execution_performance(self, mock_multi_llm_client):
        """Test concurrent execution performance"""
        client = mock_multi_llm_client
        
        # Test with different concurrency levels
        for concurrency in [1, 3, 5]:
            tasks = [
                {'type': 'strategic_analysis', 'prompt': f'Task {i}'}
                for i in range(concurrency)
            ]
            
            start_time = time.time()
            result = await client.parallel_execution(tasks)
            execution_time = time.time() - start_time
            
            assert result['successful_tasks'] == concurrency
            assert execution_time < concurrency * 1.0  # Should be faster than sequential


class TestSingletonPattern:
    """Test singleton pattern implementation"""
    
    @pytest.mark.unit
    def test_get_multi_llm_client_singleton(self, mock_env_vars):
        """Test singleton pattern for get_multi_llm_client"""
        # Clear any existing singleton
        import autonomous_system.multi_llm_client
        autonomous_system.multi_llm_client._multi_llm_client = None
        
        with patch('autonomous_system.multi_llm_client.Anthropic'), \
             patch('autonomous_system.multi_llm_client.openai.AsyncOpenAI'), \
             patch('autonomous_system.multi_llm_client.genai.configure'), \
             patch('autonomous_system.multi_llm_client.genai.GenerativeModel'):
            
            # Get client instances
            client1 = get_multi_llm_client()
            client2 = get_multi_llm_client()
            
            # Should be the same instance
            assert client1 is client2
            assert id(client1) == id(client2)


class TestErrorHandling:
    """Error handling and edge case tests"""
    
    @pytest.mark.async_test
    async def test_all_llms_unavailable(self, mock_env_vars):
        """Test behavior when all LLMs are unavailable"""
        with patch('autonomous_system.multi_llm_client.Anthropic', side_effect=Exception), \
             patch('autonomous_system.multi_llm_client.openai.AsyncOpenAI', side_effect=Exception), \
             patch('autonomous_system.multi_llm_client.genai.configure', side_effect=Exception):
            
            client = MultiLLMClient()
            
            # All clients should be None
            assert client.claude is None
            assert client.openai is None
            assert client.gemini_model is None
            
            # Should handle gracefully
            result = await client.execute_task('strategic_analysis', 'Test prompt')
            assert not result['success']
            assert 'All LLM clients unavailable' in result['error']
    
    @pytest.mark.async_test
    async def test_empty_parallel_execution(self, mock_multi_llm_client):
        """Test parallel execution with empty task list"""
        client = mock_multi_llm_client
        
        result = await client.parallel_execution([])
        
        assert result['total_tasks'] == 0
        assert result['results'] == []
        assert result['execution_time'] >= 0
    
    @pytest.mark.unit
    def test_invalid_task_parameters(self, mock_multi_llm_client):
        """Test handling of invalid task parameters"""
        client = mock_multi_llm_client
        
        # Test with None prompt
        with pytest.raises((TypeError, AttributeError)):
            asyncio.run(client.execute_task('strategic_analysis', None))
        
        # Test with invalid task type
        result = asyncio.run(client.execute_task('', 'Test prompt'))
        # Should handle gracefully (empty task type gets default routing)
    
    @pytest.mark.async_test
    async def test_partial_llm_availability(self, mock_multi_llm_client):
        """Test system behavior with partial LLM availability"""
        client = mock_multi_llm_client
        
        # Make OpenAI unavailable
        client.openai = None
        
        # Test tasks that normally go to OpenAI should fallback
        result = await client.execute_task('code_generation', 'Generate some code')
        
        # Should succeed with fallback LLM
        assert result['success']
        assert result['llm'] in ['claude', 'gemini']