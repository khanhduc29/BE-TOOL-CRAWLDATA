/**
 * Sync parent Request status after a Task is updated.
 *
 * Logic:
 *  - Count tasks by status for the given request
 *  - If ALL tasks are success → request = "success"
 *  - If ANY task is error and no pending/running → request = "error"
 *  - If ANY task is running/pending → request = "running"
 *
 * @param {Model} TaskModel   - Mongoose Task model (e.g. TikTokTask)
 * @param {Model} RequestModel - Mongoose Request model (e.g. TikTokRequest)
 * @param {string} taskForeignKey - Field name linking task → request (e.g. "request_id" or "job_id")
 * @param {string} requestId - The parent request/job _id
 */
export async function syncRequestStatus(
  TaskModel,
  RequestModel,
  taskForeignKey,
  requestId
) {
  if (!requestId) return;

  try {
    const filter = { [taskForeignKey]: requestId };

    const [totalTasks, successCount, errorCount, pendingCount, runningCount] =
      await Promise.all([
        TaskModel.countDocuments(filter),
        TaskModel.countDocuments({ ...filter, status: "success" }),
        TaskModel.countDocuments({ ...filter, status: "error" }),
        TaskModel.countDocuments({ ...filter, status: "pending" }),
        TaskModel.countDocuments({
          ...filter,
          status: { $in: ["running", "processing"] },
        }),
      ]);

    let requestStatus;

    if (successCount === totalTasks) {
      requestStatus = "success";
    } else if (pendingCount === 0 && runningCount === 0 && errorCount > 0) {
      // All done, but some errored
      requestStatus = errorCount === totalTasks ? "error" : "success";
    } else {
      requestStatus = "running";
    }

    await RequestModel.findByIdAndUpdate(requestId, {
      status: requestStatus,
      total_tasks: totalTasks,
      success_tasks: successCount,
      error_tasks: errorCount,
    });

    console.log(
      `[syncRequestStatus] Request ${requestId}: ${requestStatus} (${successCount}/${totalTasks} success, ${errorCount} error)`
    );
  } catch (err) {
    console.error("[syncRequestStatus] Error:", err.message);
  }
}
