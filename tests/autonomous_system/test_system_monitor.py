"""
Tests for SystemMonitor
システム監視機能の包括的テストスイート
"""

import pytest
import asyncio
import os
import time
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime, timedelta
from collections import deque

from autonomous_system.monitoring.system_monitor import (
    SystemMonitor,
    SystemMetrics,
    ServiceStatus
)


class TestSystemMonitor:
    """SystemMonitor unit tests"""
    
    @pytest.mark.unit
    def test_initialization(self, temp_dir, mock_env_vars):
        """Test system monitor initialization"""
        monitor = SystemMonitor(project_root=temp_dir)
        
        assert monitor.project_root == temp_dir
        assert monitor.monitoring_enabled
        assert monitor.monitoring_interval == 1  # From mock env vars
        assert monitor.metrics_retention_hours == 24
        assert isinstance(monitor.metrics_history, deque)
        assert len(monitor.monitored_services) >= 2  # frontend, backend
        assert len(monitor.alert_thresholds) >= 5
        assert len(monitor.alert_callbacks) == 0
    
    @pytest.mark.unit
    def test_alert_callback_system(self, temp_dir, mock_env_vars):
        """Test alert callback system"""
        monitor = SystemMonitor(project_root=temp_dir)
        
        callback_calls = []
        
        def test_callback(alert_type, alert_data):
            callback_calls.append((alert_type, alert_data))
        
        monitor.add_alert_callback(test_callback)
        assert len(monitor.alert_callbacks) == 1
        
        # Test callback execution
        asyncio.run(monitor._send_alert('test_alert', {'message': 'test'}))
        
        assert len(callback_calls) == 1
        assert callback_calls[0][0] == 'test_alert'
        assert 'message' in callback_calls[0][1]['data']
    
    @pytest.mark.async_test
    async def test_system_metrics_collection(self, temp_dir, mock_env_vars, mock_system_resources):
        """Test system metrics collection"""
        monitor = SystemMonitor(project_root=temp_dir)
        
        # Configure mock system resources
        mock_system_resources.cpu_percent.return_value = 45.0
        mock_memory = Mock()
        mock_memory.percent = 60.0
        mock_memory.available = 8 * (1024**3)  # 8GB
        mock_memory.total = 16 * (1024**3)  # 16GB
        mock_system_resources.virtual_memory.return_value = mock_memory
        
        mock_disk = Mock()
        mock_disk.total = 500 * (1024**3)  # 500GB
        mock_disk.used = 200 * (1024**3)   # 200GB
        mock_disk.free = 300 * (1024**3)   # 300GB
        mock_system_resources.disk_usage.return_value = mock_disk
        
        mock_network = Mock()
        mock_network.bytes_sent = 1000000
        mock_network.bytes_recv = 2000000
        mock_system_resources.net_io_counters.return_value = mock_network
        
        mock_system_resources.pids.return_value = [1, 2, 3, 4, 5]  # 5 processes
        mock_system_resources.boot_time.return_value = time.time() - 3600  # 1 hour uptime
        
        # Mock os.getloadavg for Unix systems
        with patch('os.getloadavg', return_value=[1.5, 1.2, 1.0]):
            metrics = await monitor._get_current_metrics()
        
        # Verify metrics
        assert isinstance(metrics, SystemMetrics)
        assert metrics.cpu_percent == 45.0
        assert metrics.memory_percent == 60.0
        assert metrics.memory_available_gb == 8.0
        assert abs(metrics.disk_percent - 40.0) < 0.1  # 200/500 * 100 = 40%
        assert metrics.disk_free_gb == 300.0
        assert metrics.network_bytes_sent == 1000000
        assert metrics.network_bytes_recv == 2000000
        assert metrics.process_count == 5
        assert metrics.load_average_1m == 1.5
        assert 0.9 < metrics.uptime_hours < 1.1  # Around 1 hour
    
    @pytest.mark.async_test
    async def test_metric_alerts(self, temp_dir, mock_env_vars):
        """Test metric-based alerts"""
        monitor = SystemMonitor(project_root=temp_dir)
        
        alert_calls = []
        
        async def capture_alert(alert_type, alert_data):
            alert_calls.append((alert_type, alert_data))
        
        monitor.add_alert_callback(capture_alert)
        
        # Create high-usage metrics
        high_metrics = SystemMetrics(
            timestamp=datetime.now(),
            cpu_percent=90.0,  # Above threshold (85%)
            memory_percent=95.0,  # Above threshold (90%)
            memory_available_gb=1.0,
            disk_percent=98.0,  # Above threshold (95%)
            disk_free_gb=10.0,
            network_bytes_sent=1000,
            network_bytes_recv=2000,
            process_count=100,
            load_average_1m=2.5,
            uptime_hours=24.0
        )
        
        await monitor._check_metric_alerts(high_metrics)
        
        # Should trigger 3 alerts: high_cpu, high_memory, high_disk
        assert len(alert_calls) == 3
        alert_types = [call[0] for call in alert_calls]
        assert 'high_cpu' in alert_types
        assert 'high_memory' in alert_types
        assert 'high_disk' in alert_types
    
    @pytest.mark.unit
    def test_service_process_finding(self, temp_dir, mock_env_vars):
        """Test service process finding"""
        monitor = SystemMonitor(project_root=temp_dir)
        
        # Mock process list
        mock_processes = [
            {'pid': 1234, 'name': 'node', 'cmdline': ['node', 'react-scripts', 'start']},
            {'pid': 5678, 'name': 'python', 'cmdline': ['python', '-m', 'uvicorn', 'main:app']},
            {'pid': 9999, 'name': 'other', 'cmdline': ['other', 'process']}
        ]
        
        with patch('psutil.process_iter', return_value=mock_processes), \
             patch('psutil.Process') as mock_process_class:
            
            mock_process = Mock()
            mock_process_class.return_value = mock_process
            
            # Test finding react-scripts process
            process = monitor._find_service_process('react-scripts')
            assert process is not None
            mock_process_class.assert_called_with(1234)
            
            # Test finding uvicorn process
            process = monitor._find_service_process('uvicorn')
            assert process is not None
            
            # Test finding non-existent process
            process = monitor._find_service_process('non-existent')
            # This depends on the last call, but should handle gracefully
    
    @pytest.mark.async_test
    async def test_service_status_checking(self, temp_dir, mock_env_vars):
        """Test service status checking"""
        monitor = SystemMonitor(project_root=temp_dir)
        
        # Mock running process
        mock_process = Mock()
        mock_process.pid = 1234
        mock_process.cpu_percent.return_value = 5.0
        mock_process.memory_percent.return_value = 10.0
        mock_process.create_time.return_value = time.time() - 3600  # Started 1 hour ago
        
        with patch.object(monitor, '_find_service_process', return_value=mock_process), \
             patch.object(monitor, '_perform_health_check', return_value='healthy'):
            
            config = {
                'port': 3000,
                'process_pattern': 'react-scripts',
                'health_url': 'http://localhost:3000'
            }
            
            status = await monitor._check_service_status('frontend', config)
            
            assert status.name == 'frontend'
            assert status.status == 'running'
            assert status.pid == 1234
            assert status.cpu_percent == 5.0
            assert status.memory_percent == 10.0
            assert status.port == 3000
            assert status.health_status == 'healthy'
            assert status.last_health_check is not None
    
    @pytest.mark.async_test
    async def test_service_status_stopped(self, temp_dir, mock_env_vars):
        """Test service status when process is stopped"""
        monitor = SystemMonitor(project_root=temp_dir)
        
        with patch.object(monitor, '_find_service_process', return_value=None):
            config = {
                'port': 3000,
                'process_pattern': 'react-scripts'
            }
            
            status = await monitor._check_service_status('frontend', config)
            
            assert status.name == 'frontend'
            assert status.status == 'stopped'
            assert status.pid is None
            assert status.cpu_percent == 0.0
            assert status.memory_percent == 0.0
            assert status.started_at is None
    
    @pytest.mark.async_test
    async def test_health_check_success(self, temp_dir, mock_env_vars):
        """Test successful health check"""
        monitor = SystemMonitor(project_root=temp_dir)
        
        # Mock aiohttp response
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_session = AsyncMock()
        mock_session.get.return_value.__aenter__.return_value = mock_response
        
        with patch('aiohttp.ClientSession', return_value=mock_session):
            health_status = await monitor._perform_health_check('http://localhost:3000')
            assert health_status == 'healthy'
    
    @pytest.mark.async_test
    async def test_health_check_failure(self, temp_dir, mock_env_vars):
        """Test failed health check"""
        monitor = SystemMonitor(project_root=temp_dir)
        
        # Mock aiohttp response with error status
        mock_response = AsyncMock()
        mock_response.status = 500
        mock_session = AsyncMock()
        mock_session.get.return_value.__aenter__.return_value = mock_response
        
        with patch('aiohttp.ClientSession', return_value=mock_session):
            health_status = await monitor._perform_health_check('http://localhost:3000')
            assert health_status == 'unhealthy'
    
    @pytest.mark.async_test
    async def test_health_check_exception(self, temp_dir, mock_env_vars):
        """Test health check with network exception"""
        monitor = SystemMonitor(project_root=temp_dir)
        
        with patch('aiohttp.ClientSession', side_effect=Exception("Network error")):
            health_status = await monitor._perform_health_check('http://localhost:3000')
            assert health_status == 'unhealthy'
    
    @pytest.mark.async_test
    async def test_port_checking(self, temp_dir, mock_env_vars):
        """Test port availability checking"""
        monitor = SystemMonitor(project_root=temp_dir)
        
        # Mock successful connection
        with patch('socket.socket') as mock_socket_class:
            mock_socket = Mock()
            mock_socket.connect_ex.return_value = 0  # Success
            mock_socket_class.return_value = mock_socket
            
            is_open = await monitor._check_port_open('localhost', 3000)
            assert is_open is True
            mock_socket.connect_ex.assert_called_with(('localhost', 3000))
            mock_socket.close.assert_called_once()
        
        # Mock failed connection
        with patch('socket.socket') as mock_socket_class:
            mock_socket = Mock()
            mock_socket.connect_ex.return_value = 1  # Connection refused
            mock_socket_class.return_value = mock_socket
            
            is_open = await monitor._check_port_open('localhost', 3000)
            assert is_open is False
    
    @pytest.mark.async_test
    async def test_application_metrics_collection(self, temp_dir, mock_env_vars):
        """Test application-specific metrics collection"""
        monitor = SystemMonitor(project_root=temp_dir)
        
        with patch.object(monitor, '_get_frontend_metrics', return_value={'health': 'ok'}), \
             patch.object(monitor, '_get_backend_metrics', return_value={'health': 'ok'}):
            
            metrics = await monitor._collect_application_metrics()
            
            assert 'timestamp' in metrics
            assert 'frontend' in metrics
            assert 'backend' in metrics
            assert metrics['frontend']['health'] == 'ok'
            assert metrics['backend']['health'] == 'ok'
    
    @pytest.mark.async_test
    async def test_frontend_metrics_success(self, temp_dir, mock_env_vars):
        """Test frontend metrics collection success"""
        monitor = SystemMonitor(project_root=temp_dir)
        
        with patch.object(monitor, '_perform_health_check', return_value='healthy') as mock_health:
            # Mock time to control response time calculation
            with patch('time.time', side_effect=[1000.0, 1000.1]):  # 100ms response
                metrics = await monitor._get_frontend_metrics()
            
            assert metrics['health_status'] == 'healthy'
            assert 90 <= metrics['response_time_ms'] <= 110  # Around 100ms
            assert metrics['is_responsive'] is True
            mock_health.assert_called_with('http://localhost:3000')
    
    @pytest.mark.async_test
    async def test_frontend_metrics_slow_response(self, temp_dir, mock_env_vars):
        """Test frontend metrics with slow response"""
        monitor = SystemMonitor(project_root=temp_dir)
        
        with patch.object(monitor, '_perform_health_check', return_value='healthy'):
            # Mock slow response (6 seconds)
            with patch('time.time', side_effect=[1000.0, 1006.0]):
                metrics = await monitor._get_frontend_metrics()
            
            assert metrics['health_status'] == 'healthy'
            assert metrics['response_time_ms'] == 6000
            assert metrics['is_responsive'] is False  # Exceeds 5000ms threshold
    
    @pytest.mark.async_test
    async def test_backend_metrics_error(self, temp_dir, mock_env_vars):
        """Test backend metrics with error"""
        monitor = SystemMonitor(project_root=temp_dir)
        
        with patch.object(monitor, '_perform_health_check', side_effect=Exception("Connection failed")):
            metrics = await monitor._get_backend_metrics()
            
            assert metrics['health_status'] == 'error'
            assert metrics['response_time_ms'] == 0
            assert metrics['is_responsive'] is False
            assert 'error' in metrics
    
    @pytest.mark.async_test
    async def test_performance_anomaly_detection(self, temp_dir, mock_env_vars):
        """Test performance anomaly detection and alerting"""
        monitor = SystemMonitor(project_root=temp_dir)
        
        alert_calls = []
        
        async def capture_alert(alert_type, alert_data):
            alert_calls.append((alert_type, alert_data))
        
        monitor.add_alert_callback(capture_alert)
        
        # Create metrics with slow responses
        slow_metrics = {
            'frontend': {
                'health_status': 'healthy',
                'response_time_ms': 8000,  # Slow
                'is_responsive': False
            },
            'backend': {
                'health_status': 'healthy',
                'response_time_ms': 6000,  # Slow
                'is_responsive': False
            }
        }
        
        await monitor._detect_performance_anomalies(slow_metrics)
        
        # Should trigger 2 slow_response alerts
        assert len(alert_calls) == 2
        assert all(call[0] == 'slow_response' for call in alert_calls)
        components = [call[1]['data']['component'] for call in alert_calls]
        assert 'frontend' in components
        assert 'backend' in components
    
    @pytest.mark.unit
    def test_current_status_no_data(self, temp_dir, mock_env_vars):
        """Test current status with no data"""
        monitor = SystemMonitor(project_root=temp_dir)
        
        status = monitor.get_current_status()
        assert status['status'] == 'no_data'
        assert 'message' in status
    
    @pytest.mark.unit
    def test_current_status_with_data(self, temp_dir, mock_env_vars):
        """Test current status with metrics data"""
        monitor = SystemMonitor(project_root=temp_dir)
        
        # Add sample metrics
        sample_metrics = SystemMetrics(
            timestamp=datetime.now(),
            cpu_percent=45.0,
            memory_percent=60.0,
            memory_available_gb=8.0,
            disk_percent=40.0,
            disk_free_gb=300.0,
            network_bytes_sent=1000000,
            network_bytes_recv=2000000,
            process_count=50,
            load_average_1m=1.5,
            uptime_hours=24.0
        )
        
        monitor.metrics_history.append(sample_metrics)
        
        status = monitor.get_current_status()
        
        assert 'timestamp' in status
        assert status['system']['cpu_percent'] == 45.0
        assert status['system']['memory_percent'] == 60.0
        assert status['system']['disk_percent'] == 40.0
        assert status['resources']['memory_available_gb'] == 8.0
        assert status['resources']['disk_free_gb'] == 300.0
        assert status['network']['bytes_sent'] == 1000000
    
    @pytest.mark.unit
    def test_metrics_history_filtering(self, temp_dir, mock_env_vars):
        """Test metrics history filtering by time"""
        monitor = SystemMonitor(project_root=temp_dir)
        
        # Add metrics with different timestamps
        now = datetime.now()
        old_metrics = SystemMetrics(
            timestamp=now - timedelta(hours=2),
            cpu_percent=30.0, memory_percent=40.0, memory_available_gb=10.0,
            disk_percent=30.0, disk_free_gb=400.0, network_bytes_sent=500000,
            network_bytes_recv=1000000, process_count=30, load_average_1m=1.0,
            uptime_hours=48.0
        )
        
        recent_metrics = SystemMetrics(
            timestamp=now - timedelta(minutes=30),
            cpu_percent=50.0, memory_percent=65.0, memory_available_gb=7.0,
            disk_percent=45.0, disk_free_gb=350.0, network_bytes_sent=800000,
            network_bytes_recv=1500000, process_count=45, load_average_1m=1.8,
            uptime_hours=48.5
        )
        
        monitor.metrics_history.extend([old_metrics, recent_metrics])
        
        # Get last 1 hour
        history = monitor.get_metrics_history(hours=1)
        assert len(history) == 1  # Only recent metrics
        assert history[0]['cpu_percent'] == 50.0
        
        # Get last 3 hours
        history = monitor.get_metrics_history(hours=3)
        assert len(history) == 2  # Both metrics
    
    @pytest.mark.unit
    def test_performance_summary_insufficient_data(self, temp_dir, mock_env_vars):
        """Test performance summary with insufficient data"""
        monitor = SystemMonitor(project_root=temp_dir)
        
        summary = monitor.get_performance_summary()
        assert summary['status'] == 'insufficient_data'
    
    @pytest.mark.unit
    def test_performance_summary_with_data(self, temp_dir, mock_env_vars):
        """Test performance summary calculation"""
        monitor = SystemMonitor(project_root=temp_dir)
        
        # Add multiple metrics for averaging
        base_time = datetime.now()
        for i in range(10):
            metrics = SystemMetrics(
                timestamp=base_time - timedelta(minutes=i),
                cpu_percent=40.0 + i,  # 40-49%
                memory_percent=60.0 + i,  # 60-69%
                memory_available_gb=8.0,
                disk_percent=30.0 + i,  # 30-39%
                disk_free_gb=400.0,
                network_bytes_sent=1000000,
                network_bytes_recv=2000000,
                process_count=50,
                load_average_1m=1.5,
                uptime_hours=24.0
            )
            monitor.metrics_history.append(metrics)
        
        summary = monitor.get_performance_summary()
        
        assert 'averages' in summary
        assert 'peaks' in summary
        assert 'health_score' in summary
        assert 'status' in summary
        
        # Check averages (should be around middle values)
        assert 43 <= summary['averages']['cpu_percent'] <= 46
        assert 63 <= summary['averages']['memory_percent'] <= 66
        assert 33 <= summary['averages']['disk_percent'] <= 36
        
        # Check peaks (should be maximum values)
        assert summary['peaks']['cpu_percent'] == 49.0
        assert summary['peaks']['memory_percent'] == 69.0
        
        # Health score should be reasonable
        assert isinstance(summary['health_score'], int)
        assert 0 <= summary['health_score'] <= 100
    
    @pytest.mark.unit
    def test_health_score_calculation(self, temp_dir, mock_env_vars):
        """Test health score calculation logic"""
        monitor = SystemMonitor(project_root=temp_dir)
        
        # Test excellent health
        score = monitor._calculate_health_score(30.0, 50.0, 40.0)
        assert score == 100
        
        # Test moderate resource usage
        score = monitor._calculate_health_score(65.0, 75.0, 85.0)
        assert score == 75  # 100 - 15 (cpu) - 10 (memory) - 0 (disk)
        
        # Test high resource usage
        score = monitor._calculate_health_score(85.0, 90.0, 95.0)
        assert score == 25  # 100 - 30 (cpu) - 25 (memory) - 20 (disk)
        
        # Test critical resource usage
        score = monitor._calculate_health_score(95.0, 95.0, 98.0)
        assert score == 25  # 100 - 30 - 25 - 20 = 25
    
    @pytest.mark.unit
    def test_status_from_score(self, temp_dir, mock_env_vars):
        """Test status string from health score"""
        monitor = SystemMonitor(project_root=temp_dir)
        
        assert monitor._get_status_from_score(95) == "excellent"
        assert monitor._get_status_from_score(85) == "good"
        assert monitor._get_status_from_score(70) == "warning"
        assert monitor._get_status_from_score(50) == "critical"
        assert monitor._get_status_from_score(30) == "emergency"
    
    @pytest.mark.async_test
    async def test_system_info_caching(self, temp_dir, mock_env_vars):
        """Test system information caching"""
        monitor = SystemMonitor(project_root=temp_dir)
        
        with patch('os.uname') as mock_uname, \
             patch('psutil.cpu_count', return_value=4), \
             patch('psutil.cpu_freq', return_value=Mock(current=2400)), \
             patch('psutil.virtual_memory', return_value=Mock(total=16*1024**3)), \
             patch('psutil.swap_memory', return_value=Mock(total=8*1024**3)), \
             patch('psutil.disk_usage', return_value=Mock(total=500*1024**3)), \
             patch('psutil.net_if_addrs', return_value={'eth0': [], 'lo': []}):
            
            mock_uname.return_value = Mock(
                sysname='Linux', nodename='test-host', 
                release='5.4.0', machine='x86_64'
            )
            
            # First call should collect info
            info1 = await monitor.get_system_info()
            assert 'platform' in info1
            assert info1['platform']['system'] == 'Linux'
            assert info1['cpu']['count'] == 4
            
            # Second call should use cache (within 5 minutes)
            info2 = await monitor.get_system_info()
            assert info1 is info2  # Same object reference (cached)
    
    @pytest.mark.async_test
    async def test_system_info_error_handling(self, temp_dir, mock_env_vars):
        """Test system info collection error handling"""
        monitor = SystemMonitor(project_root=temp_dir)
        
        with patch('os.uname', side_effect=Exception("System error")):
            info = await monitor.get_system_info()
            assert 'error' in info
            assert 'System error' in info['error']
    
    @pytest.mark.unit
    def test_stop_monitoring(self, temp_dir, mock_env_vars):
        """Test monitoring stop functionality"""
        monitor = SystemMonitor(project_root=temp_dir)
        
        assert monitor.monitoring_enabled is True
        
        asyncio.run(monitor.stop_monitoring())
        
        assert monitor.monitoring_enabled is False


