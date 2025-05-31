#!/usr/bin/env python3
"""
Generate Review Template for Conea PR Triage

This script generates a detailed review template for a specific PR,
pre-populated with PR information for easier review.

Usage:
    python generate_review_template.py --pr-number <PR_NUMBER> --output <OUTPUT_FILE>

Requirements:
    - json
    - argparse
    - github
"""

import os
import sys
import json
import argparse
import requests
from datetime import datetime

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Generate PR review template")
    parser.add_argument("--pr-number", required=True, type=int, help="PR number to generate template for")
    parser.add_argument("--output", required=True, help="Output file for the review template")
    parser.add_argument("--inventory", help="PR inventory JSON file path (optional)")
    parser.add_argument("--repo", default="mourigenta/conea", help="GitHub repository (owner/repo)")
    parser.add_argument("--token", help="GitHub token (or set GITHUB_TOKEN env var)")
    return parser.parse_args()

def get_pr_data_from_inventory(pr_number, inventory_file):
    """Get PR data from inventory JSON file."""
    try:
        with open(inventory_file, 'r') as f:
            inventory = json.load(f)
        
        for pr in inventory["pull_requests"]:
            if pr["number"] == pr_number:
                return pr
        
        print(f"PR #{pr_number} not found in inventory")
        return None
    except Exception as e:
        print(f"Error loading inventory: {e}")
        return None

def get_pr_data_from_github(pr_number, repo, token):
    """Get PR data directly from GitHub API."""
    if not token:
        token = os.environ.get("GITHUB_TOKEN")
    
    if not token:
        print("GitHub token not provided. Set it with --token or GITHUB_TOKEN env var")
        return None
    
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json"
    }
    
    # Get basic PR info
    url = f"https://api.github.com/repos/{repo}/pulls/{pr_number}"
    response = requests.get(url, headers=headers)
    
    if response.status_code != 200:
        print(f"Error fetching PR from GitHub: {response.status_code}")
        return None
    
    pr_data = response.json()
    
    # Get PR files
    files_url = f"https://api.github.com/repos/{repo}/pulls/{pr_number}/files"
    files_response = requests.get(files_url, headers=headers)
    
    if files_response.status_code == 200:
        files = [file["filename"] for file in files_response.json()]
    else:
        files = []
    
    # Get PR reviews
    reviews_url = f"https://api.github.com/repos/{repo}/pulls/{pr_number}/reviews"
    reviews_response = requests.get(reviews_url, headers=headers)
    
    reviews = {}
    if reviews_response.status_code == 200:
        review_data = reviews_response.json()
        approved = 0
        changes_requested = 0
        
        for review in review_data:
            if review["state"] == "APPROVED":
                approved += 1
            elif review["state"] == "CHANGES_REQUESTED":
                changes_requested += 1
        
        reviews = {
            "status": "Changes Requested" if changes_requested > 0 else "Approved" if approved > 0 else "Not Reviewed",
            "approved": approved,
            "changes_requested": changes_requested
        }
    
    # Construct PR data in a similar format to the inventory
    return {
        "number": pr_number,
        "title": pr_data["title"],
        "body": pr_data["body"],
        "author": pr_data["user"]["login"],
        "created_at": pr_data["created_at"],
        "updated_at": pr_data["updated_at"],
        "files": files,
        "reviews": reviews,
        "html_url": pr_data["html_url"],
        "draft": pr_data["draft"],
        "size": {
            "additions": pr_data["additions"],
            "deletions": pr_data["deletions"],
            "changed_files": pr_data["changed_files"]
        }
    }

def analyze_package_references(files):
    """Analyze files for package name references relevant to Phase 2 rename."""
    package_refs = []
    
    # Keywords to look for in file paths
    package_keywords = [
        "setup.py",
        "shopify_mcp_server",
        "__init__.py",
        "shopify-mcp-server",
        "import",
        "requirements"
    ]
    
    for file_path in files:
        for keyword in package_keywords:
            if keyword in file_path:
                package_refs.append(f"{file_path} (contains '{keyword}')")
                break
    
    return package_refs

def estimate_complexity(pr_data):
    """Estimate PR complexity based on available data."""
    size_factor = min(10, (pr_data["size"]["additions"] + pr_data["size"]["deletions"]) / 200)
    files_factor = min(10, pr_data["size"]["changed_files"] / 5)
    
    # Assume more complexity if certain files or directories are changed
    complexity_keywords = [
        "setup.py",
        "dockerfile",
        "ci",
        "deploy",
        "config",
        "schema",
        "migration",
        "architecture"
    ]
    
    keyword_factor = 0
    for file in pr_data.get("files", []):
        for keyword in complexity_keywords:
            if keyword in file.lower():
                keyword_factor += 1
                break
    
    keyword_factor = min(5, keyword_factor)
    
    # Calculate weighted average
    complexity = (size_factor * 0.4) + (files_factor * 0.4) + (keyword_factor * 0.2)
    return min(10, complexity)

def determine_test_coverage(files):
    """Estimate test coverage based on files changed."""
    test_files = [file for file in files if "test" in file.lower()]
    total_files = len(files)
    
    if total_files == 0:
        return "Unknown"
    
    test_ratio = len(test_files) / total_files
    
    if test_ratio > 0.3:
        return "Good (dedicated test files included)"
    elif test_ratio > 0:
        return "Partial (some test files)"
    else:
        return "None (no test files included)"

