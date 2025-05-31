#!/bin/bash
# OptimizedCacheManager - モニタリングダッシュボード設定スクリプト
# 目的：キャッシュパフォーマンスをリアルタイムで可視化するためのダッシュボードを設定する

set -e

# 設定情報
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." &>/dev/null && pwd)"
CONFIG_DIR="$PROJECT_ROOT/config"
MONITORING_DIR="$PROJECT_ROOT/monitoring"
LOG_FILE="$SCRIPT_DIR/logs/monitoring_setup.log"
GRAFANA_CONFIG="$MONITORING_DIR/grafana"
PROMETHEUS_CONFIG="$MONITORING_DIR/prometheus"

# 必要なディレクトリを作成
mkdir -p "$MONITORING_DIR" "$GRAFANA_CONFIG" "$PROMETHEUS_CONFIG" "$(dirname "$LOG_FILE")"

echo "モニタリングダッシュボードのセットアップを開始します..."
echo "$(date) - モニタリングダッシュボードのセットアップを開始" >> "$LOG_FILE"

# 前提条件のチェック
check_requirements() {
  echo "前提条件をチェックしています..."
  
  # Dockerがインストールされているか確認
  if ! command -v docker &>/dev/null; then
    echo "エラー: Dockerがインストールされていません" | tee -a "$LOG_FILE"
    echo "https://docs.docker.com/get-docker/ からDockerをインストールしてください" | tee -a "$LOG_FILE"
    exit 1
  fi
  
  # Docker Composeがインストールされているか確認
  if ! command -v docker-compose &>/dev/null; then
    echo "エラー: Docker Composeがインストールされていません" | tee -a "$LOG_FILE"
    echo "https://docs.docker.com/compose/install/ からDocker Composeをインストールしてください" | tee -a "$LOG_FILE"
    exit 1
  fi
  
  echo "前提条件のチェック完了" | tee -a "$LOG_FILE"
}

# Prometheusの設定ファイルを作成
setup_prometheus() {
  echo "Prometheusの設定を作成しています..."
  
  cat > "$PROMETHEUS_CONFIG/prometheus.yml" << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'conea-api'
    metrics_path: '/metrics'
    static_configs:
      - targets: ['api:8000']
        labels:
          service: 'conea-api'
          
  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']
        labels:
          service: 'redis'
          
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
        labels:
          service: 'node'
EOF

  echo "Prometheus設定ファイルを作成しました: $PROMETHEUS_CONFIG/prometheus.yml" | tee -a "$LOG_FILE"
}

