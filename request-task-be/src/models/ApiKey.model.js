import mongoose from "mongoose";

const apiKeySchema = new mongoose.Schema(
  {
    service: { type: String, required: true, index: true }, // e.g. "youtube"
    key: { type: String, required: true },
    label: { type: String, default: "" }, // friendly name
    status: {
      type: String,
      enum: ["active", "exhausted", "error", "disabled"],
      default: "active",
    },
    usage_count: { type: Number, default: 0 },
    last_used_at: { type: Date, default: null },
    last_error: { type: String, default: "" },
  },
  { timestamps: true }
);

// Compound index for efficient lookups
apiKeySchema.index({ service: 1, status: 1 });

/**
 * Get next available key (round-robin by least-recently-used)
 */
apiKeySchema.statics.getNextKey = async function (service) {
  const key = await this.findOneAndUpdate(
    { service, status: "active" },
    { $inc: { usage_count: 1 }, $set: { last_used_at: new Date() } },
    { sort: { last_used_at: 1 }, new: true } // LRU: pick the least recently used
  );
  return key;
};

/**
 * Mark a key as exhausted/error
 */
apiKeySchema.statics.markKeyError = async function (keyId, errorMsg = "") {
  return this.findByIdAndUpdate(keyId, {
    status: "exhausted",
    last_error: errorMsg,
  });
};

/**
 * Reset all exhausted keys (e.g. daily quota reset)
 */
apiKeySchema.statics.resetExhaustedKeys = async function (service) {
  return this.updateMany(
    { service, status: "exhausted" },
    { status: "active", last_error: "" }
  );
};

export default mongoose.model("ApiKey", apiKeySchema);
