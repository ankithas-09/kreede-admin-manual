import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { BookingModel } from "@/models/Booking";

type CourtKey = "court1" | "court2" | "court3";

// New per-slot booking shape (lean)
type BookingNewLean = {
  date: string; // YYYY-MM-DD
  court: CourtKey;
  slot: string; // "HH:00"
};

// Legacy booking shape with arrays (lean)
type BookingLegacyLean = {
  date: string; // YYYY-MM-DD
  court1?: string[];
  court2?: string[];
  court3?: string[];
};

// Union we read from the DB via lean()
type BookingLeanUnion = (BookingNewLean | BookingLegacyLean) & Record<string, unknown>;

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const date = (searchParams.get("date") || "").trim(); // YYYY-MM-DD
    if (!date) {
      return NextResponse.json({ error: "date is required (YYYY-MM-DD)" }, { status: 400 });
    }

    // Fetch all fields to tolerate both legacy and new shapes
    const day = await BookingModel.find({ date }).lean<BookingLeanUnion[]>();

    const booked = {
      court1: new Set<string>(),
      court2: new Set<string>(),
      court3: new Set<string>(),
    };

    for (const b of day) {
      // NEW shape (one doc per slot)
      if ("court" in b && "slot" in b && typeof (b as BookingNewLean).slot === "string") {
        const c = (b as BookingNewLean).court;
        const s = (b as BookingNewLean).slot;
        if (c === "court1" || c === "court2" || c === "court3") {
          booked[c].add(s);
        }
      }

      // LEGACY shape (one doc with arrays court1/court2/court3)
      const l = b as BookingLegacyLean;
      if (Array.isArray(l.court1)) l.court1.forEach((s) => booked.court1.add(String(s)));
      if (Array.isArray(l.court2)) l.court2.forEach((s) => booked.court2.add(String(s)));
      if (Array.isArray(l.court3)) l.court3.forEach((s) => booked.court3.add(String(s)));
    }

    return NextResponse.json({
      ok: true,
      booked: {
        court1: Array.from(booked.court1).sort(),
        court2: Array.from(booked.court2).sort(),
        court3: Array.from(booked.court3).sort(),
      },
    });
  } catch (err) {
    console.error("Availability GET error:", err);
    return NextResponse.json({ error: "Failed to load availability" }, { status: 500 });
  }
}
