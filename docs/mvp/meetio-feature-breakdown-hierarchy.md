# Feature Breakdown Hierarchy

**Source:** meetio-feature-breakdown-docs.md
**Date:** April 30, 2026
**Project:** MeetIO
**Status:** Not started

---

## Feature 1: Infrastructure & DevOps [MVP]

### Task: Project Scaffolding [MVP]
- Subtask: Create `backend/` directory with `app/`, `tests/`, `migrations/` subdirectories
- Subtask: Create `frontend/` directory with `src/`, `public/` subdirectories matching Vite scaffold
- Subtask: Initialise `pyproject.toml` in `backend/` with `[project.dependencies]` and `[project.optional-dependencies] dev = [...]` sections
- Subtask: Initialise `frontend/package.json` with React 18, Vite 5, Tailwind CSS, Zustand, React Router v6 dependencies
- Subtask: Create `backend/Dockerfile` using `python:3.12-slim`, `COPY pyproject.toml`, `pip install --no-cache-dir .`, `CMD uvicorn app.main:app`
- Subtask: Create `backend/railway.toml` with `startCommand`, `healthcheckPath = "/health"`, `restartPolicyType = "on_failure"`
- Subtask: Create `.gitignore` covering `.venv/`, `__pycache__/`, `.env`, `dist/`, `node_modules/`
- Subtask: Create `.env.example` listing all required variables from TRD §4.1 with placeholder values

### Task: MongoDB Atlas Setup [MVP]
- Subtask: Create M0 Atlas cluster, whitelist Railway IP range + local dev IP
- Subtask: Configure `migrate-mongo` in `backend/migrations/` with `config.js` pointing to `MONGODB_URI`
- Subtask: Write migration `001_initial_schema.js` creating all 16 collections with `validator` and `schema_version`
- Subtask: Write migration `002_indexes.js` applying all indexes from `meetio-db-schema.md` per collection
- Subtask: Configure Motor async client (`motor.motor_asyncio.AsyncIOMotorClient`) with `maxPoolSize=10` in `backend/app/db.py`
- Subtask: Write integration test verifying all 16 collections exist and required indexes are present after migration

### Task: Redis (Upstash) Setup [MVP]
- Subtask: Create Upstash Redis instance, copy `rediss://` TLS URL into env
- Subtask: Configure `redis.asyncio.from_url(settings.REDIS_URL, decode_responses=True)` in `backend/app/redis.py`
- Subtask: Configure Celery broker and result backend both pointing to `REDIS_URL` in `backend/app/celery_app.py`
- Subtask: Define Redis cache key constants and TTLs (`dashboard:stats:{user_id}` 5min, `meeting:info:{id}` 30s, etc.) in `backend/app/cache.py`
- Subtask: Write integration test: publish to `ws:user:test`, subscribe, verify message received (pub/sub round-trip)

### Task: Celery + Beat Setup [MVP]
- Subtask: Create `backend/app/celery_app.py` with Celery instance, broker + result backend from Redis URL
- Subtask: Register all 6 Celery Beat schedules: `renew-gcal-channels` (01:00 UTC), `process-dead-letter-queue` (30min), `purge-guest-data` (02:00 UTC), `process-account-deletions` (02:30 UTC), `send-due-date-reminders` (09:00 UTC), `expire-meeting-recordings` (03:00 UTC)
- Subtask: Create `backend/app/tasks/` directory with task modules: `ai_pipeline.py`, `gdpr.py`, `calendar.py`, `notifications.py`, `dlq.py`
- Subtask: ⚠️ Create stub implementations in `gdpr.py` immediately for the three P3 tasks that Beat references: `purge_expired_guest_data`, `process_pending_deletions`, `expire_old_recordings` — each with a `pass` body and a `# TODO: Feature 25 (P3)` comment. Beat will fail with `NotRegistered` at runtime if these functions don't exist when the schedule fires, even if the real logic isn't built yet.
- Subtask: Create `Procfile` or Railway service config for Celery worker: `celery -A app.celery_app worker --loglevel=info`
- Subtask: Create separate Railway service config for Celery Beat: `celery -A app.celery_app beat --loglevel=info`
- Subtask: Write integration test dispatching a simple test task and verifying result stored in Redis

### Task: CI/CD Pipeline [MVP]
- Subtask: Create `.github/workflows/ci.yml` — backend job: spin up MongoDB + Redis services, `pip install -e ".[dev]"`, `pytest tests/ --cov=app -x`
- Subtask: Add frontend job to `ci.yml`: `npm ci`, `npm run lint`, `npm run type-check`, `npm run test` — all in `working-directory: ./frontend`
- Subtask: Create `.github/workflows/deploy.yml` — migrate job: `npm install -g migrate-mongo && migrate-mongo up` against production URI
- Subtask: Add `deploy-backend` job (needs: migrate) using `railwayapp/railway-action@v1`
- Subtask: Add `deploy-frontend` job (needs: migrate) using `cloudflare/pages-action@v1`, `directory: frontend/dist`
- Subtask: Document all required GitHub secrets in `docs/secrets.md`: `MONGODB_URI_PRODUCTION`, `RAILWAY_TOKEN`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

### Task: Environment Configuration [MVP]
- Subtask: Create `backend/app/config.py` using Pydantic `BaseSettings`, all fields from TRD §4.1 with correct types
- Subtask: Create `frontend/src/config/env.ts` exporting typed `env` const from `import.meta.env` variables
- Subtask: Add `vite.config.ts` `envPrefix: "VITE_"` to restrict which env vars are bundled
- Subtask: Create `.env.development` and `.env.staging` template files (no real secrets — point to dev services)
- Subtask: Verify `SECRET_KEY` is 64-char hex generated via `openssl rand -hex 32` and documented in setup guide

### Task: Health Check Endpoint [MVP]
- Subtask: Create `GET /health` route in `backend/app/routers/health.py`
- Subtask: Implement `check_mongodb()` — ping Atlas, return True/False
- Subtask: Implement `check_redis()` — `await redis.ping()`, return True/False
- Subtask: Implement `check_celery_heartbeat()` — inspect active workers, return True/False
- Subtask: Return `200 ok` if all pass, `503 degraded` with per-check breakdown if any fail
- Subtask: Write integration test for both 200 and 503 responses

### Task: Browser Support Detection [Later]
- Subtask: Create `frontend/src/lib/browserCheck.ts` with `isBrowserSupported()` checking `navigator.mediaDevices`, `window.crypto.subtle`, `window.indexedDB`, `typeof WebSocket`
- Subtask: Call `isBrowserSupported()` in `main.tsx` before `ReactDOM.createRoot`
- Subtask: Render `<UnsupportedBrowserBanner />` when check fails — full-page blocking banner, not dismissable
- Subtask: Include browser minimum versions in the banner: Chrome 100+, Firefox 115+, Safari 16.4+, Edge 100+
- Subtask: Test detection logic manually in each supported and unsupported browser version

---

## Feature 2: Authentication [MVP]

### Task: Email/Password Registration [MVP]
- Subtask: Configure FastAPI Users with `get_register_router()` mapped to `/auth`
- Subtask: Implement `on_after_register` hook in `UserManager`: dispatch Resend email via Celery with verification token
- Subtask: Configure `get_verify_router()` to handle `POST /auth/verify` with the provided token, which sets `is_active: True`
- Subtask: FastApi Users automatically validates password via default policies and hashes via its configured backend
- Subtask: Write E2E test: sign up via `/auth/register` → token email sent → `/auth/verify` → redirect to dashboard

### Task: Email/Password Sign-In [MVP]
- Subtask: Configure FastAPI Users `get_auth_router()` mapped to `/auth`
- Subtask: Setup `CookieTransport` (HttpOnly, Secure, SameSite=Lax) and `DatabaseStrategy` backed by `sessions` collection
- Subtask: `POST /auth/login` uses FastAPI Users automatically to verify credentials and issue `access_token` cookie
- Subtask: If 2FA enabled, intercept via custom middleware/logic to require TOTP code via `/auth/2fa/verify` before granting full access (custom feature)
- Subtask: Write integration test: `/auth/login` returns cookie on success

### Task: Google OAuth [MVP]
- Subtask: Configure FastAPI Users `get_oauth_router()` mapped to `/auth/google` with Google OAuth backend
- Subtask: Add `GET /auth/google/authorize` and `GET /auth/google/callback` logic provided by the library
- Subtask: Extend library's `on_after_request` or OAuth logic to import name/avatar into custom fields in `users` collection upon first login
- Subtask: Write E2E test: OAuth flow correctly issues access cookie