class TestSystemMetrics:
    """SystemMetrics dataclass tests"""
    
    @pytest.mark.unit
    def test_system_metrics_creation(self):
        """Test SystemMetrics creation"""
        timestamp = datetime.now()
        metrics = SystemMetrics(
            timestamp=timestamp,
            cpu_percent=45.0,
            memory_percent=60.0,
            memory_available_gb=8.0,
            disk_percent=40.0,
            disk_free_gb=300.0,
            network_bytes_sent=1000000,
            network_bytes_recv=2000000,
            process_count=50,
            load_average_1m=1.5,
            uptime_hours=24.0
        )
        
        assert metrics.timestamp == timestamp
        assert metrics.cpu_percent == 45.0
        assert metrics.memory_percent == 60.0
        assert metrics.network_bytes_sent == 1000000
        assert metrics.process_count == 50


class TestServiceStatus:
    """ServiceStatus dataclass tests"""
    
    @pytest.mark.unit
    def test_service_status_creation(self):
        """Test ServiceStatus creation"""
        started_time = datetime.now()
        status = ServiceStatus(
            name="frontend",
            status="running",
            pid=1234,
            cpu_percent=5.0,
            memory_percent=10.0,
            started_at=started_time,
            port=3000,
            health_check_url="http://localhost:3000",
            health_status="healthy"
        )
        
        assert status.name == "frontend"
        assert status.status == "running"
        assert status.pid == 1234
        assert status.port == 3000
        assert status.health_status == "healthy"
    
    @pytest.mark.unit
    def test_service_status_defaults(self):
        """Test ServiceStatus default values"""
        status = ServiceStatus(
            name="test",
            status="stopped",
            pid=None,
            cpu_percent=0.0,
            memory_percent=0.0,
            started_at=None
        )
        
        assert status.port is None
        assert status.health_check_url is None
        assert status.last_health_check is None
        assert status.health_status == "unknown"


