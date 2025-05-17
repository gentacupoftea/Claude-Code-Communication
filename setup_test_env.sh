#!/bin/bash
# setup_test_env.sh
# Create a virtual environment, install dependencies, and run tests

set -e

python -m venv test_env
source test_env/bin/activate

pip install -r requirements.txt

PYTHONPATH=$(pwd) python test_imports.py
PYTHONPATH=$(pwd) python test_server.py
PYTHONPATH=$(pwd) python test_optimization.py
