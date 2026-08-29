import { chromium } from 'playwright-extra';
import { TOTP, Secret } from 'otpauth';
// @ts-ignore
import type { Page, Locator } from 'playwright-core';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
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

import * as fs from 'fs';
let lastDailyReportDate = '';
let reportFilePath = '';

async function sendDailyReportEmail() {
    const user = process.env.ALERT_EMAIL;
    const pass = process.env.ALERT_EMAIL_PASSWORD;
    if (!user || !pass) {
        console.warn("\u26a0\ufe0f ALERT_EMAIL / ALERT_EMAIL_PASSWORD not set — skipping daily report.");
        return;
    }

    try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: replies } = await supabase
            .from('replies_log')
            .select('*')
            .gte('replied_at', twentyFourHoursAgo)
            .order('replied_at', { ascending: false });

        // Exclude legacy dryrun_ rows so the report counts only real comments.
        const realList = realReplies(replies);
        const totalReplies = realList.length;
        const groupCount = new Set(realList.map((r: any) => r.group_url)).size;

        // Real account health, rather than the old hardcoded "3 / 3".
        let liveAccounts = 0;
        try {
            const { data: sess } = await supabase.from('sessions').select('user_email, cookies');
            for (const acct of ACCOUNTS) {
                const row = (sess || []).find((x: any) => x.user_email === acct.email);
                const jar = Array.isArray(row?.cookies) ? row.cookies : [];
                if (jar.some((c: any) => c?.name === 'c_user' && c?.value)) liveAccounts++;
            }
        } catch { liveAccounts = 0; }

        const tableRows = realList.map((r: any) => {
            const timeStr = new Date(r.replied_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
            // Only the booster tags itself in comment_id. For everything else we
            // genuinely do not know which account posted, so say so rather than
            // inventing a name by alternating rows (the old behaviour).
            const accountBadge = r.comment_id?.startsWith('booster_')
                ? '<span style="background:#e0f2fe;color:#0369a1;padding:4px 8px;border-radius:12px;font-size:12px;font-weight:600;">Account 3 (Booster)</span>'
                : `<span style="background:#f1f5f9;color:#475569;padding:4px 8px;border-radius:12px;font-size:12px;font-weight:600;">${r.user_profile_id || 'Patrol account'}</span>`;

            // Prefer the captured comment permalink (stored in comment_id) so the
            // "View Post" button lands on the actual comment, not just the group.
            const rawProof = String(r.comment_id || '').replace(/^booster_/, '');
            const postUrl = rawProof.startsWith('http') ? rawProof : buildPostUrl(r.group_url, r.post_id);
            const groupName = r.group_url.replace('https://www.facebook.com/groups/', '').replace(/\/$/, '');

            return `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 14px; font-size: 13px; color: #475569; font-weight: 500;">${timeStr}</td>
                <td style="padding: 14px;">${accountBadge}</td>
                <td style="padding: 14px; font-size: 13px; color: #0284c7; font-weight: 600; max-width: 240px; word-break: break-all;">
                    <a href="${postUrl}" target="_blank" style="color: #0284c7; text-decoration: none;">${groupName}</a>
                </td>
                <td style="padding: 14px; text-align: right;">
                    <a href="${postUrl}" target="_blank" style="background: #0284c7; color: #ffffff; text-decoration: none; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; display: inline-block;">View Post ↗</a>
                </td>
            </tr>`;
        }).join('');

        const emptyMessage = `
        <tr>
            <td colspan="4" style="padding: 30px; text-align: center; color: #94a3b8; font-size: 14px;">
                No automated comments posted in the last 24 hours. The bot is actively patrolling target groups 24/7.
            </td>
        </tr>`;

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Fiesta Fresh 6 PM Daily Activity Report</title>
        </head>
        <body style="margin:0; padding:0; background-color:#f8fafc; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc; padding: 20px 0;">
                <tr>
                    <td align="center">
                        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                            <!-- Header -->
                            <tr>
                                <td style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 32px 28px; text-align: center;">
                                    <h1 style="color:#ffffff; margin:0; font-size:24px; font-weight:800; letter-spacing:-0.5px;">Fiesta Fresh Cleaning 💙</h1>
                                    <p style="color:#e0f2fe; margin:8px 0 0 0; font-size:14px; font-weight:500;">Daily Automation Activity Report • 6:00 PM</p>
                                </td>
                            </tr>

                            <!-- Metrics -->
                            <tr>
                                <td style="padding: 24px 28px; background-color: #f1f5f9; border-bottom: 1px solid #e2e8f0;">
                                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                        <tr>
                                            <td width="30%" align="center" style="padding: 12px; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
                                                <div style="font-size: 24px; font-weight: 800; color: #0284c7;">${totalReplies}</div>
                                                <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-top: 2px;">Comments Posted</div>
                                            </td>
                                            <td width="5%"></td>
                                            <td width="30%" align="center" style="padding: 12px; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
                                                <div style="font-size: 24px; font-weight: 800; color: #10b981;">${groupCount}</div>
                                                <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-top: 2px;">Groups Reached</div>
                                            </td>
                                            <td width="5%"></td>
                                            <td width="30%" align="center" style="padding: 12px; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
                                                <div style="font-size: 24px; font-weight: 800; color: #8b5cf6;">${liveAccounts} / ${ACCOUNTS.length}</div>
                                                <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-top: 2px;">Active Accounts</div>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>

                            <!-- Content Table -->
                            <tr>
                                <td style="padding: 24px 28px;">
                                    <h3 style="margin: 0 0 16px 0; color: #1e293b; font-size: 16px; font-weight: 700;">Comments Posted Today</h3>
                                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
                                        <thead>
                                            <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                                                <th style="padding: 10px 14px; text-align: left; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700;">Time</th>
                                                <th style="padding: 10px 14px; text-align: left; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700;">Account</th>
                                                <th style="padding: 10px 14px; text-align: left; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700;">Target Group</th>
                                                <th style="padding: 10px 14px; text-align: right; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700;">Link</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${totalReplies > 0 ? tableRows : emptyMessage}
                                        </tbody>
                                    </table>
                                </td>
                            </tr>

                            <!-- Footer -->
                            <tr>
                                <td style="background-color: #f8fafc; padding: 20px 28px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
                                    <p style="margin: 0;">Fiesta Fresh Cleaning Automation System • 24/7 Patrol Daemon</p>
                                    <p style="margin: 6px 0 0 0;"><a href="https://fiesta-comments-dashboard.vercel.app" target="_blank" style="color: #0284c7; text-decoration: none; font-weight: 600;">Open Live Vercel Dashboard ↗</a></p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>`;

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user, pass }
        });

        await transporter.sendMail({
            from: `"Fiesta Fresh Automation 💙" <${user}>`,
            to: user,
            subject: `Fiesta Fresh 6 PM Daily Report: ${totalReplies} Comments Posted`,
            html
        });
        console.log(`📧 Daily 6 PM report sent successfully to ${user}!`);
    } catch (e: any) {
        console.error("⚠️ Failed to send daily report email:", e.message);
    }
}

async function checkAndSendDailyReport() {
    try {
        const now = new Date();
        // Explicitly get hour and date in Australia/Brisbane timezone (Gold Coast/Brisbane)
        const currentHour = parseInt(now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', timeZone: 'Australia/Brisbane' }), 10);
        const todayStr = now.toLocaleDateString('en-US', { timeZone: 'Australia/Brisbane' });

        // >= 18 so a restart or a missed 18:00 tick still delivers today's report.
        if (currentHour >= 18 && lastDailyReportDate !== todayStr) {
            lastDailyReportDate = todayStr;
            try {
                fs.writeFileSync(reportFilePath, todayStr, 'utf8');
            } catch (err) {
                console.error("⚠️ Failed to write last_report_date.txt:", err);
            }
            console.log("📊 Triggering Daily 6:00 PM Fiesta Fresh Gmail Report...");
            await sendDailyReportEmail();
        }
    } catch (e: any) {
        console.error("⚠️ Error checking daily report trigger:", e.message);
    }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize file persistence variables after __dirname is declared
reportFilePath = path.join(__dirname, 'last_report_date.txt');
try {
    if (fs.existsSync(reportFilePath)) {
        lastDailyReportDate = fs.readFileSync(reportFilePath, 'utf8').trim();
    }
} catch (e) {
    console.error("⚠️ Failed to read last_report_date.txt:", e);
}

// Load environment variables with fallback paths
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://xmxywlyqdqrfrojwggkt.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhteHl3bHlxZHFyZnJvandnZ2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzMzI4NjUsImV4cCI6MjEwMTkwODg2NX0.p9i_3rge9IuoYz6qgL5J6dZjwptZyKU7S7AP1Bh_EHQ';
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Persist cookies to Supabase — but ONLY when they represent a real logged-in
 * session. Writing a cookie jar with no `c_user` (or an empty array) destroys
 * the last known-good session and makes the bot unable to recover on its own.
 * Returns true when the save actually happened.
 */
async function saveSessionCookies(fbEmail: string, cookies: any[]): Promise<boolean> {
    const hasUser = Array.isArray(cookies) && cookies.some(c => c?.name === 'c_user' && c?.value);
    if (!hasUser) {
        console.warn(`⛔ Refusing to save session for ${fbEmail}: no c_user cookie present. Existing stored cookies left intact.`);
        return false;
    }
    try {
        await supabase.from('sessions').upsert({ user_email: fbEmail, cookies, updated_at: new Date() });
        console.log(`💾 Session saved for ${fbEmail} (${cookies.length} cookies).`);
        return true;
    } catch (err: any) {
        console.error(`⚠️ Failed to save session for ${fbEmail}: ${err.message}`);
        return false;
    }
}

/**
 * Build a clickable Facebook permalink for a logged reply.
 * `replies_log` stores only the group URL and the post id, so the direct post
 * link is reconstructed as /groups/<gid>/posts/<pid>/. Falls back to the group
 * URL when the post id is a content hash rather than a real numeric id.
 */
export function buildPostUrl(groupUrl: string | null, postId: string | null): string {
    const g = (groupUrl || '').trim();
    const p = (postId || '').trim();
    if (/^\d+$/.test(p)) {
        const gid = g.match(/\/groups\/([^/?#]+)/)?.[1];
        if (gid) return `https://www.facebook.com/groups/${gid}/posts/${p}/`;
        return `https://www.facebook.com/${p}`;
    }
    return g.startsWith('http') ? g : 'https://www.facebook.com/';
}

/**
 * Filter replies_log down to GENUINE comments.
 * A historic DRY_RUN=true run inserted 34 `dryrun_` rows. They can never be
 * deleted (the anon key has no DELETE on replies_log), and counting them as
 * "already replied" permanently blocked those posts from getting a real
 * comment. Dedup and reporting must therefore ignore them.
 */
/**
 * Clear Facebook's two-step verification page without a human.
 * Both commenting accounts have an authenticator app enrolled, so a correct
 * password lands on /two_step_verification/authentication/ and stops there.
 * Given the account's TOTP secret (the "setup key" from Facebook's
 * authentication-app screen) we generate the current 6-digit code with otpauth
 * and submit it, then accept the "trust this device" prompt so future logins
 * from this machine skip the challenge entirely.
 * Returns true when a code was submitted.
 */
async function completeTwoFactor(page: any, secret: string | undefined, email: string): Promise<boolean> {
    if (!/two_step_verification|checkpoint\/\?next|login\/device-based\/regular\/login/.test(page.url())) return false;
    if (!secret) {
        console.error(`\u274c ${email} is asking for a 2FA code and no TOTP secret is configured. Add "totpSecret" for this account in FB_ACCOUNTS (Facebook \u2192 Password and security \u2192 Two-factor authentication \u2192 Authentication app \u2192 setup key).`);
        return false;
    }
    try {
        const totp = new TOTP({
            issuer: 'Facebook', label: email, algorithm: 'SHA1', digits: 6, period: 30,
            secret: Secret.fromBase32(secret.replace(/\s+/g, '').toUpperCase()),
        });
        const code = totp.generate();
        console.log(`\ud83d\udd10 Two-step verification requested for ${email} — submitting generated code.`);
        const codeInput = page.locator(
            'input[name="approvals_code"], input[autocomplete="one-time-code"], ' +
            'input[aria-label*="code" i], input[type="text"]'
        ).first();
        await codeInput.waitFor({ state: 'visible', timeout: 15000 });
        await codeInput.fill(code);
        await randomDelay(600, 1200);
        const submit = page.locator(
            'button[type="submit"], div[role="button"]:has-text("Continue"), ' +
            'button:has-text("Continue"), button:has-text("Submit")'
        ).first();
        if (await submit.isVisible().catch(() => false)) await submit.click().catch(() => {});
        else await codeInput.press('Enter');
        await randomDelay(5000, 7000);
        // "Was this you?" / "Trust this device" / "Save browser" follow-ups.
        for (const label of ['Yes', 'Trust this device', 'Save browser', 'This was me', 'Continue', 'OK']) {
            const btn = page.locator(`button:has-text("${label}"), div[role="button"]:has-text("${label}")`).first();
            if (await btn.isVisible().catch(() => false)) {
                await btn.click().catch(() => {});
                await randomDelay(2500, 4000);
            }
        }
        return true;
    } catch (e: any) {
        console.error(`\u274c Two-step verification failed for ${email}: ${e.message?.slice(0, 120)}`);
        return false;
    }
}

/**
 * Password-login back-off. Repeatedly failing a password login is what gets a
 * Facebook account locked or checkpointed, and a 30-minute cycle would retry
 * forever. After a failed attempt we refuse to try that account's password
 * again for PASSWORD_RETRY_HOURS; the stored cookies are still retried every
 * cycle, so a session that comes back on its own is picked up immediately.
 */
const PASSWORD_RETRY_HOURS = parseInt(process.env.PASSWORD_RETRY_HOURS || '2');
function pwAttemptFile(email: string): string {
    return path.join(__dirname, `.pwattempt_${email.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`);
}
function recordPasswordAttempt(email: string): void {
    try { fs.writeFileSync(pwAttemptFile(email), String(Date.now()), 'utf8'); } catch {}
}
function clearPasswordAttempt(email: string): void {
    try { fs.rmSync(pwAttemptFile(email), { force: true }); } catch {}
}
function passwordAttemptAllowed(email: string): boolean {
    // Hard kill-switch. Password logins from a datacenter IP are what trigger
    // Facebook checkpoints in the first place; with PASSWORD_LOGIN=0 the bot is
    // cookie-only and a dead session fails loudly instead of risking a lockout.
    if (process.env.PASSWORD_LOGIN === "0") {
        console.warn(`\u23f8\ufe0f Password login disabled (PASSWORD_LOGIN=0) for ${email} — cookies only.`);
        return false;
    }
    try {
        const raw = fs.readFileSync(pwAttemptFile(email), 'utf8').trim();
        const last = parseInt(raw);
        if (!last) return true;
        const hours = (Date.now() - last) / 3600000;
        if (hours < PASSWORD_RETRY_HOURS) {
            console.warn(`\u23f8\ufe0f Skipping password login for ${email}: last attempt failed ${hours.toFixed(1)}h ago (waiting ${PASSWORD_RETRY_HOURS}h to avoid a lockout). Stored cookies still retried.`);
            return false;
        }
    } catch {}
    return true;
}

function realReplies(rows: any[] | null | undefined): any[] {
    return (rows || []).filter(r => !String(r?.comment_id || '').startsWith('dryrun_'));
}

/**
 * After posting, find the permalink of the comment we just left so the CEO gets
 * clickable PROOF on the dashboard instead of a link to the whole group.
 * Facebook renders a timestamp anchor on each comment whose href carries
 * `comment_id=`; we look for the one sitting next to our own comment text.
 * Doubles as a post-verification: if we cannot see our comment on the page at
 * all, the caller knows the Enter keypress did not actually publish anything.
 */
async function captureCommentPermalink(page: any, fallbackUrl: string): Promise<{ url: string; verified: boolean }> {
    const MARKER = '200% Happiness Guarantee';
    for (let attempt = 0; attempt < 3; attempt++) {
        await new Promise(r => setTimeout(r, 2500));
        try {
            const found = await page.evaluate((marker: string) => {
                const nodes = Array.from(document.querySelectorAll('div[role="article"], li, div'));
                const mine = nodes.filter(n => (n.textContent || '').includes(marker)
                    && (n.textContent || '').length < 3000);
                for (const n of mine.reverse()) {
                    let scope: Element | null = n;
                    for (let up = 0; up < 4 && scope; up++) {
                        const a = Array.from(scope.querySelectorAll('a[href*="comment_id="]'))
                            .map(el => (el as HTMLAnchorElement).href)[0];
                        if (a) return a;
                        scope = scope.parentElement;
                    }
                }
                // Comment is visible but no permalink anchor rendered yet.
                return mine.length ? 'SEEN' : '';
            }, MARKER);
            if (found && found !== 'SEEN') {
                const clean = found.split('&__cft')[0];
                console.log(`🔗 Comment permalink captured: ${clean.slice(0, 110)}`);
                return { url: clean, verified: true };
            }
            if (found === 'SEEN') {
                console.log('🔗 Comment visible on page but no permalink anchor — using post URL.');
                return { url: fallbackUrl, verified: true };
            }
        } catch (e: any) {
            console.warn(`⚠️ Permalink capture attempt failed: ${e.message?.slice(0, 80)}`);
        }
    }
    console.warn('⚠️ Could not confirm our comment on the page after posting — logging post URL, unverified.');
    return { url: fallbackUrl, verified: false };
}

