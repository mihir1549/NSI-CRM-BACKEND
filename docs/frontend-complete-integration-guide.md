# NSI Frontend Complete Integration Guide

This is the full frontend integration guide for the current backend.

It includes:

- public tracking API
- authentication flow
- profile completion
- user funnel APIs
- phone verification
- coupon and payment
- super admin coupon APIs
- super admin funnel CMS APIs
- super admin analytics APIs

Base API:

```txt
http://localhost:3000/api/v1
```

## Global Frontend Rules

- Send `Authorization: Bearer <accessToken>` on protected routes
- Send requests with cookies enabled because refresh token is stored in `HttpOnly` cookie
- Use `credentials: "include"` for `fetch`
- Use `withCredentials: true` for Axios
- Backend error shape is standardized

Axios example:

```ts
const api = axios.create({
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

Standard error shape:

```json
{
  "statusCode": 403,
  "error": "ForbiddenException",
  "message": "Insufficient permissions",
  "timestamp": "2026-03-30T12:00:00.000Z",
  "path": "/api/v1/admin/funnel/sections"
}
```

`message` can also be an array for validation failures.

## 1. Public Tracking Integration

Use this on landing pages before signup/login to capture UTM and acquisition info.

Endpoint:

`POST /tracking/capture`

Body:

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

Response:

```json
{
  "ok": true
}
```

Frontend note:

- call this once on landing page open or once per session
- backend stores data in `nsi_acquisition` cookie
- after email OTP verification, backend attaches this to the created/logged-in user

## 2. Auth Integration

Auth response shape returned by login and email OTP verification:

```json
{
  "accessToken": "jwt-token",
  "needsCountry": true,
  "user": {
    "uuid": "user-uuid",
    "fullName": "John Doe",
    "email": "john@example.com",
    "role": "USER",
    "status": "PROFILE_INCOMPLETE"
  }
}
```

Frontend should store:

- `accessToken`
- `user`
- `needsCountry`

Frontend should not try to read refresh token because it is in `HttpOnly` cookie.

### Signup

`POST /auth/signup`

Body:

```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "password": "StrongPassword123"
}
```

Response:

```json
{
  "message": "Registration successful. Check your email for OTP."
}
```

### Verify email OTP

`POST /auth/verify-email-otp`

Body:

```json
{
  "email": "john@example.com",
  "otp": "123456"
}
```

Response:

```json
{
  "accessToken": "jwt-token",
  "needsCountry": true,
  "user": {
    "uuid": "user-uuid",
    "fullName": "John Doe",
    "email": "john@example.com",
    "role": "USER",
    "status": "PROFILE_INCOMPLETE"
  }
}
```

### Complete profile

`POST /auth/complete-profile`

Protected: JWT required

Body:

```json
{
  "country": "IN"
}
```

Response:

```json
{
  "message": "Profile completed successfully."
}
```

Frontend note:

- if `needsCountry = true`, force user to complete this step
- protected routes are blocked until profile is complete

### Login

`POST /auth/login`

Body:

```json
{
  "email": "john@example.com",
  "password": "StrongPassword123"
}
```

Response is same as verify-email-otp.

### Resend OTP

`POST /auth/resend-otp`

Body:

```json
{
  "email": "john@example.com"
}
```

### Refresh access token

`POST /auth/refresh`

Response:

```json
{
  "accessToken": "new-jwt-token"
}
```

Frontend note:

- call this when access token expires
- requires refresh cookie to be present
- on refresh success, replace stored access token
- on refresh failure, logout locally and send user to login page

### Logout

`POST /auth/logout`

Response:

```json
{
  "message": "Logged out successfully."
}
```

Frontend note:

- clear local access token and user state
- backend clears refresh cookie

### Forgot password

`POST /auth/forgot-password`

Body:

```json
{
  "email": "john@example.com"
}
```

### Reset password

`POST /auth/reset-password`

Body:

```json
{
  "email": "john@example.com",
  "otp": "123456",
  "newPassword": "NewStrongPassword123"
}
```

### Google login

Frontend entry point:

- redirect user to `GET /auth/google`

Backend callback flow:

- backend redirects to Google
- Google returns to backend callback
- backend finalizes cookie on backend domain
- backend redirects frontend to:

```txt
/auth/callback?token=<accessToken>&needsCountry=<true|false>
```

Frontend note:

- read `token` and `needsCountry` from callback URL
- store access token
- then fetch or restore user state as your frontend design prefers

### Set password for Google users

`POST /auth/set-password`

Protected: JWT required

Body:

```json
{
  "newPassword": "StrongPassword123"
}
```

Use this only for Google users who do not already have a password.

## 3. Role-Based Frontend Routing

The backend returns `user.role`.

Possible values in schema:

- `USER`
- `CUSTOMER`
- `DISTRIBUTOR`
- `ADMIN`
- `SUPER_ADMIN`

Current admin APIs are protected with `SUPER_ADMIN`.

Frontend recommendation:

- show admin UI only when `user.role === "SUPER_ADMIN"`
- still handle backend `403` because backend checks fresh DB role, not only JWT role

## 4. User Funnel Integration

After auth and profile completion, frontend should use these routes.

Recommended flow:

1. call `GET /funnel/progress`
2. read `currentStepUuid`
3. call `GET /funnel/step/:stepUuid`
4. render the correct step UI
5. complete user actions
6. refresh progress and move forward

### Get structure

`GET /funnel/structure`

Response:

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

### Get progress

`GET /funnel/progress`

Response:

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

### Get one step

`GET /funnel/step/:stepUuid`

Possible response types:

- `VIDEO_TEXT`
- `PHONE_GATE`
- `PAYMENT_GATE`
- `DECISION`

For payment step, backend returns:

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

### Save video progress

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

### Complete step

`POST /funnel/step/:stepUuid/complete`

For video steps:

```json
{
  "watchedSeconds": 120
}
```

Response:

```json
{
  "ok": true
}
```

Frontend note:

- sequential order is enforced by backend
- if video completion is required, backend checks watched time

### Record decision

`POST /funnel/decision`

Body:

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

Response:

```json
{
  "ok": true
}
```

## 5. Phone Verification Integration

Protected: JWT + completed profile required

### Send OTP

`POST /phone/send-otp`

Body:

```json
{
  "phone": "+919876543210",
  "channel": "whatsapp"
}
```

Response:

```json
{
  "message": "OTP sent successfully",
  "channel": "whatsapp"
}
```

Rules:

- max 3 OTP sends per hour
- phone must be valid E.164
- phone cannot already belong to another user

### Verify OTP

`POST /phone/verify-otp`

Body:

```json
{
  "phone": "+919876543210",
  "code": "123456",
  "channel": "whatsapp"
}
```

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

Frontend note:

- backend advances funnel automatically after success
- immediately reload the next step using returned progress
- in mock mode, OTP is `123456`

## 6. Coupon Integration

Protected: JWT + completed profile required

### Validate coupon

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

Frontend note:

- this does not consume coupon usage
- backend validates again during payment creation

## 7. Payment Integration

Protected: JWT + completed profile + phone verified + current step must be payment gate

### Create order

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

Paid order response:

```json
{
  "orderId": "order_xxx",
  "amount": 24950,
  "currency": "INR",
  "keyId": "rzp_test_xxx"
}
```

Free access response:

```json
{
  "freeAccess": true
}
```

Frontend note:

- if `freeAccess` is true, do not open Razorpay
- immediately refresh payment status and funnel progress

### Payment status

`GET /payments/status`

Before success:

```json
{
  "paymentCompleted": false,
  "payment": null
}
```

After success:

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
    "createdAt": "2026-03-30T10:00:00.000Z"
  }
}
```

