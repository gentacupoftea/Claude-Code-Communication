#!/usr/bin/env python3
"""
OptimizedCacheManager - パフォーマンス分析スクリプト
目的：キャッシュのパフォーマンスメトリクスを収集、分析し、改善推奨事項を提案する
"""
import argparse
import json
import os
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
import re
import csv
import matplotlib
matplotlib.use('Agg')  # GUIなしで実行するためのバックエンド設定
import matplotlib.pyplot as plt
import numpy as np

# スクリプトとプロジェクトのパス
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SCRIPTS_DIR = os.path.dirname(SCRIPT_DIR)
PROJECT_ROOT = os.path.dirname(SCRIPTS_DIR)
METRICS_DIR = os.path.join(SCRIPT_DIR, "metrics")

# メトリクスディレクトリの作成
os.makedirs(METRICS_DIR, exist_ok=True)

def print_section(title):
    """セクションタイトルを表示"""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)

def collect_prometheus_metrics(start_time=None, end_time=None, step="5m"):
    """
    Prometheusからメトリクスを収集する
    
    Args:
        start_time: 開始時間（Unix時間またはdatetime）
        end_time: 終了時間（Unix時間またはdatetime）
        step: 時間ステップ（e.g. "5m", "1h"）
        
    Returns:
        dict: 収集したメトリクスデータ
    """
    try:
        import requests
    except ImportError:
        print("requestsモジュールが必要です。pip install requestsでインストールしてください。")
        sys.exit(1)
    
    # 時間範囲の設定
    if start_time is None:
        start_time = datetime.now() - timedelta(hours=24)
    if end_time is None:
        end_time = datetime.now()
    
    # datetime型をUnix時間に変換
    if isinstance(start_time, datetime):
        start_time = int(start_time.timestamp())
    if isinstance(end_time, datetime):
        end_time = int(end_time.timestamp())
    
    # 収集するメトリクス
    metrics = [
        "cache_hit_rate",
        "cache_memory_usage",
        "cache_memory_limit",
        "redis_memory_used",
        "redis_memory_limit",
        "redis_connections",
        "cache_response_time",
        "uncached_response_time",
        "cache_operations_total",
        "cache_error_count"
    ]
    
    base_url = "http://localhost:9090/api/v1/query_range"
    results = {}
    
    print("Prometheusからメトリクスを収集中...")
    
    for metric in metrics:
        params = {
            "query": metric,
            "start": start_time,
            "end": end_time,
            "step": step
        }
        
        try:
            response = requests.get(base_url, params=params)
            response.raise_for_status()
            data = response.json()
            
            if data["status"] == "success" and data["data"]["result"]:
                results[metric] = data["data"]["result"]
            else:
                print(f"警告: メトリクス '{metric}' のデータがありません")
        except requests.exceptions.RequestException as e:
            print(f"エラー: Prometheusからメトリクス '{metric}' の取得に失敗しました: {e}")
    
    # 収集したデータをファイルに保存
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = os.path.join(METRICS_DIR, f"prometheus_metrics_{timestamp}.json")
    
    with open(output_file, "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"メトリクスデータを保存しました: {output_file}")
    return results, output_file

def parse_log_files(log_dir, pattern=None):
    """
    ログファイルからキャッシュ関連のエントリを抽出し分析する
    
    Args:
        log_dir: ログファイルのディレクトリパス
        pattern: 検索するパターン（正規表現）
        
    Returns:
        dict: 分析結果
    """
    if pattern is None:
        pattern = r"cache|redis|OptimizedCacheManager"
    
    log_pattern = re.compile(pattern, re.IGNORECASE)
    error_pattern = re.compile(r"error|exception|fail", re.IGNORECASE)
    warning_pattern = re.compile(r"warn|warning", re.IGNORECASE)
    
    results = {
        "total_entries": 0,
        "cache_entries": 0,
        "error_entries": 0,
        "warning_entries": 0,
        "errors": [],
        "warnings": [],
        "timestamps": []
    }
    
    log_files = []
    if os.path.isdir(log_dir):
        for root, _, files in os.walk(log_dir):
            for file in files:
                if file.endswith((".log", ".txt")):
                    log_files.append(os.path.join(root, file))
    elif os.path.isfile(log_dir) and log_dir.endswith((".log", ".txt")):
        log_files = [log_dir]
    
    if not log_files:
        print(f"警告: ログファイルが見つかりません: {log_dir}")
        return results
    
    print(f"{len(log_files)}個のログファイルを分析中...")
    
    for log_file in log_files:
        try:
            with open(log_file, "r") as f:
                for line in f:
                    results["total_entries"] += 1
                    
                    # タイムスタンプの抽出（一般的なログ形式）
                    timestamp_match = re.search(r"\d{4}[-/]\d{2}[-/]\d{2}[\sT]\d{2}:\d{2}:\d{2}", line)
                    if timestamp_match:
                        results["timestamps"].append(timestamp_match.group(0))
                    
                    if log_pattern.search(line):
                        results["cache_entries"] += 1
                        
                        if error_pattern.search(line):
                            results["error_entries"] += 1
                            results["errors"].append(line.strip())
                        
                        if warning_pattern.search(line):
                            results["warning_entries"] += 1
                            results["warnings"].append(line.strip())
        except Exception as e:
            print(f"警告: ログファイル '{log_file}' の読み込み中にエラーが発生しました: {e}")
    
    # 最新のエラーとワーニングのみを保持（長すぎる場合）
    max_entries = 100
    if len(results["errors"]) > max_entries:
        results["errors"] = results["errors"][-max_entries:]
    if len(results["warnings"]) > max_entries:
        results["warnings"] = results["warnings"][-max_entries:]
    
    # 分析結果をファイルに保存
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = os.path.join(METRICS_DIR, f"log_analysis_{timestamp}.json")
    
    with open(output_file, "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"ログ分析結果を保存しました: {output_file}")
    return results, output_file

def compare_performance(before_file, after_file):
    """
    キャッシュ有効化前後のパフォーマンスを比較する
    
    Args:
        before_file: キャッシュ有効化前のパフォーマンスデータファイル
        after_file: キャッシュ有効化後のパフォーマンスデータファイル
        
    Returns:
        dict: 比較結果
    """
    # データファイルの読み込み
    before_data = None
    after_data = None
    
    try:
        with open(before_file, "r") as f:
            before_data = json.load(f)
    except Exception as e:
        print(f"エラー: ファイル '{before_file}' の読み込みに失敗しました: {e}")
        return None
    
    try:
        with open(after_file, "r") as f:
            after_data = json.load(f)
    except Exception as e:
        print(f"エラー: ファイル '{after_file}' の読み込みに失敗しました: {e}")
        return None
    
    # データ形式のチェック
    if not isinstance(before_data, dict) or not isinstance(after_data, dict):
        print("エラー: 無効なデータ形式です。パフォーマンスデータはJSON辞書形式である必要があります。")
        return None
    
    # 比較結果
    results = {
        "response_time_improvement": {},
        "memory_usage_comparison": {},
        "hit_rate": {},
        "error_rate_comparison": {},
        "summary": {}
    }
    
    # レスポンス時間の改善
    if "endpoints" in before_data and "endpoints" in after_data:
        for endpoint in set(before_data["endpoints"].keys()) & set(after_data["endpoints"].keys()):
            before_avg = before_data["endpoints"][endpoint].get("avg_time", 0)
            after_avg = after_data["endpoints"][endpoint].get("avg_time", 0)
            
            if before_avg > 0:
                improvement = ((before_avg - after_avg) / before_avg) * 100
                results["response_time_improvement"][endpoint] = {
                    "before_ms": before_avg,
                    "after_ms": after_avg,
                    "improvement_percent": improvement
                }
    
    # 平均改善率
    if results["response_time_improvement"]:
        avg_improvement = sum(item["improvement_percent"] for item in results["response_time_improvement"].values()) / len(results["response_time_improvement"])
        results["summary"]["avg_response_time_improvement"] = avg_improvement
    
    # ヒット率
    if "cache_metrics" in after_data:
        results["hit_rate"] = after_data["cache_metrics"].get("hit_rate", {})
        results["summary"]["overall_hit_rate"] = after_data["cache_metrics"].get("overall_hit_rate", 0)
    
    # エラー率
    if "error_count" in before_data and "error_count" in after_data:
        before_errors = before_data.get("error_count", 0)
        after_errors = after_data.get("error_count", 0)
        before_requests = before_data.get("total_requests", 1)  # ゼロ除算防止
        after_requests = after_data.get("total_requests", 1)  # ゼロ除算防止
        
        before_rate = (before_errors / before_requests) * 100
        after_rate = (after_errors / after_requests) * 100
        
        results["error_rate_comparison"] = {
            "before_percent": before_rate,
            "after_percent": after_rate,
            "change": after_rate - before_rate
        }
        
        results["summary"]["error_rate_change"] = after_rate - before_rate
    
    # メモリ使用量
    if "memory_usage" in before_data and "memory_usage" in after_data:
        results["memory_usage_comparison"] = {
            "before_mb": before_data["memory_usage"].get("avg_mb", 0),
            "after_mb": after_data["memory_usage"].get("avg_mb", 0),
            "change_percent": ((after_data["memory_usage"].get("avg_mb", 0) - before_data["memory_usage"].get("avg_mb", 0)) /
                              max(before_data["memory_usage"].get("avg_mb", 1), 1)) * 100
        }
        
        results["summary"]["memory_usage_change_percent"] = results["memory_usage_comparison"]["change_percent"]
    
    # 総合評価
    avg_improvement = results["summary"].get("avg_response_time_improvement", 0)
    hit_rate = results["summary"].get("overall_hit_rate", 0)
    error_change = results["summary"].get("error_rate_change", 0)
    
    if avg_improvement >= 30 and hit_rate >= 70 and error_change <= 0.1:
        performance_rating = "優秀"
    elif avg_improvement >= 15 and hit_rate >= 50 and error_change <= 0.5:
        performance_rating = "良好"
    elif avg_improvement >= 5 and hit_rate >= 30 and error_change <= 1:
        performance_rating = "普通"
    else:
        performance_rating = "要改善"
    
    results["summary"]["performance_rating"] = performance_rating
    
    # 改善推奨事項
    recommendations = []
    
    if hit_rate < 50:
        recommendations.append("キャッシュヒット率が低いです。TTL設定やキー生成ロジックを見直してください。")
    
    if avg_improvement < 10:
        recommendations.append("レスポンス時間の改善率が低いです。キャッシュ対象を見直すか、キャッシュ戦略を再検討してください。")
    
    if error_change > 0.5:
        recommendations.append("キャッシュ導入後にエラー率が上昇しています。キャッシュの整合性や例外処理を確認してください。")
    
    if results["memory_usage_comparison"].get("change_percent", 0) > 50:
        recommendations.append("メモリ使用量が大幅に増加しています。キャッシュサイズやTTL設定を最適化してください。")
    
    results["recommendations"] = recommendations
    
    # 結果をファイルに保存
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = os.path.join(METRICS_DIR, f"performance_comparison_{timestamp}.json")
    
    with open(output_file, "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"パフォーマンス比較結果を保存しました: {output_file}")
    return results, output_file

def analyze_prometheus_data(metrics_data):
    """
    収集したPrometheusメトリクスデータを分析
    
    Args:
        metrics_data: collect_prometheus_metrics()の返り値
        
    Returns:
        dict: 分析結果
    """
    if not metrics_data:
        print("エラー: 分析するメトリクスデータがありません。")
        return None
    
    analysis = {
        "hit_rate": {
            "avg": None,
            "min": None,
            "max": None,
            "trend": None
        },
        "response_time": {
            "cached_avg": None,
            "uncached_avg": None,
            "improvement_percent": None
        },
        "memory_usage": {
            "cache_avg_percent": None,
            "redis_avg_percent": None,
            "trend": None
        },
        "operations": {
            "get_per_minute": None,
            "set_per_minute": None,
            "invalidate_per_minute": None,
            "ratio": None
        },
        "errors": {
            "total": None,
            "per_hour": None,
            "trend": None
        },
        "recommendations": []
    }
    
    # ヒット率の分析
    if "cache_hit_rate" in metrics_data and metrics_data["cache_hit_rate"]:
        hit_rate_values = []
        for result in metrics_data["cache_hit_rate"]:
            for value in result["values"]:
                if value[1] != "NaN":
                    hit_rate_values.append(float(value[1]))
        
        if hit_rate_values:
            analysis["hit_rate"]["avg"] = sum(hit_rate_values) / len(hit_rate_values)
            analysis["hit_rate"]["min"] = min(hit_rate_values)
            analysis["hit_rate"]["max"] = max(hit_rate_values)
            
            # トレンドの分析（後半と前半の比較）
            mid_point = len(hit_rate_values) // 2
            first_half_avg = sum(hit_rate_values[:mid_point]) / max(1, mid_point)
            second_half_avg = sum(hit_rate_values[mid_point:]) / max(1, len(hit_rate_values) - mid_point)
            
            if second_half_avg > first_half_avg * 1.05:
                analysis["hit_rate"]["trend"] = "上昇"
            elif second_half_avg < first_half_avg * 0.95:
                analysis["hit_rate"]["trend"] = "下降"
            else:
                analysis["hit_rate"]["trend"] = "安定"
    
    # レスポンス時間の分析
    cached_times = []
    uncached_times = []
    
    if "cache_response_time" in metrics_data and metrics_data["cache_response_time"]:
        for result in metrics_data["cache_response_time"]:
            for value in result["values"]:
                if value[1] != "NaN":
                    cached_times.append(float(value[1]))
    
    if "uncached_response_time" in metrics_data and metrics_data["uncached_response_time"]:
        for result in metrics_data["uncached_response_time"]:
            for value in result["values"]:
                if value[1] != "NaN":
                    uncached_times.append(float(value[1]))
    
    if cached_times:
        analysis["response_time"]["cached_avg"] = sum(cached_times) / len(cached_times)
    
    if uncached_times:
        analysis["response_time"]["uncached_avg"] = sum(uncached_times) / len(uncached_times)
    
    if analysis["response_time"]["cached_avg"] is not None and analysis["response_time"]["uncached_avg"] is not None:
        improvement = ((analysis["response_time"]["uncached_avg"] - analysis["response_time"]["cached_avg"]) / 
                      analysis["response_time"]["uncached_avg"]) * 100
        analysis["response_time"]["improvement_percent"] = improvement
    
    # メモリ使用量の分析
    cache_memory_usage = []
    cache_memory_limit = []
    redis_memory_used = []
    redis_memory_limit = []
    
    if "cache_memory_usage" in metrics_data and metrics_data["cache_memory_usage"]:
        for result in metrics_data["cache_memory_usage"]:
            for value in result["values"]:
                if value[1] != "NaN":
                    cache_memory_usage.append(float(value[1]))
    
    if "cache_memory_limit" in metrics_data and metrics_data["cache_memory_limit"]:
        for result in metrics_data["cache_memory_limit"]:
            for value in result["values"]:
                if value[1] != "NaN":
                    cache_memory_limit.append(float(value[1]))
    
    if "redis_memory_used" in metrics_data and metrics_data["redis_memory_used"]:
        for result in metrics_data["redis_memory_used"]:
            for value in result["values"]:
                if value[1] != "NaN":
                    redis_memory_used.append(float(value[1]))
    
    if "redis_memory_limit" in metrics_data and metrics_data["redis_memory_limit"]:
        for result in metrics_data["redis_memory_limit"]:
            for value in result["values"]:
                if value[1] != "NaN":
                    redis_memory_limit.append(float(value[1]))
    
    # メモリ使用率の計算
    if cache_memory_usage and cache_memory_limit:
        usage_percentages = [usage / limit * 100 for usage, limit in zip(cache_memory_usage, cache_memory_limit)]
        analysis["memory_usage"]["cache_avg_percent"] = sum(usage_percentages) / len(usage_percentages)
    
    if redis_memory_used and redis_memory_limit:
        redis_percentages = [usage / limit * 100 for usage, limit in zip(redis_memory_used, redis_memory_limit)]
        analysis["memory_usage"]["redis_avg_percent"] = sum(redis_percentages) / len(redis_percentages)
    
    # メモリ使用量のトレンド分析
    if cache_memory_usage:
        mid_point = len(cache_memory_usage) // 2
        first_half_avg = sum(cache_memory_usage[:mid_point]) / max(1, mid_point)
        second_half_avg = sum(cache_memory_usage[mid_point:]) / max(1, len(cache_memory_usage) - mid_point)
        
        if second_half_avg > first_half_avg * 1.10:
            analysis["memory_usage"]["trend"] = "急増"
        elif second_half_avg > first_half_avg * 1.03:
            analysis["memory_usage"]["trend"] = "緩やかに増加"
        elif second_half_avg < first_half_avg * 0.97:
            analysis["memory_usage"]["trend"] = "減少"
        else:
            analysis["memory_usage"]["trend"] = "安定"
    
    # エラー分析
    if "cache_error_count" in metrics_data and metrics_data["cache_error_count"]:
        error_values = []
        
        for result in metrics_data["cache_error_count"]:
            last_value = 0
            for value in result["values"]:
                if value[1] != "NaN":
                    current_value = float(value[1])
                    if current_value > last_value:
                        error_values.append(current_value - last_value)
                    last_value = current_value
        
        if error_values:
            analysis["errors"]["total"] = sum(error_values)
            # 時間あたりのエラー数（近似値）
            hours = len(error_values) / 12  # 5分間隔の場合、12サンプル/時間
            analysis["errors"]["per_hour"] = analysis["errors"]["total"] / max(1, hours)
            
            # エラートレンド
            mid_point = len(error_values) // 2
            first_half_avg = sum(error_values[:mid_point]) / max(1, mid_point)
            second_half_avg = sum(error_values[mid_point:]) / max(1, len(error_values) - mid_point)
            
            if second_half_avg > first_half_avg * 1.50:
                analysis["errors"]["trend"] = "急増"
            elif second_half_avg > first_half_avg * 1.10:
                analysis["errors"]["trend"] = "増加"
            elif second_half_avg < first_half_avg * 0.90:
                analysis["errors"]["trend"] = "減少"
            else:
                analysis["errors"]["trend"] = "安定"
    
    # 推奨事項の生成
    recommendations = []
    
    # ヒット率に基づく推奨
    if analysis["hit_rate"]["avg"] is not None:
        hit_rate = analysis["hit_rate"]["avg"]
        if hit_rate < 40:
            recommendations.append("ヒット率が非常に低いです。キャッシュキー生成とTTL設定を見直してください。")
        elif hit_rate < 60:
            recommendations.append("キャッシュヒット率が最適ではありません。頻繁にアクセスされるデータのTTLを延長し、キャッシュウォームアップを検討してください。")
        elif hit_rate > 95:
            recommendations.append("非常に高いヒット率ですが、稀にしか変更されないデータをキャッシュしている可能性があります。TTLがデータの揮発性に対して適切か確認してください。")
    
    # レスポンス時間に基づく推奨
    if analysis["response_time"]["improvement_percent"] is not None:
        improvement = analysis["response_time"]["improvement_percent"]
        if improvement < 20:
            recommendations.append("キャッシュによるレスポンス時間の改善が小さいです。キャッシュ対象の見直しや、より高速なストレージ層の使用を検討してください。")
        elif improvement > 90:
            recommendations.append("非常に大きなレスポンス時間の改善が見られます。データ生成が非常に重いため、バックグラウンド事前計算の実装も検討してください。")
    
    # メモリ使用量に基づく推奨
    if analysis["memory_usage"]["cache_avg_percent"] is not None:
        cache_usage = analysis["memory_usage"]["cache_avg_percent"]
        if cache_usage > 85:
            recommendations.append("メモリキャッシュの使用率が高すぎます。メモリ上限の引き上げ、またはTTLの短縮を検討してください。")
        elif cache_usage < 30:
            recommendations.append("メモリキャッシュの使用率が低いです。より多くのデータをキャッシュするか、メモリ上限の引き下げを検討できます。")
    
    if analysis["memory_usage"]["redis_avg_percent"] is not None:
        redis_usage = analysis["memory_usage"]["redis_avg_percent"]
        if redis_usage > 80:
            recommendations.append("Redisのメモリ使用率が高いです。maxmemory設定の増加またはより積極的な削除ポリシーを検討してください。")
    
    if analysis["memory_usage"]["trend"] == "急増":
        recommendations.append("メモリ使用量が急増しています。メモリリークの可能性を調査し、キャッシュサイズの上限を確認してください。")
    
    # エラーに基づく推奨
    if analysis["errors"]["per_hour"] is not None and analysis["errors"]["per_hour"] > 10:
        recommendations.append(f"エラー発生率が高いです（約{analysis['errors']['per_hour']:.1f}回/時間）。ログを確認し、Redis接続や例外処理を見直してください。")
    
    if analysis["errors"]["trend"] == "急増":
        recommendations.append("エラー発生率が急増しています。至急ログを確認し、適切な対応を行ってください。")
    
    analysis["recommendations"] = recommendations
    
    # 分析結果をファイルに保存
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = os.path.join(METRICS_DIR, f"prometheus_analysis_{timestamp}.json")
    
    with open(output_file, "w") as f:
        json.dump(analysis, f, indent=2)
    
    print(f"メトリクス分析結果を保存しました: {output_file}")
    return analysis, output_file

def generate_performance_report(metrics_analysis, log_analysis=None, comparison_results=None):
    """
    パフォーマンス分析結果からレポートを生成
    
    Args:
        metrics_analysis: メトリクス分析結果
        log_analysis: ログ分析結果（オプション）
        comparison_results: 比較結果（オプション）
        
    Returns:
        str: レポートのファイルパス
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_file = os.path.join(METRICS_DIR, f"performance_report_{timestamp}.md")
    
    with open(report_file, "w") as f:
        # レポートヘッダー
        f.write("# OptimizedCacheManager パフォーマンスレポート\n\n")
        f.write(f"生成日時: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        
        # メトリクス分析結果
        if metrics_analysis:
            f.write("## キャッシュパフォーマンス分析\n\n")
            
            # ヒット率
            f.write("### キャッシュヒット率\n\n")
            hit_rate = metrics_analysis.get("hit_rate", {})
            if hit_rate.get("avg") is not None:
                f.write(f"- 平均ヒット率: {hit_rate['avg']:.2f}%\n")
                f.write(f"- 最小ヒット率: {hit_rate['min']:.2f}%\n")
                f.write(f"- 最大ヒット率: {hit_rate['max']:.2f}%\n")
                if hit_rate.get("trend"):
                    f.write(f"- トレンド: {hit_rate['trend']}\n")
            else:
                f.write("ヒット率のデータがありません。\n")
            f.write("\n")
            
            # レスポンス時間
            f.write("### レスポンス時間\n\n")
            response_time = metrics_analysis.get("response_time", {})
            if response_time.get("cached_avg") is not None:
                f.write(f"- キャッシュあり平均: {response_time['cached_avg']:.2f}ms\n")
            if response_time.get("uncached_avg") is not None:
                f.write(f"- キャッシュなし平均: {response_time['uncached_avg']:.2f}ms\n")
            if response_time.get("improvement_percent") is not None:
                f.write(f"- 改善率: {response_time['improvement_percent']:.2f}%\n")
            else:
                f.write("レスポンス時間のデータが不完全です。\n")
            f.write("\n")
            
            # メモリ使用量
            f.write("### メモリ使用量\n\n")
            memory_usage = metrics_analysis.get("memory_usage", {})
            if memory_usage.get("cache_avg_percent") is not None:
                f.write(f"- メモリキャッシュ使用率: {memory_usage['cache_avg_percent']:.2f}%\n")
            if memory_usage.get("redis_avg_percent") is not None:
                f.write(f"- Redis使用率: {memory_usage['redis_avg_percent']:.2f}%\n")
            if memory_usage.get("trend"):
                f.write(f"- トレンド: {memory_usage['trend']}\n")
            else:
                f.write("メモリ使用量のデータが不完全です。\n")
            f.write("\n")
            
            # エラー
            f.write("### エラー状況\n\n")
            errors = metrics_analysis.get("errors", {})
            if errors.get("total") is not None:
                f.write(f"- 合計エラー数: {errors['total']}\n")
            if errors.get("per_hour") is not None:
                f.write(f"- 時間あたりエラー数: {errors['per_hour']:.2f}\n")
            if errors.get("trend"):
                f.write(f"- トレンド: {errors['trend']}\n")
            else:
                f.write("エラーデータがありません。\n")
            f.write("\n")
        
        # ログ分析結果
        if log_analysis:
            f.write("## ログ分析\n\n")
            f.write(f"- 分析対象エントリ数: {log_analysis.get('total_entries', 0)}\n")
            f.write(f"- キャッシュ関連エントリ: {log_analysis.get('cache_entries', 0)}\n")
            f.write(f"- エラーエントリ: {log_analysis.get('error_entries', 0)}\n")
            f.write(f"- 警告エントリ: {log_analysis.get('warning_entries', 0)}\n\n")
            
            if log_analysis.get("errors"):
                f.write("### 主なエラー\n\n")
                for i, error in enumerate(log_analysis["errors"][:10]):  # 最大10件表示
                    f.write(f"{i+1}. `{error}`\n")
                f.write("\n")
            
            if log_analysis.get("warnings"):
                f.write("### 主な警告\n\n")
                for i, warning in enumerate(log_analysis["warnings"][:10]):  # 最大10件表示
                    f.write(f"{i+1}. `{warning}`\n")
                f.write("\n")
        
        # 比較結果
        if comparison_results:
            f.write("## パフォーマンス比較\n\n")
            
            # レスポンス時間の改善
            f.write("### レスポンス時間の改善\n\n")
            response_improvements = comparison_results.get("response_time_improvement", {})
            if response_improvements:
                f.write("| エンドポイント | 前 (ms) | 後 (ms) | 改善率 (%) |\n")
                f.write("|--------------|---------|---------|------------|\n")
                
                for endpoint, data in response_improvements.items():
                    f.write(f"| {endpoint} | {data.get('before_ms', 0):.2f} | {data.get('after_ms', 0):.2f} | {data.get('improvement_percent', 0):.2f} |\n")
            else:
                f.write("レスポンス時間の比較データがありません。\n")
            f.write("\n")
            
            # ヒット率
            f.write("### キャッシュヒット率\n\n")
            hit_rate_data = comparison_results.get("hit_rate", {})
            if hit_rate_data:
                f.write("| エンドポイント | ヒット率 (%) |\n")
                f.write("|--------------|------------|\n")
                
                for endpoint, rate in hit_rate_data.items():
                    f.write(f"| {endpoint} | {rate:.2f} |\n")
                
                if "overall_hit_rate" in comparison_results.get("summary", {}):
                    f.write(f"\n全体のヒット率: {comparison_results['summary']['overall_hit_rate']:.2f}%\n")
            else:
                f.write("ヒット率のデータがありません。\n")
            f.write("\n")
            
            # エラー率
            f.write("### エラー率の変化\n\n")
            error_comparison = comparison_results.get("error_rate_comparison", {})
            if error_comparison:
                f.write(f"- 前: {error_comparison.get('before_percent', 0):.4f}%\n")
                f.write(f"- 後: {error_comparison.get('after_percent', 0):.4f}%\n")
                change = error_comparison.get('change', 0)
                change_str = f"+{change:.4f}" if change > 0 else f"{change:.4f}"
                f.write(f"- 変化: {change_str}%\n")
            else:
                f.write("エラー率の比較データがありません。\n")
            f.write("\n")
            
            # メモリ使用量
            f.write("### メモリ使用量の変化\n\n")
            memory_comparison = comparison_results.get("memory_usage_comparison", {})
            if memory_comparison:
                f.write(f"- 前: {memory_comparison.get('before_mb', 0):.2f}MB\n")
                f.write(f"- 後: {memory_comparison.get('after_mb', 0):.2f}MB\n")
                change = memory_comparison.get('change_percent', 0)
                change_str = f"+{change:.2f}" if change > 0 else f"{change:.2f}"
                f.write(f"- 変化: {change_str}%\n")
            else:
                f.write("メモリ使用量の比較データがありません。\n")
            f.write("\n")
            
            # 総合評価
            if "performance_rating" in comparison_results.get("summary", {}):
                f.write(f"### 総合評価: {comparison_results['summary']['performance_rating']}\n\n")
        
        # 推奨事項
        f.write("## 推奨事項\n\n")
        recommendations = metrics_analysis.get("recommendations", [])
        
        if comparison_results and "recommendations" in comparison_results:
            recommendations.extend(comparison_results["recommendations"])
        
        if recommendations:
            for i, rec in enumerate(recommendations):
                f.write(f"{i+1}. {rec}\n")
        else:
            f.write("特に推奨事項はありません。\n")
    
    print(f"パフォーマンスレポートを生成しました: {report_file}")
    return report_file

def generate_visualizations(metrics_data, output_dir=None):
    """
    メトリクスデータのビジュアライゼーションを生成
    
    Args:
        metrics_data: collect_prometheus_metrics()の返り値
        output_dir: 出力ディレクトリ（デフォルトはMETRICS_DIR）
        
    Returns:
        list: 生成したグラフファイルのパス
    """
    if not metrics_data:
        print("エラー: ビジュアライゼーションを生成するデータがありません。")
        return []
    
    if output_dir is None:
        output_dir = METRICS_DIR
    
    os.makedirs(output_dir, exist_ok=True)
    
    graph_files = []
    
    # ヒット率のグラフ
    if "cache_hit_rate" in metrics_data and metrics_data["cache_hit_rate"]:
        times = []
        values = []
        
        for result in metrics_data["cache_hit_rate"]:
            for value in result["values"]:
                if value[1] != "NaN":
                    times.append(datetime.fromtimestamp(value[0]))
                    values.append(float(value[1]))
        
        if times and values:
            plt.figure(figsize=(10, 6))
            plt.plot(times, values, marker='o', linestyle='-', color='blue')
            plt.title('キャッシュヒット率の推移')
            plt.xlabel('時間')
            plt.ylabel('ヒット率 (%)')
            plt.grid(True)
            plt.ylim(0, 100)
            
            # フォーマットの設定
            plt.tight_layout()
            
            # 保存
            output_file = os.path.join(output_dir, "hit_rate_trend.png")
            plt.savefig(output_file)
            plt.close()
            
            graph_files.append(output_file)
            print(f"ヒット率グラフを生成しました: {output_file}")
    
    # レスポンス時間の比較グラフ
    if (("cache_response_time" in metrics_data and metrics_data["cache_response_time"]) or
        ("uncached_response_time" in metrics_data and metrics_data["uncached_response_time"])):
        
        cached_times = {}
        uncached_times = {}
        
        # キャッシュありのデータ収集
        if "cache_response_time" in metrics_data and metrics_data["cache_response_time"]:
            for result in metrics_data["cache_response_time"]:
                for value in result["values"]:
                    if value[1] != "NaN":
                        timestamp = datetime.fromtimestamp(value[0])
                        cached_times[timestamp] = float(value[1])
        
        # キャッシュなしのデータ収集
        if "uncached_response_time" in metrics_data and metrics_data["uncached_response_time"]:
            for result in metrics_data["uncached_response_time"]:
                for value in result["values"]:
                    if value[1] != "NaN":
                        timestamp = datetime.fromtimestamp(value[0])
                        uncached_times[timestamp] = float(value[1])
        
        if cached_times or uncached_times:
            plt.figure(figsize=(10, 6))
            
            # 時間軸の準備
            all_times = sorted(set(list(cached_times.keys()) + list(uncached_times.keys())))
            
            if cached_times:
                cached_values = [cached_times.get(t, None) for t in all_times]
                plt.plot(all_times, cached_values, marker='o', linestyle='-', color='green', label='キャッシュあり')
            
            if uncached_times:
                uncached_values = [uncached_times.get(t, None) for t in all_times]
                plt.plot(all_times, uncached_values, marker='x', linestyle='--', color='red', label='キャッシュなし')
            
            plt.title('レスポンス時間の比較')
            plt.xlabel('時間')
            plt.ylabel('レスポンス時間 (ms)')
            plt.grid(True)
            plt.legend()
            
            # フォーマットの設定
            plt.tight_layout()
            
            # 保存
            output_file = os.path.join(output_dir, "response_time_comparison.png")
            plt.savefig(output_file)
            plt.close()
            
            graph_files.append(output_file)
            print(f"レスポンス時間グラフを生成しました: {output_file}")
    
    # メモリ使用量のグラフ
    if (("cache_memory_usage" in metrics_data and metrics_data["cache_memory_usage"]) or
        ("redis_memory_used" in metrics_data and metrics_data["redis_memory_used"])):
        
        times = set()
        cache_memory = {}
        redis_memory = {}
        
        # メモリキャッシュのデータ収集
        if "cache_memory_usage" in metrics_data and metrics_data["cache_memory_usage"]:
            for result in metrics_data["cache_memory_usage"]:
                for value in result["values"]:
                    if value[1] != "NaN":
                        timestamp = datetime.fromtimestamp(value[0])
                        times.add(timestamp)
                        cache_memory[timestamp] = float(value[1])
        
        # Redisメモリのデータ収集
        if "redis_memory_used" in metrics_data and metrics_data["redis_memory_used"]:
            for result in metrics_data["redis_memory_used"]:
                for value in result["values"]:
                    if value[1] != "NaN":
                        timestamp = datetime.fromtimestamp(value[0])
                        times.add(timestamp)
                        redis_memory[timestamp] = float(value[1])
        
        if times:
            plt.figure(figsize=(10, 6))
            
            # 時間軸の準備
            all_times = sorted(times)
            
            if cache_memory:
                cache_values = [cache_memory.get(t, None) for t in all_times]
                plt.plot(all_times, cache_values, marker='o', linestyle='-', color='blue', label='メモリキャッシュ')
            
            if redis_memory:
                redis_values = [redis_memory.get(t, None) for t in all_times]
                plt.plot(all_times, redis_values, marker='s', linestyle='-', color='purple', label='Redis')
            
            plt.title('メモリ使用量の推移')
            plt.xlabel('時間')
            plt.ylabel('メモリ使用量 (MB)')
            plt.grid(True)
            plt.legend()
            
            # フォーマットの設定
            plt.tight_layout()
            
            # 保存
            output_file = os.path.join(output_dir, "memory_usage_trend.png")
            plt.savefig(output_file)
            plt.close()
            
            graph_files.append(output_file)
            print(f"メモリ使用量グラフを生成しました: {output_file}")
    
    # エラー数の推移グラフ
    if "cache_error_count" in metrics_data and metrics_data["cache_error_count"]:
        times = []
        values = []
        
        for result in metrics_data["cache_error_count"]:
            last_value = 0
            for i, value in enumerate(result["values"]):
                if value[1] != "NaN":
                    current_value = float(value[1])
                    timestamp = datetime.fromtimestamp(value[0])
                    
                    # 差分を計算（増加分のみ）
                    if i > 0 and current_value >= last_value:
                        times.append(timestamp)
                        values.append(current_value - last_value)
                    
                    last_value = current_value
        
        if times and values:
            plt.figure(figsize=(10, 6))
            plt.bar(times, values, color='red', width=0.02)
            plt.title('キャッシュエラー発生数の推移')
            plt.xlabel('時間')
            plt.ylabel('エラー数')
            plt.grid(True, axis='y')
            
            # フォーマットの設定
            plt.tight_layout()
            
            # 保存
            output_file = os.path.join(output_dir, "error_count_trend.png")
            plt.savefig(output_file)
            plt.close()
            
            graph_files.append(output_file)
            print(f"エラー数グラフを生成しました: {output_file}")
    
    # 操作種類別の円グラフ
    operation_counts = {"get": 0, "set": 0, "invalidate": 0}
    operation_found = False
    
    if "cache_operations_total" in metrics_data and metrics_data["cache_operations_total"]:
        for result in metrics_data["cache_operations_total"]:
            operation = result.get("metric", {}).get("operation")
            if operation in operation_counts and result["values"]:
                latest_value = float(result["values"][-1][1])
                if latest_value > 0:
                    operation_counts[operation] = latest_value
                    operation_found = True
    
    if operation_found:
        plt.figure(figsize=(8, 8))
        labels = [f"GET ({operation_counts['get']:.0f})", 
                 f"SET ({operation_counts['set']:.0f})", 
                 f"INVALIDATE ({operation_counts['invalidate']:.0f})"]
        sizes = [operation_counts['get'], operation_counts['set'], operation_counts['invalidate']]
        colors = ['#66b3ff', '#99ff99', '#ffcc99']
        
        plt.pie(sizes, labels=labels, colors=colors, autopct='%1.1f%%', startangle=90)
        plt.axis('equal')
        plt.title('キャッシュ操作の内訳')
        
        # 保存
        output_file = os.path.join(output_dir, "operation_distribution.png")
        plt.savefig(output_file)
        plt.close()
        
        graph_files.append(output_file)
        print(f"操作分布グラフを生成しました: {output_file}")
    
    return graph_files

def main():
    parser = argparse.ArgumentParser(description="OptimizedCacheManagerのパフォーマンス分析")
    parser.add_argument("--collect", action="store_true", help="Prometheusからメトリクスを収集")
    parser.add_argument("--analyze", type=str, help="指定したメトリクスJSONファイルを分析")
    parser.add_argument("--logs", type=str, help="指定したログディレクトリまたはファイルを分析")
    parser.add_argument("--compare", nargs=2, help="キャッシュ有効化前後のパフォーマンスデータファイルを比較")
    parser.add_argument("--visualize", type=str, help="指定したメトリクスJSONファイルからグラフを生成")
    parser.add_argument("--report", action="store_true", help="分析結果から包括的なレポートを生成")
    parser.add_argument("--period", type=str, default="24h", help="収集するメトリクスの期間（例: 6h, 24h, 7d）")
    parser.add_argument("--step", type=str, default="5m", help="メトリクスのサンプリング間隔（例: 1m, 5m, 1h）")
    parser.add_argument("--output", type=str, help="出力ディレクトリ")
    
    args = parser.parse_args()
    
    if args.output:
        global METRICS_DIR
        METRICS_DIR = args.output
        os.makedirs(METRICS_DIR, exist_ok=True)
    
    metrics_data = None
    metrics_file = None
    log_results = None
    metrics_analysis = None
    comparison_results = None
    
    # メトリクス収集
    if args.collect:
        # 期間の解析
        period = args.period.lower()
        
        if period.endswith('h'):
            hours = int(period[:-1])
            start_time = datetime.now() - timedelta(hours=hours)
        elif period.endswith('d'):
            days = int(period[:-1])
            start_time = datetime.now() - timedelta(days=days)
        elif period.endswith('w'):
            weeks = int(period[:-1])
            start_time = datetime.now() - timedelta(weeks=weeks)
        else:
            print(f"警告: 無効な期間フォーマット '{period}'。デフォルトの24時間を使用します。")
            start_time = datetime.now() - timedelta(hours=24)
        
        print_section("メトリクス収集")
        metrics_data, metrics_file = collect_prometheus_metrics(start_time, datetime.now(), args.step)
    
    # メトリクス分析
    if args.analyze:
        print_section("メトリクス分析")
        
        try:
            with open(args.analyze, "r") as f:
                metrics_data = json.load(f)
                metrics_file = args.analyze
            
            metrics_analysis, _ = analyze_prometheus_data(metrics_data)
        except Exception as e:
            print(f"エラー: メトリクスファイルの分析に失敗しました: {e}")
    elif metrics_data:
        # collect_prometheus_metricsで取得したデータを分析
        metrics_analysis, _ = analyze_prometheus_data(metrics_data)
    
    # ログ分析
    if args.logs:
        print_section("ログ分析")
        log_results, _ = parse_log_files(args.logs)
    
    # パフォーマンス比較
    if args.compare:
        print_section("パフォーマンス比較")
        before_file, after_file = args.compare
        comparison_results, _ = compare_performance(before_file, after_file)
    
    # ビジュアライゼーション生成
    if args.visualize:
        print_section("ビジュアライゼーション生成")
        
        try:
            with open(args.visualize, "r") as f:
                metrics_data = json.load(f)
            
            generate_visualizations(metrics_data, METRICS_DIR)
        except Exception as e:
            print(f"エラー: ビジュアライゼーションの生成に失敗しました: {e}")
    elif metrics_data:
        # collect_prometheus_metricsで取得したデータを使用
        generate_visualizations(metrics_data, METRICS_DIR)
    
    # レポート生成
    if args.report and metrics_analysis:
        print_section("パフォーマンスレポート生成")
        report_file = generate_performance_report(metrics_analysis, log_results, comparison_results)
        print(f"パフォーマンスレポートが生成されました: {report_file}")
    
    print("\n分析が完了しました。出力は以下のディレクトリにあります:")
    print(METRICS_DIR)

if __name__ == "__main__":
    main()