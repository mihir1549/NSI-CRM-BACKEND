# NSI Analytics Frontend Guide

## Table of Contents

- [1. Introduction](#1-introduction)
- [2. Global Conventions](#2-global-conventions)
- [3. Admin Analytics](#3-admin-analytics)
  - [3.1 Admin Dashboard](#31-admin-dashboard)
  - [3.2 Admin Funnel](#32-admin-funnel)
  - [3.3 Admin Revenue](#33-admin-revenue)
  - [3.4 Admin Leads](#34-admin-leads)
  - [3.5 Admin Distributors](#35-admin-distributors)
  - [3.6 Admin UTM](#36-admin-utm)
- [4. Video Analytics](#4-video-analytics)
  - [4.1 Funnel Videos](#41-funnel-videos)
  - [4.2 LMS Video Summary](#42-lms-video-summary)
  - [4.3 Course Video Analytics](#43-course-video-analytics)
  - [4.4 Lesson Video Analytics](#44-lesson-video-analytics)
  - [4.5 Course Preview Analytics](#45-course-preview-analytics)
- [5. Distributor Analytics](#5-distributor-analytics)
  - [5.1 Distributor Dashboard](#51-distributor-dashboard)
  - [5.2 Distributor UTM](#52-distributor-utm)
  - [5.3 Distributor Users Analytics](#53-distributor-users-analytics)
- [6. Appendix](#6-appendix)

## 1. Introduction

This document is the frontend integration guide for the 14 analytics endpoints listed in scope. Every request shape, response shape, edge case, cache rule, and role rule below was traced from the actual backend TypeScript source, primarily:

- `src/admin/analytics-admin.controller.ts`
- `src/admin/analytics-admin.service.ts`
- `src/admin/video-analytics.controller.ts`
- `src/admin/video-analytics.service.ts`
- `src/distributor/distributor.controller.ts`
- `src/distributor/distributor.service.ts`
- `src/common/filters/http-exception.filter.ts`
- `src/common/utils/generate-periods.util.ts`
- `src/common/video/video-provider.interface.ts`
- `src/common/video/bunny-video.provider.ts`
- `prisma/schema.prisma`

### Base URL

- Development: `http://localhost:3000/api/v1`
- Production: TBD

### Authentication

All 14 endpoints in this guide require an access token in the `Authorization` header.

```http
Authorization: Bearer {accessToken}
```

### Rate Limiting

Global baseline rate limiting is configured in `src/app.module.ts`:

- Default window: `60,000 ms`
- Default limit: `100 requests`
- Practical meaning: `100 req/min per IP` baseline

### Actual Error Response Shape

The app-level exception filter in `src/common/filters/http-exception.filter.ts` returns more fields than the Swagger `ErrorResponse` class documents.

Actual runtime shape:

```ts
export interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;
}
```

Example:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "from date must be before to date",
  "timestamp": "2026-04-21T06:15:03.221Z",
  "path": "/api/v1/admin/analytics/dashboard?from=2026-04-20&to=2026-04-01"
}
```

> Known Issue
> `src/common/dto/responses/error.response.ts` documents only `statusCode`, `message`, and `error`, but the real HTTP response also includes `timestamp` and `path`.

### Pagination Shape

None of the 14 endpoints in this guide are paginated.

For consistency with nearby list endpoints elsewhere in the API, the backend pagination pattern is:

```ts
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

## 2. Global Conventions

### Date Query Params

- The controllers accept ISO date strings.
- The frontend should send plain date values as `YYYY-MM-DD`.
- Validation comes from `@IsDateString()`.
- Unknown query keys are rejected globally because the app uses `whitelist: true` and `forbidNonWhitelisted: true`.

### Growth Calculation

Both `AnalyticsAdminService` and `DistributorService` use the same growth formula:

```ts
if (previous === 0) return current > 0 ? 100 : 0;
return Math.round(((current - previous) / previous) * 100 * 10) / 10;
```

Practical frontend expectation:

- Previous `0`, current `> 0` -> `100`
- Previous `0`, current `0` -> `0`
- Otherwise -> rounded to 1 decimal place

### Auto-Grouping Rule

`src/common/utils/generate-periods.util.ts` drives all time-series grouping:

- `<= 30` days -> daily
- `<= 180` days -> weekly
- `> 180` days -> monthly

Service responses expose these as:

- `"day"`
- `"week"`
- `"month"`

Weekly labels are Monday-start period labels, not arbitrary timestamps.

### Gap Filling

Where an endpoint returns a time series, the backend fills missing periods with zero values by calling `generatePeriods(...)` and then mapping missing buckets to `0`.

This applies to:

- Admin revenue `chart`
- Admin leads `chart`
- Distributor dashboard `trend`

This does not apply to:

- Funnel stage arrays
- UTM breakdown arrays
- Top lists such as `topDistributors` or `topCampaigns`

### Cache and Staleness Rules

- Admin dashboard response uses Nest cache for `5 minutes`
- Bunny-backed helper calls use cache entries with `900000 ms` TTL (`15 minutes`)
- The `15 minute` Bunny cache is used only where the service calls `safeGetAnalytics()` / `safeGetHeatmap()`

Actual per-endpoint behavior is not fully uniform:

| Endpoint | No-query behavior | Cache behavior |
| --- | --- | --- |
| Admin dashboard | Mixed: top-level totals are lifetime, the rest defaults to a rolling 30-day window, `period` is `null` | Whole response cached 5 min |
| Admin funnel | All-time | Live |
| Admin revenue | Rolling last 30 days | Live |
| Admin leads | Rolling last 30 days | Live |
| Admin distributors | Mixed: distributor aggregates are lifetime/current-month, `funnelPath` is range-scoped | Live |
| Admin UTM | All-time | Live |
| Funnel videos | No date params | Bunny fields cached 15 min |
| LMS video summary | No date params | Live |
| Course video analytics | No date params | Live, not cached |
| Lesson video analytics | No date params | Bunny fields cached 15 min |
| Course previews | No date params | Bunny fields cached 15 min |
| Distributor dashboard | Lifetime until both `from` and `to` are provided | Live |
| Distributor UTM | Rolling last 30 days | Live |
| Distributor users analytics | Lifetime until both `from` and `to` are provided | Live |

> Known Issue
> The backend does not implement one single global "no params = lifetime totals" rule. The actual behavior is endpoint-specific, and the frontend must treat each endpoint independently.

### Distributor Scope Rules

For the 3 distributor-scoped endpoints in this guide, the distributor UUID is never accepted from the client.

Actual behavior:

- The controller reads the authenticated user from JWT
- The service hardcodes that authenticated distributor UUID into all Prisma filters
- A distributor cannot choose another distributor UUID through these endpoints
- `403` still applies for wrong role or invalid role state

Practical frontend implication:

- There is no "select distributor" query or path param on these 3 routes
- Tenant scoping is server-enforced

## 3. Admin Analytics

### 3.1 Admin Dashboard

#### A. Overview

This endpoint returns the super-admin platform dashboard with lifetime top-level totals plus a date-scoped overview, funnel summary, device/browser breakdown, and optional explicit period comparison. It is called by `SUPER_ADMIN` users and is typically used on the admin analytics home/dashboard screen.

#### B. Request

- Full URL: `GET http://localhost:3000/api/v1/admin/analytics/dashboard?from={YYYY-MM-DD}&to={YYYY-MM-DD}`
- Method: `GET`
- Required header: `Authorization: Bearer {accessToken}`

Query params:

| Param | Type | Required | Description | Example |
| --- | --- | --- | --- | --- |
| `from` | `string` | No | Inclusive period start, validated as ISO date string | `2026-04-01` |
| `to` | `string` | No | Inclusive period end, validated as ISO date string | `2026-04-15` |

Sample cURL:

```bash
curl "http://localhost:3000/api/v1/admin/analytics/dashboard?from=2026-04-01&to=2026-04-15" \
  -H "Authorization: Bearer SUPER_ADMIN_ACCESS_TOKEN"
```

#### C. Response — Success (200)

Source of truth:

- `src/admin/analytics-admin.service.ts` -> `getDashboard()` -> return block at lines `354-394`

TypeScript shape for frontend integration:

```ts
export interface AdminAnalyticsDashboardResponse {
  totalUsers: number;
  totalLeads: number;
  totalCustomers: number;
  totalRevenue: number;
  totalDistributors: number;
  period: {
    from: string;
    to: string;
    users: number;
    leads: number;
    customers: number;
    revenue: number;
    distributors: number;
    growth: {
      users: number;
      leads: number;
      customers: number;
      revenue: number;
      distributors: number;
    };
  } | null;
  overview: {
    totalUsers: number;
    totalUsersGrowth: number;
    phoneVerified: number;
    paymentsCompleted: number;
    hotLeads: number;
    hotLeadsGrowth: number;
    customers: number;
    customersGrowth: number;
    distributors: number;
    distributorsGrowth: number;
  };
  decisionSplit: {
    yes: number;
    no: number;
    yesPercent: number;
  };
  funnelStages: Array<{
    stage: 'Registered' | 'Email Verified' | 'Phone Verified' | 'Payment Done' | 'Decision YES';
    count: number;
  }>;
  devices: {
    mobile: number;
    desktop: number;
    tablet: number;
  };
  topBrowsers: Array<{
    browser: string;
    percentage: number;
  }>;
  funnelSummary: {
    totalFunnelStarts: number;
    completedPayment: number;
    decidedYes: number;
    decidedNo: number;
    overallConversionRate: number;
  };
}
```

Response when neither `from` nor `to` is present:

- `period` is `null`
- Top-level totals are lifetime
- `overview`, `decisionSplit`, `funnelStages`, `devices`, `topBrowsers`, and `funnelSummary` still use the service's default rolling 30-day range

```json
{
  "totalUsers": 512,
  "totalLeads": 403,
  "totalCustomers": 91,
  "totalRevenue": 1487500,
  "totalDistributors": 28,
  "period": null,
  "overview": {
    "totalUsers": 64,
    "totalUsersGrowth": 18.5,
    "phoneVerified": 49,
    "paymentsCompleted": 27,
    "hotLeads": 18,
    "hotLeadsGrowth": 12.5,
    "customers": 14,
    "customersGrowth": 16.7,
    "distributors": 3,
    "distributorsGrowth": 50
  },
  "decisionSplit": {
    "yes": 22,
    "no": 9,
    "yesPercent": 71
  },
  "funnelStages": [
    {
      "stage": "Registered",
      "count": 64
    },
    {
      "stage": "Email Verified",
      "count": 58
    },
    {
      "stage": "Phone Verified",
      "count": 49
    },
    {
      "stage": "Payment Done",
      "count": 27
    },
    {
      "stage": "Decision YES",
      "count": 22
    }
  ],
  "devices": {
    "mobile": 71,
    "desktop": 24,
    "tablet": 5
  },
  "topBrowsers": [
    {
      "browser": "Chrome",
      "percentage": 62.5
    },
    {
      "browser": "Safari",
      "percentage": 18.8
    },
    {
      "browser": "Edge",
      "percentage": 9.4
    },
    {
      "browser": "Other",
      "percentage": 9.3
    }
  ],
  "funnelSummary": {
    "totalFunnelStarts": 64,
    "completedPayment": 27,
    "decidedYes": 22,
    "decidedNo": 6,
    "overallConversionRate": 34.4
  }
}
```

Response when both `from` and `to` are present:

```json
{
  "totalUsers": 512,
  "totalLeads": 403,
  "totalCustomers": 91,
  "totalRevenue": 1487500,
  "totalDistributors": 28,
  "period": {
    "from": "2026-04-01T00:00:00.000Z",
    "to": "2026-04-15T23:59:59.999Z",
    "users": 42,
    "leads": 31,
    "customers": 8,
    "revenue": 182500,
    "distributors": 2,
    "growth": {
      "users": 16.7,
      "leads": 24,
      "customers": 0,
      "revenue": 20,
      "distributors": 100
    }
  },
  "overview": {
    "totalUsers": 42,
    "totalUsersGrowth": 16.7,
    "phoneVerified": 33,
    "paymentsCompleted": 19,
    "hotLeads": 11,
    "hotLeadsGrowth": 10,
    "customers": 8,
    "customersGrowth": 0,
    "distributors": 2,
    "distributorsGrowth": 100
  },
  "decisionSplit": {
    "yes": 15,
    "no": 6,
    "yesPercent": 71.4
  },
  "funnelStages": [
    {
      "stage": "Registered",
      "count": 42
    },
    {
      "stage": "Email Verified",
      "count": 38
    },
    {
      "stage": "Phone Verified",
      "count": 33
    },
    {
      "stage": "Payment Done",
      "count": 19
    },
    {
      "stage": "Decision YES",
      "count": 15
    }
  ],
  "devices": {
    "mobile": 68,
    "desktop": 27,
    "tablet": 5
  },
  "topBrowsers": [
    {
      "browser": "Chrome",
      "percentage": 57.1
    },
    {
      "browser": "Safari",
      "percentage": 21.4
    },
    {
      "browser": "Edge",
      "percentage": 11.9
    },
    {
      "browser": "Other",
      "percentage": 9.6
    }
  ],
  "funnelSummary": {
    "totalFunnelStarts": 42,
    "completedPayment": 19,
    "decidedYes": 15,
    "decidedNo": 4,
    "overallConversionRate": 35.7
  }
}
```

Field reference:

| Field | Type | Notes |
| --- | --- | --- |
| `totalUsers` | `number` | Lifetime user count, always unfiltered |
| `totalLeads` | `number` | Lifetime lead count, always unfiltered |
| `totalCustomers` | `number` | Lifetime count of leads with status `MARK_AS_CUSTOMER` |
| `totalRevenue` | `number` | Lifetime sum of successful payment `finalAmount` |
| `totalDistributors` | `number` | Lifetime count of users with role `DISTRIBUTOR` |
| `period` | `object \| null` | Populated only when both `from` and `to` are present |
| `period.from` | `string` | ISO string, inclusive start at `00:00:00.000` |
| `period.to` | `string` | ISO string, inclusive end at `23:59:59.999` |
| `period.users` | `number` | Users created in the selected range |
| `period.leads` | `number` | Leads created in the selected range |
| `period.customers` | `number` | Converted leads created in the selected range |
| `period.revenue` | `number` | Successful payment revenue in the selected range |
| `period.distributors` | `number` | Distributors created in the selected range |
| `period.growth.*` | `number` | Previous-period comparison using the shared growth formula |
| `overview.totalUsers` | `number` | Date-scoped, not lifetime |
| `overview.phoneVerified` | `number` | User profiles with `phoneVerifiedAt` in range |
| `overview.paymentsCompleted` | `number` | Funnel progress rows with `paymentCompleted = true` in range |
| `overview.hotLeads` | `number` | Leads with status `HOT` and `updatedAt` in range |
| `overview.customers` | `number` | Users with role `CUSTOMER` and `createdAt` in range |
| `overview.distributors` | `number` | Users with role `DISTRIBUTOR` and `createdAt` in range |
| `decisionSplit.yes` | `number` | Funnel decisions with `decisionAnswer = YES` and `decisionAnsweredAt` in range |
| `decisionSplit.no` | `number` | Funnel decisions with `decisionAnswer = NO` and `decisionAnsweredAt` in range |
| `decisionSplit.yesPercent` | `number` | Rounded numeric percentage, not a string |
| `funnelStages` | `array` | Fixed 5-stage ordered array |
| `devices` | `object` | Always returned as a zero-filled object when no acquisition rows exist |
| `topBrowsers` | `array` | Top 3 browsers plus optional `Other`; empty array when no acquisition rows exist |
| `funnelSummary.totalFunnelStarts` | `number` | Uses registered users in the range |
| `funnelSummary.completedPayment` | `number` | Uses funnel progress payment completions in the range |
| `funnelSummary.decidedYes` | `number` | Uses lead statuses interpreted as "yes-side" outcomes, not the same source as `decisionSplit.yes` |
| `funnelSummary.decidedNo` | `number` | Uses leads in `NURTURE`, not the same source as `decisionSplit.no` |
| `funnelSummary.overallConversionRate` | `number` | `decidedYes / totalFunnelStarts * 100`, rounded to 1 decimal |

> Known Issue
> The Swagger response class in `src/admin/dto/responses/admin.responses.ts` documents `decisionSplit.yesPercent` as a string percentage like `"60.0%"`, but the service returns a numeric value like `71.4`.

> Known Issue
> The Swagger response class marks `devices` and `topBrowsers` as nullable, but `getDashboard()` always returns a device object and an array, defaulting to zeros and `[]`.

#### D. Error responses

| Status | When it happens | Actual response body shape | Frontend display |
| --- | --- | --- | --- |
| `401` | Missing token or invalid token | `{"statusCode":401,"error":"Unauthorized","message":"Unauthorized","timestamp":"...","path":"/api/v1/admin/analytics/dashboard"}` | Redirect to login / show "Session expired" |
| `403` | Authenticated user is not `SUPER_ADMIN` | `{"statusCode":403,"error":"Forbidden","message":"Insufficient permissions","timestamp":"...","path":"/api/v1/admin/analytics/dashboard"}` | Show access denied |
| `400` | Invalid ISO date, `from > to`, or range > 5 years | `{"statusCode":400,"error":"Bad Request","message":"from date must be before to date","timestamp":"...","path":"..."}` or `message: ["from must be a valid ISO 8601 date string"]` | Show inline filter validation |
| `404` | Not used by this route | Not emitted by controller/service | Not applicable |
| `500` | Unexpected server error | `{"statusCode":500,"error":"InternalServerError","message":"Internal server error","timestamp":"...","path":"..."}` | Show generic retry state |

#### E. Edge cases

| Scenario | Actual behavior |
| --- | --- |
| No data at all | Lifetime totals can still be non-zero from old data, but the date-scoped blocks may all be zero; if the whole database is empty everything zero-fills cleanly |
| `from > to` | `400 Bad Request` with message `"from date must be before to date"` |
| Date range > 5 years | `400 Bad Request` with message `"Maximum date range is 5 years"` |
| `from` in the future with valid `to` | Accepted; range-scoped blocks usually return zeros |
| Only `from` provided | `period` stays `null`, but the other dashboard blocks still use `from` + default `to = now` |
| Only `to` provided | `period` stays `null`, but the other dashboard blocks use default `from = to - 30 days` |

#### F. UI integration hints

- Best suited to KPI cards plus a small funnel chart, browser/device donut charts, and a compact overview panel.
- `funnelStages` is ordered categorical data, not a time series.
- `period.growth.*` is percentage-style numeric output.
- `totalRevenue` and `period.revenue` are currency values and should be rendered as `₹`.

#### G. Caching & staleness

- This response is cached server-side for 5 minutes.
- Data can be up to 5 minutes stale.
- Frontend implication: no need for aggressive client-side polling.

#### H. Related endpoints

- `GET /api/v1/admin/analytics/funnel`
- `GET /api/v1/admin/analytics/revenue`
- `GET /api/v1/admin/analytics/leads`
- `GET /api/v1/admin/analytics/utm`

### 3.2 Admin Funnel

#### A. Overview

This endpoint returns the stage-by-stage admin funnel counts with drop-off and conversion percentages. It is called by `SUPER_ADMIN` users and is typically used on the main analytics page or a dedicated funnel-analysis tab.

#### B. Request

- Full URL: `GET http://localhost:3000/api/v1/admin/analytics/funnel?from={YYYY-MM-DD}&to={YYYY-MM-DD}`
- Method: `GET`
- Required header: `Authorization: Bearer {accessToken}`

Query params:

| Param | Type | Required | Description | Example |
| --- | --- | --- | --- | --- |
| `from` | `string` | No | Inclusive start date | `2026-04-01` |
| `to` | `string` | No | Inclusive end date | `2026-04-15` |

Sample cURL:

```bash
curl "http://localhost:3000/api/v1/admin/analytics/funnel?from=2026-04-01&to=2026-04-15" \
  -H "Authorization: Bearer SUPER_ADMIN_ACCESS_TOKEN"
```

#### C. Response — Success (200)

Source of truth:

- `src/admin/analytics-admin.service.ts` -> `getFunnelAnalytics()` -> return block at lines `491-498`

TypeScript shape for frontend integration:

```ts
export interface AdminAnalyticsFunnelResponse {
  period: {
    from: string | null;
    to: string | null;
  };
  grouping: 'day' | 'week' | 'month' | null;
  stages: Array<{
    stage: 'Registered' | 'Email Verified' | 'Phone Verified' | 'Payment Done' | 'Decision YES';
    count: number;
    dropoffFromPrevious: number;
    dropoffPercent: number;
    conversionFromStart: number;
  }>;
}
```

Response when neither `from` nor `to` is present:

```json
{
  "period": {
    "from": null,
    "to": null
  },
  "grouping": null,
  "stages": [
    {
      "stage": "Registered",
      "count": 512,
      "dropoffFromPrevious": 0,
      "dropoffPercent": 0,
      "conversionFromStart": 100
    },
    {
      "stage": "Email Verified",
      "count": 468,
      "dropoffFromPrevious": 44,
      "dropoffPercent": 8.6,
      "conversionFromStart": 91.4
    },
    {
      "stage": "Phone Verified",
      "count": 391,
      "dropoffFromPrevious": 77,
      "dropoffPercent": 16.5,
      "conversionFromStart": 76.4
    },
    {
      "stage": "Payment Done",
      "count": 241,
      "dropoffFromPrevious": 150,
      "dropoffPercent": 38.4,
      "conversionFromStart": 47.1
    },
    {
      "stage": "Decision YES",
      "count": 173,
      "dropoffFromPrevious": 68,
      "dropoffPercent": 28.2,
      "conversionFromStart": 33.8
    }
  ]
}
```

Response when both `from` and `to` are present:

```json
{
  "period": {
    "from": "2026-04-01T00:00:00.000Z",
    "to": "2026-04-15T23:59:59.999Z"
  },
  "grouping": "day",
  "stages": [
    {
      "stage": "Registered",
      "count": 42,
      "dropoffFromPrevious": 0,
      "dropoffPercent": 0,
      "conversionFromStart": 100
    },
    {
      "stage": "Email Verified",
      "count": 38,
      "dropoffFromPrevious": 4,
      "dropoffPercent": 9.5,
      "conversionFromStart": 90.5
    },
    {
      "stage": "Phone Verified",
      "count": 33,
      "dropoffFromPrevious": 5,
      "dropoffPercent": 13.2,
      "conversionFromStart": 78.6
    },
    {
      "stage": "Payment Done",
      "count": 19,
      "dropoffFromPrevious": 14,
      "dropoffPercent": 42.4,
      "conversionFromStart": 45.2
    },
    {
      "stage": "Decision YES",
      "count": 15,
      "dropoffFromPrevious": 4,
      "dropoffPercent": 21.1,
      "conversionFromStart": 35.7
    }
  ]
}
```

Field reference:

| Field | Type | Notes |
| --- | --- | --- |
| `period.from` | `string \| null` | `null` in all-time mode |
| `period.to` | `string \| null` | `null` in all-time mode |
| `grouping` | `'day' \| 'week' \| 'month' \| null` | Present only when both `from` and `to` are provided |
| `stages` | `array` | Always returned in fixed stage order |
| `stages[].stage` | `string` | One of the 5 hard-coded stage labels |
| `stages[].count` | `number` | Count at that stage |
| `stages[].dropoffFromPrevious` | `number` | Previous stage count minus current stage count |
| `stages[].dropoffPercent` | `number` | Rounded numeric percentage, not a string |
| `stages[].conversionFromStart` | `number` | Current stage as percentage of registered count |

> Known Issue
> `src/admin/dto/responses/admin.responses.ts` does not document the `period` object on this response, but `getFunnelAnalytics()` always returns it.

#### D. Error responses

| Status | When it happens | Actual response body shape | Frontend display |
| --- | --- | --- | --- |
| `401` | Missing or invalid token | `{"statusCode":401,"error":"Unauthorized","message":"Unauthorized","timestamp":"...","path":"/api/v1/admin/analytics/funnel"}` | Show login-expired state |
| `403` | User is not `SUPER_ADMIN` | `{"statusCode":403,"error":"Forbidden","message":"Insufficient permissions","timestamp":"...","path":"/api/v1/admin/analytics/funnel"}` | Show access denied |
| `400` | Invalid ISO date or `from > to` | `{"statusCode":400,"error":"Bad Request","message":"from date must be before to date","timestamp":"...","path":"..."}` | Show filter error |
| `404` | Not used by this route | Not emitted by controller/service | Not applicable |
| `500` | Unexpected failure | Standard `InternalServerError` filter shape | Show retry state |

#### E. Edge cases

| Scenario | Actual behavior |
| --- | --- |
| No data | Returns the 5 stages with `0` counts and `grouping: null` in all-time mode |
| `from > to` | `400 Bad Request` |
| `from` in future and valid `to` | Returns zero counts |
| Only `from` provided | Entire request falls back to all-time mode; the partial date is ignored |
| Only `to` provided | Entire request falls back to all-time mode; the partial date is ignored |
| Missing acquisition/device data | Irrelevant for this endpoint |

#### F. UI integration hints

- Best suited to a funnel visualization or ordered bar chart.
- This is categorical stage data, not a trend line.
- `dropoffPercent` and `conversionFromStart` are numeric percentages.
- Admins will likely compare this alongside dashboard and leads analytics.

#### G. Caching & staleness

- Response is live, not cached.

#### H. Related endpoints

- `GET /api/v1/admin/analytics/dashboard`
- `GET /api/v1/admin/analytics/leads`

### 3.3 Admin Revenue

#### A. Overview

This endpoint returns admin revenue totals, growth, revenue-by-type, revenue-by-country, and a zero-filled chart over the selected period. It is called by `SUPER_ADMIN` users and is typically used on an admin revenue tab or finance dashboard.

#### B. Request

- Full URL: `GET http://localhost:3000/api/v1/admin/analytics/revenue?from={YYYY-MM-DD}&to={YYYY-MM-DD}`
- Method: `GET`
- Required header: `Authorization: Bearer {accessToken}`

Query params:

| Param | Type | Required | Description | Example |
| --- | --- | --- | --- | --- |
| `from` | `string` | No | Inclusive start date | `2026-04-01` |
| `to` | `string` | No | Inclusive end date | `2026-04-21` |

Sample cURL:

```bash
curl "http://localhost:3000/api/v1/admin/analytics/revenue?from=2026-04-01&to=2026-04-21" \
  -H "Authorization: Bearer SUPER_ADMIN_ACCESS_TOKEN"
```

#### C. Response — Success (200)

Source of truth:

- `src/admin/analytics-admin.service.ts` -> `getRevenueAnalytics()` -> return block at lines `575-582`

TypeScript shape for frontend integration:

```ts
export interface AdminAnalyticsRevenueResponse {
  totalRevenue: number;
  totalRevenueGrowth: number;
  byType: {
    commitmentFee: number;
    lmsCourse: number;
    distributorSubscription: number;
  };
  byCountry: Array<{
    country: string;
    revenue: number;
  }>;
  grouping: 'day' | 'week' | 'month';
  chart: Array<{
    period: string;
    revenue: number;
  }>;
}
```

Sample JSON response:

```json
{
  "totalRevenue": 384500,
  "totalRevenueGrowth": 22.6,
  "byType": {
    "commitmentFee": 240000,
    "lmsCourse": 96500,
    "distributorSubscription": 48000
  },
  "byCountry": [
    {
      "country": "IN",
      "revenue": 337000
    },
    {
      "country": "AE",
      "revenue": 27500
    },
    {
      "country": "US",
      "revenue": 20000
    }
  ],
  "grouping": "day",
  "chart": [
    {
      "period": "2026-04-01",
      "revenue": 25000
    },
    {
      "period": "2026-04-02",
      "revenue": 0
    },
    {
      "period": "2026-04-03",
      "revenue": 18500
    },
    {
      "period": "2026-04-04",
      "revenue": 42000
    },
    {
      "period": "2026-04-05",
      "revenue": 0
    }
  ]
}
```

Field reference:

| Field | Type | Notes |
| --- | --- | --- |
| `totalRevenue` | `number` | Sum of successful payments in the selected range |
| `totalRevenueGrowth` | `number` | Compared with the immediately preceding equal-length period |
| `byType.commitmentFee` | `number` | Revenue where `paymentType = COMMITMENT_FEE` |
| `byType.lmsCourse` | `number` | Revenue where `paymentType = LMS_COURSE` |
| `byType.distributorSubscription` | `number` | Revenue where `paymentType = DISTRIBUTOR_SUB` |
| `byCountry` | `array` | Sorted descending by revenue |
| `byCountry[].country` | `string` | Uses payment user country, falling back to `"Unknown"` |
| `grouping` | `'day' \| 'week' \| 'month'` | Derived from range length |
| `chart` | `array` | Zero-filled across all periods in the selected range |
| `chart[].period` | `string` | Daily `YYYY-MM-DD`, weekly Monday label, or monthly `YYYY-MM` |
| `chart[].revenue` | `number` | Revenue for that bucket |

#### D. Error responses

| Status | When it happens | Actual response body shape | Frontend display |
| --- | --- | --- | --- |
| `401` | Missing or invalid token | Standard unauthorized filter shape | Show login-expired state |
| `403` | User is not `SUPER_ADMIN` | Standard forbidden filter shape with `"Insufficient permissions"` | Show access denied |
| `400` | Invalid ISO date, `from > to`, range > 5 years | Standard bad-request filter shape | Show invalid-range error |
| `404` | Not used by this route | Not emitted | Not applicable |
| `500` | Unexpected failure | Standard internal-error filter shape | Show retry state |

#### E. Edge cases

| Scenario | Actual behavior |
| --- | --- |
| No data | Returns `totalRevenue: 0`, empty `byCountry`, zeroed `byType`, and a zero-filled `chart` |
| No query params | Uses a rolling default range of `now - 30 days` to `now`; there is no lifetime mode |
| Only `from` provided | Uses `from` plus `to = now` |
| Only `to` provided | Uses `to` plus `from = to - 30 days` |
| `from > to` | `400 Bad Request` |
| `from` in future with valid `to` | Accepted; chart zero-fills |

#### F. UI integration hints

- Best suited to KPI cards, stacked bars for `byType`, and a line or column chart for `chart`.
- `chart` is time-series data.
- Every monetary field is a currency value and should be displayed as `₹`.
- `byCountry` is already aggregated and sorted for table or horizontal bar use.

#### G. Caching & staleness

- Response is live, not cached.

#### H. Related endpoints

- `GET /api/v1/admin/analytics/dashboard`
- `GET /api/v1/admin/analytics/leads`

### 3.4 Admin Leads

#### A. Overview

This endpoint returns admin lead counts by status, source, follow-up count for today, and a zero-filled time series of new leads and converted leads. It is called by `SUPER_ADMIN` users and is typically used on a CRM/lead analytics screen.

#### B. Request

- Full URL: `GET http://localhost:3000/api/v1/admin/analytics/leads?from={YYYY-MM-DD}&to={YYYY-MM-DD}`
- Method: `GET`
- Required header: `Authorization: Bearer {accessToken}`

Query params:

| Param | Type | Required | Description | Example |
| --- | --- | --- | --- | --- |
| `from` | `string` | No | Inclusive start date | `2026-04-01` |
| `to` | `string` | No | Inclusive end date | `2026-04-21` |

Sample cURL:

```bash
curl "http://localhost:3000/api/v1/admin/analytics/leads?from=2026-04-01&to=2026-04-21" \
  -H "Authorization: Bearer SUPER_ADMIN_ACCESS_TOKEN"
```

#### C. Response — Success (200)

Source of truth:

- `src/admin/analytics-admin.service.ts` -> `getLeadsAnalytics()` -> return block at lines `675-682`

TypeScript shape for frontend integration:

```ts
export interface AdminAnalyticsLeadsResponse {
  totalLeads: number;
  byStatus: {
    new: number;
    warm: number;
    hot: number;
    contacted: number;
    followup: number;
    nurture: number;
    lost: number;
    converted: number;
  };
  bySource: {
    direct: number;
    viaDistributor: number;
  };
  todayFollowups: number;
  grouping: 'day' | 'week' | 'month';
  chart: Array<{
    period: string;
    newLeads: number;
    converted: number;
  }>;
}
```

Sample JSON response:

```json
{
  "totalLeads": 94,
  "byStatus": {
    "new": 18,
    "warm": 12,
    "hot": 17,
    "contacted": 14,
    "followup": 11,
    "nurture": 8,
    "lost": 5,
    "converted": 9
  },
  "bySource": {
    "direct": 61,
    "viaDistributor": 33
  },
  "todayFollowups": 7,
  "grouping": "day",
  "chart": [
    {
      "period": "2026-04-01",
      "newLeads": 5,
      "converted": 1
    },
    {
      "period": "2026-04-02",
      "newLeads": 0,
      "converted": 0
    },
    {
      "period": "2026-04-03",
      "newLeads": 8,
      "converted": 2
    }
  ]
}
```

Field reference:

| Field | Type | Notes |
| --- | --- | --- |
| `totalLeads` | `number` | Number of leads created in the selected range |
| `byStatus` | `object` | Status buckets mapped from actual lead statuses |
| `byStatus.converted` | `number` | Count of leads with status `MARK_AS_CUSTOMER` |
| `bySource.direct` | `number` | Leads with no `distributorUuid` |
| `bySource.viaDistributor` | `number` | Leads where `distributorUuid` is set |
| `todayFollowups` | `number` | Distinct leads with `FOLLOWUP_SCHEDULED` activity whose `followupAt` is today; this is independent of the selected date range |
| `grouping` | `'day' \| 'week' \| 'month'` | Derived from selected range |
| `chart` | `array` | Zero-filled by period |
| `chart[].newLeads` | `number` | Count of leads created in that bucket |
| `chart[].converted` | `number` | Count of those leads whose current status is `MARK_AS_CUSTOMER` |

> Known Issue
> `todayFollowups` is not scoped by `from` / `to`. The service always counts follow-ups scheduled for the current day, even if the rest of the response is for a historical or future date range.

#### D. Error responses

| Status | When it happens | Actual response body shape | Frontend display |
| --- | --- | --- | --- |
| `401` | Missing or invalid token | Standard unauthorized filter shape | Show login-expired state |
| `403` | User is not `SUPER_ADMIN` | Standard forbidden filter shape | Show access denied |
| `400` | Invalid ISO date, `from > to`, range > 5 years | Standard bad-request filter shape | Show invalid filter state |
| `404` | Not used by this route | Not emitted | Not applicable |
| `500` | Unexpected failure | Standard internal-error filter shape | Show retry state |

#### E. Edge cases

| Scenario | Actual behavior |
| --- | --- |
| No leads in range | `totalLeads: 0`, zeroed `byStatus`, zeroed `bySource`, zero-filled `chart`; `todayFollowups` can still be non-zero |
| No query params | Uses rolling last 30 days, not lifetime |
| Only `from` provided | Uses `from` plus `to = now` |
| Only `to` provided | Uses `to` plus `from = to - 30 days` |
| `from > to` | `400 Bad Request` |
| Future date range | Lead counts zero-fill; `todayFollowups` still reflects today |

#### F. UI integration hints

- Best suited to KPI cards, a donut for `bySource`, a stacked status table, and a line/column chart for `chart`.
- `chart` is time-series data.
- All values are counts, not money.
- This endpoint is a natural drill-down partner for dashboard and distributor analytics.

#### G. Caching & staleness

- Response is live, not cached.

#### H. Related endpoints

- `GET /api/v1/admin/analytics/dashboard`
- `GET /api/v1/admin/analytics/distributors`

### 3.5 Admin Distributors

#### A. Overview

This endpoint returns high-level distributor performance, top distributors, and a status breakdown of distributor-sourced leads. It is called by `SUPER_ADMIN` users and is typically used on an admin distributor analytics tab.

#### B. Request

- Full URL: `GET http://localhost:3000/api/v1/admin/analytics/distributors?from={YYYY-MM-DD}&to={YYYY-MM-DD}`
- Method: `GET`
- Required header: `Authorization: Bearer {accessToken}`

Query params:

| Param | Type | Required | Description | Example |
| --- | --- | --- | --- | --- |
| `from` | `string` | No | Inclusive start date used by `funnelPath` | `2026-04-01` |
| `to` | `string` | No | Inclusive end date used by `funnelPath` | `2026-04-21` |

Sample cURL:

```bash
curl "http://localhost:3000/api/v1/admin/analytics/distributors?from=2026-04-01&to=2026-04-21" \
  -H "Authorization: Bearer SUPER_ADMIN_ACCESS_TOKEN"
```

#### C. Response — Success (200)

Source of truth:

- `src/admin/analytics-admin.service.ts` -> `getDistributorsAnalytics()` -> return block at lines `850-857`

TypeScript shape for frontend integration:

```ts
export interface AdminAnalyticsDistributorsResponse {
  totalDistributors: number;
  activeThisMonth: number;
  avgLeadsPerDistributor: number;
  avgConversionRate: number;
  topDistributors: Array<{
    uuid: string;
    fullName: string;
    distributorCode: string | null;
    totalLeads: number;
    convertedLeads: number;
    conversionRate: number;
  }>;
  funnelPath: Array<{
    stage: string;
    count: number;
  }>;
}
```

Sample JSON response:

```json
{
  "totalDistributors": 28,
  "activeThisMonth": 11,
  "avgLeadsPerDistributor": 14,
  "avgConversionRate": 18.6,
  "topDistributors": [
    {
      "uuid": "9dd424de-65e6-48f4-baea-99af6407b703",
      "fullName": "Rahul Sharma",
      "distributorCode": "NSI-RAH01",
      "totalLeads": 42,
      "convertedLeads": 11,
      "conversionRate": 26.2
    },
    {
      "uuid": "7e1f06dc-4200-4284-a59c-31dbb5cb20df",
      "fullName": "Neha Verma",
      "distributorCode": "NSI-NEH02",
      "totalLeads": 37,
      "convertedLeads": 7,
      "conversionRate": 18.9
    }
  ],
  "funnelPath": [
    {
      "stage": "NEW",
      "count": 8
    },
    {
      "stage": "HOT",
      "count": 11
    },
    {
      "stage": "CONTACTED",
      "count": 7
    },
    {
      "stage": "FOLLOWUP",
      "count": 5
    },
    {
      "stage": "MARK_AS_CUSTOMER",
      "count": 4
    }
  ]
}
```

Field reference:

| Field | Type | Notes |
| --- | --- | --- |
| `totalDistributors` | `number` | Lifetime count of users with role `DISTRIBUTOR` |
| `activeThisMonth` | `number` | Distributors with at least one lead whose `updatedAt` is in the current calendar month |
| `avgLeadsPerDistributor` | `number` | Rounded integer average over lifetime distributor lead totals |
| `avgConversionRate` | `number` | Numeric percentage, not a string |
| `topDistributors` | `array` | Top 10 distributors sorted by lifetime total leads |
| `topDistributors[].conversionRate` | `number` | Numeric percentage, rounded to 1 decimal |
| `funnelPath` | `array` | Status counts from distributor-sourced leads created in the selected range |
| `funnelPath[].stage` | `string` | Raw lead status string |
| `funnelPath[].count` | `number` | Count in that status |

> Known Issue
> The date range affects only `funnelPath`. The other top-level distributor metrics in this endpoint are lifetime or current-month calculations and do not respect `from` / `to`.

#### D. Error responses

| Status | When it happens | Actual response body shape | Frontend display |
| --- | --- | --- | --- |
| `401` | Missing or invalid token | Standard unauthorized filter shape | Show login-expired state |
| `403` | User is not `SUPER_ADMIN` | Standard forbidden filter shape | Show access denied |
| `400` | Invalid ISO date, `from > to`, range > 5 years | Standard bad-request filter shape | Show invalid-range error |
| `404` | Not used by this route | Not emitted | Not applicable |
| `500` | Unexpected failure | Standard internal-error filter shape | Show retry state |

#### E. Edge cases

| Scenario | Actual behavior |
| --- | --- |
| No distributors | Returns zeros and empty arrays |
| No query params | `funnelPath` defaults to rolling last 30 days; the other metrics remain lifetime/current-month |
| Only `from` provided | `funnelPath` uses `from` plus `to = now` |
| Only `to` provided | `funnelPath` uses `to` plus `from = to - 30 days` |
| `from > to` | `400 Bad Request` |
| Future date range | `funnelPath` is likely empty while `topDistributors` and averages stay populated |

#### F. UI integration hints

- Best suited to KPI cards, a ranked table for `topDistributors`, and a status bar chart for `funnelPath`.
- `funnelPath` is categorical, not time-series.
- Conversion rate values are numeric percentages.
- This is usually paired with leads and UTM analytics rather than used alone.

#### G. Caching & staleness

- Response is live, not cached.

#### H. Related endpoints

- `GET /api/v1/admin/analytics/leads`
- `GET /api/v1/admin/analytics/utm`

### 3.6 Admin UTM

#### A. Overview

This endpoint returns admin UTM source/medium/campaign attribution counts across leads, optionally filtered by date and intended distributor UUID. It is called by `SUPER_ADMIN` users and is typically used beside dashboard and lead-acquisition screens.

#### B. Request

- Full URL: `GET http://localhost:3000/api/v1/admin/analytics/utm?from={YYYY-MM-DD}&to={YYYY-MM-DD}&distributorUuid={uuid}`
- Method: `GET`
- Required header: `Authorization: Bearer {accessToken}`

Query params:

| Param | Type | Required | Description | Example |
| --- | --- | --- | --- | --- |
| `from` | `string` | No | Inclusive start date | `2026-04-01` |
| `to` | `string` | No | Inclusive end date | `2026-04-21` |
| `distributorUuid` | `string` | No | Intended server-side filter for one distributor's leads | `9dd424de-65e6-48f4-baea-99af6407b703` |

Sample cURL:

```bash
curl "http://localhost:3000/api/v1/admin/analytics/utm?from=2026-04-01&to=2026-04-21" \
  -H "Authorization: Bearer SUPER_ADMIN_ACCESS_TOKEN"
```

#### C. Response — Success (200)

Source of truth:

- `src/admin/analytics-admin.service.ts` -> `getUtmAnalytics()` -> return blocks at lines `719-726` and `757-764`

TypeScript shape for frontend integration:

```ts
export interface AdminAnalyticsUtmResponse {
  bySource: Array<{
    source: string;
    leads: number;
  }>;
  byMedium: Array<{
    medium: string;
    leads: number;
  }>;
  byCampaign: Array<{
    campaign: string;
    leads: number;
  }>;
  total: number;
  from: string | null;
  to: string | null;
}
```

Response when neither `from` nor `to` is present:

```json
{
  "bySource": [
    {
      "source": "facebook",
      "leads": 81
    },
    {
      "source": "instagram",
      "leads": 54
    },
    {
      "source": "direct",
      "leads": 22
    }
  ],
  "byMedium": [
    {
      "medium": "cpc",
      "leads": 72
    },
    {
      "medium": "social",
      "leads": 41
    },
    {
      "medium": "direct",
      "leads": 22
    }
  ],
  "byCampaign": [
    {
      "campaign": "april_webinar",
      "leads": 38
    },
    {
      "campaign": "mumbai_launch",
      "leads": 29
    },
    {
      "campaign": "direct",
      "leads": 22
    }
  ],
  "total": 173,
  "from": null,
  "to": null
}
```

Response when both `from` and `to` are present:

```json
{
  "bySource": [
    {
      "source": "facebook",
      "leads": 19
    },
    {
      "source": "instagram",
      "leads": 11
    },
    {
      "source": "direct",
      "leads": 4
    }
  ],
  "byMedium": [
    {
      "medium": "cpc",
      "leads": 17
    },
    {
      "medium": "social",
      "leads": 13
    },
    {
      "medium": "direct",
      "leads": 4
    }
  ],
  "byCampaign": [
    {
      "campaign": "april_webinar",
      "leads": 9
    },
    {
      "campaign": "delhi_intensive",
      "leads": 7
    },
    {
      "campaign": "direct",
      "leads": 4
    }
  ],
  "total": 37,
  "from": "2026-04-01T00:00:00.000Z",
  "to": "2026-04-21T23:59:59.999Z"
}
```

Field reference:

| Field | Type | Notes |
| --- | --- | --- |
| `bySource` | `array` | Sorted descending by lead count |
| `bySource[].source` | `string` | Null/empty `utmSource` becomes `"direct"` |
| `byMedium` | `array` | Sorted descending by lead count |
| `byMedium[].medium` | `string` | Null/empty `utmMedium` becomes `"direct"` |
| `byCampaign` | `array` | Sorted descending by lead count |
| `byCampaign[].campaign` | `string` | Null/empty `utmCampaign` becomes `"direct"` |
| `total` | `number` | Count of lead `userUuid` values, not sum of the breakdown buckets |
| `from` | `string \| null` | `null` in all-time mode |
| `to` | `string \| null` | `null` in all-time mode |

> Known Issue
> `total` is derived from lead records, while `bySource`, `byMedium`, and `byCampaign` are derived from `userAcquisition` rows. If some leads have no acquisition row, the bucket sums can be lower than `total`.

> Known Issue
> Inference from source: the controller accepts `distributorUuid` separately, but the route also validates `@Query() query: AnalyticsQueryDto` under global `forbidNonWhitelisted: true`. That means `distributorUuid` is likely rejected as a non-whitelisted query key before the service runs unless validation behavior is changed.

#### D. Error responses

| Status | When it happens | Actual response body shape | Frontend display |
| --- | --- | --- | --- |
| `401` | Missing or invalid token | Standard unauthorized filter shape | Show login-expired state |
| `403` | User is not `SUPER_ADMIN` | Standard forbidden filter shape | Show access denied |
| `400` | Invalid ISO date or bad filter query | Standard bad-request filter shape | Show invalid filter state |
| `404` | Not used by this route | Not emitted | Not applicable |
| `500` | Unexpected failure | Standard internal-error filter shape | Show retry state |

#### E. Edge cases

| Scenario | Actual behavior |
| --- | --- |
| No matching leads | Returns empty arrays, `total: 0`, and `from` / `to` matching the active mode |
| No query params | All-time mode; no `createdAt` filter is sent to the lead query |
| Only `from` provided | The partial date is ignored and the request behaves like all-time mode |
| Only `to` provided | The partial date is ignored and the request behaves like all-time mode |
| `from > to` | `400 Bad Request` only when both dates are present |
| Future date range | Valid but usually returns empty arrays |

#### F. UI integration hints

- Best suited to grouped tables, horizontal bars, or three ranked lists.
- This is categorical attribution data, not a time series.
- All values are counts.
- Admin dashboards usually load this alongside the dashboard overview and leads analytics.

#### G. Caching & staleness

- Response is live, not cached.

#### H. Related endpoints

- `GET /api/v1/admin/analytics/dashboard`
- `GET /api/v1/admin/analytics/leads`
- `GET /api/v1/admin/analytics/distributors`

## 4. Video Analytics

### 4.1 Funnel Videos

#### A. Overview

This endpoint returns analytics for funnel steps of type `VIDEO_TEXT`, combining NSI step-progress counts with Bunny video analytics when a `bunnyVideoId` exists. It is called by `SUPER_ADMIN` users and is typically used for funnel-content performance analysis.

#### B. Request

- Full URL: `GET http://localhost:3000/api/v1/admin/analytics/funnel-videos`
- Method: `GET`
- Required header: `Authorization: Bearer {accessToken}`

Query params: none

Path params: none

Sample cURL:

```bash
curl "http://localhost:3000/api/v1/admin/analytics/funnel-videos" \
  -H "Authorization: Bearer SUPER_ADMIN_ACCESS_TOKEN"
```

#### C. Response — Success (200)

Source of truth:

- `src/admin/video-analytics.service.ts` -> `FunnelVideoAnalyticsResponse` interface and `getFunnelVideoAnalytics()`

TypeScript shape for frontend integration:

```ts
export interface FunnelVideoAnalyticsResponse {
  summary: {
    totalFunnelViews: number;
    avgCompletionRate: number;
    totalDropOffs: number;
    bestPerformingStep: FunnelStepResult | null;
    worstPerformingStep: FunnelStepResult | null;
  };
  steps: FunnelStepResult[];
}

export interface FunnelStepResult {
  stepUuid: string;
  title: string;
  order: number;
  type: string;
  bunnyVideoId: string | null;
  videoAnalytics: {
    views: number;
    avgWatchPercent: number;
    completionRate: number;
    totalWatchTimeSeconds: number;
    provider: string;
    engagementScore: number | null;
    countryWatchTime: Record<string, number> | null;
    averageWatchTime: number | null;
  } | null;
  nsiData: {
    progressRecords: number;
    completedCount: number;
    dropOffCount: number;
  };
}
```

Sample JSON response:

```json
{
  "summary": {
    "totalFunnelViews": 1260,
    "avgCompletionRate": 58.3,
    "totalDropOffs": 91,
    "bestPerformingStep": {
      "stepUuid": "8f5fcc75-aebd-4fa4-b53b-5776c7c26a11",
      "title": "Welcome Video - Why NSI Works",
      "order": 1,
      "type": "VIDEO_TEXT",
      "bunnyVideoId": "bny_vid_intro_001",
      "videoAnalytics": {
        "views": 480,
        "avgWatchPercent": 72.5,
        "completionRate": 66.4,
        "totalWatchTimeSeconds": 58400,
        "provider": "bunny",
        "engagementScore": 69,
        "countryWatchTime": {
          "IN": 42100,
          "AE": 6300,
          "US": 2900
        },
        "averageWatchTime": 121
      },
      "nsiData": {
        "progressRecords": 430,
        "completedCount": 356,
        "dropOffCount": 74
      }
    },
    "worstPerformingStep": {
      "stepUuid": "02e3f5c4-8c07-4693-bec7-e6c9c89d6e55",
      "title": "Advanced Commitment Breakdown",
      "order": 3,
      "type": "VIDEO_TEXT",
      "bunnyVideoId": "bny_vid_commitment_003",
      "videoAnalytics": {
        "views": 320,
        "avgWatchPercent": 41.2,
        "completionRate": 33.9,
        "totalWatchTimeSeconds": 29100,
        "provider": "bunny",
        "engagementScore": 38,
        "countryWatchTime": {
          "IN": 20900,
          "US": 1800
        },
        "averageWatchTime": 91
      },
      "nsiData": {
        "progressRecords": 295,
        "completedCount": 214,
        "dropOffCount": 81
      }
    }
  },
  "steps": [
    {
      "stepUuid": "8f5fcc75-aebd-4fa4-b53b-5776c7c26a11",
      "title": "Welcome Video - Why NSI Works",
      "order": 1,
      "type": "VIDEO_TEXT",
      "bunnyVideoId": "bny_vid_intro_001",
      "videoAnalytics": {
        "views": 480,
        "avgWatchPercent": 72.5,
        "completionRate": 66.4,
        "totalWatchTimeSeconds": 58400,
        "provider": "bunny",
        "engagementScore": 69,
        "countryWatchTime": {
          "IN": 42100,
          "AE": 6300,
          "US": 2900
        },
        "averageWatchTime": 121
      },
      "nsiData": {
        "progressRecords": 430,
        "completedCount": 356,
        "dropOffCount": 74
      }
    },
    {
      "stepUuid": "02e3f5c4-8c07-4693-bec7-e6c9c89d6e55",
      "title": "Advanced Commitment Breakdown",
      "order": 3,
      "type": "VIDEO_TEXT",
      "bunnyVideoId": "bny_vid_commitment_003",
      "videoAnalytics": {
        "views": 320,
        "avgWatchPercent": 41.2,
        "completionRate": 33.9,
        "totalWatchTimeSeconds": 29100,
        "provider": "bunny",
        "engagementScore": 38,
        "countryWatchTime": {
          "IN": 20900,
          "US": 1800
        },
        "averageWatchTime": 91
      },
      "nsiData": {
        "progressRecords": 295,
        "completedCount": 214,
        "dropOffCount": 81
      }
    }
  ]
}
```

Field reference:

| Field | Type | Notes |
| --- | --- | --- |
| `summary.totalFunnelViews` | `number` | Sum of `views` across steps whose `videoAnalytics` is not `null` |
| `summary.avgCompletionRate` | `number` | Average of step completion rates, rounded to 1 decimal |
| `summary.totalDropOffs` | `number` | Sum of `nsiData.dropOffCount` across all steps |
| `summary.bestPerformingStep` | `FunnelStepResult \| null` | Highest `completionRate`; `null` when no Bunny analytics exists |
| `summary.worstPerformingStep` | `FunnelStepResult \| null` | Lowest `completionRate`; can be `null` when only one step has analytics or when best and worst are the same step |
| `steps` | `array` | Ordered by funnel step `order` ascending |
| `steps[].title` | `string` | Falls back to `"(untitled)"` if step content title is missing |
| `steps[].bunnyVideoId` | `string \| null` | `null` when the funnel step has no Bunny video attached |
| `steps[].videoAnalytics` | `object \| null` | `null` when no Bunny video exists or the Bunny call failed |
| `steps[].nsiData.progressRecords` | `number` | Count of all `stepProgress` rows for the step |
| `steps[].nsiData.completedCount` | `number` | Count of completed `stepProgress` rows |
| `steps[].nsiData.dropOffCount` | `number` | `progressRecords - completedCount` |

##### Bunny-sourced vs NSI-DB-sourced fields

NSI DB sourced:

- `steps[].stepUuid`
- `steps[].title`
- `steps[].order`
- `steps[].type`
- `steps[].bunnyVideoId`
- `steps[].nsiData.*`

Bunny sourced and nullable on provider failure:

- `steps[].videoAnalytics.views`
- `steps[].videoAnalytics.avgWatchPercent`
- `steps[].videoAnalytics.completionRate`
- `steps[].videoAnalytics.totalWatchTimeSeconds`
- `steps[].videoAnalytics.provider`
- `steps[].videoAnalytics.engagementScore`
- `steps[].videoAnalytics.countryWatchTime`
- `steps[].videoAnalytics.averageWatchTime`

#### D. Error responses

| Status | When it happens | Actual response body shape | Frontend display |
| --- | --- | --- | --- |
| `401` | Missing or invalid token | Standard unauthorized filter shape | Show login-expired state |
| `403` | User is not `SUPER_ADMIN` | Standard forbidden filter shape | Show access denied |
| `400` | Not used by this route | No request validation path | Not applicable |
| `404` | Not used by this route | Not emitted | Not applicable |
| `500` | Unexpected failure outside the guarded Bunny fallback | Standard internal-error filter shape | Show retry state |

#### E. Edge cases

| Scenario | Actual behavior |
| --- | --- |
| No funnel video steps | Returns `summary` with zeros and `steps: []` |
| Step has no Bunny video | `videoAnalytics: null`, `nsiData` still populated |
| Bunny analytics call fails | `videoAnalytics: null` for that step; response still succeeds |
| Only one step has analytics | `bestPerformingStep` is that step and `worstPerformingStep` is `null` |
| All steps have the same completion rate | `worstPerformingStep` becomes `null` |
| No step progress rows | `nsiData` counts are all zero |

#### F. UI integration hints

- Best suited to a ranked step table plus KPI cards and small comparison bars.
- This is categorical performance data, not time-series data.
- `avgWatchPercent`, `completionRate`, and `engagementScore` are percentage-style metrics.
- `totalWatchTimeSeconds` and `averageWatchTime` are durations.

#### G. Caching & staleness

- Bunny-sourced fields in this response are cached server-side for 15 minutes.
- NSI DB fields are live.
- Frontend implication: avoid aggressive polling just to refresh Bunny metrics.

#### H. Related endpoints

- `GET /api/v1/admin/analytics/dashboard`
- `GET /api/v1/admin/analytics/lms-videos`

### 4.2 LMS Video Summary

#### A. Overview

This endpoint returns course-level LMS summary analytics across all published courses using NSI database data only. It is called by `SUPER_ADMIN` users and is typically used on an LMS analytics overview page.

#### B. Request

- Full URL: `GET http://localhost:3000/api/v1/admin/analytics/lms-videos`
- Method: `GET`
- Required header: `Authorization: Bearer {accessToken}`

Query params: none

Path params: none

Sample cURL:

```bash
curl "http://localhost:3000/api/v1/admin/analytics/lms-videos" \
  -H "Authorization: Bearer SUPER_ADMIN_ACCESS_TOKEN"
```

#### C. Response — Success (200)

Source of truth:

- `src/admin/video-analytics.service.ts` -> `LmsVideoSummaryResponse` and `getLmsVideoSummary()`

TypeScript shape for frontend integration:

```ts
export interface LmsVideoSummaryResponse {
  summary: {
    totalCourses: number;
    totalEnrollments: number;
    avgCourseCompletionRate: number;
    totalCertificatesIssued: number;
    totalVideoWatchTimeSeconds: number;
  };
  courses: Array<{
    courseUuid: string;
    title: string;
    isPublished: boolean;
    enrollments: number;
    completions: number;
    completionRate: number;
    certificatesIssued: number;
    totalLessons: number;
    avgLessonCompletionRate: number;
    totalVideoWatchTimeSeconds: number;
    provider: 'bunny' | 'direct';
  }>;
}
```

Sample JSON response:

```json
{
  "summary": {
    "totalCourses": 3,
    "totalEnrollments": 214,
    "avgCourseCompletionRate": 42.6,
    "totalCertificatesIssued": 57,
    "totalVideoWatchTimeSeconds": 942300
  },
  "courses": [
    {
      "courseUuid": "decaebb6-4636-4bc0-9617-163765f27173",
      "title": "NSI Options Foundation",
      "isPublished": true,
      "enrollments": 124,
      "completions": 58,
      "completionRate": 46.8,
      "certificatesIssued": 41,
      "totalLessons": 14,
      "avgLessonCompletionRate": 52.3,
      "totalVideoWatchTimeSeconds": 612400,
      "provider": "bunny"
    },
    {
      "courseUuid": "76726c62-fb4e-4730-ac0b-7da24810bd8b",
      "title": "NSI Sales Sprint",
      "isPublished": true,
      "enrollments": 90,
      "completions": 33,
      "completionRate": 36.7,
      "certificatesIssued": 16,
      "totalLessons": 9,
      "avgLessonCompletionRate": 41.8,
      "totalVideoWatchTimeSeconds": 329900,
      "provider": "direct"
    }
  ]
}
```

Field reference:

| Field | Type | Notes |
| --- | --- | --- |
| `summary.totalCourses` | `number` | Count of published courses only |
| `summary.totalEnrollments` | `number` | Sum across the returned course rows |
| `summary.avgCourseCompletionRate` | `number` | Average of each course row's `completionRate` |
| `summary.totalCertificatesIssued` | `number` | Sum across returned course rows |
| `summary.totalVideoWatchTimeSeconds` | `number` | Sum of NSI `lessonProgress.watchedSeconds`, not Bunny data |
| `courses` | `array` | Ordered by course `createdAt` descending |
| `courses[].provider` | `'bunny' \| 'direct'` | Derived from whether any lesson in that course has a `bunnyVideoId`; this endpoint does not call Bunny |

##### Bunny-sourced vs NSI-DB-sourced fields

This endpoint does not call Bunny at all.

NSI DB sourced:

- All `summary` fields
- All `courses[]` fields

Derived field:

- `courses[].provider` is computed from lesson configuration, not from a live Bunny request

#### D. Error responses

| Status | When it happens | Actual response body shape | Frontend display |
| --- | --- | --- | --- |
| `401` | Missing or invalid token | Standard unauthorized filter shape | Show login-expired state |
| `403` | User is not `SUPER_ADMIN` | Standard forbidden filter shape | Show access denied |
| `400` | Not used by this route | No validation path | Not applicable |
| `404` | Not used by this route | Not emitted | Not applicable |
| `500` | Unexpected failure | Standard internal-error filter shape | Show retry state |

#### E. Edge cases

| Scenario | Actual behavior |
| --- | --- |
| No published courses | Returns `summary` zeros and `courses: []` |
| Course has no lessons | `totalLessons: 0`, `avgLessonCompletionRate: 0`, `totalVideoWatchTimeSeconds: 0` |
| Course has Bunny videos | `provider: "bunny"` only; still no Bunny API call |
| No enrollment rows | Completion and certificate counts stay zero |
| No lesson progress | Watch-time and lesson completion values stay zero |
| Unpublished course exists | Omitted completely |

#### F. UI integration hints

- Best suited to a course summary table with sortable columns.
- This is not time-series data.
- Completion metrics are percentage-style numbers.
- `totalVideoWatchTimeSeconds` is duration data, not currency.

#### G. Caching & staleness

- Response is live, not cached.

#### H. Related endpoints

- `GET /api/v1/admin/analytics/lms-videos/:courseUuid`
- `GET /api/v1/admin/analytics/course-previews`

### 4.3 Course Video Analytics

#### A. Overview

This endpoint returns per-lesson analytics for a specific course, combining NSI lesson progress with Bunny analytics when each lesson has a Bunny video. It is called by `SUPER_ADMIN` users and is typically used as a drill-down from the LMS summary screen.

#### B. Request

- Full URL: `GET http://localhost:3000/api/v1/admin/analytics/lms-videos/{courseUuid}`
- Method: `GET`
- Required header: `Authorization: Bearer {accessToken}`

Path params:

| Param | Type | Required | Description | Example |
| --- | --- | --- | --- | --- |
| `courseUuid` | `string` | Yes | Course UUID | `decaebb6-4636-4bc0-9617-163765f27173` |

Sample cURL:

```bash
curl "http://localhost:3000/api/v1/admin/analytics/lms-videos/decaebb6-4636-4bc0-9617-163765f27173" \
  -H "Authorization: Bearer SUPER_ADMIN_ACCESS_TOKEN"
```

#### C. Response — Success (200)

Source of truth:

- `src/admin/video-analytics.service.ts` -> `CourseVideoAnalyticsResponse` and `getCourseVideoAnalytics()`

TypeScript shape for frontend integration:

```ts
export interface CourseVideoAnalyticsResponse {
  course: {
    uuid: string;
    title: string;
    enrollments: number;
    completions: number;
    completionRate: number;
    certificatesIssued: number;
    avgProgressPercent: number;
    totalVideoWatchTimeSeconds: number;
  };
  lessons: Array<{
    lessonUuid: string;
    title: string;
    order: number;
    sectionTitle: string;
    bunnyVideoId: string | null;
    nsiData: {
      startedCount: number;
      completedCount: number;
      completionRate: number;
      avgProgressPercent: number;
      dataSource: 'nsi_db';
    };
    videoAnalytics: {
      views: number;
      avgWatchPercent: number;
      totalWatchTimeSeconds: number;
      provider: string;
      dataSource: 'bunny_stream';
      engagementScore: number | null;
      countryWatchTime: Record<string, number> | null;
      averageWatchTime: number | null;
    } | null;
  }>;
}
```

Sample JSON response:

```json
{
  "course": {
    "uuid": "decaebb6-4636-4bc0-9617-163765f27173",
    "title": "NSI Options Foundation",
    "enrollments": 124,
    "completions": 58,
    "completionRate": 46.8,
    "certificatesIssued": 41,
    "avgProgressPercent": 63.4,
    "totalVideoWatchTimeSeconds": 612400
  },
  "lessons": [
    {
      "lessonUuid": "670e1f7c-2f83-444b-b832-c4a77f36ec40",
      "title": "What Is Options Trading?",
      "order": 1,
      "sectionTitle": "Module 1 - Foundations",
      "bunnyVideoId": "bny_course_001_lesson_001",
      "nsiData": {
        "startedCount": 118,
        "completedCount": 84,
        "completionRate": 71.2,
        "avgProgressPercent": 76.4,
        "dataSource": "nsi_db"
      },
      "videoAnalytics": {
        "views": 164,
        "avgWatchPercent": 74.8,
        "totalWatchTimeSeconds": 21840,
        "provider": "bunny",
        "dataSource": "bunny_stream",
        "engagementScore": 73,
        "countryWatchTime": {
          "IN": 15680,
          "AE": 2240
        },
        "averageWatchTime": 133
      }
    },
    {
      "lessonUuid": "8740cf3e-7940-4e36-b032-993ded594d89",
      "title": "Strike Price and Premium",
      "order": 2,
      "sectionTitle": "Module 1 - Foundations",
      "bunnyVideoId": null,
      "nsiData": {
        "startedCount": 112,
        "completedCount": 79,
        "completionRate": 70.5,
        "avgProgressPercent": 68.1,
        "dataSource": "nsi_db"
      },
      "videoAnalytics": null
    }
  ]
}
```

Field reference:

| Field | Type | Notes |
| --- | --- | --- |
| `course.uuid` | `string` | Exact course UUID from DB |
| `course.completionRate` | `number` | Course enrollment completion rate |
| `course.avgProgressPercent` | `number` | Average of lesson-level watched-seconds percentage for lessons with a known duration |
| `course.totalVideoWatchTimeSeconds` | `number` | Sum of all NSI `lessonProgress.watchedSeconds` across course lessons |
| `lessons` | `array` | Ordered by section order, then lesson order |
| `lessons[].sectionTitle` | `string` | Included so the frontend can group rows without another request |
| `lessons[].bunnyVideoId` | `string \| null` | `null` when the lesson is not Bunny-backed |
| `lessons[].nsiData.dataSource` | `'nsi_db'` | Literal string from the service |
| `lessons[].videoAnalytics.dataSource` | `'bunny_stream'` | Literal string from the service |
| `lessons[].videoAnalytics` | `object \| null` | `null` when Bunny is not configured for the lesson or the Bunny call fails |

##### Bunny-sourced vs NSI-DB-sourced fields

NSI DB sourced:

- `course.*`
- `lessons[].lessonUuid`
- `lessons[].title`
- `lessons[].order`
- `lessons[].sectionTitle`
- `lessons[].bunnyVideoId`
- `lessons[].nsiData.*`

Bunny sourced and nullable on failure:

- `lessons[].videoAnalytics.*`

#### D. Error responses

| Status | When it happens | Actual response body shape | Frontend display |
| --- | --- | --- | --- |
| `401` | Missing or invalid token | Standard unauthorized filter shape | Show login-expired state |
| `403` | User is not `SUPER_ADMIN` | Standard forbidden filter shape | Show access denied |
| `400` | Not used by this route | No param validation pipe on `courseUuid` | Not applicable |
| `404` | `courseUuid` does not exist | `{"statusCode":404,"error":"Not Found","message":"Course not found","timestamp":"...","path":"..."}` | Show "Course not found" |
| `500` | Unexpected failure | Standard internal-error filter shape | Show retry state |

#### E. Edge cases

| Scenario | Actual behavior |
| --- | --- |
| Course does not exist | `404 Not Found` with `"Course not found"` |
| Course has no lessons | `lessons: []`, course-level counts still returned |
| Lesson has no Bunny video | `videoAnalytics: null`, `nsiData` still returned |
| Bunny analytics call fails | `videoAnalytics: null` only for that lesson; endpoint still returns `200` |
| Invalid UUID format | No `ParseUUIDPipe` is used; the service simply looks up the string and usually returns `404` |
| Unpublished course UUID | Still returns if the course exists; this endpoint does not enforce `isPublished` |

#### F. UI integration hints

- Best suited to a lesson analytics table within a course drill-down screen.
- This is categorical row data, not time-series data.
- `completionRate`, `avgProgressPercent`, `avgWatchPercent`, and `engagementScore` are percentage-style values.
- `totalVideoWatchTimeSeconds` and `averageWatchTime` are durations.

#### G. Caching & staleness

- Response is live, not cached.
- Bunny metrics in this specific endpoint are fetched directly and do not use the shared 15-minute Bunny cache helper.

#### H. Related endpoints

- `GET /api/v1/admin/analytics/lms-videos`
- `GET /api/v1/admin/analytics/lms-videos/:courseUuid/lessons/:lessonUuid`

### 4.4 Lesson Video Analytics

#### A. Overview

This endpoint returns lesson-level detail for one course lesson, including NSI progress, Bunny analytics, and Bunny heatmap data when the lesson is Bunny-backed. It is called by `SUPER_ADMIN` users and is typically used as the deepest LMS analytics drill-down.

#### B. Request

- Full URL: `GET http://localhost:3000/api/v1/admin/analytics/lms-videos/{courseUuid}/lessons/{lessonUuid}`
- Method: `GET`
- Required header: `Authorization: Bearer {accessToken}`

Path params:

| Param | Type | Required | Description | Example |
| --- | --- | --- | --- | --- |
| `courseUuid` | `string` | Yes | Course UUID | `decaebb6-4636-4bc0-9617-163765f27173` |
| `lessonUuid` | `string` | Yes | Lesson UUID | `670e1f7c-2f83-444b-b832-c4a77f36ec40` |

Sample cURL:

```bash
curl "http://localhost:3000/api/v1/admin/analytics/lms-videos/decaebb6-4636-4bc0-9617-163765f27173/lessons/670e1f7c-2f83-444b-b832-c4a77f36ec40" \
  -H "Authorization: Bearer SUPER_ADMIN_ACCESS_TOKEN"
```

#### C. Response — Success (200)

Source of truth:

- `src/admin/video-analytics.service.ts` -> `LessonVideoAnalyticsResponse` and `getLessonVideoAnalytics()`

TypeScript shape for frontend integration:

```ts
export interface LessonVideoAnalyticsResponse {
  lesson: {
    uuid: string;
    title: string;
    videoDuration: number | null;
    bunnyVideoId: string | null;
  };
  nsiData: {
    startedCount: number;
    completedCount: number;
    completionRate: number;
    avgProgressPercent: number;
    progressDistribution: {
      '0-25': number;
      '25-50': number;
      '50-75': number;
      '75-100': number;
    };
    dataSource: 'nsi_db';
  };
  videoAnalytics: {
    views: number;
    avgWatchPercent: number;
    totalWatchTimeSeconds: number;
    topCountries: Record<string, number>;
    provider: string;
    dataSource: 'bunny_stream';
    engagementScore: number | null;
    countryWatchTime: Record<string, number> | null;
    averageWatchTime: number | null;
  } | null;
  heatmap: {
    videoId: string;
    heatmap: number[];
    provider: string;
  } | null;
}
```

Sample JSON response:

```json
{
  "lesson": {
    "uuid": "670e1f7c-2f83-444b-b832-c4a77f36ec40",
    "title": "What Is Options Trading?",
    "videoDuration": 180,
    "bunnyVideoId": "bny_course_001_lesson_001"
  },
  "nsiData": {
    "startedCount": 118,
    "completedCount": 84,
    "completionRate": 71.2,
    "avgProgressPercent": 76.4,
    "progressDistribution": {
      "0-25": 11,
      "25-50": 16,
      "50-75": 27,
      "75-100": 64
    },
    "dataSource": "nsi_db"
  },
  "videoAnalytics": {
    "views": 164,
    "avgWatchPercent": 74.8,
    "totalWatchTimeSeconds": 21840,
    "topCountries": {
      "IN": 132,
      "AE": 21,
      "US": 9
    },
    "provider": "bunny",
    "dataSource": "bunny_stream",
    "engagementScore": 73,
    "countryWatchTime": {
      "IN": 15680,
      "AE": 2240,
      "US": 760
    },
    "averageWatchTime": 133
  },
  "heatmap": {
    "videoId": "bny_course_001_lesson_001",
    "heatmap": [
      1,
      0.98,
      0.97,
      0.97,
      0.96,
      0.95,
      0.93,
      0.9
    ],
    "provider": "bunny"
  }
}
```

Field reference:

| Field | Type | Notes |
| --- | --- | --- |
| `lesson.videoDuration` | `number \| null` | Duration in seconds from the course lesson row |
| `nsiData.startedCount` | `number` | Count of lesson progress rows |
| `nsiData.completedCount` | `number` | Count of completed lesson progress rows |
| `nsiData.completionRate` | `number` | `completed / started * 100`, rounded to 1 decimal |
| `nsiData.avgProgressPercent` | `number` | Average watched seconds divided by `videoDuration` |
| `nsiData.progressDistribution` | `object` | Bucketed using watched-seconds percentage |
| `videoAnalytics.topCountries` | `Record<string, number>` | Bunny country-view counts |
| `videoAnalytics.countryWatchTime` | `Record<string, number> \| null` | Bunny watch-time-by-country map |
| `videoAnalytics.averageWatchTime` | `number \| null` | Seconds per viewer average as returned by the provider |
| `heatmap` | `object \| null` | `null` when the lesson has no Bunny video or when Bunny heatmap fetch fails |

##### Bunny-sourced vs NSI-DB-sourced fields

NSI DB sourced:

- `lesson.*`
- `nsiData.*`

Bunny sourced and nullable on failure:

- `videoAnalytics.*`
- `heatmap`

##### Heatmap details

- Runtime type: `number[]`
- Array index: second offset within the video
- `null` when Bunny heatmap fetch fails or when the lesson has no Bunny video
- The backend zero-fills missing seconds between `0` and the highest returned second
- The array can be shorter than `videoDuration` because Bunny omits trailing seconds past the furthest watched point

> Known Issue
> The backend forwards Bunny heatmap values without rescaling. The mock provider uses decimal fractions like `1.0`, `0.9`, `0.8`, so the frontend should not assume the array is normalized to `0-100` unless production data confirms that.

#### D. Error responses

| Status | When it happens | Actual response body shape | Frontend display |
| --- | --- | --- | --- |
| `401` | Missing or invalid token | Standard unauthorized filter shape | Show login-expired state |
| `403` | User is not `SUPER_ADMIN` | Standard forbidden filter shape | Show access denied |
| `400` | Not used by this route | No UUID validation pipe | Not applicable |
| `404` | Lesson does not exist or does not belong to the provided course | `{"statusCode":404,"error":"Not Found","message":"Lesson not found"}` or `{"message":"Lesson not found in this course"}` with the same filter wrapper fields | Show lesson-not-found state |
| `500` | Unexpected failure | Standard internal-error filter shape | Show retry state |

#### E. Edge cases

| Scenario | Actual behavior |
| --- | --- |
| Lesson does not exist | `404 Not Found`, `"Lesson not found"` |
| Lesson belongs to another course | `404 Not Found`, `"Lesson not found in this course"` |
| No Bunny video ID | `videoAnalytics: null` and `heatmap: null` |
| Bunny heatmap fails | `heatmap: null`, `videoAnalytics` can still be populated |
| `videoDuration` is `null` or `0` | `avgProgressPercent: 0`; all progress records are bucketed into `'0-25'` |
| No progress records | All NSI counts are zero and all distribution buckets are zero |

#### F. UI integration hints

- Best suited to a detail drawer/page with KPI cards, a progress-distribution bar, country table, and retention chart.
- `heatmap` is sequential per-second data.
- `completionRate`, `avgProgressPercent`, `avgWatchPercent`, and `engagementScore` are percentage-style metrics.
- `averageWatchTime` and `totalWatchTimeSeconds` are durations.

#### G. Caching & staleness

- Bunny-sourced fields in this response are cached server-side for 15 minutes.
- NSI DB fields are live.
- Frontend implication: no need for aggressive polling.

#### H. Related endpoints

- `GET /api/v1/admin/analytics/lms-videos/:courseUuid`
- `GET /api/v1/admin/analytics/course-previews`

### 4.5 Course Preview Analytics

#### A. Overview

This endpoint returns preview-video analytics for published courses, combining course enrollment counts with Bunny preview analytics when a preview Bunny video exists. It is called by `SUPER_ADMIN` users and is typically used to measure preview-to-enrollment performance.

#### B. Request

- Full URL: `GET http://localhost:3000/api/v1/admin/analytics/course-previews`
- Method: `GET`
- Required header: `Authorization: Bearer {accessToken}`

Query params: none

Path params: none

Sample cURL:

```bash
curl "http://localhost:3000/api/v1/admin/analytics/course-previews" \
  -H "Authorization: Bearer SUPER_ADMIN_ACCESS_TOKEN"
```

#### C. Response — Success (200)

Source of truth:

- `src/admin/video-analytics.service.ts` -> `CoursePreviewAnalyticsResponse` and `getCoursePreviewAnalytics()`

TypeScript shape for frontend integration:

```ts
export interface CoursePreviewAnalyticsResponse {
  courses: Array<{
    courseUuid: string;
    title: string;
    previewBunnyVideoId: string | null;
    previewAnalytics: {
      views: number;
      avgWatchPercent: number;
      provider: string;
      engagementScore: number | null;
      countryWatchTime: Record<string, number> | null;
      averageWatchTime: number | null;
    } | null;
    nsiData: {
      previewViews: number;
      enrollments: number;
      conversionRate: number | null;
    };
  }>;
}
```

Sample JSON response:

```json
{
  "courses": [
    {
      "courseUuid": "decaebb6-4636-4bc0-9617-163765f27173",
      "title": "NSI Options Foundation",
      "previewBunnyVideoId": "bny_preview_001",
      "previewAnalytics": {
        "views": 920,
        "avgWatchPercent": 58.6,
        "provider": "bunny",
        "engagementScore": 54,
        "countryWatchTime": {
          "IN": 40210,
          "AE": 7310
        },
        "averageWatchTime": 84
      },
      "nsiData": {
        "previewViews": 920,
        "enrollments": 124,
        "conversionRate": 13.5
      }
    },
    {
      "courseUuid": "76726c62-fb4e-4730-ac0b-7da24810bd8b",
      "title": "NSI Sales Sprint",
      "previewBunnyVideoId": null,
      "previewAnalytics": null,
      "nsiData": {
        "previewViews": 90,
        "enrollments": 90,
        "conversionRate": 100
      }
    }
  ]
}
```

Field reference:

| Field | Type | Notes |
| --- | --- | --- |
| `courses` | `array` | Published courses only, ordered by `createdAt` descending |
| `previewBunnyVideoId` | `string \| null` | Null when the course has no preview Bunny video |
| `previewAnalytics` | `object \| null` | Null when there is no preview video or the Bunny call fails |
| `nsiData.enrollments` | `number` | Course enrollment count from NSI DB |
| `nsiData.previewViews` | `number` | Uses Bunny `views` when analytics exists; otherwise falls back to `enrollments` |
| `nsiData.conversionRate` | `number \| null` | `enrollments / previewViews * 100`, rounded to 1 decimal, or `null` when `previewViews` is `0` |

##### Bunny-sourced vs NSI-DB-sourced fields

NSI DB sourced:

- `courseUuid`
- `title`
- `previewBunnyVideoId`
- `nsiData.enrollments`

Bunny sourced and nullable on failure:

- `previewAnalytics.*`

Derived / mixed fields:

- `nsiData.previewViews`
- `nsiData.conversionRate`

> Known Issue
> `nsiData.previewViews` is not purely NSI data. When Bunny analytics is missing or the course has no preview Bunny video, the service falls back to `enrollments` as `previewViews`. That makes `conversionRate` become `100` whenever `enrollments > 0`.

#### D. Error responses

| Status | When it happens | Actual response body shape | Frontend display |
| --- | --- | --- | --- |
| `401` | Missing or invalid token | Standard unauthorized filter shape | Show login-expired state |
| `403` | User is not `SUPER_ADMIN` | Standard forbidden filter shape | Show access denied |
| `400` | Not used by this route | No validation path | Not applicable |
| `404` | Not used by this route | Not emitted | Not applicable |
| `500` | Unexpected failure outside Bunny fallback | Standard internal-error filter shape | Show retry state |

#### E. Edge cases

| Scenario | Actual behavior |
| --- | --- |
| No published courses | Returns `{ "courses": [] }` |
| No preview Bunny video | `previewAnalytics: null`, `previewViews = enrollments`, `conversionRate = 100` when enrollments are non-zero |
| Bunny analytics fails | Same fallback behavior as above |
| Bunny view count is `0` | `conversionRate: null` |
| Enrollments are `0` and no Bunny analytics | `previewViews: 0`, `conversionRate: null` |
| Course is unpublished | Omitted entirely |

#### F. UI integration hints

- Best suited to a conversion table or ranked course list.
- This is categorical row data, not time-series data.
- `avgWatchPercent` and `engagementScore` are percentage-style values.
- `conversionRate` is also a percentage-style value, but the fallback behavior above should be handled carefully in UI copy.

#### G. Caching & staleness

- Bunny-sourced fields in this response are cached server-side for 15 minutes.
- NSI DB fields are live.

#### H. Related endpoints

- `GET /api/v1/admin/analytics/lms-videos`
- `GET /api/v1/admin/analytics/lms-videos/:courseUuid`

## 5. Distributor Analytics

### 5.1 Distributor Dashboard

#### A. Overview

This endpoint returns the authenticated distributor's dashboard counts, subscription summary, join-link info, and optional period trend/campaign drill-down data when both dates are supplied. It is called by `DISTRIBUTOR` users and is typically used on the distributor home/dashboard page.

#### B. Request

- Full URL: `GET http://localhost:3000/api/v1/distributor/dashboard?from={YYYY-MM-DD}&to={YYYY-MM-DD}`
- Method: `GET`
- Required header: `Authorization: Bearer {accessToken}`

Query params:

| Param | Type | Required | Description | Example |
| --- | --- | --- | --- | --- |
| `from` | `string` | No | Start date; period/trend only activate when both dates exist | `2026-04-01` |
| `to` | `string` | No | End date; period/trend only activate when both dates exist | `2026-04-13` |

Sample cURL:

```bash
curl "http://localhost:3000/api/v1/distributor/dashboard?from=2026-04-01&to=2026-04-13" \
  -H "Authorization: Bearer DISTRIBUTOR_ACCESS_TOKEN"
```

#### C. Response — Success (200)

Source of truth:

- `src/distributor/distributor.service.ts` -> `getDashboard()`

TypeScript shape for frontend integration:

```ts
export interface DistributorDashboardResponse {
  totalLeads: number;
  hotLeads: number;
  contactedLeads: number;
  customers: number;
  conversionRate: number;
  subscription: {
    status: string;
    currentPeriodEnd: string;
    graceDeadline: string | null;
    plan: {
      name: string;
      amount: number;
    };
  } | null;
  joinLink: {
    url: string;
    isActive: boolean;
  } | null;
  period?: {
    from: string;
    to: string;
    leads: number;
    customers: number;
    conversionRate: number;
    growth: {
      leads: number;
      customers: number;
      conversionRate: number;
    };
  };
  trend?: Array<{
    date: string;
    leads: number;
    customers: number;
  }>;
  topCampaigns?: Array<{
    name: string;
    slug: string;
    clicks: number;
    signups: number;
    conversionRate: number;
  }>;
}
```

Response when no `from` and `to` are both present:

```json
{
  "totalLeads": 57,
  "hotLeads": 14,
  "contactedLeads": 11,
  "customers": 8,
  "conversionRate": 14.04,
  "subscription": {
    "status": "ACTIVE",
    "currentPeriodEnd": "2026-05-11T00:00:00.000Z",
    "graceDeadline": null,
    "plan": {
      "name": "Distributor Pro",
      "amount": 4999
    }
  },
  "joinLink": {
    "url": "https://growithnsi.com/join/NSI-RAH01",
    "isActive": true
  }
}
```

Response when both `from` and `to` are present:

```json
{
  "totalLeads": 57,
  "hotLeads": 14,
  "contactedLeads": 11,
  "customers": 8,
  "conversionRate": 14.04,
  "subscription": {
    "status": "ACTIVE",
    "currentPeriodEnd": "2026-05-11T00:00:00.000Z",
    "graceDeadline": null,
    "plan": {
      "name": "Distributor Pro",
      "amount": 4999
    }
  },
  "joinLink": {
    "url": "https://growithnsi.com/join/NSI-RAH01",
    "isActive": true
  },
  "period": {
    "from": "2026-04-01T00:00:00.000Z",
    "to": "2026-04-13T23:59:59.999Z",
    "leads": 12,
    "customers": 3,
    "conversionRate": 25,
    "growth": {
      "leads": 33.3,
      "customers": 50,
      "conversionRate": 12.5
    }
  },
  "trend": [
    {
      "date": "2026-04-01",
      "leads": 2,
      "customers": 0
    },
    {
      "date": "2026-04-02",
      "leads": 0,
      "customers": 0
    },
    {
      "date": "2026-04-03",
      "leads": 3,
      "customers": 1
    }
  ],
  "topCampaigns": [
    {
      "name": "Instagram Bio",
      "slug": "insta-bio",
      "clicks": 18,
      "signups": 6,
      "conversionRate": 33.3
    },
    {
      "name": "WhatsApp Status",
      "slug": "wa-status",
      "clicks": 10,
      "signups": 2,
      "conversionRate": 20
    }
  ]
}
```

Field reference:

| Field | Type | Notes |
| --- | --- | --- |
| `totalLeads` | `number` | Lifetime leads for the authenticated distributor |
| `hotLeads` | `number` | Lifetime leads in `HOT` |
| `contactedLeads` | `number` | Lifetime leads in `CONTACTED` |
| `customers` | `number` | Lifetime leads in `MARK_AS_CUSTOMER` |
| `conversionRate` | `number` | Numeric percentage, not a string |
| `subscription` | `object \| null` | Current distributor subscription, if one exists |
| `joinLink` | `object \| null` | Only `url` and `isActive` are returned here |
| `period` | `object` | Included only when both dates are supplied |
| `trend` | `array` | Zero-filled period series; `date` is actually a period label, not always a literal calendar day |
| `topCampaigns` | `array` | Top 5 campaigns by `signups`, included only when both dates are supplied |

> Known Issue
> `src/distributor/dto/responses/distributor.responses.ts` documents `joinLink` as `JoinLinkResponse`, which includes `code` and `qrCode`, but `getDashboard()` returns only `{ url, isActive }`.

#### D. Error responses

| Status | When it happens | Actual response body shape | Frontend display |
| --- | --- | --- | --- |
| `401` | Missing or invalid token | Standard unauthorized filter shape | Show login-expired state |
| `403` | User is not `DISTRIBUTOR` | Standard forbidden filter shape with `"Insufficient permissions"` | Show access denied |
| `400` | Invalid ISO date strings only; there is no service-level range-order validation | Validation-pipe bad-request filter shape | Show invalid filter format |
| `404` | Not used by this route | Not emitted by service | Not applicable |
| `500` | Unexpected failure | Standard internal-error filter shape | Show retry state |

#### E. Edge cases

| Scenario | Actual behavior |
| --- | --- |
| No leads | `conversionRate: 0`, counts zero-fill cleanly |
| No date params | Returns the base lifetime shape only; no `period`, `trend`, or `topCampaigns` keys |
| Only `from` provided | Partial range is ignored and the base lifetime shape is returned |
| Only `to` provided | Partial range is ignored and the base lifetime shape is returned |
| `from > to` | No service-level `400`; period counts usually become zero and `trend` may be empty because the generated range is invalid |
| Future range | Base lifetime metrics stay populated; `period` is usually zeroed; `trend` gap-fills future labels; `topCampaigns` may still list campaigns with zero clicks/signups |

#### F. UI integration hints

- Best suited to distributor KPI cards plus a trend chart and small top-campaign table.
- `trend` is time-series data.
- `conversionRate` and `period.growth.*` are percentage-style values.
- This is the distributor landing page endpoint, so date-range scrubbing is a likely UX pattern.

#### G. Caching & staleness

- Response is live, not cached.

#### H. Related endpoints

- `GET /api/v1/distributor/analytics/utm`
- `GET /api/v1/distributor/users/analytics`

### 5.2 Distributor UTM

#### A. Overview

This endpoint returns UTM source/medium/campaign attribution counts for the authenticated distributor's leads. It is called by `DISTRIBUTOR` users and is typically used in the distributor dashboard beside campaign performance cards.

#### B. Request

- Full URL: `GET http://localhost:3000/api/v1/distributor/analytics/utm?from={YYYY-MM-DD}&to={YYYY-MM-DD}`
- Method: `GET`
- Required header: `Authorization: Bearer {accessToken}`

Query params:

| Param | Type | Required | Description | Example |
| --- | --- | --- | --- | --- |
| `from` | `string` | No | Inclusive start date | `2026-04-01` |
| `to` | `string` | No | Inclusive end date | `2026-04-21` |

Sample cURL:

```bash
curl "http://localhost:3000/api/v1/distributor/analytics/utm?from=2026-04-01&to=2026-04-21" \
  -H "Authorization: Bearer DISTRIBUTOR_ACCESS_TOKEN"
```

#### C. Response — Success (200)

Source of truth:

- `src/distributor/distributor.service.ts` -> `getUtmAnalytics()`

TypeScript shape for frontend integration:

```ts
export interface DistributorUtmAnalyticsResponse {
  bySource: Array<{
    source: string;
    leads: number;
  }>;
  byMedium: Array<{
    medium: string;
    leads: number;
  }>;
  byCampaign: Array<{
    campaign: string;
    leads: number;
  }>;
  total: number;
  from: string;
  to: string;
}
```

Sample JSON response:

```json
{
  "bySource": [
    {
      "source": "instagram",
      "leads": 11
    },
    {
      "source": "whatsapp",
      "leads": 7
    },
    {
      "source": "direct",
      "leads": 3
    }
  ],
  "byMedium": [
    {
      "medium": "social",
      "leads": 13
    },
    {
      "medium": "direct",
      "leads": 3
    },
    {
      "medium": "status",
      "leads": 2
    }
  ],
  "byCampaign": [
    {
      "campaign": "insta-bio",
      "leads": 9
    },
    {
      "campaign": "wa-status",
      "leads": 5
    },
    {
      "campaign": "direct",
      "leads": 3
    }
  ],
  "total": 21,
  "from": "2026-04-01T00:00:00.000Z",
  "to": "2026-04-21T23:59:59.999Z"
}
```

Field reference:

| Field | Type | Notes |
| --- | --- | --- |
| `bySource` | `array` | Sorted descending by count |
| `byMedium` | `array` | Sorted descending by count |
| `byCampaign` | `array` | Sorted descending by count |
| `total` | `number` | Count of referred lead user UUIDs, not necessarily the sum of bucket counts |
| `from` | `string` | Always returned as ISO string |
| `to` | `string` | Always returned as ISO string |

> Known Issue
> `total` comes from lead rows, while the breakdown arrays come from `userAcquisition`. Missing acquisition rows can make bucket sums smaller than `total`.

#### D. Error responses

| Status | When it happens | Actual response body shape | Frontend display |
| --- | --- | --- | --- |
| `401` | Missing or invalid token | Standard unauthorized filter shape | Show login-expired state |
| `403` | User is not `DISTRIBUTOR` | Standard forbidden filter shape | Show access denied |
| `400` | Invalid ISO date strings only | Validation-pipe bad-request filter shape | Show invalid filter state |
| `404` | Not used by this route | Not emitted | Not applicable |
| `500` | Unexpected failure | Standard internal-error filter shape | Show retry state |

#### E. Edge cases

| Scenario | Actual behavior |
| --- | --- |
| No matching leads | Empty arrays, `total: 0`, and ISO `from` / `to` still returned |
| No query params | Defaults to rolling last 30 days; there is no lifetime mode |
| Only `from` provided | Uses `from` plus `to = now` |
| Only `to` provided | Uses `to` plus `from = to - 30 days` |
| `from > to` | No service-level `400`; the contradictory range generally returns no leads |
| Future range | Valid and typically empty |

#### F. UI integration hints

- Best suited to ranked attribution lists or horizontal bars.
- This is categorical attribution data, not a time series.
- All values are counts.
- This usually sits next to dashboard trend and top-campaign blocks.

#### G. Caching & staleness

- Response is live, not cached.

#### H. Related endpoints

- `GET /api/v1/distributor/dashboard`
- `GET /api/v1/distributor/users/analytics`

### 5.3 Distributor Users Analytics

#### A. Overview

This endpoint returns the authenticated distributor's user/lead funnel summary, including paid vs free counts and high-level funnel drop-off counts. It is called by `DISTRIBUTOR` users and is typically used as a compact funnel summary card set on the distributor dashboard.

#### B. Request

- Full URL: `GET http://localhost:3000/api/v1/distributor/users/analytics?from={YYYY-MM-DD}&to={YYYY-MM-DD}`
- Method: `GET`
- Required header: `Authorization: Bearer {accessToken}`

Query params:

| Param | Type | Required | Description | Example |
| --- | --- | --- | --- | --- |
| `from` | `string` | No | Lead `createdAt` start filter; only applies when both dates exist | `2026-04-01` |
| `to` | `string` | No | Lead `createdAt` end filter; only applies when both dates exist | `2026-04-21` |

Sample cURL:

```bash
curl "http://localhost:3000/api/v1/distributor/users/analytics?from=2026-04-01&to=2026-04-21" \
  -H "Authorization: Bearer DISTRIBUTOR_ACCESS_TOKEN"
```

#### C. Response — Success (200)

Source of truth:

- `src/distributor/distributor.service.ts` -> `getUsersAnalytics()`

TypeScript shape for frontend integration:

```ts
export interface DistributorUsersAnalyticsResponse {
  totalUsers: number;
  paidUsers: number;
  freeUsers: number;
  hotLeads: number;
  customers: number;
  conversionRate: number;
  funnelDropOff: {
    registered: number;
    phoneVerified: number;
    paymentCompleted: number;
    saidYes: number;
    saidNo: number;
  };
}
```

Response when no dates are supplied:

```json
{
  "totalUsers": 57,
  "paidUsers": 19,
  "freeUsers": 38,
  "hotLeads": 14,
  "customers": 8,
  "conversionRate": 14.04,
  "funnelDropOff": {
    "registered": 57,
    "phoneVerified": 34,
    "paymentCompleted": 19,
    "saidYes": 11,
    "saidNo": 6
  }
}
```

Response when both dates are supplied:

```json
{
  "totalUsers": 12,
  "paidUsers": 5,
  "freeUsers": 7,
  "hotLeads": 4,
  "customers": 3,
  "conversionRate": 25,
  "funnelDropOff": {
    "registered": 12,
    "phoneVerified": 9,
    "paymentCompleted": 5,
    "saidYes": 4,
    "saidNo": 1
  }
}
```

Field reference:

| Field | Type | Notes |
| --- | --- | --- |
| `totalUsers` | `number` | Count of lead rows for this distributor after optional date filter |
| `paidUsers` | `number` | Distinct user UUIDs with at least one successful payment |
| `freeUsers` | `number` | `totalUsers - paidUsers` |
| `hotLeads` | `number` | Lead rows whose status is `HOT` |
| `customers` | `number` | Lead rows whose status is `MARK_AS_CUSTOMER` |
| `conversionRate` | `number` | Numeric percentage, not a string |
| `funnelDropOff.registered` | `number` | Equal to `totalUsers` |
| `funnelDropOff.phoneVerified` | `number` | Count of funnel progress rows with `phoneVerified = true` |
| `funnelDropOff.paymentCompleted` | `number` | Count of funnel progress rows with `paymentCompleted = true` |
| `funnelDropOff.saidYes` | `number` | Count of funnel progress rows with `decisionAnswer = YES` |
| `funnelDropOff.saidNo` | `number` | Count of funnel progress rows with `decisionAnswer = NO` |

#### D. Error responses

| Status | When it happens | Actual response body shape | Frontend display |
| --- | --- | --- | --- |
| `401` | Missing or invalid token | Standard unauthorized filter shape | Show login-expired state |
| `403` | User is not `DISTRIBUTOR` | Standard forbidden filter shape | Show access denied |
| `400` | Invalid ISO date strings only | Validation-pipe bad-request filter shape | Show invalid filter state |
| `404` | Not used by this route | Not emitted | Not applicable |
| `500` | Unexpected failure | Standard internal-error filter shape | Show retry state |

#### E. Edge cases

| Scenario | Actual behavior |
| --- | --- |
| No referred users | Returns a fully zeroed object |
| No query params | Lifetime mode; no date filter is applied |
| Only `from` provided | Partial date is ignored and lifetime mode is used |
| Only `to` provided | Partial date is ignored and lifetime mode is used |
| `from > to` | No service-level `400`; contradictory range typically produces the zeroed response |
| Future range | Typically produces the zeroed response |

#### F. UI integration hints

- Best suited to compact KPI cards or a small funnel summary widget.
- This is categorical summary data, not time-series data.
- `conversionRate` is a percentage-style value.
- This endpoint is usually loaded alongside distributor dashboard and distributor UTM.

#### G. Caching & staleness

- Response is live, not cached.

#### H. Related endpoints

- `GET /api/v1/distributor/dashboard`
- `GET /api/v1/distributor/analytics/utm`

## 6. Appendix

### Shared Types

#### ErrorResponse

```ts
export interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;
}
```

#### PaginatedResponse

```ts
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

#### GrowthObject

```ts
export interface GrowthObject {
  [metric: string]: number;
}
```

#### PeriodObject

```ts
export interface PeriodObject<TGrowth extends GrowthObject = GrowthObject> {
  from: string;
  to: string;
  growth: TGrowth;
}
```

#### VideoAnalyticsResult

From `src/common/video/video-provider.interface.ts`:

```ts
export interface VideoAnalyticsResult {
  videoId: string;
  views: number;
  avgWatchPercent: number;
  completionRate: number;
  totalWatchTimeSeconds: number;
  topCountries: Record<string, number>;
  provider: string;
  providerExtras?: Record<string, any>;
  engagementScore: number | null;
  countryWatchTime: Record<string, number> | null;
  averageWatchTime: number | null;
}
```

#### VideoHeatmapResult

```ts
export interface VideoHeatmapResult {
  videoId: string;
  heatmap: number[];
  provider: string;
}
```

### Enum Values Used by These Analytics Endpoints

#### LeadStatus

From `prisma/schema.prisma`:

```ts
export type LeadStatus =
  | 'NEW'
  | 'WARM'
  | 'HOT'
  | 'CONTACTED'
  | 'FOLLOWUP'
  | 'NURTURE'
  | 'LOST'
  | 'MARK_AS_CUSTOMER';
```

#### PaymentStatus

```ts
export type PaymentStatus =
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'REFUNDED';
```

#### PaymentType

```ts
export type PaymentType =
  | 'COMMITMENT_FEE'
  | 'LMS_COURSE'
  | 'DISTRIBUTOR_SUB';
```

#### UserRole

```ts
export type UserRole =
  | 'USER'
  | 'CUSTOMER'
  | 'DISTRIBUTOR'
  | 'ADMIN'
  | 'SUPER_ADMIN';
```

#### UserStatus

```ts
export type UserStatus =
  | 'REGISTERED'
  | 'EMAIL_VERIFIED'
  | 'PROFILE_INCOMPLETE'
  | 'ACTIVE'
  | 'SUSPENDED';
```

#### DistributorSubscriptionStatus

```ts
export type DistributorSubscriptionStatus =
  | 'ACTIVE'
  | 'HALTED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'GRACE';
```

### Endpoint Coverage Checklist

All 14 scoped endpoints are covered:

1. `GET /api/v1/admin/analytics/dashboard`
2. `GET /api/v1/admin/analytics/funnel`
3. `GET /api/v1/admin/analytics/revenue`
4. `GET /api/v1/admin/analytics/leads`
5. `GET /api/v1/admin/analytics/distributors`
6. `GET /api/v1/admin/analytics/utm`
7. `GET /api/v1/admin/analytics/funnel-videos`
8. `GET /api/v1/admin/analytics/lms-videos`
9. `GET /api/v1/admin/analytics/lms-videos/:courseUuid`
10. `GET /api/v1/admin/analytics/lms-videos/:courseUuid/lessons/:lessonUuid`
11. `GET /api/v1/admin/analytics/course-previews`
12. `GET /api/v1/distributor/dashboard`
13. `GET /api/v1/distributor/analytics/utm`
14. `GET /api/v1/distributor/users/analytics`

### Known Issues Surfaced During Source Review

1. Actual runtime `ErrorResponse` includes `timestamp` and `path`, but the shared Swagger class omits both.
2. Admin dashboard Swagger typing mismatches runtime output:
   - `decisionSplit.yesPercent` is documented as a string but returned as a number.
   - `devices` and `topBrowsers` are documented nullable but always return object/array values.
3. Admin funnel Swagger typing mismatches runtime output:
   - `period` is returned but not documented in the Swagger response class.
   - Percentage fields are documented like strings but returned as numbers.
4. Admin distributors mixes date-scoped and lifetime semantics in one response. `funnelPath` respects the date range, but the top-level distributor aggregates do not.
5. Admin UTM `total` can exceed the sums of the bucket arrays when some leads have no `userAcquisition` row.
6. Inference from source: admin UTM `distributorUuid` is likely blocked by global `forbidNonWhitelisted: true` because `AnalyticsQueryDto` does not declare it.
7. Course preview analytics uses `enrollments` as fallback `previewViews` when Bunny preview analytics is missing, which can force `conversionRate` to `100`.
8. Lesson heatmap values are passed through as provider-native numbers. The backend does not normalize the scale.

