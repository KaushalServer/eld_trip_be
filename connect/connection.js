import mongoose from "mongoose";
export default async function connection() {
  if (!process.env.MONGO_URL) throw new Error("MONGO_URL is not configured.");
  await mongoose.connect(process.env.MONGO_URL);
  console.log("Connected to MongoDB");
}
