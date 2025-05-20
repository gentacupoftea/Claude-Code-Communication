#!/usr/bin/env python
"""
楽天API実テスト用モックサーバー
実際の楽天APIをシミュレートし、テスト環境でのエッジケースやエラー状態をテストできます
"""

import os
import json
import time
import random
import logging
import argparse
import asyncio
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

import uvicorn
from fastapi import FastAPI, Request, Response, Header, HTTPException, Depends, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

# ロギング設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('mock_rakuten_server.log')
    ]
)
logger = logging.getLogger('mock_rakuten')

# FastAPIアプリケーション
app = FastAPI(title="Mock Rakuten API Server", version="1.0.0")

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# モックデータを格納
mock_data = {
    'products': [],
    'orders': [],
    'customers': [],
    'categories': [],
}

# レート制限設定
rate_limit = {
    'max_requests': 30,
    'remaining': 30,
    'reset_time': None,
    'user_quotas': {},
    'force_rate_limit_test': False  # 強制的にレート制限テストを有効化
}

# API制御設定 (テスト用)
api_controls = {
    'simulate_errors': False,  # デフォルトではエラーを模擬しない
    'error_rate': 0.1,  # 10%の確率でエラー発生
    'slow_response_rate': 0.2,  # 20%の確率で遅延
    'max_delay': 2.0,  # 最大遅延秒数
    'rate_limiting': True,  # レート制限を有効化
    'enable_rate_limit_test': False,  # レート制限テストを有効化
}


# モデル定義
class RakutenAuthRequest(BaseModel):
    grant_type: str = "client_credentials"
    scope: str = "rakuten_ichiba"
    client_id: str
    client_secret: str


class RakutenProduct(BaseModel):
    itemId: str
    title: str
    description: Optional[str] = None
    price: float
    taxRate: Optional[float] = None
    stockCount: Optional[int] = None
    status: str = "ACTIVE"
    categoryId: Optional[str] = None
    images: List[Dict[str, str]] = Field(default_factory=list)
    options: List[Dict[str, Any]] = Field(default_factory=list)
    createdAt: str = None
    updatedAt: str = None

    @field_validator('createdAt', 'updatedAt', mode='before')
    @classmethod
    def default_datetime(cls, v):
        return v or datetime.now().isoformat()


class RakutenOrder(BaseModel):
    orderId: str
    orderStatus: str
    orderDate: str
    totalPrice: float
    totalTax: float
    shippingFee: float
    paymentMethod: str
    items: List[Dict[str, Any]] = Field(default_factory=list)
    shippingAddress: Optional[Dict[str, Any]] = None
    customerId: Optional[str] = None
    createdAt: str = None
    updatedAt: str = None

    @field_validator('createdAt', 'updatedAt', mode='before')
    @classmethod
    def default_datetime(cls, v):
        return v or datetime.now().isoformat()


class RakutenCustomer(BaseModel):
    memberId: str
    email: str
    firstName: str
    lastName: str
    phoneNumber: Optional[str] = None
    status: str = "ACTIVE"
    memberRank: str = "NORMAL"
    registeredDate: str
    lastOrderDate: Optional[str] = None
    ordersCount: int = 0
    totalSpent: float = 0.0


class RakutenCategory(BaseModel):
    categoryId: str
    name: str
    level: int
    parentId: Optional[str] = None
    children: List[Dict[str, Any]] = Field(default_factory=list)