const DRY_RUN = process.env.DRY_RUN === 'true';
// 1800s = 30 minutes between each full 85-group patrol cycle (runs 24/7)
const SCAN_INTERVAL = parseInt(process.env.SCAN_INTERVAL_SECONDS || '1800') * 1000;

// --- Account Configuration ---
// FB_ACCOUNTS = JSON array of {email, password} for multi-account rotation
// Falls back to FB_EMAIL/FB_PASSWORD for backward compatibility
// password is optional: cookie-only accounts are supported so the bot never
// attempts a password login with a placeholder/missing secret.
interface FbAccount { email: string; password?: string | undefined; totpSecret?: string | undefined; }

function loadAccounts(): FbAccount[] {
    const raw = process.env.FB_ACCOUNTS;
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed.filter((a: any) => a.email);
            }
        } catch (e) {
            console.error("⚠️ Invalid FB_ACCOUNTS JSON, falling back to FB_EMAIL/FB_PASSWORD.");
        }
    }
    const single: FbAccount[] = [];
    if (process.env.FB_EMAIL) {
        single.push({ email: process.env.FB_EMAIL!, password: process.env.FB_PASSWORD });
    }
    return single;
}

/**
 * BOT_ROLE lets the same file run as three different processes:
 *   scout     — sweeps groups, never comments (finds work)
 *   commenter — never sweeps, polls the queue and comments (does work)
 *   all       — the original single-process behaviour (default)
 * BOT_ACCOUNT pins a commenter to one Facebook account so each account gets
 * its own browser instead of taking turns in one.
 */
const BOT_ROLE = (process.env.BOT_ROLE || 'all').toLowerCase();
const BOT_ACCOUNT = (process.env.BOT_ACCOUNT || '').trim().toLowerCase();

const ALL_ACCOUNTS = loadAccounts();
const ACCOUNTS = BOT_ACCOUNT
    ? ALL_ACCOUNTS.filter(a => String(a.email).toLowerCase() === BOT_ACCOUNT)
    : ALL_ACCOUNTS;
let currentAccountIndex = 0;
let consecutiveAuthFailures = 0;
let sessionAlertSent = false;

// ─────────────────────────────────────────────────────────────────────────────
// PER-ACCOUNT TEMPLATES + POSTING RULES
//
// accounts.config.json sits next to this file on the VPS and is re-read every
// 60s, so the wording and the throttles can be changed without a deploy or a
// restart. Every account owns its own template; the reply text is no longer
// hardcoded in two places in the flow.
// ─────────────────────────────────────────────────────────────────────────────

interface AccountRule {
    key: string;
    email: string;
    label: string;
    role: 'main_reply' | 'url_drop';
    enabled: boolean;
    share: number;
    maxCommentsPerDay: number;
    minMinutesBetweenComments: number;
    template: string;
}

const ACCOUNT_CONFIG_FILE = path.join(__dirname, 'accounts.config.json');
const ACCOUNT_CONFIG_TTL_MS = 60000;
let accountRulesCache: { at: number; rules: AccountRule[] } | null = null;

/** Last-resort template if the config file is missing or unreadable. */
const DEFAULT_MAIN_TEMPLATE = `Hi! 💙 We would absolutely love to help you out!

We are Fiesta Fresh Cleaning, a local Gold Coast team that genuinely cares about every single home and space we walk into. Fully insured, police-checked and proudly serving the Gold Coast community 🏡✨

And here is what makes us a little different from everyone else… we offer a 200% Happiness Guarantee on every single clean we do. That means if anything is not perfect we come back and fix it for FREE. No questions asked. We are the only cleaning company on the Gold Coast offering this and we stand behind it completely. 🙌

We are not a big franchise. We are your neighbours. A real local team that shows up, works hard and truly cares about leaving your space better than we found it. Every single time. 💙

You can check out everything we offer, read our reviews and even book in 60 seconds right here 👉 fiestafreshcleaning.com/book

We will also send you a DM just in case you have any questions. Make sure to check your message requests! We cannot wait to help you out. 🎉`;

const DEFAULT_URL_DROP = 'https://www.fiestafreshcleaning.com/';

function loadAccountRules(): AccountRule[] {
    if (accountRulesCache && Date.now() - accountRulesCache.at < ACCOUNT_CONFIG_TTL_MS) {
        return accountRulesCache.rules;
    }
    let rules: AccountRule[] = [];
    try {
        const parsed = JSON.parse(fs.readFileSync(ACCOUNT_CONFIG_FILE, 'utf8'));
        rules = (parsed.accounts || [])
            .filter((a: any) => a && a.email && a.template)
            .map((a: any) => ({
                key: String(a.key || a.email),
                email: String(a.email),
                label: String(a.label || a.email),
                role: a.role === 'url_drop' ? 'url_drop' : 'main_reply',
                enabled: a.enabled !== false,
                share: Number.isFinite(a.share) ? Number(a.share) : 50,
                maxCommentsPerDay: Number.isFinite(a.maxCommentsPerDay) ? Number(a.maxCommentsPerDay) : 12,
                minMinutesBetweenComments: Number.isFinite(a.minMinutesBetweenComments) ? Number(a.minMinutesBetweenComments) : 20,
                template: String(a.template),
            }));
        if (!accountRulesCache) {
            console.log(`📋 Loaded ${rules.length} account rule(s) from accounts.config.json: ${rules.map(r => `${r.label}[${r.role}]`).join(', ')}`);
        }
    } catch (e: any) {
        if (!accountRulesCache) console.warn(`⚠️ accounts.config.json unreadable (${e.message}) — using built-in template for every account.`);
        rules = [];
    }
    accountRulesCache = { at: Date.now(), rules };
    return rules;
}

function ruleFor(email: string): AccountRule | null {
    const target = (email || '').toLowerCase();
    return loadAccountRules().find(r => r.email.toLowerCase() === target) ?? null;
}

/** The reply text this account should post. */
function templateFor(email: string): string {
    const rule = ruleFor(email);
    if (rule?.template) return rule.template;
    console.warn(`⚠️ No template configured for ${email} — using the built-in default.`);
    return DEFAULT_MAIN_TEMPLATE;
}

/** The short website comment for the booster account. */
function urlDropTemplate(): string {
    const rule = loadAccountRules().find(r => r.role === 'url_drop' && r.enabled);
    return rule?.template || DEFAULT_URL_DROP;
}

/**
 * Per-account throttle, counted from replies_log so it survives restarts.
 * Protects the accounts from the burst pattern that gets them banned:
 * a daily ceiling plus a minimum gap between two comments by the same account.
 */
async function accountMayComment(email: string, label?: string): Promise<boolean> {
    const rule = ruleFor(email);
    if (!rule) return true;
    if (!rule.enabled) {
        console.log(`⏸️ ${rule.label} is disabled in accounts.config.json — skipping.`);
        return false;
    }
    try {
        const stamp = label || email;
        const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        const { data } = await supabase
            .from('replies_log')
            .select('replied_at, comment_id')
            .eq('user_profile_id', stamp)
            .gte('replied_at', since)
            .order('replied_at', { ascending: false });
        const rows = realReplies(data);
        if (rows.length >= rule.maxCommentsPerDay) {
            console.log(`🛑 ${rule.label} hit its daily cap (${rows.length}/${rule.maxCommentsPerDay} in 24h) — holding off.`);
            return false;
        }
        const last = rows[0]?.replied_at ? new Date(rows[0].replied_at).getTime() : 0;
        if (last) {
            const mins = (Date.now() - last) / 60000;
            if (mins < rule.minMinutesBetweenComments) {
                console.log(`⏳ ${rule.label} commented ${mins.toFixed(0)} min ago (min gap ${rule.minMinutesBetweenComments} min) — holding off.`);
                return false;
            }
        }
        console.log(`✅ ${rule.label} clear to comment (${rows.length}/${rule.maxCommentsPerDay} today).`);
    } catch (e: any) {
        console.warn(`⚠️ Could not check throttle for ${email}: ${e.message} — allowing.`);
    }
    return true;
}

/**
 * Claim a lead before commenting on it.
 *
 * The anon key has no UPDATE grant on `leads` (verified: a PATCH returns zero
 * rows), so the claim cannot live on the lead row. `sessions` has a unique
 * user_email and does accept inserts, so a row named `claim:<post_id>` acts as
 * a mutex — the insert either succeeds (we own the lead) or trips the unique
 * constraint (someone else owns it). Claims older than CLAIM_TTL_MINUTES are
 * treated as abandoned so a crashed commenter cannot park a lead forever.
 */
/**
 * Leads whose live post text failed re-validation. The anon key cannot UPDATE
 * `leads`, so a rejected row keeps coming back every poll — and re-opening two
 * dead posts cost ~3 minutes of every cycle. Remember them on disk instead.
 */
const rejectedLeadsFile = path.join(__dirname, 'rejected_leads.txt');
const liveRejectedLeads = new Set<string>();
try {
    if (fs.existsSync(rejectedLeadsFile)) {
        for (const line of fs.readFileSync(rejectedLeadsFile, 'utf8').split('\n')) {
            if (line.trim()) liveRejectedLeads.add(line.trim());
        }
    }
} catch { /* start with an empty memory */ }

function rememberRejectedLead(postId: string) {
    if (liveRejectedLeads.has(postId)) return;
    liveRejectedLeads.add(postId);
    try { fs.appendFileSync(rejectedLeadsFile, postId + '\n'); } catch { /* memory only */ }
}

const CLAIM_TTL_MS = parseInt(process.env.CLAIM_TTL_MINUTES || '10') * 60 * 1000;

async function claimLead(postId: string, fbEmail: string): Promise<boolean> {
    if (BOT_ROLE === 'all' && !BOT_ACCOUNT) return true; // single process, nothing to race
    const key = `claim:${postId}`;
    const payload = { user_email: key, cookies: [{ by: fbEmail, at: Date.now() }] as any, updated_at: new Date() };
    const { error } = await supabase.from('sessions').insert(payload);
    if (!error) return true;

    // Someone holds it. Take it over only if their claim has gone stale.
    const { data: held } = await supabase.from('sessions').select('cookies, updated_at').eq('user_email', key).maybeSingle();
    const heldAt = held?.updated_at ? new Date(held.updated_at).getTime() : 0;
    if (heldAt && Date.now() - heldAt < CLAIM_TTL_MS) {
        const owner = (held?.cookies as any)?.[0]?.by || 'another bot';
        console.log(`\u23ed\ufe0f Lead ${postId} is claimed by ${owner} — leaving it.`);
        return false;
    }
    await supabase.from('sessions').upsert(payload);
    console.log(`\u267b\ufe0f Took over a stale claim on lead ${postId}.`);
    return true;
}

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


// ─────────────────────────────────────────────────────────────────────────────
// ZERO-API KEYWORD ENGINE v3
//
// Designed to classify correctly WITHOUT any LLM call. Three signal sets are
// combined instead of relying on one flat phrase list:
//
//   1. DISQUALIFIERS   — competitors advertising, job seekers, unrelated trades,
//                        unrelated senses of the word "clean". Checked first.
//   2. STRONG_LEAD     — phrases that on their own prove someone wants a cleaner.
//   3. SERVICE + ASK   — a cleaning SERVICE word (bond clean, carpet cleaning…)
//                        combined with a REQUEST signal (looking for, need,
//                        recommend, quote, ISO, after a…) is also a lead.
//
// All matching is word-boundary based on normalised text, so "cleaner" no longer
// matches inside "vacuum cleaner for sale" style traps and punctuation/emoji
// between words can't break a phrase.
// ─────────────────────────────────────────────────────────────────────────────

