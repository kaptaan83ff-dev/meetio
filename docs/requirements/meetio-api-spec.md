# MeetIO — API Specification
> **Version:** 1.0
> **Base URL:** `https://api.meetio.app`
> **Versioning:** URL-based (`/v1/...`)
> **Auth:** Library-managed (FastAPI Users). HttpOnly cookies (`fastapiusersauth` for primary auth, `refresh_token` for refresh rotation).
> **Auth Strategy:** FastAPI Users with CookieTransport + DatabaseStrategy.
> **Envelope:** Every response wraps in `{ success, data, error, meta }` — see §0.

---

## §0 — Standards

### Response Envelope

```json
// Success
{
  "success": true,
  "data": { },
  "error": null,
  "meta": { "timestamp": "2026-04-30T10:00:00Z", "request_id": "req_abc123" }
}

// Error
{
  "success": false,
  "data": null,
  "error": { "code": "INVALID_OTP", "message": "OTP is incorrect or expired.", "field": "otp" },
  "meta": { "timestamp": "2026-04-30T10:00:00Z", "request_id": "req_abc123" }
}
```

### Error Codes

| Code | HTTP | When |
|---|---|---|
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `TOKEN_EXPIRED` | 401 | Access token expired |
| `TOKEN_INVALID` | 401 | Malformed or tampered token |
| `FORBIDDEN` | 403 | Lacks permission for this action |
| `NOT_FOUND` | 404 | Resource does not exist |
| `EMAIL_TAKEN` | 409 | Email already registered |
| `INVALID_OTP` | 400 | Wrong or expired OTP |
| `OTP_LOCKED` | 429 | Too many OTP attempts |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `VALIDATION_ERROR` | 422 | Request body fails validation |
| `MEETING_LOCKED` | 403 | Room is locked, no new joiners |
| `MEETING_FULL` | 403 | At capacity (50 participants) |
| `WAITING_ROOM_DECLINED` | 403 | Host declined admission |
| `MAX_KNOCKS_EXCEEDED` | 403 | 3 re-knock limit reached |
| `DEEPGRAM_UNAVAILABLE` | 503 | Deepgram service error |
| `LLM_UNAVAILABLE` | 503 | AI provider error |
| `INTERNAL_ERROR` | 500 | Unhandled exception |
| `HTTP_ERROR` | 400 | Library-raised generic error (avoid for custom endpoints) |

### Pagination

```
GET /v1/meetings?limit=20&cursor=<opaque_string>

Response data:
{
  "items": [...],
  "next_cursor": "abc123",   // null if no more pages
  "has_more": true
}
```

Default `limit` = 20. Max = 100.

### Auth Legend

| Symbol | Meaning |
|---|---|
| `—` | No auth required |
| `🔑` | Primary auth cookie required |
| `🔑 Host` | Auth + must be meeting host |
| `🔑 Host/Co-host` | Auth + must be host or co-host |
| `🎫` | Refresh token cookie only |
| `📝 Sig` | Webhook signature verification (no user auth) |

---

## 1. Auth

> Auth Strategy: FastAPI Users with CookieTransport + DatabaseStrategy.
> Cookie convention: `fastapiusersauth` is the primary auth cookie; `refresh_token` is separate and used only by `POST /v1/auth/refresh`.
> Routes marked [FU] are managed by FastAPI Users.
> Routes marked [Custom] are additions on top of the library.
>
> GET /v1/auth/users/me         — [FU] Profile management.
> POST /v1/auth/verify          — [FU] Email verification via token link.
> POST /v1/auth/forgot-password — [FU] Request password reset link.
> POST /v1/auth/reset-password  — [FU] Complete password reset with token.

### `POST /v1/auth/register`  # FastAPI Users default - rename or override path`
Auth: `—`

Register a new user. Inherits validation from `fastapi-users`. Triggers `on_after_register` for email verification.

**Request**
```json
{
  "email": "priya@example.com",
  "password": "SecurePass1",
  "display_name": "Priya Sharma"
}
```

**Response `201`**
```json
{
  "data": {
    "id": "usr_abc123",
    "email": "priya@example.com",
    "is_active": true,
    "is_verified": false
  }
}
```

**Errors:** `EMAIL_TAKEN` 409, `VALIDATION_ERROR` 422

---

### `POST /v1/auth/login`         # FastAPI Users default (form data: username + password)`
Auth: `—`

Sign in with email and password. Managed by `fastapi-users` OAuth2 password flow.

**Request (Form Data)**
```
Form Data (OAuth2 password flow — FastAPI Users requirement):
username=priya@example.com&password=SecurePass1
```

**Response `204`**
Success sets the auth cookie.

**Errors:** `INVALID_CREDENTIALS` 401, `RATE_LIMIT_EXCEEDED` 429

---

### `POST /v1/auth/2fa/verify`
Auth: `—`

Completes sign-in for accounts with TOTP 2FA enabled.

**Request**
```json
{
  "totp_session_id": "totp_abc123",
  "code": "847291"
}
```

**Response `200`**
```json
{
  "data": {
    "user": {
      "id": "usr_abc123",
      "display_name": "Priya Sharma",
      "email": "priya@example.com",
      "avatar_url": null,
      "providers": ["email"]
    }
  }
}
```

Sets the primary auth cookie and the `refresh_token` cookie on success.

**Errors:** `INVALID_OTP` 400, `OTP_LOCKED` 429 (5 attempts), `NOT_FOUND` 404 (totp_session_id expired)

---

### `POST /v1/auth/logout`        # FastAPI Users default
Auth: `🔑`

Logs out the user and clears auth cookies.

**Response `204`**

---

### `POST /v1/auth/refresh`
Auth: `🎫`

