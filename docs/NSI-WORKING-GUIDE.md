# NSI Platform — Working Guide

> **Purpose:** This document explains exactly how Mihir and Claude work together on the NSI Platform. A new Claude chat session reads this alongside the Master Context to understand our process, rules, behaviour, and common patterns.

> **Version:** 1.0 | **Generated:** April 2026

---

## 1. How We Work Together

### The Three Tools

| Tool | Used For |
|------|---------|
| **Claude.ai** | Planning, architecture decisions, writing Antigravity prompts, reviewing code output, generating/verifying documentation |
| **Antigravity (Claude Code)** | Implementing backend code — services, controllers, DTOs, migrations |
| **Codex** | Generating and updating Word documents (.docx) and markdown files |

### The Golden Rule
**Claude.ai plans and verifies. Antigravity builds. Codex documents.**

Never use Antigravity for planning decisions — always plan in Claude.ai first.
Never use Claude.ai to write code directly into files — always write an Antigravity prompt.

---

## 2. Development Process — Every Module

### Step 1 — Plan in Claude.ai
- Describe the feature to Claude
- Ask clarifying questions using the ask_user_input tool
- Lock in all decisions before writing a single line of code
- Claude identifies edge cases and loopholes before prompting

### Step 2 — Write Antigravity Prompt
- Claude writes the complete implementation prompt
- Prompt includes: context, models, DTOs, service methods, endpoints, validation rules, after-implementation checks
- Always include the 3 verification commands at the end of every prompt

### Step 3 — Antigravity Implements
- Paste the prompt into Antigravity
- Antigravity reads existing files, implements, fixes errors
- Do not interrupt or modify while running

### Step 4 — Run the 3 Checks (HARD GATES)
```bash
npx tsc --noEmit        # must be zero errors
npm test                # must be 75/75 passing
npm run start:dev       # must start clean, all routes mapped
```

### Step 5 — Report Back to Claude.ai
- Paste the server boot log
- Claude verifies all expected routes are mapped
- Claude flags any issues before proceeding

### Step 6 — Push to GitHub
```bash
git add .
git commit -m "feat(module): description of what was built"
git push
```

### Step 7 — Generate Frontend Documentation
- Claude writes the frontend guide content
- Codex generates the .docx file
- A second AI verifies the doc against the actual backend source
- Claude reviews the verification report and corrects any errors
- Final corrected doc is handed to Mihir (frontend developer)

### Step 8 — Move to Next Module
Only after all checks pass and docs are verified.

---

## 3. Hard Gates — Never Skip These

These are non-negotiable before moving to the next feature:

| Gate | Command | Required Result |
|------|---------|----------------|
| TypeScript check | `npx tsc --noEmit` | Zero errors — not one |
| Tests | `npm test` | 75/75 passing — not one failure |
| Server start | `npm run start:dev` | Clean boot, all routes mapped |

**If any gate fails:** Fix it before moving forward. Never proceed with errors.

---

## 4. How We Write Antigravity Prompts

### Structure of Every Good Prompt

````
1. Opening — What are we building and in what project context
2. Context — Key rules (UUID, no raw SQL, fire-and-forget emails, etc.)
3. Step N — Prisma schema changes (if any)
4. Step N — DTOs with full class-validator decorators
5. Step N — Service methods with exact response shapes in JSON
6. Step N — Controller endpoints with auth guards
7. Step N — Module registration
8. After Implementation — The 3 checks in exact order
````

### What to Always Include
- All IDs are UUID v4
- No raw SQL — Prisma only
- Zero TypeScript errors required
- All existing N tests must still pass
- Fire-and-forget for all emails
- Amounts stored in rupees in DB, sent in paise to Razorpay
- Mock mode behaviour (PAYMENT_PROVIDER=mock)
- Exact response shapes in JSON format
- Security rules (who can see what)
- Route registration order when conflicts are possible

### What Makes a Prompt Fail
- Vague response shapes ("return the user object")
- Missing security checks ("verify this belongs to the current user")
- Missing route order warnings (static routes must come before :uuid routes)
- Not specifying mock mode behaviour
- Not telling Antigravity which existing files to read first

### Route Conflict Pattern (CRITICAL)
Always register static routes BEFORE parameterised routes:
````
GET /distributor/users/analytics   ← MUST be first
GET /distributor/users             ← second
GET /distributor/users/:uuid       ← last
````
If :uuid comes first, NestJS treats "analytics" as a uuid and routes incorrectly.

---

## 5. Common Errors and Fixes

### Error 1 — Prisma DLL Lock (Windows)
````
EPERM: operation not permitted, unlink '...query_engine-windows.dll.node'
````
**Cause:** Dev server is running and locking the Prisma DLL.
**Fix:**
```bash
# Stop dev server first, then:
npx prisma generate
# If still locked, use:
npx prisma generate --no-engine
# Then restart dev server
npm run start:dev
```

### Error 2 — RolesGuard Dependency Injection
````
Nest can't resolve dependencies of the RolesGuard (Reflector, ?).
Please make sure that UsersService is available in the DistributorModule context.
````
**Cause:** RolesGuard injects UsersService but the module doesn't import UsersModule.
**Fix:** Add UsersModule to the imports array of the failing module:
```typescript
@Module({
  imports: [UsersModule, PrismaModule, MailModule],
  ...
})
```

