# The Thinking Framework

> **Before you write a single line of code, you must think.** This framework forces you to understand the problem, explore constraints, and make deliberate choices. Every project follows this pattern.

---

## The 5 Phases of Every Project

```
PHASE 1: PROBLEM UNDERSTANDING (10 min)
    ↓
PHASE 2: THINKING & CONSTRAINTS (15 min)
    ↓
PHASE 3: ARCHITECTURE DECISIONS (15 min)
    ↓
PHASE 4: BUILDING (the code)
    ↓
PHASE 5: BREAKING & FIXING (the bugs)
```

---

## PHASE 1: Problem Understanding

**Don't read the solution. Don't look at the code. Answer these first:**

### The 5 Ws
1. **WHAT** exactly are we building? (One sentence)
2. **WHO** will use it? (User personas)
3. **WHEN** does it need to work? (Real-time? Batch? Scheduled?)
4. **WHERE** does data live? (Transient? Persistent? How long?)
5. **WHY** does this problem exist? (What pain are we solving?)

### The Constraints
- **Time**: How fast must it respond?
- **Space**: How much memory/disk can it use?
- **Scale**: How many users/requests?
- **Money**: What's the budget?
- **Correctness**: Can we be wrong sometimes? (caching) Or never? (payments)

### The Anti-Requirements
- What are we **NOT** building? (Scope boundaries)
- What can we **sacrifice** if needed?

---

## PHASE 2: Thinking & Constraints

**Now think through the problem. No code. Just reasoning.**

### Mental Models
- Draw the data flow (ASCII art is fine)
- Identify the "hot path" (what happens most often)
- Identify the "danger zone" (what can go wrong)

### Question Everything
- Do we even need a database? (Maybe in-memory is enough for now)
- Do we need Redis? (Or is PostgreSQL fast enough?)
- Do we need authentication? (Or is this internal?)
- Do we need real-time? (Or is polling acceptable?)

### The "What If" Game
- What if 1000 users hit this at once?
- What if the database is down?
- What if a user sends garbage input?
- What if two users do the same thing simultaneously?

---

## PHASE 3: Architecture Decisions

**For each decision, document:**

```markdown
### Decision: [What we decided]

**Option A:** [Approach 1]
- Pros: ...
- Cons: ...

**Option B:** [Approach 2]
- Pros: ...
- Cons: ...

**Chosen:** [Option X]
**Why:** [The reasoning]
**What if wrong:** [Consequences of wrong choice]
```

### Required Decisions
1. **Database**: SQL vs NoSQL vs Memory-only
2. **API Style**: REST vs RPC vs GraphQL
3. **Auth**: JWT vs Sessions vs API Keys vs Nothing
4. **Caching**: Where? How long? Invalidation strategy?
5. **Error Handling**: Fail fast? Retry? Degrade gracefully?
6. **Deployment**: Docker? PaaS? Serverless?

---

## PHASE 4: Building

**Now write code. But follow these rules:**

1. **Start with the data model** (schema first)
2. **Build the happy path** (main flow without errors)
3. **Add validation** (inputs are evil)
4. **Add error handling** (every `await` can fail)
5. **Add tests** (prove it works)
6. **Add monitoring** (logs, metrics)

### The "One Thing at a Time" Rule
- Don't add auth until the core works
- Don't add caching until the DB version works
- Don't add tests until the code works
- Build incrementally, test each increment

---

## PHASE 5: Breaking & Fixing

**Every project has bugs. Find them.**

### Bug Discovery Process
1. Run the tests (some fail)
2. Read the error carefully (not just the stack trace)
3. Reproduce manually (curl, Postman, browser)
4. Add logging to understand the flow
5. Hypothesize the cause
6. Test your hypothesis
7. Fix it
8. Write a test that would have caught it

### The Post-Mortem
After fixing, answer:
- What was the root cause?
- Why didn't the tests catch it?
- How could we prevent this class of bug?
- What did we learn?

---

## Example: Applying the Framework

### Project: URL Shortener

#### PHASE 1: Problem Understanding
- **WHAT**: Convert long URLs to short codes
- **WHO**: Anyone sharing links
- **WHEN**: Instant (redirects must be fast)
- **WHERE**: Permanent storage (URLs must work forever)
- **WHY**: Long URLs are ugly and break in emails/SMS

#### PHASE 2: Thinking
- Hot path: Redirect (happens 1000x more than creation)
- Danger zone: Collision (two URLs getting same code)
- Danger zone: Abuse (someone creating millions of URLs)
- Do we need auth? No (public service like bit.ly)
- Do we need analytics? Yes (clicks matter)

#### PHASE 3: Decisions

**Decision: Short Code Generation**
- Option A: Hash (MD5/SHA) of URL → Base62
  - Pros: Deterministic (same URL = same code)
  - Cons: Collisions possible, length varies
- Option B: Auto-increment counter → Base62
  - Pros: No collisions, predictable length, O(1) generation
  - Cons: Sequential (predictable), requires DB write
- Option C: Random + existence check
  - Pros: Unpredictable, scalable
  - Cons: Need to check DB every time
- **Chosen:** Counter (Base62 of auto-increment ID)
- **Why:** Simple, collision-free, fast enough for MVP
- **What if wrong:** Sequential codes leak creation order (information disclosure)

**Decision: Analytics Storage**
- Option A: Same table as URLs (clicks column)
  - Pros: Simple, fast reads
  - Cons: Write amplification, loses detail (who, when, where)
- Option B: Separate analytics table
  - Pros: Detailed data, doesn't slow redirects
  - Cons: More complex, more storage
- **Chosen:** Separate table
- **Why:** Need geolocation, referrer, timestamp detail
- **What if wrong:** Synchronous analytics writes slow down redirects

#### PHASE 4: Building
[Code implementation...]

#### PHASE 5: Bugs
1. Race condition in counter (two requests get same code)
2. Cache stampede (1000 requests hit expired cache)
3. Open redirect vulnerability

---

## Your Turn

**Every project in this curriculum starts with this framework.** 

Before you look at the code:
1. Read the problem
2. Spend 15 minutes thinking
3. Write down your decisions
4. Only THEN look at the solution

**The goal is not to memorize solutions. The goal is to develop architectural intuition.**

---

> *"Give me six hours to chop down a tree and I will spend the first four sharpening the axe."* — Abraham Lincoln (probably)
