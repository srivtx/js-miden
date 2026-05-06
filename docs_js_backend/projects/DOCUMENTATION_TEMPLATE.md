# Project Documentation Template

Every project MUST have a `docs/` folder with these files. This is where the real learning happens.

---

## docs/ Structure

```
docs/
├── 00-PROBLEM.md              # What are we building and why
├── 01-THINKING.md             # Phase 2: Constraints, mental models, "what if" game
├── 02-DECISIONS.md            # Phase 3: Architecture decisions with alternatives
├── 03-CONCEPTS.md             # New concepts explained deeply
├── 04-OLD-VS-NEW.md           # What we used to do vs what we do now (2025)
├── 05-BUILD.md                # Phase 4: Step-by-step implementation
├── 06-BUGS.md                 # Phase 5: The bugs, why they exist, how to find them
├── 07-RESEARCH.md             # Latest research backing our choices
└── 08-CRITIQUE.md             # Critic review of this project
```

---

## File Contents

### 00-PROBLEM.md

```markdown
# The Problem

## What Are We Building?
[One sentence description]

## Why Does This Problem Exist?
[Real-world pain point]

## Who Will Use It?
[User personas]

## Constraints
- Time: [Response time requirements]
- Scale: [Expected load]
- Correctness: [Can we be wrong?]
- Budget: [Resource limits]

## What We're NOT Building
[Scope boundaries - this prevents over-engineering]
```

### 01-THINKING.md

```markdown
# Thinking Process

## Mental Models
[ASCII diagrams of data flow]

## The Hot Path
[What happens most often - optimize this]

## The Danger Zone
[What can go wrong - protect this]

## Question Everything
- Do we need a database?
- Do we need Redis?
- Do we need auth?
- Do we need real-time?

## The "What If" Game
- What if 1000 users hit this at once?
- What if the database is down?
- What if a user sends garbage?
- What if two users do the same thing?
```

### 02-DECISIONS.md

```markdown
# Architecture Decisions

## Decision: [Topic]

### Option A: [Approach 1]
**Pros:**
- ...

**Cons:**
- ...

### Option B: [Approach 2]
**Pros:**
- ...

**Cons:**
- ...

### What We Chose: [Option X]
**Why:** [Detailed reasoning]

**What If We Chose Wrong:** [Consequences]

**Research Backing:** [Citations from 07-RESEARCH.md]
```

### 03-CONCEPTS.md

```markdown
# Concepts Explained

## Concept: [Name]

### What Is It?
[Simple explanation]

### Why Do We Use It?
[Context-specific reasoning]

### How Does It Work?
[Technical depth]

### Code Example
```typescript
// Show the concept in action
```

### Common Misconceptions
- Wrong way: ...
- Right way: ...

### Related Concepts
- [Link to other concepts]
```

### 04-OLD-VS-NEW.md

```markdown
# Old Ways vs New Ways (2025)

## Pattern: [Name]

### The Old Way (2015-2020)
```javascript
// Old code pattern
```
**Why we did it:** [Historical context]
**Why it's wrong now:** [What changed]

### The New Way (2025)
```typescript
// Modern code pattern
```
**Why it's better:** [Technical reasoning]
**When to still use old way:** [Exceptions]

### Migration Path
How to move from old to new.
```

### 05-BUILD.md

```markdown
# Step-by-Step Build Guide

## Step 1: [Action]
[Detailed instructions with code]

## Step 2: [Action]
[Detailed instructions with code]

### Common Mistakes at This Step
- Mistake: ...
- Why it breaks: ...
- How to avoid: ...
```

### 06-BUGS.md

```markdown
# The Bugs

## Bug 1: [Name]

### How to Introduce It
[Code showing the bug]

### Why It Exists
[The thinking error that created it]

### Symptoms You'll See
[What goes wrong]

### How to Reproduce
[Exact steps]

### The Fix
[Corrected code]

### Why the Fix Works
[Deep explanation]

### Real-World Impact
[News story or post-mortem]
```

### 07-RESEARCH.md

```markdown
# Research Notes

## Sources
- [Source 1]: [Key finding]
- [Source 2]: [Key finding]

## Latest Trends (2025)
[What's new in this domain]

## Benchmarks
[Performance numbers]

## Industry Adoption
[Who uses what]
```

### 08-CRITIQUE.md

```markdown
# Critic Review

## Technical Review
[What a senior engineer would say]

## Security Review
[Potential vulnerabilities]

## Educational Review
[What's missing or confusing]

## Fixes Applied
[What we changed based on critique]
```

---

## Writing Rules

1. **Every concept gets a "Why"** - Never say "we use X" without saying "because Y"
2. **Show the wrong way first** - Then show why it breaks, then show the right way
3. **Use ASCII diagrams** - Visual learners need visuals
4. **Include real numbers** - "Fast" is meaningless. "10ms vs 100ms" is meaningful
5. **Cite sources** - Link to research, benchmarks, post-mortems
6. **Be conversational** - Write like you're explaining to a smart friend
7. **No skipped steps** - If you import something, explain what it is

---

## Example: Explaining `.d.ts` Files

```markdown
## Concept: TypeScript Declaration Files (.d.ts)

### What Is It?
A `.d.ts` file is a TypeScript declaration file. It contains ONLY type information - no actual code that runs.

### Why Do We Use It?
When a library is written in JavaScript (not TypeScript), TypeScript doesn't know what types the library uses. A `.d.ts` file tells TypeScript: "This function takes a string and returns a number."

### Example
```typescript
// In a JavaScript library (lodash)
function chunk(array, size) { /* ... */ }

// In lodash.d.ts
export function chunk<T>(array: T[], size: number): T[][];
```

### Why Not Just Use JavaScript?
Without `.d.ts`, TypeScript thinks everything is `any`:
```typescript
import { chunk } from 'lodash';
// TypeScript: chunk is 'any' - I don't know what it does
```

With `.d.ts`:
```typescript
import { chunk } from 'lodash';
// TypeScript: chunk<T>(array: T[], size: number): T[][]
// You get autocomplete, type checking, refactoring support
```

### Old Way vs New Way
**Old (2015-2018):** Write `.d.ts` manually for every library. Painful, often wrong.
**New (2025):** Most libraries ship with built-in types. If not, `@types/` packages exist. TypeScript can sometimes infer types from JSDoc.

### When You Still Need .d.ts
- Writing a library in TypeScript (generates .d.ts automatically)
- Using an untyped JavaScript library
- Extending global objects (e.g., adding fields to `Express.Request`)
```

---

## Quality Checklist

Before marking docs as complete:
- [ ] Every new concept is explained
- [ ] Every decision has alternatives listed
- [ ] Old ways are mentioned with context
- [ ] Research is cited
- [ ] Bugs have real-world impact explained
- [ ] A beginner could follow the build guide
- [ ] A senior engineer would learn something new
