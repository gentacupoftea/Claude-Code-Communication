"""
LLM Configuration Classes
LLM設定管理用クラス
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from enum import Enum


class LLMProvider(Enum):
    """LLM プロバイダー"""
    CLAUDE = "claude"
    OPENAI = "openai"
    GEMINI = "gemini"


class LLMModel(Enum):
    """LLM モデル定義"""
    # Claude models
    CLAUDE_3_7_SONNET = "claude-3-7-sonnet-20250219"
    CLAUDE_3_5_SONNET = "claude-3-5-sonnet-20241022"
    CLAUDE_3_HAIKU = "claude-3-haiku-20240307"
    
    # OpenAI models
    GPT_4_TURBO = "gpt-4-turbo-preview"
    GPT_4 = "gpt-4"
    GPT_3_5_TURBO = "gpt-3.5-turbo"
    
    # Gemini models
    GEMINI_PRO = "gemini-pro"
    GEMINI_PRO_VISION = "gemini-pro-vision"


@dataclass
class LLMConfig:
    """個別LLM設定"""
    provider: LLMProvider
    model: LLMModel
    api_key: str
    api_base: Optional[str] = None
    max_tokens: int = 4000
    temperature: float = 0.7
    rate_limit_rpm: int = 60  # requests per minute
    rate_limit_tpm: int = 100000  # tokens per minute
    timeout: int = 30
    retry_count: int = 3
    retry_delay: float = 1.0
    enabled: bool = True
    
    # 特殊設定
    custom_headers: Dict[str, str] = field(default_factory=dict)
    custom_params: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """辞書形式に変換"""
        return {
            'provider': self.provider.value,
            'model': self.model.value,
            'api_key': self.api_key,
            'api_base': self.api_base,
            'max_tokens': self.max_tokens,
            'temperature': self.temperature,
            'rate_limit_rpm': self.rate_limit_rpm,
            'rate_limit_tpm': self.rate_limit_tpm,
            'timeout': self.timeout,
            'retry_count': self.retry_count,
            'retry_delay': self.retry_delay,
            'enabled': self.enabled,
            'custom_headers': self.custom_headers,
            'custom_params': self.custom_params
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'LLMConfig':
        """辞書から作成"""
        return cls(
            provider=LLMProvider(data['provider']),
            model=LLMModel(data['model']),
            api_key=data['api_key'],
            api_base=data.get('api_base'),
            max_tokens=data.get('max_tokens', 4000),
            temperature=data.get('temperature', 0.7),
            rate_limit_rpm=data.get('rate_limit_rpm', 60),
            rate_limit_tpm=data.get('rate_limit_tpm', 100000),
            timeout=data.get('timeout', 30),
            retry_count=data.get('retry_count', 3),
            retry_delay=data.get('retry_delay', 1.0),
            enabled=data.get('enabled', True),
            custom_headers=data.get('custom_headers', {}),
            custom_params=data.get('custom_params', {})
        )


@dataclass
class LLMMultiConfig:
    """複数LLM管理設定"""
    primary_llms: List[LLMConfig] = field(default_factory=list)
    fallback_llms: List[LLMConfig] = field(default_factory=list)
    load_balancing: bool = True
    health_check_interval: int = 300  # seconds
    auto_failover: bool = True
    
    def get_active_llms(self) -> List[LLMConfig]:
        """アクティブなLLMリストを取得"""
        return [llm for llm in self.primary_llms if llm.enabled]
    
    def get_fallback_llms(self) -> List[LLMConfig]:
        """フォールバックLLMリストを取得"""
        return [llm for llm in self.fallback_llms if llm.enabled]
    
    def add_llm(self, llm_config: LLMConfig, is_primary: bool = True):
        """LLM設定を追加"""
        if is_primary:
            self.primary_llms.append(llm_config)
        else:
            self.fallback_llms.append(llm_config)
    
    def remove_llm(self, provider: LLMProvider, model: LLMModel):
        """LLM設定を削除"""
        self.primary_llms = [
            llm for llm in self.primary_llms 
            if not (llm.provider == provider and llm.model == model)
        ]
        self.fallback_llms = [
            llm for llm in self.fallback_llms 
            if not (llm.provider == provider and llm.model == model)
        ]


def create_default_claude_config(api_key: str) -> LLMConfig:
    """デフォルトClaude設定を作成"""
    return LLMConfig(
        provider=LLMProvider.CLAUDE,
        model=LLMModel.CLAUDE_3_7_SONNET,
        api_key=api_key,
        max_tokens=4000,
        temperature=0.7,
        rate_limit_rpm=50,
        rate_limit_tpm=40000
    )


def create_default_openai_config(api_key: str) -> LLMConfig:
    """デフォルトOpenAI設定を作成"""
    return LLMConfig(
        provider=LLMProvider.OPENAI,
        model=LLMModel.GPT_4_TURBO,
        api_key=api_key,
        max_tokens=4000,
        temperature=0.7,
        rate_limit_rpm=60,
        rate_limit_tpm=100000
    )


def create_default_gemini_config(api_key: str) -> LLMConfig:
    """デフォルトGemini設定を作成"""
    return LLMConfig(
        provider=LLMProvider.GEMINI,
        model=LLMModel.GEMINI_PRO,
        api_key=api_key,
        max_tokens=4000,
        temperature=0.7,
        rate_limit_rpm=60,
        rate_limit_tpm=100000
    )