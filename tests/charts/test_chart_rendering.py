#!/usr/bin/env python3
"""
データ可視化コンポーネントテスト

このモジュールでは、Chart.js連携とチャートコマンド解析機能をテストします。
"""

import os
import json
import unittest
import pytest
from unittest.mock import patch, MagicMock


# テスト対象のモジュールをインポート
try:
    from conea.visualization import ChartCommandParser, ChartRenderer
    from conea.visualization.types import ChartType, ChartData
except ImportError:
    # テスト実行環境に応じてインポートパスを調整
    import sys
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
    try:
        from src.visualization import ChartCommandParser, ChartRenderer
        from src.visualization.types import ChartType, ChartData
    except ImportError:
        # モックオブジェクトを使用してテストを続行
        ChartCommandParser = MagicMock()
        ChartRenderer = MagicMock()
        
        class ChartType:
            BAR = "bar"
            LINE = "line"
            PIE = "pie"
            SCATTER = "scatter"
            RADAR = "radar"
            
        class ChartData:
            def __init__(self, labels=None, datasets=None, type=None):
                self.labels = labels or []
                self.datasets = datasets or []
                self.type = type or ChartType.BAR


@pytest.mark.charts
class ChartRenderingTests(unittest.TestCase):
    """チャートレンダリングのテスト"""

    def test_chart_command_parsing(self):
        """チャートコマンドの解析をテスト"""
        parser = ChartCommandParser()
        
        # 基本的な棒グラフコマンド
        command = """
        /chart bar
        labels: Jan, Feb, Mar, Apr, May
        data: 12, 19, 3, 5, 2
        title: Monthly Sales
        """
        
        result = parser.parse(command)
        
        self.assertEqual(result.type, ChartType.BAR)
        self.assertEqual(result.labels, ["Jan", "Feb", "Mar", "Apr", "May"])
        self.assertEqual(len(result.datasets), 1)
        self.assertEqual(result.datasets[0]["data"], [12, 19, 3, 5, 2])
        self.assertEqual(result.title, "Monthly Sales")
        
        # 複数データセットの折れ線グラフ
        command = """
        /chart line
        labels: Q1, Q2, Q3, Q4
        data: [10, 15, 20, 25]
        dataset: Team A
        data: [15, 10, 12, 18]
        dataset: Team B
        title: Quarterly Performance
        """
        
        result = parser.parse(command)
        
        self.assertEqual(result.type, ChartType.LINE)
        self.assertEqual(result.labels, ["Q1", "Q2", "Q3", "Q4"])
        self.assertEqual(len(result.datasets), 2)
        self.assertEqual(result.datasets[0]["label"], "Team A")
        self.assertEqual(result.datasets[0]["data"], [10, 15, 20, 25])
        self.assertEqual(result.datasets[1]["label"], "Team B")
        self.assertEqual(result.datasets[1]["data"], [15, 10, 12, 18])
        
        # 散布図コマンド
        command = """
        /chart scatter
        data: [[1, 2], [2, 3], [3, 4], [4, 5]]
        title: Simple Correlation
        """
        
        result = parser.parse(command)
        
        self.assertEqual(result.type, ChartType.SCATTER)
        self.assertEqual(len(result.datasets), 1)
        self.assertEqual(result.datasets[0]["data"], [[1, 2], [2, 3], [3, 4], [4, 5]])

    def test_invalid_chart_commands(self):
        """無効なチャートコマンドの処理をテスト"""
        parser = ChartCommandParser()
        
        # 存在しないチャートタイプ
        command = """
        /chart unknown
        labels: A, B, C
        data: 1, 2, 3
        """
        
        with self.assertRaises(ValueError):
            parser.parse(command)
        
        # データなしのコマンド
        command = """
        /chart bar
        labels: A, B, C
        """
        
        with self.assertRaises(ValueError):
            parser.parse(command)
        
        # ラベルと数値の不一致
        command = """
        /chart bar
        labels: A, B
        data: 1, 2, 3
        """
        
        with self.assertRaises(ValueError):
            parser.parse(command)

    def test_chart_renderer_init(self):
        """ChartRendererの初期化テスト"""
        renderer = ChartRenderer()
        
        # デフォルト設定の確認
        self.assertEqual(renderer.default_width, 800)
        self.assertEqual(renderer.default_height, 400)
        self.assertTrue(hasattr(renderer, "render"))

    def test_bar_chart_rendering(self):
        """棒グラフのレンダリングテスト"""
        renderer = ChartRenderer()
        
        chart_data = ChartData(
            type=ChartType.BAR,
            labels=["Red", "Blue", "Yellow", "Green", "Purple"],
            datasets=[{
                "label": "Dataset 1",
                "data": [12, 19, 3, 5, 2],
                "backgroundColor": [
                    "rgba(255, 99, 132, 0.2)",
                    "rgba(54, 162, 235, 0.2)",
                    "rgba(255, 206, 86, 0.2)",
                    "rgba(75, 192, 192, 0.2)",
                    "rgba(153, 102, 255, 0.2)"
                ]
            }]
        )
        
        # レンダリング結果のテスト（JSONとして取得）
        json_config = renderer.get_config_json(chart_data)
        config = json.loads(json_config)
        
        self.assertEqual(config["type"], "bar")
        self.assertEqual(config["data"]["labels"], ["Red", "Blue", "Yellow", "Green", "Purple"])
        self.assertEqual(len(config["data"]["datasets"]), 1)
        self.assertEqual(config["data"]["datasets"][0]["data"], [12, 19, 3, 5, 2])

    def test_line_chart_rendering(self):
        """折れ線グラフのレンダリングテスト"""
        renderer = ChartRenderer()
        
        chart_data = ChartData(
            type=ChartType.LINE,
            labels=["January", "February", "March", "April", "May"],
            datasets=[{
                "label": "My First Dataset",
                "data": [65, 59, 80, 81, 56],
                "fill": False,
                "borderColor": "rgb(75, 192, 192)",
                "tension": 0.1
            }]
        )
        
        # レンダリング結果のテスト
        json_config = renderer.get_config_json(chart_data)
        config = json.loads(json_config)
        
        self.assertEqual(config["type"], "line")
        self.assertEqual(config["data"]["labels"], ["January", "February", "March", "April", "May"])
        self.assertEqual(config["data"]["datasets"][0]["borderColor"], "rgb(75, 192, 192)")
        self.assertEqual(config["data"]["datasets"][0]["tension"], 0.1)

    def test_pie_chart_rendering(self):
        """円グラフのレンダリングテスト"""
        renderer = ChartRenderer()
        
        chart_data = ChartData(
            type=ChartType.PIE,
            labels=["Red", "Blue", "Yellow"],
            datasets=[{
                "label": "My First Dataset",
                "data": [300, 50, 100],
                "backgroundColor": [
                    "rgb(255, 99, 132)",
                    "rgb(54, 162, 235)",
                    "rgb(255, 205, 86)"
                ]
            }]
        )
        
        # レンダリング結果のテスト
        json_config = renderer.get_config_json(chart_data)
        config = json.loads(json_config)
        
        self.assertEqual(config["type"], "pie")
        self.assertEqual(config["data"]["labels"], ["Red", "Blue", "Yellow"])
        self.assertEqual(config["data"]["datasets"][0]["data"], [300, 50, 100])

    def test_radar_chart_rendering(self):
        """レーダーチャートのレンダリングテスト"""
        renderer = ChartRenderer()
        
        chart_data = ChartData(
            type=ChartType.RADAR,
            labels=["Eating", "Drinking", "Sleeping", "Designing", "Coding", "Cycling", "Running"],
            datasets=[{
                "label": "My First Dataset",
                "data": [65, 59, 90, 81, 56, 55, 40],
                "fill": True,
                "backgroundColor": "rgba(255, 99, 132, 0.2)",
                "borderColor": "rgb(255, 99, 132)",
                "pointBackgroundColor": "rgb(255, 99, 132)",
                "pointBorderColor": "#fff",
                "pointHoverBackgroundColor": "#fff",
                "pointHoverBorderColor": "rgb(255, 99, 132)"
            }]
        )
        
        # レンダリング結果のテスト
        json_config = renderer.get_config_json(chart_data)
        config = json.loads(json_config)
        
        self.assertEqual(config["type"], "radar")
        self.assertEqual(len(config["data"]["labels"]), 7)
        self.assertEqual(config["data"]["datasets"][0]["fill"], True)


if __name__ == "__main__":
    unittest.main()