# MeetIO — Database Schema
**Database:** MongoDB Atlas  
**Migration tool:** migrate-mongo  
**Reference convention:** All cross-collection references use UUID strings (`id: str`), never `ObjectId`.  
**All timestamps:** UTC ISO 8601 strings unless noted.

---

## Collections Index

| Collection | Description |
|---|---|
| `users` | Authenticated user accounts |
| `sessions` | Active auth sessions tied to refresh-token rotation |
| `meetings` | All meeting records (scheduled + completed) |
| `participants` | Per-session participant records per meeting |
| `guest_sessions` | Temporary guest data — purged 24h after meeting ends |
| `recaps` | AI pipeline output per meeting |
| `transcripts` | Raw Deepgram output per meeting |
| `action_items` | Tasks extracted from meetings |
| `conversations` | Messenger conversation threads |
| `messages` | Encrypted messenger messages |
| `messenger_keys` | Public keys + encrypted private key backups |
| `calendar_events` | Scheduled meeting events |
| `gcal_tokens` | Per-user Google Calendar OAuth tokens + watch channels |
| `chat_messages` | In-meeting chat messages — ephemeral, purged 24h after meeting ends |
| `notifications` | In-app notifications |
| `dead_letter_events` | Failed webhook events awaiting retry |

---

## 1. `users`

```python
{
  "_id": "usr_abc123",   # str, prefixed UUID.
                        # FastAPI Users defaults to plain UUID4. To use prefixed UUIDs 
                        # (usr_abc123), configure a custom ID generator in the 
                        # UserDatabase motor adapter.
  "schema_version": 1,

  # Identity
  "email": "priya@example.com",      # str, unique, lowercase
  "is_verified": True,               # bool — renamed from email_verified for fastapi-users
  "display_name": "Priya Sharma",    # str
  "avatar_url": None,                # str | None — R2 URL or null
  "avatar_type": "upload",           # "upload" | "google" | "default" | None

  # Auth
  "hashed_password": "...",   # str | None — null for Google-only accounts.
                             # Field name must be hashed_password — FastAPI Users requires this exact name.
  "providers": ["email", "google"],  # list[str] — "email" | "google"
  "google_id": "10234...",           # str | None

  # 2FA
  "totp_enabled": False,             # bool
  "totp_secret": None,               # str | None — encrypted at rest

  # State
  "is_active": True,                 # bool — False = soft-deleted
  "is_superuser": False,   # bool — required by FastAPI Users, always False for regular users
  "deletion_requested_at": None,     # str (ISO 8601) | None
  "deletion_scheduled_at": None,     # str (ISO 8601) | None — requested_at + 30 days

  # Preferences (denormalized here for fast reads — no separate settings collection needed in v1)
  "timezone": "Asia/Kolkata",        # str — IANA tz string
  "language": "en",                  # str — BCP 47
  "theme": "system",                 # "light" | "dark" | "system"
  "email_notifications": {
    "meeting_recap_ready": True,
    "action_item_assigned": True,
    "action_item_due_reminder": True,
    "meeting_invite": True,
    "gcal_sync_failed": True,
  },

  "created_at": "2026-04-01T10:00:00Z",
  "updated_at": "2026-04-01T10:00:00Z",
  "last_seen_at": "2026-04-29T09:00:00Z",
}
```

**Indexes:**

```js
{ email: 1 }                          // unique
{ google_id: 1 }                      // sparse, unique — null users skipped
{ is_active: 1, deletion_scheduled_at: 1 }  // GDPR purge sweep
```

---

## 2. `sessions`

> This collection is required because MeetIO uses DatabaseStrategy (not JWTStrategy).
> DatabaseStrategy stores refresh-token session records here and supports remote revocation via
> `DELETE /v1/settings/sessions/{id}`. If you switch to JWTStrategy, this collection
> is unused and remote revocation is impossible.

One document per active refresh token. Enables session listing + revocation from Settings.

