// AuthPage.jsx (Admin shortcut version)

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../ui/api.js";
import {
  setTenant,
  savePendingOtpContext,
  getPendingOtpContext,
  completeOtpLogin,
  getToken,
  getUser,
  isApproved,
  isAdmin,
} from "../lib/auth.js";

/* ---------- styles ---------- */

const shell = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: 20,
  background: "radial-gradient(circle at top, #0f172a 0%, #020617 52%, #020617 100%)",
};

const card = {
  width: "100%",
  maxWidth: 560,
  borderRadius: 28,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.96)",
  color: "#0f172a",
  boxShadow: "0 30px 90px rgba(2,6,23,0.45)",
  padding: 24,
};

const btn = {
  width: "100%",
  border: 0,
  borderRadius: 18,
  padding: "15px 18px",
  fontWeight: 800,
  fontSize: 15,
  cursor: "pointer",
  background: "linear-gradient(135deg, #2563eb, #0f172a)",
  color: "#fff",
};

const secondaryBtn = {
  width: "100%",
  border: "1px solid #cbd5e1",
  borderRadius: 18,
  padding: "15px 18px",
  fontWeight: 700,
  fontSize: 15,
  cursor: "pointer",
  background: "#ffffff",
  color: "#0f172a",
};

/* ---------- component ---------- */

export default function AuthPage() {
  const nav = useNavigate();
  const [tenant] = useState("public");

  const [mode, setMode] = useState("register");
  const [otpMode, setOtpMode] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");

  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const token = getToken();
  const currentUser = getUser();

  const showAdminShortcut =
    !!token &&
    !!currentUser &&
    isApproved(currentUser) &&
    isAdmin(currentUser);

  /* ---------- auto redirect if already logged ---------- */

  useEffect(() => {
    if (token && currentUser && isApproved(currentUser)) {
      const redirect = sessionStorage.getItem("post_auth_redirect");
      const next = redirect || (isAdmin(currentUser) ? "/admin" : "/app");

      sessionStorage.removeItem("post_auth_redirect");
      nav(next, { replace: true });
    }
  }, [nav, token, currentUser]);

  /* ---------- admin shortcut ---------- */

  function goToAdminDirect() {
    nav("/admin");
  }

  /* ---------- finalize session ---------- */

  async function finalizeSession(data) {
    const nextTenant = tenant || "public";
    setTenant(nextTenant);

    completeOtpLogin({ ...data, tenant: nextTenant });

    const storedUser = getUser();

    const redirect = sessionStorage.getItem("post_auth_redirect");
    const next =
      redirect || (isAdmin(storedUser) ? "/admin" : "/app");

    sessionStorage.removeItem("post_auth_redirect");

    nav(next, { replace: true });
  }

  /* ---------- login ---------- */

  async function doLogin() {
    if (busy) return;

    setBusy(true);

    try {
      const { data } = await apiFetch("/api/auth/login", {
        method: "POST",
        org: tenant,
        body: { tenant, email, password },
      });

      if (data?.pending_otp) {
        savePendingOtpContext({
          email: data.email || email,
          tenant,
        });

        setPendingEmail(data.email || email);
        setOtpMode(true);
        return;
      }

      if (data?.access_token && data?.user) {
        await finalizeSession(data);
      }
    } finally {
      setBusy(false);
    }
  }

  /* ---------- verify otp ---------- */

  async function doVerifyOtp() {
    if (busy) return;

    const ctx = getPendingOtpContext();

    const { data } = await apiFetch(
      "/api/auth/login/verify-otp",
      {
        method: "POST",
        org: tenant,
        body: {
          tenant,
          email: ctx?.email || pendingEmail,
          code: otpCode,
        },
      }
    );

    if (data?.access_token && data?.user) {
      await finalizeSession(data);
    }
  }

  /* ---------- render ---------- */

  return (
    <div style={shell}>
      <div style={card}>
        <h1>Access Orkio</h1>

        {showAdminShortcut && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: 12,
            }}
          >
            <button
              onClick={goToAdminDirect}
              style={{
                border: "1px solid rgba(15,23,42,0.12)",
                background: "transparent",
                color: "#475569",
                fontSize: 12,
                padding: "6px 10px",
                borderRadius: 999,
                cursor: "pointer",
                opacity: 0.8,
              }}
            >
              admin
            </button>
          </div>
        )}

        {!otpMode ? (
          <>
            <input
              placeholder="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              type="password"
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button style={btn} onClick={doLogin}>
              Sign in
            </button>
          </>
        ) : (
          <>
            <input
              placeholder="OTP code"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
            />

            <button style={btn} onClick={doVerifyOtp}>
              Enter console
            </button>

            <button
              style={secondaryBtn}
              onClick={() => setOtpMode(false)}
            >
              Back
            </button>
          </>
        )}

        {status && <div>{status}</div>}
      </div>
    </div>
  );
}
