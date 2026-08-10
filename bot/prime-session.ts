import { chromium } from 'playwright-core';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
);

const accounts = (() => {
    try {
        return JSON.parse(process.env.FB_ACCOUNTS!);
    } catch {
        return [{ email: process.env.FB_EMAIL, password: process.env.FB_PASSWORD }];
    }
})();

const accountIndex = parseInt(process.argv[2] || '0', 10);
const account = accounts[accountIndex];

if (!account) {
    console.error(`❌ No account at index ${accountIndex}.`);
    process.exit(1);
}

const userDataDir = path.join(__dirname, 'FiestaSession');

console.log(`🔑 Priming session for ${account.email}`);
console.log("A Chrome window will open. If Facebook asks for a code or captcha, solve it manually.");
console.log("Once you see your Facebook home feed, press ENTER here to save the session.");
console.log("");

async function main() {
    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-setuid-sandbox'],
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 900 },
        locale: 'en-AU',
        timezoneId: 'Australia/Brisbane',
    });

    const page: any = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    await page.goto('https://www.facebook.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4000);

    const loginMarkers = page.locator('[name="email"], [name="pass"]');
    if (await loginMarkers.first().isVisible()) {
        await page.locator('[name="email"]').first().click();
        await page.locator('[name="email"]').first().type(account.email, { delay: 60 });
        await page.locator('[name="pass"]').first().click();
        await page.locator('[name="pass"]').first().type(account.password, { delay: 60 });
        await page.locator('[aria-label="Log in"]').first().click();
        console.log("⏳ Login submitted. Solve any captcha/code in the Chrome window...");
    }

    process.stdin.resume();
    console.log("👉 When you are logged in and on the home feed, press ENTER...");
    const homeMarkers = page.locator('[aria-label="Your profile"], [aria-label="Facebook"], [aria-label*="Home"]');

    const deadline = Date.now() + 10 * 60 * 1000;
    let done = false;
    const timer = setInterval(async () => {
        if (done) return;
        try {
            if (await homeMarkers.first().isVisible({ timeout: 500 })) {
                done = true;
                clearInterval(timer);
                console.log("✅ Home feed detected — saving session...");
                await saveSession(context, account.email);
            }
        } catch { /* keep polling */ }
        if (Date.now() > deadline && !done) {
            done = true;
            clearInterval(timer);
            console.log("⏰ Timeout. Saving whatever cookies we have (may be partial).");
            await saveSession(context, account.email);
        }
    }, 3000);
    await new Promise(resolve => process.stdin.once('data', resolve));

    async function saveSession(ctx: any, email: string) {
        const cookies = await ctx.cookies();
        const { error } = await supabase.from('sessions').upsert({
            user_email: email,
            cookies,
            updated_at: new Date(),
        });
        if (error) {
            console.error("❌ Failed to save session:", error.message);
        } else {
            console.log(`✅ Saved ${cookies.length} cookies to Supabase for ${email}.`);
        }
    }

    await context.close();
    process.exit(0);
}

main().catch(e => { console.error("FATAL", e); process.exit(1); });
