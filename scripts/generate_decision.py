#!/usr/bin/env python3
"""
Generate Decision Record for Conea PR Triage

This script generates a decision record for a specific PR after triage,
documenting the category assignment, rationale, and next steps.

Usage:
    python generate_decision.py --pr-number <PR_NUMBER> --category <A/B/C/D>
                              --reasoning "Decision rationale" --action <action>
                              --assignee "Name" --deadline "YYYY-MM-DD"
                              --output <OUTPUT_FILE>

Requirements:
    - json
    - argparse
    - datetime
"""

import os
import sys
import json
import argparse
from datetime import datetime

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Generate PR triage decision record")
    parser.add_argument("--pr-number", required=True, type=int, help="PR number")
    parser.add_argument("--category", required=True, choices=["A", "B", "C", "D"], 
                        help="Final category assignment")
    parser.add_argument("--reasoning", required=True, help="Reasoning behind the decision")
    parser.add_argument("--action", required=True, 
                        choices=["approve", "request-changes", "merge", "postpone", "close"],
                        help="Action to take")
    parser.add_argument("--assignee", required=True, help="Person assigned to handle the PR")
    parser.add_argument("--deadline", required=True, help="Deadline for completion (YYYY-MM-DD)")
    parser.add_argument("--output", required=True, help="Output file path")
    parser.add_argument("--inventory", help="PR inventory JSON file (optional)")
    parser.add_argument("--scores", help="PR scores JSON file (optional)")
    parser.add_argument("--rename-impact", help="Rename impact JSON file (optional)")
    return parser.parse_args()

