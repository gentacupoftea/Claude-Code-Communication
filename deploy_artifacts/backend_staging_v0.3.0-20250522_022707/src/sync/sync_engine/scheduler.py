"""
同期スケジューラー
"""

import asyncio
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List

from .models import SyncType, SyncStatus
from .engine import SyncEngine

logger = logging.getLogger(__name__)


class SyncScheduler:
    """同期エンジンのスケジューラー"""
    
    def __init__(self, sync_engine: SyncEngine):
        """
        初期化
        
        Args:
            sync_engine: 同期エンジン
        """
        self.sync_engine = sync_engine
        self.is_running = False
        self.scheduler_task = None
        self.scheduled_tasks = {}
        self.last_run = {}
        self.sync_attempts = {}
    
    async def start(self) -> bool:
        """
        スケジューラーの開始
        
        Returns:
            開始成功の場合はTrue
        """
        if self.is_running:
            logger.warning("スケジューラーは既に実行中です")
            return False
        
        # 同期エンジンの初期化
        if not await self.sync_engine.start():
            logger.error("同期エンジンの初期化に失敗したため、スケジューラーを開始できません")
            return False
        
        self.is_running = True
        self.scheduler_task = asyncio.create_task(self._run_scheduler())
        logger.info("同期スケジューラーを開始しました")
        return True
    
    async def stop(self) -> None:
        """スケジューラーの停止"""
        self.is_running = False
        logger.info("同期スケジューラーを停止しています")
        
        if self.scheduler_task:
            self.scheduler_task.cancel()
            try:
                await self.scheduler_task
            except asyncio.CancelledError:
                pass
        
        # 同期エンジンも停止
        await self.sync_engine.stop()
        
        logger.info("同期スケジューラーを停止しました")
    
    async def _run_scheduler(self) -> None:
        """スケジューラのメインループ"""
        config = self.sync_engine.config
        
        # 最初の同期をすぐに実行
        await self._run_initial_sync()
        
        while self.is_running:
            try:
                current_time = time.time()
                
                # 商品同期
                if config.sync_products:
                    await self._schedule_sync_if_needed(
                        SyncType.PRODUCTS,
                        self.sync_engine.sync_products,
                        config.sync_interval
                    )
                
                # 注文同期（より頻繁に）
                if config.sync_orders:
                    await self._schedule_sync_if_needed(
                        SyncType.ORDERS,
                        self.sync_engine.sync_orders,
                        int(config.sync_interval / 2)  # 注文は半分の間隔で同期
                    )
                
                # 在庫同期
                if config.sync_inventory:
                    await self._schedule_sync_if_needed(
                        SyncType.INVENTORY,
                        self.sync_engine.sync_inventory,
                        config.sync_interval
                    )
                
                # 短い間隔でチェック
                await asyncio.sleep(10)
                
            except asyncio.CancelledError:
                break
                
            except Exception as e:
                logger.error(f"スケジューラーでエラーが発生: {e}", exc_info=True)
                await asyncio.sleep(60)  # エラー後は長めに待機
    
    async def _run_initial_sync(self) -> None:
        """初回の同期を実行"""
        logger.info("初回の全データ同期を開始")
        
        try:
            await self.sync_engine.sync_all()
            
            # 最終実行時刻を記録
            for sync_type in [SyncType.PRODUCTS, SyncType.ORDERS, SyncType.INVENTORY]:
                self.last_run[sync_type] = time.time()
                self.sync_attempts[sync_type] = 0
            
            logger.info("初回の全データ同期が完了")
            
        except Exception as e:
            logger.error(f"初回同期でエラーが発生: {e}", exc_info=True)
    
    async def _schedule_sync_if_needed(self, 
                                     sync_type: SyncType, 
                                     sync_func, 
                                     interval: int) -> None:
        """
        必要に応じて同期をスケジュール
        
        Args:
            sync_type: 同期タイプ
            sync_func: 実行する同期関数
            interval: 同期間隔（秒）
        """
        current_time = time.time()
        last_time = self.last_run.get(sync_type, 0)
        
        # 既にタスクが実行中かチェック
        if sync_type in self.scheduled_tasks and not self.scheduled_tasks[sync_type].done():
            return
        
        # 実行すべき時間かチェック
        if current_time - last_time >= interval:
            logger.info(f"{sync_type.value} 同期をスケジュール")
            self.last_run[sync_type] = current_time
            self.scheduled_tasks[sync_type] = asyncio.create_task(self._run_sync(sync_type, sync_func))
    
    async def _run_sync(self, sync_type: SyncType, sync_func) -> None:
        """
        同期を実行し、エラーハンドリングを行う
        
        Args:
            sync_type: 同期タイプ
            sync_func: 実行する同期関数
        """
        try:
            logger.info(f"{sync_type.value} 同期を開始")
            result = await sync_func()
            
            if result.status == SyncStatus.SUCCESS:
                # 成功したら試行回数をリセット
                self.sync_attempts[sync_type] = 0
                logger.info(f"{sync_type.value} 同期が成功")
                
            elif result.status == SyncStatus.PARTIAL:
                # 部分的成功の場合、警告を記録
                logger.warning(f"{sync_type.value} 同期が部分的に成功 (成功: {result.synced_count}, 失敗: {result.failed_count})")
                
            else:
                # 失敗の場合、リトライ回数をインクリメント
                self.sync_attempts[sync_type] = self.sync_attempts.get(sync_type, 0) + 1
                retry_count = self.sync_attempts[sync_type]
                logger.error(f"{sync_type.value} 同期が失敗 (試行: {retry_count})")
                
                # エラーを記録
                for error in result.errors:
                    logger.error(f"{sync_type.value} 同期エラー: {error}")
                
                # バックオフロジック (指数バックオフ)
                if retry_count > 0:
                    backoff = min(60 * 2 ** (retry_count - 1), 3600)  # 最大1時間
                    self.last_run[sync_type] = time.time() - self.sync_engine.config.sync_interval + backoff
                    logger.info(f"{sync_type.value} 同期の次回試行は {backoff} 秒後")
            
        except Exception as e:
            # 予期しないエラーの処理
            logger.error(f"{sync_type.value} 同期中に予期しないエラーが発生: {e}", exc_info=True)
            
            # リトライ回数をインクリメント
            self.sync_attempts[sync_type] = self.sync_attempts.get(sync_type, 0) + 1
            retry_count = self.sync_attempts[sync_type]
            
            # バックオフロジック
            if retry_count > 0:
                backoff = min(60 * 2 ** (retry_count - 1), 3600)  # 最大1時間
                self.last_run[sync_type] = time.time() - self.sync_engine.config.sync_interval + backoff
        
        finally:
            # 完了したタスクを削除
            if sync_type in self.scheduled_tasks:
                del self.scheduled_tasks[sync_type]
    
    def get_schedule_status(self) -> Dict[str, Any]:
        """
        スケジュール状態を取得
        
        Returns:
            スケジュール状態の辞書
        """
        current_time = time.time()
        status = {
            "is_running": self.is_running,
            "scheduled_tasks": {},
            "next_runs": {}
        }
        
        # 現在のタスク状態
        for sync_type in [SyncType.PRODUCTS, SyncType.ORDERS, SyncType.INVENTORY]:
            if sync_type in self.scheduled_tasks:
                task = self.scheduled_tasks[sync_type]
                status["scheduled_tasks"][sync_type.value] = {
                    "running": not task.done(),
                    "done": task.done(),
                    "exception": str(task.exception()) if task.done() and task.exception() else None
                }
            
            # 次回実行予定時刻
            last_run = self.last_run.get(sync_type, 0)
            interval = (self.sync_engine.config.sync_interval / 2
                       if sync_type == SyncType.ORDERS
                       else self.sync_engine.config.sync_interval)
            
            next_run = last_run + interval
            time_to_next = max(0, next_run - current_time)
            
            status["next_runs"][sync_type.value] = {
                "last_run": datetime.fromtimestamp(last_run).isoformat() if last_run > 0 else None,
                "next_run": datetime.fromtimestamp(next_run).isoformat() if last_run > 0 else None,
                "seconds_to_next": int(time_to_next),
                "attempts": self.sync_attempts.get(sync_type, 0)
            }
        
        return status