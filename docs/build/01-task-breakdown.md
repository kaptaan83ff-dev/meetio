# Task Breakdown: Infrastructure & DevOps

**Feature:** #1 from MVP Roadmap
**Estimated Time:** 12–16 hours total
**Priority:** FIRST — nothing else can be built without this
**Status:** [NOT STARTED] — All MVP Tasks 1.1-1.11 Complete

> [!IMPORTANT]
> **New Rule:** New tasks and subtasks can be added if they are compulsory for security, stability, or architectural integrity.

---

## Feature 1: Infrastructure & DevOps

---

### Task 1.1: Backend — Project Scaffolding [MVP]

- [x] Create `backend/` root directory with subdirectories: `app/`, `tests/`, `migrations/`, `prompts/`
- [x] Create `backend/app/` subdirectories: `routers/`, `services/`, `tasks/`, `websocket/`, `models/`
- [x] Initialise `backend/pyproject.toml` with `[project]` (name, version, python requires = ">=3.12"), `[project.dependencies]` listing all TRD Appendix A packages, `[project.optional-dependencies] dev = [pytest, pytest-asyncio, pytest-cov, httpx]`
- [x] Create `backend/.python-version` pinning `3.12` for Railway and local tooling consistency
- [x] Create `backend/Dockerfile`: `FROM python:3.12-slim`, `WORKDIR /app`, `COPY pyproject.toml .`, `RUN pip install --no-cache-dir .`, `COPY . .`, `EXPOSE 8000`, `CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]`
- [x] Create `backend/railway.toml`: `[build] builder="dockerfile"`, `[deploy] startCommand="uvicorn app.main:app --host 0.0.0.0 --port $PORT"`, `healthcheckPath="/health"`, `healthcheckTimeout=30`, `restartPolicyType="on_failure"`, `restartPolicyMaxRetries=3`
- [x] Create `backend/app/main.py`: FastAPI app instance, include all routers, CORS middleware (origins from `settings.FRONTEND_URL`), lifespan context manager placeholder
- 📐 Schema: `meetio-db-schema.md#collections-index`
- Status: [x] DONE
- Tests: [x] DONE (Scaffolding verified by build process)

---

### Task 1.2: Backend — Environment Configuration [MVP]

- [x] Create `backend/app/config.py` with Pydantic `BaseSettings` class — all fields from TRD §4.1: `APP_ENV`, `SECRET_KEY`, `FRONTEND_URL`, `MONGODB_URI`, `MONGODB_DB_NAME`, `REDIS_URL`, `JWT_ACCESS_TOKEN_EXPIRE_MINUTES=240`, `JWT_REFRESH_TOKEN_EXPIRE_DAYS=15`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `DEEPGRAM_API_KEY`, `AI_PROVIDER`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `OTP_EXPIRE_MINUTES=10`, `OTP_MAX_ATTEMPTS=5`, `MAX_PARTICIPANTS_PER_MEETING=50`
- [x] Add `model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")` for local dev `.env` file loading
- [x] Export a singleton `settings = Settings()` instance at module level — all other modules import from here, never use `os.environ` directly
- [x] Create `.env.example` at repo root listing every variable with placeholder values and one-line comments — committed to git
- [x] Create `.env.development` pointing to local MongoDB (`mongodb://localhost:27017/meetio_dev`) and local Redis (`redis://localhost:6379`)
- [x] Validate that `SECRET_KEY` is exactly 64 hex chars — add `@field_validator("SECRET_KEY")` that raises `ValueError` if `len(v) != 64`
- Status: [x] DONE
- Tests: [x] DONE (Pydantic validation verified on startup)

---

### Task 1.3: Backend — MongoDB Atlas Setup [MVP]

