import { ElementHandle } from "playwright";
import { Place } from "../types/place";

/**
 * Extract Place từ GOOGLE MAPS CARD (LIST VIEW)
 * - Không click
 * - Không phụ thuộc thứ tự DOM
 * - Semantic + regex
 */
export async function extractPlaceFromCard(
  card: ElementHandle<Element>
): Promise<Place | null> {
  return await card.evaluate((el) => {
    const text = (e: Element | null) =>
      e?.textContent?.trim() || null;

    // 🔹 NAME (ổn định nhất)
    const name =
      text(el.querySelector(".qBF1Pd.fontHeadlineSmall")) ||
      text(el.querySelector('[role="heading"]'));

    // 🔹 Rating + review (aria-label)
    const ratingLabel =
      el
        .querySelector('span[aria-label*="sao"], span[aria-label*="star"]')
        ?.getAttribute("aria-label") || null;

    let rating: number | null = null;
    let totalReviews: number | null = null;

    if (ratingLabel) {
      const r = ratingLabel.replace(",", ".").match(/\d+(\.\d+)?/);
      rating = r ? parseFloat(r[0]) : null;
    }

    // Tìm totalReviews từ nhiều nguồn
    // 1. Từ aria-label: "4.5 sao 120 đánh giá" hoặc "4.5 stars (120)"
    if (ratingLabel) {
      const rv = ratingLabel.match(/\((\d[\d,.]*)\)|(\d[\d,.]+)\s*(đánh giá|review|avis)/i);
      totalReviews = rv ? parseInt((rv[1] || rv[2]).replace(/[,.]/g, "")) : null;
    }

    // 2. Từ element riêng chứa review count (class UY7F9 hoặc text có dạng "(123)")
    if (!totalReviews) {
      const reviewCountEl = el.querySelector(".UY7F9");
      const reviewCountText = reviewCountEl?.textContent?.trim() || "";
      const countMatch = reviewCountText.replace(/[,.]/g, "").match(/\d+/);
      if (countMatch) totalReviews = parseInt(countMatch[0]);
    }

    // 3. Fallback: tìm text dạng "(123)" gần rating
    if (!totalReviews) {
      const allSpans = Array.from(el.querySelectorAll("span"));
      for (const span of allSpans) {
        const t = span.textContent?.trim() || "";
        const m = t.match(/^\((\d[\d,.]*)\)$/);
        if (m) {
          totalReviews = parseInt(m[1].replace(/[,.]/g, ""));
          break;
        }
      }
    }

    // 🔹 Website (semantic)
    const website =
      (el.querySelector(
        'a[data-value="Trang web"], a[data-value="Website"]'
      ) as HTMLAnchorElement | null)?.href || null;

    // 🔹 Phone (pattern-based)
    const phone =
      Array.from(el.querySelectorAll("span"))
        .map((s) => s.textContent?.trim())
        .find((t) => t?.startsWith("+")) || null;

    // 🔹 Address (heuristic – France + global)
    const texts = Array.from(el.querySelectorAll("span"))
      .map((s) => s.textContent?.trim())
      .filter(Boolean);

    const address =
      texts.find((t) =>
        /\d+.*(Rue|Avenue|Av\.|Boulevard|Bd|Street|Road|St)/i.test(t)
      ) || null;

    return {
      name,
      address,
      phone,
      website,
      rating,
      totalReviews,
      openingHours: null,
      lat: null,
      lng: null,
      url: null,
      crawledAt: new Date().toISOString(),
    };
  });
}