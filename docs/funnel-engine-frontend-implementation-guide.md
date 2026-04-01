# Funnel Engine Frontend Implementation Guide

This document is a project-specific frontend implementation guide for the funnel engine already present in this backend.

It is based on the current code in:

- `src/funnel/*`
- `src/funnel-cms/*`
- `src/payment/*`
- `src/phone/*`
- `src/coupon/*`
- `src/auth/*`
- `src/tracking/*`
- `prisma/schema.prisma`

This repository is backend-only, so the frontend code below is a recommended implementation pattern for React, Next.js, or any SPA with a similar architecture.

## 1. What Exists In This Backend

The backend already exposes two separate funnel surfaces:

### Normal user funnel runtime

These routes are for authenticated end users progressing through the funnel:

- `GET /api/v1/funnel/structure`
- `GET /api/v1/funnel/progress`
- `GET /api/v1/funnel/step/:stepUuid`
- `POST /api/v1/funnel/step/:stepUuid/video-progress`
- `POST /api/v1/funnel/step/:stepUuid/complete`
- `POST /api/v1/funnel/decision`

Supporting user routes used during funnel progression:

- `POST /api/v1/phone/send-otp`
- `POST /api/v1/phone/verify-otp`
- `POST /api/v1/coupons/validate`
- `POST /api/v1/payments/create-order`
- `GET /api/v1/payments/status`

### Superadmin funnel CMS + analytics

These routes are only for `SUPER_ADMIN`:

- `POST /api/v1/admin/funnel/sections`
- `GET /api/v1/admin/funnel/sections`
- `PATCH /api/v1/admin/funnel/sections/reorder`
- `PATCH /api/v1/admin/funnel/sections/:uuid`
- `DELETE /api/v1/admin/funnel/sections/:uuid`
- `POST /api/v1/admin/funnel/steps`
- `GET /api/v1/admin/funnel/steps/:uuid`
- `PATCH /api/v1/admin/funnel/steps/reorder`
- `PATCH /api/v1/admin/funnel/steps/:uuid`
- `DELETE /api/v1/admin/funnel/steps/:uuid`
- `PUT /api/v1/admin/funnel/steps/:uuid/content`
- `PUT /api/v1/admin/funnel/steps/:uuid/phone-gate`
- `PUT /api/v1/admin/funnel/steps/:uuid/payment-gate`
- `PUT /api/v1/admin/funnel/steps/:uuid/decision`
- `GET /api/v1/admin/funnel/validate`
- `GET /api/v1/admin/analytics/funnel`
- `GET /api/v1/admin/analytics/utm`
- `GET /api/v1/admin/analytics/devices`
- `GET /api/v1/admin/analytics/conversions`

## 2. Critical Backend Rules The Frontend Must Respect

These are the most important things discovered from the backend code:

1. Backend is the only source of truth for funnel progression.
2. User cannot jump directly to a future step. `GET /funnel/step/:stepUuid` and `POST /complete` enforce sequence.
3. `OnboardingGuard` blocks protected routes until profile completion is done.
4. `RolesGuard` always re-fetches the user from DB, so frontend role checks are only UI hints.
5. Phone verification advances the funnel automatically on the backend.
6. Payment success also advances the funnel automatically on the backend.
7. The frontend should never compute the next step locally and force navigation without reloading progress from backend.
8. Coupon validation is only a preview. Actual coupon use is revalidated during payment order creation.
9. Payment success is finalized by webhook or mock webhook, not by frontend alone.
10. Tracking is public and should be called before signup/login on landing pages.

## 3. Recommended Frontend Architecture

If you are building this in React or Next.js, use this split:

### Public area

- landing pages
- tracking capture
- signup/login/OTP/password flows

### Authenticated user app

- dashboard shell
- funnel player
- phone verification modal/page
- payment screen
- decision screen

### Superadmin app

- funnel builder
- section/step editor
- validation warnings
- analytics dashboard

## 4. Recommended Frontend Folder Structure

