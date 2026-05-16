# Task Breakdown: Authentication

**Feature:** Feature 2 from MVP Roadmap
**Estimated Time:** 12–16 hours
**Priority:** SECOND — must be complete before Session Management, Profile, and all meeting features
**Status:** [x] Implemented and smoke-tested locally

**Last verification:** Full backend tests, frontend type-check/lint/tests, and Docker local auth smoke pass completed.

**Implementation note:** The detailed task checklists below remain useful as acceptance criteria. The current MVP implementation covers Tasks 2.1â€“2.15; Task 2.16 is intentionally deferred.

---

## Feature 2: Authentication

---

### Task 2.1: Backend - FastAPI Users Core Configuration [MVP]

- [ ] Create `backend/app/models/user.py`: define `User` base class extending `fastapi_users.db.MotorBaseUser[str]` with custom fields: `display_name: str`, `avatar_url: Optional[str] = None`, `avatar_type: Optional[str] = None`, `providers: List[str] = []`, `google_id: Optional[str] = None`, `totp_enabled: bool = False`, `totp_secret: Optional[str] = None`, `timezone: str = "UTC"`, `language: str = "en"`, `theme: str = "system"`, `email_notifications: dict`, `deletion_requested_at: Optional[str] = None`, `deletion_scheduled_at: Optional[str] = None`, `schema_version: int = 1` (timestamps stored as ISO 8601 strings per DB schema)
- [ ] Define `UserCreate(BaseUserCreate)` schema adding `display_name: str` as a required field — FastAPI Users validates `email` and `password` by default; `display_name` must be added explicitly to the create schema
- [ ] Define `UserUpdate(BaseUserUpdate)` schema with optional `display_name`, `avatar_url`, `timezone`, `language`, `theme`, `email_notifications` — keep this schema focused on auth-owned fields now; profile/settings endpoints consume it later in Feature 4
- [ ] Configure Motor adapter in `backend/app/db.py`: use `fastapi_users_db_motor.MongoDBUserDatabase` for the `users` collection, expose `async def get_user_db()` FastAPI dependency returning the adapter — all FastAPI Users routers require this dependency
- [ ] Create `backend/app/auth/manager.py` with `UserManager(BaseUserManager[User, str])`: override `on_after_register`, `on_after_forgot_password`, `on_after_reset_password`, `on_after_login` — stubs first, logic added in later tasks
- [ ] Configure `CookieTransport(cookie_name="fastapiusersauth", cookie_max_age=14400, cookie_secure=True, cookie_httponly=True, cookie_samesite="lax")` and `DatabaseStrategy` backed by `sessions` collection — `DatabaseStrategy` is required for `DELETE /v1/settings/sessions/{id}` remote revocation (Feature 3)
- [ ] Register all FastAPI Users routers in `backend/app/routers/auth.py`: `get_auth_router(backend)`, `get_register_router(UserRead, UserCreate)`, `get_verify_router(UserRead)`, `get_reset_password_router()` — all mounted under `/v1/auth` prefix; confirm route paths match API spec §1 exactly
- 📐 Schema: `docs/requirements/meetio-db-schema.md#1-users`
- Status: [ ] TODO

---

### Task 2.2: Backend - Email/Password Registration [MVP]

- [ ] Implement `on_after_register(user, request)` in `UserManager`: call `send_verification_email.delay(user.id, str(token))` as a Celery async task — do not send email synchronously inside the hook; register failure must not block the response
- [ ] Create `backend/app/tasks/notifications.py` task `send_verification_email(user_id: str, token: str)`: fetch user from DB, render Resend email with subject `"Verify your MeetIO account"` and body containing the verification link `{FRONTEND_URL}/verify?token={token}` — raise `MaxRetriesExceededError` after 3 attempts with 60s backoff
- [ ] Configure `get_verify_router(UserRead)` endpoint `POST /v1/auth/verify`: on valid token, FastAPI Users sets `is_verified: True` and `is_active: True` on the `users` document — verify that the Motor adapter updates the correct fields
- [ ] Add `POST /v1/auth/register` request validation: `display_name` must be 2–50 characters, strip leading/trailing whitespace — return `VALIDATION_ERROR` 422 if blank or too long; FastAPI Users validates email uniqueness and raises `UserAlreadyExists` which maps to `EMAIL_TAKEN` 409
- [ ] Write integration test `tests/test_auth_register.py`: POST `/v1/auth/register` with valid body → 201, user in DB with `is_verified: False`; POST `/v1/auth/verify` with token → `is_verified: True`; POST `/v1/auth/register` with duplicate email → 409 `EMAIL_TAKEN`
- [ ] Write E2E test: full flow — register → Celery task fires → verification token received → POST `/v1/auth/verify` → user `is_active: True` in DB
- 📐 Schema: `docs/requirements/meetio-db-schema.md#1-users`
- Status: [ ] TODO

