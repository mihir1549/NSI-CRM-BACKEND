# NSI Platform Master Context v3

Generated from the repository snapshot in `D:\nsi-backend` on 2026-04-06.

Primary sources reviewed for this handoff:

- `package.json`
- `.env.example`
- Every file under `src/`
- Every file under `prisma/`
- Every file under `docs/`

Intended use: this document is the single long-form handoff for a brand-new AI session that has no prior chat history.

## Table of Contents

- [Read This First](#read-this-first)
- [Section 1 - Project Overview](#section-1---project-overview)
- [Section 2 - Tech Stack](#section-2---tech-stack)
- [Section 3 - Complete Database Schema](#section-3---complete-database-schema)
- [Section 4 - Completed Modules](#section-4---completed-modules)
- [Section 5 - Pending Work](#section-5---pending-work)
- [Section 6 - Key Technical Decisions](#section-6---key-technical-decisions)
- [Section 7 - API Structure](#section-7---api-structure)
- [Section 8 - Environment Variables](#section-8---environment-variables)
- [Section 9 - How We Work](#section-9---how-we-work)
- [Section 10 - File Structure](#section-10---file-structure)
- [Section 11 - Current Test Status](#section-11---current-test-status)
- [Section 12 - Documentation Files](#section-12---documentation-files)

## Read This First

This document mixes two kinds of information:

- **Requester-supplied business context**: project identity, team/process notes, intended product behavior.
- **Code-verified implementation context**: what the repository actually contains today.

When the code and the narrative do not match, the code is the source of truth for implementation work. Those mismatches are called out explicitly below because they are important for any future AI session.

### High-importance reality checks

| Topic | Requested / expected narrative | Actual code reality in this repo |
| --- | --- | --- |
| Funnel step types | `VIDEO`, `TEXT`, `PHONE_GATE`, `PAYMENT_GATE`, `DECISION` | Prisma enum is `VIDEO_TEXT`, `PHONE_GATE`, `PAYMENT_GATE`, `DECISION`. Video and text are combined into one step type. |
| Funnel video completion | 90% auto-complete | In `src/funnel/funnel.service.ts`, content-step completion checks `watchedSeconds >= videoDuration - 3`. The 90% rule exists in LMS lesson progress, not in funnel runtime flow. |
| Lead initial label | "LEAD" | Backend enum is `LeadStatus.NEW`. Frontend/docs sometimes map `NEW` to a friendlier "Lead" label. |
| Leads list actions | `availableActions` field expected in list responses | Not implemented in the current leads service responses. `displayStatus` exists; `availableActions` does not appear in `src/leads/`. |
| Phone provider env var | `PHONE_PROVIDER` | Actual code and `.env.example` use `SMS_PROVIDER`. |
| Refresh JWT secret | `JWT_REFRESH_SECRET` expected | `.env.example` does not include it. Refresh tokens are random UUIDs hashed into `auth_sessions`, not signed JWT refresh tokens. |
| Backend URL env | not listed in `.env.example` request | `src/auth/auth.controller.ts` uses `BACKEND_URL` during Google OAuth finalize redirect flow, but `.env.example` does not define it. |
| Razorpay amount handling | "store rupees, send paise" | Commitment-fee flow mostly follows that pattern, but LMS payment creation currently converts course price to paise and then the Razorpay provider multiplies by 100 again. This likely needs review. |
| Decision analytics | YES/NO decisions expected to feed analytics | Runtime writes `YES` and `NO`; `src/admin/analytics-admin.service.ts` queries lowercase `'yes'` and `'no'`, which is likely a bug. |
| Older leads docs | should reflect current backend | `docs/LEADS-FRONTEND-GUIDE.md` is stale in places. `docs/LEADS-FRONTEND-GUIDE-v2.md` is more aligned with the current code. |

---

## Section 1 - Project Overview

### 1.1 Identity

| Item | Details |
| --- | --- |
| Project name | NSI Platform |
| Public-facing domain | `growithnsi.com` |
| Repository name | `NSI-CRM-BACKEND` (requester-supplied context; not independently verified from Git remote in this pass) |
| Local workspace | `D:\nsi-backend` |
| Core platform type | CRM + LMS + MLM-oriented distributor workflow platform |
| Business owner / brand | Nageshwar Shukla / NSI Platform / Network Success Institute |
| Product purpose | Capture leads through a funnel, verify intent, collect commitment fee, convert users into buyers/distributors/customers, and provide training content through LMS |

### 1.2 Business model and product flow

The business flow described by the requester is:

1. A user lands on the funnel, often through tracked acquisition data or a distributor join link.
2. The user watches funnel content.
3. The user is asked to verify their phone number.
4. The user pays a commitment fee.
5. The user reaches a decision step and decides whether to move forward as a distributor / machine buyer prospect.
6. If the user chooses **YES**, the lead becomes hotter and moves into manual lead management.
7. If the user chooses **NO**, the lead enters a nurture sequence.
8. If the user later becomes a customer, LMS access becomes relevant.

### 1.3 Team context

The following team/process context was supplied directly in the request and is not inferable from the codebase alone:

| Area | Notes |
| --- | --- |
| Backend + planning | "Mihir" using Claude AI |
| Frontend implementation | "Mihir" listed again in the request as frontend developer |
| Planning / architecture tool | Claude.ai |
| Implementation tool | Antigravity / Claude Code |

Because both listed team members are named "Mihir" in the request, future sessions should treat that as user-provided wording rather than a code-derived fact.

### 1.4 Actual backend scope present in the repo

Implemented backend modules found in `src/`:

- Authentication
- OTP generation / verification
- Users service
- Tracking / UTM capture
- Funnel runtime
- Funnel CMS
- Funnel analytics (inside the funnel CMS area)
- Phone verification
- Coupons
- Payments
- Leads and nurture automation
- LMS
- Super-admin APIs
- Mail providers / templates
- Audit logging
- Shared NestJS infrastructure

Not yet built as a dedicated backend module:

- Distributor subscription/business module as a first-class module
- User self-service profile/password management module beyond auth-adjacent flows
- QR-code-based distributor join-link workflow
- Coupon analytics endpoints

### 1.5 Architecture summary

At a high level, this is a NestJS monolith with the following characteristics:

- Versioned REST API under `/api/v1`
- PostgreSQL via Prisma ORM
- JWT access token authentication
- Refresh-token session persistence in `auth_sessions`
- Google OAuth
- Funnel progression stored in `funnel_progress` + `step_progress`
- Lead assignment and lifecycle management stored in `leads`, `lead_activities`, and `nurture_enrollments`
- LMS course/enrollment/progress tables
- Razorpay and mock payment providers
- Twilio Verify and mock phone providers
- Resend and mock mail providers
- Puppeteer-based certificate generation
- Cron-based nurture follow-up automation

### 1.6 End-to-end user journey in code

The current code supports this main user path:

1. Visitor arrives and optionally posts acquisition data to `POST /api/v1/tracking/capture`.
2. User signs up with email/password or Google OAuth.
3. User verifies email OTP.
4. User completes country profile if needed.
5. Backend creates a `Lead` record after profile completion.
6. User enters funnel runtime and progresses through active funnel sections and steps.
7. User verifies phone number through the phone module.
8. User creates a payment order for the commitment fee and payment completion advances funnel state.
9. User records a decision at the decision step.
10. Lead becomes `HOT` on YES or `NURTURE` on NO.
11. Distributor or super-admin manages lead transitions from `HOT` onward.
12. If the user becomes a `CUSTOMER`, LMS endpoints become available.
13. LMS enrollment, lesson progress, completion, and certificate issuance happen through the LMS module.

### 1.7 Important code-derived design notes

- The app is started in `src/main.ts` with `rawBody: true`, specifically to support payment webhook signature verification.
- Global validation is strict (`whitelist`, `forbidNonWhitelisted`, `transform`).
- The app uses a custom exception filter for a standardized error shape and a logging interceptor for request timing/logging.
- CORS is permissive in non-production and selectively permissive in production, with several localhost/tunnel patterns allowed.
- The app binds to `0.0.0.0` and defaults to port `3000`.

---

## Section 2 - Tech Stack

### 2.1 Runtime dependencies from `package.json`

| Package | Version | Purpose in this repo |
| --- | --- | --- |
| `@nestjs/common` | `^11.0.1` | Core NestJS decorators, pipes, exceptions, DI primitives |
| `@nestjs/config` | `^4.0.3` | Environment configuration management |
| `@nestjs/core` | `^11.0.1` | NestJS application runtime |
| `@nestjs/jwt` | `^11.0.2` | JWT signing and verification for access tokens |
| `@nestjs/passport` | `^11.0.5` | Passport integration for Nest guards/strategies |
| `@nestjs/platform-express` | `^11.0.1` | Express HTTP platform adapter |
| `@nestjs/schedule` | `^6.1.1` | Cron jobs, used by nurture email scheduling |
| `@nestjs/throttler` | `^6.5.0` | Request throttling/rate limiting |
| `@prisma/client` | `5.21.1` | Prisma runtime client |
| `bcrypt` | `^6.0.0` | Password hashing and OTP hash comparison |
| `class-transformer` | `^0.5.1` | DTO transformation |
| `class-validator` | `^0.14.4` | DTO validation |
| `cookie-parser` | `^1.4.7` | HTTP cookie parsing, required for refresh token cookies and acquisition cookie |
| `geoip-lite` | `^1.4.10` | IP geolocation for acquisition tracking |
| `nodemailer` | `^8.0.1` | Installed but not central to the current mail provider implementation; Resend is the main real provider in code |
| `passport` | `^0.7.0` | Authentication strategy framework |
| `passport-google-oauth20` | `^2.0.0` | Google OAuth login/signup |
| `passport-jwt` | `^4.0.1` | JWT bearer token strategy |
| `prisma` | `5.21.1` | Prisma CLI and schema tooling |
| `puppeteer` | `^24.40.0` | Certificate PDF generation |
| `razorpay` | `^2.9.6` | Payment gateway integration |
| `reflect-metadata` | `^0.2.2` | Type metadata used by Nest/TypeScript decorators |
| `resend` | `^6.9.3` | Email delivery provider |
| `rxjs` | `^7.8.1` | NestJS observable support |
| `twilio` | `^5.13.1` | Twilio Verify integration for OTP over WhatsApp/SMS |
| `uuid` | `^11.1.0` | UUID generation utility |

### 2.2 Development dependencies from `package.json`

| Package | Version | Purpose |
| --- | --- | --- |
| `@eslint/eslintrc` | `^3.2.0` | ESLint config compatibility utilities |
| `@eslint/js` | `^9.18.0` | Base ESLint JS config |
| `@nestjs/cli` | `^11.0.0` | Nest CLI |
| `@nestjs/schematics` | `^11.0.0` | Nest code scaffolding |
| `@nestjs/testing` | `^11.0.1` | Nest test utilities |
| `@swc/cli` | `^0.6.0` | SWC CLI for faster transpilation/build tooling |
| `@swc/core` | `^1.10.7` | SWC compiler core |
| `@types/bcrypt` | `^6.0.0` | Type definitions |
| `@types/cookie-parser` | `^1.4.8` | Type definitions |
| `@types/express` | `^5.0.0` | Type definitions |
| `@types/geoip-lite` | `^1.4.4` | Type definitions |
| `@types/jest` | `^29.5.14` | Type definitions |
| `@types/node` | `^22.10.7` | Node typings |
| `@types/passport-google-oauth20` | `^2.0.16` | Type definitions |
| `@types/passport-jwt` | `^4.0.1` | Type definitions |
| `@types/passport-local` | `^1.0.38` | Installed typings; passport-local is not actively used in current source |
| `@types/supertest` | `^6.0.2` | Type definitions |
| `eslint` | `^9.18.0` | Linting |
| `eslint-config-prettier` | `^10.0.1` | Prettier + ESLint interoperability |
| `eslint-plugin-prettier` | `^5.2.2` | Run Prettier via ESLint |
| `globals` | `^15.14.0` | ESLint globals |
| `jest` | `^29.7.0` | Test runner |
| `prettier` | `^3.4.2` | Formatting |
| `source-map-support` | `^0.5.21` | Better stack traces |
| `supertest` | `^7.0.0` | HTTP endpoint testing |
| `ts-jest` | `^29.2.5` | TypeScript transformer for Jest |
| `ts-loader` | `^9.5.2` | TypeScript loader |
| `ts-node` | `^10.9.2` | Run TypeScript directly in Node |
| `tsconfig-paths` | `^4.2.0` | Path alias support |
| `typescript` | `^5.7.3` | TypeScript compiler |
| `typescript-eslint` | `^8.20.0` | ESLint support for TypeScript |

### 2.3 Framework and infrastructure summary

| Area | Actual implementation |
| --- | --- |
| Framework | NestJS with TypeScript |
| HTTP platform | Express via `@nestjs/platform-express` |
| Database | PostgreSQL with Prisma |
| Auth | JWT access token + refresh-token session table + Google OAuth + Passport |
| Payments | Razorpay and mock provider |
| Phone verification | Twilio Verify and mock provider |
| Email | Resend and mock provider |
| Scheduling | `@nestjs/schedule` cron jobs |
| PDF generation | Puppeteer |
| Tests | Jest + `ts-jest` |
| Build/transpile | Nest build plus SWC packages present in the repo |
| Rate limiting | `@nestjs/throttler` |

### 2.4 NPM scripts

| Script | Command | Meaning |
| --- | --- | --- |
| `build` | `nest build` | Production build |
| `format` | `prettier --write "src/**/*.ts" "test/**/*.ts"` | Format source and test files |
| `start` | `nest start` | Start app |
| `start:dev` | `nest start --watch` | Dev mode with watch |
| `start:debug` | `nest start --debug --watch` | Debug + watch |
| `start:prod` | `node dist/main` | Run compiled build |
| `lint` | `eslint "{src,apps,libs,test}/**/*.ts" --fix` | Lint and autofix |
| `test` | `jest` | Run tests |
| `test:watch` | `jest --watch` | Watch mode tests |
| `test:cov` | `jest --coverage` | Coverage run |
| `test:debug` | `node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand` | Debug Jest |
| `test:e2e` | `jest --config ./test/jest-e2e.json` | E2E test command scaffold |

### 2.5 Jest configuration embedded in `package.json`

| Key | Value |
| --- | --- |
| `moduleFileExtensions` | `["js","json","ts"]` |
| `rootDir` | `src` |
| `testRegex` | `.*\\.spec\\.ts$` |
| `transform` | `^.+\\.(t|j)s$` via `ts-jest` with `isolatedModules: true` |
| `collectCoverageFrom` | `**/*.(t|j)s` |
| `coverageDirectory` | `../coverage` |
| `testEnvironment` | `node` |

---

## Section 3 - Complete Database Schema

### 3.1 Schema-wide notes

- Source of truth: `prisma/schema.prisma`
- Migration history reviewed under `prisma/migrations/`
- Database provider: PostgreSQL
- Prisma client generator: `prisma-client-js`
- IDs are UUID strings with `@default(uuid())`
- Table names use `@@map(...)` heavily to enforce snake_case table names
- Several field names also use `@map(...)` to enforce snake_case columns
- A few scalar fields intentionally do **not** have formal foreign-key relations in Prisma:
  - `FunnelProgress.currentSectionUuid`
  - `FunnelProgress.currentStepUuid`
  - `UserAcquisition.distributorUuid`

### 3.2 Enums

| Enum | Values |
| --- | --- |
| `UserRole` | `USER`, `CUSTOMER`, `DISTRIBUTOR`, `ADMIN`, `SUPER_ADMIN` |
| `UserStatus` | `REGISTERED`, `EMAIL_VERIFIED`, `PROFILE_INCOMPLETE`, `ACTIVE`, `SUSPENDED` |
| `AuthProvider` | `EMAIL`, `GOOGLE` |
| `StepType` | `VIDEO_TEXT`, `PHONE_GATE`, `PAYMENT_GATE`, `DECISION` |
| `FunnelProgressStatus` | `IN_PROGRESS`, `COMPLETED`, `DROPPED` |
| `PaymentStatus` | `PENDING`, `SUCCESS`, `FAILED`, `REFUNDED` |
| `PaymentType` | `COMMITMENT_FEE`, `LMS_COURSE`, `DISTRIBUTOR_SUB` |
| `CouponType` | `FLAT`, `PERCENT`, `FREE` |
| `CouponScope` | `COMMITMENT_FEE`, `LMS_COURSE`, `DISTRIBUTOR_SUB`, `ALL` |
| `LeadStatus` | `NEW`, `WARM`, `HOT`, `CONTACTED`, `FOLLOWUP`, `NURTURE`, `LOST`, `MARK_AS_CUSTOMER` |
| `LeadAction` | `STATUS_CHANGE`, `NOTE`, `FOLLOWUP_SCHEDULED` |
| `NurtureStatus` | `ACTIVE`, `COMPLETED`, `UNSUBSCRIBED` |

### 3.3 Models

#### 3.3.1 `User` -> `@@map("users")`

| Field | Type | Required | Default / map / notes |
| --- | --- | --- | --- |
| `uuid` | `String` | Yes | Primary key, `@default(uuid())` |
| `fullName` | `String` | Yes | User's display name |
| `email` | `String` | Yes | `@unique` |
| `passwordHash` | `String` | No | Nullable for Google-only users |
| `googleId` | `String` | No | `@unique`, nullable |
| `avatarUrl` | `String` | No | `@map("avatar_url")` |
| `authProvider` | `AuthProvider` | Yes | `@default(EMAIL)` |
| `role` | `UserRole` | Yes | `@default(USER)` |
| `status` | `UserStatus` | Yes | `@default(REGISTERED)` |
| `emailVerified` | `Boolean` | Yes | `@default(false)` |
| `country` | `String` | No | Nullable 2-letter code in app logic |
| `createdAt` | `DateTime` | Yes | `@default(now())` |
| `updatedAt` | `DateTime` | Yes | `@updatedAt` |
| `suspendedAt` | `DateTime` | No | `@map("suspended_at")` |
| `suspendedBy` | `String` | No | `@map("suspended_by")` |
| `joinLinkActive` | `Boolean` | Yes | `@default(true) @map("join_link_active")` |
| `distributorCode` | `String` | No | `@unique @map("distributor_code")` |

Relations:

- `sessions: AuthSession[]`
- `otps: EmailOTP[]`
- `auditLogs: AuditLog[]`
- `funnelProgress: FunnelProgress?`
- `acquisition: UserAcquisition?`
- `profile: UserProfile?`
- `payments: Payment[]`
- `couponUses: CouponUse[]`
- `leadAsUser: Lead? @relation("LeadUser")`
- `leadsAssigned: Lead[] @relation("LeadAssignedTo")`
- `leadsDistributed: Lead[] @relation("LeadDistributor")`
- `leadActivities: LeadActivity[]`
- `nurtureEnrollment: NurtureEnrollment?`
- `enrollments: CourseEnrollment[]`
- `lessonProgress: LessonProgress[]`

Indexes / unique constraints:

- Primary key on `uuid`
- Unique on `email`
- Unique on `googleId`
- Unique on `distributorCode`

#### 3.3.2 `AuthSession` -> `@@map("auth_sessions")`

| Field | Type | Required | Default / map / notes |
| --- | --- | --- | --- |
| `uuid` | `String` | Yes | Primary key |
| `userUuid` | `String` | Yes | FK to `User.uuid` |
| `tokenId` | `String` | Yes | Indexed; first 16 chars of refresh token in code |
| `refreshTokenHash` | `String` | Yes | BCrypt hash of refresh token |
| `expiresAt` | `DateTime` | Yes | Session expiry |
| `ipAddress` | `String` | Yes | Request IP at session creation |
| `userAgent` | `String` | Yes | Request user agent |
| `createdAt` | `DateTime` | Yes | `@default(now())` |

Relations:

- `user: User @relation(fields: [userUuid], references: [uuid], onDelete: Cascade)`

Indexes / unique constraints:

- Index on `userUuid`
- Index on `tokenId`

#### 3.3.3 `EmailOTP` -> `@@map("email_otps")`

| Field | Type | Required | Default / map / notes |
| --- | --- | --- | --- |
| `uuid` | `String` | Yes | Primary key |
| `userUuid` | `String` | Yes | FK to `User.uuid` |
| `otpHash` | `String` | Yes | BCrypt hash of OTP |
| `attempts` | `Int` | Yes | `@default(0)` |
| `expiresAt` | `DateTime` | Yes | OTP expiry |
| `used` | `Boolean` | Yes | `@default(false)` |
| `createdAt` | `DateTime` | Yes | `@default(now())` |

Relations:

- `user: User @relation(fields: [userUuid], references: [uuid], onDelete: Cascade)`

Indexes / unique constraints:

- Index on `userUuid`

#### 3.3.4 `AuditLog` -> `@@map("audit_logs")`

| Field | Type | Required | Default / map / notes |
| --- | --- | --- | --- |
| `uuid` | `String` | Yes | Primary key |
| `actorUuid` | `String` | No | Nullable FK to `User.uuid` |
| `action` | `String` | Yes | Indexed action label |
| `metadata` | `Json` | Yes | Arbitrary metadata blob |
| `ipAddress` | `String` | Yes | Source IP |
| `createdAt` | `DateTime` | Yes | `@default(now())` |

Relations:

- `actor: User? @relation(fields: [actorUuid], references: [uuid], onDelete: SetNull)`

Indexes / unique constraints:

- Index on `actorUuid`
- Index on `action`

#### 3.3.5 `FunnelSection` -> `@@map("funnel_sections")`

| Field | Type | Required | Default / map / notes |
| --- | --- | --- | --- |
| `uuid` | `String` | Yes | Primary key |
| `name` | `String` | Yes | Section label |
| `description` | `String` | No | Nullable |
| `order` | `Int` | Yes | Manual ordering field |
| `isActive` | `Boolean` | Yes | `@default(true)` |
| `createdAt` | `DateTime` | Yes | `@default(now())` |
| `updatedAt` | `DateTime` | Yes | `@updatedAt` |

Relations:

- `steps: FunnelStep[]`

Indexes / unique constraints:

- No explicit unique/index definitions beyond PK

#### 3.3.6 `FunnelStep` -> `@@map("funnel_steps")`

| Field | Type | Required | Default / map / notes |
| --- | --- | --- | --- |
| `uuid` | `String` | Yes | Primary key |
| `sectionUuid` | `String` | Yes | FK to `FunnelSection.uuid` |
| `type` | `StepType` | Yes | `VIDEO_TEXT`, `PHONE_GATE`, `PAYMENT_GATE`, or `DECISION` |
| `order` | `Int` | Yes | Step order within section |
| `isActive` | `Boolean` | Yes | `@default(true)` |
| `createdAt` | `DateTime` | Yes | `@default(now())` |
| `updatedAt` | `DateTime` | Yes | `@updatedAt` |

Relations:

- `section: FunnelSection @relation(fields: [sectionUuid], references: [uuid], onDelete: Cascade)`
- `content: StepContent?`
- `phoneGate: PhoneGateConfig?`
- `paymentGate: PaymentGateConfig?`
- `decisionStep: DecisionStepConfig?`
- `progress: StepProgress[]`

Indexes / unique constraints:

- Index on `sectionUuid`

#### 3.3.7 `StepContent` -> `@@map("step_content")`

| Field | Type | Required | Default / map / notes |
| --- | --- | --- | --- |
| `uuid` | `String` | Yes | Primary key |
| `stepUuid` | `String` | Yes | `@unique`, FK to `FunnelStep.uuid` |
| `title` | `String` | Yes | Content title |
| `description` | `String` | No | Nullable |
| `videoUrl` | `String` | No | Nullable |
| `videoDuration` | `Int` | No | Nullable, stored in seconds |
| `thumbnailUrl` | `String` | No | Nullable |
| `textContent` | `String` | No | Nullable, stored as HTML |
| `requireVideoCompletion` | `Boolean` | Yes | `@default(true)` |
| `createdAt` | `DateTime` | Yes | `@default(now())` |
| `updatedAt` | `DateTime` | Yes | `@updatedAt` |

Relations:

- `step: FunnelStep @relation(fields: [stepUuid], references: [uuid], onDelete: Cascade)`

Indexes / unique constraints:

- Unique on `stepUuid`

#### 3.3.8 `PhoneGateConfig` -> `@@map("phone_gate_configs")`

| Field | Type | Required | Default / map / notes |
| --- | --- | --- | --- |
| `uuid` | `String` | Yes | Primary key |
| `stepUuid` | `String` | Yes | `@unique`, FK to `FunnelStep.uuid` |
| `title` | `String` | Yes | `@default("Verify your phone number")` |
| `subtitle` | `String` | No | Nullable |
| `isActive` | `Boolean` | Yes | `@default(true)` |

Relations:

- `step: FunnelStep @relation(fields: [stepUuid], references: [uuid], onDelete: Cascade)`

Indexes / unique constraints:

- Unique on `stepUuid`

#### 3.3.9 `PaymentGateConfig` -> `@@map("payment_gate_configs")`

| Field | Type | Required | Default / map / notes |
| --- | --- | --- | --- |
| `uuid` | `String` | Yes | Primary key |
| `stepUuid` | `String` | Yes | `@unique`, FK to `FunnelStep.uuid` |
| `title` | `String` | Yes | `@default("Unlock content")` |
| `subtitle` | `String` | No | Nullable |
| `amount` | `Decimal` | Yes | Commitment fee amount configured per step |
| `currency` | `String` | Yes | `@default("INR")` |
| `allowCoupons` | `Boolean` | Yes | `@default(true)` |
| `isActive` | `Boolean` | Yes | `@default(true)` |

Relations:

- `step: FunnelStep @relation(fields: [stepUuid], references: [uuid], onDelete: Cascade)`

Indexes / unique constraints:

- Unique on `stepUuid`

#### 3.3.10 `DecisionStepConfig` -> `@@map("decision_step_configs")`

| Field | Type | Required | Default / map / notes |
| --- | --- | --- | --- |
| `uuid` | `String` | Yes | Primary key |
| `stepUuid` | `String` | Yes | `@unique`, FK to `FunnelStep.uuid` |
| `question` | `String` | Yes | Default Kangen interest question |
| `yesLabel` | `String` | Yes | `@default("Yes, I am interested!")` |
| `noLabel` | `String` | Yes | `@default("Not right now")` |
| `yesSubtext` | `String` | No | Nullable |
| `noSubtext` | `String` | No | Nullable |

Relations:

- `step: FunnelStep @relation(fields: [stepUuid], references: [uuid], onDelete: Cascade)`

Indexes / unique constraints:

- Unique on `stepUuid`

#### 3.3.11 `FunnelProgress` -> `@@map("funnel_progress")`

| Field | Type | Required | Default / map / notes |
| --- | --- | --- | --- |
| `uuid` | `String` | Yes | Primary key |
| `userUuid` | `String` | Yes | `@unique`, FK to `User.uuid` |
| `currentSectionUuid` | `String` | No | Nullable scalar only; not a Prisma relation |
| `currentStepUuid` | `String` | No | Nullable scalar only; not a Prisma relation |
| `status` | `FunnelProgressStatus` | Yes | `@default(IN_PROGRESS)` |
| `phoneVerified` | `Boolean` | Yes | `@default(false)` |
| `paymentCompleted` | `Boolean` | Yes | `@default(false)` |
| `decisionAnswer` | `String` | No | Nullable, stores raw YES/NO strings in service logic |
| `decisionAnsweredAt` | `DateTime` | No | Nullable |
| `lastSeenAt` | `DateTime` | Yes | `@default(now())` |
| `createdAt` | `DateTime` | Yes | `@default(now())` |
| `updatedAt` | `DateTime` | Yes | `@updatedAt` |

Relations:

- `user: User @relation(fields: [userUuid], references: [uuid], onDelete: Cascade)`
- `stepProgress: StepProgress[]`

Indexes / unique constraints:

- Unique on `userUuid`

#### 3.3.12 `StepProgress` -> `@@map("step_progress")`

| Field | Type | Required | Default / map / notes |
| --- | --- | --- | --- |
| `uuid` | `String` | Yes | Primary key |
| `funnelProgressUuid` | `String` | Yes | FK to `FunnelProgress.uuid` |
| `stepUuid` | `String` | Yes | FK to `FunnelStep.uuid` |
| `isCompleted` | `Boolean` | Yes | `@default(false)` |
| `watchedSeconds` | `Int` | Yes | `@default(0)` |
| `completedAt` | `DateTime` | No | Nullable |
| `createdAt` | `DateTime` | Yes | `@default(now())` |

Relations:

- `funnelProgress: FunnelProgress @relation(fields: [funnelProgressUuid], references: [uuid], onDelete: Cascade)`
- `step: FunnelStep @relation(fields: [stepUuid], references: [uuid], onDelete: Cascade)`

Indexes / unique constraints:

- Unique composite on `[funnelProgressUuid, stepUuid]`
- Index on `funnelProgressUuid`

#### 3.3.13 `UserAcquisition` -> `@@map("user_acquisitions")`

| Field | Type | Required | Default / map / notes |
| --- | --- | --- | --- |
| `uuid` | `String` | Yes | Primary key |
| `userUuid` | `String` | Yes | `@unique`, FK to `User.uuid` |
| `utmSource` | `String` | No | Nullable |
| `utmMedium` | `String` | No | Nullable |
| `utmCampaign` | `String` | No | Nullable |
| `utmContent` | `String` | No | Nullable |
| `utmTerm` | `String` | No | Nullable |
| `referrerUrl` | `String` | No | Nullable |
| `landingPage` | `String` | No | Nullable |
| `distributorCode` | `String` | No | Nullable raw code |
| `distributorUuid` | `String` | No | Nullable scalar only; no Prisma relation declared |
| `ipAddress` | `String` | No | Nullable |
| `country` | `String` | No | Nullable |
| `city` | `String` | No | Nullable |
| `deviceType` | `String` | No | Nullable |
| `browser` | `String` | No | Nullable |
| `capturedAt` | `DateTime` | Yes | `@default(now())` |

Relations:

- `user: User @relation(fields: [userUuid], references: [uuid], onDelete: Cascade)`

Indexes / unique constraints:

- Unique on `userUuid`

#### 3.3.14 `UserProfile` -> `@@map("user_profiles")`

| Field | Type | Required | Default / map / notes |
| --- | --- | --- | --- |
| `uuid` | `String` | Yes | Primary key |
| `userUuid` | `String` | Yes | `@unique`, FK to `User.uuid` |
| `phone` | `String` | Yes | `@unique` |
| `phoneVerifiedAt` | `DateTime` | No | Nullable |
| `createdAt` | `DateTime` | Yes | `@default(now())` |
| `updatedAt` | `DateTime` | Yes | `@updatedAt` |

Relations:

- `user: User @relation(fields: [userUuid], references: [uuid], onDelete: Cascade)`

Indexes / unique constraints:

- Unique on `userUuid`
- Unique on `phone`

#### 3.3.15 `Payment` -> `@@map("payments")`

| Field | Type | Required | Default / map / notes |
| --- | --- | --- | --- |
| `uuid` | `String` | Yes | Primary key |
| `userUuid` | `String` | Yes | FK to `User.uuid` |
| `gatewayOrderId` | `String` | Yes | `@unique` |
| `gatewayPaymentId` | `String` | No | `@unique`, nullable until payment capture |
| `amount` | `Int` | Yes | Stored integer amount; exact unit differs by flow in current code and should be treated carefully |
| `discountAmount` | `Int` | Yes | `@default(0)` |
| `finalAmount` | `Int` | Yes | Final charged amount |
| `currency` | `String` | Yes | `@default("INR")` |
| `status` | `PaymentStatus` | Yes | `@default(PENDING)` |
| `paymentType` | `PaymentType` | Yes | Commitment fee, LMS course, or distributor subscription |
| `couponUuid` | `String` | No | Nullable FK |
| `metadata` | `Json` | No | Nullable; LMS uses it to store `courseUuid` |
| `createdAt` | `DateTime` | Yes | `@default(now())` |
| `updatedAt` | `DateTime` | Yes | `@updatedAt` |

Relations:

- `user: User @relation(fields: [userUuid], references: [uuid], onDelete: Cascade)`
- `coupon: Coupon? @relation(fields: [couponUuid], references: [uuid])`

Indexes / unique constraints:

- Unique on `gatewayOrderId`
- Unique on `gatewayPaymentId`
- Index on `userUuid`

#### 3.3.16 `Coupon` -> `@@map("coupons")`

| Field | Type | Required | Default / map / notes |
| --- | --- | --- | --- |
| `uuid` | `String` | Yes | Primary key |
| `code` | `String` | Yes | `@unique`, normalized to uppercase in service logic |
| `type` | `CouponType` | Yes | `FLAT`, `PERCENT`, or `FREE` |
| `value` | `Int` | Yes | Meaning depends on coupon type |
| `applicableTo` | `CouponScope` | Yes | Commitment fee, LMS, distributor sub, or all |
| `usageLimit` | `Int` | No | Nullable global limit |
| `usedCount` | `Int` | Yes | `@default(0)` |
| `perUserLimit` | `Int` | Yes | `@default(1)` |
| `expiresAt` | `DateTime` | No | Nullable |
| `isActive` | `Boolean` | Yes | `@default(true)` |
| `createdAt` | `DateTime` | Yes | `@default(now())` |
| `updatedAt` | `DateTime` | Yes | `@updatedAt` |

Relations:

- `uses: CouponUse[]`
- `payments: Payment[]`

Indexes / unique constraints:

- Unique on `code`

#### 3.3.17 `CouponUse` -> `@@map("coupon_uses")`

| Field | Type | Required | Default / map / notes |
| --- | --- | --- | --- |
| `uuid` | `String` | Yes | Primary key |
| `couponUuid` | `String` | Yes | FK to `Coupon.uuid` |
| `userUuid` | `String` | Yes | FK to `User.uuid` |
| `createdAt` | `DateTime` | Yes | `@default(now())` |

Relations:

- `coupon: Coupon @relation(fields: [couponUuid], references: [uuid], onDelete: Cascade)`
- `user: User @relation(fields: [userUuid], references: [uuid], onDelete: Cascade)`

Indexes / unique constraints:

- Unique composite on `[couponUuid, userUuid]`

#### 3.3.18 `Lead` -> `@@map("leads")`

| Field | Type | Required | Default / map / notes |
| --- | --- | --- | --- |
| `uuid` | `String` | Yes | Primary key |
| `userUuid` | `String` | Yes | `@unique`, FK to `User.uuid` |
| `assignedToUuid` | `String` | Yes | FK to `User.uuid` for owner/admin/distributor responsible |
| `distributorUuid` | `String` | No | Nullable FK to referring distributor |
| `status` | `LeadStatus` | Yes | `@default(NEW)` |
| `phone` | `String` | No | Nullable |
| `createdAt` | `DateTime` | Yes | `@default(now())` |
| `updatedAt` | `DateTime` | Yes | `@updatedAt` |

Relations:

- `user: User @relation("LeadUser", fields: [userUuid], references: [uuid])`
- `assignedTo: User @relation("LeadAssignedTo", fields: [assignedToUuid], references: [uuid])`
- `distributor: User? @relation("LeadDistributor", fields: [distributorUuid], references: [uuid])`
- `activities: LeadActivity[]`
- `nurtureEnrollment: NurtureEnrollment?`

Indexes / unique constraints:

- Unique on `userUuid`
- Index on `assignedToUuid`
- Index on `distributorUuid`
- Index on `status`

#### 3.3.19 `LeadActivity` -> `@@map("lead_activities")`

| Field | Type | Required | Default / map / notes |
| --- | --- | --- | --- |
| `uuid` | `String` | Yes | Primary key |
| `leadUuid` | `String` | Yes | FK to `Lead.uuid` |
| `actorUuid` | `String` | Yes | FK to `User.uuid` |
| `fromStatus` | `LeadStatus` | No | Nullable |
| `toStatus` | `LeadStatus` | No | Nullable |
| `action` | `LeadAction` | Yes | `STATUS_CHANGE`, `NOTE`, or `FOLLOWUP_SCHEDULED` |
| `notes` | `String` | No | Nullable |
| `followupAt` | `DateTime` | No | Nullable |
| `createdAt` | `DateTime` | Yes | `@default(now())` |

Relations:

- `lead: Lead @relation(fields: [leadUuid], references: [uuid], onDelete: Cascade)`
- `actor: User @relation(fields: [actorUuid], references: [uuid])`

Indexes / unique constraints:

- Index on `leadUuid`
- Index on `actorUuid`

#### 3.3.20 `NurtureEnrollment` -> `@@map("nurture_enrollments")`

| Field | Type | Required | Default / map / notes |
| --- | --- | --- | --- |
| `uuid` | `String` | Yes | Primary key |
| `userUuid` | `String` | Yes | `@unique`, FK to `User.uuid` |
| `leadUuid` | `String` | Yes | `@unique`, FK to `Lead.uuid` |
| `status` | `NurtureStatus` | Yes | `@default(ACTIVE)` |
| `day1SentAt` | `DateTime` | No | Nullable |
| `day3SentAt` | `DateTime` | No | Nullable |
| `day7SentAt` | `DateTime` | No | Nullable |
| `nextEmailAt` | `DateTime` | No | Nullable |
| `createdAt` | `DateTime` | Yes | `@default(now())` |
| `updatedAt` | `DateTime` | Yes | `@updatedAt` |

Relations:

- `user: User @relation(fields: [userUuid], references: [uuid])`
- `lead: Lead @relation(fields: [leadUuid], references: [uuid])`

Indexes / unique constraints:

- Unique on `userUuid`
- Unique on `leadUuid`

#### 3.3.21 `Course` -> `@@map("courses")`

| Field | Type | Required | Default / map / notes |
| --- | --- | --- | --- |
| `uuid` | `String` | Yes | Primary key |
| `title` | `String` | Yes | Course title |
| `description` | `String` | Yes | Long description |
| `thumbnailUrl` | `String` | No | `@map("thumbnail_url")` |
| `isFree` | `Boolean` | Yes | `@default(false) @map("is_free")` |
| `price` | `Float` | Yes | `@default(0)` |
| `isPublished` | `Boolean` | Yes | `@default(false) @map("is_published")` |
| `createdAt` | `DateTime` | Yes | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | Yes | `@updatedAt @map("updated_at")` |

Relations:

- `sections: CourseSection[]`
- `enrollments: CourseEnrollment[]`

Indexes / unique constraints:

- No explicit unique/index definitions beyond PK

#### 3.3.22 `CourseSection` -> `@@map("course_sections")`

| Field | Type | Required | Default / map / notes |
| --- | --- | --- | --- |
| `uuid` | `String` | Yes | Primary key |
| `courseUuid` | `String` | Yes | `@map("course_uuid")`, FK to `Course.uuid` |
| `title` | `String` | Yes | Section title |
| `order` | `Int` | Yes | Manual order |
| `createdAt` | `DateTime` | Yes | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | Yes | `@updatedAt @map("updated_at")` |

Relations:

- `course: Course @relation(fields: [courseUuid], references: [uuid], onDelete: Cascade)`
- `lessons: CourseLesson[]`

Indexes / unique constraints:

- No explicit unique/index definitions beyond PK

#### 3.3.23 `CourseLesson` -> `@@map("course_lessons")`

| Field | Type | Required | Default / map / notes |
| --- | --- | --- | --- |
| `uuid` | `String` | Yes | Primary key |
| `sectionUuid` | `String` | Yes | `@map("section_uuid")`, FK to `CourseSection.uuid` |
| `title` | `String` | Yes | Lesson title |
| `description` | `String` | No | Nullable |
| `videoUrl` | `String` | No | `@map("video_url")` |
| `videoDuration` | `Int` | No | `@map("video_duration")`, seconds |
| `textContent` | `String` | No | `@map("text_content")`, rich text |
| `pdfUrl` | `String` | No | `@map("pdf_url")` |
| `order` | `Int` | Yes | Manual order |
| `isPublished` | `Boolean` | Yes | `@default(false) @map("is_published")` |
| `createdAt` | `DateTime` | Yes | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | Yes | `@updatedAt @map("updated_at")` |

Relations:

- `section: CourseSection @relation(fields: [sectionUuid], references: [uuid], onDelete: Cascade)`
- `progress: LessonProgress[]`

Indexes / unique constraints:

- No explicit unique/index definitions beyond PK

#### 3.3.24 `CourseEnrollment` -> `@@map("course_enrollments")`

| Field | Type | Required | Default / map / notes |
| --- | --- | --- | --- |
| `uuid` | `String` | Yes | Primary key |
| `userUuid` | `String` | Yes | `@map("user_uuid")`, FK to `User.uuid` |
| `courseUuid` | `String` | Yes | `@map("course_uuid")`, FK to `Course.uuid` |
| `enrolledAt` | `DateTime` | Yes | `@default(now()) @map("enrolled_at")` |
| `completedAt` | `DateTime` | No | `@map("completed_at")` |
| `certificateUrl` | `String` | No | `@map("certificate_url")` |
| `isActive` | `Boolean` | Yes | `@default(true) @map("is_active")` |

Relations:

- `user: User @relation(fields: [userUuid], references: [uuid], onDelete: Cascade)`
- `course: Course @relation(fields: [courseUuid], references: [uuid], onDelete: Cascade)`

Indexes / unique constraints:

- Unique composite on `[userUuid, courseUuid]`

#### 3.3.25 `LessonProgress` -> `@@map("lesson_progress")`

| Field | Type | Required | Default / map / notes |
| --- | --- | --- | --- |
| `uuid` | `String` | Yes | Primary key |
| `userUuid` | `String` | Yes | `@map("user_uuid")`, FK to `User.uuid` |
| `lessonUuid` | `String` | Yes | `@map("lesson_uuid")`, FK to `CourseLesson.uuid` |
| `isCompleted` | `Boolean` | Yes | `@default(false) @map("is_completed")` |
| `watchedSeconds` | `Int` | Yes | `@default(0) @map("watched_seconds")` |
| `completedAt` | `DateTime` | No | `@map("completed_at")` |
| `createdAt` | `DateTime` | Yes | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | Yes | `@updatedAt @map("updated_at")` |

Relations:

- `user: User @relation(fields: [userUuid], references: [uuid], onDelete: Cascade)`
- `lesson: CourseLesson @relation(fields: [lessonUuid], references: [uuid], onDelete: Cascade)`

Indexes / unique constraints:

- Unique composite on `[userUuid, lessonUuid]`

### 3.4 Migration history summary

| Migration folder | Main effect |
| --- | --- |
| `20260227060658_init` | Initial auth/user tables and enums; includes `SUSPENDED` in `UserStatus` and core auth tables |
| `20260227061512_add_otp_attempts` | Adds `attempts` to `email_otps` |
| `20260303072905_add_google_oauth` | Adds Google OAuth fields and `AuthProvider` enum |
| `20260323052714_funnel_engine` | Adds funnel engine tables and tracking/acquisition tables |
| `20260330101046_add_lead_system` | Adds payments, coupons, leads, nurture, user profiles, and `SUPER_ADMIN` role |
| `20260401113938_add_lms_module` | Adds course/LMS tables |
| `20260403095932_add_user_avatar_url` | Adds `avatar_url`, `distributor_code`, `join_link_active`, `suspended_at`, `suspended_by` |

---

## Section 4 - Completed Modules

### Module 1 - Authentication

#### 4.1.1 Auth module summary

Source files:

- `src/auth/auth.module.ts`
- `src/auth/auth.controller.ts`
- `src/auth/auth.service.ts`
- `src/auth/decorators/*`
- `src/auth/dto/*`
- `src/auth/guards/*`
- `src/auth/strategies/*`

Authentication stack in code:

- Email/password signup and login
- OTP-based email verification
- Password reset with OTP
- Google OAuth
- JWT access token in response body
- Refresh token as opaque random value in HttpOnly cookie
- Session persistence in `auth_sessions`
- `/auth/me` endpoint
- Support for passwordless Google-created accounts later setting a password
- Support for user suspension and session invalidation

#### 4.1.2 Auth endpoints

| Method | Full URL | Guards | Request body / input | Response shape | Notes |
| --- | --- | --- | --- | --- | --- |
| `POST` | `http://localhost:3000/api/v1/auth/signup` | Throttled (`limit 5 / 15m`) | `{ fullName, email, password }` | Success message only | Creates user with `role=USER`, `status=REGISTERED`, hashes password, stores OTP, sends OTP email |
| `POST` | `http://localhost:3000/api/v1/auth/verify-email-otp` | Throttled (`limit 10 / 15m`) | `{ email, otp }` | `{ accessToken, user, needsCountry }` + sets refresh cookie | Marks email verified, attaches tracking cookie to user if present, creates auth session |
| `POST` | `http://localhost:3000/api/v1/auth/complete-profile` | `JwtAuthGuard` | `{ country }` | Updated user-like success payload | Validates ISO-like 2-letter country code, sets status to `ACTIVE`, creates lead asynchronously |
| `POST` | `http://localhost:3000/api/v1/auth/login` | Throttled (`limit 10 / 15m`) | `{ email, password }` | `{ accessToken, user }` + sets refresh cookie | Rejects suspended users, rejects pre-verification users, handles Google-only accounts gracefully |
| `POST` | `http://localhost:3000/api/v1/auth/resend-otp` | Throttled (`limit 3 / hour`) | `{ email }` | Generic success message | Anti-enumeration behavior for unknown / already-verified accounts |
| `POST` | `http://localhost:3000/api/v1/auth/refresh` | None | Refresh cookie `refresh_token` | `{ accessToken, user }` + rotated refresh cookie | Refresh token is looked up through hashed session storage, not by verifying a JWT refresh token |
| `GET` | `http://localhost:3000/api/v1/auth/me` | `JwtAuthGuard` | Bearer token | `{ uuid, fullName, email, role, status, avatarUrl }` | Current user summary endpoint |
| `POST` | `http://localhost:3000/api/v1/auth/logout` | Optional bearer token for audit enrichment | Refresh cookie if present | `{ message }` | Deletes matching session if refresh token is valid and clears cookie |
| `POST` | `http://localhost:3000/api/v1/auth/forgot-password` | Throttled (`limit 3 / hour`) | `{ email }` | Generic success message | Sends password reset OTP if account is eligible |
| `POST` | `http://localhost:3000/api/v1/auth/reset-password` | Throttled (`limit 5 / 15m`) | `{ email, otp, newPassword }` | `{ message }` | Verifies OTP, updates password, deletes all sessions |
| `GET` | `http://localhost:3000/api/v1/auth/google` | `AuthGuard("google")` | Browser redirect entrypoint | OAuth redirect | Starts Google OAuth |
| `GET` | `http://localhost:3000/api/v1/auth/google/callback` | `AuthGuard("google")` | Google callback query | HTTP redirect | Generates short-lived OAuth finalize code and redirects to backend finalize endpoint |
| `GET` | `http://localhost:3000/api/v1/auth/finalize-google?code=...` | None | OAuth code query param | HTTP redirect to frontend callback URL | Sets refresh cookie on backend domain, forwards access token and onboarding info to frontend |
| `POST` | `http://localhost:3000/api/v1/auth/set-password` | `JwtAuthGuard` | `{ newPassword }` | `{ message }` | For Google-created accounts with no password hash |

#### 4.1.3 DTO shapes

| DTO | Fields |
| --- | --- |
| `SignupDto` | `fullName: string`, `email: email`, `password: string(min 8)` |
| `VerifyOtpDto` | `email: email`, `otp: 6-digit numeric string` |
| `CompleteProfileDto` | `country: string(length 2)` |
| `LoginDto` | `email: email`, `password: string` |
| `ResendOtpDto` | `email: email` |
| `ForgotPasswordDto` | `email: email` |
| `ResetPasswordDto` | `email: email`, `otp: 6-digit numeric string`, `newPassword: string(min 8)` |
| `SetPasswordDto` | `newPassword: string(min 8)` |

#### 4.1.4 Standard auth response payloads

Typical successful auth response body:

```json
{
  "accessToken": "jwt-access-token",
  "user": {
    "uuid": "user-uuid",
    "fullName": "User Name",
    "email": "user@example.com",
    "role": "USER",
    "status": "ACTIVE",
    "avatarUrl": "https://..."
  },
  "needsCountry": false
}
```

Key notes:

- `refreshToken` is **not** returned in JSON.
- Refresh token is stored only in an HttpOnly cookie named `refresh_token`.
- `avatarUrl` is returned when available.
- `status` is returned in auth responses.

#### 4.1.5 Guards, decorators, and strategies

| Item | Purpose |
| --- | --- |
| `JwtAuthGuard` | Wraps Passport JWT strategy |
| `OnboardingGuard` | Re-fetches user, blocks `PROFILE_INCOMPLETE` users from most protected routes except profile completion, blocks suspended users |
| `RolesGuard` | Re-fetches user and enforces `@Roles(...)` metadata |
| `CurrentUser` decorator | Pulls current JWT user payload from request |
| `Roles` decorator | Adds required role metadata |
| `JwtStrategy` | Reads bearer JWT using `JWT_SECRET` |
| `GoogleStrategy` | Handles Google OAuth profile mapping and avatar extraction |

#### 4.1.6 Auth business rules

- Signup lowercases email before checking uniqueness.
- Passwords and OTPs are hashed with bcrypt.
- New users start as `REGISTERED`.
- Email verification changes status to `EMAIL_VERIFIED`, then profile completion usually moves to `ACTIVE`.
- If the user still needs country after verification, auth returns `needsCountry: true`.
- `completeProfile` asynchronously triggers lead creation via `LeadsService.createLeadForUser`.
- Suspended users cannot log in or refresh sessions.
- Refresh flow rotates sessions: old session deleted, new session created.
- Google login merges into an existing email account when emails match.
- Google profile photo becomes `avatarUrl`.
- Users created through Google with no password can later call `set-password`.
- Password reset deletes all active sessions.

#### 4.1.7 Refresh-cookie behavior

Cookie settings are determined in `auth.controller.ts`:

- Name: `refresh_token`
- `httpOnly: true`
- `path: /`
- `maxAge: 7 days`
- `secure: true` in production or on HTTPS
- `sameSite: "none"` on HTTPS; otherwise `"lax"`

#### 4.1.8 Auth audit events and side effects

Important audit log actions emitted:

- `USER_SIGNUP`
- `EMAIL_VERIFIED`
- `PROFILE_COMPLETED`
- `USER_LOGIN`
- `OTP_RESENT`
- `PASSWORD_SET_FOR_GOOGLE_USER`
- `PASSWORD_RESET_REQUESTED`
- `PASSWORD_RESET_COMPLETED`
- `GOOGLE_LOGIN_RETURNING`
- `GOOGLE_LOGIN_MERGE`
- `GOOGLE_LOGIN_NEW`
- `USER_LOGOUT`

Important side effects:

- OTP emails are fire-and-forget.
- Welcome email is fire-and-forget.
- Tracking cookie can be attached to user during verification.
- Lead creation is fire-and-forget after profile completion.

#### 4.1.9 Auth code realities to remember

- There is no signed JWT refresh token implementation despite the user-requested env var name `JWT_REFRESH_SECRET`; refresh is session-table based.
- `BACKEND_URL` is used during Google finalize flow but is absent from `.env.example`.
- `AuthService.getMe()` returns a compact user object and powers `/auth/me`.

### Module 2 - Funnel Engine

#### 4.2.1 Funnel runtime summary

Source files:

- `src/funnel/funnel.controller.ts`
- `src/funnel/funnel.service.ts`
- `src/funnel/dto/*`
- `src/funnel-cms/funnel-cms.controller.ts`
- `src/funnel-cms/funnel-cms.service.ts`
- `src/funnel-cms/analytics.controller.ts`
- `src/funnel-cms/funnel-validation.service.ts`
- `src/funnel-cms/dto/*`
- `src/tracking/*` (for UTM capture and distributor-code attribution)

The funnel system has three related surfaces:

- Public acquisition tracking (`tracking`)
- Authenticated end-user funnel runtime (`funnel`)
- Super-admin funnel CMS and funnel analytics (`admin/funnel`, `admin/analytics`)

#### 4.2.2 Funnel step types in actual code

Actual Prisma enum values:

- `VIDEO_TEXT`
- `PHONE_GATE`
- `PAYMENT_GATE`
- `DECISION`

Important: the narrative concept of separate `VIDEO` and `TEXT` steps is not how the schema is modeled. `StepContent` can carry both video and text for a single `VIDEO_TEXT` step.

#### 4.2.3 Funnel runtime endpoints

All runtime funnel endpoints are guarded by `JwtAuthGuard` and `OnboardingGuard`.

| Method | Full URL | Request body / input | Response shape | Purpose |
| --- | --- | --- | --- | --- |
| `GET` | `http://localhost:3000/api/v1/funnel/structure` | None | `{ sections: [...] }` style structure | Returns active sections and active steps, ordered by `order` |
| `GET` | `http://localhost:3000/api/v1/funnel/progress` | None | `{ currentSectionUuid, currentStepUuid, status, phoneVerified, paymentCompleted, decisionAnswer, completedStepUuids }` | Returns or creates funnel progress |
| `GET` | `http://localhost:3000/api/v1/funnel/step/:stepUuid` | Step UUID path param | Step payload by type | Returns current step or already-completed step content |
| `POST` | `http://localhost:3000/api/v1/funnel/step/:stepUuid/complete` | `{ watchedSeconds? }` | Success object / next-state effect | Completes current content/phone/payment/decision step if rules are satisfied |
| `POST` | `http://localhost:3000/api/v1/funnel/step/:stepUuid/video-progress` | `{ watchedSeconds }` | `{ ok: true }` | Saves max watched seconds for that step |
| `POST` | `http://localhost:3000/api/v1/funnel/decision` | `{ answer: "YES" | "NO", stepUuid }` | Success object with updated funnel state | Records yes/no answer and triggers lead status side effects |

#### 4.2.4 Funnel runtime response details

`GET /funnel/step/:stepUuid` returns different shapes by step type:

| Step type | Response core |
| --- | --- |
| `VIDEO_TEXT` | `{ type, content }` |
| `PHONE_GATE` | `{ type, phoneGate }` |
| `PAYMENT_GATE` | `{ type, paymentGate }` with `amount` stringified |
| `DECISION` | `{ type, decisionStep }` |

`GET /funnel/progress` returns:

```json
{
  "currentSectionUuid": "section-uuid",
  "currentStepUuid": "step-uuid",
  "status": "IN_PROGRESS",
  "phoneVerified": false,
  "paymentCompleted": false,
  "decisionAnswer": null,
  "completedStepUuids": ["step-a", "step-b"]
}
```

#### 4.2.5 Funnel runtime business rules

- Progress is lazily created on first access through `getOrCreateProgress`.
- Only active sections and active steps are returned.
- A user may open the current step or any already-completed step.
- The service silently succeeds if a step is already completed and the user tries to complete it again.
- Completion is strictly sequential based on current step and step order.
- Completing a `PHONE_GATE` step sets `phoneVerified=true`.
- Completing a payment step sets `paymentCompleted=true`.
- If no next step exists, funnel status becomes `COMPLETED`.
- Decision step can only be answered once.
- YES decision triggers `LeadsService.onDecisionYes`.
- NO decision triggers `LeadsService.onDecisionNo`.

#### 4.2.6 Funnel video progress rule reality

What the request expects:

- "Video progress tracking (90% auto-complete)"

What the code actually does:

- `POST /funnel/step/:stepUuid/video-progress` only stores watched seconds.
- Auto-complete is **not** triggered there.
- In `completeStep`, if `StepContent.requireVideoCompletion === true`, completion is allowed when `watchedSeconds >= videoDuration - 3`.
- The 90% auto-complete rule exists in LMS lesson progress, not here.

#### 4.2.7 Decision handling and lead side effects

| Decision | Funnel effect | Lead effect |
| --- | --- | --- |
| `YES` | Saves `decisionAnswer`, completes step | `LeadsService.onDecisionYes()` sets lead to `HOT` |
| `NO` | Saves `decisionAnswer`, completes step | `LeadsService.onDecisionNo()` sets lead to `NURTURE` and schedules nurture sequence |

#### 4.2.8 Funnel CMS endpoints

All CMS endpoints are guarded by `JwtAuthGuard`, `RolesGuard`, and `@Roles("SUPER_ADMIN")`.

| Method | Full URL | Request body / input | Response shape | Purpose |
| --- | --- | --- | --- | --- |
| `POST` | `http://localhost:3000/api/v1/admin/funnel/sections` | `CreateSectionDto` | Created section | Create funnel section |
| `GET` | `http://localhost:3000/api/v1/admin/funnel/sections` | None | Section list | List all sections |
| `PATCH` | `http://localhost:3000/api/v1/admin/funnel/sections/reorder` | `ReorderSectionsDto` | Updated sections | Reorder sections |
| `PATCH` | `http://localhost:3000/api/v1/admin/funnel/sections/:uuid` | `UpdateSectionDto` | Updated section | Update section |
| `DELETE` | `http://localhost:3000/api/v1/admin/funnel/sections/:uuid` | Path UUID | `{ message }` | Delete section unless users are currently on it |
| `POST` | `http://localhost:3000/api/v1/admin/funnel/steps` | `CreateStepDto` | Created step + default config | Create step in section |
| `GET` | `http://localhost:3000/api/v1/admin/funnel/steps/:uuid` | Path UUID | Step + nested config | Get one step |
| `PATCH` | `http://localhost:3000/api/v1/admin/funnel/steps/reorder` | `ReorderStepsDto` | Updated steps | Reorder steps |
| `PATCH` | `http://localhost:3000/api/v1/admin/funnel/steps/:uuid` | `UpdateStepDto` | Updated step | Update core step metadata |
| `DELETE` | `http://localhost:3000/api/v1/admin/funnel/steps/:uuid` | Path UUID | `{ message }` | Delete step unless users are currently on it |
| `PUT` | `http://localhost:3000/api/v1/admin/funnel/steps/:uuid/content` | `UpdateStepContentDto` | Upserted content | Configure `VIDEO_TEXT` step content |
| `PUT` | `http://localhost:3000/api/v1/admin/funnel/steps/:uuid/phone-gate` | `UpdatePhoneGateDto` | Upserted config | Configure phone step |
| `PUT` | `http://localhost:3000/api/v1/admin/funnel/steps/:uuid/payment-gate` | `UpdatePaymentGateDto` | Upserted config | Configure payment step |
| `PUT` | `http://localhost:3000/api/v1/admin/funnel/steps/:uuid/decision` | `UpdateDecisionStepDto` | Upserted config | Configure decision step |
| `GET` | `http://localhost:3000/api/v1/admin/funnel/validate` | None | Warnings array | Structural validation warnings |

#### 4.2.9 Funnel CMS DTO shapes

| DTO | Key fields |
| --- | --- |
| `CreateSectionDto` | `name`, `description?`, `order`, `isActive?` |
| `UpdateSectionDto` | Same fields optional |
| `ReorderSectionsDto` | `orderedUuids: string[]` |
| `CreateStepDto` | `sectionUuid`, `type`, `order`, `isActive?` |
| `UpdateStepDto` | `sectionUuid?`, `order?`, `isActive?` |
| `ReorderStepsDto` | `sectionUuid`, `orderedUuids: string[]` |
| `UpdateStepContentDto` | `title`, `description?`, `videoUrl?`, `videoDuration?`, `thumbnailUrl?`, `textContent?`, `requireVideoCompletion?` |
| `UpdatePhoneGateDto` | `title?`, `subtitle?`, `isActive?` |
| `UpdatePaymentGateDto` | `title?`, `subtitle?`, `amount`, `currency?`, `allowCoupons?`, `isActive?` |
| `UpdateDecisionStepDto` | `question?`, `yesLabel?`, `noLabel?`, `yesSubtext?`, `noSubtext?` |

#### 4.2.10 Funnel validation warnings

The CMS validation service flags warnings, not hard errors:

- `PAYMENT_BEFORE_PHONE`
- `MULTIPLE_PAYMENT_GATES`
- `MULTIPLE_PHONE_GATES`
- `NO_DECISION_STEP`
- `DECISION_NOT_LAST`
- `EMPTY_SECTION`

#### 4.2.11 Funnel analytics endpoints

These endpoints live in `src/funnel-cms/analytics.controller.ts`, also guarded for `SUPER_ADMIN`.

| Method | Full URL | Response purpose |
| --- | --- | --- |
| `GET` | `http://localhost:3000/api/v1/admin/analytics/funnel` | Step-by-step funnel progression and drop-off |
| `GET` | `http://localhost:3000/api/v1/admin/analytics/utm` | UTM source/medium/campaign/distributor attribution |
| `GET` | `http://localhost:3000/api/v1/admin/analytics/devices` | Device and country breakdown |
| `GET` | `http://localhost:3000/api/v1/admin/analytics/conversions` | Registered/phone/payment/decision conversion metrics |

Important route note:

- These routes share the `/api/v1/admin/analytics/*` path prefix with the broader admin analytics module, so future sessions should inspect routing carefully if collisions appear.

#### 4.2.12 UTM tracking integration

Tracking is implemented in `src/tracking/`.

Public tracking endpoint:

| Method | Full URL | Guards | Request body | Response purpose |
| --- | --- | --- | --- | --- |
| `POST` | `http://localhost:3000/api/v1/tracking/capture` | `ThrottlerGuard` | `CaptureUtmDto` | Stores acquisition data in cookie and, if authenticated, upserts acquisition row immediately |

`CaptureUtmDto` fields:

- `utmSource?`
- `utmMedium?`
- `utmCampaign?`
- `utmContent?`
- `utmTerm?`
- `referrerUrl?`
- `landingPage?`
- `distributorCode?`
- `deviceType?`
- `browser?`

Tracking business rules:

- Acquisition data is stored in an HttpOnly cookie `nsi_acquisition` for 24 hours.
- Geo-IP enrichment adds country/city where possible.
- If a valid active distributor code is present, acquisition is attributed to that distributor.
- If the distributor join link is deactivated, new registrations from that code become effectively direct, not distributor-attributed.
- On auth verification, `attachToUser()` moves cookie-stored acquisition data into `user_acquisitions`.

### Module 3 - Phone + Payment + Coupon

#### 4.3.1 Phone verification endpoints

All phone endpoints are guarded by `JwtAuthGuard` and `OnboardingGuard`.

| Method | Full URL | Request body | Response shape | Purpose |
| --- | --- | --- | --- | --- |
| `POST` | `http://localhost:3000/api/v1/phone/send-otp` | `{ phone, channel }` where `channel` is `whatsapp` or `sms` | `{ message, channel }` | Send verification OTP |
| `POST` | `http://localhost:3000/api/v1/phone/verify-otp` | `{ phone, code, channel }` | `{ message, progress }` | Verify OTP, store phone, advance funnel phone gate |

Phone DTOs:

| DTO | Fields |
| --- | --- |
| `SendPhoneOtpDto` | `phone: string`, `channel?: "whatsapp" \| "sms"` |
| `VerifyPhoneOtpDto` | `phone: string`, `code: string`, `channel: "whatsapp" \| "sms"` |

Phone business rules:

- Phone numbers are normalized into E.164-like format in service logic.
- Indian shorthand handling exists:
  - `0XXXXXXXXXX` -> `+91XXXXXXXXXX`
  - `91XXXXXXXXXX` -> `+91XXXXXXXXXX`
- Send limit: max 3 sends per hour per user, tracked via special rows in `email_otps` using `otpHash = "PHONE_VERIFICATION"`.
- Verify wrong-attempt limit: max 3 per hour per normalized phone, tracked in memory.
- Same phone number cannot belong to two users.
- Already phone-verified funnel progress cannot request verification again.
- Successful phone verification upserts `user_profiles`, sets `phoneVerifiedAt`, advances funnel progress, audits the event, and triggers `LeadsService.onPhoneVerified()`.

Providers:

| Provider | Source file | Notes |
| --- | --- | --- |
| Mock | `src/phone/providers/mock-phone.provider.ts` | Fixed OTP `123456` |
| Twilio | `src/phone/providers/twilio-phone.provider.ts` | Uses Twilio Verify |

Important env reality:

- The provider factory reads `SMS_PROVIDER`, not `PHONE_PROVIDER`.

#### 4.3.2 Payment endpoints

All payment endpoints below use `JwtAuthGuard` and `OnboardingGuard`, except webhook.

| Method | Full URL | Request body / input | Response shape | Purpose |
| --- | --- | --- | --- | --- |
| `POST` | `http://localhost:3000/api/v1/payments/create-order` | `{ couponCode? }` | Payment order payload or `{ freeAccess: true }` result | Create commitment-fee payment order |
| `GET` | `http://localhost:3000/api/v1/payments/status` | None | `{ paymentCompleted, payment }` | Return current payment completion state |
| `POST` | `http://localhost:3000/api/v1/payments/webhook` | Raw webhook body + signature header | Always HTTP 200 | Process Razorpay/mock webhook events |

Payment DTOs:

| DTO | Fields |
| --- | --- |
| `CreateOrderDto` | `couponCode?: string` |
| `PaymentResponseDto` | `uuid`, `gatewayOrderId`, `amount`, `discountAmount`, `finalAmount`, `currency`, `status`, `paymentType`, `createdAt` |

Payment business rules:

- Commitment-fee payment can be created only after phone verification.
- If `funnelProgress.paymentCompleted` is already true, order creation is blocked.
- Current funnel step must be a `PAYMENT_GATE`.
- If coupons are allowed on the current payment gate and `couponCode` is provided, coupon validation happens inside the DB transaction.
- If coupon discount reduces final amount to zero, a synthetic successful payment is created and funnel progresses immediately without gateway payment.
- Mock mode auto-confirms payment after 2 seconds.
- Webhook handler is idempotent on `gatewayPaymentId`.
- Failed webhook events mark pending payments as `FAILED`.

Important payment code realities:

- `RazorpayPaymentProvider.createOrder()` multiplies amount by 100 before sending to Razorpay.
- Commitment-fee flow uses `paymentGate.amount` directly as the base integer amount.
- LMS flow converts course price to paise first and then still passes it into the same provider, so there is a likely double-multiplication bug for LMS orders.
- Webhook fraud check compares `webhookAmount` directly against `paymentRecord.finalAmount`; if webhook values are in paise but DB values are not, the check can reject legitimate payments.
- Mock auto-processing is triggered when `PAYMENT_PROVIDER === "mock"` **or** when `SMS_PROVIDER === "mock"`, which looks like an accidental condition coupling.

Providers:

| Provider | Source file | Notes |
| --- | --- | --- |
| Mock | `src/payment/providers/mock-payment.provider.ts` | Creates fake order IDs and always verifies webhook signatures as true |
| Razorpay | `src/payment/providers/razorpay-payment.provider.ts` | Creates real Razorpay orders and validates signatures with HMAC |

#### 4.3.3 Coupon endpoints

Admin coupon routes require `JwtAuthGuard`, `RolesGuard`, and `@Roles("SUPER_ADMIN")`.

| Method | Full URL | Guards | Request body / input | Response shape | Purpose |
| --- | --- | --- | --- | --- | --- |
| `POST` | `http://localhost:3000/api/v1/admin/coupons` | Super-admin | `CreateCouponDto` | Created coupon with computed status | Create coupon |
| `GET` | `http://localhost:3000/api/v1/admin/coupons?status=active|inactive|expired|all` | Super-admin | Query param | Coupon list | List coupons with smart status filtering |
| `GET` | `http://localhost:3000/api/v1/admin/coupons/:uuid` | Super-admin | Path UUID | Coupon detail + use history | Coupon detail |
| `PATCH` | `http://localhost:3000/api/v1/admin/coupons/:uuid` | Super-admin | `UpdateCouponDto` | Updated coupon | Update coupon |
| `DELETE` | `http://localhost:3000/api/v1/admin/coupons/:uuid` | Super-admin | Path UUID | `{ message }` | Hard or soft delete depending on usage |
| `POST` | `http://localhost:3000/api/v1/coupons/validate` | `JwtAuthGuard` + `OnboardingGuard` | `{ code, paymentType }` | `{ valid, couponCode, couponType, originalAmount, discountAmount, finalAmount, message }` | Validate a coupon against current user/context |

Coupon DTOs:

| DTO | Fields |
| --- | --- |
| `CreateCouponDto` | `code`, `type`, `value`, `applicableTo`, `usageLimit?`, `perUserLimit?`, `expiresAt?` |
| `UpdateCouponDto` | `isActive?`, `expiresAt?`, `usageLimit?` |
| `ValidateCouponDto` | `code`, `paymentType` |

Coupon business rules:

- Coupon codes are normalized to uppercase.
- `CreateCouponDto.code` must be 4-20 alphanumeric characters.
- Future expiry validation is enforced during create/update.
- Validation order is:
  1. coupon exists
  2. coupon is active
  3. coupon is not expired
  4. global usage limit not exceeded
  5. per-user limit not exceeded
  6. scope matches payment type
- Discount calculation:
  - `FLAT`: subtract fixed amount
  - `PERCENT`: `floor(originalAmount * value / 100)`
  - `FREE`: final amount becomes zero
- Smart delete:
  - if `usedCount = 0`: hard delete
  - if `usedCount > 0`: soft delete by setting `isActive = false`
- Expired coupon cannot be reactivated.
- Status filter logic supports `active`, `inactive`, `expired`, and `all`.

### Module 4 - Lead System

#### 4.4.1 Lead system summary

Source files:

- `src/leads/leads.controller.ts`
- `src/leads/leads-admin.controller.ts`
- `src/leads/leads.service.ts`
- `src/leads/nurture.service.ts`
- `src/leads/dto/*`

The lead module supports:

- Automatic lead creation after profile completion
- Automatic lead warming after phone verification
- Automatic hot/nurture branching after funnel decision
- Distributor lead management
- Admin lead management
- Strict transition graph after `HOT`
- Follow-up scheduling
- Nurture automation with Day 1 / Day 3 / Day 7 emails
- Lead detail enrichment with funnel progress

#### 4.4.2 Lead lifecycle in actual code

System-driven states:

1. Profile completion -> `NEW`
2. Phone verification -> `WARM`
3. Decision YES -> `HOT`
4. Decision NO -> `NURTURE`

Manual states allowed after `HOT`:

- `CONTACTED`
- `FOLLOWUP`
- `MARK_AS_CUSTOMER`
- `LOST`

Display mapping:

- `MARK_AS_CUSTOMER` is exposed with `displayStatus: "CUSTOMER"`

#### 4.4.3 Distributor lead endpoints

All distributor lead endpoints are guarded by `JwtAuthGuard`, `RolesGuard`, and `@Roles("DISTRIBUTOR")`.

| Method | Full URL | Request body / input | Response shape | Purpose |
| --- | --- | --- | --- | --- |
| `GET` | `http://localhost:3000/api/v1/leads?status=&search=&page=&limit=` | Query params | Paginated lead list | Distributor lead list |
| `GET` | `http://localhost:3000/api/v1/leads/followups/today` | None | Array of today's follow-up leads | Distributor today's follow-ups |
| `GET` | `http://localhost:3000/api/v1/leads/:uuid` | Lead UUID | Lead detail with activities + funnel progress | Distributor lead detail |
| `PATCH` | `http://localhost:3000/api/v1/leads/:uuid/status` | `UpdateLeadStatusDto` | Updated lead object | Distributor lead status update |

#### 4.4.4 Admin lead endpoints

All admin lead endpoints are guarded by `JwtAuthGuard`, `RolesGuard`, and `@Roles("SUPER_ADMIN")`.

| Method | Full URL | Request body / input | Response shape | Purpose |
| --- | --- | --- | --- | --- |
| `GET` | `http://localhost:3000/api/v1/admin/leads?status=&search=&page=&limit=` | Query params | Paginated lead list | All leads |
| `GET` | `http://localhost:3000/api/v1/admin/leads/followups/today` | None | Array of today's follow-up leads | Admin follow-up queue |
| `GET` | `http://localhost:3000/api/v1/admin/leads/distributor/:distributorUuid` | Distributor UUID | Array of leads for one distributor | Distributor-scoped lead view |
| `GET` | `http://localhost:3000/api/v1/admin/leads/:uuid` | Lead UUID | Full lead detail | Admin lead detail |
| `PATCH` | `http://localhost:3000/api/v1/admin/leads/:uuid/status` | `AdminUpdateLeadStatusDto` | Updated lead object | Admin lead status update |

#### 4.4.5 Lead DTO shapes

| DTO | Fields |
| --- | --- |
| `UpdateLeadStatusDto` | `status`, `notes?`, `followupAt?` |
| `AdminUpdateLeadStatusDto` | `status`, `notes?`, `followupAt?` |

Both status-update DTOs only allow these target statuses:

- `CONTACTED`
- `FOLLOWUP`
- `MARK_AS_CUSTOMER`
- `LOST`

Extra validation:

- `FOLLOWUP` requires non-empty `notes`
- `FOLLOWUP` requires `followupAt`
- `followupAt` must be a valid future date

#### 4.4.6 Lead response shape details

List responses return paginated envelopes:

```json
{
  "items": [
    {
      "uuid": "lead-uuid",
      "status": "HOT",
      "displayStatus": "HOT",
      "phone": "+919999999999",
      "user": {
        "uuid": "user-uuid",
        "fullName": "User Name",
        "email": "user@example.com",
        "country": "IN",
        "avatarUrl": "https://..."
      }
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20,
  "totalPages": 3
}
```

Lead detail responses include:

- lead core fields
- `user` object including `avatarUrl`
- assignment information
- activity history
- `funnelProgress` with:
  - `phoneVerified`
  - `paymentCompleted`
  - `decisionAnswer`
  - `completedSteps`
  - `totalSteps`
  - `currentStepUuid`

#### 4.4.7 Actual lead transition rules in code

The current transition graph enforced in `LeadsService.applyStatusChange()` is:

| Current status | Allowed next statuses |
| --- | --- |
| `NEW` | none |
| `WARM` | none |
| `HOT` | `CONTACTED`, `FOLLOWUP`, `MARK_AS_CUSTOMER`, `LOST` |
| `CONTACTED` | `FOLLOWUP`, `MARK_AS_CUSTOMER`, `LOST` |
| `FOLLOWUP` | `CONTACTED`, `MARK_AS_CUSTOMER`, `LOST` |
| `NURTURE` | none |
| `LOST` | none |
| `MARK_AS_CUSTOMER` | none |

This is the same for distributors and admins.

#### 4.4.8 Lead business rules and automation

- Lead is created exactly once per user after profile completion.
- Assignment logic on lead creation:
  - if acquisition has `distributorUuid`, assign to that distributor
  - otherwise assign to the earliest-created `SUPER_ADMIN`
- Phone verification copies phone into lead and moves lead to `WARM`.
- YES decision moves lead to `HOT`.
- NO decision moves lead to `NURTURE` and creates `nurture_enrollments` row if one does not exist.
- `MARK_AS_CUSTOMER` also updates `user.role = CUSTOMER`.
- Follow-up status changes create `LeadActivity` rows with action `FOLLOWUP_SCHEDULED`.
- Other manual transitions create `LeadActivity` rows with action `STATUS_CHANGE`.

#### 4.4.9 Today's follow-ups

Today's follow-up endpoints filter:

- lead status must currently be `FOLLOWUP`
- at least one activity must exist with action `FOLLOWUP_SCHEDULED`
- `followupAt` must fall within today's start/end window

The responses include the latest matching follow-up activity data.

#### 4.4.10 Nurture email sequence

Implemented in `src/leads/nurture.service.ts` as an hourly cron job (`0 * * * *`).

Sequence:

| Stage | Trigger | Side effect |
| --- | --- | --- |
| Day 1 | `nextEmailAt <= now` and `day1SentAt` null | Send Day 1 nurture email, set `day1SentAt`, schedule next email in 2 days |
| Day 3 | `day1SentAt` exists and `day3SentAt` null | Send Day 3 nurture email, set `day3SentAt`, schedule next email in 4 days |
| Day 7 | `day3SentAt` exists and `day7SentAt` null | Send Day 7 nurture email, mark nurture enrollment completed, set lead status to `LOST` |

#### 4.4.11 Lead-system reality checks

- The backend uses `NEW`, not a literal `LEAD` enum value.
- Server-side pagination **is** implemented for admin and distributor list endpoints.
- `displayStatus` is implemented.
- `availableActions` is **not** present in current response DTOs/services.
- `avatarUrl` is included in nested `user` objects where the code selects it.
- `funnelProgress.totalSteps` is included in detail responses.

### Module 5 - LMS

#### 4.5.1 LMS summary

Source files:

- `src/lms/lms.module.ts`
- `src/lms/courses-admin.controller.ts`
- `src/lms/courses-admin.service.ts`
- `src/lms/courses-user.controller.ts`
- `src/lms/courses-user.service.ts`
- `src/lms/enrollment.service.ts`
- `src/lms/certificate.service.ts`
- `src/lms/dto/*`

The LMS module supports:

- Course creation and publishing by super-admin
- Course -> section -> lesson hierarchy
- Free and paid enrollments
- LMS-specific payment flow
- Lesson locking based on previous-lesson completion
- Video progress tracking and 90% auto-complete
- Course completion detection
- Certificate generation and retrieval
- User-facing "my courses" listing
- Basic LMS analytics for super-admins

#### 4.5.2 LMS admin endpoints

All LMS admin endpoints are guarded by `JwtAuthGuard`, `RolesGuard`, and `@Roles("SUPER_ADMIN")`.

| Method | Full URL | Request body / input | Response shape | Purpose |
| --- | --- | --- | --- | --- |
| `POST` | `http://localhost:3000/api/v1/admin/courses` | `CreateCourseDto` | Created course | Create course |
| `GET` | `http://localhost:3000/api/v1/admin/courses` | None | Course list with counts | List all courses |
| `GET` | `http://localhost:3000/api/v1/admin/courses/:uuid` | Course UUID | Full course detail | Get one course with sections/lessons |
| `PATCH` | `http://localhost:3000/api/v1/admin/courses/:uuid` | `UpdateCourseDto` | Updated course | Update course |
| `DELETE` | `http://localhost:3000/api/v1/admin/courses/:uuid` | Course UUID | `{ message }` | Delete course if no active enrollments |
| `PATCH` | `http://localhost:3000/api/v1/admin/courses/:uuid/publish` | None | Updated course | Publish course |
| `PATCH` | `http://localhost:3000/api/v1/admin/courses/:uuid/unpublish` | None | Updated course | Unpublish course |
| `POST` | `http://localhost:3000/api/v1/admin/courses/:uuid/sections` | `CreateSectionDto` | Created section | Create section |
| `PATCH` | `http://localhost:3000/api/v1/admin/courses/:courseUuid/sections/reorder` | `ReorderDto` | Updated sections | Reorder sections |
| `PATCH` | `http://localhost:3000/api/v1/admin/courses/:courseUuid/sections/:sectionUuid` | `UpdateSectionDto` | Updated section | Update section |
| `DELETE` | `http://localhost:3000/api/v1/admin/courses/:courseUuid/sections/:sectionUuid` | Path params | `{ message }` | Delete section |
| `POST` | `http://localhost:3000/api/v1/admin/courses/:courseUuid/sections/:sectionUuid/lessons` | `CreateLessonDto` | Created lesson | Create lesson |
| `PATCH` | `http://localhost:3000/api/v1/admin/courses/:courseUuid/sections/:sectionUuid/lessons/reorder` | `ReorderDto` | Updated lessons | Reorder lessons |
| `PATCH` | `http://localhost:3000/api/v1/admin/courses/:courseUuid/sections/:sectionUuid/lessons/:lessonUuid` | `UpdateLessonDto` | Updated lesson | Update lesson |
| `DELETE` | `http://localhost:3000/api/v1/admin/courses/:courseUuid/sections/:sectionUuid/lessons/:lessonUuid` | Path params | `{ message }` | Delete lesson |
| `GET` | `http://localhost:3000/api/v1/admin/lms/analytics` | None | LMS analytics summary | LMS analytics dashboard data |

#### 4.5.3 LMS user endpoints

All user LMS endpoints are guarded by `JwtAuthGuard`, `RolesGuard`, and `@Roles("CUSTOMER", "DISTRIBUTOR")`.

| Method | Full URL | Request body / input | Response shape | Purpose |
| --- | --- | --- | --- | --- |
| `GET` | `http://localhost:3000/api/v1/lms/courses` | None | Published course catalog | Browse published courses |
| `GET` | `http://localhost:3000/api/v1/lms/courses/:uuid` | Course UUID | Course detail with sections and lesson lock/completion state | View one course |
| `POST` | `http://localhost:3000/api/v1/lms/courses/:uuid/enroll` | None | Free enrollment result or payment order data | Enroll in course |
| `GET` | `http://localhost:3000/api/v1/lms/courses/:uuid/learn` | Course UUID | Full learn-content payload | Course learning page data |
| `GET` | `http://localhost:3000/api/v1/lms/my-courses` | None | `{ courses: [...] }` | User's enrolled courses with progress |
| `GET` | `http://localhost:3000/api/v1/lms/lessons/:uuid` | Lesson UUID | One lesson content payload | Lesson detail |
| `POST` | `http://localhost:3000/api/v1/lms/lessons/:uuid/progress` | `{ watchedSeconds }` | `{ isCompleted, watchedSeconds }` | Update video progress |
| `POST` | `http://localhost:3000/api/v1/lms/lessons/:uuid/complete` | None | Updated completion state | Complete text/PDF lesson or manually complete lesson |
| `GET` | `http://localhost:3000/api/v1/lms/courses/:uuid/certificate` | Course UUID | `{ certificateUrl, certificateId }`-style payload | Retrieve/generate completion certificate |

#### 4.5.4 LMS DTO shapes

| DTO | Fields |
| --- | --- |
| `CreateCourseDto` | `title`, `description`, `thumbnailUrl?`, `isFree`, `price?` |
| `UpdateCourseDto` | Same fields optional |
| `CreateSectionDto` | `title`, `order` |
| `UpdateSectionDto` | `title?`, `order?` |
| `CreateLessonDto` | `title`, `description?`, `videoUrl?`, `videoDuration?`, `textContent?`, `pdfUrl?`, `order`, `isPublished` |
| `UpdateLessonDto` | Same lesson fields optional |
| `ReorderDto` | `orderedUuids: string[]` |
| `LessonProgressDto` | `watchedSeconds: number` |

#### 4.5.5 LMS business rules

- Only `SUPER_ADMIN` can create, publish, update, or delete LMS content.
- Only `CUSTOMER` and `DISTRIBUTOR` roles can access LMS user endpoints.
- Paid courses require a non-zero price at creation time.
- Unpublished courses are hidden from user-facing endpoints.
- Free courses create `course_enrollments` directly.
- Paid courses create payment orders through the LMS enrollment service.
- A user cannot enroll twice in the same course.
- Lesson locking is computed on the backend.
- The first lesson is never locked.
- Any later lesson is locked until the immediately previous lesson is completed.
- User-facing course detail and learn-content endpoints both include lock/completion state.
- `getMyCourses()` returns progress percentage and completion metadata.

#### 4.5.6 Lesson content structure

Actual lesson modeling is field-based rather than enum-based.

A lesson can include any combination of:

- `videoUrl`
- `videoDuration`
- `textContent`
- `pdfUrl`

So the product concept of "Video / Text / PDF lesson types" is implemented as content fields on `CourseLesson`, not as a Prisma enum.

#### 4.5.7 Video progress and completion

LMS has the 90% completion logic the user requested:

- `updateLessonProgress()` auto-completes when `watchedSeconds >= lesson.videoDuration * 0.9`
- `LessonProgress` is upserted per user and lesson
- If auto-completion causes all published lessons to be complete, the course enrollment is finalized

This 90% rule is real in LMS and should not be confused with funnel video completion logic.

#### 4.5.8 Certificate generation

Certificate behavior from `src/lms/certificate.service.ts`:

- Certificate ID format: `CERT-{8 random uppercase alphanumeric characters}`
- Output directory: `uploads/certificates`
- URL format: `/uploads/certificates/{fileName}`
- Rendering engine: Puppeteer
- Browser args: `--no-sandbox`, `--disable-setuid-sandbox`
- If PDF generation fails, an HTML fallback file is written
- A certificate-ready email is sent fire-and-forget after generation

Certificate template facts:

- Student name and course title are embedded into the generated HTML
- Signer displayed: `Nageshwar Shukla`
- Organization wording: `NSI Platform / Network Success Institute`

#### 4.5.9 LMS payment realities

- `EnrollmentService.initiatePaidEnrollment()` converts `course.price` to paise first.
- That value is stored in the `payments` table for LMS flows.
- The Razorpay provider then multiplies by 100 again when creating the order.
- This likely means LMS paid-course orders are over-multiplied and should be reviewed before production rollout.
- Mock LMS payments auto-complete after 2 seconds.

### Module 7 - Admin APIs

#### 4.7.1 Admin module summary

Source files:

- `src/admin/admin.module.ts`
- `src/admin/users-admin.controller.ts`
- `src/admin/users-admin.service.ts`
- `src/admin/distributors-admin.controller.ts`
- `src/admin/distributors-admin.service.ts`
- `src/admin/analytics-admin.controller.ts`
- `src/admin/analytics-admin.service.ts`
- `src/admin/dto/*`

All admin APIs are guarded by `JwtAuthGuard`, `RolesGuard`, and `@Roles("SUPER_ADMIN")` unless otherwise noted.

#### 4.7.2 User management endpoints

| Method | Full URL | Request body / input | Response shape | Purpose |
| --- | --- | --- | --- | --- |
| `GET` | `http://localhost:3000/api/v1/admin/users?role=&status=&country=&search=&page=&limit=` | Query params | Paginated user list | Filtered user management list |
| `GET` | `http://localhost:3000/api/v1/admin/users/:uuid` | User UUID | Full user detail | User detail with LMS/funnel/payments/leads |
| `PATCH` | `http://localhost:3000/api/v1/admin/users/:uuid/suspend` | None | Updated user / success payload | Suspend user and kill sessions |
| `PATCH` | `http://localhost:3000/api/v1/admin/users/:uuid/reactivate` | None | Updated user / success payload | Reactivate user |
| `PATCH` | `http://localhost:3000/api/v1/admin/users/:uuid/role` | `UpdateUserRoleDto` | Updated user | Change non-super-admin roles |

User-management rules:

- User list supports filters for role, status, country, and search.
- Search matches name/email.
- Pagination is server-side and capped at `limit <= 100`.
- Detail response includes:
  - profile phone
  - funnel progress summary
  - completed funnel steps
  - payment history
  - lead detail
  - LMS progress
  - active session count
- Suspending a user:
  - blocks suspending a `SUPER_ADMIN`
  - sets `status = SUSPENDED`
  - sets `suspendedAt`
  - sets `suspendedBy`
  - deletes all `auth_sessions`
  - sends suspension email fire-and-forget
- Reactivating a user:
  - only works from `SUSPENDED`
  - sets status to `ACTIVE`
  - clears suspension metadata
  - sends reactivation email fire-and-forget
- Role change rules:
  - cannot assign `SUPER_ADMIN`
  - cannot change the role of an existing `SUPER_ADMIN`

#### 4.7.3 Distributor management endpoints

| Method | Full URL | Request body / input | Response shape | Purpose |
| --- | --- | --- | --- | --- |
| `GET` | `http://localhost:3000/api/v1/admin/distributors?search=&status=&page=&limit=` | Query params | Paginated ranked distributor list | Distributor leaderboard/management |
| `GET` | `http://localhost:3000/api/v1/admin/distributors/:uuid` | Distributor UUID | Distributor detail + recent leads + analytics | Distributor profile |
| `PATCH` | `http://localhost:3000/api/v1/admin/distributors/:uuid/deactivate-link` | None | Updated distributor / success payload | Disable join link |
| `PATCH` | `http://localhost:3000/api/v1/admin/distributors/:uuid/activate-link` | None | Updated distributor / success payload | Enable join link |

Distributor-management rules:

- Only users with role `DISTRIBUTOR` are returned by these endpoints.
- List is effectively ranked by `totalLeads` descending after aggregation.
- Join link URL is derived from `FRONTEND_URL` and `distributorCode`.
- Detail analytics include:
  - total referrals
  - successful conversions
  - conversion rate
  - funnel-path status breakdown
  - leads by country
  - leads over time (12-month monthly chart)
- When join link is deactivated:
  - acquisition tracking no longer attributes new signups to that distributor
  - registrations via that code become direct instead of distributor-linked

#### 4.7.4 Platform analytics endpoints

| Method | Full URL | Request body / input | Response shape | Purpose |
| --- | --- | --- | --- | --- |
| `GET` | `http://localhost:3000/api/v1/admin/analytics/dashboard?from=&to=` | Optional date range query | Dashboard overview object | High-level KPIs |
| `GET` | `http://localhost:3000/api/v1/admin/analytics/funnel?from=&to=` | Optional date range query | Funnel metrics object | Funnel-stage analytics |
| `GET` | `http://localhost:3000/api/v1/admin/analytics/revenue?from=&to=` | Optional date range query | Revenue metrics object | Revenue analytics |
| `GET` | `http://localhost:3000/api/v1/admin/analytics/leads?from=&to=` | Optional date range query | Lead metrics object | Lead analytics |
| `GET` | `http://localhost:3000/api/v1/admin/analytics/distributors?from=&to=` | Optional date range query | Distributor metrics object | Distributor analytics |

Analytics query DTO:

| DTO | Fields |
| --- | --- |
| `AnalyticsQueryDto` | `from?: date string`, `to?: date string` |

Analytics business rules:

- Default range is the last 30 days if no dates are supplied.
- Max range is 5 years (`1825` days).
- If `from > to`, request is rejected.
- Grouping strategy:
  - range `<= 30 days` -> daily
  - range `<= 180 days` -> weekly
  - range `> 180 days` -> monthly
- Growth percentages are calculated against the immediately previous equivalent time window.
- Revenue analytics group successful payments by period, type, and user country.
- Leads analytics group by status and source (`direct` vs distributor-attributed).
- Distributors analytics compute average leads, average conversion, active-this-month, and top distributors.

#### 4.7.5 Admin analytics reality checks

- `AnalyticsAdminService` queries `decisionAnswer: 'yes'` and `'no'`, but runtime funnel code writes uppercase `YES` / `NO`.
- That mismatch likely undercounts or zeroes decision-based analytics until fixed.
- There is a path-overlap consideration between:
  - `src/funnel-cms/analytics.controller.ts`
  - `src/admin/analytics-admin.controller.ts`
- Future sessions should inspect Nest route registration order if unexpected behavior appears.

---

## Section 5 - Pending Work

### 5.1 Module 6 - Distributor System (not built yet as a dedicated module)

This is the remaining major product area called out in the request. The current repo has distributor-related analytics and join-link activation, but it does **not** contain a dedicated distributor-subscription/business module yet.

Open design questions explicitly called out by the requester:

- Subscription fee amount and whether it should be admin-configurable
- Distributor code generation strategy
- What happens when subscription expires
- Dedicated distributor dashboard for self-serve analytics
- QR-code support for join links

What exists today instead:

- Distributor role in `UserRole`
- Optional `distributorCode` on `User`
- `joinLinkActive` flag on `User`
- Distributor-attributed acquisition tracking
- Distributor lead ownership/list/detail/status management
- Super-admin distributor reporting

### 5.2 Other pending items

| Item | Current state |
| --- | --- |
| User self-service module | Not present as a standalone module; only auth-adjacent password flows exist |
| Frontend implementations | Not part of this backend repo |
| Test coverage | Test count exists, but module coverage is still shallow |
| Coupon analytics endpoints | Not implemented |
| Distributor subscription payment type | Enum exists (`DISTRIBUTOR_SUB`) but no full business module uses it yet |

---

## Section 6 - Key Technical Decisions

This section combines the requester-supplied decision list with code verification notes.

### 6.1 Payments and amount handling

1. Razorpay expects paise.
2. Commitment-fee flow intends to store the logical amount and send paise to Razorpay.
3. In actual code, `RazorpayPaymentProvider.createOrder()` multiplies by `100`.
4. Commitment-fee flow roughly follows the intended pattern.
5. LMS flow likely multiplies twice because it pre-converts to paise before calling the provider.
6. Future payment work should normalize this before production.

### 6.2 Coupon deletion strategy

1. Hard delete coupon if `usedCount = 0`.
2. Soft delete by setting `isActive = false` if already used.
3. Rationale in code and design: preserve payment/coupon history integrity.

### 6.3 JWT + refresh cookie model

1. Access token is returned in the JSON response body.
2. Refresh token is stored only in the HttpOnly cookie.
3. Refresh token is not exposed to frontend JavaScript.
4. Refresh token is an opaque random UUID, not a signed JWT.
5. Session persistence lives in the `auth_sessions` table.

### 6.4 Google OAuth avatar handling

1. Google profile photo is captured as `avatarUrl`.
2. `avatarUrl` is stored in `users.avatar_url`.
3. Auth responses include `avatarUrl`.
4. Lead/user nested responses include `avatarUrl` where selected.
5. Email/password users typically have `avatarUrl = null`.

### 6.5 Lesson locking and completion

1. First lesson is never locked.
2. Every next lesson depends on the previous lesson being completed.
3. Backend computes `isLocked`; frontend should render based on that flag.
4. LMS auto-completion happens at 90% watched duration.
5. Funnel content steps use a different completion rule (`duration - 3 seconds`).

### 6.6 Lead status transitions

1. `NEW`, `WARM`, `HOT`, and `NURTURE` are effectively system-controlled entry states.
2. Manual management begins only once a lead reaches `HOT`.
3. The same transition graph is enforced for admin and distributor.
4. There is no bypass for super-admin in the current code.

### 6.7 `displayStatus`

1. `displayStatus` is computed by backend services.
2. `MARK_AS_CUSTOMER` becomes `CUSTOMER`.
3. Raw status is still retained in the payload.

### 6.8 `availableActions`

Requested decision:

- Frontend should read available actions from backend instead of hardcoding.

Actual code reality:

- This has **not** been implemented yet in leads responses.
- A future AI session should not assume it exists.

### 6.9 Smart analytics grouping

1. `<= 30 days` -> daily
2. `<= 180 days` -> weekly
3. `> 180 days` -> monthly
4. Max range is 5 years
5. Purpose: avoid heavy queries and overly noisy charts

### 6.10 Fire-and-forget emails

1. OTP, welcome, password, nurture, certificate, suspension, and reactivation emails are all sent without blocking API responses.
2. This is a real implementation pattern throughout the codebase.

### 6.11 Audit logs

1. Admin and major auth/funnel/payment/lead actions are logged.
2. Audit entries store `actorUuid`, `action`, `metadata`, and `ipAddress`.
3. Table name is `audit_logs`.

### 6.12 Mock providers

1. Mock payment auto-confirms after 2 seconds.
2. Mock phone provider always uses OTP `123456`.
3. Mock mail provider logs output and writes OTPs to `test-otp.txt`.
4. Provider switching is env-driven.

---

## Section 7 - API Structure

### 7.1 Base URL and versioning

| Item | Value |
| --- | --- |
| Development base URL | `http://localhost:3000/api/v1` |
| Global prefix | `/api` |
| API versioning | URI versioning with default version `1` |

### 7.2 Authentication header

Protected endpoints use:

```http
Authorization: Bearer <accessToken>
```

### 7.3 Standard error response shape

Implemented by `src/common/filters/http-exception.filter.ts`:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "timestamp": "2026-04-06T12:34:56.000Z",
  "path": "/api/v1/example"
}
```

### 7.4 Standard paginated response shape

Used by leads and admin user/distributor listing services:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "limit": 20,
  "totalPages": 0
}
```

### 7.5 Global middleware / platform behavior

- `cookie-parser` is enabled globally
- global validation pipe is enabled
- logging interceptor is enabled globally
- exception filter is enabled globally
- CORS is enabled with credentials
- app listens on `0.0.0.0`
- `rawBody` is enabled for webhook verification

---

## Section 8 - Environment Variables

### 8.1 Actual variables present in `.env.example`

| Variable | Present in `.env.example` | Notes |
| --- | --- | --- |
| `NODE_ENV` | Yes | Defaults to `development` |
| `PORT` | Yes | Defaults to `3000` |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Access token secret |
| `JWT_EXPIRES_IN` | Yes | Defaults to `15m` |
| `REFRESH_TOKEN_EXPIRES_IN` | Yes | Defaults to `7d` |
| `REDIS_HOST` | Yes | Present in example, not actively used in current source reviewed here |
| `REDIS_PORT` | Yes | Present in example, not actively used in current source reviewed here |
| `MAIL_PROVIDER` | Yes | `mock` or `resend` |
| `MAIL_FROM` | Yes | Sender email |
| `MAIL_FROM_NAME` | Yes | Sender name |
| `RESEND_API_KEY` | Yes | Resend provider |
| `FRONTEND_URL` | Yes | Frontend base URL |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth |
| `GOOGLE_CALLBACK_URL` | Yes | Google OAuth callback |
| `TWILIO_ACCOUNT_SID` | Yes | Twilio Verify |
| `TWILIO_AUTH_TOKEN` | Yes | Twilio Verify |
| `TWILIO_VERIFY_SERVICE_SID` | Yes | Twilio Verify |
| `RAZORPAY_KEY_ID` | Yes | Razorpay |
| `RAZORPAY_KEY_SECRET` | Yes | Razorpay |
| `RAZORPAY_WEBHOOK_SECRET` | Yes | Razorpay webhook verification |
| `SMS_PROVIDER` | Yes | Actual phone-provider selector (`mock` or `twilio`) |
| `PAYMENT_PROVIDER` | Yes | `mock` or `razorpay` |

### 8.2 Requested variables vs actual repo reality

| Variable mentioned in request | Actual status |
| --- | --- |
| `DATABASE_URL` | Present |
| `JWT_SECRET` | Present |
| `JWT_REFRESH_SECRET` | **Not present** |
| `GOOGLE_CLIENT_ID` | Present |
| `GOOGLE_CLIENT_SECRET` | Present |
| `GOOGLE_CALLBACK_URL` | Present |
| `RAZORPAY_KEY_ID` | Present |
| `RAZORPAY_KEY_SECRET` | Present |
| `RAZORPAY_WEBHOOK_SECRET` | Present |
| `TWILIO_ACCOUNT_SID` | Present |
| `TWILIO_AUTH_TOKEN` | Present |
| `TWILIO_VERIFY_SERVICE_SID` | Present |
| `RESEND_API_KEY` | Present |
| `FRONTEND_URL` | Present |
| `PAYMENT_PROVIDER` | Present |
| `PHONE_PROVIDER` | **Not present**; use `SMS_PROVIDER` instead |
| `MAIL_PROVIDER` | Present |
| `NODE_ENV` | Present |

### 8.3 Additional env reality notes

- `BACKEND_URL` is used in Google OAuth finalize flow but missing from `.env.example`.
- `MAIL_PROVIDER`, `PAYMENT_PROVIDER`, and `SMS_PROVIDER` each control concrete provider factories.
- `JWT_EXPIRES_IN` and `REFRESH_TOKEN_EXPIRES_IN` are actively parsed in auth logic.

---

## Section 9 - How We Work

This section combines the requester-supplied process with what the repository structure suggests.

### 9.1 Requested development workflow

1. Plan in Claude.ai for architecture and decisions.
2. Write an Antigravity prompt from that plan.
3. Use Antigravity / Claude Code to implement code.
4. Run `npx tsc --noEmit` and require zero errors.
5. Run `npm test` and require all tests passing.
6. Run `npm run start:dev` and require clean startup.
7. Push to GitHub with a professional commit message.
8. Generate frontend documentation.
9. Move to the next module.

### 9.2 Hard gates before moving on

- Zero TypeScript errors
- All tests passing
- Server starts clean

### 9.3 How this repo reflects that workflow

- The codebase contains substantial frontend-facing integration guides in `docs/`.
- Multiple modules already have implementation notes reflected in generated docs.
- Spec coverage exists for auth/OTP/users/coupon, but not for many later modules.
- The code structure suggests module-by-module sequential development with documentation generated after backend completion.

---

## Section 10 - File Structure

This section lists the complete `src/` tree as present in the repository during this pass, grouped by area, with a short description for every file.

### 10.1 Root `src/` files

| Path | Kind | Description |
| --- | --- | --- |
| `src/app.module.ts` | File | Main Nest module that wires together config, throttling, Prisma, and all feature modules |
| `src/main.ts` | File | Application bootstrap: global prefix/versioning, CORS, pipes, filters, logging interceptor, cookie parser, and port binding |

### 10.2 `src/admin/`

| Path | Kind | Description |
| --- | --- | --- |
| `src/admin/` | Folder | Super-admin APIs for users, distributors, and analytics |
| `src/admin/admin.module.ts` | File | Registers admin controllers/services |
| `src/admin/analytics-admin.controller.ts` | File | HTTP endpoints for dashboard, funnel, revenue, leads, and distributor analytics |
| `src/admin/analytics-admin.service.ts` | File | Date-range parsing, growth calculations, smart grouping, and analytics aggregation logic |
| `src/admin/distributors-admin.controller.ts` | File | Distributor management endpoints |
| `src/admin/distributors-admin.service.ts` | File | Distributor ranking, detail analytics, and join-link activation/deactivation logic |
| `src/admin/users-admin.controller.ts` | File | User management endpoints |
| `src/admin/users-admin.service.ts` | File | User list/detail, suspension, reactivation, and role updates |
| `src/admin/dto/` | Folder | Admin-specific DTOs |
| `src/admin/dto/analytics-query.dto.ts` | File | Optional `from`/`to` date-range DTO for analytics |
| `src/admin/dto/update-user-role.dto.ts` | File | DTO for role changes |

### 10.3 `src/assets/`

| Path | Kind | Description |
| --- | --- | --- |
| `src/assets/` | Folder | Static binary assets referenced by mail/template code |
| `src/assets/ONLY NSI.png` | File | NSI logo image used by email branding and/or certificate visuals |

### 10.4 `src/audit/`

| Path | Kind | Description |
| --- | --- | --- |
| `src/audit/` | Folder | Audit logging module |
| `src/audit/audit.module.ts` | File | Exposes audit service |
| `src/audit/audit.service.ts` | File | Fire-and-forget writer for `audit_logs` entries |

### 10.5 `src/auth/`

| Path | Kind | Description |
| --- | --- | --- |
| `src/auth/` | Folder | Authentication feature module |
| `src/auth/auth.controller.ts` | File | Signup/login/refresh/logout/OTP/Google OAuth HTTP endpoints |
| `src/auth/auth.module.ts` | File | Registers auth dependencies, Passport, JWT, guards, and strategies |
| `src/auth/auth.service.spec.ts` | File | Unit tests for auth service flows |
| `src/auth/auth.service.ts` | File | Core auth business logic |
| `src/auth/decorators/` | Folder | Custom controller decorators |
| `src/auth/decorators/current-user.decorator.ts` | File | Extracts JWT user from request |
| `src/auth/decorators/roles.decorator.ts` | File | Declares required roles metadata |
| `src/auth/dto/` | Folder | Auth DTOs |
| `src/auth/dto/complete-profile.dto.ts` | File | DTO for country/profile completion |
| `src/auth/dto/forgot-password.dto.ts` | File | DTO for requesting password reset OTP |
| `src/auth/dto/login.dto.ts` | File | DTO for email/password login |
| `src/auth/dto/resend-otp.dto.ts` | File | DTO for resending verification OTP |
| `src/auth/dto/reset-password.dto.ts` | File | DTO for completing password reset |
| `src/auth/dto/set-password.dto.ts` | File | DTO for Google-account password creation |
| `src/auth/dto/signup.dto.ts` | File | DTO for signup |
| `src/auth/dto/verify-otp.dto.ts` | File | DTO for email OTP verification |
| `src/auth/guards/` | Folder | Auth-related route guards |
| `src/auth/guards/jwt-auth.guard.ts` | File | Thin wrapper around Passport JWT guard |
| `src/auth/guards/onboarding.guard.ts` | File | Blocks incomplete onboarding and suspended users |
| `src/auth/guards/roles.guard.ts` | File | Enforces role metadata |
| `src/auth/strategies/` | Folder | Passport strategies |
| `src/auth/strategies/google.strategy.ts` | File | Google OAuth strategy and profile mapping |
| `src/auth/strategies/jwt.strategy.ts` | File | JWT bearer strategy |

### 10.6 `src/common/`

| Path | Kind | Description |
| --- | --- | --- |
| `src/common/` | Folder | Shared constants, filter, interceptor |
| `src/common/constants/` | Folder | Common static data |
| `src/common/constants/countries.ts` | File | Country-code validation set/helper |
| `src/common/filters/` | Folder | Global HTTP exception filter |
| `src/common/filters/http-exception.filter.ts` | File | Standardizes error responses |
| `src/common/interceptors/` | Folder | Shared interceptors |
| `src/common/interceptors/logging.interceptor.ts` | File | Request/response timing and metadata logging |

### 10.7 `src/coupon/`

| Path | Kind | Description |
| --- | --- | --- |
| `src/coupon/` | Folder | Coupon feature module |
| `src/coupon/coupon.controller.ts` | File | Admin coupon CRUD and user coupon validation endpoints |
| `src/coupon/coupon.dto.ts` | File | Coupon DTOs and enums imported into controllers/services |
| `src/coupon/coupon.module.ts` | File | Coupon module wiring |
| `src/coupon/coupon.service.spec.ts` | File | Minimal coupon unit tests |
| `src/coupon/coupon.service.ts` | File | Coupon validation, CRUD, smart delete, and discount calculation logic |

### 10.8 `src/funnel/`

| Path | Kind | Description |
| --- | --- | --- |
| `src/funnel/` | Folder | Authenticated funnel runtime |
| `src/funnel/funnel.controller.ts` | File | Runtime funnel endpoints |
| `src/funnel/funnel.module.ts` | File | Funnel module wiring |
| `src/funnel/funnel.service.ts` | File | Structure/progress/step completion/decision logic |
| `src/funnel/dto/` | Folder | Funnel runtime DTOs |
| `src/funnel/dto/complete-step.dto.ts` | File | DTO for completing a step |
| `src/funnel/dto/decision.dto.ts` | File | DTO for YES/NO decision submission |
| `src/funnel/dto/video-progress.dto.ts` | File | DTO for watched-seconds updates |

### 10.9 `src/funnel-cms/`

| Path | Kind | Description |
| --- | --- | --- |
| `src/funnel-cms/` | Folder | Super-admin funnel CMS and funnel analytics |
| `src/funnel-cms/analytics.controller.ts` | File | Funnel/UTM/device/conversion analytics endpoints |
| `src/funnel-cms/funnel-cms.controller.ts` | File | Section/step/config CRUD endpoints |
| `src/funnel-cms/funnel-cms.module.ts` | File | Module wiring |
| `src/funnel-cms/funnel-cms.service.ts` | File | Funnel CMS CRUD logic and analytics aggregation |
| `src/funnel-cms/funnel-validation.service.ts` | File | Structural warning rules for funnel setup |
| `src/funnel-cms/dto/` | Folder | Funnel CMS DTOs |
| `src/funnel-cms/dto/section.dto.ts` | File | Section DTOs including reorder |
| `src/funnel-cms/dto/step-content.dto.ts` | File | DTOs for content/phone/payment/decision configs |
| `src/funnel-cms/dto/step.dto.ts` | File | Core step DTOs including reorder |

### 10.10 `src/leads/`

| Path | Kind | Description |
| --- | --- | --- |
| `src/leads/` | Folder | Lead management and nurture automation |
| `src/leads/leads-admin.controller.ts` | File | Super-admin lead endpoints |
| `src/leads/leads.controller.ts` | File | Distributor lead endpoints |
| `src/leads/leads.module.ts` | File | Leads module wiring |
| `src/leads/leads.service.ts` | File | Lead lifecycle, list/detail, status change, and funnel-progress enrichment logic |
| `src/leads/nurture.service.ts` | File | Hourly nurture email scheduler and state progression |
| `src/leads/dto/` | Folder | Lead DTOs |
| `src/leads/dto/admin-update-lead-status.dto.ts` | File | Admin lead status update DTO |
| `src/leads/dto/update-lead-status.dto.ts` | File | Distributor lead status update DTO |

### 10.11 `src/lms/`

| Path | Kind | Description |
| --- | --- | --- |
| `src/lms/` | Folder | LMS feature area |
| `src/lms/certificate.service.ts` | File | Certificate generation and retrieval logic |
| `src/lms/courses-admin.controller.ts` | File | LMS admin CRUD/analytics endpoints |
| `src/lms/courses-admin.service.ts` | File | LMS admin business logic |
| `src/lms/courses-user.controller.ts` | File | LMS user endpoints |
| `src/lms/courses-user.service.ts` | File | Catalog, learn-content, lesson progress, certificate access logic |
| `src/lms/enrollment.service.ts` | File | Free/paid enrollment flow and LMS payment order handling |
| `src/lms/lms.module.ts` | File | LMS module wiring |
| `src/lms/dto/` | Folder | LMS DTOs |
| `src/lms/dto/create-course.dto.ts` | File | Course creation DTO |
| `src/lms/dto/create-lesson.dto.ts` | File | Lesson creation DTO |
| `src/lms/dto/create-section.dto.ts` | File | Section creation DTO |
| `src/lms/dto/lesson-progress.dto.ts` | File | Lesson watched-seconds DTO |
| `src/lms/dto/reorder.dto.ts` | File | Reorder DTO used for sections/lessons |
| `src/lms/dto/update-course.dto.ts` | File | Course update DTO |
| `src/lms/dto/update-lesson.dto.ts` | File | Lesson update DTO |
| `src/lms/dto/update-section.dto.ts` | File | Section update DTO |

### 10.12 `src/mail/`

| Path | Kind | Description |
| --- | --- | --- |
| `src/mail/` | Folder | Mail abstraction, providers, and templates |
| `src/mail/mail.module.ts` | File | Mail module wiring and provider factory registration |
| `src/mail/mail.service.ts` | File | High-level mail facade used by other modules |
| `src/mail/providers/` | Folder | Mail provider implementations |
| `src/mail/providers/mail-provider.factory.ts` | File | Chooses mock vs Resend provider using env |
| `src/mail/providers/mail-provider.interface.ts` | File | Mail provider contract |
| `src/mail/providers/mock.provider.ts` | File | Console/test-file mail provider |
| `src/mail/providers/resend.provider.ts` | File | Real Resend provider and template rendering |
| `src/mail/templates/` | Folder | Email template files |
| `src/mail/templates/email-layout.ts` | File | Shared HTML email shell/layout |
| `src/mail/templates/logo-base64.txt` | File | Inline base64 logo asset |
| `src/mail/templates/nurture-day1.template.ts` | File | Day 1 nurture email template |
| `src/mail/templates/nurture-day3.template.ts` | File | Day 3 nurture email template |
| `src/mail/templates/nurture-day7.template.ts` | File | Day 7 nurture email template |
| `src/mail/templates/nurture.template.ts` | File | Initial NO-decision nurture email template |
| `src/mail/templates/otp.template.ts` | File | Verification/password-reset OTP email template |
| `src/mail/templates/password-changed.template.ts` | File | Password changed notification template |
| `src/mail/templates/password-reset.template.ts` | File | Password reset wrapper template |
| `src/mail/templates/reactivation.template.ts` | File | Account reactivation email template |
| `src/mail/templates/suspension.template.ts` | File | Account suspension email template |
| `src/mail/templates/welcome.template.ts` | File | Welcome email template |

### 10.13 `src/otp/`

| Path | Kind | Description |
| --- | --- | --- |
| `src/otp/` | Folder | OTP storage/verification module |
| `src/otp/otp.module.ts` | File | OTP module wiring |
| `src/otp/otp.service.spec.ts` | File | OTP unit tests |
| `src/otp/otp.service.ts` | File | OTP generation, hashing, attempt counting, resend limits |

### 10.14 `src/payment/`

| Path | Kind | Description |
| --- | --- | --- |
| `src/payment/` | Folder | Payment feature module |
| `src/payment/payment-provider.factory.ts` | File | Chooses payment provider using env |
| `src/payment/payment.controller.ts` | File | Authenticated create-order and status endpoints |
| `src/payment/payment.dto.ts` | File | Payment DTOs |
| `src/payment/payment.module.ts` | File | Payment module wiring |
| `src/payment/payment.service.ts` | File | Order creation, webhook processing, mock completion, payment status logic |
| `src/payment/webhook.controller.ts` | File | Raw webhook endpoint |
| `src/payment/providers/` | Folder | Payment provider implementations |
| `src/payment/providers/mock-payment.provider.ts` | File | Mock provider |
| `src/payment/providers/payment-provider.interface.ts` | File | Payment provider contract |
| `src/payment/providers/razorpay-payment.provider.ts` | File | Razorpay provider implementation |

### 10.15 `src/phone/`

| Path | Kind | Description |
| --- | --- | --- |
| `src/phone/` | Folder | Phone verification feature module |
| `src/phone/phone-provider.factory.ts` | File | Chooses mock vs Twilio phone provider using env |
| `src/phone/phone.controller.ts` | File | Send-OTP and verify-OTP endpoints |
| `src/phone/phone.dto.ts` | File | Phone DTOs |
| `src/phone/phone.module.ts` | File | Phone module wiring |
| `src/phone/phone.service.ts` | File | Number normalization, rate limiting, verification, and funnel/lead side effects |
| `src/phone/providers/` | Folder | Phone provider implementations |
| `src/phone/providers/mock-phone.provider.ts` | File | Mock provider with fixed OTP |
| `src/phone/providers/phone-provider.interface.ts` | File | Phone provider contract |
| `src/phone/providers/twilio-phone.provider.ts` | File | Twilio Verify provider |

### 10.16 `src/prisma/`

| Path | Kind | Description |
| --- | --- | --- |
| `src/prisma/` | Folder | Nest wrapper around Prisma client |
| `src/prisma/prisma.module.ts` | File | Prisma module export |
| `src/prisma/prisma.service.ts` | File | Prisma client lifecycle management |

### 10.17 `src/tracking/`

| Path | Kind | Description |
| --- | --- | --- |
| `src/tracking/` | Folder | UTM/acquisition tracking module |
| `src/tracking/tracking.controller.ts` | File | Public acquisition capture endpoint |
| `src/tracking/tracking.module.ts` | File | Tracking module wiring and throttler config |
| `src/tracking/tracking.service.ts` | File | Acquisition cookie handling, geo lookup, distributor attribution, attach-to-user logic |
| `src/tracking/dto/` | Folder | Tracking DTOs |
| `src/tracking/dto/capture-utm.dto.ts` | File | UTM/device/referrer/distributor capture DTO |

### 10.18 `src/users/`

| Path | Kind | Description |
| --- | --- | --- |
| `src/users/` | Folder | User persistence/service layer used by auth and admin flows |
| `src/users/users.module.ts` | File | Users module wiring |
| `src/users/users.service.spec.ts` | File | Users service unit tests |
| `src/users/users.service.ts` | File | User create/find/update methods including Google-account helpers |

### 10.19 File-structure takeaways

- The repo is organized cleanly by Nest module.
- DTOs are colocated with their modules.
- Provider abstractions exist for mail, phone, and payments.
- Tests are colocated beside services rather than kept in a separate large test tree.
- The repo includes both operational code and frontend-facing integration documentation.

---

## Section 11 - Current Test Status

### 11.1 Actual spec files present

The repo currently contains these four `.spec.ts` files:

| Spec file | Area covered |
| --- | --- |
| `src/auth/auth.service.spec.ts` | Auth service behavior |
| `src/otp/otp.service.spec.ts` | OTP generation/verification/rate limits |
| `src/users/users.service.spec.ts` | User service CRUD/helper behavior |
| `src/coupon/coupon.service.spec.ts` | Coupon expiry validation edge cases |

### 11.2 Coverage reality

Repository-derived coverage picture:

- Tests exist for auth, OTP, users, and coupon only.
- There are no spec files in the repo for:
  - funnel
  - payment
  - leads
  - LMS
  - admin analytics / admin management
  - tracking
  - mail providers/templates

### 11.3 Project-stated status from requester context

The requester asked this master document to reflect the following current-status narrative:

- Test framework: Jest with `ts-jest`
- Total tests: `75 passing, 0 failing`
- Coverage: about `12% overall`
- Hard gate expectation: zero TypeScript errors and all tests passing before moving on

Accuracy note:

- This documentation pass reviewed the test files and Jest config but did **not** re-run the full suite, so the `75/75` number should be treated as the latest project-reported status rather than a runtime verification performed during this write-up.

---

## Section 12 - Documentation Files

The `docs/` folder now contains the following files, including this master-context document.

| File | Description | Freshness / note |
| --- | --- | --- |
| `docs/ADMIN-FRONTEND-GUIDE.md` | Frontend integration guide for admin APIs: users, distributors, leads, analytics, coupons | Large and substantial; likely current enough for admin UI work |
| `docs/frontend-complete-integration-guide.md` | Broader frontend integration guide spanning public tracking, auth, funnel, phone, payment, coupons, and admin areas | Composite guide |
| `docs/frontend-non-auth-feature-guide.md` | Frontend guide focused on implemented features other than auth and leads | Supplemental |
| `docs/frontend-post-auth-flow-guide.md` | Post-auth frontend flow guide for onboarding/funnel/payment progression | Supplemental |
| `docs/funnel-engine-frontend-implementation-guide.md` | Funnel-engine implementation guide for frontend | Detailed funnel guide |
| `docs/FUNNEL-INTEGRATION-GUIDE.md` | Deep funnel integration guide with important implementation realities like `VIDEO_TEXT` step type and env notes | High-value, relatively aligned with code |
| `docs/guide.html` | HTML presentation/wrapper for the NestJS learning/project guide | Ancillary documentation artifact |
| `docs/LEADS-FRONTEND-GUIDE-v2.md` | Newer leads frontend guide | More aligned with current backend than v1 |
| `docs/LEADS-FRONTEND-GUIDE.md` | Older leads frontend guide | Contains outdated claims about pagination/transition rules; treat cautiously |
| `docs/LMS-FRONTEND-GUIDE.md` | LMS frontend integration guide | Exists and is substantial even if team still considers it "in progress" |
| `docs/nestjs_project_guide.md` | Broader NestJS learning/project-flow guide | Older, conceptual, and not limited to current implementation state |
| `docs/NSI-MASTER-CONTEXT-v3.md` | This master handoff document | Generated during this pass |

### 12.1 Requested docs list vs actual docs folder

The requester specifically called out these docs:

- `FUNNEL-INTEGRATION-GUIDE.md`
- `LEADS-FRONTEND-GUIDE.md`
- `LEADS-FRONTEND-GUIDE-v2.md`
- `LMS-FRONTEND-GUIDE.md`
- `ADMIN-FRONTEND-GUIDE.md`
- `NSI-MASTER-CONTEXT-v3.md`

Actual folder contents include those plus several additional cross-module frontend guides and the older general project guide.

### 12.2 Recommended doc trust order for future AI sessions

When docs conflict with source code, use this trust order:

1. `src/` implementation
2. `prisma/schema.prisma`
3. Newer focused guides such as `FUNNEL-INTEGRATION-GUIDE.md`, `LEADS-FRONTEND-GUIDE-v2.md`, and `ADMIN-FRONTEND-GUIDE.md`
4. Older general docs such as `LEADS-FRONTEND-GUIDE.md` and `nestjs_project_guide.md`

---

## Closing Notes For The Next AI Session

If a future AI picks up this project cold, the most important implementation truths to remember are:

- Auth is session-backed refresh-cookie auth, not JWT-refresh-token auth.
- Funnel step type is `VIDEO_TEXT`, not separate `VIDEO` and `TEXT`.
- Funnel content completion logic and LMS lesson completion logic are different.
- Lead lifecycle automation is already wired into auth, phone verification, and funnel decisions.
- `availableActions` for leads is still missing despite being part of the intended frontend contract.
- Payment amount handling needs a careful audit before production-scale rollout.
- Admin analytics likely undercount decision YES/NO due to case mismatch.
- Distributor analytics/admin controls exist, but the dedicated distributor subscription module is still pending.
