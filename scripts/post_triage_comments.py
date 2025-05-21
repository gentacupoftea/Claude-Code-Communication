#!/usr/bin/env python3
"""
Post Triage Comments to GitHub PRs

This script posts triage decisions as comments to GitHub pull requests
after a triage session has been completed.

Usage:
    python post_triage_comments.py --repo owner/repo --decisions-dir decisions 
                                  [--token GITHUB_TOKEN] [--dry-run]

Requirements:
    - PyGithub
    - json
    - argparse
"""

import os
import sys
import json
import argparse
import glob
from datetime import datetime
from github import Github
from github.GithubException import GithubException

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Post triage comments to GitHub PRs")
    parser.add_argument("--repo", required=True, help="GitHub repository in format owner/repo")
    parser.add_argument("--decisions-dir", required=True, help="Directory containing triage decision files")
    parser.add_argument("--token", help="GitHub personal access token (or set GITHUB_TOKEN env var)")
    parser.add_argument("--dry-run", action="store_true", help="Generate comments but don't post them")
    return parser.parse_args()

def get_github_client(token):
    """Initialize GitHub client with token."""
    if not token:
        token = os.environ.get("GITHUB_TOKEN")
    
    if not token:
        print("Error: GitHub token is required. Provide it with --token or set GITHUB_TOKEN environment variable.")
        sys.exit(1)
    
    return Github(token)

def parse_decision_file(file_path):
    """Parse a decision file to extract PR number and triage details."""
    try:
        with open(file_path, 'r') as f:
            content = f.read()
        
        # Extract PR number from filename
        filename = os.path.basename(file_path)
        pr_num = None
        if filename.startswith("pr-") and "-decision" in filename:
            pr_num = filename.split("-")[1].split("-")[0]
        
        # Parse content to extract decision information
        category = None
        reasoning = None
        action = None
        assignee = None
        deadline = None
        
        lines = content.splitlines()
        for line in lines:
            line = line.strip()
            if line.startswith("**Category:**"):
                category = line.split("**Category:**")[1].strip()
            elif line.startswith("**Reasoning:**"):
                reasoning = line.split("**Reasoning:**")[1].strip()
            elif line.startswith("**Action:**"):
                action = line.split("**Action:**")[1].strip()
            elif line.startswith("**Assignee:**"):
                assignee = line.split("**Assignee:**")[1].strip()
            elif line.startswith("**Deadline:**"):
                deadline = line.split("**Deadline:**")[1].strip()
        
        return {
            "pr_number": pr_num,
            "category": category,
            "reasoning": reasoning,
            "action": action,
            "assignee": assignee,
            "deadline": deadline,
            "raw_content": content  # Include raw content for debugging
        }
    
    except Exception as e:
        print(f"Error parsing decision file {file_path}: {e}")
        return None

def generate_comment(decision):
    """Generate a GitHub comment from triage decision."""
    category = decision.get("category", "?")
    reasoning = decision.get("reasoning", "No reason provided")
    action = decision.get("action", "No action specified")
    assignee = decision.get("assignee", "Unassigned")
    deadline = decision.get("deadline", "No deadline")
    
    # Format category with emoji based on priority
    category_emoji = "🟢"  # Default
    if category == "A":
        category_emoji = "🔴"  # Red for highest priority
    elif category == "B":
        category_emoji = "🟠"  # Orange for high priority
    elif category == "C":
        category_emoji = "🟡"  # Yellow for medium priority
    elif category == "D":
        category_emoji = "🟢"  # Green for low priority
    
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    comment = f"""## PR Triage Decision {category_emoji}

**Triage Date:** {timestamp}

### Decision

**Category:** {category_emoji} Category {category}

**Reasoning:** {reasoning}

### Implementation Plan

**Action:** {action}

**Assignee:** {assignee}

**Deadline:** {deadline}

---

*This comment was automatically generated based on the PR triage session results.*

*Categories:*
- 🔴 **Category A**: Immediate action (v0.3.1 essential)
- 🟠 **Category B**: High priority (v0.3.1 desirable)
- 🟡 **Category C**: Medium priority (v0.3.2 candidates)
- 🟢 **Category D**: Low priority (Future/close)
"""
    
    return comment

def post_comments(github_client, repo_name, decisions, dry_run=False):
    """Post comments to GitHub PRs."""
    try:
        # Get repository
        repo = github_client.get_repo(repo_name)
        
        for decision in decisions:
            pr_number = decision.get("pr_number")
            
            if not pr_number:
                print("Error: PR number not found in decision")
                continue
            
            try:
                # Convert PR number to integer
                pr_number = int(pr_number)
                
                # Generate comment
                comment = generate_comment(decision)
                
                # Print preview
                print(f"\nComment for PR #{pr_number}:")
                print("-" * 40)
                print(comment)
                print("-" * 40)
                
                if not dry_run:
                    # Get PR
                    pr = repo.get_pull(pr_number)
                    
                    # Post comment
                    pr.create_issue_comment(comment)
                    
                    # Add label based on category
                    category = decision.get("category")
                    if category:
                        label_name = f"Priority: {category}"
                        
                        # Check if label exists, create if not
                        try:
                            repo.get_label(label_name)
                        except GithubException:
                            # Create label with color based on category
                            color = "d73a4a"  # Red (A)
                            if category == "B":
                                color = "ff9800"  # Orange
                            elif category == "C":
                                color = "fbca04"  # Yellow
                            elif category == "D":
                                color = "0e8a16"  # Green
                            
                            repo.create_label(label_name, color)
                        
                        # Add label to PR
                        pr.add_to_labels(label_name)
                    
                    print(f"✅ Comment posted to PR #{pr_number}")
                else:
                    print("💡 Dry run: Comment not posted")
            
            except Exception as e:
                print(f"Error processing PR #{pr_number}: {e}")
                continue
    
    except Exception as e:
        print(f"Error accessing repository {repo_name}: {e}")
        sys.exit(1)

def main():
    args = parse_args()
    
    # Get GitHub client
    github_client = get_github_client(args.token)
    
    # Find decision files
    decision_files = glob.glob(os.path.join(args.decisions_dir, "pr-*-decision.md"))
    
    if not decision_files:
        print(f"No decision files found in {args.decisions_dir}")
        return 1
    
    print(f"Found {len(decision_files)} decision files")
    
    # Parse decision files
    decisions = []
    for file_path in decision_files:
        decision = parse_decision_file(file_path)
        if decision:
            decisions.append(decision)
    
    # Post comments
    if decisions:
        print(f"Posting {len(decisions)} comments to GitHub...")
        post_comments(github_client, args.repo, decisions, args.dry_run)
        
        if args.dry_run:
            print("\n🚨 DRY RUN: No comments were actually posted.")
            print(f"To post comments, run again without the --dry-run flag.")
        else:
            print(f"\n✅ Posted {len(decisions)} comments to GitHub PRs.")
    else:
        print("No valid decisions found.")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())