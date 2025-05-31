"""
自律デバッグシステム
エラーを自動検出し、解決策を提案・実行するシステム
"""

import logging
import traceback
import asyncio
import json
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import re
import subprocess
import os

logger = logging.getLogger(__name__)


class ErrorType(Enum):
    """エラータイプの分類"""
    SYNTAX_ERROR = "syntax_error"
    RUNTIME_ERROR = "runtime_error"
    LOGIC_ERROR = "logic_error"
    CONFIGURATION_ERROR = "configuration_error"
    NETWORK_ERROR = "network_error"
    DEPENDENCY_ERROR = "dependency_error"
    PERFORMANCE_ISSUE = "performance_issue"
    SECURITY_ISSUE = "security_issue"


@dataclass
class ErrorContext:
    """エラーコンテキスト情報"""
    error_type: ErrorType
    message: str
    file_path: Optional[str]
    line_number: Optional[int]
    function_name: Optional[str]
    stack_trace: str
    timestamp: datetime
    environment: Dict[str, Any]
    severity: int  # 1-5 (5が最も深刻)


@dataclass
class DebugSolution:
    """デバッグソリューション"""
    solution_id: str
    description: str
    confidence: float  # 0.0-1.0
    steps: List[Dict[str, Any]]
    estimated_time: int  # 秒単位
    risk_level: int  # 1-5
    requires_approval: bool


