# Analytics Suite v3.0 Frontend Implementation Guide

This document is the implementation contract for the analytics changes currently shipped in the backend.
It is based on the live source code in:

- `src/admin/analytics-admin.controller.ts`
- `src/admin/analytics-admin.service.ts`
- `src/admin/dto/responses/admin.responses.ts`
- `src/distributor/distributor.controller.ts`
- `src/distributor/distributor.service.ts`
- `src/distributor/dto/responses/distributor.responses.ts`

Use this as the source of truth for frontend implementation.

---

## 1. Global Rules

### 1.1 Shared query params
All updated analytics endpoints accept:

- `from`
- `to`

Accepted formats:

- `YYYY-MM-DD`
- Full ISO string like `2026-04-01T00:00:00.000Z`

Backend normalization:

- `from` is expanded to `00:00:00.000`
- `to` is expanded to `23:59:59.999`

Recommended frontend rule:

- Always send both `from` and `to` together.
- Do not send only one date unless you intentionally want that endpoint's fallback behavior.

### 1.2 Growth formula
Where growth is returned, backend uses:

- `((current - previous) / previous) * 100`
- rounded to 1 decimal place

Special case:

- if previous = `0` and current > `0`, growth = `100`
- if previous = `0` and current = `0`, growth = `0`

### 1.3 Grouping rules
Where trend/chart grouping is auto-selected:

- `<= 30 days` -> `day`
- `31 to 180 days` -> `week`
- `> 180 days` -> `month`

Bucket label formats:

- `day` -> `YYYY-MM-DD`
- `week` -> `YYYY-MM-DD` where the label is the Monday of that week
- `month` -> `YYYY-MM`

### 1.4 Null vs omitted fields
This backend uses both patterns:

- `null` for some optional sections
- omitted fields for others

Frontend must not assume all optional sections are present.

---

## 2. Endpoint Behavior Matrix

| Endpoint | No params | Only one param | Both params |
| --- | --- | --- | --- |
| `GET /api/v1/admin/analytics/dashboard` | Scoped sections use last 30 days, `period = null` | Scoped sections use partial/default range, `period = null` | Scoped sections use range, `period` populated |
| `GET /api/v1/admin/analytics/funnel` | Last 30 days | Partial/default range | Exact range |
| `GET /api/v1/admin/analytics/revenue` | Last 30 days | Partial/default range | Exact range |
| `GET /api/v1/admin/analytics/leads` | Last 30 days | Partial/default range | Exact range |
| `GET /api/v1/admin/analytics/distributors` | Last 30 days | Partial/default range | Exact range |
| `GET /api/v1/admin/analytics/utm` | Lifetime mode | Lifetime mode | Exact range |
| `GET /api/v1/distributor/dashboard` | Legacy all-time payload only | Legacy all-time payload only | Enhanced payload with `period`, `trend`, `topCampaigns` |
| `GET /api/v1/distributor/analytics/utm` | Last 30 days | Partial/default range | Exact range |
| `GET /api/v1/distributor/users/analytics` | No date filter | No date filter | Exact range filter applied |
| `GET /api/v1/distributor/users` | No date filter | No date filter | Exact range filter applied |

Important:

- Admin dashboard behaves differently from distributor dashboard.
- Admin UTM behaves differently from distributor UTM.
- Distributor `users` and `users/analytics` only apply the date filter when both dates are present.

---

## 3. Admin Dashboard

### 3.1 Endpoint

`GET /api/v1/admin/analytics/dashboard`

Auth:

- `SUPER_ADMIN`
- Bearer token required

### 3.2 Response contract

```ts
type AdminDashboardGrowthResponse = {
  users: number;
  leads: number;
  customers: number;
  revenue: number;
  distributors: number;
};

type AdminDashboardPeriodResponse = {
  from: string;
  to: string;
  users: number;
  leads: number;
  customers: number;
  revenue: number;
  distributors: number;
  growth: AdminDashboardGrowthResponse;
};

type AdminAnalyticsOverview = {
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

type AdminAnalyticsDashboardResponse = {
  totalUsers: number;
  totalLeads: number;
  totalCustomers: number;
  totalRevenue: number;
  totalDistributors: number;
  period: AdminDashboardPeriodResponse | null;
  overview: AdminAnalyticsOverview;
  decisionSplit: {
    yes: number;
    no: number;
    yesPercent: string;
  };
  funnelStages: Array<{
    stage: string;
    count: number;
  }>;
  devices: {
    mobile: number;
    desktop: number;
    tablet: number;
  } | null;
  topBrowsers: Array<{
    browser: string;
    percentage: number;
  }> | null;
  funnelSummary: {
    totalFunnelStarts: number;
    completedPayment: number;
    decidedYes: number;
    decidedNo: number;
    overallConversionRate: number;
  };
};
```

