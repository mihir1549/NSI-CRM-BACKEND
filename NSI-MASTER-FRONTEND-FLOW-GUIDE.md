# NSI Platform - Master Frontend Flow Guide

Audience: Rudra (frontend)

Document version: 1.0  
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

It intentionally does not document payload shapes in detail. Use Swagger for that.

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

### 1.2 OTP Verification Page (`/verify-email`)

- **Who sees it:** Public users who just signed up or are returning to finish email verification.
- **On load:** No required API call. Prefill email from query/state if present.
- **User flow:** User enters the 6-digit OTP and submits to `POST /auth/verify-email-otp`. On success, store `accessToken` in memory, let the refresh cookie stay automatic, then inspect `needsCountry`. If `needsCountry=true`, send the user to `/complete-profile`; otherwise continue with post-login routing. The resend button calls `POST /auth/resend-otp`.
- **UI logic:** Use six numeric boxes or one masked field. Auto-advance focus between boxes. Disable resend for 60 seconds with a visible countdown. If the backend reports the user is already verified, send them to `/login`.
- **Error handling:** Invalid or expired OTP should show an inline error near the input. If attempts are running low, show remaining attempts. If the backend blocks further attempts, lock the form and force a resend/new OTP flow.
- **Navigation:** Success -> `/complete-profile` when `needsCountry=true`, else role-based home. Manual escape hatch -> `/login`.

### 1.3 Complete Profile Page (`/complete-profile`)

- **Who sees it:** Authenticated users with incomplete onboarding, usually right after OTP verification or first Google login.
- **On load:** If the app reloads on this page, call `GET /auth/me` to confirm the user still exists and still needs this step.
- **User flow:** User selects country and submits to `POST /auth/complete-profile`. After success, refresh auth state with `GET /auth/me` or trusted local state hydration, then continue normal routing.
- **UI logic:** This page is mandatory when onboarding is incomplete. Do not let the user access funnel, LMS, distributor pages, or admin pages until this step is done.
- **Error handling:** Show field-level error for missing country. If the token is missing or expired, send the user to `/login`. If the user no longer needs this step, redirect away instead of showing a dead-end form.
- **Navigation:** Success -> role-based home. Cancel/back is usually not needed; logout is acceptable.

### 1.4 Login Page (`/login`)

- **Who sees it:** Public users. Authenticated users should be redirected away.
- **On load:** No required API call on the page itself. If your app shell supports silent session restore, that should happen before rendering this page fully.
- **User flow:** User enters email and password, submits to `POST /auth/login`, stores the `accessToken` in memory, and lets the refresh cookie remain HttpOnly. If `needsCountry=true`, route to `/complete-profile`. Otherwise route by backend role: `SUPER_ADMIN -> /admin/dashboard`, `DISTRIBUTOR -> /distributor/dashboard`, `CUSTOMER -> /lms/courses`, `USER -> /funnel`. Google OAuth starts with `GET /auth/google`, optionally carrying referral context.
- **UI logic:** Show a "Forgot password" link. Keep the Google button on parity with email login. If login came from a protected page redirect, remember the intended destination but still honor onboarding and role guard rules first.
- **Error handling:** `401` invalid credentials -> inline form error. "Please verify your email first" -> show a direct link to `/verify-email` and optionally prefill the email. Suspended-account responses should render a blocking message instead of repeated retries.
- **Navigation:** Success -> `/complete-profile` or the correct home page. Secondary -> `/forgot-password`, `/signup`.

### 1.5 Forgot Password Page (`/forgot-password`)

- **Who sees it:** Public users.
- **On load:** Nothing required.
- **User flow:** User enters email and submits to `POST /auth/forgot-password`. Always show a generic success state. The next step is the OTP-based reset page, not a token-link-only screen.
- **UI logic:** Never confirm whether the email exists. Keep the success message identical for valid and invalid addresses. A clean pattern is to show a "Continue to reset password" button after submit.
- **Error handling:** If the backend returns a rate-limit error, show a plain-language retry message. Do not leak whether the user exists.
- **Navigation:** Success state can push to `/reset-password?email=...` or simply show an inline CTA to continue there. Secondary -> `/login`.

### 1.6 Reset Password Page (`/reset-password`)

