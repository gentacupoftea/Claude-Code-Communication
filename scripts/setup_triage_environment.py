#!/usr/bin/env python3
"""
Setup PR Triage Environment for Conea Project

This script sets up a PR triage environment by creating necessary directories,
running initial data collection scripts, and preparing template files.

Usage:
    python setup_triage_environment.py --repo owner/repo [--token GITHUB_TOKEN] [--output-dir OUTPUT_DIR]

Requirements:
    - All PR triage scripts and their dependencies
"""

import os
import sys
import argparse
import subprocess
import shutil
from datetime import datetime

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Setup PR triage environment")
    parser.add_argument("--repo", required=True, help="GitHub repository in format owner/repo")
    parser.add_argument("--token", help="GitHub personal access token (or set GITHUB_TOKEN env var)")
    parser.add_argument("--output-dir", default="triage", help="Output directory for triage files")
    return parser.parse_args()

def setup_directories(output_dir):
    """Set up directories for the triage session."""
    print(f"Setting up triage environment in {output_dir}...")
    
    # Create directories
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(f"{output_dir}/pr_reviews", exist_ok=True)
    os.makedirs(f"{output_dir}/decisions", exist_ok=True)
    
    print(f"Created directories in {output_dir}/")

def copy_templates(output_dir):
    """Copy template files to the triage directory."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    templates_dir = os.path.join(script_dir, "templates")
    
    if os.path.exists(templates_dir):
        print("Copying templates to triage directory...")
        
        # Copy PR review template
        pr_review_template = os.path.join(templates_dir, "pr_review_template.md")
        if os.path.exists(pr_review_template):
            shutil.copy(pr_review_template, os.path.join(output_dir, "pr_reviews", "_template.md"))
            print(f"Copied PR review template to {output_dir}/pr_reviews/_template.md")
        
        # Copy PR decision template
        pr_decision_template = os.path.join(templates_dir, "pr_triage_decision.md")
        if os.path.exists(pr_decision_template):
            shutil.copy(pr_decision_template, os.path.join(output_dir, "decisions", "_template.md"))
            print(f"Copied PR decision template to {output_dir}/decisions/_template.md")
    else:
        print("Warning: Templates directory not found. Skipping template copy.")

def collect_pr_inventory(args, output_dir):
    """Run PR inventory script to collect data about open PRs."""
    token_env = {}
    if args.token:
        token_env = {"GITHUB_TOKEN": args.token}
    elif "GITHUB_TOKEN" in os.environ:
        token_env = {"GITHUB_TOKEN": os.environ["GITHUB_TOKEN"]}
    else:
        print("Warning: No GitHub token provided. Some scripts may fail.")
    
    # Merge current environment with token_env
    env = {**os.environ, **token_env}
    
    pr_inventory_file = f"{output_dir}/pr_inventory.json"
    
    print("\nCollecting PR inventory...")
    result = subprocess.run([
        "python", "scripts/pr_inventory.py",
        "--repo", args.repo,
        "--output", pr_inventory_file,
        *(["--token", args.token] if args.token else [])
    ], env=env)
    
    if result.returncode != 0:
        print("Error running PR inventory script")
        return False
    
    print(f"PR inventory saved to {pr_inventory_file}")
    return True

def generate_review_templates(output_dir):
    """Generate review templates for each PR based on inventory data."""
    pr_inventory_file = f"{output_dir}/pr_inventory.json"
    
    if not os.path.exists(pr_inventory_file):
        print("Error: PR inventory file not found. Cannot generate review templates.")
        return False
    
    try:
        import json
        with open(pr_inventory_file, 'r') as f:
            pr_data = json.load(f)
        
        print("\nGenerating PR review templates...")
        
        # Check if template exists
        template_path = os.path.join(output_dir, "pr_reviews", "_template.md")
        template_content = ""
        
        if os.path.exists(template_path):
            with open(template_path, 'r') as f:
                template_content = f.read()
        
        # Create review files for each PR
        for pr in pr_data.get("pull_requests", []):
            pr_number = pr["number"]
            pr_title = pr["title"]
            pr_author = pr["author"]
            
            review_file = os.path.join(output_dir, "pr_reviews", f"pr-{pr_number}-review.md")
            
            # Check if file already exists
            if os.path.exists(review_file):
                print(f"Review file for PR #{pr_number} already exists, skipping.")
                continue
            
            # Create review content
            if template_content:
                content = template_content.replace("[PR_NUMBER]", str(pr_number))
                content = content.replace("[PR_TITLE]", pr_title)
                content = content.replace("[PR_AUTHOR]", pr_author)
            else:
                # Simple default template
                content = f"""# PR Review: #{pr_number} - {pr_title}

