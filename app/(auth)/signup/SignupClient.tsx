"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function SignupClient() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState(""); // optional
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/dashboard";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email: email || undefined, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data?.error || "Signup failed");
      return;
    }
    // After signup, take them to signin for explicit flow
    const prefill = email || name; // prefill either
    router.push(`/signin?email=${encodeURIComponent(prefill)}&next=${encodeURIComponent(next)}`);
  }

  return (
    <div className="card" style={{ marginTop: 40 }}>
      <h1>Create admin account</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginTop: 12 }}>
        <input
          className="input"
          placeholder="Full name (unique)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="input"
          placeholder="Email (optional)"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="input"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p style={{ color: "tomato" }}>{error}</p>}
        <button className="btn btn-primary" disabled={loading}>
          {loading ? "Creating..." : "Sign up"}
        </button>
      </form>
      <p style={{ marginTop: 12 }}>
        Already have an account? <Link className="link" href="/signin">Sign in</Link>
      </p>
    </div>
  );
}
