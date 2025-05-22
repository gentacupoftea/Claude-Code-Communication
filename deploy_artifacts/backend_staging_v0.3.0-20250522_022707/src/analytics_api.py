from fastapi import APIRouter
from src.data_processor import summarize_orders

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])

# In a real app this would query the database
_FAKE_ORDERS = [
    {"id": 1, "total_price": 100.0, "created_at": "2025-05-01"},
    {"id": 2, "total_price": 150.0, "created_at": "2025-05-02"},
]


@router.get("/orders/summary")
async def order_summary():
    """Return order statistics for demo data."""
    return summarize_orders(_FAKE_ORDERS)
