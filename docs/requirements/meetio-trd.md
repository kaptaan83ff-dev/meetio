# MeetIO — Technical Requirements Document

> **Version:** 1.0 (patched)
> **Status:** Current
> **Last Updated:** April 30, 2026
> **Derived From:** MeetIO PRD
> **Change summary from v0:** Severities #2 #3 #4 #5 #6 #8 #9 #10 #11 #15 #17 #20 resolved. See §19 Changelog.

---

## How to Read This Document

This document describes **how MeetIO is built** — architecture decisions, code patterns, integrations, security, and deployment. It is written to be understood by both the engineer implementing the system and a technical reviewer checking the implementation.

**Companion documents:**

- `meetio-prd.md` — What to build and why (product requirements)
- `meetio-db-schema.md` — Database collection definitions, field types, and indexes
- `meetio-api-spec.md` — Every API endpoint with request/response shapes

---

## Table of Contents

1. [Overview](#1-overview)
2. [System Architecture](#2-system-architecture)
3. [Infrastructure & Deployment](#3-infrastructure--deployment)
4. [Environment Configuration](#4-environment-configuration)
5. [API Design Standards](#5-api-design-standards)
6. [Database](#6-database)
7. [Security Requirements](#7-security-requirements)
8. [GDPR Compliance](#8-gdpr-compliance)
9. [Performance & SLAs](#9-performance--slas)
10. [WebSocket Architecture](#10-websocket-architecture)
11. [Celery Task Architecture](#11-celery-task-architecture)
12. [Third-Party Integrations](#12-third-party-integrations)
13. [E2E Encryption Implementation](#13-e2e-encryption-implementation)
14. [CI/CD Pipeline](#14-cicd-pipeline)
15. [Testing Strategy](#15-testing-strategy)
16. [Observability & Monitoring](#16-observability--monitoring)
17. [Error Handling Standards](#17-error-handling-standards)
18. [API Versioning](#18-api-versioning)
19. [Changelog](#19-changelog)

---

## 1. Overview

### 1.1 Purpose

This document translates the MeetIO PRD into concrete engineering specifications, implementation constraints, and operational requirements. It is the authoritative reference for all engineering decisions in v1.

### 1.2 Scope

Web application only. No mobile app. All features listed in PRD Sections 1–19. PRD Section 20 items are explicitly out of scope.

### 1.3 Technology Stack (Confirmed)

| Layer                | Technology                                                                     | Version                        |
| -------------------- | ------------------------------------------------------------------------------ | ------------------------------ |
| Frontend             | React (TSX) + Vite SPA                                                         | React 18.3.x, Vite 5.x         |
| Frontend Routing     | React Router                                                                   | v6 (`createBrowserRouter`)     |
| Frontend State       | Zustand                                                                        | 4.x                            |
| Frontend Styling     | Tailwind CSS                                                                   | 3.x                            |
| Backend              | Python + FastAPI                                                               | Python 3.12, FastAPI 0.110+    |
| Database             | MongoDB                                                                        | 7.x (Atlas free tier)          |
| Cache / Broker       | Redis                                                                          | 7.x (Upstash free tier)        |
| Background Jobs      | Celery + Celery Beat                                                           | 5.x                            |
| Real-time Video      | LiveKit Cloud                                                                  | Free tier                      |
| Real-time App Events | WebSocket (FastAPI) + Redis pub/sub                                            | Native                         |
| Live Transcription   | Deepgram STT                                                                   | LiveKit native integration     |
| Post-meeting STT     | Deepgram                                                                       | Post-processing API            |
| AI Pipeline          | OpenAI GPT-4o **or** Anthropic Claude (configurable via `AI_PROVIDER` env var) | Latest                         |
| Recording Storage    | Cloudflare R2                                                                  | Free tier (10 GB/month)        |
| Email                | Resend + Mailpit (dev-only)                                                    | Free tier (3,000 emails/month) |
| Schema Migrations    | migrate-mongo                                                                  | Latest                         |
| E2E Encryption       | tweetnacl (browser), PyNaCl (server)                                           | Latest                         |

| Auth Library | FastAPI Users (latest) | Library-managed auth flows (registration, login, OAuth, password reset) |
| JWT Library | PyJWT ≥ 2.8.0 | Used internally by FastAPI Users; also for any standalone token needs |

| JWT Library | **PyJWT** ≥ 2.8.0 | ≥ 2.8.0 |
| Frontend Hosting | Cloudflare Pages (recommended) | — |
| Backend Hosting | Railway (recommended) | — |

> **Auth Strategy:** Use `fastapi-users` for core authentication flows (registration, login, OAuth, password reset). This ensures industry-standard security and session management. Use `PyJWT>=2.8.0` for any internal/standalone token needs. Do **not** use `python-jose`. See §7.1 for implementation.

### 1.4 Target Scale

- **Concurrent users:** 100–500 (students & small teams)
- **Concurrent meetings:** ~50–150 (estimated 3–4 participants avg)
- **Max participants per meeting:** 50 (enforced server-side on token generation)
- **WebSocket connections:** up to 500 persistent connections
- **Celery workers:** 2–4 worker processes for free tier

### 1.5 Project Structure

- Folder Structure:

meetio/
├── backend/
│ ├── app/
│ │ ├── main.py
│ │ ├── routers/
│ │ ├── services/
│ │ ├── models/
│ │ ├── tasks/
│ │ ├── websocket/
│ │ ├── prompts/
│ │ └── config.py
│ ├── tests/
│ ├── migrations/
│ ├── pyproject.toml
│ └── Dockerfile
├── frontend/
│ ├── src/
│ │ ├── stores/
│ │ ├── pages/
│ │ ├── components/
│ │ ├── hooks/
│ │ ├── lib/
│ │ └── config/
│ ├── public/
│ ├── index.html
│ └── package.json
└── .github/
--└── workflows/

Execution — from backend/ folder:

cd backend
uvicorn app.main:app --reload
Why backend/ not root: pyproject.toml lives in backend/ — the venv is created there. Running from root would require extra path config for no benefit.

Why app/ inside backend/: Keeps pyproject.toml, Dockerfile, tests/, and migrations/ at the same level — clean separation. app.main:app is the standard FastAPI import convention.
Why src/ inside frontend/: Vite's default. All component/store/hook code lives in src/ — public/ and index.html stay at frontend/ root.

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BROWSER (React SPA)                          │
│                                                                      │
│  Routing: React Router v6 (createBrowserRouter)                     │
│  State:   Zustand stores (auth, meeting, ui, notifications)         │
│  Styling: Tailwind CSS (utility classes only, no component library)  │
│                                                                      │
│  Pages / Components                                                  │
│  ├── Auth (sign in / sign up / OTP / Google OAuth)                  │
│  ├── Pre-meeting lobby (device setup)                               │
│  ├── In-meeting (LiveKit SDK + WebSocket client)                    │
│  ├── Post-meeting (recap, transcript, recording)                    │
│  ├── Dashboard, Calendar, Messenger, Action Items                   │
│  └── Settings, Profile                                              │
│                                                                      │
│  Client-side only:                                                  │
│  ├── tweetnacl (E2E message encryption / decryption)                │
│  ├── Web Crypto API (non-extractable key storage — see §13)         │
│  ├── IndexedDB / idb (private key storage — non-extractable)        │
│  └── navigator.mediaDevices (device enumeration in lobby)           │
└────────────────┬────────────────────────────────────────────────────┘
                 │
         ┌───────┴──────────────────────────────────┐
         │                                          │
         ▼                                          ▼
┌─────────────────────┐                ┌──────────────────────────┐
│   FastAPI Backend   │                │    LiveKit Cloud (SFU)   │
│                     │                │                          │
│  REST API /v1/*     │◄───token───────│  WebRTC video/audio      │
│  Auth endpoints     │                │  Composite recording     │
│  Webhook receivers  │                │  LiveKit Egress → R2     │
│  WebSocket server   │◄───events──────│  Deepgram live captions  │
│  Celery dispatcher  │                └──────────────────────────┘
└──────┬──────────────┘
       │
  ┌────┴─────────────────────────────────────────┐
  │                                              │
  ▼                                              ▼
┌──────────┐   ┌────────────────────────────────────────────┐  ┌───────────────────┐
│ MongoDB  │   │   Redis (Upstash)                          │  │  Cloudflare R2    │
│ (Atlas)  │   │   ├── Celery broker + result backend       │  │  (Recordings MP4) │
│          │   │   ├── Dashboard cache                      │  └───────────────────┘
│ All data │   │   └── WebSocket pub/sub fan-out (ws:user:*)│
└──────────┘   └────────────────┬───────────────────────────┘
                                │
                    ┌───────────┴──────────────────────┐
                    │   Celery Workers (2–4 processes)  │
                    │   ├── Post-meeting STT (Deepgram) │
                    │   ├── LLM pipeline (4 tasks)      │
                    │   ├── Email dispatch (Resend)     │
                    │   ├── GCal channel renewal        │
                    │   └── Dead-letter retry           │
                    └──────────────────────────────────┘
```

> **WebSocket fan-out:** Celery workers publish events to Redis (`ws:user:{user_id}` channels). All FastAPI instances subscribe via pub/sub and forward to their local connections. This ensures events reach users regardless of which instance they are connected to. See §10 for full implementation.

### 2.2 Request Flow Standards

- All browser → FastAPI communication is HTTPS (TLS 1.2+).
- LiveKit tokens are generated server-side only — never in the browser.
- WebSocket connections use `wss://` exclusively.
- Cookies are HttpOnly, Secure, SameSite=Lax.

### 2.3 Frontend Routing Structure (React Router v6)

Routes are defined in a central `router.tsx` using `createBrowserRouter`. No file-system-based routes. All routes render as a client-side SPA — the hosting platform must be configured to redirect all paths to `index.html`.

```
/                          → Redirect to /dashboard (if auth) or /signin
/signin                    → Sign-in page
/signup                    → Sign-up page
/forgot-password           → Password reset
/meeting/[id]/lobby        → Pre-meeting lobby (auth + guest versions)
/meeting/[id]              → In-meeting room
/dashboard                 → Dashboard (auth only)
/calendar                  → Calendar (auth only)
/messenger                 → Messenger (auth only)
/messenger/[id]            → Conversation (auth only)
/meetings/[id]/recap       → Post-meeting recap (auth only)
/meetings/[id]/transcript  → Raw transcript viewer (auth only)
/meetings/[id]/recording   → Recording player (auth only)
/action-items              → Action items list (auth only)
/settings                  → Settings (auth only)
/profile                   → User profile (auth only)
```

**SPA fallback configuration** (required for client-side routing):

```
# Cloudflare Pages — public/_redirects
/* /index.html 200

# Vercel — vercel.json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

### 2.4 Frontend State Management (Zustand)

State is organized into **four domain stores**. Each store is a separate Zustand slice. No single global store — this keeps bundles small and avoids unnecessary re-renders.

#### `authStore`

```typescript
// src/stores/authStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  providers: string[];
}

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setLoading: (isLoading) => set({ isLoading }),
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    { name: "meetio-auth", partialize: (s) => ({ user: s.user }) },
  ),
);
```

#### `meetingStore`

> **Fix #10:** `clearMeeting()` now resets all six fields including `roomLocked`, `waitingRoomEnabled`, and `reactionsEnabled`. Previously only four fields were reset, causing the next meeting to inherit stale state.
>
> **Fix #17:** `toggleRecording()` renamed to `setRecording(isRecording: boolean)`. The old name implied the store was toggling state itself; the correct pattern is for the server to confirm the state and the store to reflect it. Components call `setRecording(true/false)` only after server confirmation.

```typescript
// src/stores/meetingStore.ts
import { create } from "zustand";

interface Participant {
  sessionId: string;
  userId: string | null;
  displayName: string;
  role: "host" | "co-host" | "participant" | "guest";
  isGuest: boolean;
}

interface MeetingStore {
  meetingId: string | null;
  participants: Participant[];
  waitingRoom: Participant[];
  isRecording: boolean;
  roomLocked: boolean;
  waitingRoomEnabled: boolean;
  reactionsEnabled: boolean;
  setMeeting: (id: string) => void;
  setParticipants: (participants: Participant[]) => void;
  addToWaitingRoom: (participant: Participant) => void;
  removeFromWaitingRoom: (sessionId: string) => void;
  setRecording: (isRecording: boolean) => void; // ← renamed from toggleRecording
  setRoomLocked: (locked: boolean) => void;
  setWaitingRoomEnabled: (enabled: boolean) => void;
  setReactionsEnabled: (enabled: boolean) => void;
  clearMeeting: () => void;
}

export const useMeetingStore = create<MeetingStore>()((set) => ({
  meetingId: null,
  participants: [],
  waitingRoom: [],
  isRecording: false,
  roomLocked: false,
  waitingRoomEnabled: false,
  reactionsEnabled: false,
  setMeeting: (meetingId) => set({ meetingId }),
  setParticipants: (participants) => set({ participants }),
  addToWaitingRoom: (p) => set((s) => ({ waitingRoom: [...s.waitingRoom, p] })),
  removeFromWaitingRoom: (id) =>
    set((s) => ({
      waitingRoom: s.waitingRoom.filter((p) => p.sessionId !== id),
    })),
  setRecording: (isRecording) => set({ isRecording }),
  setRoomLocked: (roomLocked) => set({ roomLocked }),
  setWaitingRoomEnabled: (waitingRoomEnabled) => set({ waitingRoomEnabled }),
  setReactionsEnabled: (reactionsEnabled) => set({ reactionsEnabled }),

  // ✅ Fix #10: All 7 fields reset — including roomLocked, waitingRoomEnabled, reactionsEnabled
  clearMeeting: () =>
    set({
      meetingId: null,
      participants: [],
      waitingRoom: [],
      isRecording: false,
      roomLocked: false,
      waitingRoomEnabled: false,
      reactionsEnabled: false,
    }),
}));
```

**Recording state pattern — correct usage:**

```typescript
// ✅ Correct — set from server confirmation
const handleRecordingStarted = () => {
  setRecording(true); // called only after server confirms recording started
};

// ❌ Wrong — old toggle pattern
const handleRecordingStarted = () => {
  toggleRecording(); // this no longer exists
};
```

#### `uiStore`

```typescript
// src/stores/uiStore.ts
import { create } from "zustand";

interface UIStore {
  isChatOpen: boolean;
  isParticipantsOpen: boolean;
  isCaptionsEnabled: boolean;
  isOffline: boolean;
  activeModal: string | null;
  theme: "light" | "dark" | "system";
  toggleChat: () => void;
  toggleParticipants: () => void;
  toggleCaptions: () => void;
  setOffline: (offline: boolean) => void;
  openModal: (modal: string) => void;
  closeModal: () => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
}

export const useUIStore = create<UIStore>()((set) => ({
  isChatOpen: true,
  isParticipantsOpen: false,
  isCaptionsEnabled: false,
  isOffline: false,
  activeModal: null,
  theme: "system",
  toggleChat: () => set((s) => ({ isChatOpen: !s.isChatOpen })),
  toggleParticipants: () =>
    set((s) => ({ isParticipantsOpen: !s.isParticipantsOpen })),
  toggleCaptions: () =>
    set((s) => ({ isCaptionsEnabled: !s.isCaptionsEnabled })),
  setOffline: (isOffline) => set({ isOffline }),
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),
  setTheme: (theme) => set({ theme }),
}));
```

#### `notificationStore`

```typescript
// src/stores/notificationStore.ts
import { create } from "zustand";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (n: Notification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  setNotifications: (ns: Notification[]) => void;
}

export const useNotificationStore = create<NotificationStore>()((set) => ({
  notifications: [],
  unreadCount: 0,
  addNotification: (n) =>
    set((s) => ({
      notifications: [n, ...s.notifications],
      unreadCount: n.read ? s.unreadCount : s.unreadCount + 1,
    })),
  markRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      ),
      unreadCount: Math.max(0, s.unreadCount - 1),
    })),
  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),
  setNotifications: (notifications) =>
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
    }),
}));
```

**Store usage pattern:** Components import only the selectors they need.

```typescript
// ✅ Good — only subscribes to what it needs
const user = useAuthStore((s) => s.user);
const participants = useMeetingStore((s) => s.participants);

// ❌ Bad — causes re-render on any store change
const store = useAuthStore();
```

### 2.5 Styling Architecture (Tailwind CSS)

**No component library.** All UI is built with Tailwind CSS utility classes.

```typescript
// tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f4ff",
          500: "#4f6ef7",
          600: "#3a56e8",
          900: "#1a2a7a",
        },
        meeting: {
          bg: "#111827",
          tile: "#1f2937",
          controls: "#374151",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
```

**Component patterns:**

```typescript
const buttonBase =
  "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed";

const buttonVariants = {
  primary: "bg-brand-500 text-white hover:bg-brand-600",
  secondary:
    "bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100",
  danger: "bg-red-500 text-white hover:bg-red-600",
  ghost: "hover:bg-gray-100 dark:hover:bg-gray-800",
};

const buttonSizes = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};
```

**Dark mode:** `dark:` prefix throughout. `theme` in `uiStore` controls the `dark` class on `<html>`.

---

## 3. Infrastructure & Deployment

### 3.1 Deployment Options — Choose One

#### Option A: Cloudflare Pages + Railway (Recommended)

| Service           | Provider         | Free Tier                             | Notes                                 |
| ----------------- | ---------------- | ------------------------------------- | ------------------------------------- |
| Frontend          | Cloudflare Pages | Unlimited bandwidth, 500 builds/month | Best free CDN for SPAs                |
| Backend (FastAPI) | Railway          | $5 credit/month, ~500 hours           | Simple FastAPI deployment             |
| Celery Workers    | Railway          | Shared with backend credit            | Separate worker service               |
| MongoDB           | MongoDB Atlas    | M0: 512 MB, shared cluster            | Sufficient for v1 — monitor at 400 MB |
| Redis             | Upstash          | 10,000 commands/day, 256 MB           | See §9.5 for capacity planning        |
| Recording Storage | Cloudflare R2    | 10 GB/month free egress               | Already in stack                      |
| Email             | Resend           | 3,000 emails/month                    | Already in stack                      |

**Frontend deployment:**

```bash
# Build + deploy to Cloudflare Pages
npm run build
npx wrangler pages deploy dist --project-name meetio-frontend
```

**Backend deployment:**

```toml
# railway.toml (FastAPI service)
[build]
builder = "dockerfile"

[deploy]
startCommand = "uvicorn main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/health"
healthcheckTimeout = 30
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

#### Option B: Vercel + Railway

Use if you prefer Vercel DX or already have an account. Note: 100 GB/month bandwidth limit.

```json
// vercel.json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

### 3.2 Environments

| Environment     | Frontend         | Backend            | Database          | Purpose        |
| --------------- | ---------------- | ------------------ | ----------------- | -------------- |
| **Development** | `localhost:5173` | `localhost:8000`   | Local MongoDB     | Local dev      |
| **Staging**     | Preview URL      | Railway staging    | Atlas dev cluster | Pre-release QA |
| **Production**  | `meetio.app`     | Railway production | Atlas production  | Live           |

Never share databases across environments.

### 3.3 Dockerfile (FastAPI)

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml .
RUN pip install --no-cache-dir .

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 4. Environment Configuration

### 4.1 Required Environment Variables

#### FastAPI Backend

```bash
# App
APP_ENV=production
SECRET_KEY=<random 64-char hex>
FRONTEND_URL=https://meetio.app

# MongoDB
MONGODB_URI=mongodb+srv://...
MONGODB_DB_NAME=meetio

# Redis (Upstash — note rediss:// with TLS)
REDIS_URL=rediss://...

# JWT
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=240     # 4 hours
JWT_REFRESH_TOKEN_EXPIRE_DAYS=15

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://api.meetio.app/v1/auth/google/callback

# Google Calendar
GOOGLE_CALENDAR_WEBHOOK_URL=https://api.meetio.app/webhooks/google-calendar

# LiveKit
LIVEKIT_URL=wss://...livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...

# Deepgram
DEEPGRAM_API_KEY=...

# AI — switch provider by changing AI_PROVIDER only. No code change needed.
# See PRD §1.2 for provider recommendation.
AI_PROVIDER=openai                      # openai | anthropic
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...

# Meeting limits
MEETING_MAX_PARTICIPANTS=50             # enforced on token generation

# Cloudflare R2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=meetio-recordings
R2_PUBLIC_URL=https://recordings.meetio.app

# Email
RESEND_API_KEY=...
EMAIL_FROM=noreply@meetio.app
EMAIL_TRANSPORT=auto   # auto = console in development, Resend otherwise
MAILPIT_HOST=localhost
MAILPIT_PORT=1025

```

#### React Frontend (Vite)

```bash
# All vars below are inlined into the JS bundle at build time — NEVER place secrets here

VITE_API_URL=https://api.meetio.app
VITE_WS_URL=wss://api.meetio.app
VITE_LIVEKIT_URL=wss://...livekit.cloud
VITE_APP_ENV=production
VITE_SENTRY_DSN=...
```

```typescript
// src/config/env.ts
export const env = {
  apiUrl: import.meta.env.VITE_API_URL as string,
  wsUrl: import.meta.env.VITE_WS_URL as string,
  livekitUrl: import.meta.env.VITE_LIVEKIT_URL as string,
  appEnv: import.meta.env.VITE_APP_ENV as
    | "development"
    | "staging"
    | "production",
  sentryDsn: import.meta.env.VITE_SENTRY_DSN as string,
} as const;
```

### 4.2 AI Provider Configuration

```python
# backend/services/llm.py
class LLMAdapter:
    """
    Routes to the configured AI provider.
    Switch providers by changing AI_PROVIDER env var — no code change needed.
    """
    async def complete(self, system: str, user: str, max_tokens: int = 2000) -> str:
        if settings.AI_PROVIDER == "openai":
            return await self._openai(system, user, max_tokens)
        elif settings.AI_PROVIDER == "anthropic":
            return await self._anthropic(system, user, max_tokens)
        raise ValueError(f"Unknown AI provider: {settings.AI_PROVIDER}")
```

---

## 5. API Design Standards

### 5.1 Base URL

```
Production:   https://api.meetio.app/v1/
Staging:      https://api.staging.meetio.app/v1/
Development:  http://localhost:8000/v1/
```

### 5.2 Authentication

All protected endpoints use HttpOnly cookies:

```http
Cookie: fastapiusersauth=<session>; refresh_token=<opaque>
```

No `Authorization: Bearer` header. Cookies only — prevents XSS token theft.

### 5.3 Standard Response Envelope

```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": {
    "timestamp": "2026-04-29T10:00:00Z",
    "request_id": "req_abc123"
  }
}
```

**Error response:**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INVALID_OTP",
    "message": "The OTP provided is incorrect or expired.",
    "field": "otp"
  },
  "meta": {
    "timestamp": "2026-04-29T10:00:00Z",
    "request_id": "req_abc123"
  }
}
```

### 5.4 HTTP Status Code Usage

| Status | When to Use                          |
| ------ | ------------------------------------ |
| 200    | Successful GET, PUT, PATCH           |
| 201    | Successful resource creation (POST)  |
| 204    | Successful DELETE (no body)          |
| 400    | Validation error, malformed request  |
| 401    | Not authenticated                    |
| 403    | Authenticated but not authorized     |
| 404    | Resource not found                   |
| 409    | Conflict (e.g. email already exists) |
| 422    | Pydantic validation failure          |
| 429    | Rate limit exceeded                  |
| 500    | Unhandled server error               |
| 503    | Dependency unavailable               |

### 5.5 Pagination Standard

```
GET /v1/meetings?limit=20&cursor=<opaque_cursor>

Response:
{
  "data": { "items": [...], "next_cursor": "abc123", "has_more": true }
}
```

Default `limit` = 20. Max `limit` = 100.

### 5.6 Rate Limiting

| Endpoint Group          | Limit         | Window                       |
| ----------------------- | ------------- | ---------------------------- |
| Auth (sign in, sign up) | 10 requests   | per 15 min per IP            |
| OTP send                | 3 requests    | per 15 min per email         |
| OTP verify              | 5 attempts    | per OTP session              |
| Guest join              | 20 requests   | per 5 min per IP             |
| All other endpoints     | 200 requests  | per min per user             |
| Webhook receivers       | No rate limit | (authenticated by signature) |

### 5.7 CORS Configuration

```python
origins = [
    "https://meetio.app",
    "https://staging.meetio.app",
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-Request-ID"],
)
```

### 5.8 Full API Endpoint Inventory

> Full request/response shapes are in `meetio-api-spec.md`. This table is a navigational index only.

#### Auth (`/v1/auth/`)

| Endpoint                | Method | Auth           | Description                 |
| ----------------------- | ------ | -------------- | --------------------------- |
| `/v1/auth/register`     | POST   | None           | Email/password registration |
| `/v1/auth/login`        | POST   | None           | Email/password login        |
| `/v1/auth/logout`       | POST   | Required       | Logout + clear cookies      |
| `/v1/auth/refresh`      | POST   | Refresh cookie | Rotate primary auth session  |
| `/v1/auth/google`       | GET    | None           | Initiate Google OAuth       |
| `/v1/auth/google/callback` | GET | None           | Google OAuth callback       |
| `/v1/auth/2fa/verify`   | POST   | None           | Verify OTP                  |
| `/v1/auth/forgot-password` | POST | None          | Initiate password reset     |
| `/v1/auth/reset-password`  | POST | None          | Complete password reset     |

#### Meetings (`/v1/meetings/`)

| Endpoint                      | Method | Auth            | Description                                       |
| ----------------------------- | ------ | --------------- | ------------------------------------------------- |
| `/meetings`                   | POST   | Required        | Create meeting                                    |
| `/meetings`                   | GET    | Required        | Meeting history (paginated)                       |
| `/meetings/{id}`              | GET    | Optional        | Get meeting info                                  |
| `/meetings/{id}`              | PUT    | Required (Host) | Update meeting                                    |
| `/meetings/{id}`              | DELETE | Required (Host) | Cancel meeting                                    |
| `/meetings/{id}/token`        | POST   | Optional        | Get LiveKit token — enforces 50-participant limit |
| `/meetings/{id}/join-guest`   | POST   | None            | Guest join — returns LiveKit token directly       |
| `/meetings/{id}/participants` | GET    | Required        | List participants                                 |
| `/meetings/{id}/recording`    | GET    | Required        | Get recording presigned URL                       |
| `/meetings/{id}/recording`    | DELETE | Required (Host) | Delete recording from R2                          |
| `/meetings/{id}/recap`        | GET    | Required        | Get AI recap                                      |
| `/meetings/{id}/recap`        | DELETE | Required (Host) | Delete AI recap                                   |
| `/meetings/{id}/recap/retry`  | POST   | Required        | Retry AI pipeline                                 |
| `/meetings/{id}/transcript`   | GET    | Required        | Get raw transcript                                |
| `/meetings/{id}/feedback`     | POST   | Required        | Submit meeting feedback                           |

> **Guest join flow clarification (Fix #20):**
>
> Guests do **not** call `/meetings/{id}/token`. They call `/meetings/{id}/join-guest` only. That single endpoint registers the guest display name, creates the `guest_session` document, and returns the LiveKit token directly. Auth users call `/meetings/{id}/token` with their access cookie.
>
> ```
> Guest join sequence:
> 1. Guest enters display name on lobby
> 2. POST /meetings/{id}/join-guest  { display_name: "Ayush" }
>    ← returns { livekit_token, session_id, resolved_name: "Ayush (Guest)" }
> 3. Browser connects to LiveKit using livekit_token
> 4. No further auth call needed
>
> Auth user join sequence:
> 1. Auth user clicks "Join Meeting" on lobby
> 2. POST /meetings/{id}/token  (primary auth cookie sent automatically)
>    ← returns { livekit_token }
> 3. Browser connects to LiveKit using livekit_token
> ```

#### Dashboard (`/v1/dashboard/`)

| Endpoint                  | Method | Auth     | Description                    |
| ------------------------- | ------ | -------- | ------------------------------ |
| `/dashboard/recaps`       | GET    | Required | Recent recaps (up to 5)        |
| `/dashboard/action-items` | GET    | Required | User's action items (up to 10) |
| `/dashboard/stats`        | GET    | Required | Meeting statistics             |
| `/dashboard/upcoming`     | GET    | Required | Upcoming meetings (up to 5)    |

#### Calendar (`/v1/calendar/`)

| Endpoint                    | Method | Auth      | Description                |
| --------------------------- | ------ | --------- | -------------------------- |
| `/calendar/events`          | GET    | Required  | Get calendar events        |
| `/calendar/events`          | POST   | Required  | Create event               |
| `/calendar/events/{id}`     | PUT    | Required  | Update event               |
| `/calendar/events/{id}`     | DELETE | Required  | Delete event               |
| `/calendar/sync/google`     | POST   | Required  | Trigger Google sync        |
| `/calendar/sync/status`     | GET    | Required  | Get sync status            |
| `/webhooks/google-calendar` | POST   | Signature | Receive Google push events |

#### Messenger (`/v1/messenger/`)

| Endpoint                                 | Method | Auth     | Description                           |
| ---------------------------------------- | ------ | -------- | ------------------------------------- |
| `/messenger/conversations`               | GET    | Required | List conversations                    |
| `/messenger/conversations`               | POST   | Required | Create conversation                   |
| `/messenger/conversations/{id}`          | GET    | Required | Get conversation                      |
| `/messenger/conversations/{id}/messages` | GET    | Required | Get messages (ciphertext)             |
| `/messenger/conversations/{id}/messages` | POST   | Required | Send message (ciphertext only)        |
| `/messenger/keys`                        | POST   | Required | Register public key                   |
| `/messenger/keys/public/{user_id}`       | GET    | Required | Get another user's public key         |
| `/messenger/keys/backup`                 | POST   | Required | Store encrypted private key backup    |
| `/messenger/keys/backup`                 | GET    | Required | Retrieve encrypted private key backup |

#### Action Items (`/v1/action-items/`)

| Endpoint                      | Method | Auth            | Description                |
| ----------------------------- | ------ | --------------- | -------------------------- |
| `/action-items/meetings`      | GET    | Required        | Meetings with action items |
| `/action-items/meetings/{id}` | GET    | Required        | Action items for a meeting |
| `/action-items`               | POST   | Required        | Create action item         |
| `/action-items/{id}`          | PUT    | Required        | Update action item         |
| `/action-items/{id}`          | DELETE | Required (Host) | Delete action item         |
| `/action-items/{id}/status`   | PATCH  | Required        | Update status only         |

#### Settings, Profile, Notifications

| Endpoint                               | Method        | Auth     | Description                    |
| -------------------------------------- | ------------- | -------- | ------------------------------ |
| `/v1/settings`                         | GET / PUT     | Required | Get/update settings            |
| `/v1/settings/export`                  | POST          | Required | Request GDPR data export       |
| `/v1/settings/delete-account`          | POST          | Required | Request account deletion       |
| `/v1/settings/password`                | PUT           | Required | Change password                |
| `/v1/settings/2fa`                     | POST          | Required | Enable/disable 2FA             |
| `/v1/settings/sessions`                | GET           | Required | Active sessions list           |
| `/v1/settings/sessions/{id}`           | DELETE        | Required | Revoke session                 |
| `/v1/settings/login-history`           | GET           | Required | Login history (last 90 days)   |
| `/v1/settings/linked-accounts`         | GET           | Required | Linked OAuth providers         |
| `/v1/settings/linked-accounts/{provider}` | DELETE     | Required | Unlink provider                |
| `/v1/profile`                          | GET / PUT     | Required | Get/update profile             |
| `/v1/profile/avatar`                   | POST / DELETE | Required | Upload/remove avatar           |
| `/v1/profile/avatar/default`           | POST          | Required | Set default avatar             |
| `/v1/notifications`                    | GET           | Required | List notifications (paginated) |
| `/v1/notifications/{id}/read`          | PATCH         | Required | Mark notification as read      |
| `/v1/notifications/read-all`           | POST          | Required | Mark all as read               |

#### Infrastructure

| Endpoint            | Method | Auth      | Description                    |
| ------------------- | ------ | --------- | ------------------------------ |
| `/health`           | GET    | None      | Health check                   |
| `/webhooks/livekit` | POST   | Signature | Receive LiveKit webhook events |

---

## 6. Database

### 6.1 Reference Document

All collection definitions, field specifications, and indexes are in **`meetio-db-schema.md`**. This section covers only engineering enforcement rules.

### 6.2 Cross-Collection Reference Pattern

All cross-collection references use UUID strings (`id: str`), never MongoDB `ObjectId`.

```python
# ✅ Reference by UUID string
action_item.assignee_user_id = "usr_abc123"

# ❌ Never reference by ObjectId
action_item.assignee_user_id = ObjectId("662abc...")
```

### 6.3 Schema Version Enforcement

Every major document model includes `schema_version: int = 1`. Increment on any breaking field change. Never silently increment — it must be paired with a migration file.

### 6.4 Atlas Free Tier Constraints

The M0 Atlas free tier provides 512 MB storage and a shared cluster with limited IOPS. Mitigations:

- Enable Atlas connection pooling (max 10 connections on M0)
- Use projection in all queries — return only required fields
- Paginate all list queries — never unbounded collection scans
- Add all required indexes before launch
- Monitor storage weekly — alert at 400 MB to prepare for upgrade to M2 ($9/month)

### 6.5 Query Projection Pattern

```python
# ✅ Good — only fetch what is needed
meeting = await db.meetings.find_one(
    {"_id": meeting_id},
    {"title": 1, "status": 1, "host_user_id": 1}
)

# ❌ Bad — fetches entire document including transcript data
meeting = await db.meetings.find_one({"_id": meeting_id})
```

---

## 7. Security Requirements

### 7.1 JWT Implementation (PyJWT — not python-jose)

> **Critical:** Use `PyJWT>=2.8.0`. `python-jose` is deprecated, has unpatched CVEs (including algorithm confusion attacks), and is no longer maintained.

```python
# requirements.txt
PyJWT>=2.8.0
passlib[argon2]==1.7.4
```

```python
# backend/services/auth.py
FastAPI Users manages token creation and validation internally via JWTStrategy
or DatabaseStrategy. Do not implement create_access_token / decode_token manually.

Use PyJWT>=2.8.0 only for standalone internal token needs outside of auth flows.
Do not use python-jose — deprecated, has unpatched CVEs.

Cookie convention:
- `fastapiusersauth` is the primary auth cookie.
- `refresh_token` is the dedicated refresh cookie used by the custom refresh route.

Strategy choice (pick one and apply consistently across all documents):
- JWTStrategy: stateless, no session document, no server-side revocation possible.
- DatabaseStrategy: stateful, requires sessions collection, supports
  DELETE /v1/settings/sessions/{id} remote revocation.

MeetIO uses DatabaseStrategy to support remote session revocation (Feature 3).
```

### 7.2 Authentication & Session Security

| Requirement      | Implementation                   |
| ---------------- | -------------------------------- |
| Password hashing | argon2 (via passlib)             |
| Session signing   | HS256 with 64-byte random secret |
| Token library     | PyJWT ≥ 2.8.0                    |

| Token storage | HttpOnly, Secure, SameSite=Lax cookies — configured via
FastAPI Users CookieTransport, not set manually |

| Primary auth session TTL | 4 hours |
| Refresh token TTL | 15 days |
| Refresh token storage | Hashed (argon2) in `sessions` collection |
| Verification Link Expiry | Usually 24-48 hours (managed by FastAPI Users) |
| Password Reset Link Expiry | Usually 1-2 hours (managed by FastAPI Users) |

### 7.3 Input Validation

All incoming request bodies are validated by Pydantic models before business logic executes. Custom validators required for:

- Email format (RFC 5322)
- Password strength: minimum 8 characters, at least one uppercase, one number, one special character
- URL format (profile website field)
- Timezone string (validate against IANA database)
- File upload MIME type (avatar: JPG/PNG/WEBP only, max 5 MB)

### 7.4 Authorization Enforcement

Every protected endpoint enforces authorization at the service layer, not just route guard.

```python
# ✅ Good — checks role at service layer
@router.delete("/meetings/{id}/recording")
async def delete_recording(id: str, current_user: User = Depends(get_current_user)):
    meeting = await meeting_service.get(id)
    if meeting.host_user_id != current_user.id:
        raise HTTPException(403, "Only the host can delete recordings.")
    await recording_service.delete(id)
```

### 7.5 LiveKit Token Security

- Tokens generated server-side only. **Never generated client-side.**
- Guest tokens expire in 1 hour. Auth user tokens expire in 4 hours.
- Max participants enforced on every token generation call:

```python
@router.post("/meetings/{meeting_id}/token")
async def get_meeting_token(meeting_id: str, current_user: User = Depends(get_current_user_optional)):
    meeting = await meetings.get(meeting_id)
    participant_count = await participants.count_active(meeting_id)

    if participant_count >= settings.MEETING_MAX_PARTICIPANTS:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "MEETING_FULL",
                "message": f"This meeting is full ({settings.MEETING_MAX_PARTICIPANTS}/{settings.MEETING_MAX_PARTICIPANTS}). Contact the host.",
            }
        )

    # Resolve role — co_host_ids persists on the meeting document so role
    # is correctly restored if a co-host disconnects and rejoins
    def resolve_role(meeting, user_id: str) -> str:
        if meeting.host_user_id == user_id:
            return "host"
        if user_id in meeting.co_host_ids:
            return "co-host"
        return "participant"

    role = resolve_role(meeting, current_user.id) if current_user else "guest"

    token = generate_livekit_token(
        api_key=settings.LIVEKIT_API_KEY,
        api_secret=settings.LIVEKIT_API_SECRET,
        user_id=current_user.id if current_user else f"guest_{uuid4()}",
        display_name=current_user.display_name if current_user else "Guest",
        room_name=meeting_id,
    )
    return {"data": {"token": token}}
```

Same capacity check is applied in `/meetings/{id}/join-guest`.

**Capacity notification:** When participant count reaches 45 (90% of 50), the host receives a `meeting.capacity_warning` WebSocket event.

### 7.6 Webhook Signature Verification

**LiveKit:**

```python
from livekit.webhook import WebhookReceiver

receiver = WebhookReceiver(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)

@router.post("/webhooks/livekit")
async def livekit_webhook(request: Request):
    body = await request.body()
    auth_token = request.headers.get("Authorization")
    event = receiver.receive(body.decode(), auth_token)
    await handle_livekit_event(event)
```

**Google Calendar:** `X-Goog-Channel-Token` header validated against stored channel token.

### 7.7 Security Headers

```python
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response
```

### 7.8 File Upload Security

- Validate MIME type server-side (not just file extension)
- Re-encode all uploaded images to WebP before storage (strips EXIF metadata)
- Store in Cloudflare R2 (separate bucket from recordings)
- Never store uploaded files in the FastAPI container filesystem

---

## 8. GDPR Compliance

### 8.1 Lawful Basis for Processing

| Data                               | Lawful Basis                                                                                                |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Account data                       | Contract performance                                                                                        |
| Meeting recordings and transcripts | Consent — host explicitly starts recording; all participants notified via non-dismissable banner (PRD §4.2) |
| AI-generated summaries             | Legitimate interest                                                                                         |
| Messenger messages                 | Contract performance                                                                                        |
| Google Calendar data               | Consent (user explicitly connects)                                                                          |

### 8.2 Data Minimization

- Only collect fields listed in PRD §16.1
- Guest users: store display name and session data only. Purge 24 hours after meeting ends
- Never log request bodies that may contain personal data

### 8.3 Right to Access — Data Export

`POST /v1/settings/export`. Generates a zip file within 72 hours containing: meetings, action items, transcripts, messages, and profile. Download link expires in 7 days.

### 8.4 Right to Erasure — Account Deletion

`POST /v1/settings/delete-account`. Soft-deleted for 30 days then purged by the `process_pending_deletions` Celery Beat task.

### 8.5 Data Retention Policy

| Data Type                 | Retention                                                                    |
| ------------------------- | ---------------------------------------------------------------------------- |
| Active user accounts      | Indefinite while active                                                      |
| Completed meeting records | 2 years from meeting date                                                    |
| Recordings (R2)           | Until host deletes, or 1 year (auto-expired by `expire_old_recordings` task) |
| Guest participant records | 24 hours after meeting ends                                                  |
| Login history             | 90 days                                                                      |
| Notification records      | 90 days (TTL index)                                                          |

### 8.6 No PII to Sentry

Configure Sentry to never send user email or full name. Anonymized user IDs only. See §16.2.

---

## 9. Performance & SLAs

### 9.1 API Response Time Targets

| Endpoint Type            | p50 Target | p95 Target |
| ------------------------ | ---------- | ---------- |
| Auth endpoints           | < 200ms    | < 500ms    |
| Dashboard data (cached)  | < 100ms    | < 300ms    |
| Meeting CRUD             | < 200ms    | < 500ms    |
| LiveKit token generation | < 150ms    | < 400ms    |
| Messenger message send   | < 200ms    | < 500ms    |

### 9.2 Meeting Creation SLA

Meeting must be created and shareable link available in under 10 seconds. `POST /v1/meetings` must complete in < 500ms (p95). The shareable link is generated from the meeting slug — not from the LiveKit room being ready.

### 9.3 Background Job SLAs

| Job                       | Target Start                       | Max Duration |
| ------------------------- | ---------------------------------- | ------------ |
| Post-meeting Deepgram STT | Within 60s of `egress_ended` event | 10 minutes   |
| LLM summary pipeline      | Within 5 min of transcript ready   | 5 minutes    |
| Email dispatch            | Within 2 min of trigger            | 1 minute     |

### 9.4 Redis Caching Policy

| Cache Key                      | TTL        | Invalidation Trigger  |
| ------------------------------ | ---------- | --------------------- |
| `dashboard:stats:{user_id}`    | 5 minutes  | New meeting completed |
| `dashboard:recaps:{user_id}`   | 5 minutes  | New recap ready       |
| `dashboard:upcoming:{user_id}` | 2 minutes  | New meeting scheduled |
| `user:profile:{user_id}`       | 10 minutes | Profile update        |
| `meeting:info:{meeting_id}`    | 30 seconds | Meeting status change |

### 9.5 Redis Capacity Planning (Upstash Free Tier)

Upstash free tier: **10,000 commands/day**. This is tight. Budget:

| Consumer                                     | Estimate | Commands/day |
| -------------------------------------------- | -------- | ------------ |
| Celery (50 meetings/day × 6 tasks × 10 cmds) | 3,000    | 3,000        |
| Dashboard cache reads                        | ~2,000   | 2,000        |
| WebSocket pub/sub                            | ~1,500   | 1,500        |
| **Total estimated**                          |          | **~6,700**   |

Headroom: ~3,300 commands/day. **Switch to Upstash pay-per-use or Redis Cloud (30 MB, no command limit) before public launch.**

---

## 10. WebSocket Architecture

### 10.1 Overview

FastAPI manages a WebSocket server for all real-time app events (notifications, in-meeting control changes, Messenger delivery, dashboard updates). Video/audio is handled entirely by LiveKit — not this WebSocket server.

### 10.2 Connection Management — Multi-Instance Safe

> **Fix #2:** The original `ConnectionManager` stored connections in a Python dict. With multiple Railway instances, Celery workers could only reach users connected to their own instance. Events were silently dropped for users on other instances.
>
> The fix uses Redis pub/sub: Celery publishes to `ws:user:{user_id}` channels. Every FastAPI instance subscribes and forwards to its own local connections. Users receive events regardless of which instance they are on.

```python
# backend/websocket/manager.py
class ConnectionManager:
    """
    Manages WebSocket connections on THIS instance only.
    Publishing is done via Redis pub/sub so all instances receive the event.
    Two channel namespaces:
      ws:user:{user_id}       — personal events (notifications, session revocation)
      ws:meeting:{meeting_id} — room-wide events (controls, chat, waiting room)
    """

    def __init__(self):
        self.active_connections: dict[str, set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections.setdefault(user_id, set()).add(websocket)

    async def disconnect(self, websocket: WebSocket, user_id: str):
        self.active_connections.get(user_id, set()).discard(websocket)

    async def _deliver_local(self, user_id: str, message: dict):
        """Deliver to WebSocket connections on THIS instance."""
        dead = set()
        for ws in self.active_connections.get(user_id, set()):
            try:
                await ws.send_json(message)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.active_connections[user_id].discard(ws)

    async def broadcast_to_user(self, user_id: str, message: dict):
        """Publish to ws:user:{user_id} — personal events."""
        await redis_client.publish(f"ws:user:{user_id}", json.dumps(message))

    async def broadcast_to_meeting(self, meeting_id: str, message: dict):
        """Publish to ws:meeting:{meeting_id} — room-wide events (controls, chat, waiting room)."""
        await redis_client.publish(f"ws:meeting:{meeting_id}", json.dumps(message))


manager = ConnectionManager()


async def redis_listener(mgr: ConnectionManager):
    """
    Subscribes to ws:user:* and ws:meeting:* channels.
    Runs as a background asyncio task on app startup.
    Routes each message to the correct local connections.
    """
    pubsub = redis_client.pubsub()
    await pubsub.psubscribe("ws:user:*", "ws:meeting:*")
    async for msg in pubsub.listen():
        if msg["type"] != "pmessage":
            continue
        channel: str = msg["channel"]
        try:
            data = json.loads(msg["data"])
            if channel.startswith("ws:user:"):
                user_id = channel.removeprefix("ws:user:")
                await mgr._deliver_local(user_id, data)
            elif channel.startswith("ws:meeting:"):
                meeting_id = channel.removeprefix("ws:meeting:")
                # Deliver to all users currently connected to this meeting
                for uid, connections in mgr.active_connections.items():
                    if connections:
                        await mgr._deliver_local(uid, data)
        except Exception:
            pass  # Never crash the listener on a bad message
```

```python
# backend/main.py
import asyncio
from websocket.manager import manager, redis_listener

@app.on_event("startup")
async def startup():
    asyncio.create_task(redis_listener(manager))
```

**How Celery workers send events:**

```python
# backend/tasks/notifications.py
import asyncio
import redis

# Celery workers use sync Redis client
sync_redis = redis.from_url(settings.REDIS_URL, decode_responses=True)

def push_ws_event(user_id: str, event_type: str, payload: dict):
    """Call from any Celery task to push a WebSocket event to a user."""
    message = {
        "type": event_type,
        "payload": payload,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
    sync_redis.publish(f"ws:user:{user_id}", json.dumps(message))
```

### 10.3 WebSocket Endpoint

```python
# backend/routers/websocket.py
from fastapi import WebSocket, WebSocketDisconnect
from websocket.manager import manager

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    user = await authenticate_websocket(websocket)  # verifies primary auth cookie
    if not user:
        await websocket.close(code=4001)
        return

    await manager.connect(websocket, user.id)
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        await manager.disconnect(websocket, user.id)
```

### 10.4 WebSocket Message Schema

```json
{
  "type": "notification.new",
  "payload": {},
  "timestamp": "2026-04-29T10:00:00Z"
}
```

#### Event Types

| Event Type                      | Direction       | Description                                      |
| ------------------------------- | --------------- | ------------------------------------------------ |
| `notification.new`              | Server → Client | New in-app notification                          |
| `meeting.status_changed`        | Server → Client | Meeting status update                            |
| `meeting.participant_joined`    | Server → Client | Participant joined                               |
| `meeting.participant_left`      | Server → Client | Participant left                                 |
| `meeting.role_changed`          | Server → Client | Role promotion/demotion                          |
| `meeting.controls_changed`      | Server → Client | Room lock / media lock / recording state changed |
| `meeting.capacity_warning`      | Server → Client | Meeting at 90% capacity (45/50)                  |
| `meeting.waiting_room.new`      | Server → Client | New participant in waiting room                  |
| `meeting.waiting_room.admitted` | Server → Client | Participant admitted                             |
| `meeting.waiting_room.declined` | Server → Client | Participant declined                             |
| `recap.status_changed`          | Server → Client | AI recap pipeline status update                  |
| `action_item.assigned`          | Server → Client | Action item assigned to user                     |
| `action_item.status_changed`    | Server → Client | Action item status changed                       |
| `messenger.message`             | Server → Client | New messenger message (ciphertext only)          |
| `ping`                          | Client → Server | Keepalive                                        |
| `pong`                          | Server → Client | Keepalive response                               |

> **`meeting.controls_changed` payload includes `recording_started: bool`** — frontend uses this to show/hide the recording consent banner (PRD §4.2).

```json
{
  "type": "meeting.controls_changed",
  "payload": {
    "room_locked": false,
    "recording_started": true,
    "camera_locked": false,
    "microphone_locked": false,
    "screen_share_locked": false,
    "chat_locked": false,
    "reactions_enabled": false
  }
}
```

### 10.5 Authentication

WebSocket connections are authenticated via the primary auth cookie on the initial HTTP upgrade request. Unauthenticated connections are rejected immediately with close code `4001`.

### 10.6 Keepalive

Client sends `ping` every 30 seconds. Server responds with `pong`. If no ping received in 90 seconds, server closes the connection. Client reconnects with exponential backoff: 1s, 2s, 4s, 8s, max 30s.

### 10.7 Offline Banner (React Client)

```typescript
// src/hooks/useNetworkStatus.ts
export function useNetworkStatus() {
  const setOffline = useUIStore((s) => s.setOffline);

  useEffect(() => {
    const handleOffline = () => setOffline(true);
    const handleOnline = () => setOffline(false);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [setOffline]);
}
```

```typescript
// src/components/OfflineBanner.tsx
export function OfflineBanner() {
  const isOffline = useUIStore((s) => s.isOffline);
  if (!isOffline) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-50 bg-yellow-500 text-yellow-900 text-sm font-medium text-center py-2 px-4">
      ⚠ No internet connection — some features unavailable
    </div>
  );
}
```

---

## 11. Celery Task Architecture

### 11.1 Task Definitions

> **Fix #3:** `run_deepgram_transcription` is now triggered by the `egress_ended` webhook, not `room_finished`. The recording file does not exist on R2 until `egress_ended` fires. Triggering on `room_finished` would attempt to fetch a file that doesn't exist yet.
>
> **Fix #4:** `run_llm_pipeline` now uses a Celery chord with `finalize_recap` as the callback. Previously the chord had no callback — all 4 LLM tasks would run in parallel but nothing would mark the recap as complete or notify the host.

```python
# backend/tasks/ai_pipeline.py
from celery import chord
from datetime import datetime

@celery.task(bind=True, max_retries=3)
def run_deepgram_transcription(self, meeting_id: str, recording_url: str):
    """
    Triggered by: egress_ended webhook (NOT room_finished).
    recording_url is passed directly from the LiveKit egress payload —
    no need to construct it or fetch it separately.
    """
    try:
        transcript = deepgram_client.transcribe(recording_url, diarize=True)
        save_raw_transcript(meeting_id, transcript)
        update_transcript_status(meeting_id, "available")
        run_llm_pipeline.delay(meeting_id)
    except Exception as exc:
        backoff = [0, 30, 120][self.request.retries]
        raise self.retry(exc=exc, countdown=backoff)


@celery.task(bind=True, max_retries=3)
def run_llm_pipeline(self, meeting_id: str):
    """
    Runs summary, AI transcript, decisions, and action items in parallel.
    finalize_recap fires when all 4 tasks complete.
    """
    try:
        transcript = get_raw_transcript(meeting_id)
        update_recap_status(meeting_id, "processing")

        chord(
            [
                generate_summary.s(meeting_id, transcript),
                generate_ai_transcript.s(meeting_id, transcript),
                generate_key_decisions.s(meeting_id, transcript),
                generate_action_items.s(meeting_id, transcript),
            ],
            finalize_recap.s(meeting_id)    # ← callback fires when ALL 4 finish
        ).delay()

    except Exception as exc:
        backoff = [0, 60, 180][self.request.retries]
        raise self.retry(exc=exc, countdown=backoff)


@celery.task
def finalize_recap(results: list, meeting_id: str):
    """
    Called automatically by Celery when all 4 chord tasks complete.
    results = list of return values from the 4 tasks (in order).
    """
    mark_recap_ready(meeting_id)

    # Notify host and all auth participants
    meeting = get_meeting(meeting_id)
    push_ws_event(meeting.host_user_id, "recap.status_changed", {
        "meeting_id": meeting_id,
        "status": "ready",
    })
    send_email.delay(
        to=get_host_email(meeting_id),
        subject="Your meeting recap is ready — MeetIO",
        template="recap_ready",
        context={"meeting_id": meeting_id, "meeting_title": meeting.title},
    )

    # Schedule auto-confirm if host doesn't confirm within 2 hours
    auto_confirm_action_items.apply_async(
        args=[meeting_id],
        countdown=7200    # 2 hours
    )


@celery.task
def auto_confirm_action_items(meeting_id: str):
    """Triggered 2hrs after finalize_recap. Auto-confirms pending items."""
    items = get_pending_action_items(meeting_id)
    if not items:
        return   # Host already confirmed manually

    confirm_all(items, auto_confirmed=True)
    notify_host_auto_confirmed(meeting_id)

    # Notify assignees now that items are confirmed
    for item in items:
        if item.assigned_to:
            push_ws_event(item.assigned_to, "action_item.assigned", {
                "action_item_id": item.id,
                "task": item.task,
                "meeting_id": meeting_id,
            })
```

**LiveKit webhook handler — correct event routing:**

```python
# backend/routers/webhooks.py

@router.post("/webhooks/livekit")
async def livekit_webhook(request: Request):
    body = await request.body()
    auth_token = request.headers.get("Authorization")
    event = receiver.receive(body.decode(), auth_token)
    await handle_livekit_event(event)


async def handle_livekit_event(event: dict):
    event_type = event["event"]

    if event_type == "room_started":
        await meetings.update_status(event["room"]["name"], "in_progress")

    elif event_type == "room_finished":
        # ✅ Only update status here — do NOT trigger Deepgram yet
        # The recording file is NOT on R2 yet at this point
        await meetings.update_status(event["room"]["name"], "completed")
        await meetings.set_ended_at(event["room"]["name"], datetime.utcnow())

    elif event_type == "egress_ended":
        # ✅ File is on R2 — safe to trigger transcription
        meeting_id = event["egressInfo"]["roomName"]
        recording_url = event["egressInfo"]["fileResults"][0]["downloadUrl"]
        await meetings.set_recording_url(meeting_id, recording_url)
        run_deepgram_transcription.delay(meeting_id, recording_url)

        # Notify all auth participants that recording is available
        await notify_recording_ready(meeting_id)

    elif event_type == "participant_joined":
        await participants.upsert_from_event(event)

    elif event_type == "participant_left":
        await participants.set_left_at_from_event(event)
```

### 11.2 Celery Beat Schedule

```python
celery.conf.beat_schedule = {
    # Google Calendar push channel renewal
    # Renews channels expiring within the next 48 hours (channels expire ~7 days max)
    "renew-gcal-channels": {
        "task": "tasks.calendar.renew_expiring_channels",
        "schedule": 86400,                       # every 24 hours
        # Query: { channel_expiry: { $lt: now + 48h, $gt: now } }
    },
    # Dead-letter queue retry
    "process-dead-letter-queue": {
        "task": "tasks.dlq.process_dead_letter_queue",
        "schedule": 1800,                        # every 30 minutes
    },
    # GDPR: purge guest session data + chat_messages 24h after meeting ends
    "purge-guest-data": {
        "task": "tasks.gdpr.purge_expired_guest_data",
        "schedule": crontab(hour=2, minute=0),   # daily 02:00 UTC
        # task also purges chat_messages where purge_at has passed
    },
    # GDPR: permanently delete accounts after 30-day window
    "process-account-deletions": {
        "task": "tasks.gdpr.process_pending_deletions",
        "schedule": crontab(hour=2, minute=30),  # daily 02:30 UTC
    },
    # Action item due date reminders
    "send-due-date-reminders": {
        "task": "tasks.notifications.send_due_date_reminders",
        "schedule": crontab(hour=9, minute=0),   # daily 09:00 UTC
    },
    # Storage: delete recordings older than 1 year from R2
    "expire-meeting-recordings": {
        "task": "tasks.gdpr.expire_old_recordings",
        "schedule": crontab(hour=3, minute=0),   # daily 03:00 UTC
    },
}
```

### 11.3 LLM Prompts

All LLM prompts are versioned template files — not hardcoded in Python. This allows prompt changes without code deploys.

```
backend/prompts/
├── summary_v1.txt
├── ai_transcript_v1.txt
├── key_decisions_v1.txt
└── action_items_v1.txt
```

---

## 12. Third-Party Integrations

### 12.1 LiveKit

**SDK:** `livekit-server-sdk-python` (backend), `@livekit/components-react` (frontend)

**Token generation:** Server-side only. Never generate tokens in the React app.

**Webhook events:**

| Event                | Action                                                        |
| -------------------- | ------------------------------------------------------------- |
| `room_started`       | Update meeting status → `in_progress`                         |
| `room_finished`      | Update status → `completed`, record `ended_at`                |
| `participant_joined` | Upsert participant record                                     |
| `participant_left`   | Record `left_at` on participant                               |
| `egress_ended`       | Set recording URL, trigger Deepgram task, notify participants |

**Egress (composite recording → R2):**

```python
egress_request = {
    "room_name": room_name,
    "output": {
        "s3": {
            "access_key": R2_ACCESS_KEY_ID,
            "secret": R2_SECRET_ACCESS_KEY,
            "bucket": R2_BUCKET_NAME,
            "endpoint": f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
            "filepath": f"recordings/{meeting_id}.mp4",
        }
    },
    "layout": {"preset": "speaker-dark"},
}
```

### 12.2 Deepgram

**Live captions:** Handled natively by LiveKit's Deepgram integration. No additional FastAPI code.

**Post-meeting transcription:**

> **Fix #11:** `language` is no longer hardcoded to `"en"`. It is read from `meeting.language` (set at meeting creation, default `"en"`). This allows non-English meetings to be transcribed correctly.

```python
# backend/services/transcription.py
from deepgram import DeepgramClient, PrerecordedOptions

async def transcribe_recording(r2_url: str, language: str) -> dict:
    """
    language: BCP 47 code from meeting.language field.
    Default "en". Set detect_language=True to let Deepgram auto-detect.
    """
    client = DeepgramClient(settings.DEEPGRAM_API_KEY)
    options = PrerecordedOptions(
        model="nova-2",
        diarize=True,
        punctuate=True,
        utterances=True,
        smart_format=True,
        language=language,            # ← from meeting document, not hardcoded
        # detect_language=True        # ← simpler alternative for v1 if multilingual is needed
    )
    response = await client.listen.asyncprerecorded.v("1").transcribe_url(
        {"url": r2_url}, options
    )
    return response.to_dict()
```

### 12.3 Google OAuth

**Flow:** Server-side OAuth 2.0 Authorization Code Flow. Authorization URL generated by FastAPI. Callback handled by FastAPI. Tokens never passed through the browser URL.

**Scopes for auth only:** `openid`, `email`, `profile`

**Google Calendar additional scopes:** `https://www.googleapis.com/auth/calendar`, `https://www.googleapis.com/auth/calendar.events`

### 12.4 Cloudflare R2

```python
import boto3

r2_client = boto3.client(
    "s3",
    endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
    aws_access_key_id=settings.R2_ACCESS_KEY_ID,
    aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
    region_name="auto",
)
```

Always use presigned URLs for recording playback (1-hour expiry). Never expose R2 credentials to the browser.

### 12.5 Resend Email

```python
import resend

resend.api_key = settings.RESEND_API_KEY

def send_email(to: str, subject: str, html: str):
    resend.Emails.send({
        "from": "MeetIO <noreply@meetio.app>",
        "to": [to],
        "subject": subject,
        "html": html,
    })
```

#### 12.5.1 Local auth email capture

For development, MeetIO can run without a real email inbox:

- `EMAIL_TRANSPORT=auto` uses console capture when `APP_ENV=development`
- `EMAIL_TRANSPORT=mailpit` sends to a local Mailpit SMTP server on `MAILPIT_HOST:MAILPIT_PORT`
- verification and reset email links are written to the backend or Celery logs, or visible in Mailpit's web UI
- this lets you validate signup, email verification, and password reset locally without Resend delivery

Auth semantics are intentionally split:

- **Signup / password reset:** email token links
- **2FA:** TOTP code from an authenticator app
- **Console email transport:** dev-only verification aid, not a production sender
- **Mailpit SMTP:** dev-only mail capture server, useful when you want a browser UI instead of raw logs

---

## 13. E2E Encryption Implementation

### 13.1 Key Generation (Browser)

```typescript
// src/lib/crypto.ts
import nacl from "tweetnacl";
import { encodeBase64 } from "tweetnacl-util";

export function generateIdentityKeypair(): {
  publicKey: string;
  privateKeyBase64: string;
} {
  const keypair = nacl.box.keyPair();
  return {
    publicKey: encodeBase64(keypair.publicKey),
    privateKeyBase64: encodeBase64(keypair.secretKey),
  };
}
```

### 13.2 Private Key Storage — Non-Extractable

> **Fix #6:** The original implementation stored the raw base64 private key string in IndexedDB. A successful XSS attack could read it directly.
>
> The fix imports the key as a non-extractable `CryptoKey` using the Web Crypto API. `extractable: false` means JavaScript can **use** the key (to derive shared secrets) but can **never export it**. An XSS attack can still use the key during the active session, but cannot exfiltrate it.

```typescript
// src/lib/keyStorage.ts
import { openDB } from "idb";

const DB_NAME = "meetio-keys";
const STORE_NAME = "keys";

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME);
    },
  });
}

export async function storePrivateKey(privateKeyBase64: string): Promise<void> {
  const raw = Uint8Array.from(atob(privateKeyBase64), (c) => c.charCodeAt(0));

  // Import as non-extractable — JS can use it but can never read the raw bytes back out
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "X25519" },
    false, // ← extractable: false
    ["deriveKey"],
  );

  const db = await getDB();
  await db.put(STORE_NAME, cryptoKey, "identity_private_key");
}

export async function loadPrivateKey(): Promise<CryptoKey | null> {
  const db = await getDB();
  return (await db.get(STORE_NAME, "identity_private_key")) ?? null;
}
```

### 13.3 Key Backup — Client-Side Encrypted

> **Fix #8:** The original spec said "store encrypted private key backup" but never defined the encryption. Sending the raw private key to the server would break E2E guarantees. The private key must be encrypted client-side with a user-supplied passphrase before it ever leaves the browser.

```typescript
// src/lib/keyBackup.ts

async function deriveBackupKey(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 310_000, // OWASP recommended minimum for PBKDF2-SHA256
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function backupPrivateKey(
  privateKeyBase64: string,
  password: string,
): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const backupKey = await deriveBackupKey(password, salt);

  const raw = Uint8Array.from(atob(privateKeyBase64), (c) => c.charCodeAt(0));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    backupKey,
    raw,
  );

  // Server receives only: salt + iv + ciphertext — cannot decrypt without the user's password
  await apiRequest("/v1/messenger/keys/backup", {
    method: "POST",
    body: JSON.stringify({
      salt: btoa(String.fromCharCode(...salt)),
      iv: btoa(String.fromCharCode(...iv)),
      ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    }),
  });
}

export async function restorePrivateKey(password: string): Promise<string> {
  const res = await apiRequest("/v1/messenger/keys/backup");
  const { salt, iv, ciphertext } = res.data;

  const saltBytes = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0));
  const ivBytes = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));
  const ciphertextBytes = Uint8Array.from(atob(ciphertext), (c) =>
    c.charCodeAt(0),
  );

  const backupKey = await deriveBackupKey(password, saltBytes);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes },
    backupKey,
    ciphertextBytes,
  );

  return btoa(String.fromCharCode(...new Uint8Array(decrypted)));
}
```

### 13.4 Server-Side Guarantees

The FastAPI backend must never:

- Decrypt any Messenger message
- Log Messenger message payloads
- Return message plaintext in any API response

All Messenger endpoints return only `ciphertext` and `nonce` fields. The backup endpoint stores `{ salt, iv, ciphertext }` and cannot decrypt it.

---

## 14. CI/CD Pipeline

### 14.1 Platform

**GitHub Actions** — free for public repos, 2,000 minutes/month free for private repos.

### 14.2 Branch Strategy

| Branch      | Purpose     | Auto-deploy               |
| ----------- | ----------- | ------------------------- |
| `main`      | Production  | Yes                       |
| `staging`   | Pre-release | Yes → staging environment |
| `feature/*` | Development | PR preview only           |

### 14.3 GitHub Actions Workflows

#### `.github/workflows/ci.yml`

```yaml
name: CI

on:
  pull_request:
    branches: [main, staging]

jobs:
  backend-test:
    runs-on: ubuntu-latest
    services:
      mongodb:
        image: mongo:7
        ports: ["27017:27017"]
      redis:
        image: redis:7
        ports: ["6379:6379"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: "pip"
      - run: pip install -e ".[dev]"
      - run: pytest tests/ --cov=app --cov-report=xml -x

  frontend-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
        working-directory: ./frontend
      - run: npm run lint
        working-directory: ./frontend
      - run: npm run type-check
        working-directory: ./frontend
      - run: npm run test
        working-directory: ./frontend
```

#### `.github/workflows/deploy.yml`

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm install -g migrate-mongo
      - run: migrate-mongo up
        env:
          MONGODB_URI: ${{ secrets.MONGODB_URI_PRODUCTION }}

  deploy-backend:
    needs: migrate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: railwayapp/railway-action@v1
        with:
          service: api
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}

  deploy-frontend:
    needs: migrate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci && npm run build
        working-directory: ./frontend
      - uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: meetio-frontend
          directory: frontend/dist
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}
```

Migration failures block the deploy. FastAPI never starts on a failed migration.

### 14.4 Required GitHub Secrets

```
MONGODB_URI_PRODUCTION
RAILWAY_TOKEN
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
# If using Vercel instead:
# VERCEL_TOKEN
# VERCEL_ORG_ID
# VERCEL_PROJECT_ID
```

---

## 15. Testing Strategy

### 15.1 Testing Pyramid — Solo Developer Priorities

```
        ┌──────────┐
        │   E2E    │  Playwright — P0 journeys only (~15 tests)
        │  (small) │  Run in CI, not on every commit
        ├──────────┤
        │Integration│  FastAPI TestClient + real MongoDB/Redis
        │ (medium) │  ~60–80 tests on critical paths
        ├──────────┤
        │   Unit   │  pytest / Vitest — pure logic, fast
        │  (large) │  ~100–150 tests
        └──────────┘
```

**Coverage targets:**

- Backend unit + integration: 70% minimum on business logic modules
- Frontend: 60% on component logic
- E2E: All P0 journeys passing

### 15.2 Backend Testing (pytest)

**Tools:** `pytest`, `pytest-asyncio`, `pytest-cov`, `httpx`, `mongomock` or Atlas test cluster, `fakeredis`

**Critical unit tests — must have before launch:**

- JWT generation and validation using PyJWT (including algorithm allowlist enforcement)
- OTP generation, expiry, and lockout after 5 attempts
- LiveKit token grant scoping (guest vs. host vs. participant)
- Max participants enforcement on token generation (50-participant limit)
- Deepgram speaker → participant matching algorithm
- Due date phrase resolution (all 7 cases in PRD §5.6)
- Action item auto-confirm after 2 hours (chord callback flow)
- Guest data purge (24hr rule)
- Google Calendar webhook retry + dead-letter logic
- WebSocket Redis pub/sub fan-out (multi-instance delivery)
- `clearMeeting()` resets all 7 fields

### 15.3 Frontend Testing (Vitest + React Testing Library)

**Tools:** `vitest`, `@testing-library/react`, `@testing-library/user-event`, `msw`

**Critical component tests:**

- Pre-meeting lobby device selection (camera/mic/speaker)
- Guest display name deduplication logic
- In-meeting conversion modal (sign in / sign up / OTP flow)
- Zustand store state transitions — especially `clearMeeting()` and `setRecording()`
- `meetingStore` — verify `clearMeeting()` resets `roomLocked`, `waitingRoomEnabled`, `reactionsEnabled`
- `setRecording(true/false)` only updates state, never calls API directly
- Offline banner show/hide (`useNetworkStatus` hook)
- Notification dropdown read/unread state
- Recording consent banner shows on `meeting.controls_changed` with `recording_started: true`

### 15.4 E2E Testing (Playwright) — P0 Journeys Only

**P0 (must pass before any production deploy):**

| Journey                                      | Notes                           |
| -------------------------------------------- | ------------------------------- |
| Sign up with email → verify OTP → dashboard  | Core onboarding                 |
| Sign in with Google OAuth                    | Requires OAuth mock in test env |
| Create instant meeting → copy link           | Core creation flow              |
| Join meeting as authenticated user           | Core join flow                  |
| Join meeting as guest → enter display name   | Guest flow                      |
| Host ends meeting → end-of-meeting lobby     | Closing flow                    |
| View AI recap after meeting                  | Post-meeting core               |
| 51st participant receives MEETING_FULL error | Capacity enforcement            |

**P1 (add before public launch):**

| Journey                                               |
| ----------------------------------------------------- |
| Guest converts mid-meeting (sign in)                  |
| Host admits participant from waiting room             |
| Host confirms action items                            |
| Schedule meeting → appears in calendar                |
| Connect Google Calendar → events appear               |
| Send Messenger DM                                     |
| Recording consent banner appears for all participants |

```typescript
// playwright.config.ts
export default {
  testDir: "./e2e",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
  },
};
```

---

## 16. Observability & Monitoring

### 16.1 Recommended Stack

| Tool                           | Purpose                             | Free Tier                   |
| ------------------------------ | ----------------------------------- | --------------------------- |
| **Sentry**                     | Error tracking (backend + frontend) | 5,000 errors/month          |
| **BetterStack**                | Uptime monitoring + status page     | 10 monitors, 3-min interval |
| **Railway Logs**               | Application logs (FastAPI + Celery) | Included with Railway       |
| **Cloudflare Pages Analytics** | Frontend performance, traffic       | Included                    |

### 16.2 Sentry Integration

```python
# backend — FastAPI + Celery
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.celery import CeleryIntegration

sentry_sdk.init(
    dsn=settings.SENTRY_DSN,
    environment=settings.APP_ENV,
    integrations=[FastApiIntegration(), CeleryIntegration()],
    traces_sample_rate=0.1,
    send_default_pii=False,    # GDPR: never send email, name, or message content to Sentry
)
```

```typescript
// frontend — React
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: env.sentryDsn,
  environment: env.appEnv,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});
```

### 16.3 Structured Logging

```python
import structlog

logger = structlog.get_logger()

# ✅ Good — structured, searchable in Railway logs
logger.info("meeting.created", meeting_id=meeting_id, host_user_id=user.id)
logger.error("deepgram.failed", meeting_id=meeting_id, attempt=retry_count)

# ❌ Bad — unstructured, unsearchable
logger.info(f"Meeting {meeting_id} created by {user.id}")
```

**Never log:** passwords, JWT tokens, Messenger ciphertext, OTP codes, private keys.

### 16.4 Health Check Endpoint

```python
@router.get("/health")
async def health_check():
    checks = {
        "mongodb": await check_mongodb(),
        "redis": await check_redis(),
        "celery": await check_celery_heartbeat(),
    }
    all_healthy = all(checks.values())
    return JSONResponse(
        status_code=200 if all_healthy else 503,
        content={"status": "ok" if all_healthy else "degraded", "checks": checks}
    )
```

---

## 17. Error Handling Standards

### 17.1 FastAPI Global Exception Handler

```python
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("unhandled_exception", path=request.url.path, error=str(exc))
    sentry_sdk.capture_exception(exc)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred."
            }
        }
    )
```

### 17.2 Standard Error Codes

| Code                    | HTTP Status | When                                   |
| ----------------------- | ----------- | -------------------------------------- |
| `INVALID_CREDENTIALS`   | 401         | Wrong email or password                |
| `TOKEN_EXPIRED`         | 401         | Access token expired                   |
| `TOKEN_INVALID`         | 401         | Malformed or tampered token            |
| `FORBIDDEN`             | 403         | Authorized but lacks permission        |
| `NOT_FOUND`             | 404         | Resource does not exist                |
| `EMAIL_TAKEN`           | 409         | Email already registered               |
| `INVALID_OTP`           | 400         | Wrong or expired OTP                   |
| `OTP_LOCKED`            | 429         | Too many OTP attempts                  |
| `RATE_LIMIT_EXCEEDED`   | 429         | Too many requests                      |
| `VALIDATION_ERROR`      | 422         | Request body fails Pydantic validation |
| `MEETING_LOCKED`        | 403         | Meeting room is locked                 |
| `MEETING_FULL`          | 403         | Meeting has reached 50 participants    |
| `WAITING_ROOM_DECLINED` | 403         | Host declined admission                |
| `MAX_KNOCKS_EXCEEDED`   | 403         | 3 re-knock limit reached               |
| `DEEPGRAM_UNAVAILABLE`  | 503         | Deepgram service error                 |
| `LLM_UNAVAILABLE`       | 503         | AI provider error                      |
| `INTERNAL_ERROR`        | 500         | Unhandled exception                    |

### 17.3 Frontend Error Boundaries (React)

```typescript
// src/components/ErrorBoundary.tsx
import * as Sentry from "@sentry/react";

export const RouteErrorBoundary = Sentry.withErrorBoundary(
  ({ children }: { children: React.ReactNode }) => <>{children}</>,
  { fallback: <GlobalErrorFallback /> }
);
```

### 17.4 Network Error Handling — Token Refresh Mutex

> **Fix #9:** The original spec described a simple 401 → refresh → retry pattern. On a page that fires 4+ API requests simultaneously (e.g. the dashboard), all requests would receive a 401 simultaneously and all would attempt to refresh. Since refresh tokens are single-use, only the first refresh succeeds; the other 3 calls would fail and incorrectly redirect the user to `/signin`.
>
> The fix uses a singleton promise (mutex). The first 401 creates the refresh promise. All subsequent 401s return the same promise — they wait for the same refresh to complete rather than creating new ones. After the refresh resolves, all callers retry with the new cookie.

```typescript
// src/lib/apiClient.ts

let refreshPromise: Promise<void> | null = null;

async function refreshAccessToken(): Promise<void> {
  // If a refresh is already in flight, all callers share it — no duplicate requests
  if (refreshPromise) return refreshPromise;

  refreshPromise = fetch("/v1/auth/refresh", {
    method: "POST",
    credentials: "include",
  })
    .then((res) => {
      if (!res.ok) {
        window.location.href = "/signin";
        throw new Error("Token refresh failed");
      }
    })
    .finally(() => {
      refreshPromise = null; // reset so the next expiry triggers a fresh refresh
    });

  return refreshPromise;
}

export async function apiRequest(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const res = await fetch(url, { ...options, credentials: "include" });

  if (res.status === 401) {
    await refreshAccessToken(); // all concurrent 401s wait on one refresh
    return fetch(url, { ...options, credentials: "include" }); // retry once
  }

  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After");
    // Show rate limit toast in UI
    throw new RateLimitError(retryAfter ? parseInt(retryAfter) : 60);
  }

  if (res.status === 503) {
    // Show service unavailable banner in UI via uiStore
    throw new ServiceUnavailableError();
  }

  return res;
}
```

---

## 18. API Versioning

### 18.1 Strategy

URL-based versioning: `/v1/`. Breaking changes require `/v2/`. Non-breaking additions do not change the version.

### 18.2 What Constitutes a Breaking Change

| Change                            | Breaking? |
| --------------------------------- | --------- |
| Add new optional request field    | No        |
| Add new response field            | No        |
| Add new endpoint                  | No        |
| Remove or rename endpoint         | **Yes**   |
| Remove or rename response field   | **Yes**   |
| Change field type                 | **Yes**   |
| Change authentication requirement | **Yes**   |

### 18.3 Versioned Router Setup

```python
v1_router = APIRouter(prefix="/v1")
v1_router.include_router(auth_router, prefix="/auth", tags=["Auth"])
v1_router.include_router(meetings_router, prefix="/meetings", tags=["Meetings"])
v1_router.include_router(dashboard_router, prefix="/dashboard", tags=["Dashboard"])
v1_router.include_router(calendar_router, prefix="/calendar", tags=["Calendar"])
v1_router.include_router(messenger_router, prefix="/messenger", tags=["Messenger"])
v1_router.include_router(action_items_router, prefix="/action-items", tags=["Action Items"])
v1_router.include_router(settings_router, prefix="/settings", tags=["Settings"])
v1_router.include_router(profile_router, prefix="/profile", tags=["Profile"])
v1_router.include_router(notifications_router, prefix="/notifications", tags=["Notifications"])

app.include_router(v1_router)
```

---

## Appendix A — Dependency Versions

```
# backend/pyproject.toml [project.dependencies] and note dev deps go under [project.optional-dependencies] dev = [...].
fastapi==0.110.0
uvicorn[standard]==0.27.1
pydantic==2.6.4
motor==3.4.0               # async MongoDB driver
redis[asyncio]==5.0.3      # async Redis client for pub/sub
celery==5.3.6

fastapi-users[motor]==13.x      # or latest — handles auth flows
PyJWT>=2.8.0                    # used internally by fastapi-users; keep explicit
passlib[argon2]==1.7.4          # used internally by fastapi-users; keep explicit

httpx==0.27.0
livekit==0.12.0
deepgram-sdk==3.2.7
openai==1.14.3
anthropic==0.20.0
boto3==1.34.51             # Cloudflare R2 (S3-compatible API)
resend==0.7.0
pynacl==1.5.0
Pillow>=10.3.0             # Avatar re-encoding to WebP (strips EXIF metadata)
pyotp>=2.9.0               # TOTP 2FA code generation and verification
structlog==24.1.0
sentry-sdk[fastapi]==1.41.0
pytest==8.1.1
pytest-asyncio==0.23.5
pytest-cov==5.0.0
fakeredis==2.21.0          # Redis mock for unit tests
```

```json
// frontend/package.json (key dependencies)
{
  "react": "18.3.0",
  "react-dom": "18.3.0",
  "react-router-dom": "^6.23.0",
  "vite": "^5.2.0",
  "@vitejs/plugin-react": "^4.2.0",
  "zustand": "^4.5.0",
  "tailwindcss": "^3.4.0",
  "autoprefixer": "^10.4.0",
  "postcss": "^8.4.0",
  "livekit-client": "^2.0.0",
  "@livekit/components-react": "^2.0.0",
  "tweetnacl": "^1.0.3",
  "tweetnacl-util": "^0.15.1",
  "idb": "^8.0.0",
  "@sentry/react": "^7.110.0",
  "vitest": "^1.5.0",
  "@testing-library/react": "^15.0.0",
  "@testing-library/user-event": "^14.5.0",
  "msw": "^2.2.0",
  "playwright": "^1.43.0"
}
```

---

## Appendix B — Pre-Launch Checklist

```
Infrastructure
□ MongoDB Atlas M0 cluster created, connection tested
□ MongoDB storage alert configured at 400 MB
□ Upstash Redis instance created, TLS URL confirmed
□ Upstash command usage monitored — switch to pay-per-use before public launch
□ Railway services deployed (FastAPI + Celery worker + Celery Beat)
□ Frontend hosting connected to GitHub (Cloudflare Pages or Vercel)
□ Custom domain configured and DNS pointing correctly
□ Cloudflare R2 buckets created (recordings, avatars — separate buckets)
□ All environment variables set in hosting platform

Security
□ PyJWT ≥ 2.8.0 in requirements.txt (not python-jose)
□ All HttpOnly cookies configured with Secure + SameSite=Lax
□ CORS origins locked to production domain only
□ HTTPS enforced on all endpoints
□ Security headers middleware enabled
□ Webhook signature verification enabled for LiveKit + Google Calendar
□ Rate limiting enabled on all auth endpoints
□ 50-participant limit enforced on token generation endpoints

GDPR
□ Privacy policy page live and linked from signup
□ Cookie consent banner implemented
□ Data export endpoint functional (tested end-to-end)
□ Account deletion scheduler tested
□ Guest data purge scheduled task running
□ Recording consent banner tested — shown to all participants on recording start

WebSocket
□ Redis pub/sub listener starting on app startup
□ Multi-instance event delivery tested (Celery → Redis → all instances → clients)

Observability
□ Sentry initialized on backend + frontend (PII scrubbing confirmed)
□ BetterStack monitors active for API + frontend
□ Health check endpoint returning 200

CI/CD
□ GitHub Actions CI passing on main branch
□ Database migrations running on deploy
□ Migration failure correctly blocks deploy
□ Staging environment deployed and smoke-tested

Testing
□ PyJWT decode with explicit algorithms=["HS256"] tested
□ Token refresh mutex tested under concurrent 401s
□ clearMeeting() resets all 7 fields verified
□ Celery chord callback (finalize_recap) tested
□ egress_ended → Deepgram trigger tested
□ All P0 E2E journeys passing
□ Backend unit test coverage ≥ 70%
□ Frontend component test coverage ≥ 60%
```

---

## 19. Changelog

### — April 30, 2026

| #   | Severity    | Change                                                                                                                          |
| --- | ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| #2  | 🔴 Critical | `ConnectionManager` replaced with Redis pub/sub fan-out — fixes silent event loss on multi-instance deploys (§10.2)             |
| #3  | 🔴 Critical | Deepgram now triggered by `egress_ended` webhook, not `room_finished` — recording file guaranteed to exist on R2 (§11.1, §12.1) |
| #4  | 🔴 Critical | Celery chord now has `finalize_recap` callback — recap correctly marked complete, host notified, auto-confirm scheduled (§11.1) |
| #5  | 🔴 Critical | `python-jose` replaced with `PyJWT>=2.8.0` — eliminates algorithm confusion CVE (§7.1, Appendix A)                              |
| #6  | 🟠 High     | Private key stored as non-extractable `CryptoKey` via Web Crypto API — XSS cannot export key (§13.2)                            |
| #8  | 🟠 High     | Key backup encrypted client-side with PBKDF2+AES-GCM before upload — server holds only `{salt, iv, ciphertext}` (§13.3)         |
| #9  | 🟠 High     | Token refresh mutex added — concurrent 401s share one refresh request, eliminates false sign-out (§17.4)                        |
| #10 | 🟡 Medium   | `clearMeeting()` now resets all 7 fields including `roomLocked`, `waitingRoomEnabled`, `reactionsEnabled` (§2.4)                |
| #11 | 🟡 Medium   | Deepgram `language` reads from `meeting.language` field — no longer hardcoded to `"en"` (§12.2)                                 |
| #14 | 🟡 Medium   | `MEETING_MAX_PARTICIPANTS=50` env var added, enforced on token generation, `MEETING_FULL` error code added (§7.5, §17.2)        |
| #15 | 🟡 Medium   | GCal renewal lookahead window explicitly set to 48 hours in Beat schedule comment and query (§11.2)                             |
| #17 | 🟢 Low      | `toggleRecording()` renamed to `setRecording(bool)` — correctly reflects server-driven state pattern (§2.4)                     |
| #20 | 🟢 Low      | Guest token flow sequence fully documented — `/join-guest` vs `/token` distinction clarified (§5.8)                             |

---

_Status: Current_
_Last Updated: April 30, 2026_
_Ready for build._

Appendix C:
One additional note for your setup: the venv itself is never committed or referenced in these docs — just create it locally with python -m venv .venv && source .venv/bin/activate && pip install -e ".[dev]" and add .venv/ to .gitignore. No doc change needed for that.

