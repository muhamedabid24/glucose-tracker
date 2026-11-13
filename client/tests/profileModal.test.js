import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { transformWithEsbuild } from "vite";
import { validateProfile } from "../src/profileValidation.js";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
});
for (const name of [
  "window",
  "document",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLDialogElement",
  "Node",
  "MutationObserver",
  "Event",
  "MouseEvent",
  "KeyboardEvent",
])
  Object.defineProperty(globalThis, name, {
    value: dom.window[name],
    configurable: true,
    writable: true,
  });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// jsdom does not implement the browser's modal top layer/inert background.
// This shim exposes open/close events; native browser modality remains manual QA.
dom.window.HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute("open", "");
};
dom.window.HTMLDialogElement.prototype.close = function () {
  this.removeAttribute("open");
};
const { createRoot } = await import("react-dom/client");
let source = fs.readFileSync(
  new URL("../src/components/ProfileModal.jsx", import.meta.url),
  "utf8",
);
source = source
  .replace(
    /from ["']react["']/,
    `from "${pathToFileURL(path.resolve("node_modules/react/index.js")).href}"`,
  )
  .replace(
    /from ["']\.\.\/profileValidation\.js["']/,
    `from "${new URL("../src/profileValidation.js", import.meta.url).href}"`,
  );
const compiled = await transformWithEsbuild(source, "ProfileModal.jsx", {
  jsx: "transform",
  loader: "jsx",
});
const { ProfileControls } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled.code).toString("base64")
);
const fixtures = [];
afterEach(async () => {
  for (const state of fixtures.splice(0)) {
    await act(async () => state.root.unmount());
    state.container.remove();
  }
  assert.equal(document.body.style.overflow, "");
});
async function fixture(options = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const state = {
    container,
    root,
    loads: 0,
    saves: [],
    saved: { id: 1, name: "Initial Name", age: null, weight: null },
    results: [],
    unauthorized: [],
  };
  state.props = {
    loadProfile: async (signal) => {
      state.loads++;
      return options.load
        ? options.load(signal, state)
        : { profile: { ...state.saved } };
    },
    saveProfile: async (profile) => {
      state.saves.push(profile);
      if (options.save) return options.save(profile, state);
      state.saved = { id: 1, ...profile };
      return {
        profile: { ...state.saved },
        message: "Profile updated successfully.",
      };
    },
    onSaved: (result) => state.results.push(result),
    onLogout() {},
    onUnauthorized: (message) => state.unauthorized.push(message),
  };
  fixtures.push(state);
  await act(async () =>
    root.render(React.createElement(ProfileControls, state.props)),
  );
  return state;
}
const button = (state, text) =>
  [...state.container.querySelectorAll("button")].find(
    (item) => item.textContent === text,
  );
