"""
同期エンジンのREST API
"""

import json
import logging
import os
from datetime import datetime
from typing import Dict, Any, Optional, List

from flask import Flask, request, jsonify, Response
from werkzeug.exceptions import HTTPException

from .engine import SyncEngine
from .scheduler import SyncScheduler
from .config import SyncConfig
from .models import SyncType, SyncStatus

# ロガー設定
logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# 環境変数から設定を読み込み
GCP_PROJECT_ID = os.environ.get('GCP_PROJECT_ID', 'conea-project-dev')

# 同期エンジンとスケジューラーを初期化
config = SyncConfig(
    batch_size=int(os.environ.get('SYNC_BATCH_SIZE', '50')),
    sync_interval=int(os.environ.get('SYNC_INTERVAL', '300')),
    api_rate_limit_amazon=float(os.environ.get('API_RATE_LIMIT_AMAZON', '0.5')),
    api_rate_limit_nextengine=float(os.environ.get('API_RATE_LIMIT_NEXTENGINE', '1.0')),
    log_level=os.environ.get('LOG_LEVEL', 'INFO')
)

sync_engine = SyncEngine(GCP_PROJECT_ID, config)
scheduler = SyncScheduler(sync_engine)

# Flaskアプリケーション初期化
app = Flask(__name__)


@app.before_first_request
async def initialize_engine():
    """最初のリクエスト前にエンジンを初期化"""
    try:
        await sync_engine.initialize()
        logger.info("同期エンジンが初期化されました")
    except Exception as e:
        logger.error(f"同期エンジンの初期化に失敗: {e}", exc_info=True)


@app.route('/', methods=['GET'])
def home():
    """ホームエンドポイント"""
    return jsonify({
        "name": "Data Sync Engine API",
        "version": "1.0.0",
        "status": "running"
    })


@app.route('/api/health', methods=['GET'])
def health_check():
    """ヘルスチェックエンドポイント"""
    return jsonify({
        "status": "ok",
        "timestamp": datetime.now().isoformat()
    })


@app.route('/api/status', methods=['GET'])
def status():
    """エンジンのステータスを取得"""
    engine_status = sync_engine.get_status()
    scheduler_status = scheduler.get_schedule_status() if scheduler.is_running else None
    
    return jsonify({
        "engine": engine_status,
        "scheduler": scheduler_status,
        "timestamp": datetime.now().isoformat()
    })


@app.route('/api/scheduler/start', methods=['POST'])
async def start_scheduler():
    """スケジューラーを開始"""
    if scheduler.is_running:
        return jsonify({
            "success": False,
            "message": "スケジューラーは既に実行中です"
        }), 400
    
    success = await scheduler.start()
    status_code = 200 if success else 500
    
    return jsonify({
        "success": success,
        "message": "スケジューラーを開始しました" if success else "スケジューラーの開始に失敗しました"
    }), status_code


@app.route('/api/scheduler/stop', methods=['POST'])
async def stop_scheduler():
    """スケジューラーを停止"""
    if not scheduler.is_running:
        return jsonify({
            "success": False,
            "message": "スケジューラーは実行中ではありません"
        }), 400
    
    await scheduler.stop()
    
    return jsonify({
        "success": True,
        "message": "スケジューラーを停止しました"
    })


@app.route('/api/sync/products', methods=['POST'])
async def sync_products():
    """商品データを同期"""
    if not sync_engine.amazon_connector or not sync_engine.nextengine_connector:
        await sync_engine.initialize()
    
    result = await sync_engine.sync_products()
    
    return jsonify({
        "success": result.is_success(),
        "result": result.to_dict()
    })


@app.route('/api/sync/orders', methods=['POST'])
async def sync_orders():
    """注文データを同期"""
    if not sync_engine.amazon_connector or not sync_engine.nextengine_connector:
        await sync_engine.initialize()
    
    result = await sync_engine.sync_orders()
    
    return jsonify({
        "success": result.is_success(),
        "result": result.to_dict()
    })


