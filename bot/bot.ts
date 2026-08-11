import { chromium } from 'playwright-extra';
// @ts-ignore
import type { Page, Locator } from 'playwright-core';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { pipeline, cos_sim } from '@xenova/transformers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const DRY_RUN = process.env.DRY_RUN === 'true';
const SCAN_INTERVAL = parseInt(process.env.SCAN_INTERVAL_SECONDS || '900') * 1000;

// --- Account Configuration ---
// FB_ACCOUNTS = JSON array of {email, password} for multi-account rotation
// Falls back to FB_EMAIL/FB_PASSWORD for backward compatibility
interface FbAccount { email: string; password: string; }

function loadAccounts(): FbAccount[] {
    const raw = process.env.FB_ACCOUNTS;
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed.filter((a: any) => a.email && a.password);
            }
        } catch (e) {
            console.error("⚠️ Invalid FB_ACCOUNTS JSON, falling back to FB_EMAIL/FB_PASSWORD.");
        }
    }
    const single: FbAccount[] = [];
    if (process.env.FB_EMAIL && process.env.FB_PASSWORD) {
        single.push({ email: process.env.FB_EMAIL!, password: process.env.FB_PASSWORD! });
    }
    return single;
}

const ACCOUNTS = loadAccounts();
let currentAccountIndex = 0;

function nextAccount(): FbAccount | null {
    if (ACCOUNTS.length === 0) return null;
    const account = ACCOUNTS[currentAccountIndex % ACCOUNTS.length];
    currentAccountIndex++;
    return account ?? null;
}

chromium.use(stealthPlugin());

// --- Utility Functions ---

/**
 * Attempts to extract a real Facebook Post ID from a post element.
 * Prioritizes permalinks (story_fbid) then data-ft attributes.
 */
async function extractFacebookPostId(postElement: Locator): Promise<string | null> {
    let postId = null;

    // 1. Try finding permalink from timestamp/date link
    try {
        const timestampLink = postElement.locator('a[href*="/posts/"], a[href*="story_fbid="], a[aria-label*="Time"], a[aria-label*="Date"]').first();
        const permalink = await timestampLink.getAttribute('href');
        if (permalink) {
            const matchFbid = permalink.match(/story_fbid=(\d+)/);
            if (matchFbid && matchFbid[1]) {
                postId = matchFbid[1];
                console.log(`    [PostID] Extracted from story_fbid: ${postId}`);
            } else {
                const matchPostPath = permalink.match(/\/posts\/(\d+)/);
                if (matchPostPath && matchPostPath[1]) {
                    postId = matchPostPath[1];
                    console.log(`    [PostID] Extracted from /posts/: ${postId}`);
                }
            }
        }
    } catch (e: any) {
        console.log(`    [PostID] Permalink extraction failed: ${e.message.slice(0, 80)}`);
    }

    // 2. Fallback to data-ft attribute on a parent element
    if (!postId) {
        try {
            const dataFtElement = await postElement.locator('[data-ft]').first().elementHandle();
            const dataFt = await dataFtElement?.getAttribute('data-ft');
            if (dataFt) {
                try {
                    const ftData = JSON.parse(dataFt);
                    if (ftData.fb_id) {
                        postId = ftData.fb_id;
                        console.log(`    [PostID] Extracted from data-ft.fb_id: ${postId}`);
                    } else if (ftData.story_fbid) {
                        postId = ftData.story_fbid;
                        console.log(`    [PostID] Extracted from data-ft.story_fbid: ${postId}`);
                    }
                } catch (e) {
                    console.log(`    [PostID] data-ft JSON parse error: ${e}`);
                }
            }
        } catch (e: any) {
            console.log(`    [PostID] data-ft attribute extraction failed: ${e.message.slice(0, 80)}`);
        }
    }

    return postId;
}

/**
 * Extracts a real Facebook Post ID from a post-message element by walking up
 * ancestor containers (permalink links and data-ft live on containers, not the
 * message div itself).
 */
