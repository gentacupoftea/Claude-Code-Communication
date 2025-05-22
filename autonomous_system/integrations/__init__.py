"""
Autonomous System Integrations
外部システム連携モジュール（GitHub、Slack、Jira等）
"""

from .github_integration import GitHubIntegration

__all__ = ['GitHubIntegration']