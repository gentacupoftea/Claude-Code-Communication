#!/usr/bin/env python3
"""Simple wrapper to execute Playwright based end-to-end tests."""

import os
import subprocess
import sys


def ensure_pytest() -> bool:
    """Return True if pytest is available, otherwise print help."""
    try:
        import pytest  # noqa: F401
    except Exception:
        print("pytest is not installed. Please install requirements-dev.txt")
        return False
    return True


def main() -> int:
    base_url = os.environ.get("E2E_BASE_URL")
    if not base_url:
        print("E2E_BASE_URL not set, skipping E2E tests")
        return 0

    if not ensure_pytest():
        return 1

    cmd = [sys.executable, "-m", "pytest", "tests/e2e", "-v"] + sys.argv[1:]
    return subprocess.call(cmd)


if __name__ == "__main__":
    raise SystemExit(main())

