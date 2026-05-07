# Task Breakdown: Authentication

**Feature:** #2 from MVP Roadmap
**Estimated Time:** 14–18 hours total
**Priority:** SECOND — must exist before any other feature
**Status:** [ ] In-Progress

> [!IMPORTANT]
> **New Rule:** New tasks and subtasks can be added if they are compulsory for security, stability, or architectural integrity.

---

## Feature 2: Authentication

---

### Task 2.1: Backend — Users Model & Auth Schemas [MVP]

- [ ] Create `backend/app/models/user.py`: `UserDocument` TypedDict with all fields from `meetio-db-schema.md#1-users` — `_id`, `email`, `email_verified`, `display_name`, `avatar_url`, `password_hash`, `providers`, `google_id`, `totp_enabled`, `totp_secret`, `is_active`, `deletion_requested_at`, `deletion_scheduled_at`, `timezone`, `language`, `theme`, `email_notifications`, `created_at`, `updated_at`, `last_seen_at`, `schema_version`
- [ ] Create `backend/app/models/session.py`: `SessionDocument` TypedDict with `_id`, `user_id`, `refresh_token_hash`, `device_info`, `is_revoked`, `expires_at`, `created_at`, `last_used_at`, `schema_version`
- [ ] Create `backend/app/schemas/auth.py` Pydantic models: `SignupRequest(email: EmailStr, password: str, display_name: str)` with `@field_validator("password")` enforcing **min 8 chars, 1 uppercase, 1 number, 1 special character** — raise `ValueError` on failure
- [ ] Create `SigninRequest(email: EmailStr, password: str)`, `OTPVerifyRequest(otp_session_id: str, code: str)`, `PasswordResetRequest(otp_session_id: str, code: str, new_password: str)`, `TOTPVerifyRequest(totp_session_id: str, code: str)`
- [ ] Create response schemas: `UserResponse(id, display_name, email, avatar_url, providers)`, `SigninResponse` (union: `UserResponse` OR `{requires_2fa: bool, totp_session_id: str}`), `TokenRefreshResponse`
- [ ] Write unit test: `SignupRequest` with weak password (no uppercase) raises `ValidationError`, strong password passes
- 📐 Schema: `meetio-db-schema.md#1-users`
- Status: [ ] Not Started
- Tests: [ ] Not Started

---

### Task 2.2: Backend — Auth Repository [MVP]

- [ ] Create `backend/app/repositories/user_repo.py`: `get_by_email(email: str) -> UserDocument | None` — query `users` collection, return None if not found
- [ ] Add `create_user(data: dict) -> str` — insert document, return inserted `_id` as string
- [ ] Add `update_user(user_id: str, update: dict)` — `$set` update, invalidate `user:profile:{user_id}` Redis cache key after write
- [ ] Create `backend/app/repositories/session_repo.py`: `create_session(user_id, refresh_token_hash, device_info, expires_at) -> str`, `get_by_token_hash(hash: str) -> SessionDocument | None`, `revoke_session(session_id: str)`, `revoke_all_sessions(user_id: str)`, `get_active_sessions(user_id: str) -> list`
- [ ] Add `mark_last_used(session_id: str)` — update `last_used_at` on every successful token refresh
- [ ] Write integration test: `create_user()` → `get_by_email()` → returns same document, `create_session()` → `revoke_session()` → `get_by_token_hash()` returns None
- 📐 Schema: `meetio-db-schema.md#2-sessions`
- Status: [ ] Not Started
- Tests: [ ] Not Started

---

### Task 2.3: Backend — Auth Service [MVP]

