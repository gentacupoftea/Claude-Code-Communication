# Autonomous MultiLLM System

A comprehensive autonomous system for managing multiple LLM agents with intelligent orchestration, real-time monitoring, and automatic error recovery.

## 🚀 Features

- **Multi-LLM Orchestration**: Coordinates Claude, OpenAI, and Gemini agents
- **Intelligent Task Routing**: Automatically assigns tasks to the most suitable agent
- **Real-time Monitoring**: Continuous health checks and performance monitoring
- **Emergency Response**: Automatic incident detection and response
- **Auto-repair Capabilities**: Self-healing system with automatic error recovery
- **GitHub Integration**: Automated GitHub operations and repository management
- **Configuration Management**: Flexible configuration system
- **Comprehensive Logging**: Detailed logging and reporting

## 📁 Project Structure

```
autonomous_system/
├── main.py                    # Main entry point with CLI interface
├── __init__.py               # Package initialization and exports
├── orchestrator.py           # Central task orchestration
├── multi_llm_client.py       # Multi-LLM client interface
├── demo.py                   # Interactive demonstration
├── agents/                   # Specialized LLM agents
│   ├── claude_agent.py       # Claude analysis agent
│   ├── openai_agent.py       # OpenAI code agent
│   └── gemini_agent.py       # Gemini infrastructure agent
├── config/                   # Configuration management
│   └── config_manager.py
├── integrations/             # External integrations
│   └── github_integration.py
├── monitoring/               # System monitoring
│   ├── system_monitor.py
│   └── error_detector.py
└── tests/                    # Test suite
    └── test_integration.py
```

## 🛠 Installation

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Set Environment Variables**:
   ```bash
   export ANTHROPIC_API_KEY="your-claude-api-key"
   export OPENAI_API_KEY="your-openai-api-key"
   export GEMINI_API_KEY="your-gemini-api-key"
   ```

3. **Optional GitHub Integration**:
   ```bash
   export GITHUB_TOKEN="your-github-token"
   ```

## 🚀 Quick Start

### Option 1: Using the Main CLI

```bash
# Start the system
python autonomous_system/main.py

# With custom configuration
python autonomous_system/main.py --config config.yaml

# With debug logging
python autonomous_system/main.py --log-level DEBUG

# Validate environment only
python autonomous_system/main.py --validate-only

# Health check only
python autonomous_system/main.py --health-check
```

### Option 2: Using Startup Scripts

```bash
# Start with comprehensive validation
python scripts/start_autonomous_system.py

# Start with verbose output
python scripts/start_autonomous_system.py --verbose

# Graceful shutdown
python scripts/stop_autonomous_system.py

# Force shutdown without backup
python scripts/stop_autonomous_system.py --force --no-backup

# Emergency kill
python scripts/stop_autonomous_system.py --kill
```

### Option 3: Python API

```python
import asyncio
from autonomous_system import AutonomousSystemMain

async def main():
    # Initialize system
    system = AutonomousSystemMain()
    await system.initialize()
    
    # Start system
    await system.start()

asyncio.run(main())
```

### Option 4: Quick Start Function

```python
import asyncio
from autonomous_system import quick_start

async def main():
    system = await quick_start()
    await system.start()

asyncio.run(main())
```

## 🎯 Usage Examples

### Creating Tasks

```python
from autonomous_system import create_analysis_task, create_code_task, TaskPriority

# Strategic analysis (Claude)
task_id = create_analysis_task(
    "Analyze system performance",
    {"metrics": {"cpu": 80, "memory": 60}},
    TaskPriority.HIGH
)

# Code generation (OpenAI)
task_id = create_code_task(
    "Generate API endpoint",
    {"endpoint": "/api/users", "methods": ["GET", "POST"]},
    TaskPriority.MEDIUM
)
```

### Health Monitoring

```python
from autonomous_system import system_health_check

# Get system health
health = await system_health_check()
print(f"Health Score: {health['overall_health_score']}/100")
```

### Emergency Response

```python
from autonomous_system import emergency_response

# Handle emergency
incident = {
    "type": "system_overload",
    "severity": "high",
    "description": "High CPU usage detected"
}

response = await emergency_response(incident)
print(f"Emergency handled: {response['success']}")
```

### Working with Orchestrator

```python
from autonomous_system import get_orchestrator

# Get orchestrator instance
orchestrator = get_orchestrator()

# Create task with dependencies
parent_task = orchestrator.create_task(
    task_type="strategic_analysis",
    description="Analyze requirements",
    data={"requirements": "scalable system"}
)

child_task = orchestrator.create_task(
    task_type="code_generation",
    description="Implement solution",
    data={"based_on": parent_task},
    dependencies=[parent_task]
)

# Get system overview
overview = orchestrator.get_system_overview()
print(f"Active tasks: {overview['running_tasks']}")
```

## 🤖 Agent Capabilities

### Claude Agent (Strategic Analysis)
- Strategic planning and analysis
- Quality reviews and assessments
- Incident coordination
- Architecture design
- Business intelligence

