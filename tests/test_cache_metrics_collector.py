"""
Tests for the CacheMetricsCollector module.
"""

import unittest
import time
import sys
import os
import json
import datetime
from unittest import mock

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))

# Mock redis module
sys.modules['redis'] = mock.MagicMock()

from src.cache.cache_metrics_collector import CacheMetricsCollector


class TestCacheMetricsCollector(unittest.TestCase):
    """Test functionality of CacheMetricsCollector."""

    def setUp(self):
        """Set up test environment before each test."""
        # Create a mock cache manager
        self.cache_manager = mock.MagicMock()
        
        # Set up mock stats for the cache manager
        self.initial_stats = {
            "total_requests": 1000,
            "hits": 800,
            "misses": 200,
            "hit_rate": 0.8,
            "redis_hits": 100,
            "redis_misses": 150,
            "memory_cache_size": 500,
            "memory_cache_limit": 1000,
            "memory_evictions": 50,
            "compressed_items": 30
        }
        self.cache_manager.get_stats.return_value = self.initial_stats
        
        # Initialize metrics collector with disabled periodic collection
        self.metrics_collector = CacheMetricsCollector(
            cache_manager=self.cache_manager,
            metrics_namespace="test",
            collection_interval=60,
            retention_period=3600,
            enable_periodic_collection=False
        )

    def test_collect_metrics(self):
        """Test collecting metrics from cache manager."""
        # Collect initial metrics
        metrics = self.metrics_collector.collect_metrics()
        
        # Verify collected metrics
        self.assertEqual(metrics["hits"], 800)
        self.assertEqual(metrics["misses"], 200)
        self.assertEqual(metrics["hit_rate"], 0.8)
        self.assertEqual(metrics["memory_cache_size"], 500)
        self.assertEqual(metrics["memory_cache_limit"], 1000)
        self.assertEqual(metrics["cache_utilization"], 0.5)
        
        # Verify timestamp fields
        self.assertIn("timestamp", metrics)
        self.assertIn("datetime", metrics)
        
        # Time-based metrics should be empty on first collection
        self.assertEqual(metrics["time_based"], {})
        
        # Update stats and collect again
        updated_stats = self.initial_stats.copy()
        updated_stats["hits"] = 900
        updated_stats["total_requests"] = 1100
        updated_stats["hit_rate"] = 900 / 1100
        self.cache_manager.get_stats.return_value = updated_stats
        
        # Wait a bit to have a time delta
        time.sleep(0.1)
        
        # Collect metrics again
        new_metrics = self.metrics_collector.collect_metrics()
        
        # Verify updated metrics
        self.assertEqual(new_metrics["hits"], 900)
        self.assertEqual(new_metrics["hit_rate"], 900 / 1100)
        
        # Verify time-based metrics
        self.assertIn("time_based", new_metrics)
        self.assertIn("hits_per_second", new_metrics["time_based"])
        hits_per_second = new_metrics["time_based"]["hits_per_second"]
        
        # We added 100 hits, so hits_per_second should be about 100 / (time delta)
        # Allow some margin for test execution time
        self.assertGreater(hits_per_second, 10)  # Should be much higher than 10/s
    
    def test_get_recent_metrics(self):
        """Test retrieving recent metrics."""
        # Collect some metrics
        for i in range(5):
            # Update stats slightly for each collection
            stats = self.initial_stats.copy()
            stats["hits"] = 800 + (i * 20)
            stats["total_requests"] = 1000 + (i * 20)
            stats["hit_rate"] = stats["hits"] / stats["total_requests"]
            self.cache_manager.get_stats.return_value = stats
            
            # Collect metrics
            self.metrics_collector.collect_metrics()
        
        # Get recent metrics (should be all 5)
        recent = self.metrics_collector.get_recent_metrics()
        self.assertEqual(len(recent), 5)
        
        # Get just the last 3
        recent = self.metrics_collector.get_recent_metrics(3)
        self.assertEqual(len(recent), 3)
        
        # Verify they're the most recent ones
        self.assertEqual(recent[0]["hits"], 840)
        self.assertEqual(recent[1]["hits"], 860)
        self.assertEqual(recent[2]["hits"], 880)
    
    def test_get_metrics_since(self):
        """Test retrieving metrics since a timestamp."""
        # Collect metrics with known timestamps
        metrics = []
        now = time.time()
        
        # Create metrics at 5 different timestamps, one minute apart
        for i in range(5):
            # Create a metric with a fixed timestamp
            timestamp = now - (5 - i) * 60  # 5, 4, 3, 2, 1 minutes ago
            
            with mock.patch('time.time', return_value=timestamp):
                # Update stats for collection
                stats = self.initial_stats.copy()
                stats["hits"] = 800 + (i * 20)
                self.cache_manager.get_stats.return_value = stats
                
                # Collect metrics
                metric = self.metrics_collector.collect_metrics()
                metrics.append(metric)
        
        # Get metrics since 3 minutes ago
        since_time = now - 3 * 60
        filtered = self.metrics_collector.get_metrics_since(since_time)
        
        # Should have the 3 most recent metrics
        self.assertEqual(len(filtered), 3)
        
        # Verify timestamps are correct
        for metric in filtered:
            self.assertGreaterEqual(metric["timestamp"], since_time)
    
    def test_get_aggregated_metrics(self):
        """Test aggregating metrics over time."""
        # Collect metrics with varying hit rates
        hit_rates = [0.7, 0.75, 0.8, 0.85, 0.9]
        
        # Create metrics at 5 different timestamps
        now = time.time()
        for i, hit_rate in enumerate(hit_rates):
            # Create a metric with a fixed timestamp
            timestamp = now - (5 - i) * 60  # 5, 4, 3, 2, 1 minutes ago
            
            with mock.patch('time.time', return_value=timestamp):
                # Update stats for collection
                stats = self.initial_stats.copy()
                stats["hit_rate"] = hit_rate
                stats["cache_utilization"] = 0.5 + (i * 0.1)  # 0.5, 0.6, 0.7, 0.8, 0.9
                self.cache_manager.get_stats.return_value = stats
                
                # Collect metrics
                self.metrics_collector.collect_metrics()
        
        # Get aggregated metrics for the last 10 minutes
        with mock.patch('time.time', return_value=now):
            aggregated = self.metrics_collector.get_aggregated_metrics(10 * 60)
        
        # Verify aggregate calculations
        self.assertEqual(aggregated["samples"], 5)
        self.assertAlmostEqual(aggregated["hit_rate"]["avg"], sum(hit_rates) / len(hit_rates))
        self.assertAlmostEqual(aggregated["hit_rate"]["min"], min(hit_rates))
        self.assertAlmostEqual(aggregated["hit_rate"]["max"], max(hit_rates))
        
        # Check cache utilization aggregates
        utils = [0.5, 0.6, 0.7, 0.8, 0.9]
        self.assertAlmostEqual(aggregated["cache_utilization"]["avg"], sum(utils) / len(utils))
        self.assertAlmostEqual(aggregated["cache_utilization"]["min"], min(utils))
        self.assertAlmostEqual(aggregated["cache_utilization"]["max"], max(utils))
    
    def test_export_metrics_json(self):
        """Test exporting metrics as JSON."""
        # Collect some metrics
        for i in range(3):
            stats = self.initial_stats.copy()
            stats["hits"] = 800 + (i * 50)
            self.cache_manager.get_stats.return_value = stats
            self.metrics_collector.collect_metrics()
        
        # Export as JSON
        json_data = self.metrics_collector.export_metrics_json()
        
        # Parse the JSON
        metrics_data = json.loads(json_data)
        
        # Verify structure
        self.assertEqual(metrics_data["metrics_namespace"], "test")
        self.assertEqual(metrics_data["count"], 3)
        self.assertEqual(len(metrics_data["data"]), 3)
        
        # Verify content
        data = metrics_data["data"]
        self.assertEqual(data[0]["hits"], 800)
        self.assertEqual(data[1]["hits"], 850)
        self.assertEqual(data[2]["hits"], 900)
    
    def test_export_metrics_to_file(self):
        """Test exporting metrics to a file."""
        # Collect some metrics
        for i in range(2):
            self.metrics_collector.collect_metrics()
        
        # Create a temporary file name
        temp_file = os.path.join(os.path.dirname(__file__), "temp_metrics.json")
        
        try:
            # Export to file
            result = self.metrics_collector.export_metrics_to_file(temp_file)
            
            # Verify export succeeded
            self.assertTrue(result)
            self.assertTrue(os.path.exists(temp_file))
            
            # Read the file and verify content
            with open(temp_file, 'r') as f:
                metrics_data = json.loads(f.read())
            
            self.assertEqual(metrics_data["count"], 2)
        finally:
            # Clean up
            if os.path.exists(temp_file):
                os.remove(temp_file)
    
    def test_custom_metrics(self):
        """Test recording custom metrics."""
        # Record a custom metric
        self.metrics_collector.record_metric("api_response_time", 150)
        
        # Record another custom metric
        self.metrics_collector.record_metric("active_users", 42)
        
        # Get recent metrics
        metrics = self.metrics_collector.get_recent_metrics(1)[0]
        
        # Verify custom metrics were recorded
        self.assertIn("custom", metrics)
        self.assertEqual(metrics["custom"]["api_response_time"], 150)
        self.assertEqual(metrics["custom"]["active_users"], 42)
    
    def test_alert_conditions(self):
        """Test alert condition detection."""
        # Create metrics with a poor hit rate
        with mock.patch('time.time', return_value=time.time()):
            # Set up stats for alert condition
            stats = self.initial_stats.copy()
            stats["hit_rate"] = 0.4  # Below critical threshold of 0.5
            stats["memory_cache_size"] = 950
            stats["memory_cache_limit"] = 1000
            self.cache_manager.get_stats.return_value = stats
            
            # Collect metrics
            self.metrics_collector.collect_metrics()
        
        # Get alert conditions
        alerts = self.metrics_collector.get_alert_conditions()
        
        # Should have 2 alerts (hit rate and cache utilization)
        self.assertEqual(len(alerts), 2)
        
        # Verify hit rate alert
        hit_rate_alert = next(a for a in alerts if a["metric"] == "hit_rate")
        self.assertEqual(hit_rate_alert["severity"], "critical")
        self.assertEqual(hit_rate_alert["value"], 0.4)
        
        # Verify cache utilization alert
        utilization_alert = next(a for a in alerts if a["metric"] == "cache_utilization")
        self.assertEqual(utilization_alert["severity"], "warning")
        self.assertAlmostEqual(utilization_alert["value"], 0.95)
    
    def test_start_stop_collection(self):
        """Test starting and stopping periodic collection."""
        # Start collection
        self.metrics_collector.start_collection()
        
        # Verify collection started
        self.assertTrue(self.metrics_collector.running)
        self.assertIsNotNone(self.metrics_collector.collector_thread)
        
        # Stop collection
        self.metrics_collector.stop_collection()
        
        # Verify collection stopped
        self.assertFalse(self.metrics_collector.running)


if __name__ == '__main__':
    unittest.main()