# レート制限チェック
def check_rate_limit(request: Request) -> bool:
    """
    レート制限をチェックして制限に達していたらFalseを返す
    Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
    """
    if not api_controls['rate_limiting']:
        return True
    
    # レート制限テストが有効で、パスに 'rate_limit_test' が含まれている場合は強制的に制限
    if api_controls['enable_rate_limit_test'] and 'rate_limit_test' in request.url.path:
        logger.warning("レート制限テストモード: 強制的に制限")
        rate_limit['remaining'] = 0
        return False
    
    # 強制レート制限テストモードが有効な場合も強制的に制限
    if rate_limit['force_rate_limit_test']:
        logger.warning("強制レート制限テストモード有効")
        rate_limit['force_rate_limit_test'] = False  # 1回だけ制限
        rate_limit['remaining'] = 0
        return False
        
    client_ip = request.client.host
    
    # クライアント別のクォータ管理
    if client_ip not in rate_limit['user_quotas']:
        rate_limit['user_quotas'][client_ip] = {
            'requests': 0,
            'last_reset': time.time()
        }
    
    # 最後のリセットから5分経過していたらリセット
    user_quota = rate_limit['user_quotas'][client_ip]
    if time.time() - user_quota['last_reset'] > 300:  # 5分
        user_quota['requests'] = 0
        user_quota['last_reset'] = time.time()
    
    # 制限チェック
    if user_quota['requests'] >= rate_limit['max_requests']:
        return False
    
    # リクエストカウント増加
    user_quota['requests'] += 1
    rate_limit['remaining'] = rate_limit['max_requests'] - user_quota['requests']
    rate_limit['reset_time'] = user_quota['last_reset'] + 300  # 5分後
    
    return True


# レート制限ヘッダーを設定
def get_rate_limit_headers(request: Request) -> Dict[str, str]:
    """レート制限情報をヘッダーとして返す"""
    client_ip = request.client.host
    user_quota = rate_limit['user_quotas'].get(client_ip, {
        'requests': 0,
        'last_reset': time.time()
    })
    
    remaining = rate_limit['max_requests'] - user_quota['requests']
    reset_time = user_quota['last_reset'] + 300  # 5分後
    
    return {
        'X-RateLimit-Limit': str(rate_limit['max_requests']),
        'X-RateLimit-Remaining': str(remaining),
        'X-RateLimit-Reset': str(int(reset_time))
    }


# エラーシミュレーション
async def simulate_errors(request: Request) -> Optional[JSONResponse]:
    """ランダムにエラーを発生させる"""
    if not api_controls['simulate_errors']:
        return None
    
    # エラー発生率に基づいてエラーを発生させる
    if random.random() < api_controls['error_rate']:
        error_codes = [400, 401, 403, 404, 429, 500, 502, 503]
        error_weights = [0.15, 0.10, 0.10, 0.20, 0.15, 0.15, 0.05, 0.10]
        status_code = random.choices(error_codes, weights=error_weights)[0]
        
        error_messages = {
            400: "Bad Request - リクエストの形式が正しくありません",
            401: "Unauthorized - 認証エラー",
            403: "Forbidden - この操作の権限がありません",
            404: "Not Found - リソースが見つかりません",
            429: "Too Many Requests - リクエスト制限を超えました",
            500: "Internal Server Error - サーバーエラー",
            502: "Bad Gateway - ゲートウェイエラー",
            503: "Service Unavailable - サービス利用不可"
        }
        
        error_content = {
            "error": {
                "code": f"ERROR{status_code}",
                "message": error_messages[status_code]
            }
        }
        
        # レート制限エラーの場合、Retry-Afterヘッダーを追加
        headers = {}
        if status_code == 429:
            retry_after = random.randint(5, 30)
            headers['Retry-After'] = str(retry_after)
        
        return JSONResponse(
            status_code=status_code,
            content=error_content,
            headers=headers
        )
    
    return None


# レスポンス遅延シミュレーション
async def simulate_slow_response():
    """ランダムにレスポンス遅延を発生させる"""
    if random.random() < api_controls['slow_response_rate']:
        delay = random.uniform(0.5, api_controls['max_delay'])
        await asyncio.sleep(delay)


