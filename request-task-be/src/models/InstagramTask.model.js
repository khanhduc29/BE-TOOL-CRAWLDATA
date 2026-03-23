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
      enum: ["pending", "success", "error"],
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
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("InstagramTask", InstagramTaskSchema);