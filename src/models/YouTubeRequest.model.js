import mongoose from "mongoose";

const YouTubeRequestSchema = new mongoose.Schema(
  {
    scan_type: {
      type: String,
      enum: ["channels", "videos", "video_comments"],
      required: true,
    },
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

export default mongoose.model("YouTubeRequest", YouTubeRequestSchema);