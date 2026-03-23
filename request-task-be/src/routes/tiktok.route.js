import express from "express";
import { createTikTokScanController, getLatestTikTokTask, getPendingTikTokTask, updateTikTokTask } from "../controllers/tiktok.controller.js";

const router = express.Router();

router.post("/scan", createTikTokScanController);
router.get("/task/pending", getPendingTikTokTask);
router.patch("/task/:id", updateTikTokTask);
// 🔥 FE lấy task mới nhất
router.get("/task/latest", getLatestTikTokTask);

export default router;