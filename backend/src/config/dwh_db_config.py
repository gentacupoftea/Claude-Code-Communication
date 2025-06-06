"""
Data Warehouse Database Configuration
DWH用のデータベース設定
"""

import os
import psycopg2
import psycopg2.extras
from psycopg2 import pool
from contextlib import contextmanager
from typing import Dict, Any, Optional
import logging


class DWHDatabaseConfig:
    """DWH用データベース設定クラス"""
    
    def __init__(self):
        self.logger = logging.getLogger("dwh_db")
        self._connection_pool = None
        
        # 環境変数から設定を読み込み
        self.config = {
            'host': os.getenv('DWH_DB_HOST', 'localhost'),
            'port': int(os.getenv('DWH_DB_PORT', '5432')),
            'database': os.getenv('DWH_DB_NAME', 'conea_dwh'),
            'user': os.getenv('DWH_DB_USER', 'postgres'),
            'password': os.getenv('DWH_DB_PASSWORD', ''),
            'minconn': int(os.getenv('DWH_DB_MIN_CONN', '2')),
            'maxconn': int(os.getenv('DWH_DB_MAX_CONN', '10'))
        }
    
    def initialize_connection_pool(self):
        """接続プールを初期化"""
        if self._connection_pool is None:
            try:
                self._connection_pool = psycopg2.pool.ThreadedConnectionPool(
                    minconn=self.config['minconn'],
                    maxconn=self.config['maxconn'],
                    host=self.config['host'],
                    port=self.config['port'],
                    database=self.config['database'],
                    user=self.config['user'],
                    password=self.config['password'],
                    cursor_factory=psycopg2.extras.RealDictCursor
                )
                self.logger.info("DWH接続プール初期化完了")
            except Exception as e:
                self.logger.error(f"DWH接続プール初期化失敗: {str(e)}")
                raise
    
    @contextmanager
    def get_connection(self):
        """接続プールから接続を取得"""
        if self._connection_pool is None:
            self.initialize_connection_pool()
        
        connection = None
        try:
            connection = self._connection_pool.getconn()
            connection.autocommit = True
            yield connection
        except Exception as e:
            if connection:
                connection.rollback()
            raise
        finally:
            if connection:
                self._connection_pool.putconn(connection)
    
    @contextmanager
    def get_cursor(self, cursor_factory=psycopg2.extras.RealDictCursor):
        """カーソルを取得（トランザクション管理付き）"""
        with self.get_connection() as connection:
            cursor = None
            try:
                cursor = connection.cursor(cursor_factory=cursor_factory)
                yield cursor
                connection.commit()
            except Exception as e:
                if connection:
                    connection.rollback()
                raise
            finally:
                if cursor:
                    cursor.close()
    
    def test_connection(self) -> Dict[str, Any]:
        """接続テスト"""
        try:
            with self.get_cursor() as cursor:
                cursor.execute("SELECT 1 as test, NOW() as current_time")
                result = cursor.fetchone()
                
                return {
                    'success': True,
                    'message': 'DWH接続成功',
                    'server_time': str(result['current_time']) if result else None
                }
        except Exception as e:
            return {
                'success': False,
                'message': 'DWH接続失敗',
                'error': str(e)
            }
    
    def close_connection_pool(self):
        """接続プールを閉じる"""
        if self._connection_pool:
            try:
                self._connection_pool.closeall()
                self._connection_pool = None
                self.logger.info("DWH接続プールを閉じました")
            except Exception as e:
                self.logger.warning(f"接続プールクローズエラー: {str(e)}")


# グローバルインスタンス
_dwh_config_instance = None


def get_dwh_config() -> DWHDatabaseConfig:
    """DWH設定のシングルトンインスタンスを取得"""
    global _dwh_config_instance
    if _dwh_config_instance is None:
        _dwh_config_instance = DWHDatabaseConfig()
    return _dwh_config_instance