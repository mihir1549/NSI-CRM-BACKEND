# NSI Frontend Guide: All Implemented Features Except Auth And Leads

This document is the detailed frontend integration guide for the currently implemented backend features, excluding:

- authentication
- leads

This document intentionally does not cover UI styling.

## 1. Scope And Assumptions

This guide starts after authentication is already working on the frontend.

Assumed frontend state before protected user flows begin:

- user is already logged in
- frontend already has a valid `accessToken`
- refresh-token cookie flow is already working
- user can already pass protected route access

This guide also excludes all leads-related features, screens, and APIs.

## 2. Base API And Global Rules

Base API path:

```txt
http://localhost:3000/api/v1
```

All protected endpoints in this guide require:

- `Authorization: Bearer <accessToken>`
- cookies enabled on requests

Frontend request rules:

- `fetch`: use `credentials: "include"`
- Axios: use `withCredentials: true`

Example Axios client:

```ts
import axios from "axios";

export const api = axios.create({
  baseURL: "http://localhost:3000/api/v1",
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

## 3. Global Backend Behavior The Frontend Must Respect

### 3.1 Validation behavior

The backend uses a global validation pipe with:

- unknown fields stripped/rejected
- DTO transformation enabled
- non-whitelisted fields rejected

Frontend meaning:

- send only fields documented in this guide
- do not attach extra client-only keys in request payloads

### 3.2 Standard error shape

All handled errors use this format:

```json
{
  "statusCode": 400,
  "error": "BadRequestException",
  "message": "Invalid OTP",
  "timestamp": "2026-03-31T12:00:00.000Z",
  "path": "/api/v1/phone/verify-otp"
}
```

Important:

- `message` may be a string
- `message` may be a string array for validation errors

### 3.3 Protected route behavior

Protected non-admin routes in this guide generally use:

- `JwtAuthGuard`
- `OnboardingGuard`

Frontend meaning:

- if backend returns `403` with message similar to `Please complete your profile first`, redirect user back to onboarding/profile completion flow
- even if frontend thinks the user is ready, backend may still block based on fresh DB state

### 3.4 Role behavior

User roles in schema are:

- `USER`
- `CUSTOMER`
- `DISTRIBUTOR`
- `ADMIN`
- `SUPER_ADMIN`

Current implemented split relevant to this guide:

- normal user-facing runtime features are available to authenticated users after onboarding
- superadmin-only features are restricted to `SUPER_ADMIN`

Important:

- backend re-fetches user role from DB in `RolesGuard`
- frontend role checks are UI hints only
- always handle backend `403`

### 3.5 No frontend access to webhook endpoints

Payment webhook endpoints are backend-only.

Frontend must never call:

- `POST /payments/webhook`

Frontend only:

- creates payment order
- opens payment checkout
- polls payment status
- refreshes funnel progress

## 4. Feature Matrix

### 4.1 Normal user features covered here

- tracking capture
- funnel runtime
- phone verification
- coupon validation preview
- payment flow

### 4.2 Superadmin features covered here

- coupon management
- funnel CMS
- analytics

### 4.3 Excluded features

- auth
- leads

## 5. Public Tracking Feature

Tracking is the only public feature in this document.

Purpose:

- capture UTM/acquisition metadata before or around signup/login
- attach that acquisition data to the user later

### 5.1 Endpoint

`POST /tracking/capture`

Full URL:

```txt
/api/v1/tracking/capture
```

### 5.2 Auth requirement

- public
- no JWT required

### 5.3 Request body

All fields are optional strings.

```json
{
  "utmSource": "facebook",
  "utmMedium": "cpc",
  "utmCampaign": "launch",
  "utmContent": "video-1",
  "utmTerm": "water machine",
  "referrerUrl": "https://facebook.com",
  "landingPage": "/landing/kangen",
  "distributorCode": "DIST100",
  "deviceType": "mobile",
  "browser": "chrome"
}
```

### 5.4 Response

```json
{
  "ok": true
}
```

### 5.5 What backend does

The backend:

- extracts IP address
- tries GeoIP lookup
- stores tracking data in an `HttpOnly` cookie named `nsi_acquisition`
- if the request already belongs to an authenticated user, it can immediately attach acquisition data to that user

Captured/derived data model includes:

- `utmSource`
- `utmMedium`
- `utmCampaign`
- `utmContent`
- `utmTerm`
- `referrerUrl`
- `landingPage`
- `distributorCode`
- `distributorUuid`
- `ipAddress`
- `country`
- `city`
- `deviceType`
- `browser`

### 5.6 Frontend implementation guidance

Call tracking:

- once on landing-page load
- or once per marketing session

Do not spam it repeatedly on every rerender.

## 6. User Funnel Runtime

This is the main post-auth product flow for a normal user.

The funnel runtime endpoints are:

- `GET /funnel/structure`
- `GET /funnel/progress`
- `GET /funnel/step/:stepUuid`
- `POST /funnel/step/:stepUuid/video-progress`
- `POST /funnel/step/:stepUuid/complete`
- `POST /funnel/decision`

All of them are protected by:

- JWT auth
- onboarding guard

### 6.1 Core funnel concepts

The funnel is built from:

- sections
- steps inside sections
- progress stored per user

Supported step types:

- `VIDEO_TEXT`
- `PHONE_GATE`
- `PAYMENT_GATE`
- `DECISION`

Funnel progress fields relevant to frontend:

- `currentSectionUuid`
- `currentStepUuid`
- `status`
- `phoneVerified`
- `paymentCompleted`
- `decisionAnswer`
- `completedStepUuids`

Possible funnel progress status values in schema:

- `IN_PROGRESS`
- `COMPLETED`
- `DROPPED`

### 6.2 Critical runtime rules

The backend enforces all progression rules.

Important rules:

- user cannot open future steps directly
- user can access only current step or already completed step
- completing one step advances progress on the backend
- phone verification advances the funnel automatically
- payment success advances the funnel automatically
- frontend should always re-fetch progress after any state-changing action

### 6.3 Recommended funnel bootstrap flow

After user is ready to enter the app:

1. call `GET /funnel/structure`
2. call `GET /funnel/progress`
3. if `progress.currentStepUuid` exists, call `GET /funnel/step/:currentStepUuid`
4. render by step `type`

### 6.4 `GET /funnel/structure`

Purpose:

- fetch active funnel tree for navigation/progress UI

Response shape:

```json
{
  "sections": [
    {
      "uuid": "section-uuid",
      "name": "Section 1",
      "description": "Intro",
      "order": 1,
      "steps": [
        {
          "uuid": "step-uuid",
          "type": "VIDEO_TEXT",
          "order": 1,
          "isActive": true,
          "title": "Welcome"
        }
      ]
    }
  ]
}
```

What backend includes:

- only active sections
- only active steps
- steps ordered ascending by `order`
- sections ordered ascending by `order`

Use this for:

- section headers
- progress sidebar
- breadcrumb/progress label
- step map

### 6.5 `GET /funnel/progress`

Purpose:

- fetch current runtime state for the logged-in user

Response shape:

```json
{
  "currentSectionUuid": "section-uuid",
  "currentStepUuid": "step-uuid",
  "status": "IN_PROGRESS",
  "phoneVerified": false,
  "paymentCompleted": false,
  "decisionAnswer": null,
  "completedStepUuids": []
}
```

What backend does:

- returns existing progress if it exists
- auto-creates progress if it does not exist yet
- auto-picks first active step in first active section for new progress

Treat this as the main source of truth.

### 6.6 `GET /funnel/step/:stepUuid`

Purpose:

- fetch data for one step

Backend access rules:

- step must exist
- step must be active
- user must either currently be on that step or already have completed it

If user tries to fetch a future step, backend returns:

- `400`
- message like `You must complete the previous steps first`

Possible response types:

#### VIDEO_TEXT response

```json
{
  "type": "VIDEO_TEXT",
  "content": {
    "uuid": "content-uuid",
    "stepUuid": "step-uuid",
    "title": "Welcome",
    "description": "Step description",
    "videoUrl": "https://example.com/video.mp4",
    "videoDuration": 120,
    "thumbnailUrl": "https://example.com/thumb.jpg",
    "textContent": "<p>HTML content</p>",
    "requireVideoCompletion": true,
    "createdAt": "2026-03-31T10:00:00.000Z",
    "updatedAt": "2026-03-31T10:00:00.000Z"
  }
}
```

#### PHONE_GATE response

```json
{
  "type": "PHONE_GATE",
  "phoneGate": {
    "uuid": "phone-config-uuid",
    "stepUuid": "step-uuid",
    "title": "Verify your phone number",
    "subtitle": "Enter OTP",
    "isActive": true
  }
}
```

#### PAYMENT_GATE response

Important: backend transforms decimal amount to string here.

```json
{
  "type": "PAYMENT_GATE",
  "paymentGate": {
    "title": "Unlock content",
    "subtitle": "Pay to continue",
    "amount": "49900",
    "currency": "INR"
  }
}
```

#### DECISION response

```json
{
  "type": "DECISION",
  "decisionStep": {
    "uuid": "decision-config-uuid",
    "stepUuid": "step-uuid",
    "question": "Are you interested in buying a Kangen machine?",
    "yesLabel": "Yes, I am interested!",
    "noLabel": "Not right now",
    "yesSubtext": null,
    "noSubtext": null
  }
}
```

## 7. VIDEO_TEXT Step

This step type uses:

- `GET /funnel/step/:stepUuid`
- `POST /funnel/step/:stepUuid/video-progress`
- `POST /funnel/step/:stepUuid/complete`

### 7.1 What to show

From the `content` object show:

- `title`
- `description`
- `videoUrl`
- `thumbnailUrl`
- `textContent`
- step completion CTA

Also use:

- `videoDuration`
- `requireVideoCompletion`

for player logic and completion rules.

### 7.2 Save video progress

Endpoint:

`POST /funnel/step/:stepUuid/video-progress`

Body:

```json
{
  "watchedSeconds": 87
}
```

Response:

```json
{
  "ok": true
}
```

Backend behavior:

- creates or updates step progress
- never decreases watched time
- updates `lastSeenAt`

Frontend recommendation:

- send progress every 5 to 10 seconds
- send on pause
- send on ended
- send before unload/navigation when possible

### 7.3 Complete video step

Endpoint:

`POST /funnel/step/:stepUuid/complete`

Body for video step:

```json
{
  "watchedSeconds": 120
}
```

Possible response:

```json
{
  "ok": true
}
```

If already completed, backend may respond:

```json
{
  "ok": true,
  "message": "Step already completed"
}
```

If `requireVideoCompletion` is `true`, backend checks:

- `watchedSeconds >= videoDuration - 3`

If not satisfied, backend returns:

- `400`
- `Please watch the complete video before proceeding`

## 8. PHONE_GATE Step

Phone verification is a dedicated feature used inside funnel progression.

Phone endpoints:

- `POST /phone/send-otp`
- `POST /phone/verify-otp`

Protected by:

- JWT auth
- onboarding guard

### 8.1 What to show

From funnel step response show:

- `phoneGate.title`
- `phoneGate.subtitle`

Suggested user inputs:

- phone number
- channel selector
- OTP input

### 8.2 Send OTP

Endpoint:

`POST /phone/send-otp`

Body:

```json
{
  "phone": "+919876543210",
  "channel": "whatsapp"
}
```

Fields:

- `phone`: required string
- `channel`: optional in DTO, allowed values:
  - `whatsapp`
  - `sms`

Default channel if omitted:

- `whatsapp`

Response:

```json
{
  "message": "OTP sent successfully",
  "channel": "whatsapp"
}
```

### 8.3 Phone normalization rules

Backend normalizes phone numbers before processing.

Rules:

- removes spaces, dashes, brackets, dots
- if number starts with `0`, backend converts it to `+91...`
- if number starts with `91` without `+`, backend adds `+`
- final value must match E.164

Expected valid pattern:

```txt
+[country code][number]
```

Example:

```txt
+919876543210
```

If invalid, backend returns:

- `400`
- `Invalid phone number format. Use E.164 format: +91XXXXXXXXXX`

### 8.4 Send OTP business rules

Backend rules:

- max 3 OTP send requests per user per hour
- phone cannot already belong to another user
- if user already has verified phone in funnel progress, send is blocked

Common errors:

- `400` invalid phone format
- `409` phone already registered to another account
- `409` phone already verified for this account
- `429` too many OTP requests

### 8.5 Verify OTP

Endpoint:

`POST /phone/verify-otp`

Body:

```json
{
  "phone": "+919876543210",
  "code": "123456",
  "channel": "whatsapp"
}
```

Fields:

- `phone`: required string
- `code`: required 6-digit string
- `channel`: required, one of:
  - `whatsapp`
  - `sms`

Response:

```json
{
  "message": "Phone verified successfully",
  "progress": {
    "phoneVerified": true,
    "paymentCompleted": false,
    "currentStepUuid": "next-step-uuid",
    "currentSectionUuid": "next-section-uuid"
  }
}
```

### 8.6 OTP verification business rules

Backend rules:

- max 3 wrong OTP attempts before 1-hour lockout
- invalid code returns `400`
- too many wrong attempts returns `429`

On success backend does all of this:

- stores/updates `userProfile.phone`
- sets `phoneVerifiedAt`
- marks funnel progress `phoneVerified = true`
- marks current phone step as completed
- advances funnel to next step

Important frontend rule:

- do not call `POST /funnel/step/:stepUuid/complete` after successful phone verification
- backend already completed that step

### 8.7 Frontend flow for phone gate

Recommended flow:

1. render phone gate metadata from funnel step
2. user enters phone and chooses channel
3. call `POST /phone/send-otp`
4. show OTP input
5. call `POST /phone/verify-otp`
6. update local progress from response
7. fetch next step using returned `progress.currentStepUuid`

### 8.8 Development/mock mode note

In mock phone provider mode:

- OTP is `123456`

## 9. PAYMENT_GATE Step

Payment flow depends on several features working together:

- funnel runtime
- coupons
- payment order creation
- payment status polling

Payment endpoints:

- `POST /payments/create-order`
- `GET /payments/status`

Coupon preview endpoint:

- `POST /coupons/validate`

### 9.1 What to show on payment step

From `GET /funnel/step/:stepUuid` payment response show:

- `paymentGate.title`
- `paymentGate.subtitle`
- `paymentGate.amount`
- `paymentGate.currency`

Suggested local UI state:

- original amount
- coupon input
- coupon validation result
- discount amount
- final amount
- order creation loading
- gateway checkout state
- payment confirmation polling state

### 9.2 Payment prerequisites enforced by backend

Backend will reject order creation unless:

- user is authenticated
- user passed onboarding guard
- `phoneVerified === true`
- payment is not already completed
- current step is actually a `PAYMENT_GATE`
- current payment gate has configuration

Common blocked cases:

- `403` phone verification required first
- `403` user has not reached payment step
- `409` payment already completed
- `400` payment gate not configured

### 9.3 Coupon preview

Endpoint:

`POST /coupons/validate`

Body:

```json
{
  "code": "WELCOME50",
  "paymentType": "COMMITMENT_FEE"
}
```

Response:

```json
{
  "valid": true,
  "couponCode": "WELCOME50",
  "couponType": "PERCENT",
  "originalAmount": 49900,
  "discountAmount": 24950,
  "finalAmount": 24950,
  "message": "Coupon is valid"
}
```

Backend checks in this order:

1. coupon exists
2. coupon is active
3. coupon is not expired
4. global usage limit not reached
5. user-specific usage limit not reached
6. coupon scope matches payment type

Important:

- backend uppercases and trims before coupon lookup
- coupon preview does not consume coupon
- actual validation happens again during payment order creation inside DB transaction

### 9.4 Create payment order

Endpoint:

`POST /payments/create-order`

Body without coupon:

```json
{}
```

Body with coupon:

```json
{
  "couponCode": "WELCOME50"
}
```

Possible success response A:

```json
{
  "orderId": "order_xxx",
  "amount": 24950,
  "currency": "INR",
  "keyId": "rzp_test_xxx"
}
```

Possible success response B:

```json
{
  "freeAccess": true
}
```

### 9.5 What backend does during order creation

Order creation logic:

1. checks funnel progress
2. requires phone verification
3. ensures user is on payment step
4. loads payment-gate amount/currency from current funnel step
5. validates coupon again in transaction if coupon code is supplied and coupons are allowed
6. if final amount becomes `0`, grants free access immediately
7. otherwise creates payment record and payment-provider order

Important frontend note:

- the backend amount is authoritative
- do not trust a locally calculated payment amount over backend response

### 9.6 Free-access flow

If order creation returns:

```json
{
  "freeAccess": true
}
```

That means backend already:

- created a successful synthetic payment record
- applied coupon usage if applicable
- marked `paymentCompleted = true`
- marked payment step as completed
- advanced funnel progress to next step

Frontend should:

1. not open Razorpay
2. call `GET /payments/status`
3. call `GET /funnel/progress`
4. fetch next step using new `currentStepUuid`

### 9.7 Paid order flow

If backend returns `{ orderId, amount, currency, keyId }`, frontend should open Razorpay checkout.

Use:

- `key`: `keyId`
- `order_id`: `orderId`
- `amount`: `amount`
- `currency`: `currency`

Important:

- payment success is finalized by backend webhook
- frontend must not assume payment is complete only because Razorpay popup returned success

### 9.8 Payment status polling

Endpoint:

`GET /payments/status`

Response before success:

```json
{
  "paymentCompleted": false,
  "payment": null
}
```

Response after success:

```json
{
  "paymentCompleted": true,
  "payment": {
    "uuid": "payment-uuid",
    "gatewayOrderId": "order_xxx",
    "amount": 49900,
    "discountAmount": 24950,
    "finalAmount": 24950,
    "currency": "INR",
    "status": "SUCCESS",
    "paymentType": "COMMITMENT_FEE",
    "createdAt": "2026-03-31T10:00:00.000Z"
  }
}
```

Recommended polling:

- every 2 seconds
- stop after 30 to 60 seconds
- show a `Confirming payment...` state

### 9.9 Mock mode note

In mock payment mode:

- backend auto-processes payment success after about 2 seconds

## 10. DECISION Step

Decision is part of funnel runtime, but this guide excludes the lead behavior behind it.

Endpoint:

`POST /funnel/decision`

### 10.1 What to show

From `GET /funnel/step/:stepUuid` render:

- `decisionStep.question`
- `decisionStep.yesLabel`
- `decisionStep.noLabel`
- `decisionStep.yesSubtext`
- `decisionStep.noSubtext`

### 10.2 Request body

```json
{
  "stepUuid": "decision-step-uuid",
  "answer": "YES"
}
```

or

```json
{
  "stepUuid": "decision-step-uuid",
  "answer": "NO"
}
```

Allowed values:

- `YES`
- `NO`

### 10.3 Response

```json
{
  "ok": true
}
```

### 10.4 Backend behavior relevant to frontend

Backend:

- validates the step is a decision step
- rejects duplicate decisions
- stores `decisionAnswer`
- stores `decisionAnsweredAt`
- marks the step as completed

Important implementation note:

- current backend does not set funnel `status = COMPLETED` here
- current backend also does not clear `currentStepUuid` here

Frontend recommendation:

- after successful decision submission, route user to final completion/thank-you state
- do not wait for a formal `COMPLETED` funnel status from backend on this step

## 11. Suggested Normal-User Frontend Data Model

Recommended frontend types:

```ts
export type StepType =
  | "VIDEO_TEXT"
  | "PHONE_GATE"
  | "PAYMENT_GATE"
  | "DECISION";

