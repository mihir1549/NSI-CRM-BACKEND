# NSI Platform - Master Frontend Flow Guide

Audience: Rudra (frontend)

Document version: 2.0  
Generated: April 11, 2026  
Backend reference for exact request/response shapes: `http://localhost:3000/api/docs`

## Purpose

This guide explains the frontend FLOW and UI LOGIC for every major NSI app page. It focuses on:

- who can open each page
- what to call when the page opens
- what the user does next
- what the UI should show or hide
- how to recover from errors
- where to redirect after success

This v2 edition keeps the flow and UI logic intact and adds inline API contract blocks sourced from the backend code. Use Swagger as a quick cross-check when you need DTO names or annotations.

## Backend-Aligned Notes Before Building

These points matter because some older frontend assumptions in the repo do not match the current backend:

- Password reset is currently OTP-based, not token-link based. The backend expects `POST /auth/reset-password` with email + OTP + new password.
- Google OAuth is backend-owned at `/auth/google/callback`. The frontend page you actually need to handle is the final redirect page, typically `/auth/callback`.
- New or returning users can get `needsCountry=true` after OTP verification, login, or Google OAuth. That means the frontend needs a mandatory `/complete-profile` step before protected app areas.
- Funnel content is currently one backend step type: `VIDEO_TEXT`. Frontend can still render it as video-first, text-first, or mixed content, but do not assume separate backend `VIDEO` and `TEXT` types.
- Funnel commitment-fee payments use `POST /payments/create-order` (plural path), not `/payment/create-order`.
- LMS user APIs are for `CUSTOMER` and `DISTRIBUTOR`. A raw `USER` should be routed into onboarding/funnel first.
- The backend also supports `POST /auth/upload-avatar`, but a direct Cloudinary upload plus `PATCH /auth/me` is still a clean frontend pattern if you prefer to keep media upload client-side.
- `GRACE` exists in enums for distributor subscriptions, but current backend flows do not emit it. Do not build visible UI around it.

---

## Section 1 - Auth Pages

### 1.1 Registration Page (`/signup`)

- **Who sees it:** Public users only. If already authenticated, redirect to the correct post-login home.
- **On load:** No required API call. If the user came from `/join/:code` or a campaign landing, restore referral and UTM context from route/query/cookie/local state.
- **User flow:** User enters `fullName`, `email`, `password`. If the design also collects `country` here, treat it as frontend state only for now because the current backend saves country later through `/auth/complete-profile`. Submit to `POST /auth/signup`, then redirect to `/verify-email` with email prefilled.
- **UI logic:** Show referral banner if signup came from a distributor link. Keep the submit button disabled while the request is in flight. If signup succeeds, do not wait for the email worker; move the user straight to OTP entry.
- **Error handling:** Show inline validation for required fields and password rules. If email already exists, show an inline field error. If signup rate limits, show a friendly retry message instead of a generic crash toast.
- **Navigation:** Success -> `/verify-email?email=...`. Secondary links -> `/login`.

**API Contracts**

**Endpoint:** `POST /api/v1/auth/signup`  
**Auth:** Public

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `fullName` | string | Yes | Full name |
| `email` | string | Yes | Email address |
| `password` | string | Yes | Password, minimum 8 characters |
| `referralCode` | string | No | Distributor referral code from `/join/:code` |

**Success Response (201):**

