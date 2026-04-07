# Module 6 - Distributor Frontend Guide

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
- distributor UTM analytics
- admin plan management
- admin subscription management
- admin distributor link activation and deactivation
- referral-code attribution during signup

## Verified Endpoint Map

| Area | Method | Path | Auth | Notes |
| --- | --- | --- | --- | --- |
| Public | `GET` | `/api/v1/distributor/join/:code` | Public | Validates a distributor code and returns distributor identity info if the link is active. |
| Distributor self-service | `GET` | `/api/v1/distributor/plans` | Any authenticated user | Returns active plans only. |
| Distributor self-service | `POST` | `/api/v1/distributor/subscribe` | Any authenticated user | Starts distributor subscription flow. |
| Distributor self-service | `GET` | `/api/v1/distributor/subscription` | `DISTRIBUTOR` | Returns current distributor subscription state. |
| Distributor self-service | `GET` | `/api/v1/distributor/join-link` | `DISTRIBUTOR` | Returns current share link and QR code. |
| Distributor self-service | `GET` | `/api/v1/distributor/dashboard` | `DISTRIBUTOR` | Returns lead metrics, subscription, and join-link state. |
| Distributor self-service | `GET` | `/api/v1/distributor/analytics/utm` | `DISTRIBUTOR` | Returns UTM attribution aggregates. |
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

## Subscribe Flow

### Step 1 — Fetch Available Plans

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

### Step 2 — Create Subscription

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

## Dashboard

Call:

- `GET /api/v1/distributor/dashboard`

The dashboard only exposes:

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

## Admin — Distributor Link Management

These endpoints manage distributor join link activation directly from the admin panel, separate from subscription management.

Endpoints:

- `GET  /api/v1/admin/distributors`                           - List all distributors (paginated)
- `GET  /api/v1/admin/distributors/:uuid`                     - Distributor detail
- `PATCH /api/v1/admin/distributors/:uuid/deactivate-link`    - Deactivate join link
- `PATCH /api/v1/admin/distributors/:uuid/activate-link`      - Activate join link

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
| `/distributor/analytics` | `GET /distributor/analytics/utm` | Support optional `from` and `to` filters. |
| `/distributor/subscription` | `GET /distributor/subscription` | Build UI around real backend statuses only. |
| `/admin/distributor-plans` | `GET /admin/distributor-plans` + `POST /admin/distributor-plans` + `PATCH /admin/distributor-plans/:uuid/deactivate` | Admin-only plan management. |
| `/admin/distributor-subscriptions` | `GET /admin/distributor-subscriptions` + `GET /admin/distributor-subscriptions/:uuid` + `POST /admin/distributor-subscriptions/:uuid/cancel` | Admin subscription review and cancellation. |
| `/admin/distributors` | `GET /admin/distributors` + `GET /admin/distributors/:uuid` + `PATCH /admin/distributors/:uuid/deactivate-link` + `PATCH /admin/distributors/:uuid/activate-link` | Admin join-link control. |

## Key Rules

1. Use the frontend page `/join/:code` for distributor acquisition, but validate the code with the backend before signup.
2. Pass `referralCode` during signup whenever the join flow validated a distributor code.
3. Invalid or inactive distributor links should not block signup. The backend ignores unusable referral codes.
4. Distributor plan amounts are stored in rupees. Show `999` as `Rs 999`, not paise.
5. `GET /api/v1/distributor/plans` is available to any authenticated user and returns active plans only.
6. Do not assume `shortUrl` is always present in subscribe responses. Mock mode can return `null`.
7. On re-subscribe, keep the existing distributor code if one already exists.
8. `dashboard.subscription` can be `null`, so the dashboard UI must handle that safely.
9. The public join endpoint is at /api/v1/distributor/join/:code — use this exact path.
10. There is no earnings field in the dashboard response. Do not build an earnings card — that feature is not yet implemented in the backend.
