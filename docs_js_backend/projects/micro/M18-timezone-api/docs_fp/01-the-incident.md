# The 3AM Page: The Missed Flight

It's 6:00 AM. Customer service is drowning.

**Customer:** "Your app said my flight lands at 6PM. I missed my connection. It actually landed at 5PM."

You check the code:
```javascript
function convertTime(time, fromZone, toZone) {
  const offset = TIMEZONE_OFFSETS[fromZone]; // Fixed offset!
  const date = new Date(time);
  date.setHours(date.getHours() + offset);
  return date;
}
```

The offset for `America/New_York` is hardcoded as `-5`. But it's currently DST (EDT, `-4`).

**Your API gave the wrong time for 6 months of the year.**

---

## Your Turn

### Q1: Why is a fixed timezone offset wrong?

New York is UTC-5. What's the problem?

<br><br><br><br><br>

---

## The Autopsy

### Answer: Timezones change

`America/New_York`:
- **EST (winter):** UTC-5
- **EDT (summer):** UTC-4
- Switch happens at 2:00 AM on specific dates

**But your code uses a fixed table:**
```javascript
const TIMEZONE_OFFSETS = {
  'America/New_York': -5,  // Wrong half the year!
  'Europe/London': 0,      // Wrong half the year!
};
```

**The fix:** Use IANA timezone database with DST rules:
```javascript
const date = new Date('2024-07-15T12:00:00Z');
const nyTime = date.toLocaleString('en-US', {
  timeZone: 'America/New_York',
  hour12: false
});
// "7/15/2024, 08:00:00" (EDT, -4)
```
