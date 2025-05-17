#!/bin/bash
# run_tests.sh
# Comprehensive test runner for Shopify MCP Server
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test categories
UNIT_TESTS=("test_graphql_client.py" "test_server.py" "test_optimization.py" "test_cache_performance.py")
INTEGRATION_TESTS=("test_graphql_integration.py" "test_graphql_integration_simple.py")
IMPORT_TESTS=("test_imports.py")

echo -e "${BLUE}Shopify MCP Server Test Runner${NC}"
echo "================================"

# Check if virtual environment exists
if [ ! -d "test_env" ]; then
    echo -e "${YELLOW}Creating test environment...${NC}"
    python3 -m venv test_env
fi

# Activate virtual environment
source test_env/bin/activate

# Install/update dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
pip install --upgrade pip >/dev/null 2>&1
pip install -r requirements.txt -r requirements-dev.txt >/dev/null 2>&1

# Run import tests first
echo -e "\n${BLUE}Running import tests...${NC}"
for test in "${IMPORT_TESTS[@]}"; do
    if [ -f "$test" ]; then
        echo -e "${YELLOW}Running $test${NC}"
        python "$test" || echo -e "${RED}Failed: $test${NC}"
    fi
done

# Run unit tests
echo -e "\n${BLUE}Running unit tests...${NC}"
for test in "${UNIT_TESTS[@]}"; do
    if [ -f "$test" ]; then
        echo -e "${YELLOW}Running $test${NC}"
        python -m pytest "$test" -v || echo -e "${RED}Failed: $test${NC}"
    fi
done

# Run integration tests
echo -e "\n${BLUE}Running integration tests...${NC}"
for test in "${INTEGRATION_TESTS[@]}"; do
    if [ -f "$test" ]; then
        echo -e "${YELLOW}Running $test${NC}"
        python "$test" || echo -e "${RED}Failed: $test${NC}"
    fi
done

# Compare mode for performance testing
if [ "$1" == "--compare" ]; then
    echo -e "\n${BLUE}Running performance comparison tests...${NC}"
    python test_optimization.py --compare
fi

# Coverage report
if [ "$1" == "--coverage" ]; then
    echo -e "\n${BLUE}Generating coverage report...${NC}"
    coverage run -m pytest
    coverage report
    coverage html
    echo -e "${GREEN}Coverage report generated in htmlcov/${NC}"
fi

echo -e "\n${GREEN}Test run completed!${NC}"