# ミドルウェア設定
@app.middleware("http")
async def api_middleware(request: Request, call_next):
    """APIミドルウェア: レート制限、エラーシミュレーション、遅延を処理"""
    # リクエストURL記録
    logger.info(f"Request: {request.method} {request.url.path}")
    
    # エラーシミュレーション
    error_response = await simulate_errors(request)
    if error_response:
        logger.warning(f"Simulated error: {error_response.status_code}")
        return error_response
    
    # レート制限チェック
    if not check_rate_limit(request):
        logger.warning("Rate limit exceeded")
        headers = get_rate_limit_headers(request)
        headers['Retry-After'] = '60'  # 60秒後に再試行を推奨
        
        return JSONResponse(
            status_code=429,
            content={
                "error": {
                    "code": "RATE_LIMIT",
                    "message": "Rate limit exceeded. Please try again later."
                }
            },
            headers=headers
        )
    
    # レスポンス遅延シミュレーション
    await simulate_slow_response()
    
    # 実際のハンドラを呼び出し
    response = await call_next(request)
    
    # レート制限ヘッダーを追加
    rate_limit_headers = get_rate_limit_headers(request)
    for key, value in rate_limit_headers.items():
        response.headers[key] = value
    
    return response


# APIエンドポイント

# 認証
@app.post("/es/2.0/auth/token")
async def auth_token(request: Request):
    """認証トークン発行"""
    logger.info("Auth token requested")
    
    # フォームデータとJSONの両方をサポート
    try:
        # コンテントタイプを確認
        content_type = request.headers.get("Content-Type", "")
        
        # フォームデータの場合
        if "application/x-www-form-urlencoded" in content_type:
            form_data = await request.form()
            grant_type = form_data.get("grant_type", "client_credentials")
            scope = form_data.get("scope", "rakuten_ichiba")
        # JSONの場合
        else:
            body = await request.json()
            grant_type = body.get("grant_type", "client_credentials")
            scope = body.get("scope", "rakuten_ichiba")
    except Exception:
        # パース失敗時のフォールバック
        grant_type = "client_credentials"
        scope = "rakuten_ichiba"
    
    # 常に成功するトークンを返す (実際のAPIでは認証情報を検証する)
    return {
        "access_token": "mock_access_token_" + str(int(time.time())),
        "token_type": "Bearer",
        "expires_in": 3600,
        "scope": scope,
        "created_at": int(time.time())
    }


# ショップ情報
@app.get("/es/2.0/shop/get")
async def get_shop(authorization: str = Header(None)):
    """ショップ情報取得 (接続テスト用)"""
    if not authorization or 'bearer' not in authorization.lower():
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    return {
        "shopId": "mock_shop",
        "shopName": "楽天モックショップ",
        "shopStatus": "ACTIVE",
        "shopUrl": "https://mock.rakuten.co.jp/shop",
        "ownerName": "モック太郎",
        "startDate": "2020-01-01",
        "contractType": "STANDARD"
    }


# 商品一覧
@app.get("/es/2.0/products/search")
async def search_products(limit: int = 50, offset: int = 0, 
                        categoryId: Optional[str] = None,
                        authorization: str = Header(None)):
    """商品検索"""
    if not authorization or 'bearer' not in authorization.lower():
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # モックデータから商品を取得
    products = mock_data['products']
    
    # カテゴリでフィルタ
    if categoryId:
        products = [p for p in products if p.get("categoryId") == categoryId]
    
    # ページネーション
    paginated = products[offset:offset+limit]
    
    return {
        "totalCount": len(products),
        "offset": offset,
        "limit": limit,
        "products": paginated
    }


# 単一商品取得
@app.get("/es/2.0/product/get")
async def get_product(itemId: str, authorization: str = Header(None)):
    """単一商品取得"""
    if not authorization or 'bearer' not in authorization.lower():
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # テスト用ID "123456" の特別なハンドリング
    if itemId == "123456":
        # テスト用にモックデータの最初の商品を返す（IDを修正して）
        if mock_data['products']:
            test_product = mock_data['products'][0].copy()
            test_product["itemId"] = "123456"
            return test_product
    
    # それ以外の場合は通常のIDマッチング
    for product in mock_data['products']:
        if product.get("itemId") == itemId:
            return product
    
    # 見つからない場合は404
    # "nonexistent_product_id_12345" はエラーテスト用なので404を返す
    raise HTTPException(status_code=404, detail="Product not found")