export interface FunnelProgress {
  currentSectionUuid: string | null;
  currentStepUuid: string | null;
  status: "IN_PROGRESS" | "COMPLETED" | "DROPPED";
  phoneVerified: boolean;
  paymentCompleted: boolean;
  decisionAnswer: "YES" | "NO" | null;
  completedStepUuids: string[];
}
```

## 12. Superadmin Coupon Management

Superadmin coupon APIs live under:

```txt
/api/v1/admin/coupons
```

Protected by:

- JWT auth
- roles guard
- `SUPER_ADMIN`

### 12.1 Coupon-related enums

Coupon type enum:

- `FLAT`
- `PERCENT`
- `FREE`

Coupon scope enum:

- `COMMITMENT_FEE`
- `LMS_COURSE`
- `DISTRIBUTOR_SUB`
- `ALL`

Computed coupon status used by backend responses:

- `ACTIVE`
- `INACTIVE`
- `EXPIRED`

### 12.2 Create coupon

Endpoint:

`POST /admin/coupons`

Body:

```json
{
  "code": "WELCOME50",
  "type": "PERCENT",
  "value": 50,
  "applicableTo": "COMMITMENT_FEE",
  "usageLimit": 100,
  "perUserLimit": 1,
  "expiresAt": "2026-12-31T23:59:59.000Z"
}
```

Validation rules:

- `code`: uppercase alphanumeric only
- minimum length 4
- maximum length 20
- `type`: valid coupon type enum
- `value`: integer >= 0
- `applicableTo`: valid scope enum
- `usageLimit`: optional integer >= 1
- `perUserLimit`: optional integer >= 1
- `expiresAt`: optional ISO date string

Backend behavior:

- uppercases/trims code again before saving
- rejects duplicate code
- returns coupon object plus computed `status`

### 12.3 List coupons

Endpoint:

`GET /admin/coupons`

Optional query:

- `status=active`
- `status=inactive`
- `status=expired`
- `status=all`

Default if omitted:

- `active`

Response shape:

```json
[
  {
    "uuid": "coupon-uuid",
    "code": "WELCOME50",
    "type": "PERCENT",
    "value": 50,
    "applicableTo": "COMMITMENT_FEE",
    "usageLimit": 100,
    "usedCount": 12,
    "perUserLimit": 1,
    "expiresAt": "2026-12-31T23:59:59.000Z",
    "isActive": true,
    "createdAt": "2026-03-31T08:00:00.000Z",
    "updatedAt": "2026-03-31T08:00:00.000Z",
    "_count": {
      "uses": 12
    },
    "status": "ACTIVE"
  }
]
```

What to show in coupon list UI:

- code
- type
- value
- applicable scope
- status
- usage limit
- used count
- per-user limit
- expiry date
- active/inactive state
- created/updated timestamps

### 12.4 Coupon detail

Endpoint:

`GET /admin/coupons/:uuid`

Response:

- full coupon record
- computed `status`
- `uses` array

`uses` entries include:

- coupon-use UUID
- creation time
- nested user:
  - `uuid`
  - `fullName`
  - `email`

### 12.5 Update coupon

Endpoint:

`PATCH /admin/coupons/:uuid`

Allowed request fields:

```json
{
  "isActive": false,
  "usageLimit": 200,
  "expiresAt": "2027-01-31T23:59:59.000Z"
}
```

Important backend rule:

- expired coupons cannot be reactivated by setting `isActive = true`

### 12.6 Delete coupon

Endpoint:

`DELETE /admin/coupons/:uuid`

Delete behavior is smart:

- if coupon was never used: backend hard deletes it
- if coupon was used: backend only deactivates it

Possible success responses:

```json
{
  "message": "Coupon permanently deleted."
}
```

or

```json
{
  "message": "Coupon deactivated. Cannot hard delete because it has been used."
}
```

## 13. Superadmin Funnel CMS

Superadmin funnel CMS APIs live under:

```txt
/api/v1/admin/funnel
```

Protected by:

- JWT auth
- roles guard
- `SUPER_ADMIN`

### 13.1 Recommended superadmin screen structure

Suggested pages/modules:

- funnel builder dashboard
- section list / ordering panel
- step list for selected section
- step editor drawer/panel
- validation warning panel

Suggested data bootstrap:

1. `GET /admin/funnel/sections`
2. `GET /admin/funnel/validate`

### 13.2 Section APIs

#### Create section

Endpoint:

`POST /admin/funnel/sections`

Body:

```json
{
  "name": "Section 1",
  "description": "Intro content",
  "order": 1
}
```

#### List all sections

Endpoint:

`GET /admin/funnel/sections`

Response behavior:

- returns all sections
- returns steps nested inside sections
- includes step configs/content

Nested step includes:

- `content`
- `phoneGate`
- `paymentGate`
- `decisionStep`

Use this as main CMS bootstrap data.

#### Update section

Endpoint:

`PATCH /admin/funnel/sections/:uuid`

Body example:

```json
{
  "name": "Updated Section",
  "description": "Updated description",
  "order": 1,
  "isActive": true
}
```

#### Reorder sections

Endpoint:

`PATCH /admin/funnel/sections/reorder`

Body:

```json
[
  { "uuid": "section-1", "order": 1 },
  { "uuid": "section-2", "order": 2 }
]
```

#### Delete section

Endpoint:

`DELETE /admin/funnel/sections/:uuid`

Important backend rule:

- delete fails if any users are currently on that section

### 13.3 Step APIs

#### Create step

Endpoint:

`POST /admin/funnel/steps`

Body:

```json
{
  "sectionUuid": "section-uuid",
  "type": "PAYMENT_GATE",
  "order": 2
}
```

Allowed types:

- `VIDEO_TEXT`
- `PHONE_GATE`
- `PAYMENT_GATE`
- `DECISION`

Backend behavior:

- creates step
- auto-creates default config/content based on step type

Defaults created by backend:

- `VIDEO_TEXT`: `StepContent` with title `New Video Step`
- `PHONE_GATE`: default phone-gate config
- `PAYMENT_GATE`: default payment-gate config with amount `0`
- `DECISION`: default decision config

#### Get one step

Endpoint:

`GET /admin/funnel/steps/:uuid`

Response includes:

- step base data
- `content`
- `phoneGate`
- `paymentGate`
- `decisionStep`

#### Update step

Endpoint:

`PATCH /admin/funnel/steps/:uuid`

Body example:

```json
{
  "order": 2,
  "isActive": true
}
```

#### Reorder steps

Endpoint:

`PATCH /admin/funnel/steps/reorder`

Body:

```json
[
  { "uuid": "step-1", "order": 1 },
  { "uuid": "step-2", "order": 2 }
]
```

#### Delete step

Endpoint:

`DELETE /admin/funnel/steps/:uuid`

Important backend rule:

- delete fails if any user is currently on that step

### 13.4 VIDEO_TEXT content editor

Endpoint:

`PUT /admin/funnel/steps/:uuid/content`

Only valid for:

- `VIDEO_TEXT` steps

Body:

```json
{
  "title": "Welcome",
  "description": "Intro video",
  "videoUrl": "https://example.com/video.mp4",
  "videoDuration": 120,
  "thumbnailUrl": "https://example.com/thumb.jpg",
  "textContent": "<p>HTML content</p>",
  "requireVideoCompletion": true
}
```

What to show in superadmin editor:

- title field
- description field
- video URL field
- video duration field
- thumbnail URL field
- HTML/rich text content field
- require-video-completion toggle

### 13.5 PHONE_GATE editor

Endpoint:

`PUT /admin/funnel/steps/:uuid/phone-gate`

Only valid for:

- `PHONE_GATE` steps

Body:

```json
{
  "title": "Verify your phone number",
  "subtitle": "Enter OTP sent to WhatsApp",
  "isActive": true
}
```

### 13.6 PAYMENT_GATE editor

Endpoint:

`PUT /admin/funnel/steps/:uuid/payment-gate`

Only valid for:

- `PAYMENT_GATE` steps

Body:

```json
{
  "title": "Unlock content",
  "subtitle": "Pay to continue",
  "amount": 49900,
  "currency": "INR",
  "allowCoupons": true,
  "isActive": true
}
```

Important:

- `amount` is required by backend DTO
- frontend should not omit it on updates

### 13.7 DECISION editor

Endpoint:

`PUT /admin/funnel/steps/:uuid/decision`

Only valid for:

- `DECISION` steps

Body:

```json
{
  "question": "Are you interested in buying a Kangen machine?",
  "yesLabel": "Yes, I am interested!",
  "noLabel": "Not right now",
  "yesSubtext": "Talk to a guide",
  "noSubtext": "Maybe later"
}
```

## 14. Superadmin Funnel Validation

Endpoint:

`GET /admin/funnel/validate`

Response:

```json
{
  "warnings": [
    {
      "code": "PAYMENT_BEFORE_PHONE",
      "message": "Payment gate is placed before phone gate. Users will pay before verifying their phone number. Is this intentional?",
      "severity": "warning"
    }
  ]
}
```

Current warning codes implemented by backend:

- `PAYMENT_BEFORE_PHONE`
- `MULTIPLE_PAYMENT_GATES`
- `MULTIPLE_PHONE_GATES`
- `NO_DECISION_STEP`
- `DECISION_NOT_LAST`
- `EMPTY_SECTION`

Recommended usage:

- fetch on initial CMS load
- fetch after section create/update/delete/reorder
- fetch after step create/update/delete/reorder
- fetch after any content/config save

## 15. Superadmin Analytics

Analytics APIs live under:

```txt
/api/v1/admin/analytics
```

Protected by:

- JWT auth
- roles guard
- `SUPER_ADMIN`

Analytics endpoints:

- `GET /admin/analytics/funnel`
- `GET /admin/analytics/utm`
- `GET /admin/analytics/devices`
- `GET /admin/analytics/conversions`

### 15.1 Funnel analytics

Endpoint:

`GET /admin/analytics/funnel`

Response shape:

```json
[
  {
    "stepUuid": "step-uuid",
    "stepTitle": "Welcome",
    "stepType": "VIDEO_TEXT",
    "sectionName": "Section 1",
    "order": 1,
    "totalReached": 100,
    "totalCompleted": 80,
    "dropOffCount": 20,
    "dropOffRate": 20
  }
]
```

Use this for:

- step completion table
- funnel chart
- drop-off reporting

### 15.2 UTM analytics

Endpoint:

`GET /admin/analytics/utm`

Response shape:

```json
{
  "bySource": [
    { "utmSource": "facebook", "count": 20 }
  ],
  "byMedium": [
    { "utmMedium": "cpc", "count": 20 }
  ],
  "byCampaign": [
    { "utmCampaign": "launch", "count": 20 }
  ],
  "byDistributor": [
    {
      "distributorCode": "DIST100",
      "distributorUuid": "user-uuid",
      "count": 5
    }
  ]
}
```

Use this for:

- source breakdown
- medium breakdown
- campaign breakdown
- distributor attribution

### 15.3 Device analytics

Endpoint:

`GET /admin/analytics/devices`

Response shape:

```json
{
  "byDevice": [
    { "deviceType": "mobile", "count": 30 }
  ],
  "byCountry": [
    { "country": "IN", "count": 25 }
  ]
}
```

Use this for:

- device breakdown
- country breakdown

### 15.4 Conversion analytics

Endpoint:

`GET /admin/analytics/conversions`

Response shape:

```json
{
  "totalRegistered": 100,
  "totalPhoneVerified": 70,
  "totalPaid": 40,
  "totalReachedDecision": 30,
  "totalYes": 20,
  "totalNo": 10,
  "phoneVerifyRate": 70,
  "paymentRate": 57.14,
  "decisionRate": 75,
  "yesRate": 66.67
}
```

Use this for:

- KPI cards
- top-level conversion summary
- step-to-step percentage reporting

## 16. Suggested Frontend API Layer

Suggested non-auth API wrapper methods:

```ts
export const trackingApi = {
  capture: (payload) => api.post("/tracking/capture", payload),
};