async function extractFacebookPostIdFromMessage(message: any): Promise<string | null> {
    try {
        return await message.evaluate((el: HTMLElement) => {
            let cur: HTMLElement | null = el;
            for (let i = 0; cur && i < 10; i++) {
                const permalink = cur.querySelector('a[href*="/posts/"], a[href*="story_fbid="], a[aria-label*="Time"], a[aria-label*="Date"]');
                if (permalink) {
                    const href = permalink.getAttribute('href') || '';
                    const m1 = href.match(/story_fbid=(\d+)/);
                    if (m1 && m1[1]) return m1[1];
                    const m2 = href.match(/\/posts\/(\d+)/);
                    if (m2 && m2[1]) return m2[1];
                }
                const ft = cur.querySelector('[data-ft]');
                if (ft) {
                    try {
                        const f = JSON.parse(ft.getAttribute('data-ft') || '');
                        if (f.fb_id) return String(f.fb_id);
                        if (f.story_fbid) return String(f.story_fbid);
                    } catch { /* ignore */ }
                }
                cur = cur.parentElement;
            }
            return null;
        });
    } catch (e: any) {
        console.log(`    [PostID] extraction failed: ${e.message.slice(0, 80)}`);
        return null;
    }
}

// Keyword quick filters (instant approval/rejection - no AI cost)
const APPROVE_KEYWORDS = [
    'cleaner', 'cleaning', 'clean', 'bond clean', 'end of lease', 
    'deep clean', 'house clean', 'home clean', 'maid', 'domestic',
    'spring clean', 'move out', 'vacate', 'carpet clean', 'window clean',
    'price', 'cost', 'how much', 'quote', 'rate', 'recommend', 'recommendation'
];

const REJECT_KEYWORDS = [
    'car wash', 'car clean', 'vehicle', 'mobile detailing',
    'commercial', 'office clean', 'warehouse', 'factory',
    'pool clean', 'gutter', 'lawn', 'garden', 'landscaping',
    'plumber', 'electrician', 'handyman', 'painter', 'removalist'
];

/**
 * Random delay for human-like behavior
 */
async function randomDelay(min: number = 500, max: number = 2000) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Human-like typing with random speed
 */
async function humanType(page: any, selector: string, text: string) {
    await page.click(selector);
    await randomDelay(300, 800);
    
    for (const char of text) {
        const typingSpeed = Math.floor(Math.random() * 100) + 45; // 45-145ms per char
        await page.type(selector, char, { delay: typingSpeed });
    }
}

/**
 * Close overlays and popups
 */
async function closeOverlays(page: any) {
    const overlaySelectors = [
        'button[data-testid="cookie-policy-manage-dialog-accept-button"]',
        'button:has-text("Allow all cookies")',
        'button:has-text("Allow essential and optional cookies")',
        'div[aria-label="Allow all cookies"]',
        '[aria-label="Allow all cookies"]',
        '[aria-label="Close"]',
        'button[aria-label="Close"]',
        'div[role="dialog"] button:has-text("Close")',
        'div[role="dialog"] button:has-text("Not Now")',
    ];
    
    for (const selector of overlaySelectors) {
        try {
            const btn = page.locator(selector).first();
            if (await btn.isVisible({ timeout: 2000 })) {
                console.log(`🍪 Closing overlay (${selector})`);
                await btn.click();
                await randomDelay(1000, 2000);
            }
        } catch (e) {
            // Overlay not found, continue
        }
    }
}

/**
 * Extract commenter name from post element
 */
async function extractCommenterName(postElement: any): Promise<string> {
    try {
        // Try multiple selectors for name extraction
        const nameSelectors = [
            'h4', 
            'strong a', 
            'a[role="link"] span',
            '[data-ad-preview="message"] strong'
        ];
        
        for (const selector of nameSelectors) {
            try {
                const nameEl = postElement.locator(selector).first();
                if (await nameEl.isVisible({ timeout: 1000 })) {
                    const name = await nameEl.innerText();
                    if (name && name.length > 0 && name.length < 50) {
                        return name.trim().split(' ')[0]; // First name only
                    }
                }
            } catch (e) {
                continue;
            }
        }
    } catch (e) {
        console.log("⚠️ Could not extract commenter name");
    }
    return 'there'; // Fallback
}

