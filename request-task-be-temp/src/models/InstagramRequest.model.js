import mongoose from "mongoose";

const InstagramRequestSchema = new mongoose.Schema(
  {
    scan_account: {
      type: String,
      default: null,
    },

    payload: {
      type: Object,
      required: true,
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
  {
    timestamps: true,
  }
);

export default mongoose.model("InstagramRequest", InstagramRequestSchema);