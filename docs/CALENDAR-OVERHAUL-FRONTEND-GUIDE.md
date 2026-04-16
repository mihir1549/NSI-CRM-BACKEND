# Calendar Overhaul Frontend Guide

## 1. Overview

The calendar system returns a merged monthly event feed of notes, tasks, and follow-ups.

Source-backed changes in the current backend:

- Multiple notes per day are supported. `POST /calendar/notes` always creates a new row.
- Notes support an optional `time` in `HH:mm` 24-hour format.
- Tasks appear on the calendar automatically when they have a `dueDate`.
- Notes can be edited through dedicated note edit endpoints.
- The monthly calendar feed now contains three event types:
  - `NOTE`
  - `TASK`
  - `FOLLOWUP`
- Distributor and admin calendars use the same service and the same payload shapes. The only difference is the base URL and auth role.

Implementation detail from the code:

- Both distributor and admin calendars are powered by `DistributorCalendarService`.
- Notes are stored in `DistributorCalendarNote`.
- Tasks are stored in `DistributorTask`.
- Follow-ups come from `LeadActivity.followupAt`.

## 2. API Endpoints Table

### Distributor endpoints

| Method | URL | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/distributor/calendar?year=2026&month=4` | Bearer token + `DISTRIBUTOR` | Returns the merged monthly calendar feed for the current distributor. |
| `POST` | `/api/v1/distributor/calendar/notes` | Bearer token + `DISTRIBUTOR` | Creates a new calendar note. This is create-only, not upsert. |
| `GET` | `/api/v1/distributor/calendar/notes/:uuid/edit` | Bearer token + `DISTRIBUTOR` | Returns a single note payload for form pre-fill before editing. |
| `PATCH` | `/api/v1/distributor/calendar/notes/:uuid` | Bearer token + `DISTRIBUTOR` | Updates a specific existing note by UUID. |
| `DELETE` | `/api/v1/distributor/calendar/notes/:uuid` | Bearer token + `DISTRIBUTOR` | Deletes a specific existing note by UUID. |

### Admin endpoints

| Method | URL | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/admin/calendar?year=2026&month=4` | Bearer token + `SUPER_ADMIN` | Returns the merged monthly calendar feed for the current admin user. |
| `POST` | `/api/v1/admin/calendar/notes` | Bearer token + `SUPER_ADMIN` | Creates a new calendar note. This is create-only, not upsert. |
| `GET` | `/api/v1/admin/calendar/notes/:uuid/edit` | Bearer token + `SUPER_ADMIN` | Returns a single note payload for form pre-fill before editing. |
| `PATCH` | `/api/v1/admin/calendar/notes/:uuid` | Bearer token + `SUPER_ADMIN` | Updates a specific existing note by UUID. |
| `DELETE` | `/api/v1/admin/calendar/notes/:uuid` | Bearer token + `SUPER_ADMIN` | Deletes a specific existing note by UUID. |

Query validation for both `GET /calendar` endpoints:

- `year` is required
- `year` must be an integer between `2020` and `2100`
- `month` is required
- `month` must be an integer between `1` and `12`

Delete response for both roles:

```json
{
  "message": "Note deleted successfully"
}
```

## 3. Response Shapes

### 3.1 `GET /calendar`

Runtime response shape:

```ts
type CalendarEventResponse = {
  uuid: string;
  type: 'NOTE' | 'TASK' | 'FOLLOWUP';
  date: string;
  time: string | null;
  content: string | null;
  title: string | null;
  status: string | null;
  leadUuid?: string;
  leadStatus?: string;
};

type CalendarResponse = {
  year: number;
  month: number;
  events: CalendarEventResponse[];
};
```

Actual event source mapping from the service:

- `FOLLOWUP` events come from `leadActivity`
- `NOTE` events come from `distributorCalendarNote`
- `TASK` events come from `distributorTask`

Important optionality rules:

- `leadUuid` and `leadStatus` are only added for `FOLLOWUP`
- `title` is `null` for `NOTE`
- `content` is `null` for `TASK`
- `status` is only populated for `TASK`
- `time` is:
  - note time for `NOTE`
  - derived from `followupAt` for `FOLLOWUP`
  - always `null` for `TASK`

