import urllib.request
import re
import json

doc_url = "https://docs.google.com/document/d/e/2PACX-1vSXEinqQdeTWqVysv56ZPimZt5kUdfVXxOER7oiXMKzX548F1GbItZyn8W-WHJwB5I-a9OTVVxhrOPY/pub"

req = urllib.request.Request(doc_url, headers={'User-Agent': 'Mozilla/5.0'})
html = urllib.request.urlopen(req).read().decode('utf-8')

# Find all facebook group URLs in the HTML
raw_urls = re.findall(r'https://www\.facebook\.com/groups/[a-zA-Z0-9\._\-]+/?', html)

# Deduplicate while preserving order
unique_groups = []
seen = set()
for url in raw_urls:
    clean_url = url.rstrip('/')
    if not clean_url.endswith('/groups') and clean_url not in seen:
        seen.add(clean_url)
        unique_groups.append(clean_url)

print(f"Extracted {len(unique_groups)} target Facebook groups from Google Doc:")
for idx, g in enumerate(unique_groups, 1):
    print(f"{idx}. {g}")

# Save to JSON file
with open('target_groups.json', 'w') as f:
    json.dump(unique_groups, f, indent=2)

print("\nSaved to target_groups.json")
