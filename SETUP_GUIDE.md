# Wazeer â€” API Key Setup Guide
## Get your 5 critical keys in under 30 minutes

---

## ðŸ”‘ THE 5 KEYS YOU NEED

| # | Key | Unlocks | Time |
|---|-----|---------|------|
| 1 | **Supabase** (you probably have this) | Database, Auth | 0 min |
| 2 | **Lovable API Key** | AI generation | 2 min |
| 3 | **Resend API Key** | Email delivery | 3 min |
| 4 | **Paddle Client Token + API Key** | Payments | 5 min |
| 5 | **Meta App ID + App Secret** | Facebook/Instagram posts | 10 min |

---

## 1ï¸âƒ£ SUPABASE (You likely already have this)

**What it does:** Database, authentication, file storage

**Where to find:**
1. Go to https://supabase.com/dashboard
2. Click your project
3. Go to **Project Settings** (gear icon, bottom left)
4. Click **API** in the left sidebar
5. Copy these two values:

```
Project URL â†’ SUPABASE_URL=https://your-project.supabase.co
Project API keys â†’ anon public â†’ SUPABASE_PUBLISHABLE_KEY=eyJ...
```

6. Also get the service role key (for webhooks):
```
Project API keys â†’ service_role secret â†’ SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## 2ï¸âƒ£ LOVABLE API KEY (AI Generation)

**What it does:** Powers ALL AI generation â€” business creation, images, videos, posts, ads, emails

**Where to get:**
1. Go to https://cloud.lovable.dev/
2. Sign up / Log in
3. Click your profile (top right) â†’ **API Keys**
4. Click **Create new key**
5. Name it "Wazeer Production"
6. Copy the key:

```env
LOVABLE_API_KEY=lovable_your_key_here
```

**Cost:** Pay-as-you-go based on usage. Roughly $0.001-0.01 per AI call.

---

## 3ï¸âƒ£ RESEND API KEY (Email Delivery)

**What it does:** Sends real emails to real inboxes. Tracks opens, clicks, bounces.

**Where to get:**
1. Go to https://resend.com/signup
2. Sign up with your email (free tier: 3,000 emails/day)
3. Verify your email
4. Go to https://resend.com/api-keys
5. Click **Create API Key**
6. Name: "Wazeer Production"
7. Permission: **Sending access**
8. Copy the key:

```env
RESEND_API_KEY=re_your_key_here
```

### Also set up your sending domain:
1. Go to https://resend.com/domains
2. Click **Add Domain**
3. Enter your domain (e.g., `yourdomain.com` or a subdomain like `mail.yourdomain.com`)
4. Resend will show you DNS records to add
5. Go to your DNS provider (Cloudflare, GoDaddy, Namecheap, etc.)
6. Add the records Resend gives you
7. Wait 5-10 minutes, click **Verify** in Resend
8. Set your from email:

```env
MARKETING_FROM_EMAIL="Your Name <hello@yourdomain.com>"
```

---

## 4ï¸âƒ£ PADDLE (Payments)

**What it does:** Collects real money from customers. Handles subscriptions, one-time payments, tax.

### Start with SANDBOX (test mode) â€” recommended first

**Step A: Get Client Token (frontend)**
1. Go to https://sandbox-vendors.paddle.com/signup
2. Create a sandbox account (free, for testing)
3. Once logged in, go to **Developer Tools** â†’ **Authentication**
4. Copy **Client-side Token**:

```env
VITE_PAYMENTS_CLIENT_TOKEN=test_123abc...
```

**Step B: Get API Key (backend)**
1. In the same page, copy **Default API Key**:

```env
PADDLE_SANDBOX_API_KEY=...long_key...
```

**Step C: Get Webhook Secret**
1. Go to **Developer Tools** â†’ **Notifications**
2. Click **New destination**
3. URL: `https://yourdomain.com/api/public/payments/webhook?env=sandbox`
4. Select ALL events
5. Save
6. Copy the **Webhook Secret**:

```env
PAYMENTS_SANDBOX_WEBHOOK_SECRET=pdl_ntfset_...
```

