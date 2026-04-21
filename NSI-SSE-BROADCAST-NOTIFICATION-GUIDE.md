# NSI Real-Time Guide — SSE + Broadcasts + Notifications
Version: 1.0 | April 2026
Source: Read directly from codebase

---

## 0. Quick Reference — All Endpoints

| Method | URL | Auth Role | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/sse/stream` | `CUSTOMER`, `DISTRIBUTOR`, `SUPER_ADMIN`, `ADMIN` | Open authenticated SSE stream |
| `POST` | `/api/v1/admin/broadcasts` | `SUPER_ADMIN` | Create admin `ANNOUNCEMENT` or `BROADCAST` |
| `GET` | `/api/v1/admin/broadcasts?page=1&limit=20` | `SUPER_ADMIN` | List all broadcasts/announcements with pagination |
| `PATCH` | `/api/v1/admin/broadcasts/:uuid/deactivate` | `SUPER_ADMIN` | Deactivate any broadcast/announcement |
| `POST` | `/api/v1/distributor/broadcasts` | `DISTRIBUTOR` | Create distributor broadcast |
| `GET` | `/api/v1/distributor/broadcasts?page=1&limit=20` | `DISTRIBUTOR` | List distributor-created broadcasts with pagination |
| `PATCH` | `/api/v1/distributor/broadcasts/:uuid/deactivate` | `DISTRIBUTOR` | Deactivate own broadcast |
| `GET` | `/api/v1/broadcasts/active` | `USER`, `CUSTOMER`, `DISTRIBUTOR`, `SUPER_ADMIN` | Get visible active announcements and unread broadcasts |
| `POST` | `/api/v1/broadcasts/:uuid/dismiss` | `USER`, `CUSTOMER`, `DISTRIBUTOR`, `SUPER_ADMIN` | Mark one `BROADCAST` as read/dismissed |
| `GET` | `/api/v1/broadcasts/:uuid` | `USER`, `CUSTOMER`, `DISTRIBUTOR`, `SUPER_ADMIN` | Get one visible broadcast detail and auto-mark `BROADCAST` as read |
| `GET` | `/api/v1/admin/notifications` | `SUPER_ADMIN` | Get admin follow-up and task notifications |
| `GET` | `/api/v1/distributor/notifications?limit=50` | `DISTRIBUTOR` | Get distributor task and follow-up notifications |

⚠️ Current codebase has no `src/notifications/` directory and no Prisma `Notification` model. "Notifications" are derived from `LeadActivity` and `DistributorTask` data plus real-time SSE pushes.

---

## 1. SSE Connection

### 1.1 How SSE Auth Works

`SseAuthGuard` checks auth in this exact order:

1. `Authorization` header first
2. `?token=` query parameter second

Exact header format:

```http
Authorization: Bearer <access_token>
```

Exact query-param fallback format:

```text
/api/v1/sse/stream?token=<access_token>
```

Why query param exists:

- `SseAuthGuard` has an inline code comment explaining that browser `EventSource` cannot set custom headers.
- Native browser SSE therefore has to use the `token` query string fallback.

Actual guard behavior:

- Missing token -> `401 Unauthorized` with message `No authentication token provided`
- Invalid or expired token -> `401 Unauthorized` with message `Invalid or expired token`
- On success, the verified JWT payload is attached to `request.user`

### 1.2 Connect to SSE Stream

Exact URL:

```text
GET /api/v1/sse/stream
```

Allowed roles from `@Roles(...)`:

- `CUSTOMER`
- `DISTRIBUTOR`
- `SUPER_ADMIN`
- `ADMIN`

Backend response headers:

- `Content-Type: text/event-stream`
- `Cache-Control: no-cache`
- `Connection: keep-alive`
- `X-Accel-Buffering: no`

Complete working browser example:

```javascript
const API_BASE = 'http://localhost:3000'

function connectSSE() {
  const accessToken = getAccessToken()
  if (!accessToken) {
    throw new Error('Missing access token')
  }

  const es = new EventSource(
    `${API_BASE}/api/v1/sse/stream?token=${encodeURIComponent(accessToken)}`,
    { withCredentials: true }
  )

  es.onopen = () => {
    console.log('SSE connected')
  }

  es.onmessage = (event) => {
    const payload = JSON.parse(event.data)
    console.log('SSE message', payload)
  }

  es.onerror = (error) => {
    console.error('SSE error', error)
  }

  return es
}
```

⚠️ `withCredentials: true` does not authenticate by itself. The backend guard only reads `Authorization` or `?token=`.

⚠️ In production, `main.ts` only allows SSE from configured/allowed origins. Development mode allows all origins.

🔴 CRITICAL: `SseService` keeps only one live SSE connection per `userUuid`. Opening a second tab/window for the same user closes the earlier connection.

### 1.3 SSE Message Types

Actual backend envelope from `SseService.writeEvent(...)`:

```typescript
type SseEvent =
  | { type: 'connected' }
  | { type: 'broadcast'; data: Record<string, unknown> }
  | { type: 'notification'; data: Record<string, unknown> }
