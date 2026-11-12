const SLOTS = [
  "Morning (fasting)",
  "After breakfast",
  "After lunch",
  "After dinner",
];
// Dates are calendar dates in the configured reporting timezone, never timestamps.
function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.APP_TIMEZONE || "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
function validDate(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value >= "1900-01-01" &&
    !Number.isNaN(Date.parse(value + "T00:00:00Z")) &&
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value
  );
}
function range(type, date) {
  if (type === "daily") return [date, date];
  if (type === "mtd") return [date.slice(0, 7) + "-01", date];
  const first = new Date(date.slice(0, 7) + "-01T00:00:00Z");
  first.setUTCDate(0);
  const end = first.toISOString().slice(0, 10);
  return [end.slice(0, 7) + "-01", end];
}
module.exports = { SLOTS, today, validDate, range };
