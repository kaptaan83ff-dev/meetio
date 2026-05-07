# Task Breakdown: Session Management

**Feature:** #3 from MVP Roadmap
**Estimated Time:** 6–8 hours total
**Priority:** THIRD — builds directly on Feature 2 (Auth)
**Status:** [ ] Not Started

---

## Feature 3: Session Management

---

### Task 3.1: Backend — Concurrent Session Service [MVP]

- [ ] Extend `backend/app/services/auth_service.py`: add `build_device_info(request: Request) -> dict` — extract `request.headers.get("User-Agent")`, anonymise IP last octet (`ip.rsplit(".", 1)[0] + ".0"`), perform IP geo lookup via `ipinfo` or `httpx` call to `ipapi.co/{ip}/json` (best-effort, never block on failure)
- [ ] In `session_repo.create_session()`: accept full `device_info` dict, store in `sessions.device_info`; generate a new UUID for `_id`, SHA-256 hash the raw refresh token before storing — raw token never touches MongoDB
- [ ] Ensure every sign-in path (email/password AND Google OAuth AND 2FA completion) calls `create_session()` — no path issues cookies without creating a session document
- [ ] Add `get_active_sessions(user_id: str) -> list[SessionDocument]`: query `sessions` where `user_id` matches, `is_revoked: False`, `expires_at > now()`, sorted `created_at: -1`
- [ ] Add `is_current_session(session_id: str, token_payload: dict) -> bool` — compare `session_id` from DB against `session_id` claim in decoded JWT payload
- [ ] Write integration test: sign in twice from different user agents → `get_active_sessions()` returns 2 documents with distinct `device_info.user_agent` values
- Status: [ ] TODO

### Task 3.1.1: Backend — Resend OTP for Password Reset [MVP]
- [ ] Add `POST /v1/auth/password/forgot/resend` endpoint:
    - [ ] Accepts `email` as input.
    - [ ] Rate limit: 3 requests per 5 minutes per email (stored in Redis, e.g., `password_reset:rate:{email}`).
    - [ ] Generates a new OTP, stores it (reusing `auth_service.store_otp` for "password_reset" type), and dispatches `send_email` task.
    - [ ] Always returns a success message to prevent email enumeration, regardless of whether the email exists.
    - [ ] If `APP_ENV == "development"`, include `dev_otp` in the response for testing.
- [ ] Write integration test for `POST /v1/auth/password/forgot/resend`:
    - [ ] Test successful resend.
    - [ ] Test rate-limiting (3 attempts within 5 minutes, 4th attempt returns 429).
    - [ ] Test against non-existent email (should still return success, but not send email).
- Status: [ ] TODO

---

### Task 3.2: Backend — Sessions API Endpoint [MVP]

- [ ] Create `backend/app/routers/settings.py` (shared with Feature 4): add `GET /v1/settings/sessions` — call `session_repo.get_active_sessions(current_user.id)`, mark each with `is_current: True/False` by comparing session_id from JWT, return session list
- [ ] Add `DELETE /v1/settings/sessions/{id}` — verify `session.user_id == current_user.id`, raise `FORBIDDEN` 403 if not; call `session_repo.revoke_session(id)`; call `manager.broadcast_to_user(user_id, {type: "session.revoked", payload: {session_id: id}})` via Redis pub/sub; return `204`
- [ ] Add `GET /v1/settings/login-history` — read Redis sorted set `login_history:{user_id}`, `ZRANGEBYSCORE` from `now() - 90days` to `+inf`, cursor-paginate by score; return list of login event dicts
- [ ] Write integration test: `DELETE /settings/sessions/{id}` with session belonging to another user → 403; own session → 204 + `is_revoked: True` in DB
- [ ] Write integration test: `GET /settings/sessions` → both sessions returned, only one has `is_current: True`
- [ ] Ensure session expiry: `GET /settings/sessions` filters out sessions where `expires_at <= now()` — expired sessions not shown even if not explicitly revoked
- 📐 Schema: `meetio-db-schema.md#2-sessions`
- Status: [ ] TODO

---

### Task 3.3: Backend — Login History [MVP]