```

Actual message types emitted in current codebase:

1. `connected`
2. `broadcast`
3. `notification`

Connected confirmation sent immediately after stream opens:

```json
{
  "type": "connected"
}
```

Admin-created broadcast event:

```json
{
  "type": "broadcast",
  "data": {
    "broadcastUuid": "b3fd4b7b-61e0-4751-9f5c-daa9f6dd4a63",
    "title": "System Maintenance",
    "type": "ANNOUNCEMENT",
    "shortMessage": "Platform offline tonight",
    "link": "https://status.nsi.example/maintenance"
  }
}
```

Distributor-created broadcast event:

```json
{
  "type": "broadcast",
  "data": {
    "broadcastUuid": "7ef83dbe-3c3c-49de-82f9-4af55f280bd9",
    "title": "For My Referred Users",
    "type": "BROADCAST",
    "shortMessage": "Please finish your pending profile setup"
  }
}
```

`NEW_LEAD` notification event:

```json
{
  "type": "notification",
  "data": {
    "type": "NEW_LEAD",
    "leadUuid": "8d8f9d78-8a88-47c6-8f34-fd1fb58972f4",
    "message": "New lead assigned: Jane Doe"
  }
}
```

⚠️ `NEW_LEAD.data.leadUuid` is named `leadUuid` in the payload, but the code sends `userUuid` there, not the `Lead.uuid`.

`FOLLOWUP_SCHEDULED` notification event:

```json
{
  "type": "notification",
  "data": {
    "type": "FOLLOWUP_SCHEDULED",
    "leadUuid": "19a4f0c3-70f5-4d7e-bd5a-492598b2f544",
    "message": "Followup scheduled for Jane Doe at 4/20/2026, 3:30:00 PM"
  }
}
```

`NEW_TASK` notification event:

```json
{
  "type": "notification",
  "data": {
    "type": "NEW_TASK",
    "taskUuid": "ae1ce67d-9f08-47ce-bbdf-61d3dbe1c4d9",
    "message": "New task: Call the prospect"
  }
}
```

### 1.4 Reconnection Pattern (CRITICAL)

Recommended frontend pattern based on actual backend behavior:

- Use SSE as the primary real-time channel.
- Stop REST polling while SSE is connected.
- Start fallback polling only after SSE disconnects.
- Use exponential backoff for manual reconnects.
- Refetch REST data after a `broadcast` or `notification` SSE event instead of trusting the small SSE payload as the full source of truth.

Why this matters in this backend:

- `AppModule` enables a global throttler.
- The default limit is `100 requests / 60 seconds`.
- Aggressive fallback polling can trigger `429`.
- Broadcast SSE payloads are intentionally minimal and do not contain full banner/bell state.

🔴 CRITICAL: On a `broadcast` SSE event, refetch `/api/v1/broadcasts/active` before updating UI.

⚠️ Native `EventSource` does not reliably expose HTTP status codes in `onerror`. Treat `401` and `429` as connect-time/backend realities, but implement reconnect logic around your auth/session layer rather than relying on browser-provided status details.

### 1.5 Keepalive

The controller sends a keepalive ping every `30000` ms.

Exact wire format:

```text
:ping

```

How frontend should handle it:

- Native browser `EventSource` ignores comment frames like `:ping` automatically.
- If you ever use a custom SSE parser, ignore lines that start with `:`.

---

## 2. Broadcasts

### 2.1 What is a Broadcast

Relevant Prisma models:

- `BroadcastMessage`
- `BroadcastRead`

Actual `BroadcastMessage` behavior:

- `type` is stored as string and used as either `ANNOUNCEMENT` or `BROADCAST`
- `targetRole: null` means "all roles"
- `targetUuids: []` means "no user-specific filter"
- `isActive` defaults to `true`
- `expiresAt` is optional; expired messages are hidden from active/detail endpoints

Actual `BroadcastRead` behavior:

- A row means one user has dismissed/read one `BROADCAST`
- Unique constraint is `[broadcastUuid, userUuid]`
- Duplicate dismisses are ignored because service uses `createMany(..., skipDuplicates: true)`

Actual type differences:

- `ANNOUNCEMENT` is global admin messaging, returned in `announcements[]`, and cannot be dismissed
- `BROADCAST` is user-targeted or distributor-targeted messaging, returned in `broadcasts[]`, and can be dismissed/read

Actual targeting rules:

- Admin-created `ANNOUNCEMENT` ignores any incoming `targetRole` and `targetUuids`
- Admin-created `BROADCAST`:
  - `targetRole: 'ALL'` is stored as `targetRole: null`
  - `targetRole` + empty `targetUuids` targets everyone in that role
  - populated `targetUuids` makes the stored message visible only to those exact users
- Distributor-created `BROADCAST`:
  - always stores `type: 'BROADCAST'`
  - always stores `targetRole: null`
  - if `targetUuids` is supplied, the service silently filters it to referred users only
  - if filtered `targetUuids` ends up empty, the message targets all users referred by that distributor

🔴 CRITICAL: There is a live-delivery mismatch in `createAdminBroadcast(...)`.

- Persisted visibility uses `targetUuids` correctly.
- SSE delivery uses this branch order: `ANNOUNCEMENT` or `targetRole === 'ALL'` or `!targetRole` -> `sendToAll(...)`.
- That means an admin `BROADCAST` with `targetUuids` set but no `targetRole` is stored as targeted, but the immediate SSE event is sent to all connected clients.
- Frontend should treat the incoming `broadcast` SSE event as a refetch signal, not as permission to render the broadcast directly.

### 2.2 Create Broadcast

#### SUPER_ADMIN

Full URL:

```text
POST /api/v1/admin/broadcasts
```

Auth:

- `SUPER_ADMIN`

Request body from `CreateBroadcastDto`:

```typescript
interface CreateBroadcastRequest {
  type: 'ANNOUNCEMENT' | 'BROADCAST'
  title: string
  shortMessage: string
  fullContent?: string
  link?: string
  targetRole?: 'ALL' | 'USER' | 'CUSTOMER' | 'DISTRIBUTOR'
  targetUuids?: string[]
  expiresAt?: string
}
```

Field rules:

| Field | Type | Required | Validation / meaning |
| --- | --- | --- | --- |
| `type` | `'ANNOUNCEMENT' \| 'BROADCAST'` | Yes | Must be one of the two enum values |
| `title` | `string` | Yes | `@IsString()`, `@MaxLength(100)` |
| `shortMessage` | `string` | Yes | `@IsString()`, `@MaxLength(160)` |
| `fullContent` | `string` | No | `@IsOptional()`, `@IsString()` |
| `link` | `string` | No | `@IsOptional()`, `@IsString()`. Not URL-validated |
| `targetRole` | `'ALL' \| 'USER' \| 'CUSTOMER' \| 'DISTRIBUTOR'` | No | Optional enum |
| `targetUuids` | `string[]` | No | `@IsOptional()`, `@IsArray()`, each item `@IsUUID('4')` |
| `expiresAt` | `string` | No | `@IsOptional()`, `@IsDateString()` |

Targeting rules from service:

- If `type === 'ANNOUNCEMENT'`, the service stores `targetRole: null` and `targetUuids: []` no matter what you send.
- If `type === 'BROADCAST'` and `targetRole === 'ALL'`, the service stores `targetRole: null`.
- If `type === 'BROADCAST'` and both `targetRole` and `targetUuids` are omitted, the stored broadcast becomes visible to everyone.

Successful response shape:

```json
{
  "uuid": "b3fd4b7b-61e0-4751-9f5c-daa9f6dd4a63",
  "type": "BROADCAST",
  "title": "New Feature Available",
  "shortMessage": "Check out the new dashboard.",
  "fullContent": "Full details about the feature rollout.",
  "link": "https://docs.nsi.example/new-dashboard",
  "targetRole": "CUSTOMER",
  "targetUuids": [],
  "createdByUuid": "1cebc7f6-3c2d-4f54-b0c4-fcce8cf8b7f5",
  "createdByRole": "SUPER_ADMIN",
  "isActive": true,
  "expiresAt": "2026-12-31T23:59:59.000Z",
  "createdAt": "2026-04-20T09:00:00.000Z",
  "updatedAt": "2026-04-20T09:00:00.000Z"
}
```

Common errors:

- `400` validation error
- `401` invalid or missing JWT
- `403` role is not `SUPER_ADMIN`
- `429` throttled

Standard error shape:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "timestamp": "2026-04-20T09:01:00.000Z",
  "path": "/api/v1/admin/broadcasts"
}
```

