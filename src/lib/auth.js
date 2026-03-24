// src/lib/auth.js

const TOKEN_KEY = "orkio_token";
const USER_KEY = "orkio_user";
const TENANT_KEY = "orkio_tenant";
const OTP_CTX_KEY = "orkio_pending_otp_context";

/**
 * =========================
 * TOKEN
 * =========================
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
 * =========================
 * TENANT
 * =========================
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
 * =========================
 * USER STORAGE
 * =========================
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
  localStorage.setItem(USER_KEY, JSON.stringify(normalizeUser(user)));
}

export function clearUser() {
  localStorage.removeItem(USER_KEY);
}

/**
 * =========================
 * NORMALIZE USER
 * =========================
 */

function normalizeUser(user) {
  if (!user) return null;

  const role =
    user.role ||
    (user.is_admin === true ? "admin" : null) ||
    (user.admin === true ? "admin" : null) ||
    "user";

  const adminAccess =
    role === "admin" ||
    role === "owner" ||
    role === "superadmin" ||
    user.is_admin === true ||
    user.admin === true;

  return {
    ...user,
    role,
    is_admin: adminAccess,
    admin: adminAccess,
  };
}

/**
 * =========================
 * OTP CONTEXT
 * =========================
 */

export function savePendingOtpContext(ctx) {
  if (!ctx) return;
  localStorage.setItem(OTP_CTX_KEY, JSON.stringify(ctx));
}

export function getPendingOtpContext() {
  try {
    const raw = localStorage.getItem(OTP_CTX_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearPendingOtpContext() {
  localStorage.removeItem(OTP_CTX_KEY);
}

/**
 * =========================
 * SESSION STORAGE
 * =========================
 */

export function setSession({ token, user, tenant }) {
  if (token) setToken(token);

  const existingUser = getUser();
  const mergedUser = user
    ? normalizeUser({
        ...(existingUser || {}),
        ...user,
        role:
          user?.role ||
          existingUser?.role ||
          (user?.is_admin === true ? "admin" : null) ||
          (user?.admin === true ? "admin" : null) ||
          "user",
        is_admin:
          user?.is_admin === true ||
          user?.admin === true ||
          existingUser?.is_admin === true ||
          existingUser?.admin === true ||
          String(user?.role || existingUser?.role || "").trim().toLowerCase() === "admin" ||
          String(user?.role || existingUser?.role || "").trim().toLowerCase() === "owner" ||
          String(user?.role || existingUser?.role || "").trim().toLowerCase() === "superadmin",
        admin:
          user?.admin === true ||
          user?.is_admin === true ||
          existingUser?.admin === true ||
          existingUser?.is_admin === true ||
          String(user?.role || existingUser?.role || "").trim().toLowerCase() === "admin" ||
          String(user?.role || existingUser?.role || "").trim().toLowerCase() === "owner" ||
          String(user?.role || existingUser?.role || "").trim().toLowerCase() === "superadmin",
      })
    : existingUser;

  const resolvedTenant =
    tenant ||
    user?.org_slug ||
    user?.tenant ||
    existingUser?.org_slug ||
    existingUser?.tenant ||
    getTenant() ||
    "public";

  if (resolvedTenant) {
    setTenant(resolvedTenant);
  }

  if (mergedUser) {
    setUser(mergedUser);
  }
}

export const storeSession = setSession;

/**
 * =========================
 * COMPLETE OTP LOGIN
 * =========================
 */

export function completeOtpLogin(data) {
  if (!data?.access_token || !data?.user) {
    throw new Error("Invalid OTP login response");
  }

  const pending = getPendingOtpContext();

  const tenant =
    data.user?.org_slug ||
    data.user?.tenant ||
    data.tenant ||
    pending?.tenant ||
    pending?.org_slug ||
    getTenant() ||
    "public";

  setSession({
    token: data.access_token,
    user: data.user,
    tenant,
  });

  clearPendingOtpContext();
}

/**
 * =========================
 * AUTH STATE
 * =========================
 */

export function isAuthenticated() {
  return Boolean(getToken());
}

/**
 * =========================
 * APPROVAL CHECK
 * =========================
 */

export function isApproved(user) {
  if (!user) return false;

  return Boolean(
    user.approved_at ||
      (typeof user.usage_tier === "string" &&
        user.usage_tier.startsWith("summit")) ||
      user.signup_source === "investor" ||
      user.signup_code_label === "efata777"
  );
}

/**
 * =========================
 * ADMIN ACCESS CHECK
 * =========================
 */

export function isAdmin(user) {
  if (!user) return false;

  return Boolean(
    user.role === "admin" ||
      user.role === "owner" ||
      user.role === "superadmin" ||
      user.is_admin === true ||
      user.admin === true
  );
}

/**
 * =========================
 * MERGE USER FROM /api/me
 * =========================
 */

export function mergeUserFromApiMe(apiUser) {
  if (!apiUser) return;

  const existing = getUser();

  const merged = normalizeUser({
    ...existing,
    ...apiUser,
  });

  setUser(merged);

  const tenant =
    merged?.org_slug ||
    merged?.tenant ||
    getTenant() ||
    "public";

  if (tenant) {
    setTenant(tenant);
  }
}

/**
 * =========================
 * CLEAR SESSION
 * =========================
 */

export function clearSession() {
  clearToken();
  clearUser();
  clearTenant();
  clearPendingOtpContext();
}

/**
 * =========================
 * LOGOUT
 * =========================
 */

export function logout() {
  clearSession();
  window.location.href = "/auth";
}
