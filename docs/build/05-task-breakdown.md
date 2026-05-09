# Task Breakdown: Meeting Creation & Management

**Feature:** Feature 5 from MVP Roadmap
**Estimated Time:** 10–12 hours
**Priority:** FIFTH — depends on Feature 1 (Infrastructure) for DB and Redis; Feature 2 (Authentication) for `current_user`; Feature 14 (WebSocket) stub for capacity warning broadcast
**Status:** [ ] Not started

---

## Feature 5: Meeting Creation & Management

---

### Task 5.1: Backend - Meeting Service (Core Logic) [MVP]

- [ ] Create `backend/app/services/meeting_service.py` with `async def generate_unique_slug(title: str | None, db) -> str`: slugify `title` using `python-slugify` (lowercase, hyphens, strip special chars); if `title` is None use `"meeting"`; append `-` + `uuid4()[:8]`; check uniqueness via `meetings.find_one({slug: candidate})`; retry up to 5 times with new UUID suffix on collision; raise `RuntimeError("Slug generation failed after 5 retries")` if all collide (astronomically unlikely — guards against DB write errors)
- [ ] Implement `async def resolve_role(meeting: dict, user_id: str) -> str`: return `"host"` if `user_id == meeting["host_user_id"]`; return `"co-host"` if `user_id in meeting["co_host_ids"]`; return `"participant"` otherwise — called on every LiveKit token generation (Feature 6+) to ensure role accuracy after reconnects; never derive role from client-supplied input
- [ ] Implement `async def get_active_participant_count(meeting_id: str, db) -> int`: query `participants` collection `{meeting_id: meeting_id, left_at: None}`; return `count_documents()` — used in max-participant enforcement; add 100ms timeout to the query to prevent slow count from blocking token generation
- [ ] Implement `async def build_share_url(slug: str) -> str`: return `f"{settings.FRONTEND_URL}/meeting/{slug}/lobby"` — centralised so that if the URL pattern changes, only this function needs updating; called at meeting creation and in `GET /meetings/{id}` response construction
- [ ] Write unit test `tests/test_meeting_service.py`: `generate_unique_slug` with title `"Product Sync!!"` → `"product-sync-{8chars}"`; None title → `"meeting-{8chars}"`; mock DB to return a collision on first attempt → second attempt succeeds with different UUID suffix; `resolve_role` → correct role for host, co-host, and participant; unknown user → `"participant"`
- [ ] Write unit test: `generate_unique_slug` — run 1000 iterations with non-colliding DB, assert all slugs are unique and match pattern `^[a-z0-9-]+-[a-f0-9]{8}$`
- 📐 Schema: `docs/requirements/meetio-db-schema.md#3-meetings`
- Status: [ ] TODO

---

### Task 5.2: Backend - Meeting Creation API [MVP]

- [ ] Implement `POST /meetings` in `backend/app/routers/meetings.py`: accept `MeetingCreateRequest` with optional `title: Optional[str] = None`, `scheduled_at: Optional[datetime] = None`, `waiting_room_enabled: bool = False`, `language: str = "en"`; require `🔑` auth
- [ ] Build `meetings` document: `_id = "mtg_" + uuid4().hex[:12]`, `slug = await generate_unique_slug(title, db)`, `host_user_id = current_user.id`, `co_host_ids = []`, `status = "scheduled"`, `max_participants = settings.MEETING_MAX_PARTICIPANTS`, `language = payload.language`, all lock fields default `False` (reactions default `True` per DB schema), all recording/recap/transcript fields `None`, `created_at = updated_at = datetime.utcnow()`
- [ ] Validate `scheduled_at`: if provided, must be ≥ `datetime.utcnow() + timedelta(minutes=5)` — raise `VALIDATION_ERROR` 422 `{field: "scheduled_at", message: "Must be at least 5 minutes in the future"}` if too soon; if not provided, set `scheduled_at = None` (instant meeting)
- [ ] Insert meeting document into DB, then call `build_share_url(slug)` and return `201 {data: {meeting_id, slug, share_url, title, status, scheduled_at, waiting_room_enabled, language, max_participants, created_at}}` per API spec §2 — must complete in < 500ms p95 (SLA from API spec); no LiveKit room is created here, only the DB record
- [ ] Write integration test `tests/test_meetings_create.py`: POST `/meetings` no title → created with `"meeting"` slug prefix; POST with title `"Product Sync"` → slug starts with `"product-sync-"`; `scheduled_at` 2 minutes in future → 422; 1 hour in future → 201; response shape matches API spec §2 exactly; `share_url` contains `"/meeting/{slug}/lobby"`; total response time < 500ms (assert via test timing)
- [ ] Write unit test: 5 consecutive POST `/meetings` calls with no title → all slugs are distinct (uniqueness under load)
- 📐 Schema: `docs/requirements/meetio-db-schema.md#3-meetings`
- Status: [ ] TODO

