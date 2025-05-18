from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="shopify-mcp-server",
    version="0.2.0",
    author="Mourigenta",
    description="A MCP server for Shopify API integration with Claude Desktop",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/mourigenta/shopify-mcp-server",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.12",
    install_requires=[
        "mcp>=1.9.0",
        "requests",
        "pandas",
        "matplotlib",
        "python-dotenv",
        "urllib3",
    ],
    entry_points={
        "console_scripts": [
            "shopify-mcp-server=shopify_mcp_server:main",
        ],
    },
)