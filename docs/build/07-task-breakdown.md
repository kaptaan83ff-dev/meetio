# Task Breakdown: In-Meeting Experience

**Feature:** #7 from MVP Roadmap
**Estimated Time:** 18–22 hours total
**Priority:** SEVENTH — core video experience, depends on Features 5 & 6
**Status:** [ ] Not started

---

## Feature 7: In-Meeting Experience

---

### Task 7.1: Backend — LiveKit Webhook Handler [MVP]

- [ ] Create `backend/app/routers/webhooks.py`: `POST /webhooks/livekit` — read raw body + `Authorization` header; verify signature with `WebhookReceiver(settings.LIVEKIT_API_KEY, settings.LIVEKIT_API_SECRET).receive(body, auth_token)`; return `200` immediately; dispatch to `handle_livekit_event(event)` async
- [ ] Implement `handle_livekit_event`: `room_started` → `meeting_repo.update(slug, {status: "in_progress", started_at: now()})`; `room_finished` → update `status: "completed"`, `ended_at: now()` — NO Deepgram trigger; `egress_ended` → set `recording_r2_key`, `recording_status: "available"` from `egressInfo.fileResults[0]`, dispatch `run_deepgram_transcription.delay(meeting_id, recording_url)`
- [ ] Handle `participant_joined`: upsert `participants` document with `meeting_id`, `session_id`, `display_name`, `user_id` (if auth), `joined_at: now()`, `is_guest`, `role` via `resolve_role()`
- [ ] Handle `participant_left`: `participants.update_one({session_id}, {$set: {left_at: now()}})`, broadcast `meeting.participant_left` WebSocket event
- [ ] Host grace period on `participant_left`: if `participant.identity == meeting.host_user_id` → `redis_client.set(f"host:grace:{meeting_id}", "1", ex=60)` — schedule `asyncio.create_task(host_grace_period(meeting_id))` to fire after 60s
- [ ] Implement `host_grace_period(meeting_id)`: `await asyncio.sleep(60)`, check if grace key still in Redis (if host reconnected, key was deleted); if still present: check `meeting.co_host_ids`, promote first if non-empty + notify; else call LiveKit Admin `roomClient.deleteRoom(meeting_id)`
- [ ] Write integration test: `room_finished` webhook → Deepgram task NOT queued; `egress_ended` → Deepgram task queued with correct `recording_url`
- Status: [ ] TODO

---

### Task 7.2: Backend — In-Meeting Control Endpoints [MVP]

- [ ] Add `POST /v1/meetings/{id}/controls` — auth + host/co-host; validate partial `{room_locked, reactions_enabled, locks: {camera, microphone, screen_share, chat}}`; call `meeting_repo.update()` with provided fields under `locks.*`; broadcast `meeting.controls_changed` WebSocket event with all current lock states + `is_recording`; return `200` with updated controls
- [ ] Add `POST /v1/meetings/{id}/remove` — auth + host/co-host; validate `{session_id: str}`; call LiveKit Admin API `RoomServiceClient.removeParticipant(room_name=meeting_id, identity=session_id)`; return `200`
- [ ] Add `POST /v1/meetings/{id}/admit` — validate `{session_token: str}`; update `guest_sessions.status = "admitted"`; generate LiveKit token for guest; broadcast `meeting.waiting_room.admitted` with token; return `200`
- [ ] Add `POST /v1/meetings/{id}/decline` — validate `{session_token: str}`; increment `participants.knock_count` for session; broadcast `meeting.waiting_room.declined` with `knock_count`, `can_reknock = knock_count < 3`; return `200`
- [ ] Write integration test: `POST /controls` with `room_locked: true` → DB updated + `meeting.controls_changed` broadcast; non-host call → 403
- 📐 Schema: `meetio-db-schema.md#3-meetings`
- Status: [ ] TODO

---

### Task 7.3: Frontend — Meeting Room Page [MVP]

- [ ] Create `frontend/src/pages/MeetingRoomPage.tsx` at `/meeting/:id`: reads `livekit_token`, `livekit_url`, initial mic/camera state from React Router `location.state`; if no token in state → call `getMeetingToken(id)` on mount (handles direct URL navigation)
- [ ] Wrap with LiveKit `<RoomContext>`: `const room = new Room()`, `room.connect(livekit_url, livekit_token, {autoSubscribe: true})`
- [ ] On `RoomEvent.Connected`: call `GET /v1/meetings/{id}` to get current `is_recording` state — mount `<RecordingBanner />` immediately if `is_recording: true`; call `GET /v1/meetings/{id}/chat` to load chat history
- [ ] On `RoomEvent.Disconnected`: navigate to end-of-meeting screen (`/meeting/{id}/end`) carrying meeting metadata in router state
- [ ] On unmount: call `room.disconnect()`, call `meetingStore.clearMeeting()` — verify all 7 fields reset
- [ ] Handle `MEETING_FULL` error on token fetch → navigate back to lobby with error query param `?error=meeting_full`
- Status: [ ] TODO

---

### Task 7.4: Frontend — Speaker View Layout [MVP]