---

### Task 5.3: Backend - Scheduled Meeting & Calendar Event [MVP]

- [ ] When `scheduled_at` is provided in `POST /meetings`: after inserting the `meetings` document, create a `calendar_events` document — `_id = "cal_" + uuid4().hex[:12]`, `user_id = host_user_id`, `meeting_id = new_meeting_id`, `title = meeting.title or "Meeting"`, `start_at = scheduled_at`, `end_at = scheduled_at + timedelta(hours=1)`, `timezone = current_user.timezone`, `has_conflict = False`; insert into `calendar_events` collection
- [ ] Dispatch `starting_soon` Celery task with `eta`: `send_starting_soon_notification.apply_async(args=[meeting_id], eta=scheduled_at - timedelta(minutes=15))` — this is a per-meeting per-time notification; do NOT use the daily `send_due_date_reminders` Beat task (it handles only action item reminders); create stub `send_starting_soon_notification` task in `tasks/notifications.py` (full implementation in Feature 19)
- [ ] Ensure the new meeting appears in `GET /dashboard/upcoming` query: that endpoint queries `calendar_events.start_at >= now()` ordered by `start_at ASC` limit 5 — the `calendar_events` insert in this task is what populates it; write integration test confirming the new scheduled meeting appears in the upcoming query
- [ ] Handle `calendar_events` insert failure gracefully: wrap in try/except, log error at `ERROR` level, but do NOT rollback the `meetings` insert — a meeting without a calendar event is preferable to a missing meeting; the calendar event can be recreated via a future repair job
- [ ] Write integration test `tests/test_meetings_scheduled.py`: POST `/meetings` with `scheduled_at` 2h in future → `calendar_events` document created with correct `start_at`, `end_at`, `meeting_id`; Celery task `send_starting_soon_notification` enqueued with correct `eta = scheduled_at - 15min`; meeting appears in mocked `GET /dashboard/upcoming` response
- 📐 Schema: `docs/requirements/meetio-db-schema.md#3-meetings`
- Status: [ ] TODO

---

### Task 5.4: Backend - Meeting CRUD APIs [MVP]

- [ ] Implement `GET /meetings` in `meetings.py`: paginated cursor query — decode opaque `cursor` as `base64(meeting_id)`, query `meetings` where `host_user_id == current_user.id AND _id > cursor` ordered by `created_at DESC` limit `min(limit, 50)`; filter by `status` query param if provided; return summary fields only: `{meeting_id, title, status, scheduled_at, started_at, ended_at, duration_seconds, participant_count, recap_status, recording_status}`, `next_cursor`, `has_more` per API spec §2
- [ ] Implement `GET /meetings/{id}`: public fields for unauthenticated requests (no `🔑` required) — `{meeting_id, title, slug, host: {id, display_name, avatar_url}, status, waiting_room_enabled, room_locked, language, max_participants, current_participant_count, scheduled_at, started_at, ended_at, recap_status: None, recording_status: None}`; authenticated users additionally receive `recap_status` and `recording_status`; compute `current_participant_count` via `get_active_participant_count()`; raise `404 NOT_FOUND` if slug/id not found
- [ ] Implement `PUT /meetings/{id}`: require `host_user_id == current_user.id` — raise `FORBIDDEN` 403 if not host; accept optional `{title, scheduled_at, waiting_room_enabled, language}`; validate `scheduled_at` if provided (same future check as POST); update document with `$set` and `updated_at`; invalidate `meeting:info:{meeting_id}` Redis cache key; return `200` with updated meeting object
- [ ] Implement `DELETE /meetings/{id}`: require host; if `meeting.status == "in_progress"`, raise `FORBIDDEN` 403 `{message: "Cannot cancel an in-progress meeting — use end-meeting flow instead"}`; else set `status = "cancelled"`, `updated_at = now()`; invalidate Redis cache; return `204`
- [ ] Write integration test `tests/test_meetings_crud.py`: GET `/meetings` — returns only requesting user's meetings; cursor pagination — 3rd page with cursor returns next batch; PUT by non-host → 403; DELETE by non-host → 403; DELETE in-progress meeting → 403; DELETE scheduled meeting → 204, `status: "cancelled"` in DB; GET `/meetings/{id}` unauthenticated → no `recap_status` field; authenticated → `recap_status` included
- [ ] Write integration test: GET `/meetings` with `status=completed` filter → only completed meetings returned; GET `/meetings/{id}` with unknown ID → 404
- 📐 Schema: `docs/requirements/meetio-db-schema.md#3-meetings`
- Status: [ ] TODO

