import express from "express";
import { autoRegisterWorker } from "../middleware/autoRegisterWorker.js";
import { createTikTokScanController, getLatestTikTokTask, getPendingTikTokTask, updateTikTokTask } from "../controllers/tiktok.controller.js";

const router = express.Router();

router.post("/scan", createTikTokScanController);
router.get("/task/pending", autoRegisterWorker("tiktok"), getPendingTikTokTask);
router.patch("/task/:id", updateTikTokTask);
// 🔥 FE lấy task mới nhất
router.get("/task/latest", getLatestTikTokTask);

export default router;