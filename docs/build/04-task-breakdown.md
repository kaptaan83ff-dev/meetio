# Task Breakdown: User Profile & Settings (Core)

**Feature:** Feature 4 from MVP Roadmap
**Estimated Time:** 8–10 hours
**Priority:** FOURTH — depends on Feature 2 (Authentication) for `current_user` dependency and Feature 1 (Infrastructure) for R2 and Celery
**Status:** [ ] Not started

> ⚠️ Change email (OTP) is NOT implemented here. It requires the full OTP send/verify flow which is built as part of Feature 24 (Settings Full, P2). Do not implement email change in this feature.

---

## Feature 4: User Profile & Settings (Core)

---

### Task 4.1: Backend - Profile Service [MVP]

- [ ] Create `backend/app/services/profile_service.py` with `async def get_profile(user_id: str, db) -> dict`: query `users` collection by `_id`, return fields `{_id, display_name, email, avatar_url, avatar_type, timezone, language, created_at}` — raise `HTTPException(404, {code: "NOT_FOUND"})` if user not found (should not happen for authenticated users but guards against data corruption)
- [ ] Implement `async def update_profile(user_id: str, payload: ProfileUpdateRequest, db, redis) -> dict`: validate `timezone` against `zoneinfo.available_timezones()` — raise `VALIDATION_ERROR` 422 with `{field: "timezone", message: "Invalid IANA timezone"}` if not found; validate `language` as BCP 47 using `langcodes.standardize_tag(language)` — raise `VALIDATION_ERROR` 422 if invalid
- [ ] In `update_profile`: build MongoDB `$set` dict from non-None payload fields only (partial update — do not overwrite unset fields); add `updated_at: datetime.utcnow()` to every update; call `await redis_client.delete(f"user:profile:{user_id}")` after DB write to invalidate Redis cache
- [ ] Implement `async def update_settings(user_id: str, payload: SettingsUpdateRequest, db, redis) -> dict`: accept `theme` (validate against `["light", "dark", "system"]`), `timezone`, `email_notifications` (partial dict merge — only update provided keys, preserve unset keys in `email_notifications` embedded document using `$set` with dot-notation: `email_notifications.meeting_recap_ready`)
- [ ] Write unit test `tests/test_profile_service.py`: invalid timezone `"Mars/Olympus"` → raises `VALIDATION_ERROR`; valid `"Asia/Kolkata"` passes; `update_profile` with only `display_name` → only `display_name` and `updated_at` updated in DB, other fields unchanged; Redis cache key deleted after update
- [ ] Write unit test: `update_settings` with `email_notifications: {meeting_recap_ready: false}` → only that key updated, other notification booleans unchanged in DB document
- 📐 Schema: `docs/requirements/meetio-db-schema.md#1-users`
- Status: [ ] TODO

---

### Task 4.2: Backend - Profile APIs [MVP]

- [ ] Create `backend/app/routers/profile.py` with `router = APIRouter(prefix="/profile", tags=["Profile"])` (mounted under `v1_router`, so all paths are `/v1/profile/...`): implement `GET /v1/profile` returning cached profile — check `user:profile:{user_id}` Redis key first (TTL 600s); on miss, call `profile_service.get_profile()`, store result in Redis, return `200 {data: {...}}` per API spec §8
- [ ] Implement `PUT /v1/profile`: accept `ProfileUpdateRequest` Pydantic model with optional fields `display_name: Optional[str] = None`, `timezone: Optional[str] = None`, `language: Optional[str] = None`; call `profile_service.update_profile()`; return `200` with updated profile object matching `GET /v1/profile` response shape
- [ ] Implement `GET /v1/settings` in `backend/app/routers/settings.py`: return `users` document fields `{timezone, language, theme, email_notifications}` per API spec §7; no caching needed (infrequent access)
- [ ] Implement `PUT /v1/settings`: accept `SettingsUpdateRequest` with optional `timezone`, `theme: Optional[Literal["light", "dark", "system"]]`, `email_notifications: Optional[dict]`; call `profile_service.update_settings()`; return `200` with updated settings object
- [ ] Register both routers in `main.py` under `v1_router`: `v1_router.include_router(profile_router)`, `v1_router.include_router(settings_router)` — all routes served under `/v1/profile` and `/v1/settings`
- [ ] Write integration test `tests/test_profile_api.py`: GET `/profile` cold cache → DB queried, Redis populated; GET `/profile` warm cache → DB not queried (mock `db.users.find_one` assert not called); PUT `/profile` with invalid timezone → 422; PUT `/profile` valid → 200, Redis key deleted
- 📐 Schema: `docs/requirements/meetio-db-schema.md#1-users`
- Status: [ ] TODO

