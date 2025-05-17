# Network Troubleshooting Guide

This guide provides solutions for common network-related issues when installing or running Shopify MCP Server in restricted network environments.

## Common Network Issues

### 1. Corporate Proxy/Firewall

Many corporate environments require proxy configuration for external connections.

**Solution:**
```bash
# Set proxy for pip
export PIP_PROXY=http://proxy.company.com:8080
export HTTPS_PROXY=http://proxy.company.com:8080

# Run setup with proxy
./setup_test_env.sh

# Or configure pip directly
pip config set global.proxy http://proxy.company.com:8080
```

### 2. Slow or Unstable Internet Connection

Network interruptions can cause installation failures.

**Solution:**
```bash
# Increase timeout and retry attempts
export INSTALL_TIMEOUT=300  # 5 minutes
export INSTALL_RETRY=10     # 10 retry attempts

./setup_test_env.sh
```

### 3. Blocked Package Repositories

Some networks block access to PyPI or other package repositories.

**Solution - Use Alternative Index:**
```bash
# Use a mirror or alternative index
pip install -i https://mirror.company.com/pypi/simple -r requirements.txt

# Or configure permanently
pip config set global.index-url https://mirror.company.com/pypi/simple
```

**Solution - Offline Installation:**
```bash
# On a machine with internet access:
pip download -r requirements.txt -d vendor/
pip download -r requirements-base.txt -d vendor/
pip download -r requirements-extended.txt -d vendor/

# Transfer vendor/ directory to target machine, then:
OFFLINE_MODE=1 ./setup_test_env.sh
```

### 4. SSL Certificate Verification Errors

Corporate networks may use custom SSL certificates.

**Solution:**
```bash
# Option 1: Add corporate certificate to pip
pip config set global.cert /path/to/corporate-cert.pem

# Option 2: Use trusted host (less secure)
pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org -r requirements.txt

# Option 3: Set environment variable
export PIP_TRUSTED_HOST="pypi.org files.pythonhosted.org"
```

## Installation Strategies

### Minimal Installation

For extremely restricted environments, install only core dependencies:

```bash
# Install only essential packages
INSTALL_OPTIONAL=0 INSTALL_DEV=0 ./setup_test_env.sh

# Or manually
pip install -r requirements-base.txt
```

### Staged Installation

Install dependencies in stages to identify problematic packages:

```bash
# Stage 1: Core dependencies
pip install requests python-dotenv urllib3 backoff

# Stage 2: Data processing
pip install pandas numpy

# Stage 3: Visualization
pip install matplotlib

# Stage 4: GraphQL
pip install gql requests-toolbelt
```

### Pre-download Strategy

Download all packages beforehand:

```bash
# Create a requirements directory
mkdir -p offline_packages

# Download all dependencies
pip download -r requirements.txt -d offline_packages/
pip download -r requirements-dev.txt -d offline_packages/

# Create a zip file for transfer
zip -r packages.zip offline_packages/

# On target machine:
unzip packages.zip
pip install --no-index --find-links=offline_packages/ -r requirements.txt
```

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `INSTALL_RETRY` | 3 | Number of retry attempts for failed installations |
| `INSTALL_TIMEOUT` | 120 | Timeout in seconds for each installation attempt |
| `INSTALL_RETRY_DISABLED` | 0 | Set to 1 to disable retries |
| `INSTALL_OPTIONAL` | 1 | Set to 0 to skip optional dependencies |
| `INSTALL_DEV` | 1 | Set to 0 to skip development dependencies |
| `OFFLINE_MODE` | 0 | Set to 1 for offline installation |
| `VENDOR_DIR` | vendor | Directory for offline packages |
| `PIP_PROXY` | "" | HTTP/HTTPS proxy URL |

## Diagnostic Commands

### Check Network Connectivity

```bash
# Test PyPI connectivity
curl -I https://pypi.org/simple/

# Test specific package
curl -I https://pypi.org/simple/requests/

# Check DNS resolution
nslookup pypi.org
```

### Verify Pip Configuration

```bash
# Show current pip configuration
pip config list

# Show pip version and location
pip --version

# List installed packages
pip list
```

### Test Import Availability

```bash
# Run import test with detailed output
python test_imports.py

# Test specific module
python -c "import requests; print(requests.__version__)"
```

## Advanced Solutions

### Using Docker

If direct installation fails, use Docker:

```bash
# Build Docker image with all dependencies
docker build -t shopify-mcp-server .

# Run in container
docker run -it shopify-mcp-server
```

### Creating a Portable Environment

Create a fully portable Python environment:

```bash
# On a machine with internet:
python -m venv portable_env
source portable_env/bin/activate
pip install -r requirements.txt

# Zip the entire environment
zip -r portable_env.zip portable_env/

# Transfer and extract on target machine
unzip portable_env.zip
source portable_env/bin/activate
```

### Using Conda

Conda can sometimes bypass network restrictions:

```bash
# Install Miniconda first
# Then use conda to install packages
conda create -n shopify-mcp python=3.10
conda activate shopify-mcp
conda install requests pandas matplotlib
```

## CI/CD Considerations

For CI/CD pipelines with network restrictions:

```yaml
# GitHub Actions example
env:
  PIP_TIMEOUT: 180
  PIP_RETRIES: 5
  PIP_TRUSTED_HOST: "pypi.org files.pythonhosted.org"
```

## Getting Help

If you continue to experience issues:

1. Check the detailed error messages in the setup logs
2. Run `python test_imports.py` for specific module issues
3. Consult your network administrator for proxy/firewall settings
4. Open an issue on GitHub with:
   - Your environment details
   - Error messages
   - Network configuration (sanitized)
   - Steps you've already tried

## Security Notes

- Always prefer using proper SSL certificates over `--trusted-host`
- Be cautious with proxy credentials in environment variables
- Validate packages downloaded offline before installation
- Keep dependency versions locked for security