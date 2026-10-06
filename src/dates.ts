// Calendar days, as the user reads them: no time, no time zone. Pure.

/** Days since 1970-01-01 of a calendar date. Comparable and subtractable. */
export type Day = number;

const MS_PER_DAY = 86_400_000;

export const dayOf = (year: number, month: number, date: number): Day => Date.UTC(year, month - 1, date) / MS_PER_DAY;

/** The local calendar day of `date`: just after midnight in Paris is already today. */
export const localDay = (date: Date): Day => dayOf(date.getFullYear(), date.getMonth() + 1, date.getDate());

/** `YYYY-MM-DD` → day, or null when it is not a real date. */
export function parseDay(text: string): Day | null {
  const m = text.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const day = dayOf(y, mo, d);
  return formatDay(day) === m[0] ? day : null;
}

export function formatDay(day: Day): string {
  const d = new Date(day * MS_PER_DAY);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/**
 * A date in a query: `today`, `tomorrow`, `yesterday`, `YYYY-MM-DD`, `in 3 days`,
 * `2 weeks ago`. Null when not understood.
 */
export function resolveDay(expr: string, today: Day): Day | null {
  const text = expr.trim().toLowerCase();
  if (text === "today") return today;
  if (text === "tomorrow") return today + 1;
  if (text === "yesterday") return today - 1;
  const span = text.match(/^(?:in\s+)?(\d+)\s+(day|week)s?(\s+ago)?$/);
  if (span && (text.startsWith("in") || span[3])) {
    const days = Number(span[1]) * (span[2] === "week" ? 7 : 1);
    return span[3] ? today - days : today + days;
  }
  return parseDay(text);
}

/** `today`, `tomorrow`, `yesterday` in the user's language, else `12 Oct` (`12 Oct 2027` another year). */
export function dayLabel(day: Day, today: Day, locale: string): string {
  const diff = day - today;
  if (Math.abs(diff) <= 1) return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(diff, "day");
  const date = new Date(day * MS_PER_DAY);
  const sameYear = date.getUTCFullYear() === new Date(today * MS_PER_DAY).getUTCFullYear();
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
    timeZone: "UTC",
  }).format(date);
}
