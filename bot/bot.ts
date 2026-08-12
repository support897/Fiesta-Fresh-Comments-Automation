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
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import nodemailer from 'nodemailer';

async function sendAlertEmail(subject: string, text: string) {
    const user = process.env.ALERT_EMAIL;
    const pass = process.env.ALERT_EMAIL_PASSWORD;
    if (!user || !pass) return;
    
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user, pass }
        });
        await transporter.sendMail({ from: user, to: user, subject, text });
        console.log(`📧 Alert email sent: ${subject}`);
    } catch (e: any) {
        console.error("⚠️ Failed to send alert email:", e.message);
    }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables with fallback paths
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://xmxywlyqdqrfrojwggkt.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhteHl3bHlxZHFyZnJvandnZ2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzMzI4NjUsImV4cCI6MjEwMTkwODg2NX0.p9i_3rge9IuoYz6qgL5J6dZjwptZyKU7S7AP1Bh_EHQ';
const supabase = createClient(supabaseUrl, supabaseKey);

const DRY_RUN = process.env.DRY_RUN === 'true';
// 1800s = 30 minutes between each full 85-group patrol cycle (runs 24/7)
const SCAN_INTERVAL = parseInt(process.env.SCAN_INTERVAL_SECONDS || '1800') * 1000;

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
let sessionAlertSent = false;

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
    'office clean', 'office cleaning', 'commercial clean', 'commercial cleaning',
    'price', 'cost', 'how much', 'quote', 'rate', 'recommend', 'recommendation'
];

const REJECT_KEYWORDS = [
    'car wash', 'car clean', 'vehicle', 'mobile detailing',
    'warehouse', 'factory',
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
    
    // We intentionally removed the quick approve filter.
    // ALL non-rejected posts MUST be evaluated by the AI for true 100% accuracy.
    
    console.log("🤔 Unsure - sending to AI evaluation");
    return 'unsure';
}

/**
 * Detect Facebook's "Continue as <name> / Use another profile" session
 * checkpoint — shown when FB invalidates a session. The home page stays on
 * facebook.com with no login form, so the old URL/login-form check missed it.
 */