---

### Task 2.3: Backend - Email/Password Sign-In & 2FA Intercept [MVP]

- [ ] Configure `get_auth_router(backend)` for `POST /v1/auth/login`: FastAPI Users OAuth2 password flow accepts `username` + `password` as form data — confirm `username` maps to `email` field (FastAPI Users default); on success, `CookieTransport` sets `fastapiusersauth` HttpOnly cookie and `DatabaseStrategy` writes a new `sessions` document
- [ ] Add device_info capture on sign-in: override `on_after_login` in `UserManager` to enrich the newly created `sessions` document with `device_info: {user_agent, ip_anonymised, city, country}` — extract `User-Agent` from `request.headers`, anonymise last IP octet (`103.21.44.x`); set `city`/`country` to `None` by default (geo lookup is an optional enhancement, not required for MVP)
- [ ] Implement 2FA intercept middleware: after credential verification, check `user.totp_enabled`; if `True`, do NOT set cookies — instead return `200 {requires_2fa: true, totp_session_id: "<uuid>"}` and store `{user_id}` in Redis under key `totp_session:{totp_session_id}` with 5-minute TTL
- [ ] Implement `POST /v1/auth/2fa/verify` custom route (API spec §1): retrieve `totp_session_id` from Redis, call `pyotp.TOTP(user.totp_secret).verify(code, valid_window=1)` — on success, delete Redis key, set cookies; implement 5-attempt lockout: increment `totp_attempts:{totp_session_id}` counter in Redis with 300s TTL, return `OTP_LOCKED` 429 on 6th attempt
- [ ] Write integration test: login with 2FA-enabled account → `requires_2fa: true` returned, no cookies set; POST `/v1/auth/2fa/verify` with correct code → cookies set; POST `/v1/auth/2fa/verify` 6 times with wrong code → 429 `OTP_LOCKED`
- [ ] Write unit test: `on_after_login` hook correctly anonymises IP last octet (e.g., `"103.21.44.55"` → `"103.21.44.x"`); any optional device enrichment failures return `None` fields without raising
- 📐 Schema: `docs/requirements/meetio-db-schema.md#2-sessions`
- Status: [ ] TODO

---

### Task 2.4: Backend - TOTP 2FA Setup [MVP]

- [ ] Implement `POST /v1/settings/2fa` (API spec §7) with `action: "enable" | "disable"`: on `enable`, generate `pyotp.random_base32()` secret, build QR URL via `pyotp.TOTP(secret).provisioning_uri(user.email, issuer_name="MeetIO")`, encrypt `secret` with AES-256-GCM using `settings.SECRET_KEY` before storing in `users.totp_secret` — never store raw TOTP secret in DB
- [ ] On `enable` response: return `{totp_secret, qr_code_url, message}` per API spec §7 — secret is shown once for manual entry in authenticator apps; after enable, the client must POST `/v1/auth/2fa/verify` with a valid code before `totp_enabled: True` is committed to DB (prevents lockout from misconfiguration)
- [ ] On `disable`: require `action: "disable"`, set `users.totp_enabled = False`, set `users.totp_secret = None`, return `200 {message: "2FA disabled."}`
- [ ] Implement AES-256-GCM encryption helpers in `backend/app/lib/crypto.py`: `encrypt_field(plaintext: str, key: str) -> str` and `decrypt_field(ciphertext: str, key: str) -> str` — used for `totp_secret` and any future sensitive field encryption; raise `ValueError` if decryption fails
- [ ] Write unit test `tests/test_crypto.py`: encrypt → decrypt round-trip returns original string; tampered ciphertext raises `ValueError`; write unit test for TOTP verification: generate code with `pyotp.TOTP(secret).now()`, verify passes; wrong code fails; 6th attempt returns `OTP_LOCKED` 429
- [ ] Write integration test: enable 2FA → DB has `totp_secret` (encrypted, not raw); disable 2FA → `totp_enabled: False`, `totp_secret: None` in DB
- Status: [ ] TODO