Example:

```json
{
  "year": 2026,
  "month": 4,
  "events": [
    {
      "uuid": "followup_uuid",
      "type": "FOLLOWUP",
      "date": "2026-04-10T14:30:00.000Z",
      "time": "14:30",
      "content": "Reminder note",
      "title": "Follow up with John Doe",
      "status": null,
      "leadUuid": "lead_uuid",
      "leadStatus": "HOT"
    },
    {
      "uuid": "note_uuid",
      "type": "NOTE",
      "date": "2026-04-11T00:00:00.000Z",
      "time": "09:00",
      "content": "Call supplier",
      "title": null,
      "status": null
    },
    {
      "uuid": "task_uuid",
      "type": "TASK",
      "date": "2026-04-11T00:00:00.000Z",
      "time": null,
      "content": null,
      "title": "Call John",
      "status": "TODO"
    }
  ]
}
```

### 3.2 `POST /calendar/notes`

Runtime response shape:

This route returns the created `DistributorCalendarNote` record directly.
It does not return `CalendarResponse`, even though the Swagger decorator currently points at `CalendarResponse`.

Important naming note:

- The response key is `distributorUuid` even on admin routes, because both roles use the same underlying model/service.

```ts
type CalendarNoteRecordResponse = {
  uuid: string;
  distributorUuid: string;
  date: string;
  note: string;
  time: string | null;
  createdAt: string;
  updatedAt: string;
};
```

Example:

```json
{
  "uuid": "note_uuid",
  "distributorUuid": "user_uuid",
  "date": "2026-04-15T00:00:00.000Z",
  "note": "Team meeting at 3pm",
  "time": "14:30",
  "createdAt": "2026-04-14T11:20:33.000Z",
  "updatedAt": "2026-04-14T11:20:33.000Z"
}
```

### 3.3 `GET /calendar/notes/:uuid/edit`

Runtime response shape:

```ts
type CalendarNoteEditResponse = {
  uuid: string;
  date: string;
  time: string | null;
  note: string;
};
```

Example:

```json
{
  "uuid": "note_uuid",
  "date": "2026-04-15T00:00:00.000Z",
  "time": "14:30",
  "note": "Team meeting at 3pm"
}
```

### 3.4 `PATCH /calendar/notes/:uuid`

Runtime response shape:

This route returns the full updated `DistributorCalendarNote` record.

Important naming note:

- The response key is `distributorUuid` even on admin routes, because both roles use the same underlying model/service.

```ts
type CalendarNoteUpdateResponse = {
  uuid: string;
  distributorUuid: string;
  date: string;
  note: string;
  time: string | null;
  createdAt: string;
  updatedAt: string;
};
```

Example:

```json
{
  "uuid": "note_uuid",
  "distributorUuid": "user_uuid",
  "date": "2026-04-16T00:00:00.000Z",
  "note": "Team meeting moved to tomorrow",
  "time": "15:00",
  "createdAt": "2026-04-14T11:20:33.000Z",
  "updatedAt": "2026-04-14T11:45:11.000Z"
}
```

## 4. Request Bodies

### 4.1 `POST /calendar/notes`

DTO: `CalendarNoteDto`

```ts
type CalendarNoteDto = {
  date: string;
  note: string;
  time?: string;
};
```

Validation rules from the DTO:

- `date`
  - required
  - `@IsDateString()`
- `note`
  - required
  - `@IsString()`
  - `@MaxLength(1000)`
- `time`
  - optional
  - `@IsString()`
  - must match `^([01]\d|2[0-3]):([0-5]\d)$`

Time examples accepted by backend:

- `09:00`
- `14:30`
- `22:15`

Important source-backed note:

- Even though `date` uses `@IsDateString()`, the service converts it using `new Date(dto.date + 'T00:00:00.000Z')`.
- Frontend should send date-only strings like `2026-04-15`.
- Do not send full ISO timestamps for note create/update.

