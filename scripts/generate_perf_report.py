#!/usr/bin/env python3
"""
Generate performance report from test results.
"""

import os
import json
import glob
import argparse
from datetime import datetime
import matplotlib.pyplot as plt
import pandas as pd


def load_performance_data(reports_dir):
    """Load all performance test results from the reports directory."""
    data = {
        "product_sync": [],
        "multi_platform_sync": [],
        "scheduler_performance": []
    }
    
    # Find all JSON files in the reports directory
    json_files = glob.glob(os.path.join(reports_dir, "*.json"))
    
    for file_path in json_files:
        try:
            with open(file_path, 'r') as f:
                result = json.load(f)
                
            test_name = result.get("test_name")
            if test_name in data:
                data[test_name].append(result)
        except (json.JSONDecodeError, KeyError) as e:
            print(f"Error loading {file_path}: {e}")
    
    return data


def generate_product_sync_report(results, output_dir):
    """Generate report for product sync performance tests."""
    if not results:
        print("No product sync test results found.")
        return
    
    # Sort by timestamp
    results.sort(key=lambda x: x.get("timestamp", ""))
    
    # Extract data for plotting
    product_counts = [r.get("product_count", 0) for r in results]
    durations = [r.get("duration_seconds", 0) for r in results]
    products_per_second = [r.get("products_per_second", 0) for r in results]
    memory_deltas = [r.get("memory_delta_mb", 0) for r in results]
    
    # Create performance metrics dataframe
    df = pd.DataFrame({
        "Product Count": product_counts,
        "Duration (s)": durations,
        "Products/Second": products_per_second,
        "Memory Delta (MB)": memory_deltas
    })
    
    # Save to CSV
    csv_path = os.path.join(output_dir, "product_sync_performance.csv")
    df.to_csv(csv_path, index=False)
    print(f"Product sync metrics saved to {csv_path}")
    
    # Create plots
    fig, axes = plt.subplots(2, 1, figsize=(10, 12))
    
    # Duration vs Product Count
    axes[0].plot(product_counts, durations, 'o-', linewidth=2)
    axes[0].set_title('Sync Duration vs Product Count')
    axes[0].set_xlabel('Number of Products')
    axes[0].set_ylabel('Duration (seconds)')
    axes[0].grid(True)
    
    # Memory Delta vs Product Count
    axes[1].plot(product_counts, memory_deltas, 'o-', linewidth=2, color='green')
    axes[1].set_title('Memory Usage vs Product Count')
    axes[1].set_xlabel('Number of Products')
    axes[1].set_ylabel('Memory Delta (MB)')
    axes[1].grid(True)
    
    plt.tight_layout()
    
    # Save plot
    plot_path = os.path.join(output_dir, "product_sync_performance.png")
    plt.savefig(plot_path)
    print(f"Product sync performance plot saved to {plot_path}")


def generate_multi_platform_report(results, output_dir):
    """Generate report for multi-platform sync performance tests."""
    if not results:
        print("No multi-platform sync test results found.")
        return
    
    # Sort by timestamp
    results.sort(key=lambda x: x.get("timestamp", ""))
    
    # Extract platform names
    platforms = set()
    for result in results:
        for key in result.keys():
            if key.endswith("_products"):
                platforms.add(key.replace("_products", ""))
    
    # Create dataframe
    data = []
    for result in results:
        row = {
            "timestamp": result.get("timestamp", ""),
            "platform_count": result.get("platform_count", 0),
            "product_count": result.get("product_count", 0),
            "duration_seconds": result.get("duration_seconds", 0),
            "synced_count": result.get("sync_result", {}).get("synced_count", 0),
            "failed_count": result.get("sync_result", {}).get("failed_count", 0)
        }
        
        # Add platform-specific counts
        for platform in platforms:
            row[f"{platform}_count"] = result.get(f"{platform}_products", 0)
        
        data.append(row)
    
    df = pd.DataFrame(data)
    
    # Save to CSV
    csv_path = os.path.join(output_dir, "multi_platform_performance.csv")
    df.to_csv(csv_path, index=False)
    print(f"Multi-platform sync metrics saved to {csv_path}")
    
    # Create plot
    if len(results) > 1:
        plt.figure(figsize=(10, 6))
        plt.plot(range(len(results)), df["duration_seconds"], 'o-', linewidth=2)
        plt.title('Multi-Platform Sync Duration')
        plt.xlabel('Test Run')
        plt.ylabel('Duration (seconds)')
        plt.grid(True)
        
        # Save plot
        plot_path = os.path.join(output_dir, "multi_platform_performance.png")
        plt.savefig(plot_path)
        print(f"Multi-platform performance plot saved to {plot_path}")


