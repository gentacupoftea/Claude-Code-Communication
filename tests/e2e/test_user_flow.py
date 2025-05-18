import os
import pytest

# Skip entire module if playwright is not installed or base URL is missing
try:
    from playwright.sync_api import sync_playwright
except Exception:  # ImportError or others
    pytest.skip("Playwright not available", allow_module_level=True)

BASE_URL = os.environ.get("E2E_BASE_URL")
if not BASE_URL:
    pytest.skip("E2E_BASE_URL not set", allow_module_level=True)


def test_user_registration_login_logout():
    """Simulate user registration, login and logout flow."""
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()

        # Registration
        page.goto(f"{BASE_URL}/register")
        page.fill("input[name='email']", "test@example.com")
        page.fill("input[name='password']", "password123")
        page.click("text=Register")
        page.wait_for_url(f"{BASE_URL}/login")

        # Login
        page.fill("input[name='email']", "test@example.com")
        page.fill("input[name='password']", "password123")
        page.click("text=Login")
        page.wait_for_url(f"{BASE_URL}/dashboard")

        # Logout
        page.click("text=Logout")
        page.wait_for_url(f"{BASE_URL}/login")
        browser.close()


def test_google_analytics_display():
    """Verify Google Analytics data retrieval and display."""
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(f"{BASE_URL}/dashboard")
        page.click("text=Refresh Analytics")
        page.wait_for_selector("#ga-chart")
        browser.close()


def test_dashboard_basic_operations():
    """Test basic dashboard interactions."""
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(f"{BASE_URL}/dashboard")
        page.click("text=Open Orders")
        page.wait_for_selector("#orders-table")
        browser.close()


def test_settings_profile_management():
    """Test updating settings and profile management."""
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(f"{BASE_URL}/settings")
        page.fill("input[name='display_name']", "Test User")
        page.click("text=Save")
        page.wait_for_selector("text=Settings saved")
        browser.close()
