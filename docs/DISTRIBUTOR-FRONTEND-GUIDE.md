# Module 6 - Distributor Frontend Guide v1.3

Verified against backend source on 2026-04-07.

## Base URL

`/api/v1`

All routes require `Authorization: Bearer <accessToken>` unless marked public.

## Module Overview

A distributor is a user whose role becomes `DISTRIBUTOR` after distributor subscription activation.

The distributor module currently supports:

- subscription creation
- active plan lookup for authenticated users
- subscription status lookup
- distributor join-link lookup
- distributor dashboard stats
- distributor lead management through the shared leads module
- distributor referred-user analytics
- distributor referred-user list and detail views
- distributor task management
- distributor calendar events and personal notes
- distributor in-app notifications
- distributor UTM analytics
- admin plan management
- admin subscription management
- admin distributor link activation and deactivation
- referral-code attribution during signup

## Verified Endpoint Map

| Area | Method | Path | Auth | Notes |
| --- | --- | --- | --- | --- |
| Public | `GET` | `/api/v1/distributor/join/:code` | Public | Validates a distributor code and returns distributor identity info if the link is active. |
| Public | `POST` | `/api/v1/distributor/webhook` | Public | Handles distributor subscription webhooks. |
| Distributor self-service | `GET` | `/api/v1/distributor/plans` | Any authenticated user | Returns active plans only. |
| Distributor self-service | `POST` | `/api/v1/distributor/subscribe` | Any authenticated user | Starts distributor subscription flow. |
| Distributor self-service | `GET` | `/api/v1/distributor/subscription` | `DISTRIBUTOR` | Returns current distributor subscription state. |
| Distributor self-service | `GET` | `/api/v1/distributor/join-link` | `DISTRIBUTOR` | Returns current share link and QR code. |
| Distributor self-service | `GET` | `/api/v1/distributor/dashboard` | `DISTRIBUTOR` | Returns lead metrics, subscription, and join-link state. |
| Distributor shared leads | `GET` | `/api/v1/leads` | `DISTRIBUTOR` | Lists only this distributor's scoped leads. |
| Distributor shared leads | `GET` | `/api/v1/leads/:uuid` | `DISTRIBUTOR` | Returns one scoped lead detail with funnel progress and activity. |
| Distributor shared leads | `PATCH` | `/api/v1/leads/:uuid/status` | `DISTRIBUTOR` | Updates lead status using the standard leads module rules. |
| Distributor shared leads | `GET` | `/api/v1/leads/followups/today` | `DISTRIBUTOR` | Returns today's follow-up leads for this distributor. |
| Distributor shared leads | `GET` | `/api/v1/leads/transitions/:status` | `DISTRIBUTOR` | Returns allowed next lead statuses for dropdowns. |
| Distributor self-service | `GET` | `/api/v1/distributor/analytics/utm` | `DISTRIBUTOR` | Returns UTM attribution aggregates. |
| Distributor users | `GET` | `/api/v1/distributor/users/analytics` | `DISTRIBUTOR` | Returns referred-user summary stats for this distributor only. |
| Distributor users | `GET` | `/api/v1/distributor/users` | `DISTRIBUTOR` | Returns paginated referred users with search and funnel-stage filters. |
| Distributor users | `GET` | `/api/v1/distributor/users/:uuid` | `DISTRIBUTOR` | Returns one referred user detail if it belongs to this distributor. |
| Distributor productivity | `GET` | `/api/v1/distributor/tasks` | `DISTRIBUTOR` | Returns tasks grouped by Kanban status. |
| Distributor productivity | `POST` | `/api/v1/distributor/tasks` | `DISTRIBUTOR` | Creates a new distributor task. |
| Distributor productivity | `PATCH` | `/api/v1/distributor/tasks/:uuid` | `DISTRIBUTOR` | Updates task title, due date, or linked lead. |
| Distributor productivity | `PATCH` | `/api/v1/distributor/tasks/:uuid/move` | `DISTRIBUTOR` | Moves a task between columns or reorders it in-column. |
| Distributor productivity | `DELETE` | `/api/v1/distributor/tasks/:uuid` | `DISTRIBUTOR` | Deletes a task. |
| Distributor productivity | `GET` | `/api/v1/distributor/calendar` | `DISTRIBUTOR` | Returns follow-up and personal-note events for a selected month. |
| Distributor productivity | `POST` | `/api/v1/distributor/calendar/notes` | `DISTRIBUTOR` | Upserts one personal note for a date. |
| Distributor productivity | `DELETE` | `/api/v1/distributor/calendar/notes/:uuid` | `DISTRIBUTOR` | Deletes a saved personal note. |
| Distributor productivity | `GET` | `/api/v1/distributor/notifications` | `DISTRIBUTOR` | Returns upcoming task and follow-up notification data. |
| Admin | `POST` | `/api/v1/admin/distributor-plans` | `SUPER_ADMIN` | Creates a distributor plan. |
| Admin | `GET` | `/api/v1/admin/distributor-plans` | `SUPER_ADMIN` | Lists all plans, including inactive ones. |
| Admin | `PATCH` | `/api/v1/admin/distributor-plans/:uuid/deactivate` | `SUPER_ADMIN` | Deactivates a plan. |
| Admin | `GET` | `/api/v1/admin/distributor-subscriptions` | `SUPER_ADMIN` | Lists subscriptions with filters. |
| Admin | `GET` | `/api/v1/admin/distributor-subscriptions/:uuid` | `SUPER_ADMIN` | Returns one subscription. |
| Admin | `POST` | `/api/v1/admin/distributor-subscriptions/:uuid/cancel` | `SUPER_ADMIN` | Cancels a subscription immediately. |
| Admin | `GET` | `/api/v1/admin/distributors` | `SUPER_ADMIN` | Lists distributors. |
| Admin | `GET` | `/api/v1/admin/distributors/:uuid` | `SUPER_ADMIN` | Returns distributor detail. |
| Admin | `PATCH` | `/api/v1/admin/distributors/:uuid/deactivate-link` | `SUPER_ADMIN` | Deactivates a distributor join link. |
| Admin | `PATCH` | `/api/v1/admin/distributors/:uuid/activate-link` | `SUPER_ADMIN` | Reactivates a distributor join link. |
| Auth dependency | `POST` | `/api/v1/auth/signup` | Public | Supports optional `referralCode`. |
| Auth dependency | `GET` | `/api/v1/auth/me` | Authenticated | Useful after subscription to refresh frontend state. |