### When ready for LIVE payments:
1. Go to https://vendors.paddle.com/ (NOT sandbox)
2. Complete Paddle's seller verification (business docs, bank account)
3. Repeat steps A-C above but with live credentials:

```env
VITE_PAYMENTS_CLIENT_TOKEN=live_123abc...
PADDLE_LIVE_API_KEY=...
PAYMENTS_LIVE_WEBHOOK_SECRET=pdl_ntfset_...
```

---

## 5ï¸âƒ£ META / FACEBOOK (Social Publishing)

**What it does:** Publishes posts to Facebook Pages and Instagram Business accounts

**Where to get:**
1. Go to https://developers.facebook.com/apps/
2. Click **Create App**
3. Select **Business** app type
4. App name: "Wazeer Publisher"
5. App contact email: your email
6. Click **Create App**
7. You may need to verify your Facebook Business account

**Get the keys:**
1. In your app dashboard, go to **Settings** â†’ **Basic**
2. Copy:

```env
META_APP_ID=1234567890
META_APP_SECRET=abc123...
```

3. Generate a random encryption key (32+ characters):

```env
META_TOKEN_ENCRYPTION_KEY=your-random-32-char-key-here!!!
```

> Tip: Use a password generator or run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

4. Set your redirect URI:

```env
META_REDIRECT_URI=https://yourdomain.com/dashboard/integrations/meta
```

**Add Products to your app:**
1. In the app dashboard, click **Add Product**
2. Add **Facebook Login**
3. Add **Pages API**
4. Go through App Review when ready for production ( Meta requires review for non-test users )

---

## ðŸ“ CREATE YOUR .ENV FILE

1. Copy the example file:
```bash
cp .env.example .env
```

2. Open `.env` in your code editor

3. Fill in ALL the values above

4. **CRITICAL:** Add `.env` to `.gitignore` so you don't leak keys:
```bash
echo ".env" >> .gitignore
```

---

## ðŸš€ START YOUR APP

```bash
npm install
npm run dev
```

Then go to http://localhost:3000/dashboard/integrations/status to verify everything is green!

---

## ðŸ’¡ OPTIONAL KEYS (For Real Images/Videos)

### OpenAI (DALL-E) for images
1. Go to https://platform.openai.com/api-keys
2. Create new secret key
3. Set in `.env`:
```env
IMAGE_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

### Runway for videos
1. Go to https://runwayml.com/ â†’ API
2. Get API key
3. Set in `.env`:
```env
VIDEO_PROVIDER=runway
RUNWAY_API_KEY=...
```

---

## ðŸ†˜ TROUBLESHOOTING

| Problem | Solution |
|---------|----------|
| "AI gateway not configured" | Add `LOVABLE_API_KEY` |
| "RESEND_API_KEY not configured" | Emails will show "sent" but won't reach inboxes. Add key for real delivery. |
| "Paddle transaction creation failed" | You're in sandbox mode. Make sure `VITE_PAYMENTS_CLIENT_TOKEN` starts with `test_` and matches `PADDLE_SANDBOX_API_KEY`. |
| "Meta app credentials not configured" | Posts will save as drafts. Add `META_APP_ID` and `META_APP_SECRET` to publish to real Pages. |
| Webhook not working | Make sure your `SITE_URL` matches your actual domain. Local webhooks need ngrok or similar. |

---

## ðŸ“Š EXPECTED COSTS (Monthly)

| Service | Free Tier | Estimated Cost at Scale |
|---------|-----------|------------------------|
| Supabase | 500MB DB, 2GB bandwidth | $25/mo (Pro) |
| Lovable AI | ~$5-10 free credits | $20-50/mo |
| Resend | 3,000 emails/day | $20/mo (50K emails) |
| Paddle | Free (they take 5% + $0.50) | 5% of revenue |
| Meta Graph API | Free | Free |
| **Total fixed** | â€” | **~$65-95/mo** |

---

**Questions?** The Integrations Status page at `/dashboard/integrations/status` will show you exactly what's missing and how to fix it.
