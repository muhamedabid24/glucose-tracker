// The API remains authoritative for today. Browser time only schedules refreshes.
export function reportingDateRefreshDelay(timezone, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type) =>
    Number(parts.find((part) => part.type === type).value);
  const elapsed =
    ((value("hour") * 60 + value("minute")) * 60 + value("second")) * 1000 +
    now.getUTCMilliseconds();
  // Refresh just after midnight, or in at most a minute. The minute cap also
  // handles clock changes and daylight-saving transitions in configured zones.
  return Math.min(60_000, 86_400_000 - elapsed + 50);
}

export function watchReportingDate({
  loadConfig,
  onConfig,
  onError,
  windowTarget = window,
  documentTarget = document,
  now = () => new Date(),
  schedule = setTimeout,
  cancel = clearTimeout,
}) {
  let stopped = false;
  let controller;
  let timer;
  let timezone = "Asia/Kolkata";

  async function refresh() {
    cancel(timer);
    controller?.abort();
    const request = new AbortController();
    controller = request;
    try {
      const config = await loadConfig(request.signal);
      if (stopped || request.signal.aborted) return;
      // Validate the timezone before accepting the configuration.
      reportingDateRefreshDelay(config.timezone, now());
      timezone = config.timezone;
      onConfig(config);
    } catch (error) {
      if (!stopped && !request.signal.aborted) onError(error);
    } finally {
      if (!stopped && controller === request) {
        timer = schedule(refresh, reportingDateRefreshDelay(timezone, now()));
      }
    }
  }
  function visible() {
    if (documentTarget.visibilityState === "visible") refresh();
  }
  windowTarget.addEventListener("focus", refresh);
  windowTarget.addEventListener("online", refresh);
  documentTarget.addEventListener("visibilitychange", visible);
  refresh();
  return () => {
    stopped = true;
    cancel(timer);
    controller?.abort();
    windowTarget.removeEventListener("focus", refresh);
    windowTarget.removeEventListener("online", refresh);
    documentTarget.removeEventListener("visibilitychange", visible);
  };
}
