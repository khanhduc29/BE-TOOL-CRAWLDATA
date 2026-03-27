// import { Page } from "playwright";

// export async function searchKeyword(
//   page: Page,
//   keyword: string,
//   lat: number,
//   lng: number
// ) {
//   console.log(`🔎 Search Google Maps: ${keyword}`);

//   const url = `https://www.google.com/maps/search/${encodeURIComponent(
//     keyword
//   )}/@${lat},${lng},14z`;

//   await page.goto(url, {
//     waitUntil: "domcontentloaded",
//     timeout: 30000,
//   });
// }

import { Page } from "playwright";

export async function searchKeyword(
  page: Page,
  keyword: string,
  address: string
) {

  const query = `${keyword} ${address}`.replace(/\s+/g, " ").trim();

  console.log(`🔎 Search Google Maps: ${query}`);

  const url =
    "https://www.google.com/maps/search/" +
    encodeURIComponent(query);

  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  // đợi maps render
  await page.waitForTimeout(2000);

  // chờ sidebar hoặc place card
  await Promise.race([
    page.waitForSelector('div[role="feed"]', { timeout: 15000 }),
    page.waitForSelector("a.hfpxzc", { timeout: 15000 }),
    page.locator('text=/No results|Không tìm thấy/i').waitFor({ timeout: 15000 }).catch(() => null)
  ]);

}