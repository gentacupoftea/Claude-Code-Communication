"""
DWHスキーママッピング機能
各データソースからの情報を共通のDWHスキーマにマッピングする
"""

from .schema_registry import SchemaRegistry, DWHSchema
from .base_mapper import BaseDataMapper, MappingResult
from .mapper_factory import MapperFactory

__all__ = [
    'SchemaRegistry',
    'DWHSchema', 
    'BaseDataMapper',
    'MappingResult',
    'MapperFactory'
]