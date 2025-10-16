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
  createdAt?: string | Date;
  origin?: "booking" | "cancellation";
};

// Legacy (older) shape: one document had arrays per court
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
  createdAt?: string | Date;
  origin?: "booking" | "cancellation";
};

type Booking = BookingNew | BookingLegacy;

type BookingsGET =
  | { ok: true; bookings: Booking[] }
  | { error: string };

type UpdatedMember = { _id: string; name: string; email?: string; credits: number };
type BookingPATCHCancel =
  | { ok: true; booking: unknown; updatedMember?: UpdatedMember | null }
  | { error: string };
type BookingPATCHSimple =
  | { ok: true; booking: unknown }
  | { error: string };

export default function BookingsPage() {
  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null); // for pay/cancel/refund

  // BroadcastChannel (to notify Members page of credit updates)
  const bcRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (typeof window !== "undefined") {
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
      const data: BookingsGET = await res.json();
      if (!res.ok || "error" in data) throw new Error(("error" in data && data.error) || "Failed to fetch");
      setItems(data.bookings || []);
    } catch (e: unknown) {
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
    if (isNewShape(b)) return prettyCourt((b as BookingNew).court);
    const parts: string[] = [];
    if ((b as BookingLegacy).court1?.length) parts.push("Court 1");
    if ((b as BookingLegacy).court2?.length) parts.push("Court 2");
    if ((b as BookingLegacy).court3?.length) parts.push("Court 3");
    return parts.length ? parts.join(", ") : "—";
  }
  function displaySlots(b: Booking) {
    if (isNewShape(b)) return formatSlot((b as BookingNew).slot);
    const bb = b as BookingLegacy;
    const s1 = (bb.court1 || []).map(formatSlot);
    const s2 = (bb.court2 || []).map(formatSlot);
    const s3 = (bb.court3 || []).map(formatSlot);
    const all = [...s1, ...s2, ...s3];
    return all.length ? all.join(", ") : "—";
  }
  function amountDueOf(b: Booking) {
    if ("amountDue" in b && typeof b.amountDue === "number") return b.amountDue;
    const bb = b as BookingLegacy;
    const slots = isNewShape(b)
      ? 1
      : (bb.court1?.length || 0) + (bb.court2?.length || 0) + (bb.court3?.length || 0);
    return b.isMember ? 0 : 500 * slots;
  }
  function isPaid(b: Booking) {
    const due = amountDueOf(b);
    const paid = "paid" in b ? Boolean(b.paid) : false;
    return paid || due === 0;
  }
  function isCancelled(b: Booking) {
    return "cancelled" in b ? Boolean(b.cancelled) : false;
  }
  function isRefunded(b: Booking) {
    return "refunded" in b ? Boolean(b.refunded) : false;
  }
  function getOrigin(b: Booking): "booking" | "cancellation" | undefined {
    return "origin" in b ? b.origin : undefined;
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
      const data: BookingPATCHSimple = await res.json().catch(() => ({ error: "Failed" }));
      if (!res.ok || "error" in data) {
        alert(("error" in data && data.error) || "Failed to mark as paid");
        return;
      }
      setItems((prev) =>
        prev.map((b) => (b._id === id ? ({ ...b, paid: true, amountDue: 0 } as Booking) : b))
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
      const data: BookingPATCHCancel = await res.json().catch(() => ({ error: "Failed" }));
      if (!res.ok || "error" in data) {
        alert(("error" in data && data.error) || "Failed to cancel booking");
        return;
      }

      // Optimistic UI: mark as cancelled and set origin to 'cancellation' (since it's moved)
      setItems((prev) =>
        prev.map((b) => (b._id === id ? ({ ...b, cancelled: true, origin: "cancellation" } as Booking) : b))
      );

      // Notify Members page to update credits immediately when API returns updated member
      if ("updatedMember" in data && data.updatedMember && bcRef.current) {
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
      const data: BookingPATCHSimple = await res.json().catch(() => ({ error: "Failed" }));
      if (!res.ok || "error" in data) {
        alert(("error" in data && data.error) || "Failed to refund booking");
        return;
      }
      setItems((prev) => prev.map((b) => (b._id === id ? ({ ...b, refunded: true } as Booking) : b)));
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
        <Link className="btn btn-primary" href="/admin/bookings/new">
          Add Booking
        </Link>
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
                  const origin = getOrigin(b);

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
                          <span className="pill" style={{ background: "#f1efea" }}>—</span>
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
                        {cancelled || origin === "cancellation" ? (
                          <span
                            className="pill"
                            style={{ background: "#ffe0cc", color: "#7a3e00" }}
                          >
                            Cancelled
                          </span>
                        ) : refunded ? (
                          <span className="pill" style={{ background: "#e3e3e3" }}>
                            Refunded
                          </span>
                        ) : (
                          <span
                            className="pill"
                            style={{ background: "#f0f7ff", color: "#0b63b6" }}
                          >
                            Active
                          </span>
                        )}
                      </td>
                      <td style={td}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {/* Cancel: available if not yet cancelled and not already moved */}
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

                          {/* Refund: show only for paid non-member, not refunded, not cancelled, still active */}
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
