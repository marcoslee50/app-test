const express = require('express');
const multer = require('multer');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(cors());
app.use(express.json());

// ─── GUIDE ROUTE ────────────────────────────────────────────────────────────
app.get('/guide', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HomeCleared — App Guide</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f0f4f8; color: #1a202c; }
    header { background: #1a3c2e; color: white; padding: 24px 32px; }
    header h1 { font-size: 1.6rem; }
    header p { opacity: 0.8; margin-top: 4px; font-size: 0.95rem; }
    main { max-width: 760px; margin: 32px auto; padding: 0 20px; }
    .card { background: white; border-radius: 12px; padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.07); }
    .card h2 { color: #1a3c2e; font-size: 1.1rem; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
    .card p, .card li { font-size: 0.95rem; line-height: 1.7; color: #4a5568; }
    .card ol, .card ul { padding-left: 20px; }
    .card li { margin-bottom: 6px; }
    .badge { background: #e6f4ee; color: #1a3c2e; font-size: 0.75rem; font-weight: 600; padding: 2px 8px; border-radius: 99px; }
    .tip { background: #fff8e6; border-left: 4px solid #f6ad3c; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-top: 12px; font-size: 0.9rem; color: #744210; }
    a.cta { display: inline-block; margin-top: 16px; background: #1a3c2e; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.9rem; }
    a.cta:hover { background: #2d6a4f; }
  </style>
</head>
<body>
  <header>
    <h1>🏠 HomeCleared Valuation App</h1>
    <p>Staff guide — how to use the photo valuation tool</p>
  </header>
  <main>

    <div class="card">
      <h2>📸 What this app does</h2>
      <p>You take a photo of an item from a house clearance. The app uses AI to identify it, estimate its market value, and generate ready-to-post listings for four platforms: <strong>eBay, Facebook Marketplace, Vinted, and Gumtree</strong>.</p>
    </div>

    <div class="card">
      <h2>🚀 How to use it <span class="badge">Step by step</span></h2>
      <ol>
        <li>Open the app at the main URL (not /guide).</li>
        <li>Click <strong>"Choose File"</strong> and select a photo of the item.</li>
        <li>Click <strong>"Analyse Item"</strong> and wait a few seconds.</li>
        <li>The app will show you: what the item is, estimated value, and four platform listings.</li>
        <li>Click <strong>"Approve"</strong> to mark it ready to list, or <strong>"Hold"</strong> if you're unsure.</li>
      </ol>
      <div class="tip">💡 Tip: Good lighting and a clear background give the best results. Lay the item flat if possible.</div>
    </div>

    <div class="card">
      <h2>📋 The four listing platforms</h2>
      <ul>
        <li><strong>eBay</strong> — best for antiques, collectables, electronics</li>
        <li><strong>Facebook Marketplace</strong> — best for furniture and local collection items</li>
        <li><strong>Vinted</strong> — best for clothing, shoes, accessories</li>
        <li><strong>Gumtree</strong> — general items, tools, household goods</li>
      </ul>
    </div>

    <div class="card">
      <h2>⚠️ Things to know</h2>
      <ul>
        <li>The AI gives an estimate — always use your own judgement on rare or high-value items.</li>
        <li>Photos of multiple items at once may give less accurate results — photograph one item at a time.</li>
        <li>The app does not post listings automatically — you still copy and paste to each platform.</li>
      </ul>
    </div>

    <div class="card">
      <h2>🆘 Problems?</h2>
      <p>If the app isn't loading or the analysis fails, contact Martin. Don't refresh mid-analysis as this will lose your result.</p>
      <a class="cta" href="/">← Back to the app</a>
    </div>

  </main>
</body>
</html>`);
});

// ─── MAIN APP ROUTE ──────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HomeCleared — Item Valuation</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f0f4f8; color: #1a202c; }
    header { background: #1a3c2e; color: white; padding: 20px 32px; display: flex; justify-content: space-between; align-items: center; }
    header h1 { font-size: 1.4rem; }
    header a { color: rgba(255,255,255,0.75); font-size: 0.85rem; text-decoration: none; }
    header a:hover { color: white; }
    main { max-width: 700px; margin: 32px auto; padding: 0 20px; }
    .card { background: white; border-radius: 12px; padding: 28px; margin-bottom: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.07); }
    .card h2 { color: #1a3c2e; font-size: 1rem; margin-bottom: 16px; }
    .upload-area { border: 2px dashed #cbd5e0; border-radius: 8px; padding: 32px; text-align: center; cursor: pointer; transition: border-color 0.2s; }
    .upload-area:hover { border-color: #1a3c2e; }
    .upload-area p { color: #718096; font-size: 0.9rem; margin-top: 8px; }
    input[type="file"] { display: none; }
    #preview { max-width: 100%; max-height: 260px; border-radius: 8px; margin-top: 16px; display: none; }
    button { background: #1a3c2e; color: white; border: none; padding: 12px 28px; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; width: 100%; margin-top: 16px; transition: background 0.2s; }
    button:hover { background: #2d6a4f; }
    button:disabled { background: #a0aec0; cursor: not-allowed; }
    #status { text-align: center; padding: 12px; font-size: 0.9rem; color: #718096; display: none; }
    #results { display: none; }
    .value-banner { background: #e6f4ee; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
    .value-banner .label { font-size: 0.85rem; color: #4a5568; }
    .value-banner .amount { font-size: 1.8rem; font-weight: 700; color: #1a3c2e; }
    .value-banner .item-name { font-size: 1rem; font-weight: 600; color: #2d3748; }
    .platform { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
    .platform-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .platform-name { font-weight: 700; font-size: 0.95rem; color: #1a3c2e; }
    .platform-price { font-weight: 700; color: #2d6a4f; }
    .platform-body { font-size: 0.85rem; color: #4a5568; line-height: 1.6; white-space: pre-wrap; }
    .actions { display: flex; gap: 12px; margin-top: 20px; }
    .btn-approve { background: #1a3c2e; flex: 1; }
    .btn-hold { background: #744210; flex: 1; }
    .btn-new { background: #2b6cb0; flex: 1; margin-top: 0; }
    .confirmed { text-align: center; padding: 20px; font-weight: 600; font-size: 1.1rem; color: #1a3c2e; display: none; }
  </style>
</head>
<body>
  <header>
    <h1>🏠 HomeCleared — Item Valuation</h1>
    <a href="/guide">Staff Guide →</a>
  </header>
  <main>
    <div class="card" id="upload-card">
      <h2>Upload a photo of the item</h2>
      <label for="fileInput">
        <div class="upload-area" id="uploadArea">
          <div style="font-size:2.5rem">📷</div>
          <p>Click to choose a photo</p>
          <p style="font-size:0.8rem;margin-top:4px">JPG, PNG, HEIC supported</p>
        </div>
      </label>
      <input type="file" id="fileInput" accept="image/*">
      <img id="preview">
      <button id="analyseBtn" disabled>Analyse Item</button>
    </div>

    <div id="status">⏳ Analysing your item, please wait...</div>

    <div class="card" id="results">
      <div class="value-banner">
        <div>
          <div class="label">Identified item</div>
          <div class="item-name" id="itemName">—</div>
        </div>
        <div style="text-align:right">
          <div class="label">Estimated value</div>
          <div class="amount" id="itemValue">—</div>
        </div>
      </div>
      <h2 style="margin-bottom:12px">Suggested listings</h2>
      <div id="listings"></div>
      <div class="actions">
        <button class="btn-approve" onclick="markStatus('approved')">✅ Approve</button>
        <button class="btn-hold" onclick="markStatus('hold')">⏸ Hold</button>
        <button class="btn-new" onclick="resetApp()">📷 New Item</button>
      </div>
      <div class="confirmed" id="confirmed"></div>
    </div>
  </main>

  <script>
    const fileInput = document.getElementById('fileInput');
    const preview = document.getElementById('preview');
    const analyseBtn = document.getElementById('analyseBtn');
    const status = document.getElementById('status');
    const results = document.getElementById('results');

    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        preview.src = e.target.result;
        preview.style.display = 'block';
        analyseBtn.disabled = false;
      };
      reader.readAsDataURL(file);
    });

    analyseBtn.addEventListener('click', async () => {
      const file = fileInput.files[0];
      if (!file) return;

      analyseBtn.disabled = true;
      status.style.display = 'block';
      results.style.display = 'none';

      const formData = new FormData();
      formData.append('image', file);

      try {
        const res = await fetch('/analyse', { method: 'POST', body: formData });
        const data = await res.json();

        document.getElementById('itemName').textContent = data.itemName || 'Unknown item';
        document.getElementById('itemValue').textContent = data.estimatedValue || '—';

        const listingsEl = document.getElementById('listings');
        listingsEl.innerHTML = '';
        (data.listings || []).forEach(l => {
          listingsEl.innerHTML += \`
            <div class="platform">
              <div class="platform-header">
                <span class="platform-name">\${l.platform}</span>
                <span class="platform-price">\${l.price}</span>
              </div>
              <div class="platform-body">\${l.listing}</div>
            </div>
          \`;
        });

        status.style.display = 'none';
        results.style.display = 'block';
      } catch (err) {
        status.textContent = '❌ Something went wrong. Please try again.';
        analyseBtn.disabled = false;
      }
    });

    function markStatus(s) {
      const msg = s === 'approved' ? '✅ Item approved for listing!' : '⏸ Item held for review.';
      document.getElementById('confirmed').textContent = msg;
      document.getElementById('confirmed').style.display = 'block';
    }

    function resetApp() {
      fileInput.value = '';
      preview.style.display = 'none';
      preview.src = '';
      analyseBtn.disabled = true;
      status.style.display = 'none';
      status.textContent = '⏳ Analysing your item, please wait...';
      results.style.display = 'none';
      document.getElementById('confirmed').style.display = 'none';
    }
  </script>
</body>
</html>`);
});

// ─── ANALYSE ENDPOINT ────────────────────────────────────────────────────────
app.post('/analyse', upload.single('image'), async (req, res) => {
  try {
    const imageBuffer = fs.readFileSync(req.file.path);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = req.file.mimetype;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: base64Image }
          },
          {
            type: 'text',
            text: `You are a secondhand goods valuation expert working for HomeCleared, a UK house clearance social enterprise.

Analyse this image and respond ONLY with valid JSON in this exact format:
{
  "itemName": "Brief item name",
  "estimatedValue": "£X – £Y",
  "condition": "Good / Fair / Poor",
  "listings": [
    {
      "platform": "eBay",
      "price": "£XX",
      "listing": "Title: ...\\n\\nDescription: ...\\n\\nCondition: ..."
    },
    {
      "platform": "Facebook Marketplace",
      "price": "£XX",
      "listing": "Title: ...\\n\\nDescription: ...\\n\\nCollection: Wirral area"
    },
    {
      "platform": "Vinted",
      "price": "£XX",
      "listing": "Title: ...\\n\\nDescription: ..."
    },
    {
      "platform": "Gumtree",
      "price": "£XX",
      "listing": "Title: ...\\n\\nDescription: ...\\n\\nLocation: Wirral"
    }
  ]
}

Use UK English. Prices in GBP. Keep listings concise and appealing. If the item has no resale value, set estimatedValue to "£0 – not for resale" and explain briefly in each listing field.`
          }
        ]
      }]
    });

    // Clean up temp file
    fs.unlinkSync(req.file.path);

    const text = response.content[0].text;
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    res.json(parsed);

  } catch (err) {
    console.error(err);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Analysis failed', detail: err.message });
  }
});

// ─── START ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`HomeCleared app running on port ${PORT}`));
