"""
AI Agents Package
各LLMの専門性を活かした特化エージェント
"""

<<<<<<< HEAD
from .claude_agent import ClaudeAnalysisAgent
from .openai_agent import OpenAICodeAgent
from .gemini_agent import GeminiInfraAgent

__all__ = ['ClaudeAnalysisAgent', 'OpenAICodeAgent', 'GeminiInfraAgent']
=======
import warnings

# Import agents with graceful fallbacks
_available_agents = []

try:
    from .claude_agent import ClaudeAnalysisAgent
    _available_agents.append('ClaudeAnalysisAgent')
except ImportError as e:
    warnings.warn(f"ClaudeAnalysisAgent not available: {e}", UserWarning)
    
    class ClaudeAnalysisAgent:
        """Fallback ClaudeAnalysisAgent when dependencies are missing"""
        def __init__(self, *args, **kwargs):
            warnings.warn("ClaudeAnalysisAgent is in fallback mode - functionality disabled", UserWarning)

try:
    from .openai_agent import OpenAICodeAgent
    _available_agents.append('OpenAICodeAgent')
except ImportError as e:
    warnings.warn(f"OpenAICodeAgent not available: {e}", UserWarning)
    
    class OpenAICodeAgent:
        """Fallback OpenAICodeAgent when dependencies are missing"""
        def __init__(self, *args, **kwargs):
            warnings.warn("OpenAICodeAgent is in fallback mode - functionality disabled", UserWarning)

try:
    from .gemini_agent import GeminiInfraAgent
    _available_agents.append('GeminiInfraAgent')
except ImportError as e:
    warnings.warn(f"GeminiInfraAgent not available: {e}", UserWarning)
    
    class GeminiInfraAgent:
        """Fallback GeminiInfraAgent when dependencies are missing"""
        def __init__(self, *args, **kwargs):
            warnings.warn("GeminiInfraAgent is in fallback mode - functionality disabled", UserWarning)

__all__ = ['ClaudeAnalysisAgent', 'OpenAICodeAgent', 'GeminiInfraAgent']

# Export available agents info
AVAILABLE_AGENTS = _available_agents
>>>>>>> origin/feature/autonomous-agent-phase1