# Grafanaの設定ファイルを作成
setup_grafana() {
  echo "Grafanaの設定を作成しています..."
  
  # Grafanaデータソース設定
  mkdir -p "$GRAFANA_CONFIG/provisioning/datasources"
  cat > "$GRAFANA_CONFIG/provisioning/datasources/prometheus.yml" << EOF
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
EOF

  # Grafanaダッシュボード設定ディレクトリ
  mkdir -p "$GRAFANA_CONFIG/provisioning/dashboards"
  
  # ダッシュボードプロバイダー設定
  cat > "$GRAFANA_CONFIG/provisioning/dashboards/provider.yml" << EOF
apiVersion: 1

providers:
  - name: 'Conea Dashboards'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    options:
      path: /etc/grafana/dashboards
      foldersFromFilesStructure: true
EOF

  # ダッシュボードディレクトリ
  mkdir -p "$GRAFANA_CONFIG/dashboards"
  
  # キャッシュパフォーマンスダッシュボード
  cat > "$GRAFANA_CONFIG/dashboards/cache_performance.json" << EOF
{
  "annotations": {
    "list": [
      {
        "builtIn": 1,
        "datasource": "-- Grafana --",
        "enable": true,
        "hide": true,
        "iconColor": "rgba(0, 211, 255, 1)",
        "name": "Annotations & Alerts",
        "type": "dashboard"
      }
    ]
  },
  "editable": true,
  "gnetId": null,
  "graphTooltip": 0,
  "id": 1,
  "links": [],
  "panels": [
    {
      "aliasColors": {},
      "bars": false,
      "dashLength": 10,
      "dashes": false,
      "datasource": "Prometheus",
      "fieldConfig": {
        "defaults": {
          "custom": {}
        },
        "overrides": []
      },
      "fill": 1,
      "fillGradient": 0,
      "gridPos": {
        "h": 8,
        "w": 12,
        "x": 0,
        "y": 0
      },
      "hiddenSeries": false,
      "id": 2,
      "legend": {
        "avg": false,
        "current": false,
        "max": false,
        "min": false,
        "show": true,
        "total": false,
        "values": false
      },
      "lines": true,
      "linewidth": 1,
      "nullPointMode": "null",
      "options": {
        "alertThreshold": true
      },
      "percentage": false,
      "pluginVersion": "7.2.0",
      "pointradius": 2,
      "points": false,
      "renderer": "flot",
      "seriesOverrides": [],
      "spaceLength": 10,
      "stack": false,
      "steppedLine": false,
      "targets": [
        {
          "expr": "cache_hit_rate",
          "interval": "",
          "legendFormat": "ヒット率",
          "refId": "A"
        }
      ],
      "thresholds": [
        {
          "colorMode": "critical",
          "fill": true,
          "line": true,
          "op": "lt",
          "value": 60,
          "yaxis": "left"
        }
      ],
      "timeFrom": null,
      "timeRegions": [],
      "timeShift": null,
      "title": "キャッシュヒット率 (%)",
      "tooltip": {
        "shared": true,
        "sort": 0,
        "value_type": "individual"
      },
      "type": "graph",
      "xaxis": {
        "buckets": null,
        "mode": "time",
        "name": null,
        "show": true,
        "values": []
      },
      "yaxes": [
        {
          "format": "percent",
          "label": null,
          "logBase": 1,
          "max": "100",
          "min": "0",
          "show": true
        },
        {
          "format": "short",
          "label": null,
          "logBase": 1,
          "max": null,
          "min": null,
          "show": true
        }
      ],
      "yaxis": {
        "align": false,
        "alignLevel": null
      }
    },
    {
      "aliasColors": {},
      "bars": false,
      "dashLength": 10,
      "dashes": false,
      "datasource": "Prometheus",
      "fieldConfig": {
        "defaults": {
          "custom": {}
        },
        "overrides": []
      },
      "fill": 1,
      "fillGradient": 0,
      "gridPos": {
        "h": 8,
        "w": 12,
        "x": 12,
        "y": 0
      },
      "hiddenSeries": false,
      "id": 3,
      "legend": {
        "avg": false,
        "current": false,
        "max": false,
        "min": false,
        "show": true,
        "total": false,
        "values": false
      },
      "lines": true,
      "linewidth": 1,
      "nullPointMode": "null",
      "options": {
        "alertThreshold": true
      },
      "percentage": false,
      "pluginVersion": "7.2.0",
      "pointradius": 2,
      "points": false,
      "renderer": "flot",
      "seriesOverrides": [],
      "spaceLength": 10,
      "stack": false,
      "steppedLine": false,
      "targets": [
        {
          "expr": "cache_response_time",
          "interval": "",
          "legendFormat": "キャッシュ使用時",
          "refId": "A"
        },
        {
          "expr": "uncached_response_time",
          "interval": "",
          "legendFormat": "キャッシュなし",
          "refId": "B"
        }
      ],
      "thresholds": [],
      "timeFrom": null,
      "timeRegions": [],
      "timeShift": null,
      "title": "レスポンス時間 (ms)",
      "tooltip": {
        "shared": true,
        "sort": 0,
        "value_type": "individual"
      },
      "type": "graph",
      "xaxis": {
        "buckets": null,
        "mode": "time",
        "name": null,
        "show": true,
        "values": []
      },
      "yaxes": [
        {
          "format": "ms",
          "label": null,
          "logBase": 1,
          "max": null,
          "min": "0",
          "show": true
        },
        {
          "format": "short",
          "label": null,
          "logBase": 1,
          "max": null,
          "min": null,
          "show": true
        }
      ],
      "yaxis": {
        "align": false,
        "alignLevel": null
      }
    },
    {
      "aliasColors": {},
      "bars": false,
      "dashLength": 10,
      "dashes": false,
      "datasource": "Prometheus",
      "fieldConfig": {
        "defaults": {
          "custom": {}
        },
        "overrides": []
      },
      "fill": 1,
      "fillGradient": 0,
      "gridPos": {
        "h": 8,
        "w": 12,
        "x": 0,
        "y": 8
      },
      "hiddenSeries": false,
      "id": 4,
      "legend": {
        "avg": false,
        "current": false,
        "max": false,
        "min": false,
        "show": true,
        "total": false,
        "values": false
      },
      "lines": true,
      "linewidth": 1,
      "nullPointMode": "null",
      "options": {
        "alertThreshold": true
      },
      "percentage": false,
      "pluginVersion": "7.2.0",
      "pointradius": 2,
      "points": false,
      "renderer": "flot",
      "seriesOverrides": [],
      "spaceLength": 10,
      "stack": false,
      "steppedLine": false,
      "targets": [
        {
          "expr": "cache_memory_usage",
          "interval": "",
          "legendFormat": "使用メモリ",
          "refId": "A"
        },
        {
          "expr": "cache_memory_limit",
          "interval": "",
          "legendFormat": "メモリ上限",
          "refId": "B"
        }
      ],
      "thresholds": [
        {
          "colorMode": "critical",
          "fill": true,
          "line": true,
          "op": "gt",
          "value": 90,
          "yaxis": "left"
        }
      ],
      "timeFrom": null,
      "timeRegions": [],
      "timeShift": null,
      "title": "メモリキャッシュ使用量 (MB)",
      "tooltip": {
        "shared": true,
        "sort": 0,
        "value_type": "individual"
      },
      "type": "graph",
      "xaxis": {
        "buckets": null,
        "mode": "time",
        "name": null,
        "show": true,
        "values": []
      },
      "yaxes": [
        {
          "format": "decmbytes",
          "label": null,
          "logBase": 1,
          "max": null,
          "min": "0",
          "show": true
        },
        {
          "format": "short",
          "label": null,
          "logBase": 1,
          "max": null,
          "min": null,
          "show": true
        }
      ],
      "yaxis": {
        "align": false,
        "alignLevel": null
      }
    },
    {
      "aliasColors": {},
      "bars": false,
      "dashLength": 10,
      "dashes": false,
      "datasource": "Prometheus",
      "fieldConfig": {
        "defaults": {
          "custom": {}
        },
        "overrides": []
      },
      "fill": 1,
      "fillGradient": 0,
      "gridPos": {
        "h": 8,
        "w": 12,
        "x": 12,
        "y": 8
      },
      "hiddenSeries": false,
      "id": 5,
      "legend": {
        "avg": false,
        "current": false,
        "max": false,
        "min": false,
        "show": true,
        "total": false,
        "values": false
      },
      "lines": true,
      "linewidth": 1,
      "nullPointMode": "null",
      "options": {
        "alertThreshold": true
      },
      "percentage": false,
      "pluginVersion": "7.2.0",
      "pointradius": 2,
      "points": false,
      "renderer": "flot",
      "seriesOverrides": [],
      "spaceLength": 10,
      "stack": false,
      "steppedLine": false,
      "targets": [
        {
          "expr": "redis_memory_used",
          "interval": "",
          "legendFormat": "Redis使用メモリ",
          "refId": "A"
        },
        {
          "expr": "redis_memory_limit",
          "interval": "",
          "legendFormat": "Redis最大メモリ",
          "refId": "B"
        }
      ],
      "thresholds": [
        {
          "colorMode": "critical",
          "fill": true,
          "line": true,
          "op": "gt",
          "value": 90,
          "yaxis": "left"
        }
      ],
      "timeFrom": null,
      "timeRegions": [],
      "timeShift": null,
      "title": "Redisメモリ使用量 (MB)",
      "tooltip": {
        "shared": true,
        "sort": 0,
        "value_type": "individual"
      },
      "type": "graph",
      "xaxis": {
        "buckets": null,
        "mode": "time",
        "name": null,
        "show": true,
        "values": []
      },
      "yaxes": [
        {
          "format": "decmbytes",
          "label": null,
          "logBase": 1,
          "max": null,
          "min": "0",
          "show": true
        },
        {
          "format": "short",
          "label": null,
          "logBase": 1,
          "max": null,
          "min": null,
          "show": true
        }
      ],
      "yaxis": {
        "align": false,
        "alignLevel": null
      }
    },
    {
      "aliasColors": {},
      "bars": false,
      "dashLength": 10,
      "dashes": false,
      "datasource": "Prometheus",
      "fieldConfig": {
        "defaults": {
          "custom": {}
        },
        "overrides": []
      },
      "fill": 1,
      "fillGradient": 0,
      "gridPos": {
        "h": 8,
        "w": 8,
        "x": 0,
        "y": 16
      },
      "hiddenSeries": false,
      "id": 6,
      "legend": {
        "avg": false,
        "current": false,
        "max": false,
        "min": false,
        "show": true,
        "total": false,
        "values": false
      },
      "lines": true,
      "linewidth": 1,
      "nullPointMode": "null",
      "options": {
        "alertThreshold": true
      },
      "percentage": false,
      "pluginVersion": "7.2.0",
      "pointradius": 2,
      "points": false,
      "renderer": "flot",
      "seriesOverrides": [],
      "spaceLength": 10,
      "stack": false,
      "steppedLine": false,
      "targets": [
        {
          "expr": "cache_operations_total{operation='get'}",
          "interval": "",
          "legendFormat": "GET操作",
          "refId": "A"
        },
        {
          "expr": "cache_operations_total{operation='set'}",
          "interval": "",
          "legendFormat": "SET操作",
          "refId": "B"
        },
        {
          "expr": "cache_operations_total{operation='invalidate'}",
          "interval": "",
          "legendFormat": "無効化操作",
          "refId": "C"
        }
      ],
      "thresholds": [],
      "timeFrom": null,
      "timeRegions": [],
      "timeShift": null,
      "title": "キャッシュ操作数",
      "tooltip": {
        "shared": true,
        "sort": 0,
        "value_type": "individual"
      },
      "type": "graph",
      "xaxis": {
        "buckets": null,
        "mode": "time",
        "name": null,
        "show": true,
        "values": []
      },
      "yaxes": [
        {
          "format": "short",
          "label": null,
          "logBase": 1,
          "max": null,
          "min": "0",
          "show": true
        },
        {
          "format": "short",
          "label": null,
          "logBase": 1,
          "max": null,
          "min": null,
          "show": true
        }
      ],
      "yaxis": {
        "align": false,
        "alignLevel": null
      }
    },
    {
      "aliasColors": {},
      "bars": false,
      "dashLength": 10,
      "dashes": false,
      "datasource": "Prometheus",
      "fieldConfig": {
        "defaults": {
          "custom": {}
        },
        "overrides": []
      },
      "fill": 1,
      "fillGradient": 0,
      "gridPos": {
        "h": 8,
        "w": 8,
        "x": 8,
        "y": 16
      },
      "hiddenSeries": false,
      "id": 7,
      "legend": {
        "avg": false,
        "current": false,
        "max": false,
        "min": false,
        "show": true,
        "total": false,
        "values": false
      },
      "lines": true,
      "linewidth": 1,
      "nullPointMode": "null",
      "options": {
        "alertThreshold": true
      },
      "percentage": false,
      "pluginVersion": "7.2.0",
      "pointradius": 2,
      "points": false,
      "renderer": "flot",
      "seriesOverrides": [],
      "spaceLength": 10,
      "stack": false,
      "steppedLine": false,
      "targets": [
        {
          "expr": "redis_connections",
          "interval": "",
          "legendFormat": "接続数",
          "refId": "A"
        }
      ],
      "thresholds": [
        {
          "colorMode": "critical",
          "fill": true,
          "line": true,
          "op": "gt",
          "value": 50,
          "yaxis": "left"
        }
      ],
      "timeFrom": null,
      "timeRegions": [],
      "timeShift": null,
      "title": "Redis接続数",
      "tooltip": {
        "shared": true,
        "sort": 0,
        "value_type": "individual"
      },
      "type": "graph",
      "xaxis": {
        "buckets": null,
        "mode": "time",
        "name": null,
        "show": true,
        "values": []
      },
      "yaxes": [
        {
          "format": "short",
          "label": null,
          "logBase": 1,
          "max": null,
          "min": "0",
          "show": true
        },
        {
          "format": "short",
          "label": null,
          "logBase": 1,
          "max": null,
          "min": null,
          "show": true
        }
      ],
      "yaxis": {
        "align": false,
        "alignLevel": null
      }
    },
    {
      "aliasColors": {},
      "bars": false,
      "dashLength": 10,
      "dashes": false,
      "datasource": "Prometheus",
      "fieldConfig": {
        "defaults": {
          "custom": {}
        },
        "overrides": []
      },
      "fill": 1,
      "fillGradient": 0,
      "gridPos": {
        "h": 8,
        "w": 8,
        "x": 16,
        "y": 16
      },
      "hiddenSeries": false,
      "id": 8,
      "legend": {
        "avg": false,
        "current": false,
        "max": false,
        "min": false,
        "show": true,
        "total": false,
        "values": false
      },
      "lines": true,
      "linewidth": 1,
      "nullPointMode": "null",
      "options": {
        "alertThreshold": true
      },
      "percentage": false,
      "pluginVersion": "7.2.0",
      "pointradius": 2,
      "points": false,
      "renderer": "flot",
      "seriesOverrides": [],
      "spaceLength": 10,
      "stack": false,
      "steppedLine": false,
      "targets": [
        {
          "expr": "cache_error_count",
          "interval": "",
          "legendFormat": "エラー数",
          "refId": "A"
        }
      ],
      "thresholds": [
        {
          "colorMode": "critical",
          "fill": true,
          "line": true,
          "op": "gt",
          "value": 10,
          "yaxis": "left"
        }
      ],
      "timeFrom": null,
      "timeRegions": [],
      "timeShift": null,
      "title": "キャッシュエラー数",
      "tooltip": {
        "shared": true,
        "sort": 0,
        "value_type": "individual"
      },
      "type": "graph",
      "xaxis": {
        "buckets": null,
        "mode": "time",
        "name": null,
        "show": true,
        "values": []
      },
      "yaxes": [
        {
          "format": "short",
          "label": null,
          "logBase": 1,
          "max": null,
          "min": "0",
          "show": true
        },
        {
          "format": "short",
          "label": null,
          "logBase": 1,
          "max": null,
          "min": null,
          "show": true
        }
      ],
      "yaxis": {
        "align": false,
        "alignLevel": null
      }
    }
  ],
  "refresh": "5s",
  "schemaVersion": 26,
  "style": "dark",
  "tags": [],
  "templating": {
    "list": []
  },
  "time": {
    "from": "now-1h",
    "to": "now"
  },
  "timepicker": {
    "refresh_intervals": [
      "5s",
      "10s",
      "30s",
      "1m",
      "5m",
      "15m",
      "30m",
      "1h",
      "2h",
      "1d"
    ]
  },
  "timezone": "",
  "title": "Conea OptimizedCacheManager ダッシュボード",
  "uid": "cache-performance",
  "version": 1
}
EOF

  # アラートルール
  mkdir -p "$GRAFANA_CONFIG/alerting"
  cat > "$GRAFANA_CONFIG/alerting/rules.yml" << EOF
groups:
  - name: cache_alerts
    rules:
      - alert: LowCacheHitRate
        expr: cache_hit_rate < 60
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "キャッシュヒット率低下"
          description: "過去5分間のキャッシュヒット率が60%未満です"
          
      - alert: HighMemoryUsage
        expr: cache_memory_usage / cache_memory_limit * 100 > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "キャッシュメモリ使用量高"
          description: "キャッシュメモリ使用量が85%を超えています"
          
      - alert: HighRedisMemoryUsage
        expr: redis_memory_used / redis_memory_limit * 100 > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Redisメモリ使用量高"
          description: "Redisメモリ使用量が85%を超えています"
          
      - alert: CacheErrorSpike
        expr: rate(cache_error_count[5m]) > 5
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "キャッシュエラー急増"
          description: "5分間あたりのキャッシュエラー数が5を超えています"
EOF

  echo "Grafana設定ファイルを作成しました" | tee -a "$LOG_FILE"
}

