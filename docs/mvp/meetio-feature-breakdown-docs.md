# Feature Breakdown for MeetIO

**Source:** PRD v2.0, TRD v2.0, DB Schema v1, API Spec v1.0, MVP Roadmap v1.0
**Date:** April 30, 2026
**Tech Stack:** React 18 + Vite (TSX), FastAPI (Python 3.12), MongoDB Atlas, Redis (Upstash), Celery + Beat, LiveKit Cloud, Deepgram, OpenAI GPT-4o / Anthropic Claude, Cloudflare R2, Resend, PyJWT, tweetnacl, pyproject.toml + venv, Railway + Cloudflare Pages

---

## 1. Infrastructure & DevOps

- [MVP] **Project scaffolding** — `backend/` (FastAPI + `app/`) + `frontend/` (React + `src/`) monorepo, `pyproject.toml` with optional dev deps, `package.json`, `.gitignore`, `venv` setup, Dockerfile (`backend/`), `railway.toml`
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: None
  - Tests: Manual (build + deploy smoke test)
  - User Story: As a developer, I want a clean project structure so that I can build and deploy without friction.

- [MVP] **MongoDB Atlas setup** — M0 cluster, `migrate-mongo` configured, connection pooling (max 10), all 16 collections and indexes created from `meetio-db-schema.md`, `schema_version: 1` on all documents
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: New model (all 16 collections)
  - Tests: Integration (connection + index verification)
  - User Story: As a developer, I want all collections and indexes ready so that the app never hits a missing-index slow query.

- [MVP] **Redis (Upstash) setup** — `rediss://` TLS URL, Celery broker + result store, WebSocket pub/sub channels (`ws:user:*`, `ws:meeting:*`), dashboard cache keys with TTLs
  - Status: [ ] Not started
  - Effort: S
  - DB Impact: None
  - Tests: Integration (Redis ping, pub/sub round-trip)
  - User Story: As a developer, I want Redis running so that background jobs and real-time events work.

- [MVP] **Celery + Beat setup** — worker process + Beat scheduler, 6 Beat tasks registered (renewal, DLQ, purge, deletions, reminders, recording expiry), Celery configured with Redis broker + result backend
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: None
  - Tests: Integration (task dispatch + result)
  - User Story: As a developer, I want background jobs running so that async work (AI, emails, cleanup) never blocks the API.

- [MVP] **CI/CD pipeline** — GitHub Actions: `ci.yml` (backend pytest + frontend lint/type-check/test on PR), `deploy.yml` (migrate-mongo → Railway backend → Cloudflare Pages frontend), Railway secrets, required GitHub secrets documented
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: None
  - Tests: Manual (trigger deploy, verify migration runs first)
  - User Story: As a developer, I want every push to deploy safely so that I never ship broken code to production.

- [MVP] **Environment configuration** — all env vars from TRD §4.1 configured per environment (dev/staging/prod), `src/config/env.ts` for frontend, `backend/app/config.py` (pydantic Settings), `.env.example` committed
  - Status: [ ] Not started
  - Effort: S
  - DB Impact: None
  - Tests: Manual
  - User Story: As a developer, I want environment config centralised so that secrets never leak into code.

- [MVP] **Health check endpoint** — `GET /health` returns MongoDB/Redis/Celery status, `200` (ok) or `503` (degraded), connected to BetterStack monitor
  - Status: [ ] Not started
  - Effort: S
  - DB Impact: None
  - Tests: Integration
  - User Story: As a developer, I want a health endpoint so that Railway and BetterStack can detect outages automatically.

- [Future] **Browser support detection** — `isBrowserSupported()` check on app load (mediaDevices, crypto.subtle, IndexedDB, WebSocket), unsupported browser banner for Chrome < 100, Firefox < 115, Safari < 16.4, Edge < 100
  - Status: [ ] Not started
  - Effort: S
  - DB Impact: None
  - Tests: Manual (test in old browser versions)
  - User Story: As a user, I want a clear message if my browser isn't supported so that I'm not confused by broken features.

---

## 2. Authentication

- [MVP] **Email/password registration** — `POST /auth/signup`, OTP sent via Resend, `otp_sessions` in Redis (10-min TTL, max 5 attempts), account inactive until `POST /auth/otp/verify`, Argon2 password hash (passlib), `users` collection document created
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: New model (`users`, `sessions`)
  - Tests: Unit (argon2 hash), Integration (`/auth/signup`, `/auth/otp/verify`), E2E (sign up → OTP → dashboard)
  - Acceptance:
    - Given valid email + password, When POST /auth/signup, Then OTP sent and account pending
    - Given correct OTP, When POST /auth/otp/verify, Then account activated and cookies set
  - User Story: As a new user, I want to register with email so that I can access the full platform.

- [MVP] **Email/password sign-in** — `POST /auth/signin`, Argon2 verify, if TOTP enabled → return `requires_2fa: true` + `totp_session_id` (no cookies yet), if not → set HttpOnly access + refresh cookies, rate limit 10/15min per IP
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: Modify (`users`), New (`sessions`)
  - Tests: Unit (jwt encode/decode with PyJWT), Integration, E2E
  - Acceptance:
    - Given correct credentials (no 2FA), When POST /auth/signin, Then access + refresh cookies set
    - Given correct credentials (2FA enabled), When POST /auth/signin, Then requires_2fa: true returned, no cookies
  - User Story: As a returning user, I want to sign in securely so that my data is protected.

- [MVP] **Google OAuth** — `GET /auth/google` → Google consent screen, `GET /auth/google/callback` server-side token exchange, create account if new, link if email exists (OTP required), import name + avatar option, set cookies
  - Status: [ ] Not started
  - Effort: L
  - DB Impact: Modify (`users` — add google_id, providers array)
  - Tests: Integration (mock Google), E2E (full OAuth flow)
  - Acceptance:
    - Given new Google account, When OAuth callback, Then account created and logged in
    - Given existing email account, When same Google email, Then OTP sent to link accounts
  - User Story: As a user, I want to sign in with Google so that I don't need to remember a password.

- [MVP] **TOTP 2FA** — `POST /settings/2fa` (enable → return secret + QR URL, disable), `POST /auth/2fa/verify` (TOTP code → set cookies), `totp_secret` encrypted at rest in `users`, 5-attempt lockout
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: Modify (`users` — totp_enabled, totp_secret)
  - Tests: Unit (TOTP code generation/verification), Integration
  - Acceptance:
    - Given 2FA enabled, When correct TOTP code submitted, Then cookies set and user signed in
    - Given 5 wrong codes, When 6th attempt, Then OTP_LOCKED 429 returned
  - User Story: As a security-conscious user, I want 2FA so that my account is protected even if my password leaks.

