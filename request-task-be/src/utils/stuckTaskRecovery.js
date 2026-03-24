/**
 * Stuck Task Recovery — tự động reset task bị kẹt
 *
 * Task ở trạng thái "running"/"processing" quá lâu (>10 phút)
 * sẽ được reset về "pending" để robot khác lấy làm.
 *
 * Nếu đã retry quá max_retries → đánh dấu "error" vĩnh viễn.
 */

import TikTokTask from "../models/TikTokTask.model.js";
import TwitterTask from "../models/TwitterTask.model.js";
import YouTubeTask from "../models/YouTubeTask.model.js";
import InstagramTask from "../models/InstagramTask.model.js";
import PinterestTask from "../models/PinterestTask.model.js";
import GoogleMapTask from "../models/GoogleMapTask.model.js";

const STUCK_THRESHOLD_MS = 10 * 60 * 1000; // 10 phút
const CHECK_INTERVAL_MS = 5 * 60 * 1000;   // Chạy mỗi 5 phút

/**
 * Danh sách tất cả Task models + trạng thái "running" tương ứng
 */
const TASK_CONFIGS = [
  { name: "TikTok",    model: TikTokTask,    runningStatus: "running" },
  { name: "Twitter",   model: TwitterTask,   runningStatus: "running" },
  { name: "YouTube",   model: YouTubeTask,   runningStatus: "running" },
  { name: "Instagram", model: InstagramTask, runningStatus: "running" },
  { name: "Pinterest", model: PinterestTask, runningStatus: "running" },
  { name: "GoogleMap", model: GoogleMapTask,  runningStatus: "processing" },
];

async function recoverStuckTasks() {
  const threshold = new Date(Date.now() - STUCK_THRESHOLD_MS);
  let totalReset = 0;
  let totalFailed = 0;

  for (const { name, model, runningStatus } of TASK_CONFIGS) {
    try {
      // 1) Task bị kẹt + còn retry → reset về pending
      const retryResult = await model.updateMany(
        {
          status: runningStatus,
          updatedAt: { $lt: threshold },
          $expr: { $lt: ["$retry_count", { $ifNull: ["$max_retries", 3] }] },
        },
        {
          $set: {
            status: "pending",
            assigned_worker: null,
            updatedAt: new Date(),
          },
          $inc: { retry_count: 1 },
        }
      );

      // 2) Task bị kẹt + hết retry → đánh dấu error vĩnh viễn
      const failResult = await model.updateMany(
        {
          status: runningStatus,
          updatedAt: { $lt: threshold },
          $expr: { $gte: ["$retry_count", { $ifNull: ["$max_retries", 3] }] },
        },
        {
          $set: {
            status: "error",
            error_message: "Task stuck — max retries exceeded",
            last_error: "Task stuck — max retries exceeded",
            updatedAt: new Date(),
          },
        }
      );

      // 3) Cũng xử lý task không có updatedAt (edge case)
      const noDateResult = await model.updateMany(
        {
          status: runningStatus,
          updatedAt: { $exists: false },
        },
        {
          $set: {
            status: "pending",
            assigned_worker: null,
            updatedAt: new Date(),
          },
          $inc: { retry_count: 1 },
        }
      );

      const reset = (retryResult.modifiedCount || 0) + (noDateResult.modifiedCount || 0);
      const failed = failResult.modifiedCount || 0;
      totalReset += reset;
      totalFailed += failed;

      if (reset > 0 || failed > 0) {
        console.log(`🔄 [StuckRecovery] ${name}: reset=${reset}, failed=${failed}`);
      }
    } catch (err) {
      console.error(`❌ [StuckRecovery] ${name} error:`, err.message);
    }
  }

  if (totalReset > 0 || totalFailed > 0) {
    console.log(`🔄 [StuckRecovery] Total: reset=${totalReset} tasks → pending, failed=${totalFailed} tasks → error`);
  }
}

export function startStuckTaskRecovery() {
  console.log("🔄 Stuck task recovery started (interval=5min, threshold=10min)");

  // Chạy ngay lần đầu sau 30s (đợi DB kết nối ổn định)
  setTimeout(() => {
    recoverStuckTasks();
  }, 30 * 1000);

  // Sau đó chạy định kỳ
  setInterval(() => {
    recoverStuckTasks();
  }, CHECK_INTERVAL_MS);
}
