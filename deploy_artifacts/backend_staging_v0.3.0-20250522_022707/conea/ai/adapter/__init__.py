"""
Adapter for AI provider standardization
"""

class BaseAIAdapter:
    """Base adapter for AI providers"""
    
    def generate_with_fallback(self, prompt, providers):
        """Generate text with fallback to other providers
        
        Args:
            prompt (str): Text prompt
            providers (list): List of provider names to try
            
        Returns:
            Response object
        """
        from conea.ai.factory import AIProviderFactory
        factory = AIProviderFactory()
        
        for provider_name in providers:
            try:
                provider = factory.get_provider(provider_name)
                return provider.generate_text(prompt)
            except Exception:
                continue
                
        raise ValueError("All providers failed")
    
    def check_token_limit(self, provider, model, tokens):
        """Check if tokens are within limit for provider and model
        
        Args:
            provider (str): Provider name
            model (str): Model name
            tokens (int): Number of tokens
            
        Returns:
            bool: True if within limits
        """
        limits = {
            "openai": {"gpt-4": 8192, "gpt-3.5-turbo": 4096},
            "claude": {"claude-3-sonnet": 100000, "claude-3-haiku": 200000},
            "gemini": {"gemini-1.0-pro": 32768}
        }
        
        if provider in limits and model in limits[provider]:
            return tokens <= limits[provider][model]
        
        return False