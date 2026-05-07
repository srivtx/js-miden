# Three Wrong Ways to Handle CORS

---

## Wrong #1: Wildcard with Credentials

```javascript
app.use(cors({ origin: '*', credentials: true }));
```

**Why it looks right:** Allow all origins. Support cookies. Maximum compatibility.

**Why it's wrong:**
- Modern browsers reject this combination
- Older browsers accept it — creating a security hole
- Any website can make authenticated requests to your API

---

## Wrong #2: Reflecting Origin Without Validation

```javascript
app.use(cors({
  origin: (origin, cb) => cb(null, origin),
  credentials: true
}));
```

**Why it looks right:** It mirrors the requesting origin. Precise control!

**Why it's wrong:**
- `null` origin (from file:// URLs or redirects) is reflected as `null`
- Some legacy code sends `Origin: null` — and you allow it
- Attackers can exploit this via sandboxed iframes or redirects

---

## Wrong #3: CORS as Security

```javascript
app.use(cors({ origin: 'https://app.yoursite.com' }));
// Now my API is secure!
```

**Why it looks right:** Only my frontend can access it. Security!

**Why it's wrong:**
- CORS is a **browser mechanism**, not server security
- `curl` ignores CORS entirely
- Server-side requests (from attackers) bypass CORS completely

**CORS protects users from malicious websites. It doesn't protect your API from attackers.**