- [ ] Create `backend/app/services/auth_service.py`: `hash_password(plain: str) -> str` using `CryptContext(schemes=["argon2"])`, `verify_password(plain: str, hashed: str) -> bool`
- [ ] Add `create_access_token(data: dict, expires_delta: timedelta) -> str` — PyJWT `jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")`; `decode_token(token: str) -> dict` — `jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])`, raise `HTTPException(401, "TOKEN_INVALID")` on `InvalidTokenError`
- [ ] Add `generate_otp() -> str` — `secrets.randbelow(1000000)` zero-padded to 6 digits; `hash_otp(code: str) -> str` — `hashlib.sha256(code.encode()).hexdigest()`
- [ ] Add `store_otp(email: str, purpose: str, code: str)` — store `hash_otp(code)` in Redis key `otp:{email}:{purpose}` with TTL `settings.OTP_EXPIRE_MINUTES * 60`; `verify_otp(session_id: str, code: str) -> bool` — increment `otp:attempts:{session_id}` counter, check <= 5, compare hashes, delete key on match
- [ ] Add `set_auth_cookies(response: Response, access_token: str, refresh_token: str)` — `response.set_cookie("access_token", ..., httponly=True, secure=True, samesite="lax", max_age=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60)`, same for refresh token
- [ ] Add `clear_auth_cookies(response: Response)` — set both cookies with `max_age=0`
- [ ] Write unit test: `hash_password()` → `verify_password()` returns True; wrong password returns False
- [ ] Write unit test: `create_access_token()` → `decode_token()` → correct payload; tampered token raises HTTPException 401
- Status: [ ] Not Started
- Tests: [ ] Not Started

---

### Task 2.4: Backend — Email/Password Registration Endpoint [MVP]

- [ ] Create `backend/app/routers/auth.py` with `router = APIRouter(prefix="/auth", tags=["Auth"])`
- [ ] Implement `POST /auth/signup`: validate `SignupRequest`, check `user_repo.get_by_email(email)` — if exists raise `HTTPException(409, "EMAIL_TAKEN")`; hash password; store OTP in Redis; dispatch `send_email.delay(email, "Verify your MeetIO account", html)` Celery task; return `{message, otp_session_id}` with `201`
- [ ] Implement `POST /auth/otp/verify`: validate `OTPVerifyRequest`, call `auth_service.verify_otp()` — on failure raise `HTTPException(400, "INVALID_OTP")`, after 5 failures raise `HTTPException(429, "OTP_LOCKED")`; on success call `user_repo.create_user()` with `is_active: True`, `email_verified: True`; issue JWT; call `set_auth_cookies()`; return `UserResponse` with `201`
- [ ] Implement `POST /auth/otp/send`: look up email, dispatch OTP email, return `{otp_session_id, expires_in_seconds: 600}` — rate limit 3 req/15min per email via Redis counter `otp:rate:{email}`
- [ ] Write integration test: `POST /auth/signup` with existing email → 409 `EMAIL_TAKEN`; with new email → 201 + OTP stored in Redis
- [ ] Write E2E test (Playwright): fill signup form → submit → OTP page → enter OTP → redirected to `/dashboard`
- Status: [ ] Not Started
- Tests: [ ] Not Started

---

### Task 2.5: Backend — Sign-In, 2FA & Sign-Out Endpoints [MVP]

- [ ] Implement `POST /auth/signin`: look up user by email (`user_repo.get_by_email`), raise `HTTPException(401, "INVALID_CREDENTIALS")` if not found or `is_active: False`; call `verify_password()`, raise 401 on mismatch; apply rate limit 10 req/15min per IP via Redis counter `signin:rate:{ip}`
- [ ] If `users.totp_enabled: True`: store `totp_session_id` (UUID) → `totp:session:{uuid}: user_id` in Redis (10-min TTL), return `{requires_2fa: True, totp_session_id}` with no cookies — `200`
- [ ] If `totp_enabled: False`: call `session_repo.create_session()`, SHA-256 hash the refresh token, store hash only; call `set_auth_cookies()`; update `users.last_seen_at`; write login history event to Redis sorted set; return `UserResponse` — `200`
- [ ] Implement `POST /auth/2fa/verify`: retrieve `user_id` from `totp:session:{id}` Redis key — raise 404 if expired; verify TOTP code using `pyotp.TOTP(users.totp_secret).verify(code)` — increment failure counter, raise `OTP_LOCKED` after 5; on success create session, set cookies, return `UserResponse`
- [ ] Implement `POST /auth/signout`: read `access_token` cookie, decode JWT to get `session_id`, call `session_repo.revoke_session()`, call `clear_auth_cookies(response)`, return `204`
- [ ] Write unit test: PyJWT encode → decode with `algorithms=["HS256"]` allowlist — assert payload matches; assert tampered token raises 401
- Status: [ ] Not Started
- Tests: [ ] Not Started

