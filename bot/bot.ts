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

/**
 * Human-like typing
 */
async function humanType(page: any, selector: string, text: string) {
    await page.click(selector);
    for (const char of text) {
        await page.type(selector, char, { delay: Math.floor(Math.random() * 100) + 45 });
    }
}

/**
 * Capture and upload screenshot to Supabase
 */
async function captureProof(page: any, fileName: string) {
    try {
        const screenshot = await page.screenshot({ fullPage: false });
        const filePath = `proofs/${Date.now()}_${fileName}.png`;
        
        const { data, error } = await supabase.storage
            .from('bot-screenshots')
            .upload(filePath, screenshot, { contentType: 'image/png' });

        if (error) {
            console.error("📸 Upload failed (Make sure 'bot-screenshots' bucket is public):", error.message);
            return null;
        }

        const { data: { publicUrl } } = supabase.storage.from('bot-screenshots').getPublicUrl(filePath);
        console.log(`📸 Proof captured: ${publicUrl}`);
        return publicUrl;
    } catch (e) {
        console.error("Failed to capture screenshot:", e);
        return null;
    }
}

async function runBot() {
    console.log("🤖 Starting Fiesta Fresh Automation Bot...");
    
    const fbEmail = process.env.FB_EMAIL!;
    const fbPassword = process.env.FB_PASSWORD!;

    // 1. Check Config
    const { data: config } = await supabase.from('config').select('*').single();
    if (!config || !config.bot_status) {
        console.log("⏸️ Bot is paused. Sleeping...");
        return;
    }

    // --- FUZZY START (1-3 minutes random delay) ---
    const delayMin = Math.floor(Math.random() * 2) + 1;
    console.log(`⏳ Stealth: Initial "Fuzzy Delay" for ${delayMin} minutes...`);
    await new Promise(r => setTimeout(r, delayMin * 60 * 1000));

    const proxyServer = process.env.PROXY_SERVER;
    const launchOptions: any = {
        headless: true,
        args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-setuid-sandbox']
    };

    if (proxyServer) {
        console.log(`🌐 Using Proxy: ${proxyServer}`);
        launchOptions.proxy = {
            server: proxyServer,
            username: process.env.PROXY_USERNAME,
            password: process.env.PROXY_PASSWORD
        };
    }

    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 },
        locale: 'en-AU',
        timezoneId: 'Australia/Brisbane',
    });

    // --- SESSION SYNC: LOAD ---
    console.log("🧠 Syncing cookie session...");
    const { data: sessionData } = await supabase.from('sessions').select('cookies').eq('user_email', fbEmail).single();
    if (sessionData && sessionData.cookies) {
        await context.addCookies(sessionData.cookies);
        console.log("✅ Previous session loaded.");
    }

    const page = await context.newPage();

    try {
        await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle' });

        // IDENTITY CHECK / LOGIN
        if (await page.locator('#email').count() > 0) {
            console.log("🔒 Session expired. Logging in fresh...");
            await humanType(page, '#email', fbEmail);
            await page.waitForTimeout(1000);
            await humanType(page, '#pass', fbPassword);
            await page.click('[name="login"]');
            await page.waitForNavigation({ waitUntil: 'networkidle' });
            
            // SAVE SESSION
            const cookies = await context.cookies();
            await supabase.from('sessions').upsert({ user_email: fbEmail, cookies, updated_at: new Date() });
            console.log("💾 Session saved to database.");
        }

        // VERIFY IDENTITY
        const isLogged = await page.locator('[aria-label="Your profile"], [aria-label="Facebook"]').count();
        if (isLogged === 0) {
            console.error("❌ Identity Check Failed: Not logged in correctly.");
            await captureProof(page, 'login_failed');
            await browser.close();
            return;
        }

        console.log("👤 Identity verified. Starting group patrol...");

        const { data: groups } = await supabase.from('groups').select('*').eq('is_active', true);
        const { data: keywords } = await supabase.from('keywords').select('*');
        const { data: templates } = await supabase.from('templates').select('*').eq('is_active', true).single();

        const templateText = templates?.content || "Hi there! We would love to help! 💙";

        if (!groups) {
            console.log("No active groups found in database.");
            await browser.close();
            return;
        }

        for (const group of groups) {
            console.log(`\n🔍 Scanning: ${group.url}`);
            await page.goto(group.url, { waitUntil: 'networkidle' });
            await page.waitForTimeout(2000);

            // BYPASS BUY/SELL LAYOUT
            const discussionTab = page.locator('span:has-text("Discussion")');
            if (await discussionTab.isVisible()) {
                console.log("📂 Buy/Sell layout detected. Switching to Discussion...");
                await discussionTab.click();
                await page.waitForTimeout(2000);
            }

            // SIMULATE HUMAN BROWSING
            await page.mouse.wheel(0, 800);
            await page.waitForTimeout(3000);

            // LOGIC FOR COMMENTING WOULD GO HERE
            // For now, we take a placeholder screenshot as "Proof of Scan"
            if (Math.random() > 0.8) { // Simulate finding a match occasionally for the demo
               const url = await captureProof(page, 'group_scan');
               await supabase.from('replies_log').insert({
                   group_url: group.url,
                   post_id: 'sample_' + Date.now(),
                   comment_id: 'sample_' + Date.now(),
                   screenshot_url: url
               });
            }
        }

    } catch (e) {
        console.error("💥 Critical Failure:", e);
        await captureProof(page, 'error');
    } finally {
        await page.waitForTimeout(5000);
        await browser.close();
        console.log("🏁 Cycle complete.");
    }
}

runBot();
