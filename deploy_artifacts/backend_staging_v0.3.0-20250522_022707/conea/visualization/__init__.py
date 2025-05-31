"""
Data visualization components
"""

import json
import re
from .types import ChartType, ChartData

class ChartCommandParser:
    """Parser for chart commands"""
    
    def parse(self, command):
        """Parse chart command string
        
        Args:
            command (str): Command string starting with /chart
            
        Returns:
            ChartData: Parsed chart data
            
        Raises:
            ValueError: If command is invalid
        """
        lines = [line.strip() for line in command.strip().split('\n') if line.strip()]
        
        # Extract command and chart type
        if not lines or not lines[0].startswith('/chart'):
            raise ValueError("Invalid chart command: must start with /chart")
            
        parts = lines[0].split()
        if len(parts) < 2:
            raise ValueError("Chart type not specified")
            
        chart_type = parts[1].lower()
        if not hasattr(ChartType, chart_type.upper()):
            raise ValueError(f"Unknown chart type: {chart_type}")
            
        # Initialize chart data
        labels = []
        datasets = []
        title = None
        current_dataset = {"data": []}
        
        # Parse other lines
        for line in lines[1:]:
            if ':' not in line:
                continue
                
            key, value = line.split(':', 1)
            key = key.strip().lower()
            value = value.strip()
            
            if key == 'labels':
                labels = [label.strip() for label in value.split(',')]
            elif key == 'data':
                try:
                    # Try to parse as JSON array
                    if value.startswith('[') and value.endswith(']'):
                        current_dataset["data"] = json.loads(value)
                    else:
                        # Parse as comma-separated list
                        current_dataset["data"] = [int(x.strip()) for x in value.split(',')]
                except:
                    raise ValueError(f"Invalid data format: {value}")
            elif key == 'dataset':
                # Save current dataset and start a new one
                if current_dataset.get("data"):
                    if "label" not in current_dataset:
                        current_dataset["label"] = f"Dataset {len(datasets) + 1}"
                    datasets.append(current_dataset)
                current_dataset = {"label": value, "data": []}
            elif key == 'title':
                title = value
        
        # Add last dataset if not empty
        if current_dataset.get("data"):
            if "label" not in current_dataset:
                current_dataset["label"] = f"Dataset {len(datasets) + 1}"
            datasets.append(current_dataset)
            
        # Validate datasets
        if not datasets:
            raise ValueError("No data provided")
            
        # Validate labels and data match for non-scatter charts
        if chart_type != ChartType.SCATTER and labels:
            for dataset in datasets:
                if len(dataset["data"]) != len(labels):
                    raise ValueError(f"Number of data points ({len(dataset['data'])}) doesn't match number of labels ({len(labels)})")
        
        # Create chart data object
        result = ChartData(
            type=getattr(ChartType, chart_type.upper()),
            labels=labels,
            datasets=datasets
        )
        if title:
            result.title = title
            
        return result


class ChartRenderer:
    """Renderer for chart data"""
    
    def __init__(self, default_width=800, default_height=400):
        """Initialize chart renderer
        
        Args:
            default_width (int): Default chart width
            default_height (int): Default chart height
        """
        self.default_width = default_width
        self.default_height = default_height
        
    def get_config_json(self, chart_data):
        """Get Chart.js configuration as JSON
        
        Args:
            chart_data (ChartData): Chart data object
            
        Returns:
            str: JSON configuration for Chart.js
        """
        config = {
            "type": chart_data.type,
            "data": {
                "labels": chart_data.labels,
                "datasets": chart_data.datasets
            },
            "options": {
                "responsive": True,
                "maintainAspectRatio": True
            }
        }
        
        # Add title if present
        if hasattr(chart_data, 'title') and chart_data.title:
            config["options"]["plugins"] = {
                "title": {
                    "display": True,
                    "text": chart_data.title
                }
            }
            
        return json.dumps(config, indent=2)
        
    def render(self, chart_data, output_format="html"):
        """Render chart to specified format
        
        Args:
            chart_data (ChartData): Chart data object
            output_format (str): Output format (html, svg, etc.)
            
        Returns:
            str: Rendered chart
        """
        # This is a simplified mock for testing
        if output_format == "html":
            config = self.get_config_json(chart_data)
            return f"""<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <div style="width:{self.default_width}px; height:{self.default_height}px;">
    <canvas id="chart"></canvas>
  </div>
  <script>
    const ctx = document.getElementById('chart');
    new Chart(ctx, {config});
  </script>
</body>
</html>"""
        else:
            raise ValueError(f"Unsupported output format: {output_format}")