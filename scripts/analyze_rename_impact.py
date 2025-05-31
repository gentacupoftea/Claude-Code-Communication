#!/usr/bin/env python3
"""
Analyze Rename Impact for Conea Project

This script analyzes the impact of PRs on the Phase 2 renaming effort,
focusing on package name references and internal structure changes.

Usage:
    python analyze_rename_impact.py --input pr_inventory.json --output rename_impact.json --report rename_impact_report.md

Requirements:
    - json
    - argparse
    - pandas
    - matplotlib
"""

import os
import sys
import json
import argparse
import pandas as pd
import matplotlib.pyplot as plt
from datetime import datetime
import base64
from io import BytesIO

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Analyze rename impact")
    parser.add_argument("--input", required=True, help="Input JSON file with PR inventory data")
    parser.add_argument("--output", required=True, help="Output JSON file for rename impact analysis")
    parser.add_argument("--report", required=True, help="Output Markdown file for rename impact report")
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

def analyze_file_impacts(files, file_patterns):
    """Analyze files for specific patterns that indicate rename impact."""
    impact_score = 0
    impacted_files = []
    
    for file_path in files:
        for pattern in file_patterns:
            if pattern in file_path:
                impact_score += 1
                impacted_files.append({
                    "file": file_path,
                    "pattern": pattern,
                    "impact": "high" if pattern in ["setup.py", "shopify_mcp_server", "__init__.py"] else "medium"
                })
                break
    
    return impact_score, impacted_files

def calculate_detailed_rename_impact(pr_data):
    """Calculate detailed rename impact for each PR."""
    # Patterns that indicate potential rename impact
    high_impact_patterns = [
        "setup.py",
        "shopify_mcp_server/",
        "shopify-mcp-server",
        "__init__.py",
        "package",
        "import",
        "requirements"
    ]
    
    # Medium impact patterns
    medium_impact_patterns = [
        "config",
        ".env",
        "environment",
        "docker",
        "dockerfile",
        "deploy",
        "test"
    ]
    
    # Additional keywords to check in titles and descriptions
    rename_keywords = [
        "rename",
        "migration",
        "refactor",
        "restructure",
        "move",
        "package",
        "module",
        "import",
        "shopify",
        "conea"
    ]
    
    results = []
    
    for pr in pr_data["pull_requests"]:
        pr_number = pr["number"]
        pr_title = pr["title"].lower()
        pr_body = pr.get("body", "").lower() if pr.get("body") else ""
        
        # Basic info
        result = {
            "pr_number": pr_number,
            "title": pr["title"],
            "author": pr["author"],
            "created_at": pr["created_at"],
            "url": pr.get("url", ""),
            "initial_score": pr["rename_impact"]["score"],
            "initial_details": pr["rename_impact"]["details"]
        }
        
        # Analyze files
        files = pr.get("files", [])
        
        high_impact_score, high_impacted_files = analyze_file_impacts(files, high_impact_patterns)
        medium_impact_score, medium_impacted_files = analyze_file_impacts(files, medium_impact_patterns)
        
        # Keywords in title and body
        keyword_score = 0
        found_keywords = []
        
        for keyword in rename_keywords:
            if keyword in pr_title:
                keyword_score += 2
                found_keywords.append(f"Title contains '{keyword}'")
            if keyword in pr_body:
                keyword_score += 1
                found_keywords.append(f"Description contains '{keyword}'")
        
        # Calculate final score
        # High impact files carry more weight than medium impact files and keywords
        file_impact_score = high_impact_score * 2 + medium_impact_score
        
        # Cap the scores
        file_impact_score = min(file_impact_score, 7)  # Max 7 points from files
        keyword_score = min(keyword_score, 3)  # Max 3 points from keywords
        
        # Final score calculation
        final_score = min(file_impact_score + keyword_score, 10)  # Cap at 10
        
        # Determine impact category
        if final_score >= 7:
            impact_category = "High"
        elif final_score >= 4:
            impact_category = "Medium"
        else:
            impact_category = "Low"
        
        # Add to result
        result.update({
            "file_impact_score": file_impact_score,
            "keyword_score": keyword_score,
            "high_impacted_files": high_impacted_files,
            "medium_impacted_files": medium_impacted_files,
            "found_keywords": found_keywords,
            "final_score": final_score,
            "impact_category": impact_category
        })
        
        results.append(result)
    
    return results

