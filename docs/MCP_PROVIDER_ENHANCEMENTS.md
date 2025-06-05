# MCP Provider拡張機能 技術ドキュメント

## 概要

このドキュメントでは、Conea統合プラットフォームのMCP (Model Context Protocol) Provider拡張機能について説明します。この拡張により、複数のECプラットフォームからのデータを統一されたDWH (Data Warehouse) スキーマにマッピングし、AIによるデータクリーニングを実行できます。

## アーキテクチャ

### コンポーネント構成

```
src/
├── file_import/              # ファイルインポート機能
│   ├── csv_parser.py        # CSV解析
│   ├── excel_parser.py      # Excel解析
│   ├── validators.py        # ファイル検証
│   └── file_upload.py       # ファイルアップロードハンドラー
│
├── google_sheets/           # Google Sheets連携
│   └── client.py           # Google Sheets APIクライアント
│
├── data_processing/         # データ処理
│   └── ai_cleaner.py       # AIベースのデータクリーニング
│
└── data_integration/       # データ統合
    └── mapping/           # DWHスキーママッピング
        ├── schema_registry.py    # スキーマ定義・管理
        ├── base_mapper.py        # ベースマッパークラス
        ├── mapper_factory.py     # マッパーファクトリー
        ├── mappers/             # 各データソース用マッパー
        │   ├── shopify_mapper.py
        │   ├── amazon_mapper.py
        │   ├── rakuten_mapper.py
        │   ├── nextengine_mapper.py
        │   ├── file_mapper.py
        │   └── googlesheets_mapper.py
        └── utils/              # ユーティリティ
            ├── data_validator.py
            ├── type_converter.py
            ├── field_mapper.py
            └── schema_validator.py
```

## 主要機能

### 1. ファイルインポート機能

#### CSVパーサー
- 複数のエンコーディング対応（UTF-8, Shift-JIS, EUC-JP）
- 大容量ファイルのストリーミング処理
- カスタム区切り文字・引用符対応

```python
from src.file_import.csv_parser import CSVParser

parser = CSVParser()
result = await parser.parse(file_content, encoding='utf-8')
```

#### Excelパーサー
- .xlsx, .xls, .xlsm形式対応
- 複数シートの処理
- 数式・フォーマットの処理

```python
from src.file_import.excel_parser import ExcelParser

parser = ExcelParser()
result = await parser.parse(file_content)
```

#### ファイル検証
- MIMEタイプ検証
- ファイルシグネチャチェック
- 悪意のあるコンテンツ検出
- ファイルサイズ制限（デフォルト: 100MB）

### 2. Google Sheets連携

```python
from src.google_sheets.client import GoogleSheetsClient

client = GoogleSheetsClient(credentials_path="path/to/credentials.json")
data = await client.get_sheet_data(
    spreadsheet_id="your_spreadsheet_id",
    range_spec="Sheet1!A1:Z1000"
)
```

### 3. AIデータクリーニング

12種類のクリーニングルール：
1. 空値・Null値の処理
2. 重複データの除去
3. データ型の一貫性確保
4. 異常値・外れ値の検出
5. 日付フォーマットの正規化
6. 数値フォーマットの統一
7. 文字列の正規化（全角/半角、空白文字）
8. カテゴリ値の標準化
9. 通貨・単位の統一
10. 欠損値の補完
11. データ整合性チェック
12. ビジネスルール違反の検出

```python
from src.data_processing.ai_cleaner import AIDataCleaner

cleaner = AIDataCleaner()
cleaned_data, report = await cleaner.clean_data(raw_data)
print(f"品質スコア: {report.quality_score}")
print(f"クリーニング済みレコード: {report.cleaned_records}/{report.total_records}")
```

### 4. DWHスキーママッピング

#### 統一スキーマ

