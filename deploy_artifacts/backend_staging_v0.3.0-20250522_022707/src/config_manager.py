"""
Configuration Manager for Shopify MCP Server.

This module provides a centralized configuration management system that handles:
- Loading from environment variables
- Loading from config files (YAML, JSON, or INI)
- Hierarchical configuration (defaults, environment-specific)
- Configuration validation
- Runtime configuration updates
- Secure storage for sensitive values
- Clean API for accessing configuration
"""
import os
import json
import yaml
import configparser
import logging
from enum import Enum
from typing import Any, Dict, List, Optional, Union, Set, TypeVar, Generic, cast
from pathlib import Path
from functools import lru_cache
from pydantic import BaseModel, Field, validator, create_model
from cryptography.fernet import Fernet
import threading

# Setup logging
logger = logging.getLogger(__name__)

# Type definitions
T = TypeVar("T")
ConfigValue = Union[str, int, float, bool, List[Any], Dict[str, Any]]
ConfigDict = Dict[str, ConfigValue]


class ConfigSource(Enum):
    """Enumeration of configuration sources with priorities."""
    DEFAULT = 0  # Lowest priority
    CONFIG_FILE = 1
    ENV_VARS = 2
    RUNTIME = 3  # Highest priority


class ConfigSection(BaseModel):
    """Base model for configuration sections."""
    
    class Config:
        """Pydantic configuration."""
        extra = "allow"
        frozen = False


class EncryptedValue(BaseModel):
    """Model for encrypted configuration values."""
    value: str  # Encrypted value
    is_encrypted: bool = True


class ConfigFileFormat(Enum):
    """Supported configuration file formats."""
    JSON = "json"
    YAML = "yaml"
    INI = "ini"