- [ ] **(Manual Step)** Create Atlas M0 free cluster, add Railway CIDR range and `0.0.0.0/0` for dev to IP allowlist, create DB user with `readWrite` on `meetio` database
- [ ] Install `migrate-mongo`, create `backend/migrations/config.js` with `url: process.env.MONGODB_URI`, `databaseName: "meetio"`, `migrationsDir: "migrations"`
- [ ] Write `backend/migrations/20260430000001-initial-schema.js`: `up()` creates all 16 collections with `db.createCollection(name, {validator: {$jsonSchema: {bsonType: "object", required: ["schema_version"]}}})` — `down()` drops them all
- [ ] Write `backend/migrations/20260430000002-indexes.js`: `up()` runs `db.collection.createIndex()` for every index in `meetio-db-schema.md` — `down()` drops all non-default indexes
- [ ] Configure Motor async client in `backend/app/db.py`: `AsyncIOMotorClient(settings.MONGODB_URI, maxPoolSize=10)`, expose `db = client[settings.MONGODB_DB_NAME]`, expose per-collection accessors (e.g. `users = db["users"]`)
- [ ] Write `tests/test_db.py` integration test: after migration, assert all 16 collection names exist, assert `users` has `{email: 1}` unique index via `collection.index_information()`
- 📐 Schema: `meetio-db-schema.md#collections-index`
- Status: [ ] TO-DO
- Tests: [ ] TO-DO (`test_db.py` passed)

---

### Task 1.4: Backend — Redis (Upstash) Setup [MVP]

- [ ] **(Manual Step)** Create Upstash Redis instance (free tier), copy `rediss://` TLS URL into `.env` as `REDIS_URL`
- [ ] Create `backend/app/redis.py`: `redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)` — single shared async client
- [ ] Define all cache key templates as constants in `backend/app/cache.py`: `DASHBOARD_STATS = "dashboard:stats:{user_id}"` (TTL 300s), `DASHBOARD_RECAPS = "dashboard:recaps:{user_id}"` (TTL 300s), `DASHBOARD_UPCOMING = "dashboard:upcoming:{user_id}"` (TTL 120s), `USER_PROFILE = "user:profile:{user_id}"` (TTL 600s), `MEETING_INFO = "meeting:info:{meeting_id}"` (TTL 30s), `WS_USER_CHANNEL = "ws:user:{user_id}"`, `WS_MEETING_CHANNEL = "ws:meeting:{meeting_id}"`
- [ ] Configure Celery in `backend/app/celery_app.py`: `Celery("meetio", broker=settings.REDIS_URL, backend=settings.REDIS_URL)`, `task_serializer="json"`, `result_expires=3600`
- [ ] Write `tests/test_redis.py` integration test: `await redis_client.publish("ws:user:test", '{"type":"ping"}')`, subscribe, assert message received within 1 second (pub/sub round-trip)
- [ ] Write `tests/test_celery.py` integration test: dispatch `add.delay(1, 2)` test task, assert `result.get(timeout=5) == 3`
- Status: [ ] TO-DO
- Tests: [ ] TO-DO (`test_redis.py` and `test_celery.py` passed)

---

### Task 1.5: Backend — Celery + Beat Setup [MVP]

- [ ] Complete `backend/app/celery_app.py`: configure `beat_schedule` with all 6 tasks — `renew-gcal-channels` (`crontab(hour=1, minute=0)`), `process-dead-letter-queue` (every 1800s), `purge-guest-data` (`crontab(hour=2, minute=0)`), `process-account-deletions` (`crontab(hour=2, minute=30)`), `send-due-date-reminders` (`crontab(hour=9, minute=0)`), `expire-meeting-recordings` (`crontab(hour=3, minute=0)`)
- [ ] Create `backend/app/tasks/ai_pipeline.py` with stub functions: `run_deepgram_transcription`, `run_llm_pipeline`, `finalize_recap`, `auto_confirm_action_items` — each decorated with `@celery.task(bind=True, max_retries=3)`
- [ ] Create `backend/app/tasks/gdpr.py` with stubs: `purge_expired_guest_data`, `process_pending_deletions`, `expire_old_recordings`
- [ ] Create `backend/app/tasks/notifications.py` with stubs: `send_email`, `send_due_date_reminders`
- [ ] Create `backend/app/tasks/calendar.py` with stub: `renew_expiring_channels`
- [ ] Create `backend/app/tasks/dlq.py` with stub: `process_dead_letter_queue`
- [ ] Create Railway worker service config (`railway.worker.toml`): `startCommand = "celery -A app.celery_app worker --loglevel=info --concurrency=2"`; Beat service config: `startCommand = "celery -A app.celery_app beat --loglevel=info"`
- Status: [ ] TODO
- Tests: [ ] TODO (Worker/Beat configurations verified)

