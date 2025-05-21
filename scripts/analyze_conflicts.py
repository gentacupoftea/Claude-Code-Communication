#!/usr/bin/env python3
"""
Analyze Conflicts Between PRs for Conea Project

This script analyzes potential conflicts between PRs based on file overlap
and provides a conflict report.

Usage:
    python analyze_conflicts.py --repo mourigenta/conea --pr-list pr_inventory.json
                               --output conflict_analysis.json --report conflict_report.md

Requirements:
    - PyGithub
    - json
    - argparse
    - pandas
    - matplotlib
"""

import os
import sys
import json
import argparse
import requests
import pandas as pd
import matplotlib.pyplot as plt
from itertools import combinations
from datetime import datetime
import base64
from io import BytesIO

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Analyze conflicts between PRs")
    parser.add_argument("--repo", required=True, help="GitHub repository (owner/repo)")
    parser.add_argument("--pr-list", required=True, help="JSON file with PR inventory data")
    parser.add_argument("--output", required=True, help="Output JSON file for conflict analysis")
    parser.add_argument("--report", required=True, help="Output Markdown file for conflict report")
    parser.add_argument("--token", help="GitHub token (or set GITHUB_TOKEN env var)")
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

def check_file_overlap(pr1_files, pr2_files):
    """Check if there is file overlap between two PRs."""
    # Convert to sets for faster intersection
    pr1_set = set(pr1_files)
    pr2_set = set(pr2_files)
    
    # Find overlapping files
    overlapping = pr1_set.intersection(pr2_set)
    
    return list(overlapping)

def analyze_file_conflicts(pr_data):
    """Analyze file-based conflicts between PRs."""
    conflicts = []
    
    # Get all PRs with their files
    prs_with_files = [
        (pr["number"], pr["title"], pr.get("files", []))
        for pr in pr_data["pull_requests"]
    ]
    
    # Check each pair of PRs for conflicts
    for (pr1_num, pr1_title, pr1_files), (pr2_num, pr2_title, pr2_files) in combinations(prs_with_files, 2):
        overlapping_files = check_file_overlap(pr1_files, pr2_files)
        
        if overlapping_files:
            conflicts.append({
                "pr1": {
                    "number": pr1_num,
                    "title": pr1_title
                },
                "pr2": {
                    "number": pr2_num,
                    "title": pr2_title
                },
                "overlapping_files": overlapping_files,
                "conflict_level": "high" if len(overlapping_files) > 3 else "medium" if len(overlapping_files) > 1 else "low"
            })
    
    return conflicts

def check_github_mergeable_state(repo, pr_numbers, token):
    """Check the mergeable state of PRs directly from GitHub."""
    if not token:
        token = os.environ.get("GITHUB_TOKEN")
    
    if not token:
        print("GitHub token not provided. Skipping mergeable state check.")
        return {}
    
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json"
    }
    
    mergeable_states = {}
    
    for pr_num in pr_numbers:
        url = f"https://api.github.com/repos/{repo}/pulls/{pr_num}"
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            pr_data = response.json()
            mergeable_states[pr_num] = {
                "mergeable": pr_data.get("mergeable"),
                "mergeable_state": pr_data.get("mergeable_state")
            }
        else:
            print(f"Error fetching PR #{pr_num}: {response.status_code}")
    
    return mergeable_states

def generate_conflict_matrix(conflicts, pr_numbers):
    """Generate a conflict matrix for visualization."""
    # Create empty matrix
    matrix = pd.DataFrame(0, index=pr_numbers, columns=pr_numbers)
    
    # Fill matrix with conflict levels
    # 0 = no conflict, 1 = low, 2 = medium, 3 = high
    for conflict in conflicts:
        pr1 = conflict["pr1"]["number"]
        pr2 = conflict["pr2"]["number"]
        
        level = 0
        if conflict["conflict_level"] == "low":
            level = 1
        elif conflict["conflict_level"] == "medium":
            level = 2
        elif conflict["conflict_level"] == "high":
            level = 3
        
        matrix.loc[pr1, pr2] = level
        matrix.loc[pr2, pr1] = level  # Mirror the matrix
    
    return matrix