# Docker Compose設定を作成
create_docker_compose() {
  echo "Docker Compose設定を作成しています..."
  
  cat > "$MONITORING_DIR/docker-compose.yml" << EOF
version: '3'

services:
  prometheus:
    image: prom/prometheus:v2.37.0
    container_name: conea-prometheus
    restart: unless-stopped
    volumes:
      - ./prometheus:/etc/prometheus
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--web.enable-lifecycle'
    ports:
      - "9090:9090"
    networks:
      - monitoring

  grafana:
    image: grafana/grafana:9.0.0
    container_name: conea-grafana
    restart: unless-stopped
    volumes:
      - ./grafana/provisioning:/etc/grafana/provisioning
      - ./grafana/dashboards:/etc/grafana/dashboards
      - grafana_data:/var/lib/grafana
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=conea_cache_admin
      - GF_USERS_ALLOW_SIGN_UP=false
    ports:
      - "3000:3000"
    networks:
      - monitoring
    depends_on:
      - prometheus

  node-exporter:
    image: prom/node-exporter:v1.3.1
    container_name: conea-node-exporter
    restart: unless-stopped
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.ignored-mount-points=^/(sys|proc|dev|host|etc)($$|/)'
    ports:
      - "9100:9100"
    networks:
      - monitoring

networks:
  monitoring:
    driver: bridge

volumes:
  prometheus_data:
  grafana_data:
EOF

  echo "Docker Compose設定ファイルを作成しました: $MONITORING_DIR/docker-compose.yml" | tee -a "$LOG_FILE"
}