---

### Task 1.6: Backend — Health Check Endpoint [MVP]

- [ ] Create `backend/app/routers/health.py` with `router = APIRouter(tags=["Infrastructure"])` and `GET /health` route
- [ ] Implement `async def check_mongodb() -> bool`: call `await db.command("ping")`, return `True` on success, `False` on `Exception`
- [ ] Implement `async def check_redis() -> bool`: call `await redis_client.ping()`, return `True` on success, `False` on `Exception`
- [ ] Implement `async def check_celery() -> bool`: use `celery_app.control.inspect().ping()` with 2-second timeout, return `True` if any worker responds
- [ ] Build response: if all `True` → `JSONResponse(status_code=200, content={"status": "ok", "checks": checks})`, if any `False` → `JSONResponse(status_code=503, content={"status": "degraded", "checks": checks})`
- [ ] Write `tests/test_health.py`: test 200 response with all services mocked healthy, test 503 response with MongoDB mocked to raise `Exception`
- [ ] Register `health_router` in `backend/app/main.py` — no auth prefix, exposed at `/health` (not `/v1/health`)
- Status: [ ] TODO
- Tests: [ ] TODO (`test_health.py` passed)

---

### Task 1.7: Backend — CI/CD Pipeline [MVP]

- [ ] Create `.github/workflows/ci.yml`: trigger on `pull_request` to `main` and `staging`; backend job spins up `mongo:7` and `redis:7` services, runs `pytest tests/ --cov=app --cov-report=xml`; frontend job runs `npm ci`, `npm run lint`, `npm run type-check`, `npm run test -- --run`, `npm run build`
- [ ] Create `.github/workflows/deploy.yml`: trigger on `push` to `main`; migrate job runs `migrate-mongo up` using `MONGODB_URI_PRODUCTION` secret; deploy-backend job uses `railwayapp/railway-action@v1` with `RAILWAY_TOKEN` secret; deploy-frontend job builds `npm run build` and deploys via `cloudflare/pages-action@v1`
- [ ] Create `docs/secrets.md` listing all required GitHub Actions secrets: `MONGODB_URI_PRODUCTION`, `RAILWAY_TOKEN`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `VITE_API_URL`, `VITE_WS_URL`, `VITE_LIVEKIT_URL`
- [ ] Create `docs/ci-cd.md` with pipeline documentation
- Status: [ ] TODO
- Tests: [ ] TODO (YAML validation and secret listing verified)

---

### Task 1.8: Frontend — Project Scaffolding [MVP]

- [ ] Run `npm create vite@latest frontend -- --template react-ts` inside repo root, confirm `frontend/src/` and `frontend/public/` structure
- [ ] Install all frontend dependencies: `react-router-dom@^6`, `zustand@^4`, `tailwindcss@^3`, `autoprefixer`, `postcss`, `@livekit/components-react`, `livekit-client`, `tweetnacl`, `tweetnacl-util`, `idb`, `@sentry/react`
- [ ] Configure Tailwind: `npx tailwindcss init -p`, set `content: ["./index.html", "./src/**/*.{ts,tsx}"]`, add brand and meeting color tokens from TRD §2.6 to `tailwind.config.ts`
- [ ] Create `frontend/src/config/env.ts` exporting typed `env` const: `{ apiUrl, wsUrl, livekitUrl, appEnv, sentryDsn }` — all from `import.meta.env.VITE_*`
- [ ] Configure `vite.config.ts`: `envPrefix: "VITE_"`, `server.proxy` to backend at `localhost:8000` for `/v1` and `/auth` paths in dev
- [ ] Create base directory structure: `src/pages/`, `src/components/`, `src/stores/`, `src/hooks/`, `src/lib/`, `src/types/`
- [ ] Create `frontend/public/_redirects` with `/* /index.html 200` for Cloudflare Pages SPA fallback
- Status: [ ] TODO
- Tests: [ ] TODO (Build process verified scaffolding)

