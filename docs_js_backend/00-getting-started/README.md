# Module 00: Before You Start - TypeScript, Tooling & Mindset

> **"The TypeScript Cliff is real. This module is your rope."**
>
> Too many backend courses assume you already know TypeScript. By the end of this module, you'll have a working TypeScript Express server, a modern tooling setup, and the confidence to read every code example in this course.

---

## Table of Contents

1. [Why TypeScript in 2025](#1-why-typescript-in-2025)
2. [TypeScript Basics for Backend Devs](#2-typescript-basics-for-backend-devs)
3. [tsconfig.json for Express Projects](#3-tsconfigjson-for-express-projects)
4. [ESM + TypeScript Setup](#4-esm--typescript-setup)
5. [pnpm Setup](#5-pnpm-setup)
6. [Development Tools](#6-development-tools)
7. [Transition Guide: JS to TS](#7-transition-guide-js-to-ts)
8. [Your First TypeScript Express Server](#8-your-first-typescript-express-server)
9. [Summary](#9-summary)

---

## 1. Why TypeScript in 2025

### WHAT Is TypeScript?

TypeScript is JavaScript with a type system. It compiles to plain JavaScript, meaning it runs anywhere JavaScript runs — but it catches errors **before** runtime.

```typescript
// TypeScript catches this at compile time
function greet(name: string) {
  return `Hello, ${name}`;
}

greet(42); // Error: Argument of type 'number' is not assignable to parameter of type 'string'
```

### WHY Is It Non-Negotiable in 2025?

| Factor | 2018 | 2025 |
|--------|------|------|
| Industry adoption | ~30% | **~80%** |
| Job requirements | Nice-to-have | **Required** |
| Library support | Optional @types | **Native `.d.ts` required** |
| AI coding assistants | Confused by JS | **Optimized for typed code** |
| Refactoring safety | Dangerous | **Reliable** |

**TypeScript is not optional anymore.**

- **Hiring:** 78% of Node.js backend jobs list TypeScript as a requirement (2025 data)
- **Libraries:** Prisma, Drizzle, tRPC, NestJS, TRPC — all TypeScript-native
- **AI tools:** GitHub Copilot, Cursor, and Claude Code achieve 2-3x better accuracy with typed code
- **Refactoring:** Rename a field in your database schema, and TypeScript tells you every file that needs updating

### WHAT HAPPENS If You Skip TypeScript?

```javascript
// server.js — untyped
app.post('/users', async (req, res) => {
  const user = await db.user.create(req.body);
  res.json(user);
  // Did req.body have the right fields? You'll find out in production.
});
```

**Real-world consequences:**
- Runtime errors that TypeScript would have caught: `Cannot read property 'email' of undefined`
- Fear of refactoring: "This variable might be used somewhere... I don't know where"
- Slower onboarding: new developers have to mentally infer types from usage
- AI assistants hallucinate APIs because there's no type information to ground them

---

## 2. TypeScript Basics for Backend Devs

You don't need to be a type wizard. Here are the 80% you'll use every day:

### Types & Interfaces

```typescript
// Type: Best for unions, primitives, tuples
type Status = 'pending' | 'active' | 'archived';
type ID = string;

// Interface: Best for object shapes (can be extended)
interface User {
  id: ID;
  email: string;
  name: string;
  status: Status;
  createdAt: Date;
}

// Optional properties
interface CreateUserInput {
  email: string;
  name?: string;  // Optional
}
```

**Rule of thumb:** Use `interface` for objects you'll extend. Use `type` for everything else.

### Functions

```typescript
// Typed parameters and return value
function findUserById(id: string): Promise<User | null> {
  return db.user.findUnique({ where: { id } });
}

// Async functions
async function createUser(input: CreateUserInput): Promise<User> {
  return db.user.create({ data: input });
}

// Arrow functions with explicit types
const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 12);
};
```

### Generics Basics

```typescript
// Generic: a type that takes another type as a parameter
function wrapInArray<T>(item: T): T[] {
  return [item];
}

wrapInArray(42);        // T is inferred as number → number[]
wrapInArray('hello');   // T is inferred as string → string[]

// Practical use: typed API responses
interface ApiResponse<T> {
  data: T;
  error?: string;
}

const userResponse: ApiResponse<User> = {
  data: { id: '1', email: 'a@b.com', name: 'Alice', status: 'active', createdAt: new Date() }
};
```

**You don't need to master generics.** Understand that `Promise<User>` means "this async function returns a User" and you're 90% there.

### Type Inference: Let TypeScript Work for You

```typescript
// TypeScript infers the type — no need to annotate everything
const users = await db.user.findMany(); // inferred as User[]

users.map(u => u.email); // TypeScript knows u is a User

// Inference with destructuring
app.get('/users/:id', async (req, res) => {
  const { id } = req.params; // id is inferred as string
  // ...
});
```

### The `any` Escape Hatch (Use Sparingly)

```typescript
// BAD: Silences TypeScript entirely
const data: any = fetchSomething();

// BETTER: Unknown forces you to validate
const data: unknown = fetchSomething();
if (typeof data === 'string') {
  // TypeScript now knows data is a string inside this block
}

// BEST: Define the actual shape
interface ApiPayload {
  users: User[];
}
const data: ApiPayload = fetchSomething();
```

---

## 3. tsconfig.json for Express Projects

### WHAT Is tsconfig.json?

It's TypeScript's configuration file. It tells the compiler how strict to be, what JavaScript version to target, and which files to include.

### Recommended tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### Key Settings Explained

| Setting | Why It Matters |
|---------|---------------|
| `target: ES2022` | Uses modern JavaScript features; Node 20 supports this natively |
| `module: NodeNext` | Required for ESM + TypeScript together |
| `strict: true` | Enables all strict type-checking options. Non-negotiable for production |
| `esModuleInterop` | Lets you import CommonJS modules with `import` syntax |
| `skipLibCheck` | Speeds up compilation by skipping type checking of node_modules |
| `noUnusedLocals` | Catches unused variables (prevents bugs and keeps code clean) |

### WHAT HAPPENS With a Bad tsconfig?

```json
{
  "compilerOptions": {
    "target": "ES5",
    "module": "CommonJS",
    "strict": false
  }
}
```

- `strict: false`: TypeScript becomes useless — `null` values pass silently, `any` is implied everywhere
- `target: ES5`: You miss out on modern features like optional chaining (`obj?.field`)
- `module: CommonJS`: You're stuck in the past; ESM is the standard

---

## 4. ESM + TypeScript Setup

### WHY ESM (ES Modules)?

ESM is the modern JavaScript module system:

```typescript
// ESM (modern)
import express from 'express';
import { router } from './routes/user.routes.js'; // Note the .js extension!

// CommonJS (legacy)
const express = require('express');
```

**Benefits:**
- Static analysis: imports are resolved at compile time
- Tree-shaking: unused code is eliminated by bundlers
- Top-level await: `await` outside of functions
- Standard across browsers, Node.js, and Deno/Bun

### Setting Up ESM with TypeScript

**Step 1: package.json**

```json
{
  "name": "my-api",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

**Step 2: tsconfig.json**

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022"
  }
}
```

**Step 3: Import paths**

```typescript
// In ESM + TypeScript, you MUST use .js extensions for relative imports
// Even though the file is .ts!
import { userRouter } from './routes/user.routes.js';
import { db } from './db.js';
```

This is required by the ESM specification. TypeScript handles the mapping at compile time.

### WHAT HAPPENS If You Mix ESM and CommonJS?

**The `require()`/`import` hell:**

```typescript
// You're using ESM ("type": "module")
import express from 'express'; // This works

const something = require('./legacy'); // ERROR: require is not defined in ESM
```

**Fix:** Convert everything to ESM, or use dynamic import for CommonJS modules:

```typescript
const { legacyFunction } = await import('./legacy.cjs');
```

---

## 5. pnpm Setup

### WHY pnpm Over npm/yarn?

| Feature | npm | yarn | pnpm |
|---------|-----|------|------|
| Disk usage | High (copies per project) | High | **Low (content-addressable store)** |
| Install speed | Medium | Fast | **Fastest** |
| Monorepo support | Workspaces | Workspaces | **Built-in, best-in-class** |
| Strictness | Loose dependency hoisting | Loose | **Strict (prevents phantom deps)** |
| Lockfile | `package-lock.json` | `yarn.lock` | **`pnpm-lock.yaml`** |

**pnpm's secret:** It stores one copy of a package version globally and hard-links it into your project. A project with 1000 dependencies uses ~1GB with npm but ~150MB with pnpm.

### Installation & Usage

```bash
# Install pnpm globally
npm install -g pnpm

# Create a new project
pnpm init

# Install dependencies
pnpm add express zod
pnpm add -D typescript @types/express @types/node

# Run scripts
pnpm dev
pnpm build

# Add a workspace package (monorepos)
pnpm add -r @myapp/shared
```

### pnpm-workspace.yaml (Monorepos)

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

```bash
# Install all workspace dependencies
pnpm install

# Run a command in a specific workspace
pnpm --filter @myapp/api dev
```

### WHAT HAPPENS With npm's Phantom Dependencies?

```javascript
// You installed 'express', which depends on 'debug'
// npm hoists 'debug' to node_modules root

// Your code:
import debug from 'debug'; // Works by accident!

// But 'debug' is NOT in your package.json.
// When express updates and removes debug, your code breaks.
```

**pnpm prevents this.** Only packages explicitly in your `package.json` are accessible.

---

## 6. Development Tools

### ESLint

ESLint catches bugs and enforces code style.

```bash
pnpm add -D eslint @eslint/js typescript-eslint
```

```javascript
// eslint.config.mjs (flat config — modern standard)
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  }
);
```

### Prettier

Prettier formats your code consistently.

```bash
pnpm add -D prettier
```

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

**Integrate with ESLint:**

```bash
pnpm add -D eslint-config-prettier
```

```javascript
// eslint.config.mjs
import prettierConfig from 'eslint-config-prettier';

export default [
  // ...other configs
  prettierConfig, // Disables ESLint rules that conflict with Prettier
];
```

### tsx for Development

`tsx` is the modern replacement for `ts-node`. It's faster and handles ESM natively.

```bash
pnpm add -D tsx
```

```json
// package.json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

**Why tsx over ts-node?**
- 10-20x faster startup (uses esbuild under the hood)
- Native ESM support without configuration gymnastics
- Works with `tsx watch` for instant reloads

### WHAT HAPPENS Without These Tools?

- **No ESLint:** `const password = 'secret'` sits in your code. `==` instead of `===` causes subtle bugs.
- **No Prettier:** Every PR has 50 lines of formatting changes. Code review becomes style review.
- **No tsx:** `ts-node` takes 8 seconds to start. You stop running your code during development.

---

## 7. Transition Guide: JS to TS

### If You Only Know JavaScript, Here's What You Need

**Week 1: Mindset Shift**
- TypeScript is **not** a different language. It's JavaScript + types.
- The types disappear at runtime. They only exist during development.
- Start with `strict: false` if you must, but aim for `strict: true` within 2 weeks.

**Week 2: Annotate the Boundaries**
- Add types to function parameters and return values
- Define interfaces for your database models
- Use `any` temporarily for complex third-party types, then replace them

**Week 3: Let Inference Handle the Rest**
- Don't annotate every variable: `const name: string = 'Alice'` → `const name = 'Alice'`
- TypeScript knows `name` is a string. Trust it.

**Common JS → TS Gotchas**

| JavaScript | TypeScript Fix |
|-----------|---------------|
| `req.body.email` | `(req as Request<{},{},{ email: string }>).body.email` or use Zod validation |
| `process.env.PORT` | `process.env.PORT!` or validate with `envalid` |
| `JSON.parse(data)` | `JSON.parse(data) as User` or use `zod` to validate shape |
| `module.exports = app` | `export default app` |
| `require('./config')` | `import config from './config.js'` |

### The Pragmatic Shortcut

> **Sidebar: Just Ship It**
>
> Don't let perfect types block your progress. A working Express app with 20 `any` types is better than a perfectly typed app that doesn't exist.
>
> Strategy:
> 1. Build the feature in TypeScript
> 2. Use `any` for the tricky parts
> 3. Come back and add proper types once it works
> 4. Enable `@typescript-eslint/no-explicit-any` as a warning to track progress

---

## 8. Your First TypeScript Express Server

### Project Setup

```bash
# 1. Create project
mkdir my-api && cd my-api
pnpm init

# 2. Configure package.json for ESM
# Add: "type": "module"

# 3. Install dependencies
pnpm add express zod
pnpm add -D typescript @types/express @types/node tsx eslint @eslint/js typescript-eslint prettier eslint-config-prettier

# 4. Generate tsconfig
npx tsc --init
# Then replace with the recommended config from Section 3
```

### The Code

```typescript
// src/index.ts
import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const app = express();
app.use(express.json());

// ─── Validation Schema ───
const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).optional(),
});

type CreateUserInput = z.infer<typeof CreateUserSchema>;

// ─── In-Memory Store (for demo) ───
interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
}

const users: User[] = [];

// ─── Routes ───
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/users', (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = CreateUserSchema.parse(req.body);
    
    const user: User = {
      id: crypto.randomUUID(),
      email: input.email,
      name: input.name ?? null,
      createdAt: new Date(),
    };
    
    users.push(user);
    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

app.get('/users', (_req: Request, res: Response) => {
  res.json({ data: users });
});

// ─── Error Handler ───
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.errors,
    });
  }
  
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start ───
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
```

### Run It

```bash
# Development (auto-reload)
pnpm dev

# Build for production
pnpm build

# Run production build
pnpm start
```

### Test It

```bash
# Health check
curl http://localhost:3000/health

# Create a user
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","name":"Alice"}'

# List users
curl http://localhost:3000/users

# Try invalid input
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"email":"not-an-email"}'
```

---

## 9. Summary

| Concept | Key Takeaway |
|---------|-------------|
| **TypeScript** | Not optional in 2025. Catches errors before production. |
| **Types** | Annotate function boundaries. Let inference handle the rest. |
| **Interfaces** | Use for object shapes you plan to extend. |
| **Generics** | Understand `Promise<T>` and `ApiResponse<T>`. That's enough to start. |
| **tsconfig** | `strict: true`, `module: NodeNext`, `target: ES2022`. |
| **ESM** | Modern standard. Use `.js` extensions in imports. |
| **pnpm** | Faster, smaller, stricter than npm/yarn. |
| **Tooling** | ESLint + Prettier + tsx = productive TypeScript development. |

### Module 00 Checklist

- [ ] I can explain why TypeScript is required in 2025
- [ ] I've created a `tsconfig.json` with `strict: true`
- [ ] I've set up ESM in a Node.js project
- [ ] I've installed and used pnpm
- [ ] I've configured ESLint and Prettier
- [ ] I've run a TypeScript Express server with `tsx`
- [ ] I've used Zod to validate incoming request data

---

> **Next Module:** Module 01 - Express Fundamentals. Now that you have TypeScript running, we'll build a real backend with proper routing, middleware, and error handling.

*Last updated: 2026-05-06 | TypeScript 5.x | Node 20+ | ESM*
