# NSI LMS Frontend Guide
Version: 1.0 | Generated: April 2026
Source: Read directly from codebase - not guessed

This guide follows actual controller decorators, service return values, Prisma schema, and shared helpers.

⚠️ Runtime wins over Swagger in a few places:
- Several admin write endpoints return full raw Prisma records, not just `{ uuid }`.
- `GET /api/v1/lms/courses/:uuid/certificate` actually returns `{ certificateUrl, certificateId }`.
- `totalDuration` is stored as a string in Prisma and returned as a string by LMS read services.
- `originalPrice` is converted to a number in LMS read endpoints, but raw Prisma write responses serialize it as a string because it is a Prisma `Decimal`.
- Some response DTOs are stale and omit runtime fields like `bunnyVideoId` or runtime `null` values.

⚠️ Repo note:
- There is no `src/admin/admin.controller.ts` in this codebase.
- LMS admin routes live in `src/lms/courses-admin.controller.ts` and `src/lms/lms-upload.controller.ts`.

All URLs below include the real global prefix and URI versioning from `src/main.ts`:
- Base prefix: `/api`
- Versioning: `/v1`

---

## 0. Quick Reference - All LMS Endpoints

### Admin Endpoints (`SUPER_ADMIN`)

| Method | URL | Auth Role | Description |
| --- | --- | --- | --- |
| `POST` | `/api/v1/admin/courses` | `SUPER_ADMIN` | Create a course |
| `GET` | `/api/v1/admin/courses` | `SUPER_ADMIN` | List all courses (admin view) |
| `GET` | `/api/v1/admin/courses/:uuid` | `SUPER_ADMIN` | Get course detail |
| `GET` | `/api/v1/admin/courses/:uuid/edit` | `SUPER_ADMIN` | Get course edit payload |
| `PATCH` | `/api/v1/admin/courses/:uuid` | `SUPER_ADMIN` | Update course fields |
| `PATCH` | `/api/v1/admin/courses/:uuid/publish` | `SUPER_ADMIN` | Publish a course |
| `PATCH` | `/api/v1/admin/courses/:uuid/unpublish` | `SUPER_ADMIN` | Unpublish a course |
| `DELETE` | `/api/v1/admin/courses/:uuid` | `SUPER_ADMIN` | Delete a course if it has no enrollments |
| `POST` | `/api/v1/admin/courses/:uuid/sections` | `SUPER_ADMIN` | Create a section inside a course |
| `PATCH` | `/api/v1/admin/courses/:courseUuid/sections/reorder` | `SUPER_ADMIN` | Reorder section UUIDs |
| `GET` | `/api/v1/admin/courses/:courseUuid/sections/:sectionUuid/edit` | `SUPER_ADMIN` | Get section edit payload |
| `PATCH` | `/api/v1/admin/courses/:courseUuid/sections/:sectionUuid` | `SUPER_ADMIN` | Update a section |
| `DELETE` | `/api/v1/admin/courses/:courseUuid/sections/:sectionUuid` | `SUPER_ADMIN` | Delete a section |
| `POST` | `/api/v1/admin/courses/:courseUuid/sections/:sectionUuid/lessons` | `SUPER_ADMIN` | Create a lesson |
| `PATCH` | `/api/v1/admin/courses/:courseUuid/sections/:sectionUuid/lessons/reorder` | `SUPER_ADMIN` | Reorder lesson UUIDs |
| `GET` | `/api/v1/admin/courses/:courseUuid/sections/:sectionUuid/lessons/:lessonUuid/edit` | `SUPER_ADMIN` | Get lesson edit payload |
| `PATCH` | `/api/v1/admin/courses/:courseUuid/sections/:sectionUuid/lessons/:lessonUuid` | `SUPER_ADMIN` | Update a lesson |
| `DELETE` | `/api/v1/admin/courses/:courseUuid/sections/:sectionUuid/lessons/:lessonUuid` | `SUPER_ADMIN` | Delete a lesson |
| `GET` | `/api/v1/admin/lms/analytics` | `SUPER_ADMIN` | LMS admin summary analytics |
| `POST` | `/api/v1/admin/lms/upload` | `SUPER_ADMIN` | Upload thumbnail or PDF attachment |
| `POST` | `/api/v1/admin/lms/upload-pdf` | `SUPER_ADMIN` | Legacy PDF-only upload |

### User Endpoints (`CUSTOMER` / `DISTRIBUTOR`)

| Method | URL | Auth Role | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/lms/courses` | `CUSTOMER`, `DISTRIBUTOR` | Browse published courses |
| `GET` | `/api/v1/lms/courses/:uuid` | `CUSTOMER`, `DISTRIBUTOR` | Get course detail and preview-aware lesson list |
| `POST` | `/api/v1/lms/courses/:uuid/enroll` | `CUSTOMER`, `DISTRIBUTOR` | Free enroll or start paid enrollment |
| `GET` | `/api/v1/lms/courses/:uuid/learn` | `CUSTOMER`, `DISTRIBUTOR` | Get full learning payload for enrolled users |
| `GET` | `/api/v1/lms/my-courses` | `CUSTOMER`, `DISTRIBUTOR` | Get current user's enrolled courses |
| `GET` | `/api/v1/lms/lessons/:uuid` | `CUSTOMER`, `DISTRIBUTOR` | Get one lesson if enrolled and unlocked |
| `GET` | `/api/v1/lms/lessons/:uuid/refresh-token` | `CUSTOMER`, `DISTRIBUTOR` | Refresh Bunny lesson token |
| `POST` | `/api/v1/lms/lessons/:uuid/progress` | `CUSTOMER`, `DISTRIBUTOR` | Save watched seconds |
| `POST` | `/api/v1/lms/lessons/:uuid/complete` | `CUSTOMER`, `DISTRIBUTOR` | Manually complete a lesson |
| `GET` | `/api/v1/lms/courses/:uuid/certificate` | `CUSTOMER`, `DISTRIBUTOR` | Get or generate certificate |

### Analytics Endpoints (`SUPER_ADMIN`)

| Method | URL | Auth Role | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/admin/analytics/lms-videos` | `SUPER_ADMIN` | LMS course video summary across published courses |
| `GET` | `/api/v1/admin/analytics/lms-videos/:courseUuid` | `SUPER_ADMIN` | Per-course lesson analytics |
| `GET` | `/api/v1/admin/analytics/lms-videos/:courseUuid/lessons/:lessonUuid` | `SUPER_ADMIN` | Deep lesson analytics with heatmap |
| `GET` | `/api/v1/admin/analytics/course-previews` | `SUPER_ADMIN` | Course preview analytics |

⚠️ `VideoAnalyticsController` also contains `/api/v1/admin/analytics/funnel-videos`, but that endpoint is funnel analytics, not LMS course analytics, so it is not documented as part of the LMS frontend surface.

---

## 1. Global Rules for LMS

### 1.1 Authentication

- Exact auth header: `Authorization: Bearer <JWT access token>`
- Swagger bearer scheme name: `access-token`
- All LMS routes are protected. There are no public LMS browse or preview endpoints.
- Admin LMS routes require `JwtAuthGuard + RolesGuard + @Roles('SUPER_ADMIN')`.
- User LMS routes require `JwtAuthGuard + RolesGuard + @Roles('CUSTOMER', 'DISTRIBUTOR')`.
- `RolesGuard` re-fetches the user from the database and does not trust the JWT role claim as the source of truth.

### 1.2 Video Player Rules (CRITICAL)

🔴 CRITICAL:
- Use `<iframe>` when `videoProvider === "bunny"`.
- Use `<video>` only when `videoProvider === "direct"` and `videoUrl` is non-null.
- Never guess the provider from `videoUrl`. The backend decides the provider from `bunnyVideoId`.

Actual Bunny signed URL format from `BunnyVideoProvider.getSignedUrl()`:

```text
https://iframe.mediadelivery.net/embed/{libraryId}/{videoId}?token={sha256(tokenKey + videoId + expiresUnix)}&expires={expiresUnix}
```

Actual backend token behavior:
- Bunny lesson URLs are signed for `7200` seconds (`2` hours).
- `videoExpiry` is a Unix timestamp in seconds.
- `videoExpiry` is only set for Bunny lesson URLs.
- Direct videos return `videoExpiry: null`.

Frontend-safe rules:
- If `videoProvider === "bunny"`, render the signed URL in an `<iframe src="...">`.
- If `videoProvider === "direct"`, render `videoUrl` in a `<video src="...">`.
- If `videoUrl` is `null`, do not render a player even if `videoProvider === "direct"`.

⚠️ Course-level `previewVideoUrl` is just a raw URL field.
- There is no course-level `videoProvider` field in LMS responses.
- There is no course-level token refresh endpoint.
- Current signed preview URLs are generated only for preview lessons, not for `course.previewVideoUrl`.

