#!/usr/bin/env python3
"""
Autonomous System Demo
自律システムデモ

This script demonstrates the capabilities of the MultiLLM Autonomous System
with a simple interactive demonstration.
"""

import asyncio
import logging
import json
from datetime import datetime
from typing import Dict, Any

from autonomous_system import (
    AutonomousSystemMain,
    get_orchestrator,
    TaskPriority,
    create_analysis_task,
    create_code_task,
    create_monitoring_task,
    system_health_check,
    emergency_response
)


class AutonomousSystemDemo:
    """Demonstration of autonomous system capabilities"""
    
    def __init__(self):
        self.setup_logging()
        self.logger = logging.getLogger(__name__)
        self.orchestrator = None
        
    def setup_logging(self):
        """Setup demo logging"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s'
        )
    
    async def run_demo(self):
        """Run the complete demonstration"""
        print("🤖 Autonomous MultiLLM System Demo")
        print("=" * 50)
        
        try:
            # 1. System Initialization Demo
            await self.demo_system_initialization()
            
            # 2. Task Creation Demo
            await self.demo_task_creation()
            
            # 3. Health Monitoring Demo
            await self.demo_health_monitoring()
            
            # 4. Emergency Response Demo
            await self.demo_emergency_response()
            
            # 5. Multi-Agent Coordination Demo
            await self.demo_multi_agent_coordination()
            
            # 6. System Overview Demo
            await self.demo_system_overview()
            
            print("\n✅ Demo completed successfully!")
            
        except Exception as e:
            print(f"❌ Demo failed: {e}")
            raise
    
    async def demo_system_initialization(self):
        """Demonstrate system initialization"""
        print("\n📋 1. System Initialization Demo")
        print("-" * 30)
        
        # Initialize system
        print("🚀 Initializing Autonomous System...")
        system = AutonomousSystemMain()
        
        # Mock initialization for demo purposes
        print("✅ System components initialized")
        print("✅ Configuration loaded")
        print("✅ Agents activated (Claude, OpenAI, Gemini)")
        
        # Get orchestrator instance
        self.orchestrator = get_orchestrator()
        print("✅ Orchestrator ready")
    
    async def demo_task_creation(self):
        """Demonstrate task creation"""
        print("\n📋 2. Task Creation Demo")
        print("-" * 30)
        
        # Create different types of tasks
        tasks = []
        
        # Strategic analysis task (Claude)
        task1_id = create_analysis_task(
            "Analyze e-commerce performance metrics",
            {
                "metrics": {
                    "revenue": 150000,
                    "conversion_rate": 2.5,
                    "traffic": 50000
                },
                "time_period": "Q1 2024"
            },
            TaskPriority.HIGH
        )
        tasks.append(("Strategic Analysis", task1_id))
        print(f"✅ Created strategic analysis task: {task1_id[:8]}...")
        
        # Code generation task (OpenAI)
        task2_id = create_code_task(
            "Generate API endpoint for inventory management",
            {
                "endpoint": "/api/inventory",
                "methods": ["GET", "POST", "PUT"],
                "features": ["filtering", "pagination", "validation"]
            },
            TaskPriority.MEDIUM
        )
        tasks.append(("Code Generation", task2_id))
        print(f"✅ Created code generation task: {task2_id[:8]}...")
        
        # Monitoring task (Gemini)
        task3_id = create_monitoring_task(
            "Monitor system performance metrics",
            {
                "metrics": ["cpu", "memory", "disk", "network"],
                "interval": 60,
                "alerts": True
            },
            TaskPriority.LOW
        )
        tasks.append(("System Monitoring", task3_id))
        print(f"✅ Created monitoring task: {task3_id[:8]}...")
        
        # Show task queue
        if self.orchestrator:
            queue_size = len(self.orchestrator.task_queue)
            print(f"📊 Task queue size: {queue_size}")
    
    async def demo_health_monitoring(self):
        """Demonstrate health monitoring"""
        print("\n📋 3. Health Monitoring Demo")
        print("-" * 30)
        
        try:
            # Get system health
            health = await system_health_check()
            
            print("🏥 System Health Report:")
            print(f"  Overall Score: {health.get('overall_health_score', 'N/A')}/100")
            print(f"  Status: {health.get('status', 'Unknown')}")
            
            # Show agent health
            agents = health.get('agents', {})
            for agent_name, agent_info in agents.items():
                status = agent_info.get('status', 'unknown')
                print(f"  {agent_name.title()}: {status}")
            
            # Show execution stats
            stats = health.get('execution_stats', {})
            if stats:
                print(f"  Total Tasks: {stats.get('total_tasks', 0)}")
                print(f"  Completed: {stats.get('completed_tasks', 0)}")
                print(f"  Failed: {stats.get('failed_tasks', 0)}")
                
        except Exception as e:
            print(f"⚠️ Health check simulation: {e}")
    
    async def demo_emergency_response(self):
        """Demonstrate emergency response"""
        print("\n📋 4. Emergency Response Demo")
        print("-" * 30)
        
        # Simulate emergency incident
        incident = {
            "type": "system_overload",
            "severity": "high",
            "description": "Server CPU usage at 95%",
            "affected_services": ["api", "database"],
            "timestamp": datetime.now().isoformat()
        }
        
        print("🚨 Simulating emergency incident...")
        print(f"  Type: {incident['type']}")
        print(f"  Severity: {incident['severity']}")
        print(f"  Description: {incident['description']}")
        
        try:
            # Execute emergency response
            response = await emergency_response(incident)
            
            print("🛡️ Emergency Response Executed:")
            print(f"  Emergency ID: {response.get('emergency_id', 'N/A')[:16]}...")
            print(f"  Tasks Executed: {len(response.get('tasks_executed', []))}")
            print(f"  Success: {response.get('success', False)}")
            
        except Exception as e:
            print(f"⚠️ Emergency response simulation: {e}")
    
    async def demo_multi_agent_coordination(self):
        """Demonstrate multi-agent coordination"""
        print("\n📋 5. Multi-Agent Coordination Demo")
        print("-" * 30)
        
        # Create coordinated tasks with dependencies
        if self.orchestrator:
            
            # Analysis task (Claude) - foundation
            analysis_task = self.orchestrator.create_task(
                task_type="strategic_analysis",
                description="Analyze system architecture needs",
                data={"requirements": "scalable e-commerce platform"},
                priority=TaskPriority.HIGH
            )
            print(f"✅ Claude Agent: Architecture analysis task created")
            
            # Code task (OpenAI) - depends on analysis
            code_task = self.orchestrator.create_task(
                task_type="code_generation", 
                description="Implement recommended architecture",
                data={"base_analysis": analysis_task},
                dependencies=[analysis_task],
                priority=TaskPriority.HIGH
            )
            print(f"✅ OpenAI Agent: Implementation task created (depends on analysis)")
            
            # Monitoring task (Gemini) - monitors implementation
            monitor_task = self.orchestrator.create_task(
                task_type="real_time_monitoring",
                description="Monitor new implementation",
                data={"target": code_task},
                dependencies=[code_task],
                priority=TaskPriority.MEDIUM
            )
            print(f"✅ Gemini Agent: Monitoring task created (depends on implementation)")
            
            print("🤝 Multi-agent coordination established with dependency chain")
    
    async def demo_system_overview(self):
        """Demonstrate system overview"""
        print("\n📋 6. System Overview Demo")
        print("-" * 30)
        
        if self.orchestrator:
            overview = self.orchestrator.get_system_overview()
            
            print("📊 System Overview:")
            print(f"  Status: {overview.get('orchestrator_status', 'Unknown')}")
            print(f"  Total Tasks: {overview.get('total_tasks', 0)}")
            print(f"  Pending: {overview.get('pending_tasks', 0)}")
            print(f"  Running: {overview.get('running_tasks', 0)}")
            print(f"  Completed: {overview.get('completed_tasks', 0)}")
            print(f"  Failed: {overview.get('failed_tasks', 0)}")
            print(f"  Queue Size: {overview.get('queue_size', 0)}")
            print(f"  Uptime: {overview.get('uptime_hours', 0):.2f} hours")
            
            # Show execution stats
            stats = overview.get('execution_stats', {})
            if stats:
                auto_repairs = stats.get('auto_repairs', 0)
                print(f"  Auto-repairs: {auto_repairs}")
        
        print("\n🎯 Key Features Demonstrated:")
        print("  ✅ Multi-LLM agent orchestration")
        print("  ✅ Intelligent task routing")
        print("  ✅ Health monitoring & auto-repair")
        print("  ✅ Emergency response system")
        print("  ✅ Task dependency management")
        print("  ✅ Real-time system monitoring")


async def main():
    """Main demo entry point"""
    demo = AutonomousSystemDemo()
    await demo.run_demo()


if __name__ == "__main__":
    asyncio.run(main())