import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  loadComponent,
  mount,
  click,
  input,
  submit,
  button,
  act,
} from "../test-support/domHarness.js";
import { shiftReportDate } from "../src/reportDates.js";
const { App, ReadingForm } = await import(await loadComponent("src/main.jsx"));
const roots = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await root.close();
  delete globalThis.gluconTestApi;
});
async function setup({ signedIn = true, rows = [], override } = {}) {
  const state = {
    calls: [],
    rows: [...rows],
    profile: { id: 1, name: "QA User", age: null, weight: null },
  };
  if (signedIn) sessionStorage.setItem("sweety-token", "fixture-token");
  else sessionStorage.clear();
  globalThis.gluconTestApi = async (path, options = {}) => {
    state.calls.push({ path, ...options });
    if (override) {
      const response = override(path, options, state);
      if (response !== undefined) return response;
    }
    if (path === "/config")
      return { today: "2026-11-13", timezone: "Asia/Kolkata" };
    if (path === "/auth/login")
      return { token: "fixture-token", user: { id: 1, name: "QA User" } };
    if (path === "/auth/register")
      return { user: { id: 1, name: options.body.name } };
    if (path === "/profile") {
      if (options.method === "PATCH") {
        state.profile = { id: 1, ...options.body };
        return {
          profile: { ...state.profile },
          message: "Profile updated successfully.",
        };
      }
      return { profile: { ...state.profile } };
    }
    if (path === "/readings" && options.method === "POST") {
      const reading = { id: state.rows.length + 20, ...options.body };
      state.rows.push(reading);
      return { reading, message: "Reading added." };
    }
    if (path === "/readings") return { readings: [...state.rows] };
    if (path.startsWith("/readings/") && options.method === "PUT") {
      const id = Number(path.split("/").at(-1));
      state.rows = state.rows.map((row) =>
        row.id === id ? { id, ...options.body } : row,
      );
      return { message: "Reading updated." };
    }
    if (path.startsWith("/readings/") && options.method === "DELETE") {
      const id = Number(path.split("/").at(-1));
      state.rows = state.rows.filter((row) => row.id !== id);
      return { message: "Reading deleted." };
    }
    if (path.startsWith("/reports?")) {
      const query = new URLSearchParams(path.split("?")[1]);
      const date = query.get("date"),
        type = query.get("type");
      return {
        type,
        start: date,
        end: date,
        count: 0,
        highest: null,
        lowest: null,
        average: null,
        readings: [],
      };
    }
    throw Error("Unexpected API request " + path);
  };
  const root = await mount(App);
  roots.push(root);
  return { ...root, state };
}
const mutations = (state) =>
  state.calls.filter((call) => ["POST", "PUT", "DELETE"].includes(call.method));