## Referral Flow

Frontend join page flow:

1. User lands on a frontend URL like `/join/NSI-AB12CD`.
2. Frontend calls `GET /api/v1/distributor/join/NSI-AB12CD`.
3. If valid, keep the code in state and pass it as `referralCode` during signup.
4. If invalid or inactive, continue to normal signup without blocking the user.

Signup request example:

```json
{
  "fullName": "Priya Patel",
  "email": "priya@example.com",
  "password": "SecurePass123",
  "referralCode": "NSI-AB12CD"
}
```

Join-validation success example:

```json
{
  "distributorUuid": "ac292c52-abae-41c8-9c5d-8e6d90c9bbc1",
  "fullName": "Nageshwar Shukla",
  "code": "NSI-AB12CD",
  "isActive": true
}
```

Frontend rule:

- Invalid or inactive referral codes do not break signup. The backend ignores unusable codes silently.

Important implementation note for Mihir:

The user NEVER manually types the referral code. The flow is:

1. Distributor shares their link, for example via WhatsApp.
2. New user clicks the link and lands on `growithnsi.com/join/NSI-AB12CD`.
3. Frontend extracts the code from the URL automatically using route params.
4. Frontend silently calls `GET /api/v1/distributor/join/NSI-AB12CD` with no user input.
5. If valid, show the signup page with referral banner `You were referred by [Distributor Name]`.
6. On signup submit, inject `referralCode` invisibly in the request body.
7. The user only fills in name, email, and password. They never see or type the code.

Code example:

```javascript
// On page /join/:code - extract from URL automatically
const { code } = useParams();

// Validate silently - no user input needed
const res = await api.get(`/distributor/join/${code}`);

if (res.isActive) {
  setReferralCode(code); // store in state
  setReferredBy(res.fullName); // show in banner
}

// On signup submit - inject invisibly
await api.post('/auth/signup', {
  fullName,
  email,
  password,
  referralCode // from URL params, never typed by user
});
```

## Subscribe Flow

### Step 1 - Fetch Available Plans

Call:

- `GET /api/v1/distributor/plans`

This endpoint is available to any authenticated user. It returns active plans only and does not expose internal Razorpay plan IDs.

Response:

```json
[
  {
    "uuid": "plan-uuid-here",
    "name": "Standard Distributor Plan",
    "amount": 999,
    "interval": "monthly",
    "createdAt": "2026-04-06T00:00:00Z"
  }
]
```

### Step 2 - Create Subscription

Call:

- `POST /api/v1/distributor/subscribe`

Request:

```json
{
  "planUuid": "plan-uuid-here"
}
```

Response in mock mode:

```json
{
  "subscriptionId": "mock_sub_abc123",
  "shortUrl": null
}
```

Response in Razorpay mode:

```json
{
  "subscriptionId": "sub_PQR789xyz",
  "shortUrl": "https://rzp.io/l/abc123"
}
```

Frontend behavior:

- If `shortUrl` exists, open Razorpay checkout.
- If `shortUrl` is `null`, the backend is likely in mock mode and activates the subscription asynchronously.
- After subscribe succeeds, refresh frontend user state with `GET /api/v1/auth/me`.

### Re-subscribe behavior

On re-subscribe, if the user already has a distributor code assigned, the backend keeps it. A new code is only generated if the user has no code. Do not assume a fresh code is always created.

## Subscription Status

Call:

- `GET /api/v1/distributor/subscription`

Real-world statuses emitted by the backend:

| Status | Meaning | Suggested badge color | Suggested UI message |
| --- | --- | --- | --- |
| `ACTIVE` | Subscription is active. | Green | Your distributor subscription is active. |
| `HALTED` | Payment issue occurred and the record is in the recovery window. | Amber | Payment issue detected. Resolve it before the grace deadline to keep distributor access. |
| `CANCELLED` | Subscription was cancelled. | Red | Subscription cancelled. Access ends based on backend state and grace deadline handling. |
| `EXPIRED` | Subscription has fully expired and access is no longer active. | Gray | Subscription expired. Subscribe again to regain distributor access. |
| `NONE` | No subscription record exists. | Slate | No distributor subscription record exists for this user. |