#### DISTRIBUTOR

Full URL:

```text
POST /api/v1/distributor/broadcasts
```

Auth:

- `DISTRIBUTOR`

Request body:

The controller uses the same `CreateBroadcastDto` as admin:

```typescript
interface CreateDistributorBroadcastRequest {
  type: 'ANNOUNCEMENT' | 'BROADCAST'
  title: string
  shortMessage: string
  fullContent?: string
  link?: string
  targetRole?: 'ALL' | 'USER' | 'CUSTOMER' | 'DISTRIBUTOR'
  targetUuids?: string[]
  expiresAt?: string
}
```

Actual distributor service behavior:

- `type` is required by DTO validation, but the service always stores `type: 'BROADCAST'`
- `targetRole` is accepted by DTO, but ignored by the service and stored as `null`
- `targetUuids` is filtered down to users actually referred by that distributor
- if no valid referred `targetUuids` remain, the broadcast targets all users referred by that distributor

Successful response example:

```json
{
  "uuid": "7ef83dbe-3c3c-49de-82f9-4af55f280bd9",
  "type": "BROADCAST",
  "title": "Complete Your Profile",
  "shortMessage": "Please finish your pending profile setup.",
  "fullContent": null,
  "link": null,
  "targetRole": null,
  "targetUuids": [
    "4c6c62d3-2823-4db2-8f1a-20cb2171d75e"
  ],
  "createdByUuid": "b2d0a14d-54a0-4e90-8b8e-6f63f13b89ad",
  "createdByRole": "DISTRIBUTOR",
  "isActive": true,
  "expiresAt": null,
  "createdAt": "2026-04-20T09:05:00.000Z",
  "updatedAt": "2026-04-20T09:05:00.000Z"
}
```

Common errors:

- `400` validation error
- `401` invalid or missing JWT
- `403` role is not `DISTRIBUTOR`
- `429` throttled

### 2.3 Get Active Broadcasts (User facing)

Full URL:

```text
GET /api/v1/broadcasts/active
```

Auth:

- `USER`
- `CUSTOMER`
- `DISTRIBUTOR`
- `SUPER_ADMIN`

What "active" means in actual query:

- `isActive === true`
- `expiresAt === null || expiresAt > now`
- visible to this user according to `isVisibleToUser(...)`
- if message type is `BROADCAST`, it must also not be dismissed by this user

When to call this:

- page/app load
- immediately after any `broadcast` SSE event
- after dismissing a broadcast
- after opening a broadcast detail page/drawer
- after SSE reconnect

Response shape:

```typescript
interface ActiveBroadcastsResponse {
  announcements: Array<{
    uuid: string
    title: string
    shortMessage: string
    fullContent: string | null
    link: string | null
    createdAt: string
    expiresAt: string | null
  }>
  broadcasts: Array<{
    uuid: string
    title: string
    shortMessage: string
    fullContent: string | null
    link: string | null
    createdByRole: 'SUPER_ADMIN' | 'DISTRIBUTOR'
    createdAt: string
    expiresAt: string | null
  }>
  unreadCount: number
}
```

Response example:

```json
{
  "announcements": [
    {
      "uuid": "dd44d6f0-c3d0-4253-b00b-d06b1177d03e",
      "title": "Platform Maintenance Tonight",
      "shortMessage": "Scheduled maintenance from 2:00-4:00 AM UTC.",
      "fullContent": "The platform will be read-only during the maintenance window.",
      "link": "https://status.nsi.example/maintenance",
      "createdAt": "2026-04-20T08:30:00.000Z",
      "expiresAt": "2026-04-21T04:00:00.000Z"
    }
  ],
  "broadcasts": [
    {
      "uuid": "576d86e3-3ea5-4ba2-bd69-45d1c08f8841",
      "title": "Profile Update Needed",
      "shortMessage": "Please complete your tax details.",
      "fullContent": "Your next payout requires a completed tax profile.",
      "link": null,
      "createdByRole": "DISTRIBUTOR",
      "createdAt": "2026-04-20T08:45:00.000Z",
      "expiresAt": null
    }
  ],
  "unreadCount": 1
}
```

