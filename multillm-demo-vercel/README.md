# MultiLLM Cloud System Demo

This is a demonstration of the MultiLLM Cloud System that manages multiple LLM providers (OpenAI, Anthropic, Google AI) with intelligent selection strategies.

## Features

- 🤖 Multi-provider support (OpenAI, Anthropic, Google AI)
- 🎯 Three selection strategies (Quality First, Cost Optimization, Speed First)
- 📊 Real-time health monitoring
- 🧪 Live API testing interface
- 🔐 Secure API key management

## Live Demo

Visit the [MultiLLM Demo Page](./index.html) to see the system in action.

## API Endpoints

- `GET /api/llm/health` - System health check
- `POST /api/llm/generate` - Generate response
- `POST /api/llm/stream` - Streaming response
- `GET /api/llm/providers` - List available providers
- `GET /api/llm/strategies` - List available strategies

## Backend API

The backend API is deployed at: https://shopify-mcp-server-staging-259335331171.asia-northeast1.run.app

## Configuration

To use the system with your own API keys:

1. Navigate to the Conea admin panel
2. Go to Settings → API Settings → MultiLLM tab
3. Enter your API keys for each provider
4. Test the connections

Note: In production environments, environment variables should be updated through Cloud Run console.