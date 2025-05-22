from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import asyncio
import logging
from celery import Celery
from celery.schedules import crontab

from ..services.analytics_service import AnalyticsService
from ..schemas.request import (
    PerformanceAnalysisRequest,
    CohortAnalysisRequest,
    FunnelAnalysisRequest,
    LTVAnalysisRequest
)
from ..config import get_settings


logger = logging.getLogger(__name__)
settings = get_settings()

# Celery設定
app = Celery(
    "analytics",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND
)


# 分析タスクスケジュール設定
app.conf.beat_schedule = {
    "daily-performance-analysis": {
        "task": "analyze_daily_performance",
        "schedule": crontab(hour="1", minute="0"),
        "args": ()
    },
    "weekly-cohort-analysis": {
        "task": "analyze_weekly_cohorts",
        "schedule": crontab(day_of_week=1, hour="2", minute="0"),
        "args": ()
    },
    "monthly-ltv-analysis": {
        "task": "analyze_monthly_ltv",
        "schedule": crontab(day_of_month=1, hour="3", minute="0"),
        "args": ()
    },
    "daily-funnel-analysis": {
        "task": "analyze_daily_funnels",
        "schedule": crontab(hour="4", minute="0"),
        "args": ()
    },
    "generate-daily-report": {
        "task": "generate_daily_report",
        "schedule": crontab(hour="6", minute="0"),
        "args": ()
    },
    "generate-weekly-report": {
        "task": "generate_weekly_report",
        "schedule": crontab(day_of_week=1, hour="9", minute="0"),
        "args": ()
    }
}


@app.task(name="analyze_daily_performance")
async def analyze_daily_performance(
    dimension: Optional[str] = None
) -> Dict[str, Any]:
    """
    日次パフォーマンス分析タスク
    """
    logger.info("Starting daily performance analysis")
    
    service = AnalyticsService()
    
    # 前日のデータを分析
    end_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    start_date = end_date - timedelta(days=1)
    
    request = PerformanceAnalysisRequest(
        start_date=start_date,
        end_date=end_date,
        dimension=dimension or "overall",
        metrics=["revenue", "orders", "conversion_rate", "aov"],
        comparison_period=True
    )
    
    try:
        result = await service.analyze_performance(request)
        
        logger.info(f"Daily performance analysis completed: {result}")
        
        # 異常値を検出
        anomalies = await detect_anomalies(result)
        if anomalies:
            await alert_anomalies(anomalies)
        
        return result
    
    except Exception as e:
        logger.error(f"Daily performance analysis failed: {str(e)}")
        raise


@app.task(name="analyze_weekly_cohorts")
async def analyze_weekly_cohorts() -> Dict[str, Any]:
    """
    週次コホート分析タスク
    """
    logger.info("Starting weekly cohort analysis")
    
    service = AnalyticsService()
    
    # 過去3ヶ月のデータを分析
    end_date = datetime.now()
    start_date = end_date - timedelta(days=90)
    
    request = CohortAnalysisRequest(
        start_date=start_date,
        end_date=end_date,
        cohort_type="weekly",
        metric="retention"
    )
    
    try:
        result = await service.analyze_cohort(request)
        
        logger.info(f"Weekly cohort analysis completed: {result}")
        
        # リテンション率の悪化を検出
        retention_issues = await check_retention_issues(result)
        if retention_issues:
            await alert_retention_issues(retention_issues)
        
        return result
    
    except Exception as e:
        logger.error(f"Weekly cohort analysis failed: {str(e)}")
        raise