class ConfigManager:
    """
    Configuration manager for Shopify MCP Server.
    
    Handles loading, validation, and access to configuration from multiple sources:
    - Environment variables
    - Configuration files (JSON, YAML, INI)
    - Default values
    - Runtime updates
    
    Features:
    - Hierarchical configuration
    - Configuration validation
    - Runtime configuration updates
    - Secure storage for sensitive values
    """
    
    def __init__(
        self,
        config_path: Optional[str] = None,
        env_prefix: str = "SHOPIFY_MCP_",
        encryption_key: Optional[str] = None,
        auto_reload: bool = False,
        reload_interval: int = 300,  # 5 minutes
        sensitive_keys: Optional[Set[str]] = None
    ):
        """
        Initialize the configuration manager.
        
        Args:
            config_path: Path to the configuration file
            env_prefix: Prefix for environment variables
            encryption_key: Key for encrypting sensitive values (base64-encoded)
            auto_reload: Whether to automatically reload configuration from files
            reload_interval: Interval (in seconds) for auto-reloading
            sensitive_keys: Set of configuration keys that should be encrypted
        """
        self._config_path = config_path
        self._env_prefix = env_prefix
        self._config_format = None
        self._auto_reload = auto_reload
        self._reload_interval = reload_interval
        self._sensitive_keys = sensitive_keys or set()
        self._lock = threading.RLock()
        
        # Initialize configuration stores by source
        self._config: Dict[ConfigSource, ConfigDict] = {
            ConfigSource.DEFAULT: {},
            ConfigSource.CONFIG_FILE: {},
            ConfigSource.ENV_VARS: {},
            ConfigSource.RUNTIME: {}
        }
        
        # Set up encryption if key is provided
        self._encryption_key = None
        if encryption_key:
            self.set_encryption_key(encryption_key)
        else:
            # Try to load from environment
            env_key = os.environ.get(f"{env_prefix}ENCRYPTION_KEY")
            if env_key:
                self.set_encryption_key(env_key)
        
        # Initialize validators
        self._validators: Dict[str, callable] = {}
        
        # Initialize auto-reload if enabled
        if auto_reload and config_path:
            self._start_auto_reload()
    
    def set_encryption_key(self, key: str) -> None:
        """
        Set the encryption key for sensitive values.
        
        Args:
            key: Base64-encoded key for Fernet encryption
        """
        try:
            self._encryption_key = Fernet(key.encode() if isinstance(key, str) else key)
        except Exception as e:
            logger.error(f"Failed to initialize encryption: {e}")
            self._encryption_key = None
    
    def _encrypt_value(self, value: str) -> str:
        """
        Encrypt a sensitive value.
        
        Args:
            value: Value to encrypt
            
        Returns:
            Encrypted value as a string
        """
        if not self._encryption_key:
            logger.warning("Encryption key not set, storing value unencrypted")
            return value
        
        try:
            encrypted = self._encryption_key.encrypt(value.encode())
            return encrypted.decode()
        except Exception as e:
            logger.error(f"Failed to encrypt value: {e}")
            return value
    
    def _decrypt_value(self, value: str) -> str:
        """
        Decrypt an encrypted value.
        
        Args:
            value: Encrypted value
            
        Returns:
            Decrypted value
        """
        if not self._encryption_key:
            logger.warning("Encryption key not set, returning value as-is")
            return value
        
        try:
            decrypted = self._encryption_key.decrypt(value.encode())
            return decrypted.decode()
        except Exception as e:
            logger.error(f"Failed to decrypt value: {e}")
            return value
    
    def _detect_config_format(self, config_path: str) -> ConfigFileFormat:
        """
        Detect the format of a configuration file based on its extension.
        
        Args:
            config_path: Path to the configuration file
            
        Returns:
            ConfigFileFormat: The detected file format
            
        Raises:
            ValueError: If the file format is not supported
        """
        ext = Path(config_path).suffix.lower()
        if ext in ('.json',):
            return ConfigFileFormat.JSON
        elif ext in ('.yaml', '.yml'):
            return ConfigFileFormat.YAML
        elif ext in ('.ini', '.cfg', '.conf'):
            return ConfigFileFormat.INI
        else:
            raise ValueError(f"Unsupported configuration file format: {ext}")
    
    def load_from_file(self, config_path: Optional[str] = None) -> None:
        """
        Load configuration from a file.
        
        Args:
            config_path: Path to the configuration file (if None, uses the one provided at init)
            
        Raises:
            FileNotFoundError: If the configuration file does not exist
            ValueError: If the configuration file format is not supported
        """
        path = config_path or self._config_path
        if not path:
            logger.warning("No configuration file path provided")
            return
        
        if not os.path.exists(path):
            raise FileNotFoundError(f"Configuration file not found: {path}")
        
        format_type = self._detect_config_format(path)
        self._config_format = format_type
        
        try:
            with open(path, 'r') as f:
                if format_type == ConfigFileFormat.JSON:
                    config = json.load(f)
                elif format_type == ConfigFileFormat.YAML:
                    config = yaml.safe_load(f)
                elif format_type == ConfigFileFormat.INI:
                    parser = configparser.ConfigParser()
                    parser.read(path)
                    # Convert ConfigParser object to dict
                    config = {section: dict(parser[section]) for section in parser.sections()}
                else:
                    raise ValueError(f"Unsupported configuration format: {format_type}")
                
                with self._lock:
                    self._config[ConfigSource.CONFIG_FILE] = config
                
                logger.info(f"Loaded configuration from {path}")
        except Exception as e:
            logger.error(f"Failed to load configuration from {path}: {e}")
            raise
    
    def load_from_env(self) -> None:
        """
        Load configuration from environment variables.
        
        Environment variables should be in the format:
        {env_prefix}{SECTION}__{KEY}
        
        Example: SHOPIFY_MCP_DATABASE__HOST=localhost
        """
        prefix = self._env_prefix
        env_config: Dict[str, Dict[str, Any]] = {}
        
        # Process environment variables
        for key, value in os.environ.items():
            if key.startswith(prefix):
                # Remove prefix
                config_key = key[len(prefix):]
                
                # Handle section and key
                if '__' in config_key:
                    section, param = config_key.split('__', 1)
                    section = section.lower()
                    
                    if section not in env_config:
                        env_config[section] = {}
                    
                    # Convert value to appropriate type
                    typed_value = self._convert_env_value(value)
                    env_config[section][param.lower()] = typed_value
                else:
                    # Top-level keys
                    section = 'default'
                    if section not in env_config:
                        env_config[section] = {}
                    
                    # Convert value to appropriate type
                    typed_value = self._convert_env_value(value)
                    env_config[section][config_key.lower()] = typed_value
        
        with self._lock:
            self._config[ConfigSource.ENV_VARS] = env_config
        
        logger.info(f"Loaded {len(env_config)} configuration sections from environment variables")
    
    def _convert_env_value(self, value: str) -> Any:
        """
        Convert environment variable string value to appropriate type.
        
        Args:
            value: String value from environment variable
            
        Returns:
            Converted value with appropriate type
        """
        # Check for boolean values
        if value.lower() in ('true', 'yes', '1', 'on'):
            return True
        elif value.lower() in ('false', 'no', '0', 'off'):
            return False
        
        # Check for integer
        try:
            return int(value)
        except ValueError:
            pass
        
        # Check for float
        try:
            return float(value)
        except ValueError:
            pass
        
        # Check for JSON
        if (value.startswith('{') and value.endswith('}')) or \
           (value.startswith('[') and value.endswith(']')):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                pass
        
        # Default to string
        return value
    
    def load_defaults(self, defaults: Dict[str, Any]) -> None:
        """
        Load default configuration values.
        
        Args:
            defaults: Dictionary of default configuration values
        """
        with self._lock:
            self._config[ConfigSource.DEFAULT] = defaults
        
        logger.info("Loaded default configuration values")
    
    def refresh(self) -> None:
        """Reload configuration from all sources."""
        try:
            if self._config_path:
                self.load_from_file()
            self.load_from_env()
            logger.info("Configuration refreshed")
        except Exception as e:
            logger.error(f"Failed to refresh configuration: {e}")
    
    def _start_auto_reload(self) -> None:
        """Start a timer for automatic configuration reload."""
        if not self._auto_reload or not self._config_path:
            return
        
        def reload_timer():
            self.refresh()
            threading.Timer(self._reload_interval, reload_timer).start()
        
        reload_timer()
        logger.info(f"Auto-reload enabled with interval of {self._reload_interval} seconds")
    
    def register_validator(self, key: str, validator_func: callable) -> None:
        """
        Register a validation function for a configuration key.
        
        Args:
            key: Configuration key to validate
            validator_func: Function that validates the value and returns it or raises an exception
        """
        self._validators[key] = validator_func
    
    def _validate_value(self, key: str, value: Any) -> Any:
        """
        Validate a configuration value using registered validators.
        
        Args:
            key: Configuration key
            value: Value to validate
            
        Returns:
            Validated value
            
        Raises:
            ValueError: If validation fails
        """
        if key in self._validators:
            try:
                return self._validators[key](value)
            except Exception as e:
                raise ValueError(f"Validation failed for {key}: {e}")
        return value
    
    def _get_config_value(self, section: str, key: str, default: Any = None) -> Any:
        """
        Get a configuration value with priority handling.
        
        Args:
            section: Configuration section
            key: Configuration key
            default: Default value if not found
            
        Returns:
            Configuration value
        """
        # Check sources in priority order (highest to lowest)
        for source in sorted(ConfigSource, key=lambda s: s.value, reverse=True):
            config_dict = self._config[source]
            
            # Check if section exists in this source
            if section in config_dict:
                # Check if key exists in this section
                if key in config_dict[section]:
                    value = config_dict[section][key]
                    
                    # Handle encrypted values
                    if isinstance(value, dict) and value.get('is_encrypted', False):
                        decrypted = self._decrypt_value(value['value'])
                        return decrypted
                    
                    return value
        
        return default
    
    def get(self, section: str, key: str, default: Any = None) -> Any:
        """
        Get a configuration value.
        
        Args:
            section: Configuration section
            key: Configuration key
            default: Default value if not found
            
        Returns:
            Configuration value
        """
        with self._lock:
            value = self._get_config_value(section.lower(), key.lower(), default)
        
        # Validate value
        return self._validate_value(f"{section}.{key}", value)
    
    def set(self, section: str, key: str, value: Any, source: ConfigSource = ConfigSource.RUNTIME) -> None:
        """
        Set a configuration value.
        
        Args:
            section: Configuration section
            key: Configuration key
            value: Value to set
            source: Configuration source to update
            
        Raises:
            ValueError: If validation fails
        """
        # Validate value
        validated_value = self._validate_value(f"{section}.{key}", value)
        
        # Handle sensitive values
        if f"{section}.{key}" in self._sensitive_keys:
            if isinstance(validated_value, str):
                validated_value = EncryptedValue(
                    value=self._encrypt_value(validated_value)
                ).dict()
        
        with self._lock:
            if section not in self._config[source]:
                self._config[source][section] = {}
            self._config[source][section][key] = validated_value
    
    def get_section(self, section: str) -> Dict[str, Any]:
        """
        Get all configuration values for a section.
        
        Args:
            section: Configuration section
            
        Returns:
            Dictionary of configuration values
        """
        result = {}
        section = section.lower()
        
        # Start with defaults (lowest priority)
        for source in sorted(ConfigSource, key=lambda s: s.value):
            config_dict = self._config[source]
            if section in config_dict:
                # Update result with values from this source
                for key, value in config_dict[section].items():
                    # Handle encrypted values
                    if isinstance(value, dict) and value.get('is_encrypted', False):
                        result[key] = self._decrypt_value(value['value'])
                    else:
                        result[key] = value
        
        return result
    
    def get_all(self) -> Dict[str, Dict[str, Any]]:
        """
        Get all configuration values.
        
        Returns:
            Nested dictionary of all configuration values
        """
        result = {}
        
        # Process all sections
        for source in sorted(ConfigSource, key=lambda s: s.value):
            config_dict = self._config[source]
            for section, values in config_dict.items():
                if section not in result:
                    result[section] = {}
                
                # Update result with values from this source
                for key, value in values.items():
                    # Handle encrypted values
                    if isinstance(value, dict) and value.get('is_encrypted', False):
                        result[section][key] = self._decrypt_value(value['value'])
                    else:
                        result[section][key] = value
        
        return result
    
    def save_to_file(self, config_path: Optional[str] = None, format_type: Optional[ConfigFileFormat] = None) -> None:
        """
        Save current configuration to a file.
        
        Args:
            config_path: Path to save the configuration to (if None, uses the one provided at init)
            format_type: Format to save in (if None, uses the one detected from the file extension)
            
        Raises:
            ValueError: If the configuration file format is not supported
        """
        path = config_path or self._config_path
        if not path:
            raise ValueError("No configuration file path provided")
        
        if not format_type:
            format_type = self._detect_config_format(path)
        
        # Get current configuration (excluding runtime values)
        config = {}
        for source in [ConfigSource.DEFAULT, ConfigSource.CONFIG_FILE, ConfigSource.ENV_VARS]:
            for section, values in self._config[source].items():
                if section not in config:
                    config[section] = {}
                config[section].update(values)
        
        try:
            with open(path, 'w') as f:
                if format_type == ConfigFileFormat.JSON:
                    json.dump(config, f, indent=2)
                elif format_type == ConfigFileFormat.YAML:
                    yaml.dump(config, f, default_flow_style=False)
                elif format_type == ConfigFileFormat.INI:
                    parser = configparser.ConfigParser()
                    for section, values in config.items():
                        parser[section] = {k: str(v) for k, v in values.items()}
                    parser.write(f)
                else:
                    raise ValueError(f"Unsupported configuration format: {format_type}")
            
            logger.info(f"Saved configuration to {path}")
        except Exception as e:
            logger.error(f"Failed to save configuration to {path}: {e}")
            raise


