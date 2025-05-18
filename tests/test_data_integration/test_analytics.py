"""Tests for analytics engine."""

import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from unittest.mock import Mock, patch

from src.data_integration.analytics.unified_analytics import UnifiedAnalyticsEngine
from src.data_integration.analytics.predictive_analytics import PredictiveAnalytics
from src.data_integration.analytics.behavioral_analytics import BehavioralAnalytics
from src.data_integration.analytics.recommendation_engine import RecommendationEngine

class TestUnifiedAnalyticsEngine:
    """Tests for UnifiedAnalyticsEngine."""
    
    def test_calculate_customer_lifetime_value(self, sample_order_data, sample_customer_data):
        """Test CLV calculation."""
        engine = UnifiedAnalyticsEngine()
        
        # Create sample data
        orders_df = pd.DataFrame(sample_order_data)
        customers_df = pd.DataFrame(sample_customer_data)
        
        clv = engine.calculate_customer_lifetime_value(
            order_data=orders_df,
            customer_data=customers_df
        )
        
        assert "cust_1" in clv
        assert clv["cust_1"] > 0
    
    def test_analyze_product_performance(self, sample_product_data, sample_order_data):
        """Test product performance analysis."""
        engine = UnifiedAnalyticsEngine()
        
        # Create sample data
        products_df = pd.DataFrame(sample_product_data)
        orders_df = pd.DataFrame(sample_order_data)
        
        performance = engine.analyze_product_performance(
            product_data=products_df,
            order_data=orders_df
        )
        
        assert len(performance) > 0
        assert "revenue" in performance.columns
        assert "units_sold" in performance.columns
    
    def test_identify_trends(self):
        """Test trend identification."""
        engine = UnifiedAnalyticsEngine()
        
        # Create sample time series data
        dates = pd.date_range(start="2023-01-01", end="2023-12-31", freq="D")
        sales = np.sin(np.arange(len(dates)) * 0.1) * 100 + 500 + np.random.normal(0, 10, len(dates))
        
        data = pd.DataFrame({
            "date": dates,
            "sales": sales
        })
        
        trends = engine.identify_trends(data)
        
        assert "trend" in trends.columns
        assert "seasonality" in trends.columns
        assert len(trends) == len(data)
    
    def test_cross_channel_attribution(self):
        """Test cross-channel attribution."""
        engine = UnifiedAnalyticsEngine()
        
        # Create sample attribution data
        touchpoints = pd.DataFrame({
            "customer_id": ["cust_1"] * 5,
            "channel": ["email", "social", "search", "direct", "email"],
            "timestamp": pd.date_range(start="2023-01-01", periods=5, freq="D"),
            "converted": [False, False, False, False, True]
        })
        
        attribution = engine.cross_channel_attribution(touchpoints)
        
        assert "email" in attribution
        assert "social" in attribution
        assert sum(attribution.values()) == 1.0  # Attribution should sum to 1

class TestPredictiveAnalytics:
    """Tests for PredictiveAnalytics."""
    
    def test_predict_churn(self, sample_customer_data):
        """Test churn prediction."""
        analytics = PredictiveAnalytics()
        
        # Create sample feature data
        customer_features = pd.DataFrame({
            "customer_id": ["cust_1", "cust_2", "cust_3"],
            "days_since_last_order": [10, 90, 30],
            "total_orders": [10, 1, 5],
            "avg_order_value": [50.0, 100.0, 75.0],
            "lifetime_value": [500.0, 100.0, 375.0]
        })
        
        churn_predictions = analytics.predict_churn(customer_features)
        
        assert len(churn_predictions) == len(customer_features)
        assert all(0 <= score <= 1 for score in churn_predictions.values())
    
    def test_forecast_demand(self):
        """Test demand forecasting."""
        analytics = PredictiveAnalytics()
        
        # Create sample historical data
        dates = pd.date_range(start="2023-01-01", end="2023-12-31", freq="D")
        demand = np.sin(np.arange(len(dates)) * 0.1) * 50 + 100 + np.random.normal(0, 5, len(dates))
        
        historical_data = pd.DataFrame({
            "date": dates,
            "demand": demand
        })
        
        forecast = analytics.forecast_demand(
            historical_data=historical_data,
            forecast_days=30
        )
        
        assert len(forecast) == 30
        assert "date" in forecast.columns
        assert "predicted_demand" in forecast.columns
    
    def test_predict_ltv(self, sample_customer_data):
        """Test LTV prediction."""
        analytics = PredictiveAnalytics()
        
        customer_data = pd.DataFrame(sample_customer_data)
        
        ltv_predictions = analytics.predict_ltv(customer_data)
        
        assert len(ltv_predictions) == len(customer_data)
        assert all(ltv > 0 for ltv in ltv_predictions.values())

