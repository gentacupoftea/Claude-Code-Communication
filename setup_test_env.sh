#!/bin/bash
set -e  # Exit on error

echo "Setting up test environment..."

# Check for required files
for file in requirements.txt requirements-test.txt; do
    if [ ! -f "$file" ]; then
        echo "Error: $file not found"
        exit 1
    fi
done

# Create virtual environment if it doesn't exist
if [ ! -d "test_venv" ]; then
    python -m venv test_venv
fi

# Activate virtual environment
source test_venv/bin/activate

# Install dependencies
pip install -r requirements.txt
pip install -r requirements-test.txt

echo "Test environment setup complete!"