---

### Task 2.5: Backend - Google OAuth Integration [MVP]

- [ ] Configure Google OAuth2 client in `backend/app/auth/oauth.py`: `google_oauth_client = GoogleOAuth2(settings.GOOGLE_CLIENT_ID, settings.GOOGLE_CLIENT_SECRET)` using `httpx-oauth`; add `get_oauth_router(google_oauth_client, backend, settings.SECRET_KEY, redirect_url=settings.GOOGLE_REDIRECT_URI, associate_by_email=True)` mounted under `/v1/auth/google`
- [ ] Set `associate_by_email=True` so that a user who previously registered with email/password can link their Google account without creating a duplicate — FastAPI Users merges on matching email
- [ ] Implement `on_after_oauth_account_add(user, oauth_account, request)` in `UserManager`: if `user.avatar_url is None` and `oauth_account.account_image_url`, set `users.avatar_url = oauth_account.account_image_url` and `avatar_type = "google"`; always ensure `google_id` and `"google"` are in `users.providers` — do NOT overwrite existing upload avatar
- [ ] Confirm `GET /v1/auth/google/callback` redirect on success goes to `{FRONTEND_URL}/dashboard` — set `redirect_url` in `get_oauth_router` or handle via custom callback; on failure, redirect to `{FRONTEND_URL}/signin?error=oauth_failed`
- [ ] Write integration test (mock Google token endpoint): new Google user → account created with `providers: ["google"]`, `google_id` set, `avatar_url` populated; existing email user links Google → `providers: ["email", "google"]`, no duplicate account; mock `on_after_oauth_account_add` → avatar set correctly
- [ ] Write unit test: `on_after_oauth_account_add` — user with existing upload avatar: `avatar_url` unchanged; user with `avatar_type: "google"` and new OAuth image: `avatar_url` updated
- 📐 Schema: `docs/requirements/meetio-db-schema.md#1-users`
- Status: [ ] TODO

---

### Task 2.6: Backend - Password Reset Flow [MVP]

- [ ] Implement `on_after_forgot_password(user, token, request)` in `UserManager`: dispatch Celery task `send_password_reset_email.delay(user.id, token)` — send even if `user.is_verified: False` to prevent account enumeration; `POST /v1/auth/forgot-password` must always return `202` regardless of whether the email exists (FastAPI Users default behavior — verify this is not overridden)
- [ ] Create Celery task `send_password_reset_email(user_id, token)` in `tasks/notifications.py`: build reset link `{FRONTEND_URL}/reset-password?token={token}`, send via Resend with subject `"Reset your MeetIO password"` — 3-attempt retry with 60s backoff; log failure without re-raising to avoid 500 on `/v1/auth/forgot-password`
- [ ] Implement `on_after_reset_password(user, request)` in `UserManager`: revoke ALL existing sessions for `user.id` by updating `sessions` collection `$set {is_revoked: True}` where `user_id == user.id` — password reset invalidates all devices simultaneously (security requirement from Feature 3)
- [ ] Confirm `POST /v1/auth/reset-password` accepts `{token, password}` JSON body per API spec §1 — FastAPI Users default form matches; verify password minimum requirements (≥8 chars) are enforced by FastAPI Users `PasswordHelper` — do not add duplicate validation
- [ ] Write integration test: unknown email → 202 (no leak); known email → Celery task queued, token stored; valid token + new password → password updated, all sessions `is_revoked: True` in DB; invalid/expired token → 400
- Status: [ ] TODO

