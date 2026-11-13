import React from "react";
import { MIN_REPORT_DATE, shiftReportDate } from "../reportDates.js";
export function ReportDateNavigation({ date, today, timezone, onChange }) {
  function move(days) {
    const next = shiftReportDate(date, days);
    if (next >= MIN_REPORT_DATE && next <= today) onChange(next);
  }
  return (
    <div className="report-date-controls">
      <label className="date-picker">
        Report date
        <input
          type="date"
          value={date}
          max={today}
          min={MIN_REPORT_DATE}
          onChange={(event) => {
            if (event.target.value && event.target.validity.valid)
              onChange(event.target.value);
          }}
        />
        <small>{timezone}</small>
      </label>
      <div
        className="date-navigation"
        role="group"
        aria-label="Report date navigation"
      >
        <button
          type="button"
          onClick={() => move(-1)}
          disabled={date <= MIN_REPORT_DATE}
        >
          Previous Day
        </button>
        <button
          type="button"
          onClick={() => onChange(today)}
          disabled={date === today}
        >
          Today
        </button>
        <button type="button" onClick={() => move(1)} disabled={date >= today}>
          Next Day
        </button>
      </div>
    </div>
  );
}