Issues a new primary auth session using the `refresh_token` cookie. Rotates the refresh token (single-use).

**Request:** empty body

**Response `200`**
```json
{ "data": { "message": "Token refreshed." } }
```

Sets the refreshed primary auth cookie and a new `refresh_token` cookie. Old refresh token is invalidated; new one is set.

**Errors:** `TOKEN_EXPIRED` 401, `TOKEN_INVALID` 401

---

### `GET /v1/auth/google/authorize`
Auth: `—`

Redirects the browser to Google's OAuth consent screen.

**Response:** `302` redirect to Google OAuth URL.

---

### `GET /v1/auth/google/callback`
Auth: `—`

Google OAuth callback. Handled by `fastapi-users`. Creates or links account, sets cookies, redirects to app.

**Response:** `302` redirect to `FRONTEND_URL/dashboard`.

---

---

### `POST /v1/auth/verify`         # [FU]
Auth: `—`

Verifies an email address using a token from a verification link. Handled by `fastapi-users`.

**Request**
```json
{
  "token": "verify_token_abc..."
}
```

**Response `200`**
```json
{
  "data": {
    "id": "usr_abc123",
    "email": "priya@example.com",
    "is_active": true,
    "is_verified": true
  }
}
```

**Errors:** `HTTP_ERROR` 400 (Invalid token)

---

### `POST /v1/auth/forgot-password`
Auth: `—`

Initiates password reset via `fastapi-users`. Sends reset token to email.

**Request**
```json
{ "email": "priya@example.com" }
```

**Response `202`**
Accepted.

---

### `POST /v1/auth/reset-password`
Auth: `—`

Completes password reset using a token.

**Request**
```json
{
  "token": "reset_token_abc...",
  "password": "NewSecurePass1"
}
```

**Response `200`**
```json
{ "data": { "message": "Password updated." } }
```

**Errors:** `VALIDATION_ERROR` 422

---

## 2. Meetings

### `POST /meetings`
Auth: `🔑`

Creates a new meeting. Returns the meeting slug used for the shareable link.

**Request**
```json
{
  "title": "Product Sync",
  "scheduled_at": "2026-05-01T10:00:00Z",   // optional — null = instant meeting
  "waiting_room_enabled": false,
  "language": "en"
}
```

**Response `201`**
```json
{
  "data": {
    "meeting_id": "mtg_abc123",
    "slug": "product-sync-abc123",
    "share_url": "https://meetio.app/meeting/product-sync-abc123/lobby",
    "title": "Product Sync",
    "status": "scheduled",
    "scheduled_at": "2026-05-01T10:00:00Z",
    "waiting_room_enabled": false,
    "language": "en",
    "max_participants": 50,
    "created_at": "2026-04-30T10:00:00Z"
  }
}
```

**SLA:** Must complete in < 500ms p95. Link is available immediately from the slug.

---

### `GET /meetings`
Auth: `🔑`

Paginated meeting history for the authenticated user.

**Query params:** `limit`, `cursor`, `status` (scheduled | in_progress | completed | cancelled)

**Response `200`**
```json
{
  "data": {
    "items": [
      {
        "meeting_id": "mtg_abc123",
        "title": "Product Sync",
        "status": "completed",
        "scheduled_at": "2026-04-29T10:00:00Z",
        "started_at": "2026-04-29T10:02:00Z",
        "ended_at": "2026-04-29T10:54:00Z",
        "duration_seconds": 3120,
        "participant_count": 5,
        "recap_status": "ready",
        "recording_status": "available"
      }
    ],
    "next_cursor": "abc123",
    "has_more": true
  }
}
```

---

### `GET /meetings/{id}`
Auth: `—` (public metadata) / `🔑` (full details including recap status)

**Response `200`**
```json
{
  "data": {
    "meeting_id": "mtg_abc123",
    "title": "Product Sync",
    "slug": "product-sync-abc123",
    "host": { "id": "usr_xyz", "display_name": "Ayush Rawat", "avatar_url": null },
    "status": "scheduled",
    "waiting_room_enabled": false,
    "room_locked": false,
    "language": "en",
    "max_participants": 50,
    "current_participant_count": 3,
    "scheduled_at": "2026-05-01T10:00:00Z",
    "started_at": null,
    "ended_at": null,
    "recap_status": null,
    "recording_status": null
  }
}
```

**Errors:** `NOT_FOUND` 404

---

### `PUT /meetings/{id}`
Auth: `🔑 Host`

Updates meeting settings. All fields optional — only provided fields are updated.

**Request**
```json
{
  "title": "Product Sync — Updated",
  "scheduled_at": "2026-05-01T11:00:00Z",
  "waiting_room_enabled": true,
  "language": "hi"
}
```

**Response `200`** — returns updated meeting object (same shape as GET).

**Errors:** `NOT_FOUND` 404, `FORBIDDEN` 403

---

### `DELETE /meetings/{id}`
Auth: `🔑 Host`

Cancels a scheduled meeting. Sets status to `cancelled`. Cannot cancel an `in_progress` meeting — use end-meeting flow instead.

**Response `204`**

**Errors:** `NOT_FOUND` 404, `FORBIDDEN` 403

---

### `POST /meetings/{id}/token`
Auth: `🔑`

Issues a LiveKit token for an authenticated user to join a meeting.

**Request:** empty body

**Response `200`**
```json
{
  "data": {
    "livekit_token": "eyJ...",
    "livekit_url": "wss://...livekit.cloud",
    "role": "participant",   // "host" | "co-host" | "participant"
    "meeting": { "meeting_id": "...", "title": "...", "waiting_room_enabled": false }
  }
}
```

**Errors:** `MEETING_FULL` 403, `MEETING_LOCKED` 403, `NOT_FOUND` 404

---

