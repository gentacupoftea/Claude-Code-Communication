"""
Tests for the sync dashboard module.
"""

import os
import json
import unittest
from unittest.mock import MagicMock, patch
from datetime import datetime

from src.sync.sync_dashboard import SyncDashboard


class TestSyncDashboard(unittest.TestCase):
    """Test cases for the SyncDashboard class."""
    
    def setUp(self):
        """Set up test fixtures."""
        # Create mock metrics collector
        self.mock_metrics_collector = MagicMock()
        
        # Mock recent metrics
        self.recent_metrics = [
            {
                "timestamp": 1621500000.0,
                "datetime": "2021-05-20T10:00:00",
                "success_rate": 0.85,
                "avg_sync_duration": 1.5,
                "success_count": 85,
                "failure_count": 15,
                "partial_count": 0,
                "total_syncs": 100,
                "entities_processed": 1000,
                "bytes_transferred": 102400,
                "api_calls": {
                    "shopify": {"total": 200, "success": 190, "failure": 10},
                    "external": {"total": 150, "success": 140, "failure": 10}
                },
                "errors": [
                    {"entity_type": "product", "error_type": "connection_timeout", "count": 8},
                    {"entity_type": "order", "error_type": "auth_failure", "count": 7}
                ],
                "job_statuses": {
                    "pending": 5,
                    "in_progress": 10,
                    "completed": 80,
                    "failed": 5,
                    "partial": 0,
                    "cancelled": 0
                }
            }
        ]
        
        # Mock aggregated metrics
        self.aggregated_metrics = {
            "timestamp": 1621500000.0,
            "datetime": "2021-05-20T10:00:00",
            "samples": 60,
            "time_window_seconds": 3600,
            "success_rate": {
                "avg": 0.85,
                "min": 0.75,
                "max": 0.95
            },
            "sync_duration": {
                "avg": 1.5,
                "min": 1.0,
                "max": 2.0
            },
            "shopify_api_success_rate": {
                "avg": 0.95,
                "min": 0.9,
                "max": 1.0
            },
            "external_api_success_rate": {
                "avg": 0.93,
                "min": 0.88,
                "max": 0.98
            },
            "data_volume": {
                "entities_processed": 50000,
                "bytes_transferred": 5242880
            },
            "most_common_errors": [
                {"entity_type": "product", "error_type": "connection_timeout", "count": 150},
                {"entity_type": "order", "error_type": "auth_failure", "count": 100},
                {"entity_type": "inventory", "error_type": "validation_error", "count": 75}
            ]
        }
        
        # Mock alerts
        self.alerts = [
            {
                "severity": "warning",
                "metric": "sync_duration",
                "value": 1.5,
                "threshold": 1.0,
                "description": "Average sync duration is high: 1.50s"
            }
        ]
        
        # Set up mock return values
        self.mock_metrics_collector.get_recent_metrics.return_value = self.recent_metrics
        self.mock_metrics_collector.get_aggregated_metrics.return_value = self.aggregated_metrics
        self.mock_metrics_collector.get_alert_conditions.return_value = self.alerts
        
        # Create dashboard instance
        self.dashboard = SyncDashboard(
            metrics_collector=self.mock_metrics_collector,
            dashboard_title="Test Sync Dashboard"
        )
    
    def test_init(self):
        """Test initialization of dashboard."""
        self.assertEqual(self.dashboard.dashboard_title, "Test Sync Dashboard")
        self.assertEqual(self.dashboard.refresh_interval, 60)
        self.assertEqual(self.dashboard.metrics_collector, self.mock_metrics_collector)
    
    def test_generate_dashboard_html(self):
        """Test generating dashboard HTML."""
        html = self.dashboard.generate_dashboard_html()
        
        # Verify HTML contains key elements
        self.assertIn("Test Sync Dashboard", html)
        self.assertIn("Sync Performance Overview", html)
        self.assertIn("Performance Trends", html)
        self.assertIn("Most Common Errors", html)
        self.assertIn("Alerts", html)
        
        # Verify chart sections are included
        self.assertIn("<canvas id=\"successRateChart\"></canvas>", html)
        self.assertIn("<canvas id=\"syncDurationChart\"></canvas>", html)
        self.assertIn("<canvas id=\"apiSuccessRateChart\"></canvas>", html)
        self.assertIn("<canvas id=\"errorCountChart\"></canvas>", html)
        
        # Verify stats are included
        self.assertIn("Sync Success Rate", html)
        self.assertIn("Average Sync Duration", html)
        self.assertIn("Shopify API Success Rate", html)
        self.assertIn("External API Success Rate", html)
        self.assertIn("Entities Processed", html)
        self.assertIn("Data Transferred", html)
    
    def test_generate_text_report(self):
        """Test generating text report."""
        report = self.dashboard.generate_text_report()
        
        # Verify report contains key sections
        self.assertIn("SYNC PERFORMANCE REPORT", report)
        self.assertIn("PERFORMANCE SUMMARY:", report)
        self.assertIn("Success Rate:", report)
        self.assertIn("Avg Sync Duration:", report)
        self.assertIn("Shopify API Rate:", report)
        self.assertIn("External API Rate:", report)
        self.assertIn("Entities Processed:", report)
        self.assertIn("Data Transferred:", report)
        self.assertIn("MOST COMMON ERRORS:", report)
        self.assertIn("ALERTS:", report)
        
        # Verify report contains correct values
        self.assertIn("85.0% (min: 75.0%, max: 95.0%)", report)  # Success rate
        self.assertIn("1.5s (min: 1.0s, max: 2.0s)", report)    # Sync duration
    
    def test_save_dashboard_html(self):
        """Test saving dashboard HTML to file."""
        filename = "test_sync_dashboard.html"
        
        # Mock open to avoid actual file creation
        with patch("builtins.open", unittest.mock.mock_open()) as mock_open:
            result = self.dashboard.save_dashboard_html(filename)
            
            # Verify file was written
            self.assertTrue(result)
            mock_open.assert_called_once_with(filename, 'w')
            
            # Verify content written contains dashboard title
            handle = mock_open()
            written_content = "".join([call.args[0] for call in handle.write.call_args_list])
            self.assertIn("Test Sync Dashboard", written_content)
    
    def test_save_text_report(self):
        """Test saving text report to file."""
        filename = "test_sync_report.txt"
        
        # Mock open to avoid actual file creation
        with patch("builtins.open", unittest.mock.mock_open()) as mock_open:
            result = self.dashboard.save_text_report(filename)
            
            # Verify file was written
            self.assertTrue(result)
            mock_open.assert_called_once_with(filename, 'w')
            
            # Verify content written contains report header
            handle = mock_open()
            written_content = "".join([call.args[0] for call in handle.write.call_args_list])
            self.assertIn("SYNC PERFORMANCE REPORT", written_content)
    
    def test_export_metrics_csv(self):
        """Test exporting metrics to CSV."""
        filename = "test_sync_metrics.csv"
        
        # Mock open and csv.DictWriter to avoid actual file creation
        with patch("builtins.open", unittest.mock.mock_open()) as mock_open, \
             patch("csv.DictWriter") as mock_csv_writer:
            
            # Mock csv writer instance
            mock_writer = MagicMock()
            mock_csv_writer.return_value = mock_writer
            
            result = self.dashboard.export_metrics_csv(filename)
            
            # Verify file was opened
            self.assertTrue(result)
            mock_open.assert_called_once_with(filename, 'w', newline='')
            
            # Verify CSV writer methods were called
            mock_writer.writeheader.assert_called_once()
            mock_writer.writerow.assert_called()
    
    def test_export_metrics_excel_not_installed(self):
        """Test exporting metrics to Excel when pandas is not installed."""
        filename = "test_sync_metrics.xlsx"
        
        # Mock import error when pandas is not installed
        with patch("builtins.print") as mock_print, \
             patch("builtins.__import__", side_effect=ImportError("No module named 'pandas'")):
            
            result = self.dashboard.export_metrics_excel(filename)
            
            # Verify method reported error
            self.assertFalse(result)
            mock_print.assert_called_with("pandas and openpyxl packages are required for Excel export")


if __name__ == '__main__':
    unittest.main()