`GRACE` exists in the enum but is not emitted by the current backend logic. Do not show it in status badges, filters, or status help text.

Example:

```json
{
  "status": "ACTIVE",
  "currentPeriodEnd": "2026-05-06T00:00:00Z",
  "graceDeadline": null,
  "plan": {
    "name": "Standard Distributor Plan",
    "amount": 999
  }
}
```

## Join Link

Call:

- `GET /api/v1/distributor/join-link`

Example:

```json
{
  "code": "NSI-AB12CD",
  "url": "https://growithnsi.com/join/NSI-AB12CD",
  "qrCode": "data:image/png;base64,...",
  "isActive": true
}
```

Frontend rules:

- Render `qrCode` directly in an `<img>` because it already arrives as a data URL.
- If `isActive` is `false`, keep showing the code and URL but disable copy and share actions.
- If the link is inactive, show a support message like `Your join link has been deactivated. Contact admin to reactivate.`

## Dashboard

Call:

- `GET /api/v1/distributor/dashboard`

The dashboard exposes:

- `totalLeads`
- `hotLeads`
- `contactedLeads`
- `customers`
- `conversionRate`
- `subscription`
- `joinLink`

Example:

```json
{
  "totalLeads": 24,
  "hotLeads": 6,
  "contactedLeads": 4,
  "customers": 3,
  "conversionRate": "12.50%",
  "subscription": {
    "status": "ACTIVE",
    "currentPeriodEnd": "2026-05-06T00:00:00Z",
    "graceDeadline": null,
    "plan": {
      "name": "Standard Distributor Plan",
      "amount": 999
    }
  },
  "joinLink": {
    "url": "https://growithnsi.com/join/NSI-AB12CD",
    "isActive": true
  }
}
```

Notes:

- `dashboard.subscription` can be `null`, so the frontend must null-check it.
- There is no earnings field in this response.
- The dashboard join-link object does not include QR code. Use the join-link endpoint for QR rendering.

## Lead Management

### Overview

Distributor lead management is identical to Super Admin lead management, but scoped to the distributor's own leads only. The backend automatically filters all lead responses to show only leads where `Lead.distributorUuid = current distributor's uuid`.

Distributors use the existing leads endpoints. There are no separate distributor-specific lead endpoints.

### Lead Management Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/leads` | `DISTRIBUTOR` | List my leads (paginated, filtered, searchable). |
| `GET` | `/api/v1/leads/:uuid` | `DISTRIBUTOR` | Lead detail with full funnel progress and activity. |
| `PATCH` | `/api/v1/leads/:uuid/status` | `DISTRIBUTOR` | Update lead status. |
| `GET` | `/api/v1/leads/followups/today` | `DISTRIBUTOR` | Today's follow-up leads. |
| `GET` | `/api/v1/leads/transitions/:status` | `DISTRIBUTOR` | Get allowed next statuses for a given status. |

### How Leads Are Created

Leads are created automatically. The distributor never creates them manually.

When a new user signs up via the distributor's join link:

1. User visits `growithnsi.com/join/NSI-AB12CD`.
2. User signs up with `referralCode` in the signup body.
3. Backend automatically creates a `Lead` record with:
- `Lead.distributorUuid = this distributor's uuid`
- `Lead.assignedToUuid = this distributor's uuid`
- `Lead.status = NEW`

### Complete Lead Lifecycle

```text
Signup           -> NEW      (automatic - system controlled)
Phone verified   -> WARM     (automatic - system controlled)
Decision YES     -> HOT      (automatic - system controlled)
Decision NO      -> NURTURE  (automatic - nurture emails start)

After HOT (distributor takes manual action):
HOT -> CONTACTED
HOT -> FOLLOWUP
HOT -> MARK_AS_CUSTOMER
HOT -> LOST

CONTACTED -> FOLLOWUP
CONTACTED -> MARK_AS_CUSTOMER
CONTACTED -> LOST

FOLLOWUP -> CONTACTED
FOLLOWUP -> MARK_AS_CUSTOMER
FOLLOWUP -> LOST

NURTURE -> (system controlled, cannot manually change)
LOST -> (terminal, cannot change)
MARK_AS_CUSTOMER -> (terminal, cannot change)
```

Important: `NEW`, `WARM`, and `NURTURE` are system-controlled. The distributor cannot manually move a lead to or from these statuses. The backend rejects those attempts.

### Status Display Mapping

| Backend Status | Display Label | Badge Color |
| --- | --- | --- |
| `NEW` | `New` | Slate |
| `WARM` | `Warm` | Yellow |
| `HOT` | `Hot` | Amber |
| `CONTACTED` | `Contacted` | Blue |
| `FOLLOWUP` | `Follow Up` | Orange |
| `NURTURE` | `Nurture` | Purple |
| `LOST` | `Lost` | Gray |
| `MARK_AS_CUSTOMER` | `Customer` | Green |

### GET /api/v1/leads

Query params:

- `status` filters by status, for example `HOT`, `CONTACTED`, `FOLLOWUP`
- `search` searches by name, email, or phone
- `page` defaults to `1`
- `limit` defaults to `20`

Response shape:

