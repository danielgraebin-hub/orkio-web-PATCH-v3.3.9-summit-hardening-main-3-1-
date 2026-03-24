// src/lib/auth.js

const TOKEN_KEY = "orkio_token";
const USER_KEY = "orkio_user";
const TENANT_KEY = "orkio_tenant";

/**
 * ============================
 * TOKEN
 * ============================
 */

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (!token) return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * ============================
 * TENANT
 * ============================
 */

export function getTenant() {
  return localStorage.getItem(TENANT_KEY);
}

export function setTenant(tenant) {
  if (!tenant) return;
  localStorage.setItem(TENANT_KEY, tenant);
}

export function clearTenant() {
  localStorage.removeItem(TENANT_KEY);
}

/**
 * ============================
 * USER STORAGE
 * ============================
 */

export function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setUser(user) {
  if (!user) return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearUser() {
  localStorage.removeItem(USER_KEY);
}

/**
 * ============================
 * SESSION
 * ============================
 */

export function clearSession() {
  clearToken();
  clearUser();
  clearTenant();
}

export function storeSession({ token, user, tenant }) {
  if (token) setToken(token);

  if (tenant) {
    setTenant(tenant);
  } else if (user?.org_slug) {
    setTenant(user.org_slug);
  }

  if (user) {
    setUser(normalizeUser(user));
  }
}

/**
 * ============================
 * USER NORMALIZATION
 * ============================
 */

function normalizeUser(user) {
  if (!user) return null;

  const role =
    user.role ||
    (user.is_admin ? "admin" : null) ||
    (user.admin ? "admin" : null) ||
    "user";

  return {
    ...user,
    role,
    is_admin:
      user.is_admin === true ||
      user.admin === true ||
      role === "admin" ||
      role === "owner" ||
      role === "superadmin",
    admin:
      user.admin === true ||
      user.is_admin === true ||
      role === "admin" ||
      role === "owner" ||
      role === "superadmin",
  };
}

/**
 * ============================
 * LOGIN FLOW (OTP)
 * ============================
 */

export function completeOtpLogin(data) {
  if (!data?.access_token || !data?.user) {
    throw new Error("Invalid OTP login response");
  }

  const tenant =
    data.user?.org_slug ||
    data.tenant ||
    localStorage.getItem(TENANT_KEY) ||
    "public";

  storeSession({
    token: data.access_token,
    user: data.user,
    tenant,
  });
}

/**
 * ============================
 * AUTH STATE
 * ============================
 */

export function isAuthenticated() {
  return Boolean(getToken());
}

/**
 * ============================
 * APPROVAL
 * ============================
 */

export function isApproved(user) {
  if (!user) return false;

  return (
    user.approved_at ||
    user.usage_tier?.startsWith("summit") ||
    user.signup_source === "investor" ||
    user.signup_code_label === "efata777"
  );
}

/**
 * ============================
 * ADMIN ACCESS
 * ============================
 */

export function isAdmin(user) {
  if (!user) return false;

  return (
    user.role === "admin" ||
    user.role === "owner" ||
    user.role === "superadmin" ||
    user.is_admin === true ||
    user.admin === true
  );
}

/**
 * ============================
 * MERGE /api/me RESPONSE
 * ============================
 */

export function mergeUserFromApiMe(apiUser) {
  if (!apiUser) return;

  const existing = getUser();

  const merged = normalizeUser({
    ...existing,
    ...apiUser,
  });

  setUser(merged);
}

/**
 * ============================
 * LOGOUT
 * ============================
 */

export function logout() {
  clearSession();
  window.location.href = "/auth";
}
