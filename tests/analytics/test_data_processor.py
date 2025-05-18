from src.data_processor import summarize_orders


def test_summarize_orders_basic():
    orders = [
        {"total_price": 100.0},
        {"total_price": 50.0},
    ]
    summary = summarize_orders(orders)
    assert summary["total_revenue"] == 150.0
    assert summary["total_orders"] == 2
    assert summary["average_order_value"] == 75.0
