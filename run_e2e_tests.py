#!/usr/bin/env python3
"""Simple E2E test runner using pytest and Playwright."""

import os
import subprocess
import sys


def validate_environment() -> None:
    """Ensure required environment variables are set."""
    required_vars = ["E2E_BASE_URL", "PLAYWRIGHT_BROWSERS_PATH"]
    missing = [var for var in required_vars if not os.getenv(var)]
    if missing:
        raise EnvironmentError(
            f"Missing required environment variables: {', '.join(missing)}"
        )


def main():
    try:
        validate_environment()
    except EnvironmentError as exc:
        print(exc)
        sys.exit(1)

    try:
        subprocess.run([sys.executable, "-m", "pytest", "--version"], check=True)
    except FileNotFoundError:
        print("pytest not found. Installing required dependencies...")
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "pytest", "pytest-playwright"],
            check=True,
        )

    cmd = [
        sys.executable,
        "-m",
        "pytest",
        "tests/e2e",
        "-v",
        "--html=playwright-report/report.html",
        "--self-contained-html",
    ]
    try:
        subprocess.run(cmd, check=True)
    except subprocess.CalledProcessError as exc:
        print("E2E tests failed", exc)
        sys.exit(exc.returncode)


if __name__ == "__main__":
    main()
