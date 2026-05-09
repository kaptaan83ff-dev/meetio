import pytest
from app.celery_app import app as celery_app

@pytest.fixture(autouse=True)
def setup_celery_test_config():
    """
    Ensure Celery tasks run synchronously (eagerly) during tests.
    """
    celery_app.conf.task_always_eager = True
    yield
    celery_app.conf.task_always_eager = False

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
