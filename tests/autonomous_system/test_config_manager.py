"""
Tests for ConfigManager
設定管理システムの包括的テストスイート
"""

import pytest
import os
import json
import yaml
import tempfile
import shutil
from unittest.mock import Mock, patch, mock_open
from pathlib import Path
from datetime import datetime

from autonomous_system.config.config_manager import (
    ConfigManager,
    ConfigCategory,
    LLMConfig,
    TaskRoutingConfig,
    MonitoringConfig
)


class TestConfigManager:
    """ConfigManager unit tests"""
    
    @pytest.mark.unit
    def test_initialization(self, temp_dir):
        """Test config manager initialization"""
        config_manager = ConfigManager(config_dir=temp_dir)
        
        assert config_manager.config_dir == Path(temp_dir)
        assert config_manager.encryption_key is not None
        assert len(config_manager.configurations) > 0
        assert ConfigCategory.LLM_SETTINGS in config_manager.configurations
        assert ConfigCategory.TASK_ROUTING in config_manager.configurations
        assert config_manager.config_lock is not None
    
    @pytest.mark.unit
    def test_initialization_with_encryption_key(self, temp_dir):
        """Test initialization with custom encryption key"""
        from cryptography.fernet import Fernet
        custom_key = Fernet.generate_key().decode()
        
        config_manager = ConfigManager(config_dir=temp_dir, encryption_key=custom_key)
        
        assert config_manager.encryption_key == custom_key
    
    @pytest.mark.unit
    def test_default_configurations_initialized(self, temp_dir):
        """Test that default configurations are properly initialized"""
        config_manager = ConfigManager(config_dir=temp_dir)
        
        # Check LLM settings
        llm_settings = config_manager.configurations[ConfigCategory.LLM_SETTINGS]
        assert 'claude' in llm_settings
        assert 'openai' in llm_settings
        assert 'gemini' in llm_settings
        
        # Check required fields in LLM config
        claude_config = llm_settings['claude']
        required_fields = ['endpoint', 'model', 'max_tokens', 'temperature']
        for field in required_fields:
            assert field in claude_config
        
        # Check task routing
        task_routing = config_manager.configurations[ConfigCategory.TASK_ROUTING]
        assert 'code_generation' in task_routing
        assert 'code_review' in task_routing
        
        # Check monitoring config
        monitoring = config_manager.configurations[ConfigCategory.MONITORING]
        assert 'thresholds' in monitoring
        assert 'intervals' in monitoring
        assert 'alerts' in monitoring
    
    @pytest.mark.unit
    def test_save_and_load_configuration(self, temp_dir):
        """Test saving and loading configuration"""
        config_manager = ConfigManager(config_dir=temp_dir)
        
        # Modify LLM configuration
        test_config = {
            "claude": {
                "api_key": "test_key_123",
                "endpoint": "https://test.api.com",
                "model": "claude-test",
                "max_tokens": 2000,
                "temperature": 0.8
            }
        }
        
        # Save configuration
        success = config_manager.save_configuration(ConfigCategory.LLM_SETTINGS, test_config)
        assert success
        
        # Verify file was created
        config_file = Path(temp_dir) / "llm_settings.json"
        assert config_file.exists()
        
        # Create new config manager and load
        new_config_manager = ConfigManager(config_dir=temp_dir, encryption_key=config_manager.encryption_key)
        loaded_config = new_config_manager.load_configuration(ConfigCategory.LLM_SETTINGS)
        
        assert loaded_config['claude']['model'] == 'claude-test'
        assert loaded_config['claude']['max_tokens'] == 2000
        assert loaded_config['claude']['temperature'] == 0.8
    
    @pytest.mark.unit
    def test_encryption_and_decryption(self, temp_dir):
        """Test encryption and decryption of sensitive fields"""
        config_manager = ConfigManager(config_dir=temp_dir)
        
        # Test data with sensitive fields
        test_config = {
            "claude": {
                "api_key": "secret_api_key_123",
                "endpoint": "https://api.example.com",
                "model": "claude-test"
            },
            "github": {
                "token": "github_token_456",
                "username": "test_user"
            }
        }
        
        # Save configuration (should encrypt sensitive fields)
        success = config_manager.save_configuration(ConfigCategory.LLM_SETTINGS, test_config)
        assert success
        
        # Read raw file content to verify encryption
        config_file = Path(temp_dir) / "llm_settings.json"
        with open(config_file, 'r') as f:
            raw_content = json.load(f)
        
        # API key should be encrypted
        assert raw_content['claude']['api_key'].startswith('encrypted:')
        assert raw_content['github']['token'].startswith('encrypted:')
        
        # Non-sensitive fields should not be encrypted
        assert raw_content['claude']['endpoint'] == "https://api.example.com"
        assert raw_content['claude']['model'] == "claude-test"
        
        # Load configuration (should decrypt sensitive fields)
        loaded_config = config_manager.load_configuration(ConfigCategory.LLM_SETTINGS)
        
        assert loaded_config['claude']['api_key'] == "secret_api_key_123"
        assert loaded_config['github']['token'] == "github_token_456"
    
    @pytest.mark.unit
    def test_llm_config_management(self, temp_dir):
        """Test LLM configuration management"""
        config_manager = ConfigManager(config_dir=temp_dir)
        
        # Create LLM config
        llm_config = LLMConfig(
            api_key="test_key",
            endpoint="https://test.api.com",
            model="test-model",
            max_tokens=3000,
            temperature=0.9,
            rate_limit_rpm=100,
            timeout=45,
            retry_attempts=5
        )
        
        # Set LLM config
        success = config_manager.set_llm_config("test_llm", llm_config)
        assert success
        
        # Get LLM config
        retrieved_config = config_manager.get_llm_config("test_llm")
        assert retrieved_config is not None
        assert retrieved_config.api_key == "test_key"
        assert retrieved_config.model == "test-model"
        assert retrieved_config.max_tokens == 3000
        assert retrieved_config.temperature == 0.9
        
        # Test non-existent LLM
        non_existent = config_manager.get_llm_config("non_existent")
        assert non_existent is None
    
    @pytest.mark.unit
    def test_task_routing_config_management(self, temp_dir):
        """Test task routing configuration management"""
        config_manager = ConfigManager(config_dir=temp_dir)
        
        # Create task routing config
        routing_config = TaskRoutingConfig(
            task_type="test_task",
            primary_llm="claude",
            fallback_llms=["openai", "gemini"],
            confidence_threshold=0.85,
            complexity_score=3,
            priority=1
        )
        
        # Set task routing config
        success = config_manager.set_task_routing_config("test_task", routing_config)
        assert success
        
        # Get task routing config
        retrieved_config = config_manager.get_task_routing_config("test_task")
        assert retrieved_config is not None
        assert retrieved_config.task_type == "test_task"
        assert retrieved_config.primary_llm == "claude"
        assert retrieved_config.fallback_llms == ["openai", "gemini"]
        assert retrieved_config.confidence_threshold == 0.85
        
        # Test non-existent task
        non_existent = config_manager.get_task_routing_config("non_existent")
        assert non_existent is None
    
    @pytest.mark.unit
    def test_monitoring_config_management(self, temp_dir):
        """Test monitoring configuration management"""
        config_manager = ConfigManager(config_dir=temp_dir)
        
        # Get default monitoring config
        monitoring_config = config_manager.get_monitoring_config()
        assert isinstance(monitoring_config, MonitoringConfig)
        assert monitoring_config.cpu_threshold == 80.0
        assert monitoring_config.memory_threshold == 85.0
        assert monitoring_config.health_check_interval == 60
        
        # Modify monitoring configuration
        custom_monitoring = {
            "thresholds": {
                "cpu_threshold": 75.0,
                "memory_threshold": 80.0,
                "disk_threshold": 85.0,
                "response_time_threshold": 25.0,
                "error_rate_threshold": 3.0
            },
            "intervals": {
                "health_check_interval": 30,
                "metrics_collection_interval": 15
            },
            "alerts": {
                "email_enabled": True,
                "alert_email": "admin@example.com"
            }
        }
        
        config_manager.configurations[ConfigCategory.MONITORING] = custom_monitoring
        
        # Get updated monitoring config
        updated_config = config_manager.get_monitoring_config()
        assert updated_config.cpu_threshold == 75.0
        assert updated_config.memory_threshold == 80.0
        assert updated_config.health_check_interval == 30
        assert updated_config.alert_email == "admin@example.com"
    
    @pytest.mark.unit
    def test_environment_variables_update(self, temp_dir):
        """Test updating environment variables from configuration"""
        config_manager = ConfigManager(config_dir=temp_dir)
        
        # Set LLM configurations with API keys
        claude_config = LLMConfig(
            api_key="claude_test_key",
            endpoint="https://api.anthropic.com",
            model="claude-3-sonnet"
        )
        openai_config = LLMConfig(
            api_key="openai_test_key",
            endpoint="https://api.openai.com",
            model="gpt-4"
        )
        
        config_manager.set_llm_config("claude", claude_config)
        config_manager.set_llm_config("openai", openai_config)
        
        # Set GitHub token
        github_config = {
            "credentials": {
                "token": "github_test_token",
                "username": "test_user"
            }
        }
        config_manager.configurations[ConfigCategory.GITHUB_INTEGRATION] = github_config
        
        # Update environment variables
        success = config_manager.update_environment_variables()
        assert success
        
        # Verify environment variables were set
        assert os.environ.get("CLAUDE_API_KEY") == "claude_test_key"
        assert os.environ.get("OPENAI_API_KEY") == "openai_test_key"
        assert os.environ.get("GITHUB_TOKEN") == "github_test_token"
    
    @pytest.mark.unit
    def test_configuration_validation(self, temp_dir):
        """Test configuration validation"""
        config_manager = ConfigManager(config_dir=temp_dir)
        
        # Valid LLM configuration
        valid_llm_config = {
            "claude": {
                "endpoint": "https://api.anthropic.com",
                "model": "claude-3-sonnet",
                "api_key": "test_key"
            }
        }
        assert config_manager._validate_configuration(ConfigCategory.LLM_SETTINGS, valid_llm_config)
        
        # Invalid LLM configuration (missing required fields)
        invalid_llm_config = {
            "claude": {
                "api_key": "test_key"
                # Missing endpoint and model
            }
        }
        assert not config_manager._validate_configuration(ConfigCategory.LLM_SETTINGS, invalid_llm_config)
        
        # Valid task routing configuration
        valid_routing_config = {
            "test_task": {
                "primary_llm": "claude",
                "fallback_llms": ["openai"]
            }
        }
        assert config_manager._validate_configuration(ConfigCategory.TASK_ROUTING, valid_routing_config)
        
        # Invalid task routing configuration
        invalid_routing_config = {
            "test_task": {
                "primary_llm": "claude"
                # Missing fallback_llms
            }
        }
        assert not config_manager._validate_configuration(ConfigCategory.TASK_ROUTING, invalid_routing_config)
    
    @pytest.mark.unit
    def test_configuration_backup(self, temp_dir):
        """Test configuration backup functionality"""
        config_manager = ConfigManager(config_dir=temp_dir)
        
        # Create initial configuration
        test_config = {
            "test": {
                "value": "initial"
            }
        }
        
        config_file = Path(temp_dir) / "test_config.json"
        with open(config_file, 'w') as f:
            json.dump(test_config, f)
        
        # Save configuration with backup
        updated_config = {
            "test": {
                "value": "updated"
            }
        }
        
        success = config_manager.save_configuration(
            ConfigCategory.LLM_SETTINGS, 
            updated_config, 
            file_path=str(config_file),
            backup=True
        )
        assert success
        
        # Check backup was created
        backup_dir = Path(temp_dir) / "backups"
        assert backup_dir.exists()
        
        backup_files = list(backup_dir.glob("test_config_*.json"))
        assert len(backup_files) > 0
        
        # Verify backup content
        with open(backup_files[0], 'r') as f:
            backup_content = json.load(f)
        assert backup_content["test"]["value"] == "initial"
    
    @pytest.mark.unit
    def test_yaml_configuration_support(self, temp_dir):
        """Test YAML configuration file support"""
        config_manager = ConfigManager(config_dir=temp_dir)
        
        # Create YAML configuration
        yaml_config = {
            "claude": {
                "api_key": "yaml_test_key",
                "endpoint": "https://api.anthropic.com",
                "model": "claude-3-sonnet"
            }
        }
        
        yaml_file = Path(temp_dir) / "test_config.yaml"
        with open(yaml_file, 'w') as f:
            yaml.dump(yaml_config, f)
        
        # Load YAML configuration
        loaded_config = config_manager.load_configuration(
            ConfigCategory.LLM_SETTINGS,
            file_path=str(yaml_file)
        )
        
        assert loaded_config['claude']['api_key'] == "yaml_test_key"
        assert loaded_config['claude']['model'] == "claude-3-sonnet"
    
    @pytest.mark.unit
    def test_hot_reload_functionality(self, temp_dir):
        """Test hot reload functionality"""
        config_manager = ConfigManager(config_dir=temp_dir)
        
        # Create initial configuration
        config_file = Path(temp_dir) / "llm_settings.json"
        initial_config = {
            "claude": {
                "endpoint": "https://api.anthropic.com",
                "model": "claude-initial",
                "api_key": "initial_key"
            }
        }
        
        with open(config_file, 'w') as f:
            json.dump(initial_config, f)
        
        # Load configuration
        loaded_config = config_manager.load_configuration(ConfigCategory.LLM_SETTINGS)
        assert loaded_config['claude']['model'] == "claude-initial"
        
        # Modify file externally (simulating external change)
        import time
        time.sleep(0.1)  # Ensure different mtime
        
        updated_config = {
            "claude": {
                "endpoint": "https://api.anthropic.com",
                "model": "claude-updated",
                "api_key": "updated_key"
            }
        }
        
        with open(config_file, 'w') as f:
            json.dump(updated_config, f)
        
        # Load configuration again (should detect change and reload)
        reloaded_config = config_manager.load_configuration(ConfigCategory.LLM_SETTINGS)
        assert reloaded_config['claude']['model'] == "claude-updated"
    
    @pytest.mark.unit
    def test_export_configurations(self, temp_dir):
        """Test configuration export functionality"""
        config_manager = ConfigManager(config_dir=temp_dir)
        
        # Set some configuration data
        claude_config = LLMConfig(
            api_key="secret_key",
            endpoint="https://api.anthropic.com",
            model="claude-3-sonnet"
        )
        config_manager.set_llm_config("claude", claude_config)
        
        # Export without sensitive data
        export_file = Path(temp_dir) / "exported_config.json"
        success = config_manager.export_configurations(str(export_file), include_sensitive=False)
        assert success
        assert export_file.exists()
        
        # Verify exported content
        with open(export_file, 'r') as f:
            exported_data = json.load(f)
        
        assert 'llm_settings' in exported_data
        assert exported_data['llm_settings']['claude']['api_key'] == "***REDACTED***"
        assert exported_data['llm_settings']['claude']['model'] == "claude-3-sonnet"
        
        # Export with sensitive data
        export_file_sensitive = Path(temp_dir) / "exported_config_sensitive.json"
        success = config_manager.export_configurations(str(export_file_sensitive), include_sensitive=True)
        assert success
        
        with open(export_file_sensitive, 'r') as f:
            exported_sensitive = json.load(f)
        
        assert exported_sensitive['llm_settings']['claude']['api_key'] == "secret_key"
    
    @pytest.mark.unit
    def test_config_summary(self, temp_dir):
        """Test configuration summary generation"""
        config_manager = ConfigManager(config_dir=temp_dir)
        
        # Save some configurations to create files
        config_manager.save_configuration(ConfigCategory.LLM_SETTINGS, 
                                        config_manager.configurations[ConfigCategory.LLM_SETTINGS])
        config_manager.save_configuration(ConfigCategory.TASK_ROUTING,
                                        config_manager.configurations[ConfigCategory.TASK_ROUTING])
        
        # Get summary
        summary = config_manager.get_config_summary()
        
        assert 'timestamp' in summary
        assert 'categories' in summary
        assert 'total_configs' in summary
        assert 'validation_status' in summary
        
        # Check categories
        assert 'llm_settings' in summary['categories']
        assert 'task_routing' in summary['categories']
        
        # Check file existence
        assert summary['categories']['llm_settings']['file_exists']
        assert summary['categories']['task_routing']['file_exists']
        
        # Check validation status
        assert summary['validation_status']['llm_settings']
        assert summary['validation_status']['task_routing']
    
    @pytest.mark.unit
    def test_reload_configurations(self, temp_dir):
        """Test configuration reload functionality"""
        config_manager = ConfigManager(config_dir=temp_dir)
        
        # Modify configuration in memory
        config_manager.configurations[ConfigCategory.LLM_SETTINGS]['claude']['model'] = "modified_model"
        
        # Save to file
        config_manager.save_configuration(ConfigCategory.LLM_SETTINGS,
                                        config_manager.configurations[ConfigCategory.LLM_SETTINGS])
        
        # Clear file watchers to force reload
        config_manager.file_watchers.clear()
        
        # Reload configurations
        success = config_manager.reload_configurations()
        assert success
        
        # Verify configuration was reloaded
        reloaded_config = config_manager.configurations[ConfigCategory.LLM_SETTINGS]
        assert reloaded_config['claude']['model'] == "modified_model"


