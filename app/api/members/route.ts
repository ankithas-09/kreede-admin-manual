import { NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { MemberModel } from "@/models/Member";

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(7).max(20),
  membership: z.enum(["1M", "3M", "6M"]),
  credits: z.coerce.number().int().min(0),
  amountDue: z.coerce.number().int().min(0),
});

// Optional lean type (keeps things strict without changing logic)
type MemberLean = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  membership: "1M" | "3M" | "6M";
  credits: number;
  amountDue: number;
  paid?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const membership = (searchParams.get("membership") || "all").trim();
    const sort = (searchParams.get("sort") || "desc").trim(); // "desc" | "asc"

    const filter: Record<string, unknown> = {};
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
      ];
    }
    if (membership && membership !== "all") {
      filter.membership = membership;
    }

    const sortDir = sort === "asc" ? 1 : -1;

    const [members, memberships] = await Promise.all([
      MemberModel.find(filter).sort({ createdAt: sortDir }).lean<MemberLean[]>(),
      MemberModel.distinct("membership"),
    ]);

    return NextResponse.json({ ok: true, members, memberships });
  } catch (err: unknown) {
    console.error("Members GET error:", err);
    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const parse = createSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }
    const member = await MemberModel.create({ ...parse.data, paid: parse.data.amountDue === 0 });
    return NextResponse.json({ ok: true, id: member._id });
  } catch (err: unknown) {
    console.error("Members POST error:", err);
    return NextResponse.json({ error: "Failed to create member" }, { status: 500 });
  }
}
