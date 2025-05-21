#!/usr/bin/env python3
"""
PR Inventory Script for Conea Project

This script fetches all open PRs from a GitHub repository and generates a detailed
inventory in JSON format. It includes PR metadata, review status, linked issues,
and potential conflicts.

Usage:
    python pr_inventory.py --repo owner/repo --output output.json [--token TOKEN]

Requirements:
    - PyGithub
    - requests
    - json
    - argparse
    - dateutil
"""

import os
import sys
import json
import argparse
import requests
from datetime import datetime
import dateutil.parser
from github import Github
from github.GithubException import GithubException

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Generate PR inventory")
    parser.add_argument("--repo", required=True, help="GitHub repository in format owner/repo")
    parser.add_argument("--output", required=True, help="Output JSON file path")
    parser.add_argument("--token", help="GitHub personal access token (or set GITHUB_TOKEN env var)")
    return parser.parse_args()

def get_github_client(token):
    """Initialize GitHub client with token."""
    if not token:
        token = os.environ.get("GITHUB_TOKEN")
    
    if not token:
        print("Error: GitHub token is required. Provide it with --token or set GITHUB_TOKEN environment variable.")
        sys.exit(1)
    
    return Github(token)

def calculate_pr_complexity(pr):
    """Calculate a complexity score for a PR based on changes, files, etc."""
    additions = pr.additions or 0
    deletions = pr.deletions or 0
    changed_files = pr.changed_files or 0
    
    # Base complexity on size of changes
    if additions + deletions > 1000 or changed_files > 20:
        return 10  # Very complex
    elif additions + deletions > 500 or changed_files > 10:
        return 8  # Complex
    elif additions + deletions > 200 or changed_files > 5:
        return 6  # Moderately complex
    elif additions + deletions > 50:
        return 4  # Simple
    else:
        return 2  # Very simple

def get_pr_dependencies(pr_body):
    """Extract PR dependencies from PR body text."""
    dependencies = []
    
    # Look for common dependency indicators
    for line in pr_body.splitlines():
        line = line.lower()
        if "depends on" in line or "required by" in line or "after #" in line:
            # Extract PR numbers
            import re
            numbers = re.findall(r'#(\d+)', line)
            dependencies.extend(numbers)
    
    return dependencies

def get_linked_issues(pr_body):
    """Extract linked issues from PR body."""
    linked_issues = []
    
    # Look for keywords that link to issues
    keywords = ["fixes", "resolves", "closes"]
    
    for line in pr_body.splitlines():
        line_lower = line.lower()
        for keyword in keywords:
            if keyword in line_lower:
                # Extract issue numbers
                import re
                numbers = re.findall(r'#(\d+)', line)
                linked_issues.extend(numbers)
    
    return linked_issues

def analyze_conflicts(repo, pr):
    """Check if PR conflicts with any other open PRs."""
    conflicts = []
    
    # This would normally require multiple API calls to check merge compatibility
    # For now, we'll just check the mergeable status from GitHub
    if pr.mergeable == False:
        conflicts.append({
            "status": "Conflicting",
            "message": "This PR conflicts with the base branch"
        })
    
    return conflicts

def get_review_status(pr):
    """Get the current review status of a PR."""
    reviews = pr.get_reviews()
    
    # Count different review types
    approved = 0
    changes_requested = 0
    commented = 0
    
    # Keep track of the latest review from each reviewer
    latest_reviews = {}
    
    for review in reviews:
        if review.user is None:
            continue
            
        username = review.user.login
        
        # Skip bot reviews
        if username.endswith("[bot]"):
            continue
            
        # Track only the latest review from each user
        if username in latest_reviews:
            if review.submitted_at > latest_reviews[username]["submitted_at"]:
                latest_reviews[username] = {
                    "state": review.state,
                    "submitted_at": review.submitted_at
                }
        else:
            latest_reviews[username] = {
                "state": review.state,
                "submitted_at": review.submitted_at
            }
    
    # Count the final verdict from each reviewer
    for username, review_data in latest_reviews.items():
        if review_data["state"] == "APPROVED":
            approved += 1
        elif review_data["state"] == "CHANGES_REQUESTED":
            changes_requested += 1
        elif review_data["state"] == "COMMENTED":
            commented += 1
    
    # Determine overall status
    status = "Not Reviewed"
    if changes_requested > 0:
        status = "Changes Requested"
    elif approved > 0 and changes_requested == 0:
        if approved >= 2:  # Assuming we want at least 2 approvals
            status = "Approved"
        else:
            status = "Partially Approved"
    
    return {
        "status": status,
        "approved": approved,
        "changes_requested": changes_requested,
        "commented": commented
    }

def check_ci_status(pr):
    """Check the CI status for a PR."""
    statuses = []
    
    # Get the combined status
    if pr.head.sha:
        combined_status = pr.get_commits().get_page(0)[0].get_combined_status()
        for status in combined_status.statuses:
            statuses.append({
                "context": status.context,
                "state": status.state,
                "description": status.description,
                "url": status.target_url
            })
    
    # Determine overall CI status
    ci_status = "Unknown"
    if statuses:
        if all(s["state"] == "success" for s in statuses):
            ci_status = "Success"
        elif any(s["state"] == "failure" for s in statuses):
            ci_status = "Failure"
        elif any(s["state"] == "pending" for s in statuses):
            ci_status = "Pending"
    
    return {
        "status": ci_status,
        "details": statuses
    }

