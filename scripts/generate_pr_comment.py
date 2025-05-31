#!/usr/bin/env python
"""
Generate a detailed comment for a PR with triage information.

This script takes PR data and analysis results to generate a Markdown comment
for a GitHub Pull Request containing triage-related information including:
- Rename impact assessment
- Conflict detection
- Dependency information
- Triage categorization recommendation
"""

import argparse
import json
import sys
from datetime import datetime


def parse_args():
    parser = argparse.ArgumentParser(description="Generate PR comment with triage information")
    parser.add_argument("--pr-data", required=True, help="JSON data for the current PR")
    parser.add_argument("--rename-impact", required=True, help="JSON data of rename impact analysis")
    parser.add_argument("--conflicts", required=True, help="JSON data of conflict analysis")
    parser.add_argument("--dependencies", required=True, help="JSON data of PR dependencies")
    return parser.parse_args()


def calculate_category(pr_data, rename_impact, conflicts, dependencies):
    """
    Calculate recommended triage category based on analysis data.
    
    Categories:
    A - Immediate action (v0.3.1 essential)
    B - High priority (v0.3.1 desirable)
    C - Medium priority (v0.3.2 candidates)
    D - Low priority (Future/close)
    """
    # Parse impact, conflicts, and dependencies data
    impact_data = json.loads(rename_impact)
    conflict_data = json.loads(conflicts)
    dependency_data = json.loads(dependencies)
    
    # Default to category C
    category = "C"
    reasons = []
    
    # Extract impact score for this PR
    pr_number = pr_data.get("number")
    impact_score = 0
    for pr in impact_data.get("pull_requests", []):
        if pr.get("number") == pr_number:
            impact_score = pr.get("rename_impact", {}).get("score", 0)
            break
    
    # Check if PR has conflicts
    has_conflicts = False
    for conflict in conflict_data.get("conflicts", []):
        if conflict.get("pr1") == pr_number or conflict.get("pr2") == pr_number:
            has_conflicts = True
            break
    
    # Check if PR has dependencies
    dependency_count = 0
    for dep in dependency_data.get("dependencies", []):
        if dep.get("source") == pr_number or dep.get("target") == pr_number:
            dependency_count += 1
    
    # Apply categorization rules
    if impact_score >= 8:
        category = "A"
        reasons.append(f"High rename impact score: {impact_score}/10")
    elif impact_score >= 5:
        category = "B"
        reasons.append(f"Moderate rename impact score: {impact_score}/10")
    
    if has_conflicts:
        if category not in ["A"]:
            category = "B"
        reasons.append("Has potential conflicts with other PRs")
    
    if dependency_count > 2:
        if category not in ["A"]:
            category = "B"
        reasons.append(f"Has {dependency_count} dependencies with other PRs")
    
    # Additional factors from PR data
    if pr_data.get("has_failing_ci", False):
        if category not in ["A", "B"]:
            category = "C"
        reasons.append("Has failing CI checks")
    
    if pr_data.get("review_count", 0) == 0:
        if category not in ["A", "B"]:
            category = "C" 
        reasons.append("No reviews yet")
    
    if pr_data.get("age", 0) > 14:  # Older than 2 weeks
        if category in ["C", "D"]:
            category = "D"
        reasons.append(f"PR is {pr_data.get('age', 0)} days old")
    
    return category, reasons


