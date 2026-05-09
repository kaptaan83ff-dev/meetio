from app.celery_app import app as celery_app

@celery_app.task(name="tasks.dlq.process_dead_letter_queue")
def process_dead_letter_queue():
    """
    TODO: Feature 28
    Retries failed webhook events stored in the dead_letter_events collection.
    """
    pass
