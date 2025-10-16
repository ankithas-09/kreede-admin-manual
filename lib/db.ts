// lib/db.ts
import mongoose from "mongoose";

const RAW_URI = process.env.MONGODB_URI ?? "";
const MONGODB_URI = RAW_URI.trim(); // remove accidental spaces/newlines
const MONGODB_DBNAME = (process.env.MONGODB_DBNAME ?? "kreede-admin").trim();

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is not set. Add it to .env.local at project root.");
}
if (!(MONGODB_URI.startsWith("mongodb://") || MONGODB_URI.startsWith("mongodb+srv://"))) {
  // Surface what we actually received (partially masked)
  const preview = MONGODB_URI.slice(0, 30);
  throw new Error(
    `MONGODB_URI has invalid scheme. Got: "${preview}..." — it must start with "mongodb://" or "mongodb+srv://".`
  );
}

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const cached: MongooseCache =
  (global as unknown as { _mongoose?: MongooseCache })._mongoose || {
    conn: null,
    promise: null,
  };

export async function dbConnect(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, { dbName: MONGODB_DBNAME })
      .then((m) => m);
  }
  cached.conn = await cached.promise;
  (global as unknown as { _mongoose?: MongooseCache })._mongoose = cached;
  return cached.conn;
}
