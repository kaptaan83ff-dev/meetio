# Task Breakdown: Session Management

**Feature:** Feature 3 from MVP Roadmap
**Estimated Time:** 6–8 hours
**Priority:** THIRD — depends on Feature 2 (Authentication) being complete; `sessions` collection and `DatabaseStrategy` must exist
**Status:** [ ] Not started

---

## Feature 3: Session Management

---

### Task 3.1: Backend - Session Document Service [MVP]

- [ ] Create `backend/app/services/session_service.py` with `async def get_active_sessions(user_id: str, db) -> list[dict]`: query `sessions` collection `{user_id: user_id, is_revoked: False, expires_at: {$gt: datetime.utcnow()}}`, project `{_id, device_info, created_at, last_used_at, expires_at}` — exclude `refresh_token_hash` from projection (never expose raw or hashed token in API responses)
- [ ] Add `async def mark_session_current(sessions: list[dict], current_session_id: str) -> list[dict]`: iterate sessions, set `is_current: True` on the document whose `_id == current_session_id`, `False` on all others — `current_session_id` is extracted from the JWT payload of the current request's access token
- [ ] Implement device info capture helper `extract_device_info(request: Request) -> dict`: extract `user_agent` from `request.headers.get("User-Agent", "")`, anonymise last octet of `request.client.host` (replace final octet with `"x"` using regex `r"\.\d+$"` → `".x"`), set `city: None` and `country: None` by default (geo lookup is an optional future enhancement); never let any enrichment block response
- [ ] Ensure every sign-in call (both `POST /v1/auth/login` and `GET /v1/auth/google/callback`) invokes `extract_device_info` via the `on_after_login` hook in `UserManager` (Feature 2 stub) and updates the newly created `sessions` document with the captured `device_info` — `DatabaseStrategy` creates the document; the hook enriches it
- [ ] Write unit test `tests/test_session_service.py`: IP anonymisation `"103.21.44.55"` → `"103.21.44.x"`, IPv6 input returns unchanged (best-effort), `extract_device_info` always returns `{city: None, country: None}` without raising; `mark_session_current` correctly flags exactly one session as `is_current: True`
- [ ] Write integration test: login twice from different user-agents → `get_active_sessions` returns 2 documents, each with correct `device_info`, exactly one marked `is_current: True`
- 📐 Schema: `docs/requirements/meetio-db-schema.md#2-sessions`
- Status: [ ] TODO

---

### Task 3.2: Backend - Session Management APIs [MVP]

- [ ] Create `backend/app/routers/settings.py` with `router = APIRouter(prefix="/settings", tags=["Settings"])` (mounted under `v1_router`, so all paths are `/v1/settings/...`): implement `GET /v1/settings/sessions` → call `session_service.get_active_sessions(current_user.id, db)`, then `mark_session_current(sessions, current_session_id)`, return `200 {data: {sessions: [...]}}` per API spec §7; each item includes `session_id, device_info, created_at, last_used_at, is_current`
- [ ] Implement `DELETE /v1/settings/sessions/{id}`: verify `sessions.user_id == current_user.id`, raise `HTTPException(403, {code: "FORBIDDEN"})` if mismatch; update `sessions.$set {is_revoked: True}`; return `204 No Content`; raise `404 NOT_FOUND` if session document not found
- [ ] Add check in `DELETE /v1/settings/sessions/{id}`: if `id == current_session_id`, raise `403 FORBIDDEN` with `message: "Cannot revoke your own current session — use POST /v1/auth/logout instead"` — prevents user from locking themselves out via the sessions list UI
- [ ] Invalidate `user:profile:{user_id}` Redis cache key after session revocation — ensures subsequent `GET /v1/settings/sessions` reflects the change without serving stale data (though sessions are not cached, the pattern ensures consistency if caching is added later)
- [ ] Write integration test `tests/test_sessions_api.py`: GET `/v1/settings/sessions` returns only non-revoked, non-expired sessions; DELETE own current session → 403; DELETE another user's session → 403; DELETE valid other session → 204, `is_revoked: True` in DB
- [ ] Write integration test: DELETE session with expired `expires_at` → session not returned in GET, 404 on DELETE attempt — TTL index ensures expired sessions are gone, but handle the case where MongoDB TTL cleanup hasn't run yet by filtering in the query
- 📐 Schema: `docs/requirements/meetio-db-schema.md#2-sessions`
- Status: [ ] TODO

---

### Task 3.3: Backend - WebSocket Session Revocation [MVP]

