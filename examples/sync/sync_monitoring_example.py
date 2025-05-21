"""
Example demonstrating the sync monitoring system.

This example shows how to use the sync metrics collector and dashboard
to monitor synchronization operations in real-world usage.
"""

import os
import time
import logging
import random
from datetime import datetime

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Import sync manager and monitoring components
from src.sync.sync_manager import SyncManager, SyncDirection, SyncStatus
from src.sync.sync_metrics_collector import SyncMetricsCollector
from src.sync.sync_dashboard import SyncDashboard


def main():
    """Run the sync monitoring example."""
    print("Starting Sync Monitoring Example")
    
    # Create a mock sync manager for demonstration
    sync_manager = create_mock_sync_manager()
    
    # Create metrics collector
    metrics_collector = SyncMetricsCollector(
        sync_manager=sync_manager,
        collection_interval=5,  # Collect every 5 seconds for demo
        retention_period=300    # Retain for 5 minutes for demo
    )
    
    # Create dashboard
    dashboard = SyncDashboard(
        metrics_collector=metrics_collector,
        dashboard_title="Shopify Sync Monitoring",
        refresh_interval=5      # Refresh every 5 seconds for demo
    )
    
    # Generate sample data
    print("Generating sample sync metrics data...")
    generate_sample_data(metrics_collector, sync_manager)
    
    # Create output directory
    output_dir = os.path.join(os.path.dirname(__file__), 'output')
    os.makedirs(output_dir, exist_ok=True)
    
    # Generate and save reports
    html_path = os.path.join(output_dir, 'sync_dashboard.html')
    text_path = os.path.join(output_dir, 'sync_report.txt')
    csv_path = os.path.join(output_dir, 'sync_metrics.csv')
    json_path = os.path.join(output_dir, 'sync_metrics.json')
    
    print(f"Saving dashboard to {html_path}")
    dashboard.save_dashboard_html(html_path)
    
    print(f"Saving text report to {text_path}")
    dashboard.save_text_report(text_path)
    
    print(f"Exporting metrics as CSV to {csv_path}")
    dashboard.export_metrics_csv(csv_path)
    
    print(f"Exporting metrics as JSON to {json_path}")
    with open(json_path, 'w') as f:
        f.write(metrics_collector.export_metrics_json())
    
    print("\nSync monitoring reports have been generated.")
    print(f"HTML dashboard: {html_path}")
    print(f"Text report: {text_path}")
    print(f"CSV export: {csv_path}")
    print(f"JSON export: {json_path}")
    
    # Stop metrics collection
    metrics_collector.stop_collection()
    
    print("\nExample completed. Check the output files for results.")


def create_mock_sync_manager():
    """Create a mock sync manager for demonstration purposes."""
    # Create a simple mock for demo
    sync_manager = SyncManager()
    
    # Add some sample jobs
    sync_manager.active_jobs = {
        'job1': {
            'id': 'job1',
            'entity_type': 'product',
            'direction': SyncDirection.SHOPIFY_TO_EXTERNAL.value,
            'status': SyncStatus.IN_PROGRESS.value,
            'created_at': datetime.now().isoformat(),
            'total_entities': 150,
            'processed_entities': 75
        },
        'job2': {
            'id': 'job2',
            'entity_type': 'order',
            'direction': SyncDirection.EXTERNAL_TO_SHOPIFY.value,
            'status': SyncStatus.PENDING.value,
            'created_at': datetime.now().isoformat(),
            'total_entities': 80,
            'processed_entities': 0
        },
        'job3': {
            'id': 'job3',
            'entity_type': 'inventory',
            'direction': SyncDirection.BIDIRECTIONAL.value,
            'status': SyncStatus.COMPLETED.value,
            'created_at': datetime.now().isoformat(),
            'total_entities': 200,
            'processed_entities': 200,
            'successful_entities': 190,
            'failed_entities': 10
        }
    }
    
    return sync_manager


def generate_sample_data(metrics_collector, sync_manager):
    """Generate sample metrics data for demonstration."""
    # Simulate different entity types
    entity_types = ['product', 'order', 'inventory', 'customer']
    
    # Simulate different error types
    error_types = [
        'connection_timeout', 'auth_failure', 'validation_error', 
        'rate_limit_exceeded', 'data_format_error'
    ]
    
    # Generate sync results data
    for i in range(100):
        # Randomize values for demonstration
        entity_type = random.choice(entity_types)
        success = random.random() > 0.2  # 80% success rate
        partial = False if success else random.random() > 0.5  # Some failures are partial
        duration = random.uniform(0.5, 3.0)
        entities_count = random.randint(1, 20)
        data_size = random.randint(512, 10240)
        
        # Record sync result
        metrics_collector.record_sync_result(
            job_id=f'demo_job_{i}',
            entity_type=entity_type,
            success=success,
            partial=partial,
            duration=duration,
            entities_count=entities_count,
            data_size=data_size
        )
        
        # Record API calls
        api_types = ['shopify', 'external']
        for api_type in api_types:
            api_success = random.random() > 0.1  # 90% API success rate
            metrics_collector.record_api_call(
                api_type=api_type,
                endpoint=f'/{entity_type}s',
                success=api_success,
                duration=random.uniform(0.1, 1.0),
                request_size=random.randint(100, 1000),
                response_size=random.randint(500, 5000) if api_success else 0
            )
        
        # Record some errors
        if not success:
            metrics_collector.record_error(
                random.choice(error_types),
                entity_type
            )
        
        # Sleep briefly to simulate time passing
        time.sleep(0.01)
    
    # Force collection of metrics
    metrics_collector.collect_metrics()


if __name__ == "__main__":
    main()