def load_json_data(file_path):
    """Load JSON data from file if it exists."""
    if not os.path.exists(file_path):
        return None
    
    try:
        with open(file_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading data from {file_path}: {e}")
        return None

def get_pr_data(pr_number, inventory_file):
    """Get PR data from inventory file."""
    if not inventory_file or not os.path.exists(inventory_file):
        # Use minimal PR data if inventory not available
        return {
            "number": pr_number,
            "title": "Unknown",
            "author": "Unknown"
        }
    
    try:
        inventory = load_json_data(inventory_file)
        for pr in inventory["pull_requests"]:
            if pr["number"] == pr_number:
                return pr
                
        print(f"PR #{pr_number} not found in inventory")
        return {
            "number": pr_number,
            "title": "Unknown - Not found in inventory",
            "author": "Unknown"
        }
    except Exception as e:
        print(f"Error finding PR in inventory: {e}")
        return {
            "number": pr_number,
            "title": "Unknown - Error loading inventory",
            "author": "Unknown"
        }

def get_pr_scores(pr_number, scores_file):
    """Get PR scores from scores file."""
    if not scores_file or not os.path.exists(scores_file):
        return {}
    
    try:
        scores_data = load_json_data(scores_file)
        return scores_data.get(str(pr_number), {})
    except Exception as e:
        print(f"Error loading scores: {e}")
        return {}

def get_rename_impact(pr_number, rename_impact_file):
    """Get rename impact details for PR."""
    if not rename_impact_file or not os.path.exists(rename_impact_file):
        return {}
    
    try:
        rename_data = load_json_data(rename_impact_file)
        for pr_impact in rename_data:
            if pr_impact["pr_number"] == pr_number:
                return pr_impact
        return {}
    except Exception as e:
        print(f"Error loading rename impact: {e}")
        return {}

def generate_decision_record(pr_data, category, reasoning, action, assignee, deadline, 
                            scores=None, rename_impact=None):
    """Generate a decision record for the PR."""
    
    # Format target release based on category
    if category == "A" or category == "B":
        target_release = "v0.3.1"
    elif category == "C":
        target_release = "v0.3.2"
    else:
        target_release = "Future"
    
    # Format decision based on action
    if action == "approve":
        decision = "Approve"
    elif action == "request-changes":
        decision = "Request Changes"
    elif action == "merge":
        decision = "Merge"
    elif action == "postpone":
        decision = "Postpone"
    elif action == "close":
        decision = "Close"
    else:
        decision = action.capitalize()
    
    # Create the basic record
    now = datetime.now().strftime("%Y-%m-%d")
    record = f"""# PR Triage Decision Record

**PR #:** {pr_data["number"]}  
**Title:** {pr_data["title"]}  
**Author:** {pr_data["author"]}  
**Triage Date:** {now}

## Triage Summary

**Final Category:** {category}  
**Decision:** {decision}  
**Target Release:** {target_release}  
**Required Before:** {deadline}

## Evaluation Scores

| Criterion | Score (0-10) | Notes |
|-----------|--------------|-------|
"""
    
    # Add scores if available
    if scores:
        record += f"| Technical Value | {scores.get('technical_value', 'N/A')} | |\n"
        record += f"| Urgency | {scores.get('urgency', 'N/A')} | |\n"
        record += f"| Complexity | {scores.get('complexity', 'N/A')} | |\n"
        record += f"| Dependencies | {scores.get('dependency_score', 'N/A')} | |\n"
        record += f"| Rename Impact | {scores.get('rename_impact', 'N/A')} | |\n"
        record += f"| **TOTAL** | {scores.get('final_score', 'N/A')} | |\n"
    else:
        # Placeholder scores
        record += "| Technical Value | | |\n"
        record += "| Urgency | | |\n"
        record += "| Complexity | | |\n"
        record += "| Dependencies | | |\n"
        record += "| Rename Impact | | |\n"
        record += "| **TOTAL** | | |\n"
    
    # Add justification
    record += f"""
## Justification

{reasoning}

## Required Changes

"""
    
    # Add default required changes based on action
    if action == "request-changes":
        record += "- [ ] Address reviewer comments\n"
        record += "- [ ] Update tests\n"
        record += "- [ ] Resolve conflicts\n"
    elif action == "approve":
        record += "- [ ] Final review\n"
        record += "- [ ] Ready to merge\n"
    elif action == "merge":
        record += "- [ ] None - Ready to merge\n"
    elif action == "postpone":
        record += "- [ ] Reassess in next release cycle\n"
    elif action == "close":
        record += "- [ ] Close PR with appropriate comment\n"
    
    # Add action plan
    record += f"""
## Action Plan

**Assigned Reviewer(s):**
- {assignee}

**Timeline:**
- Review Completion: {deadline}
- Changes Due: {deadline}
- Final Decision: {deadline}

## Dependencies

**Depends on:**
- 

**Blocks:**
- 

## Relation to Phase 2 Rename

"""
    
    # Add rename impact details if available
    if rename_impact:
        category = rename_impact.get("impact_category", "Unknown")
        score = rename_impact.get("final_score", "Unknown")
        
        record += f"This PR has **{category.lower()} impact** (score: {score}/10) on the Phase 2 rename effort.\n\n"
        
        if rename_impact.get("high_impacted_files"):
            record += "**Critical files affected:**\n"
            for file_info in rename_impact.get("high_impacted_files", []):
                record += f"- {file_info.get('file', 'Unknown')}\n"
            record += "\n"
        
        if rename_impact.get("found_keywords"):
            keywords = rename_impact.get("found_keywords", [])
            if keywords:
                record += f"This PR contains {len(keywords)} rename-related keywords.\n"
    else:
        record += "Impact on Phase 2 rename effort needs to be assessed.\n"
    
    # Add additional notes
    record += """
## Additional Notes

<!-- Any other important information -->

---

**Decided by:** [Name]  
**Approved by:** [PM/Tech Lead Name]"""
    
    return record

def main():
    args = parse_args()
    
    # Get PR data
    pr_data = get_pr_data(args.pr_number, args.inventory)
    
    # Get scores if available
    scores = get_pr_scores(args.pr_number, args.scores)
    
    # Get rename impact if available
    rename_impact = get_rename_impact(args.pr_number, args.rename_impact)
    
    # Generate decision record
    record = generate_decision_record(
        pr_data,
        args.category,
        args.reasoning,
        args.action,
        args.assignee,
        args.deadline,
        scores,
        rename_impact
    )
    
    # Ensure output directory exists
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    
    # Write to file
    with open(args.output, 'w') as f:
        f.write(record)
    
    print(f"Decision record saved to {args.output}")

if __name__ == "__main__":
    main()