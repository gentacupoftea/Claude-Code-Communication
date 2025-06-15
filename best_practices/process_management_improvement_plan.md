# プロセス管理改善計画

## 背景
- Supervisor権限エラー（294MB → 391MB）の原因が長時間実行プロセスと判明
- CI GREEN成果への影響なしを確認
- 安定化担当として根本的な改善策を策定

## 改善策

### 1. メモリ使用量監視
```bash
# プロセスメモリ監視スクリプト
*/5 * * * * ps aux | grep supervisor | awk '{if($6>300000) print "WARNING: Process "$2" using "$6"KB memory"}'
```

### 2. 定期的再起動スケジュール
```yaml
# Supervisor設定の改善
[program:conea-worker]
autorestart=true
autostart=true
startsecs=10
stopwaitsecs=600
killasgroup=true
stopasgroup=true
# メモリ制限設定
environment=MALLOC_ARENA_MAX="2"
```

### 3. ログローテーション設定
```bash
# logrotate設定
/var/log/supervisor/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 supervisor supervisor
    sharedscripts
    postrotate
        /usr/bin/supervisorctl reopen
    endscript
}
```

### 4. プロセス健全性チェック
```bash
# ヘルスチェックスクリプト
#!/bin/bash
THRESHOLD_MB=300
PROCESS_MEM=$(ps aux | grep supervisor | awk '{print $6}' | head -1)
PROCESS_MEM_MB=$((PROCESS_MEM / 1024))

if [ $PROCESS_MEM_MB -gt $THRESHOLD_MB ]; then
    echo "[警告] Supervisorプロセスがメモリ閾値を超過: ${PROCESS_MEM_MB}MB"
    supervisorctl restart all
fi
```

### 5. 監視ダッシュボード統合
- Prometheusメトリクスへの統合
- Grafanaアラート設定
- 自動通知システム

## 実装優先順位
1. ログローテーション設定（即座実装）
2. メモリ使用量監視（24時間以内）
3. 定期的再起動スケジュール（48時間以内）
4. プロセス健全性チェック（72時間以内）
5. 監視ダッシュボード統合（1週間以内）

## 期待効果
- 長時間実行によるメモリ肥大化の防止
- ログファイル肥大化（294MB+）の防止
- システム全体の安定性向上
- 問題の早期発見と自動回復

---
作成者: PM ヘパイストス（安定化担当）
日時: 2025年6月14日
状況: CI GREEN成果維持を前提とした予防的改善