---

### Task 5.5: Backend - Max Participant Enforcement [MVP]

- [ ] Implement `POST /meetings/{id}/token` in `meetings.py` (LiveKit token generation — stub until LiveKit is wired in Feature 9, but enforcement logic must exist now): require `🔑` auth; call `get_active_participant_count(meeting_id, db)` — if `count >= meeting.max_participants`, raise `HTTPException(403, {code: "MEETING_FULL", message: "This meeting has reached its maximum capacity of 50 participants"})`
- [ ] Add capacity warning broadcast at 45 participants: after the count check passes, if `count + 1 == 45`, publish WebSocket event to Redis channel `ws:meeting:{meeting_id}`: `{type: "meeting.controls_changed", payload: {capacity_warning: true, current_count: 45}}` via `connection_manager.broadcast_to_meeting()` stub — this alerts the host to act before the meeting is full
- [ ] Apply same count check in `POST /meetings/{id}/join-guest` (Feature 7 route): before creating the `guest_sessions` document, call `get_active_participant_count()` and raise `MEETING_FULL` 403 if at capacity — both authenticated and guest joins respect the 50-person limit
- [ ] Cache the participant count in Redis with 10s TTL under key `meeting:participants:{meeting_id}` to avoid a DB count query on every concurrent join — invalidate on participant `left_at` update; accept 10s staleness (worst case: 10s window where count is slightly stale, bounded by the 50-person hard cap)
- [ ] Write integration test `tests/test_capacity.py`: mock `get_active_participant_count` returning 49 → token issued, no capacity warning; returning 50 → `MEETING_FULL` 403; returning 44 (so 45th join) → token issued + `meeting.controls_changed` WebSocket event published to Redis; assert `redis_client.publish` called with correct channel and payload at exactly 45
- [ ] Write unit test: Redis cache hit returns count without DB query; cache miss → DB queried, result cached; participant leaves (left_at set) → cache invalidated
- Status: [ ] TODO

---

### Task 5.6: Backend - Co-host Management API [MVP]

