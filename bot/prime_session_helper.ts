import { chromium } from 'playwright-core';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
    process.env.SUPABASE_URL || 'https://xmxywlyqdqrfrojwggkt.supabase.co',
    process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhteHl3bHlxZHFyZnJvandnZ2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzMzI4NjUsImV4cCI6MjEwMTkwODg2NX0.p9i_3rge9IuoYz6qgL5J6dZjwptZyKU7S7AP1Bh_EHQ'
);

const ACCOUNTS = [
    { email: 'ilse2taylor@gmail.com', name: 'Account 1 (ilse2taylor@gmail.com)' },
    { email: 'projects.reports.ilse@gmail.com', name: 'Account 2 (projects.reports.ilse@gmail.com)' },
    { email: 'account3', name: 'Account 3 (Website Booster)' }
];

function syncBoosterCookiesToVPS(localPath: string) {
    try {
        console.log("🚀 Syncing Account 3 cookies to Azure VPS...");
        execSync(`sshpass -p 'Fiesta2026!Fresh' scp -o StrictHostKeyChecking=no "${localPath}" azureuser@20.193.52.236:~/Fiesta-Fresh-Comments-Automation/bot/account3_cookies.json`, { stdio: 'ignore' });
        console.log("✅ Account 3 cookies synced to Azure VPS!");
    } catch {
        try {
            const pyScript = `
import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('20.193.52.236', username='azureuser', password='Fiesta2026!Fresh')
sftp = ssh.open_sftp()
sftp.put('${localPath}', '/home/azureuser/Fiesta-Fresh-Comments-Automation/bot/account3_cookies.json')
sftp.close()
ssh.close()
`;
            execSync(`python3 -c "${pyScript.replace(/\n/g, ' ')}"`, { stdio: 'ignore' });
            console.log("✅ Account 3 cookies synced to Azure VPS via SFTP!");
        } catch (err: any) {
            console.warn("⚠️ Remote VPS sync failed:", err.message);
        }
    }
}

async function main() {
    console.log("==================================================");
    console.log("  🌐 FIESTA FRESH - COOKIE PRIMER (PRESS ENTER TO SAVE)");
    console.log("==================================================");

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log("Select account to login:");
    ACCOUNTS.forEach((acc, i) => {
        console.log(`  [${i + 1}] ${acc.name}`);
    });

    rl.question("\nEnter number (1-3): ", async (answer) => {
        const choice = parseInt(answer.trim(), 10);
        if (isNaN(choice) || choice < 1 || choice > 3) {
            console.error("❌ Invalid choice. Exiting.");
            rl.close();
            process.exit(1);
        }

        const selectedAcc = ACCOUNTS[choice - 1];
        if (!selectedAcc) {
            console.error("❌ Account not found. Exiting.");
            rl.close();
            process.exit(1);
        }
        console.log(`\n🚀 Opening Chrome window to prime: ${selectedAcc.name}...`);

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

        console.log("\n👉 Log into Facebook in the opened Chrome browser window.");
        rl.question("👉 Once you are fully logged in and on the feed, press [ENTER] here to save cookies: ", async () => {
            console.log("\n📦 Capturing cookies...");
            const cookies = await context.cookies().catch(() => []);
            if (cookies && cookies.length > 5) {
                // SameSite normalization
                const sameSiteMap: Record<string, any> = {
                    "no_restriction": "None",
                    "none": "None",
                    "lax": "Lax",
                    "strict": "Strict",
                    "unspecified": "Lax"
                };
                const normalized = cookies.map(c => ({
                    ...c,
                    sameSite: sameSiteMap[String(c.sameSite).toLowerCase()] || "Lax"
                }));

                // Upload to Supabase
                console.log(`📡 Saving cookies to Supabase for ${selectedAcc.email}...`);
                const { error } = await supabase.from('sessions').upsert({
                    user_email: selectedAcc.email,
                    cookies: normalized,
                    updated_at: new Date()
                });

                if (error) {
                    console.error("❌ Failed to save session to Supabase:", error.message);
                } else {
                    console.log(`🎉 SUCCESS! Session cookies saved to Supabase for ${selectedAcc.email}!`);
                }

                // If Account 3, also sync the local cookie json file to the VPS
                if (selectedAcc.email === 'account3') {
                    const localPath = path.join(__dirname, 'account3_cookies.json');
                    fs.writeFileSync(localPath, JSON.stringify(normalized, null, 2), 'utf-8');
                    syncBoosterCookiesToVPS(localPath);
                }
            } else {
                console.warn("⚠️ Captured too few cookies. Session not saved.");
            }

            rl.close();
            await browser.close();
            process.exit(0);
        });
    });
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
