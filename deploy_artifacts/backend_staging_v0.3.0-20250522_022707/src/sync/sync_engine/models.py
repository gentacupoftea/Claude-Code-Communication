"""
同期エンジンの結果と状態のモデル
"""

import json
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, Any, List, Optional, Union


class SyncStatus(Enum):
    """同期ステータス"""
    SUCCESS = "success"
    PARTIAL = "partial"
    FAILED = "failed"
    RUNNING = "running"
    PENDING = "pending"
    CANCELLED = "cancelled"


class SyncType(Enum):
    """同期タイプ"""
    PRODUCTS = "products"
    INVENTORY = "inventory"
    ORDERS = "orders"
    CUSTOMERS = "customers"
    FULL = "full"


@dataclass
class SyncRecord:
    """個別の同期記録"""
    id: str  # 同期対象のID
    source_platform: str  # 同期元プラットフォーム
    target_platform: str  # 同期先プラットフォーム
    sync_type: SyncType  # 同期タイプ
    status: SyncStatus  # 同期ステータス
    timestamp: datetime = field(default_factory=datetime.now)  # 同期実行時刻
    details: Dict[str, Any] = field(default_factory=dict)  # 詳細情報
    error: Optional[str] = None  # エラーメッセージ


@dataclass
class SyncResult:
    """同期の結果"""
    status: SyncStatus  # 全体のステータス
    sync_type: SyncType  # 同期タイプ
    synced_count: int = 0  # 同期成功数
    failed_count: int = 0  # 同期失敗数
    skipped_count: int = 0  # 同期スキップ数
    errors: List[str] = field(default_factory=list)  # エラーリスト
    warnings: List[str] = field(default_factory=list)  # 警告リスト
    start_time: datetime = field(default_factory=datetime.now)  # 開始時刻
    end_time: Optional[datetime] = None  # 終了時刻
    duration: float = 0.0  # 所要時間（秒）
    records: List[SyncRecord] = field(default_factory=list)  # 同期レコード
    
    def is_success(self) -> bool:
        """
        同期が成功したかどうかを確認
        
        Returns:
            成功した場合はTrue
        """
        return self.status in [SyncStatus.SUCCESS, SyncStatus.PARTIAL] and self.failed_count == 0
    
    def to_dict(self) -> Dict[str, Any]:
        """
        辞書形式に変換
        
        Returns:
            辞書形式のデータ
        """
        return {
            "status": self.status.value,
            "sync_type": self.sync_type.value,
            "synced_count": self.synced_count,
            "failed_count": self.failed_count,
            "skipped_count": self.skipped_count,
            "errors": self.errors,
            "warnings": self.warnings,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "duration": self.duration,
            "success_ratio": self.synced_count / max(1, self.synced_count + self.failed_count)
        }
    
    def to_json(self) -> str:
        """
        JSON形式に変換
        
        Returns:
            JSON文字列
        """
        return json.dumps(self.to_dict(), indent=2)
    
    def update_duration(self) -> None:
        """終了時刻を現在時刻に設定し、所要時間を計算"""
        self.end_time = datetime.now()
        self.duration = (self.end_time - self.start_time).total_seconds()
    
    def add_record(self, record: SyncRecord) -> None:
        """
        同期レコードを追加
        
        Args:
            record: 追加する同期レコード
        """
        self.records.append(record)
        
        if record.status == SyncStatus.SUCCESS:
            self.synced_count += 1
        elif record.status == SyncStatus.FAILED:
            self.failed_count += 1
            if record.error:
                self.errors.append(record.error)


@dataclass
class SyncHistory:
    """同期の履歴"""
    results: List[SyncResult] = field(default_factory=list)
    max_size: int = 100  # 保持する結果の最大数
    
    def add_result(self, result: SyncResult) -> None:
        """
        結果を追加し、最大数を超えた場合は古い結果を削除
        
        Args:
            result: 追加する同期結果
        """
        self.results.append(result)
        if len(self.results) > self.max_size:
            self.results = self.results[-self.max_size:]
    
    def get_latest(self, sync_type: Optional[SyncType] = None) -> Optional[SyncResult]:
        """
        最新の同期結果を取得
        
        Args:
            sync_type: 同期タイプでフィルタリング
            
        Returns:
            最新の同期結果、または該当がない場合はNone
        """
        if not self.results:
            return None
            
        if sync_type:
            filtered = [r for r in self.results if r.sync_type == sync_type]
            return filtered[-1] if filtered else None
        
        return self.results[-1]
    
    def get_success_rate(self, sync_type: Optional[SyncType] = None) -> float:
        """
        成功率を計算
        
        Args:
            sync_type: 同期タイプでフィルタリング
            
        Returns:
            成功率（0.0～1.0）
        """
        results = self.results
        if sync_type:
            results = [r for r in results if r.sync_type == sync_type]
        
        if not results:
            return 0.0
        
        total_synced = sum(r.synced_count for r in results)
        total_failed = sum(r.failed_count for r in results)
        
        if total_synced + total_failed == 0:
            return 0.0
            
        return total_synced / (total_synced + total_failed)
    
    def to_dict(self) -> Dict[str, Any]:
        """
        辞書形式に変換
        
        Returns:
            辞書形式のデータ
        """
        return {
            "results": [r.to_dict() for r in self.results],
            "total_count": len(self.results),
            "success_rate": self.get_success_rate()
        }
    
    def to_json(self) -> str:
        """
        JSON形式に変換
        
        Returns:
            JSON文字列
        """
        return json.dumps(self.to_dict(), indent=2)