### `POST /meetings/{id}/join-guest`
Auth: `—`

Guest join flow. See TRD §5.9 for the full sequence.

**Request**
```json
{ "display_name": "Priya" }
```

**Response `200` — waiting room enabled**
```json
{
  "data": {
    "status": "waiting",
    "session_token": "gs_abc123",
    "display_name": "Priya (Guest)",
    "poll_url": "/v1/meetings/mtg_abc123/join-guest/status"
  }
}
```

**Response `200` — admitted immediately**
```json
{
  "data": {
    "status": "admitted",
    "session_token": "gs_abc123",
    "display_name": "Priya (Guest)",
    "livekit_token": "eyJ...",
    "livekit_url": "wss://...livekit.cloud"
  }
}
```

**Errors:** `MEETING_FULL` 403, `MEETING_LOCKED` 403, `NOT_FOUND` 404

---

### `GET /meetings/{id}/join-guest/status`
Auth: `—` (session_token in query param)

Polling endpoint for guests in waiting room. Poll every 3 seconds.

**Query params:** `session_token=gs_abc123`

**Response `200`**
```json
{
  "data": {
    "status": "waiting"       // "waiting" | "admitted" | "declined"
  }
}
```

When `admitted`:
```json
{
  "data": {
    "status": "admitted",
    "livekit_token": "eyJ...",
    "livekit_url": "wss://...livekit.cloud"
  }
}
```

When `declined`:
```json
{
  "data": {
    "status": "declined",
    "knock_count": 1,
    "can_reknock": true,      // false after 3rd decline
    "message": "You were not admitted."
  }
}
```

---

### `POST /meetings/{id}/migrate-guest`
Auth: `—` (session_token in body)

Converts a guest session to an authenticated account, mid-meeting or post-meeting.

**Request — Google path**
```json
{
  "session_token": "gs_abc123",
  "id_token": "google_id_token...",
  "source": "during_meeting"
}
```

**Request — email/password path**
```json
{
  "session_token": "gs_abc123",
  "email": "priya@example.com",
  "password": "SecurePass1",
  "source": "end_of_meeting"
}
```

**Response `200`**
```json
{
  "data": {
    "migrated": true,
    "user": {
      "id": "usr_abc123",
      "display_name": "Priya Sharma",
      "email": "priya@example.com",
      "avatar_url": null,
      "providers": ["email"]
    },
    "display_name_updated": "Priya Sharma"
  }
}
```

> Sets auth cookies. Broadcasts `meeting.role_changed` with updated name to all participants. Cancels 24h guest data purge. Max 5 migration attempts — `OTP_LOCKED` 429 after that.

**Errors:** `INVALID_CREDENTIALS` 401, `OTP_LOCKED` 429, `NOT_FOUND` 404

---

### `GET /meetings/{id}/participants`
Auth: `🔑`

Lists all participants for a meeting.

**Response `200`**
```json
{
  "data": {
    "participants": [
      {
        "session_id": "lk_session_xyz",
        "user_id": "usr_abc",
        "display_name": "Ayush Rawat",
        "role": "host",
        "is_guest": false,
        "joined_at": "2026-04-30T10:02:00Z",
        "left_at": null
      },
      {
        "session_id": "lk_session_abc",
        "user_id": null,
        "display_name": "Priya (Guest)",
        "role": "guest",
        "is_guest": true,
        "joined_at": "2026-04-30T10:05:00Z",
        "left_at": null
      }
    ],
    "total": 5,
    "max": 50
  }
}
```

---

### `GET /meetings/{id}/recording`
Auth: `🔑`

Returns a time-limited presigned URL for the recording. URL expires in 1 hour.

**Response `200`**
```json
{
  "data": {
    "recording_url": "https://recordings.meetio.app/recordings/mtg_abc123.mp4?X-Amz-Expires=3600&...",
    "expires_at": "2026-04-30T11:00:00Z",
    "duration_seconds": 3120,
    "recording_status": "available"
  }
}
```

**Errors:** `NOT_FOUND` 404, `FORBIDDEN` 403 (guest), recording not yet available → `recording_status: "processing"` in data

---

### `DELETE /meetings/{id}/recording`
Auth: `🔑 Host`

Permanently deletes the recording from Cloudflare R2.

**Response `204`**

**Errors:** `NOT_FOUND` 404, `FORBIDDEN` 403

---

### `GET /meetings/{id}/recap`
Auth: `🔑`

Returns the AI recap. Individual fields are `null` until each task completes — the frontend renders partially as sections arrive.

**Response `200`**
```json
{
  "data": {
    "recap_id": "rec_abc123",
    "meeting_id": "mtg_abc123",
    "status": "ready",            // "processing" | "ready" | "failed"
    "failed_reason": null,
    "summary": "The team discussed the onboarding redesign...",
    "summary_status": "ready",
    "key_decisions": [
      {
        "decision": "Ship onboarding v2 by May 10",
        "context": "Agreed after reviewing the user drop-off data.",
        "timestamp": "00:14:32"
      }
    ],
    "decisions_status": "ready",
    "ai_transcript": "Ayush Rawat [00:00:03]: Good morning everyone...",
    "ai_transcript_status": "ready",
    "action_items_status": "ready",
    "created_at": "2026-04-30T11:00:00Z",
    "updated_at": "2026-04-30T11:05:00Z"
  }
}
```

**Errors:** `NOT_FOUND` 404, `FORBIDDEN` 403 (guest)

---

### `DELETE /meetings/{id}/recap`
Auth: `🔑 Host`

Deletes the AI recap and all associated AI outputs for this meeting.

**Response `204`**

---

### `POST /meetings/{id}/recap/retry`
Auth: `🔑`

Manually retries the AI pipeline. Can retry Deepgram STT or LLM pipeline depending on which stage failed.

