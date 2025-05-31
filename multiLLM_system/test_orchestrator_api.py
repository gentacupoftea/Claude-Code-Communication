"""
Test script for Orchestrator API
"""

import asyncio
import json
import httpx

async def test_orchestrator_api():
    base_url = "http://localhost:8000"
    
    print("🧪 Testing Orchestrator API...")
    
    async with httpx.AsyncClient() as client:
        # Test health endpoint
        print("\n1. Testing health endpoint...")
        try:
            response = await client.get(f"{base_url}/health")
            print(f"   Status: {response.status_code}")
            print(f"   Response: {json.dumps(response.json(), indent=2)}")
        except Exception as e:
            print(f"   ❌ Error: {e}")
            return
        
        # Test workers endpoint
        print("\n2. Testing workers endpoint...")
        try:
            response = await client.get(f"{base_url}/api/workers")
            print(f"   Status: {response.status_code}")
            print(f"   Workers: {json.dumps(response.json(), indent=2)}")
        except Exception as e:
            print(f"   ❌ Error: {e}")
        
        # Test chat endpoint with streaming
        print("\n3. Testing chat endpoint (streaming)...")
        try:
            async with client.stream(
                "POST",
                f"{base_url}/api/chat",
                json={
                    "content": "Hello, can you help me with a coding task?",
                    "context": {"projectId": "test_project"},
                    "user_id": "test_user",
                    "include_thinking": True
                },
                timeout=30.0
            ) as response:
                print(f"   Status: {response.status_code}")
                print("   Streaming response:")
                
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        try:
                            event = json.loads(line[6:])
                            if event["type"] == "thinking":
                                print(f"   🤔 {event['data']['stage']}")
                            elif event["type"] == "chunk":
                                print(f"   📝 {event['data']['content']}", end="", flush=True)
                            elif event["type"] == "complete":
                                print("\n   ✅ Stream complete")
                        except json.JSONDecodeError:
                            pass
        except Exception as e:
            print(f"   ❌ Error: {e}")
    
    print("\n✨ Test complete!")

if __name__ == "__main__":
    asyncio.run(test_orchestrator_api())