export const funnelApi = {
  getStructure: () => api.get("/funnel/structure"),
  getProgress: () => api.get("/funnel/progress"),
  getStep: (stepUuid: string) => api.get(`/funnel/step/${stepUuid}`),
  saveVideoProgress: (stepUuid: string, watchedSeconds: number) =>
    api.post(`/funnel/step/${stepUuid}/video-progress`, { watchedSeconds }),
  completeStep: (stepUuid: string, payload?: { watchedSeconds?: number }) =>
    api.post(`/funnel/step/${stepUuid}/complete`, payload ?? {}),
  recordDecision: (payload: { stepUuid: string; answer: "YES" | "NO" }) =>
    api.post("/funnel/decision", payload),
};

export const phoneApi = {
  sendOtp: (payload) => api.post("/phone/send-otp", payload),
  verifyOtp: (payload) => api.post("/phone/verify-otp", payload),
};

export const couponApi = {
  validate: (payload) => api.post("/coupons/validate", payload),
};

export const paymentApi = {
  createOrder: (payload?: { couponCode?: string }) =>
    api.post("/payments/create-order", payload ?? {}),
  getStatus: () => api.get("/payments/status"),
};

export const adminCouponApi = {
  list: (status?: "active" | "inactive" | "expired" | "all") =>
    api.get("/admin/coupons", { params: status ? { status } : undefined }),
  create: (payload) => api.post("/admin/coupons", payload),
  get: (uuid: string) => api.get(`/admin/coupons/${uuid}`),
  update: (uuid: string, payload) => api.patch(`/admin/coupons/${uuid}`, payload),
  remove: (uuid: string) => api.delete(`/admin/coupons/${uuid}`),
};