def generate_impact_chart(impact_data):
    """Generate a chart showing rename impact distribution."""
    plt.figure(figsize=(10, 6))
    
    # Count PRs by impact category
    impact_counts = {"High": 0, "Medium": 0, "Low": 0}
    for pr in impact_data:
        impact_counts[pr["impact_category"]] += 1
    
    # Create bar chart
    categories = list(impact_counts.keys())
    counts = list(impact_counts.values())
    
    colors = {
        "High": "#e74c3c",    # Red
        "Medium": "#f39c12",  # Orange
        "Low": "#2ecc71"      # Green
    }
    
    bar_colors = [colors[category] for category in categories]
    
    plt.bar(categories, counts, color=bar_colors)
    
    plt.title('Rename Impact Distribution')
    plt.xlabel('Impact Category')
    plt.ylabel('Number of PRs')
    
    # Add count labels on top of bars
    for i, count in enumerate(counts):
        plt.text(i, count + 0.1, str(count), ha='center')
    
    plt.tight_layout()
    
    # Convert the plot to base64 for embedding in markdown
    buf = BytesIO()
    plt.savefig(buf, format='png', dpi=100)
    buf.seek(0)
    img_str = base64.b64encode(buf.read()).decode('utf-8')
    plt.close()
    
    return f"![Rename Impact Distribution](data:image/png;base64,{img_str})"

def generate_file_impact_chart(impact_data):
    """Generate a chart showing most impacted file types."""
    # Extract all impacted files
    all_high_files = []
    for pr in impact_data:
        for file_info in pr["high_impacted_files"]:
            all_high_files.append(file_info["pattern"])
    
    # Count occurrences
    file_counts = {}
    for pattern in all_high_files:
        if pattern in file_counts:
            file_counts[pattern] += 1
        else:
            file_counts[pattern] = 1
    
    # Sort by count
    sorted_counts = sorted(file_counts.items(), key=lambda x: x[1], reverse=True)
    
    # Take top 8 patterns
    top_patterns = sorted_counts[:8]
    
    plt.figure(figsize=(12, 6))
    
    patterns = [p[0] for p in top_patterns]
    counts = [p[1] for p in top_patterns]
    
    plt.bar(patterns, counts, color='#3498db')
    
    plt.title('Most Affected File Types')
    plt.xlabel('File Pattern')
    plt.ylabel('Occurrence Count')
    plt.xticks(rotation=45, ha='right')
    
    # Add count labels on top of bars
    for i, count in enumerate(counts):
        plt.text(i, count + 0.1, str(count), ha='center')
    
    plt.tight_layout()
    
    # Convert the plot to base64 for embedding in markdown
    buf = BytesIO()
    plt.savefig(buf, format='png', dpi=100)
    buf.seek(0)
    img_str = base64.b64encode(buf.read()).decode('utf-8')
    plt.close()
    
    return f"![Most Affected File Types](data:image/png;base64,{img_str})"

