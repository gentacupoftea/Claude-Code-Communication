"""
Sync metrics collection and reporting module.

This module provides tools for collecting, aggregating, and reporting
metrics about sync operations and performance.
"""

import time
import json
import logging
import threading
import datetime
from typing import Dict, List, Any, Optional, Union, Tuple
from enum import Enum


class SyncMetricType(Enum):
    """Enumeration of sync metric types."""
    SYNC_SUCCESS = "sync_success"
    SYNC_FAILURE = "sync_failure"
    SYNC_DURATION = "sync_duration"
    API_CALL = "api_call"
    DATA_VOLUME = "data_volume"
    ERROR = "error"


class SyncMetricsCollector:
    """
    Collects and aggregates sync performance metrics.
    
    This class provides methods to track various sync metrics,
    aggregate them over time, and generate reports for monitoring.
    """
    
    def __init__(
        self,
        sync_manager=None,
        metrics_namespace: str = "sync",
        collection_interval: int = 60,  # Default: collect metrics every minute
        retention_period: int = 86400,  # Default: retain metrics for 1 day
        enable_periodic_collection: bool = True
    ):
        """
        Initialize the metrics collector.
        
        Args:
            sync_manager: The sync manager instance to monitor
            metrics_namespace: Namespace for metrics storage/identification
            collection_interval: How often to collect metrics in seconds
            retention_period: How long to retain metrics in seconds
            enable_periodic_collection: Whether to enable automatic periodic collection
        """
        self.sync_manager = sync_manager
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
        self.logger = logging.getLogger("SyncMetricsCollector")
        
        # Performance tracking
        self.sync_times = {}
        self.error_counts = {}
        self.api_call_counts = {
            "shopify": {"total": 0, "success": 0, "failure": 0},
            "external": {"total": 0, "success": 0, "failure": 0}
        }
        self.sync_results = {
            "success": 0,
            "failure": 0,
            "partial": 0,
            "total": 0
        }
        self.data_volume = {
            "entities_processed": 0,
            "bytes_transferred": 0
        }
        
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
            self.logger.info("Started periodic sync metrics collection")
    
    def stop_collection(self) -> None:
        """Stop periodic metrics collection."""
        with self.metrics_lock:
            self.running = False
            if self.collector_thread:
                # No need to join the thread as it's a daemon
                self.collector_thread = None
                self.logger.info("Stopped periodic sync metrics collection")
    
    def collect_metrics(self) -> Dict[str, Any]:
        """
        Collect current sync metrics.
        
        Returns:
            Dictionary containing current metrics
        """
        now = time.time()
        
        # Get current stats from the sync manager if available
        sync_stats = {}
        if self.sync_manager:
            active_jobs = len(getattr(self.sync_manager, 'active_jobs', {}))
            sync_stats = {
                "active_jobs": active_jobs,
                "job_statuses": self._get_job_status_counts()
            }
        
        # Calculate derived metrics
        success_rate = 0
        if self.sync_results["total"] > 0:
            success_rate = self.sync_results["success"] / self.sync_results["total"]
        
        # Calculate time-based metrics if we have previous data
        time_based = {}
        if self.last_collection_time > 0 and self.last_metrics:
            time_delta = now - self.last_collection_time
            
            # Calculate operations per second
            for key in ["sync_operations", "api_calls", "errors"]:
                if key in self.last_metrics:
                    current_val = self._get_counter_value(key)
                    prev_val = self.last_metrics.get(key, 0)
                    delta = current_val - prev_val
                    time_based[f"{key}_per_second"] = delta / time_delta
        
        # Average sync duration
        avg_duration = 0
        if self.sync_times:
            durations = list(self.sync_times.values())
            avg_duration = sum(durations) / len(durations)
        
        # Combine all metrics
        metrics = {
            "timestamp": now,
            "datetime": datetime.datetime.fromtimestamp(now).isoformat(),
            "success_rate": success_rate,
            "avg_sync_duration": avg_duration,
            "success_count": self.sync_results["success"],
            "failure_count": self.sync_results["failure"],
            "partial_count": self.sync_results["partial"],
            "total_syncs": self.sync_results["total"],
            "entities_processed": self.data_volume["entities_processed"],
            "bytes_transferred": self.data_volume["bytes_transferred"],
            "api_calls": {
                "shopify": self.api_call_counts["shopify"].copy(),
                "external": self.api_call_counts["external"].copy()
            },
            "errors": self._get_error_summary(),
            "time_based": time_based
        }
        
        # Add all sync stats
        metrics.update(sync_stats)
        
        # Store last values for delta calculations
        self.last_metrics = {
            "sync_operations": self.sync_results["total"],
            "api_calls": self.api_call_counts["shopify"]["total"] + self.api_call_counts["external"]["total"],
            "errors": sum(self.error_counts.values())
        }
        self.last_collection_time = now
        
        # Store the metrics
        with self.metrics_lock:
            self.metrics_data.append(metrics)
            
            # Remove old metrics based on retention period
            cutoff_time = now - self.retention_period
            self.metrics_data = [m for m in self.metrics_data if m["timestamp"] > cutoff_time]
        
        return metrics
    
    def record_sync_result(
        self,
        job_id: str,
        entity_type: str,
        success: bool,
        partial: bool = False,
        duration: float = 0,
        entities_count: int = 1,
        data_size: int = 0
    ) -> None:
        """
        Record the result of a sync operation.
        
        Args:
            job_id: ID of the sync job
            entity_type: Type of entity synced
            success: Whether the sync was successful
            partial: Whether the sync was partially successful
            duration: Duration of the sync operation in seconds
            entities_count: Number of entities processed
            data_size: Amount of data transferred in bytes
        """
        with self.metrics_lock:
            # Update sync results
            self.sync_results["total"] += 1
            
            if success and not partial:
                self.sync_results["success"] += 1
            elif partial:
                self.sync_results["partial"] += 1
            else:
                self.sync_results["failure"] += 1
            
            # Update sync times
            self.sync_times[job_id] = duration
            
            # Update data volume
            self.data_volume["entities_processed"] += entities_count
            self.data_volume["bytes_transferred"] += data_size
    
    def record_api_call(
        self,
        api_type: str,
        endpoint: str,
        success: bool,
        duration: float,
        request_size: int = 0,
        response_size: int = 0
    ) -> None:
        """
        Record metrics about an API call.
        
        Args:
            api_type: Type of API (shopify, external)
            endpoint: API endpoint called
            success: Whether the call was successful
            duration: Duration of the API call in seconds
            request_size: Size of the request in bytes
            response_size: Size of the response in bytes
        """
        with self.metrics_lock:
            # Normalize API type
            api_type = api_type.lower()
            if api_type not in self.api_call_counts:
                api_type = "external"
            
            # Update API call counts
            self.api_call_counts[api_type]["total"] += 1
            
            if success:
                self.api_call_counts[api_type]["success"] += 1
            else:
                self.api_call_counts[api_type]["failure"] += 1
            
            # Update data volume
            self.data_volume["bytes_transferred"] += (request_size + response_size)
    
    def record_error(self, error_type: str, entity_type: str = "unknown") -> None:
        """
        Record an error occurrence.
        
        Args:
            error_type: Type of error encountered
            entity_type: Type of entity associated with the error
        """
        with self.metrics_lock:
            key = f"{entity_type}:{error_type}"
            self.error_counts[key] = self.error_counts.get(key, 0) + 1
    
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
            success_rates = [m.get("success_rate", 0) for m in window_metrics]
            sync_durations = [m.get("avg_sync_duration", 0) for m in window_metrics]
            
            # Extract API call metrics
            shopify_api_success_rate = []
            external_api_success_rate = []
            
            for m in window_metrics:
                api_calls = m.get("api_calls", {})
                
                # Shopify API success rate
                shopify = api_calls.get("shopify", {})
                shopify_total = shopify.get("total", 0)
                shopify_success = shopify.get("success", 0)
                if shopify_total > 0:
                    shopify_api_success_rate.append(shopify_success / shopify_total)
                
                # External API success rate
                external = api_calls.get("external", {})
                external_total = external.get("total", 0)
                external_success = external.get("success", 0)
                if external_total > 0:
                    external_api_success_rate.append(external_success / external_total)
            
            # Calculate statistics
            result = {
                "timestamp": now,
                "datetime": datetime.datetime.fromtimestamp(now).isoformat(),
                "samples": len(window_metrics),
                "time_window_seconds": time_window,
                "success_rate": {
                    "avg": sum(success_rates) / len(success_rates) if success_rates else 0,
                    "min": min(success_rates) if success_rates else 0,
                    "max": max(success_rates) if success_rates else 0
                },
                "sync_duration": {
                    "avg": sum(sync_durations) / len(sync_durations) if sync_durations else 0,
                    "min": min(sync_durations) if sync_durations else 0,
                    "max": max(sync_durations) if sync_durations else 0
                }
            }
            
            # Add API success rates if available
            if shopify_api_success_rate:
                result["shopify_api_success_rate"] = {
                    "avg": sum(shopify_api_success_rate) / len(shopify_api_success_rate),
                    "min": min(shopify_api_success_rate),
                    "max": max(shopify_api_success_rate)
                }
                
            if external_api_success_rate:
                result["external_api_success_rate"] = {
                    "avg": sum(external_api_success_rate) / len(external_api_success_rate),
                    "min": min(external_api_success_rate),
                    "max": max(external_api_success_rate)
                }
            
            # Add most common errors
            error_summary = self._get_error_summary()
            if error_summary:
                result["most_common_errors"] = error_summary[:5]  # Top 5 errors
            
            # Accumulate total entities processed and bytes transferred
            total_entities = sum(m.get("entities_processed", 0) for m in window_metrics)
            total_bytes = sum(m.get("bytes_transferred", 0) for m in window_metrics)
            
            result["data_volume"] = {
                "entities_processed": total_entities,
                "bytes_transferred": total_bytes
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
            self.logger.error(f"Failed to export sync metrics to file: {e}")
            return False
    
    def export_metrics_csv(self, filename: str, time_window: Optional[int] = None) -> bool:
        """
        Export metrics to a CSV file.
        
        Args:
            filename: File path to write metrics to
            time_window: Optional time window in seconds
            
        Returns:
            True if successful, False otherwise
        """
        try:
            with self.metrics_lock:
                if time_window:
                    cutoff_time = time.time() - time_window
                    metrics = [m for m in self.metrics_data if m["timestamp"] > cutoff_time]
                else:
                    metrics = self.metrics_data.copy()
            
            if not metrics:
                self.logger.warning("No metrics to export to CSV")
                return False
            
            # Determine headers from first metric entry
            headers = ["timestamp", "datetime", "success_rate", "avg_sync_duration", 
                       "success_count", "failure_count", "total_syncs", "entities_processed"]
            
            # Write CSV
            with open(filename, 'w') as f:
                # Write header row
                f.write(','.join(headers) + '\n')
                
                # Write data rows
                for metric in metrics:
                    values = []
                    for header in headers:
                        values.append(str(metric.get(header, '')))
                    f.write(','.join(values) + '\n')
            
            return True
        except Exception as e:
            self.logger.error(f"Failed to export sync metrics to CSV: {e}")
            return False
    
    def get_alert_conditions(self) -> List[Dict[str, Any]]:
        """
        Check for alert conditions based on metrics.
        
        Returns:
            List of alert conditions with severity and description
        """
        alerts = []
        
        # Get aggregated metrics for the last hour
        metrics = self.get_aggregated_metrics(3600)
        
        # Check sync success rate
        if "success_rate" in metrics:
            success_rate_avg = metrics["success_rate"]["avg"]
            
            if success_rate_avg < 0.7:
                alerts.append({
                    "severity": "critical",
                    "metric": "success_rate",
                    "value": success_rate_avg,
                    "threshold": 0.7,
                    "description": f"Sync success rate is too low: {success_rate_avg:.2f}"
                })
            elif success_rate_avg < 0.9:
                alerts.append({
                    "severity": "warning",
                    "metric": "success_rate",
                    "value": success_rate_avg,
                    "threshold": 0.9,
                    "description": f"Sync success rate is suboptimal: {success_rate_avg:.2f}"
                })
        
        # Check API success rates
        if "shopify_api_success_rate" in metrics:
            shopify_api_avg = metrics["shopify_api_success_rate"]["avg"]
            
            if shopify_api_avg < 0.8:
                alerts.append({
                    "severity": "critical",
                    "metric": "shopify_api_success_rate",
                    "value": shopify_api_avg,
                    "threshold": 0.8,
                    "description": f"Shopify API success rate is too low: {shopify_api_avg:.2f}"
                })
            elif shopify_api_avg < 0.95:
                alerts.append({
                    "severity": "warning",
                    "metric": "shopify_api_success_rate",
                    "value": shopify_api_avg,
                    "threshold": 0.95,
                    "description": f"Shopify API success rate is suboptimal: {shopify_api_avg:.2f}"
                })
        
        if "external_api_success_rate" in metrics:
            external_api_avg = metrics["external_api_success_rate"]["avg"]
            
            if external_api_avg < 0.8:
                alerts.append({
                    "severity": "critical",
                    "metric": "external_api_success_rate",
                    "value": external_api_avg,
                    "threshold": 0.8,
                    "description": f"External API success rate is too low: {external_api_avg:.2f}"
                })
            elif external_api_avg < 0.95:
                alerts.append({
                    "severity": "warning",
                    "metric": "external_api_success_rate",
                    "value": external_api_avg,
                    "threshold": 0.95,
                    "description": f"External API success rate is suboptimal: {external_api_avg:.2f}"
                })
        
        # Check sync duration
        if "sync_duration" in metrics:
            duration_avg = metrics["sync_duration"]["avg"]
            
            if duration_avg > 30:  # seconds
                alerts.append({
                    "severity": "warning",
                    "metric": "sync_duration",
                    "value": duration_avg,
                    "threshold": 30,
                    "description": f"Average sync duration is high: {duration_avg:.2f}s"
                })
        
        return alerts
    
    def _get_counter_value(self, counter_name: str) -> int:
        """
        Get the current value for a counter.
        
        Args:
            counter_name: Name of the counter
            
        Returns:
            Current value of the counter
        """
        if counter_name == "sync_operations":
            return self.sync_results["total"]
        elif counter_name == "api_calls":
            return self.api_call_counts["shopify"]["total"] + self.api_call_counts["external"]["total"]
        elif counter_name == "errors":
            return sum(self.error_counts.values())
        return 0
    
    def _get_error_summary(self) -> List[Dict[str, Any]]:
        """
        Get a summary of error counts by type.
        
        Returns:
            List of error types with counts, sorted by frequency
        """
        with self.metrics_lock:
            errors = []
            for key, count in self.error_counts.items():
                entity_type, error_type = key.split(":", 1)
                errors.append({
                    "entity_type": entity_type,
                    "error_type": error_type,
                    "count": count
                })
            
            # Sort by count descending
            return sorted(errors, key=lambda x: x["count"], reverse=True)
    
    def _get_job_status_counts(self) -> Dict[str, int]:
        """
        Get counts of sync jobs by status.
        
        Returns:
            Dictionary with counts by status
        """
        result = {
            "pending": 0,
            "in_progress": 0,
            "completed": 0,
            "failed": 0,
            "partial": 0,
            "cancelled": 0
        }
        
        if not self.sync_manager or not hasattr(self.sync_manager, 'active_jobs'):
            return result
        
        # Count jobs by status
        for job in self.sync_manager.active_jobs.values():
            status = job.get("status", "unknown").lower()
            if status in result:
                result[status] += 1
        
        return result
    
    def _collection_loop(self) -> None:
        """Background thread for periodic metrics collection."""
        while self.running:
            try:
                self.collect_metrics()
            except Exception as e:
                self.logger.error(f"Error collecting sync metrics: {e}")
            
            # Sleep for the collection interval
            for _ in range(self.collection_interval):
                if not self.running:
                    break
                time.sleep(1)