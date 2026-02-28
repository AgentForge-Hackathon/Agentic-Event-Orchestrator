import mongoose from "mongoose";
import { env } from "@/config";

export const connectMongo = async () => {
  await mongoose.connect(env.MONGO_URI);
  console.log("✅ MongoDB Connected");
};