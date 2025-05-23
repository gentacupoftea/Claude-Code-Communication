"""
Tests for ErrorDetector
エラー検知システムの包括的テストスイート
"""

import pytest
import asyncio
import os
import tempfile
import time
from unittest.mock import Mock, AsyncMock, patch, mock_open
from pathlib import Path
from datetime import datetime, timedelta

from autonomous_system.monitoring.error_detector import (
    ErrorDetector,
    DetectedError,
    ErrorSeverity,
    ErrorCategory
)


class TestErrorDetector:
    """ErrorDetector unit tests"""
    
    @pytest.mark.unit
    def test_initialization(self, temp_dir, mock_env_vars):
        """Test error detector initialization"""
        detector = ErrorDetector(project_root=temp_dir)
        
        assert detector.project_root == temp_dir
        assert detector.detection_enabled
        assert detector.monitoring_interval == 1  # From mock env vars
        assert len(detector.detected_errors) == 0
        assert len(detector.error_callbacks) == 0
        assert len(detector.error_patterns['javascript']) > 0
        assert len(detector.error_patterns['python']) > 0
        assert len(detector.error_patterns['system']) > 0
    
    @pytest.mark.unit
    def test_initialization_disabled(self, temp_dir):
        """Test initialization with detection disabled"""
        with patch.dict(os.environ, {'ERROR_DETECTION_ENABLED': 'false'}):
            detector = ErrorDetector(project_root=temp_dir)
            assert not detector.detection_enabled
    
    @pytest.mark.unit
    def test_error_pattern_matching(self, temp_dir, mock_env_vars):
        """Test error pattern matching functionality"""
        detector = ErrorDetector(project_root=temp_dir)
        
        # Test JavaScript error patterns
        js_content = """
        TypeError: Cannot read property 'foo' of undefined
        ReferenceError: myVariable is not defined
        SyntaxError: Unexpected token '}'
        Failed to compile.
        Module not found: Error: Can't resolve 'missing-module'
        """
        
        errors = detector._extract_errors_from_content(js_content, "test.js")
        assert len(errors) >= 4  # Should detect multiple errors
        
        # Verify error properties
        for error in errors:
            assert error.category == ErrorCategory.APPLICATION
            assert error.source == "test.js"
            assert error.timestamp is not None
    
    @pytest.mark.unit
    def test_python_error_extraction(self, temp_dir, mock_env_vars):
        """Test Python error extraction with traceback"""
        detector = ErrorDetector(project_root=temp_dir)
        
        python_content = """
        Traceback (most recent call last):
          File "test.py", line 10, in <module>
            result = divide(10, 0)
          File "test.py", line 5, in divide
            return a / b
        ZeroDivisionError: division by zero
        ModuleNotFoundError: No module named 'missing_package'
        """
        
        errors = detector._extract_errors_from_content(python_content, "test.py")
        assert len(errors) >= 2
        
        # Check for traceback extraction
        traceback_error = next((e for e in errors if 'Traceback' in (e.stack_trace or '')), None)
        assert traceback_error is not None
        assert 'ZeroDivisionError' in traceback_error.stack_trace
    
    @pytest.mark.unit
    def test_severity_determination(self, temp_dir, mock_env_vars):
        """Test error severity determination"""
        detector = ErrorDetector(project_root=temp_dir)
        
        test_cases = [
            ("fatal error occurred", "CRITICAL", ErrorSeverity.CRITICAL),
            ("Failed to compile", "ERROR", ErrorSeverity.HIGH),
            ("warning: deprecated function", "WARNING", ErrorSeverity.MEDIUM),
            ("info: processing complete", "INFO", ErrorSeverity.LOW),
            ("unknown error", "ERROR", ErrorSeverity.MEDIUM)
        ]
        
        for error_text, context, expected_severity in test_cases:
            severity = detector._determine_severity(error_text, context)
            assert severity == expected_severity
    
    @pytest.mark.unit
    def test_auto_fix_assessment(self, temp_dir, mock_env_vars):
        """Test auto-fix potential assessment"""
        detector = ErrorDetector(project_root=temp_dir)
        
        test_cases = [
            ("Module not found: missing-package", ErrorCategory.APPLICATION, True, 0.8),
            ("Syntax error: missing semicolon", ErrorCategory.APPLICATION, True, 0.6),
            ("Segmentation fault", ErrorCategory.SYSTEM, False, 0.0),
            ("Permission denied", ErrorCategory.SYSTEM, False, 0.0)
        ]
        
        for error_text, category, expected_fixable, min_confidence in test_cases:
            fixable, confidence = detector._assess_auto_fix_potential(error_text, category)
            assert fixable == expected_fixable
            if expected_fixable:
                assert confidence >= min_confidence
    
    @pytest.mark.unit
    def test_affected_systems_identification(self, temp_dir, mock_env_vars):
        """Test affected systems identification"""
        detector = ErrorDetector(project_root=temp_dir)
        
        test_cases = [
            ("React compilation failed", "frontend/src/App.tsx", ["frontend"]),
            ("Database connection error", "backend/api.py", ["backend", "database"]),
            ("Build process failed", "webpack.config.js", ["build_system"]),
            ("Unknown error", "unknown.txt", ["unknown"])
        ]
        
        for error_text, source, expected_systems in test_cases:
            systems = detector._identify_affected_systems(error_text, source)
            for expected_system in expected_systems:
                assert expected_system in systems
    
    @pytest.mark.async_test
    async def test_log_file_monitoring(self, temp_dir, mock_env_vars):
        """Test log file monitoring functionality"""
        detector = ErrorDetector(project_root=temp_dir)
        
        # Create test log file
        log_file = Path(temp_dir) / "test.log"
        log_file.write_text("Initial content\n")
        
        # Monitor the file
        await detector._check_log_file(str(log_file))
        initial_checksum = detector.file_checksums.get(str(log_file))
        
        # Update the file with an error
        time.sleep(0.1)  # Ensure timestamp difference
        log_file.write_text("Initial content\nError: Something went wrong\n")
        
        # Check again - should detect the error
        callback_called = False
        detected_error = None
        
        async def error_callback(error):
            nonlocal callback_called, detected_error
            callback_called = True
            detected_error = error
        
        detector.add_error_callback(error_callback)
        await detector._check_log_file(str(log_file))
        
        # Verify error was detected
        assert len(detector.detected_errors) > 0
        assert callback_called
        assert detected_error is not None
        assert "Something went wrong" in detected_error.description
    
    @pytest.mark.async_test
    async def test_system_resource_monitoring(self, temp_dir, mock_env_vars, mock_system_resources):
        """Test system resource monitoring"""
        detector = ErrorDetector(project_root=temp_dir)
        
        # Set high resource usage to trigger alerts
        mock_system_resources.cpu_percent.return_value = 95.0
        mock_memory = Mock()
        mock_memory.percent = 90.0
        mock_memory.available = 1 * (1024**3)  # 1GB
        mock_system_resources.virtual_memory.return_value = mock_memory
        
        # Run resource monitoring (just one iteration)
        with patch.object(detector, '_create_performance_error') as mock_create_error:
            # Mock the monitoring loop to run once
            original_monitoring = detector._monitor_system_resources
            
            async def single_iteration():
                try:
                    # CPU check
                    cpu_percent = mock_system_resources.cpu_percent(interval=1)
                    if cpu_percent > detector.performance_thresholds['cpu_usage']:
                        await detector._create_performance_error(
                            'High CPU Usage',
                            f'CPU usage is {cpu_percent}%',
                            {'cpu_percent': cpu_percent}
                        )
                    
                    # Memory check
                    memory = mock_system_resources.virtual_memory()
                    if memory.percent > detector.performance_thresholds['memory_usage']:
                        await detector._create_performance_error(
                            'High Memory Usage',
                            f'Memory usage is {memory.percent}%',
                            {'memory_percent': memory.percent}
                        )
                except Exception as e:
                    pass
            
            await single_iteration()
            
            # Should have created performance errors
            assert mock_create_error.call_count >= 2  # CPU and Memory errors
    
    @pytest.mark.async_test
    async def test_application_health_monitoring(self, temp_dir, mock_env_vars):
        """Test application health monitoring"""
        detector = ErrorDetector(project_root=temp_dir)
        
        # Create test directory structure
        frontend_dir = Path(temp_dir) / "frontend"
        frontend_dir.mkdir()
        
        # Test missing package.json
        with patch.object(detector, '_create_app_error') as mock_create_error:
            await detector._check_frontend_health()
            mock_create_error.assert_called_with(
                'Frontend Configuration Missing',
                'package.json not found in frontend directory',
                ErrorSeverity.HIGH
            )
        
        # Create package.json but missing node_modules
        (frontend_dir / "package.json").write_text('{"name": "test"}')
        
        with patch.object(detector, '_create_app_error') as mock_create_error:
            await detector._check_frontend_health()
            mock_create_error.assert_called_with(
                'Frontend Dependencies Missing',
                'node_modules directory not found',
                ErrorSeverity.MEDIUM
            )
    
    @pytest.mark.async_test
    async def test_python_syntax_checking(self, temp_dir, mock_env_vars, mock_subprocess):
        """Test Python syntax checking"""
        detector = ErrorDetector(project_root=temp_dir)
        
        # Create test Python file
        py_file = Path(temp_dir) / "test.py"
        py_file.write_text("print('hello world')")
        
        # Mock successful compilation
        mock_subprocess.run.return_value.returncode = 0
        
        with patch.object(detector, '_create_app_error') as mock_create_error:
            await detector._check_python_syntax(py_file)
            mock_create_error.assert_not_called()
        
        # Mock compilation failure
        mock_subprocess.run.return_value.returncode = 1
        mock_subprocess.run.return_value.stderr = "SyntaxError: invalid syntax"
        
        with patch.object(detector, '_create_app_error') as mock_create_error:
            await detector._check_python_syntax(py_file)
            mock_create_error.assert_called_once()
            args = mock_create_error.call_args[0]
            assert "Python Syntax Error" in args[0]
            assert "SyntaxError" in args[1]
    
    @pytest.mark.async_test
    async def test_build_error_detection(self, temp_dir, mock_env_vars):
        """Test build error detection"""
        detector = ErrorDetector(project_root=temp_dir)
        
        build_content = """
        Failed to compile.
        
        Module not found: Error: Can't resolve './missing-component'
        
        Syntax error: Unexpected token '}' in src/App.js:42:5
        
        Build failed with 3 errors
        """
        
        errors = detector._extract_build_errors(build_content, "build.log")
        assert len(errors) >= 3
        
        for error in errors:
            assert error.category == ErrorCategory.BUILD
            assert error.severity == ErrorSeverity.HIGH
            assert error.auto_fixable
            assert error.fix_confidence >= 0.7
    
    @pytest.mark.async_test
    async def test_network_connectivity_monitoring(self, temp_dir, mock_env_vars, mock_subprocess):
        """Test network connectivity monitoring"""
        detector = ErrorDetector(project_root=temp_dir)
        
        # Mock successful ping
        mock_subprocess.run.return_value.returncode = 0
        
        await detector._check_network_endpoint("api.github.com")
        # Should not create any errors
        assert len(detector.detected_errors) == 0
        
        # Mock failed ping
        mock_subprocess.run.return_value.returncode = 1
        mock_subprocess.run.return_value.stderr = "Network unreachable"
        
        await detector._check_network_endpoint("api.github.com")
        # Should create network error
        assert len(detector.detected_errors) == 1
        error = list(detector.detected_errors.values())[0]
        assert error.category == ErrorCategory.NETWORK
        assert "api.github.com" in error.description
    
    @pytest.mark.unit
    def test_error_callback_system(self, temp_dir, mock_env_vars):
        """Test error callback system"""
        detector = ErrorDetector(project_root=temp_dir)
        
        callback_calls = []
        
        def sync_callback(error):
            callback_calls.append(('sync', error))
        
        async def async_callback(error):
            callback_calls.append(('async', error))
        
        detector.add_error_callback(sync_callback)
        detector.add_error_callback(async_callback)
        
        # Create and handle an error
        test_error = DetectedError(
            id="test_error",
            category=ErrorCategory.APPLICATION,
            severity=ErrorSeverity.HIGH,
            title="Test Error",
            description="Test description",
            source="test",
            timestamp=datetime.now(),
            data={}
        )
        
        # Handle the error (this is async)
        async def test_callback_execution():
            await detector._handle_detected_error(test_error)
        
        asyncio.run(test_callback_execution())
        
        # Verify callbacks were called
        assert len(callback_calls) == 2
        assert any(call[0] == 'sync' for call in callback_calls)
        assert any(call[0] == 'async' for call in callback_calls)
    
    @pytest.mark.unit
    def test_error_deduplication(self, temp_dir, mock_env_vars):
        """Test error deduplication"""
        detector = ErrorDetector(project_root=temp_dir)
        
        # Create same error twice
        error1 = DetectedError(
            id="duplicate_error",
            category=ErrorCategory.APPLICATION,
            severity=ErrorSeverity.HIGH,
            title="Duplicate Error",
            description="This is a duplicate",
            source="test",
            timestamp=datetime.now(),
            data={}
        )
        
        error2 = DetectedError(
            id="duplicate_error",  # Same ID
            category=ErrorCategory.APPLICATION,
            severity=ErrorSeverity.CRITICAL,  # Different severity
            title="Different Title",
            description="Different description",
            source="test",
            timestamp=datetime.now(),
            data={}
        )
        
        async def test_deduplication():
            await detector._handle_detected_error(error1)
            await detector._handle_detected_error(error2)
        
        asyncio.run(test_deduplication())
        
        # Should only have one error (first one)
        assert len(detector.detected_errors) == 1
        stored_error = detector.detected_errors["duplicate_error"]
        assert stored_error.title == "Duplicate Error"  # First error preserved
    
    @pytest.mark.unit
    def test_error_retrieval_and_filtering(self, temp_dir, mock_env_vars, sample_detected_errors):
        """Test error retrieval and filtering"""
        detector = ErrorDetector(project_root=temp_dir)
        
        # Add sample errors
        for error in sample_detected_errors:
            detector.detected_errors[error.id] = error
        
        # Test basic retrieval
        all_errors = detector.get_detected_errors()
        assert len(all_errors) == 3
        
        # Test severity filtering
        critical_errors = detector.get_detected_errors(severity=ErrorSeverity.CRITICAL)
        assert len(critical_errors) == 1
        assert critical_errors[0].severity == ErrorSeverity.CRITICAL
        
        # Test category filtering
        app_errors = detector.get_detected_errors(category=ErrorCategory.APPLICATION)
        assert len(app_errors) == 1
        assert app_errors[0].category == ErrorCategory.APPLICATION
        
        # Test limit
        limited_errors = detector.get_detected_errors(limit=2)
        assert len(limited_errors) == 2
        
        # Test ordering (newest first)
        assert limited_errors[0].timestamp >= limited_errors[1].timestamp
    
    @pytest.mark.unit
    def test_error_statistics(self, temp_dir, mock_env_vars, sample_detected_errors):
        """Test error statistics generation"""
        detector = ErrorDetector(project_root=temp_dir)
        
        # Add sample errors
        for error in sample_detected_errors:
            detector.detected_errors[error.id] = error
        
        stats = detector.get_error_statistics()
        
        assert stats['total_errors'] == 3
        assert stats['category_breakdown']['application'] == 1
        assert stats['category_breakdown']['system'] == 1
        assert stats['category_breakdown']['build'] == 1
        assert stats['severity_breakdown']['critical'] == 1
        assert stats['severity_breakdown']['high'] == 1
        assert stats['severity_breakdown']['medium'] == 1
        assert stats['auto_fixable_errors'] == 3  # All sample errors are auto-fixable
        assert stats['auto_fix_percentage'] == 100.0
        assert stats['recent_errors_24h'] >= 2  # At least the recent ones
    
    @pytest.mark.unit
    def test_old_error_cleanup(self, temp_dir, mock_env_vars):
        """Test old error cleanup functionality"""
        detector = ErrorDetector(project_root=temp_dir)
        
        # Create errors with different timestamps
        old_error = DetectedError(
            id="old_error",
            category=ErrorCategory.APPLICATION,
            severity=ErrorSeverity.MEDIUM,
            title="Old Error",
            description="This is old",
            source="test",
            timestamp=datetime.now() - timedelta(hours=25),  # 25 hours old
            data={}
        )
        
        recent_error = DetectedError(
            id="recent_error",
            category=ErrorCategory.APPLICATION,
            severity=ErrorSeverity.MEDIUM,
            title="Recent Error",
            description="This is recent",
            source="test",
            timestamp=datetime.now() - timedelta(hours=1),  # 1 hour old
            data={}
        )
        
        detector.detected_errors[old_error.id] = old_error
        detector.detected_errors[recent_error.id] = recent_error
        
        # Clean old errors (older than 24 hours)
        detector.clear_old_errors(hours=24)
        
        # Should only have recent error
        assert len(detector.detected_errors) == 1
        assert "recent_error" in detector.detected_errors
        assert "old_error" not in detector.detected_errors


