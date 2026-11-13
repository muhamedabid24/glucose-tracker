const base = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace(/\/$/, "");
export async function api(path, { token, body, method = "GET", signal } = {}) {
  const response = await fetch(base + path, {
    method,
    signal,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response
    .json()
    .catch(() => ({ message: "Unexpected server response." }));
  if (!response.ok) {
    const error = new Error(data.message || "Unable to complete request.");
    error.status = response.status;
    error.errors = data.errors;
    throw error;
  }
  return data;
}
