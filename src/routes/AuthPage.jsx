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
const muted = { color: "#64748b", fontSize: 14, lineHeight: 1.5 };
const codeHint = {
  marginTop: 8,
  fontSize: 12,
  color: "#475569",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: "10px 12px",
};

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

  useEffect(() => {
    const token = getToken();
    const user = getUser();
    if (token && user && isApproved(user)) {
      nav("/app", { replace: true });
    }
  }, [nav]);

  useEffect(() => {
    const ctx = getPendingOtpContext();
    if (ctx?.email) {
      setOtpMode(true);
      setPendingEmail(ctx.email);
    }
  }, []);

  const title = useMemo(
    () => (otpMode ? "Valide seu código de acesso" : "Crie sua conta Summit"),
    [otpMode]
  );

  function normalizeEmail(v) {
    return String(v || "").trim().toLowerCase();
  }

  function normalizeAccessCode(v) {
    return String(v || "").trim().toUpperCase();
  }

  async function finalizeSession(data, resolvedTenant) {
    const nextTenant = setTenant(resolvedTenant || tenant);
    if (!data?.access_token || !data?.user) {
      throw new Error("Sessão inválida");
    }
    setSession({
      token: data.access_token,
      user: data.user,
      tenant: nextTenant,
    });
    completeOtpLogin({ ...data, tenant: nextTenant });
    nav(data.redirect_to || "/app", { replace: true });
  }

  async function doRegister() {
    if (busy) return;

    if (password !== passwordConfirm) {
      setStatus("As senhas não coincidem.");
      return;
    }
    if (!acceptTerms) {
      setStatus("Você precisa aceitar os termos para continuar.");
      return;
    }
    const nameNormalized = String(name || "").trim();
    if (!nameNormalized) {
      setStatus("Informe seu nome.");
      return;
    }

    const emailNormalized = normalizeEmail(email);
    const normalizedAccessCode = normalizeAccessCode(accessCode);

    if (!emailNormalized || !password || !normalizedAccessCode) {
      setStatus("Preencha nome, e-mail, senha e código de acesso.");
      return;
    }

    setBusy(true);
    setStatus("Criando sua conta...");

    try {
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
        await finalizeSession(data, tenant);
        return;
      }

      setStatus("Conta criada. Vamos validar seu acesso...");
      savePendingOtpContext({
        email: data?.email || emailNormalized,
        tenant,
        name: nameNormalized,
        accessCode: normalizedAccessCode,
      });
      setPendingEmail(data?.email || emailNormalized);
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
        setOtpMode(true);
        setStatus(loginData.message || "Enviamos um código para o seu e-mail.");
        return;
      }

      if (loginData?.access_token && loginData?.user) {
        await finalizeSession(loginData, tenant);
        return;
      }

      setStatus("Conta criada, mas o fluxo não consolidou a sessão.");
    } catch (err) {
      setStatus(err?.message || "Falha no registro.");
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
      setStatus("Informe o código OTP recebido por e-mail.");
      return;
    }

    setBusy(true);
    setStatus("Validando código...");

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
        setStatus(data?.message || "Código inválido ou sessão não consolidada.");
        return;
      }

      await finalizeSession(data, resolvedTenant);
    } catch (err) {
      setStatus(err?.message || "Falha na validação do código.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={shell}>
      <div style={card}>
        <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#64748b", fontWeight: 800 }}>
          Orkio Summit
        </div>
        <h1 style={{ margin: "10px 0 8px", fontSize: 32, lineHeight: 1.05 }}>{title}</h1>
        <p style={{ ...muted, marginTop: 0 }}>
          {otpMode
            ? "Use o código enviado ao seu e-mail para entrar direto no console."
            : "Cadastro → OTP → console. Sem loops, sem novo login, sem aprovação manual para Summit elegível."}
        </p>

        {!otpMode ? (
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <label style={label}>Nome completo</label>
              <input style={input} placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div>
              <label style={label}>E-mail</label>
              <input style={input} placeholder="voce@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={label}>Senha</label>
                <input style={input} type="password" placeholder="Sua senha" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div>
                <label style={label}>Confirmar senha</label>
                <input style={input} type="password" placeholder="Repita sua senha" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} />
              </div>
            </div>

            <div>
              <label style={label}>Código de acesso</label>
              <input
                style={input}
                placeholder="SOUTHSUMMIT26 ou EFATA777"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
              />
              <div style={codeHint}>
                <strong>South Summit:</strong> use <code>southsummit26</code> para acesso geral.<br />
                <strong>Investidores:</strong> use <code>efata777</code> para acesso expandido.
              </div>
            </div>

            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", color: "#334155", fontSize: 14 }}>
              <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
              <span>Aceito os termos e a política de privacidade.</span>
            </label>

            <button style={btn} disabled={busy} onClick={doRegister}>
              {busy ? "Processando..." : "Criar conta e receber OTP"}
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <label style={label}>E-mail</label>
              <input style={{ ...input, opacity: 0.85 }} readOnly value={pendingEmail || email} />
            </div>
            <div>
              <label style={label}>Código OTP</label>
              <input style={input} placeholder="Digite o código recebido" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} />
            </div>
            <button style={btn} disabled={busy} onClick={doVerifyOtp}>
              {busy ? "Validando..." : "Entrar no console"}
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
              background: status.toLowerCase().includes("falha") || status.toLowerCase().includes("inválido")
                ? "rgba(239,68,68,0.10)"
                : "rgba(37,99,235,0.08)",
              color: status.toLowerCase().includes("falha") || status.toLowerCase().includes("inválido")
                ? "#991b1b"
                : "#1e3a8a",
              border: status.toLowerCase().includes("falha") || status.toLowerCase().includes("inválido")
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
