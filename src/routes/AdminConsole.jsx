import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../ui/api.js";
import { getTenant, getToken, getUser, isAdmin } from "../lib/auth.js";

function Badge({ children }) {
  return (
    <span
      className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80"
    >
      {children}
    </span>
  );
}

function fmt(value) {
  if (!value) return "—";
  try {
    const d =
      typeof value === "number"
        ? new Date(value * (value < 10_000_000_000 ? 1000 : 1))
        : new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
  } catch {
    return String(value);
  }
}

function asData(res, fallback) {
  const data = res && typeof res === "object" && "data" in res ? res.data : res;
  return data ?? fallback;
}

export default function AdminConsole() {
  const nav = useNavigate();
  const token = getToken();
  const user = getUser();
  const tenant = getTenant() || user?.org_slug || "public";

  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [me, setMe] = useState(null);
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [files, setFiles] = useState([]);
  const [agents, setAgents] = useState([]);
  const [audit, setAudit] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [costs, setCosts] = useState(null);
  const [costDays, setCostDays] = useState(7);

  useEffect(() => {
    if (!token) {
      nav("/auth", { replace: true });
      return;
    }
    if (!isAdmin(user)) {
      nav("/app", { replace: true });
    }
  }, [nav, token, user]);

  async function loadMe() {
    const res = await apiFetch("/api/me", { method: "GET", org: tenant, token });
    setMe(asData(res, null) || null);
  }

  async function load(which) {
    if (!token) return;
    setLoading(true);
    setErr("");

    try {
      if (which === "overview") {
        const res = await apiFetch("/api/admin/overview", { org: tenant, token });
        setOverview(asData(res, null) || null);
      } else if (which === "users") {
        const res = await apiFetch("/api/admin/users", { org: tenant, token });
        setUsers(Array.isArray(asData(res, [])) ? asData(res, []) : []);
      } else if (which === "files") {
        const res = await apiFetch("/api/admin/files", { org: tenant, token });
        setFiles(Array.isArray(asData(res, [])) ? asData(res, []) : []);
      } else if (which === "agents") {
        const res = await apiFetch("/api/admin/agents", { org: tenant, token });
        setAgents(Array.isArray(asData(res, [])) ? asData(res, []) : []);
      } else if (which === "audit") {
        const res = await apiFetch("/api/admin/audit", { org: tenant, token });
        setAudit(Array.isArray(asData(res, [])) ? asData(res, []) : []);
      } else if (which === "approvals") {
        const res = await apiFetch("/api/admin/users?status=pending", { org: tenant, token });
        setPendingUsers(Array.isArray(asData(res, [])) ? asData(res, []) : []);
      } else if (which === "costs") {
        const res = await apiFetch(`/api/admin/costs?days=${encodeURIComponent(costDays)}`, {
          org: tenant,
          token,
        });
        setCosts(asData(res, null) || null);
      }
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function refreshCurrent() {
    await loadMe();
    await load(tab);
  }

  async function approveUser(id) {
    try {
      setLoading(true);
      await apiFetch(`/api/admin/users/${id}/approve`, {
        method: "POST",
        org: tenant,
        token,
      });
      await Promise.allSettled([load("approvals"), load("users"), load("overview")]);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function rejectUser(id) {
    try {
      setLoading(true);
      await apiFetch(`/api/admin/users/${id}/reject`, {
        method: "POST",
        org: tenant,
        token,
      });
      await Promise.allSettled([load("approvals"), load("users"), load("overview")]);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMe();
    load("overview");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === "overview") load("overview");
    if (tab === "users") load("users");
    if (tab === "files") load("files");
    if (tab === "agents") load("agents");
    if (tab === "audit") load("audit");
    if (tab === "approvals") load("approvals");
    if (tab === "costs") load("costs");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, costDays]);

  const stats = useMemo(
    () => overview || { tenants: "-", users: "-", threads: "-", messages: "-", files: "-" },
    [overview]
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-7xl px-5 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight">Admin</h1>
            <Badge>org: {tenant}</Badge>
            <Badge>{loading ? "loading" : "ready"}</Badge>
            {me?.email ? <Badge>{me.email}</Badge> : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
              onClick={() => nav("/app")}
            >
              Back to Console
            </button>
            <button
              className="rounded-2xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
              onClick={refreshCurrent}
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {[
            ["overview", "Overview"],
            ["users", "Users"],
            ["files", "Files"],
            ["agents", "Agents"],
            ["audit", "Audit"],
            ["approvals", "Approvals"],
            ["costs", "Costs"],
          ].map(([k, label]) => (
            <button
              key={k}
              className={
                tab === k
                  ? "rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold"
                  : "rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
              }
              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
        </div>

        {err ? (
          <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100">
            ⚠️ {err}
          </div>
        ) : null}

        {tab === "overview" && (
          <>
            <p className="mt-6 text-sm text-white/70">
              Operational metrics for the current tenant. Authentication check uses /api/me.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-5">
              {Object.entries(stats).map(([k, v]) => (
                <div key={k} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="text-xs text-white/60">{k}</div>
                  <div className="mt-2 text-2xl font-extrabold">{String(v)}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "users" && (
          <>
            <div className="mt-8 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black tracking-tight">Users</h2>
                <p className="mt-1 text-sm text-white/70">Users returned by the admin endpoint.</p>
              </div>
              <Badge>{users.length} rows</Badge>
            </div>

            <div className="mt-4 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-white/10 bg-black/20">
                    <tr className="text-xs text-white/70">
                      <th className="px-4 py-3 font-semibold">when</th>
                      <th className="px-4 py-3 font-semibold">org</th>
                      <th className="px-4 py-3 font-semibold">name</th>
                      <th className="px-4 py-3 font-semibold">email</th>
                      <th className="px-4 py-3 font-semibold">role</th>
                      <th className="px-4 py-3 font-semibold">status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u, idx) => (
                      <tr key={u.id || idx} className="border-t border-white/5">
                        <td className="px-4 py-3 text-white/70">{fmt(u.created_at || u.approved_at)}</td>
                        <td className="px-4 py-3">{u.org_slug || u.tenant || "—"}</td>
                        <td className="px-4 py-3">{u.name || "—"}</td>
                        <td className="px-4 py-3">{u.email || "—"}</td>
                        <td className="px-4 py-3">{u.role || "user"}</td>
                        <td className="px-4 py-3">
                          {u.approved_at ? "approved" : u.status || "pending"}
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td className="px-4 py-6 text-white/50" colSpan={6}>
                          No rows returned.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === "files" && (
          <>
            <div className="mt-8 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black tracking-tight">Files</h2>
                <p className="mt-1 text-sm text-white/70">Files returned by the admin endpoint.</p>
              </div>
              <Badge>{files.length} rows</Badge>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {files.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/50">
                  No files returned.
                </div>
              ) : (
                files.map((f, idx) => (
                  <div key={f.id || idx} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <div className="text-lg font-bold">{f.name || f.filename || "Unnamed file"}</div>
                    <div className="mt-2 text-sm text-white/70">
                      {f.org_slug || tenant}
                    </div>
                    <div className="mt-3 text-xs text-white/50">
                      {fmt(f.created_at)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {tab === "agents" && (
          <>
            <div className="mt-8 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black tracking-tight">Agents</h2>
                <p className="mt-1 text-sm text-white/70">Configured agents in the admin API.</p>
              </div>
              <Badge>{agents.length} rows</Badge>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {agents.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/50">
                  No agents returned.
                </div>
              ) : (
                agents.map((a, idx) => (
                  <div key={a.id || idx} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-lg font-bold">{a.name || "Unnamed agent"}</div>
                      {a.is_default ? <Badge>default</Badge> : null}
                    </div>
                    <div className="mt-2 text-sm text-white/70">
                      {a.description || "No description"}
                    </div>
                    <div className="mt-3 text-xs text-white/50">
                      model: {a.model || "—"} • voice: {a.voice_id || "—"}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {tab === "audit" && (
          <>
            <div className="mt-8 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black tracking-tight">Audit</h2>
                <p className="mt-1 text-sm text-white/70">Latest audit events from the admin API.</p>
              </div>
              <Badge>{audit.length} rows</Badge>
            </div>

            <div className="mt-4 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-white/10 bg-black/20">
                    <tr className="text-xs text-white/70">
                      <th className="px-4 py-3 font-semibold">when</th>
                      <th className="px-4 py-3 font-semibold">action</th>
                      <th className="px-4 py-3 font-semibold">actor</th>
                      <th className="px-4 py-3 font-semibold">resource</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.map((row, idx) => (
                      <tr key={row.id || idx} className="border-t border-white/5">
                        <td className="px-4 py-3 text-white/70">{fmt(row.created_at)}</td>
                        <td className="px-4 py-3">{row.action || "—"}</td>
                        <td className="px-4 py-3">{row.actor_email || row.user_email || row.user_id || "—"}</td>
                        <td className="px-4 py-3">{row.resource || "—"}</td>
                      </tr>
                    ))}
                    {audit.length === 0 && (
                      <tr>
                        <td className="px-4 py-6 text-white/50" colSpan={4}>
                          No audit rows returned.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === "approvals" && (
          <>
            <p className="mt-6 text-sm text-white/70">
              Pending users can be approved or rejected here.
            </p>

            <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Pending ({pendingUsers.length})</div>
                <div className="text-xs text-white/50">Tenant atual: {tenant}</div>
              </div>

              {pendingUsers.length === 0 ? (
                <div className="mt-4 text-sm text-white/60">Nenhum usuário pendente.</div>
              ) : (
                <div className="mt-4 grid gap-3">
                  {pendingUsers.map((u) => (
                    <div
                      key={u.id}
                      className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <div className="text-sm font-semibold">
                          {u.name} <span className="text-white/60">({u.email})</span>
                        </div>
                        <div className="mt-1 text-xs text-white/60">
                          Tenant: {u.org_slug} • Criado: {fmt(u.created_at)}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-400/15"
                          onClick={() => approveUser(u.id)}
                        >
                          Aprovar
                        </button>
                        <button
                          className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-400/15"
                          onClick={() => rejectUser(u.id)}
                        >
                          Rejeitar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {tab === "costs" && (
          <>
            <p className="mt-6 text-sm text-white/70">
              Token/cost summary returned by the admin endpoint.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-sm text-white/70">Janela:</span>
              {[1, 7, 30].map((d) => (
                <button
                  key={d}
                  className={
                    costDays === d
                      ? "rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold"
                      : "rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
                  }
                  onClick={() => setCostDays(d)}
                >
                  {d}d
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-5">
              <pre className="overflow-x-auto whitespace-pre-wrap text-sm text-white/80">
                {JSON.stringify(costs || {}, null, 2)}
              </pre>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
