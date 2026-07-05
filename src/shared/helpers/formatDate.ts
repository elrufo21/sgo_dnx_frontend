const pad = (value: number) => value.toString().padStart(2, "0");

const parseDate = (value: string | number | Date) => {
  if (value instanceof Date) return value;

  if (typeof value === "string") {
    const trimmed = value.trim();
    // Avoid timezone shifts when the API returns "YYYY-MM-DD"
    const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      const [, y, m, d] = dateOnlyMatch;
      return new Date(Number(y), Number(m) - 1, Number(d));
    }
    return new Date(trimmed);
  }

  return new Date(value);
};

export const formatDate = (value?: string | number | Date | null) => {
  if (!value) return "";
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return "";
  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};
