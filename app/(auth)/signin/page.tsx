import { Suspense } from "react";
import SigninClient from "./SigninClient";

export default function SigninPage() {
  return (
    <Suspense fallback={<div className="card" style={{ marginTop: 40 }}>Loading…</div>}>
      <SigninClient />
    </Suspense>
  );
}