🔴 CRITICAL token refresh rule:
- Refresh Bunny lesson URLs before `videoExpiry`.
- Backend does not auto-refresh old URLs.
- `GET /api/v1/lms/lessons/:uuid/refresh-token` only works when the lesson has `bunnyVideoId`.

Inference from code:
- Because the backend gives a 2-hour token, a frontend refresh timer at about 90 minutes is a safe early-refresh pattern.

### 1.3 File Upload Rules

Primary upload endpoint:
- `POST /api/v1/admin/lms/upload`
- Auth: `SUPER_ADMIN`
- Content type: `multipart/form-data`

Exact multipart fields:
- `file`: binary file, required
- `folder`: string, required, must be one of `thumbnails` or `attachments`

Allowed file types:
- `thumbnails`: `image/jpeg`, `image/png`, `image/webp`
- `attachments`: `application/pdf`

Max file size:
- `50 * 1024 * 1024` bytes (`50 MB`) via Multer `limits.fileSize`

Folder mapping:
- `thumbnails` -> `nsi-thumbnails`
- `attachments` -> `nsi-attachments`

Exact response shape:

```json
{
  "url": "https://your-r2-public-url/nsi-thumbnails/UPLOAD-1713590000000-ab12cd.jpg"
}
```

How upload URLs are used by LMS endpoints:
- Course thumbnail uploads -> send returned URL as `thumbnailUrl` in course create/update.
- Lesson attachment uploads -> send returned URL as `attachmentUrl` in lesson create/update.
- Legacy lesson PDFs can still use `pdfUrl`, but the general upload endpoint is designed for `attachmentUrl`.

Legacy PDF endpoint:
- `POST /api/v1/admin/lms/upload-pdf`
- Accepts only `file`
- Requires `application/pdf`
- Uploads into `nsi-lms-pdfs`
- Returns `{ "url": "..." }`

### 1.4 Pagination

There is no LMS pagination in the current code.

Actual behavior:
- No LMS admin controller method uses `@Query()` for `page`, `limit`, or filters.
- No LMS user controller method uses `@Query()` for pagination.
- All current list endpoints return full arrays or full nested payloads.

That means:
- `GET /api/v1/admin/courses` returns the full admin course array.
- `GET /api/v1/lms/courses` returns the full published course array.
- `GET /api/v1/lms/my-courses` returns `{ courses: [...] }` with no paging.
- The video analytics LMS endpoints also accept no `from` / `to` query params in current code.

### 1.5 Error Responses