```txt
src/
  api/
    client.ts
    auth.api.ts
    tracking.api.ts
    funnel.api.ts
    phone.api.ts
    coupon.api.ts
    payment.api.ts
    admin-funnel.api.ts
    admin-analytics.api.ts
  features/
    auth/
      auth.store.ts
      auth.guard.tsx
      onboarding.guard.tsx
    funnel/
      funnel.types.ts
      funnel.store.ts
      useFunnelBootstrap.ts
      useCurrentStep.ts
      components/
        FunnelLayout.tsx
        StepRenderer.tsx
        VideoTextStep.tsx
        PhoneGateStep.tsx
        PaymentGateStep.tsx
        DecisionStep.tsx
    admin/
      funnel-builder/
        builder.store.ts
        SectionList.tsx
        StepList.tsx
        StepEditorDrawer.tsx
        ValidationPanel.tsx
      analytics/
        FunnelAnalytics.tsx
        UTMAnalytics.tsx
        DeviceAnalytics.tsx
        ConversionAnalytics.tsx
  pages/
    auth/
    funnel/
    admin/
```

## 5. Shared API Client

Use one shared client with:

- `baseURL = /api/v1`
- `withCredentials = true`
- `Authorization: Bearer <accessToken>`
- refresh-token retry on `401`

Example:

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

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = await api.post("/auth/refresh");
      localStorage.setItem("accessToken", refresh.data.accessToken);
      original.headers.Authorization = `Bearer ${refresh.data.accessToken}`;
      return api(original);
    }
    throw error;
  },
);
```

## 6. Shared Types

Use a shared type layer on frontend.

```ts
export type UserRole =
  | "USER"
  | "CUSTOMER"
  | "DISTRIBUTOR"
  | "ADMIN"
  | "SUPER_ADMIN";

export type StepType =
  | "VIDEO_TEXT"
  | "PHONE_GATE"
  | "PAYMENT_GATE"
  | "DECISION";

export type FunnelProgressStatus =
  | "IN_PROGRESS"
  | "COMPLETED"
  | "DROPPED";

export interface FunnelProgress {
  currentSectionUuid: string | null;
  currentStepUuid: string | null;
  status: FunnelProgressStatus;
  phoneVerified: boolean;
  paymentCompleted: boolean;
  decisionAnswer: "YES" | "NO" | null;
  completedStepUuids: string[];
}

export interface FunnelStructure {
  sections: Array<{
    uuid: string;
    name: string;
    description: string | null;
    order: number;
    steps: Array<{
      uuid: string;
      type: StepType;
      order: number;
      isActive: boolean;
      title: string;
    }>;
  }>;
}
```

## 7. Normal User Implementation

## 7.1 Auth + onboarding flow

Before entering the funnel:

1. `POST /auth/signup`
2. `POST /auth/verify-email-otp`
3. if `needsCountry === true`, show profile completion
4. `POST /auth/complete-profile`
5. start funnel bootstrap

At login:

1. `POST /auth/login`
2. if `needsCountry === true`, redirect to profile completion
3. otherwise load funnel

### Frontend rule

If any protected funnel call returns:

- `403` with message like `Please complete your profile first`

redirect user to profile completion page.

## 7.2 Funnel bootstrap flow

On funnel page load:

1. call `GET /funnel/structure`
2. call `GET /funnel/progress`
3. if `progress.currentStepUuid` is null and `status === "COMPLETED"`, show completion page
4. else call `GET /funnel/step/:currentStepUuid`
5. render by `type`

Recommended hook:

```ts
export async function bootstrapFunnel() {
  const [structureRes, progressRes] = await Promise.all([
    api.get("/funnel/structure"),
    api.get("/funnel/progress"),
  ]);

  const structure = structureRes.data;
  const progress = progressRes.data;

  const step =
    progress.currentStepUuid
      ? (await api.get(`/funnel/step/${progress.currentStepUuid}`)).data
      : null;

  return { structure, progress, step };
}
```

## 7.3 Step renderer

Render the step from backend response instead of by guessed order.

```tsx
export function StepRenderer({ step }: { step: any }) {
  switch (step.type) {
    case "VIDEO_TEXT":
      return <VideoTextStep data={step.content} />;
    case "PHONE_GATE":
      return <PhoneGateStep data={step.phoneGate} />;
    case "PAYMENT_GATE":
      return <PaymentGateStep data={step.paymentGate} />;
    case "DECISION":
      return <DecisionStep data={step.decisionStep} />;
    default:
      return <div>Unsupported step</div>;
  }
}
```

## 7.4 VIDEO_TEXT step implementation

### APIs used

- `GET /funnel/step/:stepUuid`
- `POST /funnel/step/:stepUuid/video-progress`
- `POST /funnel/step/:stepUuid/complete`

### Backend behavior

- step may require full video completion
- backend checks `watchedSeconds >= videoDuration - 3`
- user cannot complete future steps directly

### Frontend implementation

1. load `content`
2. render title, description, video, HTML text
3. periodically send `video-progress`
4. on continue, call `complete`
5. after success, reload `progress`
6. load next step from returned progress state

Example:

```ts
export async function saveVideoProgress(stepUuid: string, watchedSeconds: number) {
  return api.post(`/funnel/step/${stepUuid}/video-progress`, { watchedSeconds });
}

