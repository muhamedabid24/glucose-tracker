export const MIN_REPORT_DATE = "1900-01-01";
// UTC is used only for calendar arithmetic; today always comes from /api/config.
export function shiftReportDate(date, days) {
  const value = new Date(date + "T00:00:00Z");
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
