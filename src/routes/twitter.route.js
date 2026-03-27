import express from "express";
import { autoRegisterWorker } from "../middleware/autoRegisterWorker.js";
import { createTwitterScanController, getLatestTwitterTask, getPendingTwitterTask, updateTwitterTask, getAllTwitterTasks } from "../controllers/twitter.controller.js";

const router = express.Router();

router.post("/scan", createTwitterScanController);
router.get("/task/pending", autoRegisterWorker("twitter"), getPendingTwitterTask);
router.patch("/task/:id", updateTwitterTask);
// 🔥 FE lấy task mới nhất
router.get("/task/latest", getLatestTwitterTask);
// 📜 FE lấy lịch sử tasks
router.get("/tasks", getAllTwitterTasks);

export default router;