def generate_comment(pr_data, rename_impact, conflicts, dependencies):
    """Generate a markdown comment with triage information."""
    pr = json.loads(pr_data)
    
    # Calculate recommended category
    category, reasons = calculate_category(pr, rename_impact, conflicts, dependencies)
    
    # Build the comment
    comment = [
        "## PR Triage Report",
        f"*Generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}*\n",
        "### PR Information",
        f"- **Title**: {pr.get('title', 'N/A')}",
        f"- **Author**: {pr.get('author', 'N/A')}",
        f"- **Age**: {pr.get('age', 'N/A')} days",
        f"- **Review count**: {pr.get('review_count', 0)}",
        f"- **CI Status**: {'❌ Failing' if pr.get('has_failing_ci', False) else '✅ Passing'}\n",
        "### Phase 2 Rename Impact",
    ]
    
    # Parse rename impact data
    impact_data = json.loads(rename_impact)
    pr_number = pr.get("number")
    pr_impact = None
    
    for impact_pr in impact_data.get("pull_requests", []):
        if impact_pr.get("number") == pr_number:
            pr_impact = impact_pr.get("rename_impact", {})
            break
    
    if pr_impact:
        score = pr_impact.get("score", 0)
        files = pr_impact.get("affected_files", [])
        comment.extend([
            f"- **Impact Score**: {score}/10",
            f"- **Affected Files**: {len(files)}",
        ])
        
        if len(files) > 0:
            comment.append("- **Files with rename impact**:")
            for file in files[:5]:  # Show only top 5 files
                comment.append(f"  - `{file}`")
            if len(files) > 5:
                comment.append(f"  - *(and {len(files) - 5} more)*")
    else:
        comment.append("- No rename impact data available")
    
    comment.append("\n### Conflicts and Dependencies")
    
    # Parse conflicts data
    conflict_data = json.loads(conflicts)
    pr_conflicts = []
    
    for conflict in conflict_data.get("conflicts", []):
        if conflict.get("pr1") == pr_number:
            pr_conflicts.append(conflict)
        elif conflict.get("pr2") == pr_number:
            pr_conflicts.append(conflict)
    
    if pr_conflicts:
        comment.append(f"- **Potential Conflicts**: {len(pr_conflicts)}")
        comment.append("- **Conflicting PRs**:")
        for conflict in pr_conflicts[:3]:  # Show only top 3 conflicts
            other_pr = conflict.get("pr2") if conflict.get("pr1") == pr_number else conflict.get("pr1")
            comment.append(f"  - PR #{other_pr}: {conflict.get('reason', 'File overlap')}")
        if len(pr_conflicts) > 3:
            comment.append(f"  - *(and {len(pr_conflicts) - 3} more)*")
    else:
        comment.append("- No conflicts detected")
    
    # Parse dependencies data
    dependency_data = json.loads(dependencies)
    pr_dependencies = []
    
    for dep in dependency_data.get("dependencies", []):
        if dep.get("source") == pr_number or dep.get("target") == pr_number:
            pr_dependencies.append(dep)
    
    if pr_dependencies:
        comment.append(f"- **Dependencies**: {len(pr_dependencies)}")
        comment.append("- **Dependency Details**:")
        for dep in pr_dependencies[:3]:  # Show only top 3 dependencies
            if dep.get("source") == pr_number:
                comment.append(f"  - This PR depends on PR #{dep.get('target')}")
            else:
                comment.append(f"  - PR #{dep.get('source')} depends on this PR")
        if len(pr_dependencies) > 3:
            comment.append(f"  - *(and {len(pr_dependencies) - 3} more)*")
    else:
        comment.append("- No dependencies detected")
    
    # Add triage recommendation
    comment.extend([
        "\n### Triage Recommendation",
        f"- **Recommended Category**: **{category}**",
        "- **Rationale**:"
    ])
    
    for reason in reasons:
        comment.append(f"  - {reason}")
    
    comment.extend([
        "\n### Category Definitions",
        "- **Category A**: Immediate action (v0.3.1 essential)",
        "- **Category B**: High priority (v0.3.1 desirable)",
        "- **Category C**: Medium priority (v0.3.2 candidates)",
        "- **Category D**: Low priority (Future/close)",
        "\n---",
        "*This comment was automatically generated by the PR Triage CI workflow.*"
    ])
    
    return "\n".join(comment)


def main():
    args = parse_args()
    
    try:
        comment = generate_comment(
            args.pr_data,
            args.rename_impact,
            args.conflicts,
            args.dependencies
        )
        print(comment)
        return 0
    except Exception as e:
        print(f"Error generating PR comment: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())