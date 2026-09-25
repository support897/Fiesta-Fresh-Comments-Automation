# Patrol — draft discovery runner

Runs on the assistant's VM (**never** on the user's VPS). It discovers fresh
cleaner-seeking posts in the connected Facebook community groups, classifies
them, and stores **human-ready comment drafts** in Supabase. It never posts,
likes, or messages anything — drafts only.

## How it works

1. Every run (see schedule below), `patrol.py` checks the 32 groups in
   `../bot/target_groups.json` for posts from the last 24 hours matching "clean".
2. Each post is classified by `classifier.py` — a Python port of the keyword
   engine in `../bot/bot.ts` (`quickKeywordFilter` + service-line detection),
   with builders/post-construction split out as its own clean type.
   - `approve` → draft; `reject`/`unsure` → skipped (no AI fallback here, so
     ambiguous posts are left alone rather than guessed at).
3. Only posts ≤ 24h old, of an **active** service type (see Service Types in
   the dashboard), and not already handled, become drafts in `comment_queue`.
4. Templates come from the `templates` table: `bond` → Bond template,
   everything else → General template. Edit copy in the dashboard; no deploy needed.

## Prerequisites

1. Run `supabase/migrations/20260925_draft_flow.sql` once in the Supabase SQL
   editor (creates `service_types`, `comment_queue`, template types, RLS).
2. `~/.config/fiesta/env` with:
   ```
   SUPABASE_URL=...
   SUPABASE_ANON_KEY=...
   WEEKLY_REPORT_TO=you@example.com
   ```

## Schedule (cron on the assistant VM)

- `patrol.py` — every 3 hours, 05:00–23:00 Australia/Brisbane
  (the script itself skips the 23:00–05:00 quiet window).
- `weekly_report.py` — hourly; sends the CEO email Wednesday ≥ 08:00
  Brisbane, once per ISO week. A missed 8am is delivered on the next run
  after the machine is back online.

## Regenerating the classifier

`classifier_data.py` is generated from the keyword lists in `../bot/bot.ts`:

```bash
python3 - <<'EOF'
# (see git history for the extractor — rerun it after editing bot.ts lists)
EOF
```

Small plural-form fixes live directly in `classifier.py` (`_CARPER_EXTRA`)
so the generated file stays a faithful copy of the bot's lists.

## Files

- `patrol.py` — the runner (supports `--dry-run`)
- `weekly_report.py` — Wednesday 8am CEO email via Gmail SMTP app password
  (`FIESTA_EMAIL_USER` / `FIESTA_EMAIL_APP_PASSWORD` in `~/.config/fiesta/env`)
- `classifier.py` — approve/reject/unsure + service-type detection
- `classifier_data.py` — keyword lists (generated, do not hand-edit)
