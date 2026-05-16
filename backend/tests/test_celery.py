import pytest
from app.celery_app import app as celery_app

@pytest.fixture(autouse=True)
def setup_celery_test_config():
    """
    Ensure Celery tasks run synchronously (eagerly) during tests.
    """
    old_broker_url = celery_app.conf.broker_url
    old_result_backend = celery_app.conf.result_backend
    old_task_always_eager = celery_app.conf.task_always_eager
    old_task_store_eager_result = celery_app.conf.task_store_eager_result

    # Avoid touching real Redis/Upstash during unit tests.
    celery_app.conf.broker_url = "memory://"
    celery_app.conf.result_backend = "cache+memory://"
    celery_app.conf.task_always_eager = True
    celery_app.conf.task_store_eager_result = True
    yield
    celery_app.conf.broker_url = old_broker_url
    celery_app.conf.result_backend = old_result_backend
    celery_app.conf.task_always_eager = old_task_always_eager
    celery_app.conf.task_store_eager_result = old_task_store_eager_result

@celery_app.task(name="tests.test_celery.add")
def add(x, y):
    return x + y

def test_celery_worker_communication():
    """
    Test that a task can be processed. 
    Using task_always_eager=True allows this to run without a separate worker process.
    """
    result = add.delay(2, 3)
    assert result.get(timeout=10) == 5

def test_celery_config():
    """
    Test that Celery is configured correctly.
    """
    assert celery_app.conf.timezone == "UTC"
    assert celery_app.conf.task_serializer == "json"
    assert "purge-guest-data" in celery_app.conf.beat_schedule

def test_application_tasks_are_registered():
    assert "tasks.notifications.send_verification_email" in celery_app.tasks
    assert "tasks.notifications.send_password_reset_email" in celery_app.tasks
    assert "tasks.dlq.process_dead_letter_queue" in celery_app.tasks
