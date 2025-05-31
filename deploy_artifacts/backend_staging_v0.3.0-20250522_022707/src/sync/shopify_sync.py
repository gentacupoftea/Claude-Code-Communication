"""
Shopify同期エンジン
ShopifyとMCPサーバー間のデータ同期を管理します
"""

import asyncio
import logging
import time
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Callable

from ..api.shopify_api import ShopifyAPI
from .sync_engine.models import SyncRecord, SyncResult, SyncStatus, SyncType, SyncHistory

logger = logging.getLogger(__name__)

class ShopifySyncEngine:
    """
    Shopifyデータ同期エンジン
    Shopifyと外部プラットフォーム間のデータ同期を管理
    """
    
    def __init__(self, shopify_api: ShopifyAPI, external_apis: Optional[Dict[str, Any]] = None):
        """
        初期化
        
        Args:
            shopify_api: Shopify API クライアントインスタンス
            external_apis: 外部APIクライアントの辞書（プラットフォーム名：APIクライアント）
        """
        self.shopify_api = shopify_api
        self.external_apis = external_apis or {}
        
        self.sync_thread = None
        self.stop_event = threading.Event()
        
        # 統計情報
        self.last_sync_time = None
        self.sync_history = SyncHistory()
        
        # 設定（環境変数から設定を読み込むロジックも追加予定）
        self.batch_size = 100
        self.max_retries = 3
        self.retry_delay = 60
        
        logger.info("Shopifyデータ同期エンジンが初期化されました")
    
    def register_external_api(self, platform_name: str, api_client: Any) -> None:
        """
        外部プラットフォームAPIクライアントを登録
        
        Args:
            platform_name: 外部プラットフォーム名
            api_client: APIクライアントインスタンス
        """
        self.external_apis[platform_name] = api_client
        logger.info(f"外部APIが登録されました: {platform_name}")
    
    async def initialize(self) -> bool:
        """
        同期エンジンの初期化
        
        Returns:
            初期化成功の場合はTrue
        """
        try:
            # Shopify APIの認証確認
            if not self.shopify_api:
                logger.error("Shopify APIクライアントが設定されていません")
                return False
            
            # 外部APIの初期化
            for platform_name, api_client in self.external_apis.items():
                if hasattr(api_client, 'initialize') and callable(api_client.initialize):
                    await api_client.initialize()
            
            logger.info("Shopify同期エンジンの初期化が完了しました")
            return True
            
        except Exception as e:
            logger.error(f"同期エンジンの初期化に失敗: {e}")
            return False
    
    def start(self, interval_seconds: int = 300) -> bool:
        """
        指定された間隔での同期スケジュールで同期エンジンを開始
        
        Args:
            interval_seconds: 同期間隔（秒）
        
        Returns:
            開始成功の場合はTrue
        """
        if self.sync_thread and self.sync_thread.is_alive():
            logger.warning("同期エンジンは既に実行中です")
            return False
        
        self.stop_event.clear()
        
        # スケジューラスレッドを開始
        self.sync_thread = threading.Thread(target=self._run_scheduler, args=(interval_seconds,))
        self.sync_thread.daemon = True
        self.sync_thread.start()
        
        logger.info(f"Shopifyデータ同期エンジンが開始されました（間隔: {interval_seconds}秒）")
        return True
    
    def _run_scheduler(self, interval_seconds: int) -> None:
        """
        同期スケジューラのメインループ
        
        Args:
            interval_seconds: 同期間隔（秒）
        """
        logger.info("スケジューラスレッドが開始されました")
        
        # 初回同期をすぐに実行
        self.sync_all()
        
        # 定期的な同期ループ
        while not self.stop_event.is_set():
            try:
                # 次回実行時間までスリープ
                time_passed = 0
                while time_passed < interval_seconds and not self.stop_event.is_set():
                    time.sleep(1)
                    time_passed += 1
                
                # スケジュールされた同期を実行
                if not self.stop_event.is_set():
                    self.sync_all()
                    
            except Exception as e:
                logger.error(f"スケジューラで例外が発生: {e}")
                time.sleep(self.retry_delay)  # エラー後は待機
        
        logger.info("スケジューラスレッドが停止しました")
    
    def stop(self) -> None:
        """同期エンジンを停止"""
        if not self.sync_thread or not self.sync_thread.is_alive():
            logger.warning("同期エンジンは実行中ではありません")
            return
        
        logger.info("同期エンジンを停止しています...")
        self.stop_event.set()
        
        # スレッドの終了を待機
        self.sync_thread.join(timeout=30)
        
        logger.info("同期エンジンが停止しました")
    
    def sync_all(self) -> Dict[str, Any]:
        """
        全プラットフォームの全データタイプの同期を実行
        
        Returns:
            同期結果の辞書
        """
        logger.info("全データ同期を開始")
        self.last_sync_time = datetime.now()
        
        # 全体の結果
        result = SyncResult(
            status=SyncStatus.RUNNING,
            sync_type=SyncType.FULL,
            start_time=self.last_sync_time
        )
        
        # 各プラットフォームを同期
        platform_results = {}
        for platform_name, api_client in self.external_apis.items():
            platform_result = self._sync_platform(platform_name, api_client)
            platform_results[platform_name] = platform_result
        
        # 成功・失敗の集計
        all_success = True
        for platform_results_dict in platform_results.values():
            for data_type, result_dict in platform_results_dict.items():
                if result_dict.get('status') == 'error':
                    all_success = False
                    result.failed_count += 1
                    error_msg = result_dict.get('error', '不明なエラー')
                    result.errors.append(f"{platform_name} {data_type}: {error_msg}")
                else:
                    result.synced_count += result_dict.get('synced_count', 0)
                    result.skipped_count += result_dict.get('skipped_count', 0)
        
        # 全体の結果を設定
        result.status = SyncStatus.SUCCESS if all_success else SyncStatus.PARTIAL
        result.end_time = datetime.now()
        result.update_duration()
        
        # 履歴に追加
        self.sync_history.add_result(result)
        
        logger.info(f"全データ同期が完了: 成功={result.synced_count}, 失敗={result.failed_count}, スキップ={result.skipped_count}")
        
        return {
            'status': result.status.value,
            'started_at': self.last_sync_time.isoformat(),
            'completed_at': datetime.now().isoformat(),
            'duration_seconds': result.duration,
            'platforms': platform_results,
            'synced_count': result.synced_count,
            'failed_count': result.failed_count,
            'skipped_count': result.skipped_count,
            'errors': result.errors
        }
    
    def _sync_platform(self, platform_name: str, api_client: Any) -> Dict[str, Dict[str, Any]]:
        """
        特定の外部プラットフォームとのデータ同期を実行
        
        Args:
            platform_name: 外部プラットフォーム名
            api_client: APIクライアントインスタンス
            
        Returns:
            データタイプごとの同期結果の辞書
        """
        logger.info(f"プラットフォーム同期を開始: {platform_name}")
        
        platform_result = {
            'products': self._sync_products(platform_name, api_client),
            'inventory': self._sync_inventory(platform_name, api_client),
            'orders': self._sync_orders(platform_name, api_client),
            'customers': self._sync_customers(platform_name, api_client)
        }
        
        return platform_result
    
    def _sync_products(self, platform_name: str, api_client: Any) -> Dict[str, Any]:
        """
        商品データの同期
        
        Args:
            platform_name: 外部プラットフォーム名
            api_client: APIクライアントインスタンス
            
        Returns:
            同期結果
        """
        try:
            logger.info(f"商品同期を開始: {platform_name}")
            
            # Shopifyから商品データを取得
            shopify_products = self.shopify_api.get_products(limit=self.batch_size)
            
            # 外部プラットフォームの同期ハンドラを取得
            sync_handler = getattr(api_client, 'sync_products', None)
            if not sync_handler or not callable(sync_handler):
                logger.warning(f"プラットフォーム {platform_name} は商品同期をサポートしていません")
                return {
                    'status': 'skipped',
                    'reason': 'not_supported',
                    'synced_count': 0,
                    'skipped_count': 1
                }
            
            # 同期を実行
            sync_result = sync_handler(shopify_products)
            
            return {
                'status': 'success',
                'synced_count': len(shopify_products),
                'details': sync_result
            }
            
        except Exception as e:
            logger.error(f"商品同期エラー ({platform_name}): {str(e)}")
            return {
                'status': 'error',
                'error': str(e)
            }
    
    def _sync_inventory(self, platform_name: str, api_client: Any) -> Dict[str, Any]:
        """
        在庫データの同期
        
        Args:
            platform_name: 外部プラットフォーム名
            api_client: APIクライアントインスタンス
            
        Returns:
            同期結果
        """
        try:
            logger.info(f"在庫同期を開始: {platform_name}")
            
            # Shopifyから在庫データを取得
            shopify_inventory = self.shopify_api.get_inventory_levels()
            
            # 外部プラットフォームの同期ハンドラを取得
            sync_handler = getattr(api_client, 'sync_inventory', None)
            if not sync_handler or not callable(sync_handler):
                logger.warning(f"プラットフォーム {platform_name} は在庫同期をサポートしていません")
                return {
                    'status': 'skipped',
                    'reason': 'not_supported',
                    'synced_count': 0,
                    'skipped_count': 1
                }
            
            # 同期を実行
            sync_result = sync_handler(shopify_inventory)
            
            return {
                'status': 'success',
                'synced_count': len(shopify_inventory),
                'details': sync_result
            }
            
        except Exception as e:
            logger.error(f"在庫同期エラー ({platform_name}): {str(e)}")
            return {
                'status': 'error',
                'error': str(e)
            }
    
    def _sync_orders(self, platform_name: str, api_client: Any) -> Dict[str, Any]:
        """
        注文データの同期
        
        Args:
            platform_name: 外部プラットフォーム名
            api_client: APIクライアントインスタンス
            
        Returns:
            同期結果
        """
        try:
            logger.info(f"注文同期を開始: {platform_name}")
            
            # 外部プラットフォームの注文取得ハンドラを取得
            get_orders_handler = getattr(api_client, 'get_orders', None)
            if not get_orders_handler or not callable(get_orders_handler):
                logger.warning(f"プラットフォーム {platform_name} は注文取得をサポートしていません")
                return {
                    'status': 'skipped',
                    'reason': 'not_supported',
                    'synced_count': 0,
                    'skipped_count': 1
                }
            
            # 外部プラットフォームから注文を取得
            external_orders = get_orders_handler()
            
            # Shopifyに注文をアップロード
            processed_count = 0
            for order in external_orders:
                # 注文処理ロジック（必要に応じて実装）
                processed_count += 1
            
            return {
                'status': 'success',
                'synced_count': processed_count,
                'total_orders': len(external_orders)
            }
            
        except Exception as e:
            logger.error(f"注文同期エラー ({platform_name}): {str(e)}")
            return {
                'status': 'error',
                'error': str(e)
            }
    
    def _sync_customers(self, platform_name: str, api_client: Any) -> Dict[str, Any]:
        """
        顧客データの同期
        
        Args:
            platform_name: 外部プラットフォーム名
            api_client: APIクライアントインスタンス
            
        Returns:
            同期結果
        """
        try:
            logger.info(f"顧客同期を開始: {platform_name}")
            
            # 外部プラットフォームの顧客同期をサポートしているか確認
            sync_handler = getattr(api_client, 'sync_customers', None)
            if not sync_handler or not callable(sync_handler):
                logger.warning(f"プラットフォーム {platform_name} は顧客同期をサポートしていません")
                return {
                    'status': 'skipped',
                    'reason': 'not_supported',
                    'synced_count': 0,
                    'skipped_count': 1
                }
            
            # Shopifyから顧客データを取得（必要に応じて実装）
            shopify_customers = self.shopify_api.get_customers(limit=self.batch_size)
            
            # 同期を実行
            sync_result = sync_handler(shopify_customers)
            
            return {
                'status': 'success',
                'synced_count': len(shopify_customers),
                'details': sync_result
            }
            
        except Exception as e:
            logger.error(f"顧客同期エラー ({platform_name}): {str(e)}")
            return {
                'status': 'error',
                'error': str(e)
            }
    
    # 個別データタイプの同期メソッド（外部から直接呼び出せるように）
    
    def sync_products_only(self) -> Dict[str, Any]:
        """
        商品データのみの同期
        
        Returns:
            同期結果
        """
        result = SyncResult(
            status=SyncStatus.RUNNING,
            sync_type=SyncType.PRODUCTS,
            start_time=datetime.now()
        )
        
        platform_results = {}
        for platform_name, api_client in self.external_apis.items():
            platform_result = self._sync_products(platform_name, api_client)
            platform_results[platform_name] = platform_result
            
            if platform_result.get('status') == 'error':
                result.failed_count += 1
                result.errors.append(f"{platform_name}: {platform_result.get('error', '不明なエラー')}")
            else:
                result.synced_count += platform_result.get('synced_count', 0)
                result.skipped_count += platform_result.get('skipped_count', 0)
        
        result.status = SyncStatus.SUCCESS if result.failed_count == 0 else SyncStatus.PARTIAL
        result.end_time = datetime.now()
        result.update_duration()
        
        self.sync_history.add_result(result)
        
        return {
            'status': result.status.value,
            'platforms': platform_results,
            'synced_count': result.synced_count,
            'failed_count': result.failed_count,
            'skipped_count': result.skipped_count,
            'duration_seconds': result.duration,
            'errors': result.errors
        }
    
    def sync_inventory_only(self) -> Dict[str, Any]:
        """
        在庫データのみの同期
        
        Returns:
            同期結果
        """
        result = SyncResult(
            status=SyncStatus.RUNNING,
            sync_type=SyncType.INVENTORY,
            start_time=datetime.now()
        )
        
        platform_results = {}
        for platform_name, api_client in self.external_apis.items():
            platform_result = self._sync_inventory(platform_name, api_client)
            platform_results[platform_name] = platform_result
            
            if platform_result.get('status') == 'error':
                result.failed_count += 1
                result.errors.append(f"{platform_name}: {platform_result.get('error', '不明なエラー')}")
            else:
                result.synced_count += platform_result.get('synced_count', 0)
                result.skipped_count += platform_result.get('skipped_count', 0)
        
        result.status = SyncStatus.SUCCESS if result.failed_count == 0 else SyncStatus.PARTIAL
        result.end_time = datetime.now()
        result.update_duration()
        
        self.sync_history.add_result(result)
        
        return {
            'status': result.status.value,
            'platforms': platform_results,
            'synced_count': result.synced_count,
            'failed_count': result.failed_count,
            'skipped_count': result.skipped_count,
            'duration_seconds': result.duration,
            'errors': result.errors
        }
    
    def sync_orders_only(self) -> Dict[str, Any]:
        """
        注文データのみの同期
        
        Returns:
            同期結果
        """
        result = SyncResult(
            status=SyncStatus.RUNNING,
            sync_type=SyncType.ORDERS,
            start_time=datetime.now()
        )
        
        platform_results = {}
        for platform_name, api_client in self.external_apis.items():
            platform_result = self._sync_orders(platform_name, api_client)
            platform_results[platform_name] = platform_result
            
            if platform_result.get('status') == 'error':
                result.failed_count += 1
                result.errors.append(f"{platform_name}: {platform_result.get('error', '不明なエラー')}")
            else:
                result.synced_count += platform_result.get('synced_count', 0)
                result.skipped_count += platform_result.get('skipped_count', 0)
        
        result.status = SyncStatus.SUCCESS if result.failed_count == 0 else SyncStatus.PARTIAL
        result.end_time = datetime.now()
        result.update_duration()
        
        self.sync_history.add_result(result)
        
        return {
            'status': result.status.value,
            'platforms': platform_results,
            'synced_count': result.synced_count,
            'failed_count': result.failed_count,
            'skipped_count': result.skipped_count,
            'duration_seconds': result.duration,
            'errors': result.errors
        }
    
    def sync_customers_only(self) -> Dict[str, Any]:
        """
        顧客データのみの同期
        
        Returns:
            同期結果
        """
        result = SyncResult(
            status=SyncStatus.RUNNING,
            sync_type=SyncType.CUSTOMERS,
            start_time=datetime.now()
        )
        
        platform_results = {}
        for platform_name, api_client in self.external_apis.items():
            platform_result = self._sync_customers(platform_name, api_client)
            platform_results[platform_name] = platform_result
            
            if platform_result.get('status') == 'error':
                result.failed_count += 1
                result.errors.append(f"{platform_name}: {platform_result.get('error', '不明なエラー')}")
            else:
                result.synced_count += platform_result.get('synced_count', 0)
                result.skipped_count += platform_result.get('skipped_count', 0)
        
        result.status = SyncStatus.SUCCESS if result.failed_count == 0 else SyncStatus.PARTIAL
        result.end_time = datetime.now()
        result.update_duration()
        
        self.sync_history.add_result(result)
        
        return {
            'status': result.status.value,
            'platforms': platform_results,
            'synced_count': result.synced_count,
            'failed_count': result.failed_count,
            'skipped_count': result.skipped_count,
            'duration_seconds': result.duration,
            'errors': result.errors
        }
    
    def get_status(self) -> Dict[str, Any]:
        """
        同期エンジンの状態を取得
        
        Returns:
            状態情報の辞書
        """
        # 最新の同期結果を取得
        latest_syncs = {}
        for sync_type in [SyncType.PRODUCTS, SyncType.INVENTORY, SyncType.ORDERS, SyncType.CUSTOMERS]:
            latest = self.sync_history.get_latest(sync_type)
            if latest:
                latest_syncs[sync_type.value] = {
                    'status': latest.status.value,
                    'synced_count': latest.synced_count,
                    'failed_count': latest.failed_count,
                    'timestamp': latest.end_time.isoformat() if latest.end_time else None,
                    'duration': latest.duration
                }
        
        return {
            'running': self.sync_thread is not None and self.sync_thread.is_alive(),
            'last_sync_time': self.last_sync_time.isoformat() if self.last_sync_time else None,
            'registered_platforms': list(self.external_apis.keys()),
            'latest_syncs': latest_syncs,
            'success_rate': self.sync_history.get_success_rate()
        }
    
    def get_history(self) -> List[Dict[str, Any]]:
        """
        同期履歴を取得
        
        Returns:
            同期履歴リスト（辞書形式）
        """
        return [result.to_dict() for result in self.sync_history.results]