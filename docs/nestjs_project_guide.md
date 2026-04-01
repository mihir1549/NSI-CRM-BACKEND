# NSI-Backend: Complete NestJS Learning Guide & Project Flow

> **Your one-stop guide** — NestJS core concepts explained using your actual project code. No YouTube needed.

---

## Table of Contents

1. [NestJS Core Concepts (The Building Blocks)](#1-nestjs-core-concepts)
2. [Your Project Architecture](#2-your-project-architecture)
3. [How a Request Flows Through NestJS](#3-request-lifecycle)
4. [Module-by-Module Breakdown](#4-module-breakdown)
5. [Authentication Flow — Step by Step](#5-authentication-flow)
6. [Database & Prisma Migrations](#6-database--prisma-migrations)
7. [Testing After Migrations](#7-testing-after-migrations)
8. [API Endpoints Reference](#8-api-endpoints)
9. [Quick Commands Cheat Sheet](#9-cheat-sheet)

---

## 1. NestJS Core Concepts

### What is NestJS?

NestJS is a **framework for building server-side Node.js applications**. Think of it as "Angular, but for backend". It gives you a structured, organized way to build APIs using TypeScript.

### The 7 Building Blocks

```mermaid
graph TD
    A[Module] -->|organizes| B[Controller]
    A -->|organizes| C[Provider/Service]
    B -->|receives| D[HTTP Request]
    B -->|validates with| E[DTO + Pipe]
    B -->|protected by| F[Guard]
    B -->|calls| C
    C -->|business logic| G[Database via Prisma]
    D -->|intercepted by| H[Interceptor]
    D -->|errors caught by| I[Exception Filter]
```

---

### 1.1 Modules — The Organizers

> **Analogy:** A module is like a **department in a company**. The Auth department handles authentication, the Mail department handles emails, etc.

```typescript
// What you see in your project: src/app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),  // HR dept — config available everywhere
    ThrottlerModule.forRoot([...]),              // Security dept — rate limiting
    PrismaModule,                                // IT dept — database access
    AuthModule,                                  // Auth dept
    UsersModule,                                 // Users dept
    OtpModule,                                   // OTP dept
    MailModule,                                  // Mail dept
    AuditModule,                                 // Audit dept
  ],
})
export class AppModule {}
```

**Key Rules:**
| Rule | Explanation |
|---|---|
| `imports` | Other modules this module **depends on** |
| `providers` | Services this module **creates** |
| `controllers` | Route handlers this module **exposes** |
| `exports` | Services this module **shares** with others |
| `@Global()` | Makes the module available **everywhere** without importing |

**Your Project's Modules:**

```mermaid
graph TB
    AppModule --> ConfigModule["ConfigModule (Global)"]
    AppModule --> ThrottlerModule["ThrottlerModule (Rate Limiting)"]
    AppModule --> PrismaModule["PrismaModule (Global - DB)"]
    AppModule --> AuthModule
    AppModule --> UsersModule
    AppModule --> OtpModule
    AppModule --> MailModule
    AppModule --> AuditModule

    AuthModule -->|imports| UsersModule
    AuthModule -->|imports| OtpModule
    AuthModule -->|imports| MailModule
    AuthModule -->|imports| AuditModule
```

---

### 1.2 Controllers — The Receptionists

> **Analogy:** A controller is the **reception desk**. It receives incoming requests, checks what the customer wants, and routes them to the right service.

```typescript
// Your project: src/auth/auth.controller.ts
@Controller("auth") // Base route: /api/v1/auth/...
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("signup") // POST /api/v1/auth/signup
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // Rate limit: 5 per 15 min
  @HttpCode(HttpStatus.CREATED) // Return 201 instead of 200
  async signup(@Body() dto: SignupDto, @Req() req: Request) {
    //       ↑ @Body() extracts the JSON body
    //       ↑ SignupDto validates it automatically
    return this.authService.signup(
      dto.fullName,
      dto.email,
      dto.password,
      ipAddress,
    );
  }
}
```

**Key Decorators:**

| Decorator             | What it Does                         | Example                       |
| --------------------- | ------------------------------------ | ----------------------------- |
| `@Controller('auth')` | Sets base route                      | All routes start with `/auth` |
| `@Post('signup')`     | Maps to POST method                  | `POST /api/v1/auth/signup`    |
| `@Get('google')`      | Maps to GET method                   | `GET /api/v1/auth/google`     |
| `@Body()`             | Extracts request body                | `@Body() dto: SignupDto`      |
| `@Req()`              | Injects raw Express request          | `@Req() req: Request`         |
| `@Res()`              | Injects raw Express response         | `@Res() res: Response`        |
| `@HttpCode(201)`      | Sets response status code            | Returns 201 Created           |
| `@UseGuards(...)`     | Applies authentication/authorization | `@UseGuards(JwtAuthGuard)`    |

---

### 1.3 Services (Providers) — The Workers

> **Analogy:** Services are the actual **workers** doing the real job. The controller just passes the task.

```typescript
// Your project: src/auth/auth.service.ts
@Injectable() // ← Makes this class available for dependency injection
export class AuthService {
  constructor(
    private readonly usersService: UsersService, // Injected automatically
    private readonly otpService: OtpService, // NestJS finds and creates these
    private readonly mailService: MailService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async signup(fullName, email, password, ipAddress) {
    // All the real business logic lives here
  }
}
```

**Dependency Injection (DI) — The Magic:**

```
You DON'T do: const usersService = new UsersService(new PrismaService())
You DO:       constructor(private readonly usersService: UsersService) {}
                          ↑ NestJS creates and injects it for you!
```

> **Why DI matters:** You never manually create objects. NestJS creates them once and gives the same instance to everyone who needs it. This is called a **singleton pattern**.

---

### 1.4 DTOs — The Validators

> **Analogy:** DTOs are like **application forms**. If someone fills in wrong info, the form rejects them before they even reach the service desk.

```typescript
// Your project: src/auth/dto/signup.dto.ts
export class SignupDto {
  @IsString()
  @IsNotEmpty({ message: "Full name is required" })
  fullName!: string;

  @IsEmail({}, { message: "Please provide a valid email address" })
  @IsNotEmpty({ message: "Email is required" })
  email!: string;

  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters long" })
  @IsNotEmpty({ message: "Password is required" })
  password!: string;
}
```

**How validation works automatically:**

```
Client sends → { "email": "bad", "password": "123" }
                    ↓
ValidationPipe checks SignupDto rules
                    ↓
Auto-rejects → { "message": ["Please provide a valid email address",
                              "Password must be at least 8 characters long"] }
```

This works because of the **Global Validation Pipe** in `main.ts`:

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true, // Strips unknown properties (security!)
    forbidNonWhitelisted: true, // Rejects if unknown properties sent
    transform: true, // Auto-converts JSON → DTO class instances
  }),
);
```

---

### 1.5 Guards — The Security Checkpoints

> **Analogy:** Guards are **security checkpoints** before entering a building. They decide YES or NO — can this person enter?

Your project has **3 guards**:

#### Guard 1: `JwtAuthGuard` — "Do you have a valid ticket?"

```typescript
// Checks: Is there a valid JWT Bearer token in the Authorization header?
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {}
// If YES → attaches decoded token to request.user → proceeds
// If NO  → returns 401 Unauthorized
```

#### Guard 2: `RolesGuard` — "Do you have the right role?"

```typescript
// Usage: @Roles('ADMIN', 'DISTRIBUTOR') + @UseGuards(RolesGuard)
// Checks: Does the user's ROLE (from DB, not JWT) match the required roles?
// CRITICAL: Always re-fetches user from database, never trusts JWT claims
```

#### Guard 3: `OnboardingGuard` — "Did you complete your profile?"

```typescript
// Blocks ALL routes if user.status === 'PROFILE_INCOMPLETE'
// EXCEPT: /auth/complete-profile (so they can actually complete it)
// CRITICAL: Always re-fetches user from database
```

**Guard execution order:**

```
Request → JwtAuthGuard → RolesGuard → OnboardingGuard → Controller
           (valid JWT?)   (right role?)  (profile done?)    (handler)
```

---

### 1.6 Interceptors & Filters — The Wrapping Layer

#### Interceptors — "Before and After" watchers

```typescript
// Your project: src/common/interceptors/logging.interceptor.ts
// Logs every single request/response with timing:
// → POST /api/v1/auth/signup | IP: ::1 | UA: PostmanRuntime
// ← POST /api/v1/auth/signup | 234ms
```

#### Exception Filters — "Catch all errors"

```typescript
// Your project: src/common/filters/http-exception.filter.ts
// Catches ALL errors and formats them consistently:
{
  "statusCode": 400,
  "error": "BadRequestException",
  "message": "Invalid email or OTP",
  "timestamp": "2026-03-09T10:00:00.000Z",
  "path": "/api/v1/auth/verify-email-otp"
}
```

---

### 1.7 Strategies — Passport Authentication

> **Analogy:** Strategies are like **different ways to prove your identity** — showing an ID card (JWT) vs showing a Google badge (OAuth).

#### JWT Strategy — Validates access tokens

```typescript
// Extracts JWT from: Authorization: Bearer <token>
// Verifies signature using JWT_SECRET
// Returns payload: { sub: "user-uuid", email, role, status }
// This payload becomes → request.user
```

#### Google Strategy — OAuth with Google

```typescript
// Redirects user to Google login page
// Google returns profile data back to callback URL
// Strategy extracts: { googleId, email, fullName, emailVerified }
```

---

### 1.8 Decorators — Custom Shortcuts

```typescript
// @CurrentUser() — extracts JWT payload from request
// Usage: @CurrentUser() user: JwtPayload     → full payload
//        @CurrentUser('sub') userId: string   → just the UUID

// @Roles() — metadata decorator for role-based access
// Usage: @Roles('ADMIN', 'DISTRIBUTOR')
```

---

## 2. Your Project Architecture

### Folder Structure Explained

```
nsi-backend/
├── prisma/
│   ├── schema.prisma          ← Database schema (single source of truth)
│   └── migrations/            ← SQL migration history
│       ├── 20260227_init/          Migration 1: Initial schema
│       ├── 20260227_add_otp_attempts/  Migration 2: Added attempts column
│       └── 20260303_add_google_oauth/  Migration 3: Added Google OAuth fields
│
├── src/
│   ├── main.ts                ← App entry point (bootstrap)
│   ├── app.module.ts          ← Root module (wires everything)
│   │
│   ├── auth/                  ← Authentication module
│   │   ├── auth.module.ts         Module definition
│   │   ├── auth.controller.ts     11 endpoints (signup, login, etc.)
│   │   ├── auth.service.ts        All auth business logic (~800 lines)
│   │   ├── dto/                   8 validation classes
│   │   ├── guards/                3 guards (jwt, roles, onboarding)
│   │   ├── strategies/            2 strategies (jwt, google)
│   │   └── decorators/            2 decorators (@CurrentUser, @Roles)
│   │
│   ├── users/                 ← Users module (DB operations only)
│   │   ├── users.module.ts
│   │   └── users.service.ts       CRUD operations for User model
│   │
│   ├── otp/                   ← OTP module
│   │   ├── otp.module.ts
│   │   └── otp.service.ts         Generate, store, verify OTPs
│   │
│   ├── mail/                  ← Email module (pluggable providers)
│   │   ├── mail.module.ts
│   │   ├── mail.service.ts        Facade (fire-and-forget)
│   │   ├── providers/             Mock + Resend implementations
│   │   └── templates/             HTML email templates
│   │
│   ├── audit/                 ← Audit logging module
│   │   ├── audit.module.ts
│   │   └── audit.service.ts       Fire-and-forget audit trail
│   │
│   ├── prisma/                ← Database access module
│   │   ├── prisma.module.ts       @Global() — available everywhere
│   │   └── prisma.service.ts      Extends PrismaClient
│   │
│   └── common/                ← Shared utilities
│       ├── filters/               HttpExceptionFilter (error formatting)
│       ├── interceptors/          LoggingInterceptor (request/response logging)
│       └── constants/             Country codes validation
│
├── test/                      ← E2E tests
├── .env                       ← Environment variables (secrets)
└── package.json               ← Dependencies & scripts
```

---

### Database Models (4 tables)

```mermaid
erDiagram
    User ||--o{ AuthSession : "has many"
    User ||--o{ EmailOTP : "has many"
    User ||--o{ AuditLog : "logged by"

    User {
        string uuid PK "UUID v4"
        string fullName
        string email UK "unique"
        string passwordHash "nullable (Google users)"
        string googleId UK "nullable, unique"
        enum authProvider "EMAIL | GOOGLE"
        enum role "USER | CUSTOMER | DISTRIBUTOR | ADMIN"
        enum status "REGISTERED | EMAIL_VERIFIED | PROFILE_INCOMPLETE | ACTIVE | SUSPENDED"
        boolean emailVerified
        string country "nullable"
    }

    AuthSession {
        string uuid PK
        string userUuid FK
        string tokenId "first 16 chars of refresh token"
        string refreshTokenHash "bcrypt hash"
        datetime expiresAt
        string ipAddress
        string userAgent
    }

    EmailOTP {
        string uuid PK
        string userUuid FK
        string otpHash "bcrypt hash"
        int attempts "max 3"
        datetime expiresAt "10 min TTL"
        boolean used
    }

    AuditLog {
        string uuid PK
        string actorUuid FK "nullable"
        string action "e.g. USER_SIGNUP"
        json metadata
        string ipAddress
    }
```

---

### User Status Lifecycle

```mermaid
stateDiagram-v2
    [*] --> REGISTERED : Signup (email + password)
    [*] --> EMAIL_VERIFIED : Google OAuth (email auto-verified)
    REGISTERED --> EMAIL_VERIFIED : Verify OTP
    EMAIL_VERIFIED --> PROFILE_INCOMPLETE : Country is null
    EMAIL_VERIFIED --> ACTIVE : Country already set
    PROFILE_INCOMPLETE --> ACTIVE : Complete Profile (set country)
    ACTIVE --> SUSPENDED : Admin action
    SUSPENDED --> ACTIVE : Admin reinstates
```

---

## 3. Request Lifecycle

When a request hits your server, here's the **exact order** of everything that happens:

```mermaid
sequenceDiagram
    participant Client
    participant Express
    participant Middleware
    participant Guard
    participant Interceptor
    participant Pipe
    participant Controller
    participant Service
    participant DB

    Client->>Express: POST /api/v1/auth/signup
    Express->>Middleware: cookie-parser, CORS check
    Middleware->>Guard: JwtAuthGuard (if @UseGuards applied)
    Guard->>Interceptor: LoggingInterceptor logs "→ POST /api/v1/auth/signup"
    Interceptor->>Pipe: ValidationPipe validates body against SignupDto
    Pipe->>Controller: AuthController.signup()
    Controller->>Service: AuthService.signup()
    Service->>DB: Prisma queries (create user, store OTP)
    DB-->>Service: Results
    Service-->>Controller: { message: "Registration successful..." }
    Controller-->>Interceptor: Response
    Interceptor-->>Client: LoggingInterceptor logs "← POST | 234ms"
    Note over Client: If error at any step → HttpExceptionFilter catches it
```

### Startup Flow (`main.ts`)

```
1. NestFactory.create(AppModule)     → Creates the NestJS app from root module
2. app.setGlobalPrefix('api')       → All routes start with /api
3. app.enableVersioning(URI, v1)    → All routes become /api/v1/...
4. app.useGlobalPipes(Validation)   → Auto-validate all incoming DTOs
5. app.use(cookieParser())          → Parse cookies (for refresh tokens)
6. app.useGlobalFilters(Exception)  → Catch all errors uniformly
7. app.useGlobalInterceptors(Log)   → Log all requests/responses
8. app.enableCors(...)              → Allow frontend origins
9. app.listen(3000)                 → Start listening!
```

---

## 4. Module-by-Module Breakdown

### 4.1 PrismaModule — The Database Gateway

- `@Global()` so every module can use `PrismaService` without importing
- `PrismaService` extends `PrismaClient` directly
- Connects on startup (`onModuleInit`), disconnects on shutdown (`onModuleDestroy`)
- Every other service uses `this.prisma.user.findUnique(...)` etc.

### 4.2 UsersModule — Pure CRUD

Provides 8 database operations:

| Method                         | Purpose                         |
| ------------------------------ | ------------------------------- |
| `findByEmail(email)`           | Find user by email              |
| `findByUuid(uuid)`             | Find user by UUID               |
| `create(data)`                 | Create new email user           |
| `updateEmailVerified(uuid)`    | Mark email as verified          |
| `updateStatus(uuid, status)`   | Change user status              |
| `updateCountry(uuid, country)` | Set country, status → ACTIVE    |
| `updatePassword(uuid, hash)`   | Update password hash            |
| `findByGoogleId(id)`           | Find user by Google ID          |
| `mergeGoogleAccount(uuid, id)` | Link Google to existing account |
| `createGoogleUser(data)`       | Create new Google-only user     |

### 4.3 OtpModule — OTP Lifecycle

| Method                    | Purpose                                      |
| ------------------------- | -------------------------------------------- |
| `generateOtp()`           | Cryptographically random 6-digit code        |
| `storeOtp(email, otp)`    | Hash with bcrypt-12, store in DB, 10-min TTL |
| `verifyOtp(email, otp)`   | Compare against hash, track attempts (max 3) |
| `deleteOtp(email)`        | Mark existing OTPs as used                   |
| `isOtpBlocked(email)`     | Check if max attempts reached                |
| `checkResendLimit(email)` | In-memory rate limit: 3 per hour             |

### 4.4 MailModule — Pluggable Email

Uses the **Strategy Pattern**:

```
MAIL_PROVIDER=mock   → MockEmailService   (logs to console, writes OTP to test-otp.txt)
MAIL_PROVIDER=resend → ResendEmailService  (sends real emails via Resend API)
```

All email sends are **fire-and-forget** — they never block the API response.

### 4.5 AuditModule — Security Trail

Every important action gets logged to the `audit_logs` table:

```
USER_SIGNUP, EMAIL_VERIFIED, USER_LOGIN, USER_LOGOUT,
OTP_RESENT, PROFILE_COMPLETED, PASSWORD_RESET_REQUESTED,
PASSWORD_RESET_COMPLETED, PASSWORD_SET_FOR_GOOGLE_USER,
GOOGLE_LOGIN_RETURNING, GOOGLE_LOGIN_MERGE, GOOGLE_LOGIN_NEW
```

Also fire-and-forget — never blocks the caller.

---

## 5. Authentication Flow — Step by Step

### Flow 1: Email Signup → Verify → Login

```mermaid
sequenceDiagram
    participant User
    participant API
    participant DB
    participant Email

    Note over User,Email: STEP 1 — SIGNUP
    User->>API: POST /auth/signup {fullName, email, password}
    API->>DB: Check if email exists (MUST NOT)
    API->>DB: Create user (status: REGISTERED)
    API->>DB: Store hashed OTP (10-min TTL)
    API-->>Email: Fire-and-forget: Send OTP email
    API-->>User: { message: "Check your email for OTP" }

    Note over User,Email: STEP 2 — VERIFY EMAIL
    User->>API: POST /auth/verify-email-otp {email, otp}
    API->>DB: Verify OTP (bcrypt compare, max 3 attempts)
    API->>DB: Update user: emailVerified=true, status=EMAIL_VERIFIED
    API->>DB: If no country → status=PROFILE_INCOMPLETE
    API->>DB: Generate JWT + UUID refresh token
    API->>DB: Store session (hashed refresh token)
    API-->>User: { accessToken, needsCountry: true, user }
    Note right of User: Refresh token set as HttpOnly cookie

    Note over User,Email: STEP 3 — COMPLETE PROFILE (if needed)
    User->>API: POST /auth/complete-profile {country: "IN"}
    Note right of API: Protected by JwtAuthGuard
    API->>DB: Validate country code against ISO list
    API->>DB: Update country, status → ACTIVE
    API-->>Email: Fire-and-forget: Send welcome email
    API-->>User: { message: "Profile completed successfully" }

    Note over User,Email: STEP 4 — LOGIN (next time)
    User->>API: POST /auth/login {email, password}
    API->>DB: Find user, check status (not REGISTERED, not SUSPENDED)
    API->>DB: bcrypt.compare password
    API->>DB: Generate new JWT + refresh token
    API->>DB: Store session
    API-->>User: { accessToken, user }
```

### Flow 2: Google OAuth

```mermaid
sequenceDiagram
    participant User
    participant API
    participant Google
    participant DB

    User->>API: GET /auth/google
    API->>Google: Redirect to Google consent screen
    Google-->>User: User grants permission
    Google->>API: GET /auth/google/callback?code=xxx
    API->>Google: Exchange code for profile data

    alt Returning Google User
        API->>DB: Find by googleId → EXISTS
        API->>DB: Issue tokens, create session
    else Existing Email User (Auto-Merge)
        API->>DB: Find by email → EXISTS (but no googleId)
        API->>DB: Add googleId to existing account
        API->>DB: Issue tokens, create session
    else Brand New User
        API->>DB: Create user (authProvider: GOOGLE, emailVerified: true)
        API->>DB: If no country → PROFILE_INCOMPLETE
        API->>DB: Issue tokens, create session
    end

    API-->>User: Redirect to frontend with accessToken in URL
    Note right of User: Refresh token set as HttpOnly cookie
```

### Flow 3: Token Refresh (Silent re-auth)

```
1. Frontend's access token expires (15 min)
2. Frontend calls POST /auth/refresh (sends refresh_token cookie automatically)
3. Server extracts tokenId (first 16 chars) → O(1) DB lookup
4. Verifies full token via bcrypt.compare
5. Deletes old session (ROTATION — one-time use)
6. Creates brand new token pair + session
7. Returns new access token + sets new refresh cookie
```

### Flow 4: Forgot/Reset Password

```
1. POST /auth/forgot-password {email} → Sends OTP (rate limited: 3/hour)
2. POST /auth/reset-password {email, otp, newPassword}
   → Verifies OTP → Updates password hash → Deletes ALL sessions (force re-login)
```

---

## 6. Database & Prisma Migrations

### What is a Migration?

> A migration is a **version-controlled change to your database schema**. Think of it as a Git commit, but for your database structure.

**Why do we need migrations?**

| Without Migrations                           | With Migrations                          |
| -------------------------------------------- | ---------------------------------------- |
| "Hey, can you run this SQL on your machine?" | Everyone runs the same migration command |
| "My DB is different from production!"        | DB schema is identical everywhere        |
| "What changed since last week?"              | Check the migration history folder       |
| "I broke the DB, how do I go back?"          | Roll back the migration                  |

### Your Migration History

| #   | Migration                         | What Changed                                       |
| --- | --------------------------------- | -------------------------------------------------- |
| 1   | `20260227060658_init`             | Created all 4 tables, enums, indexes, foreign keys |
| 2   | `20260227061512_add_otp_attempts` | Added `attempts` column to `email_otps`            |
| 3   | `20260303072905_add_google_oauth` | Added `googleId`, `authProvider` to `users`        |

### How to Run Migrations

#### Scenario 1: You just cloned the project (first time setup)

```bash
# Step 1: Install dependencies
npm install

# Step 2: Make sure .env has correct DATABASE_URL
# DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/nsi_db

# Step 3: Run all existing migrations
npx prisma migrate deploy

# Step 4: Generate Prisma Client (TypeScript types)
npx prisma generate
```

#### Scenario 2: You changed the Prisma schema (adding a feature)

```bash
# Step 1: Edit prisma/schema.prisma (e.g., add a new field)

# Step 2: Create a new migration
npx prisma migrate dev --name describe_your_change
# Example: npx prisma migrate dev --name add_phone_number_to_users

# This does 3 things:
# 1. Generates a new SQL migration file in prisma/migrations/
# 2. Runs that SQL against your database
# 3. Regenerates Prisma Client with new types
```

#### Scenario 3: You pulled code that has new migrations

```bash
# Step 1: Pull latest code
git pull

# Step 2: Apply any new migrations
npx prisma migrate deploy

# Step 3: Regenerate Prisma Client (types might have changed)
npx prisma generate
```

#### Scenario 4: Reset everything (nuclear option — dev only!)

```bash
# WARNING: This DELETES all data!
npx prisma migrate reset
# Creates fresh DB → runs ALL migrations → runs seed (if any)
```

### Key Prisma Commands

| Command                     | What it Does                       | When to Use                         |
| --------------------------- | ---------------------------------- | ----------------------------------- |
| `npx prisma migrate dev`    | Create + apply migration (dev)     | After editing `schema.prisma`       |
| `npx prisma migrate deploy` | Apply pending migrations (prod)    | After `git pull` or first setup     |
| `npx prisma migrate reset`  | Drop DB + re-run all migrations    | When DB is in bad state (dev only)  |
| `npx prisma generate`       | Regenerate TypeScript client       | After any schema change             |
| `npx prisma studio`         | Open visual DB browser             | Debug/inspect data                  |
| `npx prisma db push`        | Push schema without migration file | Quick prototyping (not recommended) |

### How Migration Files Look

```sql
-- prisma/migrations/20260303072905_add_google_oauth/migration.sql

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('EMAIL', 'GOOGLE');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "authProvider" "AuthProvider" NOT NULL DEFAULT 'EMAIL';
ALTER TABLE "users" ADD COLUMN "googleId" TEXT;
ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");
```

---

## 7. Testing After Migrations

### Step 1: Verify Migration Applied

```bash
# Check migration status
npx prisma migrate status

# Expected output:
# 3 migrations found in prisma/migrations
# 3 migrations have been applied
# Database schema is up to date ✓
```

### Step 2: Open Prisma Studio (Visual Check)

```bash
npx prisma studio
# Opens http://localhost:5555 in your browser
# You can see all tables, their columns, and browse data
```

### Step 3: Start the Dev Server

```bash
npm run start:dev
# Watch for:
# ✓ "🚀 NSI Platform API running on port 3000"
# ✗ Any Prisma errors about missing columns = migration not applied
```

### Step 4: Test with Postman/curl

**Test Signup:**

```bash
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Test User","email":"test@example.com","password":"password123"}'
```

**Expected:** `{ "message": "Registration successful. Check your email for OTP." }`

**Get OTP (dev mode):** Read `test-otp.txt` file or check console logs.

**Test Verify OTP:**

```bash
curl -X POST http://localhost:3000/api/v1/auth/verify-email-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","otp":"123456"}'
```

### Step 5: Run Automated Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Tests with coverage report
npm run test:cov
```

### Step 6: After Adding a New Column/Table

If you've added a new field to `schema.prisma`:

```
1. npx prisma migrate dev --name add_field_name     ← Creates migration
2. npm run start:dev                                  ← Restart server
3. Test the endpoint that uses the new field          ← Verify
4. npm run test                                       ← Run tests
5. Commit both schema.prisma AND migration folder     ← Git commit
```

> [!IMPORTANT]
> **Always commit the `prisma/migrations/` folder to Git!** Your teammates need these files to keep their databases in sync.

---

## 8. API Endpoints Reference

All endpoints are prefixed with `/api/v1/`.

| #   | Method | Endpoint                 | Auth?     | Rate Limit | Description                   |
| --- | ------ | ------------------------ | --------- | ---------- | ----------------------------- |
| 1   | POST   | `/auth/signup`           | ❌        | 5/15min    | Create account + send OTP     |
| 2   | POST   | `/auth/verify-email-otp` | ❌        | 10/15min   | Verify OTP + auto-login       |
| 3   | POST   | `/auth/complete-profile` | ✅ JWT    | —          | Set country → ACTIVE          |
| 4   | POST   | `/auth/login`            | ❌        | 10/15min   | Email + password login        |
| 5   | POST   | `/auth/resend-otp`       | ❌        | 3/hour     | Resend verification OTP       |
| 6   | POST   | `/auth/refresh`          | 🍪 Cookie | —          | Rotate refresh token          |
| 7   | POST   | `/auth/logout`           | 🍪 Cookie | —          | Delete session + clear cookie |
| 8   | POST   | `/auth/forgot-password`  | ❌        | 3/hour     | Send password reset OTP       |
| 9   | POST   | `/auth/reset-password`   | ❌        | 5/15min    | Verify OTP + reset password   |
| 10  | GET    | `/auth/google`           | ❌        | —          | Redirect to Google login      |
| 11  | GET    | `/auth/google/callback`  | ❌        | —          | Google OAuth callback         |
| 12  | POST   | `/auth/set-password`     | ✅ JWT    | —          | Set password (Google users)   |

---

## 9. Cheat Sheet

### Daily Development Commands

```bash
# Start dev server (hot-reload)
npm run start:dev

# Check database
npx prisma studio

# Apply migrations after git pull
npx prisma migrate deploy && npx prisma generate

# Create new migration
npx prisma migrate dev --name my_change_description

# Reset DB (dev only!)
npx prisma migrate reset

# Run tests
npm run test
npm run test:e2e

# Lint & format
npm run lint
npm run format

# Build for production
npm run build
npm run start:prod
```

### Environment Variables Quick Reference

| Variable                   | Purpose                      | Example                                             |
| -------------------------- | ---------------------------- | --------------------------------------------------- |
| `DATABASE_URL`             | PostgreSQL connection string | `postgresql://user:pass@host:5432/db`               |
| `JWT_SECRET`               | Secret for signing JWTs      | Min 32 chars, random string                         |
| `JWT_EXPIRES_IN`           | Access token lifetime        | `15m`                                               |
| `REFRESH_TOKEN_EXPIRES_IN` | Refresh token lifetime       | `7d`                                                |
| `MAIL_PROVIDER`            | Email service                | `mock` or `resend`                                  |
| `GOOGLE_CLIENT_ID`         | Google OAuth client ID       | From Google Cloud Console                           |
| `GOOGLE_CLIENT_SECRET`     | Google OAuth secret          | From Google Cloud Console                           |
| `GOOGLE_CALLBACK_URL`      | Google callback URL          | `http://localhost:3000/api/v1/auth/google/callback` |
| `FRONTEND_URL`             | Frontend app URL (CORS)      | `http://localhost:3001`                             |

### Architecture Decision Log

| Decision                                   | Reason                                                              |
| ------------------------------------------ | ------------------------------------------------------------------- |
| JWT payload is a "routing hint" only       | DB is the single source of truth; prevents stale role/status        |
| Guards always re-fetch from DB             | Security — JWT claims can be outdated                               |
| Refresh tokens are one-time use (rotation) | If a token is stolen, the real user's next refresh fails → detected |
| tokenId = first 16 chars of UUID           | O(1) session lookup instead of scanning all sessions                |
| OTPs hashed with bcrypt-12                 | Even if DB is leaked, OTPs can't be reversed                        |
| Emails are fire-and-forget                 | Never blocks response; failures logged, not thrown                  |
| Country required before ACTIVE             | Onboarding completeness enforcement                                 |
| `@Global()` PrismaModule                   | Every module needs DB, no repetitive imports                        |
