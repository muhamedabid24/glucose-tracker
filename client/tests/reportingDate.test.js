import test from "node:test";
import assert from "node:assert/strict";
import {
  reportingDateRefreshDelay,
  watchReportingDate,
} from "../src/reportingDate.js";

function fixture({ instant = "2026-11-12T18:29:59.900Z", load } = {}) {
  const windowTarget = new EventTarget();
  const documentTarget = new EventTarget();
  documentTarget.visibilityState = "visible";
  let time = new Date(instant);
  let calls = 0;
  const timers = new Map();
  const configs = [],
    errors = [];
  const stop = watchReportingDate({
    windowTarget,
    documentTarget,
    now: () => time,
    schedule: (fn, delay) => {
      const id = Symbol();
      timers.set(id, { fn, delay });
      return id;
    },
    cancel: (id) => timers.delete(id),
    loadConfig: (signal) => {
      calls++;
      return load
        ? load(signal, calls)
        : Promise.resolve({
            today: calls === 1 ? "2026-11-12" : "2026-11-13",
            timezone: "Asia/Kolkata",
          });
    },
    onConfig: (config) => configs.push(config),
    onError: (error) => errors.push(error),
  });
  return {
    windowTarget,
    documentTarget,
    timers,
    configs,
    errors,
    stop,
    get calls() {
      return calls;
    },
    setTime: (value) => {
      time = new Date(value);
    },
  };
}
const settle = () => new Promise((resolve) => setImmediate(resolve));

test("Kolkata midnight uses the UTC+05:30 boundary rather than browser-local midnight", () => {
  assert.equal(
    reportingDateRefreshDelay(
      "Asia/Kolkata",
      new Date("2026-11-12T18:29:59.900Z"),
    ),
    150,
  );
  assert.equal(
    reportingDateRefreshDelay("Asia/Kolkata", new Date("2026-11-12T18:30:00Z")),
    60_000,
  );
  assert.equal(
    reportingDateRefreshDelay("Asia/Kolkata", new Date("2026-12-31T18:29:59Z")),
    1050,
  );
  assert.equal(
    reportingDateRefreshDelay("Asia/Kolkata", new Date("2024-02-29T18:29:59Z")),
    1050,
  );
});
test("refresh accepts authoritative server today after midnight", async () => {
  const state = fixture();
  await settle();
  assert.equal(state.configs[0].today, "2026-11-12");
  const scheduled = [...state.timers.values()][0];
  assert.equal(scheduled.delay, 150);
  state.setTime("2026-11-12T18:30:00.050Z");
  scheduled.fn();
  await settle();
  assert.equal(state.configs.at(-1).today, "2026-11-13");
  state.stop();
});
test("focus, visible-tab resume and reconnect revalidate configuration", async () => {
  const state = fixture();
  await settle();
  for (const [target, event] of [
    [state.windowTarget, "focus"],
    [state.documentTarget, "visibilitychange"],
    [state.windowTarget, "online"],
  ]) {
    const previous = state.calls;
    target.dispatchEvent(new Event(event));
    await settle();
    assert.equal(state.calls, previous + 1);
  }
  state.documentTarget.visibilityState = "hidden";
  const previous = state.calls;
  state.documentTarget.dispatchEvent(new Event("visibilitychange"));
  await settle();
  assert.equal(state.calls, previous);
  state.stop();
});
test("failed refresh keeps the last successful configuration and retries", async () => {
  const state = fixture({
    load: (_, call) =>
      call === 2
        ? Promise.reject(new Error("Offline"))
        : Promise.resolve({ today: "2026-11-12", timezone: "Asia/Kolkata" }),
  });
  await settle();
  state.windowTarget.dispatchEvent(new Event("focus"));
  await settle();
  assert.equal(state.errors.length, 1);
  assert.equal(state.configs.length, 1);
  assert.equal(state.timers.size, 1);
  [...state.timers.values()][0].fn();
  await settle();
  assert.equal(state.configs.length, 2);
  state.stop();
});
test("an older request cannot overwrite a later focus refresh", async () => {
  const pending = [];
  const state = fixture({
    load: (signal) =>
      new Promise((resolve) => pending.push({ signal, resolve })),
  });
  state.windowTarget.dispatchEvent(new Event("focus"));
  assert.equal(pending[0].signal.aborted, true);
  pending[1].resolve({ today: "2026-11-13", timezone: "Asia/Kolkata" });
  await settle();
  pending[0].resolve({ today: "2026-11-12", timezone: "Asia/Kolkata" });
  await settle();
  assert.equal(state.configs.length, 1);
  assert.equal(state.configs[0].today, "2026-11-13");
  state.stop();
});
test("cleanup removes listeners, cancels timers and prevents late updates", async () => {
  let resolve;
  const state = fixture({
    load: () =>
      new Promise((done) => {
        resolve = done;
      }),
  });
  state.stop();
  resolve({ today: "2026-11-13", timezone: "Asia/Kolkata" });
  await settle();
  state.windowTarget.dispatchEvent(new Event("focus"));
  state.documentTarget.dispatchEvent(new Event("visibilitychange"));
  assert.equal(state.calls, 1);
  assert.equal(state.configs.length, 0);
  assert.equal(state.timers.size, 0);
});
