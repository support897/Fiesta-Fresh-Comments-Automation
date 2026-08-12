import paramiko

VPS_IP = '20.193.52.236'
VPS_USER = 'azureuser'
VPS_PASS = 'Fiesta2026!Fresh'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASS)

stdin, stdout, stderr = ssh.exec_command("cd ~/Fiesta-Fresh-Comments-Automation/bot && npx pm2 status")
print(stdout.read().decode().strip())
ssh.close()