- [MVP] **Password reset** — `POST /auth/password/forgot` (always 200, OTP to email if exists — no enumeration), `POST /auth/password/reset` (OTP verify + new password), all sessions invalidated on reset
  - Status: [ ] Not started
  - Effort: S
  - DB Impact: Modify (`users`, `sessions`)
  - Tests: Integration, E2E
  - Acceptance:
    - Given unknown email, When POST /auth/password/forgot, Then 200 returned (no leak)
    - Given correct OTP, When POST /auth/password/reset, Then password updated, all sessions revoked
  - User Story: As a user who forgot their password, I want to reset it securely so that I can regain access.

- [MVP] **Sign out** — `POST /auth/signout`, refresh token revoked in `sessions`, cookies cleared (Max-Age=0)
  - Status: [ ] Not started
  - Effort: S
  - DB Impact: Modify (`sessions`)
  - Tests: Integration
  - Acceptance:
    - Given authenticated user, When POST /auth/signout, Then cookies cleared and session revoked
  - User Story: As a user, I want to sign out so that my session ends on shared devices.

- [MVP] **Token refresh** — `POST /auth/refresh` (refresh token cookie only), single-use rotation, new access token issued, frontend mutex (`refreshPromise`) prevents concurrent refresh on multiple 401s
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: Modify (`sessions`)
  - Tests: Unit (mutex — concurrent 401s produce one refresh), Integration
  - Acceptance:
    - Given expired access token + valid refresh, When API call returns 401, Then exactly one refresh request fires
    - Given 4 concurrent 401s, When mutex active, Then all wait on same promise
  - ⚠️ Risk: Race condition if mutex not implemented — users spuriously signed out
  - User Story: As a user, I want my session to silently renew so that I'm never unexpectedly signed out.

---

## 3. Session Management

- [MVP] **Concurrent session support** — multiple devices allowed simultaneously, each session has its own `sessions` document, `GET /settings/sessions` returns all active sessions with device info
  - Status: [ ] Not started
  - Effort: S
  - DB Impact: New model (`sessions`)
  - Tests: Integration
  - Acceptance:
    - Given user logged in on laptop + phone, When GET /settings/sessions, Then both sessions returned
  - User Story: As a multi-device user, I want to stay logged in everywhere simultaneously.

- [MVP] **Remote session revocation** — `DELETE /settings/sessions/{id}`, refresh token invalidated, `session.revoked` WebSocket event sent within 30s, client redirects to `/signin`
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: Modify (`sessions`)
  - Tests: Integration (revoke + verify WebSocket event), E2E
  - Acceptance:
    - Given revoked session, When next API call on that device, Then 401 returned
    - Given WebSocket connected, When session revoked, Then session.revoked event received within 30s
  - User Story: As a user, I want to remotely sign out of devices I no longer use so that my account stays secure.

- [MVP] **Login history** — `GET /settings/login-history`, 90-day rolling window, stores event type + device info + IP (last octet anonymised) + timestamp, TTL index auto-expires
  - Status: [ ] Not started
  - Effort: S
  - DB Impact: None (Redis sorted set)
  - Tests: Integration
  - User Story: As a user, I want to see recent logins so that I can spot unauthorised access.

---

## 4. User Profile & Settings

- [MVP] **Profile management** — `GET/PUT /profile`, display name, timezone (IANA), language (BCP 47), `POST /profile/avatar` (multipart, JPG/PNG/WebP max 5MB, re-encoded to WebP, stored in R2 avatars bucket), `DELETE /profile/avatar`
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: Modify (`users`)
  - Tests: Unit (MIME validation, WebP re-encoding), Integration
  - Acceptance:
    - Given valid image file, When POST /profile/avatar, Then avatar stored in R2 as WebP and URL returned
    - Given invalid MIME type, When POST /profile/avatar, Then VALIDATION_ERROR 422 returned
  - User Story: As a user, I want to customise my profile so that others recognise me in meetings.

- [MVP] **Account settings** — `PUT /settings/password` (requires current password), `PUT /settings` (theme, timezone, email notification toggles), `GET/DELETE /settings/linked-accounts/{provider}` (cannot remove last provider)
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: Modify (`users`)
  - Tests: Integration
  - Acceptance:
    - Given wrong current password, When PUT /settings/password, Then INVALID_CREDENTIALS 401
    - Given only one provider linked, When DELETE /settings/linked-accounts/google, Then FORBIDDEN 403
  - User Story: As a user, I want to manage my account settings so that my experience matches my preferences.

- [MVP] **GDPR — data export** — `POST /settings/export`, zip generated within 72h (meetings, action items, transcripts, messages, profile), download link emailed (7-day expiry)
  - Status: [ ] Not started
  - Effort: L
  - DB Impact: None (read-only)
  - Tests: Integration (trigger + verify Celery task queued)
  - User Story: As a user, I want to download all my data so that I can exercise my GDPR right of access.

- [MVP] **GDPR — account deletion** — `POST /settings/delete-account` (exact string confirmation), 30-day soft delete window, `process_pending_deletions` Celery Beat task permanently purges after 30 days
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: Modify (`users` — is_active, deletion_scheduled_at)
  - Tests: Integration, Unit (purge task)
  - Acceptance:
    - Given wrong confirmation string, When POST /settings/delete-account, Then VALIDATION_ERROR
    - Given 30 days elapsed, When purge task runs, Then user + all data permanently deleted
  - User Story: As a user, I want to delete my account so that my data is completely removed.

---

## 5. Meeting Creation & Management

- [MVP] **Instant meeting creation** — `POST /meetings` (title optional, no scheduled_at), meeting slug generated (UUID-suffix), shareable link available immediately, meeting created in < 500ms p95, status: `scheduled`
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: New model (`meetings`)
  - Tests: Unit (slug generation uniqueness), Integration, E2E
  - Acceptance:
    - Given authenticated user, When POST /meetings, Then meeting_id + slug + share_url returned in < 500ms
    - Given same slug attempt, When collision, Then suffix incremented automatically
  - User Story: As a host, I want to create a meeting instantly so that I can share a link within 10 seconds.

- [MVP] **Scheduled meeting** — `POST /meetings` with `scheduled_at`, linked `calendar_events` document created, appears in dashboard upcoming + calendar, meeting status: `scheduled` until host starts
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: Modify (`meetings`), New (`calendar_events`)
  - Tests: Integration
  - Acceptance:
    - Given scheduled_at in the future, When POST /meetings, Then event appears in calendar and upcoming dashboard widget
  - User Story: As a host, I want to schedule meetings in advance so that participants can plan ahead.

