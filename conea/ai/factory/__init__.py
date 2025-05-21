"""
Factory for creating AI provider instances
"""

from conea.ai.providers import OpenAIProvider, ClaudeProvider, GeminiProvider

class AIProviderFactory:
    """Factory for creating AI provider instances"""
    
    def get_provider(self, provider_name):
        """Get provider instance by name
        
        Args:
            provider_name (str): Name of the provider (openai, claude, gemini)
            
        Returns:
            Provider instance
            
        Raises:
            ValueError: If provider_name is not supported
        """
        if provider_name == "openai":
            return OpenAIProvider()
        elif provider_name == "claude":
            return ClaudeProvider()
        elif provider_name == "gemini":
            return GeminiProvider()
        else:
            raise ValueError(f"Unsupported provider: {provider_name}")