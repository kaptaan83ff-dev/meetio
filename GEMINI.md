# MeetIO Project Mandates

This file defines the foundational standards and workflows for the MeetIO project. Adhere to these guidelines for all development tasks.

## ?? Project Overview
MeetIO is a high-performance video conferencing web application for students and small teams, supporting up to 50 concurrent participants per meeting with real-time transcription and AI-powered insights.

## ?? Tech Stack (Confirmed)
- **Frontend:** React 18.3 (TSX), Vite 5.x, Zustand (State), Tailwind CSS (Styling), React Router v6.
- **Backend:** Python 3.12, FastAPI 0.110+, Motor (Async MongoDB), Redis (Upstash).
- **Infrastructure:** Celery + Celery Beat (Background Tasks), LiveKit (Real-time Video), Deepgram (STT), OpenAI/Anthropic (AI).
- **Security:** PyJWT >= 2.8.0 (Auth), tweetnacl/PyNaCl (E2E Encryption).
- **Hosting:** Cloudflare Pages (Frontend), Railway (Backend), Cloudflare R2 (Storage).

## ?? Project Structure
- `backend/app/`: Core FastAPI application logic (routers, models, services, tasks, websocket).
- `frontend/`: React SPA source code.
- `docs/`: Authoritative documentation (requirements, mvp roadmap, build tasks).
- `migrations/`: MongoDB schema migrations using `migrate-mongo`.

## ?? Architecture & Standards
- **Async First:** Utilize `async/await` for all I/O operations (FastAPI, Motor, Redis).
- **Strict Typing:** Mandatory TypeScript for frontend and Pydantic models for backend.
- **Dependency Management:** 
  - Backend: `pyproject.toml` (standardized dependencies).
  - Frontend: `package.json`.
- **API Standards:** Follow `docs/requirements/meetio-api-spec.md`. Use `HttpOnly` cookies for JWTs.
- **Database:** MongoDB 7.x. Follow `docs/requirements/meetio-db-schema.md` for collections and indexes.

## ?? Workflows
- **Roadmap Alignment:** Always reference `docs/mvp/meetio-mvp-roadmap.md` and the current `docs/build/XX-task-breakdown.md` before starting work.
- **Task Tracking:** Update the `Status: [ ]` checkboxes in the `docs/build/` files upon task completion.
- **Surgical Updates:** Maintain clean, idiomatic code consistent with the established patterns in `meetio-trd.md`.
- **Validation:** Run `pytest` for backend and verify frontend changes against the `frontend-design` skill guidelines.

## ?? Constraints & Security
- **No `python-jose`:** Use `PyJWT>=2.8.0` for all JWT operations.
- **Secrets:** Never commit `.env` files. Reference `.env.example` for required variables.
- **Scope:** Web only (v1). No mobile app development.
- **Assets:** Use locally generated CSS/SVG placeholders or WebP re-encoded images for performance.