- [MVP] **Meeting CRUD** — `GET /meetings` (paginated history), `GET /meetings/{id}` (public metadata + auth details), `PUT /meetings/{id}` (host only — title, time, waiting room), `DELETE /meetings/{id}` (host only — cancel scheduled)
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: Modify (`meetings`)
  - Tests: Integration (permission enforcement — non-host gets 403)
  - Acceptance:
    - Given non-host user, When PUT /meetings/{id}, Then FORBIDDEN 403
    - Given in-progress meeting, When DELETE /meetings/{id}, Then rejected (use end-meeting flow)
  - User Story: As a host, I want to manage meeting details so that participants have accurate information.

- [MVP] **Max participant enforcement** — `MAX_PARTICIPANTS_PER_MEETING=50` env var, checked on `POST /meetings/{id}/token` and `POST /meetings/{id}/join-guest`, `MEETING_FULL` 403 returned, capacity warning at 45 via `meeting.capacity_warning` WebSocket event
  - Status: [ ] Not started
  - Effort: S
  - DB Impact: Modify (`meetings` — max_participants: 50)
  - Tests: Unit (count check), Integration (51st token → 403)
  - Acceptance:
    - Given 50 active participants, When 51st requests token, Then MEETING_FULL 403 returned
    - Given 45th participant joins, Then host receives meeting.capacity_warning WebSocket event
  - User Story: As a platform operator, I want meetings capped at 50 so that service quality stays consistent.

- [MVP] **`co_host_ids` persistence** — `co_host_ids: []` on meetings document, `resolve_role()` checks on every token generation, `POST /meetings/{id}/co-host` (promote/demote), role restored on reconnect without re-promotion
  - Status: [ ] Not started
  - Effort: S
  - DB Impact: Modify (`meetings` — co_host_ids field)
  - Tests: Unit (resolve_role), Integration (disconnect + rejoin → role preserved)
  - Acceptance:
    - Given promoted co-host disconnects and rejoins, When new token issued, Then role restored to co-host
  - User Story: As a host, I want co-host roles to persist across disconnections so that meetings run smoothly.

---

## 6. Pre-Meeting Lobby

- [MVP] **Device setup UI** — camera dropdown (live preview updates on change), microphone dropdown (animated level bar), speaker dropdown + test audio button, camera preview (16:9), all via `navigator.mediaDevices.enumerateDevices()`
  - Status: [ ] Not started
  - Effort: L
  - DB Impact: None
  - Tests: E2E (device picker loads + preview updates), Manual
  - Acceptance:
    - Given browser with 2 cameras, When lobby loads, Then both appear in dropdown and preview updates on selection
    - Given microphone selected, When user speaks, Then level bar animates
  - User Story: As a participant, I want to test my devices before joining so that I'm not scrambling mid-meeting.

- [MVP] **Noise cancellation + background blur** — noise cancellation ON by default (browser suppression API), background blur OFF by default (in-browser MediaPipe — no video to server), both toggleable, immediate preview update
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: None
  - Tests: Manual
  - User Story: As a participant, I want noise cancellation and background blur so that I look and sound professional.

- [MVP] **Auth lobby version** — shows participant count waiting, join-with mic/camera toggles persist as initial in-meeting state, "Join Meeting" button, waiting room conversion (same page, no redirect)
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: None
  - Tests: E2E (join flow → enters meeting)
  - Acceptance:
    - Given waiting room enabled, When auth user clicks Join, Then lobby converts to waiting state (no redirect)
  - User Story: As an authenticated user, I want a pre-meeting check so that I join ready.

- [MVP] **Guest lobby version** — same device controls + "Sign In" button (redirect to /signin?redirect=...) + display name input + "Join as Guest" button, sign-in redirect returns to lobby as auth user
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: None
  - Tests: E2E (guest join → enters meeting), E2E (sign in redirect → auth lobby)
  - Acceptance:
    - Given guest enters display name, When Join as Guest clicked, Then POST /meetings/{id}/join-guest fired
    - Given redirect param set, When sign-in completes, Then user returned to lobby as auth
  - User Story: As a guest, I want to join without an account so that I don't have a barrier to collaborate.

- [MVP] **Guest display name deduplication** — server resolves: "Ayush" → "Ayush (Guest)", collision → "Ayush (Guest 2)", etc., returned in join-guest response, all participants see the deduplicated name
  - Status: [ ] Not started
  - Effort: S
  - DB Impact: Modify (`participants` — display_name)
  - Tests: Unit (deduplication logic — all cases)
  - Acceptance:
    - Given "Ayush" already in room as auth, When guest enters "Ayush", Then assigned "Ayush (Guest)"
    - Given "Ayush (Guest)" exists, When second guest enters "Ayush", Then assigned "Ayush (Guest 2)"
  - User Story: As a participant, I want unique names in the room so that I can tell people apart.

- [MVP] **Guest join toast** — after "Join as Guest" → modal: explains guest limitations (no recording/recap access), [Got it — Join Now] + [Sign In Instead], "Sign In Instead" → redirect flow
  - Status: [ ] Not started
  - Effort: S
  - DB Impact: None
  - Tests: E2E
  - User Story: As a guest, I want to know what I'm missing so that I can decide whether to sign in.

---

## 7. In-Meeting Experience

- [MVP] **LiveKit room setup** — server-side token generation only (`generate_livekit_token`), `room_started` / `room_finished` / `participant_joined` / `participant_left` / `egress_ended` webhooks handled, webhook signature verified (LiveKit JWT)
  - Status: [ ] Not started
  - Effort: L
  - DB Impact: Modify (`meetings`, `participants`)
  - ⚠️ Risk: Webhook ordering — `egress_ended` can lag `room_finished` by minutes (handled by routing Deepgram to `egress_ended` only)
  - Tests: Integration (webhook handler for each event type), E2E
  - Acceptance:
    - Given meeting ends, When room_finished fires, Then status updated to completed (no Deepgram yet)
    - Given recording saved, When egress_ended fires, Then recording_url set and Deepgram triggered
  - User Story: As a host, I want meetings to start and end cleanly so that all data is captured correctly.

- [MVP] **Speaker view layout** — active speaker large + centered, other participants in bottom strip (+N more badge), floating controls bar (auto-hide 3s, reappear on mouse/touch), chat panel right sidebar
  - Status: [ ] Not started
  - Effort: L
  - DB Impact: None
  - Tests: E2E (layout renders with 2+ participants), Manual
  - User Story: As a participant, I want to see the active speaker clearly so that I can follow the conversation.