**商品テーブル (products)**
```sql
CREATE TABLE products (
    id UUID PRIMARY KEY,
    external_id VARCHAR(255) NOT NULL,
    source VARCHAR(50) NOT NULL,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    sku VARCHAR(255),
    barcode VARCHAR(255),
    price DECIMAL(10, 2),
    cost DECIMAL(10, 2),
    currency VARCHAR(3) DEFAULT 'JPY',
    stock_quantity INTEGER DEFAULT 0,
    status VARCHAR(50),
    category VARCHAR(255),
    brand VARCHAR(255),
    weight DECIMAL(10, 3),
    images JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    synchronized_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**注文テーブル (orders)**
```sql
CREATE TABLE orders (
    id UUID PRIMARY KEY,
    external_id VARCHAR(255) NOT NULL,
    source VARCHAR(50) NOT NULL,
    order_number VARCHAR(255) NOT NULL,
    status VARCHAR(50),
    customer_id VARCHAR(255),
    customer_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    total_amount DECIMAL(12, 2),
    subtotal_amount DECIMAL(12, 2),
    tax_amount DECIMAL(10, 2),
    shipping_amount DECIMAL(10, 2),
    discount_amount DECIMAL(10, 2),
    currency VARCHAR(3) DEFAULT 'JPY',
    payment_method VARCHAR(100),
    shipping_method VARCHAR(100),
    shipping_address JSONB,
    billing_address JSONB,
    line_items JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    synchronized_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**顧客テーブル (customers)**
```sql
CREATE TABLE customers (
    id UUID PRIMARY KEY,
    external_id VARCHAR(255) NOT NULL,
    source VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    name VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    phone VARCHAR(50),
    total_spent DECIMAL(12, 2) DEFAULT 0,
    orders_count INTEGER DEFAULT 0,
    tags TEXT[],
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    synchronized_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### データソース別マッパー

各マッパーは以下の処理を実行：
1. フィールドマッピング（ソース→DWH）
2. データ型変換
3. 値の正規化
4. バリデーション
5. エラーハンドリング

**使用例：**
```python
from src.data_integration.mapping.mapper_factory import MapperFactory, DataSource

# ファクトリーからマッパーを作成
factory = MapperFactory(schema_registry)
mapper = factory.create_mapper(DataSource.SHOPIFY)

# データマッピング実行
result = await mapper.map_data(shopify_products, 'products')

if result.success:
    print(f"マッピング成功: {len(result.mapped_data)}件")
else:
    print(f"エラー: {result.error_count}件")
    for error in result.errors:
        print(f"  - {error}")
```

## API仕様

### ファイルアップロードAPI

**エンドポイント:** `POST /api/file-import/upload`

**リクエスト:**
```http
POST /api/file-import/upload
Content-Type: multipart/form-data

file: (binary)
table_name: products
encoding: utf-8 (optional)
```

**レスポンス:**
```json
{
    "success": true,
    "file_id": "550e8400-e29b-41d4-a716-446655440000",
    "filename": "products.csv",
    "mime_type": "text/csv",
    "size": 1048576,
    "row_count": 1000,
    "columns": ["product_id", "name", "price", "stock_quantity"]
}
```

### データプレビューAPI

**エンドポイント:** `GET /api/file-import/preview/{file_id}`

**レスポンス:**
```json
{
    "file_id": "550e8400-e29b-41d4-a716-446655440000",
    "preview_data": [
        {
            "product_id": "PROD001",
            "name": "テスト商品1",
            "price": "1000",
            "stock_quantity": "50"
        }
    ],
    "total_rows": 1000,
    "columns": ["product_id", "name", "price", "stock_quantity"],
    "data_types": {
        "product_id": "string",
        "name": "string",
        "price": "decimal",
        "stock_quantity": "integer"
    }
}
```

### データインポートAPI

**エンドポイント:** `POST /api/file-import/import/{file_id}`

**リクエスト:**
```json
{
    "table_name": "products",
    "mapping_config": {
        "column_mappings": {
            "product_id": "external_id",
            "name": "name"
        },
        "column_types": {
            "price": "decimal",
            "stock_quantity": "integer"
        }
    },
    "clean_data": true
}
```

**レスポンス:**
```json
{
    "success": true,
    "import_id": "660e8400-e29b-41d4-a716-446655440001",
    "status": "completed",
    "statistics": {
        "total_records": 1000,
        "imported_records": 950,
        "failed_records": 50,
        "cleaning_applied": true,
        "quality_score": 0.95
    },
    "errors": [
        {
            "row": 101,
            "field": "price",
            "error": "Invalid decimal format"
        }
    ]
}
```

## エラーハンドリング

### エラーコード

| コード | 説明 | 対処法 |
|--------|------|--------|
| FILE_001 | ファイルサイズ超過 | ファイルを分割するか、バッチ処理を使用 |
| FILE_002 | 無効なファイル形式 | サポートされているファイル形式を確認 |
| FILE_003 | 悪意のあるコンテンツ検出 | ファイル内容を確認し、安全なファイルを使用 |
| MAP_001 | 必須フィールド不足 | マッピング設定で必須フィールドを指定 |
| MAP_002 | 型変換エラー | データ型を確認し、適切な変換ルールを設定 |
| MAP_003 | スキーマ検証エラー | DWHスキーマ定義を確認 |
| CLEAN_001 | データ品質が基準以下 | データソースの品質を改善 |

### リトライ戦略

```python
from src.api.retry_utils import retry_with_backoff

@retry_with_backoff(max_retries=3, backoff_factor=2)
async def import_data_with_retry(data, table_name):
    return await mapper.map_data(data, table_name)
```

## パフォーマンス最適化

### バッチ処理
大規模データセットの処理時は、バッチ処理を推奨：

```python
async def process_large_dataset(data, batch_size=1000):
    results = []
    for i in range(0, len(data), batch_size):
        batch = data[i:i + batch_size]
        result = await mapper.map_data(batch, 'products')
        results.append(result)
    return results
```

### 並行処理
複数ファイルの同時処理：

```python
import asyncio

async def process_multiple_files(files):
    tasks = [process_file(file) for file in files]
    return await asyncio.gather(*tasks)
```

### メモリ効率
ストリーミング処理によるメモリ使用量の最適化：

```python
async def stream_process_csv(file_path):
    async with aiofiles.open(file_path, 'r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        batch = []
        async for row in reader:
            batch.append(row)
            if len(batch) >= 1000:
                await process_batch(batch)
                batch = []
        if batch:
            await process_batch(batch)
```

## セキュリティ考慮事項

1. **ファイルアップロード**
   - ファイルサイズ制限（100MB）
   - MIMEタイプ検証
   - ファイルシグネチャチェック
   - 実行可能ファイルのブロック

2. **データ処理**
   - SQLインジェクション対策
   - XSS対策（HTMLエスケープ）
   - センシティブデータのマスキング

3. **API認証**
   - JWTトークンベース認証
   - APIキー管理
   - レート制限

## トラブルシューティング

### よくある問題

**Q: ファイルアップロードが失敗する**
A: ファイルサイズ、形式、エンコーディングを確認してください。

**Q: マッピングでエラーが発生する**
A: カラム名、データ型、必須フィールドの設定を確認してください。

**Q: パフォーマンスが遅い**
A: バッチサイズの調整、並行処理の活用を検討してください。

## 今後の拡張予定

1. **追加データソース対応**
   - Yahoo!ショッピング
   - メルカリShops
   - BASE

2. **高度なマッピング機能**
   - 条件付きマッピング
   - 複数フィールドの結合
   - カスタム変換関数

3. **機械学習統合**
   - 自動マッピング提案
   - 異常検知の高度化
   - データ品質予測