async function isSessionCheckpoint(page: any): Promise<boolean> {
    const bodyText = await page.locator('body').innerText().catch(() => '');
    return bodyText.includes('Use another profile') && bodyText.includes('Continue');
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
        
        const idealLead = "I am looking to hire a professional cleaner or asking for cleaner recommendations for house, home, bond, end of lease, commercial, office, or carpet cleaning.";
        
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
 * Lead Evaluator (Gemini API with fallback to Groq, then local semantic search)
 */
async function evaluatePostWithAI(postText: string): Promise<boolean> {
    const prompt = `You are an expert AI lead classifier for a professional cleaning company offering ALL types of cleaning services (house/residential, bond/end of lease/vacate, commercial/office, carpet/steam/upholstery, deep clean, Airbnb turnover, window & tile cleaning).
Your goal is to determine with 100% accuracy if a Facebook post or comment is from someone looking for a cleaner, asking for cleaner recommendations, or inquiring about cleaning services.

SUPPORTED CLEANING CATEGORIES (Return TRUE for any of these):
- House / Home / Residential / Domestic / Apartment / Unit / Townhouse Cleaning
- Bond Clean / End of Lease / Vacate Clean / Move-out / Move-in Cleaning
- Commercial Clean / Office Clean / Shop / Business Premises / Studio Cleaning
- Carpet Cleaning / Carpet Steam Clean / Rug Clean / Couch & Upholstery Cleaning
- Deep Clean / Spring Clean / Regular Clean / One-off Clean / Airbnb Turnover
- Window Clean / Tile & Grout Clean / Oven Clean

ACCEPTED PHRASING & INTENT VARIATIONS (Return TRUE for any of these):
1. RECOMMENDATIONS & SUGGESTIONS: "Can anyone recommend...", "Looking for recommendations for...", "Who do you guys use for...", "Best cleaner on Gold Coast?", "Tag your favorite cleaner", "Suggestions for a good carpet cleaner?"
2. DIRECT HIRE & SEARCH: "Looking for a cleaner", "Need a bond clean", "Searching for someone to clean my office", "Urgent cleaner needed", "Want to hire a cleaner"
3. QUOTE & PRICE INQUIRIES: "How much for a 3 bed bond clean?", "Rates for weekly house cleaning?", "Quote for carpet steam cleaning"
4. AVAILABILITY QUERIES: "Any cleaners free this Friday?", "Who is available for a deep clean next week?"

DISQUALIFY CRITERIA (Return FALSE only for these):
1. SERVICE SELLERS / ADVERTISERS: Person offering, advertising, or selling cleaning services ("I am a cleaner available...", "Offering cleaning services...", "DM me for bookings", "We are a local cleaning business").
2. NON-CLEANING TRADES: Requests for car wash/detailing, pool maintenance, gardening/lawn mowing, plumbing, electrical, handyman, painter, moving/removalist.
3. DIY / PRODUCT QUESTIONS: Asking how to clean something themselves or asking for product recommendations ("What product removes mold?", "How do I get stain out of couch myself?").

EXAMPLES (Few-Shot):
Post: "Can anyone recommend a reliable house cleaner near Robina?"
Output: {"is_lead": true, "reason": "Asking for house cleaner recommendations."}

Post: "I need a bond clean + carpet steam clean done this Thursday in Southport."
Output: {"is_lead": true, "reason": "Direct request for bond + carpet cleaning."}

Post: "Looking for recommendations for a reliable commercial cleaner for our office in Southport."
Output: {"is_lead": true, "reason": "Asking for commercial/office cleaner recommendations."}

Post: "Who does good carpet and couch steam cleaning on the Gold Coast?"
Output: {"is_lead": true, "reason": "Asking for carpet/upholstery cleaning recommendations."}

Post: "I am an experienced domestic cleaner with openings available this week!"
Output: {"is_lead": false, "reason": "User is offering cleaning services, not looking to hire."}

Post: "Can anyone recommend a good car detailer?"
Output: {"is_lead": false, "reason": "Looking for car detailing trade, not house/office/carpet cleaning."}

Post text to evaluate:
"""
${postText}
"""

You must respond in valid JSON format only:
{"is_lead": true, "reason": "brief explanation"}`;

    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && geminiKey.trim().length > 0 && geminiKey !== "your_gemini_api_key_here") {
        try {
            console.log("🧠 Evaluating post with Gemini 1.5 Flash...");
            const genAI = new GoogleGenerativeAI(geminiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            
            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                console.log(`🤖 Gemini Output: ${parsed.is_lead ? '✅ LEAD' : '❌ NOT LEAD'} (${parsed.reason})`);
                return parsed.is_lead === true;
            }
        } catch (e: any) {
            console.error("⚠️ Gemini API evaluation failed. Cascading to Groq...", e.message);
        }
    } else {
        console.log("⚠️ GEMINI_API_KEY not found or invalid. Cascading to Groq...");
    }
    
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey && groqKey.trim().length > 0 && groqKey !== "your_groq_api_key_here") {
        try {
            console.log("🧠 Evaluating post with Groq (LLaMA 3)...");
            const groq = new Groq({ apiKey: groqKey });
            
            const chatCompletion = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: 'llama3-8b-8192',
                response_format: { type: 'json_object' }
            });
            
            const responseText = chatCompletion.choices[0]?.message?.content || "";
            const parsed = JSON.parse(responseText);
            console.log(`🤖 Groq Output: ${parsed.is_lead ? '✅ LEAD' : '❌ NOT LEAD'} (${parsed.reason})`);
            return parsed.is_lead === true;
        } catch (e: any) {
            console.error("⚠️ Groq API evaluation failed. Cascading to local semantic search...", e.message);
        }
    } else {
        console.log("⚠️ GROQ_API_KEY not found or invalid. Cascading to local semantic search...");
    }
    
    await sendAlertEmail(
        "Fiesta Fresh AI Degradation",
        "Both Gemini and Groq API layers failed or are unconfigured. The bot has fallen back to the less accurate local semantic search."
    );

    return await evaluateWithSemanticSearch(postText);
}