- [MVP] **Screen share layout** — `getDisplayMedia` API, LiveKit screen track, 70% shared content / 30% participant rail (sharer + speaker tiles), stop button, reverts to speaker view on stop
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: None
  - Tests: E2E, Manual
  - Acceptance:
    - Given screen share started, When layout changes, Then 70/30 split with content on left
    - Given screen share stopped, When layout reverts, Then speaker view + bottom strip restored
  - User Story: As a presenter, I want to share my screen so that others can follow my work.

- [MVP] **In-meeting controls** — mic toggle (LiveKit track publish/unpublish), camera toggle, screen share, reactions (emoji overlay — Off* by default), leave button (red), end meeting for all (host only)
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: None
  - Tests: E2E (toggle → track state changes), Manual
  - User Story: As a participant, I want intuitive controls so that I can manage my audio and video easily.

- [MVP] **Room-wide locks** — `POST /meetings/{id}/controls` (camera, mic, screen, chat, reactions, room_locked), `meeting.controls_changed` WebSocket broadcast, all clients enforce lock state immediately
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: Modify (`meetings` — locks, room_locked)
  - Tests: Integration (lock → all clients receive event), E2E
  - Acceptance:
    - Given host locks microphone, When meeting.controls_changed received, Then all participants' unmute buttons disabled
  - User Story: As a host, I want to lock room controls so that I maintain order in large meetings.

- [MVP] **Participant management** — mute individual (`POST /meetings/{id}/remove` equivalent for audio), mute all, remove participant (LiveKit kick), spotlight (`PIN` in LiveKit), waiting room admit panel (draggable card + participants sidebar, synced)
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: Modify (`participants`)
  - Tests: E2E (admit/decline flow), Integration
  - User Story: As a host, I want to manage participants so that meetings run smoothly.

- [MVP] **Recording consent banner** — non-dismissable banner ("🔴 This meeting is being recorded") appears for ALL participants when `is_recording: true` in `meeting.controls_changed` event, immediate for new joiners, removed when recording stops
  - Status: [ ] Not started
  - Effort: S
  - DB Impact: None
  - Tests: E2E (start recording → banner appears on all clients including late joiners)
  - Acceptance:
    - Given recording starts, When meeting.controls_changed fires, Then all participants see non-dismissable banner
    - Given new participant joins while recording, When they enter, Then banner appears before room UI
  - ⚠️ Risk: Legal requirement — GDPR + wiretapping laws. Must not be bypassable.
  - User Story: As a participant, I want to know when I'm being recorded so that I can make an informed decision.

- [MVP] **Host departure rules** — 60s grace period on unexpected disconnect, reconnect within 60s → meeting continues unchanged, co-host present + no return → co-host notified + takes over, no co-host + no return → meeting ends for all
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: None
  - Tests: E2E (simulate disconnect scenarios), Integration
  - Acceptance:
    - Given host disconnects and reconnects in < 60s, Then meeting continues, host role preserved
    - Given host gone 60s + co-host present, Then co-host receives notification and manages meeting
  - User Story: As a co-host, I want clear rules when the host leaves so that the meeting doesn't abruptly end.

---

## 8. In-Meeting Chat

- [MVP] **Chat send/receive** — `POST /meetings/{id}/chat` (session_token for guests, cookie for auth), real-time via `meeting.chat.message` WebSocket event, `chat_messages` collection, auth + guests both supported
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: New model (`chat_messages`)
  - Tests: Integration, E2E (guest + auth both send, all see message)
  - Acceptance:
    - Given guest sends message, When POST /meetings/{id}/chat with session_token, Then all participants receive meeting.chat.message event
  - User Story: As a participant, I want to chat during meetings so that I can share links and comments without interrupting.

- [MVP] **Chat history** — `GET /meetings/{id}/chat` returns all non-deleted messages in order, available during and after meeting (until purge), loaded on join
  - Status: [ ] Not started
  - Effort: S
  - DB Impact: None (read from `chat_messages`)
  - Tests: Integration
  - User Story: As a participant who joined late, I want to see prior chat so that I have context.

- [MVP] **Message deletion** — `DELETE /meetings/{id}/chat/{chat_id}`, auth users delete own, host/co-host delete any, soft delete (`deleted: true`), `meeting.chat.deleted` WebSocket event, client shows "[deleted]"
  - Status: [ ] Not started
  - Effort: S
  - DB Impact: Modify (`chat_messages`)
  - Tests: Integration (permission matrix)
  - Acceptance:
    - Given auth participant, When DELETE own message, Then deleted: true and event broadcast
    - Given auth participant, When DELETE other's message, Then FORBIDDEN 403
  - User Story: As a participant, I want to delete my own messages so that I can correct mistakes.

- [MVP] **Chat purge** — `purge_at` set on all `chat_messages` for a meeting when `room_finished` fires (`ended_at + 24h`), `purge_expired_guest_data` Celery Beat task also purges expired chat messages
  - Status: [ ] Not started
  - Effort: S
  - DB Impact: Modify (`chat_messages` — purge_at)
  - Tests: Unit (purge task)
  - User Story: As a platform operator, I want ephemeral chat data purged so that we comply with data minimisation.

---

## 9. Waiting Room

- [MVP] **Guest waiting state** — after `POST /meetings/{id}/join-guest` returns `status: waiting`, guest polls `GET /meetings/{id}/join-guest/status` every 3s, device controls remain live while waiting, [Leave] button available
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: None
  - Tests: E2E (waiting → admitted flow)
  - Acceptance:
    - Given waiting room enabled, When guest joins, Then lobby converts to waiting state in-place (no redirect)
  - User Story: As a guest, I want to wait with my devices active so that I'm ready to join immediately.

- [MVP] **Host admit panel** — draggable card in meeting UI + Participants sidebar (synced), per-guest [Admit] / [Decline] buttons, [Admit all] when 3+ waiting, guest badge `👤` on unauthenticated, real-time via `meeting.waiting_room.new` WebSocket
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: Modify (`participants` — knock_count, last_knocked_at)
  - Tests: E2E (host admits → guest enters), Integration
  - Acceptance:
    - Given 3+ in waiting room, When host views panel, Then "Admit all" button appears
  - User Story: As a host, I want to control who enters so that unexpected guests don't disrupt the meeting.

