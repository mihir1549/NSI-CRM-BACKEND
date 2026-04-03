# LMS Frontend Integration Guide

This guide is based on the actual LMS backend implementation in `src/lms/*.ts`, `src/lms/dto/*.ts`, `src/common/filters/http-exception.filter.ts`, `src/payment/*.ts`, and the LMS Prisma models in `prisma/schema.prisma`.

---

## Table of Contents

- [API Basics](#api-basics)

- [SECTION 1 — HOW LMS WORKS (Overview)](#section-1--how-lms-works-overview)
- [SECTION 2 — SUPER ADMIN SIDE APIs](#section-2--super-admin-side-apis)
  - [2.1 Course Management](#21-course-management)
  - [2.2 Section Management](#22-section-management)
  - [2.3 Lesson Management](#23-lesson-management)
  - [2.4 LMS Analytics (Admin)](#24-lms-analytics-admin)
- [SECTION 3 — USER SIDE APIs](#section-3--user-side-apis)
  - [3.1 Browse Courses](#31-browse-courses)
  - [3.2 Course Detail](#32-course-detail)
  - [3.3 Enroll in Course](#33-enroll-in-course)
  - [3.4 Learn Page](#34-learn-page)
  - [3.5 My Courses](#35-my-courses)
  - [3.6 Single Lesson Access](#36-single-lesson-access)
  - [3.7 Video Progress Tracking](#37-video-progress-tracking)
  - [3.8 Manual Lesson Complete](#38-manual-lesson-complete)
  - [3.9 Get Certificate](#39-get-certificate)
- [SECTION 4 — UI IMPLEMENTATION GUIDE](#section-4--ui-implementation-guide)
- [SECTION 5 — LESSON LOCKING RULES](#section-5--lesson-locking-rules)
- [SECTION 6 — RAZORPAY INTEGRATION FOR LMS](#section-6--razorpay-integration-for-lms)
- [SECTION 7 — ERROR HANDLING](#section-7--error-handling)
- [SECTION 8 — COMPLETE IMPLEMENTATION CHECKLIST](#section-8--complete-implementation-checklist)

---

## 🏛️ SECTION 1 — HOW LMS WORKS (Overview)

The LMS follows a simple structure and the frontend should mirror that structure directly.

- **Course Structure:** A `Course` contains `Sections`, and each `Section` contains `Lessons`.
- **Lesson Content Types:** A lesson can contain any combination of:
  - Video: `videoUrl` + `videoDuration`
  - Text: `textContent`
  - PDF: `pdfUrl`
- **Who can access:** Only `CUSTOMER` and `DISTRIBUTOR` can use the user LMS APIs.
- **Who creates courses:** Only `SUPER_ADMIN` can create, update, reorder, publish, unpublish, or delete LMS content.
- **Free vs Paid:** Free courses use `isFree: true` and `price: 0`. Paid courses use `isFree: false` and must have a `price` during creation.
- **Publishing:** Courses are created unpublished by default. Only published courses appear in the user catalog.
- **Lesson Locking Rules:** The first lesson in the entire course is never locked. Every lesson after that stays locked until the immediately previous lesson is completed. The backend returns `isLocked`; the frontend should never calculate it manually.
- **Auto-complete:** For video lessons, sending `watchedSeconds >= videoDuration * 0.9` automatically marks the lesson as complete.
- **Certificate generation:** When all published lessons are complete, the backend marks the course complete and generates a certificate.
- **Lifetime Access:** Enrollment has no expiry field or expiry logic, so enrolled users effectively have lifetime access.

---

## 🛠️ SECTION 2 — SUPER ADMIN SIDE APIs

## API Basics

| Item | Value |
|---|---|
| API base prefix | `/api/v1` |
| Admin auth | `Authorization: Bearer <SUPER_ADMIN_JWT>` |
| User auth | `Authorization: Bearer <CUSTOMER_OR_DISTRIBUTOR_JWT>` |
| Content type | `Content-Type: application/json` for `POST` and `PATCH` |
| Accept | `Accept: application/json` |
| Validation | Unknown fields are rejected by the global validation pipe |
| Date format | ISO timestamps |

> Note: Course thumbnails, lesson video URLs, and lesson PDF URLs are validated as URLs by DTOs.

> Note: When the backend already returns `isLocked`, `isEnrolled`, `progress`, `completedAt`, or `certificateUrl`, use those values directly in the frontend instead of calculating your own version.

---

All Admin endpoints are prefixed with `/api/v1/admin/` and require a valid Bearer JWT.

### 2.1 Course Management

#### Create Course
`POST /api/v1/admin/courses`

| Item | Value |
|---|---|
| Method | `POST` |
| URL | `/api/v1/admin/courses` |
| Auth | `Bearer <SUPER_ADMIN_JWT>` |
| Role | `SUPER_ADMIN` |

**Full request with headers**
```http
POST /api/v1/admin/courses HTTP/1.1
Host: api.example.com
Authorization: Bearer <SUPER_ADMIN_JWT>
Content-Type: application/json
Accept: application/json

{
  "title": "Network Marketing Mastery",
  "description": "A complete beginner-to-advanced course for the NSI system.",
  "thumbnailUrl": "https://cdn.example.com/lms/network-marketing-mastery.jpg",
  "isFree": false,
  "price": 1499
}
```

**Response fields**

| Field | Type | Notes |
|---|---|---|
| `uuid` | `string` | Course UUID |
| `title` | `string` | Course title |
| `description` | `string` | Course description |
| `thumbnailUrl` | `string \| null` | Optional image |
| `isFree` | `boolean` | Free vs paid |
| `price` | `number` | `0` for free courses |
| `isPublished` | `boolean` | Defaults to `false` |
| `createdAt` | `string` | ISO timestamp |
| `updatedAt` | `string` | ISO timestamp |

**Example response**
```json
{
  "uuid": "4c648d1d-7f1e-4c0a-907d-3a2a84f4b101",
  "title": "Network Marketing Mastery",
  "description": "A complete beginner-to-advanced course for the NSI system.",
  "thumbnailUrl": "https://cdn.example.com/lms/network-marketing-mastery.jpg",
  "isFree": false,
  "price": 1499,
  "isPublished": false,
  "createdAt": "2026-04-03T08:30:00.000Z",
  "updatedAt": "2026-04-03T08:30:00.000Z"
}
```

> **Warning:** If `isFree` is `false`, the backend requires `price`. If `price` is missing, the request fails with `400 Bad Request`.

#### List All Courses (Admin)
`GET /api/v1/admin/courses`

Returns all courses including their respective `totalEnrollments` and `totalLessons`. Useful for building the admin courses dashboard table.

**Response fields per course**

| Field | Type | Notes |
|---|---|---|
| `uuid` | `string` | Course UUID |
| `title` | `string` | Course title |
| `description` | `string` | Course description |
| `thumbnailUrl` | `string \| null` | Optional image |
| `isFree` | `boolean` | Free vs paid |
| `price` | `number` | Course price |
| `isPublished` | `boolean` | Publish state |
| `createdAt` | `string` | ISO timestamp |
| `totalEnrollments` | `number` | Enrollment count |
| `totalLessons` | `number` | Sum of lessons across sections |

**Example Response:**
```json
[
  {
    "uuid": "4c648d1d-7f1e-4c0a-907d-3a2a84f4b101",
    "title": "Network Marketing Mastery",
    "description": "A complete beginner-to-advanced course for the NSI system.",
    "thumbnailUrl": "https://cdn.example.com/lms/network-marketing-mastery.jpg",
    "isFree": false,
    "price": 1499,
    "isPublished": true,
    "createdAt": "2026-04-03T08:30:00.000Z",
    "totalEnrollments": 128,
    "totalLessons": 18
  },
  {
    "uuid": "1dc5f8d1-4834-4301-9c0e-2a7dcfceb202",
    "title": "Getting Started With NSI",
    "description": "Free onboarding course for new learners.",
    "thumbnailUrl": "https://cdn.example.com/lms/getting-started.jpg",
    "isFree": true,
    "price": 0,
    "isPublished": false,
    "createdAt": "2026-04-01T10:15:00.000Z",
    "totalEnrollments": 0,
    "totalLessons": 4
  }
]
```

#### Get Course Detail (Admin)
`GET /api/v1/admin/courses/:uuid`

Fetches the complete nested layout of a course, its sections, and its lessons.

**Response fields**

| Field | Type | Notes |
|---|---|---|
| `uuid` | `string` | Course UUID |
| `title` | `string` | Course title |
| `description` | `string` | Course description |
| `thumbnailUrl` | `string \| null` | Optional image |
| `isFree` | `boolean` | Free vs paid |
| `price` | `number` | Course price |
| `isPublished` | `boolean` | Publish state |
| `createdAt` | `string` | ISO timestamp |
| `totalEnrollments` | `number` | Enrollment count |
| `totalLessons` | `number` | Total lessons across all sections |
| `sections` | `array` | Ordered by `section.order` |

**Section object**

| Field | Type | Notes |
|---|---|---|
| `uuid` | `string` | Section UUID |
| `title` | `string` | Section title |
| `order` | `number` | Section order |
| `lessons` | `array` | Ordered by `lesson.order` |

**Lesson object**

| Field | Type | Notes |
|---|---|---|
| `uuid` | `string` | Lesson UUID |
| `title` | `string` | Lesson title |
| `description` | `string \| null` | Optional description |
| `videoUrl` | `string \| null` | Optional video URL |
| `videoDuration` | `number \| null` | Seconds |
| `textContent` | `string \| null` | Rich text content |
| `pdfUrl` | `string \| null` | Optional PDF URL |
| `order` | `number` | Lesson order |
| `isPublished` | `boolean` | Lesson publish state |

**Example Response:**
```json
{
  "uuid": "4c648d1d-7f1e-4c0a-907d-3a2a84f4b101",
  "title": "Network Marketing Mastery",
  "description": "A complete beginner-to-advanced course for the NSI system.",
  "thumbnailUrl": "https://cdn.example.com/lms/network-marketing-mastery.jpg",
  "isFree": false,
  "price": 1499,
  "isPublished": true,
  "createdAt": "2026-04-03T08:30:00.000Z",
  "totalEnrollments": 128,
  "totalLessons": 4,
  "sections": [
    {
      "uuid": "6b9d3a0c-2c61-4a7f-8a5d-5e7f1caa3101",
      "title": "Foundation",
      "order": 1,
      "lessons": [
        {
          "uuid": "8d2c54e2-4a4c-4c40-a8b4-10f7ea473001",
          "title": "Welcome to NSI Platform",
          "description": "Overview of the course and learning path.",
          "videoUrl": "https://videos.example.com/welcome.mp4",
          "videoDuration": 450,
          "textContent": "<p>Welcome to the course.</p>",
          "pdfUrl": "https://cdn.example.com/pdfs/welcome-guide.pdf",
          "order": 1,
          "isPublished": true
        },
        {
          "uuid": "c7fbb302-8d5b-4d49-bb5d-3e6ef0ff3002",
          "title": "Mindset Basics",
          "description": "How to approach the business correctly.",
          "videoUrl": "https://videos.example.com/mindset-basics.mp4",
          "videoDuration": 900,
          "textContent": "<p>Consistency beats intensity.</p>",
          "pdfUrl": null,
          "order": 2,
          "isPublished": true
        }
      ]
    },
    {
      "uuid": "ae1248d4-3d33-412a-8b60-53a80d123102",
      "title": "Duplication System",
      "order": 2,
      "lessons": [
        {
          "uuid": "f0d78ac4-5295-4dfe-9cb7-5ddac0cb3003",
          "title": "First 7 Days Plan",
          "description": "Execution plan for new team members.",
          "videoUrl": null,
          "videoDuration": null,
          "textContent": "<p>Use this checklist for your first week.</p>",
          "pdfUrl": "https://cdn.example.com/pdfs/first-7-days.pdf",
          "order": 1,
          "isPublished": true
        },
        {
          "uuid": "3fe78f06-7f3d-44ab-98f7-c81adf963004",
          "title": "Closing Conversations",
          "description": "Scripts and confidence builders for closing.",
          "videoUrl": "https://videos.example.com/closing-conversations.mp4",
          "videoDuration": 780,
          "textContent": "<p>Handle objections with empathy.</p>",
          "pdfUrl": null,
          "order": 2,
          "isPublished": false
        }
      ]
    }
  ]
}
```

#### Update Course
`PATCH /api/v1/admin/courses/:uuid`

Updates high-level fields of an existing course. Only include the fields you intend to update.

**Request Body Example:**
```json
{
  "title": "Network Marketing Mastery 2.0",
  "thumbnailUrl": "https://cdn.example.com/lms/network-marketing-mastery-v2.jpg",
  "price": 1999
}
```

**Updatable fields**

- `title`
- `description`
- `thumbnailUrl`
- `isFree`
- `price`

> **Note:** The backend accepts partial updates. If the frontend switches a course to paid mode, send a valid `price` together with `isFree: false`.

#### Delete Course
`DELETE /api/v1/admin/courses/:uuid`

Deletes a course completely.

**Success Response**
```json
{
  "deleted": true
}
```

> **Warning:** You **cannot** delete a course that already has user enrollments. The backend returns `400 Bad Request`, so the frontend should recommend **Unpublish** instead.

**Example Error Response**
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Cannot delete course with active enrollments. Unpublish it instead.",
  "timestamp": "2026-04-03T09:10:00.000Z",
  "path": "/api/v1/admin/courses/4c648d1d-7f1e-4c0a-907d-3a2a84f4b101"
}
```

#### Publish / Unpublish Course
`PATCH /api/v1/admin/courses/:uuid/publish`
`PATCH /api/v1/admin/courses/:uuid/unpublish`

Quick endpoints to toggle course visibility. Only published courses appear in the user course browser.

When to use:

- `publish`: After the course is ready for learners.
- `unpublish`: To hide the course without deleting it.

**Example Response**
```json
{
  "uuid": "4c648d1d-7f1e-4c0a-907d-3a2a84f4b101",
  "title": "Network Marketing Mastery 2.0",
  "description": "A complete beginner-to-advanced course for the NSI system.",
  "thumbnailUrl": "https://cdn.example.com/lms/network-marketing-mastery-v2.jpg",
  "isFree": false,
  "price": 1999,
  "isPublished": true,
  "createdAt": "2026-04-03T08:30:00.000Z",
  "updatedAt": "2026-04-03T09:15:00.000Z"
}
```

---

### 2.2 Section Management

#### Add Section
`POST /api/v1/admin/courses/:uuid/sections`

**Request Body:**
```json
{
  "title": "Duplication System",
  "order": 2
}
```

**Response fields**

| Field | Type | Notes |
|---|---|---|
| `uuid` | `string` | Section UUID |
| `courseUuid` | `string` | Parent course UUID |
| `title` | `string` | Section title |
| `order` | `number` | Section order, must be `>= 1` |
| `createdAt` | `string` | ISO timestamp |
| `updatedAt` | `string` | ISO timestamp |

**Example Response**
```json
{
  "uuid": "ae1248d4-3d33-412a-8b60-53a80d123102",
  "courseUuid": "4c648d1d-7f1e-4c0a-907d-3a2a84f4b101",
  "title": "Duplication System",
  "order": 2,
  "createdAt": "2026-04-03T09:20:00.000Z",
  "updatedAt": "2026-04-03T09:20:00.000Z"
}
```

#### Update Section
`PATCH /api/v1/admin/courses/:courseUuid/sections/:sectionUuid`

**Request Body Example:**
```json
{
  "title": "Duplication System and Scripts",
  "order": 3
}
```

**Example Response**
```json
{
  "uuid": "ae1248d4-3d33-412a-8b60-53a80d123102",
  "courseUuid": "4c648d1d-7f1e-4c0a-907d-3a2a84f4b101",
  "title": "Duplication System and Scripts",
  "order": 3,
  "createdAt": "2026-04-03T09:20:00.000Z",
  "updatedAt": "2026-04-03T09:25:00.000Z"
}
```

#### Delete Section
`DELETE /api/v1/admin/courses/:courseUuid/sections/:sectionUuid`

**Success Response**
```json
{
  "deleted": true
}
```

#### Reorder Sections
`PATCH /api/v1/admin/courses/:uuid/sections/reorder`

Used to persist the state after a Drag-and-Drop layout change on the admin UI.

**Request Body:**
```json
{
  "orderedUuids": [
    "6b9d3a0c-2c61-4a7f-8a5d-5e7f1caa3101",
    "ae1248d4-3d33-412a-8b60-53a80d123102",
    "d915f8ef-f278-4fb0-a3ba-6aa6b0383103"
  ]
}
```

**Success Response**
```json
{
  "reordered": true
}
```

**How to implement (Frontend):**

1. Use a drag-and-drop library such as `dnd-kit`.
2. Reorder local state immediately when the drop completes.
3. Build the final `orderedUuids` array in the exact visual order.
4. Send the full section UUID list, not just the moved item.
5. On failure, rollback local state or refetch the course detail.

> **Warning:** The backend sets `order = index + 1` based on the array order you send, so always send the complete final order.

---

### 2.3 Lesson Management

#### Add Lesson
`POST /api/v1/admin/courses/:courseUuid/sections/:sectionUuid/lessons`

**Request Body:**
```json
{
  "title": "Welcome to NSI Platform",
  "description": "Overview of the course and learning path.",
  "videoUrl": "https://videos.example.com/welcome.mp4",
  "videoDuration": 450,
  "textContent": "<p>Welcome to the course.</p>",
  "pdfUrl": "https://cdn.example.com/pdfs/welcome-guide.pdf",
  "order": 1,
  "isPublished": true
}
```

**Response fields**

| Field | Type | Notes |
|---|---|---|
| `uuid` | `string` | Lesson UUID |
| `sectionUuid` | `string` | Parent section UUID |
| `title` | `string` | Lesson title |
| `description` | `string \| null` | Optional description |
| `videoUrl` | `string \| null` | Optional video URL |
| `videoDuration` | `number \| null` | Seconds |
| `textContent` | `string \| null` | Rich text content |
| `pdfUrl` | `string \| null` | Optional PDF URL |
| `order` | `number` | Lesson order |
| `isPublished` | `boolean` | Publish state |
| `createdAt` | `string` | ISO timestamp |
| `updatedAt` | `string` | ISO timestamp |

**Example Response**
```json
{
  "uuid": "8d2c54e2-4a4c-4c40-a8b4-10f7ea473001",
  "sectionUuid": "6b9d3a0c-2c61-4a7f-8a5d-5e7f1caa3101",
  "title": "Welcome to NSI Platform",
  "description": "Overview of the course and learning path.",
  "videoUrl": "https://videos.example.com/welcome.mp4",
  "videoDuration": 450,
  "textContent": "<p>Welcome to the course.</p>",
  "pdfUrl": "https://cdn.example.com/pdfs/welcome-guide.pdf",
  "order": 1,
  "isPublished": true,
  "createdAt": "2026-04-03T09:30:00.000Z",
  "updatedAt": "2026-04-03T09:30:00.000Z"
}
```

> **Note:** The backend does not force at least one of `videoUrl`, `textContent`, or `pdfUrl`. The admin frontend should enforce that a lesson has real content.

#### Update Lesson
`PATCH /api/v1/admin/courses/:courseUuid/sections/:sectionUuid/lessons/:lessonUuid`

Same payload structure as Add Lesson, but all fields are optional.

**Updatable fields**

- `title`
- `description`
- `videoUrl`
- `videoDuration`
- `textContent`
- `pdfUrl`
- `order`
- `isPublished`

**Request Body Example**
```json
{
  "title": "Welcome to NSI Platform - Updated",
  "videoDuration": 480,
  "isPublished": true
}
```

#### Delete Lesson
`DELETE /api/v1/admin/courses/:courseUuid/sections/:sectionUuid/lessons/:lessonUuid`

**Success Response**
```json
{
  "deleted": true
}
```

#### Reorder Lessons
`PATCH /api/v1/admin/courses/:courseUuid/sections/:sectionUuid/lessons/reorder`

Same logic as reordering Sections, but affects Lessons inside a specific Section.

**Request Body:**
```json
{
  "orderedUuids": [
    "8d2c54e2-4a4c-4c40-a8b4-10f7ea473001",
    "c7fbb302-8d5b-4d49-bb5d-3e6ef0ff3002",
    "fd5748ca-0a0e-4ee8-baad-8df0a6243005"
  ]
}
```

**Success Response**
```json
{
  "reordered": true
}
```

Send the full lesson UUID order for that section after drag-and-drop finishes.

---

### 2.4 LMS Analytics (Admin)
`GET /api/v1/admin/lms/analytics`

Provides aggregate dashboard data for the Admin LMS home page.

**Response fields**

| Field | Type | Notes |
|---|---|---|
| `totalCourses` | `number` | Count of all courses |
| `publishedCourses` | `number` | Count of published courses |
| `totalEnrollments` | `number` | Count of all course enrollments |
| `totalCompletions` | `number` | Enrollments with `completedAt` set |
| `completionRate` | `string` | Percentage string like `"35.5%"` |
| `certificatesIssued` | `number` | Enrollments with non-null `certificateUrl` |
| `courseBreakdown` | `array` | Per-course stats |

**Example Response:**
```json
{
  "totalCourses": 12,
  "publishedCourses": 9,
  "totalEnrollments": 245,
  "totalCompletions": 87,
  "completionRate": "35.5%",
  "certificatesIssued": 79,
  "courseBreakdown": [
    {
      "uuid": "4c648d1d-7f1e-4c0a-907d-3a2a84f4b101",
      "title": "Network Marketing Mastery 2.0",
      "isFree": false,
      "enrollments": 128,
      "completions": 54,
      "completionRate": "42.2%",
      "avgProgress": 61
    },
    {
      "uuid": "1dc5f8d1-4834-4301-9c0e-2a7dcfceb202",
      "title": "Getting Started With NSI",
      "isFree": true,
      "enrollments": 117,
      "completions": 33,
      "completionRate": "28.2%",
      "avgProgress": 47
    }
  ]
}
```
- **totalCourses**: Sum of all courses created.
- **publishedCourses**: Courses visually available to users.
- **totalEnrollments**: Distinct user <-> course enrollment records.
- **totalCompletions**: Enrollments that have successfully finished 100% of the lessons.
- **completionRate**: Overall percent ratio of completions vs enrollments.
- **certificatesIssued**: Count of enrollments with a stored `certificateUrl`.
- **courseBreakdown**: Used to build a table showing the performance of individual courses.

---

## 👨‍🎓 SECTION 3 — USER SIDE APIs

All User endpoints are prefixed with `/api/v1/lms/` and require a valid Bearer JWT. 

### 3.1 Browse Courses
`GET /api/v1/lms/courses`

Available to CUSTOMER and DISTRIBUTOR roles. Returns all published courses along with the current user's specific progress data.

**Response fields**

| Field | Type | Notes |
|---|---|---|
| `uuid` | `string` | Course UUID |
| `title` | `string` | Course title |
| `description` | `string` | Course description |
| `thumbnailUrl` | `string \| null` | Optional image |
| `isFree` | `boolean` | Free vs paid |
| `price` | `number` | Course price |
| `totalSections` | `number` | Section count |
| `totalLessons` | `number` | Lesson count |
| `isEnrolled` | `boolean` | Enrollment state |
| `progress` | `number \| null` | Progress for enrolled users; otherwise `null` |

**Example Response:**
```json
[
  {
    "uuid": "4c648d1d-7f1e-4c0a-907d-3a2a84f4b101",
    "title": "Network Marketing Mastery 2.0",
    "description": "A complete beginner-to-advanced course for the NSI system.",
    "thumbnailUrl": "https://cdn.example.com/lms/network-marketing-mastery-v2.jpg",
    "isFree": false,
    "price": 1999,
    "totalSections": 2,
    "totalLessons": 4,
    "isEnrolled": true,
    "progress": 50
  },
  {
    "uuid": "1dc5f8d1-4834-4301-9c0e-2a7dcfceb202",
    "title": "Getting Started With NSI",
    "description": "Free onboarding course for new learners.",
    "thumbnailUrl": "https://cdn.example.com/lms/getting-started.jpg",
    "isFree": true,
    "price": 0,
    "totalSections": 1,
    "totalLessons": 4,
    "isEnrolled": false,
    "progress": null
  }
]
```

**How to use in UI**

- If `isEnrolled` is `true`, show `Continue Learning`.
- If `isEnrolled` is `false`, show `Enroll` or `Buy Now`.
- Use backend `progress` directly for course cards.

### 3.2 Course Detail
`GET /api/v1/lms/courses/:uuid`

Fetches course detail, including the sections and a list of lessons indicating which are currently locked for the user.

**Response fields**

| Field | Type | Notes |
|---|---|---|
| `uuid` | `string` | Course UUID |
| `title` | `string` | Course title |
| `description` | `string` | Course description |
| `thumbnailUrl` | `string \| null` | Optional image |
| `isFree` | `boolean` | Free vs paid |
| `price` | `number` | Course price |
| `enrollment` | `object \| null` | Enrollment summary if enrolled |
| `sections` | `array` | Section outline |

**Enrollment object**

| Field | Type | Notes |
|---|---|---|
| `enrolledAt` | `string` | ISO timestamp |
| `completedAt` | `string \| null` | Set after course completion |
| `progress` | `number` | Progress percentage |

**Lesson object**

| Field | Type | Notes |
|---|---|---|
| `uuid` | `string` | Lesson UUID |
| `title` | `string` | Lesson title |
| `order` | `number` | Lesson order |
| `videoDuration` | `number \| null` | Seconds |
| `isCompleted` | `boolean` | Completion state |
| `isLocked` | `boolean` | Backend-computed lock state |

**Example Response**
```json
{
  "uuid": "4c648d1d-7f1e-4c0a-907d-3a2a84f4b101",
  "title": "Network Marketing Mastery 2.0",
  "description": "A complete beginner-to-advanced course for the NSI system.",
  "thumbnailUrl": "https://cdn.example.com/lms/network-marketing-mastery-v2.jpg",
  "isFree": false,
  "price": 1999,
  "enrollment": {
    "enrolledAt": "2026-04-03T10:00:00.000Z",
    "completedAt": null,
    "progress": 50
  },
  "sections": [
    {
      "uuid": "6b9d3a0c-2c61-4a7f-8a5d-5e7f1caa3101",
      "title": "Foundation",
      "order": 1,
      "lessons": [
        {
          "uuid": "8d2c54e2-4a4c-4c40-a8b4-10f7ea473001",
          "title": "Welcome to NSI Platform",
          "order": 1,
          "videoDuration": 450,
          "isCompleted": true,
          "isLocked": false
        },
        {
          "uuid": "c7fbb302-8d5b-4d49-bb5d-3e6ef0ff3002",
          "title": "Mindset Basics",
          "order": 2,
          "videoDuration": 900,
          "isCompleted": true,
          "isLocked": false
        }
      ]
    },
    {
      "uuid": "ae1248d4-3d33-412a-8b60-53a80d123102",
      "title": "Duplication System",
      "order": 2,
      "lessons": [
        {
          "uuid": "f0d78ac4-5295-4dfe-9cb7-5ddac0cb3003",
          "title": "First 7 Days Plan",
          "order": 1,
          "videoDuration": null,
          "isCompleted": false,
          "isLocked": false
        },
        {
          "uuid": "3fe78f06-7f3d-44ab-98f7-c81adf963004",
          "title": "Closing Conversations",
          "order": 2,
          "videoDuration": 780,
          "isCompleted": false,
          "isLocked": true
        }
      ]
    }
  ]
}
```

> **Note:** Use this endpoint for overview and progress. Use `/api/v1/lms/courses/:uuid/learn` for the actual playable lesson content.
- `isCompleted`: Shows a green Checkmark ✅.
- `isLocked`: Shows a Lock icon 🔒. The user physically cannot view this lesson until they complete the previous one.

### 3.3 Enroll in Course

#### Free Course Enrollment
`POST /api/v1/lms/courses/:uuid/enroll`

**Request Body:** Empty object or no body.

```json
{}
```

**Response:**
```json
{
  "enrolled": true,
  "message": "Enrolled successfully"
}
```

**Next Step (Frontend):**

- Enrollment is created immediately.
- Redirect the user to the learn page right away.

#### Paid Course Enrollment
`POST /api/v1/lms/courses/:uuid/enroll`

**Response:**
```json
{
  "orderId": "order_Q7uW5K9xZp8n2R",
  "amount": 199900,
  "currency": "INR",
  "keyId": "rzp_live_xxxxxxxxxxxx"
}
```

**Response fields**

| Field | Type | Notes |
|---|---|---|
| `orderId` | `string` | Razorpay order ID |
| `amount` | `number` | Amount in paise |
| `currency` | `string` | Usually `INR` |
| `keyId` | `string` | Razorpay public key |

**Frontend flow**

- Call this endpoint.
- If the response contains `orderId`, open Razorpay checkout.
- Do not create the enrollment in frontend code.
- The backend webhook creates the enrollment after successful payment.
- In mock mode, the backend auto-creates enrollment after about 2 seconds.

**Next Step:** See [SECTION 6](#section-6--razorpay-integration-for-lms) below.

### 3.4 Learn Page
`GET /api/v1/lms/courses/:uuid/learn`

Access permitted **only if enrolled**. Returns the entire course structure loaded with your actual progress data such as `watchedSeconds`.

**Example Response**
```json
{
  "uuid": "4c648d1d-7f1e-4c0a-907d-3a2a84f4b101",
  "title": "Network Marketing Mastery 2.0",
  "description": "A complete beginner-to-advanced course for the NSI system.",
  "thumbnailUrl": "https://cdn.example.com/lms/network-marketing-mastery-v2.jpg",
  "sections": [
    {
      "uuid": "6b9d3a0c-2c61-4a7f-8a5d-5e7f1caa3101",
      "title": "Foundation",
      "order": 1,
      "lessons": [
        {
          "uuid": "8d2c54e2-4a4c-4c40-a8b4-10f7ea473001",
          "title": "Welcome to NSI Platform",
          "description": "Overview of the course and learning path.",
          "videoUrl": "https://videos.example.com/welcome.mp4",
          "videoDuration": 450,
          "textContent": "<p>Welcome to the course.</p>",
          "pdfUrl": "https://cdn.example.com/pdfs/welcome-guide.pdf",
          "order": 1,
          "isCompleted": true,
          "watchedSeconds": 450,
          "isLocked": false
        },
        {
          "uuid": "c7fbb302-8d5b-4d49-bb5d-3e6ef0ff3002",
          "title": "Mindset Basics",
          "description": "How to approach the business correctly.",
          "videoUrl": "https://videos.example.com/mindset-basics.mp4",
          "videoDuration": 900,
          "textContent": "<p>Consistency beats intensity.</p>",
          "pdfUrl": null,
          "order": 2,
          "isCompleted": false,
          "watchedSeconds": 360,
          "isLocked": false
        }
      ]
    }
  ]
}
```

**UI Implementation**

- Use this JSON tree to build the left sidebar and the active lesson content.
- Show a lock icon when `isLocked` is `true`.
- Show completion state from `isCompleted`.
- Resume video using `watchedSeconds` when possible.
- Learn response does **not** include a top-level progress percentage, so compute progress from the returned lesson completion states for the learn page.

### 3.5 My Courses
`GET /api/v1/lms/my-courses`

Returns only the courses the user has explicitly enrolled in.

**Fields returned:**
```json
{
  "courses": [
    {
      "uuid": "4c648d1d-7f1e-4c0a-907d-3a2a84f4b101",
      "title": "Network Marketing Mastery 2.0",
      "thumbnailUrl": "https://cdn.example.com/lms/network-marketing-mastery-v2.jpg",
      "enrolledAt": "2026-04-03T10:00:00.000Z",
      "completedAt": null,
      "progress": 50,
      "certificateUrl": null,
      "totalLessons": 4,
      "completedLessons": 2,
      "lastActivityAt": "2026-04-03T12:12:00.000Z"
    }
  ]
}
```

**Frontend Use**

- Render a personal dashboard of enrolled courses.
- Show `enrolledAt`, `lastActivityAt`, and progress.
- If `completedAt` exists and `certificateUrl` exists, show `Download Certificate`.
- If `completedAt` exists but `certificateUrl` is still `null`, show `Generating certificate...` and call the certificate endpoint on demand.

### 3.6 Single Lesson Access
`GET /api/v1/lms/lessons/:uuid`

Fetches the rich content (`videoUrl`, `textContent`, `pdfUrl`) for a specific lesson. If the lesson is structurally `isLocked`, this API will throw a **403 Forbidden**. 

**Example Response**
```json
{
  "uuid": "c7fbb302-8d5b-4d49-bb5d-3e6ef0ff3002",
  "title": "Mindset Basics",
  "description": "How to approach the business correctly.",
  "videoUrl": "https://videos.example.com/mindset-basics.mp4",
  "videoDuration": 900,
  "textContent": "<p>Consistency beats intensity.</p>",
  "pdfUrl": null,
  "order": 2,
  "isCompleted": false,
  "watchedSeconds": 360
}
```

Use this endpoint for deep links, refreshes, or direct lesson routes like `/learn/:lessonUuid`.

### 3.7 Video Progress Tracking
`POST /api/v1/lms/lessons/:uuid/progress`

Used primarily for ticking off video continuation percentages.

**Request Body:**
```json
{ "watchedSeconds": 45 }
```
**Response:**
```json
{
  "isCompleted": false,
  "watchedSeconds": 45
}
```

How to use this endpoint:

- Call it every 5 to 10 seconds while the video is actively playing.
- Send the current playback time in seconds, not the delta since the last request.
- Avoid multiple in-flight requests at the same time.

> **Auto-Complete Logic:** If `watchedSeconds >= videoDuration * 0.9`, the backend instantly sets `isCompleted = true`.

When `isCompleted` becomes `true`:

- Show a `Next Lesson` button.
- Refetch the learn page payload so the next lesson unlocks.
- Update the progress bar.

### 3.8 Manual Lesson Complete
`POST /api/v1/lms/lessons/:uuid/complete`

Some lessons only have Text or PDFs (no video). For these, provide a "Mark as Complete" button on the UI.

**Response:**
```json
{ "isCompleted": true }
```

After success:

- Refetch course learn content.
- Unlock the next lesson.
- Update the progress bar.

### 3.9 Get Certificate
`GET /api/v1/lms/courses/:uuid/certificate`

Once a user's course `progress` hits 100% and `completedAt` is populated, they can request their certificate.

**Response:**
```json
{
  "certificateUrl": "/uploads/certificates/CERT-AB12CD34.pdf",
  "certificateId": "CERT-AB12CD34"
}
```

Use this on the frontend by:

- Calling it when the user clicks `Download Certificate`
- Prefixing `certificateUrl` with your API origin if it is relative
- Opening the final URL in a new tab or triggering a download
- Showing `certificateId` in the UI for verification/reference

If the course is not completed yet, the backend responds like this:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Course not completed yet",
  "timestamp": "2026-04-03T12:30:00.000Z",
  "path": "/api/v1/lms/courses/4c648d1d-7f1e-4c0a-907d-3a2a84f4b101/certificate"
}
```
Frontend action: Display a prominent Download 🏅 button that opens `certificateUrl` in `target="_blank"`.

---

## 💻 SECTION 4 — UI IMPLEMENTATION GUIDE

### 4.1 Course Catalog Page (User)
- **Layout:** Grid of vertical course cards.
- **Card Elements:**
  - Total lessons count.
  - Thumbnail at top edge.
  - Bold Title string.
  - Badge overlapping thumbnail in the corner indicating Free or Price (e.g., `₹ 1999`).
  - Progress bar along the bottom if `isEnrolled == true`.
  - Otherwise, a big "Enroll Now" CTA.
- **Filter Tabs:** All / Free / Paid / Enrolled.

### 4.2 Course Detail Page (User)
The pre-enrollment landing page for a course.
- **Header:** Title, meta description, huge thumbnail.
- **CTA Section:** If not enrolled, highlight the Price and provide an `Enroll` button. If enrolled, render a `Continue Learning` button alongside their current percentage bar.
- **Accordion:** An accordion mapping the Sections and their Lessons.
  - List visually what to expect.
  - Duration formats as MM:SS.
  - If enrolled, lock icons `🔒` or checkmarks `✅` should appear dynamically.

### 4.3 Learn Page / Video Player UI
This is the core immersive interface. The standard split-screen UI is recommended:
- **Left Sidebar (25% width):** Course Outline Navigation.
  - Shows Section headers natively open or collapsible.
  - Lesson items with status icons (`✅`, `🔒`, `▶️` for active).
  - Actively highlighted row based on route params.
- **Main Area (75% width):** Content Viewer.
  - Top: Progress bar tracking course %.
  - Inside: Large HTML5 video player or iframe.
  - Below video: Document rendering for HTML `textContent` (using `dangerouslySetInnerHTML`).
  - Below text: Large `[PDF📄 Download]` button if `pdfUrl` isn't null.
- **Completion States:** If `isCompleted: true`, pop a toast and immediately render the bright `Next Lesson ➡️` button pointing to the sequential next uuid.

Additional implementation notes:

- Use the learn payload as the source of truth for sidebar state.
- Compute the top progress bar from completed lessons in the learn payload.
- Resume playback using `watchedSeconds` when possible.

### 4.4 Video Progress Implementation
**Tracking pseudocode logic:**
```javascript
let progressInterval = null;
let lastSentSecond = 0;
let requestInFlight = false;

function startVideoTracking(videoElement, lessonUuid) {
  if (progressInterval) clearInterval(progressInterval);

  progressInterval = setInterval(async () => {
    if (videoElement.paused || videoElement.ended || requestInFlight) return;

    const watchedSeconds = Math.floor(videoElement.currentTime);

    if (watchedSeconds <= 0) return;
    if (watchedSeconds === lastSentSecond) return;
    if (watchedSeconds - lastSentSecond < 5) return;

    requestInFlight = true;

    try {
      const res = await api.post(`/api/v1/lms/lessons/${lessonUuid}/progress`, {
        watchedSeconds
      });

      lastSentSecond = watchedSeconds;

      if (res.data.isCompleted) {
        showNextLessonButton();
        await refetchLearnContent();
      }
    } finally {
      requestInFlight = false;
    }
  }, 5000);
}
```

Key implementation rules:

- Send absolute player `currentTime`, not delta time
- Trigger every 5 seconds while the video is playing
- Avoid overlapping requests
- Refetch learn content when the backend returns `isCompleted: true`

### 4.5 My Courses Dashboard
A dedicated route `/my-courses`. 
- Course cards showing large circular progress wheels or thick progress bars.
- Render metrics like: "Enrolled: Oct 12", "Last activity: 2 hours ago".
- Buttons vary based on state:
  - 0%: `Start Learning`
  - 1% - 99%: `Continue Learning`
  - 100%: `Download Certificate`

If `completedAt` exists but `certificateUrl` is still `null`, show `Generating certificate...` and call the certificate endpoint on demand.

### 4.6 Certificate Download
Simply make a GET request to `3.9 Get Certificate`, receive the `certificateUrl`, construct your platform's base URL (if needed), and trigger an anchor link download. Display the `certificateId` string so users can showcase it.

If `certificateUrl` is relative, prefix it with your API origin before opening it.

### 4.7 Admin Course Builder
Use a multi-step form wizard UI:
- **Step 1:** Build the Course object (Title, Descr, image, price).
- **Step 2:** An empty layout to start "Add Section". Inside each section shell, render a button "Add Lesson".
- **Step 3:** Nested Drag-and-Drop arrays. Drag lessons within sections, or entire sections around.
- **Step 4:** A top-level toggle switch to `Publish`. Use the Analytics overview metrics underneath to prove utility.

Recommended extras:

- Show enrollment count per course
- Show completion rate per course
- Warn before publishing a course with zero published lessons

---

## 🔒 SECTION 5 — LESSON LOCKING RULES

Mihir, these are the strict locking mandates your frontend must honor:

- First lesson of the entire course = never locked
- Every other lesson = locked until the previous lesson has `isCompleted === true`
- `isLocked` is returned from backend, so frontend only reads it
- Locked lesson UI = gray row, lock icon, and toast saying `Complete previous lesson first`
- When a lesson completes, refetch course learn content to get updated `isLocked` states

1. **The First Rule:** The absolute very first lesson of the course array is **NEVER** locked.
2. **The Lock Prop:** The `isLocked` Boolean is returned directly by the backend payload on `Course Detail` and `Learn Page` endpoints. 
   - **DO NOT calculate lock statuses on the frontend.** Strictly map the class `locked-element` visually if the schema provides `isLocked: true`.
3. **Behavior:** 
   - Gray out locked lesson rows in the sidebar.
   - Show a 🔒 icon.
   - If a user clicks a locked lesson, intercept it gracefully using an alert or toast: *"Complete previous lesson first"* and do not try to fetch its data.
4. **Resolution:** The moment the active lesson is flagged as completed (e.g. video hits 90%), you should silently refresh the course blueprint, or surgically mutate the immediately next lesson in your local state store to `isLocked: false` so they can smoothly advance.

---

## 💳 SECTION 6 — RAZORPAY INTEGRATION FOR LMS

Paid courses leverage our exact checkout infrastructure. 

**Step 1:** User clicks "Enroll" on a paid course screen.
**Step 2:** App POSTs `/api/v1/lms/courses/:uuid/enroll`.
**Step 3:** The payload you get back:
```json
{
  "orderId": "order_abc123",
  "amount": 499900,
  "currency": "INR",
  "keyId": "rzp_test_mock"
}
```
**Step 4:** Using the official Razorpay JS SDK script, spin up the checkout modal:
```javascript
async function enrollInPaidCourse(courseUuid, courseTitle, currentUser) {
  const response = await api.post(`/api/v1/lms/courses/${courseUuid}/enroll`);

  if (response.keyId === "rzp_test_mock") {
    await waitForEnrollment(courseUuid);
    window.location.href = `/courses/${courseUuid}/learn`;
    return;
  }

  const options = {
    key: response.keyId,
    amount: response.amount,
    currency: response.currency,
    name: "NSI Platform",
    description: `Enrollment for ${courseTitle}`,
    order_id: response.orderId,
    handler: async function () {
      await waitForEnrollment(courseUuid);
      window.location.href = `/courses/${courseUuid}/learn`;
    },
    prefill: {
      name: currentUser.name,
      email: currentUser.email,
      contact: currentUser.phone || ""
    },
    theme: { color: "#1a3a5c" }
  };

  const rzp = new window.Razorpay(options);
  rzp.open();
}

async function waitForEnrollment(courseUuid) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const course = await api.get(`/api/v1/lms/courses/${courseUuid}`);

    if (course.enrollment) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error("Payment succeeded, but enrollment is still pending. Please retry in a moment.");
}
```
**Step 5:** Post-Payment. 
Once the modal resolves, our server webhook silently creates the `CourseEnrollment` record. 
*(Mock Mode Context: it occurs ~2 seconds after checkout init).*

**Step 6:** Because webhooks are asynchronous, show `Processing your enrollment...` and poll `GET /api/v1/lms/courses/:uuid` until `enrollment` is present.
**Step 7:** Redirect to the `/learn` page.

Important notes:

- `amount` is already in paise; pass it to Razorpay as-is.
- Frontend does **not** call the webhook endpoint.
- In mock mode, backend auto-enrolls after about 2 seconds.
- On `GET /api/v1/lms/courses/:uuid`, treat `enrollment !== null` as the paid-enrollment success signal.

---

## ⚠️ SECTION 7 — ERROR HANDLING

Be prepared to intercept and elegantly handle these API status codes on the LMS endpoints:

**Standard error response shape**
```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Complete the previous lesson first",
  "timestamp": "2026-04-03T12:45:00.000Z",
  "path": "/api/v1/lms/lessons/3fe78f06-7f3d-44ab-98f7-c81adf963004"
}
```

| Code | Scenario | Recommended Frontend Action |
|------|----------|-----------------------------|
| **401** | Unauthorized / No JWT provided | Hard-redirect the user to the `/login` screen immediately. |
| **403** | Attempting to fetch content without enrollment | Redirect to Course Detail page or show an inline "Please Enroll to Access" CTA. |
| **403** | `Lesson is locked` | Catch this exception on the single lesson API and show a toast: "Complete the previous lesson first". |
| **400** | Certificate requested before 100% completion | Disable the download button. Show an inert tooltip. |
| **404** | Course or Lesson ID is misspelled | Show a friendly 404 "Content Not Found" fallback component. |
| **409** | Enrolling in a course they already own | Automatically push them to the `/learn` page instead of alarming them. |

Validation errors can return `message` as an array of strings instead of a single string.

> **Note:** Most learning endpoints return `403` for unenrolled access. The certificate endpoint returns `404 Enrollment not found` if there is no enrollment record.

---

## ✅ SECTION 8 — COMPLETE IMPLEMENTATION CHECKLIST

### 🎯 Admin Side Development Checklist
- [ ] Course list page with create button
- [ ] Course creation form
- [ ] Section management with drag-drop
- [ ] Lesson management with drag-drop
- [ ] Publish/unpublish toggle
- [ ] LMS analytics page

### 🎓 User Side Development Checklist
- [ ] Course catalog page
- [ ] Course detail page
- [ ] Enrollment flow (free + paid)
- [ ] Learn page with video player
- [ ] Video progress tracking (every 5 sec)
- [ ] Text content display
- [ ] PDF download button
- [ ] Lesson completion handling
- [ ] My courses dashboard
- [ ] Certificate download

--- 
*End of Guide. Ensure you strictly correlate your payload variables and types to the DTO documentation mentioned within.*