### 3.3 Response semantics

#### A. Lifetime fields
These always ignore the filter:

- `totalUsers`
- `totalLeads`
- `totalCustomers`
- `totalRevenue`
- `totalDistributors`

#### B. Scoped fields
These use the selected range, or fallback range:

- `overview`
- `decisionSplit`
- `funnelStages`
- `devices`
- `topBrowsers`
- `funnelSummary`

#### C. Conditional comparison object

- `period` is always present as a key
- when no full date range is provided, `period` is `null`
- when both `from` and `to` are provided, `period` contains the selected-period totals and growth vs. the immediately previous range of identical length

### 3.4 Important metric note

There is one backend naming inconsistency that frontend should label carefully:

- `overview.customers` counts `User` records with role `CUSTOMER`
- `totalCustomers` counts `Lead` records with status `MARK_AS_CUSTOMER`
- `period.customers` also counts `Lead` records with status `MARK_AS_CUSTOMER`

Do not assume `overview.customers` and `period.customers` are based on the same table.

### 3.5 Example response without dates

Request:

```http
GET /api/v1/admin/analytics/dashboard
```

Response:

```json
{
  "totalUsers": 247,
  "totalLeads": 189,
  "totalCustomers": 34,
  "totalRevenue": 485000,
  "totalDistributors": 12,
  "period": null,
  "overview": {
    "totalUsers": 42,
    "totalUsersGrowth": 16.7,
    "phoneVerified": 31,
    "paymentsCompleted": 18,
    "hotLeads": 14,
    "hotLeadsGrowth": 27.3,
    "customers": 8,
    "customersGrowth": -11.1,
    "distributors": 2,
    "distributorsGrowth": 100
  },
  "decisionSplit": {
    "yes": 12,
    "no": 7,
    "yesPercent": "63.2%"
  },
  "funnelStages": [
    { "stage": "Registered", "count": 42 },
    { "stage": "Email Verified", "count": 39 },
    { "stage": "Phone Verified", "count": 31 },
    { "stage": "Payment Done", "count": 18 },
    { "stage": "Decision YES", "count": 12 }
  ],
  "devices": {
    "mobile": 65,
    "desktop": 30,
    "tablet": 5
  },
  "topBrowsers": [
    { "browser": "Chrome", "percentage": 72.3 },
    { "browser": "Safari", "percentage": 14.4 },
    { "browser": "Edge", "percentage": 6.1 },
    { "browser": "Other", "percentage": 7.2 }
  ],
  "funnelSummary": {
    "totalFunnelStarts": 42,
    "completedPayment": 18,
    "decidedYes": 12,
    "decidedNo": 7,
    "overallConversionRate": 28.6
  }
}
```

### 3.6 Example response with dates

Request:

```http
GET /api/v1/admin/analytics/dashboard?from=2026-04-01&to=2026-04-13
```

Response:

```json
{
  "totalUsers": 247,
  "totalLeads": 189,
  "totalCustomers": 34,
  "totalRevenue": 485000,
  "totalDistributors": 12,
  "period": {
    "from": "2026-04-01T00:00:00.000Z",
    "to": "2026-04-13T23:59:59.999Z",
    "users": 42,
    "leads": 31,
    "customers": 8,
    "revenue": 72000,
    "distributors": 3,
    "growth": {
      "users": 16.7,
      "leads": 24,
      "customers": -12.5,
      "revenue": 8.3,
      "distributors": 50
    }
  },
  "overview": {
    "totalUsers": 42,
    "totalUsersGrowth": 16.7,
    "phoneVerified": 31,
    "paymentsCompleted": 18,
    "hotLeads": 14,
    "hotLeadsGrowth": 27.3,
    "customers": 8,
    "customersGrowth": -11.1,
    "distributors": 2,
    "distributorsGrowth": 100
  },
  "decisionSplit": {
    "yes": 12,
    "no": 7,
    "yesPercent": "63.2%"
  },
  "funnelStages": [
    { "stage": "Registered", "count": 42 },
    { "stage": "Email Verified", "count": 39 },
    { "stage": "Phone Verified", "count": 31 },
    { "stage": "Payment Done", "count": 18 },
    { "stage": "Decision YES", "count": 12 }
  ],
  "devices": {
    "mobile": 65,
    "desktop": 30,
    "tablet": 5
  },
  "topBrowsers": [
    { "browser": "Chrome", "percentage": 72.3 },
    { "browser": "Safari", "percentage": 14.4 },
    { "browser": "Edge", "percentage": 6.1 },
    { "browser": "Other", "percentage": 7.2 }
  ],
  "funnelSummary": {
    "totalFunnelStarts": 42,
    "completedPayment": 18,
    "decidedYes": 12,
    "decidedNo": 7,
    "overallConversionRate": 28.6
  }
}
```

