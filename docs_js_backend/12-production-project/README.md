# Module 12: Production Project — Building a SaaS from Scratch

> **"This is where everything comes together."**
>
> Welcome to the capstone. You're not learning concepts anymore — you're building **TeamTask Pro**, a production-ready team task management SaaS. By the end of this module, you'll have a complete application architecture that could serve real users.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Decisions](#2-architecture-decisions)
3. [Guided Exercise: 5-Week Build Plan](#3-guided-exercise-5-week-build-plan)
4. [Project Structure](#4-project-structure)
5. [Database Schema](#5-database-schema)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Multi-Tenant Architecture](#7-multi-tenant-architecture)
8. [Projects & Tasks](#8-projects--tasks)
9. [Real-Time Notifications (SSE)](#9-real-time-notifications-sse)
10. [File Attachments](#10-file-attachments)
11. [Activity Logs](#11-activity-logs)
12. [Admin Dashboard](#12-admin-dashboard)
13. [OpenAPI Documentation](#13-openapi-documentation)
14. [Testing Strategy](#14-testing-strategy)
15. [AI/LLM Integration](#15-aillm-integration)
16. [Docker Setup](#16-docker-setup)
17. [CI/CD Pipeline](#17-cicd-pipeline)
18. [Deployment Guide](#18-deployment-guide)
19. [Environment Variables](#19-environment-variables)
20. [Step-by-Step Setup](#20-step-by-step-setup)
21. [Deployment Checklist](#21-deployment-checklist)

---

## 1. Project Overview

### TeamTask Pro

A team task management SaaS application where organizations can:

- Create teams/organizations
- Invite members with role-based permissions
- Manage projects with tasks, assignments, and deadlines
- Receive real-time updates via SSE
- Upload file attachments to S3-compatible storage
- View comprehensive activity logs
- Access admin dashboards for organization management

### Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Runtime | Node.js 20 LTS | Stable, long-term support |
| Framework | Express 5.x | Native async/await, mature ecosystem |
| Database | PostgreSQL 16 | ACID compliance, JSONB, full-text search |
| ORM | Prisma 5.x | Type safety, excellent migrations, DX |
| Cache/Queue | Redis 7 | Sessions, BullMQ, caching, SSE pub/sub |
| Real-Time | SSE (Server-Sent Events) | Simpler than WebSockets for unidirectional updates |
| Storage | S3-compatible (MinIO/AWS) | Scalable file storage |
| Auth | JWT + Refresh Tokens | Stateless, scalable |
| OAuth | Google + GitHub | Third-party identity providers |
| Testing | Vitest + Supertest | Fast, native ESM, type-safe |
| Documentation | OpenAPI 3.1 + Scalar | Auto-generated, interactive docs |
| Deployment | Docker + PM2 | Consistent environments, clustering |

---

## 2. Architecture Decisions

### 2.1 Why PostgreSQL + Redis (Not MongoDB Alone)

From the database research:

> "Modern Express backends rarely use a single database. The architecture typically uses PostgreSQL as the system of record (SSOT) and Redis for caching and sessions."

| Requirement | PostgreSQL | MongoDB |
|-------------|-----------|---------|
| Multi-tenant data isolation | Row-level security, schemas | Manual tenant filtering |
| Complex relationships | Native JOINs, foreign keys | Application-level joins |
| Task assignments & hierarchies | Recursive CTEs | Limited aggregation |
| Activity logs (time-series) | TimescaleDB extension | Less mature |
| JSON metadata | JSONB with indexing | Native but slower |
| ACID transactions | Full support | Limited multi-doc |

**Redis handles:**
- Session storage (`connect-redis`)
- Background job queues (BullMQ)
- Real-time pub/sub for SSE
- Rate limiting counters
- Cache layer

### 2.2 Why Prisma (Not Raw SQL or Sequelize)

From the database research benchmarks:

| ORM | Type Safety | Migrations | Performance | Active Dev |
|-----|-------------|------------|-------------|------------|
| Prisma | Full (generated) | Excellent | ~1.2x raw | Very active |
| Sequelize | Weak (manual) | Good | ~1.8x raw | Stable, legacy |
| Drizzle | Full (inference) | Good | ~1.1x raw | Very active |
| TypeORM | Partial | Good | ~1.5x raw | Slowing |

**Prisma wins because:**
- Generated TypeScript types eliminate entire classes of bugs
- Declarative migrations with shadow database drift detection
- Excellent relation queries with automatic batching
- Prisma Client Extensions for cross-cutting concerns

### 2.3 Why SSE Over WebSockets (For This Use Case)

From the API architecture research:

| Feature | WebSockets | SSE |
|---------|-----------|-----|
| Direction | Bidirectional | Server→Client |
| Complexity | High (reconnection, heartbeat) | Low (auto-reconnect) |
| Scaling | Requires sticky sessions + pub/sub | Standard HTTP, easy to scale |
| Use case | Chat, collaborative editing | Notifications, feeds, progress |

**TeamTask Pro needs:**
- Server → Client notifications only (new task assigned, comment added)
- Simple integration with Redis pub/sub
- Works through corporate proxies
- No need for client→server messaging (use HTTP POST)

### 2.4 Why Repository Pattern (Testability)

From the testing research:

> "Extract business logic from route handlers. Route handlers should be thin orchestrators. Test the service layer in unit tests, not via HTTP calls."

Repository pattern enables:
- Unit tests with in-memory fakes (no database needed)
- Parallel test execution (no shared state)
- Database swap without touching business logic
- Centralized query optimization

### 2.5 Why Docker Multi-Stage Build (Security + Size)

From the deployment research:

> "A typical Node.js Dockerfile has a build stage and a production stage... Dramatically smaller final image (no build tools, no devDependencies). Reduced attack surface (fewer packages = fewer CVEs)."

### 2.6 Why PM2 Clustering (CPU Utilization)

From the deployment research:

> "On an 8-core server, a single Node.js process uses only 12.5% of CPU capacity. Clustering can increase throughput by 6-8x on multi-core machines."

---

## 3. Guided Exercise: 5-Week Build Plan

This is not just a reference — it's a guided exercise. Build TeamTask Pro over 5 weeks, one phase at a time.

### Phase 1: Setup & Auth (Week 1)

**Goal:** A working TypeScript Express server with user registration, login, and JWT authentication.

**Deliverables:**
- [ ] TypeScript + ESM project setup with pnpm
- [ ] Docker Compose with PostgreSQL and Redis
- [ ] Prisma schema for `User` and `RefreshToken`
- [ ] Register endpoint with Argon2id hashing
- [ ] Login endpoint with JWT access + refresh tokens
- [ ] Token refresh endpoint with rotation
- [ ] Zod validation on all inputs
- [ ] Rate limiting on auth endpoints
- [ ] Health check at `/health`

**Stretch goal:** Add OAuth 2.1 with Google login.

> **Alternative:** Instead of building auth from scratch, integrate Clerk and skip to Phase 2. See [Managed Auth Alternative](#managed-auth-alternative).

### Phase 2: Organizations & Projects (Week 2)

**Goal:** Multi-tenant organizations with role-based permissions and project management.

**Deliverables:**
- [ ] `Organization` and `OrganizationMember` models
- [ ] Create organization endpoint
- [ ] Invite member endpoint (by email)
- [ ] RBAC middleware (`OWNER`, `ADMIN`, `MEMBER`)
- [ ] `Project` CRUD within an organization
- [ ] Tenant isolation middleware (all queries scoped to `organization_id`)
- [ ] Seed script with sample data

**Stretch goal:** Add organization slugs for pretty URLs.

### Phase 3: Tasks & Real-Time (Week 3)

**Goal:** Full task management with real-time updates via SSE.

**Deliverables:**
- [ ] `Task` model with status, priority, assignments
- [ ] Task CRUD within projects
- [ ] Task assignment with notifications
- [ ] SSE endpoint for organization events
- [ ] Redis pub/sub for multi-instance SSE
- [ ] Activity log service (log every create/update/delete)

**Stretch goal:** Add comment threads on tasks.

### Phase 4: File Uploads & Admin (Week 4)

**Goal:** File attachments, admin dashboard, and background jobs.

**Deliverables:**
- [ ] S3/MinIO integration for file storage
- [ ] File upload endpoint with type validation
- [ ] Pre-signed URL generation for downloads
- [ ] Admin dashboard endpoints (platform stats)
- [ ] Background email queue with BullMQ
- [ ] Password reset flow via email

**Stretch goal:** Add bulk task import via CSV.

### Phase 5: Testing & Deployment (Week 5)

**Goal:** Production-ready with tests, Docker, and deployment.

**Deliverables:**
- [ ] Unit tests for services (mocked repositories)
- [ ] Integration tests for API endpoints
- [ ] Docker multi-stage build (`node:20-slim`)
- [ ] Docker Compose for local development
- [ ] GitHub Actions CI pipeline
- [ ] Deploy to Railway/Render/Fly.io
- [ ] Post-deployment smoke tests

**Stretch goal:** Add AI-powered task suggestions (see [AI/LLM Integration](#15-aillm-integration)).

### How to Use This Plan

1. **Don't skip phases.** Each phase builds on the previous.
2. **Time-box each week.** If you're behind, cut scope, not quality.
3. **Commit after each deliverable.** Your Git history should tell the story.
4. **Write notes.** Keep a `NOTES.md` with decisions, bugs, and lessons.
5. **Share your progress.** Post screenshots. Teaching reinforces learning.

---

## 4. Project Structure

```
teamtask-pro/
├── docker/
│   ├── Dockerfile
│   ├── Dockerfile.prod
│   └── docker-compose.yml
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── config/
│   │   ├── env.ts              # Validated environment variables
│   │   ├── container.ts        # DI composition root
│   │   ├── prisma.ts           # Prisma client singleton
│   │   └── redis.ts            # Redis connection
│   ├── domain/
│   │   ├── entities/           # Domain entities (types)
│   │   ├── events/             # Domain events
│   │   └── errors/             # Domain errors
│   ├── middleware/
│   │   ├── auth.ts             # JWT + OAuth middleware
│   │   ├── rbac.ts             # Role-based access control
│   │   ├── tenant.ts           # Multi-tenant isolation
│   │   ├── error-handler.ts    # Global error handler
│   │   ├── rate-limiter.ts     # Rate limiting
│   │   ├── validate.ts         # Zod validation
│   │   └── sse.ts              # SSE middleware
│   ├── repositories/
│   │   ├── interfaces/
│   │   └── prisma/
│   ├── services/
│   │   ├── interfaces/
│   │   ├── auth.service.ts
│   │   ├── user.service.ts
│   │   ├── organization.service.ts
│   │   ├── project.service.ts
│   │   ├── task.service.ts
│   │   ├── notification.service.ts
│   │   ├── activity.service.ts
│   │   └── storage.service.ts
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── user.controller.ts
│   │   ├── organization.controller.ts
│   │   ├── project.controller.ts
│   │   ├── task.controller.ts
│   │   ├── notification.controller.ts
│   │   ├── activity.controller.ts
│   │   └── admin.controller.ts
│   ├── routes/
│   │   ├── index.ts
│   │   ├── auth.routes.ts
│   │   ├── user.routes.ts
│   │   ├── organization.routes.ts
│   │   ├── project.routes.ts
│   │   ├── task.routes.ts
│   │   ├── notification.routes.ts
│   │   ├── activity.routes.ts
│   │   └── admin.routes.ts
│   ├── queues/
│   │   ├── email.queue.ts
│   │   └── notification.queue.ts
│   ├── workers/
│   │   ├── email.worker.ts
│   │   └── notification.worker.ts
│   ├── sse/
│   │   ├── broadcaster.ts
│   │   └── handlers.ts
│   ├── utils/
│   │   ├── crypto.ts
│   │   ├── pagination.ts
│   │   └── logger.ts
│   └── app.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── scripts/
│   ├── migrate.sh
│   └── seed-prod.ts
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── cd.yml
├── .env.example
├── .env.test
├── openapi.yaml
├── vitest.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## 5. Database Schema

### Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Users & Authentication ───

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String?  @map("password_hash")
  name          String?
  avatarUrl     String?  @map("avatar_url")
  emailVerified DateTime? @map("email_verified")
  
  // OAuth
  googleId      String?  @unique @map("google_id")
  githubId      String?  @unique @map("github_id")
  
  // Refresh tokens
  refreshTokens RefreshToken[]
  
  // Relations
  memberships   OrganizationMember[]
  createdTasks  Task[]     @relation("CreatedTasks")
  assignedTasks Task[]     @relation("AssignedTasks")
  comments      Comment[]
  activities    Activity[]
  notifications Notification[]
  attachments   Attachment[]
  
  createdAt     DateTime   @default(now()) @map("created_at")
  updatedAt     DateTime   @updatedAt @map("updated_at")
  
  @@map("users")
}

model RefreshToken {
  id        String   @id @default(cuid())
  tokenHash String   @map("token_hash")
  userId    String   @map("user_id")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  family    String   // Token family for rotation
  issuedAt  DateTime @default(now()) @map("issued_at")
  expiresAt DateTime @map("expires_at")
  revokedAt DateTime? @map("revoked_at")
  replacedBy String? @map("replaced_by")
  
  @@map("refresh_tokens")
}

// ─── Multi-Tenant Organizations ───

model Organization {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  description String?
  logoUrl     String?  @map("logo_url")
  
  // Billing
  plan        String   @default("free") // free, pro, enterprise
  
  // Relations
  members     OrganizationMember[]
  projects    Project[]
  activities  Activity[]
  
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  
  @@map("organizations")
}

model OrganizationMember {
  id             String       @id @default(cuid())
  organizationId String       @map("organization_id")
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  userId         String       @map("user_id")
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  role           MemberRole   @default(MEMBER)
  
  joinedAt       DateTime     @default(now()) @map("joined_at")
  
  @@unique([organizationId, userId])
  @@map("organization_members")
}

enum MemberRole {
  OWNER
  ADMIN
  MEMBER
}

// ─── Projects ───

model Project {
  id             String       @id @default(cuid())
  organizationId String       @map("organization_id")
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name           String
  description    String?
  color          String?      @default("#3b82f6")
  status         ProjectStatus @default(ACTIVE)
  
  // Relations
  tasks          Task[]
  activities     Activity[]
  
  createdAt      DateTime     @default(now()) @map("created_at")
  updatedAt      DateTime     @updatedAt @map("updated_at")
  
  @@map("projects")
}

enum ProjectStatus {
  ACTIVE
  ARCHIVED
  DELETED
}

// ─── Tasks ───

model Task {
  id          String     @id @default(cuid())
  projectId   String     @map("project_id")
  project     Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  title       String
  description String?
  status      TaskStatus @default(TODO)
  priority    Priority   @default(MEDIUM)
  
  // Assignments
  createdById String     @map("created_by_id")
  createdBy   User       @relation("CreatedTasks", fields: [createdById], references: [id])
  assignedToId String?   @map("assigned_to_id")
  assignedTo  User?      @relation("AssignedTasks", fields: [assignedToId], references: [id])
  
  // Scheduling
  dueDate     DateTime?  @map("due_date")
  completedAt DateTime?  @map("completed_at")
  
  // Relations
  comments    Comment[]
  attachments Attachment[]
  activities  Activity[]
  
  createdAt   DateTime   @default(now()) @map("created_at")
  updatedAt   DateTime   @updatedAt @map("updated_at")
  
  @@index([projectId, status])
  @@index([assignedToId, status])
  @@index([dueDate])
  @@map("tasks")
}

enum TaskStatus {
  TODO
  IN_PROGRESS
  IN_REVIEW
  DONE
  CANCELLED
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

// ─── Comments ───

model Comment {
  id        String   @id @default(cuid())
  taskId    String   @map("task_id")
  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  authorId  String   @map("author_id")
  author    User     @relation(fields: [authorId], references: [id])
  content   String
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  
  @@map("comments")
}

// ─── Attachments ───

model Attachment {
  id           String   @id @default(cuid())
  taskId       String   @map("task_id")
  task         Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  uploadedById String   @map("uploaded_by_id")
  uploadedBy   User     @relation(fields: [uploadedById], references: [id])
  
  fileName     String   @map("file_name")
  fileSize     Int      @map("file_size")
  mimeType     String   @map("mime_type")
  storageKey   String   @map("storage_key") // S3 key
  storageUrl   String   @map("storage_url")  // Pre-signed URL
  
  createdAt    DateTime @default(now()) @map("created_at")
  
  @@map("attachments")
}

// ─── Activity Logs ───

model Activity {
  id             String       @id @default(cuid())
  organizationId String       @map("organization_id")
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  projectId      String?      @map("project_id")
  project        Project?     @relation(fields: [projectId], references: [id])
  taskId         String?      @map("task_id")
  task           Task?        @relation(fields: [taskId], references: [id])
  
  actorId        String       @map("actor_id")
  actor          User         @relation(fields: [actorId], references: [id])
  
  action         String       // task.created, task.updated, comment.added
  entityType     String       @map("entity_type") // task, project, comment
  entityId       String       @map("entity_id")
  metadata       Json?        // Before/after state, changes
  
  createdAt      DateTime     @default(now()) @map("created_at")
  
  @@index([organizationId, createdAt])
  @@index([taskId, createdAt])
  @@map("activities")
}

// ─── Notifications ───

model Notification {
  id        String           @id @default(cuid())
  userId    String           @map("user_id")
  user      User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      NotificationType
  title     String
  body      String
  data      Json?            // Related entity IDs, URLs
  readAt    DateTime?        @map("read_at")
  createdAt DateTime         @default(now()) @map("created_at")
  
  @@index([userId, readAt, createdAt])
  @@map("notifications")
}

enum NotificationType {
  TASK_ASSIGNED
  TASK_COMPLETED
  COMMENT_ADDED
  MENTIONED
  PROJECT_INVITE
  DUE_DATE_REMINDER
}
```

---

## 6. Authentication & Authorization

### 5.1 JWT + Refresh Token Rotation

From the security research:

> "JWTs are not inherently secure; they are just signed/encoded blobs. The critical vulnerability is that a stolen JWT cannot be revoked until it expires."

**Implementation:**

```typescript
// services/auth.service.ts
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export class AuthService {
  constructor(
    private userRepository: UserRepository,
    private refreshTokenRepository: RefreshTokenRepository,
  ) {}

  createAccessToken(user: User): string {
    return jwt.sign(
      { sub: user.id, jti: crypto.randomUUID() },
      process.env.JWT_ACCESS_SECRET!,
      {
        expiresIn: '15m',
        issuer: 'teamtask-pro',
        audience: 'teamtask-pro-api',
      }
    );
  }

  async createRefreshToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(64).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const family = crypto.randomUUID();

    await this.refreshTokenRepository.create({
      userId,
      tokenHash,
      family,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    return token;
  }

  async rotateRefreshToken(incomingToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const incomingHash = crypto.createHash('sha256').update(incomingToken).digest('hex');
    const storedToken = await this.refreshTokenRepository.findByHash(incomingHash);

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Reuse detection
    if (storedToken.replacedBy) {
      await this.refreshTokenRepository.revokeFamily(storedToken.family);
      throw new UnauthorizedError('Token reuse detected');
    }

    const user = await this.userRepository.findById(storedToken.userId);
    if (!user) throw new UnauthorizedError('User not found');

    const accessToken = this.createAccessToken(user);
    const newRefreshToken = await this.createRefreshToken(user.id);
    const newRefreshHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');

    await this.refreshTokenRepository.update(storedToken.id, {
      replacedBy: newRefreshHash,
      usedAt: new Date(),
    });

    return { accessToken, refreshToken: newRefreshToken };
  }
}
```

### 5.2 OAuth (Google + GitHub)

```typescript
// routes/auth.routes.ts
import { generators, Issuer } from 'openid-client';

// Google OAuth
app.get('/v1/auth/google', (req, res) => {
  const state = generators.state();
  const nonce = generators.nonce();
  const codeVerifier = generators.codeVerifier();
  const codeChallenge = generators.codeChallenge(codeVerifier);

  req.session.oauth = { state, nonce, codeVerifier, provider: 'google' };

  const authorizationUrl = googleClient.authorizationUrl({
    scope: 'openid email profile',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    nonce,
  });

  res.redirect(authorizationUrl);
});

app.get('/v1/auth/google/callback', async (req, res) => {
  const params = googleClient.callbackParams(req);
  const { oauth } = req.session;

  if (params.state !== oauth.state) {
    return res.redirect('/login?error=invalid_state');
  }

  const tokenSet = await googleClient.callback(
    process.env.GOOGLE_REDIRECT_URI!,
    params,
    {
      code_verifier: oauth.codeVerifier,
      state: oauth.state,
      nonce: oauth.nonce,
    }
  );

  const claims = tokenSet.claims();
  
  // Find or create user
  let user = await userRepository.findByGoogleId(claims.sub);
  if (!user) {
    user = await userRepository.create({
      email: claims.email!,
      name: claims.name,
      googleId: claims.sub,
      emailVerified: claims.email_verified ? new Date() : null,
    });
  }

  const accessToken = authService.createAccessToken(user);
  const refreshToken = await authService.createRefreshToken(user.id);

  res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${accessToken}&refresh=${refreshToken}`);
});
```

### 5.3 Password Reset Flow

```typescript
// services/auth.service.ts
async requestPasswordReset(email: string): Promise<void> {
  const user = await this.userRepository.findByEmail(email);
  if (!user) return; // Don't reveal if email exists

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  await this.passwordResetRepository.create({
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
  });

  // Queue email (don't send synchronously)
  await emailQueue.add('password-reset', {
    to: user.email,
    resetUrl: `${process.env.FRONTEND_URL}/reset-password?token=${token}`,
  });
}

async resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const resetRecord = await this.passwordResetRepository.findValid(tokenHash);
  
  if (!resetRecord) throw new ValidationError('Invalid or expired token');

  const passwordHash = await argon2.hash(newPassword, {
    type: argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  await this.userRepository.update(resetRecord.userId, { passwordHash });
  await this.passwordResetRepository.revoke(tokenHash);
  await this.refreshTokenRepository.revokeAllForUser(resetRecord.userId);
}
```

### 5.4 RBAC Middleware

```typescript
// middleware/rbac.ts
export enum Permission {
  ORG_READ = 'org:read',
  ORG_UPDATE = 'org:update',
  ORG_DELETE = 'org:delete',
  PROJECT_CREATE = 'project:create',
  PROJECT_UPDATE = 'project:update',
  PROJECT_DELETE = 'project:delete',
  TASK_CREATE = 'task:create',
  TASK_UPDATE = 'task:update',
  TASK_DELETE = 'task:delete',
  MEMBER_INVITE = 'member:invite',
  MEMBER_REMOVE = 'member:remove',
}

const ROLE_PERMISSIONS: Record<MemberRole, Permission[]> = {
  [MemberRole.OWNER]: Object.values(Permission),
  [MemberRole.ADMIN]: [
    Permission.ORG_READ,
    Permission.ORG_UPDATE,
    Permission.PROJECT_CREATE,
    Permission.PROJECT_UPDATE,
    Permission.PROJECT_DELETE,
    Permission.TASK_CREATE,
    Permission.TASK_UPDATE,
    Permission.TASK_DELETE,
    Permission.MEMBER_INVITE,
    Permission.MEMBER_REMOVE,
  ],
  [MemberRole.MEMBER]: [
    Permission.ORG_READ,
    Permission.PROJECT_CREATE,
    Permission.PROJECT_UPDATE,
    Permission.TASK_CREATE,
    Permission.TASK_UPDATE,
  ],
};

export const requirePermission = (...permissions: Permission[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const membership = req.membership; // Set by tenant middleware
    
    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this organization' });
    }

    const userPermissions = ROLE_PERMISSIONS[membership.role];
    const hasPermission = permissions.every(p => userPermissions.includes(p));

    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

```typescript
// middleware/rate-limiter.ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../config/redis';

export const generalLimiter = rateLimit({
  store: new RedisStore({ client: redis, prefix: 'rl:general:' }),
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  store: new RedisStore({ client: redis, prefix: 'rl:auth:' }),
  windowMs: 60 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
});
```

```typescript
// middleware/validate.ts
import { z, ZodError } from 'zod';
import { Request, Response, NextFunction } from 'express';

export const validate = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: err.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(err);
    }
  };
};

// Example route usage
export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedToId: z.string().cuid().optional(),
  dueDate: z.coerce.date().optional(),
});
```
```

---

### Managed Auth Alternative: Clerk

> **Instead of building auth from scratch, you could use Clerk.**
>
> Clerk provides drop-in authentication with:
> - Email/password, social login, and passwordless
> - Session management and token refresh
> - Role-based access control
> - Beautiful pre-built UI components
> - Webhooks for syncing users to your database
>
> ```typescript
> // Using Clerk instead of custom JWT
> import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';
>
> app.use('/api', ClerkExpressRequireAuth());
>
> app.get('/api/me', (req, res) => {
>   res.json({ userId: req.auth.userId });
> });
> ```
>
> **When to use Clerk:** You're building a SaaS and auth is not your differentiator. You want to ship Phase 1 in days, not weeks.
> **When to build your own:** You're learning how auth works, or you have strict compliance requirements.

---

## 7. Multi-Tenant Architecture

### Tenant Isolation Strategy

Every table has `organization_id`. All queries filter by this column. There's no row-level security — application-level enforcement prevents leaks.

```typescript
// middleware/tenant.ts
export const resolveTenant = async (req: Request, res: Response, next: NextFunction) => {
  const orgSlug = req.params.orgSlug || req.headers['x-organization'];
  
  if (!orgSlug) {
    return res.status(400).json({ error: 'Organization identifier required' });
  }

  const organization = await organizationRepository.findBySlug(orgSlug);
  if (!organization) {
    return res.status(404).json({ error: 'Organization not found' });
  }

  const membership = await organizationMemberRepository.findByUserAndOrg(
    req.user.id,
    organization.id
  );

  if (!membership) {
    return res.status(404).json({ error: 'Not found' }); // 404 not 403 to prevent ID enumeration
  }

  req.organization = organization;
  req.membership = membership;
  next();
};
```

**Repository enforcement:**

```typescript
// repositories/prisma/prisma-task.repository.ts
async findById(id: string, organizationId: string): Promise<Task | null> {
  return this.prisma.task.findFirst({
    where: { id, project: { organizationId } },
  });
}

async findByProjectId(projectId: string, organizationId: string, pagination: PaginationInput) {
  return this.prisma.task.findMany({
    where: {
      projectId,
      project: { organizationId },
    },
    take: pagination.limit,
    skip: pagination.cursor ? 1 : 0,
    cursor: pagination.cursor ? { id: pagination.cursor } : undefined,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
}
```

---

## 8. Projects & Tasks

### Project Service

```typescript
// services/project.service.ts
export class ProjectService {
  constructor(
    private projectRepository: ProjectRepository,
    private activityService: ActivityService,
    private sseBroadcaster: SSEBroadcaster,
  ) {}

  async createProject(input: CreateProjectInput, actorId: string): Promise<Project> {
    // Multi-step operation wrapped in a transaction for atomicity
    const project = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          organizationId: input.organizationId,
          name: input.name,
          description: input.description,
          color: input.color || '#3b82f6',
        },
      });

      await tx.activity.create({
        data: {
          organizationId: input.organizationId,
          projectId: project.id,
          actorId,
          action: 'project.created',
          entityType: 'project',
          entityId: project.id,
          metadata: { name: project.name },
        },
      });

      return project;
    });

    // Side effects (SSE) happen AFTER the transaction commits
    this.sseBroadcaster.broadcastToOrganization(input.organizationId, {
      type: 'project.created',
      data: project,
    });

    return project;
  }

  async archiveProject(projectId: string, organizationId: string, actorId: string): Promise<Project> {
    const project = await this.projectRepository.findById(projectId, organizationId);
    if (!project) throw new NotFoundError('Project not found');

    const updated = await this.projectRepository.update(projectId, {
      status: ProjectStatus.ARCHIVED,
    });

    await this.activityService.log({
      organizationId,
      projectId,
      actorId,
      action: 'project.archived',
      entityType: 'project',
      entityId: projectId,
    });

    return updated;
  }
}
```

### Task Service with Assignment

```typescript
// services/task.service.ts
export class TaskService {
  constructor(
    private taskRepository: TaskRepository,
    private notificationService: NotificationService,
    private activityService: ActivityService,
    private sseBroadcaster: SSEBroadcaster,
  ) {}

  async createTask(input: CreateTaskInput, actorId: string): Promise<Task> {
    const task = await this.taskRepository.create({
      projectId: input.projectId,
      title: input.title,
      description: input.description,
      status: TaskStatus.TODO,
      priority: input.priority || Priority.MEDIUM,
      createdById: actorId,
      assignedToId: input.assignedToId,
      dueDate: input.dueDate,
    });

    // Notify assignee
    if (input.assignedToId && input.assignedToId !== actorId) {
      await this.notificationService.create({
        userId: input.assignedToId,
        type: NotificationType.TASK_ASSIGNED,
        title: 'New task assigned',
        body: `You were assigned to "${task.title}"`,
        data: { taskId: task.id, projectId: input.projectId },
      });

      this.sseBroadcaster.broadcastToUser(input.assignedToId, {
        type: 'notification',
        data: { type: 'TASK_ASSIGNED', taskId: task.id },
      });
    }

    await this.activityService.log({
      organizationId: input.organizationId,
      projectId: input.projectId,
      taskId: task.id,
      actorId,
      action: 'task.created',
      entityType: 'task',
      entityId: task.id,
      metadata: { title: task.title, assignedTo: input.assignedToId },
    });

    return task;
  }

  async updateTaskStatus(taskId: string, status: TaskStatus, organizationId: string, actorId: string): Promise<Task> {
    const task = await this.taskRepository.findById(taskId, organizationId);
    if (!task) throw new NotFoundError('Task not found');

    const previousStatus = task.status;
    const updateData: any = { status };

    if (status === TaskStatus.DONE && previousStatus !== TaskStatus.DONE) {
      updateData.completedAt = new Date();
    }

    const updated = await this.taskRepository.update(taskId, updateData);

    await this.activityService.log({
      organizationId,
      projectId: task.projectId,
      taskId,
      actorId,
      action: 'task.status_changed',
      entityType: 'task',
      entityId: taskId,
      metadata: { from: previousStatus, to: status },
    });

    this.sseBroadcaster.broadcastToOrganization(organizationId, {
      type: 'task.updated',
      data: { taskId, status, previousStatus },
    });

    return updated;
  }
}
```

---

## 9. Real-Time Notifications (SSE)

### Why SSE for TeamTask Pro

From the API architecture research:

> "SSE uses standard HTTP where the server streams text/event-stream data... The browser's EventSource API handles reconnection automatically."

**Implementation:**

```typescript
// sse/broadcaster.ts
import { Redis } from 'ioredis';

export class SSEBroadcaster {
  private clients = new Map<string, Set<Response>>(); // userId -> connections
  private pub: Redis;
  private sub: Redis;

  constructor(redisUrl: string) {
    this.pub = new Redis(redisUrl);
    this.sub = new Redis(redisUrl);
    
    this.sub.subscribe('sse:org', 'sse:user');
    this.sub.on('message', (channel, message) => {
      const { target, event } = JSON.parse(message);
      this.broadcastLocal(target, event);
    });
  }

  addClient(userId: string, orgId: string, res: Response): void {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId)!.add(res);

    // Store org mapping for this connection
    (res as any).orgId = orgId;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // Send initial connection event
    res.write(`event: connected\ndata: ${JSON.stringify({ userId })}\n\n`);

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      res.write(`:heartbeat\n\n`);
    }, 30000);

    req.on('close', () => {
      clearInterval(heartbeat);
      this.clients.get(userId)?.delete(res);
      if (this.clients.get(userId)?.size === 0) {
        this.clients.delete(userId);
      }
    });
  }

  broadcastToOrganization(orgId: string, event: any): void {
    // Publish to Redis for other server instances
    this.pub.publish('sse:org', JSON.stringify({ target: { orgId }, event }));
    // Local broadcast
    this.broadcastLocal({ orgId }, event);
  }

  broadcastToUser(userId: string, event: any): void {
    this.pub.publish('sse:user', JSON.stringify({ target: { userId }, event }));
    this.broadcastLocal({ userId }, event);
  }

  private broadcastLocal(target: { orgId?: string; userId?: string }, event: any): void {
    const data = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;

    for (const [userId, connections] of this.clients) {
      if (target.userId && target.userId !== userId) continue;

      for (const res of connections) {
        if (target.orgId && (res as any).orgId !== target.orgId) continue;
        
        try {
          res.write(data);
        } catch (err) {
          // Client disconnected
          connections.delete(res);
        }
      }
    }
  }
}
```

**Route:**

```typescript
// routes/notification.routes.ts
app.get('/v1/organizations/:orgSlug/events',
  authenticate,
  resolveTenant,
  (req, res) => {
    sseBroadcaster.addClient(req.user.id, req.organization.id, res);
  }
);
```

**Client connection:**

```javascript
const eventSource = new EventSource('/organizations/acme/events');

eventSource.addEventListener('task.updated', (e) => {
  const data = JSON.parse(e.data);
  updateTaskInUI(data.taskId, data.status);
});

eventSource.addEventListener('notification', (e) => {
  const data = JSON.parse(e.data);
  showNotification(data);
});
```

---

## 10. File Attachments

### S3-Compatible Storage

```typescript
// services/storage.service.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export class StorageService {
  private s3: S3Client;
  private bucket: string;

  constructor() {
    this.s3 = new S3Client({
      endpoint: process.env.S3_ENDPOINT, // MinIO or AWS
      region: process.env.S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY!,
        secretAccessKey: process.env.S3_SECRET_KEY!,
      },
      forcePathStyle: true, // Required for MinIO
    });
    this.bucket = process.env.S3_BUCKET!;
  }

  async uploadFile(key: string, buffer: Buffer, contentType: string): Promise<string> {
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }));
    return key;
  }

  async getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.s3, command, { expiresIn });
  }
}
```

**Upload endpoint:**

```typescript
// routes/task.routes.ts
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

app.post('/v1/organizations/:orgSlug/tasks/:taskId/attachments',
  authenticate,
  resolveTenant,
  requirePermission(Permission.TASK_UPDATE),
  upload.single('file'),
  async (req, res) => {
    const file = req.file!;
    const key = `organizations/${req.organization.id}/tasks/${req.params.taskId}/${Date.now()}-${file.originalname}`;

    await storageService.uploadFile(key, file.buffer, file.mimetype);

    const attachment = await attachmentRepository.create({
      taskId: req.params.taskId,
      uploadedById: req.user.id,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      storageKey: key,
      storageUrl: await storageService.getPresignedUrl(key),
    });

    res.status(201).json(attachment);
  }
);
```

---

## 11. Activity Logs

### Service

```typescript
// services/activity.service.ts
export class ActivityService {
  constructor(
    private activityRepository: ActivityRepository,
  ) {}

  async log(input: CreateActivityInput): Promise<Activity> {
    return this.activityRepository.create(input);
  }

  async getOrganizationActivity(
    organizationId: string,
    filters: ActivityFilters,
    pagination: PaginationInput
  ) {
    return this.activityRepository.findByOrganization(organizationId, filters, pagination);
  }

  async getTaskActivity(taskId: string, organizationId: string) {
    return this.activityRepository.findByTask(taskId, organizationId);
  }
}
```

**Controller:**

```typescript
// controllers/activity.controller.ts
export class ActivityController {
  constructor(private activityService: ActivityService) {}

  getOrganizationActivity = async (req: Request, res: Response) => {
    const activities = await this.activityService.getOrganizationActivity(
      req.organization.id,
      {
        projectId: req.query.projectId as string,
        taskId: req.query.taskId as string,
        action: req.query.action as string,
      },
      {
        cursor: req.query.cursor as string,
        limit: Math.max(1, Math.min(Number(req.query.limit) || 20, 100)),
      }
    );

    res.json({
      data: activities,
      pagination: {
        next_cursor: activities.length > 0 
          ? encodeCursor({ createdAt: activities[activities.length - 1].createdAt, id: activities[activities.length - 1].id })
          : null,
        has_more: activities.length === (Number(req.query.limit) || 20),
      },
    });
  };
}
```

---

## 12. Admin Dashboard

### Admin Endpoints

```typescript
// routes/admin.routes.ts
app.get('/v1/admin/organizations',
  authenticate,
  requireRole('superadmin'),
  adminController.listOrganizations
);

app.get('/v1/admin/organizations/:orgId/members',
  authenticate,
  requireRole('superadmin'),
  adminController.listOrganizationMembers
);

app.get('/v1/admin/stats',
  authenticate,
  requireRole('superadmin'),
  adminController.getPlatformStats
);
```

**Admin Controller:**

```typescript
// controllers/admin.controller.ts
export class AdminController {
  constructor(
    private organizationRepository: OrganizationRepository,
    private userRepository: UserRepository,
  ) {}

  getPlatformStats = async (req: Request, res: Response) => {
    const [
      totalOrganizations,
      totalUsers,
      totalTasks,
      tasksByStatus,
      recentSignups,
    ] = await Promise.all([
      this.organizationRepository.count(),
      this.userRepository.count(),
      this.taskRepository.count(),
      this.taskRepository.countByStatus(),
      this.userRepository.recentSignups(7),
    ]);

    res.json({
      totalOrganizations,
      totalUsers,
      totalTasks,
      tasksByStatus,
      recentSignups,
    });
  };
}
```

---

## 13. OpenAPI Documentation

### OpenAPI 3.1 Spec

```yaml
# openapi.yaml
openapi: 3.1.0
info:
  title: TeamTask Pro API
  version: 1.0.0
  description: Team task management SaaS API

servers:
  - url: https://api.teamtask.pro/v1
    description: Production
  - url: http://localhost:3000/v1
    description: Local

paths:
  /auth/register:
    post:
      operationId: register
      summary: Register a new user
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RegisterRequest'
      responses:
        '201':
          description: User created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'

  /organizations/{orgSlug}/projects:
    get:
      operationId: listProjects
      summary: List organization projects
      parameters:
        - name: orgSlug
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: List of projects
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Project'

components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: string
        email:
          type: string
        name:
          type: string
        avatarUrl:
          type: string
      required: [id, email]

    RegisterRequest:
      type: object
      properties:
        email:
          type: string
          format: email
        password:
          type: string
          minLength: 12
        name:
          type: string
      required: [email, password, name]

    Project:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        description:
          type: string
        color:
          type: string
        status:
          type: string
          enum: [ACTIVE, ARCHIVED, DELETED]
      required: [id, name, status]

  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

**Scalar UI Integration:**

```typescript
// app.ts
import { apiReference } from '@scalar/express-api-reference';

app.use('/docs', apiReference({
  spec: {
    url: '/openapi.yaml',
  },
}));
```

---

## 14. Testing Strategy

### Testing Pyramid

From the testing research:

> "70% unit, 20% integration, 10% E2E. Extract business logic from route handlers to make unit testing possible."

### Test Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/', 'prisma/'],
    },
  },
});
```

### Unit Test Example

```typescript
// tests/unit/services/task.service.test.ts
import { describe, it, expect, vi } from 'vitest';
import { TaskService } from '../../../src/services/task.service';
import { TaskStatus, Priority } from '../../../src/domain/entities/task';

describe('TaskService', () => {
  const createMockRepo = () => ({
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
  });

  const createMockNotification = () => ({
    create: vi.fn(),
  });

  const createMockSSE = () => ({
    broadcastToOrganization: vi.fn(),
    broadcastToUser: vi.fn(),
  });

  it('should create a task and notify assignee', async () => {
    const mockRepo = createMockRepo();
    const mockNotification = createMockNotification();
    const mockSSE = createMockSSE();

    mockRepo.create.mockResolvedValue({
      id: 'task-1',
      title: 'Test Task',
      projectId: 'proj-1',
    });

    const service = new TaskService(
      mockRepo as any,
      mockNotification as any,
      {} as any,
      mockSSE as any
    );

    const result = await service.createTask({
      projectId: 'proj-1',
      title: 'Test Task',
      description: 'Description',
      priority: Priority.HIGH,
      assignedToId: 'user-2',
      organizationId: 'org-1',
    }, 'user-1');

    expect(result.title).toBe('Test Task');
    expect(mockNotification.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-2',
      type: 'TASK_ASSIGNED',
    }));
    expect(mockSSE.broadcastToUser).toHaveBeenCalledWith('user-2', expect.any(Object));
  });

  it('should not notify when self-assigning', async () => {
    const mockRepo = createMockRepo();
    const mockNotification = createMockNotification();
    const mockSSE = createMockSSE();

    mockRepo.create.mockResolvedValue({ id: 'task-1', title: 'Test' });

    const service = new TaskService(
      mockRepo as any,
      mockNotification as any,
      {} as any,
      mockSSE as any
    );

    await service.createTask({
      projectId: 'proj-1',
      title: 'Test',
      assignedToId: 'user-1', // Same as actor
      organizationId: 'org-1',
    }, 'user-1');

    expect(mockNotification.create).not.toHaveBeenCalled();
  });
});
```

### Integration Test Example

```typescript
// tests/integration/tasks.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';

