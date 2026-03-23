import { Queue } from "bullmq";
import { REDIS_URL } from "../config/redis.js";

/**
 * Queue Service — quản lý BullMQ queues cho mỗi tool.
 * Mỗi tool có 1 queue riêng: queue:tiktok, queue:pinterest, ...
 */

const TOOL_NAMES = [
  "tiktok",
  "pinterest",
  "instagram",
  "youtube",
  "twitter",
  "google-map",
  "chplay",
  "appstore",
];

const queues = {};

// Parse redis URL for BullMQ connection
function getRedisOpts() {
  try {
    const url = new URL(REDIS_URL);
    return {
      host: url.hostname || "localhost",
      port: parseInt(url.port) || 6379,
      password: url.password || undefined,
      maxRetriesPerRequest: null,
    };
  } catch {
    return { host: "localhost", port: 6379, maxRetriesPerRequest: null };
  }
}

const redisOpts = getRedisOpts();

// Tạo queue cho mỗi tool
for (const tool of TOOL_NAMES) {
  queues[tool] = new Queue(`queue:${tool}`, {
    connection: redisOpts,
    defaultJobOptions: {
      removeOnComplete: 100, // Giữ 100 jobs gần nhất
      removeOnFail: 200,
      attempts: 1,
    },
  });
}

/**
 * Push task vào queue
 * @param {string} tool - tên tool (tiktok, pinterest, ...)
 * @param {object} taskData - { taskId, scan_type, input }
 */
export async function addTaskToQueue(tool, taskData) {
  const q = queues[tool];
  if (!q) {
    console.warn(`⚠️ Queue không tồn tại cho tool: ${tool}`);
    return null;
  }
  try {
    const job = await q.add("crawl", taskData, {
      jobId: taskData.taskId,
    });
    console.log(`📥 [${tool}] Task pushed to queue: ${taskData.taskId}`);
    return job;
  } catch (err) {
    console.error(`❌ [${tool}] Queue push failed:`, err.message);
    return null;
  }
}

/**
 * Lấy thống kê queue
 * @param {string} tool
 */
export async function getQueueStats(tool) {
  const q = queues[tool];
  if (!q) return null;
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      q.getWaitingCount(),
      q.getActiveCount(),
      q.getCompletedCount(),
      q.getFailedCount(),
    ]);
    return { waiting, active, completed, failed };
  } catch {
    return { waiting: 0, active: 0, completed: 0, failed: 0 };
  }
}

/**
 * Lấy thống kê tất cả queues
 */
export async function getAllQueueStats() {
  const result = {};
  for (const tool of TOOL_NAMES) {
    result[tool] = await getQueueStats(tool);
  }
  return result;
}

export { queues, TOOL_NAMES };
