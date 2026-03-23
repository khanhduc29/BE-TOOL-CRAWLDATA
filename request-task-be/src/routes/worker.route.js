import express from "express";
import { startWorker, stopWorker, getWorkers } from "../workers/workerManager.js";

const router = express.Router();

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