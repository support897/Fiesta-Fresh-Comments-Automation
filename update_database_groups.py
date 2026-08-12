import json
import urllib.request
import paramiko

supabase_url = "https://xbqkcjobdnrbetrgjjrd.supabase.co"
supabase_key = "sb_publishable_UWbZXjdMsf_Ikp2LtPRWyA_85Wop9Xg"

with open('target_groups.json', 'r') as f:
    groups = json.load(f)

print(f"Loaded {len(groups)} target groups to sync.")

# 1. Clear existing groups in Supabase via REST API
url = f"{supabase_url}/rest/v1/groups?id=neq.0"
req = urllib.request.Request(url, method='DELETE', headers={
    'apikey': supabase_key,
    'Authorization': f"Bearer {supabase_key}",
    'Content-Type': 'application/json'
})
try:
    urllib.request.urlopen(req)
    print("Cleared existing groups in Supabase.")
except Exception as e:
    print("Warning clearing groups:", e)

# 2. Insert new 85 groups into Supabase
url_insert = f"{supabase_url}/rest/v1/groups"
payload = json.dumps([{"url": g, "is_active": True} for g in groups]).encode('utf-8')
req_insert = urllib.request.Request(url_insert, data=payload, method='POST', headers={
    'apikey': supabase_key,
    'Authorization': f"Bearer {supabase_key}",
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
})

try:
    urllib.request.urlopen(req_insert)
    print(f"✅ Inserted {len(groups)} groups into Supabase database!")
except Exception as e:
    print("Error inserting into Supabase:", e)

# 3. Upload target_groups.json to Azure VPS (20.193.52.236)
try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('20.193.52.236', username='azureuser', password='Fiesta2026!Fresh')
    sftp = ssh.open_sftp()
    sftp.put('target_groups.json', '/home/azureuser/Fiesta-Fresh-Comments-Automation/bot/target_groups.json')
    sftp.close()

    # Restart PM2 process to pick up new group list
    stdin, stdout, stderr = ssh.exec_command('cd ~/Fiesta-Fresh-Comments-Automation/bot && npx pm2 restart all')
    print(stdout.read().decode())
    ssh.close()
    print("✅ Uploaded target_groups.json to Azure VPS and restarted PM2!")
except Exception as e:
    print("VPS SSH upload error:", e)
