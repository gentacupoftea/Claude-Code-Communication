#!/usr/bin/env python3
"""
Shopify同期エンジン使用例
"""

import os
import logging
import time
from datetime import datetime
from dotenv import load_dotenv

from src.api.shopify_api import ShopifyAPI
from src.sync.shopify_sync import ShopifySyncEngine

# ロギング設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    """
    Shopify同期エンジンのサンプル実行
    """
    # 環境変数の読み込み
    load_dotenv()
    
    logger.info("Shopify同期エンジンのサンプルを開始")
    
    try:
        # Shopify APIクライアントの初期化
        shopify_api = ShopifyAPI(
            shop_url=f"https://{os.getenv('SHOPIFY_SHOP_NAME')}.myshopify.com",
            access_token=os.getenv('SHOPIFY_ACCESS_TOKEN'),
            api_version=os.getenv('SHOPIFY_API_VERSION', '2025-04')
        )
        
        # 同期エンジンの初期化
        sync_engine = ShopifySyncEngine(shopify_api)
        
        # 外部プラットフォームの登録例
        # この例では単純なモック実装を使用
        external_api = DummyExternalAPI()
        sync_engine.register_external_api("dummy_platform", external_api)
        
        # 同期エンジンの開始（15秒間隔）
        sync_engine.start(interval_seconds=15)
        
        # 同期状態の表示
        logger.info("同期エンジンの状態を表示します（10秒ごと）")
        for _ in range(5):  # 5回（約50秒間）実行
            time.sleep(10)
            status = sync_engine.get_status()
            logger.info(f"同期エンジンの状態: 実行中={status['running']}")
            
            if 'latest_syncs' in status:
                for sync_type, details in status['latest_syncs'].items():
                    logger.info(f"  {sync_type}: 状態={details['status']}, 成功数={details['synced_count']}")
        
        # 同期エンジンの停止
        sync_engine.stop()
        logger.info("同期エンジンを停止しました")
        
        # 同期履歴の表示
        history = sync_engine.get_history()
        logger.info(f"同期履歴: {len(history)}件")
        for i, item in enumerate(history[-3:]):  # 最新の3件のみ表示
            logger.info(f"履歴{i+1}: タイプ={item['sync_type']}, 状態={item['status']}, 時間={item['duration']}秒")
        
    except Exception as e:
        logger.error(f"サンプル実行中にエラーが発生: {e}")
    
    logger.info("Shopify同期エンジンのサンプルが終了しました")


class DummyExternalAPI:
    """外部プラットフォームAPIのモック実装"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__ + ".DummyExternalAPI")
    
    async def initialize(self):
        """APIの初期化"""
        self.logger.info("外部APIを初期化しました")
        return True
    
    def sync_products(self, products):
        """商品データを同期"""
        self.logger.info(f"{len(products)}件の商品を同期中...")
        time.sleep(0.5)  # 処理時間をシミュレート
        return {"processed": len(products), "timestamp": datetime.now().isoformat()}
    
    def sync_inventory(self, inventory):
        """在庫データを同期"""
        self.logger.info(f"{len(inventory)}件の在庫を同期中...")
        time.sleep(0.3)  # 処理時間をシミュレート
        return {"processed": len(inventory), "timestamp": datetime.now().isoformat()}
    
    def get_orders(self):
        """注文データを取得"""
        orders = [
            {"id": "ord1", "total": 1000, "date": datetime.now().isoformat()},
            {"id": "ord2", "total": 2000, "date": datetime.now().isoformat()},
        ]
        self.logger.info(f"{len(orders)}件の注文を取得")
        return orders


if __name__ == "__main__":
    main()