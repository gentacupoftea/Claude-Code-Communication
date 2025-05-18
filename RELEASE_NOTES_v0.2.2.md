# Release Notes - v0.2.2

## Python Version Requirement Correction

**Release Date:** January 18, 2025  
**Status:** Correct Python Version

## 🔧 Technical Corrections

### Restored Correct Python Version Requirement  
- **Issue:** v0.2.1 incorrectly lowered the Python requirement to 3.10+
- **Reality:** MCP package actually requires Python 3.12+ to function properly
- **Solution:** Restored python_requires to ">=3.12" to match actual dependencies

## 📦 Installation

```bash
pip install shopify-mcp-server==0.2.2
```

## ⚙️ Requirements

- Python 3.12 or higher is required
- This is due to MCP package dependencies, not our code

## 🐍 Python Version Information

The project requires Python 3.12+ because:
1. The MCP (Model Context Protocol) package requires Python 3.12+
2. Our code leverages features that depend on this version
3. Testing has been done exclusively on Python 3.12+

## 📝 Installation Guidance

If you don't have Python 3.12+:

1. **Using pyenv (Recommended)**
   ```bash
   pyenv install 3.12
   pyenv local 3.12
   pip install shopify-mcp-server==0.2.2
   ```

2. **Using Docker**
   ```bash
   docker run -it python:3.12 bash
   pip install shopify-mcp-server==0.2.2
   ```

3. **System Python**
   - macOS: `brew install python@3.12`
   - Ubuntu: `sudo apt install python3.12`
   - Windows: Download from python.org

## ✅ Verified Compatibility

- Python 3.12+
- MCP 1.9.0
- All GraphQL features intact

## 📞 Support

For issues or questions, please open an issue on GitHub:
https://github.com/mourigenta/shopify-mcp-server/issues