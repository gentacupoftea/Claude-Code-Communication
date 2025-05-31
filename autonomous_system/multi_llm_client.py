"""
Multi-LLM Client - 統合LLMクライアント
3種類のLLMを最適タスクに自動振り分けする統合システム
"""

import asyncio
import os
import time
from typing import Dict, Any, Optional, List
import logging
from datetime import datetime

# LLM Client imports
try:
    from anthropic import Anthropic
    import openai
    import google.generativeai as genai
except ImportError as e:
    logging.warning(f"Some LLM libraries not installed: {e}")

class MultiLLMClient:
    """統合LLMクライアント - 3種類のLLMを最適タスクに自動振り分け"""
    
    def __init__(self):
        """初期化: 各LLMクライアントのセットアップ"""
        self.logger = logging.getLogger(__name__)
        
        # LLM初期化
        self._initialize_llm_clients()
        
        # タスク別LLM自動選択ルール
        self.task_routing = {
            # Claude 3.7 Sonnet - 戦略分析・品質管理・複雑推論
            'strategic_analysis': 'claude',
            'quality_review': 'claude', 
            'complex_reasoning': 'claude',
            'architecture_design': 'claude',
            'security_analysis': 'claude',
            'business_intelligence': 'claude',
            
            # OpenAI GPT-4 - コード生成・API実装・バグ修正
            'code_generation': 'openai',
            'api_integration': 'openai',
            'bug_fixing': 'openai',
            'test_generation': 'openai',
            'documentation': 'openai',
            'refactoring': 'openai',
            
            # Google Gemini - リアルタイム監視・クラウド運用・パフォーマンス最適化
            'real_time_monitoring': 'gemini',
            'cloud_operations': 'gemini',
            'performance_optimization': 'gemini',
            'data_processing': 'gemini',
            'system_monitoring': 'gemini',
            'infrastructure_management': 'gemini'
        }
        
        # 実行統計
        self.execution_stats = {
            'claude': {'count': 0, 'total_time': 0, 'total_tokens': 0},
            'openai': {'count': 0, 'total_time': 0, 'total_tokens': 0},
            'gemini': {'count': 0, 'total_time': 0, 'total_tokens': 0}
        }
    
    def _initialize_llm_clients(self):
        """LLMクライアント初期化"""
        try:
            # Claude 3.7 Sonnet
            if os.getenv("ANTHROPIC_API_KEY"):
                self.claude = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
                self.logger.info("Claude 3.7 Sonnet initialized")
            else:
                self.claude = None
                self.logger.warning("ANTHROPIC_API_KEY not set")
            
            # OpenAI GPT-4
            if os.getenv("OPENAI_API_KEY"):
                self.openai = openai.AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
                self.logger.info("OpenAI GPT-4 initialized")
            else:
                self.openai = None
                self.logger.warning("OPENAI_API_KEY not set")
            
            # Google Gemini
            if os.getenv("GEMINI_API_KEY"):
                genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
                self.gemini_model = genai.GenerativeModel('gemini-1.5-pro')
                self.logger.info("Google Gemini initialized")
            else:
                self.gemini_model = None
                self.logger.warning("GEMINI_API_KEY not set")
                
        except Exception as e:
            self.logger.error(f"Error initializing LLM clients: {e}")
    
    async def execute_task(self, task_type: str, prompt: str, **kwargs) -> Dict[str, Any]:
        """タスクタイプに応じて最適なLLMに自動振り分け実行"""
        selected_llm = self.task_routing.get(task_type, 'claude')
        start_time = time.time()
        
        try:
            if selected_llm == 'claude' and self.claude:
                result = await self._call_claude(prompt, task_type, **kwargs)
            elif selected_llm == 'openai' and self.openai:
                result = await self._call_openai(prompt, task_type, **kwargs)
            elif selected_llm == 'gemini' and self.gemini_model:
                result = await self._call_gemini(prompt, task_type, **kwargs)
            else:
                # フォールバック: 利用可能な他のLLMを使用
                result = await self._fallback_execution(prompt, task_type, selected_llm, **kwargs)
            
            # 実行統計更新
            execution_time = time.time() - start_time
            self._update_stats(selected_llm, execution_time, result.get('tokens_used', 0))
            
            return result
            
        except Exception as e:
            self.logger.error(f"Error executing task {task_type} with {selected_llm}: {e}")
            return {
                'success': False,
                'error': str(e),
                'llm': selected_llm,
                'task_type': task_type,
                'timestamp': datetime.now().isoformat()
            }
    
    async def _call_claude(self, prompt: str, task_type: str, **kwargs) -> Dict[str, Any]:
        """Claude 3.7 Sonnet API呼び出し"""
        max_tokens = kwargs.get('max_tokens', int(os.getenv('MAX_TOKENS_CLAUDE', 4000)))
        
        try:
            message = await self.claude.messages.create(
                model="claude-3-7-sonnet-20250219",
                max_tokens=max_tokens,
                messages=[{"role": "user", "content": prompt}],
                temperature=kwargs.get('temperature', 0.7)
            )
            
            return {
                'success': True,
                'content': message.content[0].text,
                'llm': 'claude',
                'model': 'claude-3-7-sonnet',
                'task_type': task_type,
                'tokens_used': message.usage.input_tokens + message.usage.output_tokens,
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            raise Exception(f"Claude API error: {e}")
    
    async def _call_openai(self, prompt: str, task_type: str, **kwargs) -> Dict[str, Any]:
        """OpenAI GPT-4 API呼び出し"""
        max_tokens = kwargs.get('max_tokens', int(os.getenv('MAX_TOKENS_OPENAI', 4000)))
        
        try:
            response = await self.openai.chat.completions.create(
                model=kwargs.get('model', "gpt-4-turbo-preview"),
                messages=[{"role": "user", "content": prompt}],
                max_tokens=max_tokens,
                temperature=kwargs.get('temperature', 0.7)
            )
            
            return {
                'success': True,
                'content': response.choices[0].message.content,
                'llm': 'openai',
                'model': kwargs.get('model', 'gpt-4-turbo'),
                'task_type': task_type,
                'tokens_used': response.usage.total_tokens,
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            raise Exception(f"OpenAI API error: {e}")
    
    async def _call_gemini(self, prompt: str, task_type: str, **kwargs) -> Dict[str, Any]:
        """Google Gemini API呼び出し"""
        try:
            response = await self.gemini_model.generate_content_async(
                prompt,
                generation_config=genai.GenerationConfig(
                    temperature=kwargs.get('temperature', 0.7),
                    max_output_tokens=kwargs.get('max_tokens', int(os.getenv('MAX_TOKENS_GEMINI', 4000)))
                )
            )
            
            return {
                'success': True,
                'content': response.text,
                'llm': 'gemini',
                'model': 'gemini-1.5-pro',
                'task_type': task_type,
                'tokens_used': len(prompt.split()) + len(response.text.split()),  # Rough estimate
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            raise Exception(f"Gemini API error: {e}")
    
    async def _fallback_execution(self, prompt: str, task_type: str, preferred_llm: str, **kwargs) -> Dict[str, Any]:
        """フォールバック実行: 希望LLMが使用不可の場合の代替実行"""
        # 利用可能なLLMの優先順位
        fallback_order = ['claude', 'openai', 'gemini']
        
        for llm in fallback_order:
            if llm == preferred_llm:
                continue
                
            try:
                if llm == 'claude' and self.claude:
                    return await self._call_claude(prompt, task_type, **kwargs)
                elif llm == 'openai' and self.openai:
                    return await self._call_openai(prompt, task_type, **kwargs)
                elif llm == 'gemini' and self.gemini_model:
                    return await self._call_gemini(prompt, task_type, **kwargs)
            except Exception as e:
                self.logger.warning(f"Fallback to {llm} failed: {e}")
                continue
        
        raise Exception(f"All LLM clients unavailable for task: {task_type}")
    
    async def parallel_execution(self, tasks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """複数タスクの並行実行"""
        if not tasks:
            return {'total_tasks': 0, 'results': [], 'execution_time': 0}
        
        # 並行実行数制限
        max_parallel = int(os.getenv('PARALLEL_EXECUTION_LIMIT', 5))
        semaphore = asyncio.Semaphore(max_parallel)
        
        async def execute_with_semaphore(task):
            async with semaphore:
                return await self.execute_task(
                    task['type'], 
                    task['prompt'],
                    **task.get('kwargs', {})
                )
        
        start_time = time.time()
        
        # 並行実行
        task_coroutines = [execute_with_semaphore(task) for task in tasks]
        results = await asyncio.gather(*task_coroutines, return_exceptions=True)
        
        execution_time = time.time() - start_time
        
        # 結果集計
        successful_results = [r for r in results if isinstance(r, dict) and r.get('success')]
        failed_results = [r for r in results if not isinstance(r, dict) or not r.get('success')]
        
        return {
            'total_tasks': len(tasks),
            'successful_tasks': len(successful_results),
            'failed_tasks': len(failed_results),
            'results': results,
            'execution_time': execution_time,
            'average_time_per_task': execution_time / len(tasks) if tasks else 0,
            'timestamp': datetime.now().isoformat()
        }
    
    def _update_stats(self, llm: str, execution_time: float, tokens_used: int):
        """実行統計更新"""
        if llm in self.execution_stats:
            stats = self.execution_stats[llm]
            stats['count'] += 1
            stats['total_time'] += execution_time
            stats['total_tokens'] += tokens_used
    
    def get_execution_stats(self) -> Dict[str, Any]:
        """実行統計取得"""
        stats = {}
        
        for llm, data in self.execution_stats.items():
            if data['count'] > 0:
                stats[llm] = {
                    'total_executions': data['count'],
                    'total_time': data['total_time'],
                    'average_time': data['total_time'] / data['count'],
                    'total_tokens': data['total_tokens'],
                    'average_tokens': data['total_tokens'] / data['count']
                }
            else:
                stats[llm] = {
                    'total_executions': 0,
                    'total_time': 0,
                    'average_time': 0,
                    'total_tokens': 0,
                    'average_tokens': 0
                }
        
        return stats
    
    async def health_check(self) -> Dict[str, Any]:
        """各LLMの稼働状況確認"""
        health_status = {}
        
        # Claude健康状態チェック
        if self.claude:
            try:
                test_response = await self._call_claude("Hello", "test", max_tokens=10)
                health_status['claude'] = {'status': 'healthy', 'response_time': 0.5}
            except Exception as e:
                health_status['claude'] = {'status': 'unhealthy', 'error': str(e)}
        else:
            health_status['claude'] = {'status': 'not_configured'}
        
        # OpenAI健康状態チェック
        if self.openai:
            try:
                test_response = await self._call_openai("Hello", "test", max_tokens=10)
                health_status['openai'] = {'status': 'healthy', 'response_time': 0.5}
            except Exception as e:
                health_status['openai'] = {'status': 'unhealthy', 'error': str(e)}
        else:
            health_status['openai'] = {'status': 'not_configured'}
        
        # Gemini健康状態チェック
        if self.gemini_model:
            try:
                test_response = await self._call_gemini("Hello", "test", max_tokens=10)
                health_status['gemini'] = {'status': 'healthy', 'response_time': 0.5}
            except Exception as e:
                health_status['gemini'] = {'status': 'unhealthy', 'error': str(e)}
        else:
            health_status['gemini'] = {'status': 'not_configured'}
        
        return health_status


# グローバルインスタンス
_multi_llm_client = None

def get_multi_llm_client() -> MultiLLMClient:
    """シングルトンパターンでMultiLLMClientを取得"""
    global _multi_llm_client
    if _multi_llm_client is None:
        _multi_llm_client = MultiLLMClient()
    return _multi_llm_client