# PR #150 Review: Fix CI workflow issues for Phase 2 rename

## Overview
This PR updates the GitHub Actions workflows to support the package rename from shopify-mcp-server to conea. It's essential for maintaining CI/CD functionality after the rename.

## Files Changed
- `.github/workflows/ci.yml`
- `.github/workflows/test.yml`
- `.github/workflows/e2e.yml`
- `.github/workflows/pr-validation.yml`

## Workflow Syntax Validation
- ✅ YAML syntax is valid in all files
- ✅ GitHub Actions step references are correct
- ✅ Job dependencies are properly configured

## Rename-Related Changes
- Package name references updated in test commands
- Docker image references updated
- Environment variable names standardized to use CONEA prefix
- Import paths in test scripts corrected

## Technical Review

### CI Workflow (ci.yml)
- Build steps properly updated to use new package name
- Docker build context correctly modified
- All job names and step descriptions updated for consistency

### Test Workflow (test.yml)
- Test commands updated to reference new module structure
- Coverage report configuration correctly modified
- Test matrix configuration properly updated

### E2E Tests (e2e.yml)
- Service configuration updated with new naming
- Integration test commands updated
- Environment setup scripts fixed

### PR Validation (pr-validation.yml)
- Validation steps correctly reference new package
- Title validation regex updated to accommodate new naming convention
- Code quality checks updated with new patterns

## Performance Impacts
- No significant changes to workflow execution time
- No additional GitHub Action minutes required
- Maintains same level of validation as before

## Dependencies
- Directly depends on PR #143 (must be merged first)
- Must be merged before any other PRs to ensure CI functionality

## Recommendation
**APPROVE WITH CONDITION**: Should be merged immediately after PR #143 is merged.

## After-Merge Actions
1. Verify all CI workflows run successfully after merge
2. Update team documentation on CI/CD processes
3. Ensure all other open PRs rebase after this change to get updated workflows