import express from "express";
import multer from "multer";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

// ─── Claude helper ─────────────────────────────────────────────────────────────
async function callClaude(messages, system, maxTokens = 1000) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content.map((b) => b.text || "").join("");
}

// ─── ROUTE 1: Identify item from photo ────────────────────────────────────────
app.post("/api/identify", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });

    const base64 = req.file.buffer.toString("base64");
    const mediaType = req.file.mimetype;

    const system = `You are an expert estate clearance and resale specialist with 20 years experience valuing items for eBay UK, Facebook Marketplace, Vinted, and Gumtree. You have encyclopaedic knowledge of brands, collectibles, antiques, electronics, clothing, and household goods.

Examine the image carefully. Look for brand markings, labels, model numbers, style indicators, material quality, and condition signs.

Return ONLY valid JSON with no markdown or extra text:
{
  "itemName": "precise descriptive name",
  "brand": "brand/manufacturer if visible or null",
  "model": "model if visible or null",
  "category": "Furniture / Electronics / Clothing / Footwear / Jewellery / Watches / Art / Books / Collectibles / Kitchenware / Tools / Garden / Toys / Other",
  "condition": "Excellent / Good / Fair / Poor",
  "conditionNotes": "one sentence on visible condition",
  "colour": "primary colour(s)",
  "material": "primary material if determinable",
  "estimatedAge": "decade/era or null",
  "keyFeatures": ["feature 1", "feature 2", "feature 3"],
  "resaleViability": "High / Medium / Low",
  "confidence": 85,
  "searchTerms": ["best eBay UK search term", "alternative term"]
}`;

    const text = await callClaude(
      [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: "Identify this item for resale. Return ONLY JSON." },
        ],
      }],
      system, 600
    );

    const item = JSON.parse(text.replace(/```json|```/g, "").trim());
    res.json({ success: true, item });
  } catch (err) {
    console.error("Identify error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── ROUTE 2: Market research & pricing ───────────────────────────────────────
app.post("/api/market", async (req, res) => {
  try {
    const { item } = req.body;
    if (!item) return res.status(400).json({ error: "No item data" });

    const system = `You are a UK resale market analyst with deep knowledge of eBay UK, Facebook Marketplace, Vinted, and Gumtree pricing in 2025.

Given an item description, provide realistic UK market pricing based on your knowledge of recent sold listings and current market conditions.

Return ONLY valid JSON:
{
  "platforms": {
    "ebay": {
      "recommendedPrice": 45,
      "priceRange": { "low": 30, "high": 60 },
      "averageSold": 42,
      "listingType": "Buy It Now / Auction",
      "estimatedSellTime": "3-7 days",
      "suitability": "High / Medium / Low",
      "suitabilityReason": "one sentence",
      "comparables": [
        { "title": "similar item title", "price": 45, "status": "Sold" },
        { "title": "similar item title", "price": 38, "status": "Active" }
      ]
    },
    "facebook": {
      "recommendedPrice": 35,
      "priceRange": { "low": 25, "high": 45 },
      "estimatedSellTime": "1-3 days",
      "suitability": "High / Medium / Low",
      "suitabilityReason": "one sentence",
      "comparables": [
        { "title": "similar item", "price": 30, "status": "Sold" }
      ]
    },
    "vinted": {
      "recommendedPrice": 28,
      "priceRange": { "low": 18, "high": 38 },
      "estimatedSellTime": "2-5 days",
      "suitability": "High / Medium / Low",
      "suitabilityReason": "one sentence",
      "comparables": [
        { "title": "similar item", "price": 25, "status": "Sold" }
      ]
    },
    "gumtree": {
      "recommendedPrice": 30,
      "priceRange": { "low": 20, "high": 40 },
      "estimatedSellTime": "3-10 days",
      "suitability": "High / Medium / Low",
      "suitabilityReason": "one sentence",
      "comparables": [
        { "title": "similar item", "price": 28, "status": "Active" }
      ]
    }
  },
  "bestPlatform": "ebay",
  "fastestSale": "facebook",
  "totalEstimatedValue": 45,
  "marketInsight": "two sentence summary of market conditions for this item"
}`;

    const text = await callClaude(
      [{ role: "user", content: `Research UK resale market for this item:\n${JSON.stringify(item, null, 2)}\n\nReturn ONLY JSON with realistic 2025 UK prices.` }],
      system, 1200
    );

    const market = JSON.parse(text.replace(/```json|```/g, "").trim());
    res.json({ success: true, market });
  } catch (err) {
    console.error("Market error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── ROUTE 3: Generate platform listings ─────────────────────────────────────
app.post("/api/listings", async (req, res) => {
  try {
    const { item, market } = req.body;
    if (!item || !market) return res.status(400).json({ error: "Missing item or market data" });

    const system = `You are a professional resale copywriter specialising in UK marketplaces. You write listings that sell quickly by using platform-specific language, tone, and SEO best practices.

Platform guidelines:
- eBay: SEO-optimised title (max 80 chars), condition-focused, keyword-rich description, include model/brand/measurements if known
- Facebook Marketplace: Conversational, local trust signals ("collection from Wirral"), no-hassle tone, casual
- Vinted: Fashion-forward, honest about condition, mention exact measurements if clothing, buyer-friendly
- Gumtree: Direct, local, practical, mention collection area, honest description

Return ONLY valid JSON:
{
  "ebay": {
    "title": "SEO optimised title max 80 chars",
    "description": "Full professional listing description, 3-4 paragraphs",
    "condition": "Used - Good",
    "suggestedPrice": 45,
    "hashtags": []
  },
  "facebook": {
    "title": "Short punchy title",
    "description": "Conversational listing copy, 2-3 paragraphs, mention Wirral collection",
    "suggestedPrice": 35,
    "hashtags": []
  },
  "vinted": {
    "title": "Title with condition and brand",
    "description": "Vinted-style listing, honest condition, buyer-friendly tone",
    "suggestedPrice": 28,
    "hashtags": ["#preloved", "#secondhand", "#sustainablefashion"]
  },
  "gumtree": {
    "title": "Straightforward descriptive title",
    "description": "Direct local listing, mention area, honest and practical",
    "suggestedPrice": 30,
    "hashtags": []
  }
}`;

    const text = await callClaude(
      [{ role: "user", content: `Write platform listings for:\nItem: ${JSON.stringify(item, null, 2)}\nMarket data: ${JSON.stringify(market, null, 2)}\n\nReturn ONLY JSON.` }],
      system, 2000
    );

    const listings = JSON.parse(text.replace(/```json|```/g, "").trim());
    res.json({ success: true, listings });
  } catch (err) {
    console.error("Listings error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Serve frontend ───────────────────────────────────────────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Home Cleared running on http://localhost:${PORT}`));
