from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from collections import defaultdict
import pandas as pd
import numpy as np
from ..models.base import IntegrationData, EventData
from ..models.analytics import FunnelAnalysis, FunnelStep
from ..services.integration_service import IntegrationService


class FunnelAnalyzer:
    """ファネル分析エンジン"""
    
    def __init__(self, integration_service: IntegrationService):
        self.integration_service = integration_service
    
    async def analyze_funnel(
        self,
        funnel_steps: List[str],
        start_date: datetime,
        end_date: datetime,
        conversion_window: timedelta = timedelta(days=30),
        segment: Optional[str] = None
    ) -> FunnelAnalysis:
        """
        ファネル分析を実行
        
        Args:
            funnel_steps: ファネルステップのリスト
            start_date: 開始日
            end_date: 終了日
            conversion_window: コンバージョンウィンドウ
            segment: セグメント条件
        """
        # イベントデータ取得
        events = await self.integration_service.get_integrated_data(
            source="all",
            entity_type="event",
            start_date=start_date,
            end_date=end_date
        )
        
        # DataFrameに変換
        df = self._events_to_dataframe(events)
        
        # セグメント適用
        if segment:
            df = self._apply_segment(df, segment)
        
        # ファネル構築
        funnel_data = self._build_funnel(df, funnel_steps, conversion_window)
        
        # コンバージョン率計算
        conversion_rates = self._calculate_conversion_rates(funnel_data)
        
        # ドロップオフ分析
        dropoff_analysis = self._analyze_dropoff(funnel_data)
        
        # 時間分析
        time_analysis = self._analyze_time_between_steps(funnel_data)
        
        return FunnelAnalysis(
            steps=funnel_steps,
            conversion_rates=conversion_rates,
            dropoff_analysis=dropoff_analysis,
            time_analysis=time_analysis,
            segment=segment
        )
    
    def _events_to_dataframe(self, events: List[IntegrationData]) -> pd.DataFrame:
        """イベントデータをDataFrameに変換"""
        records = []
        for event in events:
            if isinstance(event.data, EventData):
                records.append({
                    "event_id": event.id,
                    "user_id": event.data.user_id,
                    "event_type": event.data.event_type,
                    "timestamp": event.data.timestamp,
                    "properties": event.data.properties,
                    "source": event.source
                })
        
        df = pd.DataFrame(records)
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        return df.sort_values(["user_id", "timestamp"])
    
    def _apply_segment(self, df: pd.DataFrame, segment: str) -> pd.DataFrame:
        """セグメント条件を適用"""
        # 簡単なセグメント実装
        # 実際はより複雑な条件式をサポート
        if segment == "new_users":
            first_events = df.groupby("user_id")["timestamp"].min()
            new_users = first_events[first_events >= df["timestamp"].min()].index
            return df[df["user_id"].isin(new_users)]
        elif segment == "high_value":
            # プロパティから高価値ユーザーを判定
            high_value_users = []
            for user_id, group in df.groupby("user_id"):
                total_value = sum([
                    prop.get("value", 0) for prop in group["properties"] 
                    if isinstance(prop, dict)
                ])
                if total_value > 10000:
                    high_value_users.append(user_id)
            return df[df["user_id"].isin(high_value_users)]
        else:
            return df
    
    def _build_funnel(self, df: pd.DataFrame, steps: List[str], window: timedelta) -> Dict[str, Any]:
        """ファネルを構築"""
        funnel_data = {
            "steps": {},
            "conversions": defaultdict(list),
            "times": defaultdict(list)
        }
        
        # 各ステップのユーザーを追跡
        for i, step in enumerate(steps):
            step_users = set()
            step_events = df[df["event_type"] == step]
            
            if i == 0:
                # 最初のステップ：すべてのユーザー
                step_users = set(step_events["user_id"].unique())
            else:
                # 後続ステップ：前のステップを通過したユーザーのみ
                prev_step = steps[i-1]
                for user_id in funnel_data["steps"][prev_step]:
                    user_events = df[df["user_id"] == user_id]
                    
                    # 前のステップのイベント
                    prev_events = user_events[user_events["event_type"] == prev_step]
                    if prev_events.empty:
                        continue
                    
                    prev_timestamp = prev_events.iloc[0]["timestamp"]
                    
                    # 現在のステップのイベント
                    curr_events = user_events[
                        (user_events["event_type"] == step) &
                        (user_events["timestamp"] > prev_timestamp) &
                        (user_events["timestamp"] <= prev_timestamp + window)
                    ]
                    
                    if not curr_events.empty:
                        step_users.add(user_id)
                        # 時間差を記録
                        time_diff = (curr_events.iloc[0]["timestamp"] - prev_timestamp).total_seconds()
                        funnel_data["times"][f"{prev_step}_to_{step}"].append(time_diff)
            
            funnel_data["steps"][step] = step_users
        
        return funnel_data
    
    def _calculate_conversion_rates(self, funnel_data: Dict[str, Any]) -> List[FunnelStep]:
        """コンバージョン率を計算"""
        steps = list(funnel_data["steps"].keys())
        funnel_steps = []
        
        for i, step in enumerate(steps):
            users = funnel_data["steps"][step]
            count = len(users)
            
            # 全体のコンバージョン率
            if i == 0:
                overall_rate = 100.0
            else:
                first_step_count = len(funnel_data["steps"][steps[0]])
                overall_rate = (count / first_step_count * 100) if first_step_count > 0 else 0
            
            # ステップ間のコンバージョン率
            if i == 0:
                step_rate = 100.0
            else:
                prev_count = len(funnel_data["steps"][steps[i-1]])
                step_rate = (count / prev_count * 100) if prev_count > 0 else 0
            
            funnel_steps.append(FunnelStep(
                name=step,
                count=count,
                conversion_rate=overall_rate,
                step_conversion_rate=step_rate
            ))
        
        return funnel_steps
    
    def _analyze_dropoff(self, funnel_data: Dict[str, Any]) -> Dict[str, Any]:
        """ドロップオフ分析"""
        steps = list(funnel_data["steps"].keys())
        dropoff = {}
        
        for i in range(1, len(steps)):
            curr_step = steps[i]
            prev_step = steps[i-1]
            
            prev_users = funnel_data["steps"][prev_step]
            curr_users = funnel_data["steps"][curr_step]
            dropped_users = prev_users - curr_users
            
            dropoff[f"{prev_step}_to_{curr_step}"] = {
                "count": len(dropped_users),
                "rate": (len(dropped_users) / len(prev_users) * 100) if prev_users else 0,
                "users": list(dropped_users)[:100]  # 最初の100人のみ
            }
        
        return dropoff
    
    def _analyze_time_between_steps(self, funnel_data: Dict[str, Any]) -> Dict[str, Any]:
        """ステップ間の時間分析"""
        time_analysis = {}
        
        for step_pair, times in funnel_data["times"].items():
            if times:
                time_analysis[step_pair] = {
                    "average": np.mean(times),
                    "median": np.median(times),
                    "p25": np.percentile(times, 25),
                    "p75": np.percentile(times, 75),
                    "min": np.min(times),
                    "max": np.max(times)
                }
            else:
                time_analysis[step_pair] = {
                    "average": 0,
                    "median": 0,
                    "p25": 0,
                    "p75": 0,
                    "min": 0,
                    "max": 0
                }
        
        return time_analysis
    
    async def get_funnel_visualization(self, analysis: FunnelAnalysis) -> Dict[str, Any]:
        """ファネル可視化用データ"""
        # ファネルチャート用データ
        funnel_chart = []
        for step in analysis.conversion_rates:
            funnel_chart.append({
                "step": step.name,
                "count": step.count,
                "rate": step.conversion_rate,
                "step_rate": step.step_conversion_rate
            })
        
        # ドロップオフチャート用データ
        dropoff_chart = []
        for transition, data in analysis.dropoff_analysis.items():
            dropoff_chart.append({
                "transition": transition,
                "count": data["count"],
                "rate": data["rate"]
            })
        
        # 時間分析チャート用データ
        time_chart = []
        for transition, data in analysis.time_analysis.items():
            time_chart.append({
                "transition": transition,
                "average": data["average"] / 3600,  # 時間に変換
                "median": data["median"] / 3600
            })
        
        return {
            "funnel": funnel_chart,
            "dropoff": dropoff_chart,
            "time": time_chart
        }
    
    def get_optimization_suggestions(self, analysis: FunnelAnalysis) -> List[Dict[str, Any]]:
        """最適化提案を生成"""
        suggestions = []
        
        # ドロップ率が高いステップを特定
        for transition, data in analysis.dropoff_analysis.items():
            if data["rate"] > 50:
                suggestions.append({
                    "type": "high_dropoff",
                    "transition": transition,
                    "dropoff_rate": data["rate"],
                    "suggestion": f"{transition}のドロップ率が{data['rate']:.1f}%と高いです。このステップの最適化を検討してください。"
                })
        
        # 時間がかかるステップを特定
        for transition, data in analysis.time_analysis.items():
            avg_hours = data["average"] / 3600
            if avg_hours > 24:
                suggestions.append({
                    "type": "slow_conversion",
                    "transition": transition,
                    "average_time": avg_hours,
                    "suggestion": f"{transition}の平均所要時間が{avg_hours:.1f}時間と長いです。プロセスの簡素化を検討してください。"
                })
        
        # 全体的なコンバージョン率が低い場合
        if analysis.conversion_rates:
            final_rate = analysis.conversion_rates[-1].conversion_rate
            if final_rate < 5:
                suggestions.append({
                    "type": "low_overall_conversion",
                    "conversion_rate": final_rate,
                    "suggestion": f"全体のコンバージョン率が{final_rate:.1f}%と低いです。ファネル全体の最適化を検討してください。"
                })
        
        return suggestions