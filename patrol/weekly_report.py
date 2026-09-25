#!/usr/bin/env python3
"""Weekly CEO email for the Fiesta Fresh draft flow.

Sends every Wednesday at/after 08:00 Australia/Brisbane with the week's
comment funnel. Run hourly from cron — it sends at most once per ISO week,
so a missed 8am (machine offline) is delivered on the next run after it
comes back online.

Requires Gmail to be connected (hatch_gws_cli gmail status).
"""
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

BRISBANE = ZoneInfo('Australia/Brisbane')
CONFIG_DIR = Path.home() / '.config' / 'fiesta'
SENT_FILE = CONFIG_DIR / 'weekly_sent.json'
TYPE_LABELS = {
    'bond': 'Bond Cleaning',
    'carpet': 'Carpet Cleaning',
    'builders': 'Post-Construction / Builders Clean',
    'commercial': 'Commercial Cleaning',
    'home': 'Home Cleaning',
}


def log(msg):
    print(f'[weekly] {msg}', flush=True)


def load_env():
    env_file = CONFIG_DIR / 'env'
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"'))


def brisbane_week_start():
    now = datetime.now(BRISBANE)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return start - __import__('datetime').timedelta(days=(now.weekday()))


def should_send():
    now = datetime.now(BRISBANE)
    # Wednesday is weekday() == 2. Send on/after Wed 08:00.
    due = (now.weekday() > 2) or (now.weekday() == 2 and now.hour >= 8)
    if not due:
        return False, 'not due yet'
    week_key = f'{now.isocalendar().year}-W{now.isocalendar().week:02d}'
    sent = json.loads(SENT_FILE.read_text()) if SENT_FILE.exists() else []
    if week_key in sent:
        return False, f'{week_key} already sent'
    return True, week_key


def fetch_week_rows(week_start):
    key = os.environ['SUPABASE_ANON_KEY']
    headers = {'apikey': key, 'Authorization': f'Bearer {key}'}
    url = (f"{os.environ['SUPABASE_URL']}/rest/v1/comment_queue"
           f"?select=*&created_at=gte.{week_start.isoformat()}&limit=2000")
    r = requests.get(url, headers=headers, timeout=30)
    r.raise_for_status()
    return r.json()


def build_html(rows, week_start):
    acc2 = [r for r in rows if r['account'] == 'acc2']
    acc2_posted = {r['post_id'] for r in acc2 if r['status'] == 'posted'}
    acc3_posted = {r['post_id'] for r in rows
                   if r['account'] == 'acc3' and r['status'] == 'posted'}
    done_ids = acc2_posted & acc3_posted

    by_type = {}
    for r in acc2:
        by_type[r['service_type']] = by_type.get(r['service_type'], 0) + 1

    done_rows = [r for r in acc2 if r['post_id'] in done_ids]
    done_rows.sort(key=lambda r: r.get('posted_at') or '', reverse=True)

    def row_html(r):
        label = TYPE_LABELS.get(r['service_type'], r['service_type'])
        when = (r.get('posted_at') or '')[:16].replace('T', ' ')
        return (f'<tr><td style="padding:8px;border-bottom:1px solid #eee">{label}</td>'
                f'<td style="padding:8px;border-bottom:1px solid #eee">'
                f'<a href="{r["permalink"]}">view post</a></td>'
                f'<td style="padding:8px;border-bottom:1px solid #eee">{when}</td></tr>')

    type_rows = ''.join(
        f'<tr><td style="padding:8px;border-bottom:1px solid #eee">{TYPE_LABELS.get(k, k)}</td>'
        f'<td style="padding:8px;border-bottom:1px solid #eee">{n}</td></tr>'
        for k, n in sorted(by_type.items(), key=lambda x: -x[1]))

    week_label = week_start.strftime('%d %b %Y')
    return f"""<div style="font-family:Arial,sans-serif;max-width:640px">
<h2>Fiesta Fresh — weekly comment report</h2>
<p style="color:#666">Week starting {week_label} (Australia/Brisbane)</p>
<table style="border-collapse:collapse;margin:16px 0">
<tr><td style="padding:8px 24px 8px 0;font-size:22px;font-weight:bold">{len(acc2)}</td>
    <td style="padding:8px;color:#666">leads found &amp; drafted</td></tr>
<tr><td style="padding:8px 24px 8px 0;font-size:22px;font-weight:bold">{len(acc2_posted)}</td>
    <td style="padding:8px;color:#666">Account 2 comments posted</td></tr>
<tr><td style="padding:8px 24px 8px 0;font-size:22px;font-weight:bold">{len(acc3_posted)}</td>
    <td style="padding:8px;color:#666">Account 3 URL comments posted</td></tr>
<tr><td style="padding:8px 24px 8px 0;font-size:22px;font-weight:bold">{len(done_ids)}</td>
    <td style="padding:8px;color:#666">fully completed</td></tr>
</table>
<h3>By clean type</h3>
<table style="border-collapse:collapse;width:100%">
<tr style="text-align:left;color:#888"><th style="padding:8px">Type</th><th style="padding:8px">Drafts</th></tr>
{type_rows or '<tr><td style="padding:8px" colspan="2">No drafts this week.</td></tr>'}
</table>
<h3>Completed posts</h3>
<table style="border-collapse:collapse;width:100%">
<tr style="text-align:left;color:#888"><th style="padding:8px">Type</th><th style="padding:8px">Post</th><th style="padding:8px">Posted</th></tr>
{''.join(row_html(r) for r in done_rows) or '<tr><td style="padding:8px" colspan="3">None yet.</td></tr>'}
</table>
<p style="color:#999;font-size:12px;margin-top:24px">Sent automatically by your comment-draft patrol.</p>
</div>"""


def main():
    load_env()
    for var in ('SUPABASE_URL', 'SUPABASE_ANON_KEY', 'WEEKLY_REPORT_TO'):
        if not os.environ.get(var):
            log(f'ERROR: {var} not set.')
            return 2

    ok, reason = should_send()
    if not ok:
        log(f'skipping: {reason}')
        return 0

    week_start = brisbane_week_start()
    try:
        rows = fetch_week_rows(week_start)
    except Exception as e:
        log(f'ERROR fetching data: {e}')
        return 1

    html = build_html(rows, week_start)
    subject = f"Fiesta Fresh weekly comment report — week of {week_start.strftime('%d %b %Y')}"
    to = os.environ['WEEKLY_REPORT_TO']

    try:
        subprocess.run(
            ['hatch_gws_cli', 'gmail', '+send', '--to', to,
             '--subject', subject, '--html', '--body', html],
            check=True, capture_output=True, text=True, timeout=120)
    except subprocess.CalledProcessError as e:
        log(f'ERROR sending (is Gmail connected?): {e.stderr.strip()[:200]}')
        return 1

    sent = json.loads(SENT_FILE.read_text()) if SENT_FILE.exists() else []
    sent.append(reason)
    SENT_FILE.write_text(json.dumps(sent))
    log(f'sent to {to} for {reason}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
