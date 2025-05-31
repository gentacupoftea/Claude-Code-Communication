#!/usr/bin/env python3
"""
Shopify MCP Server - Monitoring and Visualization Example

This script demonstrates how to access, analyze, and visualize monitoring data
from the Shopify MCP Server for performance analysis and troubleshooting.
"""

import os
import sys
import json
import time
import random
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('monitoring_example.log')
    ]
)
logger = logging.getLogger("monitoring_example")

# Try to import visualization packages
visualization_available = False
try:
    import matplotlib.pyplot as plt
    import matplotlib.dates as mdates
    import numpy as np
    from matplotlib.ticker import MaxNLocator
    visualization_available = True
except ImportError:
    logger.warning("Matplotlib not installed, visualizations will be skipped")
    logger.warning("To install visualization dependencies: pip install matplotlib numpy")


class MonitoringDataSimulator:
    """
    Simulates monitoring data for demonstration purposes.
    In a real scenario, this data would come from actual metrics collectors.
    """
    
    def __init__(self, duration_days: int = 7):
        """Initialize the monitoring data simulator."""
        self.duration_days = duration_days
        self.end_date = datetime.now()
        self.start_date = self.end_date - timedelta(days=duration_days)
        self.metrics = self._generate_metrics()
    
    def _generate_metrics(self) -> Dict[str, Any]:
        """Generate simulated metrics data."""
        # Generate timestamps for the entire period (hourly data points)
        timestamps = []
        current = self.start_date
        while current <= self.end_date:
            timestamps.append(current)
            current += timedelta(hours=1)
        
        # System metrics
        cpu_usage = [random.uniform(10, 90) for _ in timestamps]
        memory_usage = [random.uniform(20, 80) for _ in timestamps]
        disk_usage = [random.uniform(30, 90) for _ in timestamps]
        
        # API metrics
        api_requests = []
        api_response_time = []
        api_error_rate = []
        
        # Add some patterns to make the data more realistic
        for i, _ in enumerate(timestamps):
            hour = timestamps[i].hour
            
            # More traffic during business hours
            if 9 <= hour <= 17:  # 9 AM to 5 PM
                traffic_multiplier = random.uniform(0.8, 1.2)
            else:
                traffic_multiplier = random.uniform(0.2, 0.6)
            
            # Weekly pattern (weekends have less traffic)
            weekday = timestamps[i].weekday()
            if weekday >= 5:  # Saturday or Sunday
                traffic_multiplier *= 0.5
            
            # Add a trend over time (growing traffic)
            day_progress = (timestamps[i] - self.start_date).total_seconds() / (self.duration_days * 86400)
            trend_factor = 1 + day_progress * 0.3  # 30% growth over the period
            
            base_requests = 100 * traffic_multiplier * trend_factor
            
            # Add some randomness
            requests = int(base_requests * random.uniform(0.8, 1.2))
            
            api_requests.append(requests)
            
            # Response time tends to increase with more traffic
            resp_time = 50 + (requests / 100) * 30 + random.uniform(-10, 10)
            api_response_time.append(resp_time)
            
            # Error rate increases with higher traffic but generally stays low
            error_rate = min(0.5 + (requests / 500) * random.uniform(0, 2), 100) 
            api_error_rate.append(error_rate)
        
        # Cache metrics
        cache_hit_rate = [random.uniform(60, 95) for _ in timestamps]
        cache_miss_rate = [100 - hit_rate for hit_rate in cache_hit_rate]
        cache_size = [int(random.uniform(10, 50) * 1024 * 1024) for _ in timestamps]  # in bytes
        
        # Sync metrics
        sync_job_count = []
        sync_success_rate = []
        sync_duration = []
        
        for i, _ in enumerate(timestamps):
            hour = timestamps[i].hour
            
            # Sync jobs often run at specific times
            if hour in [1, 9, 17]:  # 1 AM, 9 AM, 5 PM
                job_count = random.randint(5, 15)
            else:
                job_count = random.randint(0, 3)
            
            sync_job_count.append(job_count)
            
            # Success rate is generally high but can have drops
            if random.random() < 0.05:  # Occasional issues
                success = random.uniform(70, 85)
            else:
                success = random.uniform(90, 100)
            
            sync_success_rate.append(success)
            
            # Duration varies with the number of jobs
            avg_duration = 30 + job_count * 5 + random.uniform(-10, 20)
            sync_duration.append(avg_duration)
        
        # Business metrics
        order_count = []
        revenue = []
        
        # Simulate some business metrics based on the time
        for i, _ in enumerate(timestamps):
            hour = timestamps[i].hour
            weekday = timestamps[i].weekday()
            
            # More orders during certain hours
            if 10 <= hour <= 20:  # 10 AM to 8 PM
                time_factor = random.uniform(0.8, 1.5)
            else:
                time_factor = random.uniform(0.1, 0.5)
            
            # Weekend vs weekday pattern
            if weekday >= 5:  # Weekend
                day_factor = random.uniform(1.2, 1.8)
            else:
                day_factor = random.uniform(0.7, 1.3)
            
            # Special promotions or events (random spikes)
            if random.random() < 0.03:  # 3% chance of a special event
                special_factor = random.uniform(1.5, 3.0)
            else:
                special_factor = 1.0
            
            base_orders = 20 * time_factor * day_factor * special_factor
            
            # Add trend and randomness
            day_progress = (timestamps[i] - self.start_date).total_seconds() / (self.duration_days * 86400)
            trend_factor = 1 + day_progress * 0.2  # 20% growth over the period
            
            orders = int(base_orders * trend_factor * random.uniform(0.8, 1.2))
            order_count.append(orders)
            
            # Revenue depends on orders but with variable average order value
            avg_order_value = random.uniform(40, 80)
            rev = orders * avg_order_value
            revenue.append(rev)
        
        # Combine all metrics into a structured format
        return {
            "timestamps": timestamps,
            "system": {
                "cpu_usage": cpu_usage,
                "memory_usage": memory_usage,
                "disk_usage": disk_usage
            },
            "api": {
                "requests": api_requests,
                "response_time": api_response_time,
                "error_rate": api_error_rate
            },
            "cache": {
                "hit_rate": cache_hit_rate,
                "miss_rate": cache_miss_rate,
                "size": cache_size
            },
            "sync": {
                "job_count": sync_job_count,
                "success_rate": sync_success_rate,
                "duration": sync_duration
            },
            "business": {
                "order_count": order_count,
                "revenue": revenue
            }
        }
    
    def get_metrics(self, start_time: Optional[datetime] = None, end_time: Optional[datetime] = None) -> Dict[str, Any]:
        """
        Get metrics for a specific time range.
        
        Args:
            start_time: Start time for metrics (defaults to the beginning of simulated data)
            end_time: End time for metrics (defaults to the end of simulated data)
            
        Returns:
            Dict containing metrics data for the specified time range
        """
        if start_time is None:
            start_time = self.start_date
        
        if end_time is None:
            end_time = self.end_date
        
        # Filter metrics to the specified time range
        timestamps = self.metrics["timestamps"]
        indices = [i for i, ts in enumerate(timestamps) if start_time <= ts <= end_time]
        
        filtered_metrics = {
            "timestamps": [timestamps[i] for i in indices]
        }
        
        # Filter each metric category
        for category, metrics in self.metrics.items():
            if category == "timestamps":
                continue
                
            filtered_metrics[category] = {}
            
            for metric_name, values in metrics.items():
                filtered_metrics[category][metric_name] = [values[i] for i in indices]
        
        return filtered_metrics
    
    def get_summary_metrics(self) -> Dict[str, Any]:
        """
        Get summary metrics (min, max, avg) for the entire period.
        
        Returns:
            Dict containing summary metrics
        """
        summary = {}
        
        # Process each metric category
        for category, metrics in self.metrics.items():
            if category == "timestamps":
                continue
                
            summary[category] = {}
            
            for metric_name, values in metrics.items():
                summary[category][metric_name] = {
                    "min": min(values),
                    "max": max(values),
                    "avg": sum(values) / len(values),
                    "current": values[-1]
                }
        
        return summary
    
    def get_hourly_averages(self) -> Dict[str, Any]:
        """
        Get average metrics by hour of day (useful for identifying patterns).
        
        Returns:
            Dict containing hourly average metrics
        """
        hourly_data = {hour: {"count": 0} for hour in range(24)}
        
        timestamps = self.metrics["timestamps"]
        
        # Initialize metric structure
        for category, metrics in self.metrics.items():
            if category == "timestamps":
                continue
                
            for metric_name in metrics.keys():
                for hour in range(24):
                    if category not in hourly_data[hour]:
                        hourly_data[hour][category] = {}
                    
                    if metric_name not in hourly_data[hour][category]:
                        hourly_data[hour][category][metric_name] = 0
        
        # Aggregate data by hour
        for i, ts in enumerate(timestamps):
            hour = ts.hour
            hourly_data[hour]["count"] += 1
            
            for category, metrics in self.metrics.items():
                if category == "timestamps":
                    continue
                    
                for metric_name, values in metrics.items():
                    hourly_data[hour][category][metric_name] += values[i]
        
        # Calculate averages
        averages = {}
        
        for hour in range(24):
            if hourly_data[hour]["count"] == 0:
                continue
                
            averages[hour] = {}
            
            for category, metrics in hourly_data[hour].items():
                if category == "count":
                    continue
                    
                averages[hour][category] = {}
                
                for metric_name, total in metrics.items():
                    averages[hour][category][metric_name] = total / hourly_data[hour]["count"]
        
        return averages
    
    def get_daily_averages(self) -> Dict[str, Any]:
        """
        Get average metrics by day of week (useful for identifying patterns).
        
        Returns:
            Dict containing daily average metrics
        """
        daily_data = {day: {"count": 0} for day in range(7)}
        
        timestamps = self.metrics["timestamps"]
        
        # Initialize metric structure
        for category, metrics in self.metrics.items():
            if category == "timestamps":
                continue
                
            for metric_name in metrics.keys():
                for day in range(7):
                    if category not in daily_data[day]:
                        daily_data[day][category] = {}
                    
                    if metric_name not in daily_data[day][category]:
                        daily_data[day][category][metric_name] = 0
        
        # Aggregate data by day of week
        for i, ts in enumerate(timestamps):
            day = ts.weekday()
            daily_data[day]["count"] += 1
            
            for category, metrics in self.metrics.items():
                if category == "timestamps":
                    continue
                    
                for metric_name, values in metrics.items():
                    daily_data[day][category][metric_name] += values[i]
        
        # Calculate averages
        averages = {}
        
        for day in range(7):
            if daily_data[day]["count"] == 0:
                continue
                
            averages[day] = {}
            
            for category, metrics in daily_data[day].items():
                if category == "count":
                    continue
                    
                averages[day][category] = {}
                
                for metric_name, total in metrics.items():
                    averages[day][category][metric_name] = total / daily_data[day]["count"]
        
        return averages


