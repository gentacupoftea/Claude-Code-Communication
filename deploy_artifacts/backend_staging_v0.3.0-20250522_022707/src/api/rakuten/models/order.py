"""
Rakuten Order Model
Handles conversion between Rakuten and common order formats
"""

from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List
from datetime import datetime
from decimal import Decimal

from ...abstract.base_models import BaseOrder, BaseLineItem, BaseAddress, OrderStatus, PaymentStatus


@dataclass
class RakutenOrderItem(BaseLineItem):
    """Rakuten specific order item"""
    item_id: Optional[str] = None              # 商品項目ID
    item_number: Optional[str] = None          # 商品番号
    product_name: Optional[str] = None         # 商品名
    option_name: Optional[str] = None          # 項目選択肢名
    option_value: Optional[str] = None         # 項目選択肢値
    point_rate: int = 1                        # ポイント倍率
    tax_rate: Decimal = Decimal('0.10')        # 税率
    
    @classmethod
    def from_rakuten_format(cls, data: Dict[str, Any]) -> 'RakutenOrderItem':
        """Create from Rakuten format"""
        return cls(
            item_id=data.get('itemId'),
            product_id=data.get('productId', ''),
            item_number=data.get('itemNumber'),
            product_name=data.get('productName', ''),
            title=data.get('productName', ''),
            quantity=data.get('quantity', 1),
            price=Decimal(str(data.get('price', 0))),
            option_name=data.get('optionName'),
            option_value=data.get('optionValue'),
            point_rate=data.get('pointRate', 1),
            tax_rate=Decimal(str(data.get('taxRate', 0.10)))
        )
    
    def to_rakuten_format(self) -> Dict[str, Any]:
        """Convert to Rakuten format"""
        return {
            'itemId': self.item_id,
            'productId': self.product_id,
            'itemNumber': self.item_number,
            'productName': self.product_name or self.title,
            'quantity': self.quantity,
            'price': int(self.price),
            'optionName': self.option_name,
            'optionValue': self.option_value,
            'pointRate': self.point_rate,
            'taxRate': float(self.tax_rate)
        }


@dataclass
class RakutenAddress(BaseAddress):
    """Rakuten specific address"""
    full_name: Optional[str] = None           # フルネーム
    full_name_kana: Optional[str] = None      # フルネームカナ
    prefecture_code: Optional[str] = None     # 都道府県コード
    
    @classmethod
    def from_rakuten_format(cls, data: Dict[str, Any]) -> 'RakutenAddress':
        """Create from Rakuten format"""
        return cls(
            full_name=data.get('fullName'),
            full_name_kana=data.get('fullNameKana'),
            last_name=data.get('lastName'),
            first_name=data.get('firstName'),
            zip=data.get('zipCode'),
            prefecture_code=data.get('prefectureCode'),
            province=data.get('prefecture'),
            city=data.get('city'),
            address1=data.get('address1'),
            address2=data.get('address2'),
            company=data.get('companyName'),
            phone=data.get('phoneNumber')
        )
    
    def to_rakuten_format(self) -> Dict[str, Any]:
        """Convert to Rakuten format"""
        return {
            'fullName': self.full_name or f"{self.last_name} {self.first_name}",
            'fullNameKana': self.full_name_kana,
            'lastName': self.last_name,
            'firstName': self.first_name,
            'zipCode': self.zip,
            'prefectureCode': self.prefecture_code,
            'prefecture': self.province,
            'city': self.city,
            'address1': self.address1,
            'address2': self.address2,
            'companyName': self.company,
            'phoneNumber': self.phone
        }