test("report-date arithmetic handles leap days, year boundaries and UTC-independent calendar dates", () => {
  assert.equal(shiftReportDate("2024-03-01", -1), "2024-02-29");
  assert.equal(shiftReportDate("2025-03-01", -1), "2025-02-28");
  assert.equal(shiftReportDate("2026-12-31", 1), "2027-01-01");
  assert.equal(shiftReportDate("2026-11-13", -1), "2026-11-12");
});
test("Previous/Today/Next use configured today, refresh reports and never navigate into the future", async () => {
  const root = await setup();
  assert.equal(button(root.container, "Next Day").disabled, true);
  await click(button(root.container, "Previous Day"));
  assert.equal(
    root.container.querySelector(".date-picker input").value,
    "2026-11-12",
  );
  assert.equal(button(root.container, "Next Day").disabled, false);
  const refreshed = root.state.calls.filter((call) =>
    call.path.startsWith("/reports?date=2026-11-12"),
  );
  assert.equal(refreshed.length, 3);
  await click(button(root.container, "Next Day"));
  assert.equal(
    root.container.querySelector(".date-picker input").value,
    "2026-11-13",
  );
  assert.equal(button(root.container, "Next Day").disabled, true);
  const calls = root.state.calls.length;
  await click(button(root.container, "Next Day"));
  assert.equal(root.state.calls.length, calls);
  await click(button(root.container, "Previous Day"));
  await click(button(root.container, "Today"));
  assert.equal(
    root.container.querySelector(".date-picker input").value,
    "2026-11-13",
  );
  await input(root.container.querySelector(".date-picker input"), "1900-01-01");
  assert.equal(button(root.container, "Previous Day").disabled, true);
  await input(root.container.querySelector(".date-picker input"), "2026-11-14");
  assert.equal(
    root.state.calls.some((call) => call.path.includes("date=2026-11-14")),
    false,
  );
});
test("report navigation preserves an unfinished reading draft", async () => {
  const root = await setup();
  const value = root.container.querySelector(
    '.reading-form input[type="number"]',
  );
  await input(value, "108");
  await click(button(root.container, "Previous Day"));
  assert.equal(value.value, "108");
  assert.equal(
    root.container.querySelector('.reading-form input[type="date"]').value,
    "2026-11-13",
  );
  assert.equal(mutations(root.state).length, 0);
});
test("add and edit reuse success feedback and refresh saved history", async () => {
  const root = await setup();
  await input(
    root.container.querySelector('.reading-form input[type="number"]'),
    "108",
  );
  await submit(root.container.querySelector(".reading-form form"));
  assert.ok(
    root.container
      .querySelector(".notice-toast")
      .textContent.includes("Reading added."),
  );
  assert.equal(
    root.container.querySelector(".notice-toast").getAttribute("role"),
    "status",
  );
  assert.ok(
    root.container.querySelector(".history tbody").textContent.includes("108"),
  );
  await click(button(root.container, "Edit"));
  await input(
    root.container.querySelector('.reading-form input[type="number"]'),
    "110",
  );
  await submit(root.container.querySelector(".reading-form form"));
  assert.ok(
    root.container
      .querySelector(".notice-toast")
      .textContent.includes("Reading updated."),
  );
  assert.ok(
    root.container.querySelector(".history tbody").textContent.includes("110"),
  );
  await click(
    root.container.querySelector('[aria-label="Dismiss notification"]'),
  );
  assert.equal(root.container.querySelector(".notice-toast"), null);
});
test("failed save exposes an accessible error notification and keeps draft input", async () => {
  const root = await setup({
    override: (path, options) =>
      path === "/readings" && options.method === "POST"
        ? Promise.reject(
            Object.assign(
              Error("A reading already exists for that date and slot."),
              { status: 409 },
            ),
          )
        : undefined,
  });
  await input(
    root.container.querySelector('.reading-form input[type="number"]'),
    "108",
  );
  await submit(root.container.querySelector(".reading-form form"));
  const toast = root.container.querySelector(".notice-toast");
  assert.equal(toast.getAttribute("role"), "alert");
  assert.ok(toast.textContent.includes("already exists"));
  assert.equal(
    root.container.querySelector('.reading-form input[type="number"]').value,
    "108",
  );
});
test("rapid duplicate form submissions produce only one network mutation", async () => {
  let finish;
  const root = await setup({
    override: (path, options) =>
      path === "/readings" && options.method === "POST"
        ? new Promise((resolve) => {
            finish = () => resolve({ message: "Reading added." });
          })
        : undefined,
  });
  await input(
    root.container.querySelector('.reading-form input[type="number"]'),
    "108",
  );
  const form = root.container.querySelector(".reading-form form");
  await act(async () => {
    for (let i = 0; i < 2; i++)
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
  });
  assert.equal(mutations(root.state).length, 1);
  assert.equal(button(root.container, "Saving...").disabled, true);
  await act(async () => finish());
});
test("delete requires confirmation, guards repeated requests and reports success", async () => {
  let finish;
  const root = await setup({
    rows: [{ id: 4, date: "2026-11-13", slot: "After lunch", value: 108 }],
    override: (path, options, state) =>
      options.method === "DELETE"
        ? new Promise((resolve) => {
            finish = () => {
              state.rows = [];
              resolve({ message: "Reading deleted." });
            };
          })
        : undefined,
  });
  await click(button(root.container, "Delete"));
  assert.equal(mutations(root.state).length, 0);
  assert.ok(root.container.querySelector("dialog"));
  await click(button(root.container, "Keep reading"));
  assert.equal(mutations(root.state).length, 0);
  await click(button(root.container, "Delete"));
  const confirm = button(root.container, "Delete reading");
  await act(async () => {
    confirm.click();
    confirm.click();
  });
  assert.equal(mutations(root.state).length, 1);
  assert.equal(button(root.container, "Deleting...").disabled, true);
  await act(async () => finish());
  assert.equal(root.container.querySelector("dialog"), null);
  assert.ok(
    root.container
      .querySelector(".notice-toast")
      .textContent.includes("Reading deleted."),
  );
});
test("signup, login and logout UI transitions preserve click-only profile behavior", async () => {
  const root = await setup({ signedIn: false });
  assert.equal(root.container.querySelector("dialog"), null);
  await click(button(root.container, "Create an account"));
  await input(root.container.querySelector('[name="name"]'), "QA User");
  await input(
    root.container.querySelector('[name="email"]'),
    "qa@example.test",
  );
  await input(
    root.container.querySelector('[name="password"]'),
    "QaPassword123!",
  );
  await submit(root.container.querySelector(".auth-card form"));
  assert.ok(
    root.container
      .querySelector(".notice-toast")
      .textContent.includes("Account created"),
  );
  await input(
    root.container.querySelector('[name="email"]'),
    "qa@example.test",
  );
  await input(
    root.container.querySelector('[name="password"]'),
    "QaPassword123!",
  );
  await submit(root.container.querySelector(".auth-card form"));
  assert.ok(button(root.container, "My Profile"));
  assert.equal(root.container.querySelector("dialog"), null);
  assert.equal(
    root.state.calls.filter((call) => call.path === "/profile").length,
    0,
  );
  await click(button(root.container, "Log out"));
  assert.ok(root.container.querySelector(".auth-card"));
  assert.equal(sessionStorage.getItem("sweety-token"), null);
  assert.equal(root.container.querySelector("dialog"), null);
});
test("profile updates header name and reloads saved data after logout/login without changing URL", async () => {
  const root = await setup();
  const url = window.location.href;
  await click(button(root.container, "My Profile"));
  await input(root.container.querySelector('[name="name"]'), "Saved Name");
  await input(root.container.querySelector('[name="age"]'), "34");
  await input(root.container.querySelector('[name="weight"]'), "70.25");
  await submit(root.container.querySelector(".profile-modal form"));
  assert.equal(root.container.querySelector("dialog"), null);
  assert.ok(
    root.container
      .querySelector(".top-label")
      .textContent.includes("Saved Name"),
  );
  assert.ok(
    root.container
      .querySelector(".notice-toast")
      .textContent.includes("Profile updated"),
  );
  await click(button(root.container, "Log out"));
  await input(
    root.container.querySelector('[name="email"]'),
    "qa@example.test",
  );
  await input(
    root.container.querySelector('[name="password"]'),
    "QaPassword123!",
  );
  await submit(root.container.querySelector(".auth-card form"));
  assert.equal(root.container.querySelector("dialog"), null);
  await click(button(root.container, "My Profile"));
  assert.equal(
    root.container.querySelector('[name="name"]').value,
    "Saved Name",
  );
  assert.equal(root.container.querySelector('[name="age"]').value, "34");
  assert.equal(root.container.querySelector('[name="weight"]').value, "70.25");
  assert.equal(window.location.href, url);
});