class TestDataClasses:
    """Test configuration data classes"""
    
    @pytest.mark.unit
    def test_llm_config_creation(self):
        """Test LLMConfig creation and defaults"""
        # Test with all parameters
        config = LLMConfig(
            api_key="test_key",
            endpoint="https://api.test.com",
            model="test-model",
            max_tokens=2000,
            temperature=0.8,
            rate_limit_rpm=100,
            timeout=45,
            retry_attempts=5,
            backup_model="backup-model"
        )
        
        assert config.api_key == "test_key"
        assert config.endpoint == "https://api.test.com"
        assert config.model == "test-model"
        assert config.max_tokens == 2000
        assert config.temperature == 0.8
        assert config.backup_model == "backup-model"
        
        # Test with defaults
        minimal_config = LLMConfig(
            api_key="key",
            endpoint="https://api.com",
            model="model"
        )
        
        assert minimal_config.max_tokens == 4000
        assert minimal_config.temperature == 0.7
        assert minimal_config.rate_limit_rpm == 60
        assert minimal_config.timeout == 30
        assert minimal_config.retry_attempts == 3
        assert minimal_config.backup_model is None
    
    @pytest.mark.unit
    def test_task_routing_config_creation(self):
        """Test TaskRoutingConfig creation and defaults"""
        # Test with all parameters
        config = TaskRoutingConfig(
            task_type="test_task",
            primary_llm="claude",
            fallback_llms=["openai", "gemini"],
            confidence_threshold=0.9,
            complexity_score=5,
            priority=2
        )
        
        assert config.task_type == "test_task"
        assert config.primary_llm == "claude"
        assert config.fallback_llms == ["openai", "gemini"]
        assert config.confidence_threshold == 0.9
        assert config.complexity_score == 5
        assert config.priority == 2
        
        # Test with defaults
        minimal_config = TaskRoutingConfig(
            task_type="minimal",
            primary_llm="claude",
            fallback_llms=["openai"]
        )
        
        assert minimal_config.confidence_threshold == 0.8
        assert minimal_config.complexity_score == 1
        assert minimal_config.priority == 1
    
    @pytest.mark.unit
    def test_monitoring_config_creation(self):
        """Test MonitoringConfig creation and defaults"""
        # Test with all parameters
        config = MonitoringConfig(
            cpu_threshold=75.0,
            memory_threshold=80.0,
            disk_threshold=85.0,
            response_time_threshold=25.0,
            error_rate_threshold=3.0,
            health_check_interval=30,
            alert_email="admin@example.com"
        )
        
        assert config.cpu_threshold == 75.0
        assert config.memory_threshold == 80.0
        assert config.disk_threshold == 85.0
        assert config.response_time_threshold == 25.0
        assert config.error_rate_threshold == 3.0
        assert config.health_check_interval == 30
        assert config.alert_email == "admin@example.com"
        
        # Test with defaults
        default_config = MonitoringConfig()
        
        assert default_config.cpu_threshold == 80.0
        assert default_config.memory_threshold == 85.0
        assert default_config.disk_threshold == 90.0
        assert default_config.response_time_threshold == 30.0
        assert default_config.error_rate_threshold == 5.0
        assert default_config.health_check_interval == 60
        assert default_config.alert_email is None