### Task: Password Reset [MVP]
- Subtask: Configure FastAPI Users `get_reset_password_router()` mapped to `/auth`
- Subtask: Implement `on_after_forgot_password` hook in `UserManager`: generate reset token, dispatch Resend email
- Subtask: Route `POST /auth/forgot-password` (triggers email) and `POST /auth/reset-password` (receives token and new password)
- Subtask: In `on_after_reset_password`, invalidate all existing user sessions in the `sessions` collection
- Subtask: Write integration test: unknown email -> 200 returned, known email -> token sent, reset -> password updated

### Task: Token Refresh with Mutex [MVP]
- Subtask: Implement custom `POST /auth/refresh` route (FastAPI Users natively focuses on stateless access tokens or auto-renewal via strategy)
- Subtask: Route reads `refresh_token` custom cookie, verifies hash against `sessions` collection
- Subtask: On valid refresh: rotate token (delete old `sessions` doc, create new one), issue new `access_token` cookie
- Subtask: Implement frontend mutex in `frontend/src/lib/apiClient.ts`: `let refreshPromise: Promise<void> | null = null`, return existing promise if in-flight
- Subtask: Write unit test: 4 concurrent `apiRequest()` calls all return 401 → exactly one `fetch("/auth/refresh")` call fired

### Task: Sign Out [MVP]
- Subtask: Use FastAPI Users `POST /auth/logout` via `get_auth_router()`
- Subtask: `DatabaseStrategy` automatically marks the token as revoked in `sessions` collection
- Subtask: `CookieTransport` automatically clears the access cookie (`Max-Age=0`)
- Subtask: Return `204` or `200` as provided by the library
- Subtask: On frontend: call `useAuthStore.getState().logout()` after logout resolves, redirect to `/signin`

---

## Feature 3: Session Management [MVP]

### Task: Concurrent Session Support [MVP]
- Subtask: Ensure every sign-in creates a new `sessions` document regardless of existing active sessions
- Subtask: Store `device_info` (user_agent, IP with last octet anonymised, geo city/country from IP) in `sessions` document
- Subtask: Implement `GET /settings/sessions` — return all non-revoked, non-expired sessions for `current_user.id`
- Subtask: Mark current session with `is_current: true` by comparing session_id in JWT payload
- Subtask: Write integration test: login twice → GET /settings/sessions → 2 sessions returned, correct `is_current` flags

### Task: Remote Session Revocation [MVP]
- Subtask: Implement `DELETE /settings/sessions/{id}` — verify session belongs to `current_user`, mark `is_revoked: True`
- Subtask: Call `manager.broadcast_to_user(user_id, {type: "session.revoked", payload: {session_id}})` immediately after revocation
- Subtask: Implement frontend handler: on `session.revoked` event, if `event.payload.session_id === currentSessionId` → logout + redirect `/signin`
- Subtask: Ensure WebSocket delivery happens within 30 seconds (Redis pub/sub fan-out guarantees near-instant delivery)
- Subtask: Write E2E test: revoke session → target device WebSocket receives event → redirected to signin

### Task: Login History [MVP]
- Subtask: On every successful sign-in, write a login event to Redis sorted set `login_history:{user_id}` with score = Unix timestamp
- Subtask: Store event as JSON: `{event, user_agent, ip_anonymised, city, country, created_at}`
- Subtask: Implement `GET /settings/login-history` — `ZRANGEBYSCORE` last 90 days, cursor-paginated
- Subtask: Add TTL eviction: `ZREMRANGEBYSCORE` entries older than 90 days on every write
- Subtask: Write integration test: 3 logins → GET /settings/login-history → 3 events returned in reverse chronological order

---

## Feature 4: User Profile & Settings [MVP]

### Task: Profile Management [MVP]
- Subtask: Implement `GET /profile` — return `users` document fields: `display_name`, `email`, `avatar_url`, `timezone`, `language`, `created_at`
- Subtask: Implement `PUT /profile` — validate timezone against IANA database, validate language as BCP 47, update `users` document, invalidate `user:profile:{user_id}` Redis cache
- Subtask: Implement `POST /profile/avatar` — validate MIME type server-side (not extension), reject non-image files with `VALIDATION_ERROR` 422
- Subtask: Re-encode accepted image to WebP using `Pillow` before upload (strips EXIF metadata), upload to R2 `avatars/{user_id}.webp`
- Subtask: Implement `DELETE /profile/avatar` — delete R2 object, set `users.avatar_url = None`, `avatar_type = "default"`
- Subtask: Write unit test: MIME type validation rejects PDF, allows JPG/PNG/WebP

### Task: Account Settings [MVP]
- Subtask: Implement `PUT /settings/password` — verify `current_password` with Argon2, hash `new_password`, update `users.password_hash`, invalidate all OTHER sessions (keep current)
- Subtask: Implement `PUT /settings` — update `theme`, `timezone`, `email_notifications` toggles on `users` document
- Subtask: Implement `GET /settings/linked-accounts` — return `users.providers` array with linked_at timestamps
- Subtask: Implement `DELETE /settings/linked-accounts/{provider}` — reject if only one provider remains (`FORBIDDEN` 403), else remove from `providers` array
- Subtask: ⚠️ Change email (OTP) is listed in the MVP Roadmap Feature 4 description but its implementation subtasks live in Feature 21 (Settings Full, P2). Do NOT implement email change here. Remove "change email (OTP)" from the MVP Roadmap Feature 4 description to eliminate the contradiction — it belongs in Feature 21.
- Subtask: Write integration test: delete last provider → 403, delete second provider → 204 + providers array updated

### Task: GDPR Data Export [MVP]
- Subtask: Implement `POST /settings/export` — create a `data_export` Celery task, return `202 Accepted`
- Subtask: Celery task: collect meetings, action_items, transcripts, messages, profile into a zip archive in memory
- Subtask: ⚠️ Also include login history in the export: call `ZRANGEBYSCORE login_history:{user_id} -inf +inf` from Redis, parse each JSON entry, serialize the full list as `login_history.json` inside the zip. Login history lives only in Redis (not MongoDB) — if omitted here, it is silently excluded from user data exports, which is a GDPR gap.
- Subtask: Upload zip to R2 `exports/{user_id}/{timestamp}.zip` with 7-day object expiry
- Subtask: Send email via Resend with presigned download link (7-day expiry)
- Subtask: Write integration test: POST /settings/export → verify Celery task queued with correct user_id
- Subtask: Write unit test: data export zip contains `login_history.json` with correct entries

### Task: GDPR Account Deletion [MVP]
- Subtask: Implement `POST /settings/delete-account` — require exact string `"DELETE MY ACCOUNT"` in body, else `VALIDATION_ERROR`
- Subtask: Set `users.is_active = False`, `deletion_requested_at = now()`, `deletion_scheduled_at = now() + 30 days`
- Subtask: Implement `process_pending_deletions` Celery Beat task — query `users` where `deletion_scheduled_at <= now()`, permanently delete user + all related documents across all collections
- Subtask: On deletion: delete R2 objects (avatar, recordings, exports), purge `sessions`, `meetings`, `messages`, `action_items`, `notifications`
- Subtask: Write unit test: purge task runs → all documents for deleted user removed across all 16 collections

---

## Feature 5: Meeting Creation & Management [MVP]

### Task: Instant Meeting Creation [MVP]
- Subtask: Implement `POST /meetings` — generate slug: `slugify(title or "meeting") + "-" + uuid4()[:8]`, ensure uniqueness with DB check + retry
- Subtask: Create `meetings` document with `status: "scheduled"`, `host_user_id`, `co_host_ids: []`, `max_participants: 50`, `language: "en"`
- Subtask: Return `{meeting_id, slug, share_url, title, status, scheduled_at, max_participants}` in < 500ms p95
- Subtask: Build `share_url` as `{FRONTEND_URL}/meeting/{slug}/lobby` — available immediately, no LiveKit room created yet
- Subtask: Write unit test: 1000 slug generations → zero collisions
- Subtask: Write integration test: POST /meetings → meeting_id returned, meeting in DB with correct fields

