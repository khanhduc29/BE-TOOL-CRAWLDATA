import mongoose from "mongoose";

const TwitterTaskSchema = new mongoose.Schema(
  {
    request_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TwitterRequest",
      required: true,
    },

    scan_type: {
      type: String,
      enum: ["posts", "users", "replies"],
      required: true,
    },

    input: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "running", "success", "error"],
      default: "pending",
    },

    result: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    error_message: String,

    assigned_worker: {
      type: String,
      default: null,
      index: true,
    },

    retry_count: { type: Number, default: 0 },
    max_retries: { type: Number, default: 3 },
    last_error: { type: String, default: null },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("TwitterTask", TwitterTaskSchema);
