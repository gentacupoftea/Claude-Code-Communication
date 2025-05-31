#!/usr/bin/env python3
"""
Aggregate PR Reviews for Conea Project

This script aggregates individual PR reviews into a consolidated JSON format
and generates a summary report.

Usage:
    python aggregate_reviews.py --reviews-dir <REVIEWS_DIR> --output <OUTPUT_JSON> --summary <SUMMARY_MD>

Requirements:
    - json
    - os
    - glob
    - re
    - argparse
    - datetime
"""

import os
import sys
import json
import glob
import re
import argparse
from datetime import datetime

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Aggregate PR reviews")
    parser.add_argument("--reviews-dir", required=True, help="Directory containing PR review files")
    parser.add_argument("--output", required=True, help="Output JSON file for aggregated reviews")
    parser.add_argument("--summary", required=True, help="Output Markdown file for review summary")
    return parser.parse_args()

def extract_review_data(file_path):
    """Extract structured data from a review file."""
    try:
        with open(file_path, 'r') as f:
            content = f.read()
        
        # Extract PR number
        pr_number_match = re.search(r'PR Review: #(\d+)', content)
        if not pr_number_match:
            print(f"Warning: Could not find PR number in {file_path}")
            return None
        
        pr_number = int(pr_number_match.group(1))
        
        # Extract reviewer
        reviewer_match = re.search(r'\*\*Reviewer:\*\* (.*)', content)
        reviewer = reviewer_match.group(1) if reviewer_match else "Unknown"
        
        # Extract review date
        date_match = re.search(r'\*\*Review Date:\*\* (.*)', content)
        review_date = date_match.group(1) if date_match else "Unknown"
        
        # Extract PR title
        title_match = re.search(r'\*\*PR Title:\*\* (.*)', content)
        title = title_match.group(1) if title_match else "Unknown"
        
        # Extract scores
        scores = {}
        score_matches = re.finditer(r'### (.*) \(0-10\): (\d+)', content)
        for match in score_matches:
            category = match.group(1)
            score = int(match.group(2))
            scores[category.lower().replace(' ', '_')] = score
        
        # Extract recommended category
        category_match = re.search(r'- \[x\] ([ABCD]): ', content)
        if not category_match:
            category_match = re.search(r'- \[X\] ([ABCD]): ', content)
        
        recommended_category = category_match.group(1) if category_match else None
        
        # Extract final recommendation
        decision_match = re.search(r'- \[x\] (Approve|Approve with Suggested Changes|Request Changes|Close)', content)
        if not decision_match:
            decision_match = re.search(r'- \[X\] (Approve|Approve with Suggested Changes|Request Changes|Close)', content)
        
        decision = decision_match.group(1) if decision_match else None
        
        # Extract rename impact assessment
        rename_impact_score_match = re.search(r'### Rename Impact Assessment \(0-10\): (\d+)', content)
        rename_impact_score = int(rename_impact_score_match.group(1)) if rename_impact_score_match else None
        
        # Extract justification
        justification_match = re.search(r'\*\*Justification:\*\*\s+\n(.*?)(?=\n\n##|\Z)', content, re.DOTALL)
        justification = justification_match.group(1).strip() if justification_match else ""
        
        # Extract summary
        summary_match = re.search(r'\*\*Summary of Review:\*\*\s+\n(.*?)(?=\n\n##|\*\*Next Steps|\Z)', content, re.DOTALL)
        summary = summary_match.group(1).strip() if summary_match else ""
        
        # Extract next steps
        next_steps_match = re.search(r'\*\*Next Steps:\*\*\s+\n(.*?)(?=\n\n##|\Z)', content, re.DOTALL)
        next_steps = next_steps_match.group(1).strip() if next_steps_match else ""
        
        return {
            "pr_number": pr_number,
            "title": title,
            "reviewer": reviewer,
            "review_date": review_date,
            "scores": scores,
            "rename_impact_score": rename_impact_score,
            "recommended_category": recommended_category,
            "decision": decision,
            "justification": justification,
            "summary": summary,
            "next_steps": next_steps
        }
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return None

def aggregate_reviews(reviews_dir):
    """Aggregate all review files in the directory."""
    review_files = glob.glob(os.path.join(reviews_dir, "*.md"))
    
    if not review_files:
        print(f"No review files found in {reviews_dir}")
        return []
    
    reviews = []
    for file_path in review_files:
        review_data = extract_review_data(file_path)
        if review_data:
            reviews.append(review_data)
            print(f"Processed review for PR #{review_data['pr_number']}")
    
    return reviews