- **Who sees it:** Public users who requested a reset.
- **On load:** No required API call. Prefill email from query or carry it from `/forgot-password`.
- **User flow:** User enters email, OTP, new password, and confirm password. Submit to `POST /auth/reset-password`. On success, show a success toast/banner and move back to login.
- **UI logic:** The current backend is OTP-based, so this page should visibly support OTP entry. If the product later moves to token links, update backend and this guide together. Keep confirm-password validation entirely client-side before submit.
- **Error handling:** Show inline errors for password mismatch. Invalid OTP or expired OTP should appear near the OTP field. If the backend says maximum attempts reached, lock the submit action and route back to `/forgot-password`.
- **Navigation:** Success -> `/login`. Secondary -> `/forgot-password`.

### 1.7 Google OAuth Backend Callback (`/auth/google/callback`)

- **Who sees it:** Nobody in the SPA. This is backend-owned.
- **On load:** Frontend should not call anything here.
- **User flow:** Browser is redirected to Google, then back to the backend callback. The backend handles account merge/create, sets up an OAuth handoff, then redirects the browser again to the frontend callback page.
- **UI logic:** Do not build a visible frontend screen for this path. Treat it as an implementation detail.
- **Error handling:** If Google OAuth fails, the backend should redirect to an error route the SPA can understand.
- **Navigation:** Backend redirect -> frontend callback page, usually `/auth/callback?...`.

### 1.8 Google OAuth Frontend Callback Page (`/auth/callback`)

- **Who sees it:** Public transient page after Google OAuth.
- **On load:** Read query params from the backend redirect, store the access token in memory, then call `GET /auth/me` if you need to fully hydrate user state.
- **User flow:** Parse the token and onboarding flags, initialize auth state, then route the user through the same post-login decision tree as normal login. If `needsCountry=true`, force `/complete-profile`.
- **UI logic:** Show a lightweight "Signing you in..." loader only. This page should not have a full form. It should also be resilient to refreshes until auth state is fully restored.
- **Error handling:** Missing or expired callback data should redirect to a friendly `/login` or `/auth/error` page with a retry CTA.
- **Navigation:** Success -> `/complete-profile` or role-based home.

### 1.9 Set Password Page (`/set-password`)

- **Who sees it:** Authenticated Google-login users who want an email/password login added to their account.
- **On load:** Optional `GET /auth/me` to verify the session is still alive.
- **User flow:** User enters new password and confirm password, then submits to `POST /auth/set-password`. After success, keep the current session and return the user to the app.
- **UI logic:** The current backend supports this endpoint, but it does not expose a dedicated "must set password now" flag after OAuth. So this page should exist, but forcing it immediately after Google login is a product choice, not a backend-enforced rule.
- **Error handling:** Password mismatch stays client-side. Expired session -> `/login`. Backend validation errors should appear inline.
- **Navigation:** Success -> previous page, `/profile`, or the appropriate dashboard with a success toast.

---

## Section 2 - User Profile

### 2.1 Profile Page (`/profile`)

- **Who sees it:** Any authenticated user.
- **On load:** `GET /auth/me` to hydrate the profile form and read role/status/avatar.
- **User flow:** User edits `fullName` and avatar only. For avatar, preferred frontend flow is select image -> upload directly to Cloudinary -> receive URL -> `PATCH /auth/me` with new `avatarUrl`. For name, call `PATCH /auth/me` with `fullName`.
- **UI logic:** Show `email`, `country`, and `role` as read-only fields. If the app uses direct Cloudinary upload, show upload progress before the final profile patch. If you choose backend upload instead, keep the UI identical and swap the transport only.
- **Error handling:** Invalid image type/size should be caught before upload. If Cloudinary fails, keep the old avatar and show retry UI. If the patch fails, revert optimistic UI and show a toast plus inline state.
- **Navigation:** Stay on `/profile` after save. If auth dies mid-edit, redirect to `/login`.

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

### 3.2 Funnel Completion Redirect Logic (global rule)