# Singleton instance
_config_manager: Optional[ConfigManager] = None


def init_config(
    config_path: Optional[str] = None,
    env_prefix: str = "SHOPIFY_MCP_",
    defaults: Optional[Dict[str, Any]] = None,
    encryption_key: Optional[str] = None,
    auto_reload: bool = False,
    reload_interval: int = 300,
    sensitive_keys: Optional[Set[str]] = None
) -> ConfigManager:
    """
    Initialize the global configuration manager.
    
    Args:
        config_path: Path to the configuration file
        env_prefix: Prefix for environment variables
        defaults: Default configuration values
        encryption_key: Key for encrypting sensitive values
        auto_reload: Whether to automatically reload configuration from files
        reload_interval: Interval (in seconds) for auto-reloading
        sensitive_keys: Set of configuration keys that should be encrypted
        
    Returns:
        Initialized configuration manager
    """
    global _config_manager
    
    _config_manager = ConfigManager(
        config_path=config_path,
        env_prefix=env_prefix,
        encryption_key=encryption_key,
        auto_reload=auto_reload,
        reload_interval=reload_interval,
        sensitive_keys=sensitive_keys
    )
    
    # Load configuration
    if config_path and os.path.exists(config_path):
        _config_manager.load_from_file()
    
    _config_manager.load_from_env()
    
    if defaults:
        _config_manager.load_defaults(defaults)
    
    return _config_manager


