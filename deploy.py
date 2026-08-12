import paramiko
import os
import time

VPS_IP = '20.193.52.236'
VPS_USER = 'azureuser'
VPS_PASS = 'Fiesta2026!Fresh'
REPO_URL = 'https://github.com/support897/Fiesta-Fresh-Comments-Automation.git'
DEST_DIR = '~/Fiesta-Fresh-Comments-Automation'

def execute_cmd(ssh, cmd):
    print(f"Running: {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    
    # Wait for the command to finish
    exit_status = stdout.channel.recv_exit_status()
    
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    
    if out:
        print(out)
    if err:
        print(err)
        
    return exit_status, out, err

def main():
    print("Connecting to VPS...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASS)
        print("Connected successfully.")
        
        # 1. Clone or pull repo
        cmd = f"if [ -d {DEST_DIR} ]; then cd {DEST_DIR} && git reset --hard HEAD && git pull; else git clone {REPO_URL} {DEST_DIR}; fi"
        execute_cmd(ssh, cmd)
        
        # 2. Upload .env
        print("Uploading .env file...")
        sftp = ssh.open_sftp()
        local_env = '/Users/ilse/Fiesta-Fresh-Comments-Automation-1/bot/.env'
        remote_env = f"/home/{VPS_USER}/Fiesta-Fresh-Comments-Automation/bot/.env"
        sftp.put(local_env, remote_env)
        sftp.close()
        print("Uploaded .env successfully.")
        
        # 3. Install dependencies
        print("Installing npm dependencies...")
        execute_cmd(ssh, f"cd {DEST_DIR}/bot && npm install")
        
        # 4. Dry Run Test
        print("Running DRY_RUN test on VPS...")
        test_cmd = f"cd {DEST_DIR}/bot && DRY_RUN=true npx tsx bot.ts"
        print("Testing: " + test_cmd)
        
        stdin, stdout, stderr = ssh.exec_command(test_cmd)
        
        start_time = time.time()
        output = ""
        while time.time() - start_time < 30:
            if stdout.channel.recv_ready():
                chunk = stdout.channel.recv(1024).decode()
                print(chunk, end="")
                output += chunk
                
                if "Mode: 🧪 DRY RUN" in output and "👤 Account:" in output and "➡️ Navigating to Facebook..." in output:
                    print("\n\n✅ DRY RUN SUCCESSFUL: Bot started and is navigating to Facebook.")
                    break
                if "⚠️ Config read error" in output:
                    print("\n\n❌ ERROR: Supabase config failed.")
                    break
            if stdout.channel.recv_stderr_ready():
                err_chunk = stderr.channel.recv(1024).decode()
                print(err_chunk, end="")
                
            time.sleep(1)
            
            if stdout.channel.exit_status_ready():
                break
                
        # Kill the test bot
        execute_cmd(ssh, "pkill -f 'tsx bot.ts' || true")

        # 5. Start daemon using pm2
        print("\nStarting bot daemon...")
        pm2_cmd = f"cd {DEST_DIR}/bot && pm2 stop bot || true && pm2 start 'npx tsx bot.ts' --name bot"
        execute_cmd(ssh, pm2_cmd)
        
        execute_cmd(ssh, "pm2 save")
        print("\nDeployment Complete!")

    finally:
        ssh.close()

if __name__ == "__main__":
    main()