- **Who sees it:** Any authenticated user at app bootstrap or after login.
- **On load:** When the app needs to decide between funnel and post-funnel areas, call `GET /funnel/progress`.
- **User flow:** If progress shows funnel still active, keep `/funnel` available and prioritize it in routing. If the funnel is complete, never send the user back into the funnel shell.
- **UI logic:** Do not show funnel nav to users who are already beyond it. If a deep link lands on `/funnel` after completion, redirect immediately instead of rendering stale UI.
- **Error handling:** If the funnel check fails but the user is authenticated, show a full-page retry state instead of guessing the next route.
- **Navigation:** Completed funnel -> `CUSTOMER` path usually `/lms/courses`; `DISTRIBUTOR` path `/distributor/dashboard`; `SUPER_ADMIN` path `/admin/dashboard`.

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

### 4.2 Course Landing Page (`/lms/courses/:uuid`)

- **Who sees it:** `CUSTOMER` and `DISTRIBUTOR`.
- **On load:** `GET /lms/courses/:uuid`.
- **User flow:** If not enrolled, user reviews the sales page, explores preview lessons, and clicks Enroll. If enrolled, user reviews progress and goes straight to learning.
- **UI logic for not enrolled users:** Show `previewVideoUrl`, badge, instructors, what-you-will-learn bullets, price block, enrollment count, duration, lesson count, and preview-only lesson interactions. Preview lessons are clickable; locked lessons are visible but disabled.
- **UI logic for enrolled users:** Show progress, section/lesson list, completion states, lock states, and a primary Continue Learning CTA. If `completedAt` exists, show a certificate CTA.
- **Enroll flow:** Call `POST /lms/courses/:uuid/enroll`. For free courses, redirect immediately on success. For paid courses, the same endpoint returns Razorpay order data; open checkout and then poll course detail or my-courses until the enrollment exists.
- **Error handling:** If the course is unpublished or missing, show a proper 404 page. If payment fails, keep the user on the landing page and leave the Enroll button available. If already enrolled, switch to Continue rather than throwing a dead-end error.
- **Navigation:** Not enrolled -> stay on page until enrollment completes, then `/lms/courses/:uuid/learn`. Enrolled lesson click -> `/lms/courses/:uuid/learn`.

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

### 4.4 My Courses Page (`/lms/my-courses`)

- **Who sees it:** `CUSTOMER` and `DISTRIBUTOR`.
- **On load:** `GET /lms/my-courses`.
- **User flow:** User reviews enrolled courses, sees progress and last activity, then resumes a course.
- **UI logic:** Each course card shows thumbnail, title, progress bar, `completedLessons / totalLessons`, `lastActivityAt`, and certificate/download CTA if complete.
- **Error handling:** Empty state should encourage browsing `/lms/courses`. If a course was unpublished after enrollment, still keep the item visible if the backend returns it.
- **Navigation:** Course click -> `/lms/courses/:uuid/learn`.

### 4.5 Certificate Action Page (`/lms/courses/:uuid/certificate`)

- **Who sees it:** Users who completed the course.
- **On load:** Usually triggered by button click, not as a browsed page. Call `GET /lms/courses/:uuid/certificate`.
- **User flow:** Fetch certificate metadata and open the returned `certificateUrl` in a new tab.
- **UI logic:** If the user completed the course, show the CTA from both the landing page and My Courses. Do not show the CTA before completion.
- **Error handling:** If the backend says the course is not complete yet, show "Complete the course first" and return the user to the learning page.
- **Navigation:** Open the PDF in a new tab and keep the current app page intact.

---

## Section 5 - Distributor Pages

### 5.1 Distributor Subscription Page (`/distributor/subscribe`)

- **Who sees it:** Authenticated users who are not currently active distributors. In product routing this is mainly `CUSTOMER`, but the backend accepts any authenticated user.
- **On load:** `GET /distributor/plans`. Also read current user/session state so you can redirect existing distributors away.
- **User flow:** User reviews plans, chooses one, then submits `POST /distributor/subscribe`. If the backend returns a Razorpay subscription link, open it. After payment, refresh auth state and/or poll subscription status until the role becomes `DISTRIBUTOR`.
- **UI logic:** Show plan name, amount, features, tagline, testimonials, trust badges, highlight badge, and CTA text. If the user already has a `HALTED` subscription, show an Update Payment Method path instead of a normal Subscribe CTA.
- **Error handling:** If the backend says the user already has an active subscription, redirect to `/distributor/dashboard`. If the backend returns a payment-method-update requirement, surface that action clearly instead of a generic error.
- **Navigation:** Success -> `/distributor/dashboard`. Existing distributor -> `/distributor/dashboard`.