Global error shape from `HttpExceptionFilter`:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "timestamp": "2026-04-20T10:15:00.000Z",
  "path": "/api/v1/lms/courses/..."
}
```

Validation behavior from global `ValidationPipe`:
- `whitelist: true` -> unknown fields are stripped
- `forbidNonWhitelisted: true` -> unknown fields cause a `400`
- `transform: true` -> request bodies are transformed to DTO instances

Common LMS error codes:
- `400` validation errors, invalid upload folder/type, paid/free mismatch, course not published, certificate not ready, no Bunny stream on refresh route
- `403` insufficient role, not enrolled, previous lesson not completed
- `404` course/section/lesson/enrollment not found
- `409` already enrolled
- `500` unexpected runtime failures, including certificate generation/storage errors

---

## 2. ADMIN - Course Management

⚠️ Write-response rule for admin course endpoints:
- `POST /admin/courses`
- `PATCH /admin/courses/:uuid`
- `PATCH /admin/courses/:uuid/publish`
- `PATCH /admin/courses/:uuid/unpublish`

All four return the raw Prisma `Course` record, not a minimal `{ uuid }` payload.

### 2.1 Create Course

- URL: `POST /api/v1/admin/courses`
- Auth: `SUPER_ADMIN`

Request body:

```ts
interface CreateCourseRequest {
  title: string; // required, @IsString @IsNotEmpty, course title
  description: string; // required, @IsString @IsNotEmpty, course description
  thumbnailUrl?: string; // optional, @IsUrl, thumbnail image URL
  isFree: boolean; // required, @IsBoolean, true for free courses
  price?: number; // required only when isFree === false, @IsNumber @Min(0), price in rupees
  previewVideoUrl?: string; // optional, @IsUrl, raw course-level preview URL
  badge?: string; // optional, @IsString, course badge label
  instructors?: string[]; // optional, @IsArray @IsString({ each: true }), instructor names
  whatYouWillLearn?: string[]; // optional, @IsArray @IsString({ each: true }), learning outcomes
  originalPrice?: number; // optional, @IsNumber @Min(0), original price before discount
  totalDuration?: string; // optional, @IsString, human-readable duration like "12h 30m"
  enrollmentBoost?: number; // optional, @IsInt @Min(0), artificial boost added to displayed enrollment count
}
```

Actual create-time business rules:
- If `isFree === false`, `price` must be present or the service throws `400 Price is required for paid courses`.
- If `isFree === true`, the service stores `price: 0` even if `price` is omitted.
- `instructors` defaults to `[]`.
- `whatYouWillLearn` defaults to `[]`.
- `enrollmentBoost` defaults to `0`.
- `isPublished` is not part of the create DTO and starts as `false`.
- `previewBunnyVideoId` exists in Prisma but is not exposed by the current create DTO.

Actual response example:

```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Kangen Water Business Masterclass",
  "description": "Learn how to build a Kangen Water distribution business from scratch.",
  "thumbnailUrl": "https://cdn.example.com/nsi-thumbnails/UPLOAD-1713590000000-ab12cd.jpg",
  "isFree": false,
  "price": 999,
  "isPublished": false,
  "createdAt": "2026-04-20T10:15:00.000Z",
  "updatedAt": "2026-04-20T10:15:00.000Z",
  "previewVideoUrl": "https://player.example.com/course-preview",
  "previewBunnyVideoId": null,
  "badge": "BESTSELLER",
  "instructors": ["Nageshwar Shukla", "Dr. Patel"],
  "whatYouWillLearn": ["Build a team", "Master Kangen science"],
  "originalPrice": "1999",
  "totalDuration": "12h 30m",
  "enrollmentBoost": 50
}
```

Error responses:
- `400` validation error or missing `price` for a paid course
- `403` insufficient permissions

### 2.2 List Courses (Admin)

- URL: `GET /api/v1/admin/courses`
- Auth: `SUPER_ADMIN`
- Query params: none
- Pagination: none
- Sorting: newest first by `createdAt DESC`

Actual response shape:

```json
[
  {
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Kangen Water Masterclass",
    "description": "Learn everything about Kangen water.",
    "thumbnailUrl": "https://cdn.example.com/nsi-thumbnails/UPLOAD-1713590000000-ab12cd.jpg",
    "isFree": false,
    "price": 999,
    "isPublished": true,
    "badge": "BESTSELLER",
    "createdAt": "2026-04-20T10:15:00.000Z",
    "totalEnrollments": 150,
    "totalLessons": 25
  }
]
```

Each course object fields:
- `totalEnrollments` is the real enrollment count from `_count.enrollments`
- `totalLessons` is calculated from section lesson counts
- `totalLessons` includes all lessons in the course, not only published lessons

Error responses:
- `403` insufficient permissions

### 2.3 Get Course Detail (Admin)

- URL: `GET /api/v1/admin/courses/:uuid`
- Auth: `SUPER_ADMIN`

Actual response shape:

```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Kangen Water Masterclass",
  "description": "Learn everything about Kangen water.",
  "thumbnailUrl": "https://cdn.example.com/nsi-thumbnails/UPLOAD-1713590000000-ab12cd.jpg",
  "isFree": false,
  "price": 999,
  "isPublished": true,
  "createdAt": "2026-04-20T10:15:00.000Z",
  "previewVideoUrl": "https://player.example.com/course-preview",
  "badge": "BESTSELLER",
  "instructors": ["Nageshwar Shukla"],
  "whatYouWillLearn": ["Build a team", "Master Kangen science"],
  "originalPrice": 1999,
  "totalDuration": "12h 30m",
  "enrollmentBoost": 50,
  "totalEnrollments": 150,
  "totalLessons": 25,
  "totalSections": 5,
  "totalPdfs": 10,
  "discountPercent": 50,
  "sections": [
    {
      "uuid": "2cb1eb66-f8d7-4125-8ac2-0e3c4fa6f111",
      "title": "Module 1",
      "order": 1,
      "lessons": [
        {
          "uuid": "10911bf0-c0a7-4fd5-bb05-48f76734a111",
          "title": "Introduction",
          "description": "Welcome to the course.",
          "videoUrl": "https://cdn.example.com/direct-video.mp4",
          "videoDuration": 900,
          "textContent": "<p>Lesson notes here...</p>",
          "pdfUrl": null,
          "isPreview": true,
          "attachmentUrl": "https://cdn.example.com/nsi-attachments/UPLOAD-1713590000000-ab12cd.pdf",
          "attachmentName": "Lesson Slides.pdf",
          "order": 1,
          "isPublished": true
        }
      ]
    }
  ]
}
```

Actual computed fields:
- `discountPercent = Math.round(((originalPrice - price) / originalPrice) * 100)` only when `originalPrice > price`
- `totalPdfs` counts lessons where `attachmentUrl != null`
- `originalPrice` is converted to a number here

⚠️ This payload does not include `previewBunnyVideoId` or lesson `bunnyVideoId`, even though both fields exist in Prisma.

Error responses:
- `404` course not found
- `400` malformed UUID only on this route because the controller uses `ParseUUIDPipe`

### 2.4 Get Course for Editing

- URL: `GET /api/v1/admin/courses/:uuid/edit`
- Auth: `SUPER_ADMIN`

Actual response shape:

```json
{
  "title": "Kangen Water Masterclass",
  "description": "Learn everything about Kangen water.",
  "thumbnailUrl": "https://cdn.example.com/nsi-thumbnails/UPLOAD-1713590000000-ab12cd.jpg",
  "isFree": false,
  "price": 999,
  "previewVideoUrl": "https://player.example.com/course-preview",
  "previewBunnyVideoId": "cccccccc-cccc-cccc-cccc-cccccccccccc",
  "badge": "BESTSELLER",
  "instructors": ["Nageshwar Shukla"],
  "whatYouWillLearn": ["Build a team", "Master Kangen science"],
  "originalPrice": 1999,
  "totalDuration": "12h 30m",
  "enrollmentBoost": 50
}
```

Editable fields exposed by this endpoint:
- `title`
- `description`
- `thumbnailUrl`
- `isFree`
- `price`
- `previewVideoUrl`
- `previewBunnyVideoId`
- `badge`
- `instructors`
- `whatYouWillLearn`
- `originalPrice`
- `totalDuration`
- `enrollmentBoost`

⚠️ Not exposed for editing through the current LMS admin API:
- `isPublished`

Error responses:
- `404` course not found
- `400` malformed UUID only on this route because the controller uses `ParseUUIDPipe`

### 2.5 Update Course

- URL: `PATCH /api/v1/admin/courses/:uuid`
- Auth: `SUPER_ADMIN`

Request body:

```ts
interface UpdateCourseRequest {
  title?: string; // optional, @IsString @IsNotEmpty
  description?: string; // optional, @IsString @IsNotEmpty
  thumbnailUrl?: string | null; // optional, @IsUrl when non-null
  isFree?: boolean; // optional, @IsBoolean
  price?: number; // optional, @IsNumber @Min(0)
  previewVideoUrl?: string | null; // optional, @IsUrl when non-null
  previewBunnyVideoId?: string | null; // optional, @IsString, Bunny Stream GUID for course-level preview video. Set this to link a Bunny video as the course preview. Use in course landing page alongside previewVideoUrl (legacy).
  badge?: string | null; // optional, @IsString
  instructors?: string[]; // optional, @IsArray @IsString({ each: true })
  whatYouWillLearn?: string[]; // optional, @IsArray @IsString({ each: true })
  originalPrice?: number | null; // optional, @IsNumber @Min(0)
  totalDuration?: string | null; // optional, @IsString
  enrollmentBoost?: number; // optional, @IsInt @Min(0)
}
```

Special field notes from actual code:
- `badge`, `thumbnailUrl`, `previewVideoUrl`, `previewBunnyVideoId`, `originalPrice`, `totalDuration` are only updated when the key exists in the body.
- `instructors[]` and `whatYouWillLearn[]` fully replace the stored arrays when provided.
- `enrollmentBoost` is stored directly; no derived validation beyond `@IsInt @Min(0)`.
- `previewBunnyVideoId` is part of `UpdateCourseDto` and updates `course.previewBunnyVideoId` when provided.

Actual business rules:
- Unlike create, update does not re-check "paid course must have price".
- Update writes `isFree` and `price` independently.
- If you switch `isFree` to `true`, the service does not auto-zero `price`.
- If you switch `isFree` to `false`, the service does not auto-require `price`.

Computed values used elsewhere:
- `discountPercent` is not persisted; it is computed on read as `Math.round(((originalPrice - price) / originalPrice) * 100)` when `originalPrice > price`.
- `displayEnrollmentCount` is not persisted; user-facing reads compute it as `realEnrollments + enrollmentBoost`.

Actual response example:

```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Kangen Water Masterclass - Updated",
  "description": "Updated course description.",
  "thumbnailUrl": "https://cdn.example.com/nsi-thumbnails/UPLOAD-1713591111111-zx98cv.jpg",
  "isFree": false,
  "price": 899,
  "isPublished": true,
  "createdAt": "2026-04-20T10:15:00.000Z",
  "updatedAt": "2026-04-20T11:45:00.000Z",
  "previewVideoUrl": "https://player.example.com/course-preview-v2",
  "previewBunnyVideoId": null,
  "badge": "TRENDING",
  "instructors": ["Nageshwar Shukla"],
  "whatYouWillLearn": ["Build a team", "Master Kangen science"],
  "originalPrice": "1999",
  "totalDuration": "13h 00m",
  "enrollmentBoost": 75
}
```

Error responses:
- `404` course not found
- `400` malformed UUID only on this route because the controller uses `ParseUUIDPipe`
- `400` validation errors for bad body fields

### 2.6 Publish / Unpublish Course

Publish:
- URL: `PATCH /api/v1/admin/courses/:uuid/publish`
- Auth: `SUPER_ADMIN`
- Body: none

Unpublish:
- URL: `PATCH /api/v1/admin/courses/:uuid/unpublish`
- Auth: `SUPER_ADMIN`
- Body: none

Actual business rules:
- The service only checks that the course exists.
- There is no validation for minimum sections, minimum lessons, or required preview assets before publish.

Actual publish response example:

```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Kangen Water Masterclass",
  "description": "Learn everything about Kangen water.",
  "thumbnailUrl": "https://cdn.example.com/nsi-thumbnails/UPLOAD-1713590000000-ab12cd.jpg",
  "isFree": false,
  "price": 999,
  "isPublished": true,
  "createdAt": "2026-04-20T10:15:00.000Z",
  "updatedAt": "2026-04-20T12:00:00.000Z",
  "previewVideoUrl": "https://player.example.com/course-preview",
  "previewBunnyVideoId": null,
  "badge": "BESTSELLER",
  "instructors": ["Nageshwar Shukla"],
  "whatYouWillLearn": ["Build a team", "Master Kangen science"],
  "originalPrice": "1999",
  "totalDuration": "12h 30m",
  "enrollmentBoost": 50
}
```

Actual unpublish response is the same shape, with `isPublished: false`.

Error responses:
- `404` course not found
- `400` malformed UUID only on these routes because the controller uses `ParseUUIDPipe`

### 2.7 Delete Course

- URL: `DELETE /api/v1/admin/courses/:uuid`
- Auth: `SUPER_ADMIN`
- Body: none

Actual delete rule:
- The course can only be deleted when `courseEnrollment.count({ where: { courseUuid } }) === 0`.
- If enrollments exist, the service throws `400 Cannot delete course with active enrollments. Unpublish it instead.`

Actual response:

```json
{
  "deleted": true
}
```

Actual cascade effect from Prisma schema:
- Deleting a course cascades to `CourseSection`
- Deleting a section cascades to `CourseLesson`
- Deleting a lesson cascades to `LessonProgress`

Error responses:
- `400` course has enrollments
- `404` course not found
- `400` malformed UUID only on this route because the controller uses `ParseUUIDPipe`

---

## 3. ADMIN - Section Management

### 3.1 Create Section

- URL: `POST /api/v1/admin/courses/:uuid/sections`
- Auth: `SUPER_ADMIN`

Request body:

```ts
interface CreateSectionRequest {
  title: string; // required, @IsString @IsNotEmpty
  order: number; // required, @IsInt @Min(1)
}
```

Actual response example:

```json
{
  "uuid": "2cb1eb66-f8d7-4125-8ac2-0e3c4fa6f111",
  "courseUuid": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Module 1",
  "order": 1,
  "createdAt": "2026-04-20T12:15:00.000Z",
  "updatedAt": "2026-04-20T12:15:00.000Z"
}
```

Error responses:
- `404` course not found
- `400` validation errors

### 3.2 Get Section for Editing

- URL: `GET /api/v1/admin/courses/:courseUuid/sections/:sectionUuid/edit`
- Auth: `SUPER_ADMIN`

Actual response:

```json
{
  "title": "Module 1",
  "order": 1
}
```

Error responses:
- `404` section not found in this course

### 3.3 Update Section

- URL: `PATCH /api/v1/admin/courses/:courseUuid/sections/:sectionUuid`
- Auth: `SUPER_ADMIN`

Request body:

```ts
interface UpdateSectionRequest {
  title?: string; // optional, @IsString @IsNotEmpty
  order?: number; // optional, @IsInt @Min(1)
}
```

Actual response example:

```json
{
  "uuid": "2cb1eb66-f8d7-4125-8ac2-0e3c4fa6f111",
  "courseUuid": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Module 1 - Updated",
  "order": 2,
  "createdAt": "2026-04-20T12:15:00.000Z",
  "updatedAt": "2026-04-20T12:25:00.000Z"
}
```

Error responses:
- `404` section not found in this course
- `400` validation errors

### 3.4 Reorder Sections

- URL: `PATCH /api/v1/admin/courses/:courseUuid/sections/reorder`
- Auth: `SUPER_ADMIN`

Request body:

```ts
interface ReorderSectionsRequest {
  orderedUuids: string[]; // required, @IsArray @IsUUID('4', { each: true })
}
```

Actual response:

```json
{
  "reordered": true
}
```

⚠️ Actual backend behavior:
- The service checks that the parent course exists.
- It does not verify that every UUID in `orderedUuids` belongs to that course.
- Frontend must send only sibling section UUIDs for the target course.

Error responses:
- `404` course not found
- `400` validation errors for non-array / non-UUID payloads

### 3.5 Delete Section

- URL: `DELETE /api/v1/admin/courses/:courseUuid/sections/:sectionUuid`
- Auth: `SUPER_ADMIN`

Actual business rules:
- Only existence is checked.
- There is no "must be empty" rule.
- Deleting a section cascades to its lessons and their lesson-progress rows.

Actual response:

```json
{
  "deleted": true
}
```

Error responses:
- `404` section not found in this course

---

## 4. ADMIN - Lesson Management

### 4.1 Create Lesson

- URL: `POST /api/v1/admin/courses/:courseUuid/sections/:sectionUuid/lessons`
- Auth: `SUPER_ADMIN`

Request body:

```ts
interface CreateLessonRequest {
  title: string; // required, @IsString @IsNotEmpty
  description?: string; // optional, @IsString
  videoUrl?: string; // optional, @IsUrl, legacy/raw video URL
  videoDuration?: number; // optional, @IsInt @Min(0), seconds
  textContent?: string; // optional, @IsString, HTML/rich text
  pdfUrl?: string; // optional, @IsString, legacy PDF URL
  order: number; // required, @IsInt @Min(1)
  isPublished: boolean; // required, @IsBoolean
  isPreview?: boolean; // optional, @IsBoolean
  attachmentUrl?: string; // optional, @IsUrl
  attachmentName?: string; // optional, @IsString
}
```

⚠️ Actual create DTO facts:
- There is no `bunnyVideoId` field in `CreateLessonDto`.
- There is no `videoProvider` field.
- If you need a Bunny lesson, current code requires create first, then `PATCH` the lesson with `bunnyVideoId`.

Actual response example:

```json
{
  "uuid": "10911bf0-c0a7-4fd5-bb05-48f76734a111",
  "sectionUuid": "2cb1eb66-f8d7-4125-8ac2-0e3c4fa6f111",
  "title": "Introduction",
  "description": "Welcome to the course.",
  "videoUrl": "https://cdn.example.com/direct-video.mp4",
  "bunnyVideoId": null,
  "videoDuration": 900,
  "textContent": "<p>Lesson notes here...</p>",
  "pdfUrl": null,
  "order": 1,
  "isPublished": true,
  "createdAt": "2026-04-20T12:40:00.000Z",
  "updatedAt": "2026-04-20T12:40:00.000Z",
  "isPreview": true,
  "attachmentUrl": "https://cdn.example.com/nsi-attachments/UPLOAD-1713590000000-ab12cd.pdf",
  "attachmentName": "Lesson Slides.pdf"
}
```

Error responses:
- `404` section not found in this course
- `400` validation errors

### 4.2 Get Lesson for Editing

- URL: `GET /api/v1/admin/courses/:courseUuid/sections/:sectionUuid/lessons/:lessonUuid/edit`
- Auth: `SUPER_ADMIN`

Actual response shape for form pre-fill:

```json
{
  "title": "Introduction",
  "description": "Welcome to the course.",
  "videoUrl": "https://cdn.example.com/direct-video.mp4",
  "videoDuration": 900,
  "textContent": "<p>Lesson notes here...</p>",
  "pdfUrl": null,
  "isPreview": true,
  "attachmentUrl": "https://cdn.example.com/nsi-attachments/UPLOAD-1713590000000-ab12cd.pdf",
  "attachmentName": "Lesson Slides.pdf",
  "order": 1,
  "isPublished": true,
  "bunnyVideoId": "cccccccc-cccc-cccc-cccc-cccccccccccc"
}
```

⚠️ Actual runtime includes `bunnyVideoId` here, even though the response DTO class does not declare it.

Error responses:
- `404` lesson not found

### 4.3 Update Lesson

- URL: `PATCH /api/v1/admin/courses/:courseUuid/sections/:sectionUuid/lessons/:lessonUuid`
- Auth: `SUPER_ADMIN`

Request body:

```ts
interface UpdateLessonRequest {
  title?: string; // optional, @IsString @IsNotEmpty
  description?: string; // optional, @IsString
  videoUrl?: string | null | ""; // optional, @ValidateIf(value !== undefined && value !== null && value !== '') then @IsUrl
  bunnyVideoId?: string; // optional, @IsString, no UUID validation
  videoDuration?: number; // optional, @IsInt @Min(0)
  textContent?: string; // optional, @IsString
  pdfUrl?: string; // optional, @IsString
  order?: number; // optional, @IsInt @Min(1)
  isPublished?: boolean; // optional, @IsBoolean
  isPreview?: boolean; // optional, @IsBoolean
  attachmentUrl?: string | null; // optional, @IsUrl when non-null
  attachmentName?: string; // optional, @IsString
}
```

`videoUrl` `ValidateIf` behavior from actual code:
- URL validation runs only when `videoUrl` is not `undefined`, not `null`, and not `''`
- The service updates `videoUrl` whenever the key exists in the body
- That means:
  - `videoUrl: null` clears it
  - `videoUrl: ""` is accepted by validation and stored as an empty string
  - `videoUrl: "https://..."` must be a valid URL

Which fields trigger what behavior:
- `bunnyVideoId` controls whether user LMS endpoints return `videoProvider: "bunny"`
- `videoUrl` is the fallback/raw direct video URL
- `isPublished` controls inclusion in `/api/v1/lms/courses/:uuid/learn` and access through `GET /api/v1/lms/lessons/:uuid`
- `isPreview` controls non-enrolled preview visibility on `GET /api/v1/lms/courses/:uuid`

Actual response example:

```json
{
  "uuid": "10911bf0-c0a7-4fd5-bb05-48f76734a111",
  "sectionUuid": "2cb1eb66-f8d7-4125-8ac2-0e3c4fa6f111",
  "title": "Introduction - Updated",
  "description": "Updated lesson description.",
  "videoUrl": "",
  "bunnyVideoId": "cccccccc-cccc-cccc-cccc-cccccccccccc",
  "videoDuration": 900,
  "textContent": "<p>Updated lesson notes...</p>",
  "pdfUrl": null,
  "order": 1,
  "isPublished": true,
  "createdAt": "2026-04-20T12:40:00.000Z",
  "updatedAt": "2026-04-20T12:55:00.000Z",
  "isPreview": true,
  "attachmentUrl": "https://cdn.example.com/nsi-attachments/UPLOAD-1713591111111-zx98cv.pdf",
  "attachmentName": "Updated Slides.pdf"
}
```

Error responses:
- `404` lesson not found
- `400` validation errors

### 4.4 Reorder Lessons

- URL: `PATCH /api/v1/admin/courses/:courseUuid/sections/:sectionUuid/lessons/reorder`
- Auth: `SUPER_ADMIN`

Request body:

```ts
interface ReorderLessonsRequest {
  orderedUuids: string[]; // required, @IsArray @IsUUID('4', { each: true })
}
```

Actual response:

```json
{
  "reordered": true
}
```

⚠️ Actual backend behavior:
- The service checks that the parent section exists.
- It does not verify that every UUID in `orderedUuids` belongs to that section.
- Frontend must send only sibling lesson UUIDs for the target section.

Error responses:
- `404` section not found in this course
- `400` validation errors

### 4.5 Delete Lesson

- URL: `DELETE /api/v1/admin/courses/:courseUuid/sections/:sectionUuid/lessons/:lessonUuid`
- Auth: `SUPER_ADMIN`

Actual business rules:
- Only existence is checked.
- Deleting a lesson cascades to its `LessonProgress` rows.

Actual response:

```json
{
  "deleted": true
}
```

Error responses:
- `404` lesson not found

---

## 5. ADMIN - File Upload

Primary endpoint:
- URL: `POST /api/v1/admin/lms/upload`
- Auth: `SUPER_ADMIN`

Exact multipart format:

```http
POST /api/v1/admin/lms/upload
Authorization: Bearer <JWT access token>
Content-Type: multipart/form-data

