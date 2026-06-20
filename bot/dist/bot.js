import { chromium } from 'playwright-extra';
// @ts-ignore
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { pipeline, cos_sim } from '@xenova/transformers';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
chromium.use(stealthPlugin());
/**
 * Human-like typing
 */
async function humanType(page, selector, text) {
    await page.click(selector);
    for (const char of text) {
        await page.type(selector, char, { delay: Math.floor(Math.random() * 100) + 45 });
    }
}
/**
 * Capture and upload screenshot to Supabase Storage
 */
async function captureProof(page, fileName) {
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
    }
    catch (e) {
        console.error("Failed to capture screenshot:", e);
        return null;
    }
}
/**
 * Semantic Search Fallback (Local AI)
 */
let extractor = null;
async function getExtractor() {
    if (!extractor) {
        console.log("📥 Loading local semantic AI model (first time downloads it)...");
        extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    return extractor;
}
async function evaluateWithSemanticSearch(postText) {
    try {
        console.log("🧠 Running local Semantic Search Fallback...");
        const extract = await getExtractor();
        const idealLead = "I am looking to hire a professional residential house cleaner for a deep clean of my home.";
        const postOutput = await extract(postText, { pooling: 'mean', normalize: true });
        const idealOutput = await extract(idealLead, { pooling: 'mean', normalize: true });
        const similarity = cos_sim(Array.from(postOutput.data), Array.from(idealOutput.data));
        console.log(`📊 Semantic Similarity Score: ${(similarity * 100).toFixed(2)}%`);
        return similarity > 0.45;
    }
    catch (e) {
        console.error("❌ Semantic search failed:", e);
        // Absolute last resort: keyword fallback
        return postText.toLowerCase().includes('clean');
    }
}
/**
 * AI Lead Evaluator
 */
async function evaluatePostWithAI(postText) {
    if (!process.env.GEMINI_API_KEY) {
        console.warn("⚠️ No GEMINI_API_KEY found, triggering Semantic Search fallback.");
        return await evaluateWithSemanticSearch(postText);
    }
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const { data: memoryData } = await supabase.from('ai_memory').select('rule_text');
        const rules = memoryData?.map((m) => `- ${m.rule_text}`).join('\n') || 'No specific rules yet.';
        const prompt = `
          You are a lead evaluator for a house cleaning business. 
          Rules based on past feedback:
          ${rules}
          
          Post: "${postText}"
          
          If this is a solid lead for residential house cleaning (not commercial, not cars, not generic chatter), reply with exactly "APPROVE".
          Otherwise reply with "REJECT".
        `;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        const aiText = response.text?.trim() || '';
        return aiText.startsWith('APPROVE');
    }
    catch (e) {
        console.warn("⚠️ Gemini AI Evaluation failed. Triggering Semantic Search fallback. Error:", e);
        return await evaluateWithSemanticSearch(postText);
    }
}
async function runBot() {
    console.log("🤖 Starting Fiesta Fresh Automation Bot...");
    const fbEmail = process.env.FB_EMAIL;
    const fbPassword = process.env.FB_PASSWORD;
    // 1. Check Config
    const { data: config } = await supabase.from('config').select('*').single();
    if (!config || !config.bot_status) {
        console.log("⏸️ Bot is paused. Sleeping...");
        return;
    }
    const proxyServer = process.env.PROXY_SERVER;
    const userDataDir = path.join(__dirname, 'FiestaSession');
    console.log(`🧠 Using Persistent Context: ${userDataDir}`);
    const contextOptions = {
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
    };
    if (proxyServer) {
        console.log(`🌐 Using Proxy: ${proxyServer}`);
        contextOptions.proxy = { server: proxyServer };
    }
    const context = await chromium.launchPersistentContext(userDataDir, contextOptions);
    if (contextOptions.proxy && process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD) {
        await context.setExtraHTTPHeaders({
            'Proxy-Authorization': 'Basic ' + Buffer.from(`${process.env.PROXY_USERNAME}:${process.env.PROXY_PASSWORD}`).toString('base64')
        });
    }
    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    try {
        console.log("➡️ Navigated to Facebook. Checking state...");
        await page.goto('https://www.facebook.com');
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
        console.log("👤 Identity verified. Starting execution phase...");
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
                console.log(`\n🚀 Executing approved lead on group: ${lead.group_url}`);
                await page.goto(lead.group_url, { waitUntil: 'networkidle' });
                await page.waitForTimeout(3000);
                // We scroll down searching for the post matching the text
                for (let scroll = 0; scroll < 5; scroll++) {
                    await page.mouse.wheel(0, 1000);
                    await page.waitForTimeout(2000);
                    const posts = page.locator('[role="article"]');
                    const count = await posts.count();
                    let found = false;
                    for (let i = 0; i < count; i++) {
                        const postText = (await posts.nth(i).innerText()).trim();
                        if (postText.includes(lead.post_text.substring(0, 50))) {
                            console.log("🎯 Found approved post on page! Commenting...");
                            const commentBox = posts.nth(i).locator('[aria-label="Write a comment"], [role="textbox"]').first();
                            if (await commentBox.isVisible()) {
                                await commentBox.click();
                                await page.waitForTimeout(1000);
                                await humanType(page, '[role="textbox"]:focus', templateText);
                                await page.keyboard.press('Enter');
                                await page.waitForTimeout(2000);
                                await supabase.from('leads').update({ status: 'posted' }).eq('id', lead.id);
                                console.log("✅ Successfully posted and marked as posted.");
                                found = true;
                                break;
                            }
                        }
                    }
                    if (found)
                        break;
                }
            }
        }
        console.log("👤 Starting group patrol (Scraping)...");
        const { data: groups } = await supabase.from('groups').select('*').eq('is_active', true);
        if (groups) {
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
                    const textHash = postText.substring(0, 100).replace(/\s/g, '_');
                    const postID = `hash_${textHash}`;
                    // --- NEW: 100% AI FILTER ---
                    const isLead = await evaluatePostWithAI(postText);
                    if (isLead) {
                        console.log(`🎯 AI MATCH FOUND for post ID: ${postID}`);
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
                        console.log("✍️ Preparing to queue lead...");
                        const { error: insertError } = await supabase.from('leads').insert({
                            post_id: postID,
                            group_url: group.url,
                            post_text: postText,
                            status: 'pending' // Send to human for review via Swipe UI
                        });
                        if (insertError) {
                            if (insertError.message?.includes('duplicate')) {
                                console.log("⏭️ Lead already exists in Supabase. Skipping.");
                            }
                            else {
                                console.error("❌ Failed to queue lead:", insertError.message);
                            }
                        }
                        else {
                            console.log("✅ Lead queued for review in Swipe UI.");
                            localRepliedIds.add(postID); // Block in local memory
                        }
                    }
                }
            }
        }
    }
    catch (e) {
        console.error("💥 Failure:", e);
        if (page)
            await captureProof(page, 'error');
    }
    finally {
        if (page)
            await page.waitForTimeout(5000);
        await context.close();
        console.log("🏁 Cycle complete.");
    }
}
runBot();
//# sourceMappingURL=bot.js.map