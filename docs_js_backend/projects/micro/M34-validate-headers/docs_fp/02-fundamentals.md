# Fundamentals: Header Normalization

**Task:** Normalize headers to lowercase.

```javascript
const normalized = {};
for (const [key, value] of Object.entries(headers)) {
  normalized[key.toLowerCase()] = value;
}
```

HTTP/2 mandates lowercase headers. HTTP/1.1 is case-insensitive.
