import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '..', 'fiesta.db');

let dbConnection: Database | null = null;

export async function getDb() {
    if (!dbConnection) {
        dbConnection = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });
    }
    return dbConnection;
}

export async function getConfig() {
    const db = await getDb();
    return await db.get('SELECT * FROM config LIMIT 1');
}

export async function getActiveTemplate() {
    const db = await getDb();
    return await db.get('SELECT * FROM templates WHERE is_active = 1 LIMIT 1');
}

export async function getApprovedLeads() {
    const db = await getDb();
    return await db.all('SELECT * FROM leads WHERE status = ?', ['approved']);
}

export async function updateLeadStatus(id: string, status: string) {
    const db = await getDb();
    await db.run(
        'UPDATE leads SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, id]
    );
}

export async function getActiveGroups() {
    const db = await getDb();
    return await db.all('SELECT * FROM groups WHERE is_active = 1');
}

export async function getKeywords() {
    const db = await getDb();
    return await db.all('SELECT * FROM keywords');
}

export async function checkExistingReply(postId: string) {
    const db = await getDb();
    return await db.get('SELECT * FROM replies_log WHERE post_id = ? LIMIT 1', [postId]);
}

export async function insertLead(lead: { post_id: string; group_url: string; post_text: string; status: string }) {
    const db = await getDb();
    const id = `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await db.run(
        'INSERT INTO leads (id, post_id, group_url, post_text, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [id, lead.post_id, lead.group_url, lead.post_text, lead.status]
    );
}

export async function getAiMemoryRules() {
    const db = await getDb();
    return await db.all('SELECT rule_text FROM ai_memory');
}

export async function upsertSession(userEmail: string, cookies: any) {
    const db = await getDb();
    const cookiesJson = JSON.stringify(cookies);
    await db.run(
        'INSERT INTO sessions (user_email, cookies, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_email) DO UPDATE SET cookies = ?, updated_at = CURRENT_TIMESTAMP',
        [userEmail, cookiesJson, cookiesJson]
    );
}
