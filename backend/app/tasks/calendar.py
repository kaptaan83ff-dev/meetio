from app.celery_app import app as celery_app

@celery_app.task(name="tasks.calendar.renew_expiring_channels")
def renew_expiring_channels():
    """
    TODO: Feature 12
    Checks for Google Calendar watch channels expiring within 48h and renews them.
    """
    pass
