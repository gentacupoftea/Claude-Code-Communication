#!/usr/bin/env python3
"""
Prepare Triage Session Materials for Conea Project

This script aggregates all PR analysis results and prepares a comprehensive
document for use during the triage session.

Usage:
    python prepare_triage_session.py --reviews aggregated_reviews.json
                                    --conflicts conflict_analysis.json
                                    --rename-impact rename_impact.json
                                    --output triage_session_materials.md

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
    parser = argparse.ArgumentParser(description="Prepare triage session materials")
    parser.add_argument("--reviews", required=True, help="Aggregated reviews JSON file")
    parser.add_argument("--conflicts", required=True, help="Conflict analysis JSON file")
    parser.add_argument("--rename-impact", required=True, help="Rename impact JSON file")
    parser.add_argument("--output", required=True, help="Output Markdown file for triage session materials")
    parser.add_argument("--inventory", help="PR inventory JSON file (optional)")
    return parser.parse_args()

def load_json_data(file_path):
    """Load JSON data from file if it exists."""
    if not os.path.exists(file_path):
        print(f"Warning: {file_path} does not exist. Creating placeholder data.")
        return {"placeholder": True, "message": f"No data available from {file_path}"}
    
    try:
        with open(file_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading data from {file_path}: {e}")
        return {"error": str(e)}

def load_aggregated_reviews(file_path):
    """Load aggregated review data, or create a placeholder if not available."""
    if not os.path.exists(file_path):
        print(f"Warning: {file_path} does not exist. Using PR inventory if available.")
        return None
    
    try:
        with open(file_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading reviews: {e}")
        return None

def calculate_initial_scores(pr_data, rename_impact_data, conflict_data):
    """Calculate initial scores for each PR based on available data."""
    scores = {}
    
    # Find rename impact scores
    rename_impact_by_pr = {}
    if not isinstance(rename_impact_data, dict) or "placeholder" not in rename_impact_data:
        for pr_impact in rename_impact_data:
            rename_impact_by_pr[pr_impact["pr_number"]] = {
                "score": pr_impact["final_score"],
                "category": pr_impact["impact_category"]
            }
    
    # Find conflict information
    conflict_count_by_pr = {}
    high_conflict_prs = set()
    if not isinstance(conflict_data, dict) or "placeholder" not in conflict_data:
        for conflict in conflict_data.get("conflicts", []):
            pr1 = conflict["pr1"]["number"]
            pr2 = conflict["pr2"]["number"]
            
            # Count conflicts for each PR
            if pr1 not in conflict_count_by_pr:
                conflict_count_by_pr[pr1] = 0
            if pr2 not in conflict_count_by_pr:
                conflict_count_by_pr[pr2] = 0
            
            conflict_count_by_pr[pr1] += 1
            conflict_count_by_pr[pr2] += 1
            
            # Track high conflict PRs
            if conflict["conflict_level"] == "high":
                high_conflict_prs.add(pr1)
                high_conflict_prs.add(pr2)
    
    # Calculate scores for each PR
    for pr in pr_data["pull_requests"]:
        pr_number = pr["number"]
        
        # Basic metrics
        complexity = pr.get("complexity", 5)  # Default to medium complexity
        
        # Get rename impact score (0-10)
        rename_impact = rename_impact_by_pr.get(pr_number, {}).get("score", pr["rename_impact"]["score"])
        
        # Calculate conflict factor (0-10, higher means more conflicts)
        conflict_count = conflict_count_by_pr.get(pr_number, 0)
        conflict_factor = min(10, conflict_count * 2)  # Scale conflict count
        
        # Apply penalty for high conflicts
        if pr_number in high_conflict_prs:
            conflict_factor += 2  # Additional penalty
        
        # Adjust conflict factor based on mergeable state if available
        mergeable_state = conflict_data.get("mergeable_states", {}).get(str(pr_number), {})
        if mergeable_state.get("mergeable_state") == "dirty":
            conflict_factor += 3  # Unmergeable PRs get higher conflict factor
        
        # Calculate technical value (placeholder - would come from reviews)
        # For now, we'll use inverse of complexity as a proxy
        technical_value = 10 - (complexity * 0.5)  # Higher complexity might indicate more value
        
        # Calculate urgency based on age and activity
        days_open = pr.get("created_days_ago", 0)
        days_since_update = pr.get("updated_days_ago", 0)
        
        # Older PRs are more urgent, but inactive ones less so
        urgency_base = min(10, days_open / 10)  # Scale days open
        activity_penalty = min(5, days_since_update / 5)  # Penalty for inactivity
        urgency = max(0, urgency_base - activity_penalty)
        
        # Calculate final scores
        # Lower complexity score is better for processing (inverted from raw complexity)
        complexity_score = 10 - complexity
        
        # Lower conflict score is better
        conflict_score = 10 - conflict_factor
        
        # For dependencies, fewer is generally better
        dependency_count = len(pr.get("dependencies", []))
        dependency_score = 10 - min(10, dependency_count * 2)
        
        # Final score calculation with weights
        final_score = (
            (technical_value * 0.3) +  # Technical value: 30%
            (urgency * 0.2) +          # Urgency: 20%
            (complexity_score * 0.15) + # Complexity: 15%
            (conflict_score * 0.15) +   # Conflicts: 15%
            (rename_impact * 0.2)       # Rename impact: 20%
        )
        
        # Normalize to 0-10 scale
        final_score = max(0, min(10, final_score))
        
        # Determine category based on score
        if final_score >= 8.0:
            category = "A"
        elif final_score >= 6.0:
            category = "B"
        elif final_score >= 4.0:
            category = "C"
        else:
            category = "D"
        
        # Save scores
        scores[pr_number] = {
            "technical_value": technical_value,
            "urgency": urgency,
            "complexity": complexity,
            "complexity_score": complexity_score,
            "conflict_factor": conflict_factor,
            "conflict_score": conflict_score,
            "rename_impact": rename_impact,
            "dependency_count": dependency_count,
            "dependency_score": dependency_score,
            "final_score": final_score,
            "category": category
        }
    
    return scores

def generate_session_materials(pr_data, reviews_data, conflict_data, rename_impact_data, scores, output_file):
    """Generate comprehensive triage session materials."""
    # Sort PRs by category and then score
    prs_with_scores = []
    for pr in pr_data["pull_requests"]:
        pr_number = pr["number"]
        pr_scores = scores.get(pr_number, {})
        
        # Create a copy of the PR with scores
        pr_copy = dict(pr)
        pr_copy["scores"] = pr_scores
        prs_with_scores.append(pr_copy)
    
    # Sort by category and then score within category
    sorted_prs = sorted(
        prs_with_scores,
        key=lambda x: (x["scores"].get("category", "D"), -x["scores"].get("final_score", 0))
    )
    
    # Group PRs by category
    prs_by_category = {
        "A": [],
        "B": [],
        "C": [],
        "D": []
    }
    
    for pr in sorted_prs:
        category = pr["scores"].get("category", "D")
        prs_by_category[category].append(pr)
    
    # Generate the session materials
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    materials = f"""# Conea PR Triage Session Materials
Generated: {now}