- [ ] Implement `POST /meetings/{id}/co-host` in `meetings.py`: require `host_user_id == current_user.id` — raise `FORBIDDEN` 403 if not host; accept `{user_id: str, action: "promote" | "demote"}`; validate `action` is one of the two allowed values; raise `VALIDATION_ERROR` 422 if not
- [ ] On `action == "promote"`: verify `user_id` is an authenticated participant in this meeting (check `participants` collection `{meeting_id, user_id, left_at: None}`) — raise `NOT_FOUND` 404 if not in meeting; add to `co_host_ids` using `$addToSet` (idempotent — no-op if already co-host); broadcast `{type: "meeting.role_changed", payload: {user_id, new_role: "co-host"}}` to `ws:meeting:{meeting_id}`
- [ ] On `action == "demote"`: remove from `co_host_ids` using `$pull`; broadcast `{type: "meeting.role_changed", payload: {user_id, new_role: "participant"}}` to `ws:meeting:{meeting_id}`; invalidate `meeting:info:{meeting_id}` Redis cache so next token request reflects updated `co_host_ids`
- [ ] On token generation (`POST /meetings/{id}/token`): call `resolve_role(meeting, current_user.id)` where `meeting` is fetched fresh from DB (not cache) — this ensures a co-host who disconnects and rejoins gets the correct role without the host needing to re-promote; the `co_host_ids` array persists indefinitely in the meeting document
- [ ] Write integration test `tests/test_cohost.py`: promote user who is not in meeting → 404; promote valid participant → `co_host_ids` contains user, WebSocket event published; demote → `co_host_ids` does not contain user; promote idempotent — promote twice → `co_host_ids` contains user once (`$addToSet`); non-host attempt → 403; disconnect + reconnect after promotion → `resolve_role` returns `"co-host"` from `co_host_ids`
- [ ] Write unit test: `resolve_role` — user in `host_user_id` → `"host"`; user in `co_host_ids` → `"co-host"`; user in `co_host_ids` AND `host_user_id` → `"host"` (host check first); unknown user → `"participant"`
- 📐 Schema: `docs/requirements/meetio-db-schema.md#3-meetings`
- Status: [ ] TODO

---

### Task 5.7: Frontend - Meetings API Service Layer [MVP]

- [ ] Create `frontend/src/lib/meetingsApi.ts` exporting: `createMeeting(payload: CreateMeetingRequest): Promise<Meeting>` → `POST /meetings`; `getMeetings(params?: {limit, cursor, status}): Promise<MeetingListResponse>` → `GET /meetings`; `getMeeting(id: string): Promise<MeetingDetail>` → `GET /meetings/{id}`; `updateMeeting(id, payload): Promise<MeetingDetail>` → `PUT /meetings/{id}`; `cancelMeeting(id): Promise<void>` → `DELETE /meetings/{id}`; `promoteCoHost(meetingId, userId): Promise<void>` and `demoteCoHost(meetingId, userId): Promise<void>` → `POST /meetings/{id}/co-host`
- [ ] Define TypeScript types in `frontend/src/types/meeting.ts`: `Meeting: {meeting_id, slug, share_url, title, status, scheduled_at, waiting_room_enabled, language, max_participants, created_at}`; `MeetingDetail: Meeting & {host, room_locked, current_participant_count, started_at, ended_at, recap_status?, recording_status?}`; `CreateMeetingRequest: {title?, scheduled_at?, waiting_room_enabled?, language?}`
- [ ] Create `frontend/src/stores/meetingStore.ts` with `useMeetingStore = create<MeetingState>()(...)`: state `meetings: Meeting[]`, `currentMeeting: MeetingDetail | null`, `isCreating: boolean`, `isLoading: boolean`, `createError: string | null`; actions `fetchMeetings()`, `createMeeting(payload)`, `cancelMeeting(id)`, `setCurrentMeeting(meeting)`
- [ ] Implement `createMeeting(payload)` action: set `isCreating: true`; call `meetingsApi.createMeeting(payload)`; on success, prepend new meeting to `meetings` array and navigate to `/meeting/{slug}/lobby`; on `VALIDATION_ERROR` 422 (invalid scheduled_at), set `createError: "Scheduled time must be at least 5 minutes in the future"`; set `isCreating: false` in finally block
- [ ] Write unit tests `tests/meetingsApi.test.ts` (Vitest + MSW): `createMeeting` returns correctly typed `Meeting`; `getMeetings` with `status` filter appends query param; `cancelMeeting` calls DELETE; `createMeeting` 422 → `createError` set in store; concurrent `createMeeting` calls — `isCreating: true` prevents double-submission
- Status: [ ] TODO

---

### Task 5.8: Frontend - Create Meeting Modal [MVP]