Important create-note note:

- `CalendarNoteDto` does not have `@IsNotEmpty()` on `note`.
- Backend requires the field to exist and be a string, but it does not explicitly reject an empty string at DTO level.

Example request body:

```json
{
  "date": "2026-04-15",
  "note": "Team meeting at 3pm",
  "time": "14:30"
}
```

### 4.2 `PATCH /calendar/notes/:uuid`

DTO: `UpdateCalendarNoteDto`

```ts
type UpdateCalendarNoteDto = {
  note?: string;
  time?: string;
  date?: string;
};
```

Validation rules from the DTO:

- `note`
  - optional
  - `@IsString()`
  - `@IsNotEmpty()`
  - `@MaxLength(1000)`
- `time`
  - optional
  - `@IsString()`
  - must match `^([01]\d|2[0-3]):([0-5]\d)$`
- `date`
  - optional
  - `@IsDateString()`

Time examples accepted by backend:

- `09:00`
- `14:30`
- `22:15`

Important patch behavior from the service:

- Only supplied fields are updated.
- Omitted fields remain unchanged.
- If `date` is supplied, the service stores it as midnight UTC for that day.
- There is currently no source-backed way to clear an existing `time` back to `null` through `PATCH`, because:
  - `time` is optional, so omitting it means "leave unchanged"
  - `time` must be a valid `HH:mm` string if provided
  - `null` is not accepted by the DTO

Example request body:

```json
{
  "date": "2026-04-16",
  "note": "Team meeting moved to tomorrow",
  "time": "15:00"
}
```

## 5. Event Types Explained

### `NOTE`

Source:

- `DistributorCalendarNote`

Fields in calendar payload:

- `uuid`: populated
- `type`: `"NOTE"`
- `date`: populated
- `time`: populated if the note has a stored time, otherwise `null`
- `content`: populated from `note.note`
- `title`: `null`
- `status`: `null`
- `leadUuid`: omitted
- `leadStatus`: omitted

UI guidance:

- Render the main text from `content`
- Show time only when `time` exists
- Show edit/delete actions for this type only
- Do not expect a title field

### `TASK`

Source:

- `DistributorTask`

Fields in calendar payload:

- `uuid`: populated
- `type`: `"TASK"`
- `date`: populated from `dueDate`
- `time`: always `null`
- `content`: always `null`
- `title`: populated from `task.title`
- `status`: populated from `task.status`
- `leadUuid`: omitted
- `leadStatus`: omitted

Task statuses from the schema:

- `TODO`
- `IN_PROGRESS`
- `COMPLETE`

UI guidance:

- Render the main text from `title`
- Style by `status`
- Treat calendar tasks as read-only in this screen
- If the user wants to edit a task, route them to the Kanban/task flow instead of note edit APIs

Important source-backed note:

- `DistributorTask` has an optional `leadUuid` in the database model, but the calendar event payload does not expose it for `TASK` events

### `FOLLOWUP`

Source:

- `LeadActivity` rows where:
  - `actorUuid` = current user
  - `followupAt` is within the requested month

Fields in calendar payload:

- `uuid`: populated from `leadActivity.uuid`
- `type`: `"FOLLOWUP"`
- `date`: populated from `followupAt`
- `time`: populated from `followupAt` as `HH:mm`
- `content`: populated from `activity.notes`, can be `null`
- `title`: populated as `Follow up with ${lead.user.fullName}`
- `status`: `null`
- `leadUuid`: populated
- `leadStatus`: populated

UI guidance:

- Render the main label from `title`
- Render `content` as secondary helper text when present
- Use `leadUuid` and `leadStatus` for deep-linking to the lead view if the frontend supports it
- Treat follow-ups as read-only in the calendar UI

## 6. Frontend Implementation Guide

### Monthly view

- Call the monthly endpoint with `year` and `month`
- Render `events` grouped by calendar day
- The backend already merges notes, tasks, and follow-ups into one list
- Do not make separate requests per event type for the calendar grid

### Event rendering

Recommended UI treatment based on the returned `type`:

