# OptimizedCacheManager API リファレンス

このドキュメントでは、OptimizedCacheManagerへのREST APIインターフェイスとPythonクライアントライブラリの使用方法について説明します。

## 目次

1. [REST API](#rest-api)
   - [APIサーバーの起動](#apiサーバーの起動)
   - [エンドポイント一覧](#エンドポイント一覧)
   - [レスポンス形式](#レスポンス形式)
   - [エラーレスポンス](#エラーレスポンス)
2. [Pythonクライアントライブラリ](#pythonクライアントライブラリ)
   - [基本的な使用方法](#基本的な使用方法)
   - [コマンドラインインターフェース](#コマンドラインインターフェース)
   - [コード例](#コード例)
3. [応用例](#応用例)
   - [モニタリング統合](#モニタリング統合)
   - [ダッシュボード連携](#ダッシュボード連携)
   - [大規模デプロイメント](#大規模デプロイメント)

## REST API

### APIサーバーの起動

APIサーバーを起動するには、以下のコマンドを実行します：

```bash
# デフォルト設定で起動（ポート8000）
python src/api/cache_api.py

# カスタムポートで起動
python src/api/cache_api.py --port 9000

# デバッグモードで起動
python src/api/cache_api.py --debug
```

サーバーが起動すると、以下のようなメッセージが表示されます：

```
INFO:cache_api:OptimizedCacheManager初期化完了: バージョン 1.0.0
INFO:cache_api:Redis有効: True
INFO:cache_api:圧縮有効: True
INFO:cache_api:キャッシュAPIサーバーが起動しました。ポート: 8000
INFO:cache_api:API URLs:
INFO:cache_api:  GET    /api/healthcheck                - ヘルスチェック
INFO:cache_api:  GET    /api/cache/stats                - キャッシュ統計
INFO:cache_api:  GET    /api/cache/keys?pattern=<パターン> - キー一覧
INFO:cache_api:  GET    /api/cache/key/<キー>            - キャッシュから値を取得
INFO:cache_api:  POST   /api/cache/key/<キー>            - キャッシュに値を設定
INFO:cache_api:  DELETE /api/cache/key/<キー>            - キャッシュから値を削除
INFO:cache_api:  DELETE /api/cache/invalidate-all       - すべてのキャッシュを削除
```

### エンドポイント一覧

#### ヘルスチェック

```
GET /api/healthcheck
```

サーバーの稼働状態を確認します。

**リクエスト例**：
```bash
curl http://localhost:8000/api/healthcheck
```

**レスポンス例**：
```json
{
  "status": "healthy",
  "timestamp": "2023-06-15T12:34:56.789012"
}
```

#### キャッシュ統計の取得

```
GET /api/cache/stats
```

キャッシュの統計情報を取得します。

**リクエスト例**：
```bash
curl http://localhost:8000/api/cache/stats
```

**レスポンス例**：
```json
{
  "version": "1.0.0",
  "hit_rate": 0.75,
  "memory_usage_bytes": 1048576,
  "memory_usage_mb": 1.0,
  "memory_limit_bytes": 104857600,
  "memory_limit_mb": 100.0,
  "memory_usage_percent": 1.0,
  "avg_cached_time_ms": 0.5,
  "avg_uncached_time_ms": 15.0,
  "redis_enabled": true,
  "redis": {
    "used_memory": 1048576,
    "used_memory_peak": 2097152,
    "used_memory_human": "1M",
    "mem_fragmentation_ratio": 1.2,
    "connected_clients": 1,
    "keyspace_hits": 150,
    "keyspace_misses": 50,
    "total_commands_processed": 500
  }
}
```

#### キー一覧の取得

```
GET /api/cache/keys
GET /api/cache/keys?pattern=<パターン>
```

キャッシュに保存されているキーの一覧を取得します。
`pattern`パラメータでキーをフィルタリングできます。

**リクエスト例**：
```bash
curl http://localhost:8000/api/cache/keys?pattern=user:
```

**レスポンス例**：
```json
{
  "keys": [
    "user:123",
    "user:456",
    "user:789"
  ]
}
```

#### キャッシュから値を取得

```
GET /api/cache/key/<キー>
```

指定したキーに対応する値を取得します。

**リクエスト例**：
```bash
curl http://localhost:8000/api/cache/key/user:123
```

**レスポンス例（成功）**：
```json
{
  "key": "user:123",
  "value": {"name": "John Doe", "email": "john@example.com"},
  "found": true
}
```

**レスポンス例（キーが存在しない）**：
```json
{
  "key": "user:123",
  "found": false
}
```

#### キャッシュに値を設定

```
POST /api/cache/key/<キー>
```

指定したキーに値を設定します。

**リクエストボディ**：
```json
{
  "value": "設定する値",
  "ttl": 60  // オプション、TTL（秒）
}
```

**リクエスト例**：
```bash
curl -X POST -H "Content-Type: application/json" \
     -d '{"value": {"name": "John Doe", "email": "john@example.com"}, "ttl": 60}' \
     http://localhost:8000/api/cache/key/user:123
```

**レスポンス例**：
```json
{
  "key": "user:123",
  "stored": true
}
```

#### キャッシュから値を削除

```
DELETE /api/cache/key/<キー>
```

指定したキーに対応する値を削除します。

**リクエスト例**：
```bash
curl -X DELETE http://localhost:8000/api/cache/key/user:123
```

**レスポンス例**：
```json
{
  "key": "user:123",
  "invalidated": true
}
```

#### すべてのキャッシュを削除

```
DELETE /api/cache/invalidate-all
```

キャッシュ内のすべての値を削除します。

**リクエスト例**：
```bash
curl -X DELETE http://localhost:8000/api/cache/invalidate-all
```

**レスポンス例**：
```json
{
  "invalidated": true
}
```

### レスポンス形式

すべてのAPIレスポンスはJSON形式で返されます。成功したリクエストは常に成功を示すフィールドを含みます。

### エラーレスポンス

エラーが発生した場合、適切なHTTPステータスコードと以下の形式のJSONレスポンスが返されます：

```json
{
  "error": "エラーメッセージ"
}
```

一般的なHTTPステータスコード：

- `200 OK`: リクエストが成功した
- `400 Bad Request`: リクエストの形式が不正
- `404 Not Found`: リソースが見つからない
- `500 Internal Server Error`: サーバー内部でエラーが発生した

## Pythonクライアントライブラリ

### 基本的な使用方法

Pythonクライアントライブラリを使用するには：

```python
from src.api.cache_client import CacheClient

# クライアントの初期化
client = CacheClient("http://localhost:8000")

# キャッシュへの値の設定
client.set("example:key", {"name": "Example Value"}, ttl=60)

# キャッシュからの値の取得
value = client.get("example:key")
print(value)  # {'name': 'Example Value'}

# キャッシュからの値の削除
client.invalidate("example:key")
```

### コマンドラインインターフェース

クライアントライブラリはコマンドラインインターフェース（CLI）も提供します：

```bash
# ヘルスチェック
python src/api/cache_client.py healthcheck

# 統計情報の取得
python src/api/cache_client.py stats

# キー一覧の取得
python src/api/cache_client.py keys
python src/api/cache_client.py keys --pattern="user:"

# 値の取得
python src/api/cache_client.py get "user:123"

# 値の設定
python src/api/cache_client.py set "user:123" '{"name": "John Doe"}' --ttl 60

# 値の削除
python src/api/cache_client.py invalidate "user:123"

# すべてのキャッシュの削除
python src/api/cache_client.py invalidate

# 複数の値の一括取得
python src/api/cache_client.py batch-get "user:123" "user:456" "user:789"

# 複数の値の一括設定
python src/api/cache_client.py batch-set '{"user:123": {"name": "John"}, "user:456": {"name": "Jane"}}' --ttl 60
```

### コード例

#### 基本的な使用例

```python
from src.api.cache_client import CacheClient

def get_user(user_id, client):
    # キャッシュからユーザー情報の取得を試みる
    cache_key = f"user:{user_id}"
    user_data = client.get(cache_key)
    
    if user_data is not None:
        print(f"キャッシュヒット: {cache_key}")
        return user_data
    
    # キャッシュにない場合は、データベースから取得（例）
    print(f"キャッシュミス: {cache_key}")
    user_data = fetch_user_from_database(user_id)
    
    # キャッシュに保存（TTL: 10分）
    client.set(cache_key, user_data, ttl=600)
    
    return user_data

# クライアントの初期化
client = CacheClient("http://localhost:8000")

# ユーザー情報の取得
user = get_user(123, client)
print(user)
```

#### バッチ処理の例

```python
from src.api.cache_client import CacheClient

def get_multiple_products(product_ids, client):
    # キーの生成
    cache_keys = [f"product:{pid}" for pid in product_ids]
    
    # キャッシュから一括取得
    cached_products = client.batch_get(cache_keys)
    
    # キャッシュミスしたIDを特定
    missing_ids = []
    result = {}
    
    for pid in product_ids:
        cache_key = f"product:{pid}"
        if cache_key in cached_products:
            result[pid] = cached_products[cache_key]
        else:
            missing_ids.append(pid)
    
    # キャッシュにないものはデータベースから取得（例）
    if missing_ids:
        db_products = fetch_products_from_database(missing_ids)
        
        # キャッシュに保存
        cache_updates = {}
        for pid, product in db_products.items():
            cache_key = f"product:{pid}"
            cache_updates[cache_key] = product
            result[pid] = product
        
        client.batch_set(cache_updates, ttl=300)
    
    return result

# クライアントの初期化
client = CacheClient("http://localhost:8000")

# 複数の商品情報の取得
products = get_multiple_products([101, 102, 103], client)
print(products)
```

## 応用例

### モニタリング統合

APIを使用してキャッシュメトリクスを定期的に収集し、モニタリングシステムに送信できます：

```python
import time
import requests
from src.api.cache_client import CacheClient

def collect_metrics(client, output_file=None):
    try:
        # キャッシュ統計の取得
        stats = client.get_stats()
        
        # タイムスタンプの追加
        stats["timestamp"] = time.time()
        
        # メトリクスの抽出
        metrics = {
            "hit_rate": stats.get("hit_rate", 0) * 100,  # パーセントに変換
            "memory_usage_mb": stats.get("memory_usage_mb", 0),
            "memory_usage_percent": stats.get("memory_usage_percent", 0)
        }
        
        # Redisメトリクスの追加
        if "redis" in stats:
            redis_stats = stats["redis"]
            metrics["redis_memory_mb"] = redis_stats.get("used_memory", 0) / (1024 * 1024)
            metrics["redis_connections"] = redis_stats.get("connected_clients", 0)
        
        # 出力ファイルへの保存（オプション）
        if output_file:
            with open(output_file, "a") as f:
                f.write(f"{stats['timestamp']},{metrics['hit_rate']},{metrics['memory_usage_mb']},{metrics['memory_usage_percent']}\n")
        
        # Prometheusにメトリクスを送信（例）
        # push_to_prometheus(metrics)
        
        return metrics
    
    except Exception as e:
        print(f"メトリクス収集中にエラーが発生: {e}")
        return None

# クライアントの初期化
client = CacheClient("http://localhost:8000")

# 定期的にメトリクスを収集（例：30秒ごと）
while True:
    metrics = collect_metrics(client, "cache_metrics.csv")
    print(f"ヒット率: {metrics['hit_rate']:.2f}%, メモリ使用率: {metrics['memory_usage_percent']:.2f}%")
    time.sleep(30)
```

### ダッシュボード連携

APIによって提供されるメトリクスを使用して、リアルタイムダッシュボードを構築できます：

```python
import time
import dash
import dash_core_components as dcc
import dash_html_components as html
from dash.dependencies import Input, Output
import plotly.graph_objects as go
from src.api.cache_client import CacheClient

app = dash.Dash(__name__)
client = CacheClient("http://localhost:8000")

# ダッシュボードレイアウト
app.layout = html.Div([
    html.H1("OptimizedCacheManager ダッシュボード"),
    
    dcc.Interval(
        id='interval-component',
        interval=5000,  # 5秒ごとに更新
        n_intervals=0
    ),
    
    html.Div([
        html.Div([
            html.H3("ヒット率"),
            dcc.Graph(id='hit-rate-gauge')
        ], className='four columns'),
        
        html.Div([
            html.H3("メモリ使用率"),
            dcc.Graph(id='memory-usage-gauge')
        ], className='four columns'),
        
        html.Div([
            html.H3("レスポンス時間"),
            dcc.Graph(id='response-time-graph')
        ], className='four columns')
    ], className='row')
])

@app.callback(
    [Output('hit-rate-gauge', 'figure'),
     Output('memory-usage-gauge', 'figure'),
     Output('response-time-graph', 'figure')],
    [Input('interval-component', 'n_intervals')]
)
def update_metrics(n):
    # キャッシュ統計の取得
    stats = client.get_stats()
    
    # ヒット率ゲージ
    hit_rate = stats.get("hit_rate", 0) * 100
    hit_rate_fig = go.Figure(go.Indicator(
        mode="gauge+number",
        value=hit_rate,
        domain={'x': [0, 1], 'y': [0, 1]},
        title={'text': "ヒット率 (%)"},
        gauge={
            'axis': {'range': [0, 100]},
            'steps': [
                {'range': [0, 50], 'color': "lightgray"},
                {'range': [50, 80], 'color': "gray"}],
            'threshold': {
                'line': {'color': "red", 'width': 4},
                'thickness': 0.75,
                'value': 90}}))
    
    # メモリ使用率ゲージ
    memory_pct = stats.get("memory_usage_percent", 0)
    memory_fig = go.Figure(go.Indicator(
        mode="gauge+number",
        value=memory_pct,
        domain={'x': [0, 1], 'y': [0, 1]},
        title={'text': "メモリ使用率 (%)"},
        gauge={
            'axis': {'range': [0, 100]},
            'steps': [
                {'range': [0, 60], 'color': "lightgray"},
                {'range': [60, 80], 'color': "gray"}],
            'threshold': {
                'line': {'color': "red", 'width': 4},
                'thickness': 0.75,
                'value': 90}}))
    
    # レスポンス時間グラフ
    response_fig = go.Figure()
    response_fig.add_trace(go.Bar(
        x=["キャッシュあり", "キャッシュなし"],
        y=[
            stats.get("avg_cached_time_ms", 0),
            stats.get("avg_uncached_time_ms", 0)
        ],
        marker_color=['green', 'red']
    ))
    response_fig.update_layout(
        title="平均レスポンス時間 (ms)",
        yaxis_title="ミリ秒"
    )
    
    return hit_rate_fig, memory_fig, response_fig

if __name__ == '__main__':
    app.run_server(debug=True)
```

### 大規模デプロイメント

分散システムでのキャッシュ管理のために、複数のAPIサーバーを同じRedisバックエンドに接続できます：

```
┌──────────────┐     ┌───────────────┐
│ アプリケーション │     │ ロードバランサー │
│    サーバー1   │ ==> │      │      │
└──────────────┘     └───────┬───────┘
                             │
                             ▼
┌──────────────┐     ┌───────────────┐
│ アプリケーション │ ==> │  キャッシュAPI  │ ==> ┌─────────┐
│    サーバー2   │     │   サーバー1    │     │  Redis  │
└──────────────┘     └───────────────┘     │  クラスター │
                                           │         │
┌──────────────┐     ┌───────────────┐     │         │
│ アプリケーション │ ==> │  キャッシュAPI  │ ==> │         │
│    サーバー3   │     │   サーバー2    │     └─────────┘
└──────────────┘     └───────────────┘
```

この構成を設定するには：

1. 複数のキャッシュAPIサーバーを起動し、同じRedisサーバーを指すように設定します
2. ロードバランサー（例：Nginx）を配置してAPIリクエストを分散させます
3. アプリケーションサーバーはキャッシュクライアントを使用してロードバランサーを介してAPIにアクセスします

これにより、キャッシュシステムのスケーラビリティと可用性が向上します。