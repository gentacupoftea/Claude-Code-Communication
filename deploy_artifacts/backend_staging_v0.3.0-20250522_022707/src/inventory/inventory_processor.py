"""在庫データ処理・分析ロジック"""
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from decimal import Decimal
import numpy as np
import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_

from ..models.inventory import Inventory, InventoryHistory, InventoryAnalytics
from ..models.orders import Order, OrderLineItem
from ..database import get_db_session
from ..cache import get_redis_client

logger = logging.getLogger(__name__)


class InventoryProcessor:
    """在庫データの処理と分析を行うクラス"""
    
    def __init__(self):
        self.redis = get_redis_client()
    
    async def calculate_turnover_rate(
        self,
        variant_id: str,
        period_days: int = 30
    ) -> Decimal:
        """在庫回転率を計算"""
        async with get_db_session() as session:
            # 期間中の売上個数を取得
            start_date = datetime.utcnow() - timedelta(days=period_days)
            
            stmt = select(
                func.sum(OrderLineItem.quantity)
            ).join(
                Order
            ).where(
                and_(
                    OrderLineItem.variant_id == variant_id,
                    Order.created_at >= start_date,
                    Order.financial_status == 'paid'
                )
            )
            
            result = await session.execute(stmt)
            total_sold = result.scalar() or 0
            
            # 平均在庫数を取得
            stmt = select(
                func.avg(InventoryHistory.new_quantity)
            ).join(
                Inventory
            ).where(
                and_(
                    Inventory.variant_id == variant_id,
                    InventoryHistory.changed_at >= start_date
                )
            )
            
            result = await session.execute(stmt)
            avg_inventory = result.scalar() or 1  # ゼロ除算を避ける
            
            # 年間換算の回転率
            turnover_rate = (Decimal(total_sold) / Decimal(avg_inventory)) * (365 / period_days)
            
            return round(turnover_rate, 4)
    
    async def predict_stockout_date(
        self,
        variant_id: str,
        lookback_days: int = 30
    ) -> Optional[datetime]:
        """在庫切れ予測日を計算"""
        async with get_db_session() as session:
            # 現在の在庫数を取得
            stmt = select(Inventory).where(Inventory.variant_id == variant_id)
            result = await session.execute(stmt)
            inventory = result.scalar_one_or_none()
            
            if not inventory or inventory.available_quantity <= 0:
                return None
            
            # 過去の売上データを取得
            start_date = datetime.utcnow() - timedelta(days=lookback_days)
            
            stmt = select(
                func.date(Order.created_at),
                func.sum(OrderLineItem.quantity)
            ).join(
                Order
            ).where(
                and_(
                    OrderLineItem.variant_id == variant_id,
                    Order.created_at >= start_date,
                    Order.financial_status == 'paid'
                )
            ).group_by(
                func.date(Order.created_at)
            )
            
            result = await session.execute(stmt)
            daily_sales = result.fetchall()
            
            if not daily_sales:
                return None
            
            # 日別売上データをDataFrameに変換
            df = pd.DataFrame(daily_sales, columns=['date', 'quantity'])
            avg_daily_sales = df['quantity'].mean()
            
            if avg_daily_sales <= 0:
                return None
            
            # 在庫切れまでの日数を計算
            days_until_stockout = int(inventory.available_quantity / avg_daily_sales)
            
            return datetime.utcnow() + timedelta(days=days_until_stockout)
    
    async def analyze_inventory_health(
        self,
        variant_id: str
    ) -> Dict[str, Any]:
        """在庫の健全性を分析"""
        async with get_db_session() as session:
            # 在庫情報を取得
            stmt = select(Inventory).where(Inventory.variant_id == variant_id)
            result = await session.execute(stmt)
            inventory = result.scalar_one_or_none()
            
            if not inventory:
                return {"error": "Inventory not found"}
            
            # 分析結果を格納
            analysis = {
                "variant_id": variant_id,
                "current_stock": inventory.available_quantity,
                "last_updated": inventory.last_updated
            }
            
            # 回転率を計算
            turnover_rate = await self.calculate_turnover_rate(variant_id)
            analysis["turnover_rate"] = float(turnover_rate)
            
            # 在庫切れ予測
            stockout_date = await self.predict_stockout_date(variant_id)
            if stockout_date:
                analysis["predicted_stockout_date"] = stockout_date
                analysis["days_until_stockout"] = (
                    stockout_date - datetime.utcnow()
                ).days
            
            # 在庫レベルの評価
            analysis["stock_level_status"] = self._evaluate_stock_level(
                inventory.available_quantity,
                turnover_rate
            )
            
            # ABC分析
            analysis["abc_classification"] = await self._abc_classification(variant_id)
            
            # 季節性分析
            seasonal_factor = await self._analyze_seasonality(variant_id)
            analysis["seasonal_factor"] = float(seasonal_factor)
            
            # 推奨発注点
            reorder_point = await self._calculate_reorder_point(variant_id)
            analysis["reorder_point"] = reorder_point
            
            # 結果をキャッシュ
            await self._cache_analysis_result(variant_id, analysis)
            
            return analysis
    
    def _evaluate_stock_level(
        self,
        current_stock: int,
        turnover_rate: Decimal
    ) -> str:
        """在庫レベルの評価"""
        if current_stock == 0:
            return "out_of_stock"
        elif turnover_rate > 12:  # 高回転商品
            if current_stock < 10:
                return "critically_low"
            elif current_stock < 50:
                return "low"
            else:
                return "healthy"
        elif turnover_rate > 4:  # 中回転商品
            if current_stock < 5:
                return "low"
            elif current_stock > 100:
                return "overstock"
            else:
                return "healthy"
        else:  # 低回転商品
            if current_stock > 50:
                return "overstock"
            else:
                return "healthy"
    
    async def _abc_classification(self, variant_id: str) -> str:
        """ABC分析による商品分類"""
        async with get_db_session() as session:
            # 過去90日間の売上データを取得
            start_date = datetime.utcnow() - timedelta(days=90)
            
            # 全商品の売上を取得
            stmt = select(
                OrderLineItem.variant_id,
                func.sum(OrderLineItem.quantity * OrderLineItem.price).label('revenue')
            ).join(
                Order
            ).where(
                and_(
                    Order.created_at >= start_date,
                    Order.financial_status == 'paid'
                )
            ).group_by(
                OrderLineItem.variant_id
            ).order_by(
                func.sum(OrderLineItem.quantity * OrderLineItem.price).desc()
            )
            
            result = await session.execute(stmt)
            all_sales = result.fetchall()
            
            if not all_sales:
                return 'C'
            
            # 累積売上を計算
            total_revenue = sum(sale[1] for sale in all_sales)
            cumulative_revenue = 0
            
            for i, (var_id, revenue) in enumerate(all_sales):
                cumulative_revenue += revenue
                cumulative_percentage = cumulative_revenue / total_revenue
                
                if var_id == variant_id:
                    if cumulative_percentage <= 0.7:  # 上位70%
                        return 'A'
                    elif cumulative_percentage <= 0.9:  # 上位90%
                        return 'B'
                    else:
                        return 'C'
            
            return 'C'  # デフォルト
    
    async def _analyze_seasonality(self, variant_id: str) -> Decimal:
        """季節性分析"""
        async with get_db_session() as session:
            # 過去12ヶ月のデータを取得
            start_date = datetime.utcnow() - timedelta(days=365)
            
            stmt = select(
                func.extract('month', Order.created_at).label('month'),
                func.sum(OrderLineItem.quantity).label('quantity')
            ).join(
                Order
            ).where(
                and_(
                    OrderLineItem.variant_id == variant_id,
                    Order.created_at >= start_date,
                    Order.financial_status == 'paid'
                )
            ).group_by(
                func.extract('month', Order.created_at)
            )
            
            result = await session.execute(stmt)
            monthly_sales = result.fetchall()
            
            if len(monthly_sales) < 3:
                return Decimal('1.0')
            
            # 月別売上データをDataFrameに変換
            df = pd.DataFrame(monthly_sales, columns=['month', 'quantity'])
            
            # 現在月の季節性係数を計算
            current_month = datetime.utcnow().month
            avg_sales = df['quantity'].mean()
            
            current_month_sales = df[df['month'] == current_month]['quantity'].values
            if len(current_month_sales) > 0 and avg_sales > 0:
                seasonal_factor = current_month_sales[0] / avg_sales
            else:
                seasonal_factor = 1.0
            
            return Decimal(str(seasonal_factor))
    
    async def _calculate_reorder_point(
        self,
        variant_id: str,
        lead_time_days: int = 7
    ) -> int:
        """発注点を計算"""
        # 平均日次需要を計算
        avg_daily_demand = await self._get_average_daily_demand(variant_id)
        
        # 安全在庫を計算（需要の標準偏差 × サービスレベル係数）
        demand_std = await self._get_demand_standard_deviation(variant_id)
        service_level_multiplier = 1.65  # 95%サービスレベル
        safety_stock = demand_std * service_level_multiplier
        
        # 発注点 = (平均日次需要 × リードタイム) + 安全在庫
        reorder_point = int((avg_daily_demand * lead_time_days) + safety_stock)
        
        return max(reorder_point, 1)  # 最小値は1
    
    async def _get_average_daily_demand(self, variant_id: str) -> float:
        """平均日次需要を取得"""
        async with get_db_session() as session:
            start_date = datetime.utcnow() - timedelta(days=30)
            
            stmt = select(
                func.sum(OrderLineItem.quantity)
            ).join(
                Order
            ).where(
                and_(
                    OrderLineItem.variant_id == variant_id,
                    Order.created_at >= start_date,
                    Order.financial_status == 'paid'
                )
            )
            
            result = await session.execute(stmt)
            total_demand = result.scalar() or 0
            
            return total_demand / 30
    
    async def _get_demand_standard_deviation(self, variant_id: str) -> float:
        """需要の標準偏差を取得"""
        async with get_db_session() as session:
            start_date = datetime.utcnow() - timedelta(days=30)
            
            stmt = select(
                func.date(Order.created_at),
                func.sum(OrderLineItem.quantity)
            ).join(
                Order
            ).where(
                and_(
                    OrderLineItem.variant_id == variant_id,
                    Order.created_at >= start_date,
                    Order.financial_status == 'paid'
                )
            ).group_by(
                func.date(Order.created_at)
            )
            
            result = await session.execute(stmt)
            daily_sales = result.fetchall()
            
            if not daily_sales:
                return 0.0
            
            # 日別売上データをDataFrameに変換
            df = pd.DataFrame(daily_sales, columns=['date', 'quantity'])
            
            # 全日付を生成（売上がない日は0）
            date_range = pd.date_range(start_date, datetime.utcnow(), freq='D')
            full_df = pd.DataFrame({'date': date_range})
            full_df = full_df.merge(df, on='date', how='left').fillna(0)
            
            return float(full_df['quantity'].std())
    
    async def _cache_analysis_result(
        self,
        variant_id: str,
        analysis: Dict[str, Any]
    ) -> None:
        """分析結果をキャッシュ"""
        try:
            cache_key = f"inventory:analysis:{variant_id}"
            await self.redis.setex(
                cache_key,
                3600,  # 1時間
                json.dumps(analysis, default=str)
            )
        except Exception as e:
            logger.error(f"Failed to cache analysis result: {e}")
    
    async def batch_analyze_inventory(
        self,
        variant_ids: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """複数の在庫を一括分析"""
        results = []
        
        if variant_ids is None:
            # 全在庫を対象にする
            async with get_db_session() as session:
                stmt = select(Inventory.variant_id)
                result = await session.execute(stmt)
                variant_ids = [row[0] for row in result.fetchall()]
        
        for variant_id in variant_ids:
            try:
                analysis = await self.analyze_inventory_health(variant_id)
                results.append(analysis)
            except Exception as e:
                logger.error(f"Failed to analyze variant {variant_id}: {e}")
                results.append({
                    "variant_id": variant_id,
                    "error": str(e)
                })
        
        return results