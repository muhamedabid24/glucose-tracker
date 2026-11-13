import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  loadComponent,
  mount,
  click,
  input,
  submit,
  button,
  React,
  act,
} from "../test-support/domHarness.js";
const { Auth } = await import(await loadComponent("src/main.jsx"));
const roots = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await root.close();
  delete globalThis.gluconTestApi;
});
async function setup(register = false) {
  const state = { calls: [], logins: [], notices: [] };
  globalThis.gluconTestApi = async (path, options) => {
    state.calls.push({ path, ...options });
    return path === "/auth/login"
      ? { token: "fixture-token" }
      : { user: { id: 1, name: "Fixture User" } };
  };
  function AuthForms() {
    const [mode, setMode] = React.useState(register);
    return React.createElement(Auth, {
      register: mode,
      setRegister: setMode,
      onLogin: (token) => state.logins.push(token),
      notice: (notice) => state.notices.push(notice),
    });
  }
  const root = await mount(AuthForms);
  roots.push(root);
  return { ...root, state, AuthForms };
}
const password = (root) => root.container.querySelector('[name="password"]');
const toggle = (root) => root.container.querySelector(".password-toggle");
for (const register of [false, true]) {
  const page = register ? "registration" : "login";
  test(`${page}: hidden by default with correct labels, icon and existing password requirements`, async () => {
    const root = await setup(register);
    const field = password(root);
    assert.equal(field.type, "password");
    assert.equal(field.required, true);
    assert.equal(
      field.autocomplete,
      register ? "new-password" : "current-password",
    );
    assert.equal(field.getAttribute("minlength"), register ? "8" : null);
    assert.equal(toggle(root).type, "button");
    assert.equal(toggle(root).getAttribute("aria-label"), "Show password");
    assert.equal(toggle(root).getAttribute("aria-pressed"), "false");
    assert.equal(toggle(root).getAttribute("aria-controls"), field.id);
    assert.equal(toggle(root).querySelector("svg").dataset.icon, "eye");
    assert.equal(
      root.container.querySelector(`label[for="${field.id}"]`).textContent,
      "Password",
    );
    assert.equal(
      root.container.querySelectorAll('[name="password"]').length,
      1,
    );
  });
  test(`${page}: reveal/hide preserves the same input value and never submits`, async () => {
    const root = await setup(register);
    const field = password(root);
    const sample = "FixtureOnlyPassword123!";
    await input(field, sample);
    toggle(root).focus();
    assert.equal(document.activeElement, toggle(root));
    await click(toggle(root));
    assert.equal(field.type, "text");
    assert.equal(field.value, sample);
    assert.equal(password(root), field);
    assert.equal(toggle(root).getAttribute("aria-label"), "Hide password");
    assert.equal(toggle(root).getAttribute("aria-pressed"), "true");
    assert.equal(toggle(root).querySelector("svg").dataset.icon, "eye-off");
    assert.equal(root.state.calls.length, 0);
    await click(toggle(root));
    assert.equal(field.type, "password");
    assert.equal(field.value, sample);
    assert.equal(password(root), field);
    assert.equal(toggle(root).getAttribute("aria-label"), "Show password");
    assert.equal(toggle(root).getAttribute("aria-pressed"), "false");
    assert.equal(root.state.calls.length, 0);
  });
  test(`${page}: submitting a revealed password still uses the unchanged authentication request`, async () => {
    const root = await setup(register);
    if (register)
      await input(
        root.container.querySelector('[name="name"]'),
        "Fixture User",
      );
    await input(
      root.container.querySelector('[name="email"]'),
      "fixture@example.test",
    );
    const sample = "FixtureOnlyPassword123!";
    await input(password(root), sample);
    await click(toggle(root));
    assert.equal(root.state.calls.length, 0);
    await submit(root.container.querySelector("form"));
    assert.equal(root.state.calls.length, 1);
    assert.equal(
      root.state.calls[0].path,
      register ? "/auth/register" : "/auth/login",
    );
    assert.equal(root.state.calls[0].method, "POST");
    assert.equal(root.state.calls[0].body.password, sample);
    if (register) {
      assert.ok(root.state.notices[0].text.includes("Account created"));
      assert.equal(password(root).type, "password");
    } else assert.deepEqual(root.state.logins, ["fixture-token"]);
  });
}
test("switching between login and registration remounts each password field hidden", async () => {
  const root = await setup();
  await input(password(root), "FixtureOnlyPassword123!");
  await click(toggle(root));
  assert.equal(password(root).type, "text");
  await click(button(root.container, "Create an account"));
  assert.equal(password(root).type, "password");
  assert.equal(toggle(root).getAttribute("aria-pressed"), "false");
  await input(password(root), "FixtureOnlyPassword123!");
  await click(toggle(root));
  await click(button(root.container, "Log in"));
  assert.equal(password(root).type, "password");
  assert.equal(root.state.calls.length, 0);
});
test("unmounting and mounting a form resets visibility without persistent storage", async () => {
  const root = await setup();
  await click(toggle(root));
  assert.equal(password(root).type, "text");
  await act(async () => root.root.render(null));
  await act(async () => root.root.render(React.createElement(root.AuthForms)));
  assert.equal(password(root).type, "password");
  assert.equal(toggle(root).getAttribute("aria-label"), "Show password");
});
