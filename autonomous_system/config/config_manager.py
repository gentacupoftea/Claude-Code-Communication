"""
Configuration Management System for MultiLLM Autonomous System

This module provides comprehensive configuration management including:
- LLM API configurations and credentials
- Task routing and mapping configurations
- System monitoring and threshold settings
- Environment-specific configurations
- Secure credential storage and management
"""

import json
import os
import logging
import threading
import hashlib
import base64
from typing import Dict, Any, Optional, List, Union
from pathlib import Path

# Optional imports with fallbacks
try:
    import yaml
    YAML_AVAILABLE = True
except ImportError:
    YAML_AVAILABLE = False
    yaml = None
from datetime import datetime
from cryptography.fernet import Fernet
from dataclasses import dataclass, asdict
from enum import Enum


class ConfigCategory(Enum):
    """Configuration categories for organized management"""
    LLM_SETTINGS = "llm_settings"
    TASK_ROUTING = "task_routing"
    MONITORING = "monitoring"
    GITHUB_INTEGRATION = "github_integration"
    ERROR_HANDLING = "error_handling"
    SYSTEM_SETTINGS = "system_settings"


@dataclass
class LLMConfig:
    """LLM configuration structure"""
    api_key: str
    endpoint: str
    model: str
    max_tokens: int = 4000
    temperature: float = 0.7
    rate_limit_rpm: int = 60
    timeout: int = 30
    retry_attempts: int = 3
    backup_model: Optional[str] = None


@dataclass
class TaskRoutingConfig:
    """Task routing configuration structure"""
    task_type: str
    primary_llm: str
    fallback_llms: List[str]
    confidence_threshold: float = 0.8
    complexity_score: int = 1
    priority: int = 1


@dataclass
class MonitoringConfig:
    """Monitoring configuration structure"""
    cpu_threshold: float = 80.0
    memory_threshold: float = 85.0
    disk_threshold: float = 90.0
    response_time_threshold: float = 30.0
    error_rate_threshold: float = 5.0
    health_check_interval: int = 60
    alert_email: Optional[str] = None