@app.route('/api/sync/inventory', methods=['POST'])
async def sync_inventory():
    """在庫データを同期"""
    if not sync_engine.amazon_connector or not sync_engine.nextengine_connector:
        await sync_engine.initialize()
    
    result = await sync_engine.sync_inventory()
    
    return jsonify({
        "success": result.is_success(),
        "result": result.to_dict()
    })


@app.route('/api/sync/all', methods=['POST'])
async def sync_all():
    """すべてのデータを同期"""
    if not sync_engine.amazon_connector or not sync_engine.nextengine_connector:
        await sync_engine.initialize()
    
    results = await sync_engine.sync_all()
    
    return jsonify({
        "success": all(r.is_success() for r in results.values()),
        "results": {k.value: v.to_dict() for k, v in results.items()}
    })


@app.route('/api/history', methods=['GET'])
def get_history():
    """同期履歴を取得"""
    sync_type = request.args.get('type')
    limit = request.args.get('limit', default=10, type=int)
    
    history = sync_engine.get_history()
    results = history.results[-limit:]
    
    if sync_type:
        try:
            sync_type_enum = SyncType(sync_type)
            results = [r for r in results if r.sync_type == sync_type_enum]
        except ValueError:
            return jsonify({
                "success": False,
                "message": f"無効な同期タイプ: {sync_type}"
            }), 400
    
    return jsonify({
        "success": True,
        "history": [r.to_dict() for r in results],
        "count": len(results)
    })


@app.route('/api/config', methods=['GET'])
def get_config():
    """現在の設定を取得"""
    return jsonify({
        "success": True,
        "config": {
            "batch_size": config.batch_size,
            "sync_interval": config.sync_interval,
            "retry_attempts": config.retry_attempts,
            "retry_delay": config.retry_delay,
            "sync_products": config.sync_products,
            "sync_inventory": config.sync_inventory,
            "sync_orders": config.sync_orders,
            "sync_customers": config.sync_customers,
            "amazon_to_nextengine": config.amazon_to_nextengine,
            "nextengine_to_amazon": config.nextengine_to_amazon,
            "conflict_resolution": config.conflict_resolution,
            "api_rate_limit_amazon": config.api_rate_limit_amazon,
            "api_rate_limit_nextengine": config.api_rate_limit_nextengine,
            "log_level": config.log_level
        }
    })


@app.route('/api/config', methods=['PUT'])
def update_config():
    """設定を更新"""
    if not request.is_json:
        return jsonify({
            "success": False,
            "message": "JSONデータが必要です"
        }), 400
    
    data = request.get_json()
    
    # 設定の更新
    for key, value in data.items():
        if hasattr(config, key):
            setattr(config, key, value)
    
    return jsonify({
        "success": True,
        "message": "設定を更新しました",
        "config": {
            "batch_size": config.batch_size,
            "sync_interval": config.sync_interval,
            "retry_attempts": config.retry_attempts,
            "retry_delay": config.retry_delay,
            "sync_products": config.sync_products,
            "sync_inventory": config.sync_inventory,
            "sync_orders": config.sync_orders,
            "sync_customers": config.sync_customers,
            "amazon_to_nextengine": config.amazon_to_nextengine,
            "nextengine_to_amazon": config.nextengine_to_amazon,
            "conflict_resolution": config.conflict_resolution,
            "api_rate_limit_amazon": config.api_rate_limit_amazon,
            "api_rate_limit_nextengine": config.api_rate_limit_nextengine,
            "log_level": config.log_level
        }
    })


# エラーハンドラー
@app.errorhandler(Exception)
def handle_exception(e):
    """例外ハンドラー"""
    logger.error(f"APIエラー: {str(e)}", exc_info=True)
    
    if isinstance(e, HTTPException):
        return jsonify({
            "success": False,
            "error": e.description,
            "status_code": e.code
        }), e.code
    
    return jsonify({
        "success": False,
        "error": str(e),
        "status_code": 500
    }), 500


# メイン関数
if __name__ == '__main__':
    # 環境変数からポート番号を取得（デフォルトは8080）
    port = int(os.environ.get('PORT', 8080))
    debug = os.environ.get('DEBUG', 'False').lower() == 'true'
    
    # Flaskアプリケーションを実行
    app.run(host='0.0.0.0', port=port, debug=debug)