### 5.2 Distributor Dashboard Page (`/distributor/dashboard`)

- **Who sees it:** `DISTRIBUTOR` only.
- **On load:** `GET /distributor/dashboard`. If the header has a live notification badge, also fetch `GET /distributor/notifications` globally.
- **User flow:** User checks stats, copies join link, opens quick actions, and jumps into users, leads, tasks, calendar, or campaigns.
- **UI logic:** Show total referred users/leads, hot leads, contacted leads, customers, conversion rate, subscription summary card, and join-link summary. If dashboard join-link data does not include QR code, fetch `/distributor/join-link` when the user opens the full share card.
- **Error handling:** If the user is not a distributor anymore, redirect out of the distributor shell. If dashboard sub-sections fail independently, keep partial cards visible instead of blanking the whole page.
- **Navigation:** Quick actions -> `/distributor/users`, `/distributor/leads`, `/distributor/tasks`, `/distributor/calendar`, `/distributor/campaigns`, `/distributor/join-link`.

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

### 5.4 Subscription History Page (`/distributor/subscription/history`)

- **Who sees it:** `DISTRIBUTOR` only.
- **On load:** `GET /distributor/subscription/history`.
- **User flow:** User reviews timeline or table entries such as `SUBSCRIBED`, `CHARGED`, `SELF_CANCELLED`, and migration events.
- **UI logic:** Show event name, amount if present, invoice number if present, and formatted created date. If invoice number exists, render a Download Invoice action.
- **Error handling:** Empty history should show a calm placeholder like "No billing events yet." Missing invoice documents should fail softly with a retry/open-later message.
- **Navigation:** Invoice click -> open the invoice PDF in a new tab. A practical fallback is the public invoice path based on `invoiceNumber`.

### 5.5 Distributor Users Page (`/distributor/users`)

- **Who sees it:** `DISTRIBUTOR` only.
- **On load:** `GET /distributor/users/analytics` and `GET /distributor/users`.
- **User flow:** User scans referred users, filters/searches, then opens user detail to inspect funnel and payment activity.
- **UI logic:** Show top analytics cards plus a searchable/filterable table. Funnel stage filters should be URL-driven so the page is shareable/bookmarkable.
- **Error handling:** If analytics fails but the list succeeds, keep the list visible. If a selected user no longer belongs to this distributor, show a "Not available" message instead of exposing other-network data.
- **Navigation:** Detail click -> `/distributor/users/:uuid` or an in-page detail drawer. Lead-specific next step -> `/distributor/leads` if the user is already a lead.

### 5.6 Distributor Tasks Page (`/distributor/tasks`)

- **Who sees it:** `DISTRIBUTOR` only.
- **On load:** `GET /distributor/tasks`.
- **User flow:** User creates tasks, edits tasks, drags them between columns, and deletes tasks after confirmation.
- **UI logic:** Render three Kanban columns: `TODO`, `IN_PROGRESS`, `COMPLETE`. Use optimistic drag-and-drop updates, but revert the card if `PATCH /distributor/tasks/:uuid/move` fails.
- **Error handling:** Failed create/edit should keep the modal open with inline errors. Failed delete should restore the card and show a retry toast.
- **Navigation:** Optional lead link on a task should jump to the related lead detail page.

### 5.7 Distributor Calendar Page (`/distributor/calendar`)

- **Who sees it:** `DISTRIBUTOR` only.
- **On load:** `GET /distributor/calendar?month=...&year=...`.
- **User flow:** User changes month, reviews task due dates and follow-ups, writes personal notes, and deletes notes when needed.
- **UI logic:** Merge task/follow-up events with personal-note events in one month view. Notes are upserted per date, so editing the same day should overwrite the existing note instead of creating duplicates.
- **Error handling:** Keep month navigation usable even if one fetch fails. If note save fails, leave the editor open and do not clear the typed content.
- **Navigation:** Event click -> task page, lead detail, or note editor. Add follow-up CTA can route to `/distributor/leads` or `/distributor/followups/today`.

### 5.8 Distributor Notifications Page (`/distributor/notifications`)

