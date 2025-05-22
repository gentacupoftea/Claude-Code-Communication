"""
データ統合モデルパッケージ
"""
from .integrated import (
    IntegratedDataModel,
    IntegratedCustomerData,
    IntegratedProductData,
    IntegratedOrderData,
    DataIntegrationConfig
)
from .customer import (
    CustomerInsight,
    CustomerSegment,
    CustomerBehavior,
    CustomerLifecycleStage,
    CustomerCohort,
    CustomerRecommendation,
    CustomerRiskProfile
)
from .marketing import (
    MarketingCampaign,
    CampaignPerformance,
    AttributionModel,
    CustomerJourney,
    MarketingROI,
    ContentPerformance,
    MarketingForecast,
    ABTestResult
)

__all__ = [
    # Integrated models
    'IntegratedDataModel',
    'IntegratedCustomerData',
    'IntegratedProductData',
    'IntegratedOrderData',
    'DataIntegrationConfig',
    
    # Customer models
    'CustomerInsight',
    'CustomerSegment',
    'CustomerBehavior',
    'CustomerLifecycleStage',
    'CustomerCohort',
    'CustomerRecommendation',
    'CustomerRiskProfile',
    
    # Marketing models
    'MarketingCampaign',
    'CampaignPerformance',
    'AttributionModel',
    'CustomerJourney',
    'MarketingROI',
    'ContentPerformance',
    'MarketingForecast',
    'ABTestResult'
]