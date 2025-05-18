"""Test login with new user"""
import http.client
import json

# Test login endpoint with new user
conn = http.client.HTTPConnection("localhost", 8000)
headers = {'Content-Type': 'application/x-www-form-urlencoded'}
params = 'username=test@example.com&password=test1234'
conn.request("POST", "/api/v1/auth/login", params, headers)
response = conn.getresponse()
print(f"Login test: {response.status}")
response_body = response.read().decode()
print(f"Response: {response_body}")

# If successful, parse token
if response.status == 200:
    data = json.loads(response_body)
    print(f"Access token: {data.get('access_token')[:50]}...")
    print("Login successful!")
else:
    print("Login failed!")
    
conn.close()