"""
Environment variables compatibility module
"""

import os

# Environment variable mapping (new -> old)
ENV_VAR_MAPPING = {
    "PROJECT_ID": "SHOPIFY_MCP_PROJECT_ID",
    "SERVICE_NAME": "SHOPIFY_MCP_SERVICE_NAME",
    "SERVICE_ACCOUNT": "SHOPIFY_MCP_SERVICE_ACCOUNT"
}

def get_env_var(name, default=None):
    """Get environment variable with backwards compatibility
    
    Args:
        name (str): New environment variable name
        default: Default value if not found
        
    Returns:
        str: Environment variable value
    """
    # Try to get the new name first
    value = os.environ.get(name)
    
    # If not found, try the old name
    if value is None and name in ENV_VAR_MAPPING:
        value = os.environ.get(ENV_VAR_MAPPING[name])
    
    # Return value or default
    return value if value is not None else default