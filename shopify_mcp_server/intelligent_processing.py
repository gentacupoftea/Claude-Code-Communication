"""
インテリジェント中間処理機能モジュール

このモジュールは、ユーザープロンプトの意図を解析し、
AIへのレスポンスを最適化する中間処理レイヤーを提供します。
"""

import re
import json
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Union
import sys
import os

# Add the src directory to the path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))

try:
    from shopify.client import ShopifyClient
    from shopify.models import ShopifyStoreConnection
    from cache.cache_manager import CacheManager
except ImportError as e:
    logging.warning(f"Could not import Shopify modules: {e}. Will use mock data only.")

# ロガーのセットアップ
logger = logging.getLogger(__name__)

class IntentAnalyzer:
    """ユーザープロンプトから意図を抽出するクラス"""
    
    def __init__(self):
        """インテントアナライザーの初期化"""
        # 基本的な時間表現パターン
        self.time_patterns = {
            "今日": "today",
            "昨日": "yesterday",
            "先週": "last_week",
            "先月": "last_month",
            "今年": "this_year",
            "昨年": "last_year",
            "(\d+)日前": "days_ago_{}",
            "(\d+)週間前": "weeks_ago_{}",
            "(\d+)ヶ月前": "months_ago_{}",
            "(\d+)年前": "years_ago_{}"
        }
        
        # 基本的な分析タイプパターン
        self.analysis_patterns = {
            "売上": "sales",
            "収益": "revenue",
            "在庫": "inventory",
            "顧客": "customer",
            "トレンド": "trend",
            "比較": "comparison",
            "予測": "forecast"
        }
        
        # 基本的なプラットフォームパターン
        self.platform_patterns = {
            "shopify": "shopify",
            "楽天": "rakuten",
            "amazon": "amazon",
            "全て": "all",
            "すべて": "all"
        }
    
    def analyze(self, prompt: str, context: Dict = None) -> Dict[str, Any]:
        """
        プロンプトから意図を抽出する
        
        Args:
            prompt: ユーザープロンプト文字列
            context: 過去の会話コンテキスト（オプショナル）
            
        Returns:
            意図オブジェクト（データリクエスト、期間、プラットフォーム等）
        """
        """
        プロンプトから意図を抽出する
        
        Args:
            prompt: ユーザープロンプト文字列
            context: 過去の会話コンテキスト（オプショナル）
            
        Returns:
            意図オブジェクト（データリクエスト、期間、プラットフォーム等）
        """
        # 基本的な意図オブジェクトの初期化
        intent = {
            "data_request": True,
            "analysis_request": False,
            "forecast_request": False,
            "action_request": False,
            "time_period": "recent",
            "platforms": [],
            "analysis_type": [],
            "language": "ja",
            "raw_prompt": prompt
        }
        
        try:
            # 実装予定: 高度なNLPベースの意図分析
            # 現段階では簡易的なパターンマッチングを使用
        
        # 時間表現の抽出
        for pattern, value in self.time_patterns.items():
            match = re.search(pattern, prompt)
            if match:
                if len(match.groups()) > 0:
                    # 数値を含むパターンの場合
                    number = match.group(1)
                    intent["time_period"] = value.format(number)
                else:
                    intent["time_period"] = value
        
        # 分析タイプの抽出
        for pattern, value in self.analysis_patterns.items():
            if pattern in prompt:
                intent["analysis_type"].append(value)
                intent["analysis_request"] = True
        
        # プラットフォームの抽出
        for pattern, value in self.platform_patterns.items():
            if pattern in prompt:
                intent["platforms"].append(value)
        
        # デフォルトプラットフォームが指定されていない場合
        if not intent["platforms"]:
            intent["platforms"] = ["all"]
        
        # 特定のキーワードに基づく意図分類
        if any(word in prompt for word in ["予測", "今後", "将来"]):
            intent["forecast_request"] = True
        
        if any(word in prompt for word in ["実行", "設定", "更新", "変更"]):
            intent["action_request"] = True
        
            logger.debug(f"抽出された意図: {intent}")
            
            # 結果の検証
            if not intent.get("analysis_type") and not intent.get("platforms"):
                # 最低限のデフォルト値を設定
                intent["confidence"] = 0.5
                intent.setdefault("analysis_type", ["sales"])  # デフォルト分析タイプ
                intent.setdefault("fallback", True)  # フォールバックフラグ
            else:
                intent["confidence"] = 0.8
                
            return intent
            
        except Exception as e:
            # エラーログ記録
            logger.error(f"Intent analysis error: {str(e)}")
            
            # フォールバック値を返す
            return {
                "data_request": True,
                "analysis_request": False, 
                "time_period": "recent",
                "platforms": ["all"],
                "analysis_type": ["sales"],
                "confidence": 0.3,
                "error": str(e),
                "fallback": True
            }