export const adminFunnelApi = {
  getSections: () => api.get("/admin/funnel/sections"),
  createSection: (payload) => api.post("/admin/funnel/sections", payload),
  reorderSections: (payload) => api.patch("/admin/funnel/sections/reorder", payload),
  updateSection: (uuid: string, payload) => api.patch(`/admin/funnel/sections/${uuid}`, payload),
  deleteSection: (uuid: string) => api.delete(`/admin/funnel/sections/${uuid}`),
  createStep: (payload) => api.post("/admin/funnel/steps", payload),
  getStep: (uuid: string) => api.get(`/admin/funnel/steps/${uuid}`),
  reorderSteps: (payload) => api.patch("/admin/funnel/steps/reorder", payload),
  updateStep: (uuid: string, payload) => api.patch(`/admin/funnel/steps/${uuid}`, payload),
  deleteStep: (uuid: string) => api.delete(`/admin/funnel/steps/${uuid}`),
  upsertContent: (uuid: string, payload) => api.put(`/admin/funnel/steps/${uuid}/content`, payload),
  upsertPhoneGate: (uuid: string, payload) => api.put(`/admin/funnel/steps/${uuid}/phone-gate`, payload),
  upsertPaymentGate: (uuid: string, payload) => api.put(`/admin/funnel/steps/${uuid}/payment-gate`, payload),
  upsertDecision: (uuid: string, payload) => api.put(`/admin/funnel/steps/${uuid}/decision`, payload),
  validate: () => api.get("/admin/funnel/validate"),
};

