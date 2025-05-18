#!/usr/bin/env python3
"""
Dependency architecture analyzer
"""

import os
import re
import json
from collections import defaultdict
from pathlib import Path

def analyze_imports(file_path):
    """Analyze imports in a Python file"""
    imports = set()
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
        # Standard imports
        import_pattern = r'^\s*import\s+(\S+)'
        from_pattern = r'^\s*from\s+(\S+)\s+import'
        
        for line in content.split('\n'):
            # Check import statements
            match = re.match(import_pattern, line)
            if match:
                module = match.group(1).split('.')[0]
                imports.add(module)
            
            # Check from imports
            match = re.match(from_pattern, line)
            if match:
                module = match.group(1).split('.')[0]
                imports.add(module)
    
    return imports

def categorize_imports(imports):
    """Categorize imports into stdlib, third-party, and local"""
    stdlib_modules = {
        'os', 'sys', 'json', 'time', 'datetime', 'logging', 'asyncio',
        're', 'typing', 'pathlib', 'io', 'base64', 'functools', 'hashlib',
        'dataclasses', 'collections', 'urllib', 'enum', 'warnings',
        'importlib', 'subprocess'
    }
    
    third_party = {
        'mcp', 'requests', 'pandas', 'matplotlib', 'dotenv', 'backoff',
        'httpx', 'gql', 'pytest', 'setuptools'
    }
    
    categorized = {
        'stdlib': [],
        'third_party': [],
        'local': []
    }
    
    for imp in imports:
        if imp in stdlib_modules:
            categorized['stdlib'].append(imp)
        elif imp in third_party:
            categorized['third_party'].append(imp)
        elif not imp.startswith('_'):
            categorized['local'].append(imp)
    
    return categorized

def analyze_dependency_graph():
    """Create dependency graph for the project"""
    project_root = Path('/Users/mourigenta/shopify-mcp-server')
    dependency_graph = defaultdict(set)
    module_imports = {}
    
    # Analyze all Python files
    for py_file in project_root.rglob('*.py'):
        if 'test' not in str(py_file) and '__pycache__' not in str(py_file):
            relative_path = py_file.relative_to(project_root)
            imports = analyze_imports(py_file)
            module_imports[str(relative_path)] = imports
            
            # Build dependency graph
            for imp in imports:
                dependency_graph[imp].add(str(relative_path))
    
    return dependency_graph, module_imports

def generate_report():
    """Generate dependency analysis report"""
    graph, modules = analyze_dependency_graph()
    
    report = {
        'total_modules': len(modules),
        'dependency_usage': {},
        'critical_dependencies': [],
        'module_breakdown': {}
    }
    
    # Analyze each module
    for module, imports in modules.items():
        categorized = categorize_imports(imports)
        report['module_breakdown'][module] = categorized
    
    # Analyze dependency usage
    for dep, users in graph.items():
        report['dependency_usage'][dep] = {
            'used_by': list(users),
            'usage_count': len(users)
        }
        
        # Identify critical dependencies
        if len(users) > 3:
            report['critical_dependencies'].append(dep)
    
    return report

def main():
    """Main analysis function"""
    print("Analyzing dependency architecture...")
    report = generate_report()
    
    print("\n=== Dependency Architecture Analysis ===\n")
    
    print(f"Total modules analyzed: {report['total_modules']}")
    
    print("\n--- Critical Dependencies ---")
    for dep in sorted(report['critical_dependencies'], 
                     key=lambda x: len(report['dependency_usage'][x]['used_by']), 
                     reverse=True):
        usage = report['dependency_usage'][dep]
        print(f"{dep:15} used by {usage['usage_count']} modules")
    
    print("\n--- Third-party Dependencies by Module ---")
    for module, breakdown in report['module_breakdown'].items():
        if breakdown['third_party']:
            print(f"\n{module}:")
            print(f"  Third-party: {', '.join(sorted(breakdown['third_party']))}")
    
    # Save detailed report
    with open('dependency_analysis.json', 'w') as f:
        json.dump(report, f, indent=2)
    
    print("\nDetailed report saved to dependency_analysis.json")

if __name__ == "__main__":
    main()