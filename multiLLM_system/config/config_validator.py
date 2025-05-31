"""
Configuration Validator - 環境変数と設定の検証
すべての必須環境変数と設定項目を起動時に検証
"""

import os
import logging
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)


class ConfigValidator:
    """設定検証クラス"""
    
    # 必須環境変数
    REQUIRED_ENV_VARS = [
        'SLACK_BOT_TOKEN',
        'SLACK_SIGNING_SECRET',
        'SLACK_BOT_ID',
        'OPENAI_API_KEY',
        'ANTHROPIC_API_KEY',
        'GOOGLE_AI_API_KEY',
        'OPENMEMORY_URL'
    ]
    
    # オプション環境変数とデフォルト値
    OPTIONAL_ENV_VARS = {
        'CONEA_PORT': '8000',
        'CONEA_ENV': 'development',
        'REDIS_URL': 'redis://localhost:6379',
        'MAX_WORKERS': '5',
        'MEMORY_SYNC_INTERVAL': '300',
        'LOG_LEVEL': 'INFO'
    }
    
    # 設定スキーマ
    CONFIG_SCHEMA = {
        'orchestrator': {
            'required': ['maxRetries', 'baseDelay'],
            'optional': {
                'maxDelay': 60.0,
                'taskTimeout': 300
            }
        },
        'workers': {
            'required': [],
            'optional': {
                'maxConcurrentTasks': 3,
                'maxQueueSize': 100,
                'maxMemoryEntries': 1000
            }
        },
        'memory': {
            'required': ['syncInterval'],
            'optional': {
                'conflictResolution': 'latest',
                'maxRetries': 3
            }
        },
        'slack': {
            'required': [],
            'optional': {
                'maxThreads': 100,
                'threadTTL': 86400000,  # 24時間
                'cleanupInterval': 900000  # 15分
            }
        },
        'llm': {
            'required': ['providers'],
            'optional': {
                'defaultProvider': 'openai',
                'timeout': 120
            }
        }
    }
    
    @classmethod
    def validate_environment(cls) -> Dict[str, str]:
        """環境変数を検証"""
        errors = []
        warnings = []
        env_vars = {}
        
        # 必須環境変数チェック
        for var in cls.REQUIRED_ENV_VARS:
            value = os.getenv(var)
            if not value:
                errors.append(f"Required environment variable '{var}' is not set")
            else:
                env_vars[var] = value
                # 値の基本的な検証
                if 'API_KEY' in var and len(value) < 10:
                    warnings.append(f"Environment variable '{var}' seems too short for an API key")
        
        # オプション環境変数チェック
        for var, default in cls.OPTIONAL_ENV_VARS.items():
            value = os.getenv(var, default)
            env_vars[var] = value
            logger.info(f"Using {var}={value}")
        
        # 追加の検証
        if env_vars.get('CONEA_ENV') == 'production':
            # プロダクション環境での追加チェック
            production_required = ['SENTRY_DSN', 'MONITORING_ENABLED']
            for var in production_required:
                if not os.getenv(var):
                    warnings.append(f"Recommended environment variable '{var}' is not set for production")
        
        if errors:
            raise ValueError(f"Environment validation failed:\n" + "\n".join(errors))
        
        if warnings:
            for warning in warnings:
                logger.warning(warning)
        
        return env_vars
    
    @classmethod
    def validate_config(cls, config: Dict[str, Any]) -> Dict[str, Any]:
        """設定を検証"""
        errors = []
        validated_config = {}
        
        for section, schema in cls.CONFIG_SCHEMA.items():
            if section not in config and schema['required']:
                errors.append(f"Required config section '{section}' is missing")
                continue
            
            section_config = config.get(section, {})
            validated_section = {}
            
            # 必須項目チェック
            for required_key in schema['required']:
                if required_key not in section_config:
                    errors.append(f"Required config key '{section}.{required_key}' is missing")
                else:
                    validated_section[required_key] = section_config[required_key]
            
            # オプション項目とデフォルト値
            for optional_key, default_value in schema.get('optional', {}).items():
                validated_section[optional_key] = section_config.get(optional_key, default_value)
            
            # 追加の項目も含める（スキーマにない項目も許可）
            for key, value in section_config.items():
                if key not in validated_section:
                    validated_section[key] = value
            
            validated_config[section] = validated_section
        
        if errors:
            raise ValueError(f"Config validation failed:\n" + "\n".join(errors))
        
        # 特定の値の範囲チェック
        cls._validate_ranges(validated_config)
        
        return validated_config
    
    @classmethod
    def _validate_ranges(cls, config: Dict[str, Any]):
        """値の範囲を検証"""
        # Orchestrator設定
        orchestrator = config.get('orchestrator', {})
        if orchestrator.get('maxRetries', 0) < 1:
            raise ValueError("orchestrator.maxRetries must be at least 1")
        if orchestrator.get('baseDelay', 0) < 0.1:
            raise ValueError("orchestrator.baseDelay must be at least 0.1 seconds")
        
        # Worker設定
        for worker_name, worker_config in config.get('workers', {}).items():
            if isinstance(worker_config, dict):
                max_tasks = worker_config.get('maxConcurrentTasks', 3)
                if max_tasks < 1 or max_tasks > 50:
                    raise ValueError(f"Worker '{worker_name}' maxConcurrentTasks must be between 1 and 50")
        
        # Memory設定
        memory = config.get('memory', {})
        sync_interval = memory.get('syncInterval', 300)
        if sync_interval < 60:
            logger.warning("memory.syncInterval is very low (< 60s), this may cause performance issues")
    
    @classmethod
    def validate_llm_providers(cls, providers: Dict[str, Any]):
        """LLMプロバイダー設定を検証"""
        required_providers = ['openai', 'anthropic', 'google']
        
        for provider in required_providers:
            if provider not in providers:
                raise ValueError(f"Required LLM provider '{provider}' is not configured")
            
            provider_config = providers[provider]
            if not provider_config.get('models'):
                raise ValueError(f"LLM provider '{provider}' has no models configured")
    
    @classmethod
    def create_default_config(cls) -> Dict[str, Any]:
        """デフォルト設定を作成"""
        return {
            'orchestrator': {
                'maxRetries': 3,
                'baseDelay': 1.0,
                'maxDelay': 60.0
            },
            'workers': {
                'backend_worker': {
                    'model': 'gpt-4-turbo',
                    'maxConcurrentTasks': 3,
                    'maxQueueSize': 100,
                    'maxMemoryEntries': 1000,
                    'specialization': ['code', 'api', 'bug_fix']
                },
                'frontend_worker': {
                    'model': 'claude-3-sonnet',
                    'maxConcurrentTasks': 3,
                    'maxQueueSize': 100,
                    'maxMemoryEntries': 1000,
                    'specialization': ['ui', 'react', 'css']
                },
                'review_worker': {
                    'model': 'gpt-4',
                    'maxConcurrentTasks': 2,
                    'maxQueueSize': 50,
                    'maxMemoryEntries': 500,
                    'specialization': ['review', 'security', 'best_practices']
                }
            },
            'memory': {
                'syncInterval': 300,
                'conflictResolution': 'latest',
                'storage': {
                    'type': 'openmemory',
                    'connectionString': os.getenv('OPENMEMORY_URL', 'http://localhost:8765')
                }
            },
            'slack': {
                'botToken': os.getenv('SLACK_BOT_TOKEN'),
                'signingSecret': os.getenv('SLACK_SIGNING_SECRET'),
                'maxThreads': 100,
                'threadTTL': 86400000,
                'cleanupInterval': 900000
            },
            'llm': {
                'providers': {
                    'openai': {
                        'apiKey': os.getenv('OPENAI_API_KEY'),
                        'models': ['gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo']
                    },
                    'anthropic': {
                        'apiKey': os.getenv('ANTHROPIC_API_KEY'),
                        'models': ['claude-3-sonnet', 'claude-3-haiku']
                    },
                    'google': {
                        'apiKey': os.getenv('GOOGLE_AI_API_KEY'),
                        'models': ['gemini-1.5-flash', 'gemini-1.5-pro']
                    }
                },
                'defaultProvider': 'openai'
            }
        }
    
    @classmethod
    def validate_and_load(cls) -> Dict[str, Any]:
        """環境変数と設定を検証して読み込む"""
        logger.info("Validating configuration...")
        
        # 環境変数を検証
        env_vars = cls.validate_environment()
        
        # デフォルト設定を作成
        config = cls.create_default_config()
        
        # 設定を検証
        validated_config = cls.validate_config(config)
        
        # LLMプロバイダーを検証
        cls.validate_llm_providers(validated_config['llm']['providers'])
        
        logger.info("✅ Configuration validated successfully")
        
        return validated_config


# 使用例
if __name__ == "__main__":
    import json
    
    # ログ設定
    logging.basicConfig(level=logging.INFO)
    
    try:
        # 設定を検証して読み込む
        config = ConfigValidator.validate_and_load()
        
        # 設定を表示（APIキーをマスク）
        masked_config = json.dumps(config, indent=2, ensure_ascii=False)
        for key in ['apiKey', 'botToken', 'signingSecret']:
            import re
            masked_config = re.sub(
                f'"{key}": "([^"]+)"',
                f'"{key}": "***MASKED***"',
                masked_config
            )
        
        print("Loaded configuration:")
        print(masked_config)
        
    except ValueError as e:
        print(f"Configuration error: {e}")
        exit(1)