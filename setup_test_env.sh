#!/bin/bash
# setup_test_env.sh
# Create a virtual environment, install dependencies, and run tests with coverage
set -e

python -m venv test_env
source test_env/bin/activate

pip install --upgrade pip
mkdir -p vendor

# Attempt to download optional dependencies for caching
pip download mcp==1.9.0 -d vendor/ >/dev/null 2>&1 || true

if ls vendor/*.whl >/dev/null 2>&1; then
    pip install --no-index --find-links=vendor -r requirements.txt -r requirements-dev.txt || true
else
    pip install -r requirements.txt -r requirements-dev.txt || true
fi

coverage run test_imports.py
coverage run -a test_server.py
coverage run -a test_optimization.py
coverage report

