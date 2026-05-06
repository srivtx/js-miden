# v1 — The Naive URL Expander (Pure JS)

You want to know where a short URL leads. You build a quick API.

```js
const express = require('express');
const https = require('https');
const app = express();

app.post('/expand', (req, res) => {
  const { url } = req.body;
  https.get(url, (response) => {
    res.json({
      final_url: response.responseUrl || url,
      status: response.statusCode,
    });
  });
});

app.listen(3000);
```

You send a URL. You get a status code. Done.

## Then the Pain Hits

**It only follows one hop.** A short URL redirects to another short URL which redirects to the final page. Your code stops at the first redirect. The user thinks the final URL is `bit.ly/abc` when it's actually `example.com/page`.

**Infinite loops.** A misconfigured server redirects `/a` to `/b` and `/b` to `/a`. Your code hangs forever.

**SSRF.** A user sends `http://localhost:22/`. Your server, running inside a private network, connects to itself. An attacker just port-scanned your internal services using your API.

## The Realization

You need:
1. **Redirect following** — follow the full chain
2. **Loop detection** — detect circular redirects
3. **SSRF protection** — block internal IPs
4. **Timeouts** — don't hang forever

This is where the evolution starts.