```json
{
  "message": "Registration successful. Check your email for OTP."
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Validation failed | Missing/invalid `fullName`, `email`, or weak `password` |
| 409 | An account with this email already exists | Email is already registered |

### 1.2 OTP Verification Page (`/verify-email`)

- **Who sees it:** Public users who just signed up or are returning to finish email verification.
- **On load:** No required API call. Prefill email from query/state if present.
- **User flow:** User enters the 6-digit OTP and submits to `POST /auth/verify-email-otp`. On success, store `accessToken` in memory, let the refresh cookie stay automatic, then inspect `needsCountry`. If `needsCountry=true`, send the user to `/complete-profile`; otherwise continue with post-login routing. The resend button calls `POST /auth/resend-otp`.
- **UI logic:** Use six numeric boxes or one masked field. Auto-advance focus between boxes. Disable resend for 60 seconds with a visible countdown. If the backend reports the user is already verified, send them to `/login`.
- **Error handling:** Invalid or expired OTP should show an inline error near the input. If attempts are running low, show remaining attempts. If the backend blocks further attempts, lock the form and force a resend/new OTP flow.
- **Navigation:** Success -> `/complete-profile` when `needsCountry=true`, else role-based home. Manual escape hatch -> `/login`.

**API Contracts**

**Endpoint:** `POST /api/v1/auth/verify-email-otp`  
**Auth:** Public

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `email` | string | Yes | User email |
| `otp` | string | Yes | Six-digit email OTP |

**Success Response (200):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.email-verify-token",
  "needsCountry": true,
  "user": {
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "fullName": "Rudra Sharma",
    "email": "rudra@example.com",
    "role": "USER",
    "status": "PROFILE_INCOMPLETE",
    "avatarUrl": null
  }
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Invalid email or OTP | Email/OTP pair does not match an active OTP record |
| 400 | Invalid OTP. 4 attempt(s) remaining. | Wrong OTP but retry count still available |
| 400 | Maximum OTP attempts reached. Please request a new OTP. | User exhausted the allowed OTP attempts |

**Endpoint:** `POST /api/v1/auth/resend-otp`  
**Auth:** Public

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `email` | string | Yes | Email address to resend the OTP to |

**Success Response (200):**

```json
{
  "message": "New OTP sent. Check your email."
}
```

**Alternate Success Response (200):**

```json
{
  "message": "If your email is registered, a new OTP has been sent."
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Too many requests. Please wait 1 hour before requesting again. | Resend throttling is triggered |

### 1.3 Complete Profile Page (`/complete-profile`)

- **Who sees it:** Authenticated users with incomplete onboarding, usually right after OTP verification or first Google login.
- **On load:** If the app reloads on this page, call `GET /auth/me` to confirm the user still exists and still needs this step.
- **User flow:** User selects country and submits to `POST /auth/complete-profile`. After success, refresh auth state with `GET /auth/me` or trusted local state hydration, then continue normal routing.
- **UI logic:** This page is mandatory when onboarding is incomplete. Do not let the user access funnel, LMS, distributor pages, or admin pages until this step is done.
- **Error handling:** Show field-level error for missing country. If the token is missing or expired, send the user to `/login`. If the user no longer needs this step, redirect away instead of showing a dead-end form.
- **Navigation:** Success -> role-based home. Cancel/back is usually not needed; logout is acceptable.

**API Contracts**

**Endpoint:** `GET /api/v1/auth/me`  
**Auth:** Bearer token

**Success Response (200):**

```json
{
  "user": {
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "fullName": "Rudra Sharma",
    "email": "rudra@example.com",
    "role": "USER",
    "status": "PROFILE_INCOMPLETE",
    "avatarUrl": null,
    "country": null
  }
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 401 | User not found | JWT is valid but the user record no longer exists |

**Endpoint:** `POST /api/v1/auth/complete-profile`  
**Auth:** Bearer token

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `country` | string | Yes | ISO alpha-2 country code |

**Success Response (200):**

```json
{
  "message": "Profile completed successfully."
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Invalid country code | Country is not a supported two-letter ISO code |
| 400 | User not found | Authenticated user no longer exists |
| 400 | Profile completion is not required | User is already beyond this onboarding step |
| 401 | Unauthorized | Missing or invalid bearer token |

### 1.4 Login Page (`/login`)

- **Who sees it:** Public users. Authenticated users should be redirected away.
- **On load:** No required API call on the page itself. If your app shell supports silent session restore, that should happen before rendering this page fully.
- **User flow:** User enters email and password, submits to `POST /auth/login`, stores the `accessToken` in memory, and lets the refresh cookie remain HttpOnly. If `needsCountry=true`, route to `/complete-profile`. Otherwise route by backend role: `SUPER_ADMIN -> /admin/dashboard`, `DISTRIBUTOR -> /distributor/dashboard`, `CUSTOMER -> /lms/courses`, `USER -> /funnel`. Google OAuth starts with `GET /auth/google`, optionally carrying referral context.
- **UI logic:** Show a "Forgot password" link. Keep the Google button on parity with email login. If login came from a protected page redirect, remember the intended destination but still honor onboarding and role guard rules first.
- **Error handling:** `401` invalid credentials -> inline form error. "Please verify your email first" -> show a direct link to `/verify-email` and optionally prefill the email. Suspended-account responses should render a blocking message instead of repeated retries.
- **Navigation:** Success -> `/complete-profile` or the correct home page. Secondary -> `/forgot-password`, `/signup`.

**API Contracts**

**Endpoint:** `POST /api/v1/auth/login`  
**Auth:** Public

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `email` | string | Yes | User email |
| `password` | string | Yes | Account password |

**Success Response (200):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.login-token",
  "needsCountry": false,
  "user": {
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "fullName": "Rudra Sharma",
    "email": "rudra@example.com",
    "role": "CUSTOMER",
    "status": "ACTIVE",
    "avatarUrl": "https://res.cloudinary.com/nsi/image/upload/v1/avatars/rudra.jpg"
  }
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Invalid email or password | Credentials do not match |
| 401 | Please verify your email first | Email exists but has not been OTP-verified yet |
| 401 | This account uses Google Sign-In. Please continue with Google. | Account has no password hash |
| 403 | Your account has been suspended | User status is suspended |

**Endpoint:** `GET /api/v1/auth/google`  
**Auth:** Public

**Query Params:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `referralCode` | string | No | Distributor code forwarded through OAuth `state` |

**Success Response (302):**

Browser redirect to Google OAuth consent. No JSON response body is returned.

**Redirect Notes:**

| Status | Outcome | When |
| --- | --- | --- |
| 302 | Redirect to Google OAuth | Normal Google login start |

### 1.5 Forgot Password Page (`/forgot-password`)

- **Who sees it:** Public users.
- **On load:** Nothing required.
- **User flow:** User enters email and submits to `POST /auth/forgot-password`. Always show a generic success state. The next step is the OTP-based reset page, not a token-link-only screen.
- **UI logic:** Never confirm whether the email exists. Keep the success message identical for valid and invalid addresses. A clean pattern is to show a "Continue to reset password" button after submit.
- **Error handling:** If the backend returns a rate-limit error, show a plain-language retry message. Do not leak whether the user exists.
- **Navigation:** Success state can push to `/reset-password?email=...` or simply show an inline CTA to continue there. Secondary -> `/login`.

**API Contracts**

**Endpoint:** `POST /api/v1/auth/forgot-password`  
**Auth:** Public

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `email` | string | Yes | Email address requesting password reset |

**Success Response (200):**

```json
{
  "message": "If your email is registered, a password reset OTP has been sent."
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Too many requests. Please wait 1 hour before requesting again. | Password-reset OTP resend throttling is triggered |

### 1.6 Reset Password Page (`/reset-password`)

- **Who sees it:** Public users who requested a reset.
- **On load:** No required API call. Prefill email from query or carry it from `/forgot-password`.
- **User flow:** User enters email, OTP, new password, and confirm password. Submit to `POST /auth/reset-password`. On success, show a success toast/banner and move back to login.
- **UI logic:** The current backend is OTP-based, so this page should visibly support OTP entry. If the product later moves to token links, update backend and this guide together. Keep confirm-password validation entirely client-side before submit.
- **Error handling:** Show inline errors for password mismatch. Invalid OTP or expired OTP should appear near the OTP field. If the backend says maximum attempts reached, lock the submit action and route back to `/forgot-password`.
- **Navigation:** Success -> `/login`. Secondary -> `/forgot-password`.

**API Contracts**

**Endpoint:** `POST /api/v1/auth/reset-password`  
**Auth:** Public

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `email` | string | Yes | Account email |
| `otp` | string | Yes | Six-digit password-reset OTP |
| `newPassword` | string | Yes | New password, minimum 8 characters |

**Success Response (200):**

```json
{
  "message": "Password has been safely reset. Please log in with your new password."
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Invalid email or OTP | Email/OTP pair is invalid |
| 400 | Invalid OTP. 2 attempt(s) remaining. | Wrong OTP while retry budget still exists |
| 400 | Maximum OTP attempts reached. Please request a new OTP. | User exhausted the password-reset OTP attempts |

### 1.7 Google OAuth Backend Callback (`/auth/google/callback`)

- **Who sees it:** Nobody in the SPA. This is backend-owned.
- **On load:** Frontend should not call anything here.
- **User flow:** Browser is redirected to Google, then back to the backend callback. The backend handles account merge/create, sets up an OAuth handoff, then redirects the browser again to the frontend callback page.
- **UI logic:** Do not build a visible frontend screen for this path. Treat it as an implementation detail.
- **Error handling:** If Google OAuth fails, the backend should redirect to an error route the SPA can understand.
- **Navigation:** Backend redirect -> frontend callback page, usually `/auth/callback?...`.

**API Contracts**

**Endpoint:** `GET /api/v1/auth/google/callback`  
**Auth:** Public, but reached only through Google OAuth

**Success Response (302):**

Browser redirect to the local backend handoff endpoint:

```text
http://localhost:3000/api/v1/auth/finalize-google?code=550e8400-e29b-41d4-a716-446655440000
```

**Redirect Notes:**

| Status | Outcome | When |
| --- | --- | --- |
| 302 | Redirect to `/api/v1/auth/finalize-google?code=...` | Google login succeeds and backend creates a short-lived OAuth handoff code |

**Endpoint:** `GET /api/v1/auth/finalize-google`  
**Auth:** Public

**Query Params:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `code` | string | Yes | One-time OAuth handoff code created by the backend callback |

**Success Response (302):**

Browser redirect to the frontend callback route after setting the `refresh_token` cookie on the backend domain:

```text
http://localhost:3001/auth/callback?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.google-token&fullName=Rudra%20Sharma&needsCountry=true
```

**Redirect Error Outcomes:**

| Status | Outcome | When |
| --- | --- | --- |
| 302 | Redirect to `/auth/error?reason=missing_code` | `code` query param is missing |
| 302 | Redirect to `/auth/error?reason=invalid_or_expired_code` | OAuth handoff code is invalid or older than 60 seconds |

### 1.8 Google OAuth Frontend Callback Page (`/auth/callback`)

- **Who sees it:** Public transient page after Google OAuth.
- **On load:** Read query params from the backend redirect, store the access token in memory, then call `GET /auth/me` if you need to fully hydrate user state.
- **User flow:** Parse the token and onboarding flags, initialize auth state, then route the user through the same post-login decision tree as normal login. If `needsCountry=true`, force `/complete-profile`.
- **UI logic:** Show a lightweight "Signing you in..." loader only. This page should not have a full form. It should also be resilient to refreshes until auth state is fully restored.
- **Error handling:** Missing or expired callback data should redirect to a friendly `/login` or `/auth/error` page with a retry CTA.
- **Navigation:** Success -> `/complete-profile` or role-based home.

**API Contracts**

**Endpoint:** `GET /api/v1/auth/me`  
**Auth:** Bearer token

**Success Response (200):**

```json
{
  "user": {
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "fullName": "Rudra Sharma",
    "email": "rudra@example.com",
    "role": "USER",
    "status": "PROFILE_INCOMPLETE",
    "avatarUrl": "https://res.cloudinary.com/nsi/image/upload/v1/avatars/rudra.jpg",
    "country": null
  }
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Access token is missing or invalid |
| 401 | User not found | Access token resolves to a deleted account |

### 1.9 Set Password Page (`/set-password`)

- **Who sees it:** Authenticated Google-login users who want an email/password login added to their account.
- **On load:** Optional `GET /auth/me` to verify the session is still alive.
- **User flow:** User enters new password and confirm password, then submits to `POST /auth/set-password`. After success, keep the current session and return the user to the app.
- **UI logic:** The current backend supports this endpoint, but it does not expose a dedicated "must set password now" flag after OAuth. So this page should exist, but forcing it immediately after Google login is a product choice, not a backend-enforced rule.
- **Error handling:** Password mismatch stays client-side. Expired session -> `/login`. Backend validation errors should appear inline.
- **Navigation:** Success -> previous page, `/profile`, or the appropriate dashboard with a success toast.

**API Contracts**

**Endpoint:** `GET /api/v1/auth/me`  
**Auth:** Bearer token

**Success Response (200):**

```json
{
  "user": {
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "fullName": "Rudra Sharma",
    "email": "rudra@example.com",
    "role": "USER",
    "status": "ACTIVE",
    "avatarUrl": "https://res.cloudinary.com/nsi/image/upload/v1/avatars/rudra.jpg",
    "country": "IN"
  }
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Session is missing or expired |
| 401 | User not found | Account no longer exists |

**Endpoint:** `POST /api/v1/auth/set-password`  
**Auth:** Bearer token

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `newPassword` | string | Yes | New password to attach to the OAuth account |

**Success Response (200):**

```json
{
  "message": "Password set successfully. You can now login with email and password."
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | You already have a password. Use the password reset flow instead. | User is not a Google-only account anymore |
| 401 | Unauthorized | Missing or invalid bearer token |
| 401 | User not found | JWT is valid but the user record is missing |

---

## Section 2 - User Profile

### 2.1 Profile Page (`/profile`)

- **Who sees it:** Any authenticated user.
- **On load:** `GET /auth/me` to hydrate the profile form and read role/status/avatar.
- **User flow:** User edits `fullName` and avatar only. For avatar, preferred frontend flow is select image -> upload directly to Cloudinary -> receive URL -> `PATCH /auth/me` with new `avatarUrl`. For name, call `PATCH /auth/me` with `fullName`.
- **UI logic:** Show `email`, `country`, and `role` as read-only fields. If the app uses direct Cloudinary upload, show upload progress before the final profile patch. If you choose backend upload instead, keep the UI identical and swap the transport only.
- **Error handling:** Invalid image type/size should be caught before upload. If Cloudinary fails, keep the old avatar and show retry UI. If the patch fails, revert optimistic UI and show a toast plus inline state.
- **Navigation:** Stay on `/profile` after save. If auth dies mid-edit, redirect to `/login`.

**API Contracts**

**Endpoint:** `GET /api/v1/auth/me`  
**Auth:** Bearer token

**Success Response (200):**

```json
{
  "user": {
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "fullName": "Rudra Sharma",
    "email": "rudra@example.com",
    "role": "CUSTOMER",
    "status": "ACTIVE",
    "avatarUrl": "https://res.cloudinary.com/nsi/image/upload/v1/avatars/rudra.jpg",
    "country": "IN"
  }
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 401 | User not found | Authenticated user record no longer exists |

**Endpoint:** `PATCH /api/v1/auth/me`  
**Auth:** Bearer token

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `fullName` | string | No | Updated display name |
| `avatarUrl` | string | No | Uploaded avatar URL |

**Success Response (200):**

```json
{
  "user": {
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "fullName": "Rudra Sharma",
    "email": "rudra@example.com",
    "role": "CUSTOMER",
    "status": "ACTIVE",
    "avatarUrl": "https://res.cloudinary.com/nsi/image/upload/v1/avatars/rudra-v2.jpg",
    "country": "IN"
  }
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Validation failed | `fullName` or `avatarUrl` does not pass DTO validation |
| 401 | Unauthorized | Missing or invalid bearer token |

**Endpoint:** `POST /api/v1/auth/upload-avatar`  
**Auth:** Bearer token

**Multipart Form Data:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `file` | binary | Yes | JPG, PNG, or WEBP avatar image up to 2 MB |

**Success Response (200):**

```json
{
  "avatarUrl": "https://res.cloudinary.com/nsi/image/upload/v1/avatars/user-550e8400-e29b-41d4-a716-446655440000.jpg"
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | No file uploaded | Multipart request did not include `file` |
| 400 | File too large. Maximum size is 2MB. | Image exceeds 2 MB |
| 400 | Only JPG, PNG, or WEBP images are allowed. | MIME type is not supported |
| 401 | Unauthorized | Missing or invalid bearer token |

---

## Section 3 - Funnel Pages

### 3.1 Funnel Journey Page (`/funnel`)

- **Who sees it:** Authenticated users still moving through onboarding/funnel. In product terms this is mainly `USER` before they become `CUSTOMER` or `DISTRIBUTOR`.
- **On load:** Call `GET /funnel/progress` and `GET /funnel/structure`. If your renderer is step-specific, also call `GET /funnel/step/:stepUuid` for the current unlocked step.
- **User flow:** Read current progress, render the current unlocked step, and update the top progress bar. When a step is completed, refresh progress and move the user into the next unlocked step without a full page reset.
- **UI logic:** The current backend uses a combined `VIDEO_TEXT` content step. Frontend should render it as video-only, text-first, or mixed content depending on what the step returns.
- **VIDEO/TEXT content step logic:** Show embedded video and/or rich text. Send `POST /funnel/step/:uuid/video-progress` every 10 seconds while the user watches. Disable Continue until the frontend threshold is met and then call `POST /funnel/step/:uuid/complete`. Use 90% watched or the backend-required threshold, whichever is stricter.
- **PHONE_GATE logic:** Show phone input and channel selection if the UI supports it, then call `POST /phone/send-otp`. After the user enters OTP, call `POST /phone/verify-otp`, then `POST /funnel/step/:uuid/complete`.
- **PAYMENT_GATE logic:** Show amount and payment copy from the step data. If coupons are allowed for the step, validate with `POST /coupons/validate`. On pay, call `POST /payments/create-order`, open Razorpay with the returned order details, then poll `GET /funnel/progress` until payment is reflected and the next step unlocks.
- **DECISION logic:** Show the yes/no business question and submit through `POST /funnel/decision`. `YES` should end at a thank-you or distributor/customer destination. `NO` should end at nurture/LMS messaging.
- **Error handling:** If progress says the current step is no longer available, reload the page state from `GET /funnel/progress`. Show inline OTP errors in PHONE_GATE. Coupon failure should not block normal full-price payment. Payment failure should keep the user on the same step with a retry button.
- **Navigation:** Continue in-page step to step. Final outcomes typically go to `/lms/courses`, `/distributor/subscribe`, a thank-you page, or another role-based destination depending on the business decision.

**API Contracts**

**Endpoint:** `GET /api/v1/funnel/progress`  
**Auth:** Bearer token

**Success Response (200):**

```json
{
  "currentSectionUuid": "c9d94f2c-7d14-4e5b-9a4a-2ac1b6a4d001",
  "currentStepUuid": "f04c76f0-4b8b-4d52-9c0a-dfc7d03f7001",
  "status": "IN_PROGRESS",
  "phoneVerified": false,
  "paymentCompleted": false,
  "decisionAnswer": null,
  "completedStepUuids": [
    "8b75e2f4-d1a5-4f78-91d1-a332658f1001"
  ]
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Please complete your profile first | User is blocked by `OnboardingGuard` |
| 403 | Your account has been suspended | User is suspended |

**Endpoint:** `GET /api/v1/funnel/structure`  
**Auth:** Bearer token

**Success Response (200):**

```json
{
  "sections": [
    {
      "uuid": "c9d94f2c-7d14-4e5b-9a4a-2ac1b6a4d001",
      "name": "Welcome",
      "description": "Start your NSI onboarding journey.",
      "order": 1,
      "steps": [
        {
          "uuid": "8b75e2f4-d1a5-4f78-91d1-a332658f1001",
          "type": "VIDEO_TEXT",
          "order": 1,
          "isActive": true,
          "title": "Welcome to NSI"
        },
        {
          "uuid": "f04c76f0-4b8b-4d52-9c0a-dfc7d03f7001",
          "type": "PHONE_GATE",
          "order": 2,
          "isActive": true,
          "title": "Verify your phone number"
        }
      ]
    }
  ]
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Please complete your profile first | User has not completed country onboarding |
| 403 | Your account has been suspended | User is suspended |

**Endpoint:** `GET /api/v1/funnel/step/:stepUuid`  
**Auth:** Bearer token

**Success Response (200) - `VIDEO_TEXT`:**

```json
{
  "type": "VIDEO_TEXT",
  "content": {
    "uuid": "1b7f0d44-7f51-4f0d-b4ef-8610a3771001",
    "stepUuid": "8b75e2f4-d1a5-4f78-91d1-a332658f1001",
    "title": "Welcome to NSI",
    "description": "Meet the NSI platform and understand what comes next.",
    "videoUrl": "https://iframe.mediadelivery.net/embed/98765/welcome-video",
    "videoDuration": 420,
    "thumbnailUrl": "https://cdn.nsi.com/funnel/welcome-thumb.jpg",
    "textContent": "<p>Read this before you continue to phone verification.</p>",
    "requireVideoCompletion": true,
    "createdAt": "2026-04-11T09:10:00.000Z",
    "updatedAt": "2026-04-11T09:10:00.000Z"
  }
}
```

**Success Response (200) - `PHONE_GATE`:**

```json
{
  "type": "PHONE_GATE",
  "phoneGate": {
    "uuid": "0f4f0db2-1ea3-4bd8-85aa-1f6d82631001",
    "stepUuid": "f04c76f0-4b8b-4d52-9c0a-dfc7d03f7001",
    "title": "Verify your phone number",
    "subtitle": "We will use this for distributor follow-up.",
    "isActive": true
  }
}
```

**Success Response (200) - `PAYMENT_GATE`:**

```json
{
  "type": "PAYMENT_GATE",
  "paymentGate": {
    "heading": "Commitment Fee",
    "subheading": "Unlock the next stage of the NSI journey.",
    "amount": 499,
    "currency": "INR",
    "ctaText": "Pay Commitment Fee",
    "features": [
      "Private onboarding support",
      "Fast-track access"
    ],
    "trustBadges": [
      "Secure Payment",
      "Official NSI Checkout"
    ],
    "testimonials": [
      {
        "name": "Mihir Patel",
        "text": "This moved me into the real business flow quickly.",
        "avatarInitials": "MP",
        "location": "Ahmedabad, India"
      }
    ],
    "allowCoupons": true,
    "enabled": true
  }
}
```

**Success Response (200) - `DECISION`:**

```json
{
  "type": "DECISION",
  "decisionStep": {
    "uuid": "ea3e4f9a-3ef5-40f1-a0ab-7fa4d34f1001",
    "stepUuid": "93db3a78-f6aa-4781-8f44-95ddf5091001",
    "question": "Do you want to join the business?",
    "yesLabel": "Yes, I want to join",
    "noLabel": "Not right now",
    "yesSubtext": "Speak to the team and move into the hot-lead flow.",
    "noSubtext": "Continue into nurture and LMS."
  }
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | You must complete the previous steps first | User requests a future step they have not unlocked |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Please complete your profile first | User is blocked by onboarding guard |
| 403 | Your account has been suspended | User is suspended |
| 404 | Step not found | Step UUID is missing or inactive |

**Endpoint:** `POST /api/v1/funnel/step/:stepUuid/video-progress`  
**Auth:** Bearer token

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `watchedSeconds` | number | Yes | Latest watched position in seconds |

**Success Response (201):**

```json
{
  "ok": true
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Validation failed | `watchedSeconds` is negative or not an integer |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Please complete your profile first | User is blocked by onboarding guard |
| 403 | Your account has been suspended | User is suspended |

**Endpoint:** `POST /api/v1/funnel/step/:stepUuid/complete`  
**Auth:** Bearer token

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `watchedSeconds` | number | No | Final watched seconds sent for `VIDEO_TEXT` completion checks |

**Success Response (201):**

```json
{
  "ok": true
}
```

**Alternate Success Response (201):**

```json
{
  "ok": true,
  "message": "Step already completed"
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | You must complete the previous steps first | Current step UUID does not match the requested step |
| 400 | Please watch the complete video before proceeding | Required video completion threshold was not reached |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Please complete your profile first | User is blocked by onboarding guard |
| 403 | Your account has been suspended | User is suspended |
| 404 | Step not found | Step UUID is missing or inactive |

**Endpoint:** `POST /api/v1/phone/send-otp`  
**Auth:** Bearer token

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `phone` | string | Yes | Phone number; service normalizes to E.164 |
| `channel` | string | No | `whatsapp` or `sms`; defaults to `whatsapp` |

**Success Response (200):**

```json
{
  "message": "OTP sent successfully",
  "channel": "whatsapp"
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Invalid phone number format. Use E.164 format: +91XXXXXXXXXX | Phone normalization fails |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Please complete your profile first | User is blocked by onboarding guard |
| 403 | Your account has been suspended | User is suspended |
| 409 | Phone number already registered to another account | Phone is already attached to a different user |
| 409 | Phone already verified for this account | User has already completed phone verification |
| 429 | Too many OTP requests. Please wait 1 hour before requesting again. | Phone OTP rate limit is triggered |

**Endpoint:** `POST /api/v1/phone/verify-otp`  
**Auth:** Bearer token

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `phone` | string | Yes | Phone number being verified |
| `code` | string | Yes | Six-digit OTP |
| `channel` | string | Yes | `whatsapp` or `sms` |

**Success Response (200):**

```json
{
  "message": "Phone verified successfully",
  "progress": {
    "phoneVerified": true,
    "paymentCompleted": false,
    "currentStepUuid": "7f502f2e-bdd6-4d40-8c2d-7d1132fb1001",
    "currentSectionUuid": "c9d94f2c-7d14-4e5b-9a4a-2ac1b6a4d001"
  }
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | OTP must be exactly 6 digits | DTO validation fails before service execution |
| 400 | Invalid phone number format. Use E.164 format: +91XXXXXXXXXX | Phone normalization fails |
| 400 | Invalid OTP | OTP code does not match |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Please complete your profile first | User is blocked by onboarding guard |
| 403 | Your account has been suspended | User is suspended |
| 429 | Too many wrong attempts. Try again in 1 hour. | Wrong-attempt lockout is active |

**Endpoint:** `POST /api/v1/coupons/validate`  
**Auth:** Bearer token

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `code` | string | Yes | Coupon code, alphanumeric |
| `paymentType` | string | Yes | `COMMITMENT_FEE`, `LMS_COURSE`, or `DISTRIBUTOR_SUB` |

**Success Response (200):**

```json
{
  "valid": true,
  "couponCode": "NSI100",
  "couponType": "FLAT",
  "originalAmount": 499,
  "discountAmount": 100,
  "finalAmount": 399,
  "message": "Coupon is valid"
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | This coupon is no longer active | Coupon exists but is deactivated |
| 400 | This coupon has expired | Coupon expiry is in the past |
| 400 | This coupon has reached its usage limit | Global usage limit is exhausted |
| 400 | You have already used this coupon | Per-user limit is exhausted |
| 400 | This coupon is not valid for this payment type | Coupon scope does not match `paymentType` |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Please complete your profile first | User is blocked by onboarding guard |
| 403 | Your account has been suspended | User is suspended |
| 404 | Coupon not found | Coupon code does not exist |

**Endpoint:** `POST /api/v1/payments/create-order`  
**Auth:** Bearer token

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `couponCode` | string | No | Coupon code to apply; amount is derived from the current payment-gate step |

**Success Response (201) - paid checkout:**

```json
{
  "orderId": "order_RZP_COMMITMENT_001",
  "amount": 399,
  "currency": "INR",
  "keyId": "rzp_test_nsi123"
}
```

**Success Response (201) - free access after coupon:**

```json
{
  "freeAccess": true
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Payment gate is not configured | Current payment step has no configured payment gate |
| 400 | This coupon has expired | Coupon validation fails during transactional order creation |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Phone verification required before payment | User tries to pay before verifying phone |
| 403 | You must reach the payment step first | Current funnel position is not the payment gate |
| 409 | Payment already completed | User has already paid the commitment fee |

**Endpoint:** `POST /api/v1/funnel/decision`  
**Auth:** Bearer token

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `answer` | string | Yes | `YES` or `NO` |
| `stepUuid` | string | Yes | Decision-step UUID |

**Success Response (201):**

```json
{
  "ok": true
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Invalid decision step | `stepUuid` is missing or is not a `DECISION` step |
| 400 | Decision already recorded | User already answered the decision step |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Please complete your profile first | User is blocked by onboarding guard |
| 403 | Your account has been suspended | User is suspended |

### 3.2 Funnel Completion Redirect Logic (global rule)

- **Who sees it:** Any authenticated user at app bootstrap or after login.
- **On load:** When the app needs to decide between funnel and post-funnel areas, call `GET /funnel/progress`.
- **User flow:** If progress shows funnel still active, keep `/funnel` available and prioritize it in routing. If the funnel is complete, never send the user back into the funnel shell.
- **UI logic:** Do not show funnel nav to users who are already beyond it. If a deep link lands on `/funnel` after completion, redirect immediately instead of rendering stale UI.
- **Error handling:** If the funnel check fails but the user is authenticated, show a full-page retry state instead of guessing the next route.
- **Navigation:** Completed funnel -> `CUSTOMER` path usually `/lms/courses`; `DISTRIBUTOR` path `/distributor/dashboard`; `SUPER_ADMIN` path `/admin/dashboard`.

**API Contracts**

**Endpoint:** `GET /api/v1/funnel/progress`  
**Auth:** Bearer token

**Success Response (200):**

```json
{
  "currentSectionUuid": null,
  "currentStepUuid": null,
  "status": "COMPLETED",
  "phoneVerified": true,
  "paymentCompleted": true,
  "decisionAnswer": "YES",
  "completedStepUuids": [
    "8b75e2f4-d1a5-4f78-91d1-a332658f1001",
    "f04c76f0-4b8b-4d52-9c0a-dfc7d03f7001",
    "7f502f2e-bdd6-4d40-8c2d-7d1132fb1001",
    "93db3a78-f6aa-4781-8f44-95ddf5091001"
  ]
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Please complete your profile first | User is blocked by onboarding guard |
| 403 | Your account has been suspended | User is suspended |

---

## Section 4 - LMS Pages

### 4.1 Course Catalog Page (`/lms/courses`)

- **Who sees it:** `CUSTOMER` and `DISTRIBUTOR`. Do not route raw `USER` here.
- **On load:** `GET /lms/courses`.
- **User flow:** User scans course cards, chooses a course, and clicks either Continue or Enroll.
- **UI logic:** Show `thumbnailUrl`, truncated description, optional badge, `displayEnrollmentCount`, `totalDuration`, enrollment progress, and CTA state. Price logic:
  - `isFree=true` -> show `FREE`
  - if `discountPercent` exists -> show struck original price plus discounted price
  - else show regular price
- **Error handling:** `403` should send the user back into funnel/onboarding. Empty course list should show a clean empty state, not a broken grid.
- **Navigation:** Course click -> `/lms/courses/:uuid`. My learning shortcut -> `/lms/my-courses`.

**API Contracts**

**Endpoint:** `GET /api/v1/lms/courses`  
**Auth:** Bearer token (`CUSTOMER`, `DISTRIBUTOR`)

**Success Response (200):**

```json
[
  {
    "uuid": "4fd2d086-5fc2-49ae-bba1-bf36b5ab1001",
    "title": "Kangen Water Business Masterclass",
    "description": "Learn how to build a Kangen Water distribution business from scratch.",
    "thumbnailUrl": "https://r2-url/nsi-thumbnails/UPLOAD-abc123.jpg",
    "isFree": false,
    "price": 999,
    "badge": "BESTSELLER",
    "totalDuration": "12h 30m",
    "previewVideoUrl": "https://iframe.mediadelivery.net/embed/98765/course-preview",
    "instructors": [
      "Nageshwar Shukla",
      "Dr. Patel"
    ],
    "whatYouWillLearn": [
      "Build a high-conviction distributor network",
      "Handle product and business objections"
    ],
    "originalPrice": 1999,
    "discountPercent": 50,
    "totalSections": 5,
    "totalLessons": 24,
    "displayEnrollmentCount": 206,
    "isEnrolled": false,
    "progress": null
  }
]
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Insufficient permissions | User role is not `CUSTOMER` or `DISTRIBUTOR` |

### 4.2 Course Landing Page (`/lms/courses/:uuid`)

- **Who sees it:** `CUSTOMER` and `DISTRIBUTOR`.
- **On load:** `GET /lms/courses/:uuid`.
- **User flow:** If not enrolled, user reviews the sales page, explores preview lessons, and clicks Enroll. If enrolled, user reviews progress and goes straight to learning.
- **UI logic for not enrolled users:** Show `previewVideoUrl`, badge, instructors, what-you-will-learn bullets, price block, enrollment count, duration, lesson count, and preview-only lesson interactions. Preview lessons are clickable; locked lessons are visible but disabled.
- **UI logic for enrolled users:** Show progress, section/lesson list, completion states, lock states, and a primary Continue Learning CTA. If `completedAt` exists, show a certificate CTA.
- **Enroll flow:** Call `POST /lms/courses/:uuid/enroll`. For free courses, redirect immediately on success. For paid courses, the same endpoint returns Razorpay order data; open checkout and then poll course detail or my-courses until the enrollment exists.
- **Error handling:** If the course is unpublished or missing, show a proper 404 page. If payment fails, keep the user on the landing page and leave the Enroll button available. If already enrolled, switch to Continue rather than throwing a dead-end error.
- **Navigation:** Not enrolled -> stay on page until enrollment completes, then `/lms/courses/:uuid/learn`. Enrolled lesson click -> `/lms/courses/:uuid/learn`.

**API Contracts**

**Endpoint:** `GET /api/v1/lms/courses/:uuid`  
**Auth:** Bearer token (`CUSTOMER`, `DISTRIBUTOR`)

**Success Response (200) - not enrolled:**

```json
{
  "uuid": "4fd2d086-5fc2-49ae-bba1-bf36b5ab1001",
  "title": "Kangen Water Business Masterclass",
  "description": "Learn how to build a Kangen Water distribution business from scratch.",
  "thumbnailUrl": "https://r2-url/nsi-thumbnails/UPLOAD-abc123.jpg",
  "isFree": false,
  "price": 999,
  "badge": "BESTSELLER",
  "totalDuration": "12h 30m",
  "previewVideoUrl": "https://iframe.mediadelivery.net/embed/98765/course-preview",
  "instructors": [
    "Nageshwar Shukla",
    "Dr. Patel"
  ],
  "whatYouWillLearn": [
    "Build a high-conviction distributor network",
    "Handle product and business objections"
  ],
  "originalPrice": 1999,
  "discountPercent": 50,
  "totalLessons": 24,
  "displayEnrollmentCount": 206,
  "enrollment": null,
  "sections": [
    {
      "uuid": "d0d17ca6-0ee0-4b96-8824-5d07a1ab1001",
      "title": "Module 1 - Foundations",
      "order": 1,
      "lessons": [
        {
          "uuid": "ca8ef9e0-f5bb-45dd-9d75-9349aef81001",
          "title": "What Makes Kangen Different",
          "order": 1,
          "videoDuration": 840,
          "isPreview": true,
          "videoUrl": "https://iframe.mediadelivery.net/embed/98765/preview-lesson",
          "textContent": "<p>Preview lesson notes.</p>",
          "attachmentUrl": "https://r2-url/nsi-attachments/UPLOAD-preview.pdf",
          "attachmentName": "Preview Slides.pdf"
        },
        {
          "uuid": "837f16f8-fc26-4e8c-9c57-4ed122931001",
          "title": "Compensation Deep Dive",
          "order": 2,
          "videoDuration": 1200,
          "isPreview": false,
          "videoUrl": null,
          "textContent": null,
          "attachmentUrl": null,
          "attachmentName": null
        }
      ]
    }
  ]
}
```

**Success Response (200) - enrolled:**

```json
{
  "uuid": "4fd2d086-5fc2-49ae-bba1-bf36b5ab1001",
  "title": "Kangen Water Business Masterclass",
  "description": "Learn how to build a Kangen Water distribution business from scratch.",
  "thumbnailUrl": "https://r2-url/nsi-thumbnails/UPLOAD-abc123.jpg",
  "isFree": false,
  "price": 999,
  "badge": "BESTSELLER",
  "totalDuration": "12h 30m",
  "previewVideoUrl": "https://iframe.mediadelivery.net/embed/98765/course-preview",
  "instructors": [
    "Nageshwar Shukla",
    "Dr. Patel"
  ],
  "whatYouWillLearn": [
    "Build a high-conviction distributor network",
    "Handle product and business objections"
  ],
  "originalPrice": 1999,
  "discountPercent": 50,
  "totalLessons": 24,
  "displayEnrollmentCount": 206,
  "enrollment": {
    "enrolledAt": "2026-04-10T06:30:00.000Z",
    "completedAt": null,
    "progress": 38
  },
  "sections": [
    {
      "uuid": "d0d17ca6-0ee0-4b96-8824-5d07a1ab1001",
      "title": "Module 1 - Foundations",
      "order": 1,
      "lessons": [
        {
          "uuid": "ca8ef9e0-f5bb-45dd-9d75-9349aef81001",
          "title": "What Makes Kangen Different",
          "order": 1,
          "videoDuration": 840,
          "isPreview": true,
          "isCompleted": true,
          "isLocked": false
        },
        {
          "uuid": "837f16f8-fc26-4e8c-9c57-4ed122931001",
          "title": "Compensation Deep Dive",
          "order": 2,
          "videoDuration": 1200,
          "isPreview": false,
          "isCompleted": false,
          "isLocked": false
        }
      ]
    }
  ]
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Insufficient permissions | User role is not allowed into LMS |
| 404 | Course not found | UUID does not resolve to a published course |

**Endpoint:** `POST /api/v1/lms/courses/:uuid/enroll`  
**Auth:** Bearer token (`CUSTOMER`, `DISTRIBUTOR`)

**Request Body:** No JSON body required.

**Success Response (200) - free course:**

```json
{
  "enrolled": true,
  "message": "Enrolled successfully"
}
```

**Success Response (200) - paid course:**

```json
{
  "orderId": "order_RZP_LMS_001",
  "amount": 99900,
  "currency": "INR",
  "keyId": "rzp_test_nsi123"
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Course is not published | Course exists but is not published |
| 400 | Course price is not configured | Paid course exists without a valid price |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Insufficient permissions | User role is not allowed into LMS |
| 404 | Course not found | Course UUID does not exist |
| 409 | Already enrolled in this course | User already has an enrollment record |

### 4.3 Course Learn Page (`/lms/courses/:uuid/learn`)

- **Who sees it:** Enrolled `CUSTOMER` and `DISTRIBUTOR` users only.
- **On load:** `GET /lms/courses/:uuid/learn`. If you want lesson-level lazy loading, call `GET /lms/lessons/:lessonUuid` when a lesson is selected.
- **User flow:** User chooses or resumes the current lesson, consumes content, progresses through the sidebar, and completes the course.
- **UI logic:** Left sidebar shows sections and lessons with `isCompleted` and `isLocked`. Main pane renders by content type:
  - `videoUrl` -> player
  - `textContent` -> rich text
  - `pdfUrl` -> inline viewer or download CTA
  - `attachmentUrl` -> download button with `attachmentName`
- **Progress logic:** For video lessons, call `POST /lms/lessons/:uuid/progress` every 10 seconds. When the backend response says `isCompleted=true`, unlock the next lesson. For text/PDF lessons, use `POST /lms/lessons/:uuid/complete`.
- **Error handling:** `403` means not enrolled or lesson locked; redirect to the course landing page with an explanation. Save progress failures should show a non-blocking retry banner but should not instantly eject the user from the lesson.
- **Navigation:** Next unlocked lesson after completion, either auto-advance or via a Next Lesson button. Course complete -> show certificate CTA or modal.

**API Contracts**

**Endpoint:** `GET /api/v1/lms/courses/:uuid/learn`  
**Auth:** Bearer token (`CUSTOMER`, `DISTRIBUTOR`)

**Success Response (200):**

```json
{
  "uuid": "4fd2d086-5fc2-49ae-bba1-bf36b5ab1001",
  "title": "Kangen Water Business Masterclass",
  "description": "Learn how to build a Kangen Water distribution business from scratch.",
  "thumbnailUrl": "https://r2-url/nsi-thumbnails/UPLOAD-abc123.jpg",
  "sections": [
    {
      "uuid": "d0d17ca6-0ee0-4b96-8824-5d07a1ab1001",
      "title": "Module 1 - Foundations",
      "order": 1,
      "lessons": [
        {
          "uuid": "ca8ef9e0-f5bb-45dd-9d75-9349aef81001",
          "title": "What Makes Kangen Different",
          "description": "Lesson overview",
          "videoUrl": "https://iframe.mediadelivery.net/embed/98765/lesson-1",
          "videoDuration": 840,
          "textContent": "<p>Lesson notes.</p>",
          "pdfUrl": null,
          "isPreview": true,
          "attachmentUrl": "https://r2-url/nsi-attachments/UPLOAD-preview.pdf",
          "attachmentName": "Lesson Slides.pdf",
          "order": 1,
          "isCompleted": true,
          "watchedSeconds": 840,
          "isLocked": false
        }
      ]
    }
  ]
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | You are not enrolled in this course | User has no enrollment for this course |
| 403 | Insufficient permissions | User role is not allowed into LMS |
| 404 | Course not found | UUID does not resolve to a published course |

**Endpoint:** `GET /api/v1/lms/lessons/:uuid`  
**Auth:** Bearer token (`CUSTOMER`, `DISTRIBUTOR`)

**Success Response (200):**

```json
{
  "uuid": "837f16f8-fc26-4e8c-9c57-4ed122931001",
  "title": "Compensation Deep Dive",
  "description": "How the NSI business model pays out.",
  "videoUrl": "https://iframe.mediadelivery.net/embed/98765/lesson-2",
  "videoDuration": 1200,
  "textContent": null,
  "pdfUrl": "https://r2-url/nsi-lms-pdfs/comp-plan.pdf",
  "isPreview": false,
  "attachmentUrl": "https://r2-url/nsi-attachments/UPLOAD-comp-plan.pdf",
  "attachmentName": "Compensation Plan.pdf",
  "order": 2,
  "isCompleted": false,
  "watchedSeconds": 420
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | You are not enrolled in this course | User has no enrollment in the lesson's parent course |
| 403 | Complete the previous lesson first | Lesson is still locked by sequence rules |
| 403 | Insufficient permissions | User role is not allowed into LMS |
| 404 | Lesson not found | Lesson is missing or unpublished |

**Endpoint:** `POST /api/v1/lms/lessons/:uuid/progress`  
**Auth:** Bearer token (`CUSTOMER`, `DISTRIBUTOR`)

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `watchedSeconds` | number | Yes | Latest watched position in seconds |

**Success Response (200):**

```json
{
  "isCompleted": false,
  "watchedSeconds": 420
}
```

**Alternate Success Response (200) - auto-complete at 90%+:**

```json
{
  "isCompleted": true,
  "watchedSeconds": 1085
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Validation failed | `watchedSeconds` is negative or not an integer |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | You are not enrolled in this course | User has no enrollment in the parent course |
| 403 | Insufficient permissions | User role is not allowed into LMS |
| 404 | Lesson not found | Lesson UUID does not exist |

**Endpoint:** `POST /api/v1/lms/lessons/:uuid/complete`  
**Auth:** Bearer token (`CUSTOMER`, `DISTRIBUTOR`)

**Request Body:** No JSON body required.

**Success Response (200):**

```json
{
  "isCompleted": true
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | You are not enrolled in this course | User has no enrollment in the lesson's parent course |
| 403 | Complete the previous lesson first | Lesson is still locked |
| 403 | Insufficient permissions | User role is not allowed into LMS |
| 404 | Lesson not found | Lesson UUID does not exist |

### 4.4 My Courses Page (`/lms/my-courses`)

- **Who sees it:** `CUSTOMER` and `DISTRIBUTOR`.
- **On load:** `GET /lms/my-courses`.
- **User flow:** User reviews enrolled courses, sees progress and last activity, then resumes a course.
- **UI logic:** Each course card shows thumbnail, title, progress bar, `completedLessons / totalLessons`, `lastActivityAt`, and certificate/download CTA if complete.
- **Error handling:** Empty state should encourage browsing `/lms/courses`. If a course was unpublished after enrollment, still keep the item visible if the backend returns it.
- **Navigation:** Course click -> `/lms/courses/:uuid/learn`.

**API Contracts**

**Endpoint:** `GET /api/v1/lms/my-courses`  
**Auth:** Bearer token (`CUSTOMER`, `DISTRIBUTOR`)

**Success Response (200):**

```json
{
  "courses": [
    {
      "uuid": "4fd2d086-5fc2-49ae-bba1-bf36b5ab1001",
      "title": "Kangen Water Business Masterclass",
      "thumbnailUrl": "https://r2-url/nsi-thumbnails/UPLOAD-abc123.jpg",
      "enrolledAt": "2026-04-10T06:30:00.000Z",
      "completedAt": null,
      "progress": 38,
      "certificateUrl": null,
      "totalLessons": 24,
      "completedLessons": 9,
      "lastActivityAt": "2026-04-11T08:20:00.000Z"
    }
  ]
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Insufficient permissions | User role is not `CUSTOMER` or `DISTRIBUTOR` |

### 4.5 Certificate Action Page (`/lms/courses/:uuid/certificate`)

- **Who sees it:** Users who completed the course.
- **On load:** Usually triggered by button click, not as a browsed page. Call `GET /lms/courses/:uuid/certificate`.
- **User flow:** Fetch certificate metadata and open the returned `certificateUrl` in a new tab.
- **UI logic:** If the user completed the course, show the CTA from both the landing page and My Courses. Do not show the CTA before completion.
- **Error handling:** If the backend says the course is not complete yet, show "Complete the course first" and return the user to the learning page.
- **Navigation:** Open the PDF in a new tab and keep the current app page intact.

**API Contracts**

**Endpoint:** `GET /api/v1/lms/courses/:uuid/certificate`  
**Auth:** Bearer token (`CUSTOMER`, `DISTRIBUTOR`)

**Success Response (200):**

```json
{
  "certificateUrl": "https://r2.file.url/nsi-certificates/CERT-4Q8M1PZK.pdf",
  "certificateId": "CERT-4Q8M1PZK"
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Course not completed yet | Enrollment exists but `completedAt` is still `null` |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Insufficient permissions | User role is not allowed into LMS |
| 404 | Enrollment not found | User has no enrollment for this course |

---

## Section 5 - Distributor Pages

### 5.1 Distributor Subscription Page (`/distributor/subscribe`)

- **Who sees it:** Authenticated users who are not currently active distributors. In product routing this is mainly `CUSTOMER`, but the backend accepts any authenticated user.
- **On load:** `GET /distributor/plans`. Also read current user/session state so you can redirect existing distributors away.
- **User flow:** User reviews plans, chooses one, then submits `POST /distributor/subscribe`. If the backend returns a Razorpay subscription link, open it. After payment, refresh auth state and/or poll subscription status until the role becomes `DISTRIBUTOR`.
- **UI logic:** Show plan name, amount, features, tagline, testimonials, trust badges, highlight badge, and CTA text. If the user already has a `HALTED` subscription, show an Update Payment Method path instead of a normal Subscribe CTA.
- **Error handling:** If the backend says the user already has an active subscription, redirect to `/distributor/dashboard`. If the backend returns a payment-method-update requirement, surface that action clearly instead of a generic error.
- **Navigation:** Success -> `/distributor/dashboard`. Existing distributor -> `/distributor/dashboard`.

**API Contracts**

**Endpoint:** `GET /api/v1/distributor/plans`  
**Auth:** Bearer token (any authenticated user)

**Success Response (200):**

```json
[
  {
    "uuid": "b0f3fa42-fb6b-4f3f-a04d-5cccbad61001",
    "name": "Business Pro",
    "amount": 1999,
    "interval": "monthly",
    "tagline": "Unlock your full distribution potential",
    "features": [
      "Unlimited leads",
      "Priority support",
      "Distributor LMS access"
    ],
    "trustBadges": [
      "ISO Certified",
      "10k+ Members"
    ],
    "ctaText": "Start Now",
    "highlightBadge": "MOST POPULAR",
    "testimonials": [
      {
        "name": "Nageshwar Shukla",
        "text": "This plan transformed my business in 3 months!",
        "avatarInitials": "NS",
        "location": "Mumbai, India"
      }
    ],
    "createdAt": "2026-04-01T06:30:00.000Z"
  }
]
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |

**Endpoint:** `POST /api/v1/distributor/subscribe`  
**Auth:** Bearer token (any authenticated user)

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `planUuid` | UUID | Yes | Distributor plan UUID selected by the user |

**Success Response (201):**

```json
{
  "subscriptionId": "mock_sub_6d86ce94-3d1d-45ba-a2b9-cb4d50f71001",
  "shortUrl": null
}
```

**Alternate Success Response (201) - live Razorpay flow:**

```json
{
  "subscriptionId": "sub_RZP_001",
  "shortUrl": "https://rzp.io/rzp/nsi-subscribe-001"
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | `{"message":"Your subscription payment failed. Please update your payment method.","paymentMethodUrl":"https://rzp.io/i/fix-card-001"}` | User already has a `HALTED` subscription |
| 400 | You already have an active subscription. | Existing subscription is `ACTIVE` or `GRACE` |
| 400 | Plan not found or is no longer active | Submitted `planUuid` does not resolve to an active plan |
| 401 | Unauthorized | Missing or invalid bearer token |

### 5.2 Distributor Dashboard Page (`/distributor/dashboard`)

- **Who sees it:** `DISTRIBUTOR` only.
- **On load:** `GET /distributor/dashboard`. If the header has a live notification badge, also fetch `GET /distributor/notifications` globally.
- **User flow:** User checks stats, copies join link, opens quick actions, and jumps into users, leads, tasks, calendar, or campaigns.
- **UI logic:** Show total referred users/leads, hot leads, contacted leads, customers, conversion rate, subscription summary card, and join-link summary. If dashboard join-link data does not include QR code, fetch `/distributor/join-link` when the user opens the full share card.
- **Error handling:** If the user is not a distributor anymore, redirect out of the distributor shell. If dashboard sub-sections fail independently, keep partial cards visible instead of blanking the whole page.
- **Navigation:** Quick actions -> `/distributor/users`, `/distributor/leads`, `/distributor/tasks`, `/distributor/calendar`, `/distributor/campaigns`, `/distributor/join-link`.

**API Contracts**

**Endpoint:** `GET /api/v1/distributor/dashboard`  
**Auth:** Bearer token (`DISTRIBUTOR`)

**Success Response (200):**

```json
{
  "totalLeads": 84,
  "hotLeads": 19,
  "contactedLeads": 11,
  "customers": 7,
  "conversionRate": 8.33,
  "subscription": {
    "status": "ACTIVE",
    "currentPeriodEnd": "2026-05-01T18:30:00.000Z",
    "graceDeadline": null,
    "plan": {
      "name": "Business Pro",
      "amount": 1999
    }
  },
  "joinLink": {
    "url": "https://growithnsi.com/join/NSI-RAJESH",
    "isActive": true
  }
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a distributor |

**Endpoint:** `GET /api/v1/distributor/notifications`  
**Auth:** Bearer token (`DISTRIBUTOR`)

**Success Response (200):**

```json
{
  "tasksDueToday": [
    {
      "uuid": "f61ba2b7-f9aa-4d08-a68e-0c1bc31d1001",
      "title": "Call Rajesh about distributor onboarding",
      "dueDate": "2026-04-11T00:00:00.000Z",
      "lead": {
        "uuid": "d4f7c7d5-cfcb-4607-9bb9-7bc61fa71001",
        "userFullName": "Rajesh Patel",
        "status": "HOT"
      }
    }
  ],
  "tasksDueSoon": [
    {
      "uuid": "0f74ddf2-c8d6-4719-84f8-4d3297e31001",
      "title": "Share LMS course bundle with Mihir",
      "dueDate": "2026-04-12T00:00:00.000Z",
      "lead": null
    }
  ],
  "followupsToday": [
    {
      "leadUuid": "d4f7c7d5-cfcb-4607-9bb9-7bc61fa71001",
      "userFullName": "Rajesh Patel",
      "leadStatus": "FOLLOWUP",
      "followupAt": "2026-04-11T11:00:00.000Z",
      "notes": "Discuss payment concerns and next webinar slot."
    }
  ],
  "unreadCount": 2
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a distributor |

### 5.3 Subscription Management Page (`/distributor/subscription`)

- **Who sees it:** `DISTRIBUTOR` only.
- **On load:** `GET /distributor/subscription`.
- **User flow:** User reviews current status, cancels if needed, or updates payment method if halted.
- **UI logic:** Status rendering:
  - `ACTIVE` -> active badge + next billing date + Cancel button
  - `HALTED` -> warning state + grace deadline + Update Payment button
  - `CANCELLED` -> access-until message + re-subscribe CTA after period end
  - `EXPIRED` -> ended state + re-subscribe CTA
  - `NONE` -> edge-case informational state
- **Migration banner logic:** If `migrationPending=true`, show a banner that the current plan was deactivated by admin and the user should choose a replacement plan before the billing cycle ends. CTA should go to `/distributor/subscribe`.
- **Cancel flow:** Show a confirmation modal, then call `POST /distributor/subscription/cancel`, refresh the page state, and keep access-until messaging visible.
- **Update payment method flow:** Call `GET /distributor/subscription/payment-method-url`, open the returned hosted Razorpay page in a new tab, then poll `GET /distributor/subscription` until the status changes.
- **Error handling:** If cancellation is blocked because payment is already pending, show "Update payment method first." If payment-method URL lookup fails, keep the user on the page with a retry button.
- **Navigation:** Re-subscribe CTA -> `/distributor/subscribe`. Successful recovery -> stay on `/distributor/subscription` or return to dashboard.

**API Contracts**

**Endpoint:** `GET /api/v1/distributor/subscription`  
**Auth:** Bearer token (`DISTRIBUTOR`)

**Success Response (200) - active or historical subscription present:**

```json
{
  "status": "ACTIVE",
  "currentPeriodEnd": "2026-05-01T18:30:00.000Z",
  "graceDeadline": null,
  "migrationPending": false,
  "planDeactivatedAt": null,
  "plan": {
    "name": "Business Pro",
    "amount": 1999
  }
}
```

**Alternate Success Response (200) - manually assigned distributor with no subscription record:**

```json
{
  "status": "NONE",
  "message": "No subscription record found. Your role was assigned manually."
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a distributor |

**Endpoint:** `POST /api/v1/distributor/subscription/cancel`  
**Auth:** Bearer token (`DISTRIBUTOR`)

**Request Body:** No JSON body required.

**Success Response (201):**

```json
{
  "message": "Subscription cancelled. Access continues until 01 May 2026.",
  "accessUntil": "2026-05-01T18:30:00.000Z"
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Your payment is pending. Please update your payment method instead of cancelling. | Current subscription is `HALTED` |
| 400 | No active subscription found. | Subscription is already `CANCELLED` or `EXPIRED` |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a distributor |
| 404 | No subscription found. | Distributor has no subscription record |

**Endpoint:** `GET /api/v1/distributor/subscription/payment-method-url`  
**Auth:** Bearer token (`DISTRIBUTOR`)

**Success Response (200):**

```json
{
  "url": "https://rzp.io/i/update-card-001"
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | No payment issue found on your subscription. | Subscription is missing or not `HALTED` |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a distributor |

### 5.4 Subscription History Page (`/distributor/subscription/history`)

- **Who sees it:** `DISTRIBUTOR` only.
- **On load:** `GET /distributor/subscription/history`.
- **User flow:** User reviews timeline or table entries such as `SUBSCRIBED`, `CHARGED`, `SELF_CANCELLED`, and migration events.
- **UI logic:** Show event name, amount if present, invoice number if present, and formatted created date. If invoice number exists, render a Download Invoice action.
- **Error handling:** Empty history should show a calm placeholder like "No billing events yet." Missing invoice documents should fail softly with a retry/open-later message.
- **Navigation:** Invoice click -> open the invoice PDF in a new tab. A practical fallback is the public invoice path based on `invoiceNumber`.

**API Contracts**

**Endpoint:** `GET /api/v1/distributor/subscription/history`  
**Auth:** Bearer token (`DISTRIBUTOR`)

**Success Response (200):**

```json
[
  {
    "uuid": "463e9b34-4df1-4b26-b6f5-c8337b7d1001",
    "userUuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
    "planUuid": "b0f3fa42-fb6b-4f3f-a04d-5cccbad61001",
    "razorpaySubscriptionId": "sub_RZP_001",
    "event": "CHARGED",
    "amount": 1999,
    "invoiceNumber": "INV-2026-00017",
    "notes": "Monthly renewal payment successful",
    "createdAt": "2026-04-01T18:31:10.000Z",
    "plan": {
      "name": "Business Pro",
      "amount": 1999
    }
  },
  {
    "uuid": "ba853fc5-d0af-47fc-8368-6ccfd83e1001",
    "userUuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
    "planUuid": "b0f3fa42-fb6b-4f3f-a04d-5cccbad61001",
    "razorpaySubscriptionId": "sub_RZP_001",
    "event": "SELF_CANCELLED",
    "amount": null,
    "invoiceNumber": null,
    "notes": "Access continues until Thu May 01 2026 00:00:00 GMT+0530 (India Standard Time)",
    "createdAt": "2026-04-11T05:00:00.000Z",
    "plan": {
      "name": "Business Pro",
      "amount": 1999
    }
  }
]
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a distributor |

### 5.5 Distributor Users Page (`/distributor/users`)

- **Who sees it:** `DISTRIBUTOR` only.
- **On load:** `GET /distributor/users/analytics` and `GET /distributor/users`.
- **User flow:** User scans referred users, filters/searches, then opens user detail to inspect funnel and payment activity.
- **UI logic:** Show top analytics cards plus a searchable/filterable table. Funnel stage filters should be URL-driven so the page is shareable/bookmarkable.
- **Error handling:** If analytics fails but the list succeeds, keep the list visible. If a selected user no longer belongs to this distributor, show a "Not available" message instead of exposing other-network data.
- **Navigation:** Detail click -> `/distributor/users/:uuid` or an in-page detail drawer. Lead-specific next step -> `/distributor/leads` if the user is already a lead.

**API Contracts**

**Endpoint:** `GET /api/v1/distributor/users/analytics`  
**Auth:** Bearer token (`DISTRIBUTOR`)

**Success Response (200):**

```json
{
  "totalUsers": 84,
  "paidUsers": 19,
  "freeUsers": 65,
  "hotLeads": 19,
  "customers": 7,
  "conversionRate": 8.33,
  "funnelDropOff": {
    "registered": 84,
    "phoneVerified": 52,
    "paymentCompleted": 19,
    "saidYes": 11,
    "saidNo": 8
  }
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a distributor |

**Endpoint:** `GET /api/v1/distributor/users`  
**Auth:** Bearer token (`DISTRIBUTOR`)

**Query Params:**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `search` | string | No | Search by name or email |
| `funnelStage` | enum | No | One of `REGISTERED`, `PHONE_VERIFIED`, `PAYMENT_COMPLETED`, `SAID_YES`, `SAID_NO` |
| `page` | number | No | Page number, default `1` |
| `limit` | number | No | Page size, default `20` |

**Success Response (200):**

```json
{
  "items": [
    {
      "uuid": "7a9c2db6-ef87-4a62-b67f-ec1c28251001",
      "fullName": "Rajesh Patel",
      "email": "rajesh.patel@example.com",
      "phone": "+919876543210",
      "country": "India",
      "avatarUrl": "https://res.cloudinary.com/nsi/image/upload/v1712800/avatar-rajesh.jpg",
      "role": "USER",
      "status": "ACTIVE",
      "createdAt": "2026-04-01T08:00:00.000Z",
      "leadStatus": "HOT",
      "displayLeadStatus": "Hot",
      "paymentStatus": "SUCCESS",
      "funnelStage": "PAYMENT_COMPLETED",
      "funnelStageLabel": "Payment Completed",
      "funnelProgress": {
        "completedSteps": 3,
        "totalSteps": 4,
        "phoneVerified": true,
        "paymentCompleted": true,
        "decisionAnswer": null
      }
    }
  ],
  "total": 84,
  "page": 1,
  "limit": 20,
  "totalPages": 5
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Validation failed | Invalid `page`, `limit`, or `funnelStage` query |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a distributor |

**Endpoint:** `GET /api/v1/distributor/users/:uuid`  
**Auth:** Bearer token (`DISTRIBUTOR`)

**Success Response (200):**

```json
{
  "uuid": "7a9c2db6-ef87-4a62-b67f-ec1c28251001",
  "fullName": "Rajesh Patel",
  "email": "rajesh.patel@example.com",
  "phone": "+919876543210",
  "country": "India",
  "avatarUrl": "https://res.cloudinary.com/nsi/image/upload/v1712800/avatar-rajesh.jpg",
  "role": "USER",
  "status": "ACTIVE",
  "createdAt": "2026-04-01T08:00:00.000Z",
  "lead": {
    "uuid": "d4f7c7d5-cfcb-4607-9bb9-7bc61fa71001",
    "status": "HOT",
    "displayStatus": "Hot",
    "availableActions": [
      "CONTACTED",
      "FOLLOWUP",
      "MARK_AS_CUSTOMER",
      "LOST"
    ],
    "nurtureEnrollment": null
  },
  "funnelProgress": {
    "completedSteps": 3,
    "totalSteps": 4,
    "phoneVerified": true,
    "paymentCompleted": true,
    "decisionAnswer": "YES",
    "decisionAnsweredAt": "2026-04-04T10:10:00.000Z",
    "stepProgress": [
      {
        "stepUuid": "19c69d0b-87b6-458b-befb-d85f82811001",
        "stepTitle": "Why Kangen Water Works",
        "stepType": "VIDEO_TEXT",
        "isCompleted": true,
        "completedAt": "2026-04-02T06:40:00.000Z",
        "watchedSeconds": 643
      },
      {
        "stepUuid": "8b3f048d-ef1f-4a91-b4f9-758d42441001",
        "stepTitle": "Phone Verification",
        "stepType": "PHONE_GATE",
        "isCompleted": true,
        "completedAt": "2026-04-02T07:00:00.000Z",
        "watchedSeconds": 0
      }
    ]
  },
  "paymentHistory": [
    {
      "uuid": "c8cab86d-c17a-47a0-b0a1-1cd604101001",
      "amount": 999,
      "finalAmount": 799,
      "status": "SUCCESS",
      "paymentType": "COMMITMENT_FEE",
      "createdAt": "2026-04-02T07:30:00.000Z"
    }
  ],
  "lmsProgress": [
    {
      "courseUuid": "4fd2d086-5fc2-49ae-bba1-bf36b5ab1001",
      "courseTitle": "Kangen Water Business Masterclass",
      "enrolledAt": "2026-04-05T09:00:00.000Z",
      "completedAt": null,
      "certificateUrl": null,
      "completedLessons": 9,
      "totalLessons": 24
    }
  ],
  "activityLog": [
    {
      "uuid": "cccf4175-f73a-45da-a89e-f8261a191001",
      "action": "STATUS_CHANGED",
      "fromStatus": "HOT",
      "toStatus": "FOLLOWUP",
      "notes": "Asked to call back after salary date.",
      "followupAt": "2026-04-11T11:00:00.000Z",
      "actorName": "Rudra Shah",
      "createdAt": "2026-04-10T13:00:00.000Z"
    }
  ]
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a distributor |
| 404 | User not found | UUID does not exist in this distributor's network |

### 5.6 Distributor Tasks Page (`/distributor/tasks`)

- **Who sees it:** `DISTRIBUTOR` only.
- **On load:** `GET /distributor/tasks`.
- **User flow:** User creates tasks, edits tasks, drags them between columns, and deletes tasks after confirmation.
- **UI logic:** Render three Kanban columns: `TODO`, `IN_PROGRESS`, `COMPLETE`. Use optimistic drag-and-drop updates, but revert the card if `PATCH /distributor/tasks/:uuid/move` fails.
- **Error handling:** Failed create/edit should keep the modal open with inline errors. Failed delete should restore the card and show a retry toast.
- **Navigation:** Optional lead link on a task should jump to the related lead detail page.

**API Contracts**

**Endpoint:** `GET /api/v1/distributor/tasks`  
**Auth:** Bearer token (`DISTRIBUTOR`)

**Success Response (200):**

```json
{
  "TODO": [
    {
      "uuid": "f61ba2b7-f9aa-4d08-a68e-0c1bc31d1001",
      "title": "Call Rajesh about distributor onboarding",
      "status": "TODO",
      "order": 1,
      "dueDate": "2026-04-11T00:00:00.000Z",
      "lead": {
        "uuid": "d4f7c7d5-cfcb-4607-9bb9-7bc61fa71001",
        "userFullName": "Rajesh Patel",
        "userAvatarUrl": "https://res.cloudinary.com/nsi/image/upload/v1712800/avatar-rajesh.jpg",
        "status": "HOT"
      },
      "createdAt": "2026-04-10T08:15:00.000Z"
    }
  ],
  "IN_PROGRESS": [],
  "COMPLETE": []
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a distributor |

**Endpoint:** `POST /api/v1/distributor/tasks`  
**Auth:** Bearer token (`DISTRIBUTOR`)

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `title` | string | Yes | Task title, max 200 characters |
| `leadUuid` | UUID | No | Related lead UUID |
| `dueDate` | ISO datetime string | No | Task due date |

**Success Response (201):**

```json
{
  "uuid": "f61ba2b7-f9aa-4d08-a68e-0c1bc31d1001",
  "distributorUuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
  "leadUuid": "d4f7c7d5-cfcb-4607-9bb9-7bc61fa71001",
  "title": "Call Rajesh about distributor onboarding",
  "dueDate": "2026-04-11T00:00:00.000Z",
  "status": "TODO",
  "order": 5,
  "createdAt": "2026-04-10T08:15:00.000Z",
  "updatedAt": "2026-04-10T08:15:00.000Z",
  "lead": {
    "uuid": "d4f7c7d5-cfcb-4607-9bb9-7bc61fa71001",
    "userFullName": "Rajesh Patel",
    "userAvatarUrl": "https://res.cloudinary.com/nsi/image/upload/v1712800/avatar-rajesh.jpg",
    "status": "HOT"
  }
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Lead not found or does not belong to this distributor | Submitted `leadUuid` is outside the distributor's network |
| 400 | Validation failed | Invalid title, UUID, or ISO date |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a distributor |

**Endpoint:** `GET /api/v1/distributor/tasks/:uuid/edit`  
**Auth:** Bearer token (`DISTRIBUTOR`)

**Success Response (200):**

```json
{
  "title": "Call Rajesh about distributor onboarding",
  "leadUuid": "d4f7c7d5-cfcb-4607-9bb9-7bc61fa71001",
  "dueDate": "2026-04-11T00:00:00.000Z",
  "status": "TODO",
  "order": 5
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a distributor |
| 404 | Task not found | Task UUID does not exist or is outside distributor scope |

**Endpoint:** `PATCH /api/v1/distributor/tasks/:uuid`  
**Auth:** Bearer token (`DISTRIBUTOR`)

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `title` | string | No | Updated task title |
| `leadUuid` | UUID | No | Updated related lead UUID |
| `dueDate` | ISO datetime string | No | Updated due date, or `null` to clear |
| `status` | enum | No | One of `TODO`, `IN_PROGRESS`, `COMPLETE` |
| `order` | number | No | Column display order, minimum `0` |

**Success Response (200):**

```json
{
  "uuid": "f61ba2b7-f9aa-4d08-a68e-0c1bc31d1001",
  "distributorUuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
  "leadUuid": "d4f7c7d5-cfcb-4607-9bb9-7bc61fa71001",
  "title": "Call Rajesh about distributor onboarding",
  "dueDate": "2026-04-11T00:00:00.000Z",
  "status": "IN_PROGRESS",
  "order": 0,
  "createdAt": "2026-04-10T08:15:00.000Z",
  "updatedAt": "2026-04-10T09:00:00.000Z",
  "lead": {
    "uuid": "d4f7c7d5-cfcb-4607-9bb9-7bc61fa71001",
    "userFullName": "Rajesh Patel",
    "userAvatarUrl": "https://res.cloudinary.com/nsi/image/upload/v1712800/avatar-rajesh.jpg",
    "status": "HOT"
  }
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Lead not found or does not belong to this distributor | Submitted `leadUuid` is outside the distributor's network |
| 400 | Validation failed | Invalid enum, UUID, number, or date |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a distributor |
| 404 | Task not found | Task UUID does not exist or is outside distributor scope |

**Endpoint:** `PATCH /api/v1/distributor/tasks/:uuid/move`  
**Auth:** Bearer token (`DISTRIBUTOR`)

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | enum | Yes | Target column: `TODO`, `IN_PROGRESS`, or `COMPLETE` |
| `order` | number | Yes | New order index in the destination column |

**Success Response (200):**

```json
{
  "uuid": "f61ba2b7-f9aa-4d08-a68e-0c1bc31d1001",
  "distributorUuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
  "leadUuid": "d4f7c7d5-cfcb-4607-9bb9-7bc61fa71001",
  "title": "Call Rajesh about distributor onboarding",
  "dueDate": "2026-04-11T00:00:00.000Z",
  "status": "COMPLETE",
  "order": 0,
  "createdAt": "2026-04-10T08:15:00.000Z",
  "updatedAt": "2026-04-10T09:30:00.000Z",
  "lead": {
    "uuid": "d4f7c7d5-cfcb-4607-9bb9-7bc61fa71001",
    "userFullName": "Rajesh Patel",
    "userAvatarUrl": "https://res.cloudinary.com/nsi/image/upload/v1712800/avatar-rajesh.jpg",
    "status": "HOT"
  }
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Validation failed | Invalid status or order |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a distributor |
| 404 | Task not found | Task UUID does not exist or is outside distributor scope |

**Endpoint:** `DELETE /api/v1/distributor/tasks/:uuid`  
**Auth:** Bearer token (`DISTRIBUTOR`)

**Success Response (200):**

```json
{
  "message": "Task deleted successfully"
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a distributor |
| 404 | Task not found | Task UUID does not exist or is outside distributor scope |

### 5.7 Distributor Calendar Page (`/distributor/calendar`)

- **Who sees it:** `DISTRIBUTOR` only.
- **On load:** `GET /distributor/calendar?month=...&year=...`.
- **User flow:** User changes month, reviews task due dates and follow-ups, writes personal notes, and deletes notes when needed.
- **UI logic:** Merge task/follow-up events with personal-note events in one month view. Notes are upserted per date, so editing the same day should overwrite the existing note instead of creating duplicates.
- **Error handling:** Keep month navigation usable even if one fetch fails. If note save fails, leave the editor open and do not clear the typed content.
- **Navigation:** Event click -> task page, lead detail, or note editor. Add follow-up CTA can route to `/distributor/leads` or `/distributor/followups/today`.

**API Contracts**

**Endpoint:** `GET /api/v1/distributor/calendar`  
**Auth:** Bearer token (`DISTRIBUTOR`)

**Query Params:**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `year` | number | Yes | Calendar year, between `2020` and `2100` |
| `month` | number | Yes | Calendar month, between `1` and `12` |

**Success Response (200):**

```json
{
  "year": 2026,
  "month": 4,
  "events": [
    {
      "date": "2026-04-11",
      "type": "FOLLOWUP",
      "title": "Follow up with Rajesh Patel",
      "time": "05:30:00",
      "leadUuid": "d4f7c7d5-cfcb-4607-9bb9-7bc61fa71001",
      "leadStatus": "FOLLOWUP",
      "notes": "Discuss payment concerns and next webinar slot."
    },
    {
      "date": "2026-04-13",
      "type": "PERSONAL_NOTE",
      "title": "Prepare Sunday webinar talking points",
      "notes": "Prepare Sunday webinar talking points",
      "noteUuid": "c528ac8a-9d7c-4dcb-8500-4c98f8e91001"
    }
  ]
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Validation failed | Missing or invalid `year` / `month` query params |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a distributor |

**Endpoint:** `POST /api/v1/distributor/calendar/notes`  
**Auth:** Bearer token (`DISTRIBUTOR`)

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `date` | ISO date string | Yes | Note date in `YYYY-MM-DD` form |
| `note` | string | Yes | Note content, max 1000 characters |

**Success Response (201):**

```json
{
  "uuid": "c528ac8a-9d7c-4dcb-8500-4c98f8e91001",
  "distributorUuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
  "date": "2026-04-13T00:00:00.000Z",
  "note": "Prepare Sunday webinar talking points",
  "createdAt": "2026-04-11T07:30:00.000Z",
  "updatedAt": "2026-04-11T07:30:00.000Z"
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Validation failed | Invalid date or note format |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a distributor |

**Endpoint:** `DELETE /api/v1/distributor/calendar/notes/:uuid`  
**Auth:** Bearer token (`DISTRIBUTOR`)

**Success Response (200):**

```json
{
  "message": "Note deleted successfully"
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a distributor |
| 404 | Note not found | Note UUID does not exist or is outside distributor scope |

### 5.8 Distributor Notifications Page (`/distributor/notifications`)

- **Who sees it:** `DISTRIBUTOR` only.
- **On load:** `GET /distributor/notifications`.
- **User flow:** User opens the notification center, reviews due items, and jumps into the relevant task or lead.
- **UI logic:** Also use this endpoint for the nav badge count if the header is shared across distributor pages.
- **Error handling:** If notifications fail, keep the rest of the app usable and show the badge as unavailable rather than zero.
- **Navigation:** Task notification -> `/distributor/tasks`. Follow-up notification -> `/distributor/leads/:uuid` or `/distributor/followups/today`.

**API Contracts**

**Endpoint:** `GET /api/v1/distributor/notifications`  
**Auth:** Bearer token (`DISTRIBUTOR`)

**Success Response (200):**

```json
{
  "tasksDueToday": [
    {
      "uuid": "f61ba2b7-f9aa-4d08-a68e-0c1bc31d1001",
      "title": "Call Rajesh about distributor onboarding",
      "dueDate": "2026-04-11T00:00:00.000Z",
      "lead": {
        "uuid": "d4f7c7d5-cfcb-4607-9bb9-7bc61fa71001",
        "userFullName": "Rajesh Patel",
        "status": "HOT"
      }
    }
  ],
  "tasksDueSoon": [
    {
      "uuid": "0f74ddf2-c8d6-4719-84f8-4d3297e31001",
      "title": "Share LMS course bundle with Mihir",
      "dueDate": "2026-04-12T00:00:00.000Z",
      "lead": null
    }
  ],
  "followupsToday": [
    {
      "leadUuid": "d4f7c7d5-cfcb-4607-9bb9-7bc61fa71001",
      "userFullName": "Rajesh Patel",
      "leadStatus": "FOLLOWUP",
      "followupAt": "2026-04-11T11:00:00.000Z",
      "notes": "Discuss payment concerns and next webinar slot."
    }
  ],
  "unreadCount": 2
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a distributor |

### 5.9 Distributor Join Link Page (`/distributor/join-link`)

- **Who sees it:** `DISTRIBUTOR` only.
- **On load:** `GET /distributor/join-link`.
- **User flow:** User copies the join URL, downloads/shares the QR code, and posts the link externally.
- **UI logic:** Render the QR code directly from the returned data URL. If `isActive=false`, still show the code/URL for context but disable share/copy actions and explain that admin reactivation is required.
- **Error handling:** Copy/share failures should not look like backend failures. If the fetch fails, offer retry and keep the share page mounted.
- **Navigation:** Back to dashboard, or deep link to campaign creation for tracked links.

**API Contracts**

**Endpoint:** `GET /api/v1/distributor/join-link`  
**Auth:** Bearer token (`DISTRIBUTOR`)

**Success Response (200):**

```json
{
  "code": "NSI-RAJESH",
  "url": "https://growithnsi.com/join/NSI-RAJESH",
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "isActive": true
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a distributor |
| 404 | No distributor code assigned yet | User has distributor role but no generated join code |

### 5.10 Distributor UTM Analytics Page (`/distributor/analytics`)

- **Who sees it:** `DISTRIBUTOR` only.
- **On load:** `GET /distributor/analytics/utm`.
- **User flow:** User reads source, medium, and campaign breakdowns to see what is converting.
- **UI logic:** Show both chart and table views if possible. Date-range controls can be local page state if product wants trend windows.
- **Error handling:** Empty analytics should say "No tracked signups yet" instead of showing a broken chart.
- **Navigation:** Related campaign drill-down -> `/distributor/campaigns`.

**API Contracts**

**Endpoint:** `GET /api/v1/distributor/analytics/utm`  
**Auth:** Bearer token (`DISTRIBUTOR`)

**Query Params:**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `from` | ISO date string | No | Inclusive start date |
| `to` | ISO date string | No | Inclusive end date |

**Success Response (200):**

```json
{
  "bySource": [
    {
      "source": "facebook",
      "leads": 11
    },
    {
      "source": "whatsapp",
      "leads": 6
    }
  ],
  "byMedium": [
    {
      "medium": "cpc",
      "leads": 11
    },
    {
      "medium": "share",
      "leads": 6
    }
  ],
  "byCampaign": [
    {
      "campaign": "summer-kangen-drive",
      "leads": 9
    },
    {
      "campaign": "april-webinar-push",
      "leads": 8
    }
  ],
  "total": 17,
  "from": "2026-03-12T00:00:00.000Z",
  "to": "2026-04-11T23:59:59.999Z"
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Validation failed | Invalid `from` or `to` query |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a distributor |

---

## Section 6 - Campaign Pages

### 6.1 Distributor Campaign List Page (`/distributor/campaigns`)

- **Who sees it:** `DISTRIBUTOR` only.
- **On load:** `GET /distributor/campaigns`.
- **User flow:** User creates campaigns, edits campaign settings, toggles active state, reviews click/conversion data, and deletes unused campaigns.
- **UI logic:** Show name, generated URL, UTM values, active state, and performance stats. Create/edit can live in modals or dedicated edit routes; both fit the current backend.
- **Error handling:** Slug conflicts should show inline on create/edit. Delete needs a confirm step. If analytics data is delayed, keep the campaign itself visible.
- **Navigation:** Edit -> `/distributor/campaigns/:uuid/edit` or modal. Detail analytics -> `/distributor/campaigns/:uuid`.

**API Contracts**

**Endpoint:** `GET /api/v1/distributor/campaigns`  
**Auth:** Bearer token (`DISTRIBUTOR`)

**Success Response (200):**

```json
[
  {
    "uuid": "adf73e3c-7f64-4fd3-b689-3d0c88071001",
    "ownerType": "DISTRIBUTOR",
    "ownerUuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
    "name": "April Webinar Push",
    "utmSource": "facebook",
    "utmMedium": "paid-social",
    "utmCampaign": "april-webinar-push",
    "utmContent": "video-1",
    "isActive": true,
    "createdAt": "2026-04-01T04:30:00.000Z",
    "updatedAt": "2026-04-08T10:00:00.000Z",
    "owner": {
      "uuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
      "fullName": "Rudra Shah",
      "distributorCode": "NSI-RUDRA"
    },
    "generatedUrl": "https://growithnsi.com?utm_source=facebook&utm_medium=paid-social&utm_campaign=april-webinar-push&utm_content=video-1&ref=NSI-RUDRA"
  }
]
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a distributor |

**Endpoint:** `POST /api/v1/distributor/campaigns`  
**Auth:** Bearer token (`DISTRIBUTOR`)

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | Yes | Campaign display name |
| `utmSource` | string | Yes | UTM source |
| `utmMedium` | string | Yes | UTM medium |
| `utmCampaign` | string | Yes | UTM campaign slug |
| `utmContent` | string | No | UTM content variant |

**Success Response (201):**

```json
{
  "uuid": "adf73e3c-7f64-4fd3-b689-3d0c88071001",
  "ownerType": "DISTRIBUTOR",
  "ownerUuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
  "name": "April Webinar Push",
  "utmSource": "facebook",
  "utmMedium": "paid-social",
  "utmCampaign": "april-webinar-push",
  "utmContent": "video-1",
  "isActive": true,
  "createdAt": "2026-04-01T04:30:00.000Z",
  "updatedAt": "2026-04-01T04:30:00.000Z",
  "owner": {
    "uuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
    "fullName": "Rudra Shah",
    "distributorCode": "NSI-RUDRA"
  },
  "generatedUrl": "https://growithnsi.com?utm_source=facebook&utm_medium=paid-social&utm_campaign=april-webinar-push&utm_content=video-1&ref=NSI-RUDRA"
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Validation failed | Missing required string fields |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a distributor |
| 409 | Campaign with this UTM slug already exists | Same owner already has that `utmCampaign` |

**Endpoint:** `GET /api/v1/distributor/campaigns/:uuid`  
**Auth:** Bearer token (`DISTRIBUTOR`)

**Success Response (200):**

```json
{
  "uuid": "adf73e3c-7f64-4fd3-b689-3d0c88071001",
  "ownerType": "DISTRIBUTOR",
  "ownerUuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
  "name": "April Webinar Push",
  "utmSource": "facebook",
  "utmMedium": "paid-social",
  "utmCampaign": "april-webinar-push",
  "utmContent": "video-1",
  "isActive": true,
  "createdAt": "2026-04-01T04:30:00.000Z",
  "updatedAt": "2026-04-08T10:00:00.000Z",
  "owner": {
    "uuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
    "fullName": "Rudra Shah",
    "distributorCode": "NSI-RUDRA"
  },
  "generatedUrl": "https://growithnsi.com?utm_source=facebook&utm_medium=paid-social&utm_campaign=april-webinar-push&utm_content=video-1&ref=NSI-RUDRA",
  "analytics": {
    "clicks": 42,
    "signups": 19,
    "funnelCompletions": 8,
    "conversions": 3
  }
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a distributor |
| 404 | Campaign not found | UUID does not exist or is outside distributor ownership |

**Endpoint:** `GET /api/v1/distributor/campaigns/:uuid/edit`  
**Auth:** Bearer token (`DISTRIBUTOR`)

**Success Response (200):**

```json
{
  "name": "April Webinar Push",
  "utmSource": "facebook",
  "utmMedium": "paid-social",
  "utmCampaign": "april-webinar-push",
  "utmContent": "video-1",
  "isActive": true
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a distributor |
| 404 | Campaign not found | UUID does not exist or is outside distributor ownership |

**Endpoint:** `PATCH /api/v1/distributor/campaigns/:uuid`  
**Auth:** Bearer token (`DISTRIBUTOR`)

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | No | Updated campaign name |
| `utmSource` | string | No | Updated UTM source |
| `utmMedium` | string | No | Updated UTM medium |
| `utmCampaign` | string | No | Updated UTM campaign slug |
| `utmContent` | string | No | Updated content variant |
| `isActive` | boolean | No | Active toggle |

**Success Response (200):**

```json
{
  "uuid": "adf73e3c-7f64-4fd3-b689-3d0c88071001",
  "ownerType": "DISTRIBUTOR",
  "ownerUuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
  "name": "April Webinar Push - Retargeting",
  "utmSource": "facebook",
  "utmMedium": "retargeting",
  "utmCampaign": "april-webinar-retarget",
  "utmContent": "carousel-2",
  "isActive": true,
  "createdAt": "2026-04-01T04:30:00.000Z",
  "updatedAt": "2026-04-08T10:00:00.000Z",
  "owner": {
    "uuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
    "fullName": "Rudra Shah",
    "distributorCode": "NSI-RUDRA"
  },
  "generatedUrl": "https://growithnsi.com?utm_source=facebook&utm_medium=retargeting&utm_campaign=april-webinar-retarget&utm_content=carousel-2&ref=NSI-RUDRA"
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Validation failed | Invalid string or boolean fields |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a distributor |
| 404 | Campaign not found | UUID does not exist or is outside distributor ownership |
| 409 | Campaign with this UTM slug already exists | Updated slug conflicts with another owned campaign |

**Endpoint:** `DELETE /api/v1/distributor/campaigns/:uuid`  
**Auth:** Bearer token (`DISTRIBUTOR`)

**Success Response (200):**

```json
{
  "message": "Campaign deleted"
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a distributor |
| 404 | Campaign not found | UUID does not exist or is outside distributor ownership |

### 6.2 Admin Campaign List Page (`/admin/campaigns`)

- **Who sees it:** `SUPER_ADMIN` only.
- **On load:** `GET /admin/campaigns`.
- **User flow:** Admin reviews campaigns across all owners, edits any campaign, and optionally uses the same create/delete tools if the admin UI exposes them.
- **UI logic:** Same core list as distributor campaigns, but add owner info and owner type. This is the best place to spot inactive campaigns or bad tracking setups across the network.
- **Error handling:** Missing campaign detail/edit data should fall back to the list page with a toast. Conflicts still need inline editing feedback.
- **Navigation:** Edit/detail -> `/admin/campaigns/:uuid/edit` or `/admin/campaigns/:uuid`.

**API Contracts**

**Endpoint:** `GET /api/v1/admin/campaigns`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Success Response (200):**

```json
[
  {
    "uuid": "adf73e3c-7f64-4fd3-b689-3d0c88071001",
    "ownerType": "DISTRIBUTOR",
    "ownerUuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
    "name": "April Webinar Push",
    "utmSource": "facebook",
    "utmMedium": "paid-social",
    "utmCampaign": "april-webinar-push",
    "utmContent": "video-1",
    "isActive": true,
    "createdAt": "2026-04-01T04:30:00.000Z",
    "updatedAt": "2026-04-08T10:00:00.000Z",
    "owner": {
      "uuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
      "fullName": "Rudra Shah",
      "distributorCode": "NSI-RUDRA"
    },
    "generatedUrl": "https://growithnsi.com?utm_source=facebook&utm_medium=paid-social&utm_campaign=april-webinar-push&utm_content=video-1&ref=NSI-RUDRA"
  },
  {
    "uuid": "4e413224-fc9e-4135-a035-2d5dd2471001",
    "ownerType": "ADMIN",
    "ownerUuid": "cb5ea280-16d9-4d87-9d1f-95dc0db61001",
    "name": "Organic SEO Landing",
    "utmSource": "google",
    "utmMedium": "organic",
    "utmCampaign": "seo-kangen-benefits",
    "utmContent": null,
    "isActive": true,
    "createdAt": "2026-03-25T06:00:00.000Z",
    "updatedAt": "2026-03-25T06:00:00.000Z",
    "owner": {
      "uuid": "cb5ea280-16d9-4d87-9d1f-95dc0db61001",
      "fullName": "Nageshwar Shukla",
      "distributorCode": null
    },
    "generatedUrl": "https://growithnsi.com?utm_source=google&utm_medium=organic&utm_campaign=seo-kangen-benefits"
  }
]
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |

**Endpoint:** `GET /api/v1/admin/campaigns/:uuid`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Success Response (200):**

```json
{
  "uuid": "adf73e3c-7f64-4fd3-b689-3d0c88071001",
  "ownerType": "DISTRIBUTOR",
  "ownerUuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
  "name": "April Webinar Push",
  "utmSource": "facebook",
  "utmMedium": "paid-social",
  "utmCampaign": "april-webinar-push",
  "utmContent": "video-1",
  "isActive": true,
  "createdAt": "2026-04-01T04:30:00.000Z",
  "updatedAt": "2026-04-08T10:00:00.000Z",
  "owner": {
    "uuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
    "fullName": "Rudra Shah",
    "distributorCode": "NSI-RUDRA"
  },
  "generatedUrl": "https://growithnsi.com?utm_source=facebook&utm_medium=paid-social&utm_campaign=april-webinar-push&utm_content=video-1&ref=NSI-RUDRA",
  "analytics": {
    "clicks": 42,
    "signups": 19,
    "funnelCompletions": 8,
    "conversions": 3
  }
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | Campaign not found | UUID does not resolve to a campaign |

**Endpoint:** `GET /api/v1/admin/campaigns/:uuid/edit`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Success Response (200):**

```json
{
  "name": "April Webinar Push",
  "utmSource": "facebook",
  "utmMedium": "paid-social",
  "utmCampaign": "april-webinar-push",
  "utmContent": "video-1",
  "isActive": true
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | Campaign not found | UUID does not resolve to a campaign |

**Endpoint:** `PATCH /api/v1/admin/campaigns/:uuid`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | No | Updated campaign name |
| `utmSource` | string | No | Updated UTM source |
| `utmMedium` | string | No | Updated UTM medium |
| `utmCampaign` | string | No | Updated UTM campaign slug |
| `utmContent` | string | No | Updated content variant |
| `isActive` | boolean | No | Active toggle |

**Success Response (200):**

```json
{
  "uuid": "4e413224-fc9e-4135-a035-2d5dd2471001",
  "ownerType": "ADMIN",
  "ownerUuid": "cb5ea280-16d9-4d87-9d1f-95dc0db61001",
  "name": "Organic SEO Landing",
  "utmSource": "google",
  "utmMedium": "organic",
  "utmCampaign": "seo-kangen-benefits",
  "utmContent": "article-a",
  "isActive": true,
  "createdAt": "2026-03-25T06:00:00.000Z",
  "updatedAt": "2026-04-11T06:00:00.000Z",
  "owner": {
    "uuid": "cb5ea280-16d9-4d87-9d1f-95dc0db61001",
    "fullName": "Nageshwar Shukla",
    "distributorCode": null
  },
  "generatedUrl": "https://growithnsi.com?utm_source=google&utm_medium=organic&utm_campaign=seo-kangen-benefits&utm_content=article-a"
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Validation failed | Invalid string or boolean fields |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | Campaign not found | UUID does not resolve to a campaign |
| 409 | Campaign with this UTM slug already exists | Updated slug conflicts with another campaign owned by the same owner |

---

## Section 7 - Lead Management Pages

### 7.1 Distributor Lead List Page (`/distributor/leads`)

- **Who sees it:** `DISTRIBUTOR` only.
- **On load:** `GET /leads`.
- **User flow:** User filters/searches leads, opens the action dropdown built from `availableActions`, and updates status through `PATCH /leads/:uuid/status`.
- **UI logic:** Always show `displayStatus`, not raw status labels. Build status-action menus dynamically from `availableActions`; do not hardcode transitions. When moving to `FOLLOWUP`, require notes plus a future datetime before submit.
- **Error handling:** Invalid transition, missing follow-up data, or ownership errors should keep the row on screen and show an actionable message. If a lead disappears because of scoping changes, refresh the list and show that it is no longer available.
- **Navigation:** Lead click -> `/distributor/leads/:uuid`.

**API Contracts**

**Endpoint:** `GET /api/v1/leads`  
**Auth:** Bearer token (`DISTRIBUTOR`)

**Query Params:**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | string | No | Filter by raw lead status |
| `search` | string | No | Search by user name, email, or phone |
| `page` | number | No | Page number, default `1` |
| `limit` | number | No | Page size, default `20` |

**Success Response (200):**

```json
{
  "items": [
    {
      "uuid": "d4f7c7d5-cfcb-4607-9bb9-7bc61fa71001",
      "userUuid": "7a9c2db6-ef87-4a62-b67f-ec1c28251001",
      "assignedToUuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
      "distributorUuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
      "status": "HOT",
      "phone": "+919876543210",
      "createdAt": "2026-04-02T07:31:00.000Z",
      "updatedAt": "2026-04-10T13:00:00.000Z",
      "user": {
        "uuid": "7a9c2db6-ef87-4a62-b67f-ec1c28251001",
        "fullName": "Rajesh Patel",
        "email": "rajesh.patel@example.com",
        "country": "India",
        "avatarUrl": "https://res.cloudinary.com/nsi/image/upload/v1712800/avatar-rajesh.jpg"
      },
      "displayStatus": "HOT"
    }
  ],
  "total": 19,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a distributor |

**Endpoint:** `PATCH /api/v1/leads/:uuid/status`  
**Auth:** Bearer token (`DISTRIBUTOR`)

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | enum | Yes | One of `CONTACTED`, `FOLLOWUP`, `MARK_AS_CUSTOMER`, `LOST` |
| `notes` | string | No | Required in practice when moving to `FOLLOWUP` |
| `followupAt` | ISO datetime string | No | Required when `status=FOLLOWUP`; must be in the future |

**Success Response (200):**

```json
{
  "uuid": "d4f7c7d5-cfcb-4607-9bb9-7bc61fa71001",
  "userUuid": "7a9c2db6-ef87-4a62-b67f-ec1c28251001",
  "assignedToUuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
  "distributorUuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
  "status": "FOLLOWUP",
  "phone": "+919876543210",
  "createdAt": "2026-04-02T07:31:00.000Z",
  "updatedAt": "2026-04-11T06:45:00.000Z",
  "user": {
    "uuid": "7a9c2db6-ef87-4a62-b67f-ec1c28251001",
    "fullName": "Rajesh Patel",
    "email": "rajesh.patel@example.com",
    "country": "India",
    "avatarUrl": "https://res.cloudinary.com/nsi/image/upload/v1712800/avatar-rajesh.jpg"
  },
  "assignedTo": {
    "uuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
    "fullName": "Rudra Shah"
  },
  "displayStatus": "FOLLOWUP"
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Notes are required when scheduling a followup | `status=FOLLOWUP` without notes |
| 400 | followupAt is required when status is FOLLOWUP | `status=FOLLOWUP` without date |
| 400 | followupAt must be in the future | Submitted follow-up timestamp is not in the future |
| 400 | Cannot change status. Lead must reach HOT status first before manual management is allowed. | Current lead state does not allow that transition |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Access denied | Lead is not assigned to the current distributor |
| 403 | Forbidden resource | User is authenticated but not a distributor |
| 404 | Lead not found | Lead UUID does not exist |

### 7.2 Admin Lead List Page (`/admin/leads`)

- **Who sees it:** `SUPER_ADMIN` only.
- **On load:** `GET /admin/leads`. If a distributor filter is selected, use `GET /admin/leads/distributor/:distributorUuid`.
- **User flow:** Admin searches, filters by status, optionally filters by distributor, then updates lead status or opens detail.
- **UI logic:** Keep distributor filter and status filter in the URL so the page is shareable. Admin uses the same transition logic as distributor, so the dropdown should still be constrained by backend rules.
- **Error handling:** Bad filters should not break the page. If distributor-scoped results are empty, show "No leads for this distributor" instead of a generic empty state.
- **Navigation:** Lead click -> `/admin/leads/:uuid`.

**API Contracts**

**Endpoint:** `GET /api/v1/admin/leads`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Query Params:**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | string | No | Filter by raw lead status |
| `search` | string | No | Search by user name, email, or phone |
| `page` | number | No | Page number, default `1` |
| `limit` | number | No | Page size, default `20` |

**Success Response (200):**

```json
{
  "items": [
    {
      "uuid": "3b755347-bcc8-4e14-b532-85cd86ae1001",
      "userUuid": "1d7f3b28-3dda-4424-8a95-8b12829a1001",
      "assignedToUuid": "cb5ea280-16d9-4d87-9d1f-95dc0db61001",
      "distributorUuid": null,
      "status": "FOLLOWUP",
      "phone": "+919912345678",
      "createdAt": "2026-04-03T08:30:00.000Z",
      "updatedAt": "2026-04-10T10:00:00.000Z",
      "user": {
        "uuid": "1d7f3b28-3dda-4424-8a95-8b12829a1001",
        "fullName": "Mihir Patel",
        "email": "mihir@example.com",
        "country": "India",
        "avatarUrl": null
      },
      "assignedTo": {
        "uuid": "cb5ea280-16d9-4d87-9d1f-95dc0db61001",
        "fullName": "Nageshwar Shukla"
      },
      "displayStatus": "FOLLOWUP"
    }
  ],
  "total": 31,
  "page": 1,
  "limit": 20,
  "totalPages": 2
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |

**Endpoint:** `GET /api/v1/admin/leads/distributor/:distributorUuid`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Query Params:**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | string | No | Filter by raw lead status |
| `search` | string | No | Search by user name, email, or phone |
| `page` | number | No | Page number, default `1` |
| `limit` | number | No | Page size, default `20` |

**Success Response (200):**

```json
{
  "items": [
    {
      "uuid": "d4f7c7d5-cfcb-4607-9bb9-7bc61fa71001",
      "userUuid": "7a9c2db6-ef87-4a62-b67f-ec1c28251001",
      "assignedToUuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
      "distributorUuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
      "status": "HOT",
      "phone": "+919876543210",
      "createdAt": "2026-04-02T07:31:00.000Z",
      "updatedAt": "2026-04-10T13:00:00.000Z",
      "user": {
        "uuid": "7a9c2db6-ef87-4a62-b67f-ec1c28251001",
        "fullName": "Rajesh Patel",
        "email": "rajesh.patel@example.com",
        "country": "India",
        "avatarUrl": "https://res.cloudinary.com/nsi/image/upload/v1712800/avatar-rajesh.jpg"
      },
      "assignedTo": {
        "uuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
        "fullName": "Rudra Shah"
      },
      "displayStatus": "HOT"
    }
  ],
  "total": 19,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |

**Endpoint:** `PATCH /api/v1/admin/leads/:uuid/status`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | enum | Yes | One of `CONTACTED`, `FOLLOWUP`, `MARK_AS_CUSTOMER`, `LOST` |
| `notes` | string | No | Required in practice when moving to `FOLLOWUP` |
| `followupAt` | ISO datetime string | No | Required when `status=FOLLOWUP`; must be in the future |

**Success Response (200):**

```json
{
  "uuid": "3b755347-bcc8-4e14-b532-85cd86ae1001",
  "userUuid": "1d7f3b28-3dda-4424-8a95-8b12829a1001",
  "assignedToUuid": "cb5ea280-16d9-4d87-9d1f-95dc0db61001",
  "distributorUuid": null,
  "status": "MARK_AS_CUSTOMER",
  "phone": "+919912345678",
  "createdAt": "2026-04-03T08:30:00.000Z",
  "updatedAt": "2026-04-11T07:10:00.000Z",
  "user": {
    "uuid": "1d7f3b28-3dda-4424-8a95-8b12829a1001",
    "fullName": "Mihir Patel",
    "email": "mihir@example.com",
    "country": "India",
    "avatarUrl": null
  },
  "assignedTo": {
    "uuid": "cb5ea280-16d9-4d87-9d1f-95dc0db61001",
    "fullName": "Nageshwar Shukla"
  },
  "displayStatus": "CUSTOMER"
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Notes are required when scheduling a followup | `status=FOLLOWUP` without notes |
| 400 | followupAt is required when status is FOLLOWUP | `status=FOLLOWUP` without date |
| 400 | followupAt must be in the future | Submitted follow-up timestamp is not in the future |
| 400 | Cannot change status. Lead must reach HOT status first before manual management is allowed. | Current lead state does not allow that transition |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | This lead belongs to a distributor. Only the distributor can update its status. | Admin tried to update a distributor-owned lead |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | Lead not found | Lead UUID does not exist |

### 7.3 Lead Detail Page (`/distributor/leads/:uuid`, `/admin/leads/:uuid`)

- **Who sees it:** Distributor for own leads, admin for any lead.
- **On load:** Call the role-appropriate detail endpoint: `GET /leads/:uuid` or `GET /admin/leads/:uuid`.
- **User flow:** User reviews profile, funnel progress, payment history, activity timeline, and scheduled follow-ups. Status changes happen from the detail header as well.
- **UI logic:** Show funnel progress clearly, highlight latest activity, and expose follow-up scheduling when applicable. If detail is opened from a list, keep a back path to the filtered list state.
- **Error handling:** `403` on distributor detail should return to `/distributor/leads` with a permissions message. `404` should show a not-found state, not a blank panel.
- **Navigation:** Back to list, or jump to related follow-up/task views.

**API Contracts**

**Endpoint:** `GET /api/v1/leads/:uuid`  
**Auth:** Bearer token (`DISTRIBUTOR`)

**Success Response (200):**

```json
{
  "uuid": "d4f7c7d5-cfcb-4607-9bb9-7bc61fa71001",
  "userUuid": "7a9c2db6-ef87-4a62-b67f-ec1c28251001",
  "assignedToUuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
  "distributorUuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
  "status": "FOLLOWUP",
  "phone": "+919876543210",
  "createdAt": "2026-04-02T07:31:00.000Z",
  "updatedAt": "2026-04-10T13:00:00.000Z",
  "user": {
    "uuid": "7a9c2db6-ef87-4a62-b67f-ec1c28251001",
    "fullName": "Rajesh Patel",
    "email": "rajesh.patel@example.com",
    "country": "India",
    "avatarUrl": "https://res.cloudinary.com/nsi/image/upload/v1712800/avatar-rajesh.jpg"
  },
  "activities": [
    {
      "uuid": "cccf4175-f73a-45da-a89e-f8261a191001",
      "leadUuid": "d4f7c7d5-cfcb-4607-9bb9-7bc61fa71001",
      "actorUuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
      "fromStatus": "HOT",
      "toStatus": "FOLLOWUP",
      "action": "FOLLOWUP_SCHEDULED",
      "notes": "Asked to call back after salary date.",
      "followupAt": "2026-04-11T11:00:00.000Z",
      "createdAt": "2026-04-10T13:00:00.000Z",
      "actor": {
        "uuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
        "fullName": "Rudra Shah"
      }
    }
  ],
  "displayStatus": "FOLLOWUP",
  "funnelProgress": {
    "phoneVerified": true,
    "paymentCompleted": true,
    "decisionAnswer": "YES",
    "completedSteps": 3,
    "totalSteps": 4,
    "currentStepUuid": "c31c5eb7-8847-4f9a-99cc-7c911f321001"
  }
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Access denied | Lead is not assigned to the current distributor |
| 403 | Forbidden resource | User is authenticated but not a distributor |
| 404 | Lead not found | Lead UUID does not exist |

**Endpoint:** `GET /api/v1/admin/leads/:uuid`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Success Response (200):**

```json
{
  "uuid": "3b755347-bcc8-4e14-b532-85cd86ae1001",
  "userUuid": "1d7f3b28-3dda-4424-8a95-8b12829a1001",
  "assignedToUuid": "cb5ea280-16d9-4d87-9d1f-95dc0db61001",
  "distributorUuid": null,
  "status": "FOLLOWUP",
  "phone": "+919912345678",
  "createdAt": "2026-04-03T08:30:00.000Z",
  "updatedAt": "2026-04-10T10:00:00.000Z",
  "user": {
    "uuid": "1d7f3b28-3dda-4424-8a95-8b12829a1001",
    "fullName": "Mihir Patel",
    "email": "mihir@example.com",
    "country": "India",
    "avatarUrl": null
  },
  "assignedTo": {
    "uuid": "cb5ea280-16d9-4d87-9d1f-95dc0db61001",
    "fullName": "Nageshwar Shukla"
  },
  "distributor": null,
  "activities": [
    {
      "uuid": "b3b96f87-4a4c-4fba-98da-0f21c6d71001",
      "leadUuid": "3b755347-bcc8-4e14-b532-85cd86ae1001",
      "actorUuid": "cb5ea280-16d9-4d87-9d1f-95dc0db61001",
      "fromStatus": "HOT",
      "toStatus": "FOLLOWUP",
      "action": "FOLLOWUP_SCHEDULED",
      "notes": "Asked to revisit after weekend demo.",
      "followupAt": "2026-04-11T09:00:00.000Z",
      "createdAt": "2026-04-10T10:00:00.000Z",
      "actor": {
        "uuid": "cb5ea280-16d9-4d87-9d1f-95dc0db61001",
        "fullName": "Nageshwar Shukla"
      }
    }
  ],
  "nurtureEnrollment": {
    "uuid": "9bc1788b-36f3-4033-8f00-8b1ae5191001",
    "userUuid": "1d7f3b28-3dda-4424-8a95-8b12829a1001",
    "leadUuid": "3b755347-bcc8-4e14-b532-85cd86ae1001",
    "status": "ACTIVE",
    "day1SentAt": "2026-04-05T04:00:00.000Z",
    "day3SentAt": null,
    "day7SentAt": null,
    "nextEmailAt": "2026-04-08T04:00:00.000Z",
    "createdAt": "2026-04-05T03:59:00.000Z",
    "updatedAt": "2026-04-05T04:00:00.000Z"
  },
  "displayStatus": "FOLLOWUP",
  "funnelProgress": {
    "phoneVerified": true,
    "paymentCompleted": true,
    "decisionAnswer": "NO",
    "completedSteps": 4,
    "totalSteps": 4,
    "currentStepUuid": null
  },
  "payments": [
    {
      "uuid": "2c2855ef-6fb2-46bd-9505-a4ad0b5b1001",
      "amount": 999,
      "finalAmount": 999,
      "currency": "INR",
      "status": "SUCCESS",
      "paymentType": "COMMITMENT_FEE",
      "createdAt": "2026-04-04T08:00:00.000Z"
    }
  ]
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | Lead not found | Lead UUID does not exist |

### 7.4 Today's Follow-ups Page (`/distributor/followups/today`, `/admin/followups/today`)

- **Who sees it:** Distributor or admin, depending on shell.
- **On load:** Distributor shell -> `GET /leads/followups/today`. Admin shell -> `GET /admin/leads/followups/today`.
- **User flow:** User reviews all leads needing action today, updates status quickly, or opens lead detail.
- **UI logic:** This page should behave like an action queue. Group overdue vs due-today if the product wants urgency cues.
- **Error handling:** If the endpoint fails, keep the page simple with a retry CTA. Empty state should say there are no follow-ups due today.
- **Navigation:** Quick action -> status patch in place. Detail -> corresponding lead detail route.

**API Contracts**

**Endpoint:** `GET /api/v1/leads/followups/today`  
**Auth:** Bearer token (`DISTRIBUTOR`)

**Success Response (200):**

```json
[
  {
    "uuid": "d4f7c7d5-cfcb-4607-9bb9-7bc61fa71001",
    "userUuid": "7a9c2db6-ef87-4a62-b67f-ec1c28251001",
    "assignedToUuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
    "distributorUuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
    "status": "FOLLOWUP",
    "phone": "+919876543210",
    "createdAt": "2026-04-02T07:31:00.000Z",
    "updatedAt": "2026-04-10T13:00:00.000Z",
    "user": {
      "uuid": "7a9c2db6-ef87-4a62-b67f-ec1c28251001",
      "fullName": "Rajesh Patel",
      "email": "rajesh.patel@example.com",
      "country": "India",
      "avatarUrl": "https://res.cloudinary.com/nsi/image/upload/v1712800/avatar-rajesh.jpg"
    },
    "activities": [
      {
        "uuid": "cccf4175-f73a-45da-a89e-f8261a191001",
        "leadUuid": "d4f7c7d5-cfcb-4607-9bb9-7bc61fa71001",
        "actorUuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
        "fromStatus": "HOT",
        "toStatus": "FOLLOWUP",
        "action": "FOLLOWUP_SCHEDULED",
        "notes": "Asked to call back after salary date.",
        "followupAt": "2026-04-11T11:00:00.000Z",
        "createdAt": "2026-04-10T13:00:00.000Z"
      }
    ],
    "displayStatus": "FOLLOWUP"
  }
]
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a distributor |

**Endpoint:** `GET /api/v1/admin/leads/followups/today`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Success Response (200):**

```json
[
  {
    "uuid": "3b755347-bcc8-4e14-b532-85cd86ae1001",
    "userUuid": "1d7f3b28-3dda-4424-8a95-8b12829a1001",
    "assignedToUuid": "cb5ea280-16d9-4d87-9d1f-95dc0db61001",
    "distributorUuid": null,
    "status": "FOLLOWUP",
    "phone": "+919912345678",
    "createdAt": "2026-04-03T08:30:00.000Z",
    "updatedAt": "2026-04-10T10:00:00.000Z",
    "user": {
      "uuid": "1d7f3b28-3dda-4424-8a95-8b12829a1001",
      "fullName": "Mihir Patel",
      "email": "mihir@example.com",
      "country": "India",
      "avatarUrl": null
    },
    "assignedTo": {
      "uuid": "cb5ea280-16d9-4d87-9d1f-95dc0db61001",
      "fullName": "Nageshwar Shukla"
    },
    "activities": [
      {
        "uuid": "b3b96f87-4a4c-4fba-98da-0f21c6d71001",
        "leadUuid": "3b755347-bcc8-4e14-b532-85cd86ae1001",
        "actorUuid": "cb5ea280-16d9-4d87-9d1f-95dc0db61001",
        "fromStatus": "HOT",
        "toStatus": "FOLLOWUP",
        "action": "FOLLOWUP_SCHEDULED",
        "notes": "Asked to revisit after weekend demo.",
        "followupAt": "2026-04-11T09:00:00.000Z",
        "createdAt": "2026-04-10T10:00:00.000Z"
      }
    ],
    "displayStatus": "FOLLOWUP"
  }
]
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |

---

## Section 8 - Admin Pages

### 8.1 Admin Dashboard Page (`/admin/dashboard`)

- **Who sees it:** `SUPER_ADMIN` only.
- **On load:** `GET /admin/analytics/dashboard`.
- **User flow:** Admin reviews top KPIs and jumps into users, leads, analytics, courses, distributor management, or funnel CMS.
- **UI logic:** Show cards for total users, leads, revenue, active distributors, and conversion metrics. Keep quick links prominent because this page is the admin shell entry point.
- **Error handling:** Partial-card loading is better than a total blank page. If the user is no longer a super admin, redirect out immediately.
- **Navigation:** Quick links -> `/admin/users`, `/admin/leads`, `/admin/analytics`, `/admin/courses`, `/admin/funnel`, `/admin/distributors`.

**API Contracts**

**Endpoint:** `GET /api/v1/admin/analytics/dashboard`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Query Params:**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `from` | ISO date string | No | Inclusive start date |
| `to` | ISO date string | No | Inclusive end date |

**Success Response (200):**

```json
{
  "overview": {
    "totalUsers": 1284,
    "totalUsersGrowth": 14.2,
    "phoneVerified": 812,
    "paymentsCompleted": 304,
    "hotLeads": 117,
    "hotLeadsGrowth": 9.1,
    "customers": 86,
    "customersGrowth": 6.4,
    "distributors": 42,
    "distributorsGrowth": 3.7,
    "machinesSold": 86
  },
  "decisionSplit": {
    "yes": 54,
    "no": 31,
    "yesPercent": 63.53
  },
  "funnelStages": [
    {
      "stage": "REGISTERED",
      "count": 1284
    },
    {
      "stage": "PHONE_VERIFIED",
      "count": 812
    },
    {
      "stage": "PAYMENT_COMPLETED",
      "count": 304
    },
    {
      "stage": "SAID_YES",
      "count": 54
    }
  ]
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | from date must be before to date | `from` is later than `to` |
| 400 | Maximum date range is 5 years | Requested range exceeds backend limit |
| 400 | Validation failed | Invalid date query params |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |

### 8.2 Admin Users Page (`/admin/users`)

- **Who sees it:** `SUPER_ADMIN` only.
- **On load:** `GET /admin/users`.
- **User flow:** Admin filters/searches the user table, opens user detail, suspends/reactivates users, and changes role where allowed.
- **UI logic:** Show name, email, role, status, referred-by context, funnel summary, and key lifecycle badges. Role change UI must not offer `SUPER_ADMIN` or direct assignment to `DISTRIBUTOR`.
- **Special warning logic:** If changing from `DISTRIBUTOR` to another role, show a confirmation that the backend will cancel the active distributor subscription and deactivate the join link.
- **Error handling:** Suspension/reactivation failures should leave the row unchanged. Role change failures should keep the select open with the backend reason visible.
- **Navigation:** Detail click -> `/admin/users/:uuid`.

**API Contracts**

**Endpoint:** `GET /api/v1/admin/users`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Query Params:**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `role` | string | No | Filter by role |
| `status` | string | No | Filter by account status |
| `country` | string | No | Filter by country |
| `search` | string | No | Search by name or email |
| `page` | number | No | Page number, default `1` |
| `limit` | number | No | Page size, default `20` |

**Success Response (200):**

```json
{
  "items": [
    {
      "uuid": "1d7f3b28-3dda-4424-8a95-8b12829a1001",
      "fullName": "Mihir Patel",
      "email": "mihir@example.com",
      "avatarUrl": null,
      "role": "CUSTOMER",
      "status": "ACTIVE",
      "country": "India",
      "createdAt": "2026-04-03T08:00:00.000Z",
      "suspendedAt": null,
      "phone": "+919912345678",
      "phoneVerified": true,
      "paymentCompleted": true,
      "funnelProgress": {
        "completedSteps": 4,
        "totalSteps": 4
      },
      "leadStatus": "MARK_AS_CUSTOMER",
      "referredBy": {
        "type": "DIRECT",
        "distributorName": null,
        "distributorCode": null
      }
    },
    {
      "uuid": "7a9c2db6-ef87-4a62-b67f-ec1c28251001",
      "fullName": "Rajesh Patel",
      "email": "rajesh.patel@example.com",
      "avatarUrl": "https://res.cloudinary.com/nsi/image/upload/v1712800/avatar-rajesh.jpg",
      "role": "USER",
      "status": "ACTIVE",
      "country": "India",
      "createdAt": "2026-04-01T08:00:00.000Z",
      "suspendedAt": null,
      "phone": "+919876543210",
      "phoneVerified": true,
      "paymentCompleted": true,
      "funnelProgress": {
        "completedSteps": 3,
        "totalSteps": 4
      },
      "leadStatus": "HOT",
      "referredBy": {
        "type": "DISTRIBUTOR",
        "distributorName": "Rudra Shah",
        "distributorCode": "NSI-RUDRA"
      }
    }
  ],
  "total": 245,
  "page": 1,
  "limit": 20,
  "totalPages": 13
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |

**Endpoint:** `GET /api/v1/admin/users/:uuid`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Success Response (200):**

```json
{
  "uuid": "7a9c2db6-ef87-4a62-b67f-ec1c28251001",
  "fullName": "Rajesh Patel",
  "email": "rajesh.patel@example.com",
  "avatarUrl": "https://res.cloudinary.com/nsi/image/upload/v1712800/avatar-rajesh.jpg",
  "role": "USER",
  "status": "ACTIVE",
  "country": "India",
  "createdAt": "2026-04-01T08:00:00.000Z",
  "suspendedAt": null,
  "phone": "+919876543210",
  "phoneVerified": true,
  "paymentCompleted": true,
  "funnelProgress": {
    "completedSteps": 3,
    "totalSteps": 4
  },
  "leadStatus": "HOT",
  "paymentHistory": [
    {
      "uuid": "c8cab86d-c17a-47a0-b0a1-1cd604101001",
      "amount": 999,
      "finalAmount": 799,
      "currency": "INR",
      "status": "SUCCESS",
      "paymentType": "COMMITMENT_FEE",
      "createdAt": "2026-04-02T07:30:00.000Z"
    }
  ],
  "funnelStepProgress": [
    {
      "stepUuid": "19c69d0b-87b6-458b-befb-d85f82811001",
      "stepType": "VIDEO_TEXT",
      "stepOrder": 1,
      "isCompleted": true,
      "watchedSeconds": 643,
      "completedAt": "2026-04-02T06:40:00.000Z"
    },
    {
      "stepUuid": "8b3f048d-ef1f-4a91-b4f9-758d42441001",
      "stepType": "PHONE_GATE",
      "stepOrder": 2,
      "isCompleted": true,
      "watchedSeconds": 0,
      "completedAt": "2026-04-02T07:00:00.000Z"
    }
  ],
  "leadDetail": {
    "uuid": "d4f7c7d5-cfcb-4607-9bb9-7bc61fa71001",
    "status": "HOT",
    "createdAt": "2026-04-02T07:31:00.000Z",
    "lastActivityAt": "2026-04-10T13:00:00.000Z",
    "lastActivityNote": "Asked to call back after salary date."
  },
  "referredBy": {
    "type": "DISTRIBUTOR",
    "distributorName": "Rudra Shah",
    "distributorCode": "NSI-RUDRA"
  },
  "lmsProgress": [
    {
      "courseUuid": "4fd2d086-5fc2-49ae-bba1-bf36b5ab1001",
      "courseTitle": "Kangen Water Business Masterclass",
      "enrolledAt": "2026-04-05T09:00:00.000Z",
      "completedAt": null,
      "progress": 38,
      "certificateUrl": null
    }
  ],
  "activeSessions": 2
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | User not found | User UUID does not exist |

**Endpoint:** `PATCH /api/v1/admin/users/:uuid/suspend`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Request Body:** No JSON body required.

**Success Response (200):**

```json
{
  "message": "User suspended successfully"
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | User is already suspended | Target user already has `SUSPENDED` status |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Cannot suspend a Super Admin account | Attempted to suspend a super admin |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | User not found | User UUID does not exist |

**Endpoint:** `PATCH /api/v1/admin/users/:uuid/reactivate`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Request Body:** No JSON body required.

**Success Response (200):**

```json
{
  "message": "User reactivated successfully",
  "note": "Account reactivated. User must re-subscribe to restore Distributor access."
}
```

**Alternate Success Response (200) - no distributor subscription note:**

```json
{
  "message": "User reactivated successfully",
  "note": null
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | User is not suspended | Target user is not currently suspended |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | User not found | User UUID does not exist |

**Endpoint:** `PATCH /api/v1/admin/users/:uuid/role`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `role` | enum | Yes | One of `USER`, `CUSTOMER`, `ADMIN` |

**Success Response (200):**

```json
{
  "message": "User role updated successfully"
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Role must be one of: USER, CUSTOMER, ADMIN. Distributor role can only be granted via subscription payment. | Request body contains an unsupported role |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Cannot assign Super Admin role via API | Request tried to assign `SUPER_ADMIN` |
| 403 | Distributor role can only be granted via subscription payment. Use the subscription management panel instead. | Request tried to assign `DISTRIBUTOR` |
| 403 | Cannot change role of a Super Admin | Target user is already a super admin |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | User not found | User UUID does not exist |

### 8.3 Admin Analytics Page (`/admin/analytics`)

- **Who sees it:** `SUPER_ADMIN` only.
- **On load:** Default tab should call one of the analytics endpoints immediately, usually `GET /admin/analytics/dashboard`.
- **User flow:** Admin switches between Dashboard, Funnel, Revenue, Leads, Distributors, and UTM tabs. Each tab loads its own endpoint on demand.
- **UI logic:** Keep one shared date-range control for all tabs so the admin can compare like-for-like periods. Only fetch a tab when it becomes active unless the dashboard needs parallel preloading.
- **Error handling:** A failed tab should not crash the others. Preserve the selected date range and tab on retry.
- **Navigation:** Drill-down CTAs should move into `/admin/leads`, `/admin/distributors`, `/admin/campaigns`, `/admin/courses`.

**API Contracts**

**Endpoint:** `GET /api/v1/admin/analytics/dashboard`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Query Params:**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `from` | ISO date string | No | Inclusive start date |
| `to` | ISO date string | No | Inclusive end date |

**Success Response (200):**

```json
{
  "overview": {
    "totalUsers": 1284,
    "totalUsersGrowth": 14.2,
    "phoneVerified": 812,
    "paymentsCompleted": 304,
    "hotLeads": 117,
    "hotLeadsGrowth": 9.1,
    "customers": 86,
    "customersGrowth": 6.4,
    "distributors": 42,
    "distributorsGrowth": 3.7,
    "machinesSold": 86
  },
  "decisionSplit": {
    "yes": 54,
    "no": 31,
    "yesPercent": 63.53
  },
  "funnelStages": [
    {
      "stage": "REGISTERED",
      "count": 1284
    },
    {
      "stage": "PHONE_VERIFIED",
      "count": 812
    },
    {
      "stage": "PAYMENT_COMPLETED",
      "count": 304
    },
    {
      "stage": "SAID_YES",
      "count": 54
    }
  ]
}
```

**Endpoint:** `GET /api/v1/admin/analytics/funnel`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Query Params:** Same `from` / `to` date filters as dashboard.

**Success Response (200):**

```json
{
  "grouping": "month",
  "stages": [
    {
      "stage": "REGISTERED",
      "count": 1284,
      "dropoffFromPrevious": 0,
      "dropoffPercent": 0,
      "conversionFromStart": 100
    },
    {
      "stage": "PHONE_VERIFIED",
      "count": 812,
      "dropoffFromPrevious": 472,
      "dropoffPercent": 36.76,
      "conversionFromStart": 63.24
    },
    {
      "stage": "PAYMENT_COMPLETED",
      "count": 304,
      "dropoffFromPrevious": 508,
      "dropoffPercent": 62.56,
      "conversionFromStart": 23.68
    }
  ]
}
```

**Endpoint:** `GET /api/v1/admin/analytics/revenue`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Query Params:** Same `from` / `to` date filters as dashboard.

**Success Response (200):**

```json
{
  "totalRevenue": 824300,
  "totalRevenueGrowth": 11.8,
  "byType": {
    "commitmentFee": 214785,
    "lmsCourse": 137540,
    "distributorSubscription": 471975
  },
  "byCountry": [
    {
      "country": "India",
      "revenue": 771200
    },
    {
      "country": "UAE",
      "revenue": 53100
    }
  ],
  "grouping": "month",
  "chart": [
    {
      "period": "2026-02",
      "revenue": 219800
    },
    {
      "period": "2026-03",
      "revenue": 264500
    },
    {
      "period": "2026-04",
      "revenue": 340000
    }
  ]
}
```

**Endpoint:** `GET /api/v1/admin/analytics/leads`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Query Params:** Same `from` / `to` date filters as dashboard.

**Success Response (200):**

```json
{
  "totalLeads": 412,
  "byStatus": {
    "new": 109,
    "warm": 71,
    "hot": 117,
    "contacted": 36,
    "followup": 29,
    "nurture": 18,
    "lost": 21,
    "converted": 11
  },
  "bySource": {
    "direct": 223,
    "viaDistributor": 189
  },
  "todayFollowups": 14,
  "grouping": "week",
  "chart": [
    {
      "period": "2026-W13",
      "newLeads": 38,
      "converted": 4
    },
    {
      "period": "2026-W14",
      "newLeads": 41,
      "converted": 5
    }
  ]
}
```

**Endpoint:** `GET /api/v1/admin/analytics/distributors`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Query Params:** Same `from` / `to` date filters as dashboard.

**Success Response (200):**

```json
{
  "totalDistributors": 42,
  "activeThisMonth": 27,
  "avgLeadsPerDistributor": 14.1,
  "avgConversionRate": 8.7,
  "topDistributors": [
    {
      "uuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
      "fullName": "Rudra Shah",
      "distributorCode": "NSI-RUDRA",
      "totalLeads": 84,
      "convertedLeads": 7,
      "conversionRate": 8.33
    }
  ],
  "funnelPath": [
    {
      "stage": "NEW",
      "count": 74
    },
    {
      "stage": "HOT",
      "count": 33
    },
    {
      "stage": "MARK_AS_CUSTOMER",
      "count": 11
    }
  ]
}
```

**Endpoint:** `GET /api/v1/admin/analytics/utm`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Query Params:**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `from` | ISO date string | No | Inclusive start date |
| `to` | ISO date string | No | Inclusive end date |
| `distributorUuid` | UUID | No | Filter analytics to a specific distributor |

**Success Response (200):**

```json
{
  "bySource": [
    {
      "source": "facebook",
      "leads": 39
    },
    {
      "source": "google",
      "leads": 28
    }
  ],
  "byMedium": [
    {
      "medium": "paid-social",
      "leads": 39
    },
    {
      "medium": "organic",
      "leads": 28
    }
  ],
  "byCampaign": [
    {
      "campaign": "april-webinar-push",
      "leads": 19
    },
    {
      "campaign": "seo-kangen-benefits",
      "leads": 17
    }
  ],
  "total": 92,
  "from": "2026-03-12T00:00:00.000Z",
  "to": "2026-04-11T23:59:59.999Z"
}
```

**Error Responses (all analytics endpoints above):**

| Status | Message | When |
| --- | --- | --- |
| 400 | from date must be before to date | `from` is later than `to` |
| 400 | Maximum date range is 5 years | Requested range exceeds backend limit |
| 400 | Validation failed | Invalid date query params |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |

### 8.4 Admin Distributor Management Page (`/admin/distributors`)

- **Who sees it:** `SUPER_ADMIN` only.
- **On load:** `GET /admin/distributors`. If the page includes a subscription-management table, also call `GET /admin/distributor-subscriptions`.
- **User flow:** Admin reviews distributors, opens distributor detail, toggles join-link activation, checks subscription records, cancels subscriptions when necessary, and jumps to that distributor's leads.
- **UI logic:** This page works best with two tabs:
  - Distributor directory -> `/admin/distributors`
  - Subscription management -> `/admin/distributor-subscriptions`
- **Error handling:** Keep join-link toggle optimistic only if you also support rollback on failure. Admin cancellation should always ask for confirmation because it changes role/access immediately.
- **Navigation:** Distributor detail -> `/admin/distributors/:uuid`. Subscription detail can be a drawer or `/admin/distributor-subscriptions/:uuid`. View leads -> `/admin/leads?distributor=...` or dedicated distributor leads route.

**API Contracts**

**Endpoint:** `GET /api/v1/admin/distributors`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Query Params:**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `search` | string | No | Search by distributor name or email |
| `status` | string | No | `active` or `deactivated` based on join-link state |
| `page` | number | No | Page number, default `1` |
| `limit` | number | No | Page size, default `20` |

**Success Response (200):**

```json
{
  "items": [
    {
      "uuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
      "fullName": "Rudra Shah",
      "email": "rudra@example.com",
      "country": "India",
      "distributorCode": "NSI-RUDRA",
      "joinLink": "https://growithnsi.com/join/NSI-RUDRA",
      "joinLinkActive": true,
      "createdAt": "2026-03-01T06:00:00.000Z",
      "totalLeads": 84,
      "hotLeads": 19,
      "convertedLeads": 7,
      "conversionRate": "8.3%",
      "activeThisMonth": true
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20,
  "totalPages": 3
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |

**Endpoint:** `GET /api/v1/admin/distributors/:uuid`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Success Response (200):**

```json
{
  "uuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
  "fullName": "Rudra Shah",
  "email": "rudra@example.com",
  "country": "India",
  "distributorCode": "NSI-RUDRA",
  "joinLink": "https://growithnsi.com/join/NSI-RUDRA",
  "joinLinkActive": true,
  "createdAt": "2026-03-01T06:00:00.000Z",
  "totalLeads": 84,
  "hotLeads": 19,
  "convertedLeads": 7,
  "conversionRate": "8.3%",
  "activeThisMonth": true,
  "recentLeads": [
    {
      "uuid": "d4f7c7d5-cfcb-4607-9bb9-7bc61fa71001",
      "userFullName": "Rajesh Patel",
      "userEmail": "rajesh.patel@example.com",
      "phone": "+919876543210",
      "status": "HOT",
      "country": "India",
      "createdAt": "2026-04-02T07:31:00.000Z",
      "followupAt": "2026-04-11T11:00:00.000Z"
    }
  ],
  "performanceAnalytics": {
    "totalReferrals": 84,
    "successfulConversions": 7,
    "conversionRate": "8.3%",
    "funnelPath": [
      {
        "stage": "NEW",
        "count": 31
      },
      {
        "stage": "HOT",
        "count": 19
      },
      {
        "stage": "MARK_AS_CUSTOMER",
        "count": 7
      }
    ],
    "leadsByCountry": [
      {
        "country": "India",
        "count": 78
      },
      {
        "country": "UAE",
        "count": 6
      }
    ],
    "leadsOverTime": [
      {
        "period": "2026-03",
        "count": 29
      },
      {
        "period": "2026-04",
        "count": 55
      }
    ]
  }
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | Distributor not found | UUID does not resolve to a distributor user |

**Endpoint:** `PATCH /api/v1/admin/distributors/:uuid/deactivate-link`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Request Body:** No JSON body required.

**Success Response (200):**

```json
{
  "message": "Join link deactivated"
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | Distributor not found | UUID does not resolve to a distributor user |

**Endpoint:** `PATCH /api/v1/admin/distributors/:uuid/activate-link`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Request Body:** No JSON body required.

**Success Response (200):**

```json
{
  "message": "Join link activated"
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | Distributor not found | UUID does not resolve to a distributor user |

**Endpoint:** `GET /api/v1/admin/distributor-subscriptions`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Query Params:**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | enum | No | Filter by subscription status |
| `page` | number | No | Page number, default `1` |
| `limit` | number | No | Page size, default `20` |

**Success Response (200):**

```json
{
  "items": [
    {
      "uuid": "c7a47cc8-90d9-4e70-94c5-149b19c51001",
      "userUuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
      "planUuid": "b0f3fa42-fb6b-4f3f-a04d-5cccbad61001",
      "razorpaySubscriptionId": "sub_RZP_001",
      "status": "ACTIVE",
      "currentPeriodEnd": "2026-05-01T18:30:00.000Z",
      "graceDeadline": null,
      "cancelledAt": null,
      "migrationPending": false,
      "planDeactivatedAt": null,
      "createdAt": "2026-03-01T06:10:00.000Z",
      "updatedAt": "2026-04-01T18:31:10.000Z",
      "user": {
        "uuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
        "fullName": "Rudra Shah",
        "email": "rudra@example.com",
        "avatarUrl": null
      },
      "plan": {
        "name": "Business Pro",
        "amount": 1999
      }
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20,
  "totalPages": 3
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Validation failed | Invalid status, page, or limit query |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |

**Endpoint:** `GET /api/v1/admin/distributor-subscriptions/:uuid`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Success Response (200):**

```json
{
  "uuid": "c7a47cc8-90d9-4e70-94c5-149b19c51001",
  "userUuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
  "planUuid": "b0f3fa42-fb6b-4f3f-a04d-5cccbad61001",
  "razorpaySubscriptionId": "sub_RZP_001",
  "status": "ACTIVE",
  "currentPeriodEnd": "2026-05-01T18:30:00.000Z",
  "graceDeadline": null,
  "cancelledAt": null,
  "migrationPending": false,
  "planDeactivatedAt": null,
  "createdAt": "2026-03-01T06:10:00.000Z",
  "updatedAt": "2026-04-01T18:31:10.000Z",
  "user": {
    "uuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
    "fullName": "Rudra Shah",
    "email": "rudra@example.com",
    "avatarUrl": null
  },
  "plan": {
    "uuid": "b0f3fa42-fb6b-4f3f-a04d-5cccbad61001",
    "razorpayPlanId": "mock_plan_06ebd4ef-3c95-4e18-bdcc-c90654ff1001",
    "name": "Business Pro",
    "amount": 1999,
    "interval": "monthly",
    "isActive": true,
    "createdAt": "2026-03-01T05:30:00.000Z",
    "updatedAt": "2026-03-01T05:30:00.000Z",
    "tagline": "Unlock your full distribution potential",
    "features": [
      "Unlimited leads",
      "Priority support",
      "Distributor LMS access"
    ],
    "trustBadges": [
      "ISO Certified",
      "10k+ Members"
    ],
    "ctaText": "Start Now",
    "highlightBadge": "MOST POPULAR",
    "testimonials": "[{\"name\":\"Nageshwar Shukla\",\"text\":\"This plan transformed my business in 3 months!\",\"avatarInitials\":\"NS\",\"location\":\"Mumbai, India\"}]"
  }
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | Subscription not found | UUID does not resolve to a subscription |

**Endpoint:** `POST /api/v1/admin/distributor-subscriptions/:uuid/cancel`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Request Body:** No JSON body required.

**Success Response (201):**

```json
{
  "message": "Subscription cancelled successfully",
  "leadsReassigned": 4
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | Subscription not found | UUID does not resolve to a subscription |

### 8.5 Admin Plan Management Page (`/admin/distributor-plans`)

- **Who sees it:** `SUPER_ADMIN` only.
- **On load:** `GET /admin/distributor-plans`.
- **User flow:** Admin creates plans, edits plan content fields, and deactivates plans when rolling pricing/positioning changes.
- **UI logic:** Show full marketing content for each plan: name, amount, tagline, features, trust badges, CTA text, highlight badge, testimonials. Amount should be treated as immutable after creation because current edit flow only updates content fields.
- **Migration logic:** Before deactivation, warn that active subscribers may be flagged with `migrationPending` and must move to a new plan before renewal.
- **Error handling:** Deactivation failures should leave the plan visibly active. Edit forms should preserve unsaved arrays like features/testimonials if the request fails.
- **Navigation:** Create/edit can be modal or `/admin/distributor-plans/:uuid/edit`.

**API Contracts**

**Endpoint:** `GET /api/v1/admin/distributor-plans`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Success Response (200):**

```json
[
  {
    "uuid": "b0f3fa42-fb6b-4f3f-a04d-5cccbad61001",
    "razorpayPlanId": "mock_plan_06ebd4ef-3c95-4e18-bdcc-c90654ff1001",
    "name": "Business Pro",
    "amount": 1999,
    "interval": "monthly",
    "isActive": true,
    "createdAt": "2026-03-01T05:30:00.000Z",
    "updatedAt": "2026-03-01T05:30:00.000Z",
    "tagline": "Unlock your full distribution potential",
    "features": [
      "Unlimited leads",
      "Priority support",
      "Distributor LMS access"
    ],
    "trustBadges": [
      "ISO Certified",
      "10k+ Members"
    ],
    "ctaText": "Start Now",
    "highlightBadge": "MOST POPULAR",
    "testimonials": "[{\"name\":\"Nageshwar Shukla\",\"text\":\"This plan transformed my business in 3 months!\",\"avatarInitials\":\"NS\",\"location\":\"Mumbai, India\"}]"
  }
]
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |

**Endpoint:** `POST /api/v1/admin/distributor-plans`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | Yes | Plan name |
| `amount` | number | Yes | Monthly amount in rupees |
| `tagline` | string | No | Short tagline |
| `features` | string[] | No | Feature bullets |
| `trustBadges` | string[] | No | Trust badges |
| `ctaText` | string | No | CTA button label |
| `highlightBadge` | string | No | Highlight badge label |
| `testimonials` | object[] | No | Array of `{ name, text, avatarInitials, location? }` |

**Success Response (201):**

```json
{
  "uuid": "b0f3fa42-fb6b-4f3f-a04d-5cccbad61001",
  "razorpayPlanId": "mock_plan_06ebd4ef-3c95-4e18-bdcc-c90654ff1001",
  "name": "Business Pro",
  "amount": 1999,
  "interval": "monthly",
  "isActive": true,
  "createdAt": "2026-03-01T05:30:00.000Z",
  "updatedAt": "2026-03-01T05:30:00.000Z",
  "tagline": "Unlock your full distribution potential",
  "features": [
    "Unlimited leads",
    "Priority support",
    "Distributor LMS access"
  ],
  "trustBadges": [
    "ISO Certified",
    "10k+ Members"
  ],
  "ctaText": "Start Now",
  "highlightBadge": "MOST POPULAR",
  "testimonials": "[{\"name\":\"Nageshwar Shukla\",\"text\":\"This plan transformed my business in 3 months!\",\"avatarInitials\":\"NS\",\"location\":\"Mumbai, India\"}]"
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Validation failed | Missing or invalid plan fields |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 409 | An active plan with this amount already exists. Deactivate it before creating a new one. | Backend found another active plan at the same amount |

**Endpoint:** `GET /api/v1/admin/distributor-plans/:uuid/edit`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Success Response (200):**

```json
{
  "name": "Business Pro",
  "tagline": "Unlock your full distribution potential",
  "ctaText": "Start Now",
  "highlightBadge": "MOST POPULAR",
  "features": [
    "Unlimited leads",
    "Priority support",
    "Distributor LMS access"
  ],
  "trustBadges": [
    "ISO Certified",
    "10k+ Members"
  ],
  "testimonials": [
    {
      "name": "Nageshwar Shukla",
      "text": "This plan transformed my business in 3 months!",
      "avatarInitials": "NS",
      "location": "Mumbai, India"
    }
  ]
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | Distributor plan not found | UUID does not resolve to a plan |

**Endpoint:** `PATCH /api/v1/admin/distributor-plans/:uuid`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | No | Updated plan name |
| `tagline` | string | No | Updated tagline |
| `ctaText` | string | No | Updated CTA label |
| `highlightBadge` | string | No | Updated highlight badge |
| `features` | string[] | No | Updated feature bullets |
| `trustBadges` | string[] | No | Updated trust badges |
| `testimonials` | object[] | No | Updated testimonials array |

**Success Response (200):**

```json
{
  "uuid": "b0f3fa42-fb6b-4f3f-a04d-5cccbad61001",
  "razorpayPlanId": "mock_plan_06ebd4ef-3c95-4e18-bdcc-c90654ff1001",
  "name": "Business Pro",
  "amount": 1999,
  "interval": "monthly",
  "isActive": true,
  "createdAt": "2026-03-01T05:30:00.000Z",
  "updatedAt": "2026-04-11T06:00:00.000Z",
  "tagline": "Unlock your full distribution potential",
  "features": [
    "Unlimited leads",
    "Priority support",
    "Distributor LMS access"
  ],
  "trustBadges": [
    "ISO Certified",
    "10k+ Members"
  ],
  "ctaText": "Start Now",
  "highlightBadge": "MOST POPULAR",
  "testimonials": "[{\"name\":\"Nageshwar Shukla\",\"text\":\"This plan transformed my business in 3 months!\",\"avatarInitials\":\"NS\",\"location\":\"Mumbai, India\"}]"
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Validation failed | Invalid content fields |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | Distributor plan not found | UUID does not resolve to a plan |

**Endpoint:** `PATCH /api/v1/admin/distributor-plans/:uuid/deactivate`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Request Body:** No JSON body required.

**Success Response (200):**

```json
{
  "message": "Plan deactivated. 18 subscribers will be migrated on their billing dates.",
  "affectedSubscribers": 18
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | Plan not found | UUID does not resolve to a plan |

### 8.6 Admin Notifications Page (`/admin/notifications`)

- **Who sees it:** `SUPER_ADMIN` only.
- **On load:** `GET /admin/notifications`.
- **User flow:** Admin reviews direct/organic lead follow-ups and opens the relevant lead records.
- **UI logic:** Use the response for the admin nav badge as well. This page should focus on actionable items, not general system alerts.
- **Error handling:** If notifications fail, keep the rest of the admin shell working and show the badge as unavailable.
- **Navigation:** Notification click -> `/admin/leads/:uuid` or `/admin/followups/today`.

**API Contracts**

**Endpoint:** `GET /api/v1/admin/notifications`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Success Response (200):**

```json
{
  "followupsToday": [
    {
      "leadUuid": "3b755347-bcc8-4e14-b532-85cd86ae1001",
      "userFullName": "Mihir Patel",
      "phone": "+919912345678",
      "followupAt": "2026-04-11T09:00:00.000Z",
      "notes": "Asked to revisit after weekend demo."
    }
  ],
  "overdueFollowups": [
    {
      "leadUuid": "c7146bbf-4f1f-41ab-8fae-5dca24981001",
      "userFullName": "Anita Sharma",
      "phone": null,
      "followupAt": "2026-04-10T07:00:00.000Z",
      "notes": "Missed callback yesterday."
    }
  ]
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |

---

## Section 9 - Admin LMS Management

### 9.1 Course Management Page (`/admin/courses`)

- **Who sees it:** `SUPER_ADMIN` only.
- **On load:** `GET /admin/courses`.
- **User flow:** Admin creates a course, uploads thumbnail through `POST /admin/lms/upload`, sets preview video URL, enters marketing fields, then submits `POST /admin/courses`. Existing courses can be edited, published, unpublished, or deleted.
- **UI logic:** Show total enrollments, total lessons, badge, publish state, and quick actions. Delete should only appear as a destructive option when safe; otherwise steer the admin to unpublish.
- **Error handling:** If delete fails because enrollments exist, show "Unpublish instead" directly in the confirmation flow. Upload failures should not wipe the rest of the course form.
- **Navigation:** Create/edit -> `/admin/courses/:uuid/edit` or an editor drawer. Detail -> `/admin/courses/:uuid`.

**API Contracts**

**Endpoint:** `GET /api/v1/admin/courses`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Success Response (200):**

```json
[
  {
    "uuid": "4fd2d086-5fc2-49ae-bba1-bf36b5ab1001",
    "title": "Kangen Water Business Masterclass",
    "description": "Learn how to build a Kangen Water distribution business from scratch.",
    "thumbnailUrl": "https://r2-url/nsi-thumbnails/UPLOAD-abc123.jpg",
    "isFree": false,
    "price": 999,
    "isPublished": true,
    "badge": "BESTSELLER",
    "createdAt": "2026-03-15T05:30:00.000Z",
    "totalEnrollments": 206,
    "totalLessons": 24
  }
]
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |

**Endpoint:** `POST /api/v1/admin/lms/upload`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Multipart Form Data:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `file` | binary | Yes | Thumbnail image or PDF attachment |
| `folder` | string | Yes | One of `thumbnails` or `attachments` |

**Success Response (200):**

```json
{
  "url": "https://r2-url/nsi-thumbnails/UPLOAD-1712800000-ab12cd.jpg"
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | File is required | Multipart upload omitted `file` |
| 400 | Invalid folder. Accepted: thumbnails, attachments | `folder` is not one of the supported targets |
| 400 | Invalid file type for thumbnails. Accepted: JPG, PNG, WEBP | Uploaded thumbnail file type is invalid |
| 400 | Invalid file type for attachments. Accepted: PDF | Uploaded attachment file type is invalid |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |

**Endpoint:** `POST /api/v1/admin/courses`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `title` | string | Yes | Course title |
| `description` | string | Yes | Course description |
| `thumbnailUrl` | string | No | Thumbnail image URL |
| `isFree` | boolean | Yes | Whether the course is free |
| `price` | number | Conditional | Required when `isFree=false` |
| `previewVideoUrl` | string | No | Public preview video URL |
| `badge` | string | No | Badge label |
| `instructors` | string[] | No | Instructor names |
| `whatYouWillLearn` | string[] | No | Learning outcomes |
| `originalPrice` | number | No | Original price before discount |
| `totalDuration` | string | No | Human-readable total duration |
| `enrollmentBoost` | number | No | Artificial enrollment boost count |

**Success Response (201):**

```json
{
  "uuid": "4fd2d086-5fc2-49ae-bba1-bf36b5ab1001",
  "title": "Kangen Water Business Masterclass",
  "description": "Learn how to build a Kangen Water distribution business from scratch.",
  "thumbnailUrl": "https://r2-url/nsi-thumbnails/UPLOAD-abc123.jpg",
  "isFree": false,
  "price": 999,
  "isPublished": false,
  "createdAt": "2026-03-15T05:30:00.000Z",
  "updatedAt": "2026-03-15T05:30:00.000Z",
  "previewVideoUrl": "https://iframe.mediadelivery.net/embed/98765/course-preview",
  "badge": "BESTSELLER",
  "instructors": [
    "Nageshwar Shukla",
    "Dr. Patel"
  ],
  "whatYouWillLearn": [
    "Build a high-conviction distributor network",
    "Handle product and business objections"
  ],
  "originalPrice": "1999",
  "totalDuration": "12h 30m",
  "enrollmentBoost": 50
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Price is required for paid courses | `isFree=false` and `price` missing |
| 400 | Validation failed | Invalid string, URL, boolean, or number fields |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |

**Endpoint:** `GET /api/v1/admin/courses/:uuid`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Success Response (200):**

```json
{
  "uuid": "4fd2d086-5fc2-49ae-bba1-bf36b5ab1001",
  "title": "Kangen Water Business Masterclass",
  "description": "Learn how to build a Kangen Water distribution business from scratch.",
  "thumbnailUrl": "https://r2-url/nsi-thumbnails/UPLOAD-abc123.jpg",
  "isFree": false,
  "price": 999,
  "isPublished": true,
  "createdAt": "2026-03-15T05:30:00.000Z",
  "previewVideoUrl": "https://iframe.mediadelivery.net/embed/98765/course-preview",
  "badge": "BESTSELLER",
  "instructors": [
    "Nageshwar Shukla",
    "Dr. Patel"
  ],
  "whatYouWillLearn": [
    "Build a high-conviction distributor network",
    "Handle product and business objections"
  ],
  "originalPrice": 1999,
  "totalDuration": "12h 30m",
  "enrollmentBoost": 50,
  "totalEnrollments": 206,
  "totalLessons": 24,
  "totalSections": 5,
  "totalPdfs": 3,
  "discountPercent": 50,
  "sections": [
    {
      "uuid": "d0d17ca6-0ee0-4b96-8824-5d07a1ab1001",
      "title": "Module 1 - Foundations",
      "order": 1,
      "lessons": [
        {
          "uuid": "ca8ef9e0-f5bb-45dd-9d75-9349aef81001",
          "title": "What Makes Kangen Different",
          "description": "Lesson overview",
          "videoUrl": "https://iframe.mediadelivery.net/embed/98765/lesson-1",
          "videoDuration": 840,
          "textContent": "<p>Lesson notes.</p>",
          "pdfUrl": null,
          "isPreview": true,
          "attachmentUrl": "https://r2-url/nsi-attachments/UPLOAD-preview.pdf",
          "attachmentName": "Lesson Slides.pdf",
          "order": 1,
          "isPublished": true
        }
      ]
    }
  ]
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | Course not found | Course UUID does not exist |

**Endpoint:** `GET /api/v1/admin/courses/:uuid/edit`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Success Response (200):**

```json
{
  "title": "Kangen Water Business Masterclass",
  "description": "Learn how to build a Kangen Water distribution business from scratch.",
  "thumbnailUrl": "https://r2-url/nsi-thumbnails/UPLOAD-abc123.jpg",
  "isFree": false,
  "price": 999,
  "previewVideoUrl": "https://iframe.mediadelivery.net/embed/98765/course-preview",
  "badge": "BESTSELLER",
  "instructors": [
    "Nageshwar Shukla",
    "Dr. Patel"
  ],
  "whatYouWillLearn": [
    "Build a high-conviction distributor network",
    "Handle product and business objections"
  ],
  "originalPrice": 1999,
  "totalDuration": "12h 30m",
  "enrollmentBoost": 50
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | Course not found | Course UUID does not exist |

**Endpoint:** `PATCH /api/v1/admin/courses/:uuid`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Request Body:** Same fields as course create, but all optional.

**Success Response (200):**

```json
{
  "uuid": "4fd2d086-5fc2-49ae-bba1-bf36b5ab1001",
  "title": "Kangen Water Business Masterclass",
  "description": "Learn how to build a Kangen Water distribution business from scratch.",
  "thumbnailUrl": "https://r2-url/nsi-thumbnails/UPLOAD-abc123.jpg",
  "isFree": false,
  "price": 999,
  "isPublished": true,
  "createdAt": "2026-03-15T05:30:00.000Z",
  "updatedAt": "2026-04-11T07:00:00.000Z",
  "previewVideoUrl": "https://iframe.mediadelivery.net/embed/98765/course-preview",
  "badge": "BESTSELLER",
  "instructors": [
    "Nageshwar Shukla",
    "Dr. Patel"
  ],
  "whatYouWillLearn": [
    "Build a high-conviction distributor network",
    "Handle product and business objections"
  ],
  "originalPrice": "1999",
  "totalDuration": "12h 30m",
  "enrollmentBoost": 50
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Validation failed | Invalid string, URL, boolean, or number fields |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | Course not found | Course UUID does not exist |

**Endpoint:** `PATCH /api/v1/admin/courses/:uuid/publish`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Request Body:** No JSON body required.

**Success Response (200):**

```json
{
  "uuid": "4fd2d086-5fc2-49ae-bba1-bf36b5ab1001",
  "title": "Kangen Water Business Masterclass",
  "description": "Learn how to build a Kangen Water distribution business from scratch.",
  "thumbnailUrl": "https://r2-url/nsi-thumbnails/UPLOAD-abc123.jpg",
  "isFree": false,
  "price": 999,
  "isPublished": true,
  "createdAt": "2026-03-15T05:30:00.000Z",
  "updatedAt": "2026-04-11T07:05:00.000Z",
  "previewVideoUrl": "https://iframe.mediadelivery.net/embed/98765/course-preview",
  "badge": "BESTSELLER",
  "instructors": [
    "Nageshwar Shukla",
    "Dr. Patel"
  ],
  "whatYouWillLearn": [
    "Build a high-conviction distributor network",
    "Handle product and business objections"
  ],
  "originalPrice": "1999",
  "totalDuration": "12h 30m",
  "enrollmentBoost": 50
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | Course not found | Course UUID does not exist |

**Endpoint:** `PATCH /api/v1/admin/courses/:uuid/unpublish`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Request Body:** No JSON body required.

**Success Response (200):**

```json
{
  "uuid": "4fd2d086-5fc2-49ae-bba1-bf36b5ab1001",
  "title": "Kangen Water Business Masterclass",
  "description": "Learn how to build a Kangen Water distribution business from scratch.",
  "thumbnailUrl": "https://r2-url/nsi-thumbnails/UPLOAD-abc123.jpg",
  "isFree": false,
  "price": 999,
  "isPublished": false,
  "createdAt": "2026-03-15T05:30:00.000Z",
  "updatedAt": "2026-04-11T07:06:00.000Z",
  "previewVideoUrl": "https://iframe.mediadelivery.net/embed/98765/course-preview",
  "badge": "BESTSELLER",
  "instructors": [
    "Nageshwar Shukla",
    "Dr. Patel"
  ],
  "whatYouWillLearn": [
    "Build a high-conviction distributor network",
    "Handle product and business objections"
  ],
  "originalPrice": "1999",
  "totalDuration": "12h 30m",
  "enrollmentBoost": 50
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | Course not found | Course UUID does not exist |

**Endpoint:** `DELETE /api/v1/admin/courses/:uuid`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Success Response (200):**

```json
{
  "deleted": true
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Cannot delete course with active enrollments. Unpublish it instead. | Course still has enrollments |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | Course not found | Course UUID does not exist |

### 9.2 Section Management Page (`/admin/courses/:uuid`)

- **Who sees it:** `SUPER_ADMIN` only.
- **On load:** `GET /admin/courses/:uuid`.
- **User flow:** Admin adds sections, edits section titles, reorders sections by drag-and-drop, and deletes sections when appropriate.
- **UI logic:** Keep section management inside the course editor because section order directly affects lesson lock order in learner UX.
- **Error handling:** Reorder failures must snap the UI back to the previous order. Delete failures should explain whether the section is protected because of content/state rules.
- **Navigation:** Section edit can be inline, modal, or `/admin/courses/:courseUuid/sections/:sectionUuid/edit`.

**API Contracts**

**Endpoint:** `POST /api/v1/admin/courses/:uuid/sections`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `title` | string | Yes | Section title |
| `order` | number | Yes | Display order, minimum `1` |

**Success Response (201):**

```json
{
  "uuid": "d0d17ca6-0ee0-4b96-8824-5d07a1ab1001",
  "courseUuid": "4fd2d086-5fc2-49ae-bba1-bf36b5ab1001",
  "title": "Module 1 - Foundations",
  "order": 1,
  "createdAt": "2026-03-15T06:00:00.000Z",
  "updatedAt": "2026-03-15T06:00:00.000Z"
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Validation failed | Missing title or invalid order |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | Course not found | Parent course UUID does not exist |

**Endpoint:** `GET /api/v1/admin/courses/:courseUuid/sections/:sectionUuid/edit`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Success Response (200):**

```json
{
  "title": "Module 1 - Foundations",
  "order": 1
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | Section not found in this course | Section UUID does not belong to the course |

**Endpoint:** `PATCH /api/v1/admin/courses/:courseUuid/sections/:sectionUuid`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `title` | string | No | Updated section title |
| `order` | number | No | Updated display order |

**Success Response (200):**

```json
{
  "uuid": "d0d17ca6-0ee0-4b96-8824-5d07a1ab1001",
  "courseUuid": "4fd2d086-5fc2-49ae-bba1-bf36b5ab1001",
  "title": "Module 1 - Foundations",
  "order": 1,
  "createdAt": "2026-03-15T06:00:00.000Z",
  "updatedAt": "2026-04-11T07:10:00.000Z"
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Validation failed | Invalid section title or order |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | Section not found in this course | Section UUID does not belong to the course |

**Endpoint:** `PATCH /api/v1/admin/courses/:courseUuid/sections/reorder`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `orderedUuids` | UUID[] | Yes | Final ordered list of section UUIDs |

**Success Response (200):**

```json
{
  "reordered": true
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Validation failed | `orderedUuids` is missing or contains invalid UUIDs |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | Course not found | Course UUID does not exist |

**Endpoint:** `DELETE /api/v1/admin/courses/:courseUuid/sections/:sectionUuid`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Success Response (200):**

```json
{
  "deleted": true
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | Section not found in this course | Section UUID does not belong to the course |

### 9.3 Lesson Management Page (`/admin/courses/:courseUuid/sections/:sectionUuid`)

- **Who sees it:** `SUPER_ADMIN` only.
- **On load:** Usually piggybacks on `GET /admin/courses/:uuid`, but edit flows may call `GET .../lessons/:lessonUuid/edit`.
- **User flow:** Admin creates lessons, toggles preview visibility, uploads PDF attachments through `POST /admin/lms/upload`, reorders lessons, edits lessons, and deletes lessons.
- **UI logic:** `isPreview=true` matters for the public course landing page, so preview lessons should be clearly marked in the admin UI. Attachment upload should fill both `attachmentUrl` and `attachmentName`.
- **Error handling:** Invalid attachment types should be stopped before submit. Reorder/delete failures should revert the local list.
- **Navigation:** Continue working inside the course editor after save.

**API Contracts**

**Endpoint:** `POST /api/v1/admin/courses/:courseUuid/sections/:sectionUuid/lessons`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `title` | string | Yes | Lesson title |
| `description` | string | No | Lesson description |
| `videoUrl` | string | No | Bunny or iframe video URL |
| `videoDuration` | number | No | Video duration in seconds |
| `textContent` | string | No | Rich text/HTML content |
| `pdfUrl` | string | No | Legacy PDF URL |
| `order` | number | Yes | Display order, minimum `1` |
| `isPublished` | boolean | Yes | Publish toggle |
| `isPreview` | boolean | No | Free preview visibility |
| `attachmentUrl` | string | No | Attachment file URL |
| `attachmentName` | string | No | Attachment display name |

**Success Response (201):**

```json
{
  "uuid": "ca8ef9e0-f5bb-45dd-9d75-9349aef81001",
  "sectionUuid": "d0d17ca6-0ee0-4b96-8824-5d07a1ab1001",
  "title": "What Makes Kangen Different",
  "description": "Lesson overview",
  "videoUrl": "https://iframe.mediadelivery.net/embed/98765/lesson-1",
  "videoDuration": 840,
  "textContent": "<p>Lesson notes.</p>",
  "pdfUrl": null,
  "order": 1,
  "isPublished": true,
  "createdAt": "2026-03-15T06:15:00.000Z",
  "updatedAt": "2026-03-15T06:15:00.000Z",
  "isPreview": true,
  "attachmentUrl": "https://r2-url/nsi-attachments/UPLOAD-preview.pdf",
  "attachmentName": "Lesson Slides.pdf"
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Validation failed | Missing title/order/publish state or invalid values |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | Section not found in this course | Parent section UUID does not belong to the course |

**Endpoint:** `GET /api/v1/admin/courses/:courseUuid/sections/:sectionUuid/lessons/:lessonUuid/edit`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Success Response (200):**

```json
{
  "title": "What Makes Kangen Different",
  "description": "Lesson overview",
  "videoUrl": "https://iframe.mediadelivery.net/embed/98765/lesson-1",
  "videoDuration": 840,
  "textContent": "<p>Lesson notes.</p>",
  "pdfUrl": null,
  "isPreview": true,
  "attachmentUrl": "https://r2-url/nsi-attachments/UPLOAD-preview.pdf",
  "attachmentName": "Lesson Slides.pdf",
  "order": 1,
  "isPublished": true
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | Lesson not found | Lesson UUID does not belong to the section/course |

**Endpoint:** `PATCH /api/v1/admin/courses/:courseUuid/sections/:sectionUuid/lessons/:lessonUuid`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Request Body:** Same lesson fields as create, but all optional.

**Success Response (200):**

```json
{
  "uuid": "ca8ef9e0-f5bb-45dd-9d75-9349aef81001",
  "sectionUuid": "d0d17ca6-0ee0-4b96-8824-5d07a1ab1001",
  "title": "What Makes Kangen Different",
  "description": "Lesson overview",
  "videoUrl": "https://iframe.mediadelivery.net/embed/98765/lesson-1",
  "videoDuration": 840,
  "textContent": "<p>Lesson notes.</p>",
  "pdfUrl": null,
  "order": 1,
  "isPublished": true,
  "createdAt": "2026-03-15T06:15:00.000Z",
  "updatedAt": "2026-04-11T07:20:00.000Z",
  "isPreview": true,
  "attachmentUrl": "https://r2-url/nsi-attachments/UPLOAD-preview.pdf",
  "attachmentName": "Lesson Slides.pdf"
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Validation failed | Invalid lesson fields |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | Lesson not found | Lesson UUID does not belong to the section/course |

**Endpoint:** `PATCH /api/v1/admin/courses/:courseUuid/sections/:sectionUuid/lessons/reorder`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `orderedUuids` | UUID[] | Yes | Final ordered list of lesson UUIDs |

**Success Response (200):**

```json
{
  "reordered": true
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Validation failed | `orderedUuids` is missing or contains invalid UUIDs |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | Section not found in this course | Parent section UUID does not belong to the course |

**Endpoint:** `DELETE /api/v1/admin/courses/:courseUuid/sections/:sectionUuid/lessons/:lessonUuid`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Success Response (200):**

```json
{
  "deleted": true
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | Lesson not found | Lesson UUID does not belong to the section/course |

### 9.4 LMS Analytics Page (`/admin/lms/analytics`)

- **Who sees it:** `SUPER_ADMIN` only.
- **On load:** `GET /admin/lms/analytics`.
- **User flow:** Admin reviews total courses, enrollments, completions, certificate volume, and per-course performance.
- **UI logic:** Show top-line metrics plus a per-course breakdown table. Link each row back to the course editor when the admin wants to improve weak courses.
- **Error handling:** Empty analytics should still render the frame and say there is no LMS activity yet.
- **Navigation:** Per-course drill-down -> `/admin/courses/:uuid`.

**API Contracts**

**Endpoint:** `GET /api/v1/admin/lms/analytics`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Success Response (200):**

```json
{
  "totalCourses": 12,
  "publishedCourses": 9,
  "totalEnrollments": 640,
  "totalCompletions": 214,
  "completionRate": "33.4%",
  "certificatesIssued": 198,
  "courseBreakdown": [
    {
      "uuid": "4fd2d086-5fc2-49ae-bba1-bf36b5ab1001",
      "title": "Kangen Water Business Masterclass",
      "isFree": false,
      "enrollments": 206,
      "completions": 74,
      "completionRate": "35.9%",
      "avgProgress": 48
    },
    {
      "uuid": "60c3fa3d-cc2b-4836-a8f0-90d0374f1001",
      "title": "Kangen Science Basics",
      "isFree": true,
      "enrollments": 154,
      "completions": 63,
      "completionRate": "40.9%",
      "avgProgress": 56
    }
  ]
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |

---

## Section 10 - Admin Funnel CMS

### 10.1 Funnel Builder Page (`/admin/funnel`)

- **Who sees it:** `SUPER_ADMIN` only.
- **On load:** `GET /admin/funnel/sections`.
- **User flow:** Admin creates sections, adds steps, edits step-specific content, reorders sections/steps, validates the funnel, and deletes inactive items when safe.
- **UI logic:** Current backend step families are `VIDEO_TEXT`, `PHONE_GATE`, `PAYMENT_GATE`, and `DECISION`. Frontend forms should adapt by type:
  - `VIDEO_TEXT` -> video URL, rich text, threshold/completion settings
  - `PHONE_GATE` -> instructional copy and verification messaging
  - `PAYMENT_GATE` -> amount, sales copy, CTA, coupon allowance
  - `DECISION` -> question, yes/no labels, supporting subtext
- **Error handling:** If delete is blocked because users are already in the funnel, show the backend reason clearly. Reorder failures should restore the previous state.
- **Navigation:** Stay in `/admin/funnel` after edits. Optional validation panel can call `GET /admin/funnel/validate` before final publish/save confidence checks.

**API Contracts**

**Endpoint:** `GET /api/v1/admin/funnel/sections`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Success Response (200):**

```json
[
  {
    "uuid": "7e224c7d-b00d-40da-84fb-a98741521001",
    "name": "Introduction",
    "description": "Warm up the lead before verification and payment.",
    "order": 1,
    "isActive": true,
    "createdAt": "2026-03-01T05:00:00.000Z",
    "updatedAt": "2026-04-01T05:00:00.000Z",
    "steps": [
      {
        "uuid": "19c69d0b-87b6-458b-befb-d85f82811001",
        "sectionUuid": "7e224c7d-b00d-40da-84fb-a98741521001",
        "type": "VIDEO_TEXT",
        "order": 1,
        "isActive": true,
        "createdAt": "2026-03-01T05:10:00.000Z",
        "updatedAt": "2026-04-01T05:10:00.000Z",
        "content": {
          "uuid": "0dbb9b8c-eaf8-4a75-b985-253e3c2b1001",
          "stepUuid": "19c69d0b-87b6-458b-befb-d85f82811001",
          "title": "Why Kangen Water Works",
          "description": "Opening conviction step",
          "videoUrl": "https://iframe.mediadelivery.net/embed/98765/funnel-intro",
          "videoDuration": 720,
          "thumbnailUrl": "https://r2-url/nsi-thumbnails/funnel-intro.jpg",
          "textContent": "<p>Supportive copy under the video.</p>",
          "requireVideoCompletion": true,
          "createdAt": "2026-03-01T05:10:01.000Z",
          "updatedAt": "2026-04-01T05:10:01.000Z"
        },
        "phoneGate": null,
        "paymentGate": null,
        "decisionStep": null
      },
      {
        "uuid": "8b3f048d-ef1f-4a91-b4f9-758d42441001",
        "sectionUuid": "7e224c7d-b00d-40da-84fb-a98741521001",
        "type": "PAYMENT_GATE",
        "order": 2,
        "isActive": true,
        "createdAt": "2026-03-01T05:20:00.000Z",
        "updatedAt": "2026-04-01T05:20:00.000Z",
        "content": null,
        "phoneGate": null,
        "paymentGate": {
          "uuid": "1b862166-9d0d-45b8-9b18-8573f4321001",
          "stepUuid": "8b3f048d-ef1f-4a91-b4f9-758d42441001",
          "title": "Unlock commitment",
          "subtitle": "{\"subheading\":\"Small fee to secure serious buyers\",\"ctaText\":\"Pay Now\",\"features\":[\"Priority callback\"],\"trustBadges\":[\"Secure checkout\"],\"testimonials\":[{\"name\":\"Rakesh\",\"text\":\"Worth it\",\"avatarInitials\":\"RK\"}]}",
          "amount": "999",
          "currency": "INR",
          "allowCoupons": true,
          "isActive": true
        },
        "decisionStep": null
      }
    ]
  }
]
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |

**Endpoint:** `POST /api/v1/admin/funnel/sections`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | Yes | Section name |
| `description` | string | No | Section description |
| `order` | number | Yes | Display order, minimum `1` |

**Success Response (201):**

```json
{
  "uuid": "7e224c7d-b00d-40da-84fb-a98741521001",
  "name": "Introduction",
  "description": "Warm up the lead before verification and payment.",
  "order": 1,
  "isActive": true,
  "createdAt": "2026-03-01T05:00:00.000Z",
  "updatedAt": "2026-03-01T05:00:00.000Z"
}
```

**Endpoint:** `POST /api/v1/admin/funnel/sections/reorder`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Request Body:** Bare JSON array of reorder items.

```json
[
  {
    "uuid": "7e224c7d-b00d-40da-84fb-a98741521001",
    "order": 1
  },
  {
    "uuid": "5aa6ef93-df82-4332-b574-44c1e2ba1001",
    "order": 2
  }
]
```

**Success Response (200):**

```json
{
  "ok": true
}
```

**Endpoint:** `GET /api/v1/admin/funnel/sections/:uuid/edit`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Success Response (200):**

```json
{
  "name": "Introduction",
  "description": "Warm up the lead before verification and payment.",
  "order": 1,
  "isActive": true
}
```

**Endpoint:** `PATCH /api/v1/admin/funnel/sections/:uuid`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | No | Updated section name |
| `description` | string | No | Updated description |
| `order` | number | No | Updated order |
| `isActive` | boolean | No | Active toggle |

**Success Response (200):**

```json
{
  "uuid": "7e224c7d-b00d-40da-84fb-a98741521001",
  "name": "Introduction",
  "description": "Warm up the lead before verification and payment.",
  "order": 1,
  "isActive": true,
  "createdAt": "2026-03-01T05:00:00.000Z",
  "updatedAt": "2026-04-11T07:30:00.000Z"
}
```

**Endpoint:** `DELETE /api/v1/admin/funnel/sections/:uuid`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Success Response (200):**

```json
{
  "ok": true
}
```

**Endpoint:** `POST /api/v1/admin/funnel/steps`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `sectionUuid` | UUID | Yes | Parent section UUID |
| `type` | enum | Yes | One of `VIDEO_TEXT`, `PHONE_GATE`, `PAYMENT_GATE`, `DECISION` |
| `order` | number | Yes | Step order, minimum `1` |

**Success Response (201):**

```json
{
  "uuid": "19c69d0b-87b6-458b-befb-d85f82811001",
  "sectionUuid": "7e224c7d-b00d-40da-84fb-a98741521001",
  "type": "VIDEO_TEXT",
  "order": 1,
  "isActive": true,
  "createdAt": "2026-03-01T05:10:00.000Z",
  "updatedAt": "2026-03-01T05:10:00.000Z",
  "content": {
    "uuid": "0dbb9b8c-eaf8-4a75-b985-253e3c2b1001",
    "stepUuid": "19c69d0b-87b6-458b-befb-d85f82811001",
    "title": "New Video Step",
    "description": null,
    "videoUrl": null,
    "videoDuration": null,
    "thumbnailUrl": null,
    "textContent": null,
    "requireVideoCompletion": true,
    "createdAt": "2026-03-01T05:10:01.000Z",
    "updatedAt": "2026-03-01T05:10:01.000Z"
  },
  "phoneGate": null,
  "paymentGate": null,
  "decisionStep": null
}
```

**Endpoint:** `GET /api/v1/admin/funnel/steps/:uuid`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Success Response (200):**

```json
{
  "uuid": "8b3f048d-ef1f-4a91-b4f9-758d42441001",
  "sectionUuid": "7e224c7d-b00d-40da-84fb-a98741521001",
  "type": "PAYMENT_GATE",
  "order": 2,
  "isActive": true,
  "createdAt": "2026-03-01T05:20:00.000Z",
  "updatedAt": "2026-04-01T05:20:00.000Z",
  "content": null,
  "phoneGate": null,
  "paymentGate": {
    "uuid": "1b862166-9d0d-45b8-9b18-8573f4321001",
    "stepUuid": "8b3f048d-ef1f-4a91-b4f9-758d42441001",
    "title": "Unlock commitment",
    "subtitle": "{\"subheading\":\"Small fee to secure serious buyers\",\"ctaText\":\"Pay Now\",\"features\":[\"Priority callback\"],\"trustBadges\":[\"Secure checkout\"],\"testimonials\":[{\"name\":\"Rakesh\",\"text\":\"Worth it\",\"avatarInitials\":\"RK\"}]}",
    "amount": "999",
    "currency": "INR",
    "allowCoupons": true,
    "isActive": true
  },
  "decisionStep": null
}
```

**Endpoint:** `POST /api/v1/admin/funnel/steps/reorder`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Request Body:** Bare JSON array of reorder items.

```json
[
  {
    "uuid": "19c69d0b-87b6-458b-befb-d85f82811001",
    "order": 1
  },
  {
    "uuid": "8b3f048d-ef1f-4a91-b4f9-758d42441001",
    "order": 2
  }
]
```

**Success Response (200):**

```json
{
  "ok": true
}
```

**Endpoint:** `GET /api/v1/admin/funnel/steps/:uuid/edit`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Success Response (200):**

```json
{
  "order": 2,
  "isActive": true
}
```

**Endpoint:** `PATCH /api/v1/admin/funnel/steps/:uuid`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `order` | number | No | Updated order |
| `isActive` | boolean | No | Active toggle |

**Success Response (200):**

```json
{
  "uuid": "8b3f048d-ef1f-4a91-b4f9-758d42441001",
  "sectionUuid": "7e224c7d-b00d-40da-84fb-a98741521001",
  "type": "PAYMENT_GATE",
  "order": 2,
  "isActive": true,
  "createdAt": "2026-03-01T05:20:00.000Z",
  "updatedAt": "2026-04-11T07:40:00.000Z"
}
```

**Endpoint:** `DELETE /api/v1/admin/funnel/steps/:uuid`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Success Response (200):**

```json
{
  "ok": true
}
```

**Endpoint:** `GET /api/v1/admin/funnel/steps/:stepUuid/content/edit`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Success Response (200):**

```json
{
  "title": "Why Kangen Water Works",
  "description": "Opening conviction step",
  "videoUrl": "https://iframe.mediadelivery.net/embed/98765/funnel-intro",
  "videoDuration": 720,
  "thumbnailUrl": "https://r2-url/nsi-thumbnails/funnel-intro.jpg",
  "textContent": "<p>Supportive copy under the video.</p>",
  "requireVideoCompletion": true
}
```

**Endpoint:** `PATCH /api/v1/admin/funnel/steps/:stepUuid/content`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `title` | string | Yes | Step title |
| `description` | string | No | Supporting description |
| `videoUrl` | string | No | Video URL |
| `videoDuration` | number | No | Duration in seconds |
| `thumbnailUrl` | string | No | Thumbnail URL |
| `textContent` | string | No | HTML content |
| `requireVideoCompletion` | boolean | No | Whether the video must be completed |

**Success Response (200):**

```json
{
  "uuid": "0dbb9b8c-eaf8-4a75-b985-253e3c2b1001",
  "stepUuid": "19c69d0b-87b6-458b-befb-d85f82811001",
  "title": "Why Kangen Water Works",
  "description": "Opening conviction step",
  "videoUrl": "https://iframe.mediadelivery.net/embed/98765/funnel-intro",
  "videoDuration": 720,
  "thumbnailUrl": "https://r2-url/nsi-thumbnails/funnel-intro.jpg",
  "textContent": "<p>Supportive copy under the video.</p>",
  "requireVideoCompletion": true,
  "createdAt": "2026-03-01T05:10:01.000Z",
  "updatedAt": "2026-04-11T07:45:00.000Z"
}
```

**Endpoint:** `GET /api/v1/admin/funnel/steps/:stepUuid/phone/edit`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Success Response (200):**

```json
{
  "title": "Verify your phone number",
  "subtitle": "We will use this to connect you with the right guide.",
  "isActive": true
}
```

**Endpoint:** `PATCH /api/v1/admin/funnel/steps/:stepUuid/phone`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `title` | string | No | Gate title |
| `subtitle` | string | No | Supporting copy |
| `isActive` | boolean | No | Active toggle |

**Success Response (200):**

```json
{
  "uuid": "a429db7f-55da-4554-87fe-0c828ac91001",
  "stepUuid": "5c1b6849-0bfa-4428-a8d0-9afee1f21001",
  "title": "Verify your phone number",
  "subtitle": "We will use this to connect you with the right guide.",
  "isActive": true
}
```

**Endpoint:** `GET /api/v1/admin/funnel/steps/:stepUuid/payment/edit`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Success Response (200):**

```json
{
  "heading": "Unlock commitment",
  "subheading": "Small fee to secure serious buyers",
  "amount": 999,
  "currency": "INR",
  "ctaText": "Pay Now",
  "features": [
    "Priority callback"
  ],
  "trustBadges": [
    "Secure checkout"
  ],
  "testimonials": [
    {
      "name": "Rakesh",
      "text": "Worth it",
      "avatarInitials": "RK"
    }
  ],
  "allowCoupons": true,
  "enabled": true
}
```

**Endpoint:** `PATCH /api/v1/admin/funnel/steps/:stepUuid/payment`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `heading` | string | Yes | Main heading |
| `subheading` | string | Yes | Supporting copy |
| `amount` | number | Yes | Amount in rupees as stored by backend config |
| `currency` | string | Yes | Currency code |
| `ctaText` | string | Yes | CTA label |
| `features` | string[] | Yes | Feature bullets |
| `trustBadges` | string[] | Yes | Trust badges |
| `testimonials` | object[] | Yes | Array of `{ name, text, avatarInitials, location? }` |
| `allowCoupons` | boolean | Yes | Coupon toggle |
| `enabled` | boolean | Yes | Active toggle |

**Success Response (200):**

```json
{
  "uuid": "1b862166-9d0d-45b8-9b18-8573f4321001",
  "stepUuid": "8b3f048d-ef1f-4a91-b4f9-758d42441001",
  "title": "Unlock commitment",
  "subtitle": "{\"subheading\":\"Small fee to secure serious buyers\",\"ctaText\":\"Pay Now\",\"features\":[\"Priority callback\"],\"trustBadges\":[\"Secure checkout\"],\"testimonials\":[{\"name\":\"Rakesh\",\"text\":\"Worth it\",\"avatarInitials\":\"RK\"}]}",
  "amount": "999",
  "currency": "INR",
  "allowCoupons": true,
  "isActive": true
}
```

**Endpoint:** `GET /api/v1/admin/funnel/steps/:stepUuid/decision/edit`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Success Response (200):**

```json
{
  "question": "Are you interested in buying a Kangen machine?",
  "yesLabel": "Yes, I am interested!",
  "noLabel": "Not right now",
  "yesSubtext": "I want to speak to the team.",
  "noSubtext": "Show me the learning content first."
}
```

**Endpoint:** `PATCH /api/v1/admin/funnel/steps/:stepUuid/decision`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `question` | string | No | Decision question |
| `yesLabel` | string | No | Positive CTA label |
| `noLabel` | string | No | Negative CTA label |
| `yesSubtext` | string | No | Positive supporting text |
| `noSubtext` | string | No | Negative supporting text |

**Success Response (200):**

```json
{
  "uuid": "254cfda6-0dde-4a46-b6fa-30f575261001",
  "stepUuid": "be7c2527-2d99-4bce-a4b6-fc94459a1001",
  "question": "Are you interested in buying a Kangen machine?",
  "yesLabel": "Yes, I am interested!",
  "noLabel": "Not right now",
  "yesSubtext": "I want to speak to the team.",
  "noSubtext": "Show me the learning content first."
}
```

**Endpoint:** `GET /api/v1/admin/funnel/validate`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Success Response (200):**

```json
{
  "warnings": [
    {
      "code": "PAYMENT_BEFORE_PHONE",
      "message": "Payment gate is placed before phone gate. Users will pay before verifying their phone number. Is this intentional?",
      "severity": "warning"
    },
    {
      "code": "DECISION_NOT_LAST",
      "message": "Decision step is not the last step. Any steps after it will never be shown to users.",
      "severity": "warning"
    }
  ]
}
```

**Error Responses (all funnel CMS endpoints above):**

| Status | Message | When |
| --- | --- | --- |
| 400 | Validation failed | Request body is missing required fields or contains invalid values |
| 400 | Cannot delete section — 3 user(s) are currently on it | Section delete is blocked by active user progress |
| 400 | Cannot delete step — 2 user(s) are currently on it | Step delete is blocked by active user progress |
| 400 | Content not found or invalid step type | Content edit endpoint called on the wrong step type |
| 400 | Phone gate not found or invalid step type | Phone edit endpoint called on the wrong step type |
| 400 | Payment gate not found or invalid step type | Payment edit endpoint called on the wrong step type |
| 400 | Decision step not found or invalid step type | Decision edit endpoint called on the wrong step type |
| 400 | This endpoint is only for VIDEO_TEXT steps | Wrong content update endpoint for the step type |
| 400 | This endpoint is only for PHONE_GATE steps | Wrong phone update endpoint for the step type |
| 400 | This endpoint is only for PAYMENT_GATE steps | Wrong payment update endpoint for the step type |
| 400 | This endpoint is only for DECISION steps | Wrong decision update endpoint for the step type |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | Section not found | Section UUID does not exist |
| 404 | Step not found | Step UUID does not exist |

---

## Section 11 - Coupon Management

### 11.1 Coupon List Page (`/admin/coupons`)

- **Who sees it:** `SUPER_ADMIN` only.
- **On load:** `GET /admin/coupons`.
- **User flow:** Admin creates coupons, edits coupons, toggles active/inactive state through the edit flow, and deletes coupons when safe.
- **UI logic:** Show code, discount type/value, scope, expiry, usage limits, active state, and computed status. Used coupons should be treated as soft-delete candidates, not hard-delete assumptions.
- **Error handling:** Expired coupons cannot be reactivated, so block that toggle path with a plain-language explanation. Used-coupon delete should explain that historical payment integrity is preserved.
- **Navigation:** Create/edit -> `/admin/coupons/:uuid/edit` or modal.

**API Contracts**

**Endpoint:** `GET /api/v1/admin/coupons`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Query Params:**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | string | No | One of `active`, `inactive`, `expired`, `all` |

**Success Response (200):**

```json
[
  {
    "uuid": "f0c2a14d-5f7a-4f87-809f-b4d7a0ce1001",
    "code": "NSI500",
    "type": "FLAT",
    "value": 500,
    "applicableTo": "COMMITMENT_FEE",
    "usageLimit": 100,
    "usedCount": 12,
    "perUserLimit": 1,
    "expiresAt": "2026-05-31T18:30:00.000Z",
    "isActive": true,
    "createdAt": "2026-04-01T05:30:00.000Z",
    "updatedAt": "2026-04-01T05:30:00.000Z",
    "status": "ACTIVE"
  }
]
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |

**Endpoint:** `POST /api/v1/admin/coupons`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `code` | string | Yes | Uppercase alphanumeric coupon code, 4-20 chars |
| `type` | enum | Yes | One of `FLAT`, `PERCENT`, `FREE` |
| `value` | number | Yes | Discount amount or percentage |
| `applicableTo` | enum | Yes | One of `ALL`, `COMMITMENT_FEE`, `LMS_COURSE`, `DISTRIBUTOR_SUB` |
| `usageLimit` | number | No | Global usage limit |
| `perUserLimit` | number | No | Per-user usage limit, default `1` |
| `expiresAt` | ISO datetime string | No | Expiry timestamp |

**Success Response (201):**

```json
{
  "uuid": "f0c2a14d-5f7a-4f87-809f-b4d7a0ce1001",
  "code": "NSI500",
  "type": "FLAT",
  "value": 500,
  "applicableTo": "COMMITMENT_FEE",
  "usageLimit": 100,
  "usedCount": 0,
  "perUserLimit": 1,
  "expiresAt": "2026-05-31T18:30:00.000Z",
  "isActive": true,
  "createdAt": "2026-04-01T05:30:00.000Z",
  "updatedAt": "2026-04-01T05:30:00.000Z",
  "status": "ACTIVE"
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Coupon code must be uppercase alphanumeric | `code` fails validation |
| 400 | Expiry date must be in the future | Submitted expiry is already in the past |
| 400 | Validation failed | Invalid enum or numeric fields |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 409 | Coupon code already exists | `code` is already taken |

**Endpoint:** `GET /api/v1/admin/coupons/:uuid`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Success Response (200):**

```json
{
  "uuid": "f0c2a14d-5f7a-4f87-809f-b4d7a0ce1001",
  "code": "NSI500",
  "type": "FLAT",
  "value": 500,
  "applicableTo": "COMMITMENT_FEE",
  "usageLimit": 100,
  "usedCount": 12,
  "perUserLimit": 1,
  "expiresAt": "2026-05-31T18:30:00.000Z",
  "isActive": true,
  "createdAt": "2026-04-01T05:30:00.000Z",
  "updatedAt": "2026-04-10T05:30:00.000Z",
  "uses": [
    {
      "uuid": "845970bf-1e9e-4c12-a731-0c6498361001",
      "couponUuid": "f0c2a14d-5f7a-4f87-809f-b4d7a0ce1001",
      "userUuid": "1d7f3b28-3dda-4424-8a95-8b12829a1001",
      "createdAt": "2026-04-04T08:00:00.000Z",
      "user": {
        "uuid": "1d7f3b28-3dda-4424-8a95-8b12829a1001",
        "fullName": "Mihir Patel",
        "email": "mihir@example.com"
      }
    }
  ],
  "status": "ACTIVE"
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | Coupon not found | UUID does not resolve to a coupon |

**Endpoint:** `GET /api/v1/admin/coupons/:uuid/edit`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Success Response (200):**

```json
{
  "isActive": true,
  "expiresAt": "2026-05-31T18:30:00.000Z",
  "usageLimit": 100
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | Coupon not found | UUID does not resolve to a coupon |

**Endpoint:** `PATCH /api/v1/admin/coupons/:uuid`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `isActive` | boolean | No | Active toggle |
| `expiresAt` | ISO datetime string | No | Updated expiry |
| `usageLimit` | number | No | Updated usage limit |

**Success Response (200):**

```json
{
  "uuid": "f0c2a14d-5f7a-4f87-809f-b4d7a0ce1001",
  "code": "NSI500",
  "type": "FLAT",
  "value": 500,
  "applicableTo": "COMMITMENT_FEE",
  "usageLimit": 100,
  "usedCount": 12,
  "perUserLimit": 1,
  "expiresAt": "2026-05-31T18:30:00.000Z",
  "isActive": true,
  "createdAt": "2026-04-01T05:30:00.000Z",
  "updatedAt": "2026-04-11T08:00:00.000Z",
  "status": "ACTIVE"
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Expiry date must be in the future | Submitted expiry is already in the past |
| 400 | Cannot reactivate an expired coupon. Please create a new coupon with a new expiry date. | Attempted to reactivate an expired coupon |
| 400 | Validation failed | Invalid boolean, date, or numeric fields |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | Coupon not found | UUID does not resolve to a coupon |

**Endpoint:** `DELETE /api/v1/admin/coupons/:uuid`  
**Auth:** Bearer token (`SUPER_ADMIN`)

**Success Response (200) - used coupon soft delete:**

```json
{
  "message": "Coupon deactivated. Cannot hard delete because it has been used."
}
```

**Alternate Success Response (200) - never-used coupon hard delete:**

```json
{
  "message": "Coupon permanently deleted."
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden resource | User is authenticated but not a super admin |
| 404 | Coupon not found | UUID does not resolve to a coupon |

---

## Section 12 - Public Pages

### 12.1 Join Link Landing Page (`/join/:code`)

- **Who sees it:** Public users.
- **On load:** `GET /distributor/join/:code`.
- **User flow:** Validate the code, show the referring distributor identity if valid, then let the user click Get Started and move into signup with hidden referral context.
- **UI logic:** If valid, keep the referral code in state/storage and inject it into signup automatically. The user should never type the referral code manually.
- **Error handling:** Invalid or inactive code should show a dedicated error state. A good fallback is a CTA to normal signup without referral, but keep the invalid-link message explicit.
- **Navigation:** Valid -> `/signup` with referral context preserved. Invalid -> `/signup` or `/login` without referral.

**API Contracts**

**Endpoint:** `GET /api/v1/distributor/join/:code`  
**Auth:** Public

**Success Response (200):**

```json
{
  "distributorUuid": "eac62c10-97a0-476e-8f7b-6ec4d4f51001",
  "fullName": "Rudra Shah",
  "code": "NSI-RUDRA",
  "isActive": true
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 404 | Invalid referral code | No distributor exists for that code |
| 404 | This referral link is no longer active | Distributor exists but join link is disabled |

### 12.2 Campaign Landing Page (`/c/:slug`)

- **Who sees it:** Public users.
- **On load:** Read `utm_*` query params and call `POST /tracking/capture`. This call should be fire-and-forget from the UX point of view.
- **User flow:** User lands from a campaign, tracking is captured, then the frontend routes them into the intended acquisition path such as signup, join-link flow, or funnel entry.
- **UI logic:** Current backend does not expose a public campaign lookup endpoint by slug, so this page is mainly a frontend marketing route plus UTM capture step. Do not block the redirect if tracking fails.
- **Error handling:** If `POST /tracking/capture` fails, continue the redirect anyway. Tracking loss should not become user-facing friction.
- **Navigation:** Common destinations are `/signup`, `/join/:code`, or a marketing pre-funnel route depending on campaign design.

**API Contracts**

**Endpoint:** `POST /api/v1/tracking/capture`  
**Auth:** Public

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `utmSource` | string | No | UTM source |
| `utmMedium` | string | No | UTM medium |
| `utmCampaign` | string | No | UTM campaign |
| `utmContent` | string | No | UTM content |
| `utmTerm` | string | No | UTM term |
| `referrerUrl` | string | No | Referrer page URL |
| `landingPage` | string | No | Page where the visit landed |
| `distributorCode` | string | No | Distributor referral code |
| `deviceType` | string | No | Device type label |
| `browser` | string | No | Browser label |

**Success Response (201):**

```json
{
  "ok": true
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 400 | Validation failed | Invalid request body fields |
| 429 | Too Many Requests | Tracking endpoint is throttled |

---

## Section 13 - Navigation and Auth State

### Global Auth Bootstrap

- **Protected app load:** If there is no in-memory `accessToken` but a refresh cookie may exist, call `POST /auth/refresh` first, then `GET /auth/me`.
- **401 handling:** Any protected request that ends in unrecoverable `401` should clear local auth state and redirect to `/login`.
- **403 handling:** If the user is authenticated but hits the wrong role area, redirect to the correct home page instead of leaving them on a dead-end forbidden screen.
- **Onboarding handling:** If login, OTP verify, or OAuth callback returns `needsCountry=true`, force `/complete-profile` before all other protected routes.
- **Logout:** `POST /auth/logout`, clear in-memory auth state, then redirect to `/login`.

**API Contracts**

**Endpoint:** `POST /api/v1/auth/refresh`  
**Auth:** Refresh token via HttpOnly `refresh_token` cookie

**Request Body:** No JSON body required.

**Success Response (200):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh.2026",
  "user": {
    "uuid": "7a9c2db6-ef87-4a62-b67f-ec1c28251001",
    "fullName": "Rajesh Patel",
    "email": "rajesh.patel@example.com",
    "role": "USER",
    "status": "ACTIVE",
    "avatarUrl": "https://res.cloudinary.com/nsi/image/upload/v1712800/avatar-rajesh.jpg"
  },
  "needsCountry": false
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Refresh token is required | Cookie is missing |
| 401 | Invalid or expired refresh token | Session lookup or hash check failed |
| 401 | User not found | Session exists but linked user record no longer exists |
| 403 | Your account has been suspended | Refreshed user is suspended |

**Endpoint:** `GET /api/v1/auth/me`  
**Auth:** Bearer token (any authenticated user)

**Success Response (200):**

```json
{
  "user": {
    "uuid": "7a9c2db6-ef87-4a62-b67f-ec1c28251001",
    "fullName": "Rajesh Patel",
    "email": "rajesh.patel@example.com",
    "role": "USER",
    "status": "ACTIVE",
    "avatarUrl": "https://res.cloudinary.com/nsi/image/upload/v1712800/avatar-rajesh.jpg",
    "country": "India"
  }
}
```

**Error Responses:**

| Status | Message | When |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 401 | User not found | Token is valid but user record no longer exists |

**Endpoint:** `POST /api/v1/auth/logout`  
**Auth:** Optional bearer token plus refresh cookie if present

**Request Body:** No JSON body required.

**Success Response (200):**

```json
{
  "message": "Logged out successfully."
}
```

**Error Responses:** None. The endpoint succeeds even if the cookie or bearer token is already missing/expired.

### Role-Based Home Routing

| Role | Default home |
| --- | --- |
| `USER` | `/funnel` |
| `CUSTOMER` | `/lms/courses` |
| `DISTRIBUTOR` | `/distributor/dashboard` |
| `SUPER_ADMIN` | `/admin/dashboard` |

### Role-Based Navigation

| Role | Main nav items |
| --- | --- |
| `USER` | Funnel, Profile |
| `CUSTOMER` | LMS, My Courses, Profile, Become Distributor |
| `DISTRIBUTOR` | Dashboard, Leads, Users, Tasks, Calendar, Campaigns, Join Link, LMS, Profile |
| `SUPER_ADMIN` | Dashboard, Users, Leads, Analytics, Distributors, Plans, Courses, Funnel CMS, Coupons, Profile |

### Route Protection Rules

- Public pages: `/signup`, `/verify-email`, `/login`, `/forgot-password`, `/reset-password`, `/join/:code`, `/c/:slug`, `/auth/callback`
- Auth-only pages: `/complete-profile`, `/profile`
- Funnel-only path: `/funnel` for in-progress onboarding users
- LMS path: only `CUSTOMER` and `DISTRIBUTOR`
- Distributor shell: only `DISTRIBUTOR`
- Admin shell: only `SUPER_ADMIN`

### Key Rules for Rudra

1. Never trust frontend role alone. Backend guards are the source of truth on every protected request.
2. Keep `accessToken` in memory only. The refresh token belongs in the HttpOnly cookie.
3. Every ID in the system is a UUID. Do not build numeric-ID assumptions anywhere.
4. Use backend-generated Razorpay order/subscription values as checkout-ready. If the frontend ever computes its own Razorpay amount from rupees, convert to paise before sending.
5. Email sending is fire-and-forget. The frontend should move ahead after API success and not wait for email-delivery confirmation.
6. When showing lead status, use `displayStatus`. `MARK_AS_CUSTOMER` should render as `Customer`.
7. Build lead status action menus from `availableActions`, not from hardcoded transition lists.
8. Never expose `enrollmentBoost`. Show only `displayEnrollmentCount`.
9. `GRACE` exists in enums but is not a user-facing status right now.
10. Use Swagger at `/api/docs` whenever you need exact fields, payloads, or response types.

---

Source of truth used while preparing this guide:

- backend controllers and services in `src/auth`, `src/funnel`, `src/payment`, `src/phone`, `src/lms`, `src/leads`, `src/distributor`, `src/admin`, `src/campaign`, `src/coupon`, and `src/tracking`
- existing internal docs in `docs/`