/** Lowercase, strip emoji/punctuation, collapse whitespace. */
function normalizeForMatch(text: string): string {
    return (text || '')
        .toLowerCase()
        .replace(/[’‘`]/g, "'")
        .replace(/[^a-z0-9'\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Whole-phrase, word-boundary match (phrases may contain spaces). */
function hasPhrase(haystack: string, phrase: string): boolean {
    const p = phrase.toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!p) return false;
    return new RegExp(`(^|\\s)${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(haystack);
}

function firstMatch(haystack: string, phrases: string[]): string | null {
    for (const p of phrases) if (hasPhrase(haystack, p)) return p;
    return null;
}

/**
 * The four service lines Fiesta Fresh actually sells:
 *   BOND (end of lease) · HOME (residential) · CARPET (soft furnishings) · COMMERCIAL
 * Anything outside these (windows-only, gutters, pressure washing, solar panels,
 * oven-only, blinds) is deliberately NOT here — those generate leads the business
 * cannot service.
 */
const SERVICE_BOND = [
    'bond clean', 'bond cleans', 'bond cleaning', 'bond cleaner', 'bond cleaners',
    'bond back clean', 'end of lease clean', 'end of lease cleaning',
    'end of lease cleaner', 'end of lease', 'eol clean', 'exit clean',
    'exit cleaning', 'exit cleaner', 'vacate clean', 'vacate cleaning',
    'move out clean', 'move out cleaning', 'moving out clean', 'move in clean',
    'move in cleaning', 'lease clean', 'lease cleaning', 'final clean',
    'inspection clean', 'rental clean', 'rental cleaning', 'tenancy clean',
    'end of tenancy clean', 'handover clean', 'pre inspection clean',
];

const SERVICE_HOME = [
    'house clean', 'house cleans', 'house cleaner', 'house cleaning',
    'home clean', 'home cleaner', 'home cleaning', 'domestic clean',
    'domestic cleaner', 'domestic cleaning', 'residential clean',
    'residential cleaner', 'residential cleaning', 'housekeeper', 'housekeeping',
    'house keeper', 'cleaning lady', 'cleaner', 'cleaners', 'cleaning',
    'cleaning service', 'cleaning services', 'cleaning company',
    'deep clean', 'deep cleaning', 'spring clean', 'spring cleaning',
    'one off clean', 'once off clean', 'regular clean', 'regular cleaning',
    'weekly clean', 'weekly cleaning', 'fortnightly clean', 'fortnightly cleaning',
    'monthly clean', 'monthly cleaning', 'ongoing clean', 'ongoing cleaning',
    'general clean', 'general cleaning', 'detailed clean', 'full clean',
    'top to bottom clean', 'apartment clean', 'unit clean', 'townhouse clean',
    'airbnb clean', 'airbnb cleaning', 'air bnb clean', 'air bnb cleaning',
    'airbnb changeover', 'airbnb turnover', 'short stay clean',
    'short stay cleaning', 'holiday let clean', 'holiday rental clean',
    'ndis clean', 'ndis cleaning', 'ndis cleaner', 'ndis housekeeping',
    'aged care clean', 'aged care cleaning', 'disability cleaning',
    'hoarding clean', 'hoarder clean', 'deceased estate clean', 'squalor clean',
];

const SERVICE_CARPET = [
    'carpet clean', 'carpet cleans', 'carpet cleaning', 'carpet cleaner',
    'carpet steam clean', 'carpet shampoo', 'steam clean', 'steam cleaning',
    'upholstery clean', 'upholstery cleaning', 'lounge clean', 'couch clean',
    'couch cleaning', 'sofa clean', 'sofa cleaning', 'mattress clean',
    'mattress cleaning', 'rug clean', 'rug cleaning', 'stain removal',
];

const SERVICE_COMMERCIAL = [
    'office clean', 'office cleaning', 'office cleaner', 'commercial clean',
    'commercial cleaning', 'commercial cleaner', 'strata clean',
    'strata cleaning', 'body corporate cleaning', 'shop clean', 'shop cleaning',
    'cafe clean', 'cafe cleaning', 'restaurant clean', 'restaurant cleaning',
    'salon clean', 'gym clean', 'gym cleaning', 'warehouse clean',
    'warehouse cleaning', 'childcare clean', 'childcare cleaning',
    'school clean', 'school cleaning', 'medical centre cleaning',
    'clinic cleaning', 'builders clean', 'builder clean', 'builders cleaning',
    'post construction clean', 'construction clean', 'renovation clean',
    'reno clean', 'after builders clean', 'site clean', 'workplace cleaning',
];

/**
 * Jobs people ask about that Fiesta Fresh does NOT sell. A post is dropped when
 * it only mentions one of these and no in-scope service (so "bond clean incl.
 * windows" still qualifies, but "need my windows done" does not).
 */
const OUT_OF_SCOPE = [
    'window clean', 'window cleaning', 'window cleaner', 'windows cleaned',
    'window washing', 'gutter clean', 'gutter cleaning', 'roof clean',
    'roof cleaning', 'pressure clean', 'pressure cleaning', 'pressure wash',
    'pressure washing', 'high pressure clean', 'driveway clean',
    'driveway cleaning', 'solar panel clean', 'solar panel cleaning',
    'oven clean', 'oven cleaning', 'oven cleaner', 'bbq clean', 'bbq cleaning',
    'blind clean', 'blind cleaning', 'blinds cleaned', 'curtain clean',
    'curtain cleaning', 'curtains cleaned', 'tile and grout', 'grout clean',
    'grout cleaning', 'pool clean', 'pool cleaning', 'car clean', 'car detailing',
    'ironing service', 'laundry service',
];

/** In-scope service words that are specific (excludes the generic "cleaner"/"cleaning"). */
const SERVICE_SPECIFIC: string[] = [];

/** All service lines, with the line recorded for logging/reporting. */
const SERVICE_LINES: Array<{ line: string; words: string[] }> = [
    { line: 'BOND', words: SERVICE_BOND },
    { line: 'CARPET', words: SERVICE_CARPET },
    { line: 'COMMERCIAL', words: SERVICE_COMMERCIAL },
    { line: 'HOME', words: SERVICE_HOME },
];

const SERVICE_KEYWORDS: string[] = SERVICE_LINES.flatMap(s => s.words);

const GENERIC_SERVICE_WORDS = new Set([
    'cleaner', 'cleaners', 'cleaning', 'cleaning service', 'cleaning services',
    'cleaning company', 'cleaning lady',
]);
SERVICE_SPECIFIC.push(...SERVICE_KEYWORDS.filter(w => !GENERIC_SERVICE_WORDS.has(w)));

/** Which service line a post belongs to (most specific first). */
function detectServiceLine(text: string): { line: string; word: string } | null {
    for (const { line, words } of SERVICE_LINES) {
        const w = firstMatch(text, words);
        if (w) return { line, word: w };
    }
    return null;
}

/** Someone is ASKING for something (as opposed to advertising it). */
const REQUEST_SIGNALS = [
    'looking for', 'look for', 'looking to find', 'in search of', 'iso',
    'need', 'needing', 'needed', 'i need', 'we need', 'in need of',
    'want', 'wanting', 'wanted', 'i want', 'we want', 'would like',
    'after a', 'after an', 'after some', 'chasing', 'keen for', 'keen to find',
    'seeking', 'searching for', 'search for', 'require', 'requiring', 'required',
    'recommend', 'recommendation', 'recommendations', 'recommendations for',
    'suggestions', 'suggestion', 'any suggestions', 'anyone know',
    'does anyone know', 'anyone recommend', 'can anyone recommend',
    'does anyone have', 'anyone got', 'anyone available', 'who can',
    'who does', 'know anyone', 'know of anyone', 'know someone',
    'help with', 'need help', 'looking for help', 'assistance with',
    'hire', 'hiring someone', 'book', 'booking', 'book in',
    'quote', 'quotes', 'a quote', 'how much', 'price for', 'cost of',
    'availability', 'available this', 'available next', 'asap',
    'can someone', 'someone to', 'anyone to', 'point me',
    'who is good', "who's good", 'whos good', 'who do you use', 'who do you recommend',
    'who should i call', 'who should i use', 'anyone use', 'anyone used',
    'used anyone', 'any good', 'best place for', 'worth using', 'thoughts on',
    'is there anyone', 'is anyone', 'are there any', 'any decent', 'any reliable',
];

/** Unambiguous — approve on sight, no combination needed. */
const STRONG_LEAD_PHRASES = [
    'looking for a cleaner', 'looking for cleaner',
    'looking for a house cleaner', 'looking for a domestic cleaner',
    'looking for a bond cleaner', 'looking for a carpet cleaner',
    'looking for a window cleaner', 'looking for a cleaning service',
    'looking for a cleaning company', 'looking for someone to clean',
    'looking for someone who cleans', 'looking for a reliable cleaner',
    'looking for a good cleaner', 'looking for a regular cleaner',
    'need a cleaner', 'need cleaner', 'need a house cleaner',
    'need a bond cleaner', 'need a carpet cleaner', 'need a window cleaner',
    'need someone to clean', 'need a cleaning service', 'need cleaning done',
    'in need of a cleaner', 'in need of cleaning',
    'cleaner needed', 'cleaner wanted',
    'cleaning needed', 'cleaning wanted', 'cleaner required', 'cleaning required',
    'want a cleaner', 'wanting a cleaner', 'after a cleaner', 'chasing a cleaner',
    'seeking a cleaner', 'seeking cleaner', 'iso a cleaner', 'iso cleaner',
    'recommend a cleaner', 'recommend a good cleaner', 'recommend a cleaning service',
    'recommendations for a cleaner', 'recommendation for a cleaner',
    'anyone recommend a cleaner', 'can anyone recommend a cleaner',
    'anyone know a cleaner', 'anyone know a good cleaner',
    'anyone know of a cleaner', 'does anyone know a cleaner',
    'know a good cleaner', 'know any good cleaners', 'any good cleaners',
    'anyone got a cleaner', 'does anyone have a cleaner',
    'who does cleaning', 'who can clean', 'anyone who cleans',
    'hire a cleaner', 'hiring a cleaner', 'book a cleaner', 'booking a cleaner',
    'get my house cleaned', 'get the house cleaned', 'want my house cleaned',
    'have my house cleaned', 'house needs a clean', 'house needs cleaning',
    'place needs a clean', 'quote for cleaning', 'quote for a clean',
    'cleaning quote', 'how much to clean', 'how much for a clean',
    'help with cleaning', 'help with the cleaning', 'help cleaning my house',
];

/**
 * Reject outright. Ordered roughly by how common the false positive is.
 * Covers: competitors advertising, people seeking cleaning WORK, other trades,
 * items for sale, and unrelated meanings of "clean".
 */
const HARD_DISQUALIFIERS = [
    // ── competitors advertising their own service ──
    'i offer', 'we offer', 'i provide', 'we provide', 'i specialise',
    'we specialise', 'i specialize', 'we specialize',
    'my business', 'our business', 'my cleaning business', 'our cleaning business',
    'my company', 'our company',
    'family run business', 'family owned business', 'locally owned and operated',
    'book now', 'book today', 'book in now', 'bookings open', 'now taking bookings',
    'taking on new clients', 'accepting new clients', 'new clients welcome',
    'i have availability', 'we have availability',
    'vacancies available',
    'sale on now',
    'services offered', 'services include', 'what we offer', 'what we do',
    'services i offer', 'our services', 'my services', 'price list',
    'follow my page', 'like my page', 'like our page', 'check out my page',
    'check out our website', 'visit our website', 'link in bio',
    'testimonial', 'testimonials',
    // ── people looking for cleaning WORK / recruitment ──
    'looking for work', 'looking for cleaning work', 'seeking work',
    'seeking cleaning work', 'available for work', 'i am a cleaner',
    'im a cleaner', 'i am a professional cleaner', 'experienced cleaner available',
    'cleaner available', 'cleaners available', 'i clean houses',
    'i do cleaning', 'we do cleaning', 'happy to clean',
    'hiring cleaners', 'we are hiring', 'now hiring', 'join our team',
    'cleaner position', 'cleaning position', 'job opening', 'job vacancy',
    'position available', 'positions available', 'casual work',
    'subcontractor', 'sub contractor', 'subcontract', 'resume', 'cv',
    'work wanted', 'seeking employment',
    // ── other trades / not our service ──
    'car wash', 'car clean', 'car detailing', 'mobile detailing', 'auto detailing',
    'pool clean', 'pool cleaning', 'pool service', 'gutter clean',
    'gutter cleaning', 'roof clean', 'roof cleaning', 'lawn', 'lawn mowing',
    'mowing', 'gardening', 'garden maintenance', 'landscaping', 'tree lopping',
    'rubbish removal', 'junk removal', 'skip bin', 'plumber', 'plumbing',
    'electrician', 'handyman', 'painter', 'painting quote', 'removalist',
    'removalists', 'pest control', 'pest inspection', 'locksmith',
    'dry cleaning', 'dry cleaner', 'laundromat',
    // ── items for sale / product chat ──
    'for sale', 'selling', 'sell my', 'brand new in box', 'pick up only',
    'vacuum for sale', 'vacuum cleaner for sale', 'steam mop', 'robot vacuum',
    'cleaning products', 'cleaning supplies', 'norwex', 'enjo',
    'best product to clean', 'what product', 'which product',
    'how do i clean', 'how do you clean', 'how to clean', 'any tips to clean',
    'tips for cleaning', 'hack to clean', 'cleaning hack', 'cleaning hacks',
    // ── unrelated senses of "clean" ──
    'clean out my closet', 'cleaning out my closet', 'clean out my wardrobe',
    'cleaning out the shed', 'clean eating', 'clean energy', 'clean water',
    'teeth clean', 'dental clean', 'ear clean', 'clean driving record',
    'clean skin', 'come clean', 'squeaky clean bill',

    // ── recruitment: someone hiring cleaners for THEIR business (not a client) ──
    'join her team', 'join my team', 'join the team', 'cleaner contractors',
    'cleaning contractors', 'abn required',
    'start asap for',
    'send your resume', 'apply now', 'applications open',
    'looking for cleaners to join', 'looking for experienced cleaners',
    'wanting to join', 'work with us', 'employment opportunity',
    // ── support work / childcare / other care roles ──
    'personal care', 'disability support',
    'carer', 'care worker', 'babysitting', 'baby sitting', 'babysitter',
    'nanny', 'au pair', 'tutor', 'dog walking', 'pet sitting', 'house sitting',
    // ── rentals & real estate ──
    'room to rent', 'room for rent', 'rooms for rent', 'looking for a room',
    'looking for a rental', 'long term rental', 'rental application',
    'house to rent', 'for rent', 'tenants', 'tenant', 'rental property available',
    'price reduction', 'offers over', 'open home', 'inspection times',
    'just listed', 'under contract', 'auction', 'for lease',
    // ── "cleaning out" / decluttering, not a cleaning job ──
    'cleaning out your', 'clean out your', 'cleaning out the garage',
    'cleaning out my', 'clean out my', 'having a clear out', 'garage sale',
    // ── marketing / content posts from cleaning businesses ──
    'book your', 'get booked', 'giveaway', 'bond back', 'bond back guarantee',
    'let us', 'we bring', 'our professional', 'deserve more than',
    'for your business', 'grow your business', 'eco friendly and vegan',
    'transformation', 'before and after', 'swipe to see', 'tag someone',
    'clean hotel',
    // ── B2B software / marketing aimed at cleaning businesses ──
    'xero', 'crm', 'software', 'platform', 'dashboard', 'invoices',
    'invoicing', 'your bookings', 'client books', 'vendors', 'restock',
    'keeps your whole', 'admin', 'subscription', 'leads for your',
    'more clients', 'win more', 'scale your',
    // ── someone answering, not asking ──
    'i recommend', 'we recommend', 'shout out to', 'big thanks to',
    'thanks to', 'thank you to', 'just used', 'did a great job',
    'amazing job', 'so happy with',
];

/**
 * Soft signals: typical of an advertiser, but a genuine client post can also
 * contain them ("PM me", "must have ABN"). Only reject on these when the post
 * does NOT also contain an unambiguous request for a cleaner.
 */
const SOFT_DISQUALIFIERS = [
    // Someone answering a request rather than making one -- but a genuine
    // client post can also say it ("can anyone highly recommend a cleaner?"),
    // so only reject when no explicit request phrase is present.
    'i highly recommend', 'can highly recommend', 'highly recommend',
    'my team', 'our team', 'spots available', 'spaces available',
    'availability this week', 'availability next week', 'openings available', 'pm for a quote',
    'pm for quote', 'dm for a quote', 'dm for quote', 'pm me for',
    'dm me for', 'message me for', 'inbox me for', 'pm me',
    'dm me', 'inbox me', 'contact us', 'call us',
    'call me on', 'text me on', 'give us a call', 'get in touch',
    'reach out to us', 'free quote', 'free quotes', 'no obligation quote',
    'competitive rates', 'competitive pricing', 'affordable rates', 'reasonable rates',
    'best rates', 'special offer', 'discount', 'promo',
    'promotion', 'fully insured', 'police checked', 'abn',
    'public liability', 'satisfaction guaranteed', 'happiness guarantee', 'reviews welcome',
    'own car', 'own transport', 'own abn', 'good pay',
    'great pay', 'hourly rate', 'per hour', 'paid weekly',
    'immediate start', 'must have experience', 'experience preferred',
];

/**
 * Interstate / far-away locations. Fiesta Fresh services the Gold Coast, so a
 * post that names another state's city is not a servicable lead even if the
 * wording is a perfect match.
 */
const GEO_EXCLUDE = [
    'adelaide', 'melbourne', 'sydney', 'perth', 'hobart', 'darwin', 'canberra',
    'geelong', 'ballarat', 'bendigo', 'newcastle', 'wollongong', 'launceston',
    'townsville', 'cairns', 'mackay', 'rockhampton', 'toowoomba', 'bundaberg',
    'victoria', 'new south wales', 'nsw', 'south australia', 'western australia',
    'tasmania', 'northern territory', 'mambourin', 'new zealand', 'auckland',
];

/**
 * Capped minimal delay for reliability but fast bot execution
 */
async function randomDelay(min: number = 800, max: number = 2500) {
    // Real randomised delays. Facebook was killing sessions within ~1hr when
    // every action fired back-to-back with a fixed 10ms gap.
    const lo = Math.max(0, Math.min(min, max));
    const hi = Math.max(lo, max);
    const ms = lo + Math.floor(Math.random() * (hi - lo + 1));
    await new Promise(resolve => setTimeout(resolve, ms));
}

/** Longer cool-down between write actions (comments), in seconds. */
async function coolDown(label: string) {
    const min = parseInt(process.env.COMMENT_DELAY_MIN_SECONDS || '45');
    const max = parseInt(process.env.COMMENT_DELAY_MAX_SECONDS || '150');
    const secs = min + Math.floor(Math.random() * Math.max(1, max - min + 1));
    console.log(`\u23f3 Cool-down ${secs}s before ${label}...`);
    await new Promise(r => setTimeout(r, secs * 1000));
}

/**
 * Super fast typing - instantly inserts text
 */

/**
 * Navigate with retry. The VPS reaches Facebook through a SOCKS proxy
 * (tailscaled -> home exit node). That link drops intermittently and every drop
 * used to cost a whole group (or the whole cycle) because a single failed
 * page.goto was fatal. Retry with backoff instead of losing the work.
 */
const NAV_TIMEOUT_MS = parseInt(process.env.NAV_TIMEOUT_MS || '90000');

async function gotoWithRetry(page: any, url: string, label: string, tries: number = 3): Promise<boolean> {
    for (let attempt = 1; attempt <= tries; attempt++) {
        try {
            await page.goto(url, { waitUntil: 'commit', timeout: NAV_TIMEOUT_MS });
            if (attempt > 1) console.log(`   \u2705 ${label} loaded on attempt ${attempt}.`);
            return true;
        } catch (e: any) {
            const msg = String(e?.message || e).slice(0, 120);
            const transient = /SOCKS|ERR_PROXY|ERR_TUNNEL|ERR_TIMED_OUT|ERR_CONNECTION|ERR_NAME_NOT_RESOLVED|Timeout|interrupted by another navigation|frame was detached/i.test(msg);
            if (attempt === tries || !transient) {
                console.error(`   \u26a0\ufe0f ${label} navigation failed after ${attempt} attempt(s): ${msg}`);
                if (!transient) throw e;
                return false;
            }
            const backoff = 5000 * attempt * attempt; // 5s, 20s
            console.warn(`   \u21bb ${label} navigation hiccup (${msg}) — retry ${attempt + 1}/${tries} in ${backoff / 1000}s`);
            await new Promise(r => setTimeout(r, backoff));
        }
    }
    return false;
}

async function humanType(page: any, selector: string, text: string) {
    await page.click(selector, { force: true }).catch(() => {});
    // Per-character typing with jitter — instant insertText is a strong bot tell.
    for (const ch of text) {
        await page.keyboard.type(ch, { delay: 40 + Math.floor(Math.random() * 110) });
    }
}

/** Types the reply body with human-ish cadence, chunked so long templates stay quick enough. */
async function typeComment(page: any, text: string) {
    const chunks = text.split(/(\n\n)/);
    for (const chunk of chunks) {
        if (!chunk) continue;
        await page.keyboard.insertText(chunk);
        await randomDelay(350, 1200);
    }
}

/**
 * Close overlays and popups
 */
async function closeOverlays(page: any) {
    // Hard-limit: use page.$() for instant DOM checks, no auto-waiting
    const overlaySelectors = [
        'button[data-testid="cookie-policy-manage-dialog-accept-button"]',
        '[aria-label="Allow all cookies"]',
        'button[aria-label="Close"]',
        'div[role="dialog"] button',
    ];
    await Promise.race([
        (async () => {
            for (const sel of overlaySelectors) {
                try {
                    const el = await page.$(sel);
                    if (el) {
                        console.log(`🍪 Closing overlay: ${sel}`);
                        await el.click({ timeout: 1000 }).catch(() => {});
                    }
                } catch (e) {}
            }
        })(),
        new Promise(r => setTimeout(r, 2500))
    ]);
}


/**
 * High-precision zero-API classifier.
 * Returns 'approve' (comment), 'reject' (ignore), or 'unsure' (LLM if available).
 */
// Fingerprints of our own posts / ad copy / comment template.
const OWN_AD_MARKERS = [
    'fiesta fresh',
    'fiestafresh',
    'fiestafreshcleaning',
    '200% happiness guarantee',
    '200 % happiness guarantee',
    'happiness guarantee',
    'only cleaning company on the gold coast offering this',
];

function quickKeywordFilter(postText: string): 'approve' | 'reject' | 'unsure' {
    const text = normalizeForMatch(postText);
    if (!text || text.length < 12) return 'reject';

    // 0. Never comment on our own advertising. The bot commented on a Fiesta
    //    Fresh promo post once because our own ad copy is full of service keywords.
    const ownAd = firstMatch(text, OWN_AD_MARKERS);
    if (ownAd) {
        console.log(`❌ Rejected — this is our own Fiesta Fresh post: "${ownAd}"`);
        return 'reject';
    }

    // 1. Disqualifiers win — competitor ads and job posts look superficially
    //    identical to leads, so they are checked before anything else.
    const bad = firstMatch(text, HARD_DISQUALIFIERS);
    if (bad) {
        console.log(`❌ Rejected — disqualifier: "${bad}"`);
        return 'reject';
    }

    // 1b. Servicing area — reject leads that name another state/region.
    const faraway = firstMatch(text, GEO_EXCLUDE);
    if (faraway) {
        console.log(`❌ Rejected — outside service area: "${faraway}"`);
        return 'reject';
    }

    // 1c. Out-of-scope trades (windows only, gutters, pressure washing, ovens…)
    //     — dropped unless an in-scope service is also named.
    const oos = firstMatch(text, OUT_OF_SCOPE);
    if (oos && !firstMatch(text, SERVICE_SPECIFIC)) {
        console.log(`❌ Rejected — out of scope service: "${oos}"`);
        return 'reject';
    }

    // 2. Unambiguous request for a cleaner.
    const strong = firstMatch(text, STRONG_LEAD_PHRASES);
    if (strong) {
        console.log(`🎯 LEAD (strong phrase): "${strong}"`);
        return 'approve';
    }

    // 2b. Advertiser-ish signals only disqualify when there was no clear request
    //     above — real clients do write "PM me" and "must have an ABN".
    const soft = firstMatch(text, SOFT_DISQUALIFIERS);
    if (soft) {
        console.log(`❌ Rejected — advertiser signal: "${soft}"`);
        return 'reject';
    }

    // 3. Service word + request signal = lead. This is what catches the long
    //    tail: "any recommendations for carpet cleaning", "after an oven clean",
    //    "how much for a bond clean", "ISO end of lease cleaning".
    const svc = detectServiceLine(text);
    const ask = firstMatch(text, REQUEST_SIGNALS);
    if (svc && ask) {
        console.log(`🎯 LEAD [${svc.line}] (service "${svc.word}" + request "${ask}")`);
        return 'approve';
    }

    // 4. Cleaning is mentioned but nobody is obviously asking — defer to the LLM
    //    when a key is configured, otherwise stay silent rather than guess.
    if (svc) {
        if (process.env.GEMINI_API_KEY) {
            console.log(`🤔 Mentions ${svc.line} service "${svc.word}" with no clear request — sending to Gemini...`);
            return 'unsure';
        }
        console.log(`➖ Mentions "${svc.word}" but no request signal and no GEMINI_API_KEY — skipping.`);
        return 'reject';
    }

    return 'reject';
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
 * Page chrome that proves we captured the feed/shell instead of one post.
 * Seen in production: notification leads whose stored text began
 * "Create a post / What's on your mind, Ilse? / Stories / Facebook x100".
 */
const PAGE_CHROME_MARKERS = [
    "what's on your mind",
    'create a post',
    'create story',
    'feed posts',
];

/** A blob is page chrome if it carries a shell marker or repeats "Facebook". */
function looksLikePageChrome(text: string): boolean {
    const t = (text || '').toLowerCase();
    if (PAGE_CHROME_MARKERS.some(m => t.includes(m))) return true;
    return (t.match(/facebook/g) || []).length >= 8;
}

/**
 * Cleanly extracts ONLY the main post body from a Facebook post container,
 * strictly excluding any comments, comment forms, toolbars, and nested articles.
 */
async function extractMainPostBody(postLocator: Locator | any): Promise<string> {
    try {
        // 1. Direct message selector check (Facebook's official post message attributes)
        const msgLocator = postLocator.locator('[data-ad-preview="message"], [data-ad-comet-preview="message"]').first();
        const count = await msgLocator.count().catch(() => 0);
        if (count > 0) {
            const msgText = (await msgLocator.innerText({ timeout: 2500 }).catch(() => '')).trim();
            if (msgText && msgText.length >= 15 && !looksLikePageChrome(msgText)) {
                return msgText;
            }
        }

        // 2. Fallback DOM evaluation: clone the article node and remove all comment nodes, forms, toolbars
        const pureText = await postLocator.evaluate((article: HTMLElement) => {
            const msg = article.querySelector('[data-ad-preview="message"], [data-ad-comet-preview="message"]');
            if (msg && (msg as HTMLElement).innerText.trim().length >= 15) {
                return (msg as HTMLElement).innerText.trim();
            }

            const clone = article.cloneNode(true) as HTMLElement;
            // Remove nested comments, comment inputs, toolbars, and interaction bars
            const removeSelectors = [
                '[role="article"]', // nested comments
                'form', // comment inputs
                'ul', // comment threads
                '[role="toolbar"]', // like/comment/share action bar
                '[aria-label*="Comment" i]',
                '[aria-label*="Like" i]',
                '[aria-label*="Share" i]',
                'div[role="feed"]'
            ];
            removeSelectors.forEach(sel => {
                clone.querySelectorAll(sel).forEach(n => n.remove());
            });
            return clone.innerText.trim();
        }).catch(() => '');

        if (pureText && pureText.length >= 15 && !looksLikePageChrome(pureText)) {
            return pureText;
        }

        // 3. Fallback to basic text if nothing else worked
        const fallback = (await postLocator.innerText({ timeout: 2000 }).catch(() => '')).trim();
        return looksLikePageChrome(fallback) ? '' : fallback;
    } catch {
        return '';
    }
}

/**
 * Read the text of the TARGET post only — never the surrounding page.
 */
async function readTargetPostText(page: any): Promise<string> {
    const postLoc = page.locator('[role="article"]').first();
    if (await postLoc.count().catch(() => 0) > 0) {
        const text = await extractMainPostBody(postLoc);
        if (text && text.length >= 15 && !looksLikePageChrome(text)) {
            return text;
        }
    }
    
    // Direct message fallback
    const msgLoc = page.locator('[data-ad-preview="message"], [data-ad-comet-preview="message"]').first();
    if (await msgLoc.count().catch(() => 0) > 0) {
        const msg = (await msgLoc.innerText({ timeout: 2000 }).catch(() => '')).trim();
        if (msg && msg.length >= 15 && !looksLikePageChrome(msg)) return msg;
    }

    return '';
}

/**
 * Capture and upload screenshot to Supabase Storage
 */
async function captureProof(page: any, fileName: string) {
    try {
        const screenshot = await page.screenshot({ fullPage: false, timeout: 8000 });
        const filePath = `proofs/${Date.now()}_${fileName}.png`;
        
        const { error } = await supabase.storage
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
 * 100% Accurate AI Evaluator using Google Gemini
 */
async function evaluatePostWithAI(postText: string): Promise<boolean> {
    try {
        console.log("🧠 Evaluating post via Google Gemini AI...");
        if (!process.env.GEMINI_API_KEY) {
            console.warn("⚠️ GEMINI_API_KEY missing! Falling back to basic keyword check.");
            return postText.toLowerCase().includes('clean');
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // Using gemini-3.6-flash for speed and low cost
        const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

        const prompt = `You are a highly intelligent lead generation assistant for a residential cleaning company.
Your job is to read Facebook posts and determine if the author is asking for a cleaner or cleaning services.

Reply with EXACTLY ONE WORD: "YES" if they are asking for a cleaner/cleaning service, or "NO" if they are not.

Examples of YES:
- "Can anyone recommend a good bond cleaner?"
- "Need someone to clean my 4 bedroom house this weekend."
- "Looking for a reliable cleaner in Southport."
- "Anyone free to do an end of lease clean?"

Examples of NO (False Positives):
- "Cleaning out my closet, selling clothes!"
- "I run a cleaning business and have capacity."
- "My dog is so clean after his bath!"
- "Does anyone know how to clean a suede couch?"
- "Hi I am a cleaner looking for work."

Post text to evaluate:
"${postText}"`;

        const result = await model.generateContent(prompt);
        const response = result.response.text().trim().toUpperCase();
        
        console.log(`🧠 Gemini Evaluation Result: ${response}`);
        return response.includes("YES");
    } catch (e) {
        console.error("❌ Gemini API failed:", e);
        return postText.toLowerCase().includes('clean');
    }
}

/**
 * Facebook rejects sessions coming from datacenter IPs (the Oracle VPS): the
 * c_user/xs cookies get stripped on the first page load and password logins are
 * bounced to a broken two-step page. A residential proxy (or a reverse SSH
 * tunnel from a home machine: `ssh -N -R 1080 deploy@<vps>` then
 * PROXY_SERVER=socks5://127.0.0.1:1080) is the only reliable fix, so EVERY
 * browser the bot opens must go through it — including the account-3 booster.
 */
function resolveProxy(): { server: string; username?: string; password?: string } | null {
    const proxyServer = process.env.PROXY_SERVER;
    if (!proxyServer) return null;
    let server = proxyServer;
    let username = process.env.PROXY_USERNAME;
    let password = process.env.PROXY_PASSWORD;
    // Chromium refuses credentials embedded in the proxy URL (ERR_INVALID_AUTH_CREDENTIALS),
    // so always hand Playwright a bare server plus separate username/password fields.
    if (server.includes('@')) {
        const [scheme, rest] = server.split('://');
        if (!scheme || !rest) return { server };
        const at = rest.lastIndexOf('@');
        const creds = rest.slice(0, at);
        const host = rest.slice(at + 1);
        const sep = creds.indexOf(':');
        if (!username) username = decodeURIComponent(sep === -1 ? creds : creds.slice(0, sep));
        if (!password && sep !== -1) password = decodeURIComponent(creds.slice(sep + 1));
        server = `${scheme}://${host}`;
    }
    return {
        server,
        ...(username ? { username } : {}),
        ...(password ? { password } : {}),
    };
}

async function postWebsiteUrlBoosterReply(groupUrl: string, postId: string) {
    console.log("🌐 Triggering Account 3 Website URL Booster comment...");
    const boosterRule = loadAccountRules().find(r => r.role === 'url_drop');
    if (boosterRule && !boosterRule.enabled) {
        console.log("⏸️ Website Booster disabled in accounts.config.json — skipping URL drop.");
        return;
    }
    if (boosterRule && !(await accountMayComment(boosterRule.email, 'Website Booster'))) return;
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

        const boosterProxy = resolveProxy();
        if (boosterProxy) console.log(`🌐 Booster using proxy: ${boosterProxy.server} (user ${boosterProxy.username ?? "none"})`);
        else console.warn("⚠️ Booster running WITHOUT a proxy — Facebook usually strips datacenter sessions.");
        const boosterBrowser = await chromium.launch({
            // Match the main bot: headless Chromium is trivially fingerprinted
            // by Facebook. The service already provides an X display via xvfb-run.
            headless: process.env.HEADLESS !== 'false',
            args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
            ...(boosterProxy ? { proxy: boosterProxy } : {}),
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
        await boosterContext.route('**/*', (route: any) => {
            const type = route.request().resourceType();
            if (['image', 'font', 'media'].includes(type)) {
                return route.abort();
            }
            return route.continue();
        });

        const isNumericId = /^\d+$/.test(String(postId));
        let targetUrl = groupUrl;
        if (isNumericId) {
            if (groupUrl.includes('/share/g/')) {
                await boosterPage.goto(groupUrl, { waitUntil: 'commit', timeout: 30000 });
                await new Promise(r => setTimeout(r, 1500));
                const resolvedUrl = new URL(boosterPage.url());
                targetUrl = `${resolvedUrl.origin}${resolvedUrl.pathname.replace(/\/$/, '')}/posts/${postId}`;
            } else {
                targetUrl = `${(groupUrl.split('?')[0] ?? groupUrl).replace(/\/$/, '')}/posts/${postId}`;
            }
        }

        console.log(`🌐 Booster landing on URL: ${targetUrl.slice(0, 90)}`);
        await boosterPage.goto(targetUrl, { waitUntil: 'commit', timeout: NAV_TIMEOUT_MS });
        await new Promise(r => setTimeout(r, 500));

        const boosterCommentText = urlDropTemplate();

        const commentPlaceholder = boosterPage.locator(
            '[aria-label*="Write a comment" i], ' +
            '[aria-label*="Leave a comment" i], ' +
            '[data-lexical-editor], ' +
            '[contenteditable]'
        ).first();
        await commentPlaceholder.click({ timeout: 3000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 500));

        const commentInput = boosterPage.locator(
            '[contenteditable="true"][aria-label*="comment" i], ' +
            '[role="textbox"][aria-label*="comment" i], ' +
            '[contenteditable="true"]'
        ).first();

        if (await commentInput.isVisible({ timeout: 5000 })) {
            await commentInput.click({ force: true }).catch(() => {});
            await boosterPage.keyboard.insertText(boosterCommentText);
            await boosterPage.keyboard.press('Enter');
            console.log(`✅ Account 3 Website URL booster comment posted on post ${postId}!`);

            const boosterProof = await boosterPage.evaluate(() => {
                const a = Array.from(document.querySelectorAll('a[href*="comment_id="]'))
                    .map(el => (el as HTMLAnchorElement).href);
                const last = a[a.length - 1];
                return last ? (last.split('&__cft')[0] || last) : '';
            }).catch(() => '');
            await supabase.from('replies_log').insert({
                post_id: postId,
                group_url: groupUrl,
                comment_id: `booster_${boosterProof || targetUrl}`,
                user_profile_id: 'Website Booster',
                replied_at: new Date()
            });
        } else {
            console.warn(`⚠️ Booster comment box not found on post ${postId}.`);
        }
        await boosterContext.close();
        await boosterBrowser.close();
    } catch (e: any) {
        console.error("⚠️ Failed Account 3 booster comment:", e.message);
    }
}

async function scanFacebookNotifications(page: any): Promise<string[]> {
    console.log("🔔 Scanning Facebook Notifications for new group posts...");
    const postUrls: string[] = [];
    try {
        await page.goto("https://www.facebook.com/notifications", { waitUntil: 'commit', timeout: NAV_TIMEOUT_MS });
        await new Promise(r => setTimeout(r, 4000));
        
        // Wait for notification list
        await page.waitForSelector('[role="main"]', { timeout: 10000 }).catch(() => {});
        
        // Scroll a few times to load recent notifications
        for(let i=0; i<3; i++) {
            await page.mouse.wheel(0, 1000);
            await new Promise(r => setTimeout(r, 1000));
        }

        // Find notification elements. Often they are links.
        const links = await page.locator('a[href*="/groups/"]').all();
        for (const link of links) {
            const href = await link.getAttribute('href').catch(() => null);
            if (href && href.includes('/groups/') && (href.includes('/posts/') || href.includes('/permalink/') || href.includes('multi_permalinks='))) {
                let cleanUrl = href;
                if (cleanUrl.startsWith('/')) {
                    cleanUrl = `https://www.facebook.com${cleanUrl}`;
                }
                const urlObj = new URL(cleanUrl);
                const multiPermalinks = urlObj.searchParams.get('multi_permalinks');
                urlObj.search = ''; // remove tracking params like notif_id
                if (multiPermalinks) {
                    urlObj.searchParams.set('multi_permalinks', multiPermalinks);
                }
                const finalUrl = urlObj.toString();
                if (!postUrls.includes(finalUrl)) {
                    postUrls.push(finalUrl);
                }
            }
        }
        console.log(`🔔 Found ${postUrls.length} recent group post URLs from notifications.`);
    } catch (e: any) {
        console.error("⚠️ Failed to scan notifications:", e.message);
    }
    return postUrls;
}

/**
 * Writes a liveness beacon to Supabase so the Vercel dashboard can show a REAL
 * health state instead of a hardcoded "24/7" badge. Uses the sessions table
 * (no schema change / DDL needed) under the reserved key __heartbeat__.
 */
/**
 * How old an approved lead may be before the bot refuses to act on it.
 * A cleaning request from days ago has already been served, and the queue still
 * contains rows captured before the scraper was fixed.
 */
const loggedStaleLeads = new Set<string>();
const STALE_LEAD_MS = Number(process.env.STALE_LEAD_HOURS || 336) * 3600 * 1000; // 14 days (2 weeks)

const HEARTBEAT_KEY = '__heartbeat__';

/**
 * Real per-account login outcomes, published in the heartbeat.
 *
 * The dashboard used to mark a profile "Connected" whenever a cookie row
 * existed, so two dead sessions showed green all morning while the bot was
 * looping on "the saved session is dead". Cookie rows prove nothing; only a
 * verified login does.
 */
const loginState: Record<string, { ok: boolean; at: string; reason?: string }> = {};
function recordLoginResult(email: string, ok: boolean, reason?: string) {
    loginState[email] = { ok, at: new Date().toISOString(), ...(reason ? { reason } : {}) };
}

async function writeHeartbeat(extra: Record<string, any> = {}) {
    try {
        await supabase.from('sessions').upsert({
            user_email: HEARTBEAT_KEY,
            cookies: [{
                ts: new Date().toISOString(),
                host: process.env.HOSTNAME || 'vps',
                mode: DRY_RUN ? 'dry_run' : 'live',
                cycles: cycleCount,
                running: isRunning,
                interval_seconds: SCAN_INTERVAL / 1000,
                logins: loginState,
                accounts: loadAccountRules().map(r => ({
                    label: r.label, email: r.email, role: r.role,
                    template: r.template,
                    maxCommentsPerDay: r.maxCommentsPerDay,
                    minMinutesBetweenComments: r.minMinutesBetweenComments,
                })),
                ...extra,
            }],
            updated_at: new Date(),
        });
    } catch (e: any) {
        console.error("\u26a0\ufe0f Heartbeat write failed:", e.message);
    }
}

/**
 * PHASE 2 — patrol the target groups directly.
 * Notification scraping alone only ever sees posts Facebook chooses to notify
 * about, so the 104 configured groups were effectively unmonitored. This walks
 * a rotating slice of active groups each cycle, classifies posts, and queues
 * matches as approved leads for the next execute phase.
 */
/**
 * Leads discovered during the current cycle. When a sweep turns something up we
 * do NOT want to sit out the full rest hour before commenting on it — a
 * cleaning request goes cold fast. The scheduler shortens the rest to a couple
 * of minutes so the next cycle's PHASE 1 actions the fresh leads immediately.
 */
let newLeadsThisCycle = 0;
/** Feed-first discovery; set FEED_MODE=0 to fall back to per-group sweeping. */
const FEED_MODE = process.env.FEED_MODE !== '0';
let lastSweepDate = '';
let groupCursor = 0;
const groupCursorFile = path.join(__dirname, 'group_cursor.txt');
try {
    if (fs.existsSync(groupCursorFile)) groupCursor = parseInt(fs.readFileSync(groupCursorFile, 'utf8').trim()) || 0;
} catch { /* ignore */ }


/**
 * PRIMARY DISCOVERY — the combined groups feed.
 *
 * Walking 104 group pages one at a time took 3-4 hours a lap over the home
 * exit node, so a cleaning request could sit unanswered for most of a day.
 * facebook.com/groups/feed/ streams recent posts from every joined group in a
 * single page, which turns a 3-hour lap into a ~2-minute poll. Posts are
 * classified and commented on immediately, so discovery-to-comment is under a
 * minute. The per-group sweep still runs, but only as a nightly backstop for
 * anything Facebook's ranking hid from this feed.
 */
async function scanGroupsFeed(page: any, fbEmail?: string) {
    const scrolls = parseInt(process.env.FEED_SCROLLS || '15');
    console.log(`\ud83d\udcf0 FEED: polling the combined groups feed (${scrolls} scrolls)...`);

    const ok = await gotoWithRetry(page, 'https://www.facebook.com/groups/feed/', 'groups feed', 3);
    if (!ok) { console.warn('   \u23ed\ufe0f Groups feed would not load through the proxy this pass.'); return; }
    await randomDelay(2500, 5000);

    // The feed hydrates slowly over the home exit node: the first poll read 0
    // posts because the articles had not mounted inside the old 20s wait. Poll
    // for real content, nudging the page, before giving up.
    let mounted = 0;
    for (let wait = 0; wait < 12 && mounted === 0; wait++) {
        mounted = await page.locator('[role="article"]').count().catch(() => 0);
        if (mounted === 0) {
            await page.mouse.wheel(0, 600).catch(() => {});
            await new Promise(r => setTimeout(r, 5000));
        }
    }
    if (mounted === 0) {
        const u = page.url();
        const t = await page.title().catch(() => '?');
        console.warn(`   \u26a0\ufe0f Feed rendered no posts (url: ${u.slice(0, 70)} | title: ${t.slice(0, 40)}).`);
        return;
    }
    console.log(`   \ud83d\udcf0 Feed mounted with ${mounted} post(s) visible; scrolling for more.`);

    // Anything already queued or already answered is not news.
    const { data: postedReplies } = await supabase.from('replies_log').select('post_id, comment_id');
    const seen = new Set(realReplies(postedReplies).map((r: any) => String(r.post_id)));
    const { data: knownLeads } = await supabase.from('leads').select('post_id');
    for (const l of knownLeads || []) seen.add(String(l.post_id));

    let found = 0;
    let scanned = 0;
    for (let scroll = 0; scroll < scrolls; scroll++) {
        const posts = page.locator('[role="article"]');
        const count = Math.min(await posts.count().catch(() => 0), 30);
        for (let i = 0; i < count; i++) {
            const el = posts.nth(i);
            const text = await extractMainPostBody(el);
            if (!text || text.length < 25) continue;
            scanned++;

            const decision = quickKeywordFilter(text);
            let isLead = decision === 'approve';
            if (decision === 'unsure') isLead = await evaluatePostWithAI(text);
            if (!isLead) continue;

            // Which group did this come from? The feed puts the group link in
            // the post header; without it there is no permalink to comment on.
            let groupUrl = '';
            try {
                const href = await el.locator('a[href*="/groups/"]').first().getAttribute('href', { timeout: 2000 });
                const m = href?.match(/\/groups\/([^/?#]+)/);
                if (m) groupUrl = `https://www.facebook.com/groups/${m[1]}`;
            } catch { /* header link missing */ }
            if (!groupUrl) { console.log('   \u26a0\ufe0f Feed post has no group link — skipping.'); continue; }

            const postId = await extractFacebookPostId(el);
            if (!postId) { console.log('   \u26a0\ufe0f Feed post has no permalink id — skipping.'); continue; }
            if (seen.has(String(postId))) continue;
            seen.add(String(postId));

            console.log(`\ud83c\udfaf FEED LEAD ${postId} in ${groupUrl.slice(0, 60)} — queued as approved.`);
            const { error } = await supabase.from('leads').insert({
                post_id: postId,
                group_url: groupUrl,
                post_text: text.slice(0, 4000),
                status: 'approved',
            });
            if (error) { console.log(`   \u26a0\ufe0f lead insert: ${error.message}`); continue; }
            newLeadsThisCycle++;
            found++;

            // Comment on it right now, while it is minutes old.
            if (fbEmail && BOT_ROLE !== 'scout') {
                try {
                    await executeApprovedLeads(page, fbEmail);
                } catch (e: any) {
                    console.error(`   \u26a0\ufe0f Immediate comment pass failed: ${e.message?.slice(0, 120)}`);
                }
                // executeApprovedLeads navigates away; come back to the feed.
                await gotoWithRetry(page, 'https://www.facebook.com/groups/feed/', 'groups feed', 2);
                await randomDelay(2000, 4000);
            }
        }
        await page.mouse.wheel(0, 1600).catch(() => {});
        await randomDelay(1800, 4000);
    }
    console.log(`\ud83d\udcf0 FEED: ${scanned} post(s) read, ${found} new lead(s).`);
}

async function patrolGroups(page: any, fbEmail?: string) {
    let executedUpTo = 0;
    const perCycle = parseInt(process.env.GROUPS_PER_CYCLE || '999');
    if (perCycle <= 0) { console.log("\u23ed\ufe0f Group patrol disabled (GROUPS_PER_CYCLE=0)."); return; }

    let groups: string[] = [];
    try {
        const { data } = await supabase.from('groups').select('url, is_active');
        groups = (data || []).filter((g: any) => g.is_active !== false).map((g: any) => g.url).filter(Boolean);
    } catch (e: any) {
        console.error("\u26a0\ufe0f Could not load groups from Supabase:", e.message);
    }
    if (groups.length === 0) {
        try {
            groups = JSON.parse(fs.readFileSync(path.join(__dirname, 'target_groups.json'), 'utf8'));
        } catch { /* ignore */ }
    }
    if (groups.length === 0) { console.log("\u26a0\ufe0f No target groups configured — skipping patrol."); return; }

    const slice: string[] = [];
    for (let i = 0; i < Math.min(perCycle, groups.length); i++) {
        slice.push(groups[(groupCursor + i) % groups.length]!);
    }
    // The cursor used to advance only once a full 104-group lap finished. The
    // process never survived a whole lap, so it rewound to the same start
    // point forever and only ever saw the first few groups. Save per group.
    const startCursor = groupCursor;
    const saveCursor = (v: number) => {
        groupCursor = ((v % groups.length) + groups.length) % groups.length;
        try { fs.writeFileSync(groupCursorFile, String(groupCursor), 'utf8'); } catch { /* ignore */ }
    };

    console.log(`\ud83d\udd0d PHASE 2: Patrolling ${slice.length}/${groups.length} groups (cursor now ${groupCursor})...`);

    const { data: postedReplies } = await supabase.from('replies_log').select('post_id, comment_id');
    const seen = new Set(realReplies(postedReplies).map((r: any) => String(r.post_id)));
    const { data: knownLeads } = await supabase.from('leads').select('post_id');
    for (const l of knownLeads || []) seen.add(String(l.post_id));

    for (const [gi, groupUrl] of slice.entries()) {
        try {
            console.log(`\ud83c\udfe1 Group: ${gi + 1}/${slice.length} ${groupUrl.slice(0, 80)}`);
            // Facebook's default group view is ranked, which buries exactly the
            // plain-text "can anyone recommend a cleaner?" posts we want.
            // CHRONOLOGICAL turns the ranker off and returns every post in order.
            const bare = groupUrl.split('?')[0]!.replace(/\/$/, '');
            const chronoUrl = /\/groups\/[^/]+$/.test(bare)
                ? `${bare}?sorting_setting=CHRONOLOGICAL`
                : groupUrl;
            const groupOk = await gotoWithRetry(page, chronoUrl, 'group', 3);
            if (!groupOk) { console.warn(`   \u23ed\ufe0f Skipping ${groupUrl.slice(0, 60)} — proxy would not carry it.`); continue; }
            await randomDelay(2500, 5000);
            await page.waitForSelector('[role="feed"], [role="article"]', { timeout: 12000 }).catch(() => {});

            let lastArticleCount = -1;
            for (let scroll = 0; scroll < 3; scroll++) {
                const posts = page.locator('[role="article"]');
                const count = Math.min(await posts.count().catch(() => 0), 25);
                for (let i = 0; i < count; i++) {
                    const el = posts.nth(i);
                    const text = await extractMainPostBody(el);
                    if (!text || text.length < 25) continue;

                    const decision = quickKeywordFilter(text);
                    let isLead = decision === 'approve';
                    if (decision === 'unsure') isLead = await evaluatePostWithAI(text);
                    if (!isLead) continue;

                    let postId = await extractFacebookPostId(el);
                    if (!postId) {
                        postId = `hash_${text.replace(/[\W_]+/g, '').toLowerCase().substring(0, 40)}`;
                    }
                    if (seen.has(String(postId))) continue;
                    seen.add(String(postId));

                    console.log(`\ud83c\udfaf PATROL LEAD ${postId} — queued as approved.`);
                    const { error } = await supabase.from('leads').insert({
                        post_id: postId,
                        group_url: groupUrl,
                        post_text: text.slice(0, 4000),
                        status: 'approved',
                    });
                    if (error) console.log(`   \u26a0\ufe0f lead insert: ${error.message}`);
                    else newLeadsThisCycle++;
                }
                // A scroll that reveals no new article means the end of the
                // chronological page -- keep scrolling and we just burn time.
                if (count === lastArticleCount) break;
                lastArticleCount = count;
                await page.mouse.wheel(0, 1400).catch(() => {});
                await randomDelay(1800, 4000);
            }
            await randomDelay(4000, 9000); // pace between groups

            // Comment on anything this group just produced, immediately, rather
            // than at the end of a multi-hour sweep.
            if (fbEmail && BOT_ROLE !== 'scout' && newLeadsThisCycle > executedUpTo) {
                console.log(`\u26a1 ${newLeadsThisCycle - executedUpTo} new lead(s) from this group — commenting now, mid-sweep.`);
                executedUpTo = newLeadsThisCycle;
                try {
                    await executeApprovedLeads(page, fbEmail);
                } catch (e: any) {
                    console.error(`\u26a0\ufe0f Mid-sweep comment pass failed: ${e.message?.slice(0, 120)}`);
                }
            }
        } catch (e: any) {
            console.error(`\u26a0\ufe0f Patrol error on ${groupUrl.slice(0, 60)}: ${e.message?.slice(0, 100)}`);
        } finally {
            saveCursor(startCursor + gi + 1);
        }
    }
    console.log("\u2705 PHASE 2 patrol complete.");
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3 — SEARCH PATROL
//
// Notifications and feed scrolling only ever surface whatever Facebook decides
// to show. That is why bond-clean requests were being missed almost entirely:
// the feed was full of competitor ads while real "need a bond clean" posts
// scrolled past unseen. This phase searches each group directly for the four
// service lines, which is the only reliable way to find people asking.
// ─────────────────────────────────────────────────────────────────────────────

/** Search terms rotated through group search, grouped by service line. */
const SEARCH_TERMS: string[] = [
    'cleaner',
    'cleaners',
    'bond clean',
    'bond cleaner',
    'end of lease clean',
    'vacate clean',
    'carpet cleaning',
    'house cleaner',
    'house cleaning',
    'cleaner recommendation',
    'looking for a cleaner',
    'need a cleaner',
    'cleaner needed',
    'domestic cleaner',
    'office cleaning',
];

let searchCursor = 0;
const searchCursorFile = path.join(__dirname, '.search_cursor');
try { searchCursor = parseInt(fs.readFileSync(searchCursorFile, 'utf8')) || 0; } catch { /* first run */ }

/**
 * Reject search hits that are obviously old. Facebook renders a relative
 * timestamp in the post header ("3 d", "12 w", "2 y"); anything older than
 * ~8 weeks is a stale request that has long since been filled.
 */
function looksTooOld(articleText: string): boolean {
    const head = articleText.slice(0, 220);
    if (/\b(\d+)\s*y\b/i.test(head)) return true;
    const weeks = head.match(/\b(\d+)\s*w\b/i);
    if (weeks && parseInt(weeks[1] ?? '0') > 2) return true; // max 2 weeks
    const months = head.match(/\b(\d+)\s*(mo|months?)\b/i);
    if (months) return true;
    return false;
}

/**
 * ~1 in 5 saved groups is a facebook.com/share/g/XXXX link. Those redirect fine
 * in a browser but have no /search/ endpoint, so appending one returns
 * "Not Found". Resolve them to the canonical /groups/<id> form once and cache.
 */
const canonicalGroupCache = new Map<string, string | null>();

async function resolveGroupUrl(page: any, url: string): Promise<string | null> {
    const base = (url.split('?')[0] ?? url).replace(/\/$/, '');
    if (/\/groups\/[^/]+$/.test(base)) return base;
    if (canonicalGroupCache.has(base)) return canonicalGroupCache.get(base) ?? null;

    let resolved: string | null = null;
    try {
        await page.goto(base, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
        // Share links bounce through a client-side redirect, so the URL right
        // after load is still /share/g/... — wait for the real one to appear.
        await page.waitForURL(/facebook\.com\/groups\//, { timeout: 20000 }).catch(() => {});
        let m = String(page.url()).match(/facebook\.com\/groups\/([^/?#]+)/);
        if (!m) {
            // Fallback: the canonical group id is in og:url / canonical link.
            const href = await page.evaluate(() => {
                const meta = document.querySelector('meta[property="og:url"]') as HTMLMetaElement | null;
                const canon = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
                const anchor = document.querySelector('a[href*="/groups/"]') as HTMLAnchorElement | null;
                return meta?.content || canon?.href || anchor?.href || '';
            }).catch(() => '');
            m = String(href).match(/facebook\.com\/groups\/([^/?#]+)/);
        }
        if (m && m[1] && m[1] !== 'feed') resolved = `https://www.facebook.com/groups/${m[1]}`;
    } catch { /* leave unresolved */ }

    canonicalGroupCache.set(base, resolved);
    if (!resolved) console.log(`   \u26a0\ufe0f Could not resolve share link to a group id: ${base.slice(-30)}`);
    return resolved;
}

/** Cheap mid-cycle check — Facebook drops you to /login the moment a session dies. */
async function sessionStillAlive(page: any): Promise<boolean> {
    const u = String(page.url());
    if (/\/login\b|login\.php|\/checkpoint\//.test(u)) {
        console.error("\ud83d\udea8 Session died mid-cycle (redirected to login) — aborting this phase.");
        return false;
    }
    return true;
}

async function searchGroupsForLeads(page: any, fbEmail?: string) {
    const groupsPerCycle = parseInt(process.env.SEARCH_GROUPS_PER_CYCLE || '12');
    const termsPerCycle = parseInt(process.env.SEARCH_TERMS_PER_CYCLE || '4');
    if (groupsPerCycle <= 0 || termsPerCycle <= 0) {
        console.log("⏭️ Search patrol disabled.");
        return;
    }

    let groups: string[] = [];
    try {
        const { data } = await supabase.from('groups').select('url, is_active');
        groups = (data || []).filter((g: any) => g.is_active !== false).map((g: any) => g.url).filter(Boolean);
    } catch (e: any) {
        console.error("⚠️ Could not load groups for search:", e.message);
    }
    if (groups.length === 0) { console.log("⚠️ No groups to search."); return; }

    // Rotate through groups and terms so every combination is covered over time.
    const groupSlice: string[] = [];
    for (let i = 0; i < Math.min(groupsPerCycle, groups.length); i++) {
        groupSlice.push(groups[(searchCursor + i) % groups.length]!);
    }
    const termSlice: string[] = [];
    const termOffset = Math.floor(searchCursor / Math.max(groups.length, 1)) % SEARCH_TERMS.length;
    for (let i = 0; i < Math.min(termsPerCycle, SEARCH_TERMS.length); i++) {
        termSlice.push(SEARCH_TERMS[(termOffset + i) % SEARCH_TERMS.length]!);
    }
    searchCursor = (searchCursor + groupSlice.length) % (groups.length * SEARCH_TERMS.length || 1);
    try { fs.writeFileSync(searchCursorFile, String(searchCursor), 'utf8'); } catch { /* ignore */ }

    console.log(`🔎 PHASE 3: Searching ${groupSlice.length} groups for [${termSlice.join(', ')}]...`);

    const { data: postedReplies } = await supabase.from('replies_log').select('post_id, comment_id');
    const seen = new Set(realReplies(postedReplies).map((r: any) => String(r.post_id)));
    const { data: knownLeads } = await supabase.from('leads').select('post_id');
    for (const l of knownLeads || []) seen.add(String(l.post_id));

    let found = 0;
    for (const groupUrl of groupSlice) {
        const base = await resolveGroupUrl(page, groupUrl);
        if (!base) continue;
        for (const term of termSlice) {
            const searchUrl = `${base}/search/?q=${encodeURIComponent(term)}`;
            try {
                await page.goto(searchUrl, { waitUntil: 'commit', timeout: 30000 });
                await randomDelay(3000, 6000);
                if (!await sessionStillAlive(page)) return;
                await page.waitForSelector('[role="article"]', { timeout: 12000 }).catch(() => {});

                const posts = page.locator('[role="article"]');
                const total = await posts.count().catch(() => 0);
                const count = Math.min(total, 15);
                console.log(`   • "${term}" in ${base.slice(0, 45)} → ${total} result(s)`);
                for (let i = 0; i < count; i++) {
                    const el = posts.nth(i);
                    const text = await extractMainPostBody(el);
                    if (!text || text.length < 25) continue;
                    if (looksTooOld(text)) continue;

                    const decision = quickKeywordFilter(text);
                    let isLead = decision === 'approve';
                    if (decision === 'unsure') isLead = await evaluatePostWithAI(text);
                    if (!isLead) continue;

                    let postId = await extractFacebookPostId(el);
                    if (!postId) postId = `hash_${text.replace(/[\W_]+/g, '').toLowerCase().substring(0, 40)}`;
                    if (seen.has(String(postId))) continue;
                    seen.add(String(postId));

                    found++;
                    console.log(`🎯 SEARCH LEAD "${term}" → ${postId}`);
                    const { error } = await supabase.from('leads').insert({
                        post_id: postId,
                        group_url: groupUrl,
                        post_text: text.slice(0, 4000),
                        status: 'approved',
                    });
                    if (error) console.log(`   ⚠️ lead insert: ${error.message}`);
                    else newLeadsThisCycle++;

                    if (fbEmail && BOT_ROLE !== 'scout') {
                        try {
                            console.log(`⚡ Immediately commenting on search lead ${postId}...`);
                            await executeApprovedLeads(page, fbEmail);
                            await page.goto(searchUrl, { waitUntil: 'commit', timeout: NAV_TIMEOUT_MS }).catch(() => {});
                        } catch (e: any) {
                            console.error(`⚠️ Search comment pass failed: ${e.message?.slice(0, 120)}`);
                        }
                    }
                    if (error) console.log(`   \u26a0\ufe0f lead insert: ${error.message}`);
                    else newLeadsThisCycle++;
                }
            } catch (e: any) {
                console.error(`\u26a0\ufe0f Search error (${term}): ${e.message?.slice(0, 90)}`);
            }
            await randomDelay(5000, 11000); // pace searches — this is the risky surface
        }
    }
    console.log(`\u2705 PHASE 3 search complete — ${found} new lead(s).`);
}


/**
 * PHASE 1 — act on approved leads.
 *
 * Extracted from runBot so the group sweep can call it mid-sweep. A sweep of
 * 104 groups takes hours over the home exit node; waiting for it to finish
 * before commenting meant a cleaning request sat untouched for most of a day.
 * Now the patrol calls this as soon as it finds something, and the per-account
 * throttles in accounts.config.json do the pacing.
 */
async function executeApprovedLeads(page: any, fbEmail: string) {
        // PHASE 1: Execute leads (auto-approved by Gemini/Groq, zero human input needed)
        const { data: rawLeads } = await supabase.from('leads').select('*').eq('status', 'approved');
        
        // Fetch replies_log to filter out already executed leads (RLS update proof)
        const { data: postedReplies } = await supabase.from('replies_log').select('post_id, comment_id');
        const repliedPostIds = new Set(realReplies(postedReplies).map((r: any) => String(r.post_id)));

        const approvedLeads = (rawLeads || []).filter(lead => {
            if (liveRejectedLeads.has(String(lead.post_id))) return false; // already judged live and rejected
            const isAlreadyReplied = repliedPostIds.has(String(lead.post_id));
            if (isAlreadyReplied) {
                console.log(`⏭️ Lead ${lead.post_id} already has a logged reply in replies_log. Skipping execution.`);
                return false;
            }
            // Re-validate against the CURRENT classifier before commenting. The
            // anon key cannot UPDATE leads (RLS is insert/select only), so old
            // rows keep whatever status they were given by an older, looser
            // filter — including competitor ads and recruitment posts. Without
            // this guard the bot would comment on all of them.
            const leadText = lead.post_text || '';

            // Guard 1: rows captured by the old whole-page scrape hold Facebook's
            // own navigation blob, not a request. Never comment on those.
            if (looksLikePageChrome(leadText)) {
                console.log(`🔎 Lead ${lead.post_id} stored page chrome — will re-read the real post before deciding.`);
                (lead as any).__needsLiveCheck = true;
                return true;
            }

            // Guard 2: some rows captured a COMMENT on the post ("Name · 3h … Reply
            // Share") rather than the post itself. Acting on those meant replying
            // under a competitor's advertisement because a commenter said
            // "I need cleaner". The post is not the lead, so skip it.
            if (/\bReply\b[\s|]*\bShare\b\s*$/i.test(leadText.trim())) {
                console.log(`🔎 Lead ${lead.post_id} captured a comment, not the post — will re-read the real post before deciding.`);
                (lead as any).__needsLiveCheck = true;
                return true;
            }

            // Guard 3: age. A request from days ago is already served, and the
            // queue still holds rows from before the scraper was fixed.
            const createdAt = lead.created_at ? new Date(lead.created_at).getTime() : 0;
            if (createdAt && Date.now() - createdAt > STALE_LEAD_MS) {
                // These rows can never be cleared: the anon key has no UPDATE on
                // `leads`, so they come back every cycle. Log each one once and
                // then stay quiet instead of reprinting the same wall of text.
                if (!loggedStaleLeads.has(String(lead.post_id))) {
                    loggedStaleLeads.add(String(lead.post_id));
                    const hrs = ((Date.now() - createdAt) / 3600000).toFixed(0);
                    console.log(`🛑 Lead ${lead.post_id} is ${hrs}h old (limit ${STALE_LEAD_MS / 3600000}h) — skipping stale lead.`);
                }
                return false;
            }

            if ((lead as any).__needsLiveCheck) return true; // stored text is junk; judged live instead
            const verdict = quickKeywordFilter(leadText);
            if (verdict !== 'approve') {
                console.log(`🛑 Lead ${lead.post_id} no longer passes the filter (${verdict}) — skipping stale approval.`);
                return false;
            }
            return true;
        });

        // Reply text now comes from accounts.config.json via templateFor(email)
        // so each account posts its own wording (see PER-ACCOUNT TEMPLATES above).

        if (approvedLeads && approvedLeads.length > 0) {
            console.log(`✅ Found ${approvedLeads.length} approved leads to execute.`);
            for (const lead of approvedLeads) {
                try {
                    console.log(`\n🚀 Executing approved lead: ${lead.post_id}`);

                    // Per-account rules (accounts.config.json): daily cap and a
                    // minimum gap between comments. Bursts are what gets these
                    // accounts banned, so a blocked account simply waits.
                    if (!DRY_RUN && !(await accountMayComment(fbEmail))) break;
                    if (!DRY_RUN && !(await claimLead(String(lead.post_id), fbEmail))) continue;

                    const templateText = templateFor(fbEmail);
                    
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
                    
                    const isNumericId = /^\d+$/.test(String(lead.post_id));

                    if (isNumericId) {
                        // ── FAST PATH: navigate directly to the post permalink ──
                        let postUrl = '';
                        if (lead.group_url.includes('/share/g/')) {
                            console.log(`📍 Resolving share URL to group URL first...`);
                            await page.goto(lead.group_url, { waitUntil: 'commit', timeout: 30000 });
                            await new Promise(r => setTimeout(r, 1500));
                            const resolvedUrl = new URL(page.url());
                            postUrl = `${resolvedUrl.origin}${resolvedUrl.pathname.replace(/\/$/, '')}/posts/${lead.post_id}`;
                        } else {
                            postUrl = `${lead.group_url.split('?')[0].replace(/\/$/, '')}/posts/${lead.post_id}`;
                        }
                        console.log(`📍 Direct post URL: ${postUrl.slice(0, 90)}`);
                        await Promise.race([
                            page.goto(postUrl, { waitUntil: 'commit', timeout: 30000 }),
                            new Promise((_, rej) => setTimeout(() => rej(new Error('goto timeout 30s')), 32000))
                        ]);
                        const iv = (loc: any) => Promise.race([
                            loc.isVisible(),
                            new Promise<boolean>(r => setTimeout(() => r(false), 500))
                        ]);
                        await Promise.race([closeOverlays(page), new Promise(r => setTimeout(r, 3000))]);
                        await new Promise(r => setTimeout(r, 3000)); // let page render comment section

                        // Diagnostics: confirm we landed on the right page
                        const landedUrl = page.url();
                        const pageTitle = await page.title().catch(() => 'unknown');
                        console.log(`📍 Landed URL: ${landedUrl.slice(0, 90)}`);
                        console.log(`📍 Page title: ${pageTitle.slice(0, 60)}`);

                        // The stored text for this lead was a comment or page
                        // chrome, so judge the post itself now that it is open.
                        if ((lead as any).__needsLiveCheck) {
                            const liveText = await page.evaluate(() => {
                                const art = document.querySelector('[role="article"]') as HTMLElement | null;
                                return (art?.innerText || document.body?.innerText || '').slice(0, 2000);
                            }).catch(() => '');
                            const liveVerdict = quickKeywordFilter(liveText || '');
                            if (liveVerdict !== 'approve' || looksLikePageChrome(liveText || '')) {
                                console.log(`🛑 Lead ${lead.post_id}: live post text does not qualify (${liveVerdict}) — skipping for good.`);
                                rememberRejectedLead(String(lead.post_id));
                                await supabase.from('leads').insert({ post_id: lead.post_id, group_url: lead.group_url, post_text: (liveText || '').slice(0, 500), status: 'rejected' });
                                continue;
                            }
                            console.log(`✅ Lead ${lead.post_id}: live post text qualifies — proceeding.`);
                        }

                        // Count contenteditable/textbox elements for debugging
                        const ceCount = await page.locator('[contenteditable]').count().catch(() => 0);
                        const tbCount = await page.locator('[role="textbox"]').count().catch(() => 0);
                        console.log(`📍 contenteditable: ${ceCount}, textbox: ${tbCount}`);

                        // Try clicking the comment placeholder to activate the editor
                        // Facebook's real label is "Write a public comment…", which the old
                        // "Write a comment" match never hit, so the composer was never clicked.
                        const commentPlaceholder = page.locator(
                            '[aria-label*="Write a public comment" i], ' +
                            '[aria-label*="Write a comment" i], ' +
                            '[aria-label*="Leave a comment" i], ' +
                            '[aria-placeholder*="comment" i], ' +
                            '[data-lexical-editor], ' +
                            '[contenteditable]'
                        ).first();

                        // On direct post page the comment box is present in DOM
                        const commentInput = page.locator(
                            '[contenteditable="true"][aria-label*="comment" i], ' +
                            '[role="textbox"][aria-label*="comment" i], ' +
                            '[contenteditable="true"]'
                        ).first();
                        // The composer mounts late on a cold, proxied VPS and only after the
                        // placeholder is clicked. The old single 10s wait gave up on real
                        // leads, so poll and re-click for up to ~45s before conceding.
                        let inputReady = false;
                        for (let attempt = 1; attempt <= 9 && !inputReady; attempt++) {
                            await commentPlaceholder.click({ timeout: 2500 }).catch(() => {});
                            try { await commentInput.waitFor({ state: 'visible', timeout: 5000 }); } catch (e) {}
                            inputReady = await iv(commentInput);
                            if (!inputReady) {
                                console.log(`📍 Comment composer not up yet (attempt ${attempt}/9)…`);
                                await page.mouse.wheel(0, 400).catch(() => {});
                                await new Promise(r => setTimeout(r, 1500));
                            }
                        }
                        console.log(`📍 Comment input ready: ${inputReady}`);

                        if (inputReady) {
                            await commentInput.click({ timeout: 3000 }).catch(() => {});
                            console.log(`📍 Typing reply...`);
                            await typeComment(page, templateText);
                            console.log(`📍 Pressing Enter...`);
                            await page.keyboard.press('Enter');

                            const proof = await captureCommentPermalink(page, postUrl);
                            if (!proof.verified) {
                                // The comment never appeared. Record it honestly and do not
                                // fire the booster reply on a post we did not comment on.
                                console.warn(`⚠️ Comment NOT confirmed for lead ${lead.post_id} — logged unverified.`);
                                await supabase.from('replies_log').insert({
                                    post_id: lead.post_id,
                                    group_url: lead.group_url,
                                    comment_id: `unverified_${Date.now()}`,
                                    user_profile_id: fbEmail,
                                    replied_at: new Date()
                                });
                                await supabase.from('leads').update({ status: 'failed' }).eq('post_id', lead.post_id);
                                await coolDown('next lead');
                                continue;
                            }
                            const { error: replyErr } = await supabase.from('replies_log').insert({
                                post_id: lead.post_id,
                                group_url: lead.group_url,
                                // The real permalink lives here (replies_log has no
                                // comment_url column and the anon key cannot add one).
                                // The dashboard renders any http value as a clickable link.
                                comment_id: proof.url,
                                user_profile_id: fbEmail,
                                replied_at: new Date()
                            });
                            const { data: updatedLeads, error: leadErr } = await supabase
                                .from('leads')
                                .update({ status: 'posted' })
                                .eq('post_id', lead.post_id)
                                .select();
                            console.log(`✅ Comment posted! rows: ${updatedLeads?.length ?? 0}, replyErr: ${replyErr?.message || 'none'}, leadErr: ${leadErr?.message || 'none'}`);

                            await coolDown('Account 3 booster comment');
                            await postWebsiteUrlBoosterReply(lead.group_url, lead.post_id);
                            await coolDown('next lead');
                        } else {
                            console.warn(`⚠️ Comment input not found on post page for lead ${lead.post_id}. Marking status to prevent infinite loop.`);
                            await supabase.from('leads').update({ status: 'failed' }).eq('post_id', lead.post_id);
                        }
                    } else {
                        // ── SCROLL PATH: hash-based leads — navigate to group and scroll ──
                        console.log(`📍 Group page: ${lead.group_url?.slice(0, 80)}`);
                        await Promise.race([
                            page.goto(lead.group_url, { waitUntil: 'commit', timeout: 30000 }),
                            new Promise((_, rej) => setTimeout(() => rej(new Error('goto timeout 30s')), 32000))
                        ]);
                        console.log(`📍 Page committed. Waiting for feed...`);
                        await page.waitForSelector('[role="article"], div[role="feed"]', { timeout: 8000 }).catch(() => {});
                        console.log(`📍 Feed ready. Starting scroll search...`);

                        for (let scroll = 0; scroll < 5; scroll++) {
                            console.log(`📍 Scroll ${scroll + 1}/5...`);
                            await Promise.race([page.mouse.wheel(0, 1000), new Promise(r => setTimeout(r, 2000))]);
                            await new Promise(r => setTimeout(r, 500));
                            const posts = page.locator('[data-ad-preview="message"], [role="article"]');
                            let count = await posts.count();
                            if (count === 0) count = await page.locator('div[role="feed"] > div').count();
                            let found = false;

                            for (let i = 0; i < count; i++) {
                                const postText = (await posts.nth(i).innerText({ timeout: 2000 }).catch(() => '')).trim();
                                const norm = (s: string) => (s || '').toLowerCase().replace(/[\r\n\t]+/g, ' ').replace(/[^\w\s]/g, '').trim();
                                const targetSnippet = norm(lead.post_text).slice(0, 35);
                                if (targetSnippet.length > 5 && norm(postText).includes(targetSnippet)) {
                                    console.log(`🎯 Found post! Commenting via scroll path...`);
                                    await Promise.race([closeOverlays(page), new Promise(r => setTimeout(r, 3000))]);

                                    const iv = (loc: any) => Promise.race([
                                        loc.isVisible(),
                                        new Promise<boolean>(r => setTimeout(() => r(false), 500))
                                    ]);
                                    await posts.nth(i).scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
                                    await new Promise(r => setTimeout(r, 300));

                                    const commentBox = posts.nth(i).locator('[role="textbox"], [contenteditable="true"], [aria-label*="Write" i]').first();
                                    if (!(await iv(commentBox))) {
                                        const clicked = await Promise.race([
                                            posts.nth(i).evaluate((el: Element) => {
                                                const btn = el.querySelector('[aria-label*="Comment" i], span[class*="comment" i]') as HTMLElement | null;
                                                if (btn) { btn.click(); return true; }
                                                return false;
                                            }).catch(() => false),
                                            new Promise<boolean>(r => setTimeout(() => r(false), 2000))
                                        ]);
                                        console.log(`📍 JS comment btn click: ${clicked}`);
                                        await new Promise(r => setTimeout(r, 2000));
                                    }

                                    const activeBox = page.locator('[role="textbox"], [contenteditable="true"][aria-label*="comment" i], [data-lexical-editor]').first();
                                    try { await activeBox.waitFor({ state: 'visible', timeout: 10000 }); } catch(e) {}
                                    const boxReady = await iv(activeBox);
                                    console.log(`📍 activeBox ready: ${boxReady}`);

                                    if (boxReady) {
                                        // ── FINAL DOM DEDUPLICATION CHECK ──
                                        const pageText = await page.innerText('body').catch(() => '');
                                        if (pageText.includes('Fiesta Fresh Cleaning') || pageText.includes('200% Happiness Guarantee')) {
                                            console.log(`⚠️ DETECTED OWN COMMENT ON PAGE! Aborting duplicate.`);
                                            found = true; break;
                                        }

                                        await activeBox.click({ timeout: 3000 }).catch(() => {});
                                        await typeComment(page, templateText);
                                        await page.keyboard.press('Enter');

                                        const proof = await captureCommentPermalink(page, buildPostUrl(lead.group_url, lead.post_id));
                                        const { error: replyErr } = await supabase.from('replies_log').insert({
                                            post_id: lead.post_id,
                                            group_url: lead.group_url,
                                            comment_id: proof.url,
                                            user_profile_id: fbEmail,
                                            replied_at: new Date()
                                        });
                                        const { data: updatedLeads, error: leadErr } = await supabase
                                            .from('leads')
                                            .update({ status: 'posted' })
                                            .eq('post_id', lead.post_id)
                                            .select();
                                        console.log(`✅ Comment posted! rows: ${updatedLeads?.length ?? 0}, replyErr: ${replyErr?.message || 'none'}, leadErr: ${leadErr?.message || 'none'}`);
                                        found = true;

                                        await coolDown('Account 3 booster comment');
                                        await postWebsiteUrlBoosterReply(lead.group_url, lead.post_id);
                                        await coolDown('next lead');
                                        break;
                                    }
                                }
                            }
                            if (found) break;
                        }
                    }
                } catch (leadErr: any) {
                    console.warn(`⚠️ Skipping lead ${lead.post_id} due to error: ${leadErr.message?.slice(0, 100)}`);
                    continue;
                }
            }
        }
}

async function runBot(account: FbAccount): Promise<boolean> {
    console.log("🤖 Starting Fiesta Fresh Automation Bot...");
    console.log(`Mode: ${DRY_RUN ? '🧪 DRY RUN (no actual posts)' : '🔴 LIVE MODE'}`);
    console.log(`Scan Interval: ${SCAN_INTERVAL / 1000}s`);

    // Check daily 6 PM report trigger on every cycle
    await checkAndSendDailyReport();
    
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

    // One Chromium profile PER ACCOUNT. Sharing a single "FiestaSession" dir
    // made rotation a lie: switching to a second account simply reused the
    // first account's logged-in profile, so an account with zero stored
    // cookies would still report "Login verified" and comment as someone else.
    const profileSlug = fbEmail.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const userDataDir = path.join(__dirname, 'profiles', profileSlug);
    fs.mkdirSync(userDataDir, { recursive: true });
    // A killed run leaves a stale SingletonLock behind, which aborts Chromium.
    for (const lock of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
        try { fs.rmSync(path.join(userDataDir, lock), { force: true }); } catch {}
    }
    console.log(`🧠 Using Persistent Context for ${fbEmail}: ${userDataDir}`);

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
        // Headless-shell: strip GPU/images for lightweight memory usage.
        contextOptions.args.push('--disable-gpu', '--blink-settings=imagesEnabled=false');
    }
    // Headed mode: no UA override, no image suppression — a normal Linux Chrome
    // (matching its real platform) is far less suspicious than a Mac UA on Linux.

    const mainProxy = resolveProxy();
    if (mainProxy) {
        console.log(`🌐 Using Proxy: ${mainProxy.server} (user ${mainProxy.username ?? "none"})`);
        contextOptions.proxy = mainProxy;
    } else {
        // Verified Aug 2026: freshly captured cookies replay fine from this
        // datacenter IP with no proxy at all. The old "Facebook always strips
        // datacenter sessions" warning was wrong and is deliberately not logged.
        console.log("ℹ️ No proxy configured — connecting directly (verified working).");
    }

    // A Chromium that was OOM-killed leaves SingletonLock/Cookie/Socket behind
    // and the next launch blocks on them until it times out. Clear them first.
    for (const lock of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
        try { fs.rmSync(path.join(userDataDir, lock), { force: true, recursive: true }); } catch { /* nothing to clear */ }
    }

    let context: any;
    try {
        context = await chromium.launchPersistentContext(userDataDir, contextOptions);
    } catch (launchErr: any) {
        console.warn(`⚠️ Browser launch failed (${launchErr.message?.slice(0, 80)}) — killing strays and retrying once.`);
        try { require('child_process').execSync('pkill -f "chrome.*' + userDataDir.replace(/[^\w/.-]/g, '') + '" || true'); } catch { /* best effort */ }
        await new Promise(r => setTimeout(r, 10000));
        context = await chromium.launchPersistentContext(userDataDir, contextOptions);
    }

    // Block heavy downloads — we only scrape text. Cuts memory and network bandwidth massively.
    await context.route('**/*', (route: any) => {
        const type = route.request().resourceType();
        if (['image', 'font', 'media'].includes(type)) {
            return route.abort();
        }
        return route.continue();
    });

    const page: any = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

    // Restore saved session from Supabase (bypasses login/captcha if cookies are valid)
    let restoredSession = false;
    const { data: savedSession } = await supabase.from('sessions').select('cookies').eq('user_email', fbEmail).order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (savedSession?.cookies && Array.isArray(savedSession.cookies)) {

        // --- Checkpoint cookie check ---
        // If saved cookies contain 'checkpoint' but are missing 'c_user' and 'xs',
        // warn that it is locked, but continue so the verification block can run automated re-login.
        const cookieNames = savedSession.cookies.map((c: any) => c.name);
        const hasCheckpoint = cookieNames.includes('checkpoint');
        const hasAuthTokens = cookieNames.includes('c_user') && cookieNames.includes('xs');
        if (hasCheckpoint && !hasAuthTokens) {
            console.warn(`⚠️ ${fbEmail} has a Facebook CHECKPOINT cookie and is missing c_user/xs — proceeding to automated re-login verification.`);
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
        const homeOk = await gotoWithRetry(page, 'https://www.facebook.com', 'facebook.com', 4);
        if (!homeOk) {
            console.error("❌ Could not reach Facebook through the proxy after 4 attempts — ending this cycle early.");
            recordLoginResult(fbEmail, false, 'proxy unreachable');
            await context.close().catch(() => {});
            return false;
        }
        await randomDelay(3000, 5000);

        // Close overlays
        await closeOverlays(page);

        // Login check
        const loginMarkers = page.locator('#email, [name="email"], #pass, [name="pass"]');

        const hasUsablePassword = !!fbPassword && fbPassword !== 'REPLACE_ME';

        if (await loginMarkers.first().isVisible() && !hasUsablePassword) {
            console.warn(`🔒 Login screen shown for ${fbEmail} but no usable password is configured — cookie-only mode. Re-prime this account's cookies (dashboard → Cookies).`);
        } else if (await loginMarkers.first().isVisible() && !passwordAttemptAllowed(fbEmail)) {
            console.warn(`🔒 Login screen shown for ${fbEmail} but password login is backed off after a recent failure.`);
        } else if (await loginMarkers.first().isVisible()) {
            // Login form is up, but do NOT log in here. There used to be two
            // password-login implementations in this function and both ran in
            // the same cycle, so every cycle spent two password attempts and
            // hit the back-off / checkpoint twice as fast. The verified login
            // path below (cookies -> password -> 2FA -> c_user proof) is the
            // single owner of logging in.
            console.log("🔒 Login screen detected — handing over to the verified login path.");
        }

        // Verify login — we cannot rely on the home-feed markers because the
        // route-blocking stops the home SPA from rendering them. Instead: logged-in == login form absent AND
        // no checkpoint interstitial AND not on a login/captcha URL.
        const currentUrl = page.url();
        const loginFormVisible = await loginMarkers.first().isVisible().catch(() => false);
        const checkpointVisible = await isSessionCheckpoint(page);
        // POSITIVE proof of a session: Facebook only sets c_user for a logged-in
        // user. The old check was negative-only and matched 'login.php', but
        // Facebook redirects logged-out users to '/login/?next=...' — so a dead
        // session reported "Login verified" and the bot spent every cycle
        // scrolling login pages.
        const liveCookies = await context.cookies().catch(() => [] as any[]);
        const hasCUser = liveCookies.some((c: any) => c.name === 'c_user' && c.value);
        let isLogged = hasCUser
            && !loginFormVisible
            && !checkpointVisible
            && !/\/login\b|login\.php|\/checkpoint\//.test(currentUrl)
            && !currentUrl.includes('two_step_verification')
            && !currentUrl.includes('recaptcha');
        if (!hasCUser) console.error("\u274c No c_user cookie present — the saved session is dead.");

        if (!isLogged) {
            console.log(`🔒 Cookie verification failed for ${fbEmail}.`);
            try {
                if (!hasUsablePassword) {
                    throw new Error('cookie-only mode: no password configured, skipping automated re-login');
                }
                if (!passwordAttemptAllowed(fbEmail)) {
                    throw new Error('password login backed off after a recent failure');
                }
                // Clear existing session context cookies to get a clean slate
                await context.clearCookies();
                // waitUntil:'commit' returns the moment the first byte lands, so on
                // a flaky proxy the login page was still an empty document when we
                // looked for the fields — the re-login "failed" without ever seeing
                // a form. Retry the navigation, then wait for the form itself.
                await gotoWithRetry(page, 'https://www.facebook.com/login', 'login page', 3);
                await page.locator('input[name="email"], #email').first()
                    .waitFor({ state: 'visible', timeout: 25000 })
                    .catch(() => { /* logged below with the real page state */ });
                await randomDelay(1500, 3000);
                await closeOverlays(page);

                const emailField = page.locator('input[name="email"], #email, input[type="text"]').first();
                const passField = page.locator('input[name="pass"], #pass, input[type="password"]').first();

                const emailVisible = await emailField.isVisible().catch(() => false);
                const passVisible = await passField.isVisible().catch(() => false);
                if (!emailVisible || !passVisible) {
                    // Without this the bot silently fell through to "Login
                    // verification failed" and nobody could tell whether the
                    // password was wrong or the form never rendered.
                    console.error(`\u26a0\ufe0f Login form did not render for ${fbEmail} (email field: ${emailVisible}, password field: ${passVisible}) at ${page.url().slice(0, 80)} — title "${await page.title().catch(() => '?')}"`);
                }
                if (emailVisible && passVisible) {
                    console.log(`👤 Entering credentials for ${fbEmail}...`);
                    await emailField.fill(fbEmail);
                    await randomDelay(500, 1000);
                    await passField.fill(fbPassword);
                    await randomDelay(800, 1500);

                    const loginBtn = page.locator('button[name="login"], #loginbutton, button[type="submit"]').first();
                    if (await loginBtn.isVisible()) {
                        await loginBtn.click();
                    } else {
                        await passField.press('Enter');
                    }
                    console.log("⏳ Waiting for landing/feed page...");
                    await randomDelay(6000, 8000);

                    // Check for 2FA / TOTP challenge (if we ever support it, currently we don't have secrets in env but let's handle checkpoints)
                    for (const btnText of ["Save", "Remember browser", "Not now", "Continue", "OK"]) {
                        try {
                            const btn = page.locator(`button:has-text("${btnText}"), div[role="button"]:has-text("${btnText}")`).first();
                            if (await btn.isVisible()) {
                                await btn.click();
                                await randomDelay(2000, 3000);
                            }
                        } catch (e) {}
                    }

                    // If Facebook demands the authenticator code, answer it.
                    await completeTwoFactor(page, account.totpSecret, fbEmail);

                    // Verify if re-login succeeded. This MUST demand a real
                    // c_user cookie: the old negative-only check reported
                    // "Login verified" after a password login that had actually
                    // been bounced, so the bot patrolled while logged out and
                    // could never post a comment.
                    const newUrl = page.url();
                    const newLoginVisible = await page.locator('input[name="email"], #email, input[name="pass"], #pass').first().isVisible().catch(() => false);
                    const newCheckpoint = await isSessionCheckpoint(page);
                    const postLoginCookies = await context.cookies().catch(() => [] as any[]);
                    const postLoginCUser = postLoginCookies.some((c: any) => c.name === 'c_user' && c.value);
                    isLogged = postLoginCUser && !newLoginVisible && !newCheckpoint
                        && !newUrl.includes('login') && !newUrl.includes('checkpoint');
                    if (!postLoginCUser) {
                        console.error(`\u274c Password login for ${fbEmail} did not produce a c_user cookie — treating it as FAILED (url: ${newUrl.slice(0, 80)}).`);
                        recordPasswordAttempt(fbEmail);
                    } else {
                        clearPasswordAttempt(fbEmail);
                    }

                    if (isLogged) {
                        const freshCookies = await context.cookies();
                        if (await saveSessionCookies(fbEmail, freshCookies)) {
                            console.log(`✅ Automated re-login successful for ${fbEmail}! Fresh cookies saved to Supabase.`);
                        }
                    }
                }
            } catch (reloginErr: any) {
                console.error(`❌ Automated re-login failed with exception: ${reloginErr.message}`);
            }
        }

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

            // NEVER destroy the stored cookies on a failed login. A transient
            // Facebook hiccup used to overwrite a perfectly good session with an
            // empty array, making self-recovery impossible and forcing a manual
            // re-login every time. The cookies are left untouched so the next
            // cycle can retry them.
            console.log(`📡 Login failed for ${fbEmail} — stored cookies PRESERVED for retry next cycle.`);
            recordLoginResult(fbEmail, false, failureReason);
            await writeHeartbeat();

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
        recordLoginResult(fbEmail, true);
        await writeHeartbeat();

        // Roll the stored session forward. Facebook rotates cookie values over
        // time; persisting the live jar on every successful login keeps the
        // stored copy fresh instead of letting it slowly go stale and die.
        try {
            await saveSessionCookies(fbEmail, await context.cookies());
        } catch (e: any) {
            console.warn(`⚠️ Could not refresh stored session: ${e.message}`);
        }
        
        if (BOT_ROLE !== 'scout') await executeApprovedLeads(page, fbEmail);
        // PHASE 1.5: Scan Facebook Notifications for instant alerts
        console.log("🔍 PHASE 1.5: Checking Facebook Notifications...");
        const notificationUrls = await scanFacebookNotifications(page);
        
        for (const url of notificationUrls) {
            console.log(`\n🔔 Processing notification post: ${url}`);
            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
                await randomDelay(2000, 3000);

                // Wait for the POST itself, never the page shell. The old code
                // fell back to [role="main"] — the whole main column — so the
                // classifier judged the entire feed (sidebar ads, other posts,
                // "What's on your mind, Ilse?") and could approve on one post's
                // words while commenting on a different one.
                await page.waitForSelector('[data-ad-preview="message"], [role="article"]', { timeout: 15000 }).catch(() => {});

                let postText = await readTargetPostText(page);
                if (!postText) {
                    console.log("   ⚠️ Could not read the post body itself. Skipping.");
                    continue;
                }
                
                const cleanText = postText.replace(/[\W_]+/g, '').toLowerCase(); 
                const textHash = cleanText.substring(0, 40);
                let postID = `hash_${textHash}`;
                const match = url.match(/(?:\/posts\/|\/permalink\/)(\d+)/);
                if (match && match[1]) {
                    postID = match[1];
                } else {
                    const multiMatch = url.match(/multi_permalinks=([^&]+)/);
                    if (multiMatch && multiMatch[1]) {
                        postID = decodeURIComponent(multiMatch[1]).split(',')[0] ?? postID;
                    }
                }

                const { data: alreadyReplied } = await supabase
                    .from('replies_log')
                    .select('*')
                    .eq('post_id', postID)
                    .maybeSingle();
                
                if (alreadyReplied) {
                    console.log("   ⏭️ Already replied to this post. Skipping.");
                    continue;
                }

                const quickDecision = quickKeywordFilter(postText);
                let isLead = false;
                if (quickDecision === 'approve') {
                    isLead = true;
                } else if (quickDecision === 'reject') {
                    isLead = false;
                } else {
                    isLead = await evaluatePostWithAI(postText);
                }
                
                if (isLead) {
                    console.log(`🎯 MATCH FOUND (Notification): ${postID}`);
                    if (!DRY_RUN && !(await accountMayComment(fbEmail))) continue;
                    const templateText = templateFor(fbEmail);
                    
                    if (DRY_RUN) {
                        console.log(`[DRY RUN] Would comment on lead (${postID}): ${postText.substring(0, 60)}...`);
                        await supabase.from('leads').insert({ post_id: postID, group_url: url, post_text: postText, status: 'posted' });
                        await supabase.from('replies_log').insert({ post_id: postID, group_url: url, comment_id: `dryrun_${Date.now()}`, replied_at: new Date() });
                        continue;
                    }
                    
                    console.log("⚡ Auto-accepted lead! Attempting immediate comment...");
                    // The composer mounts late on a cold/proxied VPS, so poll and
                    // re-click the placeholder like the group path does.
                    const commentPlaceholder = page.locator(
                        '[aria-label*="Write a public comment" i], ' +
                        '[aria-label*="Write a comment" i], ' +
                        '[aria-label*="Leave a comment" i], ' +
                        '[aria-placeholder*="comment" i], ' +
                        '[data-lexical-editor], ' +
                        '[contenteditable]'
                    ).first();
                    const commentBox = page.locator(
                        '[contenteditable="true"][aria-label*="comment" i], ' +
                        '[role="textbox"][aria-label*="comment" i], ' +
                        '[contenteditable="true"]'
                    ).first();

                    let notifInputReady = false;
                    for (let attempt = 1; attempt <= 9 && !notifInputReady; attempt++) {
                        await commentPlaceholder.click({ timeout: 2500 }).catch(() => {});
                        try { await commentBox.waitFor({ state: 'visible', timeout: 5000 }); } catch (e) {}
                        notifInputReady = await commentBox.isVisible({ timeout: 1000 }).catch(() => false);
                        if (!notifInputReady) {
                            console.log(`📍 Comment composer not up yet (attempt ${attempt}/9)…`);
                            await page.mouse.wheel(0, 400).catch(() => {});
                            await new Promise(r => setTimeout(r, 1500));
                        }
                    }

                    if (notifInputReady) {
                        await commentBox.click({ force: true }).catch(() => {});
                        await typeComment(page, templateText);
                        await page.keyboard.press('Enter');

                        // NEVER claim success on a keypress alone. Confirm the comment is
                        // actually rendered, and store its real permalink as proof.
                        const proof = await captureCommentPermalink(page, url);
                        if (!proof.verified) {
                            console.warn(`⚠️ Comment NOT confirmed on notification post ${postID} — logged unverified, booster reply skipped.`);
                            await supabase.from('leads').insert({ post_id: postID, group_url: url, post_text: postText, status: 'failed' });
                            await supabase.from('replies_log').insert({ post_id: postID, group_url: url, comment_id: `unverified_${Date.now()}`, user_profile_id: fbEmail, replied_at: new Date() });
                            continue;
                        }
                        console.log(`✅ Direct comment CONFIRMED on notification post ${postID}: ${proof.url.slice(0, 110)}`);
                        await supabase.from('leads').insert({ post_id: postID, group_url: url, post_text: postText, status: 'posted' });
                        await supabase.from('replies_log').insert({ post_id: postID, group_url: url, comment_id: proof.url, user_profile_id: fbEmail, replied_at: new Date() });
                        await coolDown('Account 3 booster comment');
                        await postWebsiteUrlBoosterReply(url, postID);
                        await coolDown('next notification lead');
                    } else {
                        console.warn(`⚠️ Could not find comment box for notification post ${postID}`);
                    }
                }
            } catch (e: any) {
                console.error(`⚠️ Error processing notification URL ${url}:`, e.message);
            }
        }

        // PHASE 2: Patrol the configured target groups directly.
        // A commenter never sweeps — it holds its browser open and drains the
        // queue, so a lead found by the scout is answered in seconds.
        if (BOT_ROLE === 'commenter') {
            const pollMs = parseInt(process.env.COMMENTER_POLL_SECONDS || '20') * 1000;
            const untilMs = Date.now() + parseInt(process.env.COMMENTER_SESSION_MINUTES || '55') * 60 * 1000;
            console.log(`👂 Commenter mode (${fbEmail}) — polling the lead queue every ${pollMs / 1000}s.`);
            while (Date.now() < untilMs) {
                await new Promise(r => setTimeout(r, pollMs));
                try {
                    await executeApprovedLeads(page, fbEmail);
                } catch (e: any) {
                    console.error(`⚠️ Commenter pass failed: ${e.message?.slice(0, 120)}`);
                }
            }
        } else if (FEED_MODE) {
            await scanGroupsFeed(page, fbEmail);
            // The per-group sweep is the backstop: Facebook ranks the combined
            // feed, so it can hide posts. One full lap a night catches those
            // while nothing else is competing for the box.
            const hourBne = parseInt(new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', timeZone: 'Australia/Brisbane' }), 10);
            const sweepHour = parseInt(process.env.NIGHTLY_SWEEP_HOUR || '1');
            const today = new Date().toLocaleDateString('en-AU', { timeZone: 'Australia/Brisbane' });
            if (hourBne === sweepHour && lastSweepDate !== today) {
                lastSweepDate = today;
                console.log(`\ud83c\udf19 Nightly backstop sweep of all groups (${today})...`);
                await patrolGroups(page, fbEmail);
                await searchGroupsForLeads(page);
            }
        } else {
            console.log("🔍 PHASE 2A: Targeted group search for cleaning requests...");
            await searchGroupsForLeads(page, fbEmail);
            console.log("📰 PHASE 2B: Combined groups feed scan...");
            await scanGroupsFeed(page, fbEmail);
            console.log("🏡 PHASE 2C: Chronological group patrol...");
            await patrolGroups(page, fbEmail);
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
let lastCycleSucceeded = true;
let cycleCount = 0;
let isRunning = false;

async function main() {
    console.log("🚀 Fiesta Fresh Bot v2.0 Starting...");
    console.log(`Supabase: ${supabaseUrl}`);
    console.log(`Discovery: ${FEED_MODE ? 'combined groups feed (sweep = nightly backstop)' : 'per-group sweep'}`);
    console.log(`Role: ${BOT_ROLE}${BOT_ACCOUNT ? ` (pinned to ${BOT_ACCOUNT})` : ''} | accounts in rotation: ${ACCOUNTS.map(a => a.email).join(', ') || 'none'}`);
    console.log(`Scan Interval: ${SCAN_INTERVAL / 1000}s`);
    {
        const m = process.memoryUsage();
        console.log(`📊 Boot RSS ${(m.rss / 1048576).toFixed(0)}MB | heap ${(m.heapUsed / 1048576).toFixed(0)}MB | heapTotal ${(m.heapTotal / 1048576).toFixed(0)}MB | external ${(m.external / 1048576).toFixed(0)}MB`);
    }

    // Local health check server on port 8080
    const PORT = parseInt(process.env.PORT || '8080');
    http.createServer(async (req, res) => {
        let cfg: any = null;
        try {
            const r = await supabase.from('config').select('bot_status').maybeSingle();
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

    // Hard ceiling on a single cycle. A hung page or a wedged Chromium used to
    // freeze the bot indefinitely (observed: 8h stuck on "Navigating to
    // Facebook", every subsequent tick skipped). Rather than leak a wedged
    // browser on a 1GB box, exit non-zero and let systemd's Restart=always
    // bring up a clean process.
    const CYCLE_TIMEOUT_MS = parseInt(process.env.CYCLE_TIMEOUT_SECONDS || '7200') * 1000;
    let cycleStartedAt: number | null = null;

    setInterval(() => {
        if (isRunning && cycleStartedAt && Date.now() - cycleStartedAt > CYCLE_TIMEOUT_MS) {
            const mins = Math.round((Date.now() - cycleStartedAt) / 60000);
            console.error(`\u23f1\ufe0f WATCHDOG: cycle stuck for ${mins} min (limit ${CYCLE_TIMEOUT_MS / 60000} min). Forcing a clean restart.`);
            process.exit(1);
        }
    }, 60000);

    const cycle = async () => {
        if (isRunning) {
            console.log("⏳ Previous cycle still running, skipping this tick.");
            return;
        }
        isRunning = true;
        cycleStartedAt = Date.now();
        newLeadsThisCycle = 0;
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
            lastCycleSucceeded = success;
            if (!success) {
                console.error("❌ All configured Facebook accounts failed to authenticate in this cycle.");
                consecutiveAuthFailures++;
                if (consecutiveAuthFailures === 3 || consecutiveAuthFailures % 24 === 0) {
                    await sendAlertEmail(
                        'Fiesta bot: all Facebook logins failing',
                        `Every configured account failed to authenticate for ${consecutiveAuthFailures} cycles in a row.\n\n` +
                        `Login state: ${JSON.stringify(loginState, null, 2)}\n\n` +
                        `The sessions need re-priming (bot/prime_session_mac.py) before any comment can be posted.`
                    );
                }
            } else {
                consecutiveAuthFailures = 0;
            }
        } catch (err) {
            console.error("Bot cycle failed:", err);
        } finally {
            isRunning = false;
            cycleStartedAt = null;
            cycleCount++;
            lastCycleTime = new Date().toISOString();
            await writeHeartbeat({ last_cycle: lastCycleTime });
        }
    };

    await writeHeartbeat({ event: 'boot' });
    // Independent heartbeat so the dashboard sees liveness mid-cycle too
    setInterval(() => { writeHeartbeat({ last_cycle: lastCycleTime }); }, 60000);

    // The 6 PM report used to be triggered from INSIDE runBot(), so it only went
    // out if a Facebook login had just succeeded. Whenever the sessions were
    // down — exactly when you most need to be told — no report was sent at all.
    // It now runs on its own timer, independent of Facebook entirely.
    setInterval(() => { checkAndSendDailyReport().catch(() => {}); }, 5 * 60 * 1000);

    // ─────────────────────────────────────────────────────────────────────────
    // SCHEDULER
    //
    // The old setInterval fired every 30 min regardless of whether the previous
    // cycle had finished, so a long sweep just got its ticks dropped and the
    // box ran a browser almost continuously — starving the cold-email
    // supervisor that shares this 1 GB VPS.
    //
    // Now: sweep every group, then sleep for a fixed rest period, then repeat.
    // Between 23:00 and 05:00 Brisbane the bot stays asleep entirely.
    // ─────────────────────────────────────────────────────────────────────────
    const REST_MS = parseInt(process.env.SLEEP_BETWEEN_CYCLES_SECONDS || '3600') * 1000;
    const QUIET_START = parseInt(process.env.QUIET_HOURS_START || '23');
    const QUIET_END = parseInt(process.env.QUIET_HOURS_END || '5');
    const bneHour = () => parseInt(new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', timeZone: 'Australia/Brisbane' }), 10);
    const inQuietHours = () => {
        if (QUIET_START === QUIET_END) return false;
        const h = bneHour();
        return QUIET_START < QUIET_END ? (h >= QUIET_START && h < QUIET_END) : (h >= QUIET_START || h < QUIET_END);
    };
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    (async () => {
        for (;;) {
            if (inQuietHours()) {
                console.log(`😴 Quiet hours (${QUIET_START}:00-${QUIET_END}:00 Brisbane) — bot resting. Next check in 15 min.`);
                await sleep(15 * 60 * 1000);
                continue;
            }
            console.log("\n⏰ Starting new scan cycle...");
            await cycle();
            if (inQuietHours()) continue;
            if (newLeadsThisCycle > 0) {
                const quick = parseInt(process.env.FRESH_LEAD_REST_SECONDS || '120') * 1000;
                console.log(`⚡ ${newLeadsThisCycle} fresh lead(s) found — short rest of ${Math.round(quick / 1000)}s, then commenting on them.`);
                await sleep(quick);
                continue;
            }
            if (!lastCycleSucceeded) {
                // Nothing was scanned, so there is no reason to hand the box to
                // cold-email for an hour. Back off briefly and try again.
                const retry = parseInt(process.env.FAILED_CYCLE_RETRY_SECONDS || '180') * 1000;
                console.log(`🔁 Cycle failed before it could scan — retrying in ${Math.round(retry / 1000)}s instead of the full rest.`);
                await sleep(retry);
                continue;
            }
            if (FEED_MODE) {
                const poll = parseInt(process.env.FEED_POLL_SECONDS || '240') * 1000;
                console.log(`🔄 Feed mode — next poll in ${Math.round(poll / 1000)}s.`);
                await sleep(poll);
                continue;
            }
            console.log(`🛌 Cycle done — resting ${Math.round(REST_MS / 60000)} min so cold-email gets the box.`);
            await sleep(REST_MS);
        }
    })();

    // Memory diagnostics
    setInterval(() => {
        const m = process.memoryUsage();
        console.log(`📊 RSS ${(m.rss / 1048576).toFixed(0)}MB | heap ${(m.heapUsed / 1048576).toFixed(0)}MB | heapTotal ${(m.heapTotal / 1048576).toFixed(0)}MB | external ${(m.external / 1048576).toFixed(0)}MB`);
    }, 15000);
}

main();