def consolidate_pr_reviews(reviews):
    """Consolidate multiple reviews for the same PR."""
    pr_reviews = {}
    
    for review in reviews:
        pr_number = review["pr_number"]
        
        if pr_number not in pr_reviews:
            pr_reviews[pr_number] = {
                "pr_number": pr_number,
                "title": review["title"],
                "reviews": []
            }
        
        pr_reviews[pr_number]["reviews"].append(review)
    
    # Calculate average scores and consensus
    for pr_number, pr_data in pr_reviews.items():
        reviews = pr_data["reviews"]
        
        # Skip if only one review
        if len(reviews) <= 1:
            pr_data["averaged_scores"] = reviews[0].get("scores", {})
            pr_data["averaged_rename_impact"] = reviews[0].get("rename_impact_score")
            pr_data["recommended_category"] = reviews[0].get("recommended_category")
            pr_data["consensus"] = True
            continue
        
        # Average scores
        all_scores = {}
        rename_impacts = []
        categories = []
        decisions = []
        
        for review in reviews:
            # Collect scores
            for category, score in review.get("scores", {}).items():
                if category not in all_scores:
                    all_scores[category] = []
                all_scores[category].append(score)
            
            # Collect rename impact scores
            if review.get("rename_impact_score") is not None:
                rename_impacts.append(review["rename_impact_score"])
            
            # Collect categories and decisions
            if review.get("recommended_category"):
                categories.append(review["recommended_category"])
            
            if review.get("decision"):
                decisions.append(review["decision"])
        
        # Calculate averages
        averaged_scores = {}
        for category, scores in all_scores.items():
            averaged_scores[category] = sum(scores) / len(scores)
        
        # Calculate average rename impact
        averaged_rename_impact = sum(rename_impacts) / len(rename_impacts) if rename_impacts else None
        
        # Determine consensus on category
        if len(set(categories)) == 1:
            recommended_category = categories[0]
            category_consensus = True
        else:
            # Use most common category, or the highest priority one in case of tie
            category_counts = {}
            for category in categories:
                if category not in category_counts:
                    category_counts[category] = 0
                category_counts[category] += 1
            
            max_count = max(category_counts.values())
            top_categories = [c for c, count in category_counts.items() if count == max_count]
            
            if len(top_categories) == 1:
                recommended_category = top_categories[0]
            else:
                # In case of tie, pick highest priority (A > B > C > D)
                recommended_category = min(top_categories)
            
            category_consensus = len(set(categories)) == 1
        
        # Determine consensus on decision
        if len(set(decisions)) == 1:
            decision = decisions[0]
            decision_consensus = True
        else:
            # Use most common decision
            decision_counts = {}
            for d in decisions:
                if d not in decision_counts:
                    decision_counts[d] = 0
                decision_counts[d] += 1
            
            max_count = max(decision_counts.values())
            top_decisions = [d for d, count in decision_counts.items() if count == max_count]
            
            decision = top_decisions[0]
            decision_consensus = len(set(decisions)) == 1
        
        # Store results
        pr_data["averaged_scores"] = averaged_scores
        pr_data["averaged_rename_impact"] = averaged_rename_impact
        pr_data["recommended_category"] = recommended_category
        pr_data["decision"] = decision
        pr_data["consensus"] = category_consensus and decision_consensus
    
    return list(pr_reviews.values())