---

### Task 4.3: Backend - Avatar Upload & Deletion [MVP]

- [ ] Implement `POST /v1/profile/avatar` in `profile.py`: accept `multipart/form-data` with field `file`; validate type by attempting `PIL.Image.open(file)` and checking `img.format in {"JPEG","PNG","WEBP"}` — reject all others with `VALIDATION_ERROR` 422 `{message: "File must be JPG, PNG, or WebP"}`
- [ ] Validate file size server-side: read up to 5MB + 1 byte; if total bytes read > 5MB, return `VALIDATION_ERROR` 422 `{message: "File must be under 5MB"}` — do NOT buffer the entire file before checking size; use `await file.read(5 * 1024 * 1024 + 1)` and check length
- [ ] Re-encode to WebP using Pillow: `img = Image.open(BytesIO(file_bytes))`, strip EXIF by calling `img_clean = Image.new(img.mode, img.size)` + `img_clean.paste(img)` or use `piexif.remove(file_bytes)`, then `img.save(output, format="WEBP", quality=85)` — EXIF stripping prevents geolocation data leaks from user photos
- [ ] Upload to Cloudflare R2: key `avatars/{user_id}.webp` using `boto3` S3-compatible client configured with `settings.R2_ENDPOINT_URL`, `settings.R2_ACCESS_KEY_ID`, `settings.R2_SECRET_ACCESS_KEY`, bucket `settings.R2_BUCKET_NAME`; update `users.avatar_url = "{R2_PUBLIC_URL}/avatars/{user_id}.webp"` and `avatar_type = "upload"`; invalidate `user:profile:{user_id}` Redis cache; return `200 {data: {avatar_url: "..."}}`
- [ ] Implement `DELETE /profile/avatar`: call `r2_client.delete_object(Bucket=bucket, Key=f"avatars/{user_id}.webp")`; set `users.avatar_url = None`, `avatar_type = "default"`; invalidate Redis cache; return `204`; if R2 key does not exist, proceed with DB update anyway (idempotent)
- [ ] Write unit test `tests/test_avatar.py`: MIME type validation — PDF bytes → 422; PNG bytes → pass; JPG bytes → pass; file size validation — 5MB + 1 byte → 422; exactly 5MB → pass; EXIF stripping — JPG with GPS EXIF → output bytes contain no EXIF GPS data; WebP re-encoding — output format is WebP regardless of input format
- Status: [ ] TODO

---

### Task 4.4: Backend - Account Settings APIs [MVP]

- [ ] Implement `PUT /v1/settings/password` in `settings.py`: accept `{current_password, new_password}`; verify `current_password` by calling `user_manager.password_helper.verify_and_update(current_password, user.hashed_password)` — use FastAPI Users `PasswordHelper` to avoid re-implementing Argon2 verification; if verification fails, return `INVALID_CREDENTIALS` 401
- [ ] On password update: call `user_manager.password_helper.hash(new_password)` to generate new Argon2 hash; update `users.hashed_password` and `users.updated_at`; revoke all sessions EXCEPT the current one by calling `sessions.update_many({user_id: user_id, _id: {$ne: current_session_id}}, {$set: {is_revoked: True}})` — keeps current session active, invalidates all other devices
- [ ] Implement `GET /v1/settings/linked-accounts`: return `users.providers` array formatted as `[{provider, linked_at, email?}]` per API spec §7 — `email` field only present for Google: read from `users.email` if `providers` contains `"google"` (no separate field in v1 DB schema; use user email as the linked Google email)
- [ ] Implement `DELETE /v1/settings/linked-accounts/{provider}`: validate `provider` in `["email", "google"]`; if `users.providers.length <= 1`, raise `FORBIDDEN` 403 `{message: "Cannot remove last sign-in method — you would be locked out"}`; else remove provider from `users.providers` array using `$pull`; if removing `"google"`, also set `users.google_id = None`
- [ ] Write integration test `tests/test_account_settings.py`: PUT `/v1/settings/password` with wrong current password → 401; correct current password → 200, other sessions revoked, current session intact; DELETE linked-account with only one provider → 403; DELETE with two providers → 204, provider removed from array; DELETE non-existent provider → 404
- [ ] Write integration test: PUT `/settings` with `theme: "dark"` → `users.theme: "dark"` in DB; PUT `/settings` with `email_notifications: {meeting_recap_ready: false}` → only that key changed, others unchanged
- Status: [ ] TODO

