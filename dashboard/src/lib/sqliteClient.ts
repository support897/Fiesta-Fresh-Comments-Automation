import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

// Locate fiesta.db in the parent workspace root folder
const dbPath = path.resolve(process.cwd(), '..', 'fiesta.db');

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

export async function getPendingLeads() {
    const db = await getDb();
    return await db.all('SELECT * FROM leads WHERE status = ? ORDER BY created_at DESC', ['pending']);
}

export async function approveLead(id: string) {
    const db = await getDb();
    await db.run('UPDATE leads SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['approved', id]);
}

export async function rejectLead(id: string, reason: string) {
    const db = await getDb();
    await db.run('UPDATE leads SET status = ?, rejection_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['rejected', reason, id]);
    
    // Log to AI memory
    if (reason.trim()) {
        const memoryId = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await db.run('INSERT INTO ai_memory (id, rule_text) VALUES (?, ?)', [memoryId, reason]);
    }
}
