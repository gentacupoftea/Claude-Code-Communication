import pandas as pd
from typing import Dict, Any, List, Optional, Union
import json
import re
from datetime import datetime


class Validator:
    def __init__(self, schema: Dict[str, Any]):
        self.schema = schema
        self.errors = []
        self.warnings = []
        
    def validate(self, file_path: str) -> Dict[str, Any]:
        """Validate CSV file against schema"""
        self.errors = []
        self.warnings = []
        
        try:
            # Read file with detected encoding
            encoding = self.schema.get("metadata", {}).get("encoding", "utf-8")
            delimiter = self.schema.get("metadata", {}).get("delimiter", ",")
            
            df = pd.read_csv(file_path, encoding=encoding, delimiter=delimiter)
            
            # Validate columns
            self._validate_columns(df)
            
            # Validate data types and constraints
            for column, spec in self.schema["columns"].items():
                if column in df.columns:
                    self._validate_column_data(df[column], column, spec)
                    
            return {
                "valid": len(self.errors) == 0,
                "errors": self.errors,
                "warnings": self.warnings,
                "row_count": len(df),
                "column_count": len(df.columns),
            }
            
        except Exception as e:
            self.errors.append({
                "type": "file_error",
                "message": str(e),
            })
            return {
                "valid": False,
                "errors": self.errors,
                "warnings": self.warnings,
            }
            
    def _validate_columns(self, df: pd.DataFrame):
        """Validate column structure"""
        expected_columns = set(self.schema["columns"].keys())
        actual_columns = set(df.columns)
        
        # Check for missing columns
        missing_columns = expected_columns - actual_columns
        if missing_columns:
            for col in missing_columns:
                if not self.schema["columns"][col].get("nullable", False):
                    self.errors.append({
                        "type": "missing_column",
                        "column": col,
                        "message": f"Required column '{col}' is missing",
                    })
                else:
                    self.warnings.append({
                        "type": "missing_column",
                        "column": col,
                        "message": f"Optional column '{col}' is missing",
                    })
                    
        # Check for extra columns
        extra_columns = actual_columns - expected_columns
        if extra_columns:
            for col in extra_columns:
                self.warnings.append({
                    "type": "extra_column",
                    "column": col,
                    "message": f"Unexpected column '{col}' found",
                })
                
    def _validate_column_data(self, series: pd.Series, column: str, spec: Dict[str, Any]):
        """Validate data in a specific column"""
        # Check nullability
        if not spec.get("nullable", False) and series.isna().any():
            null_count = series.isna().sum()
            self.errors.append({
                "type": "null_value",
                "column": column,
                "message": f"Column '{column}' contains {null_count} null values but is not nullable",
                "row_indices": series[series.isna()].index.tolist()[:10],  # First 10 rows
            })
            
        # Validate data type
        expected_type = spec.get("type", "string")
        non_null = series.dropna()
        
        if len(non_null) > 0:
            if expected_type == "integer":
                self._validate_integer(non_null, column, spec)
            elif expected_type == "float":
                self._validate_float(non_null, column, spec)
            elif expected_type == "string":
                self._validate_string(non_null, column, spec)
            elif expected_type == "date":
                self._validate_date(non_null, column, spec)
            elif expected_type == "email":
                self._validate_email(non_null, column)
            elif expected_type == "phone":
                self._validate_phone(non_null, column)
            elif expected_type == "boolean":
                self._validate_boolean(non_null, column)
                
    def _validate_integer(self, series: pd.Series, column: str, spec: Dict[str, Any]):
        """Validate integer values"""
        try:
            numeric = pd.to_numeric(series, errors='coerce')
            invalid_mask = numeric.isna() | (numeric != numeric.astype(int))
            
            if invalid_mask.any():
                invalid_indices = series[invalid_mask].index.tolist()[:10]
                self.errors.append({
                    "type": "type_error",
                    "column": column,
                    "message": f"Column '{column}' contains non-integer values",
                    "row_indices": invalid_indices,
                })
                
            # Check range constraints
            if "min" in spec:
                below_min = numeric < spec["min"]
                if below_min.any():
                    self.errors.append({
                        "type": "range_error",
                        "column": column,
                        "message": f"Values below minimum {spec['min']}",
                        "row_indices": series[below_min].index.tolist()[:10],
                    })
                    
            if "max" in spec:
                above_max = numeric > spec["max"]
                if above_max.any():
                    self.errors.append({
                        "type": "range_error",
                        "column": column,
                        "message": f"Values above maximum {spec['max']}",
                        "row_indices": series[above_max].index.tolist()[:10],
                    })
                    
        except Exception as e:
            self.errors.append({
                "type": "validation_error",
                "column": column,
                "message": str(e),
            })
            
    def _validate_float(self, series: pd.Series, column: str, spec: Dict[str, Any]):
        """Validate float values"""
        try:
            numeric = pd.to_numeric(series, errors='coerce')
            invalid_mask = numeric.isna()
            
            if invalid_mask.any():
                invalid_indices = series[invalid_mask].index.tolist()[:10]
                self.errors.append({
                    "type": "type_error",
                    "column": column,
                    "message": f"Column '{column}' contains non-numeric values",
                    "row_indices": invalid_indices,
                })
                
            # Similar range checks as integer
            
        except Exception as e:
            self.errors.append({
                "type": "validation_error",
                "column": column,
                "message": str(e),
            })
            
    def _validate_string(self, series: pd.Series, column: str, spec: Dict[str, Any]):
        """Validate string values"""
        str_series = series.astype(str)
        
        # Check length constraints
        if "min_length" in spec:
            too_short = str_series.str.len() < spec["min_length"]
            if too_short.any():
                self.errors.append({
                    "type": "length_error",
                    "column": column,
                    "message": f"Values shorter than minimum length {spec['min_length']}",
                    "row_indices": series[too_short].index.tolist()[:10],
                })
                
        if "max_length" in spec:
            too_long = str_series.str.len() > spec["max_length"]
            if too_long.any():
                self.errors.append({
                    "type": "length_error",
                    "column": column,
                    "message": f"Values longer than maximum length {spec['max_length']}",
                    "row_indices": series[too_long].index.tolist()[:10],
                })
                
        # Check pattern if specified
        if "pattern" in spec:
            pattern = spec["pattern"]
            invalid = ~str_series.str.match(pattern)
            if invalid.any():
                self.errors.append({
                    "type": "pattern_error",
                    "column": column,
                    "message": f"Values don't match pattern {pattern}",
                    "row_indices": series[invalid].index.tolist()[:10],
                })
                
    def _validate_date(self, series: pd.Series, column: str, spec: Dict[str, Any]):
        """Validate date values"""
        date_format = spec.get("format", None)
        
        try:
            if date_format:
                dates = pd.to_datetime(series, format=date_format, errors='coerce')
            else:
                dates = pd.to_datetime(series, errors='coerce')
                
            invalid_mask = dates.isna()
            if invalid_mask.any():
                invalid_indices = series[invalid_mask].index.tolist()[:10]
                self.errors.append({
                    "type": "date_error",
                    "column": column,
                    "message": f"Invalid date values in column '{column}'",
                    "row_indices": invalid_indices,
                })
                
        except Exception as e:
            self.errors.append({
                "type": "validation_error",
                "column": column,
                "message": str(e),
            })
            
    def _validate_email(self, series: pd.Series, column: str):
        """Validate email addresses"""
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        str_series = series.astype(str)
        invalid = ~str_series.str.match(email_pattern)
        
        if invalid.any():
            invalid_indices = series[invalid].index.tolist()[:10]
            self.errors.append({
                "type": "format_error",
                "column": column,
                "message": f"Invalid email addresses in column '{column}'",
                "row_indices": invalid_indices,
            })
            
    def _validate_phone(self, series: pd.Series, column: str):
        """Validate phone numbers"""
        # Simple pattern - can be made more specific
        phone_pattern = r'^\+?\d{1,3}[-.\s]?\d{1,14}$'
        str_series = series.astype(str)
        invalid = ~str_series.str.match(phone_pattern)
        
        if invalid.any():
            invalid_indices = series[invalid].index.tolist()[:10]
            self.errors.append({
                "type": "format_error",
                "column": column,
                "message": f"Invalid phone numbers in column '{column}'",
                "row_indices": invalid_indices,
            })
            
    def _validate_boolean(self, series: pd.Series, column: str):
        """Validate boolean values"""
        valid_values = {"true", "false", "yes", "no", "1", "0", "True", "False", "Yes", "No"}
        str_series = series.astype(str)
        invalid = ~str_series.isin(valid_values)
        
        if invalid.any():
            invalid_indices = series[invalid].index.tolist()[:10]
            self.errors.append({
                "type": "value_error",
                "column": column,
                "message": f"Invalid boolean values in column '{column}'",
                "row_indices": invalid_indices,
            })