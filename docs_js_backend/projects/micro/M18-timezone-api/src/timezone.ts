const VALID_TIMEZONES = new Set(
  Intl.supportedValuesOf('timeZone')
);

export function isValidTimeZone(tz: string): boolean {
  return VALID_TIMEZONES.has(tz);
}

export function getCurrentTime(timezone: string) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'shortOffset',
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';

  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour');
  const minute = get('minute');
  const second = get('second');
  const offset = get('timeZoneName').replace('GMT', '');

  // Build ISO 8601 with offset: YYYY-MM-DDTHH:mm:ss±HH:mm
  const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`;

  // Detect DST by comparing standard and current offset
  const janOffset = getOffsetMinutes(timezone, new Date(Number(year), 0, 1));
  const julOffset = getOffsetMinutes(timezone, new Date(Number(year), 6, 1));
  const currentOffset = getOffsetMinutes(timezone, now);
  const isDST = Math.max(janOffset, julOffset) !== currentOffset;

  return {
    timezone,
    currentTime: iso,
    offset,
    isDST,
  };
}

export function convertTime(fromZone: string, toZone: string, timeString: string) {
  // Validate ISO-like input to prevent arbitrary string parsing
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})?$/;
  if (!isoRegex.test(timeString)) {
    throw new Error('Time must be in ISO 8601 format');
  }

  // Parse as if it's in the fromZone
  const date = new Date(timeString);
  if (isNaN(date.getTime())) {
    throw new Error('Invalid time value');
  }

  // If timeString has no zone info, interpret it as fromZone by shifting
  // For simplicity, use toLocaleString to get the wall-clock in fromZone, then convert
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: fromZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';

  const localDate = new Date(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}Z`);

  // Now convert localDate (as UTC) to toZone
  const toFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: toZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'shortOffset',
  });

  const toParts = toFormatter.formatToParts(localDate);
  const toGet = (type: string) => toParts.find((p) => p.type === type)?.value || '00';
  const toOffset = toGet('timeZoneName').replace('GMT', '');

  const convertedIso = `${toGet('year')}-${toGet('month')}-${toGet('day')}T${toGet('hour')}:${toGet('minute')}:${toGet('second')}${toOffset}`;

  return {
    from: fromZone,
    to: toZone,
    originalTime: timeString,
    convertedTime: convertedIso,
    offset: toOffset,
  };
}

function getOffsetMinutes(timeZone: string, date: Date): number {
  const str = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
  }).formatToParts(date);
  const offsetPart = str.find((p) => p.type === 'timeZoneName')?.value || '+00:00';
  const sign = offsetPart.includes('-') ? -1 : 1;
  const [h, m] = offsetPart.replace(/[+-]/, '').split(':');
  return sign * (parseInt(h || '0', 10) * 60 + parseInt(m || '0', 10));
}
