"""
Example usage of the ConfigManager for the MultiLLM Autonomous System.

This file demonstrates how to use the configuration management system.
"""

import os
from config_manager import ConfigManager, ConfigCategory, LLMConfig, TaskRoutingConfig, MonitoringConfig


def main():
    """Example usage of ConfigManager"""
    
    # Initialize configuration manager
    config_manager = ConfigManager(
        config_dir="./config_files",
        encryption_key=None  # Will generate automatically
    )
    
    # Example 1: Configure LLM settings
    print("=== LLM Configuration Example ===")
    
    # Add a new LLM configuration
    claude_config = LLMConfig(
        api_key="sk-ant-api03-example-key",
        endpoint="https://api.anthropic.com/v1/messages",
        model="claude-3-sonnet-20240229",
        max_tokens=4000,
        temperature=0.7,
        rate_limit_rpm=60,
        timeout=30,
        retry_attempts=3,
        backup_model="claude-3-haiku-20240307"
    )
    
    success = config_manager.set_llm_config("claude", claude_config)
    print(f"Claude configuration saved: {success}")
    
    # Retrieve LLM configuration
    retrieved_config = config_manager.get_llm_config("claude")
    print(f"Retrieved Claude config: {retrieved_config}")
    
    # Example 2: Configure task routing
    print("\n=== Task Routing Configuration Example ===")
    
    # Configure code generation task routing
    code_gen_routing = TaskRoutingConfig(
        task_type="code_generation",
        primary_llm="claude",
        fallback_llms=["openai", "gemini"],
        confidence_threshold=0.8,
        complexity_score=3,
        priority=1
    )
    
    success = config_manager.set_task_routing_config("code_generation", code_gen_routing)
    print(f"Code generation routing saved: {success}")
    
    # Retrieve task routing configuration
    retrieved_routing = config_manager.get_task_routing_config("code_generation")
    print(f"Retrieved routing config: {retrieved_routing}")
    
    # Example 3: Get monitoring configuration
    print("\n=== Monitoring Configuration Example ===")
    
    monitoring_config = config_manager.get_monitoring_config()
    print(f"Current monitoring config: {monitoring_config}")
    
    # Example 4: Update environment variables
    print("\n=== Environment Variables Update ===")
    
    success = config_manager.update_environment_variables()
    print(f"Environment variables updated: {success}")
    
    # Example 5: Configuration summary
    print("\n=== Configuration Summary ===")
    
    summary = config_manager.get_config_summary()
    print(f"Configuration summary: {summary}")
    
    # Example 6: Export configurations (without sensitive data)
    print("\n=== Export Configuration ===")
    
    export_path = "./exported_config.json"
    success = config_manager.export_configurations(export_path, include_sensitive=False)
    print(f"Configuration exported to {export_path}: {success}")
    
    # Example 7: Reload configurations
    print("\n=== Reload Configurations ===")
    
    success = config_manager.reload_configurations()
    print(f"Configurations reloaded: {success}")
    
    # Example 8: Working with different configuration categories
    print("\n=== Configuration Categories ===")
    
    for category in ConfigCategory:
        config_data = config_manager.load_configuration(category)
        print(f"{category.value}: {len(config_data)} items")
    
    print("\nConfiguration management example completed!")


if __name__ == "__main__":
    main()