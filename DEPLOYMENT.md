# Deployment — Fiesta Fresh Comments Bot

The bot runs **only** on the Oracle VPS (`159.13.36.205`) as a systemd service.
The dashboard runs **only** on Vercel (`fiesta-comments-dashboard.vercel.app`),
auto-deployed from `main`. They share state through Supabase — there is no direct
API between them.

> Render.com is no longer used. The old `render.yaml`, `bot/Dockerfile` and
> `render-build.sh` have been removed.

## Secrets

Never commit secrets. `bot/.env` on the VPS is the only place they live; see
`bot/.env.example` for the full list. The previously committed Facebook password,
Gmail app password and proxy credentials were exposed in git history and **must be
rotated**.

## VPS layout

| Item | Path / name |
| --- | --- |
| App dir | `/opt/fiesta` (git clone of `main`) |
| Env file | `/opt/fiesta/bot/.env` (chmod 600) |
| Service | `fiesta-bot.service` (`Restart=always`, `WantedBy=multi-user.target`) |
| Display | `xvfb-run` wrapper — required because `HEADLESS=false` |
| Health | `http://127.0.0.1:8080` (local only) |
| Heartbeat | `sessions.__heartbeat__` row in Supabase, written every 60s |

## Commands

```bash
# status / logs
sudo systemctl status fiesta-bot
sudo journalctl -u fiesta-bot -f

# restart / stop
sudo systemctl restart fiesta-bot
sudo systemctl stop fiesta-bot

# deploy latest main
sudo /opt/fiesta/scripts/deploy.sh
```

## How a cycle works

1. Check `config.bot_status` (dashboard toggle) — pause honoured immediately.
2. Restore Facebook cookies from `sessions` for the rotating account; on failure,
   screenshot to Supabase Storage, mark session down, email one alert.
3. **Phase 1** — post the reply template to every `leads.status = 'approved'`
   row not already in `replies_log`, then the Account 3 website-URL booster.
4. **Phase 1.5** — scrape `/notifications` for new group posts and act on leads.
5. **Phase 2** — patrol a rotating slice of `GROUPS_PER_CYCLE` target groups and
   queue matches as approved leads.
6. Write the heartbeat, sleep `SCAN_INTERVAL_SECONDS`, repeat forever.

Classification: keyword approve-list → disqualifier list → Gemini for anything
else mentioning "clean". Without `GEMINI_API_KEY` borderline posts fall back to a
naive `includes('clean')` check, which produces false positives.
