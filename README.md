# MeetIO

## Quick Start
1. Copy the example env files:
   - `.env.example` → `.env`
   - `frontend/.env.example` → `frontend/.env.development`
2. Fill in the local dev values shown below.
3. Start the stack:
   ```bash
   docker compose up --build
   ```
4. Open:
   - frontend: `http://localhost:5173`
   - backend health: `http://localhost:8000/health`
   - Mailpit: `http://localhost:8025`

## Local Dev Env

**Root `.env`**
```bash
APP_ENV=development
SECRET_KEY=<64+ char hex secret>
FRONTEND_URL=http://localhost:5173
MONGODB_URI=mongodb://mongo:27017/meetio
MONGODB_DB_NAME=meetio
REDIS_URL=redis://redis:6379/0
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=240
JWT_REFRESH_TOKEN_EXPIRE_DAYS=15
GOOGLE_CLIENT_ID=dev-google-client-id
GOOGLE_CLIENT_SECRET=dev-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/v1/auth/google/callback
EMAIL_TRANSPORT=mailpit
MAILPIT_HOST=mailpit
MAILPIT_PORT=1025
MAILPIT_USERNAME=
MAILPIT_PASSWORD=
MAILPIT_USE_TLS=false
EMAIL_FROM=noreply@meetio.app
```

**`frontend/.env.development`**
```bash
VITE_APP_ENV=development
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
VITE_LIVEKIT_URL=wss://your-livekit-url.cloud
VITE_GOOGLE_CLIENT_ID=dev-google-client-id
VITE_SENTRY_DSN=
```

## Local Start
The recommended way to run the project locally is:
```bash
docker compose up --build
```

That starts:
- backend API at `http://localhost:8000`
- frontend at `http://localhost:5173`
- Mailpit at `http://localhost:8025`
- MongoDB and Redis for app state
- Celery worker and beat for background jobs

## Manual Start
If you do not want Docker, start each service separately:
- backend: `cd backend && uvicorn app.main:app --reload`
- worker: `cd backend && celery -A app.celery_app worker --loglevel=info`
- beat: `cd backend && celery -A app.celery_app beat --loglevel=info`
- frontend: `cd frontend && npm run dev -- --host 0.0.0.0 --port 5173`

## Logs
Viewing logs is optional.
- Use `docker compose logs -f <service>` if you want to inspect backend, worker, frontend, or Mailpit output.
- You do not need logs commands just to run the project.

## First Auth Check
1. Sign up on `/signup`.
2. Open the verification link in Mailpit.
3. Sign in on `/signin`.
4. If 2FA is enabled, enter the TOTP code from your authenticator app.
5. Use `/forgot-password` to request a reset link and finish the reset flow from Mailpit.
