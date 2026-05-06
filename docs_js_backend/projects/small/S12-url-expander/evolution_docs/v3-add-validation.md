# v3 — Adding Validation

You just found out your API is being used to attack internal services.

A user sent:
```json
{ "url": "http://localhost:22/" }
```

Your server connected to port 22 on itself. The SSH banner leaked. This is Server-Side Request Forgery (SSRF). It's a critical vulnerability.

## The Fix: URL Validation

You validate the initial URL.

```ts
import { URL } from 'url';

const BLOCKED_HOSTS = new Set(['localhost', '0.0.0.0', '[::1]', '[::]']);

export function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (!['http:', 'https:'].includes(url.protocol)) return false;

    const hostname = url.hostname.toLowerCase();
    if (BLOCKED_HOSTS.has(hostname)) return false;
    if (/^10\./.test(hostname) || /^192\.168\./.test(hostname)) return false;

    return true;
  } catch {
    return false;
  }
}
```

Now `http://localhost:22/` is rejected at the door.

## Redirect Following

You implement manual redirect following.

```ts
export async function expandUrl(startUrl: string): Promise<ExpandResult> {
  const chain: string[] = [];
  let current = startUrl;
  let redirects = 0;
  const MAX_REDIRECTS = 10;

  while (redirects < MAX_REDIRECTS) {
    const response = await requestUrl(current, 'HEAD');
    chain.push(current);

    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
      current = new URL(response.headers.location, current).href;
      redirects++;
      continue;
    }

    return { final_url: current, chain, status: 'success' };
  }

  throw new Error('Too many redirects');
}
```

## The Bug

You validate the *initial* URL. But what about redirect targets? An attacker passes `https://evil.com/start` which passes validation... then redirects to `http://localhost:22/`.

**Fix:** Validate every hop.

```ts
if (!isValidUrl(current)) {
  throw new Error('Redirect target is blocked');
}
```

## Loop Detection

You also need to detect circular redirects.

```ts
if (chain.includes(current)) {
  throw new Error('Redirect loop detected');
}
```

**Next:** Let's add logging and timeouts.
