"""Metrics collection for monitoring integration performance."""

import time
import psutil
from typing import Dict, Any, Optional
from threading import Lock
from collections import defaultdict
import json

class MetricsCollector:
    """統合パフォーマンスのメトリクスを収集します。"""
    
    def __init__(self):
        self.metrics = defaultdict(lambda: defaultdict(list))
        self.lock = Lock()
        self.start_time = time.time()
    
    def record_timing(self, operation: str, duration: float, tags: Optional[Dict[str, str]] = None):
        """操作のタイミングを記録します。"""
        with self.lock:
            metric = {
                "duration": duration,
                "timestamp": time.time(),
                "tags": tags or {}
            }
            self.metrics["timings"][operation].append(metric)
    
    def increment_counter(self, counter: str, value: int = 1, tags: Optional[Dict[str, str]] = None):
        """カウンターをインクリメントします。"""
        with self.lock:
            if counter not in self.metrics["counters"]:
                self.metrics["counters"][counter] = []
            
            metric = {
                "value": value,
                "timestamp": time.time(),
                "tags": tags or {}
            }
            self.metrics["counters"][counter].append(metric)
    
    def record_gauge(self, gauge: str, value: float, tags: Optional[Dict[str, str]] = None):
        """ゲージ値を記録します。"""
        with self.lock:
            metric = {
                "value": value,
                "timestamp": time.time(),
                "tags": tags or {}
            }
            self.metrics["gauges"][gauge].append(metric)
    
    def record_error(self, error_type: str, error_message: str, tags: Optional[Dict[str, str]] = None):
        """エラーを記録します。"""
        with self.lock:
            error = {
                "type": error_type,
                "message": error_message,
                "timestamp": time.time(),
                "tags": tags or {}
            }
            self.metrics["errors"][error_type].append(error)
    
    def get_system_metrics(self) -> Dict[str, float]:
        """システムメトリクスを取得します。"""
        return {
            "cpu_percent": psutil.cpu_percent(interval=0.1),
            "memory_percent": psutil.virtual_memory().percent,
            "disk_percent": psutil.disk_usage('/').percent,
            "process_memory_mb": psutil.Process().memory_info().rss / 1024 / 1024
        }
    
    def get_summary(self) -> Dict[str, Any]:
        """メトリクスのサマリーを取得します。"""
        with self.lock:
            summary = {
                "uptime_seconds": time.time() - self.start_time,
                "system": self.get_system_metrics(),
                "timings": {},
                "counters": {},
                "errors": {},
                "last_updated": time.time()
            }
            
            # タイミングメトリクスのサマリー
            for operation, timings in self.metrics["timings"].items():
                durations = [t["duration"] for t in timings]
                if durations:
                    summary["timings"][operation] = {
                        "count": len(durations),
                        "avg": sum(durations) / len(durations),
                        "min": min(durations),
                        "max": max(durations),
                        "last": durations[-1]
                    }
            
            # カウンターのサマリー
            for counter, values in self.metrics["counters"].items():
                total = sum(v["value"] for v in values)
                summary["counters"][counter] = {
                    "total": total,
                    "count": len(values),
                    "last_value": values[-1]["value"] if values else 0
                }
            
            # エラーのサマリー
            for error_type, errors in self.metrics["errors"].items():
                summary["errors"][error_type] = {
                    "count": len(errors),
                    "last_error": errors[-1]["message"] if errors else None
                }
            
            return summary
    
    def export_metrics(self, format: str = "json") -> str:
        """メトリクスをエクスポートします。"""
        summary = self.get_summary()
        
        if format == "json":
            return json.dumps(summary, indent=2)
        else:
            raise ValueError(f"Unsupported format: {format}")
    
    def reset(self):
        """メトリクスをリセットします。"""
        with self.lock:
            self.metrics.clear()
            self.start_time = time.time()

class Timer:
    """コンテキストマネージャーベースのタイマー。"""
    
    def __init__(self, collector: MetricsCollector, operation: str, tags: Optional[Dict[str, str]] = None):
        self.collector = collector
        self.operation = operation
        self.tags = tags
        self.start_time = None
    
    def __enter__(self):
        self.start_time = time.time()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        duration = time.time() - self.start_time
        self.collector.record_timing(self.operation, duration, self.tags)
