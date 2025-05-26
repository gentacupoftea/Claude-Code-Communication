"""
Tests for GitHubIntegration
GitHub統合機能の包括的テストスイート
"""

import pytest
import asyncio
import os
import tempfile
import json
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime, timedelta
from pathlib import Path

from autonomous_system.integrations.github_integration import (
    GitHubIntegration,
    GitHubRepo,
    PullRequest,
    Commit,
    GitHubIssue,
    PRStatus,
    ReviewState
)


class TestGitHubIntegration:
    """GitHubIntegration unit tests"""
    
    @pytest.mark.unit
    def test_initialization_with_token(self, temp_dir, mock_env_vars):
        """Test GitHub integration initialization with token"""
        github = GitHubIntegration(
            github_token="test_token",
            workspace_dir=temp_dir
        )
        
        assert github.github_token == "test_token"
        assert github.workspace_dir == Path(temp_dir)
        assert "Authorization" in github.headers
        assert github.headers["Authorization"] == "token test_token"
        assert github.max_retries == 3
        assert github.rate_limit_remaining == 5000
    
    @pytest.mark.unit
    def test_initialization_from_env(self, temp_dir, mock_env_vars):
        """Test initialization using environment variable"""
        github = GitHubIntegration(workspace_dir=temp_dir)
        
        assert github.github_token == "test_github_token"  # From mock_env_vars
        assert github.workspace_dir == Path(temp_dir)
    
    @pytest.mark.unit
    def test_initialization_no_token(self, temp_dir):
        """Test initialization without token raises error"""
        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(ValueError, match="GitHub token is required"):
                GitHubIntegration(workspace_dir=temp_dir)
    
    @pytest.mark.async_test
    async def test_api_request_success(self, temp_dir, mock_env_vars):
        """Test successful API request"""
        github = GitHubIntegration(github_token="test_token", workspace_dir=temp_dir)
        
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"name": "test-repo"}
        mock_response.headers = {
            "x-ratelimit-remaining": "4999",
            "x-ratelimit-reset": str(int((datetime.now() + timedelta(hours=1)).timestamp()))
        }
        
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.request.return_value = mock_response
            mock_client_class.return_value.__aenter__.return_value = mock_client
            
            result = await github._make_api_request("GET", "repos/owner/repo")
            
            assert result == {"name": "test-repo"}
            assert github.rate_limit_remaining == 4999
    
    @pytest.mark.async_test
    async def test_api_request_rate_limit(self, temp_dir, mock_env_vars):
        """Test API request with rate limit handling"""
        github = GitHubIntegration(github_token="test_token", workspace_dir=temp_dir)
        github.rate_limit_remaining = 5  # Low limit
        github.rate_limit_reset = datetime.now() + timedelta(seconds=0.1)
        
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"success": True}
        mock_response.headers = {}
        
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.request.return_value = mock_response
            mock_client_class.return_value.__aenter__.return_value = mock_client
            
            # Should wait for rate limit reset
            start_time = datetime.now()
            await github._make_api_request("GET", "test")
            elapsed = (datetime.now() - start_time).total_seconds()
            
            # Should have waited briefly
            assert elapsed >= 0.1
    
    @pytest.mark.async_test
    async def test_api_request_retry_on_error(self, temp_dir, mock_env_vars):
        """Test API request retry on network error"""
        github = GitHubIntegration(github_token="test_token", workspace_dir=temp_dir)
        github.retry_delay = 0.01  # Fast retry for testing
        
        call_count = 0
        
        async def mock_request(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise Exception("Network error")
            
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"success": True}
            mock_response.headers = {}
            return mock_response
        
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.request.side_effect = mock_request
            mock_client_class.return_value.__aenter__.return_value = mock_client
            
            result = await github._make_api_request("GET", "test")
            assert result == {"success": True}
            assert call_count == 3  # Should have retried twice
    
    @pytest.mark.async_test
    async def test_get_repository_info(self, temp_dir, mock_env_vars):
        """Test repository info retrieval"""
        github = GitHubIntegration(github_token="test_token", workspace_dir=temp_dir)
        
        mock_repo_data = {
            "owner": {"login": "test-owner"},
            "name": "test-repo",
            "html_url": "https://github.com/test-owner/test-repo",
            "default_branch": "main",
            "private": False
        }
        
        with patch.object(github, '_make_api_request', return_value=mock_repo_data):
            repo = await github.get_repository_info("test-owner", "test-repo")
            
            assert isinstance(repo, GitHubRepo)
            assert repo.owner == "test-owner"
            assert repo.name == "test-repo"
            assert repo.url == "https://github.com/test-owner/test-repo"
            assert repo.default_branch == "main"
            assert repo.private is False
    
    @pytest.mark.async_test
    async def test_clone_repository(self, temp_dir, mock_env_vars, mock_github_api):
        """Test repository cloning"""
        github = GitHubIntegration(github_token="test_token", workspace_dir=temp_dir)
        repo = mock_github_api['repo']
        
        mock_git_repo = Mock()
        mock_git_repo.git.checkout = Mock()
        
        with patch('git.Repo.clone_from', return_value=mock_git_repo) as mock_clone:
            clone_path = await github.clone_repository(repo, branch="feature-branch")
            
            assert clone_path == Path(temp_dir) / repo.name
            mock_clone.assert_called_once()
            mock_git_repo.git.checkout.assert_called_with("feature-branch")
    
    @pytest.mark.async_test
    async def test_create_branch(self, temp_dir, mock_env_vars, mock_github_api):
        """Test branch creation"""
        github = GitHubIntegration(github_token="test_token", workspace_dir=temp_dir)
        repo = mock_github_api['repo']
        
        mock_ref_data = {"object": {"sha": "abc123"}}
        mock_branch_result = {"ref": "refs/heads/new-feature", "object": {"sha": "abc123"}}
        
        with patch.object(github, '_make_api_request', side_effect=[mock_ref_data, mock_branch_result]):
            result = await github.create_branch(repo, "new-feature", "main")
            
            assert result == mock_branch_result
    
    @pytest.mark.async_test
    async def test_list_branches(self, temp_dir, mock_env_vars, mock_github_api):
        """Test branch listing"""
        github = GitHubIntegration(github_token="test_token", workspace_dir=temp_dir)
        repo = mock_github_api['repo']
        
        mock_branches = [
            {"name": "main", "commit": {"sha": "abc123"}},
            {"name": "feature-1", "commit": {"sha": "def456"}}
        ]
        
        with patch.object(github, '_make_api_request', return_value=mock_branches):
            branches = await github.list_branches(repo)
            
            assert len(branches) == 2
            assert branches[0]["name"] == "main"
            assert branches[1]["name"] == "feature-1"
    
    @pytest.mark.async_test
    async def test_create_commit(self, temp_dir, mock_env_vars, mock_github_api):
        """Test commit creation"""
        github = GitHubIntegration(github_token="test_token", workspace_dir=temp_dir)
        repo = mock_github_api['repo']
        
        # Mock API responses
        mock_ref = {"object": {"sha": "base_sha"}}
        mock_base_commit = {"tree": {"sha": "base_tree_sha"}}
        mock_blob = {"sha": "blob_sha"}
        mock_tree = {"sha": "tree_sha"}
        mock_commit = {
            "sha": "commit_sha",
            "author": {"date": "2023-01-01T12:00:00Z"}
        }
        
        api_responses = [mock_ref, mock_base_commit, mock_blob, mock_tree, mock_commit, {}]
        
        with patch.object(github, '_make_api_request', side_effect=api_responses):
            files = {"test.py": "print('hello world')"}
            commit = await github.create_commit(
                repo, "feature-branch", "Add test file", files,
                author_name="Test Author", author_email="test@example.com"
            )
            
            assert isinstance(commit, Commit)
            assert commit.sha == "commit_sha"
            assert commit.message == "Add test file"
            assert commit.author == "Test Author"
            assert commit.files_changed == ["test.py"]
    
    @pytest.mark.async_test
    async def test_get_commit_history(self, temp_dir, mock_env_vars, mock_github_api):
        """Test commit history retrieval"""
        github = GitHubIntegration(github_token="test_token", workspace_dir=temp_dir)
        repo = mock_github_api['repo']
        
        mock_commits = [
            {
                "sha": "commit1",
                "commit": {
                    "message": "First commit",
                    "author": {
                        "name": "Author 1",
                        "date": "2023-01-01T12:00:00Z"
                    }
                }
            },
            {
                "sha": "commit2",
                "commit": {
                    "message": "Second commit",
                    "author": {
                        "name": "Author 2",
                        "date": "2023-01-02T12:00:00Z"
                    }
                }
            }
        ]
        
        with patch.object(github, '_make_api_request', return_value=mock_commits):
            commits = await github.get_commit_history(repo, "main", limit=10)
            
            assert len(commits) == 2
            assert commits[0].sha == "commit1"
            assert commits[0].message == "First commit"
            assert commits[1].sha == "commit2"
            assert commits[1].message == "Second commit"
    
    @pytest.mark.async_test
    async def test_create_pull_request(self, temp_dir, mock_env_vars, mock_github_api):
        """Test pull request creation"""
        github = GitHubIntegration(github_token="test_token", workspace_dir=temp_dir)
        repo = mock_github_api['repo']
        
        mock_pr_data = {
            "number": 123,
            "title": "Test PR",
            "body": "Test description",
            "state": "open",
            "head": {"ref": "feature-branch"},
            "base": {"ref": "main"},
            "user": {"login": "test-user"},
            "created_at": "2023-01-01T12:00:00Z",
            "updated_at": "2023-01-01T12:00:00Z",
            "mergeable": True
        }
        
        with patch.object(github, '_make_api_request', return_value=mock_pr_data):
            pr = await github.create_pull_request(
                repo, "Test PR", "Test description", "feature-branch", "main"
            )
            
            assert isinstance(pr, PullRequest)
            assert pr.number == 123
            assert pr.title == "Test PR"
            assert pr.state == PRStatus.OPEN
            assert pr.head_branch == "feature-branch"
            assert pr.base_branch == "main"
    
    @pytest.mark.async_test
    async def test_get_pull_request(self, temp_dir, mock_env_vars, mock_github_api):
        """Test pull request retrieval"""
        github = GitHubIntegration(github_token="test_token", workspace_dir=temp_dir)
        repo = mock_github_api['repo']
        
        mock_pr_data = {
            "number": 123,
            "title": "Test PR",
            "body": "Test description",
            "state": "open",
            "head": {"ref": "feature-branch"},
            "base": {"ref": "main"},
            "user": {"login": "test-user"},
            "created_at": "2023-01-01T12:00:00Z",
            "updated_at": "2023-01-01T12:00:00Z",
            "mergeable": True
        }
        
        with patch.object(github, '_make_api_request', return_value=mock_pr_data):
            pr = await github.get_pull_request(repo, 123)
            
            assert pr.number == 123
            assert pr.title == "Test PR"
            assert pr.mergeable is True
    
    @pytest.mark.async_test
    async def test_list_pull_requests(self, temp_dir, mock_env_vars, mock_github_api):
        """Test pull request listing"""
        github = GitHubIntegration(github_token="test_token", workspace_dir=temp_dir)
        repo = mock_github_api['repo']
        
        mock_prs = [
            {
                "number": 123,
                "title": "First PR",
                "body": "First description",
                "state": "open",
                "head": {"ref": "feature-1"},
                "base": {"ref": "main"},
                "user": {"login": "user1"},
                "created_at": "2023-01-01T12:00:00Z",
                "updated_at": "2023-01-01T12:00:00Z",
                "mergeable": True
            },
            {
                "number": 124,
                "title": "Second PR",
                "body": "Second description",
                "state": "closed",
                "head": {"ref": "feature-2"},
                "base": {"ref": "main"},
                "user": {"login": "user2"},
                "created_at": "2023-01-02T12:00:00Z",
                "updated_at": "2023-01-02T12:00:00Z",
                "mergeable": False
            }
        ]
        
        with patch.object(github, '_make_api_request', return_value=mock_prs):
            prs = await github.list_pull_requests(repo, state="all")
            
            assert len(prs) == 2
            assert prs[0].number == 123
            assert prs[0].state == PRStatus.OPEN
            assert prs[1].number == 124
            assert prs[1].state == PRStatus.CLOSED
    
    @pytest.mark.async_test
    async def test_merge_pull_request(self, temp_dir, mock_env_vars, mock_github_api):
        """Test pull request merging"""
        github = GitHubIntegration(github_token="test_token", workspace_dir=temp_dir)
        repo = mock_github_api['repo']
        
        mock_merge_result = {
            "sha": "merge_sha",
            "merged": True,
            "message": "Pull request successfully merged"
        }
        
        with patch.object(github, '_make_api_request', return_value=mock_merge_result):
            result = await github.merge_pull_request(
                repo, 123, merge_method="squash",
                commit_title="Merge PR #123",
                commit_message="Squash and merge feature"
            )
            
            assert result["merged"] is True
            assert result["sha"] == "merge_sha"
    
    @pytest.mark.async_test
    async def test_request_review(self, temp_dir, mock_env_vars, mock_github_api):
        """Test review request"""
        github = GitHubIntegration(github_token="test_token", workspace_dir=temp_dir)
        repo = mock_github_api['repo']
        
        mock_review_result = {
            "requested_reviewers": [{"login": "reviewer1"}, {"login": "reviewer2"}]
        }
        
        with patch.object(github, '_make_api_request', return_value=mock_review_result):
            result = await github.request_review(
                repo, 123, ["reviewer1", "reviewer2"], ["team1"]
            )
            
            assert len(result["requested_reviewers"]) == 2
    
    @pytest.mark.async_test
    async def test_create_issue(self, temp_dir, mock_env_vars, mock_github_api):
        """Test issue creation"""
        github = GitHubIntegration(github_token="test_token", workspace_dir=temp_dir)
        repo = mock_github_api['repo']
        
        mock_issue_data = {
            "number": 456,
            "title": "Test Issue",
            "body": "Issue description",
            "state": "open",
            "labels": [{"name": "bug"}, {"name": "high-priority"}],
            "assignees": [{"login": "assignee1"}],
            "created_at": "2023-01-01T12:00:00Z",
            "updated_at": "2023-01-01T12:00:00Z"
        }
        
        with patch.object(github, '_make_api_request', return_value=mock_issue_data):
            issue = await github.create_issue(
                repo, "Test Issue", "Issue description",
                labels=["bug", "high-priority"], assignees=["assignee1"]
            )
            
            assert isinstance(issue, GitHubIssue)
            assert issue.number == 456
            assert issue.title == "Test Issue"
            assert issue.state == "open"
            assert "bug" in issue.labels
            assert "assignee1" in issue.assignees
    
    @pytest.mark.async_test
    async def test_get_file_content(self, temp_dir, mock_env_vars, mock_github_api):
        """Test file content retrieval"""
        github = GitHubIntegration(github_token="test_token", workspace_dir=temp_dir)
        repo = mock_github_api['repo']
        
        # Base64 encoded "Hello, World!"
        import base64
        content_b64 = base64.b64encode("Hello, World!".encode()).decode()
        
        mock_file_data = {
            "content": content_b64,
            "encoding": "base64"
        }
        
        with patch.object(github, '_make_api_request', return_value=mock_file_data):
            content = await github.get_file_content(repo, "README.md", "main")
            
            assert content == "Hello, World!"
    
    @pytest.mark.async_test
    async def test_validate_permissions(self, temp_dir, mock_env_vars, mock_github_api):
        """Test repository permissions validation"""
        github = GitHubIntegration(github_token="test_token", workspace_dir=temp_dir)
        repo = mock_github_api['repo']
        
        mock_repo_data = {
            "permissions": {
                "admin": True,
                "push": True,
                "pull": True,
                "maintain": False,
                "triage": False
            }
        }
        
        with patch.object(github, '_make_api_request', return_value=mock_repo_data):
            permissions = await github.validate_permissions(repo)
            
            assert permissions["admin"] is True
            assert permissions["push"] is True
            assert permissions["pull"] is True
            assert permissions["maintain"] is False
            assert permissions["triage"] is False
    
    @pytest.mark.unit
    def test_generate_pr_description(self, temp_dir, mock_env_vars):
        """Test PR description generation"""
        github = GitHubIntegration(github_token="test_token", workspace_dir=temp_dir)
        
        commits = [
            Commit("sha1", "feat: add new feature", "Author 1", datetime.now()),
            Commit("sha2", "fix: fix bug", "Author 2", datetime.now())
        ]
        
        description = github.generate_pr_description(
            commits,
            "Added new feature and fixed bug",
            "Test the new feature manually"
        )
        
        assert "## 概要" in description
        assert "Added new feature and fixed bug" in description
        assert "## 変更内容" in description
        assert "feat: add new feature" in description
        assert "fix: fix bug" in description
        assert "## テスト項目" in description
        assert "Test the new feature manually" in description
        assert "## チェックリスト" in description
        assert "🤖 このPRは自律開発システムによって生成されました" in description
    
    @pytest.mark.unit
    def test_generate_commit_message(self, temp_dir, mock_env_vars):
        """Test commit message generation"""
        github = GitHubIntegration(github_token="test_token", workspace_dir=temp_dir)
        
        # Basic commit message
        message = github.generate_commit_message(
            "feat", "auth", "add user authentication"
        )
        assert message == "feat(auth): add user authentication"
        
        # Breaking change
        message = github.generate_commit_message(
            "feat", "api", "change API structure", breaking_change=True
        )
        assert message == "feat(api)!: change API structure"
        
        # No scope
        message = github.generate_commit_message(
            "fix", "", "fix critical bug"
        )
        assert message == "fix: fix critical bug"
    
    @pytest.mark.async_test
    async def test_cleanup_workspace(self, temp_dir, mock_env_vars):
        """Test workspace cleanup"""
        github = GitHubIntegration(github_token="test_token", workspace_dir=temp_dir)
        
        # Create some test files and directories
        test_file = Path(temp_dir) / "test.txt"
        test_dir = Path(temp_dir) / "test_dir"
        test_file.write_text("test content")
        test_dir.mkdir()
        (test_dir / "nested.txt").write_text("nested content")
        
        assert test_file.exists()
        assert test_dir.exists()
        
        await github.cleanup_workspace()
        
        # Workspace should be empty
        assert not test_file.exists()
        assert not test_dir.exists()
    
    @pytest.mark.async_test
    async def test_close(self, temp_dir, mock_env_vars):
        """Test resource cleanup on close"""
        github = GitHubIntegration(github_token="test_token", workspace_dir=temp_dir)
        
        with patch.object(github, 'cleanup_workspace') as mock_cleanup:
            await github.close()
            mock_cleanup.assert_called_once()