🔴 CRITICAL: `unreadCount` is only `broadcasts.length`. Announcements are excluded.

### 2.4 Mark Broadcast as Read

Exact route in current backend:

```text
POST /api/v1/broadcasts/:uuid/dismiss
```

Auth:

- `USER`
- `CUSTOMER`
- `DISTRIBUTOR`
- `SUPER_ADMIN`

Request body:

- none

Path params:

| Param | Type | Required | Meaning |
| --- | --- | --- | --- |
| `uuid` | `string` | Yes | Broadcast UUID |

Successful response:

```json
{
  "message": "Dismissed"
}
```

Actual service behavior:

- looks up the message by UUID
- rejects `ANNOUNCEMENT`
- creates a `BroadcastRead` row with `skipDuplicates: true`

Common errors:

- `400` with message `Announcements cannot be dismissed`
- `404` with message `Broadcast <uuid> not found`
- `401` invalid or missing JWT
- `403` wrong role
- `429` throttled

⚠️ This endpoint is idempotent because duplicate `BroadcastRead` inserts are skipped.

### 2.5 Broadcast Display Rules

Actual frontend rules from backend behavior:

- `ANNOUNCEMENT` -> render as top banner
- `ANNOUNCEMENT` -> non-dismissable
- `ANNOUNCEMENT` -> comes from `announcements[]`
- `BROADCAST` -> render in bell/inbox UI
- `BROADCAST` -> dismissable through `POST /api/v1/broadcasts/:uuid/dismiss`
- `BROADCAST` -> also auto-marks as read when you call `GET /api/v1/broadcasts/:uuid`
- `expiresAt` -> hide once now is past `expiresAt`
- `unreadCount` -> count of visible, non-dismissed broadcasts only

Actual role/ownership visibility rules:

- Admin-created `ANNOUNCEMENT` is visible to everyone
- Admin-created `BROADCAST` can be role-targeted or user-targeted
- Distributor-created `BROADCAST` is visible only to the distributor's referred users, or to directly targeted referred users

🔴 CRITICAL: Do not render a new broadcast directly from the SSE payload alone. Refetch `/api/v1/broadcasts/active`.

### 2.6 Additional Broadcast Endpoints

⚠️ Backend route-order note: `broadcast-user.controller.ts` explicitly declares `/active` before `/:uuid`. Frontend should always call the literal `/api/v1/broadcasts/active` path and never treat `active` as a UUID value.

#### Get Broadcast Detail

Full URL:

```text
GET /api/v1/broadcasts/:uuid
```

Auth:

- `USER`
- `CUSTOMER`
- `DISTRIBUTOR`
- `SUPER_ADMIN`

Actual behavior:

- returns `404` if message does not exist
- returns `404` if message is inactive or expired
- returns `404` if current user cannot see it
- auto-marks as read only when `type === 'BROADCAST'`

Response example:

```json
{
  "uuid": "576d86e3-3ea5-4ba2-bd69-45d1c08f8841",
  "type": "BROADCAST",
  "title": "Profile Update Needed",
  "shortMessage": "Please complete your tax details.",
  "fullContent": "Your next payout requires a completed tax profile.",
  "link": null,
  "targetRole": null,
  "targetUuids": [],
  "createdByUuid": "b2d0a14d-54a0-4e90-8b8e-6f63f13b89ad",
  "createdByRole": "DISTRIBUTOR",
  "isActive": true,
  "expiresAt": null,
  "createdAt": "2026-04-20T08:45:00.000Z",
  "updatedAt": "2026-04-20T08:45:00.000Z"
}
```

#### List Broadcasts (Admin)

Full URL:

```text
GET /api/v1/admin/broadcasts?page=1&limit=20
```

Auth:

- `SUPER_ADMIN`

Query params:

| Param | Type | Default | Meaning |
| --- | --- | --- | --- |
| `page` | `number` | `1` | 1-based page |
| `limit` | `number` | `20` | Clamped to `1..100` |

Response shape:

