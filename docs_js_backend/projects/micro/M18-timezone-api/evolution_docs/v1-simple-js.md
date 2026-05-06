# M18 Timezone API — v1 Simple JS

## The Naive Implementation

You need an API that returns the current time in any timezone. Simple:

```js
// timezone.js
function getCurrentTime(timezone) {
  return {
    timezone,
    currentTime: new Date().toISOString(), // Always UTC!
    offset: '+00:00',
    isDST: false,
  };
}

function convertTime(fromZone, toZone, timeString) {
  const d = new Date(timeString);
  const iso = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() +
    'T' + d.getHours() + ':' + d.getMinutes() + ':' + d.getSeconds();

  return {
    from: fromZone,
    to: toZone,
    originalTime: timeString,
    convertedTime: iso,
    offset: '+00:00',
  };
}

// app.js
app.get('/time/:timezone', (req, res) => {
  const result = getCurrentTime(req.params.timezone);
  res.json(result);
});
```

Works locally:
```bash
curl http://localhost:3000/time/Asia/Tokyo
# → { "timezone": "Asia/Tokyo", "currentTime": "2024-01-15T10:30:00.000Z", "offset": "+00:00" }
```

**Wait.** `currentTime` is `10:30:00Z` — that's UTC. Tokyo is UTC+9. It should be `19:30:00+09:00`. But your code returns server time in UTC, completely ignoring the requested timezone.

## The Pain in Production

### 1. Returns Server Local Time (UTC), Not Requested Timezone

```js
new Date().toLocaleString('en-US', { timeZone: timezone });
return { currentTime: new Date().toISOString() }; // Bug: always UTC
```

You computed the locale string, then threw it away and returned `toISOString()`. Every request returns the same time regardless of timezone.

### 2. Crashes on Invalid Timezone

```bash
curl http://localhost:3000/time/Invalid/Zone
```

`new Date().toLocaleString('en-US', { timeZone: 'Invalid/Zone' })` throws `RangeError: Invalid time zone`. Your server returns 500. No validation.

### 3. String Concatenation Produces Invalid ISO Strings

```js
const iso = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() +
  'T' + d.getHours() + ':' + d.getMinutes() + ':' + d.getSeconds();
// Result: "2024-1-5T9:5:3" — not valid ISO 8601!
```

No zero-padding. `January` becomes `1` not `01`. Downstream parsers break.

### 4. Ignores DST Completely

`isDST: false` is hardcoded. Users in `America/New_York` get the same offset in July and December. Wrong.

### 5. No Input Validation on convertTime

```bash
curl "http://localhost:3000/convert?from=UTC&to=Asia/Tokyo&time=not-a-date"
```

`new Date('not-a-date')` returns `Invalid Date`. Your code doesn't check `isNaN()`. Silent corruption.

## The Lesson

Time is deceptively hard. JavaScript's `Date` object is UTC-centric and timezone-naive. Without the Intl API and IANA timezone database, you're guaranteed to be wrong.

## What v2 Fixes

TypeScript. Stop passing invalid strings around.
