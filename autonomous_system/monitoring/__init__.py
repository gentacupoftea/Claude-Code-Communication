"""
Monitoring Package
システム監視・エラー検知・自動修復
"""

import warnings

# Import monitoring components with graceful fallbacks
try:
    from .error_detector import ErrorDetector
    ERROR_DETECTOR_AVAILABLE = True
except ImportError as e:
    ERROR_DETECTOR_AVAILABLE = False
    warnings.warn(f"ErrorDetector not available: {e}", UserWarning)
    
    class ErrorDetector:
        """Fallback ErrorDetector class when dependencies are missing"""
        def __init__(self, *args, **kwargs):
            warnings.warn("ErrorDetector is in fallback mode - limited functionality", UserWarning)
        
        async def start_monitoring(self):
            warnings.warn("Error detection monitoring disabled - dependencies missing", UserWarning)
        
        def add_error_callback(self, callback):
            pass
        
        def get_detected_errors(self, *args, **kwargs):
            return []
        
        def get_error_statistics(self):
            return {'total_errors': 0, 'message': 'Error detection disabled'}
        
        async def stop_monitoring(self):
            pass

try:
    from .system_monitor import SystemMonitor
    SYSTEM_MONITOR_AVAILABLE = True
except ImportError as e:
    SYSTEM_MONITOR_AVAILABLE = False
    warnings.warn(f"SystemMonitor not available: {e}", UserWarning)
    
    class SystemMonitor:
        """Fallback SystemMonitor class when dependencies are missing"""
        def __init__(self, *args, **kwargs):
            warnings.warn("SystemMonitor is in fallback mode - limited functionality", UserWarning)
        
        async def start_monitoring(self):
            warnings.warn("System monitoring disabled - dependencies missing", UserWarning)
        
        def add_alert_callback(self, callback):
            pass
        
        def get_current_status(self):
            return {'status': 'disabled', 'message': 'System monitoring disabled - dependencies missing'}
        
        def get_metrics_history(self, hours=1):
            return []
        
        def get_performance_summary(self):
            return {'status': 'disabled'}
        
        async def get_system_info(self):
            return {'status': 'disabled', 'message': 'System monitoring disabled'}
        
        async def stop_monitoring(self):
            pass

__all__ = ['ErrorDetector', 'SystemMonitor', 'ERROR_DETECTOR_AVAILABLE', 'SYSTEM_MONITOR_AVAILABLE']