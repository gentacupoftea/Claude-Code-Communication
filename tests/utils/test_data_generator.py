"""
Test data generator for export functionality tests
テストデータ生成ユーティリティ
"""

import random
import string
from datetime import datetime, timedelta
from typing import List, Dict, Any
import pandas as pd
import numpy as np
from faker import Faker


class TestDataGenerator:
    """テストデータ生成クラス"""
    
    def __init__(self, locale='ja_JP'):
        self.faker = Faker(locale)
        self.faker_en = Faker('en_US')
        self.faker_fr = Faker('fr_FR')
    
    def generate_order_data(self, count: int = 100) -> List[Dict[str, Any]]:
        """注文データの生成"""
        orders = []
        
        for i in range(count):
            order_date = datetime.now() - timedelta(days=random.randint(0, 365))
            
            order = {
                'id': f'ORDER-{i + 1000}',
                'order_number': f'#{i + 1000}',
                'created_at': order_date.isoformat(),
                'updated_at': (order_date + timedelta(hours=random.randint(1, 48))).isoformat(),
                'status': random.choice(['pending', 'processing', 'shipped', 'delivered', 'cancelled']),
                'customer': {
                    'id': f'CUST-{random.randint(1, 100)}',
                    'email': self.faker.email(),
                    'first_name': self.faker.first_name(),
                    'last_name': self.faker.last_name(),
                    'phone': self.faker.phone_number(),
                    'created_at': (order_date - timedelta(days=random.randint(30, 365))).isoformat()
                },
                'billing_address': {
                    'first_name': self.faker.first_name(),
                    'last_name': self.faker.last_name(),
                    'company': self.faker.company() if random.random() > 0.7 else None,
                    'address1': self.faker.street_address(),
                    'address2': self.faker.secondary_address() if random.random() > 0.5 else None,
                    'city': self.faker.city(),
                    'province': self.faker.prefecture(),
                    'country': 'JP',
                    'zip': self.faker.postcode(),
                    'phone': self.faker.phone_number()
                },
                'shipping_address': {
                    'first_name': self.faker.first_name(),
                    'last_name': self.faker.last_name(),
                    'address1': self.faker.street_address(),
                    'city': self.faker.city(),
                    'province': self.faker.prefecture(),
                    'country': 'JP',
                    'zip': self.faker.postcode()
                },
                'line_items': self.generate_line_items(random.randint(1, 5)),
                'total_price': 0,  # Will be calculated
                'subtotal_price': 0,  # Will be calculated
                'total_tax': 0,
                'total_shipping': random.choice([0, 500, 800, 1200]),
                'currency': 'JPY',
                'payment_gateway_names': [random.choice(['credit_card', 'paypal', 'bank_transfer'])],
                'processing_method': 'direct',
                'source_name': random.choice(['web', 'pos', 'mobile_app', 'api']),
                'tags': self.generate_tags(),
                'note': self.faker.text(max_nb_chars=200) if random.random() > 0.8 else None,
                'cancelled_at': None,
                'cancel_reason': None
            }
            
            # Calculate totals
            subtotal = sum(item['price'] * item['quantity'] for item in order['line_items'])
            order['subtotal_price'] = subtotal
            order['total_tax'] = int(subtotal * 0.1)  # 10% tax
            order['total_price'] = subtotal + order['total_tax'] + order['total_shipping']
            
            # Add cancellation info if cancelled
            if order['status'] == 'cancelled':
                order['cancelled_at'] = (order_date + timedelta(hours=random.randint(1, 72))).isoformat()
                order['cancel_reason'] = random.choice(['customer', 'inventory', 'fraud', 'other'])
            
            orders.append(order)
        
        return orders
    
    def generate_line_items(self, count: int) -> List[Dict[str, Any]]:
        """注文明細データの生成"""
        items = []
        
        for i in range(count):
            item = {
                'id': f'LINE-{random.randint(10000, 99999)}',
                'product_id': f'PROD-{random.randint(1, 1000)}',
                'variant_id': f'VAR-{random.randint(1, 5000)}',
                'title': self.generate_product_name(),
                'variant_title': self.generate_variant_title(),
                'sku': self.generate_sku(),
                'vendor': self.faker.company(),
                'quantity': random.randint(1, 5),
                'price': random.randint(100, 50000),
                'total_price': 0,  # Will be calculated
                'grams': random.randint(50, 5000),
                'requires_shipping': True,
                'taxable': True,
                'gift_card': False,
                'properties': self.generate_item_properties() if random.random() > 0.8 else []
            }
            
            item['total_price'] = item['price'] * item['quantity']
            items.append(item)
        
        return items
    
    def generate_product_name(self) -> str:
        """商品名の生成"""
        categories = [
            '電化製品', '家具', '衣類', '食品', '書籍', 'おもちゃ', 
            '化粧品', 'スポーツ用品', '文房具', 'アクセサリー'
        ]
        
        adjectives = [
            '高級', 'エコ', 'オーガニック', '限定版', 'プレミアム',
            '最新', 'クラシック', 'モダン', 'シンプル', 'デラックス'
        ]
        
        return f"{random.choice(adjectives)} {random.choice(categories)} {self.faker.word()}"
    
    def generate_variant_title(self) -> str:
        """バリアント名の生成"""
        colors = ['赤', '青', '緑', '黒', '白', 'ゴールド', 'シルバー']
        sizes = ['S', 'M', 'L', 'XL', 'XXL', 'フリーサイズ']
        
        variant_type = random.choice(['color', 'size', 'both'])
        
        if variant_type == 'color':
            return random.choice(colors)
        elif variant_type == 'size':
            return random.choice(sizes)
        else:
            return f"{random.choice(colors)} / {random.choice(sizes)}"
    
    def generate_sku(self) -> str:
        """SKUの生成"""
        prefix = random.choice(['PRD', 'ITM', 'SKU', 'PROD'])
        numbers = ''.join(random.choices(string.digits, k=6))
        suffix = ''.join(random.choices(string.ascii_uppercase, k=2))
        return f"{prefix}-{numbers}-{suffix}"
    
    def generate_tags(self) -> List[str]:
        """タグの生成"""
        available_tags = [
            'セール', '新商品', '人気商品', 'おすすめ', '限定',
            'ギフト対応', '送料無料', '即日発送', 'ポイント倍増', 'お買い得'
        ]
        
        num_tags = random.randint(0, 4)
        return random.sample(available_tags, num_tags)
    
    def generate_item_properties(self) -> List[Dict[str, str]]:
        """商品プロパティの生成"""
        properties = []
        
        if random.random() > 0.5:
            properties.append({
                'name': 'ギフトメッセージ',
                'value': self.faker.text(max_nb_chars=50)
            })
        
        if random.random() > 0.7:
            properties.append({
                'name': 'カスタマイズ',
                'value': f"名入れ: {self.faker.first_name()}"
            })
        
        return properties
    
    def generate_customer_data(self, count: int = 50) -> List[Dict[str, Any]]:
        """顧客データの生成"""
        customers = []
        
        for i in range(count):
            created_at = datetime.now() - timedelta(days=random.randint(30, 730))
            
            customer = {
                'id': f'CUST-{i + 1}',
                'email': self.faker.email(),
                'first_name': self.faker.first_name(),
                'last_name': self.faker.last_name(),
                'phone': self.faker.phone_number(),
                'created_at': created_at.isoformat(),
                'updated_at': (created_at + timedelta(days=random.randint(0, 30))).isoformat(),
                'accepts_marketing': random.choice([True, False]),
                'marketing_opt_in_level': random.choice(['single_opt_in', 'confirmed_opt_in', None]),
                'orders_count': random.randint(0, 50),
                'state': random.choice(['enabled', 'disabled', 'invited']),
                'total_spent': random.randint(0, 1000000),
                'last_order_id': f'ORDER-{random.randint(1000, 9999)}' if random.random() > 0.3 else None,
                'note': self.faker.text(max_nb_chars=100) if random.random() > 0.8 else None,
                'verified_email': True,
                'tax_exempt': False,
                'tags': self.generate_customer_tags(),
                'default_address': {
                    'address1': self.faker.street_address(),
                    'city': self.faker.city(),
                    'province': self.faker.prefecture(),
                    'country': 'JP',
                    'zip': self.faker.postcode()
                }
            }
            
            customers.append(customer)
        
        return customers
    
    def generate_customer_tags(self) -> List[str]:
        """顧客タグの生成"""
        tags = [
            'VIP', 'リピーター', '新規顧客', 'ロイヤル顧客', 
            'B2B', '卸売', '小売', 'オンライン', '店舗'
        ]
        
        num_tags = random.randint(0, 3)
        return random.sample(tags, num_tags)
    
    def generate_product_data(self, count: int = 100) -> List[Dict[str, Any]]:
        """商品データの生成"""
        products = []
        
        for i in range(count):
            created_at = datetime.now() - timedelta(days=random.randint(30, 365))
            
            product = {
                'id': f'PROD-{i + 1}',
                'title': self.generate_product_name(),
                'body_html': f"<p>{self.faker.text(max_nb_chars=500)}</p>",
                'vendor': self.faker.company(),
                'product_type': random.choice(['電化製品', '家具', '衣類', '食品', '書籍']),
                'created_at': created_at.isoformat(),
                'updated_at': (created_at + timedelta(days=random.randint(0, 30))).isoformat(),
                'published_at': created_at.isoformat() if random.random() > 0.1 else None,
                'template_suffix': None,
                'published_scope': 'web',
                'tags': self.generate_product_tags(),
                'status': random.choice(['active', 'draft', 'archived']),
                'variants': self.generate_variants(random.randint(1, 5)),
                'images': self.generate_product_images(random.randint(1, 5)),
                'options': self.generate_product_options()
            }
            
            products.append(product)
        
        return products
    
    def generate_product_tags(self) -> List[str]:
        """商品タグの生成"""
        tags = []
        
        # シーズンタグ
        if random.random() > 0.5:
            tags.append(random.choice(['春', '夏', '秋', '冬']))
        
        # カテゴリタグ
        if random.random() > 0.3:
            tags.append(random.choice(['メンズ', 'レディース', 'キッズ', 'ユニセックス']))
        
        # 特徴タグ
        if random.random() > 0.4:
            tags.extend(random.sample(['エコ', '国産', '手作り', '限定', 'セール'], k=random.randint(1, 3)))
        
        return tags
    
    def generate_variants(self, count: int) -> List[Dict[str, Any]]:
        """バリアントデータの生成"""
        variants = []
        
        for i in range(count):
            variant = {
                'id': f'VAR-{random.randint(10000, 99999)}',
                'product_id': None,  # Will be set by parent
                'title': self.generate_variant_title(),
                'price': str(random.randint(100, 100000)),
                'sku': self.generate_sku(),
                'position': i + 1,
                'inventory_policy': random.choice(['deny', 'continue']),
                'compare_at_price': str(random.randint(100, 150000)) if random.random() > 0.7 else None,
                'option1': self.generate_variant_option(),
                'option2': self.generate_variant_option() if random.random() > 0.5 else None,
                'option3': None,
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat(),
                'taxable': True,
                'barcode': self.generate_barcode() if random.random() > 0.3 else None,
                'grams': random.randint(50, 5000),
                'weight': random.uniform(0.05, 5.0),
                'weight_unit': 'kg',
                'inventory_quantity': random.randint(0, 1000),
                'old_inventory_quantity': random.randint(0, 1000),
                'requires_shipping': True
            }
            
            variants.append(variant)
        
        return variants
    
    def generate_variant_option(self) -> str:
        """バリアントオプションの生成"""
        options = {
            'color': ['赤', '青', '緑', '黒', '白', 'ゴールド', 'シルバー'],
            'size': ['S', 'M', 'L', 'XL', 'XXL'],
            'material': ['コットン', 'ポリエステル', 'シルク', 'ウール', 'レザー'],
            'style': ['モダン', 'クラシック', 'カジュアル', 'フォーマル']
        }
        
        option_type = random.choice(list(options.keys()))
        return random.choice(options[option_type])
    
    def generate_barcode(self) -> str:
        """バーコードの生成"""
        # EAN-13形式
        return ''.join(random.choices(string.digits, k=13))
    
    def generate_product_images(self, count: int) -> List[Dict[str, Any]]:
        """商品画像データの生成"""
        images = []
        
        for i in range(count):
            image = {
                'id': f'IMG-{random.randint(100000, 999999)}',
                'product_id': None,  # Will be set by parent
                'position': i + 1,
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat(),
                'width': random.choice([800, 1024, 1200, 1600]),
                'height': random.choice([600, 768, 900, 1200]),
                'src': f"https://example.com/products/image_{random.randint(1000, 9999)}.jpg",
                'variant_ids': []
            }
            
            images.append(image)
        
        return images
    
    def generate_product_options(self) -> List[Dict[str, Any]]:
        """商品オプションの生成"""
        possible_options = [
            {'name': 'Color', 'values': ['赤', '青', '緑', '黒', '白']},
            {'name': 'Size', 'values': ['S', 'M', 'L', 'XL', 'XXL']},
            {'name': 'Material', 'values': ['コットン', 'ポリエステル', 'シルク']},
            {'name': 'Style', 'values': ['モダン', 'クラシック', 'カジュアル']}
        ]
        
        num_options = random.randint(1, 3)
        selected_options = random.sample(possible_options, num_options)
        
        options = []
        for i, option in enumerate(selected_options):
            options.append({
                'id': f'OPT-{random.randint(10000, 99999)}',
                'product_id': None,  # Will be set by parent
                'name': option['name'],
                'position': i + 1,
                'values': random.sample(option['values'], k=random.randint(2, len(option['values'])))
            })
        
        return options
    
    def generate_multilingual_data(self, count: int = 10) -> List[Dict[str, Any]]:
        """多言語データの生成"""
        data = []
        
        for i in range(count):
            item = {
                'id': f'MULTI-{i + 1}',
                'name_ja': self.faker.name(),
                'name_en': self.faker_en.name(),
                'name_fr': self.faker_fr.name(),
                'description_ja': self.faker.text(max_nb_chars=100),
                'description_en': self.faker_en.text(max_nb_chars=100),
                'description_fr': self.faker_fr.text(max_nb_chars=100),
                'price': random.randint(1000, 100000),
                'category_ja': random.choice(['電化製品', '家具', '衣類', '食品']),
                'category_en': random.choice(['Electronics', 'Furniture', 'Clothing', 'Food']),
                'category_fr': random.choice(['Électronique', 'Meubles', 'Vêtements', 'Nourriture'])
            }
            
            data.append(item)
        
        return data


