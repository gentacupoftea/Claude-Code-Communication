from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np
from ..models.base import IntegrationData, OrderData, CustomerData
from ..models.analytics import CohortAnalysis, CohortMatrix
from ..services.integration_service import IntegrationService


class CohortAnalyzer:
    """コホート分析エンジン"""
    
    def __init__(self, integration_service: IntegrationService):
        self.integration_service = integration_service
    
    async def analyze_cohorts(
        self,
        start_date: datetime,
        end_date: datetime,
        cohort_type: str = "monthly",
        metric: str = "retention"
    ) -> CohortAnalysis:
        """
        コホート分析を実行
        
        Args:
            start_date: 開始日
            end_date: 終了日
            cohort_type: コホートタイプ（daily, weekly, monthly）
            metric: 分析指標（retention, revenue, orders）
        """
        # データ取得
        orders = await self.integration_service.get_integrated_data(
            source="all",
            entity_type="order",
            start_date=start_date,
            end_date=end_date
        )
        
        customers = await self.integration_service.get_integrated_data(
            source="all",
            entity_type="customer",
            start_date=start_date,
            end_date=end_date
        )
        
        # DataFrameに変換
        orders_df = self._orders_to_dataframe(orders)
        customers_df = self._customers_to_dataframe(customers)
        
        # コホート作成
        cohorts = self._create_cohorts(orders_df, customers_df, cohort_type)
        
        # コホート分析実行
        matrix = self._analyze_metric(cohorts, metric)
        
        # サマリー計算
        summary = self._calculate_summary(matrix)
        
        return CohortAnalysis(
            cohort_type=cohort_type,
            metric=metric,
            matrix=matrix,
            summary=summary
        )
    
    def _orders_to_dataframe(self, orders: List[IntegrationData]) -> pd.DataFrame:
        """注文データをDataFrameに変換"""
        records = []
        for order in orders:
            if isinstance(order.data, OrderData):
                records.append({
                    "order_id": order.id,
                    "customer_id": order.data.customer_id,
                    "amount": float(order.data.total_amount),
                    "order_date": order.created_at,
                    "status": order.data.status
                })
        
        return pd.DataFrame(records)
    
    def _customers_to_dataframe(self, customers: List[IntegrationData]) -> pd.DataFrame:
        """顧客データをDataFrameに変換"""
        records = []
        for customer in customers:
            if isinstance(customer.data, CustomerData):
                records.append({
                    "customer_id": customer.id,
                    "first_purchase_date": customer.data.first_purchase_date,
                    "signup_date": customer.created_at,
                    "total_spent": float(customer.data.total_spent or 0)
                })
        
        return pd.DataFrame(records)
    
    def _create_cohorts(self, orders_df: pd.DataFrame, customers_df: pd.DataFrame, cohort_type: str) -> pd.DataFrame:
        """コホートを作成"""
        # 注文と顧客データを結合
        df = orders_df.merge(customers_df, on="customer_id", how="left")
        
        # 日付をパース
        df["order_date"] = pd.to_datetime(df["order_date"])
        df["first_purchase_date"] = pd.to_datetime(df["first_purchase_date"])
        
        # コホート期間を設定
        if cohort_type == "monthly":
            df["cohort"] = df["first_purchase_date"].dt.to_period("M")
            df["order_period"] = df["order_date"].dt.to_period("M")
        elif cohort_type == "weekly":
            df["cohort"] = df["first_purchase_date"].dt.to_period("W")
            df["order_period"] = df["order_date"].dt.to_period("W")
        else:  # daily
            df["cohort"] = df["first_purchase_date"].dt.date
            df["order_period"] = df["order_date"].dt.date
        
        return df
    
    def _analyze_metric(self, cohorts_df: pd.DataFrame, metric: str) -> CohortMatrix:
        """指標に基づくコホート分析"""
        if metric == "retention":
            return self._calculate_retention(cohorts_df)
        elif metric == "revenue":
            return self._calculate_revenue(cohorts_df)
        elif metric == "orders":
            return self._calculate_orders(cohorts_df)
        else:
            raise ValueError(f"Unknown metric: {metric}")
    
    def _calculate_retention(self, df: pd.DataFrame) -> CohortMatrix:
        """リテンション率を計算"""
        # コホート別のユニーク顧客数
        cohort_sizes = df.groupby("cohort")["customer_id"].nunique()
        
        # 各期間のアクティブ顧客数
        period_counts = df.groupby(["cohort", "order_period"])["customer_id"].nunique().reset_index()
        
        # ピボット処理
        retention_matrix = period_counts.pivot(index="cohort", columns="order_period", values="customer_id")
        
        # リテンション率の計算
        for cohort in retention_matrix.index:
            retention_matrix.loc[cohort] = retention_matrix.loc[cohort] / cohort_sizes[cohort] * 100
        
        # NaNを0で埋める
        retention_matrix = retention_matrix.fillna(0)
        
        return CohortMatrix(
            data=retention_matrix.to_dict(),
            cohorts=retention_matrix.index.tolist(),
            periods=retention_matrix.columns.tolist()
        )
    
    def _calculate_revenue(self, df: pd.DataFrame) -> CohortMatrix:
        """収益分析"""
        # コホート・期間別の収益
        revenue_matrix = df.groupby(["cohort", "order_period"])["amount"].sum().reset_index()
        revenue_pivot = revenue_matrix.pivot(index="cohort", columns="order_period", values="amount")
        
        # コホートサイズで正規化（一人当たり収益）
        cohort_sizes = df.groupby("cohort")["customer_id"].nunique()
        for cohort in revenue_pivot.index:
            revenue_pivot.loc[cohort] = revenue_pivot.loc[cohort] / cohort_sizes[cohort]
        
        revenue_pivot = revenue_pivot.fillna(0)
        
        return CohortMatrix(
            data=revenue_pivot.to_dict(),
            cohorts=revenue_pivot.index.tolist(),
            periods=revenue_pivot.columns.tolist()
        )
    
    def _calculate_orders(self, df: pd.DataFrame) -> CohortMatrix:
        """注文数分析"""
        # コホート・期間別の注文数
        order_matrix = df.groupby(["cohort", "order_period"])["order_id"].count().reset_index()
        order_pivot = order_matrix.pivot(index="cohort", columns="order_period", values="order_id")
        
        # コホートサイズで正規化（一人当たり注文数）
        cohort_sizes = df.groupby("cohort")["customer_id"].nunique()
        for cohort in order_pivot.index:
            order_pivot.loc[cohort] = order_pivot.loc[cohort] / cohort_sizes[cohort]
        
        order_pivot = order_pivot.fillna(0)
        
        return CohortMatrix(
            data=order_pivot.to_dict(),
            cohorts=order_pivot.index.tolist(),
            periods=order_pivot.columns.tolist()
        )
    
    def _calculate_summary(self, matrix: CohortMatrix) -> Dict[str, Any]:
        """コホート分析のサマリーを計算"""
        matrix_df = pd.DataFrame(matrix.data)
        
        summary = {
            "average_by_period": {},
            "average_by_cohort": {},
            "overall_average": matrix_df.mean().mean(),
            "best_cohort": None,
            "worst_cohort": None
        }
        
        # 期間別平均
        for period in matrix_df.columns:
            summary["average_by_period"][str(period)] = matrix_df[period].mean()
        
        # コホート別平均
        cohort_averages = {}
        for cohort in matrix_df.index:
            avg = matrix_df.loc[cohort].mean()
            cohort_averages[str(cohort)] = avg
            summary["average_by_cohort"][str(cohort)] = avg
        
        # ベスト・ワーストコホート
        if cohort_averages:
            summary["best_cohort"] = max(cohort_averages, key=cohort_averages.get)
            summary["worst_cohort"] = min(cohort_averages, key=cohort_averages.get)
        
        return summary
    
    async def get_cohort_chart_data(self, analysis: CohortAnalysis) -> Dict[str, Any]:
        """チャート用データを生成"""
        matrix_df = pd.DataFrame(analysis.matrix.data)
        
        # ヒートマップデータ
        heatmap_data = []
        for i, cohort in enumerate(analysis.matrix.cohorts):
            for j, period in enumerate(analysis.matrix.periods):
                value = matrix_df.iloc[i, j]
                heatmap_data.append({
                    "cohort": str(cohort),
                    "period": str(period),
                    "value": value,
                    "period_index": j
                })
        
        # ライン チャートデータ（期間別トレンド）
        line_data = []
        for cohort in analysis.matrix.cohorts:
            cohort_data = {
                "cohort": str(cohort),
                "values": []
            }
            for period in analysis.matrix.periods:
                cohort_data["values"].append(matrix_df.loc[cohort, period])
            line_data.append(cohort_data)
        
        return {
            "heatmap": heatmap_data,
            "line": line_data,
            "summary": analysis.summary
        }