describe('Tasks API', () => {
  let app: Express;
  let authToken: string;
  let orgSlug: string;
  let projectId: string;

  beforeAll(async () => {
    app = (await createApp()).app;
    // Setup test user, org, project
    authToken = await createTestUserAndLogin();
    orgSlug = 'test-org';
    projectId = await createTestProject(orgSlug);
  });

  it('should create a task', async () => {
    const res = await request(app)
      .post(`/v1/organizations/${orgSlug}/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Integration Test Task',
        description: 'Test description',
        priority: 'HIGH',
      })
      .expect(201);

    expect(res.body.title).toBe('Integration Test Task');
    expect(res.body.status).toBe('TODO');
  });

  it('should reject invalid task data', async () => {
    await request(app)
      .post(`/v1/organizations/${orgSlug}/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: '' })
      .expect(400);
  });

  it('should enforce tenant isolation', async () => {
    await request(app)
      .get(`/v1/organizations/other-org/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(404);
  });

  afterAll(async () => {
    await cleanupTestData();
  });
});
```

### Test Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:ci": "vitest run --coverage",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "vitest run tests/e2e"
  }
}
```

---

## 15. AI/LLM Integration

### Why AI in 2025?

AI is not a gimmick — it's a user expectation. Smart task suggestions, automated summaries, and natural language queries differentiate modern SaaS from legacy tools.

### Streaming LLM Responses

```typescript
// services/ai.service.ts
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function* streamTaskSuggestions(projectContext: string) {
  const stream = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a project management assistant. Suggest 3-5 actionable tasks based on the project context.',
      },
      { role: 'user', content: projectContext },
    ],
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) yield content;
  }
}
```

```typescript
// routes/ai.routes.ts
app.post('/organizations/:orgSlug/ai/suggest-tasks', authenticate, resolveTenant, async (req, res) => {
  const { projectDescription } = req.body;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  const stream = streamTaskSuggestions(projectDescription);
  
  for await (const chunk of stream) {
    res.write(chunk);
  }
  
  res.end();
});
```

### RAG Basics with pgvector

Store task embeddings for semantic search:

```sql
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to tasks
ALTER TABLE tasks ADD COLUMN embedding vector(1536);

