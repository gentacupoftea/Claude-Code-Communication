# Conea PR Triage Scripts

A collection of scripts for analyzing and triaging pull requests for the Conea project, with special focus on the Phase 2 rename work (changing from "shopify-mcp-server" to "conea").

## Overview

These scripts help with PR triage by:

1. Collecting metadata about open PRs
2. Analyzing impact of PRs on the Phase 2 rename work
3. Mapping dependencies between PRs
4. Detecting potential conflicts
5. Generating PR statistics
6. Creating PR comments with triage information

## Installation

Requirements:
```bash
pip install -r requirements-triage.txt
```

## Scripts

### 1. PR Inventory (`pr_inventory.py`)

Collects metadata about open PRs from GitHub.

```bash
python pr_inventory.py --repo owner/repo --output pr_inventory.json [--token GITHUB_TOKEN]
```

- `--repo`: GitHub repository (owner/repo)
- `--output`: Output JSON file path
- `--token`: GitHub personal access token (optional, can be set via GITHUB_TOKEN env var)

### 2. Analyze Rename Impact (`analyze_rename_impact.py`)

Analyzes the impact of PRs on the Phase 2 rename work.

```bash
python analyze_rename_impact.py --input pr_inventory.json --output rename_impact.json --report rename_impact_report.md
```

- `--input`: Input JSON file with PR inventory data
- `--output`: Output JSON file for rename impact analysis
- `--report`: Output Markdown file for rename impact report

### 3. PR Dependency Graph (`pr_dependency_graph.py`)

Generates a visual dependency graph showing relationships between PRs.

```bash
python pr_dependency_graph.py --input pr_inventory.json --output pr_dependencies.png [--format png|pdf|svg]
```

- `--input`: Input JSON file with PR inventory data
- `--output`: Output image file path
- `--format`: Output file format (default: png)

### 4. Analyze Conflicts (`analyze_conflicts.py`)

Analyzes potential conflicts between PRs based on file overlap.

```bash
python analyze_conflicts.py --repo owner/repo --pr-list pr_inventory.json --output conflict_analysis.json --report conflict_report.md [--token GITHUB_TOKEN]
```

- `--repo`: GitHub repository (owner/repo)
- `--pr-list`: JSON file with PR inventory data
- `--output`: Output JSON file for conflict analysis
- `--report`: Output Markdown file for conflict report
- `--token`: GitHub token (optional, can be set via GITHUB_TOKEN env var)

### 5. PR Statistics (`pr_stats.py`)

Generates statistics and visualizations for the current PR landscape.

```bash
python pr_stats.py --input pr_inventory.json --output pr_statistics.md
```

- `--input`: Input JSON file with PR inventory data
- `--output`: Output Markdown file for statistics report

### 6. Generate PR Comment (`generate_pr_comment.py`)

Creates a detailed comment for a PR with triage information.

```bash
python generate_pr_comment.py --pr-data pr_data.json --rename-impact rename_impact.json --conflicts conflicts.json --dependencies dependencies.json
```

- `--pr-data`: JSON data for the current PR
- `--rename-impact`: JSON data of rename impact analysis
- `--conflicts`: JSON data of conflict analysis
- `--dependencies`: JSON data of PR dependencies

## Workflow Example

Here's a complete example workflow:

```bash
# 1. Set up GitHub token
export GITHUB_TOKEN=your_github_token_here

# 2. Collect PR inventory
python scripts/pr_inventory.py --repo mourigenta/conea --output triage/pr_inventory.json

# 3. Analyze rename impact
python scripts/analyze_rename_impact.py --input triage/pr_inventory.json --output triage/rename_impact.json --report triage/rename_impact_report.md

# 4. Generate dependency graph
python scripts/pr_dependency_graph.py --input triage/pr_inventory.json --output triage/pr_dependencies.png

# 5. Analyze conflicts
python scripts/analyze_conflicts.py --repo mourigenta/conea --pr-list triage/pr_inventory.json --output triage/conflict_analysis.json --report triage/conflict_report.md

# 6. Generate PR statistics
python scripts/pr_stats.py --input triage/pr_inventory.json --output triage/pr_statistics.md

# 7. Generate a comment for a specific PR
python scripts/generate_pr_comment.py --pr-data pr_data.json --rename-impact triage/rename_impact.json --conflicts triage/conflict_analysis.json --dependencies triage/pr_inventory.json
```

## Triage Categories

PRs are classified into the following categories:

- **Category A**: Immediate action (v0.3.1 essential)
- **Category B**: High priority (v0.3.1 desirable)
- **Category C**: Medium priority (v0.3.2 candidates)
- **Category D**: Low priority (Future/close)

## PR Triage Process

For detailed information on the complete PR triage process, see the [PR Triage Implementation Guide](../PR_TRIAGE_IMPLEMENTATION_GUIDE.md).