export async function completeVideoStep(stepUuid: string, watchedSeconds: number) {
  await api.post(`/funnel/step/${stepUuid}/complete`, { watchedSeconds });
  return api.get("/funnel/progress");
}
```

UI notes:

- throttle progress saves to every 5 to 10 seconds
- flush progress on pause, ended, and before page unload
- sanitize or safely render `textContent` because backend stores HTML

## 7.5 PHONE_GATE step implementation

### APIs used

- `GET /funnel/step/:stepUuid`
- `POST /phone/send-otp`
- `POST /phone/verify-otp`

### Request shapes

Send OTP:

```json
{
  "phone": "+919876543210",
  "channel": "whatsapp"
}
```

Verify OTP:

```json
{
  "phone": "+919876543210",
  "code": "123456",
  "channel": "whatsapp"
}
```

### Backend behavior

- profile must already be completed
- phone is normalized to E.164
- max 3 send attempts per hour
- max 3 wrong OTP attempts before lockout
- on success backend marks current phone step as completed
- on success backend advances `currentStepUuid`

### Frontend implementation

1. show phone form
2. select `whatsapp` or `sms`
3. call `send-otp`
4. show OTP input
5. call `verify-otp`
6. use returned `progress.currentStepUuid`
7. fetch next step and navigate

Important:

- do not call `POST /funnel/step/:stepUuid/complete` for phone flow after OTP verification
- backend already completes and advances the step

Example:

```ts
export async function verifyPhoneOtp(payload: {
  phone: string;
  code: string;
  channel: "whatsapp" | "sms";
}) {
  const res = await api.post("/phone/verify-otp", payload);
  return res.data.progress;
}
```

## 7.6 PAYMENT_GATE step implementation

### APIs used

- `GET /funnel/step/:stepUuid`
- `POST /coupons/validate`
- `POST /payments/create-order`
- `GET /payments/status`
- `GET /funnel/progress`

### Backend behavior

- user must already be phone verified
- current step must be payment gate
- coupon validation is preview only
- `create-order` may return either paid order or `{ freeAccess: true }`
- on successful payment, backend marks payment step completed and moves to next step
- frontend should poll for confirmation instead of assuming success immediately

### Coupon preview request

```json
{
  "code": "WELCOME50",
  "paymentType": "COMMITMENT_FEE"
}
```

### Create order request

```json
{
  "couponCode": "WELCOME50"
}
```

### Paid order response

```json
{
  "orderId": "order_xxx",
  "amount": 24950,
  "currency": "INR",
  "keyId": "rzp_test_xxx"
}
```

### Free access response

```json
{
  "freeAccess": true
}
```

### Frontend implementation

1. render title/subtitle/amount from payment step
2. optional coupon input
3. call `POST /coupons/validate` for preview
4. call `POST /payments/create-order`
5. if `freeAccess`, reload payment status and funnel progress
6. if order returned, open Razorpay checkout
7. after Razorpay success callback, poll `GET /payments/status`
8. once `paymentCompleted === true`, reload `GET /funnel/progress`
9. fetch next step

Important:

- frontend must never call `/payments/webhook`
- frontend must not call `complete` for payment step after a successful payment
- backend already completes the payment step when payment is confirmed

Example flow:

```ts
export async function startPayment(couponCode?: string) {
  const create = await api.post("/payments/create-order", couponCode ? { couponCode } : {});

  if (create.data.freeAccess) {
    const [paymentStatus, progress] = await Promise.all([
      api.get("/payments/status"),
      api.get("/funnel/progress"),
    ]);
    return { mode: "free", paymentStatus: paymentStatus.data, progress: progress.data };
  }

  return { mode: "gateway", order: create.data };
}
```

Recommended polling:

- every 2 seconds
- max 60 seconds
- stop early when `paymentCompleted === true`

## 7.7 DECISION step implementation

### API used

- `POST /funnel/decision`

### Request

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

### Backend behavior

- only valid for a `DECISION` step
- backend stores decision in funnel progress
- backend marks step as completed
- `YES` and `NO` branch into lead/nurture operations on backend

### Frontend implementation

1. render question, labels, optional subtext
2. submit answer
3. reload progress
4. if completed, show final completion/thank-you state

## 7.8 User journey state machine

Use this mental model in frontend state management:

```txt
AUTHENTICATED
  -> PROFILE_REQUIRED
  -> FUNNEL_LOADING
  -> VIDEO_STEP
  -> PHONE_STEP
  -> PAYMENT_STEP
  -> DECISION_STEP
  -> FUNNEL_COMPLETED
