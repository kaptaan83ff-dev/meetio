# MeetIO Project Setup Guide

This guide covers the local development setup for the MeetIO backend and frontend.

## 1. Prerequisites
- Python 3.12+
- Node.js 20+
- MongoDB Atlas Account (Free Tier)
- Upstash Account (Free Tier Redis)
- Optional for local auth testing: a terminal that can watch backend/Celery logs

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

### Exact Local Dev Values
For the Docker Compose stack, use these values:

**Backend / worker**
```bash
APP_ENV=development
FRONTEND_URL=http://localhost:5173
MONGODB_URI=mongodb://mongo:27017/meetio
MONGODB_DB_NAME=meetio
REDIS_URL=redis://redis:6379/0
EMAIL_TRANSPORT=mailpit
MAILPIT_HOST=mailpit
MAILPIT_PORT=1025
MAILPIT_USE_TLS=false
GOOGLE_CLIENT_ID=dev-google-client-id
GOOGLE_CLIENT_SECRET=dev-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/v1/auth/google/callback
RESEND_API_KEY=
```

**Frontend**
```bash
VITE_APP_ENV=development
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
VITE_LIVEKIT_URL=wss://your-livekit-url.cloud
VITE_GOOGLE_CLIENT_ID=dev-google-client-id
VITE_SENTRY_DSN=
```

### Docker Status
Current container support in the repo:
- `backend/Dockerfile` exists and is the only committed application Dockerfile right now.
- `frontend/Dockerfile` now exists for the dev frontend container.
- `docker-compose.yml` now brings up MongoDB, Redis, Mailpit, backend, and frontend together.
- Mailpit is now packaged as part of the local dev stack, not only ad hoc.

Practical implication:
- backend API and worker run in containers
- frontend runs in a containerized Vite dev server
- local email capture is available through Mailpit or console logs without needing a hosted mail provider

### Local Auth Verification
MeetIO does not require a real email inbox for local auth testing.

By default, `EMAIL_TRANSPORT=auto` uses a console transport in `development`. In Docker Compose, `EMAIL_TRANSPORT=mailpit` sends to the Mailpit SMTP container:
- signup verification emails are printed in the backend or Celery worker logs
- password reset emails are printed in the backend or Celery worker logs
- each log entry includes the clickable verification or reset link

Auth flow reference:
- sign-up uses an **email verification token** sent in a link
- forgot/reset password uses an **email reset token** sent in a link
- 2FA uses a **TOTP code** from an authenticator app, not email

If you want to force console capture explicitly, set:
```bash
EMAIL_TRANSPORT=console
```

If you want Mailpit SMTP instead of console logs:
```bash
EMAIL_TRANSPORT=mailpit
MAILPIT_HOST=localhost
MAILPIT_PORT=1025
```

Open the Mailpit UI at `http://localhost:8025` to inspect messages and click verification/reset links.

If you want to test production-style delivery, set:
```bash
EMAIL_TRANSPORT=resend
RESEND_API_KEY=your_resend_api_key
```

## 4. Running the Project

### Recommended Local Start
The fastest way to run the full local stack is:
```bash
docker compose up --build
```

This starts:
- MongoDB at `mongodb://localhost:27017`
- Redis at `redis://localhost:6379`
- Mailpit SMTP at `localhost:1025`
- Mailpit UI at `http://localhost:8025`
- Backend API at `http://localhost:8000`
- Frontend at `http://localhost:5173`

Recommended smoke check:
1. Open `http://localhost:8000/health`
2. Open `http://localhost:5173`
3. Open `http://localhost:8025`
4. Register a user and verify the email link from Mailpit

### Running Without Docker
Use these only if you prefer manual terminals instead of Compose:
- backend: `uvicorn app.main:app --reload`
- worker: `celery -A app.celery_app worker --loglevel=info`
- beat: `celery -A app.celery_app beat --loglevel=info`
- frontend: `npm run dev -- --host 0.0.0.0 --port 5173`

If `migrate-mongo` fails due to DNS issues on Windows, use the Python initializer before starting the backend:
```bash
cd backend
python -m scripts.init_db
```

### Logs Are Optional
You only need logs when debugging or verifying email/worker behavior.
- `docker compose logs -f backend`
- `docker compose logs -f celery-worker`
- `docker compose logs -f celery-beat`
- `docker compose logs -f frontend`
- `docker compose logs -f mailpit`