class AutonomousDebugger:
    """
    自律デバッグシステムのメインクラス
    """
    
    def __init__(self, llm_client, config: Optional[Dict] = None):
        self.llm_client = llm_client
        self.config = config or self._default_config()
        self.error_history: List[ErrorContext] = []
        self.solution_history: List[DebugSolution] = []
        self.pattern_db = self._initialize_pattern_db()
        
    def _default_config(self) -> Dict:
        """デフォルト設定"""
        return {
            "auto_fix_enabled": True,
            "max_retry_attempts": 3,
            "approval_required_for_risk_level": 3,
            "log_level": "INFO",
            "monitoring_interval": 60,  # 秒
            "pattern_learning_enabled": True
        }
    
    def _initialize_pattern_db(self) -> Dict:
        """エラーパターンデータベースの初期化"""
        return {
            ErrorType.SYNTAX_ERROR: [
                {
                    "pattern": r"SyntaxError: invalid syntax",
                    "solution": "構文エラーの自動修正",
                    "confidence": 0.9
                },
                {
                    "pattern": r"IndentationError",
                    "solution": "インデントエラーの修正",
                    "confidence": 0.95
                }
            ],
            ErrorType.RUNTIME_ERROR: [
                {
                    "pattern": r"NameError: name '(\w+)' is not defined",
                    "solution": "未定義変数の検出と修正",
                    "confidence": 0.85
                },
                {
                    "pattern": r"TypeError",
                    "solution": "型エラーの解析と修正",
                    "confidence": 0.8
                }
            ],
            ErrorType.DEPENDENCY_ERROR: [
                {
                    "pattern": r"ModuleNotFoundError: No module named '(\w+)'",
                    "solution": "不足モジュールのインストール",
                    "confidence": 0.95
                }
            ],
            ErrorType.NETWORK_ERROR: [
                {
                    "pattern": r"ConnectionError|TimeoutError",
                    "solution": "ネットワーク接続の再試行とフォールバック",
                    "confidence": 0.7
                }
            ]
        }
    
    async def analyze_error(self, error: Exception, context: Optional[Dict] = None) -> ErrorContext:
        """エラーの分析"""
        error_trace = traceback.format_exc()
        error_type = self._classify_error(error, error_trace)
        
        # スタックトレースから詳細情報を抽出
        tb = traceback.extract_tb(error.__traceback__)
        if tb:
            last_frame = tb[-1]
            file_path = last_frame.filename
            line_number = last_frame.lineno
            function_name = last_frame.name
        else:
            file_path = line_number = function_name = None
        
        error_context = ErrorContext(
            error_type=error_type,
            message=str(error),
            file_path=file_path,
            line_number=line_number,
            function_name=function_name,
            stack_trace=error_trace,
            timestamp=datetime.now(),
            environment=context or {},
            severity=self._calculate_severity(error_type, error)
        )
        
        self.error_history.append(error_context)
        return error_context
    
    def _classify_error(self, error: Exception, trace: str) -> ErrorType:
        """エラータイプの分類"""
        error_name = type(error).__name__
        
        if "SyntaxError" in error_name or "IndentationError" in error_name:
            return ErrorType.SYNTAX_ERROR
        elif "ModuleNotFoundError" in error_name or "ImportError" in error_name:
            return ErrorType.DEPENDENCY_ERROR
        elif "ConnectionError" in error_name or "TimeoutError" in error_name:
            return ErrorType.NETWORK_ERROR
        elif any(x in error_name for x in ["NameError", "TypeError", "AttributeError"]):
            return ErrorType.RUNTIME_ERROR
        else:
            return ErrorType.RUNTIME_ERROR
    
    def _calculate_severity(self, error_type: ErrorType, error: Exception) -> int:
        """エラーの深刻度を計算（1-5）"""
        severity_map = {
            ErrorType.SYNTAX_ERROR: 2,
            ErrorType.RUNTIME_ERROR: 3,
            ErrorType.LOGIC_ERROR: 4,
            ErrorType.CONFIGURATION_ERROR: 3,
            ErrorType.NETWORK_ERROR: 2,
            ErrorType.DEPENDENCY_ERROR: 2,
            ErrorType.PERFORMANCE_ISSUE: 3,
            ErrorType.SECURITY_ISSUE: 5
        }
        return severity_map.get(error_type, 3)
    
    async def generate_solutions(self, error_context: ErrorContext) -> List[DebugSolution]:
        """エラーに対する解決策を生成"""
        solutions = []
        
        # パターンマッチングによる解決策
        pattern_solutions = self._pattern_based_solutions(error_context)
        solutions.extend(pattern_solutions)
        
        # LLMによる解決策生成
        llm_solutions = await self._llm_based_solutions(error_context)
        solutions.extend(llm_solutions)
        
        # 解決策をconfidenceでソート
        solutions.sort(key=lambda x: x.confidence, reverse=True)
        
        return solutions[:3]  # 上位3つの解決策を返す
    
    def _pattern_based_solutions(self, error_context: ErrorContext) -> List[DebugSolution]:
        """パターンベースの解決策生成"""
        solutions = []
        patterns = self.pattern_db.get(error_context.error_type, [])
        
        for pattern_info in patterns:
            pattern = pattern_info["pattern"]
            if re.search(pattern, error_context.message) or re.search(pattern, error_context.stack_trace):
                solution = DebugSolution(
                    solution_id=f"pattern_{len(solutions)}",
                    description=pattern_info["solution"],
                    confidence=pattern_info["confidence"],
                    steps=self._generate_pattern_steps(error_context, pattern_info),
                    estimated_time=30,
                    risk_level=1,
                    requires_approval=False
                )
                solutions.append(solution)
        
        return solutions
    
    def _generate_pattern_steps(self, error_context: ErrorContext, pattern_info: Dict) -> List[Dict]:
        """パターンベースのステップ生成"""
        steps = []
        
        if error_context.error_type == ErrorType.DEPENDENCY_ERROR:
            match = re.search(r"No module named '(\w+)'", error_context.message)
            if match:
                module_name = match.group(1)
                steps.append({
                    "action": "install_package",
                    "package": module_name,
                    "command": f"pip install {module_name}"
                })
        
        elif error_context.error_type == ErrorType.SYNTAX_ERROR:
            if error_context.file_path and error_context.line_number:
                steps.append({
                    "action": "fix_syntax",
                    "file": error_context.file_path,
                    "line": error_context.line_number,
                    "description": "構文エラーの修正"
                })
        
        return steps
    
    async def _llm_based_solutions(self, error_context: ErrorContext) -> List[DebugSolution]:
        """LLMベースの解決策生成"""
        prompt = f"""
以下のエラーに対する解決策を生成してください：

エラータイプ: {error_context.error_type.value}
エラーメッセージ: {error_context.message}
ファイル: {error_context.file_path}
行番号: {error_context.line_number}
関数: {error_context.function_name}

スタックトレース:
{error_context.stack_trace}

解決策を以下の形式で3つ提案してください：
1. 解決策の説明
2. 実行ステップ（JSON形式）
3. 推定時間（秒）
4. リスクレベル（1-5）
"""
        
        try:
            response = await self.llm_client.generate(prompt, model="gpt-4")
            solutions = self._parse_llm_solutions(response, error_context)
            return solutions
        except Exception as e:
            logger.error(f"LLM解決策生成エラー: {e}")
            return []
    
    def _parse_llm_solutions(self, llm_response: str, error_context: ErrorContext) -> List[DebugSolution]:
        """LLM応答から解決策を解析"""
        # ここでLLMの応答を解析して DebugSolution オブジェクトのリストを作成
        # 実装は簡略化
        return []
    
    async def execute_solution(self, solution: DebugSolution, dry_run: bool = False) -> Dict[str, Any]:
        """解決策の実行"""
        execution_log = {
            "solution_id": solution.solution_id,
            "start_time": datetime.now(),
            "steps_executed": [],
            "success": False,
            "error": None
        }
        
        # 承認が必要な場合
        if solution.requires_approval and not dry_run:
            logger.info(f"解決策 {solution.solution_id} は承認が必要です")
            return execution_log
        
        for step in solution.steps:
            try:
                if dry_run:
                    logger.info(f"[DRY RUN] ステップ実行: {step}")
                else:
                    result = await self._execute_step(step)
                    execution_log["steps_executed"].append({
                        "step": step,
                        "result": result,
                        "timestamp": datetime.now()
                    })
            except Exception as e:
                execution_log["error"] = str(e)
                logger.error(f"ステップ実行エラー: {e}")
                break
        
        execution_log["end_time"] = datetime.now()
        execution_log["success"] = execution_log["error"] is None
        
        return execution_log
    
    async def _execute_step(self, step: Dict[str, Any]) -> Dict[str, Any]:
        """個別ステップの実行"""
        action = step.get("action")
        
        if action == "install_package":
            package = step.get("package")
            result = subprocess.run(
                ["pip", "install", package],
                capture_output=True,
                text=True
            )
            return {
                "success": result.returncode == 0,
                "output": result.stdout,
                "error": result.stderr
            }
        
        elif action == "fix_syntax":
            # 構文修正の実装（簡略化）
            return {"success": True, "message": "構文修正を試みました"}
        
        else:
            return {"success": False, "message": f"未知のアクション: {action}"}
    
    async def monitor_and_fix(self):
        """継続的な監視と自動修正"""
        while True:
            try:
                # ログファイルやメトリクスの監視
                await self._check_system_health()
                await asyncio.sleep(self.config["monitoring_interval"])
            except Exception as e:
                logger.error(f"監視エラー: {e}")
                await asyncio.sleep(60)
    
    async def _check_system_health(self):
        """システムヘルスチェック"""
        # CPU、メモリ、ディスク使用率などをチェック
        # エラーログの監視
        # パフォーマンスメトリクスの確認
        pass
    
    def get_debug_report(self) -> Dict[str, Any]:
        """デバッグレポートの生成"""
        return {
            "total_errors": len(self.error_history),
            "error_types": self._count_error_types(),
            "solutions_generated": len(self.solution_history),
            "recent_errors": [asdict(e) for e in self.error_history[-10:]],
            "system_status": "active",
            "timestamp": datetime.now().isoformat()
        }
    
    def _count_error_types(self) -> Dict[str, int]:
        """エラータイプ別のカウント"""
        counts = {}
        for error in self.error_history:
            error_type = error.error_type.value
            counts[error_type] = counts.get(error_type, 0) + 1
        return counts


# 使用例
async def main():
    """自律デバッグシステムの使用例"""
    from autonomous_system import MultiLLMClient
    
    # LLMクライアントの初期化
    llm_client = MultiLLMClient()
    
    # デバッガーの初期化
    debugger = AutonomousDebugger(llm_client)
    
    # エラーの例
    try:
        import nonexistent_module
    except Exception as e:
        # エラーを分析
        error_context = await debugger.analyze_error(e)
        print(f"エラー分析: {error_context}")
        
        # 解決策を生成
        solutions = await debugger.generate_solutions(error_context)
        print(f"生成された解決策: {len(solutions)}個")
        
        # 最も信頼度の高い解決策を実行（ドライラン）
        if solutions:
            best_solution = solutions[0]
            result = await debugger.execute_solution(best_solution, dry_run=True)
            print(f"実行結果: {result}")
    
    # デバッグレポート
    report = debugger.get_debug_report()
    print(f"デバッグレポート: {json.dumps(report, indent=2, default=str)}")


if __name__ == "__main__":
    asyncio.run(main())