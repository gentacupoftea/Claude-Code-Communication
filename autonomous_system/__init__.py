"""
Autonomous System Package
マルチLLMエージェント自律システムパッケージ

This package provides a comprehensive autonomous system for managing multiple LLM agents,
orchestrating tasks, monitoring system health, and automatically handling emergencies.

Main Components:
- Orchestrator: Central task coordination and agent management
- Multi-LLM Client: Interface for multiple LLM providers
- Agents: Specialized Claude, OpenAI, and Gemini agents
- Monitoring: System health and error detection
- Config Management: Configuration and environment handling
- GitHub Integration: Automated GitHub operations

Usage:
    from autonomous_system import get_orchestrator, ConfigManager
    from autonomous_system.main import AutonomousSystemMain
    
    # Quick start
    orchestrator = get_orchestrator()
    await orchestrator.start()
    
    # Full system with CLI
    system = AutonomousSystemMain()
    await system.initialize()
    await system.start()
"""

__version__ = "1.0.0"
__author__ = "Claude Code Team"
__description__ = "Autonomous MultiLLM Agent System"

# Core components
from .orchestrator import (
    AutonomousOrchestrator,
    get_orchestrator,
    AutonomousTask,
    TaskStatus,
    TaskPriority
)

from .multi_llm_client import MultiLLMClient

# Configuration
from .config.config_manager import ConfigManager

# Monitoring
from .monitoring.system_monitor import SystemMonitor
from .monitoring.error_detector import ErrorDetector

# Agents
from .agents.claude_agent import ClaudeAnalysisAgent
from .agents.openai_agent import OpenAICodeAgent  
from .agents.gemini_agent import GeminiInfraAgent

# Integrations
from .integrations.github_integration import GitHubIntegration

# Main entry point
from .main import AutonomousSystemMain

# Package info
__all__ = [
    # Version info
    "__version__",
    "__author__", 
    "__description__",
    
    # Core orchestration
    "AutonomousOrchestrator",
    "get_orchestrator",
    "AutonomousTask", 
    "TaskStatus",
    "TaskPriority",
    
    # LLM client
    "MultiLLMClient",
    
    # Configuration
    "ConfigManager",
    
    # Monitoring
    "SystemMonitor",
    "ErrorDetector",
    
    # Agents
    "ClaudeAnalysisAgent",
    "OpenAICodeAgent",
    "GeminiInfraAgent",
    
    # Integrations
    "GitHubIntegration",
    
    # Main system
    "AutonomousSystemMain"
]

# Default configuration
DEFAULT_CONFIG = {
    "orchestrator": {
        "max_concurrent_tasks": 3,
        "health_check_interval": 60,
        "auto_repair_enabled": True
    },
    "llm_client": {
        "timeout": 30,
        "max_retries": 3,
        "rate_limit_per_minute": 60
    },
    "monitoring": {
        "system_check_interval": 30,
        "error_detection_enabled": True,
        "performance_tracking": True
    },
    "logging": {
        "level": "INFO",
        "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        "file_rotation": True
    }
}

# Quick start functions
async def quick_start(config_path: str = None) -> AutonomousSystemMain:
    """
    Quick start function for the autonomous system
    
    Args:
        config_path: Optional path to configuration file
        
    Returns:
        Initialized AutonomousSystemMain instance
        
    Example:
        system = await quick_start()
        await system.start()
    """
    system = AutonomousSystemMain()
    if not await system.initialize(config_path):
        raise RuntimeError("Failed to initialize autonomous system")
    return system

def get_version() -> str:
    """Get package version"""
    return __version__

def get_default_config() -> dict:
    """Get default configuration"""
    return DEFAULT_CONFIG.copy()

# System status check
async def system_health_check() -> dict:
    """
    Perform a quick system health check
    
    Returns:
        Dictionary with health status information
    """
    orchestrator = get_orchestrator()
    return await orchestrator.health_check()

# Emergency response
async def emergency_response(incident_data: dict) -> dict:
    """
    Execute emergency response procedure
    
    Args:
        incident_data: Dictionary containing incident information
        
    Returns:
        Dictionary with emergency response results
    """
    orchestrator = get_orchestrator()
    return await orchestrator.execute_emergency_response(incident_data)

# Task creation shortcuts
def create_analysis_task(description: str, data: dict, priority: TaskPriority = TaskPriority.MEDIUM) -> str:
    """Create a strategic analysis task"""
    orchestrator = get_orchestrator()
    return orchestrator.create_task(
        task_type="strategic_analysis",
        description=description,
        data=data,
        priority=priority
    )

def create_code_task(description: str, data: dict, priority: TaskPriority = TaskPriority.MEDIUM) -> str:
    """Create a code generation/fixing task"""
    orchestrator = get_orchestrator()
    return orchestrator.create_task(
        task_type="code_generation",
        description=description, 
        data=data,
        priority=priority
    )

def create_monitoring_task(description: str, data: dict, priority: TaskPriority = TaskPriority.MEDIUM) -> str:
    """Create a real-time monitoring task"""
    orchestrator = get_orchestrator()
    return orchestrator.create_task(
        task_type="real_time_monitoring",
        description=description,
        data=data,
        priority=priority
    )

# Logging configuration
import logging

def setup_package_logging(level: str = "INFO"):
    """Setup logging for the autonomous system package"""
    logging.basicConfig(
        level=getattr(logging, level.upper()),
        format=DEFAULT_CONFIG["logging"]["format"]
    )
    
    # Set specific loggers for package components
    package_loggers = [
        "autonomous_system.orchestrator",
        "autonomous_system.multi_llm_client", 
        "autonomous_system.agents",
        "autonomous_system.monitoring",
        "autonomous_system.config"
    ]
    
    for logger_name in package_loggers:
        logger = logging.getLogger(logger_name)
        logger.setLevel(getattr(logging, level.upper()))

# Initialize package logging with default level
setup_package_logging()

# Package metadata for introspection
PACKAGE_INFO = {
    "name": "autonomous_system",
    "version": __version__,
    "description": __description__,
    "author": __author__,
    "components": len(__all__),
    "agents_available": ["claude", "openai", "gemini"],
    "features": [
        "Multi-LLM orchestration",
        "Autonomous task management", 
        "Real-time monitoring",
        "Emergency response",
        "GitHub integration",
        "Configuration management",
        "Health checking",
        "Auto-repair capabilities"
    ]
}

def get_package_info() -> dict:
    """Get comprehensive package information"""
    return PACKAGE_INFO.copy()

# Development utilities
def debug_mode():
    """Enable debug mode for development"""
    setup_package_logging("DEBUG")
    logging.getLogger(__name__).info("🐛 Autonomous System: Debug mode enabled")

def production_mode():
    """Configure for production environment"""
    setup_package_logging("WARNING")
    logging.getLogger(__name__).info("🏭 Autonomous System: Production mode enabled")

# Import validation
try:
    # Verify all components can be imported
    from . import orchestrator, multi_llm_client, agents, monitoring, config, integrations
    _IMPORT_SUCCESS = True
except ImportError as e:
    _IMPORT_SUCCESS = False
    logging.getLogger(__name__).error(f"❌ Failed to import autonomous system components: {e}")

if not _IMPORT_SUCCESS:
    raise ImportError("Failed to initialize autonomous system package - check dependencies")

logging.getLogger(__name__).info(f"✅ Autonomous System v{__version__} package loaded successfully")