class MetricsVisualizer:
    """
    Creates visualizations from monitoring metrics data.
    Requires matplotlib to be installed.
    """
    
    def __init__(self, output_dir: str = "monitoring_output"):
        """Initialize the metrics visualizer."""
        if not visualization_available:
            raise ImportError("Matplotlib is required for visualization")
        
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        
        # Set default style
        plt.style.use('ggplot')
    
    def plot_time_series(self, 
                         timestamps: List[datetime], 
                         data: Dict[str, List[float]], 
                         title: str, 
                         y_label: str, 
                         filename: str) -> None:
        """
        Create a time series plot for one or more metrics.
        
        Args:
            timestamps: List of timestamps for the x-axis
            data: Dict of metric names to lists of values
            title: Plot title
            y_label: y-axis label
            filename: Output filename (without extension)
        """
        plt.figure(figsize=(12, 6))
        
        for metric_name, values in data.items():
            plt.plot(timestamps, values, label=metric_name)
        
        plt.title(title)
        plt.xlabel('Time')
        plt.ylabel(y_label)
        plt.grid(True)
        plt.legend()
        
        # Format x-axis
        plt.gca().xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d %H:%M'))
        plt.gca().xaxis.set_major_locator(mdates.DayLocator(interval=1))
        plt.gcf().autofmt_xdate()
        
        plt.tight_layout()
        plt.savefig(os.path.join(self.output_dir, f"{filename}.png"))
        plt.close()
    
    def plot_hourly_pattern(self, 
                           hourly_data: Dict[int, Dict[str, float]], 
                           category: str,
                           metric: str,
                           title: str, 
                           y_label: str, 
                           filename: str) -> None:
        """
        Create a plot showing patterns by hour of day.
        
        Args:
            hourly_data: Dict of hour to metric values
            category: Metric category
            metric: Metric name
            title: Plot title
            y_label: y-axis label
            filename: Output filename (without extension)
        """
        plt.figure(figsize=(10, 6))
        
        hours = sorted(hourly_data.keys())
        values = [hourly_data[hour][category][metric] for hour in hours]
        
        plt.bar(hours, values, color='cornflowerblue')
        
        plt.title(title)
        plt.xlabel('Hour of Day')
        plt.ylabel(y_label)
        plt.grid(True, axis='y')
        
        plt.xticks(range(0, 24, 2))
        plt.xlim(-0.5, 23.5)
        
        plt.tight_layout()
        plt.savefig(os.path.join(self.output_dir, f"{filename}.png"))
        plt.close()
    
    def plot_daily_pattern(self, 
                          daily_data: Dict[int, Dict[str, float]], 
                          category: str,
                          metric: str,
                          title: str, 
                          y_label: str, 
                          filename: str) -> None:
        """
        Create a plot showing patterns by day of week.
        
        Args:
            daily_data: Dict of day to metric values
            category: Metric category
            metric: Metric name
            title: Plot title
            y_label: y-axis label
            filename: Output filename (without extension)
        """
        plt.figure(figsize=(10, 6))
        
        days = sorted(daily_data.keys())
        values = [daily_data[day][category][metric] for day in days]
        
        day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        
        plt.bar(days, values, color='lightseagreen')
        
        plt.title(title)
        plt.xlabel('Day of Week')
        plt.ylabel(y_label)
        plt.grid(True, axis='y')
        
        plt.xticks(days, [day_names[day] for day in days], rotation=45)
        
        plt.tight_layout()
        plt.savefig(os.path.join(self.output_dir, f"{filename}.png"))
        plt.close()
    
    def plot_correlation(self, 
                         data1: List[float], 
                         data2: List[float],
                         label1: str,
                         label2: str,
                         title: str,
                         filename: str) -> None:
        """
        Create a scatter plot showing correlation between two metrics.
        
        Args:
            data1: List of values for the first metric
            data2: List of values for the second metric
            label1: Label for the first metric
            label2: Label for the second metric
            title: Plot title
            filename: Output filename (without extension)
        """
        plt.figure(figsize=(8, 8))
        
        plt.scatter(data1, data2, alpha=0.5)
        
        plt.title(title)
        plt.xlabel(label1)
        plt.ylabel(label2)
        plt.grid(True)
        
        # Calculate and display correlation coefficient
        corr = np.corrcoef(data1, data2)[0, 1]
        plt.annotate(f"Correlation: {corr:.2f}", 
                    xy=(0.05, 0.95), 
                    xycoords='axes fraction', 
                    fontsize=12,
                    bbox=dict(boxstyle="round,pad=0.5", fc="white", alpha=0.8))
        
        plt.tight_layout()
        plt.savefig(os.path.join(self.output_dir, f"{filename}.png"))
        plt.close()
    
    def create_dashboard(self, 
                        metrics: Dict[str, Any], 
                        summary: Dict[str, Any]) -> None:
        """
        Create a comprehensive dashboard with multiple plots.
        
        Args:
            metrics: Dict containing all metrics data
            summary: Dict containing summary metrics
        """
        plt.figure(figsize=(15, 10))
        
        # Create a 2x3 grid for key metrics
        gs = plt.GridSpec(2, 3, wspace=0.3, hspace=0.3)
        
        # Plot 1: API Requests over time
        ax1 = plt.subplot(gs[0, 0])
        ax1.plot(metrics["timestamps"], metrics["api"]["requests"], color='blue')
        ax1.set_title("API Requests")
        ax1.set_xlabel("")
        ax1.xaxis.set_major_formatter(mdates.DateFormatter('%m-%d'))
        ax1.xaxis.set_major_locator(mdates.DayLocator(interval=2))
        
        # Plot 2: API Response Time
        ax2 = plt.subplot(gs[0, 1])
        ax2.plot(metrics["timestamps"], metrics["api"]["response_time"], color='red')
        ax2.set_title("API Response Time (ms)")
        ax2.set_xlabel("")
        ax2.xaxis.set_major_formatter(mdates.DateFormatter('%m-%d'))
        ax2.xaxis.set_major_locator(mdates.DayLocator(interval=2))
        
        # Plot 3: Cache Hit Rate
        ax3 = plt.subplot(gs[0, 2])
        ax3.plot(metrics["timestamps"], metrics["cache"]["hit_rate"], color='green')
        ax3.set_title("Cache Hit Rate (%)")
        ax3.set_xlabel("")
        ax3.xaxis.set_major_formatter(mdates.DateFormatter('%m-%d'))
        ax3.xaxis.set_major_locator(mdates.DayLocator(interval=2))
        ax3.set_ylim(0, 100)
        
        # Plot 4: System CPU Usage
        ax4 = plt.subplot(gs[1, 0])
        ax4.plot(metrics["timestamps"], metrics["system"]["cpu_usage"], color='purple')
        ax4.set_title("CPU Usage (%)")
        ax4.xaxis.set_major_formatter(mdates.DateFormatter('%m-%d'))
        ax4.xaxis.set_major_locator(mdates.DayLocator(interval=2))
        ax4.set_ylim(0, 100)
        
        # Plot 5: Order Count
        ax5 = plt.subplot(gs[1, 1])
        ax5.plot(metrics["timestamps"], metrics["business"]["order_count"], color='orange')
        ax5.set_title("Orders")
        ax5.xaxis.set_major_formatter(mdates.DateFormatter('%m-%d'))
        ax5.xaxis.set_major_locator(mdates.DayLocator(interval=2))
        
        # Plot 6: Sync Success Rate
        ax6 = plt.subplot(gs[1, 2])
        ax6.plot(metrics["timestamps"], metrics["sync"]["success_rate"], color='teal')
        ax6.set_title("Sync Success Rate (%)")
        ax6.xaxis.set_major_formatter(mdates.DateFormatter('%m-%d'))
        ax6.xaxis.set_major_locator(mdates.DayLocator(interval=2))
        ax6.set_ylim(0, 100)
        
        plt.suptitle("Shopify MCP Server Monitoring Dashboard", fontsize=16)
        plt.tight_layout(rect=[0, 0, 1, 0.97])
        
        plt.savefig(os.path.join(self.output_dir, "dashboard.png"))
        plt.close()
        
        # Save a summary table
        self._create_summary_table(summary)
    
    def _create_summary_table(self, summary: Dict[str, Any]) -> None:
        """
        Create a table visualization of summary metrics.
        
        Args:
            summary: Dict containing summary metrics
        """
        plt.figure(figsize=(12, 8))
        
        # Create a table-like visualization
        table_data = []
        row_labels = []
        
        # Extract key metrics for the table
        metrics_to_show = {
            "api": ["requests", "response_time", "error_rate"],
            "cache": ["hit_rate", "miss_rate"],
            "system": ["cpu_usage", "memory_usage"],
            "sync": ["job_count", "success_rate", "duration"],
            "business": ["order_count", "revenue"]
        }
        
        for category, metrics in metrics_to_show.items():
            for metric in metrics:
                if category in summary and metric in summary[category]:
                    data = summary[category][metric]
                    row_labels.append(f"{category.title()} - {metric.replace('_', ' ').title()}")
                    table_data.append([
                        f"{data['min']:.2f}" if isinstance(data['min'], float) else f"{data['min']}",
                        f"{data['avg']:.2f}" if isinstance(data['avg'], float) else f"{data['avg']}",
                        f"{data['max']:.2f}" if isinstance(data['max'], float) else f"{data['max']}",
                        f"{data['current']:.2f}" if isinstance(data['current'], float) else f"{data['current']}"
                    ])
        
        # Create table
        plt.table(
            cellText=table_data,
            rowLabels=row_labels,
            colLabels=["Min", "Avg", "Max", "Current"],
            loc='center',
            cellLoc='center',
            colWidths=[0.1, 0.1, 0.1, 0.1]
        )
        
        plt.axis('off')
        plt.title("Shopify MCP Server - Metrics Summary", fontsize=16)
        plt.tight_layout()
        
        plt.savefig(os.path.join(self.output_dir, "summary_table.png"))
        plt.close()


