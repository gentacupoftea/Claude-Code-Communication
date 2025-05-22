"""在庫アラート管理システム"""
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from decimal import Decimal
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, and_, or_
from sqlalchemy.dialects.postgresql import insert as pg_insert

from ..models.inventory import (
    Inventory, InventoryAlerts, InventoryAlertHistory, InventoryAnalytics
)
from ..database import get_db_session
from ..notifications import NotificationService
from ..cache import get_redis_client

logger = logging.getLogger(__name__)


class InventoryAlertManager:
    """在庫アラートの作成、管理、トリガーを担当"""
    
    def __init__(self, notification_service: NotificationService):
        self.notification_service = notification_service
        self.redis = get_redis_client()
    
    async def create_alert(
        self,
        variant_id: str,
        alert_type: str,
        threshold_type: str,
        threshold_value: Optional[int] = None,
        threshold_percentage: Optional[Decimal] = None,
        notification_channels: List[str] = None,
        priority: str = "medium",
        location_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """新規アラートを作成"""
        if notification_channels is None:
            notification_channels = ["in_app"]
        
        async with get_db_session() as session:
            # 既存の同じタイプのアラートがあるか確認
            stmt = select(InventoryAlerts).where(
                and_(
                    InventoryAlerts.variant_id == variant_id,
                    InventoryAlerts.alert_type == alert_type,
                    InventoryAlerts.location_id == location_id,
                    InventoryAlerts.is_active == True
                )
            )
            existing = await session.execute(stmt)
            if existing.scalar_one_or_none():
                raise ValueError(f"Alert of type {alert_type} already exists for variant {variant_id}")
            
            # 新規アラートを作成
            alert = InventoryAlerts(
                variant_id=variant_id,
                location_id=location_id,
                alert_type=alert_type,
                threshold_type=threshold_type,
                threshold_value=threshold_value,
                threshold_percentage=threshold_percentage,
                notification_channels=notification_channels,
                priority=priority,
                status="active"
            )
            
            session.add(alert)
            await session.commit()
            await session.refresh(alert)
            
            logger.info(f"Created alert {alert.id} for variant {variant_id}")
            
            return self._alert_to_dict(alert)
    
    async def update_alert(
        self,
        alert_id: str,
        **kwargs
    ) -> Dict[str, Any]:
        """既存のアラートを更新"""
        async with get_db_session() as session:
            stmt = select(InventoryAlerts).where(InventoryAlerts.id == alert_id)
            result = await session.execute(stmt)
            alert = result.scalar_one_or_none()
            
            if not alert:
                raise ValueError(f"Alert {alert_id} not found")
            
            # 更新可能なフィールドのみ更新
            updatable_fields = [
                'threshold_type', 'threshold_value', 'threshold_percentage',
                'notification_channels', 'priority', 'is_active'
            ]
            
            for field in updatable_fields:
                if field in kwargs:
                    setattr(alert, field, kwargs[field])
            
            alert.updated_at = datetime.utcnow()
            await session.commit()
            await session.refresh(alert)
            
            logger.info(f"Updated alert {alert_id}")
            
            return self._alert_to_dict(alert)
    
    async def delete_alert(self, alert_id: str) -> None:
        """アラートを削除（無効化）"""
        async with get_db_session() as session:
            stmt = update(InventoryAlerts).where(
                InventoryAlerts.id == alert_id
            ).values(
                is_active=False,
                status="deleted",
                updated_at=datetime.utcnow()
            )
            
            await session.execute(stmt)
            await session.commit()
            
            logger.info(f"Deleted alert {alert_id}")
    
    async def check_alerts(self, variant_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """アラートをチェックし、必要に応じてトリガー"""
        triggered_alerts = []
        
        async with get_db_session() as session:
            # アクティブなアラートを取得
            stmt = select(InventoryAlerts).where(
                InventoryAlerts.is_active == True
            )
            
            if variant_id:
                stmt = stmt.where(InventoryAlerts.variant_id == variant_id)
            
            result = await session.execute(stmt)
            alerts = result.scalars().all()
            
            for alert in alerts:
                triggered = await self._check_single_alert(session, alert)
                if triggered:
                    triggered_alerts.append(self._alert_to_dict(alert))
        
        return triggered_alerts
    
    async def _check_single_alert(
        self,
        session: AsyncSession,
        alert: InventoryAlerts
    ) -> bool:
        """単一のアラートをチェック"""
        # 在庫情報を取得
        stmt = select(Inventory).where(
            and_(
                Inventory.variant_id == alert.variant_id,
                Inventory.location_id == alert.location_id
            )
        )
        result = await session.execute(stmt)
        inventory = result.scalar_one_or_none()
        
        if not inventory:
            return False
        
        # アラートタイプに応じてチェック
        should_trigger = False
        current_value = None
        
        if alert.alert_type == "low_stock":
            should_trigger, current_value = self._check_low_stock_alert(
                inventory, alert
            )
        elif alert.alert_type == "out_of_stock":
            should_trigger = inventory.available_quantity == 0
            current_value = inventory.available_quantity
        elif alert.alert_type == "overstock":
            should_trigger, current_value = await self._check_overstock_alert(
                session, inventory, alert
            )
        
        if should_trigger:
            await self._trigger_alert(session, alert, current_value)
            return True
        
        return False
    
    def _check_low_stock_alert(
        self,
        inventory: Inventory,
        alert: InventoryAlerts
    ) -> Tuple[bool, int]:
        """低在庫アラートをチェック"""
        current_quantity = inventory.available_quantity
        
        if alert.threshold_type == "quantity":
            should_trigger = current_quantity <= alert.threshold_value
        else:  # percentage
            # 最大在庫量に対する割合として計算
            max_quantity = inventory.on_hand_quantity + inventory.reserved_quantity
            if max_quantity > 0:
                current_percentage = (current_quantity / max_quantity) * 100
                should_trigger = current_percentage <= alert.threshold_percentage
            else:
                should_trigger = False
        
        return should_trigger, current_quantity
    
    async def _check_overstock_alert(
        self,
        session: AsyncSession,
        inventory: Inventory,
        alert: InventoryAlerts
    ) -> Tuple[bool, Optional[Any]]:
        """過剰在庫アラートをチェック"""
        # 最新の分析結果を取得
        stmt = select(InventoryAnalytics).where(
            InventoryAnalytics.variant_id == inventory.variant_id
        ).order_by(
            InventoryAnalytics.analysis_date.desc()
        ).limit(1)
        
        result = await session.execute(stmt)
        analytics = result.scalar_one_or_none()
        
        if not analytics:
            return False, None
        
        # 在庫回転率と在庫日数でチェック
        if alert.threshold_type == "days":
            # 在庫日数が閾値を超えている
            should_trigger = analytics.stock_days_remaining > alert.threshold_value
            return should_trigger, analytics.stock_days_remaining
        else:
            # 回転率が低い
            turnover_threshold = alert.threshold_value / 100  # 例: 2 = 0.02
            should_trigger = analytics.turnover_rate < turnover_threshold
            return should_trigger, analytics.turnover_rate
    
    async def _trigger_alert(
        self,
        session: AsyncSession,
        alert: InventoryAlerts,
        current_value: Any
    ) -> None:
        """アラートをトリガー"""
        # アラート履歴に記録
        history = InventoryAlertHistory(
            alert_id=alert.id,
            alert_value=current_value,
            notification_channels=alert.notification_channels
        )
        session.add(history)
        
        # アラートのステータスを更新
        alert.last_triggered_at = datetime.utcnow()
        alert.status = "triggered"
        alert.current_value = current_value
        
        # 通知を送信
        try:
            await self._send_notifications(alert, current_value)
            history.notification_sent = True
        except Exception as e:
            logger.error(f"Failed to send notifications for alert {alert.id}: {e}")
            history.error_message = str(e)
            history.notification_sent = False
        
        await session.commit()
    
    async def _send_notifications(
        self,
        alert: InventoryAlerts,
        current_value: Any
    ) -> None:
        """アラート通知を送信"""
        # 在庫情報を取得して通知メッセージを作成
        message = self._create_alert_message(alert, current_value)
        
        for channel in alert.notification_channels:
            if channel == "email":
                await self.notification_service.send_email(
                    subject=f"在庫アラート: {alert.alert_type}",
                    body=message,
                    priority=alert.priority
                )
            elif channel == "webhook":
                await self.notification_service.send_webhook(
                    event_type=f"inventory.{alert.alert_type}",
                    data={
                        "alert_id": str(alert.id),
                        "variant_id": alert.variant_id,
                        "alert_type": alert.alert_type,
                        "current_value": current_value,
                        "threshold_value": alert.threshold_value,
                        "threshold_percentage": float(alert.threshold_percentage) if alert.threshold_percentage else None,
                        "priority": alert.priority
                    }
                )
            elif channel == "in_app":
                await self._store_in_app_notification(alert, message)
    
    def _create_alert_message(
        self,
        alert: InventoryAlerts,
        current_value: Any
    ) -> str:
        """アラートメッセージを作成"""
        messages = {
            "low_stock": f"低在庫アラート: バリアント {alert.variant_id} の在庫が {current_value} になりました。",
            "out_of_stock": f"在庫切れアラート: バリアント {alert.variant_id} が在庫切れになりました。",
            "overstock": f"過剰在庫アラート: バリアント {alert.variant_id} の在庫が過剰です。現在の値: {current_value}"
        }
        
        return messages.get(alert.alert_type, f"在庫アラート: {alert.alert_type}")
    
    async def _store_in_app_notification(
        self,
        alert: InventoryAlerts,
        message: str
    ) -> None:
        """アプリ内通知を保存"""
        notification_data = {
            "id": str(uuid4()),
            "alert_id": str(alert.id),
            "variant_id": alert.variant_id,
            "alert_type": alert.alert_type,
            "message": message,
            "priority": alert.priority,
            "created_at": datetime.utcnow().isoformat(),
            "is_read": False
        }
        
        # Redisに保存（TTL: 7日間）
        await self.redis.setex(
            f"notifications:inventory:{notification_data['id']}",
            604800,  # 7日間
            json.dumps(notification_data)
        )
        
        # 未読通知リストに追加
        await self.redis.lpush(
            "notifications:unread",
            notification_data['id']
        )
    
    async def get_alerts(
        self,
        variant_id: Optional[str] = None,
        alert_type: Optional[str] = None,
        status: Optional[str] = None,
        is_active: Optional[bool] = True
    ) -> List[Dict[str, Any]]:
        """アラート一覧を取得"""
        async with get_db_session() as session:
            stmt = select(InventoryAlerts)
            
            if variant_id:
                stmt = stmt.where(InventoryAlerts.variant_id == variant_id)
            if alert_type:
                stmt = stmt.where(InventoryAlerts.alert_type == alert_type)
            if status:
                stmt = stmt.where(InventoryAlerts.status == status)
            if is_active is not None:
                stmt = stmt.where(InventoryAlerts.is_active == is_active)
            
            result = await session.execute(stmt)
            alerts = result.scalars().all()
            
            return [self._alert_to_dict(alert) for alert in alerts]
    
    def _alert_to_dict(self, alert: InventoryAlerts) -> Dict[str, Any]:
        """アラートオブジェクトを辞書に変換"""
        return {
            "id": str(alert.id),
            "variant_id": alert.variant_id,
            "location_id": alert.location_id,
            "alert_type": alert.alert_type,
            "threshold_type": alert.threshold_type,
            "threshold_value": alert.threshold_value,
            "threshold_percentage": float(alert.threshold_percentage) if alert.threshold_percentage else None,
            "current_value": alert.current_value,
            "notification_channels": alert.notification_channels,
            "priority": alert.priority,
            "status": alert.status,
            "last_triggered_at": alert.last_triggered_at.isoformat() if alert.last_triggered_at else None,
            "is_active": alert.is_active,
            "created_at": alert.created_at.isoformat(),
            "updated_at": alert.updated_at.isoformat()
        }