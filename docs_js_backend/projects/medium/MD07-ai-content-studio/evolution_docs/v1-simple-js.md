# MD07 AI Content Studio — v1 Simple JS

> **Motto**: Make the LLM talk before you make it safe.

## What We Built

A single-file Express app in JavaScript. One route: `POST /generate` that calls the OpenAI API with a raw user prompt and returns the full completion as JSON. No streaming. No error handling. No database.

## Why Start Here

- **Speed**: See a response from GPT in 10 lines of code
- **Clarity**: Understand the request/response shape without TypeScript noise
- **Baseline**: Every later feature (streaming, validation, moderation) must justify its complexity

## Architecture

```
┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Client    │─────▶│  Express (JS)   │─────▶│    OpenAI       │
│  (Writer)   │◀─────│  /generate      │◀─────│   API           │
└─────────────┘      └─────────────────┘      └─────────────────┘
```

## Code

```javascript
// server.js
const express = require('express');
const { OpenAI } = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app = express();
app.use(express.json());

app.post('/generate', async (req, res) => {
  const { prompt } = req.body;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
  });

  res.json({ response: completion.choices[0].message.content });
});

app.listen(3000, () => console.log('AI Studio v1 on :3000'));
```

## Problems We Accepted

- No input validation — `prompt` could be missing, an array, or 10MB of text
- No error handling — OpenAI network errors crash the process
- No streaming — user waits 10+ seconds for a full response
- No retry — transient 429s or 500s from OpenAI fail the request permanently
- No timeout — a hung request blocks the event loop forever
- No logging — when something breaks, we have zero visibility
- No tests — we hope it works

## Checklist

- [ ] OpenAI API key is loaded from `process.env`
- [ ] JSON body is parsed with `express.json()`
- [ ] No prompt injection filtering
- [ ] Response is returned as a single JSON blob

## Next Step

Add TypeScript so we stop guessing what `completion.choices[0]` contains.
