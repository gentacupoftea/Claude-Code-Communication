#!/usr/bin/env python3
"""
Autonomous System Shutdown Script
自律システム停止スクリプト

This script handles the graceful shutdown of the autonomous system with
backup operations, health monitoring, and cleanup procedures.
"""

import asyncio
import json
import logging
import os
import signal
import sys
import time
import psutil
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

# Add the parent directory to the path to import autonomous_system
sys.path.insert(0, str(Path(__file__).parent.parent))

from autonomous_system import get_orchestrator
from autonomous_system.config.config_manager import ConfigManager


class AutonomousSystemStopper:
    """Autonomous system shutdown manager"""
    
    def __init__(self):
        self.logger = self._setup_logging()
        self.shutdown_start_time = datetime.now()
        self.orchestrator = None
        self.final_health: Dict[str, Any] = {}
        self.backup_results: Dict[str, Any] = {}
        
    def _setup_logging(self) -> logging.Logger:
        """Setup shutdown logging"""
        log_dir = Path(__file__).parent.parent / "logs"
        log_dir.mkdir(exist_ok=True)
        
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_dir / f"shutdown_{int(time.time())}.log"),
                logging.StreamHandler(sys.stdout)
            ]
        )
        
        return logging.getLogger(__name__)
    
    async def stop_system(self, force: bool = False, backup: bool = True) -> bool:
        """
        Stop the autonomous system gracefully
        
        Args:
            force: Force immediate shutdown without waiting for tasks
            backup: Create backup before shutdown
            
        Returns:
            bool: True if shutdown successful, False otherwise
        """
        try:
            self.logger.info("🛑 Initiating Autonomous System shutdown...")
            self.logger.info(f"⏰ Shutdown initiated at: {self.shutdown_start_time}")
            
            # Phase 1: Pre-shutdown health check
            self.logger.info("🏥 Phase 1: Pre-shutdown health assessment")
            await self._pre_shutdown_health_check()
            
            # Phase 2: Create backup (if requested)
            if backup:
                self.logger.info("💾 Phase 2: Creating system backup")
                if not await self._create_comprehensive_backup():
                    self.logger.warning("⚠️ Backup creation failed, continuing shutdown")
            
            # Phase 3: Graceful task completion
            if not force:
                self.logger.info("⏳ Phase 3: Waiting for task completion")
                await self._wait_for_task_completion()
            else:
                self.logger.warning("⚠️ Phase 3: Force shutdown - skipping task completion")
            
            # Phase 4: Stop services
            self.logger.info("🔧 Phase 4: Stopping system services")
            await self._stop_system_services()
            
            # Phase 5: Cleanup operations
            self.logger.info("🧹 Phase 5: Cleanup operations")
            await self._cleanup_operations()
            
            # Phase 6: Final validation
            self.logger.info("✅ Phase 6: Final validation")
            await self._final_validation()
            
            # Generate shutdown report
            await self._generate_shutdown_report()
            
            self.logger.info("✅ Autonomous System shutdown completed successfully!")
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Error during shutdown: {e}")
            await self._generate_failure_report(str(e))
            return False
    
    async def _pre_shutdown_health_check(self) -> None:
        """Assess system health before shutdown"""
        try:
            self.orchestrator = get_orchestrator()
            
            if self.orchestrator and self.orchestrator.is_running:
                health = await self.orchestrator.health_check()
                self.final_health = health
                
                health_score = health.get('overall_health_score', 0)
                self.logger.info(f"  📊 Current system health: {health_score:.1f}/100")
                
                # Log system overview
                overview = self.orchestrator.get_system_overview()
                self.logger.info(f"  📈 Active tasks: {overview.get('running_tasks', 0)}")
                self.logger.info(f"  📋 Pending tasks: {overview.get('pending_tasks', 0)}")
                self.logger.info(f"  ⏱️ System uptime: {overview.get('uptime_hours', 0):.2f} hours")
            else:
                self.logger.warning("  ⚠️ Orchestrator not running or not available")
                
        except Exception as e:
            self.logger.error(f"  ❌ Pre-shutdown health check failed: {e}")
    
    async def _create_comprehensive_backup(self) -> bool:
        """Create comprehensive system backup"""
        try:
            backup_dir = Path(__file__).parent.parent / "backups"
            backup_dir.mkdir(exist_ok=True)
            
            timestamp = int(self.shutdown_start_time.timestamp())
            backup_name = f"shutdown_backup_{timestamp}"
            specific_backup_dir = backup_dir / backup_name
            specific_backup_dir.mkdir(exist_ok=True)
            
            self.logger.info(f"  💾 Creating backup in: {specific_backup_dir}")
            
            # 1. System state backup
            await self._backup_system_state(specific_backup_dir)
            
            # 2. Configuration backup
            await self._backup_configuration(specific_backup_dir)
            
            # 3. Logs backup
            await self._backup_logs(specific_backup_dir)
            
            # 4. Runtime data backup
            await self._backup_runtime_data(specific_backup_dir)
            
            # 5. Create backup manifest
            await self._create_backup_manifest(specific_backup_dir)
            
            self.logger.info(f"  ✅ Backup completed: {backup_name}")
            return True
            
        except Exception as e:
            self.logger.error(f"  ❌ Backup creation failed: {e}")
            return False
    
    async def _backup_system_state(self, backup_dir: Path) -> None:
        """Backup current system state"""
        try:
            if self.orchestrator and self.orchestrator.is_running:
                # System overview
                overview = self.orchestrator.get_system_overview()
                overview_file = backup_dir / "system_overview.json"
                overview_file.write_text(json.dumps(overview, indent=2, default=str))
                
                # Task states
                task_states = {}
                for task_id in self.orchestrator.tasks.keys():
                    task_status = self.orchestrator.get_task_status(task_id)
                    if task_status:
                        task_states[task_id] = task_status
                
                tasks_file = backup_dir / "task_states.json"
                tasks_file.write_text(json.dumps(task_states, indent=2, default=str))
                
                # Health status
                if self.final_health:
                    health_file = backup_dir / "final_health.json"
                    health_file.write_text(json.dumps(self.final_health, indent=2, default=str))
                
                self.logger.info("    ✅ System state backup completed")
            else:
                self.logger.warning("    ⚠️ No running orchestrator to backup")
                
        except Exception as e:
            self.logger.error(f"    ❌ System state backup failed: {e}")
    
    async def _backup_configuration(self, backup_dir: Path) -> None:
        """Backup system configuration"""
        try:
            config_dir = backup_dir / "config"
            config_dir.mkdir(exist_ok=True)
            
            # Copy configuration files
            config_sources = [
                Path(__file__).parent.parent / "autonomous_system" / "config",
                Path(__file__).parent.parent / ".env",
                Path(__file__).parent.parent / "requirements.txt"
            ]
            
            for source in config_sources:
                if source.exists():
                    if source.is_file():
                        target = config_dir / source.name
                        target.write_text(source.read_text())
                    elif source.is_dir():
                        import shutil
                        target_dir = config_dir / source.name
                        shutil.copytree(source, target_dir, exist_ok=True)
            
            self.logger.info("    ✅ Configuration backup completed")
            
        except Exception as e:
            self.logger.error(f"    ❌ Configuration backup failed: {e}")
    
    async def _backup_logs(self, backup_dir: Path) -> None:
        """Backup recent logs"""
        try:
            log_backup_dir = backup_dir / "logs"
            log_backup_dir.mkdir(exist_ok=True)
            
            log_source_dir = Path(__file__).parent.parent / "logs"
            if log_source_dir.exists():
                # Copy recent log files (last 24 hours)
                recent_threshold = time.time() - (24 * 60 * 60)
                
                for log_file in log_source_dir.glob("*.log"):
                    if log_file.stat().st_mtime > recent_threshold:
                        target = log_backup_dir / log_file.name
                        target.write_text(log_file.read_text())
            
            self.logger.info("    ✅ Logs backup completed")
            
        except Exception as e:
            self.logger.error(f"    ❌ Logs backup failed: {e}")
    
    async def _backup_runtime_data(self, backup_dir: Path) -> None:
        """Backup runtime data"""
        try:
            runtime_dir = backup_dir / "runtime"
            runtime_dir.mkdir(exist_ok=True)
            
            # System metrics
            system_metrics = {
                "cpu_percent": psutil.cpu_percent(),
                "memory_info": dict(psutil.virtual_memory()._asdict()),
                "disk_usage": dict(psutil.disk_usage('/')._asdict()),
                "timestamp": datetime.now().isoformat()
            }
            
            metrics_file = runtime_dir / "system_metrics.json"
            metrics_file.write_text(json.dumps(system_metrics, indent=2))
            
            # Process information
            process_info = {
                "pid": os.getpid(),
                "parent_pid": os.getppid(),
                "cmd_line": " ".join(sys.argv),
                "working_directory": str(Path.cwd()),
                "python_version": sys.version
            }
            
            process_file = runtime_dir / "process_info.json"
            process_file.write_text(json.dumps(process_info, indent=2))
            
            self.logger.info("    ✅ Runtime data backup completed")
            
        except Exception as e:
            self.logger.error(f"    ❌ Runtime data backup failed: {e}")
    
    async def _create_backup_manifest(self, backup_dir: Path) -> None:
        """Create backup manifest"""
        try:
            manifest = {
                "backup_info": {
                    "timestamp": self.shutdown_start_time.isoformat(),
                    "backup_type": "shutdown_backup",
                    "version": "1.0"
                },
                "contents": [],
                "file_count": 0,
                "total_size_bytes": 0
            }
            
            # Scan backup directory
            for item in backup_dir.rglob("*"):
                if item.is_file() and item.name != "manifest.json":
                    relative_path = item.relative_to(backup_dir)
                    file_info = {
                        "path": str(relative_path),
                        "size_bytes": item.stat().st_size,
                        "modified": datetime.fromtimestamp(item.stat().st_mtime).isoformat()
                    }
                    manifest["contents"].append(file_info)
                    manifest["file_count"] += 1
                    manifest["total_size_bytes"] += file_info["size_bytes"]
            
            manifest_file = backup_dir / "manifest.json"
            manifest_file.write_text(json.dumps(manifest, indent=2))
            
            self.logger.info(f"    ✅ Backup manifest created ({manifest['file_count']} files, {manifest['total_size_bytes']} bytes)")
            
        except Exception as e:
            self.logger.error(f"    ❌ Backup manifest creation failed: {e}")
    
    async def _wait_for_task_completion(self, timeout: int = 300) -> None:
        """Wait for running tasks to complete"""
        try:
            if not self.orchestrator or not self.orchestrator.is_running:
                self.logger.info("  ℹ️ No running orchestrator found")
                return
            
            start_time = time.time()
            while time.time() - start_time < timeout:
                overview = self.orchestrator.get_system_overview()
                running_tasks = overview.get('running_tasks', 0)
                
                if running_tasks == 0:
                    self.logger.info("  ✅ All tasks completed")
                    break
                
                self.logger.info(f"  ⏳ Waiting for {running_tasks} running tasks...")
                await asyncio.sleep(5)
            else:
                self.logger.warning(f"  ⚠️ Timeout reached, {running_tasks} tasks still running")
                
        except Exception as e:
            self.logger.error(f"  ❌ Error waiting for task completion: {e}")
    
    async def _stop_system_services(self) -> None:
        """Stop all system services"""
        try:
            if self.orchestrator and self.orchestrator.is_running:
                self.logger.info("  🛑 Stopping orchestrator...")
                await self.orchestrator.stop()
                self.logger.info("  ✅ Orchestrator stopped")
            else:
                self.logger.info("  ℹ️ Orchestrator not running")
            
            # Stop other services if needed
            # (Add other service stops here)
            
        except Exception as e:
            self.logger.error(f"  ❌ Error stopping services: {e}")
    
    async def _cleanup_operations(self) -> None:
        """Perform cleanup operations"""
        try:
            # Clean temporary files
            temp_dir = Path(__file__).parent.parent / "tmp"
            if temp_dir.exists():
                import shutil
                for item in temp_dir.iterdir():
                    if item.is_file():
                        item.unlink()
                    elif item.is_dir():
                        shutil.rmtree(item)
                self.logger.info("  🧹 Temporary files cleaned")
            
            # Clean old log files (keep last 10)
            log_dir = Path(__file__).parent.parent / "logs"
            if log_dir.exists():
                log_files = sorted(log_dir.glob("autonomous_system*.log"), 
                                 key=lambda x: x.stat().st_mtime, reverse=True)
                for old_log in log_files[10:]:
                    old_log.unlink()
                    self.logger.info(f"    🗑️ Removed old log: {old_log.name}")
            
            # Clean old backups (keep last 5)
            backup_dir = Path(__file__).parent.parent / "backups"
            if backup_dir.exists():
                backup_dirs = sorted([d for d in backup_dir.iterdir() if d.is_dir()],
                                   key=lambda x: x.stat().st_mtime, reverse=True)
                for old_backup in backup_dirs[5:]:
                    import shutil
                    shutil.rmtree(old_backup)
                    self.logger.info(f"    🗑️ Removed old backup: {old_backup.name}")
            
            self.logger.info("  ✅ Cleanup operations completed")
            
        except Exception as e:
            self.logger.error(f"  ❌ Cleanup operations failed: {e}")
    
    async def _final_validation(self) -> None:
        """Perform final validation"""
        try:
            # Check that processes are actually stopped
            if self.orchestrator:
                is_running = getattr(self.orchestrator, 'is_running', False)
                if not is_running:
                    self.logger.info("  ✅ Orchestrator confirmed stopped")
                else:
                    self.logger.warning("  ⚠️ Orchestrator may still be running")
            
            # Check resource cleanup
            current_processes = []
            for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                try:
                    if 'autonomous_system' in ' '.join(proc.info['cmdline'] or []):
                        current_processes.append(proc.info['pid'])
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
            
            if current_processes:
                self.logger.warning(f"  ⚠️ Found related processes still running: {current_processes}")
            else:
                self.logger.info("  ✅ No related processes found")
            
        except Exception as e:
            self.logger.error(f"  ❌ Final validation failed: {e}")
    
    async def _generate_shutdown_report(self) -> None:
        """Generate comprehensive shutdown report"""
        try:
            end_time = datetime.now()
            shutdown_duration = (end_time - self.shutdown_start_time).total_seconds()
            
            report = {
                "shutdown_info": {
                    "start_time": self.shutdown_start_time.isoformat(),
                    "end_time": end_time.isoformat(),
                    "duration_seconds": shutdown_duration,
                    "success": True
                },
                "final_health": self.final_health,
                "backup_results": self.backup_results,
                "system_info": {
                    "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
                    "platform": sys.platform,
                    "pid": os.getpid()
                }
            }
            
            # Save report
            report_dir = Path(__file__).parent.parent / "logs"
            report_file = report_dir / f"shutdown_report_{int(self.shutdown_start_time.timestamp())}.json"
            report_file.write_text(json.dumps(report, indent=2))
            
            self.logger.info(f"  📊 Shutdown report saved: {report_file}")
            self.logger.info(f"  ⏱️ Total shutdown time: {shutdown_duration:.2f} seconds")
            
        except Exception as e:
            self.logger.error(f"Failed to generate shutdown report: {e}")
    
    async def _generate_failure_report(self, error_message: str) -> None:
        """Generate failure report"""
        try:
            end_time = datetime.now()
            shutdown_duration = (end_time - self.shutdown_start_time).total_seconds()
            
            report = {
                "shutdown_info": {
                    "start_time": self.shutdown_start_time.isoformat(),
                    "end_time": end_time.isoformat(),
                    "duration_seconds": shutdown_duration,
                    "success": False,
                    "error": error_message
                },
                "final_health": self.final_health,
                "backup_results": self.backup_results
            }
            
            # Save failure report
            report_dir = Path(__file__).parent.parent / "logs"
            report_file = report_dir / f"shutdown_failure_{int(self.shutdown_start_time.timestamp())}.json"
            report_file.write_text(json.dumps(report, indent=2))
            
            self.logger.error(f"  📊 Failure report saved: {report_file}")
            
        except Exception as e:
            self.logger.error(f"Failed to generate failure report: {e}")


