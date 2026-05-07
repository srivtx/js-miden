# The 3AM Page: The Login That Broke

It's 3:15 AM. Your frontend team is pinging you on Slack.

**Frontend Dev:** "Users can't log in. Browser says CORS error. Nothing changed on our end."

You check the API. It was deployed 6 hours ago. The CORS config:

```javascript
app.use(cors({
  origin: '*',
  credentials: true
}));
```

You test from `https://app.yoursite.com`. It works. You test from `https://evil.com`. It... also works. And it sends cookies.

---

## Your Turn

### Q1: Why does `origin: '*'` with `credentials: true` fail in modern browsers?

Think about what the browser does when it sees these headers.

<br><br><br><br><br>

---

## The Autopsy

### Answer: The browser rejects it

`Access-Control-Allow-Origin: *` with `Access-Control-Allow-Credentials: true` is **explicitly forbidden** by the CORS spec. The browser refuses to send credentials (cookies, auth headers) when the origin is wildcard.

**But your server sends it anyway.** The browser blocks the request. Users see CORS errors. Login fails.

**The deeper issue:** `origin: '*'` with `credentials: true` is a **security vulnerability** on browsers that DO allow it (older browsers, some mobile WebViews). Any website can make authenticated requests to your API.

### The Fix

```javascript
const ALLOWED_ORIGINS = ['https://app.yoursite.com', 'https://admin.yoursite.com'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed'));
    }
  },
  credentials: true
}));
```

**Reflect the origin, don't wildcard it.**
