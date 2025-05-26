#!/usr/bin/env python3
"""
Test script to verify autonomous system can be imported without expensive dependencies
"""

import sys
import warnings
import os

print("Testing autonomous system import without expensive dependencies...")
print(f"Python version: {sys.version}")
print(f"Current directory: {os.getcwd()}")

# Capture warnings
warnings.simplefilter("always")

try:
    print("\n1. Testing basic autonomous system import...")
    import autonomous_system
    print(f"✅ Successfully imported autonomous_system v{autonomous_system.__version__}")
    
    print("\n2. Testing core components...")
    print(f"Available components: {len(autonomous_system.__all__)}")
    
    print("\n3. Testing monitoring components...")
    from autonomous_system.monitoring import SystemMonitor, ErrorDetector
    print("✅ Successfully imported monitoring components")
    
    # Test creating instances with fallback mode
    print("\n4. Testing component initialization...")
    
    monitor = SystemMonitor()
    print("✅ SystemMonitor created")
    
    detector = ErrorDetector()
    print("✅ ErrorDetector created")
    
    print("\n5. Testing basic functionality...")
    status = monitor.get_current_status()
    print(f"Monitor status: {status}")
    
    errors = detector.get_detected_errors()
    print(f"Error count: {len(errors)}")
    
    print("\n6. Testing package info...")
    info = autonomous_system.get_package_info()
    print(f"Package features: {len(info['features'])}")
    
    print("\n✅ All tests passed! The autonomous system can be imported and used in minimal environments.")
    
except ImportError as e:
    print(f"❌ Import error: {e}")
    sys.exit(1)
except Exception as e:
    print(f"❌ Unexpected error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n🎉 Autonomous system is ready for use in minimal environments!")