### Task: Scheduled Meeting [MVP]
- Subtask: Accept `scheduled_at` (UTC ISO 8601) in `POST /meetings` body — validate it is in the future
- Subtask: Create linked `calendar_events` document with `meeting_id`, `start_at`, `end_at` (start + 1h default), `user_id = host`
- Subtask: Ensure meeting appears in `GET /dashboard/upcoming` (next 5 query) and `GET /calendar/events`
- Subtask: Trigger `meeting.starting_soon` notification 15 minutes before `scheduled_at` using Celery `eta`, NOT the daily Beat task — schedule at meeting creation time: `send_starting_soon_notification.apply_async(args=[meeting_id], eta=scheduled_at - timedelta(minutes=15))`. The `send_due_date_reminders` Beat task (09:00 UTC daily) is only for action item due date reminders — it cannot deliver per-meeting per-time reminders.
- Subtask: Write integration test: create scheduled meeting → appears in dashboard upcoming widget response

### Task: Meeting CRUD [MVP]
- Subtask: Implement `GET /meetings` — paginated (cursor-based), filter by `status`, return summary fields only (no recap content)
- Subtask: Implement `GET /meetings/{id}` — public fields for unauthenticated, full fields (recap_status, recording_status, participant_count) for auth
- Subtask: Implement `PUT /meetings/{id}` — enforce `host_user_id == current_user.id`, update title/scheduled_at/waiting_room_enabled/language, invalidate Redis cache
- Subtask: Implement `DELETE /meetings/{id}` — reject if `status == "in_progress"` (FORBIDDEN 403), set `status = "cancelled"`
- Subtask: Write integration test: non-host PUT → 403, non-host DELETE → 403, in-progress DELETE → 403

### Task: Max Participant Enforcement [MVP]
- Subtask: On `POST /meetings/{id}/token`: count active participants in `participants` collection where `meeting_id` matches and `left_at` is null
- Subtask: If count >= `MAX_PARTICIPANTS_PER_MEETING` (50): raise `HTTPException(403, {code: "MEETING_FULL"})`
- Subtask: Apply same check in `POST /meetings/{id}/join-guest` before creating `GuestSession`
- Subtask: When count reaches 45: broadcast `meeting.controls_changed` event with `capacity_warning: true` to all participants
- Subtask: Write integration test: mock 50 active participants → 51st token request → `MEETING_FULL` 403 returned

### Task: co_host_ids Persistence [MVP]
- Subtask: Implement `POST /meetings/{id}/co-host` with `{user_id, action: "promote"|"demote"}` — host only
- Subtask: On promote: `$push co_host_ids: user_id`, broadcast `meeting.role_changed` WebSocket event
- Subtask: On demote: `$pull co_host_ids: user_id`, broadcast `meeting.role_changed` WebSocket event
- Subtask: In token generation: call `resolve_role(meeting, user_id)` — check `host_user_id` first, then `co_host_ids`, then default `"participant"`
- Subtask: Write integration test: promote co-host → disconnect → rejoin → token generated → role is `"co-host"` (not `"participant"`)

---

## Feature 6: Pre-Meeting Lobby [MVP]

### Task: Device Setup UI [MVP]
- Subtask: Call `navigator.mediaDevices.enumerateDevices()` on lobby mount, populate camera/microphone/speaker dropdowns
- Subtask: On camera selection change: stop current video track, call `getUserMedia({video: {deviceId}})`, update preview `<video>` element `srcObject`
- Subtask: On microphone selection change: create `AudioContext` + `AnalyserNode`, animate mic level bar `<div>` width using `getByteFrequencyData()` in `requestAnimationFrame` loop
- Subtask: On speaker selection change: call `audioElement.setSinkId(deviceId)` (Chrome only), play test tone on [Test 🔊] click
- Subtask: Handle `devicechange` event to refresh dropdown when user plugs/unplugs devices
- Subtask: Show "No camera detected" and "No microphone detected" states with instructions if no devices found

### Task: Noise Cancellation + Background Blur [MVP]
- Subtask: Enable noise suppression by default via LiveKit `LocalAudioTrack` `noiseSuppression: true` constraint
- Subtask: Integrate MediaPipe Selfie Segmentation for background blur — process video frames in a `<canvas>` element, no server calls
- Subtask: Background blur toggle: ON → route camera through canvas pipeline, OFF → use raw camera stream
- Subtask: Update preview `<video>` `srcObject` to blurred canvas stream when enabled
- Subtask: Persist noise cancellation + blur preferences in `localStorage` for future lobby visits

### Task: Auth Lobby Version [MVP]
- Subtask: Fetch `GET /meetings/{id}` to display meeting title, host name, participant count waiting
- Subtask: Render join-with toggles: `[🎤 Mic ON/OFF]` and `[📷 Camera ON/OFF]` — state persists as initial in-meeting track state
- Subtask: "Join Meeting" button calls `POST /meetings/{id}/token`, receives `livekit_token`, connects to LiveKit room
- Subtask: If token response is `MEETING_LOCKED` 403 → show "This meeting is locked" state, no join button
- Subtask: If token response succeeds but waiting room enabled → convert lobby in-place to waiting state (no redirect, no page change)

### Task: Guest Lobby Version [MVP]
- Subtask: Render same device controls as auth lobby (camera, mic, speaker, noise, blur, join-with toggles)
- Subtask: Render identity section below device controls: [Sign In] button (redirect to `/signin?redirect=/meeting/{id}/lobby`) + display name input + [Join as Guest] button
- Subtask: On [Join as Guest]: call `POST /meetings/{id}/join-guest`, show guest join toast modal before entering
- Subtask: On [Sign In]: redirect to `/signin?redirect=...`, after sign-in React Router reads redirect param, returns user to lobby as auth version
- Subtask: Show validation: display name required, min 2 chars, max 50 chars, no leading/trailing spaces

### Task: Guest Display Name Deduplication [MVP]
- Subtask: In `POST /meetings/{id}/join-guest` handler: fetch all current `participants` for this meeting (where `left_at` is null)
- Subtask: Implement `resolve_guest_display_name(requested, existing_names)`: if `requested` not in existing → `"{requested} (Guest)"`, else increment counter
- Subtask: Return resolved `display_name` in join-guest response — client shows it, does not allow override
- Subtask: Write unit tests for all deduplication cases: no collision, single collision, double collision, auth user name collision
- Subtask: Ensure deduplication is case-insensitive ("Ayush" and "ayush" treated as same)

### Task: Guest Join Toast [MVP]
- Subtask: After `POST /meetings/{id}/join-guest` resolves, show modal before connecting to LiveKit
- Subtask: Toast content: "You're joining as {display_name} (Guest). You won't have access to recording, AI recap, or transcript unless you sign in."
- Subtask: Two buttons: [Got it — Join Now] (proceed to LiveKit connect) and [Sign In Instead] (redirect to signin flow)
- Subtask: Toast is blocking — cannot dismiss by clicking outside, must choose an action
- Subtask: Write E2E test: guest clicks [Join as Guest] → toast appears → [Got it] → enters meeting room

---

## Feature 7: In-Meeting Experience [MVP]

### Task: LiveKit Room Setup & Webhooks [MVP]
- Subtask: Implement `generate_livekit_token(api_key, api_secret, user_id, display_name, room_name, role)` in `backend/app/services/livekit.py` — server-side only, never called from frontend
- Subtask: Create `POST /webhooks/livekit` route — verify signature with `WebhookReceiver(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)`, return 200 immediately, dispatch to `handle_livekit_event(event)` async
- Subtask: Handle `room_started` → `meetings.update_one({slug}, {$set: {status: "in_progress", started_at: now()}})`
- Subtask: Handle `room_finished` → update `status: "completed"`, `ended_at: now()` — NO Deepgram trigger here
- Subtask: Handle `egress_ended` → set `recording_url` from `fileResults[0].downloadUrl`, set `recording_status: "available"`, dispatch `run_deepgram_transcription.delay(meeting_id, recording_url)`
- Subtask: Handle `participant_joined` / `participant_left` → upsert / update `participants` document with session_id, display_name, joined_at/left_at

### Task: Speaker View Layout [MVP]
- Subtask: Use `@livekit/components-react` `<RoomContext>`, `useTracks()`, `useParticipants()` hooks
- Subtask: Identify active speaker via `useIsSpeaking()` or `room.activeSpeakers[0]` — render their tile at 100% width + `z-index` above strip
- Subtask: Render remaining participants in horizontal bottom strip — overflow hidden, show "+N more" badge when > 4 tiles
- Subtask: Floating controls bar: position `fixed bottom-6 left-1/2 -translate-x-1/2`, `opacity-0` after 3s inactivity, restore on `mousemove` or `touchstart`
- Subtask: Chat panel: right sidebar `w-80`, toggled by chat button in controls bar, persists as `isChatOpen` in `uiStore`