## PR Information
- **PR Number**: #{pr_number}
- **Title**: {pr_title}
- **Author**: {pr_author}
- **Review Date**: {datetime.now().strftime("%Y-%m-%d")}

## Technical Review

### Code Quality
- **Readability**: [1-10]
- **Maintainability**: [1-10]
- **Test Coverage**: [1-10]

### Functional Aspects
- **Implements Requirements**: [Yes/No/Partially]
- **Edge Cases Handled**: [Yes/No/Partially]
- **Performance Considerations**: [Good/Needs Improvement/Not Applicable]

### Phase 2 Rename Impact
- **Impact Level**: [Low/Medium/High]
- **Affected Components**: [List affected components]
- **Migration Considerations**: [Notes on migration]

## Recommendation
- **Suggested Category**: [A/B/C/D]
- **Rationale**: [Explain why this category is recommended]
- **Special Considerations**: [Any special notes]

## Review Notes
[Detailed notes about the PR]
"""
            
            # Write to file
            with open(review_file, 'w') as f:
                f.write(content)
            
            print(f"Created review template for PR #{pr_number}")
        
        return True
    
    except Exception as e:
        print(f"Error generating review templates: {e}")
        return False

def generate_instruction_file(output_dir):
    """Generate an instruction file for the triage process."""
    instruction_file = os.path.join(output_dir, "TRIAGE_INSTRUCTIONS.md")
    
    content = """# Conea PR Triage Instructions

## Step 1: Review PRs

For each PR in the `pr_reviews` directory:

1. Check out the branch locally:
   ```bash
   git fetch origin pull/PR_NUMBER/head:pr-PR_NUMBER
   git checkout pr-PR_NUMBER
   ```

2. Review the code changes:
   ```bash
   git diff develop...HEAD
   ```

3. Run the tests if applicable:
   ```bash
   pytest
   ```

4. Fill in the review template in `pr_reviews/pr-NUMBER-review.md`

## Step 2: Run Analysis Scripts

Run the following scripts to analyze the PRs:

```bash
# Analyze rename impact
python scripts/analyze_rename_impact.py --input triage/pr_inventory.json --output triage/rename_impact.json --report triage/rename_impact_report.md

# Generate dependency graph
python scripts/pr_dependency_graph.py --input triage/pr_inventory.json --output triage/pr_dependencies.png

# Analyze conflicts
python scripts/analyze_conflicts.py --repo owner/repo --pr-list triage/pr_inventory.json --output triage/conflict_analysis.json --report triage/conflict_report.md

# Generate PR statistics
python scripts/pr_stats.py --input triage/pr_inventory.json --output triage/pr_statistics.md
```

## Step 3: Prepare Triage Session

Generate the triage session materials:

```bash
python scripts/prepare_triage_session.py --reviews triage/aggregated_reviews.json --conflicts triage/conflict_analysis.json --rename-impact triage/rename_impact.json --output triage/triage_session_materials.md --inventory triage/pr_inventory.json
```

## Step 4: Hold Triage Session

During the triage session:

1. Discuss each PR using the materials from Step 3
2. Assign each PR to a category (A, B, C, or D)
3. Record decisions in `decisions/pr-NUMBER-decision.md`

## Step 5: Generate Final Report

After the triage session:

```bash
python scripts/generate_triage_report.py --decisions triage/decisions/ --output PR_TRIAGE_RESULTS.md
```

## Categories

- **Category A**: Immediate action (v0.3.1 essential)
- **Category B**: High priority (v0.3.1 desirable)
- **Category C**: Medium priority (v0.3.2 candidates)
- **Category D**: Low priority (Future/close)
"""
    
    with open(instruction_file, 'w') as f:
        f.write(content)
    
    print(f"\nInstructions saved to {instruction_file}")

def main():
    args = parse_args()
    
    # Setup directories
    setup_directories(args.output_dir)
    
    # Copy templates
    copy_templates(args.output_dir)
    
    # Collect PR inventory
    if collect_pr_inventory(args, args.output_dir):
        # Generate review templates
        generate_review_templates(args.output_dir)
    
    # Generate instruction file
    generate_instruction_file(args.output_dir)
    
    print("\nTriage environment setup complete!")
    print(f"Next steps: Review PRs and fill in the templates in {args.output_dir}/pr_reviews/")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())