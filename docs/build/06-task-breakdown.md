# Task Breakdown: Pre-Meeting Lobby

**Feature:** #6 from MVP Roadmap
**Estimated Time:** 12–15 hours total
**Priority:** SIXTH — depends on Features 2 (Auth) and 5 (Meetings)
**Status:** [ ] Not Started

---

## Feature 6: Pre-Meeting Lobby

---

### Task 6.1: Backend — Guest Join Endpoints [MVP]

- [ ] Add `POST /v1/meetings/{id}/join-guest` to `backend/app/routers/meetings.py`: no auth required; validate `{display_name: str}` (min 2, max 50 chars, strip whitespace); call `meeting_service.enforce_capacity(id)` — raise `MEETING_FULL` 403 if at limit; raise `MEETING_LOCKED` 403 if `meeting.room_locked`
- [ ] Call `meeting_service.resolve_guest_display_name(requested, existing_participants)` — return deduplicated name; create `guest_sessions` document with `session_id = uuid4()`, `display_name`, `meeting_id`, `status = "waiting" OR "admitted"` depending on `meeting.waiting_room_enabled`
- [ ] If waiting room disabled: generate LiveKit token, return `{status: "admitted", session_token, display_name, livekit_token, livekit_url}`
- [ ] If waiting room enabled: broadcast `meeting.waiting_room.new` WebSocket event to host/co-hosts; return `{status: "waiting", session_token, display_name, poll_url: "/v1/meetings/{id}/join-guest/status"}`
- [ ] Add `GET /v1/meetings/{id}/join-guest/status?session_token=...`: look up `guest_sessions` by `session_token`; return `{status, knock_count, can_reknock}`; if `admitted` include `{livekit_token, livekit_url}`
- [ ] Write integration test: join-guest with waiting room enabled → status "waiting"; admit → status poll returns "admitted" + livekit_token
- 📐 Schema: `meetio-db-schema.md#5-guest_sessions`
- Status: [ ] TODO

---

### Task 6.2: Backend — Display Name Deduplication [MVP]

- [ ] Implement `resolve_guest_display_name(requested: str, meeting_id: str) -> str` in `backend/app/services/meeting_service.py`: query `participants` collection for `meeting_id` where `left_at` is null → build `existing_names` set (case-insensitive)
- [ ] If `requested.lower()` not in existing → return `f"{requested} (Guest)"`
- [ ] If collision: try `f"{requested} (Guest 2)"`, `f"{requested} (Guest 3)"` etc. until unique — max 20 attempts then append random 4-char suffix
- [ ] Comparison is case-insensitive: "Ayush" and "ayush" treated as same name — compare `name.lower()` against `{n.lower() for n in existing_names}`
- [ ] Write unit tests: no collision → "(Guest)" suffix; single collision → "(Guest 2)"; auth user name collision → still "(Guest)"; double collision → "(Guest 2)" already taken → "(Guest 3)"
- [ ] Write unit test: case-insensitive — "AYUSH" in room, guest enters "ayush" → "ayush (Guest)"
- Status: [ ] TODO

---

### Task 6.3: Frontend — Lobby API Service [MVP]

- [ ] Create `frontend/src/lib/lobbyApi.ts`: export `joinAsGuest(meetingId, displayName)` → `POST /v1/meetings/{id}/join-guest` — returns admitted or waiting response; handle `MEETING_FULL` → throw `MeetingFullError`; handle `MEETING_LOCKED` → throw `MeetingLockedError`
- [ ] Export `pollGuestStatus(meetingId, sessionToken)` → `GET /v1/meetings/{id}/join-guest/status?session_token={token}` — returns `{status, knock_count, can_reknock, livekit_token?, livekit_url?}`
- [ ] Export `getMeetingForLobby(id)` → `GET /v1/meetings/{id}` — returns public fields: title, host name, status, waiting_room_enabled, current_participant_count, max_participants
- Status: [ ] TODO

---

### Task 6.4: Frontend — Device Setup Hook [MVP]

- [ ] Create `frontend/src/hooks/useDevices.ts`: on mount call `navigator.mediaDevices.enumerateDevices()` — store cameras (`videoinput`), microphones (`audioinput`), speakers (`audiooutput`) in local state; listen for `navigator.mediaDevices.addEventListener("devicechange", refresh)` to handle plug/unplug
- [ ] Add `selectedCamera`, `selectedMic`, `selectedSpeaker` state with setters; on camera change: stop current video stream, call `getUserMedia({video: {deviceId: {exact: id}}})`, update preview stream ref
- [ ] Add `micLevel: number` (0–100) via `AudioContext + AnalyserNode`: on mic select, create analyser node, call `getByteFrequencyData()` in `requestAnimationFrame` loop, compute average, update `micLevel` state; cancel animation frame on unmount
- [ ] Add `testSpeaker(deviceId)`: create `<audio>` element, set `setSinkId(deviceId)` (gracefully no-op if unsupported), play short tone (440Hz for 1 second via `AudioContext.createOscillator()`)
- [ ] Handle permission denial: `getUserMedia` throws `NotAllowedError` → set `cameraError = "Camera permission denied. Enable in browser settings."` state; render error state in preview instead of video
- [ ] Return `{cameras, mics, speakers, selectedCamera, selectedMic, selectedSpeaker, setSelectedCamera, setSelectedMic, setSelectedSpeaker, micLevel, cameraStream, testSpeaker, cameraError, micError}` from hook
- Status: [ ] TODO

