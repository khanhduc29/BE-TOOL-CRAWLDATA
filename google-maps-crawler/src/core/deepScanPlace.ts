import { Page } from "playwright";
import { Place } from "../types/place";

/**
 * Quét sâu Google Maps place detail
 */
export async function deepScanPlace(
  page: Page,
  place: Place
): Promise<Place> {
  console.log(`🧠 Deep scan place: ${place.name}`);

  if (!place.url) return place;

  await page.goto(place.url, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });

  const description = await page
    .locator('[data-item-id="about"]')
    .first()
    .textContent()
    .catch(() => null);

  return {
    ...place,
    description: description?.trim() || undefined,
  };
}