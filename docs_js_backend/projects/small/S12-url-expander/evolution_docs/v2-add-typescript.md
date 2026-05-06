# v2 — Adding TypeScript

You just debugged why a URL expansion returned `{ "final_url": null }`.

```js
https.get(url, (response) => {
  res.json({ final_url: response.responseUrl || url });
});
```

`response.responseUrl` doesn't exist on Node's `http.IncomingMessage`. You confused it with `axios` or `fetch`. In native Node `https`, the property is... not there. You have to track redirects manually.

TypeScript would have told you `responseUrl` doesn't exist on `IncomingMessage`.

## The Fix: Types

```ts
import https from 'https';
import { IncomingMessage } from 'http';

function requestUrl(url: string): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => resolve(res));
  });
}
```

Now TypeScript autocompletion shows you the real properties. No more imaginary `responseUrl`.

## But Wait...

TypeScript doesn't stop you from following redirects to `http://localhost`. It doesn't enforce timeout logic. It just makes the code type-safe.

**Next:** Let's add validation and redirect following.