-- Create index for fast similarity search
CREATE INDEX ON tasks USING ivfflat (embedding vector_cosine_ops);
```

```typescript
// services/embedding.service.ts
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

export async function findSimilarTasks(organizationId: string, query: string, limit: number = 5) {
  const embedding = await generateEmbedding(query);
  
  // Using Prisma with raw query for vector search
  const tasks = await prisma.$queryRaw`
    SELECT id, title, description, 1 - (embedding <=> ${embedding}::vector) as similarity
    FROM tasks
    WHERE project_id IN (
      SELECT id FROM projects WHERE organization_id = ${organizationId}
    )
    ORDER BY embedding <=> ${embedding}::vector
    LIMIT ${limit}
  `;
  
  return tasks;
}
```

### AI-Powered Task Suggestions Feature

```typescript
// services/task-suggestion.service.ts
export async function suggestTasksForProject(projectId: string, actorId: string) {
  const project = await projectRepository.findById(projectId);
  const existingTasks = await taskRepository.findByProjectId(projectId);
  
  const context = `
    Project: ${project.name}
    Description: ${project.description}
    Existing tasks: ${existingTasks.map(t => t.title).join(', ')}
  `;
  
  const suggestions: string[] = [];
  const stream = streamTaskSuggestions(context);
  
  let buffer = '';
  for await (const chunk of stream) {
    buffer += chunk;
  }
  
  // Parse suggestions (simple line-split)
  return buffer
    .split('\n')
    .filter(line => line.trim().length > 0)
    .map(line => line.replace(/^\d+\.\s*/, '').trim());
}
```

### LLM Provider Comparison

| Provider | Best For | Cost | Latency |
|----------|----------|------|---------|
| **OpenAI** | General purpose, best reasoning | Medium | Medium |
| **Anthropic Claude** | Long context, safety | Medium | Medium |
| **Groq** | Speed | Low | Very fast |
| **Ollama (local)** | Privacy, no API costs | Free (hardware) | Depends on GPU |

### Responsible AI Guidelines

1. **Always let users opt out** — AI suggestions are assistance, not mandates
2. **Show attribution** — When suggesting similar tasks, explain why
3. **Rate limit AI endpoints** — LLM calls are expensive; cache aggressively
4. **Validate outputs** — Never execute LLM-generated code without review
5. **Log and monitor** — Track AI usage, costs, and user acceptance rates

---

## 16. Docker Setup

### Multi-Stage Dockerfile

```dockerfile
# Dockerfile.prod
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN npx prisma generate
RUN pnpm run build

