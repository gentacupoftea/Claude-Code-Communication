"""Advanced analytics examples for the data integration module."""

import asyncio
import pandas as pd
from datetime import datetime, timedelta
from src.data_integration.analytics.predictive_analytics import PredictiveAnalytics
from src.data_integration.analytics.behavioral_analytics import BehavioralAnalytics
from src.data_integration.analytics.recommendation_engine import RecommendationEngine
from src.data_integration.dependencies import get_analytics_engine

async def predictive_analytics_example():
    """Example of predictive analytics."""
    # Initialize predictive analytics
    predictive = PredictiveAnalytics()
    
    # Prepare customer feature data
    customer_features = pd.DataFrame({
        "customer_id": ["cust_1", "cust_2", "cust_3", "cust_4", "cust_5"],
        "days_since_last_order": [10, 90, 45, 5, 120],
        "total_orders": [15, 2, 7, 25, 1],
        "average_order_value": [85.50, 125.00, 67.25, 95.75, 45.00],
        "lifetime_value": [1282.50, 250.00, 470.75, 2393.75, 45.00],
        "email_engagement_score": [0.8, 0.2, 0.5, 0.9, 0.1]
    })
    
    # Predict churn
    churn_predictions = await predictive.predict_churn(customer_features)
    
    print("Churn Predictions:")
    for customer_id, churn_prob in churn_predictions.items():
        risk_level = "High" if churn_prob > 0.7 else "Medium" if churn_prob > 0.4 else "Low"
        print(f"{customer_id}: {churn_prob:.2%} ({risk_level} risk)")
    
    # Predict lifetime value
    ltv_predictions = await predictive.predict_ltv(customer_features)
    
    print("\nLTV Predictions (next 12 months):")
    for customer_id, predicted_ltv in ltv_predictions.items():
        print(f"{customer_id}: ${predicted_ltv:,.2f}")
    
    # Demand forecasting
    historical_sales = pd.DataFrame({
        "date": pd.date_range(start="2023-01-01", end="2023-12-31", freq="D"),
        "demand": [100 + i % 30 + (i % 7) * 5 for i in range(365)]
    })
    
    forecast = await predictive.forecast_demand(
        historical_data=historical_sales,
        forecast_days=30,
        include_seasonality=True
    )
    
    print("\nDemand Forecast (next 30 days):")
    print(f"Total predicted demand: {forecast['predicted_demand'].sum():.0f} units")
    print(f"Peak demand day: {forecast.loc[forecast['predicted_demand'].idxmax(), 'date']}")
    print(f"Average daily demand: {forecast['predicted_demand'].mean():.1f} units")

async def behavioral_analytics_example():
    """Example of behavioral analytics."""
    # Initialize behavioral analytics
    behavioral = BehavioralAnalytics()
    
    # Customer segmentation data
    customer_behavior = pd.DataFrame({
        "customer_id": [f"cust_{i}" for i in range(1, 101)],
        "frequency": [i % 20 + 1 for i in range(100)],
        "monetary": [50 + (i % 50) * 10 for i in range(100)],
        "recency": [i % 90 + 1 for i in range(100)]
    })
    
    # Segment customers
    segments = await behavioral.segment_customers(customer_behavior)
    
    print("Customer Segments:")
    segment_counts = pd.Series(list(segments.values())).value_counts()
    for segment, count in segment_counts.items():
        print(f"{segment}: {count} customers ({count/len(segments)*100:.1f}%)")
    
    # Analyze purchase patterns
    purchase_data = pd.DataFrame({
        "customer_id": ["cust_1"] * 10,
        "order_date": pd.date_range(start="2023-01-01", periods=10, freq="M"),
        "order_amount": [75, 120, 85, 95, 110, 88, 125, 92, 108, 115],
        "day_of_week": [1, 5, 2, 6, 0, 3, 5, 1, 4, 6],
        "hour_of_day": [10, 14, 9, 19, 11, 16, 20, 10, 15, 18]
    })
    
    patterns = await behavioral.analyze_purchase_patterns(purchase_data)
    
    print("\nPurchase Patterns:")
    print(f"Average time between purchases: {patterns['avg_time_between_purchases']:.1f} days")
    print(f"Most common day: {patterns['most_common_day']}")
    print(f"Most common hour: {patterns['most_common_hour']}:00")
    print(f"Seasonal pattern detected: {patterns['has_seasonal_pattern']}")
    
    # Customer journey analysis
    touchpoints = pd.DataFrame({
        "customer_id": ["cust_1"] * 8,
        "timestamp": pd.date_range(start="2023-10-01", periods=8, freq="H"),
        "action": ["view_homepage", "search_product", "view_product", "add_to_cart", 
                  "remove_from_cart", "add_to_cart", "checkout", "purchase"],
        "channel": ["web"] * 6 + ["mobile", "mobile"],
        "product_id": [None, None, "prod_123", "prod_123", "prod_123", "prod_123", None, None]
    })
    
    journeys = await behavioral.identify_customer_journey(touchpoints)
    
    print("\nCustomer Journey Analysis:")
    journey = journeys["cust_1"]
    print(f"Total touchpoints: {len(journey)}")
    print(f"Journey duration: {(journey[-1]['timestamp'] - journey[0]['timestamp']).total_seconds() / 3600:.1f} hours")
    print(f"Cart abandonment detected: {'remove_from_cart' in [t['action'] for t in journey]}")