file=<binary>
folder=thumbnails | attachments
```

Accepted `folder` values:
- `thumbnails`
- `attachments`

Actual folder mapping:
- `thumbnails` -> `nsi-thumbnails`
- `attachments` -> `nsi-attachments`

File restrictions:
- `thumbnails`: only `image/jpeg`, `image/png`, `image/webp`
- `attachments`: only `application/pdf`
- file size limit: `50 MB`

Exact response:

```json
{
  "url": "https://cdn.example.com/nsi-thumbnails/UPLOAD-1713590000000-ab12cd.jpg"
}
```

How the returned URL is used:
- Course image upload -> send as `thumbnailUrl`
- Lesson attachment upload -> send as `attachmentUrl`
- If you still use legacy lesson PDF support, store a PDF URL as `pdfUrl`

Common errors:
- `400 File is required`
- `400 Invalid folder. Accepted: thumbnails, attachments`
- `400 Invalid file type for thumbnails. Accepted: JPG, PNG, WEBP`
- `400 Invalid file type for attachments. Accepted: PDF`
- `403` insufficient permissions

Legacy endpoint:
- URL: `POST /api/v1/admin/lms/upload-pdf`
- Accepts only `file`
- Enforces `application/pdf`
- Stores in `nsi-lms-pdfs`
- Response is also `{ "url": "..." }`

---

## 6. USER - Course Browsing

### 6.1 Browse Courses

- URL: `GET /api/v1/lms/courses`
- Auth roles: `CUSTOMER`, `DISTRIBUTOR`
- Query params: none

Actual response shape:

```json
[
  {
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Kangen Water Masterclass",
    "description": "Learn everything about Kangen water.",
    "thumbnailUrl": "https://cdn.example.com/nsi-thumbnails/UPLOAD-1713590000000-ab12cd.jpg",
    "isFree": false,
    "price": 999,
    "badge": "BESTSELLER",
    "totalDuration": "12h 30m",
    "previewVideoUrl": "https://player.example.com/course-preview",
    "instructors": ["Nageshwar Shukla"],
    "whatYouWillLearn": ["Build a team", "Master Kangen science"],
    "originalPrice": 1999,
    "discountPercent": 50,
    "totalSections": 5,
    "totalLessons": 25,
    "displayEnrollmentCount": 200,
    "isEnrolled": true,
    "progress": 45
  }
]
```

Course card field rules:
- `displayEnrollmentCount = realEnrollments + enrollmentBoost`
- `discountPercent = Math.round(((originalPrice - price) / originalPrice) * 100)` when `originalPrice > price`
- `progress` is `null` when not enrolled
- `progress` is a rounded percent when enrolled

⚠️ Actual counting behavior:
- `totalLessons` is calculated from all lessons in the course, not only published lessons
- Progress is also computed against all lessons in the course, not only published lessons

Error responses:
- `403` wrong role / missing auth

### 6.2 Course Detail Page

- URL: `GET /api/v1/lms/courses/:uuid`
- Auth: `CUSTOMER`, `DISTRIBUTOR`

Actual top-level response:

```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Kangen Water Masterclass",
  "description": "Learn everything about Kangen water.",
  "thumbnailUrl": "https://cdn.example.com/nsi-thumbnails/UPLOAD-1713590000000-ab12cd.jpg",
  "isFree": false,
  "price": 999,
  "badge": "BESTSELLER",
  "totalDuration": "12h 30m",
  "previewVideoUrl": "https://player.example.com/course-preview",
  "instructors": ["Nageshwar Shukla"],
  "whatYouWillLearn": ["Build a team", "Master Kangen science"],
  "originalPrice": 1999,
  "discountPercent": 50,
  "totalLessons": 25,
  "displayEnrollmentCount": 200,
  "enrollment": {
    "enrolledAt": "2026-04-20T09:00:00.000Z",
    "completedAt": null,
    "progress": 45
  },
  "sections": [
    {
      "uuid": "2cb1eb66-f8d7-4125-8ac2-0e3c4fa6f111",
      "title": "Module 1",
      "order": 1,
      "lessons": [
        {
          "uuid": "10911bf0-c0a7-4fd5-bb05-48f76734a111",
          "title": "Introduction",
          "order": 1,
          "videoDuration": 900,
          "isPreview": true,
          "isCompleted": true,
          "isLocked": false,
          "videoUrl": null,
          "videoProvider": null,
          "videoExpiry": null,
          "bunnyVideoId": null
        }
      ]
    }
  ]
}
```

Preview lesson logic from actual code:

Non-enrolled users:
- The endpoint still returns the course and section/lesson structure.
- For lessons where `isPreview === true`:
  - If `bunnyVideoId` exists, response includes:
    - signed `videoUrl`
    - `videoProvider: "bunny"`
    - `videoExpiry` = now + `7200` seconds
    - `bunnyVideoId`
    - `textContent`
    - `attachmentUrl`
    - `attachmentName`
  - If no `bunnyVideoId`, response includes:
    - `videoUrl` from stored `lesson.videoUrl`
    - `videoProvider: "direct"`
    - `videoExpiry: null`
    - `bunnyVideoId: null`
    - `textContent`
    - `attachmentUrl`
    - `attachmentName`
- For lessons where `isPreview === false`, the endpoint returns:
  - `videoUrl: null`
  - `videoProvider: null`
  - `videoExpiry: null`
  - `bunnyVideoId: null`
  - `textContent: null`
  - `attachmentUrl: null`
  - `attachmentName: null`

Enrolled users:
- The endpoint returns lesson list state only.
- It does not return lesson content.
- It returns `isCompleted` and `isLocked`.
- It forces `videoUrl: null`, `videoProvider: null`, `videoExpiry: null`, `bunnyVideoId: null`.
- Use `/api/v1/lms/courses/:uuid/learn` or `/api/v1/lms/lessons/:uuid` for actual content.

⚠️ Actual course-detail edge cases:
- This endpoint does not filter lessons by `isPublished`
- Unpublished lessons can still appear in the section list here
- Unpublished preview lessons can still expose preview content here
- There is no `previewBunnyVideoId` in the response
- There is no signed course-level preview token in the response

Error responses:
- `404` course not found

### 6.3 Enroll in Course

- URL: `POST /api/v1/lms/courses/:uuid/enroll`
- Auth roles: `CUSTOMER`, `DISTRIBUTOR`
- Request body: none

Free-course response:

```json
{
  "enrolled": true,
  "message": "Enrolled successfully"
}
```

Paid-course response:

```json
{
  "orderId": "order_RZP_1234567890",
  "amount": 999,
  "currency": "INR",
  "keyId": "rzp_live_xxxxx"
}
```

Actual service behavior:
- Free course:
  - checks course exists
  - checks course is published
  - checks `isFree === true`
  - creates `courseEnrollment` immediately
- Paid course:
  - checks course exists
  - checks course is published
  - checks `isFree === false`
  - checks `price > 0`
  - creates a `payment` row
  - creates a Razorpay order through the payment provider
  - returns `{ orderId, amount, currency, keyId }`
  - does not create `courseEnrollment` yet

What happens after enrollment:
- For free courses, the user is enrolled immediately.
- For paid courses, enrollment is created later by the payment webhook in `PaymentService`.
- In mock-payment mode, the backend auto-triggers that webhook flow after about `2` seconds.
- There is no separate LMS "payment success" endpoint for the frontend to call.

Error responses:
- `404` course not found
- `400` course not published
- `400` paid course price not configured
- `400` payment order creation failed
- `409` already enrolled in this course

### 6.4 My Courses

- URL: `GET /api/v1/lms/my-courses`
- Auth: `CUSTOMER`, `DISTRIBUTOR`

Actual response shape:

```json
{
  "courses": [
    {
      "uuid": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Kangen Water Masterclass",
      "thumbnailUrl": "https://cdn.example.com/nsi-thumbnails/UPLOAD-1713590000000-ab12cd.jpg",
      "enrolledAt": "2026-04-20T09:00:00.000Z",
      "completedAt": null,
      "progress": 45,
      "certificateUrl": null,
      "totalLessons": 25,
      "completedLessons": 11,
      "lastActivityAt": "2026-04-20T11:20:00.000Z"
    }
  ]
}
```

Progress field behavior:
- `progress = Math.round((completedLessons / totalLessons) * 100)`
- `completedLessons` counts lesson-progress rows where `isCompleted === true`
- `lastActivityAt` is the latest `lessonProgress.updatedAt`

⚠️ Actual counting behavior:
- `totalLessons` and `completedLessons` are based on all lessons in the course, not only published lessons
- A course can be marked completed by the backend based on published lessons only, while `My Courses` still shows totals based on all lessons

---

## 7. USER - Learning Experience

### 7.1 Get Course Learn Content

- URL: `GET /api/v1/lms/courses/:uuid/learn`
- Auth: enrolled users only

Actual enrollment check:
- The course must exist and be published
- The user must have a `courseEnrollment` row for `(userUuid, courseUuid)`
- Otherwise the service throws `403 You are not enrolled in this course`

Actual response shape:

```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Kangen Water Masterclass",
  "description": "Learn everything about Kangen water.",
  "thumbnailUrl": "https://cdn.example.com/nsi-thumbnails/UPLOAD-1713590000000-ab12cd.jpg",
  "sections": [
    {
      "uuid": "2cb1eb66-f8d7-4125-8ac2-0e3c4fa6f111",
      "title": "Module 1",
      "order": 1,
      "lessons": [
        {
          "uuid": "10911bf0-c0a7-4fd5-bb05-48f76734a111",
          "title": "Introduction",
          "description": "Welcome to the course.",
          "bunnyVideoId": "cccccccc-cccc-cccc-cccc-cccccccccccc",
          "videoUrl": "https://iframe.mediadelivery.net/embed/12345/cccccccc-cccc-cccc-cccc-cccccccccccc?token=...&expires=1713597200",
          "videoProvider": "bunny",
          "videoExpiry": 1713597200,
          "videoDuration": 900,
          "textContent": "<p>Lesson notes here...</p>",
          "pdfUrl": null,
          "isPreview": true,
          "attachmentUrl": "https://cdn.example.com/nsi-attachments/UPLOAD-1713590000000-ab12cd.pdf",
          "attachmentName": "Lesson Slides.pdf",
          "order": 1,
          "isCompleted": false,
          "watchedSeconds": 120,
          "isLocked": false
        }
      ]
    }
  ]
}
```

Actual inclusion rule:
- This endpoint only includes lessons where `isPublished === true`

Actual lock logic:
- Lessons are flattened in course order: section order ascending, then lesson order ascending
- The first published lesson is never locked
- Every later published lesson is locked until the immediately previous published lesson has `lessonProgress.isCompleted === true`

🔴 CRITICAL:
- This endpoint still returns full lesson content and signed Bunny URLs even when `isLocked === true`
- Frontend must enforce `isLocked` and hide/disable the player and lesson body for locked lessons

Per-lesson media rules:
- `bunnyVideoId` present -> `videoProvider: "bunny"`, signed iframe URL, `videoExpiry = now + 7200`
- `bunnyVideoId` absent -> `videoProvider: "direct"`, `videoUrl` is raw stored URL, `videoExpiry: null`
- Text/PDF-only lessons still come back as `videoProvider: "direct"` with `videoUrl: null`

Error responses:
- `404` course not found
- `403` user not enrolled in this course

### 7.2 Get Single Lesson

- URL: `GET /api/v1/lms/lessons/:uuid`
- Auth roles: `CUSTOMER`, `DISTRIBUTOR`

Actual verification steps:
- lesson must exist
- lesson must be published
- user must be enrolled in the parent course
- lesson must not be locked

Actual response shape:

```json
{
  "uuid": "10911bf0-c0a7-4fd5-bb05-48f76734a111",
  "title": "Introduction",
  "description": "Welcome to the course.",
  "bunnyVideoId": "cccccccc-cccc-cccc-cccc-cccccccccccc",
  "videoUrl": "https://iframe.mediadelivery.net/embed/12345/cccccccc-cccc-cccc-cccc-cccccccccccc?token=...&expires=1713597200",
  "videoProvider": "bunny",
  "videoExpiry": 1713597200,
  "videoDuration": 900,
  "textContent": "<p>Lesson notes here...</p>",
  "pdfUrl": null,
  "isPreview": true,
  "attachmentUrl": "https://cdn.example.com/nsi-attachments/UPLOAD-1713590000000-ab12cd.pdf",
  "attachmentName": "Lesson Slides.pdf",
  "order": 1,
  "isCompleted": false,
  "watchedSeconds": 120
}
```

All actual fields in successful response:
- `uuid`
- `title`
- `description`
- `bunnyVideoId`
- `videoUrl`
- `videoProvider`
- `videoExpiry`
- `videoDuration`
- `textContent`
- `pdfUrl`
- `isPreview`
- `attachmentUrl`
- `attachmentName`
- `order`
- `isCompleted`
- `watchedSeconds`

Actual locking behavior on this route:
- Lock check uses `isLessonLocked()`
- `isLessonLocked()` fetches all lessons in the course, ordered by section order and lesson order
- It does not filter out unpublished lessons
- So this route can consider unpublished lessons when deciding whether the current lesson is locked

🔴 CRITICAL:
- `/learn` lock state is based on published lessons only
- `/lessons/:uuid` lock state is based on all lessons in the course
- Frontend should expect this inconsistency in edge cases

Error responses:
- `404` lesson not found
- `404` the same `Lesson not found` message is also used when the lesson exists but `isPublished === false`
- `403` user not enrolled in this course
- `403` `Complete the previous lesson first`

### 7.3 Refresh Lesson Token

- URL: `GET /api/v1/lms/lessons/:uuid/refresh-token`
- Auth: `CUSTOMER`, `DISTRIBUTOR`
- Request body: none

Actual backend behavior:
- lesson must exist
- lesson must have `bunnyVideoId`
- user must be enrolled in the parent course
- route does not check `lesson.isPublished`
- route does not check lesson lock state

Actual response:

```json
{
  "videoUrl": "https://iframe.mediadelivery.net/embed/12345/cccccccc-cccc-cccc-cccc-cccccccccccc?token=...&expires=1713597200",
  "videoExpiry": 1713597200
}
```

🔴 CRITICAL:
- Call this before `videoExpiry`
- The returned URL is a new 2-hour Bunny iframe URL
- This route exists only for Bunny lessons

Frontend timing guidance from actual expiry logic:
- Backend issues `7200` second tokens
- Safe early refresh window: about `90` minutes after issue or a few minutes before `videoExpiry`

Error responses:
- `404` lesson not found
- `400` `This lesson does not use Bunny Stream`
- `403` user not enrolled in this course

### 7.4 Submit Video Progress

- URL: `POST /api/v1/lms/lessons/:uuid/progress`
- Auth: `CUSTOMER`, `DISTRIBUTOR`

Request body:

```ts
interface LessonProgressRequest {
  watchedSeconds: number; // required, @IsInt @Min(0)
}
```

Actual auto-complete threshold:
- `watchedSeconds >= lesson.videoDuration * 0.9`
- Auto-complete only runs when `videoDuration` is non-null and `> 0`

Actual response:

```json
{
  "isCompleted": true,
  "watchedSeconds": 810
}
```

What triggers auto-completion:
- The service compares the incoming `watchedSeconds` to `90%` of `videoDuration`
- If threshold is reached:
  - `isCompleted` becomes `true`
  - `completedAt` is set to `now`
  - backend runs `checkAndFinalizeCourse()`

⚠️ Actual behavior of this route:
- It requires enrollment
- It does not check `lesson.isPublished`
- It does not check whether the lesson is locked
- It stores the exact `watchedSeconds` sent by the frontend; there is no clamping to `videoDuration`

Error responses:
- `404` lesson not found
- `403` user not enrolled in this course
- `400` validation errors

### 7.5 Complete Lesson

- URL: `POST /api/v1/lms/lessons/:uuid/complete`
- Auth: `CUSTOMER`, `DISTRIBUTOR`
- Request body: none

Actual response:

```json
{
  "isCompleted": true
}
```

Actual backend behavior:
- Requires enrollment
- Checks lock state through `isLessonLocked()`
- Does not check `lesson.isPublished`
- Creates progress with `watchedSeconds: 0` if the row did not exist
- If the row already exists, update only sets `isCompleted` and `completedAt`; it does not overwrite stored `watchedSeconds`

Certificate trigger:
- After completion, backend calls `checkAndFinalizeCourse()`
- `checkAndFinalizeCourse()` counts only published lessons in the course
- If the user has completed all published lessons:
  - `courseEnrollment.completedAt` is set
  - `certificateService.generateForEnrollment()` is fired asynchronously

Error responses:
- `404` lesson not found
- `403` user not enrolled in this course
- `403` `Complete the previous lesson first`

### 7.6 Get Certificate

- URL: `GET /api/v1/lms/courses/:uuid/certificate`
- Auth: `CUSTOMER`, `DISTRIBUTOR`

When certificate is available:
- The user must have a `courseEnrollment`
- `courseEnrollment.completedAt` must be non-null
- If `certificateUrl` already exists, it is returned immediately
- If `certificateUrl` is still null, the route generates the PDF on demand and then returns it

Actual response shape:

```json
{
  "certificateUrl": "https://cdn.example.com/nsi-certificates/CERT-AB12CD34.pdf",
  "certificateId": "CERT-AB12CD34"
}
```

⚠️ Actual runtime response includes `certificateId`, even though the response DTO only documents `certificateUrl`.

Certificate URL lifetime:
- Current storage providers return stable public URLs
- Cloudflare R2 provider returns `R2_PUBLIC_URL/<folder>/<filename>.pdf`
- Local provider returns `/uploads/<folder>/<filename>.pdf`
- There is no signed expiry on certificate URLs in current code

Error responses:
- `404` `Enrollment not found`
- `400` `Course not completed yet`
- `500` first-time generation can fail if Puppeteer PDF generation or storage upload fails

---

## 8. ADMIN - LMS Analytics

⚠️ These analytics endpoints accept no `from` / `to` query params in the current LMS video analytics code.

### 8.1 LMS Overview Analytics

- URL: `GET /api/v1/admin/analytics/lms-videos`
- Auth: `SUPER_ADMIN`
- Query params: none

Actual response shape:

```json
{
  "summary": {
    "totalCourses": 8,
    "totalEnrollments": 1000,
    "avgCourseCompletionRate": 25,
    "totalCertificatesIssued": 250,
    "totalVideoWatchTimeSeconds": 864000
  },
  "courses": [
    {
      "courseUuid": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Kangen Water Masterclass",
      "isPublished": true,
      "enrollments": 150,
      "completions": 50,
      "completionRate": 33.3,
      "certificatesIssued": 45,
      "totalLessons": 25,
      "avgLessonCompletionRate": 41.8,
      "totalVideoWatchTimeSeconds": 128000,
      "provider": "bunny"
    }
  ]
}
```

Data-source notes:
- `summary.totalCourses` -> NSI DB (`course.findMany` over published courses)
- `summary.totalEnrollments` -> NSI DB (`courseEnrollment`)
- `summary.avgCourseCompletionRate` -> NSI DB, unweighted average of per-course completion rates
- `summary.totalCertificatesIssued` -> NSI DB
- `summary.totalVideoWatchTimeSeconds` -> NSI DB (`lessonProgress._sum.watchedSeconds`)
- `courses[].provider` -> inferred from whether any lesson has `bunnyVideoId`; no Bunny API call is made here

⚠️ Actual controller/service comment:
- This endpoint makes no Bunny API calls

### 8.2 Course Analytics

- URL: `GET /api/v1/admin/analytics/lms-videos/:courseUuid`
- Auth: `SUPER_ADMIN`
- Query params: none

Actual response shape:

```json
{
  "course": {
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Kangen Water Masterclass",
    "enrollments": 150,
    "completions": 50,
    "completionRate": 33.3,
    "certificatesIssued": 45,
    "avgProgressPercent": 61.4,
    "totalVideoWatchTimeSeconds": 128000
  },
  "lessons": [
    {
      "lessonUuid": "10911bf0-c0a7-4fd5-bb05-48f76734a111",
      "title": "Introduction",
      "order": 1,
      "sectionTitle": "Module 1",
      "bunnyVideoId": "cccccccc-cccc-cccc-cccc-cccccccccccc",
      "nsiData": {
        "startedCount": 120,
        "completedCount": 90,
        "completionRate": 75,
        "avgProgressPercent": 68.5,
        "dataSource": "nsi_db"
      },
      "videoAnalytics": {
        "views": 500,
        "avgWatchPercent": 65,
        "totalWatchTimeSeconds": 36000,
        "provider": "bunny",
        "dataSource": "bunny_stream"
      }
    }
  ]
}
```

Actual analytics rules:
- The service includes all lessons in the course, not only published lessons
- `nsiData.startedCount` = lesson-progress row count
- `nsiData.completedCount` = lesson-progress rows where `isCompleted === true`
- `nsiData.completionRate` = `completed / started * 100`, rounded to 1 decimal
- `nsiData.avgProgressPercent` = average watched seconds / lesson duration * 100
- `videoAnalytics` is `null` when the lesson has no `bunnyVideoId`

### 8.3 Lesson Analytics (Deep Dive)

- URL: `GET /api/v1/admin/analytics/lms-videos/:courseUuid/lessons/:lessonUuid`
- Auth: `SUPER_ADMIN`
- Query params: none

Actual response shape:

```json
{
  "lesson": {
    "uuid": "10911bf0-c0a7-4fd5-bb05-48f76734a111",
    "title": "Introduction",
    "videoDuration": 900,
    "bunnyVideoId": "cccccccc-cccc-cccc-cccc-cccccccccccc"
  },
  "nsiData": {
    "startedCount": 120,
    "completedCount": 90,
    "completionRate": 75,
    "avgProgressPercent": 68.5,
    "progressDistribution": {
      "0-25": 10,
      "25-50": 20,
      "50-75": 35,
      "75-100": 55
    },
    "dataSource": "nsi_db"
  },
  "videoAnalytics": {
    "views": 500,
    "avgWatchPercent": 65,
    "totalWatchTimeSeconds": 36000,
    "topCountries": {
      "IN": 300,
      "US": 120,
      "GB": 80
    },
    "provider": "bunny",
    "dataSource": "bunny_stream"
  },
  "heatmap": {
    "videoId": "cccccccc-cccc-cccc-cccc-cccccccccccc",
    "heatmap": [1, 0.9, 0.85, 0.8, 0.75],
    "provider": "bunny"
  }
}
```

Actual `nsiData` fields:
- `startedCount` -> NSI DB
- `completedCount` -> NSI DB
- `completionRate` -> NSI DB
- `avgProgressPercent` -> NSI DB
- `progressDistribution` -> NSI DB
- `dataSource` -> literal `"nsi_db"`

Actual `videoAnalytics` fields:
- `views` -> Bunny Stream
- `avgWatchPercent` -> Bunny Stream
- `totalWatchTimeSeconds` -> Bunny Stream
- `topCountries` -> Bunny Stream
- `provider` -> Bunny Stream provider string
- `dataSource` -> literal `"bunny_stream"`

Actual heatmap shape:
- `heatmap.videoId`
- `heatmap.heatmap` -> number array
- `heatmap.provider`

Progress-distribution rules:
- `< 25` -> `"0-25"`
- `< 50` -> `"25-50"`
- `< 75` -> `"50-75"`
- `>= 75` -> `"75-100"`
- If `videoDuration` is missing or `0`, all progress rows go into `"0-25"`

### 8.4 Course Preview Analytics

- URL: `GET /api/v1/admin/analytics/course-previews`
- Auth: `SUPER_ADMIN`
- Query params: none

Actual response shape:

```json
{
  "courses": [
    {
      "courseUuid": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Kangen Water Masterclass",
      "previewBunnyVideoId": "preview-guid-123",
      "previewAnalytics": {
        "views": 1200,
        "avgWatchPercent": 54.5,
        "provider": "bunny"
      },
      "nsiData": {
        "previewViews": 1200,
        "enrollments": 150,
        "conversionRate": 12.5
      }
    }
  ]
}
```

Actual data-source split:
- `previewBunnyVideoId` -> NSI DB (`Course.previewBunnyVideoId`)
- `previewAnalytics.*` -> Bunny Stream
- `nsiData.enrollments` -> NSI DB
- `nsiData.previewViews` -> Bunny views when available, otherwise fallback to enrollment count
- `nsiData.conversionRate = enrollments / previewViews * 100`, rounded to 1 decimal, or `null` when `previewViews === 0`

⚠️ Important preview-analytics edge case:
- If `previewBunnyVideoId` is null, `previewAnalytics` is null
- In that case the service sets `previewViews = enrollments`
- That makes `conversionRate` become `100` when enrollments are greater than `0`

⚠️ Important schema/API mismatch:
- `previewBunnyVideoId` exists in Prisma and is used by analytics
- The current LMS admin create DTO still does not expose `previewBunnyVideoId`, but the update DTO does

### 8.5 Additional Admin LMS Summary Endpoint

- URL: `GET /api/v1/admin/lms/analytics`
- Auth: `SUPER_ADMIN`

Actual response shape:

```json
{
  "totalCourses": 8,
  "publishedCourses": 6,
  "totalEnrollments": 1000,
  "totalCompletions": 250,
  "completionRate": 25,
  "certificatesIssued": 240,
  "courseBreakdown": [
    {
      "uuid": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Kangen Water Masterclass",
      "isFree": false,
      "enrollments": 150,
      "completions": 50,
      "completionRate": 33.3,
      "avgProgress": 45
    }
  ]
}
```

Actual rules:
- `completionRate` is numeric, not string
- `courseBreakdown[].avgProgress` is computed from completed lesson counts per enrolled user
- `courseBreakdown` uses all lessons on the course

---

## 9. Complete Implementation Examples

### 9.1 Video Player Component

```typescript
type LessonMedia = {
  uuid: string;
  title: string;
  videoUrl: string | null;
  videoProvider: "bunny" | "direct" | null;
  videoExpiry: number | null;
  isLocked?: boolean;
};

