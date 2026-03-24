import express from "express";
import { autoRegisterWorker } from "../middleware/autoRegisterWorker.js";
import { createTikTokScanController, getLatestTikTokTask, getPendingTikTokTask, updateTikTokTask, getAllTikTokTasks } from "../controllers/tiktok.controller.js";

const router = express.Router();

router.post("/scan", createTikTokScanController);
router.get("/task/pending", autoRegisterWorker("tiktok"), getPendingTikTokTask);
router.patch("/task/:id", updateTikTokTask);
// 🔥 FE lấy task mới nhất
router.get("/task/latest", getLatestTikTokTask);
// 📜 FE lấy lịch sử tasks
router.get("/tasks", getAllTikTokTasks);

export default router;