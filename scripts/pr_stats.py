#!/usr/bin/env python3
"""
Generate PR Statistics for Conea Project

This script analyzes PR inventory data and generates statistics and visualizations
for better understanding of the current PR landscape.

Usage:
    python pr_stats.py --input pr_inventory.json --output pr_statistics.md

Requirements:
    - pandas
    - matplotlib
    - tabulate
    - json
    - argparse
"""

import os
import sys
import json
import argparse
import pandas as pd
import matplotlib.pyplot as plt
from datetime import datetime, timedelta
from tabulate import tabulate
import base64
from io import BytesIO

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Generate PR statistics")
    parser.add_argument("--input", required=True, help="Input JSON file with PR inventory data")
    parser.add_argument("--output", required=True, help="Output Markdown file for statistics report")
    return parser.parse_args()

def load_pr_data(input_file):
    """Load PR data from JSON file."""
    try:
        with open(input_file, 'r') as f:
            data = json.load(f)
        return data
    except Exception as e:
        print(f"Error loading PR data: {e}")
        sys.exit(1)

def create_pr_dataframe(pr_data):
    """Create a pandas DataFrame from PR data for analysis."""
    prs = []
    for pr in pr_data["pull_requests"]:
        # Extract basic information
        pr_info = {
            "number": pr["number"],
            "title": pr["title"],
            "author": pr["author"],
            "created_at": datetime.fromisoformat(pr["created_at"].replace("Z", "+00:00")),
            "updated_at": datetime.fromisoformat(pr["updated_at"].replace("Z", "+00:00")),
            "days_open": pr["created_days_ago"],
            "days_since_update": pr["updated_days_ago"],
            "draft": pr["draft"],
            "additions": pr["size"]["additions"],
            "deletions": pr["size"]["deletions"],
            "changed_files": pr["size"]["changed_files"],
            "complexity": pr["complexity"],
            "has_conflicts": bool(pr["conflicts"]),
            "review_status": pr["reviews"]["status"],
            "approved_count": pr["reviews"]["approved"],
            "changes_requested": pr["reviews"]["changes_requested"],
            "ci_status": pr["ci_status"]["status"],
            "rename_impact": pr["rename_impact"]["score"],
            "dependency_count": len(pr["dependencies"]),
            "linked_issues_count": len(pr["linked_issues"])
        }
        prs.append(pr_info)
    
    return pd.DataFrame(prs)

def generate_statistics(df):
    """Generate key statistics from PR DataFrame."""
    stats = {}
    
    # Basic counts
    stats["total_prs"] = len(df)
    stats["draft_prs"] = df["draft"].sum()
    stats["non_draft_prs"] = stats["total_prs"] - stats["draft_prs"]
    
    # Age statistics
    stats["avg_days_open"] = df["days_open"].mean()
    stats["oldest_pr"] = df["days_open"].max()
    stats["newest_pr"] = df["days_open"].min()
    stats["avg_days_since_update"] = df["days_since_update"].mean()
    
    # Size and complexity
    stats["avg_additions"] = df["additions"].mean()
    stats["avg_deletions"] = df["deletions"].mean()
    stats["avg_files_changed"] = df["changed_files"].mean()
    stats["avg_complexity"] = df["complexity"].mean()
    
    # Review status
    review_status_counts = df["review_status"].value_counts().to_dict()
    stats["review_status"] = review_status_counts
    
    # CI status
    ci_status_counts = df["ci_status"].value_counts().to_dict()
    stats["ci_status"] = ci_status_counts
    
    # Rename impact statistics
    stats["high_rename_impact"] = len(df[df["rename_impact"] >= 7])
    stats["medium_rename_impact"] = len(df[(df["rename_impact"] >= 4) & (df["rename_impact"] < 7)])
    stats["low_rename_impact"] = len(df[df["rename_impact"] < 4])
    stats["avg_rename_impact"] = df["rename_impact"].mean()
    
    # Dependencies
    stats["prs_with_dependencies"] = len(df[df["dependency_count"] > 0])
    stats["avg_dependencies"] = df["dependency_count"].mean()
    
    # Conflict statistics
    stats["prs_with_conflicts"] = df["has_conflicts"].sum()
    
    return stats

def generate_pr_age_chart(df):
    """Generate chart of PR age distribution."""
    plt.figure(figsize=(10, 6))
    
    # Create age bins
    bins = [0, 7, 14, 30, 60, 90, float('inf')]
    labels = ['<1 week', '1-2 weeks', '2-4 weeks', '1-2 months', '2-3 months', '>3 months']
    
    df['age_category'] = pd.cut(df['days_open'], bins=bins, labels=labels)
    age_counts = df['age_category'].value_counts().sort_index()
    
    colors = ['#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f']
    age_counts.plot.bar(color=colors)
    
    plt.title('PR Age Distribution')
    plt.xlabel('Age Category')
    plt.ylabel('Number of PRs')
    plt.tight_layout()
    
    # Convert the plot to base64 for embedding in markdown
    buf = BytesIO()
    plt.savefig(buf, format='png', dpi=100)
    buf.seek(0)
    img_str = base64.b64encode(buf.read()).decode('utf-8')
    plt.close()
    
    return f"![PR Age Distribution](data:image/png;base64,{img_str})"

