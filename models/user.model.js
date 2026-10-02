import mongoose from "mongoose";
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true, minlength: 3, maxlength: 40 },
  passwordHash: { type: String, required: true },
}, { timestamps: true });
export default mongoose.model("User", userSchema);
