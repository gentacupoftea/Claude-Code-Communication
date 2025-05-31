"""
OpenAI Code Agent - OpenAI専門エージェント
コード生成・API実装・バグ修正・テスト生成を担当する実装専門エージェント
"""

from typing import Dict, Any, List, Optional
import json
import logging
from datetime import datetime
from ..multi_llm_client import MultiLLMClient

class OpenAICodeAgent:
    """OpenAI専門エージェント：コード生成・API実装・バグ修正・テスト生成"""
    
    def __init__(self, llm_client: MultiLLMClient):
        self.llm = llm_client
        self.agent_role = "Senior Full-Stack Developer & Test Engineer"
        self.logger = logging.getLogger(__name__)
    
    async def generate_fix_code(self, error_data: Dict[str, Any], requirements: Dict[str, Any]) -> Dict[str, Any]:
        """エラー修復コード自動生成"""
        prompt = f"""
        {self.agent_role}として、以下のエラーを完全に修復するコードを生成してください：

        ## エラー情報
        エラータイプ: {error_data.get('type', '')}
        エラーメッセージ: {error_data.get('message', '')}
        発生ファイル: {error_data.get('file_path', '')}
        エラー行番号: {error_data.get('line_number', '')}
        スタックトレース: {error_data.get('stack_trace', '')}
        関連コード: {error_data.get('code_context', '')}

        ## 修復要件
        技術スタック: {requirements.get('tech_stack', 'React, Node.js, TypeScript')}
        互換性要求: {requirements.get('compatibility', '')}
        パフォーマンス要求: {requirements.get('performance', '')}
        セキュリティ要求: {requirements.get('security', '')}

        ## 提供内容（JSON形式で回答）
        {{
          "fix_summary": {{
            "error_analysis": "string",
            "root_cause": "string",
            "fix_approach": "string",
            "impact_assessment": "string"
          }},
          "code_changes": [
            {{
              "file_path": "string",
              "change_type": "modify|create|delete",
              "original_code": "string",
              "fixed_code": "string",
              "explanation": "string"
            }}
          ],
          "test_code": {{
            "unit_tests": [
              {{
                "test_file": "string",
                "test_name": "string",
                "test_code": "string",
                "test_description": "string"
              }}
            ],
            "integration_tests": [
              {{
                "test_file": "string",
                "test_name": "string",
                "test_code": "string",
                "test_description": "string"
              }}
            ]
          }},
          "api_updates": {{
            "openapi_spec": "string",
            "endpoint_changes": [
              {{
                "endpoint": "string",
                "method": "string",
                "changes": "string",
                "breaking_change": "boolean"
              }}
            ],
            "response_format_changes": "string"
          }},
          "implementation_steps": [
            {{
              "step": "number",
              "description": "string",
              "commands": ["command1", "command2"],
              "verification": "string"
            }}
          ],
          "pull_request_data": {{
            "title": "string",
            "description": "string",
            "commit_messages": ["message1", "message2"],
            "reviewer_checklist": ["item1", "item2"],
            "breaking_changes": "boolean",
            "testing_instructions": "string"
          }},
          "dependencies": {{
            "new_dependencies": ["dep1", "dep2"],
            "updated_dependencies": ["dep1", "dep2"],
            "removed_dependencies": ["dep1", "dep2"]
          }},
          "configuration_changes": {{
            "environment_variables": {{"VAR1": "value1"}},
            "config_files": [
              {{
                "file": "string",
                "changes": "string"
              }}
            ]
          }}
        }}

        実際に実行可能な完全なコードセットとデプロイ手順をJSON形式で提供してください。
        """
        
        try:
            result = await self.llm.execute_task('code_generation', prompt)
            if result.get('success'):
                try:
                    fix_data = json.loads(result['content'])
                    result['structured_fix'] = fix_data
                    
                    # 修復の複雑度評価
                    complexity_score = self._evaluate_fix_complexity(fix_data)
                    result['complexity_score'] = complexity_score
                    
                except json.JSONDecodeError:
                    result['raw_fix'] = result['content']
            return result
        except Exception as e:
            self.logger.error(f"Fix code generation failed: {e}")
            return {'success': False, 'error': str(e), 'agent': 'openai'}
    
    async def api_integration(self, integration_spec: Dict[str, Any]) -> Dict[str, Any]:
        """外部API統合実装"""
        prompt = f"""
        API統合エンジニアとして、以下の外部サービス統合を実装してください：

        ## 統合仕様
        サービス名: {integration_spec.get('service_name', '')}
        API仕様: {integration_spec.get('api_spec', '')}
        認証方式: {integration_spec.get('auth_method', '')}
        データ形式: {integration_spec.get('data_format', 'JSON')}
        レート制限: {integration_spec.get('rate_limits', '')}
        セキュリティ要件: {integration_spec.get('security_requirements', '')}

        ## 実装内容（JSON形式で回答）
        {{
          "api_client_implementation": {{
            "client_class": "string",
            "typescript_interfaces": "string",
            "authentication_handler": "string",
            "rate_limiter": "string",
            "error_handler": "string",
            "retry_mechanism": "string"
          }},
          "authentication_system": {{
            "auth_type": "oauth2|api_key|jwt|basic",
            "token_management": "string",
            "refresh_mechanism": "string",
            "security_implementation": "string"
          }},
          "data_transformation": {{
            "input_validation": "string",
            "data_mapper": "string",
            "response_normalizer": "string",
            "type_definitions": "string"
          }},
          "monitoring_logging": {{
            "api_call_logger": "string",
            "performance_metrics": "string",
            "error_tracking": "string",
            "health_check": "string"
          }},
          "implementation_files": [
            {{
              "file_path": "string",
              "file_type": "typescript|javascript|json|yaml",
              "content": "string",
              "purpose": "string"
            }}
          ],
          "configuration": {{
            "environment_variables": {{"VAR1": "value1"}},
            "config_schema": "string",
            "default_settings": "string"
          }},
          "testing_suite": {{
            "unit_tests": "string",
            "integration_tests": "string",
            "mock_data": "string",
            "test_scenarios": ["scenario1", "scenario2"]
          }},
          "documentation": {{
            "api_usage_guide": "string",
            "configuration_guide": "string",
            "troubleshooting_guide": "string",
            "example_implementations": "string"
          }}
        }}

        本番環境で即座に使用可能な完全な統合実装をJSON形式で提供してください。
        """
        
        try:
            result = await self.llm.execute_task('api_integration', prompt)
            if result.get('success'):
                try:
                    integration = json.loads(result['content'])
                    result['structured_integration'] = integration
                except json.JSONDecodeError:
                    result['raw_integration'] = result['content']
            return result
        except Exception as e:
            self.logger.error(f"API integration failed: {e}")
            return {'success': False, 'error': str(e), 'agent': 'openai'}
    
    async def automated_testing(self, test_requirements: Dict[str, Any]) -> Dict[str, Any]:
        """自動テスト生成・実行"""
        prompt = f"""
        QAエンジニアとして、以下の機能に対する包括的な自動テストを生成してください：

        ## テスト対象
        機能名: {test_requirements.get('feature_name', '')}
        テスト範囲: {test_requirements.get('scope', '')}
        品質要求: {test_requirements.get('quality_requirements', '')}
        カバレッジ目標: {test_requirements.get('coverage_target', '90%')}
        技術スタック: {test_requirements.get('tech_stack', '')}

        ## テスト実装（JSON形式で回答）
        {{
          "test_strategy": {{
            "testing_approach": "string",
            "test_levels": ["unit", "integration", "e2e"],
            "coverage_strategy": "string",
            "risk_based_testing": "string"
          }},
          "unit_tests": {{
            "framework": "jest|vitest|mocha",
            "test_files": [
              {{
                "file_path": "string",
                "test_code": "string",
                "description": "string",
                "test_cases": ["case1", "case2"]
              }}
            ],
            "mock_implementations": "string",
            "test_utilities": "string"
          }},
          "integration_tests": {{
            "framework": "jest|supertest|cypress",
            "api_tests": [
              {{
                "endpoint": "string",
                "test_code": "string",
                "test_scenarios": ["scenario1", "scenario2"]
              }}
            ],
            "database_tests": "string",
            "external_service_tests": "string"
          }},
          "e2e_tests": {{
            "framework": "playwright|cypress|selenium",
            "user_scenarios": [
              {{
                "scenario_name": "string",
                "test_code": "string",
                "steps": ["step1", "step2"],
                "expected_outcomes": ["outcome1", "outcome2"]
              }}
            ],
            "accessibility_tests": "string",
            "cross_browser_tests": "string"
          }},
          "performance_tests": {{
            "load_testing": "string",
            "stress_testing": "string",
            "benchmark_tests": "string",
            "performance_assertions": "string"
          }},
          "test_configuration": {{
            "jest_config": "string",
            "test_scripts": {{"script1": "command1"}},
            "ci_cd_integration": "string",
            "test_data_management": "string"
          }},
          "quality_gates": {{
            "coverage_requirements": "string",
            "performance_benchmarks": "string",
            "security_tests": "string",
            "accessibility_standards": "string"
          }}
        }}

        実行可能なテストスイート一式とCI/CD統合をJSON形式で提供してください。
        """
        
        try:
            result = await self.llm.execute_task('test_generation', prompt)
            if result.get('success'):
                try:
                    test_suite = json.loads(result['content'])
                    result['structured_tests'] = test_suite
                except json.JSONDecodeError:
                    result['raw_tests'] = result['content']
            return result
        except Exception as e:
            self.logger.error(f"Automated testing generation failed: {e}")
            return {'success': False, 'error': str(e), 'agent': 'openai'}
    
    async def code_refactoring(self, refactor_request: Dict[str, Any]) -> Dict[str, Any]:
        """コードリファクタリング・最適化・モダナイゼーション"""
        prompt = f"""
        シニアソフトウェアエンジニアとして、以下のコードをリファクタリングしてください：

        ## リファクタリング対象
        ファイルパス: {refactor_request.get('file_path', '')}
        現在のコード: {refactor_request.get('current_code', '')}
        リファクタリング目的: {refactor_request.get('purpose', '')}
        制約条件: {refactor_request.get('constraints', '')}
        品質目標: {refactor_request.get('quality_goals', '')}

        ## リファクタリング実装（JSON形式で回答）
        {{
          "refactoring_analysis": {{
            "code_smells_identified": ["smell1", "smell2"],
            "performance_issues": ["issue1", "issue2"],
            "maintainability_concerns": ["concern1", "concern2"],
            "security_improvements": ["improvement1", "improvement2"]
          }},
          "refactored_code": {{
            "new_structure": "string",
            "improved_code": "string",
            "design_patterns_applied": ["pattern1", "pattern2"],
            "performance_optimizations": ["opt1", "opt2"]
          }},
          "breaking_changes": {{
            "api_changes": ["change1", "change2"],
            "migration_strategy": "string",
            "backward_compatibility": "string",
            "deprecation_plan": "string"
          }},
          "testing_updates": {{
            "updated_tests": "string",
            "new_test_cases": "string",
            "test_coverage_improvement": "string"
          }},
          "documentation_updates": {{
            "code_comments": "string",
            "api_documentation": "string",
            "migration_guide": "string"
          }},
          "implementation_plan": [
            {{
              "phase": "string",
              "changes": "string",
              "testing_strategy": "string",
              "rollback_plan": "string"
            }}
          ]
        }}

        保守性・性能・セキュリティを向上させるリファクタリングをJSON形式で提供してください。
        """
        
        try:
            result = await self.llm.execute_task('refactoring', prompt)
            if result.get('success'):
                try:
                    refactor_data = json.loads(result['content'])
                    result['structured_refactoring'] = refactor_data
                except json.JSONDecodeError:
                    result['raw_refactoring'] = result['content']
            return result
        except Exception as e:
            self.logger.error(f"Code refactoring failed: {e}")
            return {'success': False, 'error': str(e), 'agent': 'openai'}
    
    async def bug_diagnosis_and_fix(self, bug_report: Dict[str, Any]) -> Dict[str, Any]:
        """バグ診断・原因分析・修正実装"""
        prompt = f"""
        デバッグエンジニアとして、以下のバグを診断して修正してください：

        ## バグ報告
        バグタイトル: {bug_report.get('title', '')}
        症状: {bug_report.get('symptoms', '')}
        再現手順: {bug_report.get('reproduction_steps', '')}
        期待される動作: {bug_report.get('expected_behavior', '')}
        実際の動作: {bug_report.get('actual_behavior', '')}
        環境情報: {bug_report.get('environment', '')}
        ログ情報: {bug_report.get('logs', '')}

        ## バグ診断・修正（JSON形式で回答）
        {{
          "bug_analysis": {{
            "bug_category": "logic|performance|security|ui|integration",
            "severity": "critical|high|medium|low",
            "root_cause": "string",
            "affected_components": ["component1", "component2"],
            "impact_assessment": "string"
          }},
          "diagnostic_steps": [
            {{
              "step": "string",
              "method": "string",
              "findings": "string",
              "conclusion": "string"
            }}
          ],
          "fix_implementation": {{
            "fix_approach": "string",
            "code_changes": [
              {{
                "file": "string",
                "original": "string",
                "fixed": "string",
                "explanation": "string"
              }}
            ],
            "configuration_changes": "string",
            "dependency_updates": "string"
          }},
          "testing_verification": {{
            "test_cases": [
              {{
                "test_name": "string",
                "test_code": "string",
                "verification_criteria": "string"
              }}
            ],
            "regression_tests": "string",
            "manual_testing_steps": ["step1", "step2"]
          }},
          "prevention_measures": {{
            "code_improvements": ["improvement1", "improvement2"],
            "monitoring_enhancements": ["enhancement1", "enhancement2"],
            "process_improvements": ["process1", "process2"]
          }},
          "deployment_plan": {{
            "rollout_strategy": "string",
            "risk_mitigation": "string",
            "rollback_plan": "string",
            "monitoring_points": ["point1", "point2"]
          }}
        }}

        完全なバグ診断と修正実装をJSON形式で提供してください。
        """
        
        try:
            result = await self.llm.execute_task('bug_fixing', prompt)
            if result.get('success'):
                try:
                    bug_fix = json.loads(result['content'])
                    result['structured_bug_fix'] = bug_fix
                except json.JSONDecodeError:
                    result['raw_bug_fix'] = result['content']
            return result
        except Exception as e:
            self.logger.error(f"Bug diagnosis and fix failed: {e}")
            return {'success': False, 'error': str(e), 'agent': 'openai'}
    
    def _evaluate_fix_complexity(self, fix_data: Dict[str, Any]) -> int:
        """修復の複雑度評価（1-10スケール）"""
        complexity = 1
        
        if 'code_changes' in fix_data:
            changes = fix_data['code_changes']
            complexity += min(len(changes), 3)  # ファイル数
            
            for change in changes:
                if change.get('change_type') == 'create':
                    complexity += 1
                if len(change.get('fixed_code', '')) > 1000:
                    complexity += 1
        
        if fix_data.get('pull_request_data', {}).get('breaking_changes'):
            complexity += 2
        
        if len(fix_data.get('dependencies', {}).get('new_dependencies', [])) > 0:
            complexity += 1
        
        return min(complexity, 10)
    
    def get_agent_info(self) -> Dict[str, Any]:
        """エージェント情報取得"""
        return {
            'agent_type': 'openai',
            'role': self.agent_role,
            'specializations': [
                'code_generation',
                'api_integration',
                'bug_fixing',
                'test_generation',
                'refactoring',
                'documentation'
            ],
            'capabilities': {
                'code_quality': 'high',
                'implementation_speed': 'fast',
                'testing_coverage': 'comprehensive',
                'api_expertise': 'advanced'
            },
            'optimal_use_cases': [
                'Code implementation and fixes',
                'API development and integration',
                'Test automation and quality assurance',
                'Bug resolution and debugging',
                'Code refactoring and optimization',
                'Technical documentation'
            ]
        }