```json
{
  "items": [
    {
      "uuid": "lead-uuid",
      "status": "HOT",
      "displayStatus": "Hot",
      "isSystemControlled": false,
      "availableActions": ["CONTACTED", "FOLLOWUP", "MARK_AS_CUSTOMER", "LOST"],
      "phone": "+91...",
      "createdAt": "2026-04-01T00:00:00Z",
      "user": {
        "uuid": "user-uuid",
        "fullName": "Priya Patel",
        "email": "priya@example.com",
        "country": "IN",
        "avatarUrl": "https://..."
      },
      "assignedTo": { "uuid": "...", "fullName": "Distributor Name" },
      "distributor": { "uuid": "...", "fullName": "Distributor Name" }
    }
  ],
  "total": 24,
  "page": 1,
  "limit": 20,
  "totalPages": 2
}
```

Key fields:

- `availableActions` is already computed by the backend. Use it directly to build the action dropdown.
- `isSystemControlled` disables status-change actions when true.
- `displayStatus` is already mapped for UI display.

### GET /api/v1/leads/:uuid

Response shape:

```json
{
  "uuid": "lead-uuid",
  "status": "HOT",
  "displayStatus": "Hot",
  "isSystemControlled": false,
  "availableActions": ["CONTACTED", "FOLLOWUP", "MARK_AS_CUSTOMER", "LOST"],
  "phone": "+91...",
  "createdAt": "2026-04-01T00:00:00Z",
  "user": {
    "uuid": "user-uuid",
    "fullName": "Priya Patel",
    "email": "priya@example.com",
    "country": "IN",
    "avatarUrl": "https://..."
  },
  "funnelProgress": {
    "phoneVerified": true,
    "paymentCompleted": true,
    "decisionAnswer": "yes",
    "completedSteps": 4,
    "totalSteps": 6,
    "currentStepUuid": "..."
  },
  "activities": [
    {
      "uuid": "activity-uuid",
      "action": "STATUS_CHANGED",
      "fromStatus": "HOT",
      "toStatus": "CONTACTED",
      "notes": "Called and discussed pricing",
      "followupAt": null,
      "actorUuid": "...",
      "createdAt": "2026-04-03T00:00:00Z"
    }
  ],
  "nurtureEnrollment": {
    "currentDay": 3,
    "completedAt": null
  }
}
```

Notes:

- `nurtureEnrollment` is `null` unless the lead is in `NURTURE` status.
- `activities` is the full history of status changes and notes, ordered newest first.
- `funnelProgress` includes `totalSteps`, so the frontend can render `4 of 6 steps` style progress text.

### PATCH /api/v1/leads/:uuid/status

Request body for a normal status change:

```json
{
  "status": "CONTACTED",
  "notes": "Called and discussed the opportunity"
}
```

Request body when setting `FOLLOWUP` status. `notes` and `followupAt` are both required:

```json
{
  "status": "FOLLOWUP",
  "notes": "Needs more time to decide",
  "followupAt": "2026-04-15T10:00:00Z"
}
```

Error responses:

- `400`: `Cannot transition from WARM to LOST` for invalid transition attempts.
- `400`: `Notes are required for FOLLOWUP status` when notes are missing.
- `400`: `Follow-up date is required for FOLLOWUP status` when `followupAt` is missing.
- `400`: `Follow-up date must be in the future` when a past date is provided.

Important rules:

- `notes` is optional for all statuses except `FOLLOWUP`.
- `followupAt` is only required for `FOLLOWUP`.
- `followupAt` must always be a future date.
- Always call `GET /api/v1/leads/transitions/:status` first to get allowed actions dynamically.

### GET /api/v1/leads/transitions/:status

Use this to build dynamic action dropdowns.

Example:

- `GET /api/v1/leads/transitions/HOT`

Response:

```json
{
  "currentStatus": "HOT",
  "allowedTransitions": ["CONTACTED", "FOLLOWUP", "MARK_AS_CUSTOMER", "LOST"]
}
```

Full transition rules:

- `NEW -> []` (system only)
- `WARM -> []` (system only)
- `HOT -> CONTACTED, FOLLOWUP, MARK_AS_CUSTOMER, LOST`
- `CONTACTED -> FOLLOWUP, MARK_AS_CUSTOMER, LOST`
- `FOLLOWUP -> CONTACTED, MARK_AS_CUSTOMER, LOST`
- `NURTURE -> []` (system only)
- `LOST -> []` (terminal)
- `MARK_AS_CUSTOMER -> []` (terminal)

### GET /api/v1/leads/followups/today

Returns all leads where the `followupAt` date is today. Use this to build a daily follow-up list.

Response: same shape as the lead list response, filtered to today's follow-ups only.

### Nurture Sequence

When a lead says `NO` on the decision step:

1. Lead status automatically becomes `NURTURE`.
2. Backend starts a 3-email sequence:
- Day 1 email: sent immediately
- Day 3 email: sent 3 days after decision
- Day 7 email: sent 7 days after decision
3. After Day 7, the lead automatically becomes `LOST`.
4. Distributor cannot manually change a `NURTURE` lead's status.
5. Distributor can see nurture progress via `nurtureEnrollment.currentDay` in lead detail.

UI for `NURTURE` leads:

- Show `Nurture - Day X of 7` using `nurtureEnrollment.currentDay`.
- Disable all action buttons when `isSystemControlled = true`.
- Show message: `This lead is in an automated nurture email sequence. No manual actions available.`