```

Recommended store:

```ts
type FunnelUiState =
  | { kind: "loading" }
  | { kind: "profile-required" }
  | { kind: "step"; stepType: StepType; progress: FunnelProgress; step: any }
  | { kind: "completed"; progress: FunnelProgress }
  | { kind: "error"; message: string };
```

## 8. Superadmin Implementation

The superadmin frontend should be treated as two products:

1. funnel CMS builder
2. funnel analytics dashboard

## 8.1 Access control

Frontend should show superadmin pages only when:

```ts
user?.role === "SUPER_ADMIN"
```

But still handle backend `403` because backend fetches fresh role from DB.

## 8.2 Superadmin page map

Recommended pages:

- `/admin/funnel`
- `/admin/funnel/sections/:sectionUuid`
- `/admin/funnel/steps/:stepUuid`
- `/admin/funnel/validate`
- `/admin/analytics`

## 8.3 CMS screen design

Recommended layout:

### Left column

- ordered section list
- section create button
- drag/drop reorder

### Middle column

- selected section steps
- create step button
- step reorder
- enable/disable toggles

### Right panel

- step config editor
- content editor based on step type
- validation warnings

## 8.4 Section APIs and implementation

### List sections

- `GET /api/v1/admin/funnel/sections`

This returns full nested structure including:

- `steps`
- `content`
- `phoneGate`
- `paymentGate`
- `decisionStep`

Use this as the builder bootstrap response.

### Create section

- `POST /api/v1/admin/funnel/sections`

```json
{
  "name": "Section 1",
  "description": "Intro content",
  "order": 1
}
```

### Update section

- `PATCH /api/v1/admin/funnel/sections/:uuid`

```json
{
  "name": "Updated Section",
  "description": "Updated description",
  "order": 1,
  "isActive": true
}
```

### Reorder sections

- `PATCH /api/v1/admin/funnel/sections/reorder`

```json
[
  { "uuid": "section-1", "order": 1 },
  { "uuid": "section-2", "order": 2 }
]
```

### Delete section

- `DELETE /api/v1/admin/funnel/sections/:uuid`

Important frontend behavior:

- show destructive confirmation
- handle backend block if active users are currently in that section
- after any write, refetch `GET /admin/funnel/sections`

## 8.5 Step APIs and implementation

### Create step

- `POST /api/v1/admin/funnel/steps`

```json
{
  "sectionUuid": "section-uuid",
  "type": "PAYMENT_GATE",
  "order": 2
}
```

Allowed `type` values:

- `VIDEO_TEXT`
- `PHONE_GATE`
- `PAYMENT_GATE`
- `DECISION`

Backend automatically creates default config for the selected type.

### Get step

- `GET /api/v1/admin/funnel/steps/:uuid`

### Update step

- `PATCH /api/v1/admin/funnel/steps/:uuid`

```json
{
  "order": 2,
  "isActive": true
}
```

### Reorder steps

- `PATCH /api/v1/admin/funnel/steps/reorder`

```json
[
  { "uuid": "step-1", "order": 1 },
  { "uuid": "step-2", "order": 2 }
]
```

### Delete step

- `DELETE /api/v1/admin/funnel/steps/:uuid`

Important frontend behavior:

- block delete button while request is running
- handle backend error when users are currently on the step
- refetch nested sections after mutation

## 8.6 Type-specific editor implementation

Build one editor component per step type.

### VIDEO_TEXT editor

API:

- `PUT /api/v1/admin/funnel/steps/:uuid/content`

Payload:

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

Suggested form fields:

- title
- description
- video URL
- video duration in seconds
- thumbnail URL
- rich text or HTML content
- require video completion toggle

### PHONE_GATE editor

API:

- `PUT /api/v1/admin/funnel/steps/:uuid/phone-gate`

Payload:

```json
{
  "title": "Verify your phone number",
  "subtitle": "Enter OTP sent to WhatsApp",
  "isActive": true
}
```

Suggested form fields:

- title
- subtitle
- is active

### PAYMENT_GATE editor

API:

- `PUT /api/v1/admin/funnel/steps/:uuid/payment-gate`

Payload:

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
- store/display amount in the same unit the backend expects
- backend currently returns amount directly as configured, so frontend should not silently convert unless your product clearly defines paise vs rupees everywhere

Suggested form fields:

- title
- subtitle
- amount
- currency
- allow coupons
- is active

### DECISION editor

API:

- `PUT /api/v1/admin/funnel/steps/:uuid/decision`

Payload:

```json
{
  "question": "Are you interested in buying a Kangen machine?",
  "yesLabel": "Yes, I am interested!",
  "noLabel": "Not right now",
  "yesSubtext": "Talk to a guide",
  "noSubtext": "Maybe later"
}
```

Suggested form fields:

- question
- yes label
- yes subtext
- no label
- no subtext

## 8.7 Funnel validation implementation

API:

- `GET /api/v1/admin/funnel/validate`

Show warnings in a persistent side panel after:

- initial builder load
- any section or step mutation
- any type-config update

Known backend warning codes:

- `PAYMENT_BEFORE_PHONE`
- `MULTIPLE_PAYMENT_GATES`
- `MULTIPLE_PHONE_GATES`
- `NO_DECISION_STEP`
- `DECISION_NOT_LAST`
- `EMPTY_SECTION`

Suggested UI:

- yellow warning cards
- code label
- readable message
- optional jump-to-step button

## 8.8 Analytics implementation

### Funnel analytics

- `GET /api/v1/admin/analytics/funnel`

Use for:

- step completion chart
- drop-off table
- funnel conversion bars

### UTM analytics

- `GET /api/v1/admin/analytics/utm`

Use for:

- source breakdown
- medium breakdown
- campaign breakdown
- distributor attribution

### Device analytics

- `GET /api/v1/admin/analytics/devices`

Use for:

- device pie chart
- country table

### Conversion analytics

- `GET /api/v1/admin/analytics/conversions`

Use for:

- topline KPI cards
- phone verification rate
- payment rate
- decision rate
- yes rate

Recommended analytics dashboard layout:

1. KPI cards at top
2. funnel conversion chart
3. drop-off by step table
4. traffic attribution charts
5. device/country charts

## 9. Tracking Integration On Public Landing Pages

Before signup or login, call:

- `POST /api/v1/tracking/capture`

Payload:

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

Implementation rule:

- capture once per session or once per first page load
- backend stores this in cookie and attaches it after email OTP verification

## 10. Recommended API Layer

```ts
export const trackingApi = {
  capture: (payload: any) => api.post("/tracking/capture", payload),
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
  sendOtp: (payload: { phone: string; channel?: "whatsapp" | "sms" }) =>
    api.post("/phone/send-otp", payload),
  verifyOtp: (payload: { phone: string; code: string; channel: "whatsapp" | "sms" }) =>
    api.post("/phone/verify-otp", payload),
};