---

### Task 4.5: Backend - GDPR Data Export [MVP]

- [ ] Implement `POST /v1/settings/export` in `settings.py`: call `export_user_data.delay(str(current_user.id))`, return `202 {data: {message: "Export queued. You'll receive an email within 72 hours."}}` per API spec §7 — do not start export synchronously; return immediately with 202
- [ ] Create Celery task `export_user_data(user_id: str)` in `backend/app/tasks/gdpr.py`: collect data from MongoDB — `meetings` (host_user_id), `action_items` (assigned_to or created_by), `transcripts` (meeting_id joined through meetings), `chat_messages` (user_id), `users` (profile) — serialize each collection to a JSON list
- [ ] ⚠️ Include login history from Redis: call `await redis_client.zrangebyscore(f"login_history:{user_id}", "-inf", "+inf")`, parse each JSON entry, serialize full list as `login_history.json` inside the zip — login history lives only in Redis; omitting it is a GDPR data portability gap
- [ ] Assemble zip in memory: use `zipfile.ZipFile(BytesIO(), "w", zipfile.ZIP_DEFLATED)`, write each dataset as `{collection}.json` — `meetings.json`, `action_items.json`, `chat_messages.json`, `profile.json`, `login_history.json`; upload zip to R2 key `exports/{user_id}/{iso_timestamp}.zip`
- [ ] Send download email via Resend: generate presigned R2 URL with 7-day expiry using `boto3 generate_presigned_url("get_object", ...)`, call Resend API with subject `"Your MeetIO data export is ready"` and body containing the presigned download link; task retries 3 times with 300s backoff on failure
- [ ] Write integration test `tests/test_gdpr_export.py`: POST `/v1/settings/export` → 202, Celery task queued with correct `user_id`; write unit test: `export_user_data` task — mock MongoDB collections and Redis login history, assert zip contains all expected files including `login_history.json` with correct entries
- Status: [ ] TODO

---

### Task 4.6: Backend - GDPR Account Deletion [MVP]