### Task: Screen Share Layout [MVP]
- Subtask: Detect screen share track via `useTracks([Track.Source.ScreenShare])` — when present, switch to 70/30 layout
- Subtask: Render shared content at `w-[70%]` left panel, participant rail at `w-[30%]` right panel
- Subtask: In participant rail: sharer tile first with "Sharing screen" badge, active speaker second with green border, others below
- Subtask: Remove bottom participant strip when screen share is active — restore on `track.source === ScreenShare` becoming empty
- Subtask: Screen share button in controls bar: calls `localParticipant.setScreenShareEnabled(true/false)`, icon toggles to active state

### Task: In-Meeting Personal Controls [MVP]
- Subtask: Mic toggle: `localParticipant.setMicrophoneEnabled(!isMicEnabled)`, update mic icon in controls bar (muted = red slash)
- Subtask: Camera toggle: `localParticipant.setCameraEnabled(!isCameraEnabled)`, update camera icon (off = red slash)
- Subtask: Screen share: call `localParticipant.setScreenShareEnabled(true)`, handle `NotAllowedError` (user denied screen picker) gracefully
- Subtask: Reactions: emoji picker overlay, send reaction via LiveKit data channel `localParticipant.publishData()`, all clients render floating emoji animation
- Subtask: Leave button: if host → show "Leave" (requires assign new host) + "End for All" modal, if non-host → confirm then `room.disconnect()`

### Task: Room-Wide Locks [MVP]
- Subtask: Implement `POST /meetings/{id}/controls` — host/co-host only, update `meetings.locks` and `meetings.room_locked` fields
- Subtask: After DB update: call `manager.broadcast_to_meeting(meeting_id, {type: "meeting.controls_changed", payload: {...all lock states, is_recording}})` via Redis pub/sub
- Subtask: Frontend `meeting.controls_changed` handler: update `meetingStore` via `setRoomLocked()`, `setReactionsEnabled()`, `setRecording()` (not toggles — set from server state)
- Subtask: Enforce lock state in UI: if `microphone_locked` → disable unmute button, show tooltip "Microphone locked by host"
- Subtask: Write integration test: lock mic → all participants receive `meeting.controls_changed` with `microphone_locked: true`

### Task: Participant Management [MVP]
- Subtask: Implement `POST /meetings/{id}/remove` — host/co-host only, call LiveKit Admin API `roomClient.removeParticipant(roomName, participantIdentity)`
- Subtask: Implement mute individual: LiveKit Admin API `roomClient.mutePublishedTrack(roomName, participantIdentity, trackSid, true)`
- Subtask: Implement mute all: iterate `room.participants`, call mute for each non-host participant
- Subtask: Implement spotlight: send `PIN` data message to all participants via LiveKit data channel — clients render pinned participant at full width
- Subtask: Participants sidebar: list all participants with role badge, online indicator, host/co-host controls (mute, remove, spotlight) per row

### Task: Recording Consent Banner [MVP]
- Subtask: Frontend: listen for `meeting.controls_changed` WebSocket event, check `payload.is_recording`
- Subtask: When `is_recording: true` → render `<RecordingBanner />` component: fixed top bar, `"🔴 This meeting is being recorded"`, red background, no close button
- Subtask: When `is_recording: false` → unmount `<RecordingBanner />`
- Subtask: New joiners: on LiveKit room connect, call `GET /meetings/{id}` to get current `is_recording` state, mount banner immediately if true
- Subtask: Write E2E test: host starts recording → non-host client receives event → banner appears, has no close button

### Task: Host Departure Rules [MVP]
- Subtask: On `participant_left` webhook: if `participant.identity == meeting.host_user_id` → start 60s countdown in Redis key `host:grace:{meeting_id}` with TTL 60
- Subtask: If host reconnects within 60s (`participant_joined` with same user_id): delete grace key, broadcast `meeting.role_changed` restoring host role
- Subtask: After 60s: if `co_host_ids` is non-empty → promote first co-host, send `meeting.role_changed` + `notification.new` ("You are now managing the meeting") to co-host
- Subtask: If no co-hosts after 60s: call LiveKit Admin API `roomClient.deleteRoom(roomName)` to end meeting for all
- Subtask: Write integration test for all 3 scenarios: reconnect within 60s, co-host takeover, no co-host end

---

## Feature 8: In-Meeting Chat [MVP]

### Task: Chat Send & Receive [MVP]
- Subtask: Implement `POST /meetings/{id}/chat` — auth users identified by `access_token` cookie, guests by `session_token` in body
- Subtask: Create `chat_messages` document: `meeting_id`, `sender_id` (null for guests), `sender_session_id`, `display_name`, `content`, `is_guest`, `created_at`, `purge_at: null`
- Subtask: After save: call `manager.broadcast_to_meeting(meeting_id, {type: "meeting.chat.message", payload: {chat_id, sender_id, display_name, content, is_guest, created_at}})`
- Subtask: Frontend: WebSocket `meeting.chat.message` handler appends message to chat panel in real time, auto-scrolls to bottom
- Subtask: Write integration test: auth user + guest both POST chat → all participants receive `meeting.chat.message` event

### Task: Chat History [MVP]
- Subtask: Implement `GET /meetings/{id}/chat` — query `chat_messages` where `meeting_id` matches and `deleted: false`, sort `created_at: 1`
- Subtask: Load chat history on room join — fetch and render existing messages before LiveKit connect completes
- Subtask: Render deleted messages as `[deleted]` placeholder (soft-deleted messages included in list with `deleted: true` flag)
- Subtask: Paginate if > 200 messages (cursor-based, oldest first)
- Subtask: Write integration test: 5 messages sent → GET /meetings/{id}/chat → 5 messages returned in order

### Task: Message Deletion [MVP]
- Subtask: Implement `DELETE /meetings/{id}/chat/{chat_id}` — auth users can delete own (`sender_id == current_user.id`), host/co-host can delete any
- Subtask: Soft delete: set `deleted: true`, `deleted_at: now()`, `deleted_by: current_user.id`
- Subtask: Broadcast `meeting.chat.deleted` WebSocket event: `{meeting_id, chat_id}` to all participants
- Subtask: Frontend: on `meeting.chat.deleted`, find message in list by `chat_id`, replace content with `"[deleted]"` and grey italic style
- Subtask: Write integration test: non-host deletes other's message → 403, host deletes any message → 204 + event broadcast

### Task: Chat Purge [MVP]
- Subtask: On `room_finished` webhook: query all `chat_messages` for `meeting_id`, set `purge_at = meeting.ended_at + 24h` via `$set` bulk write
- Subtask: In `purge_expired_guest_data` Celery Beat task (02:00 UTC): also delete `chat_messages` where `purge_at <= now()`
- Subtask: Ensure `purge_at` index is present (`{ purge_at: 1 }`) for efficient sweep
- Subtask: Write unit test: purge task runs → chat_messages with past purge_at deleted, future purge_at preserved
- Subtask: Write integration test: meeting ends → chat_messages have purge_at set correctly

---

## Feature 9: Waiting Room [MVP]

### Task: Guest Waiting State [MVP]
- Subtask: In `POST /meetings/{id}/join-guest`: if `meeting.waiting_room_enabled` → create `GuestSession` with `status: "waiting"`, return `{status: "waiting", session_token, poll_url}`
- Subtask: Implement `GET /meetings/{id}/join-guest/status?session_token=...` — return `{status: "waiting"|"admitted"|"declined", knock_count, can_reknock}`
- Subtask: When `admitted`: include `livekit_token` and `livekit_url` in status response so guest can connect
- Subtask: Frontend: poll every 3 seconds, keep device controls live during wait, show spinner + "Waiting for the host to admit you..."
- Subtask: [Leave] button calls `room.disconnect()` equivalent (closes session), stops polling

### Task: Host Admit Panel [MVP]
- Subtask: On `POST /meetings/{id}/join-guest` with waiting room: broadcast `meeting.waiting_room.new` WebSocket event to all host/co-host connections: `{session_token, display_name, is_guest}`
- Subtask: Render `<WaitingRoomPanel />` as draggable card in meeting UI — also mirrored in Participants sidebar, both synced via `meetingStore.waitingRoom`
- Subtask: Per-guest row: display name + `👤` badge (unauthenticated) + [Admit] + [Decline] buttons
- Subtask: [Admit all] button appears when `waitingRoom.length >= 3` — calls `POST /meetings/{id}/admit` for each sequentially
- Subtask: Implement `POST /meetings/{id}/admit` — update GuestSession status, broadcast `meeting.waiting_room.admitted` to waiting guest's poll endpoint
- Subtask: Implement `POST /meetings/{id}/decline` — update GuestSession status, broadcast `meeting.waiting_room.declined` with `knock_count` to waiting guest

