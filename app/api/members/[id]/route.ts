import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { MemberModel } from "@/models/Member";
import { Types } from "mongoose";

export async function PATCH(req: Request) {
  try {
    await dbConnect();

    // Derive :id from the URL to avoid strict Next.js param typing issues
    const url = new URL(req.url);
    const segments = url.pathname.split("/").filter(Boolean);
    const id = segments[segments.length - 1] ?? "";

    if (!id || !Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid member id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));

    // If "pay" flag is sent, set paid true and amountDue 0
    if ((body as { pay?: boolean })?.pay === true) {
      const updated = await MemberModel.findByIdAndUpdate(
        id,
        { $set: { paid: true, amountDue: 0 } },
        { new: true }
      ).lean();
      if (!updated) return NextResponse.json({ error: "Member not found" }, { status: 404 });
      return NextResponse.json({ ok: true, member: updated });
    }

    // Generic partial update (no logic change)
    const updated = await MemberModel.findByIdAndUpdate(id, { $set: body }, { new: true }).lean();
    if (!updated) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    return NextResponse.json({ ok: true, member: updated });
  } catch (err) {
    console.error("Members PATCH error:", err);
    return NextResponse.json({ error: "Failed to update member" }, { status: 500 });
  }
}