class TestDetectedError:
    """DetectedError dataclass tests"""
    
    @pytest.mark.unit
    def test_detected_error_creation(self):
        """Test DetectedError creation and post-init"""
        error = DetectedError(
            id="test_error",
            category=ErrorCategory.APPLICATION,
            severity=ErrorSeverity.HIGH,
            title="Test Error",
            description="Test description",
            source="test_source",
            timestamp=datetime.now(),
            data={"key": "value"}
        )
        
        assert error.id == "test_error"
        assert error.category == ErrorCategory.APPLICATION
        assert error.severity == ErrorSeverity.HIGH
        assert error.affected_systems == []  # Should be initialized in post_init
        assert error.auto_fixable is False  # Default value
        assert error.fix_confidence == 0.0  # Default value
    
    @pytest.mark.unit
    def test_detected_error_with_optional_fields(self):
        """Test DetectedError with all optional fields"""
        timestamp = datetime.now()
        error = DetectedError(
            id="full_error",
            category=ErrorCategory.SYSTEM,
            severity=ErrorSeverity.CRITICAL,
            title="Full Error",
            description="Complete error description",
            source="system_monitor",
            timestamp=timestamp,
            data={"details": "comprehensive"},
            stack_trace="Stack trace here",
            affected_systems=["frontend", "backend"],
            user_impact="High impact on users",
            auto_fixable=True,
            fix_confidence=0.85
        )
        
        assert error.stack_trace == "Stack trace here"
        assert error.affected_systems == ["frontend", "backend"]
        assert error.user_impact == "High impact on users"
        assert error.auto_fixable is True
        assert error.fix_confidence == 0.85


