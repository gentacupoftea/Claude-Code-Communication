"""
Rakuten Product Model
Handles conversion between Rakuten and common product formats
"""

from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List
from datetime import datetime
from decimal import Decimal

from ...abstract.base_models import BaseProduct, ProductStatus


@dataclass
class RakutenProduct(BaseProduct):
    """
    Rakuten product model
    Maps between Rakuten's product structure and common format
    """
    
    # Rakuten specific fields
    product_number: Optional[str] = None      # 商品管理番号
    product_url: Optional[str] = None         # 商品URL
    catalog_id: Optional[str] = None          # カタログID
    genre_id: Optional[str] = None            # ジャンルID
    
    # 楽天特有の設定
    is_depot: bool = False                    # 倉庫指定
    is_sp_item: bool = False                  # スマホ商品ページ
    limited_number: Optional[int] = None      # 購入可能数
    
    # 配送関連
    shipping_flag: int = 0                    # 送料フラグ
    postage_group_id: Optional[int] = None    # 送料グループID
    individual_postage: Optional[Decimal] = None  # 個別送料
    
    # ポイント関連
    point_rate: int = 1                       # ポイント倍率
    point_rate_start: Optional[datetime] = None
    point_rate_end: Optional[datetime] = None
    
    # 在庫タイプ
    inventory_type: int = 1                   # 在庫タイプ（1:通常, 2:項目選択肢, 3:最新在庫）
    
    # オプション（サイズ、色など）
    options: List[Dict[str, Any]] = field(default_factory=list)
    
    def to_platform_format(self) -> Dict[str, Any]:
        """
        Convert to Rakuten API format
        
        Returns:
            Dictionary in Rakuten's expected format
        """
        data = {
            'product': {
                'productId': self.platform_id,
                'productNumber': self.product_number or self.platform_id,
                'productName': self.title,
                'productDescription': self.description or '',
                'salesPrice': int(self.price) if self.price else 0,
                'catalogId': self.catalog_id,
                'genreId': self.genre_id,
            }
        }
        
        # 在庫情報
        if self.track_inventory:
            data['product']['inventory'] = {
                'inventoryType': self.inventory_type,
                'inventoryCount': self.inventory_quantity or 0,
            }
            
        # 画像
        if self.images:
            data['product']['images'] = []
            for i, img in enumerate(self.images[:20]):  # 楽天は最大20枚
                data['product']['images'].append({
                    'imageUrl': img.get('url'),
                    'imageAlt': img.get('alt', ''),
                    'imageNumber': i + 1
                })
                
        # 配送設定
        data['product']['shipping'] = {
            'shippingFlag': self.shipping_flag,
            'postageGroupId': self.postage_group_id,
            'individualPostage': int(self.individual_postage) if self.individual_postage else None
        }
        
        # ポイント設定
        if self.point_rate > 1:
            data['product']['point'] = {
                'pointRate': self.point_rate,
                'pointRateStart': self.point_rate_start.isoformat() if self.point_rate_start else None,
                'pointRateEnd': self.point_rate_end.isoformat() if self.point_rate_end else None,
            }
            
        # オプション（項目選択肢）
        if self.options:
            data['product']['options'] = self.options
            
        # ステータス
        if self.status == ProductStatus.ACTIVE:
            data['product']['displayFlag'] = 1  # 表示
        else:
            data['product']['displayFlag'] = 0  # 非表示
            
        return data
        
    @classmethod
    def from_platform_format(cls, data: Dict[str, Any]) -> 'RakutenProduct':
        """
        Create from Rakuten API format
        
        Args:
            data: Product data from Rakuten API
            
        Returns:
            RakutenProduct instance
        """
        product_data = data.get('product', data)
        
        # Extract images
        images = []
        if 'images' in product_data:
            for img in product_data['images']:
                images.append({
                    'url': img.get('imageUrl'),
                    'alt': img.get('imageAlt'),
                    'position': img.get('imageNumber', 0)
                })
                
        # Determine status
        display_flag = product_data.get('displayFlag', 1)
        status = ProductStatus.ACTIVE if display_flag == 1 else ProductStatus.INACTIVE
        
        # Create product instance
        product = cls(
            platform_id=product_data.get('productId', ''),
            product_number=product_data.get('productNumber'),
            title=product_data.get('productName', ''),
            description=product_data.get('productDescription'),
            status=status,
            price=Decimal(str(product_data.get('salesPrice', 0))),
            catalog_id=product_data.get('catalogId'),
            genre_id=product_data.get('genreId'),
            images=images
        )
        
        # 在庫情報
        if 'inventory' in product_data:
            inventory = product_data['inventory']
            product.inventory_type = inventory.get('inventoryType', 1)
            product.inventory_quantity = inventory.get('inventoryCount', 0)
            product.track_inventory = product.inventory_type != 3  # 最新在庫以外は追跡
            
        # 配送情報
        if 'shipping' in product_data:
            shipping = product_data['shipping']
            product.shipping_flag = shipping.get('shippingFlag', 0)
            product.postage_group_id = shipping.get('postageGroupId')
            if shipping.get('individualPostage'):
                product.individual_postage = Decimal(str(shipping['individualPostage']))
                
        # ポイント情報
        if 'point' in product_data:
            point = product_data['point']
            product.point_rate = point.get('pointRate', 1)
            if point.get('pointRateStart'):
                product.point_rate_start = datetime.fromisoformat(point['pointRateStart'])
            if point.get('pointRateEnd'):
                product.point_rate_end = datetime.fromisoformat(point['pointRateEnd'])
                
        # オプション
        if 'options' in product_data:
            product.options = product_data['options']
            
        # その他のフィールド
        product.product_url = product_data.get('productUrl')
        product.is_depot = product_data.get('isDepot', False)
        product.is_sp_item = product_data.get('isSpItem', False)
        product.limited_number = product_data.get('limitedNumber')
        
        # 共通フィールド
        product.sku = product_data.get('catalogIdExemptionReason')  # 型番
        product.barcode = product_data.get('jan')
        
        # タイムスタンプ
        if product_data.get('registDate'):
            product.created_at = datetime.fromisoformat(product_data['registDate'])
        if product_data.get('updateDate'):
            product.updated_at = datetime.fromisoformat(product_data['updateDate'])
            
        # 元データを保存
        product.platform_data = data
        
        return product
        
    @classmethod
    def from_common_format(cls, data: Dict[str, Any]) -> 'RakutenProduct':
        """
        Create from common format
        
        Args:
            data: Product data in common format
            
        Returns:
            RakutenProduct instance
        """
        # Map status
        status_map = {
            'active': ProductStatus.ACTIVE,
            'inactive': ProductStatus.INACTIVE,
            'draft': ProductStatus.DRAFT,
            'archived': ProductStatus.ARCHIVED
        }
        status = status_map.get(data.get('status', 'active'), ProductStatus.ACTIVE)
        
        # Create product
        product = cls(
            platform_id=data.get('platform_id', ''),
            title=data.get('title', ''),
            description=data.get('description'),
            status=status,
            sku=data.get('sku'),
            barcode=data.get('barcode'),
            price=Decimal(data.get('price', '0')) if data.get('price') else None,
            inventory_quantity=data.get('inventory_quantity', 0),
            images=data.get('images', [])
        )
        
        # Set Rakuten defaults
        product.product_number = data.get('sku', data.get('platform_id'))
        product.inventory_type = 1  # 通常在庫
        product.shipping_flag = 1   # 送料別
        
        return product
        
    def update_from_common_format(self, data: Dict[str, Any]):
        """Update fields from common format data"""
        if 'title' in data:
            self.title = data['title']
        if 'description' in data:
            self.description = data['description']
        if 'price' in data:
            self.price = Decimal(data['price'])
        if 'inventory_quantity' in data:
            self.inventory_quantity = data['inventory_quantity']
        if 'status' in data:
            status_map = {
                'active': ProductStatus.ACTIVE,
                'inactive': ProductStatus.INACTIVE,
                'draft': ProductStatus.DRAFT,
                'archived': ProductStatus.ARCHIVED
            }
            self.status = status_map.get(data['status'], self.status)
        if 'images' in data:
            self.images = data['images']