class DataProcessor:
    """抽出された意図に基づきデータを処理するクラス"""
    
    def __init__(self, data_sources: Dict = None):
        """
        データプロセッサーの初期化
        
        Args:
            data_sources: 利用可能なデータソース設定
        """
        self.data_sources = data_sources or {}
        self.shopify_client = None
        self.cache_manager = None
        self._initialized = False
        
    async def initialize(self):
        """非同期初期化"""
        if self._initialized:
            return
            
        try:
            # キャッシュマネージャーの初期化
            self.cache_manager = CacheManager()
            await self.cache_manager.initialize()
            
            # Shopifyクライアントの初期化（設定がある場合）
            shopify_config = self.data_sources.get('shopify')
            if shopify_config:
                store_connection = ShopifyStoreConnection(
                    store_id=shopify_config.get('store_id'),
                    shop_domain=shopify_config.get('shop_domain'),
                    access_token=shopify_config.get('access_token')
                )
                self.shopify_client = ShopifyClient(
                    store_connection=store_connection,
                    cache_manager=self.cache_manager
                )
                logger.info("Shopify client initialized")
            
            self._initialized = True
            
        except Exception as e:
            logger.warning(f"Failed to initialize data processor: {e}. Using mock data only.")
    
    async def process(self, intent: Dict[str, Any], platforms: List[str] = None) -> Dict[str, Any]:
        """
        データを処理する（非同期版）
        
        Args:
            intent: 抽出された意図
            platforms: 処理対象のプラットフォーム（指定がなければintentから取得）
            
        Returns:
            処理されたデータ
        """
        # 初期化確認
        if not self._initialized:
            await self.initialize()
            
        # 使用するプラットフォームの決定
        platforms = platforms or intent.get("platforms", ["all"])
        
        # データ取得と処理
        processed_data = {
            "metadata": {
                "intent": intent,
                "timestamp": datetime.utcnow().isoformat(),
                "platforms": platforms,
                "data_points": 0
            },
            "data": {},
            "summary": {},
            "source": "real_data" if self.shopify_client else "mock_data"
        }
        
        # プラットフォームごとのデータ取得
        for platform in platforms:
            if platform == "all":
                # すべてのプラットフォームのデータを統合
                if self.shopify_client:
                    processed_data["data"] = await self._get_real_data_all_platforms(intent)
                else:
                    processed_data["data"] = self._get_mock_data_all_platforms(intent)
                break
            else:
                # 特定のプラットフォームのデータ
                if platform == "shopify" and self.shopify_client:
                    platform_data = await self._get_real_shopify_data(intent)
                else:
                    platform_data = self._get_mock_data_for_platform(platform, intent)
                processed_data["data"][platform] = platform_data
        
        # データポイント数の更新
        processed_data["metadata"]["data_points"] = self._count_data_points(processed_data["data"])
        
        return processed_data
    
    async def _get_real_data_all_platforms(self, intent: Dict[str, Any]) -> Dict[str, Any]:
        """全プラットフォームの実データを取得"""
        try:
            data = {}
            
            # Shopifyデータの取得
            if self.shopify_client:
                data["shopify"] = await self._get_real_shopify_data(intent)
            
            # 他のプラットフォームはモックデータで補完
            # 楽天、Amazon等の実装は後で追加
            data["rakuten"] = self._get_mock_data_for_platform("rakuten", intent)
            data["amazon"] = self._get_mock_data_for_platform("amazon", intent)
            
            return data
            
        except Exception as e:
            logger.error(f"Error fetching real data: {e}")
            # エラー時はモックデータにフォールバック
            return self._get_mock_data_all_platforms(intent)
    
    async def _get_real_shopify_data(self, intent: Dict[str, Any]) -> Dict[str, Any]:
        """Shopifyから実データを取得"""
        if not self.shopify_client:
            return self._get_mock_data_for_platform("shopify", intent)
            
        try:
            data = {
                "platform": "shopify",
                "timestamp": datetime.utcnow().isoformat(),
                "products": [],
                "orders": [],
                "customers": [],
                "summary": {}
            }
            
            # 意図に基づいてデータ取得
            analysis_type = intent.get("analysis_type", "sales")
            time_period = intent.get("time_period", "today")
            
            # 商品データの取得
            if analysis_type in ["sales", "inventory", "products"]:
                products_response = await self.shopify_client.get_products(limit=50)
                for product in products_response.items:
                    data["products"].append({
                        "id": product.id,
                        "title": product.title,
                        "vendor": product.vendor,
                        "product_type": product.product_type,
                        "created_at": product.created_at,
                        "updated_at": product.updated_at,
                        "published_at": product.published_at,
                        "variants": len(product.variants) if product.variants else 0,
                        "tags": product.tags
                    })
            
            # 注文データの取得
            if analysis_type in ["sales", "revenue", "orders"]:
                # 時間範囲の設定
                end_date = datetime.utcnow()
                if time_period == "today":
                    start_date = end_date.replace(hour=0, minute=0, second=0, microsecond=0)
                elif time_period == "yesterday":
                    start_date = end_date - timedelta(days=1)
                    start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
                    end_date = start_date + timedelta(days=1)
                elif time_period == "last_week":
                    start_date = end_date - timedelta(days=7)
                else:
                    start_date = end_date - timedelta(days=30)  # デフォルト30日
                
                orders_response = await self.shopify_client.get_orders(
                    limit=100,
                    created_at_min=start_date,
                    created_at_max=end_date,
                    status="any"
                )
                
                total_sales = 0
                order_count = 0
                
                for order in orders_response.items:
                    order_data = {
                        "id": order.id,
                        "order_number": order.order_number,
                        "created_at": order.created_at,
                        "total_price": float(order.total_price),
                        "currency": order.currency,
                        "financial_status": order.financial_status,
                        "fulfillment_status": order.fulfillment_status,
                        "customer_id": order.customer.id if order.customer else None,
                        "line_items_count": len(order.line_items) if order.line_items else 0
                    }
                    data["orders"].append(order_data)
                    total_sales += float(order.total_price)
                    order_count += 1
                
                # サマリー情報の計算
                data["summary"] = {
                    "total_sales": total_sales,
                    "order_count": order_count,
                    "average_order_value": total_sales / order_count if order_count > 0 else 0,
                    "period": time_period,
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat()
                }
            
            # 顧客データの取得
            if analysis_type in ["customer", "customers"]:
                customers_response = await self.shopify_client.get_customers(limit=50)
                for customer in customers_response.items:
                    data["customers"].append({
                        "id": customer.id,
                        "email": customer.email,
                        "first_name": customer.first_name,
                        "last_name": customer.last_name,
                        "created_at": customer.created_at,
                        "updated_at": customer.updated_at,
                        "orders_count": customer.orders_count,
                        "total_spent": float(customer.total_spent) if customer.total_spent else 0
                    })
            
            logger.info(f"Successfully fetched Shopify data: {len(data['products'])} products, {len(data['orders'])} orders, {len(data['customers'])} customers")
            return data
            
        except Exception as e:
            logger.error(f"Error fetching Shopify data: {e}")
            # エラー時はモックデータにフォールバック
            return self._get_mock_data_for_platform("shopify", intent)
    
    def _get_mock_data_for_platform(self, platform: str, intent: Dict[str, Any]) -> Dict[str, Any]:
        """特定のプラットフォーム用のモックデータを生成（開発用）"""
        # TODO: 実際のデータソースとの連携実装
        if "sales" in intent.get("analysis_type", []):
            return {
                "daily_sales": [
                    {"date": "2025-05-01", "amount": 12500},
                    {"date": "2025-05-02", "amount": 13200},
                    {"date": "2025-05-03", "amount": 11800}
                ],
                "top_products": [
                    {"name": "商品A", "sales": 5200},
                    {"name": "商品B", "sales": 3800},
                    {"name": "商品C", "sales": 2700}
                ]
            }
        elif "inventory" in intent.get("analysis_type", []):
            return {
                "low_stock_items": [
                    {"name": "商品X", "current_stock": 5, "reorder_level": 10},
                    {"name": "商品Y", "current_stock": 3, "reorder_level": 15}
                ],
                "overstock_items": [
                    {"name": "商品Z", "current_stock": 120, "reorder_level": 30}
                ]
            }
        else:
            return {"message": "特定のデータタイプが指定されていません"}
    
    def _get_mock_data_all_platforms(self, intent: Dict[str, Any]) -> Dict[str, Any]:
        """全プラットフォームの統合モックデータを生成（開発用）"""
        # 実装予定: 実際の複数プラットフォームデータの統合ロジック
        return {
            "shopify": self._get_mock_data_for_platform("shopify", intent),
            "rakuten": self._get_mock_data_for_platform("rakuten", intent),
            "amazon": self._get_mock_data_for_platform("amazon", intent)
        }
    
    def _count_data_points(self, data: Dict[str, Any]) -> int:
        """データポイント数をカウント"""
        # 実装予定: 実際のデータ構造に応じたカウントロジック
        return 42  # プレースホルダー値