# 商品作成
@app.post("/es/2.0/product/create")
async def create_product(product: RakutenProduct, authorization: str = Header(None)):
    """商品作成"""
    if not authorization or 'bearer' not in authorization.lower():
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # 重複IDをチェック
    for existing in mock_data['products']:
        if existing.get("itemId") == product.itemId:
            raise HTTPException(status_code=400, detail="Product ID already exists")
    
    # タイムスタンプを設定
    now = datetime.now().isoformat()
    product_dict = product.dict()
    product_dict["createdAt"] = now
    product_dict["updatedAt"] = now
    
    # 商品を追加
    mock_data['products'].append(product_dict)
    
    return product_dict


# 注文一覧
@app.get("/es/2.0/orders/search")
async def search_orders(limit: int = 50, offset: int = 0,
                       startDate: Optional[str] = None,
                       endDate: Optional[str] = None,
                       orderStatus: Optional[str] = None,
                       authorization: str = Header(None)):
    """注文検索"""
    if not authorization or 'bearer' not in authorization.lower():
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # モックデータから注文を取得
    orders = mock_data['orders']
    
    # 日付範囲でフィルタ
    if startDate:
        start = datetime.fromisoformat(startDate.replace('Z', '+00:00'))
        orders = [o for o in orders if datetime.fromisoformat(o.get("orderDate").replace('Z', '+00:00')) >= start]
    
    if endDate:
        end = datetime.fromisoformat(endDate.replace('Z', '+00:00'))
        orders = [o for o in orders if datetime.fromisoformat(o.get("orderDate").replace('Z', '+00:00')) <= end]
    
    # ステータスでフィルタ
    if orderStatus:
        orders = [o for o in orders if o.get("orderStatus") == orderStatus]
    
    # クライアントコードと互換性を持たせるために'id'キーを追加
    for order in orders:
        if 'orderId' in order and 'id' not in order:
            order['id'] = order['orderId']
    
    # ページネーション
    paginated = orders[offset:offset+limit]
    
    return {
        "totalCount": len(orders),
        "offset": offset,
        "limit": limit,
        "orders": paginated
    }


# 単一注文取得
@app.get("/es/2.0/order/get")
async def get_order(orderId: str, authorization: str = Header(None)):
    """単一注文取得"""
    if not authorization or 'bearer' not in authorization.lower():
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # 注文リストを走査してIDを検索
    for order in mock_data['orders']:
        # 'orderId'と'id'の両方をチェック
        if order.get("orderId") == orderId or order.get("id") == orderId:
            # レスポンスでidを追加
            response_order = order.copy()
            if 'orderId' in response_order and 'id' not in response_order:
                response_order['id'] = response_order['orderId']
            return response_order
    
    # 見つからない場合は404
    raise HTTPException(status_code=404, detail="Order not found")


# 注文ステータス更新
@app.post("/es/2.0/order/update")
async def update_order(request: Request, authorization: str = Header(None)):
    """注文更新"""
    if not authorization or 'bearer' not in authorization.lower():
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    data = await request.json()
    order_id = data.get("orderId")
    
    if not order_id:
        raise HTTPException(status_code=400, detail="Order ID is required")
    
    # IDが一致する注文を検索
    for order in mock_data['orders']:
        if order.get("orderId") == order_id:
            # 更新データをマージ
            for key, value in data.items():
                if key != "orderId":
                    order[key] = value
            
            # 更新日時を設定
            order["updatedAt"] = datetime.now().isoformat()
            
            return order
    
    # 見つからない場合は404
    raise HTTPException(status_code=404, detail="Order not found")