const dialog = (state) => state.container.querySelector("dialog");
async function open(state) {
  const trigger = button(state, "My Profile");
  trigger.focus();
  await act(async () => trigger.click());
}
async function input(state, name, value) {
  await act(async () => {
    const element = state.container.querySelector(`[name="${name}"]`);
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function submit(state) {
  await act(async () =>
    dialog(state)
      .querySelector("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
}

test("profile is completely absent on mount and rerenders; opens only from My Profile", async () => {
  const state = await fixture();
  assert.equal(dialog(state), null);
  assert.equal(state.container.querySelector("input"), null);
  assert.equal(state.loads, 0);
  await act(async () =>
    state.root.render(React.createElement(ProfileControls, state.props)),
  );
  assert.equal(dialog(state), null);
  assert.equal(state.loads, 0);
  const headerButtons = [...state.container.querySelectorAll("button")];
  assert.deepEqual(
    headerButtons.map((item) => item.textContent),
    ["My Profile", "Log out"],
  );
  await open(state);
  assert.equal(state.loads, 1);
  assert.equal(dialog(state).open, true);
  assert.equal(dialog(state).getAttribute("role"), "dialog");
  assert.equal(dialog(state).getAttribute("aria-modal"), "true");
  assert.equal(dialog(state).getAttribute("aria-labelledby"), "profile-title");
  assert.equal(document.activeElement.id, "profile-name");
  assert.equal(state.container.querySelector('[name="age"]').value, "");
  assert.equal(state.container.querySelector('[name="weight"]').value, "");
  assert.equal(document.body.style.overflow, "hidden");
});
for (const method of ["Cancel", "X", "Escape", "outside"])
  test(`${method} closes without saving and restores trigger focus`, async () => {
    const state = await fixture();
    await open(state);
    await input(state, "name", "Unsaved name");
    await act(async () => {
      if (method === "Escape")
        dialog(state).dispatchEvent(
          new Event("cancel", { bubbles: true, cancelable: true }),
        );
      else if (method === "outside") {
        dialog(state).getBoundingClientRect = () => ({
          left: 100,
          right: 500,
          top: 100,
          bottom: 500,
        });
        dialog(state).dispatchEvent(
          new MouseEvent("click", { bubbles: true, clientX: 20, clientY: 20 }),
        );
      } else button(state, method).click();
    });
    assert.equal(dialog(state), null);
    assert.equal(state.saves.length, 0);
    assert.equal(document.activeElement, button(state, "My Profile"));
    await open(state);
    assert.equal(
      state.container.querySelector('[name="name"]').value,
      "Initial Name",
    );
    assert.equal(state.loads, 2);
  });
test("click inside the dialog does not dismiss it; Tab wraps within enabled controls", async () => {
  const state = await fixture();
  await open(state);
  const modal = dialog(state);
  modal.getBoundingClientRect = () => ({
    left: 100,
    right: 500,
    top: 100,
    bottom: 500,
  });
  await act(async () =>
    modal.dispatchEvent(
      new MouseEvent("click", { bubbles: true, clientX: 200, clientY: 200 }),
    ),
  );
  assert.ok(dialog(state));
  const close = button(state, "X"),
    save = button(state, "Save Changes");
  save.focus();
  await act(async () =>
    save.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  assert.equal(document.activeElement, close);
  await act(async () =>
    close.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  assert.equal(document.activeElement, save);
});
test("invalid values show clear field errors and never call save", async () => {
  const state = await fixture();
  await open(state);
  await input(state, "name", " ");
  await input(state, "age", "25.5");
  await input(state, "weight", "0");
  await submit(state);
  assert.equal(state.saves.length, 0);
  assert.ok(state.container.textContent.includes("Enter a name"));
  assert.ok(state.container.textContent.includes("whole-number age"));
  assert.ok(state.container.textContent.includes("weight above 0"));
  assert.equal(
    state.container.querySelector('[name="name"]').getAttribute("aria-invalid"),
    "true",
  );
});
test("successful save uses normalized values, notifies the parent, closes, and reloads latest on reopen", async () => {
  const state = await fixture();
  await open(state);
  await input(state, "name", "  Updated Name  ");
  await input(state, "age", "32");
  await input(state, "weight", "72.55");
  await submit(state);
  assert.deepEqual(state.saves, [
    { name: "Updated Name", age: 32, weight: 72.55 },
  ]);
  assert.equal(state.results[0].profile.name, "Updated Name");
  assert.equal(dialog(state), null);
  await open(state);
  assert.equal(state.loads, 2);
  assert.equal(
    state.container.querySelector('[name="name"]').value,
    "Updated Name",
  );
  assert.equal(state.container.querySelector('[name="age"]').value, "32");
  assert.equal(state.container.querySelector('[name="weight"]').value, "72.55");
});
test("saving blocks cancel, X, Escape and outside dismissal until the request completes", async () => {
  let finish;
  const state = await fixture({
    save: (profile) =>
      new Promise((resolve) => {
        finish = () =>
          resolve({ profile: { id: 1, ...profile }, message: "Saved" });
      }),
  });
  await open(state);
  await submit(state);
  assert.equal(state.saves.length, 1);
  assert.deepEqual(state.saves[0], {
    name: "Initial Name",
    age: null,
    weight: null,
  });
  assert.equal(document.activeElement, dialog(state));
  await act(async () =>
    dialog(state).dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  assert.equal(document.activeElement, dialog(state));
  await act(async () => {
    button(state, "Cancel").click();
    button(state, "X").click();
    dialog(state).dispatchEvent(new Event("cancel", { cancelable: true }));
    dialog(state).getBoundingClientRect = () => ({
      left: 100,
      right: 500,
      top: 100,
      bottom: 500,
    });
    dialog(state).dispatchEvent(
      new MouseEvent("click", { bubbles: true, clientX: 10, clientY: 10 }),
    );
  });
  assert.ok(dialog(state));
  assert.equal(button(state, "Saving...").disabled, true);
  await act(async () => finish());
  assert.equal(dialog(state), null);
});
test("failed save stays open and preserves the draft for correction/retry", async () => {
  const state = await fixture({
    save: async () => {
      throw Error("Unable to save profile.");
    },
  });
  await open(state);
  await input(state, "name", "My Draft");
  await submit(state);
  assert.ok(dialog(state));
  assert.ok(state.container.textContent.includes("Unable to save profile."));
  assert.equal(
    state.container.querySelector('[name="name"]').value,
    "My Draft",
  );
  assert.equal(button(state, "Save Changes").disabled, false);
});
test("failed initial load permits retry without displaying a fabricated profile", async () => {
  const state = await fixture({
    load: async (_, current) => {
      if (current.loads === 1) throw Error("Load failed");
      return { profile: { ...current.saved } };
    },
  });
  await open(state);
  assert.ok(state.container.textContent.includes("Load failed"));
  assert.equal(button(state, "Save Changes").disabled, true);
  await act(async () => button(state, "Retry loading profile").click());
  assert.equal(state.loads, 2);
  assert.equal(
    state.container.querySelector('[name="name"]').value,
    "Initial Name",
  );
});
test("configuration-driven parent rerenders do not open the modal or overwrite an open draft", async () => {
  const state = await fixture();
  await act(async () =>
    state.root.render(React.createElement(ProfileControls, { ...state.props })),
  );
  assert.equal(dialog(state), null);
  await open(state);
  await input(state, "weight", "65.25");
  await act(async () =>
    state.root.render(React.createElement(ProfileControls, { ...state.props })),
  );
  assert.equal(state.loads, 1);
  assert.equal(state.container.querySelector('[name="weight"]').value, "65.25");
});
test("blank optional fields normalize to null; zero age is valid and invalid ranges are rejected", () => {
  assert.deepEqual(validateProfile({ name: " Person ", age: "", weight: "" }), {
    profile: { name: "Person", age: null, weight: null },
    errors: {},
  });
  assert.deepEqual(
    validateProfile({ name: "Person", age: "0", weight: "0.01" }).errors,
    {},
  );
  for (const age of ["-1", "131", "1.5", "bad"])
    assert.ok(validateProfile({ name: "Person", age, weight: "" }).errors.age);
  for (const weight of ["0", "-1", "501", "1.234", "bad"])
    assert.ok(
      validateProfile({ name: "Person", age: "", weight }).errors.weight,
    );
});

test("stale backend 404 explains restart and permits retry without opening a different page", async () => {
  const state = await fixture({
    load: async (_, current) => {
      if (current.loads === 1)
        throw Object.assign(Error("Endpoint not found."), { status: 404 });
      return { profile: { ...current.saved } };
    },
  });
  await open(state);
  assert.ok(state.container.textContent.includes("Restart the backend"));
  assert.equal(button(state, "Save Changes").disabled, true);
  await act(async () => button(state, "Retry loading profile").click());
  assert.equal(
    state.container.querySelector('[name="name"]').value,
    "Initial Name",
  );
});
test("stale backend save error preserves draft and explains how to retry", async () => {
  const state = await fixture({
    save: async () => {
      throw Object.assign(Error("Endpoint not found."), { status: 404 });
    },
  });
  await open(state);
  await input(state, "name", "Preserved Draft");
  await submit(state);
  assert.ok(dialog(state));
  assert.ok(state.container.textContent.includes("Restart the backend"));
  assert.equal(
    state.container.querySelector('[name="name"]').value,
    "Preserved Draft",
  );
});
