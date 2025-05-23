"""
PR Review Worker - プルリクエスト自動レビュー専門Worker
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import re
import json

logger = logging.getLogger(__name__)


@dataclass
class ReviewComment:
    """レビューコメント"""
    file: str
    line: int
    severity: str  # critical, high, medium, low
    category: str  # security, performance, style, logic
    message: str
    suggestion: Optional[str] = None


@dataclass
class PRReviewResult:
    """PRレビュー結果"""
    pr_number: int
    title: str
    author: str
    score: int  # 0-100
    severity: str  # Critical/High/Medium/Low
    comments: List[ReviewComment]
    merge_recommendation: str  # Yes/Conditional/No
    summary: str
    timestamp: datetime


class PRReviewWorker:
    """
    PR自動レビュー専門のWorker LLM
    コード品質、セキュリティ、パフォーマンスをチェック
    """
    
    def __init__(self, config: Dict):
        self.config = config
        self.model = config.get('model', 'gpt-4')
        self.github_client = None  # GitHub API client
        self.slack_client = None   # Slack client
        self.llm_client = None     # LLM client
        
        # レビュー基準
        self.review_criteria = {
            'coding_standards': 25,  # コーディング規約
            'error_handling': 20,    # エラーハンドリング
            'security': 25,          # セキュリティ
            'performance': 15,       # パフォーマンス
            'test_coverage': 15     # テストカバレッジ
        }
        
        # セキュリティパターン
        self.security_patterns = [
            (r'api[_-]?key|secret|password|token', 'ハードコードされた認証情報'),
            (r'eval\(|exec\(', '危険な関数の使用'),
            (r'SELECT.*FROM.*WHERE.*=\s*["\']?\$', 'SQLインジェクションの可能性'),
            (r'<script.*?>.*?</script>', 'XSSの可能性'),
            (r'os\.system\(|subprocess\.call\(', 'コマンドインジェクションの可能性')
        ]
        
        # パフォーマンスパターン
        self.performance_patterns = [
            (r'for.*for.*for', '深いネストのループ'),
            (r'SELECT.*\*.*FROM', 'SELECT * の使用'),
            (r'\.+\s*=\s*\.+\s*\+\s*', '文字列の非効率な連結'),
            (r'await.*await.*await', '過度な非同期待機')
        ]
    
    async def review_pr(self, pr_data: Dict) -> PRReviewResult:
        """PRをレビュー"""
        logger.info(f"🔍 Reviewing PR #{pr_data['number']}: {pr_data['title']}")
        
        # PR情報を取得
        pr_info = await self._fetch_pr_details(pr_data)
        
        # 変更されたファイルを取得
        changed_files = await self._fetch_changed_files(pr_data['number'])
        
        # 各ファイルをレビュー
        all_comments = []
        scores = {}
        
        for file in changed_files:
            file_comments, file_scores = await self._review_file(file)
            all_comments.extend(file_comments)
            
            # スコアを集計
            for criterion, score in file_scores.items():
                if criterion not in scores:
                    scores[criterion] = []
                scores[criterion].append(score)
        
        # 全体スコアを計算
        total_score = self._calculate_total_score(scores)
        
        # 重要度を判定
        severity = self._determine_severity(all_comments, total_score)
        
        # マージ推奨を判定
        merge_recommendation = self._determine_merge_recommendation(
            severity, total_score, all_comments
        )
        
        # サマリーを生成
        summary = await self._generate_summary(
            pr_info, all_comments, total_score, merge_recommendation
        )
        
        # レビュー結果を作成
        review_result = PRReviewResult(
            pr_number=pr_data['number'],
            title=pr_data['title'],
            author=pr_data['author'],
            score=total_score,
            severity=severity,
            comments=all_comments,
            merge_recommendation=merge_recommendation,
            summary=summary,
            timestamp=datetime.now()
        )
        
        # GitHubにコメントを投稿
        await self._post_github_comments(review_result)
        
        # Slackに通知
        await self._send_slack_notification(review_result)
        
        return review_result
    
    async def _fetch_pr_details(self, pr_data: Dict) -> Dict:
        """PR詳細情報を取得"""
        # 実際の実装ではGitHub APIを使用
        return {
            'number': pr_data['number'],
            'title': pr_data['title'],
            'author': pr_data['author'],
            'description': pr_data.get('description', ''),
            'base_branch': pr_data.get('base_branch', 'main'),
            'head_branch': pr_data.get('head_branch', 'feature')
        }
    
    async def _fetch_changed_files(self, pr_number: int) -> List[Dict]:
        """変更されたファイルを取得"""
        # 実際の実装ではGitHub APIを使用
        # デモ用のダミーデータ
        return [
            {
                'filename': 'src/api/users.py',
                'additions': 50,
                'deletions': 10,
                'patch': '''
@@ -10,5 +10,10 @@ def get_user(user_id):
-    query = f"SELECT * FROM users WHERE id = {user_id}"
+    query = "SELECT * FROM users WHERE id = ?"
+    params = (user_id,)
+    
+    try:
+        result = db.execute(query, params)
+    except Exception as e:
+        logger.error(f"Database error: {e}")
+        return None
'''
            }
        ]
    
    async def _review_file(self, file: Dict) -> Tuple[List[ReviewComment], Dict[str, float]]:
        """ファイルをレビュー"""
        comments = []
        scores = {criterion: 100 for criterion in self.review_criteria}
        
        # セキュリティチェック
        security_issues = self._check_security(file)
        comments.extend(security_issues)
        if security_issues:
            scores['security'] -= len(security_issues) * 10
        
        # パフォーマンスチェック
        performance_issues = self._check_performance(file)
        comments.extend(performance_issues)
        if performance_issues:
            scores['performance'] -= len(performance_issues) * 5
        
        # コーディング規約チェック（LLMを使用）
        style_comments = await self._check_coding_standards(file)
        comments.extend(style_comments)
        if style_comments:
            scores['coding_standards'] -= len(style_comments) * 3
        
        # エラーハンドリングチェック
        error_handling_comments = await self._check_error_handling(file)
        comments.extend(error_handling_comments)
        if error_handling_comments:
            scores['error_handling'] -= len(error_handling_comments) * 5
        
        return comments, scores
    
    def _check_security(self, file: Dict) -> List[ReviewComment]:
        """セキュリティチェック"""
        comments = []
        patch_lines = file.get('patch', '').split('\n')
        
        for i, line in enumerate(patch_lines):
            if line.startswith('+'):  # 追加された行のみチェック
                for pattern, message in self.security_patterns:
                    if re.search(pattern, line, re.IGNORECASE):
                        comments.append(ReviewComment(
                            file=file['filename'],
                            line=i,
                            severity='critical',
                            category='security',
                            message=f"セキュリティリスク: {message}",
                            suggestion="機密情報は環境変数を使用してください"
                        ))
        
        return comments
    
    def _check_performance(self, file: Dict) -> List[ReviewComment]:
        """パフォーマンスチェック"""
        comments = []
        patch_lines = file.get('patch', '').split('\n')
        
        for i, line in enumerate(patch_lines):
            if line.startswith('+'):
                for pattern, message in self.performance_patterns:
                    if re.search(pattern, line):
                        comments.append(ReviewComment(
                            file=file['filename'],
                            line=i,
                            severity='medium',
                            category='performance',
                            message=f"パフォーマンス: {message}",
                            suggestion="より効率的な実装を検討してください"
                        ))
        
        return comments
    
    async def _check_coding_standards(self, file: Dict) -> List[ReviewComment]:
        """コーディング規約チェック（LLM使用）"""
        # 実際の実装ではLLMに問い合わせ
        comments = []
        
        # デモ用の簡易チェック
        if 'TODO' in file.get('patch', ''):
            comments.append(ReviewComment(
                file=file['filename'],
                line=0,
                severity='low',
                category='style',
                message="TODOコメントが残っています",
                suggestion="TODOを解決するか、Issueとして登録してください"
            ))
        
        return comments
    
    async def _check_error_handling(self, file: Dict) -> List[ReviewComment]:
        """エラーハンドリングチェック"""
        comments = []
        patch = file.get('patch', '')
        
        # try-exceptブロックの確認
        if 'try:' in patch and 'except Exception' in patch:
            comments.append(ReviewComment(
                file=file['filename'],
                line=0,
                severity='medium',
                category='logic',
                message="汎用的なException捕捉は避けてください",
                suggestion="具体的な例外タイプを指定してください"
            ))
        
        return comments
    
    def _calculate_total_score(self, scores: Dict[str, List[float]]) -> int:
        """全体スコアを計算"""
        total = 0
        total_weight = 0
        
        for criterion, weight in self.review_criteria.items():
            if criterion in scores and scores[criterion]:
                avg_score = sum(scores[criterion]) / len(scores[criterion])
                total += avg_score * weight / 100
                total_weight += weight
            else:
                total += weight  # 該当なしは満点
                total_weight += weight
        
        return int(total / total_weight * 100)
    
    def _determine_severity(self, comments: List[ReviewComment], score: int) -> str:
        """重要度を判定"""
        critical_count = sum(1 for c in comments if c.severity == 'critical')
        high_count = sum(1 for c in comments if c.severity == 'high')
        
        if critical_count > 0 or score < 50:
            return 'Critical'
        elif high_count > 2 or score < 70:
            return 'High'
        elif score < 85:
            return 'Medium'
        else:
            return 'Low'
    
    def _determine_merge_recommendation(
        self, severity: str, score: int, comments: List[ReviewComment]
    ) -> str:
        """マージ推奨を判定"""
        critical_count = sum(1 for c in comments if c.severity == 'critical')
        
        if severity == 'Critical' or critical_count > 0:
            return 'No'
        elif severity == 'High' or score < 70:
            return 'Conditional'
        else:
            return 'Yes'
    
    async def _generate_summary(
        self, pr_info: Dict, comments: List[ReviewComment], 
        score: int, recommendation: str
    ) -> str:
        """レビューサマリーを生成"""
        summary = f"PR #{pr_info['number']} のレビューが完了しました。\n\n"
        summary += f"総合スコア: {score}/100\n"
        summary += f"マージ推奨: {recommendation}\n\n"
        
        if comments:
            summary += "主な指摘事項:\n"
            # 重要度順にソート
            sorted_comments = sorted(
                comments, 
                key=lambda c: ['critical', 'high', 'medium', 'low'].index(c.severity)
            )
            for comment in sorted_comments[:5]:  # 上位5件
                summary += f"• [{comment.severity.upper()}] {comment.message}\n"
        else:
            summary += "特に問題は見つかりませんでした。"
        
        return summary
    
    async def _post_github_comments(self, review_result: PRReviewResult):
        """GitHubにレビューコメントを投稿"""
        # 実際の実装ではGitHub APIを使用
        logger.info(f"📝 Posting review comments to PR #{review_result.pr_number}")
        
        # PRレビューコメントを作成
        review_body = f"""## 🤖 自動レビュー結果