class DataSummarizer:
    """データを要約するクラス"""
    
    def __init__(self):
        """データサマライザーの初期化"""
        pass
    
    def summarize(self, data: Dict[str, Any], intent: Dict[str, Any]) -> Dict[str, Any]:
        """
        データを要約し、インサイトを抽出する
        
        Args:
            data: 処理済みデータ
            intent: ユーザー意図
            
        Returns:
            要約とインサイトを含むオブジェクト
        """
        # データ要約の基本構造
        summary = {
            "key_metrics": {},
            "insights": [],
            "trends": [],
            "recommendations": []
        }
        
        # 実装予定: 高度なデータ分析と要約ロジック
        # 現段階ではシンプルなモックデータを返す
        
        # 分析タイプに基づく要約の生成
        if "sales" in intent.get("analysis_type", []):
            summary["key_metrics"] = {
                "total_sales": 546000,
                "average_daily_sales": 18200,
                "growth_rate": 0.12
            }
            summary["insights"] = [
                "前年同期比で売上が12%増加しています",
                "週末の売上が平日より32%高くなっています",
                "商品Aが全体売上の28%を占めています"
            ]
        elif "inventory" in intent.get("analysis_type", []):
            summary["key_metrics"] = {
                "total_items": 1250,
                "low_stock_items": 23,
                "overstock_items": 15
            }
            summary["insights"] = [
                "23品目が在庫不足の危険性があります",
                "15品目が過剰在庫状態です",
                "平均在庫回転率は月4.2回です"
            ]
        
        # 一般的なトレンドとレコメンデーション
        summary["trends"] = [
            "週末の注文増加傾向が継続しています",
            "新規顧客獲得率が徐々に向上しています"
        ]
        
        summary["recommendations"] = [
            "在庫不足品目の発注を検討してください",
            "過剰在庫品の販促キャンペーンを検討してください"
        ]
        
        return summary


