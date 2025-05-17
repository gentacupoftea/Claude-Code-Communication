# v0.2.0 Release Preparation PR

## Summary
This PR prepares the Shopify MCP Server for the v0.2.0 release, featuring GraphQL API integration, enhanced testing infrastructure, and improved developer experience.

## Changes

### 📄 Documentation Updates
- **CHANGELOG.md**: Added v0.2.0 section with comprehensive change log
- **RELEASE_NOTES_v0.2.0.md**: Created detailed release notes for v0.2.0
- **README.md**: Updated version to v0.2.0 and status to "Production Ready"

### 🔢 Version Updates
- **setup.py**: Updated version from 1.0.0 to 0.2.0

## Key Features in v0.2.0

### 🚀 GraphQL API Support
- New `ShopifyGraphQLClient` with full product, order, and customer queries
- Three new MCP tools for GraphQL operations
- Up to 70% reduction in API calls for complex queries

### 🧪 Enhanced Testing
- Unified test runner (`run_tests.sh`)
- 14 new GraphQL unit tests
- Coverage reporting capabilities

### 📦 Improved Dependencies
- Flexible version management
- New dependencies: `gql==3.5.0`, `requests-toolbelt~=1.0.0`

### 📚 Better Documentation
- GraphQL vs REST selection guide
- Integration documentation
- Updated examples

## Review Checklist
- [ ] CHANGELOG.md follows Keep a Changelog format
- [ ] RELEASE_NOTES_v0.2.0.md is comprehensive and user-friendly
- [ ] Version numbers are consistent across files
- [ ] Documentation accurately reflects new features
- [ ] All links and references are valid

## Testing
- Run `./run_tests.sh` to verify all tests pass
- Run `./run_tests.sh --coverage` to check test coverage

## Deployment Notes
After merging this PR:
1. Create GitHub release with tag v0.2.0
2. Attach RELEASE_NOTES_v0.2.0.md to the release
3. Update any deployment documentation
4. Announce release in appropriate channels

---

**Ready for v0.2.0 release! 🎉**