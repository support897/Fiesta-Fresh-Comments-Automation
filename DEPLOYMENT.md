# 🚀 DEPLOYMENT GUIDE - Fiesta Fresh Bot v2.0

## ✅ What's Been Fixed

### Bot Improvements:
- ✅ **No more double commenting** - tracks replies in `replies_log` table
- ✅ **24/7 continuous loop** - runs every 60 seconds (configurable)
- ✅ **Human-like behavior** - random typing speed, pauses, overlay handling
- ✅ **Keyword quick-filter** - instant approve/reject before AI (saves $$)
- ✅ **Dry-run mode** - test without actually posting
- ✅ **Name personalization** - extracts commenter's first name
- ✅ **Proper deduplication** - composite unique key on post_id + group_url
- ✅ **Fixed Chromium installation** - correct browser version for VPS

### Dashboard Improvements:
- ✅ **Safe database queries** - uses `.maybeSingle()` instead of `.single()`
- ✅ **Removed dead code** - cleaned dependencies

### Database:
- ✅ **Added sessions table** (was missing)
- ✅ **Proper indexes** for fast queries
- ✅ **Fixed schema** with all tables

---

## 📋 DEPLOYMENT STEPS

### Step 1: Commit and Push to GitHub

```bash
cd /Users/ilse/Downloads/Career-ops/Fiesta-Fresh-Comments-Automation/Fiesta-Fresh-Comments-Automation

# Add all changes
git add -A

# Commit
git commit -m "v2.0: Fixed bot - dedup, loop, human behavior, keyword filter, render deployment"

# Push to GitHub
git push origin cleanup-phase1
```

If you get an error about upstream not set:
```bash
git push -u origin cleanup-phase1
```

---

### Step 2: Deploy Bot to Render.com

1. **Go to:** https://render.com/dashboard
2. **Click:** "New +" → "Web Service"
3. **Connect GitHub Repository:**
   - Select: `support897/Fiesta-Fresh-Comments-Automation`
   - Branch: `cleanup-phase1` (or `main` after merge)
4. **Configure:**
   - Name: `fiesta-fresh-bot`
   - Region: `Oregon (US West)` or closest to you
   - Root Directory: `bot`
   - Environment: `Docker`
   - Dockerfile Path: `bot/Dockerfile`
   - Plan: `Free`
5. **Add Environment Variables:** (Click "Advanced" → "Add Environment Variable")

```
SUPABASE_URL = https://xmxywlyqdqrfrojwggkt.supabase.co
SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhteHl3bHlxZHFyZnJvandnZ2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzMzI4NjUsImV4cCI6MjEwMTkwODg2NX0.p9i_3rge9IuoYz6qgL5J6dZjwptZyKU7S7AP1Bh_EHQ

FB_EMAIL = placenciailse@gmail.com
FB_PASSWORD = 20inPG05$$

PROXY_SERVER = socks5://204.1.138.221:50101
PROXY_USERNAME = jackpotvault
PROXY_PASSWORD = EYDi73Q5H6

GEMINI_API_KEY = your_gemini_api_key_here

DRY_RUN = false
SCAN_INTERVAL_SECONDS = 60
PORT = 8080
```

6. **Click:** "Create Web Service"
7. **Wait:** 5-10 minutes for build to complete

---

### Step 3: Deploy Dashboard to Vercel

1. **Go to:** https://vercel.com/new
2. **Import Git Repository:**
   - Connect GitHub
   - Select: `support897/Fiesta-Fresh-Comments-Automation`
3. **Configure:**
   - Framework Preset: `Next.js`
   - Root Directory: `dashboard`
   - Build Command: `npm run build`
   - Output Directory: `.next`
4. **Add Environment Variables:**

```
NEXT_PUBLIC_SUPABASE_URL = https://xmxywlyqdqrfrojwggkt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhteHl3bHlxZHFyZnJvandnZ2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzMzI4NjUsImV4cCI6MjEwMTkwODg2NX0.p9i_3rge9IuoYz6qgL5J6dZjwptZyKU7S7AP1Bh_EHQ
```

5. **Click:** "Deploy"
6. **Wait:** 2-3 minutes

---

### Step 4: Activate the Bot

1. **Go to your dashboard URL** (Vercel will give you the URL)
2. **Toggle the bot switch to ON** (this sets `bot_status = true` in Supabase)
3. **Check Render logs:**
   - Go to Render dashboard → your service → "Logs" tab
   - You should see: `🤖 Starting Fiesta Fresh Automation Bot...`

---

## 🧪 Testing Mode (Recommended First)

To test without actually posting comments:

1. **In Render:** Set environment variable `DRY_RUN = true`
2. **Redeploy** (Render → Manual Deploy)
3. **Check logs** - you'll see `[DRY RUN]` messages showing what WOULD be posted
4. **Once satisfied:** Set `DRY_RUN = false` and redeploy

---

## 📊 Monitoring

### Check if Bot is Running:
- **Render Logs:** https://dashboard.render.com → Your service → Logs
- **Supabase:** Check `leads` table for new pending posts
- **Dashboard:** Should show stats updating

### Common Issues:

**Issue:** Bot not finding posts
**Fix:** Check Facebook groups are still accessible, cookies not expired

**Issue:** "Chromium not found"
**Fix:** Render will install it automatically on first deploy (takes 5-10 min)

**Issue:** Bot pauses after one cycle
**Fix:** Make sure `bot_status = true` in Supabase config table

**Issue:** Double commenting
**Fix:** Check `replies_log` table has the composite unique constraint

---

## 🎯 Next Steps After Deployment

1. **Monitor for 24 hours** in DRY_RUN mode
2. **Check dashboard** - review pending leads in swipe deck
3. **Approve a few leads** manually
4. **Set DRY_RUN=false** to go live
5. **Watch the magic happen** ✨

---

## 🆘 Support

If deployment fails:
1. Check Render build logs for errors
2. Check Supabase database is accessible
3. Verify all environment variables are set
4. Check GitHub repo has all files committed

---

## 📝 Environment Variables Summary

### Bot (Render):
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anon key
- `FB_EMAIL` - Facebook login email
- `FB_PASSWORD` - Facebook login password
- `PROXY_SERVER` - (Optional) SOCKS5 proxy
- `PROXY_USERNAME` - (Optional) Proxy username
- `PROXY_PASSWORD` - (Optional) Proxy password
- `GEMINI_API_KEY` - Google Gemini API key for AI evaluation
- `DRY_RUN` - `true` for testing, `false` for live
- `SCAN_INTERVAL_SECONDS` - How often to scan (default: 60)
- `PORT` - Port for health check (default: 8080)

### Dashboard (Vercel):
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key

---

**🎉 You're all set! The bot will run 24/7 on Render VPS and never miss a lead again.**