---

### Task 2.7: Backend - Token Refresh Route [MVP]

- [ ] Create custom `POST /v1/auth/refresh` route in `backend/app/routers/auth.py` (API spec §1): read the dedicated `refresh_token` cookie while leaving the FastAPI Users `fastapiusersauth` cookie as the primary auth cookie; return `TOKEN_INVALID` 401 if the refresh cookie is missing
- [ ] Look up the token's SHA-256 hash in `sessions` collection: `sessions.find_one({refresh_token_hash: sha256(token), is_revoked: False, expires_at: {$gt: now()}})`; return `TOKEN_EXPIRED` 401 if not found; return `TOKEN_INVALID` 401 if `is_revoked: True`
- [ ] Rotate the token: delete the old `sessions` document, generate a new refresh token, hash it, insert a new `sessions` document with same `user_id` and fresh `expires_at = now() + 15 days`, update `last_used_at` — single-use rotation prevents refresh token replay attacks
- [ ] Issue new cookies via `CookieTransport`: refresh the `fastapiusersauth` auth cookie plus the dedicated `refresh_token` cookie (15d expiry) — match `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` and `JWT_REFRESH_TOKEN_EXPIRE_DAYS` from `settings`
- [ ] Write integration test: valid refresh token → 200, refreshed auth cookie set, old refresh token no longer valid; expired refresh token → 401 `TOKEN_EXPIRED`; concurrent refresh test — two simultaneous `/v1/auth/refresh` calls with same token → second returns 401 (rotation prevents double-use)
- Status: [ ] TODO

---

### Task 2.8: Backend - Sign Out [MVP]

- [ ] Confirm `POST /v1/auth/logout` route is registered via `get_auth_router(backend)` and requires `🔑` auth — FastAPI Users `DatabaseStrategy` marks the current token as `is_revoked: True` in `sessions` on logout; `CookieTransport` sets `fastapiusersauth` cookie `Max-Age=0` to clear the browser cookie
- [ ] Implement `on_after_logout(user, token, request)` hook in `UserManager` (if supported by FastAPI Users version in use): update `sessions` document `last_used_at` to `now()` — tracks last activity time for session listing in Feature 3
- [ ] Add a rate limit of 10 calls per minute per IP on `POST /v1/auth/logout` to prevent DoS of session table writes — apply via `slowapi` limiter decorator matching the pattern used on `/v1/auth/login`
- [ ] Ensure the frontend `/signin` redirect happens client-side after the 204 response — `POST /v1/auth/logout` returns `204 No Content`; the frontend `useAuthStore.logout()` action clears Zustand state and calls `router.navigate("/signin")` after the API call resolves
- [ ] Write integration test: authenticated user → POST `/v1/auth/logout` → 204, session `is_revoked: True` in DB, cookie cleared (response has `Set-Cookie` with `Max-Age=0`); unauthenticated POST `/v1/auth/logout` → 401
- Status: [ ] TODO

---

### Task 2.9: Frontend - API Client & 401 Refresh Mutex [MVP]

