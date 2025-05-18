# Release Notes - v0.2.1

## Emergency Patch Release

**Release Date:** January 18, 2025  
**Status:** Critical Fix

## 🐛 Bug Fixes

### Fixed Critical Python Version Requirement
- **Issue:** v0.2.0 incorrectly required Python 3.12+ instead of Python 3.10+
- **Impact:** Installation failed for users with Python 3.10 or 3.11
- **Solution:** Corrected python_requires to ">=3.10" to match MCP package requirements

## 📦 Installation

```bash
pip install shopify-mcp-server==0.2.1
```

## ⚠️ Migration from v0.2.0

If you encountered installation issues with v0.2.0:

1. Uninstall the previous version (if installed):
   ```bash
   pip uninstall shopify-mcp-server
   ```

2. Install the corrected version:
   ```bash
   pip install shopify-mcp-server==0.2.1
   ```

## 🔧 Workarounds for v0.2.0

If you still need to use v0.2.0, these workarounds are available:

1. **Docker Container** (Recommended)
   ```bash
   docker run -it python:3.12 bash
   pip install shopify-mcp-server==0.2.0
   ```

2. **Pyenv**
   ```bash
   pyenv install 3.12
   pyenv local 3.12
   pip install shopify-mcp-server==0.2.0
   ```

## 📝 Changes from v0.2.0

- Updated setup.py: `python_requires=">=3.10"`
- Updated version to 0.2.1
- No other code changes - this is purely a packaging fix

## ✅ Verified Compatibility

- Python 3.10+
- MCP 1.9.0
- All Phase 3 GraphQL features remain intact

## 🙏 Acknowledgments

Thank you to the users who reported the installation issue. We apologize for any inconvenience caused by the v0.2.0 release.

## 📞 Support

For issues or questions, please open an issue on GitHub:
https://github.com/mourigenta/shopify-mcp-server/issues