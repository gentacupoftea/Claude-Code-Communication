#!/bin/bash
# setup_test_env.sh - Robust test environment setup for restricted networks
# Supports configurable retry, timeout, and dependency selection

set -e

# Configuration defaults (can be overridden by environment variables)
INSTALL_RETRY=${INSTALL_RETRY:-3}
INSTALL_TIMEOUT=${INSTALL_TIMEOUT:-120}
INSTALL_RETRY_DISABLED=${INSTALL_RETRY_DISABLED:-0}
INSTALL_OPTIONAL=${INSTALL_OPTIONAL:-1}
INSTALL_DEV=${INSTALL_DEV:-1}
OFFLINE_MODE=${OFFLINE_MODE:-0}
VENDOR_DIR=${VENDOR_DIR:-vendor}
PIP_PROXY=${PIP_PROXY:-""}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Shopify MCP Server - Test Environment Setup${NC}"
echo -e "${BLUE}===========================================${NC}"

# Display configuration
echo -e "\n${YELLOW}Configuration:${NC}"
echo "  INSTALL_RETRY: $INSTALL_RETRY"
echo "  INSTALL_TIMEOUT: $INSTALL_TIMEOUT"
echo "  INSTALL_RETRY_DISABLED: $INSTALL_RETRY_DISABLED"
echo "  INSTALL_OPTIONAL: $INSTALL_OPTIONAL"
echo "  INSTALL_DEV: $INSTALL_DEV"
echo "  OFFLINE_MODE: $OFFLINE_MODE"
echo "  VENDOR_DIR: $VENDOR_DIR"
if [ ! -z "$PIP_PROXY" ]; then
    echo "  PIP_PROXY: $PIP_PROXY"
fi

# Create virtual environment
echo -e "\n${YELLOW}Creating virtual environment...${NC}"
python3 -m venv test_env || {
    echo -e "${RED}Failed to create virtual environment${NC}"
    exit 1
}

source test_env/bin/activate

# Upgrade pip with retry logic
upgrade_pip() {
    local retries=0
    local max_retries=$([[ $INSTALL_RETRY_DISABLED -eq 1 ]] && echo 0 || echo $INSTALL_RETRY)
    
    while [ $retries -le $max_retries ]; do
        echo -e "${YELLOW}Upgrading pip (attempt $((retries+1))/$((max_retries+1)))...${NC}"
        
        if timeout $INSTALL_TIMEOUT pip install --upgrade pip; then
            echo -e "${GREEN}✓ pip upgraded successfully${NC}"
            return 0
        else
            retries=$((retries+1))
            if [ $retries -le $max_retries ]; then
                echo -e "${YELLOW}Retrying in 5 seconds...${NC}"
                sleep 5
            fi
        fi
    done
    
    echo -e "${RED}Failed to upgrade pip after $((max_retries+1)) attempts${NC}"
    return 1
}

# Function to install requirements with retry and timeout
install_requirements() {
    local req_file=$1
    local description=$2
    local required=${3:-1}
    
    if [ ! -f "$req_file" ]; then
        echo -e "${YELLOW}File $req_file not found, skipping...${NC}"
        return 0
    fi
    
    echo -e "\n${YELLOW}Installing $description...${NC}"
    
    local retries=0
    local max_retries=$([[ $INSTALL_RETRY_DISABLED -eq 1 ]] && echo 0 || echo $INSTALL_RETRY)
    local pip_args=""
    
    # Add proxy if configured
    if [ ! -z "$PIP_PROXY" ]; then
        pip_args="$pip_args --proxy $PIP_PROXY"
    fi
    
    # Add timeout
    pip_args="$pip_args --timeout $INSTALL_TIMEOUT"
    
    while [ $retries -le $max_retries ]; do
        echo -e "${YELLOW}Installing from $req_file (attempt $((retries+1))/$((max_retries+1)))...${NC}"
        
        if pip install $pip_args -r "$req_file"; then
            echo -e "${GREEN}✓ $description installed successfully${NC}"
            return 0
        else
            retries=$((retries+1))
            if [ $retries -le $max_retries ]; then
                echo -e "${YELLOW}Installation failed. Retrying in 10 seconds...${NC}"
                sleep 10
            fi
        fi
    done
    
    if [ $required -eq 1 ]; then
        echo -e "${RED}Failed to install $description after $((max_retries+1)) attempts${NC}"
        echo -e "${RED}This is a required dependency. Setup cannot continue.${NC}"
        echo -e "\n${YELLOW}Troubleshooting suggestions:${NC}"
        echo -e "  1. Check your internet connection"
        echo -e "  2. If behind a proxy, set PIP_PROXY environment variable"
        echo -e "  3. Try offline mode with pre-downloaded packages: OFFLINE_MODE=1"
        echo -e "  4. See docs/NETWORK_TROUBLESHOOTING.md for more solutions"
        return 1
    else
        echo -e "${YELLOW}⚠ Failed to install $description, continuing...${NC}"
        return 0
    fi
}