### Lead Management Rules for Frontend

1. Always use `availableActions` from the lead response to build action dropdowns. Never hardcode them.
2. If `isSystemControlled` is `true`, disable all status-change actions.
3. `FOLLOWUP` requires both `notes` and `followupAt`, so show both fields when `FOLLOWUP` is selected.
4. `followupAt` must be a future datetime. Validate this on the frontend before submitting.
5. After a status change, refresh lead detail to get updated `availableActions`.
6. Leads are scoped automatically. The backend never returns leads from other distributors.
7. `MARK_AS_CUSTOMER` and `LOST` are terminal. Once set, no further actions are available.
8. The nurture sequence runs fully automatically. Distributors only observe it and never control it.

## Distributor Users Workspace

### Security rule

Distributor user management is fully scoped to the current distributor's own referred users.

- The backend only exposes users where `Lead.distributorUuid = current distributor uuid`.
- If a requested `userUuid` does not belong to this distributor's leads, the backend returns `404 User not found`.
- The API never reveals whether the user exists for another distributor.

### Users analytics

Call:

- `GET /api/v1/distributor/users/analytics`

Response example:

```json
{
  "totalUsers": 24,
  "paidUsers": 14,
  "freeUsers": 10,
  "hotLeads": 6,
  "customers": 3,
  "conversionRate": "12.50%",
  "funnelDropOff": {
    "registered": 24,
    "phoneVerified": 20,
    "paymentCompleted": 16,
    "saidYes": 10,
    "saidNo": 6
  }
}
```

What it means:

- `totalUsers` counts all leads attributed to this distributor.
- `paidUsers` counts referred users with at least one successful payment.
- `freeUsers` is `totalUsers - paidUsers`.
- `hotLeads` and `customers` are lead-status counts for this distributor's pipeline.
- `conversionRate` is `(customers / totalUsers).toFixed(2) + "%"`.
- `funnelDropOff` summarizes the referred users' funnel progress.

### List referred users

Call:

- `GET /api/v1/distributor/users`

Supported query params:

- `search` optional string
- `funnelStage` optional value: `REGISTERED`, `PHONE_VERIFIED`, `PAYMENT_COMPLETED`, `SAID_YES`, `SAID_NO`
- `page` optional integer, default `1`
- `limit` optional integer, default `20`, max `100`

Response example:

```json
{
  "items": [
    {
      "uuid": "user-uuid",
      "fullName": "Priya Patel",
      "email": "priya@example.com",
      "phone": "+91...",
      "country": "IN",
      "avatarUrl": "https://...",
      "role": "USER",
      "status": "ACTIVE",
      "createdAt": "2026-04-01T00:00:00Z",
      "leadStatus": "HOT",
      "displayLeadStatus": "Hot",
      "paymentStatus": "Paid",
      "funnelStage": "PAYMENT_COMPLETED",
      "funnelStageLabel": "Payment Completed",
      "funnelProgress": {
        "completedSteps": 4,
        "totalSteps": 6,
        "phoneVerified": true,
        "paymentCompleted": true,
        "decisionAnswer": "yes"
      }
    }
  ],
  "total": 24,
  "page": 1,
  "limit": 20,
  "totalPages": 2
}
```

Frontend mapping rules:

- `paymentStatus` is `Paid` if the user has at least one successful payment, otherwise `Free`.
- `funnelStage` is computed by the backend from funnel progress data.
- `funnelStageLabel` is already frontend-friendly.
- `displayLeadStatus` is already mapped for UI display.
- `phone` can be `null`.
- `country` can be `null`.

Funnel stage labels currently returned:

| funnelStage | funnelStageLabel |
| --- | --- |
| `REGISTERED` | `Registered` |
| `PHONE_VERIFIED` | `Phone Verified` |
| `PAYMENT_COMPLETED` | `Payment Completed` |
| `SAID_YES` | `Said YES` |
| `SAID_NO` | `Said NO` |

Lead status labels currently returned:

| leadStatus | displayLeadStatus |
| --- | --- |
| `NEW` | `New` |
| `WARM` | `Warm` |
| `HOT` | `Hot` |
| `CONTACTED` | `Contacted` |
| `FOLLOWUP` | `Follow Up` |
| `NURTURE` | `Nurture` |
| `LOST` | `Lost` |
| `MARK_AS_CUSTOMER` | `Customer` |

### User detail

Call:

- `GET /api/v1/distributor/users/:uuid`

Security behavior:

- The backend first checks that this `userUuid` belongs to a lead owned by the current distributor.
- If not, the response is `404 User not found`.

Response example:

```json
{
  "uuid": "user-uuid",
  "fullName": "Priya Patel",
  "email": "priya@example.com",
  "phone": "+91...",
  "country": "IN",
  "avatarUrl": "https://...",
  "role": "USER",
  "status": "ACTIVE",
  "createdAt": "2026-04-01T00:00:00Z",
  "lead": {
    "uuid": "lead-uuid",
    "status": "HOT",
    "displayStatus": "Hot",
    "availableActions": ["CONTACTED", "FOLLOWUP", "MARK_AS_CUSTOMER", "LOST"],
    "nurtureEnrollment": {
      "currentDay": 3,
      "completedAt": null
    }
  },
  "funnelProgress": {
    "completedSteps": 4,
    "totalSteps": 6,
    "phoneVerified": true,
    "paymentCompleted": true,
    "decisionAnswer": "yes",
    "decisionAnsweredAt": "2026-04-02T00:00:00Z",
    "stepProgress": [
      {
        "stepUuid": "step-uuid",
        "stepTitle": "Introduction Video",
        "stepType": "VIDEO",
        "isCompleted": true,
        "completedAt": "2026-04-01T00:00:00Z",
        "watchedSeconds": 245
      }
    ]
  },
  "paymentHistory": [
    {
      "uuid": "payment-uuid",
      "amount": 4999,
      "finalAmount": 4999,
      "status": "SUCCESS",
      "paymentType": "COMMITMENT_FEE",
      "createdAt": "2026-04-02T00:00:00Z"
    }
  ],
  "lmsProgress": [
    {
      "courseUuid": "course-uuid",
      "courseTitle": "Kangen Business Basics",
      "enrolledAt": "2026-04-03T00:00:00Z",
      "completedAt": null,
      "certificateUrl": null,
      "completedLessons": 4,
      "totalLessons": 10
    }
  ],
  "activityLog": [
    {
      "uuid": "activity-uuid",
      "action": "STATUS_CHANGED",
      "fromStatus": "HOT",
      "toStatus": "CONTACTED",
      "notes": "Called and discussed business opportunity",
      "followupAt": null,
      "actorName": "Nageshwar Shukla",
      "createdAt": "2026-04-03T00:00:00Z"
    }
  ]
}
```

Frontend detail rules:

- `lead.availableActions` is already computed by the backend. Use it directly to show allowed next actions.
- `lead.nurtureEnrollment` can be `null`.
- `funnelProgress` can be `null`.
- `paymentHistory` is ordered newest first.
- `activityLog` is lead activity only. It is not the platform audit log.
- `lmsProgress` already includes `completedLessons` and `totalLessons`, so the frontend can render progress without extra calculation.

## UTM Analytics

Call:

- `GET /api/v1/distributor/analytics/utm`

Query params:

- `from` optional ISO date
- `to` optional ISO date

Example:

```json
{
  "bySource": [
    { "source": "instagram", "leads": 12 },
    { "source": "direct", "leads": 7 }
  ],
  "byMedium": [
    { "medium": "social", "leads": 12 },
    { "medium": "direct", "leads": 7 }
  ],
  "byCampaign": [
    { "campaign": "summer2026", "leads": 5 },
    { "campaign": "direct", "leads": 14 }
  ],
  "total": 19,
  "from": "2026-03-07T00:00:00.000Z",
  "to": "2026-04-06T23:59:59.999Z"
}
```

UI note:

- Show `direct` as `Direct / No UTM` for clarity.

## Admin Plan Management

### Create plan

- `POST /api/v1/admin/distributor-plans`

Request:

```json
{
  "name": "Standard Distributor Plan",
  "amount": 999
}
```

### List plans

- `GET /api/v1/admin/distributor-plans`

### Deactivate plan

- `PATCH /api/v1/admin/distributor-plans/:uuid/deactivate`

Response:

```json
{
  "message": "Plan deactivated successfully"
}
```

## Admin Subscription Management

### List subscriptions

- `GET /api/v1/admin/distributor-subscriptions`

Supported query params:

- `status`
- `page`
- `limit`

### Get one subscription

- `GET /api/v1/admin/distributor-subscriptions/:uuid`

### Cancel subscription

- `POST /api/v1/admin/distributor-subscriptions/:uuid/cancel`

Current service response:

```json
{
  "message": "Subscription cancelled successfully",
  "leadsReassigned": 3
}
```

This action is immediate. It:

- marks the subscription as `CANCELLED`
- downgrades the user to `CUSTOMER`
- disables the join link
- reassigns HOT leads to the earliest `SUPER_ADMIN`

## Admin - Distributor Link Management

These endpoints manage distributor join link activation directly from the admin panel, separate from subscription management.

Endpoints:

- `GET  /api/v1/admin/distributors` - List all distributors (paginated)
- `GET  /api/v1/admin/distributors/:uuid` - Distributor detail
- `PATCH /api/v1/admin/distributors/:uuid/deactivate-link` - Deactivate join link
- `PATCH /api/v1/admin/distributors/:uuid/activate-link` - Activate join link

Note: These endpoints are already covered in the existing Module 7 (Admin APIs) documentation. They are listed here for completeness since they affect distributor join link state.

## Role Restrictions

The admin role-change API does not allow assigning `DISTRIBUTOR`.

Allowed assignable roles are:

- `USER`
- `CUSTOMER`
- `ADMIN`

If the frontend still shows `DISTRIBUTOR` in the admin role dropdown, remove it.

## Pages To Build Checklist

The API routes in this table are shown relative to `/api/v1`.