class TestDataClasses:
    """Test data classes"""
    
    @pytest.mark.unit
    def test_github_repo_creation(self):
        """Test GitHubRepo creation"""
        repo = GitHubRepo(
            owner="test-owner",
            name="test-repo",
            url="https://github.com/test-owner/test-repo",
            default_branch="develop",
            private=True
        )
        
        assert repo.owner == "test-owner"
        assert repo.name == "test-repo"
        assert repo.default_branch == "develop"
        assert repo.private is True
    
    @pytest.mark.unit
    def test_github_repo_defaults(self):
        """Test GitHubRepo default values"""
        repo = GitHubRepo(
            owner="test-owner",
            name="test-repo",
            url="https://github.com/test-owner/test-repo"
        )
        
        assert repo.default_branch == "main"
        assert repo.private is False
    
    @pytest.mark.unit
    def test_pull_request_creation(self):
        """Test PullRequest creation"""
        pr = PullRequest(
            number=123,
            title="Test PR",
            body="Test description",
            state=PRStatus.OPEN,
            head_branch="feature",
            base_branch="main",
            author="test-user",
            created_at=datetime.now(),
            updated_at=datetime.now(),
            mergeable=True,
            review_state=ReviewState.APPROVED
        )
        
        assert pr.number == 123
        assert pr.state == PRStatus.OPEN
        assert pr.review_state == ReviewState.APPROVED
        assert pr.mergeable is True
    
    @pytest.mark.unit
    def test_commit_creation(self):
        """Test Commit creation"""
        timestamp = datetime.now()
        commit = Commit(
            sha="abc123",
            message="Test commit",
            author="test-author",
            timestamp=timestamp,
            files_changed=["file1.py", "file2.py"]
        )
        
        assert commit.sha == "abc123"
        assert commit.message == "Test commit"
        assert commit.files_changed == ["file1.py", "file2.py"]
        assert commit.timestamp == timestamp
    
    @pytest.mark.unit
    def test_github_issue_creation(self):
        """Test GitHubIssue creation"""
        timestamp = datetime.now()
        issue = GitHubIssue(
            number=456,
            title="Test Issue",
            body="Issue description",
            state="open",
            labels=["bug", "high-priority"],
            assignees=["user1", "user2"],
            created_at=timestamp,
            updated_at=timestamp
        )
        
        assert issue.number == 456
        assert issue.title == "Test Issue"
        assert "bug" in issue.labels
        assert "user1" in issue.assignees