FROM node:20-bookworm-slim AS production
WORKDIR /app
ENV NODE_ENV=production

# Install pnpm
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile && pnpm store prune

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -s /bin/sh nodejs
USER nodejs

EXPOSE 3000

CMD ["node", "dist/app.js"]
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.prod
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/teamtask?schema=public
      - REDIS_URL=redis://redis:6379
      - JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
      - S3_ENDPOINT=${S3_ENDPOINT}
      - S3_ACCESS_KEY=${S3_ACCESS_KEY}
      - S3_SECRET_KEY=${S3_SECRET_KEY}
    depends_on:
      - db
      - redis
      - minio
    networks:
      - teamtask

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: teamtask
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    networks:
      - teamtask

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    networks:
      - teamtask

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"
    networks:
      - teamtask

  worker:
    build:
      context: .
      dockerfile: Dockerfile.prod
    command: node dist/workers/index.js
    stop_signal: SIGTERM
    stop_grace_period: 30s
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/teamtask?schema=public
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    networks:
      - teamtask

volumes:
  postgres_data:
  redis_data:
  minio_data:

networks:
  teamtask:
    driver: bridge

> **Graceful Shutdown for Workers:** BullMQ workers should listen for `SIGTERM` to finish current jobs before exiting:
> ```typescript
> // workers/index.ts
> import { Worker } from 'bullmq';
>
> const worker = new Worker('email', async (job) => { /* process job */ });
>
> function shutdown(signal: string) {
>   console.log(`${signal} received. Closing worker...`);
>   worker.close().then(() => process.exit(0));
>   setTimeout(() => process.exit(1), 30000);
> }
>
> process.on('SIGTERM', () => shutdown('SIGTERM'));
> process.on('SIGINT', () => shutdown('SIGINT'));
> ```
```

---

## 17. CI/CD Pipeline

### GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: teamtask_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate Prisma client
        run: npx prisma generate

      - name: Run migrations
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/teamtask_test?schema=public

      - name: Run linter
        run: npm run lint

      - name: Run tests
        run: npm run test:ci
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/teamtask_test?schema=public
          REDIS_URL: redis://localhost:6379
          JWT_ACCESS_SECRET: test-access-secret
          JWT_REFRESH_SECRET: test-refresh-secret

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v4

      - name: Build Docker image
        run: |
          docker build -f Dockerfile.prod -t teamtask-pro:${{ github.sha }} .
          docker tag teamtask-pro:${{ github.sha }} teamtask-pro:latest

      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push teamtask-pro:${{ github.sha }}
          docker push teamtask-pro:latest
```

