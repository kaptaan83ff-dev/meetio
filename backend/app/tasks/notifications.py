from app.celery_app import app as celery_app

@celery_app.task(name="tasks.notifications.send_due_date_reminders")
def send_due_date_reminders():
    """
    TODO: Feature 15
    Sends email and in-app notifications for action items due today.
    """
    pass