class TestErrorHandling:
    """Test error handling scenarios"""
    
    @pytest.mark.unit
    def test_load_invalid_json(self, temp_dir):
        """Test loading invalid JSON configuration"""
        config_manager = ConfigManager(config_dir=temp_dir)
        
        # Create invalid JSON file
        invalid_json_file = Path(temp_dir) / "invalid.json"
        with open(invalid_json_file, 'w') as f:
            f.write('{"invalid": json content}')
        
        # Should handle gracefully and return default/cached config
        config = config_manager.load_configuration(
            ConfigCategory.LLM_SETTINGS,
            file_path=str(invalid_json_file)
        )
        
        # Should return existing configuration or empty dict
        assert isinstance(config, dict)
    
    @pytest.mark.unit
    def test_load_nonexistent_file(self, temp_dir):
        """Test loading non-existent configuration file"""
        config_manager = ConfigManager(config_dir=temp_dir)
        
        nonexistent_file = Path(temp_dir) / "nonexistent.json"
        
        # Should handle gracefully
        config = config_manager.load_configuration(
            ConfigCategory.LLM_SETTINGS,
            file_path=str(nonexistent_file)
        )
        
        # Should return default configuration
        assert isinstance(config, dict)
    
    @pytest.mark.unit
    def test_save_to_readonly_directory(self, temp_dir):
        """Test saving to read-only directory"""
        config_manager = ConfigManager(config_dir=temp_dir)
        
        # Create read-only directory
        readonly_dir = Path(temp_dir) / "readonly"
        readonly_dir.mkdir()
        readonly_dir.chmod(0o444)  # Read-only
        
        try:
            # Should handle permission error gracefully
            success = config_manager.save_configuration(
                ConfigCategory.LLM_SETTINGS,
                {"test": "config"},
                file_path=str(readonly_dir / "config.json")
            )
            
            assert not success
        finally:
            # Restore permissions for cleanup
            readonly_dir.chmod(0o755)
    
    @pytest.mark.unit
    def test_invalid_encryption_key(self, temp_dir):
        """Test handling of invalid encryption key"""
        # Test with invalid key format
        with pytest.raises(Exception):
            ConfigManager(config_dir=temp_dir, encryption_key="invalid_key_format")
    
    @pytest.mark.unit
    def test_decryption_error_handling(self, temp_dir):
        """Test handling of decryption errors"""
        config_manager = ConfigManager(config_dir=temp_dir)
        
        # Create configuration with invalid encrypted data
        invalid_encrypted_config = {
            "claude": {
                "api_key": "encrypted:invalid_encrypted_data",
                "model": "claude-3-sonnet"
            }
        }
        
        # Save directly to file (bypassing encryption)
        config_file = Path(temp_dir) / "test_decrypt.json"
        with open(config_file, 'w') as f:
            json.dump(invalid_encrypted_config, f)
        
        # Load configuration (should handle decryption error)
        loaded_config = config_manager.load_configuration(
            ConfigCategory.LLM_SETTINGS,
            file_path=str(config_file)
        )
        
        # Should set empty string for failed decryption
        assert loaded_config['claude']['api_key'] == ""
        assert loaded_config['claude']['model'] == "claude-3-sonnet"