**Request**
```json
{ "stage": "llm" }   // "deepgram" | "llm"
```

**Response `200`**
```json
{ "data": { "message": "Retry queued.", "recap_status": "processing" } }
```

---

### `GET /meetings/{id}/transcript`
Auth: `🔑`

Returns the raw Deepgram transcript with speaker labels, timestamps, and confidence scores.

**Query params:** `format=json` (default) | `format=srt` | `format=txt`

**Response `200` (json format)**
```json
{
  "data": {
    "transcript_id": "trn_abc123",
    "meeting_id": "mtg_abc123",
    "language_detected": "en",
    "duration_seconds": 3120,
    "segments": [
      {
        "speaker_id": "Speaker 0",
        "user_id": "usr_xyz",
        "display_name": "Ayush Rawat",
        "start": 3.12,
        "end": 8.45,
        "text": "Good morning everyone, let's get started.",
        "confidence": 0.96
      }
    ],
    "created_at": "2026-04-30T11:02:00Z"
  }
}
```

**Errors:** `NOT_FOUND` 404, transcript not ready → `transcript_status: "processing"` in data

---

### `POST /meetings/{id}/feedback`
Auth: `🔑`

Submits post-meeting feedback rating and tags.

**Request**
```json
{
  "rating": 4,
  "tags": ["Great discussion", "Well organized"]
}
```

**Response `200`**
```json
{ "data": { "message": "Feedback submitted." } }
```

---

### `POST /meetings/{id}/controls`
Auth: `🔑 Host/Co-host`

Toggles room-wide controls. All fields optional — only provided fields are updated.

**Request**
```json
{
  "room_locked": true,
  "reactions_enabled": true,
  "locks": {
    "camera": false,
    "microphone": false,
    "screen_share": false,
    "chat": false
  }
}
```

**Response `200`**
```json
{
  "data": {
    "meeting_id": "mtg_abc123",
    "room_locked": true,
    "reactions_enabled": true,
    "locks": { "camera": false, "microphone": false, "screen_share": false, "chat": false }
  }
}
```

> Broadcasts `meeting.controls_changed` WebSocket event to all participants immediately.

---

### `POST /meetings/{id}/recording/start`
Auth: `🔑 Host/Co-host`

Starts composite recording via LiveKit Egress. Triggers the recording consent banner for all participants.

**Response `200`**
```json
{ "data": { "is_recording": true, "recording_started_at": "2026-04-30T10:05:00Z" } }
```

> Broadcasts `meeting.controls_changed` with `is_recording: true` — all clients show the consent banner.

---

### `POST /meetings/{id}/recording/stop`
Auth: `🔑 Host/Co-host`

Stops recording.

**Response `200`**
```json
{ "data": { "is_recording": false } }
```

> Broadcasts `meeting.controls_changed` with `is_recording: false` — banner removed from all clients.

---

### `POST /meetings/{id}/admit`
Auth: `🔑 Host/Co-host`

Admits a participant from the waiting room.

**Request**
```json
{ "session_token": "gs_abc123" }
```

**Response `200`**
```json
{ "data": { "admitted": true } }
```

> Triggers `meeting.waiting_room.admitted` WebSocket event to the waiting participant — their poll returns `status: "admitted"` with a LiveKit token.

---

### `POST /meetings/{id}/decline`
Auth: `🔑 Host/Co-host`

Declines a waiting room participant.

**Request**
```json
{ "session_token": "gs_abc123" }
```

**Response `200`**
```json
{ "data": { "declined": true, "knock_count": 1, "can_reknock": true } }
```

> Triggers `meeting.waiting_room.declined` WebSocket event to the waiting participant.

---

### `POST /meetings/{id}/co-host`
Auth: `🔑 Host`

Promotes or demotes a co-host.

**Request**
```json
{ "user_id": "usr_xyz", "action": "promote" }
```

`action`: `"promote"` | `"demote"`

**Response `200`**
```json
{ "data": { "user_id": "usr_xyz", "role": "co-host" } }
```

> On promote: adds to `meeting.co_host_ids`. On demote: removes. Broadcasts `meeting.role_changed` to all participants.

**Errors:** `NOT_FOUND` 404, `FORBIDDEN` 403 (only host can do this)

---

### `POST /meetings/{id}/remove`
Auth: `🔑 Host/Co-host`

Removes a participant from the meeting.

**Request**
```json
{ "session_id": "lk_session_xyz" }
```

**Response `200`**
```json
{ "data": { "removed": true } }
```

**Errors:** `NOT_FOUND` 404, `FORBIDDEN` 403 (cannot remove the host)

---

### `GET /meetings/{id}/chat`
Auth: `🔑`

Returns in-meeting chat history.

**Response `200`**
```json
{
  "data": {
    "messages": [
      {
        "chat_id": "chat_abc123",
        "sender_id": "usr_abc",
        "display_name": "Priya Sharma",
        "is_guest": false,
        "content": "Let's move this to next week",
        "deleted": false,
        "created_at": "2026-04-30T10:15:00Z"
      }
    ]
  }
}
```

---

### `POST /meetings/{id}/chat`
Auth: `—` (session_token for guests, primary auth cookie for auth users)

Sends a chat message.

**Request**
```json
{
  "content": "Let's move this to next week",
  "session_token": "gs_abc123"
}
```

> `session_token` only required for guests. Auth users omit it — identity resolved from cookie.

**Response `201`**
```json
{ "data": { "chat_id": "chat_abc123", "created_at": "2026-04-30T10:15:00Z" } }
```

> Broadcasts `meeting.chat.message` WebSocket event to all meeting participants.

---

### `DELETE /meetings/{id}/chat/{chat_id}`
Auth: `🔑`

