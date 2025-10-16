import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { BookingModel } from "@/models/Booking";
import { CancellationModel } from "@/models/Cancellation";
import { MemberModel } from "@/models/Member";
import type { BookingDoc } from "@/models/Booking";
import mongoose, { Types } from "mongoose";

// Narrowed shapes for lean() results so TS knows exactly what fields exist
type BookingLean = Pick<
  BookingDoc,
  | "_id"
  | "name"
  | "isMember"
  | "memberId"
  | "date"
  | "court"
  | "slot"
  | "amountDue"
  | "paid"
  | "refunded"
  | "createdAt"
  | "updatedAt"
> & {
  memberId: Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
};

type CancellationLean = {
  _id: Types.ObjectId;
  originalBookingId: Types.ObjectId;
  name: string;
  isMember: boolean;
  memberId: Types.ObjectId | null;
  date: string;
  court: "court1" | "court2" | "court3";
  slot: string;
  amountDue: number;
  paid: boolean;
  refunded: boolean;
  cancelled: true;
  cancelledAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
};

type BodyPatch = Partial<{ cancel: boolean; refund: boolean; pay: boolean }>;

export async function PATCH(req: Request) {
  await dbConnect();

  // Derive the id from the URL path to avoid typing the RouteContext
  const url = new URL(req.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const id = segments[segments.length - 1] ?? "";

  if (!id || !Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });
  }

  const raw = await req.json().catch(() => ({}));
  const body = raw as BodyPatch;

  // --------------------
  // CANCEL (move → cancellations, delete active, restore 1 credit; idempotent)
  // --------------------
  if (body?.cancel === true) {
    const session = await mongoose.startSession();
    try {
      let responseSnapshot: CancellationLean | null = null;
      let updatedMember:
        | { _id: string; name: string; email?: string; credits: number }
        | null = null;

      await session.withTransaction(async () => {
        // If already moved, return snapshot and (optionally) the current member
        const already = await CancellationModel.findOne({
          originalBookingId: new Types.ObjectId(id),
        })
          .session(session)
          .select({
            originalBookingId: 1,
            name: 1,
            isMember: 1,
            memberId: 1,
            date: 1,
            court: 1,
            slot: 1,
            amountDue: 1,
            paid: 1,
            refunded: 1,
            cancelled: 1,
            cancelledAt: 1,
            createdAt: 1,
            updatedAt: 1,
          })
          .lean<CancellationLean | null>();

        if (already) {
          responseSnapshot = already;
          if (already.memberId) {
            const m = await MemberModel.findById(already.memberId)
              .select({ name: 1, email: 1, credits: 1 })
              .session(session)
              .lean<{ _id: Types.ObjectId; name: string; email?: string; credits: number } | null>();
            if (m) {
              updatedMember = {
                _id: String(m._id),
                name: m.name,
                email: m.email,
                credits: m.credits,
              };
            }
          }
          return; // idempotent: no double-credit
        }

        // Load active booking
        const b = await BookingModel.findById(id)
          .select({
            name: 1,
            isMember: 1,
            memberId: 1,
            date: 1,
            court: 1,
            slot: 1,
            amountDue: 1,
            paid: 1,
            refunded: 1,
            createdAt: 1,
            updatedAt: 1,
          })
          .lean<BookingLean | null>({ session });

        if (!b) throw new Error("NOT_FOUND");

        // Create cancellation snapshot
        const cancelDoc: CancellationLean = {
          _id: new Types.ObjectId(),
          originalBookingId: new Types.ObjectId(id),
          name: b.name,
          isMember: b.isMember,
          memberId: b.memberId ?? null,
          date: b.date,
          court: b.court,
          slot: b.slot,
          amountDue: b.amountDue,
          paid: b.paid,
          refunded: Boolean(b.refunded),
          cancelled: true,
          cancelledAt: new Date(),
          createdAt: b.createdAt,
          updatedAt: b.updatedAt,
        };

        await CancellationModel.create([cancelDoc], { session });
        await BookingModel.deleteOne({ _id: new Types.ObjectId(id) }).session(session);

        // Restore exactly 1 credit for member booking
        if (b.isMember && b.memberId) {
          const m = await MemberModel.findOneAndUpdate(
            { _id: b.memberId },
            { $inc: { credits: 1 } },
            { new: true, session }
          )
            .select({ name: 1, email: 1, credits: 1 })
            .lean<{ _id: Types.ObjectId; name: string; email?: string; credits: number } | null>();
          if (m) {
            updatedMember = {
              _id: String(m._id),
              name: m.name,
              email: m.email,
              credits: m.credits,
            };
          }
        }

        responseSnapshot = cancelDoc;
      });

      if (!responseSnapshot) {
        const existing = await CancellationModel.findOne({
          originalBookingId: new Types.ObjectId(id),
        })
          .select({
            originalBookingId: 1,
            name: 1,
            isMember: 1,
            memberId: 1,
            date: 1,
            court: 1,
            slot: 1,
            amountDue: 1,
            paid: 1,
            refunded: 1,
            cancelled: 1,
            cancelledAt: 1,
            createdAt: 1,
            updatedAt: 1,
          })
          .lean<CancellationLean | null>();
        if (!existing) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

        let updatedMemberLocal: { _id: string; name: string; email?: string; credits: number } | null = null;
        if (existing.memberId) {
          const m = await MemberModel.findById(existing.memberId)
            .select({ name: 1, email: 1, credits: 1 })
            .lean<{ _id: Types.ObjectId; name: string; email?: string; credits: number } | null>();
          if (m) {
            updatedMemberLocal = {
              _id: String(m._id),
              name: m.name,
              email: m.email,
              credits: m.credits,
            };
          }
        }
        return NextResponse.json({ ok: true, booking: existing, updatedMember: updatedMemberLocal });
      }

      return NextResponse.json({ ok: true, booking: responseSnapshot, updatedMember });
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "NOT_FOUND") {
        return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      }
      console.error("Cancel transaction error:", e);
      return NextResponse.json({ error: "Failed to cancel booking" }, { status: 500 });
    } finally {
      await session.endSession();
    }
  }

  // --------------------
  // REFUND (only for active, paid non-member bookings)
  // --------------------
  if (body?.refund === true) {
    const moved = await CancellationModel.exists({
      originalBookingId: new Types.ObjectId(id),
    });
    if (moved) {
      return NextResponse.json(
        { error: "Cannot refund: booking already cancelled" },
        { status: 400 }
      );
    }

    const updated = await BookingModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), paid: true, refunded: { $ne: true } },
      { $set: { refunded: true } },
      { new: true }
    )
      .select({ paid: 1, refunded: 1 })
      .lean<Pick<BookingDoc, "paid" | "refunded"> | null>();

    if (!updated) {
      return NextResponse.json({ error: "Booking not found or not paid" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, booking: updated });
  }

  // --------------------
  // PAY (guard against cancelled/moved)
  // --------------------
  if (body?.pay === true) {
    const moved = await CancellationModel.exists({
      originalBookingId: new Types.ObjectId(id),
    });
    if (moved) {
      return NextResponse.json(
        { error: "Cannot pay: booking already cancelled" },
        { status: 400 }
      );
    }

    const updated = await BookingModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id) },
      { $set: { paid: true, amountDue: 0 } },
      { new: true }
    )
      .select({ paid: 1 })
      .lean<Pick<BookingDoc, "paid"> | null>();

    if (!updated) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    return NextResponse.json({ ok: true, booking: updated });
  }

  return NextResponse.json({ error: "Unsupported update" }, { status: 400 });
}
