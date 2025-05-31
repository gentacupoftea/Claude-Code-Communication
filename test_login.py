"""
Test login with demo credentials
"""
import requests

# Test login
url = "http://localhost:8000/api/v1/auth/login"
data = {
    "username": "demo@example.com",
    "password": "demo1234"
}

try:
    response = requests.post(url, data=data)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
    
    if response.status_code == 200:
        print("Login successful!")
    else:
        print("Login failed!")
        
except Exception as e:
    print(f"Error: {str(e)}")