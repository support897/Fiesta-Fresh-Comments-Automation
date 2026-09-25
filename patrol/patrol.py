#!/usr/bin/env python3
"""Fiesta Fresh draft patrol.

Discovers fresh cleaner-seeking posts in the connected Facebook community
groups, classifies them with the same keyword engine the old bot used, and
stores human-ready comment drafts in Supabase.

Runs on the assistant's VM — NEVER on the user's VPS, and NEVER posts
anything to Facebook. Drafts only; the user posts manually from the dashboard.

Usage:
    python3 patrol.py            # normal run (quiet hours 23:00-05:00 Brisbane are skipped)
    python3 patrol.py --dry-run  # classify + log, do not write drafts
"""
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from classifier import detect_service_line, quick_keyword_filter  # noqa: E402

REPO = Path(__file__).resolve().parent.parent
GROUPS_FILE = REPO / 'bot' / 'target_groups.json'
BRISBANE = ZoneInfo('Australia/Brisbane')
FRESH_HOURS = 24
QUERY = 'clean'
PER_GROUP_LIMIT = 15

ACC3_URL = 'https://www.fiestafreshcleaning.com/'


def log(msg):
    print(f"[{datetime.now(BRISBANE).strftime('%H:%M:%S')}] {msg}", flush=True)


def load_env():
    env_file = Path.home() / '.config' / 'fiesta' / 'env'
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"'))


def sb_headers():
    key = os.environ['SUPABASE_ANON_KEY']
    return {
        'apikey': key,
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json',
    }


def sb_get(table, select='*', filters=''):
    url = f"{os.environ['SUPABASE_URL']}/rest/v1/{table}?select={select}{filters}"
    r = requests.get(url, headers=sb_headers(), timeout=30)
    r.raise_for_status()
    return r.json()


def sb_insert(table, row):
    url = f"{os.environ['SUPABASE_URL']}/rest/v1/{table}"
    r = requests.post(url, headers={**sb_headers(), 'Prefer': 'return=representation'},
                      json=row, timeout=30)
    if r.status_code == 409:
        return None  # already exists (unique post_id+account) — fine
    r.raise_for_status()
    return r.json()


def group_id_from_url(url):
    m = re.search(r'/groups/([^/?#]+)', url)
    return m.group(1) if m else None


def fetch_group_posts(group_id, since_ts):
    cmd = ['facebook-cli', 'groups', 'posts',
           '--group-id', group_id,
           '--query', QUERY,
           '--sort-by', 'NEW_POSTS',
           '--limit', str(PER_GROUP_LIMIT),
           '--min-timestamp', str(since_ts)]
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    except subprocess.TimeoutExpired:
        log(f'  ⏱ timeout on group {group_id}')
        return []
    if out.returncode != 0:
        log(f'  ⚠ group {group_id}: {out.stderr.strip()[:120]}')
        return []
    try:
        data = json.loads(out.stdout)
    except json.JSONDecodeError:
        log(f'  ⚠ group {group_id}: bad JSON')
        return []
    return data.get('data') or []


def post_id_from_url(post_url):
    m = re.search(r'/(\d+)/?(?:\?|$)', post_url or '')
    return m.group(1) if m else None


