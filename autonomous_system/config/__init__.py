"""
Configuration Package
LLM設定・タスクマッピング・環境設定
"""

<<<<<<< HEAD
from .llm_config import LLMConfig
from .task_mapping import TaskMapping
from .config_manager import (
    ConfigManager, 
    ConfigCategory, 
    LLMConfig as LLMConfigDataclass,
    TaskRoutingConfig,
    MonitoringConfig
)
=======
import warnings

# Import configuration components with graceful fallbacks
_available_config_components = []

try:
    from .llm_config import LLMConfig
    _available_config_components.append('LLMConfig')
except ImportError as e:
    warnings.warn(f"LLMConfig not available: {e}", UserWarning)
    
    class LLMConfig:
        """Fallback LLMConfig when dependencies are missing"""
        def __init__(self, *args, **kwargs):
            warnings.warn("LLMConfig is in fallback mode - functionality limited", UserWarning)

try:
    from .task_mapping import TaskMapping
    _available_config_components.append('TaskMapping')
except ImportError as e:
    warnings.warn(f"TaskMapping not available: {e}", UserWarning)
    
    class TaskMapping:
        """Fallback TaskMapping when dependencies are missing"""
        def __init__(self, *args, **kwargs):
            warnings.warn("TaskMapping is in fallback mode - functionality limited", UserWarning)

try:
    from .config_manager import (
        ConfigManager, 
        ConfigCategory, 
        LLMConfig as LLMConfigDataclass,
        TaskRoutingConfig,
        MonitoringConfig
    )
    _available_config_components.extend(['ConfigManager', 'ConfigCategory', 'LLMConfigDataclass', 'TaskRoutingConfig', 'MonitoringConfig'])
except ImportError as e:
    warnings.warn(f"ConfigManager components not available: {e}", UserWarning)
    
    # Create fallback classes
    class ConfigManager:
        """Fallback ConfigManager when dependencies are missing"""
        def __init__(self, *args, **kwargs):
            warnings.warn("ConfigManager is in fallback mode - functionality limited", UserWarning)
    
    class ConfigCategory:
        """Fallback ConfigCategory when dependencies are missing"""
        pass
    
    class LLMConfigDataclass:
        """Fallback LLMConfigDataclass when dependencies are missing"""
        def __init__(self, *args, **kwargs):
            warnings.warn("LLMConfigDataclass is in fallback mode - functionality limited", UserWarning)
    
    class TaskRoutingConfig:
        """Fallback TaskRoutingConfig when dependencies are missing"""
        def __init__(self, *args, **kwargs):
            warnings.warn("TaskRoutingConfig is in fallback mode - functionality limited", UserWarning)
    
    class MonitoringConfig:
        """Fallback MonitoringConfig when dependencies are missing"""
        def __init__(self, *args, **kwargs):
            warnings.warn("MonitoringConfig is in fallback mode - functionality limited", UserWarning)
>>>>>>> origin/feature/autonomous-agent-phase1

__all__ = [
    'LLMConfig', 
    'TaskMapping', 
    'ConfigManager', 
    'ConfigCategory',
    'LLMConfigDataclass',
    'TaskRoutingConfig',
    'MonitoringConfig'
<<<<<<< HEAD
]
=======
]

# Export available components info
AVAILABLE_CONFIG_COMPONENTS = _available_config_components
>>>>>>> origin/feature/autonomous-agent-phase1
