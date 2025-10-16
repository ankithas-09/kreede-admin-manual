import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { dbConnect } from "@/lib/db";
import { AdminModel } from "@/models/Admin";
import { signToken, authCookie } from "@/lib/jwt";


// Accept either email or name for login
const schema = z.union([
z.object({ identifier: z.string().email(), password: z.string().min(6) }), // email
z.object({ identifier: z.string().min(2), password: z.string().min(6) }) // name
]);


export async function POST(req: Request) {
await dbConnect();
const body = await req.json();
const parse = schema.safeParse(body);
if (!parse.success) {
return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
}
const { identifier, password } = parse.data as { identifier: string; password: string };


const query = identifier.includes("@")
? { email: identifier.toLowerCase() }
: { name: identifier };


const admin = await AdminModel.findOne(query);
if (!admin) {
return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
}
const ok = await bcrypt.compare(password, admin.passwordHash);
if (!ok) {
return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
}


const token = signToken({ sub: admin._id, email: admin.email, name: admin.name }, { expiresIn: "7d" });


const res = NextResponse.json({ ok: true });
res.cookies.set(authCookie.name, token, authCookie.options);
return res;
}