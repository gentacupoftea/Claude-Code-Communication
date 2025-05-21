#!/usr/bin/env python3
"""
Analyze PR Dependencies for Conea Project

This script analyzes PR dependency data and generates a dependency matrix
for visualization and analysis.

Usage:
    python analyze_pr_dependencies.py --input pr_inventory.json --output dependency_matrix.csv

Requirements:
    - pandas
    - numpy
    - json
    - argparse
"""

import os
import sys
import json
import argparse
import pandas as pd
import numpy as np

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Analyze PR dependencies")
    parser.add_argument("--input", required=True, help="Input JSON file with PR inventory data")
    parser.add_argument("--output", required=True, help="Output CSV file for dependency matrix")
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

def create_dependency_matrix(pr_data):
    """Create a dependency matrix from PR data."""
    # Get all PR numbers
    pr_numbers = [pr["number"] for pr in pr_data["pull_requests"]]
    
    # Create an empty matrix
    matrix = pd.DataFrame(0, index=pr_numbers, columns=pr_numbers)
    
    # Fill the matrix based on dependencies
    for pr in pr_data["pull_requests"]:
        pr_num = pr["number"]
        for dep in pr["dependencies"]:
            try:
                dep_num = int(dep)
                if dep_num in pr_numbers:
                    # Mark that pr_num depends on dep_num
                    matrix.loc[pr_num, dep_num] = 1
            except ValueError:
                continue
    
    return matrix

def analyze_dependencies(matrix):
    """Analyze the dependency matrix and extract insights."""
    # Calculate dependency metrics
    dependency_counts = {
        "depends_on": matrix.sum(axis=1).to_dict(),  # How many PRs this PR depends on
        "depended_by": matrix.sum(axis=0).to_dict()  # How many PRs depend on this PR
    }
    
    # Calculate complexity scores
    complexity_scores = {}
    for pr_num in matrix.index:
        # A PR is more complex if:
        # 1. It has many dependencies (depends on many PRs)
        # 2. Many PRs depend on it
        complexity = (
            dependency_counts["depends_on"].get(pr_num, 0) * 1.5 +  # Depending on others is a risk
            dependency_counts["depended_by"].get(pr_num, 0) * 2.0   # Being depended on is a bigger risk
        )
        complexity_scores[pr_num] = min(10, complexity)  # Cap at 10
    
    return {
        "dependency_counts": dependency_counts,
        "complexity_scores": complexity_scores
    }

def identify_critical_path(matrix):
    """Identify the critical path in the dependency graph."""
    # This is a simplified approach - in a real project, we'd use 
    # a more sophisticated algorithm like critical path method (CPM)
    
    # For now, we'll define critical path as PRs with the most total dependencies
    total_dependencies = {}
    for pr_num in matrix.index:
        total = matrix.loc[pr_num].sum() + matrix[pr_num].sum()
        total_dependencies[pr_num] = total
    
    # Sort by total dependencies
    sorted_prs = sorted(total_dependencies.items(), key=lambda x: x[1], reverse=True)
    
    # Get top 30% or at least 3 PRs
    critical_count = max(3, int(len(matrix) * 0.3))
    critical_path = [pr_num for pr_num, _ in sorted_prs[:critical_count]]
    
    return critical_path

def generate_dependency_report(matrix, analysis, critical_path, pr_data, output_file):
    """Generate a comprehensive dependency report in CSV format."""
    # Create a DataFrame for the report
    report_data = []
    
    # Pull request information
    pr_info = {pr["number"]: pr for pr in pr_data["pull_requests"]}
    
    for pr_num in matrix.index:
        info = pr_info.get(pr_num, {})
        
        # Get dependencies and dependents
        depends_on = [col for col in matrix.columns if matrix.loc[pr_num, col] == 1]
        depended_by = [idx for idx in matrix.index if matrix.loc[idx, pr_num] == 1]
        
        # Format them as comma-separated strings
        depends_on_str = ", ".join([f"#{x}" for x in depends_on]) if depends_on else "None"
        depended_by_str = ", ".join([f"#{x}" for x in depended_by]) if depended_by else "None"
        
        # Calculate dependency priority
        # Higher if it blocks many PRs, lower if it depends on many
        dependency_priority = (
            analysis["dependency_counts"]["depended_by"].get(pr_num, 0) * 3 -
            analysis["dependency_counts"]["depends_on"].get(pr_num, 0) * 1
        )
        # Normalize to 0-10 scale
        max_priority = 10
        min_priority = -10
        normalized_priority = (dependency_priority - min_priority) / (max_priority - min_priority) * 10
        normalized_priority = max(0, min(10, normalized_priority))
        
        report_data.append({
            "PR Number": pr_num,
            "Title": info.get("title", "Unknown"),
            "Author": info.get("author", "Unknown"),
            "Depends On Count": analysis["dependency_counts"]["depends_on"].get(pr_num, 0),
            "Depends On": depends_on_str,
            "Depended By Count": analysis["dependency_counts"]["depended_by"].get(pr_num, 0),
            "Depended By": depended_by_str,
            "Dependency Complexity": analysis["complexity_scores"].get(pr_num, 0),
            "Rename Impact": info.get("rename_impact", {}).get("score", 0),
            "Critical Path": "Yes" if pr_num in critical_path else "No",
            "Dependency Priority": round(normalized_priority, 1),
            "Review Status": info.get("reviews", {}).get("status", "Unknown"),
            "CI Status": info.get("ci_status", {}).get("status", "Unknown"),
            "Created Days Ago": info.get("created_days_ago", 0),
            "Updated Days Ago": info.get("updated_days_ago", 0)
        })
    
    # Create DataFrame and save to CSV
    report_df = pd.DataFrame(report_data)
    report_df = report_df.sort_values(by=["Critical Path", "Dependency Priority"], ascending=[False, False])
    report_df.to_csv(output_file, index=False)
    
    print(f"Dependency report saved to {output_file}")
    
    # Also generate a Markdown summary
    generate_markdown_summary(report_df, critical_path, pr_info, output_file.replace(".csv", ".md"))