### OpenAI Agent (Code Operations)
- Code generation and fixes
- API integration development
- Automated test generation
- Code refactoring
- Bug diagnosis and resolution

### Gemini Agent (Infrastructure)
- Real-time system monitoring
- Cloud operations management
- Performance optimization
- Data processing optimization
- Infrastructure as Code

## 📊 Monitoring & Health Checks

The system provides comprehensive monitoring:

- **Health Scores**: 0-100 scale for system health
- **Agent Status**: Individual agent health monitoring
- **Task Metrics**: Execution statistics and performance
- **Resource Usage**: CPU, memory, and disk monitoring
- **Error Detection**: Automatic error pattern detection
- **Auto-repair**: Self-healing capabilities

## 🛡️ Emergency Response

The system includes automated emergency response:

1. **Incident Detection**: Automatic detection of system issues
2. **Analysis**: Claude agent analyzes the incident
3. **Response**: Appropriate agent executes fixes
4. **Monitoring**: Gemini agent monitors recovery
5. **Reporting**: Comprehensive incident reports

## 🔧 Configuration

### Default Configuration

```python
from autonomous_system import get_default_config

config = get_default_config()
print(config)
```

### Custom Configuration

```yaml
# config.yaml
orchestrator:
  max_concurrent_tasks: 5
  health_check_interval: 30
  auto_repair_enabled: true

llm_client:
  timeout: 60
  max_retries: 3
  rate_limit_per_minute: 100

monitoring:
  system_check_interval: 15
  error_detection_enabled: true
  performance_tracking: true
```

## 🧪 Testing

Run the test suite:

```bash
# Run all tests
pytest autonomous_system/tests/

# Run specific test
pytest autonomous_system/tests/test_integration.py -v

# Run with coverage
pytest autonomous_system/tests/ --cov=autonomous_system
```

## 🎮 Demo

Run the interactive demonstration:

```bash
python autonomous_system/demo.py
```

This will showcase:
- System initialization
- Task creation and routing
- Health monitoring
- Emergency response
- Multi-agent coordination

## 📋 Task Types

The system supports various task types:

### Analysis Tasks (Claude)
- `strategic_analysis`
- `quality_review`
- `incident_coordination`
- `architecture_design`
- `business_intelligence`

### Code Tasks (OpenAI)
- `code_generation`
- `bug_fixing`
- `api_integration`
- `test_generation`
- `refactoring`
- `bug_diagnosis`

### Infrastructure Tasks (Gemini)
- `real_time_monitoring`
- `cloud_operations`
- `performance_optimization`
- `data_processing`
- `infrastructure_management`

## 🔍 Debugging

Enable debug mode:

```python
from autonomous_system import debug_mode

debug_mode()  # Enable debug logging
```

View logs:

```bash
# View system logs
tail -f logs/autonomous_system.log

# View startup logs
tail -f logs/startup_*.log

# View shutdown logs
tail -f logs/shutdown_*.log
```

## 📊 System Reports

The system generates comprehensive reports:

- **Startup Reports**: Detailed startup validation and timing
- **Shutdown Reports**: Graceful shutdown status and cleanup
- **Health Reports**: Regular system health assessments
- **Performance Reports**: Task execution and system metrics
- **Emergency Reports**: Incident response and resolution

Reports are saved in the `logs/` directory with timestamps.

## 🚨 Troubleshooting

### Common Issues

1. **Missing API Keys**:
   ```bash
   python autonomous_system/main.py --validate-only
   ```

2. **Health Check Failures**:
   ```bash
   python autonomous_system/main.py --health-check
   ```

3. **Network Connectivity**:
   Check internet connection and API endpoints

4. **Permission Issues**:
   Ensure read/write permissions for logs and backups directories

5. **Resource Issues**:
   Monitor CPU and memory usage during operation

### Emergency Recovery

If the system becomes unresponsive:

```bash
# Force stop all processes
python scripts/stop_autonomous_system.py --kill

# Clean restart
python scripts/start_autonomous_system.py --verbose
```

## 🔄 Backup & Recovery

The system automatically creates backups during shutdown:

- **System State**: Current task status and configuration
- **Configuration**: All config files and settings
- **Logs**: Recent log files
- **Runtime Data**: System metrics and process information

Backups are stored in `backups/` with timestamps.

## 🌟 Advanced Features

### Custom Agents

Extend the system with custom agents:

```python
from autonomous_system.agents.base_agent import BaseAgent

class CustomAgent(BaseAgent):
    async def custom_task(self, data: dict) -> dict:
        # Your custom logic here
        return {"success": True, "result": "custom_result"}
```

### Custom Monitoring

Add custom monitoring:

```python
from autonomous_system.monitoring.system_monitor import SystemMonitor

class CustomMonitor(SystemMonitor):
    async def custom_check(self) -> dict:
        # Your custom monitoring logic
        return {"status": "healthy"}
```

## 📄 License

This project is part of the Shopify MCP Server project.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

---

For more information, see the main project documentation.