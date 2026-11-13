import React, { useCallback, useEffect, useRef, useState } from "react";
import { ProfileControls } from "./components/ProfileModal";
import { ActionNotice } from "./components/ActionNotice";
import { ReportDateNavigation } from "./components/ReportDateNavigation";
import { createRoot } from "react-dom/client";
import { api } from "./api";
import { watchReportingDate } from "./reportingDate";
import "./styles.css";
import {
  DailyOverview,
  KpiCards,
  MonthlyAnalytics,
  DeleteDialog,
} from "./components/JournalPanels";
const SLOTS = [
  "Morning (fasting)",
  "After breakfast",
  "After lunch",
  "After dinner",
];
const tokenKey = "sweety-token";
function App() {
  const [token, setToken] = useState(
    () => sessionStorage.getItem(tokenKey) || "",
  );
  const [displayName, setDisplayName] = useState("");
  const loadProfile = useCallback(
    (signal) => api("/profile", { token, signal }),
    [token],
  );
  const saveProfile = useCallback(
    (body) => api("/profile", { token, method: "PATCH", body }),
    [token],
  );
  const [register, setRegister] = useState(false);
  const [notice, setNotice] = useState(null);
  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState("");
  const [retry, setRetry] = useState(0);
  function logout(message) {
    sessionStorage.removeItem(tokenKey);
    setToken("");
    setDisplayName("");
    setNotice(message ? { error: true, text: message } : null);
  }
  useEffect(() => {
    return watchReportingDate({
      loadConfig: (signal) => api("/config", { signal }),
      onConfig: (freshConfig) => {
        setConfig(freshConfig);
        setConfigError("");
      },
      onError: () =>
        setConfigError(
          "Cannot connect to the API. Check that the server is running.",
        ),
    });
  }, [retry]);
  return (
    <div className={token ? "shell dashboard-page" : "shell auth-page"}>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="topbar">
        <a className="brand" href="/" aria-label="Glucon home">
          <span className="brand-icon" aria-hidden="true">
            G
          </span>
          glucon
          <span className="brand-dot">.</span>
        </a>
        {token && (
          <nav className="header-nav" aria-label="Main navigation">
            <a href="#main-content" aria-current="page">
              Overview
            </a>
            <a href="#reading-history">History</a>
          </nav>
        )}
        <span className="top-label">
          {displayName ? `Hello, ${displayName}` : "Personal glucose journal"}
        </span>
        {token && (
          <ProfileControls
            loadProfile={loadProfile}
            saveProfile={saveProfile}
            onLogout={() => logout()}
            onUnauthorized={logout}
            onSaved={({ profile, message }) => {
              setDisplayName(profile.name);
              setNotice({ text: message });
            }}
          />
        )}
      </header>
      <ActionNotice notice={notice} onDismiss={() => setNotice(null)} />
      {!token ? (
        <Auth
          register={register}
          setRegister={setRegister}
          onLogin={(value) => {
            sessionStorage.setItem(tokenKey, value);
            setToken(value);
            setNotice(null);
          }}
          notice={setNotice}
        />
      ) : config ? (
        <Dashboard
          token={token}
          config={config}
          notice={setNotice}
          logout={logout}
        />
      ) : (
        <main id="main-content" className="panel connection" role="status">
          {configError || "Connecting to your journal..."}
          {configError && (
            <button onClick={() => setRetry((value) => value + 1)}>
              Retry connection
            </button>
          )}
        </main>
      )}
      <footer>
        Made for the everyday.{" "}
        <span>A personal journal, not medical advice.</span>
      </footer>
    </div>
  );
}
function Auth({ register, setRegister, onLogin, notice }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (new TextEncoder().encode(data.password).length > 72) {
      setError("Password must be at most 72 UTF-8 bytes.");
      setBusy(false);
      return;
    }
    try {
      const result = await api("/auth/" + (register ? "register" : "login"), {
        method: "POST",
        body: data,
      });
      if (register) {
        setRegister(false);
        notice({ text: "Account created. Log in to start your journal." });
      } else onLogin(result.token);
    } catch (error) {
      setError(
        error.message === "Failed to fetch"
          ? "Cannot reach the API. Check that the server is running."
          : error.message,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main-content" className="auth-layout" tabIndex="-1">
      <section className="auth-intro">
        <span className="eyebrow">SMARTER GLUCOSE MANAGEMENT</span>
        <h1>
          Better tracking.
          <br />
          <em>Clearer insights.</em>
        </h1>
        <p>
          Record your glucose levels, review daily trends, and keep your health
          information organized in one place.
        </p>
      </section>
      <section className="panel auth-card">
        <span className="eyebrow">WELCOME TO GLUCON</span>
        <h2>{register ? "Start your journal" : "Welcome back"}</h2>
        <p>
          {register
            ? "A simple space for your daily readings."
            : "Your next check-in starts here."}
        </p>
        <form onSubmit={submit} key={String(register)}>
          {register && (
            <label>
              Full name
              <input
                name="name"
                autoComplete="name"
                placeholder="Your name"
                maxLength="100"
                required
              />
            </label>
          )}
          <label>
            Email address
            <input
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              maxLength="255"
              required
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              placeholder={register ? "At least 8 characters" : "Your password"}
              minLength={register ? 8 : undefined}
              required
            />
          </label>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <button className="primary full" disabled={busy}>
            {busy ? "Please wait..." : register ? "Create account" : "Log in"}
          </button>
        </form>
        <p className="switch">
          {register ? "Already have an account?" : "New here?"}{" "}
          <button
            onClick={() => {
              setError("");
              setRegister(!register);
            }}
          >
            {register ? "Log in" : "Create an account"}
          </button>
        </p>
      </section>
    </main>
  );
}
function Dashboard({ token, config, notice, logout }) {
  const [date, setDate] = useState(config.today);
  const [history, setHistory] = useState([]);
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const deleteInFlight = useRef(false);
  const formRef = useRef(null);
  const fail = (error) => {
    if (error.status === 401) logout(error.message);
    else notice({ error: true, text: error.message });
  };
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const options = { token, signal: controller.signal };
    Promise.all([
      api("/readings", options),
      ...["daily", "mtd", "monthly"].map((type) =>
        api(`/reports?date=${date}&type=${type}`, options),
      ),
    ])
      .then(([list, ...stats]) => {
        setHistory(list.readings);
        setReports(stats);
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          if (error.status === 401) logout(error.message);
          else setError(error.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [date, revision, token]);
  async function remove() {
    if (deleteInFlight.current || !deleting) return;
    deleteInFlight.current = true;
    setDeleteBusy(true);
    try {
      await api("/readings/" + deleting.id, { token, method: "DELETE" });
      if (editing?.id === deleting.id) setEditing(null);
      setDeleting(null);
      setRevision((v) => v + 1);
      notice({ text: "Reading deleted." });
    } catch (error) {
      fail(error);
    } finally {
      deleteInFlight.current = false;
      setDeleteBusy(false);
    }
  }
  useEffect(() => {
    if (editing) formRef.current?.querySelector("input")?.focus();
  }, [editing]);
  return (
    <main id="main-content" tabIndex="-1">
      <div className="dashboard-heading">
        <div>
          <span className="eyebrow">PERSONAL HEALTH / OVERVIEW</span>
          <h1>Your glucose journal</h1>
          <p>Record your readings and review your daily patterns.</p>
        </div>
        <ReportDateNavigation
          date={date}
          today={config.today}
          timezone={config.timezone}
          onChange={setDate}
        />
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
          <button onClick={() => setRevision((v) => v + 1)}>Retry</button>
        </div>
      )}
      <KpiCards
        report={reports?.[0]}
        loading={loading}
        error={Boolean(error)}
      />
      <div className="dashboard-grid">
        <section className="panel reading-form" ref={formRef}>
          <div className="section-icon" aria-hidden="true">
            +
          </div>
          <h2>{editing ? "Edit reading" : "Add a reading"}</h2>
          <p>Keep your daily journal up to date.</p>
          <ReadingForm
            key={editing?.id || "new"}
            editing={editing}
            token={token}
            config={config}
            selectedDate={date}
            onCancel={() => setEditing(null)}
            onSaved={(message) => {
              setEditing(null);
              setRevision((v) => v + 1);
              notice({ text: message });
            }}
            onUnauthorized={logout}
            onError={fail}
          />
        </section>
        <section
          className="reports"
          aria-label="Daily readings and analytics"
          aria-busy={loading}
        >
          {loading ? (
            <div className="panel skeleton" role="status">
              Loading your readings and reports...
            </div>
          ) : (
            !error &&
            reports && (
              <>
                <DailyOverview report={reports[0]} />
                <MonthlyAnalytics
                  reports={reports.slice(1)}
                  history={history}
                />
              </>
            )
          )}
        </section>
      </div>
      <section
        id="reading-history"
        className="panel history"
        aria-labelledby="history-heading"
      >
        <div className="section-title">
          <div>
            <span className="eyebrow">THE BIGGER PICTURE</span>
            <h2 id="history-heading">Reading history</h2>
          </div>
          <span className="badge">
            {loading ? "..." : error ? "\u2014" : history.length} readings
          </span>
        </div>
        <p>Your complete journal, with the latest dates first.</p>
        {loading ? (
          <p role="status">Loading readings...</p>
        ) : error ? (
          <p className="empty">
            Readings could not be refreshed. Use Retry above to reload your
            journal.
          </p>
        ) : !history.length ? (
          <div className="empty">
            Your journal starts with one reading. Add your first check-in above.
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <caption className="sr-only">
                All saved glucose readings, latest dates first
              </caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Time of day</th>
                  <th scope="col">Glucose</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.date)}</td>
                    <td>{row.slot}</td>
                    <td>
                      <strong>{row.value}</strong>{" "}
                      <span className="muted">mg/dL</span>
                    </td>
                    <td className="actions">
                      <button
                        aria-label={`Edit ${row.slot} reading on ${formatDate(row.date)}`}
                        onClick={() => {
                          setEditing(row);
                          formRef.current?.scrollIntoView({
                            behavior: "instant",
                            block: "start",
                          });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="danger"
                        aria-label={`Delete ${row.slot} reading on ${formatDate(row.date)}`}
                        onClick={() => setDeleting(row)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {deleting && (
        <DeleteDialog
          reading={deleting}
          busy={deleteBusy}
          onClose={() => setDeleting(null)}
          onDelete={remove}
        />
      )}
    </main>
  );
}
function ReadingForm({
  editing,
  token,
  config,
  selectedDate,
  onCancel,
  onSaved,
  onUnauthorized,
  onError,
}) {
  const [date, setDate] = useState(editing?.date || selectedDate);
  const [slot, setSlot] = useState(editing?.slot || SLOTS[0]);
  const [value, setValue] = useState(editing?.value ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    setError("");
    if (
      value === "" ||
      !Number.isInteger(Number(value)) ||
      Number(value) < 40 ||
      Number(value) > 600
    ) {
      setError("Enter a whole number from 40 to 600 mg/dL.");
      return;
    }
    if (!date || date > config.today) {
      setError("Choose a date that is not in the future.");
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      const result = await api(
        "/readings" + (editing ? "/" + editing.id : ""),
        {
          token,
          method: editing ? "PUT" : "POST",
          body: { date, slot, value: Number(value) },
        },
      );
      if (!editing) setValue("");
      onSaved(result.message);
    } catch (error) {
      if (error.status === 401) onUnauthorized(error.message);
      else {
        const message =
          error.message === "Failed to fetch"
            ? "Cannot reach the API. Please try again."
            : error.message;
        setError(message);
        onError?.({ message, status: error.status });
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} aria-busy={busy}>
      <label>
        Date
        <input
          type="date"
          min="1900-01-01"
          max={config.today}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </label>
      <label>
        Time of day
        <select value={slot} onChange={(e) => setSlot(e.target.value)}>
          {SLOTS.map((slot) => (
            <option key={slot}>{slot}</option>
          ))}
        </select>
      </label>
      <label>
        Glucose value <span className="muted">(mg/dL)</span>
        <input
          type="number"
          inputMode="numeric"
          min="40"
          max="600"
          step="1"
          placeholder="e.g. 108"
          aria-describedby="glucose-hint"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
        />
        <small id="glucose-hint">Whole numbers between 40 and 600 mg/dL.</small>
      </label>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <button className="primary full" disabled={busy}>
        {busy ? "Saving..." : editing ? "Save changes" : "+ Add reading"}
      </button>
      {editing && (
        <button
          type="button"
          className="full"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel editing
        </button>
      )}
      <p className="form-note">One reading per slot. Up to four a day.</p>
    </form>
  );
}
function formatDate(date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date + "T00:00:00Z"));
}
createRoot(document.getElementById("root")).render(<App />);