## Session Overview

**Date**: {datetime.now().strftime("%Y-%m-%d")}  
**Time**: 10:00-12:00 JST  
**Location**: オンラインミーティングルーム (会議ID: conea-triage-0524)  
**Participants**: 開発チーム全員、PM、QAリード

**Session Agenda**:
1. 10:00-10:10: イントロダクションとセッション目標の確認
2. 10:10-11:20: PR別のレビューと議論（各PR 5-7分）
3. 11:20-11:50: カテゴリ分類と最終決定
4. 11:50-12:00: まとめと次のステップの確認

## PR Summary

Total PRs: {len(pr_data["pull_requests"])}

| Category | Count | Description | Action |
|----------|-------|-------------|--------|
| A | {len(prs_by_category["A"])} | 即時処理（v0.3.1必須） | Prioritize for immediate action |
| B | {len(prs_by_category["B"])} | 高優先度（v0.3.1望ましい） | Include in v0.3.1 if possible |
| C | {len(prs_by_category["C"])} | 中優先度（v0.3.2候補） | Consider for v0.3.2 |
| D | {len(prs_by_category["D"])} | 低優先度（将来検討/クローズ） | Defer or close |

## Evaluation Criteria

PRs are evaluated based on the following criteria:

1. **技術的価値** (30%): コア機能への貢献度
2. **緊急度** (20%): リリースブロッカーか否か
3. **複雑度** (15%): 変更の規模と影響範囲
4. **コンフリクト** (15%): 他PRとのコンフリクト可能性
5. **名称変更への影響** (20%): フェーズ2との整合性