export const couponApi = {
  validate: (payload: { code: string; paymentType: "COMMITMENT_FEE" }) =>
    api.post("/coupons/validate", payload),
};

export const paymentApi = {
  createOrder: (payload?: { couponCode?: string }) =>
    api.post("/payments/create-order", payload ?? {}),
  getStatus: () => api.get("/payments/status"),
};

export const adminFunnelApi = {
  getSections: () => api.get("/admin/funnel/sections"),
  createSection: (payload: any) => api.post("/admin/funnel/sections", payload),
  updateSection: (uuid: string, payload: any) => api.patch(`/admin/funnel/sections/${uuid}`, payload),
  reorderSections: (payload: Array<{ uuid: string; order: number }>) =>
    api.patch("/admin/funnel/sections/reorder", payload),
  deleteSection: (uuid: string) => api.delete(`/admin/funnel/sections/${uuid}`),
  createStep: (payload: any) => api.post("/admin/funnel/steps", payload),
  getStep: (uuid: string) => api.get(`/admin/funnel/steps/${uuid}`),
  updateStep: (uuid: string, payload: any) => api.patch(`/admin/funnel/steps/${uuid}`, payload),
  reorderSteps: (payload: Array<{ uuid: string; order: number }>) =>
    api.patch("/admin/funnel/steps/reorder", payload),
  deleteStep: (uuid: string) => api.delete(`/admin/funnel/steps/${uuid}`),
  upsertContent: (uuid: string, payload: any) => api.put(`/admin/funnel/steps/${uuid}/content`, payload),
  upsertPhoneGate: (uuid: string, payload: any) => api.put(`/admin/funnel/steps/${uuid}/phone-gate`, payload),
  upsertPaymentGate: (uuid: string, payload: any) =>
    api.put(`/admin/funnel/steps/${uuid}/payment-gate`, payload),
  upsertDecision: (uuid: string, payload: any) => api.put(`/admin/funnel/steps/${uuid}/decision`, payload),
  validate: () => api.get("/admin/funnel/validate"),
};

