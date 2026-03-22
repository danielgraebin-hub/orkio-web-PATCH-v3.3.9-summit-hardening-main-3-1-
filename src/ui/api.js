import {
  clearSession,
  getTenant as readTenant,
  getToken as readToken,
} from "../lib/auth.js";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "/api";

function buildHeaders(extra = {}) {
  const token = readToken();
  const tenant = readTenant();

  const headers = {
    "Content-Type": "application/json",
    ...extra,
  };

  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (tenant) headers["X-Org-Slug"] = tenant;

  return headers;
}

export async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

  const config = {
    method: options.method || "GET",
    headers: buildHeaders(options.headers || {}),
    credentials: "include",
  };

  if (options.body && typeof options.body === "object") {
    config.body = JSON.stringify(options.body);
  } else if (options.body) {
    config.body = options.body;
  }

  const response = await fetch(url, config);

  if (response.status === 401) {
    clearSession();
    window.location.href = "/auth?session_expired=1";
    throw new Error("Session expired");
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`API error ${response.status}: ${text}`);
  }

  if (response.status === 204) {
    return { data: null };
  }

  const data = await response.json();
  return { data };
}

export const getMe = () => apiFetch("/api/me");

export const submitOnboarding = (payload) =>
  apiFetch("/api/user/onboarding", {
    method: "POST",
    body: payload,
  });

export const getAdminUsers = () =>
  apiFetch("/api/admin/users");

export const approveUser = (userId) =>
  apiFetch(`/api/admin/users/${userId}/approve`, {
    method: "POST",
  });

export const rejectUser = (userId) =>
  apiFetch(`/api/admin/users/${userId}/reject`, {
    method: "POST",
  });

export const deleteUser = (userId) =>
  apiFetch(`/api/admin/users/${userId}`, {
    method: "DELETE",
  });

export const startRealtime = () =>
  apiFetch("/api/realtime/start", {
    method: "POST",
  });

export const sendRealtimeBatch = (payload) =>
  apiFetch("/api/realtime/events:batch", {
    method: "POST",
    body: payload,
  });

export const downloadRealtimeAtaFile = (sessionId) =>
  `${API_BASE}/api/realtime/sessions/${sessionId}/ata.txt`;
