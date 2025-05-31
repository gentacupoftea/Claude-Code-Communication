"""
Rakuten Customer Model
Handles conversion between Rakuten and common customer formats
"""

from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List
from datetime import datetime

from ...abstract.base_models import BaseCustomer, BaseAddress


@dataclass
class RakutenCustomer(BaseCustomer):
    """
    Rakuten customer model
    Maps between Rakuten's member structure and common format
    """
    
    # 楽天特有フィールド
    member_id: Optional[str] = None           # 楽天会員ID
    nickname: Optional[str] = None            # ニックネーム
    sex: Optional[str] = None                 # 性別 (M/F)
    birth_date: Optional[datetime] = None     # 生年月日
    
    # 会員ランク
    member_rank: Optional[str] = None         # 会員ランク
    point_balance: int = 0                    # ポイント残高
    
    # メール設定
    mail_magazine_type: int = 0               # メルマガ配信設定
    html_mail_flag: bool = False              # HTMLメール配信フラグ
    
    # 住所（楽天形式）
    rakuten_addresses: List[Dict[str, Any]] = field(default_factory=list)
    
    # 購入履歴サマリー
    order_count: int = 0                      # 注文回数
    order_total: int = 0                      # 購入金額合計
    last_order_date: Optional[datetime] = None # 最終購入日
    
    # 楽天ペイ情報
    rakuten_pay_flag: bool = False            # 楽天ペイ利用可能フラグ
    
    def to_platform_format(self) -> Dict[str, Any]:
        """Convert to Rakuten API format"""
        data = {
            'member': {
                'memberId': self.member_id or self.platform_id,
                'email': self.email,
                'nickname': self.nickname,
                'sex': self.sex,
                'birthDate': self.birth_date.isoformat() if self.birth_date else None,
            }
        }
        
        # 名前
        if self.first_name or self.last_name:
            data['member']['name'] = {
                'lastName': self.last_name,
                'firstName': self.first_name,
                'lastNameKana': '',  # カナは別途必要
                'firstNameKana': ''
            }
            
        # 電話番号
        if self.phone:
            data['member']['phoneNumber'] = self.phone
            
        # メール設定
        data['member']['mailSettings'] = {
            'mailMagazineType': self.mail_magazine_type,
            'htmlMailFlag': self.html_mail_flag,
            'acceptsMarketing': self.accepts_marketing
        }
        
        # 会員情報
        data['member']['memberInfo'] = {
            'memberRank': self.member_rank,
            'pointBalance': self.point_balance,
            'orderCount': self.order_count,
            'orderTotal': self.order_total,
            'lastOrderDate': self.last_order_date.isoformat() if self.last_order_date else None,
            'rakutenPayFlag': self.rakuten_pay_flag
        }
        
        # 住所
        if self.addresses:
            data['member']['addresses'] = []
            for i, addr in enumerate(self.addresses):
                addr_data = {
                    'addressType': 1 if i == 0 else 2,  # 1:デフォルト, 2:その他
                    'zipCode': addr.zip,
                    'prefecture': addr.province,
                    'city': addr.city,
                    'address1': addr.address1,
                    'address2': addr.address2,
                    'phoneNumber': addr.phone
                }
                
                if addr.last_name and addr.first_name:
                    addr_data['name'] = f"{addr.last_name} {addr.first_name}"
                    
                data['member']['addresses'].append(addr_data)
                
        # タグ
        if self.tags:
            data['member']['tags'] = self.tags
            
        # メモ
        if self.note:
            data['member']['memo'] = self.note
            
        return data
        
    @classmethod
    def from_platform_format(cls, data: Dict[str, Any]) -> 'RakutenCustomer':
        """Create from Rakuten API format"""
        member_data = data.get('member', data)
        
        # Create customer instance
        customer = cls(
            platform_id=member_data.get('memberId', ''),
            member_id=member_data.get('memberId'),
            email=member_data.get('email', ''),
            nickname=member_data.get('nickname'),
            sex=member_data.get('sex'),
        )
        
        # 生年月日
        if member_data.get('birthDate'):
            customer.birth_date = datetime.fromisoformat(member_data['birthDate'])
            
        # 名前
        if 'name' in member_data:
            name = member_data['name']
            customer.last_name = name.get('lastName')
            customer.first_name = name.get('firstName')
            
        # 電話番号
        customer.phone = member_data.get('phoneNumber')
        
        # メール設定
        if 'mailSettings' in member_data:
            mail = member_data['mailSettings']
            customer.mail_magazine_type = mail.get('mailMagazineType', 0)
            customer.html_mail_flag = mail.get('htmlMailFlag', False)
            customer.accepts_marketing = mail.get('acceptsMarketing', False)
            
        # 会員情報
        if 'memberInfo' in member_data:
            info = member_data['memberInfo']
            customer.member_rank = info.get('memberRank')
            customer.point_balance = info.get('pointBalance', 0)
            customer.order_count = info.get('orderCount', 0)
            customer.order_total = info.get('orderTotal', 0)
            if info.get('lastOrderDate'):
                customer.last_order_date = datetime.fromisoformat(info['lastOrderDate'])
            customer.rakuten_pay_flag = info.get('rakutenPayFlag', False)
            
        # 住所
        if 'addresses' in member_data:
            customer.addresses = []
            customer.rakuten_addresses = member_data['addresses']
            
            for addr_data in member_data['addresses']:
                # 名前を分解
                full_name = addr_data.get('name', '')
                names = full_name.split(' ') if full_name else ['', '']
                
                address = BaseAddress(
                    last_name=names[0] if len(names) > 0 else '',
                    first_name=names[1] if len(names) > 1 else '',
                    zip=addr_data.get('zipCode'),
                    province=addr_data.get('prefecture'),
                    city=addr_data.get('city'),
                    address1=addr_data.get('address1'),
                    address2=addr_data.get('address2'),
                    phone=addr_data.get('phoneNumber')
                )
                
                customer.addresses.append(address)
                
                # デフォルト住所を設定
                if addr_data.get('addressType') == 1 and not customer.default_address:
                    customer.default_address = address
                    
        # タグ
        if 'tags' in member_data:
            customer.tags = member_data['tags']
            
        # メモ
        customer.note = member_data.get('memo')
        
        # タイムスタンプ
        if member_data.get('registDate'):
            customer.created_at = datetime.fromisoformat(member_data['registDate'])
        if member_data.get('updateDate'):
            customer.updated_at = datetime.fromisoformat(member_data['updateDate'])
            
        # 元データを保存
        customer.platform_data = data
        
        return customer
        
    @classmethod
    def from_common_format(cls, data: Dict[str, Any]) -> 'RakutenCustomer':
        """Create from common format"""
        customer = cls(
            platform_id=data.get('platform_id', ''),
            email=data.get('email', ''),
            first_name=data.get('first_name'),
            last_name=data.get('last_name'),
            phone=data.get('phone'),
            accepts_marketing=data.get('accepts_marketing', False),
            tags=data.get('tags', []),
            note=data.get('note')
        )
        
        # Convert addresses
        if 'addresses' in data:
            customer.addresses = []
            for addr_data in data['addresses']:
                address = BaseAddress(
                    first_name=addr_data.get('first_name'),
                    last_name=addr_data.get('last_name'),
                    company=addr_data.get('company'),
                    address1=addr_data.get('address1'),
                    address2=addr_data.get('address2'),
                    city=addr_data.get('city'),
                    province=addr_data.get('province'),
                    country=addr_data.get('country'),
                    zip=addr_data.get('zip'),
                    phone=addr_data.get('phone')
                )
                customer.addresses.append(address)
                
        # Set default address
        if 'default_address' in data and data['default_address']:
            addr_data = data['default_address']
            customer.default_address = BaseAddress(
                first_name=addr_data.get('first_name'),
                last_name=addr_data.get('last_name'),
                company=addr_data.get('company'),
                address1=addr_data.get('address1'),
                address2=addr_data.get('address2'),
                city=addr_data.get('city'),
                province=addr_data.get('province'),
                country=addr_data.get('country'),
                zip=addr_data.get('zip'),
                phone=addr_data.get('phone')
            )
            
        return customer
        
    def to_common_format(self) -> Dict[str, Any]:
        """Override to add Rakuten-specific fields"""
        common = super().to_common_format()
        
        # Add Rakuten-specific fields
        common['rakuten_data'] = {
            'member_id': self.member_id,
            'nickname': self.nickname,
            'sex': self.sex,
            'birth_date': self.birth_date.isoformat() if self.birth_date else None,
            'member_rank': self.member_rank,
            'point_balance': self.point_balance,
            'order_count': self.order_count,
            'order_total': self.order_total,
            'last_order_date': self.last_order_date.isoformat() if self.last_order_date else None,
            'rakuten_pay_flag': self.rakuten_pay_flag
        }
        
        return common