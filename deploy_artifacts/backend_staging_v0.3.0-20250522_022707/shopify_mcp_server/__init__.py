"""
Backward compatibility module for shopify_mcp_server

This module is deprecated and will be removed in a future version.
Please use the 'conea' package instead.
"""

import warnings
import importlib.util
import sys

# Display deprecation warning
warnings.warn(
    "The 'shopify_mcp_server' package is deprecated. Use 'conea' instead.",
    DeprecationWarning,
    stacklevel=2
)

# Forward all imports to conea
# This allows code that imports from shopify_mcp_server to continue working
if importlib.util.find_spec("conea") is not None:
    from conea import *  # noqa: F403
else:
    raise ImportError(
        "Could not import 'conea' package. "
        "Make sure it is installed correctly."
    )