## Category A PRs (即時処理)

These PRs are considered essential for v0.3.1 and should be prioritized:

| PR # | Title | Score | Key Factors | Notes |
|------|-------|-------|-------------|-------|
"""
    
    # Add category A PRs
    for pr in prs_by_category["A"]:
        pr_num = pr["number"]
        scores = pr["scores"]
        
        # Format key factors
        key_factors = []
        if scores["technical_value"] >= 8:
            key_factors.append("High Value")
        if scores["urgency"] >= 8:
            key_factors.append("Urgent")
        if scores["rename_impact"] >= 7:
            key_factors.append("High Rename Impact")
        if scores["conflict_factor"] >= 6:
            key_factors.append("Conflict Risk")
        
        key_factors_str = ", ".join(key_factors) or "Balanced factors"
        
        # Add notes based on data analysis
        notes = []
        if scores["rename_impact"] >= 7:
            notes.append("Critical for Phase 2")
        if scores["conflict_factor"] >= 6:
            notes.append("Resolve conflicts first")
        
        notes_str = " / ".join(notes) or "-"
        
        # Add to table
        materials += f"| #{pr_num} | {pr['title']} | {scores['final_score']:.1f} | {key_factors_str} | {notes_str} |\n"
    
    # Add category B PRs
    materials += """
## Category B PRs (高優先度)

These PRs are high priority and desirable for v0.3.1, but not essential:

| PR # | Title | Score | Key Factors | Notes |
|------|-------|-------|-------------|-------|
"""
    
    for pr in prs_by_category["B"]:
        pr_num = pr["number"]
        scores = pr["scores"]
        
        # Format key factors
        key_factors = []
        if scores["technical_value"] >= 7:
            key_factors.append("Good Value")
        if scores["urgency"] >= 6:
            key_factors.append("Somewhat Urgent")
        if scores["rename_impact"] >= 5:
            key_factors.append("Medium Rename Impact")
        if scores["conflict_factor"] >= 4:
            key_factors.append("Some Conflict Risk")
        
        key_factors_str = ", ".join(key_factors) or "Balanced factors"
        
        # Add notes based on data analysis
        notes = []
        if scores["rename_impact"] >= 5:
            notes.append("Important for Phase 2")
        if scores["conflict_factor"] >= 4:
            notes.append("Check for conflicts")
        
        notes_str = " / ".join(notes) or "-"
        
        # Add to table
        materials += f"| #{pr_num} | {pr['title']} | {scores['final_score']:.1f} | {key_factors_str} | {notes_str} |\n"
    
    # Add category C PRs
    materials += """
## Category C PRs (中優先度)

These PRs are medium priority and candidates for v0.3.2:

| PR # | Title | Score | Key Factors | Notes |
|------|-------|-------|-------------|-------|
"""
    
    for pr in prs_by_category["C"]:
        pr_num = pr["number"]
        scores = pr["scores"]
        
        # Format key factors
        key_factors = []
        if scores["technical_value"] >= 6:
            key_factors.append("Moderate Value")
        if scores["rename_impact"] >= 4:
            key_factors.append("Some Rename Impact")
        if scores["dependency_count"] > 0:
            key_factors.append(f"Has {scores['dependency_count']} Dependencies")
        
        key_factors_str = ", ".join(key_factors) or "Balanced factors"
        
        # Add to table
        materials += f"| #{pr_num} | {pr['title']} | {scores['final_score']:.1f} | {key_factors_str} | - |\n"
    
    # Add category D PRs
    materials += """
## Category D PRs (低優先度)

These PRs are low priority and should be deferred or closed:

| PR # | Title | Score | Key Factors | Notes |
|------|-------|-------|-------------|-------|
"""
    
    for pr in prs_by_category["D"]:
        pr_num = pr["number"]
        scores = pr["scores"]
        
        # Format key factors
        key_factors = []
        if scores["technical_value"] < 4:
            key_factors.append("Low Value")
        if scores["urgency"] < 3:
            key_factors.append("Not Urgent")
        if pr.get("created_days_ago", 0) > 60:
            key_factors.append("Very Old")
        if pr.get("updated_days_ago", 0) > 30:
            key_factors.append("Inactive")
        
        key_factors_str = ", ".join(key_factors) or "Balanced factors"
        
        # Add notes
        notes = "Consider closing" if pr.get("updated_days_ago", 0) > 30 else "-"
        
        # Add to table
        materials += f"| #{pr_num} | {pr['title']} | {scores['final_score']:.1f} | {key_factors_str} | {notes} |\n"
    
    # Add PR discussion guides
    materials += """
## PR Discussion Guide

For each PR, use the following structure for discussion:

1. **プレゼンテーション** (1-2分/PR)
   - PRの概要と目的
   - コードの主要な変更点
   - レビュー結果のサマリー

2. **質疑応答** (1-2分/PR)
   - 技術的疑問の解消
   - 実装上の懸念事項
   - 依存関係の確認

3. **カテゴリ提案** (30秒/PR)
   - レビュアーによるカテゴリ提案
   - 根拠の説明

4. **決定** (30秒/PR)
   - 最終カテゴリ決定
   - アクションアイテムの確認
   - 担当者と期限の設定

## Key Rename Impact Considerations

The following PRs have significant rename impact and require special attention:

| PR # | Title | Rename Impact | Key Files |
|------|-------|--------------|-----------|
"""
    
    # Add high rename impact PRs
    high_impact_prs = [pr for pr in sorted_prs if pr["scores"]["rename_impact"] >= 7]
    for pr in high_impact_prs:
        pr_num = pr["number"]
        
        # Find key files from rename impact data
        key_files = []
        if not isinstance(rename_impact_data, dict) or "placeholder" not in rename_impact_data:
            for pr_impact in rename_impact_data:
                if pr_impact["pr_number"] == pr_num:
                    for file_info in pr_impact.get("high_impacted_files", [])[:3]:  # Top 3 files
                        key_files.append(file_info.get("file", "Unknown"))
                    break
        
        key_files_str = ", ".join(key_files[:3]) or "Not specified"
        if len(key_files) > 3:
            key_files_str += f" +{len(key_files) - 3} more"
        
        materials += f"| #{pr_num} | {pr['title']} | {pr['scores']['rename_impact']:.1f}/10 | {key_files_str} |\n"
    
    # Add conflict information
    materials += """
## Conflict Considerations

The following PR pairs have high conflict potential and should be handled carefully:

| PR #1 | PR #2 | Overlapping Files | Recommendation |
|-------|-------|-------------------|----------------|
"""
    
    # Add high conflict pairs
    if not isinstance(conflict_data, dict) or "placeholder" not in conflict_data:
        high_conflicts = [c for c in conflict_data.get("conflicts", []) if c["conflict_level"] == "high"]
        for conflict in high_conflicts:
            pr1_num = conflict["pr1"]["number"]
            pr2_num = conflict["pr2"]["number"]
            overlapping = len(conflict["overlapping_files"])
            
            recommendation = "Prioritize one PR"
            cat1 = scores.get(pr1_num, {}).get("category", "?")
            cat2 = scores.get(pr2_num, {}).get("category", "?")
            
            if cat1 < cat2:  # A < B < C < D
                recommendation = f"Prioritize #{pr1_num} (Category {cat1})"
            elif cat2 < cat1:
                recommendation = f"Prioritize #{pr2_num} (Category {cat2})"
            
            materials += f"| #{pr1_num} | #{pr2_num} | {overlapping} | {recommendation} |\n"
    
    # Add dependency considerations
    materials += """