```python
{
  "_id": "sess_abc123",
  "schema_version": 1,

  "user_id": "usr_abc123",
  "refresh_token_hash": "sha256:...",  # hashed — never store raw token
  "device_info": {
    "user_agent": "Mozilla/5.0...",
    "ip": "103.21.x.x",               # anonymized last octet in prod
    "city": "Mumbai",                  # from IP geo — best-effort
    "country": "IN",
  },
  "is_revoked": False,
  "expires_at": "2026-05-14T10:00:00Z",
  "created_at": "2026-04-29T10:00:00Z",
  "last_used_at": "2026-04-29T10:00:00Z",
}
```

**Indexes:**

```js
{ user_id: 1, is_revoked: 1 }         // list active sessions
{ refresh_token_hash: 1 }             // unique — lookup on refresh
{ expires_at: 1 }                     // TTL index — MongoDB auto-deletes
```

---

## 3. `meetings`

```python
{
  "_id": "mtg_abc123",
  "schema_version": 1,

  # Identity
  "title": "Product Sync",
  "slug": "product-sync-abc123",        # str, unique — used in shareable link
  "host_user_id": "usr_xyz",
  "co_host_ids": [],                    # list[str] — user_ids promoted to co-host; persists across reconnects
  "max_participants": 50,               # int — enforced server-side on token issuance

  # Status
  "status": "scheduled",               # "scheduled" | "in_progress" | "completed" | "cancelled"

  # Config
  "waiting_room_enabled": False,
  "room_locked": False,
  "language": "en",                    # BCP 47 — passed to Deepgram

  # Lockable controls state (room-wide)
  "locks": {
    "camera": False,                   # True = locked (no one can enable)
    "microphone": False,
    "screen_share": False,
    "chat": False,
    "reactions": True,                 # reactions locked OFF by default
  },

  # Recording
  "recording_enabled": False,          # bool — toggled by host/co-host mid-meeting
  "recording_status": None,            # None | "processing" | "available" | "failed"
  "recording_r2_key": None,            # str | None — R2 object key
  "recording_url": None,               # str | None — presigned URL (regenerated on access, not stored)
  "recording_started_at": None,        # str (ISO 8601) | None
  "recording_ended_at": None,          # str (ISO 8601) | None

  # Recap pipeline
  "recap_status": None,                # None | "processing" | "ready" | "failed"
  "recap_retry_count": 0,              # int — manual retries

  # Transcript pipeline
  "transcript_status": None,           # None | "processing" | "available" | "failed"
  "transcript_retry_count": 0,

  # Feedback (aggregate — individual feedback not stored per user in v1)
  "feedback_ratings": [],              # list[int] — 1-5 stars from all participants
  "feedback_tags": [],                 # list[str] — "Great discussion", "Too long" etc.

  # Timing
  "scheduled_at": "2026-04-30T10:00:00Z",
  "started_at": None,                  # set when first participant joins
  "ended_at": None,                    # set on room_finished
  "duration_seconds": None,            # int | None — computed on end

  "created_at": "2026-04-29T10:00:00Z",
  "updated_at": "2026-04-29T10:00:00Z",
}
```

**Indexes:**

```js
{ slug: 1 }                                    // unique — link resolution
{ host_user_id: 1, created_at: -1 }            // meeting history
{ status: 1, scheduled_at: 1 }                 // upcoming meetings query
{ ended_at: 1 }                                // GDPR expiry + recording expiry sweep
{ recap_status: 1 }                            // pipeline monitoring
```

---

## 4. `participants`

One document per user per meeting session. A user who rejoins gets a new document.

```python
{
  "_id": "par_abc123",
  "schema_version": 1,

  "meeting_id": "mtg_abc123",
  "session_id": "lk_session_xyz",      # LiveKit participant session ID — always present
  "user_id": "usr_xyz",                # str | None — null for guests (until conversion)
  "display_name": "Priya (Guest)",     # str — shown in UI and transcript

  "role": "participant",               # "host" | "co-host" | "participant" | "guest"
  "is_guest": True,                    # bool

  # Guest conversion
  "converted_at": None,                # str (ISO 8601) | None
  "converted_from_name": None,         # str | None — display_name before conversion
  "migrated_to_user_id": None,         # str | None — user_id after successful conversion

  # Timeline
  "joined_at": "2026-04-29T10:05:00Z",
  "left_at": None,                     # str (ISO 8601) | None

  # Waiting room
  "knock_count": 0,                    # int — re-knock attempts
  "last_knocked_at": None,             # str (ISO 8601) | None
}
```

