from app.celery_app import app as celery_app

@celery_app.task(name="tasks.gdpr.purge_expired_guest_data")
def purge_expired_guest_data():
    """
    TODO: Feature 25 (P3)
    Purges guest sessions and chat messages 24h after meeting ends.
    """
    pass

@celery_app.task(name="tasks.gdpr.process_pending_deletions")
def process_pending_deletions():
    """
    TODO: Feature 25 (P3)
    Processes user account deletions after the 30-day grace period.
    """
    pass

@celery_app.task(name="tasks.gdpr.expire_old_recordings")
def expire_old_recordings():
    """
    TODO: Feature 25 (P3)
    Deletes meeting recordings from R2 after the retention period.
    """
    pass
