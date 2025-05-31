#!/usr/bin/env python3
"""
Enhanced environment check for Shopify MCP Server
Categorizes dependencies and provides appropriate feedback
"""

import sys
import importlib
import json
from typing import Dict, List, Tuple

# Dependency categories
CORE_DEPENDENCIES = {
    'requests': 'HTTP requests library',
    'dotenv': 'Environment variable management',
    'urllib3': 'HTTP client library',
    'backoff': 'Retry logic library'
}

EXTENDED_DEPENDENCIES = {
    'pandas': 'Data analysis library',
    'matplotlib': 'Data visualization library',
    'gql': 'GraphQL client library',
    'requests_toolbelt': 'Advanced HTTP features',
    'requests_ratelimiter': 'Rate limiting support'
}

OPTIONAL_DEPENDENCIES = {
    'mcp': 'Model Context Protocol framework',
    'numpy': 'Numerical computing library'
}

# Feature mapping
FEATURE_REQUIREMENTS = {
    'basic_api': ['requests', 'dotenv', 'urllib3'],
    'data_visualization': ['pandas', 'matplotlib'],
    'graphql': ['gql', 'requests_toolbelt'],
    'rate_limiting': ['requests_ratelimiter', 'backoff'],
    'mcp_server': ['mcp'],
    'performance_optimization': ['numpy']
}


class EnvironmentChecker:
    def __init__(self):
        self.results = {
            'core': {},
            'extended': {},
            'optional': {},
            'features': {}
        }
        
    def check_dependency(self, module_name: str) -> Tuple[bool, str]:
        """Check if a module can be imported"""
        try:
            importlib.import_module(module_name)
            return True, "OK"
        except ImportError as e:
            return False, str(e)
    
    def check_all_dependencies(self):
        """Check all categories of dependencies"""
        # Check core dependencies
        print("🔍 Checking core dependencies...")
        for module, description in CORE_DEPENDENCIES.items():
            success, message = self.check_dependency(module)
            self.results['core'][module] = {
                'available': success,
                'description': description,
                'error': message if not success else None
            }
            status = "✅" if success else "❌"
            print(f"  {status} {module} - {description}")
        
        # Check extended dependencies
        print("\n🔍 Checking extended dependencies...")
        for module, description in EXTENDED_DEPENDENCIES.items():
            success, message = self.check_dependency(module)
            self.results['extended'][module] = {
                'available': success,
                'description': description,
                'error': message if not success else None
            }
            status = "✅" if success else "⚠️"
            print(f"  {status} {module} - {description}")
        
        # Check optional dependencies
        print("\n🔍 Checking optional dependencies...")
        for module, description in OPTIONAL_DEPENDENCIES.items():
            success, message = self.check_dependency(module)
            self.results['optional'][module] = {
                'available': success,
                'description': description,
                'error': message if not success else None
            }
            status = "✅" if success else "ℹ️"
            print(f"  {status} {module} - {description}")
    
    def check_features(self):
        """Check which features are available based on dependencies"""
        print("\n🔍 Checking feature availability...")
        
        for feature, required_modules in FEATURE_REQUIREMENTS.items():
            available = all(
                self.results.get(cat, {}).get(mod, {}).get('available', False)
                for cat in ['core', 'extended', 'optional']
                for mod in required_modules
                if mod in self.results.get(cat, {})
            )
            
            self.results['features'][feature] = {
                'available': available,
                'required_modules': required_modules
            }
            
            status = "✅" if available else "❌"
            feature_name = feature.replace('_', ' ').title()
            print(f"  {status} {feature_name}")
    
    def generate_report(self) -> Dict:
        """Generate a comprehensive environment report"""
        report = {
            'environment': {
                'python_version': sys.version,
                'platform': sys.platform
            },
            'dependencies': self.results,
            'recommendations': []
        }
        
        # Add recommendations
        if not all(dep['available'] for dep in self.results['core'].values()):
            report['recommendations'].append(
                "Critical: Install core dependencies with 'pip install -r requirements-base.txt'"
            )
        
        missing_extended = [
            mod for mod, info in self.results['extended'].items()
            if not info['available']
        ]
        if missing_extended:
            report['recommendations'].append(
                f"Recommended: Install extended dependencies ({', '.join(missing_extended)}) "
                "with 'pip install -r requirements-extended.txt'"
            )
        
        return report
    
    def save_report(self, filename: str = "environment_report.json"):
        """Save the report to a JSON file"""
        report = self.generate_report()
        with open(filename, 'w') as f:
            json.dump(report, f, indent=2)
        print(f"\n📄 Report saved to {filename}")


def main():
    """Run environment check"""
    print("🔧 Shopify MCP Server Environment Check\n")
    
    checker = EnvironmentChecker()
    checker.check_all_dependencies()
    checker.check_features()
    
    report = checker.generate_report()
    
    # Summary
    print("\n📊 Summary:")
    core_ok = all(dep['available'] for dep in report['dependencies']['core'].values())
    if core_ok:
        print("  ✅ All core dependencies are available")
    else:
        print("  ❌ Some core dependencies are missing")
    
    available_features = [
        feat for feat, info in report['dependencies']['features'].items()
        if info['available']
    ]
    print(f"  📦 Available features: {', '.join(available_features)}")
    
    if report['recommendations']:
        print("\n💡 Recommendations:")
        for rec in report['recommendations']:
            print(f"  • {rec}")
    
    # Save report
    checker.save_report()
    
    # Exit with appropriate code
    sys.exit(0 if core_ok else 1)


if __name__ == "__main__":
    main()