@app.task(name="analyze_monthly_ltv")
async def analyze_monthly_ltv() -> Dict[str, Any]:
    """
    月次LTV分析タスク
    """
    logger.info("Starting monthly LTV analysis")
    
    service = AnalyticsService()
    
    # 過去1年のデータを分析
    end_date = datetime.now()
    start_date = end_date - timedelta(days=365)
    
    request = LTVAnalysisRequest(
        start_date=start_date,
        end_date=end_date,
        prediction_months=12,
        segment_by="tier",
        include_churn_prediction=True
    )
    
    try:
        result = await service.analyze_ltv(request)
        
        logger.info(f"Monthly LTV analysis completed: {result}")
        
        # 高リスクセグメントを特定
        high_risk_segments = await identify_high_risk_segments(result)
        if high_risk_segments:
            await create_retention_campaigns(high_risk_segments)
        
        return result
    
    except Exception as e:
        logger.error(f"Monthly LTV analysis failed: {str(e)}")
        raise


@app.task(name="analyze_daily_funnels")
async def analyze_daily_funnels() -> Dict[str, Any]:
    """
    日次ファネル分析タスク
    """
    logger.info("Starting daily funnel analysis")
    
    service = AnalyticsService()
    
    # 前日のデータを分析
    end_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    start_date = end_date - timedelta(days=1)
    
    # 主要ファネルの定義
    funnels = [
        {
            "name": "purchase_funnel",
            "steps": ["page_view", "product_view", "add_to_cart", "checkout", "purchase"]
        },
        {
            "name": "registration_funnel",
            "steps": ["page_view", "signup_start", "email_verify", "profile_complete"]
        }
    ]
    
    results = []
    for funnel in funnels:
        request = FunnelAnalysisRequest(
            funnel_steps=funnel["steps"],
            start_date=start_date,
            end_date=end_date,
            conversion_window_days=7
        )
        
        try:
            result = await service.analyze_funnel(request)
            results.append({
                "funnel_name": funnel["name"],
                "analysis": result
            })
            
            # 高いドロップオフ率を検出
            high_dropoff = await detect_high_dropoff(result)
            if high_dropoff:
                await alert_funnel_issues(funnel["name"], high_dropoff)
        
        except Exception as e:
            logger.error(f"Funnel analysis failed for {funnel['name']}: {str(e)}")
            results.append({
                "funnel_name": funnel["name"],
                "error": str(e)
            })
    
    logger.info(f"Daily funnel analysis completed: {results}")
    return {"funnels": results}


@app.task(name="generate_daily_report")
async def generate_daily_report() -> Dict[str, Any]:
    """
    日次レポート生成タスク
    """
    logger.info("Starting daily report generation")
    
    # 各分析結果を収集
    analyses = []
    
    # パフォーマンス分析
    try:
        performance = await analyze_daily_performance()
        analyses.append({"type": "performance", "data": performance})
    except Exception as e:
        logger.error(f"Performance analysis failed: {str(e)}")
    
    # ファネル分析
    try:
        funnels = await analyze_daily_funnels()
        analyses.append({"type": "funnels", "data": funnels})
    except Exception as e:
        logger.error(f"Funnel analysis failed: {str(e)}")
    
    # レポート生成
    service = AnalyticsService()
    
    try:
        report = await service.generate_report(
            report_type="daily_summary",
            analyses=analyses,
            format="pdf"
        )
        
        # レポートを配信
        await distribute_report(report, recipients=["analytics@company.com"])
        
        logger.info(f"Daily report generated and distributed: {report}")
        return report
    
    except Exception as e:
        logger.error(f"Daily report generation failed: {str(e)}")
        raise


@app.task(name="generate_weekly_report")
async def generate_weekly_report() -> Dict[str, Any]:
    """
    週次レポート生成タスク
    """
    logger.info("Starting weekly report generation")
    
    service = AnalyticsService()
    
    # 過去1週間のデータを集計
    end_date = datetime.now()
    start_date = end_date - timedelta(days=7)
    
    # 各種分析を実行
    analyses = []
    
    # 週次パフォーマンス
    try:
        performance = await service.analyze_performance(
            PerformanceAnalysisRequest(
                start_date=start_date,
                end_date=end_date,
                dimension="channel"
            )
        )
        analyses.append({"type": "performance", "data": performance})
    except Exception as e:
        logger.error(f"Weekly performance failed: {str(e)}")
    
    # コホート分析
    try:
        cohorts = await analyze_weekly_cohorts()
        analyses.append({"type": "cohorts", "data": cohorts})
    except Exception as e:
        logger.error(f"Cohort analysis failed: {str(e)}")
    
    # レポート生成
    try:
        report = await service.generate_report(
            report_type="weekly_summary",
            analyses=analyses,
            format="excel"
        )
        
        # レポートを配信
        await distribute_report(
            report,
            recipients=["management@company.com", "analytics@company.com"]
        )
        
        logger.info(f"Weekly report generated and distributed: {report}")
        return report
    
    except Exception as e:
        logger.error(f"Weekly report generation failed: {str(e)}")
        raise