- `NOTE`
  - blue styling
  - primary text from `content`
  - optional time badge when `time` exists
- `TASK`
  - use task colors by status
  - `TODO` -> amber
  - `IN_PROGRESS` -> green
  - `COMPLETE` -> gray
  - primary text from `title`
- `FOLLOWUP`
  - red or orange styling
  - primary text from `title`
  - optional subtext from `content`
  - optionally show `leadStatus`

### Sorting

The backend sorts the merged `events` array before returning it.

Source-backed behavior:

- it sorts by the full `date` timestamp ascending
- if two events have the exact same `date` value, it compares `time`
- if only one of those equal-date events has `time`, the timed event comes first
- if both have no `time`, their relative order stays unchanged by the final comparator
- notes are also fetched with `orderBy [{ date: 'asc' }, { time: 'asc' }]` before the merged sort runs

Frontend should therefore:

- preserve backend order inside each day
- not re-sort unless you are intentionally applying the same timestamp-first logic

### Create note modal

- Use `date`, `note`, and optional `time`
- Do not include a `title` field; notes do not have one anywhere in the DTO or model
- Send `date` as `YYYY-MM-DD`
- Send `time` as `HH:mm` only when the user chooses a time

### Edit note flow

- Use `GET /calendar/notes/:uuid/edit` first
- Pre-fill the form from:
  - `date`
  - `time`
  - `note`
- Save with `PATCH /calendar/notes/:uuid`
- Only notes should enter this flow

### Task behavior in calendar

- Tasks are read-only in the calendar view
- They appear automatically when `dueDate` exists and falls inside the requested month
- Tasks without `dueDate` do not appear in the calendar response
- Edit tasks through the task/Kanban endpoints, not the note endpoints

### Follow-up behavior in calendar

- Follow-ups are read-only in the calendar view
- They come from the lead activity system
- They are scoped to follow-ups created by the current user because the service filters by `actorUuid`
- If your frontend has lead detail pages, `leadUuid` is the linkable identifier

### Shared admin/distributor behavior

- The response shapes are identical for admin and distributor calendars
- Reuse the same frontend calendar components for both
- Switch only:
  - base URL
  - auth role gating

## 7. Key Rules

- `POST /calendar/notes` always creates a new note. It does not overwrite an existing note for that date.
- Multiple notes on the same day are allowed.
- Time is optional.
- Notes without time return `time: null`.
- `time` must be `HH:mm` in 24-hour format.
- Frontend should send note dates as `YYYY-MM-DD`, not full ISO timestamps.
- Tasks appear on the calendar only when `dueDate` is set.
- Follow-up events can include `leadUuid` and `leadStatus`.
- Admin calendar and distributor calendar use the same runtime response shape.
- Note create/update responses use the field name `distributorUuid` for both roles.
- Only `NOTE` events can be edited or deleted through the calendar note APIs.
- `TASK` and `FOLLOWUP` UUIDs are not note UUIDs; do not send them to note edit/delete endpoints.
- `PATCH /calendar/notes/:uuid` updates only provided fields.
- There is no source-backed API path to clear an existing note time back to `null`.

## 8. Migration Notes for Rudra

Source-backed migration implications from the current implementation:

- Existing frontend code must stop assuming "one note per date". The service comment and create logic explicitly show that note creation now creates a new row every time.
- Existing frontend code must stop assuming the monthly calendar response is notes-only. The current response is a merged `events` array containing `NOTE`, `TASK`, and `FOLLOWUP`.
- Existing frontend code must branch calendar click behavior by `type`:
  - `NOTE` -> editable
  - `TASK` -> read-only in calendar, redirect to task management
  - `FOLLOWUP` -> read-only in calendar, redirect to lead context if needed
- Editing is now UUID-based per note. Use:
  - `GET /calendar/notes/:uuid/edit`
  - `PATCH /calendar/notes/:uuid`
- Frontend forms should use `note` as the editable field name, not `content`.
- If the old client sent full ISO timestamps for note dates, that should be changed to `YYYY-MM-DD` to match the service implementation.
