import pandas as pd
from typing import List, Dict


def summarize_orders(orders: List[Dict]) -> Dict[str, float]:
    """Return basic order statistics."""
    if not orders:
        return {"total_revenue": 0.0, "total_orders": 0, "average_order_value": 0.0}

    df = pd.DataFrame(orders)
    total_revenue = float(df["total_price"].sum())
    total_orders = len(df)
    average_order_value = total_revenue / total_orders if total_orders else 0
    return {
        "total_revenue": total_revenue,
        "total_orders": total_orders,
        "average_order_value": average_order_value,
    }
