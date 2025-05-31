#!/bin/bash
# Run a specific category of tests

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if a category was provided
if [ $# -eq 0 ]; then
    echo -e "${RED}Error: No test category specified${NC}"
    echo -e "Usage: ./run_test_category.sh CATEGORY [options]"
    echo -e "Available categories: server, api, utils, integration, unit, all"
    echo -e "Options:"
    echo -e "  --coverage   Generate coverage report"
    exit 1
fi

CATEGORY=$1
shift  # Remove the first argument, leaving any additional options

# Check for coverage flag
COVERAGE=false
for arg in "$@"; do
  case $arg in
    --coverage)
      COVERAGE=true
      shift
      ;;
  esac
done

echo -e "${BLUE}Running tests for category: ${YELLOW}$CATEGORY${NC}"

# Activate virtual environment if it exists
if [ -d "test_env" ]; then
    source test_env/bin/activate
fi

# Build the pytest command
if [ "$COVERAGE" = true ]; then
    CMD="python -m pytest --cov=shopify_mcp_server --cov=utils"
else
    CMD="python -m pytest"
fi

# Run the appropriate tests based on category
case $CATEGORY in
    server)
        $CMD tests/unit/server -v
        ;;
    api)
        $CMD tests/unit/api -v
        ;;
    utils)
        $CMD tests/unit/utils -v
        ;;
    unit)
        $CMD tests/unit -v
        ;;
    integration)
        export RUN_INTEGRATION_TESTS=1
        $CMD tests/integration -v
        unset RUN_INTEGRATION_TESTS
        ;;
    all)
        export RUN_INTEGRATION_TESTS=1
        $CMD tests/ -v
        unset RUN_INTEGRATION_TESTS
        ;;
    *)
        echo -e "${RED}Invalid category: $CATEGORY${NC}"
        echo -e "Available categories: server, api, utils, integration, unit, all"
        exit 1
        ;;
esac

# Generate coverage report if requested
if [ "$COVERAGE" = true ]; then
    echo -e "${BLUE}Generating coverage report...${NC}"
    coverage html
    echo -e "${GREEN}Coverage report generated in htmlcov/${NC}"
fi

echo -e "${GREEN}Test run completed for category: $CATEGORY${NC}"