"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function SigninClient() {
  const [identifier, setIdentifier] = useState(""); // email or name
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const search = useSearchParams();
  const presetEmail = search.get("email");
  const next = search.get("next") || "/dashboard";

  useEffect(() => {
    if (presetEmail) setIdentifier(presetEmail);
  }, [presetEmail]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data?.error || "Sign in failed");
      return;
    }
    router.replace(next);
  }

  return (
    <div className="card" style={{ marginTop: 40 }}>
      <h1>Sign in</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginTop: 12 }}>
        <input
          className="input"
          placeholder="Email or Name"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
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
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p style={{ marginTop: 12 }}>
        New here? <Link className="link" href="/signup">Create an admin</Link>
      </p>
    </div>
  );
}