function LessonPlayer({
  lesson,
}: {
  lesson: LessonMedia;
}) {
  if (lesson.isLocked) {
    return <div>This lesson is locked. Complete the previous lesson first.</div>;
  }

  if (lesson.videoProvider === "bunny" && lesson.videoUrl) {
    return (
      <iframe
        src={lesson.videoUrl}
        title={lesson.title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        style={{ width: "100%", aspectRatio: "16 / 9", border: 0 }}
      />
    );
  }

  if (lesson.videoProvider === "direct" && lesson.videoUrl) {
    return (
      <video
        controls
        playsInline
        src={lesson.videoUrl}
        style={{ width: "100%", aspectRatio: "16 / 9" }}
      />
    );
  }

  return <div>No video for this lesson.</div>;
}
```

🔴 CRITICAL:
- Never render Bunny lesson URLs in a `<video>` tag
- Always respect `isLocked` from `/learn`, because the backend still includes content for locked lessons there

### 9.2 Token Refresh Implementation

Inference from code:
- Backend Bunny lesson URLs expire after `7200` seconds
- A 90-minute refresh timer is a safe frontend pattern, not a server-enforced number

```typescript
type LessonTokenPayload = {
  videoUrl: string;
  videoExpiry: number; // unix seconds
};

async function refreshLessonToken(lessonUuid: string): Promise<LessonTokenPayload> {
  const res = await fetch(`/api/v1/lms/lessons/${lessonUuid}/refresh-token`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to refresh token: ${res.status}`);
  }

  return res.json();
}

function scheduleBunnyRefresh(
  lessonUuid: string,
  videoProvider: "bunny" | "direct" | null,
  videoExpiry: number | null,
  onToken: (payload: LessonTokenPayload) => void,
) {
  if (videoProvider !== "bunny" || !videoExpiry) return () => {};

  const now = Date.now();
  const expiryMs = videoExpiry * 1000;

  // Safe client-side inference: refresh around 90 minutes after issue,
  // or immediately if the token is already close to expiry.
  const ninetyMinutesMs = 90 * 60 * 1000;
  const latestSafeRefreshMs = expiryMs - 5 * 60 * 1000;
  const delay = Math.max(0, Math.min(ninetyMinutesMs, latestSafeRefreshMs - now));

  const timer = window.setTimeout(async () => {
    const next = await refreshLessonToken(lessonUuid);
    onToken(next);
  }, delay);

  return () => window.clearTimeout(timer);
}
```

### 9.3 Course Enrollment Flow

Free course flow:
1. Call `POST /api/v1/lms/courses/:uuid/enroll`.
2. Expect `{ enrolled: true, message: "Enrolled successfully" }`.
3. Refresh `GET /api/v1/lms/courses/:uuid` or go straight to `GET /api/v1/lms/courses/:uuid/learn`.

Paid course flow:
1. Call `POST /api/v1/lms/courses/:uuid/enroll`.
2. Expect `{ orderId, amount, currency, keyId }`.
3. Open Razorpay checkout with those values.
4. Wait for payment success and backend webhook processing.
5. Poll `GET /api/v1/lms/courses/:uuid` or `GET /api/v1/lms/my-courses` until the user is enrolled.
6. After enrollment appears, load `GET /api/v1/lms/courses/:uuid/learn`.

🔴 CRITICAL:
- Paid enrollment is not complete when the enroll endpoint returns
- The actual `courseEnrollment` row is created later by webhook handling

### 9.4 Lesson Progress Tracking

Recommended frontend flow based on actual endpoints:
1. Load `GET /api/v1/lms/courses/:uuid/learn`.
2. Use `isLocked` to decide which lesson can be entered.
3. For Bunny lessons, render the signed URL in an `<iframe>`.
4. For direct lessons, render the URL in a `<video>` tag only when `videoUrl` is non-null.
5. POST `watchedSeconds` to `POST /api/v1/lms/lessons/:uuid/progress` during playback.
6. Let the backend auto-complete at `90%` of `videoDuration`.
7. For text/PDF-only lessons, call `POST /api/v1/lms/lessons/:uuid/complete`.
8. When the last published lesson is completed, the backend sets `completedAt` and starts certificate generation.
9. Use `GET /api/v1/lms/courses/:uuid/certificate` if `certificateUrl` is still null in `GET /api/v1/lms/my-courses`.

---

## 10. Important Notes & Edge Cases

🔴 CRITICAL free-course rule:
- Enrollment flow uses `isFree` as the switch between free and paid logic
- `PATCH /api/v1/admin/courses/:uuid` does not normalize `price` when `isFree` changes
- A course can become `isFree: true` while still storing a non-zero `price`
- Frontend should trust `isFree` for access logic, but be aware price can be stale if admin updates are inconsistent

🔴 CRITICAL lesson locking:
- `/api/v1/lms/courses/:uuid/learn` computes lock state from published lessons only
- `/api/v1/lms/lessons/:uuid` and `/api/v1/lms/lessons/:uuid/complete` compute lock state from all lessons in the course
- `/api/v1/lms/lessons/:uuid/progress` does not enforce lock state at all
- `/api/v1/lms/lessons/:uuid/refresh-token` does not enforce lock state at all

🔴 CRITICAL `/learn` payload behavior:
- The backend still returns full video/text/attachment content for locked lessons in `/learn`
- Frontend must hide or disable locked lesson content using `isLocked`

⚠️ `enrollmentBoost`:
- User-facing enrollment count is `realEnrollments + enrollmentBoost`
- Do not show the raw enrollment count to users if you want to mirror backend intent

⚠️ Certificate issuance:
- Course completion is triggered when all published lessons are complete
- Certificate generation is fire-and-forget on auto/manual course completion
- `GET /certificate` will generate synchronously if needed
- Certificate URL has no signed expiry in current storage providers

⚠️ Attachment downloads:
- `attachmentUrl` and `pdfUrl` are raw URLs
- No token refresh is required
- Open directly or download directly

⚠️ Preview lessons:
- Non-enrolled users only get content for lessons where `isPreview === true`
- That content may include signed Bunny iframe URLs, direct video URLs, text content, and attachments
- `GET /api/v1/lms/courses/:uuid` does not filter unpublished lessons, so unpublished preview lessons can still appear there

⚠️ `bunnyVideoId` null handling:
- No `bunnyVideoId` -> `videoProvider` falls back to `"direct"` on `/learn` and `/lessons/:uuid`
- In that case `videoExpiry` is `null`
- `GET /api/v1/lms/lessons/:uuid/refresh-token` returns `400` if `bunnyVideoId` is missing

⚠️ Empty arrays vs null:
- `instructors` defaults to `[]`
- `whatYouWillLearn` defaults to `[]`
- `sections` and `lessons` are returned as arrays, not `null`
- Many optional scalar fields return `null`

⚠️ Published vs unpublished lesson counting:
- Browse/detail/my-courses progress and `totalLessons` calculations use all course lessons
- Course completion and `/learn` use published lessons only
- Those numbers can diverge

⚠️ Current schema/API mismatch:
- `Course.previewBunnyVideoId` exists in Prisma and analytics
- Current admin LMS course create endpoint does not expose it, but edit/update now do
- `CourseLesson.bunnyVideoId` exists in Prisma
- Current lesson create endpoint does not expose it; lesson update does

⚠️ Reorder trust model:
- Reorder endpoints validate UUID format but do not verify that every UUID belongs to the target parent
- Frontend must send only the sibling UUIDs for that course/section

🔴 CRITICAL route-order note from code:
- `VideoAnalyticsController` explicitly documents that its specific analytics routes must stay before parameterized routes
