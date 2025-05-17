#!/usr/bin/env python3
"""
Adaptive test runner that adjusts based on available dependencies
"""

import subprocess
import json
import sys
from pathlib import Path

# Test categories based on dependencies
TEST_CATEGORIES = {
    'core': {
        'tests': ['test_imports.py'],
        'requires': ['requests', 'dotenv', 'urllib3']
    },
    'api': {
        'tests': ['test_server.py'],
        'requires': ['requests', 'backoff']
    },
    'graphql': {
        'tests': ['test_graphql_client.py', 'test_graphql_integration_simple.py'],
        'requires': ['gql', 'requests_toolbelt']
    },
    'data': {
        'tests': ['test_optimization.py', 'test_cache_performance.py'],
        'requires': ['pandas', 'numpy']
    },
    'full': {
        'tests': ['test_graphql_integration.py'],
        'requires': ['mcp', 'gql', 'pandas']
    }
}


class AdaptiveTestRunner:
    def __init__(self):
        self.available_deps = {}
        self.test_results = {}
        
    def check_environment(self):
        """Run environment check and load results"""
        print("🔍 Checking environment...")
        subprocess.run([sys.executable, "test_environment_check.py"], check=True)
        
        # Load environment report
        with open("environment_report.json", "r") as f:
            report = json.load(f)
        
        # Extract available dependencies
        for category in ['core', 'extended', 'optional']:
            for dep, info in report['dependencies'].get(category, {}).items():
                self.available_deps[dep] = info['available']
        
        return report
    
    def can_run_category(self, category: str) -> bool:
        """Check if a test category can be run"""
        requirements = TEST_CATEGORIES[category]['requires']
        return all(self.available_deps.get(req, False) for req in requirements)
    
    def run_test_file(self, test_file: str) -> bool:
        """Run a single test file"""
        try:
            result = subprocess.run(
                [sys.executable, "-m", "pytest", test_file, "-v"],
                capture_output=True,
                text=True
            )
            return result.returncode == 0
        except Exception as e:
            print(f"  ❌ Error running {test_file}: {e}")
            return False
    
    def run_tests(self):
        """Run all possible tests based on available dependencies"""
        print("\n🧪 Running adaptive tests...\n")
        
        total_tests = 0
        passed_tests = 0
        skipped_categories = []
        
        for category, config in TEST_CATEGORIES.items():
            if self.can_run_category(category):
                print(f"📦 Running {category} tests...")
                for test_file in config['tests']:
                    if Path(test_file).exists():
                        print(f"  🔄 {test_file}")
                        total_tests += 1
                        if self.run_test_file(test_file):
                            passed_tests += 1
                            print(f"  ✅ {test_file} passed")
                        else:
                            print(f"  ❌ {test_file} failed")
                    else:
                        print(f"  ⚠️ {test_file} not found")
                print()
            else:
                skipped_categories.append(category)
                missing_deps = [
                    dep for dep in config['requires']
                    if not self.available_deps.get(dep, False)
                ]
                print(f"⏭️ Skipping {category} tests (missing: {', '.join(missing_deps)})\n")
        
        # Summary
        print("📊 Test Summary:")
        print(f"  Total categories: {len(TEST_CATEGORIES)}")
        print(f"  Executed categories: {len(TEST_CATEGORIES) - len(skipped_categories)}")
        print(f"  Total tests run: {total_tests}")
        print(f"  Passed: {passed_tests}")
        print(f"  Failed: {total_tests - passed_tests}")
        
        if skipped_categories:
            print(f"\n⚠️ Skipped categories: {', '.join(skipped_categories)}")
            print("  Install missing dependencies to run all tests")
        
        return passed_tests == total_tests
    
    def generate_coverage_report(self):
        """Generate coverage report if coverage is available"""
        if self.available_deps.get('coverage', False):
            print("\n📈 Generating coverage report...")
            try:
                subprocess.run(["coverage", "report"], check=True)
                subprocess.run(["coverage", "html"], check=True)
                print("  ✅ Coverage report generated in htmlcov/")
            except Exception as e:
                print(f"  ⚠️ Could not generate coverage: {e}")


def main():
    """Main entry point"""
    print("🚀 Shopify MCP Server - Adaptive Test Runner\n")
    
    runner = AdaptiveTestRunner()
    
    # Check environment
    report = runner.check_environment()
    
    # Run tests
    all_passed = runner.run_tests()
    
    # Generate coverage if available
    runner.generate_coverage_report()
    
    # Save test results
    test_report = {
        'environment': report,
        'test_results': runner.test_results,
        'success': all_passed
    }
    
    with open("test_report.json", "w") as f:
        json.dump(test_report, f, indent=2)
    
    print(f"\n📄 Test report saved to test_report.json")
    
    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()