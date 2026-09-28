import type { IncomingMessage, ServerResponse } from "http";
import { GoogleGenAI } from "@google/genai";

function isAliExpressShortDomain(url: string): boolean {
  if (!url) return false;
  return /^(?:https?:\/\/)?(?:a\.aliexpress\.com|s\.click\.aliexpress\.com|ali\.ski|alitems\.site|alitems\.co|star\.aliexpress\.com)\//i.test(
    url.trim()
  );
}

function extractAliExpressItemId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (isAliExpressShortDomain(trimmed)) {
    return null;
  }
  const match =
    trimmed.match(/(?:\/item\/|[?&]productId=|[?&]itemId=)(\d{11,20})(?:[-_.]|\.html|[/?&#]|$)/i) ||
    trimmed.match(/\/(\d{11,20})(?:[-_.]|\.html|[/?&#]|$)/i) ||
    trimmed.match(/(\d{11,20})/i);
  return match ? match[1] : null;
}

async function resolveRedirectUrl(inputUrl: string): Promise<{ resolvedUrl: string; itemId: string | null }> {
  let curr = inputUrl.trim();
  if (!curr.startsWith("http://") && !curr.startsWith("https://")) {
    curr = "https://" + curr;
  }

  const initialItemId = extractAliExpressItemId(curr);
  let itemId = initialItemId;
  if (itemId && !isAliExpressShortDomain(curr)) {
    return { resolvedUrl: curr, itemId };
  }

  for (let hop = 0; hop < 7; hop++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const resp = await fetch(curr, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      clearTimeout(timeout);

      const loc = resp.headers.get("location");
      if (loc) {
        if (loc.startsWith("http://") || loc.startsWith("https://")) {
          // If redirected to a 404 or login or captcha, don't overwrite if we already had itemId
          if (!loc.includes("/error/") && !loc.includes("login")) {
            curr = loc;
          }
        } else if (loc.startsWith("/")) {
          try {
            const origin = new URL(curr).origin;
            if (!loc.includes("/error/")) {
              curr = origin + loc;
            }
          } catch {
            break;
          }
        }
        const foundId = extractAliExpressItemId(curr);
        if (foundId) {
          itemId = foundId;
        }
        if (itemId && !isAliExpressShortDomain(curr)) {
          break;
        }
      } else {
        if (resp.ok && (curr.includes("aliexpress.com") || curr.includes("ali.ski"))) {
          try {
            const text = await resp.text();
            const canonicalMatch =
              text.match(/<link\s+rel=["']canonical["']\s+href=["'](.*?)["']/i) ||
              text.match(/<meta\s+property=["']og:url["']\s+content=["'](.*?)["']/i);
            if (canonicalMatch && canonicalMatch[1] && !canonicalMatch[1].includes("/error/")) {
              curr = canonicalMatch[1];
              const foundId = extractAliExpressItemId(curr);
              if (foundId) itemId = foundId;
            }
          } catch {
            // ignore
          }
        }
        break;
      }
    } catch {
      break;
    }
  }

  if (!itemId) {
    itemId = initialItemId || extractAliExpressItemId(curr);
  }

  return { resolvedUrl: curr, itemId };
}

function extractTitleFromAliExpressUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const parts = pathname.split("/").filter(Boolean);
    for (const part of parts) {
      if (part.includes(".html")) {
        const withoutHtml = part.replace(/\.html.*$/i, "");
        // Remove numeric item ID if at the beginning: e.g. "1005006456123456-Original-Lenovo-LP40"
        const cleanSlug = withoutHtml.replace(/^\d+[-_]?/, "");
        if (cleanSlug.length > 5) {
          const readable = decodeURIComponent(cleanSlug)
            .replace(/[-_+]/g, " ")
            .replace(/\b\w/g, (l) => l.toUpperCase());
          return readable;
        }
      }
    }
  } catch {
    // ignore
  }
  return "";
}

function cleanAliExpressImageUrl(img: string): string {
  if (!img) return "";
  let cleaned = img.trim();
  if (cleaned.startsWith("//")) {
    cleaned = "https:" + cleaned;
  }
  // Strip thumbnail suffixes like _50x50.jpg, _640x640.jpg_.webp, _Q90.jpg_.webp, etc.
  cleaned = cleaned.replace(/_\d+x\d+[^.]*\.(?:jpg|png|webp|jpeg)(?:_\.webp)?$/i, "");
  cleaned = cleaned.replace(/_\.webp$/i, "");
  return cleaned;
}

function classifyCategory(title: string): string {
  const t = title.toLowerCase();
  if (/headphone|earphone|earbud|headset|audio|soundbar|speaker|microphone|\bmic\b|acoustic/.test(t)) {
    return "audio";
  }
  if (/\bwatch\b|smartwatch|fitness tracker|wristband|pedometer/.test(t)) {
    return "wearables";
  }
  if (/camera|lens|tripod|gimbal|drone|camcorder|dslr|photography|action cam|gopro/.test(t)) {
    return "photography";
  }
  if (/phone|iphone|galaxy|smartphone|tablet|ipad|laptop|macbook|monitor|keyboard|mouse|pc|gpu|ssd|hard drive|desktop/.test(t)) {
    return "electronics";
  }
  if (/vacuum|robot|alexa|echo|purifier|lamp|light|plug|thermostat|humidifier|kitchen|blender|coffee/.test(t)) {
    return "home-smart";
  }
  if (/desk|chair|printer|scanner|paper|shredder|pen|notebook|office/.test(t)) {
    return "office";
  }
  if (/case|cover|cable|charger|adapter|stand|mount|hub|protector|strap|sleeve/.test(t)) {
    return "accessories";
  }
  return "gadgets";
}

export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse & { json?: any; status?: any }) {
  if (!res.status) {
    res.status = (code: number) => {
      res.statusCode = code;
      return res;
    };
  }
  if (!res.json) {
    res.json = (data: any) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(data));
      return res;
    };
  }

  // Handle CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    let body = req.body;
    if (!body) {
      body = await new Promise((resolve, reject) => {
        let data = "";
        req.on("data", (chunk) => {
          data += chunk;
        });
        req.on("end", () => {
          try {
            resolve(data ? JSON.parse(data) : {});
          } catch (e) {
            reject(e);
          }
        });
      });
    }

    const { url } = body;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Missing or invalid AliExpress URL" });
    }

    // Resolve any short URLs (a.aliexpress.com, s.click.aliexpress.com, ali.ski, etc.)
    const { resolvedUrl, itemId } = await resolveRedirectUrl(url);
    const targetUrl = resolvedUrl;

    const cleanUrl = itemId ? `https://www.aliexpress.com/item/${itemId}.html` : targetUrl;
    const urlTitleFallback = extractTitleFromAliExpressUrl(targetUrl);
    const imageCandidates: string[] = [];

    // Multi-strategy direct fetching using social crawler user-agents
    const scrapeUas = [
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    ];

    let scrapedTitle = "";
    let scrapedPrice: number | undefined;
    let scrapedOriginalPrice: number | undefined;
    let scrapedRating: number | undefined;
    let scrapedReviewCount: number | undefined;

    for (const ua of scrapeUas) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4500);
        const pageResp = await fetch(cleanUrl, {
          signal: controller.signal,
          headers: {
            "User-Agent": ua,
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
          },
        });
        clearTimeout(timeout);

        if (pageResp.ok) {
          const fetchedHtml = await pageResp.text();
          if (fetchedHtml.length > 2000) {
            // 1. Scrape Title
            if (!scrapedTitle) {
              const titleMatch =
                fetchedHtml.match(/<meta\s+property=["']og:title["']\s+content=["'](.*?)["']/i) ||
                fetchedHtml.match(/<title>([\s\S]*?)<\/title>/i) ||
                fetchedHtml.match(/["']subject["']\s*:\s*["']([^"']+)["']/i);
              if (titleMatch && titleMatch[1]) {
                scrapedTitle = titleMatch[1]
                  .replace(/<[^>]*>/g, "")
                  .replace(/\s*-\s*AliExpress.*$/i, "")
                  .replace(/\s*\|\s*AliExpress.*$/i, "")
                  .trim();
              }
            }

            // 2. Scrape Price
            if (scrapedPrice === undefined) {
              const p1 = fetchedHtml.match(/["']formatedActivityPrice["']\s*:\s*["'](?:US\s*)?\$?([0-9,]+\.[0-9]{2})["']/i);
              const p2 = fetchedHtml.match(/["']formatedAmount["']\s*:\s*["'](?:US\s*)?\$?([0-9,]+\.[0-9]{2})["']/i);
              const p3 = fetchedHtml.match(/["'](?:minPrice|actMinPrice|targetSalePrice)["']\s*:\s*"?([0-9.]+)"?/i);
              const p4 = fetchedHtml.match(/<meta\s+property=["']og:description["']\s+content=["'][\s\S]*?(?:US\s*)?\$([0-9,]+\.[0-9]{2})/i);
              if (p1) scrapedPrice = parseFloat(p1[1].replace(/,/g, ""));
              else if (p2) scrapedPrice = parseFloat(p2[1].replace(/,/g, ""));
              else if (p3) scrapedPrice = parseFloat(p3[1]);
              else if (p4) scrapedPrice = parseFloat(p4[1].replace(/,/g, ""));
            }

            // 3. Scrape Original Price
            if (scrapedOriginalPrice === undefined) {
              const op1 = fetchedHtml.match(/["']formatedPrice["']\s*:\s*["'](?:US\s*)?\$?([0-9,]+\.[0-9]{2})["']/i);
              const op2 = fetchedHtml.match(/["'](?:maxAmount|origPrice)["']\s*:\s*"?([0-9.]+)"?/i);
              if (op1) scrapedOriginalPrice = parseFloat(op1[1].replace(/,/g, ""));
              else if (op2) scrapedOriginalPrice = parseFloat(op2[1]);
            }

            // 4. Scrape Star Rating
            if (scrapedRating === undefined) {
              const r1 = fetchedHtml.match(/["'](?:averageStar|eAverageStar|ratingValue)["']\s*:\s*"?([0-5](?:\.[0-9])?)"?/i);
              if (r1) scrapedRating = parseFloat(r1[1]);
            }

            // 5. Scrape Review Count
            if (scrapedReviewCount === undefined) {
              const rc1 = fetchedHtml.match(/["'](?:totalValidNum|reviewCount|tradeCount)["']\s*:\s*"?([0-9,]+)"?/i);
              if (rc1) scrapedReviewCount = parseInt(rc1[1].replace(/,/g, ""), 10);
            }

            // 6. Scrape OG Image
            const ogImgMatch = fetchedHtml.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i);
            if (ogImgMatch && ogImgMatch[1] && ogImgMatch[1].startsWith("http")) {
              imageCandidates.unshift(cleanAliExpressImageUrl(ogImgMatch[1]));
            }

            // 7. Scrape imagePathList in JSON
            const imageListMatch = fetchedHtml.match(/["']imagePathList["']\s*:\s*(\[[^\]]+\])/i);
            if (imageListMatch) {
              try {
                const parsedImgs = JSON.parse(imageListMatch[1]);
                if (Array.isArray(parsedImgs)) {
                  for (const img of parsedImgs) {
                    if (typeof img === "string" && img.startsWith("http")) {
                      imageCandidates.push(cleanAliExpressImageUrl(img));
                    }
                  }
                }
              } catch {
                // ignore
              }
            }

            // 8. CDN images matching alicdn.com
            const cdnMatches = fetchedHtml.matchAll(/https:\/\/ae01\.alicdn\.com\/kf\/[a-zA-Z0-9%_-]+\.(?:jpg|png|webp)/gi);
            for (const m of cdnMatches) {
              imageCandidates.push(cleanAliExpressImageUrl(m[0]));
            }

            if (scrapedTitle && (scrapedPrice !== undefined || imageCandidates.length > 1)) {
              break;
            }
          }
        }
      } catch {
        // Continue to next UA fallback
      }
    }

    if (!scrapedTitle && urlTitleFallback) {
      scrapedTitle = urlTitleFallback;
    }

    // Invoke Gemini if scrapedTitle or price could not be directly retrieved
    let geminiData: {
      title?: string;
      price?: number;
      originalPrice?: number;
      rating?: number;
      reviewCount?: number;
      category?: string;
      images?: string[];
    } = {};

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && (!scrapedTitle || scrapedPrice === undefined || imageCandidates.length === 0)) {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build",
            },
          },
        });
        const prompt = `Search and extract accurate details for this AliExpress product:
URL: ${cleanUrl}
${itemId ? `Item ID: ${itemId}` : ""}
${urlTitleFallback ? `Suspected Title/Brand: ${urlTitleFallback}` : ""}

Return strictly JSON matching:
{
  "title": "Exact Title",
  "price": 19.99,
  "originalPrice": 29.99,
  "rating": 4.7,
  "reviewCount": 350,
  "category": "gadgets",
  "images": ["https://ae01.alicdn.com/..."]
}`;

        const candidateModels = [
          { model: "gemini-2.5-flash", tools: [{ googleSearch: {} }] },
          { model: "gemini-2.5-flash-lite", tools: undefined },
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
            // Silently try next fallback
          }
        }
      } catch {
        // Graceful fallback
      }
    }

    if (geminiData.images && Array.isArray(geminiData.images)) {
      imageCandidates.unshift(...geminiData.images.map(cleanAliExpressImageUrl));
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
      scrapedTitle ||
      urlTitleFallback ||
      geminiData.title ||
      (itemId ? `AliExpress Product (${itemId})` : "AliExpress Product");

    const finalPrice = scrapedPrice ?? geminiData.price ?? undefined;
    const finalOriginalPrice = scrapedOriginalPrice ?? geminiData.originalPrice ?? undefined;
    const finalRating = scrapedRating ?? geminiData.rating ?? 4.7;
    const finalReviewCount = scrapedReviewCount ?? geminiData.reviewCount ?? 150;
    const finalCategory = classifyCategory(finalTitle) || geminiData.category || "gadgets";

    return res.status(200).json({
      success: true,
      platform: "aliexpress",
      itemId: itemId || "",
      cleanUrl,
      title: finalTitle,
      price: finalPrice,
      originalPrice: finalOriginalPrice,
      rating: finalRating,
      reviewCount: finalReviewCount,
      category: finalCategory,
      images: cleanedImages,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to extract AliExpress product";
    console.error("Extract AliExpress product error:", err);
    return res.status(500).json({ error: message });
  }
}