Frontend payment flow:

1. call create order
2. if order returned, open Razorpay checkout using `keyId`, `orderId`, `amount`, `currency`
3. after frontend Razorpay success event, poll `GET /payments/status`
4. also refresh `GET /funnel/progress`
5. when `paymentCompleted = true`, move user to next step

Important:

- webhook is backend-only
- frontend must not call `/payments/webhook`
- in mock mode, backend auto-marks payment success after about 2 seconds

## 8. Super Admin Coupon APIs

Protected: JWT + `SUPER_ADMIN`

Base path:

`/admin/coupons`

### Create coupon

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

Enums:

- `type`: `FLAT`, `PERCENT`, `FREE`
- `applicableTo`: `COMMITMENT_FEE`, `LMS_COURSE`, `DISTRIBUTOR_SUB`, `ALL`

### List coupons

`GET /admin/coupons`

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
    "createdAt": "2026-03-30T08:00:00.000Z",
    "updatedAt": "2026-03-30T08:00:00.000Z",
    "_count": {
      "uses": 12
    }
  }
]
```

### Get coupon detail

`GET /admin/coupons/:uuid`

Response includes coupon plus `uses` array with user data.

### Update coupon

`PATCH /admin/coupons/:uuid`

Body example:

```json
{
  "isActive": false,
  "usageLimit": 200,
  "expiresAt": "2027-01-31T23:59:59.000Z"
}
```

### Delete coupon

`DELETE /admin/coupons/:uuid`

This is soft delete behavior. Backend sets `isActive = false`.

## 9. Super Admin Funnel CMS APIs

Protected: JWT + `SUPER_ADMIN`

Base path:

`/admin/funnel`

### Section APIs

Create:

`POST /admin/funnel/sections`

```json
{
  "name": "Section 1",
  "description": "Intro content",
  "order": 1
}
```

List:

`GET /admin/funnel/sections`

Response returns sections with nested steps and nested configs:

- `content`
- `phoneGate`
- `paymentGate`
- `decisionStep`

Reorder:

`PATCH /admin/funnel/sections/reorder`

```json
[
  { "uuid": "section-1", "order": 1 },
  { "uuid": "section-2", "order": 2 }
]
```

Update:

`PATCH /admin/funnel/sections/:uuid`

```json
{
  "name": "Updated Section",
  "description": "Updated description",
  "order": 1,
  "isActive": true
}
```

Delete:

`DELETE /admin/funnel/sections/:uuid`

Frontend note:

- backend blocks delete if users are currently on that section

### Step APIs

Create:

`POST /admin/funnel/steps`

```json
{
  "sectionUuid": "section-uuid",
  "type": "PAYMENT_GATE",
  "order": 2
}
```

Enums:

- `VIDEO_TEXT`
- `PHONE_GATE`
- `PAYMENT_GATE`
- `DECISION`

Backend creates default content/config automatically based on step type.

Get one step:

`GET /admin/funnel/steps/:uuid`

Reorder steps:

`PATCH /admin/funnel/steps/reorder`

```json
[
  { "uuid": "step-1", "order": 1 },
  { "uuid": "step-2", "order": 2 }
]
```

Update step:

`PATCH /admin/funnel/steps/:uuid`

```json
{
  "order": 2,
  "isActive": true
}
```

Delete step:

`DELETE /admin/funnel/steps/:uuid`

Frontend note:

- backend blocks delete if users are currently on that step

### Video/Text content config

`PUT /admin/funnel/steps/:uuid/content`

Only valid for `VIDEO_TEXT` steps.

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

### Phone gate config

`PUT /admin/funnel/steps/:uuid/phone-gate`

Only valid for `PHONE_GATE` steps.

```json
{
  "title": "Verify your phone number",
  "subtitle": "Enter OTP sent to WhatsApp",
  "isActive": true
}
```

### Payment gate config

`PUT /admin/funnel/steps/:uuid/payment-gate`

Only valid for `PAYMENT_GATE` steps.

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

- `amount` is required in this DTO

### Decision step config

`PUT /admin/funnel/steps/:uuid/decision`

Only valid for `DECISION` steps.

```json
{
  "question": "Are you interested in buying a Kangen machine?",
  "yesLabel": "Yes, I am interested!",
  "noLabel": "Not right now",
  "yesSubtext": "Talk to a guide",
  "noSubtext": "Maybe later"
}
```

### Funnel validation

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

Current warning codes from backend:

- `PAYMENT_BEFORE_PHONE`
- `MULTIPLE_PAYMENT_GATES`
- `MULTIPLE_PHONE_GATES`
- `NO_DECISION_STEP`
- `DECISION_NOT_LAST`
- `EMPTY_SECTION`

## 10. Super Admin Analytics APIs

Protected: JWT + `SUPER_ADMIN`

Base path:

`/admin/analytics`

### Funnel analytics

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

### UTM analytics

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

### Device analytics

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

### Conversion analytics

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

## 11. Suggested Frontend Modules

Recommended API client methods:

```ts
captureTracking(data)

