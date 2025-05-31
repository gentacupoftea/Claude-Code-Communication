"""
Rakuten Category Model
Handles category structure for Rakuten products
"""

from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List
from datetime import datetime


@dataclass
class RakutenCategory:
    """
    Rakuten category model
    Represents category hierarchy and attributes
    """
    
    # Basic fields
    category_id: str
    category_name: str
    parent_category_id: Optional[str] = None
    category_level: int = 0
    full_path: Optional[str] = None
    
    # Category attributes
    is_active: bool = True
    sort_order: int = 0
    product_count: int = 0
    
    # SEO fields
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    seo_keywords: Optional[str] = None
    
    # Images and content
    category_image_url: Optional[str] = None
    category_banner_url: Optional[str] = None
    description: Optional[str] = None
    
    # Hierarchy
    children: List['RakutenCategory'] = field(default_factory=list)
    
    # Metadata
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    # Platform-specific data
    platform_data: Dict[str, Any] = field(default_factory=dict)
    
    def to_platform_format(self) -> Dict[str, Any]:
        """
        Convert to Rakuten API format
        
        Returns:
            Dictionary in Rakuten's expected format
        """
        data = {
            'categoryId': self.category_id,
            'categoryName': self.category_name,
            'parentCategoryId': self.parent_category_id,
            'categoryLevel': self.category_level,
            'isActive': self.is_active,
            'sortOrder': self.sort_order,
            'productCount': self.product_count
        }
        
        if self.full_path:
            data['fullPath'] = self.full_path
            
        if self.seo_title:
            data['seoTitle'] = self.seo_title
        if self.seo_description:
            data['seoDescription'] = self.seo_description
        if self.seo_keywords:
            data['seoKeywords'] = self.seo_keywords
            
        if self.category_image_url:
            data['categoryImageUrl'] = self.category_image_url
        if self.category_banner_url:
            data['categoryBannerUrl'] = self.category_banner_url
        if self.description:
            data['description'] = self.description
            
        if self.children:
            data['children'] = [child.to_platform_format() for child in self.children]
            
        return data
    
    @classmethod
    def from_platform_format(cls, data: Dict[str, Any]) -> 'RakutenCategory':
        """
        Create from Rakuten API format
        
        Args:
            data: Category data from Rakuten API
            
        Returns:
            RakutenCategory instance
        """
        category = cls(
            category_id=data.get('categoryId', ''),
            category_name=data.get('categoryName', ''),
            parent_category_id=data.get('parentCategoryId'),
            category_level=data.get('categoryLevel', 0),
            full_path=data.get('fullPath'),
            is_active=data.get('isActive', True),
            sort_order=data.get('sortOrder', 0),
            product_count=data.get('productCount', 0)
        )
        
        # SEO fields
        category.seo_title = data.get('seoTitle')
        category.seo_description = data.get('seoDescription')
        category.seo_keywords = data.get('seoKeywords')
        
        # Images and content
        category.category_image_url = data.get('categoryImageUrl')
        category.category_banner_url = data.get('categoryBannerUrl')
        category.description = data.get('description')
        
        # Children
        if 'children' in data and data['children']:
            category.children = [
                cls.from_platform_format(child_data)
                for child_data in data['children']
            ]
        
        # Timestamps
        if data.get('createdAt'):
            category.created_at = datetime.fromisoformat(data['createdAt'])
        if data.get('updatedAt'):
            category.updated_at = datetime.fromisoformat(data['updatedAt'])
            
        # Store original data
        category.platform_data = data
        
        return category
    
    def to_common_format(self) -> Dict[str, Any]:
        """
        Convert to common format
        
        Returns:
            Common format dictionary
        """
        return {
            'platform_id': self.category_id,
            'name': self.category_name,
            'parent_id': self.parent_category_id,
            'level': self.category_level,
            'path': self.full_path,
            'is_active': self.is_active,
            'sort_order': self.sort_order,
            'product_count': self.product_count,
            'seo': {
                'title': self.seo_title,
                'description': self.seo_description,
                'keywords': self.seo_keywords
            },
            'images': {
                'category_image': self.category_image_url,
                'banner': self.category_banner_url
            },
            'description': self.description,
            'children': [child.to_common_format() for child in self.children],
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def add_child(self, child: 'RakutenCategory'):
        """Add a child category"""
        self.children.append(child)
        child.parent_category_id = self.category_id
        child.category_level = self.category_level + 1
    
    def get_child_by_id(self, category_id: str) -> Optional['RakutenCategory']:
        """Get child category by ID"""
        for child in self.children:
            if child.category_id == category_id:
                return child
            # Recursive search
            found = child.get_child_by_id(category_id)
            if found:
                return found
        return None
    
    def get_all_descendants(self) -> List['RakutenCategory']:
        """Get all descendant categories (recursive)"""
        descendants = []
        for child in self.children:
            descendants.append(child)
            descendants.extend(child.get_all_descendants())
        return descendants
    
    def build_full_path(self, separator: str = ' > ') -> str:
        """Build full category path"""
        path_parts = [self.category_name]
        current = self
        
        while current.parent_category_id:
            # This would need access to parent categories
            # In practice, this would be handled by the category manager
            break
            
        return separator.join(reversed(path_parts))