- [ ] Implement `POST /v1/settings/delete-account` in `settings.py`: validate request body `{confirmation: "DELETE MY ACCOUNT"}` — exact string match (case-sensitive); raise `VALIDATION_ERROR` 422 `{message: "Confirmation string must be exactly 'DELETE MY ACCOUNT'"}` if mismatch
- [ ] On valid confirmation: set `users.is_active = False`, `deletion_requested_at = datetime.utcnow()`, `deletion_scheduled_at = datetime.utcnow() + timedelta(days=30)`; revoke ALL sessions immediately (`sessions.update_many({user_id: user_id}, {$set: {is_revoked: True}})`); call `useAuthStore.logout()` client-side (done via 401 on next request since all sessions revoked); return `200 {data: {message: "Account scheduled for deletion.", deletion_scheduled_at: ...}}`
- [ ] Implement Celery Beat task `process_pending_deletions()` in `tasks/gdpr.py` (replacing stub from Feature 1 Task 1.4): query `users` where `is_active: False` AND `deletion_scheduled_at <= datetime.utcnow()`; for each user, permanently delete documents across all collections: `sessions`, `meetings` (host records), `participants`, `recaps`, `transcripts`, `action_items`, `chat_messages`, `notifications`, `conversations`, `messages`, `calendar_events`, `gcal_tokens`, `guest_sessions`
- [ ] In `process_pending_deletions`: delete R2 objects — avatar (`avatars/{user_id}.webp`), recordings (`recordings/` keys linked to user's meetings), exports (`exports/{user_id}/`); delete Redis login history key `login_history:{user_id}`; finally delete `users` document — order matters: delete references before the user record itself
- [ ] Write unit test `tests/test_gdpr_deletion.py`: wrong confirmation string → 422; correct string → user `is_active: False`, `deletion_scheduled_at` set 30 days in future, all sessions `is_revoked: True`; `process_pending_deletions` — mock all 16 collections, assert delete calls fired for each; assert R2 delete called for avatar and export keys
- [ ] Write integration test: POST `/v1/settings/delete-account` with correct string → 200; subsequent authenticated API call → 401 (all sessions revoked); simulate 30 days elapsed → purge task → user document and all related documents removed
- 📐 Schema: `docs/requirements/meetio-db-schema.md#1-users`
- Status: [ ] TODO

---

### Task 4.7: Frontend - Profile & Settings API Service Layer [MVP]

- [ ] Create `frontend/src/lib/profileApi.ts` exporting: `getProfile(): Promise<UserProfile>` → `GET /v1/profile`; `updateProfile(payload: Partial<ProfileUpdate>): Promise<UserProfile>` → `PUT /v1/profile`; `uploadAvatar(file: File): Promise<{avatar_url: string}>` → `POST /v1/profile/avatar` as `multipart/form-data`; `deleteAvatar(): Promise<void>` → `DELETE /v1/profile/avatar` — all via `apiRequest`
- [ ] Create `frontend/src/lib/settingsApi.ts` (extend from Feature 2's auth functions): add `getSettings(): Promise<UserSettings>` → `GET /v1/settings`; `updateSettings(payload): Promise<UserSettings>` → `PUT /v1/settings`; `changePassword(currentPassword, newPassword): Promise<void>` → `PUT /v1/settings/password`; `getLinkedAccounts(): Promise<LinkedAccountsResponse>` → `GET /v1/settings/linked-accounts`; `deleteLinkedAccount(provider): Promise<void>` → `DELETE /v1/settings/linked-accounts/{provider}`; `requestDataExport(): Promise<void>` → `POST /v1/settings/export`; `deleteAccount(confirmation): Promise<{deletion_scheduled_at: string}>` → `POST /v1/settings/delete-account`
- [ ] Define TypeScript types in `frontend/src/types/profile.ts`: `UserProfile: {user_id, display_name, email, avatar_url, avatar_type, timezone, language, created_at}`; `UserSettings: {timezone, language, theme, email_notifications: EmailNotificationSettings}`; `LinkedAccount: {provider, linked_at, email?}`
- [ ] Add profile and settings state to `useAuthStore` or create a dedicated `useProfileStore`: `profile: UserProfile | null`, `settings: UserSettings | null`, `isUpdatingProfile: boolean`, `updateProfileError: string | null` — actions `fetchProfile()`, `updateProfile(payload)`, `updateSettings(payload)`, `uploadAvatar(file)`, `deleteAvatar()`
- [ ] Write unit tests `tests/profileApi.test.ts` (Vitest + MSW): `uploadAvatar` sends correct `multipart/form-data` request with `file` field; `deleteAvatar` sends DELETE; `updateSettings` sends only provided fields (no null fields in body)
- Status: [ ] TODO

---

### Task 4.8: Frontend - Profile Page [MVP]

- [ ] Create `frontend/src/pages/ProfilePage.tsx` at route `/profile`: on mount, call `fetchProfile()` from store; show `<LoadingSpinner />` while `isLoading: true`; render profile form with `display_name`, `timezone` (select from IANA tz list, grouped by continent), `language` (select from supported languages: `en`, `hi`, `es`, `fr`, `de`, `pt`, `ja`, `ko`, `zh`) — fields pre-filled from `profile` store state
- [ ] Implement auto-save on blur for each field (not a submit button): on `input.onBlur`, if field value changed, call `updateProfile({field: newValue})`; show inline save indicator — `"Saving..."` → `"Saved ✓"` → fade out after 2s; on error, show `"Failed to save"` inline with the field
- [ ] Render avatar section: show current `<img src={avatar_url}` (or a default avatar SVG if `avatar_type === "default"`), `"Upload photo"` button, and `"Remove photo"` button (hidden if `avatar_type === "default"`); clicking `"Upload photo"` triggers a hidden `<input type="file" accept="image/jpeg,image/png,image/webp">`
- [ ] Client-side avatar preview: on file selected via `input[type=file]`, immediately show `URL.createObjectURL(file)` preview in the `<img>` element before upload completes — optimistic preview; if upload fails, revert to previous `avatar_url`
- [ ] Show profile metadata below the form: `"Member since {created_at formatted as 'April 2026'}"`, `"Email: {email}"` (read-only, with a note `"Change email is available in Settings"`)
- [ ] Write unit test: `ProfilePage` renders with loaded profile data; auto-save fires `updateProfile` on blur with changed value; unchanged blur → no API call; avatar remove button hidden when `avatar_type === "default"`
- Status: [ ] TODO

---

### Task 4.9: Frontend - Avatar Upload Component [MVP]

- [ ] Create `frontend/src/components/profile/AvatarUpload.tsx`: accepts `currentAvatarUrl: string | null`, `avatarType: string`, `onUploadSuccess: (newUrl: string) => void`, `onDeleteSuccess: () => void` props; renders avatar `<img>` with `w-24 h-24 rounded-full object-cover` classes and an overlay edit icon on hover
- [ ] Client-side file validation before upload: check `file.size <= 5 * 1024 * 1024` → show toast `"File must be under 5MB"` and abort; check `["image/jpeg", "image/png", "image/webp"].includes(file.type)` → show toast `"File must be JPG, PNG, or WebP"` and abort — mirrors server-side validation for instant feedback
- [ ] Show upload progress: on upload start, replace avatar with a `<div>` showing `<LoadingSpinner />` and percentage if `XMLHttpRequest` is used (or indeterminate spinner with `fetch`); on `uploadAvatar()` success, call `onUploadSuccess(avatar_url)` and update preview; on error, revert preview and show toast `"Upload failed, please try again"`
- [ ] Confirm delete with an inline dialog: on `"Remove photo"` click, show a `<div>` below the avatar with `"Are you sure? Your avatar will be removed."` and `"Remove"` / `"Cancel"` buttons — not a modal, inline confirmation; on `"Remove"` click, call `deleteAvatar()`, on success call `onDeleteSuccess()` and reset to default avatar SVG
- [ ] Write unit test: file > 5MB → `uploadAvatar` not called, toast shown; invalid MIME type → `uploadAvatar` not called; valid file → `uploadAvatar` called, `onUploadSuccess` fires on resolve; delete confirm flow — clicking `"Remove photo"` shows confirm; cancelling hides confirm without calling `deleteAvatar`
- Status: [ ] TODO

---

### Task 4.10: Frontend - Account Settings Page (Core) [MVP]

- [ ] Create `frontend/src/pages/SettingsPage.tsx` at route `/settings`: renders tabbed or section-based layout with sections: `Account`, `Preferences`, `Security` (sessions + login history from Feature 3), `Privacy` (GDPR export + delete); each section lazy-loads its data when tab is activated to avoid fetching all settings on mount
- [ ] Implement `Account` section: render password change form (`current_password`, `new_password`, `confirm_new_password` inputs); validate `new_password` ≥8 chars with uppercase, number, and special character; validate `confirm_new_password === new_password`; on submit call `changePassword()`; show success toast `"Password updated. Other sessions have been signed out."` on 200; show `"Incorrect current password"` inline error on 401
- [ ] Implement linked accounts subsection within `Account`: list providers with `GET /v1/settings/linked-accounts`; each provider row shows provider name, `linked_at` date, and `"Unlink"` button; show `"Add Google account"` button if Google not linked; `"Unlink"` button disabled with tooltip `"Cannot remove your only sign-in method"` if provider count is 1
- [ ] Implement `Preferences` section: `theme` toggle (Light / Dark / System, 3-button toggle group), `timezone` select, `language` select — all call `updateSettings()` on change with debounce 500ms; show saved indicator per-field
- [ ] Write unit test: `SettingsPage` password form — submit with mismatched confirm → no API call, inline error shown; submit with valid fields → `changePassword` called; `SettingsPage` linked accounts — single provider → Unlink button disabled; two providers → Unlink button enabled
- Status: [ ] TODO

---

### Task 4.11: Frontend - GDPR Privacy Actions UI [MVP]

- [ ] Add `Privacy` section to `SettingsPage.tsx`: two subsections — `"Download your data"` and `"Delete your account"` — separated by a visual divider with warning colors
- [ ] Implement data export UI: description text `"Get a copy of all your MeetIO data — meetings, transcripts, messages, and more. Sent to your email within 72 hours."`; `"Request data export"` button; on click, call `requestDataExport()`; on 202, disable button for 24h (store timestamp in `localStorage`) and show `"Export requested. Check your email."` — prevents abuse (one export per 24h client-side; server should also rate-limit)
- [ ] Implement account deletion UI: render a danger zone section with red border; description `"Permanently delete your account. This action cannot be undone after 30 days."`; `"Delete my account"` button (red, outlined); clicking opens a confirmation modal
- [ ] Build delete account confirmation modal `DeleteAccountModal.tsx`: header `"Delete your account"`, body explaining 30-day soft-delete window, a text input with placeholder `"Type DELETE MY ACCOUNT to confirm"`, disabled `"Permanently delete"` button enabled only when input exactly matches `"DELETE MY ACCOUNT"` (case-sensitive, live check via `onChange`); on confirm call `deleteAccount(confirmationText)`, on success call `useAuthStore.logout()` and navigate to `/signin` with toast `"Your account has been scheduled for deletion"`
- [ ] Write unit test: `"Request data export"` button → `requestDataExport` called, button disabled after click; `DeleteAccountModal` — `"Permanently delete"` button disabled until exact string entered; partial match → button stays disabled; exact match → button enabled; on confirm → `deleteAccount` called with `"DELETE MY ACCOUNT"`
- Status: [ ] TODO

---

## Future Tasks (Not MVP)

### Task 4.12: Frontend - Profile Visibility & Display Name History

- [ ] Add `visibility: "public" | "contacts_only" | "private"` field to `users` document for future profile page access control
- [ ] Implement profile visibility selector in `ProfilePage.tsx` (hidden until relevant — no public profile pages in v1)
- [ ] Track `display_name_history: list[{name, changed_at}]` in `users` document for meeting participant name consistency across renamed accounts
- [ ] Surface display name history in profile page as a collapsible `"Name history"` section
- [ ] Add `GET /v1/profile/{user_id}` public endpoint that respects `visibility` setting — returns full profile for `"public"`, 403 for `"private"`, and checks contact relationship for `"contacts_only"`
- Status: TODO

---

## Summary

| Category     | Tasks   | Completed | Remaining |
| ------------ | ------- | --------- | --------- |
| MVP Tasks    | 11      | 0         | 11        |
| Future Tasks | 1       | 0         | 1         |
| **Total**    | **12**  | **0**     | **12**    |

## Execution Order

1. **Backend Foundation:** 4.1 (Profile service — validation, partial update, cache invalidation)
2. **Backend APIs:** 4.2 (GET/PUT /v1/profile + GET/PUT /v1/settings)
3. **Backend Avatar:** 4.3 (POST /v1/profile/avatar with Pillow WebP + R2 upload + DELETE)
4. **Backend Account:** 4.4 (PUT /v1/settings/password + linked accounts GET/DELETE)
5. **Backend GDPR:** 4.5 → 4.6 (Data export Celery task → Account deletion + purge task)
6. **Frontend Service Layer:** 4.7 (profileApi.ts + extended settingsApi.ts + store)
7. **Frontend Core Pages:** 4.8 → 4.9 (Profile page → Avatar upload component)
8. **Frontend Settings:** 4.10 → 4.11 (Account settings page → GDPR privacy actions)
9. **Future Enhancements:** 4.12 (Profile visibility + display name history)
