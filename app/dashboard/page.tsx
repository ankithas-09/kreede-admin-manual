"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";

const boxes = [
  { key: "users", label: "Users", view: "/admin/users", add: "/admin/users/new" },
  { key: "members", label: "Members", view: "/admin/members", add: "/admin/members/new" },
  { key: "bookings", label: "Court Bookings", view: "/admin/bookings", add: "/admin/bookings/new" }, // ✅ correct
  { key: "events", label: "Event Registrations", view: "/admin/events", add: "/admin/events/new" },
  { key: "coaching", label: "Coaching Registrations", view: "/admin/coaching", add: "/admin/coaching/new" },
  { key: "tournaments", label: "Tournament Registrations", view: "/admin/tournaments", add: "/admin/tournaments/new" },
];

export default function DashboardPage() {
  const router = useRouter();

  async function signout() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.replace("/signin");
  }

  return (
    <div style={{ position: "relative" }}>
      <div className="topbar">
        <div>
          <div className="topbar-title">KREEDE Admin</div>
          <div className="topbar-sub">Unite • Thrive • Play</div>
        </div>
        <button onClick={signout} className="btn btn-primary">Sign out</button>
      </div>

      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <span className="pill pill-accent">Live</span>
      </header>
      <p style={{ opacity: 0.75, marginTop: 0, marginBottom: 16 }}>
        Manage your facility — users, memberships, bookings and registrations at a glance.
      </p>

      <section className="grid stat-grid">
        {boxes.map((b) => (
          <article key={b.key} className="card stat">
            <div className="stat-head">
              <div className={`stat-icon ${iconClass(b.key)}`} aria-hidden />
              <div className="stat-label">{b.label}</div>
            </div>
            <div className="stat-actions">
              <Link className="btn" href={b.view} aria-label={`${b.label} - View`}>View</Link>
              <Link className="btn btn-primary" href={b.add} aria-label={`${b.label} - Add`}>Add</Link>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function iconClass(key: string) {
  switch (key) {
    case "users": return "ico-users";
    case "members": return "ico-members";
    case "bookings": return "ico-bookings";
    case "events": return "ico-events";
    case "coaching": return "ico-coaching";
    case "tournaments": return "ico-tournaments";
    default: return "ico-generic";
  }
}
