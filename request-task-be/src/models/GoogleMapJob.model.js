import mongoose from "mongoose";

const GoogleMapJobSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },

    raw_keywords: {
      type: String, // mỗi dòng 1 keyword
      required: true,
    },

    address: {
      type: String,
      required: true,
    },

    region: {
      type: String,
      required: true,
    },

    result_limit: {
      type: Number,
      required: true,
    },

    delay_seconds: {
      type: Number,
      default: 3,
    },

    deep_scan: {
      type: Boolean,
      default: false,
    },

    deep_scan_website: {
      type: Boolean,
      default: false,
    },

    deep_scan_reviews: {
      type: Boolean,
      default: false,
    },

    review_limit: {
      type: Number,
      default: 20,
    },

    status: {
      type: String,
      enum: ["pending", "processing", "success", "error", "cancel"],
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
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

export default mongoose.model("GoogleMapJob", GoogleMapJobSchema);