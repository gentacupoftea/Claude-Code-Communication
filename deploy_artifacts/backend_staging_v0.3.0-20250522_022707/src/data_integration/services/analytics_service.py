"""
分析サービス - 統合データの分析と洞察生成
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
import pandas as pd
import numpy as np
from collections import defaultdict

from ..models.customer import (
    CustomerInsight,
    CustomerSegment,
    CustomerBehavior,
    CustomerLifecycleStage,
    CustomerCohort,
    CustomerRecommendation,
    CustomerRiskProfile
)
from ..models.marketing import (
    CampaignPerformance,
    AttributionModel,
    CustomerJourney,
    MarketingROI,
    ContentPerformance,
    MarketingForecast,
    ABTestResult
)

logger = logging.getLogger(__name__)

class AnalyticsService:
    """統合データの分析サービス"""
    
    def __init__(self):
        self.segment_definitions = self._initialize_segments()
        self.lifecycle_stages = ['new', 'growing', 'mature', 'at_risk', 'churned']
    
    def _initialize_segments(self) -> Dict[str, Dict]:
        """顧客セグメントの定義を初期化"""
        return {
            'high_value': {
                'criteria': {'lifetime_value': {'gt': 1000}},
                'description': '高価値顧客'
            },
            'frequent_buyers': {
                'criteria': {'purchase_frequency': {'gt': 0.5}},  # 月2回以上
                'description': '頻繁購入者'
            },
            'new_customers': {
                'criteria': {'days_since_first_purchase': {'lt': 30}},
                'description': '新規顧客'
            },
            'at_risk': {
                'criteria': {'churn_risk_score': {'gt': 0.7}},
                'description': 'リスク顧客'
            }
        }
    
    def analyze_customer(self, customer_data: Dict) -> CustomerInsight:
        """顧客データを分析して洞察を生成"""
        insight = CustomerInsight(
            customer_id=customer_data['customer_id'],
            segment=self._determine_segment(customer_data),
            lifetime_value=self._calculate_ltv(customer_data),
            churn_risk_score=self._calculate_churn_risk(customer_data),
            engagement_score=self._calculate_engagement_score(customer_data),
            purchase_frequency=self._calculate_purchase_frequency(customer_data),
            average_order_value=customer_data.get('average_order_value', 0),
            preferred_categories=self._identify_preferred_categories(customer_data),
            preferred_products=self._identify_preferred_products(customer_data),
            communication_preferences=self._analyze_communication_preferences(customer_data),
            behavioral_patterns=self._analyze_behavioral_patterns(customer_data)
        )
        
        # 次回購入予測
        if customer_data.get('last_purchase_date'):
            insight.next_purchase_prediction = self._predict_next_purchase(customer_data)
        
        return insight
    
    def _determine_segment(self, customer_data: Dict) -> str:
        """顧客セグメントを決定"""
        for segment_name, segment_def in self.segment_definitions.items():
            if self._matches_criteria(customer_data, segment_def['criteria']):
                return segment_name
        return 'standard'
    
    def _matches_criteria(self, data: Dict, criteria: Dict) -> bool:
        """データが条件に一致するかチェック"""
        for field, condition in criteria.items():
            value = data.get(field)
            if value is None:
                return False
            
            if isinstance(condition, dict):
                if 'gt' in condition and value <= condition['gt']:
                    return False
                if 'lt' in condition and value >= condition['lt']:
                    return False
                if 'eq' in condition and value != condition['eq']:
                    return False
            else:
                if value != condition:
                    return False
        
        return True
    
    def _calculate_ltv(self, customer_data: Dict) -> float:
        """顧客生涯価値（LTV）を計算"""
        total_spent = customer_data.get('total_spent', 0)
        purchase_frequency = self._calculate_purchase_frequency(customer_data)
        avg_order_value = customer_data.get('average_order_value', 0)
        
        # 簡単なLTV計算モデル
        if purchase_frequency > 0:
            expected_purchases = purchase_frequency * 12  # 年間予想購入回数
            ltv = avg_order_value * expected_purchases * 3  # 3年間の予測
        else:
            ltv = total_spent * 1.5  # 既存支出の1.5倍
        
        return round(ltv, 2)
    
    def _calculate_churn_risk(self, customer_data: Dict) -> float:
        """離脱リスクスコアを計算"""
        risk_score = 0.0
        
        # 最終購入からの日数
        if 'last_purchase_date' in customer_data:
            last_purchase = pd.to_datetime(customer_data['last_purchase_date'])
            days_since_purchase = (datetime.now() - last_purchase).days
            
            if days_since_purchase > 180:
                risk_score += 0.5
            elif days_since_purchase > 90:
                risk_score += 0.3
            elif days_since_purchase > 60:
                risk_score += 0.2
        
        # 購入頻度の減少
        purchase_frequency = self._calculate_purchase_frequency(customer_data)
        if purchase_frequency < 0.1:  # 月1回未満
            risk_score += 0.3
        
        # エンゲージメントスコア
        engagement_score = customer_data.get('engagement_score', 0.5)
        if engagement_score < 0.3:
            risk_score += 0.2
        
        return min(risk_score, 1.0)
    
    def _calculate_engagement_score(self, customer_data: Dict) -> float:
        """エンゲージメントスコアを計算"""
        score = 0.0
        
        # メール開封率
        if 'email_open_rate' in customer_data:
            score += customer_data['email_open_rate'] * 0.3
        
        # ウェブサイト訪問頻度
        if 'site_visits_per_month' in customer_data:
            normalized_visits = min(customer_data['site_visits_per_month'] / 10, 1.0)
            score += normalized_visits * 0.3
        
        # レビュー投稿
        if 'reviews_count' in customer_data:
            normalized_reviews = min(customer_data['reviews_count'] / 5, 1.0)
            score += normalized_reviews * 0.2
        
        # ソーシャルメディアインタラクション
        if 'social_interactions' in customer_data:
            normalized_social = min(customer_data['social_interactions'] / 10, 1.0)
            score += normalized_social * 0.2
        
        return round(score, 2)
    
    def _calculate_purchase_frequency(self, customer_data: Dict) -> float:
        """月間購入頻度を計算"""
        if 'orders_count' not in customer_data or 'first_purchase_date' not in customer_data:
            return 0.0
        
        first_purchase = pd.to_datetime(customer_data['first_purchase_date'])
        months_active = (datetime.now() - first_purchase).days / 30
        
        if months_active > 0:
            return customer_data['orders_count'] / months_active
        return 0.0
    
    def _identify_preferred_categories(self, customer_data: Dict) -> List[str]:
        """好みのカテゴリを特定"""
        if 'purchase_history' not in customer_data:
            return []
        
        category_counts = defaultdict(int)
        for purchase in customer_data['purchase_history']:
            if 'category' in purchase:
                category_counts[purchase['category']] += 1
        
        # 上位3カテゴリを返す
        sorted_categories = sorted(category_counts.items(), key=lambda x: x[1], reverse=True)
        return [cat[0] for cat in sorted_categories[:3]]
    
    def _identify_preferred_products(self, customer_data: Dict) -> List[str]:
        """好みの商品を特定"""
        if 'purchase_history' not in customer_data:
            return []
        
        product_counts = defaultdict(int)
        for purchase in customer_data['purchase_history']:
            if 'product_id' in purchase:
                product_counts[purchase['product_id']] += 1
        
        # 2回以上購入された商品
        preferred = [pid for pid, count in product_counts.items() if count >= 2]
        return preferred[:5]  # 上位5商品
    
    def _analyze_communication_preferences(self, customer_data: Dict) -> Dict[str, Any]:
        """コミュニケーション設定を分析"""
        preferences = {
            'email': True,
            'sms': False,
            'push': False,
            'frequency': 'weekly',
            'best_time': 'morning',
            'preferred_content': []
        }
        
        # メールエンゲージメントから頻度を推定
        if 'email_open_rate' in customer_data:
            if customer_data['email_open_rate'] > 0.5:
                preferences['frequency'] = 'daily'
            elif customer_data['email_open_rate'] < 0.2:
                preferences['frequency'] = 'monthly'
        
        # 開封時間から最適な送信時間を推定
        if 'email_open_times' in customer_data:
            # 簡略化: 最も頻繁に開封される時間帯
            preferences['best_time'] = self._most_common_time_period(
                customer_data['email_open_times']
            )
        
        return preferences
    
    def _analyze_behavioral_patterns(self, customer_data: Dict) -> Dict[str, Any]:
        """行動パターンを分析"""
        patterns = {
            'purchase_time_preference': None,
            'device_preference': None,
            'seasonal_patterns': [],
            'price_sensitivity': 0.5,
            'promotion_responsiveness': 0.5
        }
        
        if 'purchase_history' in customer_data:
            purchases = customer_data['purchase_history']
            
            # 購入時間の分析
            purchase_times = [p.get('time') for p in purchases if 'time' in p]
            if purchase_times:
                patterns['purchase_time_preference'] = self._most_common_time_period(purchase_times)
            
            # デバイスの好み
            device_counts = defaultdict(int)
            for p in purchases:
                if 'device' in p:
                    device_counts[p['device']] += 1
            if device_counts:
                patterns['device_preference'] = max(device_counts, key=device_counts.get)
            
            # 価格感度
            if 'discount_usage_rate' in customer_data:
                patterns['price_sensitivity'] = customer_data['discount_usage_rate']
            
            # プロモーション反応性
            if 'promotion_conversion_rate' in customer_data:
                patterns['promotion_responsiveness'] = customer_data['promotion_conversion_rate']
        
        return patterns
    
    def _predict_next_purchase(self, customer_data: Dict) -> datetime:
        """次回購入日を予測"""
        purchase_frequency = self._calculate_purchase_frequency(customer_data)
        
        if purchase_frequency > 0:
            # 平均購入間隔から予測
            avg_days_between_purchases = 30 / purchase_frequency
            last_purchase = pd.to_datetime(customer_data['last_purchase_date'])
            predicted_date = last_purchase + timedelta(days=avg_days_between_purchases)
        else:
            # 初回購入客の場合は30日後と仮定
            predicted_date = datetime.now() + timedelta(days=30)
        
        return predicted_date
    
    def _most_common_time_period(self, times: List[str]) -> str:
        """最も一般的な時間帯を判定"""
        time_periods = {
            'morning': (6, 12),
            'afternoon': (12, 17),
            'evening': (17, 21),
            'night': (21, 6)
        }
        
        period_counts = defaultdict(int)
        
        for time_str in times:
            try:
                hour = pd.to_datetime(time_str).hour
                for period, (start, end) in time_periods.items():
                    if start <= hour < end or (period == 'night' and (hour >= start or hour < end)):
                        period_counts[period] += 1
                        break
            except:
                continue
        
        if period_counts:
            return max(period_counts, key=period_counts.get)
        return 'morning'
    
    def analyze_campaign_performance(self, campaign_data: Dict) -> CampaignPerformance:
        """キャンペーンパフォーマンスを分析"""
        performance = CampaignPerformance(
            campaign_id=campaign_data['campaign_id'],
            impressions=campaign_data.get('impressions', 0),
            clicks=campaign_data.get('clicks', 0),
            conversions=campaign_data.get('conversions', 0),
            revenue=campaign_data.get('revenue', 0),
            cost=campaign_data.get('cost', 0)
        )
        
        # 派生メトリクスの計算
        if performance.impressions > 0:
            performance.ctr = performance.clicks / performance.impressions
        
        if performance.clicks > 0:
            performance.conversion_rate = performance.conversions / performance.clicks
        
        if performance.conversions > 0:
            performance.cpa = performance.cost / performance.conversions
        
        if performance.cost > 0:
            performance.roi = (performance.revenue - performance.cost) / performance.cost
        
        # チャネル別パフォーマンス
        if 'channel_data' in campaign_data:
            performance.by_channel = campaign_data['channel_data']
        
        # セグメント別パフォーマンス
        if 'segment_data' in campaign_data:
            performance.by_segment = campaign_data['segment_data']
        
        return performance
    
    def create_customer_cohort(self, customers: List[Dict], cohort_type: str = 'monthly') -> List[CustomerCohort]:
        """顧客コホートを作成"""
        cohorts = defaultdict(list)
        
        for customer in customers:
            if 'first_purchase_date' not in customer:
                continue
            
            first_purchase = pd.to_datetime(customer['first_purchase_date'])
            
            if cohort_type == 'monthly':
                cohort_key = first_purchase.strftime('%Y-%m')
            elif cohort_type == 'weekly':
                cohort_key = first_purchase.strftime('%Y-W%U')
            else:
                cohort_key = first_purchase.strftime('%Y')
            
            cohorts[cohort_key].append(customer)
        
        cohort_objects = []
        for cohort_key, cohort_customers in cohorts.items():
            cohort = CustomerCohort(
                cohort_id=f"cohort_{cohort_key}",
                name=f"{cohort_type.capitalize()} Cohort {cohort_key}",
                customer_count=len(cohort_customers),
                retention_rates=self._calculate_cohort_retention(cohort_customers),
                revenue_per_customer=self._calculate_cohort_revenue(cohort_customers)
            )
            cohort_objects.append(cohort)
        
        return cohort_objects
    
    def _calculate_cohort_retention(self, customers: List[Dict]) -> Dict[str, float]:
        """コホートリテンション率を計算"""
        retention_rates = {}
        total_customers = len(customers)
        
        for month in range(13):  # 0-12ヶ月
            active_count = 0
            for customer in customers:
                if self._is_active_in_month(customer, month):
                    active_count += 1
            
            if total_customers > 0:
                retention_rates[f"month_{month}"] = active_count / total_customers
        
        return retention_rates
    
    def _calculate_cohort_revenue(self, customers: List[Dict]) -> Dict[str, float]:
        """コホート収益を計算"""
        revenue_per_customer = {}
        total_customers = len(customers)
        
        for month in range(13):  # 0-12ヶ月
            total_revenue = 0
            for customer in customers:
                total_revenue += self._get_revenue_in_month(customer, month)
            
            if total_customers > 0:
                revenue_per_customer[f"month_{month}"] = total_revenue / total_customers
        
        return revenue_per_customer
    
    def _is_active_in_month(self, customer: Dict, month: int) -> bool:
        """特定の月にアクティブかチェック"""
        if 'purchase_history' not in customer:
            return False
        
        first_purchase = pd.to_datetime(customer['first_purchase_date'])
        target_month = first_purchase + pd.DateOffset(months=month)
        
        for purchase in customer['purchase_history']:
            purchase_date = pd.to_datetime(purchase['date'])
            if purchase_date.year == target_month.year and purchase_date.month == target_month.month:
                return True
        
        return False
    
    def _get_revenue_in_month(self, customer: Dict, month: int) -> float:
        """特定の月の収益を取得"""
        if 'purchase_history' not in customer:
            return 0.0
        
        first_purchase = pd.to_datetime(customer['first_purchase_date'])
        target_month = first_purchase + pd.DateOffset(months=month)
        total_revenue = 0.0
        
        for purchase in customer['purchase_history']:
            purchase_date = pd.to_datetime(purchase['date'])
            if purchase_date.year == target_month.year and purchase_date.month == target_month.month:
                total_revenue += purchase.get('amount', 0)
        
        return total_revenue
    
    def generate_recommendations(self, customer_insight: CustomerInsight) -> List[CustomerRecommendation]:
        """顧客への推奨アクションを生成"""
        recommendations = []
        
        # 離脱リスクが高い場合
        if customer_insight.churn_risk_score > 0.7:
            recommendations.append(CustomerRecommendation(
                customer_id=customer_insight.customer_id,
                recommendation_type='retention',
                recommendation_id='ret_001',
                title='離脱防止キャンペーン',
                description='特別割引クーポンを送信して顧客を維持',
                priority=9,
                confidence_score=customer_insight.churn_risk_score,
                expected_impact={'retention_improvement': 0.3}
            ))
        
        # 高価値顧客の場合
        if customer_insight.lifetime_value > 1000:
            recommendations.append(CustomerRecommendation(
                customer_id=customer_insight.customer_id,
                recommendation_type='upsell',
                recommendation_id='up_001',
                title='VIPプログラムへの招待',
                description='高価値顧客向けの特別プログラムへ招待',
                priority=8,
                confidence_score=0.8,
                expected_impact={'ltv_increase': 0.2}
            ))
        
        # 購入頻度が低い場合
        if customer_insight.purchase_frequency < 0.1:
            recommendations.append(CustomerRecommendation(
                customer_id=customer_insight.customer_id,
                recommendation_type='campaign',
                recommendation_id='cam_001',
                title='再エンゲージメントキャンペーン',
                description='購入を促すターゲティングキャンペーン',
                priority=7,
                confidence_score=0.7,
                expected_impact={'purchase_frequency_increase': 0.5}
            ))
        
        return recommendations