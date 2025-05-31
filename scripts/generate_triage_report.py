#!/usr/bin/env python3
"""
Generate Triage Report for Conea Project

This script generates a comprehensive triage report from individual PR decision records.

Usage:
    python generate_triage_report.py --decisions triage/decisions/ --output PR_TRIAGE_RESULTS.md

Requirements:
    - os
    - glob
    - re
    - argparse
    - datetime
"""

import os
import glob
import re
import argparse
from datetime import datetime

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Generate PR triage report")
    parser.add_argument("--decisions", required=True, help="Directory containing PR decision files")
    parser.add_argument("--output", required=True, help="Output Markdown file for the triage report")
    return parser.parse_args()

def extract_decision_data(file_path):
    """Extract structured data from a decision record file."""
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Extract basic PR information
    pr_number = re.search(r'PR #: (\d+)', content)
    pr_number = pr_number.group(1) if pr_number else "Unknown"
    
    title = re.search(r'Title: (.*)', content)
    title = title.group(1) if title else "Unknown"
    
    author = re.search(r'Author: (.*)', content)
    author = author.group(1) if author else "Unknown"
    
    # Extract triage decisions
    category = re.search(r'Final Category: ([ABCD])', content)
    category = category.group(1) if category else "Unknown"
    
    decision = re.search(r'Decision: (.*)', content)
    decision = decision.group(1) if decision else "Unknown"
    
    target_release = re.search(r'Target Release: (.*)', content)
    target_release = target_release.group(1) if target_release else "Unknown"
    
    # Extract evaluation scores
    scores = {}
    score_table = re.search(r'\| Technical Value \| (.*?) \|', content)
    if score_table:
        scores["technical_value"] = score_table.group(1).strip()
    
    score_table = re.search(r'\| Urgency \| (.*?) \|', content)
    if score_table:
        scores["urgency"] = score_table.group(1).strip()
    
    score_table = re.search(r'\| Complexity \| (.*?) \|', content)
    if score_table:
        scores["complexity"] = score_table.group(1).strip()
    
    score_table = re.search(r'\| Dependencies \| (.*?) \|', content)
    if score_table:
        scores["dependencies"] = score_table.group(1).strip()
    
    score_table = re.search(r'\| Rename Impact \| (.*?) \|', content)
    if score_table:
        scores["rename_impact"] = score_table.group(1).strip()
    
    score_table = re.search(r'\| \*\*TOTAL\*\* \| (.*?) \|', content)
    if score_table:
        scores["total"] = score_table.group(1).strip()
    
    # Extract justification
    justification = ""
    justification_section = re.search(r'## Justification\s+\n(.*?)(?=##)', content, re.DOTALL)
    if justification_section:
        justification = justification_section.group(1).strip()
    
    # Extract action plan
    action_plan = {}
    reviewers = re.search(r'Assigned Reviewer\(s\):\s*\n(.*?)(?=\n\n|\*\*Timeline)', content, re.DOTALL)
    if reviewers:
        reviewers_list = re.findall(r'- (.*)', reviewers.group(1))
        action_plan["reviewers"] = reviewers_list
    
    timeline = re.search(r'\*\*Timeline:\*\*\s*\n(.*?)(?=\n\n|##)', content, re.DOTALL)
    if timeline:
        review_completion = re.search(r'- Review Completion: (.*)', timeline.group(1))
        if review_completion:
            action_plan["review_completion"] = review_completion.group(1)
        
        changes_due = re.search(r'- Changes Due: (.*)', timeline.group(1))
        if changes_due:
            action_plan["changes_due"] = changes_due.group(1)
        
        final_decision = re.search(r'- Final Decision: (.*)', timeline.group(1))
        if final_decision:
            action_plan["final_decision"] = final_decision.group(1)
    
    # Extract relation to Phase 2
    phase2_relation = ""
    phase2_section = re.search(r'## Relation to Phase 2 Rename\s+\n(.*?)(?=\n\n|##)', content, re.DOTALL)
    if phase2_section:
        phase2_relation = phase2_section.group(1).strip()
    
    return {
        "pr_number": pr_number,
        "title": title,
        "author": author,
        "category": category,
        "decision": decision,
        "target_release": target_release,
        "scores": scores,
        "justification": justification,
        "action_plan": action_plan,
        "phase2_relation": phase2_relation
    }