**Indexes:**

```js
{ meeting_id: 1 }                              // list participants in meeting
{ meeting_id: 1, user_id: 1 }                 // check if user is in meeting
{ session_id: 1 }                             // webhook lookup
{ user_id: 1, joined_at: -1 }                 // user's meeting history
```

---

## 5. `guest_sessions`

Temporary. GDPR-purged 24 hours after meeting ends.

```python
{
  "_id": "gs_abc123",
  "schema_version": 1,

  "session_id": "lk_session_xyz",       # LiveKit session ID — join key
  "meeting_id": "mtg_abc123",
  "display_name": "Ayush (Guest)",

  # Timing
  "joined_at": "2026-04-29T10:05:00Z",
  "left_at": None,
  "meeting_ended_at": None,
  "purge_at": None,                     # datetime — meeting_ended_at + 24h. Set on room_finished.

  # Migration state
  "migrated_to_user_id": None,          # str | None
  "migration_completed_at": None,
  "migration_source": None,             # "during_meeting" | "end_of_meeting" | None
  "migration_attempts": 0,              # int — rate limit: max 5
  "locked_until": None,                 # str (ISO 8601) | None — backoff on failed attempts
}
```

**Indexes:**

```js
{ session_id: 1 }                              // unique — join/auth lookup
{ meeting_id: 1 }                             // list guests in meeting
{ purge_at: 1 }                               // GDPR purge sweep (daily Celery task)
```

---

## 6. `recaps`

One document per meeting. Created when AI pipeline starts. Fields populated as each task completes.

```python
{
  "_id": "rec_abc123",
  "schema_version": 1,

  "meeting_id": "mtg_abc123",           # str, unique

  # Each field is None until its task completes
  "summary": None,                      # str | None — meeting overview
  "key_decisions": None,                # list[dict] | None
  #   [{ "decision": str, "context": str, "timestamp": str }]

  "ai_transcript": None,                # str | None — LLM-cleaned readable transcript

  # Status per section (for partial-ready UI)
  "summary_status": "pending",          # "pending" | "ready" | "failed"
  "decisions_status": "pending",
  "ai_transcript_status": "pending",
  "action_items_status": "pending",     # separate from action_items collection status

  # Overall
  "status": "processing",              # "processing" | "ready" | "failed"
  "failed_reason": None,               # str | None — shown in UI on failure

  "created_at": "2026-04-29T11:00:00Z",
  "updated_at": "2026-04-29T11:05:00Z",
}
```

**Indexes:**

```js
{ meeting_id: 1 }                             // unique
{ status: 1, updated_at: -1 }                 // dashboard recent recaps
```

---

## 7. `transcripts`

Raw Deepgram output. Kept separate from recaps — can be large (1hr meeting ≈ 300–600 KB JSON).

```python
{
  "_id": "trn_abc123",
  "schema_version": 1,

  "meeting_id": "mtg_abc123",           # str, unique

  # Deepgram output — parsed and normalized
  "segments": [
    {
      "speaker_id": "Speaker 0",        # Deepgram diarization label
      "user_id": "usr_xyz",             # str | None — matched participant
      "display_name": "Priya Sharma",   # resolved name
      "start": 3.12,                    # float — seconds from start
      "end": 8.45,
      "text": "I think we should...",
      "confidence": 0.94,
    }
  ],

  # Speaker mapping used (for re-processing if needed)
  "speaker_map": {
    "Speaker 0": { "user_id": "usr_xyz", "display_name": "Priya Sharma" },
    "Speaker 1": { "user_id": None, "display_name": "Unknown Speaker" },
  },

  "language_detected": "en",
  "duration_seconds": 3120,

  "created_at": "2026-04-29T11:02:00Z",
}
```

**Indexes:**

```js
{ meeting_id: 1 }                             // unique
```

---

## 8. `action_items`

Directly from PRD §13.2 — reproduced here as the authoritative schema.

