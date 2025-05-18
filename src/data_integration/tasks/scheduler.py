import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.jobstores.redis import RedisJobStore
from apscheduler.executors.asyncio import AsyncIOExecutor
from apscheduler.job import Job

from ..config import get_settings
from .sync_tasks import (
    sync_orders,
    sync_customers,
    sync_campaigns,
    sync_products,
    sync_events,
    sync_all_data,
    cleanup_old_data
)
from .analytics_tasks import (
    analyze_daily_performance,
    analyze_weekly_cohorts,
    analyze_monthly_ltv,
    analyze_daily_funnels,
    generate_daily_report,
    generate_weekly_report
)


logger = logging.getLogger(__name__)
settings = get_settings()


class TaskScheduler:
    """タスクスケジューラー"""
    
    def __init__(self):
        """Initialize the scheduler"""
        # Job stores
        jobstores = {
            'default': RedisJobStore(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                db=settings.REDIS_DB
            )
        }
        
        # Executors
        executors = {
            'default': AsyncIOExecutor()
        }
        
        # Job defaults
        job_defaults = {
            'coalesce': True,
            'max_instances': 3,
            'misfire_grace_time': 30
        }
        
        # Initialize scheduler
        self.scheduler = AsyncIOScheduler(
            jobstores=jobstores,
            executors=executors,
            job_defaults=job_defaults,
            timezone='Asia/Tokyo'
        )
        
        # Add event listeners
        self.scheduler.add_listener(
            self._job_executed,
            mask=EVENT_JOB_EXECUTED | EVENT_JOB_ERROR
        )
    
    async def start(self):
        """スケジューラーを開始"""
        logger.info("Starting task scheduler")
        
        # Add scheduled jobs
        await self._add_sync_jobs()
        await self._add_analytics_jobs()
        await self._add_maintenance_jobs()
        
        # Start scheduler
        self.scheduler.start()
        logger.info("Task scheduler started")
    
    async def stop(self):
        """スケジューラーを停止"""
        logger.info("Stopping task scheduler")
        self.scheduler.shutdown()
        logger.info("Task scheduler stopped")
    
    async def _add_sync_jobs(self):
        """同期ジョブを追加"""
        # Order sync - every hour
        self.scheduler.add_job(
            sync_orders,
            trigger=CronTrigger(minute=0),
            id="sync_orders_hourly",
            name="Hourly Order Sync",
            replace_existing=True
        )
        
        # Customer sync - daily at 2 AM
        self.scheduler.add_job(
            sync_customers,
            trigger=CronTrigger(hour=2, minute=0),
            id="sync_customers_daily",
            name="Daily Customer Sync",
            replace_existing=True
        )
        
        # Campaign sync - every 30 minutes
        self.scheduler.add_job(
            sync_campaigns,
            trigger=IntervalTrigger(minutes=30),
            id="sync_campaigns_30min",
            name="30-min Campaign Sync",
            replace_existing=True
        )
        
        # Product sync - every 6 hours
        self.scheduler.add_job(
            sync_products,
            trigger=CronTrigger(hour='*/6', minute=0),
            id="sync_products_6hour",
            name="6-hour Product Sync",
            replace_existing=True
        )
        
        # Event sync - every hour
        self.scheduler.add_job(
            sync_events,
            trigger=CronTrigger(minute=30),
            id="sync_events_hourly",
            name="Hourly Event Sync",
            replace_existing=True
        )
        
        # Full sync - daily at midnight
        self.scheduler.add_job(
            sync_all_data,
            trigger=CronTrigger(hour=0, minute=0),
            id="sync_all_daily",
            name="Daily Full Sync",
            replace_existing=True
        )
    
    async def _add_analytics_jobs(self):
        """分析ジョブを追加"""
        # Daily performance analysis - at 1 AM
        self.scheduler.add_job(
            analyze_daily_performance,
            trigger=CronTrigger(hour=1, minute=0),
            id="analyze_performance_daily",
            name="Daily Performance Analysis",
            replace_existing=True
        )
        
        # Weekly cohort analysis - Monday at 2 AM
        self.scheduler.add_job(
            analyze_weekly_cohorts,
            trigger=CronTrigger(day_of_week=0, hour=2, minute=0),
            id="analyze_cohorts_weekly",
            name="Weekly Cohort Analysis",
            replace_existing=True
        )
        
        # Monthly LTV analysis - 1st of month at 3 AM
        self.scheduler.add_job(
            analyze_monthly_ltv,
            trigger=CronTrigger(day=1, hour=3, minute=0),
            id="analyze_ltv_monthly",
            name="Monthly LTV Analysis",
            replace_existing=True
        )
        
        # Daily funnel analysis - at 4 AM
        self.scheduler.add_job(
            analyze_daily_funnels,
            trigger=CronTrigger(hour=4, minute=0),
            id="analyze_funnels_daily",
            name="Daily Funnel Analysis",
            replace_existing=True
        )
        
        # Daily report generation - at 6 AM
        self.scheduler.add_job(
            generate_daily_report,
            trigger=CronTrigger(hour=6, minute=0),
            id="generate_report_daily",
            name="Daily Report Generation",
            replace_existing=True
        )
        
        # Weekly report generation - Monday at 9 AM
        self.scheduler.add_job(
            generate_weekly_report,
            trigger=CronTrigger(day_of_week=0, hour=9, minute=0),
            id="generate_report_weekly",
            name="Weekly Report Generation",
            replace_existing=True
        )
    
    async def _add_maintenance_jobs(self):
        """メンテナンスジョブを追加"""
        # Data cleanup - daily at 3 AM
        self.scheduler.add_job(
            cleanup_old_data,
            trigger=CronTrigger(hour=3, minute=0),
            id="cleanup_data_daily",
            name="Daily Data Cleanup",
            replace_existing=True,
            kwargs={"retention_days": 90}
        )
        
        # Health check - every 5 minutes
        self.scheduler.add_job(
            self._health_check,
            trigger=IntervalTrigger(minutes=5),
            id="health_check_5min",
            name="5-min Health Check",
            replace_existing=True
        )
    
    async def _health_check(self):
        """システムヘルスチェック"""
        try:
            # Check scheduler status
            if not self.scheduler.running:
                logger.error("Scheduler is not running")
                return
            
            # Check job statuses
            jobs = self.scheduler.get_jobs()
            for job in jobs:
                if job.next_run_time is None:
                    logger.warning(f"Job {job.id} has no next run time")
            
            logger.info(f"Health check passed. {len(jobs)} jobs active")
        
        except Exception as e:
            logger.error(f"Health check failed: {str(e)}")
    
    def _job_executed(self, event):
        """ジョブ実行イベントハンドラー"""
        if event.exception:
            logger.error(
                f"Job {event.job_id} crashed: {event.exception}\n"
                f"Traceback: {event.traceback}"
            )
        else:
            logger.info(f"Job {event.job_id} executed successfully")
    
    async def add_job(
        self,
        func,
        trigger,
        id: str,
        name: str,
        **kwargs
    ) -> Job:
        """ジョブを追加"""
        job = self.scheduler.add_job(
            func,
            trigger=trigger,
            id=id,
            name=name,
            replace_existing=True,
            **kwargs
        )
        logger.info(f"Added job: {name} (ID: {id})")
        return job
    
    async def remove_job(self, job_id: str):
        """ジョブを削除"""
        try:
            self.scheduler.remove_job(job_id)
            logger.info(f"Removed job: {job_id}")
        except Exception as e:
            logger.error(f"Failed to remove job {job_id}: {str(e)}")
    
    async def pause_job(self, job_id: str):
        """ジョブを一時停止"""
        try:
            self.scheduler.pause_job(job_id)
            logger.info(f"Paused job: {job_id}")
        except Exception as e:
            logger.error(f"Failed to pause job {job_id}: {str(e)}")
    
    async def resume_job(self, job_id: str):
        """ジョブを再開"""
        try:
            self.scheduler.resume_job(job_id)
            logger.info(f"Resumed job: {job_id}")
        except Exception as e:
            logger.error(f"Failed to resume job {job_id}: {str(e)}")
    
    def get_job(self, job_id: str) -> Optional[Job]:
        """ジョブを取得"""
        return self.scheduler.get_job(job_id)
    
    def get_jobs(self) -> List[Job]:
        """すべてのジョブを取得"""
        return self.scheduler.get_jobs()
    
    async def reschedule_job(
        self,
        job_id: str,
        trigger,
        **trigger_args
    ):
        """ジョブを再スケジュール"""
        try:
            self.scheduler.reschedule_job(
                job_id,
                trigger=trigger,
                **trigger_args
            )
            logger.info(f"Rescheduled job: {job_id}")
        except Exception as e:
            logger.error(f"Failed to reschedule job {job_id}: {str(e)}")
    
    async def run_job_now(self, job_id: str):
        """ジョブを今すぐ実行"""
        try:
            job = self.scheduler.get_job(job_id)
            if job:
                job.modify(next_run_time=datetime.now())
                logger.info(f"Triggered immediate execution of job: {job_id}")
            else:
                logger.error(f"Job not found: {job_id}")
        except Exception as e:
            logger.error(f"Failed to trigger job {job_id}: {str(e)}")


# Create global scheduler instance
scheduler = TaskScheduler()


# CLI commands
def list_jobs():
    """ジョブ一覧を表示"""
    jobs = scheduler.get_jobs()
    for job in jobs:
        print(f"ID: {job.id}")
        print(f"Name: {job.name}")
        print(f"Next run: {job.next_run_time}")
        print(f"Trigger: {job.trigger}")
        print("-" * 40)


def run_job(job_id: str):
    """ジョブを手動実行"""
    asyncio.run(scheduler.run_job_now(job_id))


def pause_job(job_id: str):
    """ジョブを一時停止"""
    asyncio.run(scheduler.pause_job(job_id))


def resume_job(job_id: str):
    """ジョブを再開"""
    asyncio.run(scheduler.resume_job(job_id))


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: scheduler.py <command> [args]")
        print("Commands: list, run <job_id>, pause <job_id>, resume <job_id>")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "list":
        list_jobs()
    elif command == "run" and len(sys.argv) > 2:
        run_job(sys.argv[2])
    elif command == "pause" and len(sys.argv) > 2:
        pause_job(sys.argv[2])
    elif command == "resume" and len(sys.argv) > 2:
        resume_job(sys.argv[2])
    else:
        print("Invalid command")
        sys.exit(1)