### 3.7 Frontend rendering rules

- Label top-level cards as `All-Time`.
- Label `period` cards as `Selected Range`.
- Hide comparison widgets if `period === null`.
- Treat `devices` and `topBrowsers` as nullable.
- `decisionSplit.yesPercent` already includes `%`.
- `funnelSummary.overallConversionRate` is a number, so frontend should append `%` if that is the chosen UI style.

---

## 4. Distributor Dashboard

### 4.1 Endpoint

`GET /api/v1/distributor/dashboard`

Auth:

- `DISTRIBUTOR`
- Bearer token required

### 4.2 Runtime response contract

```ts
type DistributorGrowthResponse = {
  leads: number;
  customers: number;
  conversionRate: number;
};

type DistributorDashboardPeriodResponse = {
  from: string;
  to: string;
  leads: number;
  customers: number;
  conversionRate: number;
  growth: DistributorGrowthResponse;
};

type DistributorTrendPointResponse = {
  date: string;
  leads: number;
  customers: number;
};

type DistributorTopCampaignResponse = {
  name: string;
  slug: string;
  clicks: number;
  signups: number;
  conversionRate: number;
};

type DashboardResponse = {
  totalLeads: number;
  hotLeads: number;
  contactedLeads: number;
  customers: number;
  conversionRate: string;
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
  period?: DistributorDashboardPeriodResponse;
  trend?: DistributorTrendPointResponse[];
  topCampaigns?: DistributorTopCampaignResponse[];
};
```

### 4.3 Important runtime notes

#### A. Base metrics are all-time
These fields remain all-time even when date params are sent:

- `totalLeads`
- `hotLeads`
- `contactedLeads`
- `customers`
- `conversionRate`

So the date-filtered view is additive, not a replacement of the original cards.

#### B. Enhanced fields only appear when both dates are sent
These are omitted entirely unless both `from` and `to` are present:

- `period`
- `trend`
- `topCampaigns`

This endpoint does not return `period: null`.

#### C. Trend has no grouping field
Backend does not return `grouping` for `trend`.
Frontend must infer bucket type from `date` format or from the selected range length.

#### D. Join link shape differs from Swagger DTO
The dashboard runtime response currently returns:

```json
{
  "joinLink": {
    "url": "https://growithnsi.com/join/NAG2026",
    "isActive": true
  }
}
```

It does not include `code` or `qrCode` on this endpoint.

If the frontend needs full join-link details, use:

- `GET /api/v1/distributor/join-link`

### 4.4 Example response without dates

Request:

```http
GET /api/v1/distributor/dashboard
```

Response:

```json
{
  "totalLeads": 45,
  "hotLeads": 10,
  "contactedLeads": 25,
  "customers": 5,
  "conversionRate": "11.11%",
  "subscription": {
    "status": "ACTIVE",
    "currentPeriodEnd": "2026-05-11T00:00:00.000Z",
    "graceDeadline": null,
    "plan": {
      "name": "Pro",
      "amount": 4999
    }
  },
  "joinLink": {
    "url": "https://growithnsi.com/join/NAG2026",
    "isActive": true
  }
}
```

### 4.5 Example response with dates

Request:

```http
GET /api/v1/distributor/dashboard?from=2026-04-01&to=2026-04-13
```

Response:

```json
{
  "totalLeads": 45,
  "hotLeads": 10,
  "contactedLeads": 25,
  "customers": 5,
  "conversionRate": "11.11%",
  "subscription": {
    "status": "ACTIVE",
    "currentPeriodEnd": "2026-05-11T00:00:00.000Z",
    "graceDeadline": null,
    "plan": {
      "name": "Pro",
      "amount": 4999
    }
  },
  "joinLink": {
    "url": "https://growithnsi.com/join/NAG2026",
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
    { "date": "2026-04-01", "leads": 2, "customers": 0 },
    { "date": "2026-04-02", "leads": 0, "customers": 0 },
    { "date": "2026-04-03", "leads": 1, "customers": 1 },
    { "date": "2026-04-04", "leads": 0, "customers": 0 },
    { "date": "2026-04-05", "leads": 3, "customers": 1 }
  ],
  "topCampaigns": [
    {
      "name": "Instagram Bio",
      "slug": "insta-bio",
      "clicks": 89,
      "signups": 12,
      "conversionRate": 13.5
    },
    {
      "name": "April Webinar",
      "slug": "april-webinar",
      "clicks": 51,
      "signups": 8,
      "conversionRate": 15.7
    }
  ]
}
```

