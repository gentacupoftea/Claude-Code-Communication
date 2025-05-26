"""
データ分析エンジン - 高度な分析機能を提供
"""

import json
import asyncio
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from datetime import datetime
import pandas as pd
import numpy as np
from collections import defaultdict

@dataclass
class AnalysisResult:
    """分析結果"""
    analysis_type: str
    summary: str
    insights: List[str]
    recommendations: List[str]
    data: Dict[str, Any]
    confidence: float
    timestamp: datetime

class DataAnalyzer:
    """
    高度なデータ分析機能を提供
    - トレンド分析
    - パターン認識
    - 異常検知
    - 予測分析
    """
    
    def __init__(self):
        self.analysis_history = []
        
    async def analyze_conversation_patterns(self, conversations: List[Dict]) -> AnalysisResult:
        """会話パターンの分析"""
        # トピック分類
        topics = defaultdict(int)
        response_times = []
        satisfaction_scores = []
        
        for conv in conversations:
            # トピック抽出
            if 'messages' in conv:
                for msg in conv['messages']:
                    if msg['role'] == 'user':
                        # 簡易的なトピック分類
                        content_lower = msg['content'].lower()
                        if any(kw in content_lower for kw in ['コード', '実装', 'バグ']):
                            topics['技術的質問'] += 1
                        elif any(kw in content_lower for kw in ['メモリ', '記憶', '思い出']):
                            topics['メモリ操作'] += 1
                        elif any(kw in content_lower for kw in ['プロジェクト', '進捗', 'タスク']):
                            topics['プロジェクト管理'] += 1
                        else:
                            topics['一般的な質問'] += 1
            
            # レスポンス時間の計算
            if 'duration' in conv:
                response_times.append(conv['duration'])
        
        # インサイトの生成
        insights = []
        if topics:
            most_common = max(topics.items(), key=lambda x: x[1])
            insights.append(f"最も多い質問タイプ: {most_common[0]} ({most_common[1]}件)")
        
        if response_times:
            avg_time = np.mean(response_times)
            insights.append(f"平均応答時間: {avg_time:.2f}秒")
        
        # 推奨事項の生成
        recommendations = []
        if topics.get('技術的質問', 0) > len(conversations) * 0.5:
            recommendations.append("技術的な質問が多いため、コード生成機能を強化することを推奨")
        
        return AnalysisResult(
            analysis_type="conversation_patterns",
            summary="会話パターンの分析完了",
            insights=insights,
            recommendations=recommendations,
            data={"topics": dict(topics), "response_times": response_times},
            confidence=0.85,
            timestamp=datetime.now()
        )
    
    async def analyze_task_performance(self, tasks: List[Dict]) -> AnalysisResult:
        """タスクパフォーマンスの分析"""
        task_types = defaultdict(list)
        completion_rates = {}
        bottlenecks = []
        
        for task in tasks:
            task_type = task.get('type', 'unknown')
            duration = task.get('duration', 0)
            status = task.get('status', 'unknown')
            
            task_types[task_type].append({
                'duration': duration,
                'status': status
            })
        
        # パフォーマンス指標の計算
        for task_type, task_list in task_types.items():
            completed = sum(1 for t in task_list if t['status'] == 'completed')
            total = len(task_list)
            completion_rates[task_type] = (completed / total * 100) if total > 0 else 0
            
            # ボトルネックの検出
            avg_duration = np.mean([t['duration'] for t in task_list if t['duration'] > 0])
            if avg_duration > 10:  # 10秒以上かかるタスク
                bottlenecks.append(f"{task_type}: 平均{avg_duration:.1f}秒")
        
        insights = [
            f"分析したタスク数: {len(tasks)}",
            f"タスクタイプ数: {len(task_types)}"
        ]
        
        recommendations = []
        if bottlenecks:
            recommendations.append(f"以下のタスクタイプの最適化を推奨: {', '.join(bottlenecks)}")
        
        return AnalysisResult(
            analysis_type="task_performance",
            summary="タスクパフォーマンス分析完了",
            insights=insights,
            recommendations=recommendations,
            data={
                "completion_rates": completion_rates,
                "bottlenecks": bottlenecks
            },
            confidence=0.9,
            timestamp=datetime.now()
        )
    
    async def predict_resource_needs(self, historical_data: List[Dict]) -> AnalysisResult:
        """リソース需要の予測"""
        # 簡易的な予測モデル
        daily_loads = defaultdict(list)
        
        for data in historical_data:
            timestamp = datetime.fromisoformat(data.get('timestamp', datetime.now().isoformat()))
            hour = timestamp.hour
            load = data.get('load', 1)
            daily_loads[hour].append(load)
        
        # ピーク時間の特定
        peak_hours = []
        for hour, loads in daily_loads.items():
            avg_load = np.mean(loads)
            if avg_load > np.mean([np.mean(l) for l in daily_loads.values()]) * 1.5:
                peak_hours.append(hour)
        
        insights = [
            f"ピーク時間帯: {peak_hours}時" if peak_hours else "明確なピーク時間帯は検出されませんでした"
        ]
        
        recommendations = []
        if peak_hours:
            recommendations.append(f"{min(peak_hours)}-{max(peak_hours)}時にリソースを増強することを推奨")
        
        return AnalysisResult(
            analysis_type="resource_prediction",
            summary="リソース需要予測完了",
            insights=insights,
            recommendations=recommendations,
            data={"peak_hours": peak_hours, "daily_loads": dict(daily_loads)},
            confidence=0.75,
            timestamp=datetime.now()
        )