---

### Task 2.6: Backend — Google OAuth Endpoints [MVP]

- [ ] Implement `GET /auth/google`: build `authorization_url` using `google-auth` library with scopes `["openid", "email", "profile"]`, embed `intent` and redirect URL in `state` param (HMAC-signed to prevent CSRF), return `302` redirect
- [ ] Implement `GET /auth/google/callback`: exchange code for Google tokens server-side; extract `email`, `name`, `picture`, `sub` (google_id) from ID token
- [ ] If email not in DB: call `user_repo.create_user()` with `providers: ["google"]`, `google_id: sub`, download Google avatar to R2 `avatars/{user_id}.webp` via `httpx` + `boto3`; create session; set cookies; redirect to `FRONTEND_URL/dashboard`
- [ ] If email exists with `providers: ["email"]`: store link OTP in Redis, redirect to `FRONTEND_URL/signin?link_required=true&otp_session_id=...` — after OTP verify, append `"google"` to `providers`, store `google_id`
- [ ] If email exists with `providers: ["google"]`: create session directly, set cookies, redirect to dashboard
- [ ] Write integration test (mock Google): callback with new email → user created with `providers: ["google"]`; callback with existing email-only account → redirect with `link_required=true`
- Status: [ ] Not Started
- Tests: [ ] Not Started

---

### Task 2.7: Backend — Password Reset & Token Refresh Endpoints [MVP]

- [ ] Implement `POST /auth/password/forgot`: call `user_repo.get_by_email(email)` — always return `200` regardless of result (prevents email enumeration); if user found: generate OTP, store in Redis, dispatch `send_email.delay()` with reset template
- [ ] Implement `POST /auth/password/reset`: validate `PasswordResetRequest`, verify OTP; hash new password; call `user_repo.update_user({password_hash: hashed})`; call `session_repo.revoke_all_sessions(user_id)` to invalidate all devices; call `clear_auth_cookies(response)`; return `200`
- [ ] Implement `POST /auth/refresh`: read `refresh_token` cookie only; SHA-256 hash it; call `session_repo.get_by_token_hash(hash)` — raise `TOKEN_EXPIRED` 401 + clear cookies if not found or revoked; rotate: delete old session, create new session with new refresh token hash; issue new `access_token` cookie; call `session_repo.mark_last_used()`; return `200`
- [ ] Add `get_current_user` FastAPI dependency in `backend/app/dependencies.py`: read `access_token` cookie, call `auth_service.decode_token()`, fetch user from DB, raise 401 if user not found or `is_active: False`
- [ ] Write integration test: `POST /auth/password/forgot` with unknown email → 200 (no OTP stored); with known email → 200 + OTP in Redis
- [ ] Write integration test: `POST /auth/refresh` with valid token → new access cookie set; with expired token → 401 + cookies cleared
- Status: [ ] Not Started
- Tests: [ ] Not Started

---

### Task 2.8: Backend — Security Hardening & Rate Limiting [Compulsory]

- [ ] Implement `backend/app/middleware/rate_limit.py`: Redis-based sliding window rate limiter for auth endpoints (`/signup`, `/signin`, `/otp/send`, `/password/forgot`).
- [ ] Configure `backend/app/middleware/security.py`: Add `SecureCookieMiddleware` and `ContentSecurityPolicy` (CSP) headers to the FastAPI app.
- [ ] Implement IP-based blocking for brute-force attempts on `/signin`.
- [ ] Write integration test: Verify 429 `Rate limit exceeded` response after exceeding thresholds.
- Status: [ ] Not Started
- Tests: [ ] Not Started

---

### Task 2.9: Frontend — Auth API Service [MVP]