Soft-deletes a chat message. Auth users can delete their own. Host/co-host can delete any.

**Response `204`**

> Broadcasts `meeting.chat.deleted` to all participants. Message content replaced with `[deleted]` client-side.

**Errors:** `NOT_FOUND` 404, `FORBIDDEN` 403

---

## 3. Dashboard

### `GET /dashboard/recaps`
Auth: `🔑` · Cached 5 min

Returns the 5 most recent meeting recaps for the user.

**Response `200`**
```json
{
  "data": {
    "recaps": [
      {
        "meeting_id": "mtg_abc123",
        "title": "Product Sync",
        "ended_at": "2026-04-29T10:54:00Z",
        "duration_seconds": 3120,
        "recap_status": "ready",
        "recording_status": "available",
        "participant_count": 5
      }
    ]
  }
}
```

---

### `GET /dashboard/action-items`
Auth: `🔑` · Cached 5 min

Returns up to 10 of the user's most urgent open action items, sorted by due date then priority.

**Response `200`**
```json
{
  "data": {
    "items": [
      {
        "action_item_id": "ai_abc123",
        "task": "Finalize onboarding wireframes",
        "meeting_id": "mtg_abc123",
        "meeting_name": "Product Sync",
        "priority": "high",
        "status": "pending",
        "due_date": "2026-05-02T00:00:00Z",
        "assigned_to_name": "Priya Sharma"
      }
    ],
    "total_open": 12
  }
}
```

---

### `GET /dashboard/stats`
Auth: `🔑` · Cached 5 min

**Response `200`**
```json
{
  "data": {
    "this_week": { "meeting_count": 4, "total_minutes": 187 },
    "this_month": { "meeting_count": 14, "total_minutes": 631 },
    "average_duration_minutes": 45,
    "total_meetings_all_time": 38
  }
}
```

---

### `GET /dashboard/upcoming`
Auth: `🔑` · Cached 2 min

Returns up to 5 upcoming scheduled meetings.

**Response `200`**
```json
{
  "data": {
    "meetings": [
      {
        "meeting_id": "mtg_xyz",
        "title": "Design Review",
        "scheduled_at": "2026-05-01T10:00:00Z",
        "participant_count_expected": 3,
        "share_url": "https://meetio.app/meeting/design-review-xyz/lobby"
      }
    ]
  }
}
```

---

## 4. Calendar

### `GET /calendar/events`
Auth: `🔑`

Returns calendar events in a date range.

**Query params:** `start=2026-05-01T00:00:00Z` `end=2026-05-31T23:59:59Z`

**Response `200`**
```json
{
  "data": {
    "events": [
      {
        "event_id": "cal_abc123",
        "title": "Product Sync",
        "start_at": "2026-05-01T10:00:00Z",
        "end_at": "2026-05-01T11:00:00Z",
        "timezone": "Asia/Kolkata",
        "meeting_id": "mtg_abc123",       // null if not a MeetIO meeting
        "gcal_event_id": "google_xyz",    // null if not synced
        "has_conflict": false
      }
    ]
  }
}
```

---

### `POST /calendar/events`
Auth: `🔑`

Creates a calendar event and optionally a linked MeetIO meeting.

**Request**
```json
{
  "title": "Design Review",
  "start_at": "2026-05-02T14:00:00Z",
  "end_at": "2026-05-02T15:00:00Z",
  "timezone": "Asia/Kolkata",
  "create_meeting": true    // if true, creates a MeetIO meeting and links it
}
```

**Response `201`**
```json
{
  "data": {
    "event_id": "cal_xyz",
    "meeting_id": "mtg_xyz",    // null if create_meeting=false
    "share_url": "https://meetio.app/meeting/design-review-xyz/lobby",
    "has_conflict": false
  }
}
```

**Conflict response (still 201 — user chose to schedule anyway):**
```json
{
  "data": {
    "event_id": "cal_xyz",
    "has_conflict": true,
    "conflict_with": { "title": "Weekly Standup", "start_at": "...", "end_at": "..." }
  }
}
```

---

### `PUT /calendar/events/{id}`
Auth: `🔑`

Updates a calendar event.

**Request** — all fields optional:
```json
{
  "title": "Design Review — Updated",
  "start_at": "2026-05-02T15:00:00Z",
  "end_at": "2026-05-02T16:00:00Z"
}
```

**Response `200`** — updated event object.

---

### `DELETE /calendar/events/{id}`
Auth: `🔑`

Deletes a calendar event. If linked to a MeetIO meeting, cancels the meeting too.

**Response `204`**

---

### `POST /calendar/sync/google`
Auth: `🔑`

Triggers a manual full Google Calendar sync for the user.

**Response `200`**
```json
{ "data": { "synced_events": 12, "last_synced_at": "2026-04-30T10:00:00Z" } }
```

---

### `GET /calendar/sync/status`
Auth: `🔑`

Returns the current Google Calendar sync status.

**Response `200`**
```json
{
  "data": {
    "connected": true,
    "sync_enabled": true,
    "last_synced_at": "2026-04-30T10:00:00Z",
    "sync_error": null,
    "channel_expiry": "2026-05-07T10:00:00Z"
  }
}
```

---

### `POST /webhooks/google-calendar`
Auth: `📝 Sig` (X-Goog-Channel-Token)

Receives Google Calendar push notification events.

**Headers:**
```
X-Goog-Channel-ID: <channel_id>
X-Goog-Channel-Token: <stored_token>
X-Goog-Resource-State: sync | exists | not_exists
```

**Response `200`** — always return 200 immediately; processing is async via Celery.

---

## 5. Messenger

### `GET /messenger/conversations`
Auth: `🔑`

Returns all conversations for the user, sorted by most recent message.

