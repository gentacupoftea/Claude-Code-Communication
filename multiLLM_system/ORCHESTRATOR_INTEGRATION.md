# MultiLLM Orchestrator Integration Guide

This guide explains how to integrate the MultiLLM Orchestrator with the chat interface.

## Architecture Overview

The integration consists of three main components:

1. **Orchestrator API Server** (`orchestrator/api_server.py`)
   - FastAPI-based HTTP server
   - Provides streaming chat endpoint
   - Manages Worker LLMs
   - Handles task distribution

2. **Orchestrator Chat Service** (`ui/src/services/orchestratorChatService.ts`)
   - TypeScript service for the frontend
   - Handles Server-Sent Events (SSE) streaming
   - Manages chat history
   - Provides thinking process updates

3. **React Chat Component** (`ui/src/components/RealtimeChat/RealtimeChatOrchestrator.tsx`)
   - Real-time chat UI
   - Displays thinking process
   - Shows streaming responses
   - Indicates Orchestrator status

## Setup Instructions

### 1. Start the Orchestrator API Server

```bash
cd multiLLM_system
./start_orchestrator.sh
```

The server will start on `http://localhost:8000` by default.

### 2. Configure the Frontend

The frontend automatically connects to `http://localhost:8000`. To use a different URL:

```bash
export REACT_APP_ORCHESTRATOR_API_URL=https://your-orchestrator-api.com
```

### 3. Start the UI Development Server

```bash
cd ui
npm install
npm start
```

## API Endpoints

### Health Check
```
GET /health
```
Returns the health status of the Orchestrator and connected Workers.

### Chat Endpoint (Streaming)
```
POST /api/chat
Content-Type: application/json

{
  "content": "Your message here",
  "context": {
    "projectId": "optional",
    "taskId": "optional"
  },
  "user_id": "optional",
  "include_thinking": true
}
```

Returns Server-Sent Events stream with:
- Thinking updates
- Message chunks
- Completion signals

### Get Status
```
GET /api/status
```
Returns current Orchestrator status including active tasks and worker states.

### Get Workers
```
GET /api/workers
```
Returns list of available Worker LLMs and their capabilities.

## Features

### 1. Streaming Responses
The system uses Server-Sent Events (SSE) to stream AI responses in real-time, providing a more interactive experience.

### 2. Thinking Process Visualization
When enabled, the system shows:
- Task analysis stages
- Worker selection process
- Processing steps
- Time taken for each step

### 3. Multi-Worker Support
The Orchestrator can distribute tasks to specialized Workers:
- `backend_worker`: Code implementation, APIs
- `frontend_worker`: UI/UX, React development
- `documentation_worker`: Documentation, explanations
- `review_worker`: Code reviews, analysis
- `analytics_worker`: Data analysis, statistics
- `creative_worker`: Image generation, creative tasks

### 4. Context Awareness
The system maintains context through:
- Project ID
- Task ID
- Conversation history
- User preferences

## Usage in Chat UI

1. Navigate to the Chat page
2. Toggle between "Demo (Firebase)" and "AI (Orchestrator)" modes
3. Type your message and press Enter
4. Watch the thinking process (collapsible)
5. See the streaming response

## Troubleshooting

### Orchestrator Not Connected
- Check if the API server is running: `curl http://localhost:8000/health`
- Verify no firewall blocking port 8000
- Check server logs for errors

### No Response from Workers
- Ensure Worker configurations are correct in `api_server.py`
- Check if required API keys are set (for OpenAI, Anthropic, etc.)
- Review server logs for Worker initialization errors

### Streaming Not Working
- Verify CORS settings in `api_server.py`
- Check browser console for SSE errors
- Ensure no proxy is buffering the response

## Development Tips

### Adding New Workers
1. Define Worker in Orchestrator config
2. Add task routing rules
3. Implement Worker class (if needed)
4. Update task type detection keywords

### Customizing Thinking Display
Edit `RealtimeChatOrchestrator.tsx` to modify:
- Thinking process icons
- Animation styles
- Collapse behavior
- Step formatting

### Extending Chat Context
Add fields to context object:
```typescript
context: {
  projectId: string;
  taskId: string;
  // Add custom fields
  department?: string;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
}
```

## Production Deployment

1. Set production environment variables
2. Configure proper CORS origins
3. Use HTTPS for secure communication
4. Implement authentication/authorization
5. Set up monitoring and logging
6. Configure load balancing for multiple instances

## Next Steps

1. Implement actual Worker LLMs (currently using demo responses)
2. Add Redis for distributed caching
3. Implement user authentication
4. Add conversation persistence
5. Create Worker health monitoring
6. Add rate limiting and quotas