def generate_review_template(pr_data):
    """Generate a detailed review template for the PR."""
    # Calculate additional metrics
    complexity = estimate_complexity(pr_data)
    test_coverage = determine_test_coverage(pr_data.get("files", []))
    package_refs = analyze_package_references(pr_data.get("files", []))
    
    # Format template
    template = f"""# PR Review: #{pr_data["number"]}

**Reviewer:** [Your Name]  
**Review Date:** {datetime.now().strftime("%Y-%m-%d")}  
**PR Title:** {pr_data["title"]}  
**PR URL:** {pr_data.get("html_url", "Unknown")}

## PR Overview

- **Author:** {pr_data["author"]}
- **Created:** {pr_data["created_at"].split("T")[0] if isinstance(pr_data["created_at"], str) else "Unknown"}
- **Last Updated:** {pr_data["updated_at"].split("T")[0] if isinstance(pr_data["updated_at"], str) else "Unknown"}
- **Size:** {pr_data["size"]["additions"]} additions, {pr_data["size"]["deletions"]} deletions, {pr_data["size"]["changed_files"]} files changed
- **Estimated Complexity:** {complexity:.1f}/10
- **Current Review Status:** {pr_data.get("reviews", {}).get("status", "Unknown")}
- **Test Coverage:** {test_coverage}

## Technical Assessment

### Code Quality (0-10): [SCORE]
<!-- Overall code quality including readability, documentation, and adherence to project standards -->

**Strengths:**
- 
- 

**Areas for Improvement:**
- 
- 

### Test Coverage (0-10): [SCORE]
<!-- Quality and comprehensiveness of tests -->

**Test Coverage Analysis:**
- Unit tests: [Yes/No]
- Integration tests: [Yes/No]
- Documentation tests: [Yes/No]

**Testing Recommendations:**
- 
- 

### Project Impact (0-10): [SCORE]
<!-- How significant is this PR for the project goals -->

**Impact Areas:**
- 
- 

**Side Effects:**
- 
- 
"""

    # Add rename impact section
    template += f"""
### Rename Impact Assessment (0-10): [SCORE]
<!-- How this PR affects the Phase 2 renaming effort -->

**Package References Modified:** {len(package_refs)}
"""
    
    if package_refs:
        template += "\n**Files Affecting Package Structure:**\n"
        for ref in package_refs:
            template += f"- {ref}\n"
    
    template += """
**Name Change Compatibility Issues:**
- 
- 

**Phase 2 Integration Considerations:**
- 
- 

## Implementation Assessment

### Approach (0-10): [SCORE]
<!-- Evaluation of the implementation approach -->

**Design Patterns Used:**
- 
- 

**Alternative Approaches Considered:**
- 
- 

### Complexity (0-10): [SCORE]
<!-- How complex is this change -->

**Complexity Analysis:**
- Lines changed: {additions + deletions} lines
- Files modified: {changed_files} files
- New dependencies introduced: [Yes/No]
- Breaking changes: [Yes/No]

**Simplification Opportunities:**
- 
- 
""".format(
        additions=pr_data["size"]["additions"],
        deletions=pr_data["size"]["deletions"],
        changed_files=pr_data["size"]["changed_files"]
    )
    
    # Add dependencies section
    template += """
## Dependencies

**Depends on PRs:**
- 
- 

**Blocks PRs:**
- 
- 

## Security & Performance

**Security Considerations:**
- 
- 

**Performance Impact:**
- 
- 

## Triage Classification

**Recommended Category:**
- [ ] A: Immediate Action (v0.3.1 Essential)
- [ ] B: High Priority (v0.3.1 Desirable)
- [ ] C: Medium Priority (v0.3.2 Candidate)
- [ ] D: Low Priority (Future/Close)

**Justification:**
<!-- Explain why you selected this category -->



## Final Recommendation

**Decision:**
- [ ] Approve
- [ ] Approve with Suggested Changes
- [ ] Request Changes
- [ ] Close

**Summary of Review:**
<!-- Brief summary of your assessment -->



**Next Steps:**
<!-- What should happen next with this PR -->


"""

    # Add changed files section
    if pr_data.get("files"):
        template += "\n## Changed Files\n\n"
        for file in pr_data["files"]:
            template += f"- {file}\n"
    
    # Add PR description section if available
    if pr_data.get("body"):
        template += "\n## PR Description\n\n```\n"
        template += pr_data["body"]
        template += "\n```\n"
    
    return template

def main():
    args = parse_args()
    
    # Get PR data - first try inventory if provided
    pr_data = None
    if args.inventory and os.path.exists(args.inventory):
        pr_data = get_pr_data_from_inventory(args.pr_number, args.inventory)
    
    # If not found in inventory, try GitHub
    if not pr_data:
        pr_data = get_pr_data_from_github(args.pr_number, args.repo, args.token)
    
    if not pr_data:
        print(f"Failed to get data for PR #{args.pr_number}")
        sys.exit(1)
    
    # Generate review template
    template = generate_review_template(pr_data)
    
    # Write to file
    with open(args.output, 'w') as f:
        f.write(template)
    
    print(f"Review template generated: {args.output}")

if __name__ == "__main__":
    main()