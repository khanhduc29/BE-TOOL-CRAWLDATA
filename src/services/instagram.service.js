import InstagramRequest from "../models/InstagramRequest.model.js";
import InstagramTask from "../models/InstagramTask.model.js";
import { assignWorkersRoundRobin } from "../utils/assignWorker.js";

/**
 * CREATE SCAN
 */
export async function createInstagramScan(data) {
  const { inputs } = data;

  if (!inputs || !Array.isArray(inputs)) {
    throw new Error("inputs is required");
  }

  const request = await InstagramRequest.create({
    payload: data,
  });

  const tasks = inputs.map((input) => ({
    request_id: request._id,
    scan_type: "profile",
    input: {
      url: input.url,
      scan_website: input.scan_website ?? false,
    },
  }));

  await assignWorkersRoundRobin("instagram", tasks);
  const createdTasks = await InstagramTask.insertMany(tasks);

  request.total_tasks = tasks.length;
  await request.save();

  return request;
}

/**
 * GET PENDING TASK
 */
export async function getPendingInstagramTasks(limit = 5, worker_id = null) {
  let task = null;

  // 1) Priority: task assigned to this worker
  if (worker_id) {
    task = await InstagramTask.findOneAndUpdate(
      { status: "pending", assigned_worker: worker_id },
      { status: "running" },
      { sort: { createdAt: 1 }, new: true }
    );
  }

  // 2) Fallback: unassigned pending task
  if (!task) {
    task = await InstagramTask.findOneAndUpdate(
      { status: "pending", $or: [{ assigned_worker: { $exists: false } }, { assigned_worker: "" }, { assigned_worker: null }] },
      { status: "running", ...(worker_id ? { assigned_worker: worker_id } : {}) },
      { sort: { createdAt: 1 }, new: true }
    );
  }

  // 3) Last resort: task assign cho worker khác (offline/sai tool) → lấy luôn
  if (!task) {
    task = await InstagramTask.findOneAndUpdate(
      { status: "pending" },
      { status: "running", ...(worker_id ? { assigned_worker: worker_id } : {}) },
      { sort: { createdAt: 1 }, new: true }
    );
  }

  return task ? [task] : [];
}

/**
 * GET SUCCESS TASK
 */
export async function getSuccessInstagramTasks(limit = 20) {
  return InstagramTask.find({
    status: "success",
  })
    .sort({ updatedAt: -1 })
    .limit(limit);
}

/**
 * UPDATE TASK SUCCESS
 */
export async function updateInstagramTaskSuccess(taskId, results) {
  return InstagramTask.findByIdAndUpdate(
    taskId,
    {
      status: "success",
      result: results,
      finished_at: new Date(),
    },
    { new: true }
  );
}

/**
 * UPDATE TASK ERROR
 */
export async function updateInstagramTaskError(taskId, error) {
  // 🔄 Auto-retry: kiểm tra retry_count trước khi đánh dấu error
  const currentTask = await InstagramTask.findById(taskId);
  if (currentTask) {
    const retryCount = currentTask.retry_count || 0;
    const maxRetries = currentTask.max_retries || 3;

    if (retryCount < maxRetries) {
      console.log(`🔄 Instagram task ${taskId} auto-retry ${retryCount + 1}/${maxRetries} → pending`);
      return InstagramTask.findByIdAndUpdate(
        taskId,
        {
          status: "pending",
          assigned_worker: null,
          last_error: error,
          retry_count: retryCount + 1,
        },
        { new: true }
      );
    }
  }

  return InstagramTask.findByIdAndUpdate(
    taskId,
    {
      status: "error",
      error,
      last_error: error,
      finished_at: new Date(),
    },
    { new: true }
  );
}