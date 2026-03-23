import TwitterRequest from "../models/TwitterRequest.model.js";
import TwitterTask from "../models/TwitterTask.model.js";
import { assignWorkersRoundRobin } from "../utils/assignWorker.js";

export async function createTwitterScan(data) {
  const { scan_type } = data;

  // 1. Tạo request
  const request = await TwitterRequest.create({
    scan_type,
    scan_account: data.scan_account || "default",
    payload: data,
  });

  let tasks = [];

  // 2. Sinh task theo từng loại scan
  switch (scan_type) {
    case "posts": {
      tasks.push({
        request_id: request._id,
        scan_type,
        input: {
          keyword: data.keyword,
          limit: data.limit || 50,
          sort_by: data.sort_by || "latest",
          delay_range: data.delay_range,
        },
      });
      break;
    }

    case "users": {
      tasks.push({
        request_id: request._id,
        scan_type,
        input: {
          keyword: data.keyword,
          limit: data.limit || 50,
          delay_range: data.delay_range,
        },
      });
      break;
    }

    case "replies": {
      tasks.push({
        request_id: request._id,
        scan_type,
        input: {
          tweet_url: data.tweet_url,
          limit: data.limit || 100,
          delay_range: data.delay_range,
        },
      });
      break;
    }

    default:
      throw new Error("Unsupported scan_type");
  }

  // 3. Insert tasks
  await assignWorkersRoundRobin("twitter", tasks);
  const createdTasks = await TwitterTask.insertMany(tasks);

  request.total_tasks = tasks.length;
  await request.save();

  return request;
}
