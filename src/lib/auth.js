// src/lib/auth.js

const TOKEN_KEY = "orkio_token";
const USER_KEY = "orkio_user";
const TENANT_KEY = "orkio_tenant";
const PENDING_OTP_CONTEXT_KEY = "orkio_pending_otp_context";

/**
 * TOKEN
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
 * TENANT
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
 * USER
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
 * OTP PENDING CONTEXT
 */
export function savePendingOtpContext(context) {
  if (!context) return;
  localStorage.setItem(PENDING_OTP_CONTEXT_KEY, JSON.stringify(context));
}

export function getPendingOtpContext() {
  try {
    const raw = localStorage.getItem(PENDING_OTP_CONTEXT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearPendingOtpContext() {
  localStorage.removeItem(PENDING_OTP_CONTEXT_KEY);
}

/**
 * SESSION
 */
export function clearSession() {
  clearToken();
  clearUser();
  clearTenant();
  clearPendingOtpContext();
}

export function storeSession({ token, user, tenant }) {
  if (token) setToken(token);

  const resolvedTenant =
    tenant ||
    user?.org_slug ||
    user?.tenant ||
    getTenant() ||
    "public";

  if (resolvedTenant) {
    setTenant(resolvedTenant);
  }

  if (user) {
    setUser(user);
  }
}

/**
 * USER NORMALIZATION
 */
function normalizeUser(user) {
  if (!user) return null;

  const role =
    user.role ||
    (user.is_admin === true ? "admin" : null) ||
    (user.admin === true ? "admin" : null) ||
    "user";

  const hasAdminAccess =
    role === "admin" ||
    role === "owner" ||
    role === "superadmin" ||
    user.is_admin === true ||
    user.admin === true;

  return {
    ...user,
    role,
    is_admin: hasAdminAccess,
    admin: hasAdminAccess,
  };
}

/**
 * OTP LOGIN COMPLETE
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

  storeSession({
    token: data.access_token,
    user: data.user,
    tenant,
  });

  clearPendingOtpContext();
}

/**
 * AUTH STATE
 */
export function isAuthenticated() {
  return Boolean(getToken());
}

/**
 * APPROVAL
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
 * ADMIN ACCESS
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
 * MERGE USER FROM /api/me
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
    merged?.org_slug || merged?.tenant || getTenant() || "public";

  if (tenant) {
    setTenant(tenant);
  }
}

/**
 * LOGOUT
 */
export function logout() {
  clearSession();
  window.location.href = "/auth";
}
