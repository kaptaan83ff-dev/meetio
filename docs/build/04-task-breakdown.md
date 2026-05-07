# Task Breakdown: User Profile & Settings

**Feature:** #4 from MVP Roadmap
**Estimated Time:** 10–13 hours total
**Priority:** FOURTH — depends on Feature 2 (Auth)
**Status:** [ ] Not Started

---

## Feature 4: User Profile & Settings

---

### Task 4.1: Backend — Profile & Settings Schemas [MVP]

- [ ] Create `backend/app/schemas/profile.py`: `UpdateProfileRequest(display_name: str | None, timezone: str | None, language: str | None)` with `@field_validator("timezone")` checking against `zoneinfo.available_timezones()` — raise `ValueError("Invalid IANA timezone")` on failure
- [ ] Add `@field_validator("language")` on `UpdateProfileRequest` — validate BCP 47 format using regex `^[a-z]{2,3}(-[A-Z]{2,3})?$`, raise `ValueError` on mismatch
- [ ] Create `UpdateSettingsRequest(theme: str | None, timezone: str | None, email_notifications: dict | None)` — `theme` must be `"light" | "dark" | "system"` if provided
- [ ] Create `ChangePasswordRequest(current_password: str, new_password: str)` — `new_password` same strength validator as signup (min 8, 1 uppercase, 1 number)
- [ ] Create `DeleteAccountRequest(confirmation: str)` — `@field_validator("confirmation")` raises `ValueError` if value != `"DELETE MY ACCOUNT"` exactly
- [ ] Create `ProfileResponse(user_id, display_name, email, avatar_url, avatar_type, timezone, language, created_at)` Pydantic response model
- Status: [ ] TODO

---

### Task 4.2: Backend — R2 Storage Service [MVP]

- [ ] Create `backend/app/services/storage_service.py`: initialise `boto3.client("s3", endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com", aws_access_key_id=settings.R2_ACCESS_KEY_ID, aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY, region_name="auto")`
- [ ] Add `upload_bytes(key: str, data: bytes, content_type: str)` — call `r2.put_object(Bucket=settings.R2_BUCKET_NAME, Key=key, Body=data, ContentType=content_type)`; raise `StorageError` wrapping any `botocore.exceptions.ClientError`
- [ ] Add `delete_object(key: str)` — call `r2.delete_object(Bucket=settings.R2_BUCKET_NAME, Key=key)`; raise `StorageError` on failure
- [ ] Add `generate_presigned_url(key: str, expires_in: int = 3600) -> str` — call `r2.generate_presigned_url("get_object", Params={"Bucket": settings.R2_BUCKET_NAME, "Key": key}, ExpiresIn=expires_in)`
- [ ] Add `validate_and_reencode_avatar(file_bytes: bytes, content_type: str) -> bytes`: call `Image.open(io.BytesIO(file_bytes))` — raise `VALIDATION_ERROR` if `image.format not in {"JPEG", "PNG", "WEBP"}`; convert to WebP with `image.save(output, format="WEBP", quality=85)` — strips EXIF automatically
- [ ] Write unit test: pass PDF bytes to `validate_and_reencode_avatar()` → raises `HTTPException(422)`; pass JPEG → returns WebP bytes (verify with `Image.open()`)
- Status: [ ] TODO

---

### Task 4.3: Backend — Profile API Endpoints [MVP]

- [ ] `GET /v1/profile` — call `user_repo.get_by_id(current_user.id)`, check Redis cache `user:profile:{user_id}` first; return `ProfileResponse`; cache result with TTL 600s
- [ ] Add `PUT /v1/profile`: validate `UpdateProfileRequest`, call `user_repo.update_user()` with only provided fields (exclude unset), invalidate `user:profile:{user_id}` cache; return updated `ProfileResponse`
- [ ] Add `POST /v1/profile/avatar`: receive `UploadFile` — check `content_type` starts with `image/` else raise `VALIDATION_ERROR` 422; check size <= 5MB else raise `VALIDATION_ERROR`; call `storage_service.validate_and_reencode_avatar()`; upload to R2 `avatars/{user_id}.webp`; update `users.avatar_url` and `avatar_type = "upload"`; invalidate cache; return `{avatar_url}`
- [ ] Add `DELETE /v1/profile/avatar`: call `storage_service.delete_object(f"avatars/{user_id}.webp")`; update `users.avatar_url = None`, `avatar_type = "default"`; invalidate cache; return `204`
- [ ] Write integration test: `POST /profile/avatar` with valid PNG → 200 + `avatar_url` contains `.webp`; with PDF → 422 `VALIDATION_ERROR`; with > 5MB file → 422
- 📐 Schema: `meetio-db-schema.md#1-users`
- Status: [ ] TODO