# 顧客一覧
@app.get("/es/2.0/members/search")
async def search_customers(limit: int = 50, offset: int = 0,
                          authorization: str = Header(None)):
    """顧客検索"""
    if not authorization or 'bearer' not in authorization.lower():
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # モックデータから顧客を取得
    customers = mock_data['customers']
    
    # クライアントコードと互換性を持たせるために'id'キーを追加
    for customer in customers:
        if 'memberId' in customer and 'id' not in customer:
            customer['id'] = customer['memberId']
    
    # ページネーション
    paginated = customers[offset:offset+limit]
    
    return {
        "totalCount": len(customers),
        "offset": offset,
        "limit": limit,
        "members": paginated
    }


# 単一顧客取得
@app.get("/es/2.0/member/get")
async def get_customer(memberId: str, authorization: str = Header(None)):
    """単一顧客取得"""
    if not authorization or 'bearer' not in authorization.lower():
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # 顧客リストを走査してIDを検索
    for customer in mock_data['customers']:
        # 'memberId'と'id'の両方をチェック
        if customer.get("memberId") == memberId or customer.get("id") == memberId:
            # レスポンスでidを追加
            response_customer = customer.copy()
            if 'memberId' in response_customer and 'id' not in response_customer:
                response_customer['id'] = response_customer['memberId']
            return response_customer
    
    # 見つからない場合は404
    raise HTTPException(status_code=404, detail="Customer not found")


# カテゴリ一覧
@app.get("/es/2.0/categories")
@app.get("/es/1.0/categories")
async def get_categories(authorization: str = Header(None)):
    """カテゴリ一覧取得"""
    if not authorization or 'bearer' not in authorization.lower():
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    return {
        "totalCount": len(mock_data['categories']),
        "categories": mock_data['categories']
    }


# 単一カテゴリ取得
@app.get("/es/2.0/category/get")
async def get_category(categoryId: str, authorization: str = Header(None)):
    """単一カテゴリ取得"""
    if not authorization or 'bearer' not in authorization.lower():
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # IDが一致するカテゴリを検索
    for category in mock_data['categories']:
        if category.get("categoryId") == categoryId:
            return category
    
    # 見つからない場合は404
    raise HTTPException(status_code=404, detail="Category not found")


# 管理API - テスト設定変更
@app.post("/admin/settings")
async def update_settings(settings: Dict[str, Any], api_key: str = Header(None)):
    """テスト設定の変更 (管理者用)"""
    if not api_key or api_key != "mock_admin_key":
        raise HTTPException(status_code=403, detail="Forbidden")
    
    global api_controls
    
    # 設定を更新
    for key, value in settings.items():
        if key in api_controls:
            api_controls[key] = value
    
    return {
        "status": "success",
        "settings": api_controls
    }


# 管理API - モックデータ初期化
@app.post("/admin/reset")
async def reset_data(api_key: str = Header(None)):
    """モックデータを初期化 (管理者用)"""
    if not api_key or api_key != "mock_admin_key":
        raise HTTPException(status_code=403, detail="Forbidden")
    
    load_mock_data()
    
    return {
        "status": "success",
        "message": "Mock data has been reset"
    }


