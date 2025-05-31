#!/bin/bash
# Adaptive environment setup for Shopify MCP Server
# Detects environment and installs appropriate dependencies

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Shopify MCP Server - Adaptive Environment Setup${NC}"
echo "================================================"

# Detect Python version
PYTHON_CMD=""
if command -v python3.12 &> /dev/null; then
    PYTHON_CMD="python3.12"
elif command -v python3.11 &> /dev/null; then
    PYTHON_CMD="python3.11"
elif command -v python3.10 &> /dev/null; then
    PYTHON_CMD="python3.10"
elif command -v python3.9 &> /dev/null; then
    PYTHON_CMD="python3.9"
elif command -v python3.8 &> /dev/null; then
    PYTHON_CMD="python3.8"
elif command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
else
    echo -e "${RED}Error: Python 3.8+ not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Using Python: $PYTHON_CMD${NC}"
$PYTHON_CMD --version

# Create virtual environment
echo -e "\n${YELLOW}Creating virtual environment...${NC}"
$PYTHON_CMD -m venv venv

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
echo -e "\n${YELLOW}Upgrading pip...${NC}"
pip install --upgrade pip

# Install dependencies based on environment level
echo -e "\n${YELLOW}Select installation level:${NC}"
echo "1. Minimal (core dependencies only)"
echo "2. Standard (recommended for most users)"
echo "3. Full (all features including optional)"
echo -n "Enter choice [1-3]: "
read -r choice

case $choice in
    1)
        echo -e "\n${YELLOW}Installing minimal dependencies...${NC}"
        pip install -r requirements-base.txt
        ;;
    2)
        echo -e "\n${YELLOW}Installing standard dependencies...${NC}"
        pip install -r requirements-extended.txt
        ;;
    3)
        echo -e "\n${YELLOW}Installing full dependencies...${NC}"
        pip install -r requirements-extended.txt
        # Try to install optional dependencies, but don't fail if some are unavailable
        pip install -r requirements-optional.txt || echo -e "${YELLOW}Some optional dependencies could not be installed${NC}"
        ;;
    *)
        echo -e "${RED}Invalid choice. Installing standard dependencies.${NC}"
        pip install -r requirements-extended.txt
        ;;
esac

# Install dev dependencies if requested
echo -e "\n${YELLOW}Install development dependencies? (y/n):${NC} "
read -r install_dev

if [[ $install_dev == "y" || $install_dev == "Y" ]]; then
    echo -e "${YELLOW}Installing development dependencies...${NC}"
    pip install -r requirements-dev.txt
fi

# Check environment
echo -e "\n${YELLOW}Checking environment...${NC}"
python test_environment_check.py

# Display summary
echo -e "\n${GREEN}✓ Environment setup complete!${NC}"
echo -e "\nTo activate the environment in the future, run:"
echo -e "  ${BLUE}source venv/bin/activate${NC}"
echo -e "\nTo run tests, use:"
echo -e "  ${BLUE}python run_adaptive_tests.py${NC}"
echo -e "\nFor more options:"
echo -e "  ${BLUE}./run_tests.sh${NC} - Run traditional test suite"
echo -e "  ${BLUE}python test_environment_check.py${NC} - Check environment status"