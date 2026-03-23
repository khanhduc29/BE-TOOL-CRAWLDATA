import axios from "axios";
import { CrawlTask } from "../types/crawlTask";

const API_BASE = (process.env.API_BASE_URL || "http://localhost:3000") + "/api";
const WORKER_ID = process.env.WORKER_ID || "";

/**
 * Lấy nhiều Google Map task pending từ BE (cho parallel processing)
 */
export async function getMultipleTasks(limit: number = 3): Promise<CrawlTask[]> {
  const tasks: CrawlTask[] = [];

  for (let i = 0; i < limit; i++) {
    try {
      const res = await axios.get(
        `${API_BASE}/google-map/task/pending`,
        { params: WORKER_ID ? { worker_id: WORKER_ID } : {} }
      );

      const task: CrawlTask | null = res.data?.data ?? null;
      if (!task) break;

      tasks.push(task);
    } catch {
      break;
    }
  }

  return tasks;
}

/**
 * Lấy 1 Google Map task pending (backward compatible)
 */
export async function getNextTask(): Promise<CrawlTask | null> {
  const res = await axios.get(
    `${API_BASE}/google-map/task/pending`,
    { params: WORKER_ID ? { worker_id: WORKER_ID } : {} }
  );

  const task: CrawlTask | null = res.data?.data ?? null;

  if (!task) {
    console.log("⏳ No pending Google Map task");
    return null;
  }

  console.log(
    "📥 Picked Google Map task:",
    task._id,
    task.keyword
  );

  return task;
}

/**
 * Update Google Map task (success / error)
 */
export async function updateTask(
  taskId: string,
  payload: {
    status: "success" | "error";
    result?: any[];
    error_message?: string;
  }
): Promise<void> {
  await axios.patch(
    `${API_BASE}/google-map/task/${taskId}`,
    payload
  );
}

/**
 * Lưu kết quả tạm (partial) để không mất data khi crash
 */
export async function updatePartialResult(
  taskId: string,
  partialResult: any[]
): Promise<void> {
  try {
    await axios.patch(
      `${API_BASE}/google-map/task/${taskId}/partial`,
      { partial_result: partialResult }
    );
    console.log(`💾 Saved partial result: ${partialResult.length} items`);
  } catch (err: any) {
    console.log(`⚠️ Partial save failed: ${err.message}`);
  }
}