import mongoose from "mongoose";

const ChplayTaskSchema = new mongoose.Schema(
  {
    scan_type: {
      type: String,
      enum: ["search", "reviews"],
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

export default mongoose.model("ChplayTask", ChplayTaskSchema);