class ResponseOptimizer:
    """応答を最適化するクラス"""
    
    def __init__(self):
        """レスポンスオプティマイザーの初期化"""
        pass
    
    def optimize(self, 
                data: Dict[str, Any], 
                summary: Dict[str, Any],
                intent: Dict[str, Any], 
                max_size: int = 50000) -> Dict[str, Any]:
        """
        データサイズと品質のバランスを取る
        
        Args:
            data: 処理済み元データ
            summary: 要約データ
            intent: ユーザー意図
            max_size: 最大応答サイズ
            
        Returns:
            最適化されたデータ
        """
        # 基本的な最適化済み応答の構造
        optimized = {
            "content": "",
            "charts": [],
            "tables": [],
            "metadata": {
                "original_size": 0,
                "optimized_size": 0,
                "truncated": False
            }
        }
        
        # 実装予定: 高度な応答最適化ロジック
        # 現段階ではシンプルなモックデータを返す
        
        # データと要約に基づいた応答コンテンツの構築
        content_parts = []
        
        # 主要メトリクスの追加
        if summary.get("key_metrics"):
            metrics = summary["key_metrics"]
            metrics_content = "## 主要指標\n\n"
            for key, value in metrics.items():
                metrics_content += f"- **{self._format_key(key)}**: {self._format_value(value)}\n"
            content_parts.append(metrics_content)
        
        # インサイトの追加
        if summary.get("insights"):
            insights_content = "## 重要なインサイト\n\n"
            for insight in summary["insights"]:
                insights_content += f"- {insight}\n"
            content_parts.append(insights_content)
        
        # トレンドの追加
        if summary.get("trends"):
            trends_content = "## 検出されたトレンド\n\n"
            for trend in summary["trends"]:
                trends_content += f"- {trend}\n"
            content_parts.append(trends_content)
        
        # レコメンデーションの追加
        if summary.get("recommendations"):
            recommendations_content = "## 推奨アクション\n\n"
            for recommendation in summary["recommendations"]:
                recommendations_content += f"- {recommendation}\n"
            content_parts.append(recommendations_content)
        
        # 全コンテンツの結合
        optimized["content"] = "\n\n".join(content_parts)
        
        # サイズ検証とトリミング
        original_size = len(json.dumps(data))
        optimized_size = len(optimized["content"])
        
        optimized["metadata"]["original_size"] = original_size
        optimized["metadata"]["optimized_size"] = optimized_size
        
        # サイズ制限を超えた場合のトリミング
        if optimized_size > max_size:
            # 実装予定: より洗練された内容トリミングロジック
            optimized["content"] = optimized["content"][:max_size]
            optimized["metadata"]["truncated"] = True
        
        # チャートとテーブルのモックデータ
        optimized["charts"] = [
            {
                "type": "line",
                "title": "月間売上トレンド",
                "data": {"labels": ["1月", "2月", "3月"], "values": [120, 150, 180]}
            }
        ]
        
        optimized["tables"] = [
            {
                "title": "トップ製品カテゴリ",
                "headers": ["カテゴリ", "売上", "成長率"],
                "rows": [
                    ["電子機器", "¥1,200,000", "+12%"],
                    ["ファッション", "¥980,000", "+8%"],
                    ["家具", "¥750,000", "+15%"]
                ]
            }
        ]
        
        return optimized
    
    def _format_key(self, key: str) -> str:
        """キー名をフォーマット"""
        # キャメルケースやスネークケースを人間が読みやすい形式に変換
        return key.replace("_", " ").title()
    
    def _format_value(self, value: Union[int, float, str]) -> str:
        """値を適切にフォーマット"""
        if isinstance(value, float):
            # パーセンテージの場合
            if 0 <= value <= 1:
                return f"{value:.1%}"
            return f"{value:,.1f}"
        elif isinstance(value, int):
            # 大きな数値の場合
            return f"{value:,}"
        return str(value)