# モックデータ生成
def generate_mock_data():
    """テスト用のモックデータを生成"""
    # カテゴリ生成
    categories = []
    for i in range(1, 6):
        category_id = f"cat{i}"
        category = {
            "categoryId": category_id,
            "name": f"カテゴリ{i}",
            "level": 1,
            "parentId": None,
            "children": []
        }
        
        # サブカテゴリ生成
        for j in range(1, 4):
            sub_cat_id = f"{category_id}_sub{j}"
            sub_category = {
                "categoryId": sub_cat_id,
                "name": f"サブカテゴリ{i}-{j}",
                "level": 2,
                "parentId": category_id,
                "children": []
            }
            category["children"].append(sub_category)
        
        categories.append(category)
    
    # 商品生成
    products = []
    for i in range(1, 101):
        product_id = f"p{i:06d}"
        category_index = random.randint(0, 4)
        category = categories[category_index]
        
        # サブカテゴリをランダムに選択
        if category["children"]:
            sub_cat_index = random.randint(0, len(category["children"]) - 1)
            category_id = category["children"][sub_cat_index]["categoryId"]
        else:
            category_id = category["categoryId"]
        
        # 商品生成
        product = {
            "itemId": product_id,
            "title": f"テスト商品{i}",
            "description": f"これはテスト商品{i}の説明です。",
            "price": random.randint(500, 10000),
            "taxRate": 0.1,
            "stockCount": random.randint(0, 100),
            "status": random.choices(["ACTIVE", "INACTIVE", "SOLD_OUT"], weights=[0.7, 0.2, 0.1])[0],
            "categoryId": category_id,
            "images": [
                {"url": f"https://example.com/img/{product_id}_1.jpg", "isMain": True},
                {"url": f"https://example.com/img/{product_id}_2.jpg", "isMain": False}
            ],
            "options": [],
            "createdAt": (datetime.now() - timedelta(days=random.randint(1, 365))).isoformat(),
            "updatedAt": (datetime.now() - timedelta(days=random.randint(0, 30))).isoformat()
        }
        
        # バリエーション商品の場合
        if random.random() < 0.3:
            options = ["色", "サイズ"]
            color_values = ["赤", "青", "緑", "黒", "白"]
            size_values = ["S", "M", "L", "XL"]
            
            product["options"].append({
                "name": options[0],
                "values": random.sample(color_values, random.randint(2, len(color_values)))
            })
            
            product["options"].append({
                "name": options[1],
                "values": random.sample(size_values, random.randint(2, len(size_values)))
            })
        
        products.append(product)
    
    # 顧客生成
    customers = []
    for i in range(1, 51):
        customer_id = f"c{i:06d}"
        registered_date = (datetime.now() - timedelta(days=random.randint(1, 730))).isoformat()
        
        # 注文回数
        orders_count = random.randint(0, 10)
        last_order_date = None
        total_spent = 0.0
        
        if orders_count > 0:
            last_order_date = (datetime.now() - timedelta(days=random.randint(0, 90))).isoformat()
            total_spent = orders_count * random.randint(1000, 10000)
        
        customer = {
            "memberId": customer_id,
            "email": f"customer{i}@example.com",
            "firstName": f"名前{i}",
            "lastName": f"姓{i}",
            "phoneNumber": f"090-1234-{i:04d}",
            "status": random.choices(["ACTIVE", "INACTIVE"], weights=[0.9, 0.1])[0],
            "memberRank": random.choices(["NORMAL", "SILVER", "GOLD", "PLATINUM"], 
                                      weights=[0.6, 0.2, 0.15, 0.05])[0],
            "registeredDate": registered_date,
            "lastOrderDate": last_order_date,
            "ordersCount": orders_count,
            "totalSpent": total_spent
        }
        
        customers.append(customer)
    
    # 注文生成
    orders = []
    for i in range(1, 101):
        order_id = f"o{i:06d}"
        
        # 顧客を選択
        customer = random.choice(customers) if customers else None
        customer_id = customer["memberId"] if customer else None
        
        # 注文日
        order_date = (datetime.now() - timedelta(days=random.randint(0, 180))).isoformat()
        
        # 注文商品
        order_items = []
        item_count = random.randint(1, 5)
        total_price = 0
        
        for j in range(item_count):
            product = random.choice(products)
            quantity = random.randint(1, 3)
            item_price = product["price"]
            item_total = item_price * quantity
            total_price += item_total
            
            order_items.append({
                "itemId": product["itemId"],
                "title": product["title"],
                "price": item_price,
                "quantity": quantity,
                "totalPrice": item_total
            })
        
        # 税額
        tax_rate = 0.1
        total_tax = total_price * tax_rate
        
        # 配送料
        shipping_fee = random.choice([0, 500, 800])
        
        # 配送先住所
        shipping_address = {
            "firstName": f"配送名{i}",
            "lastName": f"配送姓{i}",
            "postalCode": f"123-{i:04d}",
            "prefecture": "東京都",
            "city": "渋谷区",
            "address1": f"テスト住所{i}",
            "address2": "",
            "phoneNumber": f"03-1234-{i:04d}"
        }
        
        # 支払い方法
        payment_method = random.choice(["CREDIT_CARD", "CONVENIENCE_STORE", "BANK_TRANSFER", "COD"])
        
        # 注文ステータス
        statuses = ["NEW", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELED"]
        weights = [0.1, 0.2, 0.3, 0.3, 0.1]  # 確率重み
        order_status = random.choices(statuses, weights=weights)[0]
        
        order = {
            "orderId": order_id,
            "orderStatus": order_status,
            "orderDate": order_date,
            "totalPrice": total_price,
            "totalTax": total_tax,
            "shippingFee": shipping_fee,
            "paymentMethod": payment_method,
            "items": order_items,
            "shippingAddress": shipping_address,
            "customerId": customer_id,
            "createdAt": order_date,
            "updatedAt": (datetime.now() - timedelta(days=random.randint(0, 30))).isoformat()
        }
        
        orders.append(order)
    
    return {
        'products': products,
        'orders': orders,
        'customers': customers,
        'categories': categories,
    }


def load_mock_data():
    """モックデータを読み込むか生成する"""
    global mock_data
    
    data_file = 'rakuten_mock_data.json'
    
    # データファイルが存在すれば読み込み
    if os.path.exists(data_file):
        try:
            with open(data_file, 'r', encoding='utf-8') as f:
                mock_data = json.load(f)
            logger.info(f"Loaded mock data from {data_file}")
            return
        except Exception as e:
            logger.error(f"Failed to load mock data: {e}")
    
    # データ生成
    mock_data = generate_mock_data()
    
    # データ保存
    try:
        with open(data_file, 'w', encoding='utf-8') as f:
            json.dump(mock_data, f, ensure_ascii=False, indent=2)
        logger.info(f"Generated and saved mock data to {data_file}")
    except Exception as e:
        logger.error(f"Failed to save mock data: {e}")


@app.on_event("startup")
async def startup_event():
    """起動時の処理"""
    load_mock_data()
    logger.info(f"Mock Rakuten API Server started with {len(mock_data['products'])} products")


def main():
    """アプリケーションのメインエントリーポイント"""
    parser = argparse.ArgumentParser(description='楽天APIモックサーバー')
    parser.add_argument('--host', type=str, default='127.0.0.1', help='ホストアドレス')
    parser.add_argument('--port', type=int, default=8080, help='ポート番号')
    parser.add_argument('--reload', action='store_true', help='ファイル変更時に自動再読み込み')
    parser.add_argument('--error-rate', type=float, default=0.1, help='エラー発生率 (0.0-1.0)')
    parser.add_argument('--slow-rate', type=float, default=0.2, help='遅延発生率 (0.0-1.0)')
    parser.add_argument('--no-errors', action='store_true', help='エラーシミュレーションを無効化')
    parser.add_argument('--no-rate-limit', action='store_true', help='レート制限を無効化')
    parser.add_argument('--enable-rate-limit-test', action='store_true', help='レート制限テストを有効化')
    
    args = parser.parse_args()
    
    # API制御設定を更新
    api_controls['simulate_errors'] = not args.no_errors
    api_controls['error_rate'] = args.error_rate
    api_controls['slow_response_rate'] = args.slow_rate
    api_controls['rate_limiting'] = not args.no_rate_limit
    api_controls['enable_rate_limit_test'] = args.enable_rate_limit_test
    
    # レート制限テストが有効の場合は通知
    if args.enable_rate_limit_test:
        logger.warning("レート制限テストが有効になっています。rate_limit_testを含むパスへのリクエストは常にレート制限されます。")
    
    logger.info(f"Starting Mock Rakuten API Server on {args.host}:{args.port}")
    logger.info(f"API Controls: {api_controls}")
    
    uvicorn.run(
        "mock_rakuten_server:app",
        host=args.host,
        port=args.port,
        reload=args.reload
    )


if __name__ == "__main__":
    main()