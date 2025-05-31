from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from decimal import Decimal
import pandas as pd
import numpy as np
from ..models.base import IntegrationData, OrderData, CustomerData
from ..models.analytics import PerformanceMetrics, MetricCard
from ..services.integration_service import IntegrationService


class PerformanceAnalyzer:
    """パフォーマンス分析エンジン"""
    
    def __init__(self, integration_service: IntegrationService):
        self.integration_service = integration_service
    
    async def analyze_performance(
        self,
        start_date: datetime,
        end_date: datetime,
        dimension: str = "overall"
    ) -> PerformanceMetrics:
        """
        パフォーマンス分析を実行
        
        Args:
            start_date: 開始日
            end_date: 終了日
            dimension: 分析次元（overall, channel, product, region）
        """
        # データ取得
        data = await self.integration_service.get_integrated_data(
            source="all",
            entity_type="order",
            start_date=start_date,
            end_date=end_date
        )
        
        # DataFrameに変換
        df = self._to_dataframe(data)
        
        # 基本指標の計算
        metrics = self._calculate_base_metrics(df)
        
        # 次元別分析
        if dimension != "overall":
            breakdown = self._analyze_by_dimension(df, dimension)
            metrics["breakdown"] = breakdown
        
        # 時系列トレンド
        trends = self._calculate_trends(df, start_date, end_date)
        metrics["trends"] = trends
        
        # 前期比較
        comparison = await self._calculate_comparison(start_date, end_date)
        metrics["comparison"] = comparison
        
        return PerformanceMetrics(**metrics)
    
    def _to_dataframe(self, data: List[IntegrationData]) -> pd.DataFrame:
        """データをDataFrameに変換"""
        records = []
        for item in data:
            base_record = {
                "id": item.id,
                "source": item.source,
                "created_at": item.created_at,
                "updated_at": item.updated_at
            }
            
            if isinstance(item.data, OrderData):
                base_record.update({
                    "amount": float(item.data.total_amount),
                    "customer_id": item.data.customer_id,
                    "status": item.data.status,
                    "channel": item.metadata.get("channel", "direct"),
                    "region": item.metadata.get("region", "unknown")
                })
            
            records.append(base_record)
        
        return pd.DataFrame(records)
    
    def _calculate_base_metrics(self, df: pd.DataFrame) -> Dict[str, Any]:
        """基本指標を計算"""
        return {
            "total_revenue": float(df["amount"].sum()),
            "total_orders": len(df),
            "average_order_value": float(df["amount"].mean()),
            "unique_customers": df["customer_id"].nunique(),
            "conversion_rate": self._calculate_conversion_rate(df),
            "repeat_rate": self._calculate_repeat_rate(df)
        }
    
    def _analyze_by_dimension(self, df: pd.DataFrame, dimension: str) -> Dict[str, Any]:
        """次元別分析"""
        grouped = df.groupby(dimension).agg({
            "amount": ["sum", "mean", "count"],
            "customer_id": "nunique"
        })
        
        results = {}
        for index, row in grouped.iterrows():
            results[index] = {
                "revenue": float(row["amount"]["sum"]),
                "orders": int(row["amount"]["count"]),
                "avg_order_value": float(row["amount"]["mean"]),
                "unique_customers": int(row["customer_id"]["nunique"])
            }
        
        return results
    
    def _calculate_trends(self, df: pd.DataFrame, start_date: datetime, end_date: datetime) -> Dict[str, List]:
        """時系列トレンドを計算"""
        df["date"] = pd.to_datetime(df["created_at"]).dt.date
        daily = df.groupby("date").agg({
            "amount": "sum",
            "id": "count"
        }).reset_index()
        
        return {
            "dates": daily["date"].tolist(),
            "revenue": daily["amount"].tolist(),
            "orders": daily["id"].tolist()
        }
    
    async def _calculate_comparison(self, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """前期比較を計算"""
        period_length = (end_date - start_date).days
        prev_start = start_date - timedelta(days=period_length)
        prev_end = start_date
        
        # 前期データ取得
        prev_data = await self.integration_service.get_integrated_data(
            source="all",
            entity_type="order",
            start_date=prev_start,
            end_date=prev_end
        )
        
        prev_df = self._to_dataframe(prev_data)
        prev_metrics = self._calculate_base_metrics(prev_df)
        
        # 変化率計算
        comparison = {}
        for key in prev_metrics:
            current_value = self._current_metrics.get(key, 0)
            prev_value = prev_metrics.get(key, 0)
            if prev_value != 0:
                change_rate = (current_value - prev_value) / prev_value * 100
                comparison[key] = {
                    "current": current_value,
                    "previous": prev_value,
                    "change_rate": round(change_rate, 2)
                }
        
        return comparison
    
    def _calculate_conversion_rate(self, df: pd.DataFrame) -> float:
        """コンバージョン率を計算"""
        # 仮の計算（実際は訪問者数が必要）
        return round(len(df) / (len(df) * 1.5) * 100, 2)
    
    def _calculate_repeat_rate(self, df: pd.DataFrame) -> float:
        """リピート率を計算"""
        customer_orders = df.groupby("customer_id").size()
        repeat_customers = len(customer_orders[customer_orders > 1])
        total_customers = len(customer_orders)
        
        if total_customers == 0:
            return 0.0
        
        return round(repeat_customers / total_customers * 100, 2)
    
    async def create_metric_cards(self, metrics: PerformanceMetrics) -> List[MetricCard]:
        """メトリックカードを作成"""
        cards = [
            MetricCard(
                title="売上高",
                value=f"¥{metrics.total_revenue:,.0f}",
                change=metrics.comparison.get("total_revenue", {}).get("change_rate", 0),
                trend="up" if metrics.comparison.get("total_revenue", {}).get("change_rate", 0) > 0 else "down"
            ),
            MetricCard(
                title="注文数",
                value=str(metrics.total_orders),
                change=metrics.comparison.get("total_orders", {}).get("change_rate", 0),
                trend="up" if metrics.comparison.get("total_orders", {}).get("change_rate", 0) > 0 else "down"
            ),
            MetricCard(
                title="平均注文額",
                value=f"¥{metrics.average_order_value:,.0f}",
                change=metrics.comparison.get("average_order_value", {}).get("change_rate", 0),
                trend="up" if metrics.comparison.get("average_order_value", {}).get("change_rate", 0) > 0 else "down"
            ),
            MetricCard(
                title="コンバージョン率",
                value=f"{metrics.conversion_rate}%",
                change=metrics.comparison.get("conversion_rate", {}).get("change_rate", 0),
                trend="up" if metrics.comparison.get("conversion_rate", {}).get("change_rate", 0) > 0 else "down"
            )
        ]
        
        return cards