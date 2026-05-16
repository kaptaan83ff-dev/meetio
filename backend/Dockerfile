FROM python:3.12-slim

WORKDIR /app

# Install system dependencies if needed (e.g., for Pillow or PyNaCl)
RUN apt-get update && apt-get install -y \
    build-essential \
    libssl-dev \
    libffi-dev \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
COPY app ./app
RUN pip install --no-cache-dir .

COPY migrations ./migrations
COPY scripts ./scripts

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
