# Conea PR Merge Execution Plan

## Summary
This document outlines the plan for merging 9 PRs across Category A, B, and C in the most efficient order while minimizing conflicts.

## Priority Order
Based on the detailed reviews and dependency analysis, the following merge order is recommended:

### Wave 1: Category A PRs (24 hours)
1. PR #145: Fix critical security issue in authentication module
2. PR #143: Implement package rename from shopify-mcp-server to conea
3. PR #150: Fix CI workflow issues for Phase 2 rename

### Wave 2: Category B PRs (48 hours)
1. PR #146: Implement improved caching mechanism
2. PR #144: Add Amazon credential rotation mechanism
3. PR #147: Update documentation for v0.3.0 release

### Wave 3: Category C PRs (72 hours)
1. PR #142: Fix issue with Rakuten API response handling
2. PR #148: Optimize GraphQL query performance
3. PR #149: Add support for new Amazon Marketplace countries

## Dependency Graph
```
PR #145 (Security Fix)
  |
  v
PR #143 (Package Rename) <---------------+
  |                                      |
  v                                      |
PR #150 (CI Workflows) <--------+        |
  |                             |        |
  v                             |        |
PR #146 (Caching)               |        |
  |                             |        |
  v                             |        |
PR #144 (Credential Rotation)   |        |
  |                |            |        |
  v                v            |        |
PR #147 (Docs)    PR #149 (Amazon)       |
  |                                      |
  v                                      |
PR #142 (Rakuten) <------------------------+
  |
  v
PR #148 (GraphQL)
```

## Merge Commands

### Wave 1 (Category A)
```bash
# 1. PR #145: Security fix (highest priority)
gh pr review 145 --approve -b "Security fixes approved after thorough review, see reports/20250521/pr_145_review.md for details."
gh pr merge 145 --merge -t "Fix critical security issue in authentication module"

# 2. PR #143: Package rename (main Phase 2 work)
# Note: Needs the conditional fixes first
gh pr review 143 --approve -b "Package rename approved after addressing CI issues, see reports/20250521/pr_143_review.md for details."
gh pr merge 143 --merge -t "Implement package rename from shopify-mcp-server to conea"

# 3. PR #150: CI workflow fixes
gh pr review 150 --approve -b "CI workflow changes approved to support renamed package, see reports/20250521/pr_150_review.md for details."
gh pr merge 150 --merge -t "Fix CI workflow issues for Phase 2 rename"
```

### Wave 2 (Category B)
```bash
# 1. PR #146: Caching mechanism (blocking PR)
gh pr review 146 --approve -b "Caching improvements approved, see reports/20250521/pr_146_review.md for details."
gh pr merge 146 --merge -t "Implement improved caching mechanism"

# 2. PR #144: Amazon credential rotation
gh pr review 144 --approve -b "Amazon credential rotation approved, see reports/20250521/pr_144_review.md for details."
gh pr merge 144 --merge -t "Add Amazon credential rotation mechanism"

# 3. PR #147: Documentation update
gh pr review 147 --approve -b "Documentation updates approved for v0.3.0 release, see reports/20250521/pr_147_review.md for details."
gh pr merge 147 --merge -t "Update documentation for v0.3.0 release"
```

### Wave 3 (Category C)
```bash
# 1. PR #142: Rakuten API fix (oldest PR)
gh pr review 142 --approve -b "Rakuten API fixes approved, see reports/20250521/pr_142_review.md for details."
gh pr merge 142 --merge -t "Fix issue with Rakuten API response handling"

# 2. PR #148: GraphQL optimization
gh pr review 148 --approve -b "GraphQL performance optimizations approved, see reports/20250521/pr_148_review.md for details."
gh pr merge 148 --merge -t "Optimize GraphQL query performance"

# 3. PR #149: Amazon marketplace countries
gh pr review 149 --approve -b "Amazon marketplace country support approved, see reports/20250521/pr_149_review.md for details."
gh pr merge 149 --merge -t "Add support for new Amazon Marketplace countries"
```

## Conflict Resolution Procedures

### PR #143 (Package Rename) Conflicts
This PR has the highest conflict potential and should be handled carefully.

#### Resolution Steps:
1. Check and fix all import references:
```bash
grep -r "shopify_mcp_server" --include="*.py" --include="*.yml" .
grep -r "shopify-mcp-server" --include="*.py" --include="Dockerfile" --include="*.yml" .
```

2. Update all Docker configuration files:
```bash
# Replace all occurrences in Dockerfile
sed -i '' 's/shopify_mcp_server/conea/g' Dockerfile
sed -i '' 's/shopify-mcp-server/conea/g' Dockerfile
```

3. Add backward compatibility imports for transition period:
```python
# Add to __init__.py
import sys
import warnings

# Backward compatibility
sys.modules['shopify_mcp_server'] = sys.modules['conea']
warnings.warn(
    "The 'shopify_mcp_server' package is deprecated, use 'conea' instead.",
    DeprecationWarning,
    stacklevel=2
)
```

### PR #147 (Documentation) Conflicts
This PR has significant overlap with PR #143 in documentation files.

#### Resolution Steps:
1. After PR #143 is merged, rebase PR #147:
```bash
git checkout pr-147
git fetch origin main
git rebase origin/main
```

2. Resolve conflicts favoring the newer content:
```bash
git mergetool
```

3. Check for consistency in renamed references:
```bash
grep -r "shopify_mcp_server" --include="*.md" docs/
```

4. Push the updated branch:
```bash
git push --force-with-lease origin pr-147
```

### PR #144 & PR #149 (Amazon API) Conflicts
These PRs modify the same Amazon API files.

#### Resolution Steps:
1. After PR #144 is merged, rebase PR #149:
```bash
git checkout pr-149
git fetch origin main
git rebase origin/main
```

2. Resolve conflicts preserving both credential rotation and new country support:
```bash
git mergetool
```

3. Run tests to ensure everything works together:
```bash
pytest tests/api/test_amazon.py -v
```

## Integration Testing

After each wave, perform integration testing:

```bash
# After Wave 1
git checkout main
git pull origin main
pytest -xvs  # Full test suite
flake8       # Code style checks
mypy .       # Type checking

# Deploy to staging
./scripts/deploy_staging.sh

# After Wave 2
# Repeat the same tests plus check documentation
cd docs && make html
pytest -xvs tests/amazon/ tests/utils/  # Focus on changed modules

# After Wave 3
# Final full suite test
pytest -xvs
./scripts/run_performance_tests.sh  # Verify performance improvements
```

## Emergency Stop Criteria

Immediately halt the merge process and notify team lead if:

1. Security tests fail after PR #145 merge
2. CI pipeline completely breaks after PR #143 or #150 merge
3. Production monitoring shows errors after any deploy
4. A new P0 issue is reported during the merge process

## Rollback Procedures

If needed, be prepared to revert problematic merges:

```bash
# For each PR that causes issues
git revert <commit-hash>
git push origin main
```

## Communication Plan

- Post status updates in #conea-team channel after each merge
- Tag PR authors when their PR is merged
- Notify all stakeholders after each wave is completed
- Document any issues in the merge progress report