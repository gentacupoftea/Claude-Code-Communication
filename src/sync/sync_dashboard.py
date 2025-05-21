"""
Sync monitoring dashboard module.

This module provides tools for generating dashboard visualizations
and reports for sync performance metrics.
"""

import os
import json
import time
import datetime
import csv
from typing import Dict, List, Any, Optional, Union, Tuple


class SyncDashboard:
    """
    Generates dashboard visualizations and reports for sync metrics.
    
    This class produces HTML dashboards and reports for monitoring
    sync operation performance and usage patterns.
    """
    
    def __init__(
        self,
        metrics_collector,
        dashboard_title: str = "Sync Performance Dashboard",
        refresh_interval: int = 60  # Default: refresh every minute
    ):
        """
        Initialize the sync dashboard.
        
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
        Generate an HTML dashboard for sync metrics.
        
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
        success_rates = [m.get("success_rate", 0) for m in recent_metrics]
        
        # Extract sync durations
        durations = [m.get("avg_sync_duration", 0) for m in recent_metrics]
        
        # Extract API success rates
        shopify_api_rates = []
        external_api_rates = []
        for m in recent_metrics:
            api_calls = m.get("api_calls", {})
            
            # Shopify API success rate
            shopify = api_calls.get("shopify", {})
            shopify_total = shopify.get("total", 0)
            shopify_success = shopify.get("success", 0)
            if shopify_total > 0:
                shopify_api_rates.append(shopify_success / shopify_total)
            else:
                shopify_api_rates.append(None)
            
            # External API success rate
            external = api_calls.get("external", {})
            external_total = external.get("total", 0)
            external_success = external.get("success", 0)
            if external_total > 0:
                external_api_rates.append(external_success / external_total)
            else:
                external_api_rates.append(None)
        
        # Extract error counts
        error_counts = []
        for m in recent_metrics:
            errors = m.get("errors", [])
            if isinstance(errors, list):
                error_counts.append(sum(e.get("count", 0) for e in errors))
            else:
                error_counts.append(0)
        
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
                .error-table {{
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }}
                .error-table th, .error-table td {{
                    padding: 8px 12px;
                    text-align: left;
                    border-bottom: 1px solid #ddd;
                }}
                .error-table th {{
                    background-color: #f2f2f2;
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
                    <h2>Sync Performance Overview</h2>
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-label">Sync Success Rate</div>
                            <div class="stat-value">{aggregated.get('success_rate', {}).get('avg', 0):.1%}</div>
                            <div class="stat-label">Min: {aggregated.get('success_rate', {}).get('min', 0):.1%}, Max: {aggregated.get('success_rate', {}).get('max', 0):.1%}</div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-label">Average Sync Duration</div>
                            <div class="stat-value">{aggregated.get('sync_duration', {}).get('avg', 0):.1f}s</div>
                            <div class="stat-label">Min: {aggregated.get('sync_duration', {}).get('min', 0):.1f}s, Max: {aggregated.get('sync_duration', {}).get('max', 0):.1f}s</div>
                        </div>
        """
        
        # Add API success rates if available
        if "shopify_api_success_rate" in aggregated:
            html += f"""
                        <div class="stat-card">
                            <div class="stat-label">Shopify API Success Rate</div>
                            <div class="stat-value">{aggregated['shopify_api_success_rate']['avg']:.1%}</div>
                            <div class="stat-label">Min: {aggregated['shopify_api_success_rate']['min']:.1%}, Max: {aggregated['shopify_api_success_rate']['max']:.1%}</div>
                        </div>
            """
        
        if "external_api_success_rate" in aggregated:
            html += f"""
                        <div class="stat-card">
                            <div class="stat-label">External API Success Rate</div>
                            <div class="stat-value">{aggregated['external_api_success_rate']['avg']:.1%}</div>
                            <div class="stat-label">Min: {aggregated['external_api_success_rate']['min']:.1%}, Max: {aggregated['external_api_success_rate']['max']:.1%}</div>
                        </div>
            """
        
        # Add data volume metrics if available
        if "data_volume" in aggregated:
            data_volume = aggregated["data_volume"]
            entities = data_volume.get("entities_processed", 0)
            bytes_transferred = data_volume.get("bytes_transferred", 0)
            
            # Convert bytes to more readable format
            bytes_display = bytes_transferred
            unit = "B"
            
            if bytes_transferred >= 1024:
                bytes_display = bytes_transferred / 1024
                unit = "KB"
            
            if bytes_display >= 1024:
                bytes_display = bytes_display / 1024
                unit = "MB"
                
            if bytes_display >= 1024:
                bytes_display = bytes_display / 1024
                unit = "GB"
            
            html += f"""
                        <div class="stat-card">
                            <div class="stat-label">Entities Processed</div>
                            <div class="stat-value">{entities:,}</div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-label">Data Transferred</div>
                            <div class="stat-value">{bytes_display:.1f} {unit}</div>
                        </div>
            """
        
        # Add job status counts if available
        if recent_metrics and "job_statuses" in recent_metrics[-1]:
            job_statuses = recent_metrics[-1]["job_statuses"]
            total_jobs = sum(job_statuses.values())
            
            html += f"""
                        <div class="stat-card">
                            <div class="stat-label">Total Jobs</div>
                            <div class="stat-value">{total_jobs}</div>
                            <div class="stat-label">Active: {job_statuses.get('in_progress', 0) + job_statuses.get('pending', 0)}</div>
                        </div>
            """
        
        # Charts section
        html += """
                    </div>
                    
                    <!-- Charts -->
                    <h2>Performance Trends</h2>
                    
                    <div class="chart-container">
                        <canvas id="successRateChart"></canvas>
                    </div>
                    
                    <div class="chart-container">
                        <canvas id="syncDurationChart"></canvas>
                    </div>
                    
                    <div class="chart-container">
                        <canvas id="apiSuccessRateChart"></canvas>
                    </div>
                    
                    <div class="chart-container">
                        <canvas id="errorCountChart"></canvas>
                    </div>
        """
        
        # Error summary section
        most_common_errors = aggregated.get("most_common_errors", [])
        if most_common_errors:
            html += """
                    <!-- Error Summary -->
                    <h2>Most Common Errors</h2>
                    <table class="error-table">
                        <thead>
                            <tr>
                                <th>Entity Type</th>
                                <th>Error Type</th>
                                <th>Count</th>
                            </tr>
                        </thead>
                        <tbody>
            """
            
            for error in most_common_errors:
                html += f"""
                            <tr>
                                <td>{error.get('entity_type', 'unknown')}</td>
                                <td>{error.get('error_type', 'unknown')}</td>
                                <td>{error.get('count', 0)}</td>
                            </tr>
                """
            
            html += """
                        </tbody>
                    </table>
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
                        <p>Generated by Sync Dashboard | Time Window: {time_window//60} minutes | Samples: {aggregated.get('samples', 0)}</p>
                    </div>
                </div>
            </div>
            
            <script>
                // Format timestamps for charts
                const timestamps = {json.dumps([datetime.datetime.fromtimestamp(ts).strftime('%H:%M:%S') if ts else '00:00:00' for ts in timestamps])};
                
                // Success Rate Chart
                const successRateCtx = document.getElementById('successRateChart').getContext('2d');
                new Chart(successRateCtx, {{
                    type: 'line',
                    data: {{
                        labels: timestamps,
                        datasets: [{{
                            label: 'Success Rate',
                            data: {json.dumps(success_rates)},
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
                                    text: 'Success Rate (0-1)'
                                }}
                            }}
                        }},
                        plugins: {{
                            title: {{
                                display: true,
                                text: 'Sync Success Rate'
                            }}
                        }}
                    }}
                }});
                
                // Sync Duration Chart
                const durationCtx = document.getElementById('syncDurationChart').getContext('2d');
                new Chart(durationCtx, {{
                    type: 'line',
                    data: {{
                        labels: timestamps,
                        datasets: [{{
                            label: 'Sync Duration (seconds)',
                            data: {json.dumps(durations)},
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
                                title: {{
                                    display: true,
                                    text: 'Duration (seconds)'
                                }}
                            }}
                        }},
                        plugins: {{
                            title: {{
                                display: true,
                                text: 'Average Sync Duration'
                            }}
                        }}
                    }}
                }});
                
                // API Success Rate Chart
                const apiSuccessCtx = document.getElementById('apiSuccessRateChart').getContext('2d');
                new Chart(apiSuccessCtx, {{
                    type: 'line',
                    data: {{
                        labels: timestamps,
                        datasets: [
                            {{
                                label: 'Shopify API',
                                data: {json.dumps(shopify_api_rates)},
                                borderColor: 'rgba(75, 192, 192, 1)',
                                backgroundColor: 'rgba(75, 192, 192, 0.1)',
                                tension: 0.4
                            }},
                            {{
                                label: 'External API',
                                data: {json.dumps(external_api_rates)},
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
                                max: 1.0,
                                title: {{
                                    display: true,
                                    text: 'Success Rate (0-1)'
                                }}
                            }}
                        }},
                        plugins: {{
                            title: {{
                                display: true,
                                text: 'API Success Rates'
                            }}
                        }}
                    }}
                }});
                
                // Error Count Chart
                const errorCtx = document.getElementById('errorCountChart').getContext('2d');
                new Chart(errorCtx, {{
                    type: 'bar',
                    data: {{
                        labels: timestamps,
                        datasets: [{{
                            label: 'Error Count',
                            data: {json.dumps(error_counts)},
                            backgroundColor: 'rgba(255, 99, 132, 0.5)',
                            borderColor: 'rgba(255, 99, 132, 1)',
                            borderWidth: 1
                        }}]
                    }},
                    options: {{
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {{
                            y: {{
                                beginAtZero: true,
                                title: {{
                                    display: true,
                                    text: 'Error Count'
                                }}
                            }}
                        }},
                        plugins: {{
                            title: {{
                                display: true,
                                text: 'Sync Errors'
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
            print(f"Failed to save sync dashboard: {e}")
            return False
    
    def generate_text_report(self, time_window: int = 3600) -> str:
        """
        Generate a plain text report of sync performance.
        
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
            f"   SYNC PERFORMANCE REPORT - {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "====================================================",
            f"Report covers the last {minutes} minutes ({aggregated.get('samples', 0)} samples)",
            "",
            "PERFORMANCE SUMMARY:",
            "-------------------",
            f"Success Rate:       {aggregated.get('success_rate', {}).get('avg', 0):.1%} (min: {aggregated.get('success_rate', {}).get('min', 0):.1%}, max: {aggregated.get('success_rate', {}).get('max', 0):.1%})",
            f"Avg Sync Duration:  {aggregated.get('sync_duration', {}).get('avg', 0):.1f}s (min: {aggregated.get('sync_duration', {}).get('min', 0):.1f}s, max: {aggregated.get('sync_duration', {}).get('max', 0):.1f}s)",
        ]
        
        # Add API success rates if available
        if "shopify_api_success_rate" in aggregated:
            report.append(f"Shopify API Rate:    {aggregated['shopify_api_success_rate']['avg']:.1%} (min: {aggregated['shopify_api_success_rate']['min']:.1%}, max: {aggregated['shopify_api_success_rate']['max']:.1%})")
            
        if "external_api_success_rate" in aggregated:
            report.append(f"External API Rate:   {aggregated['external_api_success_rate']['avg']:.1%} (min: {aggregated['external_api_success_rate']['min']:.1%}, max: {aggregated['external_api_success_rate']['max']:.1%})")
        
        # Add data volume metrics if available
        if "data_volume" in aggregated:
            data_volume = aggregated["data_volume"]
            entities = data_volume.get("entities_processed", 0)
            bytes_transferred = data_volume.get("bytes_transferred", 0)
            
            # Convert bytes to more readable format
            bytes_display = bytes_transferred
            unit = "B"
            
            if bytes_transferred >= 1024:
                bytes_display = bytes_transferred / 1024
                unit = "KB"
            
            if bytes_display >= 1024:
                bytes_display = bytes_display / 1024
                unit = "MB"
                
            if bytes_display >= 1024:
                bytes_display = bytes_display / 1024
                unit = "GB"
            
            report.extend([
                f"Entities Processed: {entities:,}",
                f"Data Transferred:   {bytes_display:.1f} {unit}"
            ])
        
        # Add error summary
        most_common_errors = aggregated.get("most_common_errors", [])
        if most_common_errors:
            report.extend([
                "",
                "MOST COMMON ERRORS:",
                "-------------------"
            ])
            
            for error in most_common_errors[:5]:  # Top 5 errors
                entity_type = error.get("entity_type", "unknown")
                error_type = error.get("error_type", "unknown")
                count = error.get("count", 0)
                report.append(f"- {entity_type}: {error_type} ({count} occurrences)")
        
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
            f"Report generated by Sync Dashboard | Window: {minutes} minutes",
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
            print(f"Failed to save sync report: {e}")
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
            metrics = self.metrics_collector.get_recent_metrics()
            if time_window:
                cutoff_time = time.time() - time_window
                metrics = [m for m in metrics if m["timestamp"] > cutoff_time]
            
            if not metrics:
                print("No metrics to export to CSV")
                return False
            
            # Define headers for CSV
            headers = ["timestamp", "datetime", "success_rate", "avg_sync_duration", 
                    "success_count", "failure_count", "total_syncs", "entities_processed"]
            
            # Write CSV
            with open(filename, 'w', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=headers, extrasaction='ignore')
                writer.writeheader()
                
                for metric in metrics:
                    writer.writerow(metric)
            
            return True
        except Exception as e:
            print(f"Failed to export sync metrics to CSV: {e}")
            return False
    
    def export_metrics_excel(self, filename: str, time_window: Optional[int] = None) -> bool:
        """
        Export metrics to an Excel file.
        
        Note: This requires the optional pandas and openpyxl packages.
        
        Args:
            filename: File path to write metrics to
            time_window: Optional time window in seconds
            
        Returns:
            True if successful, False otherwise
        """
        try:
            import pandas as pd
            
            metrics = self.metrics_collector.get_recent_metrics()
            if time_window:
                cutoff_time = time.time() - time_window
                metrics = [m for m in metrics if m["timestamp"] > cutoff_time]
            
            if not metrics:
                print("No metrics to export to Excel")
                return False
            
            # Convert to DataFrame
            df = pd.DataFrame(metrics)
            
            # Format datetime column
            if "datetime" in df.columns:
                df["datetime"] = pd.to_datetime(df["datetime"])
            
            # Format percentage columns
            percent_columns = ["success_rate"]
            for col in percent_columns:
                if col in df.columns:
                    df[col] = df[col].astype(float)
            
            # Write to Excel
            df.to_excel(filename, index=False, sheet_name="Sync Metrics")
            
            return True
        except ImportError:
            print("pandas and openpyxl packages are required for Excel export")
            return False
        except Exception as e:
            print(f"Failed to export sync metrics to Excel: {e}")
            return False