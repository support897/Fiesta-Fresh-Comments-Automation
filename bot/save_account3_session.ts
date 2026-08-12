import { chromium } from 'playwright-core';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://xbqkcjobdnrbetrgjjrd.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_UWbZXjdMsf_Ikp2LtPRWyA_85Wop9Xg';

console.log("==================================================");
console.log("🌐 ACCOUNT 3 COOKIE PRIMER & SAVER");
console.log("==================================================");
console.log("Opening Chrome window for Account 3 (Website Booster)...");
console.log("Please log into Account 3 in the visible Chrome browser.");
console.log("THE BROWSER WILL REMAIN OPEN UNTIL YOU MANUALLY CLOSE IT.");
console.log("==================================================");

async function upsertSessionToSupabase(userEmail: string, cookies: any[]) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(`${supabaseUrl}/rest/v1/sessions`);
        const payload = JSON.stringify([{
            user_email: userEmail,
            cookies: cookies,
            updated_at: new Date().toISOString()
        }]);

        const req = https.request({
            hostname: urlObj.hostname,
            path: urlObj.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Prefer': 'resolution=merge-duplicates',
                'Content-Length': Buffer.byteLength(payload)
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    console.log(`✅ SUCCESS: ${cookies.length} cookies saved to Supabase for ${userEmail}!`);
                    resolve(true);
                } else {
                    console.error(`❌ Supabase error status ${res.statusCode}:`, body);
                    resolve(false);
                }
            });
        });

        req.on('error', (err) => {
            console.error("❌ HTTPS request error:", err.message);
            reject(err);
        });

        req.write(payload);
        req.end();
    });
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

    console.log("⏳ Chrome window is ready. Log into Account 3 at your own pace. Window will NOT close automatically.");

    let saved = false;

    // Save cookies periodically once logged in, without closing browser
    const interval = setInterval(async () => {
        try {
            const cookies = await context.cookies();
            if (cookies && cookies.length > 5 && !saved) {
                saved = true;
                console.log("\n🎉 LOGIN DETECTED! Saving Account 3 cookies to Supabase...");
                await upsertSessionToSupabase("account3_booster@fiestafresh.com", cookies);
                console.log("✅ Cookies saved! You can continue using the browser or close it when you are done.");
            }
        } catch {
            // Browser might be closed by user
        }
    }, 3000);

    // Keep running until user manually closes the browser
    browser.on('disconnected', async () => {
        clearInterval(interval);
        console.log("🔴 Browser closed by user. Session script completed.");
        process.exit(0);
    });
}

main().catch(err => {
    console.error("Fatal error during priming:", err);
    process.exit(1);
});