**総合スコア:** {review_result.score}/100
**重要度:** {review_result.severity}
**マージ推奨:** {review_result.merge_recommendation}

{review_result.summary}
"""
        
        # 各ファイルの詳細コメント
        for comment in review_result.comments:
            # 実際はGitHub APIでインラインコメントを投稿
            pass
    
    async def _send_slack_notification(self, review_result: PRReviewResult):
        """Slackに通知を送信"""
        # 実際の実装ではSlack APIを使用
        
        # 重要度に応じた絵文字
        emoji_map = {
            'Critical': '🚨',
            'High': '⚠️',
            'Medium': '📋',
            'Low': '✅'
        }
        
        emoji = emoji_map.get(review_result.severity, '📋')
        
        slack_message = f"""@genta 
{emoji} PR レビュー完了: #{review_result.pr_number}
📝 タイトル: {review_result.title}
👤 作成者: {review_result.author}
🎯 重要度: {review_result.severity}
📊 スコア: {review_result.score}/100

主な指摘事項:
"""
        
        # 上位3件の指摘事項
        for comment in review_result.comments[:3]:
            slack_message += f"• {comment.message}\n"
        
        slack_message += f"\nマージ推奨: {review_result.merge_recommendation}"
        
        logger.info(f"📬 Sending Slack notification for PR #{review_result.pr_number}")
        
        # 実際のSlack送信処理
        # await self.slack_client.post_message(slack_message)
    
    def get_status(self) -> Dict:
        """Workerのステータスを取得"""
        return {
            "worker": "pr_review",
            "model": self.model,
            "status": "active",
            "capabilities": [
                "code_review",
                "security_scan",
                "performance_analysis",
                "style_check"
            ]
        }


# 使用例
async def main():
    config = {
        "model": "gpt-4",
        "github_token": "ghp_xxx",
        "slack_token": "xoxb-xxx"
    }
    
    worker = PRReviewWorker(config)
    
    # PRデータ（通常はWebhookから受信）
    pr_data = {
        "number": 123,
        "title": "feat: ユーザー認証機能の追加",
        "author": "developer123",
        "description": "JWTベースの認証を実装"
    }
    
    result = await worker.review_pr(pr_data)
    print(f"Review completed: Score={result.score}, Recommendation={result.merge_recommendation}")


if __name__ == "__main__":
    asyncio.run(main())