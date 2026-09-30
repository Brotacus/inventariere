// SQLite timestamps returned by this API are UTC, even when no zone suffix is present.
export function parseApiDate(value) {
  if (!value) return null;
  const timestamp = String(value);
  const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestamp);
  const date = new Date(zoned || !timestamp.includes(":") ? timestamp : `${timestamp}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(value, options = { dateStyle: "medium", timeStyle: "short" }) {
  return parseApiDate(value)?.toLocaleString("ro-RO", options) || "—";
}