- [ ] Create `frontend/src/components/meeting/SpeakerView.tsx`: use `useTracks([Track.Source.Camera, Track.Source.Microphone])` and `useParticipants()` from `@livekit/components-react`
- [ ] Active speaker: `room.activeSpeakers[0]` → render at full width in main area; fallback to host if no active speaker; `<VideoTrack>` component with participant's camera track
- [ ] Bottom strip: remaining participants as tiles (max 4 visible), overflow → "+N more" badge; each tile `<VideoTrack>` + name label + mic indicator
- [ ] Screen share detection: `useTracks([Track.Source.ScreenShare])` — if non-empty switch to `<ScreenShareLayout />` (70/30 split); revert to speaker view when empty
- [ ] `<ScreenShareLayout />`: shared content 70% left panel `<ScreenShareTrack>`, participant rail 30% right — sharer first with "Sharing screen" badge, active speaker second with green border ring
- [ ] Spotlight (pin): host/co-host can pin participant — store `pinnedSessionId` in `meetingStore`; if set, render pinned participant in main area regardless of speaking
- Status: [ ] TODO

---

### Task 7.5: Frontend — Controls Bar [MVP]

- [ ] Create `frontend/src/components/meeting/ControlsBar.tsx`: `position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%)` — auto-hide after 3s inactivity using `setTimeout`; restore on `mousemove` or `touchstart` on document
- [ ] Mic button: `localParticipant.setMicrophoneEnabled(!isMicEnabled)` — red slash icon when muted; camera button: `localParticipant.setCameraEnabled(!isCameraEnabled)` — red slash when off; both reflect `meetingStore` lock state (disabled + tooltip "Locked by host" when locked)
- [ ] Screen share button: `localParticipant.setScreenShareEnabled(true)` — catch `NotAllowedError` → toast "Screen share permission denied"; active state when sharing
- [ ] Reactions button (only visible when `reactionsEnabled`): emoji picker popover; on emoji select: `localParticipant.publishData(JSON.stringify({type: "reaction", emoji}), {reliable: false})`; render floating emoji animation on all clients via `room.on(RoomEvent.DataReceived)`
- [ ] CC button: `uiStore.toggleCaptions()` — local only, no server event
- [ ] Leave button (red): if host → show modal "End for all" vs "Leave + assign host"; if non-host → confirm dialog, `room.disconnect()`
- [ ] End for all (host only): call `POST /v1/meetings/{id}/controls {room_locked: true}` then LiveKit Admin deleteRoom
- Status: [ ] TODO

---

### Task 7.6: Frontend — Recording Consent Banner [MVP]

- [ ] Create `frontend/src/components/meeting/RecordingBanner.tsx`: `position: fixed; top: 0; left: 0; right: 0; z-index: 50`; red background; "🔴 This meeting is being recorded"; no close button, no dismiss mechanism; rendered above all other meeting UI
- [ ] Mount/unmount controlled by `meetingStore.isRecording` — set via `setRecording(bool)` called from WebSocket handler (NOT a local toggle)
- [ ] WebSocket `meeting.controls_changed` handler in `MeetingRoomPage`: call `meetingStore.setRecording(event.payload.is_recording)` — also update `roomLocked`, `reactionsEnabled` from same payload
- [ ] On room join: fetch current `is_recording` from `GET /v1/meetings/{id}` — call `setRecording(meeting.is_recording)` before rendering room UI so late joiners see banner immediately
- [ ] Write Vitest test: `meetingStore.setRecording(true)` → `isRecording === true`; `setRecording(false)` → `false` — verify it's a setter not a toggle
- [ ] Write E2E test: host starts recording → all client WebSocket handlers fire → banner rendered with no close button (`queryByRole("button", {name: /close/i})` returns null)
- Status: [ ] TODO

---

### Task 7.7: Frontend — Participants Sidebar [MVP]

- [ ] Create `frontend/src/components/meeting/ParticipantsSidebar.tsx`: toggled by participants button in controls bar; list all `meetingStore.participants` — each row: avatar initial, display name, role badge (HOST / CO-HOST), mic indicator, speaking animation
- [ ] Host/co-host rows: show action buttons per non-self participant — [Mute] calls `POST /v1/meetings/{id}/controls` with targeted mute (or LiveKit Admin mute track); [Remove] calls `POST /v1/meetings/{id}/remove` with confirm dialog; [Spotlight] sets `meetingStore.pinnedSessionId`
- [ ] Host only: [Promote to co-host] button on auth participant rows — calls `promoteCoHost()`; [Demote] on co-host rows — calls `demoteCoHost()`
- [ ] Waiting room section at top of sidebar (if `meetingStore.waitingRoom.length > 0`): same as `<WaitingRoomPanel />` but inline — [Admit] / [Decline] per entry, [Admit all] when 3+
- [ ] WebSocket handlers: `meeting.participant_joined` → `meetingStore.setParticipants([...existing, newParticipant])`; `meeting.participant_left` → remove from list; `meeting.role_changed` → update role in list
- [ ] Show participant count in sidebar header: "Participants (N/50)"
- Status: [ ] TODO

---

## Summary

| Category     | Tasks | Completed | Remaining |
| ------------ | ----- | --------- | --------- |
| MVP Tasks    | 7     | 0         | 7         |
| Future Tasks | 0     | 0         | 0         |
| **Total**    | **7** | **0**     | **7**     |

## Execution Order

1. **Backend APIs:** 7.1 → 7.2 (Webhook handler → Control endpoints)
2. **Frontend Core:** 7.3 (Meeting room page + LiveKit connection)
3. **Frontend Video:** 7.4 (Speaker view + screen share layout)
4. **Frontend Controls:** 7.5 → 7.6 → 7.7 (Controls bar → Recording banner → Participants sidebar)
   ENDOFFILE