class TestSystemMonitorIntegration:
    """Integration tests for SystemMonitor"""
    
    @pytest.mark.integration
    @pytest.mark.async_test
    async def test_complete_monitoring_cycle(self, temp_dir, mock_env_vars, mock_system_resources):
        """Test complete monitoring cycle"""
        monitor = SystemMonitor(project_root=temp_dir)
        monitor.monitoring_interval = 0.1  # Fast for testing
        
        # Configure mocks
        mock_system_resources.cpu_percent.return_value = 50.0
        mock_memory = Mock()
        mock_memory.percent = 70.0
        mock_memory.available = 6 * (1024**3)
        mock_memory.total = 16 * (1024**3)
        mock_system_resources.virtual_memory.return_value = mock_memory
        
        # Collect alerts
        alert_calls = []
        
        async def capture_alert(alert_type, alert_data):
            alert_calls.append((alert_type, alert_data))
        
        monitor.add_alert_callback(capture_alert)
        
        # Run one iteration of metrics collection
        with patch.object(monitor, '_collect_system_metrics') as mock_collect:
            async def single_collection():
                metrics = await monitor._get_current_metrics()
                monitor.metrics_history.append(metrics)
                await monitor._check_metric_alerts(metrics)
            
            mock_collect.side_effect = single_collection
            await single_collection()
        
        # Verify metrics were collected
        assert len(monitor.metrics_history) == 1
        latest = monitor.metrics_history[-1]
        assert latest.cpu_percent == 50.0
        assert latest.memory_percent == 70.0
        
        # Verify system status
        status = monitor.get_current_status()
        assert status['system']['cpu_percent'] == 50.0
        assert status['system']['memory_percent'] == 70.0
    
    @pytest.mark.integration
    @pytest.mark.async_test
    async def test_service_monitoring_integration(self, temp_dir, mock_env_vars):
        """Test service monitoring integration"""
        monitor = SystemMonitor(project_root=temp_dir)
        
        # Mock running process
        mock_process = Mock()
        mock_process.pid = 1234
        mock_process.cpu_percent.return_value = 5.0
        mock_process.memory_percent.return_value = 10.0
        mock_process.create_time.return_value = time.time() - 3600
        
        alert_calls = []
        
        async def capture_alert(alert_type, alert_data):
            alert_calls.append((alert_type, alert_data))
        
        monitor.add_alert_callback(capture_alert)
        
        # Test running service
        with patch.object(monitor, '_find_service_process', return_value=mock_process), \
             patch.object(monitor, '_perform_health_check', return_value='healthy'):
            
            for service_name, config in monitor.monitored_services.items():
                status = await monitor._check_service_status(service_name, config)
                assert status.status == 'running'
                assert status.health_status == 'healthy'
        
        # Test stopped service
        with patch.object(monitor, '_find_service_process', return_value=None):
            for service_name, config in monitor.monitored_services.items():
                status = await monitor._check_service_status(service_name, config)
                assert status.status == 'stopped'
                # Note: Alerts would be triggered in actual monitoring loop
    
    @pytest.mark.integration
    @pytest.mark.slow
    @pytest.mark.async_test
    async def test_metrics_retention_and_cleanup(self, temp_dir, mock_env_vars):
        """Test metrics retention and cleanup"""
        monitor = SystemMonitor(project_root=temp_dir)
        monitor.metrics_retention_hours = 1  # 1 hour retention for testing
        monitor.monitoring_interval = 1  # 1 second
        
        # The deque will have maxlen of 3600 items (1 hour * 3600 seconds / 1 second interval)
        expected_maxlen = int(monitor.metrics_retention_hours * 3600 / monitor.monitoring_interval)
        assert monitor.metrics_history.maxlen == expected_maxlen
        
        # Add more metrics than maxlen to test automatic cleanup
        base_time = datetime.now()
        for i in range(expected_maxlen + 100):  # Add more than maxlen
            metrics = SystemMetrics(
                timestamp=base_time - timedelta(seconds=i),
                cpu_percent=40.0, memory_percent=60.0, memory_available_gb=8.0,
                disk_percent=30.0, disk_free_gb=400.0, network_bytes_sent=1000000,
                network_bytes_recv=2000000, process_count=50, load_average_1m=1.5,
                uptime_hours=24.0
            )
            monitor.metrics_history.append(metrics)
        
        # Should not exceed maxlen due to deque behavior
        assert len(monitor.metrics_history) == expected_maxlen


