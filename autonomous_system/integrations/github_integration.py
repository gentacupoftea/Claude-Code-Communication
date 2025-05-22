"""
GitHub Integration - GitHubサービス統合
自律開発システム用の包括的なGitHub API統合コンポーネント
"""

import asyncio
import base64
import json
import logging
import os
import re
import subprocess
import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple, Union
from dataclasses import dataclass, asdict
from enum import Enum

try:
    import httpx
    import git
    from git import Repo, InvalidGitRepositoryError
except ImportError as e:
    logging.warning(f"GitHub integration dependencies not installed: {e}")
    httpx = None
    git = None


class PRStatus(Enum):
    """プルリクエスト状態"""
    DRAFT = "draft"
    OPEN = "open"
    CLOSED = "closed"
    MERGED = "merged"


class ReviewState(Enum):
    """レビュー状態"""
    APPROVED = "approved"
    CHANGES_REQUESTED = "changes_requested"
    COMMENTED = "commented"
    PENDING = "pending"


@dataclass
class GitHubRepo:
    """GitHub リポジトリ情報"""
    owner: str
    name: str
    url: str
    default_branch: str = "main"
    private: bool = False


@dataclass
class PullRequest:
    """プルリクエスト情報"""
    number: int
    title: str
    body: str
    state: PRStatus
    head_branch: str
    base_branch: str
    author: str
    created_at: datetime
    updated_at: datetime
    mergeable: bool = None
    review_state: ReviewState = ReviewState.PENDING


@dataclass
class Commit:
    """コミット情報"""
    sha: str
    message: str
    author: str
    timestamp: datetime
    files_changed: List[str] = None


@dataclass
class GitHubIssue:
    """GitHub Issue情報"""
    number: int
    title: str
    body: str
    state: str
    labels: List[str]
    assignees: List[str]
    created_at: datetime
    updated_at: datetime


