"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type CourtKey = "court1" | "court2" | "court3";
type Member = { _id: string; name: string; email: string; credits: number };
type MemberAPI = { _id: string; name: string; email: string; credits: number };

const SLOT_START = 6;   // 6 AM
const SLOT_END = 23;    // 11 PM
const NON_MEMBER_PRICE_PER_SLOT = 500;

function generateSlots() {
  const slots: string[] = [];
  for (let h = SLOT_START; h <= SLOT_END; h++) slots.push(`${String(h).padStart(2, "0")}:00`);
  return slots;
}
const ALL_SLOTS = generateSlots();

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// --- time helpers for past-slot lock ---
function isPastDate(dateISO: string, now = new Date()) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const that  = new Date(y, m - 1, d).getTime();
  return that < today;
}
function isToday(dateISO: string, now = new Date()) {
  const [y, m, d] = dateISO.split("-").map(Number);
  return y === now.getFullYear() && m === now.getMonth() + 1 && d === now.getDate();
}
function slotIsPastOn(dateISO: string, slotHHMM: string, now = new Date()) {
  if (isPastDate(dateISO, now)) return true;
  if (!isToday(dateISO, now)) return false;
  const [hh, mm] = slotHHMM.split(":").map(Number);
  const slotTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0).getTime();
  return now.getTime() >= slotTime;
}

type BookingCreatePayload = {
  name: string;
  isMember: boolean;
  memberId: string | null;
  date: string;
  court1: string[];
  court2: string[];
  court3: string[];
};

export default function NewBookingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isMember, setIsMember] = useState(false);

  // Member lookup + selection
  const [memberSearch, setMemberSearch] = useState("");   // search by name
  const [memberId, setMemberId] = useState<string>("");
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const [date, setDate] = useState(todayISO());

  const [court1, setCourt1] = useState<string[]>([]);
  const [court2, setCourt2] = useState<string[]>([]);
  const [court3, setCourt3] = useState<string[]>([]);

  const [booked1, setBooked1] = useState<string[]>([]);
  const [booked2, setBooked2] = useState<string[]>([]);
  const [booked3, setBooked3] = useState<string[]>([]);
  const [loadingAvail, setLoadingAvail] = useState(false);

  // live "now" ticker so same-day past slots auto-lock
  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Remove any selected slots that have become past for the chosen date
  useEffect(() => {
    if (!isToday(date, now) && !isPastDate(date, now)) return;
    setCourt1(prev => prev.filter(s => !slotIsPastOn(date, s, now)));
    setCourt2(prev => prev.filter(s => !slotIsPastOn(date, s, now)));
    setCourt3(prev => prev.filter(s => !slotIsPastOn(date, s, now)));
  }, [now, date]);

  // Debounce member search
  const [debouncedMemberSearch, setDebouncedMemberSearch] = useState(memberSearch);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedMemberSearch(memberSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [memberSearch]);

  // Load members (when Member? = Yes + on search)
  useEffect(() => {
    if (!isMember) return;
    (async () => {
      setMembersLoading(true);
      try {
        const q = debouncedMemberSearch || ""; // empty lists all
        const res = await fetch(`/api/members?q=${encodeURIComponent(q)}&sort=desc`, { cache: "no-store" });
        const data = await res.json();

        const raw: MemberAPI[] = Array.isArray(data?.members) ? (data.members as MemberAPI[]) : [];
        const arr: Member[] = raw.map((m: MemberAPI) => ({
          _id: m._id,
          name: m.name,
          email: m.email,
          credits: m.credits,
        }));

        setMembers(arr);
        // if current selection no longer in filtered list, clear it
        if (memberId && !arr.some((m) => m._id === memberId)) {
          setMemberId("");
        }
      } catch {
        setMembers([]);
      } finally {
        setMembersLoading(false);
      }
    })();
  }, [isMember, debouncedMemberSearch, memberId]);

  const selectedMember = useMemo(
    () => members.find((m) => m._id === memberId) || null,
    [memberId, members]
  );

  // Sync booking name to selected member
  useEffect(() => { if (isMember && selectedMember) setName(selectedMember.name); }, [isMember, selectedMember]);

  // Load availability
  async function loadAvailability(d: string) {
    setLoadingAvail(true);
    try {
      const res = await fetch(`/api/bookings/availability?date=${encodeURIComponent(d)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load availability");
      setBooked1(data.booked?.court1 || []);
      setBooked2(data.booked?.court2 || []);
      setBooked3(data.booked?.court3 || []);
    } catch {
      setBooked1([]); setBooked2([]); setBooked3([]);
    } finally {
      setLoadingAvail(false);
    }
  }

  // Initial and on date change: clear selections & reload availability
  useEffect(() => { setCourt1([]); setCourt2([]); setCourt3([]); loadAvailability(date); }, [date]);

  const totalSlots = (court1.length + court2.length + court3.length);
  const totalAmount = isMember ? 0 : totalSlots * NON_MEMBER_PRICE_PER_SLOT;

  const hasEnoughCredits = !isMember || (selectedMember ? selectedMember.credits >= totalSlots : false);
  const canSubmit = !!(name && date && totalSlots > 0 && hasEnoughCredits);

  function toggleSlot(court: CourtKey, slot: string, disabled: boolean) {
    if (disabled) return;
    const map = {
      court1: [court1, setCourt1] as const,
      court2: [court2, setCourt2] as const,
      court3: [court3, setCourt3] as const,
    };
    const [arr, setArr] = map[court];
    if (arr.includes(slot)) setArr(arr.filter((s) => s !== slot));
    else setArr([...arr, slot].sort());
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const payload: BookingCreatePayload = {
      name,
      isMember,
      memberId: isMember ? memberId : null,
      date,
      court1, court2, court3,
    };

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data: unknown = await res.json().catch(() => ({}));
    if (!res.ok) {
      // data is unknown; we only attempt to read a safe, optional error message
      const maybeErr = (data as { error?: string } | undefined)?.error;
      alert(maybeErr || "Failed to create booking");
      if (res.status === 409) loadAvailability(date);
      return;
    }
    router.replace("/admin/bookings");
  }

  return (
    <div>
      <div className="topbar" style={{ marginBottom: 16 }}>
        <div>
          <div className="topbar-title">Add Court Booking</div>
          <div className="topbar-sub">Select date, court and slots</div>
        </div>
      </div>

      <div className="card" style={{ display: "grid", gap: 16 }}>
        <form onSubmit={onSubmit} className="grid" style={{ gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label>Member?</label>
              <select
                className="input"
                value={String(isMember)}
                onChange={(e) => {
                  const v = e.target.value === "true";
                  setIsMember(v);
                  if (!v) {
                    setMemberId("");
                    setMemberSearch("");
                  }
                }}
              >
                <option value="false">Not a member</option>
                <option value="true">Member</option>
              </select>
            </div>
            <div>
              <label>Date</label>
              <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
          </div>

          {/* Member search + select */}
          {isMember && (
            <div className="card" style={{ display: "grid", gap: 10 }}>
              <div>
                <label>Search Member (by name)</label>
                <input
                  className="input"
                  placeholder="Type to search…"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                />
                {membersLoading && <div style={{ fontSize: 12, color: "#5b5249", marginTop: 6 }}>Searching…</div>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
                <div>
                  <label>Select Member (from results)</label>
                  <select
                    className="input"
                    value={memberId}
                    onChange={(e) => setMemberId(e.target.value)}
                    required
                  >
                    <option value="">-- choose member --</option>
                    {members.map((m: Member) => (
                      <option key={m._id} value={m._id}>
                        {m.name} — {m.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Credits</label>
                  <input className="input" value={selectedMember ? selectedMember.credits : ""} readOnly />
                </div>
              </div>
            </div>
          )}

          <div>
            <label>Name</label>
            <input
              className="input"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              disabled={isMember && !!memberId}
            />
          </div>

          <CourtSelector
            title="Court 1"
            date={date}
            now={now}
            selected={court1}
            booked={new Set(booked1)}
            onToggle={(slot, disabled) => toggleSlot("court1", slot, disabled)}
          />
          <CourtSelector
            title="Court 2"
            date={date}
            now={now}
            selected={court2}
            booked={new Set(booked2)}
            onToggle={(slot, disabled) => toggleSlot("court2", slot, disabled)}
          />
          <CourtSelector
            title="Court 3"
            date={date}
            now={now}
            selected={court3}
            booked={new Set(booked3)}
            onToggle={(slot, disabled) => toggleSlot("court3", slot, disabled)}
          />

          <div className="card" style={{ background: "#fffdfa", borderStyle: "dashed" }}>
            <div><strong>Price:</strong> {isMember ? "₹0 (Member)" : `₹${NON_MEMBER_PRICE_PER_SLOT} x ${totalSlots} = ₹${totalAmount}`}</div>
            {isMember && (
              <div style={{ marginTop: 6 }}>
                <strong>Credits:</strong>{" "}
                {selectedMember ? (
                  <>
                    {selectedMember.credits} available • {totalSlots} needed •{" "}
                    {Math.max(selectedMember.credits - totalSlots, 0)} left after booking
                  </>
                ) : "—"}
              </div>
            )}
          </div>

          {!hasEnoughCredits && (
            <p style={{ color: "tomato", marginTop: -4 }}>
              Not enough credits. Reduce slots or choose a different member.
            </p>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" disabled={!canSubmit || loadingAvail}>
              {loadingAvail ? "Checking availability…" : "Submit"}
            </button>
            <button className="btn" type="button" onClick={() => router.back()}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CourtSelector({
  title, date, now, selected, booked, onToggle,
}: {
  title: string;
  date: string;
  now: Date;
  selected: string[];
  booked: Set<string>;
  onToggle: (slot: string, disabled: boolean) => void;
}) {
  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>{title}</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8 }}>
        {ALL_SLOTS.map((t) => {
          const past = slotIsPastOn(date, t, now);
          const isBooked = booked.has(t);
          const isChecked = selected.includes(t);
          const disabled = past || isBooked;

          let bg: string | undefined;
          let border = "1px solid #e8dccf";
          if (isBooked) { bg = "#d7f5df"; border = "1px solid #9bd6a7"; }
          else if (past) { bg = "#f1efea"; border = "1px dashed #d3c8bb"; }

          return (
            <label
              key={t}
              className="card"
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: 10,
                background: bg, border, opacity: disabled ? 0.7 : 1, cursor: disabled ? "not-allowed" : "pointer",
              }}
              title={isBooked ? "Already booked" : past ? "Time passed" : undefined}
            >
              <input type="checkbox" checked={isChecked} disabled={disabled} onChange={() => onToggle(t, disabled)} />
              {formatSlot(t)}
            </label>
          );
        })}
      </div>
    </div>
  );
}

function formatSlot(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(); d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