def generate_markdown_report(impact_data, charts, output_file):
    """Generate a comprehensive Markdown report about rename impact."""
    # Sort PRs by impact score, highest first
    sorted_prs = sorted(impact_data, key=lambda x: x["final_score"], reverse=True)
    
    # Count PRs by category
    high_impact = [pr for pr in sorted_prs if pr["impact_category"] == "High"]
    medium_impact = [pr for pr in sorted_prs if pr["impact_category"] == "Medium"]
    low_impact = [pr for pr in sorted_prs if pr["impact_category"] == "Low"]
    
    # Generate the report
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    report = f"""# Conea Phase 2 Rename Impact Analysis
Generated: {now}

## Overview

This report analyzes the impact of open PRs on the Phase 2 renaming effort (package name and internal module structure changes).

**Summary:**
- **High Impact PRs**: {len(high_impact)} PRs require significant attention for rename compatibility
- **Medium Impact PRs**: {len(medium_impact)} PRs have moderate rename considerations
- **Low Impact PRs**: {len(low_impact)} PRs have minimal or no rename considerations

## Impact Distribution

{charts["impact_chart"]}

## Most Affected File Types

{charts["file_impact_chart"]}

## High Impact PRs

The following PRs have high impact on the Phase 2 renaming effort and require careful attention:

| PR # | Title | Author | Score | Key Impacts |
|------|-------|--------|-------|------------|
"""
    
    for pr in high_impact:
        # Format key impacts
        key_impacts = []
        if pr["high_impacted_files"]:
            key_impacts.append(f"{len(pr['high_impacted_files'])} critical files")
        if pr["medium_impacted_files"]:
            key_impacts.append(f"{len(pr['medium_impacted_files'])} config files")
        if pr["found_keywords"]:
            # Just mention the count of keywords found
            key_impacts.append(f"{len(pr['found_keywords'])} rename-related terms")
        
        key_impacts_str = ", ".join(key_impacts)
        
        report += f"| #{pr['pr_number']} | {pr['title']} | {pr['author']} | {pr['final_score']}/10 | {key_impacts_str} |\n"
    
    report += """
## Medium Impact PRs

These PRs have moderate impact on the renaming effort:

| PR # | Title | Author | Score |
|------|-------|--------|-------|
"""
    
    for pr in medium_impact:
        report += f"| #{pr['pr_number']} | {pr['title']} | {pr['author']} | {pr['final_score']}/10 |\n"
    
    report += """
## Detailed Impact Analysis

### Critical File Modifications

The following files are most frequently modified in high-impact PRs:

| File Pattern | Occurrence | PRs Affected |
|--------------|------------|--------------|
"""
    
    # Count file pattern occurrences across all PRs
    pattern_occurrences = {}
    pattern_prs = {}
    
    for pr in impact_data:
        for file_info in pr["high_impacted_files"]:
            pattern = file_info["pattern"]
            if pattern in pattern_occurrences:
                pattern_occurrences[pattern] += 1
                pattern_prs[pattern].add(pr["pr_number"])
            else:
                pattern_occurrences[pattern] = 1
                pattern_prs[pattern] = {pr["pr_number"]}
    
    # Sort by occurrence count
    sorted_patterns = sorted(pattern_occurrences.items(), key=lambda x: x[1], reverse=True)
    
    for pattern, count in sorted_patterns:
        pr_list = ", ".join([f"#{pr_num}" for pr_num in pattern_prs[pattern]])
        report += f"| {pattern} | {count} | {pr_list} |\n"
    
    report += """
## Recommendations

Based on this analysis, the following recommendations are provided for managing the Phase 2 renaming effort:

1. **Prioritize High Impact PRs**: These PRs should be reviewed first and carefully integrated with the Phase 2 changes.

2. **Consider Merging Order**: Low impact PRs should be merged before high impact PRs to minimize conflicts.

3. **Special Review Process**: High impact PRs should undergo an additional review focused specifically on rename compatibility.

4. **Bundle Related Changes**: Consider bundling related high-impact PRs together to ensure consistent implementation.

5. **Documentation Updates**: Ensure all PRs update relevant documentation reflecting the new package name.

## Next Steps

1. Review critical file patterns and ensure consistent handling across all PRs
2. Develop specific guidelines for handling package imports and references
3. Create a test suite to verify rename compatibility
4. Schedule dedicated review sessions for high-impact PRs
"""
    
    # Write to file
    with open(output_file, 'w') as f:
        f.write(report)
    
    print(f"Rename impact report saved to {output_file}")

def main():
    args = parse_args()
    
    # Load PR data
    pr_data = load_pr_data(args.input)
    
    # Calculate detailed rename impact
    impact_data = calculate_detailed_rename_impact(pr_data)
    
    # Generate charts
    charts = {
        "impact_chart": generate_impact_chart(impact_data),
        "file_impact_chart": generate_file_impact_chart(impact_data)
    }
    
    # Save detailed impact data
    with open(args.output, 'w') as f:
        json.dump(impact_data, f, indent=2)
    
    print(f"Detailed rename impact data saved to {args.output}")
    
    # Generate markdown report
    generate_markdown_report(impact_data, charts, args.report)

if __name__ == "__main__":
    main()