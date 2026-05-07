# MVP Roadmap: MeetIO

**Source:** PRD v2.0, TRD v2.0, DB Schema v1, API Spec v1.0
**Date:** April 30, 2026
**Project:** MeetIO — Video conferencing for students and small teams
**Platform:** Web only (v1)
**Developer:** Solo

---

## Core MVP (Priority 1)
> If only these features exist, the app is still useful. A user can create a meeting, join it, and collaborate.

### Feature 1: Infrastructure Setup
- Description: MongoDB Atlas + migrate-mongo, Redis (Upstash), Celery + Celery Beat, Railway + Cloudflare Pages deployment pipeline, GitHub Actions CI/CD, environment variables, health check endpoint.
- Status: [ ] Not started

### Feature 2: Authentication
- Description: Email/password registration with OTP verification, Google OAuth, JWT via HttpOnly cookies (access 4h, refresh 15d), password reset, provider linking, TOTP 2FA setup and verification.
- Status: [ ] Not started

### Feature 3: Session Management
- Description: Concurrent sessions allowed, session listing, remote session revocation via WebSocket, token refresh mutex (concurrent 401 handling), all-device invalidation on password change.
- Status: [ ] Not started

### Feature 4: User Profile & Settings (Core)
- Description: Display name, avatar upload (re-encoded to WebP), timezone, language preference, change email (OTP), change password, linked accounts view/unlink.
- Status: [ ] Not started

### Feature 5: Meeting Creation & Management
- Description: Instant meeting creation (< 10s, shareable slug link), scheduled meeting creation, meeting CRUD (update title, cancel), max 50 participants enforced server-side, `co_host_ids` persistence for role restoration on reconnect.
- Status: [ ] Not started

### Feature 6: Pre-Meeting Lobby
- Description: Camera/microphone/speaker device picker, live camera preview, mic level bar, speaker test, noise cancellation toggle, background blur toggle, join-with mic/camera state. Auth and guest versions. Sign-in redirect flow with `?redirect=` param.
- Status: [ ] Not started

### Feature 7: Guest Join Flow
- Description: Display name entry, server-side deduplication (Guest / Guest 2), guest join toast, session token issuance, `POST /meetings/{id}/join-guest`, polling status endpoint, max 5 migration attempts rate limit.
- Status: [ ] Not started

### Feature 8: Waiting Room
- Description: Host-side admit panel (draggable card + participants sidebar), per-guest admit/decline, re-knock flow (max 3), `Admit all` button (3+ waiting), guest waiting state with device controls live, room lock vs waiting room distinction.
- Status: [ ] Not started

### Feature 9: In-Meeting Video (LiveKit)
- Description: Server-side LiveKit token generation, speaker view layout, bottom participant strip, screen share layout (70/30 split), floating controls bar (auto-hide 3s), chat panel (right sidebar, tabs), noise cancellation, background blur, capacity warning at 45 participants.
- Status: [ ] Not started

### Feature 10: In-Meeting Controls
- Description: Room lock/unlock, waiting room toggle (host only), reactions enable/disable, camera/mic/screen/chat locks, mute participant, mute all, remove participant, spotlight, promote/demote co-host, host departure grace period (60s, co-host takeover, meeting end).
- Status: [ ] Not started

### Feature 11: In-Meeting Chat
- Description: `chat_messages` collection, real-time via `meeting.chat.message` WebSocket event, auth users and guests both can send (session_token for guests), soft-delete own messages, host/co-host delete any, purged 24h after meeting ends.
- Status: [ ] Not started

### Feature 12: Recording
- Description: LiveKit Egress composite recording → Cloudflare R2, recording start/stop via `POST /meetings/{id}/recording/start|stop`, recording consent banner (non-dismissable, all participants, new joiners see immediately), `egress_ended` webhook triggers Deepgram (not `room_finished`), presigned URL delivery (1h expiry).
- Status: [ ] Not started

### Feature 13: Guest Mid-Meeting Conversion
- Description: "Sign in" button in controls bar, auth modal (sign in / sign up / Google, AV stays live), `POST /meetings/{id}/migrate-guest`, display name update broadcast, participant record linked to new account, guest purge cancelled.
- Status: [ ] Not started

### Feature 14: WebSocket — Real-Time App Events
- Description: Redis pub/sub `ConnectionManager` (multi-instance safe), `asyncio` listener task on startup, all event types (controls, waiting room, recap, notifications, chat, session revocation), keepalive ping/pong (30s/90s), offline banner.
- Status: [ ] Not started

---

## Secondary MVP (Priority 2)
> App works without these but is significantly less useful.

### Feature 15: Live Captions
- Description: Deepgram STT via LiveKit native integration, per-user toggle (not room-wide), captions overlay in meeting UI.
- Status: [ ] Not started

### Feature 16: Post-Meeting Transcription
- Description: Deepgram post-processing triggered by `egress_ended`, speaker → participant matching via LiveKit track timestamps, language from `meeting.language`, raw transcript stored in `transcripts` collection, guest name re-labeling at conversion point.
- Status: [ ] Not started