# Pythonメトリクス送信スクリプトを作成
create_metrics_exporter() {
  echo "メトリクス送信スクリプトを作成しています..."
  
  mkdir -p "$PROJECT_ROOT/src/metrics"
  
  cat > "$PROJECT_ROOT/src/metrics/prometheus_exporter.py" << EOF
"""
OptimizedCacheManager向けPrometheusメトリクスエクスポーター
"""
import time
import threading
from prometheus_client import start_http_server, Gauge, Counter, Info

class CacheMetricsExporter:
    """キャッシュパフォーマンスメトリクスを収集しPrometheusに送信するクラス"""

    def __init__(self, cache_manager, port=8000, collection_interval=15):
        """
        初期化
        
        Args:
            cache_manager: OptimizedCacheManagerインスタンス
            port: メトリクス提供用HTTPサーバーのポート
            collection_interval: メトリクス収集間隔（秒）
        """
        self.cache_manager = cache_manager
        self.port = port
        self.collection_interval = collection_interval
        self.is_running = False
        self.collection_thread = None
        
        # メトリクス定義
        self.cache_hit_rate = Gauge('cache_hit_rate', 'キャッシュヒット率（%）')
        self.cache_memory_usage = Gauge('cache_memory_usage', 'メモリキャッシュ使用量（MB）')
        self.cache_memory_limit = Gauge('cache_memory_limit', 'メモリキャッシュ上限（MB）')
        self.redis_memory_used = Gauge('redis_memory_used', 'Redis使用メモリ（MB）')
        self.redis_memory_limit = Gauge('redis_memory_limit', 'Redis最大メモリ（MB）')
        self.redis_connections = Gauge('redis_connections', 'Redis接続数')
        self.cache_operations = Counter('cache_operations_total', 'キャッシュ操作数', ['operation'])
        self.cache_error_count = Counter('cache_error_count', 'キャッシュエラー数')
        self.cache_response_time = Gauge('cache_response_time', 'キャッシュ使用時のレスポンス時間（ms）')
        self.uncached_response_time = Gauge('uncached_response_time', 'キャッシュなしのレスポンス時間（ms）')
        
        # キャッシュ情報
        self.cache_info = Info('cache_info', 'キャッシュ設定情報')
        self.cache_info.info({
            'version': self.cache_manager.VERSION if hasattr(self.cache_manager, 'VERSION') else 'unknown',
            'redis_enabled': str(self.cache_manager.redis_enabled if hasattr(self.cache_manager, 'redis_enabled') else False),
            'compression_enabled': str(self.cache_manager.compression_enabled if hasattr(self.cache_manager, 'compression_enabled') else False)
        })
    
    def start(self):
        """メトリクス収集とHTTPサーバーを開始"""
        if self.is_running:
            return
            
        # HTTP server for metrics
        start_http_server(self.port)
        print(f"メトリクスサーバーを開始しました。ポート: {self.port}")
        
        self.is_running = True
        self.collection_thread = threading.Thread(target=self._collect_metrics_loop)
        self.collection_thread.daemon = True
        self.collection_thread.start()
    
    def stop(self):
        """メトリクス収集を停止"""
        self.is_running = False
        if self.collection_thread:
            self.collection_thread.join(timeout=1.0)
    
    def _collect_metrics_loop(self):
        """定期的にメトリクスを収集するループ"""
        while self.is_running:
            try:
                self._collect_metrics()
            except Exception as e:
                print(f"メトリクス収集中にエラーが発生しました: {e}")
            
            time.sleep(self.collection_interval)
    
    def _collect_metrics(self):
        """キャッシュからメトリクスを収集してPrometheusに送信"""
        # キャッシュヒット率
        if hasattr(self.cache_manager, 'get_hit_rate'):
            hit_rate = self.cache_manager.get_hit_rate() * 100  # パーセント表示
            self.cache_hit_rate.set(hit_rate)
        
        # メモリ使用状況
        if hasattr(self.cache_manager, 'get_memory_usage'):
            memory_usage = self.cache_manager.get_memory_usage() / (1024 * 1024)  # バイトからMBに変換
            self.cache_memory_usage.set(memory_usage)
        
        if hasattr(self.cache_manager, 'memory_limit'):
            memory_limit = self.cache_manager.memory_limit / (1024 * 1024)  # バイトからMBに変換
            self.cache_memory_limit.set(memory_limit)
        
        # Redis情報
        if hasattr(self.cache_manager, 'redis_client') and self.cache_manager.redis_client:
            try:
                redis_info = self.cache_manager.redis_client.info('memory')
                self.redis_memory_used.set(redis_info.get('used_memory', 0) / (1024 * 1024))
                self.redis_memory_limit.set(redis_info.get('maxmemory', 0) / (1024 * 1024))
                
                clients_info = self.cache_manager.redis_client.info('clients')
                self.redis_connections.set(clients_info.get('connected_clients', 0))
            except Exception as e:
                print(f"Redis情報の取得に失敗しました: {e}")
                self.cache_error_count.inc()
        
        # パフォーマンス情報を収集
        if hasattr(self.cache_manager, 'get_performance_stats'):
            stats = self.cache_manager.get_performance_stats()
            if stats:
                self.cache_response_time.set(stats.get('avg_cached_time_ms', 0))
                self.uncached_response_time.set(stats.get('avg_uncached_time_ms', 0))
    
    def record_operation(self, operation_type):
        """キャッシュ操作を記録
        
        Args:
            operation_type: 操作タイプ ('get', 'set', 'invalidate')
        """
        self.cache_operations.labels(operation=operation_type).inc()
    
    def record_error(self):
        """キャッシュエラーを記録"""
        self.cache_error_count.inc()
EOF

  # 統合ヘルパーファイル
  cat > "$PROJECT_ROOT/src/metrics/__init__.py" << EOF
from .prometheus_exporter import CacheMetricsExporter

__all__ = ['CacheMetricsExporter']
EOF

  echo "メトリクス送信スクリプトを作成しました: $PROJECT_ROOT/src/metrics/prometheus_exporter.py" | tee -a "$LOG_FILE"
}