---

### Task 4.4: Backend — Settings & Password API Endpoints [MVP]

- [ ] In `backend/app/routers/settings.py`: add `GET /v1/settings` — return `users.timezone`, `users.theme`, `users.email_notifications` dict; no cache (settings must always be fresh)
- [ ] Add `PUT /v1/settings`: validate `UpdateSettingsRequest`, call `user_repo.update_user()` with only provided fields; return updated settings object
- [ ] Add `PUT /v1/settings/password`: validate `ChangePasswordRequest`, call `verify_password(current_password, users.password_hash)` — raise `INVALID_CREDENTIALS` 401 on mismatch; hash new password with Argon2; call `user_repo.update_user({password_hash})`; call `session_repo.revoke_all_except_current(user_id, current_session_id)` to keep current session; return `200`
- [ ] Add `GET /v1/settings/linked-accounts`: return `[{provider, linked_at}]` from `users.providers`
- [ ] Add `DELETE /v1/settings/linked-accounts/{provider}`: verify `len(users.providers) > 1` — raise `FORBIDDEN` 403 "Cannot remove last sign-in method"; remove provider from `providers` array, clear `google_id` if removing google; return `204`
- [ ] Write integration test: `PUT /settings/password` with wrong current password → 401; correct → 204 + all other sessions revoked
- Status: [ ] TODO

---

### Task 4.5: Backend — GDPR Export & Deletion [MVP]

- [ ] Add `POST /v1/settings/export`: require auth, dispatch `data_export_task.delay(current_user.id)` Celery task, return `202 {message: "Export queued. You'll receive an email within 72 hours."}`
- [ ] Implement `data_export_task` in `backend/app/tasks/gdpr.py`: collect all user data — query `meetings`, `action_items`, `transcripts`, `messages`, `profile`; zip into `io.BytesIO`; upload to R2 `exports/{user_id}/{timestamp}.zip`; generate 7-day presigned URL; dispatch `send_email.delay(user_email, "Your MeetIO data export", html_with_link)`
- [ ] Add `POST /v1/settings/delete-account`: validate `DeleteAccountRequest` (confirmation == "DELETE MY ACCOUNT"); set `users.is_active = False`, `deletion_requested_at = now()`, `deletion_scheduled_at = now() + timedelta(days=30)`; call `clear_auth_cookies(response)`; return `{deletion_scheduled_at}`
- [ ] Implement `process_pending_deletions` Celery Beat task (02:30 UTC): query `users` where `deletion_scheduled_at <= now()` and `is_active: False`; for each user: delete R2 objects (avatar, recordings, exports); bulk delete across all collections using `user_id` field; finally delete `users` document
- [ ] Write unit test: `process_pending_deletions` with 1 user past scheduled date → all 16 collections purged for that user; user with future date → untouched
- Status: [ ] TODO

---

### Task 4.6: Frontend — Profile & Settings API Service [MVP]

- [ ] Add to `frontend/src/lib/settingsApi.ts`: `getProfile()` → `GET /v1/profile`; `updateProfile(data)` → `PUT /v1/profile`; `uploadAvatar(file: File)` → `POST /v1/profile/avatar` as `multipart/form-data`; `deleteAvatar()` → `DELETE /v1/profile/avatar`
- [ ] Add `getSettings()` → `GET /v1/settings`; `updateSettings(data)` → `PUT /v1/settings`; `changePassword(current, next)` → `PUT /v1/settings/password`
- [ ] Add `getLinkedAccounts()` → `GET /v1/settings/linked-accounts`; `unlinkProvider(provider)` → `DELETE /v1/settings/linked-accounts/{provider}`
- [ ] Add `exportData()` → `POST /v1/settings/export`; `deleteAccount(confirmation)` → `POST /v1/settings/delete-account`
- [ ] All functions use `apiClient.apiRequest()` with typed error handling; `uploadAvatar` uses `FormData` with `file` field
- Status: [ ] TODO

