import { Suspense } from "react";
import SignupClient from "./SignupClient";

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="card" style={{ marginTop: 40 }}>Loading…</div>}>
      <SignupClient />
    </Suspense>
  );
}