async def recommendation_engine_example():
    """Example of recommendation engine."""
    # Initialize recommendation engine
    recommender = RecommendationEngine()
    
    # Product interaction data
    interactions = pd.DataFrame({
        "customer_id": ["cust_1", "cust_1", "cust_1", "cust_2", "cust_2", "cust_3"],
        "product_id": ["prod_1", "prod_2", "prod_3", "prod_1", "prod_4", "prod_2"],
        "interaction_type": ["purchase", "view", "purchase", "purchase", "view", "purchase"],
        "timestamp": pd.date_range(start="2023-10-01", periods=6, freq="D"),
        "rating": [5, None, 4, 5, None, 3]
    })
    
    # Get product recommendations
    recommendations = await recommender.recommend_products(
        customer_id="cust_1",
        interaction_data=interactions,
        n_recommendations=5,
        method="collaborative_filtering"
    )
    
    print("Product Recommendations for cust_1:")
    for i, rec in enumerate(recommendations, 1):
        print(f"{i}. {rec['product_id']} (Score: {rec['score']:.3f})")
    
    # Find similar products
    product_features = pd.DataFrame({
        "product_id": ["prod_1", "prod_2", "prod_3", "prod_4", "prod_5"],
        "category": ["electronics", "electronics", "clothing", "electronics", "clothing"],
        "price": [299.99, 199.99, 59.99, 399.99, 79.99],
        "brand": ["TechCo", "TechCo", "Fashion+", "SmartTech", "Fashion+"],
        "avg_rating": [4.5, 4.2, 4.8, 4.6, 4.3]
    })
    
    similar_products = await recommender.find_similar_products(
        product_id="prod_1",
        product_data=product_features,
        n_similar=3
    )
    
    print("\nSimilar products to prod_1:")
    for prod in similar_products:
        print(f"- {prod['product_id']} (Similarity: {prod['similarity_score']:.3f})")
    
    # Cross-sell recommendations
    order_data = pd.DataFrame({
        "order_id": ["ord_1", "ord_1", "ord_2", "ord_2", "ord_3"],
        "product_id": ["prod_1", "prod_2", "prod_1", "prod_4", "prod_2"],
        "quantity": [1, 1, 1, 1, 2]
    })
    
    cross_sell = await recommender.recommend_cross_sell(
        product_id="prod_1",
        order_data=order_data,
        n_recommendations=3
    )
    
    print("\nCross-sell recommendations for prod_1:")
    for rec in cross_sell:
        print(f"- {rec['product_id']} (Confidence: {rec['confidence']:.3f})")

async def integrated_analytics_example():
    """Example of integrated analytics across multiple engines."""
    # Get analytics engine
    analytics_engine = get_analytics_engine()
    
    # Get comprehensive customer insights
    customer_insights = await analytics_engine.get_customer_insights(
        customer_id="cust_1",
        store_domain="example.myshopify.com"
    )
    
    print("Comprehensive Customer Insights:")
    print(f"Customer: {customer_insights['customer_id']}")
    print(f"Segment: {customer_insights['segment']}")
    print(f"CLV: ${customer_insights['lifetime_value']:,.2f}")
    print(f"Predicted CLV (12 months): ${customer_insights['predicted_ltv']:,.2f}")
    print(f"Churn Risk: {customer_insights['churn_risk']:.1%}")
    print(f"\nPurchase Behavior:")
    print(f"- Frequency: {customer_insights['purchase_frequency']} orders/month")
    print(f"- AOV: ${customer_insights['average_order_value']:.2f}")
    print(f"- Preferred Category: {customer_insights['preferred_category']}")
    print(f"\nEngagement:")
    print(f"- Email Opens: {customer_insights['email_open_rate']:.1%}")
    print(f"- Website Visits: {customer_insights['monthly_visits']} visits/month")
    print(f"\nRecommended Actions:")
    for action in customer_insights['recommended_actions']:
        print(f"- {action}")

def main():
    """Run all advanced analytics examples."""
    print("Advanced Analytics Examples\n")
    
    asyncio.run(predictive_analytics_example())
    print("\n" + "="*50 + "\n")
    
    asyncio.run(behavioral_analytics_example())
    print("\n" + "="*50 + "\n")
    
    asyncio.run(recommendation_engine_example())
    print("\n" + "="*50 + "\n")
    
    asyncio.run(integrated_analytics_example())

if __name__ == "__main__":
    main()
