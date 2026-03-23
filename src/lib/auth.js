export const LS_TOKEN = "orkio_token";
export const LS_USER = "orkio_user";
export const LS_TENANT = "orkio_tenant";
export const LS_PENDING_OTP = "orkio_pending_otp";
export const LS_SESSION_TS = "orkio_session_ts";

function safeJsonParse(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function getToken() {
  return localStorage.getItem(LS_TOKEN) || "";
}

export function getTenant() {
  return localStorage.getItem(LS_TENANT) || "public";
}

export function getUser() {
  return safeJsonParse(localStorage.getItem(LS_USER), null);
}

export function setSession({ token, access_token, user, tenant }) {
  const finalToken = access_token || token || "";
  if (finalToken) localStorage.setItem(LS_TOKEN, finalToken);
  if (tenant) localStorage.setItem(LS_TENANT, tenant);
  if (user) localStorage.setItem(LS_USER, JSON.stringify(user));
  localStorage.setItem(LS_SESSION_TS, String(Date.now()));
  clearPendingOtp();
}

export function setTenant(tenant) {
  localStorage.setItem(LS_TENANT, tenant || "public");
}

export function setUser(user) {
  if (!user) {
    localStorage.removeItem(LS_USER);
    return;
  }
  localStorage.setItem(LS_USER, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(LS_TOKEN);
  localStorage.removeItem(LS_USER);
  localStorage.removeItem(LS_TENANT);
  localStorage.removeItem(LS_SESSION_TS);
}

export function isAdmin(user) {
  return user?.role === "admin";
}

export function isApproved(user) {
  return !!(user && (user.role === "admin" || user.approved_at));
}

export function hasCompletedOnboarding(user) {
  return !!(user && user.onboarding_completed);
}

export function savePendingOtpContext({ email, tenant } = {}) {
  localStorage.setItem(
    LS_PENDING_OTP,
    JSON.stringify({
      email: (email || "").trim().toLowerCase(),
      tenant: tenant || getTenant() || "public",
      created_at: Date.now(),
    })
  );
}

export function getPendingOtpContext() {
  return safeJsonParse(localStorage.getItem(LS_PENDING_OTP), null);
}

export function clearPendingOtp() {
  localStorage.removeItem(LS_PENDING_OTP);
}

export function completeOtpLogin(payload = {}) {
  setSession({
    access_token: payload.access_token,
    token: payload.token,
    user: payload.user,
    tenant: payload.user?.org_slug || payload.tenant || getTenant() || "public",
  });
  return payload;
}

export async function logout({ apiBase = "", org, token } = {}) {
  const authToken = token || getToken();
  const tenant = org || getTenant() || "public";

  try {
    if (authToken) {
      const url = `${apiBase || ""}/api/auth/logout`;
      await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "X-Org-Slug": tenant,
        },
        credentials: "include",
      });
    }
  } catch (err) {
    console.warn("logout backend call failed", err);
  } finally {
    clearPendingOtp();
    clearSession();
  }

  return { ok: true };
}
