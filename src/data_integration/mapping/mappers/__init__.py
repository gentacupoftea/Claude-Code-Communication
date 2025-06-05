"""
データソース別マッパークラス
各データソースに特化したマッピング処理を提供
"""

from .shopify_mapper import ShopifyMapper
from .amazon_mapper import AmazonMapper
from .rakuten_mapper import RakutenMapper
from .nextengine_mapper import NextEngineMapper
from .file_mapper import FileDataMapper
from .google_sheets_mapper import GoogleSheetsMapper

__all__ = [
    'ShopifyMapper',
    'AmazonMapper',
    'RakutenMapper', 
    'NextEngineMapper',
    'FileDataMapper',
    'GoogleSheetsMapper'
]