**Response `200`**
```json
{
  "data": {
    "conversations": [
      {
        "conversation_id": "conv_abc123",
        "type": "dm",
        "name": null,
        "members": [
          { "user_id": "usr_a", "display_name": "Ayush Rawat", "avatar_url": null },
          { "user_id": "usr_b", "display_name": "Priya Sharma", "avatar_url": null }
        ],
        "last_message_at": "2026-04-30T10:30:00Z",
        "unread_count": 2
      }
    ]
  }
}
```

> `last_message_preview` is NOT returned — message content is E2E encrypted. Previews are client-side only.

---

### `POST /messenger/conversations`
Auth: `🔑`

Creates a new DM or group conversation.

**Request**
```json
{
  "type": "dm",
  "member_ids": ["usr_b"],

  // E2E: conversation key encrypted separately for each member
  "encrypted_keys": {
    "usr_a": "base64ciphertext...",
    "usr_b": "base64ciphertext..."
  }
}
```

**Response `201`**
```json
{ "data": { "conversation_id": "conv_abc123", "type": "dm" } }
```

---

### `GET /messenger/conversations/{id}`
Auth: `🔑`

Returns conversation metadata and the user's encrypted conversation key.

**Response `200`**
```json
{
  "data": {
    "conversation_id": "conv_abc123",
    "type": "dm",
    "members": [ ... ],
    "encrypted_key": "base64ciphertext...",   // this user's encrypted copy of the conversation key
    "created_at": "2026-04-01T09:00:00Z"
  }
}
```

---

### `GET /messenger/conversations/{id}/messages`
Auth: `🔑`

Returns paginated messages (ciphertext only — server never decrypts).

**Query params:** `limit=50`, `cursor=<message_id>` (cursor-based, newest-first)

**Response `200`**
```json
{
  "data": {
    "items": [
      {
        "message_id": "msg_abc123",
        "conversation_id": "conv_abc123",
        "sender_id": "usr_a",
        "sender_name": "Ayush Rawat",
        "ciphertext": "base64...",
        "nonce": "base64...",
        "type": "text",
        "reply_to_id": null,
        "attachment": null,
        "created_at": "2026-04-30T10:30:00Z"
      }
    ],
    "next_cursor": "msg_xyz",
    "has_more": false
  }
}
```

---

### `POST /messenger/conversations/{id}/messages`
Auth: `🔑`

Sends an encrypted message. Server stores ciphertext only.

**Request**
```json
{
  "ciphertext": "base64...",
  "nonce": "base64...",
  "type": "text",
  "reply_to_id": null,
  "attachment": null
}
```

**Response `201`**
```json
{
  "data": {
    "message_id": "msg_xyz",
    "created_at": "2026-04-30T10:31:00Z"
  }
}
```

> Server immediately pushes `messenger.message` event to all conversation members via WebSocket.

---

### `POST /messenger/keys`
Auth: `🔑`

Registers or updates the user's public key. Called on account creation and key rotation.

**Request**
```json
{ "public_key": "base64..." }
```

**Response `201`**
```json
{ "data": { "message": "Public key registered." } }
```

---

### `GET /messenger/keys/public/{user_id}`
Auth: `🔑`

Returns another user's public key for encryption.

**Response `200`**
```json
{
  "data": {
    "user_id": "usr_b",
    "public_key": "base64..."
  }
}
```

