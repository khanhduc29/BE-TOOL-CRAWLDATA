import TikTokRequest from "../models/TikTokRequest.model.js";
import TikTokTask from "../models/TikTokTask.model.js";
import { assignWorkersRoundRobin } from "../utils/assignWorker.js";

export async function createTikTokScan(data) {
  const { scan_type } = data;

  // 1. tạo request
  const request = await TikTokRequest.create({
    scan_type,
    scan_account: data.scan_account,
    payload: data,
    userId: data.userId,
  });

  let tasks = [];

  // 2. sinh task theo từng loại scan
  switch (scan_type) {
    case "relations": {
      tasks.push({
        request_id: request._id,
        scan_type,
        input: {
          target_username: data.target_username,
          followers_limit: data.followers_limit,
          following_limit: data.following_limit,
          calculate_friends: data.calculate_friends,
          delay_range: data.delay_range,
          batch_size: data.batch_size,
          batch_delay: data.batch_delay,
          friends_limit: data.friends_limit ?? 50,
        },
      });
      break;
    }

    case "top_posts": {
      tasks.push({
        request_id: request._id,
        scan_type,
        input: {
          keyword: data.keyword,
          sort_by: data.sort_by,
          limit: data.limit,
          deep_scan: data.deep_scan,
          delay_range: data.delay_range,
          batch_size: data.batch_size,
          batch_delay: data.batch_delay,
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
          limit: data.limit,
          deep_scan: data.deep_scan,
          delay_range: data.delay_range,
          batch_size: data.batch_size,
          batch_delay: data.batch_delay,
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
          limit_comments: data.limit_comments,
          deep_scan_profile: data.deep_scan_profile,
          delay_range: data.delay_range,
          batch_size: data.batch_size,
          batch_delay: data.batch_delay,
        },
      });
      break;
    }

    default:
      throw new Error("Unsupported scan_type");
  }

  // 3. assign workers (round-robin)
  await assignWorkersRoundRobin("tiktok", tasks);

  const createdTasks = await TikTokTask.insertMany(tasks);

  request.total_tasks = tasks.length;
  await request.save();

  return request;
}