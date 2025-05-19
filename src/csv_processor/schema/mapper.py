import pandas as pd
from typing import Dict, Any, List, Optional
import json
from pathlib import Path


class Mapper:
    def __init__(self, schema: Dict[str, Any], mapping_config: Optional[Dict[str, Any]] = None):
        self.schema = schema
        self.mapping_config = mapping_config or {}
        self.column_mappings = self._build_column_mappings()
        
    def _build_column_mappings(self) -> Dict[str, str]:
        """Build column name mappings"""
        mappings = {}
        
        # Use custom mappings if provided
        if "column_mappings" in self.mapping_config:
            mappings.update(self.mapping_config["column_mappings"])
            
        # Auto-generate mappings for Japanese columns
        if self.mapping_config.get("auto_translate_japanese", True):
            japanese_mappings = {
                "注文日": "order_date",
                "注文日時": "order_datetime",
                "商品名": "product_name",
                "商品ID": "product_id",
                "数量": "quantity",
                "金額": "amount",
                "価格": "price",
                "単価": "unit_price",
                "顧客名": "customer_name",
                "顧客ID": "customer_id",
                "配送先": "shipping_address",
                "配送方法": "shipping_method",
                "支払方法": "payment_method",
                "ステータス": "status",
                "備考": "notes",
                "電話番号": "phone_number",
                "メールアドレス": "email",
                "郵便番号": "postal_code",
                "都道府県": "prefecture",
                "市区町村": "city",
                "番地": "address_line",
            }
            
            for jp, en in japanese_mappings.items():
                if jp not in mappings:
                    mappings[jp] = en
                    
        return mappings
        
    def map_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """Map column names and transform data"""
        # Create a copy to avoid modifying original
        mapped_df = df.copy()
        
        # Rename columns
        rename_map = {}
        for old_name, new_name in self.column_mappings.items():
            if old_name in mapped_df.columns:
                rename_map[old_name] = new_name
                
        if rename_map:
            mapped_df = mapped_df.rename(columns=rename_map)
            
        # Apply data transformations
        for column in mapped_df.columns:
            # Get original column name for schema lookup
            original_column = next(
                (k for k, v in rename_map.items() if v == column),
                column
            )
            
            # Apply transformations based on schema
            if original_column in self.schema.get("columns", {}):
                col_spec = self.schema["columns"][original_column]
                mapped_df[column] = self._transform_column(
                    mapped_df[column],
                    col_spec,
                    column
                )
                
        # Add any required columns that are missing
        self._add_missing_columns(mapped_df)
        
        return mapped_df
        
    def _transform_column(self, series: pd.Series, spec: Dict[str, Any], column_name: str) -> pd.Series:
        """Transform a single column based on its specification"""
        transformed = series.copy()
        data_type = spec.get("type", "string")
        
        # Type conversions
        if data_type == "integer":
            try:
                transformed = pd.to_numeric(transformed, errors='coerce').astype('Int64')
            except:
                pass
                
        elif data_type == "float":
            try:
                transformed = pd.to_numeric(transformed, errors='coerce')
            except:
                pass
                
        elif data_type == "date":
            transformed = self._transform_date(transformed, spec)
            
        elif data_type == "boolean":
            transformed = self._transform_boolean(transformed)
            
        elif data_type == "currency":
            transformed = self._transform_currency(transformed, spec)
            
        # Apply custom transformations
        if column_name in self.mapping_config.get("transformations", {}):
            transform_config = self.mapping_config["transformations"][column_name]
            transformed = self._apply_custom_transform(transformed, transform_config)
            
        return transformed
        
    def _transform_date(self, series: pd.Series, spec: Dict[str, Any]) -> pd.Series:
        """Transform date values"""
        date_format = spec.get("format", None)
        target_format = self.mapping_config.get("target_date_format", "%Y-%m-%d")
        
        try:
            if date_format:
                dates = pd.to_datetime(series, format=date_format, errors='coerce')
            else:
                dates = pd.to_datetime(series, errors='coerce')
                
            # Convert to target format
            return dates.dt.strftime(target_format)
            
        except:
            return series
            
    def _transform_boolean(self, series: pd.Series) -> pd.Series:
        """Transform boolean values"""
        mapping = {
            "true": True, "false": False,
            "yes": True, "no": False,
            "1": True, "0": False,
            "○": True, "×": False,  # Japanese
            "有": True, "無": False,  # Japanese
        }
        
        str_series = series.astype(str).str.lower()
        return str_series.map(mapping).fillna(series)
        
    def _transform_currency(self, series: pd.Series, spec: Dict[str, Any]) -> pd.Series:
        """Transform currency values"""
        # Remove currency symbols and commas
        str_series = series.astype(str)
        str_series = str_series.str.replace(r'[¥$€,]', '', regex=True)
        
        try:
            return pd.to_numeric(str_series, errors='coerce')
        except:
            return series
            
    def _apply_custom_transform(self, series: pd.Series, config: Dict[str, Any]) -> pd.Series:
        """Apply custom transformation rules"""
        transform_type = config.get("type")
        
        if transform_type == "replace":
            return series.replace(config["mapping"])
            
        elif transform_type == "regex":
            return series.str.replace(config["pattern"], config["replacement"], regex=True)
            
        elif transform_type == "split":
            return series.str.split(config["delimiter"]).str[config.get("index", 0)]
            
        elif transform_type == "concat":
            # Concatenate with other columns (requires full dataframe context)
            pass
            
        return series
        
    def _add_missing_columns(self, df: pd.DataFrame):
        """Add any required columns that are missing"""
        required_columns = self.mapping_config.get("required_columns", [])
        
        for column in required_columns:
            if column not in df.columns:
                default_value = self.mapping_config.get("defaults", {}).get(column, None)
                df[column] = default_value
                
    def generate_mapping_report(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Generate a report of the mapping process"""
        original_columns = list(df.columns)
        mapped_df = self.map_dataframe(df)
        mapped_columns = list(mapped_df.columns)
        
        report = {
            "original_columns": original_columns,
            "mapped_columns": mapped_columns,
            "column_mappings": {
                old: new for old, new in self.column_mappings.items()
                if old in original_columns
            },
            "unmapped_columns": [
                col for col in original_columns
                if col not in self.column_mappings
            ],
            "data_types": {
                col: str(mapped_df[col].dtype)
                for col in mapped_columns
            },
            "sample_data": mapped_df.head(5).to_dict(orient="records"),
        }
        
        return report
        
    def save_mapping_config(self, file_path: str):
        """Save mapping configuration to file"""
        config = {
            "column_mappings": self.column_mappings,
            "mapping_config": self.mapping_config,
            "schema": self.schema,
        }
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
            
    @classmethod
    def load_mapping_config(cls, file_path: str) -> 'Mapper':
        """Load mapping configuration from file"""
        with open(file_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
            
        return cls(
            schema=config["schema"],
            mapping_config=config["mapping_config"]
        )