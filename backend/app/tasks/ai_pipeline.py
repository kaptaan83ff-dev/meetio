from app.celery_app import app as celery_app

@celery_app.task(name="tasks.ai_pipeline.process_meeting_recap")
def process_meeting_recap(meeting_id: str):
    """
    TODO: Feature 18
    Main entry point for the AI recap pipeline.
    """
    pass
