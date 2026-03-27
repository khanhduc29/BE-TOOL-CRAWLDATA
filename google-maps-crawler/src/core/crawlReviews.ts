import { Page } from "playwright";

export interface Review {
  reviewer: string;
  rating: number | null;
  text: string | null;
  date: string | null;
  photos: number;
}

/**
 * Dismiss Google consent dialog if present
 */
async function dismissConsent(page: Page) {
  try {
    // Google consent "Accept all" button
    const consentBtn = page.locator('button:has-text("Accept all"), button:has-text("Chấp nhận tất cả"), button:has-text("Tout accepter")');
    if (await consentBtn.count() > 0) {
      await consentBtn.first().click();
      await page.waitForTimeout(1000);
      console.log("🍪 Dismissed consent dialog");
    }
  } catch {
    // No consent dialog, continue
  }
}

/**
 * Click sort dropdown và chọn sort option phù hợp
 * Google Maps sort options: Most relevant, Newest, Highest rating, Lowest rating
 */
async function sortReviews(page: Page, filterStars: number[]) {
  try {
    // Tìm nút Sort (menu button trong review panel)
    const sortBtn = page.locator('button[aria-label*="Sort"], button[data-value="Sort"]');
    if (await sortBtn.count() === 0) {
      // Fallback: tìm nút sort khác
      const altSort = page.locator('.m6QErb button[aria-label*="sort" i], button.g88MCb');
      if (await altSort.count() > 0) {
        await altSort.first().click();
      } else {
        console.log("⚠️ Sort button not found — skipping sort");
        return;
      }
    } else {
      await sortBtn.first().click();
    }

    await page.waitForTimeout(1000);

    // Chọn sort option dựa trên filter stars
    // Nếu chỉ lọc sao thấp (1, 2) → sort "Lowest rating" để tìm nhanh
    // Nếu chỉ lọc sao cao (4, 5) → sort "Highest rating"
    // Nếu lọc mixed → sort "Newest" (mặc định hợp lý)
    const avgStar = filterStars.reduce((a, b) => a + b, 0) / filterStars.length;

    let sortOption: string;
    if (avgStar <= 2.5) {
      sortOption = "Lowest rating";
    } else if (avgStar >= 3.5) {
      sortOption = "Highest rating";
    } else {
      sortOption = "Newest";
    }

    const menuItem = page.locator(`[role="menuitemradio"], [data-index]`).filter({
      has: page.locator(`text=/${sortOption}/i`),
    });

    if (await menuItem.count() > 0) {
      await menuItem.first().click();
      console.log(`🔄 Sorted reviews by: ${sortOption}`);
      await page.waitForTimeout(2000);
    } else {
      // Fallback: click bất kỳ menu item nào match
      const fallback = page.locator(`text=/${sortOption}/i`);
      if (await fallback.count() > 0) {
        await fallback.first().click();
        console.log(`🔄 Sorted reviews by: ${sortOption} (fallback)`);
        await page.waitForTimeout(2000);
      } else {
        console.log(`⚠️ Sort option '${sortOption}' not found`);
        // Close menu
        await page.keyboard.press("Escape");
      }
    }
  } catch (err: any) {
    console.log(`⚠️ Sort reviews failed: ${err.message}`);
  }
}

/**
 * Crawl đánh giá (reviews) từ Google Maps place detail
 * Selectors verified 2026-03-17:
 *   - Review wrapper: div.jftiEf
 *   - Name: .d4r55
 *   - Stars: span.kvMYC (aria-label)
 *   - Text: .wiI7pd
 *   - Date: .rsqaWe
 *   - Expand: button.w8Bnu
 *
 * @param filterStars - Mảng số sao cần lọc, VD: [1, 2] = chỉ lấy 1⭐ và 2⭐. Rỗng = lấy tất cả.
 */