class TestErrorHandling:
    """Test error handling scenarios"""
    
    @pytest.mark.async_test
    async def test_api_request_http_error(self, temp_dir, mock_env_vars):
        """Test API request HTTP error handling"""
        github = GitHubIntegration(github_token="test_token", workspace_dir=temp_dir)
        
        mock_response = Mock()
        mock_response.status_code = 404
        mock_response.text = "Not Found"
        mock_response.raise_for_status.side_effect = Exception("404 Not Found")
        
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.request.return_value = mock_response
            mock_client_class.return_value.__aenter__.return_value = mock_client
            
            with pytest.raises(Exception, match="404 Not Found"):
                await github._make_api_request("GET", "nonexistent")
    
    @pytest.mark.async_test
    async def test_get_repository_info_error(self, temp_dir, mock_env_vars):
        """Test repository info error handling"""
        github = GitHubIntegration(github_token="test_token", workspace_dir=temp_dir)
        
        with patch.object(github, '_make_api_request', side_effect=Exception("API Error")):
            with pytest.raises(Exception, match="API Error"):
                await github.get_repository_info("owner", "repo")
    
    @pytest.mark.async_test
    async def test_clone_repository_without_git(self, temp_dir, mock_env_vars):
        """Test repository cloning without GitPython"""
        github = GitHubIntegration(github_token="test_token", workspace_dir=temp_dir)
        repo = GitHubRepo("owner", "repo", "url")
        
        with patch('autonomous_system.integrations.github_integration.git', None):
            with pytest.raises(RuntimeError, match="GitPython not installed"):
                await github.clone_repository(repo)
    
    @pytest.mark.async_test
    async def test_validate_permissions_error(self, temp_dir, mock_env_vars, mock_github_api):
        """Test permissions validation error handling"""
        github = GitHubIntegration(github_token="test_token", workspace_dir=temp_dir)
        repo = mock_github_api['repo']
        
        with patch.object(github, '_make_api_request', side_effect=Exception("Permission denied")):
            permissions = await github.validate_permissions(repo)
            assert permissions == {}


