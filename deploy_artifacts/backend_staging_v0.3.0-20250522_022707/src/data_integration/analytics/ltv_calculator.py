from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from decimal import Decimal
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import PolynomialFeatures
from ..models.base import IntegrationData, OrderData, CustomerData
from ..models.analytics import LTVAnalysis, CustomerSegment
from ..services.integration_service import IntegrationService


class LTVCalculator:
    """LTV（顧客生涯価値）計算エンジン"""
    
    def __init__(self, integration_service: IntegrationService):
        self.integration_service = integration_service
    
    async def calculate_ltv(
        self,
        start_date: datetime,
        end_date: datetime,
        prediction_months: int = 12,
        segment_by: Optional[str] = None
    ) -> LTVAnalysis:
        """
        LTV分析を実行
        
        Args:
            start_date: 開始日
            end_date: 終了日
            prediction_months: 予測期間（月）
            segment_by: セグメント軸（channel, region, tier）
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
        
        # 顧客データと注文データを結合
        df = self._merge_customer_orders(customers_df, orders_df)
        
        # 基本的なLTV計算
        basic_ltv = self._calculate_basic_ltv(df)
        
        # 予測LTV計算
        predicted_ltv = self._predict_ltv(df, prediction_months)
        
        # セグメント別分析
        segments = None
        if segment_by:
            segments = self._analyze_by_segment(df, segment_by, prediction_months)
        
        # 分布分析
        distribution = self._analyze_distribution(df)
        
        # 最適化提案
        recommendations = self._generate_recommendations(df, basic_ltv, predicted_ltv)
        
        return LTVAnalysis(
            average_ltv=basic_ltv["average"],
            predicted_ltv=predicted_ltv["average"],
            segments=segments,
            distribution=distribution,
            recommendations=recommendations,
            calculation_date=datetime.now()
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
                    "channel": order.metadata.get("channel", "direct"),
                    "region": order.metadata.get("region", "unknown")
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
                    "tier": customer.data.tier or "standard",
                    "total_spent": float(customer.data.total_spent or 0)
                })
        
        return pd.DataFrame(records)
    
    def _merge_customer_orders(self, customers_df: pd.DataFrame, orders_df: pd.DataFrame) -> pd.DataFrame:
        """顧客データと注文データを結合"""
        # 顧客ごとの集計
        order_summary = orders_df.groupby("customer_id").agg({
            "amount": ["sum", "mean", "count"],
            "order_date": ["min", "max"],
            "channel": lambda x: x.mode()[0] if not x.empty else "unknown",
            "region": lambda x: x.mode()[0] if not x.empty else "unknown"
        }).reset_index()
        
        # カラム名を整理
        order_summary.columns = [
            "customer_id", "total_revenue", "avg_order_value", "order_count",
            "first_order_date", "last_order_date", "primary_channel", "primary_region"
        ]
        
        # 顧客データと結合
        df = customers_df.merge(order_summary, on="customer_id", how="left")
        
        # 日付型に変換
        date_columns = ["first_purchase_date", "signup_date", "first_order_date", "last_order_date"]
        for col in date_columns:
            if col in df.columns:
                df[col] = pd.to_datetime(df[col])
        
        # 顧客期間を計算
        df["customer_lifetime_days"] = (df["last_order_date"] - df["first_order_date"]).dt.days
        df["days_since_last_order"] = (datetime.now() - df["last_order_date"]).dt.days
        
        return df
    
    def _calculate_basic_ltv(self, df: pd.DataFrame) -> Dict[str, float]:
        """基本的なLTV計算"""
        # 実績ベースのLTV
        ltv_values = df["total_revenue"].fillna(0)
        
        return {
            "average": float(ltv_values.mean()),
            "median": float(ltv_values.median()),
            "total": float(ltv_values.sum()),
            "count": len(df)
        }
    
    def _predict_ltv(self, df: pd.DataFrame, months: int) -> Dict[str, float]:
        """予測LTVを計算"""
        # 特徴量を準備
        features = self._prepare_features(df)
        
        # 予測モデルを構築
        X = features[["order_count", "avg_order_value", "customer_lifetime_days", "days_since_last_order"]]
        y = features["total_revenue"]
        
        # 欠損値を処理
        X = X.fillna(0)
        y = y.fillna(0)
        
        # 多項式特徴量を追加
        poly = PolynomialFeatures(degree=2, include_bias=False)
        X_poly = poly.fit_transform(X)
        
        # モデルを訓練
        model = LinearRegression()
        model.fit(X_poly, y)
        
        # 将来の値を予測
        future_days = months * 30
        X_future = X.copy()
        X_future["customer_lifetime_days"] += future_days
        X_future["days_since_last_order"] += future_days
        
        X_future_poly = poly.transform(X_future)
        y_pred = model.predict(X_future_poly)
        
        # マイナス値を0に補正
        y_pred = np.maximum(y_pred, 0)
        
        return {
            "average": float(y_pred.mean()),
            "median": float(np.median(y_pred)),
            "total": float(y_pred.sum()),
            "growth_rate": float((y_pred.mean() - y.mean()) / y.mean() * 100) if y.mean() > 0 else 0
        }
    
    def _prepare_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """特徴量を準備"""
        features = df.copy()
        
        # 基本的な特徴量
        features["order_frequency"] = features["order_count"] / (features["customer_lifetime_days"] + 1) * 30
        features["recency_score"] = 1 / (features["days_since_last_order"] + 1)
        
        # チャーン確率
        features["churn_probability"] = features["days_since_last_order"].apply(
            lambda x: min(x / 90, 1) if pd.notna(x) else 1
        )
        
        return features
    
    def _analyze_by_segment(self, df: pd.DataFrame, segment_by: str, months: int) -> List[CustomerSegment]:
        """セグメント別分析"""
        segments = []
        
        # セグメント軸の値を取得
        if segment_by == "tier":
            segment_values = df["tier"].unique()
        elif segment_by == "channel":
            segment_values = df["primary_channel"].unique()
        elif segment_by == "region":
            segment_values = df["primary_region"].unique()
        else:
            return segments
        
        for value in segment_values:
            if pd.isna(value):
                continue
            
            # セグメントデータを抽出
            if segment_by == "tier":
                segment_df = df[df["tier"] == value]
            elif segment_by == "channel":
                segment_df = df[df["primary_channel"] == value]
            else:
                segment_df = df[df["primary_region"] == value]
            
            # LTV計算
            basic_ltv = self._calculate_basic_ltv(segment_df)
            predicted_ltv = self._predict_ltv(segment_df, months)
            
            # セグメント特性
            characteristics = {
                "avg_order_frequency": segment_df["order_count"].mean() / (segment_df["customer_lifetime_days"].mean() + 1) * 30,
                "avg_order_value": segment_df["avg_order_value"].mean(),
                "retention_rate": len(segment_df[segment_df["days_since_last_order"] < 90]) / len(segment_df) * 100
            }
            
            segments.append(CustomerSegment(
                name=str(value),
                count=len(segment_df),
                average_ltv=basic_ltv["average"],
                predicted_ltv=predicted_ltv["average"],
                characteristics=characteristics
            ))
        
        # LTVでソート
        segments.sort(key=lambda x: x.predicted_ltv, reverse=True)
        
        return segments
    
    def _analyze_distribution(self, df: pd.DataFrame) -> Dict[str, Any]:
        """LTV分布分析"""
        ltv_values = df["total_revenue"].fillna(0)
        
        # パーセンタイル計算
        percentiles = {}
        for p in [10, 25, 50, 75, 90, 95, 99]:
            percentiles[f"p{p}"] = float(np.percentile(ltv_values, p))
        
        # ビン分析
        bins = [0, 1000, 5000, 10000, 50000, 100000, float('inf')]
        labels = ["0-1K", "1K-5K", "5K-10K", "10K-50K", "50K-100K", "100K+"]
        ltv_bins = pd.cut(ltv_values, bins=bins, labels=labels)
        bin_counts = ltv_bins.value_counts().sort_index()
        
        distribution = {
            "percentiles": percentiles,
            "bins": bin_counts.to_dict(),
            "top_10_percent_contribution": float(
                ltv_values.nlargest(int(len(ltv_values) * 0.1)).sum() / ltv_values.sum() * 100
            ) if ltv_values.sum() > 0 else 0
        }
        
        return distribution
    
    def _generate_recommendations(self, df: pd.DataFrame, basic_ltv: Dict, predicted_ltv: Dict) -> List[Dict[str, Any]]:
        """最適化提案を生成"""
        recommendations = []
        
        # 高価値顧客の特定
        high_value_threshold = df["total_revenue"].quantile(0.9)
        high_value_customers = df[df["total_revenue"] > high_value_threshold]
        
        if len(high_value_customers) > 0:
            recommendations.append({
                "type": "high_value_focus",
                "priority": "high",
                "message": f"上位10%の顧客が総収益の{self._analyze_distribution(df)['top_10_percent_contribution']:.1f}%を占めています。これらの顧客への特別な対応を検討してください。",
                "impact": "high",
                "customers": len(high_value_customers)
            })
        
        # リテンション改善
        churn_risk = df[df["days_since_last_order"] > 90]
        if len(churn_risk) > len(df) * 0.3:
            recommendations.append({
                "type": "retention_improvement",
                "priority": "high",
                "message": f"全顧客の{len(churn_risk)/len(df)*100:.1f}%が90日以上購入していません。リテンション施策の強化を検討してください。",
                "impact": "medium",
                "customers": len(churn_risk)
            })
        
        # 購入頻度向上
        avg_frequency = df["order_count"].mean() / (df["customer_lifetime_days"].mean() + 1) * 365
        if avg_frequency < 4:
            recommendations.append({
                "type": "frequency_increase",
                "priority": "medium",
                "message": f"年間平均購入回数が{avg_frequency:.1f}回です。クロスセルやリピート購入促進を検討してください。",
                "impact": "medium",
                "current_frequency": avg_frequency
            })
        
        # セグメント最適化
        tier_analysis = df.groupby("tier")["total_revenue"].mean()
        if len(tier_analysis) > 1:
            best_tier = tier_analysis.idxmax()
            recommendations.append({
                "type": "segment_optimization",
                "priority": "medium",
                "message": f"{best_tier}層の顧客が最も高いLTVを示しています。このセグメントへの新規獲得を強化してください。",
                "impact": "medium",
                "best_segment": best_tier
            })
        
        return recommendations