export async function crawlReviews(
  page: Page,
  placeUrl: string,
  maxReviews: number = 20,
  filterStars: number[] = []
): Promise<Review[]> {

  const hasFilter = filterStars.length > 0;
  console.log(`⭐ Crawl reviews: ${placeUrl}${hasFilter ? ` (filter: ${filterStars.join(",")}⭐)` : ""}`);

  const reviews: Review[] = [];

  try {
    // 1. Navigate to place
    await page.goto(placeUrl, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    await page.waitForTimeout(2000);

    // 1b. Dismiss consent dialog if present
    await dismissConsent(page);

    // 2. Click tab "Reviews"
    const reviewTab = page.locator('button[role="tab"]').filter({
      has: page.locator('text=/Reviews|Đánh giá|review/i'),
    });

    const tabCount = await reviewTab.count();
    console.log(`⭐ Found ${tabCount} review tab(s)`);

    if (tabCount === 0) {
      // Fallback: try aria-label
      const altTab = page.locator('button[aria-label*="Review"]');
      const altCount = await altTab.count();
      console.log(`⭐ Fallback: found ${altCount} aria-label review tab(s)`);

      if (altCount > 0) {
        await altTab.first().click();
      } else {
        console.log("⚠️ No Reviews tab found — skipping");
        return [];
      }
    } else {
      await reviewTab.first().click();
    }

    await page.waitForTimeout(1500);

    // 3. Wait for reviews to load
    const hasReviews = await page.waitForSelector("div.jftiEf", { timeout: 8000 }).catch(() => null);

    if (!hasReviews) {
      console.log("⚠️ No review elements loaded (div.jftiEf not found)");
      return [];
    }

    // 3b. Sort reviews nếu có filter
    if (hasFilter) {
      await sortReviews(page, filterStars);
    }

    const initialCount = await page.$$eval("div.jftiEf", (els) => els.length);
    console.log(`⭐ Initial review elements: ${initialCount}`);

    // 4. Scroll to load more reviews (tăng scroll rounds nếu có filter vì cần lọc)
    const maxScrollRounds = hasFilter ? 8 : 3;

    for (let round = 0; round < maxScrollRounds; round++) {
      if (reviews.length >= maxReviews) break;

      const currentCount = await page.$$eval("div.jftiEf", (els) => els.length);

      // Extract reviews từ batch hiện tại
      const reviewEls = await page.$$("div.jftiEf");

      for (let i = reviews.length; i < reviewEls.length; i++) {
        if (reviews.length >= maxReviews) break;

        try {
          // Expand truncated review text trước khi extract
          const expandBtn = await reviewEls[i].$("button.w8nwRe");
          if (expandBtn) {
            await expandBtn.click().catch(() => {});
            await page.waitForTimeout(200);
          }

          const data = await reviewEls[i].evaluate((el) => {
            // Reviewer name
            const nameEl = el.querySelector(".d4r55");
            const reviewer = nameEl?.textContent?.trim() || "Unknown";

            // Rating (stars) from aria-label
            const starsEl = el.querySelector("span.kvMYC") ||
                            el.querySelector('span[role="img"]');
            const starsLabel = starsEl?.getAttribute("aria-label") || "";
            const ratingMatch = starsLabel.match(/(\d+)/);
            const rating = ratingMatch ? parseInt(ratingMatch[1]) : null;

            // Review text
            const textEl = el.querySelector(".wiI7pd");
            const text = textEl?.textContent?.trim() || null;

            // Date
            const dateEl = el.querySelector(".rsqaWe");
            const date = dateEl?.textContent?.trim() || null;

            // Photo count
            const photoEls = el.querySelectorAll("button.Tya61d");
            const photos = photoEls.length;

            return { reviewer, rating, text, date, photos };
          });

          // Filter theo số sao nếu có
          if (hasFilter) {
            if (data.rating !== null && filterStars.includes(data.rating)) {
              reviews.push(data);
              console.log(`⭐ [${reviews.length}/${maxReviews}] ${data.reviewer}: ${data.rating}⭐ ✅`);
            }
            // Skip nếu không match filter
          } else {
            reviews.push(data);
          }
        } catch {
          continue;
        }
      }

      if (reviews.length >= maxReviews) break;

      // Scroll the reviews container
      await page.evaluate(() => {
        const containers = document.querySelectorAll("div.m6QErb.DxyBCb.kA9KIf.dS8AEf");
        const container = containers[containers.length - 1];
        if (container) container.scrollTop = container.scrollHeight;
      });

      await page.waitForTimeout(1200);

      const newCount = await page.$$eval("div.jftiEf", (els) => els.length);
      if (newCount === currentCount) {
        console.log(`⭐ No more reviews to load (stuck at ${newCount})`);
        break;
      }
    }

    console.log(`⭐ Extracted ${reviews.length} reviews${hasFilter ? ` (filtered: ${filterStars.join(",")}⭐)` : ""}`);

  } catch (err: any) {
    console.log(`⚠️ Review crawl error: ${err.message}`);
  }

  return reviews;
}