```yaml
# .github/workflows/cd.yml
name: CD

on:
  workflow_run:
    workflows: [CI]
    types: [completed]
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    if: ${{ github.event.workflow_run.conclusion == 'success' }}

    steps:
      - name: Deploy to production
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.PROD_HOST }}
          username: ${{ secrets.PROD_USER }}
          key: ${{ secrets.PROD_SSH_KEY }}
          script: |
            cd /opt/teamtask-pro
            docker-compose pull
            docker-compose up -d
            docker-compose exec -T app npx prisma migrate deploy
            docker-compose exec -T app pm2 reload all
```

---

## 18. Deployment Guide

### Option A: VPS + Docker Compose (Recommended for Startups)

**Server Requirements:**
- 2 CPU cores, 4GB RAM minimum
- Ubuntu 22.04 LTS
- Docker + Docker Compose installed

**Steps:**

```bash
# 1. Clone repository
git clone https://github.com/your-org/teamtask-pro.git
cd teamtask-pro

# 2. Create environment file
cp .env.example .env
# Edit .env with production values

# 3. Start services
docker-compose -f docker-compose.yml up -d

# 4. Run migrations
docker-compose exec app npx prisma migrate deploy

# 5. Create initial admin
npm run seed:prod
```

### Option B: PaaS (Railway/Render)

