# エクスポート機能テストガイド

このドキュメントは、Shopify MCP Serverのエクスポート機能の包括的なテストスイートについて説明します。

## 概要

エクスポート機能は以下の形式をサポートしています：
- CSV
- JSON
- Excel (XLSX)
- PDF

## テストスイート

### 1. 単体テスト (`tests/analytics/test_export_functionality.py`)

各エクスポート形式の基本機能をテストします：

- **CSV エクスポート**: データの正確性、エンコーディング、ヘッダー
- **JSON エクスポート**: 構造の整合性、Unicode対応
- **Excel エクスポート**: ファイル形式、複数シート対応
- **PDF エクスポート**: レイアウト、日本語対応、チャート

#### 主要なテストケース：
- `test_csv_export`: CSV形式の基本テスト
- `test_json_export`: JSON形式の基本テスト
- `test_excel_export`: Excel形式の基本テスト
- `test_unicode_export`: 多言語データのエクスポート
- `test_large_dataset_export`: 大規模データセットの処理
- `test_empty_data_export`: 空データの処理
- `test_filtered_data_export`: フィルタリングデータのエクスポート

### 2. 統合テスト (`tests/integration/test_export_integration.py`)

システム全体の統合をテストします：

- **API 統合**: RESTful APIエンドポイントの動作
- **Rakuten 連携**: 楽天RMS APIとの統合
- **マルチプラットフォーム**: 複数のECプラットフォームデータの統合
- **認証・認可**: セキュリティとアクセス制御

#### 主要なテストケース：
- `test_export_shopify_orders`: Shopify注文データのエクスポート
- `test_export_rakuten_integration`: 楽天データの統合エクスポート
- `test_combined_platform_export`: 複数プラットフォームの統合
- `test_filtered_export`: フィルタリング付きエクスポート
- `test_large_dataset_streaming_export`: ストリーミングエクスポート
- `test_concurrent_export_requests`: 同時リクエスト処理

### 3. パフォーマンステスト (`tests/performance/test_export_performance.py`)

大規模データセットでのパフォーマンスを測定します：

- **処理速度**: 10k、100k、1Mレコードの処理時間
- **メモリ使用量**: メモリ効率の測定
- **並行処理**: 同時エクスポートのパフォーマンス
- **スケーラビリティ**: データ量増加に対する性能変化

#### 主要なテストケース：
- `test_csv_export_10k_records`: 10,000レコードのCSVエクスポート
- `test_large_dataset_100k_records`: 100,000レコードの全形式エクスポート
- `test_memory_usage_export`: メモリ使用量の監視
- `test_concurrent_exports_performance`: 並列処理のパフォーマンス
- `test_worst_case_scenario`: 最悪ケースシナリオ（深いネスト、長い文字列）

## テストの実行方法

### 1. 必要な依存関係のインストール

```bash
pip install -r test-requirements.txt
```

### 2. すべてのテストを実行

```bash
python run_export_tests.py
```

### 3. 個別のテストスイートを実行

```bash
# 単体テストのみ
pytest tests/analytics/test_export_functionality.py -v

# 統合テストのみ
pytest tests/integration/test_export_integration.py -v

# パフォーマンステストのみ
pytest tests/performance/test_export_performance.py -v
```

### 4. カバレッジレポート付きでテスト実行

```bash
pytest tests/analytics/test_export_functionality.py --cov=src/analytics --cov-report=html
```

## テスト結果

テスト実行後、以下の形式で結果が出力されます：

1. **コンソール出力**: リアルタイムのテスト進行状況
2. **JUnit XML**: `test_results/` ディレクトリ内
3. **HTMLレポート**: `test_results/export_test_report.html`
4. **カバレッジレポート**: `htmlcov/index.html`

## パフォーマンスベンチマーク

期待されるパフォーマンス基準：

| データ量 | CSV | JSON | Excel | PDF |
|---------|-----|------|-------|-----|
| 1,000レコード | < 0.1秒 | < 0.2秒 | < 0.5秒 | < 1秒 |
| 10,000レコード | < 1秒 | < 2秒 | < 5秒 | < 10秒 |
| 100,000レコード | < 10秒 | < 20秒 | < 60秒 | N/A |

## 国際化テスト

以下の言語でのエクスポートをテストしています：

- 日本語
- 英語
- フランス語
- 中国語
- アラビア語（RTL）
- ヘブライ語（RTL）

## トラブルシューティング

### メモリ不足エラー

大規模データセットのテスト時にメモリ不足が発生する場合：

```bash
# メモリ制限を増やす
export PYTEST_MEMORY_LIMIT=4GB
pytest tests/performance/test_export_performance.py::test_large_dataset_100k_records
```

### 文字エンコーディングエラー

Unicode文字の処理でエラーが発生する場合：

```bash
# UTF-8エンコーディングを強制
export PYTHONIOENCODING=utf-8
pytest tests/analytics/test_export_functionality.py::test_unicode_export
```

## 継続的インテグレーション

GitHub ActionsまたはGitLab CIで自動テストを実行する設定例：

```yaml
test-export:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v2
    - name: Set up Python
      uses: actions/setup-python@v2
      with:
        python-version: 3.9
    - name: Install dependencies
      run: |
        pip install -r requirements.txt
        pip install -r test-requirements.txt
    - name: Run export tests
      run: python run_export_tests.py
    - name: Upload test results
      uses: actions/upload-artifact@v2
      with:
        name: test-results
        path: test_results/
```

## 貢献ガイドライン

新しいエクスポート形式やテストケースを追加する場合：

1. 適切なテストスイートにテストケースを追加
2. ドキュメントを更新
3. パフォーマンスベンチマークを実行
4. プルリクエストを作成

## 連絡先

質問や問題がある場合は、プロジェクトのIssueトラッカーまで。