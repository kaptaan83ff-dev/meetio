# Task Breakdown: Infrastructure Setup

**Feature:** Feature 1 from MVP Roadmap
**Estimated Time:** 6–8 hours
**Priority:** FIRST — must be complete before any other feature
**Status:** [ ] Not started

---

## Feature 1: Infrastructure Setup

---

### Task 1.1: Backend - Project Scaffolding & FastAPI App Initialisation [MVP]

- [x] Create full directory tree: `backend/app/main.py`, `backend/app/config.py`, `backend/app/db.py`, `backend/app/redis.py`, `backend/app/celery_app.py`, `backend/app/cache.py`, and subdirectories `backend/app/{routers/,services/,models/,tasks/,websocket/,prompts/}` — must match TRD §1.5 exactly
- [x] Initialise `backend/pyproject.toml` with `[project.dependencies]` listing all production deps from TRD Appendix A including the two additions from Change 2: `Pillow>=10.3.0` (avatar WebP encoding) and `pyotp>=2.9.0` (TOTP 2FA); list dev deps under `[project.optional-dependencies] dev = [pytest==8.1.1, pytest-asyncio==0.23.5, pytest-cov==5.0.0, fakeredis==2.21.0]`
- [x] Create `backend/Dockerfile`: `FROM python:3.12-slim`, `WORKDIR /app`, `COPY pyproject.toml .`, `RUN pip install --no-cache-dir .`, `COPY . .`, `EXPOSE 8000`, `CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]` — matches TRD §3.3 exactly
- [x] Create `backend/railway.toml` with `[build] builder = "dockerfile"`, `[deploy] startCommand = "uvicorn app.main:app --host 0.0.0.0 --port $PORT"`, `healthcheckPath = "/health"`, `healthcheckTimeout = 30`, `restartPolicyType = "on_failure"`, `restartPolicyMaxRetries = 3`
- [x] Create `backend/app/main.py`: instantiate `FastAPI(title="MeetIO API")`, add `CORSMiddleware` with origins from `settings.FRONTEND_URL`, add security headers middleware (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`), create `v1_router = APIRouter(prefix="/v1")`, stub `include_router` calls for all 9 domain routers — routers registered but routes implemented in later features
- [x] Create `.gitignore` covering `.venv/`, `__pycache__/`, `*.pyc`, `*.pyo`, `.env`, `dist/`, `node_modules/`, `.pytest_cache/`, `.DS_Store`, `*.egg-info/` — prevents secrets and build artifacts from being committed
- [x] Create `.env.example` listing all 25+ env vars from TRD §4.1 with placeholder values and inline comments (e.g. `SECRET_KEY=<run: openssl rand -hex 32>`, `MONGODB_URI=mongodb+srv://...`) — safe to commit, documents all required configuration
- Status: [x] COMPLETED

---

### Task 1.2: Backend - MongoDB Atlas & migrate-mongo Setup [MVP]

- [x] Create MongoDB Atlas M0 cluster, whitelist Railway static IP range and local dev machine IP in Atlas → Network Access — failing to whitelist both will cause connection failures on deploy
- [x] Initialise MongoDB collections and indexes: Created `backend/scripts/init_db.py` as a Python-based workaround for Node.js DNS issues (`npx migrate-mongo` fails on some Windows environments)
- [x] Write `backend/migrations/001_initial_schema.js`: call `db.createCollection()` for all 16 collections from `meetio-db-schema.md`, add `$jsonSchema` validators enforcing `schema_version: 1` and required field presence — validate collections exist after `up()` or throw
- [x] Write `backend/migrations/002_indexes.js`: apply all indexes per collection from `meetio-db-schema.md` using `db.collection.createIndex()` — include compound indexes, sparse indexes (google_id, gcal_event_id, meeting_id), and TTL indexes: `sessions.expires_at` (MongoDB auto-delete), `notifications.created_at` (expire after 7776000 seconds = 90 days), `dead_letter_events.created_at` (expire resolved after 604800 seconds = 7 days)
- [x] Configure Motor async client in `backend/app/db.py`: `client = AsyncIOMotorClient(settings.MONGODB_URI, maxPoolSize=10)`, `database = client[settings.MONGODB_DB_NAME]`, expose `async def get_db() -> AsyncIOMotorDatabase` as a FastAPI dependency — all routers receive DB via `Depends(get_db)`, never via global import
- [x] Write integration test `tests/test_db.py`: after running migrations, assert all 16 collection names exist via `db.list_collection_names()`, assert at least one index per collection via `db.collection.index_information()` — test fails if migration is incomplete
- 📐 Schema: `docs/requirements/meetio-db-schema.md`
- Status: [x] COMPLETED

---

### Task 1.3: Backend - Redis (Upstash) & Cache Layer [MVP]

- [x] Create Upstash Redis instance, copy the `rediss://` TLS URL (not `redis://`) into `.env` as `REDIS_URL` — Upstash requires TLS; plain `redis://` will be rejected
- [x] Create `backend/app/redis.py`: `redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)`, expose `async def get_redis()` FastAPI dependency returning the client — `decode_responses=True` ensures all values are returned as `str`, not `bytes`
- [x] Define all cache key templates and TTLs in `backend/app/cache.py` as constants: `DASHBOARD_STATS_KEY = "dashboard:stats:{user_id}"` (TTL 300s), `DASHBOARD_RECAPS_KEY = "dashboard:recaps:{user_id}"` (TTL 300s), `DASHBOARD_UPCOMING_KEY = "dashboard:upcoming:{user_id}"` (TTL 120s), `USER_PROFILE_KEY = "user:profile:{user_id}"` (TTL 600s), `MEETING_INFO_KEY = "meeting:info:{meeting_id}"` (TTL 30s)
- [x] Define WebSocket channel name constants in `cache.py`: `WS_USER_CHANNEL = "ws:user:{user_id}"`, `WS_MEETING_CHANNEL = "ws:meeting:{meeting_id}"` — used by `ConnectionManager.broadcast_to_user()` and `broadcast_to_meeting()` in Feature 14
- [x] Define OTP Redis key template: `OTP_KEY = "otp:{email}"` (TTL 900s = 15 min) — OTP state lives in Redis per DB schema Notes section, not MongoDB
- [x] Write integration test `tests/test_redis.py`: publish `{"type": "test"}` to `ws:user:test_user`, subscribe to that channel, assert message received within 2 seconds — confirms pub/sub round-trip; also assert `await redis_client.ping() == True` confirming TLS connection
- Status: [x] COMPLETED

---

### Task 1.4: Backend - Celery Worker, Beat Scheduler & P3 Stubs [MVP]

- [x] Create `backend/app/celery_app.py`: `app = Celery("meetio", broker=settings.REDIS_URL, backend=settings.REDIS_URL)`, configure `app.conf.update(task_serializer="json", result_serializer="json", accept_content=["json"], timezone="UTC", enable_utc=True)` — UTC-only prevents timezone bugs in scheduled tasks
- [x] Register all 6 Beat schedules in `celery_app.py` under `app.conf.beat_schedule`: `renew-gcal-channels` → `tasks.calendar.renew_expiring_channels` at `crontab(hour=1, minute=0)`; `process-dead-letter-queue` → `tasks.dlq.process_dead_letter_queue` every `timedelta(minutes=30)`; `purge-guest-data` → `tasks.gdpr.purge_expired_guest_data` at `crontab(hour=2, minute=0)`; `process-account-deletions` → `tasks.gdpr.process_pending_deletions` at `crontab(hour=2, minute=30)`; `send-due-date-reminders` → `tasks.notifications.send_due_date_reminders` at `crontab(hour=9, minute=0)`; `expire-meeting-recordings` → `tasks.gdpr.expire_old_recordings` at `crontab(hour=3, minute=0)`
- [x] ⚠️ Create stub implementations immediately in `backend/app/tasks/gdpr.py` for the three P3 tasks that Beat references — Celery raises `NotRegistered` at runtime if these functions don't exist when the schedule fires, even if they do nothing: `@celery_app.task(name="tasks.gdpr.purge_expired_guest_data") def purge_expired_guest_data(): pass  # TODO: Feature 25 (P3)`, same pattern for `process_pending_deletions` and `expire_old_recordings` — stubs are replaced with real logic in Feature 25
- [x] Create remaining task modules in `backend/app/tasks/`: `ai_pipeline.py`, `notifications.py` (stub `send_due_date_reminders`), `dlq.py` (stub `process_dead_letter_queue`), `calendar.py` (stub `renew_expiring_channels`) — all with Celery app import and module docstring; stubs prevent import errors when Beat loads all tasks on startup
- [x] Create Railway Celery worker service config: `startCommand = "celery -A app.celery_app worker --loglevel=info --concurrency=2"` in a separate `railway-worker.toml` — separate Railway service from the FastAPI web service
- [x] Create Railway Celery Beat service config: `startCommand = "celery -A app.celery_app beat --loglevel=info --scheduler celery.beat.PersistentScheduler"` — Beat must run as exactly one instance; never scale Beat horizontally
- [x] Write integration test `tests/test_celery.py`: define a simple `@celery_app.task def add(x, y): return x + y`, call `result = add.delay(2, 3)`, assert `result.get(timeout=10) == 5` — confirms broker (Redis) + worker communication is functional
- Status: [x] COMPLETED

---

### Task 1.5: Backend - Environment Configuration (Pydantic Settings) [MVP]

- [x] Create `backend/app/config.py` with `class Settings(BaseSettings)`: define all env var fields from TRD §4.1 with Python types — `APP_ENV: str = "development"`, `SECRET_KEY: str`, `FRONTEND_URL: str`, `MONGODB_URI: str`, `MONGODB_DB_NAME: str = "meetio"`, `REDIS_URL: str`, `JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 240`, `JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 15`, `MEETING_MAX_PARTICIPANTS: int = 50`, all third-party keys as `str`
- [x] Add `model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)` — enables `.env` file loading in development; production reads from Railway environment directly, no `.env` file committed
- [x] Add `@field_validator("SECRET_KEY")` classmethod: raise `ValueError("SECRET_KEY must be at least 64 hex characters")` if `len(v) < 64` — prevents running with a weak or placeholder secret in any environment
- [x] Add `@field_validator("APP_ENV")` classmethod: raise `ValueError` if value not in `["development", "staging", "production"]` — catches typos in environment names that would silently misconfigure rate limits or CORS
- [x] Define `settings = Settings()` singleton at module bottom — all modules import as `from app.config import settings`; constructing at import time ensures misconfigured environments fail loudly on startup, not on first request
- [x] Create `docs/setup.md` documenting: generating `SECRET_KEY` with `openssl rand -hex 32`, obtaining all third-party API keys (MongoDB Atlas, Upstash, LiveKit, Deepgram, Resend, Cloudflare R2, Google OAuth), required environment for local dev setup (`python -m venv .venv && source .venv/bin/activate && pip install -e ".[dev]"`) — reduces onboarding friction for future contributors
- Status: [x] COMPLETED

---

### Task 1.6: Backend - Health Check Endpoint [MVP]

- [x] Create `backend/app/routers/health.py` with `router = APIRouter(tags=["Health"])` and `@router.get("/health")` — no auth dependency; registered directly on `app` (not under `v1_router`) so Railway's healthcheck at `/health` resolves without the `/v1` prefix
- [x] Implement `async def check_mongodb(db) -> bool`: call `await db.command("ping")`, return `True` on success; catch `Exception` broadly and return `False` — never let the health check itself raise an exception; a 500 from `/health` is worse than a 503 with details
- [x] Implement `async def check_redis(redis) -> bool`: call `await redis.ping()`, return `True` if response is truthy; catch `Exception` and return `False` — Upstash TLS errors surface here first
- [x] Implement `async def check_celery() -> bool`: call `celery_app.control.inspect(timeout=3.0).active()`, return `True` if response is a non-empty dict (workers responding); return `False` if response is `None` or raises — 3-second timeout prevents health check from blocking Railway deploy healthcheck probe
- [x] Return `200 {"data": {"status": "ok", "checks": {"mongodb": True, "redis": True, "celery": True}}}` if all three pass; return `503 {"data": {"status": "degraded", "checks": {per-check booleans}}}` if any fail — matches API spec §10 exactly including `success`, `data`, `error`, `meta` envelope
- [x] Write integration test `tests/test_health.py`: mock `check_mongodb` → `False`, assert response is 503 with `status: "degraded"` and `mongodb: false`; mock all three → `True`, assert 200 with `status: "ok"` — covers both degraded and healthy code paths
- Status: [x] COMPLETED

---

### Task 1.7: Backend - GitHub Actions CI/CD Pipeline [MVP]

- [x] Create `.github/workflows/ci.yml` — backend CI job: `services: {mongodb: {image: mongo:7}, redis: {image: redis:7}}`, steps: checkout, `pip install -e ".[dev]"`, `pytest tests/ --cov=app --cov-report=term-missing -x` (fail fast on first failure); runs on every PR and push to `main`
- [x] Add frontend CI job to same `ci.yml` file: `working-directory: ./frontend`, steps: `npm ci`, `npm run lint` (ESLint), `npm run type-check` (tsc --noEmit), `npm run test` (Vitest `--run` mode, no watch); both jobs run in parallel — PR is blocked if either fails
- [x] Create `.github/workflows/deploy.yml` — trigger: `push: branches: [main]`, jobs: `migrate` (runs first) → `deploy-backend` (needs: migrate) → `deploy-frontend` (needs: migrate); failing migration aborts both deploys
- [x] Implement `migrate` job: `run: npm install -g migrate-mongo && cd backend && migrate-mongo up` using `env: MONGODB_URI: ${{ secrets.MONGODB_URI_PRODUCTION }} MONGODB_DB_NAME: meetio` — pipeline is fully blocked if migration fails, preventing broken schema from reaching production
- [x] Implement `deploy-backend` job: use `railwayapp/railway-action@v1` with `service: meetio-backend` and `RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}` — Railway pulls the Docker image and restarts the service
- [x] Implement `deploy-frontend` job: use `cloudflare/pages-action@v1` with `directory: frontend/dist`, `projectName: meetio-frontend`, `CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}`, `CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}`
- [x] Create `docs/secrets.md` documenting all required GitHub repository secrets: `MONGODB_URI_PRODUCTION` (Atlas connection string), `RAILWAY_TOKEN` (from Railway dashboard → Account Settings), `CLOUDFLARE_API_TOKEN` (scoped to Pages only), `CLOUDFLARE_ACCOUNT_ID` — with instructions on obtaining each; prevents deploy failures from missing secrets
- Status: [x] COMPLETED

---

### Task 1.8: Frontend - Vite Project Scaffolding & Dependency Installation [MVP]

- [x] Scaffold frontend with `npm create vite@5 frontend -- --template react-ts` — Created `package.json`, `tsconfig.json`, `vite.config.ts`, and core directory structure manually for precise control
- [x] Install all dependencies matching TRD Appendix A `package.json`: Included in `package.json` with exact versions: `react@18.3.0`, `zustand@^4.5.0`, `livekit-client@^2.0.0`, `tweetnacl@^1.0.3`, etc.
- [x] Configure Tailwind CSS: Created `tailwind.config.ts` with the Neo-Brutalist palette (Sun Yellow `#ffe500`, Electric Pink `#ff4f8b`, Ink Black `#0a0a0a`); added `@tailwind` directives to `src/index.css`
- [x] Create directory structure under `frontend/src/`: `stores/`, `pages/`, `components/`, `hooks/`, `lib/`, `config/`, `types/` — matching TRD §1.5
- [x] Configure `vite.config.ts`: Added path aliases (`@/`), `envPrefix: "VITE_"`, and local proxy to `http://localhost:8000`
- [x] Create `frontend/public/_redirects` with `/* /index.html 200` — for Cloudflare Pages SPA support
- [x] Update `frontend/src/main.tsx`: Implemented dark mode initialization (checking `localStorage` and `matchMedia`) and a basic `RouterProvider` setup
- Status: [x] COMPLETED

---

### Task 1.9: Frontend - Environment Configuration & Router Stub [MVP]

- [x] Create `frontend/src/config/env.ts` with typed `env` const: `apiUrl: import.meta.env.VITE_API_URL as string`, `wsUrl: import.meta.env.VITE_WS_URL as string`, `livekitUrl: import.meta.env.VITE_LIVEKIT_URL as string`, `appEnv: import.meta.env.VITE_APP_ENV as "development" | "staging" | "production"`, `sentryDsn: import.meta.env.VITE_SENTRY_DSN as string` — single source of truth; components never read `import.meta.env` directly
- [x] Add runtime guard in `env.ts`: if `!env.apiUrl || !env.wsUrl` in `"development"` or `"staging"` env, throw `Error("VITE_API_URL and VITE_WS_URL must be set — check .env.development")` — catches misconfiguration at startup rather than silent failures on first API call
- [x] Create `frontend/.env.development` with local values: `VITE_API_URL=http://localhost:8000`, `VITE_WS_URL=ws://localhost:8000`, `VITE_APP_ENV=development` — never commit with real API keys; `.env` is in `.gitignore`
- [x] Create `frontend/.env.example` listing all `VITE_` variables with placeholder values and comments matching TRD §4.1 — committed to repo so new developers know all required frontend env vars
- [x] Create `frontend/src/router.tsx` using `createBrowserRouter` with all routes from TRD §2.3 stubbed as `element: <div>placeholder</div>`: `/signin`, `/signup`, `/forgot-password`, `/dashboard`, `/calendar`, `/messenger`, `/action-items`, `/settings`, `/profile`, `/meeting/:id/lobby`, `/meeting/:id`, `/meetings/:id/recap`, `/meetings/:id/transcript`, `/meetings/:id/recording` — stubs prevent TypeScript errors on `<Link to="/dashboard">` in later components before the real pages exist
- Status: [x] COMPLETED

---

## Future Tasks (Not MVP)

### Task 1.10: Frontend - Browser Support Detection

- [ ] Create `frontend/src/lib/browserCheck.ts` exporting `isBrowserSupported(): boolean` — checks `!!navigator.mediaDevices`, `!!window.crypto?.subtle`, `!!window.indexedDB`, `typeof WebSocket !== "undefined"` — all four must pass; missing any one means core meeting features will fail
- [ ] Call `isBrowserSupported()` in `frontend/src/main.tsx` before `ReactDOM.createRoot` — render `<UnsupportedBrowserBanner />` full-page blocking component instead of the app if check fails
- [ ] Create `<UnsupportedBrowserBanner />` component: non-dismissable full-page overlay listing minimum versions: Chrome 100+, Firefox 115+, Safari 16.4+, Edge 100+; include download links for each browser; styled with Tailwind, works without JS router
- [ ] Add browser minimum version messaging to banner: explain WHY each API is needed (`mediaDevices` for camera/mic, `crypto.subtle` for E2E encryption, `indexedDB` for key storage, `WebSocket` for real-time events)
- [ ] Write manual test checklist in `docs/browser-support.md`: list exactly how to test each browser in an old version (browser flags, VM setup), and expected pass/fail behaviour — prevents regressions when Vite/polyfill config changes
- Status: TODO

---

## Summary

| Category     | Tasks   | Completed | Remaining |
| ------------ | ------- | --------- | --------- |
| MVP Tasks    | 9       | 9         | 0         |
| Future Tasks | 1       | 0         | 1         |
| **Total**    | **10**  | **9**     | **1**     |

## Execution Order

1. **Backend Foundation:** 1.1 [x]
2. **Backend Data Layer:** 1.2 → 1.3 [x]
3. **Backend Services:** 1.4 → 1.5 → 1.6 [x]
4. **Backend CI/CD:** 1.7 [x]
5. **Frontend Foundation:** 1.8 → 1.9 [x]
6. **Future:** 1.10 (Browser support detection — defer until pre-launch)
