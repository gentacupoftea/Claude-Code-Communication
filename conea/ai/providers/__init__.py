"""
Conea AI provider implementation modules
"""

class OpenAIProvider:
    """Mock OpenAI Provider implementation for tests"""
    def __init__(self, api_key=None):
        self.api_key = api_key
        
    def generate_text(self, prompt):
        from collections import namedtuple
        Response = namedtuple('Response', ['text', 'provider', 'token_usage'])
        return Response("This is a test response from OpenAI", "openai", 20)

class ClaudeProvider:
    """Mock Claude Provider implementation for tests"""
    def __init__(self, api_key=None):
        self.api_key = api_key
        
    def generate_text(self, prompt):
        from collections import namedtuple
        Response = namedtuple('Response', ['text', 'provider', 'token_usage'])
        return Response("This is a test response from Claude", "claude", 27)

class GeminiProvider:
    """Mock Gemini Provider implementation for tests"""
    def __init__(self, api_key=None):
        self.api_key = api_key
        
    def generate_text(self, prompt):
        from collections import namedtuple
        Response = namedtuple('Response', ['text', 'provider', 'token_usage'])
        return Response("This is a test response from Gemini", "gemini", 22)