"""
Chart types and data structure definitions
"""

class ChartType:
    """Chart type constants"""
    BAR = "bar"
    LINE = "line"
    PIE = "pie"
    SCATTER = "scatter"
    RADAR = "radar"
    
class ChartData:
    """Chart data container"""
    
    def __init__(self, labels=None, datasets=None, type=None):
        """Initialize chart data
        
        Args:
            labels (list): Data labels
            datasets (list): List of datasets
            type (str): Chart type from ChartType
        """
        self.labels = labels or []
        self.datasets = datasets or []
        self.type = type or ChartType.BAR