# Task Breakdown: Meeting Creation & Management

**Feature:** #5 from MVP Roadmap
**Estimated Time:** 10–13 hours total
**Priority:** FIFTH — core product feature, depends on Feature 2 (Auth)
**Status:** [ ] Not Started

---

## Feature 5: Meeting Creation & Management

---

### Task 5.1: Backend — Meeting Model & Schemas [MVP]

- [ ] Create `backend/app/models/meeting.py`: `MeetingDocument` TypedDict with all fields from `meetio-db-schema.md#3-meetings` — `_id`, `title`, `slug`, `host_user_id`, `co_host_ids`, `max_participants`, `status`, `waiting_room_enabled`, `room_locked`, `language`, `locks`, `recording_enabled`, `recording_status`, `recording_r2_key`, `recap_status`, `transcript_status`, `feedback_ratings`, `feedback_tags`, `scheduled_at`, `started_at`, `ended_at`, `duration_seconds`, `schema_version`
- [ ] Create `backend/app/schemas/meeting.py`: `CreateMeetingRequest(title: str | None, scheduled_at: datetime | None, waiting_room_enabled: bool = False, language: str = "en")` with `@field_validator("scheduled_at")` raising `ValueError` if value is in the past
- [ ] Create `UpdateMeetingRequest(title: str | None, scheduled_at: datetime | None, waiting_room_enabled: bool | None, language: str | None)` — all optional
- [ ] Create `MeetingResponse` with all public fields; `MeetingDetailResponse` extending with auth-only fields (`recap_status`, `recording_status`, `current_participant_count`)
- [ ] Create `MeetingListItem` for paginated history responses — summary fields only
- [ ] Write unit test: `CreateMeetingRequest` with `scheduled_at` = 1 hour ago raises `ValidationError`; future `scheduled_at` passes
- 📐 Schema: `meetio-db-schema.md#3-meetings`
- Status: [ ] TODO

---

### Task 5.2: Backend — Meeting Repository [MVP]

- [ ] Create `backend/app/repositories/meeting_repo.py`: `create(data: dict) -> str` — insert meeting document, return `_id`
- [ ] Add `get_by_id(meeting_id: str) -> MeetingDocument | None`; `get_by_slug(slug: str) -> MeetingDocument | None`
- [ ] Add `update(meeting_id: str, update: dict)` — `$set` partial update, update `updated_at: now()`, invalidate `meeting:info:{meeting_id}` Redis cache
- [ ] Add `list_for_user(user_id: str, status: str | None, limit: int, cursor: str | None) -> tuple[list, str | None]` — cursor-based pagination on `created_at` descending using `_id` as cursor; filter by `host_user_id == user_id OR participants.user_id == user_id`
- [ ] Add `count_active_participants(meeting_id: str) -> int` — count `participants` documents where `meeting_id` matches and `left_at` is null
- [ ] Write integration test: create 3 meetings → `list_for_user(limit=2)` → 2 items + cursor; fetch next page with cursor → 1 item + no cursor
- 📐 Schema: `meetio-db-schema.md#3-meetings`
- Status: [ ] TODO

---

### Task 5.3: Backend — Meeting Service [MVP]

- [ ] Create `backend/app/services/meeting_service.py`: `generate_slug(title: str | None) -> str` — `slugify(title or "meeting")[:30] + "-" + uuid4().hex[:8]`; check uniqueness with `meeting_repo.get_by_slug(slug)` — retry up to 3 times with new UUID suffix; raise `InternalError` after 3 collisions
- [ ] Add `resolve_role(meeting: MeetingDocument, user_id: str) -> str` — return `"host"` if `user_id == meeting.host_user_id`, `"co-host"` if `user_id in meeting.co_host_ids`, else `"participant"`
- [ ] Add `enforce_capacity(meeting_id: str)` — call `meeting_repo.count_active_participants(meeting_id)`, raise `HTTPException(403, "MEETING_FULL")` if >= `settings.MEETING_MAX_PARTICIPANTS`; if count == 45: dispatch capacity warning WebSocket event
- [ ] Add `generate_livekit_token(user_id, display_name, room_name, role) -> str` using `livekit.api.AccessToken` — server-side only, never called from frontend
- [ ] Write unit test: `generate_slug("Hello World!")` → lowercase, hyphens, ends with 8-char hex; retry logic passes
- [ ] Write unit test: `resolve_role()` — host returns "host", co_host_ids member returns "co-host", other returns "participant"
- Status: [ ] TODO

---

### Task 5.4: Backend — Meeting CRUD Endpoints [MVP]

- [ ] Create `backend/app/routers/meetings.py`: `POST /v1/meetings` — auth required; call `meeting_service.generate_slug()`; insert `meetings` document; return `MeetingResponse` with `201`; p95 < 500ms (no LiveKit room created at this point)
- [ ] Add `GET /v1/meetings` — auth required; cursor-paginated history; optional `status` filter; return `{items: [MeetingListItem], next_cursor, has_more}`
- [ ] Add `GET /v1/meetings/{id}` — auth required (v1); check Redis cache `meeting:info:{id}` first; return `MeetingDetailResponse` with `current_participant_count`
- [ ] Add `PUT /v1/meetings/{id}` — auth + host only (verify `meeting.host_user_id == current_user.id` else 403); validate `UpdateMeetingRequest`; call `meeting_repo.update()`; return updated `MeetingDetailResponse`
- [ ] Add `DELETE /v1/meetings/{id}` — auth + host only; reject if `meeting.status == "in_progress"` with `FORBIDDEN` 403 "Cannot cancel an in-progress meeting"; set `status = "cancelled"`; return `204`
- [ ] Write integration test: non-host `PUT /meetings/{id}` → 403; in-progress `DELETE /meetings/{id}` → 403; valid delete → 204 + status "cancelled"
- Status: [ ] TODO

