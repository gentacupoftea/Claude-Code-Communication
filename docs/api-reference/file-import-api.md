# ファイルインポートAPI リファレンス

## 概要

ファイルインポートAPIは、CSV、Excel、およびその他のファイル形式からデータをインポートし、統一されたDWHスキーマにマッピングする機能を提供します。

## 認証

すべてのAPIエンドポイントには認証が必要です。

```http
Authorization: Bearer <your-jwt-token>
```

## エンドポイント

### 1. ファイルアップロード

ファイルをアップロードし、解析のために一時保存します。

**エンドポイント:** `POST /api/file-import/upload`

**リクエスト:**

```http
POST /api/file-import/upload
Content-Type: multipart/form-data
Authorization: Bearer <token>

------WebKitFormBoundary
Content-Disposition: form-data; name="file"; filename="products.csv"
Content-Type: text/csv

<file-content>
------WebKitFormBoundary
Content-Disposition: form-data; name="table_name"

products
------WebKitFormBoundary
Content-Disposition: form-data; name="encoding"

utf-8
------WebKitFormBoundary--
```

**パラメータ:**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| file | file | ✓ | アップロードするファイル |
| table_name | string | ✓ | インポート先のテーブル名 (products, orders, customers) |
| encoding | string | - | ファイルエンコーディング (デフォルト: utf-8) |

**レスポンス:**

```json
{
    "success": true,
    "file_id": "550e8400-e29b-41d4-a716-446655440000",
    "filename": "products.csv",
    "mime_type": "text/csv",
    "size": 1048576,
    "row_count": 1000,
    "columns": ["product_id", "name", "price", "stock_quantity"],
    "message": "File uploaded successfully"
}
```

**エラーレスポンス:**

```json
{
    "success": false,
    "error": "FILE_001",
    "message": "File size exceeds maximum allowed size of 100MB"
}
```

### 2. ファイルプレビュー

アップロードされたファイルの内容をプレビューします。

**エンドポイント:** `GET /api/file-import/preview/{file_id}`

**パラメータ:**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| file_id | string | ✓ | ファイルID (UUID) |
| rows | integer | - | プレビュー行数 (デフォルト: 10, 最大: 100) |

**レスポンス:**

```json
{
    "file_id": "550e8400-e29b-41d4-a716-446655440000",
    "filename": "products.csv",
    "total_rows": 1000,
    "preview_rows": 10,
    "columns": ["product_id", "name", "price", "stock_quantity"],
    "data_types": {
        "product_id": "string",
        "name": "string",
        "price": "decimal",
        "stock_quantity": "integer"
    },
    "preview_data": [
        {
            "product_id": "PROD001",
            "name": "テスト商品1",
            "price": "1000.00",
            "stock_quantity": "50"
        },
        {
            "product_id": "PROD002",
            "name": "テスト商品2",
            "price": "2500.50",
            "stock_quantity": "0"
        }
    ],
    "data_quality": {
        "score": 0.95,
        "issues": [
            {
                "row": 5,
                "column": "price",
                "issue": "missing_value"
            }
        ]
    }
}
```

### 3. データインポート

ファイルデータをDWHにインポートします。

**エンドポイント:** `POST /api/file-import/import/{file_id}`

**リクエストボディ:**

```json
{
    "table_name": "products",
    "source": "file",
    "mapping_config": {
        "column_mappings": {
            "product_id": "external_id",
            "name": "name",
            "price": "price",
            "stock_quantity": "stock_quantity"
        },
        "column_types": {
            "price": "decimal",
            "stock_quantity": "integer",
            "created_at": "datetime"
        },
        "default_values": {
            "status": "active",
            "currency": "JPY"
        }
    },
    "import_options": {
        "clean_data": true,
        "validate_data": true,
        "skip_errors": false,
        "batch_size": 1000,
        "update_existing": false
    }
}
```

**パラメータ詳細:**

| パラメータ | 説明 |
|-----------|------|
| table_name | インポート先テーブル (products/orders/customers) |
| source | データソース識別子 |
| column_mappings | ソースカラム→DWHカラムのマッピング |
| column_types | カラムのデータ型定義 |
| default_values | デフォルト値の設定 |
| clean_data | AIデータクリーニングを実行するか |
| validate_data | データ検証を実行するか |
| skip_errors | エラー行をスキップして続行するか |
| batch_size | バッチ処理のサイズ |
| update_existing | 既存レコードを更新するか |

**レスポンス:**

```json
{
    "success": true,
    "import_id": "660e8400-e29b-41d4-a716-446655440001",
    "status": "completed",
    "started_at": "2024-01-15T10:00:00Z",
    "completed_at": "2024-01-15T10:05:30Z",
    "duration_seconds": 330,
    "statistics": {
        "total_records": 1000,
        "processed_records": 1000,
        "imported_records": 950,
        "updated_records": 0,
        "failed_records": 50,
        "skipped_records": 0,
        "cleaning_applied": true,
        "quality_score": 0.95
    },
    "cleaning_report": {
        "total_changes": 150,
        "changes_by_type": {
            "null_values_filled": 30,
            "duplicates_removed": 5,
            "format_standardized": 80,
            "invalid_values_corrected": 35
        }
    },
    "errors": [
        {
            "row": 101,
            "field": "price",
            "value": "invalid",
            "error": "Cannot convert 'invalid' to decimal"
        },
        {
            "row": 205,
            "field": "stock_quantity",
            "value": "-10",
            "error": "Stock quantity cannot be negative"
        }
    ]
}
```

