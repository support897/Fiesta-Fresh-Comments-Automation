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

async function runBot() {
    console.log("🤖 Starting Fiesta Fresh Automation Bot...");
    
    // 1. Check if the bot is toggled ON in the dashboard
    const { data: config } = await supabase.from('config').select('*').single();
    if (!config || !config.bot_status) {
        console.log("⏸️ Bot is paused in the dashboard. Sleeping...");
        return;
    }

    console.log("✅ Bot is ACTIVE. Launching stealth browser...");

    // 2. Launch Browser (Headless MUST BE TRUE on a Cloud Server!)
    const browser = await chromium.launch({
        headless: true,
        args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 },
        locale: 'en-AU',
        timezoneId: 'Australia/Brisbane',
    });

    const page = await context.newPage();

    const fbEmail = process.env.FB_EMAIL;
    const fbPassword = process.env.FB_PASSWORD;

    try {
        console.log("➡️ Navigating to Facebook...");
        await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle' });

        // Check for login fields
        if (await page.locator('#email').count() > 0) {
            console.log("🔒 Login screen detected. Attempting to log in...");
            if (!fbEmail || !fbPassword) {
                console.error("❌ FB_EMAIL or FB_PASSWORD environment variables are missing! Cannot log in.");
                await browser.close();
                return;
            }
            
            // Human-like typing pauses
            await page.type('#email', fbEmail, { delay: Math.floor(Math.random() * 100) + 50 });
            await page.waitForTimeout(500);
            await page.type('#pass', fbPassword, { delay: Math.floor(Math.random() * 100) + 50 });
            await page.waitForTimeout(1000);
            
            await page.click('[name="login"]');
            await page.waitForNavigation({ waitUntil: 'networkidle' });
            console.log("✅ Logged in successfully!");
            
            // Wait an extra moment to let the home feed fully load
            await page.waitForTimeout(5000);
        } else {
            console.log("✅ Already logged in (or active session found).");
        }

        // 3. Fetch keywords and groups from DB
        const { data: groups } = await supabase.from('groups').select('*').eq('is_active', true);
        const { data: keywords } = await supabase.from('keywords').select('*');
        const { data: templates } = await supabase.from('templates').select('*').eq('is_active', true).single();

        if (!groups || groups.length === 0) {
            console.log("No active Facebook groups to check!");
            await browser.close();
            return;
        }

        const templateText = templates?.content || "Hi there! We would absolutely love to help you out with this 💙";

        // 4. Poll each group
        const currentDay = new Date().toLocaleString('en-US', { weekday: 'long', timeZone: 'Australia/Brisbane' });
        
        for (const group of groups) {
            // Apply scheduling logic
            if (group.url.includes('1CbgwuTsYk') && currentDay !== 'Monday') {
                console.log(`⏭️ Skipping ${group.url} (Only runs on Monday)`);
                continue;
            }
            if (group.url.includes('1JiqcFo29z') && currentDay !== 'Thursday') {
                console.log(`⏭️ Skipping ${group.url} (Only runs on Thursday)`);
                continue;
            }

            console.log(`\n🔍 Checking group: ${group.url}`);
            await page.goto(group.url, { waitUntil: 'networkidle' });

            // Human-like hesitation and scrolling
            await page.waitForTimeout(Math.floor(Math.random() * 3000) + 2000);
            await page.mouse.wheel(0, 500);
            await page.waitForTimeout(2000);

            // TODO: In a full production script, we would parse the Graph/HTML for comments here.
            // Since this is the initial stealth version, we are acting safely.
            console.log("✅ Successfully simulated human browsing for group.");
        }

    } catch (e) {
        console.error("Bot encountered an error:", e);
    } finally {
        console.log("🛑 Closing browser in 10 seconds...");
        await page.waitForTimeout(10000);
        await browser.close();
    }
}

// Run the bot
runBot();
