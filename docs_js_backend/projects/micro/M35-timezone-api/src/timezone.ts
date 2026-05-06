export interface TimezoneConversion {
  from: string;
  to: string;
  originalTime: string;
  convertedTime: string;
  offset: string;
}

// Fixed offsets for common timezones (BUG: ignores DST)
const fixedOffsets: Record<string, number> = {
  'UTC': 0,
  'GMT': 0,
  'Asia/Tokyo': 9,
  'Asia/Shanghai': 8,
  'Europe/London': 1,
  'Europe/Paris': 2,
  'America/New_York': -5,
  'America/Los_Angeles': -8,
  'Australia/Sydney': 11,
};

export function listTimezones(): string[] {
  return Object.keys(fixedOffsets);
}

export function convertTime(
  from: string,
  to: string,
  time: string
): TimezoneConversion {
  const fromOffset = fixedOffsets[from];
  const toOffset = fixedOffsets[to];

  if (fromOffset === undefined || toOffset === undefined) {
    throw new Error(`Unsupported timezone: ${fromOffset === undefined ? from : to}`);
  }

  const originalDate = new Date(time);
  if (isNaN(originalDate.getTime())) {
    throw new Error('Invalid time format');
  }

  // BUG: Uses fixed offset difference, ignoring DST transitions.
  // For example, America/New_York is -5 in winter but -4 in summer.
  // This code always uses -5.
  const offsetDiffHours = toOffset - fromOffset;
  const convertedDate = new Date(
    originalDate.getTime() + offsetDiffHours * 60 * 60 * 1000
  );

  return {
    from,
    to,
    originalTime: originalDate.toISOString(),
    convertedTime: convertedDate.toISOString(),
    offset: `${offsetDiffHours >= 0 ? '+' : ''}${offsetDiffHours}:00`,
  };
}