class TestIntegrationScenarios:
    """Integration test scenarios"""
    
    @pytest.mark.integration
    @pytest.mark.async_test
    async def test_complete_pr_workflow(self, temp_dir, mock_env_vars, mock_github_api):
        """Test complete pull request workflow"""
        github = GitHubIntegration(github_token="test_token", workspace_dir=temp_dir)
        repo = mock_github_api['repo']
        
        # Mock API responses for complete workflow
        api_responses = [
            # create_branch responses
            {"object": {"sha": "base_sha"}},  # get base branch
            {"ref": "refs/heads/feature", "object": {"sha": "base_sha"}},  # create branch
            
            # create_commit responses
            {"object": {"sha": "branch_sha"}},  # get branch
            {"tree": {"sha": "base_tree"}},    # get base commit
            {"sha": "blob_sha"},               # create blob
            {"sha": "tree_sha"},               # create tree
            {"sha": "commit_sha", "author": {"date": "2023-01-01T12:00:00Z"}},  # create commit
            {},                                # update branch
            
            # create_pull_request response
            {
                "number": 123,
                "title": "Feature PR",
                "body": "Added new feature",
                "state": "open",
                "head": {"ref": "feature"},
                "base": {"ref": "main"},
                "user": {"login": "test-user"},
                "created_at": "2023-01-01T12:00:00Z",
                "updated_at": "2023-01-01T12:00:00Z",
                "mergeable": True
            }
        ]
        
        with patch.object(github, '_make_api_request', side_effect=api_responses):
            # 1. Create feature branch
            await github.create_branch(repo, "feature", "main")
            
            # 2. Create commit
            files = {"feature.py": "def new_feature():\n    return 'Hello World'"}
            commit = await github.create_commit(
                repo, "feature", "feat: add new feature", files
            )
            
            # 3. Create pull request
            pr = await github.create_pull_request(
                repo, "Feature PR", "Added new feature", "feature", "main"
            )
            
            # Verify complete workflow
            assert commit.sha == "commit_sha"
            assert pr.number == 123
            assert pr.head_branch == "feature"
            assert pr.base_branch == "main"
    
    @pytest.mark.integration
    @pytest.mark.async_test
    async def test_issue_creation_and_pr_linking(self, temp_dir, mock_env_vars, mock_github_api):
        """Test issue creation and PR linking workflow"""
        github = GitHubIntegration(github_token="test_token", workspace_dir=temp_dir)
        repo = mock_github_api['repo']
        
        # Mock issue creation
        mock_issue_data = {
            "number": 456,
            "title": "Bug Report",
            "body": "Found a critical bug",
            "state": "open",
            "labels": [{"name": "bug"}],
            "assignees": [],
            "created_at": "2023-01-01T12:00:00Z",
            "updated_at": "2023-01-01T12:00:00Z"
        }
        
        # Mock PR creation with issue reference
        mock_pr_data = {
            "number": 789,
            "title": "Fix for #456",
            "body": "Fixes #456\n\nThis PR addresses the critical bug",
            "state": "open",
            "head": {"ref": "fix-456"},
            "base": {"ref": "main"},
            "user": {"login": "test-user"},
            "created_at": "2023-01-01T13:00:00Z",
            "updated_at": "2023-01-01T13:00:00Z",
            "mergeable": True
        }
        
        with patch.object(github, '_make_api_request', side_effect=[mock_issue_data, mock_pr_data]):
            # Create issue
            issue = await github.create_issue(
                repo, "Bug Report", "Found a critical bug", labels=["bug"]
            )
            
            # Create PR that references the issue
            pr_body = f"Fixes #{issue.number}\n\nThis PR addresses the critical bug"
            pr = await github.create_pull_request(
                repo, f"Fix for #{issue.number}", pr_body, "fix-456", "main"
            )
            
            assert issue.number == 456
            assert pr.number == 789
            assert f"#{issue.number}" in pr.body


class TestPerformanceAndLimits:
    """Performance and rate limiting tests"""
    
    @pytest.mark.performance
    @pytest.mark.async_test
    async def test_rate_limit_handling(self, temp_dir, mock_env_vars):
        """Test rate limit handling with multiple requests"""
        github = GitHubIntegration(github_token="test_token", workspace_dir=temp_dir)
        github.rate_limit_remaining = 2  # Very low limit
        github.rate_limit_reset = datetime.now() + timedelta(seconds=0.1)
        
        call_count = 0
        
        async def mock_request(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"call": call_count}
            mock_response.headers = {
                "x-ratelimit-remaining": str(max(0, 2 - call_count)),
                "x-ratelimit-reset": str(int((datetime.now() + timedelta(seconds=0.1)).timestamp()))
            }
            return mock_response
        
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.request.side_effect = mock_request
            mock_client_class.return_value.__aenter__.return_value = mock_client
            
            # Make multiple requests
            start_time = datetime.now()
            results = []
            for i in range(3):
                result = await github._make_api_request("GET", f"test/{i}")
                results.append(result)
            
            elapsed = (datetime.now() - start_time).total_seconds()
            
            # Should have made all requests
            assert len(results) == 3
            # Should have waited for rate limit reset at least once
            assert elapsed >= 0.1
    
    @pytest.mark.unit
    def test_workspace_directory_creation(self, mock_env_vars):
        """Test workspace directory creation"""
        with tempfile.TemporaryDirectory() as temp_dir:
            workspace_path = Path(temp_dir) / "github_workspace"
            
            github = GitHubIntegration(
                github_token="test_token",
                workspace_dir=str(workspace_path)
            )
            
            # Directory should be created
            assert workspace_path.exists()
            assert workspace_path.is_dir()
            assert github.workspace_dir == workspace_path