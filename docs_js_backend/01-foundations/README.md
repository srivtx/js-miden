# Module 01: Absolute Foundations — From Zero to Your First Server

> **Welcome.** If you have never written a backend before, you are in the right place. By the end of this module, you will understand *why* servers exist, *how* Node.js runs them, and *what* Express.js actually does under the hood. Then you will build a working calculator API that you can test with your browser.
> 
> **Prerequisites:** You know what JavaScript is. That is it.

---

## Table of Contents

1. [What Is a Backend?](#1-what-is-a-backend)
2. [What Is Node.js?](#2-what-is-nodejs)
3. [What Is Express.js?](#3-what-is-expressjs)
4. [Setting Up Your Environment](#4-setting-up-your-environment)
5. [Your First Server](#5-your-first-server)
6. [Understanding `req`, `res`, and `next`](#6-understanding-req-res-and-next)
7. [The Event Loop: The One Thing You Cannot Ignore](#7-the-event-loop-the-one-thing-you-cannot-ignore)
8. [npm, package.json, and node_modules](#8-npm-packagejson-and-node_modules)
9. [Common Beginner Mistakes](#9-common-beginner-mistakes)
10. [Mini Project: Calculator API](#10-mini-project-calculator-api)

---

## 1. What Is a Backend?

### WHAT is it?

Every website or app you use is a conversation between two computers:

- **The client** — your phone, laptop, or browser. This is the *frontend*.
- **The server** — a computer somewhere in a data center (or your laptop) that holds data, runs logic, and decides what the client receives. This is the *backend*.

Think of a **restaurant**:

- The **dining room** (frontend) is where you sit, look at the menu, and enjoy the meal.
- The **kitchen** (backend) is where the food is prepared, ingredients are stored, and recipes are executed.
- The **waiter** (HTTP / the internet) carries your order to the kitchen and brings the food back.

Without the kitchen, the dining room is just an empty room with nice chairs.

Or think of a **bank**:

- The **teller window** (frontend) is where you fill out a deposit slip.
- The **vault and accounting system** (backend) is where your money is actually stored, transferred, and recorded.
- The **teller** (HTTP) takes your slip to the back office and returns your receipt.

The backend is where the *real work* happens: storing data, checking passwords, processing payments, sending emails, and enforcing rules.

### WHY do we need it?

You *cannot* put your database password inside a mobile app. Anyone who downloads the app can read the code and steal your data. You *cannot* let a user's browser directly charge another user's credit card. You need a trusted intermediary — the backend — to validate, secure, and coordinate everything.

### WHAT HAPPENS if we don't have one?

If you try to build a "full" app with only a frontend:

- **Your API keys and secrets are exposed.** Every user sees them in the browser's developer tools.
- **You cannot share data between users.** User A has no way to see User B's posts because there is no central database.
- **You cannot enforce rules.** A malicious user can modify the frontend code to bypass validations.
- **You cannot send emails or push notifications.** Browsers cannot reliably do this on their own.

> **Real-World Analogy:** Imagine a restaurant with no kitchen. The waiter takes your order, walks to the back, and shrugs. You starve.

---

## 2. What Is Node.js?

### WHAT is it?

**Node.js** is a program that lets you run JavaScript *outside* the browser. Before 2009, JavaScript only ran in browsers like Chrome or Firefox. A brilliant engineer named **Ryan Dahl** changed that. He took Chrome's super-fast JavaScript engine (called **V8**) and wrapped it with tools to access files, networks, and the operating system.

Node.js is **not** a programming language. It is a **runtime** — an environment where JavaScript programs can execute on a server, just like the browser is a runtime for JavaScript on your laptop.

### WHY was it created?

In 2009, building servers in PHP, Java, or Python worked like this:

```
User 1 connects → Server starts a new thread → Waits for database → Responds → Thread dies
User 2 connects → Server starts a new thread → Waits for database → Responds → Thread dies
```

Every user got their own dedicated worker. This is fine for small sites, but when you have 10,000 users, you run out of memory and CPU creating all those workers.

Ryan Dahl asked: *"What if one single worker could juggle thousands of users at once, never waiting around for the database to answer?"*

This is the **event loop**.

### The Event Loop Explained: The Single Chef

Imagine a restaurant with **one chef** and a **ticket rail**.

- A waiter brings an order (a request comes in).
- The chef reads it. If the dish is a salad (simple, no waiting), the chef makes it immediately and hands it back.
- If the dish is a roast chicken (takes time in the oven), the chef puts it in the oven, writes a note on the ticket rail ("Check oven in 45 minutes"), and immediately takes the next order.
- The chef **never stands still waiting** for the oven. The moment the oven dings, the chef finishes that dish and hands it out.

That ticket rail is the **event loop**. Node.js is the chef. The oven is the **file system** or **database**.

```
┌─────────────────────────────────────────┐
│           THE EVENT LOOP CHEF           │
├─────────────────────────────────────────┤
│                                         │
│   Waiter: "Order 1: Salad"              │
│   Chef:  [makes salad] → DONE           │
│                                         │
│   Waiter: "Order 2: Roast chicken"      │
│   Chef:  [puts in oven] → TICKET RAIL   │
│                                         │
│   Waiter: "Order 3: Soup"               │
│   Chef:  [makes soup] → DONE            │
│                                         │
│   TICKET RAIL: "Order 2 ready!"         │
│   Chef:  [plates chicken] → DONE        │
│                                         │
└─────────────────────────────────────────┘
```

Because the chef never blocks, one chef can serve thousands of tables. This is why Node.js is **single-threaded yet handles massive concurrency**.

### WHAT HAPPENS if you ignore the event loop?

If the chef decides to **stand and stare at the oven** instead of taking new orders, the restaurant grinds to a halt. In Node.js, this is called **blocking the event loop**.

We will see a real code example in [Section 7](#7-the-event-loop-the-one-thing-you-cannot-ignore).

---

## 3. What Is Express.js?

### WHAT is it?

**Express.js** is the most popular web framework for Node.js. It is a thin, elegant layer on top of Node's built-in `http` module.

Node.js *can* build servers by itself:

```javascript
const http = require('http');

const server = http.createServer((req, res) => {
  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Hello World');
  } else if (req.url === '/about' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('About Us');
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(3000);
```

This works, but it is painful. Every new route requires another `if/else`. Parsing JSON bodies, handling cookies, serving files, and managing errors all require manual, error-prone code.

Express turns that mess into this:

```javascript
import express from 'express';
const app = express();

app.get('/', (req, res) => res.send('Hello World'));
app.get('/about', (req, res) => res.send('About Us'));

app.listen(3000);
```

### WHY not just use Node's `http` module?

You *could*. But you would end up reinventing Express — badly. Express gives you:

- **Routing:** Clean URL patterns (`/users/:id`) instead of manual string parsing.
- **Middleware:** A pipeline where you can plug in authentication, logging, body parsing, and more — in a specific order.
- **Request/Response helpers:** `res.json()`, `res.send()`, `req.query` — no more manual header setting.
- **Error handling:** A dedicated pipeline for catching and formatting errors.
- **Ecosystem:** 100,000+ packages on npm that assume you are using Express.

### WHAT HAPPENS if you don't use a framework?

You spend 80% of your time solving problems that have already been solved, and the remaining 20% introducing subtle bugs:

- **Security holes:** Forgetting to sanitize headers, leaving you vulnerable to XSS or CSRF.
- **Code spaghetti:** A 500-line `if/else` chain for routing.
- **No standard patterns:** Every developer on your team invents their own way to parse JSON or handle errors.

> **Think of it this way:** Node's `http` module gives you flour, eggs, and a fire. Express gives you a kitchen with knives, pans, and a recipe book. You can still burn the food, but at least you are not making a cake with your bare hands.

---

## 4. Setting Up Your Environment

### WHAT do you need?

To write Express servers, you need two things:

1. **Node.js** (the runtime).
2. **A package manager** (the tool that downloads libraries like Express).

### Step 1: Install Node.js

As of 2025, you should use **Node.js 20 LTS or higher**. Node 18 is the bare minimum, but 20+ gives you native `fetch()`, stable `AbortSignal.timeout()`, and better performance.

Check your version:

```bash
node --version
```

If it says `v20.x.x` or higher, you are good. If not, download the LTS from [nodejs.org](https://nodejs.org).

### Step 2: Choose a Package Manager

Node comes with **npm** by default. But you have three major choices in 2025:

| Tool | Speed | Disk Usage | Best For |
|------|-------|------------|----------|
| **npm** | Good | High (duplicates deps) | Beginners, built-in convenience |
| **Yarn** | Good | High | Monorepos, Plug'n'Play |
| **pnpm** | Fastest | Lowest (hard links) | Everyone, especially in 2025 |

#### WHY pnpm is better (2025 standard)

`pnpm` ("performant npm") does one magical thing differently: it stores every package version **once** on your disk, then **hard-links** it into your projects.

- **npm** installs `lodash` in Project A and `lodash` in Project B = two copies on disk.
- **pnpm** installs `lodash` once, then creates a tiny reference in both projects = one copy on disk.

On a team with 20 microservices, this saves **gigabytes** of disk space and installs dependencies in **half the time**.

Install pnpm globally:

```bash
npm install -g pnpm
```

From now on, replace `npm install` with `pnpm install` and `npm init` with `pnpm init`.

### Step 3: Initialize Your Project

```bash
mkdir my-first-server
cd my-first-server
pnpm init
```

This creates a `package.json` file (we will explain it in [Section 8](#8-npm-packagejson-and-node_modules)).

Install Express:

```bash
pnpm add express
```

### WHAT HAPPENS if you use an old Node version?

- **Node 16 and below** are end-of-life. They receive no security patches.
- **No native `fetch()`:** You need external libraries like `axios` or `node-fetch`.
- **Express 5 requires Node 18+:** If you want modern async handling, you must upgrade.

---

## 5. Your First Server

### WHAT is it?

Let's write the smallest possible Express server. Create a file named `server.js`:

```javascript
import express from 'express';

const app = express();
const PORT = 3000;

app.get('/', (req, res) => {
  res.send('Hello, World!');
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

> **Production Note:** If your app runs behind a reverse proxy (NGINX, Cloudflare, AWS ALB), enable `trust proxy` before your routes so `req.ip` and Express features work correctly:
> ```javascript
> app.set('trust proxy', 1);
> ```
```

Run it:

```bash
node server.js
```

Open your browser to `http://localhost:3000`. You should see "Hello, World!".

### `require` vs `import`: CommonJS vs ESM

Node.js originally used **CommonJS** (`require`):

```javascript
const express = require('express');
```

Today, **ES Modules** (`import`) are the standard:

```javascript
import express from 'express';
```

| Feature | CommonJS (`require`) | ESM (`import`) |
|---------|---------------------|----------------|
| Standard | Node.js invented | Official JavaScript standard (ES6+) |
| Top-level `await` | No | Yes |
| Tree-shaking | No | Yes (smaller bundles) |
| Async loading | No | `import()` is dynamic |
| Future-proof | Maintenance mode only | Active development |

#### WHY ESM is the future (2025 standards)

- The entire frontend ecosystem (Vite, Webpack, Rollup) uses ESM.
- TypeScript natively outputs ESM.
- Node.js now treats `.js` files as ESM if your `package.json` includes `"type": "module"`.
- **Express 5 documentation uses ESM examples by default.**

To enable ESM in your project, add this to your `package.json`:

```json
{
  "name": "my-first-server",
  "version": "1.0.0",
  "type": "module"
}
```

Now every `.js` file in that folder is treated as ESM, and you can use `import` everywhere.

> **Warning:** Enabling `"type": "module"` removes CommonJS globals `__dirname` and `__filename`. In ESM files, use `import.meta.url` instead:
> ```javascript
> import { fileURLToPath } from 'url';
> import { dirname } from 'path';
> const __filename = fileURLToPath(import.meta.url);
> const __dirname = dirname(__filename);
> ```

#### WHAT HAPPENS if you mix them?

You get this cryptic error:

```
Error [ERR_REQUIRE_ESM]: require() of ES Module ... not supported.
```

**Rule of thumb in 2025:** Start every new project with `"type": "module"`. Only use `require()` if you are maintaining a legacy codebase from 2018.

---

## 6. Understanding `req`, `res`, and `next`

These three objects are the **holy trinity** of Express. Every middleware and every route handler receives them. Understanding them deeply separates beginners from professionals.

### `req` — The Request Object

**WHAT is it?**

`req` (short for **request**) is an object that contains everything the *client* sent to your server. It is an augmented version of Node's native `IncomingMessage`.

**Key properties:**

| Property | What It Holds | Example |
|----------|--------------|---------|
| `req.method` | HTTP verb | `"GET"`, `"POST"`, `"DELETE"` |
| `req.url` | Full URL string | `"/users/42?active=true"` |
| `req.path` | Path only | `"/users/42"` |
| `req.query` | Parsed query string | `{ active: "true" }` |
| `req.params` | URL path parameters | `{ id: "42" }` |
| `req.body` | Parsed request body (after middleware) | `{ name: "Ada" }` |
| `req.headers` | All HTTP headers | `{ "content-type": "application/json" }` |
| `req.ip` | Client's IP address | `"192.168.1.1"` |

**Example:**

```javascript
app.get('/users/:id', (req, res) => {
  console.log(req.params.id);   // "42"
  console.log(req.query.active); // "true"
  res.send(`User ${req.params.id}`);
});
```

**WHAT HAPPENS if you don't understand `req`?**

You try to read `req.body` before adding body-parsing middleware and get `undefined` (or `{}` in Express 4, but **`undefined` in Express 5**). You spend two hours debugging why your POST request has no data.

```javascript
// WRONG: req.body is undefined because express.json() is missing
app.post('/users', (req, res) => {
  console.log(req.body); // undefined
});

// RIGHT
app.use(express.json({ limit: '10kb' })); // This MUST come before routes that need req.body
// The limit prevents huge JSON payloads from exhausting server memory
app.post('/users', (req, res) => {
  console.log(req.body); // { name: "Ada" }
});
```

### `res` — The Response Object

**WHAT is it?**

`res` (short for **response**) is how you send data *back* to the client. It wraps Node's native `ServerResponse` with helper methods.

**Key methods:**

| Method | What It Does |
|--------|-------------|
| `res.send(data)` | Sends data (auto-detects type: string, HTML, JSON) |
| `res.json(obj)` | Sends JSON with correct `Content-Type` header |
| `res.status(code)` | Sets HTTP status code |
| `res.redirect(url)` | Tells browser to go elsewhere |
| `res.render(view, data)` | Renders a template (covered in Module 02) |

**Example:**

```javascript
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});
```

**WHAT HAPPENS if you don't send a response?**

The client's browser will spin forever, waiting for a reply that never comes. After 30–120 seconds, the connection times out. On a busy server, these "hung" requests accumulate and crash your application.

```javascript
// WRONG: The client waits forever
app.get('/broken', (req, res) => {
  console.log('I forgot to send a response');
});
```

### `next` — The Pipeline Continuer

**WHAT is it?**

`next` is a function. When you call it, Express moves to the **next middleware** in the pipeline.

```javascript
app.use((req, res, next) => {
  console.log('Middleware 1');
  next(); // Go to Middleware 2
});

app.use((req, res, next) => {
  console.log('Middleware 2');
  next(); // Go to the route handler
});

app.get('/', (req, res) => {
  res.send('Done!');
});
```

If you **don't** call `next()` and you **don't** send a response, the request hangs.

**WHAT HAPPENS if you call `next()` after sending a response?**

You get the dreaded `Error [ERR_HTTP_HEADERS_SENT]: Cannot set headers after they are sent to the client`. The first middleware sent the response; the second one tried to send another.

```javascript
// WRONG
app.use((req, res, next) => {
  res.send('First response');
  next(); // DON'T do this
});

app.get('/', (req, res) => {
  res.send('Second response'); // CRASH
});
```

> **Golden Rule:** In any middleware or route handler, you must do **exactly one** of these:
> 1. Call `next()` to pass control forward, **or**
> 2. Send a response (`res.send()`, `res.json()`, etc.) to end the request.
> Never both. Never neither.

---

## 7. The Event Loop: The One Thing You Cannot Ignore

We introduced the event loop in [Section 2](#2-what-is-nodejs). Now let's see what happens when you **disrespect** it.

### The Blocking Example

Create `blocking-server.js`:

```javascript
import express from 'express';
const app = express();

// A deliberately slow, CPU-intensive function
function slowCalculation() {
  let sum = 0;
  for (let i = 0; i < 5_000_000_000; i++) {
    sum += i;
  }
  return sum;
}

app.get('/fast', (req, res) => {
  res.send('This is fast!');
});

app.get('/slow', (req, res) => {
  const result = slowCalculation(); // BLOCKS THE EVENT LOOP
  res.send(`Result: ${result}`);
});

app.listen(3000, () => console.log('Server on port 3000'));
```

Open two browser tabs:
1. `http://localhost:3000/slow` — start this first.
2. `http://localhost:3000/fast` — try this second.

**What you will observe:**

The `/fast` route will **not respond** until `/slow` finishes. Every other user on your server is frozen solid while Node.js counts to 5 billion.

### WHY does this happen?

Remember the single chef. The chef is making the "slow" dish by counting to 5 billion. The chef cannot stop counting to make the "fast" salad. Every other order sits on the counter, getting cold.

Node.js can only do **one thing at a time** in JavaScript-land. It juggles thousands of users only because it **never waits** for slow tasks. The moment you make it wait, the juggling stops.

### The RIGHT way (2025 standards)

If you must do heavy CPU work, **offload it** using Node's `worker_threads`:

```javascript
import express from 'express';
import { Worker } from 'worker_threads';

const app = express();

app.get('/slow', (req, res) => {
  const worker = new Worker('./calculation-worker.js');
  worker.postMessage('start');
  worker.once('message', (result) => {
    res.send(`Result: ${result}`);
  });
});

app.get('/fast', (req, res) => {
  res.send('This is fast!');
});

app.listen(3000);
```

`calculation-worker.js`:

```javascript
import { parentPort } from 'worker_threads';

parentPort.once('message', () => {
  let sum = 0;
  for (let i = 0; i < 5_000_000_000; i++) {
    sum += i;
  }
  parentPort.postMessage(sum);
});
```

Now the heavy math runs in a **separate thread**, and the event loop chef is free to serve salads.

### Detect blocking in development

Node 20+ provides a built-in flag:

```bash
node --trace-sync-io server.js
```

This warns you every time you use a synchronous I/O call (like `fs.readFileSync`). Use it religiously during development.

---

## 8. npm, package.json, and node_modules

### WHAT is npm?

**npm** (Node Package Manager) is the world's largest software registry. It is where 3 million+ JavaScript libraries live. When you type `pnpm add express`, you are downloading the Express package from the npm registry.

### WHAT is package.json?

It is a manifest file that describes your project:

```json
{
  "name": "my-first-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "express": "^5.2.1"
  }
}
```

| Field | Meaning |
|-------|---------|
| `name` | Your project's name. |
| `version` | Semantic version (MAJOR.MINOR.PATCH). |
| `type: "module"` | Enables ESM / `import` syntax. |
| `scripts` | Shortcuts you run with `pnpm run dev`. |
| `dependencies` | Packages required to *run* your app. |
| `devDependencies` | Packages needed only for *development* (testing, linting). |

### WHAT is node_modules?

It is the folder where downloaded packages live. It is often enormous (hundreds of megabytes) because every dependency can have its own dependencies.

> **NEVER commit `node_modules` to git.** Add it to your `.gitignore` file. Anyone who clones your repo can recreate it by running `pnpm install`.

### WHY dependencies matter: The left-pad Incident

In March 2016, a developer named Azer Koçulu unpublished a tiny 11-line package called `left-pad` from npm. The problem? Thousands of major projects — including React, Babel, and Node itself — depended on it, directly or indirectly.

The internet **broke**. Builds failed worldwide. Companies could not deploy.

**Lesson:** Dependencies are not "free." Every package you install is a trust relationship. In 2025, the standard practice is:

- **Audit regularly:** `pnpm audit`
- **Use exact versions in production:** Pin versions in `package.json` or use lockfiles (`pnpm-lock.yaml`).
- **Minimize dependencies:** Do you really need a 2MB library to left-pad a string?

### WHAT HAPPENS if you ignore lockfiles?

Without a lockfile, running `pnpm install` tomorrow might install `express 5.3.0` instead of `5.2.1`. If `5.3.0` has a bug, your production server breaks even though you changed no code.

**pnpm generates `pnpm-lock.yaml` automatically. Commit it to git.**

---

## 9. Common Beginner Mistakes

### Mistake 1: Port Already in Use

**Error:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**What happened:** Another Node process is already using port 3000. Maybe you forgot to stop a previous server.

**Fix:**
```bash
# Find the process
lsof -i :3000

# Kill it gracefully first (replace 12345 with the PID)
kill -15 12345

# If it doesn't respond after 5-10 seconds, force kill as last resort
# kill -9 12345
```

Or use an environment variable so your port is configurable:

```javascript
const PORT = process.env.PORT || 3000;
app.listen(PORT);
```

### Mistake 2: Forgetting to Send a Response

**Symptom:** Browser shows "This site can't be reached" or spins forever.

**Cause:**
```javascript
app.get('/broken', (req, res) => {
  console.log('I am here');
  // Forgot res.send() or next()
});
```

**Fix:** Every route handler must end the request.

### Mistake 3: `req.body` is undefined

**Symptom:** POST requests have no body data.

**Cause:** You forgot `app.use(express.json())`.

**Fix:**
```javascript
import express from 'express';
const app = express();

app.use(express.json()); // BEFORE your routes

app.post('/users', (req, res) => {
  console.log(req.body); // Now it works
});
```

> **Note:** In Express 4, `req.body` defaulted to `{}` if no parser was present. In **Express 5**, it is `undefined`. This is a common migration trap.

### Mistake 4: Editing `node_modules`

**Symptom:** "It works on my machine!" Then you deploy and it breaks.

**Cause:** You manually edited files inside `node_modules/` to "fix" something.

**Fix:** Never touch `node_modules`. If a package is broken, patch it properly with `pnpm patch` or fork it.

### Mistake 5: Not Handling Errors in Async Code (Express 4)

**Symptom:** Server crashes on database errors.

**Cause:**
```javascript
// Express 4 - DANGEROUS
app.get('/users', async (req, res) => {
  const users = await db.getUsers(); // If this throws, the process may crash
  res.json(users);
});
```

**Fix for Express 4:** Wrap async handlers:
```javascript
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

app.get('/users', asyncHandler(async (req, res) => {
  const users = await db.getUsers();
  res.json(users);
}));
```

**Fix for Express 5 (2025 standard):** Nothing. Express 5 catches async rejections automatically.

---

## 10. Mini Project: Calculator API

Let's solidify everything by building a real API. No database needed — just math.

### Project Structure

```
calculator-api/
├── package.json
├── server.js
└── routes/
    └── calculator.js
```

### Step 1: Initialize

```bash
mkdir calculator-api
cd calculator-api
pnpm init
pnpm add express
```

Add `"type": "module"` to `package.json`.

### Step 2: The Router (`routes/calculator.js`)

```javascript
import { Router } from 'express';

const router = Router();

// GET /calc/add?a=5&b=3
router.get('/add', (req, res) => {
  const a = parseFloat(req.query.a);
  const b = parseFloat(req.query.b);

  if (isNaN(a) || isNaN(b)) {
    return res.status(400).json({ error: 'Parameters "a" and "b" must be numbers' });
  }

  res.json({ operation: 'add', a, b, result: a + b });
});

// GET /calc/subtract?a=10&b=4
router.get('/subtract', (req, res) => {
  const a = parseFloat(req.query.a);
  const b = parseFloat(req.query.b);

  if (isNaN(a) || isNaN(b)) {
    return res.status(400).json({ error: 'Parameters "a" and "b" must be numbers' });
  }

  res.json({ operation: 'subtract', a, b, result: a - b });
});

// GET /calc/multiply?a=7&b=6
router.get('/multiply', (req, res) => {
  const a = parseFloat(req.query.a);
  const b = parseFloat(req.query.b);

  if (isNaN(a) || isNaN(b)) {
    return res.status(400).json({ error: 'Parameters "a" and "b" must be numbers' });
  }

  res.json({ operation: 'multiply', a, b, result: a * b });
});

// GET /calc/divide?a=20&b=4
router.get('/divide', (req, res) => {
  const a = parseFloat(req.query.a);
  const b = parseFloat(req.query.b);

  if (isNaN(a) || isNaN(b)) {
    return res.status(400).json({ error: 'Parameters "a" and "b" must be numbers' });
  }

  if (b === 0) {
    return res.status(400).json({ error: 'Cannot divide by zero' });
  }

  res.json({ operation: 'divide', a, b, result: a / b });
});

export default router;
```

### Step 3: The Server (`server.js`)

```javascript
import express from 'express';
import calculatorRouter from './routes/calculator.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware: log every request
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} — ${req.method} ${req.url}`);
  next();
});

// Mount the calculator router
app.use('/calc', calculatorRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler (4 arguments!)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

app.listen(PORT, () => {
  console.log(`Calculator API running at http://localhost:${PORT}`);
});
```

### Step 4: Test It

Start the server:

```bash
node server.js
```

Test in your browser or with curl:

```bash
curl "http://localhost:3000/calc/add?a=5&b=3"
# → {"operation":"add","a":5,"b":3,"result":8}

curl "http://localhost:3000/calc/divide?a=10&b=0"
# → {"error":"Cannot divide by zero"}

curl "http://localhost:3000/calc/add?a=hello&b=3"
# → {"error":"Parameters \"a\" and \"b\" must be numbers"}
```

### What You Just Learned

- **ESM imports** in a real project.
- **Router organization** (separating routes into files).
- **Middleware** (logging every request).
- **Query parameter parsing** with validation.
- **Error handling** (division by zero, invalid input, 404s).
- **Environment-based ports** (`process.env.PORT`).

---

## Summary

| Concept | WHAT | WHY | WHAT IF WRONG |
|---------|------|-----|---------------|
| **Backend** | Server-side logic & data storage | Security, shared state, business rules | Exposed secrets, no user collaboration |
| **Node.js** | JavaScript runtime using an event loop | Handles thousands of connections on one thread | Blocking = frozen server |
| **Express.js** | Thin framework over Node's `http` | Routing, middleware, helpers | Reinventing the wheel with bugs |
| **ESM (`import`)** | Modern JavaScript module system | Standard, tree-shakeable, top-level await | Mixed modules cause crashes |
| **`req`** | Client's incoming data object | Read what the user sent | Missing body parsers, undefined data |
| **`res`** | Server's outgoing response object | Send data back to the client | Hung requests, timeouts, crashes |
| **`next()`** | Function to continue the pipeline | Chain middleware and route handlers | Requests hang or double-send |
| **pnpm** | Fast, disk-efficient package manager | Saves time and space | Slower installs, duplicate files |
| **Event Loop** | Single-threaded task scheduler | Massive concurrency without threads | Blocking kills throughput |

You now have a functioning server, a working mental model of how requests flow, and a calculator API you can show your friends. In **Module 02**, we will dive into the middleware pipeline, routing architecture, error handling, and build a full Blog API.

---

*Sources: Express.js Official Documentation, Node.js Documentation, Express GitHub Repository, npm Documentation, pnpm Documentation*
