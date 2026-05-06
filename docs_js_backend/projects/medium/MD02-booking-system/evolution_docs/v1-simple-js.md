# MD02 Booking System — v1 Simple JS

## The Naive Implementation

You need to book appointments. Simple:

```js
// booking.js
const express = require('express');
const app = express();
app.use(express.json());

const bookings = []; // flat array of { id, room, date, user }

app.post('/book', (req, res) => {
  const { room, date, user } = req.body;
  const booking = { id: bookings.length + 1, room, date, user };
  bookings.push(booking);
  res.json({ booking });
});

app.get('/bookings', (req, res) => {
  res.json({ bookings });
});

app.listen(3000);
```

Works locally:
```bash
curl -X POST http://localhost:3000/book \
  -H "Content-Type: application/json" \
  -d '{"room":"A","date":"2025-06-01T10:00","user":"alice"}'
# → { "booking": { "id": 1, "room": "A", "date": "2025-06-01T10:00", "user": "alice" } }
```

## Then the Pain Hits

### 1. Double Bookings

Alice books Room A at 10:00. Bob books Room A at 10:00. Your array now has two bookings for the same room at the same time. They both show up. Awkward.

### 2. No Time Boundaries

A user books "Room A" for "June 1st." Is that all day? An hour? 15 minutes? Your system doesn't know. Meetings overlap unpredictably.

### 3. No Cancellation

A user wants to cancel. You have no endpoint. They email support. Support edits the array by hand. One typo deletes the wrong booking.

### 4. Server Restart = Amnesia

You deploy. The `bookings` array vanishes. Everyone's appointments are gone.

### 5. No Search

A user asks, "What do I have on Tuesday?" You iterate the entire array, parse strings, compare dates. It's O(n) and brittle.

## The Realization

A flat array works for a prototype. A real booking system needs:

1. **Calendar awareness** — slots, durations, recurring rules
2. **Overlap prevention** — atomic checks before insert
3. **Cancellations** — soft deletes, refunds, notifications
4. **Persistence** — database with proper date types
5. **Holds** — temporary reservations while the user pays

This is where the evolution starts.
