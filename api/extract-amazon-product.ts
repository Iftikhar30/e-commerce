import type { IncomingMessage, ServerResponse } from "http";
import { GoogleGenAI } from "@google/genai";

function extractAsin(url: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:\/dp\/|\/gp\/product\/|\/exec\/obidos\/asin\/|\/d\/|ASIN=|\/)([A-Z0-9]{10})(?:[/?&#]|$)/i);
  return match ? match[1].toUpperCase() : null;
}

function getAmazonAsinImageCandidates(asin: string): string[] {
  return [
    `https://images-na.ssl-images-amazon.com/images/P/${asin}.01.MAIN._SCRM_.jpg`,
    `https://images-na.ssl-images-amazon.com/images/P/${asin}.01._SCLZZZZZZZ_SX600_.jpg`,
    `https://images-na.ssl-images-amazon.com/images/P/${asin}.01.MAIN._SL800_.jpg`,
    `https://images-na.ssl-images-amazon.com/images/P/${asin}.01.PT01._SCRM_.jpg`,
    `https://images-na.ssl-images-amazon.com/images/P/${asin}.01.PT02._SCRM_.jpg`,
    `https://images-na.ssl-images-amazon.com/images/P/${asin}.01.PT03._SCRM_.jpg`,
    `https://m.media-amazon.com/images/P/${asin}.01._SCRM_.jpg`,
  ];
}

// Extract product title from URL slug if HTML is blocked by bot detection
function extractTitleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const parts = pathname.split("/").filter(Boolean);
    for (const part of parts) {
      if (part !== "dp" && part !== "gp" && part !== "product" && part !== "d" && part.length > 5 && !/^[A-Z0-9]{10}$/i.test(part)) {
        const readable = decodeURIComponent(part)
          .replace(/[-_+]/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());
        if (readable.length > 5) {
          return readable;
        }
      }
    }
  } catch {
    // ignore
  }
  return "";
}