```python
{
  "_id": "ai_abc123",
  "schema_version": 1,

  "meeting_id": "mtg_abc123",
  "meeting_name": "Product Sync",       # denormalized for display

  # Task
  "task": "Finalize onboarding flow wireframes",
  "task_details": "",                   # str — optional extended description

  # Assignment
  "assigned_to": "usr_xyz",            # str | None — null = unassigned
  "assigned_to_name": "Priya Sharma",  # denormalized
  "created_by": "usr_host",            # user_id
  "updated_by": "usr_host",

  # Priority + status
  "priority": "high",                  # "high" | "medium" | "low"
  "status": "pending",                 # "pending" | "in_progress" | "done" | "blocked"

  # Due date
  "due_date": None,                    # str (ISO 8601) | None
  "due_date_source": "ai_suggested",   # "ai_suggested" | "host_set" | "not_set"
  "due_date_raw_phrase": "by Friday",  # str | None
  "due_date_confidence": "high",       # "high" | "low" | None

  # AI metadata
  "ai_confidence": 87,                 # int 0–100
  "host_edited": False,                # bool — True if host changed anything
  "auto_confirmed": False,             # bool — True if 2hr window lapsed

  # Timestamps
  "completed_at": None,
  "created_at": "2026-04-29T11:10:00Z",
  "updated_at": "2026-04-29T11:10:00Z",
}
```

**Indexes:**

```js
{ meeting_id: 1 }                              // all items for a meeting
{ assigned_to: 1, status: 1 }                  // user's action items (dashboard widget)
{ assigned_to: 1, due_date: 1 }               // due date reminders
{ status: 1, due_date: 1 }                    // overdue sweep
```

---

## 9. `conversations`

```python
{
  "_id": "conv_abc123",
  "schema_version": 1,

  "type": "dm",                         # "dm" | "group"
  "name": None,                         # str | None — group name only
  "member_ids": ["usr_a", "usr_b"],     # list[str] — all current members

  # E2E: conversation key encrypted per member
  # { user_id → base64(encrypted_conversation_key) }
  "encrypted_keys": {
    "usr_a": "base64ciphertext...",
    "usr_b": "base64ciphertext...",
  },

  # Denormalized for conversation list view (avoids message lookups)
  "last_message_preview": "Hey, can you review...",  # str | None — plaintext preview NOT stored
  # ↑ NOTE: preview is client-side only — server never decrypts. This field stays None.
  "last_message_at": "2026-04-29T10:30:00Z",

  "created_by": "usr_a",
  "created_at": "2026-04-01T09:00:00Z",
  "updated_at": "2026-04-29T10:30:00Z",
}
```

**Indexes:**

```js
{ member_ids: 1 }                              // find conversations for a user
{ member_ids: 1, last_message_at: -1 }        // conversation list sorted by recency
```

---

## 10. `messages`

```python
{
  "_id": "msg_abc123",
  "schema_version": 1,

  "conversation_id": "conv_abc123",
  "sender_id": "usr_a",
  "sender_name": "Priya Sharma",        # denormalized — name at time of send

  # E2E payload — server never sees plaintext
  "ciphertext": "base64...",            # str
  "nonce": "base64...",                 # str — NaCl box nonce

  "type": "text",                       # "text" | "image" | "video" | "document" | "other"

  # Attachments (optional)
  "attachment": None,                   # dict | None
  # {
  #   "r2_key": "messenger/conv_abc/msg_abc.pdf",
  #   "filename": "brief.pdf",
  #   "size_bytes": 204800,
  #   "mime_type": "application/pdf",
  # }

  # Reply threading
  "reply_to_id": None,                  # str | None — parent message _id

  # Delivery state (server tracks delivery, not read — read is client-side)
  "delivered_at": None,                 # str (ISO 8601) | None

  "created_at": "2026-04-29T10:30:00Z",
}
```

**Indexes:**

```js
{ conversation_id: 1, created_at: -1 }        // paginated message history
{ sender_id: 1 }                              // user's sent messages
```

---

## 11. `messenger_keys`

One document per user. Contains public key (shareable) and encrypted private key backup (optional).