- **Who sees it:** `DISTRIBUTOR` only.
- **On load:** `GET /distributor/notifications`.
- **User flow:** User opens the notification center, reviews due items, and jumps into the relevant task or lead.
- **UI logic:** Also use this endpoint for the nav badge count if the header is shared across distributor pages.
- **Error handling:** If notifications fail, keep the rest of the app usable and show the badge as unavailable rather than zero.
- **Navigation:** Task notification -> `/distributor/tasks`. Follow-up notification -> `/distributor/leads/:uuid` or `/distributor/followups/today`.

### 5.9 Distributor Join Link Page (`/distributor/join-link`)

- **Who sees it:** `DISTRIBUTOR` only.
- **On load:** `GET /distributor/join-link`.
- **User flow:** User copies the join URL, downloads/shares the QR code, and posts the link externally.
- **UI logic:** Render the QR code directly from the returned data URL. If `isActive=false`, still show the code/URL for context but disable share/copy actions and explain that admin reactivation is required.
- **Error handling:** Copy/share failures should not look like backend failures. If the fetch fails, offer retry and keep the share page mounted.
- **Navigation:** Back to dashboard, or deep link to campaign creation for tracked links.

### 5.10 Distributor UTM Analytics Page (`/distributor/analytics`)

- **Who sees it:** `DISTRIBUTOR` only.
- **On load:** `GET /distributor/analytics/utm`.
- **User flow:** User reads source, medium, and campaign breakdowns to see what is converting.
- **UI logic:** Show both chart and table views if possible. Date-range controls can be local page state if product wants trend windows.
- **Error handling:** Empty analytics should say "No tracked signups yet" instead of showing a broken chart.
- **Navigation:** Related campaign drill-down -> `/distributor/campaigns`.

---

## Section 6 - Campaign Pages

### 6.1 Distributor Campaign List Page (`/distributor/campaigns`)

- **Who sees it:** `DISTRIBUTOR` only.
- **On load:** `GET /distributor/campaigns`.
- **User flow:** User creates campaigns, edits campaign settings, toggles active state, reviews click/conversion data, and deletes unused campaigns.
- **UI logic:** Show name, generated URL, UTM values, active state, and performance stats. Create/edit can live in modals or dedicated edit routes; both fit the current backend.
- **Error handling:** Slug conflicts should show inline on create/edit. Delete needs a confirm step. If analytics data is delayed, keep the campaign itself visible.
- **Navigation:** Edit -> `/distributor/campaigns/:uuid/edit` or modal. Detail analytics -> `/distributor/campaigns/:uuid`.

### 6.2 Admin Campaign List Page (`/admin/campaigns`)

- **Who sees it:** `SUPER_ADMIN` only.
- **On load:** `GET /admin/campaigns`.
- **User flow:** Admin reviews campaigns across all owners, edits any campaign, and optionally uses the same create/delete tools if the admin UI exposes them.
- **UI logic:** Same core list as distributor campaigns, but add owner info and owner type. This is the best place to spot inactive campaigns or bad tracking setups across the network.
- **Error handling:** Missing campaign detail/edit data should fall back to the list page with a toast. Conflicts still need inline editing feedback.
- **Navigation:** Edit/detail -> `/admin/campaigns/:uuid/edit` or `/admin/campaigns/:uuid`.

---

## Section 7 - Lead Management Pages

### 7.1 Distributor Lead List Page (`/distributor/leads`)

- **Who sees it:** `DISTRIBUTOR` only.
- **On load:** `GET /leads`.
- **User flow:** User filters/searches leads, opens the action dropdown built from `availableActions`, and updates status through `PATCH /leads/:uuid/status`.
- **UI logic:** Always show `displayStatus`, not raw status labels. Build status-action menus dynamically from `availableActions`; do not hardcode transitions. When moving to `FOLLOWUP`, require notes plus a future datetime before submit.
- **Error handling:** Invalid transition, missing follow-up data, or ownership errors should keep the row on screen and show an actionable message. If a lead disappears because of scoping changes, refresh the list and show that it is no longer available.
- **Navigation:** Lead click -> `/distributor/leads/:uuid`.

### 7.2 Admin Lead List Page (`/admin/leads`)

