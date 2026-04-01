import express from "express";
import multer from "multer";
import cors from "cors";

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());


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

// ─── Serve frontend (inline) ─────────────────────────────────────────────────
const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Home Cleared — AI Valuation Tool</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,500&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --dark:    #0D1117;
    --dark2:   #161B22;
    --dark3:   #1E2530;
    --gold:    #C8A96E;
    --gold2:   #8B6914;
    --cream:   #E8E4DC;
    --muted:   #6B7280;
    --green:   #22C55E;
    --red:     #EF4444;
    --blue:    #3B82F6;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: var(--dark);
    color: var(--cream);
    font-family: 'DM Sans', sans-serif;
    min-height: 100vh;
    font-size: 15px;
  }

  /* ── Header ── */
  header {
    border-bottom: 1px solid var(--dark3);
    padding: 16px 24px;
    display: flex;
    align-items: center;
    gap: 14px;
    background: var(--dark2);
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .logo {
    width: 40px; height: 40px;
    background: linear-gradient(135deg, var(--gold), var(--gold2));
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Playfair Display', serif;
    font-weight: 700; font-size: 16px;
    color: var(--dark);
    flex-shrink: 0;
  }

  .brand-name {
    font-family: 'Playfair Display', serif;
    font-size: 18px; font-weight: 600;
    color: var(--gold);
    letter-spacing: 0.01em;
  }

  .brand-sub {
    font-size: 11px; color: var(--muted);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-top: 1px;
  }

  header .reset-btn {
    margin-left: auto;
    background: transparent;
    border: 1px solid var(--dark3);
    color: var(--muted);
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    transition: all 0.2s;
  }

  header .reset-btn:hover { border-color: var(--gold); color: var(--gold); }

  /* ── Main ── */
  main {
    max-width: 900px;
    margin: 0 auto;
    padding: 32px 20px 80px;
  }

  /* ── Upload Zone ── */
  .upload-zone {
    border: 2px dashed var(--dark3);
    border-radius: 16px;
    padding: 60px 40px;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s;
    background: var(--dark2);
    position: relative;
    overflow: hidden;
  }

  .upload-zone::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at 50% 0%, rgba(200,169,110,0.06) 0%, transparent 70%);
    pointer-events: none;
  }

  .upload-zone:hover, .upload-zone.drag-over {
    border-color: var(--gold);
    background: rgba(200,169,110,0.04);
  }

  .upload-zone input { display: none; }

  .upload-icon {
    font-size: 48px;
    margin-bottom: 16px;
    display: block;
    filter: grayscale(0.3);
  }

  .upload-zone h2 {
    font-family: 'Playfair Display', serif;
    font-size: 22px;
    color: var(--cream);
    margin-bottom: 8px;
  }

  .upload-zone p { color: var(--muted); font-size: 14px; line-height: 1.6; }

  .upload-zone .btn-upload {
    display: inline-block;
    margin-top: 24px;
    background: var(--gold);
    color: var(--dark);
    padding: 12px 28px;
    border-radius: 8px;
    font-weight: 500;
    font-size: 14px;
    font-family: 'DM Sans', sans-serif;
    letter-spacing: 0.02em;
    border: none;
    cursor: pointer;
    transition: background 0.2s;
  }

  .upload-zone .btn-upload:hover { background: #d4b67a; }

  /* ── Preview ── */
  .preview-wrap {
    display: none;
    margin-bottom: 24px;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid var(--dark3);
    background: var(--dark2);
  }

  .preview-wrap img {
    width: 100%;
    max-height: 320px;
    object-fit: contain;
    display: block;
    background: #000;
  }

  .preview-actions {
    padding: 16px 20px;
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .btn-analyse {
    background: var(--gold);
    color: var(--dark);
    border: none;
    padding: 12px 28px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    transition: background 0.2s;
    display: flex; align-items: center; gap: 8px;
  }

  .btn-analyse:hover { background: #d4b67a; }
  .btn-analyse:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-secondary {
    background: transparent;
    color: var(--muted);
    border: 1px solid var(--dark3);
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    transition: all 0.2s;
  }

  .btn-secondary:hover { border-color: var(--muted); color: var(--cream); }

  /* ── Progress ── */
  .progress-bar {
    display: none;
    background: var(--dark2);
    border: 1px solid var(--dark3);
    border-radius: 12px;
    padding: 28px 24px;
    margin-bottom: 24px;
  }

  .progress-steps {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .progress-step {
    display: flex;
    align-items: center;
    gap: 14px;
    opacity: 0.35;
    transition: opacity 0.4s;
  }

  .progress-step.active { opacity: 1; }
  .progress-step.done { opacity: 0.6; }

  .step-icon {
    width: 36px; height: 36px;
    border-radius: 50%;
    border: 2px solid var(--dark3);
    display: flex; align-items: center; justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
    transition: all 0.4s;
  }

  .progress-step.active .step-icon {
    border-color: var(--gold);
    background: rgba(200,169,110,0.1);
    animation: pulse 1.5s infinite;
  }

  .progress-step.done .step-icon {
    border-color: var(--green);
    background: rgba(34,197,94,0.1);
    color: var(--green);
  }

  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(200,169,110,0.3); }
    50% { box-shadow: 0 0 0 8px rgba(200,169,110,0); }
  }

  .step-label { font-size: 14px; color: var(--cream); }
  .step-label span { display: block; font-size: 12px; color: var(--muted); margin-top: 2px; }

  /* ── Item Card ── */
  .item-card {
    display: none;
    background: var(--dark2);
    border: 1px solid var(--dark3);
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 24px;
  }

  .item-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
    flex-wrap: wrap;
    gap: 12px;
  }

  .item-name {
    font-family: 'Playfair Display', serif;
    font-size: 22px;
    color: var(--gold);
    line-height: 1.3;
  }

  .item-brand { font-size: 13px; color: var(--muted); margin-top: 4px; }

  .condition-badge {
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
  }

  .cond-excellent { background: rgba(34,197,94,0.15); color: var(--green); border: 1px solid rgba(34,197,94,0.3); }
  .cond-good { background: rgba(132,204,22,0.15); color: #84cc16; border: 1px solid rgba(132,204,22,0.3); }
  .cond-fair { background: rgba(245,158,11,0.15); color: #f59e0b; border: 1px solid rgba(245,158,11,0.3); }
  .cond-poor { background: rgba(239,68,68,0.15); color: var(--red); border: 1px solid rgba(239,68,68,0.3); }

  .item-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }

  .meta-tag {
    background: var(--dark3);
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    color: var(--muted);
  }

  .meta-tag strong { color: var(--cream); }

  .item-notes {
    font-size: 13px;
    color: var(--muted);
    line-height: 1.6;
    padding: 12px;
    background: var(--dark3);
    border-radius: 8px;
    margin-top: 8px;
  }

  .viability-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    font-size: 13px;
  }

  .viability-high { color: var(--green); }
  .viability-medium { color: #f59e0b; }
  .viability-low { color: var(--red); }

  /* ── Platform Cards ── */
  .platforms-section { display: none; }

  .section-title {
    font-family: 'Playfair Display', serif;
    font-size: 18px;
    color: var(--cream);
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .section-title::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--dark3);
  }

  .market-insight {
    background: rgba(200,169,110,0.08);
    border: 1px solid rgba(200,169,110,0.2);
    border-radius: 10px;
    padding: 16px 20px;
    font-size: 13px;
    color: var(--cream);
    line-height: 1.7;
    margin-bottom: 20px;
  }

  .platform-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
    gap: 16px;
    margin-bottom: 32px;
  }

  @media (max-width: 480px) {
    .platform-grid { grid-template-columns: 1fr; }
  }

  .platform-card {
    background: var(--dark2);
    border: 1px solid var(--dark3);
    border-radius: 12px;
    overflow: hidden;
    transition: border-color 0.2s;
  }

  .platform-card.approved { border-color: var(--green); }
  .platform-card.held { border-color: var(--muted); opacity: 0.6; }

  .platform-header {
    padding: 14px 18px;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .platform-dot {
    width: 10px; height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .platform-name {
    font-weight: 600;
    font-size: 14px;
    flex: 1;
  }

  .platform-badge {
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 10px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .badge-best { background: rgba(200,169,110,0.2); color: var(--gold); }
  .badge-fast { background: rgba(59,130,246,0.2); color: var(--blue); }

  .platform-body { padding: 0 18px 18px; }

  .price-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 8px;
  }

  .price-main {
    font-family: 'Playfair Display', serif;
    font-size: 28px;
    color: var(--gold);
  }

  .price-range {
    font-size: 12px;
    color: var(--muted);
  }

  .sell-time {
    font-size: 12px;
    color: var(--muted);
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .suitability-row {
    font-size: 12px;
    color: var(--muted);
    margin-bottom: 14px;
    line-height: 1.5;
  }

  /* Listing toggle */
  .listing-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 12px;
    color: var(--muted);
    margin-bottom: 10px;
    user-select: none;
    transition: color 0.2s;
  }

  .listing-toggle:hover { color: var(--gold); }

  .listing-content {
    display: none;
    background: var(--dark3);
    border-radius: 8px;
    padding: 14px;
    margin-bottom: 14px;
  }

  .listing-content.open { display: block; }

  .listing-title-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
    margin-bottom: 4px;
  }

  .listing-title-text {
    font-size: 13px;
    font-weight: 500;
    color: var(--cream);
    margin-bottom: 12px;
    line-height: 1.4;
  }

  .listing-desc-text {
    font-size: 12px;
    color: var(--muted);
    line-height: 1.7;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .copy-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--dark);
    border: 1px solid var(--dark3);
    color: var(--muted);
    padding: 5px 12px;
    border-radius: 6px;
    font-size: 11px;
    cursor: pointer;
    margin-top: 10px;
    font-family: 'DM Sans', sans-serif;
    transition: all 0.2s;
  }

  .copy-btn:hover { border-color: var(--gold); color: var(--gold); }
  .copy-btn.copied { color: var(--green); border-color: var(--green); }

  /* Action buttons */
  .action-row {
    display: flex;
    gap: 8px;
  }

  .btn-approve {
    flex: 1;
    background: rgba(34,197,94,0.12);
    border: 1px solid rgba(34,197,94,0.3);
    color: var(--green);
    padding: 9px;
    border-radius: 7px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    transition: all 0.2s;
    display: flex; align-items: center; justify-content: center; gap: 6px;
  }

  .btn-approve:hover, .btn-approve.active {
    background: rgba(34,197,94,0.22);
  }

  .btn-hold {
    flex: 1;
    background: rgba(107,114,128,0.12);
    border: 1px solid rgba(107,114,128,0.3);
    color: var(--muted);
    padding: 9px;
    border-radius: 7px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    transition: all 0.2s;
    display: flex; align-items: center; justify-content: center; gap: 6px;
  }

  .btn-hold:hover, .btn-hold.active {
    background: rgba(107,114,128,0.22);
  }

  /* ── Summary ── */
  .summary-bar {
    display: none;
    background: var(--dark2);
    border: 1px solid var(--dark3);
    border-radius: 12px;
    padding: 20px 24px;
    margin-top: 8px;
  }

  .summary-title {
    font-family: 'Playfair Display', serif;
    font-size: 16px;
    color: var(--gold);
    margin-bottom: 16px;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px;
  }

  .summary-stat {
    background: var(--dark3);
    border-radius: 8px;
    padding: 12px;
    text-align: center;
  }

  .summary-stat .val {
    font-family: 'Playfair Display', serif;
    font-size: 22px;
    color: var(--gold);
  }

  .summary-stat .lbl {
    font-size: 11px;
    color: var(--muted);
    margin-top: 2px;
  }

  /* ── Error ── */
  .error-bar {
    display: none;
    background: rgba(239,68,68,0.1);
    border: 1px solid rgba(239,68,68,0.3);
    border-radius: 10px;
    padding: 14px 18px;
    font-size: 13px;
    color: #fca5a5;
    margin-bottom: 20px;
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  /* Platform colours */
  .ebay-color { color: #E53238; }
  .fb-color { color: #1877F2; }
  .vinted-color { color: #09B1BA; }
  .gumtree-color { color: #72BF44; }

  .ebay-dot { background: #E53238; }
  .fb-dot { background: #1877F2; }
  .vinted-dot { background: #09B1BA; }
  .gumtree-dot { background: #72BF44; }

  .ebay-header { background: rgba(229,50,56,0.08); border-bottom: 1px solid rgba(229,50,56,0.15); }
  .fb-header { background: rgba(24,119,242,0.08); border-bottom: 1px solid rgba(24,119,242,0.15); }
  .vinted-header { background: rgba(9,177,186,0.08); border-bottom: 1px solid rgba(9,177,186,0.15); }
  .gumtree-header { background: rgba(114,191,68,0.08); border-bottom: 1px solid rgba(114,191,68,0.15); }

  /* Spinner */
  .spinner {
    display: inline-block;
    width: 16px; height: 16px;
    border: 2px solid rgba(13,17,23,0.3);
    border-top-color: var(--dark);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>

<header>
  <div class="logo">HC</div>
  <div>
    <div class="brand-name">Home Cleared</div>
    <div class="brand-sub">AI Valuation & Listing Tool</div>
  </div>
  <button class="reset-btn" onclick="resetApp()" id="resetBtn" style="display:none">↺ New Item</button>
</header>

<main>

  <!-- Error bar -->
  <div class="error-bar" id="errorBar" style="display:none">
    <span>⚠️</span>
    <span id="errorMsg">Something went wrong. Please try again.</span>
  </div>

  <!-- Upload zone -->
  <div class="upload-zone" id="uploadZone">
    <input type="file" id="fileInput" accept="image/*" capture="environment">
    <span class="upload-icon">📷</span>
    <h2>Photograph your item</h2>
    <p>Take a photo or upload an image of any clearance item.<br>The AI will identify it, research market prices, and write<br>ready-to-post listings for 4 platforms in under 60 seconds.</p>
    <button class="btn-upload" onclick="document.getElementById('fileInput').click()">Choose Photo</button>
  </div>

  <!-- Image preview -->
  <div class="preview-wrap" id="previewWrap">
    <img id="previewImg" src="" alt="Item preview">
    <div class="preview-actions">
      <button class="btn-analyse" id="analyseBtn" onclick="runAnalysis()">
        <span>✦</span> Analyse Item
      </button>
      <button class="btn-secondary" onclick="resetApp()">Change Photo</button>
    </div>
  </div>

  <!-- Progress -->
  <div class="progress-bar" id="progressBar">
    <div class="progress-steps">
      <div class="progress-step" id="step1">
        <div class="step-icon">📷</div>
        <div class="step-label">Identifying item<span id="step1sub">Analysing image with AI...</span></div>
      </div>
      <div class="progress-step" id="step2">
        <div class="step-icon">📊</div>
        <div class="step-label">Researching market prices<span id="step2sub">Checking eBay, Facebook, Vinted & Gumtree...</span></div>
      </div>
      <div class="progress-step" id="step3">
        <div class="step-icon">✍️</div>
        <div class="step-label">Writing listings<span id="step3sub">Creating platform-optimised copy...</span></div>
      </div>
    </div>
  </div>

  <!-- Item card -->
  <div class="item-card" id="itemCard">
    <div class="item-card-header">
      <div>
        <div class="item-name" id="itemName">—</div>
        <div class="item-brand" id="itemBrand"></div>
      </div>
      <span class="condition-badge" id="condBadge">—</span>
    </div>
    <div class="item-meta" id="itemMeta"></div>
    <div class="item-notes" id="itemNotes"></div>
    <div class="viability-row" id="viabilityRow"></div>
  </div>

  <!-- Platform section -->
  <div class="platforms-section" id="platformsSection">
    <div class="section-title">Market Pricing & Listings</div>

    <div class="market-insight" id="marketInsight"></div>

    <div class="platform-grid" id="platformGrid">
      <!-- Populated by JS -->
    </div>

    <!-- Summary -->
    <div class="summary-bar" id="summaryBar">
      <div class="summary-title">Session Summary</div>
      <div class="summary-grid" id="summaryGrid"></div>
    </div>
  </div>

</main>

<script>
// ── State ──────────────────────────────────────────────────────────────────────
let state = {
  imageFile: null,
  item: null,
  market: null,
  listings: null,
  decisions: { ebay: null, facebook: null, vinted: null, gumtree: null },
};

// ── File handling ──────────────────────────────────────────────────────────────
const fileInput = document.getElementById('fileInput');
const uploadZone = document.getElementById('uploadZone');

uploadZone.addEventListener('click', (e) => {
  if (e.target.classList.contains('btn-upload')) return;
  fileInput.click();
});

uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

function handleFile(file) {
  if (!file.type.startsWith('image/')) { showError('Please select an image file.'); return; }
  state.imageFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('previewImg').src = e.target.result;
    show('previewWrap');
    hide('uploadZone');
    show('resetBtn');
    hide('errorBar');
  };
  reader.readAsDataURL(file);
}

// ── Analysis pipeline ──────────────────────────────────────────────────────────
async function runAnalysis() {
  if (!state.imageFile) return;

  const btn = document.getElementById('analyseBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Analysing...';

  hide('previewWrap');
  hide('errorBar');
  showProgress();

  try {
    // Step 1 — Identify
    setStep(1, 'active');
    const formData = new FormData();
    formData.append('image', state.imageFile);

    const r1 = await fetch('/api/identify', { method: 'POST', body: formData });
    const d1 = await r1.json();
    if (!d1.success) throw new Error(d1.error || 'Identification failed');
    state.item = d1.item;
    setStep(1, 'done');

    // Step 2 — Market
    setStep(2, 'active');
    const r2 = await fetch('/api/market', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: state.item }),
    });
    const d2 = await r2.json();
    if (!d2.success) throw new Error(d2.error || 'Market research failed');
    state.market = d2.market;
    setStep(2, 'done');

    // Step 3 — Listings
    setStep(3, 'active');
    const r3 = await fetch('/api/listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: state.item, market: state.market }),
    });
    const d3 = await r3.json();
    if (!d3.success) throw new Error(d3.error || 'Listing generation failed');
    state.listings = d3.listings;
    setStep(3, 'done');

    // Render
    hide('progressBar');
    renderItemCard();
    renderPlatforms();

  } catch (err) {
    hide('progressBar');
    show('uploadZone');
    show('previewWrap');
    showError(err.message || 'Something went wrong. Please try again.');
    btn.disabled = false;
    btn.innerHTML = '<span>✦</span> Analyse Item';
  }
}

// ── Render item card ───────────────────────────────────────────────────────────
function renderItemCard() {
  const item = state.item;
  document.getElementById('itemName').textContent = item.itemName || '—';
  document.getElementById('itemBrand').textContent = item.brand ? \`\${item.brand}\${item.model ? ' · ' + item.model : ''}\` : '';

  const badge = document.getElementById('condBadge');
  badge.textContent = item.condition;
  badge.className = 'condition-badge cond-' + (item.condition || '').toLowerCase();

  const meta = document.getElementById('itemMeta');
  const tags = [
    item.category && \`<div class="meta-tag"><strong>Category:</strong> \${item.category}</div>\`,
    item.colour && \`<div class="meta-tag"><strong>Colour:</strong> \${item.colour}</div>\`,
    item.material && \`<div class="meta-tag"><strong>Material:</strong> \${item.material}</div>\`,
    item.estimatedAge && \`<div class="meta-tag"><strong>Era:</strong> \${item.estimatedAge}</div>\`,
    item.confidence && \`<div class="meta-tag"><strong>Confidence:</strong> \${item.confidence}%</div>\`,
  ].filter(Boolean);
  meta.innerHTML = tags.join('');

  document.getElementById('itemNotes').textContent = item.conditionNotes || '';

  const vRow = document.getElementById('viabilityRow');
  const vClass = { High: 'viability-high', Medium: 'viability-medium', Low: 'viability-low' }[item.resaleViability] || '';
  vRow.innerHTML = \`<span class="\${vClass}">● \${item.resaleViability} resale viability</span><span style="color:var(--muted);margin-left:8px;font-size:13px">\${item.resaleNotes || ''}</span>\`;

  show('itemCard');
}

// ── Render platforms ───────────────────────────────────────────────────────────
const PLATFORM_META = {
  ebay:     { label: 'eBay',               dotClass: 'ebay-dot',    headerClass: 'ebay-header',    colorClass: 'ebay-color' },
  facebook: { label: 'Facebook Marketplace', dotClass: 'fb-dot',   headerClass: 'fb-header',      colorClass: 'fb-color' },
  vinted:   { label: 'Vinted',             dotClass: 'vinted-dot',  headerClass: 'vinted-header',  colorClass: 'vinted-color' },
  gumtree:  { label: 'Gumtree',            dotClass: 'gumtree-dot', headerClass: 'gumtree-header', colorClass: 'gumtree-color' },
};

function renderPlatforms() {
  const m = state.market;
  const l = state.listings;

  document.getElementById('marketInsight').textContent = m.marketInsight || '';

  const grid = document.getElementById('platformGrid');
  grid.innerHTML = '';

  ['ebay', 'facebook', 'vinted', 'gumtree'].forEach((key) => {
    const pm = m.platforms[key] || {};
    const pl = l[key] || {};
    const meta = PLATFORM_META[key];

    const isBest = m.bestPlatform === key;
    const isFast = m.fastestSale === key;

    const badges = [
      isBest ? \`<span class="platform-badge badge-best">★ Best price</span>\` : '',
      isFast ? \`<span class="platform-badge badge-fast">⚡ Fastest sale</span>\` : '',
    ].join('');

    const comparables = (pm.comparables || []).map(c =>
      \`<div style="display:flex;justify-content:space-between;font-size:11px;margin-top:6px;color:var(--muted)">
        <span>\${c.title}</span>
        <span style="color:var(--cream);font-weight:500;margin-left:12px;flex-shrink:0">£\${c.price} <span style="opacity:0.6">\${c.status}</span></span>
      </div>\`
    ).join('');

    const card = document.createElement('div');
    card.className = 'platform-card';
    card.id = \`card-\${key}\`;
    card.innerHTML = \`
      <div class="platform-header \${meta.headerClass}">
        <div class="platform-dot \${meta.dotClass}"></div>
        <span class="platform-name \${meta.colorClass}">\${meta.label}</span>
        <div style="display:flex;gap:6px;flex-wrap:wrap">\${badges}</div>
      </div>
      <div class="platform-body">
        <div class="price-row">
          <div class="price-main">£\${pm.recommendedPrice || '—'}</div>
          <div class="price-range">Range £\${pm.priceRange?.low || '?'}–£\${pm.priceRange?.high || '?'}</div>
        </div>
        <div class="sell-time">⏱ Est. sell time: \${pm.estimatedSellTime || '—'}</div>
        <div class="suitability-row">\${pm.suitabilityReason || ''}</div>

        \${comparables ? \`<div style="margin-bottom:14px;padding:10px;background:var(--dark3);border-radius:8px"><div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--muted);margin-bottom:2px">Comparables</div>\${comparables}</div>\` : ''}

        <div class="listing-toggle" onclick="toggleListing('\${key}')">
          <span id="toggle-icon-\${key}">▶</span>
          <span>View listing copy</span>
        </div>
        <div class="listing-content" id="listing-\${key}">
          <div class="listing-title-label">Title</div>
          <div class="listing-title-text">\${pl.title || '—'}</div>
          <div class="listing-title-label">Description</div>
          <div class="listing-desc-text">\${pl.description || '—'}</div>
          \${pl.hashtags?.length ? \`<div style="margin-top:8px;font-size:11px;color:var(--blue)">\${pl.hashtags.join(' ')}</div>\` : ''}
          <button class="copy-btn" onclick="copyListing('\${key}')">
            <span>⎘</span> Copy listing
          </button>
        </div>

        <div class="action-row">
          <button class="btn-approve" id="approve-\${key}" onclick="decide('\${key}','approve')">✓ Approve</button>
          <button class="btn-hold" id="hold-\${key}" onclick="decide('\${key}','hold')">⏸ Hold</button>
        </div>
      </div>
    \`;
    grid.appendChild(card);
  });

  show('platformsSection');
  show('summaryBar');
  updateSummary();
}

function toggleListing(key) {
  const el = document.getElementById(\`listing-\${key}\`);
  const icon = document.getElementById(\`toggle-icon-\${key}\`);
  el.classList.toggle('open');
  icon.textContent = el.classList.contains('open') ? '▼' : '▶';
}

function copyListing(key) {
  const l = state.listings[key];
  if (!l) return;
  const text = \`\${l.title}\\n\\n\${l.description}\${l.hashtags?.length ? '\\n\\n' + l.hashtags.join(' ') : ''}\`;
  navigator.clipboard.writeText(text).then(() => {
    const btns = document.querySelectorAll(\`#card-\${key} .copy-btn\`);
    btns.forEach(b => { b.textContent = '✓ Copied!'; b.classList.add('copied'); });
    setTimeout(() => btns.forEach(b => { b.innerHTML = '<span>⎘</span> Copy listing'; b.classList.remove('copied'); }), 2000);
  });
}

function decide(key, action) {
  state.decisions[key] = action;
  const card = document.getElementById(\`card-\${key}\`);
  const approveBtn = document.getElementById(\`approve-\${key}\`);
  const holdBtn = document.getElementById(\`hold-\${key}\`);

  card.className = 'platform-card ' + (action === 'approve' ? 'approved' : 'held');
  approveBtn.classList.toggle('active', action === 'approve');
  holdBtn.classList.toggle('active', action === 'hold');

  updateSummary();
}

function updateSummary() {
  const d = state.decisions;
  const approved = Object.entries(d).filter(([,v]) => v === 'approve').map(([k]) => PLATFORM_META[k]?.label);
  const held = Object.entries(d).filter(([,v]) => v === 'hold').length;
  const total = state.market?.totalEstimatedValue || 0;

  document.getElementById('summaryGrid').innerHTML = \`
    <div class="summary-stat"><div class="val">\${approved.length}</div><div class="lbl">Approved</div></div>
    <div class="summary-stat"><div class="val">\${held}</div><div class="lbl">On Hold</div></div>
    <div class="summary-stat"><div class="val">£\${total}</div><div class="lbl">Est. Value</div></div>
    <div class="summary-stat"><div class="val">\${state.market?.bestPlatform ? PLATFORM_META[state.market.bestPlatform]?.label : '—'}</div><div class="lbl">Best Platform</div></div>
  \`;
}

// ── Progress helpers ───────────────────────────────────────────────────────────
function showProgress() {
  show('progressBar');
  ['step1','step2','step3'].forEach(s => {
    const el = document.getElementById(s);
    el.classList.remove('active','done');
  });
}

function setStep(n, status) {
  const el = document.getElementById(\`step\${n}\`);
  el.classList.remove('active','done');
  if (status) el.classList.add(status);
}

// ── Utility ────────────────────────────────────────────────────────────────────
function show(id) { const el = document.getElementById(id); if(el) el.style.display = ''; }
function hide(id) { const el = document.getElementById(id); if(el) el.style.display = 'none'; }

function showError(msg) {
  const bar = document.getElementById('errorBar');
  document.getElementById('errorMsg').textContent = msg;
  bar.style.display = 'flex';
}

function resetApp() {
  state = { imageFile: null, item: null, market: null, listings: null, decisions: { ebay: null, facebook: null, vinted: null, gumtree: null } };
  document.getElementById('fileInput').value = '';
  document.getElementById('previewImg').src = '';
  document.getElementById('analyseBtn').disabled = false;
  document.getElementById('analyseBtn').innerHTML = '<span>✦</span> Analyse Item';

  ['previewWrap','progressBar','itemCard','platformsSection','summaryBar','errorBar'].forEach(hide);
  ['uploadZone'].forEach(show);
  hide('resetBtn');
}
</script>
</body>
</html>
`;

app.get("*", (req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(HTML);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Home Cleared running on http://localhost:${PORT}`));