| Frontend page | API calls | Notes |
| --- | --- | --- |
| `/join/:code` (public) | `GET /distributor/join/:code` | Validate the distributor code before signup and keep the code in client state. |
| `/signup` | `POST /auth/signup` | Pass `referralCode` when the user came from a distributor join flow. |
| `/subscribe` (plan selection) | `GET /distributor/plans` + `POST /distributor/subscribe` | Load active plans, then create the subscription for the selected plan. |
| `/distributor/dashboard` | `GET /distributor/dashboard` | Show lead counts, subscription, and join-link state only. |
| `/distributor/join-link` | `GET /distributor/join-link` | Render code, URL, QR code, and join-link active state. |
| `/distributor/subscription` | `GET /distributor/subscription` | Build UI around real backend statuses only. |
| `/distributor/users` | `GET /distributor/users/analytics` + `GET /distributor/users` | Build summary cards, search, funnel-stage filters, and pagination. |
| `/distributor/users/:uuid` | `GET /distributor/users/:uuid` | Build secure referred-user detail. Handle `404 User not found` as a generic missing page. |
| `/distributor/analytics` | `GET /distributor/analytics/utm` | Support optional `from` and `to` filters. |
| `/distributor/tasks` | `GET /distributor/tasks` + `POST /distributor/tasks` + `PATCH /distributor/tasks/:uuid` + `PATCH /distributor/tasks/:uuid/move` + `DELETE /distributor/tasks/:uuid` | Kanban with drag and drop. |
| `/distributor/calendar` | `GET /distributor/calendar` + `POST /distributor/calendar/notes` + `DELETE /distributor/calendar/notes/:uuid` | Show `FOLLOWUP` and `PERSONAL_NOTE` events. |
| `/distributor/notifications` | `GET /distributor/notifications` | Poll every 5 min and show `unreadCount` as the badge. |
| `/admin/distributor-plans` | `GET /admin/distributor-plans` + `POST /admin/distributor-plans` + `PATCH /admin/distributor-plans/:uuid/deactivate` | Admin-only plan management. |
| `/admin/distributor-subscriptions` | `GET /admin/distributor-subscriptions` + `GET /admin/distributor-subscriptions/:uuid` + `POST /admin/distributor-subscriptions/:uuid/cancel` | Admin subscription review and cancellation. |
| `/admin/distributors` | `GET /admin/distributors` + `GET /admin/distributors/:uuid` + `PATCH /admin/distributors/:uuid/deactivate-link` + `PATCH /admin/distributors/:uuid/activate-link` | Admin join-link control. |

## Task Management (Kanban Board)

### Overview

Distributors can manage personal tasks on a Kanban board with three columns: `TODO`, `IN_PROGRESS`, `COMPLETE`. Tasks can optionally be linked to a specific lead.

### Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/distributor/tasks` | `DISTRIBUTOR` | Get all tasks grouped by status. |
| `POST` | `/api/v1/distributor/tasks` | `DISTRIBUTOR` | Create a new task. |
| `PATCH` | `/api/v1/distributor/tasks/:uuid` | `DISTRIBUTOR` | Update task title, dueDate, or leadUuid. |
| `PATCH` | `/api/v1/distributor/tasks/:uuid/move` | `DISTRIBUTOR` | Move task to a different column or reorder it. |
| `DELETE` | `/api/v1/distributor/tasks/:uuid` | `DISTRIBUTOR` | Delete a task. |

### GET /api/v1/distributor/tasks

Response:

```json
{
  "TODO": [
    {
      "uuid": "task-uuid",
      "title": "Follow up with Priya",
      "status": "TODO",
      "order": 0,
      "dueDate": "2026-04-10T00:00:00Z",
      "lead": {
        "uuid": "lead-uuid",
        "userFullName": "Priya Patel",
        "userAvatarUrl": "https://...",
        "status": "HOT"
      },
      "createdAt": "2026-04-07T00:00:00Z"
    }
  ],
  "IN_PROGRESS": [],
  "COMPLETE": []
}
```

Notes:

- `lead` is `null` if no lead is linked.
- Within each column, tasks are ordered by `order ASC` and then `createdAt ASC`.

### POST /api/v1/distributor/tasks

Request:

```json
{
  "title": "Follow up with Priya",
  "leadUuid": "lead-uuid",
  "dueDate": "2026-04-10T00:00:00Z"
}
```

Rules:

- `leadUuid` is optional.
- `dueDate` is optional.
- If `leadUuid` is provided, it must belong to this distributor's leads or the backend returns `400`.

### PATCH /api/v1/distributor/tasks/:uuid

Request:

```json
{
  "title": "Updated title",
  "dueDate": "2026-04-15T00:00:00Z",
  "leadUuid": "lead-uuid"
}
```

Only the provided fields are updated.

### PATCH /api/v1/distributor/tasks/:uuid/move

Request:

```json
{
  "status": "IN_PROGRESS",
  "order": 2
}
```

Call this endpoint when the user drags a card to a different column or reorders it within the same column.

### DELETE /api/v1/distributor/tasks/:uuid

Response:

```json
{
  "message": "Task deleted successfully"
}
```

## Calendar

### Overview

The calendar page shows two event types for the selected month:

1. `FOLLOWUP` events pulled automatically from lead follow-up dates.
2. `PERSONAL_NOTE` events added manually by the distributor.

### Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/distributor/calendar` | `DISTRIBUTOR` | Get all events for a month. |
| `POST` | `/api/v1/distributor/calendar/notes` | `DISTRIBUTOR` | Add or update a personal note on a date. |
| `DELETE` | `/api/v1/distributor/calendar/notes/:uuid` | `DISTRIBUTOR` | Delete a personal note. |