class ConfigManager:
    """
    Comprehensive configuration management system for the MultiLLM autonomous system.
    
    Features:
    - Secure credential storage with encryption
    - Hot reloading of configurations
    - Environment-specific settings
    - Configuration validation and backup
    - Thread-safe operations
    """
    
    def __init__(self, config_dir: str = None, encryption_key: str = None):
        """
        Initialize the configuration manager.
        
        Args:
            config_dir: Directory to store configuration files
            encryption_key: Key for encrypting sensitive data
        """
        self.config_dir = Path(config_dir or os.path.join(os.getcwd(), "config"))
        self.config_dir.mkdir(exist_ok=True)
        
        # Initialize encryption
        self.encryption_key = encryption_key or os.getenv("CONFIG_ENCRYPTION_KEY")
        if not self.encryption_key:
            self.encryption_key = Fernet.generate_key().decode()
            self._save_encryption_key()
        
        self.cipher_suite = Fernet(self.encryption_key.encode() if isinstance(self.encryption_key, str) else self.encryption_key)
        
        # Configuration storage
        self.configurations: Dict[ConfigCategory, Dict[str, Any]] = {}
        self.encrypted_configs: Dict[str, str] = {}
        
        # Thread safety
        self.config_lock = threading.RLock()
        
        # File watchers for hot reloading
        self.file_watchers: Dict[str, float] = {}
        
        # Logger
        self.logger = logging.getLogger(__name__)
        
        # Initialize default configurations
        self._initialize_default_configs()
        self._load_all_configurations()
    
    def _save_encryption_key(self):
        """Save encryption key to environment or secure location"""
        key_file = self.config_dir / ".encryption_key"
        with open(key_file, "wb") as f:
            f.write(self.encryption_key.encode() if isinstance(self.encryption_key, str) else self.encryption_key)
        os.chmod(key_file, 0o600)  # Restrict permissions
    
    def _initialize_default_configs(self):
        """Initialize default configuration structures"""
        with self.config_lock:
            # Default LLM configurations
            self.configurations[ConfigCategory.LLM_SETTINGS] = {
                "claude": {
                    "api_key": "",
                    "endpoint": "https://api.anthropic.com/v1/messages",
                    "model": "claude-3-sonnet-20240229",
                    "max_tokens": 4000,
                    "temperature": 0.7,
                    "rate_limit_rpm": 60,
                    "timeout": 30,
                    "retry_attempts": 3
                },
                "openai": {
                    "api_key": "",
                    "endpoint": "https://api.openai.com/v1/chat/completions",
                    "model": "gpt-4",
                    "max_tokens": 4000,
                    "temperature": 0.7,
                    "rate_limit_rpm": 60,
                    "timeout": 30,
                    "retry_attempts": 3
                },
                "gemini": {
                    "api_key": "",
                    "endpoint": "https://generativelanguage.googleapis.com/v1/models",
                    "model": "gemini-pro",
                    "max_tokens": 4000,
                    "temperature": 0.7,
                    "rate_limit_rpm": 60,
                    "timeout": 30,
                    "retry_attempts": 3
                }
            }
            
            # Default task routing
            self.configurations[ConfigCategory.TASK_ROUTING] = {
                "code_generation": {
                    "primary_llm": "claude",
                    "fallback_llms": ["openai", "gemini"],
                    "confidence_threshold": 0.8,
                    "complexity_score": 3,
                    "priority": 1
                },
                "code_review": {
                    "primary_llm": "claude",
                    "fallback_llms": ["openai"],
                    "confidence_threshold": 0.85,
                    "complexity_score": 2,
                    "priority": 2
                },
                "documentation": {
                    "primary_llm": "openai",
                    "fallback_llms": ["claude", "gemini"],
                    "confidence_threshold": 0.7,
                    "complexity_score": 1,
                    "priority": 3
                },
                "testing": {
                    "primary_llm": "claude",
                    "fallback_llms": ["openai"],
                    "confidence_threshold": 0.8,
                    "complexity_score": 2,
                    "priority": 2
                }
            }
            
            # Default monitoring settings
            self.configurations[ConfigCategory.MONITORING] = {
                "thresholds": {
                    "cpu_threshold": 80.0,
                    "memory_threshold": 85.0,
                    "disk_threshold": 90.0,
                    "response_time_threshold": 30.0,
                    "error_rate_threshold": 5.0
                },
                "intervals": {
                    "health_check_interval": 60,
                    "metrics_collection_interval": 30,
                    "log_rotation_interval": 3600
                },
                "alerts": {
                    "email_enabled": False,
                    "alert_email": "",
                    "slack_webhook": "",
                    "discord_webhook": ""
                }
            }
            
            # Default GitHub integration
            self.configurations[ConfigCategory.GITHUB_INTEGRATION] = {
                "credentials": {
                    "token": "",
                    "username": "",
                    "organization": ""
                },
                "repositories": {
                    "primary_repo": "",
                    "backup_repos": []
                },
                "automation": {
                    "auto_commit": True,
                    "auto_push": False,
                    "create_pr": True,
                    "branch_naming": "feature/autonomous-{timestamp}"
                },
                "commit_settings": {
                    "commit_message_template": "{task_type}: {description}\n\n🤖 Generated with MultiLLM Autonomous System",
                    "sign_commits": False,
                    "gpg_key_id": ""
                }
            }
            
            # Default error handling
            self.configurations[ConfigCategory.ERROR_HANDLING] = {
                "retry_policies": {
                    "max_retries": 3,
                    "backoff_factor": 2,
                    "max_backoff": 300
                },
                "fallback_strategies": {
                    "use_backup_llm": True,
                    "use_cached_response": True,
                    "graceful_degradation": True
                },
                "logging": {
                    "log_level": "INFO",
                    "log_file": "autonomous_system.log",
                    "max_log_size": "10MB",
                    "backup_count": 5
                }
            }
            
            # Default system settings
            self.configurations[ConfigCategory.SYSTEM_SETTINGS] = {
                "performance": {
                    "max_concurrent_tasks": 5,
                    "task_timeout": 300,
                    "memory_limit": "2GB",
                    "cache_size": 1000
                },
                "security": {
                    "encrypt_logs": False,
                    "mask_api_keys": True,
                    "secure_deletion": True
                },
                "features": {
                    "hot_reload": True,
                    "auto_backup": True,
                    "metrics_collection": True,
                    "debug_mode": False
                }
            }
    
    def load_configuration(self, category: ConfigCategory, file_path: str = None) -> Dict[str, Any]:
        """
        Load configuration from file or return cached version.
        
        Args:
            category: Configuration category
            file_path: Optional specific file path
        
        Returns:
            Configuration dictionary
        """
        with self.config_lock:
            if file_path:
                config_file = Path(file_path)
            else:
                config_file = self.config_dir / f"{category.value}.json"
            
            try:
                if config_file.exists():
                    # Check if file has been modified for hot reloading
                    file_stat = config_file.stat()
                    file_key = str(config_file)
                    
                    if (file_key not in self.file_watchers or 
                        self.file_watchers[file_key] != file_stat.st_mtime):
                        
                        self.logger.info(f"Loading configuration from {config_file}")
                        
                        with open(config_file, 'r', encoding='utf-8') as f:
                            if config_file.suffix.lower() == '.yaml' or config_file.suffix.lower() == '.yml':
                                config_data = yaml.safe_load(f)
                            else:
                                config_data = json.load(f)
                        
                        # Decrypt sensitive fields
                        config_data = self._decrypt_sensitive_fields(config_data)
                        
                        # Validate configuration
                        if self._validate_configuration(category, config_data):
                            self.configurations[category] = config_data
                            self.file_watchers[file_key] = file_stat.st_mtime
                        else:
                            self.logger.error(f"Invalid configuration in {config_file}")
                            return self.configurations.get(category, {})
                
                return self.configurations.get(category, {})
                
            except Exception as e:
                self.logger.error(f"Error loading configuration {category.value}: {e}")
                return self.configurations.get(category, {})
    
    def save_configuration(self, category: ConfigCategory, config_data: Dict[str, Any], 
                          file_path: str = None, backup: bool = True) -> bool:
        """
        Save configuration to file with optional backup.
        
        Args:
            category: Configuration category
            config_data: Configuration data to save
            file_path: Optional specific file path
            backup: Whether to create backup before saving
        
        Returns:
            Success status
        """
        with self.config_lock:
            try:
                if file_path:
                    config_file = Path(file_path)
                else:
                    config_file = self.config_dir / f"{category.value}.json"
                
                # Create backup if requested
                if backup and config_file.exists():
                    self._create_backup(config_file)
                
                # Validate configuration before saving
                if not self._validate_configuration(category, config_data):
                    self.logger.error(f"Invalid configuration data for {category.value}")
                    return False
                
                # Encrypt sensitive fields
                encrypted_data = self._encrypt_sensitive_fields(config_data.copy())
                
                # Save configuration
                config_file.parent.mkdir(parents=True, exist_ok=True)
                
                with open(config_file, 'w', encoding='utf-8') as f:
                    if config_file.suffix.lower() == '.yaml' or config_file.suffix.lower() == '.yml':
                        yaml.dump(encrypted_data, f, default_flow_style=False, indent=2)
                    else:
                        json.dump(encrypted_data, f, indent=2, ensure_ascii=False)
                
                # Update in-memory configuration
                self.configurations[category] = config_data
                
                # Update file watcher
                file_stat = config_file.stat()
                self.file_watchers[str(config_file)] = file_stat.st_mtime
                
                self.logger.info(f"Configuration saved: {category.value}")
                return True
                
            except Exception as e:
                self.logger.error(f"Error saving configuration {category.value}: {e}")
                return False
    
    def get_llm_config(self, llm_name: str) -> Optional[LLMConfig]:
        """Get LLM configuration by name"""
        llm_settings = self.configurations.get(ConfigCategory.LLM_SETTINGS, {})
        llm_data = llm_settings.get(llm_name)
        
        if llm_data:
            return LLMConfig(**llm_data)
        return None
    
    def set_llm_config(self, llm_name: str, config: LLMConfig) -> bool:
        """Set LLM configuration"""
        with self.config_lock:
            if ConfigCategory.LLM_SETTINGS not in self.configurations:
                self.configurations[ConfigCategory.LLM_SETTINGS] = {}
            
            self.configurations[ConfigCategory.LLM_SETTINGS][llm_name] = asdict(config)
            return self.save_configuration(ConfigCategory.LLM_SETTINGS, 
                                         self.configurations[ConfigCategory.LLM_SETTINGS])
    
    def get_task_routing_config(self, task_type: str) -> Optional[TaskRoutingConfig]:
        """Get task routing configuration by task type"""
        routing_settings = self.configurations.get(ConfigCategory.TASK_ROUTING, {})
        routing_data = routing_settings.get(task_type)
        
        if routing_data:
            return TaskRoutingConfig(task_type=task_type, **routing_data)
        return None
    
    def set_task_routing_config(self, task_type: str, config: TaskRoutingConfig) -> bool:
        """Set task routing configuration"""
        with self.config_lock:
            if ConfigCategory.TASK_ROUTING not in self.configurations:
                self.configurations[ConfigCategory.TASK_ROUTING] = {}
            
            config_dict = asdict(config)
            config_dict.pop('task_type', None)  # Remove task_type from data
            self.configurations[ConfigCategory.TASK_ROUTING][task_type] = config_dict
            return self.save_configuration(ConfigCategory.TASK_ROUTING, 
                                         self.configurations[ConfigCategory.TASK_ROUTING])
    
    def get_monitoring_config(self) -> MonitoringConfig:
        """Get monitoring configuration"""
        monitoring_settings = self.configurations.get(ConfigCategory.MONITORING, {})
        thresholds = monitoring_settings.get('thresholds', {})
        intervals = monitoring_settings.get('intervals', {})
        alerts = monitoring_settings.get('alerts', {})
        
        return MonitoringConfig(
            cpu_threshold=thresholds.get('cpu_threshold', 80.0),
            memory_threshold=thresholds.get('memory_threshold', 85.0),
            disk_threshold=thresholds.get('disk_threshold', 90.0),
            response_time_threshold=thresholds.get('response_time_threshold', 30.0),
            error_rate_threshold=thresholds.get('error_rate_threshold', 5.0),
            health_check_interval=intervals.get('health_check_interval', 60),
            alert_email=alerts.get('alert_email')
        )
    
    def update_environment_variables(self) -> bool:
        """Update environment variables from configuration"""
        try:
            # Update LLM API keys
            llm_settings = self.configurations.get(ConfigCategory.LLM_SETTINGS, {})
            for llm_name, config in llm_settings.items():
                if config.get('api_key'):
                    env_var_name = f"{llm_name.upper()}_API_KEY"
                    os.environ[env_var_name] = config['api_key']
            
            # Update GitHub token
            github_settings = self.configurations.get(ConfigCategory.GITHUB_INTEGRATION, {})
            github_token = github_settings.get('credentials', {}).get('token')
            if github_token:
                os.environ['GITHUB_TOKEN'] = github_token
            
            return True
            
        except Exception as e:
            self.logger.error(f"Error updating environment variables: {e}")
            return False
    
    def _encrypt_sensitive_fields(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Encrypt sensitive fields in configuration data"""
        sensitive_fields = ['api_key', 'token', 'password', 'secret', 'key']
        
        def encrypt_recursive(obj):
            if isinstance(obj, dict):
                result = {}
                for key, value in obj.items():
                    if any(field in key.lower() for field in sensitive_fields) and isinstance(value, str) and value:
                        # Encrypt the value
                        encrypted_value = self.cipher_suite.encrypt(value.encode()).decode()
                        result[key] = f"encrypted:{encrypted_value}"
                    else:
                        result[key] = encrypt_recursive(value)
                return result
            elif isinstance(obj, list):
                return [encrypt_recursive(item) for item in obj]
            else:
                return obj
        
        return encrypt_recursive(data)
    
    def _decrypt_sensitive_fields(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Decrypt sensitive fields in configuration data"""
        def decrypt_recursive(obj):
            if isinstance(obj, dict):
                result = {}
                for key, value in obj.items():
                    if isinstance(value, str) and value.startswith("encrypted:"):
                        try:
                            encrypted_value = value[10:]  # Remove "encrypted:" prefix
                            decrypted_value = self.cipher_suite.decrypt(encrypted_value.encode()).decode()
                            result[key] = decrypted_value
                        except Exception as e:
                            self.logger.error(f"Error decrypting field {key}: {e}")
                            result[key] = ""
                    else:
                        result[key] = decrypt_recursive(value)
                return result
            elif isinstance(obj, list):
                return [decrypt_recursive(item) for item in obj]
            else:
                return obj
        
        return decrypt_recursive(data)
    
    def _validate_configuration(self, category: ConfigCategory, config_data: Dict[str, Any]) -> bool:
        """Validate configuration data structure"""
        try:
            if category == ConfigCategory.LLM_SETTINGS:
                for llm_name, llm_config in config_data.items():
                    required_fields = ['endpoint', 'model']
                    if not all(field in llm_config for field in required_fields):
                        return False
            
            elif category == ConfigCategory.TASK_ROUTING:
                for task_type, routing_config in config_data.items():
                    required_fields = ['primary_llm', 'fallback_llms']
                    if not all(field in routing_config for field in required_fields):
                        return False
            
            elif category == ConfigCategory.MONITORING:
                required_sections = ['thresholds', 'intervals']
                if not all(section in config_data for section in required_sections):
                    return False
            
            return True
            
        except Exception as e:
            self.logger.error(f"Configuration validation error: {e}")
            return False
    
    def _create_backup(self, config_file: Path) -> None:
        """Create backup of configuration file"""
        try:
            backup_dir = self.config_dir / "backups"
            backup_dir.mkdir(exist_ok=True)
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_file = backup_dir / f"{config_file.stem}_{timestamp}{config_file.suffix}"
            
            import shutil
            shutil.copy2(config_file, backup_file)
            
            # Keep only last 10 backups
            backups = sorted(backup_dir.glob(f"{config_file.stem}_*{config_file.suffix}"))
            if len(backups) > 10:
                for old_backup in backups[:-10]:
                    old_backup.unlink()
                    
        except Exception as e:
            self.logger.error(f"Error creating backup: {e}")
    
    def _load_all_configurations(self) -> None:
        """Load all configuration categories"""
        for category in ConfigCategory:
            self.load_configuration(category)
    
    def reload_configurations(self) -> bool:
        """Reload all configurations from files"""
        try:
            self.file_watchers.clear()
            self._load_all_configurations()
            self.update_environment_variables()
            self.logger.info("All configurations reloaded successfully")
            return True
        except Exception as e:
            self.logger.error(f"Error reloading configurations: {e}")
            return False
    
    def export_configurations(self, export_path: str, include_sensitive: bool = False) -> bool:
        """Export all configurations to a file"""
        try:
            export_data = {}
            for category, config_data in self.configurations.items():
                if include_sensitive:
                    export_data[category.value] = config_data
                else:
                    # Remove sensitive fields for export
                    cleaned_data = self._remove_sensitive_fields(config_data)
                    export_data[category.value] = cleaned_data
            
            with open(export_path, 'w', encoding='utf-8') as f:
                json.dump(export_data, f, indent=2, ensure_ascii=False)
            
            self.logger.info(f"Configurations exported to {export_path}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error exporting configurations: {e}")
            return False
    
    def _remove_sensitive_fields(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Remove sensitive fields from configuration data"""
        sensitive_fields = ['api_key', 'token', 'password', 'secret', 'key']
        
        def clean_recursive(obj):
            if isinstance(obj, dict):
                result = {}
                for key, value in obj.items():
                    if any(field in key.lower() for field in sensitive_fields):
                        result[key] = "***REDACTED***" if value else ""
                    else:
                        result[key] = clean_recursive(value)
                return result
            elif isinstance(obj, list):
                return [clean_recursive(item) for item in obj]
            else:
                return obj
        
        return clean_recursive(data)
    
    def get_config_summary(self) -> Dict[str, Any]:
        """Get summary of current configuration status"""
        summary = {
            "timestamp": datetime.now().isoformat(),
            "categories": {},
            "total_configs": 0,
            "encrypted_fields": 0,
            "validation_status": {}
        }
        
        for category, config_data in self.configurations.items():
            category_info = {
                "item_count": len(config_data) if isinstance(config_data, dict) else 1,
                "last_modified": "unknown",
                "file_exists": False
            }
            
            config_file = self.config_dir / f"{category.value}.json"
            if config_file.exists():
                category_info["file_exists"] = True
                category_info["last_modified"] = datetime.fromtimestamp(
                    config_file.stat().st_mtime
                ).isoformat()
            
            summary["categories"][category.value] = category_info
            summary["total_configs"] += category_info["item_count"]
            
            # Validate configuration
            summary["validation_status"][category.value] = self._validate_configuration(category, config_data)
        
        return summary