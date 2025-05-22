#!/usr/bin/env python3
"""
Autonomous System Main Entry Point
マルチLLMエージェント自律システムのメインエントリーポイント

Usage:
    python -m autonomous_system.main [options]
    python autonomous_system/main.py [options]
"""

import asyncio
import argparse
import logging
import signal
import sys
import json
import os
from typing import Dict, Any, Optional
from pathlib import Path

# Import autonomous system components
from .orchestrator import get_orchestrator, AutonomousOrchestrator
from .config.config_manager import ConfigManager
from .monitoring.system_monitor import SystemMonitor
from .monitoring.error_detector import ErrorDetector


class AutonomousSystemMain:
    """Main controller for the autonomous system"""
    
    def __init__(self):
        self.orchestrator: Optional[AutonomousOrchestrator] = None
        self.config_manager: Optional[ConfigManager] = None
        self.system_monitor: Optional[SystemMonitor] = None
        self.error_detector: Optional[ErrorDetector] = None
        self.is_running = False
        self.shutdown_event = asyncio.Event()
        
        # Setup logging
        self.setup_logging()
        self.logger = logging.getLogger(__name__)
    
    def setup_logging(self, log_level: str = "INFO"):
        """Setup comprehensive logging configuration"""
        # Create logs directory if it doesn't exist
        log_dir = Path(__file__).parent.parent / "logs"
        log_dir.mkdir(exist_ok=True)
        
        # Configure logging
        logging.basicConfig(
            level=getattr(logging, log_level.upper()),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_dir / "autonomous_system.log"),
                logging.StreamHandler(sys.stdout)
            ]
        )
        
        # Reduce noise from external libraries
        logging.getLogger("httpx").setLevel(logging.WARNING)
        logging.getLogger("anthropic").setLevel(logging.WARNING)
        logging.getLogger("openai").setLevel(logging.WARNING)
    
    async def initialize(self, config_path: Optional[str] = None) -> bool:
        """Initialize all system components"""
        try:
            self.logger.info("🚀 Initializing Autonomous System...")
            
            # 1. Initialize configuration manager
            self.config_manager = ConfigManager()
            if config_path:
                self.config_manager.load_config(config_path)
            
            # 2. Validate environment and dependencies
            if not await self.validate_environment():
                return False
            
            # 3. Initialize monitoring systems
            self.system_monitor = SystemMonitor()
            self.error_detector = ErrorDetector()
            
            # 4. Initialize orchestrator
            self.orchestrator = get_orchestrator()
            
            # 5. Perform health checks
            health_status = await self.perform_startup_health_checks()
            if not health_status['all_systems_healthy']:
                self.logger.error("❌ Health checks failed during startup")
                return False
            
            self.logger.info("✅ Autonomous System initialized successfully")
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Failed to initialize system: {e}")
            return False
    
    async def validate_environment(self) -> bool:
        """Validate system environment and dependencies"""
        self.logger.info("🔍 Validating environment...")
        
        validation_results = []
        
        # Check required environment variables
        required_env_vars = [
            'ANTHROPIC_API_KEY',
            'OPENAI_API_KEY', 
            'GEMINI_API_KEY'
        ]
        
        for var in required_env_vars:
            if not os.getenv(var):
                self.logger.warning(f"⚠️ Missing environment variable: {var}")
                validation_results.append(False)
            else:
                validation_results.append(True)
        
        # Check file system permissions
        try:
            test_file = Path(__file__).parent.parent / "logs" / "test_write.tmp"
            test_file.write_text("test")
            test_file.unlink()
            validation_results.append(True)
        except Exception as e:
            self.logger.error(f"❌ File system permission check failed: {e}")
            validation_results.append(False)
        
        # Check network connectivity (optional)
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.get("https://api.anthropic.com/v1/messages", 
                                          headers={"Authorization": f"Bearer {os.getenv('ANTHROPIC_API_KEY')}"})
                # Expect 401 (unauthorized) which means API is reachable
                validation_results.append(response.status_code in [401, 422])
        except Exception as e:
            self.logger.warning(f"⚠️ Network connectivity check failed: {e}")
            validation_results.append(False)
        
        all_valid = all(validation_results)
        
        if all_valid:
            self.logger.info("✅ Environment validation passed")
        else:
            self.logger.warning("⚠️ Environment validation completed with warnings")
        
        return len([r for r in validation_results if r]) >= len(validation_results) * 0.7  # 70% pass rate
    
    async def perform_startup_health_checks(self) -> Dict[str, Any]:
        """Perform comprehensive startup health checks"""
        self.logger.info("🏥 Performing startup health checks...")
        
        health_results = {
            'orchestrator': False,
            'config_manager': False,
            'system_monitor': False,
            'error_detector': False,
            'llm_connectivity': False,
            'all_systems_healthy': False
        }
        
        # Check orchestrator
        try:
            if self.orchestrator:
                orchestrator_health = await self.orchestrator.health_check()
                health_results['orchestrator'] = orchestrator_health.get('overall_health_score', 0) > 50
        except Exception as e:
            self.logger.error(f"❌ Orchestrator health check failed: {e}")
        
        # Check config manager
        try:
            if self.config_manager:
                config_status = self.config_manager.validate_config()
                health_results['config_manager'] = config_status
        except Exception as e:
            self.logger.error(f"❌ Config manager health check failed: {e}")
        
        # Check system monitor
        try:
            if self.system_monitor:
                monitor_status = await self.system_monitor.get_system_status()
                health_results['system_monitor'] = monitor_status.get('status') == 'healthy'
        except Exception as e:
            self.logger.error(f"❌ System monitor health check failed: {e}")
        
        # Check error detector
        try:
            if self.error_detector:
                detector_status = self.error_detector.get_detector_status()
                health_results['error_detector'] = detector_status.get('status') == 'active'
        except Exception as e:
            self.logger.error(f"❌ Error detector health check failed: {e}")
        
        # Check LLM connectivity
        try:
            if self.orchestrator:
                llm_health = await self.orchestrator.llm_client.health_check()
                healthy_llms = sum(1 for status in llm_health.values() if status.get('status') == 'healthy')
                health_results['llm_connectivity'] = healthy_llms >= 2  # At least 2 LLMs should be healthy
        except Exception as e:
            self.logger.error(f"❌ LLM connectivity check failed: {e}")
        
        # Calculate overall health
        healthy_systems = sum(1 for status in health_results.values() if status and isinstance(status, bool))
        total_systems = len([k for k, v in health_results.items() if k != 'all_systems_healthy' and isinstance(v, bool)])
        health_results['all_systems_healthy'] = healthy_systems >= total_systems * 0.8  # 80% pass rate
        
        health_results['health_score'] = (healthy_systems / total_systems) * 100
        
        self.logger.info(f"🏥 Health check completed: {healthy_systems}/{total_systems} systems healthy")
        return health_results
    
    async def start(self) -> None:
        """Start the autonomous system"""
        if self.is_running:
            self.logger.warning("⚠️ System is already running")
            return
        
        self.logger.info("🚀 Starting Autonomous System...")
        
        # Setup signal handlers for graceful shutdown
        self.setup_signal_handlers()
        
        try:
            # Start system monitor
            if self.system_monitor:
                asyncio.create_task(self.system_monitor.start_monitoring())
            
            # Start error detector
            if self.error_detector:
                asyncio.create_task(self.error_detector.start_detection())
            
            # Start orchestrator
            if self.orchestrator:
                asyncio.create_task(self.orchestrator.start())
            
            self.is_running = True
            self.logger.info("✅ Autonomous System started successfully")
            
            # Wait for shutdown signal
            await self.shutdown_event.wait()
            
        except Exception as e:
            self.logger.error(f"❌ Error during system execution: {e}")
            raise
        finally:
            await self.shutdown()
    
    async def shutdown(self) -> None:
        """Gracefully shutdown the autonomous system"""
        if not self.is_running:
            return
        
        self.logger.info("🛑 Shutting down Autonomous System...")
        
        try:
            # Create backup before shutdown
            await self.create_shutdown_backup()
            
            # Stop orchestrator
            if self.orchestrator:
                await self.orchestrator.stop()
            
            # Stop monitoring systems
            if self.system_monitor:
                await self.system_monitor.stop_monitoring()
            
            if self.error_detector:
                await self.error_detector.stop_detection()
            
            # Final health report
            await self.generate_shutdown_report()
            
            self.is_running = False
            self.logger.info("✅ Autonomous System shutdown completed")
            
        except Exception as e:
            self.logger.error(f"❌ Error during shutdown: {e}")
    
    async def create_shutdown_backup(self) -> None:
        """Create backup of system state before shutdown"""
        try:
            backup_dir = Path(__file__).parent.parent / "backups"
            backup_dir.mkdir(exist_ok=True)
            
            if self.orchestrator:
                system_state = {
                    'timestamp': asyncio.get_event_loop().time(),
                    'system_overview': self.orchestrator.get_system_overview(),
                    'execution_stats': self.orchestrator.execution_stats,
                    'tasks': {
                        task_id: self.orchestrator.get_task_status(task_id)
                        for task_id in self.orchestrator.tasks.keys()
                    }
                }
                
                backup_file = backup_dir / f"system_state_backup_{int(asyncio.get_event_loop().time())}.json"
                backup_file.write_text(json.dumps(system_state, indent=2, default=str))
                
                self.logger.info(f"💾 System state backup created: {backup_file}")
        
        except Exception as e:
            self.logger.error(f"❌ Failed to create shutdown backup: {e}")
    
    async def generate_shutdown_report(self) -> None:
        """Generate final system report"""
        try:
            if self.orchestrator:
                final_health = await self.orchestrator.health_check()
                system_overview = self.orchestrator.get_system_overview()
                
                report = {
                    'shutdown_time': asyncio.get_event_loop().time(),
                    'final_health_score': final_health.get('overall_health_score', 0),
                    'total_uptime_hours': system_overview.get('uptime_hours', 0),
                    'tasks_completed': system_overview.get('completed_tasks', 0),
                    'tasks_failed': system_overview.get('failed_tasks', 0),
                    'auto_repairs_performed': self.orchestrator.execution_stats.get('auto_repairs', 0)
                }
                
                self.logger.info(f"📊 Final System Report: {json.dumps(report, indent=2)}")
        
        except Exception as e:
            self.logger.error(f"❌ Failed to generate shutdown report: {e}")
    
    def setup_signal_handlers(self) -> None:
        """Setup signal handlers for graceful shutdown"""
        def signal_handler(signum, frame):
            self.logger.info(f"🛑 Received signal {signum}, initiating graceful shutdown...")
            self.shutdown_event.set()
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
    
    async def handle_emergency(self, incident_data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle emergency incidents"""
        if not self.orchestrator:
            return {'success': False, 'error': 'Orchestrator not available'}
        
        return await self.orchestrator.execute_emergency_response(incident_data)


def create_argument_parser() -> argparse.ArgumentParser:
    """Create command line argument parser"""
    parser = argparse.ArgumentParser(
        description="Autonomous MultiLLM System",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s                           # Start with default settings
  %(prog)s --config config.yaml     # Start with custom config
  %(prog)s --log-level DEBUG         # Start with debug logging
  %(prog)s --validate-only           # Only validate environment
        """
    )
    
    parser.add_argument(
        '--config', '-c',
        type=str,
        help='Path to configuration file'
    )
    
    parser.add_argument(
        '--log-level', '-l',
        choices=['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'],
        default='INFO',
        help='Set logging level (default: INFO)'
    )
    
    parser.add_argument(
        '--validate-only',
        action='store_true',
        help='Only validate environment and exit'
    )
    
    parser.add_argument(
        '--health-check',
        action='store_true',
        help='Perform health check and exit'
    )
    
    parser.add_argument(
        '--version',
        action='version',
        version='Autonomous System v1.0.0'
    )
    
    return parser


async def main():
    """Main entry point"""
    parser = create_argument_parser()
    args = parser.parse_args()
    
    # Initialize system
    system = AutonomousSystemMain()
    system.setup_logging(args.log_level)
    
    try:
        # Initialize components
        if not await system.initialize(args.config):
            sys.exit(1)
        
        # Handle special modes
        if args.validate_only:
            print("✅ Environment validation completed successfully")
            sys.exit(0)
        
        if args.health_check:
            health = await system.perform_startup_health_checks()
            print(f"🏥 Health Check Score: {health.get('health_score', 0):.1f}/100")
            sys.exit(0 if health['all_systems_healthy'] else 1)
        
        # Start normal operation
        await system.start()
        
    except KeyboardInterrupt:
        print("\n🛑 Shutdown requested by user")
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())