---

### Task 1.9: Frontend — Router & Base Pages [MVP]

- [ ] Create `frontend/src/router.tsx` using `createBrowserRouter` — define all routes from TRD §2.4: `/`, `/signin`, `/signup`, `/forgot-password`, `/meeting/:id/lobby`, `/meeting/:id`, `/dashboard`, `/calendar`, `/messenger`, `/messenger/:id`, `/meetings/:id/recap`, `/meetings/:id/transcript`, `/meetings/:id/recording`, `/action-items`, `/settings`, `/profile`
- [ ] Create `frontend/src/pages/LandingPage.tsx` — public marketing page at `/`: hero section ("Start a meeting in under 10 seconds"), three pillar cards (Speed / Intelligence / Security), [Start a Meeting] CTA (navigates to `/signup`), [Sign In] link, responsive layout
- [ ] Create `frontend/src/pages/NotFoundPage.tsx` — 404 page: "404 — Page Not Found" heading, brief message, [Go to Dashboard] button (auth) or [Go Home] button (unauth), centered layout, matching brand colors
- [ ] Create `frontend/src/components/layouts/AuthLayout.tsx` — wraps all auth pages (`/signin`, `/signup`, `/forgot-password`): centered card `max-w-md`, MeetIO logo top-center, renders `<Outlet />`
- [ ] Create `frontend/src/components/layouts/AppLayout.tsx` — wraps all authenticated app pages: top nav (logo, notification bell, user avatar dropdown), renders `<Outlet />`, redirects to `/signin` if unauthenticated
- [ ] Wire router in `frontend/src/main.tsx`: `ReactDOM.createRoot(document.getElementById("root")!).render(<RouterProvider router={router} />)`
- [ ] Add `<NotFoundPage />` as `errorElement` on the root route so any unmatched path renders the 404 page
- Status: [ ] TODO
- Tests: [ ] TODO (Visual verification of routing and 404 handler)

---

### Task 1.10: Frontend — Zustand Stores [MVP]

- [ ] Create `frontend/src/stores/authStore.ts`: `User` interface (`id`, `displayName`, `email`, `avatarUrl`, `providers`), `AuthStore` interface with `user`, `isAuthenticated`, `isLoading`, `setUser()`, `setLoading()`, `logout()` — persisted with `zustand/middleware persist`, `partialize: (s) => ({ user: s.user })`
- [ ] Create `frontend/src/stores/meetingStore.ts`: `Participant` interface, `MeetingStore` with `meetingId`, `participants`, `waitingRoom`, `isRecording`, `roomLocked`, `waitingRoomEnabled`, `reactionsEnabled` — implement `clearMeeting()` resetting ALL 7 fields to initial values, `setRecording(isRecording: boolean)` (not a toggle — set from server event)
- [ ] Create `frontend/src/stores/uiStore.ts`: `isChatOpen`, `isParticipantsOpen`, `isCaptionsEnabled`, `isOffline`, `activeModal`, `theme` — implement `toggleChat()`, `toggleParticipants()`, `setOffline(bool)`, `openModal(name)`, `closeModal()`
- [ ] Create `frontend/src/stores/notificationStore.ts`: `Notification` interface, `notifications[]`, `unreadCount`, implement `addNotification(n)`, `markRead(id)`, `markAllRead()`, `setNotifications(ns)`
- [ ] Enforce selector pattern in all stores: add ESLint comment at top of each store file reminding to use `useStore(s => s.field)` pattern — never `useStore()` with no selector
- [ ] Write Vitest unit tests for `clearMeeting()` (verify all 7 fields reset), `setRecording(true/false)` (verify state changes correctly), `markAllRead()` (verify unreadCount = 0)
- Status: [ ] TODO
- Tests: [ ] TODO (Vitest units passed)

