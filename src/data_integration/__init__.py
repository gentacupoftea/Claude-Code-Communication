"""
データ統合モジュール
Shopify MCPサーバーのデータ統合と分析機能を提供
"""
from .models import *
from .services import *

__version__ = '0.1.0'

__all__ = [
    # Services
    'DataIntegrationService',
    'DataMappingService',
    'AnalyticsService',
    
    # Models
    'IntegratedDataModel',
    'IntegratedCustomerData',
    'IntegratedProductData',
    'IntegratedOrderData',
    'DataIntegrationConfig',
    'CustomerInsight',
    'CustomerSegment',
    'CustomerBehavior',
    'CustomerLifecycleStage',
    'CustomerCohort',
    'CustomerRecommendation',
    'CustomerRiskProfile',
    'MarketingCampaign',
    'CampaignPerformance',
    'AttributionModel',
    'CustomerJourney',
    'MarketingROI',
    'ContentPerformance',
    'MarketingForecast',
    'ABTestResult'
]