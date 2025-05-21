#!/usr/bin/env python3
"""
Monitor test coverage and generate reports.

This script tracks test coverage over time and generates historical reports.
"""

import os
import json
import glob
import argparse
import subprocess
from datetime import datetime
import xml.etree.ElementTree as ET
import matplotlib.pyplot as plt
import pandas as pd


def run_tests_with_coverage(package_path, report_dir):
    """Run tests with coverage for the specified package."""
    os.makedirs(report_dir, exist_ok=True)
    
    # Run pytest with coverage
    cmd = [
        "pytest",
        f"tests/{os.path.basename(package_path)}",
        f"--cov={package_path}",
        "--cov-report=xml:coverage.xml",
        "-v"
    ]
    
    print(f"Running: {' '.join(cmd)}")
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    # Save test output
    output_path = os.path.join(report_dir, "test_output.txt")
    with open(output_path, 'w') as f:
        f.write(result.stdout)
        f.write("\n\n")
        f.write(result.stderr)
    
    if result.returncode != 0:
        print(f"Tests failed with return code {result.returncode}")
        print(f"Test output saved to {output_path}")
        return None
    
    # Parse coverage XML
    if os.path.exists("coverage.xml"):
        try:
            coverage_data = parse_coverage_xml("coverage.xml")
            
            # Save coverage data with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            coverage_path = os.path.join(report_dir, f"coverage_{timestamp}.json")
            
            with open(coverage_path, 'w') as f:
                json.dump(coverage_data, f, indent=2)
            
            print(f"Coverage data saved to {coverage_path}")
            
            # Also copy the XML file
            xml_path = os.path.join(report_dir, f"coverage_{timestamp}.xml")
            subprocess.run(["cp", "coverage.xml", xml_path])
            
            return coverage_data
        except Exception as e:
            print(f"Error parsing coverage data: {e}")
            return None
    else:
        print("No coverage.xml file found")
        return None


def parse_coverage_xml(xml_path):
    """Parse a coverage XML file and extract important metrics."""
    tree = ET.parse(xml_path)
    root = tree.getroot()
    
    # Get overall coverage
    coverage = root.get("line-rate", "0")
    timestamp = datetime.now().isoformat()
    
    # Extract package details
    packages = {}
    for package in root.findall(".//package"):
        package_name = package.get("name", "unknown")
        package_coverage = float(package.get("line-rate", "0")) * 100
        
        classes = {}
        for class_node in package.findall(".//class"):
            class_name = class_node.get("name", "unknown")
            class_coverage = float(class_node.get("line-rate", "0")) * 100
            
            classes[class_name] = {
                "coverage": class_coverage
            }
        
        packages[package_name] = {
            "coverage": package_coverage,
            "classes": classes
        }
    
    return {
        "timestamp": timestamp,
        "coverage": float(coverage) * 100,
        "packages": packages
    }


def generate_coverage_history(report_dir):
    """Generate coverage history report from saved data."""
    # Find all JSON coverage files
    json_files = glob.glob(os.path.join(report_dir, "coverage_*.json"))
    json_files.sort()
    
    if not json_files:
        print("No coverage data found")
        return
    
    # Extract data for plotting
    timestamps = []
    coverages = []
    package_coverages = {}
    
    for file_path in json_files:
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
            
            # Extract file timestamp from filename
            file_timestamp = os.path.basename(file_path).replace("coverage_", "").replace(".json", "")
            timestamp = datetime.strptime(file_timestamp, "%Y%m%d_%H%M%S")
            
            timestamps.append(timestamp)
            coverages.append(data.get("coverage", 0))
            
            # Extract package coverages
            for package_name, package_data in data.get("packages", {}).items():
                if package_name not in package_coverages:
                    package_coverages[package_name] = []
                
                # Align with timestamps array
                while len(package_coverages[package_name]) < len(timestamps) - 1:
                    package_coverages[package_name].append(None)
                
                package_coverages[package_name].append(package_data.get("coverage", 0))
        except Exception as e:
            print(f"Error processing {file_path}: {e}")
    
    # Create dataframe
    df = pd.DataFrame({
        "Timestamp": timestamps,
        "Overall Coverage": coverages
    })
    
    # Add package coverages
    for package_name, values in package_coverages.items():
        # Ensure all rows have values
        while len(values) < len(timestamps):
            values.append(None)
        
        df[f"{package_name} Coverage"] = values
    
    # Save to CSV
    csv_path = os.path.join(report_dir, "coverage_history.csv")
    df.to_csv(csv_path, index=False)
    print(f"Coverage history saved to {csv_path}")
    
    # Create plot
    plt.figure(figsize=(12, 6))
    
    # Plot overall coverage
    plt.plot(timestamps, coverages, 'o-', linewidth=2, label="Overall")
    
    # Plot package coverages
    for package_name, values in package_coverages.items():
        plt.plot(timestamps, values, 'o--', linewidth=1, label=package_name)
    
    plt.title('Test Coverage History')
    plt.xlabel('Date')
    plt.ylabel('Coverage (%)')
    plt.grid(True)
    plt.legend()
    
    # Save plot
    plot_path = os.path.join(report_dir, "coverage_history.png")
    plt.savefig(plot_path)
    print(f"Coverage history plot saved to {plot_path}")
    
    # Generate HTML report
    generate_html_report(report_dir, df, package_coverages)