- **Who sees it:** `SUPER_ADMIN` only.
- **On load:** `GET /admin/leads`. If a distributor filter is selected, use `GET /admin/leads/distributor/:distributorUuid`.
- **User flow:** Admin searches, filters by status, optionally filters by distributor, then updates lead status or opens detail.
- **UI logic:** Keep distributor filter and status filter in the URL so the page is shareable. Admin uses the same transition logic as distributor, so the dropdown should still be constrained by backend rules.
- **Error handling:** Bad filters should not break the page. If distributor-scoped results are empty, show "No leads for this distributor" instead of a generic empty state.
- **Navigation:** Lead click -> `/admin/leads/:uuid`.

### 7.3 Lead Detail Page (`/distributor/leads/:uuid`, `/admin/leads/:uuid`)

- **Who sees it:** Distributor for own leads, admin for any lead.
- **On load:** Call the role-appropriate detail endpoint: `GET /leads/:uuid` or `GET /admin/leads/:uuid`.
- **User flow:** User reviews profile, funnel progress, payment history, activity timeline, and scheduled follow-ups. Status changes happen from the detail header as well.
- **UI logic:** Show funnel progress clearly, highlight latest activity, and expose follow-up scheduling when applicable. If detail is opened from a list, keep a back path to the filtered list state.
- **Error handling:** `403` on distributor detail should return to `/distributor/leads` with a permissions message. `404` should show a not-found state, not a blank panel.
- **Navigation:** Back to list, or jump to related follow-up/task views.

### 7.4 Today's Follow-ups Page (`/distributor/followups/today`, `/admin/followups/today`)

- **Who sees it:** Distributor or admin, depending on shell.
- **On load:** Distributor shell -> `GET /leads/followups/today`. Admin shell -> `GET /admin/leads/followups/today`.
- **User flow:** User reviews all leads needing action today, updates status quickly, or opens lead detail.
- **UI logic:** This page should behave like an action queue. Group overdue vs due-today if the product wants urgency cues.
- **Error handling:** If the endpoint fails, keep the page simple with a retry CTA. Empty state should say there are no follow-ups due today.
- **Navigation:** Quick action -> status patch in place. Detail -> corresponding lead detail route.

---

## Section 8 - Admin Pages

### 8.1 Admin Dashboard Page (`/admin/dashboard`)

- **Who sees it:** `SUPER_ADMIN` only.
- **On load:** `GET /admin/analytics/dashboard`.
- **User flow:** Admin reviews top KPIs and jumps into users, leads, analytics, courses, distributor management, or funnel CMS.
- **UI logic:** Show cards for total users, leads, revenue, active distributors, and conversion metrics. Keep quick links prominent because this page is the admin shell entry point.
- **Error handling:** Partial-card loading is better than a total blank page. If the user is no longer a super admin, redirect out immediately.
- **Navigation:** Quick links -> `/admin/users`, `/admin/leads`, `/admin/analytics`, `/admin/courses`, `/admin/funnel`, `/admin/distributors`.

### 8.2 Admin Users Page (`/admin/users`)

- **Who sees it:** `SUPER_ADMIN` only.
- **On load:** `GET /admin/users`.
- **User flow:** Admin filters/searches the user table, opens user detail, suspends/reactivates users, and changes role where allowed.
- **UI logic:** Show name, email, role, status, referred-by context, funnel summary, and key lifecycle badges. Role change UI must not offer `SUPER_ADMIN` or direct assignment to `DISTRIBUTOR`.
- **Special warning logic:** If changing from `DISTRIBUTOR` to another role, show a confirmation that the backend will cancel the active distributor subscription and deactivate the join link.
- **Error handling:** Suspension/reactivation failures should leave the row unchanged. Role change failures should keep the select open with the backend reason visible.
- **Navigation:** Detail click -> `/admin/users/:uuid`.

### 8.3 Admin Analytics Page (`/admin/analytics`)

- **Who sees it:** `SUPER_ADMIN` only.
- **On load:** Default tab should call one of the analytics endpoints immediately, usually `GET /admin/analytics/dashboard`.
- **User flow:** Admin switches between Dashboard, Funnel, Revenue, Leads, Distributors, and UTM tabs. Each tab loads its own endpoint on demand.
- **UI logic:** Keep one shared date-range control for all tabs so the admin can compare like-for-like periods. Only fetch a tab when it becomes active unless the dashboard needs parallel preloading.
- **Error handling:** A failed tab should not crash the others. Preserve the selected date range and tab on retry.
- **Navigation:** Drill-down CTAs should move into `/admin/leads`, `/admin/distributors`, `/admin/campaigns`, `/admin/courses`.

