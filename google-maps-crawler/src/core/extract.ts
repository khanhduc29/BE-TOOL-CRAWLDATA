// src/core/extract.ts
import { Page } from "playwright";
import { Place } from "../types/place";

/**
 * Extract dữ liệu Place từ PANEL ACTIVE của Google Maps
 * (panel cuối cùng trong DOM)
 */
export async function extractPlace(
  page: Page
): Promise<Place> {
  try {
    // 🔥 lấy panel active (panel cuối)
    const data = await page.evaluate(() => {
      const panels = document.querySelectorAll('div.tAiQdd');
      if (!panels.length) return null;

      const panel = panels[panels.length - 1];

      const getText = (selector: string) =>
        panel.querySelector(selector)?.textContent?.trim() || null;

      const name = getText("h1.DUwDvf");
      const address = getText('[data-item-id="address"]');
      const phone = getText('[data-item-id^="phone"]');
      const openingHours = getText('[data-item-id="oh"]');

      const websiteEl = panel.querySelector(
        'a[data-item-id="authority"]'
      ) as HTMLAnchorElement | null;

      const website = websiteEl?.href || null;

      const ratingText =
        panel.querySelector('span[aria-label*="stars"]')
          ?.getAttribute("aria-label") || null;

      const rating = ratingText
        ? parseFloat(
            ratingText.replace(",", ".").match(/\d+(\.\d+)?/)?.[0] || ""
          )
        : null;

      const reviewsText =
        panel.querySelector(
          'button[jsaction*="pane.rating.moreReviews"]'
        )?.textContent || null;

      const totalReviews = reviewsText
        ? parseInt(reviewsText.replace(/\D/g, ""))
        : null;

      return {
        name,
        address,
        phone,
        website,
        rating,
        totalReviews,
        openingHours,
      };
    });

    if (!data || !data.name) {
      throw new Error("No active panel data");
    }

    const place: Place = {
      name: data.name,
      address: data.address,
      phone: data.phone,
      website: data.website,
      rating: data.rating,
      totalReviews: data.totalReviews,
      openingHours: data.openingHours,
      lat: null,
      lng: null,
      url: page.url(),
      crawledAt: new Date().toISOString(),
    };

    console.log(
      `🧩 Extracted: ${place.name} | rating=${place.rating}`
    );

    return place;
  } catch (err: any) {
    console.log("❌ extractPlace failed:", err.message);
    return {
      name: null,
      address: null,
      phone: null,
      website: null,
      rating: null,
      totalReviews: null,
      openingHours: null,
      lat: null,
      lng: null,
      url: page.url(),
      crawledAt: new Date().toISOString(),
    };
  }
}