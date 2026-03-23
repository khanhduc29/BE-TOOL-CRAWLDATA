import mongoose from "mongoose";

const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: String, default: "" },
    description: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("Setting", settingSchema);