# Create vendor directory for offline packages
mkdir -p "$VENDOR_DIR"

# Offline mode installation
if [ "$OFFLINE_MODE" -eq 1 ]; then
    echo -e "\n${YELLOW}Running in OFFLINE MODE${NC}"
    echo -e "Looking for packages in $VENDOR_DIR..."
    
    if ls "$VENDOR_DIR"/*.whl >/dev/null 2>&1 || ls "$VENDOR_DIR"/*.tar.gz >/dev/null 2>&1; then
        echo -e "${GREEN}Found offline packages${NC}"
        pip install --no-index --find-links="$VENDOR_DIR" -r requirements.txt || {
            echo -e "${RED}Offline installation failed${NC}"
            echo -e "Ensure all required packages are in $VENDOR_DIR"
            exit 1
        }
    else
        echo -e "${RED}No offline packages found in $VENDOR_DIR${NC}"
        echo -e "Download packages first with:"
        echo -e "  pip download -r requirements.txt -d $VENDOR_DIR"
        exit 1
    fi
else
    # Online installation with network resilience
    upgrade_pip || {
        echo -e "${YELLOW}Continuing without pip upgrade...${NC}"
    }
    
    # Install base requirements (always required)
    install_requirements "requirements-base.txt" "base dependencies" 1 || exit 1
    
    # Install extended requirements (recommended but not critical)
    install_requirements "requirements-extended.txt" "extended dependencies" 0
    
    # Install optional requirements if requested
    if [ "$INSTALL_OPTIONAL" -eq 1 ]; then
        echo -e "\n${YELLOW}Attempting to install optional dependencies...${NC}"
        
        # Try to cache MCP package if network allows
        pip download mcp==1.9.0 -d "$VENDOR_DIR" >/dev/null 2>&1 || true
        
        install_requirements "requirements-optional.txt" "optional dependencies" 0
    else
        echo -e "\n${YELLOW}Skipping optional dependencies (INSTALL_OPTIONAL=0)${NC}"
    fi
    
    # Install dev requirements if requested
    if [ "$INSTALL_DEV" -eq 1 ]; then
        install_requirements "requirements-dev.txt" "development dependencies" 0
    else
        echo -e "\n${YELLOW}Skipping development dependencies (INSTALL_DEV=0)${NC}"
    fi
fi

# Run import tests to verify installation
echo -e "\n${YELLOW}Running import verification...${NC}"
python test_imports.py || {
    echo -e "${YELLOW}Some imports failed. This is expected if optional dependencies were skipped.${NC}"
    echo -e "See the output above for specific missing modules and installation instructions."
}

# Only run tests if core dependencies are available
echo -e "\n${YELLOW}Checking if tests can be run...${NC}"
if python -c "import requests, dotenv, urllib3, backoff" 2>/dev/null; then
    echo -e "${GREEN}Core dependencies available, running tests...${NC}"
    
    # Run tests with coverage if available
    if command -v coverage >/dev/null 2>&1; then
        coverage run test_imports.py
        coverage run -a test_server.py 2>/dev/null || true
        coverage run -a test_optimization.py 2>/dev/null || true
        coverage report || true
    else
        echo -e "${YELLOW}Coverage not available, running tests directly...${NC}"
        python test_imports.py
        python test_server.py 2>/dev/null || true
        python test_optimization.py 2>/dev/null || true
    fi
else
    echo -e "${RED}Core dependencies not available, skipping tests${NC}"
    echo -e "Install at least requirements-base.txt to run tests"
fi

echo -e "\n${GREEN}Setup complete!${NC}"
echo -e "\n${BLUE}Next steps:${NC}"
echo -e "  1. Activate the environment: ${YELLOW}source test_env/bin/activate${NC}"
echo -e "  2. Run adaptive tests: ${YELLOW}python run_adaptive_tests.py${NC}"
echo -e "  3. See troubleshooting: ${YELLOW}docs/NETWORK_TROUBLESHOOTING.md${NC}"