- [ ] Create `frontend/src/lib/apiClient.ts` exporting `async function apiRequest<T>(path: string, options?: RequestInit): Promise<T>`: calls `fetch(env.apiUrl + path, {credentials: "include", ...options})`, parses JSON response, unwraps `data` field from API envelope `{success, data, error, meta}`
- [ ] Implement 401 refresh mutex: declare module-level `let refreshPromise: Promise<void> | null = null`; on 401 response, if `refreshPromise` is null, set `refreshPromise = fetch("/v1/auth/refresh", {method:"POST", credentials:"include"}).then(() => { refreshPromise = null })`, else wait on existing `refreshPromise`; after refresh resolves, retry original request exactly once; if retry still 401, call `useAuthStore.getState().logout()` and throw
- [ ] Add typed error parsing: on non-2xx response, extract `error.code` and `error.message` from the envelope, throw a custom `ApiError` class with `code: string` and `message: string` properties — callers can `catch(e) { if (e instanceof ApiError && e.code === "MEETING_FULL") ... }`
- [ ] Write unit test `tests/apiClient.test.ts` (Vitest + MSW): mock server returns 401 then 200 on retry — assert exactly 1 call to `/v1/auth/refresh` and 1 retry; mock 4 concurrent calls all returning 401 — assert exactly 1 `fetch("/v1/auth/refresh")` fired (mutex working), all 4 callers receive the retried response
- [ ] Create `frontend/src/lib/authApi.ts` exporting typed API functions: `register(email, password, displayName)`, `login(email, password)`, `logout()`, `forgotPassword(email)`, `resetPassword(token, password)`, `refreshToken()`, `verify2FA(totpSessionId, code)` — each calls `apiRequest` with correct path, method, and body per API spec §1
- [ ] Create `frontend/src/lib/settingsApi.ts` exporting: `enable2FA()`, `disable2FA()`, `changePassword(currentPassword, newPassword)`, `updateSettings(payload)`, `getSettings()`, `getLinkedAccounts()`, `deleteLinkedAccount(provider)` — all call `apiRequest` with correct paths from API spec §7
- Status: [ ] TODO

---

### Task 2.10: Frontend - Auth Zustand Store [MVP]

- [ ] Create `frontend/src/stores/authStore.ts` with `useAuthStore = create<AuthState>()(...)`: state fields `user: User | null`, `isAuthenticated: boolean`, `isLoading: boolean`, `error: string | null`; `User` type matches API spec §8 profile shape: `{user_id, display_name, email, avatar_url, avatar_type, timezone, language, providers}`
- [ ] Implement `login(email, password)` action: call `authApi.login()`, on success call `fetchCurrentUser()` to populate `user` state, set `isAuthenticated: true`; on `INVALID_CREDENTIALS` 401 set `error: "Invalid email or password"`; on `requires_2fa: true` response, return `{requires_2fa: true, totp_session_id}` without setting `isAuthenticated`
- [ ] Implement `logout()` action: call `authApi.logout()`, clear `user: null`, `isAuthenticated: false`, `error: null` — always clear local state even if API call fails (network error must not leave user stuck in authenticated state)
- [ ] Implement `fetchCurrentUser()` action: call `GET /v1/auth/users/me` via `apiRequest`, set `user` from response; called on app mount in `App.tsx` to rehydrate auth state from existing cookie — if 401, set `isAuthenticated: false` without triggering a toast
- [ ] Add `initAuth()` action called in `App.tsx` `useEffect([], ...)`: calls `fetchCurrentUser()`, sets `isLoading: false` when complete regardless of outcome — prevents flash of unauthenticated state on page refresh; set `isLoading: true` initially so protected routes show a loading spinner, not a redirect
- [ ] Write unit test: `login()` with valid credentials → `isAuthenticated: true`, `user` populated; `login()` with wrong password → `error` set, `isAuthenticated: false`; `logout()` on network error → state still cleared
- Status: [ ] TODO

---

### Task 2.11: Frontend - Sign-In Page [MVP]

