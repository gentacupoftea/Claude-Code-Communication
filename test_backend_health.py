"""Test backend health and login"""
import http.client
import json

# Test health endpoint
conn = http.client.HTTPConnection("localhost", 8000)
conn.request("GET", "/health")
response = conn.getresponse()
print(f"Health check: {response.status} - {response.read().decode()}")
conn.close()

# Test login endpoint with form data
conn = http.client.HTTPConnection("localhost", 8000)
headers = {'Content-Type': 'application/x-www-form-urlencoded'}
params = 'username=demo@example.com&password=demo1234'
conn.request("POST", "/api/v1/auth/login", params, headers)
response = conn.getresponse()
print(f"Login test: {response.status}")
print(f"Response: {response.read().decode()}")
conn.close()