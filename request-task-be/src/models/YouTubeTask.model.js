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
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("YouTubeTask", YouTubeTaskSchema);