@dataclass
class RakutenOrder(BaseOrder):
    """
    Rakuten order model
    Maps between Rakuten's order structure and common format
    """
    
    # 楽天特有フィールド
    order_type: int = 1                       # 注文タイプ
    device_type: int = 0                      # デバイスタイプ (0:PC, 1:モバイル)
    carrier_code: Optional[str] = None        # 配送業者コード
    delivery_date: Optional[datetime] = None  # お届け希望日
    delivery_time_zone: Optional[str] = None  # お届け時間帯
    
    # 決済関連
    payment_method: Optional[str] = None      # 決済方法
    payment_date: Optional[datetime] = None   # 決済日時
    card_type: Optional[str] = None          # カードタイプ
    
    # ポイント関連
    use_point: int = 0                       # 利用ポイント
    grant_point: int = 0                     # 付与ポイント
    
    # 楽天特有ステータス
    rakuten_status: int = 100                # 楽天注文ステータス
    confirm_flag: int = 0                    # 確認フラグ
    
    # 送付先情報
    is_gift: bool = False                    # ギフト配送
    gift_message: Optional[str] = None       # ギフトメッセージ
    wrapping_type: Optional[str] = None      # ラッピングタイプ
    
    # クーポン
    coupon_discount: Decimal = Decimal('0')
    coupon_code: Optional[str] = None
    
    def to_platform_format(self) -> Dict[str, Any]:
        """Convert to Rakuten API format"""
        data = {
            'order': {
                'orderNumber': self.platform_id,
                'orderType': self.order_type,
                'orderStatus': self.rakuten_status,
                'orderDate': self.created_at.isoformat() if self.created_at else None,
                'confirmFlag': self.confirm_flag,
                'deviceType': self.device_type,
            }
        }
        
        # 金額情報
        data['order']['amount'] = {
            'subtotal': int(self.subtotal),
            'tax': int(self.tax_total),
            'shippingCharge': int(self.shipping_total),
            'discount': int(self.discount_total),
            'couponDiscount': int(self.coupon_discount),
            'usePoint': self.use_point,
            'total': int(self.total)
        }
        
        # 配送先住所
        if self.shipping_address:
            addr = self.shipping_address
            if isinstance(addr, RakutenAddress):
                data['order']['shippingAddress'] = addr.to_rakuten_format()
            else:
                data['order']['shippingAddress'] = addr.to_dict()
                
        # 請求先住所
        if self.billing_address:
            addr = self.billing_address
            if isinstance(addr, RakutenAddress):
                data['order']['billingAddress'] = addr.to_rakuten_format()
            else:
                data['order']['billingAddress'] = addr.to_dict()
                
        # 配送情報
        data['order']['shipping'] = {
            'carrierCode': self.carrier_code,
            'deliveryDate': self.delivery_date.isoformat() if self.delivery_date else None,
            'deliveryTimeZone': self.delivery_time_zone,
            'trackingNumber': self.tracking_number
        }
        
        # 決済情報
        data['order']['payment'] = {
            'paymentMethod': self.payment_method,
            'paymentDate': self.payment_date.isoformat() if self.payment_date else None,
            'cardType': self.card_type
        }
        
        # ポイント情報
        data['order']['point'] = {
            'usePoint': self.use_point,
            'grantPoint': self.grant_point
        }
        
        # 商品明細
        data['order']['items'] = []
        for item in self.line_items:
            if isinstance(item, RakutenOrderItem):
                data['order']['items'].append(item.to_rakuten_format())
            else:
                # Convert standard line item
                data['order']['items'].append({
                    'productId': item.product_id,
                    'productName': item.title,
                    'quantity': item.quantity,
                    'price': int(item.price)
                })
                
        # ギフト情報
        if self.is_gift:
            data['order']['gift'] = {
                'isGift': self.is_gift,
                'giftMessage': self.gift_message,
                'wrappingType': self.wrapping_type
            }
            
        # メモ
        data['order']['memo'] = {
            'customerNote': self.customer_note,
            'shopNote': self.internal_note
        }
        
        return data
        
    @classmethod
    def from_platform_format(cls, data: Dict[str, Any]) -> 'RakutenOrder':
        """Create from Rakuten API format"""
        order_data = data.get('order', data)
        
        # Map Rakuten status to common status
        rakuten_status = order_data.get('orderStatus', 100)
        status = cls._map_rakuten_status(rakuten_status)
        
        # Create order instance
        order = cls(
            platform_id=order_data.get('orderNumber', ''),
            order_number=order_data.get('orderNumber', ''),
            status=status,
            rakuten_status=rakuten_status,
            order_type=order_data.get('orderType', 1),
            device_type=order_data.get('deviceType', 0),
            confirm_flag=order_data.get('confirmFlag', 0)
        )
        
        # 金額情報
        if 'amount' in order_data:
            amount = order_data['amount']
            order.subtotal = Decimal(str(amount.get('subtotal', 0)))
            order.tax_total = Decimal(str(amount.get('tax', 0)))
            order.shipping_total = Decimal(str(amount.get('shippingCharge', 0)))
            order.discount_total = Decimal(str(amount.get('discount', 0)))
            order.coupon_discount = Decimal(str(amount.get('couponDiscount', 0)))
            order.use_point = amount.get('usePoint', 0)
            order.total = Decimal(str(amount.get('total', 0)))
            
        # 住所情報
        if 'shippingAddress' in order_data:
            order.shipping_address = RakutenAddress.from_rakuten_format(order_data['shippingAddress'])
        if 'billingAddress' in order_data:
            order.billing_address = RakutenAddress.from_rakuten_format(order_data['billingAddress'])
            
        # 配送情報
        if 'shipping' in order_data:
            shipping = order_data['shipping']
            order.carrier_code = shipping.get('carrierCode')
            order.tracking_number = shipping.get('trackingNumber')
            if shipping.get('deliveryDate'):
                order.delivery_date = datetime.fromisoformat(shipping['deliveryDate'])
            order.delivery_time_zone = shipping.get('deliveryTimeZone')
            
        # 決済情報
        if 'payment' in order_data:
            payment = order_data['payment']
            order.payment_method = payment.get('paymentMethod')
            if payment.get('paymentDate'):
                order.payment_date = datetime.fromisoformat(payment['paymentDate'])
            order.card_type = payment.get('cardType')
            order.payment_status = PaymentStatus.PAID if order.payment_date else PaymentStatus.PENDING
            
        # ポイント情報
        if 'point' in order_data:
            point = order_data['point']
            order.use_point = point.get('usePoint', 0)
            order.grant_point = point.get('grantPoint', 0)
            
        # 商品明細
        if 'items' in order_data:
            order.line_items = []
            for item_data in order_data['items']:
                item = RakutenOrderItem.from_rakuten_format(item_data)
                order.line_items.append(item)
                
        # ギフト情報
        if 'gift' in order_data:
            gift = order_data['gift']
            order.is_gift = gift.get('isGift', False)
            order.gift_message = gift.get('giftMessage')
            order.wrapping_type = gift.get('wrappingType')
            
        # メモ
        if 'memo' in order_data:
            memo = order_data['memo']
            order.customer_note = memo.get('customerNote')
            order.internal_note = memo.get('shopNote')
            
        # タイムスタンプ
        if order_data.get('orderDate'):
            order.created_at = datetime.fromisoformat(order_data['orderDate'])
        if order_data.get('updateDate'):
            order.updated_at = datetime.fromisoformat(order_data['updateDate'])
            
        # 顧客情報
        order.customer_id = order_data.get('customerId')
        order.email = order_data.get('email')
        
        # 元データを保存
        order.platform_data = data
        
        return order
        
    @classmethod
    def _map_rakuten_status(cls, rakuten_status: int) -> OrderStatus:
        """Map Rakuten status code to common status"""
        status_map = {
            100: OrderStatus.PENDING,      # 注文確認待ち
            200: OrderStatus.PROCESSING,   # 楽天処理中
            300: OrderStatus.PROCESSING,   # 発送待ち
            400: OrderStatus.SHIPPED,      # 発送済み
            500: OrderStatus.DELIVERED,    # 配達完了
            600: OrderStatus.CANCELLED,    # キャンセル
            700: OrderStatus.REFUNDED,     # 返金
            800: OrderStatus.CANCELLED,    # 審査NG
            900: OrderStatus.COMPLETED,    # 完了
        }
        return status_map.get(rakuten_status, OrderStatus.PENDING)
        
    @classmethod
    def from_common_format(cls, data: Dict[str, Any]) -> 'RakutenOrder':
        """Create from common format"""
        # Map common status to Rakuten status
        status_map = {
            'pending': 100,
            'processing': 300,
            'shipped': 400,
            'delivered': 500,
            'cancelled': 600,
            'refunded': 700,
            'completed': 900
        }
        
        status = OrderStatus[data.get('status', 'pending').upper()]
        rakuten_status = status_map.get(data.get('status', 'pending'), 100)
        
        order = cls(
            platform_id=data.get('platform_id', ''),
            order_number=data.get('order_number', ''),
            status=status,
            rakuten_status=rakuten_status,
            customer_id=data.get('customer_id'),
            email=data.get('email'),
            customer_note=data.get('customer_note'),
            internal_note=data.get('internal_note')
        )
        
        # Set amounts
        order.subtotal = Decimal(data.get('subtotal', '0'))
        order.tax_total = Decimal(data.get('tax_total', '0'))
        order.shipping_total = Decimal(data.get('shipping_total', '0'))
        order.discount_total = Decimal(data.get('discount_total', '0'))
        order.total = Decimal(data.get('total', '0'))
        
        # Line items
        if 'line_items' in data:
            order.line_items = []
            for item_data in data['line_items']:
                item = BaseLineItem(
                    product_id=item_data.get('product_id', ''),
                    title=item_data.get('title', ''),
                    quantity=item_data.get('quantity', 1),
                    price=Decimal(item_data.get('price', '0'))
                )
                order.line_items.append(item)
                
        return order