@lru_cache()
def get_config() -> ConfigManager:
    """
    Get the global configuration manager instance.
    
    Returns:
        Configuration manager instance
        
    Raises:
        RuntimeError: If configuration manager is not initialized
    """
    if _config_manager is None:
        raise RuntimeError("Configuration manager not initialized. Call init_config() first.")
    
    return _config_manager


class ConfigSectionFactory:
    """Factory for creating typed configuration section classes."""
    
    @staticmethod
    def create_section_class(
        section_name: str,
        fields: Dict[str, Any],
        validators: Optional[Dict[str, callable]] = None
    ) -> type:
        """
        Create a Pydantic model class for a configuration section.
        
        Args:
            section_name: Name of the configuration section
            fields: Dictionary of field definitions with default values and annotations
            validators: Dictionary of validator functions
            
        Returns:
            Pydantic model class for the configuration section
        """
        validators = validators or {}
        
        # Create field definitions
        field_definitions = {}
        for field_name, field_def in fields.items():
            if isinstance(field_def, tuple):
                if len(field_def) == 2:
                    # (type, default)
                    field_type, default = field_def
                    field_definitions[field_name] = (field_type, Field(default=default))
                elif len(field_def) == 3:
                    # (type, default, field description)
                    field_type, default, description = field_def
                    field_definitions[field_name] = (field_type, Field(default=default, description=description))
                else:
                    raise ValueError(f"Invalid field definition for {field_name}")
            else:
                # Just a default value
                field_definitions[field_name] = (type(field_def), Field(default=field_def))
        
        # Create the model class
        model_class = create_model(
            f"{section_name.capitalize()}Config",
            **field_definitions,
            __base__=ConfigSection
        )
        
        # Add validators
        for field_name, validator_func in validators.items():
            setattr(model_class, f"validate_{field_name}", validator(field_name)(validator_func))
        
        return model_class
    
    @staticmethod
    def create_section(
        section_name: str,
        fields: Dict[str, Any],
        validators: Optional[Dict[str, callable]] = None
    ) -> Any:
        """
        Create and load a configuration section instance.
        
        Args:
            section_name: Name of the configuration section
            fields: Dictionary of field definitions with default values and annotations
            validators: Dictionary of validator functions
            
        Returns:
            Instance of the configuration section class with loaded values
        """
        config_manager = get_config()
        section_class = ConfigSectionFactory.create_section_class(section_name, fields, validators)
        
        # Get configuration values for the section
        config_values = config_manager.get_section(section_name)
        
        # Create instance with loaded values (and defaults for missing values)
        instance = section_class(**config_values)
        
        return instance