**Errors:** `NOT_FOUND` 404 (user has no public key — hasn't set up Messenger yet)

---

### `POST /messenger/keys/backup`
Auth: `🔑`

Stores an encrypted private key backup. Server stores `salt + iv + ciphertext` only — cannot decrypt without user's passphrase.

**Request**
```json
{
  "salt": "base64...",
  "iv": "base64...",
  "ciphertext": "base64..."
}
```

**Response `201`**
```json
{ "data": { "message": "Key backup stored." } }
```

---

### `GET /messenger/keys/backup`
Auth: `🔑`

Returns the stored encrypted key backup for recovery on a new device.

**Response `200`**
```json
{
  "data": {
    "salt": "base64...",
    "iv": "base64...",
    "ciphertext": "base64..."
  }
}
```

**Errors:** `NOT_FOUND` 404 (no backup stored)

---

## 6. Action Items

### `GET /action-items/meetings`
Auth: `🔑`

Returns all meetings that have action items, with summary counts.

**Response `200`**
```json
{
  "data": {
    "meetings": [
      {
        "meeting_id": "mtg_abc123",
        "title": "Product Sync",
        "ended_at": "2026-04-29T10:54:00Z",
        "total_items": 5,
        "pending": 3,
        "done": 2
      }
    ]
  }
}
```

---

### `GET /action-items/meetings/{id}`
Auth: `🔑`

All action items for a specific meeting.

**Response `200`**
```json
{
  "data": {
    "items": [
      {
        "action_item_id": "ai_abc123",
        "task": "Finalize onboarding wireframes",
        "task_details": "",
        "assigned_to": "usr_b",
        "assigned_to_name": "Priya Sharma",
        "created_by": "usr_a",
        "priority": "high",
        "status": "pending",
        "due_date": "2026-05-02T00:00:00Z",
        "due_date_source": "ai_suggested",
        "due_date_raw_phrase": "by Friday",
        "due_date_confidence": "high",
        "ai_confidence": 87,
        "host_edited": false,
        "auto_confirmed": false,
        "created_at": "2026-04-29T11:10:00Z",
        "updated_at": "2026-04-29T11:10:00Z"
      }
    ],
    "pending_confirmation": true,    // true if host's 2hr window is still open
    "auto_confirm_at": "2026-04-29T13:00:00Z"
  }
}
```

---

### `POST /action-items`
Auth: `🔑`

Manually creates an action item.

**Request**
```json
{
  "meeting_id": "mtg_abc123",
  "task": "Write release notes",
  "task_details": "Cover all changes in v2",
  "assigned_to": "usr_b",
  "priority": "medium",
  "due_date": "2026-05-05T00:00:00Z"
}
```

**Response `201`** — full action item object.

---

### `PUT /action-items/{id}`
Auth: `🔑`

Updates an action item. Edit rights enforced per PRD §13.3.

**Request** — all fields optional:
```json
{
  "task": "Write release notes — include migration guide",
  "assigned_to": "usr_c",
  "priority": "high",
  "due_date": "2026-05-03T00:00:00Z",
  "status": "in_progress"
}
```

**Response `200`** — updated action item.

**Errors:** `FORBIDDEN` 403 (insufficient edit rights)

---

### `DELETE /action-items/{id}`
Auth: `🔑 Host`

Permanently deletes an action item.

**Response `204`**

---

### `PATCH /action-items/{id}/status`
Auth: `🔑`

Updates only the status of an action item. Any participant can update status of items assigned to them.

**Request**
```json
{ "status": "done" }   // "pending" | "in_progress" | "done" | "blocked"
```

**Response `200`**
```json
{ "data": { "action_item_id": "ai_abc123", "status": "done", "completed_at": "2026-04-30T14:00:00Z" } }
```

---

## 7. Settings

### `GET /v1/settings`
Auth: `🔑`

**Response `200`**
```json
{
  "data": {
    "timezone": "Asia/Kolkata",
    "language": "en",
    "theme": "system",
    "email_notifications": {
      "meeting_recap_ready": true,
      "action_item_assigned": true,
      "action_item_due_reminder": true,
      "meeting_invite": true,
      "gcal_sync_failed": true
    }
  }
}
```

---

### `PUT /v1/settings`
Auth: `🔑`

Updates user settings. All fields optional.

**Request**
```json
{
  "timezone": "America/New_York",
  "theme": "dark",
  "email_notifications": {
    "action_item_due_reminder": false
  }
}
```

**Response `200`** — updated settings object.

---

### `PUT /v1/settings/password`
Auth: `🔑`

Changes the user's password. Requires current password.

**Request**
```json
{
  "current_password": "OldPass1",
  "new_password": "NewPass1"
}
```

**Response `200`**
```json
{ "data": { "message": "Password updated. All other sessions have been invalidated." } }
```

**Errors:** `INVALID_CREDENTIALS` 401 (wrong current password)

---

### `POST /v1/settings/2fa`
Auth: `🔑`

Enables or disables TOTP-based 2FA.

**Request**
```json
{ "action": "enable" }    // "enable" | "disable"
```

**Response `200` (enable)**
```json
{
  "data": {
    "totp_secret": "BASE32SECRET...",
    "qr_code_url": "otpauth://totp/MeetIO:priya@example.com?secret=...",
    "message": "Scan the QR code in your authenticator app, then verify with a code."
  }
}
```

**Response `200` (disable)**
```json
{ "data": { "message": "2FA disabled." } }
```

---

### `GET /v1/settings/sessions`
Auth: `🔑`

Returns all active sessions.

**Response `200`**
```json
{
  "data": {
    "sessions": [
      {
        "session_id": "sess_abc123",
        "device_info": {
          "user_agent": "Mozilla/5.0 (Macintosh)...",
          "city": "Mumbai",
          "country": "IN"
        },
        "created_at": "2026-04-25T09:00:00Z",
        "last_used_at": "2026-04-30T10:00:00Z",
        "is_current": true
      }
    ]
  }
}
```

---

### `DELETE /v1/settings/sessions/{id}`
Auth: `🔑`

Revokes a session. The device using that session will be signed out within 30 seconds via WebSocket `session.revoked` event.

**Response `204`**

**Errors:** `NOT_FOUND` 404, `FORBIDDEN` 403 (not your session)

---

### `GET /v1/settings/login-history`
Auth: `🔑`

Returns last 90 days of login events.

**Query params:** `limit=50`, `cursor`

**Response `200`**
```json
{
  "data": {
    "items": [
      {
        "event": "signin",
        "device_info": { "city": "Mumbai", "country": "IN" },
        "created_at": "2026-04-30T10:00:00Z"
      }
    ],
    "has_more": false
  }
}
```

---

### `GET /v1/settings/linked-accounts`
Auth: `🔑`

**Response `200`**
```json
{
  "data": {
    "providers": [
      { "provider": "email", "linked_at": "2026-04-01T09:00:00Z" },
      { "provider": "google", "email": "priya@gmail.com", "linked_at": "2026-04-10T09:00:00Z" }
    ]
  }
}
```

---

### `DELETE /v1/settings/linked-accounts/{provider}`
Auth: `🔑`

Unlinks a sign-in provider. Cannot unlink the last remaining provider (user would be locked out).

**Response `204`**

**Errors:** `FORBIDDEN` 403 (would remove last provider)

---

### `POST /v1/settings/export`
Auth: `🔑`

Requests a GDPR data export. Zip file generated within 72 hours; download link sent via email.

**Response `202`**
```json
{ "data": { "message": "Export queued. You'll receive an email within 72 hours." } }
```

---

### `POST /v1/settings/delete-account`
Auth: `🔑`

Initiates the 30-day soft-delete window.

**Request**
```json
{ "confirmation": "DELETE MY ACCOUNT" }   // exact string required
```

**Response `200`**
```json
{
  "data": {
    "message": "Account scheduled for deletion.",
    "deletion_scheduled_at": "2026-05-30T10:00:00Z"
  }
}
```

---

## 8. Profile

### `GET /v1/profile`
Auth: `🔑`

**Response `200`**
```json
{
  "data": {
    "user_id": "usr_abc123",
    "display_name": "Priya Sharma",
    "email": "priya@example.com",
    "avatar_url": "https://r2.meetio.app/avatars/usr_abc123.webp",
    "avatar_type": "upload",
    "timezone": "Asia/Kolkata",
    "language": "en",
    "created_at": "2026-04-01T09:00:00Z"
  }
}
```

---

### `PUT /v1/profile`
Auth: `🔑`

Updates profile fields. All optional.

**Request**
```json
{
  "display_name": "Priya S.",
  "timezone": "Europe/London",
  "language": "en"
}
```

**Response `200`** — updated profile object.

---

### `POST /v1/profile/avatar`
Auth: `🔑`

Uploads a new avatar. Accepts `multipart/form-data`. Server re-encodes to WebP before storage.

**Request:** `Content-Type: multipart/form-data`, field: `file` (JPG / PNG / WebP, max 5 MB)

**Response `200`**
```json
{ "data": { "avatar_url": "https://r2.meetio.app/avatars/usr_abc123.webp" } }
```

**Errors:** `VALIDATION_ERROR` 422 (wrong MIME type or too large)

---

### `DELETE /v1/profile/avatar`
Auth: `🔑`

Removes the current avatar. Reverts to default.

**Response `204`**

---

## 9. Notifications

### `GET /v1/notifications`
Auth: `🔑`

Returns the 20 most recent notifications.

**Query params:** `limit=20`, `cursor`, `unread_only=false`

**Response `200`**
```json
{
  "data": {
    "items": [
      {
        "notification_id": "notif_abc123",
        "type": "recap.ready",
        "title": "Your recap is ready",
        "body": "Product Sync · Apr 29",
        "link": "/meetings/mtg_abc123/recap",
        "read": false,
        "created_at": "2026-04-29T11:10:00Z"
      }
    ],
    "unread_count": 3,
    "has_more": false
  }
}
```

---

### `PATCH /notifications/{id}/read`
Auth: `🔑`

Marks a single notification as read.

**Response `200`**
```json
{ "data": { "notification_id": "notif_abc123", "read": true } }
```

---

### `POST /notifications/read-all`
Auth: `🔑`

Marks all notifications as read.

**Response `200`**
```json
{ "data": { "marked_read": 7 } }
```

---

## 10. Infrastructure

### `GET /health`
Auth: `—`

Health check. Used by Railway and BetterStack monitors.

**Response `200`**
```json
{
  "data": {
    "status": "ok",
    "checks": {
      "mongodb": true,
      "redis": true,
      "celery": true
    }
  }
}
```

**Response `503`** (degraded):
```json
{
  "data": {
    "status": "degraded",
    "checks": { "mongodb": true, "redis": false, "celery": false }
  }
}
```

---

### `POST /webhooks/livekit`
Auth: `📝 Sig` (Authorization header — LiveKit JWT)

Receives LiveKit room and egress events. See TRD §11.2 for event handling logic.

**Events handled:** `room_started`, `room_finished`, `participant_joined`, `participant_left`, `egress_ended`

**Response `200`** — always return 200 immediately; all processing is async.

---

## 11. WebSocket

### `wss://api.meetio.app/ws`
Auth: primary auth cookie on HTTP upgrade request.

**Connection:**
```javascript
const ws = new WebSocket("wss://api.meetio.app/ws");
// primary auth cookie is sent automatically with the HTTP upgrade request
```

**Keepalive:** Client sends `ping` every 30s. Server replies `pong`. Connection closed after 90s silence.

**Message schema:**
```json
{
  "type": "event.type",
  "payload": { },
  "timestamp": "2026-04-30T10:00:00Z"
}
```

**All server-push event types:**

| Type | Payload fields | When |
|---|---|---|
| `notification.new` | `id`, `type`, `title`, `body`, `link` | New in-app notification |
| `meeting.status_changed` | `meeting_id`, `status`, `recording_status` | Meeting status update |
| `meeting.participant_joined` | `meeting_id`, `participant` | Participant joined |
| `meeting.participant_left` | `meeting_id`, `session_id`, `display_name` | Participant left |
| `meeting.role_changed` | `meeting_id`, `user_id`, `new_role` | Promotion or demotion |
| `meeting.controls_changed` | `meeting_id`, `room_locked`, `reactions_enabled`, `is_recording`, `camera_locked`, `microphone_locked`, `screen_share_locked`, `chat_locked` | Any room control toggled |
| `meeting.waiting_room.new` | `meeting_id`, `participant` | New knock |
| `meeting.waiting_room.admitted` | `meeting_id`, `session_id` | Knock admitted |
| `meeting.waiting_room.declined` | `meeting_id`, `session_id`, `knock_count` | Knock declined |
| `recap.status_changed` | `meeting_id`, `status`, `section` | AI pipeline update |
| `action_item.assigned` | `action_item_id`, `task`, `meeting_name`, `due_date` | Assigned to you |
| `action_item.status_changed` | `action_item_id`, `status`, `auto_confirmed` | Status update |
| `messenger.message` | `conversation_id`, `message_id`, `sender_id`, `ciphertext`, `nonce` | New message |
| `meeting.chat.message` | `meeting_id`, `chat_id`, `sender_id`, `display_name`, `content`, `is_guest` | New in-meeting chat message |
| `meeting.chat.deleted` | `meeting_id`, `chat_id` | Chat message deleted |
| `session.revoked` | `session_id` | This session was revoked remotely |
| `pong` | — | Keepalive response |

**Client-to-server:**

| Type | When |
|---|---|
| `ping` | Every 30s keepalive |

---

_Version: 1.0_
_Last Updated: April 30, 2026_
_Derived from: MeetIO PRD v2.0, TRD v2.0_