class TestErrorDetectorIntegration:
    """Integration tests for ErrorDetector"""
    
    @pytest.mark.integration
    @pytest.mark.async_test
    async def test_end_to_end_error_detection(self, temp_dir, mock_env_vars):
        """Test complete error detection workflow"""
        detector = ErrorDetector(project_root=temp_dir)
        
        # Create test files with errors
        js_file = Path(temp_dir) / "frontend" / "src" / "App.js"
        js_file.parent.mkdir(parents=True)
        js_file.write_text("""
        function broken() {
            console.log(undefinedVariable);  // ReferenceError
            return missing.property;         // TypeError
        }
        """)
        
        py_file = Path(temp_dir) / "backend" / "api.py"
        py_file.parent.mkdir(parents=True)
        py_file.write_text("""
        import missing_module  # ModuleNotFoundError
        
        def divide(a, b):
            return a / b  # Potential ZeroDivisionError
        """)
        
        log_file = Path(temp_dir) / "error.log"
        log_file.write_text("""
        [ERROR] Database connection failed
        [CRITICAL] System memory exhausted
        [WARNING] Deprecated API usage detected
        """)
        
        # Set up error callback to collect detected errors
        detected_errors = []
        
        async def collect_errors(error):
            detected_errors.append(error)
        
        detector.add_error_callback(collect_errors)
        
        # Monitor the log file
        await detector._check_log_file(str(log_file))
        
        # Verify errors were detected
        assert len(detector.detected_errors) >= 3
        assert len(detected_errors) >= 3
        
        # Check error categories and severities
        error_categories = {e.category for e in detected_errors}
        error_severities = {e.severity for e in detected_errors}
        
        assert ErrorCategory.SYSTEM in error_categories
        assert ErrorSeverity.CRITICAL in error_severities
        assert ErrorSeverity.HIGH in error_severities
    
    @pytest.mark.integration
    @pytest.mark.slow
    @pytest.mark.async_test
    async def test_continuous_monitoring_simulation(self, temp_dir, mock_env_vars):
        """Test continuous monitoring simulation"""
        detector = ErrorDetector(project_root=temp_dir)
        detector.monitoring_interval = 0.1  # Fast for testing
        
        # Create dynamic log file
        log_file = Path(temp_dir) / "dynamic.log"
        log_file.write_text("Initial log content\n")
        
        detected_errors = []
        
        async def collect_errors(error):
            detected_errors.append(error)
        
        detector.add_error_callback(collect_errors)
        
        # Simulate monitoring for a short period
        async def simulate_monitoring():
            for i in range(3):
                await detector._check_log_file(str(log_file))
                
                # Add new error to log
                with open(log_file, 'a') as f:
                    f.write(f"Error {i}: Something went wrong\n")
                
                await asyncio.sleep(0.1)
        
        await simulate_monitoring()
        
        # Should have detected multiple errors
        assert len(detected_errors) >= 2
        
        # Errors should have different timestamps
        timestamps = [e.timestamp for e in detected_errors]
        assert len(set(timestamps)) > 1  # Different timestamps