def generate_html_report(report_dir, coverage_df, package_coverages):
    """Generate HTML coverage report."""
    # Get latest coverage data
    latest_coverage = coverage_df["Overall Coverage"].iloc[-1]
    
    # Get coverage trends
    coverage_change = coverage_df["Overall Coverage"].iloc[-1] - coverage_df["Overall Coverage"].iloc[0] if len(coverage_df) > 1 else 0
    
    # Package coverage
    package_rows = ""
    for package_name, values in package_coverages.items():
        latest = values[-1]
        change = values[-1] - values[0] if len(values) > 1 else 0
        trend_class = "positive" if change >= 0 else "negative"
        
        package_rows += f"""
        <tr>
            <td>{package_name}</td>
            <td>{latest:.2f}%</td>
            <td class="{trend_class}">{change:+.2f}%</td>
        </tr>
        """
    
    # Generate HTML
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Shopify Sync Coverage Report</title>
        <style>
            body {{ font-family: Arial, sans-serif; margin: 20px; }}
            h1, h2 {{ color: #333366; }}
            .overview {{ display: flex; justify-content: space-between; margin-bottom: 20px; }}
            .metric {{ background-color: #f5f5f5; padding: 15px; border-radius: 5px; width: 30%; text-align: center; }}
            .metric h3 {{ margin-top: 0; }}
            .metric .value {{ font-size: 24px; font-weight: bold; margin: 10px 0; }}
            .report-section {{ margin-bottom: 30px; }}
            table {{ border-collapse: collapse; width: 100%; }}
            th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
            th {{ background-color: #f2f2f2; }}
            tr:nth-child(even) {{ background-color: #f9f9f9; }}
            .positive {{ color: green; }}
            .negative {{ color: red; }}
            .plot {{ max-width: 100%; }}
        </style>
    </head>
    <body>
        <h1>Shopify Sync Coverage Report</h1>
        <p>Generated: {timestamp}</p>
        
        <div class="overview">
            <div class="metric">
                <h3>Overall Coverage</h3>
                <div class="value">{latest_coverage:.2f}%</div>
            </div>
            <div class="metric">
                <h3>Coverage Change</h3>
                <div class="value {('positive' if coverage_change >= 0 else 'negative')}">{coverage_change:+.2f}%</div>
            </div>
            <div class="metric">
                <h3>Reports</h3>
                <div class="value">{len(coverage_df)}</div>
            </div>
        </div>
        
        <div class="report-section">
            <h2>Coverage History</h2>
            <img class="plot" src="coverage_history.png" alt="Coverage History Plot">
        </div>
        
        <div class="report-section">
            <h2>Package Coverage</h2>
            <table>
                <tr>
                    <th>Package</th>
                    <th>Coverage</th>
                    <th>Change</th>
                </tr>
                {package_rows}
            </table>
        </div>
        
        <div class="report-section">
            <h2>Raw Data</h2>
            <ul>
                <li><a href="coverage_history.csv">Coverage History (CSV)</a></li>
                <li><a href="test_output.txt">Latest Test Output</a></li>
            </ul>
        </div>
    </body>
    </html>
    """
    
    # Write HTML report
    html_path = os.path.join(report_dir, "index.html")
    with open(html_path, 'w') as f:
        f.write(html_content)
    
    print(f"HTML report generated: {html_path}")


def main():
    parser = argparse.ArgumentParser(description="Monitor test coverage and generate reports")
    parser.add_argument('--package', default='src.sync',
                        help='Package to monitor (default: src.sync)')
    parser.add_argument('--report-dir', default='reports/coverage',
                        help='Directory to save reports (default: reports/coverage)')
    parser.add_argument('--run-tests', action='store_true',
                        help='Run tests with coverage')
    
    args = parser.parse_args()
    
    # Ensure report directory exists
    os.makedirs(args.report_dir, exist_ok=True)
    
    if args.run_tests:
        run_tests_with_coverage(args.package, args.report_dir)
    
    generate_coverage_history(args.report_dir)


if __name__ == "__main__":
    main()