class IntelligentProcessor:
    """インテリジェント処理のメインクラス"""
    
    def __init__(self, language: str = "ja"):
        """
        すべてのコンポーネントを初期化
        
        Args:
            language: 使用する言語コード ("ja", "en", etc.)
        """
        self.language = language
        self.intent_analyzer = IntentAnalyzer()
        self.data_processor = DataProcessor()
        self.data_summarizer = DataSummarizer()
        self.response_optimizer = ResponseOptimizer()
    
    def process(self, prompt: str, context: Dict = None, max_size: int = 50000) -> Dict[str, Any]:
        """
        プロンプトを処理してインテリジェントな応答を生成
        
        Args:
            prompt: ユーザープロンプト
            context: コンテキスト情報（オプショナル）
            max_size: 最大応答サイズ
            
        Returns:
            最適化された応答
        """
        # 1. 意図分析
        intent = self.intent_analyzer.analyze(prompt, context)
        
        # 2. データ処理
        processed_data = self.data_processor.process(intent)
        
        # 3. データ要約
        summary = self.data_summarizer.summarize(processed_data, intent)
        
        # 4. 応答最適化
        optimized_response = self.response_optimizer.optimize(
            processed_data, summary, intent, max_size
        )
        
        return optimized_response


# 使用例
if __name__ == "__main__":
    processor = IntelligentProcessor()
    result = processor.process("先月の全プラットフォームの売上を分析して、特に成長している製品カテゴリを教えて")
    print(json.dumps(result, indent=2, ensure_ascii=False))