def generate_conflict_heatmap(matrix):
    """Generate a heatmap visualization of the conflict matrix."""
    plt.figure(figsize=(12, 10))
    
    # Custom colormap: white -> yellow -> orange -> red
    cmap = plt.cm.get_cmap('YlOrRd', 4)
    
    # Create heatmap
    plt.imshow(matrix, cmap=cmap, interpolation='nearest')
    plt.colorbar(ticks=[0, 1, 2, 3], label='Conflict Level')
    
    # Add PR numbers as labels
    plt.xticks(range(len(matrix.columns)), matrix.columns, rotation=90)
    plt.yticks(range(len(matrix.index)), matrix.index)
    
    plt.title('PR Conflict Heatmap')
    plt.xlabel('PR Number')
    plt.ylabel('PR Number')
    
    # Add grid lines
    plt.grid(False)
    
    # Make it tight
    plt.tight_layout()
    
    # Convert the plot to base64 for embedding in markdown
    buf = BytesIO()
    plt.savefig(buf, format='png', dpi=100)
    buf.seek(0)
    img_str = base64.b64encode(buf.read()).decode('utf-8')
    plt.close()
    
    return f"![PR Conflict Heatmap](data:image/png;base64,{img_str})"

def generate_conflict_graph(conflicts):
    """Generate a conflict graph showing PR relationships."""
    # This is a placeholder for a more sophisticated visualization
    # In a real implementation, we would use a library like networkx to create a graph
    # For simplicity, we'll return a placeholder message
    
    return "Conflict graph visualization would be displayed here."