# Utility functions
def create_dataframe(data: List[Dict[str, Any]]) -> pd.DataFrame:
    """リストからDataFrameを作成"""
    return pd.DataFrame(data)


def save_test_data(data: Any, filename: str, format: str = 'json'):
    """テストデータをファイルに保存"""
    if format == 'json':
        import json
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    elif format == 'csv':
        df = pd.DataFrame(data)
        df.to_csv(filename, index=False, encoding='utf-8')
    elif format == 'excel':
        df = pd.DataFrame(data)
        df.to_excel(filename, index=False)


if __name__ == '__main__':
    # Generate sample data for testing
    generator = TestDataGenerator()
    
    # Generate different types of data
    orders = generator.generate_order_data(100)
    customers = generator.generate_customer_data(50)
    products = generator.generate_product_data(100)
    multilingual = generator.generate_multilingual_data(20)
    
    # Save to files
    save_test_data(orders, 'test_orders.json')
    save_test_data(customers, 'test_customers.json')
    save_test_data(products, 'test_products.json')
    save_test_data(multilingual, 'test_multilingual.json')
    
    print("Test data generated successfully!")
    print(f"- Orders: {len(orders)} records")
    print(f"- Customers: {len(customers)} records")
    print(f"- Products: {len(products)} records")
    print(f"- Multilingual: {len(multilingual)} records")