### 4.6 Trend rules

- Gap filling is already done by backend.
- Every bucket in the selected range is returned.
- Empty buckets are returned as:

```json
{ "date": "2026-04-02", "leads": 0, "customers": 0 }
```

- Do not run frontend gap-filling on top of this response.

### 4.7 Campaign leaderboard rules

- Sorted by `signups` descending
- Limited to top 5
- `slug` should be used for deep-linking
- `conversionRate` is numeric, not a formatted string

### 4.8 Frontend rendering rules

- Keep current top cards as `All-Time`.
- Show a second band or expandable section for `Selected Range` only when `period` exists.
- Check `if ('period' in data)` or `if (data.period)` before rendering comparison widgets.
- Check `Array.isArray(data.trend)` before rendering the chart.
- Check `Array.isArray(data.topCampaigns)` before rendering the leaderboard.
- Top-level `conversionRate` is a string with `%`.
- `period.conversionRate` is a number.
- `topCampaigns[].conversionRate` is a number.

---

## 5. Distributor Users Analytics

### 5.1 Endpoint

`GET /api/v1/distributor/users/analytics`

Date behavior:

- date filter is applied only when both `from` and `to` are provided
- if one or both are missing, response is unfiltered

### 5.2 Response contract

```ts
type UsersAnalyticsResponse = {
  totalUsers: number;
  paidUsers: number;
  freeUsers: number;
  hotLeads: number;
  customers: number;
  conversionRate: string;
  funnelDropOff: {
    registered: number;
    phoneVerified: number;
    paymentCompleted: number;
    saidYes: number;
    saidNo: number;
  };
};
```

### 5.3 Example response

```json
{
  "totalUsers": 45,
  "paidUsers": 25,
  "freeUsers": 20,
  "hotLeads": 10,
  "customers": 5,
  "conversionRate": "11.11%",
  "funnelDropOff": {
    "registered": 45,
    "phoneVerified": 40,
    "paymentCompleted": 25,
    "saidYes": 10,
    "saidNo": 5
  }
}
```

### 5.4 Frontend note

`conversionRate` here is a formatted string, not a number.

---

## 6. Distributor Users List

### 6.1 Endpoint

`GET /api/v1/distributor/users`

Supported query params:

- `search`
- `funnelStage`
- `page`
- `limit`
- `from`
- `to`

Allowed `funnelStage` values:

- `REGISTERED`
- `PHONE_VERIFIED`
- `PAYMENT_COMPLETED`
- `SAID_YES`
- `SAID_NO`

Date behavior:

- date filter is applied only when both `from` and `to` are provided

### 6.2 Response contract

```ts
type DistributorUserItem = {
  uuid: string;
  fullName: string;
  email: string;
  phone: string | null;
  country: string | null;
  avatarUrl: string | null;
  role: string;
  status: string;
  createdAt: string;
  leadStatus: string;
  displayLeadStatus: string;
  paymentStatus: string;
  funnelStage: string;
  funnelStageLabel: string;
  funnelProgress: {
    completedSteps: number;
    totalSteps: number;
    phoneVerified: boolean;
    paymentCompleted: boolean;
    decisionAnswer: string | null;
  };
};

type UsersListResponse = {
  items: DistributorUserItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
```

### 6.3 Example response

```json
{
  "items": [
    {
      "uuid": "550e8400-e29b-41d4-a716-446655440000",
      "fullName": "John Doe",
      "email": "user@example.com",
      "phone": "+919876543210",
      "country": "IN",
      "avatarUrl": null,
      "role": "CUSTOMER",
      "status": "ACTIVE",
      "createdAt": "2026-04-10T00:00:00.000Z",
      "leadStatus": "HOT",
      "displayLeadStatus": "Hot",
      "paymentStatus": "Paid",
      "funnelStage": "SAID_YES",
      "funnelStageLabel": "Said YES",
      "funnelProgress": {
        "completedSteps": 3,
        "totalSteps": 5,
        "phoneVerified": true,
        "paymentCompleted": true,
        "decisionAnswer": "YES"
      }
    }
  ],
  "total": 45,
  "page": 1,
  "limit": 20,
  "totalPages": 3
}
```

---

## 7. Admin UTM Analytics

### 7.1 Endpoint

`GET /api/v1/admin/analytics/utm`

Optional extra query param:

- `distributorUuid`

