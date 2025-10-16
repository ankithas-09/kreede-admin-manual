import mongoose, { Schema, model, models, Types } from "mongoose";
import type { CourtKey } from "./Booking";

export interface CancellationDoc {
  _id: string;
  originalBookingId: Types.ObjectId; // link back to the booking id
  name: string;
  isMember: boolean;
  memberId?: Types.ObjectId | null;
  date: string;       // YYYY-MM-DD
  court: CourtKey;
  slot: string;       // "HH:00"
  amountDue: number;  // carry-over at time of cancel
  paid: boolean;      // carry-over at time of cancel
  refunded: boolean;  // if refund later happens (optional flow)
  cancelled: true;    // always true here
  createdAt: Date;    // original booking createdAt
  updatedAt: Date;    // when this doc updates
  cancelledAt: Date;  // when it was cancelled
}

const CancellationSchema = new Schema<CancellationDoc>(
  {
    originalBookingId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true, trim: true },
    isMember: { type: Boolean, required: true, default: false },
    memberId: { type: Schema.Types.ObjectId, ref: "Member", default: null },
    date: { type: String, required: true },
    court: { type: String, enum: ["court1", "court2", "court3"], required: true },
    slot: { type: String, required: true },
    amountDue: { type: Number, required: true, min: 0 },
    paid: { type: Boolean, default: false },
    refunded: { type: Boolean, default: false },
    cancelled: { type: Boolean, default: true },
    cancelledAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true }
);

// refresh cached model in dev
try { if (mongoose.models.Cancellation) mongoose.deleteModel("Cancellation"); } catch {}

export const CancellationModel =
  models.Cancellation || model<CancellationDoc>("Cancellation", CancellationSchema);
