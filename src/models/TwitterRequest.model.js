import mongoose from "mongoose";

const TwitterRequestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },

    scan_type: {
      type: String,
      enum: ["posts", "users", "replies"],
      required: true,
    },

    scan_account: {
      type: String,
      required: true,
    },

    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "running", "success", "error", "cancel"],
      default: "pending",
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
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("TwitterRequest", TwitterRequestSchema);