/**
 * Keyword-based quick filter (saves AI costs)
 */
function quickKeywordFilter(postText: string): 'approve' | 'reject' | 'unsure' {
    const lowerText = postText.toLowerCase();
    
    // Check reject keywords first (high priority)
    for (const keyword of REJECT_KEYWORDS) {
        if (lowerText.includes(keyword.toLowerCase())) {
            console.log(`❌ Quick REJECT - keyword: "${keyword}"`);
            return 'reject';
        }
    }
    
    // Check approve keywords
    for (const keyword of APPROVE_KEYWORDS) {
        if (lowerText.includes(keyword.toLowerCase())) {
            console.log(`✅ Quick APPROVE - keyword: "${keyword}"`);
            return 'approve';
        }
    }
    
    console.log("🤔 Unsure - sending to AI evaluation");
    return 'unsure';
}

/**
 * Capture and upload screenshot to Supabase Storage
 */
async function captureProof(page: any, fileName: string) {
    try {
        const screenshot = await page.screenshot({ fullPage: false, timeout: 8000 });
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

/**
 * Semantic Search Fallback (Local AI)
 */
let extractor: any = null;

async function getExtractor() {
    if (!extractor) {
        console.log("📥 Loading local semantic AI model (first time downloads it)...");
        extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    return extractor;
}

async function evaluateWithSemanticSearch(postText: string): Promise<boolean> {
    try {
        console.log("🧠 Running local Semantic Search Fallback...");
        const extract = await getExtractor();
        
        const idealLead = "I am looking to hire a professional residential house cleaner for a deep clean of my home.";
        
        const postOutput = await extract(postText, { pooling: 'mean', normalize: true });
        const idealOutput = await extract(idealLead, { pooling: 'mean', normalize: true });
        
        const similarity = cos_sim(Array.from(postOutput.data), Array.from(idealOutput.data));
        console.log(`📊 Semantic Similarity Score: ${(similarity * 100).toFixed(2)}%`);
        
        return similarity > 0.45;
    } catch (e) {
        console.error("❌ Semantic search failed:", e);
        return postText.toLowerCase().includes('clean');
    }
}

/**
 * Lead Evaluator (local semantic search - no API key needed)
 */
async function evaluatePostWithAI(postText: string): Promise<boolean> {
    return await evaluateWithSemanticSearch(postText);
}

async function runBot() {
    console.log("🤖 Starting Fiesta Fresh Automation Bot...");
    console.log(`Mode: ${DRY_RUN ? '🧪 DRY RUN (no actual posts)' : '🔴 LIVE MODE'}`);
    console.log(`Scan Interval: ${SCAN_INTERVAL / 1000}s`);
    
    const account = nextAccount();
    if (!account) {
        console.error("❌ No Facebook accounts configured. Set FB_ACCOUNTS or FB_EMAIL/FB_PASSWORD.");
        return;
    }
    const fbEmail = account.email;
    const fbPassword = account.password;
    console.log(`👤 Account: ${fbEmail}`);

    // 1. Check Config
    const { data: config, error: configErr } = await supabase.from('config').select('*').single();
    if (configErr) {
        console.log(`⚠️ Config read error (${configErr.code || configErr.message}). Retrying later...`);
        return;
    }
    if (!config || !config.bot_status) {
        console.log("⏸️ Bot is paused in Supabase config. Waiting...");
        return;
    }

    const proxyServer = process.env.PROXY_SERVER;
    const userDataDir = path.join(__dirname, 'FiestaSession');
    console.log(`🧠 Using Persistent Context: ${userDataDir}`);

    const contextOptions: any = {
        headless: true,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--autoplay-policy=user-gesture-required',
            '--blink-settings=imagesEnabled=false',
            '--js-flags=--max-old-space-size=256'
        ],
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 },
        locale: 'en-AU',
        timezoneId: 'Australia/Brisbane',
    };

    if (proxyServer) {
        // Embed credentials directly in the SOCKS5 URL (required for SOCKS auth)
        const proxyUser = process.env.PROXY_USERNAME;
        const proxyPass = process.env.PROXY_PASSWORD;
        let proxyUrl = proxyServer;
        if (proxyUser && proxyPass && !proxyUrl.includes('@')) {
            const [scheme, rest] = proxyUrl.split('://');
            proxyUrl = `${scheme}://${encodeURIComponent(proxyUser)}:${encodeURIComponent(proxyPass)}@${rest}`;
        }
        console.log(`🌐 Using Proxy: ${proxyUrl}`);
        contextOptions.proxy = { server: proxyUrl };
    }

    const context = await chromium.launchPersistentContext(userDataDir, contextOptions);

    // Block heavy downloads (images/media/fonts) — we only scrape text. Cuts memory
    // massively, which is critical on Render's 512Mi instance (was OOM-killing us).
    await context.route('**/*', (route: any) => {
        const type = route.request().resourceType();
        if (type === 'image' || type === 'media' || type === 'font') {
            return route.abort();
        }
        return route.continue();
    });

    const page: any = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

    // Restore saved session from Supabase (bypasses login/captcha if cookies are valid)
    let restoredSession = false;
    const { data: savedSession } = await supabase.from('sessions').select('cookies').eq('user_email', fbEmail).order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (savedSession?.cookies && Array.isArray(savedSession.cookies)) {
        try {
            await context.addCookies(savedSession.cookies as any);
            restoredSession = true;
            console.log(`💾 Restored session for ${fbEmail} from Supabase (${savedSession.cookies.length} cookies).`);
        } catch (e) {
            console.warn(`⚠️ Could not restore saved session: ${e}`);
        }
    }

    try {
        console.log("➡️ Navigating to Facebook...");
        await page.goto('https://www.facebook.com', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(async () => {
            console.log("⚠️ Home goto slow — retrying once...");
            await randomDelay(3000, 5000);
            await page.goto('https://www.facebook.com', { waitUntil: 'domcontentloaded', timeout: 45000 });
        });
        await randomDelay(3000, 5000);

        // Close overlays
        await closeOverlays(page);

        // Login check
        const loginMarkers = page.locator('#email, [name="email"], #pass, [name="pass"]');
        const homeMarkers = page.locator('[aria-label="Your profile"], [aria-label="Facebook"], [aria-label*="Home"]');

        if (await loginMarkers.first().isVisible()) {
            console.log("🔒 Login screen detected. Logging in...");
            await humanType(page, '[name="email"]', fbEmail);
            await randomDelay(800, 1500);
            await humanType(page, '[name="pass"]', fbPassword);
            await randomDelay(500, 1000);
            await page.click('[aria-label="Log in"]').catch(async () => {
                await page.click('input[type="submit"]').catch(() => page.click('[name="login"]'));
            });
            
            console.log("⏳ Waiting for landing page...");
            await homeMarkers.first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => console.log("⚠️ Slow login or 2FA?"));
            await randomDelay(3000, 5000);

            // Save session
            const cookies = await context.cookies();
            await supabase.from('sessions').upsert({ user_email: fbEmail, cookies, updated_at: new Date() });
            console.log("💾 Session updated in Supabase.");
        }

        // Verify login — we cannot rely on the home-feed markers because the
        // route-blocking (needed to survive Render's 512Mi limit) stops the home
        // SPA from rendering them. Instead: logged-in == login form absent AND
        // not on a login/captcha URL.
        const currentUrl = page.url();
        const loginFormVisible = await loginMarkers.first().isVisible().catch(() => false);
        const isLogged = !loginFormVisible
            && !currentUrl.includes('login.php')
            && !currentUrl.includes('two_step_verification')
            && !currentUrl.includes('recaptcha');
        if (!restoredSession && isLogged) {
            console.warn(`⚠️ No saved session for ${fbEmail} but logged in — using stale profile cookies from a previous account. Run \`npx tsx prime-session.ts\` to prime this account's session before going live.`);
        }
        if (!isLogged) {
            const hasCaptcha = currentUrl.includes('two_step_verification') || page.frames().some((f: any) => f.url().includes('recaptcha'));
            if (hasCaptcha) {
                console.error("🚫 Facebook risk challenge detected (reCAPTCHA). A human must prime the session once: run `npx tsx prime-session.ts`, solve the captcha in the visible Chrome window, then cookies are saved for the bot to reuse.");
                await captureProof(page, 'recaptcha_challenge');
            } else {
                console.error("❌ Login verification failed.");
                await captureProof(page, 'login_failed');
            }
            await context.close();
            return;
        }

        console.log("👤 Login verified. Starting execution...");
        
        // PHASE 1: Execute approved leads
        const { data: approvedLeads } = await supabase.from('leads').select('*').eq('status', 'approved');
        const { data: templates } = await supabase.from('templates').select('*').eq('is_active', true).single();
        const templateText = templates?.content || `Hi! 💙 We would absolutely love to help you out!

We are Fiesta Fresh Cleaning, a local Gold Coast team that genuinely cares about every single home and space we walk into. Fully insured, police-checked and proudly serving the Gold Coast community 🏡✨

And here is what makes us a little different from everyone else… we offer a 200% Happiness Guarantee on every single clean we do. That means if anything is not perfect we come back and fix it for FREE. No questions asked. We are the only cleaning company on the Gold Coast offering this and we stand behind it completely. 🙌

We are not a big franchise. We are your neighbours. A real local team that shows up, works hard and truly cares about leaving your space better than we found it. Every single time. 💙

You can check out everything we offer, read our reviews and even book in 60 seconds right here 👉 fiestafreshcleaning.com/book

We will also send you a DM just in case you have any questions. Make sure to check your message requests! We cannot wait to help you out. 🎉`;

        if (approvedLeads && approvedLeads.length > 0) {
            console.log(`✅ Found ${approvedLeads.length} approved leads to execute.`);
            for (const lead of approvedLeads) {
                console.log(`\n🚀 Executing approved lead: ${lead.post_id}`);
                
                if (DRY_RUN) {
                    console.log(`[DRY RUN] Would comment on: ${lead.group_url}`);
                    console.log(`[DRY RUN] Comment: ${templateText.substring(0, 100)}...`);
                    await supabase.from('leads').update({ status: 'posted' }).eq('id', lead.id);
                    continue;
                }
                
                await page.goto(lead.group_url, { waitUntil: 'domcontentloaded', timeout: 45000 });
                await randomDelay(2000, 4000);
                
                // Scroll to find post
                for (let scroll = 0; scroll < 5; scroll++) {
                    await page.mouse.wheel(0, 1000);
                    await randomDelay(1500, 3000);
                    const posts = page.locator('[role="article"]');
                    const count = await posts.count();
                    let found = false;

                    for (let i = 0; i < count; i++) {
                        const postText = (await posts.nth(i).innerText()).trim();
                        if (postText.includes(lead.post_text.substring(0, 50))) {
                            console.log("🎯 Found approved post! Commenting...");
                            await closeOverlays(page);
                            
                            const commentBox = posts.nth(i).locator('[aria-label="Write a comment"], [role="textbox"]').first();
                            if (await commentBox.isVisible()) {
                                await randomDelay(1000, 2000);
                                await commentBox.click();
                                await randomDelay(800, 1500);
                                await humanType(page, '[role="textbox"]:focus', templateText);
                                await randomDelay(500, 1000);
                                await page.keyboard.press('Enter');
                                await randomDelay(2000, 3000);
                                
                                // **FIX: Write to replies_log for deduplication**
                                await supabase.from('replies_log').insert({
                                    post_id: lead.post_id,
                                    group_url: lead.group_url,
                                    comment_id: `comment_${Date.now()}`,
                                    replied_at: new Date()
                                });
                                
                                await supabase.from('leads').update({ status: 'posted' }).eq('id', lead.id);
                                console.log("✅ Comment posted and logged.");
                                found = true;
                                break;
                            }
                        }
                    }
                    if (found) break;
                }
            }
        }

        // PHASE 2: Scrape groups for new posts
        console.log("🔍 Starting group patrol...");

        const { data: groups } = await supabase.from('groups').select('*').eq('is_active', true);

        if (groups) {
            for (const group of groups) {
                console.log(`\n📡 Scanning: ${group.url}`);
                try {
                    try {
                        await page.goto(group.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
                    } catch (gotoErr) {
                        console.warn(`⚠️ goto timed out for ${group.url}, retrying once...`);
                        await randomDelay(4000, 6000);
                        await page.goto(group.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
                    }
                } catch (e) {
                    console.warn(`⚠️ Skipping group ${group.url}: ${(e as any).message?.slice(0, 100)}`);
                    await randomDelay(2000, 3000);
                    continue;
                }
                await randomDelay(2000, 4000);

                // Human-like pacing — Facebook kills sessions on fast request bursts
                // (datacenter IP + rapid group loads triggered the risk engine). Keep
                // several seconds of quiet time between group navigations.
                await randomDelay(4000, 8000);

                // Switch to Discussion if Buy/Sell layout
                const discussionTab = page.locator('span:has-text("Discussion")').first();
                if (await discussionTab.isVisible()) {
                    console.log("📂 Switching to Discussion tab...");
                    await discussionTab.click();
                    await randomDelay(2000, 3000);
                }

                // Human-like browsing
                await page.mouse.wheel(0, 800);
                await randomDelay(2000, 4000);

                // Facebook group posts no longer use role=article; the post text lives in
                // [data-ad-preview="message"] elements. Wait for them to render.
                await page.waitForSelector('[data-ad-preview="message"]', { timeout: 20000 }).catch(() => null);

                const posts = page.locator('[data-ad-preview="message"]');
                const postCount = await posts.count();
                console.log(`📡 Found ${postCount} posts.`);

                let previousPostCount = 0;
                let currentScrolls = 0;
                const MAX_SCROLLS = 2; // How many times to scroll down (keeps DOM/memory low)

                while (currentScrolls < MAX_SCROLLS) {
                    await page.mouse.wheel(0, 5000); // Scroll down a significant amount
                    await randomDelay(3000, 5000); // Wait for content to load

                    const tempPostCount = await posts.count();
                    if (tempPostCount === previousPostCount) {
                        console.log("    No new posts loaded after scroll, stopping deeper scan.");
                        break;
                    }
                    previousPostCount = tempPostCount;
                    currentScrolls++;
                    console.log(`    Scrolled ${currentScrolls}/${MAX_SCROLLS} times. Now visible: ${previousPostCount} posts.`);
                }
                
                // Now process all visible posts after scrolling
                const finalPostCount = await posts.count();
                console.log(`    Processing up to ${finalPostCount} posts in this group.`);
                for (let i = 0; i < finalPostCount; i++) {
                    const post = posts.nth(i);
                    const postText = (await post.innerText()).trim();

                    // Attempt to extract real Facebook Post ID
                    let postID = await extractFacebookPostIdFromMessage(post);

                    // Fallback to text hash if no real ID is found
                    if (!postID) {
                        const textHash = postText.substring(0, 100).replace(/\s/g, '_');
                        postID = `hash_${textHash}`;
                        console.warn(`    ⚠️ Using text hash for Post ID (could not find real FBID): ${postID}`);
                    }

                    // **Check dedup in replies_log**
                    const { data: alreadyReplied } = await supabase
                        .from('replies_log')
                        .select('*')
                        .eq('post_id', postID)
                        .eq('group_url', group.url)
                        .single();
                    
                    if (alreadyReplied) {
                        console.log("⏭️ Already replied to this post. Skipping.");
                        continue;
                    }

                    // **Keyword quick filter first**
                    const quickDecision = quickKeywordFilter(postText);
                    
                    let isLead = false;
                    if (quickDecision === 'approve') {
                        isLead = true;
                    } else if (quickDecision === 'reject') {
                        isLead = false;
                    } else {
                        // Unsure - use AI
                        isLead = await evaluatePostWithAI(postText);
                    }
                    
                    if (isLead) {
                        console.log(`🎯 MATCH FOUND: ${postID}`);

                        const { data: existing } = await supabase.from('leads').select('*').eq('post_id', postID).single();
                        if (existing) {
                            console.log("⏭️ Lead already in database. Skipping.");
                            continue;
                        }

                        if (DRY_RUN) {
                            console.log(`[DRY RUN] Would queue lead: ${postText.substring(0, 60)}...`);
                            continue;
                        }

                        const { error: insertError } = await supabase.from('leads').insert({
                            post_id: postID,
                            group_url: group.url,
                            post_text: postText,
                            status: 'pending'
                        });

                        if (insertError) {
                            if (insertError.message?.includes('duplicate')) {
                                console.log("⏭️ Lead already exists. Skipping.");
                            } else {
                                console.error("❌ Failed to queue lead:", insertError.message);
                            }
                        } else {
                            console.log("✅ Lead queued for review.");
                        }
                    }
                    
                    await randomDelay(500, 1500);
                }
            }
        }

    } catch (e) {
        console.error("💥 Error:", e);
        if (page) await captureProof(page, 'error');
    } finally {
        await randomDelay(3000, 5000);
        await context.close();
        console.log("🏁 Cycle complete.");
    }
}

// **MAIN LOOP - Run continuously**
let lastCycleTime = 'never';
let cycleCount = 0;
let isRunning = false;

async function main() {
    console.log("🚀 Fiesta Fresh Bot v2.0 Starting...");
    console.log(`Supabase: ${supabaseUrl}`);
    console.log(`Scan Interval: ${SCAN_INTERVAL / 1000}s`);
    {
        const m = process.memoryUsage();
        console.log(`📊 Boot RSS ${(m.rss / 1048576).toFixed(0)}MB | heap ${(m.heapUsed / 1048576).toFixed(0)}MB | heapTotal ${(m.heapTotal / 1048576).toFixed(0)}MB | external ${(m.external / 1048576).toFixed(0)}MB`);
    }

    // Health check server (required for Render to keep the service alive)
    const PORT = parseInt(process.env.PORT || '8080');
    http.createServer(async (req, res) => {
        let cfg: any = null;
        try {
            const r = await supabase.from('config').select('bot_status').single();
            cfg = r.data ?? null;
        } catch { /* health endpoint stays up even if config fails */ }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        const k = process.env.SUPABASE_ANON_KEY || '';
        res.end(JSON.stringify({
            status: 'ok',
            mode: DRY_RUN ? 'dry_run' : 'live',
            cycles: cycleCount,
            lastCycle: lastCycleTime,
            running: isRunning,
            config: cfg ?? null,
            keyFp: k.length ? `${k.slice(0, 8)}...${k.slice(-6)} (len ${k.length})` : '(missing)',
        }));
    }).listen(PORT, () => {
        console.log(`❤️ Health check server listening on port ${PORT}`);
    });

    const cycle = async () => {
        if (isRunning) {
            console.log("⏳ Previous cycle still running, skipping this tick.");
            return;
        }
        isRunning = true;
        try {
            await runBot();
        } catch (err) {
            console.error("Bot cycle failed:", err);
        } finally {
            isRunning = false;
            cycleCount++;
            lastCycleTime = new Date().toISOString();
        }
    };

    // Run immediately, then on interval
    await cycle();
    setInterval(() => {
        console.log("\n⏰ Starting new scan cycle...");
        cycle();
    }, SCAN_INTERVAL);

    // Memory diagnostics (critical: Render OOM-kills at 512Mi)
    setInterval(() => {
        const m = process.memoryUsage();
        console.log(`📊 RSS ${(m.rss / 1048576).toFixed(0)}MB | heap ${(m.heapUsed / 1048576).toFixed(0)}MB | heapTotal ${(m.heapTotal / 1048576).toFixed(0)}MB | external ${(m.external / 1048576).toFixed(0)}MB`);
    }, 15000);
}

main();
