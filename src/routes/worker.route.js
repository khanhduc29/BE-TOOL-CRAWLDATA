import express from "express";
import { startWorker, stopWorker, getWorkers } from "../workers/workerManager.js";
import {
  registerWorker,
  unregisterWorker,
  listWorkers,
  workerHeartbeat,
} from "../controllers/worker.controller.js";

const router = express.Router();

// ─── New: Worker Registration ───
router.post("/register", registerWorker);
router.delete("/:worker_id", unregisterWorker);
router.get("/list", listWorkers);
router.post("/heartbeat", workerHeartbeat);

// ─── Legacy: GUI worker management ───
router.get("/", (req, res) => {
  res.json(getWorkers());
});

router.post("/start", (req, res) => {
  const { name } = req.body;

  // mapping worker
  if (name === "youtube") {
    startWorker("youtube", "python", "../Tool-youtube/main.py");
  }

  res.json({ success: true });
});

router.post("/stop", (req, res) => {
  const { name } = req.body;
  stopWorker(name);
  res.json({ success: true });
});

export default router;