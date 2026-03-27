import GoogleMapJob from "../models/GoogleMapJob.model.js";
import GoogleMapTask from "../models/GoogleMapTask.model.js";
import { assignWorkersRoundRobin } from "../utils/assignWorker.js";

export async function createGoogleMapJob(data) {
  if (!data?.raw_keywords) {
    throw new Error("raw_keywords is required");
  }

  // 1️⃣ tạo job
  const job = await GoogleMapJob.create({
    raw_keywords: data.raw_keywords,
    address: data.address,
    region: data.region,
    result_limit: data.result_limit,
    delay_seconds: data.delay_seconds,
    deep_scan: data.deep_scan,
    deep_scan_website: data.deep_scan_website,
    deep_scan_reviews: data.deep_scan_reviews,
    review_limit: data.review_limit,
    review_filter_stars: data.review_filter_stars || [],
    userId: data.userId,
  });

  // 2️⃣ tách keyword
  const keywords = data.raw_keywords
    .split("\n")
    .map(k => k.trim())
    .filter(Boolean);

  if (keywords.length === 0) {
    throw new Error("No valid keywords");
  }

  // 3️⃣ chia limit theo keyword
  const totalLimit = data.result_limit;
  const baseLimit = Math.floor(totalLimit / keywords.length);
  const remain = totalLimit % keywords.length;

  const tasks = keywords.map((keyword, index) => ({
    job_id: job._id,
    keyword,
    address: data.address,
    region: data.region,

    // 👉 keyword đầu ăn phần dư
    result_limit: index === 0 ? baseLimit + remain : baseLimit,

    delay_seconds: data.delay_seconds,
    deep_scan: data.deep_scan,
    deep_scan_website: data.deep_scan_website,
    deep_scan_reviews: data.deep_scan_reviews,
    review_limit: data.review_limit,
    review_filter_stars: data.review_filter_stars || [],
  }));

  // 4️⃣ tạo task
  await assignWorkersRoundRobin("google-map", tasks);
  const createdTasks = await GoogleMapTask.insertMany(tasks);

  job.total_tasks = tasks.length;
  await job.save();

  return job;
}