1. Connect GitHub repository
2. Add PostgreSQL and Redis plugins
3. Configure environment variables
4. Set build command: `npm run build`
5. Set start command: `npm start`

### Option C: Kubernetes (Scale-Out)

For teams with Kubernetes expertise, use Helm charts with:
- HorizontalPodAutoscaler (HPA) for app pods
- Separate deployment for workers
- External PostgreSQL (RDS/Cloud SQL)
- External Redis (ElastiCache/Memorystore)

---

## 19. Environment Variables

```bash
# .env.example

# ─── App ───
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5173

# ─── Database ───
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/teamtask?schema=public

# ─── Redis ───
REDIS_URL=redis://localhost:6379

# ─── JWT ───
JWT_ACCESS_SECRET=generate-a-256-bit-secret-here
JWT_REFRESH_SECRET=generate-another-256-bit-secret-here

# ─── OAuth ───
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/v1/auth/google/callback

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=http://localhost:3000/v1/auth/github/callback

# ─── Email (SendGrid/Resend) ───
EMAIL_PROVIDER=resend
EMAIL_API_KEY=
EMAIL_FROM=noreply@teamtask.pro

# ─── Storage (MinIO/AWS S3) ───
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=teamtask
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin

# ─── Rate Limiting ───
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# ─── Logging ───
LOG_LEVEL=info
```

