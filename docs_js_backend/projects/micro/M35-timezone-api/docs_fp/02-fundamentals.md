# Fundamentals: DST Handling

**Task:** Convert time with DST using IANA database.

```javascript
const date = new Date('2024-07-15T12:00:00Z');
const nyTime = date.toLocaleString('en-US', {
  timeZone: 'America/New_York'
});
```

IANA database knows DST rules for every timezone.
