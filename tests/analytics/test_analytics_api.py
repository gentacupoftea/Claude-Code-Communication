from fastapi import FastAPI
from fastapi.testclient import TestClient
from src.analytics_api import router

app = FastAPI()
app.include_router(router)

client = TestClient(app)


def test_order_summary_endpoint():
    resp = client.get('/api/v1/analytics/orders/summary')
    assert resp.status_code == 200
    data = resp.json()
    assert 'total_revenue' in data
    assert data['total_orders'] == 2
