# Funnel Integration Guide

This guide was prepared from the current backend implementation in:

- `src/funnel/`
- `src/funnel-cms/`
- `src/auth/`
- `src/tracking/`
- `src/leads/`
- `src/payment/`
- `src/phone/`
- `prisma/schema.prisma`

It documents the frontend contract that exists in code today.

> Important reality check: the funnel step enum in the codebase is `VIDEO_TEXT`, `PHONE_GATE`, `PAYMENT_GATE`, and `DECISION`. There are not separate backend step enums named `VIDEO` and `TEXT`. A "video-only" or "text-only" step is implemented by using `VIDEO_TEXT` with only the relevant fields filled.

> Important runtime rule: the generic `POST /funnel/step/:stepUuid/complete` endpoint should be treated as a content-step endpoint only. For phone verification, payment, and decision submission, use the dedicated `/phone/*`, `/payments/*`, and `/funnel/decision` flows.

## Table of Contents

- [1. Super Admin Side (Funnel CMS)](#1-super-admin-side-funnel-cms)
- [1.1 Authentication](#11-authentication)
- [1.2 Funnel Structure Management](#12-funnel-structure-management)
- [1.3 Funnel Validation](#13-funnel-validation)
- [1.4 Funnel Analytics (Admin)](#14-funnel-analytics-admin)
- [2. User Side (Funnel Experience)](#2-user-side-funnel-experience)
- [2.1 Registration and Auth Flow](#21-registration-and-auth-flow)
- [2.2 Funnel Progress Flow](#22-funnel-progress-flow)
- [2.3 Step Locking Rules](#23-step-locking-rules)
- [2.4 Phone Verification Flow](#24-phone-verification-flow)
- [2.5 Payment Flow](#25-payment-flow)
- [2.6 Coupon System](#26-coupon-system)
- [2.7 UTM and Referral Tracking](#27-utm-and-referral-tracking)
- [3. Complete User Journey Map](#3-complete-user-journey-map)
- [4. Error Handling Guide](#4-error-handling-guide)
- [5. Environment and Setup](#5-environment-and-setup)

## 1. Super Admin Side (Funnel CMS)

### 1.1 Authentication

There is no separate "admin login" endpoint. A Super Admin uses the same auth endpoints as any other user, then accesses CMS routes with a valid JWT access token.

All funnel CMS and funnel analytics routes are guarded by:

- `JwtAuthGuard`
- `RolesGuard`
- `@Roles('SUPER_ADMIN')`

`RolesGuard` re-fetches the user from the database on every request. The role claim inside the JWT is only a routing hint.

#### Admin login endpoint

- HTTP Method + Full URL: `POST http://localhost:3000/api/v1/auth/login`
- Required headers:
  - `Content-Type: application/json`
- Request body:

```json
{
  "email": "superadmin@example.com",
  "password": "StrongPassword123"
}
```

- Response shape:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "uuid": "7bc0349a-8a1e-4efb-8d06-b1ee44de7e0c",
    "fullName": "Platform Super Admin",
    "email": "superadmin@example.com",
    "role": "SUPER_ADMIN",
    "status": "ACTIVE"
  }
}
```

- Important notes or business rules:
  - The refresh token is not returned in the JSON body. It is set as an `HttpOnly` cookie named `refresh_token`.
  - A non-admin user can still log in successfully, but every CMS route below will return `403 Forbidden`.
  - The frontend should store the `accessToken` and send it as `Authorization: Bearer <token>` on every protected admin request.

#### Current-user bootstrap endpoint

- HTTP Method + Full URL: `GET http://localhost:3000/api/v1/auth/me`
- Required headers:
  - `Authorization: Bearer <accessToken>`
- Request body:
  - None
- Response shape:

```json
{
  "uuid": "7bc0349a-8a1e-4efb-8d06-b1ee44de7e0c",
  "fullName": "Platform Super Admin",
  "email": "superadmin@example.com",
  "role": "SUPER_ADMIN",
  "status": "ACTIVE"
}
```

- Important notes or business rules:
  - Use this after page refresh to hydrate the admin shell.
  - If the database role was changed after login, this endpoint reflects the current state.

### 1.2 Funnel Structure Management

#### Step type mapping

| Requested product concept | Current backend implementation |
| --- | --- |
| `VIDEO` step | Create a `VIDEO_TEXT` step and set `videoUrl` / `videoDuration` |
| `TEXT` step | Create a `VIDEO_TEXT` step with `textContent`; leave `videoUrl` empty and usually set `requireVideoCompletion=false` |
| `PHONE_GATE` | Native `PHONE_GATE` step |
| `PAYMENT_GATE` | Native `PAYMENT_GATE` step |
| `DECISION` | Native `DECISION` step |

#### Common admin headers

Unless stated otherwise, every endpoint in this section requires:

- `Authorization: Bearer <accessToken>`
- `Content-Type: application/json` for `POST`, `PUT`, `PATCH`, and `DELETE` requests with a body

#### Create section

- HTTP Method + Full URL: `POST http://localhost:3000/api/v1/admin/funnel/sections`
- Required headers:
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json`
- Request body:

```json
{
  "name": "Introduction",
  "description": "Opening section shown first",
  "order": 1
}
```

- Response shape:

```json
{
  "uuid": "e61a64cb-cb85-4743-981d-a95bd9b938dd",
  "name": "Introduction",
  "description": "Opening section shown first",
  "order": 1,
  "isActive": true,
  "createdAt": "2026-04-02T09:15:00.000Z",
  "updatedAt": "2026-04-02T09:15:00.000Z"
}
```

- Important notes or business rules:
  - `order` must be an integer `>= 1`.
  - Creating a section does not create any steps automatically.

#### List all sections with nested steps

- HTTP Method + Full URL: `GET http://localhost:3000/api/v1/admin/funnel/sections`
- Required headers:
  - `Authorization: Bearer <accessToken>`
- Request body:
  - None
- Response shape:

```json
[
  {
    "uuid": "e61a64cb-cb85-4743-981d-a95bd9b938dd",
    "name": "Introduction",
    "description": "Opening section shown first",
    "order": 1,
    "isActive": true,
    "createdAt": "2026-04-02T09:15:00.000Z",
    "updatedAt": "2026-04-02T09:15:00.000Z",
    "steps": [
      {
        "uuid": "fae55f41-b9b6-4a12-b7ba-8f7f25db89d0",
        "sectionUuid": "e61a64cb-cb85-4743-981d-a95bd9b938dd",
        "type": "VIDEO_TEXT",
        "order": 1,
        "isActive": true,
        "createdAt": "2026-04-02T09:16:00.000Z",
        "updatedAt": "2026-04-02T09:16:00.000Z",
        "content": {
          "uuid": "22a8f054-0d07-4c0b-9f85-a81270dfde78",
          "stepUuid": "fae55f41-b9b6-4a12-b7ba-8f7f25db89d0",
          "title": "Welcome Video",
          "description": "Kickoff content",
          "videoUrl": "https://cdn.example.com/welcome.mp4",
          "videoDuration": 120,
          "thumbnailUrl": "https://cdn.example.com/welcome.jpg",
          "textContent": "<p>Welcome to the funnel.</p>",
          "requireVideoCompletion": true,
          "createdAt": "2026-04-02T09:16:00.000Z",
          "updatedAt": "2026-04-02T09:16:00.000Z"
        },
        "phoneGate": null,
        "paymentGate": null,
        "decisionStep": null
      }
    ]
  }
]
```

- Important notes or business rules:
  - This is the best bootstrap endpoint for the CMS builder UI.
  - The response includes inactive sections and inactive steps too; the user runtime later filters by `isActive=true`.

#### Reorder sections

- HTTP Method + Full URL: `PATCH http://localhost:3000/api/v1/admin/funnel/sections/reorder`
- Required headers:
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json`
- Request body:

```json
[
  { "uuid": "e61a64cb-cb85-4743-981d-a95bd9b938dd", "order": 1 },
  { "uuid": "9f96d748-0d63-4c0a-921c-a20c15258b84", "order": 2 }
]
```

- Response shape:

```json
{
  "ok": true
}
```

- Important notes or business rules:
  - Each item must include a valid section UUID and an integer `order >= 1`.
  - The backend does not rebalance missing gaps for you; send the full intended order set from the frontend.

#### Update section

- HTTP Method + Full URL: `PATCH http://localhost:3000/api/v1/admin/funnel/sections/{sectionUuid}`
- Required headers:
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json`
- Request body:

```json
{
  "name": "Introduction and Promise",
  "description": "Updated intro copy",
  "order": 1,
  "isActive": true
}
```

- Response shape:

```json
{
  "uuid": "e61a64cb-cb85-4743-981d-a95bd9b938dd",
  "name": "Introduction and Promise",
  "description": "Updated intro copy",
  "order": 1,
  "isActive": true,
  "createdAt": "2026-04-02T09:15:00.000Z",
  "updatedAt": "2026-04-02T09:20:00.000Z"
}
```

- Important notes or business rules:
  - Setting `isActive=false` effectively unpublishes the section from the user-facing funnel structure.
  - The frontend should refetch `GET /admin/funnel/sections` after updates so the builder stays in sync.

#### Delete section

- HTTP Method + Full URL: `DELETE http://localhost:3000/api/v1/admin/funnel/sections/{sectionUuid}`
- Required headers:
  - `Authorization: Bearer <accessToken>`
- Request body:
  - None
- Response shape:

```json
{
  "ok": true
}
```

- Important notes or business rules:
  - Delete is blocked if any user currently has this section as `funnel_progress.currentSectionUuid`.
  - Expected business error:

```json
{
  "statusCode": 400,
  "error": "BadRequestException",
  "message": "Cannot delete section - 3 user(s) are currently on it",
  "timestamp": "2026-04-02T09:25:00.000Z",
  "path": "/api/v1/admin/funnel/sections/e61a64cb-cb85-4743-981d-a95bd9b938dd"
}
```

#### Create step

- HTTP Method + Full URL: `POST http://localhost:3000/api/v1/admin/funnel/steps`
- Required headers:
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json`
- Request body:

```json
{
  "sectionUuid": "e61a64cb-cb85-4743-981d-a95bd9b938dd",
  "type": "VIDEO_TEXT",
  "order": 1
}
```

- Response shape:

```json
{
  "uuid": "fae55f41-b9b6-4a12-b7ba-8f7f25db89d0",
  "sectionUuid": "e61a64cb-cb85-4743-981d-a95bd9b938dd",
  "type": "VIDEO_TEXT",
  "order": 1,
  "isActive": true,
  "createdAt": "2026-04-02T09:16:00.000Z",
  "updatedAt": "2026-04-02T09:16:00.000Z",
  "content": {
    "uuid": "22a8f054-0d07-4c0b-9f85-a81270dfde78",
    "stepUuid": "fae55f41-b9b6-4a12-b7ba-8f7f25db89d0",
    "title": "New Video Step",
    "description": null,
    "videoUrl": null,
    "videoDuration": null,
    "thumbnailUrl": null,
    "textContent": null,
    "requireVideoCompletion": true,
    "createdAt": "2026-04-02T09:16:00.000Z",
    "updatedAt": "2026-04-02T09:16:00.000Z"
  },
  "phoneGate": null,
  "paymentGate": null,
  "decisionStep": null
}
```

- Important notes or business rules:
  - Supported backend `type` values are `VIDEO_TEXT`, `PHONE_GATE`, `PAYMENT_GATE`, and `DECISION`.
  - The backend auto-creates default config/content records based on `type`.
  - If you want a "TEXT" step in product terms, create a `VIDEO_TEXT` step and fill `textContent`.

#### Get one step

- HTTP Method + Full URL: `GET http://localhost:3000/api/v1/admin/funnel/steps/{stepUuid}`
- Required headers:
  - `Authorization: Bearer <accessToken>`
- Request body:
  - None
- Response shape:

```json
{
  "uuid": "fae55f41-b9b6-4a12-b7ba-8f7f25db89d0",
  "sectionUuid": "e61a64cb-cb85-4743-981d-a95bd9b938dd",
  "type": "PAYMENT_GATE",
  "order": 3,
  "isActive": true,
  "createdAt": "2026-04-02T09:18:00.000Z",
  "updatedAt": "2026-04-02T09:19:00.000Z",
  "content": null,
  "phoneGate": null,
  "paymentGate": {
    "uuid": "f8d6d597-8ff7-4015-bfd4-4a0e9f5c3a93",
    "stepUuid": "fae55f41-b9b6-4a12-b7ba-8f7f25db89d0",
    "title": "Unlock the offer",
    "subtitle": "Pay to continue",
    "amount": "49900",
    "currency": "INR",
    "allowCoupons": true,
    "isActive": true
  },
  "decisionStep": null
}
```

- Important notes or business rules:
  - Use this when opening a type-specific editor drawer.
  - `paymentGate.amount` is stored as a Prisma decimal, so it may serialize as a string in some clients.

#### Reorder steps

- HTTP Method + Full URL: `PATCH http://localhost:3000/api/v1/admin/funnel/steps/reorder`
- Required headers:
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json`
- Request body:

```json
[
  { "uuid": "fae55f41-b9b6-4a12-b7ba-8f7f25db89d0", "order": 1 },
  { "uuid": "6f78682a-a4ce-4cc6-8cc6-48e912756ca9", "order": 2 }
]
```

- Response shape:

```json
{
  "ok": true
}
```

- Important notes or business rules:
  - The frontend should reorder only within a section; the backend does not validate cross-section drag and drop here.

#### Update step

- HTTP Method + Full URL: `PATCH http://localhost:3000/api/v1/admin/funnel/steps/{stepUuid}`
- Required headers:
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json`
- Request body:

```json
{
  "order": 2,
  "isActive": false
}
```

- Response shape:

```json
{
  "uuid": "fae55f41-b9b6-4a12-b7ba-8f7f25db89d0",
  "sectionUuid": "e61a64cb-cb85-4743-981d-a95bd9b938dd",
  "type": "VIDEO_TEXT",
  "order": 2,
  "isActive": false,
  "createdAt": "2026-04-02T09:16:00.000Z",
  "updatedAt": "2026-04-02T09:22:00.000Z"
}
```

- Important notes or business rules:
  - This is the publish/unpublish step endpoint. `isActive=true` publishes the step; `isActive=false` unpublishes it.
  - The response is the base step only. Refetch the step or section list if the UI needs nested config data.
  - For user visibility, `FunnelStep.isActive` is what matters. Config-level `isActive` on phone/payment config is stored, but the current user runtime checks only `step.isActive`.

#### Delete step

- HTTP Method + Full URL: `DELETE http://localhost:3000/api/v1/admin/funnel/steps/{stepUuid}`
- Required headers:
  - `Authorization: Bearer <accessToken>`
- Request body:
  - None
- Response shape:

```json
{
  "ok": true
}
```

- Important notes or business rules:
  - Delete is blocked if any user currently has this step as `funnel_progress.currentStepUuid`.
  - Expected business error:

```json
{
  "statusCode": 400,
  "error": "BadRequestException",
  "message": "Cannot delete step - 2 user(s) are currently on it",
  "timestamp": "2026-04-02T09:26:00.000Z",
  "path": "/api/v1/admin/funnel/steps/fae55f41-b9b6-4a12-b7ba-8f7f25db89d0"
}
```

#### Set video/text step content

- HTTP Method + Full URL: `PUT http://localhost:3000/api/v1/admin/funnel/steps/{stepUuid}/content`
- Required headers:
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json`
- Request body:

```json
{
  "title": "Welcome Video",
  "description": "Set up the promise and CTA",
  "videoUrl": "https://cdn.example.com/welcome.mp4",
  "videoDuration": 120,
  "thumbnailUrl": "https://cdn.example.com/welcome.jpg",
  "textContent": "<p>Read this before continuing.</p>",
  "requireVideoCompletion": true
}
```

- Response shape:

```json
{
  "uuid": "22a8f054-0d07-4c0b-9f85-a81270dfde78",
  "stepUuid": "fae55f41-b9b6-4a12-b7ba-8f7f25db89d0",
  "title": "Welcome Video",
  "description": "Set up the promise and CTA",
  "videoUrl": "https://cdn.example.com/welcome.mp4",
  "videoDuration": 120,
  "thumbnailUrl": "https://cdn.example.com/welcome.jpg",
  "textContent": "<p>Read this before continuing.</p>",
  "requireVideoCompletion": true,
  "createdAt": "2026-04-02T09:16:00.000Z",
  "updatedAt": "2026-04-02T09:30:00.000Z"
}
```

- Important notes or business rules:
  - Only valid for `VIDEO_TEXT` steps.
  - Use the same endpoint for both "video" and "text" product concepts.
  - For a text-only step, omit `videoUrl`, leave `videoDuration` empty, and typically set `requireVideoCompletion=false`.

#### Configure phone gate

- HTTP Method + Full URL: `PUT http://localhost:3000/api/v1/admin/funnel/steps/{stepUuid}/phone-gate`
- Required headers:
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json`
- Request body:

```json
{
  "title": "Verify your phone number",
  "subtitle": "We will send an OTP to WhatsApp or SMS",
  "isActive": true
}
```

- Response shape:

```json
{
  "uuid": "ee7cc6fd-fb6b-48b4-bc7a-1247bc469f74",
  "stepUuid": "4c2e1cfd-7776-4f04-a434-cfd44b45d7d6",
  "title": "Verify your phone number",
  "subtitle": "We will send an OTP to WhatsApp or SMS",
  "isActive": true
}
```

- Important notes or business rules:
  - Only valid for `PHONE_GATE` steps.
  - The current user runtime reads the step if `FunnelStep.isActive=true`; config `isActive` is saved but is not separately enforced today.

#### Configure payment gate

- HTTP Method + Full URL: `PUT http://localhost:3000/api/v1/admin/funnel/steps/{stepUuid}/payment-gate`
- Required headers:
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json`
- Request body:

```json
{
  "title": "Unlock the offer",
  "subtitle": "Pay now to continue",
  "amount": 49900,
  "currency": "INR",
  "allowCoupons": true,
  "isActive": true
}
```

- Response shape:

```json
{
  "uuid": "f8d6d597-8ff7-4015-bfd4-4a0e9f5c3a93",
  "stepUuid": "f0a9a5c6-61ea-4d4e-b496-6eb8b2dbcf91",
  "title": "Unlock the offer",
  "subtitle": "Pay now to continue",
  "amount": "49900",
  "currency": "INR",
  "allowCoupons": true,
  "isActive": true
}
```

- Important notes or business rules:
  - Only valid for `PAYMENT_GATE` steps.
  - `amount` is required by the DTO on create and update.
  - In the current codebase, amount fields are passed around as raw integers. Frontend display should format them explicitly.

#### Configure decision step

- HTTP Method + Full URL: `PUT http://localhost:3000/api/v1/admin/funnel/steps/{stepUuid}/decision`
- Required headers:
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json`
- Request body:

```json
{
  "question": "Are you interested in buying a Kangen machine?",
  "yesLabel": "Yes, I am interested",
  "noLabel": "Not right now",
  "yesSubtext": "A guide will follow up with you",
  "noSubtext": "You can continue learning by email"
}
```

- Response shape:

```json
{
  "uuid": "42e085bf-f23c-482f-8a44-c71c4166899e",
  "stepUuid": "28f5bbf6-e31d-4666-aea0-abbaec9da521",
  "question": "Are you interested in buying a Kangen machine?",
  "yesLabel": "Yes, I am interested",
  "noLabel": "Not right now",
  "yesSubtext": "A guide will follow up with you",
  "noSubtext": "You can continue learning by email"
}
```

- Important notes or business rules:
  - Only valid for `DECISION` steps.
  - The user-facing structure endpoint later shows decision steps with the generic title `Decision Step`; the actual question comes from the step detail endpoint.

### 1.3 Funnel Validation

The codebase validates the active funnel as warnings, not hard blocking errors.

#### Validate funnel

- HTTP Method + Full URL: `GET http://localhost:3000/api/v1/admin/funnel/validate`
- Required headers:
  - `Authorization: Bearer <accessToken>`
- Request body:
  - None
- Response shape:

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

- Important notes or business rules:
  - This endpoint currently returns warnings only; there is no hard "cannot go live" error state implemented.
  - Validation only inspects active sections and active steps.
  - Known warning codes:

| Code | Meaning |
| --- | --- |
| `PAYMENT_BEFORE_PHONE` | First payment gate appears before first phone gate |
| `MULTIPLE_PAYMENT_GATES` | More than one active payment gate exists |
| `MULTIPLE_PHONE_GATES` | More than one active phone gate exists |
| `NO_DECISION_STEP` | No active decision step exists |
| `DECISION_NOT_LAST` | Decision step is not the final active step |
| `EMPTY_SECTION` | An active section has zero active steps |

  - Possible non-business errors:
    - `401 Unauthorized` if the JWT is missing/invalid
    - `403 Forbidden` if the user is not `SUPER_ADMIN`

### 1.4 Funnel Analytics (Admin)

> Important note: the codebase defines two controllers under `/api/v1/admin/analytics`, and both declare `GET /api/v1/admin/analytics/funnel`. The endpoint shapes documented below are the funnel/CMS analytics endpoints from `src/funnel-cms/analytics.controller.ts`, which are the funnel-specific routes relevant to this guide.

#### Funnel analytics

- HTTP Method + Full URL: `GET http://localhost:3000/api/v1/admin/analytics/funnel`
- Required headers:
  - `Authorization: Bearer <accessToken>`
- Request body:
  - None
- Response shape:

```json
[
  {
    "stepUuid": "fae55f41-b9b6-4a12-b7ba-8f7f25db89d0",
    "stepTitle": "Welcome Video",
    "stepType": "VIDEO_TEXT",
    "sectionName": "Introduction",
    "order": 1,
    "totalReached": 120,
    "totalCompleted": 98,
    "dropOffCount": 22,
    "dropOffRate": 18.33
  },
  {
    "stepUuid": "4c2e1cfd-7776-4f04-a434-cfd44b45d7d6",
    "stepTitle": "Verify your phone number",
    "stepType": "PHONE_GATE",
    "sectionName": "Qualification",
    "order": 2,
    "totalReached": 98,
    "totalCompleted": 70,
    "dropOffCount": 28,
    "dropOffRate": 28.57
  }
]
```

- Important notes or business rules:
  - Only active steps are included.
  - The list is ordered by section order and then step order.
  - `totalReached` is the number of `step_progress` rows for that step.
  - `dropOffRate` is rounded to 2 decimal places.

#### UTM analytics

- HTTP Method + Full URL: `GET http://localhost:3000/api/v1/admin/analytics/utm`
- Required headers:
  - `Authorization: Bearer <accessToken>`
- Request body:
  - None
- Response shape:

```json
{
  "bySource": [
    { "utmSource": "facebook", "count": 40 },
    { "utmSource": "youtube", "count": 15 }
  ],
  "byMedium": [
    { "utmMedium": "cpc", "count": 40 },
    { "utmMedium": "organic", "count": 15 }
  ],
  "byCampaign": [
    { "utmCampaign": "spring_launch", "count": 18 },
    { "utmCampaign": "retargeting_q2", "count": 12 }
  ],
  "byDistributor": [
    {
      "distributorCode": "DIST100",
      "distributorUuid": "a4d9359d-b6e5-46dd-b76d-1d96e0548ac6",
      "count": 9
    }
  ]
}
```

- Important notes or business rules:
  - Data comes from `user_acquisitions`.
  - Null values can appear in grouped results if the source data was missing.
  - `distributorUuid` is resolved only when the referral code matched an active distributor join link.

#### Device analytics

- HTTP Method + Full URL: `GET http://localhost:3000/api/v1/admin/analytics/devices`
- Required headers:
  - `Authorization: Bearer <accessToken>`
- Request body:
  - None
- Response shape:

```json
{
  "byDevice": [
    { "deviceType": "mobile", "count": 67 },
    { "deviceType": "desktop", "count": 21 }
  ],
  "byCountry": [
    { "country": "IN", "count": 70 },
    { "country": "US", "count": 18 }
  ]
}
```

- Important notes or business rules:
  - `deviceType` is not inferred from the user agent in backend code; it must be supplied by the frontend tracking request.
  - Country comes from GeoIP lookup during tracking capture.

#### Conversion analytics

- HTTP Method + Full URL: `GET http://localhost:3000/api/v1/admin/analytics/conversions`
- Required headers:
  - `Authorization: Bearer <accessToken>`
- Request body:
  - None
- Response shape:

```json
{
  "totalRegistered": 250,
  "totalPhoneVerified": 150,
  "totalPaid": 95,
  "totalReachedDecision": 80,
  "totalYes": 42,
  "totalNo": 38,
  "phoneVerifyRate": 60,
  "paymentRate": 63.33,
  "decisionRate": 84.21,
  "yesRate": 52.5
}
```

- Important notes or business rules:
  - These totals are overall counts, not date-filtered.
  - Rate formulas:
    - `phoneVerifyRate = totalPhoneVerified / totalRegistered * 100`
    - `paymentRate = totalPaid / totalPhoneVerified * 100`
    - `decisionRate = totalReachedDecision / totalPaid * 100`
    - `yesRate = totalYes / totalReachedDecision * 100`

## 2. User Side (Funnel Experience)

### 2.1 Registration and Auth Flow

#### Global auth notes

- Protected routes require `Authorization: Bearer <accessToken>`.
- The refresh token is stored in an `HttpOnly` cookie named `refresh_token`; the frontend cannot read it directly.
- UTM and referral data are not passed into `/auth/signup`. They must be captured separately with `POST /tracking/capture`.
- After email OTP verification, the backend attaches the `nsi_acquisition` cookie data to the user record and clears that cookie.

#### Sign up

- HTTP Method + Full URL: `POST http://localhost:3000/api/v1/auth/signup`
- Required headers:
  - `Content-Type: application/json`
- Request body:

```json
{
  "fullName": "Aarav Mehta",
  "email": "aarav@example.com",
  "password": "StrongPassword123"
}
```

- Response shape:

```json
{
  "message": "Registration successful. Check your email for OTP."
}
```

- Step-by-step flow explanation:
  1. Call this after capturing tracking data.
  2. The backend creates a `users` row with `status=REGISTERED`.
  3. The backend generates a 6-digit email OTP and sends it through the configured mail provider.
  4. Move the UI to the email OTP entry screen.

- Common errors and how to handle them:
  - `400` validation errors such as missing `fullName`, bad email, or password shorter than 8 characters
  - `409 Conflict` when the email already exists
  - `429 Too Many Requests` after the signup rate limit is hit

- Frontend implementation tips:
  - Do not send UTM fields here; they will be rejected by the global validation pipe.
  - If `MAIL_PROVIDER=mock`, the backend writes the OTP to `test-otp.txt`.

#### Verify email OTP

- HTTP Method + Full URL: `POST http://localhost:3000/api/v1/auth/verify-email-otp`
- Required headers:
  - `Content-Type: application/json`
- Request body:

```json
{
  "email": "aarav@example.com",
  "otp": "123456"
}
```

- Response shape:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "uuid": "e3d64ce3-387b-46ab-8e6b-c5488467f786",
    "fullName": "Aarav Mehta",
    "email": "aarav@example.com",
    "role": "USER",
    "status": "PROFILE_INCOMPLETE"
  },
  "needsCountry": true
}
```

- Step-by-step flow explanation:
  1. Submit the email and 6-digit OTP.
  2. The backend verifies the OTP, marks the email as verified, and auto-logs the user in.
  3. A refresh token cookie is set on the response.
  4. The backend attaches any previously captured UTM/referral cookie to the user.
  5. If the user has no country yet, `needsCountry=true` and the backend sets `status=PROFILE_INCOMPLETE`.

- Common errors and how to handle them:
  - `400 Bad Request` for invalid email/OTP, expired OTP, or max OTP attempts reached
  - `429 Too Many Requests` if the endpoint throttle is exceeded

- Frontend implementation tips:
  - Store `accessToken`.
  - Do not try to read the refresh token cookie.
  - If `needsCountry=true`, immediately route to the profile completion screen.

#### Resend email OTP

- HTTP Method + Full URL: `POST http://localhost:3000/api/v1/auth/resend-otp`
- Required headers:
  - `Content-Type: application/json`
- Request body:

```json
{
  "email": "aarav@example.com"
}
```

- Response shape:

```json
{
  "message": "New OTP sent. Check your email."
}
```

- Step-by-step flow explanation:
  1. Call this only from the OTP screen.
  2. The backend enforces a resend limit of 3 per hour per email.
  3. If the account is still in `REGISTERED`, a fresh OTP is generated and the previous one is invalidated.

- Common errors and how to handle them:
  - `400 Bad Request` with `Too many requests. Please wait 1 hour before requesting again.`

- Frontend implementation tips:
  - For privacy, some branches return a generic success message even when the account is missing or already verified. Treat any `200` as "show success toast".

#### Complete profile

- HTTP Method + Full URL: `POST http://localhost:3000/api/v1/auth/complete-profile`
- Required headers:
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json`
- Request body:

```json
{
  "country": "IN"
}
```

- Response shape:

```json
{
  "message": "Profile completed successfully."
}
```

- Step-by-step flow explanation:
  1. Show a country picker when `needsCountry=true`.
  2. Submit a 2-letter ISO country code.
  3. The backend updates `user.country`, sets `status=ACTIVE`, creates a lead with initial status `NEW`, and queues a welcome email.

- Common errors and how to handle them:
  - `400 Bad Request` for invalid country codes
  - `400 Bad Request` if profile completion is not required anymore
  - `401 Unauthorized` if the access token is missing/invalid

- Frontend implementation tips:
  - Call `GET /auth/me` or update local user state after success because this endpoint returns only a message, not a new user object.
  - Country values must be uppercase ISO alpha-2 codes such as `IN`, `US`, or `AE`.

#### Login

- HTTP Method + Full URL: `POST http://localhost:3000/api/v1/auth/login`
- Required headers:
  - `Content-Type: application/json`
- Request body:

```json
{
  "email": "aarav@example.com",
  "password": "StrongPassword123"
}
```

- Response shape:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "uuid": "e3d64ce3-387b-46ab-8e6b-c5488467f786",
    "fullName": "Aarav Mehta",
    "email": "aarav@example.com",
    "role": "USER",
    "status": "ACTIVE"
  },
  "needsCountry": false
}
```

- Step-by-step flow explanation:
  1. Submit email and password.
  2. The backend validates the password, creates a new refresh session, and returns a fresh access token.
  3. A refresh token cookie is set in the response.

- Common errors and how to handle them:
  - `401 Unauthorized` for invalid credentials
  - `401 Unauthorized` with `Please verify your email first`
  - `401 Unauthorized` with `This account uses Google Sign-In. Please continue with Google.`
  - `403 Forbidden` if the account is suspended

- Frontend implementation tips:
  - Use the same endpoint for normal users and admins.
  - If `needsCountry=true`, go to the profile completion screen before loading funnel routes.

#### Refresh access token

- HTTP Method + Full URL: `POST http://localhost:3000/api/v1/auth/refresh`
- Required headers:
  - No auth header required
  - Browser request must include cookies
- Request body:
  - None
- Response shape:

```json
{
  "accessToken": "new-jwt-token",
  "user": {
    "uuid": "e3d64ce3-387b-46ab-8e6b-c5488467f786",
    "fullName": "Aarav Mehta",
    "email": "aarav@example.com",
    "role": "USER",
    "status": "ACTIVE"
  }
}
```

- Step-by-step flow explanation:
  1. Send a cookie-enabled request when an API call returns `401`.
  2. The backend reads `refresh_token` from the cookie, rotates it, and returns a new access token plus current user payload.
  3. Retry the original request with the new access token.

- Common errors and how to handle them:
  - `401 Unauthorized` when the cookie is missing, invalid, or expired
  - `403 Forbidden` if the user was suspended

- Frontend implementation tips:
  - Use a response interceptor so refresh happens once automatically.
  - Always update the in-memory or persisted access token after a successful refresh.

#### Get current user

- HTTP Method + Full URL: `GET http://localhost:3000/api/v1/auth/me`
- Required headers:
  - `Authorization: Bearer <accessToken>`
- Request body:
  - None
- Response shape:

```json
{
  "uuid": "e3d64ce3-387b-46ab-8e6b-c5488467f786",
  "fullName": "Aarav Mehta",
  "email": "aarav@example.com",
  "role": "USER",
  "status": "ACTIVE"
}
```

- Step-by-step flow explanation:
  1. Call this after app reloads or Google OAuth callback.
  2. Use the response to rebuild auth state and role-based routing.

- Common errors and how to handle them:
  - `401 Unauthorized` for missing/invalid tokens

- Frontend implementation tips:
  - This endpoint is especially useful after `complete-profile`, because that endpoint does not return an updated user object.

#### Logout

- HTTP Method + Full URL: `POST http://localhost:3000/api/v1/auth/logout`
- Required headers:
  - Cookies enabled
  - `Authorization: Bearer <accessToken>` is optional but recommended
- Request body:
  - None
- Response shape:

```json
{
  "message": "Logged out successfully."
}
```

- Step-by-step flow explanation:
  1. Call this from the account menu or forced logout flow.
  2. The backend deletes the matching refresh session if present.
  3. The backend clears the `refresh_token` cookie.

- Common errors and how to handle them:
  - This endpoint is intentionally forgiving; the normal result is still `200` even if the cookie was already gone.

- Frontend implementation tips:
  - Always clear the stored access token and local user state after success.

#### Google OAuth entry point

- HTTP Method + Full URL: `GET http://localhost:3000/api/v1/auth/google`
- Required headers:
  - None
- Request body:
  - None
- Response shape:
  - HTTP `302` redirect to Google OAuth

- Step-by-step flow explanation:
  1. Redirect the browser, not `fetch`, to this URL.
  2. Passport starts the Google OAuth flow.

- Common errors and how to handle them:
  - OAuth configuration errors will surface as backend/server errors rather than JSON validation errors.

- Frontend implementation tips:
  - Do not call this from XHR. Use `window.location.href`.

#### Google OAuth callback

- HTTP Method + Full URL: `GET http://localhost:3000/api/v1/auth/google/callback`
- Required headers:
  - None; this is called by Google
- Request body:
  - None
- Response shape:
  - HTTP `302` redirect to `http://localhost:3000/api/v1/auth/finalize-google?code=<uuid>`

- Step-by-step flow explanation:
  1. Google redirects here after successful OAuth.
  2. The backend logs the user in or merges/creates the account.
  3. The backend stores a short-lived one-time code in memory and redirects to `finalize-google`.

- Common errors and how to handle them:
  - This is backend-managed. The frontend normally does not call it directly.

- Frontend implementation tips:
  - No frontend AJAX integration is needed here.

#### Google OAuth finalize step

- HTTP Method + Full URL: `GET http://localhost:3000/api/v1/auth/finalize-google?code={oauthCode}`
- Required headers:
  - None
- Request body:
  - None
- Response shape:
  - On success: HTTP `302` redirect to `http://localhost:3001/auth/callback?token=<accessToken>&fullName=<encodedName>&needsCountry=<true|false>`
  - On failure: HTTP `302` redirect to `http://localhost:3001/auth/error?reason=missing_code` or `invalid_or_expired_code`

- Step-by-step flow explanation:
  1. This endpoint sets the `refresh_token` cookie on the backend domain.
  2. It then redirects the browser to the frontend callback route with the access token in the query string.

- Common errors and how to handle them:
  - Missing code or expired code causes a redirect to `/auth/error`.

- Frontend implementation tips:
  - On the frontend callback page:
    1. read `token` and `needsCountry` from the query string
    2. store the access token
    3. call `GET /auth/me`
    4. if `needsCountry=true`, send the user to profile completion

#### Set password for a Google user

- HTTP Method + Full URL: `POST http://localhost:3000/api/v1/auth/set-password`
- Required headers:
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json`
- Request body:

```json
{
  "newPassword": "StrongPassword123"
}
```

- Response shape:

```json
{
  "message": "Password set successfully. You can now login with email and password."
}
```

- Step-by-step flow explanation:
  1. Use this only for Google-authenticated users who do not already have a local password.
  2. The backend hashes the password and stores it on the same user account.

- Common errors and how to handle them:
  - `400 Bad Request` if the user already has a password
  - `401 Unauthorized` if the token is invalid

- Frontend implementation tips:
  - Hide this route for normal email-password accounts.

### 2.2 Funnel Progress Flow

#### Common user-funnel headers

Unless stated otherwise, every endpoint in this section requires:

- `Authorization: Bearer <accessToken>`
- `Content-Type: application/json` for requests with a body

These routes are also behind `OnboardingGuard`. If the user's profile is incomplete, the backend returns `403` with `Please complete your profile first`.

#### Get funnel structure

- HTTP Method + Full URL: `GET http://localhost:3000/api/v1/funnel/structure`
- Required headers:
  - `Authorization: Bearer <accessToken>`
- Request body:
  - None
- Response shape:

```json
{
  "sections": [
    {
      "uuid": "e61a64cb-cb85-4743-981d-a95bd9b938dd",
      "name": "Introduction",
      "description": "Opening section shown first",
      "order": 1,
      "steps": [
        {
          "uuid": "fae55f41-b9b6-4a12-b7ba-8f7f25db89d0",
          "type": "VIDEO_TEXT",
          "order": 1,
          "isActive": true,
          "title": "Welcome Video"
        },
        {
          "uuid": "4c2e1cfd-7776-4f04-a434-cfd44b45d7d6",
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

- Step-by-step flow explanation:
  1. Call this once when bootstrapping the funnel page.
  2. Use it to build the sidebar, stepper, or section navigation.
  3. Combine it with `GET /funnel/progress` to mark completed/current/locked states.

- Common errors and how to handle them:
  - `401 Unauthorized`
  - `403 Forbidden` when onboarding is incomplete

- Frontend implementation tips:
  - The structure endpoint includes only active sections and active steps.
  - Decision steps show the generic title `Decision Step` here; load the step detail endpoint for the actual question text.

#### Get current progress

- HTTP Method + Full URL: `GET http://localhost:3000/api/v1/funnel/progress`
- Required headers:
  - `Authorization: Bearer <accessToken>`
- Request body:
  - None
- Response shape:

```json
{
  "currentSectionUuid": "e61a64cb-cb85-4743-981d-a95bd9b938dd",
  "currentStepUuid": "fae55f41-b9b6-4a12-b7ba-8f7f25db89d0",
  "status": "IN_PROGRESS",
  "phoneVerified": false,
  "paymentCompleted": false,
  "decisionAnswer": null,
  "completedStepUuids": []
}
```

- Step-by-step flow explanation:
  1. Call this immediately after auth/profile completion.
  2. If no progress exists yet, the backend auto-creates it and points the user at the first active step in the first active section.
  3. Use `currentStepUuid` to load the current step detail.

- Common errors and how to handle them:
  - `401 Unauthorized`
  - `403 Forbidden` when onboarding is incomplete

- Frontend implementation tips:
  - This is the main source of truth for funnel state. Do not infer the next step on the client without refreshing progress.

#### Get one step

- HTTP Method + Full URL: `GET http://localhost:3000/api/v1/funnel/step/{stepUuid}`
- Required headers:
  - `Authorization: Bearer <accessToken>`
- Request body:
  - None
- Response shape:

`VIDEO_TEXT`

```json
{
  "type": "VIDEO_TEXT",
  "content": {
    "uuid": "22a8f054-0d07-4c0b-9f85-a81270dfde78",
    "stepUuid": "fae55f41-b9b6-4a12-b7ba-8f7f25db89d0",
    "title": "Welcome Video",
    "description": "Watch this before continuing",
    "videoUrl": "https://cdn.example.com/welcome.mp4",
    "videoDuration": 120,
    "thumbnailUrl": "https://cdn.example.com/welcome.jpg",
    "textContent": "<p>Bonus reading content.</p>",
    "requireVideoCompletion": true,
    "createdAt": "2026-04-02T09:16:00.000Z",
    "updatedAt": "2026-04-02T09:16:00.000Z"
  }
}
```

`PHONE_GATE`

```json
{
  "type": "PHONE_GATE",
  "phoneGate": {
    "uuid": "ee7cc6fd-fb6b-48b4-bc7a-1247bc469f74",
    "stepUuid": "4c2e1cfd-7776-4f04-a434-cfd44b45d7d6",
    "title": "Verify your phone number",
    "subtitle": "We will send an OTP to WhatsApp or SMS",
    "isActive": true
  }
}
```

`PAYMENT_GATE`

```json
{
  "type": "PAYMENT_GATE",
  "paymentGate": {
    "title": "Unlock the offer",
    "subtitle": "Pay now to continue",
    "amount": "49900",
    "currency": "INR"
  }
}
```

`DECISION`

```json
{
  "type": "DECISION",
  "decisionStep": {
    "uuid": "42e085bf-f23c-482f-8a44-c71c4166899e",
    "stepUuid": "28f5bbf6-e31d-4666-aea0-abbaec9da521",
    "question": "Are you interested in buying a Kangen machine?",
    "yesLabel": "Yes, I am interested",
    "noLabel": "Not right now",
    "yesSubtext": "A guide will follow up with you",
    "noSubtext": "You can continue learning by email"
  }
}
```

- Step-by-step flow explanation:
  1. Call this with the current `progress.currentStepUuid`.
  2. Render the screen by `type`.
  3. Reuse it after every successful step transition.

- Common errors and how to handle them:
  - `404 Not Found` if the step does not exist or is inactive
  - `400 Bad Request` with `You must complete the previous steps first` when the step is locked
  - `401 Unauthorized`
  - `403 Forbidden` when onboarding is incomplete

- Frontend implementation tips:
  - A step is accessible only if it is the current step or already completed.
  - Completed steps can be re-opened for review.
  - `paymentGate.amount` comes back as a string here, so parse/format it carefully.

#### Save video progress

- HTTP Method + Full URL: `POST http://localhost:3000/api/v1/funnel/step/{stepUuid}/video-progress`
- Required headers:
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json`
- Request body:

```json
{
  "watchedSeconds": 87
}
```

- Response shape:

```json
{
  "ok": true
}
```

- Step-by-step flow explanation:
  1. Call this periodically while the user watches a `VIDEO_TEXT` step.
  2. The backend stores or updates `step_progress.watchedSeconds`.
  3. The backend never decreases the stored watched time.

- Common errors and how to handle them:
  - `400 Bad Request` if `watchedSeconds` is negative or not an integer
  - `401 Unauthorized`
  - `403 Forbidden`

- Frontend implementation tips:
  - A practical cadence is every 5 to 10 seconds, plus `pause` and `ended`.
  - Treat this as progress persistence only. It does not itself complete the funnel step.

#### Complete a video/text step

- HTTP Method + Full URL: `POST http://localhost:3000/api/v1/funnel/step/{stepUuid}/complete`
- Required headers:
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json`
- Request body:

```json
{
  "watchedSeconds": 120
}
```

- Response shape:

```json
{
  "ok": true
}
```

or, when already completed:

```json
{
  "ok": true,
  "message": "Step already completed"
}
```

- Step-by-step flow explanation:
  1. Use this only for `VIDEO_TEXT` steps from the frontend.
  2. If `requireVideoCompletion=true`, the backend checks whether `watchedSeconds >= videoDuration - 3`.
  3. On success, the backend marks the step complete and advances `currentStepUuid` to the next active step.
  4. After success, call `GET /funnel/progress` and then `GET /funnel/step/{currentStepUuid}`.

- Common errors and how to handle them:
  - `400 Bad Request` with `You must complete the previous steps first`
  - `400 Bad Request` with `Please watch the complete video before proceeding`
  - `404 Not Found` if the step is missing or inactive

- Frontend implementation tips:
  - There is no 90 percent auto-complete rule in the funnel module. The actual backend rule is `videoDuration - 3 seconds`.
  - For a text-only `VIDEO_TEXT` step, configure `requireVideoCompletion=false` in the CMS and then call this endpoint with an empty object or without `watchedSeconds`.

#### Send phone OTP

- HTTP Method + Full URL: `POST http://localhost:3000/api/v1/phone/send-otp`
- Required headers:
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json`
- Request body:

```json
{
  "phone": "+919876543210",
  "channel": "whatsapp"
}
```

- Response shape:

```json
{
  "message": "OTP sent successfully",
  "channel": "whatsapp"
}
```

- Step-by-step flow explanation:
  1. Show the phone gate UI loaded from `GET /funnel/step/{stepUuid}`.
  2. Collect the phone number and channel (`whatsapp` or `sms`).
  3. Call this endpoint to start verification.

- Common errors and how to handle them:
  - `400 Bad Request` for invalid phone format
  - `409 Conflict` if the phone already belongs to another user
  - `409 Conflict` if this account has already verified a phone
  - `429 Too Many Requests` after 3 sends within 1 hour

- Frontend implementation tips:
  - `channel` defaults to `whatsapp` if omitted.
  - The backend normalizes phone numbers into E.164 format. Display the normalized value in the UI if needed.

#### Verify phone OTP

- HTTP Method + Full URL: `POST http://localhost:3000/api/v1/phone/verify-otp`
- Required headers:
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json`
- Request body:

```json
{
  "phone": "+919876543210",
  "code": "123456",
  "channel": "whatsapp"
}
```

- Response shape:

```json
{
  "message": "Phone verified successfully",
  "progress": {
    "phoneVerified": true,
    "paymentCompleted": false,
    "currentStepUuid": "f0a9a5c6-61ea-4d4e-b496-6eb8b2dbcf91",
    "currentSectionUuid": "79c2b52f-4ae5-4306-8f8a-57f8c60f4c0b"
  }
}
```

- Step-by-step flow explanation:
  1. Submit the same phone number, the 6-digit OTP, and the channel.
  2. On success, the backend:
     - stores the phone in `user_profiles`
     - sets `phoneVerifiedAt`
     - marks the current phone gate as completed
     - advances funnel progress to the next step
     - updates the user's lead from `NEW` to `WARM`
  3. Use the returned `progress.currentStepUuid` to fetch the next step.

- Common errors and how to handle them:
  - `400 Bad Request` with `Invalid OTP`
  - `429 Too Many Requests` after 3 wrong attempts within 1 hour
  - `401 Unauthorized`
  - `403 Forbidden`

- Frontend implementation tips:
  - In mock phone mode, the OTP is always `123456`.
  - Do not call the generic funnel complete endpoint after a successful phone verification; this endpoint already completes and advances the step.

#### Validate a coupon

- HTTP Method + Full URL: `POST http://localhost:3000/api/v1/coupons/validate`
- Required headers:
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json`
- Request body:

```json
{
  "code": "WELCOME50",
  "paymentType": "COMMITMENT_FEE"
}
```

- Response shape:

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

- Step-by-step flow explanation:
  1. Call this while the user is on a payment gate and has entered a coupon code.
  2. The backend looks up the current payment step amount from the user's current funnel progress.
  3. The response gives a preview only; the coupon is not consumed yet.

- Common errors and how to handle them:
  - `404 Not Found` with `Coupon not found`
  - `400 Bad Request` for inactive, expired, maxed-out, already-used, or scope-mismatched coupons
  - `401 Unauthorized`
  - `403 Forbidden`

- Frontend implementation tips:
  - Always use `paymentType: "COMMITMENT_FEE"` for the funnel payment step.
  - Because the backend derives `originalAmount` from the current payment gate, call this only after the user has reached the payment step.

#### Create a payment order

- HTTP Method + Full URL: `POST http://localhost:3000/api/v1/payments/create-order`
- Required headers:
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json`
- Request body without coupon:

```json
{}
```

- Request body with coupon:

```json
{
  "couponCode": "WELCOME50"
}
```

- Response shape for a paid checkout:

```json
{
  "orderId": "order_Rzp123456789",
  "amount": 24950,
  "currency": "INR",
  "keyId": "rzp_test_xxxxxxxxxxxxxxxx"
}
```

- Response shape for full discount / free access:

```json
{
  "freeAccess": true
}
```

- Step-by-step flow explanation:
  1. Ensure the user has already completed phone verification.
  2. Optionally validate a coupon first.
  3. Call `create-order`.
  4. If the response is `{ "freeAccess": true }`, the backend already:
     - created a successful synthetic payment
     - marked `paymentCompleted=true`
     - completed the payment step
     - advanced the funnel
  5. If the response contains `orderId`, open Razorpay Checkout and then poll `GET /payments/status`.

- Common errors and how to handle them:
  - `403 Forbidden` with `Phone verification required before payment`
  - `403 Forbidden` with `You must reach the payment step first`
  - `400 Bad Request` with `Payment gate is not configured`
  - `409 Conflict` with `Payment already completed`
  - Coupon validation errors from the coupon service

- Frontend implementation tips:
  - Do not send locally computed prices to the backend. Use the backend response as the payment source of truth.
  - The backend has no separate "verify payment signature" endpoint for the frontend. Checkout success should transition the UI to a "Confirming payment..." state, then rely on `/payments/status`.

#### Get payment status

- HTTP Method + Full URL: `GET http://localhost:3000/api/v1/payments/status`
- Required headers:
  - `Authorization: Bearer <accessToken>`
- Request body:
  - None
- Response shape before payment success:

```json
{
  "paymentCompleted": false,
  "payment": null
}
```

- Response shape after payment success:

```json
{
  "paymentCompleted": true,
  "payment": {
    "uuid": "5465dc32-c706-4051-9f03-8bd5e8c5318a",
    "gatewayOrderId": "order_Rzp123456789",
    "amount": 49900,
    "discountAmount": 24950,
    "finalAmount": 24950,
    "currency": "INR",
    "status": "SUCCESS",
    "paymentType": "COMMITMENT_FEE",
    "createdAt": "2026-04-02T10:15:00.000Z"
  }
}
```

- Step-by-step flow explanation:
  1. Poll this after a Razorpay success callback or after a free-access response.
  2. When `paymentCompleted=true`, call `GET /funnel/progress` and then load the next step.

- Common errors and how to handle them:
  - `401 Unauthorized`
  - `403 Forbidden`

- Frontend implementation tips:
  - This endpoint returns only the latest successful payment, not pending or failed ones.
  - If checkout fails or is cancelled, keep the user on the payment screen and let them retry `create-order`.
  - In mock payment mode, status usually flips to success after about 2 seconds.

#### Submit the final decision

- HTTP Method + Full URL: `POST http://localhost:3000/api/v1/funnel/decision`
- Required headers:
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json`
- Request body:

```json
{
  "stepUuid": "28f5bbf6-e31d-4666-aea0-abbaec9da521",
  "answer": "YES"
}
```

or

```json
{
  "stepUuid": "28f5bbf6-e31d-4666-aea0-abbaec9da521",
  "answer": "NO"
}
```

- Response shape:

```json
{
  "ok": true
}
```

- Step-by-step flow explanation:
  1. Render the decision screen from `GET /funnel/step/{stepUuid}`.
  2. Submit `YES` or `NO`.
  3. On `YES`, the backend updates the existing lead to `HOT`.
  4. On `NO`, the backend updates the lead to `NURTURE` and creates a nurture enrollment whose first email is scheduled for roughly 24 hours later.

- Common errors and how to handle them:
  - `400 Bad Request` with `Invalid decision step`
  - `400 Bad Request` with `Decision already recorded`
  - `401 Unauthorized`
  - `403 Forbidden`

- Frontend implementation tips:
  - Show a thank-you or completion screen immediately after a successful response.
  - The current backend does not set `funnel_progress.status=COMPLETED` or clear `currentStepUuid` inside this endpoint, so do not wait for a new progress state before showing the final UI.

### 2.3 Step Locking Rules

| Step state | How the backend decides it | What the frontend should show |
| --- | --- | --- |
| Current step | `progress.currentStepUuid === step.uuid` | Unlocked and actionable |
| Completed step | `step.uuid` is in `completedStepUuids` | Unlocked, reviewable, and visually marked complete |
| Future step | Not current and not completed | Locked |
| Hidden step | Missing from `GET /funnel/structure` because section/step is inactive | Do not show |

Additional rules:

- On first entry, the backend auto-creates progress and points the user at the first active step in the first active section.
- A step becomes accessible only after the backend advances progress:
  - `VIDEO_TEXT` after `POST /funnel/step/{stepUuid}/complete`
  - `PHONE_GATE` after `POST /phone/verify-otp`
  - `PAYMENT_GATE` after payment success or free access
  - `DECISION` is the current end state; no later step is unlocked by the current code
- If a user tries to open a locked step directly, `GET /funnel/step/{stepUuid}` returns:

```json
{
  "statusCode": 400,
  "error": "BadRequestException",
  "message": "You must complete the previous steps first",
  "timestamp": "2026-04-02T10:25:00.000Z",
  "path": "/api/v1/funnel/step/locked-step-uuid"
}
```

### 2.4 Phone Verification Flow

1. Load the current step with `GET /funnel/step/{stepUuid}` and confirm `type === "PHONE_GATE"`.
2. Show the phone number field plus a channel selector (`whatsapp` / `sms`).
3. Call `POST /phone/send-otp`.
4. Show the OTP entry UI.
5. Call `POST /phone/verify-otp`.
6. Use the returned `progress.currentStepUuid` to load the next step.
7. Update local lead-state UI if needed, because the backend moves the lead to `WARM`.

### 2.5 Payment Flow

1. Load the payment step with `GET /funnel/step/{stepUuid}`.
2. Optionally preview a coupon with `POST /coupons/validate`.
3. Call `POST /payments/create-order`.
4. If the response is `{ "freeAccess": true }`, skip checkout and refresh progress.
5. If the response includes `orderId`, open Razorpay Checkout on the frontend.
6. On Razorpay success callback, switch the UI into "Confirming payment..." and start polling `GET /payments/status`.
7. When `paymentCompleted=true`, call `GET /funnel/progress` and then `GET /funnel/step/{currentStepUuid}`.

> Webhook confirmation is backend-only. The frontend should never call `POST /payments/webhook`.

### 2.6 Coupon System

1. Collect the coupon code on the payment screen.
2. Preview it with `POST /coupons/validate`.
3. Show:
   - original amount
   - discount amount
   - final amount
4. Pass the same `couponCode` into `POST /payments/create-order`.
5. Expect the backend to validate the coupon again inside the payment transaction.

Important coupon rules from code:

- Codes are normalized to uppercase and trimmed by the backend.
- `FREE` coupons can make `finalAmount=0`, which converts the payment step into immediate free access.
- Coupon usage is consumed only on successful payment or successful free-access grant.

### 2.7 UTM and Referral Tracking

#### Capture UTM and referral data

- HTTP Method + Full URL: `POST http://localhost:3000/api/v1/tracking/capture`
- Required headers:
  - `Content-Type: application/json`
- Request body:

```json
{
  "utmSource": "facebook",
  "utmMedium": "cpc",
  "utmCampaign": "spring_launch",
  "utmContent": "video_1",
  "utmTerm": "alkaline water machine",
  "referrerUrl": "https://facebook.com",
  "landingPage": "/landing/kangen",
  "distributorCode": "DIST100",
  "deviceType": "mobile",
  "browser": "chrome"
}
```

- Response shape:

```json
{
  "ok": true
}
```

- Step-by-step flow explanation:
  1. Read UTM params and referral/distributor code from the landing page URL.
  2. Call this endpoint before signup or login, ideally once per marketing session.
  3. The backend stores an `HttpOnly` cookie named `nsi_acquisition` for 24 hours.
  4. When the user later verifies email OTP, the backend attaches this data to `user_acquisitions`.

- Common errors and how to handle them:
  - `400 Bad Request` for invalid payload types
  - `429 Too Many Requests` after 10 requests per IP per minute

- Frontend implementation tips:
  - `deviceType` and `browser` are not derived automatically by backend code; send them from the frontend if you need them in analytics.
  - `distributorCode` is resolved to a distributor UUID only if the code belongs to a `DISTRIBUTOR` user whose join link is active.
  - If the user is already authenticated when you call this endpoint, the backend can upsert the acquisition data immediately.

## 3. Complete User Journey Map

1. User lands on the site with URL params such as `?utm_source=facebook&utm_campaign=spring_launch&ref=DIST100`.
   - API to call: none yet.
   - Frontend action: parse UTM params and referral/distributor code from the URL.
   - UI to show: landing page content and signup CTA.

2. Capture acquisition data.
   - API to call: `POST http://localhost:3000/api/v1/tracking/capture`
   - What to do with the response: expect `{ "ok": true }`; no UI state change is required.
   - UI to show: keep the user on the landing page or proceed to signup.

3. Register the account.
   - API to call: `POST http://localhost:3000/api/v1/auth/signup`
   - What to do with the response: show the returned message and switch to the email OTP screen.
   - UI to show: OTP entry form and resend button.

4. Verify the email OTP and create the session.
   - API to call: `POST http://localhost:3000/api/v1/auth/verify-email-otp`
   - What to do with the response:
     - store `accessToken`
     - let the browser keep the refresh cookie
     - read `needsCountry`
   - UI to show: if `needsCountry=true`, show the profile completion screen.

5. Complete the profile with country selection.
   - API to call: `POST http://localhost:3000/api/v1/auth/complete-profile`
   - What to do with the response:
     - show success toast
     - optionally call `GET /auth/me`
   - Backend side effect: a lead is created with status `NEW`.
   - UI to show: transition into the funnel shell.

6. Bootstrap the funnel.
   - API to call:
     - `GET http://localhost:3000/api/v1/funnel/structure`
     - `GET http://localhost:3000/api/v1/funnel/progress`
   - What to do with the response:
     - build the stepper/sidebar from `structure`
     - use `currentStepUuid` from `progress`
   - UI to show: funnel layout with current-step placeholder/loading state.

7. Load the current step.
   - API to call: `GET http://localhost:3000/api/v1/funnel/step/{currentStepUuid}`
   - What to do with the response: branch the UI by `type`.
   - UI to show:
     - video/text player for `VIDEO_TEXT`
     - phone verification form for `PHONE_GATE`
     - payment screen for `PAYMENT_GATE`
     - decision screen for `DECISION`

8. Complete the introduction content step.
   - API to call:
     - `POST http://localhost:3000/api/v1/funnel/step/{stepUuid}/video-progress`
     - `POST http://localhost:3000/api/v1/funnel/step/{stepUuid}/complete`
   - What to do with the response:
     - after completion, refresh `GET /funnel/progress`
     - load the new `currentStepUuid`
   - UI to show: content step with continue button once the watch rule is satisfied.

9. Verify the phone.
   - API to call:
     - `POST http://localhost:3000/api/v1/phone/send-otp`
     - `POST http://localhost:3000/api/v1/phone/verify-otp`
   - What to do with the response:
     - use the returned `progress.currentStepUuid`
   - Backend side effect: the lead becomes `WARM`.
   - UI to show: OTP form, then a transition into the payment screen.

10. Optionally apply a coupon.
   - API to call: `POST http://localhost:3000/api/v1/coupons/validate`
   - What to do with the response: display original amount, discount, and final amount.
   - UI to show: coupon success or validation error inline.

11. Create the payment order and open Razorpay.
   - API to call: `POST http://localhost:3000/api/v1/payments/create-order`
   - What to do with the response:
     - if `freeAccess=true`, skip checkout and go straight to step 12
     - otherwise open Razorpay Checkout using the returned `orderId`, `keyId`, `amount`, and `currency`
   - UI to show: checkout overlay or "Confirming payment..." state.

12. Wait for payment confirmation.
   - API to call: `GET http://localhost:3000/api/v1/payments/status`
   - What to do with the response:
     - poll until `paymentCompleted=true`
     - then refresh `GET /funnel/progress`
     - then load `GET /funnel/step/{currentStepUuid}`
   - UI to show: spinner or confirmation banner while waiting.

13. Submit the final buying decision.
   - API to call: `POST http://localhost:3000/api/v1/funnel/decision`
   - Request example:

```json
{
  "stepUuid": "28f5bbf6-e31d-4666-aea0-abbaec9da521",
  "answer": "YES"
}
```

   - What to do with the response: show a thank-you / next-contact screen immediately.
   - Backend side effect: the existing lead is updated to `HOT`.
   - UI to show: success state such as "A guide will contact you shortly."

14. Optional NO branch.
   - If the user answers `NO` instead:
     - the backend updates the lead to `NURTURE`
     - the nurture sequence is scheduled
     - the first nurture email is due about 24 hours later
   - UI to show: a polite "keep learning" or "we will stay in touch" message.

## 4. Error Handling Guide

The backend uses a standardized error shape:

```json
{
  "statusCode": 400,
  "error": "BadRequestException",
  "message": "Invalid OTP",
  "timestamp": "2026-04-02T10:40:00.000Z",
  "path": "/api/v1/phone/verify-otp"
}
```

`message` can be either a string or an array of validation messages.

| Error case | Typical cause | Recommended frontend behavior |
| --- | --- | --- |
| `401 Unauthorized` | Missing or expired access token | Try `POST /auth/refresh` once with cookies enabled. If refresh fails, clear auth state and redirect to login. |
| `403 Forbidden` | Missing role, incomplete onboarding, payment prerequisite, suspended account | Show a contextual message. Redirect to profile completion when the message is `Please complete your profile first`. Show access denied for admin/CMS screens. |
| `400 Bad Request` | Validation error, locked step, invalid OTP, invalid country, invalid coupon, bad payment state | Show the exact message inline on the relevant form and keep the user on the same screen. |
| `404 Not Found` | Missing coupon, step, or resource | Show a not-found or retry message, then route back to a safe parent screen if needed. |
| `409 Conflict` | Email exists, phone already registered, payment already completed | Show a non-destructive explanatory banner and let the user continue from the correct state. |
| `429 Too Many Requests` | Auth throttles, tracking throttle, phone OTP send/verify limit | Disable the action temporarily, show a retry timer when practical, and do not hammer the endpoint. |
| Payment gateway failure | Razorpay checkout cancelled or failed | Keep the user on the payment step, surface the Razorpay failure reason, and allow another `create-order` attempt. |
| Payment confirmation timeout | Checkout reported success but `/payments/status` still says `paymentCompleted=false` | Show a "We are still confirming your payment" state, keep polling for a bounded window, then offer retry/support instructions. |

Additional implementation guidance:

- When `message` is an array, join it into a readable list in the UI.
- Preserve the current step screen on recoverable errors; do not reset the whole funnel.
- On locked-step errors, reload `GET /funnel/progress` and route the user to `currentStepUuid`.

## 5. Environment and Setup

### Base URL format

The backend boots with:

- global prefix: `/api`
- URI versioning: `/v1`
- default port: `3000`

Default local base URL:

```txt
http://localhost:3000/api/v1
```

Use the format:

```txt
http://<backend-host>:<port>/api/v1
```

### Authorization header

Use the access token returned by login or OTP verification:

```http
Authorization: Bearer <accessToken>
```

Example Axios client:

```ts
import axios from "axios";

export const api = axios.create({
  baseURL: "http://localhost:3000/api/v1",
  withCredentials: true
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### Refresh token handling (cookie based)

The refresh token is stored in an `HttpOnly` cookie named `refresh_token`.

Frontend requirements:

- `fetch`: use `credentials: "include"`
- Axios: use `withCredentials: true`

Refresh flow:

1. Protected API returns `401`.
2. Call `POST /auth/refresh` with cookies enabled.
3. Store the new `accessToken`.
4. Retry the original request.
5. If refresh fails, redirect to login.

Cookie behavior from code:

- Max age is 7 days by default.
- In HTTPS scenarios the backend sets `secure=true` and `sameSite=none`.
- In localhost-style development it falls back to `sameSite=lax`.

### Razorpay frontend SDK setup

Include Razorpay Checkout in the frontend page or app shell:

```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

Example integration pattern:

```ts
const order = await api.post("/payments/create-order", { couponCode: "WELCOME50" });

if (order.data.freeAccess) {
  await api.get("/payments/status");
  await api.get("/funnel/progress");
  return;
}

const options = {
  key: order.data.keyId,
  order_id: order.data.orderId,
  amount: order.data.amount,
  currency: order.data.currency,
  handler: async () => {
    // Current backend finalizes payment via webhook only.
    // Switch UI into confirmation mode and poll /payments/status.
  }
};

const razorpay = new window.Razorpay(options);
razorpay.open();
```

Important payment setup notes:

- The frontend should not call `/payments/webhook`.
- The backend currently expects the webhook to finalize payment.
- Amount fields are handled as raw integers in current backend code. Confirm whether your product wants to display them as rupees or minor units before going live.

### Development test credentials and mock behavior

The repository does not ship seeded demo email/password credentials.

What the frontend team can rely on in development:

| Item | Current behavior in code |
| --- | --- |
| Backend base URL | `http://localhost:3000/api/v1` by default |
| Email OTP in mock mail mode | Written to `D:\nsi-backend\test-otp.txt` |
| Phone OTP in mock phone mode | Always `123456` |
| Payment in mock mode | Auto-confirms after about 2 seconds |
| Refresh token | Cookie named `refresh_token` |
| Tracking cookie | Cookie named `nsi_acquisition` |

Relevant environment variables from the codebase:

| Variable | Purpose |
| --- | --- |
| `PORT` | Backend port, default `3000` |
| `FRONTEND_URL` | Used for CORS and Google OAuth redirect targets |
| `BACKEND_URL` | Used by the Google finalize redirect flow; defaults to `http://localhost:3000` if unset |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | Access-token signing and lifetime |
| `REFRESH_TOKEN_EXPIRES_IN` | Refresh session lifetime |
| `MAIL_PROVIDER` | `mock` or `resend` |
| `SMS_PROVIDER` | `mock` or `twilio` |
| `PAYMENT_PROVIDER` | `mock` or `razorpay` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` | Google OAuth setup |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Razorpay live integration |

### Final implementation notes

- Backend state is the source of truth for progression, locking, and lead status.
- After any state-changing action, refresh funnel state instead of guessing the next step.
- The current backend ends the practical user journey at the decision screen, even though it does not mark `funnel_progress.status=COMPLETED` there.