---

### Task 4.7: Frontend — Profile Page [MVP]

- [ ] Create `frontend/src/pages/ProfilePage.tsx` at `/profile`: on mount call `getProfile()`, show skeleton while loading
- [ ] Avatar section: render `<img src={avatarUrl || defaultAvatar}>` (64×64 rounded), [Change photo] button opens hidden `<input type="file" accept="image/jpeg,image/png,image/webp">`, on change call `uploadAvatar(file)` — show upload spinner over avatar, refresh on success; [Remove] button calls `deleteAvatar()`, reverts to default avatar immediately (optimistic)
- [ ] Display name field: inline editable — click to edit, show save/cancel buttons, call `updateProfile({display_name})` on save; error toast on failure
- [ ] Timezone select: searchable dropdown of IANA timezones, current value shown, call `updateProfile({timezone})` on change
- [ ] Language select: dropdown of supported languages, call `updateProfile({language})` on change
- [ ] After successful profile update: call `authStore.setUser({...user, displayName: newName})` to sync header avatar/name immediately
- Status: [ ] TODO

---

### Task 4.8: Frontend — Settings Page [MVP]

- [ ] Create `frontend/src/pages/SettingsPage.tsx` at `/settings`: left sidebar nav with sections (Account, Notifications, Privacy, Sessions, Login History), renders active section on right
- [ ] **Account section**: display name (links to profile page), change password form (`ChangePasswordForm` component with current/new/confirm fields, inline validation)
- [ ] **Notifications section**: toggle list — one row per notification type from `users.email_notifications`; on toggle: optimistically update UI + call `updateSettings({email_notifications: {...updated}})`, revert on error
- [ ] **Privacy section**: [Download my data] button → call `exportData()` → success toast "You'll receive an email within 72 hours"; [Delete account] button → opens `<DeleteAccountModal />` with text input requiring exact phrase "DELETE MY ACCOUNT", 30-day warning, confirmation button calls `deleteAccount(phrase)` → sign out
- [ ] **Sessions section**: renders `<SessionsSection />` from Feature 3 task 3.5
- [ ] **Login History section**: renders `<LoginHistorySection />` from Feature 3 task 3.5
- Status: [ ] TODO

---

### Task 4.9: Improvements & Missing Features [Remaining]

- [ ] **Backend: Cache Invalidation**: Add `redis_client.delete(USER_PROFILE.format(user_id=current_user["_id"]))` to `update_profile`, `upload_avatar`, and `delete_avatar` in `profile.py`.
- [ ] **Backend: Settings Sync**: In `update_settings`, if `timezone` or `language` is updated, invalidate the profile cache.
- [ ] **Backend: Linked Accounts**: Update `UserDocument` to track `linked_at` for each provider in `providers` array (currently returns `null`).
- [ ] **Email Change Flow**:
    - [ ] Backend: `POST /v1/settings/email/request` (send OTP to new email)
    - [ ] Backend: `POST /v1/settings/email/verify` (verify OTP and update email)
    - [ ] Frontend: `EmailChangeForm` component in `AccountPanel.tsx`.
- [ ] **2FA Security**:
    - [ ] Backend: `POST /v1/settings/2fa/enable` (generate QR/secret)
    - [ ] Backend: `POST /v1/settings/2fa/verify` (confirm setup)
    - [ ] Backend: `DELETE /v1/settings/2fa` (disable)
    - [ ] Frontend: 2FA toggle and setup flow in `AccountPanel.tsx`.
- Status: [ ] TODO

---

## Summary

| Category     | Tasks  | Completed | Remaining |
| ------------ | ------ | --------- | --------- |
| MVP Tasks    | 9      | 0         | 9         |
| Future Tasks | 0      | 0         | 0         |
| **Total**    | **9**  | **0**     | **9**     |

## Execution Order

1. **Backend Foundation:** 4.1 (Schemas)
2. **Backend Services:** 4.2 (R2 storage service)
3. **Backend APIs:** 4.3 → 4.4 → 4.5 (Profile → Settings/Password → GDPR)
4. **Frontend Service Layer:** 4.6 (API functions)
5. **Frontend UI:** 4.7 → 4.8 (Profile page → Settings page)
6. **Polishing:** 4.9 (Improvements & missing features)
