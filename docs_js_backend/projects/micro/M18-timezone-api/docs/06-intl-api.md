# Intl API

## WHAT

The **ECMAScript Internationalization API** (`Intl`) is a built-in JavaScript API for locale-sensitive formatting and parsing. Key constructors:

- `Intl.DateTimeFormat` — format dates and times for locales and timezones.
- `Intl.RelativeTimeFormat` — format relative times ("2 hours ago").
- `Intl.NumberFormat` — format currencies, percentages.
- `Intl.ListFormat` — format lists grammatically.

## WHY

Before `Intl`, developers relied on massive libraries like `moment.js` (now legacy) for formatting. `Intl` is:

- **Native:** No dependency bloat.
- **Updated:** Follows Unicode CLDR (Common Locale Data Repository) and tzdb.
- **Standard:** Behavior is consistent across modern engines (V8, JSC, SpiderMonkey).

For timezone conversion, `Intl.DateTimeFormat` is the modern standard in Node.js.

## HOW

**Timezone conversion:**

```javascript
const instant = new Date("2024-06-15T14:00:00Z");

const berlin = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  dateStyle: "full",
  timeStyle: "long"
}).format(instant);
// → "Samstag, 15. Juni 2024 um 16:00:00 MESZ"

const tokyo = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  dateStyle: "full",
  timeStyle: "long"
}).format(instant);
// → "2024年6月15日 23時00分00秒 JST"
```

**Relative time:**

```javascript
const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
console.log(rtf.format(-2, "hour")); // "2 hours ago"
```

## WRONG vs RIGHT

### WRONG: Manual String Concatenation

```javascript
// BAD: Brittle, ignores locale rules
function formatDate(date, zone) {
  const d = new Date(date);
  return `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}`; // Always local machine time
}
```

### RIGHT: Intl.DateTimeFormat

```javascript
// GOOD: Respects locale, timezone, and DST
function formatDate(instant, locale, zone) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    year: "numeric", month: "long", day: "numeric"
  }).format(new Date(instant));
}
```

## References

- ECMA-402: ECMAScript Internationalization API Specification
- Unicode CLDR: https://cldr.unicode.org/
- MDN: Intl — https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl
