"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type CourtKey = "court1" | "court2" | "court3";

type BookingNew = {
  _id: string;
  name: string;
  isMember: boolean;
  memberId?: string | null;
  date: string; // YYYY-MM-DD
  court: CourtKey;
  slot: string; // "HH:00"
  amountDue: number;
  paid: boolean;
  cancelled?: boolean;
  refunded?: boolean;
  createdAt?: string;
  origin?: "booking" | "cancellation";
};

type BookingLegacy = {
  _id: string;
  name: string;
  isMember: boolean;
  date: string;
  court1?: string[];
  court2?: string[];
  court3?: string[];
  amountDue?: number;
  paid?: boolean;
  cancelled?: boolean;
  refunded?: boolean;
  createdAt?: string;
  origin?: "booking" | "cancellation";
};

type Booking = BookingNew | BookingLegacy;

export default function BookingsPage() {
  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);

  // BroadcastChannel (to notify Members page of credit updates)
  const bcRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      bcRef.current = new BroadcastChannel("admin-events");
    }
    return () => {
      bcRef.current?.close();
      bcRef.current = null;
    };
  }, []);

  // Filters
  const [q, setQ] = useState("");
  const [date, setDate] = useState(""); // YYYY-MM-DD
  const [isMember, setIsMember] = useState<"all" | "yes" | "no">("all");
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
      if (date) params.set("date", date);
      if (isMember) params.set("isMember", isMember);
      if (sort) params.set("sort", sort);
      const res = await fetch(`/api/bookings?${params.toString()}`, { cache: "no-store" });
      const data = (await res.json()) as { ok?: boolean; bookings?: Booking[]; error?: string };
      if (!res.ok) throw new Error(data?.error || "Failed to fetch");
      setItems(data.bookings || []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error loading bookings";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, date, isMember, sort]);

  const hasFilters = useMemo(
    () => !!(debouncedQ || date || isMember !== "all" || sort !== "desc"),
    [debouncedQ, date, isMember, sort]
  );

  // --- Type guards & render helpers ---
  function isNewShape(b: Booking): b is BookingNew {
    return (b as BookingNew).slot !== undefined && (b as BookingNew).court !== undefined;
  }
  function prettyCourt(c: CourtKey) {
    return c.replace("court", "Court ");
  }
  function formatSlot(hhmm: string) {
    const [h, m] = hhmm.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  function displayCourt(b: Booking) {
    if (isNewShape(b)) return prettyCourt(b.court);
    const parts: string[] = [];
    if ((b.court1 || []).length) parts.push("Court 1");
    if ((b.court2 || []).length) parts.push("Court 2");
    if ((b.court3 || []).length) parts.push("Court 3");
    return parts.length ? parts.join(", ") : "—";
  }
  function displaySlots(b: Booking) {
    if (isNewShape(b)) return formatSlot(b.slot);
    const s1 = (b.court1 || []).map(formatSlot);
    const s2 = (b.court2 || []).map(formatSlot);
    const s3 = (b.court3 || []).map(formatSlot);
    const all = [...s1, ...s2, ...s3];
    return all.length ? all.join(", ") : "—";
  }
  function amountDueOf(b: Booking) {
    if (typeof (b as BookingNew).amountDue === "number") return (b as BookingNew).amountDue;
    const slots =
      isNewShape(b) ? 1 : (b.court1?.length || 0) + (b.court2?.length || 0) + (b.court3?.length || 0);
    return b.isMember ? 0 : 500 * slots;
  }
  function isPaid(b: Booking) {
    const due = amountDueOf(b);
    const paidVal = isNewShape(b) ? b.paid : Boolean(b.paid);
    return !!paidVal || due === 0;
  }
  function isCancelled(b: Booking) {
    return Boolean(b.cancelled) || b.origin === "cancellation";
  }
  function isRefunded(b: Booking) {
    return Boolean(b.refunded);
  }

  // --- CSV Export ---
  function csvEscape(value: unknown) {
    const s = String(value ?? "");
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function exportCSV() {
    const headers = [
      "Name",
      "Member",
      "Date",
      "Court",
      "Slot",
      "Amount",
      "Payment",
      "Status",
      "Created",
    ];

    const rows = items.map((b) => {
      const due = amountDueOf(b);
      const paid = isPaid(b);
      const cancelled = isCancelled(b);
      const refunded = isRefunded(b);

      const status = cancelled ? "Cancelled" : refunded ? "Refunded" : "Active";
      const payment = refunded ? "Refunded" : paid ? "Paid" : "Unpaid";

      return [
        b.name ?? "",
        b.isMember ? "Yes" : "No",
        b.date ?? "",
        displayCourt(b),
        displaySlots(b),
        `₹${due}`,
        payment,
        status,
        b.createdAt ? new Date(b.createdAt).toLocaleString("en-IN") : "",
      ];
    });

    const csv = [headers, ...rows]
      .map((cols) => cols.map(csvEscape).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
    a.href = url;
    a.download = `bookings-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // --- Actions ---
  async function onPay(id: string) {
    try {
      setWorkingId(id);
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pay: true }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) {
        alert(data?.error || "Failed to mark as paid");
        return;
      }
      setItems((prev) =>
        prev.map((b) =>
          b._id === id
            ? (isNewShape(b)
                ? { ...b, paid: true, amountDue: 0 }
                : { ...b, paid: true, amountDue: 0 }) // legacy might not have amountDue, harmless to set
            : b
        )
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function onCancel(id: string) {
    try {
      if (!confirm("Cancel this booking? (Member credits will be restored if applicable.)")) return;
      setWorkingId(id);
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancel: true }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        updatedMember?: { _id: string; name: string; credits: number; email?: string };
      };
      if (!res.ok) {
        alert(data?.error || "Failed to cancel booking");
        return;
      }

      // Optimistic UI: mark as cancelled / moved
      setItems((prev) =>
        prev.map((b) => (b._id === id ? { ...b, cancelled: true, origin: "cancellation" } : b))
      );

      // Notify Members page to update credits immediately
      if (data?.updatedMember && bcRef.current) {
        bcRef.current.postMessage({ type: "member-updated", payload: data.updatedMember });
      }
    } finally {
      setWorkingId(null);
    }
  }

  async function onRefund(id: string) {
    try {
      if (!confirm("Refund this paid booking?")) return;
      setWorkingId(id);
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refund: true }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) {
        alert(data?.error || "Failed to refund booking");
        return;
      }
      setItems((prev) => prev.map((b) => (b._id === id ? { ...b, refunded: true } : b)));
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div>
      <div className="topbar" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/dashboard" className="btn" aria-label="Back to Dashboard">
            ← Back
          </Link>
          <div>
            <div className="topbar-title">Court Bookings</div>
            <div className="topbar-sub">Manage bookings and payments</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={exportCSV} aria-label="Export to CSV">
            Export
          </button>
          <Link className="btn btn-primary" href="/admin/bookings/new">
            Add Booking
          </Link>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: "grid", gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, color: "#5b5249" }}>Search by name</label>
            <input
              className="input"
              placeholder="Type a name…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr" }}>
            <div>
              <label style={{ fontSize: 12, color: "#5b5249" }}>Filter by date</label>
              <input
                className="input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#5b5249" }}>Member?</label>
              <select
                className="input"
                value={isMember}
                onChange={(e) => setIsMember(e.target.value as "all" | "yes" | "no")}
              >
                <option value="all">All</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#5b5249" }}>Sort</label>
              <select
                className="input"
                value={sort}
                onChange={(e) => setSort(e.target.value as "desc" | "asc")}
              >
                <option value="desc">Created: Latest → Oldest</option>
                <option value="asc">Created: Oldest → Latest</option>
              </select>
            </div>
          </div>
          {hasFilters && (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn"
                onClick={() => {
                  setQ("");
                  setDate("");
                  setIsMember("all");
                  setSort("desc");
                }}
              >
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
        ) : items.length === 0 ? (
          <p>No bookings found.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={th}>Name</th>
                  <th style={th}>Member</th>
                  <th style={th}>Date</th>
                  <th style={th}>Court</th>
                  <th style={th}>Slot</th>
                  <th style={th}>Amount</th>
                  <th style={th}>Payment</th>
                  <th style={th}>Status</th>
                  <th style={th}>Actions</th>
                  <th style={th}>Created</th>
                </tr>
              </thead>
              <tbody>
                {items.map((b) => {
                  const id = b._id;
                  const due = amountDueOf(b);
                  const paid = isPaid(b);
                  const cancelled = isCancelled(b);
                  const refunded = isRefunded(b);
                  const member = b.isMember;
                  const origin = b.origin;

                  return (
                    <tr
                      key={id}
                      style={{ borderTop: "1px solid #e8dccf", opacity: cancelled ? 0.8 : 1 }}
                    >
                      <td style={td}>{b.name}</td>
                      <td style={td}>{member ? "Yes" : "No"}</td>
                      <td style={td}>{b.date}</td>
                      <td style={td}>{displayCourt(b)}</td>
                      <td style={td}>{displaySlots(b)}</td>
                      <td style={td}>₹{due}</td>
                      <td style={td}>
                        {refunded ? (
                          <span className="pill" style={{ background: "#e3e3e3" }}>
                            Refunded
                          </span>
                        ) : paid || due === 0 ? (
                          <span className="pill pill-accent">Already paid</span>
                        ) : cancelled || origin === "cancellation" ? (
                          <span className="pill" style={{ background: "#f1efea" }}>
                            —
                          </span>
                        ) : (
                          <button
                            className="btn btn-primary"
                            onClick={() => onPay(id)}
                            disabled={workingId === id}
                          >
                            {workingId === id ? "Processing…" : "Pay"}
                          </button>
                        )}
                      </td>
                      <td style={td}>
                        {cancelled ? (
                          <span className="pill" style={{ background: "#ffe0cc", color: "#7a3e00" }}>
                            Cancelled
                          </span>
                        ) : refunded ? (
                          <span className="pill" style={{ background: "#e3e3e3" }}>
                            Refunded
                          </span>
                        ) : (
                          <span className="pill" style={{ background: "#f0f7ff", color: "#0b63b6" }}>
                            Active
                          </span>
                        )}
                      </td>
                      <td style={td}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            className="btn"
                            onClick={() => onCancel(id)}
                            disabled={workingId === id || cancelled || origin === "cancellation"}
                            title={member ? "Cancelling will restore 1 credit" : "Cancel this booking"}
                          >
                            {cancelled || origin === "cancellation"
                              ? "Cancelled"
                              : workingId === id
                              ? "Working…"
                              : "Cancel"}
                          </button>

                          {!member && paid && !refunded && !cancelled && origin !== "cancellation" && (
                            <button className="btn" onClick={() => onRefund(id)} disabled={workingId === id}>
                              {workingId === id ? "Working…" : "Refund"}
                            </button>
                          )}
                          {!member && refunded && (
                            <button className="btn" disabled>
                              Refunded
                            </button>
                          )}
                        </div>
                      </td>
                      <td style={td}>
                        {b.createdAt ? new Date(b.createdAt).toLocaleDateString("en-IN") : "—"}
                      </td>
                    </tr>
                  );
                })}
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