```json
{
  "data": [
    {
      "uuid": "b3fd4b7b-61e0-4751-9f5c-daa9f6dd4a63",
      "type": "BROADCAST",
      "title": "New Feature Available",
      "shortMessage": "Check out the new dashboard.",
      "fullContent": "Full details about the feature rollout.",
      "link": "https://docs.nsi.example/new-dashboard",
      "targetRole": "CUSTOMER",
      "targetUuids": [],
      "createdByUuid": "1cebc7f6-3c2d-4f54-b0c4-fcce8cf8b7f5",
      "createdByRole": "SUPER_ADMIN",
      "isActive": true,
      "expiresAt": "2026-12-31T23:59:59.000Z",
      "createdAt": "2026-04-20T09:00:00.000Z",
      "updatedAt": "2026-04-20T09:00:00.000Z",
      "readCount": 42
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

#### List Broadcasts (Distributor)

Full URL:

```text
GET /api/v1/distributor/broadcasts?page=1&limit=20
```

Auth:

- `DISTRIBUTOR`

Query params:

| Param | Type | Default | Meaning |
| --- | --- | --- | --- |
| `page` | `number` | `1` | 1-based page |
| `limit` | `number` | `20` | Clamped to `1..100` |

Response shape:

Same shape as admin list, but filtered to `createdByUuid === currentDistributorUuid`.

#### Deactivate Broadcast

Admin URL:

```text
PATCH /api/v1/admin/broadcasts/:uuid/deactivate
```

Distributor URL:

```text
PATCH /api/v1/distributor/broadcasts/:uuid/deactivate
```

Request body:

- none

Response:

```json
{
  "message": "Deactivated"
}
```

Business rules:

- `SUPER_ADMIN` can deactivate any broadcast
- `DISTRIBUTOR` can only deactivate own broadcast
- not found -> `404 Broadcast <uuid> not found`
- wrong distributor owner -> `403 You can only deactivate your own broadcasts`

---

## 3. Notifications

⚠️ There is no dedicated notifications module, notifications table, or notification read-state table in the current backend.

Actual notification data sources:

- `LeadActivity`
- `DistributorTask`
- SSE `notification` events emitted from lead/task services

### 3.1 What triggers a notification

Actual SSE notification triggers found in code:

1. New lead assigned
2. New task created for distributor
3. New task created for super admin
4. Follow-up scheduled

Trigger details:

| Trigger | Where it happens | SSE payload |
| --- | --- | --- |
| New lead assigned | `LeadsService.createLeadForUser(...)` | `{ type: 'notification', data: { type: 'NEW_LEAD', leadUuid, message } }` |
| New distributor task | `DistributorTaskService.createTask(...)` | `{ type: 'notification', data: { type: 'NEW_TASK', taskUuid, message } }` |
| New admin task | `AdminTaskService.createTask(...)` | `{ type: 'notification', data: { type: 'NEW_TASK', taskUuid, message } }` |
| Follow-up scheduled | `LeadsService.applyStatusChange(...)` when status becomes `FOLLOWUP` | `{ type: 'notification', data: { type: 'FOLLOWUP_SCHEDULED', leadUuid, message } }` |

What was not found:

- no task-update SSE notification
- no task-delete SSE notification
- no persisted notification rows
- no notification mark-read endpoint
- no mark-all-read endpoint

### 3.2 Get Notifications

#### SUPER_ADMIN

Full URL:

```text
GET /api/v1/admin/notifications
```

Auth:

- `SUPER_ADMIN`

Actual response shape:

```typescript
interface AdminNotificationsResponse {
  followupsToday: Array<{
    leadUuid: string
    userFullName: string
    phone: string | null
    followupAt: string
    notes: string | null
  }>
  overdueFollowups: Array<{
    leadUuid: string
    userFullName: string
    phone: string | null
    followupAt: string
    notes: string | null
  }>
  tasksDueToday: Array<{
    uuid: string
    title: string
    dueDate: string | null
    lead: { uuid: string; userFullName: string; status: string } | null
  }>
  overdueTasks: Array<{
    uuid: string
    title: string
    dueDate: string | null
    lead: { uuid: string; userFullName: string; status: string } | null
  }>
}
```

Response example:

```json
{
  "followupsToday": [
    {
      "leadUuid": "8f74aa88-9c4f-40c7-b3e8-af34c1556809",
      "userFullName": "Jane Doe",
      "phone": "+919876543210",
      "followupAt": "2026-04-20T10:00:00.000Z",
      "notes": "Call after lunch"
    }
  ],
  "overdueFollowups": [],
  "tasksDueToday": [
    {
      "uuid": "ae1ce67d-9f08-47ce-bbdf-61d3dbe1c4d9",
      "title": "Call the prospect",
      "dueDate": "2026-04-20T00:00:00.000Z",
      "lead": {
        "uuid": "8f74aa88-9c4f-40c7-b3e8-af34c1556809",
        "userFullName": "Jane Doe",
        "status": "FOLLOWUP"
      }
    }
  ],
  "overdueTasks": []
}
```

Actual source of these arrays:

- `followupsToday` and `overdueFollowups` come from `LeadsService.getAdminNotifications()`
- `tasksDueToday` and `overdueTasks` come from `AdminTaskService.getTaskNotifications(...)`

⚠️ Admin notifications are for direct/organic leads only because `LeadsService.getAdminNotifications()` filters `lead.distributorUuid: null`.

#### DISTRIBUTOR

Full URL:

```text
GET /api/v1/distributor/notifications?limit=50
```

Auth:

- `DISTRIBUTOR`

Query params:

| Param | Type | Default | Meaning |
| --- | --- | --- | --- |
| `limit` | `number` | `50` | Max items per category, capped at `100` |

Actual response shape:

```typescript
interface DistributorNotificationsResponse {
  tasksDueToday: Array<{
    uuid: string
    title: string
    dueDate: string | null
    lead: { uuid: string; userFullName: string; status: string } | null
  }>
  tasksDueSoon: Array<{
    uuid: string
    title: string
    dueDate: string | null
    lead: { uuid: string; userFullName: string; status: string } | null
  }>
  followupsToday: Array<{
    leadUuid: string
    userFullName: string
    leadStatus: string
    followupAt: string
    notes: string | null
  }>
  unreadCount: number
}
```

Response example:

```json
{
  "tasksDueToday": [
    {
      "uuid": "ae1ce67d-9f08-47ce-bbdf-61d3dbe1c4d9",
      "title": "Call the prospect",
      "dueDate": "2026-04-20T00:00:00.000Z",
      "lead": {
        "uuid": "8f74aa88-9c4f-40c7-b3e8-af34c1556809",
        "userFullName": "Jane Doe",
        "status": "FOLLOWUP"
      }
    }
  ],
  "tasksDueSoon": [
    {
      "uuid": "9b96e572-7992-4f2f-bf9e-99e392402af6",
      "title": "Send product brochure",
      "dueDate": "2026-04-22T00:00:00.000Z",
      "lead": null
    }
  ],
  "followupsToday": [
    {
      "leadUuid": "8f74aa88-9c4f-40c7-b3e8-af34c1556809",
      "userFullName": "Jane Doe",
      "leadStatus": "FOLLOWUP",
      "followupAt": "2026-04-20T10:00:00.000Z",
      "notes": "Call after lunch"
    }
  ],
  "unreadCount": 2
}
```

Actual source of this payload:

- `DistributorTaskService.getNotifications(...)`
- tasks come from `DistributorTask`
- follow-ups come from `LeadActivity` rows where `actorUuid === distributorUuid`

⚠️ Distributor `unreadCount` is calculated as `tasksDueToday.length + followupsToday.length`.

⚠️ `tasksDueSoon` is not included in `unreadCount`.

### 3.3 Mark Notification as Read

No notification mark-read endpoint exists in the current backend.

There is:

- no `POST /notifications/:id/read`
- no `PATCH /notifications/:id/read`
- no mark-all-read endpoint
- no persisted notification read state

Frontend consequence:

- do not build a persistent "mark notification as read" API flow for notifications
- use broadcast dismiss/detail endpoints only for broadcast read state
- refetch notification endpoints after SSE events instead of mutating local unread state permanently

### 3.4 Notification Display Rules

Actual display guidance from current backend:

- Show notifications in a bell/inbox UI, not as persistent top banners
- Use `/api/v1/broadcasts/active` for broadcast unread badge
- Use `/api/v1/distributor/notifications` for distributor notification data
- Use `/api/v1/admin/notifications` for super-admin notification data

Unread-count behavior:

- distributor notifications have a backend-provided `unreadCount`
- admin notifications do not have `unreadCount`; derive UI count from array lengths if needed
- opening the bell does not persist a read state for notifications because there is no endpoint

Recommended frontend reaction to SSE `notification` event:

- if role is `DISTRIBUTOR`, refetch `/api/v1/distributor/notifications`
- if role is `SUPER_ADMIN`, refetch `/api/v1/admin/notifications`
- if role is `CUSTOMER` or `USER`, current codebase does not expose a notification REST endpoint for that role

---

## 4. Complete Implementation Guide

### 4.1 SSE + Polling Strategy (CRITICAL)

Recommended fallback strategy based on current backend and throttling:

```javascript
const API_BASE = 'http://localhost:3000'
let eventSource = null
let pollingInterval = null
let reconnectTimer = null
let reconnectDelay = 1000
let sseConnected = false

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
  }
}

