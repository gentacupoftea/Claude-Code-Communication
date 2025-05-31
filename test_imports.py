#!/usr/bin/env python3
"""
Enhanced import dependency test for Shopify MCP Server
Provides detailed feedback and installation instructions for missing modules
"""

import sys
import importlib
from typing import Dict, List, Tuple

# Categorized dependencies with installation instructions
DEPENDENCY_CATEGORIES = {
    'core': {
        'description': 'Core dependencies (required for basic functionality)',
        'modules': {
            'requests': {
                'package': 'requests',
                'install': 'pip install requests==2.31.0',
                'description': 'HTTP library'
            },
            'dotenv': {
                'package': 'python-dotenv',
                'install': 'pip install python-dotenv==1.0.0',
                'description': 'Environment variable management'
            },
            'urllib3': {
                'package': 'urllib3',
                'install': 'pip install urllib3==2.0.0',
                'description': 'HTTP client library'
            },
            'backoff': {
                'package': 'backoff',
                'install': 'pip install backoff==2.2.1',
                'description': 'Retry logic'
            }
        }
    },
    'data_processing': {
        'description': 'Data processing dependencies (for analytics features)',
        'modules': {
            'pandas': {
                'package': 'pandas',
                'install': 'pip install pandas==2.0.0',
                'description': 'Data analysis library'
            },
            'numpy': {
                'package': 'numpy',
                'install': 'pip install numpy==1.24.0',
                'description': 'Numerical computing'
            }
        }
    },
    'visualization': {
        'description': 'Visualization dependencies (for charts and graphs)',
        'modules': {
            'matplotlib': {
                'package': 'matplotlib',
                'install': 'pip install matplotlib==3.7.0',
                'description': 'Plotting library'
            },
            'matplotlib.pyplot': {
                'package': 'matplotlib',
                'install': 'pip install matplotlib==3.7.0',
                'description': 'Plotting interface'
            }
        }
    },
    'graphql': {
        'description': 'GraphQL dependencies (for GraphQL API features)',
        'modules': {
            'gql': {
                'package': 'gql',
                'install': 'pip install gql==3.5.0',
                'description': 'GraphQL client'
            }
        }
    },
    'mcp_framework': {
        'description': 'MCP framework (optional, platform-specific)',
        'modules': {
            'mcp': {
                'package': 'mcp',
                'install': 'pip install mcp==1.9.0',
                'description': 'Model Context Protocol framework',
                'optional': True
            },
            'mcp.server.fastmcp': {
                'package': 'mcp',
                'install': 'pip install mcp==1.9.0',
                'description': 'MCP FastMCP server',
                'optional': True
            },
            'mcp.server.stdio': {
                'package': 'mcp',
                'install': 'pip install mcp==1.9.0',
                'description': 'MCP stdio interface',
                'optional': True
            }
        }
    }
}

LOCAL_MODULES = {
    'utils': 'Utility functions module',
    'shopify_graphql_client': 'GraphQL client implementation'
}


def check_module(module_name: str) -> Tuple[bool, str]:
    """
    Check if a module can be imported.
    
    Returns:
        Tuple of (success, error_message)
    """
    try:
        importlib.import_module(module_name)
        return True, ""
    except ImportError as e:
        return False, str(e)


def get_install_command(module_name: str) -> str:
    """Get the installation command for a module."""
    for category_info in DEPENDENCY_CATEGORIES.values():
        if module_name in category_info['modules']:
            return category_info['modules'][module_name]['install']
    return f"pip install {module_name}"


def test_imports():
    """Test all dependencies and provide detailed feedback."""
    failed_imports = {}
    optional_missing = {}
    core_missing = False
    
    print("🔍 Shopify MCP Server - Import Dependency Test\n")
    
    # Test each category
    for category, category_info in DEPENDENCY_CATEGORIES.items():
        print(f"📦 {category_info['description']}")
        category_failures = []
        
        for module_name, module_info in category_info['modules'].items():
            success, error = check_module(module_name)
            
            if success:
                print(f"  ✅ {module_name} - {module_info['description']}")
            else:
                is_optional = module_info.get('optional', False)
                status = "⚠️" if is_optional else "❌"
                print(f"  {status} {module_name} - {module_info['description']}")
                
                if is_optional:
                    optional_missing[module_name] = module_info
                else:
                    category_failures.append((module_name, module_info, error))
                    if category == 'core':
                        core_missing = True
        
        if category_failures:
            failed_imports[category] = category_failures
        print()
    
    # Test local modules
    print("📦 Local modules")
    local_failures = []
    for module_name, description in LOCAL_MODULES.items():
        success, error = check_module(module_name)
        if success:
            print(f"  ✅ {module_name} - {description}")
        else:
            print(f"  ⚠️ {module_name} - {description}")
            local_failures.append((module_name, error))
    print()
    
    # Provide installation instructions if needed
    if failed_imports:
        print("📋 Installation Instructions\n")
        
        if core_missing:
            print("🚨 CRITICAL: Core dependencies are missing!")
            print("   Install core dependencies first:")
            print("   pip install -r requirements-base.txt\n")
        
        for category, failures in failed_imports.items():
            category_info = DEPENDENCY_CATEGORIES[category]
            print(f"For {category_info['description']}:")
            
            unique_packages = {}
            for module_name, module_info, _ in failures:
                package = module_info['package']
                if package not in unique_packages:
                    unique_packages[package] = module_info['install']
            
            for install_cmd in unique_packages.values():
                print(f"  {install_cmd}")
            print()
        
        print("💡 Quick installation options:")
        print("  • All core dependencies:     pip install -r requirements-base.txt")
        print("  • Extended features:         pip install -r requirements-extended.txt")
        print("  • Full installation:         pip install -r requirements.txt")
        print()
    
    if optional_missing:
        print("ℹ️ Optional modules not installed:")
        for module_name, module_info in optional_missing.items():
            print(f"  • {module_name}: {module_info['install']}")
        print()
    
    # Network troubleshooting tips
    if failed_imports:
        print("🔧 Troubleshooting network issues:")
        print("  • Behind a proxy? Set: export PIP_PROXY=http://your-proxy:port")
        print("  • Slow connection? Set: export INSTALL_TIMEOUT=300")
        print("  • Offline? Use: OFFLINE_MODE=1 ./setup_test_env.sh")
        print("  • See: docs/NETWORK_TROUBLESHOOTING.md for more help")
        print()
    
    # Summary
    total_modules = sum(len(cat['modules']) for cat in DEPENDENCY_CATEGORIES.values())
    failed_count = sum(len(failures) for failures in failed_imports.values())
    
    print("📊 Summary:")
    print(f"  Total modules tested: {total_modules}")
    print(f"  Successfully imported: {total_modules - failed_count}")
    print(f"  Failed imports: {failed_count}")
    
    if local_failures:
        print(f"  Local modules with issues: {len(local_failures)}")
    
    if core_missing:
        print("\n❌ Core dependencies missing - basic functionality unavailable")
        return False
    elif failed_imports:
        print("\n⚠️ Some optional features may be unavailable")
        return True  # Return True if only optional deps are missing
    else:
        print("\n✅ All dependencies successfully imported!")
        return True


if __name__ == "__main__":
    success = test_imports()
    # Exit with 0 if core deps are available, 1 if core deps are missing
    sys.exit(0 if success else 1)