### 8.4 Admin Distributor Management Page (`/admin/distributors`)

- **Who sees it:** `SUPER_ADMIN` only.
- **On load:** `GET /admin/distributors`. If the page includes a subscription-management table, also call `GET /admin/distributor-subscriptions`.
- **User flow:** Admin reviews distributors, opens distributor detail, toggles join-link activation, checks subscription records, cancels subscriptions when necessary, and jumps to that distributor's leads.
- **UI logic:** This page works best with two tabs:
  - Distributor directory -> `/admin/distributors`
  - Subscription management -> `/admin/distributor-subscriptions`
- **Error handling:** Keep join-link toggle optimistic only if you also support rollback on failure. Admin cancellation should always ask for confirmation because it changes role/access immediately.
- **Navigation:** Distributor detail -> `/admin/distributors/:uuid`. Subscription detail can be a drawer or `/admin/distributor-subscriptions/:uuid`. View leads -> `/admin/leads?distributor=...` or dedicated distributor leads route.

### 8.5 Admin Plan Management Page (`/admin/distributor-plans`)

- **Who sees it:** `SUPER_ADMIN` only.
- **On load:** `GET /admin/distributor-plans`.
- **User flow:** Admin creates plans, edits plan content fields, and deactivates plans when rolling pricing/positioning changes.
- **UI logic:** Show full marketing content for each plan: name, amount, tagline, features, trust badges, CTA text, highlight badge, testimonials. Amount should be treated as immutable after creation because current edit flow only updates content fields.
- **Migration logic:** Before deactivation, warn that active subscribers may be flagged with `migrationPending` and must move to a new plan before renewal.
- **Error handling:** Deactivation failures should leave the plan visibly active. Edit forms should preserve unsaved arrays like features/testimonials if the request fails.
- **Navigation:** Create/edit can be modal or `/admin/distributor-plans/:uuid/edit`.

### 8.6 Admin Notifications Page (`/admin/notifications`)

- **Who sees it:** `SUPER_ADMIN` only.
- **On load:** `GET /admin/notifications`.
- **User flow:** Admin reviews direct/organic lead follow-ups and opens the relevant lead records.
- **UI logic:** Use the response for the admin nav badge as well. This page should focus on actionable items, not general system alerts.
- **Error handling:** If notifications fail, keep the rest of the admin shell working and show the badge as unavailable.
- **Navigation:** Notification click -> `/admin/leads/:uuid` or `/admin/followups/today`.

---

## Section 9 - Admin LMS Management

### 9.1 Course Management Page (`/admin/courses`)

- **Who sees it:** `SUPER_ADMIN` only.
- **On load:** `GET /admin/courses`.
- **User flow:** Admin creates a course, uploads thumbnail through `POST /admin/lms/upload`, sets preview video URL, enters marketing fields, then submits `POST /admin/courses`. Existing courses can be edited, published, unpublished, or deleted.
- **UI logic:** Show total enrollments, total lessons, badge, publish state, and quick actions. Delete should only appear as a destructive option when safe; otherwise steer the admin to unpublish.
- **Error handling:** If delete fails because enrollments exist, show "Unpublish instead" directly in the confirmation flow. Upload failures should not wipe the rest of the course form.
- **Navigation:** Create/edit -> `/admin/courses/:uuid/edit` or an editor drawer. Detail -> `/admin/courses/:uuid`.

### 9.2 Section Management Page (`/admin/courses/:uuid`)

- **Who sees it:** `SUPER_ADMIN` only.
- **On load:** `GET /admin/courses/:uuid`.
- **User flow:** Admin adds sections, edits section titles, reorders sections by drag-and-drop, and deletes sections when appropriate.
- **UI logic:** Keep section management inside the course editor because section order directly affects lesson lock order in learner UX.
- **Error handling:** Reorder failures must snap the UI back to the previous order. Delete failures should explain whether the section is protected because of content/state rules.
- **Navigation:** Section edit can be inline, modal, or `/admin/courses/:courseUuid/sections/:sectionUuid/edit`.

### 9.3 Lesson Management Page (`/admin/courses/:courseUuid/sections/:sectionUuid`)

