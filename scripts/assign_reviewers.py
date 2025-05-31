#!/usr/bin/env python3
"""
Assign Reviewers for Conea PR Triage

This script assigns reviewers to PRs based on expertise, PR complexity,
and workload distribution.

Usage:
    python assign_reviewers.py --input pr_inventory.json --team-list team_members.json --output reviewer_assignments.json

Requirements:
    - json
    - argparse
    - random
"""

import os
import sys
import json
import argparse
import random
from datetime import datetime

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Assign reviewers to PRs")
    parser.add_argument("--input", required=True, help="Input JSON file with PR inventory data")
    parser.add_argument("--team-list", required=True, help="JSON file with team member information")
    parser.add_argument("--output", required=True, help="Output JSON file for reviewer assignments")
    return parser.parse_args()

def load_json_data(file_path):
    """Load JSON data from file."""
    try:
        with open(file_path, 'r') as f:
            data = json.load(f)
        return data
    except Exception as e:
        print(f"Error loading data from {file_path}: {e}")
        sys.exit(1)

def load_team_members(team_file):
    """Load team member information."""
    # If the team file doesn't exist, create a sample one
    if not os.path.exists(team_file):
        print(f"Team file {team_file} does not exist. Creating a sample file...")
        sample_team = {
            "members": [
                {
                    "name": "Developer 1",
                    "github_username": "dev1",
                    "expertise": ["frontend", "typescript", "react", "css"],
                    "secondary_skills": ["testing", "documentation"],
                    "workload": 0
                },
                {
                    "name": "Developer 2",
                    "github_username": "dev2",
                    "expertise": ["backend", "python", "api", "database"],
                    "secondary_skills": ["security", "performance"],
                    "workload": 0
                },
                {
                    "name": "Developer 3",
                    "github_username": "dev3",
                    "expertise": ["devops", "ci-cd", "docker", "kubernetes"],
                    "secondary_skills": ["scripting", "monitoring"],
                    "workload": 0
                },
                {
                    "name": "Developer 4",
                    "github_username": "dev4",
                    "expertise": ["testing", "qa", "automation", "documentation"],
                    "secondary_skills": ["frontend", "backend"],
                    "workload": 0
                },
                {
                    "name": "Developer 5",
                    "github_username": "dev5",
                    "expertise": ["architecture", "design", "refactoring", "performance"],
                    "secondary_skills": ["security", "api"],
                    "workload": 0
                }
            ],
            "expertise_keywords": {
                "frontend": ["react", "typescript", "javascript", "css", "html", "ui", "component"],
                "backend": ["python", "api", "server", "endpoint", "database", "model"],
                "devops": ["ci", "cd", "deploy", "docker", "kubernetes", "pipeline", "github actions"],
                "testing": ["test", "junit", "pytest", "cypress", "jest", "coverage"],
                "documentation": ["docs", "readme", "markdown", "guide", "tutorial"],
                "security": ["auth", "authentication", "authorization", "encrypt", "token"],
                "performance": ["optimize", "performance", "speed", "benchmark", "profile"],
                "refactoring": ["refactor", "restructure", "rename", "clean"],
                "architecture": ["design", "pattern", "architecture", "structure"]
            }
        }
        
        with open(team_file, 'w') as f:
            json.dump(sample_team, f, indent=2)
        
        return sample_team
    
    return load_json_data(team_file)

def determine_pr_expertise_areas(pr, expertise_keywords):
    """Determine the expertise areas relevant to a PR."""
    # Combine title, files, and PR description to analyze
    pr_content = pr["title"].lower()
    
    if "body" in pr and pr["body"]:
        pr_content += " " + pr["body"].lower()
    
    files = pr.get("files", [])
    file_content = " ".join(files).lower()
    
    expertise_areas = []
    
    # Check for each expertise area
    for area, keywords in expertise_keywords.items():
        # Check if any keyword is in PR content or files
        if any(keyword in pr_content for keyword in keywords) or any(keyword in file_content for keyword in keywords):
            expertise_areas.append(area)
    
    # Add some default areas if none are found
    if not expertise_areas:
        if any(file.endswith((".py", ".js", ".ts")) for file in files):
            expertise_areas.append("backend")
        if any(file.endswith((".jsx", ".tsx", ".css", ".html")) for file in files):
            expertise_areas.append("frontend")
        if "test" in pr_content or any("test" in file for file in files):
            expertise_areas.append("testing")
        if "doc" in pr_content or any("doc" in file for file in files):
            expertise_areas.append("documentation")
    
    return expertise_areas

def calculate_expertise_match(member, expertise_areas):
    """Calculate how well a team member's expertise matches the PR."""
    match_score = 0
    
    # Primary expertise matches are more important
    for area in expertise_areas:
        if area in member["expertise"]:
            match_score += 2
        elif area in member["secondary_skills"]:
            match_score += 1
    
    return match_score