# OptimizedCacheManagerへのメトリクス統合サンプルコードを作成
create_integration_sample() {
  echo "統合サンプルコードを作成しています..."
  
  cat > "$SCRIPT_DIR/cache_metrics_integration.py" << EOF
"""
OptimizedCacheManagerとPrometheusメトリクスの統合サンプル
"""
from src.api.shopify.optimized_cache_manager import OptimizedCacheManager
from src.metrics.prometheus_exporter import CacheMetricsExporter

def setup_metrics(cache_manager_instance: OptimizedCacheManager):
    """
    キャッシュマネージャーへのメトリクス統合をセットアップ
    
    Args:
        cache_manager_instance: OptimizedCacheManagerのインスタンス
        
    Returns:
        メトリクスエクスポーターのインスタンス
    """
    # メトリクスエクスポーターを作成して開始
    metrics = CacheMetricsExporter(
        cache_manager=cache_manager_instance,
        port=8000,  # メトリクス用ポート
        collection_interval=15  # 収集間隔（秒）
    )
    metrics.start()
    
    # オリジナルメソッドへの参照を保存
    original_get = cache_manager_instance.get
    original_set = cache_manager_instance.set
    original_invalidate = cache_manager_instance.invalidate
    
    # メトリクス記録用のメソッドでラップ
    def get_with_metrics(*args, **kwargs):
        try:
            result = original_get(*args, **kwargs)
            metrics.record_operation('get')
            return result
        except Exception as e:
            metrics.record_error()
            raise e
    
    def set_with_metrics(*args, **kwargs):
        try:
            result = original_set(*args, **kwargs)
            metrics.record_operation('set')
            return result
        except Exception as e:
            metrics.record_error()
            raise e
    
    def invalidate_with_metrics(*args, **kwargs):
        try:
            result = original_invalidate(*args, **kwargs)
            metrics.record_operation('invalidate')
            return result
        except Exception as e:
            metrics.record_error()
            raise e
    
    # モンキーパッチでメソッドを置き換え
    cache_manager_instance.get = get_with_metrics
    cache_manager_instance.set = set_with_metrics
    cache_manager_instance.invalidate = invalidate_with_metrics
    
    return metrics

def usage_example():
    """使用例"""
    # キャッシュマネージャーのインスタンスを取得
    cache_manager = OptimizedCacheManager()
    
    # メトリクスを設定
    metrics_exporter = setup_metrics(cache_manager)
    
    # アプリケーションの残りの部分...
    
    # シャットダウン時にメトリクス収集を停止
    # app.on_shutdown = lambda: metrics_exporter.stop()
EOF

  echo "統合サンプルコードを作成しました: $SCRIPT_DIR/cache_metrics_integration.py" | tee -a "$LOG_FILE"
}

