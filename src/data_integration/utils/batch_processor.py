"""Batch processing utilities for efficient data handling."""

import asyncio
from typing import List, Dict, Any, Callable, Optional, TypeVar, Generic
from dataclasses import dataclass
import time
from concurrent.futures import ThreadPoolExecutor
import logging

T = TypeVar('T')
R = TypeVar('R')

@dataclass
class BatchResult:
    """バッチ処理の結果を保持します。"""
    success_count: int
    failure_count: int
    results: List[Any]
    errors: List[Exception]
    processing_time: float

class BatchProcessor(Generic[T, R]):
    """効率的なバッチ処理を提供します。"""
    
    def __init__(
        self,
        batch_size: int = 100,
        max_workers: int = 5,
        retry_count: int = 3,
        retry_delay: float = 1.0
    ):
        self.batch_size = batch_size
        self.max_workers = max_workers
        self.retry_count = retry_count
        self.retry_delay = retry_delay
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self.logger = logging.getLogger(__name__)
    
    def process_batch(
        self,
        items: List[T],
        processor: Callable[[T], R],
        error_handler: Optional[Callable[[T, Exception], R]] = None
    ) -> BatchResult:
        """バッチを処理します。"""
        start_time = time.time()
        results = []
        errors = []
        
        futures = []
        for item in items:
            future = self.executor.submit(self._process_item, item, processor, error_handler)
            futures.append((item, future))
        
        for item, future in futures:
            try:
                result = future.result()
                results.append(result)
            except Exception as e:
                self.logger.error(f"Failed to process item: {item}, error: {e}")
                errors.append(e)
                if error_handler:
                    try:
                        result = error_handler(item, e)
                        results.append(result)
                    except Exception as handler_error:
                        self.logger.error(f"Error handler failed: {handler_error}")
                        errors.append(handler_error)
        
        processing_time = time.time() - start_time
        
        return BatchResult(
            success_count=len(results) - len(errors),
            failure_count=len(errors),
            results=results,
            errors=errors,
            processing_time=processing_time
        )
    
    def _process_item(
        self,
        item: T,
        processor: Callable[[T], R],
        error_handler: Optional[Callable[[T, Exception], R]]
    ) -> R:
        """アイテムを処理し、リトライを行います。"""
        for attempt in range(self.retry_count):
            try:
                return processor(item)
            except Exception as e:
                if attempt == self.retry_count - 1:
                    raise e
                self.logger.warning(f"Processing failed, retrying... Attempt {attempt + 1}/{self.retry_count}")
                time.sleep(self.retry_delay * (attempt + 1))
        
        raise Exception("Max retry attempts reached")
    
    async def process_batch_async(
        self,
        items: List[T],
        processor: Callable[[T], asyncio.Future[R]],
        error_handler: Optional[Callable[[T, Exception], R]] = None
    ) -> BatchResult:
        """非同期バッチ処理を実行します。"""
        start_time = time.time()
        
        tasks = []
        for item in items:
            task = self._process_item_async(item, processor, error_handler)
            tasks.append(task)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        successful_results = []
        errors = []
        
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                errors.append(result)
                if error_handler:
                    try:
                        handled_result = error_handler(items[i], result)
                        successful_results.append(handled_result)
                    except Exception as handler_error:
                        errors.append(handler_error)
            else:
                successful_results.append(result)
        
        processing_time = time.time() - start_time
        
        return BatchResult(
            success_count=len(successful_results),
            failure_count=len(errors),
            results=successful_results,
            errors=errors,
            processing_time=processing_time
        )
    
    async def _process_item_async(
        self,
        item: T,
        processor: Callable[[T], asyncio.Future[R]],
        error_handler: Optional[Callable[[T, Exception], R]]
    ) -> R:
        """非同期でアイテムを処理します。"""
        for attempt in range(self.retry_count):
            try:
                return await processor(item)
            except Exception as e:
                if attempt == self.retry_count - 1:
                    raise e
                await asyncio.sleep(self.retry_delay * (attempt + 1))
        
        raise Exception("Max retry attempts reached")
    
    def process_streaming(
        self,
        items_generator: Callable[[], T],
        processor: Callable[[T], R],
        error_handler: Optional[Callable[[T, Exception], R]] = None
    ) -> BatchResult:
        """ストリーミングデータを処理します。"""
        results = []
        errors = []
        batch = []
        
        start_time = time.time()
        
        try:
            while True:
                try:
                    item = next(items_generator())
                    batch.append(item)
                    
                    if len(batch) >= self.batch_size:
                        batch_result = self.process_batch(batch, processor, error_handler)
                        results.extend(batch_result.results)
                        errors.extend(batch_result.errors)
                        batch = []
                        
                except StopIteration:
                    break
        
        finally:
            # Process remaining items
            if batch:
                batch_result = self.process_batch(batch, processor, error_handler)
                results.extend(batch_result.results)
                errors.extend(batch_result.errors)
        
        processing_time = time.time() - start_time
        
        return BatchResult(
            success_count=len(results) - len(errors),
            failure_count=len(errors),
            results=results,
            errors=errors,
            processing_time=processing_time
        )
    
    def optimize_batch_size(self, total_items: int, avg_processing_time: float) -> int:
        """最適なバッチサイズを計算します。"""
        # Simple optimization based on processing time and total items
        target_batch_time = 5.0  # Target 5 seconds per batch
        
        if avg_processing_time > 0:
            optimal_size = int(target_batch_time / avg_processing_time)
            optimal_size = max(10, min(optimal_size, 1000))  # Clamp between 10 and 1000
        else:
            optimal_size = self.batch_size
        
        return min(optimal_size, total_items)
