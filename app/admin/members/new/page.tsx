"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Plan = "1M" | "3M" | "6M";

const PLAN_AMOUNTS: Record<Plan, number> = {
  "1M": 2999,
  "3M": 8999,
  "6M": 17999,
};

type UserPick = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  locality?: string;
  createdAt?: string;
};

type UsersApiResponse = {
  ok?: boolean;
  users?: UserPick[];
  localities?: string[];
  error?: string;
};

export default function NewMemberPage() {
  const router = useRouter();

  // --- New: search Users to autofill ---
  const [userQuery, setUserQuery] = useState("");
  const [debouncedUserQuery, setDebouncedUserQuery] = useState(userQuery);
  const [userResults, setUserResults] = useState<UserPick[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedUserQuery(userQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [userQuery]);

  useEffect(() => {
    // Load users whenever query changes (empty query will list all)
    (async () => {
      setUsersLoading(true);
      try {
        const res = await fetch(
          `/api/users?q=${encodeURIComponent(debouncedUserQuery)}`,
          { cache: "no-store" }
        );
        const data = (await res.json()) as UsersApiResponse;
        setUserResults(Array.isArray(data.users) ? data.users : []);
        // If currently selected user is not in filtered results, keep it but do nothing
      } catch {
        setUserResults([]);
      } finally {
        setUsersLoading(false);
      }
    })();
  }, [debouncedUserQuery]);

  // --- Form fields (autofilled from selected user, but editable) ---
  const [name, setName] = useState("");
  const [email, setEmail] = useState(""); // optional in Users, required here
  const [phone, setPhone] = useState("");

  // When user selection changes, autofill fields
  useEffect(() => {
    if (!selectedUserId) return;
    const u = userResults.find((x) => x._id === selectedUserId);
    if (u) {
      setName(u.name || "");
      setEmail(u.email || "");
      setPhone(u.phone || "");
    }
  }, [selectedUserId, userResults]);

  // Membership fields
  const [membership, setMembership] = useState<Plan>("1M");
  const [credits, setCredits] = useState<number>(0);
  const [amountDue, setAmountDue] = useState<number>(PLAN_AMOUNTS["1M"]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setAmountDue(PLAN_AMOUNTS[membership]);
  }, [membership]);

  const canSubmit = useMemo(() => {
    return (
      !!name &&
      !!email &&
      !!phone &&
      !!membership &&
      Number.isFinite(credits) &&
      credits >= 0 &&
      Number.isFinite(amountDue) &&
      amountDue >= 0
    );
  }, [name, email, phone, membership, credits, amountDue]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setErr(null);
    setLoading(true);
    const res = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, membership, credits, amountDue }),
    });
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    setLoading(false);
    if (!res.ok) {
      const msg =
        data && typeof data === "object" && "error" in data && typeof (data as { error?: string }).error === "string"
          ? (data as { error: string }).error
          : "Failed to add member";
      setErr(msg);
      return;
    }
    router.replace("/admin/members");
  }

  return (
    <div>
      <div className="topbar" style={{ marginBottom: 16 }}>
        <div>
          <div className="topbar-title">Add Member</div>
          <div className="topbar-sub">Search an existing user to autofill, then set membership</div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 840, display: "grid", gap: 16 }}>
        {/* --- User search & select --- */}
        <div className="card" style={{ background: "#fffdfa" }}>
          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <label>Search user (name/email)</label>
              <input
                className="input"
                placeholder="Type to search users…"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
              />
              {usersLoading && (
                <div style={{ fontSize: 12, color: "#5b5249", marginTop: 6 }}>Searching…</div>
              )}
            </div>

            <div>
              <label>Select from results</label>
              <select
                className="input"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
              >
                <option value="">— choose a user (optional) —</option>
                {userResults.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name} — {u.email} — {u.phone}
                  </option>
                ))}
              </select>
              <small style={{ color: "#5b5249" }}>
                Selecting a user will autofill name, email and phone. You can still edit them.
              </small>
            </div>
          </div>
        </div>

        {/* --- Member form --- */}
        <form onSubmit={onSubmit} className="grid" style={{ gap: 12 }}>
          <div>
            <label>Name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Full name"
            />
          </div>
          <div>
            <label>Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label>Phone number</label>
            <input
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder="10-digit phone"
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label>Membership</label>
              <select
                className="input"
                value={membership}
                onChange={(e) => setMembership(e.target.value as Plan)}
                required
              >
                <option value="1M">1 Month</option>
                <option value="3M">3 Months</option>
                <option value="6M">6 Months</option>
              </select>
            </div>
            <div>
              <label>Credits</label>
              <input
                className="input"
                type="number"
                min={0}
                value={credits}
                onChange={(e) => setCredits(Number.parseInt(e.target.value || "0", 10))}
                required
              />
            </div>
          </div>

          <div>
            <label>Amount due</label>
            <input className="input" type="number" value={amountDue} readOnly />
            <small style={{ color: "#5b5249" }}>
              1M = ₹2999, 3M = ₹8999, 6M = ₹17999 (auto-set by Membership)
            </small>
          </div>

          {err && <p style={{ color: "tomato", marginTop: 4 }}>{err}</p>}

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button className="btn btn-primary" disabled={loading || !canSubmit}>
              {loading ? "Saving..." : "Submit"}
            </button>
            <button type="button" className="btn" onClick={() => router.back()}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
