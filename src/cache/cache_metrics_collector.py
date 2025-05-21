"""
Cache metrics collection and reporting module.

This module provides tools for collecting, aggregating, and reporting
metrics about cache performance and usage.
"""

import time
import json
import logging
import threading
import datetime
from typing import Dict, List, Any, Optional, Union, Tuple


class CacheMetricsCollector:
    """
    Collects and aggregates cache performance metrics.
    
    This class provides methods to track various cache metrics,
    aggregate them over time, and generate reports for monitoring.
    """
    
    def __init__(
        self,
        cache_manager,
        metrics_namespace: str = "cache",
        collection_interval: int = 60,  # Default: collect metrics every minute
        retention_period: int = 86400,  # Default: retain metrics for 1 day
        enable_periodic_collection: bool = True
    ):
        """
        Initialize the metrics collector.
        
        Args:
            cache_manager: The cache manager instance to monitor
            metrics_namespace: Namespace for metrics storage/identification
            collection_interval: How often to collect metrics in seconds
            retention_period: How long to retain metrics in seconds
            enable_periodic_collection: Whether to enable automatic periodic collection
        """
        self.cache_manager = cache_manager
        self.metrics_namespace = metrics_namespace
        self.collection_interval = collection_interval
        self.retention_period = retention_period
        self.enable_periodic_collection = enable_periodic_collection
        
        # Storage for metrics data
        self.metrics_data = []
        self.last_collection_time = 0
        
        # For calculating deltas
        self.last_metrics = {}
        
        # Lifecycle management
        self.running = False
        self.collector_thread = None
        
        # Lock for thread safety
        self.metrics_lock = threading.RLock()
        
        # Logger
        self.logger = logging.getLogger("CacheMetricsCollector")
        
        # Start collection if enabled
        if enable_periodic_collection:
            self.start_collection()
    
    def start_collection(self) -> None:
        """Start periodic metrics collection."""
        with self.metrics_lock:
            if self.running:
                return
                
            self.running = True
            self.collector_thread = threading.Thread(
                target=self._collection_loop,
                daemon=True
            )
            self.collector_thread.start()
            self.logger.info("Started periodic metrics collection")
    
    def stop_collection(self) -> None:
        """Stop periodic metrics collection."""
        with self.metrics_lock:
            self.running = False
            if self.collector_thread:
                # No need to join the thread as it's a daemon
                self.collector_thread = None
                self.logger.info("Stopped periodic metrics collection")
    
    def collect_metrics(self) -> Dict[str, Any]:
        """
        Collect current cache metrics.
        
        Returns:
            Dictionary containing current metrics
        """
        now = time.time()
        
        # Get current stats from the cache manager
        cache_stats = self.cache_manager.get_stats()
        
        # Calculate derived metrics
        hit_rate = cache_stats.get("hit_rate", 0)
        cache_size = cache_stats.get("memory_cache_size", 0)
        cache_limit = cache_stats.get("memory_cache_limit", 1)
        cache_utilization = cache_size / cache_limit if cache_limit > 0 else 0
        
        # Calculate time-based metrics if we have previous data
        time_based = {}
        if self.last_collection_time > 0 and self.last_metrics:
            time_delta = now - self.last_collection_time
            
            # Calculate operations per second
            for key in ["hits", "misses", "redis_hits", "redis_misses", "memory_evictions"]:
                if key in cache_stats and key in self.last_metrics:
                    delta = cache_stats[key] - self.last_metrics[key]
                    time_based[f"{key}_per_second"] = delta / time_delta
        
        # Combine all metrics
        metrics = {
            "timestamp": now,
            "datetime": datetime.datetime.fromtimestamp(now).isoformat(),
            "hit_rate": hit_rate,
            "cache_utilization": cache_utilization,
            "time_based": time_based
        }
        
        # Add all raw stats
        metrics.update(cache_stats)
        
        # Update last metrics for next calculation
        self.last_metrics = cache_stats.copy()
        self.last_collection_time = now
        
        # Store the metrics
        with self.metrics_lock:
            self.metrics_data.append(metrics)
            
            # Remove old metrics based on retention period
            cutoff_time = now - self.retention_period
            self.metrics_data = [m for m in self.metrics_data if m["timestamp"] > cutoff_time]
        
        return metrics
    
    def get_recent_metrics(self, count: int = 60) -> List[Dict[str, Any]]:
        """
        Get the most recent metrics.
        
        Args:
            count: Maximum number of metrics to return
            
        Returns:
            List of recent metrics
        """
        with self.metrics_lock:
            # Return most recent metrics
            return self.metrics_data[-count:]
    
    def get_metrics_since(self, timestamp: float) -> List[Dict[str, Any]]:
        """
        Get metrics since a specific timestamp.
        
        Args:
            timestamp: The timestamp to get metrics from
            
        Returns:
            List of metrics since the timestamp
        """
        with self.metrics_lock:
            return [m for m in self.metrics_data if m["timestamp"] >= timestamp]
    
    def get_aggregated_metrics(self, time_window: int = 3600) -> Dict[str, Any]:
        """
        Get aggregated metrics for a time window.
        
        Args:
            time_window: Time window in seconds for aggregation
            
        Returns:
            Dictionary with aggregated metrics
        """
        now = time.time()
        cutoff_time = now - time_window
        
        with self.metrics_lock:
            # Get metrics in the time window
            window_metrics = [m for m in self.metrics_data if m["timestamp"] > cutoff_time]
            
            if not window_metrics:
                return {
                    "timestamp": now,
                    "datetime": datetime.datetime.fromtimestamp(now).isoformat(),
                    "samples": 0
                }
            
            # Calculate aggregates
            hit_rates = [m.get("hit_rate", 0) for m in window_metrics]
            utilization = [m.get("cache_utilization", 0) for m in window_metrics]
            
            # Time-based metrics
            hits_per_sec = []
            misses_per_sec = []
            evictions_per_sec = []
            
            for m in window_metrics:
                time_based = m.get("time_based", {})
                if "hits_per_second" in time_based:
                    hits_per_sec.append(time_based["hits_per_second"])
                if "misses_per_second" in time_based:
                    misses_per_sec.append(time_based["misses_per_second"])
                if "memory_evictions_per_second" in time_based:
                    evictions_per_sec.append(time_based["memory_evictions_per_second"])
            
            # Calculate statistics
            result = {
                "timestamp": now,
                "datetime": datetime.datetime.fromtimestamp(now).isoformat(),
                "samples": len(window_metrics),
                "time_window_seconds": time_window,
                "hit_rate": {
                    "avg": sum(hit_rates) / len(hit_rates) if hit_rates else 0,
                    "min": min(hit_rates) if hit_rates else 0,
                    "max": max(hit_rates) if hit_rates else 0
                },
                "cache_utilization": {
                    "avg": sum(utilization) / len(utilization) if utilization else 0,
                    "min": min(utilization) if utilization else 0,
                    "max": max(utilization) if utilization else 0
                }
            }
            
            # Add time-based metrics if available
            if hits_per_sec:
                result["hits_per_second"] = {
                    "avg": sum(hits_per_sec) / len(hits_per_sec),
                    "min": min(hits_per_sec),
                    "max": max(hits_per_sec)
                }
                
            if misses_per_sec:
                result["misses_per_second"] = {
                    "avg": sum(misses_per_sec) / len(misses_per_sec),
                    "min": min(misses_per_sec),
                    "max": max(misses_per_sec)
                }
                
            if evictions_per_sec:
                result["evictions_per_second"] = {
                    "avg": sum(evictions_per_sec) / len(evictions_per_sec),
                    "min": min(evictions_per_sec),
                    "max": max(evictions_per_sec)
                }
                
            # First and last metrics in the window
            result["first_sample"] = window_metrics[0]["timestamp"]
            result["last_sample"] = window_metrics[-1]["timestamp"]
            
            return result
    
    def export_metrics_json(self, time_window: Optional[int] = None) -> str:
        """
        Export metrics as JSON.
        
        Args:
            time_window: Optional time window in seconds
            
        Returns:
            JSON string with metrics
        """
        with self.metrics_lock:
            if time_window:
                cutoff_time = time.time() - time_window
                metrics = [m for m in self.metrics_data if m["timestamp"] > cutoff_time]
            else:
                metrics = self.metrics_data.copy()
        
        return json.dumps({
            "metrics_namespace": self.metrics_namespace,
            "count": len(metrics),
            "data": metrics
        })
    
    def export_metrics_to_file(self, filename: str, time_window: Optional[int] = None) -> bool:
        """
        Export metrics to a file.
        
        Args:
            filename: File path to write metrics to
            time_window: Optional time window in seconds
            
        Returns:
            True if successful, False otherwise
        """
        try:
            json_data = self.export_metrics_json(time_window)
            with open(filename, 'w') as f:
                f.write(json_data)
            return True
        except Exception as e:
            self.logger.error(f"Failed to export metrics to file: {e}")
            return False
    
    def record_metric(self, name: str, value: Union[int, float]) -> None:
        """
        Record a custom metric.
        
        Args:
            name: Name of the metric
            value: Value of the metric
        """
        now = time.time()
        
        with self.metrics_lock:
            # Find most recent metrics entry or create a new one
            if self.metrics_data and (now - self.metrics_data[-1]["timestamp"]) < 1:
                # Add to most recent entry
                entry = self.metrics_data[-1]
            else:
                # Create a new entry
                entry = {
                    "timestamp": now,
                    "datetime": datetime.datetime.fromtimestamp(now).isoformat()
                }
                self.metrics_data.append(entry)
            
            # Add custom metric
            if "custom" not in entry:
                entry["custom"] = {}
            
            entry["custom"][name] = value
    
    def get_alert_conditions(self) -> List[Dict[str, Any]]:
        """
        Check for alert conditions based on metrics.
        
        Returns:
            List of alert conditions with severity and description
        """
        alerts = []
        
        # Get aggregated metrics for the last hour
        metrics = self.get_aggregated_metrics(3600)
        
        # Check hit rate
        if "hit_rate" in metrics:
            hit_rate_avg = metrics["hit_rate"]["avg"]
            
            if hit_rate_avg < 0.5:
                alerts.append({
                    "severity": "critical",
                    "metric": "hit_rate",
                    "value": hit_rate_avg,
                    "threshold": 0.5,
                    "description": f"Cache hit rate is too low: {hit_rate_avg:.2f}"
                })
            elif hit_rate_avg < 0.7:
                alerts.append({
                    "severity": "warning",
                    "metric": "hit_rate",
                    "value": hit_rate_avg,
                    "threshold": 0.7,
                    "description": f"Cache hit rate is suboptimal: {hit_rate_avg:.2f}"
                })
        
        # Check cache utilization
        if "cache_utilization" in metrics:
            util_avg = metrics["cache_utilization"]["avg"]
            
            if util_avg > 0.95:
                alerts.append({
                    "severity": "critical",
                    "metric": "cache_utilization",
                    "value": util_avg,
                    "threshold": 0.95,
                    "description": f"Cache utilization is very high: {util_avg:.2f}"
                })
            elif util_avg > 0.85:
                alerts.append({
                    "severity": "warning",
                    "metric": "cache_utilization",
                    "value": util_avg,
                    "threshold": 0.85,
                    "description": f"Cache utilization is high: {util_avg:.2f}"
                })
        
        # Check eviction rate
        if "evictions_per_second" in metrics:
            evict_avg = metrics["evictions_per_second"]["avg"]
            
            if evict_avg > 10:
                alerts.append({
                    "severity": "warning",
                    "metric": "evictions_per_second",
                    "value": evict_avg,
                    "threshold": 10,
                    "description": f"Cache eviction rate is high: {evict_avg:.2f}/s"
                })
        
        return alerts
    
    def _collection_loop(self) -> None:
        """Background thread for periodic metrics collection."""
        while self.running:
            try:
                self.collect_metrics()
            except Exception as e:
                self.logger.error(f"Error collecting metrics: {e}")
            
            # Sleep for the collection interval
            for _ in range(self.collection_interval):
                if not self.running:
                    break
                time.sleep(1)