class DatabaseConfig(BaseModel):
    """Database configuration section."""
    host: str = Field("localhost", env="DATABASE_HOST")
    port: int = Field(5432, env="DATABASE_PORT")
    name: str = Field(..., env="DATABASE_NAME")
    user: str = Field(..., env="DATABASE_USER")
    password: str = Field(..., env="DATABASE_PASSWORD")
    pool_size: int = Field(5, env="DATABASE_POOL_SIZE")
    max_overflow: int = Field(10, env="DATABASE_MAX_OVERFLOW")
    echo: bool = Field(False, env="DATABASE_ECHO")
    
    def get_connection_url(self) -> str:
        """Get database connection URL."""
        return f"postgresql://{self.user}:{self.password}@{self.host}:{self.port}/{self.name}"
    
    @validator("port")
    def validate_port(cls, v):
        """Validate that the port is within range."""
        if not 1 <= v <= 65535:
            raise ValueError("Port must be between 1 and 65535")
        return v


class ApiConfig(BaseModel):
    """API configuration section."""
    host: str = Field("0.0.0.0", env="API_HOST")
    port: int = Field(8000, env="API_PORT")
    debug: bool = Field(False, env="API_DEBUG")
    base_path: str = Field("/api", env="API_BASE_PATH")
    version: str = Field("v1", env="API_VERSION")
    workers: int = Field(4, env="API_WORKERS")
    timeout: int = Field(60, env="API_TIMEOUT")
    cors_origins: List[str] = Field(["*"], env="API_CORS_ORIGINS")
    
    @validator("port")
    def validate_port(cls, v):
        """Validate that the port is within range."""
        if not 1 <= v <= 65535:
            raise ValueError("Port must be between 1 and 65535")
        return v
    
    @validator("cors_origins")
    def validate_cors_origins(cls, v):
        """Parse CORS origins from string if needed."""
        if isinstance(v, str):
            if v == "*":
                return ["*"]
            return [origin.strip() for origin in v.split(",")]
        return v