def find_autonomous_system_processes() -> List[int]:
    """Find running autonomous system processes"""
    processes = []
    
    try:
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                cmdline = ' '.join(proc.info['cmdline'] or [])
                if any(keyword in cmdline for keyword in [
                    'autonomous_system',
                    'start_autonomous_system',
                    'AutonomousSystemMain'
                ]):
                    processes.append(proc.info['pid'])
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
    except Exception:
        pass
    
    return processes


async def main():
    """Main entry point for shutdown script"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Stop Autonomous System")
    parser.add_argument('--force', '-f', action='store_true', 
                       help='Force immediate shutdown without waiting')
    parser.add_argument('--no-backup', action='store_true',
                       help='Skip backup creation')
    parser.add_argument('--verbose', '-v', action='store_true', 
                       help='Verbose output')
    parser.add_argument('--kill', '-k', action='store_true',
                       help='Force kill any running processes')
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Handle force kill
    if args.kill:
        processes = find_autonomous_system_processes()
        if processes:
            print(f"🔪 Force killing processes: {processes}")
            for pid in processes:
                try:
                    os.kill(pid, signal.SIGTERM)
                    time.sleep(2)
                    os.kill(pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
            print("✅ Force kill completed")
        else:
            print("ℹ️ No autonomous system processes found")
        return
    
    # Normal shutdown
    stopper = AutonomousSystemStopper()
    success = await stopper.stop_system(
        force=args.force,
        backup=not args.no_backup
    )
    
    if not success:
        print("❌ Autonomous System shutdown failed")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())