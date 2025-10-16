import { NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { BookingModel } from "@/models/Booking";
import { CancellationModel } from "@/models/Cancellation";
import { MemberModel, type MemberDoc } from "@/models/Member";
import { isValidObjectId, Types } from "mongoose";

const NON_MEMBER_PRICE_PER_SLOT = 500;

const createSchema = z.object({
  name: z.string().min(2),
  isMember: z.boolean(),
  memberId: z.string().optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  court1: z.array(z.string()).default([]),
  court2: z.array(z.string()).default([]),
  court3: z.array(z.string()).default([]),
});

type MemberLean = Pick<MemberDoc, "_id" | "name" | "credits">;

// Lean shapes for GET merging
type CourtKey = "court1" | "court2" | "court3";

type BookingActiveLean = {
  _id: Types.ObjectId;
  name: string;
  isMember: boolean;
  date: string;
  // New shape (per-slot)
  court?: CourtKey;
  slot?: string;
  // Legacy shape (arrays)
  court1?: string[];
  court2?: string[];
  court3?: string[];
  amountDue?: number;
  paid?: boolean;
  refunded?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

type CancellationLean = {
  _id: Types.ObjectId;
  originalBookingId: Types.ObjectId;
  name: string;
  isMember: boolean;
  memberId?: Types.ObjectId | null;
  date: string;
  court?: CourtKey;
  slot?: string;
  amountDue?: number;
  paid?: boolean;
  refunded?: boolean;
  cancelled: true;
  cancelledAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
};

type MergedBooking =
  | (BookingActiveLean & { cancelled: false; origin: "booking" })
  | (Omit<CancellationLean, "_id"> & { _id: Types.ObjectId; cancelled: true; origin: "cancellation" });

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const date = (searchParams.get("date") || "").trim();
    const sort = (searchParams.get("sort") || "desc").trim();
    const isMemberParam = (searchParams.get("isMember") || "all").trim();

    const filter: Record<string, unknown> = {};
    if (q) filter.name = { $regex: q, $options: "i" };
    if (date) filter.date = date;
    if (isMemberParam === "yes") filter.isMember = true;
    if (isMemberParam === "no") filter.isMember = false;

    const sortDir = sort === "asc" ? 1 : -1;

    // Active bookings
    const act = await BookingModel.find(filter)
      .sort({ createdAt: sortDir })
      .lean<BookingActiveLean[]>();

    // Cancellations (apply same filters; name/date/isMember exist on snapshots)
    const canc = await CancellationModel.find(filter)
      .sort({ cancelledAt: sortDir })
      .lean<CancellationLean[]>();

    // Normalize & merge so UI can render both uniformly
    const mapAct: MergedBooking[] = act.map((b) => ({
      ...b,
      cancelled: false,
      origin: "booking",
    }));

    const mapCanc: MergedBooking[] = canc.map((c) => ({
      ...c,
      _id: c.originalBookingId, // keep same identity as original booking id for UI actions
      cancelled: true,
      origin: "cancellation",
    }));

    // Merge and sort by createdAt (fallback to cancelledAt for cancellations)
    const merged = [...mapAct, ...mapCanc].sort((a, b) => {
      const ta = new Date((a as BookingActiveLean).createdAt || (a as CancellationLean).cancelledAt || 0).getTime();
      const tb = new Date((b as BookingActiveLean).createdAt || (b as CancellationLean).cancelledAt || 0).getTime();
      return sortDir === 1 ? ta - tb : tb - ta;
    });

    return NextResponse.json({ ok: true, bookings: merged });
  } catch (err: unknown) {
    console.error("Bookings GET error:", err);
    return NextResponse.json({ error: "Failed to fetch bookings" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  await dbConnect();

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const { name, isMember, memberId, date, court1, court2, court3 } = parsed.data;

  // Build per-slot selections
  type Selection = { court: CourtKey; slot: string };
  const selections: Selection[] = [
    ...court1.map((s) => ({ court: "court1" as const, slot: s })),
    ...court2.map((s) => ({ court: "court2" as const, slot: s })),
    ...court3.map((s) => ({ court: "court3" as const, slot: s })),
  ];
  if (selections.length === 0) {
    return NextResponse.json({ error: "Select at least one slot" }, { status: 400 });
  }

  // Prevent double-booking
  const conflicts = await BookingModel.find({
    date,
    $or: selections.map((x) => ({ court: x.court, slot: x.slot })),
  })
    .select("court slot -_id")
    .lean<{ court: CourtKey; slot: string }[]>();
  if (conflicts.length) {
    return NextResponse.json(
      { error: "Some slots were already booked", conflicts },
      { status: 409 }
    );
  }

  // Member handling: validate & atomically decrement credits
  let effectiveName = name;
  let memberOid: Types.ObjectId | null = null;

  if (isMember) {
    if (!memberId || !isValidObjectId(memberId)) {
      return NextResponse.json({ error: "Select a valid member" }, { status: 400 });
    }
    memberOid = new Types.ObjectId(memberId);
    const need = selections.length;

    const member = await MemberModel.findOneAndUpdate(
      { _id: memberOid, credits: { $gte: need } },
      { $inc: { credits: -need } },
      { new: true }
    )
      .select({ name: 1, credits: 1 })
      .lean<MemberLean | null>();

    if (!member) {
      return NextResponse.json(
        { error: `Not enough credits. Need ${need} credit(s).` },
        { status: 400 }
      );
    }

    // Keep bookings name consistent with Member
    effectiveName = member.name;
  }

  // Create one booking document per slot
  const docs = selections.map(({ court, slot }) => ({
    name: effectiveName,
    isMember,
    memberId: memberOid,
    date,
    court,
    slot,
    amountDue: isMember ? 0 : NON_MEMBER_PRICE_PER_SLOT,
    paid: isMember, // members pay 0
  }));

  try {
    await BookingModel.insertMany(docs, { ordered: true });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    // Refund credits if insert fails after decrement
    if (isMember && memberOid) {
      await MemberModel.updateOne(
        { _id: memberOid },
        { $inc: { credits: selections.length } }
      ).catch(() => {});
    }
    // Duplicate key (race) handling (code 11000 in Mongo)
    const code = (err as { code?: number } | null)?.code;
    if (code === 11000) {
      return NextResponse.json(
        { error: "Some slots were already booked (race condition). Please reselect." },
        { status: 409 }
      );
    }
    console.error("Bookings POST error:", err);
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }
}