- [ ] Create `frontend/src/pages/SignInPage.tsx` at route `/signin`: form with `email` (type="email") and `password` (type="password") inputs, "Sign in" submit button, "Forgot password?" link to `/forgot-password`, "Don't have an account? Sign up" link to `/signup`, "Continue with Google" button calling `GET /v1/auth/google/authorize`
- [ ] On submit: call `useAuthStore.login(email, password)`; show inline `<LoadingSpinner />` on button while `isLoading: true`; on `requires_2fa: true` response, navigate to `/auth/2fa` with `totp_session_id` in location state; on success, navigate to `location.state?.redirect ?? "/dashboard"` (respects `?redirect=` param from lobby flow)
- [ ] Implement form validation before submit: email must match `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, password must be non-empty — show red helper text under each invalid field; do NOT submit if either is invalid
- [ ] Show error banner above form on `INVALID_CREDENTIALS` 401: `"Invalid email or password."` in a red `<Alert>` component — clear the banner when the user starts typing in either field
- [ ] Redirect authenticated users away from `/signin`: in `useEffect`, if `isAuthenticated`, navigate to `/dashboard` — prevents showing sign-in to already-logged-in users who navigate back
- [ ] Apply `dark:` Tailwind variants for dark mode: form container `bg-white dark:bg-gray-900`, inputs `border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white`, error text `text-red-600 dark:text-red-400`
- Status: [ ] TODO

---

### Task 2.12: Frontend - Sign-Up Page [MVP]

- [ ] Create `frontend/src/pages/SignUpPage.tsx` at route `/signup`: form with `display_name`, `email`, `password` inputs; "Create account" submit button; "Continue with Google" button; "Already have an account? Sign in" link to `/signin`
- [ ] On submit: call `authApi.register(email, password, displayName)`, then immediately call `authApi.login(email, password)` to sign in the newly created user (registration does not auto-sign-in); show success state: `"Check your email to verify your account"` with a mail icon — do not navigate to dashboard until email is verified
- [ ] Implement field-level validation: `display_name` 2–50 chars (show char counter), `email` valid format, `password` ≥8 chars with at least one uppercase, one number, and one special character (show 4-bar strength indicator + 4 rule chips mirroring `designs/signup.html`) — validate on blur and on submit
- [ ] Handle `EMAIL_TAKEN` 409 error: show inline error under email field — `"An account with this email already exists. Sign in instead?"` with an inline link to `/signin`
- [ ] Show loading state on submit button: disable button and show `<LoadingSpinner />` while awaiting `authApi.register()` and `authApi.login()` calls; re-enable on error
- [ ] After successful sign-up, display inline success state on the same page (do NOT navigate away): show `"Verification email sent to {email}"` with a "Resend email" button (disabled for 60s after first send to prevent abuse) — navigating to dashboard is gated on email verification
- Status: [ ] TODO

---

### Task 2.13: Frontend - Forgot Password & Reset Password Pages [MVP]

- [ ] Create `frontend/src/pages/ForgotPasswordPage.tsx` at route `/forgot-password`: single email input and "Send reset link" button; on submit call `authApi.forgotPassword(email)` — always show success state `"If that email is registered, a reset link has been sent."` regardless of response (mirrors server-side no-leak behavior); disable button and show 60s countdown before allowing resubmit
- [ ] Create `frontend/src/pages/ResetPasswordPage.tsx` at route `/reset-password`: reads `?token=` from URL `searchParams`; shows `new_password` and `confirm_password` inputs; if `token` is missing from URL, immediately redirect to `/forgot-password` with a toast `"Reset link is invalid or expired"`
- [ ] On reset submit: call `authApi.resetPassword(token, newPassword)`; on 422 `VALIDATION_ERROR` show password requirements inline; on 400 (invalid token) show error banner `"This reset link has expired. Request a new one."` with link back to `/forgot-password`
- [ ] On successful reset: show `"Password updated successfully."` with a "Sign in" button navigating to `/signin` — do NOT auto-sign-in, as all sessions were invalidated server-side
- [ ] Apply loading, error, and success states with Tailwind: loading → button disabled with spinner; error → red `<Alert>` above form; success → green checkmark icon with message; all transitions smooth with `transition-all duration-200`
- Status: [ ] TODO

---

### Task 2.14: Frontend - 2FA Verify Page [MVP]

- [ ] Create `frontend/src/pages/TwoFactorPage.tsx` at route `/auth/2fa`: reads `totp_session_id` from `location.state`; if missing, redirect to `/signin`; render single 6-digit OTP input (styled as 6 individual boxes or a single `<input maxLength={6} inputMode="numeric">` field per UX preference)
- [ ] On 6-digit input completed (auto-submit or submit button): call `authApi.verify2FA(totpSessionId, code)`; on success, call `useAuthStore.fetchCurrentUser()` then navigate to `"/dashboard"` — cookies are set server-side on successful 2FA verify
- [ ] Handle errors: `INVALID_OTP` 400 → clear input field, show `"Incorrect code. Try again."` inline; `OTP_LOCKED` 429 → show `"Too many attempts. Please sign in again."` and navigate to `/signin` after 3 seconds; `NOT_FOUND` 404 → session expired, navigate to `/signin` with toast `"Session expired, please sign in again"`
- [ ] Show attempt counter: track attempts in local state, display `"X attempts remaining"` warning when ≤ 2 remaining (client-side estimate — server is authoritative)
- [ ] Show context above the input: `"Enter the 6-digit code from your authenticator app for {email}"` — email retrieved from `location.state.email` passed from the sign-in page; if not available, omit without error
- Status: [ ] TODO

---

### Task 2.15: Frontend - Google OAuth Button & Callback Handling [MVP]

- [ ] Create `frontend/src/components/auth/GoogleOAuthButton.tsx`: renders a button with Google "G" logo SVG icon, label `"Continue with Google"`, and calls `window.location.href = env.apiUrl + "/v1/auth/google/authorize"` on click — full page redirect required for OAuth flow (cannot use `fetch`)
- [ ] Handle OAuth callback: on `GET /v1/auth/google/callback` the server redirects to `{FRONTEND_URL}/dashboard` with auth cookies already set; ensure `App.tsx` calls `initAuth()` on mount so `useAuthStore.user` is populated from the cookie on dashboard load
- [ ] Handle OAuth error redirect: if server redirects to `{FRONTEND_URL}/signin?error=oauth_failed`, read `searchParams.get("error")` in `SignInPage.tsx` and show error banner `"Google sign-in failed. Please try again."` — clear error from URL with `window.history.replaceState` to prevent showing the error on browser back
- [ ] Ensure `GoogleOAuthButton` is disabled during in-progress auth: accept `isLoading: boolean` prop, show spinner inside button when `true` — prevents double-clicks during the redirect initiation
- [ ] Write unit test: `GoogleOAuthButton` click triggers `window.location.href` assignment; `SignInPage` with `?error=oauth_failed` in URL renders error banner; `App.tsx` `initAuth()` called on mount
- Status: [ ] TODO

---

## Future Tasks (Not MVP)

### Task 2.16: Backend + Frontend - GitHub OAuth

- [ ] Add `github_oauth_client = GitHubOAuth2(settings.GITHUB_CLIENT_ID, settings.GITHUB_CLIENT_SECRET)` to `auth/oauth.py` once `httpx-oauth` GitHub provider is confirmed stable
- [ ] Register `get_oauth_router(github_oauth_client, ...)` at `/v1/auth/github` following identical pattern as Google
- [ ] Add `github_id: Optional[str]` field to `User` model and `"github"` as valid provider in `users.providers` array
- [ ] Add `GitHub` entry to `GET /v1/settings/linked-accounts` response shape and frontend linked accounts UI
- [ ] Write integration tests matching Google OAuth test coverage for GitHub flow
- Status: TODO

---

## Summary

| Category     | Tasks   | Completed | Remaining |
| ------------ | ------- | --------- | --------- |
| MVP Tasks    | 15      | 15        | 0         |
| Future Tasks | 1       | 0         | 1         |
| **Total**    | **16**  | **15**    | **1**     |

## Execution Order

1. **Backend Foundation:** 2.1 (FastAPI Users core config — User model, UserManager, transport + strategy)
2. **Backend Registration & Login:** 2.2 → 2.3 (Email registration + verification → Sign-in + 2FA intercept)
3. **Backend 2FA & OAuth:** 2.4 → 2.5 (TOTP setup endpoint → Google OAuth router)
4. **Backend Reset & Refresh:** 2.6 → 2.7 → 2.8 (Password reset → Token refresh → Sign out)
5. **Frontend Foundation:** 2.9 → 2.10 (API client + mutex → Auth Zustand store)
6. **Frontend Auth Pages:** 2.11 → 2.12 → 2.13 → 2.14 → 2.15 (Sign-in → Sign-up → Forgot/Reset password → 2FA page → Google button)
7. **Future:** 2.16 (GitHub OAuth — deferred)