def generate_markdown_summary(report_df, critical_path, pr_info, output_file):
    """Generate a Markdown summary of the dependency analysis."""
    markdown = """# PR Dependency Analysis Summary

## Critical Path PRs

These PRs are on the critical path and should be prioritized for review and merge:

| PR # | Title | Dependencies | Blocking | Priority |
|------|-------|--------------|----------|----------|
"""
    
    # Add critical path PRs to the table
    for pr_num in critical_path:
        row = report_df[report_df["PR Number"] == pr_num].iloc[0]
        markdown += f"| #{pr_num} | {row['Title']} | {row['Depends On Count']} | {row['Depended By Count']} | {row['Dependency Priority']} |\n"
    
    markdown += """
## High Impact PRs for Rename Phase 2

These PRs have significant impact on the Phase 2 renaming effort:

| PR # | Title | Rename Impact | Review Status |
|------|-------|--------------|---------------|
"""
    
    # Add high rename impact PRs
    high_impact = report_df[report_df["Rename Impact"] >= 7].sort_values(by="Rename Impact", ascending=False)
    for _, row in high_impact.iterrows():
        pr_num = row["PR Number"]
        markdown += f"| #{pr_num} | {row['Title']} | {row['Rename Impact']}/10 | {row['Review Status']} |\n"
    
    markdown += """
## Dependency Bottlenecks

These PRs are blocking multiple other PRs and should be addressed quickly:

| PR # | Title | Blocking | Age (days) | Review Status |
|------|-------|----------|------------|---------------|
"""
    
    # Add bottleneck PRs (those blocking many others)
    bottlenecks = report_df[report_df["Depended By Count"] >= 2].sort_values(by="Depended By Count", ascending=False)
    for _, row in bottlenecks.iterrows():
        pr_num = row["PR Number"]
        markdown += f"| #{pr_num} | {row['Title']} | {row['Depended By Count']} | {row['Created Days Ago']} | {row['Review Status']} |\n"
    
    markdown += """
## Recommended Processing Order

Based on dependencies, rename impact, and priority, the recommended processing order is:

1. Critical path PRs that are not blocked
2. High rename impact PRs
3. PRs blocking multiple others
4. PRs with no dependencies
5. Remaining PRs in dependency order

Specific recommended sequence:

"""
    
    # Create a suggested processing order
    processed = set()
    to_process = set(report_df["PR Number"])
    
    ordered_prs = []
    
    # Keep processing until all PRs are processed
    while to_process:
        # Find PRs that aren't blocked by any unprocessed PRs
        ready = []
        for pr_num in to_process:
            row = report_df[report_df["PR Number"] == pr_num].iloc[0]
            depends_on = row["Depends On"]
            
            # Check if this PR is not blocked by any unprocessed PRs
            blocked = False
            if depends_on != "None":
                deps = [int(x.strip("#")) for x in depends_on.split(", ")]
                if any(dep in to_process for dep in deps):
                    blocked = True
            
            if not blocked:
                ready.append((pr_num, row))
        
        # Sort ready PRs by priority
        ready.sort(key=lambda x: (
            x[0] in critical_path,                   # Critical path first
            x[1]["Rename Impact"],                  # Then by rename impact
            x[1]["Depended By Count"],              # Then by how many PRs it blocks
            x[1]["Dependency Priority"]             # Then by calculated priority
        ), reverse=True)
        
        # If no PRs are ready (cycle detected), break one dependency
        if not ready:
            # Find PR with the highest priority among those with dependencies
            cycle_breaker = max(to_process, key=lambda pr_num: 
                report_df[report_df["PR Number"] == pr_num].iloc[0]["Dependency Priority"])
            
            # Add it to ready list with a note
            row = report_df[report_df["PR Number"] == cycle_breaker].iloc[0]
            ready.append((cycle_breaker, row))
            markdown += f"**Note**: Dependency cycle detected. Prioritizing PR #{cycle_breaker} to break the cycle.\n\n"
        
        # Add the highest priority ready PR to our order
        pr_num, row = ready[0]
        ordered_prs.append((pr_num, row))
        processed.add(pr_num)
        to_process.remove(pr_num)
    
    # Add recommended sequence to markdown
    for i, (pr_num, row) in enumerate(ordered_prs):
        critical = " [CRITICAL]" if pr_num in critical_path else ""
        high_impact = " [HIGH IMPACT]" if row["Rename Impact"] >= 7 else ""
        bottleneck = f" [BLOCKS {row['Depended By Count']}]" if row["Depended By Count"] >= 2 else ""
        
        markdown += f"{i+1}. PR #{pr_num}: {row['Title']}{critical}{high_impact}{bottleneck}\n"
    
    # Write to file
    with open(output_file, 'w') as f:
        f.write(markdown)
    
    print(f"Markdown summary saved to {output_file}")

def main():
    args = parse_args()
    
    # Load PR data
    data = load_pr_data(args.input)
    
    # Create dependency matrix
    matrix = create_dependency_matrix(data)
    
    # Analyze dependencies
    analysis = analyze_dependencies(matrix)
    
    # Identify critical path
    critical_path = identify_critical_path(matrix)
    
    # Generate report
    generate_dependency_report(matrix, analysis, critical_path, data, args.output)
    
    print("Dependency analysis complete.")

if __name__ == "__main__":
    main()