### Feature 17: AI Recap Pipeline
- Description: Celery chord — 4 parallel LLM tasks (summary, AI transcript, key decisions, action items) with `finalize_recap` callback, OpenAI GPT-4o default / Anthropic Claude fallback via `AI_PROVIDER` env var, versioned prompt files, failure states + retry (3 attempts), partial-ready UI.
- Status: [ ] Not started

### Feature 18: Action Items
- Description: AI extraction with confidence score, due date phrase resolution (7 cases), host confirmation UI (2hr window, countdown timer), auto-confirm Celery Beat task, edit rights matrix (host / co-host / assigned user), `PATCH /action-items/{id}/status`.
- Status: [ ] Not started

### Feature 19: Notification System
- Description: In-app WebSocket push + email via Resend, 9 notification types, notification bell (unread count), mark read / mark all read, 90-day TTL, per-type email toggle in settings.
- Status: [ ] Not started

### Feature 20: End-of-Meeting Screens
- Description: Auth end screen (feedback rating + tags, AI summary loading shimmer, host schedule follow-up), guest end screen (migration prompt with skip warning + confirmation dialog), tab close guard for pending migration.
- Status: [ ] Not started

### Feature 21: Meeting History & Post-Meeting Views
- Description: Paginated meeting history, recording player (speed 0.5x–2x, transcript sync — click line → jump to timestamp), raw transcript viewer (searchable, exportable: TXT/PDF/JSON/SRT), AI recap page (summary, decisions, AI transcript, action items), host delete recording/recap.
- Status: [ ] Not started

### Feature 22: Dashboard
- Description: Action cards (Start / Join / Schedule), last 5 recaps, top 10 open action items, stats (meeting count + time this week/month), next 5 upcoming meetings, WebSocket live updates, 5-min cache, lazy loading.
- Status: [ ] Not started

### Feature 23: Settings (Full)
- Description: Account (name, email OTP change, password, 2FA enable/disable, linked accounts), Notifications (per-type email toggles), Privacy (GDPR data export 72h, account deletion 30-day soft delete), Sessions (list + revoke), Login history (90 days).
- Status: [ ] Not started

---

## Advanced / Future (Priority 3)
> Important but not required for launch.

### Feature 24: Messenger (E2E Encrypted)
- Description: tweetnacl key generation, non-extractable CryptoKey IndexedDB storage, key backup (AES-GCM + PBKDF2, client-side before upload), 1:1 DMs, group chat, file attachments, replies, reactions, client-side search, group key rotation on member removal.
- Status: [ ] Not started

### Feature 25: Calendar
- Description: Day/Week/Month views, MeetIO meeting events, event creation/edit/delete, conflict detection, Google Calendar two-way sync (OAuth), push notification channels (48h renewal window via Celery Beat), dead-letter queue for failed sync events.
- Status: [ ] Not started

### Feature 26: Offline / Degraded Mode
- Description: Mid-meeting reconnect banner (LiveKit 30s auto-retry), offline banner (blocks start/schedule/message), read-only cache for meeting history, automatic recovery on reconnect.
- Status: [ ] Not started

### Feature 27: GDPR & Data Lifecycle
- Description: Guest data purge (24h), chat_messages purge (24h), account deletion scheduler (30-day), recording expiry (1-year), data export zip, login history 90-day TTL, notification 90-day TTL, dead-letter event 7-day cleanup, PII scrubbing in Sentry.
- Status: [ ] Not started

### Feature 28: Observability & Monitoring
- Description: Sentry (backend + frontend, PII off), BetterStack uptime monitors, structured logging (structlog), health check endpoint (`/health` with MongoDB/Redis/Celery checks), Atlas storage alert at 400MB, Cloudflare Pages analytics.
- Status: [ ] Not started

---

## Summary

| Priority | Features | Description |
|---|---|---|
| Core MVP (P1) | 14 | Infrastructure through WebSocket — app is usable end-to-end |
| Secondary MVP (P2) | 9 | Transcription, AI, post-meeting, dashboard, settings |
| Advanced / Future (P3) | 5 | Messenger, Calendar, Offline, GDPR lifecycle, Observability |
| **Total** | **28** | |

- **Estimated Timeline (solo developer):**
  - Core MVP: 6–8 weeks
  - Secondary MVP: 4–5 weeks
  - Advanced / Future: 4–6 weeks
  - **Total: 14–19 weeks**

- **Build order:** Follows PRD §21 (Phase 1 → 6)
- **First shippable milestone:** Features 1–14 complete (basic video meetings with guests, recording, chat)
- **Second shippable milestone:** Features 15–23 complete (full AI-powered meeting experience)
- **Full platform:** Features 24–28 complete

---

_Last Updated: April 30, 2026_
_Source: meetio-prd-v2.md · meetio-trd-v2.md_
