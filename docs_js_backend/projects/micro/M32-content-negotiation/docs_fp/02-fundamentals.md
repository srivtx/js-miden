# Fundamentals: Accept Header Parsing

**Task:** Parse `Accept: application/json, text/html;q=0.9` manually.

```javascript
function parseAccept(header) {
  return header.split(',').map(type => {
    const [mime, ...params] = type.trim().split(';');
    const q = params.find(p => p.includes('q='))?.split('=')[1] || '1';
    return { mime: mime.trim(), q: parseFloat(q) };
  }).sort((a, b) => b.q - a.q);
}
```