function startPolling(syncFn) {
  if (pollingInterval) return

  syncFn()
  pollingInterval = setInterval(() => {
    if (!sseConnected) {
      syncFn()
    }
  }, 30000)
}

function closeSSE() {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
}

function scheduleReconnect(connectFn) {
  if (reconnectTimer) return

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connectFn()
  }, reconnectDelay)

  reconnectDelay = Math.min(reconnectDelay * 2, 30000)
}

function connectSSE(getAccessToken, syncFn) {
  const accessToken = getAccessToken()
  if (!accessToken) {
    sseConnected = false
    startPolling(syncFn)
    return
  }

  closeSSE()

  eventSource = new EventSource(
    `${API_BASE}/api/v1/sse/stream?token=${encodeURIComponent(accessToken)}`,
    { withCredentials: true }
  )

  eventSource.onopen = () => {
    sseConnected = true
    reconnectDelay = 1000
    stopPolling()
    syncFn()
  }

  eventSource.onmessage = (event) => {
    const payload = JSON.parse(event.data)

    if (payload.type === 'connected') {
      return
    }

    if (payload.type === 'broadcast' || payload.type === 'notification') {
      syncFn()
    }
  }

  eventSource.onerror = () => {
    sseConnected = false
    closeSSE()
    startPolling(syncFn)
    scheduleReconnect(() => connectSSE(getAccessToken, syncFn))
  }
}
```

🔴 CRITICAL rules:

- Never poll while SSE is connected
- Poll every 30 seconds only as fallback
- Close the old `EventSource` before creating a new one
- Refetch REST state on SSE events instead of trusting minimal SSE payloads

### 4.2 Bell Icon Implementation

Use broadcasts plus role-specific notifications.

```javascript
async function apiFetch(path, accessToken) {
  const response = await fetch(`http://localhost:3000${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    credentials: 'include'
  })

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  return response.json()
}

async function loadBellData(role, accessToken) {
  const activeBroadcasts = await apiFetch('/api/v1/broadcasts/active', accessToken)

  let notifications = null
  let notificationBadgeCount = 0

  if (role === 'DISTRIBUTOR') {
    notifications = await apiFetch('/api/v1/distributor/notifications?limit=50', accessToken)
    notificationBadgeCount = notifications.unreadCount
  }

  if (role === 'SUPER_ADMIN') {
    notifications = await apiFetch('/api/v1/admin/notifications', accessToken)
    notificationBadgeCount =
      notifications.followupsToday.length +
      notifications.overdueFollowups.length +
      notifications.tasksDueToday.length +
      notifications.overdueTasks.length
  }

  return {
    activeBroadcasts,
    notifications,
    broadcastBadgeCount: activeBroadcasts.unreadCount,
    notificationBadgeCount,
    totalBadgeCount: activeBroadcasts.unreadCount + notificationBadgeCount
  }
}

async function dismissBroadcast(uuid, accessToken) {
  const response = await fetch(`http://localhost:3000/api/v1/broadcasts/${uuid}/dismiss`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    credentials: 'include'
  })

  if (!response.ok) {
    throw new Error(`Dismiss failed: ${response.status}`)
  }

  return response.json()
}
```

⚠️ Do not implement "mark all notifications as read" against the backend. That endpoint does not exist.

### 4.3 Announcement Banner Implementation

Announcements come only from `/api/v1/broadcasts/active`.

```javascript
async function loadAnnouncementBanner(accessToken) {
  const data = await fetch('http://localhost:3000/api/v1/broadcasts/active', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    credentials: 'include'
  }).then((r) => {
    if (!r.ok) throw new Error(`Request failed: ${r.status}`)
    return r.json()
  })

  return data.announcements.map((item) => ({
    id: item.uuid,
    title: item.title,
    text: item.shortMessage,
    body: item.fullContent,
    link: item.link,
    expiresAt: item.expiresAt
  }))
}

