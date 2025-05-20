# 楽天API レート制限機能

楽天API用の適応型レート制限機能は、APIリクエストのスロットリングと自動バックオフ/リトライ機能を提供し、安定したAPIアクセスを実現します。

## 概要

v0.2.1から追加された楽天API用レート制限機能:

- APIリクエストの自動スロットリング
- 指数バックオフによるスマートなリトライ機能
- レート制限ヘッダーの追跡と適応
- 環境変数による設定
- 統計情報の追跡と表示

## 設定

環境変数を通じて設定が可能です:

```
# レート制限を有効にする（デフォルト: true）
RAKUTEN_RATE_LIMIT_ENABLED=true

# 1分あたりの最大リクエスト数（デフォルト: 30）
RAKUTEN_RATE_LIMIT_RPM=30

# 短時間での最大バースト数（デフォルト: 10）
RAKUTEN_RATE_LIMIT_BURST=10

# 最大リトライ回数（デフォルト: 3）
RAKUTEN_RATE_LIMIT_RETRIES=3

# 詳細ログを有効にする（デフォルト: true）
RAKUTEN_RATE_LIMIT_LOG=true

# レート制限テストを有効にする（テスト用、デフォルト: false）
ENABLE_RATE_LIMIT_TEST=false
```

## 動作の仕組み

1. **リクエストスロットリング**: 設定された上限（デフォルト: 30リクエスト/分）を超えないようにリクエストを制御
2. **バースト制御**: 短時間での集中リクエストを制限（デフォルト: 最大10リクエスト/秒）
3. **バックオフメカニズム**: レート制限に近づいた場合に指数関数的にバックオフを増加
4. **ヘッダー監視**: 楽天APIからのレスポンスヘッダー (`X-RateLimit-*`) を分析して制限を動的に調整
5. **自動リトライ**: レート制限エラー（429）を自動的に適切な遅延で再試行

## レート制限のモニタリング

`get_rate_limit_stats()` メソッドを使用して現在のレート制限状態を監視できます:

```python
# クライアントからレート制限統計を取得
stats = client.get_rate_limit_stats()

print(f"総リクエスト数: {stats['total_requests']}")
print(f"スロットルされたリクエスト: {stats['throttled_requests']}")
print(f"スロットル率: {stats['throttle_rate']*100:.1f}%")
print(f"現在のバックオフ時間: {stats['current_backoff']:.2f}秒")
print(f"連続スロットル数: {stats['consecutive_throttles']}")
print(f"平均再試行回数: {stats['average_retry_count']:.1f}")
print(f"直近の毎分リクエスト数: {stats['requests_per_minute']}")
print(f"設定された最大毎分リクエスト数: {stats['max_requests_per_minute']}")
```

## ヘッダーとレスポンスコード

システムは楽天APIレスポンスヘッダーを監視:

- `X-RateLimit-Limit`: 最大リクエスト数
- `X-RateLimit-Remaining`: 残りリクエスト数
- `X-RateLimit-Reset`: レート制限がリセットされるまでの時間（Unix時間）
- HTTP 429: レート制限を超えた場合の「Too Many Requests」エラー

429ステータスコードが発生した場合、システムは自動的に:
1. レート制限エラーをログに記録
2. バックオフ時間を増加
3. 適切な遅延後にリクエストを再試行（デフォルトで最大3回）

## ベストプラクティス

1. **使用状況の監視**: 開発中は定期的に `get_rate_limit_stats()` を確認
2. **制限の調整**: 継続的にレート制限に達する場合は `RAKUTEN_RATE_LIMIT_RPM` を減らす
3. **ログの有効化**: `RAKUTEN_RATE_LIMIT_LOG=true` に設定してレート制限イベントを追跡
4. **バッチリクエスト**: 複数の操作には可能な限りバッチリクエストを使用
5. **リクエストの分散**: 重要なリクエストは一定の間隔で分散させる

## トラブルシューティング

レート制限の問題が発生した場合:

1. **ログの確認**: 「Rate limit exceeded」や「楽天API Rate Limit Warning」メッセージを探す
2. **同時実行数の削減**: `RAKUTEN_RATE_LIMIT_RPM` の値を下げる（例: 30から20へ）
3. **バックオフの増加**: リトライロジックがある場合、十分な遅延を確保
4. **認証情報の確認**: 楽天API認証情報が適切な権限を持っているか確認
5. **楽天に連絡**: 継続的な問題がある場合、楽天に制限引き上げを依頼

## テクニカル詳細

レート制限は以下のファイルで実装:
- `src/api/rakuten/rate_limiter.py`: `RakutenRateLimiter` クラスを実装
- `src/api/rakuten/client.py`: 楽天APIクライアントとレート制限の統合

実装には以下の機能が含まれます:
- スレッドセーフなロック機構
- 直近のリクエスト履歴を追跡するためのdeque
- 連続スロットリングイベントと共に増加する適応バックオフ
- リクエスト/分、バースト毎秒の制限

## レート制限テスト

テスト環境で楽天APIのレート制限をテストするには:

```bash
# モックサーバーでレート制限テストを有効化
python tests/api/rakuten/mock_rakuten_server.py --enable-rate-limit-test

# テストの実行
ENABLE_RATE_LIMIT_TEST=true python tests/api/rakuten/run_rakuten_tests.py
```

これにより、レート制限機能のテストが有効になり、テスト中にレート制限エラーを適切に処理できることが確認できます。