- **Who sees it:** `SUPER_ADMIN` only.
- **On load:** Usually piggybacks on `GET /admin/courses/:uuid`, but edit flows may call `GET .../lessons/:lessonUuid/edit`.
- **User flow:** Admin creates lessons, toggles preview visibility, uploads PDF attachments through `POST /admin/lms/upload`, reorders lessons, edits lessons, and deletes lessons.
- **UI logic:** `isPreview=true` matters for the public course landing page, so preview lessons should be clearly marked in the admin UI. Attachment upload should fill both `attachmentUrl` and `attachmentName`.
- **Error handling:** Invalid attachment types should be stopped before submit. Reorder/delete failures should revert the local list.
- **Navigation:** Continue working inside the course editor after save.

### 9.4 LMS Analytics Page (`/admin/lms/analytics`)

- **Who sees it:** `SUPER_ADMIN` only.
- **On load:** `GET /admin/lms/analytics`.
- **User flow:** Admin reviews total courses, enrollments, completions, certificate volume, and per-course performance.
- **UI logic:** Show top-line metrics plus a per-course breakdown table. Link each row back to the course editor when the admin wants to improve weak courses.
- **Error handling:** Empty analytics should still render the frame and say there is no LMS activity yet.
- **Navigation:** Per-course drill-down -> `/admin/courses/:uuid`.

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

---

## Section 11 - Coupon Management

### 11.1 Coupon List Page (`/admin/coupons`)

- **Who sees it:** `SUPER_ADMIN` only.
- **On load:** `GET /admin/coupons`.
- **User flow:** Admin creates coupons, edits coupons, toggles active/inactive state through the edit flow, and deletes coupons when safe.
- **UI logic:** Show code, discount type/value, scope, expiry, usage limits, active state, and computed status. Used coupons should be treated as soft-delete candidates, not hard-delete assumptions.
- **Error handling:** Expired coupons cannot be reactivated, so block that toggle path with a plain-language explanation. Used-coupon delete should explain that historical payment integrity is preserved.
- **Navigation:** Create/edit -> `/admin/coupons/:uuid/edit` or modal.

---

## Section 12 - Public Pages

### 12.1 Join Link Landing Page (`/join/:code`)

- **Who sees it:** Public users.
- **On load:** `GET /distributor/join/:code`.
- **User flow:** Validate the code, show the referring distributor identity if valid, then let the user click Get Started and move into signup with hidden referral context.
- **UI logic:** If valid, keep the referral code in state/storage and inject it into signup automatically. The user should never type the referral code manually.
- **Error handling:** Invalid or inactive code should show a dedicated error state. A good fallback is a CTA to normal signup without referral, but keep the invalid-link message explicit.
- **Navigation:** Valid -> `/signup` with referral context preserved. Invalid -> `/signup` or `/login` without referral.

### 12.2 Campaign Landing Page (`/c/:slug`)

- **Who sees it:** Public users.
- **On load:** Read `utm_*` query params and call `POST /tracking/capture`. This call should be fire-and-forget from the UX point of view.
- **User flow:** User lands from a campaign, tracking is captured, then the frontend routes them into the intended acquisition path such as signup, join-link flow, or funnel entry.
- **UI logic:** Current backend does not expose a public campaign lookup endpoint by slug, so this page is mainly a frontend marketing route plus UTM capture step. Do not block the redirect if tracking fails.
- **Error handling:** If `POST /tracking/capture` fails, continue the redirect anyway. Tracking loss should not become user-facing friction.
- **Navigation:** Common destinations are `/signup`, `/join/:code`, or a marketing pre-funnel route depending on campaign design.

---

## Section 13 - Navigation and Auth State

### Global Auth Bootstrap

- **Protected app load:** If there is no in-memory `accessToken` but a refresh cookie may exist, call `POST /auth/refresh` first, then `GET /auth/me`.
- **401 handling:** Any protected request that ends in unrecoverable `401` should clear local auth state and redirect to `/login`.
- **403 handling:** If the user is authenticated but hits the wrong role area, redirect to the correct home page instead of leaving them on a dead-end forbidden screen.
- **Onboarding handling:** If login, OTP verify, or OAuth callback returns `needsCountry=true`, force `/complete-profile` before all other protected routes.
- **Logout:** `POST /auth/logout`, clear in-memory auth state, then redirect to `/login`.

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