function renderAnnouncementBanner(announcements) {
  const container = document.getElementById('announcement-banner')
  if (!container) return

  container.innerHTML = ''

  announcements.forEach((item) => {
    const row = document.createElement('div')
    row.className = 'announcement-banner-item'
    row.innerHTML = `
      <strong>${item.title}</strong>
      <p>${item.text}</p>
      ${item.link ? `<a href="${item.link}" target="_blank" rel="noreferrer">Learn more</a>` : ''}
    `
    container.appendChild(row)
  })
}
```

🔴 CRITICAL: Do not add a dismiss button for announcements. The backend rejects dismissal for `ANNOUNCEMENT`.

### 4.4 Token Refresh for SSE

There is no separate SSE refresh-token endpoint. The current backend pattern is:

1. get a fresh access token from your auth flow
2. close the old `EventSource`
3. reconnect with the new `?token=...`

```javascript
async function reconnectAfterTokenRefresh(refreshAccessToken, syncFn) {
  closeSSE()

  const newAccessToken = await refreshAccessToken()
  if (!newAccessToken) {
    throw new Error('Token refresh failed')
  }

  connectSSE(() => newAccessToken, syncFn)
}
```

⚠️ Native `EventSource` does not let you swap headers/tokens in-place. Recreate the connection.

### 4.5 Complete Working Example

```javascript
const API_BASE = 'http://localhost:3000'

export function createNSIRealtimeClient({
  role,
  getAccessToken,
  refreshAccessToken,
  onStateChange,
  onAuthFailure
}) {
  let eventSource = null
  let pollingInterval = null
  let reconnectTimer = null
  let reconnectDelay = 1000
  let sseConnected = false

  const state = {
    activeBroadcasts: {
      announcements: [],
      broadcasts: [],
      unreadCount: 0
    },
    notifications: null,
    bellCount: 0
  }

  async function apiFetch(path) {
    const accessToken = getAccessToken()
    if (!accessToken) {
      throw new Error('No access token')
    }

    const response = await fetch(`${API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      credentials: 'include'
    })

    if (response.status === 401) {
      try {
        await refreshAccessToken()
      } catch (error) {
        onAuthFailure?.(error)
        throw error
      }
      return apiFetch(path)
    }

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`)
    }

    return response.json()
  }

  async function syncAll() {
    const activeBroadcasts = await apiFetch('/api/v1/broadcasts/active')

    let notifications = null
    let notificationCount = 0

    if (role === 'DISTRIBUTOR') {
      notifications = await apiFetch('/api/v1/distributor/notifications?limit=50')
      notificationCount = notifications.unreadCount
    } else if (role === 'SUPER_ADMIN') {
      notifications = await apiFetch('/api/v1/admin/notifications')
      notificationCount =
        notifications.followupsToday.length +
        notifications.overdueFollowups.length +
        notifications.tasksDueToday.length +
        notifications.overdueTasks.length
    }

    state.activeBroadcasts = activeBroadcasts
    state.notifications = notifications
    state.bellCount = activeBroadcasts.unreadCount + notificationCount
    onStateChange?.({ ...state, sseConnected })
    return state
  }

  function stopPolling() {
    if (pollingInterval) {
      clearInterval(pollingInterval)
      pollingInterval = null
    }
  }

  function startPolling() {
    if (pollingInterval) return

    syncAll().catch(console.error)
    pollingInterval = setInterval(() => {
      if (!sseConnected) {
        syncAll().catch(console.error)
      }
    }, 30000)
  }

  function closeSSE() {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
  }

  function scheduleReconnect() {
    if (reconnectTimer) return

    reconnectTimer = setTimeout(async () => {
      reconnectTimer = null

      try {
        await connect()
      } catch (error) {
        console.error('Reconnect failed', error)
      }
    }, reconnectDelay)

    reconnectDelay = Math.min(reconnectDelay * 2, 30000)
  }

  async function handleSseMessage(payload) {
    if (payload.type === 'connected') {
      return
    }

    if (payload.type === 'broadcast') {
      await apiFetch('/api/v1/broadcasts/active').then((data) => {
        state.activeBroadcasts = data
      })
    }

    if (payload.type === 'notification') {
      if (role === 'DISTRIBUTOR') {
        state.notifications = await apiFetch('/api/v1/distributor/notifications?limit=50')
      } else if (role === 'SUPER_ADMIN') {
        state.notifications = await apiFetch('/api/v1/admin/notifications')
      }
    }

    const notificationCount =
      role === 'DISTRIBUTOR'
        ? state.notifications?.unreadCount ?? 0
        : role === 'SUPER_ADMIN'
          ? (state.notifications?.followupsToday?.length ?? 0) +
            (state.notifications?.overdueFollowups?.length ?? 0) +
            (state.notifications?.tasksDueToday?.length ?? 0) +
            (state.notifications?.overdueTasks?.length ?? 0)
          : 0

    state.bellCount = state.activeBroadcasts.unreadCount + notificationCount
    onStateChange?.({ ...state, sseConnected })
  }

  async function connect() {
    const accessToken = getAccessToken()
    if (!accessToken) {
      sseConnected = false
      startPolling()
      return
    }

    closeSSE()

    eventSource = new EventSource(
      `${API_BASE}/api/v1/sse/stream?token=${encodeURIComponent(accessToken)}`,
      { withCredentials: true }
    )

    eventSource.onopen = async () => {
      sseConnected = true
      reconnectDelay = 1000
      stopPolling()
      await syncAll()
    }

    eventSource.onmessage = async (event) => {
      try {
        const payload = JSON.parse(event.data)
        await handleSseMessage(payload)
      } catch (error) {
        console.error('Failed to handle SSE message', error)
      }
    }

    eventSource.onerror = async () => {
      sseConnected = false
      closeSSE()
      startPolling()

      try {
        await refreshAccessToken()
      } catch (error) {
        console.warn('Token refresh during SSE reconnect failed', error)
      }

      scheduleReconnect()
    }
  }

  async function dismissBroadcast(uuid) {
    const accessToken = getAccessToken()
    const response = await fetch(`${API_BASE}/api/v1/broadcasts/${uuid}/dismiss`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      credentials: 'include'
    })

    if (!response.ok) {
      throw new Error(`Dismiss failed: ${response.status}`)
    }

    await syncAll()
  }

  async function openBroadcast(uuid) {
    const detail = await apiFetch(`/api/v1/broadcasts/${uuid}`)
    await syncAll()
    return detail
  }

  function logoutCleanup() {
    sseConnected = false
    stopPolling()
    closeSSE()
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  return {
    connect,
    syncAll,
    dismissBroadcast,
    openBroadcast,
    logoutCleanup,
    getState: () => ({ ...state, sseConnected })
  }
}
```

---

## 5. SSE Event Shapes

Actual event envelope written by the backend:

```json
{
  "type": "broadcast",
  "data": {}
}
```

Actual event shapes emitted in current code:

```json
{
  "type": "connected"
}
```

```json
{
  "type": "broadcast",
  "data": {
    "broadcastUuid": "b3fd4b7b-61e0-4751-9f5c-daa9f6dd4a63",
    "title": "System Maintenance",
    "type": "ANNOUNCEMENT",
    "shortMessage": "Platform offline tonight",
    "link": "https://status.nsi.example/maintenance"
  }
}
```

```json
{
  "type": "broadcast",
  "data": {
    "broadcastUuid": "7ef83dbe-3c3c-49de-82f9-4af55f280bd9",
    "title": "For My Referred Users",
    "type": "BROADCAST",
    "shortMessage": "Please finish your pending profile setup"
  }
}
```

```json
{
  "type": "notification",
  "data": {
    "type": "NEW_LEAD",
    "leadUuid": "8d8f9d78-8a88-47c6-8f34-fd1fb58972f4",
    "message": "New lead assigned: Jane Doe"
  }
}
```

```json
{
  "type": "notification",
  "data": {
    "type": "FOLLOWUP_SCHEDULED",
    "leadUuid": "19a4f0c3-70f5-4d7e-bd5a-492598b2f544",
    "message": "Followup scheduled for Jane Doe at 4/20/2026, 3:30:00 PM"
  }
}
```

```json
{
  "type": "notification",
  "data": {
    "type": "NEW_TASK",
    "taskUuid": "ae1ce67d-9f08-47ce-bbdf-61d3dbe1c4d9",
    "message": "New task: Call the prospect"
  }
}
```

Keepalive frame from controller, not from `SseService`:

```text
:ping

