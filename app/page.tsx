import { redirect } from "next/navigation";

export default function HomePage() {
  // Always redirect to the sign-in page
  redirect("/signin");
}