class TestPerformanceAndStress:
    """Performance and stress tests for SystemMonitor"""
    
    @pytest.mark.performance
    @pytest.mark.async_test
    async def test_metrics_collection_performance(self, temp_dir, mock_env_vars, mock_system_resources):
        """Test metrics collection performance"""
        monitor = SystemMonitor(project_root=temp_dir)
        
        # Configure mocks for consistent performance
        mock_system_resources.cpu_percent.return_value = 50.0
        mock_system_resources.virtual_memory.return_value = Mock(
            percent=60.0, available=8*1024**3, total=16*1024**3
        )
        mock_system_resources.disk_usage.return_value = Mock(
            total=500*1024**3, used=200*1024**3, free=300*1024**3
        )
        mock_system_resources.net_io_counters.return_value = Mock(
            bytes_sent=1000000, bytes_recv=2000000
        )
        mock_system_resources.pids.return_value = list(range(100))
        mock_system_resources.boot_time.return_value = time.time() - 3600
        
        # Time multiple metrics collections
        start_time = time.time()
        
        for _ in range(10):
            metrics = await monitor._get_current_metrics()
            monitor.metrics_history.append(metrics)
        
        collection_time = time.time() - start_time
        
        # Should collect 10 metrics quickly (under 2 seconds)
        assert collection_time < 2.0
        assert len(monitor.metrics_history) == 10
    
    @pytest.mark.performance
    def test_large_metrics_history_performance(self, temp_dir, mock_env_vars):
        """Test performance with large metrics history"""
        monitor = SystemMonitor(project_root=temp_dir)
        
        # Add many metrics
        base_time = datetime.now()
        for i in range(1000):
            metrics = SystemMetrics(
                timestamp=base_time - timedelta(seconds=i),
                cpu_percent=40.0 + (i % 20),  # Varying values
                memory_percent=60.0 + (i % 15),
                memory_available_gb=8.0,
                disk_percent=30.0 + (i % 10),
                disk_free_gb=400.0,
                network_bytes_sent=1000000 + i,
                network_bytes_recv=2000000 + i,
                process_count=50 + (i % 30),
                load_average_1m=1.5,
                uptime_hours=24.0 + i/3600
            )
            monitor.metrics_history.append(metrics)
        
        # Test performance of various operations
        start_time = time.time()
        
        # Get current status
        status = monitor.get_current_status()
        
        # Get performance summary
        summary = monitor.get_performance_summary()
        
        # Get metrics history
        history = monitor.get_metrics_history(hours=2)
        
        operation_time = time.time() - start_time
        
        # Should handle large dataset efficiently (under 1 second)
        assert operation_time < 1.0
        assert len(history) > 0
        assert summary['status'] in ['excellent', 'good', 'warning', 'critical', 'emergency']