export const adminAnalyticsApi = {
  funnel: () => api.get("/admin/analytics/funnel"),
  utm: () => api.get("/admin/analytics/utm"),
  devices: () => api.get("/admin/analytics/devices"),
  conversions: () => api.get("/admin/analytics/conversions"),
};
```

## 17. Recommended Implementation Order

If frontend auth is already done, build the rest in this order:

1. tracking capture integration
2. funnel bootstrap flow
3. video/text step renderer
4. phone gate flow
5. coupon preview
6. payment order + polling
7. decision step
8. superadmin coupon module
9. superadmin funnel CMS
10. superadmin validation panel
11. superadmin analytics dashboard

## 18. Important Mistakes To Avoid

Do not do these:

- do not let frontend invent next-step navigation without re-fetching backend progress
- do not call payment webhook from frontend
- do not call funnel `completeStep` after successful phone verification
- do not call funnel `completeStep` after successful payment
- do not trust local coupon math more than backend response
- do not assume role gating on frontend is sufficient for admin access
- do not send extra fields not present in DTOs
- do not expect decision step to mark funnel `COMPLETED` automatically in current backend

## 19. Final Summary

Everything currently implemented outside auth and leads falls into two products:

- normal user runtime
- superadmin operations

Normal user runtime includes:

- tracking
- funnel structure/progress/step flow
- phone verification
- coupon preview
- payment
- decision capture

Superadmin operations include:

- coupon management
- funnel CMS
- funnel validation
- analytics

The biggest frontend rule across all of these features is simple:

- backend is the source of truth

After every meaningful action, refresh state from backend rather than trying to predict it locally.