# アラート通知設定
setup_alerts() {
  echo "アラート通知設定を作成しています..."
  
  mkdir -p "$MONITORING_DIR/alertmanager"
  
  cat > "$MONITORING_DIR/alertmanager/config.yml" << EOF
global:
  resolve_timeout: 5m
  # Slack通知用設定
  # slack_api_url: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX'

route:
  group_by: ['alertname']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'default-receiver'
  routes:
  - match:
      severity: critical
    receiver: 'critical-receiver'
    continue: true

receivers:
- name: 'default-receiver'
  email_configs:
  - to: 'alerts@example.com'
    from: 'alertmanager@example.com'
    smarthost: 'smtp.example.com:587'
    auth_username: 'alertmanager@example.com'
    auth_password: 'password'
    send_resolved: true

- name: 'critical-receiver'
  # Slack通知の場合
  # slack_configs:
  # - channel: '#alerts'
  #   send_resolved: true
  #   title: "{{ range .Alerts }}{{ .Annotations.summary }}\n{{ end }}"
  #   text: "{{ range .Alerts }}{{ .Annotations.description }}\n{{ end }}"
  #   username: 'Alertmanager'
  #   icon_emoji: ':warning:'
  email_configs:
  - to: 'critical-alerts@example.com'
    from: 'alertmanager@example.com'
    smarthost: 'smtp.example.com:587'
    auth_username: 'alertmanager@example.com'
    auth_password: 'password'
    send_resolved: true
EOF

  # Prometheusの設定にAlertmanagerを追加
  cat >> "$PROMETHEUS_CONFIG/prometheus.yml" << EOF
alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - 'alertmanager:9093'

rule_files:
  - /etc/prometheus/rules/*.yml
EOF

  # アラートルールディレクトリ
  mkdir -p "$PROMETHEUS_CONFIG/rules"
  
  # キャッシュアラートルール
  cat > "$PROMETHEUS_CONFIG/rules/cache_alerts.yml" << EOF
groups:
- name: cache_alert_rules
  rules:
  - alert: LowCacheHitRate
    expr: cache_hit_rate < 60
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "キャッシュヒット率が低下しています"
      description: "過去5分間でキャッシュヒット率が60%を下回りました。TTL設定やキャッシュキー生成を確認してください。"

  - alert: HighMemoryUsage
    expr: (cache_memory_usage / cache_memory_limit) * 100 > 85
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "メモリキャッシュ使用率が高いです"
      description: "メモリキャッシュの使用率が85%を超えています。キャッシュサイズの見直しやTTLの短縮を検討してください。"

  - alert: HighRedisMemoryUsage
    expr: (redis_memory_used / redis_memory_limit) * 100 > 85
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Redisメモリ使用率が高いです"
      description: "Redisのメモリ使用率が85%を超えています。maxmemory設定の増加または古いキーの削除を検討してください。"

  - alert: CacheErrorSpike
    expr: rate(cache_error_count[5m]) > 5
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "キャッシュエラーが急増しています"
      description: "5分間に5件以上のキャッシュエラーが発生しています。ログを確認し、Redis接続やメモリ使用状況を確認してください。"

  - alert: RedisConnectionsHigh
    expr: redis_connections > 50
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Redis接続数が多いです"
      description: "Redis接続数が50を超えています。接続プールの設定を確認し、未使用の接続が適切に解放されているか確認してください。"

  - alert: SlowCacheResponse
    expr: cache_response_time > 100
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "キャッシュレスポンスが遅いです"
      description: "キャッシュを使用している場合でも、レスポンス時間が100ms以上かかっています。Redisレイテンシやネットワーク負荷を確認してください。"
EOF

  # Alertmanagerをdocker-composeに追加
  sed -i.bak '/^services:/a \
  alertmanager:\
    image: prom/alertmanager:v0.24.0\
    container_name: conea-alertmanager\
    restart: unless-stopped\
    volumes:\
      - ./alertmanager:/etc/alertmanager\
    command:\
      - "--config.file=/etc/alertmanager/config.yml"\
      - "--storage.path=/alertmanager"\
    ports:\
      - "9093:9093"\
    networks:\
      - monitoring' "$MONITORING_DIR/docker-compose.yml"

  # バックアップファイルを削除
  rm -f "$MONITORING_DIR/docker-compose.yml.bak"

  echo "アラート通知設定を作成しました" | tee -a "$LOG_FILE"
}

# 起動スクリプトを作成
create_start_script() {
  echo "モニタリング起動スクリプトを作成しています..."
  
  cat > "$SCRIPT_DIR/start_monitoring.sh" << EOF
#!/bin/bash
# OptimizedCacheManager - モニタリング起動スクリプト

set -e

SCRIPT_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
PROJECT_ROOT="\$(cd "\$SCRIPT_DIR/../.." &>/dev/null && pwd)"
MONITORING_DIR="\$PROJECT_ROOT/monitoring"
LOG_FILE="\$SCRIPT_DIR/logs/monitoring.log"

mkdir -p "\$(dirname "\$LOG_FILE")"

echo "モニタリングサービスを起動しています..."
echo "\$(date) - モニタリングサービスを起動" >> "\$LOG_FILE"

# Dockerが実行中か確認
if ! docker info &>/dev/null; then
  echo "エラー: Dockerが実行されていません" | tee -a "\$LOG_FILE"
  echo "Dockerを起動してから再試行してください" | tee -a "\$LOG_FILE"
  exit 1
fi

# 既存のコンテナを確認
if docker ps -q --filter "name=conea-grafana" | grep -q .; then
  echo "既存のモニタリングコンテナがあります。再起動します..." | tee -a "\$LOG_FILE"
  cd "\$MONITORING_DIR" && docker-compose down
fi

# コンテナを起動
cd "\$MONITORING_DIR" && docker-compose up -d

# 起動確認
sleep 5
if docker ps --filter "name=conea-grafana" --filter "status=running" | grep -q conea-grafana; then
  echo "モニタリングサービスが正常に起動しました" | tee -a "\$LOG_FILE"
  echo "以下のURLでアクセスできます:" | tee -a "\$LOG_FILE"
  echo "- Grafana: http://localhost:3000 (ユーザー: admin, パスワード: conea_cache_admin)" | tee -a "\$LOG_FILE"
  echo "- Prometheus: http://localhost:9090" | tee -a "\$LOG_FILE"
  echo "- Alertmanager: http://localhost:9093" | tee -a "\$LOG_FILE"
else
  echo "エラー: モニタリングサービスの起動に失敗しました" | tee -a "\$LOG_FILE"
  echo "詳細なログを確認してください: docker logs conea-grafana" | tee -a "\$LOG_FILE"
  exit 1
fi
EOF

  chmod +x "$SCRIPT_DIR/start_monitoring.sh"

  # 停止スクリプトも作成
  cat > "$SCRIPT_DIR/stop_monitoring.sh" << EOF
#!/bin/bash
# OptimizedCacheManager - モニタリング停止スクリプト

set -e

SCRIPT_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
PROJECT_ROOT="\$(cd "\$SCRIPT_DIR/../.." &>/dev/null && pwd)"
MONITORING_DIR="\$PROJECT_ROOT/monitoring"
LOG_FILE="\$SCRIPT_DIR/logs/monitoring.log"

mkdir -p "\$(dirname "\$LOG_FILE")"

echo "モニタリングサービスを停止しています..."
echo "\$(date) - モニタリングサービスを停止" >> "\$LOG_FILE"

# コンテナを停止
cd "\$MONITORING_DIR" && docker-compose down

echo "モニタリングサービスを停止しました" | tee -a "\$LOG_FILE"
EOF

  chmod +x "$SCRIPT_DIR/stop_monitoring.sh"

  echo "モニタリング起動/停止スクリプトを作成しました" | tee -a "$LOG_FILE"
}

# スクリプト実行の流れ
check_requirements
setup_prometheus
setup_grafana
create_docker_compose
create_metrics_exporter
create_integration_sample
setup_alerts
create_start_script

echo "モニタリングダッシュボードのセットアップが完了しました" | tee -a "$LOG_FILE"
echo "以下のコマンドでモニタリングを開始できます:" | tee -a "$LOG_FILE"
echo "./scripts/cache-verification/start_monitoring.sh" | tee -a "$LOG_FILE"
echo "セットアップされたダッシュボードでカバーする主要メトリクス:" | tee -a "$LOG_FILE"
echo "- キャッシュヒット率" | tee -a "$LOG_FILE"
echo "- レスポンス時間 (キャッシュ有/無)" | tee -a "$LOG_FILE"
echo "- メモリキャッシュ使用量" | tee -a "$LOG_FILE"
echo "- Redisメモリ使用量" | tee -a "$LOG_FILE"
echo "- キャッシュ操作数 (Get/Set/Invalidate)" | tee -a "$LOG_FILE"
echo "- Redis接続数" | tee -a "$LOG_FILE"
echo "- キャッシュエラー数" | tee -a "$LOG_FILE"