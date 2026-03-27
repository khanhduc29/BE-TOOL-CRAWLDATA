/**
 * Increment tasks_completed counter for a worker.
 * Called whenever a task finishes (success or final error).
 */
import Worker from "../models/Worker.model.js";

export async function incrementWorkerTaskCount(worker_id) {
  if (!worker_id) return;

  try {
    await Worker.findOneAndUpdate(
      { worker_id },
      { $inc: { tasks_completed: 1 } }
    );
  } catch (err) {
    console.error(`⚠️ Failed to increment tasks_completed for ${worker_id}:`, err.message);
  }
}

export async function incrementWorkerErrorCount(worker_id) {
  if (!worker_id) return;

  try {
    await Worker.findOneAndUpdate(
      { worker_id },
      { $inc: { tasks_error: 1 } }
    );
  } catch (err) {
    console.error(`⚠️ Failed to increment tasks_error for ${worker_id}:`, err.message);
  }
}
