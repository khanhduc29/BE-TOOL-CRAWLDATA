import { CrawlTask } from "../types/crawlTask";
import { createBrowser } from "../config/browser";
import { searchKeyword } from "./search";
import { crawlWithAutoScroll } from "./crawlWithAutoScroll";
import { updateTask, updatePartialResult } from "../api/crawlTask.api";
import { crawlWebsiteContact } from "./crawlWebsiteContact";
import { crawlReviews } from "./crawlReviews";
import { deepScanPlace } from "./deepScanPlace";

const TASK_TIMEOUT_MS = 15 * 60 * 1000; // 15 phút
const PARTIAL_SAVE_BATCH = 20;           // Lưu tạm mỗi 20 kết quả
const WEBSITE_CONCURRENCY = 3;           // Crawl 3 website đồng thời
const REVIEW_CONCURRENCY = 5;            // Crawl 5 reviews đồng thời
const DEEP_SCAN_CONCURRENCY = 5;         // Deep scan 5 places đồng thời

/**
 * Crawl batch website song song (3 website cùng lúc)
 */
async function batchCrawlWebsites(
  context: any,
  results: any[],
  page: any,
  startIdx: number,
  endIdx: number
) {
  const batch = results.slice(startIdx, endIdx);
  const tasks: Promise<void>[] = [];

  for (let i = 0; i < batch.length; i++) {
    const idx = startIdx + i;
    const place = results[idx];

    tasks.push(
      (async () => {
        let website = place.website;

        // Nếu chưa có website → thử click detail
        if (!website) {
          try {
            const cards = await page.locator('div[role="article"]').all();
            if (cards[idx]) {
              await cards[idx].locator("a.hfpxzc").click();
              await page.waitForSelector(
                'a[data-item-id="authority"]',
                { timeout: 4000 }
              );
              website = await page
                .locator('a[data-item-id="authority"]')
                .first()
                .getAttribute("href");

              if (website) results[idx].website = website;
            }
          } catch {
            // Cannot get website, skip
          }
        }

        // Nếu có website → crawl
        if (website) {
          const webPage = await context.newPage();
          try {
            results[idx].socials = await crawlWebsiteContact(webPage, website);
          } catch (err: any) {
            console.log(`⚠️ Website crawl failed: ${website} — ${err.message}`);
            results[idx].socials = { error: err.message };
          } finally {
            await webPage.close();
          }
        }
      })()
    );

    // Mỗi batch WEBSITE_CONCURRENCY website
    if (tasks.length >= WEBSITE_CONCURRENCY || i === batch.length - 1) {
      await Promise.allSettled(tasks);
      tasks.length = 0;
    }
  }
}

export async function processTask(task: CrawlTask) {

  console.log(`🚀 Start task ${task._id}`);
  console.log(`🧾 keyword="${task.keyword}", address="${task.address}", limit=${task.result_limit}`);

  // ⏰ Timeout protection — NOW ACTUALLY ABORTS
  let isTimedOut = false;
  const timeoutId = setTimeout(() => {
    isTimedOut = true;
    console.error(`⏰ Task ${task._id} TIMEOUT (${TASK_TIMEOUT_MS / 60000} min) → ABORTING`);
  }, TASK_TIMEOUT_MS);

  function checkTimeout() {
    if (isTimedOut) throw new Error("TASK_TIMEOUT");
  }

  let context: any = null;

  try {

    /**
     * 1️⃣ Open browser context
     */
    context = await createBrowser();
    const page = await context.newPage();

    /**
     * 2️⃣ Search Google Maps
     */
    await searchKeyword(
      page,
      task.keyword,
      task.address
    );

    checkTimeout();

    /**
     * 3️⃣ Crawl places (scroll + extract)
     */
    const results = await crawlWithAutoScroll(
      page,
      task.result_limit
    );

    checkTimeout();

    /**
     * 4️⃣ Partial save after scroll
     */
    if (results.length > 0) {
      await updatePartialResult(task._id, results);
    }

    /**
     * 5️⃣ Deep scan websites (parallel batches)
     */
    if (task.deep_scan_website && results.length > 0) {

      console.log(`🌐 Deep scan website ENABLED | ${results.length} places`);

      for (let i = 0; i < results.length; i += WEBSITE_CONCURRENCY) {
        checkTimeout();

        const end = Math.min(i + WEBSITE_CONCURRENCY, results.length);

        await batchCrawlWebsites(context, results, page, i, end);

        console.log(`🌐 Website batch ${i + 1}-${end}/${results.length} done`);

        // Partial save mỗi PARTIAL_SAVE_BATCH
        if (end % PARTIAL_SAVE_BATCH === 0 || end === results.length) {
          await updatePartialResult(task._id, results);
        }
      }
    }

    /**
     * 6️⃣ Deep scan reviews — PARALLEL BATCHES (5 cùng lúc)
     */
    if (task.deep_scan_reviews && results.length > 0) {

      console.log(`⭐ Deep scan reviews ENABLED | ${results.length} places | concurrency=${REVIEW_CONCURRENCY}`);

      for (let i = 0; i < results.length; i += REVIEW_CONCURRENCY) {
        checkTimeout();

        const batchEnd = Math.min(i + REVIEW_CONCURRENCY, results.length);
        const batchItems = results.slice(i, batchEnd);

        await Promise.allSettled(
          batchItems.map(async (place, batchIdx) => {
            const idx = i + batchIdx;
            if (!results[idx].url) return;

            const reviewPage = await context.newPage();
            try {
              results[idx].reviews = await crawlReviews(
                reviewPage,
                results[idx].url!,
                task.review_limit || 20
              );
              console.log(`⭐ ${idx + 1}/${results.length} ${results[idx].name}: ${results[idx].reviews?.length || 0} reviews`);
            } catch (err: any) {
              console.log(`⚠️ Review crawl failed: ${results[idx].name} — ${err.message}`);
            } finally {
              await reviewPage.close();
            }
          })
        );

        // Partial save mỗi batch
        await updatePartialResult(task._id, results);

        console.log(`⭐ Review batch ${i + 1}-${batchEnd}/${results.length} done`);
      }
    }

    /**
     * 7️⃣ Deep scan Google Maps places — PARALLEL BATCHES
     */
    if (task.deep_scan) {

      console.log(`🧠 Deep scan place detail ENABLED | concurrency=${DEEP_SCAN_CONCURRENCY}`);

      for (let i = 0; i < results.length; i += DEEP_SCAN_CONCURRENCY) {
        checkTimeout();

        const batchEnd = Math.min(i + DEEP_SCAN_CONCURRENCY, results.length);

        await Promise.allSettled(
          results.slice(i, batchEnd).map(async (place, batchIdx) => {
            const idx = i + batchIdx;
            const detailPage = await context.newPage();
            try {
              results[idx] = await deepScanPlace(detailPage, results[idx]);
            } catch (err: any) {
              console.log(`⚠️ Deep scan failed: ${results[idx].name} — ${err.message}`);
            } finally {
              await detailPage.close();
            }
          })
        );
      }
    }

    await context.close();

    /**
     * 8️⃣ Update task → success
     */
    await updateTask(task._id, {
      status: "success",
      result: results,
    });

    console.log(`✅ Task ${task._id} success | result=${results.length}`);

  } catch (err: any) {

    console.error(`❌ Task ${task._id} error`, err.message);

    // Đóng browser context nếu còn mở
    try { await context?.close(); } catch {}

    await updateTask(task._id, {
      status: "error",
      error_message: err.message,
    });

  } finally {
    clearTimeout(timeoutId);
  }
}