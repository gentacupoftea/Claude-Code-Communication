# Conea Integration Platform - トラブルシューティングガイド

## 目次

1. [一般的な問題と解決方法](#一般的な問題と解決方法)
2. [API関連の問題](#api関連の問題)
3. [認証・認可の問題](#認証認可の問題)
4. [データベースの問題](#データベースの問題)
5. [パフォーマンスの問題](#パフォーマンスの問題)
6. [統合サービスの問題](#統合サービスの問題)
7. [デプロイメントの問題](#デプロイメントの問題)
8. [診断ツール](#診断ツール)
9. [エスカレーション手順](#エスカレーション手順)

## 一般的な問題と解決方法

### サービスが起動しない

#### 症状
- APIエンドポイントにアクセスできない
- ヘルスチェックが失敗する
- Podが`CrashLoopBackOff`状態

#### 診断手順

```bash
# 1. Pod状態の確認
kubectl get pods -n production -l app=conea-api
kubectl describe pod <pod-name> -n production

# 2. ログの確認
kubectl logs <pod-name> -n production --previous
kubectl logs <pod-name> -n production -f

# 3. イベントの確認
kubectl get events -n production --sort-by='.lastTimestamp' | grep -i error

# 4. 設定の確認
kubectl get configmap conea-config -n production -o yaml
kubectl get secret conea-secrets -n production -o yaml
```

#### 解決方法

1. **環境変数の欠落**
```bash
# 必須環境変数の確認
kubectl set env deployment/conea-api -n production --list

# 環境変数の設定
kubectl set env deployment/conea-api -n production \
  DATABASE_URL="postgresql://user:pass@host/db" \
  REDIS_URL="redis://redis:6379"
```

2. **リソース不足**
```yaml
# リソース制限の調整
spec:
  containers:
  - name: api
    resources:
      requests:
        memory: "512Mi"
        cpu: "500m"
      limits:
        memory: "2Gi"
        cpu: "2000m"
```

3. **依存サービスの確認**
```bash
# データベース接続テスト
kubectl run -it --rm debug --image=postgres:14 --restart=Never -- \
  psql -h postgres-service -U postgres -c "SELECT 1"

# Redis接続テスト
kubectl run -it --rm debug --image=redis:6 --restart=Never -- \
  redis-cli -h redis-service ping
```

### メモリリーク

#### 症状
- メモリ使用量が継続的に増加
- OOMKillerによるPod再起動
- レスポンスタイムの悪化

#### 診断手順

```bash
# メモリ使用状況の監視
kubectl top pods -n production --sort-by=memory

# ヒープダンプの取得（Node.js）
kubectl exec -it <pod-name> -n production -- \
  kill -USR2 1  # ヒープダンプ生成

# メモリプロファイルの分析
kubectl cp <pod-name>:/app/heapdump.123456.heapsnapshot ./heapdump.heapsnapshot -n production
```

#### 解決方法

```javascript
// メモリリークの一般的な原因と対策

// 1. イベントリスナーの解放忘れ
// 悪い例
emitter.on('data', handler);

// 良い例
emitter.on('data', handler);
// クリーンアップ時
emitter.removeListener('data', handler);

// 2. クロージャによる参照保持
// 悪い例
function createLeak() {
  const hugeData = new Array(1000000).fill('x');
  return function() {
    console.log(hugeData.length);
  };
}

// 良い例
function noLeak() {
  let hugeData = new Array(1000000).fill('x');
  const length = hugeData.length;
  hugeData = null; // 明示的に解放
  return function() {
    console.log(length);
  };
}

// 3. キャッシュの無制限成長
// 悪い例
const cache = {};
function addToCache(key, value) {
  cache[key] = value;
}

// 良い例
const LRU = require('lru-cache');
const cache = new LRU({
  max: 1000,
  ttl: 1000 * 60 * 5 // 5分
});
```

## API関連の問題

### 429 Too Many Requests

#### 症状
- APIが`429`ステータスコードを返す
- `X-RateLimit-Remaining`ヘッダーが0

#### 診断手順

```bash
# レート制限の確認
curl -I https://api.conea.io/v1/ai/models \
  -H "Authorization: Bearer $TOKEN"

# レート制限情報の取得
curl https://api.conea.io/v1/rate-limit \
  -H "Authorization: Bearer $TOKEN"
```

#### 解決方法

1. **リトライ with バックオフ**
```javascript
async function apiCallWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || 60;
        console.log(`Rate limited. Waiting ${retryAfter}s...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
      
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
}
```

2. **レート制限の調整**
```bash
# 管理者向け：レート制限の一時的な増加
kubectl set env deployment/conea-api -n production \
  RATE_LIMIT_PER_MINUTE=200
```

### タイムアウトエラー

#### 症状
- リクエストが504 Gateway Timeoutを返す
- 長時間実行されるリクエストが中断される

#### 診断手順

```bash
# スロークエリの確認
kubectl exec -it <api-pod> -n production -- \
  tail -f /var/log/app/slow-queries.log

# データベースのスロークエリ
psql -h db.conea.io -U postgres -c "
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 1000
ORDER BY mean_exec_time DESC
LIMIT 10;"
```

#### 解決方法

1. **タイムアウト設定の調整**
```yaml
# Ingress設定
metadata:
  annotations:
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "600"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "600"
```

2. **非同期処理への移行**
```javascript
// 長時間処理をジョブキューに移行
app.post('/api/v1/data/process', async (req, res) => {
  // 即座にジョブIDを返す
  const jobId = await jobQueue.add('process-data', req.body);
  
  res.status(202).json({
    jobId,
    status: 'pending',
    checkUrl: `/api/v1/jobs/${jobId}`
  });
});
```

## 認証・認可の問題

### JWTトークンが無効

#### 症状
- 401 Unauthorizedエラー
- "Invalid token"メッセージ

#### 診断手順

```bash
# JWTトークンのデコード
echo $TOKEN | cut -d. -f2 | base64 -d | jq

# トークンの検証
curl https://api.conea.io/v1/auth/verify \
  -H "Authorization: Bearer $TOKEN"
```

#### 解決方法

1. **トークンの有効期限確認**
```javascript
const jwt = require('jsonwebtoken');

function debugToken(token) {
  try {
    const decoded = jwt.decode(token, { complete: true });
    console.log('Header:', decoded.header);
    console.log('Payload:', decoded.payload);
    console.log('Expires:', new Date(decoded.payload.exp * 1000));
    console.log('Issued:', new Date(decoded.payload.iat * 1000));
  } catch (error) {
    console.error('Invalid token format:', error.message);
  }
}
```

2. **時刻同期の確認**
```bash
# サーバー時刻の確認
kubectl exec -it <pod-name> -n production -- date
date

# NTP同期の確認
timedatectl status
```

### 権限不足エラー

#### 症状
- 403 Forbiddenエラー
- "Insufficient permissions"メッセージ

#### 診断手順

```sql
-- ユーザーの権限確認
SELECT u.email, u.role, om.role as org_role, o.name as org_name
FROM users u
LEFT JOIN organization_members om ON u.id = om.user_id
LEFT JOIN organizations o ON om.organization_id = o.id
WHERE u.email = 'user@example.com';

-- APIキーの権限確認
SELECT ak.*, array_agg(ap.permission) as permissions
FROM api_keys ak
LEFT JOIN api_key_permissions ap ON ak.id = ap.api_key_id
WHERE ak.key_hash = crypt('api-key', ak.key_hash)
GROUP BY ak.id;
```

#### 解決方法

```bash
# ユーザーロールの更新
psql -h db.conea.io -U postgres -d conea_production -c "
UPDATE organization_members 
SET role = 'admin' 
WHERE user_id = (SELECT id FROM users WHERE email = 'user@example.com')
AND organization_id = 'org-id';"

# 権限の付与
kubectl exec -it <api-pod> -n production -- \
  node scripts/grant-permission.js --user user@example.com --permission data:write
```

## データベースの問題

### 接続プールの枯渇

#### 症状
- "too many connections"エラー
- データベース接続タイムアウト

#### 診断手順

```sql
-- 現在の接続数
SELECT count(*) FROM pg_stat_activity;

-- アプリケーション別接続数
SELECT application_name, count(*) 
FROM pg_stat_activity 
GROUP BY application_name 
ORDER BY count DESC;

-- アイドル接続
SELECT pid, usename, application_name, state, state_change 
FROM pg_stat_activity 
WHERE state = 'idle' 
AND state_change < NOW() - INTERVAL '10 minutes';
```

#### 解決方法

1. **接続プールの設定最適化**
```javascript
// Node.js pg-pool設定
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // 最大接続数
  idleTimeoutMillis: 30000, // アイドルタイムアウト
  connectionTimeoutMillis: 2000, // 接続タイムアウト
});

// 接続の適切な解放
async function queryWithRelease(query, params) {
  const client = await pool.connect();
  try {
    return await client.query(query, params);
  } finally {
    client.release();
  }
}
```

2. **アイドル接続の強制切断**
```sql
-- 10分以上アイドルな接続を切断
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
AND state_change < NOW() - INTERVAL '10 minutes';
```

### レプリケーション遅延

#### 症状
- 読み取りレプリカでデータが古い
- レプリケーションラグアラート

#### 診断手順

```sql
-- プライマリ側
SELECT client_addr, state, sent_lsn, write_lsn, flush_lsn, replay_lsn
FROM pg_stat_replication;

-- レプリカ側
SELECT now() - pg_last_xact_replay_timestamp() AS replication_lag;

-- WALの状態確認
SELECT * FROM pg_stat_wal_receiver;
```

#### 解決方法

```bash
# レプリケーションスロットの確認
psql -h db.conea.io -U postgres -c "SELECT * FROM pg_replication_slots;"

# スロットの再作成
psql -h db.conea.io -U postgres -c "
SELECT pg_drop_replication_slot('replica_slot');
SELECT pg_create_physical_replication_slot('replica_slot');"

# レプリカの再同期（最終手段）
pg_basebackup -h primary-host -D /var/lib/postgresql/data -U replicator -v -P -W
```

## パフォーマンスの問題

### 高CPU使用率

#### 症状
- CPU使用率が80%以上
- レスポンスタイムの増加

#### 診断手順

```bash
# プロセス別CPU使用率
kubectl exec -it <pod-name> -n production -- top -b -n 1

# Node.jsプロファイリング
kubectl exec -it <pod-name> -n production -- \
  node --prof app.js

# プロファイル結果の分析
kubectl cp <pod-name>:/app/isolate-*.log ./profile.log -n production
node --prof-process profile.log > profile.txt
```

#### 解決方法

1. **CPU集約的な処理の最適化**
```javascript
// 悪い例：同期的な重い処理
function processLargeData(data) {
  return data.map(item => heavyComputation(item));
}

// 良い例：バッチ処理とWorker Threads
const { Worker } = require('worker_threads');

async function processLargeDataOptimized(data) {
  const batchSize = 1000;
  const results = [];
  
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const worker = new Worker('./heavy-computation.js', {
      workerData: { batch }
    });
    
    const result = await new Promise((resolve, reject) => {
      worker.on('message', resolve);
      worker.on('error', reject);
    });
    
    results.push(...result);
  }
  
  return results;
}
```

### メモリ不足

#### 症状
- OOMKillerによるプロセス終了
- スワップ使用率の増加

#### 診断手順

```bash
# メモリ使用状況の詳細
kubectl exec -it <pod-name> -n production -- cat /proc/meminfo

# Node.jsヒープ統計
kubectl exec -it <pod-name> -n production -- node -e "
const v8 = require('v8');
console.log(v8.getHeapStatistics());
"

# メモリマップ
kubectl exec -it <pod-name> -n production -- pmap -x 1
```

#### 解決方法

```javascript
// メモリ効率的なストリーム処理
const { pipeline } = require('stream');
const { createReadStream, createWriteStream } = require('fs');
const { Transform } = require('stream');

// 大きなファイルの処理
pipeline(
  createReadStream('large-file.json'),
  new Transform({
    transform(chunk, encoding, callback) {
      // チャンクごとに処理
      const processed = processChunk(chunk);
      callback(null, processed);
    }
  }),
  createWriteStream('output.json'),
  (err) => {
    if (err) console.error('Pipeline failed:', err);
    else console.log('Pipeline succeeded');
  }
);
```

## 統合サービスの問題

### Shopify API エラー

#### 症状
- Shopify APIからのエラーレスポンス
- Webhook受信の失敗

#### 診断手順

```bash
# Shopify API状態の確認
curl -I https://status.shopify.com/api/v2/status.json

# Webhook署名の検証
echo -n "$webhook_body" | openssl dgst -sha256 -hmac "$webhook_secret" -binary | base64
```

#### 解決方法

```javascript
// Shopifyレート制限の処理
class ShopifyClient {
  async makeRequest(endpoint, options = {}) {
    const response = await fetch(`https://${shop}.myshopify.com${endpoint}`, {
      ...options,
      headers: {
        'X-Shopify-Access-Token': this.accessToken,
        ...options.headers
      }
    });
    
    // レート制限の確認
    const rateLimitHeader = response.headers.get('X-Shopify-Shop-Api-Call-Limit');
    if (rateLimitHeader) {
      const [used, limit] = rateLimitHeader.split('/').map(Number);
      if (used / limit > 0.8) {
        // 80%に達したら待機
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    if (!response.ok) {
      throw new ShopifyAPIError(response.status, await response.text());
    }
    
    return response.json();
  }
}
```

### AIモデルAPIエラー

#### 症状
- OpenAI/Claude APIのエラー
- トークン制限超過

#### 診断手順

```bash
# API状態確認
curl https://status.openai.com/api/v2/status.json
curl https://status.anthropic.com/api/v2/status.json

# 使用量確認
curl https://api.openai.com/v1/usage \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

#### 解決方法

```javascript
// フォールバック戦略
class AIService {
  constructor() {
    this.providers = [
      { name: 'openai', client: new OpenAIClient() },
      { name: 'anthropic', client: new AnthropicClient() },
      { name: 'cohere', client: new CohereClient() }
    ];
  }
  
  async complete(prompt, options = {}) {
    const errors = [];
    
    for (const provider of this.providers) {
      try {
        return await provider.client.complete(prompt, options);
      } catch (error) {
        errors.push({ provider: provider.name, error });
        console.error(`${provider.name} failed:`, error.message);
        
        // 次のプロバイダーを試す
        continue;
      }
    }
    
    // すべて失敗した場合
    throw new Error(`All AI providers failed: ${JSON.stringify(errors)}`);
  }
}
```

## デプロイメントの問題

### デプロイメント失敗

#### 症状
- Helmアップグレードの失敗
- Podが起動しない

#### 診断手順

```bash
# Helmリリース状態
helm list -n production
helm status conea -n production

# リリース履歴
helm history conea -n production

# 失敗の詳細
helm get values conea -n production
helm get manifest conea -n production | kubectl apply --dry-run=client -f -
```

#### 解決方法

```bash
# ロールバック
helm rollback conea 3 -n production

# 強制アップグレード
helm upgrade conea ./chart \
  --namespace production \
  --force \
  --recreate-pods

# リソースの手動削除と再作成
kubectl delete deployment,service,configmap -l app=conea -n production
helm install conea ./chart --namespace production
```

### イメージプルエラー

#### 症状
- `ImagePullBackOff`状態
- "unauthorized"エラー

#### 診断手順

```bash
# イメージプルシークレットの確認
kubectl get secret -n production
kubectl get secret docker-registry -n production -o yaml

# Podのイベント確認
kubectl describe pod <pod-name> -n production | grep -A 10 Events
```

#### 解決方法

```bash
# Dockerレジストリシークレットの作成
kubectl create secret docker-registry regcred \
  --docker-server=docker.io \
  --docker-username=your-username \
  --docker-password=your-password \
  --docker-email=your-email \
  -n production

# Podへの適用
kubectl patch serviceaccount default -n production \
  -p '{"imagePullSecrets": [{"name": "regcred"}]}'
```

## 診断ツール

### 包括的診断スクリプト

```bash
#!/bin/bash
# diagnose.sh - Conea診断スクリプト

echo "=== Conea Platform Diagnostics ==="
echo "Timestamp: $(date)"
echo

echo "1. Kubernetes Cluster Status"
kubectl cluster-info
kubectl get nodes
echo

echo "2. Application Status"
kubectl get deployments,services,pods -n production -l app=conea
echo

echo "3. Recent Events"
kubectl get events -n production --sort-by='.lastTimestamp' | head -20
echo

echo "4. Resource Usage"
kubectl top nodes
kubectl top pods -n production
echo

echo "5. Database Connectivity"
kubectl run -it --rm dbtest --image=postgres:14 --restart=Never -- \
  psql -h postgres-service -U postgres -c "SELECT version();"
echo

echo "6. API Health Check"
curl -s https://api.conea.io/health | jq
echo

echo "7. Recent Logs (Errors)"
kubectl logs -n production -l app=conea --tail=50 | grep -i error
echo

echo "=== End of Diagnostics ==="
```

### パフォーマンス分析ツール

```python
# performance_analyzer.py
import requests
import time
import statistics
from concurrent.futures import ThreadPoolExecutor

class PerformanceAnalyzer:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.headers = {'Authorization': f'Bearer {token}'}
    
    def analyze_endpoint(self, endpoint, method='GET', iterations=100):
        """エンドポイントのパフォーマンス分析"""
        response_times = []
        errors = 0
        
        for _ in range(iterations):
            start = time.time()
            try:
                response = requests.request(
                    method, 
                    f"{self.base_url}{endpoint}",
                    headers=self.headers
                )
                response_times.append(time.time() - start)
                if response.status_code >= 400:
                    errors += 1
            except Exception:
                errors += 1
        
        return {
            'endpoint': endpoint,
            'iterations': iterations,
            'avg_response_time': statistics.mean(response_times),
            'p95_response_time': statistics.quantiles(response_times, n=20)[18],
            'p99_response_time': statistics.quantiles(response_times, n=100)[98],
            'error_rate': errors / iterations * 100
        }
    
    def load_test(self, endpoint, concurrent_users=10, duration=60):
        """負荷テスト"""
        results = []
        start_time = time.time()
        
        with ThreadPoolExecutor(max_workers=concurrent_users) as executor:
            while time.time() - start_time < duration:
                futures = []
                for _ in range(concurrent_users):
                    future = executor.submit(self._single_request, endpoint)
                    futures.append(future)
                
                for future in futures:
                    results.append(future.result())
        
        return {
            'total_requests': len(results),
            'successful_requests': sum(1 for r in results if r['success']),
            'rps': len(results) / duration,
            'avg_response_time': statistics.mean(r['duration'] for r in results)
        }
    
    def _single_request(self, endpoint):
        start = time.time()
        try:
            response = requests.get(
                f"{self.base_url}{endpoint}",
                headers=self.headers
            )
            return {
                'success': response.status_code < 400,
                'duration': time.time() - start,
                'status_code': response.status_code
            }
        except Exception as e:
            return {
                'success': False,
                'duration': time.time() - start,
                'error': str(e)
            }

# 使用例
analyzer = PerformanceAnalyzer('https://api.conea.io', 'your-token')
result = analyzer.analyze_endpoint('/v1/health')
print(f"Performance Analysis: {result}")
```

## エスカレーション手順

### エスカレーションマトリックス

| 深刻度 | 定義 | 初期対応者 | エスカレーション時間 | 通知方法 |
|--------|------|-----------|---------------------|----------|
| Critical | サービス全体停止 | On-call SRE | 即時 | PagerDuty + Slack |
| High | 主要機能の障害 | Platform Team | 30分 | Slack + Email |
| Medium | 一部機能の不具合 | Dev Team | 2時間 | Slack |
| Low | UXの問題 | Support Team | 営業時間内 | Jira |

### エスカレーションフロー

```mermaid
graph TD
    A[問題検知] --> B{深刻度判定}
    B -->|Critical| C[On-call SRE呼び出し]
    B -->|High| D[Platform Team通知]
    B -->|Medium/Low| E[通常対応]
    
    C --> F[15分以内に解決?]
    F -->|No| G[インシデントコマンダー召集]
    F -->|Yes| H[事後分析]
    
    G --> I[ウォールーム開設]
    I --> J[ステークホルダー通知]
    J --> K[復旧作業]
    K --> L[復旧確認]
    L --> H
```

### 連絡先リスト

```yaml
contacts:
  on_call_sre:
    primary: "+1-555-0100"
    secondary: "+1-555-0101"
    slack: "@oncall-sre"
    
  incident_commander:
    name: "John Doe"
    phone: "+1-555-0200"
    email: "john.doe@conea.io"
    
  escalation_chain:
    - role: "SRE Lead"
      contact: "+1-555-0300"
    - role: "Engineering Director"
      contact: "+1-555-0400"
    - role: "CTO"
      contact: "+1-555-0500"
```

---

最終更新日: 2025年5月26日