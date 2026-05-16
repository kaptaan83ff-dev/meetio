# MeetIO — Product Requirements Document

> **Version:** 1.0 (patched)
> **Status:** Current
> **Last Updated:** April 30, 2026
> **Audience:** Anyone involved in building, designing, or understanding MeetIO — technical or not.
> **Change summary from v0:** Severities #3 #7 #12 #13 #14 #16 #18 #19 #21 resolved. See bottom for full changelog.

---

## How to Read This Document

This document describes **what MeetIO does and why**, not how the code works (that is the TRD's job). Every section is written so that a designer, product manager, or non-technical stakeholder can read it and understand the product completely. Technical terms are explained when they appear.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [User Access Model](#2-user-access-model)
3. [Pre-Meeting Lobby](#3-pre-meeting-lobby)
4. [In-Meeting Experience](#4-in-meeting-experience)
5. [Post-Meeting AI Pipeline](#5-post-meeting-ai-pipeline)
6. [Guest Migration](#6-guest-migration)
7. [Authentication](#7-authentication)
8. [Session Management](#8-session-management)
9. [Dashboard](#9-dashboard)
10. [Calendar](#10-calendar)
11. [Messenger](#11-messenger)
12. [Meeting History](#12-meeting-history)
13. [Action Items](#13-action-items)
14. [Notifications](#14-notifications)
15. [Settings](#15-settings)
16. [User Profile Management](#16-user-profile-management)
17. [Infrastructure & Background Jobs](#17-infrastructure--background-jobs)
18. [Offline & Degraded Mode](#18-offline--degraded-mode)
19. [Data Model Versioning](#19-data-model-versioning)
20. [Deferred to v1](#20-deferred-to-v1)
21. [Appendix — Recommended Build Order](#21-appendix--recommended-build-order)
22. [Changelog](#22-changelog)

---

## 1. Executive Summary

### 1.1 Vision & Positioning

**MeetIO** is a production-grade video conferencing platform built for speed, intelligence, and security. It is designed specifically for **students and small teams** who need reliable video meetings with AI-powered post-meeting insights — without the cost and complexity of enterprise tools.

**Vision:** Make video meetings faster, smarter, and more secure for everyone — from study groups to startup standups.

**Three Pillars:**

- **Speed** — Instant meeting creation in under 10 seconds. No downloads, no setup friction.
- **Intelligence** — AI-powered summaries, action items, transcripts, and live captions automatically generated after every meeting.
- **Security** — End-to-end encrypted messaging, secure guest handling, and enterprise-grade privacy built in from day one.

**Platform:** Web application only. No mobile app in v1. Works in any modern browser.

### 1.2 Technology Stack

> **Note for non-techies:** This table shows which third-party services and tools MeetIO is built on. You do not need to understand each one in detail — it is here for reference.

| Layer                      | Technology                     | What It Does                                    |
| -------------------------- | ------------------------------ | ----------------------------------------------- |
| Frontend (what users see)  | React 18 + Vite                | Builds the user interface                       |
| Routing                    | React Router v6                | Manages page navigation                         |
| State management           | Zustand                        | Keeps UI state in sync                          |
| Styling                    | Tailwind CSS                   | Handles visual design                           |
| Backend (server)           | Python 3.12, FastAPI           | Handles all data, logic, and security           |
| Auth & Security            | FastAPI Users                  | Industry-standard library-managed auth          |
| Database                   | MongoDB                        | Stores all app data permanently                 |
| Cache / Message Broker     | Redis                          | Speeds up reads; routes background jobs         |
| Background Jobs            | Celery + Celery Beat           | Runs tasks asynchronously (AI, emails, cleanup) |
| Video (real-time)          | LiveKit Cloud (free tier)      | Powers video/audio in meetings                  |
| App real-time events       | WebSocket (FastAPI)            | Delivers live notifications and updates         |
| Live captions              | Deepgram STT via LiveKit       | Transcribes speech to text during meetings      |
| Post-meeting transcription | Deepgram post-processing API   | Creates full transcript after meeting ends      |
| AI Pipeline                | OpenAI GPT-4o (primary)        | Generates summaries, action items, decisions    |
| AI Fallback                | Anthropic Claude (optional)    | Swappable via environment variable              |
| Recording storage          | Cloudflare R2                  | Stores meeting recordings cheaply               |
| Email                      | Resend                         | Sends notification emails                       |
| Schema Migrations          | migrate-mongo                  | Safely updates the database structure           |
| Frontend hosting           | Cloudflare Pages (recommended) | Hosts the React app                             |
| Backend hosting            | Railway (recommended)          | Hosts the server                                |

> **AI provider decision:** Start with OpenAI GPT-4o — it produces more reliable structured output for action item extraction. Anthropic Claude is available as a fallback once the pipeline is stable. Switch providers by changing one environment variable — no code change needed.

### 1.3 Architecture Overview

> **Plain English:** The diagram below shows how data flows through MeetIO. The browser (what the user sees) talks to our server, which coordinates everything else — video, AI, storage, and email.

```
Browser (what the user sees)
│
├── Signs in / signs up → Server handles auth
├── Fetches meeting data → Server returns data
├── Gets a video token → Server generates it securely
├── Video + audio → LiveKit Cloud (direct, not through our server)
├── Live captions → LiveKit Cloud → Deepgram → back to browser
└── Real-time updates → WebSocket connection to our server

Our Server (FastAPI)
├── All REST API calls (data, auth, settings)
├── WebSocket server (live notifications and events)
├── Generates video tokens (never done in the browser)
├── Dispatches background jobs
└── Receives events from LiveKit and Google Calendar

Background Workers (Celery)
├── Post-meeting transcription (Deepgram)
├── AI pipeline (summary, action items, decisions, transcript)
├── Email sending
├── Google Calendar sync renewal
└── Daily data cleanup (GDPR, expired recordings)

Database (MongoDB)
└── Stores everything: users, meetings, messages, action items, etc.

File Storage (Cloudflare R2)
└── Stores meeting recordings (MP4 files)
```

---

## 2. User Access Model

### 2.1 User Types

There are two types of people who can participate in a MeetIO meeting:

| User Type              | Who They Are                                                                     | What Happens to Their Data                                                       |
| ---------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Authenticated User** | Someone with a permanent MeetIO account (created via email or Google).           | Data stored permanently in the database.                                         |
| **Guest User**         | Someone who joins via a meeting link with no account. Only needs a display name. | Data stored temporarily — automatically deleted 24 hours after the meeting ends. |

> **Why allow guests?** Not everyone in a meeting needs an account. A student can invite a guest lecturer, or a startup founder can bring in an external advisor — without forcing them to sign up. Guests can optionally convert to a full account during or after the meeting.

### 2.2 Meeting Roles

Every person in a meeting has one of four roles. Roles determine what they can do.

**Role hierarchy (highest authority to lowest):**

`Host → Co-host → Authenticated Participant → Guest`

| Role                          | Who Gets It                                    | How                                      |
| ----------------------------- | ---------------------------------------------- | ---------------------------------------- |
| **Host**                      | The authenticated user who created the meeting | Automatic — assigned at creation         |
| **Co-host**                   | Any authenticated participant in the meeting   | Host promotes them manually, mid-meeting |
| **Authenticated Participant** | Any account holder who joins                   | Default for all logged-in joiners        |
| **Guest Participant**         | Anyone who joins without an account            | Default for all unauthenticated joiners  |

### 2.3 Permission Matrix

What each role can and cannot do across the platform:

| Feature                     | Guest | Auth Participant | Co-host | Host |
| --------------------------- | :---: | :--------------: | :-----: | :--: |
| Join meeting via link       |  ✅   |        ✅        |   ✅    |  ✅  |
| Create a new meeting        |  ❌   |        ✅        |   ✅    |  ✅  |
| Dashboard & analytics       |  ❌   |        ✅        |   ✅    |  ✅  |
| Meeting history             |  ❌   |        ✅        |   ✅    |  ✅  |
| Post-meeting recording      |  ❌   |        ✅        |   ✅    |  ✅  |
| Post-meeting AI recap       |  ❌   |        ✅        |   ✅    |  ✅  |
| Post-meeting raw transcript |  ❌   |        ✅        |   ✅    |  ✅  |
| Delete recording            |  ❌   |        ❌        |   ❌    |  ✅  |
| Delete AI recap             |  ❌   |        ❌        |   ❌    |  ✅  |
| Calendar integration        |  ❌   |        ✅        |   ✅    |  ✅  |
| Messenger                   |  ❌   |        ✅        |   ✅    |  ✅  |
| Assign action items         |  ❌   |        ✅        |   ✅    |  ✅  |
| Settings & preferences      |  ❌   |        ✅        |   ✅    |  ✅  |

### 2.4 In-Meeting Controls Matrix

> **Legend:** ✅ = Always available | ❌ = Not available | **On\*** = On by default, lockable | **Off\*** = Off by default, lockable
>
> **What "lockable" means:** The host or co-host can flip a room-wide switch that enables or disables a feature for everyone in the meeting, including themselves.

#### Media Controls (Self)

| Control               | Host | Co-host | Auth Participant | Guest |          Default State          |
| --------------------- | :--: | :-----: | :--------------: | :---: | :-----------------------------: |
| Toggle own camera     |  ✅  |   ✅    |        ✅        |  ✅   |              On\*               |
| Toggle own microphone |  ✅  |   ✅    |        ✅        |  ✅   |              On\*               |
| Share screen          |  ✅  |   ✅    |        ✅        |  ✅   |              On\*               |
| Noise cancellation    |  ✅  |   ✅    |        ✅        |  ✅   |    Always on (not lockable)     |
| Background blur       |  ✅  |   ✅    |        ✅        |  ✅   | Always available (not lockable) |

#### Chat

| Control             | Host | Co-host | Auth Participant | Guest | Default State |
| ------------------- | :--: | :-----: | :--------------: | :---: | :-----------: |
| View messages       |  ✅  |   ✅    |        ✅        |  ✅   |     On\*      |
| Send messages       |  ✅  |   ✅    |        ✅        |  ✅   |     On\*      |
| Delete own messages |  ✅  |   ✅    |        ✅        |  ❌   |      N/A      |
| Delete any message  |  ✅  |   ✅    |        ❌        |  ❌   |      N/A      |

#### Reactions

| Control        | Host | Co-host | Auth Participant | Guest |            Default State             |
| -------------- | :--: | :-----: | :--------------: | :---: | :----------------------------------: |
| Send reactions |  ✅  |   ✅    |        ✅        |  ✅   | **Off\*** — host/co-host must enable |

> Reactions are **off by default** in every meeting. The host or co-host must explicitly turn them on. Once enabled, all participants including guests can use them.

#### Participant Management (Who can control others)

| Control                     | Host | Co-host | Auth Participant | Guest |
| --------------------------- | :--: | :-----: | :--------------: | :---: |
| Mute a specific participant |  ✅  |   ✅    |        ❌        |  ❌   |
| Mute everyone at once       |  ✅  |   ✅    |        ❌        |  ❌   |
| Remove a participant        |  ✅  |   ✅    |        ❌        |  ❌   |
| Promote to co-host          |  ✅  |   ❌    |        ❌        |  ❌   |
| Revoke co-host status       |  ✅  |   ❌    |        ❌        |  ❌   |
| Admit from waiting room     |  ✅  |   ✅    |        ❌        |  ❌   |
| Decline from waiting room   |  ✅  |   ✅    |        ❌        |  ❌   |
| Spotlight a participant     |  ✅  |   ✅    |        ❌        |  ❌   |

#### Meeting-Level Controls

| Control                  | Host | Co-host | Auth Participant | Guest |
| ------------------------ | :--: | :-----: | :--------------: | :---: |
| Start recording          |  ✅  |   ✅    |        ❌        |  ❌   |
| Pause / Resume recording |  ✅  |   ✅    |        ❌        |  ❌   |
| Stop recording           |  ✅  |   ✅    |        ❌        |  ❌   |
| Lock / Unlock room       |  ✅  |   ✅    |        ❌        |  ❌   |
| Toggle waiting room      |  ✅  |   ❌    |        ❌        |  ❌   |
| End meeting for all      |  ✅  |   ❌    |        ❌        |  ❌   |
| Leave meeting (self)     |  ✅  |   ✅    |        ✅        |  ✅   |

#### AI Features (In-Meeting)

| Control                                 | Host | Co-host | Auth Participant | Guest |
| --------------------------------------- | :--: | :-----: | :--------------: | :---: |
| Enable/disable live captions (personal) |  ✅  |   ✅    |        ✅        |  ✅   |
| Post-meeting AI recap access            |  ✅  |   ✅    |        ✅        |  ❌   |
| Delete AI recap                         |  ✅  |   ❌    |        ❌        |  ❌   |

> **Live captions are personal.** Each participant controls their own captions. It is not a room-wide setting — one person turning captions on does not affect anyone else.

### 2.5 Lockable Controls Reference

When a lock is applied, it is room-wide and applies to everyone including the host and co-host.

| Control      |    Default    | Who Can Change | Effect When Locked                      |
| ------------ | :-----------: | :------------: | --------------------------------------- |
| Camera       | Unlocked (on) | Host, Co-host  | Nobody can turn their camera on         |
| Microphone   | Unlocked (on) | Host, Co-host  | Nobody can unmute                       |
| Screen share | Unlocked (on) | Host, Co-host  | Nobody can share their screen           |
| Chat         | Unlocked (on) | Host, Co-host  | Chat panel hidden, no messages possible |
| Reactions    | Locked (off)  | Host, Co-host  | Reactions unavailable to all            |

### 2.6 Host Departure Rules

The host holds the meeting together. Special rules apply when they leave:

- **Leaving intentionally:** The host must assign a new host before leaving. Two options are shown:
  - "Leave Meeting" — requires picking someone to pass the host role to.
  - "End Meeting for All" — closes the meeting for every participant.
- **Unexpected disconnection** (e.g. browser crash, internet loss):
  - A 60-second grace period starts.
  - **If the host reconnects within 60 seconds:** the grace period cancels, the meeting continues normally, and the host retakes their role.
  - **If a co-host is present and the host does not return within 60 seconds:** the meeting continues with the co-host in charge. The co-host receives an in-app notification: "The host has disconnected. You are now managing the meeting."
  - **If no co-host is present and the host does not return within 60 seconds:** the meeting ends for all participants.
- **Co-host limitations:** A co-host can never end the meeting or transfer the host role on their own. Only the host can do those things.

### 2.7 Participant Record Structure

> **For engineers:** This is the shape of data stored for each participant per meeting.

```python
class ParticipantRecord(BaseModel):
    meeting_id: str
    session_id: str                    # always present — LiveKit session identifier
    user_id: str | None                # null for guests until they convert to an account
    display_name: str                  # "Ayush (Guest)" or account name
    is_guest: bool
    role: str                          # 'host' | 'co-host' | 'participant' | 'guest'
    joined_at: datetime
    left_at: datetime | None
    converted_at: datetime | None      # timestamp of guest → account conversion
    converted_from_name: str | None    # e.g. "Ayush (Guest)" before conversion
    migrated_to_user_id: str | None    # set after successful migration
    schema_version: int = 1
```

### 2.8 Data Persistence by Role

What happens to each type of data after a meeting ends:

| Data Type       | Host          | Co-host                   | Auth Participant | Guest        |
| --------------- | ------------- | ------------------------- | ---------------- | ------------ |
| User identity   | Permanent     | Permanent                 | Permanent        | Session only |
| Chat messages   | Starred only  | Starred only              | Starred only     | Ephemeral    |
| Reactions       | None          | None                      | None             | Ephemeral    |
| Shared files    | Full          | Full                      | Full             | Ephemeral    |
| Meeting history | Full          | Full                      | Full             | Not recorded |
| Recording       | View + Delete | View only                 | View only        | None         |
| AI recap        | View + Delete | View only                 | View only        | None         |
| Raw transcript  | Full          | View only                 | View only        | None         |
| Action items    | Full CRUD     | Create + Edit (no delete) | Own status only  | None         |

### 2.9 Maximum Participants per Meeting

**v1 limit: 50 participants per meeting.**

- This includes the host, all co-hosts, authenticated participants, and guests.
- If a 51st person attempts to join, they receive a clear message: "This meeting is full (50/50). Please contact the host."
- Hosts are notified when the meeting reaches 45 participants (90% capacity): "Your meeting is almost full — 45/50 participants."
- This limit is enforced by the server when issuing video tokens. It cannot be bypassed client-side.

> **Why 50?** LiveKit Cloud's free tier supports up to 100 concurrent participants per room, but 50 is a conservative, stable limit for v1. It covers all realistic student and small-team use cases while leaving headroom. This can be raised in v2.

---

## 3. Pre-Meeting Lobby

### 3.1 Overview

The pre-meeting lobby is a **single page** where users set up their camera, microphone, and speakers before joining. No separate device-check step. Users arrive here by clicking a meeting link.

### 3.2 Entry Flow

```
User clicks a meeting link
│
├── LOGGED IN (Auth User)
│    └── Pre-meeting lobby (Auth version)
│         └── Adjusts devices → clicks "Join Meeting"
│              ├── Room open → enters meeting ✅
│              └── Room locked / waiting room enabled
│                   └── Lobby converts to waiting room (same page, no redirect)
│                        └── Host/co-host admits → enters meeting ✅
│
└── NOT LOGGED IN
     └── Pre-meeting lobby (Guest version)
          ├── Option 1: [Sign In] → /signin?redirect=/meeting/{id}/lobby
          │    └── Returns as auth user → follows Auth flow above ✅
          │
          └── Option 2: [Join as Guest]
               └── Enter display name → join toast → enters meeting
                    ├── Room open → enters meeting ✅
                    └── Room locked / waiting room → admitted by host ✅
```

### 3.3 Auth Pre-Meeting Lobby

```
┌────────────────────────────────────────────────────────┐
│  [Meeting Title]                                       │
│  Hosted by [Host Name]  ·  [N] participants waiting    │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │                                                  │  │
│  │              LIVE CAMERA PREVIEW                 │  │
│  │                                                  │  │
│  │  🎤 ██████████░░░░  (real-time mic level bar)    │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  Camera       [Device name                  ▾]        │
│  Microphone   [Device name                  ▾]        │
│  Speaker      [Device name          Test 🔊  ▾]       │
│                                                        │
│  ── Enhancements ──────────────────────────────────    │
│  Noise cancellation     [ ● ON  ]                      │
│  Background blur        [  OFF  ]                      │
│                                                        │
│  Join with:   [🎤 Mic ON]   [📷 Camera ON]            │
│                                                        │
│                    [Join Meeting]                      │
└────────────────────────────────────────────────────────┘
```

### 3.4 Guest Pre-Meeting Lobby

Same device controls as the auth lobby, with an added identity section:

```
┌────────────────────────────────────────────────────────┐
│  [Meeting Title]                                       │
│  Hosted by [Host Name]                                 │
│                                                        │
│  [Camera preview + mic bar — same as auth lobby]       │
│  Camera / Mic / Speaker / Enhancements — same          │
│  Join with:   [🎤 Mic ON]   [📷 Camera ON]            │
│                                                        │
│  ════════════════════════════════════════════          │
│                                                        │
│  Already have an account?                              │
│  [Sign In]  ← redirects to /signin, returns here      │
│                                                        │
│  ──────────────── or ─────────────────────            │
│                                                        │
│  Display name  (required)                              │
│  [_________________________________________]           │
│                                                        │
│                  [Join as Guest]                       │
└────────────────────────────────────────────────────────┘
```

### 3.5 Device Controls — Spec

**Camera dropdown:** Lists all available cameras detected by the browser. Default device listed first. The live preview updates instantly when a different camera is selected.

**Microphone dropdown:** Lists all microphones. The animated mic level bar confirms the selected mic is actually picking up audio.

**Speaker dropdown:** Lists all speaker/output devices. The `[Test 🔊]` button plays a short audio clip to confirm the selected speaker works.

**Noise Cancellation:** On by default. Uses browser-based noise suppression. Users can turn it off if playing music or using an instrument.

**Background Blur:** Off by default. Uses in-browser processing (no video is sent to any server for this). Applies to the camera preview immediately on toggle.

**Join With Toggles:** The `[🎤 Mic ON/OFF]` and `[📷 Camera ON/OFF]` buttons persist as the user's initial state when they enter the meeting.

### 3.6 Display Name — Guest Deduplication

When a guest enters a display name, the server checks for collisions with existing participants:

```python
def resolve_guest_display_name(
    requested_name: str,
    existing_participants: list[ParticipantRecord]
) -> str:
    existing_names = [p.display_name for p in existing_participants]

    if requested_name not in existing_names:
        return f"{requested_name} (Guest)"

    counter = 2
    while f"{requested_name} (Guest {counter})" in existing_names:
        counter += 1
    return f"{requested_name} (Guest {counter})"
```

Examples:

- Room has auth user "Ayush" → guest enters "Ayush" → becomes `Ayush (Guest)`
- Room has "Ayush (Guest)" already → another guest enters "Ayush" → becomes `Ayush (Guest 2)`
- Room has no "Piyush" → guest enters "Piyush" → becomes `Piyush (Guest)`

### 3.7 Guest Join Toast

After a guest clicks "Join as Guest":

```
┌─────────────────────────────────────────────────────┐
│ ℹ️  Joining as guest                                │
│                                                     │
│  You can sign in or create an account:              │
│  · During the meeting, or                           │
│  · When the meeting ends                            │
│                                                     │
│  to access the recording, AI recap, and transcript. │
│                                                     │
│  [Got it — Join Now]        [Sign In Instead]       │
└─────────────────────────────────────────────────────┘
```

### 3.8 Sign In Redirect

```
Guest clicks [Sign In] on lobby
→ Redirect to /signin?redirect=/meeting/{meetingId}/lobby
→ Sign in completes
→ App reads redirect param
→ Returns to pre-meeting lobby as auth user
→ Lobby shows auth version (no display name field)
→ User joins as authenticated participant ✅
```

The `redirect` query parameter is critical — without it, the user lands on the dashboard and loses meeting context.

### 3.9 Waiting Room — Same Page Conversion

When a user clicks "Join Meeting" and waiting room is enabled, the lobby converts in-place (no page redirect):

```
┌────────────────────────────────────────────────────────┐
│  [Meeting Title]                                       │
│                                                        │
│  [Camera preview — still live]                         │
│  [Mic level bar — still active]                        │
│                                                        │
│  Camera / Mic / Speaker — still adjustable             │
│                                                        │
│  ⏳  Waiting for the host to admit you...              │
│      You can adjust your devices while you wait.       │
│                                                        │
│  [Leave]                                               │
└────────────────────────────────────────────────────────┘
```

On decline:

```
❌  You were not admitted to this meeting.
    [Re-knock]   [Leave]
```

Re-knock limit: 3 per session. After 3rd decline:

```
You've reached the maximum join requests.
Contact the host directly.
[Leave]
```

---

## 4. In-Meeting Experience

### 4.1 LiveKit Integration

> **Plain English:** LiveKit is the video technology that powers the camera and audio streams. It is a separate service from MeetIO's server. MeetIO's server tells LiveKit "this user can join this room" by issuing a time-limited token.

**Deployment:** LiveKit Cloud (free tier). No self-hosted server needed.

**Token Generation:** The server generates video tokens — the browser never generates them itself. This prevents users from granting themselves host-level permissions.

```python
from livekit.api import AccessToken, VideoGrants

def generate_livekit_token(
    api_key: str,
    api_secret: str,
    user_id: str,
    display_name: str,
    room_name: str
) -> str:
    token = (
        AccessToken(api_key, api_secret)
        .with_identity(user_id)
        .with_name(display_name)
        .with_grants(VideoGrants(room_join=True, room=room_name))
        .to_jwt()
    )
    return token
```

**Room Lifecycle:**

- Room is created server-side when the host clicks "Start Meeting."
- One room per meeting — never reused.
- Room is deleted when the host ends the meeting or the last participant leaves.
- LiveKit notifies MeetIO's server when the recording file is fully saved — this then triggers the transcription job.

**Events received from LiveKit:**

| Event                | What MeetIO Does                                                             |
| -------------------- | ---------------------------------------------------------------------------- |
| `room_started`       | Updates meeting status to "in progress"                                      |
| `room_finished`      | Updates status to "completed"                                                |
| `participant_joined` | Updates participant record                                                   |
| `participant_left`   | Records when participant left                                                |
| `egress_ended`       | Recording file is saved to storage — **this triggers the transcription job** |

> **Important:** Transcription starts only after `egress_ended` — meaning the recording file has been fully saved to storage. Not when the meeting ends. This ensures Deepgram always has a complete file to work with.

### 4.2 Recording Consent

**All participants must know when they are being recorded.** This is both a legal requirement (GDPR, and all-party consent laws in many countries) and a basic trust requirement.

**When recording starts:**

- A non-dismissable banner appears for every participant: `"🔴 This meeting is being recorded"`
- The recording indicator (🔴) appears persistently in the meeting header for the duration of recording.
- The banner cannot be closed or minimized — it stays visible until recording stops.

**Participants who join after recording has started:**

- They see the banner immediately upon entering the meeting, before seeing any other participants.
- Joining after the banner appears = implied consent. They may leave if they do not wish to be recorded.

**When recording stops:**

- Banner is removed. The 🔴 indicator disappears.

**No opt-out mechanism** is provided in v1 beyond leaving the meeting. This is consistent with industry standard (Zoom, Google Meet).

### 4.3 In-Meeting UI Layout

#### Default View — Speaker View

The most active speaker is shown large and centered. All other participants appear in a small strip at the bottom.

```
┌─────────────────────────────────────────────────────────────┐
│  [Meeting Title] · 00:42:17           5 participants · 🔒   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                                                       │  │
│  │              ACTIVE SPEAKER (large)                   │  │
│  │              [spotlight badge if pinned]              │  │
│  │                                                       │  │
│  │  Name · speaking                                      │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  [Tile] [Tile] [Tile] [Tile] [+N more]   ← bottom strip    │
│                                                             │
│        [🎤] [📷] [──] [🖥] [👋] [──] [👥] [CC] [──] [✕]   │
│              ↑ floating controls bar, auto-hides            │
│                                                 [Chat ▶]   │
└─────────────────────────────────────────────────────────────┘
```

#### Chat Panel

- Lives in a right sidebar, visible by default.
- Can be toggled to free up screen space.
- Can be switched to floating mode (draggable, per-user preference only).
- Contains Chat and People tabs.

#### Controls Bar

Floating at the bottom center. Auto-hides after 3 seconds of no mouse movement. Reappears on mouse move or touch.

Controls (left to right): Mic · Camera · `|` · Screen Share · Reactions · `|` · Participants · Captions (CC) · `|` · Leave (red)

#### Screen Share Layout

```
┌────────────────────────────────────────────────────────────────────┐
│                                              │ 30% participant rail │
│                                              │                      │
│         SHARED SCREEN CONTENT               │  [Sharer tile]       │
│                   70%                       │  (sharing badge)     │
│                                              │  [Speaker tile]      │
│                                              │  (green border)      │
│  Sharer name · sharing screen               │  [Other tiles...]    │
│                                              │  [+N more]           │
│         [Controls bar — same as above]       │                      │
└────────────────────────────────────────────────────────────────────┘
```

When screen sharing is active:

- The bottom participant strip is removed entirely.
- All participants move to the right rail (30% width).
- When sharing stops, the layout reverts to speaker view + bottom strip.

### 4.4 Waiting Room — Host Side

Two separate mechanisms for controlling who enters — they are independent of each other:

| Mechanism    | Set by                                       | Effect                                                  |
| ------------ | -------------------------------------------- | ------------------------------------------------------- |
| Waiting room | Host only (at scheduling or via live toggle) | People queue up — host admits them one by one           |
| Room lock    | Host or co-host (any time, live)             | Blocks all new joiners — no queue                       |
| Both active  | Lock takes priority                          | People are blocked at the door; waiting room irrelevant |

**Admit Panel:** Appears as a draggable card in the meeting UI. Also mirrored in the Participants sidebar — both views stay in sync.

```
┌─────────────────────────────────────────────┐
│  Waiting to join (2)                        │
│                                             │
│  Ayush Rawat                                │
│  [Admit]  [Decline]                         │
│                                             │
│  Priya (Guest)  👤                          │
│  [Admit]  [Decline]                         │
│                                             │
│  [Admit all]  ← appears when 3+ waiting     │
└─────────────────────────────────────────────┘
```

The `👤` badge identifies unauthenticated (guest) participants.

**Decline behavior:**

```
Host clicks Decline on Priya
→ Priya sees: "You weren't admitted."
              [Re-knock]  [Leave]

Re-knock 1, 2, 3 → host sees the request again each time

After 3rd decline:
  "You've reached the maximum join requests.
   Contact the host directly."
  [Leave]  ← only option
```

### 4.5 Guest In-Meeting Conversion Modal

Triggered by the guest via the "Sign in" button in the controls bar. Not triggerable by the host.

**AV behavior:** Mic and camera remain live while the modal is open — the meeting continues uninterrupted.

```
┌─────────────────────────────────────────────────────────┐
│  [  Sign in  ]  [  Sign up  ]                           │
│                                                         │
│  [G]  Continue with Google                              │
│                                                         │
│  ─────────────── or ──────────────────────             │
│                                                         │
│  Email     [_____________________________________]      │
│  Password  [_____________________________________]      │
│                                                         │
│  [Sign in]                                              │
│                                                         │
│  ✕ Cancel — stay as guest                               │
└─────────────────────────────────────────────────────────┘
```

**On successful conversion:**

```
Guest "Priya" signs in as priya@gmail.com
→ LiveKit participant metadata updated server-side
→ Display name updates instantly: "Priya (Guest)" → "Priya Sharma"
→ 👤 badge removed from their tile for all participants
→ Their meeting history, past recordings linked to their new account
→ Transcript re-labeled from conversion point onward
→ No rejoin required — seamless
```

**On auth failure:** Error shown in modal. Modal closes after 2 failed attempts. Guest stays in meeting unchanged and can re-trigger the modal anytime.

### 4.6 Transcript Speaker Labeling During Meeting

```
[00:03:12] Priya (Guest)                    → "I think we should..."
[00:07:20] Priya (Guest) → Priya Sharma  🔗  [Account joined]
[00:07:45] Priya Sharma                     → "Yes, I'll take that task"
[00:14:32] Ayush (Guest 2)                  → "What about the deadline?"
[00:21:10] Sarah Mitchell                   → "Let's aim for Friday"
```

- Before conversion: `DisplayName (Guest)`
- At the conversion moment: `DisplayName (Guest) → AccountName [joined]` + timestamp marker
- After conversion: `AccountName` only

### 4.7 End-of-Meeting Screen — Auth Users

```
┌─────────────────────────────────────────────────────────┐
│  Product Sync                                           │
│  Today · 10:00 AM – 10:52 AM · 5 participants · 52 min │
│                                                         │
│  ── How was the meeting? ──                             │
│  ★ ★ ★ ★ ☆                                            │
│  [Great discussion] [Too long] [Bad audio]              │
│  [Well organized] [Off topic] [Good energy]             │
│  [Submit feedback]                                      │
│                                                         │
│  ── AI Summary & Action Items ──                        │
│  ⏳ Summary is being generated...                       │
│     We'll email you when it's ready.                    │
│     View in meeting history →                           │
│                                                         │
│  [Return to dashboard]                                  │
└─────────────────────────────────────────────────────────┘
```

**Host only (additional section):**

```
│  ── Host options ──                                     │
│  [Schedule follow-up meeting]   [Return to dashboard]   │
```

**AI Summary loading state:** A shimmer placeholder is shown immediately. An email notification is sent when the summary is ready.

### 4.8 Offline & Connection Loss During Meeting

See Section 18 for full spec.

---

## 5. Post-Meeting AI Pipeline

### 5.1 Key Definitions

> **These terms are used throughout this section. Read these first.**

**Raw Transcript:** The verbatim, word-for-word record of everything said in the meeting. Generated by Deepgram (a speech-to-text service). Includes speaker labels (e.g. "Speaker 0") matched to participant names, timestamps for every segment, and confidence scores. It is not edited or cleaned — it reflects exactly what was said, including "um", "uh", and interrupted sentences.

**AI Transcript:** A cleaned, readable version of the raw transcript, produced by the LLM (AI). Speaker labels are preserved. Filler words are removed. Sentences are properly formatted. It reads like a meeting minutes document, not a raw speech capture.

**AI Recap:** The full set of AI-generated outputs for a meeting. This includes: the AI Transcript, a Meeting Summary, Key Decisions, and Action Items.

### 5.2 Pipeline Overview

All steps run asynchronously in the background — users are never blocked waiting. Each output is delivered as soon as it is ready.

```
Recording file fully saved to storage (LiveKit signals: egress_ended)
│
├── [1] RECORDING
│     LiveKit Egress has already finished writing the composite video.
│     → File available on Cloudflare R2 storage
│     → Status: available
│     → Shared to all auth participants immediately
│
├── [2] RAW TRANSCRIPT
│     Full audio → Deepgram (speech-to-text with speaker identification)
│     → Speaker labels matched to participant names
│     → Timestamps per segment, confidence scores included
│     → Status: processing → available
│     → Shared to all auth participants on ready
│
├── [3] MEETING SUMMARY
│     Raw transcript → AI (OpenAI GPT-4o by default)
│     → Concise overview of what was discussed and key insights
│     → Status: processing → ready
│     → Shared immediately on ready
│
├── [4] AI TRANSCRIPT
│     Raw transcript → AI
│     → Cleaned, formatted, readable version
│     → Speaker labels preserved, filler words removed
│     → Status: processing → ready
│     → Shared immediately on ready
│
├── [5] KEY DECISIONS
│     Raw transcript → AI
│     → Extracted decisions, with the transcript quote that supports each one
│     → Status: processing → ready
│     → Shared immediately on ready
│
└── [6] ACTION ITEMS  ← the only step requiring host confirmation
      Raw transcript → AI
      → Suggested tasks with assignees, priorities, and due dates
      → Status: processing → pending_host
      → Host notified by email + in-app notification
      → 2-hour window: host confirms, edits, or items are auto-confirmed
      → Status: confirmed → shared with assignees
```

> **AI provider note:** OpenAI GPT-4o is the default because it produces more accurate structured output for action item extraction. Anthropic Claude is supported as a drop-in replacement — switch by changing one environment variable. No code changes needed.

### 5.3 AI Pipeline Failure States

**If Deepgram fails (no transcript produced):**

```
Celery retries: 3 attempts
  Attempt 1: immediately
  Attempt 2: 30 seconds later
  Attempt 3: 2 minutes later

If all 3 fail:
  - In-app notification sent to all auth participants
  - Email sent to all auth participants
  - Meeting history shows:
    "Transcript unavailable — We couldn't process the audio."
    [Download recording]  [Retry]
  - AI summary also unavailable (no transcript to process)
  - Recording in storage is still accessible
```

**If the AI pipeline fails (transcript exists but summaries failed):**

```
Celery retries: 3 attempts
  Attempt 1: immediately
  Attempt 2: 1 minute later
  Attempt 3: 3 minutes later

If all 3 fail:
  - In-app notification + email sent to all auth participants
  - Meeting history shows:
    "Summary unavailable — transcript is ready but summary failed."
    [View transcript]  [Retry summary]
```

**Retry summary (manual):**
| Stage | Auto retries | Backoff | Manual retry |
| --- | --- | --- | --- |
| Deepgram STT | 3 | immediate / 30s / 2m | Yes — reruns full job |
| AI pipeline | 3 | immediate / 1m / 3m | Yes — reruns AI only |
| Manual retry limit | — | — | Unlimited in v1 |

### 5.4 LLM Prompt Inputs

Each AI output (summary, AI transcript, key decisions, action items) receives:

- Full raw transcript text
- Participant list (account names + guest display names)
- Meeting metadata: title, duration, date, host name
- Meeting language

### 5.5 Speaker → Participant Matching

Deepgram identifies speakers as "Speaker 0", "Speaker 1", etc. MeetIO matches these to real names:

```
1. Cross-reference speaking timestamps with LiveKit track activity logs
2. Match speaker ID → participant session_id → display name or account name
3. Guest who converted mid-meeting: use guest name before conversion, account name after
4. Unmatched speaker → labeled "Unknown Speaker"
```

### 5.6 Action Items — AI Generation

```python
class AIGeneratedActionItem(BaseModel):
    task: str
    suggested_assignee: str | None           # matched to auth participant name
    suggested_assignee_user_id: str | None
    priority: Literal['high', 'medium', 'low']
    ai_confidence: int                        # 0–100, shown to host
    due_date_raw_phrase: str | None           # "by Friday", "in 3 days", "ASAP"
    due_date_suggested: datetime | None       # resolved from phrase
    due_date_confidence: Literal['high', 'low'] | None
    unassignable: bool                        # true if person is a guest who didn't convert
```

**Due date phrase resolution:**

| Phrase                | Resolves To                             |
| --------------------- | --------------------------------------- |
| "by Friday"           | Next Friday from meeting date           |
| "end of week"         | Sunday of current week                  |
| "in 3 days"           | Meeting date + 3                        |
| "before next meeting" | Next scheduled meeting date             |
| "ASAP"                | Meeting date + 1, flagged High priority |
| "soon" / vague        | null, low confidence flag               |
| No mention            | null                                    |

### 5.7 Host Confirmation UI

After the AI generates action items, the host sees a confirmation screen. They have 2 hours to review before items are auto-confirmed.

```
┌─────────────────────────────────────────────────────────────────┐
│  AI-Suggested Action Items                                      │
│  Product Sync · Apr 29 · 5 items suggested                      │
│                                                                 │
│  ⏳ Auto-confirms in 1:47:23 if no action taken                 │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ✓  Finalize onboarding wireframes                        │  │
│  │     Assigned: Priya Sharma  · Due: May 2  · High          │  │
│  │     AI confidence: 87%                                    │  │
│  │     [Edit]  [Remove]                                      │  │
│  └───────────────────────────────────────────────────────────┘  │
│  [+ Add item manually]                                          │
│                                                                 │
│  [Confirm All]   [Edit Before Confirming]                       │
└─────────────────────────────────────────────────────────────────┘
```

**Auto-confirm behavior:**

- 2 hours after the host is notified, all pending items are confirmed automatically.
- Host receives a notification: "Your action items were auto-confirmed."
- Assignees are notified after confirmation — not before.

---

## 6. Guest Migration

### 6.1 What is Guest Migration?

When a guest (someone without an account) participates in a meeting, their data is temporary. Migration is the process of linking their guest session to a real account — either one they already have or a new one they create.

Migration can happen:

- **During the meeting** — guest clicks "Sign in" in the controls bar.
- **At the end of the meeting** — shown on the end-of-meeting screen.

### 6.2 What Changes on Migration

```
Guest "Priya" migrates during meeting:
→ Their participant record is linked to their new account
→ Display name updates from "Priya (Guest)" to "Priya Sharma"
→ All participants see the name change instantly
→ After meeting: they get full access to the recording, recap, and transcript
→ Their 24-hour guest data expiry is cancelled
→ Session data is preserved permanently
```

### 6.3 End-of-Meeting Migration Screen (Guests)

Shown to guests on the end-of-meeting screen:

```
┌──────────────────────────────────────────────────────────┐
│  You joined as a guest                                   │
│                                                          │
│  Sign in or create a free account to access:            │
│  · Recording of this meeting                            │
│  · AI Summary and Transcript                            │
│  · Your action items                                    │
│  · This meeting in your history                         │
│                                                          │
│  [Sign In]              [Create Account]                 │
│                                                          │
│  [Skip — I don't need these]                            │
└──────────────────────────────────────────────────────────┘
```

### 6.4 Skip Warning

```
┌──────────────────────────────────────────────────────────┐
│  ⚠️  Are you sure?                                       │
│                                                          │
│  You'll permanently lose access to:                      │
│  · Recording of this meeting                             │
│  · AI Summary and Transcript                             │
│  · Your action items                                     │
│  · This meeting in your history                          │
│                                                          │
│  This cannot be undone.                                  │
│                                                          │
│  [Go Back — Sign In]        [Yes, I'll skip]             │
└──────────────────────────────────────────────────────────┘
```

"Yes, I'll skip" → data held server-side for 24 hours as a soft-delete buffer → then permanently deleted.

### 6.5 Tab Close Guard

If a guest tries to close the browser tab before completing or explicitly skipping migration:

```typescript
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && guestMigrationPending) {
    showMigrationWarningModal();
  }
});

window.addEventListener("beforeunload", (e) => {
  if (guestMigrationPending) {
    e.preventDefault();
    e.returnValue = "";
  }
});
```

### 6.6 What Guest Gets After Migration

| Resource                                  | Migrated Guest Gets                                                               |
| ----------------------------------------- | --------------------------------------------------------------------------------- |
| Recording                                 | ✅ View                                                                           |
| AI recap (summary, transcript, decisions) | ✅ View                                                                           |
| Raw transcript                            | ✅ View                                                                           |
| Participant list                          | ✅ View                                                                           |
| Action items                              | ✅ If they were assigned one (only possible if they converted during the meeting) |
| Meeting in history                        | ✅                                                                                |

### 6.7 Server-Side Buffer

Guest session data is held for **24 hours after the meeting ends** before being permanently deleted. This buffer is silent — not shown to users. It exists to allow late migration after the meeting.

### 6.8 GuestSession Data Model

```python
class GuestSession(BaseModel):
    session_id: str
    meeting_id: str
    display_name: str                   # "Ayush (Guest)" or "Ayush (Guest 2)"
    joined_at: datetime
    left_at: datetime | None
    meeting_ended_at: datetime | None
    purge_at: datetime                  # meeting_ended_at + 24hrs
    migrated_to_user_id: str | None
    migration_completed_at: datetime | None
    migration_source: Literal['during_meeting', 'end_of_meeting'] | None
    migration_attempts: int = 0         # rate limit: max 5 attempts
    locked_until: datetime | None       # backoff after too many failed attempts
    schema_version: int = 1
```

---

## 7. Authentication

### 7.1 Authentication Methods

| Method           | How It Works                                             | Email Verification Required       |
| ---------------- | -------------------------------------------------------- | --------------------------------- |
| Email / Password | Traditional signup with an email verification link and token | Yes — verify account before first sign-in |
| Google OAuth     | Sign in with Google account                              | Automatic — Google verifies email |

**2FA is separate from signup verification:** MeetIO uses TOTP codes from an authenticator app for second-factor authentication, not email OTP codes.

> GitHub OAuth is not in v1. Only email/password and Google OAuth are supported.

### 7.2 Core Identity Rule

**Same email address = same account. Always.**

If someone signs up with `priya@gmail.com` via email/password, and later tries to sign in with Google using the same `priya@gmail.com`, the system recognizes it as the same account and offers to link the two sign-in methods.

### 7.3 Google OAuth Flow

```
User clicks "Sign in with Google"
→ Redirected to Google's login page
→ User logs into Google
→ Google returns: email (verified), name, profile picture, unique ID
→ MeetIO checks if this email exists in the database

Email does NOT exist → create new account → log in
Email exists (email/password account) → send verification link → verify → link Google → log in
Email exists (Google account) → log in directly
```

### 7.4 Email/Password Flow

```
Registration:
User enters email + password + name
→ Verification link sent to their email
→ User clicks link → account verified → logged in

Sign in:
User enters email + password → verified → logged in

Forgot password:
User enters email
→ Reset link sent to their email
→ User opens link → sets a new password
```

### 7.5 Provider Linking — All Scenarios

**Scenario A: Email/password account exists, user tries Google with same email**

```
→ Google account is verified by Google
→ MeetIO finds an existing account with the same email
→ Google provider is linked to the existing account
→ Logged in with both email and Google available
```

**Scenario B: Google-only account, user tries email/password registration**

```
→ User signs in with Google and opens Settings
→ Adds a password from the account security area
→ Password save is confirmed after the user re-authenticates
```

**Scenario C: Google-only account, user goes to /forgot-password**

```
→ Response: "You signed in with Google."
  [Sign in with Google]  [Add a password from Settings]
```

### 7.6 Account State Matrix

| State           | Password set? | Providers             | Login options |
| --------------- | ------------- | --------------------- | ------------- |
| Email/pass only | ✅            | `['email']`           | Password only |
| Google only     | ❌            | `['google']`          | Google only   |
| Both linked     | ✅            | `['email', 'google']` | Either        |

### 7.7 Security Features

| Feature             | How It's Implemented                                           |
| ------------------- | -------------------------------------------------------------- |
| API access          | All protected endpoints verify authentication on every request |
| Video tokens        | Generated server-side only — never in the browser              |
| Guest rate limiting | Rate limiting on guest join endpoints to prevent abuse         |
| CORS                | Strict origin rules — only the MeetIO domain is allowed        |
| Sessions            | Secure cookies managed by FastAPI Users                        |
| Verification        | Token-based link flow for registration and password reset      |

---

## 8. Session Management

> **Plain English:** A "session" is an active login. When you sign in from your laptop, that creates one session. If you sign in from your phone too, that creates a second session. Sessions can be viewed and revoked from Settings.

### 8.1 Token Configuration

MeetIO uses secure auth cookies managed by **FastAPI Users**.

**Storage:** The primary auth cookie and the dedicated refresh cookie are both stored in HttpOnly cookies — they are invisible to JavaScript and cannot be stolen by browser scripts.

### 8.2 Concurrent Sessions Policy

**Multiple simultaneous sessions are allowed.** A user can be logged in on their laptop and phone at the same time.

- Each device/browser gets its own independent session.
- Revoking one session does not affect others.
- **Exception:** Changing password or resetting password invalidates all sessions on all devices — the user must sign in again everywhere.
- Session revocation uses the dedicated refresh token cookie and the server-side session record, so logout is immediate and device-specific.

### 8.3 Session Revocation Behavior

When a session is revoked (from Settings > Active Sessions):

- The refresh token for that session is immediately invalidated on the server.
- The dedicated `refresh_token` cookie on that device is invalidated on the server.
- The next API call made using that session's primary auth cookie will fail with a 401 (Unauthorized) error.
- The active WebSocket connection for that session is closed within 30 seconds.
- The user on that device is redirected to `/signin`.

### 8.4 Token Rotation Triggers

| Situation                      | What Happens                                 |
| ------------------------------ | -------------------------------------------- |
| User links a new auth provider | Old session invalidated, new one issued      |
| User removes an auth provider  | Old session invalidated, new one issued      |
| User changes password          | All sessions on all devices invalidated      |
| User resets password           | All sessions on all devices invalidated      |

### 8.5 Refresh Flow

```
Primary auth session expires after 4 hours
→ Client automatically uses the refresh cookie to obtain a new primary auth session
→ Server validates the refresh token
→ New primary auth session issued (lasts 4 more hours)
→ User never sees a login prompt

Refresh token expires after 15 days
→ Client tries to refresh, server rejects it
→ User is prompted to log in again
```

---

## 9. Dashboard

### 9.1 Overview

The dashboard is the main landing page for authenticated users after signing in. It is the "home base" — a snapshot of everything relevant to the user: recent meetings, pending action items, stats, and upcoming meetings.

### 9.2 Layout

```
Dashboard
├── Header (user avatar, name, settings)
├── Action Cards (3)
│   ├── Start Instant Meeting   ← creates and opens a meeting immediately
│   ├── Join via Link           ← paste a meeting link to join
│   └── Schedule Meeting        ← opens calendar scheduling flow
├── Recent Meeting Recaps (up to 5 most recent)
├── My Action Items (up to 10 open items)
├── Stats Cards
│   ├── Meeting Count (this week / this month)
│   └── Time Spent (total hours / average minutes per meeting)
└── Upcoming Meetings (next 5 scheduled)
```

### 9.3 API Endpoints

| Endpoint                       | Method | What It Returns                        |
| ------------------------------ | ------ | -------------------------------------- |
| `/v1/dashboard/recaps`         | GET    | Last 5 meeting recaps with status      |
| `/v1/dashboard/action-items`   | GET    | User's 5 most urgent open action items |
| `/v1/dashboard/stats`          | GET    | Meeting count and time stats           |
| `/v1/dashboard/upcoming`       | GET    | Next upcoming scheduled meetings       |
| `/v1/dashboard/recent-meeting` | GET    | Last meeting recaps with status        |

and upcoming meetings adn recent -meeting are switrch using toggle and ui collosal animation effect.

### 9.4 Real-Time Updates

The dashboard updates live without the user needing to refresh, for:

- A new meeting recap becoming ready
- An action item being assigned to the user
- A new meeting being scheduled
- A meeting status changing (upcoming → in progress → completed)

### 9.5 Performance

- Dashboard data is cached for 5 minutes (faster load times).
- Large datasets are paginated — no loading an entire meeting history.
- Recap content loads lazily — only fetched when the user scrolls to it.

---

## 10. Calendar

### 10.1 Features

| Feature              | Description                                                             |
| -------------------- | ----------------------------------------------------------------------- |
| View modes           | Day, Week, Month views                                                  |
| Meeting events       | All scheduled MeetIO meetings shown                                     |
| Event creation       | Create new scheduled meetings from the calendar                         |
| Event editing        | Modify existing meetings                                                |
| Event deletion       | Cancel scheduled meetings                                               |
| Google Calendar sync | Two-way sync — changes in either calendar reflect in both               |
| Conflict detection   | Warning shown if you try to schedule a meeting during an existing event |
| Manual availability  | Host sets custom free/busy slots                                        |
| Time zone support    | All times stored in UTC, displayed in the user's local time zone        |

### 10.2 Google Calendar Integration

**Connecting:** User connects Google Calendar via OAuth → MeetIO stores a secure token → two-way sync begins.

**Keeping in sync:** Google sends updates to MeetIO via a push notification channel. These channels expire automatically (Google allows a maximum of ~7 days per channel). MeetIO renews these channels automatically every 24 hours, targeting channels that expire within the next 48 hours. If renewal fails: the user receives an in-app notification and email, and calendar sync is disabled until they reconnect.

### 10.3 Calendar Conflict Resolution UI

**Scope:** Checks only against the host's own calendar.

```
┌──────────────────────────────────────────────────────┐
│  Time                                                │
│  [10:00 AM ▾]   to   [11:00 AM ▾]                   │
│                                                      │
│  ⚠  You have a conflict at this time                 │
│     Google Calendar shows "Design Review"            │
│     from 10:00 – 10:30 AM on this day.              │
│     [Schedule anyway]   [See free slots]             │
└──────────────────────────────────────────────────────┘
```

### 10.4 Google Calendar Webhook Retry

If a Google Calendar update fails to process:

```
Retry strategy:
  Attempt 1: immediately
  Attempt 2: 30 seconds
  Attempt 3: 2 minutes
  Attempt 4: 10 minutes
  Attempt 5: 30 minutes

All 5 fail → event written to a dead-letter queue
           → in-app alert: "Your Google Calendar sync may be out of date."
```

Dead-letter queue is retried by a background job every 30 minutes.

---

## 11. Messenger

### 11.1 Overview

Real-time messaging between authenticated users. Supports 1-on-1 direct messages and group chats. **All messages are end-to-end encrypted (E2E)** — MeetIO's servers store only encrypted data and can never read anyone's messages.

### 11.2 What End-to-End Encryption Means for Users

> **Plain English:** E2E encryption means that messages are locked on your device before being sent to our servers. Only the intended recipients can unlock them. Even if someone hacked our servers, they would only find unreadable scrambled data.

- **You generate a private key on your device.** This key never leaves your device.
- **Your public key is stored on our server** and shared with people you message, so they can encrypt messages that only you can read.
- **Messages are encrypted in your browser** before being sent to our server.
- **Our server never sees your message content.** It only stores and routes the encrypted data.

**Key backup and recovery:**

```
When you create an account:
→ A key pair is generated in your browser
→ You are prompted: "Set a backup passphrase to recover messages on new devices"
→ Your private key is encrypted with your passphrase (on your device, not our server)
→ The encrypted backup is stored on our server

If you lose access and need to recover:
→ Enter your passphrase on your new device
→ Your private key is decrypted locally
→ Message history is restored

Passphrase lost → message history is unrecoverable (by design — we cannot decrypt it)
```

### 11.3 Features

**1:1 Private Chat:** Direct messaging, full message history, online status indicators, typing indicators, read receipts, client-side search (search runs on your device, not our servers).

**Group Chat:** Group creation, member management, @mentions, admin controls, automatic key rotation when a member is removed (so removed members cannot read future messages).

**Message Types:** Text, emojis, file attachments, link previews, message replies, reactions.

### 11.4 File Size Limits

| File Type   | Max Size |
| ----------- | -------- |
| Images      | 10 MB    |
| Videos      | 100 MB   |
| Documents   | 25 MB    |
| Other files | 10 MB    |

---

## 12. Meeting History

### 12.1 Overview

Authenticated users can view all past meetings with recordings, AI recaps, and raw transcripts.

### 12.2 Meeting Detail View

**Three tabs per meeting:**

1. **Recording** — Video player with play/pause, seek, speed control (0.5x–2x), volume, and fullscreen. Download option available. Host can delete the recording.
2. **AI Recap** — Meeting summary, AI transcript, key decisions, participant list, and action items.
3. **Raw Transcript** — Full verbatim transcript with speaker labels and timestamps. Searchable. Exportable.

**Transcript sync with recording:** Clicking on any line in the transcript jumps the video to that exact moment. The current transcript segment is highlighted as the video plays.

### 12.3 Export Options

| Format | Content                                                   |
| ------ | --------------------------------------------------------- |
| Text   | Plain text transcript                                     |
| PDF    | Formatted, printable transcript document                  |
| JSON   | Structured data (for developers or integrations)          |
| SRT    | Subtitle format for importing into video editing software |

---

## 13. Action Items

### 13.1 Overview

Action items are tasks extracted from meetings by AI, or added manually by participants. They are tracked across the app and assignable to any authenticated participant.

### 13.2 Data Model

```python
class ActionItem(BaseModel):
    action_item_id: str
    meeting_id: str
    meeting_name: str
    task: str
    task_details: str
    assigned_to: str | None             # user_id, null = unassigned
    assigned_to_name: str
    created_by: str
    updated_by: str

    priority: Literal['high', 'medium', 'low']
    status: Literal['pending', 'in_progress', 'done', 'blocked']

    due_date: datetime | None
    due_date_source: Literal['ai_suggested', 'host_set', 'not_set']
    due_date_raw_phrase: str | None
    due_date_confidence: Literal['high', 'low'] | None

    ai_confidence: int                  # 0–100
    host_edited: bool
    auto_confirmed: bool

    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    schema_version: int = 1
```

### 13.3 Edit Rights

| Action                    | Host | Co-host | Assigned User | Other Auth |
| ------------------------- | :--: | :-----: | :-----------: | :--------: |
| View all action items     |  ✅  |   ✅    |      ✅       |     ✅     |
| Create action item        |  ✅  |   ✅    |      ✅       |     ✅     |
| Edit task description     |  ✅  |   ✅    | ✅ (own only) |     ❌     |
| Delete action item        |  ✅  |   ❌    |      ❌       |     ❌     |
| Assign to any participant |  ✅  |   ✅    |      ❌       |     ❌     |
| Update own status         |  ✅  |   ✅    |      ✅       |     ✅     |

---

## 14. Notifications

### 14.1 Notification Types

| Type                         | Trigger                                    | Channel                |
| ---------------------------- | ------------------------------------------ | ---------------------- |
| `recap.ready`                | AI recap finished generating               | In-app + email         |
| `recap.failed`               | AI pipeline failed after all retries       | In-app + email         |
| `transcript.ready`           | Raw transcript ready                       | In-app                 |
| `recording.ready`            | Recording available                        | In-app + email         |
| `action_item.assigned`       | Action item assigned to you                | In-app + email         |
| `action_item.due_reminder`   | Due date approaching (daily 9am UTC check) | In-app + email         |
| `action_item.auto_confirmed` | Host's 2hr window lapsed                   | In-app + email to host |
| `meeting.starting_soon`      | Scheduled meeting starting in 15 min       | In-app                 |
| `gcal.sync_failed`           | Google Calendar sync error                 | In-app + email         |

### 14.2 In-App Notification Bell

- Bell icon in the header with unread count badge.
- Dropdown shows the 20 most recent notifications.
- Click any notification → navigates to the relevant page.
- Mark individual as read, or mark all as read.
- Notifications expire after 90 days.

### 14.3 Email Notification Preferences

Users can individually toggle each email notification type in Settings > Notifications. In-app notifications cannot be disabled.

---

## 15. Settings

### 15.1 Settings Sections

**Account**

- Change display name
- Change email address (requires OTP verification)
- Change password (requires current password)
- Enable/disable two-factor authentication (TOTP)
- Linked accounts (view and unlink Google)

**Notifications**

- Toggle each email notification type on/off

**Privacy & Data**

- Download all your data (GDPR data export — delivered within 72 hours)
- Delete account (30-day soft delete, then permanent)

**Sessions**

- View all active sessions (device, location, last used)
- Revoke any session remotely

**Login History**

- View the last 90 days of login activity (device, IP, timestamp)

### 15.2 Account Deletion Flow

```
User clicks "Delete Account"
→ Confirmation dialog: "This will permanently delete your account in 30 days. You can cancel anytime before then."
→ User confirms
→ Account marked for deletion
→ 30-day countdown begins (user can cancel during this window)
→ After 30 days: account, meetings, messages, recordings permanently deleted
```

---

## 16. User Profile Management

### 16.1 Profile Fields

| Field               | Source                      | Editable                   |
| ------------------- | --------------------------- | -------------------------- |
| Display name        | User input or Google import | ✅                         |
| Email               | Signup or Google            | ✅ (with OTP verification) |
| Avatar              | Upload or Google import     | ✅                         |
| Timezone            | Auto-detected or manual     | ✅                         |
| Language preference | Browser default or manual   | ✅                         |

### 16.2 Avatar Handling

- Uploaded images are re-encoded to WebP format before storage (this strips hidden metadata).
- Stored in Cloudflare R2 (separate bucket from recordings).
- Uploaded files are never stored on the server disk.

---

## 17. Infrastructure & Background Jobs

### 17.1 Celery + Redis

> **Plain English:** Celery is a task queue. Instead of making users wait for slow operations (like generating AI summaries), MeetIO queues them as background jobs and notifies users when they are done.

All async work runs through Celery workers with Redis as the message broker and result store.

### 17.2 Celery Task Registry

| Task                          | What Triggers It                              | What It Does                                                               |
| ----------------------------- | --------------------------------------------- | -------------------------------------------------------------------------- |
| `run_deepgram_job`            | Recording file saved (`egress_ended` webhook) | Sends audio to Deepgram for transcription                                  |
| `run_llm_pipeline`            | Deepgram job completes                        | Runs summary, AI transcript, decisions, action items in parallel           |
| `finalize_recap`              | All 4 LLM tasks complete                      | Marks recap ready, notifies host, schedules auto-confirm                   |
| `auto_confirm_action_items`   | 2 hours after host notification               | Confirms pending action items automatically                                |
| `send_email`                  | Various triggers                              | Sends notification emails via Resend                                       |
| `send_due_date_reminders`     | Celery Beat (daily 9am UTC)                   | Checks due dates and sends reminders                                       |
| `renew_expiring_channels`     | Celery Beat (daily)                           | Renews Google Calendar push notification channels expiring within 48h      |
| `process_dlq`                 | Celery Beat (every 30 min)                    | Retries failed webhook events from the dead-letter queue                   |
| `purge_expired_guest_data`    | Celery Beat (daily 2am UTC)                   | Deletes guest session data older than 24h after meeting ended              |
| `purge_expired_chat_messages` | Celery Beat (daily 2am UTC)                   | Deletes chat_messages where purge_at has passed (same pass as guest purge) |
| `process_pending_deletions`   | Celery Beat (daily 2:30am UTC)                | Permanently deletes accounts that have been in the 30-day deletion window  |
| `expire_old_recordings`       | Celery Beat (daily 3am UTC)                   | Deletes recordings older than 1 year from Cloudflare R2                    |

### 17.3 Dead Letter Queue

If a webhook event (from LiveKit or Google Calendar) fails to process after all retries, it is written to a `dead_letter_events` collection and retried by the background job every 30 minutes. This prevents data loss from temporary service outages.

---

## 18. Offline & Degraded Mode

### 18.1 Approach

**v0: Degraded mode only.** Full offline mode (full caching, queued actions) is deferred to v1. In v1, the app detects connection loss, shows it clearly, blocks actions that require the network, and automatically recovers when the connection returns.

### 18.2 Mid-Meeting Connection Drop

```
User loses connection during meeting
→ LiveKit detects the disconnect
→ Banner appears: "🔄  Reconnecting..."

→ LiveKit automatically tries to reconnect (up to 30 seconds)

If reconnected: Banner disappears. Meeting continues normally.

If not reconnected after 30 seconds:
→ Banner changes: "❌  Connection lost."
  [Rejoin Meeting]    [Leave]
```

### 18.3 Offline While Browsing App

```
User goes offline
→ Top banner appears: "⚠  No internet connection — some features unavailable"

Disabled while offline:
  - Start meeting
  - Schedule meeting
  - Send messages

Read-only actions still work from browser cache (e.g. viewing past meeting history).

User comes back online → banner disappears automatically.
```

---

## 19. Data Model Versioning

### 19.1 Database & Migration Tool

**Database:** MongoDB · **Migration tool:** `migrate-mongo`

### 19.2 Versioning Strategy

| Change type          | Migration required | Example                                |
| -------------------- | ------------------ | -------------------------------------- |
| Add optional field   | ❌ No              | Adding `feedback_tags` to `Meeting`    |
| Add new collection   | ❌ No              | New `DeadLetterEvent` collection       |
| Add required field   | ✅ Yes             | Adding `providers[]` to `User`         |
| Rename field         | ✅ Yes             | `name` → `display_name`                |
| Change field type    | ✅ Yes             | `status: str` → `status: enum`         |
| Remove field         | ✅ Yes             | Dropping `github_id` from `User`       |
| Restructure document | ✅ Yes             | Nesting flat fields into a subdocument |
| Add index            | ✅ Yes             | New compound index on `meetings`       |

### 19.3 CI/CD Integration

Migrations run automatically on every deploy. A migration failure stops the deploy — the server never starts until the migration succeeds.

### 19.4 Developer Checklist — Before Merging Any PR

```
Before merging any PR that touches MongoDB models:
□ Am I renaming a field?            → migration required
□ Am I adding a required field?     → migration required
□ Am I changing a field's type?     → migration required
□ Am I removing a field?            → migration required
□ Am I adding an index?             → migration required
□ Am I only adding optional fields? → no migration needed
□ Did I increment schema_version?   → yes, on any breaking change
```

---

## 20. Deferred to v1

| Item                               | Why Deferred                                                         |
| ---------------------------------- | -------------------------------------------------------------------- |
| GitHub OAuth                       | Adds complexity for minimal gain over Google + Email in v1           |
| Guest recovery email               | Two in-session migration chances are sufficient for v1               |
| Outlook calendar integration       | Google Calendar covers the majority of target users                  |
| Full offline mode                  | Service workers, IndexedDB sync — degraded mode is sufficient for v1 |
| Messenger audit log                | `updated_by` field covers v1 needs                                   |
| Signal Protocol (E2E upgrade)      | libsodium covers v1 security needs. Signal Protocol for mobile in v2 |
| Mobile app                         | Web-only in v1                                                       |
| Admin dashboard                    | Not needed until multi-tenant use cases emerge                       |
| Participant cap increase beyond 50 | Revisit after v1 load testing                                        |

---

## 21. Appendix — Recommended Build Order

Built for a **solo developer**. Each phase delivers something shippable.

```
Phase 1 — Core meeting infrastructure (ship: basic video meetings)
├── MongoDB setup + migrate-mongo configured
├── Redis + Celery configured
├── LiveKit Cloud account + token generation (server-side only)
├── Auth — email/password + Google OAuth + HttpOnly cookies
├── Guest join flow + display name deduplication
├── Pre-meeting lobby (device controls, auth + guest versions)
├── Max participants enforcement (50 per meeting)
├── Composite recording (LiveKit Egress → Cloudflare R2)
├── Waiting room (host admit panel + guest re-knock flow)
├── Recording consent banner (shown to all participants on recording start)
└── Guest mid-meeting sign in/up modal (conversion flow)

Phase 2 — Transcription (ship: live captions + post-meeting transcript)
├── Deepgram live captions (LiveKit native integration)
├── Post-meeting Deepgram job (Celery — triggered by egress_ended webhook)
├── Speaker → participant matching
└── Guest name dedup + conversion re-labeling in transcript

Phase 3 — AI Recap pipeline (ship: summaries, action items)
├── LLM prompt pipeline (summary, decisions, AI transcript) — OpenAI GPT-4o default
├── Action item extraction + confidence + due date parsing
├── Host confirmation UI + 2hr auto-confirm (Celery Beat)
├── AI pipeline failure states + retry logic
└── Notification system (email via Resend + in-app WebSocket)

Phase 4 — Post-meeting screens (ship: full recap experience)
├── End-of-meeting lobby (auth + guest versions)
├── Recording player (with transcript sync)
├── Raw transcript viewer (searchable)
├── AI recap page
├── Action items management (all edit rights)
└── Meeting history page

Phase 5 — Messenger (ship: secure DMs + group chat)
├── E2E key generation (tweetnacl, browser — non-extractable CryptoKey storage)
├── Key backup with passphrase encryption (client-side AES-GCM before upload)
├── Key exchange (1-on-1 + group)
├── Message send/receive (ciphertext only — server never sees plaintext)
└── Client-side search

Phase 6 — Platform features (ship: full platform)
├── Dashboard (WebSocket real-time updates)
├── Calendar + Google Calendar sync + conflict UI
├── Google Calendar webhook retry + dead-letter queue
├── Settings (all sections including session management)
├── User profile management
└── Offline / degraded mode (banner + reconnect flow)
```

---

## 22. Changelog

### — April 30, 2026

| #   | Change                                                                                                              | Section    |
| --- | ------------------------------------------------------------------------------------------------------------------- | ---------- |
| #3  | AI pipeline triggered by `egress_ended` (not `room_finished`) — recording must be saved before transcription starts | §4.1, §5.2 |
| #7  | Recording consent banner added — all participants see a non-dismissable banner when recording starts                | §4.2       |
| #12 | Email provider corrected to Resend only (removed incorrect "SendGrid" reference)                                    | §1.2       |
| #13 | Concurrent session policy added — multiple sessions allowed; password change invalidates all                        | §8.2, §8.3 |
| #14 | Maximum participants per meeting set to 50 with enforcement spec                                                    | §2.9       |
| #16 | AI provider recommendation moved here from TRD — GPT-4o default, Anthropic as fallback                              | §1.2, §5.2 |
| #18 | In-meeting controls legend clarified — replaced ambiguous lock/unlock icons with plain text                         | §2.4       |
| #19 | Host departure grace period behavior fully specified — reconnect, co-host takeover, and meeting end cases           | §2.6       |
| #21 | "Raw Transcript" and "AI Transcript" formally defined                                                               | §5.1       |

---

_Status: Current_
_Last Updated: April 30, 2026_
_Ready for build._

