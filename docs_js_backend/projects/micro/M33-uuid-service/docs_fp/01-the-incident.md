# The 3AM Page: The Predictable ID

It's 3:00 AM. Security reports data scraping.

**Security:** "Competitor accessed all our data by incrementing IDs."

Your UUID service:
```javascript
function generateId() {
  return `user-${Date.now()}-${counter++}`;
}
```

**Predictable. Sequential. Scraped in hours.**
