"""Test CORS and API access"""
import http.client
import json

# Test from frontend origin
conn = http.client.HTTPConnection("localhost", 8000)
headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Origin': 'http://localhost:3001',
}
params = 'username=test@example.com&password=test1234'

conn.request("POST", "/api/v1/auth/login", params, headers)
response = conn.getresponse()
print(f"Login test: {response.status}")
headers = response.headers
print(f"CORS headers: {headers.get('Access-Control-Allow-Origin')}")
response_body = response.read().decode()
print(f"Response: {response_body}")
conn.close()

# Check if we get CORS headers
print("\nChecking preflight request:")
conn = http.client.HTTPConnection("localhost", 8000)
headers = {
    'Origin': 'http://localhost:3001',
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'content-type'
}
conn.request("OPTIONS", "/api/v1/auth/login", headers=headers)
response = conn.getresponse()
print(f"Options status: {response.status}")
print(f"CORS headers: {response.headers}")
conn.close()