### Task: Re-knock Flow [MVP]
- Subtask: On decline: increment `participants.knock_count` for this session_id
- Subtask: Guest side: on `status: "declined"` in poll response → show [Re-knock] if `can_reknock: true` (`knock_count < 3`), else show "Contact the host directly"
- Subtask: [Re-knock]: call `POST /meetings/{id}/join-guest` again with same `session_token` — increments knock_count, re-queues in waiting room
- Subtask: After 3rd decline: `can_reknock: false`, `MAX_KNOCKS_EXCEEDED` returned on further attempts, only [Leave] visible
- Subtask: Write integration test: 3 declines → 4th attempt → `MAX_KNOCKS_EXCEEDED` 403

---

## Feature 10: Recording [MVP]

### Task: Start/Stop Recording [MVP]
- Subtask: Implement `POST /meetings/{id}/recording/start` — host/co-host only, call LiveKit Egress API to start composite recording with R2 destination `recordings/{meeting_id}.mp4`
- Subtask: Update `meetings`: `is_recording: true`, `recording_status: "processing"`, `recording_started_at: now()`
- Subtask: Broadcast `meeting.controls_changed` with `is_recording: true` — triggers consent banner on all clients
- Subtask: Implement `POST /meetings/{id}/recording/stop` — call LiveKit Egress API stop, update `is_recording: false`, broadcast `meeting.controls_changed` with `is_recording: false`
- Subtask: Write integration test: start → DB updated, `meeting.controls_changed` event broadcast with `is_recording: true`
- Subtask: Write integration test: `egress_ended` webhook fires → `recording_r2_key` and `recording_url` saved, Deepgram task queued

### Task: Recording Delivery [MVP]
- Subtask: Implement `GET /meetings/{id}/recording` — generate 1-hour presigned R2 URL using `boto3 r2_client.generate_presigned_url("get_object", ...)` — URL NOT stored in DB
- Subtask: Return `{recording_url, expires_at, duration_seconds, recording_status}` — if `recording_status != "available"` return status only (no URL)
- Subtask: Implement `DELETE /meetings/{id}/recording` — host only, call `r2_client.delete_object(Bucket, Key)`, set `recording_status: null`, `recording_r2_key: null`
- Subtask: Ensure R2 bucket policy blocks public access — all access via presigned URLs only
- Subtask: Write integration test: GET /meetings/{id}/recording → presigned URL generated, contains correct R2 key and expiry

---

## Feature 11: Guest Mid-Meeting Conversion [MVP]

### Task: Conversion Modal [MVP]
- Subtask: Render "Sign in" button in controls bar for guest participants only (identified by `is_guest: true` in meetingStore)
- Subtask: On click: open `<GuestConversionModal />` — mic and camera tracks remain published during modal (do not pause or mute)
- Subtask: Modal tabs: [Sign In] (email+password form) and [Sign Up] (name+email+password) and [Google] button
- Subtask: On auth success: call `POST /meetings/{id}/migrate-guest` with `{session_token, email, password, source: "during_meeting"}`
- Subtask: Close modal on 2 consecutive failures — guest remains in meeting unchanged, can re-open anytime

### Task: Post-Conversion State [MVP]
- Subtask: `POST /meetings/{id}/migrate-guest`: link `participants` document `user_id` to new account, update `display_name` to account name
- Subtask: Cancel `guest_sessions.purge_at` — set `purge_at: null`, `migrated_to_user_id: user.id`, `migration_completed_at: now()`
- Subtask: Broadcast `meeting.role_changed` with `{user_id, new_display_name, role: "participant"}` — all clients update name in their UI immediately
- Subtask: Set `access_token` + `refresh_token` cookies in the conversion response — guest is now fully authenticated
- Subtask: Write integration test: migrate-guest → participants doc updated, purge_at cleared, cookies set, meeting.role_changed broadcast