### GET /api/v1/distributor/calendar

Query params:

- `year` required integer, for example `2026`
- `month` required integer from `1` to `12`

Example:

- `GET /api/v1/distributor/calendar?year=2026&month=4`

Response:

```json
{
  "year": 2026,
  "month": 4,
  "events": [
    {
      "date": "2026-04-10",
      "type": "FOLLOWUP",
      "title": "Follow up with Priya Patel",
      "leadUuid": "lead-uuid",
      "leadStatus": "CONTACTED",
      "notes": "Discussed the business, needs more info",
      "time": "10:30:00"
    },
    {
      "date": "2026-04-10",
      "type": "PERSONAL_NOTE",
      "noteUuid": "note-uuid",
      "title": "Team meeting preparation",
      "notes": "Prepare slides for distributor meeting"
    }
  ]
}
```

Event details:

- `FOLLOWUP` events are generated from the leads module. Clicking one should navigate to the lead detail page.
- `PERSONAL_NOTE` events are manually created by the distributor. `noteUuid` is required for deletion.
- Events are sorted by `date ASC` and then `time ASC`. Personal notes have no time, so they appear after timed events on the same date.

### POST /api/v1/distributor/calendar/notes

This endpoint is an upsert. If a note already exists for that date, the backend updates it instead of creating a duplicate.

Request:

```json
{
  "date": "2026-04-10",
  "note": "Prepare slides for distributor meeting"
}
```

Response: the saved note record.

Rule:

- One note per date per distributor. Deduplication is handled by the backend.

### DELETE /api/v1/distributor/calendar/notes/:uuid

Response:

```json
{
  "message": "Note deleted successfully"
}
```

## Notifications

### Overview

The notifications page shows the distributor's upcoming tasks and today's follow-ups. These are in-app notifications only. No email notification flow is involved here.

### Endpoint

- `GET /api/v1/distributor/notifications`

Auth:

- `DISTRIBUTOR`

### Response

```json
{
  "tasksDueToday": [
    {
      "uuid": "task-uuid",
      "title": "Follow up with Priya",
      "dueDate": "2026-04-07T00:00:00Z",
      "lead": {
        "uuid": "lead-uuid",
        "userFullName": "Priya Patel",
        "status": "HOT"
      }
    }
  ],
  "tasksDueSoon": [
    {
      "uuid": "task-uuid",
      "title": "Call Ahmed Hassan",
      "dueDate": "2026-04-09T00:00:00Z",
      "lead": null
    }
  ],
  "followupsToday": [
    {
      "leadUuid": "lead-uuid",
      "userFullName": "Priya Patel",
      "leadStatus": "CONTACTED",
      "followupAt": "2026-04-07T10:30:00Z",
      "notes": "Call to discuss pricing"
    }
  ],
  "unreadCount": 3
}
```

Field details:

- `tasksDueToday` contains tasks due today where `status != COMPLETE`.
- `tasksDueSoon` contains tasks due in the next 3 days, excluding today, where `status != COMPLETE`.
- `followupsToday` contains lead follow-ups scheduled for today from the leads module.
- `unreadCount` equals `tasksDueToday.length + followupsToday.length`.
- `lead` can be `null` in task objects if no lead is linked.

Frontend usage:

- Show `unreadCount` as a badge on the notifications bell icon.
- Call this endpoint on page load and optionally poll it every 5 minutes.
- Clicking a task should navigate to `/distributor/tasks`.
- Clicking a follow-up should navigate to `/leads/:leadUuid`.

## Key Rules

1. Use the frontend page `/join/:code` for distributor acquisition, but validate the code with the backend before signup.
2. Pass `referralCode` during signup whenever the join flow validated a distributor code.
3. Invalid or inactive distributor links should not block signup. The backend ignores unusable referral codes.
4. Distributor plan amounts are stored in rupees. Show `999` as `Rs 999`, not paise.
5. `GET /api/v1/distributor/plans` is available to any authenticated user and returns active plans only.
6. Do not assume `shortUrl` is always present in subscribe responses. Mock mode can return `null`.
7. On re-subscribe, keep the existing distributor code if one already exists.
8. `dashboard.subscription` can be `null`, so the dashboard UI must handle that safely.
9. The public join endpoint is at `/api/v1/distributor/join/:code` - use this exact path.
10. There is no earnings field in the dashboard response. Do not build an earnings card.
11. `GRACE` status exists in the backend enum but is never emitted. Do not show it anywhere in the frontend UI.
12. Distributor user management is scoped to the current distributor's own leads only. Treat missing or unauthorized user details as the same generic `404 User not found` case.
13. Task order is 0-based. When dragging a card, send the new column status and the new 0-based position index in that column via `PATCH /tasks/:uuid/move`.
14. `GET /api/v1/distributor/calendar` requires both `year` and `month` query params as integers.
15. `POST /api/v1/distributor/calendar/notes` is an upsert. Do not build a separate update endpoint in the frontend.
16. `FOLLOWUP` calendar events are read-only in the calendar UI. To change a follow-up, the distributor must go back to the leads module.
17. `unreadCount` in notifications includes `tasksDueToday` and `followupsToday` only. `tasksDueSoon` is informational and does not affect the badge count.
18. Poll `GET /api/v1/distributor/notifications` every 5 minutes to keep the notifications badge fresh.

