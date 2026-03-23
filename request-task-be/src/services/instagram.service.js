import InstagramRequest from "../models/InstagramRequest.model.js";
import InstagramTask from "../models/InstagramTask.model.js";
import { addTaskToQueue } from "./queue.service.js";

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

  const createdTasks = await InstagramTask.insertMany(tasks);
  for (const task of createdTasks) {
    addTaskToQueue("instagram", { taskId: task._id.toString(), scan_type: task.scan_type, input: task.input }).catch(() => {});
  }

  request.total_tasks = tasks.length;
  await request.save();

  return request;
}

/**
 * GET PENDING TASK
 */
export async function getPendingInstagramTasks(limit = 5) {
  return InstagramTask.find({
    status: "pending",
  })
    .sort({ createdAt: 1 })
    .limit(limit);
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
  return InstagramTask.findByIdAndUpdate(
    taskId,
    {
      status: "error",
      error,
      finished_at: new Date(),
    },
    { new: true }
  );
}