def parse_created(value):
    """Return aware datetime or None."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc)
    s = str(value).strip()
    if re.fullmatch(r'\d+(\.\d+)?', s):
        return datetime.fromtimestamp(float(s), tz=timezone.utc)
    try:
        dt = datetime.fromisoformat(s.replace('Z', '+00:00'))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def main():
    load_env()
    dry_run = '--dry-run' in sys.argv
    now_bris = datetime.now(BRISBANE)

    if now_bris.hour >= 23 or now_bris.hour < 5:
        log('Quiet hours (23:00–05:00 Brisbane) — skipping run.')
        return 0

    for var in ('SUPABASE_URL', 'SUPABASE_ANON_KEY'):
        if not os.environ.get(var):
            log(f'ERROR: {var} not set (see patrol/README.md).')
            return 2

    # --- reference data -------------------------------------------------
    try:
        service_types = {r['key']: r for r in sb_get('service_types')}
    except requests.HTTPError as e:
        log('ERROR: cannot read service_types — has the migration been run in '
            'Supabase SQL editor? (supabase/migrations/20260925_draft_flow.sql)')
        log(f'  detail: {e}')
        return 3
    active = {k for k, v in service_types.items() if v.get('is_active')}
    log(f'Service types active: {sorted(active)}')

    templates = {}
    for r in sb_get('templates', select='content,service_type,is_active'):
        if r.get('is_active'):
            templates.setdefault(r.get('service_type') or 'general', r['content'])
    if 'general' not in templates:
        log('ERROR: no active general template in Supabase.')
        return 3

    seen = set()
    for r in sb_get('comment_queue', select='post_id'):
        seen.add(r['post_id'])
    try:
        for r in sb_get('replies_log', select='post_id'):
            if r.get('post_id'):
                seen.add(str(r['post_id']))
    except requests.HTTPError:
        pass  # replies_log read best-effort
    log(f'Already handled posts: {len(seen)}')

    groups = json.loads(GROUPS_FILE.read_text())
    since_ts = int((datetime.now(timezone.utc) - timedelta(hours=FRESH_HOURS)).timestamp())

    stats = {'groups': 0, 'posts': 0, 'approved': 0, 'drafts': 0,
             'skipped': 0, 'inactive_type': 0, 'unsure': 0}

    for gurl in groups:
        gid = group_id_from_url(gurl)
        if not gid:
            continue
        stats['groups'] += 1
        posts = fetch_group_posts(gid, since_ts)
        time.sleep(0.4)
        for p in posts:
            stats['posts'] += 1
            text = (p.get('content') or '').strip()
            post_url = p.get('post_url') or ''
            pid = post_id_from_url(post_url) or str(p.get('id') or '')
            if not pid or pid in seen:
                stats['skipped'] += 1
                continue

            created = parse_created(p.get('creation_time') or p.get('source_record_created_at'))
            if created and datetime.now(timezone.utc) - created > timedelta(hours=FRESH_HOURS):
                stats['skipped'] += 1
                continue

            verdict, reason = quick_keyword_filter(text)
            if verdict != 'approve':
                if verdict == 'unsure':
                    stats['unsure'] += 1
                else:
                    stats['skipped'] += 1
                continue

            svc = detect_service_line(text)
            if not svc:
                stats['skipped'] += 1
                log(f'  ? no service type, skipping: {text[:80]!r}')
                continue
            svc_key = svc[0]
            if svc_key not in active:
                stats['inactive_type'] += 1
                continue

            stats['approved'] += 1
            comment = templates.get(svc_key) or templates['general']
            permalink = f'https://www.facebook.com/groups/{gid}/posts/{pid}/'
            row = {
                'post_id': pid,
                'account': 'acc2',
                'group_url': gurl,
                'post_text': text[:4000],
                'service_type': svc_key,
                'comment_text': comment,
                'permalink': permalink,
                'status': 'draft_ready',
            }
            if dry_run:
                log(f'  DRY-RUN [{svc_key}] {permalink} — {reason}')
            else:
                inserted = sb_insert('comment_queue', row)
                if inserted is not None:
                    stats['drafts'] += 1
                    log(f'  ✏️ draft [{svc_key}] {permalink}')
            seen.add(pid)

    log(f"Done: {stats['groups']} groups, {stats['posts']} posts scanned, "
        f"{stats['approved']} approved, {stats['drafts']} drafts stored "
        f"({stats['unsure']} unsure skipped, {stats['inactive_type']} inactive-type skipped).")
    return 0


if __name__ == '__main__':
    sys.exit(main())
