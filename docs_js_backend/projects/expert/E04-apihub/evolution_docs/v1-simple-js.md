# v1 — The Naive API Proxy (Pure JS)

You want to expose internal APIs to external developers. You build a quick proxy.

```js
const express = require('express');
const http = require('http');
const app = express();

const apis = new Map();
let idCounter = 1;

app.use(express.json());

app.post('/register', (req, res) => {
  const api = { id: idCounter++, ...req.body };
  apis.set(api.id, api);
  res.status(201).json(api);
});

app.get('/apis', (req, res) => {
  res.json(Array.from(apis.values()));
});

app.all('/proxy/:apiId/*', (req, res) => {
  const api = apis.get(parseInt(req.params.apiId));
  if (!api) return res.status(404).json({ error: 'API not found' });
  
  const targetUrl = `${api.baseUrl}${req.params[0]}`;
  const proxyReq = http.request(targetUrl, { method: req.method, headers: req.headers }, (proxyRes) => {
    res.status(proxyRes.statusCode);
    proxyRes.pipe(res);
  });
  req.pipe(proxyReq);
});

app.listen(3000, () => console.log('API hub on 3000'));
```

Register an API. Proxy requests to it. Done.

## Then the Pain Hits

**No authentication.** Anyone can proxy through your server. Your bandwidth bill explodes. Malicious actors use you to anonymize attacks on third parties.

**No usage tracking.** A developer registers an API and hammers it 1M times/day. You have no data to bill them or to show API owners.

**No rate limiting.** A single buggy script DDOSes the proxy. All other developers get 503s. The platform is unusable.

**No developer experience.** No docs, no sandbox, no code samples. Developers abandon your platform for one with a portal.

**No billing.** You promised API owners revenue sharing. You have no idea who owes what.

## The Realization

A proxy is not a marketplace. You need:
1. **Developer portal** — discover, subscribe, test APIs
2. **Authentication** — API keys, token validation
3. **Billing** — tiered pricing, invoicing, overages
4. **Analytics** — usage dashboards, error rates, latency
5. **Rate limiting** — fair use, abuse prevention

This is where the evolution starts.
