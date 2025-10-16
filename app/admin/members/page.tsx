"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Member = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  membership: "1M" | "3M" | "6M";
  credits: number;
  amountDue: number;
  paid: boolean;
  createdAt?: string | Date;
};

type MembersGET =
  | { ok: true; members: Member[]; memberships?: string[] }
  | { error: string; memberships?: string[] };

type MemberPATCHPay =
  | { ok: true; member?: Partial<Member> }
  | { error: string };

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);

  // Controls
  const [q, setQ] = useState("");
  const [membership, setMembership] = useState("all");
  const [sort, setSort] = useState<"desc" | "asc">("desc");

  const [debouncedQ, setDebouncedQ] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  async function load() {
    try {
      setLoading(true);
      setErr(null);
      const params = new URLSearchParams();
      if (debouncedQ) params.set("q", debouncedQ);
      if (membership) params.set("membership", membership);
      if (sort) params.set("sort", sort);

      const res = await fetch(`/api/members?${params.toString()}`, { cache: "no-store" });
      const data: MembersGET = await res.json();

      if (!res.ok || "error" in data) {
        throw new Error(("error" in data && data.error) || "Failed to fetch");
      }

      setMembers(data.members || []);
      if (Array.isArray(data.memberships)) setPlans(data.memberships);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Error loading members";
      setErr(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, membership, sort]);

  const hasFilters = useMemo(
    () => !!(debouncedQ || (membership && membership !== "all") || sort !== "desc"),
    [debouncedQ, membership, sort]
  );

  async function onPay(id: string) {
    try {
      setPayingId(id);
      const res = await fetch(`/api/members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pay: true }),
      });
      const data: MemberPATCHPay = await res.json().catch(() => ({ error: "Failed" }));

      if (!res.ok || "error" in data) {
        const msg = ("error" in data && data.error) || "Failed to mark as paid";
        alert(msg);
        return;
      }
      setMembers(prev => prev.map(m => (m._id === id ? { ...m, paid: true, amountDue: 0 } : m)));
    } finally {
      setPayingId(null);
    }
  }

  function exportCSV() {
    const headers = ["Name", "Email", "Phone", "Membership", "Credits Left", "Amount Due", "Paid", "Created"];
    const rows = members.map(m => [
      m.name ?? "",
      m.email ?? "",
      m.phone ?? "",
      m.membership ?? "",
      m.credits ?? 0,
      m.amountDue ?? 0,
      m.paid ? "Yes" : "No",
      m.createdAt ? new Date(m.createdAt).toLocaleString() : ""
    ]);
    const csv = [headers, ...rows].map(cols => cols.map(csvEscape).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
    a.href = url;
    a.download = `members-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function csvEscape(value: unknown): string {
    const s = String(value ?? "");
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  return (
    <div>
      <div className="topbar" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/dashboard" className="btn" aria-label="Back to Dashboard">← Back</Link>
          <div>
            <div className="topbar-title">Members</div>
            <div className="topbar-sub">All member records</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={exportCSV} aria-label="Export to Excel">Export</button>
          <Link className="btn btn-primary" href="/admin/members/new">Add Member</Link>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr", alignItems: "center" }}>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr" }}>
            <label style={{ fontSize: 12, color: "#5b5249" }}>Search by name, email or phone</label>
            <input
              className="input"
              placeholder="Type a name, email or phone…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <label style={{ fontSize: 12, color: "#5b5249" }}>Filter by membership</label>
              <select className="input" value={membership} onChange={(e) => setMembership(e.target.value)}>
                <option value="all">All</option>
                {plans.sort((a, b) => a.localeCompare(b)).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#5b5249" }}>Sort</label>
              <select className="input" value={sort} onChange={(e) => setSort(e.target.value as "desc" | "asc")}>
                <option value="desc">Created: Latest → Oldest</option>
                <option value="asc">Created: Oldest → Latest</option>
              </select>
            </div>
          </div>

          {hasFilters && (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={() => { setQ(""); setMembership("all"); setSort("desc"); }}>
                Clear
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        {loading ? (
          <p>Loading…</p>
        ) : err ? (
          <p style={{ color: "tomato" }}>{err}</p>
        ) : members.length === 0 ? (
          <p>No members found.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={th}>Name</th>
                  <th style={th}>Email</th>
                  <th style={th}>Phone</th>
                  <th style={th}>Membership</th>
                  <th style={th}>Credits Left</th>
                  <th style={th}>Amount Due</th>
                  <th style={th}>Payment</th>
                  <th style={th}>Created</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m._id} style={{ borderTop: "1px solid #e8dccf" }}>
                    <td style={td}>{m.name}</td>
                    <td style={td}>{m.email}</td>
                    <td style={td}>{m.phone}</td>
                    <td style={td}>{m.membership}</td>
                    <td style={td}>{m.credits}</td>
                    <td style={td}>₹{m.amountDue}</td>
                    <td style={td}>
                      {m.paid ? (
                        <span className="pill pill-accent">Amount paid</span>
                      ) : (
                        <button
                          className="btn btn-primary"
                          onClick={() => onPay(m._id)}
                          disabled={payingId === m._id}
                        >
                          {payingId === m._id ? "Processing…" : "Pay"}
                        </button>
                      )}
                    </td>
                    <td style={td}>{m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const th: React.CSSProperties = { padding: "10px 8px", fontWeight: 700, color: "#5b5249" };
const td: React.CSSProperties = { padding: "10px 8px" };
