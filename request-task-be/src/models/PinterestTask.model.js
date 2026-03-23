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
  },
  { timestamps: true }
);

export default mongoose.model("PinterestTask", PinterestTaskSchema);