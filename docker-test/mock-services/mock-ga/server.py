from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Any
import uvicorn
from datetime import datetime, timedelta
import os

app = FastAPI()

# Mock data
mock_properties = [
    {
        "name": "properties/123456789",
        "displayName": "Test Property 1",
        "property_id": "123456789",
        "created_time": "2024-01-01T00:00:00Z"
    }
]

mock_reports = {
    "page_views": {
        "dimensionHeaders": [
            {"name": "date"},
            {"name": "pagePath"}
        ],
        "metricHeaders": [
            {"name": "screenPageViews"},
            {"name": "activeUsers"}
        ],
        "rows": [
            {
                "dimensionValues": [
                    {"value": "20240501"},
                    {"value": "/"}
                ],
                "metricValues": [
                    {"value": "1000"},
                    {"value": "500"}
                ]
            },
            {
                "dimensionValues": [
                    {"value": "20240501"},
                    {"value": "/products"}
                ],
                "metricValues": [
                    {"value": "750"},
                    {"value": "400"}
                ]
            }
        ]
    },
    "user_acquisition": {
        "dimensionHeaders": [
            {"name": "date"},
            {"name": "sessionSource"}
        ],
        "metricHeaders": [
            {"name": "activeUsers"},
            {"name": "sessions"}
        ],
        "rows": [
            {
                "dimensionValues": [
                    {"value": "20240501"},
                    {"value": "google"}
                ],
                "metricValues": [
                    {"value": "300"},
                    {"value": "350"}
                ]
            },
            {
                "dimensionValues": [
                    {"value": "20240501"},
                    {"value": "direct"}
                ],
                "metricValues": [
                    {"value": "200"},
                    {"value": "250"}
                ]
            }
        ]
    }
}

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "mock-ga"}

# Properties endpoint
@app.get("/management/properties")
async def list_properties():
    return {"properties": mock_properties}

# Reports endpoint
@app.post("/data:runReport")
async def run_report(request: Dict[str, Any]):
    report_type = "page_views"  # Default report type
    
    # Check if request has dimensions to determine report type
    if "dimensions" in request:
        for dimension in request["dimensions"]:
            if dimension.get("name") == "sessionSource":
                report_type = "user_acquisition"
                break
    
    return mock_reports.get(report_type, mock_reports["page_views"])

# Real-time report endpoint
@app.post("/data:runRealtimeReport")
async def run_realtime_report(request: Dict[str, Any]):
    return {
        "dimensionHeaders": [
            {"name": "unifiedScreenName"}
        ],
        "metricHeaders": [
            {"name": "activeUsers"}
        ],
        "rows": [
            {
                "dimensionValues": [
                    {"value": "/"}
                ],
                "metricValues": [
                    {"value": "25"}
                ]
            },
            {
                "dimensionValues": [
                    {"value": "/products"}
                ],
                "metricValues": [
                    {"value": "15"}
                ]
            }
        ],
        "rowCount": 2,
        "minimumAggregationSize": 0
    }

# OAuth2 token endpoint (mock)
@app.post("/token")
async def get_token():
    return {
        "access_token": "mock-access-token",
        "token_type": "Bearer",
        "expires_in": 3600,
        "refresh_token": "mock-refresh-token"
    }

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8081))
    uvicorn.run(app, host="0.0.0.0", port=port)