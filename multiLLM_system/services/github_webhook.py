"""
GitHub Webhook Integration Service
GitHubのPR/Issue/Pushイベントを受信し、適切なWorkerに振り分ける
"""

import asyncio
import logging
import hmac
import hashlib
import json
from datetime import datetime
from typing import Dict, Any, Optional, List
from aiohttp import web, ClientSession
import aiohttp_cors
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class GitHubEvent:
    """GitHubイベントデータ"""
    event_type: str
    action: str
    repository: str
    sender: str
    payload: Dict[str, Any]
    timestamp: datetime


class GitHubWebhookHandler:
    """GitHub Webhook処理クラス"""
    
    def __init__(self, config: Dict, orchestrator=None):
        self.config = config
        self.orchestrator = orchestrator
        self.webhook_secret = config.get('webhookSecret')
        self.github_token = config.get('githubToken')
        self.allowed_repos = config.get('allowedRepos', [])
        
        # イベントハンドラーマッピング
        self.event_handlers = {
            'pull_request': self._handle_pull_request,
            'issues': self._handle_issue,
            'push': self._handle_push,
            'pull_request_review': self._handle_pr_review,
            'issue_comment': self._handle_comment
        }
        
        # HTTPクライアント
        self.session = None
        
        # 処理済みイベントキャッシュ（重複防止）
        self.processed_events = set()
    
    async def initialize(self):
        """サービス初期化"""
        logger.info("🔗 Initializing GitHub Webhook Handler...")
        
        self.session = ClientSession(
            headers={
                'Authorization': f'token {self.github_token}',
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'MultiLLM-System/1.0'
            }
        )
        
        logger.info("✅ GitHub Webhook Handler initialized")
    
    async def shutdown(self):
        """サービス終了"""
        if self.session:
            await self.session.close()
    
    def verify_signature(self, payload: bytes, signature: str) -> bool:
        """Webhook署名を検証"""
        if not self.webhook_secret:
            logger.warning("Webhook secret not configured, skipping signature verification")
            return True
        
        expected_signature = 'sha256=' + hmac.new(
            self.webhook_secret.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(expected_signature, signature)
    
    async def handle_webhook(self, request: web.Request) -> web.Response:
        """Webhookリクエストを処理"""
        try:
            # リクエストヘッダーチェック
            event_type = request.headers.get('X-GitHub-Event')
            signature = request.headers.get('X-Hub-Signature-256', '')
            delivery_id = request.headers.get('X-GitHub-Delivery')
            
            if not event_type:
                return web.Response(status=400, text="Missing X-GitHub-Event header")
            
            # ペイロード取得
            payload = await request.read()
            
            # 署名検証
            if not self.verify_signature(payload, signature):
                logger.warning(f"Invalid signature for delivery {delivery_id}")
                return web.Response(status=401, text="Invalid signature")
            
            # JSON解析
            try:
                data = json.loads(payload.decode('utf-8'))
            except json.JSONDecodeError:
                return web.Response(status=400, text="Invalid JSON payload")
            
            # 重複チェック
            if delivery_id in self.processed_events:
                logger.info(f"Duplicate event {delivery_id}, skipping")
                return web.Response(status=200, text="Event already processed")
            
            # リポジトリ制限チェック
            repo_full_name = data.get('repository', {}).get('full_name', '')
            if self.allowed_repos and repo_full_name not in self.allowed_repos:
                logger.info(f"Repository {repo_full_name} not in allowed list")
                return web.Response(status=200, text="Repository not allowed")
            
            # イベント作成
            github_event = GitHubEvent(
                event_type=event_type,
                action=data.get('action', ''),
                repository=repo_full_name,
                sender=data.get('sender', {}).get('login', 'unknown'),
                payload=data,
                timestamp=datetime.now()
            )
            
            # 処理済みマーク
            self.processed_events.add(delivery_id)
            
            # イベント処理
            await self._process_event(github_event)
            
            return web.Response(status=200, text="Event processed successfully")
            
        except Exception as e:
            logger.error(f"Webhook processing error: {e}")
            return web.Response(status=500, text="Internal server error")
    
    async def _process_event(self, event: GitHubEvent):
        """イベントを処理"""
        logger.info(f"📨 Processing GitHub event: {event.event_type}.{event.action} from {event.repository}")
        
        # 対応するハンドラーを取得
        handler = self.event_handlers.get(event.event_type)
        if not handler:
            logger.info(f"No handler for event type: {event.event_type}")
            return
        
        try:
            await handler(event)
        except Exception as e:
            logger.error(f"Error handling {event.event_type} event: {e}")
    
    async def _handle_pull_request(self, event: GitHubEvent):
        """プルリクエストイベント処理"""
        action = event.action
        pr_data = event.payload.get('pull_request', {})
        
        if action == 'opened':
            await self._handle_pr_opened(event, pr_data)
        elif action == 'synchronize':  # 新しいコミットが追加
            await self._handle_pr_updated(event, pr_data)
        elif action == 'ready_for_review':
            await self._handle_pr_ready_for_review(event, pr_data)
        elif action == 'closed' and pr_data.get('merged'):
            await self._handle_pr_merged(event, pr_data)
    
    async def _handle_pr_opened(self, event: GitHubEvent, pr_data: Dict):
        """新PRの処理"""
        pr_number = pr_data.get('number')
        title = pr_data.get('title', '')
        body = pr_data.get('body', '')
        author = pr_data.get('user', {}).get('login', '')
        
        logger.info(f"🔄 New PR #{pr_number}: {title}")
        
        # Orchestratorにレビュータスクを送信
        if self.orchestrator:
            task_description = f"""
新しいプルリクエストのレビューをお願いします。

**PR情報:**
- 番号: #{pr_number}
- タイトル: {title}
- 作成者: {author}
- リポジトリ: {event.repository}

**説明:**
{body}

**実行内容:**
1. コード変更の分析
2. セキュリティチェック
3. ベストプラクティス確認
4. 改善提案の作成
"""
            
            result = await self.orchestrator.process_user_request(
                task_description,
                user_id=f"github_{author}",
                context={
                    'source': 'github_webhook',
                    'event_type': 'pull_request',
                    'action': 'opened',
                    'pr_number': pr_number,
                    'repository': event.repository,
                    'pr_data': pr_data
                }
            )
            
            # レビューコメントを投稿
            await self._post_pr_comment(event.repository, pr_number, result.get('text', ''))
    
    async def _handle_pr_updated(self, event: GitHubEvent, pr_data: Dict):
        """PR更新の処理"""
        pr_number = pr_data.get('number')
        
        logger.info(f"🔄 PR #{pr_number} updated")
        
        # 増分レビューを実行
        if self.orchestrator:
            task_description = f"""
プルリクエスト #{pr_number} が更新されました。
新しい変更点について増分レビューを実行してください。

リポジトリ: {event.repository}
"""
            
            await self.orchestrator.process_user_request(
                task_description,
                user_id=f"github_system",
                context={
                    'source': 'github_webhook',
                    'event_type': 'pull_request',
                    'action': 'synchronize',
                    'pr_number': pr_number,
                    'repository': event.repository
                }
            )
    
    async def _handle_pr_ready_for_review(self, event: GitHubEvent, pr_data: Dict):
        """レビュー準備完了の処理"""
        pr_number = pr_data.get('number')
        
        logger.info(f"✅ PR #{pr_number} ready for review")
        
        # 優先度高でレビュータスクを送信
        if self.orchestrator:
            task_description = f"""
プルリクエスト #{pr_number} がレビュー準備完了しました。
優先的に包括的なレビューを実行してください。

リポジトリ: {event.repository}
"""
            
            await self.orchestrator.process_user_request(
                task_description,
                user_id=f"github_system",
                context={
                    'source': 'github_webhook',
                    'event_type': 'pull_request',
                    'action': 'ready_for_review',
                    'pr_number': pr_number,
                    'repository': event.repository,
                    'priority': 'high'
                }
            )
    
    async def _handle_pr_merged(self, event: GitHubEvent, pr_data: Dict):
        """PRマージの処理"""
        pr_number = pr_data.get('number')
        
        logger.info(f"🎉 PR #{pr_number} merged")
        
        # マージ後のタスク（デプロイ、ドキュメント更新など）
        if self.orchestrator:
            task_description = f"""
プルリクエスト #{pr_number} がマージされました。
以下のマージ後タスクを実行してください：

1. デプロイメント確認
2. ドキュメント更新チェック
3. テスト結果の確認
4. 関連IssueのクローズChanel

リポジトリ: {event.repository}
"""
            
            await self.orchestrator.process_user_request(
                task_description,
                user_id=f"github_system",
                context={
                    'source': 'github_webhook',
                    'event_type': 'pull_request',
                    'action': 'merged',
                    'pr_number': pr_number,
                    'repository': event.repository
                }
            )
    
    async def _handle_issue(self, event: GitHubEvent):
        """Issueイベント処理"""
        action = event.action
        issue_data = event.payload.get('issue', {})
        
        if action == 'opened':
            await self._handle_issue_opened(event, issue_data)
        elif action == 'labeled':
            await self._handle_issue_labeled(event, issue_data)
    
    async def _handle_issue_opened(self, event: GitHubEvent, issue_data: Dict):
        """新Issue処理"""
        issue_number = issue_data.get('number')
        title = issue_data.get('title', '')
        body = issue_data.get('body', '')
        author = issue_data.get('user', {}).get('login', '')
        labels = [label['name'] for label in issue_data.get('labels', [])]
        
        logger.info(f"🐛 New Issue #{issue_number}: {title}")
        
        # バグラベルがある場合は優先処理
        is_bug = any('bug' in label.lower() for label in labels)
        priority = 'high' if is_bug else 'medium'
        
        if self.orchestrator:
            task_description = f"""
新しいIssueが作成されました。分析と対応方針を検討してください。

**Issue情報:**
- 番号: #{issue_number}
- タイトル: {title}
- 作成者: {author}
- ラベル: {', '.join(labels)}
- 優先度: {'高（バグ）' if is_bug else '中'}

**内容:**
{body}

**実行内容:**
1. Issue内容の分析
2. 重複チェック
3. 対応方針の提案
4. 適切なラベルの提案
"""
            
            result = await self.orchestrator.process_user_request(
                task_description,
                user_id=f"github_{author}",
                context={
                    'source': 'github_webhook',
                    'event_type': 'issues',
                    'action': 'opened',
                    'issue_number': issue_number,
                    'repository': event.repository,
                    'priority': priority
                }
            )
            
            # Issueにコメント投稿
            await self._post_issue_comment(event.repository, issue_number, result.get('text', ''))
    
    async def _handle_issue_labeled(self, event: GitHubEvent, issue_data: Dict):
        """Issueラベル変更処理"""
        issue_number = issue_data.get('number')
        label = event.payload.get('label', {}).get('name', '')
        
        # 特定ラベルに対する自動処理
        if label == 'help wanted':
            await self._handle_help_wanted(event, issue_data)
        elif label == 'good first issue':
            await self._handle_good_first_issue(event, issue_data)
    
    async def _handle_help_wanted(self, event: GitHubEvent, issue_data: Dict):
        """Help Wantedラベル処理"""
        issue_number = issue_data.get('number')
        
        # コミュニティへの告知やドキュメント生成
        if self.orchestrator:
            task_description = f"""
Issue #{issue_number} に "help wanted" ラベルが追加されました。
コミュニティサポートの準備をしてください：

1. 詳細な再現手順の作成
2. 技術レベル要件の明記
3. 関連ドキュメントの整理
4. メンター割り当ての検討

リポジトリ: {event.repository}
"""
            
            await self.orchestrator.process_user_request(
                task_description,
                user_id="github_system",
                context={
                    'source': 'github_webhook',
                    'event_type': 'issues',
                    'action': 'labeled_help_wanted',
                    'issue_number': issue_number,
                    'repository': event.repository
                }
            )
    
    async def _handle_push(self, event: GitHubEvent):
        """Pushイベント処理"""
        commits = event.payload.get('commits', [])
        ref = event.payload.get('ref', '')
        
        # メインブランチへのプッシュのみ処理
        if ref != 'refs/heads/main' and ref != 'refs/heads/master':
            return
        
        logger.info(f"📤 Push to {ref}: {len(commits)} commits")
        
        # 大きな変更の場合は分析実行
        if len(commits) > 5:
            if self.orchestrator:
                task_description = f"""
{event.repository} のメインブランチに大きな変更（{len(commits)}コミット）がプッシュされました。
影響分析を実行してください：

1. 変更内容の要約
2. 破壊的変更のチェック
3. テストカバレッジの確認
4. デプロイメント準備状況の確認
"""
                
                await self.orchestrator.process_user_request(
                    task_description,
                    user_id="github_system",
                    context={
                        'source': 'github_webhook',
                        'event_type': 'push',
                        'ref': ref,
                        'commit_count': len(commits),
                        'repository': event.repository
                    }
                )
    
    async def _handle_pr_review(self, event: GitHubEvent):
        """PRレビューイベント処理"""
        review = event.payload.get('review', {})
        pr_data = event.payload.get('pull_request', {})
        
        state = review.get('state', '')
        pr_number = pr_data.get('number')
        
        if state == 'changes_requested':
            logger.info(f"🔄 Changes requested for PR #{pr_number}")
            # 変更要求の分析と提案
        elif state == 'approved':
            logger.info(f"✅ PR #{pr_number} approved")
            # 自動マージの検討
    
    async def _handle_comment(self, event: GitHubEvent):
        """コメントイベント処理"""
        comment = event.payload.get('comment', {})
        issue = event.payload.get('issue', {})
        
        comment_body = comment.get('body', '')
        author = comment.get('user', {}).get('login', '')
        
        # @coneaメンションの検出
        if '@conea' in comment_body.lower():
            issue_number = issue.get('number')
            
            logger.info(f"🤖 Conea mentioned in Issue #{issue_number}")
            
            if self.orchestrator:
                task_description = f"""
Issue #{issue_number} のコメントで @conea がメンションされました。
ユーザーの質問に回答してください：

**ユーザー:** {author}
**コメント:** {comment_body}
**Issue:** {issue.get('title', '')}

適切な回答やサポートを提供してください。
"""
                
                result = await self.orchestrator.process_user_request(
                    task_description,
                    user_id=f"github_{author}",
                    context={
                        'source': 'github_webhook',
                        'event_type': 'issue_comment',
                        'issue_number': issue_number,
                        'repository': event.repository
                    }
                )
                
                # 回答をコメントとして投稿
                await self._post_issue_comment(event.repository, issue_number, result.get('text', ''))
    
    async def _post_pr_comment(self, repo: str, pr_number: int, comment: str):
        """PRにコメントを投稿"""
        url = f"https://api.github.com/repos/{repo}/issues/{pr_number}/comments"
        
        payload = {
            'body': f"🤖 **Conea AI Review**\n\n{comment}"
        }
        
        try:
            async with self.session.post(url, json=payload) as response:
                if response.status == 201:
                    logger.info(f"✅ Posted comment to PR #{pr_number}")
                else:
                    logger.error(f"Failed to post PR comment: {response.status}")
        except Exception as e:
            logger.error(f"Error posting PR comment: {e}")
    
    async def _post_issue_comment(self, repo: str, issue_number: int, comment: str):
        """Issueにコメントを投稿"""
        url = f"https://api.github.com/repos/{repo}/issues/{issue_number}/comments"
        
        payload = {
            'body': f"🤖 **Conea AI Assistant**\n\n{comment}"
        }
        
        try:
            async with self.session.post(url, json=payload) as response:
                if response.status == 201:
                    logger.info(f"✅ Posted comment to Issue #{issue_number}")
                else:
                    logger.error(f"Failed to post Issue comment: {response.status}")
        except Exception as e:
            logger.error(f"Error posting Issue comment: {e}")
    
    def get_stats(self) -> Dict[str, Any]:
        """統計情報を取得"""
        return {
            'processed_events': len(self.processed_events),
            'allowed_repos': self.allowed_repos,
            'event_handlers': list(self.event_handlers.keys())
        }


# Webhook サーバー
class GitHubWebhookServer:
    """GitHub Webhook受信サーバー"""
    
    def __init__(self, handler: GitHubWebhookHandler, port: int = 8080):
        self.handler = handler
        self.port = port
        self.app = None
    
    async def create_app(self):
        """aiohttp アプリケーションを作成"""
        app = web.Application()
        
        # CORS設定
        cors = aiohttp_cors.setup(app, defaults={
            "*": aiohttp_cors.ResourceOptions(
                allow_credentials=True,
                expose_headers="*",
                allow_headers="*",
                allow_methods="*"
            )
        })
        
        # ルート設定
        app.router.add_post('/webhook', self.handler.handle_webhook)
        app.router.add_get('/health', self._health_check)
        app.router.add_get('/stats', self._get_stats)
        
        # CORS適用
        for route in list(app.router.routes()):
            cors.add(route)
        
        self.app = app
        return app
    
    async def _health_check(self, request: web.Request) -> web.Response:
        """ヘルスチェック"""
        return web.json_response({'status': 'healthy', 'timestamp': datetime.now().isoformat()})
    
    async def _get_stats(self, request: web.Request) -> web.Response:
        """統計情報"""
        stats = self.handler.get_stats()
        return web.json_response(stats)
    
    async def start(self):
        """サーバー開始"""
        await self.create_app()
        runner = web.AppRunner(self.app)
        await runner.setup()
        
        site = web.TCPSite(runner, '0.0.0.0', self.port)
        await site.start()
        
        logger.info(f"🌐 GitHub Webhook server started on port {self.port}")
        logger.info(f"   - Webhook endpoint: http://localhost:{self.port}/webhook")
        logger.info(f"   - Health check: http://localhost:{self.port}/health")


# 使用例
async def main():
    from orchestrator.orchestrator import MultiLLMOrchestrator
    
    # 設定
    config = {
        'webhookSecret': 'your-webhook-secret',
        'githubToken': 'ghp_your-github-token',
        'allowedRepos': ['your-org/your-repo']
    }
    
    # Orchestrator初期化
    orchestrator_config = {
        "workers": {
            "review_worker": {"model": "gpt-4"},
            "backend_worker": {"model": "gpt-4-turbo"}
        }
    }
    orchestrator = MultiLLMOrchestrator(orchestrator_config)
    await orchestrator.initialize()
    
    # Webhook handler初期化
    handler = GitHubWebhookHandler(config, orchestrator)
    await handler.initialize()
    
    # サーバー開始
    server = GitHubWebhookServer(handler, 8080)
    await server.start()
    
    # サーバー実行
    try:
        while True:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        logger.info("Shutting down webhook server...")
        await handler.shutdown()


if __name__ == "__main__":
    asyncio.run(main())