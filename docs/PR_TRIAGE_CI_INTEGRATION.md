# PR Triage CI/CD Integration

This document describes the CI/CD integration for the PR triage tools, which automates the PR triage process.

## Overview

The PR triage automation is implemented as a GitHub Actions workflow that runs:
1. When PRs are opened, synchronized, reopened, or made ready for review
2. When PR reviews are submitted (especially approvals)
3. On a daily schedule (midnight UTC)
4. Manually via workflow dispatch

The workflow collects PR data, analyzes PRs for rename impact, conflicts, and dependencies, generates statistics, and provides triage recommendations.

## Workflow Architecture

The workflow consists of the following jobs:

1. **pr-inventory**: Collects PR data from GitHub
2. **pr-analysis**: Analyzes PRs for rename impact, conflicts, and dependencies
3. **pr-statistics**: Generates statistical reports about PRs
4. **generate-triage-report**: Creates a comprehensive triage report (for scheduled/manual runs)
5. **update-pr**: Updates PR with triage information (for PR-triggered runs)

## Workflow Triggers

| Trigger | Description | Jobs Run |
|---------|-------------|----------|
| PR events | When PRs are opened, synchronized, reopened, or ready for review | All except generate-triage-report |
| PR review | When reviews are submitted | All jobs |
| Schedule | Daily at midnight UTC | All jobs |
| Manual | Via workflow dispatch | All jobs |

## Inputs and Outputs

### Inputs
- GitHub PR data
- Codebase content

### Outputs
- PR inventory data (JSON)
- Rename impact analysis (JSON)
- Conflict analysis (JSON)
- Dependency graph (JSON)
- PR statistics (HTML/JSON/CSV)
- Triage report (Markdown/HTML)
- PR comments with triage information

## Artifacts

The workflow produces the following artifacts:

1. **pr-inventory**: JSON file with collected PR data
2. **pr-analysis-results**: JSON files with analysis results (rename impact, conflicts, dependencies)
3. **pr-statistics**: Statistical reports in various formats
4. **triage-report**: Comprehensive triage report (Markdown and HTML)

## Security Considerations

The workflow uses the following permissions:
- `contents: read`: To read repository content
- `pull-requests: write`: To comment on PRs
- `checks: write`: To create check runs
- `issues: read`: To read issue data

The workflow follows the principle of least privilege and uses the default `GITHUB_TOKEN` which has limited permissions.

## Integration with Existing Workflows

This workflow complements the existing PR validation workflow (`pr-validation.yml`). While the PR validation workflow focuses on checking PR validity (title, branch naming, file size, etc.), this workflow focuses on analyzing PRs for triage purposes.

The workflows run independently but together provide a comprehensive CI/CD pipeline for PR management.

## Resource Optimization

The workflow includes the following optimizations:
- Uses dependency caching for Python
- Only runs relevant jobs based on trigger type
- Uploads artifacts with 7-day retention
- Avoids redundant runs for draft PRs

## Configuration

No additional configuration is required beyond the existing GitHub repository settings. The workflow automatically uses the repository's GitHub token for authentication.

## Scripts

The workflow uses the following scripts:

1. **pr_inventory.py**: Collects PR data
2. **analyze_rename_impact.py**: Analyzes PRs for rename impact
3. **analyze_conflicts.py**: Detects conflicts between PRs
4. **pr_dependency_graph.py**: Generates dependency graph
5. **pr_stats.py**: Generates statistical reports
6. **generate_triage_report.py**: Creates comprehensive triage report
7. **generate_pr_comment.py**: Generates PR comments with triage information

## Testing

To test the workflow:

1. **Unit Tests**: Run unit tests for the scripts
   ```bash
   pytest scripts/tests/
   ```

2. **Workflow Tests**: Test the workflow locally using [act](https://github.com/nektos/act)
   ```bash
   act -j pr-inventory
   ```

3. **Manual Testing**: Trigger the workflow manually via workflow dispatch

## Troubleshooting

If the workflow fails, check the following:

1. **Script Dependencies**: Ensure all dependencies in `requirements.txt` and `scripts/requirements.txt` are up to date
2. **GitHub API Rate Limits**: The workflow may hit GitHub API rate limits if run too frequently
3. **Permissions**: Check that the workflow has the necessary permissions
4. **Input Data**: Verify that input data is in the expected format
5. **Script Errors**: Check job logs for script errors

For detailed logs, check the GitHub Actions run logs for the specific job that failed.

## Related Documentation

- [PR Triage Implementation Guide](./PR_TRIAGE_IMPLEMENTATION_GUIDE.md)
- [PR Triage Guide](./CONEA_PR_TRIAGE_GUIDE.md)
- [PR Triage Workflow](./PR_TRIAGE_WORKFLOW.md)
- [PR Triage README](./PR_TRIAGE_README.md)