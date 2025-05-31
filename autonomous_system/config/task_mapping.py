"""
Task Mapping Configuration
タスクルーティング設定管理
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Set
from enum import Enum
from .llm_config import LLMProvider, LLMModel


class TaskType(Enum):
    """タスクタイプ定義"""
    # Analysis tasks
    STRATEGIC_ANALYSIS = "strategic_analysis"
    CODE_ANALYSIS = "code_analysis"
    QUALITY_REVIEW = "quality_review"
    PERFORMANCE_ANALYSIS = "performance_analysis"
    
    # Development tasks
    CODE_GENERATION = "code_generation"
    CODE_REFACTORING = "code_refactoring"
    BUG_FIXING = "bug_fixing"
    TEST_GENERATION = "test_generation"
    
    # Infrastructure tasks
    DEPLOYMENT = "deployment"
    MONITORING = "monitoring"
    OPTIMIZATION = "optimization"
    SCALING = "scaling"
    
    # Emergency tasks
    INCIDENT_RESPONSE = "incident_response"
    EMERGENCY_FIX = "emergency_fix"
    ROLLBACK = "rollback"
    
    # Documentation tasks
    DOCUMENTATION = "documentation"
    API_DOCS = "api_docs"
    
    # Management tasks
    PROJECT_COORDINATION = "project_coordination"
    RESOURCE_MANAGEMENT = "resource_management"


class TaskPriority(Enum):
    """タスク優先度"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass
class TaskRoute:
    """タスクルート設定"""
    task_type: TaskType
    primary_provider: LLMProvider
    primary_model: LLMModel
    fallback_providers: List[LLMProvider] = field(default_factory=list)
    fallback_models: List[LLMModel] = field(default_factory=list)
    required_capabilities: Set[str] = field(default_factory=set)
    min_context_length: int = 4000
    preferred_temperature: float = 0.7
    max_retries: int = 3
    timeout_seconds: int = 30
    
    def to_dict(self) -> Dict[str, Any]:
        """辞書形式に変換"""
        return {
            'task_type': self.task_type.value,
            'primary_provider': self.primary_provider.value,
            'primary_model': self.primary_model.value,
            'fallback_providers': [p.value for p in self.fallback_providers],
            'fallback_models': [m.value for m in self.fallback_models],
            'required_capabilities': list(self.required_capabilities),
            'min_context_length': self.min_context_length,
            'preferred_temperature': self.preferred_temperature,
            'max_retries': self.max_retries,
            'timeout_seconds': self.timeout_seconds
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'TaskRoute':
        """辞書から作成"""
        return cls(
            task_type=TaskType(data['task_type']),
            primary_provider=LLMProvider(data['primary_provider']),
            primary_model=LLMModel(data['primary_model']),
            fallback_providers=[LLMProvider(p) for p in data.get('fallback_providers', [])],
            fallback_models=[LLMModel(m) for m in data.get('fallback_models', [])],
            required_capabilities=set(data.get('required_capabilities', [])),
            min_context_length=data.get('min_context_length', 4000),
            preferred_temperature=data.get('preferred_temperature', 0.7),
            max_retries=data.get('max_retries', 3),
            timeout_seconds=data.get('timeout_seconds', 30)
        )


@dataclass
class TaskMapping:
    """タスクマッピング管理"""
    routes: Dict[TaskType, TaskRoute] = field(default_factory=dict)
    priority_weights: Dict[TaskPriority, float] = field(default_factory=lambda: {
        TaskPriority.CRITICAL: 1.0,
        TaskPriority.HIGH: 0.8,
        TaskPriority.MEDIUM: 0.6,
        TaskPriority.LOW: 0.4
    })
    load_balancing_enabled: bool = True
    health_check_required: bool = True
    
    def add_route(self, route: TaskRoute):
        """ルートを追加"""
        self.routes[route.task_type] = route
    
    def get_route(self, task_type: TaskType) -> Optional[TaskRoute]:
        """ルートを取得"""
        return self.routes.get(task_type)
    
    def remove_route(self, task_type: TaskType):
        """ルートを削除"""
        if task_type in self.routes:
            del self.routes[task_type]
    
    def get_routes_by_provider(self, provider: LLMProvider) -> List[TaskRoute]:
        """特定プロバイダーのルートを取得"""
        return [
            route for route in self.routes.values()
            if route.primary_provider == provider
        ]
    
    def get_fallback_routes(self, task_type: TaskType) -> List[TaskRoute]:
        """フォールバックルートを取得"""
        route = self.get_route(task_type)
        if not route:
            return []
        
        fallback_routes = []
        for i, provider in enumerate(route.fallback_providers):
            if i < len(route.fallback_models):
                fallback_route = TaskRoute(
                    task_type=task_type,
                    primary_provider=provider,
                    primary_model=route.fallback_models[i],
                    required_capabilities=route.required_capabilities,
                    min_context_length=route.min_context_length,
                    preferred_temperature=route.preferred_temperature,
                    max_retries=route.max_retries,
                    timeout_seconds=route.timeout_seconds
                )
                fallback_routes.append(fallback_route)
        
        return fallback_routes


def create_default_task_mapping() -> TaskMapping:
    """デフォルトタスクマッピングを作成"""
    mapping = TaskMapping()
    
    # Claude specialized routes
    claude_analysis_tasks = [
        TaskType.STRATEGIC_ANALYSIS,
        TaskType.QUALITY_REVIEW,
        TaskType.PROJECT_COORDINATION,
        TaskType.INCIDENT_RESPONSE
    ]
    
    for task_type in claude_analysis_tasks:
        route = TaskRoute(
            task_type=task_type,
            primary_provider=LLMProvider.CLAUDE,
            primary_model=LLMModel.CLAUDE_3_7_SONNET,
            fallback_providers=[LLMProvider.OPENAI, LLMProvider.GEMINI],
            fallback_models=[LLMModel.GPT_4_TURBO, LLMModel.GEMINI_PRO],
            required_capabilities={"reasoning", "analysis"},
            min_context_length=8000,
            preferred_temperature=0.3
        )
        mapping.add_route(route)
    
    # OpenAI specialized routes
    openai_code_tasks = [
        TaskType.CODE_GENERATION,
        TaskType.CODE_REFACTORING,
        TaskType.BUG_FIXING,
        TaskType.TEST_GENERATION
    ]
    
    for task_type in openai_code_tasks:
        route = TaskRoute(
            task_type=task_type,
            primary_provider=LLMProvider.OPENAI,
            primary_model=LLMModel.GPT_4_TURBO,
            fallback_providers=[LLMProvider.CLAUDE, LLMProvider.GEMINI],
            fallback_models=[LLMModel.CLAUDE_3_7_SONNET, LLMModel.GEMINI_PRO],
            required_capabilities={"coding", "debugging"},
            min_context_length=6000,
            preferred_temperature=0.2
        )
        mapping.add_route(route)
    
    # Gemini specialized routes
    gemini_infra_tasks = [
        TaskType.DEPLOYMENT,
        TaskType.MONITORING,
        TaskType.OPTIMIZATION,
        TaskType.SCALING
    ]
    
    for task_type in gemini_infra_tasks:
        route = TaskRoute(
            task_type=task_type,
            primary_provider=LLMProvider.GEMINI,
            primary_model=LLMModel.GEMINI_PRO,
            fallback_providers=[LLMProvider.CLAUDE, LLMProvider.OPENAI],
            fallback_models=[LLMModel.CLAUDE_3_7_SONNET, LLMModel.GPT_4_TURBO],
            required_capabilities={"infrastructure", "automation"},
            min_context_length=4000,
            preferred_temperature=0.1
        )
        mapping.add_route(route)
    
    # Documentation tasks (balanced)
    doc_tasks = [TaskType.DOCUMENTATION, TaskType.API_DOCS]
    for task_type in doc_tasks:
        route = TaskRoute(
            task_type=task_type,
            primary_provider=LLMProvider.CLAUDE,
            primary_model=LLMModel.CLAUDE_3_7_SONNET,
            fallback_providers=[LLMProvider.OPENAI],
            fallback_models=[LLMModel.GPT_4_TURBO],
            required_capabilities={"writing", "documentation"},
            min_context_length=4000,
            preferred_temperature=0.5
        )
        mapping.add_route(route)
    
    return mapping


def create_emergency_task_mapping() -> TaskMapping:
    """緊急時タスクマッピングを作成"""
    mapping = TaskMapping()
    
    # 緊急時は最も信頼性の高いプロバイダーを優先
    emergency_tasks = [
        TaskType.EMERGENCY_FIX,
        TaskType.ROLLBACK,
        TaskType.INCIDENT_RESPONSE
    ]
    
    for task_type in emergency_tasks:
        route = TaskRoute(
            task_type=task_type,
            primary_provider=LLMProvider.CLAUDE,
            primary_model=LLMModel.CLAUDE_3_7_SONNET,
            fallback_providers=[LLMProvider.OPENAI, LLMProvider.GEMINI],
            fallback_models=[LLMModel.GPT_4, LLMModel.GEMINI_PRO],
            required_capabilities={"emergency", "critical_thinking"},
            min_context_length=8000,
            preferred_temperature=0.1,  # 低温度で確実性を重視
            max_retries=5,
            timeout_seconds=60
        )
        mapping.add_route(route)
    
    return mapping