class ShopifyConfig(BaseModel):
    """Shopify API configuration section."""
    api_key: str = Field(..., env="SHOPIFY_API_KEY")
    api_secret: str = Field(..., env="SHOPIFY_API_SECRET")
    api_version: str = Field("2023-10", env="SHOPIFY_API_VERSION")
    scopes: str = Field("read_products,read_orders", env="SHOPIFY_SCOPES")
    shop_domain: Optional[str] = Field(None, env="SHOPIFY_SHOP_DOMAIN")
    webhook_secret: Optional[str] = Field(None, env="SHOPIFY_WEBHOOK_SECRET")
    
    @validator("scopes")
    def validate_scopes(cls, v):
        """Parse scopes from string if needed."""
        if not v:
            return []
        return [scope.strip() for scope in v.split(",")]


class CacheConfig(BaseModel):
    """Cache configuration section."""
    enabled: bool = Field(True, env="CACHE_ENABLED")
    ttl: int = Field(3600, env="CACHE_TTL")  # Default: 1 hour
    redis_host: str = Field("localhost", env="REDIS_HOST")
    redis_port: int = Field(6379, env="REDIS_PORT")
    redis_db: int = Field(0, env="REDIS_DB")
    redis_password: Optional[str] = Field(None, env="REDIS_PASSWORD")
    max_items: Optional[int] = Field(10000, env="CACHE_MAX_ITEMS")
    
    def get_redis_url(self) -> str:
        """Get Redis connection URL."""
        auth = f":{self.redis_password}@" if self.redis_password else ""
        return f"redis://{auth}{self.redis_host}:{self.redis_port}/{self.redis_db}"


class LoggingConfig(BaseModel):
    """Logging configuration section."""
    level: str = Field("INFO", env="LOG_LEVEL")
    format: str = Field("%(asctime)s - %(name)s - %(levelname)s - %(message)s", env="LOG_FORMAT")
    file: Optional[str] = Field(None, env="LOG_FILE")
    syslog: bool = Field(False, env="LOG_SYSLOG")
    json_format: bool = Field(False, env="LOG_JSON")
    
    @validator("level")
    def validate_level(cls, v):
        """Validate logging level."""
        valid_levels = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        if v.upper() not in valid_levels:
            raise ValueError(f"Invalid logging level. Must be one of: {', '.join(valid_levels)}")
        return v.upper()