- [MVP] **Re-knock flow** — max 3 re-knocks per session, after 3rd decline → "Contact the host directly" + only [Leave] option, each re-knock re-appears in host's admit panel, `knock_count` tracked in `participants`
  - Status: [ ] Not started
  - Effort: S
  - DB Impact: Modify (`participants`)
  - Tests: Integration (3 declines → MAX_KNOCKS_EXCEEDED)
  - Acceptance:
    - Given 3rd decline, When guest tries to re-knock, Then MAX_KNOCKS_EXCEEDED 403 returned
  - User Story: As a host, I want a knock limit so that I'm not overwhelmed by repeated requests.

---

## 10. Recording

- [MVP] **Start/stop recording** — `POST /meetings/{id}/recording/start|stop`, LiveKit Egress composite recording, R2 destination (`recordings/{meeting_id}.mp4`), `is_recording` state in `meetings`, all clients notified via `meeting.controls_changed`
  - Status: [ ] Not started
  - Effort: L
  - DB Impact: Modify (`meetings` — recording_status, recording_r2_key, recording_started_at)
  - ⚠️ Risk: LiveKit Egress configuration — R2 credentials, bucket permissions, composite layout
  - Tests: Integration (start → egress running), E2E
  - Acceptance:
    - Given recording started, When meeting.controls_changed fires, Then all clients show 🔴 banner
  - User Story: As a host, I want to record meetings so that absent participants can catch up.

- [MVP] **Recording delivery** — `GET /meetings/{id}/recording` generates 1-hour presigned R2 URL, `recording_r2_key` stored (not the URL), URL regenerated fresh on each access, host can `DELETE /meetings/{id}/recording`
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: Modify (`meetings`)
  - Tests: Integration (presigned URL valid, expires after 1h)
  - Acceptance:
    - Given recording available, When GET /meetings/{id}/recording, Then presigned URL returned (not stored)
    - Given host deletes, When GET /meetings/{id}/recording, Then NOT_FOUND 404
  - User Story: As a participant, I want to watch the recording so that I can review what was discussed.

---

## 11. Guest Mid-Meeting Conversion

- [MVP] **Conversion modal** — "Sign in" button in controls bar (guest only), auth modal (sign in / sign up / Google tabs), AV stays live while modal open, `POST /meetings/{id}/migrate-guest`, max 5 attempts
  - Status: [ ] Not started
  - Effort: L
  - DB Impact: Modify (`participants`, `guest_sessions`)
  - Tests: E2E (guest converts → name updates for all)
  - Acceptance:
    - Given guest opens modal, When mic/camera are live, Then they remain active during auth flow
    - Given successful conversion, When POST /migrate-guest, Then display name updates for all participants instantly
  - User Story: As a guest who wants meeting history, I want to convert mid-meeting so that my session is linked to my account.

- [MVP] **Post-conversion state** — LiveKit participant metadata updated, display name broadcast via `meeting.role_changed`, `👤` badge removed, transcript re-labeled from conversion timestamp, 24h guest data purge cancelled, auth cookies set
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: Modify (`participants`, `guest_sessions`, `transcripts`)
  - Tests: Integration
  - Acceptance:
    - Given successful conversion, When all participants' views update, Then no rejoin required
  - User Story: As a newly converted user, I want my meeting experience to continue seamlessly so that I'm not disrupted.

- [MVP] **End-of-meeting migration screen** — guest sees migration prompt (recording/recap/history access), [Sign In] / [Create Account] / [Skip], skip → confirmation warning dialog ("This cannot be undone"), tab close guard while pending
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: None
  - Tests: E2E (skip → warning → confirm → data purge queued)
  - Acceptance:
    - Given guest skips, When confirmation confirmed, Then guest data held 24h then purged
    - Given tab close while pending, When beforeunload fires, Then browser warning shown
  - User Story: As a guest, I want a clear end-of-meeting prompt so that I don't accidentally lose my meeting data.

---

## 12. WebSocket — Real-Time Events

- [MVP] **Multi-instance ConnectionManager** — Redis pub/sub fan-out (`ws:user:*`, `ws:meeting:*` channels), `redis_listener` asyncio task on startup, `_deliver_local` for local connections, `broadcast_to_user` and `broadcast_to_meeting` via Redis publish
  - Status: [ ] Not started
  - Effort: L
  - DB Impact: None
  - ⚠️ Risk: Single-instance dict breaks on Railway multi-instance deploy — Redis pub/sub is the fix
  - Tests: Integration (send event → reaches user on different instance), Unit (dead socket cleanup)
  - Acceptance:
    - Given 2 FastAPI instances, When Celery sends event for user on instance 2, Then user receives it
  - User Story: As a developer, I want WebSocket events to work across multiple server instances so that users never miss notifications.

- [MVP] **All WebSocket event types** — 17 event types implemented: notification.new, meeting.status/participant/role/controls/waiting_room/chat events, recap.status_changed, action_item events, messenger.message, session.revoked, ping/pong
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: None
  - Tests: Integration (each event type triggered + received)
  - User Story: As a user, I want all live updates to arrive instantly so that the app feels responsive.

- [MVP] **Keepalive + reconnect** — client `ping` every 30s, server `pong` response, connection closed after 90s silence, client exponential backoff reconnect (1s/2s/4s/8s/max 30s), offline banner via `window.addEventListener("offline"/"online")`
  - Status: [ ] Not started
  - Effort: S
  - DB Impact: None
  - Tests: Integration (drop connection → client reconnects)
  - User Story: As a user, I want WebSocket to silently reconnect so that I never lose live updates.

---

## 13. Live Captions

- [MVP] **Deepgram live captions** — LiveKit native Deepgram integration (no additional FastAPI code), per-user toggle (personal, not room-wide), captions overlay in meeting UI (bottom of video area), CC button in controls bar
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: None
  - Tests: Manual (captions appear on speech), E2E
  - Acceptance:
    - Given user toggles CC on, When speaker talks, Then captions appear for that user only
    - Given another user has CC off, When same speech, Then they see no captions
  - User Story: As a participant with hearing difficulties, I want live captions so that I can follow the conversation.

---

## 14. Post-Meeting Transcription

- [MVP] **Deepgram post-processing job** — `run_deepgram_transcription` Celery task, triggered by `egress_ended` webhook (not `room_finished`), `language` from `meeting.language`, `nova-2` model, diarize + punctuate + utterances + smart_format
  - Status: [ ] Not started
  - Effort: L
  - DB Impact: New model (`transcripts`)
  - ⚠️ Risk: `egress_ended` can lag `room_finished` by minutes — must NOT trigger on `room_finished`
  - Tests: Unit (egress_ended routes to Deepgram, room_finished does not), Integration
  - Acceptance:
    - Given egress_ended fires with recording URL, When task runs, Then transcript stored in transcripts collection
    - Given room_finished fires, When webhook handled, Then NO Deepgram task queued
  - User Story: As a participant, I want a transcript automatically after every meeting so that I never lose what was said.

