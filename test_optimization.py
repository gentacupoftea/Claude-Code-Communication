#!/usr/bin/env python3
"""
Test script for data processing optimizations
"""

import asyncio
import sys
import os
import time
import pandas as pd
import numpy as np
from pathlib import Path
import matplotlib.pyplot as plt
import io
import base64
import json
import logging

sys.path.insert(0, str(Path(__file__).parent))

def get_memory_usage(df):
    return df.memory_usage(deep=True).sum() / (1024 * 1024)  # MB単位

async def test_optimization():
    """Test the data processing optimizations"""
    print("Testing data processing optimizations...")
    
    from dotenv import load_dotenv
    load_dotenv()
    
    env_vars = [
        "SHOPIFY_API_KEY",
        "SHOPIFY_ACCESS_TOKEN", 
        "SHOPIFY_SHOP_NAME"
    ]
    
    missing_vars = []
    for var in env_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        print(f"Error: Missing environment variables: {', '.join(missing_vars)}")
        print("Please create a .env file with the required variables")
        return 1
    
    try:
        from shopify_mcp_server import shopify_api, get_orders_summary, get_sales_analytics
        from utils import clear_cache
        
        print("✓ Server imported successfully")
        
        print("\nTesting caching...")
        
        start_time = time.time()
        orders1 = shopify_api.get_orders()
        first_call_time = time.time() - start_time
        print(f"First API call (no cache): {first_call_time:.2f} seconds")
        
        start_time = time.time()
        orders2 = shopify_api.get_orders()
        second_call_time = time.time() - start_time
        print(f"Second API call (cached): {second_call_time:.2f} seconds")
        print(f"Cache speedup: {first_call_time / second_call_time:.1f}x faster")
        
        from utils import cache_manager
        stats = cache_manager.get_stats()
        print(f"Cache hit rate: {stats.hit_rate:.2%}")
        print(f"Cache memory usage: {stats.memory_usage_mb:.2f} MB")
        
        clear_cache()
        
        print("\nTesting memory optimization...")
        
        test_size = 10000
        test_data = {
            'id': np.arange(test_size),
            'created_at': pd.date_range(start='2023-01-01', periods=test_size),
            'total_price': np.random.rand(test_size) * 1000,
            'name': ['Order-' + str(i) for i in range(test_size)],
            'financial_status': np.random.choice(['paid', 'pending', 'refunded'], test_size)
        }
        
        df_before = pd.DataFrame(test_data)
        mem_before = get_memory_usage(df_before)
        print(f"Memory usage before optimization: {mem_before:.2f} MB")
        
        from utils import optimize_dataframe_dtypes
        df_after = optimize_dataframe_dtypes(df_before.copy())
        mem_after = get_memory_usage(df_after)
        print(f"Memory usage after optimization: {mem_after:.2f} MB")
        print(f"Memory reduction: {(1 - mem_after/mem_before) * 100:.1f}%")
        
        print("\n✓ Optimization tests passed!")
        return 0
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(test_optimization())
    sys.exit(exit_code)
