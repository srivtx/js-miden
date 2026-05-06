# IANA Timezone Database

## WHAT

The **IANA Time Zone Database** (tzdb, formerly Olson database) is a collaborative, publicly maintained dataset of timezone rules for locations worldwide. Each zone (e.g., `America/Los_Angeles`) records:

- Historical UTC offsets.
- DST start/end rules (often changing by year).
- Abbreviations (PST, PDT, etc.).

As of 2024, the database contains ~600 zones. It is released as `tzdata` and embedded in operating systems, programming languages, and libraries.

## WHY

Offsets are not fixed. Political decisions change them:

- **Samoa (2011)** skipped 30 December entirely by moving across the dateline.
- **Russia (2014)** abolished DST permanently.
- **Turkey (2016)** stayed on summer time year-round.
- **Chile** frequently shifts DST dates with short notice.

If your application hardcodes offsets, it will produce **wrong local times** after any rule change.

## HOW

**In Node.js / JavaScript:**

Modern Node.js ships with ICU data, which includes tzdb. Use named zones via `Intl.DateTimeFormat` or libraries like `luxon` and `date-fns-tz`.

```javascript
// GOOD: Named zone lookup
const { DateTime } = require("luxon");
const dt = DateTime.fromISO("2024-06-15T14:00:00Z")
  .setZone("Europe/Paris");
console.log(dt.toFormat("yyyy-MM-dd HH:mm:ss ZZZZ"));
// → "2024-06-15 16:00:00 GMT+2"
```

**Keeping tzdb updated:**

- Node.js updates ICU with each release. Use the latest LTS.
- For Docker, ensure the base image has updated `tzdata`:
  ```dockerfile
  RUN apt-get update && apt-get install -y tzdata
  ```

## WRONG vs RIGHT

### WRONG: Hardcoded Offset

```javascript
// BAD: Will be wrong during DST or rule changes
function toBerlinTime(isoString) {
  const date = new Date(isoString);
  return new Date(date.getTime() + (2 * 60 * 60 * 1000)); // Always +2
}
```

### RIGHT: Named Zone

```javascript
// GOOD: Resolves DST and historical changes automatically
function toBerlinTime(isoString) {
  const d = new Date(isoString);
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "full", timeStyle: "long"
  }).format(d);
}
```

## Breach Story: Yahoo! Mail Calendar (2013)

In 2013, a tzdb update for Chile was delayed in Yahoo's mobile stack. Calendar events shifted by one hour for Chilean users for several weeks, causing missed meetings and a minor but public service degradation. Root cause: the mobile client hardcoded the offset and did not update tzdb promptly.

## References

- IANA Time Zone Database: https://www.iana.org/time-zones
- Eggert, P., & Olson, A. D. (2023). *Sources for Time Zone and Daylight Saving Time Data*. IANA.
- RFC 8536: *The Time Zone Information Format (TZif)*