def generate_report(decisions_dir, output_file):
    """Generate a comprehensive triage report."""
    # Find all decision files
    decision_files = glob.glob(os.path.join(decisions_dir, "*.md"))
    
    if not decision_files:
        print(f"No decision files found in {decisions_dir}")
        return
    
    # Extract data from each file
    decisions = []
    for file_path in decision_files:
        try:
            decision_data = extract_decision_data(file_path)
            decisions.append(decision_data)
            print(f"Processed decision for PR #{decision_data['pr_number']}")
        except Exception as e:
            print(f"Error processing {file_path}: {e}")
    
    # Sort decisions by category then PR number
    decisions.sort(key=lambda x: (x["category"], int(x["pr_number"])))
    
    # Count PRs by category
    category_counts = {"A": 0, "B": 0, "C": 0, "D": 0}
    for decision in decisions:
        if decision["category"] in category_counts:
            category_counts[decision["category"]] += 1
    
    # Generate markdown report
    report = f"""# PR トリアージ結果レポート

**生成日時**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## 概要

トリアージセッションでは合計 **{len(decisions)}** 件のプルリクエストを評価し、以下のように分類しました：

- **A (即時処理)**: {category_counts["A"]} 件
- **B (高優先度)**: {category_counts["B"]} 件
- **C (中優先度)**: {category_counts["C"]} 件
- **D (低優先度)**: {category_counts["D"]} 件

## 名称変更フェーズ2への影響

以下のPRは名称変更フェーズ2に特に重要な影響があります：

"""
    
    # Add PRs with high rename impact
    high_impact_prs = [d for d in decisions if d["scores"].get("rename_impact", "0") >= "7"]
    if high_impact_prs:
        for pr in high_impact_prs:
            report += f"- **PR #{pr['pr_number']}**: {pr['title']} (影響度: {pr['scores'].get('rename_impact', 'Unknown')}/10)\n"
            if pr["phase2_relation"]:
                report += f"  - {pr['phase2_relation']}\n"
    else:
        report += "高い影響度を持つPRは特定されませんでした。\n"
    
    # Add detailed breakdown by category
    for category in ["A", "B", "C", "D"]:
        category_prs = [d for d in decisions if d["category"] == category]
        if category_prs:
            if category == "A":
                report += "\n## カテゴリA: 即時処理（v0.3.1必須）\n\n"
            elif category == "B":
                report += "\n## カテゴリB: 高優先度（v0.3.1望ましい）\n\n"
            elif category == "C":
                report += "\n## カテゴリC: 中優先度（v0.3.2候補）\n\n"
            else:
                report += "\n## カテゴリD: 低優先度（将来検討/クローズ）\n\n"
            
            report += "| PR # | タイトル | 決定 | 担当者 | 期限 | 評価スコア |\n"
            report += "|------|---------|------|--------|------|------------|\n"
            
            for pr in category_prs:
                reviewers = ", ".join(pr["action_plan"].get("reviewers", ["未割り当て"]))
                deadline = pr["action_plan"].get("final_decision", "未設定")
                total_score = pr["scores"].get("total", "N/A")
                
                report += f"| #{pr['pr_number']} | {pr['title']} | {pr['decision']} | {reviewers} | {deadline} | {total_score} |\n"
    
    # Add implementation plan for each category
    report += "\n## 実装計画\n\n"
    
    # Category A implementation plan
    report += "### カテゴリA (v0.3.1必須)\n\n"
    a_prs = [d for d in decisions if d["category"] == "A"]
    if a_prs:
        report += "以下のPRは即時対応が必要であり、v0.3.1リリースに必須です：\n\n"
        for i, pr in enumerate(a_prs):
            report += f"{i+1}. **PR #{pr['pr_number']}**: {pr['title']}\n"
            report += f"   - 決定: {pr['decision']}\n"
            if pr["justification"]:
                report += f"   - 理由: {pr['justification'].split('.')[0]}.\n"
            if "review_completion" in pr["action_plan"]:
                report += f"   - レビュー期限: {pr['action_plan']['review_completion']}\n"
    else:
        report += "カテゴリAのPRはありません。\n"
    
    # Category B implementation plan
    report += "\n### カテゴリB (v0.3.1望ましい)\n\n"
    b_prs = [d for d in decisions if d["category"] == "B"]
    if b_prs:
        report += "以下のPRはv0.3.1リリースに含めることが望ましいですが、必須ではありません：\n\n"
        for i, pr in enumerate(b_prs):
            report += f"{i+1}. **PR #{pr['pr_number']}**: {pr['title']}\n"
            report += f"   - 決定: {pr['decision']}\n"
            if "review_completion" in pr["action_plan"]:
                report += f"   - 目標期限: {pr['action_plan']['review_completion']}\n"
    else:
        report += "カテゴリBのPRはありません。\n"
    
    # Add recommendations
    report += "\n## 全体レコメンデーション\n\n"
    report += "1. **カテゴリAのPRを優先的に処理**: これらはv0.3.1リリースのクリティカルパスにあります\n"
    report += "2. **名称変更に高い影響を持つPRを注意深くレビュー**: フェーズ2実装との整合性を確保するため\n"
    report += "3. **依存関係の多いPRを優先**: 他の開発を進めるためのブロッカーを早期に解消\n"
    report += "4. **D.8以上の長期的PRのクローズを検討**: 長期間未更新のPRはクローズし、必要に応じて新たに作成\n"
    
    # Add next steps
    report += "\n## 次のステップ\n\n"
    report += "1. **GitHub上でPRのラベル付けを更新**: カテゴリごとにラベルを統一し、優先度を視覚化\n"
    report += "2. **デイリースタンドアップでのPRステータス確認**: 進捗の透明性を確保\n"
    report += "3. **週次レビューセッションの設定**: A・BカテゴリのPRを集中的にレビュー\n"
    report += "4. **フェーズ2実装計画との統合**: トリアージ結果をフェーズ2実装計画に反映\n"
    
    # Write report to file
    with open(output_file, 'w') as f:
        f.write(report)
    
    print(f"Triage report generated: {output_file}")

def main():
    args = parse_args()
    generate_report(args.decisions, args.output)

if __name__ == "__main__":
    main()