async function postWebsiteUrlBoosterReply(groupUrl: string, postId: string) {
    console.log("🌐 Triggering Account 3 Website URL Booster comment (100% Coverage)...");
    try {
        const { data: session } = await supabase
            .from('sessions')
            .select('cookies')
            .eq('user_email', 'account3')
            .maybeSingle();

        let cookies = session?.cookies;
        if (!cookies) {
            // Check fallback email
            const { data: sessionFallback } = await supabase
                .from('sessions')
                .select('cookies')
                .eq('user_email', 'account3_booster@fiestafresh.com')
                .maybeSingle();
            cookies = sessionFallback?.cookies;
        }

        if (!cookies) {
            const fs = await import('fs');
            const localFile = path.join(__dirname, 'account3_cookies.json');
            if (fs.existsSync(localFile)) {
                cookies = JSON.parse(fs.readFileSync(localFile, 'utf-8'));
            }
        }

        if (!cookies) {
            console.warn("⚠️ Account 3 booster cookies not found. Please prime Account 3.");
            return;
        }

        const boosterBrowser = await chromium.launch({
            headless: true,
            args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
        });
        const boosterContext = await boosterBrowser.newContext({
            viewport: { width: 1280, height: 900 },
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        });

        // Normalize sameSite values for Account 3
        const sameSiteMap: Record<string, 'None' | 'Lax' | 'Strict'> = {
            'no_restriction': 'None',
            'none': 'None',
            'lax': 'Lax',
            'strict': 'Strict',
            'unspecified': 'Lax',
        };
        const normalisedCookies = (cookies as any[]).map((c: any) => {
            const ss = sameSiteMap[(c.sameSite || '').toLowerCase()] ?? 'None';
            return { ...c, sameSite: ss };
        });
        await boosterContext.addCookies(normalisedCookies);

        const boosterPage = await boosterContext.newPage();
        await boosterPage.goto(groupUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await randomDelay(3000, 5000);

        const boosterCommentText = "https://www.fiestafreshcleaning.com/";

        const commentBox = boosterPage.locator('[aria-label="Write a comment"], [role="textbox"]').first();
        if (await commentBox.isVisible({ timeout: 4000 })) {
            await commentBox.click();
            await randomDelay(800, 1500);
            await humanType(boosterPage, '[role="textbox"]:focus', boosterCommentText);
            await randomDelay(500, 1000);
            await boosterPage.keyboard.press('Enter');
            await randomDelay(2000, 3000);
            console.log(`✅ Account 3 Website URL booster comment posted on post ${postId}!`);

            await supabase.from('replies_log').insert({
                post_id: postId,
                group_url: groupUrl,
                comment_id: `booster_${Date.now()}`,
                replied_at: new Date()
            });
        }
        await boosterContext.close();
        await boosterBrowser.close();
    } catch (e: any) {
        console.error("⚠️ Failed Account 3 booster comment:", e.message);
    }
}

async function runBot(account: FbAccount): Promise<boolean> {
    console.log("🤖 Starting Fiesta Fresh Automation Bot...");
    console.log(`Mode: ${DRY_RUN ? '🧪 DRY RUN (no actual posts)' : '🔴 LIVE MODE'}`);
    console.log(`Scan Interval: ${SCAN_INTERVAL / 1000}s`);
    
    const fbEmail = account.email;
    const fbPassword = account.password;
    console.log(`👤 Account: ${fbEmail}`);

    // 1. Check Config
    let botActive = true;
    try {
        const { data: config } = await supabase.from('config').select('bot_status').maybeSingle();
        if (config && config.bot_status === false) {
            botActive = false;
        }
    } catch (e: any) {
        console.log(`⚠️ Config check fallback to active: ${e.message}`);
    }

    if (!botActive) {
        console.log("⏸️ Bot is paused in Supabase config. Waiting...");
        return true;
    }

    const proxyServer = process.env.PROXY_SERVER;
    const userDataDir = path.join(__dirname, 'FiestaSession');
    console.log(`🧠 Using Persistent Context: ${userDataDir}`);

    // Headed (full Chrome, needs a display/Xvfb) is far harder for Facebook to
    // fingerprint than Playwright's headless shell — sessions were being killed
    // after ~1hr of headless group scanning. Set HEADLESS=false on servers that
    // run Xvfb (e.g. the VPS) to use headed mode.
    const headless = process.env.HEADLESS !== 'false';
    const contextOptions: any = {
        headless,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-dev-shm-usage',
            '--autoplay-policy=user-gesture-required',
            '--js-flags=--max-old-space-size=256'
        ],
        viewport: { width: 1280, height: 800 },
        locale: 'en-AU',
        timezoneId: 'Australia/Brisbane',
    };
    if (headless) {
        // Headless-shell (Render): strip GPU/images to survive 512Mi.
        contextOptions.args.push('--disable-gpu', '--blink-settings=imagesEnabled=false');
    }
    // Headed mode: no UA override, no image suppression — a normal Linux Chrome
    // (matching its real platform) is far less suspicious than a Mac UA on Linux.

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

    // Block heavy downloads — we only scrape text. Cuts memory massively, which is
    // critical on Render's 512Mi instance (was OOM-killing us). In headed mode we
    // only block media/video so the browser looks like a normal one loading images.
    await context.route('**/*', (route: any) => {
        const type = route.request().resourceType();
        if (type === 'media' || (headless && (type === 'image' || type === 'font'))) {
            return route.abort();
        }
        return route.continue();
    });

    const page: any = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

    // Restore saved session from Supabase (bypasses login/captcha if cookies are valid)
    let restoredSession = false;
    const { data: savedSession } = await supabase.from('sessions').select('cookies').eq('user_email', fbEmail).order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (savedSession?.cookies && Array.isArray(savedSession.cookies)) {

        // --- Early checkpoint detection ---
        // If saved cookies contain 'checkpoint' but are missing 'c_user' and 'xs',
        // this account is Facebook-locked. Skip it immediately so account rotation
        // can try the next healthy account without wasting a full browser launch.
        const cookieNames = savedSession.cookies.map((c: any) => c.name);
        const hasCheckpoint = cookieNames.includes('checkpoint');
        const hasAuthTokens = cookieNames.includes('c_user') && cookieNames.includes('xs');
        if (hasCheckpoint && !hasAuthTokens) {
            console.warn(`⚠️ ${fbEmail} has a Facebook CHECKPOINT cookie and is missing c_user/xs — account is locked. Skipping this account, rotating to next.`);
            await context.close();
            return false;
        }

        try {
            // Normalise sameSite values: Chrome exports "no_restriction"/"lax"/"strict"/"unspecified"
            // but Playwright requires exactly "None"|"Lax"|"Strict".
            const sameSiteMap: Record<string, 'None' | 'Lax' | 'Strict'> = {
                'no_restriction': 'None',
                'none': 'None',
                'lax': 'Lax',
                'strict': 'Strict',
                'unspecified': 'Lax',
            };
            const normalisedCookies = savedSession.cookies.map((c: any) => {
                const ss = sameSiteMap[(c.sameSite || '').toLowerCase()] ?? 'None';
                return { ...c, sameSite: ss };
            });
            await context.addCookies(normalisedCookies);
            restoredSession = true;
            console.log(`💾 Restored session for ${fbEmail} from Supabase (${normalisedCookies.length} cookies).`);
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
            await page.keyboard.press('Enter');
            await randomDelay(1000, 2000);
            await page.click('button[name="login"], [aria-label="Log in"], [aria-label="Log In"], input[type="submit"]').catch(() => null);
            
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
        // no checkpoint interstitial AND not on a login/captcha URL.
        const currentUrl = page.url();
        const loginFormVisible = await loginMarkers.first().isVisible().catch(() => false);
        const checkpointVisible = await isSessionCheckpoint(page);
        const isLogged = !loginFormVisible
            && !checkpointVisible
            && !currentUrl.includes('login.php')
            && !currentUrl.includes('two_step_verification')
            && !currentUrl.includes('recaptcha');
        if (!restoredSession && isLogged) {
            console.warn(`⚠️ No saved session for ${fbEmail} but logged in — using stale profile cookies from a previous account. Run \`npx tsx prime-session.ts\` to prime this account's session before going live.`);
        }
        if (!isLogged) {
            const hasCaptcha = currentUrl.includes('two_step_verification') || page.frames().some((f: any) => f.url().includes('recaptcha'));
            let proofUrl: string | null = null;
            let failureReason = 'Login verification failed / Cookies expired';

            if (hasCaptcha) {
                console.error("🚫 Facebook risk challenge detected (reCAPTCHA). A human must prime the session once: run `npx tsx prime-session.ts`, solve the captcha in the visible Chrome window, then cookies are saved for the bot to reuse.");
                proofUrl = await captureProof(page, 'recaptcha_challenge');
                failureReason = 'Facebook reCAPTCHA / Security Challenge detected';
            } else if (checkpointVisible) {
                console.error("🚨 Session invalidated by Facebook (\"Continue as\" checkpoint). A human must re-prime the session: run `npx tsx prime-session.ts` and confirm the account in the visible Chrome window.");
                proofUrl = await captureProof(page, 'session_checkpoint');
                failureReason = 'Facebook Session Checkpoint ("Continue as..." prompt)';
            } else {
                console.error("❌ Login verification failed.");
                proofUrl = await captureProof(page, 'login_failed');
            }

            // Send JUST ONE email alert per failure incident until session is restored
            if (!sessionAlertSent) {
                sessionAlertSent = true;
                await sendAlertEmail(
                    `🚨 Fiesta Fresh Bot Alert: Facebook Session Disconnected (${fbEmail})`,
                    `The Facebook bot could not connect using saved cookies for account: ${fbEmail}\n\n` +
                    `Reason: ${failureReason}\n` +
                    `${proofUrl ? `Proof Screenshot: ${proofUrl}\n` : ''}\n` +
                    `Action Required: Run \`npx tsx prime-session.ts\` or \`npx tsx refresh-session.ts\` to log in and refresh session cookies.\n\n` +
                    `(Note: This is a single email alert. You will not receive repeated spam emails until the session is restored.)`
                );
            }

            await context.close();
            return false;
        }

        if (sessionAlertSent) {
            console.log("✅ Facebook session restored! Resetting email alert throttle.");
            sessionAlertSent = false;
        }

        console.log("👤 Login verified. Starting execution...");
        
        // PHASE 1: Execute leads (auto-approved by Gemini/Groq, zero human input needed)
        const { data: approvedLeads } = await supabase.from('leads').select('*').in('status', ['approved', 'pending']);
        const FIXED_REPLY_TEMPLATE = `Hi! 💙 We would absolutely love to help you out!

We are Fiesta Fresh Cleaning, a local Gold Coast team that genuinely cares about every single home and space we walk into. Fully insured, police-checked and proudly serving the Gold Coast community 🏡✨

And here is what makes us a little different from everyone else… we offer a 200% Happiness Guarantee on every single clean we do. That means if anything is not perfect we come back and fix it for FREE. No questions asked. We are the only cleaning company on the Gold Coast offering this and we stand behind it completely. 🙌

We are not a big franchise. We are your neighbours. A real local team that shows up, works hard and truly cares about leaving your space better than we found it. Every single time. 💙

You can check out everything we offer, read our reviews and even book in 60 seconds right here 👉 fiestafreshcleaning.com/book

We will also send you a DM just in case you have any questions. Make sure to check your message requests! We cannot wait to help you out. 🎉`;

        if (approvedLeads && approvedLeads.length > 0) {
            console.log(`✅ Found ${approvedLeads.length} approved leads to execute.`);
            for (const lead of approvedLeads) {
                try {
                    console.log(`\n🚀 Executing approved lead: ${lead.post_id}`);
                    
                    // Always use exact fixed reply template - zero variations
                    const templateText = FIXED_REPLY_TEMPLATE;
                    
                    if (!lead.group_url || !lead.group_url.startsWith('http') || lead.group_url.includes('test')) {
                        console.warn(`⚠️ Skipping invalid/test lead URL: ${lead.group_url}`);
                        continue;
                    }
                    
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
                        const posts = page.locator('[data-ad-preview="message"], [role="article"]');
                        let count = await posts.count();
                        if (count === 0) {
                            // Fallback selector for posts container
                            count = await page.locator('div[role="feed"] > div').count();
                        }
                        let found = false;

                        for (let i = 0; i < count; i++) {
                            const postText = (await posts.nth(i).innerText()).trim();
                            const norm = (s: string) => (s || '').toLowerCase().replace(/[\r\n\t]+/g, ' ').replace(/[^\w\s]/g, '').trim();
                            const targetSnippet = norm(lead.post_text).slice(0, 35);
                            
                            if (targetSnippet.length > 5 && norm(postText).includes(targetSnippet)) {
                                console.log(`🎯 Found approved post! ("${targetSnippet}") Commenting...`);
                                await closeOverlays(page);
                                
                                let commentBox = posts.nth(i).locator('[aria-label="Write a comment"], [role="textbox"]').first();
                                if (!(await commentBox.isVisible())) {
                                    const commentBtn = posts.nth(i).locator('[aria-label="Leave a comment"], [aria-label="Comment"]').first();
                                    if (await commentBtn.isVisible()) {
                                        await commentBtn.click();
                                        await randomDelay(800, 1500);
                                        commentBox = page.locator('[role="textbox"]:focus, [aria-label="Write a comment"]').first();
                                    }
                                }
                                
                                if (await commentBox.isVisible()) {
                                    await randomDelay(1000, 2000);
                                    await commentBox.click();
                                    await randomDelay(800, 1500);
                                    await humanType(page, '[role="textbox"]:focus', templateText);
                                    await randomDelay(500, 1000);
                                    await page.keyboard.press('Enter');
                                    await randomDelay(2000, 3000);
                                    
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
                } catch (leadErr: any) {
                    console.warn(`⚠️ Skipping lead ${lead.post_id} due to navigation/execution error: ${leadErr.message?.slice(0, 100)}`);
                    continue;
                }
            }
        }

        // PHASE 2: Scrape groups for new posts
        console.log("🔍 Starting group patrol...");

        let groupsToScan: { url: string }[] = [];
        try {
            const fs = await import('fs');
            const candidatePaths = [
                path.join(process.cwd(), 'target_groups.json'),
                path.join(process.cwd(), 'bot', 'target_groups.json'),
                path.join(__dirname, 'target_groups.json'),
                path.join(__dirname, '..', 'target_groups.json')
            ];
            const targetFile = candidatePaths.find(p => fs.existsSync(p));
            if (targetFile) {
                const rawUrls: string[] = JSON.parse(fs.readFileSync(targetFile, 'utf-8'));
                groupsToScan = rawUrls.map(url => ({ url }));
                console.log(`📋 Loaded ${groupsToScan.length} target groups from ${targetFile}`);
            } else {
                console.warn("⚠️ target_groups.json not found in candidate paths:", candidatePaths);
            }
        } catch (e: any) {
            console.warn("⚠️ Error loading target_groups.json:", e.message);
        }

        if (groupsToScan.length === 0) {
            const { data: groups } = await supabase.from('groups').select('*').eq('is_active', true);
            if (groups) groupsToScan = groups;
        }

        let consecutiveLoginRedirects = 0;
        if (groupsToScan.length > 0) {
            for (const group of groupsToScan) {
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

                // Detect session loss vs inaccessible group
                if (page.url().includes('/login/')) {
                    consecutiveLoginRedirects++;
                    console.warn(`⚠️ Group ${group.url} redirected to login page (count: ${consecutiveLoginRedirects}). Skipping...`);
                    if (consecutiveLoginRedirects >= 6) {
                        console.error("🚨 6 consecutive groups redirected to /login/. Session lost. Aborting patrol.");
                        const proofUrl = await captureProof(page, 'session_lost_login');

                        if (!sessionAlertSent) {
                            sessionAlertSent = true;
                            await sendAlertEmail(
                                `🚨 Fiesta Fresh Bot Alert: Facebook Session Disconnected (${fbEmail})`,
                                `Facebook session for ${fbEmail} expired during group patrol (3 consecutive redirects to /login/).\n\n` +
                                `${proofUrl ? `Proof Screenshot: ${proofUrl}\n` : ''}\n` +
                                `Action Required: Run \`npx tsx prime-session.ts\` or \`npx tsx refresh-session.ts\` to log in and refresh session cookies.\n\n` +
                                `(Note: This is a single email alert.)`
                            );
                        }
                        return false;
                    }
                    continue;
                }
                
                // Reset counter on successful group load
                consecutiveLoginRedirects = 0;

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
                const MAX_SCROLLS = 10; // Scroll deep enough to capture all posts within last 2 days (48h)

                while (currentScrolls < MAX_SCROLLS) {
                    await page.mouse.wheel(0, 5000); // Scroll down to load historical posts
                    await randomDelay(2500, 4500); // Wait for post items to render

                    const tempPostCount = await posts.count();
                    if (tempPostCount === previousPostCount) {
                        console.log("    No new posts loaded after scroll, stopping deeper scan.");
                        break;
                    }
                    previousPostCount = tempPostCount;
                    currentScrolls++;
                    console.log(`    Scrolled ${currentScrolls}/${MAX_SCROLLS} times. Now visible: ${previousPostCount} posts.`);
                }
                
                // Process all posts visible within the last 2 days (48 hours)
                const finalPostCount = await posts.count();
                console.log(`    Processing up to ${finalPostCount} posts within last 2 days in this group.`);
                for (let i = 0; i < finalPostCount; i++) {
                    const post = posts.nth(i);
                    let postText: string;
                    try {
                        postText = (await post.innerText({ timeout: 10000 })).trim();
                    } catch (e) {
                        console.warn(`    ⚠️ Could not read post text (${e instanceof Error ? e.message.split('\n')[0] : e}) - skipping.`);
                        continue;
                    }

                    // 48-hour age filter: accept posts from TODAY, YESTERDAY, 1h–23h, 1d, 2d.
                    // Reject posts timestamped 3d, 4d, … or 1w+ (older than 48 hours).
                    const lowerText = postText.toLowerCase();
                    const isTooOld = (
                        /\b[3-9]d\b/.test(lowerText) ||       // 3d–9d
                        /\b[1-9]\d+d\b/.test(lowerText) ||    // 10d+
                        /\b\d+\s*w\b/.test(lowerText) ||      // 1w, 2w…
                        /\b\d+\s*mo\b/.test(lowerText) ||     // 1mo+
                        /\b\d+\s*y\b/.test(lowerText)         // 1y+
                    );
                    if (isTooOld) {
                        console.log(`    ⏩ Skipping post older than 2 days (48h).`);
                        continue;
                    }
                    // Explicitly allow: 'just now', 'now', Xm, Xh, 1d, 2d, 'yesterday', 'today'
                    // (No action needed — these pass through the filter above naturally)

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

                        // Always use exact fixed reply template - zero variations
                        const templateText = FIXED_REPLY_TEMPLATE;

                        if (DRY_RUN) {
                            console.log(`[DRY RUN] Would comment on lead (${postID}): ${postText.substring(0, 60)}...`);
                            console.log(`[DRY RUN] Comment: ${templateText.substring(0, 80)}...`);
                            await supabase.from('leads').insert({
                                post_id: postID,
                                group_url: group.url,
                                post_text: postText,
                                status: 'posted'
                            });
                            await supabase.from('replies_log').insert({
                                post_id: postID,
                                group_url: group.url,
                                comment_id: `dryrun_${Date.now()}`,
                                replied_at: new Date()
                            });
                            continue;
                        }

                        console.log("⚡ Auto-accepted lead! Attempting immediate comment...");
                        await closeOverlays(page);
                        let commented = false;

                        try {
                            const commentBox = post.locator('[aria-label="Write a comment"], [role="textbox"]').first();
                            if (await commentBox.isVisible({ timeout: 3000 })) {
                                await randomDelay(800, 1500);
                                await commentBox.click();
                                await randomDelay(800, 1500);
                                await humanType(page, '[role="textbox"]:focus', templateText);
                                await randomDelay(500, 1000);
                                await page.keyboard.press('Enter');
                                await randomDelay(2000, 3000);
                                commented = true;
                                console.log(`✅ Direct comment posted on post ${postID}!`);
                            } else {
                                const commentBtn = post.locator('[aria-label="Leave a comment"], [aria-label="Comment"]').first();
                                if (await commentBtn.isVisible({ timeout: 2000 })) {
                                    await commentBtn.click();
                                    await randomDelay(1000, 2000);
                                    const activeBox = page.locator('[role="textbox"]:focus, [aria-label="Write a comment"]').first();
                                    if (await activeBox.isVisible({ timeout: 2000 })) {
                                        await activeBox.click();
                                        await randomDelay(500, 1000);
                                        await humanType(page, '[role="textbox"]:focus', templateText);
                                        await randomDelay(500, 1000);
                                        await page.keyboard.press('Enter');
                                        await randomDelay(2000, 3000);
                                        commented = true;
                                        console.log(`✅ Direct comment posted on post ${postID}!`);
                                    }
                                }
                            }
                        } catch (commentErr: any) {
                            console.error(`⚠️ Could not post comment directly: ${commentErr.message?.slice(0, 80)}`);
                        }

                        // Write to replies_log to ensure no duplicate comments
                        await supabase.from('replies_log').insert({
                            post_id: postID,
                            group_url: group.url,
                            comment_id: `comment_${Date.now()}`,
                            replied_at: new Date()
                        });

                        const { error: insertError } = await supabase.from('leads').insert({
                            post_id: postID,
                            group_url: group.url,
                            post_text: postText,
                            status: commented ? 'posted' : 'approved'
                        });

                        if (insertError) {
                            if (insertError.message?.includes('duplicate')) {
                                console.log("⏭️ Lead already logged.");
                            } else {
                                console.error("❌ Failed to log lead:", insertError.message);
                            }
                        } else {
                            console.log(`✅ Lead logged as ${commented ? 'posted' : 'approved'}.`);
                        }
                        if (commented) {
                            console.log("⏳ Pausing 5s before Account 3 Website URL Booster comment...");
                            await randomDelay(4000, 6000);
                            await postWebsiteUrlBoosterReply(group.url, postID);
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
    return true;
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
    }).on('error', (err: any) => {
        console.log(`⚠️ Health check server note (${err.message}) - continuing main bot process...`);
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
            if (ACCOUNTS.length === 0) {
                console.error("❌ No Facebook accounts configured.");
                return;
            }
            // Try accounts in sequence until one succeeds to log in
            let success = false;
            for (let i = 0; i < ACCOUNTS.length; i++) {
                const account = nextAccount();
                if (!account) continue;
                console.log(`👤 Testing rotation account: ${account.email}`);
                success = await runBot(account);
                if (success) {
                    break;
                } else {
                    console.log(`⚠️ Account ${account.email} failed to login. Rotating to next configured account immediately...`);
                    await randomDelay(3000, 5000);
                }
            }
            if (!success) {
                console.error("❌ All configured Facebook accounts failed to authenticate in this cycle.");
            }
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