export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  try {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        // ignore
      }
    }

    const rawUrl = body?.url || req.query?.url;
    if (!rawUrl || typeof rawUrl !== "string") {
      return res.status(400).json({ error: "Missing or invalid Amazon URL" });
    }

    let targetUrl = rawUrl.trim();
    let asin = extractAsin(targetUrl);

    // If short URL (amzn.to, a.co), resolve redirect
    if (!asin && (targetUrl.includes("amzn.to") || targetUrl.includes("a.co") || !targetUrl.includes("/dp/"))) {
      try {
        const redirectController = new AbortController();
        const redirectTimeout = setTimeout(() => redirectController.abort(), 3500);
        const redirectResp = await fetch(targetUrl, {
          method: "GET",
          redirect: "follow",
          signal: redirectController.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          },
        });
        clearTimeout(redirectTimeout);
        if (redirectResp.url) {
          targetUrl = redirectResp.url;
          asin = extractAsin(targetUrl) || asin;
        }
      } catch {
        // ignore redirect error
      }
    }

    const cleanUrl = asin ? `https://www.amazon.com/dp/${asin}` : targetUrl;
    const urlTitleFallback = extractTitleFromUrl(targetUrl);
    const imageCandidates: string[] = [];

    if (asin) {
      imageCandidates.push(...getAmazonAsinImageCandidates(asin));
    }

    let fetchedHtml = "";
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      const pageResp = await fetch(cleanUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      clearTimeout(timeout);
      if (pageResp.ok) {
        fetchedHtml = await pageResp.text();
      }
    } catch {
      // Direct fetch fallback
    }

    if (fetchedHtml) {
      const dynamicImageDictMatches = fetchedHtml.matchAll(/data-a-dynamic-image=["'](\{.+?\})["']/gi);
      for (const m of dynamicImageDictMatches) {
        try {
          const rawJson = m[1].replace(/&quot;/g, '"');
          const parsed = JSON.parse(rawJson);
          for (const key of Object.keys(parsed)) {
            if (key.startsWith("http")) imageCandidates.unshift(key);
          }
        } catch {
          // ignore
        }
      }

      const colorImagesMatch = fetchedHtml.match(/["']colorImages['"]\s*:\s*(\{[\s\S]+?\}),\s*["'](?:colorToAsin|itemGauge)/i);
      if (colorImagesMatch) {
        try {
          const parsed = JSON.parse(colorImagesMatch[1]);
          const initialList = parsed.initial || [];
          for (const item of initialList) {
            if (item.hiRes) imageCandidates.unshift(item.hiRes);
            if (item.large) imageCandidates.unshift(item.large);
            if (item.main && typeof item.main === "object") {
              const keys = Object.keys(item.main);
              if (keys.length > 0) imageCandidates.unshift(keys[0]);
            }
          }
        } catch {
          // ignore
        }
      }

      const mediaMatches = fetchedHtml.matchAll(/https:\/\/m\.media-amazon\.com\/images\/I\/[a-zA-Z0-9%_-]+\.(?:jpg|png|webp)/gi);
      for (const match of mediaMatches) {
        const img = match[0];
        if (
          !img.includes("icon") &&
          !img.includes("badge") &&
          !img.includes("play-button") &&
          !img.includes("transparent") &&
          !img.includes("grey-pixel")
        ) {
          imageCandidates.push(img);
        }
      }
    }

    let scrapedTitle = "";
    let scrapedPrice: number | undefined;
    let scrapedOriginalPrice: number | undefined;
    let scrapedRating: number | undefined;
    let scrapedReviewCount: number | undefined;
    let scrapedCategory = "gadgets";

    if (fetchedHtml) {
      const titleMatch =
        fetchedHtml.match(/<span\s+id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i) ||
        fetchedHtml.match(/<h1[^>]*id=["']title["'][^>]*>([\s\S]*?)<\/h1>/i) ||
        fetchedHtml.match(/<meta\s+property=["']og:title["']\s+content=["'](.*?)["']/i);
      if (titleMatch) {
        scrapedTitle = titleMatch[1].replace(/<[^>]*>/g, "").trim();
      }

      const priceMatch =
        fetchedHtml.match(/class=["']a-offscreen["'][^>]*>\s*\$([0-9,]+\.[0-9]{2})/i) ||
        fetchedHtml.match(/id=["'](?:priceblock_ourprice|priceblock_dealprice|price_inside_buybox)["'][^>]*>\s*\$([0-9,]+\.[0-9]{2})/i);
      if (priceMatch) {
        scrapedPrice = parseFloat(priceMatch[1].replace(/,/g, ""));
      }

      const origPriceMatch = fetchedHtml.match(/class=["']basisPrice["'][\s\S]*?class=["']a-offscreen["'][^>]*>\s*\$([0-9,]+\.[0-9]{2})/i);
      if (origPriceMatch) {
        scrapedOriginalPrice = parseFloat(origPriceMatch[1].replace(/,/g, ""));
      }

      const ratingMatch =
        fetchedHtml.match(/([0-5](?:\.[0-9])?)\s+out\s+of\s+5\s+stars/i) ||
        fetchedHtml.match(/class=["']a-icon-alt["'][^>]*>([0-5](?:\.[0-9])?)\s+stars?/i);
      if (ratingMatch) {
        scrapedRating = parseFloat(ratingMatch[1]);
      }

      const reviewMatch =
        fetchedHtml.match(/id=["']acrCustomerReviewText["'][^>]*>([0-9,]+)\s+ratings?/i) ||
        fetchedHtml.match(/([0-9,]+)\s+global\s+ratings/i);
      if (reviewMatch) {
        scrapedReviewCount = parseInt(reviewMatch[1].replace(/,/g, ""), 10);
      }
    }

    const apiKey = (process.env.GEMINI_API_KEY || "").trim();
    let geminiData: {
      title?: string;
      price?: number;
      originalPrice?: number;
      rating?: number;
      reviewCount?: number;
      category?: string;
      images?: string[];
    } = {};

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `Search and extract accurate details for this Amazon product:
URL: ${cleanUrl}
${asin ? `ASIN: ${asin}` : ""}

Extract:
1. Exact product title on Amazon.
2. Current price in USD as a number (e.g. 29.99).
3. Original/List price before discount in USD if available (e.g. 39.99).
4. Star rating (e.g. 4.6).
5. Customer ratings / review count (e.g. 1420).
6. Store Category (one of: "electronics", "gadgets", "audio", "home-smart", "wearables", "accessories", "office", "photography").
7. All high resolution product image URLs found.

Return strictly JSON matching:
{
  "title": "...",
  "price": 29.99,
  "originalPrice": 39.99,
  "rating": 4.6,
  "reviewCount": 1420,
  "category": "gadgets",
  "images": ["https://..."]
}`;

        const candidateModels = [
          { model: "gemini-3.8-flash", tools: [{ googleSearch: {} }] },
          { model: "gemini-3.1-flash-lite", tools: [{ googleSearch: {} }] },
          { model: "gemini-flash-latest", tools: undefined },
        ];

        for (const cand of candidateModels) {
          try {
            const resp = await ai.models.generateContent({
              model: cand.model,
              contents: prompt,
              config: {
                ...(cand.tools ? { tools: cand.tools } : {}),
                responseMimeType: "application/json",
              },
            });

            let raw = resp.text || "";
            if (raw) {
              raw = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
              geminiData = JSON.parse(raw);
              if (geminiData.title || geminiData.images?.length) {
                break;
              }
            }
          } catch {
            // try next model
          }
        }
      } catch {
        // fallback to scraped
      }
    }

    if (geminiData.images && Array.isArray(geminiData.images)) {
      imageCandidates.unshift(...geminiData.images);
    }

    const cleanedImages = Array.from(
      new Set(
        imageCandidates.filter(
          (img) =>
            typeof img === "string" &&
            img.startsWith("http") &&
            !img.includes("sprite") &&
            !img.includes("grey-pixel") &&
            !img.includes("transparent")
        )
      )
    ).slice(0, 10);

    const finalTitle =
      geminiData.title ||
      scrapedTitle ||
      urlTitleFallback ||
      (asin ? `Amazon Product (${asin})` : "Amazon Product");
    const finalPrice = geminiData.price ?? scrapedPrice ?? undefined;
    const finalOriginalPrice = geminiData.originalPrice ?? scrapedOriginalPrice ?? undefined;
    const finalRating = geminiData.rating ?? scrapedRating ?? 4.6;
    const finalReviewCount = geminiData.reviewCount ?? scrapedReviewCount ?? 120;
    const finalCategory = geminiData.category || scrapedCategory || "gadgets";

    return res.status(200).json({
      success: true,
      asin: asin || "",
      title: finalTitle,
      price: finalPrice,
      originalPrice: finalOriginalPrice,
      rating: finalRating,
      reviewCount: finalReviewCount,
      category: finalCategory,
      images: cleanedImages.length > 0 ? cleanedImages : (asin ? getAmazonAsinImageCandidates(asin) : []),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to extract product";
    return res.status(500).json({ error: message });
  }
}
