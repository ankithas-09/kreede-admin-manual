import { Schema, model, models } from "mongoose";

export interface AdminDoc {
  _id: string;
  name: string;
  email?: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const AdminSchema = new Schema<AdminDoc>(
  {
    name: { type: String, required: true, trim: true, unique: true, index: true },
    email: { type: String, required: false, unique: true, sparse: true, lowercase: true, index: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

export const AdminModel = models.Admin || model<AdminDoc>("Admin", AdminSchema);