def generate_text_report(metrics_data: Dict[str, Any], summary: Dict[str, Any]) -> str:
    """
    Generate a text-based report from metrics data.
    
    Args:
        metrics_data: Dict containing all metrics data
        summary: Dict containing summary metrics
        
    Returns:
        String containing the formatted report text
    """
    # Get the latest timestamp
    latest_timestamp = metrics_data["timestamps"][-1].strftime("%Y-%m-%d %H:%M:%S")
    
    report = []
    report.append("=" * 80)
    report.append("                SHOPIFY MCP SERVER MONITORING REPORT")
    report.append("=" * 80)
    report.append(f"Report generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report.append(f"Data through: {latest_timestamp}")
    report.append(f"Data period: {len(metrics_data['timestamps'])} hours")
    report.append("=" * 80)
    report.append("")
    
    # System metrics
    report.append("SYSTEM METRICS")
    report.append("-" * 80)
    report.append(f"CPU Usage: {summary['system']['cpu_usage']['current']:.1f}% (avg: {summary['system']['cpu_usage']['avg']:.1f}%, max: {summary['system']['cpu_usage']['max']:.1f}%)")
    report.append(f"Memory Usage: {summary['system']['memory_usage']['current']:.1f}% (avg: {summary['system']['memory_usage']['avg']:.1f}%, max: {summary['system']['memory_usage']['max']:.1f}%)")
    report.append(f"Disk Usage: {summary['system']['disk_usage']['current']:.1f}% (avg: {summary['system']['disk_usage']['avg']:.1f}%, max: {summary['system']['disk_usage']['max']:.1f}%)")
    report.append("")
    
    # API metrics
    report.append("API METRICS")
    report.append("-" * 80)
    report.append(f"Request Rate: {summary['api']['requests']['current']:.0f} req/hour (avg: {summary['api']['requests']['avg']:.0f}, max: {summary['api']['requests']['max']:.0f})")
    report.append(f"Response Time: {summary['api']['response_time']['current']:.1f} ms (avg: {summary['api']['response_time']['avg']:.1f} ms, max: {summary['api']['response_time']['max']:.1f} ms)")
    report.append(f"Error Rate: {summary['api']['error_rate']['current']:.2f}% (avg: {summary['api']['error_rate']['avg']:.2f}%, max: {summary['api']['error_rate']['max']:.2f}%)")
    report.append("")
    
    # Cache metrics
    report.append("CACHE METRICS")
    report.append("-" * 80)
    report.append(f"Hit Rate: {summary['cache']['hit_rate']['current']:.1f}% (avg: {summary['cache']['hit_rate']['avg']:.1f}%, min: {summary['cache']['hit_rate']['min']:.1f}%)")
    report.append(f"Miss Rate: {summary['cache']['miss_rate']['current']:.1f}% (avg: {summary['cache']['miss_rate']['avg']:.1f}%, max: {summary['cache']['miss_rate']['max']:.1f}%)")
    report.append(f"Cache Size: {summary['cache']['size']['current'] / (1024 * 1024):.1f} MB (avg: {summary['cache']['size']['avg'] / (1024 * 1024):.1f} MB, max: {summary['cache']['size']['max'] / (1024 * 1024):.1f} MB)")
    report.append("")
    
    # Sync metrics
    report.append("SYNC METRICS")
    report.append("-" * 80)
    report.append(f"Jobs: {summary['sync']['job_count']['current']:.0f} jobs/hour (avg: {summary['sync']['job_count']['avg']:.1f}, max: {summary['sync']['job_count']['max']:.0f})")
    report.append(f"Success Rate: {summary['sync']['success_rate']['current']:.1f}% (avg: {summary['sync']['success_rate']['avg']:.1f}%, min: {summary['sync']['success_rate']['min']:.1f}%)")
    report.append(f"Duration: {summary['sync']['duration']['current']:.1f} seconds (avg: {summary['sync']['duration']['avg']:.1f} seconds, max: {summary['sync']['duration']['max']:.1f} seconds)")
    report.append("")
    
    # Business metrics
    report.append("BUSINESS METRICS")
    report.append("-" * 80)
    report.append(f"Orders: {summary['business']['order_count']['current']:.0f} orders/hour (avg: {summary['business']['order_count']['avg']:.1f}, max: {summary['business']['order_count']['max']:.0f})")
    report.append(f"Revenue: ${summary['business']['revenue']['current']:.2f}/hour (avg: ${summary['business']['revenue']['avg']:.2f}, max: ${summary['business']['revenue']['max']:.2f})")
    report.append("")
    
    # Performance analysis
    report.append("PERFORMANCE ANALYSIS")
    report.append("-" * 80)
    
    # API Performance insights
    avg_response = summary['api']['response_time']['avg']
    max_response = summary['api']['response_time']['max']
    if avg_response > 100:
        report.append("⚠️ API response times are high (> 100ms average). Consider optimizing or scaling.")
    if max_response > 500:
        report.append("⚠️ API response time spikes detected (> 500ms). Investigate potential bottlenecks.")
    
    # Cache efficiency insights
    avg_hit_rate = summary['cache']['hit_rate']['avg']
    if avg_hit_rate < 70:
        report.append("⚠️ Cache hit rate is below 70%. Consider tuning cache TTLs or preloading cache.")
    elif avg_hit_rate > 90:
        report.append("✅ Excellent cache hit rate (>90%). Cache configuration is working well.")
    
    # Resource usage insights
    avg_cpu = summary['system']['cpu_usage']['avg']
    max_cpu = summary['system']['cpu_usage']['max']
    if avg_cpu > 70:
        report.append("⚠️ CPU usage is consistently high (>70% average). Consider scaling up.")
    if max_cpu > 90:
        report.append("⚠️ CPU usage spikes detected (>90%). Investigate potential resource constraints.")
    
    avg_memory = summary['system']['memory_usage']['avg']
    if avg_memory > 75:
        report.append("⚠️ Memory usage is high (>75% average). Consider adding more memory.")
    
    # Sync performance insights
    avg_sync_rate = summary['sync']['success_rate']['avg']
    if avg_sync_rate < 90:
        report.append("⚠️ Sync success rate is below 90%. Investigate sync failures.")
    
    report.append("")
    report.append("=" * 80)
    
    return "\n".join(report)


def main():
    """Main function to run the example."""
    print("Shopify MCP Server - Monitoring and Visualization Example")
    
    # Generate simulated monitoring data
    simulator = MonitoringDataSimulator(duration_days=7)
    metrics = simulator.get_metrics()
    summary = simulator.get_summary_metrics()
    hourly_data = simulator.get_hourly_averages()
    daily_data = simulator.get_daily_averages()
    
    # Generate text report
    report_text = generate_text_report(metrics, summary)
    print("\nGenerating monitoring report...")
    
    # Save text report
    output_dir = "monitoring_output"
    os.makedirs(output_dir, exist_ok=True)
    
    with open(os.path.join(output_dir, "monitoring_report.txt"), "w") as f:
        f.write(report_text)
    
    print(f"Text report saved to {output_dir}/monitoring_report.txt")
    
    # Generate JSON data export
    serializable_metrics = {
        "timestamps": [ts.isoformat() for ts in metrics["timestamps"]],
        "system": metrics["system"],
        "api": metrics["api"],
        "cache": metrics["cache"],
        "sync": metrics["sync"],
        "business": metrics["business"]
    }
    
    with open(os.path.join(output_dir, "metrics_data.json"), "w") as f:
        json.dump(serializable_metrics, f, indent=2)
    
    print(f"Metrics data saved to {output_dir}/metrics_data.json")
    
    # Create visualizations if matplotlib is available
    if visualization_available:
        print("\nGenerating visualizations...")
        
        visualizer = MetricsVisualizer(output_dir=output_dir)
        
        # Time series plots
        visualizer.plot_time_series(
            timestamps=metrics["timestamps"],
            data={"Requests": metrics["api"]["requests"]},
            title="API Requests Over Time",
            y_label="Requests per Hour",
            filename="api_requests"
        )
        
        visualizer.plot_time_series(
            timestamps=metrics["timestamps"],
            data={"Response Time": metrics["api"]["response_time"]},
            title="API Response Time Over Time",
            y_label="Response Time (ms)",
            filename="api_response_time"
        )
        
        visualizer.plot_time_series(
            timestamps=metrics["timestamps"],
            data={
                "CPU Usage": metrics["system"]["cpu_usage"],
                "Memory Usage": metrics["system"]["memory_usage"],
                "Disk Usage": metrics["system"]["disk_usage"]
            },
            title="System Resource Usage Over Time",
            y_label="Usage (%)",
            filename="system_usage"
        )
        
        visualizer.plot_time_series(
            timestamps=metrics["timestamps"],
            data={
                "Hit Rate": metrics["cache"]["hit_rate"],
                "Miss Rate": metrics["cache"]["miss_rate"]
            },
            title="Cache Performance Over Time",
            y_label="Rate (%)",
            filename="cache_performance"
        )
        
        visualizer.plot_time_series(
            timestamps=metrics["timestamps"],
            data={"Success Rate": metrics["sync"]["success_rate"]},
            title="Sync Success Rate Over Time",
            y_label="Success Rate (%)",
            filename="sync_success_rate"
        )
        
        visualizer.plot_time_series(
            timestamps=metrics["timestamps"],
            data={"Orders": metrics["business"]["order_count"]},
            title="Orders Over Time",
            y_label="Orders per Hour",
            filename="orders"
        )
        
        visualizer.plot_time_series(
            timestamps=metrics["timestamps"],
            data={"Revenue": metrics["business"]["revenue"]},
            title="Revenue Over Time",
            y_label="Revenue ($)",
            filename="revenue"
        )
        
        # Hourly pattern plots
        visualizer.plot_hourly_pattern(
            hourly_data=hourly_data,
            category="api",
            metric="requests",
            title="API Requests by Hour of Day",
            y_label="Average Requests",
            filename="hourly_api_requests"
        )
        
        visualizer.plot_hourly_pattern(
            hourly_data=hourly_data,
            category="api",
            metric="response_time",
            title="API Response Time by Hour of Day",
            y_label="Average Response Time (ms)",
            filename="hourly_response_time"
        )
        
        visualizer.plot_hourly_pattern(
            hourly_data=hourly_data,
            category="business",
            metric="order_count",
            title="Orders by Hour of Day",
            y_label="Average Orders",
            filename="hourly_orders"
        )
        
        # Daily pattern plots
        visualizer.plot_daily_pattern(
            daily_data=daily_data,
            category="api",
            metric="requests",
            title="API Requests by Day of Week",
            y_label="Average Requests",
            filename="daily_api_requests"
        )
        
        visualizer.plot_daily_pattern(
            daily_data=daily_data,
            category="business",
            metric="order_count",
            title="Orders by Day of Week",
            y_label="Average Orders",
            filename="daily_orders"
        )
        
        visualizer.plot_daily_pattern(
            daily_data=daily_data,
            category="business",
            metric="revenue",
            title="Revenue by Day of Week",
            y_label="Average Revenue ($)",
            filename="daily_revenue"
        )
        
        # Correlation plots
        visualizer.plot_correlation(
            data1=metrics["api"]["requests"],
            data2=metrics["api"]["response_time"],
            label1="API Requests",
            label2="Response Time (ms)",
            title="Correlation: API Requests vs Response Time",
            filename="correlation_requests_response"
        )
        
        visualizer.plot_correlation(
            data1=metrics["api"]["requests"],
            data2=metrics["business"]["order_count"],
            label1="API Requests",
            label2="Orders",
            title="Correlation: API Requests vs Orders",
            filename="correlation_requests_orders"
        )
        
        # Create dashboard
        visualizer.create_dashboard(metrics, summary)
        
        print(f"Visualizations saved to {output_dir}/ directory")
    else:
        print("\nSkipping visualizations - matplotlib not available")
        print("To create visualizations, install matplotlib: pip install matplotlib numpy")
    
    print("\nMonitoring and visualization example completed successfully!")


if __name__ == "__main__":
    main()