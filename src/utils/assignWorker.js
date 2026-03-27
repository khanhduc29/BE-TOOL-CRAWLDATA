import { getOnlineWorkerIds } from "../controllers/worker.controller.js";

// Round-robin counter per tool
const counters = {};

/**
 * Assign workers (round-robin) to a list of tasks
 * @param {string} tool - Tool name (tiktok, pinterest, etc.)
 * @param {Array} tasks - Array of task objects to assign
 * @returns {Array} tasks with assigned_worker field set
 */
export async function assignWorkersRoundRobin(tool, tasks) {
  const workerIds = await getOnlineWorkerIds(tool);

  // No workers online — tasks remain unassigned (backward compatible)
  if (!workerIds.length) {
    return tasks;
  }

  // Initialize counter for this tool
  if (!(tool in counters)) {
    counters[tool] = 0;
  }

  // Round-robin assign
  for (const task of tasks) {
    task.assigned_worker = workerIds[counters[tool] % workerIds.length];
    counters[tool]++;
  }

  return tasks;
}
