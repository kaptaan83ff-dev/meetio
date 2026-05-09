# MeetIO Project Setup Guide

This guide covers the local development setup for the MeetIO backend and frontend.

## 1. Prerequisites
- Python 3.12+
- Node.js 20+
- MongoDB Atlas Account (Free Tier)
- Upstash Account (Free Tier Redis)

## 2. Local Environment Setup

### Backend
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # Linux/macOS:
   source .venv/bin/activate
   ```
3. Install dependencies in editable mode:
   ```bash
   pip install -e ".[dev]"
   ```

### Frontend
1. Navigate to the frontend directory (after Task 1.8):
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

## 3. Configuration

Create a `.env` file in the **project root** (not in the backend folder). Use `.env.example` as a template.

### Generating a Secret Key
Run this command to generate a secure 64-character hex key for `SECRET_KEY`:
```bash
openssl rand -hex 32
```

### External Services
- **MongoDB Atlas**: Create a cluster, whitelist your IP, and get the connection string.
- **Upstash Redis**: Create an instance and get the `rediss://` URL.
- **LiveKit**: Get your API key and secret from the LiveKit Cloud dashboard.
- **Google OAuth**: Create credentials in the Google Cloud Console.

## 4. Running the Project

### Database Initialisation
If `migrate-mongo` fails due to DNS issues on Windows, use the Python initializer:
```bash
cd backend
python -m scripts.init_db
```

### Starting the Backend
```bash
cd backend
uvicorn app.main:app --reload
```

### Starting the Celery Worker
```bash
cd backend
celery -A app.celery_app worker --loglevel=info
```

### Starting the Celery Beat
```bash
cd backend
celery -A app.celery_app beat --loglevel=info
```
