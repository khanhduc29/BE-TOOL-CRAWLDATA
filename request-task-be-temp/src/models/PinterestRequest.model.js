import mongoose from "mongoose";

const PinterestRequestSchema = new mongoose.Schema(
  {
    scan_type: {
      type: String,
      required: true,
    },

    scan_account: {
      type: String,
      default: "anonymous",
    },

    payload: {
      type: Object,
    },

    total_tasks: {
      type: Number,
      default: 0,
    },

    success_tasks: {
      type: Number,
      default: 0,
    },

    error_tasks: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["pending", "running", "success", "error"],
      default: "pending",
    },
  },
  { timestamps: true }
);

export default mongoose.model("PinterestRequest", PinterestRequestSchema);