def generate_summary_report(consolidated_reviews, output_file):
    """Generate a markdown summary report of all reviews."""
    # Sort reviews by recommended category
    sorted_reviews = sorted(
        consolidated_reviews, 
        key=lambda x: (
            x.get("recommended_category", "Z"),  # Sort by category (A, B, C, D)
            -x.get("averaged_rename_impact", 0)  # Then by rename impact (highest first)
        )
    )
    
    # Group by category
    categorized = {
        "A": [],
        "B": [],
        "C": [],
        "D": [],
        "Unknown": []
    }
    
    for review in sorted_reviews:
        category = review.get("recommended_category")
        if category in categorized:
            categorized[category].append(review)
        else:
            categorized["Unknown"].append(review)
    
    # Generate the report
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    report = f"""# Conea PR Review Summary
Generated: {now}

## Overview

This report summarizes the results of PR reviews for the Conea project, focusing on triage categories and Phase 2 rename impact.

**Summary:**
- **Category A (即時処理)**: {len(categorized["A"])} PRs
- **Category B (高優先度)**: {len(categorized["B"])} PRs
- **Category C (中優先度)**: {len(categorized["C"])} PRs
- **Category D (低優先度)**: {len(categorized["D"])} PRs
- **Uncategorized**: {len(categorized["Unknown"])} PRs

## Category A (即時処理) PRs

The following PRs are recommended for Category A (immediate action, essential for v0.3.1):

| PR # | Title | Avg Scores | Rename Impact | Consensus | Reviews |
|------|-------|------------|---------------|-----------|---------|
"""
    
    # Add category A PRs
    for review in categorized["A"]:
        # Format average scores
        avg_scores = []
        for category, score in review.get("averaged_scores", {}).items():
            avg_scores.append(f"{category.replace('_', ' ').title()}: {score:.1f}")
        
        avg_scores_str = ", ".join(avg_scores) or "N/A"
        
        # Format rename impact
        rename_impact = review.get("averaged_rename_impact")
        rename_impact_str = f"{rename_impact:.1f}/10" if rename_impact is not None else "N/A"
        
        # Format consensus
        consensus = "✓" if review.get("consensus", False) else "✗"
        
        # Format reviews
        reviews_count = len(review.get("reviews", []))
        reviewers = [r.get("reviewer", "Unknown") for r in review.get("reviews", [])]
        reviewers_str = ", ".join(reviewers) or "None"
        
        report += f"| #{review['pr_number']} | {review['title']} | {avg_scores_str} | {rename_impact_str} | {consensus} | {reviewers_str} |\n"
    
    # Add Category B PRs
    report += """
## Category B (高優先度) PRs

The following PRs are recommended for Category B (high priority, desirable for v0.3.1):

| PR # | Title | Avg Scores | Rename Impact | Consensus | Reviews |
|------|-------|------------|---------------|-----------|---------|
"""
    
    for review in categorized["B"]:
        # Format average scores
        avg_scores = []
        for category, score in review.get("averaged_scores", {}).items():
            avg_scores.append(f"{category.replace('_', ' ').title()}: {score:.1f}")
        
        avg_scores_str = ", ".join(avg_scores) or "N/A"
        
        # Format rename impact
        rename_impact = review.get("averaged_rename_impact")
        rename_impact_str = f"{rename_impact:.1f}/10" if rename_impact is not None else "N/A"
        
        # Format consensus
        consensus = "✓" if review.get("consensus", False) else "✗"
        
        # Format reviews
        reviews_count = len(review.get("reviews", []))
        reviewers = [r.get("reviewer", "Unknown") for r in review.get("reviews", [])]
        reviewers_str = ", ".join(reviewers) or "None"
        
        report += f"| #{review['pr_number']} | {review['title']} | {avg_scores_str} | {rename_impact_str} | {consensus} | {reviewers_str} |\n"
    
    # Add Category C PRs
    report += """
## Category C (中優先度) PRs

The following PRs are recommended for Category C (medium priority, candidates for v0.3.2):

| PR # | Title | Avg Scores | Rename Impact | Consensus | Reviews |
|------|-------|------------|---------------|-----------|---------|
"""
    
    for review in categorized["C"]:
        # Format average scores
        avg_scores = []
        for category, score in review.get("averaged_scores", {}).items():
            avg_scores.append(f"{category.replace('_', ' ').title()}: {score:.1f}")
        
        avg_scores_str = ", ".join(avg_scores) or "N/A"
        
        # Format rename impact
        rename_impact = review.get("averaged_rename_impact")
        rename_impact_str = f"{rename_impact:.1f}/10" if rename_impact is not None else "N/A"
        
        # Format consensus
        consensus = "✓" if review.get("consensus", False) else "✗"
        
        # Format reviews
        reviews_count = len(review.get("reviews", []))
        reviewers = [r.get("reviewer", "Unknown") for r in review.get("reviews", [])]
        reviewers_str = ", ".join(reviewers) or "None"
        
        report += f"| #{review['pr_number']} | {review['title']} | {avg_scores_str} | {rename_impact_str} | {consensus} | {reviewers_str} |\n"
    
    # Add Category D PRs
    report += """
## Category D (低優先度) PRs

The following PRs are recommended for Category D (low priority, defer or close):

| PR # | Title | Avg Scores | Rename Impact | Consensus | Reviews |
|------|-------|------------|---------------|-----------|---------|
"""
    
    for review in categorized["D"]:
        # Format average scores
        avg_scores = []
        for category, score in review.get("averaged_scores", {}).items():
            avg_scores.append(f"{category.replace('_', ' ').title()}: {score:.1f}")
        
        avg_scores_str = ", ".join(avg_scores) or "N/A"
        
        # Format rename impact
        rename_impact = review.get("averaged_rename_impact")
        rename_impact_str = f"{rename_impact:.1f}/10" if rename_impact is not None else "N/A"
        
        # Format consensus
        consensus = "✓" if review.get("consensus", False) else "✗"
        
        # Format reviews
        reviews_count = len(review.get("reviews", []))
        reviewers = [r.get("reviewer", "Unknown") for r in review.get("reviews", [])]
        reviewers_str = ", ".join(reviewers) or "None"
        
        report += f"| #{review['pr_number']} | {review['title']} | {avg_scores_str} | {rename_impact_str} | {consensus} | {reviewers_str} |\n"
    
    # Add uncategorized PRs
    if categorized["Unknown"]:
        report += """
## Uncategorized PRs

The following PRs have been reviewed but lack a clear category recommendation:

| PR # | Title | Avg Scores | Rename Impact | Reviews |
|------|-------|------------|---------------|---------|
"""
        
        for review in categorized["Unknown"]:
            # Format average scores
            avg_scores = []
            for category, score in review.get("averaged_scores", {}).items():
                avg_scores.append(f"{category.replace('_', ' ').title()}: {score:.1f}")
            
            avg_scores_str = ", ".join(avg_scores) or "N/A"
            
            # Format rename impact
            rename_impact = review.get("averaged_rename_impact")
            rename_impact_str = f"{rename_impact:.1f}/10" if rename_impact is not None else "N/A"
            
            # Format reviews
            reviews_count = len(review.get("reviews", []))
            reviewers = [r.get("reviewer", "Unknown") for r in review.get("reviews", [])]
            reviewers_str = ", ".join(reviewers) or "None"
            
            report += f"| #{review['pr_number']} | {review['title']} | {avg_scores_str} | {rename_impact_str} | {reviewers_str} |\n"
    
    # Add special sections
    report += """
## High Rename Impact PRs

The following PRs have high rename impact (scored 7+ out of 10) and require special consideration for Phase 2:

| PR # | Title | Rename Impact | Category | Reviews |
|------|-------|---------------|----------|---------|
"""
    
    # Find PRs with high rename impact
    high_impact_prs = [
        r for r in sorted_reviews 
        if r.get("averaged_rename_impact", 0) and r.get("averaged_rename_impact", 0) >= 7
    ]
    
    for review in high_impact_prs:
        rename_impact = review.get("averaged_rename_impact", 0)
        rename_impact_str = f"{rename_impact:.1f}/10" if rename_impact else "N/A"
        
        category = review.get("recommended_category", "Unknown")
        
        # Format reviews
        reviews_count = len(review.get("reviews", []))
        reviewers = [r.get("reviewer", "Unknown") for r in review.get("reviews", [])]
        reviewers_str = ", ".join(reviewers) or "None"
        
        report += f"| #{review['pr_number']} | {review['title']} | {rename_impact_str} | {category} | {reviewers_str} |\n"
    
    # Add non-consensus PRs
    non_consensus_prs = [r for r in sorted_reviews if not r.get("consensus", True)]
    
    if non_consensus_prs:
        report += """
## Non-Consensus PRs

The following PRs have differing opinions among reviewers and require discussion:

| PR # | Title | Recommended Categories | Reviews |
|------|-------|------------------------|---------|
"""
        
        for review in non_consensus_prs:
            # Get all unique categories
            categories = []
            for r in review.get("reviews", []):
                if r.get("recommended_category") and r.get("recommended_category") not in categories:
                    categories.append(r.get("recommended_category"))
            
            categories_str = ", ".join(categories) or "None"
            
            # Format reviews
            reviewers = [r.get("reviewer", "Unknown") for r in review.get("reviews", [])]
            reviewers_str = ", ".join(reviewers) or "None"
            
            report += f"| #{review['pr_number']} | {review['title']} | {categories_str} | {reviewers_str} |\n"
    
    # Add recommendations
    report += """
## Recommendations for Triage Session

Based on the review analysis, consider the following recommendations during the triage session:

1. **Focus on High Rename Impact PRs**: Ensure these are properly categorized based on their impact on Phase 2
2. **Resolve Non-Consensus PRs**: Schedule dedicated time to discuss PRs with differing opinions
3. **Balance Categories**: Ensure the number of Category A and B PRs is manageable
4. **Consider Dependencies**: Ensure dependencies between PRs are reflected in categorization

## Next Steps

1. Hold the triage session to finalize PR categories
2. Record decisions using the PR Triage Decision template
3. Generate execution plan based on final categories
4. Communicate results to PR authors
"""
    
    # Write to file
    with open(output_file, 'w') as f:
        f.write(report)
    
    print(f"Summary report saved to {output_file}")

def main():
    args = parse_args()
    
    # Aggregate reviews
    reviews = aggregate_reviews(args.reviews_dir)
    
    # Consolidate reviews by PR
    consolidated_reviews = consolidate_pr_reviews(reviews)
    
    # Save JSON output
    with open(args.output, 'w') as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "reviews": reviews,
            "consolidated": consolidated_reviews
        }, f, indent=2)
    
    print(f"Aggregated reviews saved to {args.output}")
    
    # Generate summary report
    generate_summary_report(consolidated_reviews, args.summary)

if __name__ == "__main__":
    main()