### Error 3 — Route Conflict (static vs param)
**Symptom:** GET /distributor/users/analytics returns 404 or treats "analytics" as a uuid.
**Cause:** GET /distributor/users/:uuid was registered before GET /distributor/users/analytics.
**Fix:** Always register static routes first in the controller.

### Error 4 — Prisma Unique Constraint on Re-subscribe
**Symptom:** Prisma throws P2002 unique constraint violation when re-subscribing.
**Cause:** DistributorSubscription has userUuid @unique — can't create second record.
**Fix:** Use upsert instead of create on re-subscribe.

### Error 5 — TypeScript errors after Prisma migration
**Symptom:** tsc errors referencing new model fields that don't exist in types.
**Cause:** Prisma client not regenerated after schema change.
**Fix:**
```bash
npx prisma generate
npx tsc --noEmit
```

### Error 6 — Test failures after adding new mail methods
**Symptom:** Tests fail because MockMailProvider doesn't implement new interface methods.
**Cause:** New methods added to mail interface but not to mock provider.
**Fix:** Add stub implementations to mock.provider.ts for every new method in the interface.

---

## 6. Document Verification Process

We NEVER hand a generated document directly to Mihir (frontend) without verification.

### Process:
1. Claude writes frontend guide content
2. Codex generates the .docx file
3. A second AI (Antigravity or another Claude session) reads the actual backend source files and verifies every claim in the document
4. Verification report is pasted into Claude.ai
5. Claude reviews all discrepancies
6. Claude writes a correction prompt for Codex
7. Codex updates the document
8. Final document is verified once more before handing to Mihir

### Common documentation errors caught in verification:
- Wrong endpoint paths (e.g. /join/:code vs /distributor/join/:code)
- Response shapes that don't match actual service return values
- Statuses that exist in enum but are never emitted (GRACE)
- Admin-only endpoints incorrectly documented as user-accessible
- Missing endpoints (admin distributor link management)
- Incorrect response shapes for simple operations (deactivate plan)

---

## 7. GitHub Commit Message Standards

### Format:
````
type(scope): short description

- bullet point detail 1
- bullet point detail 2
````

### Types:
- `feat` — new feature
- `fix` — bug fix
- `chore` — cleanup, gitignore, dependency updates
- `docs` — documentation only

### Examples:
````
feat(distributor): add user management endpoints

- GET /distributor/users/analytics — funnel dropoff + lead stats
- GET /distributor/users — paginated list with search + funnel stage filter
- GET /distributor/users/:uuid — full user detail with funnel, payments, LMS, activity log
- Security: distributor only sees Lead.distributorUuid = own uuid
````

````
chore: clean up repository

- Remove email-previews, test scratch files, generated folders from Git tracking
- Update .gitignore
````

---

## 8. Splitting Work Between Claude.ai and Codex

### Use Claude.ai for:
- All planning and decision making
- Writing Antigravity prompts
- Reviewing boot logs and test results
- Identifying bugs and edge cases
- Writing document content (sections, rules, response shapes)
- Verifying document accuracy

### Use Codex for:
- Generating .docx files from Claude's content
- Updating existing .docx files
- Creating/updating markdown files
- Any file writing task

### Why split this way:
Claude.ai has context limits that get consumed quickly with large documents. Codex handles file generation without consuming Claude's context window, allowing Claude to focus on thinking and planning.

---

## 9. How to Start a New Chat Session

When starting a fresh Claude.ai chat in the NSI project:

1. The project automatically provides NSI-MASTER-CONTEXT-v4.md and NSI-WORKING-GUIDE.md
2. No need to re-explain the project — Claude reads the context files
3. Start directly with what you want to do:
   - "Let's build the Admin APIs frontend documentation"
   - "I want to add a new feature to the distributor module"
   - "There's an error in the boot log — [paste error]"

### What Claude will do automatically:
- Reference the master context for current module status
- Apply the working guide process
- Run through edge cases before writing prompts
- Always ask clarifying questions using buttons before writing code prompts

---

## 10. Decision Making Process

### When building a new feature, Claude always:
1. Asks clarifying questions with button choices (never open-ended)
2. Presents industry standards and makes a recommendation
3. Identifies loopholes and edge cases before writing the prompt
4. Reviews the complete plan with Mihir before prompting
5. Writes a "perfect" prompt — not iterative, one complete implementation

### Questions Claude always asks before writing a prompt:
- Who can access this? (auth level)
- What data should/should not be exposed?
- What are the edge cases? (re-subscribe, null records, duplicate requests)
- What happens on error?
- Are there any security boundaries? (scoping, ownership checks)
- Is there a mock mode needed?

---

## 11. Frontend Documentation Standards

Every frontend guide must include:
- Complete verified endpoint table with method, path, auth, description
- Full request body shapes for POST/PATCH endpoints
- Full response shapes with real field names and types
- All error responses with HTTP codes and messages
- Field computation rules (what the backend calculates vs frontend)
- Frontend implementation rules (what to do with the data)
- Pages to build checklist
- Key rules section

Every frontend guide must NOT include:
- Endpoints that don't exist in the backend
- Response shapes that don't match actual service returns
- Statuses that are never emitted
- Admin-only endpoints documented as user-accessible
- Assumptions about data that aren't verified

---

*Working Guide version: 1.0 | Generated: April 2026*
