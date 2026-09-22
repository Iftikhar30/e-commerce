import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to identify short affiliate/redirect domains
function isAmazonShortDomain(url: string): boolean {
  if (!url) return false;
  return /^(?:https?:\/\/)?(?:a\.co|amzn\.to|amzn\.eu|amzn\.in|amzn\.asia|t\.co|bit\.ly|tinyurl\.com|rb\.gy)\//i.test(
    url.trim()
  );
}

// Helper to extract ASIN from any Amazon product link
function extractAsin(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (isAmazonShortDomain(trimmed)) {
    return null;
  }
  const match =
    trimmed.match(
      /(?:\/dp\/|\/gp\/product\/|\/exec\/obidos\/asin\/|\/gp\/aw\/d\/|[?&]asin=|\/product\/)([A-Z0-9]{10})(?:[/?&#]|$)/i
    ) || trimmed.match(/amazon\.[a-z.]+\/.*?\/([A-Z0-9]{10})(?:[/?&#]|$)/i);
  return match ? match[1].toUpperCase() : null;
}

// Resolves multi-hop HTTP redirects for short URLs (a.co, amzn.to, etc.)
async function resolveRedirectUrl(inputUrl: string): Promise<{ resolvedUrl: string; asin: string | null }> {
  let curr = inputUrl.trim();
  if (!curr.startsWith("http://") && !curr.startsWith("https://")) {
    curr = "https://" + curr;
  }

  let asin = extractAsin(curr);
  if (asin && !isAmazonShortDomain(curr)) {
    return { resolvedUrl: curr, asin };
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
          curr = loc;
        } else if (loc.startsWith("/")) {
          try {
            const origin = new URL(curr).origin;
            curr = origin + loc;
          } catch {
            break;
          }
        }
        asin = extractAsin(curr);
        if (asin && !isAmazonShortDomain(curr)) {
          break;
        }
      } else {
        if (resp.ok && (curr.includes("a.co") || curr.includes("amzn.to"))) {
          try {
            const text = await resp.text();
            const canonicalMatch =
              text.match(/<link\s+rel=["']canonical["']\s+href=["'](.*?)["']/i) ||
              text.match(/<meta\s+property=["']og:url["']\s+content=["'](.*?)["']/i);
            if (canonicalMatch && canonicalMatch[1]) {
              curr = canonicalMatch[1];
              asin = extractAsin(curr);
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

  if (!asin) {
    asin = extractAsin(curr);
  }

  return { resolvedUrl: curr, asin };
}

// Generate canonical Amazon image URLs based on ASIN
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

function extractTitleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const parts = pathname.split("/").filter(Boolean);
    for (const part of parts) {
      if (
        part !== "dp" &&
        part !== "gp" &&
        part !== "product" &&
        part !== "d" &&
        part.length > 4 &&
        !/^[A-Z0-9]{10}$/i.test(part)
      ) {
        const readable = decodeURIComponent(part)
          .replace(/[-_+]/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());
        if (readable.length > 4) {
          return readable;
        }
      }
    }
  } catch {
    // ignore
  }
  return "";
}

function cleanAmazonImageUrl(img: string): string {
  if (!img) return "";
  let cleaned = img.replace(/\.jpg_.*$/i, ".jpg");
  cleaned = cleaned.replace(/\._[A-Z0-9_,]+_\./i, "._AC_SL1500_.");
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

async function startServer() {
  const app = express();
  const PORT = 3000;

  // CORS middleware for seamless cross-device API requests from all clients & hosts
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control"
    );
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json({ limit: "10mb" }));

  // API endpoint to fetch product information automatically from Amazon URL or ASIN
  app.post("/api/extract-amazon-product", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "Missing or invalid Amazon URL" });
      }

      // Resolve any short URLs (a.co, amzn.to, bit.ly, etc.)
      const { resolvedUrl, asin } = await resolveRedirectUrl(url);
      const targetUrl = resolvedUrl;

      const cleanUrl = asin ? `https://www.amazon.com/dp/${asin}` : targetUrl;
      const urlTitleFallback = extractTitleFromUrl(targetUrl);
      const imageCandidates: string[] = [];

      if (asin) {
        imageCandidates.push(...getAmazonAsinImageCandidates(asin));
      }

      // Multi-strategy direct fetching using social and crawler user-agents that Amazon serves without bot captcha
      const scrapeUas = [
        "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1",
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
          const timeout = setTimeout(() => controller.abort(), 4000);
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
            if (fetchedHtml.length > 5000 && !fetchedHtml.includes("validateCaptcha")) {
              // 1. Scrape Title
              if (!scrapedTitle) {
                const titleMatch =
                  fetchedHtml.match(/<span\s+id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i) ||
                  fetchedHtml.match(/<meta\s+property=["']og:title["']\s+content=["'](.*?)["']/i) ||
                  fetchedHtml.match(/<h1[^>]*id=["']title["'][^>]*>([\s\S]*?)<\/h1>/i) ||
                  fetchedHtml.match(/<title>([\s\S]*?)<\/title>/i);
                if (titleMatch) {
                  scrapedTitle = titleMatch[1]
                    .replace(/<[^>]*>/g, "")
                    .replace(/:\s*Amazon\.[a-z.]+.*$/i, "")
                    .trim();
                }
              }

              // 2. Scrape Price
              if (scrapedPrice === undefined) {
                const p1 = fetchedHtml.match(/class=["']a-offscreen["'][^>]*>\s*\$([0-9,]+\.[0-9]{2})/i);
                const p2 = fetchedHtml.match(/class=["']a-price-whole["'][^>]*>([0-9,]+)<[\s\S]*?class=["']a-price-fraction["'][^>]*>([0-9]{2})/i);
                const p3 = fetchedHtml.match(/"priceAmount":\s*([0-9.]+)/i);
                const p4 = fetchedHtml.match(/id=["'](?:priceblock_ourprice|priceblock_dealprice|price_inside_buybox)["'][^>]*>\s*\$([0-9,]+\.[0-9]{2})/i);
                if (p1) scrapedPrice = parseFloat(p1[1].replace(/,/g, ""));
                else if (p2) scrapedPrice = parseFloat(p2[1].replace(/,/g, "") + "." + p2[2]);
                else if (p3) scrapedPrice = parseFloat(p3[1]);
                else if (p4) scrapedPrice = parseFloat(p4[1].replace(/,/g, ""));
              }

              // 3. Scrape Original Price (List Price)
              if (scrapedOriginalPrice === undefined) {
                const origPriceMatch =
                  fetchedHtml.match(/class=["']basisPrice["'][\s\S]*?class=["']a-offscreen["'][^>]*>\s*\$([0-9,]+\.[0-9]{2})/i) ||
                  fetchedHtml.match(/class=["']a-text-price["'][\s\S]*?class=["']a-offscreen["'][^>]*>\s*\$([0-9,]+\.[0-9]{2})/i);
                if (origPriceMatch) {
                  scrapedOriginalPrice = parseFloat(origPriceMatch[1].replace(/,/g, ""));
                }
              }

              // 4. Scrape Star Rating
              if (scrapedRating === undefined) {
                const ratingMatch =
                  fetchedHtml.match(/([0-5](?:\.[0-9])?)\s+out\s+of\s+5\s+stars/i) ||
                  fetchedHtml.match(/class=["']a-icon-alt["'][^>]*>([0-5](?:\.[0-9])?)\s+stars?/i);
                if (ratingMatch) {
                  scrapedRating = parseFloat(ratingMatch[1]);
                }
              }

              // 5. Scrape Review Count
              if (scrapedReviewCount === undefined) {
                const reviewMatch =
                  fetchedHtml.match(/id=["']acrCustomerReviewText["'][^>]*>([0-9,]+)\s+ratings?/i) ||
                  fetchedHtml.match(/([0-9,]+)\s+customer\s+ratings/i) ||
                  fetchedHtml.match(/([0-9,]+)\s+global\s+ratings/i);
                if (reviewMatch) {
                  scrapedReviewCount = parseInt(reviewMatch[1].replace(/,/g, ""), 10);
                }
              }

              // 6. Scrape OG Image
              const ogImgMatch = fetchedHtml.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i);
              if (ogImgMatch && ogImgMatch[1] && ogImgMatch[1].startsWith("http")) {
                imageCandidates.unshift(cleanAmazonImageUrl(ogImgMatch[1]));
              }

              // 7. Dynamic images dictionary
              const dynamicImageDictMatches = fetchedHtml.matchAll(/data-a-dynamic-image=["'](\{.+?\})["']/gi);
              for (const m of dynamicImageDictMatches) {
                try {
                  const rawJson = m[1].replace(/&quot;/g, '"');
                  const parsed = JSON.parse(rawJson);
                  for (const key of Object.keys(parsed)) {
                    if (key.startsWith("http")) imageCandidates.unshift(cleanAmazonImageUrl(key));
                  }
                } catch {
                  // ignore
                }
              }

              // 8. ColorImages JSON block
              const colorImagesMatch = fetchedHtml.match(/["']colorImages['"]\s*:\s*(\{[\s\S]+?\}),\s*["'](?:colorToAsin|itemGauge)/i);
              if (colorImagesMatch) {
                try {
                  const parsed = JSON.parse(colorImagesMatch[1]);
                  const initialList = parsed?.initial || [];
                  for (const item of initialList) {
                    if (item.hiRes) imageCandidates.unshift(cleanAmazonImageUrl(item.hiRes));
                    if (item.large) imageCandidates.unshift(cleanAmazonImageUrl(item.large));
                    if (item.main && typeof item.main === "object") {
                      const keys = Object.keys(item.main);
                      if (keys.length > 0) imageCandidates.unshift(cleanAmazonImageUrl(keys[0]));
                    }
                  }
                } catch {
                  // ignore
                }
              }

              // 9. Generic high-res Amazon media CDN images
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
                  imageCandidates.push(cleanAmazonImageUrl(img));
                }
              }

              // If we obtained product title and at least one image or price, we have verified Amazon data
              if (scrapedTitle && (scrapedPrice !== undefined || imageCandidates.length > 1)) {
                break;
              }
            }
          }
        } catch {
          // Continue to next UA fallback
        }
      }

      // If scraped title is missing, try URL slug fallback before considering AI
      if (!scrapedTitle && urlTitleFallback) {
        scrapedTitle = urlTitleFallback;
      }

      // If scrapedTitle was found, it is 100% genuine and MUST NOT be overridden by AI hallucination
      let geminiData: {
        title?: string;
        price?: number;
        originalPrice?: number;
        rating?: number;
        reviewCount?: number;
        category?: string;
        images?: string[];
      } = {};

      // Only invoke Gemini if both scrapedTitle and scrapedPrice could not be retrieved from Amazon
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey && (!scrapedTitle || scrapedPrice === undefined)) {
        try {
          const ai = new GoogleGenAI({
            apiKey,
            httpOptions: {
              headers: {
                "User-Agent": "aistudio-build",
              },
            },
          });
          const prompt = `Search and extract accurate details for this Amazon product:
URL: ${cleanUrl}
${asin ? `ASIN: ${asin}` : ""}
${urlTitleFallback ? `Suspected Title/Brand: ${urlTitleFallback}` : ""}

Return strictly JSON matching:
{
  "title": "Exact Title",
  "price": 29.99,
  "originalPrice": 39.99,
  "rating": 4.6,
  "reviewCount": 1420,
  "category": "audio",
  "images": ["https://..."]
}`;

          const candidateModels = [
            { model: "gemini-3.8-flash", tools: [{ googleSearch: {} }] },
            { model: "gemini-3.1-flash-lite", tools: undefined },
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
              // Silently try next fallback model
            }
          }
        } catch {
          // Gracefully fallback
        }
      }

      // Merge images from Gemini if any
      if (geminiData.images && Array.isArray(geminiData.images)) {
        imageCandidates.unshift(...geminiData.images.map(cleanAmazonImageUrl));
      }

      // Clean & deduplicate images
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

      // Title determination: ALWAYS prefer verified scrapedTitle from Amazon's actual page!
      const finalTitle =
        scrapedTitle ||
        urlTitleFallback ||
        geminiData.title ||
        (asin ? `Amazon Product (${asin})` : "Amazon Product");

      const finalPrice = scrapedPrice ?? geminiData.price ?? undefined;
      const finalOriginalPrice = scrapedOriginalPrice ?? geminiData.originalPrice ?? undefined;
      const finalRating = scrapedRating ?? geminiData.rating ?? 4.5;
      const finalReviewCount = scrapedReviewCount ?? geminiData.reviewCount ?? 120;
      const finalCategory = classifyCategory(finalTitle) || geminiData.category || "gadgets";

      return res.json({
        success: true,
        asin: asin || "",
        cleanUrl,
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
      console.error("Extract product error:", err);
      return res.status(500).json({ error: message });
    }
  });

  // ==========================================
  // ADSTERRA ADS CROSS-DEVICE SYNC & MANAGEMENT APIS
  // ==========================================
  interface ServerAdsterraAd {
    id: string;
    title: string;
    format: string;
    size: '320x50' | '300x250' | '728x90' | 'custom';
    width?: number;
    height?: number;
    adCode: string;
    placement: 'after_banner' | 'after_4_products' | 'after_8_products' | 'after_12_products' | 'before_footer';
    deviceTarget: 'all' | 'mobile_only' | 'desktop_only';
    active: boolean;
    order: number;
    createdAt?: string;
    updatedAt?: string;
  }

  const ADS_STORAGE_FILE = path.join(process.cwd(), 'data', 'ads.json');

  function loadServerAds(): ServerAdsterraAd[] {
    try {
      if (fs.existsSync(ADS_STORAGE_FILE)) {
        const raw = fs.readFileSync(ADS_STORAGE_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((a) => a && a.id && !a.id.includes('sample'));
        }
      }
    } catch (e) {
      console.warn('Error reading ads storage file:', e);
    }
    return [];
  }

  function saveServerAds(adsList: ServerAdsterraAd[]) {
    try {
      const dir = path.dirname(ADS_STORAGE_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(ADS_STORAGE_FILE, JSON.stringify(adsList, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Error writing ads storage file:', e);
    }
  }

  let globalAds: ServerAdsterraAd[] = loadServerAds();

  // 1. Get all ads
  app.get("/api/ads", (req, res) => {
    res.json({ success: true, ads: globalAds });
  });

  // 2. Save or update an ad (supports cross-device instant sync)
  app.post("/api/ads", (req, res) => {
    const data: Partial<ServerAdsterraAd> = req.body;
    if (!data || !data.title || !data.adCode) {
      return res.status(400).json({ error: "Missing required ad fields" });
    }

    const id = data.id || `ad_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const newAd: ServerAdsterraAd = {
      id,
      title: data.title,
      format: data.format || 'Banner',
      size: data.size || '320x50',
      width: data.width || 320,
      height: data.height || 50,
      adCode: data.adCode,
      placement: data.placement || 'after_banner',
      deviceTarget: data.deviceTarget || 'all',
      active: data.active !== undefined ? Boolean(data.active) : true,
      order: data.order ?? (globalAds.length + 1),
      createdAt: data.createdAt || now,
      updatedAt: now,
    };

    const index = globalAds.findIndex((a) => a.id === id);
    if (index >= 0) {
      globalAds[index] = newAd;
    } else {
      globalAds.push(newAd);
    }
    saveServerAds(globalAds);

    res.json({ success: true, ad: newAd, ads: globalAds });
  });

  // 3. Delete an ad (ensures permanent deletion across all devices)
  app.post("/api/ads/delete", (req, res) => {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: "Missing ad id" });
    }
    globalAds = globalAds.filter((a) => a.id !== id);
    saveServerAds(globalAds);
    res.json({ success: true, ads: globalAds });
  });

  app.delete("/api/ads/:id", (req, res) => {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: "Missing ad id" });
    }
    globalAds = globalAds.filter((a) => a.id !== id);
    saveServerAds(globalAds);
    res.json({ success: true, ads: globalAds });
  });

  // 4. Toggle active status
  app.patch("/api/ads/:id/toggle", (req, res) => {
    const { id } = req.params;
    const { active } = req.body;
    const ad = globalAds.find((a) => a.id === id);
    if (ad) {
      ad.active = typeof active === 'boolean' ? active : !ad.active;
      ad.updatedAt = new Date().toISOString();
      saveServerAds(globalAds);
      return res.json({ success: true, ad, ads: globalAds });
    }
    res.status(404).json({ error: "Ad not found" });
  });

  // ==========================================
  // GLOBAL DEVICE SECURITY & BLOCKING APIS
  // ==========================================
  interface ServerBlockedDevice {
    id: string;
    deviceId: string;
    ip?: string;
    browser?: string;
    os?: string;
    deviceType?: string;
    reason?: string;
    blockedAt: string;
    blockedBy?: string;
  }

  interface ServerLoginLog {
    id: string;
    email: string;
    status: 'success' | 'failed';
    reason?: string;
    device: {
      deviceId: string;
      ip?: string;
      browser: string;
      os: string;
      deviceType: 'Desktop' | 'Mobile' | 'Tablet';
      userAgent: string;
      city?: string;
      country?: string;
      screenResolution?: string;
    };
    timestamp: string;
  }

  const BLOCKED_DEVICES_FILE = path.join(process.cwd(), 'data', 'blocked_devices.json');
  const LOGIN_LOGS_FILE = path.join(process.cwd(), 'data', 'login_logs.json');

  function loadBlockedDevices(): ServerBlockedDevice[] {
    try {
      if (fs.existsSync(BLOCKED_DEVICES_FILE)) {
        const raw = fs.readFileSync(BLOCKED_DEVICES_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Error reading blocked devices file:', e);
    }
    return [];
  }

  function saveBlockedDevices(devices: ServerBlockedDevice[]) {
    try {
      const dir = path.dirname(BLOCKED_DEVICES_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(BLOCKED_DEVICES_FILE, JSON.stringify(devices, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Error saving blocked devices file:', e);
    }
  }

  function loadLoginLogs(): ServerLoginLog[] {
    try {
      if (fs.existsSync(LOGIN_LOGS_FILE)) {
        const raw = fs.readFileSync(LOGIN_LOGS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Error reading login logs file:', e);
    }
    return [];
  }

  function saveLoginLogs(logs: ServerLoginLog[]) {
    try {
      const dir = path.dirname(LOGIN_LOGS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(LOGIN_LOGS_FILE, JSON.stringify(logs.slice(0, 300), null, 2), 'utf-8');
    } catch (e) {
      console.warn('Error saving login logs file:', e);
    }
  }

  let globalBlockedDevices: ServerBlockedDevice[] = loadBlockedDevices();
  let globalLoginLogs: ServerLoginLog[] = loadLoginLogs();

  function getClientIp(req: express.Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      const first = forwarded.split(',')[0].trim();
      if (first) return first;
    }
    if (Array.isArray(forwarded) && forwarded.length > 0) {
      return forwarded[0].trim();
    }
    const rawIp = req.socket.remoteAddress || req.ip || '127.0.0.1';
    return rawIp.replace(/^::ffff:/, '');
  }

  // 1. Client IP lookup endpoint
  app.get("/api/client-ip", (req, res) => {
    const ip = getClientIp(req);
    res.json({ ip, userAgent: req.headers['user-agent'] || '' });
  });

  // 2. Check if the current requesting client is blocked
  app.get("/api/security/check-client", (req, res) => {
    const clientIp = getClientIp(req);
    const deviceId = typeof req.query.deviceId === 'string' ? req.query.deviceId.trim() : '';

    const matched = globalBlockedDevices.find((b) => {
      if (deviceId && b.deviceId === deviceId) return true;
      if (deviceId && b.id === deviceId) return true;
      if (clientIp && b.ip === clientIp) return true;
      if (clientIp && b.id === clientIp) return true;
      return false;
    });

    res.json({
      isBlocked: !!matched,
      matchedRecord: matched || null,
      clientIp,
    });
  });

  // 3. Get all blocked devices
  app.get("/api/security/blocked", (req, res) => {
    res.json({ success: true, devices: globalBlockedDevices });
  });

  // 4. Block a device / IP
  app.post("/api/security/block", (req, res) => {
    const data: ServerBlockedDevice = req.body;
    if (!data || (!data.deviceId && !data.ip && !data.id)) {
      return res.status(400).json({ error: "Missing deviceId or IP" });
    }

    const id = data.id || data.deviceId || data.ip || `block_${Date.now()}`;
    const entry: ServerBlockedDevice = {
      id,
      deviceId: data.deviceId || id,
      ip: data.ip || '',
      browser: data.browser || '',
      os: data.os || '',
      deviceType: data.deviceType || 'Desktop',
      reason: data.reason || 'Blocked by administrator',
      blockedAt: data.blockedAt || new Date().toISOString(),
      blockedBy: data.blockedBy || 'admin',
    };

    // Remove existing if any
    const existingIndex = globalBlockedDevices.findIndex(
      (b) => b.id === entry.id || (entry.deviceId && b.deviceId === entry.deviceId)
    );
    if (existingIndex >= 0) {
      globalBlockedDevices[existingIndex] = entry;
    } else {
      globalBlockedDevices.unshift(entry);
    }

    // Also block by IP if IP exists
    if (entry.ip && entry.ip !== entry.deviceId && entry.ip !== '127.0.0.1') {
      const ipEntry: ServerBlockedDevice = {
        ...entry,
        id: `ip_${entry.ip}`,
      };
      if (!globalBlockedDevices.some((b) => b.id === ipEntry.id || b.ip === entry.ip)) {
        globalBlockedDevices.unshift(ipEntry);
      }
    }

    saveBlockedDevices(globalBlockedDevices);
    res.json({ success: true, device: entry, totalBlocked: globalBlockedDevices.length });
  });

  // 5. Unblock a device / IP
  app.post("/api/security/unblock", (req, res) => {
    const target = req.body?.id || req.body?.deviceId || req.body?.ip;
    if (!target) {
      return res.status(400).json({ error: "Missing identifier" });
    }

    for (let i = globalBlockedDevices.length - 1; i >= 0; i--) {
      const b = globalBlockedDevices[i];
      if (b.id === target || b.deviceId === target || b.ip === target) {
        globalBlockedDevices.splice(i, 1);
      }
    }

    saveBlockedDevices(globalBlockedDevices);
    res.json({ success: true, remaining: globalBlockedDevices.length });
  });

  // 6. Record login attempt
  app.post("/api/security/record-login", (req, res) => {
    const data = req.body;
    if (!data || !data.email) {
      return res.status(400).json({ error: "Missing login details" });
    }

    const clientIp = getClientIp(req);
    const newLog: ServerLoginLog = {
      id: data.id || `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      email: data.email,
      status: data.status === 'failed' ? 'failed' : 'success',
      reason: data.reason,
      device: {
        deviceId: data.device?.deviceId || `dev_${Math.random().toString(36).substring(2, 9)}`,
        ip: (data.device?.ip && data.device.ip !== 'Unknown IP') ? data.device.ip : clientIp,
        browser: data.device?.browser || 'Unknown Browser',
        os: data.device?.os || 'Unknown OS',
        deviceType: data.device?.deviceType || 'Desktop',
        userAgent: data.device?.userAgent || req.headers['user-agent'] || '',
        city: data.device?.city,
        country: data.device?.country,
        screenResolution: data.device?.screenResolution,
      },
      timestamp: data.timestamp || new Date().toISOString(),
    };

    // Prevent duplicates
    const existIdx = globalLoginLogs.findIndex((l) => l.id === newLog.id);
    if (existIdx >= 0) {
      globalLoginLogs[existIdx] = newLog;
    } else {
      globalLoginLogs.unshift(newLog);
    }

    if (globalLoginLogs.length > 300) {
      globalLoginLogs.pop();
    }

    saveLoginLogs(globalLoginLogs);
    res.json({ success: true, log: newLog, totalLogs: globalLoginLogs.length });
  });

  // 7. Get login logs
  app.get("/api/security/logs", (req, res) => {
    res.json({ success: true, logs: globalLoginLogs });
  });

  // 8. Clear login logs
  app.post("/api/security/clear-logs", (req, res) => {
    globalLoginLogs = [];
    saveLoginLogs(globalLoginLogs);
    res.json({ success: true, logs: [] });
  });

  // Vite middleware in dev or static serving in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