class SecurityConfig(BaseModel):
    """Security configuration section."""
    secret_key: str = Field(..., env="SECRET_KEY")
    jwt_algorithm: str = Field("HS256", env="JWT_ALGORITHM")
    jwt_expires: int = Field(60 * 24, env="JWT_EXPIRES")  # Default: 24 hours
    bcrypt_rounds: int = Field(12, env="BCRYPT_ROUNDS")
    allowed_hosts: List[str] = Field(["*"], env="ALLOWED_HOSTS")
    
    @validator("secret_key")
    def validate_secret_key(cls, v):
        """Validate secret key length."""
        if len(v) < 32:
            raise ValueError("Secret key must be at least 32 characters long")
        return v
    
    @validator("allowed_hosts")
    def validate_allowed_hosts(cls, v):
        """Parse allowed hosts from string if needed."""
        if isinstance(v, str):
            if v == "*":
                return ["*"]
            return [host.strip() for host in v.split(",")]
        return v


@lru_cache()
def get_database_config() -> DatabaseConfig:
    """Get database configuration section."""
    config = get_config()
    values = config.get_section("database")
    return DatabaseConfig(**values)


@lru_cache()
def get_api_config() -> ApiConfig:
    """Get API configuration section."""
    config = get_config()
    values = config.get_section("api")
    return ApiConfig(**values)


@lru_cache()
def get_shopify_config() -> ShopifyConfig:
    """Get Shopify configuration section."""
    config = get_config()
    values = config.get_section("shopify")
    return ShopifyConfig(**values)


@lru_cache()
def get_cache_config() -> CacheConfig:
    """Get cache configuration section."""
    config = get_config()
    values = config.get_section("cache")
    return CacheConfig(**values)


@lru_cache()
def get_logging_config() -> LoggingConfig:
    """Get logging configuration section."""
    config = get_config()
    values = config.get_section("logging")
    return LoggingConfig(**values)


@lru_cache()
def get_security_config() -> SecurityConfig:
    """Get security configuration section."""
    config = get_config()
    values = config.get_section("security")
    return SecurityConfig(**values)


def configure_logging() -> None:
    """Configure logging based on configuration."""
    config = get_logging_config()
    
    # Set up basic configuration
    if config.json_format:
        import json_log_formatter
        formatter = json_log_formatter.JSONFormatter()
    else:
        formatter = logging.Formatter(config.format)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, config.level))
    
    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Add console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)
    
    # Add file handler if configured
    if config.file:
        file_handler = logging.FileHandler(config.file)
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)
    
    # Add syslog handler if configured
    if config.syslog:
        try:
            from logging.handlers import SysLogHandler
            syslog_handler = SysLogHandler(address='/dev/log')
            syslog_handler.setFormatter(formatter)
            root_logger.addHandler(syslog_handler)
        except (ImportError, FileNotFoundError):
            logging.warning("Syslog handler requested but not available")


def generate_default_config() -> str:
    """
    Generate a default configuration file in YAML format.
    
    Returns:
        YAML string with default configuration
    """
    default_config = {
        "database": {
            "host": "localhost",
            "port": 5432,
            "name": "shopify_mcp",
            "user": "postgres",
            "password": "change_me",  # Should be changed in production
            "pool_size": 5,
            "max_overflow": 10,
            "echo": False
        },
        "api": {
            "host": "0.0.0.0",
            "port": 8000,
            "debug": False,
            "base_path": "/api",
            "version": "v1",
            "workers": 4,
            "timeout": 60,
            "cors_origins": ["*"]
        },
        "shopify": {
            "api_key": "your_api_key",
            "api_secret": "your_api_secret",
            "api_version": "2023-10",
            "scopes": "read_products,read_orders",
            "shop_domain": None,
            "webhook_secret": None
        },
        "cache": {
            "enabled": True,
            "ttl": 3600,
            "redis_host": "localhost",
            "redis_port": 6379,
            "redis_db": 0,
            "redis_password": None,
            "max_items": 10000
        },
        "logging": {
            "level": "INFO",
            "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            "file": None,
            "syslog": False,
            "json_format": False
        },
        "security": {
            "secret_key": "generate_a_secure_random_key_here",
            "jwt_algorithm": "HS256",
            "jwt_expires": 1440,  # 24 hours
            "bcrypt_rounds": 12,
            "allowed_hosts": ["*"]
        }
    }
    
    return yaml.dump(default_config, default_flow_style=False)