### 4. インポート状態確認

非同期インポートの進行状況を確認します。

**エンドポイント:** `GET /api/file-import/import/{import_id}/status`

**レスポンス:**

```json
{
    "import_id": "660e8400-e29b-41d4-a716-446655440001",
    "status": "processing",
    "progress": {
        "current": 450,
        "total": 1000,
        "percentage": 45
    },
    "estimated_time_remaining": 180,
    "current_batch": 5,
    "total_batches": 10
}
```

### 5. サポートファイル形式確認

サポートされているファイル形式とその制限を取得します。

**エンドポイント:** `GET /api/file-import/supported-formats`

**レスポンス:**

```json
{
    "formats": [
        {
            "format": "csv",
            "mime_types": ["text/csv", "application/csv"],
            "extensions": [".csv"],
            "max_size_mb": 100,
            "features": {
                "encoding_detection": true,
                "custom_delimiter": true,
                "header_row": true
            }
        },
        {
            "format": "excel",
            "mime_types": [
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "application/vnd.ms-excel"
            ],
            "extensions": [".xlsx", ".xls", ".xlsm"],
            "max_size_mb": 50,
            "features": {
                "multiple_sheets": true,
                "formula_evaluation": true,
                "date_detection": true
            }
        },
        {
            "format": "json",
            "mime_types": ["application/json"],
            "extensions": [".json"],
            "max_size_mb": 100,
            "features": {
                "nested_objects": true,
                "array_flattening": true
            }
        }
    ]
}
```

## エラーコード一覧

| コード | HTTPステータス | 説明 |
|--------|---------------|------|
| FILE_001 | 413 | ファイルサイズが制限を超過 |
| FILE_002 | 415 | サポートされていないファイル形式 |
| FILE_003 | 400 | 悪意のあるコンテンツが検出された |
| FILE_004 | 404 | ファイルが見つからない |
| FILE_005 | 422 | ファイルの解析に失敗 |
| MAP_001 | 400 | 必須フィールドがマッピングされていない |
| MAP_002 | 422 | データ型変換エラー |
| MAP_003 | 422 | スキーマ検証エラー |
| IMP_001 | 409 | インポートが既に実行中 |
| IMP_002 | 500 | インポート処理中の内部エラー |
| AUTH_001 | 401 | 認証が必要 |
| AUTH_002 | 403 | 権限が不足 |

## 使用例

### cURL

```bash
# ファイルアップロード
curl -X POST https://api.conea.com/api/file-import/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@products.csv" \
  -F "table_name=products" \
  -F "encoding=utf-8"

# データインポート
curl -X POST https://api.conea.com/api/file-import/import/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "table_name": "products",
    "mapping_config": {
      "column_mappings": {
        "product_id": "external_id",
        "name": "name"
      }
    },
    "import_options": {
      "clean_data": true
    }
  }'
```

### JavaScript (Fetch API)

```javascript
// ファイルアップロード
const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('table_name', 'products');
  
  const response = await fetch('/api/file-import/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  return response.json();
};

// データインポート
const importData = async (fileId, mappingConfig) => {
  const response = await fetch(`/api/file-import/import/${fileId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      table_name: 'products',
      mapping_config: mappingConfig,
      import_options: {
        clean_data: true,
        validate_data: true
      }
    })
  });
  
  return response.json();
};
```

### Python

```python
import requests

# ファイルアップロード
def upload_file(filepath, token):
    with open(filepath, 'rb') as f:
        files = {'file': f}
        data = {
            'table_name': 'products',
            'encoding': 'utf-8'
        }
        headers = {'Authorization': f'Bearer {token}'}
        
        response = requests.post(
            'https://api.conea.com/api/file-import/upload',
            files=files,
            data=data,
            headers=headers
        )
    
    return response.json()

# データインポート
def import_data(file_id, token):
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        'table_name': 'products',
        'mapping_config': {
            'column_mappings': {
                'product_id': 'external_id',
                'name': 'name',
                'price': 'price'
            },
            'column_types': {
                'price': 'decimal'
            }
        },
        'import_options': {
            'clean_data': True,
            'validate_data': True
        }
    }
    
    response = requests.post(
        f'https://api.conea.com/api/file-import/import/{file_id}',
        json=payload,
        headers=headers
    )
    
    return response.json()
```

## レート制限

| エンドポイント | 制限 |
|---------------|------|
| ファイルアップロード | 100リクエスト/時間 |
| データインポート | 50リクエスト/時間 |
| その他 | 1000リクエスト/時間 |

制限を超えた場合、`429 Too Many Requests`が返されます。