def generate_scheduler_report(results, output_dir):
    """Generate report for scheduler performance tests."""
    if not results:
        print("No scheduler performance test results found.")
        return
    
    # Sort by timestamp
    results.sort(key=lambda x: x.get("timestamp", ""))
    
    # Create summary dataframe
    summary_data = []
    for result in results:
        summary_data.append({
            "timestamp": result.get("timestamp", ""),
            "duration_seconds": result.get("duration_seconds", 0),
            "avg_cpu_percent": result.get("avg_cpu_percent", 0),
            "avg_memory_mb": result.get("avg_memory_mb", 0),
            "max_cpu_percent": result.get("max_cpu_percent", 0),
            "max_memory_mb": result.get("max_memory_mb", 0),
            "sync_count": result.get("sync_count", 0)
        })
    
    summary_df = pd.DataFrame(summary_data)
    
    # Save summary to CSV
    csv_path = os.path.join(output_dir, "scheduler_performance_summary.csv")
    summary_df.to_csv(csv_path, index=False)
    print(f"Scheduler performance summary saved to {csv_path}")
    
    # Extract detailed stats for the latest run
    latest_result = results[-1]
    stats = latest_result.get("stats", [])
    
    if stats:
        # Create detailed dataframe
        stats_df = pd.DataFrame(stats)
        
        # Save detailed stats to CSV
        detail_csv_path = os.path.join(output_dir, "scheduler_performance_detail.csv")
        stats_df.to_csv(detail_csv_path, index=False)
        print(f"Scheduler detailed stats saved to {detail_csv_path}")
        
        # Create plots
        fig, axes = plt.subplots(2, 1, figsize=(10, 10))
        
        # CPU Usage over time
        axes[0].plot(stats_df["timestamp"], stats_df["cpu_percent"], 'o-', linewidth=2)
        axes[0].set_title('CPU Usage During Scheduled Sync')
        axes[0].set_xlabel('Time (seconds)')
        axes[0].set_ylabel('CPU Usage (%)')
        axes[0].grid(True)
        
        # Memory Usage over time
        axes[1].plot(stats_df["timestamp"], stats_df["memory_mb"], 'o-', linewidth=2, color='green')
        axes[1].set_title('Memory Usage During Scheduled Sync')
        axes[1].set_xlabel('Time (seconds)')
        axes[1].set_ylabel('Memory Usage (MB)')
        axes[1].grid(True)
        
        plt.tight_layout()
        
        # Save plot
        plot_path = os.path.join(output_dir, "scheduler_performance.png")
        plt.savefig(plot_path)
        print(f"Scheduler performance plot saved to {plot_path}")


def generate_performance_report(reports_dir, output_dir):
    """Generate performance reports from test results."""
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    # Load performance data
    data = load_performance_data(reports_dir)
    
    # Generate reports
    generate_product_sync_report(data["product_sync"], output_dir)
    generate_multi_platform_report(data["multi_platform_sync"], output_dir)
    generate_scheduler_report(data["scheduler_performance"], output_dir)
    
    # Generate HTML index
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Shopify Sync Performance Report</title>
        <style>
            body {{ font-family: Arial, sans-serif; margin: 20px; }}
            h1, h2 {{ color: #333366; }}
            .report-section {{ margin-bottom: 30px; }}
            table {{ border-collapse: collapse; width: 100%; }}
            th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
            th {{ background-color: #f2f2f2; }}
            tr:nth-child(even) {{ background-color: #f9f9f9; }}
            .plot {{ max-width: 100%; }}
        </style>
    </head>
    <body>
        <h1>Shopify Sync Performance Report</h1>
        <p>Generated: {timestamp}</p>
        
        <div class="report-section">
            <h2>Product Sync Performance</h2>
            <p>Tests: {len(data["product_sync"])}</p>
            <img class="plot" src="product_sync_performance.png" alt="Product Sync Performance Plot">
        </div>
        
        <div class="report-section">
            <h2>Multi-Platform Sync Performance</h2>
            <p>Tests: {len(data["multi_platform_sync"])}</p>
            <img class="plot" src="multi_platform_performance.png" alt="Multi-Platform Sync Performance Plot">
        </div>
        
        <div class="report-section">
            <h2>Scheduler Performance</h2>
            <p>Tests: {len(data["scheduler_performance"])}</p>
            <img class="plot" src="scheduler_performance.png" alt="Scheduler Performance Plot">
        </div>
        
        <div class="report-section">
            <h2>Raw Data</h2>
            <ul>
                <li><a href="product_sync_performance.csv">Product Sync Data (CSV)</a></li>
                <li><a href="multi_platform_performance.csv">Multi-Platform Sync Data (CSV)</a></li>
                <li><a href="scheduler_performance_summary.csv">Scheduler Performance Summary (CSV)</a></li>
                <li><a href="scheduler_performance_detail.csv">Scheduler Performance Detail (CSV)</a></li>
            </ul>
        </div>
    </body>
    </html>
    """
    
    # Write HTML report
    html_path = os.path.join(output_dir, "index.html")
    with open(html_path, 'w') as f:
        f.write(html_content)
    
    print(f"Performance report generated: {html_path}")


def main():
    parser = argparse.ArgumentParser(description="Generate performance report from test results")
    parser.add_argument('--reports-dir', default='reports/performance',
                        help='Directory containing performance test reports (default: reports/performance)')
    parser.add_argument('--output-dir', default='reports/performance/report',
                        help='Directory to save the report (default: reports/performance/report)')
    
    args = parser.parse_args()
    
    generate_performance_report(args.reports_dir, args.output_dir)


if __name__ == "__main__":
    main()