for (const editing of [false, true]) {
  for (const value of ["39", "601", "108.5", "-1", "", "invalid"])
    test(`${editing ? "edit" : "create"} rejects invalid glucose input ${JSON.stringify(value)} before mutation`, async () => {
      const root = await setup({
        rows: editing
          ? [
              {
                id: 9,
                date: "2026-11-13",
                slot: "Morning (fasting)",
                value: 108,
              },
            ]
          : [],
      });
      if (editing) await click(button(root.container, "Edit"));
      await input(
        root.container.querySelector('.reading-form input[type="number"]'),
        value,
      );
      await submit(root.container.querySelector(".reading-form form"));
      assert.equal(mutations(root.state).length, 0);
      assert.ok(
        root.container
          .querySelector('.reading-form [role="alert"]')
          .textContent.includes("whole number from 40 to 600"),
      );
    });
  for (const value of ["40", "600"])
    test(`${editing ? "edit" : "create"} accepts boundary ${value}`, async () => {
      const root = await setup({
        rows: editing
          ? [
              {
                id: 9,
                date: "2026-11-13",
                slot: "Morning (fasting)",
                value: 108,
              },
            ]
          : [],
      });
      if (editing) await click(button(root.container, "Edit"));
      await input(
        root.container.querySelector('.reading-form input[type="number"]'),
        value,
      );
      await submit(root.container.querySelector(".reading-form form"));
      const calls = mutations(root.state);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].body.value, Number(value));
      assert.equal(calls[0].method, editing ? "PUT" : "POST");
    });
  test(`${editing ? "edit" : "create"} rejects a future date before mutation`, async () => {
    const root = await setup({
      rows: editing
        ? [{ id: 9, date: "2026-11-13", slot: "Morning (fasting)", value: 108 }]
        : [],
    });
    if (editing) await click(button(root.container, "Edit"));
    await input(
      root.container.querySelector('.reading-form input[type="number"]'),
      "108",
    );
    await input(
      root.container.querySelector('.reading-form input[type="date"]'),
      "2026-11-14",
    );
    await submit(root.container.querySelector(".reading-form form"));
    assert.equal(mutations(root.state).length, 0);
    assert.ok(
      root.container
        .querySelector('.reading-form [role="alert"]')
        .textContent.includes("not in the future"),
    );
  });
}
