# MeetIO — Conventions (Versioning, Envelope, Auth)

## 1) API Versioning

- API versioning is URL-based.
- All REST endpoints are served under the `/v1/...` prefix.
- Non-breaking additions do not change the version; breaking changes require a new `/v2/...` prefix.

## 2) Response Envelope

All API responses use:

```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": { "timestamp": "2026-04-30T10:00:00Z", "request_id": "req_abc123" }
}
```

On error:

```json
{
  "success": false,
  "data": null,
  "error": { "code": "SOME_CODE", "message": "Human readable message", "field": "optional_field" },
  "meta": { "timestamp": "2026-04-30T10:00:00Z", "request_id": "req_abc123" }
}
```

## 3) Request IDs

- Every request has a server-generated `meta.request_id`.
- The same value is also returned as the `X-Request-Id` response header.

## 4) Auth (FastAPI Users)

- Auth is library-managed (FastAPI Users).
- Transport is HttpOnly cookies.
- The primary auth cookie is `fastapiusersauth`.
- The refresh token uses a dedicated `refresh_token` cookie.
- Session strategy is stateful (DatabaseStrategy backed by the `sessions` collection) to support server-side revocation.
- Do not treat `fastapiusersauth` as the refresh token cookie.
