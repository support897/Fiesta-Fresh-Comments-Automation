#!/usr/bin/env python3
import sys
import json
import time
import urllib.request
from playwright.sync_api import sync_playwright

SUPABASE_URL = "https://xmxywlyqdqrfrojwggkt.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhteHl3bHlxZHFyZnJvandnZ2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzMzI4NjUsImV4cCI6MjEwMTkwODg2NX0.p9i_3rge9IuoYz6qgL5J6dZjwptZyKU7S7AP1Bh_EHQ"

ACCOUNTS = [
    {"email": "ilse2taylor@gmail.com", "label": "Account 1 (ilse2taylor@gmail.com)"},
    {"email": "account3", "label": "Account 3 (Website URL Booster)"}
]

def main():
    print("=" * 60)
    print("  🌐 FIESTA FRESH - FACEBOOK SESSION PRIMER & COOKIE SAVER")
    print("=" * 60)
    
    idx = 1
    if len(sys.argv) > 1 and sys.argv[1] in ["1", "2", "3"]:
        idx = int(sys.argv[1]) - 1
    else:
        print("Select account to log in:")
        for i, acc in enumerate(ACCOUNTS):
            print(f"  [{i + 1}] {acc['label']}")
        choice = input("\nEnter number (1-3) [default 2]: ").strip()
        if choice in ["1", "2", "3"]:
            idx = int(choice) - 1

    target_email = ACCOUNTS[idx]["email"]
    print(f"\n🚀 Opening browser for: {target_email}...")
    print("👉 Log into Facebook in the opened browser window.")
    print("👉 Once logged in, press ENTER in this terminal to save cookies.\n")

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--start-maximized"
            ]
        )
        context = browser.new_context(
            viewport={"width": 1280, "height": 900},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
        )
        page = context.new_page()
        page.goto("https://www.facebook.com")

        input("\n✅ Press ENTER after you have logged in to save session to Supabase...")

        raw_cookies = context.cookies()
        same_site_map = {
            "no_restriction": "None",
            "none": "None",
            "lax": "Lax",
            "strict": "Strict",
            "unspecified": "Lax"
        }
        
        normalized_cookies = []
        for c in raw_cookies:
            ss = same_site_map.get(str(c.get("sameSite", "")).lower(), "None")
            c["sameSite"] = ss
            normalized_cookies.append(c)

        print(f"\n📦 Captured {len(normalized_cookies)} cookies. Uploading to Supabase...")

        payload = json.dumps({
            "user_email": target_email,
            "cookies": normalized_cookies,
            "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ")
        }).encode("utf-8")

        headers = {
            "apikey": ANON_KEY,
            "Authorization": f"Bearer {ANON_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates"
        }

        req = urllib.request.Request(
            f"{SUPABASE_URL}/rest/v1/sessions",
            data=payload,
            headers=headers,
            method="POST"
        )

        try:
            with urllib.request.urlopen(req) as resp:
                print(f"🎉 SUCCESS! Session saved to Supabase for {target_email}!")
                print("The VPS bot will now automatically pick up this session.\n")
        except Exception as e:
            print(f"❌ Failed to save session to Supabase: {e}")

        browser.close()

if __name__ == "__main__":
    main()
