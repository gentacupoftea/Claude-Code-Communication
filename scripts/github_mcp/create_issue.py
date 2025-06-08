#!/usr/bin/env python3
"""
GitHub Issue作成MCP（Master Control Program）

コマンドラインからGitHub Issueを直接作成するためのスクリプト。
キメラ・プロジェクトのPhase 1として実装。
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path
from typing import Dict, Optional, Tuple
import re

import requests
from dotenv import load_dotenv


class GitHubIssueCreator:
    """GitHub Issue作成を担当するクラス"""
    
    def __init__(self) -> None:
        """初期化時に環境変数を読み込み"""
        self._load_environment()
        self.github_token: Optional[str] = os.getenv('GITHUB_PAT')
        
        if not self.github_token:
            raise ValueError(
                "GITHUB_PATが設定されていません。.envファイルを確認してください。"
            )
    
    def _load_environment(self) -> None:
        """環境変数をロード"""
        env_path = Path(__file__).parent / '.env'
        if env_path.exists():
            load_dotenv(env_path)
    
    def get_repository_info(self) -> Tuple[str, str]:
        """現在のGitリポジトリの情報を取得
        
        Returns:
            Tuple[str, str]: (owner, repo)の組み合わせ
            
        Raises:
            RuntimeError: Gitリポジトリでない、またはリモートが設定されていない場合
        """
        try:
            # リモートURLを取得
            result = subprocess.run(
                ['git', 'config', '--get', 'remote.origin.url'],
                capture_output=True,
                text=True,
                check=True
            )
            remote_url = result.stdout.strip()
            
            # HTTPSとSSH形式の両方に対応
            # HTTPS: https://github.com/owner/repo.git
            # SSH: git@github.com:owner/repo.git
            
            if remote_url.startswith('https://github.com/'):
                # HTTPS形式
                match = re.match(
                    r'https://github\.com/([^/]+)/([^/]+?)(?:\.git)?/?$',
                    remote_url
                )
            elif remote_url.startswith('git@github.com:'):
                # SSH形式
                match = re.match(
                    r'git@github\.com:([^/]+)/([^/]+?)(?:\.git)?/?$',
                    remote_url
                )
            else:
                raise ValueError(f"サポートされていないリモートURL形式: {remote_url}")
            
            if not match:
                raise ValueError(f"リモートURLの解析に失敗: {remote_url}")
            
            owner, repo = match.groups()
            return owner, repo
            
        except subprocess.CalledProcessError as e:
            raise RuntimeError(
                "Gitリポジトリでないか、リモートの'origin'が設定されていません。"
            ) from e
        except Exception as e:
            raise RuntimeError(f"リポジトリ情報の取得に失敗: {str(e)}") from e
    
    def create_issue(
        self, 
        title: str, 
        body: Optional[str] = None, 
        labels: Optional[str] = None
    ) -> str:
        """GitHub Issueを作成
        
        Args:
            title: Issueのタイトル
            body: Issueの本文（任意）
            labels: ラベル（カンマ区切り、任意）
            
        Returns:
            str: 作成されたIssueのURL
            
        Raises:
            requests.RequestException: API呼び出しに失敗した場合
        """
        owner, repo = self.get_repository_info()
        
        # APIエンドポイント
        url = f"https://api.github.com/repos/{owner}/{repo}/issues"
        
        # リクエストヘッダー
        headers = {
            'Authorization': f'token {self.github_token}',
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        }
        
        # リクエストボディ
        issue_data: Dict[str, any] = {
            'title': title,
            'body': body or ''
        }
        
        # ラベルの処理
        if labels:
            label_list = [label.strip() for label in labels.split(',') if label.strip()]
            if label_list:
                issue_data['labels'] = label_list
        
        try:
            response = requests.post(url, json=issue_data, headers=headers)
            response.raise_for_status()
            
            issue_info = response.json()
            return issue_info['html_url']
            
        except requests.exceptions.HTTPError as e:
            if response.status_code == 401:
                raise requests.RequestException(
                    "認証に失敗しました。GITHUB_PATトークンを確認してください。"
                ) from e
            elif response.status_code == 404:
                raise requests.RequestException(
                    f"リポジトリ {owner}/{repo} が見つかりません。"
                ) from e
            else:
                error_detail = response.json().get('message', 'Unknown error')
                raise requests.RequestException(
                    f"Issue作成に失敗しました (HTTP {response.status_code}): {error_detail}"
                ) from e
        except requests.exceptions.RequestException as e:
            raise requests.RequestException(
                f"GitHub APIとの通信に失敗しました: {str(e)}"
            ) from e


def main() -> None:
    """メイン関数"""
    parser = argparse.ArgumentParser(
        description='GitHub Issue作成MCP - コマンドラインからIssueを作成',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用例:
  %(prog)s --title "バグ修正: ログイン画面でエラーが発生"
  %(prog)s --title "新機能: ダークモードの実装" --body "ユーザビリティ向上のため" --labels "enhancement,ui"
  %(prog)s --title "ドキュメント更新" --labels "documentation"
        """
    )
    
    parser.add_argument(
        '--title',
        required=True,
        help='作成するIssueのタイトル（必須）'
    )
    
    parser.add_argument(
        '--body',
        help='Issueの本文（任意）'
    )
    
    parser.add_argument(
        '--labels',
        help='ラベル（カンマ区切り、例: "bug,enhancement"）'
    )
    
    args = parser.parse_args()
    
    try:
        creator = GitHubIssueCreator()
        issue_url = creator.create_issue(
            title=args.title,
            body=args.body,
            labels=args.labels
        )
        
        print(f"✅ Issue created successfully: {issue_url}")
        
    except Exception as e:
        print(f"❌ エラーが発生しました: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()