Date behavior:

- when both `from` and `to` are sent, data is filtered to that range
- when one or both are missing, this endpoint switches to lifetime mode

### 7.2 Response contract

```ts
type UtmEntryDetailed = {
  source?: string;
  medium?: string;
  campaign?: string;
  leads: number;
};

type AdminAnalyticsUtmResponse = {
  bySource: UtmEntryDetailed[];
  byMedium: UtmEntryDetailed[];
  byCampaign: UtmEntryDetailed[];
  total: number;
  from: string | null;
  to: string | null;
};
```

### 7.3 Lifetime mode example

Request:

```http
GET /api/v1/admin/analytics/utm
```

Response:

```json
{
  "bySource": [
    { "source": "facebook", "leads": 15 },
    { "source": "google", "leads": 8 },
    { "source": "direct", "leads": 4 }
  ],
  "byMedium": [
    { "medium": "cpc", "leads": 18 },
    { "medium": "organic", "leads": 5 },
    { "medium": "direct", "leads": 4 }
  ],
  "byCampaign": [
    { "campaign": "summer_sale", "leads": 12 },
    { "campaign": "april_webinar", "leads": 10 },
    { "campaign": "direct", "leads": 5 }
  ],
  "total": 27,
  "from": null,
  "to": null
}
```

### 7.4 Date-filtered example

Request:

```http
GET /api/v1/admin/analytics/utm?from=2026-04-01&to=2026-04-13
```

Response:

```json
{
  "bySource": [
    { "source": "facebook", "leads": 7 },
    { "source": "google", "leads": 4 },
    { "source": "direct", "leads": 1 }
  ],
  "byMedium": [
    { "medium": "cpc", "leads": 9 },
    { "medium": "organic", "leads": 2 },
    { "medium": "direct", "leads": 1 }
  ],
  "byCampaign": [
    { "campaign": "april_webinar", "leads": 6 },
    { "campaign": "summer_sale", "leads": 4 },
    { "campaign": "direct", "leads": 2 }
  ],
  "total": 12,
  "from": "2026-04-01T00:00:00.000Z",
  "to": "2026-04-13T23:59:59.999Z"
}
```

### 7.5 Frontend note

Swagger examples show `from` and `to` as strings, but the runtime service returns `null` for both in lifetime mode.

---

## 8. Distributor UTM Analytics

### 8.1 Endpoint

`GET /api/v1/distributor/analytics/utm`

Date behavior:

- no params -> last 30 days
- one param -> partial/default range
- both params -> exact range

### 8.2 Response contract

```ts
type UtmEntry = {
  source?: string;
  medium?: string;
  campaign?: string;
  leads: number;
};

type UtmAnalyticsResponse = {
  bySource: UtmEntry[];
  byMedium: UtmEntry[];
  byCampaign: UtmEntry[];
  total: number;
  from: string;
  to: string;
};
```

### 8.3 Frontend note

Unlike admin UTM, distributor UTM does not have lifetime mode.
It always returns concrete `from` and `to` values.

---

## 9. Error Handling

Common validation error shape:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

Admin-specific date validation on analytics endpoints:

- if `from > to` -> `400` with message `from date must be before to date`
- if range exceeds 5 years -> `400` with message `Maximum date range is 5 years`

Recommended frontend validation:

- require both dates together
- block `from > to`
- cap selectable admin analytics ranges to 5 years

---

## 10. Frontend Implementation Checklist

- Persist selected date range in URL or shared dashboard state so tab switches do not reset it.
- Always label base dashboard totals as `All-Time` on distributor dashboard.
- Always label top-level totals as `All-Time` on admin dashboard.
- Only render admin comparison UI when `period !== null`.
- Only render distributor comparison UI when `period` exists.
- Only render distributor trend chart when `trend` exists and has length.
- Only render top campaigns when `topCampaigns` exists.
- Do not append `%` to values that already arrive as strings like `11.11%`.
- Do append `%` in UI for numeric rate fields where desired, such as `period.conversionRate` or `funnelSummary.overallConversionRate`.
- Do not gap-fill distributor trend in frontend.
- Use `topCampaigns[].slug` for campaign deep links.
- Use `/api/v1/distributor/join-link` if you need QR code or referral code on the dashboard screen.

---

## 11. Safe Frontend Request Pattern

Use one helper for all date-filtered requests:

```ts
function buildDateRangeParams(from?: string, to?: string) {
  const params = new URLSearchParams();

  if (from && to) {
    params.set('from', from);
    params.set('to', to);
  }

  return params;
}
```

This avoids the inconsistent partial-date behavior between endpoints.