def generate_rename_impact_chart(df):
    """Generate chart of rename impact distribution."""
    plt.figure(figsize=(10, 6))
    
    # Create rename impact bins
    bins = [0, 4, 7, 10]
    labels = ['Low (0-3)', 'Medium (4-6)', 'High (7-10)']
    
    df['impact_category'] = pd.cut(df['rename_impact'], bins=bins, labels=labels)
    impact_counts = df['impact_category'].value_counts().sort_index()
    
    colors = ['#66c2a5', '#fc8d62', '#e78ac3']
    impact_counts.plot.bar(color=colors)
    
    plt.title('Rename Impact Distribution')
    plt.xlabel('Impact Level')
    plt.ylabel('Number of PRs')
    plt.tight_layout()
    
    # Convert the plot to base64 for embedding in markdown
    buf = BytesIO()
    plt.savefig(buf, format='png', dpi=100)
    buf.seek(0)
    img_str = base64.b64encode(buf.read()).decode('utf-8')
    plt.close()
    
    return f"![Rename Impact Distribution](data:image/png;base64,{img_str})"

def generate_pr_complexity_chart(df):
    """Generate chart of PR complexity distribution."""
    plt.figure(figsize=(10, 6))
    
    # Create complexity bins
    bins = [0, 3, 6, 8, 10]
    labels = ['Very Low (0-2)', 'Low (3-5)', 'Medium (6-7)', 'High (8-10)']
    
    df['complexity_category'] = pd.cut(df['complexity'], bins=bins, labels=labels)
    complexity_counts = df['complexity_category'].value_counts().sort_index()
    
    colors = ['#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3']
    complexity_counts.plot.bar(color=colors)
    
    plt.title('PR Complexity Distribution')
    plt.xlabel('Complexity Level')
    plt.ylabel('Number of PRs')
    plt.tight_layout()
    
    # Convert the plot to base64 for embedding in markdown
    buf = BytesIO()
    plt.savefig(buf, format='png', dpi=100)
    buf.seek(0)
    img_str = base64.b64encode(buf.read()).decode('utf-8')
    plt.close()
    
    return f"![PR Complexity Distribution](data:image/png;base64,{img_str})"

def identify_problematic_prs(df):
    """Identify PRs that require special attention."""
    
    # Old PRs with no recent updates
    old_inactive_prs = df[(df["days_open"] > 30) & (df["days_since_update"] > 14)]
    
    # PRs with high complexity and conflicts
    complex_conflicting_prs = df[(df["complexity"] >= 8) & (df["has_conflicts"] == True)]
    
    # PRs with changes requested but no updates
    stalled_review_prs = df[(df["review_status"] == "Changes Requested") & 
                           (df["days_since_update"] > 7)]
    
    # PRs with high rename impact
    high_impact_prs = df[df["rename_impact"] >= 7]
    
    return {
        "old_inactive": old_inactive_prs,
        "complex_conflicting": complex_conflicting_prs,
        "stalled_review": stalled_review_prs,
        "high_rename_impact": high_impact_prs
    }

def generate_problematic_prs_table(problematic_prs):
    """Generate markdown tables for problematic PRs."""
    tables = {}
    
    for category, prs_df in problematic_prs.items():
        if len(prs_df) > 0:
            # Select relevant columns for the table
            table_data = prs_df[["number", "title", "author", "days_open", 
                                "days_since_update", "complexity", "rename_impact"]]
            
            # Convert to list of lists for tabulate
            table_rows = [list(row) for _, row in table_data.iterrows()]
            
            # Generate markdown table
            table = tabulate(
                table_rows,
                headers=["PR #", "Title", "Author", "Days Open", "Days Since Update", 
                         "Complexity", "Rename Impact"],
                tablefmt="pipe"
            )
            
            tables[category] = table
    
    return tables

