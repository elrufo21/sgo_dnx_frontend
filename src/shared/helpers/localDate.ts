type DateLike = string | number | Date;

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const pad = (value: number) => String(value).padStart(2, "0");

export const getLocalDateISO = (date: Date = new Date()) => {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
};

export const parseDateLikeToLocalDate = (
  value?: DateLike | null,
): Date | null => {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const dateOnlyMatch = trimmed.match(DATE_ONLY_PATTERN);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const toLocalDateInputValue = (
  value?: DateLike | null,
  fallback = "",
) => {
  const parsed = parseDateLikeToLocalDate(value);
  return parsed ? getLocalDateISO(parsed) : fallback;
};

export const toLocalStartOfDayISO = (value?: DateLike | null) => {
  const parsed = parseDateLikeToLocalDate(value);
  if (!parsed) return null;

  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(
    parsed.getDate(),
  )}T00:00:00`;
};

export const addDaysToLocalDateISO = (baseDate: string, days: number) => {
  const parsed = parseDateLikeToLocalDate(baseDate);
  if (!parsed) return null;

  const safeDays = Number.isFinite(days) ? Math.trunc(days) : 0;
  const target = new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate() + safeDays,
  );
  return getLocalDateISO(target);
};

export const diffDaysBetweenLocalDates = (startDate: string, endDate: string) => {
  const start = parseDateLikeToLocalDate(startDate);
  const end = parseDateLikeToLocalDate(endDate);
  if (!start || !end) return null;

  const startUtc = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endUtc - startUtc) / DAY_MS);
};
