import Worker from "../models/Worker.model.js";

/**
 * Middleware: Auto-register/heartbeat worker khi gọi GET /task/pending.
 * 
 * Nếu request có query param `worker_id`, tự động:
 * - Tạo worker nếu chưa tồn tại (upsert)
 * - Cập nhật heartbeat + status = online
 * 
 * Cách dùng: gắn trước route handler
 *   router.get("/task/pending", autoRegisterWorker("tiktok"), getPendingTikTokTask);
 */
export function autoRegisterWorker(tool) {
  return async (req, res, next) => {
    try {
      const worker_id = req.query.worker_id || req.headers["x-worker-id"];
      if (worker_id) {
        await Worker.findOneAndUpdate(
          { worker_id },
          {
            worker_id,
            tool,
            hostname: req.headers["x-hostname"] || req.ip || "unknown",
            status: "online",
            last_heartbeat: new Date(),
          },
          { upsert: true, new: true }
        );
      }
    } catch (err) {
      // Don't block the request if worker registration fails
      console.error(`⚠️ Auto-register worker error: ${err.message}`);
    }
    next();
  };
}