def generate_markdown_report(stats, charts, problematic_tables, df, output_file):
    """Generate a comprehensive markdown report with statistics and visualizations."""
    
    # Start with a header
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    report = f"""# Conea PR Statistics Report
Generated: {now}

## Executive Summary

- **Total PRs**: {stats["total_prs"]} ({stats["draft_prs"]} draft, {stats["non_draft_prs"]} ready)
- **Average Age**: {stats["avg_days_open"]:.1f} days
- **PRs with High Rename Impact**: {stats["high_rename_impact"]} ({stats["high_rename_impact"]/stats["total_prs"]*100:.1f}%)
- **PRs with Conflicts**: {stats["prs_with_conflicts"]} ({stats["prs_with_conflicts"]/stats["total_prs"]*100:.1f}%)
- **PRs with Dependencies**: {stats["prs_with_dependencies"]} ({stats["prs_with_dependencies"]/stats["total_prs"]*100:.1f}%)

## PR Overview

{charts["age_chart"]}

### Review Status

| Status | Count | Percentage |
|--------|-------|------------|
"""
    
    # Add review status table
    for status, count in stats["review_status"].items():
        percentage = count / stats["total_prs"] * 100
        report += f"| {status} | {count} | {percentage:.1f}% |\n"
    
    # Add CI status section
    report += """
### CI Status

| Status | Count | Percentage |
|--------|-------|------------|
"""
    
    for status, count in stats["ci_status"].items():
        percentage = count / stats["total_prs"] * 100
        report += f"| {status} | {count} | {percentage:.1f}% |\n"
    
    # Add complexity and rename impact sections
    report += f"""
## Complexity and Rename Impact

### Complexity Distribution

{charts["complexity_chart"]}

### Rename Impact

{charts["rename_impact_chart"]}

## PRs Requiring Special Attention

### Old and Inactive PRs (>30 days old, >14 days since update)

"""
    
    if "old_inactive" in problematic_tables:
        report += problematic_tables["old_inactive"] + "\n\n"
    else:
        report += "No PRs in this category.\n\n"
    
    report += "### Complex and Conflicting PRs\n\n"
    
    if "complex_conflicting" in problematic_tables:
        report += problematic_tables["complex_conflicting"] + "\n\n"
    else:
        report += "No PRs in this category.\n\n"
    
    report += "### Stalled Review PRs (Changes requested, >7 days since update)\n\n"
    
    if "stalled_review" in problematic_tables:
        report += problematic_tables["stalled_review"] + "\n\n"
    else:
        report += "No PRs in this category.\n\n"
    
    report += "### High Rename Impact PRs\n\n"
    
    if "high_rename_impact" in problematic_tables:
        report += problematic_tables["high_rename_impact"] + "\n\n"
    else:
        report += "No PRs in this category.\n\n"
    
    # Add author statistics
    author_counts = df["author"].value_counts()
    
    report += """
## PR Authors

| Author | PR Count | Percentage |
|--------|----------|------------|
"""
    
    for author, count in author_counts.items():
        percentage = count / stats["total_prs"] * 100
        report += f"| {author} | {count} | {percentage:.1f}% |\n"
    
    # Add detailed statistics section
    report += """
## Detailed Statistics

### Size and Complexity

| Metric | Value |
|--------|-------|
"""
    
    size_metrics = {
        "Average Additions": f"{stats['avg_additions']:.1f} lines",
        "Average Deletions": f"{stats['avg_deletions']:.1f} lines",
        "Average Files Changed": f"{stats['avg_files_changed']:.1f} files",
        "Average Complexity Score": f"{stats['avg_complexity']:.1f}/10"
    }
    
    for metric, value in size_metrics.items():
        report += f"| {metric} | {value} |\n"
    
    report += """
### Age and Activity

| Metric | Value |
|--------|-------|
"""
    
    age_metrics = {
        "Oldest PR": f"{stats['oldest_pr']} days",
        "Newest PR": f"{stats['newest_pr']} days",
        "Average Age": f"{stats['avg_days_open']:.1f} days",
        "Average Days Since Update": f"{stats['avg_days_since_update']:.1f} days"
    }
    
    for metric, value in age_metrics.items():
        report += f"| {metric} | {value} |\n"
    
    # Add recommendations section
    report += """
## Recommendations

Based on the analysis above, consider the following recommendations:

1. **Prioritize review of high rename impact PRs** - These have the most significant impact on the Phase 2 renaming effort.
2. **Address stalled PRs with changes requested** - These PRs need attention to move forward.
3. **Consider closing old inactive PRs** - PRs that have been open for too long without updates might need to be closed.
4. **Handle complex PRs carefully** - Complex PRs might need to be broken down into smaller pieces.
5. **Resolve conflicts before triage** - PRs with conflicts should be resolved to facilitate accurate assessment.
"""
    
    # Write to file
    with open(output_file, 'w') as f:
        f.write(report)
    
    print(f"PR statistics report saved to {output_file}")

def main():
    args = parse_args()
    
    # Load PR data
    pr_data = load_pr_data(args.input)
    
    # Create DataFrame for analysis
    df = create_pr_dataframe(pr_data)
    
    # Generate statistics
    stats = generate_statistics(df)
    
    # Generate charts
    charts = {
        "age_chart": generate_pr_age_chart(df),
        "rename_impact_chart": generate_rename_impact_chart(df),
        "complexity_chart": generate_pr_complexity_chart(df)
    }
    
    # Identify problematic PRs
    problematic_prs = identify_problematic_prs(df)
    
    # Generate tables for problematic PRs
    problematic_tables = generate_problematic_prs_table(problematic_prs)
    
    # Generate markdown report
    generate_markdown_report(stats, charts, problematic_tables, df, args.output)

if __name__ == "__main__":
    main()