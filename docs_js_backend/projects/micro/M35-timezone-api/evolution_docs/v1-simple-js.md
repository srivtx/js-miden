# M35 Timezone API — v1 Simple JS

## The Naive Beginning

You need to convert times between timezones. The simplest thing: a fixed offset table.

```js
// server.js
const express = require('express');
const app = express();

const offsets = {
  'UTC': 0,
  'Asia/Tokyo': 9,
  'America/New_York': -5,
  'Europe/London': 1,
};

app.get('/convert', (req, res) => {
  const { from, to, time } = req.query;
  const fromOffset = offsets[from];
  const toOffset = offsets[to];
  const diff = toOffset - fromOffset;
  const date = new Date(time);
  const converted = new Date(date.getTime() + diff * 60 * 60 * 1000);
  res.json({
    from,
    to,
    originalTime: date.toISOString(),
    convertedTime: converted.toISOString(),
    offset: `${diff >= 0 ? '+' : ''}${diff}:00`,
  });
});

app.listen(3000);
```

**"This works. Tokyo is +9, New York is -5. Ship it."**

## The Pain in Production

### 1. DST Breaks Everything

A user converts `2024-07-01T12:00:00Z` to `America/New_York`. Your code returns `08:00`. The correct answer is `08:00` (EDT, UTC-4). Wait — in this case it happens to be correct because -5 is wrong but July is DST... No, let's be precise:

- January 2024: New York is EST (UTC-5) → your code is correct
- July 2024: New York is EDT (UTC-4) → your code returns 07:00 instead of 08:00

Users miss meetings. Billing systems charge the wrong hour. Compliance reports are incorrect.

### 2. Limited Timezone Support

A user asks for `Asia/Kolkata` (UTC+5:30). Not in your table. They ask for `Pacific/Auckland`. Not in your table. You add them one by one. The table grows to 500 lines. You miss DST for half of them.

### 3. No IANA Zone Support

Your table uses colloquial names. A client sends `US/Eastern`. You don't have it. They send `EST5EDT`. You don't have it. The world has 400+ IANA zones. Your table has 10.

### 4. Wrong Offset for Half the Year

Europe/London is GMT (UTC+0) in winter and BST (UTC+1) in summer. Your table says +1. It's correct in June but wrong in December. Users in London get the wrong time for 6 months of the year.

## What We Have

- **Fixed offset table** — ignores DST
- **Limited zones** — 10 entries instead of 400+
- **No IANA support** — rejects valid timezone names
- **Wrong half the year** — static offsets for dynamic zones

## What v2 Fixes

TypeScript. Before we solve timezone handling, let's stop offset table typos from compiling.
