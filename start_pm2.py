import paramiko

VPS_IP = '20.193.52.236'
VPS_USER = 'azureuser'
VPS_PASS = 'Fiesta2026!Fresh'
DEST_DIR = '~/Fiesta-Fresh-Comments-Automation'

def execute_cmd(ssh, cmd):
    print(f"Running: {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print(stdout.read().decode().strip())
    print(stderr.read().decode().strip())

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASS)

print("Starting bot daemon with npx pm2...")
pm2_cmd = f"cd {DEST_DIR}/bot && npx pm2 stop bot || true && npx pm2 start 'npx tsx bot.ts' --name bot"
execute_cmd(ssh, pm2_cmd)
execute_cmd(ssh, f"cd {DEST_DIR}/bot && npx pm2 save")
execute_cmd(ssh, f"cd {DEST_DIR}/bot && npx pm2 logs --lines 15 --nostream")
ssh.close()