```

⚠️ Distributor-created broadcast SSE payload currently has no `link` field.

⚠️ The full, user-visible source of truth is still the REST endpoints:

- `/api/v1/broadcasts/active`
- `/api/v1/admin/notifications`
- `/api/v1/distributor/notifications`

---

## 6. Error Handling

### 6.1 SSE Errors

Backend realities:

- `401` when token is missing, invalid, or expired
- `429` is possible because the app has a global throttler and aggressive polling can add pressure
- dropped network connection causes browser SSE error/reconnect behavior

Recommended frontend handling:

- on auth failure, refresh token and recreate `EventSource`
- on disconnect, close current `EventSource`, start fallback polling, and reconnect with exponential backoff
- on logout, always call `eventSource.close()`

⚠️ Native `EventSource` usually does not expose the HTTP status code in a useful way inside `onerror`.

### 6.2 API Errors

Standard backend error shape from `HttpExceptionFilter`:

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Broadcast 576d86e3-3ea5-4ba2-bd69-45d1c08f8841 not found",
  "timestamp": "2026-04-20T10:00:00.000Z",
  "path": "/api/v1/broadcasts/576d86e3-3ea5-4ba2-bd69-45d1c08f8841"
}
```

Common broadcast API errors:

- `400` validation error
- `400` announcement dismiss attempt
- `401` bad/missing token
- `403` wrong role
- `403` distributor deactivating another distributor's broadcast
- `404` broadcast missing, inactive, expired, or not visible to current user
- `429` throttled

Common notification API errors:

- `401` bad/missing token
- `403` wrong role
- `429` throttled

---

## 7. Important Rules Summary

### 🔴 CRITICAL rules Rudra must follow

- Put the SSE token in the query string for browser `EventSource`: `/api/v1/sse/stream?token=<access_token>`
- Never poll when SSE is connected
- Use exponential backoff when reconnecting SSE
- Close the old `EventSource` before opening a new one
- Close `EventSource` on logout
- Refetch `/api/v1/broadcasts/active` after every `broadcast` SSE event
- Refetch role-appropriate notification endpoint after every `notification` SSE event
- Announcements are non-dismissable
- `GET /api/v1/broadcasts/:uuid` auto-marks `BROADCAST` as read
- Only one SSE connection is kept per user UUID; a new tab replaces the old one

### ⚠️ Common mistakes to avoid

- Polling every 2 seconds
- Treating SSE payloads as the full source of truth
- Assuming `NEW_LEAD.data.leadUuid` is the `Lead.uuid`
- Assuming distributor notifications have a persisted read state
- Assuming admin notifications include an `unreadCount`
- Assuming distributor `tasksDueSoon` contributes to `unreadCount`
- Assuming distributor create can make announcements
- Assuming `link` is always present in broadcast SSE payloads
- Assuming `targetRole: 'ALL'` comes back as `'ALL'`; it is stored as `null`

### ✅ Correct patterns

- Use REST with `Authorization: Bearer <token>` for normal API calls
- Use query-param auth for browser SSE
- Show `announcements[]` as top banners
- Show `broadcasts[]` in bell/inbox UI
- Use `unreadCount` from `/api/v1/broadcasts/active` for broadcast badge
- For distributor bell counts, add broadcast `unreadCount` plus distributor notification `unreadCount`
- For super-admin bell counts, derive count from the four admin notification arrays
- Ignore SSE `:ping` keepalives
- Recreate SSE connection after token refresh