def check_rename_impact(pr, files):
    """Check how this PR impacts the renaming project."""
    rename_impact = 0
    rename_details = []
    
    # Keywords that indicate rename impact
    rename_keywords = [
        "shopify-mcp-server", "shopify_mcp_server", "MCP_SERVER", 
        "rename", "conea", "package name"
    ]
    
    # Check PR title and body
    content_to_check = (pr.title + " " + pr.body).lower()
    for keyword in rename_keywords:
        if keyword.lower() in content_to_check:
            rename_impact += 2
            rename_details.append(f"Keyword '{keyword}' found in PR title/description")
    
    # Check affected files
    affected_package_files = 0
    for file in files:
        filename = file.filename.lower()
        if "setup.py" in filename or "shopify_mcp_server" in filename:
            affected_package_files += 1
            rename_details.append(f"File impacts package structure: {file.filename}")
        
        # Check file content for references to package name
        try:
            if any(keyword.lower() in file.patch.lower() for keyword in rename_keywords):
                rename_impact += 2
                rename_details.append(f"Package name references modified in {file.filename}")
        except:
            # Patch may not be available for all files
            pass
    
    # Calculate final score (0-10)
    rename_impact = min(affected_package_files * 2 + rename_impact, 10)
    
    return {
        "score": rename_impact,
        "details": rename_details
    }

def process_pull_requests(repo):
    """Process all pull requests and generate inventory data."""
    prs = repo.get_pulls(state='open')
    pr_data = []
    
    for pr in prs:
        try:
            files = list(pr.get_files())
            
            # Calculate days since creation and last update
            created_days_ago = (datetime.now() - pr.created_at.replace(tzinfo=None)).days
            updated_days_ago = (datetime.now() - pr.updated_at.replace(tzinfo=None)).days
            
            pr_info = {
                "number": pr.number,
                "title": pr.title,
                "url": pr.html_url,
                "author": pr.user.login if pr.user else "Unknown",
                "created_at": pr.created_at.isoformat(),
                "updated_at": pr.updated_at.isoformat(),
                "created_days_ago": created_days_ago,
                "updated_days_ago": updated_days_ago,
                "draft": pr.draft,
                "size": {
                    "additions": pr.additions,
                    "deletions": pr.deletions,
                    "changed_files": pr.changed_files
                },
                "complexity": calculate_pr_complexity(pr),
                "dependencies": get_pr_dependencies(pr.body or ""),
                "linked_issues": get_linked_issues(pr.body or ""),
                "conflicts": analyze_conflicts(repo, pr),
                "reviews": get_review_status(pr),
                "ci_status": check_ci_status(pr),
                "rename_impact": check_rename_impact(pr, files),
                "files": [f.filename for f in files]
            }
            
            pr_data.append(pr_info)
            print(f"Processed PR #{pr.number}: {pr.title}")
            
        except GithubException as e:
            print(f"Error processing PR #{pr.number}: {e}")
            continue
    
    return pr_data

def generate_dependency_graph(pr_data):
    """Generate a dependency graph structure."""
    graph = {
        "nodes": [],
        "links": []
    }
    
    # Create nodes for each PR
    for pr in pr_data:
        graph["nodes"].append({
            "id": str(pr["number"]),
            "name": f"PR #{pr['number']}",
            "title": pr["title"],
            "complexity": pr["complexity"],
            "rename_impact": pr["rename_impact"]["score"]
        })
    
    # Create links for dependencies
    for pr in pr_data:
        for dep in pr["dependencies"]:
            graph["links"].append({
                "source": str(pr["number"]),
                "target": dep,
                "value": 1
            })
    
    return graph

def main():
    args = parse_args()
    
    try:
        # Get GitHub client
        g = get_github_client(args.token)
        
        # Get repository
        repo = g.get_repo(args.repo)
        
        # Process PRs
        print(f"Fetching pull requests from {args.repo}...")
        pr_data = process_pull_requests(repo)
        
        # Generate dependency graph
        dependency_graph = generate_dependency_graph(pr_data)
        
        # Build final output
        output = {
            "timestamp": datetime.now().isoformat(),
            "repository": args.repo,
            "pull_requests": pr_data,
            "dependency_graph": dependency_graph,
            "summary": {
                "total": len(pr_data),
                "draft": sum(1 for pr in pr_data if pr["draft"]),
                "conflicts": sum(1 for pr in pr_data if pr["conflicts"]),
                "approved": sum(1 for pr in pr_data if pr["reviews"]["status"] == "Approved"),
                "changes_requested": sum(1 for pr in pr_data if pr["reviews"]["status"] == "Changes Requested")
            }
        }
        
        # Write to file
        with open(args.output, 'w') as f:
            json.dump(output, f, indent=2)
        
        print(f"PR inventory written to {args.output}")
        
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()