- [ ] In `DELETE /v1/settings/sessions/{id}` handler, after setting `is_revoked: True`, publish a WebSocket event to Redis channel `ws:user:{target_user_id}`: payload `{type: "session.revoked", payload: {session_id: id}}` — publish via `redis_client.publish(channel, json.dumps(event))`; this fan-out is handled by `ConnectionManager` (Feature 14), but the publish call must exist here in Feature 3
- [ ] Create stub `backend/app/websocket/manager.py` with `class ConnectionManager`: `async def broadcast_to_user(self, user_id: str, event: dict)`: call `await redis_client.publish(f"ws:user:{user_id}", json.dumps(event))` — full implementation is in Feature 14; this stub allows Feature 3 to publish events that clients will receive once WebSocket is connected
- [ ] Add `connection_manager = ConnectionManager()` singleton in `main.py` — imported by all routers that need to publish WebSocket events; avoids circular imports by instantiating at app level
- [ ] Document in `session_service.py` that `session.revoked` event delivery is best-effort: if Redis is unavailable, log the error at `WARNING` level but do NOT rollback the DB revocation — the session is revoked in DB regardless; the client will discover revocation on next API call (401) even if WebSocket event is lost
- [ ] Write integration test: revoke a session → assert `redis_client.publish` was called with correct channel `ws:user:{user_id}` and payload `{type: "session.revoked", session_id: ...}` — mock Redis publish in test, verify call args; assert DB revocation happens even if publish raises `ConnectionError`
- Status: [ ] TODO

---

### Task 3.4: Backend - Login History (Redis Sorted Set) [MVP]

- [ ] In `UserManager.on_after_login` hook, after capturing device info: `await redis_client.zadd(f"login_history:{user_id}", {json.dumps(event): timestamp})` where `timestamp = time.time()` (Unix float) and `event = {event: "signin", user_agent, ip_anonymised, city, country, created_at: iso_now}` — use `ZADD NX` to prevent overwriting (each login is a unique score key)
- [ ] Implement TTL eviction on every write: immediately after `zadd`, call `await redis_client.zremrangebyscore(f"login_history:{user_id}", "-inf", time.time() - (90 * 86400))` — removes events older than 90 days to keep the sorted set bounded; O(log N + M) cost per write, acceptable for a settings endpoint
- [ ] Implement `GET /v1/settings/login-history` in `backend/app/routers/settings.py`: call `ZRANGEBYSCORE login_history:{user_id} -inf +inf WITHSCORES`, parse each JSON value, sort by timestamp descending, apply `limit` (default 50, max 100) and `cursor` pagination via score-based filtering (`ZRANGEBYSCORE ... LIMIT offset count`)
- [ ] Return `200 {data: {items: [{event, device_info: {city, country}, created_at}], has_more: bool}}` per API spec §7 — do NOT expose `user_agent` raw string in the response: map it to a human-readable device label `"Chrome on macOS"` using `user-agents` Python library; fallback to `"Unknown device"` on parse failure
- [ ] Write integration test `tests/test_login_history.py`: 3 sign-ins → GET `/v1/settings/login-history` returns 3 events in reverse chronological order; events older than 90 days are excluded (mock `time.time()` to simulate age); `limit=1` → `has_more: True` with correct cursor; `limit=1, cursor=<second>` → returns second event only
- [ ] Write unit test: TTL eviction — after `zadd`, entries with score < 90 days ago are removed; `ZADD` with duplicate timestamp — unique key prevents overwrite (each event JSON string is unique due to `created_at`)
- Status: [ ] TODO

---

### Task 3.5: Frontend - Sessions & History API Service Layer [MVP]

- [ ] Create `frontend/src/lib/sessionApi.ts` exporting: `getSessions(): Promise<SessionListResponse>` → `GET /v1/settings/sessions`; `revokeSession(sessionId: string): Promise<void>` → `DELETE /v1/settings/sessions/{id}`; `getLoginHistory(limit?: number, cursor?: string): Promise<LoginHistoryResponse>` → `GET /v1/settings/login-history` — all via `apiRequest` from `apiClient.ts`
- [ ] Define TypeScript types in `frontend/src/types/session.ts`: `Session: {session_id, device_info: {user_agent, city, country}, created_at, last_used_at, is_current}`, `LoginEvent: {event, device_info: {city, country}, created_at}`, `LoginHistoryResponse: {items: LoginEvent[], has_more: boolean}`
- [ ] Add `fetchSessions()` and `fetchLoginHistory()` actions to a new `useSettingsStore` Zustand store in `frontend/src/stores/settingsStore.ts`: state `sessions: Session[]`, `loginHistory: LoginEvent[]`, `isLoadingSessions: boolean`, `isLoadingHistory: boolean`, `sessionError: string | null`
- [ ] Implement `revokeSession(sessionId)` action in `useSettingsStore`: optimistic update — remove session from `sessions` array immediately; call `sessionApi.revokeSession(sessionId)`; on error, re-fetch sessions to restore correct state; show toast `"Session signed out"` on success
- [ ] Write unit test `tests/sessionApi.test.ts` (Vitest + MSW): `getSessions()` returns correctly typed array; `revokeSession()` calls correct DELETE endpoint; `revokeSession()` failure → store re-fetches sessions list
- Status: [ ] TODO

---

### Task 3.6: Frontend - Active Sessions UI [MVP]

