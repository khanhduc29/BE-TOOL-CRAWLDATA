// src/core/resolveLatLng.ts
import { Page } from "playwright";

/**
 * Resolve latitude & longitude từ Google Maps
 * ÉP vào PLACE page (KHÔNG dùng search)
 */
export async function resolveLatLngFromAddress(
  page: Page,
  address: string
): Promise<{ lat: number; lng: number }> {
  console.log(`📍 Resolving lat/lng for address: "${address}"`);

  // 🔥 ÉP GOOGLE MAPS VÀO PLACE PAGE
  const placeUrl = `https://www.google.com/maps/place/${encodeURIComponent(
    address
  )}`;

  await page.goto(placeUrl, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });

  // ⏳ chờ Maps render & redirect xong
  await page.waitForTimeout(4000);

  const url = page.url();
  console.log("🧪 Maps URL:", url);

  /**
   * URL chuẩn:
   * /maps/place/.../@48.8566,2.3522,...
   */
  const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);

  if (!match) {
    console.warn(
      "⚠️ Cannot resolve lat/lng from PLACE page, fallback to Hanoi"
    );
    return {
      lat: 21.0278,
      lng: 105.8342,
    };
  }

  const lat = parseFloat(match[1]);
  const lng = parseFloat(match[2]);

  console.log(`✅ Resolved lat/lng: ${lat}, ${lng}`);

  return { lat, lng };
}