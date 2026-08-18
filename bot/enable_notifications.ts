import { chromium } from 'playwright-extra';
// @ts-ignore
import type { Page, BrowserContext } from 'playwright-core';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

chromium.use(stealthPlugin());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://xmxywlyqdqrfrojwggkt.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhteHl3bHlxZHFyZnJvandnZ2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzMzI4NjUsImV4cCI6MjEwMTkwODg2NX0.p9i_3rge9IuoYz6qgL5J6dZjwptZyKU7S7AP1Bh_EHQ';
const supabase = createClient(supabaseUrl, supabaseKey);

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
            console.error("⚠️ Invalid FB_ACCOUNTS JSON");
        }
    }
    const single: FbAccount[] = [];
    if (process.env.FB_EMAIL && process.env.FB_PASSWORD) {
        single.push({ email: process.env.FB_EMAIL!, password: process.env.FB_PASSWORD! });
    }
    return single;
}

const ACCOUNTS = loadAccounts();

async function setNotificationsForAccount(account: FbAccount, index: number, groups: string[]) {
    console.log(`\n===========================================`);
    console.log(`🚀 Starting Notification Setup for Account ${index + 1}: ${account.email}`);
    console.log(`===========================================\n`);

    const browser = await chromium.launch({ headless: true }); // Run headless on VPS
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    });

    const cookiePath = path.join(__dirname, 'cookies', `${index + 1}.json`);
    if (fs.existsSync(cookiePath)) {
        try {
            const cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf8'));
            await context.addCookies(cookies);
            console.log(`🍪 Loaded cookies for account ${index + 1}`);
        } catch (e: any) {
            console.error(`❌ Failed to load cookies for account ${index + 1}:`, e.message);
            await browser.close();
            return;
        }
    } else {
        console.error(`❌ No cookies found for account ${index + 1}. Please log in via the dashboard first.`);
        await browser.close();
        return;
    }

    const page = await context.newPage();
    
    // Quick test to ensure we are logged in
    await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const isLogin = await page.locator('input[name="email"]').isVisible().catch(() => false);
    if (isLogin) {
        console.error(`❌ Account ${index + 1} is not logged in! Cookies may have expired.`);
        await browser.close();
        return;
    }

    let successCount = 0;
    
    for (const groupUrl of groups) {
        try {
            console.log(`\n➡️ Navigating to ${groupUrl}`);
            await page.goto(groupUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            
            // Allow page to settle
            await page.waitForTimeout(3000);

            // Click the "Joined" or "Following" button
            const joinedButton = page.locator('[aria-label="Joined"], [aria-label="Following"]').first();
            if (await joinedButton.isVisible()) {
                await joinedButton.click();
            } else {
                // Sometimes it's just text
                const joinedText = page.locator('div[role="button"]:has-text("Joined"), div[role="button"]:has-text("Following")').first();
                if (await joinedText.isVisible()) {
                    await joinedText.click();
                } else {
                    console.log(`⚠️ Could not find "Joined" button for ${groupUrl}. Skipping.`);
                    continue;
                }
            }
            
            await page.waitForTimeout(1500);

            // Click "Manage notifications"
            const manageBtn = page.locator('div[role="menuitem"]:has-text("Manage notifications"), span:has-text("Manage notifications")').first();
            if (await manageBtn.isVisible()) {
                await manageBtn.click();
            } else {
                console.log(`⚠️ Could not find "Manage notifications" in dropdown for ${groupUrl}. Skipping.`);
                continue;
            }

            await page.waitForTimeout(2000);

            // Click "All posts"
            const allPostsBtn = page.locator('div[role="radio"]:has-text("All posts"), span:has-text("All posts")').first();
            if (await allPostsBtn.isVisible()) {
                await allPostsBtn.click();
                await page.waitForTimeout(1000);
            } else {
                console.log(`⚠️ Could not find "All posts" radio button for ${groupUrl}. Skipping.`);
                // Click close or cancel if stuck
                const closeBtn = page.locator('[aria-label="Close"], [aria-label="Cancel"]').first();
                if (await closeBtn.isVisible()) await closeBtn.click();
                continue;
            }

            // Click Save
            const saveBtn = page.locator('div[role="button"]:has-text("Save"), [aria-label="Save"]').first();
            if (await saveBtn.isVisible()) {
                await saveBtn.click();
                console.log(`✅ Successfully set notifications to "All Posts" for ${groupUrl}`);
                successCount++;
            } else {
                console.log(`⚠️ Could not find "Save" button for ${groupUrl}.`);
            }
            
            await page.waitForTimeout(2000);
            
        } catch (e: any) {
            console.log(`❌ Error processing ${groupUrl}: ${e.message}`);
        }
    }

    console.log(`\n🎉 Finished Account ${index + 1}! Successfully updated ${successCount} groups.`);
    await browser.close();
}

async function run() {
    console.log("📡 Fetching target groups from Supabase...");
    let groupsToScan: string[] = [];
    try {
        const { data: dbGroups, error: dbErr } = await supabase.from('groups').select('url').eq('is_active', true);
        if (!dbErr && dbGroups && dbGroups.length > 0) {
            groupsToScan = dbGroups.map(g => g.url);
            console.log(`📋 Loaded ${groupsToScan.length} active target groups from Supabase.`);
        }
    } catch (e: any) {
        console.warn("⚠️ Error loading target groups from Supabase:", e.message);
    }

    if (groupsToScan.length === 0) {
        console.log("No groups found. Exiting.");
        process.exit(0);
    }

    if (ACCOUNTS.length === 0) {
        console.error("❌ No accounts configured in FB_ACCOUNTS. Exiting.");
        process.exit(1);
    }

    for (let i = 0; i < ACCOUNTS.length; i++) {
        const acct = ACCOUNTS[i];
        if (!acct) continue;
        await setNotificationsForAccount(acct, i, groupsToScan);
    }
    
    console.log("\n✅✅ All accounts finished setting up notifications!");
    process.exit(0);
}

run();
