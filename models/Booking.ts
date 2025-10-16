import mongoose, { Schema, model, models, Types } from "mongoose";

export type CourtKey = "court1" | "court2" | "court3";

export interface BookingDoc {
  _id: string;
  name: string;
  isMember: boolean;
  memberId?: Types.ObjectId | null;
  date: string;      // YYYY-MM-DD
  court: CourtKey;   // single court
  slot: string;      // "HH:00"
  amountDue: number; // 500 for non-member, 0 for member
  paid: boolean;
  cancelled: boolean; // NEW
  refunded: boolean;  // NEW (for paid non-members)
  createdAt: Date;
  updatedAt: Date;
}

const BookingSchema = new Schema<BookingDoc>(
  {
    name: { type: String, required: true, trim: true },
    isMember: { type: Boolean, required: true, default: false },
    memberId: { type: Schema.Types.ObjectId, ref: "Member", default: null },
    date: { type: String, required: true },
    court: { type: String, enum: ["court1", "court2", "court3"], required: true },
    slot: { type: String, required: true }, // "HH:00"
    amountDue: { type: Number, required: true, min: 0 },
    paid: { type: Boolean, default: false },
    cancelled: { type: Boolean, default: false }, // NEW
    refunded: { type: Boolean, default: false },  // NEW
  },
  { timestamps: true }
);

BookingSchema.index({ date: 1, court: 1, slot: 1 }, { unique: true });

try { if (mongoose.models.Booking) mongoose.deleteModel("Booking"); } catch {}

export const BookingModel = models.Booking || model<BookingDoc>("Booking", BookingSchema);
