#!/usr/bin/env bash
# Pull latest main and restart the 24/7 bot service. Run as root on the VPS.
set -euo pipefail
APP=/opt/fiesta
cd "$APP"
git fetch --all
git reset --hard origin/main
cd "$APP/bot"
npm install --omit=dev --no-audit --no-fund
npx playwright-core install chromium
systemctl restart fiesta-bot
sleep 5
systemctl --no-pager status fiesta-bot | head -20
