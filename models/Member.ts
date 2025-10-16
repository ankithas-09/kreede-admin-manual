import { Schema, model, models } from "mongoose";

export type MembershipPlan = "1M" | "3M" | "6M";

export interface MemberDoc {
  _id: string;
  name: string;
  email: string;
  phone: string;
  membership: MembershipPlan;   // 1M | 3M | 6M
  credits: number;              // starting credits
  amountDue: number;            // 2999 | 8999 | 17999
  paid: boolean;                // payment status
  createdAt: Date;
  updatedAt: Date;
}

const MemberSchema = new Schema<MemberDoc>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    phone: { type: String, required: true, trim: true, index: true },
    membership: { type: String, enum: ["1M", "3M", "6M"], required: true },
    credits: { type: Number, required: true, min: 0 },
    amountDue: { type: Number, required: true, min: 0 },
    paid: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const MemberModel = models.Member || model<MemberDoc>("Member", MemberSchema);
