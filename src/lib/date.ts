const ISO_DATE_REGEX = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;

export function parseIsoDateToLocal(dateString: string): Date | null {
  if (typeof dateString !== 'string') {
    return null;
  }

  const match = ISO_DATE_REGEX.exec(dateString.trim());
  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

export function formatIsoDate(
  dateString: string,
  options?: Intl.DateTimeFormatOptions,
  locales?: Intl.LocalesArgument
): string {
  const parsed = parseIsoDateToLocal(dateString);
  if (!parsed) {
    return dateString;
  }
  return parsed.toLocaleDateString(locales, options);
}

export function startOfToday(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

export function addDays(date: Date, amount: number): Date {
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() + amount);
  return copy;
}

const MS_IN_DAY = 24 * 60 * 60 * 1000;

export function differenceInCalendarDays(start: Date, end: Date): number {
  const utcStart = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const utcEnd = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.floor((utcEnd - utcStart) / MS_IN_DAY);
}

export function compareIsoDatesDesc(a: string, b: string): number {
  const parsedA = parseIsoDateToLocal(a);
  const parsedB = parseIsoDateToLocal(b);

  if (!parsedA && !parsedB) return 0;
  if (!parsedA) return 1;
  if (!parsedB) return -1;

  return parsedB.getTime() - parsedA.getTime();
}
