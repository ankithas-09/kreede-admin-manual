import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { dbConnect } from "@/lib/db";
import { AdminModel } from "@/models/Admin";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional(),
  password: z.string().min(6),
});

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const parse = schema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }
    const { name, email, password } = parse.data;

    const exists = await AdminModel.findOne({
      $or: [{ name }, ...(email ? [{ email }] : [])],
    });
    if (exists) {
      return NextResponse.json({ error: "Name or email already in use" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await AdminModel.create({ name, email, passwordHash });

    // Frontend expects JSON body
    return NextResponse.json({ ok: true, id: admin._id });
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
