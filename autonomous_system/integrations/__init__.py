"""
Autonomous System Integrations
外部システム連携モジュール（GitHub、Slack、Jira等）
"""

import warnings

# Import integration components with graceful fallbacks
_available_integrations = []

try:
    from .github_integration import GitHubIntegration
    _available_integrations.append('GitHubIntegration')
except ImportError as e:
    warnings.warn(f"GitHubIntegration not available: {e}", UserWarning)
    
    class GitHubIntegration:
        """Fallback GitHubIntegration when dependencies are missing"""
        def __init__(self, *args, **kwargs):
            warnings.warn("GitHubIntegration is in fallback mode - functionality disabled", UserWarning)
        
        async def get_repository_info(self, *args, **kwargs):
            return {'error': 'GitHubIntegration disabled - dependencies missing'}
        
        async def create_issue(self, *args, **kwargs):
            warnings.warn("Cannot create GitHub issue - GitHubIntegration disabled", UserWarning)
            return False
        
        async def create_pull_request(self, *args, **kwargs):
            warnings.warn("Cannot create GitHub PR - GitHubIntegration disabled", UserWarning)
            return False

__all__ = ['GitHubIntegration']

# Export available integrations info
AVAILABLE_INTEGRATIONS = _available_integrations