---

### Task 5.5: Backend — co_host_ids & Capacity Endpoints [MVP]

- [ ] Add `POST /v1/meetings/{id}/co-host` — auth + host only (reject if `current_user.id != meeting.host_user_id`); validate `{user_id: str, action: "promote" | "demote"}`
- [ ] On promote: `$addToSet co_host_ids: user_id`; broadcast `meeting.role_changed` WebSocket event `{user_id, new_role: "co-host"}` via `broadcast_to_meeting()`
- [ ] On demote: `$pull co_host_ids: user_id`; broadcast `meeting.role_changed` `{user_id, new_role: "participant"}`
- [ ] Add `POST /v1/meetings/{id}/feedback`: validate `{rating: int (1-5), tags: list[str]}`; `$push` rating and tags to `meetings.feedback_ratings` and `meetings.feedback_tags`; return `200` — idempotent (multiple submits just add more ratings)
- [ ] Write integration test: promote user → `co_host_ids` contains user_id + `meeting.role_changed` event broadcast; demote → removed from array + event broadcast
- [ ] Write integration test: feedback submitted → DB updated with `$push`
- Status: [ ] TODO

---

### Task 5.6: Frontend — Meetings API Service [MVP]

- [ ] Create `frontend/src/lib/meetingsApi.ts`: export `createMeeting(data: CreateMeetingInput)` → `POST /v1/meetings`; `getMeeting(id: string)` → `GET /v1/meetings/{id}`; `listMeetings(params)` → `GET /v1/meetings` with query params
- [ ] Export `updateMeeting(id, data)` → `PUT /v1/meetings/{id}`; `cancelMeeting(id)` → `DELETE /v1/meetings/{id}`
- [ ] Export `getMeetingToken(id)` → `POST /v1/meetings/{id}/token` — returns `{livekit_token, livekit_url, role, meeting}`; handle `MEETING_FULL` 403 → throw `MeetingFullError`; handle `MEETING_LOCKED` 403 → throw `MeetingLockedError`
- [ ] Export `promoteCoHost(meetingId, userId)` → `POST /v1/meetings/{id}/co-host {user_id, action: "promote"}`; `demoteCoHost(meetingId, userId)` → same with `action: "demote"`
- [ ] Export `submitFeedback(meetingId, rating, tags)` → `POST /v1/meetings/{id}/feedback`
- Status: [ ] TODO

---

### Task 5.7: Frontend — Schedule Meeting Modal [MVP]

- [ ] Create `frontend/src/components/meetings/ScheduleMeetingModal.tsx`: modal with title input (optional, placeholder "Untitled Meeting"), date picker, time picker, timezone display (read from `authStore.user.timezone`), waiting room toggle, [Schedule] button
- [ ] On [Schedule]: call `createMeeting({title, scheduled_at, waiting_room_enabled})` — show spinner; on success close modal, navigate to `/dashboard`, show success toast "Meeting scheduled — [Copy link]"
- [ ] "Copy link" toast action: copy `meeting.share_url` to clipboard via `navigator.clipboard.writeText()`; toast changes to "Copied!" for 2 seconds
- [ ] Error: if `scheduled_at` is in the past (server returns 422) → "Please choose a future time"
- [ ] Date/time pickers: min date = today; combined datetime stored as UTC before sending to API
- [ ] [Cancel] button dismisses modal without creating meeting
- Status: [ ] TODO

---

### Task 5.8: Frontend — Meeting History Page [MVP]

- [ ] Create `frontend/src/pages/MeetingHistoryPage.tsx` at `/meetings` (accessible from nav): fetch `listMeetings({status: "completed", limit: 20})` on mount — loading skeleton of 5 cards while fetching
- [ ] Meeting card: title, formatted date (Apr 29 · 10:00 AM), duration ("52 min"), participant count, recap status chip (`ready` = green "Recap ready", `processing` = yellow "Processing...", `failed` = red "Failed · Retry"), recording status chip
- [ ] Click card → navigate to meeting detail page (v1)
- [ ] Filter tabs: [All] [Hosted] [Participated] — change query params, refetch (Tabs UI implemented)
- [ ] Infinite scroll: `IntersectionObserver` on last card → call `listMeetings({cursor: next_cursor})` → append to list
- [ ] Empty state: "No meetings yet. [Start your first meeting]" with CTA button
- Status: [ ] TODO

---

## Summary

| Category     | Tasks  | Completed | Remaining |
| ------------ | ------ | --------- | --------- |
| MVP Tasks    | 8      | 0         | 8         |
| Future Tasks | 0      | 0         | 0         |
| **Total**    | **8**  | **0**     | **8**     |

## Execution Order

1. **Backend Foundation:** 5.1 → 5.2 (Model → Repository)
2. **Backend Services:** 5.3 (Slug generation, role resolution, capacity)
3. **Backend APIs:** 5.4 → 5.5 (CRUD → co-host/capacity)
4. **Frontend Service Layer:** 5.6 (Meetings API)
5. **Frontend UI:** 5.7 → 5.8 (Schedule modal → History page)
