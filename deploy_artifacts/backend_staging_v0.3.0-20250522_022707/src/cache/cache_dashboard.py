"""
Cache monitoring dashboard module.

This module provides tools for generating dashboard visualizations
and reports for cache performance metrics.
"""

import os
import json
import time
import datetime
from typing import Dict, List, Any, Optional, Union, Tuple


class CacheDashboard:
    """
    Generates dashboard visualizations and reports for cache metrics.
    
    This class produces HTML dashboards and reports for monitoring
    cache performance and usage patterns.
    """
    
    def __init__(
        self,
        metrics_collector,
        dashboard_title: str = "Cache Performance Dashboard",
        refresh_interval: int = 60  # Default: refresh every minute
    ):
        """
        Initialize the cache dashboard.
        
        Args:
            metrics_collector: The metrics collector to get data from
            dashboard_title: Title for the dashboard
            refresh_interval: How often the dashboard should refresh in seconds
        """
        self.metrics_collector = metrics_collector
        self.dashboard_title = dashboard_title
        self.refresh_interval = refresh_interval
    
    def generate_dashboard_html(self, time_window: int = 3600) -> str:
        """
        Generate an HTML dashboard for cache metrics.
        
        Args:
            time_window: Time window in seconds for metrics to display
            
        Returns:
            HTML string for the dashboard
        """
        # Get metrics data
        recent_metrics = self.metrics_collector.get_recent_metrics(60)
        aggregated = self.metrics_collector.get_aggregated_metrics(time_window)
        alerts = self.metrics_collector.get_alert_conditions()
        
        # Prepare data for charts
        timestamps = [m["timestamp"] for m in recent_metrics]
        hit_rates = [m["hit_rate"] for m in recent_metrics]
        
        # Extract cache utilization
        utilization = []
        for m in recent_metrics:
            cache_size = m.get("memory_cache_size", 0)
            cache_limit = m.get("memory_cache_limit", 1)
            utilization.append(cache_size / cache_limit if cache_limit > 0 else 0)
        
        # Extract operation rates if available
        ops_data = {"hits_per_sec": [], "misses_per_sec": [], "evictions_per_sec": []}
        for m in recent_metrics:
            time_based = m.get("time_based", {})
            ops_data["hits_per_sec"].append(time_based.get("hits_per_second", 0))
            ops_data["misses_per_sec"].append(time_based.get("misses_per_second", 0))
            ops_data["evictions_per_sec"].append(time_based.get("memory_evictions_per_second", 0))
        
        # Generate HTML
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>{self.dashboard_title}</title>
            <meta http-equiv="refresh" content="{self.refresh_interval}">
            <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 20px;
                    background-color: #f5f5f5;
                }}
                .dashboard {{
                    max-width: 1200px;
                    margin: 0 auto;
                }}
                .header {{
                    background-color: #333;
                    color: white;
                    padding: 20px;
                    border-radius: 5px 5px 0 0;
                }}
                .content {{
                    background-color: white;
                    padding: 20px;
                    border-radius: 0 0 5px 5px;
                    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
                }}
                .chart-container {{
                    width: 100%;
                    height: 300px;
                    margin-bottom: 30px;
                }}
                .stats-grid {{
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                    gap: 15px;
                    margin-bottom: 30px;
                }}
                .stat-card {{
                    background-color: #f9f9f9;
                    border-radius: 5px;
                    padding: 15px;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                }}
                .stat-value {{
                    font-size: 24px;
                    font-weight: bold;
                    margin: 10px 0;
                }}
                .stat-label {{
                    color: #666;
                    font-size: 14px;
                }}
                .alerts {{
                    margin-top: 30px;
                }}
                .alert {{
                    padding: 10px 15px;
                    margin-bottom: 10px;
                    border-radius: 5px;
                }}
                .alert-critical {{
                    background-color: #ffebee;
                    border-left: 5px solid #f44336;
                }}
                .alert-warning {{
                    background-color: #fff8e1;
                    border-left: 5px solid #ffc107;
                }}
                .footer {{
                    margin-top: 30px;
                    text-align: center;
                    font-size: 12px;
                    color: #999;
                }}
                h2 {{
                    color: #333;
                    margin-top: 30px;
                    margin-bottom: 15px;
                    border-bottom: 1px solid #eee;
                    padding-bottom: 10px;
                }}
            </style>
        </head>
        <body>
            <div class="dashboard">
                <div class="header">
                    <h1>{self.dashboard_title}</h1>
                    <p>Last updated: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
                </div>
                
                <div class="content">
                    <!-- Stats Overview -->
                    <h2>Cache Performance Overview</h2>
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-label">Average Hit Rate</div>
                            <div class="stat-value">{aggregated.get('hit_rate', {}).get('avg', 0):.1%}</div>
                            <div class="stat-label">Min: {aggregated.get('hit_rate', {}).get('min', 0):.1%}, Max: {aggregated.get('hit_rate', {}).get('max', 0):.1%}</div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-label">Cache Utilization</div>
                            <div class="stat-value">{aggregated.get('cache_utilization', {}).get('avg', 0):.1%}</div>
                            <div class="stat-label">Min: {aggregated.get('cache_utilization', {}).get('min', 0):.1%}, Max: {aggregated.get('cache_utilization', {}).get('max', 0):.1%}</div>
                        </div>
        """
        
        # Add more stats if available
        if "hits_per_second" in aggregated:
            html += f"""
                        <div class="stat-card">
                            <div class="stat-label">Hits per Second</div>
                            <div class="stat-value">{aggregated['hits_per_second']['avg']:.1f}</div>
                            <div class="stat-label">Min: {aggregated['hits_per_second']['min']:.1f}, Max: {aggregated['hits_per_second']['max']:.1f}</div>
                        </div>
            """
        
        if "misses_per_second" in aggregated:
            html += f"""
                        <div class="stat-card">
                            <div class="stat-label">Misses per Second</div>
                            <div class="stat-value">{aggregated['misses_per_second']['avg']:.1f}</div>
                            <div class="stat-label">Min: {aggregated['misses_per_second']['min']:.1f}, Max: {aggregated['misses_per_second']['max']:.1f}</div>
                        </div>
            """
        
        if "evictions_per_second" in aggregated:
            html += f"""
                        <div class="stat-card">
                            <div class="stat-label">Evictions per Second</div>
                            <div class="stat-value">{aggregated['evictions_per_second']['avg']:.1f}</div>
                            <div class="stat-label">Min: {aggregated['evictions_per_second']['min']:.1f}, Max: {aggregated['evictions_per_second']['max']:.1f}</div>
                        </div>
            """
        
        if recent_metrics:
            last_metrics = recent_metrics[-1]
            total_requests = last_metrics.get('total_requests', 0)
            html += f"""
                        <div class="stat-card">
                            <div class="stat-label">Total Requests</div>
                            <div class="stat-value">{total_requests:,}</div>
                            <div class="stat-label">Hits: {last_metrics.get('hits', 0):,}, Misses: {last_metrics.get('misses', 0):,}</div>
                        </div>
            """
        
        # Charts section
        html += """
                    </div>
                    
                    <!-- Charts -->
                    <h2>Performance Trends</h2>
                    
                    <div class="chart-container">
                        <canvas id="hitRateChart"></canvas>
                    </div>
                    
                    <div class="chart-container">
                        <canvas id="cacheUtilizationChart"></canvas>
                    </div>
                    
                    <div class="chart-container">
                        <canvas id="operationsChart"></canvas>
                    </div>
        """
        
        # Alerts section
        if alerts:
            html += """
                    <!-- Alerts -->
                    <h2>Alerts</h2>
                    <div class="alerts">
            """
            
            for alert in alerts:
                severity = alert.get('severity', 'warning')
                description = alert.get('description', '')
                html += f"""
                        <div class="alert alert-{severity}">
                            {description}
                        </div>
                """
            
            html += """
                    </div>
            """
        
        # JavaScript for charts
        html += f"""
                    <!-- Page Footer -->
                    <div class="footer">
                        <p>Generated by Cache Dashboard | Time Window: {time_window//60} minutes | Samples: {aggregated.get('samples', 0)}</p>
                    </div>
                </div>
            </div>
            
            <script>
                // Format timestamps for charts
                const timestamps = {json.dumps([datetime.datetime.fromtimestamp(ts).strftime('%H:%M:%S') if ts else '00:00:00' for ts in timestamps])};
                
                // Hit Rate Chart
                const hitRateCtx = document.getElementById('hitRateChart').getContext('2d');
                new Chart(hitRateCtx, {{
                    type: 'line',
                    data: {{
                        labels: timestamps,
                        datasets: [{{
                            label: 'Hit Rate',
                            data: {json.dumps(hit_rates)},
                            borderColor: 'rgba(54, 162, 235, 1)',
                            backgroundColor: 'rgba(54, 162, 235, 0.1)',
                            fill: true,
                            tension: 0.4
                        }}]
                    }},
                    options: {{
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {{
                            y: {{
                                beginAtZero: true,
                                max: 1.0,
                                title: {{
                                    display: true,
                                    text: 'Hit Rate (0-1)'
                                }}
                            }}
                        }},
                        plugins: {{
                            title: {{
                                display: true,
                                text: 'Cache Hit Rate'
                            }}
                        }}
                    }}
                }});
                
                // Cache Utilization Chart
                const utilizationCtx = document.getElementById('cacheUtilizationChart').getContext('2d');
                new Chart(utilizationCtx, {{
                    type: 'line',
                    data: {{
                        labels: timestamps,
                        datasets: [{{
                            label: 'Cache Utilization',
                            data: {json.dumps(utilization)},
                            borderColor: 'rgba(255, 159, 64, 1)',
                            backgroundColor: 'rgba(255, 159, 64, 0.1)',
                            fill: true,
                            tension: 0.4
                        }}]
                    }},
                    options: {{
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {{
                            y: {{
                                beginAtZero: true,
                                max: 1.0,
                                title: {{
                                    display: true,
                                    text: 'Utilization (0-1)'
                                }}
                            }}
                        }},
                        plugins: {{
                            title: {{
                                display: true,
                                text: 'Cache Utilization'
                            }}
                        }}
                    }}
                }});
                
                // Operations Chart
                const opsCtx = document.getElementById('operationsChart').getContext('2d');
                new Chart(opsCtx, {{
                    type: 'line',
                    data: {{
                        labels: timestamps,
                        datasets: [
                            {{
                                label: 'Hits/sec',
                                data: {json.dumps(ops_data["hits_per_sec"])},
                                borderColor: 'rgba(75, 192, 192, 1)',
                                backgroundColor: 'rgba(75, 192, 192, 0.1)',
                                tension: 0.4
                            }},
                            {{
                                label: 'Misses/sec',
                                data: {json.dumps(ops_data["misses_per_sec"])},
                                borderColor: 'rgba(255, 99, 132, 1)',
                                backgroundColor: 'rgba(255, 99, 132, 0.1)',
                                tension: 0.4
                            }},
                            {{
                                label: 'Evictions/sec',
                                data: {json.dumps(ops_data["evictions_per_sec"])},
                                borderColor: 'rgba(153, 102, 255, 1)',
                                backgroundColor: 'rgba(153, 102, 255, 0.1)',
                                tension: 0.4
                            }}
                        ]
                    }},
                    options: {{
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {{
                            y: {{
                                beginAtZero: true,
                                title: {{
                                    display: true,
                                    text: 'Operations per Second'
                                }}
                            }}
                        }},
                        plugins: {{
                            title: {{
                                display: true,
                                text: 'Cache Operations Rate'
                            }}
                        }}
                    }}
                }});
            </script>
        </body>
        </html>
        """
        
        return html
    
    def save_dashboard_html(self, filename: str, time_window: int = 3600) -> bool:
        """
        Generate and save the dashboard HTML to a file.
        
        Args:
            filename: File path to save the dashboard HTML
            time_window: Time window in seconds for metrics to display
            
        Returns:
            True if successful, False otherwise
        """
        try:
            html = self.generate_dashboard_html(time_window)
            with open(filename, 'w') as f:
                f.write(html)
            return True
        except Exception as e:
            print(f"Failed to save dashboard: {e}")
            return False
    
    def generate_text_report(self, time_window: int = 3600) -> str:
        """
        Generate a plain text report of cache performance.
        
        Args:
            time_window: Time window in seconds for metrics
            
        Returns:
            Text report string
        """
        # Get metrics data
        aggregated = self.metrics_collector.get_aggregated_metrics(time_window)
        alerts = self.metrics_collector.get_alert_conditions()
        
        # Calculate time window in minutes for display
        minutes = time_window // 60
        
        # Build report
        report = [
            "====================================================",
            f"   CACHE PERFORMANCE REPORT - {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "====================================================",
            f"Report covers the last {minutes} minutes ({aggregated.get('samples', 0)} samples)",
            "",
            "PERFORMANCE SUMMARY:",
            "-------------------",
            f"Hit Rate:         {aggregated.get('hit_rate', {}).get('avg', 0):.1%} (min: {aggregated.get('hit_rate', {}).get('min', 0):.1%}, max: {aggregated.get('hit_rate', {}).get('max', 0):.1%})",
            f"Cache Utilization: {aggregated.get('cache_utilization', {}).get('avg', 0):.1%} (min: {aggregated.get('cache_utilization', {}).get('min', 0):.1%}, max: {aggregated.get('cache_utilization', {}).get('max', 0):.1%})",
        ]
        
        # Add operations rates if available
        if "hits_per_second" in aggregated:
            report.append(f"Hits per Second:   {aggregated['hits_per_second']['avg']:.1f} (min: {aggregated['hits_per_second']['min']:.1f}, max: {aggregated['hits_per_second']['max']:.1f})")
            
        if "misses_per_second" in aggregated:
            report.append(f"Misses per Second: {aggregated['misses_per_second']['avg']:.1f} (min: {aggregated['misses_per_second']['min']:.1f}, max: {aggregated['misses_per_second']['max']:.1f})")
            
        if "evictions_per_second" in aggregated:
            report.append(f"Evictions/Second:  {aggregated['evictions_per_second']['avg']:.1f} (min: {aggregated['evictions_per_second']['min']:.1f}, max: {aggregated['evictions_per_second']['max']:.1f})")
        
        # Add alerts if any
        if alerts:
            report.extend([
                "",
                "ALERTS:",
                "-------"
            ])
            
            for alert in alerts:
                severity = alert.get('severity', 'warning').upper()
                description = alert.get('description', '')
                report.append(f"[{severity}] {description}")
        
        # Add footer
        report.extend([
            "",
            "====================================================",
            f"Report generated by Cache Dashboard | Window: {minutes} minutes",
            "===================================================="
        ])
        
        return "\n".join(report)
    
    def save_text_report(self, filename: str, time_window: int = 3600) -> bool:
        """
        Generate and save a text report to a file.
        
        Args:
            filename: File path to save the report
            time_window: Time window in seconds for metrics
            
        Returns:
            True if successful, False otherwise
        """
        try:
            report = self.generate_text_report(time_window)
            with open(filename, 'w') as f:
                f.write(report)
            return True
        except Exception as e:
            print(f"Failed to save report: {e}")
            return False