export const adminAnalyticsApi = {
  funnel: () => api.get("/admin/analytics/funnel"),
  utm: () => api.get("/admin/analytics/utm"),
  devices: () => api.get("/admin/analytics/devices"),
  conversions: () => api.get("/admin/analytics/conversions"),
};
```

## 11. Page-Level Implementation Plan

If you want to build this frontend cleanly, implement in this order:

1. shared API client with refresh-token retry
2. auth store and onboarding redirect
3. public tracking capture
4. user funnel bootstrap page
5. `VIDEO_TEXT` component
6. `PHONE_GATE` component
7. `PAYMENT_GATE` component with coupon + polling
8. `DECISION` component
9. funnel completion page
10. superadmin funnel builder
11. superadmin validation panel
12. superadmin analytics dashboard

## 12. Common Mistakes To Avoid

1. Do not let frontend infer next step without reloading progress.
2. Do not call payment webhook from frontend.
3. Do not call `completeStep` after successful phone verification.
4. Do not call `completeStep` after payment success.
5. Do not trust `user.role` or JWT role alone for admin access.
6. Do not assume coupon preview guarantees final order success.
7. Do not allow protected routes when `needsCountry` is still true.
8. Do not use local-only step order as source of truth after CMS edits.

## 13. Final Recommended Product Split

### For normal user frontend

Build:

- auth pages
- profile completion page
- funnel runner page
- reusable step renderer
- phone verification flow
- payment flow with polling
- decision page
- completion page

Use these APIs:

- `/auth/*`
- `/tracking/capture`
- `/funnel/*`
- `/phone/*`
- `/coupons/validate`
- `/payments/*`

### For superadmin frontend

Build:

- funnel builder page
- section manager
- step manager
- type-specific step editors
- validation warnings panel
- analytics dashboard

Use these APIs:

- `/admin/funnel/*`
- `/admin/analytics/*`
- `/admin/coupons/*` if coupon management is part of admin UI

## 14. Summary

This backend already contains a full funnel engine. The frontend does not need to invent funnel logic. It mainly needs to:

1. authenticate correctly
2. respect onboarding guard
3. bootstrap from backend progress
4. render the current step by type
5. hand off phone and payment to their dedicated APIs
6. refetch progress after each state-changing action
7. keep superadmin CMS separate from normal user runtime

If you follow this structure, the frontend will stay aligned with the current backend implementation and will remain stable even when funnel sections or steps are edited by superadmins.
