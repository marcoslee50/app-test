# Home Cleared — AI Valuation & Listing Tool

## What's in this folder

```
home-cleared/
├── server.js          ← Backend (Express API + serves frontend)
├── package.json       ← Dependencies
├── public/
│   └── index.html     ← Complete frontend (no build step needed)
└── README.md          ← This file
```

## Quick Start (Local Test)

1. Install Node.js from nodejs.org if you don't have it
2. Open Terminal in this folder
3. Run: `npm install`
4. Run: `ANTHROPIC_API_KEY=your_key_here npm start`
5. Open http://localhost:3000 in your browser

## Deploy to Hostinger VPS

### One-time setup
```bash
# SSH into your VPS
ssh root@YOUR_VPS_IP

# Install PM2 globally
npm install -g pm2

# Clone or upload your files to /var/www/home-cleared
# (see GitHub deployment guide for upload steps)

cd /var/www/home-cleared
npm install

# Add your API key
echo "ANTHROPIC_API_KEY=your_actual_key_here" > .env
```

### Start with PM2 (always-on)
```bash
pm2 start server.js --name "home-cleared"
pm2 save
pm2 startup
# Run the command it outputs
```

### Check it's running
```bash
pm2 status
# Visit http://YOUR_VPS_IP:3000
```

## Deploy to Railway (Easiest)

1. Push this folder to a GitHub repo
2. Go to railway.app → New Project → Deploy from GitHub
3. Select your repo
4. In Settings → Variables, add: `ANTHROPIC_API_KEY = your_key`
5. Done — Railway gives you a live URL automatically

## Deploy to Replit

1. Create a new Replit project (Node.js template)
2. Upload all files keeping the same folder structure
3. In Replit Secrets, add: `ANTHROPIC_API_KEY = your_key`
4. Click Run

## Environment Variables

| Variable | Required | Where to get it |
|----------|----------|----------------|
| `ANTHROPIC_API_KEY` | ✅ Yes | console.anthropic.com |

## Costs

- Anthropic API: ~£0.01–0.03 per full analysis (3 AI calls)
- Hostinger VPS: ~£4–6/month
- Total: Very cheap to run

## Adding subscription payments (future)

When ready to charge subscribers, add Stripe:
```bash
npm install stripe
```
Then wrap the API routes with a middleware that checks for a valid subscription.
