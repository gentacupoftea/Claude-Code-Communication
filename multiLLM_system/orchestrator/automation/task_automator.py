"""
タスク自動化エンジン - 繰り返しタスクの自動化と最適化
"""

import asyncio
import json
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
import re
from enum import Enum
from collections import defaultdict

class AutomationTrigger(Enum):
    """自動化トリガーの種類"""
    TIME_BASED = "time_based"      # 時間ベース
    EVENT_BASED = "event_based"    # イベントベース
    CONDITION_BASED = "condition_based"  # 条件ベース
    PATTERN_BASED = "pattern_based"      # パターンベース

@dataclass
class AutomationRule:
    """自動化ルール"""
    id: str
    name: str
    description: str
    trigger_type: AutomationTrigger
    trigger_config: Dict[str, Any]
    actions: List[Dict[str, Any]]
    enabled: bool = True
    created_at: datetime = None
    last_triggered: Optional[datetime] = None
    execution_count: int = 0

@dataclass
class AutomationResult:
    """自動化実行結果"""
    rule_id: str
    success: bool
    executed_actions: List[str]
    outputs: Dict[str, Any]
    error: Optional[str] = None
    duration: float = 0.0
    timestamp: datetime = None

class TaskAutomator:
    """
    タスク自動化エンジン
    - ルールベースの自動化
    - パターン認識による自動化提案
    - 定期実行タスク
    - イベント駆動タスク
    """
    
    def __init__(self, orchestrator):
        self.orchestrator = orchestrator
        self.rules: Dict[str, AutomationRule] = {}
        self.running_tasks = {}
        self.automation_history = []
        self._initialize_default_rules()
    
    def _initialize_default_rules(self):
        """デフォルトの自動化ルールを初期化"""
        # メモリ同期の自動化
        self.add_rule(AutomationRule(
            id="auto_memory_sync",
            name="自動メモリ同期",
            description="定期的にメモリを同期",
            trigger_type=AutomationTrigger.TIME_BASED,
            trigger_config={"interval_minutes": 30},
            actions=[{
                "type": "memory_sync",
                "config": {}
            }],
            created_at=datetime.now()
        ))
        
        # 高負荷時の自動スケーリング
        self.add_rule(AutomationRule(
            id="auto_scaling",
            name="自動スケーリング",
            description="高負荷時にワーカーを追加",
            trigger_type=AutomationTrigger.CONDITION_BASED,
            trigger_config={
                "condition": "queue_size > 10",
                "check_interval": 60
            },
            actions=[{
                "type": "scale_workers",
                "config": {"scale_factor": 1.5}
            }],
            created_at=datetime.now()
        ))
    
    def add_rule(self, rule: AutomationRule) -> bool:
        """自動化ルールを追加"""
        if rule.id in self.rules:
            return False
        
        self.rules[rule.id] = rule
        
        # トリガータイプに応じて監視を開始
        if rule.trigger_type == AutomationTrigger.TIME_BASED:
            asyncio.create_task(self._monitor_time_trigger(rule))
        elif rule.trigger_type == AutomationTrigger.CONDITION_BASED:
            asyncio.create_task(self._monitor_condition_trigger(rule))
        
        return True
    
    async def _monitor_time_trigger(self, rule: AutomationRule):
        """時間ベースのトリガーを監視"""
        while rule.enabled and rule.id in self.rules:
            interval = rule.trigger_config.get("interval_minutes", 60) * 60
            await asyncio.sleep(interval)
            
            if rule.enabled:
                await self.execute_rule(rule.id)
    
    async def _monitor_condition_trigger(self, rule: AutomationRule):
        """条件ベースのトリガーを監視"""
        while rule.enabled and rule.id in self.rules:
            check_interval = rule.trigger_config.get("check_interval", 60)
            await asyncio.sleep(check_interval)
            
            if rule.enabled:
                # 条件をチェック
                condition = rule.trigger_config.get("condition", "")
                if await self._evaluate_condition(condition):
                    await self.execute_rule(rule.id)
    
    async def _evaluate_condition(self, condition: str) -> bool:
        """条件を評価"""
        # 簡易的な条件評価（実際はより複雑な評価エンジンが必要）
        if "queue_size" in condition:
            queue_size = self.orchestrator.task_queue.qsize()
            # 条件文字列から数値を抽出
            match = re.search(r'queue_size\s*>\s*(\d+)', condition)
            if match:
                threshold = int(match.group(1))
                return queue_size > threshold
        
        return False
    
    async def execute_rule(self, rule_id: str) -> AutomationResult:
        """自動化ルールを実行"""
        rule = self.rules.get(rule_id)
        if not rule or not rule.enabled:
            return AutomationResult(
                rule_id=rule_id,
                success=False,
                executed_actions=[],
                outputs={},
                error="Rule not found or disabled",
                timestamp=datetime.now()
            )
        
        start_time = datetime.now()
        executed_actions = []
        outputs = {}
        error = None
        
        try:
            for action in rule.actions:
                action_type = action.get("type")
                config = action.get("config", {})
                
                # アクションを実行
                if action_type == "memory_sync":
                    await self.orchestrator.sync_memory()
                    executed_actions.append("memory_sync")
                    outputs["memory_sync"] = "completed"
                
                elif action_type == "scale_workers":
                    scale_factor = config.get("scale_factor", 1.5)
                    # ワーカーのスケーリング処理
                    executed_actions.append(f"scale_workers({scale_factor})")
                    outputs["scale_workers"] = {"scale_factor": scale_factor}
                
                elif action_type == "generate_report":
                    report = await self._generate_report(config)
                    executed_actions.append("generate_report")
                    outputs["report"] = report
                
                elif action_type == "send_notification":
                    await self._send_notification(config)
                    executed_actions.append("send_notification")
                    outputs["notification"] = "sent"
            
            # ルールの実行記録を更新
            rule.last_triggered = datetime.now()
            rule.execution_count += 1
            
            success = True
            
        except Exception as e:
            success = False
            error = str(e)
        
        duration = (datetime.now() - start_time).total_seconds()
        
        result = AutomationResult(
            rule_id=rule_id,
            success=success,
            executed_actions=executed_actions,
            outputs=outputs,
            error=error,
            duration=duration,
            timestamp=datetime.now()
        )
        
        self.automation_history.append(result)
        return result
    
    async def _generate_report(self, config: Dict) -> Dict:
        """レポート生成"""
        report_type = config.get("type", "summary")
        
        if report_type == "summary":
            # システムサマリーレポート
            return {
                "type": "summary",
                "timestamp": datetime.now().isoformat(),
                "active_tasks": len(self.orchestrator.active_tasks),
                "queue_size": self.orchestrator.task_queue.qsize(),
                "workers": len(self.orchestrator.workers),
                "automation_rules": len(self.rules)
            }
        
        return {"type": report_type, "status": "generated"}
    
    async def _send_notification(self, config: Dict):
        """通知を送信"""
        # 実際の実装では、Slack、Email等への通知を実装
        notification_type = config.get("type", "log")
        message = config.get("message", "Automation executed")
        
        if notification_type == "log":
            print(f"[AUTOMATION NOTIFICATION] {message}")
    
    def suggest_automations(self, task_history: List[Dict]) -> List[Dict]:
        """タスク履歴から自動化を提案"""
        suggestions = []
        
        # 繰り返しパターンを検出
        task_patterns = defaultdict(int)
        for task in task_history:
            task_type = task.get("type", "")
            task_patterns[task_type] += 1
        
        # 頻繁に実行されるタスクを自動化候補として提案
        for task_type, count in task_patterns.items():
            if count > 10:  # 10回以上実行されたタスク
                suggestions.append({
                    "task_type": task_type,
                    "frequency": count,
                    "suggestion": f"{task_type}タスクを定期実行として自動化",
                    "confidence": min(0.9, count / 20)  # 実行回数に基づく信頼度
                })
        
        return suggestions
    
    def list_rules(self) -> List[Dict]:
        """すべての自動化ルールをリスト形式で取得"""
        return [
            {
                "id": rule.id,
                "name": rule.name,
                "description": rule.description,
                "trigger_type": rule.trigger_type.value,
                "trigger_config": rule.trigger_config,
                "actions": rule.actions,
                "enabled": rule.enabled,
                "created_at": rule.created_at.isoformat() if rule.created_at else None,
                "last_triggered": rule.last_triggered.isoformat() if rule.last_triggered else None,
                "execution_count": rule.execution_count
            }
            for rule in self.rules.values()
        ]
    
    def remove_rule(self, rule_id: str) -> bool:
        """自動化ルールを削除"""
        if rule_id in self.rules:
            rule = self.rules[rule_id]
            rule.enabled = False  # 監視を停止
            del self.rules[rule_id]
            return True
        return False