---

## 20. Step-by-Step Setup

### Local Development

```bash
# 1. Prerequisites
node --version  # v20+
docker --version

# 2. Clone and install
git clone https://github.com/your-org/teamtask-pro.git
cd teamtask-pro
npm install

# 3. Environment
cp .env.example .env
# Edit .env as needed

# 4. Start infrastructure
docker-compose up -d db redis minio

# 5. Database
npx prisma migrate dev
npx prisma generate
npx prisma db seed

# 6. Run
npm run dev        # API server
npm run worker:dev # Background workers

# 7. Test
npm test
```

### Testing Commands

```bash
# Run all tests
npm test

# Run with coverage
npm run test:ci

# Watch mode
npm run test:watch

# Specific test file
npx vitest run tests/unit/services/task.service.test.ts

# Debug
npx vitest run --reporter=verbose
```

---

### Deep Health Check

A shallow health check (`{ status: 'ok' }`) can hide real problems. Always verify your dependencies:

```typescript
// routes/health.routes.ts
import { Router } from 'express';
import { prisma } from '../config/prisma';
import { redis } from '../config/redis';

const router = Router();

router.get('/health', async (req, res) => {
  const checks = {
    database: false,
    redis: false,
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch (err) {
    console.error('Health check: DB failed', err);
  }

  try {
    await redis.ping();
    checks.redis = true;
  } catch (err) {
    console.error('Health check: Redis failed', err);
  }

  const healthy = checks.database && checks.redis;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    checks,
    timestamp: new Date().toISOString(),
  });
});

export default router;
```

