"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Plan = "1M" | "3M" | "6M";

const PLAN_AMOUNTS: Record<Plan, number> = {
  "1M": 2999,
  "3M": 8999,
  "6M": 17999,
};

export default function NewMemberPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [membership, setMembership] = useState<Plan>("1M");
  const [credits, setCredits] = useState<number>(0);
  const [amountDue, setAmountDue] = useState<number>(PLAN_AMOUNTS["1M"]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setAmountDue(PLAN_AMOUNTS[membership]);
  }, [membership]);

  const canSubmit = useMemo(() => {
    return Boolean(name && email && phone && membership) && credits >= 0 && amountDue >= 0;
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

    let data: unknown = {};
    try {
      data = await res.json();
    } catch {
      // ignore JSON parse errors
    }

    setLoading(false);
    if (!res.ok) {
      const msg = (data as { error?: string } | undefined)?.error || "Failed to add member";
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
          <div className="topbar-sub">Create a new member record</div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 720 }}>
        <form onSubmit={onSubmit} className="grid" style={{ gap: 12 }}>
          <div>
            <label>Name</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div>
            <label>Email</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label>Phone number</label>
            <input className="input" value={phone} onChange={e => setPhone(e.target.value)} required />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label>Membership</label>
              <select
                className="input"
                value={membership}
                onChange={e => setMembership(e.target.value as Plan)}
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
                onChange={e => setCredits(parseInt(e.target.value || "0", 10))}
                required
              />
            </div>
          </div>

          <div>
            <label>Amount due</label>
            <input className="input" type="number" value={amountDue} readOnly />
            <small style={{ color: "#5b5249" }}>
              1M = ₹2999, 3M = ₹8999, 6M = ₹17999 (auto-set)
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
