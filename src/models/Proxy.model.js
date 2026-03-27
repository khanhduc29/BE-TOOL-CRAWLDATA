import mongoose from "mongoose";

const ProxySchema = new mongoose.Schema(
  {
    host: {
      type: String,
      required: true,
    },

    port: {
      type: Number,
      required: true,
    },

    username: {
      type: String,
      default: "",
    },

    password: {
      type: String,
      default: "",
    },

    protocol: {
      type: String,
      enum: ["http", "https", "socks5"],
      default: "http",
    },

    country: {
      type: String,
      default: "",
    },

    city: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: ["active", "inactive", "dead"],
      default: "active",
    },

    label: {
      type: String,
      default: "",
    },

    last_checked: {
      type: Date,
      default: null,
    },

    response_time_ms: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Unique constraint: same host + port
ProxySchema.index({ host: 1, port: 1 }, { unique: true });

export default mongoose.model("Proxy", ProxySchema);
