"""
Tests for the sync metrics collector module.
"""

import time
import json
import unittest
from unittest.mock import MagicMock, patch
from datetime import datetime, timedelta

from src.sync.sync_metrics_collector import SyncMetricsCollector, SyncMetricType


class TestSyncMetricsCollector(unittest.TestCase):
    """Test cases for the SyncMetricsCollector class."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.mock_sync_manager = MagicMock()
        self.mock_sync_manager.active_jobs = {
            'job1': {'status': 'in_progress'},
            'job2': {'status': 'completed'},
            'job3': {'status': 'pending'}
        }
        
        # Create collector with mocked sync manager and disable periodic collection
        self.metrics_collector = SyncMetricsCollector(
            sync_manager=self.mock_sync_manager,
            enable_periodic_collection=False
        )
    
    def test_init(self):
        """Test initialization of metrics collector."""
        self.assertEqual(self.metrics_collector.metrics_namespace, "sync")
        self.assertEqual(self.metrics_collector.collection_interval, 60)
        self.assertEqual(self.metrics_collector.retention_period, 86400)
        self.assertFalse(self.metrics_collector.running)
        self.assertIsNone(self.metrics_collector.collector_thread)
        self.assertEqual(self.metrics_collector.metrics_data, [])
    
    def test_collect_metrics(self):
        """Test collection of metrics."""
        # Record some test data
        self.metrics_collector.record_sync_result(
            job_id='test_job_1',
            entity_type='product',
            success=True,
            duration=1.5,
            entities_count=10,
            data_size=1024
        )
        
        self.metrics_collector.record_api_call(
            api_type='shopify',
            endpoint='/products',
            success=True,
            duration=0.5,
            request_size=256,
            response_size=512
        )
        
        # Collect metrics
        metrics = self.metrics_collector.collect_metrics()
        
        # Verify metrics structure
        self.assertIn('timestamp', metrics)
        self.assertIn('datetime', metrics)
        self.assertIn('success_rate', metrics)
        self.assertIn('avg_sync_duration', metrics)
        self.assertIn('success_count', metrics)
        self.assertIn('failure_count', metrics)
        self.assertIn('total_syncs', metrics)
        self.assertIn('api_calls', metrics)
        
        # Verify values
        self.assertEqual(metrics['success_count'], 1)
        self.assertEqual(metrics['failure_count'], 0)
        self.assertEqual(metrics['total_syncs'], 1)
        self.assertEqual(metrics['entities_processed'], 10)
        self.assertEqual(metrics['bytes_transferred'], 1024 + 256 + 512)
        self.assertEqual(metrics['api_calls']['shopify']['total'], 1)
        self.assertEqual(metrics['api_calls']['shopify']['success'], 1)
        
        # Verify metrics are stored
        self.assertEqual(len(self.metrics_collector.metrics_data), 1)
    
    def test_record_sync_result(self):
        """Test recording sync results."""
        # Test successful sync
        self.metrics_collector.record_sync_result(
            job_id='test_job_1',
            entity_type='product',
            success=True,
            duration=1.5,
            entities_count=10,
            data_size=1024
        )
        
        self.assertEqual(self.metrics_collector.sync_results['total'], 1)
        self.assertEqual(self.metrics_collector.sync_results['success'], 1)
        self.assertEqual(self.metrics_collector.sync_results['failure'], 0)
        self.assertEqual(self.metrics_collector.sync_times['test_job_1'], 1.5)
        self.assertEqual(self.metrics_collector.data_volume['entities_processed'], 10)
        self.assertEqual(self.metrics_collector.data_volume['bytes_transferred'], 1024)
        
        # Test failed sync
        self.metrics_collector.record_sync_result(
            job_id='test_job_2',
            entity_type='product',
            success=False,
            duration=0.8,
            entities_count=5,
            data_size=512
        )
        
        self.assertEqual(self.metrics_collector.sync_results['total'], 2)
        self.assertEqual(self.metrics_collector.sync_results['success'], 1)
        self.assertEqual(self.metrics_collector.sync_results['failure'], 1)
        self.assertEqual(self.metrics_collector.sync_times['test_job_2'], 0.8)
        self.assertEqual(self.metrics_collector.data_volume['entities_processed'], 15)
        self.assertEqual(self.metrics_collector.data_volume['bytes_transferred'], 1536)
        
        # Test partial sync
        self.metrics_collector.record_sync_result(
            job_id='test_job_3',
            entity_type='product',
            success=True,
            partial=True,
            duration=2.0,
            entities_count=20,
            data_size=2048
        )
        
        self.assertEqual(self.metrics_collector.sync_results['total'], 3)
        self.assertEqual(self.metrics_collector.sync_results['success'], 1)
        self.assertEqual(self.metrics_collector.sync_results['partial'], 1)
        self.assertEqual(self.metrics_collector.sync_results['failure'], 1)
    
    def test_record_api_call(self):
        """Test recording API calls."""
        # Test Shopify API call
        self.metrics_collector.record_api_call(
            api_type='shopify',
            endpoint='/products',
            success=True,
            duration=0.5,
            request_size=256,
            response_size=512
        )
        
        self.assertEqual(self.metrics_collector.api_call_counts['shopify']['total'], 1)
        self.assertEqual(self.metrics_collector.api_call_counts['shopify']['success'], 1)
        self.assertEqual(self.metrics_collector.api_call_counts['shopify']['failure'], 0)
        self.assertEqual(self.metrics_collector.data_volume['bytes_transferred'], 768)
        
        # Test external API call (failure)
        self.metrics_collector.record_api_call(
            api_type='external',
            endpoint='/inventory',
            success=False,
            duration=1.2,
            request_size=128,
            response_size=0
        )
        
        self.assertEqual(self.metrics_collector.api_call_counts['external']['total'], 1)
        self.assertEqual(self.metrics_collector.api_call_counts['external']['success'], 0)
        self.assertEqual(self.metrics_collector.api_call_counts['external']['failure'], 1)
        self.assertEqual(self.metrics_collector.data_volume['bytes_transferred'], 896)
    
    def test_record_error(self):
        """Test recording errors."""
        self.metrics_collector.record_error("connection_timeout", "product")
        self.metrics_collector.record_error("auth_failure", "order")
        self.metrics_collector.record_error("connection_timeout", "product")
        
        # Get error summary
        error_summary = self.metrics_collector._get_error_summary()
        
        # Verify error counts
        self.assertEqual(len(error_summary), 2)
        
        # Find connection_timeout error
        timeout_error = next((e for e in error_summary if e["error_type"] == "connection_timeout"), None)
        self.assertIsNotNone(timeout_error)
        self.assertEqual(timeout_error["count"], 2)
        self.assertEqual(timeout_error["entity_type"], "product")
        
        # Find auth_failure error
        auth_error = next((e for e in error_summary if e["error_type"] == "auth_failure"), None)
        self.assertIsNotNone(auth_error)
        self.assertEqual(auth_error["count"], 1)
        self.assertEqual(auth_error["entity_type"], "order")
    
    def test_get_aggregated_metrics(self):
        """Test getting aggregated metrics."""
        # Mock metrics data with timestamps
        now = time.time()
        one_hour_ago = now - 3600
        
        self.metrics_collector.metrics_data = [
            {
                "timestamp": one_hour_ago + 600,  # 10 minutes after one_hour_ago
                "success_rate": 0.8,
                "avg_sync_duration": 1.5,
                "api_calls": {
                    "shopify": {"total": 10, "success": 8},
                    "external": {"total": 5, "success": 4}
                },
                "entities_processed": 100,
                "bytes_transferred": 10240
            },
            {
                "timestamp": one_hour_ago + 1200,  # 20 minutes after one_hour_ago
                "success_rate": 0.9,
                "avg_sync_duration": 1.2,
                "api_calls": {
                    "shopify": {"total": 15, "success": 14},
                    "external": {"total": 8, "success": 7}
                },
                "entities_processed": 150,
                "bytes_transferred": 15360
            }
        ]
        
        # Get aggregated metrics for the last hour
        aggregated = self.metrics_collector.get_aggregated_metrics(3600)
        
        # Verify aggregated metrics
        self.assertEqual(aggregated["samples"], 2)
        self.assertEqual(aggregated["success_rate"]["avg"], 0.85)
        self.assertEqual(aggregated["success_rate"]["min"], 0.8)
        self.assertEqual(aggregated["success_rate"]["max"], 0.9)
        self.assertEqual(aggregated["sync_duration"]["avg"], 1.35)
        self.assertEqual(aggregated["data_volume"]["entities_processed"], 250)
        self.assertEqual(aggregated["data_volume"]["bytes_transferred"], 25600)
    
    def test_export_metrics_json(self):
        """Test exporting metrics as JSON."""
        # Add sample metrics
        self.metrics_collector.metrics_data = [
            {"timestamp": time.time(), "success_rate": 0.8, "total_syncs": 10}
        ]
        
        # Export as JSON
        json_data = self.metrics_collector.export_metrics_json()
        
        # Parse the JSON and verify structure
        data = json.loads(json_data)
        self.assertEqual(data["metrics_namespace"], "sync")
        self.assertEqual(data["count"], 1)
        self.assertEqual(len(data["data"]), 1)
        self.assertEqual(data["data"][0]["success_rate"], 0.8)
        self.assertEqual(data["data"][0]["total_syncs"], 10)
    
    def test_get_alert_conditions(self):
        """Test getting alert conditions."""
        # Mock aggregated metrics
        mock_aggregated = {
            "success_rate": {"avg": 0.65, "min": 0.6, "max": 0.7},
            "sync_duration": {"avg": 35.0, "min": 20.0, "max": 50.0},
            "shopify_api_success_rate": {"avg": 0.75, "min": 0.7, "max": 0.8},
            "external_api_success_rate": {"avg": 0.92, "min": 0.9, "max": 0.95}
        }
        
        # Mock the get_aggregated_metrics method
        self.metrics_collector.get_aggregated_metrics = MagicMock(return_value=mock_aggregated)
        
        # Get alert conditions
        alerts = self.metrics_collector.get_alert_conditions()
        
        # Verify alert conditions
        self.assertEqual(len(alerts), 3)
        
        # Check for success rate critical alert
        success_rate_alert = next((a for a in alerts if a["metric"] == "success_rate"), None)
        self.assertIsNotNone(success_rate_alert)
        self.assertEqual(success_rate_alert["severity"], "critical")
        
        # Check for Shopify API success rate critical alert
        shopify_api_alert = next((a for a in alerts if a["metric"] == "shopify_api_success_rate"), None)
        self.assertIsNotNone(shopify_api_alert)
        self.assertEqual(shopify_api_alert["severity"], "critical")
        
        # Check for sync duration warning alert
        duration_alert = next((a for a in alerts if a["metric"] == "sync_duration"), None)
        self.assertIsNotNone(duration_alert)
        self.assertEqual(duration_alert["severity"], "warning")
    
    @patch('threading.Thread')
    def test_start_stop_collection(self, mock_thread):
        """Test starting and stopping collection thread."""
        # Test starting collection
        self.metrics_collector.start_collection()
        self.assertTrue(self.metrics_collector.running)
        mock_thread.assert_called_once()
        
        # Test stopping collection
        self.metrics_collector.stop_collection()
        self.assertFalse(self.metrics_collector.running)


if __name__ == '__main__':
    unittest.main()