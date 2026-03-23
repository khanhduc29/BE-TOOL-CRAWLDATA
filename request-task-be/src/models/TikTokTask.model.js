import mongoose from "mongoose";

const TikTokTaskSchema = new mongoose.Schema(
  {
    request_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TikTokRequest",
      required: true,
    },

    scan_type: {
      type: String,
      enum: ["relations", "top_posts", "users", "video_comments"],
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
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("TikTokTask", TikTokTaskSchema);