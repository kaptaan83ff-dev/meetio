from celery import Celery
from celery.schedules import crontab
from datetime import timedelta
from app.config import settings

# Celery app initialization
app = Celery(
    "meetio",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

# Configuration
app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600, # 1 hour max
)

# Beat Schedule Definition
app.conf.beat_schedule = {
    # Feature 25: Purge expired guest data (GDPR) - P3
    "purge-guest-data": {
        "task": "tasks.gdpr.purge_expired_guest_data",
        "schedule": crontab(hour=2, minute=0),
    },
    # Feature 25: Process pending account deletions (GDPR) - P3
    "process-account-deletions": {
        "task": "tasks.gdpr.process_pending_deletions",
        "schedule": crontab(hour=2, minute=30),
    },
    # Feature 25: Expire old recordings (GDPR) - P3
    "expire-meeting-recordings": {
        "task": "tasks.gdpr.expire_old_recordings",
        "schedule": crontab(hour=3, minute=0),
    },
    # Feature 12: Renew expiring GCal channels (Daily check)
    "renew-gcal-channels": {
        "task": "tasks.calendar.renew_expiring_channels",
        "schedule": crontab(hour=1, minute=0),
    },
    # Feature 28: Process dead letter queue (Retry logic)
    "process-dead-letter-queue": {
        "task": "tasks.dlq.process_dead_letter_queue",
        "schedule": timedelta(minutes=30),
    },
    # Feature 15: Send due date reminders (Notifications)
    "send-due-date-reminders": {
        "task": "tasks.notifications.send_due_date_reminders",
        "schedule": crontab(hour=9, minute=0),
    },
}

# Auto-discover tasks from app.tasks package
app.autodiscover_tasks(["app"])
