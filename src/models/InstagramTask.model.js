import mongoose from "mongoose";

const InstagramTaskSchema = new mongoose.Schema(
  {
    request_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InstagramRequest",
      required: true,
    },

    scan_type: {
      type: String,
      default: "profile",
    },

    input: {
      url: {
        type: String,
        required: true,
      },

      scan_website: {
        type: Boolean,
        default: false,
      },
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

    error: {
      type: String,
      default: null,
    },

    finished_at: {
      type: Date,
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

export default mongoose.model("InstagramTask", InstagramTaskSchema);