- [ ] In every successful sign-in handler (email/password, Google, 2FA): call `record_login_event(user_id, request)` helper
- [ ] Implement `record_login_event(user_id: str, request: Request)` in `backend/app/services/auth_service.py`: build event dict `{event: "signin", user_agent, ip_anonymised, city, country, created_at}`; call `redis_client.zadd(f"login_history:{user_id}", {json.dumps(event): unix_timestamp})`
- [ ] After `zadd`: call `redis_client.zremrangebyscore(f"login_history:{user_id}", "-inf", unix_timestamp - 90 * 86400)` to evict entries older than 90 days on every write
- [ ] Implement `GET /v1/settings/login-history`: `ZRANGEBYSCORE` with `limit` and `cursor` (score-based), parse JSON values, return list newest-first
- [ ] Write integration test: sign in 3 times → `GET /settings/login-history` → 3 events, sorted newest-first, all have `created_at` within last minute
- [ ] Write integration test: insert entry with timestamp 91 days ago → next sign-in → 91-day-old entry evicted from sorted set
- Status: [ ] TODO

---

### Task 3.4: Frontend — Sessions API Service [MVP]

- [ ] Create `frontend/src/lib/settingsApi.ts`: export `getSessions()` → `GET /v1/settings/sessions`, returns `{sessions: Session[]}` where `Session = {session_id, device_info, created_at, last_used_at, is_current}`
- [ ] Export `revokeSession(id: string)` → `DELETE /v1/settings/sessions/{id}` — returns `204`; on error re-throw with typed error code
- [ ] Export `getLoginHistory(cursor?: string)` → `GET /v1/settings/login-history?cursor={cursor}` — returns `{items, has_more, next_cursor}`
- [ ] Add WebSocket message handler for `session.revoked` in `frontend/src/hooks/useWebSocket.ts`: check `event.payload.session_id === currentSessionId` (read `currentSessionId` from `authStore`) — if match: call `authStore.logout()` then `window.location.href = "/signin"`
- [ ] Write Vitest test: dispatch `session.revoked` with matching session_id → `authStore.user` becomes null
- Status: [ ] TODO

---

### Task 3.5: Frontend — Sessions UI in Settings [MVP]

- [ ] Create `frontend/src/components/settings/SessionsSection.tsx`: on mount call `getSessions()`, show loading skeleton while fetching, error state "Failed to load sessions — [Retry]" on failure
- [ ] Render each session as a card: device icon (desktop/mobile based on user agent), browser + OS parsed from user agent, city + country, "Last active {relative time}", "Current session" badge if `is_current`
- [ ] [Revoke] button per non-current session: on click show confirm dialog "Sign out of this device?", on confirm call `revokeSession(id)`, optimistically remove from list, show error toast on API failure and re-add
- [ ] Cannot revoke current session — hide [Revoke] button for `is_current: True` row; tooltip "This is your current session" on hover
- [ ] Create `frontend/src/components/settings/LoginHistorySection.tsx`: render table with columns: Event, Device, Location, Date/Time; infinite scroll — load more on scroll to bottom via `getLoginHistory(cursor)`
- [ ] Empty state: "No login history yet" centred in table body; error state: "Failed to load history"
- Status: [ ] TODO

### Task 3.5.1: Frontend — Resend OTP on Password Reset Page [MVP]
- [ ] On the password reset page (`frontend/src/pages/auth/ForgotPasswordPage.tsx` or similar):
    - [ ] Implement a "Resend OTP" button.
    - [ ] Implement a client-side cooldown (e.g., 60 seconds) before the button becomes active again, to prevent immediate re-requests. Display a countdown timer.
    - [ ] On button click, call the `POST /v1/auth/password/forgot/resend` endpoint with the user's email.
    - [ ] Handle success and error states (e.g., display a toast notification, handle `TOO_MANY_REQUESTS` status code).
- [ ] Write Vitest test for the "Resend OTP" button:
    - [ ] Test button disabled state during cooldown.
    - [ ] Test successful API call and cooldown reset.
    - [ ] Test rate-limit error handling.
- Status: [ ] TODO


---

## Summary

| MVP Tasks    | 7      | 0         | 7         |
| Future Tasks | 0      | 0         | 0         |
| **Total**    | **7**  | **0**     | **7**     |

## Execution Order

1. **Backend Foundation:** 3.1 (Session service — device info, concurrent sessions)
2. **Backend APIs:** 3.1.1 → 3.2 → 3.3 (Resend OTP → Sessions endpoints → Login history)
3. **Frontend Service Layer:** 3.4 (Sessions API + WebSocket handler)
4. **Frontend UI:** 3.5 → 3.5.1 (Sessions section + Login history in Settings → Resend OTP UI)
