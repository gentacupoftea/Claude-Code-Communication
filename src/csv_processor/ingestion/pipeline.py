import asyncio
from typing import Dict, Any, List, Optional
from datetime import datetime
import json
from pathlib import Path
import traceback
import pandas as pd

from ..acquisition import AcquisitionManager
from ..schema import SchemaDetector, Validator, Mapper
from ..transformation import Encoder, Formatter, Cleaner
from ..exceptions import PipelineError, ValidationError, EncodingError
from ..utils import get_logger, LogContext, PerformanceLogger

logger = get_logger(__name__)


class Pipeline:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.acquisition_manager = AcquisitionManager(config.get("acquisition", {}))
        self.schema_detector = SchemaDetector()
        self.encoder = Encoder(target_encoding=config.get("encoding", "utf-8"))
        self.formatter = Formatter(config.get("formatting", {}))
        self.cleaner = Cleaner(config.get("cleaning", {}))
        
        self.pipeline_id = None
        self.start_time = None
        self.end_time = None
        self.status = "pending"
        self.processed_files = []
        self.errors = []
        self.warnings = []
        self.partial_results = []
        self.graceful_mode = config.get("graceful_mode", True)
        self.perf_logger = PerformanceLogger(logger)
        
        logger.info(
            "Pipeline initialized",
            graceful_mode=self.graceful_mode,
            encoding=config.get("encoding", "utf-8")
        )
    
    async def run(self, source: Optional[str] = None) -> Dict[str, Any]:
        """Run the complete pipeline with graceful degradation"""
        self.pipeline_id = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
        self.start_time = datetime.utcnow()
        self.status = "running"
        
        with LogContext(logger, pipeline_id=self.pipeline_id):
            self.perf_logger.start_operation("pipeline_run")
            
            try:
                # Step 1: Acquisition
                files = await self._acquire_files(source)
                
                if not files:
                    logger.warning("No files acquired")
                    self.status = "completed_no_data"
                    return self.get_summary()
                
                # Step 2: Process each file
                for idx, file_info in enumerate(files):
                    with LogContext(logger, file=file_info.get("filename", "unknown")):
                        try:
                            result = await self.process_file(file_info)
                            self.processed_files.append(result)
                        except Exception as e:
                            self._handle_file_error(file_info, e)
                            
                            if not self.graceful_mode:
                                raise
                
                self._determine_final_status()
                
            except Exception as e:
                self.status = "failed"
                self.errors.append({
                    "error": str(e),
                    "traceback": traceback.format_exc(),
                    "timestamp": datetime.utcnow(),
                    "stage": "pipeline_run"
                })
                logger.error("Pipeline failed", error=e)
                
                if not self.graceful_mode:
                    raise PipelineError(
                        f"Pipeline execution failed: {str(e)}",
                        stage="pipeline_run",
                        original_exception=e
                    )
            
            finally:
                self.end_time = datetime.utcnow()
                self.perf_logger.end_operation(
                    "pipeline_run",
                    status=self.status,
                    files_processed=len(self.processed_files),
                    errors=len(self.errors)
                )
        
        return self.get_summary()
    
    async def _acquire_files(self, source: Optional[str]) -> List[Dict[str, Any]]:
        """Acquire files with error handling"""
        try:
            if source:
                files = await self.acquisition_manager.fetch_from_source(source)
            else:
                files = await self.acquisition_manager.fetch_all()
            
            logger.info(f"Acquired {len(files)} files", file_count=len(files))
            return files
            
        except Exception as e:
            logger.error("Failed to acquire files", error=e)
            
            if self.graceful_mode:
                self.errors.append({
                    "error": str(e),
                    "stage": "acquisition",
                    "timestamp": datetime.utcnow()
                })
                return []
            else:
                raise PipelineError(
                    f"File acquisition failed: {str(e)}",
                    stage="acquisition",
                    original_exception=e
                )
    
    async def process_file(self, file_info: Dict[str, Any]) -> Dict[str, Any]:
        """Process a single file with graceful degradation"""
        file_path = file_info["path"]
        result = {
            "file_info": file_info,
            "steps": {},
            "status": "processing",
            "start_time": datetime.utcnow(),
            "warnings": [],
            "partial_data": None
        }
        
        self.perf_logger.start_operation(f"process_file_{file_info['filename']}")
        
        try:
            # Step 1: Encoding detection and conversion
            file_path = await self._handle_encoding(file_path, result)
            
            # Step 2: Schema detection
            schema = await self._detect_schema(file_path, result)
            
            # Step 3: Data validation
            validation_result = await self._validate_data(file_path, schema, result)
            
            # Step 4: Data transformation
            df = await self._transform_data(file_path, schema, result)
            
            # Step 5: Save processed data
            output_path = await self._save_data(df, file_info, result)
            
            result["output_path"] = output_path
            result["status"] = "completed"
            result["row_count"] = len(df)
            result["column_count"] = len(df.columns)
            
            # Check if there were any warnings
            if result["warnings"]:
                result["status"] = "completed_with_warnings"
            
        except Exception as e:
            result["status"] = "failed"
            result["error"] = str(e)
            result["traceback"] = traceback.format_exc()
            
            # Try to save partial results if available
            if self.graceful_mode and result.get("partial_data") is not None:
                try:
                    partial_path = await self._save_partial_data(
                        result["partial_data"], 
                        file_info
                    )
                    result["partial_output_path"] = partial_path
                    result["status"] = "partial_success"
                    self.partial_results.append(result)
                except Exception as save_error:
                    logger.error("Failed to save partial data", error=save_error)
            
            logger.error(f"Failed to process file {file_info['filename']}", error=e)
            
            if not self.graceful_mode:
                raise
        
        finally:
            result["end_time"] = datetime.utcnow()
            result["duration"] = (result["end_time"] - result["start_time"]).total_seconds()
            
            self.perf_logger.end_operation(
                f"process_file_{file_info['filename']}",
                status=result["status"],
                duration=result["duration"]
            )
        
        return result
    
    async def _handle_encoding(self, file_path: str, result: Dict[str, Any]) -> str:
        """Handle encoding with fallback options"""
        try:
            encoding_result = self.encoder.detect_encoding(file_path)
            result["steps"]["encoding"] = encoding_result
            
            if encoding_result["encoding"] != self.encoder.target_encoding:
                converted_path = file_path + ".encoded"
                conversion_result = self.encoder.convert_encoding(
                    file_path, 
                    converted_path
                )
                result["steps"]["encoding"]["conversion"] = conversion_result
                
                if conversion_result.get("warnings"):
                    result["warnings"].extend(conversion_result["warnings"])
                
                return converted_path
            
            return file_path
            
        except Exception as e:
            if self.graceful_mode:
                logger.warning(f"Encoding detection/conversion failed: {str(e)}")
                result["warnings"].append({
                    "stage": "encoding",
                    "message": f"Failed to convert encoding: {str(e)}",
                    "fallback": "Using original file"
                })
                return file_path
            else:
                raise EncodingError(
                    f"Encoding processing failed: {str(e)}",
                    context={"file_path": file_path}
                )
    
    async def _detect_schema(self, file_path: str, result: Dict[str, Any]) -> Dict[str, Any]:
        """Detect schema with error handling"""
        try:
            schema = self.schema_detector.detect_schema(
                file_path,
                encoding=self.encoder.target_encoding
            )
            result["steps"]["schema"] = schema
            return schema
            
        except Exception as e:
            if self.graceful_mode:
                logger.warning(f"Schema detection failed: {str(e)}")
                # Create a basic schema fallback
                result["warnings"].append({
                    "stage": "schema_detection",
                    "message": f"Schema detection failed: {str(e)}",
                    "fallback": "Using basic schema"
                })
                
                # Try to read file and create minimal schema
                try:
                    df = pd.read_csv(file_path, nrows=5)
                    schema = {
                        "columns": {col: {"type": "string"} for col in df.columns},
                        "metadata": {"encoding": self.encoder.target_encoding}
                    }
                    return schema
                except:
                    return {"columns": {}, "metadata": {}}
            else:
                raise
    
    async def _validate_data(self, file_path: str, schema: Dict[str, Any], 
                           result: Dict[str, Any]) -> Dict[str, Any]:
        """Validate data with graceful handling"""
        try:
            validator = Validator(schema)
            validation_result = validator.validate(file_path)
            result["steps"]["validation"] = validation_result
            
            if not validation_result["valid"]:
                if self.config.get("strict_validation", False) and not self.graceful_mode:
                    raise ValidationError(
                        f"Validation failed: {validation_result['errors']}",
                        errors=validation_result["errors"]
                    )
                else:
                    result["warnings"].append({
                        "stage": "validation",
                        "message": "Validation errors found",
                        "errors": validation_result["errors"]
                    })
            
            return validation_result
            
        except ValidationError:
            raise
        except Exception as e:
            if self.graceful_mode:
                logger.warning(f"Validation failed: {str(e)}")
                result["warnings"].append({
                    "stage": "validation", 
                    "message": f"Validation failed: {str(e)}",
                    "fallback": "Skipping validation"
                })
                return {"valid": True, "warnings": [str(e)]}
            else:
                raise
    
    async def _transform_data(self, file_path: str, schema: Dict[str, Any], 
                            result: Dict[str, Any]) -> pd.DataFrame:
        """Transform data with partial success handling"""
        try:
            df = pd.read_csv(file_path, encoding=self.encoder.target_encoding)
            result["steps"]["initial_load"] = {
                "rows": len(df),
                "columns": len(df.columns)
            }
            
            # Store original data for potential partial saves
            result["partial_data"] = df.copy()
            
            # Apply transformations
            if self.config.get("apply_mapping", True):
                try:
                    mapper = Mapper(schema, self.config.get("mapping", {}))
                    df = mapper.map_dataframe(df)
                    result["steps"]["mapping"] = mapper.generate_mapping_report(df)
                except Exception as e:
                    if self.graceful_mode:
                        logger.warning(f"Mapping failed: {str(e)}")
                        result["warnings"].append({
                            "stage": "mapping",
                            "message": f"Mapping failed: {str(e)}",
                            "fallback": "Using original columns"
                        })
                    else:
                        raise
            
            # Clean data
            try:
                cleaning_pipeline = self.config.get("cleaning_pipeline", [
                    {"operation": "missing_values"},
                    {"operation": "whitespace"},
                    {"operation": "duplicates"}
                ])
                df = self.cleaner.apply_cleaning_pipeline(df, cleaning_pipeline)
                result["steps"]["cleaning"] = {"operations": len(cleaning_pipeline)}
            except Exception as e:
                if self.graceful_mode:
                    logger.warning(f"Cleaning failed: {str(e)}")
                    result["warnings"].append({
                        "stage": "cleaning",
                        "message": f"Some cleaning operations failed: {str(e)}"
                    })
                else:
                    raise
            
            # Format data
            try:
                format_rules = self.config.get("format_rules", {})
                if format_rules:
                    df = self.formatter.apply_format_rules(df, format_rules)
                    result["steps"]["formatting"] = {"rules_applied": len(format_rules)}
            except Exception as e:
                if self.graceful_mode:
                    logger.warning(f"Formatting failed: {str(e)}")
                    result["warnings"].append({
                        "stage": "formatting",
                        "message": f"Some formatting failed: {str(e)}"
                    })
                else:
                    raise
            
            # Data quality report
            quality_report = self.cleaner.validate_data_quality(df)
            result["steps"]["quality"] = quality_report
            
            return df
            
        except Exception as e:
            if self.graceful_mode and result.get("partial_data") is not None:
                logger.warning(f"Transformation failed, returning partial data: {str(e)}")
                return result["partial_data"]
            else:
                raise
    
    async def _save_data(self, df: pd.DataFrame, file_info: Dict[str, Any], 
                        result: Dict[str, Any]) -> str:
        """Save processed data"""
        output_path = self._get_output_path(file_info)
        
        try:
            df.to_csv(output_path, index=False, encoding=self.encoder.target_encoding)
            logger.info(f"Saved processed data to {output_path}")
            return output_path
        except Exception as e:
            if self.graceful_mode:
                # Try alternative save methods
                try:
                    # Try without encoding specification
                    df.to_csv(output_path, index=False)
                    result["warnings"].append({
                        "stage": "save",
                        "message": "Saved with default encoding"
                    })
                    return output_path
                except:
                    # Try Excel format as last resort
                    excel_path = output_path.replace('.csv', '.xlsx')
                    df.to_excel(excel_path, index=False)
                    result["warnings"].append({
                        "stage": "save",
                        "message": "Saved as Excel file instead of CSV"
                    })
                    return excel_path
            else:
                raise
    
    async def _save_partial_data(self, df: pd.DataFrame, file_info: Dict[str, Any]) -> str:
        """Save partial results"""
        output_dir = Path(self.config.get("output_directory", "/tmp/csv_processor/output"))
        partial_dir = output_dir / "partial"
        partial_dir.mkdir(parents=True, exist_ok=True)
        
        filename = file_info["filename"]
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        base_name = Path(filename).stem
        extension = Path(filename).suffix
        
        partial_filename = f"{base_name}_partial_{timestamp}{extension}"
        partial_path = partial_dir / partial_filename
        
        df.to_csv(partial_path, index=False)
        logger.info(f"Saved partial data to {partial_path}")
        
        return str(partial_path)
    
    def _handle_file_error(self, file_info: Dict[str, Any], error: Exception):
        """Handle errors for individual files"""
        error_info = {
            "file": file_info.get("filename", "unknown"),
            "error": str(error),
            "error_type": type(error).__name__,
            "traceback": traceback.format_exc(),
            "timestamp": datetime.utcnow()
        }
        
        self.errors.append(error_info)
        
        logger.error(
            f"Error processing file {file_info.get('filename', 'unknown')}",
            error=error,
            file=file_info.get("filename")
        )
    
    def _determine_final_status(self):
        """Determine the final pipeline status"""
        total_files = len(self.processed_files)
        failed_files = sum(1 for f in self.processed_files if f["status"] == "failed")
        partial_files = sum(1 for f in self.processed_files if f["status"] == "partial_success")
        warning_files = sum(1 for f in self.processed_files if "warnings" in f["status"])
        
        if total_files == 0:
            self.status = "no_files_processed"
        elif failed_files == total_files:
            self.status = "all_failed"
        elif failed_files > 0:
            self.status = "completed_with_errors"
        elif partial_files > 0:
            self.status = "completed_with_partial"
        elif warning_files > 0:
            self.status = "completed_with_warnings"
        else:
            self.status = "completed"
    
    def _get_output_path(self, file_info: Dict[str, Any]) -> str:
        """Generate output path for processed file"""
        output_dir = self.config.get("output_directory", "/tmp/csv_processor/output")
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        
        filename = file_info["filename"]
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        base_name = Path(filename).stem
        extension = Path(filename).suffix
        
        output_filename = f"{base_name}_processed_{timestamp}{extension}"
        return str(Path(output_dir) / output_filename)
    
    def get_summary(self) -> Dict[str, Any]:
        """Get pipeline execution summary"""
        summary = {
            "pipeline_id": self.pipeline_id,
            "status": self.status,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "duration": (self.end_time - self.start_time).total_seconds() if self.end_time else None,
            "files_processed": len(self.processed_files),
            "successful_files": len([f for f in self.processed_files if f["status"] == "completed"]),
            "failed_files": len([f for f in self.processed_files if f["status"] == "failed"]),
            "partial_files": len([f for f in self.processed_files if f["status"] == "partial_success"]),
            "warning_files": len([f for f in self.processed_files if "warnings" in f.get("status", "")]),
            "errors": self.errors,
            "warnings": self.warnings,
            "partial_results": self.partial_results,
            "processed_files": self.processed_files
        }
        
        return summary
    
    def save_report(self, output_path: Optional[str] = None) -> str:
        """Save pipeline execution report"""
        if not output_path:
            report_dir = Path("/tmp/csv_processor/reports")
            report_dir.mkdir(parents=True, exist_ok=True)
            output_path = str(report_dir / f"pipeline_report_{self.pipeline_id}.json")
        
        report = self.get_summary()
        
        # Convert datetime objects to strings
        def datetime_handler(obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            raise TypeError(f"Object of type {type(obj)} is not JSON serializable")
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, default=datetime_handler, indent=2, ensure_ascii=False)
        
        logger.info(f"Pipeline report saved to {output_path}")
        return output_path