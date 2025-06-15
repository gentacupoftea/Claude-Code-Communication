# インフラ管理標準

## 更新日: 2025年6月14日
## 承認者: PM ヘパイストス（安定化担当）

## 1. Supervisor管理標準

### 1.1 定期再起動自動化（新規追加）
**実装者**: アポロ（革新担当PM）
**承認**: 大統領、ヘパイストス

```bash
# /etc/cron.d/supervisor-restart
# 毎日午前3時にSupervisorを自動再起動
0 3 * * * root /usr/bin/supervisorctl restart all && echo "$(date): Supervisor scheduled restart completed" >> /var/log/supervisor/restart.log
```

### 1.2 再起動前後の処理
```bash
#!/bin/bash
# /usr/local/bin/supervisor_restart_wrapper.sh

# 再起動前処理
pre_restart() {
    # 実行中のプロセスを記録
    supervisorctl status > /tmp/supervisor_status_before_restart.log
    
    # Prometheusに計画停止を通知
    curl -X POST http://localhost:9090/api/v1/admin/tsdb/snapshot
    
    # ログローテーション実行
    logrotate -f /etc/logrotate.d/supervisor
}

# 再起動実行
do_restart() {
    supervisorctl stop all
    sleep 5
    supervisorctl start all
}

# 再起動後処理
post_restart() {
    # 全プロセスの起動確認
    sleep 10
    supervisorctl status > /tmp/supervisor_status_after_restart.log
    
    # 差分確認
    diff /tmp/supervisor_status_before_restart.log /tmp/supervisor_status_after_restart.log
    
    # アラート再開
    curl -X POST http://localhost:9091/api/v1/alerts
}

# メイン処理
pre_restart
do_restart
post_restart
```

## 2. 監視システム統合

### 2.1 計画停止時間の考慮
```yaml
# Prometheus アラートルール更新
groups:
  - name: supervisor_monitoring
    rules:
      - alert: SupervisorDown
        expr: up{job="supervisor"} == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Supervisor is down"
          description: "Supervisor has been down for more than 5 minutes"
        # 午前3時の計画停止を除外
        inhibit_rules:
          - source_match:
              alertname: PlannedMaintenance
            target_match:
              alertname: SupervisorDown
            equal: ['instance']
```

### 2.2 ヘルスチェック設定更新
```javascript
// 計画停止時間を考慮したヘルスチェック
const healthCheckConfig = {
  plannedDowntime: {
    daily: {
      start: "03:00",
      duration: 300000, // 5分間
      timezone: "Asia/Tokyo"
    }
  },
  skipHealthCheckDuringMaintenance: true
};
```

## 3. 権限管理標準

### 3.1 自動権限修正
```bash
# /etc/cron.hourly/fix_permissions.sh
#!/bin/bash

# tmux_supervisor_state権限修正
chmod 755 /tmp/tmux_supervisor_state 2>/dev/null
chmod 644 /tmp/tmux_supervisor_state/*.hash 2>/dev/null

# ログディレクトリ権限修正
chown -R supervisor:supervisor /var/log/supervisor
chmod 755 /var/log/supervisor
```

## 4. ログ管理標準

### 4.1 ログローテーション設定
```bash
# /etc/logrotate.d/supervisor
/var/log/supervisor/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0640 supervisor supervisor
    maxsize 100M
    sharedscripts
    postrotate
        /usr/bin/supervisorctl reopen
    endscript
}
```

## 5. 実装チェックリスト

- [x] Supervisor定期再起動cron設定
- [ ] 再起動wrapper スクリプト配置
- [ ] Prometheus アラートルール更新
- [ ] ヘルスチェック設定更新
- [ ] 権限自動修正スクリプト配置
- [ ] ログローテーション設定
- [ ] 運用手順書更新
- [ ] 監視ダッシュボード更新

## 6. 期待効果

1. **長期安定運用**: メモリリークの予防、プロセスの健全性維持
2. **自動回復**: 権限問題の自動修正、計画的な再起動
3. **可観測性向上**: 詳細なログ記録、監視システム統合
4. **運用負荷軽減**: 自動化による手動介入の削減

---
承認: PM ヘパイストス（安定化担当）
実装主導: アポロ（革新担当PM）
標準化日: 2025年6月14日