- [ ] Create `frontend/src/components/settings/SessionList.tsx`: renders a list of `Session` cards; each card shows device label (parsed from `user_agent`), city + country, `last_used_at` formatted as relative time (`"2 hours ago"` via `date-fns/formatDistanceToNow`), and a `"Sign out"` button; current session card shows `"This device"` badge and no sign-out button
- [ ] Add loading skeleton: while `isLoadingSessions`, render 3 placeholder skeleton cards with `animate-pulse` — prevents layout shift when sessions load
- [ ] Show empty state: if `sessions.length === 0` (only current session signed out all others), show `"No other active sessions"` with a lock icon — never show an empty list; the current session itself is always present
- [ ] Implement revoke confirmation: on `"Sign out"` click, show an inline confirmation within the card — `"Sign out this device?"` with `"Confirm"` and `"Cancel"` buttons — prevents accidental revocations; `"Confirm"` calls `revokeSession(sessionId)` and shows a `<LoadingSpinner />` on the button during the API call
- [ ] Handle WebSocket `session.revoked` event on the current device (Feature 14 stub): listen in `useEffect` for `{type: "session.revoked", payload: {session_id}}` via the WebSocket store; if `session_id === currentSessionId`, call `useAuthStore.logout()` and navigate to `/signin` with toast `"You were signed out from this device"`
- [ ] Write unit test: `SessionList` with `is_current: true` session renders `"This device"` badge and no sign-out button; sign-out confirmation renders after button click; confirmed revoke triggers `revokeSession` action
- Status: [ ] TODO

---

### Task 3.7: Frontend - Login History UI [MVP]

- [ ] Create `frontend/src/components/settings/LoginHistory.tsx`: renders a paginated list of `LoginEvent` items; each row shows event type icon (sign-in = key icon), location as `"{city}, {country}"` (or `"Unknown location"` if null), relative time (`"3 days ago"`), and device info if available
- [ ] Implement `"Load more"` button at list bottom: visible when `has_more: true`; on click, call `getLoginHistory(limit=50, cursor=lastCursor)`, append results to existing `loginHistory` array in store — cursor-based infinite scroll; button shows spinner while loading
- [ ] Show loading skeleton on initial load (first 50 entries): 5 placeholder rows with `animate-pulse`; show `"No login history available"` empty state if `items.length === 0` after load
- [ ] Display a security notice above the list: `"Login history is retained for 90 days."` in a muted `<p>` tag — sets user expectations about data retention per GDPR disclosure
- [ ] Integrate both `SessionList` and `LoginHistory` into `frontend/src/pages/SettingsPage.tsx` (core settings page built in Feature 4): place under a `"Security"` section heading; `SessionList` first, then `LoginHistory` below — consistent with API spec §7 ordering
- [ ] Write unit test: `LoginHistory` with `has_more: false` → no `"Load more"` button; with `has_more: true` → button visible; after clicking → `getLoginHistory` called with correct cursor; null city/country → `"Unknown location"` displayed
- Status: [ ] TODO

---

## Future Tasks (Not MVP)

### Task 3.8: Backend + Frontend - Trusted Devices

- [ ] Add `is_trusted: bool = False` field to `sessions` collection document — trusted devices skip 2FA on subsequent sign-ins
- [ ] Add `"Trust this device"` checkbox to `TwoFactorPage.tsx` (Task 2.14): on successful 2FA verify, if checked, set `sessions.is_trusted = True` for the new session
- [ ] Add `TOTP_TRUSTED_DEVICE_DAYS: int = 30` setting — trusted status expires after 30 days (`expires_at` not extended, but `is_trusted` checked only within its session lifetime)
- [ ] Update `GET /v1/settings/sessions` response to include `is_trusted` field — display a shield icon on trusted device cards in `SessionList`
- [ ] Write unit test: sign in with 2FA + trust checkbox → session `is_trusted: True`; next sign-in on same device → 2FA skipped
- Status: TODO

---

## Summary

| Category     | Tasks  | Completed | Remaining |
| ------------ | ------ | --------- | --------- |
| MVP Tasks    | 7      | 0         | 7         |
| Future Tasks | 1      | 0         | 1         |
| **Total**    | **8**  | **0**     | **8**     |

## Execution Order

1. **Backend Foundation:** 3.1 (Session service — device info capture, active session query, current session detection)
2. **Backend APIs:** 3.2 (GET /v1/settings/sessions + DELETE /v1/settings/sessions/{id})
3. **Backend WebSocket Stub:** 3.3 (ConnectionManager stub + session.revoked publish)
4. **Backend Login History:** 3.4 (Redis sorted set writes, GET /v1/settings/login-history, TTL eviction)
5. **Frontend Service Layer:** 3.5 (sessionApi.ts + useSettingsStore)
6. **Frontend UI:** 3.6 → 3.7 (SessionList component → LoginHistory component)
7. **Future Enhancements:** 3.8 (Trusted devices)
