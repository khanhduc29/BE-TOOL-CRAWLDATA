import { getMultipleTasks } from "../api/crawlTask.api";
import { processTask } from "./processTask";
import { delay } from "../utils/delay";
import { closeBrowser } from "../config/browser";

const MAX_PARALLEL = 3;   // Chạy tối đa 3 task đồng thời
const POLL_INTERVAL = 10000; // Poll mỗi 10 giây

export async function startTaskQueue() {
  console.log(`📡 Task queue started (parallel=${MAX_PARALLEL})`);

  while (true) {
    try {
      // Lấy tối đa MAX_PARALLEL task pending
      console.log("🔍 Polling for tasks...");
      const tasks = await getMultipleTasks(MAX_PARALLEL);

      if (tasks.length === 0) {
        console.log("😴 No pending task → sleep 10s");
        await closeBrowser(); // Đóng browser khi idle
        await delay(POLL_INTERVAL);
        continue;
      }

      console.log(`📥 Got ${tasks.length} tasks → processing in parallel`);
      tasks.forEach((t, i) => {
        console.log(`  ${i + 1}. ${t._id} | keyword="${t.keyword}" | limit=${t.result_limit}`);
      });

      // Chạy song song tất cả tasks
      const results = await Promise.allSettled(
        tasks.map((task) => processTask(task))
      );

      // Log kết quả
      results.forEach((result, i) => {
        if (result.status === "fulfilled") {
          console.log(`✅ Task ${tasks[i]._id} completed`);
        } else {
          console.error(`❌ Task ${tasks[i]._id} failed:`, result.reason?.message);
        }
      });

    } catch (err: any) {
      console.error("❌ Queue error:", err.message);
      await delay(5000);
    }
  }
}