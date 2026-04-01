# NSI Frontend Integration Guide: Post-Auth Funnel, Phone, Coupon, and Payment

This document is for frontend implementation after the authentication module is already done.

The next user flow is:

1. user logs in or completes signup
2. user completes profile if `needsCountry = true`
3. frontend loads funnel progress
4. user moves through funnel steps
5. on phone step, frontend sends and verifies OTP
6. on payment step, frontend can validate coupon
7. frontend creates payment order
8. frontend waits for payment success and moves user to the next funnel step

## Base API Setup

Base URL:

```txt
http://localhost:3000/api/v1
```

Important request rules:

- Send access token in `Authorization: Bearer <token>`
- Send requests with credentials enabled because refresh token is stored in `HttpOnly` cookie
- For `fetch`, use `credentials: "include"`
- For Axios, use `withCredentials: true`

Example:

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

## Standard Error Shape

All backend errors use this format:

```json
{
  "statusCode": 400,
  "error": "BadRequestException",
  "message": "Invalid OTP",
  "timestamp": "2026-03-28T12:00:00.000Z",
  "path": "/api/v1/phone/verify-otp"
}
```

Sometimes `message` can be a string array for validation errors.

## High-Level Frontend Flow

Recommended screen logic after auth:

1. Call `GET /funnel/progress`
2. If no progress exists yet, backend creates it automatically
3. Use `currentStepUuid` from progress
4. Call `GET /funnel/step/:stepUuid` to render the current step
5. If step type is:
   - `VIDEO_TEXT`: show video/text UI
   - `PHONE_GATE`: show phone verification UI
   - `PAYMENT_GATE`: show payment UI with coupon support
   - `DECISION`: show final decision UI

## Funnel Endpoints Needed by Frontend

### 1. Get funnel structure

`GET /funnel/structure`

Use this if frontend needs sidebar/progress UI or step ordering.

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

### 2. Get current funnel progress

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

Frontend should treat this as the main source of truth for where the user is.

### 3. Get current step data

`GET /funnel/step/:stepUuid`

Possible responses:

Video/text step:

```json
{
  "type": "VIDEO_TEXT",
  "content": {
    "title": "Welcome",
    "description": "Step description",
    "videoUrl": "https://...",
    "videoDuration": 120,
    "thumbnailUrl": "https://...",
    "textContent": "<p>HTML content</p>",
    "requireVideoCompletion": true
  }
}
```

Phone step:

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

Payment step:

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

Decision step:

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

## Phone Module Integration

Phone routes require:

- valid JWT
- profile already completed

### 1. Send phone OTP

`POST /phone/send-otp`

Body:

```json
{
  "phone": "+919876543210",
  "channel": "whatsapp"
}
```

`channel` can be:

- `whatsapp`
- `sms`

Response:

```json
{
  "message": "OTP sent successfully",
  "channel": "whatsapp"
}
```

Important backend rules:

- max 3 OTP send requests per hour per user
- phone is normalized to E.164 format
- if phone already belongs to another account, request fails
- if current user already verified phone, request fails

Common errors:

- `400`: invalid phone format
- `409`: phone already registered to another account
- `409`: phone already verified for this account
- `429`: too many OTP requests

### 2. Verify phone OTP

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

Important frontend behavior:

- after success, update local progress from response
- then load the new current step using `progress.currentStepUuid`
- do not keep user on phone step after success

Important backend rules:

- max 3 wrong OTP attempts before 1-hour lockout
- on success, backend also advances funnel progress automatically

Development note:

- in mock mode, OTP is `123456`

## Coupon Module Integration

Coupon validation is a preview only. It does **not** consume the coupon.

### Validate coupon before payment

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

Frontend usage:

- call this when user clicks `Apply Coupon`
- display original amount, discount, and final amount
- keep coupon code in local state
- pass the same coupon code later to `POST /payments/create-order`

Common errors:

- `404`: invalid coupon code
- `400`: coupon expired
- `400`: coupon usage limit reached
- `400`: coupon not valid for this payment type
- `400`: user already used this coupon

Important backend rule:

- backend calculates `originalAmount` from the user’s current payment step
- frontend should not trust its own amount calculation over backend response

## Payment Module Integration

Payment routes also require:

- valid JWT
- profile completed
- phone already verified
- user must currently be on a `PAYMENT_GATE` step

### 1. Create payment order

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

Possible success response A: paid gateway order needed

```json
{
  "orderId": "order_xxx",
  "amount": 24950,
  "currency": "INR",
  "keyId": "rzp_test_xxx"
}
```

Possible success response B: full discount / free access

```json
{
  "freeAccess": true
}
```

Important frontend behavior:

- if response contains `freeAccess: true`, do not open Razorpay
- immediately refresh:
  - `GET /payments/status`
  - `GET /funnel/progress`
- then route user to the next funnel step

Common errors:

- `403`: phone verification required before payment
- `403`: user has not reached payment step yet
- `400`: payment gate not configured
- `409`: payment already completed
- coupon-related `400` or `404` errors if coupon is invalid

### 2. Open Razorpay Checkout

When backend returns `orderId`, frontend should open Razorpay checkout using:

- `key`: `keyId`
- `amount`: `amount`
- `currency`: `currency`
- `order_id`: `orderId`

Important:

- backend does not expose a frontend verify-payment endpoint
- success is finalized by backend webhook
- frontend should not try to call `/payments/webhook`

### 3. Check payment status

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
    "createdAt": "2026-03-28T10:00:00.000Z"
  }
}
```

Frontend usage:

- after Razorpay success callback on frontend, start polling `GET /payments/status`
- also refresh `GET /funnel/progress`
- once `paymentCompleted` becomes `true`, redirect to the next funnel step

Recommended polling:

- every 2 seconds
- stop after 30 to 60 seconds
- show `Confirming your payment...`

Development note:

- in mock payment mode, backend auto-marks payment success after about 2 seconds

## Recommended Frontend State Machine

Suggested user flow:

1. `login/signup complete`
2. `load progress`
3. `render current step`
4. if phone step:
   - send OTP
   - verify OTP
   - load next step
5. if payment step:
   - optionally validate coupon
   - create order
   - if free access, refresh progress and continue
   - if order returned, open Razorpay
   - poll payment status until success
   - refresh progress and continue

## Practical UI Notes

- Disable submit buttons while requests are in flight
- Keep coupon input optional
- If coupon validation succeeds, show locked-in preview but still handle create-order failure because backend re-validates inside transaction
- If payment status is still pending, keep user on payment screen and show confirmation loader
- If backend says payment already completed, redirect user forward instead of showing error modal
- Always trust backend step/progress state more than local frontend assumptions

## Minimal Frontend API Wrapper Suggestions

Recommended methods:

```ts
getFunnelProgress()
getFunnelStep(stepUuid: string)
sendPhoneOtp(payload)
verifyPhoneOtp(payload)
validateCoupon(payload)
createPaymentOrder(payload)
getPaymentStatus()
```

## Notes for the Frontend Developer

- Authentication is only step one. All routes in this document need a valid access token.
- If backend returns `403 Please complete your profile first`, route the user back to profile completion.
- Phone verification and payment both advance funnel state on the backend.
- Coupon preview does not guarantee final success because backend validates again during payment creation.
- Webhook handling is backend-only. Frontend only creates the order and polls for final status.
