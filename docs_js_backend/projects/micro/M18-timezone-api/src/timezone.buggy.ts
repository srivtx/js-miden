/**
 * BUGGY TIMEZONE API - DO NOT USE IN PRODUCTION
 *
 * Bugs:
 * 1. Returns server local time instead of requested timezone (discards locale string).
 * 2. Crashes on invalid timezone (RangeError not caught).
 * 3. Uses string concatenation for dates, producing invalid ISO strings and ignoring offsets.
 */

export function getCurrentTimeBuggy(timezone: string) {
  // Bug 1: We compute locale string but then throw it away and return toISOString()
  // which is ALWAYS in UTC, not the requested timezone.
  new Date().toLocaleString('en-US', { timeZone: timezone });

  return {
    timezone,
    currentTime: new Date().toISOString(), // Bug: always UTC / server time
    offset: '+00:00',
    isDST: false,
  };
}

export function convertTimeBuggy(_fromZone: string, _toZone: string, timeString: string) {
  // Bug 2: No validation of input format; passes directly to new Date()
  const d = new Date(timeString);

  // Bug 3: String concatenation without zero-padding and ignoring timezone offsets
  const iso =
    d.getFullYear() +
    '-' +
    (d.getMonth() + 1) +
    '-' +
    d.getDate() +
    'T' +
    d.getHours() +
    ':' +
    d.getMinutes() +
    ':' +
    d.getSeconds();

  return {
    from: _fromZone,
    to: _toZone,
    originalTime: timeString,
    convertedTime: iso,
    offset: '+00:00',
  };
}
