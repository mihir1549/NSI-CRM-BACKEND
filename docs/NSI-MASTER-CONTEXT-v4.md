# NSI Platform — Master Context Document v4

> **Purpose:** This document gives a new AI chat session full context of the NSI Platform project without needing any prior chat history. Every decision, every module, every endpoint is documented here.

> **Document version:** 4.0 | **Generated:** April 2026
> **Next update:** After Admin APIs frontend documentation generated

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [How We Work](#3-how-we-work)
4. [Team](#4-team)
5. [Database Schema Summary](#5-database-schema-summary)
6. [Completed Modules](#6-completed-modules)
   - [Module 1 — Auth](#module-1--auth)
   - [Module 2 — Funnel Engine](#module-2--funnel-engine)
   - [Module 3 — Phone + Payment + Coupon](#module-3--phone--payment--coupon)
   - [Module 4 — Lead System](#module-4--lead-system)
   - [Module 5 — LMS](#module-5--lms)
   - [Module 6 — Distributor System](#module-6--distributor-system)
   - [Module 7 — Admin APIs](#module-7--admin-apis)
7. [Key Technical Decisions](#7-key-technical-decisions)
8. [API Structure](#8-api-structure)
9. [Environment Variables](#9-environment-variables)
10. [Current Test Status](#10-current-test-status)
11. [File Structure](#11-file-structure)
12. [Pending Work](#12-pending-work)
13. [Documentation Files](#13-documentation-files)
14. [Frontend Implementation Status](#14-frontend-implementation-status)

---

## 1. Project Overview

- **Project Name:** NSI Platform
- **Domain:** growithnsi.com
- **What it is:** A combined CRM + LMS + Multi-level marketing platform for Nageshwar Shukla's Kangen water machine business
- **Business model:**
  - Users land on site via referral or direct traffic
  - Watch a video funnel (multiple steps)
  - Pay a commitment fee (₹ amount via Razorpay)
  - Make a YES/NO decision about joining the business
  - YES → become a HOT lead, team follows up, sells machine → becomes CUSTOMER
  - NO → enters nurture email sequence
  - Customers can upgrade to Distributors by paying monthly subscription
  - Distributors get their own join link to refer new users
- **Demo deadline:** May 1, 2026
- **GitHub Repo:** NSI-CRM-BACKEND (public)

---

## 2. Tech Stack

| Technology | Purpose | Version |
|-----------|---------|---------|
| NestJS | Backend framework | Latest |
| TypeScript | Language | Latest |
| PostgreSQL | Database | Latest |
| Prisma ORM | Database ORM | v5.21.1 |
| JWT | Authentication tokens | Latest |
| Google OAuth | Social login | Passport |
| Razorpay | Payment gateway + Subscriptions | Latest |
| Twilio Verify | WhatsApp + SMS OTP | Latest |
| Resend | Email sending | Latest |
| Puppeteer | PDF certificate generation | Latest |
| qrcode | QR code generation | Latest |
| @nestjs/schedule | Cron jobs | Latest |
| Jest + ts-jest | Testing | Latest |
| SWC | TypeScript compiler (fast) | Latest |

---

## 3. How We Work

**Development process every module:**

1. Plan in Claude.ai — architecture + design decisions
2. Write Antigravity (Claude Code) prompt based on plan
3. Antigravity implements the code
4. Run: `npx tsc --noEmit` — must be ZERO errors
5. Run: `npm test` — must be 75/75 passing
6. Run: `npm run start:dev` — must start clean
7. Push to GitHub with professional commit message
8. Generate frontend documentation for Mihir (frontend developer)
9. Move to next module

**Hard gates before moving to next module:**
- Zero TypeScript errors
- All tests passing
- Server starts clean

**Important rules:**
- Backend is ALWAYS source of truth
- RolesGuard fetches role fresh from DB on every request
- All IDs are UUID v4 — no numeric IDs
- No raw SQL — Prisma only
- All admin actions logged to audit_logs
- Fire-and-forget for all emails (never block API response)
- Amounts always stored in rupees in DB, sent in paise to Razorpay
- DISTRIBUTOR role only granted via successful payment — never via admin role change API

**Tool usage:**
- Claude.ai — planning, architecture decisions, prompt writing, document generation
- Antigravity (Claude Code) — backend implementation
- Codex — document generation and updates

---

## 4. Team

| Person | Role |
|--------|------|
| Mihir (you) | Backend developer + planning with Claude AI |
| Mihir (frontend) | Frontend developer, implements UI based on docs |
| Nageshwar Shukla | Business owner / Super Admin / client |

---

## 5. Database Schema Summary

### Enums

```prisma
enum UserRole {
  USER
  CUSTOMER
  DISTRIBUTOR
  ADMIN
  SUPER_ADMIN
}

enum UserStatus {
  REGISTERED
  ACTIVE
  SUSPENDED
}

enum LeadStatus {
  NEW
  WARM
  HOT
  CONTACTED
  FOLLOWUP
  NURTURE
  LOST
  MARK_AS_CUSTOMER
}

enum PaymentStatus {
  PENDING
  SUCCESS
  FAILED
}

enum PaymentType {
  COMMITMENT_FEE
  LMS_COURSE
  DISTRIBUTOR_SUB
}

enum FunnelStepType {
  VIDEO
  TEXT
  PHONE_GATE
  PAYMENT_GATE
  DECISION
}

enum DistributorSubscriptionStatus {
  ACTIVE
  HALTED
  CANCELLED
  EXPIRED
  GRACE
}

enum TaskStatus {
  TODO
  IN_PROGRESS
  COMPLETE
}
```

### Key Models

**User** — core user record
````
uuid, fullName, email, passwordHash, role, status,
country, googleId, avatarUrl, emailVerified,
distributorCode (unique), joinLinkActive,
suspendedAt, suspendedBy, createdAt, updatedAt
````

**UserProfile** — extended profile
````
uuid, userUuid (unique FK), phone,
phoneVerifiedAt, createdAt, updatedAt
````

**AuthSession** — refresh token sessions
````
uuid, userUuid, tokenHash, expiresAt, ipAddress,
userAgent, createdAt
````

**FunnelStep** — admin-configured funnel steps
````
uuid, sectionUuid, type, order, isActive,
title, content (JSON), createdAt, updatedAt
````

**FunnelProgress** — per-user funnel state
````
uuid, userUuid (unique), currentStepUuid,
phoneVerified, paymentCompleted,
decisionAnswer (yes/no/null), decisionAnsweredAt,
createdAt, updatedAt
````

**StepProgress** — per-step completion tracking
````
uuid, funnelProgressUuid, stepUuid,
isCompleted, watchedSeconds, completedAt
````

**Lead** — CRM lead record
````
uuid, userUuid (unique), assignedToUuid,
distributorUuid, status, phone,
createdAt, updatedAt
````

**LeadActivity** — lead history log
````
uuid, leadUuid, actorUuid, action,
fromStatus, toStatus, notes,
followupAt, createdAt
````

**NurtureEnrollment** — nurture email tracking
````
uuid, userUuid, currentDay, completedAt,
createdAt, updatedAt
````

**Payment** — payment records
````
uuid, userUuid, gatewayOrderId, gatewayPaymentId,
amount, discountAmount, finalAmount, currency,
status, paymentType, metadata (JSON),
couponUuid, createdAt, updatedAt
````

**Coupon** — discount coupons
````
uuid, code (unique), type (FLAT/PERCENT/FREE),
value, applicableTo, usageLimit, usedCount,
perUserLimit, expiresAt, isActive,
createdAt, updatedAt
````

**Course** — LMS courses
````
uuid, title, description, thumbnailUrl,
isFree, price, isPublished, createdAt, updatedAt
````

**CourseSection** — course sections
````
uuid, courseUuid, title, order, createdAt, updatedAt
````

**CourseLesson** — individual lessons
````
uuid, sectionUuid, title, description,
videoUrl, videoDuration (seconds),
textContent, pdfUrl, order, isPublished,
createdAt, updatedAt
````

**CourseEnrollment** — user course enrollments
````
uuid, userUuid, courseUuid (unique together),
enrolledAt, completedAt, certificateUrl, isActive
````

**LessonProgress** — per-lesson completion
````
uuid, userUuid, lessonUuid (unique together),
isCompleted, watchedSeconds, completedAt,
createdAt, updatedAt
````

**AuditLog** — admin action audit trail
````
uuid, actorUuid, action, metadata (JSON),
ipAddress, createdAt
````

**DistributorPlan** — subscription plans
````
uuid, razorpayPlanId (unique), name,
amount (rupees), interval (monthly),
isActive, createdAt, updatedAt
````

**DistributorSubscription** — per-distributor subscription
````
uuid, userUuid (unique), planUuid,
razorpaySubscriptionId (unique), status,
currentPeriodEnd, graceDeadline,
cancelledAt, createdAt, updatedAt
````

**DistributorTask** — kanban tasks
````
uuid, distributorUuid, leadUuid (optional),
title, status (TaskStatus), dueDate (optional),
order (Int), createdAt, updatedAt
````

**DistributorCalendarNote** — personal calendar notes
````
uuid, distributorUuid, date (Date only),
note, createdAt, updatedAt
````

---

## 6. Completed Modules

### Module 1 — Auth

**File location:** `src/auth/`

**All Endpoints:**

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| POST | /api/v1/auth/signup | None | Register with email+password |
| POST | /api/v1/auth/verify-email-otp | None | Verify email OTP |
| POST | /api/v1/auth/resend-otp | None | Resend email OTP |
| POST | /api/v1/auth/complete-profile | JWT | Set country after signup |
| POST | /api/v1/auth/login | None | Login with email+password |
| POST | /api/v1/auth/refresh | Cookie | Refresh access token |
| POST | /api/v1/auth/logout | JWT | Logout + delete session |
| GET | /api/v1/auth/me | JWT | Get current user profile |
| POST | /api/v1/auth/forgot-password | None | Send reset OTP |
| POST | /api/v1/auth/reset-password | None | Reset with OTP |
| POST | /api/v1/auth/set-password | JWT | Set password (Google users) |
| GET | /api/v1/auth/google | None | Start Google OAuth |
| GET | /api/v1/auth/google/callback | None | Google OAuth callback |
| GET | /api/v1/auth/finalize-google | None | Final Google redirect |

**Signup DTO includes optional field:**
````
referralCode?: string  — silently links new lead to distributor if valid
````

**Auth Response Shape:**
```json
{
  "accessToken": "eyJ...",
  "user": {
    "uuid": "...",
    "fullName": "Patel Rudra",
    "email": "user@gmail.com",
    "role": "USER",
    "status": "ACTIVE",
    "avatarUrl": "https://lh3.googleusercontent.com/..."
  }
}
```

**Key decisions:**
- accessToken in response body (15 min expiry)
- refreshToken in HttpOnly cookie ONLY
- Google OAuth saves avatarUrl from Google profile photo
- avatarUrl is null for email/password users
- SUSPENDED status blocks login and kills all sessions

---

### Module 2 — Funnel Engine

**File location:** `src/funnel/` and `src/funnel-cms/`

**User-facing Endpoints:**

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | /api/v1/funnel/structure | JWT | Get full funnel structure |
| GET | /api/v1/funnel/progress | JWT | Get user's current progress |
| GET | /api/v1/funnel/step/:stepUuid | JWT | Get single step content |
| POST | /api/v1/funnel/step/:stepUuid/complete | JWT | Mark step complete |
| POST | /api/v1/funnel/step/:stepUuid/video-progress | JWT | Save video watch progress |
| POST | /api/v1/funnel/decision | JWT | Submit YES or NO decision |

**Admin CMS Endpoints:** (SUPER_ADMIN only)
- Full funnel builder: sections, steps, content, phone-gate, payment-gate, decision config
- Analytics: funnel, UTM (supports ?distributorUuid= filter), devices, conversions

**Key business rules:**
- Steps unlocked in order
- Video auto-completes at 90% watched
- Decision YES → lead status becomes HOT automatically
- Decision NO → nurture email sequence starts (Day 1, 3, 7)

---

### Module 3 — Phone + Payment + Coupon

**File location:** `src/phone/`, `src/payment/`, `src/coupon/`

**Key decisions:**
- Razorpay amounts ALWAYS in paise (multiply by 100)
- DB stores amounts in RUPEES
- Mock payment provider: auto-confirms after 2 seconds
- Switch via PAYMENT_PROVIDER=mock|razorpay env var
- Coupon types: FLAT, PERCENT, FREE
- Smart delete: hard delete if usedCount=0, soft delete if usedCount>0

---

### Module 4 — Lead System

**File location:** `src/leads/`

**Distributor Endpoints:**

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | /api/v1/leads | DISTRIBUTOR | List my leads (paginated) |
| GET | /api/v1/leads/:uuid | DISTRIBUTOR | Lead detail with funnel progress |
| PATCH | /api/v1/leads/:uuid/status | DISTRIBUTOR | Update lead status |
| GET | /api/v1/leads/followups/today | DISTRIBUTOR | Today's followups |
| GET | /api/v1/leads/transitions/:status | DISTRIBUTOR | Allowed transitions |

**Admin Endpoints:** (SUPER_ADMIN only — same shape, all leads)

**Status Transition Rules:**
```javascript
{
  NEW: [],
  WARM: [],
  HOT: ['CONTACTED', 'FOLLOWUP', 'MARK_AS_CUSTOMER', 'LOST'],
  CONTACTED: ['FOLLOWUP', 'MARK_AS_CUSTOMER', 'LOST'],
  FOLLOWUP: ['CONTACTED', 'MARK_AS_CUSTOMER', 'LOST'],
  NURTURE: [],
  LOST: [],
  MARK_AS_CUSTOMER: []
}
```

**FOLLOWUP status requires:** notes (required) + followupAt (required, future date)

**Nurture sequence:** Day 1 → Day 3 → Day 7 emails → auto LOST

---

### Module 5 — LMS

**File location:** `src/lms/`

**Key business rules:**
- Course structure: Course → Sections → Lessons
- Only SUPER_ADMIN creates courses
- Only CUSTOMER + DISTRIBUTOR can access LMS
- First lesson never locked, each subsequent locked until previous complete
- Auto-complete at 90% video watched
- Certificate auto-generated on course completion
- Lifetime access, no quizzes

---

### Module 6 — Distributor System

**File location:** `src/distributor/`

**All Endpoints:**

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | /api/v1/distributor/join/:code | Public | Validate referral code |
| GET | /api/v1/distributor/plans | Any JWT | Active plans (no razorpayPlanId) |
| POST | /api/v1/distributor/subscribe | Any JWT | Start subscription |
| GET | /api/v1/distributor/subscription | DISTRIBUTOR | Subscription status |
| GET | /api/v1/distributor/join-link | DISTRIBUTOR | Join URL + QR code |
| GET | /api/v1/distributor/dashboard | DISTRIBUTOR | Stats + subscription + join link |
| GET | /api/v1/distributor/analytics/utm | DISTRIBUTOR | UTM analytics (own leads only) |
| GET | /api/v1/distributor/users/analytics | DISTRIBUTOR | Referred user funnel stats |
| GET | /api/v1/distributor/users | DISTRIBUTOR | Paginated referred users |
| GET | /api/v1/distributor/users/:uuid | DISTRIBUTOR | Referred user detail |
| GET | /api/v1/distributor/tasks | DISTRIBUTOR | Kanban tasks by status |
| POST | /api/v1/distributor/tasks | DISTRIBUTOR | Create task |
| PATCH | /api/v1/distributor/tasks/:uuid | DISTRIBUTOR | Update task |
| PATCH | /api/v1/distributor/tasks/:uuid/move | DISTRIBUTOR | Drag and drop |
| DELETE | /api/v1/distributor/tasks/:uuid | DISTRIBUTOR | Delete task |
| GET | /api/v1/distributor/calendar | DISTRIBUTOR | Monthly events |
| POST | /api/v1/distributor/calendar/notes | DISTRIBUTOR | Upsert personal note |
| DELETE | /api/v1/distributor/calendar/notes/:uuid | DISTRIBUTOR | Delete note |
| GET | /api/v1/distributor/notifications | DISTRIBUTOR | Tasks due + followups today |
| POST | /api/v1/admin/distributor-plans | SUPER_ADMIN | Create plan |
| GET | /api/v1/admin/distributor-plans | SUPER_ADMIN | List all plans |
| PATCH | /api/v1/admin/distributor-plans/:uuid/deactivate | SUPER_ADMIN | Deactivate plan |
| GET | /api/v1/admin/distributor-subscriptions | SUPER_ADMIN | List subscriptions |
| GET | /api/v1/admin/distributor-subscriptions/:uuid | SUPER_ADMIN | Subscription detail |
| POST | /api/v1/admin/distributor-subscriptions/:uuid/cancel | SUPER_ADMIN | Cancel immediately |
| POST | /api/v1/distributor/webhook | Public | Razorpay webhook handler |

**Subscription lifecycle:**
````
Subscribe → ACTIVE
Payment fails → HALTED (7-day grace) → cron → EXPIRED → downgrade to CUSTOMER
Admin cancels → CANCELLED (immediate downgrade, no grace)
Razorpay cancels → CANCELLED (7-day grace) → EXPIRED
Re-subscribe → ACTIVE → role = DISTRIBUTOR again
````

**Key business rules:**
- DISTRIBUTOR role ONLY via successful payment — PATCH /admin/users/:uuid/role returns 403 if DISTRIBUTOR attempted
- Distributor code format: NSI-XXXXXX (6 random uppercase alphanumeric, unique, 5-retry collision guard)
- QR code: qrcode npm package → base64 data URL — frontend uses <img src={qrCode} /> directly
- Price set by Super Admin — not hardcoded
- On subscription lapse: HOT leads → assignedToUuid = Super Admin, distributorUuid kept for history
- Re-subscribe: existing distributorCode kept if one exists
- referralCode in signup: silently ignored if invalid, never blocks signup
- User never types referral code — extracted from URL params by frontend automatically
- Lead management: distributors use /leads endpoints, backend auto-scopes to their own leads
- Admin UTM analytics: GET /admin/analytics/utm?distributorUuid=xxx supported
- Tasks: personal, can be linked to lead (leadUuid optional)
- Calendar: auto-pulls FOLLOWUP events from LeadActivity, personal notes are upsert (one per date)
- Notifications: in-app only, unreadCount = tasksDueToday + followupsToday
- Cron job: daily 2AM, handles grace expiry + lead reassignment + role downgrade

**Distributor user management security:**
- GET /distributor/users only returns users where Lead.distributorUuid = current distributor
- GET /distributor/users/:uuid returns 404 if user not in this distributor's leads
- Never reveals whether user exists for another distributor

---

### Module 7 — Admin APIs

**File location:** `src/admin/`

**User Management Endpoints:**

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | /api/v1/admin/users | SUPER_ADMIN | List all users |
| GET | /api/v1/admin/users/:uuid | SUPER_ADMIN | User full detail |
| PATCH | /api/v1/admin/users/:uuid/suspend | SUPER_ADMIN | Suspend user |
| PATCH | /api/v1/admin/users/:uuid/reactivate | SUPER_ADMIN | Reactivate user |
| PATCH | /api/v1/admin/users/:uuid/role | SUPER_ADMIN | Change role (DISTRIBUTOR blocked) |

**Distributor Management Endpoints:**

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | /api/v1/admin/distributors | SUPER_ADMIN | List all distributors |
| GET | /api/v1/admin/distributors/:uuid | SUPER_ADMIN | Distributor detail |
| PATCH | /api/v1/admin/distributors/:uuid/deactivate-link | SUPER_ADMIN | Deactivate join link |
| PATCH | /api/v1/admin/distributors/:uuid/activate-link | SUPER_ADMIN | Activate join link |

**Analytics Endpoints (all accept ?from=&to= date range):**

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | /api/v1/admin/analytics/dashboard | SUPER_ADMIN | Platform overview |
| GET | /api/v1/admin/analytics/funnel | SUPER_ADMIN | Funnel drop-off |
| GET | /api/v1/admin/analytics/revenue | SUPER_ADMIN | Revenue analytics |
| GET | /api/v1/admin/analytics/leads | SUPER_ADMIN | Lead analytics |
| GET | /api/v1/admin/analytics/distributors | SUPER_ADMIN | Distributor analytics |
| GET | /api/v1/admin/analytics/utm | SUPER_ADMIN | UTM analytics (supports ?distributorUuid=) |

**Key Rules:**
- Cannot suspend SUPER_ADMIN account
- Cannot change role to/from SUPER_ADMIN via API
- Cannot change role to DISTRIBUTOR via API (returns 403)
- Suspend → kills ALL active sessions + sends email
- All actions logged to audit_logs

---

## 7. Key Technical Decisions

| # | Decision | Why |
|---|----------|-----|
| 1 | Razorpay amounts in paise (×100) | Razorpay mandatory requirement |
| 2 | refreshToken in HttpOnly cookie only | XSS attack prevention |
| 3 | avatarUrl from Google OAuth | Better UX, show real photo |
| 4 | Lesson locking (90% auto-complete) | Coursera standard |
| 5 | Lead transitions same for admin + distributor | Business rule: no bypass |
| 6 | displayStatus: MARK_AS_CUSTOMER → "Customer" | Frontend UX |
| 7 | availableActions[] in lead list | Frontend builds dropdown dynamically |
| 8 | Soft delete for coupons (if used) | Preserve payment history integrity |
| 9 | Cannot reactivate expired coupon | Business integrity |
| 10 | Fire-and-forget emails | Never block API response |
| 11 | Audit logs for all admin actions | Compliance + accountability |
| 12 | Mock providers (payment, phone, email) | Dev/test without real APIs |
| 13 | Smart analytics grouping | Protect DB from heavy queries |
| 14 | totalSteps in funnelProgress | Frontend shows "4 of 6 steps" |
| 15 | DISTRIBUTOR role only via payment | Prevents manual bypass — business rule |
| 16 | referralCode silently ignored if invalid | Never block signup for bad referral code |
| 17 | distributorUuid kept on leads after reassignment | Audit history — who originally referred lead |
| 18 | Calendar notes are upsert (one per date) | Prevents duplicate notes on same date |
| 19 | Notifications are in-app only | No email for task/followup reminders |
| 20 | QR code as base64 data URL | Frontend renders with img tag directly |
| 21 | GRACE enum exists but never emitted | Reserved for future — frontend must not show it |

---

## 8. API Structure

**Base URL (development):** `http://localhost:3000/api/v1`

**Auth header:**
````
Authorization: Bearer <accessToken>
````

**Standard paginated response:**
```json
{
  "items": [...],
  "total": 245,
  "page": 1,
  "limit": 20,
  "totalPages": 13
}
```

**Standard error response:**
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Cannot transition from WARM to LOST",
  "timestamp": "2026-04-03T...",
  "path": "/api/v1/leads/uuid/status"
}
```

---

## 9. Environment Variables

```env
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:3000/api/v1/auth/google/callback
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_VERIFY_SERVICE_SID=...
RESEND_API_KEY=re_...
FRONTEND_URL=http://localhost:3001
NODE_ENV=development
PAYMENT_PROVIDER=mock
PHONE_PROVIDER=mock
MAIL_PROVIDER=mock
```

---

## 10. Current Test Status

- **Total tests:** 75 passing, 0 failing
- **Test suites:** 4 files
- **Overall coverage:** ~12% (will improve after all modules built)

| Test File | Coverage Area |
|-----------|--------------|
| auth.service.spec.ts | Auth business logic |
| otp.service.spec.ts | OTP generation/validation |
| users.service.spec.ts | User CRUD |
| coupon.service.spec.ts | Coupon logic |

**No tests yet for:** funnel, payment, leads, lms, admin, distributor

---

## 11. File Structure

````
src/
├── admin/          # Module 7 — Admin APIs
├── audit/          # Audit log service
├── auth/           # Module 1 — Authentication
├── common/         # Shared filters, interceptors, constants
├── coupon/         # Module 3 — Coupons
├── distributor/    # Module 6 — Distributor System
│   ├── dto/
│   ├── distributor.controller.ts
│   ├── distributor-admin.controller.ts
│   ├── distributor-webhook.controller.ts
│   ├── distributor.service.ts
│   ├── distributor-plan.service.ts
│   ├── distributor-subscription.service.ts
│   ├── distributor-task.service.ts
│   ├── distributor-calendar.service.ts
│   ├── distributor-cron.service.ts
│   ├── distributor-code.helper.ts
│   └── distributor.module.ts
├── funnel/         # Module 2 — User funnel experience
├── funnel-cms/     # Module 2 — Admin funnel builder
├── leads/          # Module 4 — Lead System
├── lms/            # Module 5 — LMS
├── mail/           # Email service + templates + providers
├── otp/            # OTP generation/validation
├── payment/        # Module 3 — Payments + Razorpay
├── phone/          # Module 3 — Phone OTP + Twilio
├── prisma/         # Prisma service
├── tracking/       # UTM + referral tracking
├── users/          # User CRUD service
├── app.module.ts
└── main.ts

prisma/
├── migrations/
└── schema.prisma

docs/
├── NSI-MASTER-CONTEXT-v4.md
├── NSI-WORKING-GUIDE.md
├── MODULE-6-DISTRIBUTOR-FRONTEND-GUIDE.docx
├── ADMIN-FRONTEND-GUIDE.md
├── LEADS-FRONTEND-GUIDE-v2.md
├── LMS-FRONTEND-GUIDE.md
└── FUNNEL-INTEGRATION-GUIDE.md
````

---

## 12. Pending Work

### Admin APIs Frontend Documentation
Frontend documentation for Module 7 (Admin APIs) not yet generated.

### User Self-Service (NOT BUILT)
- Update own profile (name, country)
- Change password

### Post-May 1
- Improve test coverage to 70%+
- Production deployment

---

## 13. Documentation Files

| File | Content |
|------|---------|
| NSI-MASTER-CONTEXT-v4.md | This file — full project context |
| NSI-WORKING-GUIDE.md | How we work, process, error patterns |
| MODULE-6-DISTRIBUTOR-FRONTEND-GUIDE.docx | Distributor system complete guide v1.3 |
| ADMIN-FRONTEND-GUIDE.md | Admin panel API guide |
| LEADS-FRONTEND-GUIDE-v2.md | Leads guide with all fixes |
| LMS-FRONTEND-GUIDE.md | LMS API guide |
| FUNNEL-INTEGRATION-GUIDE.md | Funnel API guide |

---

## 14. Frontend Implementation Status

| Feature | Backend | Frontend |
|---------|---------|---------|
| Registration / Login | ✅ | ✅ |
| Google OAuth + Avatar | ✅ | ⚠️ Avatar not shown |
| Email OTP | ✅ | ✅ |
| Funnel video steps | ✅ | ⚠️ Broken |
| Phone verification | ✅ | ✅ |
| Payment (Razorpay) | ✅ | ✅ |
| Decision step | ✅ | ✅ |
| Lead management (admin) | ✅ | ⚠️ Partial |
| Lead management (distributor) | ✅ | ❌ Not started |
| LMS courses | ✅ | ❌ Not started |
| Admin users management | ✅ | ⚠️ Partial |
| Admin analytics | ✅ | ❌ Not started |
| Admin distributors | ✅ | ❌ Not started |
| Coupon management | ✅ | ✅ |
| Distributor subscription | ✅ | ❌ Not started |
| Distributor join link + QR | ✅ | ❌ Not started |
| Distributor dashboard | ✅ | ❌ Not started |
| Distributor user management | ✅ | ❌ Not started |
| Distributor task management | ✅ | ❌ Not started |
| Distributor calendar | ✅ | ❌ Not started |
| Distributor notifications | ✅ | ❌ Not started |
| Distributor UTM analytics | ✅ | ❌ Not started |
| Certificates | ✅ | ❌ Not started |

**Legend:** ✅ Done | ⚠️ Partial/Broken | ❌ Not started

---

*Document version: 4.0 | Generated: April 2026*
*Next update: After Admin APIs frontend documentation generated*