- [ ] Create `frontend/src/lib/authApi.ts`: export `signup(email, password, displayName)` → `POST /v1/auth/signup`, `verifyOtp(sessionId, code)` → `POST /v1/auth/otp/verify`, `sendOtp(email, purpose)` → `POST /v1/auth/otp/send`
- [ ] Export `signin(email, password)` → `POST /v1/auth/signin` — returns `{user}` OR `{requires_2fa, totp_session_id}`; `verify2fa(totpSessionId, code)` → `POST /v1/auth/2fa/verify`
- [ ] Export `signinGoogle(intent)` → redirect to `GET /v1/auth/google?intent={intent}` (full page redirect, not fetch)
- [ ] Export `signout()` → `POST /v1/auth/signout`; `forgotPassword(email)` → `POST /v1/auth/password/forgot`; `resetPassword(sessionId, code, newPassword)` → `POST /v1/auth/password/reset`
- [ ] All functions use `apiClient.apiRequest()` — errors parsed from envelope `error.code` field, re-thrown as typed errors for UI layer to handle
- [ ] Write Vitest unit test: `signin()` with mock returning `requires_2fa: true` → returned object has `totpSessionId` field, no user field
- Status: [ ] Not Started
- Tests: [ ] Not Started

---

### Task 2.10: Frontend — Sign-In Page [MVP]

- [ ] Create `frontend/src/pages/SignInPage.tsx` — rendered at `/signin`, wrapped by `AuthLayout`
- [ ] Form: email input (`type="email"`, autocomplete="email"), password input (`type="password"`, autocomplete="current-password"), [Sign in] submit button — all controlled via `useState`
- [ ] On submit: call `authApi.signin()` — if response has `user` → call `authStore.setUser(user)`, navigate to `?redirect` param or `/dashboard`; if response has `requires_2fa` → navigate to `/signin/2fa?session={totpSessionId}`
- [ ] Show inline field errors for `INVALID_CREDENTIALS` ("Incorrect email or password"), `RATE_LIMIT_EXCEEDED` ("Too many attempts — try again in X minutes") — never show which field is wrong
- [ ] [Sign in with Google] button: calls `authApi.signinGoogle("signin")` — full page redirect
- [ ] [Forgot password?] link → `/forgot-password`; [Create account] link → `/signup`
- [ ] Loading state: button shows spinner, disabled during request; success state: brief "Signing in..." before navigation
- Status: [ ] Not Started
- Tests: [ ] Not Started

---

### Task 2.11: Frontend — Sign-Up Page [MVP]

- [ ] Create `frontend/src/pages/SignUpPage.tsx` — rendered at `/signup`, wrapped by `AuthLayout`
- [ ] Form fields: display name (text, min 2 chars), email (`type="email"`), password (`type="password"`, show strength indicator: weak/fair/strong based on length + char variety)
- [ ] Implement password requirement checklist UI: Visual feedback for (Min 8 chars, 1 uppercase, 1 number, 1 special character) that updates as the user types.
- [ ] On submit: call `authApi.signup()` — on success (201) navigate to `/signup/verify?session={otp_session_id}&email={email}`
- [ ] Show inline errors: `EMAIL_TAKEN` ("An account with this email already exists — [Sign in]?"), `VALIDATION_ERROR` per field
- [ ] [Sign up with Google] button → `authApi.signinGoogle("signup")`
- [ ] [Already have an account?] link → `/signin`
- [ ] Password strength indicator: `<div>` bar, grey → yellow → green as entropy increases using character class checks
- Status: [ ] Not Started
- Tests: [ ] Not Started

---

### Task 2.12: Frontend — OTP Verification Page [MVP]

- [ ] Create `frontend/src/pages/OTPVerifyPage.tsx` — rendered at `/signup/verify`, reads `session` and `email` from query params
- [ ] Six individual digit input boxes (`<input maxLength={1} type="text" inputMode="numeric">`), auto-advance on digit entry, auto-focus first on mount, support paste of 6-digit string
- [ ] On complete (all 6 filled): auto-submit — call `authApi.verifyOtp(sessionId, code)` — on success call `authStore.setUser()`, navigate to `/dashboard`
- [ ] Error states: `INVALID_OTP` → shake animation on inputs + "Incorrect code — X attempts remaining"; `OTP_LOCKED` → disable form + "Too many attempts. Request a new code."
- [ ] [Resend code] button: disabled for 60 seconds after send (countdown shown), then calls `authApi.sendOtp(email, "signup")` — resets inputs on resend
- [ ] Show "We sent a code to {email}" — mask email as `p***@gmail.com` for privacy
- Status: [ ] Not Started
- Tests: [ ] Not Started