class TestThreadSafety:
    """Test thread safety of configuration operations"""
    
    @pytest.mark.unit
    def test_concurrent_config_access(self, temp_dir):
        """Test concurrent configuration access"""
        import threading
        import time
        
        config_manager = ConfigManager(config_dir=temp_dir)
        results = []
        errors = []
        
        def config_worker(worker_id):
            try:
                # Each worker modifies and reads configuration
                for i in range(10):
                    llm_config = LLMConfig(
                        api_key=f"worker_{worker_id}_key_{i}",
                        endpoint="https://api.test.com",
                        model=f"model_{i}"
                    )
                    
                    config_manager.set_llm_config(f"test_llm_{worker_id}", llm_config)
                    retrieved = config_manager.get_llm_config(f"test_llm_{worker_id}")
                    
                    if retrieved and retrieved.api_key == f"worker_{worker_id}_key_{i}":
                        results.append(f"worker_{worker_id}_success_{i}")
                    
                    time.sleep(0.001)  # Small delay
            except Exception as e:
                errors.append(f"worker_{worker_id}_error: {e}")
        
        # Start multiple worker threads
        threads = []
        for i in range(5):
            thread = threading.Thread(target=config_worker, args=(i,))
            threads.append(thread)
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        # Check results
        assert len(errors) == 0, f"Errors occurred: {errors}"
        assert len(results) >= 25  # At least some operations should succeed
    
    @pytest.mark.unit
    def test_concurrent_file_operations(self, temp_dir):
        """Test concurrent file save/load operations"""
        import threading
        
        config_manager = ConfigManager(config_dir=temp_dir)
        results = []
        errors = []
        
        def file_worker(worker_id):
            try:
                config_data = {
                    f"test_setting_{worker_id}": {
                        "value": f"worker_{worker_id}",
                        "timestamp": datetime.now().isoformat()
                    }
                }
                
                # Save configuration
                success = config_manager.save_configuration(
                    ConfigCategory.LLM_SETTINGS,
                    config_data,
                    file_path=str(Path(temp_dir) / f"worker_{worker_id}.json")
                )
                
                if success:
                    # Load configuration
                    loaded = config_manager.load_configuration(
                        ConfigCategory.LLM_SETTINGS,
                        file_path=str(Path(temp_dir) / f"worker_{worker_id}.json")
                    )
                    
                    if loaded and f"test_setting_{worker_id}" in loaded:
                        results.append(f"worker_{worker_id}_success")
                
            except Exception as e:
                errors.append(f"worker_{worker_id}_error: {e}")
        
        # Start multiple worker threads
        threads = []
        for i in range(3):
            thread = threading.Thread(target=file_worker, args=(i,))
            threads.append(thread)
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        # Check results
        assert len(errors) == 0, f"Errors occurred: {errors}"
        assert len(results) == 3  # All workers should succeed


