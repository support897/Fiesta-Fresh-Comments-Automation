import { chromium } from 'playwright-core';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const localCookiePath = path.join(__dirname, 'account3_cookies.json');

console.log("==================================================");
console.log("🌐 ACCOUNT 3 COOKIE SAVER & VPS SYNC");
console.log("==================================================");

function saveCookiesToVPS(cookieFilePath: string) {
    try {
        console.log("🚀 Syncing Account 3 cookies to Azure VPS (20.193.52.236)...");
        execSync(`sshpass -p 'Fiesta2026!Fresh' scp -o StrictHostKeyChecking=no "${cookieFilePath}" azureuser@20.193.52.236:~/Fiesta-Fresh-Comments-Automation/bot/account3_cookies.json`, { stdio: 'ignore' });
        console.log("✅ Account 3 cookies synced to Azure VPS (20.193.52.236) forever!");
        return true;
    } catch {
        // Fallback using python paramiko script
        try {
            const pyScript = `
import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('20.193.52.236', username='azureuser', password='Fiesta2026!Fresh')
sftp = ssh.open_sftp()
sftp.put('${cookieFilePath}', '/home/azureuser/Fiesta-Fresh-Comments-Automation/bot/account3_cookies.json')
sftp.close()
ssh.close()
print("✅ Synced via Python SFTP!")
`;
            execSync(`python3 -c "${pyScript.replace(/\n/g, ' ')}"`, { stdio: 'ignore' });
            console.log("✅ Account 3 cookies synced to Azure VPS (20.193.52.236) forever!");
            return true;
        } catch (err: any) {
            console.warn("⚠️ Local cookies saved. Remote VPS sync alert:", err.message);
            return false;
        }
    }
}

async function main() {
    const browser = await chromium.launch({
        headless: false,
        channel: 'chrome',
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--start-maximized'
        ]
    }).catch(async () => {
        return await chromium.launch({
            headless: false,
            args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
        });
    });

    const context = await browser.newContext({
        viewport: null,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        locale: 'en-AU',
        timezoneId: 'Australia/Brisbane',
    });

    const page = await context.newPage();
    await page.goto('https://www.facebook.com', { waitUntil: 'domcontentloaded' });

    console.log("⏳ Chrome window is ready. Log into Account 3 at your own pace.");
    console.log("Cookies will save automatically as soon as login is detected.");
    console.log("Closing the browser window manually when finished will finalize saving.");

    let saved = false;

    const interval = setInterval(async () => {
        try {
            const cookies = await context.cookies();
            if (cookies && cookies.length > 5 && !saved) {
                saved = true;
                console.log("\n🎉 LOGIN DETECTED! Extracting Account 3 session cookies...");

                const jsonStr = JSON.stringify(cookies, null, 2);
                fs.writeFileSync(localCookiePath, jsonStr, 'utf-8');
                console.log(`💾 Saved ${cookies.length} cookies locally to: ${localCookiePath}`);

                saveCookiesToVPS(localCookiePath);
            }
        } catch {
            // keep polling
        }
    }, 3000);

    browser.on('disconnected', async () => {
        clearInterval(interval);
        try {
            const cookies = await context.cookies().catch(() => []);
            if (cookies && cookies.length > 5) {
                const jsonStr = JSON.stringify(cookies, null, 2);
                fs.writeFileSync(localCookiePath, jsonStr, 'utf-8');
                saveCookiesToVPS(localCookiePath);
                console.log("✅ Final session sync completed upon window close!");
            }
        } catch {}
        console.log("🔴 Browser closed by user. Done.");
        process.exit(0);
    });
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
