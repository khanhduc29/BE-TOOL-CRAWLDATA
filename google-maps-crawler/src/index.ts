import "dotenv/config";
import { startTaskQueue } from "./core/taskQueue";

console.log("🚀 CRAWL WORKER STARTED");
console.log(`📅 ${new Date().toISOString()}`);

// Bắt unhandled errors để worker không die im lặng
process.on("unhandledRejection", (err: any) => {
  console.error("❌ UNHANDLED REJECTION:", err?.message || err);
});

process.on("uncaughtException", (err: any) => {
  console.error("❌ UNCAUGHT EXCEPTION:", err?.message || err);
});

startTaskQueue();