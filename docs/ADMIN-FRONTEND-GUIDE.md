# 🛠️ Admin Frontend Integration Guide

This guide is based on the current backend source in `D:\nsi-backend` inspected on April 3, 2026. It covers the real admin APIs, payload shapes, guard rules, and UI implications for the admin panel.

> Note:
> The requested `src/leads/leads-admin.service.ts` file does not exist in this codebase. Admin lead routes are implemented by `LeadsAdminController` and backed by `LeadsService`.

## 📚 Table of Contents

- [1. Overview](#1--overview)
- [2. User Management APIs](#2--user-management-apis)
  - [2.1 List All Users](#21-list-all-users)
  - [2.2 Get User Detail](#22-get-user-detail)
  - [2.3 Suspend User](#23-suspend-user)
  - [2.4 Reactivate User](#24-reactivate-user)
  - [2.5 Change User Role](#25-change-user-role)
- [3. Distributor Management APIs](#3--distributor-management-apis)
  - [3.1 List All Distributors](#31-list-all-distributors)
  - [3.2 Get Distributor Detail](#32-get-distributor-detail)
  - [3.3 Deactivate Join Link](#33-deactivate-join-link)
  - [3.4 Activate Join Link](#34-activate-join-link)
- [4. Leads Management APIs (Admin)](#4--leads-management-apis-admin)
  - [4.1 List All Leads](#41-list-all-leads)
  - [4.2 Get Lead Detail](#42-get-lead-detail)
  - [4.3 Update Lead Status](#43-update-lead-status)
  - [4.4 Get Distributor Leads](#44-get-distributor-leads)
  - [4.5 Today's Followups](#45-todays-followups)
- [5. Analytics APIs](#5--analytics-apis)
  - [5.1 Dashboard Overview](#51-dashboard-overview)
  - [5.2 Funnel Drop-off Analytics](#52-funnel-drop-off-analytics)
  - [5.3 Revenue Analytics](#53-revenue-analytics)
  - [5.4 Leads Analytics](#54-leads-analytics)
  - [5.5 Distributor Analytics](#55-distributor-analytics)
  - [5.6 LMS Analytics](#56-lms-analytics)
  - [5.7 Date Range Picker Implementation](#57-date-range-picker-implementation)
- [6. Coupon Management APIs](#6--coupon-management-apis)
  - [6.1 List Coupons](#61-list-coupons)
  - [6.2 Get Coupon Detail](#62-get-coupon-detail)
  - [6.3 Create Coupon](#63-create-coupon)
  - [6.4 Update Coupon](#64-update-coupon)
  - [6.5 Delete Coupon](#65-delete-coupon)
- [7. UI Implementation Guide](#7--ui-implementation-guide)
  - [7.1 Admin Sidebar Navigation](#71-admin-sidebar-navigation)
  - [7.2 Users List Page](#72-users-list-page)
  - [7.3 User Detail Page](#73-user-detail-page)
  - [7.4 Distributors Page](#74-distributors-page)
  - [7.5 Analytics Dashboard](#75-analytics-dashboard)
  - [7.6 Coupon Management Page](#76-coupon-management-page)
  - [7.7 LMS CMS Page](#77-lms-cms-page)
- [8. Error Handling](#8--error-handling)
- [9. Complete Implementation Checklist](#9--complete-implementation-checklist)

---

## 1. 🧭 Overview

### Admin panel structure

- Admin frontend URL: `/admin`
- This should be a separate frontend shell from the normal user dashboard
- All admin APIs live under `/api/v1/admin/...`
- Access is restricted to `SUPER_ADMIN` only

> Note:
> `/admin` is a frontend routing convention. The backend enforces access with JWT + `RolesGuard`, not by checking the browser URL.

### Role required

All admin controllers inspected in this guide use:

- `JwtAuthGuard`
- `RolesGuard`
- `@Roles('SUPER_ADMIN')`

That means the backend checks:

1. The request has a valid JWT access token.
2. The user still exists in the database.
3. The database role is still `SUPER_ADMIN`.

> Warning:
> The backend does not trust a stale role claim from the JWT alone. `RolesGuard` re-fetches the user from the database before allowing admin access.

### How admin logs in

Admins use the same auth flow as normal users.

- Login endpoint: `POST /api/v1/auth/login`
- Request body:

```json
{
  "email": "admin@example.com",
  "password": "StrongPassword123!"
}
```

- Response shape:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "uuid": "b8f6e1df-0fbe-47ce-9ef2-e2b0a67d2c75",
    "fullName": "Platform Super Admin",
    "email": "admin@example.com",
    "role": "SUPER_ADMIN",
    "status": "ACTIVE"
  }
}
```

Frontend rule:

- If `user.role === 'SUPER_ADMIN'`, allow `/admin`
- Otherwise redirect to the normal user dashboard

### JWT token usage in headers

Send the access token in every admin API request:

```http
Authorization: Bearer <accessToken>
```

The backend extracts this from the Bearer header via `JwtStrategy`.

> Note:
> The auth system also sets a refresh token in an HttpOnly cookie, but the admin SPA should still send the access token in the `Authorization` header for protected API calls.

### Admin capabilities

| Area | Frontend Route | Main API Base | What admin can do |
|---|---|---|---|
| Dashboard | `/admin/dashboard` | `/api/v1/admin/analytics/dashboard` | View platform KPIs, funnel, lead, revenue, and distributor metrics |
| Users | `/admin/users` | `/api/v1/admin/users` | View users, filter/search, suspend/reactivate, change role |
| Distributors | `/admin/distributors` | `/api/v1/admin/distributors` | View distributors, performance, and activate/deactivate join links |
| Leads | `/admin/leads` | `/api/v1/admin/leads` | View all leads, inspect activities, update status, check followups |
| LMS CMS | `/admin/lms` | `/api/v1/admin/courses` and `/api/v1/admin/lms/analytics` | Full course, section, lesson CRUD plus LMS analytics |
| Coupons | `/admin/coupons` | `/api/v1/admin/coupons` | Create, list, edit, delete coupons |
| Analytics | `/admin/analytics` | `/api/v1/admin/analytics` | Platform-wide analytics across users, leads, revenue, distributors |

### LMS CMS route map

The admin LMS API is broader than analytics only. These routes exist today:

| Purpose | Method | Endpoint |
|---|---|---|
| Create course | `POST` | `/api/v1/admin/courses` |
| List courses | `GET` | `/api/v1/admin/courses` |
| Get course detail | `GET` | `/api/v1/admin/courses/:uuid` |
| Update course | `PATCH` | `/api/v1/admin/courses/:uuid` |
| Delete course | `DELETE` | `/api/v1/admin/courses/:uuid` |
| Publish course | `PATCH` | `/api/v1/admin/courses/:uuid/publish` |
| Unpublish course | `PATCH` | `/api/v1/admin/courses/:uuid/unpublish` |
| Create section | `POST` | `/api/v1/admin/courses/:uuid/sections` |
| Reorder sections | `PATCH` | `/api/v1/admin/courses/:courseUuid/sections/reorder` |
| Update section | `PATCH` | `/api/v1/admin/courses/:courseUuid/sections/:sectionUuid` |
| Delete section | `DELETE` | `/api/v1/admin/courses/:courseUuid/sections/:sectionUuid` |
| Create lesson | `POST` | `/api/v1/admin/courses/:courseUuid/sections/:sectionUuid/lessons` |
| Reorder lessons | `PATCH` | `/api/v1/admin/courses/:courseUuid/sections/:sectionUuid/lessons/reorder` |
| Update lesson | `PATCH` | `/api/v1/admin/courses/:courseUuid/sections/:sectionUuid/lessons/:lessonUuid` |
| Delete lesson | `DELETE` | `/api/v1/admin/courses/:courseUuid/sections/:sectionUuid/lessons/:lessonUuid` |
| LMS analytics | `GET` | `/api/v1/admin/lms/analytics` |

---

## 2. 👤 User Management APIs

## 2.1 List All Users

**Endpoint**

`GET /api/v1/admin/users`

### Query params

| Query param | Type | Default | Notes |
|---|---|---:|---|
| `role` | `string` | none | Typical admin UI values: `USER`, `CUSTOMER`, `DISTRIBUTOR` |
| `status` | `string` | none | Use `active` or `suspended` in UI; backend uppercases internally |
| `country` | `string` | none | Exact country code/string match, e.g. `IN` |
| `search` | `string` | none | Searches `fullName` and `email` case-insensitively |
| `page` | `number` | `1` | Minimum 1 |
| `limit` | `number` | `20` | Clamped to `1..100` |

### Response shape

Pagination structure:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "limit": 20,
  "totalPages": 0
}
```

Each user item includes:

| Field | Type | Notes |
|---|---|---|
| `uuid` | `string` | User UUID |
| `fullName` | `string` | Full name |
| `email` | `string` | Email |
| `role` | `USER \| CUSTOMER \| DISTRIBUTOR \| ADMIN \| SUPER_ADMIN` | UI should usually expose only the first three in filters |
| `status` | `REGISTERED \| EMAIL_VERIFIED \| PROFILE_INCOMPLETE \| ACTIVE \| SUSPENDED` | Most admin grids should badge `ACTIVE` vs `SUSPENDED` |
| `country` | `string \| null` | Country code/string |
| `createdAt` | `string` | ISO datetime |
| `suspendedAt` | `string \| null` | ISO datetime |
| `phone` | `string \| null` | From `UserProfile` |
| `phoneVerified` | `boolean` | Based on `phoneVerifiedAt != null` |
| `paymentCompleted` | `boolean` | From `FunnelProgress.paymentCompleted` |
| `funnelProgress.completedSteps` | `number` | Completed active funnel steps |
| `funnelProgress.totalSteps` | `number` | Total active funnel steps |
| `leadStatus` | `string \| null` | Raw lead status if the user has a lead |

### Example response

```json
{
  "items": [
    {
      "uuid": "4ef2c2a8-6b04-4130-a13f-7c14cebb52fb",
      "fullName": "Arjun Mehta",
      "email": "arjun@example.com",
      "role": "USER",
      "status": "ACTIVE",
      "country": "IN",
      "createdAt": "2026-03-17T08:12:54.000Z",
      "suspendedAt": null,
      "phone": "+919999999999",
      "phoneVerified": true,
      "paymentCompleted": true,
      "funnelProgress": {
        "completedSteps": 3,
        "totalSteps": 5
      },
      "leadStatus": "HOT"
    },
    {
      "uuid": "f1837baf-9d7d-442f-b26f-f1ed898c7c96",
      "fullName": "Nidhi Rao",
      "email": "nidhi@example.com",
      "role": "CUSTOMER",
      "status": "SUSPENDED",
      "country": "IN",
      "createdAt": "2026-02-09T10:20:18.000Z",
      "suspendedAt": "2026-03-25T06:11:03.000Z",
      "phone": null,
      "phoneVerified": false,
      "paymentCompleted": false,
      "funnelProgress": {
        "completedSteps": 1,
        "totalSteps": 5
      },
      "leadStatus": null
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20,
  "totalPages": 3
}
```

### Filter tabs: All / USER / CUSTOMER / DISTRIBUTOR

Map tabs like this:

- `All` -> omit `role`
- `USER` -> `?role=USER`
- `CUSTOMER` -> `?role=CUSTOMER`
- `DISTRIBUTOR` -> `?role=DISTRIBUTOR`

> Note:
> The Prisma enum also contains `ADMIN` and `SUPER_ADMIN`, but the requested admin UX should not expose those as normal role filter tabs.

### Search bar

Recommended behavior:

- Debounce by `300-500ms`
- Reset `page` to `1` whenever search or filters change
- Keep filters in the URL query string so the page is shareable

Backend search matches:

- `fullName`
- `email`

### Progress column: `F: 3/5`

Use:

- `F:${user.funnelProgress.completedSteps}/${user.funnelProgress.totalSteps}`

> Warning:
> `GET /api/v1/admin/users` does **not** return an LMS summary. If you want a combined `F:x/y L:x/y` column, either:
> 1. Show only the funnel value on the list page, or
> 2. Lazy-load user detail per selected row and compute LMS progress there.

## 2.2 Get User Detail

**Endpoint**

`GET /api/v1/admin/users/:uuid`

### Response highlights

| Section | Type | Notes |
|---|---|---|
| Base user fields | object | Same core identity/status fields as list |
| `paymentHistory` | array | All payments, newest first |
| `funnelStepProgress` | array | Step-by-step funnel detail |
| `leadDetail` | object or `null` | Summary only, not full lead timeline |
| `lmsProgress` | array | Per-course LMS progress |
| `activeSessions` | `number` | Count of unexpired sessions, not a list |

### Example response

```json
{
  "uuid": "4ef2c2a8-6b04-4130-a13f-7c14cebb52fb",
  "fullName": "Arjun Mehta",
  "email": "arjun@example.com",
  "role": "USER",
  "status": "ACTIVE",
  "country": "IN",
  "createdAt": "2026-03-17T08:12:54.000Z",
  "suspendedAt": null,
  "phone": "+919999999999",
  "phoneVerified": true,
  "paymentCompleted": true,
  "funnelProgress": {
    "completedSteps": 3,
    "totalSteps": 5
  },
  "leadStatus": "HOT",
  "paymentHistory": [
    {
      "uuid": "8d3d5233-1a94-4aa1-a361-f378372d9641",
      "amount": 25000,
      "finalAmount": 20000,
      "currency": "INR",
      "status": "SUCCESS",
      "paymentType": "COMMITMENT_FEE",
      "createdAt": "2026-03-18T11:05:00.000Z"
    },
    {
      "uuid": "77c4fb29-8263-4206-b908-377b31d14f12",
      "amount": 4999,
      "finalAmount": 4999,
      "currency": "INR",
      "status": "PENDING",
      "paymentType": "LMS_COURSE",
      "createdAt": "2026-03-10T09:15:00.000Z"
    }
  ],
  "funnelStepProgress": [
    {
      "stepUuid": "b8f2d71a-b28d-4fc3-a40f-441f1f8039dd",
      "stepType": "VIDEO_TEXT",
      "stepOrder": 1,
      "isCompleted": true,
      "watchedSeconds": 238,
      "completedAt": "2026-03-17T08:20:00.000Z"
    },
    {
      "stepUuid": "7ad4fd4a-31c9-42d5-81cd-a82598fd8e0d",
      "stepType": "PHONE_GATE",
      "stepOrder": 2,
      "isCompleted": true,
      "watchedSeconds": 0,
      "completedAt": "2026-03-17T08:41:00.000Z"
    },
    {
      "stepUuid": "c5dbe3ee-a997-4d30-b270-2a1d81b15035",
      "stepType": "PAYMENT_GATE",
      "stepOrder": 3,
      "isCompleted": true,
      "watchedSeconds": 0,
      "completedAt": "2026-03-18T11:05:00.000Z"
    }
  ],
  "leadDetail": {
    "uuid": "f0c9af6d-bfe4-4135-81fe-c2dd41c0bdbd",
    "status": "HOT",
    "createdAt": "2026-03-17T08:45:00.000Z",
    "lastActivityAt": "2026-03-18T12:00:00.000Z",
    "lastActivityNote": "Interested after payment"
  },
  "lmsProgress": [
    {
      "courseUuid": "0bbeb31f-6a1d-47f0-949f-7c1fd626c2cf",
      "courseTitle": "NSI Fundamentals",
      "enrolledAt": "2026-03-19T10:00:00.000Z",
      "completedAt": null,
      "progress": 67,
      "certificateUrl": null
    },
    {
      "courseUuid": "bc0ff6ef-f2c0-4eb6-bd8e-5534464f8d34",
      "courseTitle": "Distributor Masterclass",
      "enrolledAt": "2026-03-20T10:00:00.000Z",
      "completedAt": "2026-03-30T14:20:00.000Z",
      "progress": 100,
      "certificateUrl": "https://cdn.example.com/certificates/arjun-masterclass.pdf"
    }
  ],
  "activeSessions": 2
}
```

### Nested section notes

#### `paymentHistory`

Each entry includes:

- `uuid`
- `amount`
- `finalAmount`
- `currency`
- `status`
- `paymentType`
- `createdAt`

#### `funnelStepProgress`

Each step includes:

- `stepUuid`
- `stepType`
- `stepOrder`
- `isCompleted`
- `watchedSeconds`
- `completedAt`

#### `leadDetail`

This is a summary only:

- `uuid`
- `status`
- `createdAt`
- `lastActivityAt`
- `lastActivityNote`

#### `lmsProgress`

Each course item includes:

- `courseUuid`
- `courseTitle`
- `enrolledAt`
- `completedAt`
- `progress`
- `certificateUrl`

### User detail page tabs

- `Profile`
  - Show identity, role, status, phone, country, active sessions
  - Show a small funnel completion summary card
- `Funnel Progress`
  - Use `funnelStepProgress`
  - Render a stepper sorted by `stepOrder`
- `LMS`
  - Use `lmsProgress`
  - Show progress bars and certificate links
- `Payments`
  - Use `paymentHistory`
  - Show newest first
- `Lead`
  - Use `leadDetail`
  - If `leadDetail.uuid` exists, fetch `/api/v1/admin/leads/:leadUuid` for full timeline

> Warning:
> The requested `Audit Log` tab is **not** backed by any admin read endpoint in the inspected files. The backend writes audit logs, but there is no current API to fetch them for a user detail page. Keep that tab hidden, placeholder-only, or plan a backend addition.

---

## 2.3 Suspend User

**Endpoint**

`PATCH /api/v1/admin/users/:uuid/suspend`

### Request

No request body.

### Response

```json
{
  "message": "User suspended successfully"
}
```

### What happens on the backend

- User status becomes `SUSPENDED`
- `suspendedAt` is set
- `suspendedBy` is set to the acting admin
- All `AuthSession` rows for that user are deleted
- A suspension email is sent
- An audit log entry is written

### UI guidance

- Always show a confirmation dialog before calling this endpoint
- Suggested copy:
  - Title: `Suspend this user?`
  - Body: `This will immediately invalidate all active sessions and block future access until reactivated.`

### Error cases

| Status | Message | When |
|---|---|---|
| `400` | `User is already suspended` | User already has `SUSPENDED` status |
| `403` | `Cannot suspend a Super Admin account` | Target user role is `SUPER_ADMIN` |
| `404` | `User not found` | UUID does not exist |

---

## 2.4 Reactivate User

**Endpoint**

`PATCH /api/v1/admin/users/:uuid/reactivate`

### Request

No request body.

### Response

```json
{
  "message": "User reactivated successfully"
}
```

### Notes

- User status returns to `ACTIVE`
- `suspendedAt` and `suspendedBy` are cleared
- A reactivation email is sent
- An audit log entry is written
- The user must log in again because their sessions were deleted during suspension

### Error cases

| Status | Message | When |
|---|---|---|
| `400` | `User is not suspended` | Trying to reactivate an already active user |
| `404` | `User not found` | UUID does not exist |

---

## 2.5 Change User Role

**Endpoint**

`PATCH /api/v1/admin/users/:uuid/role`

### Request body

Use this UI-safe shape:

```json
{
  "role": "CUSTOMER"
}
```

Allowed values for the admin panel UI:

- `USER`
- `CUSTOMER`
- `DISTRIBUTOR`

### Response

```json
{
  "message": "User role updated successfully"
}
```

### Rules

- Cannot set role to `SUPER_ADMIN`
- Cannot change the role of an existing `SUPER_ADMIN`
- The backend DTO uses the Prisma `UserRole` enum, so `ADMIN` exists in the schema, but this admin UI should not expose it unless product explicitly wants that role path

### UI guidance

- Show current role and new role in a confirmation dialog
- Example confirmation:
  - `Change role from USER to CUSTOMER?`

### Error cases

| Status | Message | When |
|---|---|---|
| `403` | `Cannot assign Super Admin role via API` | Request body tries `SUPER_ADMIN` |
| `403` | `Cannot change role of a Super Admin` | Target user already is `SUPER_ADMIN` |
| `404` | `User not found` | UUID does not exist |

---

## 3. 🧩 Distributor Management APIs

## 3.1 List All Distributors

**Endpoint**

`GET /api/v1/admin/distributors`

### Query params

| Query param | Type | Default | Notes |
|---|---|---:|---|
| `search` | `string` | none | Matches distributor `fullName` and `email` |
| `status` | `active \| deactivated` | none | Filters by `joinLinkActive`, not account suspension |
| `page` | `number` | `1` | Minimum 1 |
| `limit` | `number` | `20` | Clamped to `1..100` |

### Response shape

Same pagination structure:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "limit": 20,
  "totalPages": 0
}
```

Each distributor item includes:

- `uuid`
- `fullName`
- `email`
- `country`
- `distributorCode`
- `joinLink`
- `joinLinkActive`
- `createdAt`
- `totalLeads`
- `hotLeads`
- `convertedLeads`
- `conversionRate`
- `activeThisMonth`

### Example response

```json
{
  "items": [
    {
      "uuid": "e674b615-8136-4ef2-90dc-5bb7695bd84f",
      "fullName": "Nageshwar Rao",
      "email": "nageshwar@example.com",
      "country": "IN",
      "distributorCode": "NAG123",
      "joinLink": "https://frontend.example.com/join/NAG123",
      "joinLinkActive": true,
      "createdAt": "2026-01-10T07:20:00.000Z",
      "totalLeads": 58,
      "hotLeads": 11,
      "convertedLeads": 9,
      "conversionRate": "15.5%",
      "activeThisMonth": true
    },
    {
      "uuid": "88b6bc79-e4f9-45ab-b699-4f6fd16b3a68",
      "fullName": "Sneha Patel",
      "email": "sneha@example.com",
      "country": "AE",
      "distributorCode": "SNE456",
      "joinLink": "https://frontend.example.com/join/SNE456",
      "joinLinkActive": false,
      "createdAt": "2025-12-05T09:30:00.000Z",
      "totalLeads": 34,
      "hotLeads": 3,
      "convertedLeads": 4,
      "conversionRate": "11.8%",
      "activeThisMonth": false
    }
  ],
  "total": 12,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

### Distributor leaderboard UI

Recommended summary cards:

- `Total Distributors`
- `Active This Month`
- `Highest Conversion`

Recommended table columns:

- Rank
- Name
- Email
- Country
- Join Link
- Total Leads
- Hot Leads
- Converted
- Conversion Rate
- Status
- Actions

> Note:
> The service paginates first, then sorts the current page by `totalLeads`. Treat the returned order as the display order for that page, but do not assume it is a guaranteed global rank across the full dataset.

### Join link copy button

Use:

- Display the full `joinLink`
- Add a `Copy` action using `navigator.clipboard.writeText(joinLink)`
- Disable the button if `joinLink` is `null`

---

## 3.2 Get Distributor Detail

**Endpoint**

`GET /api/v1/admin/distributors/:uuid`

### Response includes

- Base distributor fields
- `recentLeads`
- `performanceAnalytics`

### Example response

```json
{
  "uuid": "e674b615-8136-4ef2-90dc-5bb7695bd84f",
  "fullName": "Nageshwar Rao",
  "email": "nageshwar@example.com",
  "country": "IN",
  "distributorCode": "NAG123",
  "joinLink": "https://frontend.example.com/join/NAG123",
  "joinLinkActive": true,
  "createdAt": "2026-01-10T07:20:00.000Z",
  "totalLeads": 58,
  "hotLeads": 11,
  "convertedLeads": 9,
  "conversionRate": "15.5%",
  "activeThisMonth": true,
  "recentLeads": [
    {
      "uuid": "a22a1fb8-2fd7-4999-ae56-60f68bc3fd45",
      "userFullName": "Rahul Verma",
      "userEmail": "rahul@example.com",
      "phone": "+919888888888",
      "status": "FOLLOWUP",
      "country": "IN",
      "createdAt": "2026-03-30T08:00:00.000Z",
      "followupAt": "2026-04-04T10:00:00.000Z"
    },
    {
      "uuid": "bb2e85a1-df2c-4f2b-9ca8-c9a3151a0aa3",
      "userFullName": "Asha Menon",
      "userEmail": "asha@example.com",
      "phone": null,
      "status": "HOT",
      "country": "AE",
      "createdAt": "2026-03-29T09:00:00.000Z",
      "followupAt": null
    }
  ],
  "performanceAnalytics": {
    "totalReferrals": 58,
    "successfulConversions": 9,
    "conversionRate": "15.5%",
    "funnelPath": [
      { "stage": "NEW", "count": 12 },
      { "stage": "WARM", "count": 8 },
      { "stage": "HOT", "count": 11 },
      { "stage": "CONTACTED", "count": 9 },
      { "stage": "FOLLOWUP", "count": 6 },
      { "stage": "MARK_AS_CUSTOMER", "count": 9 },
      { "stage": "LOST", "count": 3 }
    ],
    "leadsByCountry": [
      { "country": "IN", "count": 40 },
      { "country": "AE", "count": 10 },
      { "country": "Unknown", "count": 8 }
    ],
    "leadsOverTime": [
      { "period": "2025-11", "count": 4 },
      { "period": "2025-12", "count": 7 },
      { "period": "2026-01", "count": 15 },
      { "period": "2026-02", "count": 14 },
      { "period": "2026-03", "count": 18 }
    ]
  }
}
```

### `recentLeads` fields

| Field | Type | Notes |
|---|---|---|
| `uuid` | `string` | Lead UUID |
| `userFullName` | `string` | Lead user full name |
| `userEmail` | `string` | Lead user email |
| `phone` | `string \| null` | Lead phone or fallback profile phone |
| `status` | `string` | Raw lead status |
| `country` | `string \| null` | Lead user country |
| `createdAt` | `string` | Lead creation time |
| `followupAt` | `string \| null` | Latest followup date if any |

### Performance Analytics tab

Use `performanceAnalytics` to render:

- KPI cards:
  - `Total Referrals`
  - `Successful Conversions`
  - `Conversion Rate`
- `Funnel Path` chart
- `Leads by Country` chart/table
- `Leads Over Time` line or bar chart

### Funnel path bar chart

Recommended stage order:

1. `NEW`
2. `WARM`
3. `HOT`
4. `CONTACTED`
5. `FOLLOWUP`
6. `NURTURE`
7. `LOST`
8. `MARK_AS_CUSTOMER`

Because the backend returns `funnelPath` as counted status entries, normalize it on the frontend into a fixed order and fill missing stages with `0`.

---

## 3.3 Deactivate Join Link

**Endpoint**

`PATCH /api/v1/admin/distributors/:uuid/deactivate-link`

### Response

```json
{
  "message": "Join link deactivated"
}
```

### Effect

New users arriving via that distributor code should no longer get distributor attribution from the join link flow.

### UI guidance

Show a confirmation modal:

- `Deactivate join link?`
- `New signups from this link will no longer be assigned to this distributor.`

---

## 3.4 Activate Join Link

**Endpoint**

`PATCH /api/v1/admin/distributors/:uuid/activate-link`

### Response

```json
{
  "message": "Join link activated"
}
```

---

## 4. 🎯 Leads Management APIs (Admin)

## 4.1 List All Leads

**Endpoint**

`GET /api/v1/admin/leads`

### Query params

| Query param | Type | Default | Notes |
|---|---|---:|---|
| `status` | `NEW \| WARM \| HOT \| CONTACTED \| FOLLOWUP \| NURTURE \| LOST \| MARK_AS_CUSTOMER` | none | UI commonly exposes manual-management states, but raw enums all work |
| `search` | `string` | none | Searches lead user name, email, and phone |
| `page` | `number` | `1` | Parsed from query string |
| `limit` | `number` | `20` | Parsed from query string |

### Response shape

Paginated:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "limit": 20,
  "totalPages": 0
}
```

### Example response

```json
{
  "items": [
    {
      "uuid": "8e0b9653-d83f-4b73-a68c-495f179af299",
      "userUuid": "4ef2c2a8-6b04-4130-a13f-7c14cebb52fb",
      "assignedToUuid": "e674b615-8136-4ef2-90dc-5bb7695bd84f",
      "distributorUuid": "e674b615-8136-4ef2-90dc-5bb7695bd84f",
      "status": "FOLLOWUP",
      "phone": "+919999999999",
      "createdAt": "2026-03-17T08:45:00.000Z",
      "updatedAt": "2026-04-03T06:00:00.000Z",
      "user": {
        "uuid": "4ef2c2a8-6b04-4130-a13f-7c14cebb52fb",
        "fullName": "Arjun Mehta",
        "email": "arjun@example.com",
        "country": "IN"
      },
      "assignedTo": {
        "uuid": "e674b615-8136-4ef2-90dc-5bb7695bd84f",
        "fullName": "Nageshwar Rao"
      },
      "displayStatus": "FOLLOWUP"
    },
    {
      "uuid": "48d3c81f-5e1d-474f-a2d5-6af58d7ce4b4",
      "userUuid": "f1837baf-9d7d-442f-b26f-f1ed898c7c96",
      "assignedToUuid": "e674b615-8136-4ef2-90dc-5bb7695bd84f",
      "distributorUuid": "e674b615-8136-4ef2-90dc-5bb7695bd84f",
      "status": "MARK_AS_CUSTOMER",
      "phone": null,
      "createdAt": "2026-03-10T10:30:00.000Z",
      "updatedAt": "2026-03-25T12:00:00.000Z",
      "user": {
        "uuid": "f1837baf-9d7d-442f-b26f-f1ed898c7c96",
        "fullName": "Nidhi Rao",
        "email": "nidhi@example.com",
        "country": "IN"
      },
      "assignedTo": {
        "uuid": "e674b615-8136-4ef2-90dc-5bb7695bd84f",
        "fullName": "Nageshwar Rao"
      },
      "displayStatus": "CUSTOMER"
    }
  ],
  "total": 84,
  "page": 1,
  "limit": 20,
  "totalPages": 5
}
```

### Status filter tabs

| Tab Label | API Value |
|---|---|
| `All` | omit `status` |
| `HOT` | `HOT` |
| `CONTACTED` | `CONTACTED` |
| `FOLLOWUP` | `FOLLOWUP` |
| `NURTURE` | `NURTURE` |
| `LOST` | `LOST` |
| `CUSTOMER` | `MARK_AS_CUSTOMER` |

### Status badge colors

| Status | Color |
|---|---|
| `HOT` | amber |
| `CONTACTED` | blue |
| `FOLLOWUP` | orange |
| `MARK_AS_CUSTOMER` | green |
| `LOST` | gray |
| `NURTURE` | purple |
| `NEW` | slate |
| `WARM` | yellow |

> Note:
> The lead endpoints also return `displayStatus`. That is the human-readable value for UI badges. Example: raw `status = MARK_AS_CUSTOMER`, `displayStatus = CUSTOMER`.

## 4.2 Get Lead Detail

**Endpoint**

`GET /api/v1/admin/leads/:uuid`

### Response includes

- Base lead fields
- `user`
- `assignedTo`
- `distributor`
- `activities`
- `nurtureEnrollment`
- `funnelProgress`
- `displayStatus`

### Example response

```json
{
  "uuid": "8e0b9653-d83f-4b73-a68c-495f179af299",
  "userUuid": "4ef2c2a8-6b04-4130-a13f-7c14cebb52fb",
  "assignedToUuid": "e674b615-8136-4ef2-90dc-5bb7695bd84f",
  "distributorUuid": "e674b615-8136-4ef2-90dc-5bb7695bd84f",
  "status": "FOLLOWUP",
  "phone": "+919999999999",
  "createdAt": "2026-03-17T08:45:00.000Z",
  "updatedAt": "2026-04-03T06:00:00.000Z",
  "user": {
    "uuid": "4ef2c2a8-6b04-4130-a13f-7c14cebb52fb",
    "fullName": "Arjun Mehta",
    "email": "arjun@example.com",
    "country": "IN"
  },
  "assignedTo": {
    "uuid": "e674b615-8136-4ef2-90dc-5bb7695bd84f",
    "fullName": "Nageshwar Rao"
  },
  "distributor": {
    "uuid": "e674b615-8136-4ef2-90dc-5bb7695bd84f",
    "fullName": "Nageshwar Rao"
  },
  "activities": [
    {
      "uuid": "2d3270e8-7507-45c7-89eb-8641d06d39bb",
      "leadUuid": "8e0b9653-d83f-4b73-a68c-495f179af299",
      "actorUuid": "b8f6e1df-0fbe-47ce-9ef2-e2b0a67d2c75",
      "fromStatus": "CONTACTED",
      "toStatus": "FOLLOWUP",
      "action": "FOLLOWUP_SCHEDULED",
      "notes": "Call again after salary date",
      "followupAt": "2026-04-04T10:00:00.000Z",
      "createdAt": "2026-04-03T06:00:00.000Z",
      "actor": {
        "uuid": "b8f6e1df-0fbe-47ce-9ef2-e2b0a67d2c75",
        "fullName": "Platform Super Admin"
      }
    }
  ],
  "nurtureEnrollment": null,
  "displayStatus": "FOLLOWUP",
  "funnelProgress": {
    "phoneVerified": true,
    "paymentCompleted": true,
    "decisionAnswer": "yes",
    "completedSteps": 3,
    "totalSteps": 5,
    "currentStepUuid": "c5dbe3ee-a997-4d30-b270-2a1d81b15035"
  }
}
```

### Lead timeline / activity history UI

Render activities as a descending timeline:

- Timestamp
- Actor name
- Action badge:
  - `STATUS_CHANGE`
  - `FOLLOWUP_SCHEDULED`
  - `NOTE`
- Status transition:
  - `fromStatus -> toStatus`
- Notes
- Followup date if present

If `nurtureEnrollment` exists, show:

- `status`
- `day1SentAt`
- `day3SentAt`
- `day7SentAt`
- `nextEmailAt`

---

## 4.3 Update Lead Status

**Endpoint**

`PATCH /api/v1/admin/leads/:uuid/status`

### Allowed target statuses

- `CONTACTED`
- `FOLLOWUP`
- `MARK_AS_CUSTOMER`
- `LOST`

### Request body examples

#### Contacted

```json
{
  "status": "CONTACTED",
  "notes": "Spoke with customer and qualified interest"
}
```

#### Followup

```json
{
  "status": "FOLLOWUP",
  "notes": "Call tomorrow after 11 AM",
  "followupAt": "2026-04-04T11:00:00.000Z"
}
```

#### Lost

```json
{
  "status": "LOST",
  "notes": "Not interested right now"
}
```

#### Mark as customer

```json
{
  "status": "MARK_AS_CUSTOMER",
  "notes": "Converted after final call"
}
```

### Transition rules

The admin endpoint uses the same shared transition rules as the distributor endpoint:

| Current Status | Allowed Next Statuses |
|---|---|
| `NEW` | none |
| `WARM` | none |
| `HOT` | `CONTACTED`, `FOLLOWUP`, `MARK_AS_CUSTOMER`, `LOST` |
| `CONTACTED` | `FOLLOWUP`, `MARK_AS_CUSTOMER`, `LOST` |
| `FOLLOWUP` | `CONTACTED`, `MARK_AS_CUSTOMER`, `LOST` |
| `NURTURE` | none |
| `LOST` | none |
| `MARK_AS_CUSTOMER` | none |

### Important behavior

- `FOLLOWUP` requires both:
  - `notes`
  - `followupAt`
- `followupAt` must be a future datetime
- `MARK_AS_CUSTOMER` also promotes `User.role` to `CUSTOMER`
- The created activity uses:
  - `FOLLOWUP_SCHEDULED` when status becomes `FOLLOWUP`
  - `STATUS_CHANGE` for all other status changes

### Typical response

The endpoint returns the updated lead object with:

- raw `status`
- `displayStatus`
- `user`
- `assignedTo`

### Common 400s to handle

| Message | Meaning |
|---|---|
| `Notes are required when scheduling a followup` | Missing `notes` for `FOLLOWUP` |
| `followupAt is required when status is FOLLOWUP` | Missing `followupAt` |
| `followupAt must be in the future` | Date is not future |
| `Cannot change status. Lead must reach HOT status first before manual management is allowed.` | Invalid transition |

---

## 4.4 Get Distributor Leads

**Endpoint**

`GET /api/v1/admin/leads/distributor/:distributorUuid`

### Behavior

- Returns all leads assigned to that distributor
- Not paginated
- Useful inside the distributor detail page

### Response shape

Each item uses the same lead object style as the lead list, including:

- lead base fields
- `user`
- `displayStatus`

### Use case

Use this to power:

- Distributor detail -> `Leads` tab
- Side panel showing all active referrals for a distributor

---

## 4.5 Today's Followups

**Endpoint**

`GET /api/v1/admin/leads/followups/today`

### Response

This endpoint returns an array, not paginated.

```json
[
  {
    "uuid": "8e0b9653-d83f-4b73-a68c-495f179af299",
    "userUuid": "4ef2c2a8-6b04-4130-a13f-7c14cebb52fb",
    "assignedToUuid": "e674b615-8136-4ef2-90dc-5bb7695bd84f",
    "distributorUuid": "e674b615-8136-4ef2-90dc-5bb7695bd84f",
    "status": "FOLLOWUP",
    "phone": "+919999999999",
    "createdAt": "2026-03-17T08:45:00.000Z",
    "updatedAt": "2026-04-03T06:00:00.000Z",
    "user": {
      "uuid": "4ef2c2a8-6b04-4130-a13f-7c14cebb52fb",
      "fullName": "Arjun Mehta",
      "email": "arjun@example.com",
      "country": "IN"
    },
    "assignedTo": {
      "uuid": "e674b615-8136-4ef2-90dc-5bb7695bd84f",
      "fullName": "Nageshwar Rao"
    },
    "activities": [
      {
        "uuid": "2d3270e8-7507-45c7-89eb-8641d06d39bb",
        "leadUuid": "8e0b9653-d83f-4b73-a68c-495f179af299",
        "actorUuid": "b8f6e1df-0fbe-47ce-9ef2-e2b0a67d2c75",
        "fromStatus": "CONTACTED",
        "toStatus": "FOLLOWUP",
        "action": "FOLLOWUP_SCHEDULED",
        "notes": "Call again after salary date",
        "followupAt": "2026-04-03T11:00:00.000Z",
        "createdAt": "2026-04-02T08:00:00.000Z"
      }
    ],
    "displayStatus": "FOLLOWUP"
  }
]
```

### Action Required banner

Recommended UX:

- Fetch on dashboard load
- Show banner only when `array.length > 0`
- Example copy:
  - `Action required: 6 followups due today`

### Count and list

- Count = `response.length`
- Show first few names inline
- Add CTA button to `/admin/leads?status=FOLLOWUP`

> Note:
> This endpoint only includes leads whose current status is `FOLLOWUP` and that have a `FOLLOWUP_SCHEDULED` activity due today.

---

## 5. 📊 Analytics APIs

### Shared date range rules

Most analytics endpoints accept:

- `from`
- `to`

Use ISO date strings, for example:

`?from=2026-01-01&to=2026-03-31`

Backend rules:

- Default range: last 30 days
- `from` is normalized to `00:00:00.000`
- `to` is normalized to `23:59:59.999`
- Maximum range: `5 years`
- If `from > to`, the backend returns `400`

## 5.1 Dashboard Overview

**Endpoint**

`GET /api/v1/admin/analytics/dashboard`

### Query params

| Query param | Type | Default |
|---|---|---|
| `from` | ISO date string | 30 days before `to` |
| `to` | ISO date string | now |

### Example response

```json
{
  "overview": {
    "totalUsers": 124,
    "totalUsersGrowth": 18,
    "phoneVerified": 97,
    "paymentsCompleted": 63,
    "hotLeads": 21,
    "hotLeadsGrowth": 11,
    "customers": 13,
    "customersGrowth": 8,
    "distributors": 4,
    "distributorsGrowth": 33,
    "machinesSold": 9
  },
  "decisionSplit": {
    "yes": 41,
    "no": 16,
    "yesPercent": "71.9%"
  },
  "funnelStages": [
    { "stage": "Registered", "count": 124 },
    { "stage": "Email Verified", "count": 113 },
    { "stage": "Phone Verified", "count": 97 },
    { "stage": "Payment Done", "count": 63 },
    { "stage": "Decision YES", "count": 41 }
  ]
}
```

### Summary cards with growth indicators

Use `overview` for cards:

- Total Users
- Hot Leads
- Customers
- Distributors
- Machines Sold
- Phone Verified
- Payments Completed

UI rule:

- `totalUsersGrowth`, `hotLeadsGrowth`, `customersGrowth`, `distributorsGrowth` are numbers
- Add your own `%` sign in the card UI
- Positive -> green arrow up
- Negative -> red arrow down
- Zero -> neutral

### Funnel stages bar chart

- Use `funnelStages`
- A horizontal bar chart works best
- Keep the stage order exactly as returned

## 5.2 Funnel Drop-off Analytics

**Endpoint**

`GET /api/v1/admin/analytics/funnel`

### Query params

`?from=&to=`

### Example response

```json
{
  "grouping": "week",
  "stages": [
    {
      "stage": "Registered",
      "count": 124,
      "dropoffFromPrevious": 0,
      "dropoffPercent": "0.0%",
      "conversionFromStart": "100.0%"
    },
    {
      "stage": "Email Verified",
      "count": 113,
      "dropoffFromPrevious": 11,
      "dropoffPercent": "8.9%",
      "conversionFromStart": "91.1%"
    },
    {
      "stage": "Phone Verified",
      "count": 97,
      "dropoffFromPrevious": 16,
      "dropoffPercent": "14.2%",
      "conversionFromStart": "78.2%"
    },
    {
      "stage": "Payment Done",
      "count": 63,
      "dropoffFromPrevious": 34,
      "dropoffPercent": "35.1%",
      "conversionFromStart": "50.8%"
    },
    {
      "stage": "Decision YES",
      "count": 41,
      "dropoffFromPrevious": 22,
      "dropoffPercent": "34.9%",
      "conversionFromStart": "33.1%"
    }
  ]
}
```

### Conversion funnel visualization

Show each stage with:

- absolute count
- drop-off from previous stage
- conversion from start

### Drop-off percentage display

Good layout:

- Main bar length = `count`
- Sub-label = `dropoffPercent`
- Secondary label = `conversionFromStart`

> Note:
> `grouping` is returned by the backend for consistency, but this endpoint currently returns an aggregate funnel summary, not a time-series chart.

## 5.3 Revenue Analytics

**Endpoint**

`GET /api/v1/admin/analytics/revenue`

### Query params

`?from=&to=`

### Example response

```json
{
  "totalRevenue": 574000,
  "totalRevenueGrowth": 12,
  "byType": {
    "commitmentFee": 420000,
    "lmsCourse": 84000,
    "distributorSubscription": 70000
  },
  "byCountry": [
    { "country": "IN", "revenue": 488000 },
    { "country": "AE", "revenue": 56000 },
    { "country": "Unknown", "revenue": 30000 }
  ],
  "grouping": "week",
  "chart": [
    { "period": "2026-01-05", "revenue": 75000 },
    { "period": "2026-01-12", "revenue": 92000 },
    { "period": "2026-01-19", "revenue": 61000 },
    { "period": "2026-01-26", "revenue": 83000 }
  ]
}
```

### Smart grouping

The backend picks `grouping` automatically:

- `day`
- `week`
- `month`

### Revenue chart

- Use a line chart for trend view
- Use a bar chart when comparing fewer periods
- Label from `chart[].period`
- Value from `chart[].revenue`

### Revenue by payment type breakdown

Use `byType` for a stacked bar, horizontal bar, or mini stat cards:

- `commitmentFee`
- `lmsCourse`
- `distributorSubscription`

> Note:
> For weekly grouping, each period label is the ISO date of the Monday that starts that week.

## 5.4 Leads Analytics

**Endpoint**

`GET /api/v1/admin/analytics/leads`

### Query params

`?from=&to=`

### Example response

```json
{
  "totalLeads": 203,
  "byStatus": {
    "new": 31,
    "warm": 28,
    "hot": 42,
    "contacted": 39,
    "followup": 24,
    "nurture": 11,
    "lost": 17,
    "converted": 11
  },
  "bySource": {
    "direct": 115,
    "viaDistributor": 88
  },
  "todayFollowups": 6,
  "grouping": "day",
  "chart": [
    { "period": "2026-03-28", "newLeads": 9, "converted": 1 },
    { "period": "2026-03-29", "newLeads": 7, "converted": 0 },
    { "period": "2026-03-30", "newLeads": 12, "converted": 2 },
    { "period": "2026-03-31", "newLeads": 8, "converted": 1 }
  ]
}
```

### Leads status donut chart

Use `byStatus` directly.

Suggested legend labels:

- New
- Warm
- Hot
- Contacted
- Followup
- Nurture
- Lost
- Converted

### Direct vs distributor comparison

Use `bySource`:

- `direct`
- `viaDistributor`

Good chart options:

- donut
- 100% stacked bar
- paired KPI cards

> Note:
> `todayFollowups` is a count for today only. It is not filtered by the selected date range.

## 5.5 Distributor Analytics

**Endpoint**

`GET /api/v1/admin/analytics/distributors`

### Query params

`?from=&to=`

### Example response

```json
{
  "totalDistributors": 12,
  "activeThisMonth": 8,
  "avgLeadsPerDistributor": 27,
  "avgConversionRate": "14.2%",
  "topDistributors": [
    {
      "uuid": "e674b615-8136-4ef2-90dc-5bb7695bd84f",
      "fullName": "Nageshwar Rao",
      "distributorCode": "NAG123",
      "totalLeads": 58,
      "convertedLeads": 9,
      "conversionRate": "15.5%"
    },
    {
      "uuid": "88b6bc79-e4f9-45ab-b699-4f6fd16b3a68",
      "fullName": "Sneha Patel",
      "distributorCode": "SNE456",
      "totalLeads": 34,
      "convertedLeads": 4,
      "conversionRate": "11.8%"
    }
  ],
  "funnelPath": [
    { "stage": "NEW", "count": 19 },
    { "stage": "WARM", "count": 11 },
    { "stage": "HOT", "count": 23 },
    { "stage": "CONTACTED", "count": 18 },
    { "stage": "FOLLOWUP", "count": 9 },
    { "stage": "MARK_AS_CUSTOMER", "count": 13 },
    { "stage": "LOST", "count": 5 }
  ]
}
```

### Top distributors leaderboard

Use `topDistributors` for:

- rank
- distributor name
- code
- total leads
- converted leads
- conversion rate

### Distributor funnel path chart

Use `funnelPath` as a status distribution chart for leads that came through distributors.

> Warning:
> In the current backend, `from/to` mainly affect `funnelPath`. `topDistributors`, `avgLeadsPerDistributor`, and `avgConversionRate` are calculated from all distributor data, while `activeThisMonth` is based on the current calendar month. Do not label the whole payload as strictly date-range scoped.

## 5.6 LMS Analytics

**Endpoint**

`GET /api/v1/admin/lms/analytics`

### Example response

```json
{
  "totalCourses": 9,
  "publishedCourses": 7,
  "totalEnrollments": 128,
  "totalCompletions": 63,
  "completionRate": "49.2%",
  "certificatesIssued": 40,
  "courseBreakdown": [
    {
      "uuid": "0bbeb31f-6a1d-47f0-949f-7c1fd626c2cf",
      "title": "NSI Fundamentals",
      "isFree": true,
      "enrollments": 78,
      "completions": 44,
      "completionRate": "56.4%",
      "avgProgress": 68
    },
    {
      "uuid": "bc0ff6ef-f2c0-4eb6-bd8e-5534464f8d34",
      "title": "Distributor Masterclass",
      "isFree": false,
      "enrollments": 50,
      "completions": 19,
      "completionRate": "38.0%",
      "avgProgress": 47
    }
  ]
}
```

### LMS overview cards

Use:

- Total Courses
- Published Courses
- Total Enrollments
- Total Completions
- Completion Rate
- Certificates Issued

### Per-course completion table

Recommended columns:

- Course
- Free/Paid
- Enrollments
- Completions
- Completion Rate
- Avg Progress

> Note:
> This endpoint does not accept a date range in the current controller.

## 5.7 Date Range Picker Implementation

### UX defaults

- Default preset: `30D`
- Presets:
  - `7D`
  - `30D`
  - `90D`
  - `Custom`

### Smart grouping explanation

- `<= 30 days` -> daily points
- `<= 180 days` -> weekly points
- `> 180 days` -> monthly points

The backend applies this automatically and returns `grouping` on relevant analytics endpoints.

### Maximum allowed range

- `5 years`

### Recommended implementation

1. Store `from` and `to` in page state and URL query params.
2. Default to last 30 full days.
3. On preset click, calculate `from` and `to` immediately.
4. On custom range apply, validate `differenceInDays <= 1825`.
5. Disable Apply if `from > to`.
6. Refetch all analytics widgets in parallel after range changes.

> Warning:
> If the selected range exceeds 5 years, the backend throws `400` with `Maximum date range is 5 years`.

---

## 6. 🎟️ Coupon Management APIs

## 6.1 List Coupons

**Endpoint**

`GET /api/v1/admin/coupons`

### Query params

| Query param | Type | Default | Notes |
|---|---|---:|---|
| `status` | `active \| inactive \| expired \| all` | `active` | Unknown values also fall back to active behavior |

### Response behavior

- Returns an array, not paginated
- Each coupon includes a computed `status` field

### Example response

```json
[
  {
    "uuid": "6d505322-5967-4b8f-bf62-0eaf11a0a8d7",
    "code": "SAVE500",
    "type": "FLAT",
    "value": 500,
    "applicableTo": "COMMITMENT_FEE",
    "usageLimit": 100,
    "usedCount": 14,
    "perUserLimit": 1,
    "expiresAt": "2026-06-30T23:59:59.000Z",
    "isActive": true,
    "createdAt": "2026-03-01T10:00:00.000Z",
    "updatedAt": "2026-03-01T10:00:00.000Z",
    "_count": {
      "uses": 14
    },
    "status": "ACTIVE"
  },
  {
    "uuid": "9cb4f29d-e6cb-4b6c-b3cb-9fe0fe23989f",
    "code": "MARCHFREE",
    "type": "FREE",
    "value": 0,
    "applicableTo": "LMS_COURSE",
    "usageLimit": null,
    "usedCount": 0,
    "perUserLimit": 1,
    "expiresAt": "2026-03-15T23:59:59.000Z",
    "isActive": true,
    "createdAt": "2026-02-28T12:00:00.000Z",
    "updatedAt": "2026-02-28T12:00:00.000Z",
    "_count": {
      "uses": 0
    },
    "status": "EXPIRED"
  }
]
```

### Status badges

| Status | Color |
|---|---|
| `ACTIVE` | green |
| `INACTIVE` | gray |
| `EXPIRED` | red |

### Status filter tabs

- `Active` -> `?status=active`
- `Inactive` -> `?status=inactive`
- `Expired` -> `?status=expired`
- `All` -> `?status=all`

## 6.2 Get Coupon Detail

**Endpoint**

`GET /api/v1/admin/coupons/:uuid`

### Example response

```json
{
  "uuid": "6d505322-5967-4b8f-bf62-0eaf11a0a8d7",
  "code": "SAVE500",
  "type": "FLAT",
  "value": 500,
  "applicableTo": "COMMITMENT_FEE",
  "usageLimit": 100,
  "usedCount": 14,
  "perUserLimit": 1,
  "expiresAt": "2026-06-30T23:59:59.000Z",
  "isActive": true,
  "createdAt": "2026-03-01T10:00:00.000Z",
  "updatedAt": "2026-03-01T10:00:00.000Z",
  "uses": [
    {
      "uuid": "53e9ce60-dfe4-4654-a725-d4f59a94e915",
      "couponUuid": "6d505322-5967-4b8f-bf62-0eaf11a0a8d7",
      "userUuid": "4ef2c2a8-6b04-4130-a13f-7c14cebb52fb",
      "createdAt": "2026-03-18T11:05:00.000Z",
      "user": {
        "uuid": "4ef2c2a8-6b04-4130-a13f-7c14cebb52fb",
        "fullName": "Arjun Mehta",
        "email": "arjun@example.com"
      }
    }
  ],
  "status": "ACTIVE"
}
```

### Usage progress UI

Recommended display:

- If `usageLimit` is set:
  - `usedCount / usageLimit`
- If `usageLimit` is `null`:
  - `usedCount / Unlimited`

Example:

- `14 / 100`
- `3 / Unlimited`

## 6.3 Create Coupon

**Endpoint**

`POST /api/v1/admin/coupons`

### Request body fields

| Field | Type | Required | Rules |
|---|---|---|---|
| `code` | `string` | yes | Uppercase alphanumeric, length `4..20` |
| `type` | `FLAT \| PERCENT \| FREE` | yes | Prisma `CouponType` |
| `value` | `number` | yes | Integer, minimum `0` |
| `applicableTo` | `COMMITMENT_FEE \| LMS_COURSE \| DISTRIBUTOR_SUB \| ALL` | yes | Prisma `CouponScope` |
| `usageLimit` | `number` | no | Integer, minimum `1`; omit for unlimited |
| `perUserLimit` | `number` | no | Integer, minimum `1`; defaults to `1` |
| `expiresAt` | ISO datetime string | no | Must be in the future if provided |

### Example: FLAT coupon

```json
{
  "code": "SAVE500",
  "type": "FLAT",
  "value": 500,
  "applicableTo": "COMMITMENT_FEE",
  "usageLimit": 100,
  "perUserLimit": 1,
  "expiresAt": "2026-06-30T23:59:59.000Z"
}
```

### Example: PERCENT coupon

```json
{
  "code": "APRIL10",
  "type": "PERCENT",
  "value": 10,
  "applicableTo": "ALL",
  "usageLimit": 250,
  "perUserLimit": 1,
  "expiresAt": "2026-04-30T23:59:59.000Z"
}
```

### Example: FREE coupon

```json
{
  "code": "FREECOURSE",
  "type": "FREE",
  "value": 0,
  "applicableTo": "LMS_COURSE",
  "perUserLimit": 1
}
```

### Validation rules

| Rule | Backend behavior |
|---|---|
| Coupon code must be uppercase alphanumeric | Enforced by DTO regex |
| Coupon code is normalized to uppercase and trimmed before save | Enforced by service |
| Duplicate code not allowed | Returns `409` |
| Expiry must be future date | Returns `400` if past or current |
| `usageLimit` omitted | Stored as `null` for unlimited |
| `perUserLimit` omitted | Defaults to `1` |
| `FREE` still requires `value` in current DTO | Use `0` |

> Warning:
> The backend currently enforces `value >= 0`, but does **not** add a backend max of `100` for `PERCENT` coupons. For safe UX, cap percent values at `100` in the admin form.

## 6.4 Update Coupon

**Endpoint**

`PATCH /api/v1/admin/coupons/:uuid`

### Updatable fields only

```json
{
  "isActive": false,
  "expiresAt": "2026-08-31T23:59:59.000Z",
  "usageLimit": 200
}
```

### What cannot be changed

- `code`
- `type`
- `value`
- `applicableTo`

These fields are not present in `UpdateCouponDto`, so the validation pipe strips or rejects them depending on payload shape.

### Important rules

- Cannot reactivate an expired coupon
- `expiresAt` must be a future ISO datetime if provided
- `usageLimit` must be an integer `>= 1` if provided

> Note:
> In the current DTO, you can update `expiresAt` and `usageLimit`, but you cannot clear either back to `null` through this endpoint. Omit the field to keep it unchanged.

### Reactivation error

```json
{
  "statusCode": 400,
  "error": "BadRequestException",
  "message": "Cannot reactivate an expired coupon. Please create a new coupon with a new expiry date.",
  "timestamp": "2026-04-03T12:00:00.000Z",
  "path": "/api/v1/admin/coupons/6d505322-5967-4b8f-bf62-0eaf11a0a8d7"
}
```

## 6.5 Delete Coupon

**Endpoint**

`DELETE /api/v1/admin/coupons/:uuid`

### Smart delete behavior

- If `usedCount > 0` -> soft delete by setting `isActive = false`
- If `usedCount === 0` -> hard delete from DB

### Possible responses

#### Soft delete response

```json
{
  "message": "Coupon deactivated. Cannot hard delete because it has been used."
}
```

#### Hard delete response

```json
{
  "message": "Coupon permanently deleted."
}
```

---

## 7. 🧱 UI Implementation Guide

## 7.1 Admin Sidebar Navigation

Use these routes:

| Sidebar Item | Route |
|---|---|
| Dashboard | `/admin/dashboard` |
| Users | `/admin/users` |
| Distributors | `/admin/distributors` |
| Leads | `/admin/leads` |
| LMS | `/admin/lms` |
| Coupons | `/admin/coupons` |
| Analytics | `/admin/analytics` |
| Settings | `/admin/settings` |

> Note:
> No admin settings API was present in the inspected files. `/admin/settings` can exist as a frontend route, but it will need separate backend scope if it should save anything.

## 7.2 Users List Page

### Build this page with

- Role filter tabs:
  - `All`
  - `USER`
  - `CUSTOMER`
  - `DISTRIBUTOR`
- `Suspended Only` checkbox
  - checked -> `status=suspended`
  - unchecked -> omit `status` unless you also build an Active filter
- Search bar with debounce
- Pagination controls

### Recommended table columns

- Avatar
- Name + Email
- Role badge
- Country
- Progress
- Status
- Actions

### Column implementation notes

- `Avatar`
  - Not returned by API
  - Derive from initials
- `Progress`
  - Safe default: `F:${completedSteps}/${totalSteps}`
  - Optional LMS add-on: load from detail endpoint only
- `Actions`
  - `View`
  - `Suspend` or `Reactivate`
  - `Change Role`

### Search implementation

- Keep local input state
- Debounce request
- Update query string
- Reset page on change

## 7.3 User Detail Page

### Recommended tabs

- `Profile`
  - Personal info
  - Status/role cards
  - Active session count
  - Funnel summary visual
- `Payments`
  - Payment history table
- `LMS`
  - Enrolled courses
  - Progress per course
  - Certificate links
- `Lead`
  - Use `leadDetail` summary first
  - If lead exists, fetch full lead detail for activity history
- `Audit Log`
  - Backend fetch API not available yet

### Practical data-loading plan

1. Load `GET /api/v1/admin/users/:uuid`
2. If `leadDetail?.uuid` exists, optionally load `GET /api/v1/admin/leads/:leadUuid`
3. Render tabs from available sections

> Warning:
> Do not assume `activeSessions` is a list. It is a count.

## 7.4 Distributors Page

### Build this page with

- Summary cards:
  - Total distributors
  - Active this month
  - Average conversion
- Ranked leaderboard table

### Recommended columns

- Rank
- Name
- Join Link
- Total Leads
- Converted
- Rate
- Status
- Actions

### Status rendering

Use join-link status:

- `Active` when `joinLinkActive === true`
- `Deactivated` when `joinLinkActive === false`

### Actions

- View distributor
- Copy join link
- Deactivate link
- Activate link

## 7.5 Analytics Dashboard

### Chart blocks

- Summary cards with growth arrows
- Funnel stages horizontal bar chart
- Decision split donut chart
- Revenue line chart with date filter
- Top distributors table
- Today followups banner

### Good loading strategy

Fetch in parallel:

- `/api/v1/admin/analytics/dashboard`
- `/api/v1/admin/analytics/revenue`
- `/api/v1/admin/analytics/leads`
- `/api/v1/admin/analytics/distributors`
- `/api/v1/admin/lms/analytics`
- `/api/v1/admin/leads/followups/today`

## 7.6 Coupon Management Page

### Build this page with

- Summary cards:
  - Total coupons
  - Active coupons
  - Total redemptions
  - Estimated discount given
- Status tabs:
  - Active
  - Inactive
  - Expired
  - All
- Table columns:
  - Code
  - Type
  - Value
  - Applies To
  - Used / Limit
  - Expiry
  - Status

### Create coupon modal/form

Include fields:

- Code
- Type
- Value
- Applicable To
- Usage Limit
- Per User Limit
- Expiry

### Smart delete

- Always call delete normally
- Use returned message to explain whether it was soft or hard deleted

## 7.7 LMS CMS Page

### Main layout

Use a two-pane or stacked layout:

- Left: course list
- Right: selected course editor

### Suggested page sections

- Courses table
- Create course button
- Publish / unpublish actions
- Section builder
- Lesson builder
- Reorder controls
- LMS analytics summary cards

### Endpoint mapping

| UI action | API |
|---|---|
| Load course list | `GET /api/v1/admin/courses` |
| Load one course | `GET /api/v1/admin/courses/:uuid` |
| Create course | `POST /api/v1/admin/courses` |
| Update course | `PATCH /api/v1/admin/courses/:uuid` |
| Delete course | `DELETE /api/v1/admin/courses/:uuid` |
| Publish | `PATCH /api/v1/admin/courses/:uuid/publish` |
| Unpublish | `PATCH /api/v1/admin/courses/:uuid/unpublish` |
| Add section | `POST /api/v1/admin/courses/:uuid/sections` |
| Reorder sections | `PATCH /api/v1/admin/courses/:courseUuid/sections/reorder` |
| Update section | `PATCH /api/v1/admin/courses/:courseUuid/sections/:sectionUuid` |
| Delete section | `DELETE /api/v1/admin/courses/:courseUuid/sections/:sectionUuid` |
| Add lesson | `POST /api/v1/admin/courses/:courseUuid/sections/:sectionUuid/lessons` |
| Reorder lessons | `PATCH /api/v1/admin/courses/:courseUuid/sections/:sectionUuid/lessons/reorder` |
| Update lesson | `PATCH /api/v1/admin/courses/:courseUuid/sections/:sectionUuid/lessons/:lessonUuid` |
| Delete lesson | `DELETE /api/v1/admin/courses/:courseUuid/sections/:sectionUuid/lessons/:lessonUuid` |

### LMS CMS form notes

- Paid courses require `price`
- Free courses should save `price = 0`
- Course delete is blocked when enrollments exist
- Section and lesson reorder endpoints expect:

```json
{
  "orderedUuids": [
    "uuid-1",
    "uuid-2",
    "uuid-3"
  ]
}
```

> Warning:
> If delete course returns `400`, offer `Unpublish` as the fallback action. That is the intended recovery path in the current backend.

---

## 8. 🚨 Error Handling

### Standard backend error shape

All exceptions pass through the global HTTP exception filter:

```json
{
  "statusCode": 403,
  "error": "ForbiddenException",
  "message": "Insufficient permissions",
  "timestamp": "2026-04-03T12:00:00.000Z",
  "path": "/api/v1/admin/users"
}
```

### Admin-specific errors

| Error | When | Frontend Action |
|---|---|---|
| `401 Unauthorized` | Token expired or invalid | Redirect to login |
| `403 Forbidden` | Logged in but not `SUPER_ADMIN` | Redirect to user dashboard |
| `403 Cannot suspend SUPER_ADMIN` | Trying to suspend admin | Show error toast |
| `403 Cannot change SUPER_ADMIN role` | Role change blocked | Show error toast |
| `400 Already suspended` | Suspend already suspended user | Refresh user data |
| `400 User not suspended` | Reactivate active user | Refresh user data |
| `400 Date range too large` | Analytics range > 5 years | Show max-range warning |
| `400 Cannot reactivate expired coupon` | Coupon expired and reactivation attempted | Show create-new suggestion |
| `400 Cannot delete course with enrollments` | Course has students | Show unpublish option |
| `404 Not found` | Any requested resource is missing | Show not-found state |

### Match these to actual backend messages

| Status | Actual message |
|---|---|
| `403` | `Insufficient permissions` |
| `403` | `Cannot suspend a Super Admin account` |
| `403` | `Cannot change role of a Super Admin` |
| `400` | `User is already suspended` |
| `400` | `User is not suspended` |
| `400` | `Maximum date range is 5 years` |
| `400` | `Cannot reactivate an expired coupon. Please create a new coupon with a new expiry date.` |
| `400` | `Cannot delete course with active enrollments. Unpublish it instead.` |

### Frontend routing rule for 403

Use the error message to decide behavior:

- `Insufficient permissions` -> redirect away from admin
- operation-specific 403s like `Cannot suspend a Super Admin account` -> stay on page and show toast

---

## 9. ✅ Complete Implementation Checklist

### User Management

- [ ] Users list with role/status filters and search
- [ ] Pagination connected to API
- [ ] User detail page with all supported tabs
- [ ] Suspend user with confirmation dialog
- [ ] Reactivate user
- [ ] Change role with confirmation

### Distributor Management

- [ ] Distributors leaderboard list
- [ ] Distributor detail with performance analytics
- [ ] Funnel path bar chart
- [ ] Leads by country display
- [ ] Deactivate/activate join link

### Leads Management (Admin)

- [ ] All leads list with all filters
- [ ] Lead detail with full timeline
- [ ] Status management dropdown
- [ ] Today's followups banner and section
- [ ] View leads by distributor

### Analytics

- [ ] Dashboard with all summary cards
- [ ] Date range picker (`7D` / `30D` / `90D` / `Custom`)
- [ ] Funnel drop-off chart
- [ ] Revenue chart with smart grouping
- [ ] Leads status chart
- [ ] Top distributors leaderboard
- [ ] LMS overview cards

### Coupon Management

- [ ] Coupon list with status filter tabs
- [ ] Create coupon form
- [ ] Edit coupon (allowed fields only)
- [ ] Delete with smart behavior
- [ ] Usage progress display

### LMS CMS

- [ ] Course list page
- [ ] Course detail/editor page
- [ ] Create/update course form
- [ ] Publish/unpublish controls
- [ ] Section CRUD + reorder
- [ ] Lesson CRUD + reorder
- [ ] LMS analytics widget

### Notes for Mihir

- All admin routes require `SUPER_ADMIN`
- Always send `Authorization: Bearer {accessToken}`
- Analytics default to the last 30 days if no date params are sent
- Coupon code must be uppercase when creating
- Pagination response format is `{ items, total, page, limit, totalPages }`
- `displayStatus` is human-readable, `status` is the raw enum
- The user list endpoint does not include LMS summary values for a combined `L:x/y` grid cell
- The user detail endpoint does not include audit log entries; a separate backend endpoint would be needed for a real Audit Log tab

