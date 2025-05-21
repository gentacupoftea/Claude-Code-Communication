"""
Tests for the CacheDashboard module.
"""

import unittest
import time
import sys
import os
import json
import re
from unittest import mock

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))

# Mock redis module
sys.modules['redis'] = mock.MagicMock()

from src.cache.cache_dashboard import CacheDashboard


class TestCacheDashboard(unittest.TestCase):
    """Test functionality of CacheDashboard."""

    def setUp(self):
        """Set up test environment before each test."""
        # Create a mock metrics collector
        self.metrics_collector = mock.MagicMock()
        
        # Mock recent metrics
        self.recent_metrics = []
        now = time.time()
        for i in range(10):
            metric = {
                "timestamp": now - (10 - i) * 60,  # 10, 9, 8, ... minutes ago
                "datetime": f"2025-01-01T{10+i:02d}:00:00",
                "hits": 800 + (i * 10),
                "misses": 200 - (i * 5),
                "total_requests": 1000 + (i * 5),
                "hit_rate": (800 + (i * 10)) / (1000 + (i * 5)),
                "memory_cache_size": 400 + (i * 20),
                "memory_cache_limit": 1000,
                "time_based": {
                    "hits_per_second": 10 + i,
                    "misses_per_second": 5 - (i * 0.2),
                    "memory_evictions_per_second": i * 0.5
                }
            }
            self.recent_metrics.append(metric)
        
        # Mock aggregated metrics
        self.aggregated_metrics = {
            "timestamp": now,
            "datetime": "2025-01-01T12:00:00",
            "samples": 60,
            "time_window_seconds": 3600,
            "hit_rate": {
                "avg": 0.85,
                "min": 0.80,
                "max": 0.90
            },
            "cache_utilization": {
                "avg": 0.5,
                "min": 0.4,
                "max": 0.6
            },
            "hits_per_second": {
                "avg": 15.0,
                "min": 10.0,
                "max": 20.0
            },
            "misses_per_second": {
                "avg": 3.0,
                "min": 1.0,
                "max": 5.0
            },
            "evictions_per_second": {
                "avg": 2.0,
                "min": 0.0,
                "max": 5.0
            }
        }
        
        # Mock alerts
        self.alerts = [
            {
                "severity": "warning",
                "metric": "cache_utilization",
                "value": 0.9,
                "threshold": 0.85,
                "description": "Cache utilization is high: 0.90"
            },
            {
                "severity": "critical",
                "metric": "hit_rate",
                "value": 0.4,
                "threshold": 0.5,
                "description": "Cache hit rate is too low: 0.40"
            }
        ]
        
        # Configure mock returns
        self.metrics_collector.get_recent_metrics.return_value = self.recent_metrics
        self.metrics_collector.get_aggregated_metrics.return_value = self.aggregated_metrics
        self.metrics_collector.get_alert_conditions.return_value = self.alerts
        
        # Initialize dashboard
        self.dashboard = CacheDashboard(
            metrics_collector=self.metrics_collector,
            dashboard_title="Test Dashboard",
            refresh_interval=30
        )

    def test_generate_dashboard_html(self):
        """Test generating HTML dashboard."""
        # Generate dashboard HTML
        html = self.dashboard.generate_dashboard_html(3600)
        
        # Check if HTML is not empty
        self.assertTrue(html)
        self.assertTrue(len(html) > 100)
        
        # Verify critical HTML components are included
        self.assertIn('html', html.lower())
        self.assertIn('body', html.lower())
        
        # Verify basic content
        self.assertIn('Test Dashboard', html)
        self.assertIn('Cache Performance', html)
        
        # Verify chart components
        self.assertIn('Chart', html)
        self.assertIn('canvas', html.lower())
        self.assertIn('hitRateChart', html)
    
    def test_save_dashboard_html(self):
        """Test saving HTML dashboard to a file."""
        # Create a temporary file path
        temp_file = os.path.join(os.path.dirname(__file__), "temp_dashboard.html")
        
        try:
            # Save dashboard
            result = self.dashboard.save_dashboard_html(temp_file, 3600)
            
            # Verify save succeeded
            self.assertTrue(result)
            self.assertTrue(os.path.exists(temp_file))
            
            # Read the file and verify it contains content
            with open(temp_file, 'r') as f:
                content = f.read()
            
            self.assertTrue(len(content) > 100)
            self.assertIn('Test Dashboard', content)
        finally:
            # Clean up
            if os.path.exists(temp_file):
                os.remove(temp_file)
    
    def test_generate_text_report(self):
        """Test generating plain text performance report."""
        # Generate text report
        report = self.dashboard.generate_text_report(3600)
        
        # Verify report content
        self.assertIn("CACHE PERFORMANCE REPORT", report)
        self.assertIn("Report covers the last 60 minutes (60 samples)", report)
        
        # Verify performance metrics are included
        self.assertIn("Hit Rate:         85.0%", report)
        self.assertIn("Cache Utilization: 50.0%", report)
        self.assertIn("Hits per Second:   15.0", report)
        
        # Verify alerts are included
        self.assertIn("[WARNING] Cache utilization is high", report)
        self.assertIn("[CRITICAL] Cache hit rate is too low", report)
    
    def test_save_text_report(self):
        """Test saving text report to a file."""
        # Create a temporary file path
        temp_file = os.path.join(os.path.dirname(__file__), "temp_report.txt")
        
        try:
            # Save report
            result = self.dashboard.save_text_report(temp_file, 3600)
            
            # Verify save succeeded
            self.assertTrue(result)
            self.assertTrue(os.path.exists(temp_file))
            
            # Read the file and verify content
            with open(temp_file, 'r') as f:
                content = f.read()
            
            self.assertIn("CACHE PERFORMANCE REPORT", content)
            self.assertIn("Hit Rate:", content)
        finally:
            # Clean up
            if os.path.exists(temp_file):
                os.remove(temp_file)


if __name__ == '__main__':
    unittest.main()