#!/usr/bin/env python3
"""
Dependency compatibility checker for Python versions
"""

import subprocess
import json
import sys

def check_package_python_support(package_name):
    """Check Python version support for a package"""
    try:
        result = subprocess.run(
            ["pip", "show", package_name],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            lines = result.stdout.split('\n')
            for line in lines:
                if line.startswith('Requires-Python:'):
                    return line.split(':', 1)[1].strip()
        return None
    except Exception as e:
        return f"Error: {e}"

def main():
    packages = [
        "mcp",
        "requests",
        "pandas",
        "matplotlib", 
        "python-dotenv",
        "urllib3",
        "gql",
        "requests-ratelimiter",
        "backoff",
        "httpx"
    ]
    
    print("Checking Python version requirements for dependencies...")
    print("-" * 50)
    
    for package in packages:
        python_req = check_package_python_support(package)
        print(f"{package:20} : {python_req or 'No specific requirement'}")

if __name__ == "__main__":
    main()