---

### Task 2.13: Frontend — Forgot Password & Reset Pages [MVP]

- [ ] Create `frontend/src/pages/ForgotPasswordPage.tsx` at `/forgot-password`: email input, [Send reset code] button, calls `authApi.forgotPassword(email)` — always show success state ("If this email is registered, a code was sent") regardless of response to prevent enumeration
- [ ] Create `frontend/src/pages/ResetPasswordPage.tsx` at `/reset-password?session={id}`: OTP inputs (same 6-box component as signup), new password input with strength indicator and requirements checklist, confirm password input
- [ ] Validate passwords match client-side before submit; call `authApi.resetPassword(sessionId, code, newPassword)` on submit
- [ ] On success: show "Password updated. Please sign in." toast, navigate to `/signin` after 2 seconds
- [ ] Error: `INVALID_OTP` → inputs shake, attempts remaining shown; `VALIDATION_ERROR` → per-field message
- [ ] [Back to sign in] link visible on both pages
- Status: [ ] Not Started
- Tests: [ ] Not Started

---

### Task 2.14: Frontend — 2FA Verify Page [MVP]

- [ ] Create `frontend/src/pages/TwoFAVerifyPage.tsx` at `/signin/2fa?session={totpSessionId}`: 6-digit authenticator code input (single input `type="text" inputMode="numeric" maxLength={6}`), [Verify] button
- [ ] On submit: call `authApi.verify2fa(totpSessionId, code)` — on success call `authStore.setUser(user)`, navigate to `?redirect` or `/dashboard`
- [ ] Error: `INVALID_OTP` → "Incorrect code — X attempts remaining" inline; `OTP_LOCKED` → "Too many attempts. Please sign in again." + [Back to sign in] button, session cleared
- [ ] `NOT_FOUND` (expired totp_session_id after 10 min): "This session expired. Please sign in again." + navigate to `/signin` after 3 seconds
- [ ] Auto-submit when 6th digit entered (no need to click Verify)
- [ ] [Use a different account] link → `/signin`
- Status: [ ] Not Started
- Tests: [ ] Not Started

---

### Task 2.15: Frontend — Auth Guard & Route Protection [MVP]

- [ ] Create `frontend/src/components/guards/AuthGuard.tsx`: reads `authStore.isAuthenticated` and `authStore.isLoading`; if loading → render `<PageSpinner />`; if not authenticated → `<Navigate to={"/signin?redirect=" + encodeURIComponent(location.pathname)} replace />`; else → `<Outlet />`
- [ ] Wrap all authenticated routes (`/dashboard`, `/calendar`, `/messenger`, `/meetings/*`, `/action-items`, `/settings`, `/profile`) with `<AuthGuard />` in `router.tsx`
- [ ] Create `frontend/src/components/guards/GuestGuard.tsx`: if authenticated → `<Navigate to="/dashboard" replace />`; else → `<Outlet />` — wrap `/signin`, `/signup`, `/forgot-password`, `/reset-password` with this
- [ ] On app boot (`main.tsx`): call `GET /v1/profile` to rehydrate auth state — `authStore.setLoading(true)` before call, `setUser(user)` or `setUser(null)` in finally block, `setLoading(false)` — prevents flash of redirect
- [ ] Handle Google OAuth callback: on mount at `/dashboard`, check for `?link_required=true` query param — if present show account-linking toast with OTP flow
- Status: [ ] Not Started
- Tests: [ ] Not Started

---

## Summary

| Category     | Tasks  | Completed | Remaining |
| ------------ | ------ | --------- | --------- |
| MVP Tasks    | 15     | 0         | 15        |
| Future Tasks | 0      | 0         | 0         |
| **Total**    | **15** | **0**     | **15**    |
