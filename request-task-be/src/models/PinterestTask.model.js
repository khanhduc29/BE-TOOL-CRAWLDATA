import mongoose from "mongoose";

const PinterestTaskSchema = new mongoose.Schema(
  {
    request_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PinterestRequest",
      required: true,
    },

    scan_type: {
      type: String,
      required: true,
    },

    input: {
      type: Object,
    },

    status: {
      type: String,
      default: "pending",
    },

    result: {
      type: Object,
      default: null,
    },

    assigned_worker: {
      type: String,
      default: null,
      index: true,
    },

    error_message: { type: String, default: null },
    retry_count: { type: Number, default: 0 },
    max_retries: { type: Number, default: 3 },
    last_error: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("PinterestTask", PinterestTaskSchema);