## Dependency Considerations

The following PRs have significant dependencies that affect their processing order:

| PR # | Title | Depends On | Blocks | Recommendation |
|------|-------|------------|--------|----------------|
"""
    
    # Add PRs with dependencies
    prs_with_deps = [pr for pr in sorted_prs if len(pr.get("dependencies", [])) > 0]
    for pr in prs_with_deps:
        pr_num = pr["number"]
        deps = pr.get("dependencies", [])
        deps_str = ", ".join([f"#{d}" for d in deps])
        
        # Find PRs that this PR blocks (PRs that depend on this one)
        blocks = []
        for other_pr in sorted_prs:
            if pr_num in other_pr.get("dependencies", []):
                blocks.append(other_pr["number"])
        
        blocks_str = ", ".join([f"#{b}" for b in blocks]) or "None"
        
        # Determine recommendation
        recommendation = "Process dependencies first"
        if blocks:
            if scores.get(pr_num, {}).get("category", "D") <= "B":  # A or B
                recommendation = "Prioritize to unblock others"
        
        materials += f"| #{pr_num} | {pr['title']} | {deps_str} | {blocks_str} | {recommendation} |\n"
    
    # Add session workflow
    materials += """
## Triage Session Workflow

1. **Introduction** (10 minutes)
   - Review agenda and goals
   - Explain evaluation criteria
   - Review PR categories

2. **Category A Candidate Discussion** (30 minutes)
   - Review pre-selected Category A PRs
   - Discuss technical value and impact
   - Finalize Category A assignments

3. **Category B Candidate Discussion** (30 minutes)
   - Review pre-selected Category B PRs
   - Discuss value vs. complexity
   - Finalize Category B assignments

4. **Category C/D Discussion** (20 minutes)
   - Review remaining PRs
   - Identify any miscategorized PRs
   - Make defer/close decisions

5. **Rename Impact Special Consideration** (15 minutes)
   - Review high rename impact PRs
   - Ensure proper categorization
   - Identify special handling requirements

6. **Execution Planning** (15 minutes)
   - Confirm merge order strategy
   - Assign owners and deadlines
   - Establish follow-up process

## Post-Triage Actions

1. Update GitHub PR labels and comments
2. Update project board with categories
3. Notify PR authors of decisions
4. Schedule review sessions for Category A PRs
5. Prepare detailed execution plan document
6. Coordinate with Phase 2 rename implementation team

## Decision Recording

For each PR, record the final decision using the PR Triage Decision template:

```bash
python scripts/generate_decision.py --pr-number <PR_NUMBER> --category <A/B/C/D> \\
    --reasoning "Decision rationale" --action <action> --assignee "Name" \\
    --deadline "YYYY-MM-DD" --output pr-triage/decisions/pr_<PR_NUMBER>_decision.md
```

## Final Report Generation

After all decisions are recorded, generate the final triage report:

```bash
python scripts/generate_triage_report.py --decisions-dir pr-triage/decisions \\
    --inventory pr-triage/pr_inventory.json \\
    --output PR_TRIAGE_REPORT.md
```
"""
    
    # Write to file
    with open(output_file, 'w') as f:
        f.write(materials)
    
    print(f"Triage session materials saved to {output_file}")

def main():
    args = parse_args()
    
    # Load PR inventory data
    inventory_data = None
    if args.inventory and os.path.exists(args.inventory):
        inventory_data = load_json_data(args.inventory)
    
    if not inventory_data:
        print("Error: PR inventory data is required")
        sys.exit(1)
    
    # Load review data
    reviews_data = load_aggregated_reviews(args.reviews)
    
    # Load conflict data
    conflict_data = load_json_data(args.conflicts)
    
    # Load rename impact data
    rename_impact_data = load_json_data(args.rename_impact)
    
    # Calculate initial scores
    scores = calculate_initial_scores(inventory_data, rename_impact_data, conflict_data)
    
    # Generate session materials
    generate_session_materials(
        inventory_data,
        reviews_data,
        conflict_data,
        rename_impact_data,
        scores,
        args.output
    )

if __name__ == "__main__":
    main()