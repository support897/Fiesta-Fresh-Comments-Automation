#!/bin/bash
# Pull main from GitHub every 10 minutes; if the commit changed, install deps
# and drop the bot process so systemd (Restart=always) starts the new code.
# Keeps the VPS self-updating with zero dependency on any laptop.
cd /opt/fiesta || exit 0
before=$(git rev-parse HEAD)
git fetch -q origin main || exit 0
after=$(git rev-parse origin/main)
[ "$before" = "$after" ] && exit 0
git reset --hard origin/main -q
cd bot && npm install --silent --no-audit --no-fund >/dev/null 2>&1
logger -t fiesta-autodeploy "deployed $after"
pkill -f "tsx bot.ts"
