// src/routes/AuthPage.jsx
// FINAL VERSION — Summit register → OTP → console flow fixed

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import apiFetch from "../lib/apiFetch";
import {
  setSession,
  setTenant,
  savePendingOtpContext,
  getPendingOtpContext,
  completeOtpLogin,
} from "../lib/auth";

export default function AuthPage() {
  const nav = useNavigate();

  const [tenant] = useState("public");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [otpMode, setOtpMode] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");

  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  function normalizeEmail(v) {
    return (v || "").trim().toLowerCase();
  }

  function normalizeAccessCode(v) {
    return (v || "").trim().toUpperCase();
  }

  async function doRegister() {
    if (password !== passwordConfirm) {
      setStatus("Passwords do not match.");
      return;
    }

    if (!acceptTerms) {
      setStatus("You must accept the legal terms before continuing.");
      return;
    }

    const nameNormalized = (name || "").trim();

    if (!nameNormalized) {
      setStatus("Please enter your name.");
      return;
    }

    setBusy(true);
    setStatus("Creating your account...");

    try {
      const emailNormalized = normalizeEmail(email);
      const normalizedAccessCode = normalizeAccessCode(accessCode);

      const { data } = await apiFetch("/api/auth/register", {
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

      if (data?.access_token && data?.user) {
        setTenant(tenant);
        setSession({
          token: data.access_token,
          user: data.user,
          tenant,
        });

        nav(data.redirect_to || "/app");
        return;
      }

      setStatus("Account created. Verifying identity...");

      const { data: loginData } = await apiFetch("/api/auth/login", {
        method: "POST",
        org: tenant,
        body: {
          tenant,
          email: emailNormalized,
          password,
        },
      });

      if (loginData?.pending_otp) {
        setTenant(tenant);

        savePendingOtpContext({
          email: loginData.email || emailNormalized,
          tenant,
        });

        setOtpMode(true);
        setPendingEmail(loginData.email || emailNormalized);

        setStatus(
          loginData.message ||
            "Verification code sent to your email."
        );

        return;
      }

      if (loginData?.access_token && loginData?.user) {
        setTenant(tenant);

        setSession({
          token: loginData.access_token,
          user: loginData.user,
          tenant,
        });

        nav(loginData.redirect_to || "/app");
        return;
      }

      setStatus("Account created. Please login.");
    } catch (err) {
      setStatus(err.message || "Registration failed.");
    } finally {
      setBusy(false);
    }
  }

  async function doVerifyOtp() {
    const ctx = getPendingOtpContext();

    const resolvedTenant = ctx?.tenant || tenant;

    const emailNormalized = normalizeEmail(
      ctx?.email || pendingEmail || email
    );

    setBusy(true);
    setStatus("Verifying code...");

    try {
      const { data } = await apiFetch(
        "/api/auth/login/verify-otp",
        {
          method: "POST",
          org: resolvedTenant,
          body: {
            tenant: resolvedTenant,
            email: emailNormalized,
            code: (otpCode || "").trim(),
          },
        }
      );

      if (!data?.access_token || !data?.user) {
        setStatus(data?.message || "Invalid code.");
        return;
      }

      setTenant(resolvedTenant);

      completeOtpLogin({
        ...data,
        tenant: resolvedTenant,
      });

      nav(data.redirect_to || "/app");
    } catch (err) {
      setStatus(err.message || "OTP failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 24 }}>
      {!otpMode ? (
        <>
          <h2>Create account</h2>

          <input
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <input
            placeholder="Confirm password"
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
          />

          <input
            placeholder="Event access code"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
          />

          <label>
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
            />
            Accept Terms
          </label>

          <button disabled={busy} onClick={doRegister}>
            Create account
          </button>
        </>
      ) : (
        <>
          <h2>Verify code</h2>

          <input
            placeholder="OTP code"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
          />

          <button disabled={busy} onClick={doVerifyOtp}>
            Verify OTP
          </button>
        </>
      )}

      {status && (
        <div style={{ marginTop: 12 }}>{status}</div>
      )}
    </div>
  );
}