```python
{
  "_id": "mk_abc123",
  "schema_version": 1,

  "user_id": "usr_abc123",              # str, unique

  # Public key — visible to all users for encryption
  "public_key": "base64...",            # str — NaCl box public key

  # Private key backup — encrypted client-side with user's passphrase before upload
  # Server cannot decrypt this. See #8 fix for encryption spec.
  "backup": None,                       # dict | None
  # {
  #   "salt": "base64...",              # PBKDF2 salt
  #   "iv": "base64...",                # AES-GCM IV
  #   "ciphertext": "base64...",        # encrypted private key
  # }

  "created_at": "2026-04-01T09:00:00Z",
  "updated_at": "2026-04-01T09:00:00Z",
}
```

**Indexes:**

```js
{ user_id: 1 }                                // unique
```

---

## 12. `calendar_events`

```python
{
  "_id": "cal_abc123",
  "schema_version": 1,

  "user_id": "usr_abc123",              # owner

  # Link to meeting (if this event is a MeetIO meeting)
  "meeting_id": None,                   # str | None

  # Event data
  "title": "Product Sync",
  "description": "",
  "start_at": "2026-04-30T10:00:00Z",   # UTC
  "end_at": "2026-04-30T11:00:00Z",     # UTC
  "timezone": "Asia/Kolkata",           # original tz — for display

  # Google Calendar sync
  "gcal_event_id": None,                # str | None — Google's event ID
  "gcal_calendar_id": None,             # str | None — "primary" or specific calendar
  "gcal_synced_at": None,               # str (ISO 8601) | None

  # Conflict detection (precomputed on write)
  "has_conflict": False,

  "created_at": "2026-04-29T10:00:00Z",
  "updated_at": "2026-04-29T10:00:00Z",
}
```

**Indexes:**

```js
{ user_id: 1, start_at: 1 }                   // calendar view range queries
{ user_id: 1, end_at: 1 }                     // conflict detection
{ gcal_event_id: 1 }                          // sparse — Google webhook dedup
{ meeting_id: 1 }                             // sparse — meeting → calendar lookup
```

---

## 13. `gcal_tokens`

One document per user. Stores Google OAuth tokens for Calendar access + active push notification channel.

```python
{
  "_id": "gct_abc123",
  "schema_version": 1,

  "user_id": "usr_abc123",              # unique

  # OAuth tokens (encrypted at rest in prod)
  "access_token": "ya29...",
  "refresh_token": "1//...",
  "token_expiry": "2026-04-29T11:00:00Z",

  # Google push notification channel
  "channel_id": "uuid-...",            # str | None — UUID sent to Google
  "channel_resource_id": "...",        # str | None — Google's resource ID
  "channel_expiry": "2026-05-06T10:00:00Z",  # str (ISO 8601) | None — max ~7 days
  # Celery Beat renews channels expiring within 48 hours (daily check)

  "sync_enabled": True,
  "last_synced_at": "2026-04-29T10:00:00Z",
  "sync_error": None,                  # str | None — last error message

  "created_at": "2026-04-01T09:00:00Z",
  "updated_at": "2026-04-29T10:00:00Z",
}
```

**Indexes:**

```js
{ user_id: 1 }                                // unique
{ channel_expiry: 1 }                         // renewal sweep — find channels expiring within 48h
{ channel_id: 1 }                             // webhook receipt — identify user from channel_id
```

---

## 14. `chat_messages`

In-meeting chat. Ephemeral — purged 24 hours after meeting ends (same Celery Beat job as guest data).

```python
{
  "_id": "chat_abc123",
  "schema_version": 1,

  "meeting_id": "mtg_abc123",
  "sender_id": "usr_abc",           # str | None — null for guests
  "sender_session_id": "lk_xyz",   # LiveKit session ID — always present
  "display_name": "Priya Sharma",  # denormalized — name at send time
  "is_guest": False,

  "content": "Let's move this to next week",
  "deleted": False,
  "deleted_at": None,
  "deleted_by": None,               # user_id of who deleted it

  "created_at": "2026-04-30T10:15:00Z",
  "purge_at": None,                 # set to meeting.ended_at + 24h on room_finished
}
```

