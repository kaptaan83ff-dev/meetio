# Task Breakdown: In-Meeting Chat

**Feature:** #8 from MVP Roadmap
**Estimated Time:** 6–8 hours total
**Priority:** EIGHTH — depends on Feature 7 (In-Meeting)
**Status:** [ ] Not started

---

## Feature 8: In-Meeting Chat

---

### Task 8.1: Backend — Chat Model & Repository [MVP]

- [ ] Create `backend/app/models/chat.py`: `ChatMessageDocument` TypedDict with all fields from `meetio-db-schema.md#14-chat_messages` — `_id`, `meeting_id`, `sender_id`, `sender_session_id`, `display_name`, `is_guest`, `content`, `deleted`, `deleted_at`, `deleted_by`, `created_at`, `purge_at`, `schema_version`
- [ ] Create `backend/app/repositories/chat_repo.py`: `create(data: dict) -> str` — insert document, return `_id`
- [ ] Add `get_by_meeting(meeting_id: str, limit: int = 200, cursor: str | None = None) -> tuple[list, str | None]` — query `{meeting_id}` sorted `created_at: 1`, cursor on `_id`; include soft-deleted with `deleted: true` flag intact
- [ ] Add `soft_delete(chat_id: str, deleted_by: str)` — `$set {deleted: True, deleted_at: now(), deleted_by: deleted_by}`
- [ ] Add `set_purge_at_for_meeting(meeting_id: str, purge_at: datetime)` — bulk `update_many({meeting_id}, {$set: {purge_at}})`; called from `room_finished` webhook handler
- [ ] Write integration test: insert 5 messages → `get_by_meeting()` → 5 returned sorted by `created_at`; soft delete one → still returned with `deleted: True`
- 📐 Schema: `meetio-db-schema.md#14-chat_messages`
- Status: [ ] TODO

---

### Task 8.2: Backend — Chat API Endpoints [MVP]

- [ ] Add `GET /v1/meetings/{id}/chat` to `backend/app/routers/meetings.py`: auth required; call `chat_repo.get_by_meeting(meeting_id, limit, cursor)`; return `{messages: [...], next_cursor, has_more}`
- [ ] Add `POST /v1/meetings/{id}/chat`: no auth required — identify sender: if `access_token` cookie present decode and use `current_user.id`; else require `session_token` in body and look up `guest_sessions`; raise 403 if neither; validate `{content: str}` max 2000 chars; call `chat_repo.create()`; broadcast `meeting.chat.message` WebSocket event via `manager.broadcast_to_meeting()` with `{chat_id, sender_id, display_name, content, is_guest, created_at}`; return `{chat_id, created_at}` with `201`
- [ ] Add `DELETE /v1/meetings/{id}/chat/{chat_id}`: auth required; fetch message; if `sender_id != current_user.id` AND `resolve_role(meeting, current_user.id) not in ("host", "co-host")` → raise `FORBIDDEN` 403; call `chat_repo.soft_delete()`; broadcast `meeting.chat.deleted` event `{meeting_id, chat_id}`; return `204`
- [ ] In `room_finished` webhook handler: call `chat_repo.set_purge_at_for_meeting(meeting_id, ended_at + timedelta(hours=24))`
- [ ] Write integration test: auth user deletes own message → 204 + `deleted: True` in DB; auth user deletes other's message → 403; host deletes any message → 204
- Status: [ ] TODO

---

### Task 8.3: Backend — Chat Purge Task [MVP]

- [ ] In `backend/app/tasks/gdpr.py` `purge_expired_guest_data()` task: after purging `guest_sessions`, also run `db.chat_messages.delete_many({purge_at: {$lte: now()}})`
- [ ] Ensure `{purge_at: 1}` index exists on `chat_messages` collection — verify in migration `002_indexes.js`
- [ ] Log structured: `logger.info("chat.purge_complete", count=result.deleted_count, timestamp=now())` via structlog
- [ ] Write unit test: insert 3 chat_messages — 2 with `purge_at` in the past, 1 in the future; run purge → 2 deleted, 1 preserved
- [ ] Write integration test: `room_finished` webhook → all `chat_messages` for meeting have `purge_at = ended_at + 24h`
- Status: [ ] TODO

---

### Task 8.4: Frontend — Chat Panel [MVP]

- [ ] Create `frontend/src/components/meeting/ChatPanel.tsx`: right sidebar `w-80`, toggled by chat button in controls bar (`uiStore.isChatOpen`); rendered inside `MeetingRoomPage` but outside `<SpeakerView />`
- [ ] On mount: call `GET /v1/meetings/{id}/chat` — render existing messages; auto-scroll to bottom after load; show loading skeleton while fetching
- [ ] Message list: each message row — avatar initial (coloured by hash of display_name), display name + "Guest" badge if `is_guest`, timestamp (relative: "2m ago"), message content; deleted messages rendered as `[deleted]` in grey italic; no action buttons for deleted messages
- [ ] Own messages: right-aligned with [Delete] button on hover; others' messages: left-aligned; host/co-host see [Delete] on all messages
- [ ] Compose area: `<textarea>` (resize: none, max-height 100px auto-grow), send on Enter (Shift+Enter = newline), [Send] button; disabled + tooltip if `meeting.locks.chat === true`
- [ ] On send: call `POST /v1/meetings/{id}/chat` — for guests include `session_token` from router state; optimistically append message to list immediately; on error: remove optimistic message + show inline error "Failed to send — [Retry]"
- Status: [ ] TODO

---

### Task 8.5: Frontend — Chat WebSocket Handlers [MVP]

- [ ] In `frontend/src/hooks/useWebSocket.ts`: handle `meeting.chat.message` event — call `appendChatMessage(event.payload)` (add to chat panel message list); auto-scroll to bottom if user is already at bottom (within 50px of bottom); if user scrolled up: show "New message ↓" floating badge
- [ ] Handle `meeting.chat.deleted` event — find message by `chat_id` in list, replace `content` with `"[deleted]"`, set `deleted: true`, update `display_name` to "[deleted]"
- [ ] "New message ↓" badge: `<button className="absolute bottom-16 left-1/2">` — click scrolls to bottom and dismisses badge; auto-dismisses when user scrolls to bottom
- [ ] Chat unread count: when `isChatOpen === false`, increment unread counter on `meeting.chat.message` event; show badge on chat button in controls bar; reset to 0 when panel opened
- [ ] Write Vitest test: dispatch `meeting.chat.deleted` event → message in list updates to `[deleted]` content
- Status: [ ] TODO

---

## Summary

| Category     | Tasks | Completed | Remaining |
| ------------ | ----- | --------- | --------- |
| MVP Tasks    | 5     | 0         | 5         |
| Future Tasks | 0     | 0         | 0         |
| **Total**    | **5** | **0**     | **5**     |

## Execution Order

1. **Backend Foundation:** 8.1 (Chat model + repository)
2. **Backend APIs:** 8.2 → 8.3 (Chat endpoints → Purge task)
3. **Frontend UI:** 8.4 (Chat panel component)
4. **Frontend Real-time:** 8.5 (WebSocket handlers + unread badge)
   ENDOFFILE
