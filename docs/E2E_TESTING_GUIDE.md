# End-to-End Testing Guide

This guide explains how to run the Playwright based E2E tests and how to interpret the results.

## Prerequisites

- Python 3.10+
- All dependencies from `requirements.txt` and `requirements-dev.txt`
- Google Chrome/Chromium dependencies (installed automatically via `playwright install`)

## Test Data

Use the utility script to generate mock data and a test database:

```bash
python scripts/generate_mock_data.py
```
This creates `tests/e2e/test_data.sqlite` with sample users using a fixed seed for reproducibility.
Call `cleanup()` from the same module to remove the database when finished.

## Running Tests Locally

Set the base URL of the running server and execute the tests using the helper script:

```bash
export E2E_BASE_URL=http://localhost:8000
python run_e2e_tests.py
```

If Playwright or `E2E_BASE_URL` is not available the tests are skipped.

## CI Integration

GitHub Actions runs the workflow defined in `.github/workflows/e2e.yml`. The workflow installs dependencies, runs Playwright tests and uploads `e2e-report.html` as an artifact.

## Viewing Results

After the workflow completes, download the `e2e-report` artifact from the Actions page. Open `e2e-report.html` in a browser to see a detailed report of each test step.