def generate_conflict_report(conflicts, mergeable_states, conflict_matrix, heatmap, pr_data, output_file):
    """Generate a comprehensive markdown report of conflicts."""
    # Count conflicts by level
    high_conflicts = [c for c in conflicts if c["conflict_level"] == "high"]
    medium_conflicts = [c for c in conflicts if c["conflict_level"] == "medium"]
    low_conflicts = [c for c in conflicts if c["conflict_level"] == "low"]
    
    # Get PR titles for reference
    pr_titles = {pr["number"]: pr["title"] for pr in pr_data["pull_requests"]}
    
    # Generate the report
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    report = f"""# Conea PR Conflict Analysis
Generated: {now}

## Overview

This report analyzes potential conflicts between open PRs based on file overlap and GitHub mergeable state.

**Summary:**
- **High Conflict Potential**: {len(high_conflicts)} PR pairs
- **Medium Conflict Potential**: {len(medium_conflicts)} PR pairs
- **Low Conflict Potential**: {len(low_conflicts)} PR pairs
- **Total Analyzed PRs**: {len(mergeable_states)}

## Conflict Heatmap

The following heatmap shows the potential conflicts between PRs. Darker colors indicate higher conflict potential.

{heatmap}

## High Conflict Potential

The following PR pairs have high conflict potential (multiple overlapping files):

| PR #1 | PR #2 | Overlapping Files | Resolution Strategy |
|-------|-------|-------------------|---------------------|
"""
    
    for conflict in high_conflicts:
        pr1_num = conflict["pr1"]["number"]
        pr2_num = conflict["pr2"]["number"]
        overlapping = len(conflict["overlapping_files"])
        
        report += f"| #{pr1_num} - {pr_titles.get(pr1_num, 'Unknown')} | #{pr2_num} - {pr_titles.get(pr2_num, 'Unknown')} | {overlapping} files | Prioritize one PR |\n"
    
    report += """
## Medium Conflict Potential

The following PR pairs have medium conflict potential (2-3 overlapping files):

| PR #1 | PR #2 | Overlapping Files | Resolution Strategy |
|-------|-------|-------------------|---------------------|
"""
    
    for conflict in medium_conflicts:
        pr1_num = conflict["pr1"]["number"]
        pr2_num = conflict["pr2"]["number"]
        overlapping = len(conflict["overlapping_files"])
        
        report += f"| #{pr1_num} - {pr_titles.get(pr1_num, 'Unknown')} | #{pr2_num} - {pr_titles.get(pr2_num, 'Unknown')} | {overlapping} files | Coordinate changes |\n"
    
    report += """
## GitHub Mergeable State

The following PRs have been checked directly on GitHub for their mergeable state:

| PR # | Title | Mergeable | State | Action Needed |
|------|-------|-----------|-------|---------------|
"""
    
    for pr_num, state in mergeable_states.items():
        title = pr_titles.get(pr_num, "Unknown")
        mergeable = state.get("mergeable", "Unknown")
        mergeable_state = state.get("mergeable_state", "Unknown")
        
        # Determine action needed
        if mergeable_state == "clean":
            action = "None - Ready to merge"
        elif mergeable_state == "dirty" or mergeable_state == "unstable":
            action = "Resolve conflicts manually"
        elif mergeable_state == "blocked":
            action = "Check branch protection rules"
        elif mergeable_state == "behind":
            action = "Update branch from base"
        else:
            action = "Check PR on GitHub"
        
        report += f"| #{pr_num} | {title} | {mergeable} | {mergeable_state} | {action} |\n"
    
    report += """
## Detailed File Overlaps

The following sections show detailed file overlaps for each PR pair:

"""
    
    # Add sections for each conflict with detailed file lists
    for conflict in high_conflicts + medium_conflicts:
        pr1_num = conflict["pr1"]["number"]
        pr2_num = conflict["pr2"]["number"]
        
        report += f"### PR #{pr1_num} vs PR #{pr2_num}\n\n"
        report += f"- **PR #{pr1_num}**: {pr_titles.get(pr1_num, 'Unknown')}\n"
        report += f"- **PR #{pr2_num}**: {pr_titles.get(pr2_num, 'Unknown')}\n\n"
        report += "**Overlapping Files:**\n\n"
        
        for file in conflict["overlapping_files"]:
            report += f"- `{file}`\n"
        
        report += "\n"
    
    report += """
## Recommendations

Based on this analysis, the following recommendations are provided for managing PR conflicts:

1. **Prioritize High Conflict PRs**: Review and merge one PR from each high-conflict pair before the other to avoid complex merge conflicts.

2. **Update Branches**: Ensure all PRs are up-to-date with the base branch before triage.

3. **Coordination for Medium Conflicts**: For medium-conflict PR pairs, coordinate changes or consider bundling them together.

4. **Merge Order Strategy**: Consider a merge order that minimizes conflicts, addressing dependencies and maximizing successful merges.

## Next Steps

1. Update branches that are behind the base branch
2. Manually resolve conflicts for PRs marked as unmergeable
3. Prioritize PRs based on both conflict potential and project priority
4. Consider implementing automatic conflict detection in CI pipeline
"""
    
    # Write to file
    with open(output_file, 'w') as f:
        f.write(report)
    
    print(f"Conflict report saved to {output_file}")

def main():
    args = parse_args()
    
    # Load PR data
    pr_data = load_pr_data(args.pr_list)
    
    # Analyze file-based conflicts
    conflicts = analyze_file_conflicts(pr_data)
    
    # Extract PR numbers
    pr_numbers = [pr["number"] for pr in pr_data["pull_requests"]]
    
    # Check GitHub mergeable state
    mergeable_states = check_github_mergeable_state(args.repo, pr_numbers, args.token)
    
    # Generate conflict matrix
    conflict_matrix = generate_conflict_matrix(conflicts, pr_numbers)
    
    # Generate conflict heatmap
    heatmap = generate_conflict_heatmap(conflict_matrix)
    
    # Generate conflict graph
    conflict_graph = generate_conflict_graph(conflicts)
    
    # Save detailed analysis
    output = {
        "timestamp": datetime.now().isoformat(),
        "conflicts": conflicts,
        "mergeable_states": mergeable_states
    }
    
    with open(args.output, 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"Conflict analysis saved to {args.output}")
    
    # Generate markdown report
    generate_conflict_report(conflicts, mergeable_states, conflict_matrix, heatmap, pr_data, args.report)

if __name__ == "__main__":
    main()