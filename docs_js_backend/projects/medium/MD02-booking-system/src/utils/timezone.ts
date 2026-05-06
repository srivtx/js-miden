export function toUTC(date: Date | string, timezone?: string): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  // BUG: This does not actually convert from the given timezone to UTC.
  // It assumes the input is already UTC or local time.
  // Proper fix: Use date-fns-tz or Intl.DateTimeFormat to handle timezone conversion.
  return new Date(d.toISOString());
}

export function formatInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}