class GitHubIntegration:
    """GitHub統合クライアント - 自律開発システム用包括的GitHub API統合"""
    
    def __init__(self, 
                 github_token: Optional[str] = None,
                 workspace_dir: Optional[str] = None):
        """
        初期化
        
        Args:
            github_token: GitHub Personal Access Token
            workspace_dir: ローカル作業ディレクトリ
        """
        self.logger = logging.getLogger(__name__)
        
        # GitHub認証設定
        self.github_token = github_token or os.getenv('GITHUB_TOKEN')
        if not self.github_token:
            raise ValueError("GitHub token is required. Set GITHUB_TOKEN environment variable.")
        
        # HTTP クライアント設定
        self.headers = {
            "Authorization": f"token {self.github_token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "AutonomousSystem/1.0"
        }
        
        # 作業ディレクトリ設定
        self.workspace_dir = Path(workspace_dir) if workspace_dir else Path.cwd()
        self.workspace_dir.mkdir(exist_ok=True)
        
        # API設定
        self.github_api_base = "https://api.github.com"
        self.max_retries = 3
        self.retry_delay = 1.0
        
        # レート制限管理
        self.rate_limit_remaining = 5000
        self.rate_limit_reset = datetime.now()
        
        self.logger.info("GitHub Integration initialized")

    async def _make_api_request(self, 
                               method: str, 
                               endpoint: str, 
                               data: Optional[Dict] = None,
                               params: Optional[Dict] = None) -> Dict[str, Any]:
        """
        GitHub API リクエスト実行（レート制限・リトライ対応）
        
        Args:
            method: HTTPメソッド
            endpoint: APIエンドポイント
            data: リクエストボディ
            params: クエリパラメータ
            
        Returns:
            APIレスポンス
        """
        if not httpx:
            raise RuntimeError("httpx not installed. Run: pip install httpx")
        
        url = f"{self.github_api_base}/{endpoint.lstrip('/')}"
        
        # レート制限チェック
        await self._check_rate_limit()
        
        for attempt in range(self.max_retries):
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.request(
                        method=method,
                        url=url,
                        headers=self.headers,
                        json=data,
                        params=params,
                        timeout=30.0
                    )
                    
                    # レート制限情報更新
                    self._update_rate_limit(response.headers)
                    
                    if response.status_code == 200 or response.status_code == 201:
                        return response.json()
                    elif response.status_code == 204:
                        return {}
                    elif response.status_code == 403 and "rate limit" in response.text.lower():
                        await self._wait_for_rate_limit_reset()
                        continue
                    else:
                        response.raise_for_status()
                        
            except httpx.RequestError as e:
                self.logger.warning(f"Request failed (attempt {attempt + 1}): {e}")
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(self.retry_delay * (2 ** attempt))
                else:
                    raise
            except httpx.HTTPStatusError as e:
                self.logger.error(f"HTTP error {e.response.status_code}: {e.response.text}")
                raise
                
        raise RuntimeError("Max retries exceeded")

    async def _check_rate_limit(self):
        """レート制限チェック"""
        if self.rate_limit_remaining < 10 and datetime.now() < self.rate_limit_reset:
            await self._wait_for_rate_limit_reset()

    async def _wait_for_rate_limit_reset(self):
        """レート制限リセット待機"""
        wait_time = (self.rate_limit_reset - datetime.now()).total_seconds()
        if wait_time > 0:
            self.logger.info(f"Rate limit exceeded. Waiting {wait_time:.1f} seconds")
            await asyncio.sleep(wait_time)

    def _update_rate_limit(self, headers: Dict[str, str]):
        """レート制限情報更新"""
        if "x-ratelimit-remaining" in headers:
            self.rate_limit_remaining = int(headers["x-ratelimit-remaining"])
        if "x-ratelimit-reset" in headers:
            self.rate_limit_reset = datetime.fromtimestamp(int(headers["x-ratelimit-reset"]))

    # Repository Operations
    async def get_repository_info(self, owner: str, repo_name: str) -> GitHubRepo:
        """
        リポジトリ情報取得
        
        Args:
            owner: リポジトリオーナー
            repo_name: リポジトリ名
            
        Returns:
            リポジトリ情報
        """
        try:
            data = await self._make_api_request("GET", f"repos/{owner}/{repo_name}")
            
            return GitHubRepo(
                owner=data["owner"]["login"],
                name=data["name"],
                url=data["html_url"],
                default_branch=data["default_branch"],
                private=data["private"]
            )
        except Exception as e:
            self.logger.error(f"Failed to get repository info: {e}")
            raise

    async def clone_repository(self, 
                              repo: GitHubRepo, 
                              local_path: Optional[str] = None,
                              branch: Optional[str] = None) -> Path:
        """
        リポジトリクローン
        
        Args:
            repo: リポジトリ情報
            local_path: ローカルパス
            branch: チェックアウトするブランチ
            
        Returns:
            クローンされたリポジトリのパス
        """
        if not git:
            raise RuntimeError("GitPython not installed. Run: pip install GitPython")
        
        try:
            if local_path is None:
                local_path = self.workspace_dir / repo.name
            else:
                local_path = Path(local_path)
            
            # 既存ディレクトリがある場合は削除
            if local_path.exists():
                import shutil
                shutil.rmtree(local_path)
            
            # クローンURL構築（認証付き）
            clone_url = f"https://{self.github_token}@github.com/{repo.owner}/{repo.name}.git"
            
            self.logger.info(f"Cloning repository {repo.owner}/{repo.name} to {local_path}")
            
            # リポジトリクローン
            git_repo = Repo.clone_from(clone_url, local_path)
            
            # 指定ブランチへチェックアウト
            if branch and branch != repo.default_branch:
                try:
                    git_repo.git.checkout(branch)
                except Exception as e:
                    self.logger.warning(f"Failed to checkout branch {branch}: {e}")
            
            self.logger.info(f"Repository cloned successfully to {local_path}")
            return local_path
            
        except Exception as e:
            self.logger.error(f"Failed to clone repository: {e}")
            raise

    # Branch Operations
    async def create_branch(self, 
                           repo: GitHubRepo, 
                           branch_name: str,
                           base_branch: Optional[str] = None) -> Dict[str, Any]:
        """
        新規ブランチ作成
        
        Args:
            repo: リポジトリ情報
            branch_name: 新しいブランチ名
            base_branch: ベースブランチ（デフォルト：main）
            
        Returns:
            作成されたブランチ情報
        """
        try:
            if base_branch is None:
                base_branch = repo.default_branch
            
            # ベースブランチのSHA取得
            base_ref = await self._make_api_request(
                "GET", 
                f"repos/{repo.owner}/{repo.name}/git/refs/heads/{base_branch}"
            )
            base_sha = base_ref["object"]["sha"]
            
            # 新しいブランチ作成
            branch_data = {
                "ref": f"refs/heads/{branch_name}",
                "sha": base_sha
            }
            
            result = await self._make_api_request(
                "POST",
                f"repos/{repo.owner}/{repo.name}/git/refs",
                data=branch_data
            )
            
            self.logger.info(f"Branch '{branch_name}' created successfully")
            return result
            
        except Exception as e:
            self.logger.error(f"Failed to create branch: {e}")
            raise

    async def list_branches(self, repo: GitHubRepo) -> List[Dict[str, Any]]:
        """
        ブランチ一覧取得
        
        Args:
            repo: リポジトリ情報
            
        Returns:
            ブランチ一覧
        """
        try:
            branches = await self._make_api_request(
                "GET",
                f"repos/{repo.owner}/{repo.name}/branches"
            )
            return branches
        except Exception as e:
            self.logger.error(f"Failed to list branches: {e}")
            raise

    # Commit Operations
    async def create_commit(self, 
                           repo: GitHubRepo,
                           branch: str,
                           message: str,
                           files: Dict[str, str],
                           author_name: Optional[str] = None,
                           author_email: Optional[str] = None) -> Commit:
        """
        新規コミット作成
        
        Args:
            repo: リポジトリ情報
            branch: ターゲットブランチ
            message: コミットメッセージ
            files: ファイル変更内容 (path -> content)
            author_name: 作成者名
            author_email: 作成者メール
            
        Returns:
            作成されたコミット情報
        """
        try:
            # 現在のブランチHEAD取得
            ref_data = await self._make_api_request(
                "GET",
                f"repos/{repo.owner}/{repo.name}/git/refs/heads/{branch}"
            )
            base_sha = ref_data["object"]["sha"]
            
            # ベースコミット取得
            base_commit = await self._make_api_request(
                "GET",
                f"repos/{repo.owner}/{repo.name}/git/commits/{base_sha}"
            )
            base_tree_sha = base_commit["tree"]["sha"]
            
            # 新しいツリー作成
            tree_items = []
            for file_path, content in files.items():
                # ファイルをblob として作成
                blob_data = {
                    "content": content,
                    "encoding": "utf-8"
                }
                blob = await self._make_api_request(
                    "POST",
                    f"repos/{repo.owner}/{repo.name}/git/blobs",
                    data=blob_data
                )
                
                tree_items.append({
                    "path": file_path,
                    "mode": "100644",
                    "type": "blob",
                    "sha": blob["sha"]
                })
            
            # ツリー作成
            tree_data = {
                "base_tree": base_tree_sha,
                "tree": tree_items
            }
            tree = await self._make_api_request(
                "POST",
                f"repos/{repo.owner}/{repo.name}/git/trees",
                data=tree_data
            )
            
            # コミット作成
            commit_data = {
                "message": message,
                "tree": tree["sha"],
                "parents": [base_sha]
            }
            
            if author_name and author_email:
                commit_data["author"] = {
                    "name": author_name,
                    "email": author_email,
                    "date": datetime.utcnow().isoformat() + "Z"
                }
            
            commit = await self._make_api_request(
                "POST",
                f"repos/{repo.owner}/{repo.name}/git/commits",
                data=commit_data
            )
            
            # ブランチHEADを更新
            await self._make_api_request(
                "PATCH",
                f"repos/{repo.owner}/{repo.name}/git/refs/heads/{branch}",
                data={"sha": commit["sha"]}
            )
            
            self.logger.info(f"Commit created successfully: {commit['sha'][:8]}")
            
            return Commit(
                sha=commit["sha"],
                message=message,
                author=commit_data.get("author", {}).get("name", "Unknown"),
                timestamp=datetime.fromisoformat(commit["author"]["date"].replace("Z", "+00:00")),
                files_changed=list(files.keys())
            )
            
        except Exception as e:
            self.logger.error(f"Failed to create commit: {e}")
            raise

    async def get_commit_history(self, 
                                repo: GitHubRepo,
                                branch: str = None,
                                limit: int = 50) -> List[Commit]:
        """
        コミット履歴取得
        
        Args:
            repo: リポジトリ情報
            branch: ブランチ名（デフォルト：main）
            limit: 取得件数制限
            
        Returns:
            コミット履歴リスト
        """
        try:
            params = {"per_page": limit}
            if branch:
                params["sha"] = branch
            
            commits_data = await self._make_api_request(
                "GET",
                f"repos/{repo.owner}/{repo.name}/commits",
                params=params
            )
            
            commits = []
            for commit_data in commits_data:
                commits.append(Commit(
                    sha=commit_data["sha"],
                    message=commit_data["commit"]["message"],
                    author=commit_data["commit"]["author"]["name"],
                    timestamp=datetime.fromisoformat(
                        commit_data["commit"]["author"]["date"].replace("Z", "+00:00")
                    )
                ))
            
            return commits
            
        except Exception as e:
            self.logger.error(f"Failed to get commit history: {e}")
            raise

    # Pull Request Operations
    async def create_pull_request(self, 
                                 repo: GitHubRepo,
                                 title: str,
                                 body: str,
                                 head_branch: str,
                                 base_branch: str = None,
                                 draft: bool = False,
                                 reviewers: List[str] = None) -> PullRequest:
        """
        プルリクエスト作成
        
        Args:
            repo: リポジトリ情報
            title: PRタイトル
            body: PR説明
            head_branch: ソースブランチ
            base_branch: ターゲットブランチ
            draft: ドラフトPRフラグ
            reviewers: レビュアーリスト
            
        Returns:
            作成されたPR情報
        """
        try:
            if base_branch is None:
                base_branch = repo.default_branch
            
            pr_data = {
                "title": title,
                "body": body,
                "head": head_branch,
                "base": base_branch,
                "draft": draft
            }
            
            pr = await self._make_api_request(
                "POST",
                f"repos/{repo.owner}/{repo.name}/pulls",
                data=pr_data
            )
            
            # レビュアー設定
            if reviewers:
                await self.request_review(repo, pr["number"], reviewers)
            
            self.logger.info(f"Pull request created: #{pr['number']}")
            
            return PullRequest(
                number=pr["number"],
                title=pr["title"],
                body=pr["body"],
                state=PRStatus(pr["state"]),
                head_branch=pr["head"]["ref"],
                base_branch=pr["base"]["ref"],
                author=pr["user"]["login"],
                created_at=datetime.fromisoformat(pr["created_at"].replace("Z", "+00:00")),
                updated_at=datetime.fromisoformat(pr["updated_at"].replace("Z", "+00:00")),
                mergeable=pr.get("mergeable")
            )
            
        except Exception as e:
            self.logger.error(f"Failed to create pull request: {e}")
            raise

    async def get_pull_request(self, repo: GitHubRepo, pr_number: int) -> PullRequest:
        """
        プルリクエスト情報取得
        
        Args:
            repo: リポジトリ情報
            pr_number: PR番号
            
        Returns:
            PR情報
        """
        try:
            pr = await self._make_api_request(
                "GET",
                f"repos/{repo.owner}/{repo.name}/pulls/{pr_number}"
            )
            
            return PullRequest(
                number=pr["number"],
                title=pr["title"],
                body=pr["body"],
                state=PRStatus(pr["state"]),
                head_branch=pr["head"]["ref"],
                base_branch=pr["base"]["ref"],
                author=pr["user"]["login"],
                created_at=datetime.fromisoformat(pr["created_at"].replace("Z", "+00:00")),
                updated_at=datetime.fromisoformat(pr["updated_at"].replace("Z", "+00:00")),
                mergeable=pr.get("mergeable")
            )
            
        except Exception as e:
            self.logger.error(f"Failed to get pull request: {e}")
            raise

    async def list_pull_requests(self, 
                                repo: GitHubRepo,
                                state: str = "open",
                                limit: int = 30) -> List[PullRequest]:
        """
        プルリクエスト一覧取得
        
        Args:
            repo: リポジトリ情報
            state: PR状態フィルタ (open/closed/all)
            limit: 取得件数制限
            
        Returns:
            PR一覧
        """
        try:
            params = {
                "state": state,
                "per_page": limit,
                "sort": "updated",
                "direction": "desc"
            }
            
            prs_data = await self._make_api_request(
                "GET",
                f"repos/{repo.owner}/{repo.name}/pulls",
                params=params
            )
            
            prs = []
            for pr_data in prs_data:
                prs.append(PullRequest(
                    number=pr_data["number"],
                    title=pr_data["title"],
                    body=pr_data["body"],
                    state=PRStatus(pr_data["state"]),
                    head_branch=pr_data["head"]["ref"],
                    base_branch=pr_data["base"]["ref"],
                    author=pr_data["user"]["login"],
                    created_at=datetime.fromisoformat(pr_data["created_at"].replace("Z", "+00:00")),
                    updated_at=datetime.fromisoformat(pr_data["updated_at"].replace("Z", "+00:00")),
                    mergeable=pr_data.get("mergeable")
                ))
            
            return prs
            
        except Exception as e:
            self.logger.error(f"Failed to list pull requests: {e}")
            raise

    async def merge_pull_request(self, 
                                repo: GitHubRepo,
                                pr_number: int,
                                merge_method: str = "merge",
                                commit_title: Optional[str] = None,
                                commit_message: Optional[str] = None) -> Dict[str, Any]:
        """
        プルリクエストマージ
        
        Args:
            repo: リポジトリ情報
            pr_number: PR番号
            merge_method: マージ方法 (merge/squash/rebase)
            commit_title: マージコミットタイトル
            commit_message: マージコミットメッセージ
            
        Returns:
            マージ結果
        """
        try:
            merge_data = {
                "merge_method": merge_method
            }
            
            if commit_title:
                merge_data["commit_title"] = commit_title
            if commit_message:
                merge_data["commit_message"] = commit_message
            
            result = await self._make_api_request(
                "PUT",
                f"repos/{repo.owner}/{repo.name}/pulls/{pr_number}/merge",
                data=merge_data
            )
            
            self.logger.info(f"Pull request #{pr_number} merged successfully")
            return result
            
        except Exception as e:
            self.logger.error(f"Failed to merge pull request: {e}")
            raise

    async def request_review(self, 
                            repo: GitHubRepo,
                            pr_number: int,
                            reviewers: List[str],
                            team_reviewers: List[str] = None) -> Dict[str, Any]:
        """
        レビュー依頼
        
        Args:
            repo: リポジトリ情報
            pr_number: PR番号
            reviewers: レビュアーリスト
            team_reviewers: チームレビュアーリスト
            
        Returns:
            レビュー依頼結果
        """
        try:
            review_data = {
                "reviewers": reviewers
            }
            
            if team_reviewers:
                review_data["team_reviewers"] = team_reviewers
            
            result = await self._make_api_request(
                "POST",
                f"repos/{repo.owner}/{repo.name}/pulls/{pr_number}/requested_reviewers",
                data=review_data
            )
            
            self.logger.info(f"Review requested for PR #{pr_number}")
            return result
            
        except Exception as e:
            self.logger.error(f"Failed to request review: {e}")
            raise

    # Issue Operations
    async def create_issue(self, 
                          repo: GitHubRepo,
                          title: str,
                          body: str,
                          labels: List[str] = None,
                          assignees: List[str] = None) -> GitHubIssue:
        """
        Issue作成
        
        Args:
            repo: リポジトリ情報
            title: Issueタイトル
            body: Issue説明
            labels: ラベルリスト
            assignees: アサインユーザーリスト
            
        Returns:
            作成されたIssue情報
        """
        try:
            issue_data = {
                "title": title,
                "body": body
            }
            
            if labels:
                issue_data["labels"] = labels
            if assignees:
                issue_data["assignees"] = assignees
            
            issue = await self._make_api_request(
                "POST",
                f"repos/{repo.owner}/{repo.name}/issues",
                data=issue_data
            )
            
            self.logger.info(f"Issue created: #{issue['number']}")
            
            return GitHubIssue(
                number=issue["number"],
                title=issue["title"],
                body=issue["body"],
                state=issue["state"],
                labels=[label["name"] for label in issue["labels"]],
                assignees=[assignee["login"] for assignee in issue["assignees"]],
                created_at=datetime.fromisoformat(issue["created_at"].replace("Z", "+00:00")),
                updated_at=datetime.fromisoformat(issue["updated_at"].replace("Z", "+00:00"))
            )
            
        except Exception as e:
            self.logger.error(f"Failed to create issue: {e}")
            raise

    # Utility Methods
    def generate_pr_description(self, 
                               commits: List[Commit],
                               changes_summary: str,
                               testing_notes: str = None) -> str:
        """
        プルリクエスト説明文生成
        
        Args:
            commits: コミット一覧
            changes_summary: 変更概要
            testing_notes: テスト注意事項
            
        Returns:
            PR説明文
        """
        description = f"""## 概要
{changes_summary}

## 変更内容
"""
        
        for commit in commits:
            description += f"- {commit.message}\n"
        
        if testing_notes:
            description += f"""
## テスト項目
{testing_notes}
"""
        
        description += """
## チェックリスト
- [ ] テストが追加・更新されている
- [ ] ドキュメントが更新されている
- [ ] 破壊的変更がない、または適切に文書化されている
- [ ] コードレビューの準備ができている

🤖 このPRは自律開発システムによって生成されました
"""
        
        return description

    def generate_commit_message(self, 
                               change_type: str,
                               scope: str,
                               description: str,
                               breaking_change: bool = False) -> str:
        """
        コミットメッセージ生成（Conventional Commits準拠）
        
        Args:
            change_type: 変更タイプ (feat/fix/docs/style/refactor/test/chore)
            scope: 変更スコープ
            description: 変更説明
            breaking_change: 破壊的変更フラグ
            
        Returns:
            コミットメッセージ
        """
        message = f"{change_type}"
        
        if scope:
            message += f"({scope})"
        
        if breaking_change:
            message += "!"
        
        message += f": {description}"
        
        return message

    async def cleanup_workspace(self):
        """ワークスペース清理"""
        try:
            import shutil
            for item in self.workspace_dir.iterdir():
                if item.is_dir():
                    shutil.rmtree(item)
                else:
                    item.unlink()
            self.logger.info("Workspace cleaned up")
        except Exception as e:
            self.logger.error(f"Failed to cleanup workspace: {e}")

    async def validate_permissions(self, repo: GitHubRepo) -> Dict[str, bool]:
        """
        リポジトリ権限確認
        
        Args:
            repo: リポジトリ情報
            
        Returns:
            権限情報辞書
        """
        try:
            repo_data = await self._make_api_request(
                "GET",
                f"repos/{repo.owner}/{repo.name}"
            )
            
            permissions = repo_data.get("permissions", {})
            
            return {
                "admin": permissions.get("admin", False),
                "push": permissions.get("push", False),
                "pull": permissions.get("pull", False),
                "maintain": permissions.get("maintain", False),
                "triage": permissions.get("triage", False)
            }
            
        except Exception as e:
            self.logger.error(f"Failed to validate permissions: {e}")
            return {}

    async def get_file_content(self, 
                              repo: GitHubRepo,
                              file_path: str,
                              branch: str = None) -> str:
        """
        ファイル内容取得
        
        Args:
            repo: リポジトリ情報
            file_path: ファイルパス
            branch: ブランチ名
            
        Returns:
            ファイル内容
        """
        try:
            params = {}
            if branch:
                params["ref"] = branch
            
            file_data = await self._make_api_request(
                "GET",
                f"repos/{repo.owner}/{repo.name}/contents/{file_path}",
                params=params
            )
            
            # Base64デコード
            content = base64.b64decode(file_data["content"]).decode("utf-8")
            return content
            
        except Exception as e:
            self.logger.error(f"Failed to get file content: {e}")
            raise

    async def close(self):
        """リソース清理"""
        await self.cleanup_workspace()
        self.logger.info("GitHub Integration closed")