---

### Task 6.5: Frontend — Noise Cancellation & Background Blur [MVP]

- [ ] Create `frontend/src/hooks/useEnhancements.ts`: `noiseEnabled` (default true), `blurEnabled` (default false) — persist both in `localStorage` as `meetio:noise` and `meetio:blur`
- [ ] Noise cancellation: apply via LiveKit `LocalAudioTrack` constraints `{noiseSuppression: true, echoCancellation: true}` when `noiseEnabled` — toggle by replacing the audio track with new `getUserMedia` call with updated constraints
- [ ] Background blur: on `blurEnabled = true`: load MediaPipe SelfieSegmentation model (`@mediapipe/selfie_segmentation`); process each camera frame on a `<canvas>` element — blur background pixels, keep foreground; expose blurred canvas stream as `blurredStream`
- [ ] On blur enable: switch preview `<video>` srcObject to `blurredStream`; on disable: revert to raw `cameraStream`
- [ ] Show loading spinner on the preview while blur model loads (model is ~5MB, first load only)
- [ ] Write Vitest unit test: `noiseEnabled` toggles correctly, persists to localStorage
- Status: [ ] TODO

---

### Task 6.6: Frontend — Auth Lobby Page [MVP]

- [ ] Create `frontend/src/pages/LobbyPage.tsx` at `/meeting/:id/lobby`: on mount fetch `getMeetingForLobby(id)` — show skeleton while loading; if meeting not found (404) show "Meeting not found" with [Go to Dashboard] link
- [ ] Layout: meeting title + host name + "N participants waiting" count at top; 16:9 camera preview `<video>` with mic level bar overlay at bottom; device dropdowns (Camera / Mic / Speaker + test button); Noise + Blur toggles; join-with mic/camera toggle buttons; large [Join Meeting] primary button
- [ ] On [Join Meeting]: call `getMeetingToken(id)` — if success navigate to `/meeting/{id}` carrying `livekit_token` and initial mic/camera state in router state; handle `MEETING_FULL` → show "This meeting is full (50/50)" inline error; handle `MEETING_LOCKED` → convert lobby in-place to locked state ("This meeting is locked by the host") with [Leave] button
- [ ] Waiting room conversion: if `getMeetingToken()` returns `waiting_room` status (alternative: if `meeting.waiting_room_enabled` known at load time) → convert lobby in-place to waiting state — same page, keep device controls live, show spinner + "Waiting for the host…" + [Leave] button
- [ ] On decline: show "You weren't admitted" + [Re-knock] (if can_reknock) or "Contact the host" (if exhausted)
- [ ] Cleanup: on unmount stop all media tracks to release camera/mic hardware
- Status: [ ] TODO

---

### Task 6.7: Frontend — Guest Lobby Page [MVP]

- [ ] Extend `LobbyPage.tsx` with guest variant — detect based on `authStore.isAuthenticated`: if not authenticated render guest identity section below device controls
- [ ] Guest identity section: [Sign In] button (navigates to `/signin?redirect=/meeting/{id}/lobby`) + horizontal divider "or" + display name text input (label "Your name", required, min 2 chars, max 50) + [Join as Guest] button
- [ ] On [Join as Guest]: validate display name not empty; call `joinAsGuest(id, displayName)` — on success show `<GuestJoinToast />` modal before connecting
- [ ] `<GuestJoinToast />`: "Joining as {resolvedDisplayName} (Guest). You won't have access to the recording or AI recap." — [Got it — Join Now] navigates to `/meeting/{id}` with session_token in router state; [Sign In Instead] navigates to `/signin?redirect=/meeting/{id}/lobby`
- [ ] If waiting room: toast → then convert lobby in-place to waiting state; poll `pollGuestStatus()` every 3 seconds; stop polling on mount cleanup
- [ ] Show inline error below display name input on `MEETING_FULL`: "This meeting is full (50/50). Contact the host."
- Status: [ ] TODO

---

## Summary

| Category     | Tasks | Completed | Remaining |
| ------------ | ----- | --------- | --------- |
| MVP Tasks    | 7     | 0         | 7         |
| Future Tasks | 0     | 0         | 0         |
| **Total**    | **7** | **0**     | **7**     |

## Execution Order

1. **Backend APIs:** 6.1 → 6.2 (Guest join endpoints → Deduplication service)
2. **Frontend Service Layer:** 6.3 (Lobby API)
3. **Frontend Hooks:** 6.4 → 6.5 (Device setup → Enhancements)
4. **Frontend UI:** 6.6 → 6.7 (Auth lobby → Guest lobby)
