import { Schema, model, models } from "mongoose";

export interface UserDoc {
  _id: string;
  name: string;
  email: string;
  phone: string;
  locality: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<UserDoc>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    phone: { type: String, required: true, trim: true, index: true },
    locality: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export const UserModel = models.User || model<UserDoc>("User", UserSchema);
