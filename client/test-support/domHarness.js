import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { transformWithEsbuild } from "vite";
const require = createRequire(import.meta.url);
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
});
for (const name of [
  "window",
  "document",
  "FormData",
  "sessionStorage",
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
// jsdom has no layout engine or scrolling implementation.
HTMLElement.prototype.scrollIntoView = function () {};

// Native dialog top-layer behavior is not implemented by jsdom.
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close = function () {
  this.removeAttribute("open");
};
const { createRoot } = await import("react-dom/client");
const cache = new Map();
export async function loadComponent(filename) {
  const file = path.resolve(filename);
  if (cache.has(file)) return cache.get(file);
  let source = fs
    .readFileSync(file, "utf8")
    .replace(/import ["'][^"']+\.css["'];?/g, "");
  if (file.endsWith(path.join("src", "main.jsx"))) {
    source =
      source.slice(0, source.lastIndexOf("createRoot(")) +
      "\nexport {App, Auth, Dashboard, ReadingForm};";
  }
  const replacements = new Map();
  for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) {
    const spec = match[1];
    if (replacements.has(spec)) continue;
    if (spec === "react" || spec === "react-dom/client")
      replacements.set(spec, pathToFileURL(require.resolve(spec)).href);
    else if (spec === "./api")
      replacements.set(
        spec,
        "data:text/javascript;base64," +
          Buffer.from(
            "export function api(...args){return globalThis.gluconTestApi(...args);}",
          ).toString("base64"),
      );
    else if (spec.startsWith(".")) {
      const base = path.resolve(path.dirname(file), spec);
      const target = [base, base + ".jsx", base + ".js"].find(
        (candidate) =>
          fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
      );
      if (!target) throw Error("Missing test import " + spec);
      replacements.set(
        spec,
        target.endsWith(".jsx")
          ? await loadComponent(target)
          : pathToFileURL(target).href,
      );
    }
  }
  source = source.replace(/from\s+["']([^"']+)["']/g, (all, spec) =>
    replacements.has(spec) ? `from "${replacements.get(spec)}"` : all,
  );
  const compiled = await transformWithEsbuild(source, file, {
    jsx: "transform",
    loader: "jsx",
  });
  const url =
    "data:text/javascript;base64," +
    Buffer.from(compiled.code).toString("base64");
  cache.set(file, url);
  return url;
}
export async function mount(Component, props = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(React.createElement(Component, props)));
  return {
    container,
    root,
    async close() {
      await act(async () => root.unmount());
      container.remove();
      sessionStorage.clear();
      document.body.style.overflow = "";
    },
  };
}
export async function click(element) {
  if (!element) throw Error("Missing button");
  await act(async () => element.click());
}
export async function input(element, value) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
export async function submit(form) {
  await act(async () =>
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    ),
  );
}
export function button(container, text) {
  return [...container.querySelectorAll("button")].find(
    (element) => element.textContent === text,
  );
}
export { React, act };
