# Fiesta Fresh Comments Automation

Automated Facebook comments bot + dashboard for Fiesta Fresh Cleaning (Gold Coast).

## What it does

- **Bot** (`bot/`): Runs on Oracle VPS, posts draft comments to Facebook groups
- **Dashboard** (`dashboard/`): Next.js PWA on Vercel — queue management, cookie health, push notifications
- **Patrol** (`patrol/`): Runs on Muse's VM — discovers leads, classifies posts, sends weekly reports

## Quick start

### Dashboard (Vercel)
```bash
cd dashboard
npm install
npm run dev
```
Deploys automatically from `main` to `fiesta-comments-dashboard.vercel.app`.

### Bot (VPS only)
```bash
cd bot
npm install
npx tsx bot.ts
```
Runs as systemd service `fiesta-bot.service` on the Oracle VPS. See `DEPLOYMENT.md`.

### Patrol (Muse's VM)
```bash
cd patrol
python3 patrol.py
```
Scheduled via cron every 3 hours.

## Environment variables

See `bot/.env.example` for the full list. Required:
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (push notifications)
- `CRON_SECRET` (Vercel cron auth)

## Database

Supabase project: `xmxywlyqdqrfrojwggkt`
Migrations in `supabase/migrations/` — apply in order.

## Notifications

- **Monday 8am**: Weekly report push (posted/failed counts)
- **Urgent**: Cookie died, bot offline — once per incident only
- **Setup**: Open `/notifications` on iPhone → Add to Home Screen → Enable

See `DEPLOYMENT.md` for full infrastructure details.
