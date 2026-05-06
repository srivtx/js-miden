# MD03 URL Shortener Pro — v1 Simple JS

## The Naive Implementation

You need short URLs. Simple:

```js
// shortener.js
const express = require('express');
const app = express();
app.use(express.json());

const urls = {}; // shortCode -> longUrl

function makeCode() {
  return Math.random().toString(36).substring(2, 8);
}

app.post('/shorten', (req, res) => {
  const { url } = req.body;
  const code = makeCode();
  urls[code] = url;
  res.json({ shortUrl: `http://localhost:3000/${code}` });
});

app.get('/:code', (req, res) => {
  const longUrl = urls[req.params.code];
  if (!longUrl) return res.status(404).send('Not found');
  res.redirect(longUrl);
});

app.listen(3000);
```

Works locally:
```bash
curl -X POST http://localhost:3000/shorten \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/very/long/path"}'
# → { "shortUrl": "http://localhost:3000/a3f9b2" }
```

## Then the Pain Hits

### 1. Collisions

`makeCode()` eventually generates the same 6-character string twice. The second URL overwrites the first. Users get redirected to the wrong destination. This is a data integrity nightmare.

### 2. No Analytics

Marketing asks, "How many clicks did the campaign link get?" You shrug. You have no data. You can't tell them which channels drive traffic.

### 3. No Rate Limiting

A bot creates 100,000 short URLs in 10 minutes. Your memory explodes. Legitimate users can't create links.

### 4. Server Restart = Data Loss

You deploy a hotfix. Every short URL evaporates. Twitter is full of broken links pointing to your domain.

### 5. No Expiration

Short URLs live forever. A user shortens a sensitive document. It leaks. They can't invalidate it.

## The Realization

A hash map in memory is fine for a toy. A production URL shortener needs:

1. **Collision resistance** — guaranteed unique codes
2. **Analytics** — click tracking, referrer data, geography
3. **Rate limiting** — prevent abuse
4. **Persistence** — database with indexes
5. **Caching** — sub-millisecond redirects at scale
6. **Expiration** — TTL support for sensitive links

This is where the evolution starts.