- [ ] Create `frontend/src/components/meetings/CreateMeetingModal.tsx`: modal triggered from dashboard `"Start"` and `"Schedule"` action cards; two tabs — `"Start now"` and `"Schedule for later"`; `"Start now"` tab: only a `title` input (optional, placeholder `"Give your meeting a name"`); `"Schedule for later"` tab: `title` input + `date` picker + `time` picker + `waiting_room_enabled` toggle
- [ ] `"Start now"` immediate path: on `"Start meeting"` button click, call `createMeeting({title: title || undefined})`; while `isCreating`, show spinner on button, disable all inputs; on success, modal closes and browser navigates to `/meeting/{slug}/lobby`
- [ ] `"Schedule for later"` path: construct `scheduled_at` ISO string from date + time picker values in the user's local timezone, convert to UTC before sending; validate on client: must be ≥5 minutes in the future — show inline `"Please choose a time at least 5 minutes from now"` if too soon; on success, show toast `"Meeting scheduled for {formatted date}"` and close modal
- [ ] Show share link immediately after creation: in the `"Start now"` success flow before navigating, briefly show `"Meeting link ready: {share_url}"` with a `"Copy link"` button for 3 seconds — allows copying the link to share with others before entering the lobby
- [ ] Write unit test: `"Start now"` submit → `createMeeting` called without `scheduled_at`; `"Schedule"` submit with past time → inline error, no API call; `"Schedule"` with future time → `createMeeting` called with UTC ISO string; `isCreating` → button disabled, spinner shown; success → modal closes, navigation triggered
- Status: [ ] TODO

---

### Task 5.9: Frontend - Meeting History List [MVP]

- [ ] Create `frontend/src/pages/MeetingsPage.tsx` at route `/meetings`: renders paginated list of user's meetings with a filter bar (`All`, `Scheduled`, `Completed`, `Cancelled`); on mount, call `fetchMeetings()` from `useMeetingStore`; show `<LoadingSpinner />` while `isLoading`
- [ ] Create `frontend/src/components/meetings/MeetingCard.tsx`: renders a single meeting row with `title`, `status` badge (color-coded: green=in_progress, blue=scheduled, gray=completed, red=cancelled), `scheduled_at` or `ended_at` formatted as `"Apr 30, 2026 at 10:00 AM"`, `duration_seconds` as `"54 min"`, participant count, and action buttons
- [ ] Action buttons per status: `scheduled` → `"Join"` (→ lobby) + `"Cancel"` (with confirm); `in_progress` → `"Join now"` (→ lobby, highlighted); `completed` → `"View recap"` (→ `/meetings/{id}/recap`) + `"Recording"` (if available, → `/meetings/{id}/recording`); `cancelled` → no actions (greyed out card)
- [ ] Implement `"Load more"` infinite scroll: detect when user scrolls within 200px of bottom using `IntersectionObserver` on a sentinel div; call `fetchMeetings({cursor: nextCursor})` when triggered; append results to existing list; hide sentinel when `has_more: false`
- [ ] Cancel meeting flow: on `"Cancel"` click, show inline confirmation `"Cancel this meeting? This cannot be undone."` with `"Yes, cancel"` / `"Keep"` buttons; on confirm, call `cancelMeeting(id)`; on success, update meeting `status` to `"cancelled"` in store without re-fetching the full list (optimistic update)
- [ ] Write unit test: `MeetingCard` with `status: "completed"` shows `"View recap"` button; `status: "in_progress"` shows `"Join now"` button; cancel confirm flow — click `"Cancel"` → confirmation shows; click `"Keep"` → no API call; click `"Yes, cancel"` → `cancelMeeting` called
- Status: [ ] TODO

---

### Task 5.10: Frontend - Meeting Detail & Share Link UI [MVP]

