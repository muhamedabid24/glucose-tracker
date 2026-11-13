import React, { useEffect, useRef, useState } from "react";
import { validateProfile } from "../profileValidation.js";

function profileErrorMessage(error, connectionMessage) {
  if (error.status === 404)
    return "Profile is unavailable on the running server. Restart the backend and try again.";
  return error.message === "Failed to fetch"
    ? connectionMessage
    : error.message;
}

// The dialog is not mounted until this button is explicitly clicked.
export function ProfileControls({
  loadProfile,
  saveProfile,
  onSaved,
  onLogout,
  onUnauthorized,
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  return (
    <div className="header-actions">
      <button
        type="button"
        className="quiet"
        ref={buttonRef}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        My Profile
      </button>
      <button type="button" className="quiet" onClick={onLogout}>
        Log out
      </button>
      {open && (
        <ProfileModal
          loadProfile={loadProfile}
          saveProfile={saveProfile}
          returnFocusRef={buttonRef}
          onClose={() => setOpen(false)}
          onUnauthorized={onUnauthorized}
          onSaved={(result) => {
            setOpen(false);
            onSaved(result);
          }}
        />
      )}
    </div>
  );
}

export function ProfileModal({
  loadProfile,
  saveProfile,
  onSaved,
  onClose,
  onUnauthorized,
  returnFocusRef,
}) {
  const dialogRef = useRef(null),
    nameRef = useRef(null),
    savingRef = useRef(false),
    mountedRef = useRef(false);
  const [values, setValues] = useState({ name: "", age: "", weight: "" });
  const [loading, setLoading] = useState(true),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(""),
    [errors, setErrors] = useState({}),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    mountedRef.current = true;
    const dialog = dialogRef.current;
    const oldOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    dialog.querySelector("button")?.focus();
    return () => {
      mountedRef.current = false;
      document.body.style.overflow = oldOverflow;
      if (dialog.open) dialog.close();
      returnFocusRef.current?.focus();
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoaded(false);
    setMessage("");
    setErrors({});
    loadProfile(controller.signal)
      .then(({ profile }) => {
        if (controller.signal.aborted) return;
        setValues({
          name: profile.name,
          age: profile.age ?? "",
          weight: profile.weight ?? "",
        });
        setLoaded(true);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error.status === 401) onUnauthorized(error.message);
        else
          setMessage(
            profileErrorMessage(
              error,
              "Cannot load your profile. Check your connection and retry.",
            ),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [loadProfile, attempt]);
  useEffect(() => {
    if (loaded && !loading) nameRef.current?.focus();
  }, [loaded, loading]);
  useEffect(() => {
    if (busy) dialogRef.current?.focus();
  }, [busy]);
  function close() {
    if (!savingRef.current) onClose();
  }
  function keyDown(event) {
    if (event.key !== "Tab") return;
    const controls = [
      ...dialogRef.current.querySelectorAll(
        "button:not([disabled]), input:not([disabled])",
      ),
    ].filter((element) => !element.matches(":disabled"));
    if (!controls.length) {
      event.preventDefault();
      dialogRef.current.focus();
      return;
    }
    const first = controls[0],
      last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  async function submit(event) {
    event.preventDefault();
    if (loading || !loaded || savingRef.current) return;
    const checked = validateProfile(values);
    setErrors(checked.errors);
    setMessage("");
    if (Object.keys(checked.errors).length) {
      const field = Object.keys(checked.errors)[0];
      dialogRef.current.querySelector(`[name="${field}"]`)?.focus();
      return;
    }
    savingRef.current = true;
    setBusy(true);
    try {
      const result = await saveProfile(checked.profile);
      if (mountedRef.current) onSaved(result);
    } catch (error) {
      if (!mountedRef.current) return;
      if (error.status === 401) onUnauthorized(error.message);
      else {
        setMessage(
          profileErrorMessage(
            error,
            "Cannot save your profile. Please try again.",
          ),
        );
        setErrors(error.errors || {});
      }
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  }
  function change(event) {
    const { name, value } = event.target;
    setValues((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: undefined }));
  }
  return (
    <dialog
      ref={dialogRef}
      className="panel modal profile-modal"
      role="dialog"
      tabIndex={-1}
      aria-modal="true"
      aria-labelledby="profile-title"
      aria-describedby="profile-description"
      onKeyDown={keyDown}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        if (
          event.target === event.currentTarget &&
          (event.clientX < box.left ||
            event.clientX > box.right ||
            event.clientY < box.top ||
            event.clientY > box.bottom)
        )
          close();
      }}
    >
      <div className="section-title">
        <h2 id="profile-title">My Profile</h2>
        <button
          type="button"
          className="profile-close"
          aria-label="Close profile"
          disabled={busy}
          onClick={close}
        >
          X
        </button>
      </div>
      <p id="profile-description">
        Update your details. Age and weight are optional.
      </p>
      {loading && <p role="status">Loading your profile...</p>}
      {message && (
        <p role="alert" className="field-error">
          {message}
        </p>
      )}
      {!loading && !loaded && (
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          Retry loading profile
        </button>
      )}
      <form onSubmit={submit} aria-busy={busy} noValidate>
        <fieldset disabled={loading || busy || !loaded}>
          <label htmlFor="profile-name">Name</label>
          <input
            id="profile-name"
            name="name"
            ref={nameRef}
            value={values.name}
            onChange={change}
            autoComplete="name"
            maxLength="100"
            required
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "profile-name-error" : undefined}
          />
          {errors.name && (
            <span
              className="profile-field-error"
              id="profile-name-error"
              role="alert"
            >
              {errors.name}
            </span>
          )}
          <label htmlFor="profile-age">
            Age (years) <span className="muted">Optional</span>
          </label>
          <input
            id="profile-age"
            name="age"
            type="number"
            min="0"
            max="130"
            step="1"
            inputMode="numeric"
            value={values.age}
            onChange={change}
            aria-invalid={Boolean(errors.age)}
            aria-describedby={errors.age ? "profile-age-error" : undefined}
          />
          {errors.age && (
            <span
              className="profile-field-error"
              id="profile-age-error"
              role="alert"
            >
              {errors.age}
            </span>
          )}
          <label htmlFor="profile-weight">
            Weight (kg) <span className="muted">Optional</span>
          </label>
          <input
            id="profile-weight"
            name="weight"
            type="number"
            min="0.01"
            max="500"
            step="0.01"
            inputMode="decimal"
            value={values.weight}
            onChange={change}
            aria-invalid={Boolean(errors.weight)}
            aria-describedby={
              errors.weight ? "profile-weight-error" : undefined
            }
          />
          {errors.weight && (
            <span
              className="profile-field-error"
              id="profile-weight-error"
              role="alert"
            >
              {errors.weight}
            </span>
          )}
        </fieldset>
        <div className="button-row">
          <button type="button" disabled={busy} onClick={close}>
            Cancel
          </button>
          <button
            type="submit"
            className="primary"
            disabled={loading || busy || !loaded}
          >
            {busy ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
