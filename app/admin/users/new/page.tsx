"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewUserPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [locality, setLocality] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, locality }),
    });

    let data: unknown = {};
    try {
      data = await res.json();
    } catch {
      // ignore JSON parse errors
    }

    setLoading(false);
    if (!res.ok) {
      const msg = (data as { error?: string } | undefined)?.error || "Failed to add user";
      setErr(msg);
      return;
    }
    router.replace("/admin/users");
  }

  return (
    <div>
      <div className="topbar" style={{ marginBottom: 16 }}>
        <div>
          <div className="topbar-title">Add User</div>
          <div className="topbar-sub">Create a new user record</div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 640 }}>
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
          <div>
            <label>Locality</label>
            <input className="input" value={locality} onChange={e => setLocality(e.target.value)} required />
          </div>
          {err && <p style={{ color: "tomato", marginTop: 4 }}>{err}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button className="btn btn-primary" disabled={loading}>
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