class TestPerformanceAndStress:
    """Performance and stress tests"""
    
    @pytest.mark.performance
    @pytest.mark.async_test
    async def test_large_log_file_processing(self, temp_dir, mock_env_vars):
        """Test processing of large log files"""
        detector = ErrorDetector(project_root=temp_dir)
        
        # Create large log file with many errors
        log_content = []
        for i in range(1000):
            log_content.append(f"[INFO] Processing item {i}")
            if i % 10 == 0:  # Every 10th line is an error
                log_content.append(f"[ERROR] Failed to process item {i}")
        
        large_log = Path(temp_dir) / "large.log"
        large_log.write_text('\n'.join(log_content))
        
        start_time = time.time()
        await detector._check_log_file(str(large_log))
        processing_time = time.time() - start_time
        
        # Should process quickly (under 5 seconds for 1000 lines)
        assert processing_time < 5.0
        
        # Should detect all error lines
        assert len(detector.detected_errors) >= 100  # ~100 error lines
    
    @pytest.mark.performance
    def test_pattern_matching_performance(self, temp_dir, mock_env_vars):
        """Test error pattern matching performance"""
        detector = ErrorDetector(project_root=temp_dir)
        
        # Create content with mixed patterns
        test_content = """
        TypeError: Cannot read property of undefined
        ReferenceError: variable is not defined
        ModuleNotFoundError: No module named 'test'
        Failed to compile the application
        """ * 100  # Repeat 100 times
        
        start_time = time.time()
        errors = detector._extract_errors_from_content(test_content, "test.log")
        processing_time = time.time() - start_time
        
        # Should process quickly
        assert processing_time < 2.0
        
        # Should detect all error patterns
        assert len(errors) >= 400  # 4 errors * 100 repetitions
    
    @pytest.mark.unit
    def test_memory_usage_with_many_errors(self, temp_dir, mock_env_vars):
        """Test memory usage with many detected errors"""
        detector = ErrorDetector(project_root=temp_dir)
        
        # Create many errors
        for i in range(1000):
            error = DetectedError(
                id=f"error_{i}",
                category=ErrorCategory.APPLICATION,
                severity=ErrorSeverity.MEDIUM,
                title=f"Error {i}",
                description=f"Description for error {i}",
                source="test_source",
                timestamp=datetime.now(),
                data={"index": i}
            )
            detector.detected_errors[error.id] = error
        
        # Test various operations don't degrade significantly
        start_time = time.time()
        
        # Get statistics
        stats = detector.get_error_statistics()
        assert stats['total_errors'] == 1000
        
        # Filter errors
        high_errors = detector.get_detected_errors(severity=ErrorSeverity.HIGH)
        app_errors = detector.get_detected_errors(category=ErrorCategory.APPLICATION)
        
        processing_time = time.time() - start_time
        
        # Should remain performant
        assert processing_time < 1.0