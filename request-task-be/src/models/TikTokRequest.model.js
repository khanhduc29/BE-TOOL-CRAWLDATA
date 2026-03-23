import mongoose from "mongoose";

const TikTokRequestSchema = new mongoose.Schema(
  {
    scan_type: {
      type: String,
      enum: ["relations", "top_posts", "users", "video_comments"],
      required: true,
    },

    scan_account: {
      type: String,
      required: true, // tool bot
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

export default mongoose.model("TikTokRequest", TikTokRequestSchema);