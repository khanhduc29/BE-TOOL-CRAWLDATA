import mongoose from "mongoose";

const WorkerSchema = new mongoose.Schema(
  {
    worker_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    tool: {
      type: String,
      required: true,
      index: true,
    },
    hostname: {
      type: String,
      default: "unknown",
    },
    status: {
      type: String,
      enum: ["online", "offline"],
      default: "online",
    },
    last_heartbeat: {
      type: Date,
      default: Date.now,
    },
    tasks_completed: {
      type: Number,
      default: 0,
    },
    tasks_error: {
      type: Number,
      default: 0,
    },
    config: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

export default mongoose.model("Worker", WorkerSchema);