# ヘルパー関数
async def detect_anomalies(analysis_result: Dict[str, Any]) -> List[Dict[str, Any]]:
    """異常値を検出"""
    anomalies = []
    
    # 前期比較で大きな変化を検出
    if "comparison" in analysis_result:
        for metric, values in analysis_result["comparison"].items():
            if abs(values.get("change_rate", 0)) > 20:
                anomalies.append({
                    "metric": metric,
                    "change_rate": values["change_rate"],
                    "current": values["current"],
                    "previous": values["previous"]
                })
    
    return anomalies


async def alert_anomalies(anomalies: List[Dict[str, Any]]) -> None:
    """異常値に関するアラートを送信"""
    # アラートシステムに送信
    for anomaly in anomalies:
        logger.warning(f"Anomaly detected: {anomaly}")
        # TODO: Slack, Emailなどへの通知実装


async def check_retention_issues(cohort_analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
    """リテンションの問題をチェック"""
    issues = []
    
    # リテンション率の悪化を検出
    if "summary" in cohort_analysis:
        recent_cohorts = list(cohort_analysis["summary"]["average_by_cohort"].items())[-4:]
        if len(recent_cohorts) >= 2:
            if recent_cohorts[-1][1] < recent_cohorts[-2][1] * 0.8:
                issues.append({
                    "type": "retention_decline",
                    "recent_cohort": recent_cohorts[-1],
                    "previous_cohort": recent_cohorts[-2]
                })
    
    return issues


async def alert_retention_issues(issues: List[Dict[str, Any]]) -> None:
    """リテンションの問題に関するアラート"""
    for issue in issues:
        logger.warning(f"Retention issue detected: {issue}")
        # TODO: CRMチームへの通知実装


async def distribute_report(report: Dict[str, Any], recipients: List[str]) -> None:
    """レポートを配信"""
    logger.info(f"Distributing report to {recipients}")
    # TODO: メール送信、Slack通知などの実装


async def identify_high_risk_segments(ltv_analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
    """高リスクセグメントを特定"""
    high_risk = []
    
    if "segments" in ltv_analysis:
        for segment in ltv_analysis["segments"]:
            if segment["average_ltv"] < 10000:  # 闾値
                high_risk.append(segment)
    
    return high_risk


async def create_retention_campaigns(segments: List[Dict[str, Any]]) -> None:
    """リテンションキャンペーンを作成"""
    logger.info(f"Creating retention campaigns for {len(segments)} segments")
    # TODO: マーケティングオートメーションAPIとの連携


async def detect_high_dropoff(funnel_analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
    """高いドロップオフ率を検出"""
    high_dropoff = []
    
    if "dropoff_analysis" in funnel_analysis:
        for step, data in funnel_analysis["dropoff_analysis"].items():
            if data["rate"] > 50:  # 50%以上のドロップオフ
                high_dropoff.append({
                    "step": step,
                    "rate": data["rate"],
                    "count": data["count"]
                })
    
    return high_dropoff


async def alert_funnel_issues(funnel_name: str, issues: List[Dict[str, Any]]) -> None:
    """ファネルの問題に関するアラート"""
    logger.warning(f"Funnel issues in {funnel_name}: {issues}")
    # TODO: UXチームへの通知実装