**Indexes:**

```js
{ meeting_id: 1, created_at: 1 }   // load chat history in order
{ purge_at: 1 }                     // daily purge sweep
```

---

## 15. `notifications`

```python
{
  "_id": "notif_abc123",
  "schema_version": 1,

  "user_id": "usr_abc123",
  "type": "recap.ready",               # see type list below
  "title": "Your recap is ready",
  "body": "Product Sync · Apr 29",
  "link": "/meetings/mtg_abc123/recap",  # str | None — in-app deep link

  "read": False,
  "read_at": None,

  "created_at": "2026-04-29T11:10:00Z",
  # TTL: 90 days — MongoDB auto-deletes via TTL index
}
```

**Notification types:**

```
recap.ready                — AI recap finished processing
recap.failed               — AI pipeline failed
transcript.ready           — Raw transcript ready
recording.ready            — Recording available
action_item.assigned       — Action item assigned to you
action_item.due_reminder   — Due date approaching
action_item.auto_confirmed — Host's 2hr window lapsed, items confirmed
meeting.starting_soon      — Scheduled meeting starting in 15 min
gcal.sync_failed           — Google Calendar sync error
```

**Indexes:**

```js
{ user_id: 1, read: 1, created_at: -1 }       // notification list
{ user_id: 1, created_at: -1 }                // all notifications paginated
{ created_at: 1 }                             // TTL index — expire after 90 days
```

---

## 16. `dead_letter_events`

Failed webhook events that exhausted all Celery retries. Retried by Beat every 30 minutes.

```python
{
  "_id": "dle_abc123",
  "schema_version": 1,

  "source": "google_calendar",         # "google_calendar" | "livekit"
  "event_type": "calendar.sync",       # original event type
  "payload": { },                      # dict — original webhook payload (sanitized)

  "retry_count": 5,                    # int — attempts so far
  "last_attempted_at": "2026-04-29T10:00:00Z",
  "last_error": "Connection timeout",  # str | None
  "next_retry_at": "2026-04-29T10:30:00Z",

  "resolved": False,                   # bool — True once successfully processed
  "resolved_at": None,

  "created_at": "2026-04-29T09:30:00Z",
}
```

**Indexes:**

```js
{ resolved: 1, next_retry_at: 1 }             // Beat job query: unresolved + due for retry
{ created_at: 1 }                             // TTL — expire resolved after 7 days (set in code)
```

---

## Summary — Relationships Map

```
users
 ├── sessions (user_id)
 ├── meetings (host_user_id)
 ├── participants (user_id)
 ├── action_items (assigned_to, created_by)
 ├── conversations (member_ids)
 ├── messages (sender_id)
 ├── messenger_keys (user_id)
 ├── calendar_events (user_id)
 ├── gcal_tokens (user_id)
 └── notifications (user_id)

meetings
 ├── participants (meeting_id)
 ├── guest_sessions (meeting_id)
 ├── recaps (meeting_id)
 ├── transcripts (meeting_id)
 ├── action_items (meeting_id)
 ├── chat_messages (meeting_id)
 └── calendar_events (meeting_id)

conversations
 └── messages (conversation_id)
```

---

## Notes

**What's embedded vs referenced:**
- `recap` is a separate collection (not embedded in `meeting`) because it can be large and is fetched independently.
- `transcript` is separate — raw Deepgram JSON for a 1hr meeting is 300–600 KB. Embedding it in `meeting` would bloat every meeting list query.
- User preferences are embedded in `users` — no separate `settings` collection needed in v1.
- `meeting.locks` is embedded — it changes frequently mid-meeting and is always read together with the meeting.
- `meeting.co_host_ids` is embedded — checked on every token issuance to restore role after reconnect.
- `chat_messages` is a separate collection (not embedded) — can grow large in long meetings and is purged independently.

**What's not here (v2):**
- `otp_sessions` — OTP state can live in Redis with a TTL key (`otp:{email}:{hash}`) rather than MongoDB.
- `login_history` — same pattern: Redis sorted set or a simple `login_events` collection (not needed for v1 core).

---

_Schema version: 1_  
_Last updated: April 30, 2026_