---

### Task 1.11: Frontend — API Client [MVP]

- [ ] Create `frontend/src/lib/apiClient.ts` with `apiRequest(url, options)` base function: sets `credentials: "include"` on all requests, prepends `env.apiUrl` to relative paths
- [ ] Implement token refresh mutex: `let refreshPromise: Promise<void> | null = null`, on 401 response → if `refreshPromise` in-flight return it, else create new `fetch("/v1/auth/refresh", {method: "POST", credentials: "include"})` promise assigned to `refreshPromise`, reset to `null` in `.finally()`
- [ ] On refresh failure (non-ok response): call `useAuthStore.getState().logout()`, `window.location.href = "/signin"`, throw error (Fixed: `useAuthStore` import added)
- [ ] On 429 response: extract `Retry-After` header, throw `RateLimitError` with retry seconds
- [ ] On 503 response: throw `ServiceUnavailableError` — UI layer catches and shows degraded banner
- [ ] Write Vitest unit test: mock `fetch` to return 401 four times simultaneously → assert `fetch("/v1/auth/refresh")` called exactly once
- Status: [ ] TODO
- Tests: [ ] TODO (Vitest units passed)

---

### Task 1.12: Backend — Global Exception Handling & Response Wrapping [Compulsory]

- [ ] Create `backend/app/errors.py`: Implemented `AppError` hierarchy (`AuthError`, `ValidationError`) for structured error responses.
- [ ] Implement `success_response` helper: Ensures all successful API responses follow the `{ "success": true, "data": ... }` envelope pattern.
- [ ] Register Global Exception Handler: Integrated `app_error_handler` in `backend/app/main.py` to catch `AppError` and return consistent JSON.
- [ ] Align with Frontend: Verified that `apiClient.ts` correctly parses the `{ success, data, error }` format.
- Status: [ ] TODO
- Tests: [ ] TODO (Verified via manual integration testing with Auth router)

---

## Future Tasks

### Task 1.13: Frontend — Browser Support Detection [Later]

- [ ] Create `frontend/src/lib/browserCheck.ts` with `isBrowserSupported(): boolean` — check `!!navigator.mediaDevices?.getUserMedia`, `!!window.crypto?.subtle`, `!!window.indexedDB`, `typeof WebSocket !== "undefined"`
- [ ] Call `isBrowserSupported()` in `frontend/src/main.tsx` before `ReactDOM.createRoot` — if false, render `<UnsupportedBrowserBanner />` into `document.getElementById("root")` and do NOT mount the React app
- [ ] Create `frontend/src/components/UnsupportedBrowserBanner.tsx` — full-page centered layout: "Your browser isn't supported", list minimums (Chrome 100+, Firefox 115+, Safari 16.4+, Edge 100+), download links for each, no close button
- [ ] Add browser metadata to banner: detect current browser name + version using `navigator.userAgent`, display "You're using {Browser} {Version}" above the list
- [ ] Manually test in Chrome 99 (should show banner), Chrome 100 (should load app), Firefox 114 (banner), Safari 16.3 (banner)
- Status: TODO
- Tests: [ ] Not Started

---

## Summary

| Category     | Tasks  | Completed | Remaining |
| ------------ | ------ | --------- | --------- |
| MVP Tasks    | 12     | 0         | 12        |
| Future Tasks | 1      | 0         | 1         |
| **Total**    | **13** | **0**     | **13**    |

## Execution Order

1. **Backend Foundation:** 1.1 → 1.2 (Scaffolding → Env Config)
2. **Backend Services:** 1.3 → 1.4 → 1.5 (MongoDB → Redis → Celery)
3. **Backend APIs:** 1.6 (Health check)
4. **Backend DevOps:** 1.7 (CI/CD pipeline)
5. **Frontend Foundation:** 1.8 → 1.9 (Scaffolding → Router + Pages)
6. **Frontend State:** 1.10 → 1.11 (Stores → API Client)
7. **Refinement:** 1.12 (Error Handling & Response Wrapping)
8. **Future:** 1.13 (Browser support detection)
