import React, { useEffect, useRef } from "react";

function formatDate(date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date + "T00:00:00Z"));
}

function metrics(report) {
  return [
    ["Highest", report?.highest],
    ["Lowest", report?.lowest],
    ["Average", report?.average == null ? null : report.average.toFixed(1)],
    ["Readings", report?.count],
  ];
}

export function KpiCards({ report, loading, error }) {
  return (
    <section
      className="kpi-grid"
      aria-label="Selected day statistics"
      aria-busy={loading}
    >
      {metrics(report).map(([label, value], index) => (
        <article className={`panel kpi-card kpi-${index}`} key={label}>
          <div className="kpi-label">
            <h2>{label}</h2>
            <span className="metric-icon" aria-hidden="true">
              {["\u2191", "\u2193", "\u2248", "#"][index]}
            </span>
          </div>
          <p className="kpi-value">
            {loading ? (
              <span className="loading-value">...</span>
            ) : error ? (
              "\u2014"
            ) : (
              (value ?? "\u2014")
            )}
            <span>{index < 3 ? "mg/dL" : "entries"}</span>
          </p>
          <span className="kpi-context">
            {error
              ? "Unable to load"
              : loading
                ? "Loading selected day"
                : !report?.count
                  ? "No readings for this day"
                  : "Selected day"}
          </span>
        </article>
      ))}
    </section>
  );
}

export function DailyOverview({ report }) {
  return (
    <section className="panel daily-panel" aria-labelledby="daily-heading">
      <div className="section-title">
        <div>
          <h2 id="daily-heading">Daily readings</h2>
          <p>{formatDate(report.start)}</p>
        </div>
        <span className="badge">{report.count} of 4 recorded</span>
      </div>
      {!report.count ? (
        <div className="empty">
          <strong>No readings yet</strong>
          <p>Add a reading for this date to start your daily view.</p>
        </div>
      ) : (
        <ul className="daily-list">
          {report.readings.map((row, index) => (
            <li key={row.id}>
              <span className="slot-icon" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="slot-name">
                {row.slot}
                <span>Recorded reading</span>
              </div>
              <strong>
                {row.value}
                <small>mg/dL</small>
              </strong>
            </li>
          ))}
        </ul>
      )}
      <div className="panel-footnote">
        One entry per time slot. All values shown in mg/dL.
      </div>
    </section>
  );
}

export function MonthlyAnalytics({ reports, history }) {
  const [mtd, previous] = reports;
  // Use existing saved readings and the API's exact MTD boundaries; do not infer missing readings.
  const slots = [
    "Morning (fasting)",
    "After breakfast",
    "After lunch",
    "After dinner",
  ];
  const readings = history
    .filter((row) => row.date >= mtd.start && row.date <= mtd.end)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        slots.indexOf(a.slot) - slots.indexOf(b.slot),
    );
  return (
    <section className="panel analytics" aria-labelledby="analytics-heading">
      <div className="section-title">
        <div>
          <h2 id="analytics-heading">Month-to-date analytics</h2>
          <p>
            {formatDate(mtd.start)} · {formatDate(mtd.end)}
          </p>
        </div>
        <span className="unit">mg/dL</span>
      </div>
      <ReportStats report={mtd} />
      <TrendChart readings={readings} />
      <div className="previous-month">
        <div className="section-title">
          <h3>Previous month</h3>
          <span className="report-date">
            {formatDate(previous.start)} · {formatDate(previous.end)}
          </span>
        </div>
        <ReportStats report={previous} />
      </div>
    </section>
  );
}
function ReportStats({ report }) {
  return !report.count ? (
    <p className="empty">No readings for this period.</p>
  ) : (
    <dl className="stats">
      {metrics(report).map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value ?? "\u2014"}</dd>
        </div>
      ))}
    </dl>
  );
}
function TrendChart({ readings }) {
  if (readings.length < 2)
    return (
      <p className="chart-empty">
        Record at least two readings this month to see a trend.
      </p>
    );
  const width = 680,
    height = 190,
    left = 42,
    right = 16,
    top = 20,
    bottom = 32;
  const values = readings.map((row) => row.value);
  const min = Math.max(0, Math.floor(Math.min(...values) / 20) * 20 - 20);
  const max = Math.ceil(Math.max(...values) / 20) * 20 + 20;
  const y = (value) =>
    top + ((max - value) / (max - min)) * (height - top - bottom);
  const x = (index) =>
    left + (index / (readings.length - 1)) * (width - left - right);
  const points = readings
    .map((row, index) => `${x(index)},${y(row.value)}`)
    .join(" ");
  return (
    <figure className="trend-chart">
      <figcaption>
        <strong>Reading trend</strong>
        <span>Saved entries in date order · mg/dL</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Month-to-date trend of ${readings.length} saved glucose readings, from ${formatDate(readings[0].date)} to ${formatDate(readings.at(-1).date)}. Exact values are available in reading history.`}
      >
        {[min, (min + max) / 2, max].map((value) => (
          <g key={value}>
            <line
              x1={left}
              x2={width - right}
              y1={y(value)}
              y2={y(value)}
              stroke="#E4EFEC"
              strokeDasharray="4 4"
            />
            <text x={left - 10} y={y(value) + 4} textAnchor="end">
              {value}
            </text>
          </g>
        ))}
        <polyline
          points={points}
          fill="none"
          stroke="#0F766E"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {readings.map((row, index) => (
          <circle
            key={row.id}
            cx={x(index)}
            cy={y(row.value)}
            r="3.5"
            fill="#0F766E"
            stroke="white"
            strokeWidth="2"
          >
            <title>{`${row.date} - ${row.slot}: ${row.value} mg/dL`}</title>
          </circle>
        ))}
        <text x={left} y={height - 6}>
          {formatDate(readings[0].date)}
        </text>
        <text x={width - right} y={height - 6} textAnchor="end">
          {formatDate(readings.at(-1).date)}
        </text>
      </svg>
      <p className="chart-note">
        Entries are equally spaced, not a continuous measurement. No readings
        are estimated.
      </p>
    </figure>
  );
}

export function DeleteDialog({ reading, busy, onClose, onDelete }) {
  const ref = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    ref.current.showModal();
    return () => {
      previousFocus?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="panel modal"
      aria-labelledby="delete-title"
      aria-describedby="delete-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <h2 id="delete-title">Delete this reading?</h2>
      <p id="delete-description">
        {formatDate(reading.date)} · {reading.slot} · {reading.value} mg/dL
      </p>
      <p>This action cannot be undone.</p>
      <div className="button-row">
        <button autoFocus disabled={busy} onClick={onClose}>
          Keep reading
        </button>
        <button
          className="primary danger-bg"
          disabled={busy}
          onClick={onDelete}
        >
          {busy ? "Deleting..." : "Delete reading"}
        </button>
      </div>
    </dialog>
  );
}
