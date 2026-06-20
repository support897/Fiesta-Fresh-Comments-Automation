import { chromium } from 'playwright-extra';
// @ts-ignore
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

chromium.use(stealthPlugin());

async function run() {
    console.log("🔓 Starting manual session refresh browser...");
    const fbEmail = process.env.FB_EMAIL!;
    const userDataDir = path.join(__dirname, 'FiestaSession');

    console.log(`🧠 User Data Directory: ${userDataDir}`);

    const contextOptions: any = {
        headless: false, // Open a visible window!
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-features=IsolateOrigins,site-per-process'
        ],
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        viewport: null, // Allow custom sizing
        locale: 'en-AU',
        timezoneId: 'Australia/Brisbane',
    };

    console.log("🌐 Running session refresh without proxy for local stability.");

    const context = await chromium.launchPersistentContext(userDataDir, contextOptions);
    const page: any = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

    console.log("➡️ Navigating to Facebook. Please check the opened browser window...");
    await page.goto('https://www.facebook.com');

    console.log("\n⚠️ ACTION REQUIRED ⚠️");
    console.log("Please log in to Facebook in the opened browser window.");
    console.log("The script will automatically detect when you are logged in and save the session!\n");

    // Poll for login success (home feed loaded)
    let loggedIn = false;
    for (let check = 0; check < 60; check++) { // Poll every 2 seconds for up to 2 minutes
        await new Promise(r => setTimeout(r, 2000));
        
        if (page.isClosed()) {
            console.log("🚪 Browser page closed by user.");
            break;
        }

        const homeMarkers = page.locator('[aria-label="Your profile"], [aria-label="Facebook"], [aria-label*="Home"], [aria-label="Home"]');
        const isHomeVisible = await homeMarkers.first().isVisible().catch(() => false);

        if (isHomeVisible) {
            console.log("🎉 Login detected! Capturing cookies...");
            const cookies = await context.cookies();
            await supabase.from('sessions').upsert({ user_email: fbEmail, cookies, updated_at: new Date() });
            console.log("🎉 Successfully saved refreshed cookies to Supabase!");
            loggedIn = true;
            break;
        }
    }

    if (!loggedIn && !page.isClosed()) {
        console.log("⚠️ Timeout waiting for login detection. Saving cookies anyway...");
        try {
            const cookies = await context.cookies();
            await supabase.from('sessions').upsert({ user_email: fbEmail, cookies, updated_at: new Date() });
            console.log("💾 Cookies saved.");
        } catch (e) {
            console.error("❌ Failed to save cookies:", e);
        }
    }

    await context.close();
    console.log("🏁 Browser closed. Session refresh complete.");
}

run().catch(console.error);
