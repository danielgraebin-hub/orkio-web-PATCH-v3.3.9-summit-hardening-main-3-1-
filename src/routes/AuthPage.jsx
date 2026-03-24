import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../ui/api.js";
import {
  setSession,
  setTenant,
  savePendingOtpContext,
  getPendingOtpContext,
  completeOtpLogin,
  getToken,
  getUser,
  isApproved,
} from "../lib/auth.js";

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

const label = { display: "block", marginBottom: 8, fontSize: 13, fontWeight: 700, color: "#334155" };
const input = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 16,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  outline: "none",
  fontSize: 15,
  boxSizing: "border-box",
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
const muted = { color: "#64748b", fontSize: 14, lineHeight: 1.5 };

export default function AuthPage() {
  const nav = useNavigate();
  const [tenant] = useState("public");

  const [mode, setMode] = useState("register"); // register | login
  const [otpMode, setOtpMode] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [otpCode, setOtpCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");

  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const token = getToken();
    const user = getUser();
    if (token && user && isApproved(user)) {
      nav("/app", { replace: true });
    }
  }, [nav]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedMode = (params.get("mode") || "").toLowerCase();
    if (requestedMode === "login" || requestedMode === "signin") {
      setMode("login");
    }

    const ctx = getPendingOtpContext();
    if (ctx?.email) {
      setOtpMode(true);
      setPendingEmail(ctx.email);
      setEmail(ctx.email);
    }
  }, []);

  const title = useMemo(() => {
    if (otpMode) return "Verify your access code";
    return mode === "login" ? "Sign in to your account" : "Create your account";
  }, [otpMode, mode]);

  const subtitle = useMemo(() => {
    if (otpMode) {
      return "Use the one-time code sent to your email to enter the console.";
    }
    if (mode === "login") {
      return "Sign in with your email and password. If required, we will send a one-time code to complete access.";
    }
    return "Register, verify your email with OTP, and continue straight into the console.";
  }, [otpMode, mode]);

  function normalizeEmail(v) {
    return String(v || "").trim().toLowerCase();
  }

  function normalizeAccessCode(v) {
    return String(v || "").trim().toUpperCase();
  }

  function setAuthMode(nextMode) {
    setMode(nextMode);
    setOtpMode(false);
    setOtpCode("");
    setStatus("");
    const url = new URL(window.location.href);
    url.searchParams.set("mode", nextMode);
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }

  async function finalizeSession(data, resolvedTenant) {
    const nextTenant = resolvedTenant || tenant || "public";
    setTenant(nextTenant);

    if (!data?.access_token || !data?.user) {
      throw new Error("Invalid session payload.");
    }

    completeOtpLogin({ ...data, tenant: nextTenant });
    nav("/app", { replace: true });
  }

  async function doRegister() {
    if (busy) return;

    if (password !== passwordConfirm) {
      setStatus("Passwords do not match.");
      return;
    }
    if (!acceptTerms) {
      setStatus("You must accept the terms to continue.");
      return;
    }

    const nameNormalized = String(name || "").trim();
    const emailNormalized = normalizeEmail(email);
    const normalizedAccessCode = normalizeAccessCode(accessCode);

    if (!nameNormalized) {
      setStatus("Please enter your full name.");
      return;
    }

    if (!emailNormalized || !password || !normalizedAccessCode) {
      setStatus("Please complete name, email, password, and access code.");
      return;
    }

    setBusy(true);
    setStatus("Creating your account...");

    try {
      await apiFetch("/api/auth/register", {
        method: "POST",
        org: tenant,
        body: {
          tenant,
          email: emailNormalized,
          name: nameNormalized,
          password,
          access_code: normalizedAccessCode,
          accept_terms: acceptTerms,
          marketing_consent: false,
        },
      });

      setStatus("Account created. Sending OTP...");
      savePendingOtpContext({
        email: emailNormalized,
        tenant,
        name: nameNormalized,
        accessCode: normalizedAccessCode,
      });
      setPendingEmail(emailNormalized);
      setOtpMode(true);

      const { data: loginData } = await apiFetch("/api/auth/login", {
        method: "POST",
        org: tenant,
        body: { tenant, email: emailNormalized, password },
      });

      if (loginData?.pending_otp) {
        savePendingOtpContext({
          email: loginData.email || emailNormalized,
          tenant,
          name: nameNormalized,
          accessCode: normalizedAccessCode,
        });
        setPendingEmail(loginData.email || emailNormalized);
        setStatus(
          loginData.message ||
          "OTP sent. Verify it to enter the console."
        );
        return;
      }

      if (loginData?.access_token && loginData?.user) {
        await finalizeSession(loginData, tenant);
        return;
      }

      setStatus(loginData?.message || "Account created, but OTP was not issued correctly.");
    } catch (err) {
      setStatus(err?.message || "Registration failed.");
    } finally {
      setBusy(false);
    }
  }

  async function doLogin() {
    if (busy) return;

    const emailNormalized = normalizeEmail(email);

    if (!emailNormalized || !password) {
      setStatus("Please enter your email and password.");
      return;
    }

    setBusy(true);
    setStatus("Signing you in...");

    try {
      const { data } = await apiFetch("/api/auth/login", {
        method: "POST",
        org: tenant,
        body: {
          tenant,
          email: emailNormalized,
          password,
        },
      });

      if (data?.pending_otp) {
        savePendingOtpContext({
          email: data.email || emailNormalized,
          tenant,
        });
        setPendingEmail(data.email || emailNormalized);
        setOtpMode(true);
        setStatus(data?.message || "OTP sent. Check your email.");
        return;
      }

      if (data?.access_token && data?.user) {
        await finalizeSession(data, tenant);
        return;
      }

      setStatus(data?.message || "Unable to complete sign in.");
    } catch (err) {
      setStatus(err?.message || "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function doVerifyOtp() {
    if (busy) return;

    const ctx = getPendingOtpContext();
    const resolvedTenant = ctx?.tenant || tenant;
    const emailNormalized = normalizeEmail(ctx?.email || pendingEmail || email);
    const code = String(otpCode || "").trim();

    if (!emailNormalized || !code) {
      setStatus("Please enter the OTP sent by email.");
      return;
    }

    setBusy(true);
    setStatus("Verifying code...");

    try {
      const { data } = await apiFetch("/api/auth/login/verify-otp", {
        method: "POST",
        org: resolvedTenant,
        body: {
          tenant: resolvedTenant,
          email: emailNormalized,
          code,
        },
      });

      if (!data?.access_token || !data?.user) {
        setStatus(data?.message || "Invalid code or session not finalized.");
        return;
      }

      await finalizeSession(data, resolvedTenant);
    } catch (err) {
      setStatus(err?.message || "OTP validation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={shell}>
      <div style={card}>
        <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#64748b", fontWeight: 800 }}>
          Orkio
        </div>
        <h1 style={{ margin: "10px 0 8px", fontSize: 32, lineHeight: 1.05 }}>{title}</h1>
        <p style={{ ...muted, marginTop: 0 }}>{subtitle}</p>

        {!otpMode ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
              <button
                type="button"
                style={mode === "register" ? btn : secondaryBtn}
                onClick={() => setAuthMode("register")}
                disabled={busy}
              >
                Create account
              </button>
              <button
                type="button"
                style={mode === "login" ? btn : secondaryBtn}
                onClick={() => setAuthMode("login")}
                disabled={busy}
              >
                Sign in
              </button>
            </div>

            {mode === "register" ? (
              <div style={{ display: "grid", gap: 14 }}>
                <div>
                  <label style={label}>Full name</label>
                  <input style={input} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>

                <div>
                  <label style={label}>Email</label>
                  <input style={input} placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label style={label}>Password</label>
                    <input style={input} type="password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <div>
                    <label style={label}>Confirm password</label>
                    <input style={input} type="password" placeholder="Repeat your password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} />
                  </div>
                </div>

                <div>
                  <label style={label}>Access code</label>
                  <input
                    style={input}
                    placeholder="Enter your access code"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                  />
                </div>

                <label style={{ display: "flex", gap: 10, alignItems: "flex-start", color: "#334155", fontSize: 14 }}>
                  <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
                  <span>I agree to the terms and privacy policy.</span>
                </label>

                <button style={btn} disabled={busy} onClick={doRegister}>
                  {busy ? "Processing..." : "Create account and receive OTP"}
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                <div>
                  <label style={label}>Email</label>
                  <input style={input} placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>

                <div>
                  <label style={label}>Password</label>
                  <input style={input} type="password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>

                <button style={btn} disabled={busy} onClick={doLogin}>
                  {busy ? "Processing..." : "Sign in"}
                </button>
              </div>
            )}
          </>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <label style={label}>Email</label>
              <input style={{ ...input, opacity: 0.85 }} readOnly value={pendingEmail || email} />
            </div>
            <div>
              <label style={label}>OTP code</label>
              <input style={input} placeholder="Enter the code you received" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} />
            </div>
            <button style={btn} disabled={busy} onClick={doVerifyOtp}>
              {busy ? "Verifying..." : "Enter console"}
            </button>
            <button
              type="button"
              style={secondaryBtn}
              disabled={busy}
              onClick={() => {
                setOtpMode(false);
                setOtpCode("");
                setStatus("");
              }}
            >
              Back
            </button>
          </div>
        )}

        {!!status && (
          <div
            style={{
              marginTop: 16,
              borderRadius: 16,
              padding: "12px 14px",
              fontSize: 14,
              background: status.toLowerCase().includes("failed") || status.toLowerCase().includes("invalid")
                ? "rgba(239,68,68,0.10)"
                : "rgba(37,99,235,0.08)",
              color: status.toLowerCase().includes("failed") || status.toLowerCase().includes("invalid")
                ? "#991b1b"
                : "#1e3a8a",
              border: status.toLowerCase().includes("failed") || status.toLowerCase().includes("invalid")
                ? "1px solid rgba(239,68,68,0.25)"
                : "1px solid rgba(37,99,235,0.18)",
            }}
          >
            {status}
          </div>
        )}
      </div>
    </div>
  );
}