class TestConfigurationValidation:
    """Test comprehensive configuration validation"""
    
    @pytest.mark.unit
    def test_validate_llm_configuration(self, temp_dir):
        """Test LLM configuration validation"""
        config_manager = ConfigManager(config_dir=temp_dir)
        
        # Valid configuration
        valid_config = {
            "claude": {
                "endpoint": "https://api.anthropic.com",
                "model": "claude-3-sonnet",
                "api_key": "test",
                "max_tokens": 4000
            }
        }
        assert config_manager._validate_configuration(ConfigCategory.LLM_SETTINGS, valid_config)
        
        # Missing endpoint
        invalid_config1 = {
            "claude": {
                "model": "claude-3-sonnet",
                "api_key": "test"
            }
        }
        assert not config_manager._validate_configuration(ConfigCategory.LLM_SETTINGS, invalid_config1)
        
        # Missing model
        invalid_config2 = {
            "claude": {
                "endpoint": "https://api.anthropic.com",
                "api_key": "test"
            }
        }
        assert not config_manager._validate_configuration(ConfigCategory.LLM_SETTINGS, invalid_config2)
    
    @pytest.mark.unit
    def test_validate_task_routing_configuration(self, temp_dir):
        """Test task routing configuration validation"""
        config_manager = ConfigManager(config_dir=temp_dir)
        
        # Valid configuration
        valid_config = {
            "code_generation": {
                "primary_llm": "claude",
                "fallback_llms": ["openai", "gemini"]
            }
        }
        assert config_manager._validate_configuration(ConfigCategory.TASK_ROUTING, valid_config)
        
        # Missing primary_llm
        invalid_config1 = {
            "code_generation": {
                "fallback_llms": ["openai", "gemini"]
            }
        }
        assert not config_manager._validate_configuration(ConfigCategory.TASK_ROUTING, invalid_config1)
        
        # Missing fallback_llms
        invalid_config2 = {
            "code_generation": {
                "primary_llm": "claude"
            }
        }
        assert not config_manager._validate_configuration(ConfigCategory.TASK_ROUTING, invalid_config2)
    
    @pytest.mark.unit
    def test_validate_monitoring_configuration(self, temp_dir):
        """Test monitoring configuration validation"""
        config_manager = ConfigManager(config_dir=temp_dir)
        
        # Valid configuration
        valid_config = {
            "thresholds": {
                "cpu_threshold": 80.0
            },
            "intervals": {
                "health_check_interval": 60
            }
        }
        assert config_manager._validate_configuration(ConfigCategory.MONITORING, valid_config)
        
        # Missing thresholds section
        invalid_config1 = {
            "intervals": {
                "health_check_interval": 60
            }
        }
        assert not config_manager._validate_configuration(ConfigCategory.MONITORING, invalid_config1)
        
        # Missing intervals section
        invalid_config2 = {
            "thresholds": {
                "cpu_threshold": 80.0
            }
        }
        assert not config_manager._validate_configuration(ConfigCategory.MONITORING, invalid_config2)