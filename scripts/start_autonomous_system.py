#!/usr/bin/env python3
"""
Autonomous System Startup Script
自律システム起動スクリプト

This script handles the startup of the autonomous system with comprehensive
validation, health checks, and initialization procedures.
"""

import asyncio
import json
import logging
import os
import sys
import time
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional
from datetime import datetime

# Add the parent directory to the path to import autonomous_system
sys.path.insert(0, str(Path(__file__).parent.parent))

from autonomous_system import AutonomousSystemMain, get_orchestrator
from autonomous_system.config.config_manager import ConfigManager


class AutonomousSystemStarter:
    """Autonomous system startup manager"""
    
    def __init__(self):
        self.logger = self._setup_logging()
        self.start_time = datetime.now()
        self.validation_results: Dict[str, Any] = {}
        self.pre_start_health: Dict[str, Any] = {}
        
    def _setup_logging(self) -> logging.Logger:
        """Setup startup logging"""
        log_dir = Path(__file__).parent.parent / "logs"
        log_dir.mkdir(exist_ok=True)
        
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_dir / f"startup_{int(time.time())}.log"),
                logging.StreamHandler(sys.stdout)
            ]
        )
        
        return logging.getLogger(__name__)
    
    async def start_system(self, config_path: Optional[str] = None) -> bool:
        """
        Start the autonomous system with comprehensive validation
        
        Args:
            config_path: Optional path to configuration file
            
        Returns:
            bool: True if startup successful, False otherwise
        """
        try:
            self.logger.info("🚀 Starting Autonomous System...")
            self.logger.info(f"⏰ Startup initiated at: {self.start_time}")
            
            # Phase 1: Pre-startup validation
            self.logger.info("📋 Phase 1: Pre-startup validation")
            if not await self._run_pre_startup_validation():
                self.logger.error("❌ Pre-startup validation failed")
                return False
            
            # Phase 2: Environment setup
            self.logger.info("🔧 Phase 2: Environment setup")
            if not await self._setup_environment():
                self.logger.error("❌ Environment setup failed")
                return False
            
            # Phase 3: System initialization
            self.logger.info("🎯 Phase 3: System initialization")
            system = await self._initialize_system(config_path)
            if not system:
                self.logger.error("❌ System initialization failed")
                return False
            
            # Phase 4: Health checks
            self.logger.info("🏥 Phase 4: Startup health checks")
            if not await self._perform_startup_health_checks(system):
                self.logger.error("❌ Startup health checks failed")
                return False
            
            # Phase 5: Final validation
            self.logger.info("✅ Phase 5: Final validation")
            if not await self._final_validation(system):
                self.logger.error("❌ Final validation failed")
                return False
            
            # Phase 6: System startup
            self.logger.info("🚀 Phase 6: Starting autonomous system")
            await self._start_system_services(system)
            
            # Generate startup report
            await self._generate_startup_report()
            
            self.logger.info("✅ Autonomous System startup completed successfully!")
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Fatal error during startup: {e}")
            await self._generate_failure_report(str(e))
            return False
    
    async def _run_pre_startup_validation(self) -> bool:
        """Run comprehensive pre-startup validation"""
        validations = [
            ("Python Version", self._check_python_version),
            ("Required Packages", self._check_required_packages),
            ("Environment Variables", self._check_environment_variables),
            ("File Permissions", self._check_file_permissions),
            ("Disk Space", self._check_disk_space),
            ("Network Connectivity", self._check_network_connectivity),
            ("Port Availability", self._check_port_availability)
        ]
        
        all_passed = True
        for check_name, check_func in validations:
            try:
                self.logger.info(f"  🔍 Checking {check_name}...")
                result = await check_func() if asyncio.iscoroutinefunction(check_func) else check_func()
                self.validation_results[check_name] = result
                
                if result:
                    self.logger.info(f"  ✅ {check_name}: PASSED")
                else:
                    self.logger.error(f"  ❌ {check_name}: FAILED")
                    all_passed = False
                    
            except Exception as e:
                self.logger.error(f"  ❌ {check_name}: ERROR - {e}")
                self.validation_results[check_name] = False
                all_passed = False
        
        return all_passed
    
    def _check_python_version(self) -> bool:
        """Check Python version compatibility"""
        import sys
        version = sys.version_info
        required_version = (3, 8)
        
        if version >= required_version:
            self.logger.info(f"    Python {version.major}.{version.minor}.{version.micro}")
            return True
        else:
            self.logger.error(f"    Python {version.major}.{version.minor} < required {required_version[0]}.{required_version[1]}")
            return False
    
    def _check_required_packages(self) -> bool:
        """Check required packages are installed"""
        required_packages = [
            'anthropic',
            'openai',
            'google-generativeai',
            'fastapi',
            'pydantic',
            'aiohttp',
            'psutil'
        ]
        
        missing_packages = []
        for package in required_packages:
            try:
                __import__(package.replace('-', '_'))
            except ImportError:
                missing_packages.append(package)
        
        if missing_packages:
            self.logger.error(f"    Missing packages: {missing_packages}")
            return False
        
        self.logger.info(f"    All {len(required_packages)} required packages available")
        return True
    
    def _check_environment_variables(self) -> bool:
        """Check required environment variables"""
        required_vars = [
            'ANTHROPIC_API_KEY',
            'OPENAI_API_KEY',
            'GEMINI_API_KEY'
        ]
        
        missing_vars = []
        for var in required_vars:
            if not os.getenv(var):
                missing_vars.append(var)
        
        if missing_vars:
            self.logger.warning(f"    Missing environment variables: {missing_vars}")
            return len(missing_vars) <= 1  # Allow 1 missing API key
        
        self.logger.info(f"    All {len(required_vars)} environment variables set")
        return True
    
    def _check_file_permissions(self) -> bool:
        """Check file system permissions"""
        test_paths = [
            Path(__file__).parent.parent / "logs",
            Path(__file__).parent.parent / "backups",
            Path(__file__).parent.parent / "autonomous_system"
        ]
        
        for path in test_paths:
            try:
                # Create directory if it doesn't exist
                path.mkdir(exist_ok=True)
                
                # Test write permission
                test_file = path / "permission_test.tmp"
                test_file.write_text("test")
                test_file.unlink()
                
            except Exception as e:
                self.logger.error(f"    Permission check failed for {path}: {e}")
                return False
        
        self.logger.info("    File permissions verified")
        return True
    
    def _check_disk_space(self) -> bool:
        """Check available disk space"""
        import shutil
        
        try:
            _, _, free_bytes = shutil.disk_usage(Path(__file__).parent.parent)
            free_gb = free_bytes / (1024**3)
            
            required_gb = 1.0  # Require at least 1GB free
            
            if free_gb >= required_gb:
                self.logger.info(f"    Available disk space: {free_gb:.1f} GB")
                return True
            else:
                self.logger.error(f"    Insufficient disk space: {free_gb:.1f} GB < {required_gb} GB required")
                return False
                
        except Exception as e:
            self.logger.error(f"    Disk space check failed: {e}")
            return False
    
    async def _check_network_connectivity(self) -> bool:
        """Check network connectivity to LLM APIs"""
        endpoints = [
            "https://api.anthropic.com",
            "https://api.openai.com", 
            "https://generativelanguage.googleapis.com"
        ]
        
        successful_connections = 0
        
        try:
            import aiohttp
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as session:
                for endpoint in endpoints:
                    try:
                        async with session.get(endpoint) as response:
                            # Any response (even 401/403) indicates connectivity
                            if response.status < 500:
                                successful_connections += 1
                    except Exception as e:
                        self.logger.warning(f"    Failed to connect to {endpoint}: {e}")
        
        except Exception as e:
            self.logger.error(f"    Network connectivity check failed: {e}")
            return False
        
        # Require at least 2 out of 3 endpoints to be reachable
        if successful_connections >= 2:
            self.logger.info(f"    Network connectivity verified ({successful_connections}/{len(endpoints)} endpoints)")
            return True
        else:
            self.logger.error(f"    Insufficient network connectivity ({successful_connections}/{len(endpoints)} endpoints)")
            return False
    
    def _check_port_availability(self) -> bool:
        """Check if required ports are available"""
        import socket
        
        required_ports = [8000, 8001, 8765]  # Common ports used by the system
        unavailable_ports = []
        
        for port in required_ports:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            try:
                sock.bind(('localhost', port))
                sock.close()
            except OSError:
                unavailable_ports.append(port)
        
        if unavailable_ports:
            self.logger.warning(f"    Ports in use: {unavailable_ports}")
            return len(unavailable_ports) <= 1  # Allow 1 port to be in use
        
        self.logger.info(f"    All required ports available")
        return True
    
    async def _setup_environment(self) -> bool:
        """Setup runtime environment"""
        try:
            # Create necessary directories
            directories = [
                "logs",
                "backups", 
                "tmp",
                "autonomous_system/data"
            ]
            
            base_path = Path(__file__).parent.parent
            for dir_name in directories:
                dir_path = base_path / dir_name
                dir_path.mkdir(parents=True, exist_ok=True)
                self.logger.info(f"  📁 Created/verified directory: {dir_path}")
            
            # Set up environment variables if missing
            if not os.getenv('PYTHONPATH'):
                os.environ['PYTHONPATH'] = str(base_path)
                self.logger.info("  🔧 Set PYTHONPATH environment variable")
            
            # Set up async event loop policy if needed
            if sys.platform.startswith('win'):
                asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
                self.logger.info("  🔧 Set Windows event loop policy")
            
            return True
            
        except Exception as e:
            self.logger.error(f"  ❌ Environment setup failed: {e}")
            return False
    
    async def _initialize_system(self, config_path: Optional[str]) -> Optional[AutonomousSystemMain]:
        """Initialize the autonomous system"""
        try:
            self.logger.info("  🎯 Creating system instance...")
            system = AutonomousSystemMain()
            
            self.logger.info("  🔧 Initializing system components...")
            if not await system.initialize(config_path):
                return None
            
            self.logger.info("  ✅ System initialization completed")
            return system
            
        except Exception as e:
            self.logger.error(f"  ❌ System initialization failed: {e}")
            return None
    
    async def _perform_startup_health_checks(self, system: AutonomousSystemMain) -> bool:
        """Perform comprehensive startup health checks"""
        try:
            self.logger.info("  🏥 Running health checks...")
            
            health_results = await system.perform_startup_health_checks()
            self.pre_start_health = health_results
            
            health_score = health_results.get('health_score', 0)
            self.logger.info(f"  📊 Overall health score: {health_score:.1f}/100")
            
            if health_results.get('all_systems_healthy', False):
                self.logger.info("  ✅ All systems healthy")
                return True
            else:
                # Log specific issues
                for system_name, status in health_results.items():
                    if isinstance(status, bool) and not status:
                        self.logger.warning(f"  ⚠️ {system_name}: UNHEALTHY")
                
                # Allow startup if health score > 60%
                if health_score > 60:
                    self.logger.warning("  ⚠️ Proceeding with degraded health status")
                    return True
                else:
                    self.logger.error("  ❌ Health score too low for startup")
                    return False
                    
        except Exception as e:
            self.logger.error(f"  ❌ Health check failed: {e}")
            return False
    
    async def _final_validation(self, system: AutonomousSystemMain) -> bool:
        """Perform final validation before startup"""
        try:
            self.logger.info("  🔍 Final validation checks...")
            
            # Test orchestrator functionality
            orchestrator = get_orchestrator()
            test_task_id = orchestrator.create_task(
                task_type="strategic_analysis",
                description="Startup validation test",
                data={"test": True, "startup_time": self.start_time.isoformat()},
                priority=orchestrator.TaskPriority.LOW
            )
            
            if test_task_id:
                self.logger.info("  ✅ Task creation validated")
            else:
                self.logger.error("  ❌ Task creation failed")
                return False
            
            # Test configuration
            if system.config_manager:
                config_valid = system.config_manager.validate_config()
                if config_valid:
                    self.logger.info("  ✅ Configuration validated")
                else:
                    self.logger.warning("  ⚠️ Configuration validation failed")
            
            return True
            
        except Exception as e:
            self.logger.error(f"  ❌ Final validation failed: {e}")
            return False
    
    async def _start_system_services(self, system: AutonomousSystemMain) -> None:
        """Start system services"""
        try:
            self.logger.info("  🚀 Starting system services...")
            
            # Start the autonomous system (this will run indefinitely)
            # Note: This should be the last step as it blocks
            await system.start()
            
        except KeyboardInterrupt:
            self.logger.info("  🛑 Shutdown requested by user")
        except Exception as e:
            self.logger.error(f"  ❌ Error starting services: {e}")
            raise
    
    async def _generate_startup_report(self) -> None:
        """Generate comprehensive startup report"""
        try:
            end_time = datetime.now()
            startup_duration = (end_time - self.start_time).total_seconds()
            
            report = {
                "startup_info": {
                    "start_time": self.start_time.isoformat(),
                    "end_time": end_time.isoformat(),
                    "duration_seconds": startup_duration,
                    "success": True
                },
                "validation_results": self.validation_results,
                "pre_start_health": self.pre_start_health,
                "system_info": {
                    "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
                    "platform": sys.platform,
                    "cwd": str(Path.cwd())
                }
            }
            
            # Save report
            report_dir = Path(__file__).parent.parent / "logs"
            report_file = report_dir / f"startup_report_{int(self.start_time.timestamp())}.json"
            report_file.write_text(json.dumps(report, indent=2))
            
            self.logger.info(f"  📊 Startup report saved: {report_file}")
            self.logger.info(f"  ⏱️ Total startup time: {startup_duration:.2f} seconds")
            
        except Exception as e:
            self.logger.error(f"Failed to generate startup report: {e}")
    
    async def _generate_failure_report(self, error_message: str) -> None:
        """Generate failure report"""
        try:
            end_time = datetime.now()
            startup_duration = (end_time - self.start_time).total_seconds()
            
            report = {
                "startup_info": {
                    "start_time": self.start_time.isoformat(),
                    "end_time": end_time.isoformat(),
                    "duration_seconds": startup_duration,
                    "success": False,
                    "error": error_message
                },
                "validation_results": self.validation_results,
                "pre_start_health": self.pre_start_health
            }
            
            # Save failure report
            report_dir = Path(__file__).parent.parent / "logs"
            report_file = report_dir / f"startup_failure_{int(self.start_time.timestamp())}.json"
            report_file.write_text(json.dumps(report, indent=2))
            
            self.logger.error(f"  📊 Failure report saved: {report_file}")
            
        except Exception as e:
            self.logger.error(f"Failed to generate failure report: {e}")


async def main():
    """Main entry point for startup script"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Start Autonomous System")
    parser.add_argument('--config', '-c', help='Configuration file path')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    starter = AutonomousSystemStarter()
    success = await starter.start_system(args.config)
    
    if not success:
        print("❌ Autonomous System startup failed")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())