"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type User = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  locality: string;
  createdAt?: string | Date;
};

type UsersGET =
  | { ok: true; users: User[]; localities?: string[] }
  | { error: string; localities?: string[] };

type UserDeleteResp =
  | { ok: true }
  | { error: string };

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [localities, setLocalities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Controls
  const [q, setQ] = useState("");
  const [locality, setLocality] = useState("all");
  const [sort, setSort] = useState<"desc" | "asc">("desc");

  // Debounce query
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
      if (locality) params.set("locality", locality);
      if (sort) params.set("sort", sort);

      const res = await fetch(`/api/users?${params.toString()}`, { cache: "no-store" });
      const data: UsersGET = await res.json();

      if (!res.ok || "error" in data) {
        throw new Error(("error" in data && data.error) || "Failed to fetch");
      }
      setUsers(data.users || []);
      if (Array.isArray(data.localities)) setLocalities(data.localities);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Error loading users";
      setErr(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, locality, sort]);

  const hasFilters = useMemo(
    () => !!(debouncedQ || (locality && locality !== "all") || sort !== "desc"),
    [debouncedQ, locality, sort]
  );

  async function onDelete(id: string) {
    const user = users.find(u => u._id === id);
    const label = user ? `${user.name} (${user.email})` : "this user";
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;

    try {
      setDeletingId(id);
      // Optimistic UI
      setUsers(prev => prev.filter(u => u._id !== id));

      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      const data: UserDeleteResp = await res.json().catch(() => ({ error: "Failed" }));
      if (!res.ok || "error" in data) {
        // restore if failed
        setUsers(prev =>
          [...prev, ...(user ? [user] : [])].sort(
            (a, b) =>
              new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
          )
        );
        alert(("error" in data && data.error) || "Failed to delete user");
      }
    } finally {
      setDeletingId(null);
    }
  }

  // --- Safe CSV export (Excel-friendly, no deps) ---
  function exportCSV() {
    const headers = ["Name", "Email", "Phone", "Locality", "Created"];
    const rows = users.map(u => [
      u.name ?? "",
      u.email ?? "",
      u.phone ?? "",
      u.locality ?? "",
      u.createdAt ? new Date(u.createdAt).toLocaleString() : ""
    ]);

    const csv = [headers, ...rows]
      .map(cols => cols.map(csvEscape).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
    a.href = url;
    a.download = `users-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function csvEscape(value: unknown): string {
    const s = String(value ?? "");
    if (/[",\r\n]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  return (
    <div>
      <div className="topbar" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/dashboard" className="btn" aria-label="Back to Dashboard">← Back</Link>
          <div>
            <div className="topbar-title">Users</div>
            <div className="topbar-sub">All user records</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={exportCSV} aria-label="Export to Excel">Export</button>
          <Link className="btn btn-primary" href="/admin/users/new">Add User</Link>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr", alignItems: "center" }}>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr" }}>
            <label style={{ fontSize: 12, color: "#5b5249" }}>Search by name or email</label>
            <input
              className="input"
              placeholder="Type a name or email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <label style={{ fontSize: 12, color: "#5b5249" }}>Filter by locality</label>
              <select className="input" value={locality} onChange={(e) => setLocality(e.target.value)}>
                <option value="all">All</option>
                {localities.sort((a, b) => a.localeCompare(b)).map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
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
              <button className="btn" onClick={() => { setQ(""); setLocality("all"); setSort("desc"); }}>
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
        ) : users.length === 0 ? (
          <p>No users found.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={th}>Name</th>
                  <th style={th}>Email</th>
                  <th style={th}>Phone</th>
                  <th style={th}>Locality</th>
                  <th style={th}>Created</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id} style={{ borderTop: "1px solid #e8dccf" }}>
                    <td style={td}>{u.name}</td>
                    <td style={td}>{u.email}</td>
                    <td style={td}>{u.phone}</td>
                    <td style={td}>{u.locality}</td>
                    <td style={td}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</td>
                    <td style={td}>
                      <button
                        className="btn"
                        onClick={() => onDelete(u._id)}
                        disabled={deletingId === u._id}
                        title="Delete user"
                      >
                        {deletingId === u._id ? "Deleting…" : "Delete"}
                      </button>
                    </td>
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
