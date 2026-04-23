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
            console.error("📸 Upload failed:", error.message);
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

    // --- FUZZY START ---
    // const delayMin = Math.floor(Math.random() * 2) + 1;
    // console.log(`⏳ Stealth: Initial "Fuzzy Delay" for ${delayMin} minutes...`);
    // await new Promise(r => setTimeout(r, delayMin * 60 * 1000));

    const proxyServer = process.env.PROXY_SERVER;
    const launchOptions: any = {
        headless: true,
        args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-setuid-sandbox']
    };

    // if (proxyServer) {
    //     console.log(`🌐 Using Proxy: ${proxyServer}`);
    //     launchOptions.proxy = {
    //         server: proxyServer
    //     };
    // }

    const userDataDir = path.join(__dirname, 'FiestaSession');
    console.log(`🧠 Using Persistent Context: ${userDataDir}`);

    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: true,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-features=IsolateOrigins,site-per-process'
        ],
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 },
        locale: 'en-AU',
        timezoneId: 'Australia/Brisbane',
    });

    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

    try {
        console.log("➡️ Navigated to Facebook. Checking state...");
        await page.waitForTimeout(5000);

        // --- HANDLE COOKIE CONSENT ---
        const selectors = [
            'button[data-testid="cookie-policy-manage-dialog-accept-button"]',
            'button:has-text("Allow all cookies")',
            'button:has-text("Allow essential and optional cookies")',
            'div[aria-label="Allow all cookies"]',
            '[aria-label="Allow all cookies"]'
        ];
        
        for (const selector of selectors) {
            const btn = page.locator(selector).first();
            if (await btn.isVisible()) {
                console.log(`🍪 Found cookie banner (${selector}). Clicking...`);
                await btn.click();
                await page.waitForTimeout(2000);
                break;
            }
        }

        // --- LOGIN OR HOME CHECK ---
        const loginMarkers = page.locator('#email, [name="email"], #pass, [name="pass"]');
        const homeMarkers = page.locator('[aria-label="Your profile"], [aria-label="Facebook"], [aria-label*="Home"], [aria-label="Home"]');

        if (await loginMarkers.first().isVisible()) {
            console.log("🔒 Login screen detected. Logging in...");
            await humanType(page, '#email', fbEmail);
            await page.waitForTimeout(800 + Math.random() * 500);
            await humanType(page, '#pass', fbPassword);
            await page.waitForTimeout(500);
            await page.click('[name="login"]');
            
            console.log("⏳ Waiting for landing page...");
            // Wait for home markers to appear
            await homeMarkers.first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => console.log("⚠️ Slow login or 2FA request?"));
            await page.waitForTimeout(5000);

            // SAVE SESSION
            const cookies = await context.cookies();
            await supabase.from('sessions').upsert({ user_email: fbEmail, cookies, updated_at: new Date() });
            console.log("💾 Session updated in Supabase.");
        }

        // --- FINAL IDENTITY VERIFICATION ---
        const isLogged = await homeMarkers.first().isVisible();
        if (!isLogged) {
            console.error("❌ Final Identity Check Failed.");
            const errorPath = await captureProof(page, 'identity_verify_failed');
            console.log(`📸 Diagnostic Screenshot: ${errorPath}`);
            await context.close();
            return;
        }

        console.log("👤 Identity verified. Starting group patrol...");

        const { data: groups } = await supabase.from('groups').select('*').eq('is_active', true);
        const { data: keywords } = await supabase.from('keywords').select('*');
        const { data: templates } = await supabase.from('templates').select('*').eq('is_active', true).single();

        const templateText = templates?.content || "Hi there! We are fully insured and police checked, and we would absolutely love to help you out 💙 You can view our prices and book directly in 60 seconds right here: https://www.fiestafreshcleaning.com/book ✨ Or send a direct message to https://www.facebook.com/share/1KZ42C9jSc/?mibextid=wwXIfr 💙";

        if (!groups) return;

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

            // 1. Wait for posts to load
            await page.waitForSelector('[role="article"]', { timeout: 10000 }).catch(() => null);
            
            const posts = page.locator('[role="article"]');
            const postCount = await posts.count();
            console.log(`📡 Found ${postCount} posts in the visible area.`);

            // LOCAL TRACKER for this run
            const localRepliedIds = new Set();

            for (let i = 0; i < Math.min(postCount, 5); i++) {
                const post = posts.nth(i);
                const postText = (await post.innerText()).trim();
                
                // Create a STABLE ID based on group url + first 50 chars of post text 
                // (This avoids issues with Facebook's dynamic div IDs)
                const textHash = postText.substring(0, 100).replace(/\s/g, '_');
                const postID = `hash_${textHash}`;

                // Check for keywords
                const match = keywords?.find(k => postText.toLowerCase().includes(k.keyword.toLowerCase()));
                
                if (match) {
                    console.log(`🎯 MATCH FOUND: "${match.keyword}"`);

                    // 2. CHECK LOCAL & REMOTE DEDUPLICATION
                    if (localRepliedIds.has(postID)) {
                        console.log("⏭️ Already replied in this session. Skipping.");
                        continue;
                    }

                    const { data: existing } = await supabase.from('replies_log').select('*').eq('post_id', postID).single();
                    if (existing) {
                        console.log("⏭️ Already logged in DB. Skipping.");
                        continue;
                    }

                    console.log("✍️ Preparing reply...");
                    const commentBox = post.locator('[aria-label="Write a comment"], [role="textbox"]').first();
                    
                    if (await commentBox.isVisible()) {
                        await commentBox.click();
                        await page.waitForTimeout(1000);
                        await humanType(page, '[role="textbox"]:focus', templateText);
                        
                        // --- CRITICAL: Log ATTEMPT to DB first to prevent race conditions ---
                        const { error: logError } = await supabase.from('replies_log').insert({
                            group_url: group.url,
                            post_id: postID,
                            template_id: templates?.id,
                            keyword_id: match.id,
                            status: 'pending' // Mark as pending while we finish
                        });

                        if (logError) {
                            console.error("❌ Database logging failed! Aborting comment to prevent double-posting.");
                            continue;
                        }

                        await page.keyboard.press('Enter');
                        console.log("✅ Reply posted!");
                        localRepliedIds.add(postID); // Block in local memory
                        
                        await page.waitForTimeout(2000);

                        // 4. Capture Visual Proof and update log
                        const proofUrl = await captureProof(page, `reply_${i}`);
                        if (proofUrl) {
                            await supabase.from('replies_log').update({ 
                                screenshot_url: proofUrl, 
                                status: 'success' 
                            }).eq('post_id', postID);
                        }

                        break; // Stop after one reply per group to stay stealthy
                    } else {
                        console.log("⚠️ Could not find comment box.");
                    }
                }
            }
        }

    } catch (e) {
        console.error("💥 Failure:", e);
        if (page) await captureProof(page, 'error');
    } finally {
        if (page) await page.waitForTimeout(5000);
        await context.close();
        console.log("🏁 Cycle complete.");
    }
}

runBot();