def assign_reviewers(prs, team_members, expertise_keywords):
    """Assign reviewers to PRs based on expertise and workload."""
    assignments = []
    
    # Reset workload counters
    for member in team_members:
        member["workload"] = 0
    
    # Sort PRs by complexity (highest first) to assign most complex PRs first
    sorted_prs = sorted(prs, key=lambda x: x["complexity"], reverse=True)
    
    for pr in sorted_prs:
        # Determine expertise areas for this PR
        expertise_areas = determine_pr_expertise_areas(pr, expertise_keywords)
        
        # Calculate expertise match for each team member
        matches = []
        for member in team_members:
            match_score = calculate_expertise_match(member, expertise_areas)
            # Consider both expertise match and current workload
            # Higher match score is better, higher workload is worse
            adjusted_score = match_score - (member["workload"] * 0.2)
            matches.append({
                "member": member,
                "match_score": match_score,
                "adjusted_score": adjusted_score
            })
        
        # Sort by adjusted score (higher is better)
        matches.sort(key=lambda x: x["adjusted_score"], reverse=True)
        
        # Assign primary and secondary reviewers
        primary_reviewer = matches[0]["member"]
        primary_reviewer["workload"] += 1
        
        # For secondary reviewer, make sure it's not the same person
        # and try to get someone with complementary skills
        secondary_matches = [m for m in matches if m["member"] != primary_reviewer]
        secondary_reviewer = secondary_matches[0]["member"] if secondary_matches else None
        if secondary_reviewer:
            secondary_reviewer["workload"] += 0.5  # Secondary reviews count for less workload
        
        # Record assignment
        assignment = {
            "pr_number": pr["number"],
            "title": pr["title"],
            "author": pr["author"],
            "complexity": pr["complexity"],
            "rename_impact": pr["rename_impact"]["score"],
            "expertise_areas": expertise_areas,
            "primary_reviewer": {
                "name": primary_reviewer["name"],
                "github_username": primary_reviewer["github_username"],
                "match_score": matches[0]["match_score"]
            }
        }
        
        if secondary_reviewer:
            assignment["secondary_reviewer"] = {
                "name": secondary_reviewer["name"],
                "github_username": secondary_reviewer["github_username"],
                "match_score": secondary_matches[0]["match_score"]
            }
        
        assignments.append(assignment)
    
    return assignments

def generate_assignment_markdown(assignments, team_members):
    """Generate a markdown summary of reviewer assignments."""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    markdown = f"""# PR Reviewer Assignments
Generated: {now}

## Assignment Summary

| PR # | Title | Primary Reviewer | Secondary Reviewer | Expertise Areas |
|------|-------|-----------------|-------------------|----------------|
"""
    
    for assignment in assignments:
        primary = assignment["primary_reviewer"]["name"]
        secondary = assignment.get("secondary_reviewer", {}).get("name", "N/A")
        expertise = ", ".join(assignment["expertise_areas"])
        
        markdown += f"| #{assignment['pr_number']} | {assignment['title']} | {primary} | {secondary} | {expertise} |\n"
    
    markdown += """
## Workload Distribution

| Reviewer | Primary Assignments | Secondary Assignments | Total Workload |
|----------|--------------------|-----------------------|----------------|
"""
    
    # Calculate workload statistics
    workload_stats = {}
    for member in team_members:
        workload_stats[member["name"]] = {
            "primary": 0,
            "secondary": 0
        }
    
    for assignment in assignments:
        primary_name = assignment["primary_reviewer"]["name"]
        workload_stats[primary_name]["primary"] += 1
        
        if "secondary_reviewer" in assignment:
            secondary_name = assignment["secondary_reviewer"]["name"]
            workload_stats[secondary_name]["secondary"] += 1
    
    for name, stats in workload_stats.items():
        # Calculate total workload (primary counts more than secondary)
        total_workload = stats["primary"] + (stats["secondary"] * 0.5)
        markdown += f"| {name} | {stats['primary']} | {stats['secondary']} | {total_workload} |\n"
    
    markdown += """
## Expertise Area Distribution

| Expertise Area | PR Count |
|----------------|----------|
"""
    
    # Calculate expertise area statistics
    expertise_stats = {}
    for assignment in assignments:
        for area in assignment["expertise_areas"]:
            if area in expertise_stats:
                expertise_stats[area] += 1
            else:
                expertise_stats[area] = 1
    
    # Sort by count (highest first)
    sorted_expertise = sorted(expertise_stats.items(), key=lambda x: x[1], reverse=True)
    
    for area, count in sorted_expertise:
        markdown += f"| {area} | {count} |\n"
    
    return markdown

def main():
    args = parse_args()
    
    # Load PR data
    pr_data = load_json_data(args.input)
    
    # Load team member information
    team_data = load_team_members(args.team_list)
    
    # Assign reviewers
    assignments = assign_reviewers(
        pr_data["pull_requests"],
        team_data["members"],
        team_data["expertise_keywords"]
    )
    
    # Save assignments
    output = {
        "timestamp": datetime.now().isoformat(),
        "assignments": assignments
    }
    
    with open(args.output, 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"Reviewer assignments saved to {args.output}")
    
    # Generate markdown summary
    markdown = generate_assignment_markdown(assignments, team_data["members"])
    markdown_file = args.output.replace(".json", ".md")
    
    with open(markdown_file, 'w') as f:
        f.write(markdown)
    
    print(f"Markdown summary saved to {markdown_file}")

if __name__ == "__main__":
    main()