signup(data)
verifyEmailOtp(data)
completeProfile(data)
login(data)
resendOtp(data)
refreshToken()
logout()
forgotPassword(data)
resetPassword(data)
setPassword(data)

getFunnelStructure()
getFunnelProgress()
getFunnelStep(stepUuid)
saveVideoProgress(stepUuid, data)
completeFunnelStep(stepUuid, data)
recordDecision(data)

sendPhoneOtp(data)
verifyPhoneOtp(data)

validateCoupon(data)
createPaymentOrder(data)
getPaymentStatus()

adminListCoupons()
adminCreateCoupon(data)
adminGetCoupon(uuid)
adminUpdateCoupon(uuid, data)
adminDeleteCoupon(uuid)

adminGetSections()
adminCreateSection(data)
adminReorderSections(data)
adminUpdateSection(uuid, data)
adminDeleteSection(uuid)

adminCreateStep(data)
adminGetStep(uuid)
adminReorderSteps(data)
adminUpdateStep(uuid, data)
adminDeleteStep(uuid)
adminUpsertContent(stepUuid, data)
adminUpsertPhoneGate(stepUuid, data)
adminUpsertPaymentGate(stepUuid, data)
adminUpsertDecision(stepUuid, data)
adminValidateFunnel()

adminGetFunnelAnalytics()
adminGetUtmAnalytics()
adminGetDeviceAnalytics()
adminGetConversionAnalytics()
```

## 12. Important Implementation Notes

- Backend is the source of truth for progress, payment, and permissions.
- `SUPER_ADMIN` frontend gating is helpful, but backend still re-checks DB role.
- If backend returns `403 Please complete your profile first`, send user back to profile completion.
- Coupon validation is preview only. Final validation happens again during order creation.
- Payment success is finalized by webhook, not by frontend callback alone.
- In development mock mode:
  - phone OTP is `123456`
  - payment success is auto-processed after about 2 seconds
