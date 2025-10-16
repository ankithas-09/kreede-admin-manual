import { NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { UserModel } from "@/models/User";

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(7).max(20),
  locality: z.string().min(2),
});

type UserLean = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  locality: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export async function GET(req: Request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const locality = (searchParams.get("locality") || "all").trim();
    const sort = (searchParams.get("sort") || "desc").trim();

    const filter: Record<string, unknown> = {};
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ];
    }
    if (locality && locality !== "all") {
      filter.locality = locality;
    }

    const sortDir = sort === "asc" ? 1 : -1;

    const [users, localities] = await Promise.all([
      UserModel.find(filter).sort({ createdAt: sortDir }).lean<UserLean[]>(),
      UserModel.distinct("locality"),
    ]);

    return NextResponse.json({ ok: true, users, localities });
  } catch (err: unknown) {
    console.error("Users GET error:", err);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
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

    // ✅ Check if a user with the same email already exists
    const existing = await UserModel.findOne({ email: parse.data.email }).lean();
    if (existing) {
      return NextResponse.json({ error: "User with this email already exists." }, { status: 409 });
    }

    const user = await UserModel.create(parse.data);
    return NextResponse.json({ ok: true, id: user._id });
  } catch (err: unknown) {
    console.error("Users POST error:", err);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