### Idempotency Key Pattern

For critical write operations (payments, task creation, invites), use idempotency keys to prevent duplicate processing on retries:

```typescript
// middleware/idempotency.ts
import { redis } from '../config/redis';

const IDEMPOTENCY_TTL = 24 * 60 * 60; // 24 hours

export const idempotencyMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const key = req.headers['idempotency-key'] as string;
  if (!key) return next(); // Optional: require for specific routes

  const cacheKey = `idempotency:${key}`;
  const existing = await redis.get(cacheKey);

  if (existing) {
    return res.status(409).json({ error: 'Duplicate request', response: JSON.parse(existing) });
  }

  // Capture the response body after the request completes
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    res.locals.body = body;
    return originalJson(body);
  };

  res.on('finish', async () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      await redis.setex(cacheKey, IDEMPOTENCY_TTL, JSON.stringify(res.locals.body));
    }
  });

  next();
};
```

## 21. Deployment Checklist

### Pre-Deployment

- [ ] Environment variables configured for production
- [ ] Database migrations tested on staging
- [ ] JWT secrets are cryptographically random (256-bit)
- [ ] OAuth redirect URIs point to production domain
- [ ] S3 bucket CORS configured
- [ ] Email DNS records configured (SPF, DKIM, DMARC)
- [ ] SSL certificates installed
- [ ] Rate limiting enabled
- [ ] Error tracking configured (Sentry)
- [ ] Logging aggregation configured

### Security

- [ ] `helmet()` middleware active
- [ ] CORS configured (not wildcard)
- [ ] Rate limiting on auth endpoints (10 attempts/hour)
- [ ] Password hashing with argon2id
- [ ] Refresh token rotation enabled
- [ ] Session cookies: `httpOnly`, `Secure`, `SameSite=Strict`
- [ ] No secrets in logs or error responses
- [ ] File upload type validation
- [ ] File upload size limits
- [ ] Input validation with Zod on all endpoints

### Database

- [ ] Connection pooling configured (max: 20)
- [ ] Read replicas configured (if applicable)
- [ ] Backups scheduled (daily minimum)
- [ ] Migration rollback tested
- [ ] Indexes reviewed (EXPLAIN ANALYZE on slow queries)

### Monitoring

- [ ] Health check endpoint (`/health`) checks DB + Redis and responds 200
- [ ] Database connection metrics exposed
- [ ] Redis connection metrics exposed
- [ ] Error rate alerting configured
- [ ] P95 latency alerting configured
- [ ] Disk space alerting configured

### Performance

- [ ] PM2 cluster mode enabled (`instances: 'max'`)
- [ ] Compression middleware active (gzip/brotli)
- [ ] Static assets served via CDN/reverse proxy
- [ ] Database queries use indexes
- [ ] N+1 queries eliminated (Prisma `include` optimized)

### Post-Deployment

- [ ] Smoke test: user registration
- [ ] Smoke test: create organization
- [ ] Smoke test: create project and task
- [ ] Smoke test: file upload
- [ ] Smoke test: SSE notifications
- [ ] Smoke test: OAuth login (Google + GitHub)
- [ ] SSL certificate valid
- [ ] DNS propagation complete
- [ ] Error tracking receiving events

---

## Summary

**TeamTask Pro** represents the culmination of everything you've learned:

| Module | Concept | Applied Here |
|--------|---------|--------------|
| Fundamentals | Express routing, middleware | App structure, auth middleware |
| Database | Prisma, migrations | Complete schema, relations |
| Security | JWT, OAuth, RBAC | Multi-provider auth, role system |
| Testing | Unit, integration, DI | Service layer testing with fakes |
| Architecture | Repository, Service, DI | Full layered architecture |
| Production | Docker, CI/CD, PM2 | Complete deployment pipeline |

This architecture scales from 1 user to 100,000 users by:
1. **Horizontal scaling**: Add more app servers behind a load balancer
2. **Database scaling**: Read replicas, connection pooling, query optimization
3. **Caching**: Redis for sessions, queries, and pub/sub
4. **Background jobs**: Workers handle emails, notifications, exports
5. **File storage**: S3-compatible storage scales infinitely

**What's next?**
- Add GraphQL API alongside REST
- Implement full-text search with Elasticsearch
- Add analytics with ClickHouse
- Implement feature flags for gradual rollouts
- Add WebRTC for real-time collaboration

---

*Built with the patterns from all previous modules. Production-ready architecture for real-world SaaS applications.*
