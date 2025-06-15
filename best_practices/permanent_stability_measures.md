# 恒久的安定性対策

## 解決済み問題
- `/tmp/tmux_supervisor_state/*.hash` 権限問題（ワーカー4により修正確認）
- 長時間実行プロセスによるメモリ肥大化（391MB）

## 再発防止策

### 1. 権限管理自動化
```bash
# tmux_supervisor_state権限管理スクリプト
#!/bin/bash
# /etc/cron.hourly/fix_tmux_permissions.sh

TMUX_STATE_DIR="/tmp/tmux_supervisor_state"

# ディレクトリ存在確認と権限修正
if [ -d "$TMUX_STATE_DIR" ]; then
    chmod 755 "$TMUX_STATE_DIR"
    chmod 644 "$TMUX_STATE_DIR"/*.hash 2>/dev/null
    echo "$(date): tmux_supervisor_state permissions fixed" >> /var/log/permission_fixes.log
fi
```

### 2. 定期的クリーンアップ
```bash
# 古いハッシュファイルの自動削除
find /tmp/tmux_supervisor_state -name "*.hash" -mtime +7 -delete

# Supervisorログの定期クリーンアップ
find /var/log/supervisor -name "*.log" -size +100M -exec truncate -s 0 {} \;
```

### 3. 監視アラート設定
```yaml
# Prometheus アラートルール
groups:
  - name: supervisor_stability
    rules:
      - alert: SupervisorHighMemoryUsage
        expr: process_resident_memory_bytes{job="supervisor"} > 300000000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Supervisor process memory usage is high"
          
      - alert: TmuxPermissionError
        expr: file_permission_errors{path="/tmp/tmux_supervisor_state"} > 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "tmux_supervisor_state permission error detected"
```

### 4. ヘルスチェック最適化
```javascript
// ヘルスチェック設定の改善
const healthCheckConfig = {
  endpoints: {
    '/health': { timeout: 5000, retries: 3 },
    '/api/status': { timeout: 10000, retries: 2 },
    '/metrics': { timeout: 3000, retries: 1 }
  },
  circuitBreaker: {
    errorThreshold: 50,
    resetTimeout: 30000,
    requestVolumeThreshold: 10
  },
  autoRecovery: {
    enabled: true,
    maxRetries: 3,
    backoffMultiplier: 2
  }
};
```

### 5. 自動リカバリー機能
```bash
# システム自動回復スクリプト
#!/bin/bash
# /usr/local/bin/auto_recovery.sh

check_and_recover() {
    # Supervisor状態確認
    if ! supervisorctl status | grep -q "RUNNING"; then
        echo "$(date): Supervisor not running, attempting restart"
        systemctl restart supervisor
    fi
    
    # 権限問題自動修正
    if [ ! -w "/tmp/tmux_supervisor_state" ]; then
        echo "$(date): Permission issue detected, fixing..."
        chmod 755 /tmp/tmux_supervisor_state
        chown supervisor:supervisor /tmp/tmux_supervisor_state
    fi
}

# 5分ごとに実行
while true; do
    check_and_recover
    sleep 300
done
```

## 実装スケジュール
1. **即時実装（24時間以内）**
   - 権限管理自動化スクリプト
   - 定期的クリーンアップ設定

2. **短期実装（72時間以内）**
   - Prometheus監視アラート
   - ヘルスチェック最適化

3. **中期実装（1週間以内）**
   - 自動リカバリー機能
   - 完全統合テスト

## 期待効果
- 権限問題の完全予防
- メモリ使用量の安定化
- 問題の早期検知と自動復旧
- システム稼働率99.9%以上の維持

---
作成者: PM ヘパイストス（安定化担当）
日時: 2025年6月14日
状態: 問題解決確認後の恒久対策立案