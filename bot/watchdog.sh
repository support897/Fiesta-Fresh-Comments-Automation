#!/bin/bash
# Watchdog: keeps the local Fiesta comments poster alive across VM restarts.
# Runs every 15 min via cron. Starts local_proxy and the poster bot if down.
BOT_DIR="$HOME/workspace/fiesta-fresh-comments-automation/bot"
LOG="$BOT_DIR/poster.log"

# Double-fork detach: the caller never waits on the child, so cron workers
# can't hang in do_wait on lingering wrapper processes.
start_detached() {
  ( setsid "$@" </dev/null >>"$LOG" 2>&1 & )
}

# 1. Proxy
if ! curl -s -o /dev/null --max-time 10 -x http://127.0.0.1:8888 http://example.com/; then
  echo "$(date -Iseconds) watchdog: restarting local_proxy" >> "$LOG"
  cd "$HOME/workspace/fiesta-worker" && start_detached node local_proxy.js
  sleep 3
fi

# 2. Poster bot (POSTER_MODE — drains comment_queue, never patrols)
if ! pgrep -f '[t]sx bot.ts' > /dev/null; then
  echo "$(date -Iseconds) watchdog: starting poster bot" >> "$LOG"
  cd "$BOT_DIR" && start_detached env \
    POSTER_MODE=true \
    FB_ACCOUNTS='[{"email":"ilse2taylor@gmail.com"},{"email":"account3"}]' \
    PLAYWRIGHT_EXEC_PATH="$HOME/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell" \
    IGNORE_CERT_ERRORS=true \
    PROXY_SERVER=http://127.0.0.1:8888 \
    npx tsx bot.ts
fi