### Task: End-of-Meeting Migration Screen [MVP]
- Subtask: Render `<GuestEndScreen />` for guests on meeting end — show list of what they're missing (recording, recap, history)
- Subtask: [Sign In] and [Create Account] → open inline auth form, on success call `POST /meetings/{id}/migrate-guest` with `source: "end_of_meeting"`
- Subtask: [Skip] → show confirmation dialog: "This cannot be undone. You'll permanently lose access to..." with [Go Back] and [Yes, I'll skip] buttons
- Subtask: Implement `beforeunload` + `visibilitychange` tab close guard while `guestMigrationPending` is true in `uiStore`
- Subtask: Write E2E test: guest skips → warning dialog → confirms → data held 24h (purge_at = meeting.ended_at + 24h, not cleared)

---

## Feature 12: WebSocket — Real-Time Events [MVP]

### Task: Multi-Instance ConnectionManager [MVP]
- Subtask: Implement `ConnectionManager` class in `backend/app/websocket/manager.py` with `active_connections: dict[str, set[WebSocket]]`
- Subtask: Implement `connect(websocket, user_id)` — `await websocket.accept()`, add to `active_connections[user_id]`
- Subtask: Implement `broadcast_to_user(user_id, message)` — `await redis.publish(f"ws:user:{user_id}", json.dumps(message))`
- Subtask: Implement `broadcast_to_meeting(meeting_id, message)` — `await redis.publish(f"ws:meeting:{meeting_id}", json.dumps(message))`
- Subtask: Implement `redis_listener()` async function: `pubsub.psubscribe("ws:user:*", "ws:meeting:*")`, route to `_deliver_local()` on message
- Subtask: Start `redis_listener()` as `asyncio.create_task()` in FastAPI `lifespan` context manager
- Subtask: Write integration test: publish to `ws:user:{id}` Redis channel → WebSocket client on different simulated instance receives message

### Task: All WebSocket Event Types [MVP]
- Subtask: Implement and test `notification.new` — triggered by `finalize_recap`, `auto_confirm_action_items`, `send_due_date_reminders`
- Subtask: Implement `meeting.controls_changed` — triggered by `/controls`, `/recording/start|stop`, co-host promote/demote
- Subtask: Implement `meeting.waiting_room.new|admitted|declined` — triggered by `/join-guest`, `/admit`, `/decline`
- Subtask: Implement `meeting.participant_joined|left|role_changed` — triggered by LiveKit webhook handler
- Subtask: Implement `recap.status_changed` — triggered by `finalize_recap` task and each LLM subtask completion
- Subtask: Implement `action_item.assigned|status_changed` — triggered by `POST /action-items` and `PATCH /action-items/{id}/status`
- Subtask: Implement `messenger.message` — triggered by `POST /messenger/conversations/{id}/messages`
- Subtask: Implement `session.revoked` — triggered by `DELETE /settings/sessions/{id}`
- Subtask: Implement `meeting.chat.message|deleted` — triggered by chat endpoints

### Task: Keepalive + Reconnect [MVP]
- Subtask: Server: on `ping` message received → respond `pong` immediately
- Subtask: Server: track `last_ping_at` per connection — close connection if no ping received in 90 seconds
- Subtask: Frontend `useWebSocket` hook: `setInterval(ws.send({type: "ping"}), 30_000)` — clear interval on unmount
- Subtask: Frontend: on `close` event → exponential backoff reconnect: 1s, 2s, 4s, 8s, 16s, max 30s
- Subtask: Frontend `useNetworkStatus` hook: `window.addEventListener("offline"/"online")` → `uiStore.setOffline(true/false)` → `<OfflineBanner />` mounts/unmounts

---

## Feature 13: Live Captions [MVP]

### Task: Deepgram Live Captions Integration [MVP]
- Subtask: Configure LiveKit room with Deepgram transcription plugin via LiveKit Cloud dashboard (no additional FastAPI code needed)
- Subtask: In `@livekit/components-react` room setup: pass `transcriptionEnabled: true` when `isCaptionsEnabled` is true in `uiStore`
- Subtask: Render `<CaptionsOverlay />` component at bottom of video area — displays current transcript segment text + speaker name
- Subtask: CC button in controls bar: calls `uiStore.toggleCaptions()` — only affects local user, no server call, no room-wide event
- Subtask: Auto-hide captions overlay after 3 seconds of silence (no new transcript segments received)
- Subtask: Write E2E test: CC enabled → speak → caption text appears overlaid on video for that user only

---

## Feature 14: Post-Meeting Transcription [MVP]

### Task: Deepgram Post-Processing Job [MVP]
- Subtask: Implement `run_deepgram_transcription(meeting_id, recording_url)` Celery task in `backend/app/tasks/ai_pipeline.py`
- Subtask: Fetch `meeting.language` from DB — pass to `PrerecordedOptions(model="nova-2", language=meeting.language, diarize=True, punctuate=True, utterances=True, smart_format=True)`
- Subtask: Call `DeepgramClient.listen.asyncprerecorded.v("1").transcribe_url({url: recording_url}, options)`
- Subtask: On success: save raw Deepgram JSON to `transcripts` collection, set `meetings.transcript_status = "available"`, trigger `run_llm_pipeline.delay(meeting_id)`
- Subtask: Retry logic: 3 attempts, backoff [0, 30, 120] seconds, on all fail set `transcript_status: "failed"`, send `recap.failed` notification
- Subtask: Write unit test: verify `run_deepgram_transcription` triggered by `egress_ended` webhook, NOT by `room_finished`

### Task: Speaker → Participant Matching [MVP]
- Subtask: After Deepgram returns: build `speaker_map` by cross-referencing segment timestamps with LiveKit `participant_joined` / `track_published` event timestamps from `participants` collection
- Subtask: For each Deepgram "Speaker N" label: find participant whose speaking window overlaps most closely → assign `user_id` and `display_name`
- Subtask: Handle guest-to-account conversion: for segments before conversion timestamp → use `display_name` (e.g. "Priya (Guest)"), after → use account name ("Priya Sharma")
- Subtask: Unmatched speakers → labeled "Unknown Speaker" (never null or empty)
- Subtask: Store resolved `segments` array in `transcripts` collection alongside raw Deepgram output
- Subtask: Write unit tests: exact match, partial overlap, guest conversion re-labeling, unmatched speaker fallback

---

## Feature 15: AI Recap Pipeline [MVP]

### Task: LLM Pipeline — Parallel Chord [MVP]
- Subtask: Implement `run_llm_pipeline(meeting_id)` Celery task — fetch raw transcript from `transcripts` collection
- Subtask: Build Celery chord: `chord([generate_summary.s(...), generate_ai_transcript.s(...), generate_key_decisions.s(...), generate_action_items.s(...)], finalize_recap.s(meeting_id)).delay()`
- Subtask: Implement `finalize_recap(results, meeting_id)` callback — mark `recaps.status = "ready"`, call `notify_host_recap_ready(meeting_id)`, push `recap.status_changed` WebSocket event
- Subtask: Schedule `auto_confirm_action_items.apply_async(args=[meeting_id], countdown=7200)` from within `finalize_recap`
- Subtask: Write unit test: mock all 4 chord tasks → verify `finalize_recap` called exactly once after all complete, recap.status set to "ready"

### Task: AI Provider Adapter [MVP]
- Subtask: Implement `LLMAdapter` class in `backend/app/services/llm.py` with `async def complete(system, user, max_tokens)` method
- Subtask: Route to `_openai()` if `settings.AI_PROVIDER == "openai"` → `AsyncOpenAI`, model `"gpt-4o"`
- Subtask: Route to `_anthropic()` if `settings.AI_PROVIDER == "anthropic"` → `AsyncAnthropic`, model `"claude-sonnet-4-6"`
- Subtask: Load prompts from `backend/prompts/{summary,ai_transcript,key_decisions,action_items}_v1.txt` — not hardcoded in Python
- Subtask: Write unit test: set `AI_PROVIDER=openai` → `_openai()` called, set `AI_PROVIDER=anthropic` → `_anthropic()` called

### Task: Action Item Extraction [MVP]
- Subtask: Implement `generate_action_items(meeting_id, transcript)` Celery task — call `LLMAdapter.complete()` with action items prompt + full transcript text
- Subtask: Parse LLM JSON response into list of `AIGeneratedActionItem` dicts — strip markdown code fences before `json.loads()`
- Subtask: Implement `resolve_due_date(raw_phrase, meeting_date)` for all 7 cases: "by Friday", "end of week", "in N days", "before next meeting", "ASAP", vague, none
- Subtask: Create `action_items` documents for each extracted item — `status: "pending"`, `auto_confirmed: false`, `host_edited: false`
- Subtask: Write unit tests for all 7 due-date phrase resolution cases

### Task: Pipeline Failure States [MVP]
- Subtask: Wrap `run_deepgram_transcription` in `try/except` with retry backoff [0, 30, 120] seconds — on all retries exhausted: `meetings.transcript_status = "failed"`, dispatch `recap.failed` notification
- Subtask: Wrap `run_llm_pipeline` in `try/except` with retry backoff [0, 60, 180] seconds — on all retries exhausted: `recaps.status = "failed"`, `failed_reason = str(exc)`, dispatch notification
- Subtask: Implement `POST /meetings/{id}/recap/retry` — accept `{stage: "deepgram"|"llm"}`, re-dispatch appropriate Celery task, reset status to `"processing"`
- Subtask: Frontend: show failure state in meeting history recap card with [Retry] button, call retry endpoint on click
- Subtask: Write integration test: force Deepgram to fail 3 times → verify `transcript_status: "failed"` and notification created

---

## Feature 16: Action Items [MVP]

### Task: Host Confirmation UI [MVP]
- Subtask: On `recap.status_changed` WebSocket event with `status: "ready"` → fetch `GET /action-items/meetings/{id}` → render confirmation screen
- Subtask: Show countdown timer: `auto_confirm_at - now()` updating every second, format as `H:MM:SS`
- Subtask: Per-item row: task text, assigned name, due date, priority badge, AI confidence %, [Edit] and [Remove] buttons
- Subtask: [Confirm All]: call `PATCH /action-items/{id}/status` for each with `status: "pending"` → mark `auto_confirmed: false`, host confirmed
- Subtask: [+ Add item manually]: inline form to `POST /action-items` with `meeting_id`, task, assignee, priority, due date

### Task: Action Item CRUD [MVP]
- Subtask: Implement `POST /action-items` — any auth participant, validate `meeting_id` exists and user was a participant
- Subtask: Implement `PUT /action-items/{id}` — enforce edit rights matrix: host can edit all, co-host can edit all, assigned user own only, others → 403
- Subtask: Implement `DELETE /action-items/{id}` — host only, hard delete
- Subtask: Implement `PATCH /action-items/{id}/status` — any auth participant can update status of items assigned to them, broadcast `action_item.status_changed` WebSocket event
- Subtask: On `status: "done"` → set `completed_at: now()`
- Subtask: Write integration test: non-host deletes → 403, non-host updates own status → 200, non-host updates other's status → 403

---

## Feature 17: Notification System [MVP]

### Task: 9 Notification Types [MVP]
- Subtask: Create `create_notification(user_id, type, title, body, link)` helper in `backend/app/services/notifications.py`
- Subtask: Wire `recap.ready` and `recap.failed` → called from `finalize_recap` and pipeline failure handlers
- Subtask: Wire `recording.ready` → called from `egress_ended` webhook handler after recording_url set
- Subtask: Wire `action_item.assigned` → called from `POST /action-items` when `assigned_to` is set
- Subtask: Wire `action_item.auto_confirmed` → called from `auto_confirm_action_items` task
- Subtask: Wire `meeting.starting_soon` → called from `send_due_date_reminders` Beat task (15min before scheduled_at)
- Subtask: Wire `gcal.sync_failed` → called from `renew_expiring_channels` on failure
- Subtask: After creating notification document: call `manager.broadcast_to_user(user_id, {type: "notification.new", payload: {...}})` via Redis pub/sub

### Task: In-App Notification Bell [MVP]
- Subtask: Implement `GET /notifications` — return 20 most recent for `current_user`, sorted `created_at: -1`, include `unread_count`
- Subtask: Implement `PATCH /notifications/{id}/read` — set `read: true`, `read_at: now()`
- Subtask: Implement `POST /notifications/read-all` — bulk `updateMany({user_id, read: false}, {$set: {read: true}})`
- Subtask: Frontend: bell icon in header with `unreadCount` badge from `notificationStore`, dropdown on click showing 20 items
- Subtask: On `notification.new` WebSocket event: call `notificationStore.addNotification(n)` → badge increments automatically
- Subtask: Click notification → navigate to `notification.link` via React Router, mark as read

### Task: Email Notifications [MVP]
- Subtask: Implement `send_email(to, subject, html)` Celery task using `resend.Emails.send()`
- Subtask: Before dispatching: check `users.email_notifications[notification_type]` — if False, skip email (still create in-app notification)
- Subtask: Create HTML email templates for each of the 6 emailed types in `backend/app/templates/emails/`
- Subtask: Test Resend integration: dispatch `send_email` task in test env → verify API called with correct `from: "noreply@meetio.app"`
- Subtask: Write integration test: user has `meeting_recap_ready: false` → recap ready → in-app notification created, email NOT dispatched

---

## Feature 18: End-of-Meeting Screens [MVP]

### Task: Auth End Screen [MVP]
- Subtask: Render `<AuthEndScreen />` when LiveKit `room.state === "disconnected"` and `meeting.status === "completed"` for auth user
- Subtask: Show meeting title, formatted duration (52 min), date + time, participant count
- Subtask: Star rating component (1–5 stars, click to set) + tag chip multi-select ("Great discussion", "Too long", "Bad audio", etc.)
- Subtask: [Submit feedback] calls `POST /meetings/{id}/feedback` with `{rating, tags}` — response 200 regardless
- Subtask: AI Summary section: if `recap_status === "ready"` → render summary, else render shimmer placeholder + "We'll email you when it's ready"
- Subtask: Host only: show [Schedule follow-up meeting] button → opens scheduling modal with pre-filled title "Follow-up: {original title}"

### Task: Guest End Screen [MVP]
- Subtask: Render `<GuestEndScreen />` for guests — show what they're missing (recording, AI recap, transcript, meeting history)
- Subtask: [Sign In] and [Create Account] → inline auth form in the same page, on success call `POST /meetings/{id}/migrate-guest`
- Subtask: [Skip — I don't need these] → show `<SkipConfirmDialog />`: list what will be lost + "This cannot be undone" + [Go Back] + [Yes, I'll skip]
- Subtask: On [Yes, I'll skip]: set `guestMigrationPending = false` in uiStore, allow navigation
- Subtask: Tab close guard: `window.addEventListener("beforeunload", e => { if (guestMigrationPending) { e.preventDefault(); e.returnValue = ""; } })`

---

## Feature 19: Meeting History & Post-Meeting Views [MVP]

### Task: Meeting History Page [MVP]
- Subtask: Implement `GET /meetings?status=completed&limit=20&cursor=...` — cursor-based pagination on `created_at` descending
- Subtask: Each item: `title`, `ended_at`, `duration_seconds`, `participant_count`, `recap_status`, `recording_status`
- Subtask: Frontend meeting card: click → navigate to `/meetings/{id}/recap` (or `/recording` if recap not ready)
- Subtask: Filter controls: All / Hosted / Participated, date range picker
- Subtask: Write integration test: create 25 completed meetings → GET /meetings limit=20 → 20 returned, next_cursor set

### Task: Recording Player [MVP]
- Subtask: On `GET /meetings/{id}/recording` → receive presigned URL → set as `<video>` element `src`
- Subtask: Custom video controls: play/pause, seek bar (click to seek), speed selector (0.5x/1x/1.5x/2x), volume slider, fullscreen button
- Subtask: Transcript sync: click any transcript segment → call `videoRef.currentTime = segment.start`
- Subtask: Playback sync: `video.ontimeupdate` → find current segment where `segment.start <= currentTime < segment.end` → highlight that row in transcript panel
- Subtask: Refresh presigned URL before expiry: if URL age > 50 minutes, re-fetch `GET /meetings/{id}/recording` silently

### Task: Raw Transcript Viewer [MVP]
- Subtask: Implement `GET /meetings/{id}/transcript?format=json|txt|srt|pdf` — `json` returns structured segments, others return file download
- Subtask: Frontend: render segment list with `[HH:MM:SS] SpeakerName: text` format, search input filters + highlights matches
- Subtask: Export buttons: [TXT] [PDF] [JSON] [SRT] → call endpoint with appropriate `format` param, trigger browser download
- Subtask: Searchable: `useMemo` to filter segments by search term, highlight matching text with `<mark>` tags
- Subtask: Write integration test: all 4 format responses return correct Content-Type headers and non-empty bodies

### Task: AI Recap Page [MVP]
- Subtask: Render 4 independent sections: Summary, Key Decisions, AI Transcript, Action Items — each has its own loading/ready/failed state
- Subtask: Each section polls `GET /meetings/{id}/recap` until its `*_status === "ready"` — use WebSocket `recap.status_changed` as primary trigger, poll as fallback
- Subtask: Key Decisions section: each decision card shows decision text + supporting quote + transcript timestamp link (click → sync recording player)
- Subtask: Action Items section: read-only list with status badges — link to full action items management page
- Subtask: Host only: [Delete Recap] button in page header → confirm dialog → `DELETE /meetings/{id}/recap` → redirect to meeting history

---

## Feature 20: Dashboard [MVP]

### Task: Action Cards [MVP]
- Subtask: [Start Instant Meeting]: call `POST /meetings`, on success navigate to `/meeting/{id}/lobby` as host
- Subtask: [Join via Link]: text input for meeting URL or meeting ID, parse slug, navigate to `/meeting/{slug}/lobby`
- Subtask: [Schedule Meeting]: open `<ScheduleMeetingModal />` with title, date/time picker, waiting room toggle → call `POST /meetings` with `scheduled_at`
- Subtask: Show loading spinner on Start button while `POST /meetings` in flight (debounce — one click only)
- Subtask: Write E2E test: click Start → POST /meetings called → navigated to lobby

### Task: Dashboard Widgets [MVP]
- Subtask: On dashboard mount: concurrently fetch all 4 endpoints — `GET /dashboard/recaps`, `/action-items`, `/stats`, `/upcoming`
- Subtask: Render recaps widget: 5 cards with meeting title, date, duration, recap status chip (processing/ready/failed)
- Subtask: Render action items widget: 10 rows sorted by due date, priority badge, status dropdown per item
- Subtask: Render stats widget: "This week" and "This month" meeting count + total hours cards
- Subtask: Render upcoming widget: next 5 meetings with countdown ("Starts in 2h"), [Join] button per meeting
- Subtask: WebSocket `recap.status_changed` and `notification.new` handlers → invalidate relevant cached data and re-fetch affected widget

---

## Feature 21: Settings (Full) [MVP]

### Task: All Settings Sections [MVP]
- Subtask: Account section: display name field (PUT /profile), email change (POST /auth/otp/send → verify → update), change password (PUT /settings/password), 2FA toggle (POST /settings/2fa)
- Subtask: Linked accounts section: list providers, [Unlink] per provider (DELETE /settings/linked-accounts/{provider}), disable unlink if last provider
- Subtask: Notifications section: toggle per notification type → PUT /settings with updated `email_notifications` object
- Subtask: Privacy section: [Download my data] (POST /settings/export) + [Delete account] (POST /settings/delete-account with confirmation input)
- Subtask: Sessions section: list all sessions (GET /settings/sessions), [Revoke] per non-current session (DELETE /settings/sessions/{id})
- Subtask: Login History section: scrollable list (GET /settings/login-history), device + location + timestamp per row
- Subtask: Write E2E test covering: change display name → save → profile updated, toggle notification → save → preference reflected

---

## Feature 22: Messenger (E2E Encrypted) [Later]

### Task: Key Generation & Storage [Later]
- Subtask: On first Messenger open: call `generateIdentityKeypair()` using `nacl.box.keyPair()` from tweetnacl
- Subtask: Call `storePrivateKey(privateKeyBase64)` — import as non-extractable X25519 `CryptoKey` via `crypto.subtle.importKey("raw", ..., {name: "X25519"}, false, ["deriveKey"])` → store in IndexedDB
- Subtask: Register public key: `POST /messenger/keys` with `{public_key: encodeBase64(keypair.publicKey)}`
- Subtask: On subsequent Messenger opens: call `loadPrivateKey()` from IndexedDB — if null (new device) → prompt backup restore flow
- Subtask: Write unit test: `storePrivateKey()` → `loadPrivateKey()` returns `CryptoKey` instance, `key.extractable === false`

### Task: Key Backup & Restore [Later]
- Subtask: Show backup passphrase prompt on first key generation — required before dismissal, explains "Lost passphrase = lost message history"
- Subtask: Implement `backupPrivateKey(privateKeyBase64, password)`: derive AES-GCM key from password via PBKDF2 (310k iter, SHA-256), encrypt private key, POST `{salt, iv, ciphertext}` to `/messenger/keys/backup`
- Subtask: Implement `restorePrivateKey(password)`: GET `/messenger/keys/backup`, decrypt locally with password, return base64 or null (wrong password)
- Subtask: On new device with existing account: show restore form, call `restorePrivateKey()`, on null → "Incorrect passphrase" error
- Subtask: Write unit test: backup → restore with correct password → matches original, restore with wrong password → null

### Task: 1:1 DMs [Later]
- Subtask: Fetch recipient public key via `GET /messenger/keys/public/{user_id}` before creating conversation
- Subtask: Generate conversation key, encrypt separately for sender and recipient, create conversation via `POST /messenger/conversations` with `{type: "dm", member_ids, encrypted_keys}`
- Subtask: Implement `encryptMessage(plaintext, recipientPublicKey, senderPrivateKey)` using `nacl.box()` — returns `{ciphertext, nonce}` base64
- Subtask: Send message via `POST /conversations/{id}/messages` with `{ciphertext, nonce, type: "text"}`
- Subtask: On `messenger.message` WebSocket event: call `decryptMessage(ciphertext, nonce, senderPublicKey, myPrivateKey)` — render plaintext, never store it

### Task: Group Chat [Later]
- Subtask: Create group conversation: `POST /messenger/conversations` with `{type: "group", name, member_ids: [...], encrypted_keys: {user_id: encryptedKey, ...}}`
- Subtask: On member removal: generate new group key, encrypt for each remaining member, update `conversations.encrypted_keys` — removed member cannot decrypt future messages
- Subtask: Implement @mention: scan message text for `@displayName`, highlight in UI, trigger `notification.new` for mentioned user
- Subtask: Group admin controls: rename group, add members, remove members (triggers key rotation) — admin = conversation creator
- Subtask: Write unit test: remove member → new key generated → old member's copy deleted from `encrypted_keys`

### Task: File Attachments & Client-Side Search [Later]
- Subtask: Before upload: encrypt file bytes with conversation key (AES-GCM), upload encrypted blob to R2 `messenger/conv_{id}/msg_{id}.ext`
- Subtask: Store attachment metadata in message: `{r2_key, filename, size_bytes, mime_type}` (encrypted ciphertext, not plaintext filename)
- Subtask: On download: fetch from R2 presigned URL, decrypt client-side, trigger browser download with original filename
- Subtask: Enforce size limits: images 10MB, videos 100MB, docs 25MB — validate before encryption + upload
- Subtask: Client-side search: decrypt all messages in conversation into memory, filter by search term using `Array.filter()`, highlight matches — no search term sent to server

---

## Feature 23: Calendar [Later]

### Task: Calendar Views & Event Management [Later]
- Subtask: Implement `GET /calendar/events?start=&end=` — query `calendar_events` where `user_id` matches and `start_at >= start AND end_at <= end`
- Subtask: Frontend: render Day/Week/Month views using a calendar grid component, each event clickable → event detail popover
- Subtask: Conflict detection: on `POST /calendar/events` check overlapping events via `$and [{start_at: {$lt: new_end}}, {end_at: {$gt: new_start}}]` query, set `has_conflict: true`
- Subtask: Show conflict warning in UI with conflicting event details + [Schedule anyway] option
- Subtask: Implement `PUT /calendar/events/{id}` and `DELETE /calendar/events/{id}` — if `meeting_id` linked, cancel meeting on delete

### Task: Google Calendar Two-Way Sync [Later]
- Subtask: Add Google Calendar scopes to `GET /auth/google` when `intent=calendar`, store access/refresh tokens in `gcal_tokens` collection
- Subtask: Implement `POST /calendar/sync/google` — full sync: fetch all Google Calendar events in next 90 days, upsert into `calendar_events`, link by `gcal_event_id`
- Subtask: Set up push notification channel via Google Calendar API `watch()` call, store `channel_id`, `channel_resource_id`, `channel_expiry` in `gcal_tokens`
- Subtask: Implement `POST /webhooks/google-calendar` — verify `X-Goog-Channel-Token`, return 200 immediately, dispatch `sync_google_calendar.delay(user_id)` Celery task
- Subtask: Implement `renew_expiring_channels` Beat task: query `gcal_tokens` where `channel_expiry <= now() + 48h`, call Google `watch()` to renew each, update `channel_expiry`
- Subtask: Failed sync events → write to `dead_letter_events` collection, `process_dead_letter_queue` Beat task retries every 30min

---

## Feature 24: Offline & Degraded Mode [Later]

### Task: Mid-Meeting Reconnect [Later]
- Subtask: Listen for LiveKit `room.on(RoomEvent.Disconnected)` — show "🔄 Reconnecting..." banner immediately
- Subtask: LiveKit auto-reconnect runs for up to 30 seconds — no action needed from user during this window
- Subtask: If `RoomEvent.Reconnected` fires → dismiss banner, meeting continues with no data loss
- Subtask: After 30 seconds with no reconnect → change banner to "❌ Connection lost" with [Rejoin] and [Leave] buttons
- Subtask: [Rejoin]: re-fetch `POST /meetings/{id}/token`, reconnect to LiveKit room (re-enters as participant, rejoins same session)

### Task: Offline Banner [Later]
- Subtask: `useNetworkStatus` hook: `window.addEventListener("offline")` → `uiStore.setOffline(true)`, `"online"` → `setOffline(false)`
- Subtask: `<OfflineBanner />`: `fixed top-0 inset-x-0 z-50`, yellow background, "⚠ No internet connection — some features unavailable"
- Subtask: Disable Start Meeting, Schedule Meeting, Send Message buttons when `isOffline === true`, show tooltip "You're offline"
- Subtask: Allow read-only actions from browser cache (React Query / SWR cached responses) — meeting history, recaps remain viewable
- Subtask: Auto-dismiss banner when `online` event fires — no user action needed

---

## Feature 25: GDPR & Data Lifecycle [Later]

### Task: Automated Purge Jobs [Later]
- Subtask: `purge_expired_guest_data` (02:00 UTC): delete `guest_sessions` and `chat_messages` where `purge_at <= now()`
- Subtask: `process_pending_deletions` (02:30 UTC): delete `users` + all related documents where `deletion_scheduled_at <= now()`
- Subtask: `expire_old_recordings` (03:00 UTC): delete R2 objects + clear `recording_r2_key` for meetings where `ended_at <= now() - 1 year`
- Subtask: MongoDB TTL indexes handle notification expiry (90 days) and dead-letter event cleanup (7 days after resolved) — no Celery task needed
- Subtask: Write unit test for each purge task: insert expired documents, run task, verify deleted; insert non-expired, run task, verify preserved

---

## Feature 26: Observability [Later]

### Task: Sentry + Structured Logging [Later]
- Subtask: `sentry_sdk.init()` in `backend/app/main.py` with `FastApiIntegration()`, `CeleryIntegration()`, `send_default_pii=False`, `traces_sample_rate=0.1`
- Subtask: `Sentry.init()` in `frontend/src/main.tsx` with `sendDefaultPii: false`, React error boundary via `Sentry.withErrorBoundary`
- Subtask: Replace all `print()` / `logging.info()` calls with `structlog.get_logger().info("event.name", key=value)` — never log passwords, tokens, OTP codes, ciphertext
- Subtask: Implement global FastAPI exception handler: log with structlog, capture with `sentry_sdk.capture_exception(exc)`, return `INTERNAL_ERROR` 500 envelope
- Subtask: Verify PII scrubbing: sign in, trigger error → check Sentry event has no email or password fields

### Task: BetterStack Uptime Monitoring [Later]
- Subtask: Create BetterStack monitor for `GET /health` — 3-minute check interval, alert on `503` response
- Subtask: Create BetterStack monitor for frontend URL — check for 200 response on root path
- Subtask: Set up MongoDB Atlas alert: storage > 400MB → email notification (Atlas Alerts UI)
- Subtask: Set up Upstash Redis usage alert: commands/day > 8,000 → review and upgrade plan before hitting 10,000 limit
- Subtask: Document all monitoring URLs and alert contacts in `docs/operations.md`

---

_Source: meetio-feature-breakdown-docs.md_
_Last Updated: April 30, 2026_
