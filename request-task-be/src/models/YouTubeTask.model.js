import mongoose from "mongoose";

const YouTubeTaskSchema = new mongoose.Schema(
  {
    request_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "YouTubeRequest",
      required: true,
    },
    scan_type: {
      type: String,
      required: true,
    },
    input: {
      type: Object,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "running", "success", "error"],
      default: "pending",
    },
    result: {
      type: Object,
      default: null,
    },
    error_message: {
      type: String,
      default: null,
    },

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

export default mongoose.model("YouTubeTask", YouTubeTaskSchema);