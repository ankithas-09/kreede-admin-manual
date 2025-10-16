import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { UserModel } from "@/models/User";
import { Types } from "mongoose";

export async function DELETE(req: Request) {
  try {
    await dbConnect();

    // Derive :id from the URL path to avoid Next.js param typing issues
    const url = new URL(req.url);
    const segments = url.pathname.split("/").filter(Boolean);
    const id = segments[segments.length - 1] ?? "";

    if (!id || !Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    const deleted = await UserModel.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("Users DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