- [ ] Create `frontend/src/components/meetings/MeetingShareLink.tsx`: accepts `shareUrl: string`; renders the share URL in a read-only `<input>` with a `"Copy link"` icon button; on copy, calls `navigator.clipboard.writeText(shareUrl)` and briefly changes button icon to a checkmark for 2s; falls back to `document.execCommand("copy")` if `navigator.clipboard` is unavailable (non-HTTPS contexts)
- [ ] Create `frontend/src/components/meetings/MeetingInfoPanel.tsx`: shows meeting metadata: host name + avatar, participant count, language, `waiting_room_enabled` badge, scheduled time; used in the lobby page (Feature 6) and the meeting detail view
- [ ] Implement `PUT /meetings/{id}` integration in `MeetingInfoPanel`: host sees inline `"Edit"` button that toggles the panel to edit mode — title becomes a text input, `waiting_room_enabled` becomes a toggle, `scheduled_at` becomes a datetime picker; on save call `updateMeeting(id, payload)`; on success update `currentMeeting` in store without re-fetching; non-host sees read-only panel
- [ ] Share link tooltip: on hover over the share URL input, show a tooltip `"Share this link with participants — no account required to join as a guest"` — educates users about the guest join flow (Feature 7)
- [ ] Write unit test: `MeetingShareLink` copy button → `navigator.clipboard.writeText` called with correct URL; icon changes to checkmark after copy; 2s later icon reverts; clipboard API unavailable → `execCommand` fallback invoked; `MeetingInfoPanel` for non-host → no edit button
- Status: [ ] TODO

---

## Future Tasks (Not MVP)

### Task 5.11: Backend + Frontend - Recurring Meetings

- [ ] Add `recurrence: Optional[dict]` field to `meetings` collection: `{frequency: "daily" | "weekly" | "monthly", interval: int, end_date: Optional[datetime], parent_meeting_id: Optional[str]}`
- [ ] Implement `POST /meetings` with `recurrence` parameter: create a parent meeting and N child meeting documents per recurrence rule (cap at 52 occurrences); create linked `calendar_events` for each occurrence
- [ ] Add `"Recurrence"` section to `CreateMeetingModal.tsx`: repeat dropdown (`None`, `Daily`, `Weekly`, `Monthly`), end-date picker, occurrence preview list
- [ ] Implement `PUT /meetings/{id}?update_scope=this|this_and_future|all`: support editing single occurrence or all future occurrences in a recurring series
- [ ] Write integration tests covering recurrence creation, edit scope, and cancellation of a single occurrence
- Status: TODO

### Task 5.12: Backend + Frontend - Meeting Templates

- [ ] Add `meeting_templates` collection to DB schema: `{user_id, template_name, default_title, waiting_room_enabled, language, created_at}` — saves frequently used settings
- [ ] Implement `POST /meeting-templates`, `GET /meeting-templates`, `DELETE /meeting-templates/{id}` endpoints with host auth; enforce a max of 10 templates per user with `LIMIT_EXCEEDED` 429 error
- [ ] Add `"Save as template"` button to `CreateMeetingModal.tsx` after a meeting is created; render saved templates as quick-select presets in the modal that pre-fill all form fields on selection
- [ ] Add template management UI in `SettingsPage.tsx` under a `"Meeting Templates"` section: list existing templates with delete buttons; clicking a template opens `CreateMeetingModal` pre-filled with its values
- [ ] Write integration tests: create template → appears in GET list; select template in modal → fields pre-filled; delete template → removed from list; 11th template creation → 429
- Status: TODO

---

## Summary

| Category     | Tasks   | Completed | Remaining |
| ------------ | ------- | --------- | --------- |
| MVP Tasks    | 10      | 0         | 10        |
| Future Tasks | 2       | 0         | 2         |
| **Total**    | **12**  | **0**     | **12**    |

## Execution Order

1. **Backend Foundation:** 5.1 (Meeting service — slug generation, resolve_role, participant count helper, share URL builder)
2. **Backend Creation:** 5.2 → 5.3 (POST /meetings instant + scheduled → Calendar event + Celery eta task)
3. **Backend CRUD:** 5.4 (GET /meetings, GET /meetings/{id}, PUT /meetings/{id}, DELETE /meetings/{id})
4. **Backend Enforcement:** 5.5 → 5.6 (Max participant check + capacity warning → Co-host promote/demote API)
5. **Frontend Service Layer:** 5.7 (meetingsApi.ts + TypeScript types + useMeetingStore)
6. **Frontend Core UI:** 5.8 → 5.9 (Create meeting modal → Meeting history list + MeetingCard)
7. **Frontend Detail UI:** 5.10 (Share link component + Meeting info panel + inline edit)
8. **Future Enhancements:** 5.11 → 5.12 (Recurring meetings → Meeting templates)
