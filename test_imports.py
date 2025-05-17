#!/usr/bin/env python3
"""
Import dependency test for Shopify MCP Server
Tests that all required dependencies can be imported successfully
"""

import sys
import importlib

# Required dependencies
dependencies = [
    'mcp',
    'mcp.server.fastmcp',
    'mcp.server.stdio',
    'requests',
    'pandas',
    'matplotlib',
    'matplotlib.pyplot',
    'dotenv',
    'asyncio',
    'urllib3',
    'numpy'
]

def test_imports():
    """Test that all required dependencies can be imported"""
    failed_imports = []
    
    print("Testing import dependencies...")
    
    for module_name in dependencies:
        try:
            importlib.import_module(module_name)
            print(f"✓ {module_name}")
        except ImportError as e:
            print(f"✗ {module_name}: {e}")
            failed_imports.append((module_name, str(e)))
    
    # Test local modules
    print("\nTesting local modules...")
    try:
        import utils
        print("✓ utils")
    except ImportError as e:
        print(f"✗ utils: {e}")
        failed_imports.append(("utils", str(e)))
    
    if failed_imports:
        print(f"\n{len(failed_imports)} imports failed:")
        for module, error in failed_imports:
            print(f"  {module}: {error}")
        return False
    else:
        print("\nAll imports successful!")
        return True

if __name__ == "__main__":
    success = test_imports()
    sys.exit(0 if success else 1)