class TestBehavioralAnalytics:
    """Tests for BehavioralAnalytics."""
    
    def test_segment_customers(self, sample_customer_data):
        """Test customer segmentation."""
        analytics = BehavioralAnalytics()
        
        customer_behavior = pd.DataFrame({
            "customer_id": ["cust_1", "cust_2", "cust_3"],
            "frequency": [10, 1, 5],
            "monetary": [500.0, 100.0, 375.0],
            "recency": [10, 90, 30]
        })
        
        segments = analytics.segment_customers(customer_behavior)
        
        assert len(segments) == len(customer_behavior)
        assert all(segment in ["Champions", "Loyal", "At Risk", "Lost"] for segment in segments.values())
    
    def test_analyze_purchase_patterns(self, sample_order_data):
        """Test purchase pattern analysis."""
        analytics = BehavioralAnalytics()
        
        orders_df = pd.DataFrame(sample_order_data)
        
        patterns = analytics.analyze_purchase_patterns(orders_df)
        
        assert "avg_time_between_purchases" in patterns
        assert "most_common_day" in patterns
        assert "most_common_hour" in patterns
    
    def test_identify_customer_journey(self):
        """Test customer journey identification."""
        analytics = BehavioralAnalytics()
        
        # Create sample touchpoint data
        touchpoints = pd.DataFrame({
            "customer_id": ["cust_1"] * 5,
            "action": ["view_product", "add_to_cart", "checkout", "payment", "purchase"],
            "timestamp": pd.date_range(start="2023-01-01", periods=5, freq="H"),
            "channel": ["web", "web", "web", "web", "web"]
        })
        
        journeys = analytics.identify_customer_journey(touchpoints)
        
        assert "cust_1" in journeys
        assert len(journeys["cust_1"]) == 5
        assert journeys["cust_1"][0]["action"] == "view_product"

class TestRecommendationEngine:
    """Tests for RecommendationEngine."""
    
    def test_recommend_products(self, sample_product_data, sample_order_data):
        """Test product recommendations."""
        engine = RecommendationEngine()
        
        # Create sample interaction data
        interactions = pd.DataFrame({
            "customer_id": ["cust_1", "cust_1", "cust_2"],
            "product_id": ["prod_1", "prod_2", "prod_1"],
            "interaction_type": ["purchase", "view", "purchase"],
            "timestamp": pd.date_range(start="2023-01-01", periods=3, freq="D")
        })
        
        recommendations = engine.recommend_products(
            customer_id="cust_1",
            interaction_data=interactions,
            n_recommendations=5
        )
        
        assert len(recommendations) <= 5
        assert all("product_id" in rec for rec in recommendations)
        assert all("score" in rec for rec in recommendations)
    
    def test_find_similar_products(self, sample_product_data):
        """Test similar product finding."""
        engine = RecommendationEngine()
        
        products_df = pd.DataFrame(sample_product_data)
        
        similar_products = engine.find_similar_products(
            product_id="prod_1",
            product_data=products_df,
            n_similar=3
        )
        
        assert len(similar_products) <= 3
        assert all("product_id" in prod for prod in similar_products)
        assert all("similarity_score" in prod for prod in similar_products)
    
    def test_recommend_cross_sell(self, sample_order_data):
        """Test cross-sell recommendations."""
        engine = RecommendationEngine()
        
        orders_df = pd.DataFrame(sample_order_data)
        
        cross_sell = engine.recommend_cross_sell(
            product_id="prod_1",
            order_data=orders_df,
            n_recommendations=3
        )
        
        assert len(cross_sell) <= 3
        assert all("product_id" in item for item in cross_sell)
        assert all("confidence" in item for item in cross_sell)
