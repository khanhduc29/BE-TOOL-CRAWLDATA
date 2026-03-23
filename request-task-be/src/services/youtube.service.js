import YouTubeRequest from "../models/YouTubeRequest.model.js";
import YouTubeTask from "../models/YouTubeTask.model.js";
import { addTaskToQueue } from "./queue.service.js";

export async function createYouTubeScan(data) {
  const { scan_type } = data;

  // 1️⃣ Tạo request
  const request = await YouTubeRequest.create({
    scan_type,
    scan_account: data.scan_account,
    payload: data,
  });

  let tasks = [];

  // 2️⃣ Sinh task theo loại scan
  switch (scan_type) {
    case "channels": {
      tasks.push({
        request_id: request._id,
        scan_type,
        input: {
          keyword: data.keyword,
          limit: data.limit ?? 20,
          deep_scan_social: data.deep_scan_social ?? false,
        },
      });
      break;
    }

    case "videos": {
      tasks.push({
        request_id: request._id,
        scan_type,
        input: {
          keyword: data.keyword,
          limit: data.limit ?? 20,
          published_after: data.published_after,
          region: data.region,
        },
      });
      break;
    }

    case "video_comments": {
      tasks.push({
        request_id: request._id,
        scan_type,
        input: {
          video_url: data.video_url,
          limit_comments: data.limit_comments ?? 100,
          
        },
      });
      break;
    }

    default:
      throw new Error("Unsupported scan_type");
  }

  // 3️⃣ Insert task
  const createdTasks = await YouTubeTask.insertMany(tasks);
  for (const task of createdTasks) {
    addTaskToQueue("youtube", { taskId: task._id.toString(), scan_type: task.scan_type, input: task.input }).catch(() => {});
  }

  request.total_tasks = tasks.length;
  await request.save();

  return request;
}