- [MVP] **Speaker → participant matching** — cross-reference Deepgram "Speaker 0/1/2" labels with LiveKit track activity timestamps, match to participant `display_name` or account name, guest mid-meeting conversion re-labeling at conversion timestamp, unmatched → "Unknown Speaker"
  - Status: [ ] Not started
  - Effort: L
  - DB Impact: Modify (`transcripts` — speaker_map)
  - Tests: Unit (matching algorithm — all edge cases)
  - Acceptance:
    - Given guest converted at 00:07:20, When transcript built, Then segments before use guest name, after use account name
  - User Story: As a reader of the transcript, I want to see real names so that I know who said what.

---

## 15. AI Recap Pipeline

- [MVP] **LLM pipeline (4 parallel tasks)** — `run_llm_pipeline` dispatches Celery chord: `generate_summary`, `generate_ai_transcript`, `generate_key_decisions`, `generate_action_items` all in parallel, `finalize_recap` callback fires when ALL 4 complete
  - Status: [ ] Not started
  - Effort: XL
  - DB Impact: New model (`recaps`)
  - ⚠️ Risk: Chord callback required — without it recap never marked ready (bug #4 from review)
  - Tests: Unit (chord fires callback after all 4), Integration (full pipeline run)
  - Acceptance:
    - Given all 4 LLM tasks complete, When finalize_recap fires, Then recap.status = "ready" and host notified
  - User Story: As a host, I want an AI summary automatically after each meeting so that I don't have to write notes.
  - Depends on: Feature 14 (Post-Meeting Transcription)

- [MVP] **AI provider adapter** — `LLMAdapter` with `complete(system, user, max_tokens)`, routes to OpenAI GPT-4o (default) or Anthropic Claude (fallback), switched by `AI_PROVIDER` env var — no code change needed, versioned prompt files in `backend/prompts/`
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: None
  - Tests: Unit (adapter routes correctly per env var)
  - User Story: As a developer, I want to swap AI providers via config so that I'm not locked in.

- [MVP] **Action item extraction** — `AIGeneratedActionItem` schema (task, assignee, priority, confidence, due_date_raw_phrase, due_date_suggested, due_date_confidence, unassignable), 7 due-date phrase cases resolved, `ai_confidence` 0–100 shown to host
  - Status: [ ] Not started
  - Effort: L
  - DB Impact: New model (`action_items`)
  - Tests: Unit (all 7 due-date phrase cases), Integration
  - Acceptance:
    - Given "by Friday" phrase, When resolved, Then due_date = next Friday from meeting date
    - Given "ASAP" phrase, When resolved, Then due_date = meeting_date + 1, priority = high
  - User Story: As a host, I want AI to extract action items automatically so that nothing falls through the cracks.

- [MVP] **Pipeline failure states** — Deepgram: 3 retries (immediate/30s/2m), LLM: 3 retries (immediate/1m/3m), on all fail: in-app notification + email, meeting history shows failure + [Retry] button, manual retry via `POST /meetings/{id}/recap/retry`
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: Modify (`recaps` — status, failed_reason, retry_count)
  - Tests: Unit (retry backoff sequence), Integration
  - Acceptance:
    - Given Deepgram fails 3 times, When all retries exhausted, Then recap.status = "failed" and notification sent
  - User Story: As a participant, I want to be notified if AI processing fails so that I can manually retry.

---

## 16. Action Items

- [MVP] **Host confirmation UI** — 2hr countdown timer shown, per-item [Edit] / [Remove], [Confirm All] / [Edit Before Confirming], [+ Add item manually], AI confidence % shown, `auto_confirm_action_items` Celery task fires after 2h if no action
  - Status: [ ] Not started
  - Effort: L
  - DB Impact: Modify (`action_items` — auto_confirmed, host_edited)
  - Tests: E2E (confirm flow), Unit (auto-confirm task timing)
  - Acceptance:
    - Given 2h pass with no host action, When auto_confirm_action_items runs, Then all items confirmed and host notified
    - Given host edits an item, When saved, Then host_edited: true and ai_confidence hidden
  - User Story: As a host, I want to review AI action items before they're shared so that I can correct mistakes.

- [MVP] **Action item CRUD** — `POST /action-items`, `PUT /action-items/{id}` (edit rights matrix enforced), `DELETE /action-items/{id}` (host only), `PATCH /action-items/{id}/status`, `GET /action-items/meetings/{id}`
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: Modify (`action_items`)
  - Tests: Integration (all permission combinations)
  - Acceptance:
    - Given non-host tries to delete, When DELETE /action-items/{id}, Then FORBIDDEN 403
    - Given assigned user updates status, When PATCH, Then status updated and WebSocket event fired
  - User Story: As an assignee, I want to update my action item status so that the team knows my progress.

---

## 17. Notification System

- [MVP] **9 notification types** — `recap.ready`, `recap.failed`, `transcript.ready`, `recording.ready`, `action_item.assigned`, `action_item.due_reminder`, `action_item.auto_confirmed`, `meeting.starting_soon`, `gcal.sync_failed` — all stored in `notifications` collection (90-day TTL)
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: New model (`notifications`)
  - Tests: Integration (each type triggered + stored)
  - User Story: As a user, I want to be notified of important events so that I never miss a recap or action item.

- [MVP] **In-app notification bell** — unread count badge, dropdown (20 most recent), click → deep link navigation, `PATCH /notifications/{id}/read`, `POST /notifications/read-all`, WebSocket `notification.new` pushes real-time
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: None (read from `notifications`)
  - Tests: E2E (notification arrives → bell updates → click navigates)
  - Acceptance:
    - Given new recap ready, When notification.new WebSocket event received, Then bell badge increments and item appears in dropdown
  - User Story: As a user, I want real-time notifications in-app so that I don't have to check my email.

- [MVP] **Email notifications** — sent via Resend for: recap.ready, recap.failed, recording.ready, action_item.assigned, action_item.auto_confirmed, gcal.sync_failed, `send_email` Celery task, per-type toggles in settings respected
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: None
  - Tests: Integration (email task dispatched), Manual (email received)
  - User Story: As a user away from the app, I want email notifications so that I'm informed even when offline.

---

## 18. End-of-Meeting Screens

- [MVP] **Auth end screen** — meeting title + duration + participant count, star rating (1-5) + tag chips, AI summary loading shimmer (recap processing), email notification promise, host-only: [Schedule follow-up], [Return to dashboard]
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: Modify (`meetings` — feedback_ratings, feedback_tags)
  - Tests: E2E
  - Acceptance:
    - Given recap processing, When end screen loads, Then shimmer shown + "We'll email you when it's ready"
  - User Story: As a participant, I want to give feedback immediately after a meeting so that the host knows how it went.

- [MVP] **Guest end screen** — migration prompt (recording/recap/history), [Sign In] / [Create Account] / [Skip], skip → warning dialog, tab close guard (`beforeunload` + `visibilitychange`), 24h soft buffer before purge
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: None
  - Tests: E2E (skip → warning → confirm)
  - Acceptance:
    - Given guest tries to close tab before deciding, When beforeunload fires, Then browser warning shown
  - User Story: As a guest, I want a clear choice at the end so that I can decide whether to keep my meeting data.

---

## 19. Meeting History & Post-Meeting Views

- [MVP] **Meeting history** — `GET /meetings` (paginated, filterable by status), meeting card (title, date, duration, participants, recap/recording status), click → meeting detail
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: None (read from `meetings`)
  - Tests: Integration, E2E
  - User Story: As a user, I want to see all past meetings so that I can access recordings and recaps.

- [MVP] **Recording player** — presigned URL loaded via `GET /meetings/{id}/recording`, play/pause/seek/speed (0.5x–2x)/volume/fullscreen, transcript sync (click line → seek to timestamp, current segment highlighted as video plays)
  - Status: [ ] Not started
  - Effort: L
  - DB Impact: None
  - Tests: E2E (transcript sync), Manual
  - Acceptance:
    - Given user clicks transcript line at 00:14:32, When video seeks, Then video jumps to 14m 32s
  - User Story: As a participant, I want transcript-synced playback so that I can quickly navigate to specific moments.

- [MVP] **Raw transcript viewer** — searchable (highlight matches), exportable (TXT/PDF/JSON/SRT via `GET /meetings/{id}/transcript?format=`), speaker labels + timestamps, host can delete recap
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: None
  - Tests: Integration (all 4 export formats), E2E
  - User Story: As a user, I want to search and export the transcript so that I can reference it in other tools.

- [MVP] **AI recap page** — summary section, key decisions (with supporting quote + timestamp), AI transcript (cleaned, formatted), action items (with status), all sections load independently as each becomes ready, `DELETE /meetings/{id}/recap` (host only)
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: None
  - Tests: E2E (partial load states), Integration
  - User Story: As a host, I want a polished AI recap so that I can share it with the team.

---

## 20. Dashboard

- [MVP] **Action cards** — Start Instant Meeting (POST /meetings → navigate to meeting), Join via Link (paste URL → navigate to lobby), Schedule Meeting (open calendar scheduling flow)
  - Status: [ ] Not started
  - Effort: S
  - DB Impact: None
  - Tests: E2E
  - User Story: As a user, I want quick actions on the dashboard so that I can start or join meetings in one click.

- [MVP] **Dashboard widgets** — `GET /dashboard/recaps` (5 recent, 5-min cache), `GET /dashboard/action-items` (10 open, sorted by due date + priority), `GET /dashboard/stats` (meeting count + minutes), `GET /dashboard/upcoming` (next 5, 2-min cache), WebSocket live updates for all
  - Status: [ ] Not started
  - Effort: L
  - DB Impact: None (read-only with Redis cache)
  - Tests: Integration (cache hit/miss), E2E
  - Acceptance:
    - Given new recap ready, When dashboard open, Then recap widget updates without page refresh via WebSocket
  - User Story: As a user, I want a live dashboard so that I see the latest meeting data at a glance.

---

## 21. Settings (Full)

- [MVP] **All settings sections** — Account, Notifications (per-type toggles), Privacy (export + delete), Sessions (list + revoke), Login History — all backed by endpoints in API spec §7
  - Status: [ ] Not started
  - Effort: L
  - DB Impact: Modify (`users`, `sessions`)
  - Tests: Integration (all endpoints), E2E
  - User Story: As a user, I want full control over my account so that I can manage security and privacy.

---

## 22. Messenger (E2E Encrypted)

- [Future] **Key generation + storage** — `generateIdentityKeypair()` (tweetnacl), `storePrivateKey()` as non-extractable `CryptoKey` in IndexedDB (not raw base64), public key registered via `POST /messenger/keys`
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: New model (`messenger_keys`)
  - ⚠️ Risk: Non-extractable CryptoKey — cannot be read back out by JS after import. XSS limited to session-only damage.
  - User Story: As a user, I want my messages to be end-to-end encrypted so that even MeetIO cannot read them.

- [Future] **Key backup + restore** — `backupPrivateKey(base64, password)`: PBKDF2 (310k iterations, SHA-256) → AES-GCM-256 encrypt → `POST /messenger/keys/backup` (salt + iv + ciphertext only), `restorePrivateKey(password)`: fetch backup → decrypt locally, wrong passphrase → null
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: Modify (`messenger_keys` — backup)
  - ⚠️ Risk: Wrong passphrase = unrecoverable. Must be communicated clearly to users.
  - User Story: As a user on a new device, I want to restore my message history so that I don't lose old conversations.

- [Future] **1:1 DMs** — `POST /messenger/conversations` (type: dm, encrypted_keys per member), `encryptMessage()` / `decryptMessage()` (tweetnacl box), `POST /conversations/{id}/messages` (ciphertext + nonce only), `messenger.message` WebSocket delivery
  - Status: [ ] Not started
  - Effort: L
  - DB Impact: New model (`conversations`, `messages`)
  - User Story: As a user, I want to DM colleagues privately so that sensitive conversations stay secure.

- [Future] **Group chat** — `POST /messenger/conversations` (type: group, name, multiple member_ids), group key rotation when member removed (new key encrypted per remaining member), @mentions, admin controls
  - Status: [ ] Not started
  - Effort: XL
  - DB Impact: Modify (`conversations`, `messages`)
  - ⚠️ Risk: Key rotation complexity — all remaining members must re-encrypt
  - User Story: As a team, I want secure group chats so that project conversations are private.

- [Future] **File attachments + client-side search** — files encrypted before upload to R2 (`messenger/conv_{id}/msg_{id}.ext`), size limits (image 10MB, video 100MB, doc 25MB), search runs on decrypted content client-side (never sent to server)
  - Status: [ ] Not started
  - Effort: XL
  - DB Impact: Modify (`messages` — attachment)
  - User Story: As a user, I want to share files securely so that documents stay private.

---

## 23. Calendar

- [Future] **Calendar views + event management** — Day/Week/Month views, `GET /calendar/events?start=&end=`, `POST/PUT/DELETE /calendar/events`, conflict detection (`has_conflict` flag), time zone display (stored UTC, rendered local)
  - Status: [ ] Not started
  - Effort: L
  - DB Impact: New model (`calendar_events`)
  - User Story: As a user, I want a calendar so that I can see all my meetings in one place.

- [Future] **Google Calendar two-way sync** — OAuth (calendar + events scopes), `POST /calendar/sync/google`, push notification channel (max 7 days), `renew_expiring_channels` Beat task (daily, 48h lookahead window), `POST /webhooks/google-calendar` (sig: X-Goog-Channel-Token), dead-letter queue for failed sync
  - Status: [ ] Not started
  - Effort: XL
  - DB Impact: New model (`gcal_tokens`)
  - ⚠️ Risk: Google push notification channel expiry — must renew within 48h window or sync silently breaks
  - User Story: As a Google Calendar user, I want two-way sync so that my schedule stays consistent.

---

## 24. Offline & Degraded Mode

- [Future] **Mid-meeting reconnect** — LiveKit auto-reconnect (30s), "🔄 Reconnecting..." banner during retry, "❌ Connection lost" + [Rejoin] / [Leave] after 30s failure, no data loss on reconnect
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: None
  - User Story: As a participant with unstable internet, I want automatic reconnection so that I don't lose my place in the meeting.

- [Future] **Offline banner** — `window.addEventListener("offline"/"online")`, top banner "⚠ No internet connection", Start/Schedule/Send blocked, read-only cache from browser works, banner auto-dismisses on reconnect
  - Status: [ ] Not started
  - Effort: S
  - DB Impact: None
  - User Story: As a user with intermittent connectivity, I want clear offline indication so that I know when actions will fail.

---

## 25. GDPR & Data Lifecycle (Automated)

- [Future] **Automated purge jobs** — 6 Celery Beat tasks: guest_sessions (24h), chat_messages (24h), account deletions (30-day), recording expiry (1-year), notification TTL (90-day via MongoDB TTL index), dead-letter event cleanup (7-day)
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: Modify (all affected collections)
  - Tests: Unit (each purge task), Integration
  - User Story: As a platform operator, I want automated data cleanup so that we stay compliant without manual work.

---

## 26. Observability

- [Future] **Sentry + structured logging** — `sentry_sdk.init()` (backend + frontend, `send_default_pii=False`), `structlog` logger (structured key=value, no PII), global FastAPI exception handler, Sentry React error boundary
  - Status: [ ] Not started
  - Effort: M
  - DB Impact: None
  - Tests: Manual (trigger error → appears in Sentry)
  - User Story: As a developer, I want error tracking so that I can fix bugs before users report them.

- [Future] **BetterStack uptime monitoring** — monitors for API health endpoint + frontend, 3-minute check interval, alert on degraded status, MongoDB Atlas storage alert at 400MB
  - Status: [ ] Not started
  - Effort: S
  - DB Impact: None
  - User Story: As a developer, I want uptime monitoring so that I'm alerted before users notice an outage.

---

## Shared Infrastructure

- **Shared: Features 5, 6, 7, 9, 10, 11, 12, 13** — all use LiveKit token generation (`generate_livekit_token`), room name = `meeting_id`, server-side only
- **Shared: Features 9, 10, 11, 12, 14, 16, 17, 18, 20** — all emit or consume WebSocket events via `ConnectionManager.broadcast_to_meeting()` or `broadcast_to_user()`
- **Shared: Features 15, 16, 17** — all post-meeting AI pipeline features depend on `egress_ended` webhook and `recording_r2_key` being set on the meeting
- **Shared: Features 2, 3, 4, 21, 22** — all use `users` and `sessions` collections; all auth-gated endpoints use `get_current_user` FastAPI dependency
- **Shared: Features 17, 18, 19** — all trigger `send_email` Celery task via Resend; all respect `users.email_notifications` settings
- **Shared: Features 25, 26** — GDPR purge jobs share the same Celery Beat schedule and run in the same worker process
- **Shared: Features 1, 14, 22, 23** — all use `pyproject.toml` deps; MongoDB migrations via `migrate-mongo` required before any schema change

---

## Summary

| Category | MVP Features | Future Features | Total |
|---|---|---|---|
| 1. Infrastructure & DevOps | 7 | 1 | 8 |
| 2. Authentication | 7 | 0 | 7 |
| 3. Session Management | 3 | 0 | 3 |
| 4. User Profile & Settings | 4 | 0 | 4 |
| 5. Meeting Creation & Management | 5 | 0 | 5 |
| 6. Pre-Meeting Lobby | 6 | 0 | 6 |
| 7. In-Meeting Experience | 8 | 0 | 8 |
| 8. In-Meeting Chat | 4 | 0 | 4 |
| 9. Waiting Room | 3 | 0 | 3 |
| 10. Recording | 2 | 0 | 2 |
| 11. Guest Conversion | 3 | 0 | 3 |
| 12. WebSocket | 3 | 0 | 3 |
| 13. Live Captions | 1 | 0 | 1 |
| 14. Post-Meeting Transcription | 2 | 0 | 2 |
| 15. AI Recap Pipeline | 4 | 0 | 4 |
| 16. Action Items | 2 | 0 | 2 |
| 17. Notification System | 3 | 0 | 3 |
| 18. End-of-Meeting Screens | 2 | 0 | 2 |
| 19. Meeting History & Post-Meeting | 4 | 0 | 4 |
| 20. Dashboard | 2 | 0 | 2 |
| 21. Settings (Full) | 1 | 0 | 1 |
| 22. Messenger | 0 | 5 | 5 |
| 23. Calendar | 0 | 2 | 2 |
| 24. Offline & Degraded Mode | 0 | 2 | 2 |
| 25. GDPR & Data Lifecycle | 0 | 1 | 1 |
| 26. Observability | 0 | 2 | 2 |
| **Total** | **76** | **13** | **89** |

**MVP Progress:** 0/76 features complete (0%)
**Overall Progress:** 0/89 features complete (0%)

---

## Related Documentation

- MVP Roadmap: `meetio-mvp-roadmap.md`
- Task breakdown: `meetio-feature-breakdown-hierarchy.md`
- PRD: `meetio-prd-v2.md`
- TRD: `meetio-trd-v2.md`
- DB Schema: `meetio-db-schema.md`
- API Spec: `meetio-api-spec.md`

_Last Updated: April 30, 2026_
