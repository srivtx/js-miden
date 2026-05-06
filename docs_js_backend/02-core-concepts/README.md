# Module 02: Core Concepts — Middleware, Routing & The Request Lifecycle

> **You have built your first server.** You know what `req`, `res`, and `next` are. Now it is time to understand the **engine** beneath the hood. By the end of this module, you will see Express not as a magic black box, but as a precise assembly line of functions. You will build a Blog API with organized routes, simulated authentication, and bulletproof error handling.
> 
> **Prerequisites:** Module 01, or basic familiarity with `import`, `app.get()`, and `res.json()`.

---

## Table of Contents

1. [The Middleware Pipeline](#1-the-middleware-pipeline)
2. [Writing Custom Middleware](#2-writing-custom-middleware)
3. [Router Organization](#3-router-organization)
4. [The Request/Response Lifecycle](#4-the-requestresponse-lifecycle)
5. [Static Files & CDN Strategy](#5-static-files--cdn-strategy)
6. [Template Engines](#6-template-engines)
7. [Error Handling Middleware](#7-error-handling-middleware)
8. [Environment Configuration](#8-environment-configuration)
9. [Project Structure](#9-project-structure)
10. [When Middleware Order Goes Wrong](#10-when-middleware-order-goes-wrong)
11. [The Memory Leak You Didn't See Coming](#11-the-memory-leak-you-didnt-see-coming)
12. [Mini Project: Blog API](#12-mini-project-blog-api)

---

## 1. The Middleware Pipeline

### WHAT is it?

Middleware is the **central nervous system** of Express. Every incoming request flows through a **pipeline** (a chain) of functions. Each function can inspect the request, modify it, reject it, or pass it to the next function.

Under the hood, Express maintains an internal array called the **stack**. When a request arrives, Express iterates through this stack synchronously. For each item (called a `Layer`), it checks:

1. Does the URL path match?
2. Does the HTTP method match (for routes)?
3. If yes, execute the function.

```
┌─────────────────────────────────────────────────────────────┐
│                    THE EXPRESS STACK                        │
├─────────────────────────────────────────────────────────────┤
│  Request arrives → Layer 1 (Logging) → next()               │
│                    Layer 2 (CORS) → next()                  │
│                    Layer 3 (Body Parser) → next()           │
│                    Layer 4 (Auth) → next() OR res.send()    │
│                    Layer 5 (Route: GET /users) → res.json() │
│                    Layer 6 (404 Handler)                    │
│                    Layer 7 (Error Handler)                  │
└─────────────────────────────────────────────────────────────┘
```

Think of it as an **assembly line** in a car factory:

- **Station 1:** The chassis rolls in. A worker checks the VIN (logging).
- **Station 2:** A robot paints the frame (CORS headers).
- **Station 3:** The engine is installed (body parsing).
- **Station 4:** A security guard checks the worker's badge (authentication).
- **Station 5:** The wheels are attached (your route handler sends the response).

If any station stops the car, it leaves the factory immediately. If the guard rejects the badge, the car never reaches Station 5.

### WHY do we need it?

Without middleware, every route handler would be a monster:

```javascript
// NIGHTMARE SCENARIO: No middleware
app.get('/users', (req, res) => {
  // 1. Log the request
  console.log(`${req.method} ${req.url}`);

  // 2. Check CORS
  res.setHeader('Access-Control-Allow-Origin', '*');

  // 3. Parse the body (even though GET has no body!)
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    // 4. Check authentication
    const token = req.headers.authorization;
    if (!token) {
      res.status(401).send('Unauthorized');
      return;
    }

    // 5. FINALLY do the actual work
    res.json([{ id: 1, name: 'Ada' }]);
  });
});
```

Now imagine writing that **fifty times** for fifty routes. Middleware lets you write each concern **once** and reuse it:

```javascript
app.use(loggingMiddleware);
app.use(corsMiddleware);
app.use(express.json());
app.use(authMiddleware);

app.get('/users', getUsersHandler);      // Clean
app.get('/posts', getPostsHandler);      // Clean
app.post('/posts', createPostHandler);   // Clean
```

### WHAT HAPPENS if you don't use it?

- **Massive code duplication.** Every route reimplements auth, logging, and parsing.
- **Inconsistent security.** One developer forgets the auth check on `/admin/delete`.
- **Tight coupling.** Business logic is tangled with infrastructure concerns.

---

## 2. Writing Custom Middleware

### The Signature

A middleware function has this exact signature:

```javascript
function myMiddleware(req, res, next) {
  // Do something with req or res
  // Either call next() to continue...
  // Or send a response to stop here
  // Or call next(err) to jump to error handlers
}
```

### Example 1: Logging Middleware

```javascript
function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `${req.method} ${req.url} ${res.statusCode} — ${duration}ms`
    );
  });

  next();
}

app.use(requestLogger);
```

> **Why `res.on('finish')`?** Because `res.statusCode` is not finalized until the response is sent. By listening to the `'finish'` event, we capture the true status code and duration.

> **2025 Standard:** In production, replace `console.log` with **Pino**, the fastest JSON logger:
> ```javascript
> import pino from 'pino';
> const logger = pino({ level: 'info' });
> logger.info({ method: req.method, url: req.url });
> ```
> `console.log` is **synchronous** in Node.js. Under high load, it blocks the event loop.

### Example 2: Simulated Authentication Middleware

```javascript
function simulateServiceAuth(req, res, next) {
  const token = req.headers.authorization;

  if (!token || token !== `Bearer ${process.env.API_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Attach service identity — NOT a user. This pattern is for
  // service-to-service authentication only. Real user auth uses
  // JWT sessions or OAuth (see Module 04).
  req.service = { id: 'blog-service', name: 'Blog API Service' };
  next();
}

// Apply only to protected routes
app.use('/admin', simulateServiceAuth);
app.use('/api/posts', simulateServiceAuth);

> **Security Note:** Hardcoded secrets in source code will be leaked if the repository is exposed — always load secrets from environment variables. Shared API keys identify the *calling service*, not a person. Attaching a fake `req.user` object teaches learners to bypass real authentication, which leads to broken access control in production.

> **Key insight:** By attaching `req.service`, we pass data down the pipeline. Any route handler after this middleware can access `req.service.id`.

### Example 3: Error Handling Middleware

Error-handling middleware has **four parameters** instead of three. Express detects it by the arity (number of arguments):

```javascript
function globalErrorHandler(err, req, res, next) {
  console.error(err.stack);

  // Never leak stack traces in production!
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({ error: 'Internal server error' });
  } else {
    res.status(500).json({
      error: err.message,
      stack: err.stack
    });
  }
}

// MUST be registered AFTER all other middleware and routes
app.use(globalErrorHandler);
```

### WHAT HAPPENS if you forget `next()`?

The request **hangs**. The client waits 30–120 seconds until timeout. On a production server, hundreds of hung requests will exhaust memory and crash the process.

```javascript
// WRONG: Request dies here
app.use((req, res, next) => {
  console.log('I forgot to call next()');
});
```

---

## 3. Router Organization

### WHY not put everything in `app.js`?

In a real application, you might have 50+ routes. Putting them all in one file creates a **god file** — a single file that everyone is afraid to touch.

**The solution:** `express.Router()` lets you create **modular, mountable route handlers**.

### The Pattern

```javascript
// routes/users.js
import { Router } from 'express';
const router = Router();

router.get('/', (req, res) => res.json([{ id: 1, name: 'Ada' }]));
router.get('/:id', (req, res) => res.json({ id: req.params.id }));

export default router;
```

```javascript
// routes/posts.js
import { Router } from 'express';
const router = Router();

router.get('/', (req, res) => res.json([{ title: 'Hello' }]));
router.post('/', (req, res) => res.status(201).json(req.body));

export default router;
```

```javascript
// app.js
import express from 'express';
import userRouter from './routes/users.js';
import postRouter from './routes/posts.js';

const app = express();

app.use('/users', userRouter);
app.use('/posts', postRouter);

// Now available at:
// GET  /users
// GET  /users/42
// GET  /posts
// POST /posts
```

### Router Nesting & `mergeParams`

When you mount a router, the child router sees only the path **after** the mount point. But what if you need parent parameters?

```javascript
// routes/posts.js
const router = Router({ mergeParams: true });

router.get('/comments', (req, res) => {
  // Because of mergeParams, we can access :postId from the parent
  res.json({ postId: req.params.postId, comments: [] });
});

export default router;
```

```javascript
// app.js
import postRouter from './routes/posts.js';

app.use('/posts/:postId', postRouter);

// GET /posts/99/comments  →  req.params.postId === "99"
```

**WHAT HAPPENS without `mergeParams`?**

`req.params.postId` is **undefined**. Your code crashes or returns the wrong data, and you spend an hour debugging why the parameter "disappeared."

---

## 4. The Request/Response Lifecycle

Let's trace a single click from the browser to the response, using everything we know.

### Phase 1: DNS & TCP Connection

1. User clicks a link: `https://api.example.com/users`.
2. Browser resolves `api.example.com` to an IP address via DNS.
3. Browser opens a **TCP connection** to that IP on port 443.
4. TLS handshake happens (HTTPS encryption).

### Phase 2: HTTP Request Sent

The browser sends:

```http
GET /users HTTP/1.1
Host: api.example.com
Authorization: Bearer secret-token-123
Accept: application/json
```

### Phase 3: Kernel Accepts the Connection

The operating system's network stack accepts the TCP packet and notifies **libuv** (Node's I/O library).

### Phase 4: The Event Loop Wakes Up

During the **poll phase** of the Node.js event loop, the `'request'` event fires. Express's `app` function is the listener.

```javascript
// This is what app.listen() does internally:
http.createServer(app).listen(3000);
```

### Phase 5: Express Augments `req` and `res`

Express wraps the raw Node.js objects:

```javascript
// Conceptually:
req.__proto__ = app.request;   // Adds req.params, req.query, etc.
res.__proto__ = app.response;  // Adds res.json(), res.send(), etc.
```

### Phase 6: Stack Traversal

Express iterates its internal stack:

```
Match: Logging middleware      → Execute → next()
Match: CORS middleware         → Execute → next()
Match: Body parser             → Execute → next()
Match: Auth middleware         → Execute → next()
Match: Route GET /users        → Execute → res.json(users)
```

### Phase 7: Response Serialization

`res.json()` sets headers, serializes the object with `JSON.stringify()`, and writes it to the TCP socket.

### Phase 8: Connection Cleanup

If `Connection: keep-alive` is set, the TCP connection stays open for the next request. Otherwise, it closes.

```
┌─────────────┐     DNS/TLS      ┌─────────────┐     Kernel      ┌─────────────┐
│   Browser   │ ───────────────→ │   Server    │ ──────────────→ │    Node     │
│             │                  │   (OS)      │                 │   Event     │
└─────────────┘                  └─────────────┘                 │    Loop     │
                                                                  └──────┬──────┘
                                                                         │
                                                                  ┌──────▼──────┐
                                                                  │   Express   │
                                                                  │   Stack     │
                                                                  │  Traversal  │
                                                                  └──────┬──────┘
                                                                         │
                                                                  ┌──────▼──────┐
                                                                  │  Response   │
                                                                  │   Sent      │
                                                                  └─────────────┘
```

**Critical Insight:** If all your middleware is synchronous, the entire lifecycle happens in **one tick** of the event loop. If you perform async I/O (database query), the tick ends, and your callback resumes in a future tick.

---

## 5. Static Files & CDN Strategy

### WHAT is `express.static`?

`express.static` is built-in middleware that serves files from a directory:

```javascript
app.use(express.static('public'));
```

Now `public/style.css` is available at `http://localhost:3000/style.css`.

### WHY use a CDN in production?

Serving images, videos, and large CSS/JS files from your Express server is wasteful. Your Node process — your precious event loop chef — is spending time copying file bytes instead of handling API requests.

**Production architecture (2025 standard):**

```
                         ┌─────────────┐
      User Request ─────→│   CDN       │ (CloudFront, Cloudflare, Fastly)
                         │  (Static)   │ Serves images, CSS, JS from edge
                         └──────┬──────┘
                                │ Cache miss
                         ┌──────▼──────┐
                         │   Nginx     │ Reverse proxy, TLS termination
                         └──────┬──────┘
                                │ API request
                         ┌──────▼──────┐
                         │   Express   │ Business logic, JSON APIs
                         │   (Node)    │
                         └─────────────┘
```

**Express 5 Note:** The default for `dotfiles` changed from `'allow'` to `'ignore'`. If you serve ACME challenge files (Let's Encrypt) from `.well-known`, you must explicitly allow dotfiles:

```javascript
app.use('/.well-known', express.static('public/.well-known', { dotfiles: 'allow' }));
```

---

## 6. Template Engines

### WHAT are they?

Template engines generate HTML by combining static templates with dynamic data:

```javascript
import express from 'express';
const app = express();

app.set('view engine', 'pug');

app.get('/', (req, res) => {
  res.render('index', { title: 'Hey', message: 'Hello there!' });
});

> **XSS Prevention:** Never render user input directly in templates without escaping. Modern template engines (Pug, EJS, Handlebars) escape output by default, but disabling escaping with `!=` in Pug or `<%-` in EJS opens XSS vulnerabilities. Always validate and sanitize dynamic data before passing it to templates.
```

```pug
//- views/index.pug
html
  head
    title= title
  body
    h1= message
```

### WHY we mostly use JSON APIs now

In 2025, the dominant pattern is **separation of concerns:**

- **Backend** serves JSON APIs (`/api/users`, `/api/posts`).
- **Frontend** is a React/Vue/Next.js app that fetches JSON and renders HTML in the browser.

This is called an **API-first** or **Jamstack** architecture.

### WHEN templates still matter

- **Server-Side Rendering (SSR)** for SEO-critical pages (Next.js does this, often via Express).
- **Email generation:** You cannot run React inside an email client.
- **Admin dashboards** or internal tools where a full frontend team is overkill.
- **Legacy applications** being maintained, not rewritten.

**2025 Standard:** If you need SSR, use **Next.js** (which can run on an Express custom server). For pure APIs, skip templates entirely and return JSON.

---

## 7. Error Handling Middleware

### WHY order matters immensely

Express routes and middleware execute in the **exact order** they are registered. Error handlers are no exception.

**The rule:** Error-handling middleware must be registered **after** all other `app.use()` and route calls.

```javascript
import express from 'express';
const app = express();

// 1. Regular middleware
app.use(express.json());

// 2. Routes
app.get('/users', (req, res) => {
  throw new Error('Database exploded');
});

// 3. 404 handler (catches unknown routes)
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// 4. ERROR HANDLER — MUST BE LAST
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message });
});
```

### Express 5: Native Async Error Catching

In **Express 5**, if an `async` route handler throws or rejects, the error is **automatically** caught and passed to your error handler.

```javascript
// Express 5 — This just works
app.get('/users', async (req, res) => {
  const users = await db.getUsers(); // If this rejects, error handler catches it
  res.json(users);
});
```

In **Express 4**, an unhandled rejection in async middleware **crashes the process** or leaves the request hanging:

```javascript
// Express 4 — DANGEROUS
app.get('/users', async (req, res) => {
  const users = await db.getUsers(); // Rejection = unhandled crash!
  res.json(users);
});
```

**2025 Standard:** Use Express 5 for all new projects. If stuck on Express 4, wrap async handlers:

```javascript
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

app.get('/users', asyncHandler(async (req, res) => {
  const users = await db.getUsers();
  res.json(users);
}));
```

### WHAT HAPPENS if the error handler is registered too early?

```javascript
// WRONG: Error handler is BEFORE routes
app.use((err, req, res, next) => {
  res.status(500).send('Error');
});

app.get('/users', (req, res) => {
  throw new Error('Oops'); // This crashes the process instead of hitting the handler!
});
```

Because the error handler was registered first, Express does not consider it when the route throws. The error bubbles up uncaught.

---

## 8. Environment Configuration

### WHY `.env`?

Your code needs secrets: database passwords, API keys, session tokens. You **cannot** hardcode these:

```javascript
// NEVER DO THIS — This will be leaked on GitHub
const dbPassword = 'SuperSecret123!';
```

Instead, store them in a `.env` file that is **never committed** to version control:

```
# .env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgres://user:pass@localhost:5432/mydb
JWT_SECRET=your-256-bit-secret-here
```

Load it with **dotenv**:

```javascript
import 'dotenv/config'; // Must be the VERY FIRST import
import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

console.log(process.env.DATABASE_URL); // Safe access
```

### The `.gitignore`

```gitignore
node_modules/
.env
.env.local
.env.production
dist/
```

### WHAT HAPPENS if you commit secrets?

- Bots scan GitHub for API keys within **seconds** of a commit.
- Attackers rack up $50,000 AWS bills.
- Your database is dumped and sold.
- You spend a weekend rotating every credential in your infrastructure.

> **Real-world trauma:** Thousands of developers have accidentally committed `.env` files. GitHub now has secret scanning, but by the time you get the alert, the damage is done.

### 2025 Standard: Use `.env.example`

Commit a **template** so teammates know what variables to set:

```
# .env.example
PORT=3000
NODE_ENV=development
# Generate a strong secret: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
API_SECRET=
```

### `src/middleware/logger.js`

```javascript
export function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `${new Date().toISOString()} ${req.method} ${req.url} ${res.statusCode} ${duration}ms`
    );
  });

  next();
}
```

### `src/middleware/auth.js`

```javascript
export function simulateAuth(req, res, next) {
  const token = req.headers.authorization;

  if (!token || !token.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }

  const apiSecret = process.env.API_SECRET;
  const provided = token.slice(7);

  if (provided !== apiSecret) {
    return res.status(403).json({ error: 'Invalid token' });
  }

  req.user = { id: 1, name: 'Admin', role: 'admin' };
  next();
}
```

### `src/middleware/errorHandler.js`

```javascript
export function globalErrorHandler(err, req, res, next) {
  console.error('Error:', err);

  if (process.env.NODE_ENV === 'production') {
    return res.status(err.status || 500).json({
      error: 'Internal server error'
    });
  }

  res.status(err.status || 500).json({
    error: err.message,
    stack: err.stack
  });
}
```

### `src/services/postService.js`

```javascript
// In-memory "database"
const posts = [
  { id: 1, title: 'Hello World', content: 'My first post', authorId: 1 },
  { id: 2, title: 'Express Tips', content: 'Middleware is magic', authorId: 1 }
];

let nextId = 3;

export const postService = {
  getAll() {
    return posts;
  },

  getById(id) {
    return posts.find(p => p.id === Number(id));
  },

  create(data) {
    const post = {
      id: nextId++,
      title: data.title,
      content: data.content,
      authorId: data.authorId || 1,
      createdAt: new Date().toISOString()
    };
    posts.push(post);
    return post;
  },

  update(id, data) {
    const post = posts.find(p => p.id === Number(id));
    if (!post) return null;
    Object.assign(post, data, { id: post.id, updatedAt: new Date().toISOString() });
    return post;
  },

  remove(id) {
    const idx = posts.findIndex(p => p.id === Number(id));
    if (idx === -1) return false;
    posts.splice(idx, 1);
    return true;
  }
};
```

### `src/services/commentService.js`

```javascript
const comments = [
  { id: 1, postId: 1, text: 'Great post!', authorId: 2 },
  { id: 2, postId: 1, text: 'Thanks for sharing', authorId: 3 }
];

let nextId = 3;

export const commentService = {
  getByPostId(postId) {
    return comments.filter(c => c.postId === Number(postId));
  },

  create(postId, data) {
    const comment = {
      id: nextId++,
      postId: Number(postId),
      text: data.text,
      authorId: data.authorId || 1,
      createdAt: new Date().toISOString()
    };
    comments.push(comment);
    return comment;
  }
};
```

### `src/controllers/postController.js`

```javascript
import { postService } from '../services/postService.js';

export const postController = {
  getAll(req, res) {
    res.json(postService.getAll());
  },

  getById(req, res) {
    const post = postService.getById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    res.json(post);
  },

  create(req, res) {
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }
    const post = postService.create({ title, content, authorId: req.service?.id });
    res.status(201).json(post);
  },

  update(req, res) {
    // Prevent mass assignment: only allow specific fields from req.body
    const { title, content } = req.body;
    const post = postService.update(req.params.id, { title, content });
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    res.json(post);
  },

  remove(req, res) {
    const success = postService.remove(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Post not found' });
    }
    res.status(204).send();
  }
};
```

### `src/controllers/commentController.js`

```javascript
import { commentService } from '../services/commentService.js';

export const commentController = {
  getByPost(req, res) {
    const comments = commentService.getByPostId(req.params.postId);
    res.json(comments);
  },

  create(req, res) {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    const comment = commentService.create(req.params.postId, {
      text,
      authorId: req.service?.id
    });
    res.status(201).json(comment);
  }
};
```

### `src/routes/posts.js`

```javascript
import { Router } from 'express';
import { postController } from '../controllers/postController.js';

const router = Router();

router.get('/', postController.getAll);
router.get('/:id', postController.getById);
router.post('/', postController.create);
router.patch('/:id', postController.update);
router.delete('/:id', postController.remove);

export default router;
```

### `src/routes/comments.js`

```javascript
import { Router } from 'express';
import { commentController } from '../controllers/commentController.js';

const router = Router({ mergeParams: true });

router.get('/', commentController.getByPost);
router.post('/', commentController.create);

export default router;
```

### `src/app.js`

```javascript
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';

import { requestLogger } from './middleware/logger.js';
import { simulateAuth } from './middleware/auth.js';
import { globalErrorHandler } from './middleware/errorHandler.js';
import postRouter from './routes/posts.js';
import commentRouter from './routes/comments.js';

export function createApp() {
  const app = express();

  // 1. Security
  app.use(helmet());
  app.use(rateLimit({
    windowMs: 60 * 1000, // 1 minute — 100 requests/min is reasonable for SPAs
    max: 100,
    standardHeaders: true,
    legacyHeaders: false
  }));
  app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || [] }));

  // 2. Parsing
  app.use(express.json());

  // 3. Logging
  app.use(requestLogger);

  // 4. Health check (public)
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', env: process.env.NODE_ENV });
  });

  // 5. Authentication gate (service-to-service only)
  app.use(simulateServiceAuth);

  // 6. Protected routes
  app.use('/api/posts', postRouter);
  app.use('/api/posts/:postId/comments', commentRouter);

  // 7. 404
  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  // 8. Error handler — ALWAYS LAST
  app.use(globalErrorHandler);

  return app;
}
```

### `server.js`

```javascript
import 'dotenv/config';
import { createApp } from './src/app.js';

const PORT = process.env.PORT || 3000;
const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`Blog API running at http://localhost:${PORT}`);
});

// Graceful shutdown
function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });

  // Force exit after 30s
  setTimeout(() => {
    console.error('Forced shutdown');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

### Testing the API

Start the server:

```bash
node server.js
```

Test with curl:

```bash
# Health check (no auth needed)
curl http://localhost:3000/health

# Get all posts (needs auth)
curl http://localhost:3000/api/posts \
  -H "Authorization: Bearer blog-api-secret-2025"

# Create a post
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer blog-api-secret-2025" \
  -d '{"title":"New Post","content":"Hello from Module 02"}'

# Get comments for a post
curl http://localhost:3000/api/posts/1/comments \
  -H "Authorization: Bearer blog-api-secret-2025"

# Missing auth (should 401)
curl http://localhost:3000/api/posts

# Invalid route (should 404)
curl http://localhost:3000/api/unknown \
  -H "Authorization: Bearer blog-api-secret-2025"
```

---

## Summary

| Concept | WHAT | WHY | WHAT IF WRONG |
|---------|------|-----|---------------|
| **Middleware Pipeline** | Ordered chain of functions processing requests | Reusable cross-cutting concerns (auth, logging, parsing) | Duplicated code, inconsistent security, spaghetti logic |
| **Custom Middleware** | Functions with signature `(req, res, next)` | Inject logic at any point in the request lifecycle | Hung requests, leaked memory, security bypass |
| **Router Organization** | `express.Router()` for modular routes | Prevents god files, enables team scaling | 500-line files, merge conflicts, untestable code |
| **Request Lifecycle** | DNS → TCP → HTTP → Event Loop → Stack → Response | Understand where time is spent and where to optimize | Blind optimization, blaming Express for your slow database |
| **Static Files / CDN** | `express.static` for assets; CDN for production | Offload file serving so Node handles APIs only | Slow APIs, overloaded event loop, poor UX |
| **Template Engines** | Server-side HTML generation | Emails, SSR, legacy pages | Unnecessary complexity in API-only projects |
| **Error Handling** | 4-parameter middleware at the END of the stack | Catches all thrown errors and formats responses | Crashed processes, leaked stack traces, hung requests |
| **`.env`** | Environment-specific secrets file | Keep credentials out of code | Committed secrets, $50K AWS bills, data breaches |
| **Project Structure** | Layered: routes → controllers → services | Separates HTTP from business logic | Untestable code, tight coupling, frontend/backend confusion |
| **Middleware Order** | Security → Parse → Auth → Routes → 404 → Error | Each layer depends on the previous one being ready | Auth bypass, undefined bodies, rate limit failures |
| **Memory Leaks** | Unreleased references preventing GC | Long-running processes must stay healthy | Server crashes every 6 hours under load |

You now understand Express as an assembly line. You know why order matters, how memory leaks form, and how to structure a production-ready API. In the next module, we will connect to real databases, add authentication with JSON Web Tokens, and deploy to the cloud.

---

*Sources: Express.js Official Documentation, Express 5 Release Notes, Node.js Event Loop Guide, Fastify Benchmarks, OWASP Security Guidelines, Express GitHub Repository*
