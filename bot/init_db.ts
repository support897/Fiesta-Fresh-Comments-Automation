import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '..', 'fiesta.db');

async function init() {
    console.log(`🔨 Initializing SQLite Database at: ${dbPath}`);
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    // 1. Config Table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS config (
            id TEXT PRIMARY KEY,
            bot_status INTEGER DEFAULT 0,
            reply_delay_min INTEGER DEFAULT 60,
            reply_delay_max INTEGER DEFAULT 180,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 2. Templates Table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS templates (
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            is_active INTEGER DEFAULT 0,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 3. Keywords Table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS keywords (
            id TEXT PRIMARY KEY,
            phrase TEXT NOT NULL UNIQUE,
            category TEXT
        )
    `);

    // 4. Groups Table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS groups (
            id TEXT PRIMARY KEY,
            url TEXT NOT NULL UNIQUE,
            is_active INTEGER DEFAULT 1,
            schedule TEXT DEFAULT 'all'
        )
    `);

    // 5. Replies Log Table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS replies_log (
            id TEXT PRIMARY KEY,
            comment_id TEXT NOT NULL,
            post_id TEXT NOT NULL,
            user_profile_id TEXT,
            group_url TEXT,
            replied_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 6. Leads Table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS leads (
            id TEXT PRIMARY KEY,
            post_id TEXT NOT NULL UNIQUE,
            group_url TEXT NOT NULL,
            post_text TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            rejection_reason TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 7. AI Memory Table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS ai_memory (
            id TEXT PRIMARY KEY,
            rule_text TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 8. Sessions Table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
            user_email TEXT PRIMARY KEY,
            cookies TEXT,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // --- SEED INITIAL DATA ---

    // Config
    const existingConfig = await db.get('SELECT * FROM config LIMIT 1');
    if (!existingConfig) {
        await db.run(
            'INSERT INTO config (id, bot_status, reply_delay_min, reply_delay_max) VALUES (?, ?, ?, ?)',
            ['config-default', 1, 60, 180]
        );
        console.log("👉 Inserted default config (bot status: active).");
    }

    // Template
    const newTemplateText = `Hi! 💙 We would absolutely love to help you out!

We are Fiesta Fresh Cleaning, a local Gold Coast team that genuinely cares about every single home and space we walk into. Fully insured, police-checked and proudly serving the Gold Coast community 🏡✨

And here is what makes us a little different from everyone else… we offer a 200% Happiness Guarantee on every single clean we do. That means if anything is not perfect we come back and fix it for FREE. No questions asked. We are the only cleaning company on the Gold Coast offering this and we stand behind it completely. 🙌

We are not a big franchise. We are your neighbours. A real local team that shows up, works hard and truly cares about leaving your space better than we found it. Every single time. 💙

You can check out everything we offer, read our reviews and even book in 60 seconds right here 👉 fiestafreshcleaning.com/book

We will also send you a DM just in case you have any questions. Make sure to check your message requests! We cannot wait to help you out. 🎉`;

    await db.run('DELETE FROM templates');
    await db.run(
        'INSERT INTO templates (id, content, is_active) VALUES (?, ?, ?)',
        ['template-default', newTemplateText, 1]
    );
    console.log("👉 Set active template with the 200% Guarantee.");

    // Keywords
    const keywords = ['cleaner', 'bond clean', 'carpet clean', 'recommendation', 'gold coast cleaner'];
    for (let word of keywords) {
        await db.run(
            'INSERT OR IGNORE INTO keywords (id, phrase) VALUES (?, ?)',
            [`keyword-${word}`, word]
        );
    }
    console.log("👉 Seeded initial keywords.");

    // Groups
    const groupsData = [
        { url: 'https://www.facebook.com/share/g/17ZhFPW6Nv/?mibextid=wwXIfr', schedule: 'all' },
        { url: 'https://www.facebook.com/share/g/1B27Gxp16H/?mibextid=wwXIfr', schedule: 'all' },
        { url: 'https://www.facebook.com/share/g/1QKymNFKGB/?mibextid=wwXIfr', schedule: 'all' },
        { url: 'https://www.facebook.com/share/g/18LVQKPo7i/?mibextid=wwXIfr', schedule: 'all' },
        { url: 'https://www.facebook.com/share/g/1HtBL7VbvU/?mibextid=wwXIfr', schedule: 'all' },
        { url: 'https://www.facebook.com/share/g/1ACxjEMmPz/?mibextid=wwXIfr', schedule: 'all' },
        { url: 'https://www.facebook.com/share/g/1AvLccktib/?mibextid=wwXIfr', schedule: 'all' },
        { url: 'https://www.facebook.com/share/g/1Ce8GyrQa7/?mibextid=wwXIfr', schedule: 'all' },
        { url: 'https://www.facebook.com/share/g/1amVvrFuJW/?mibextid=wwXIfr', schedule: 'all' },
        { url: 'https://www.facebook.com/share/g/1FfBrj1rcj/?mibextid=wwXIfr', schedule: 'all' },
        { url: 'https://www.facebook.com/share/g/17TXZukru4/?mibextid=wwXIfr', schedule: 'all' },
        { url: 'https://www.facebook.com/share/g/1CujCYNcjN/?mibextid=wwXIfr', schedule: 'all' },
        { url: 'https://www.facebook.com/share/g/1H5MZ8PjQx/?mibextid=wwXIfr', schedule: 'all' },
        { url: 'https://www.facebook.com/share/g/1S1927sm62/?mibextid=wwXIfr', schedule: 'all' },
        { url: 'https://www.facebook.com/share/g/18aQe7qUsN/?mibextid=wwXIfr', schedule: 'all' },
        { url: 'https://www.facebook.com/share/g/1C3WT4B5DL/?mibextid=wwXIfr', schedule: 'all' },
        { url: 'https://www.facebook.com/share/g/1b6cBgTmom/?mibextid=wwXIfr', schedule: 'all' },
        { url: 'https://www.facebook.com/share/g/1CbgwuTsYk/?mibextid=wwXIfr', schedule: 'Monday' },
        { url: 'https://www.facebook.com/share/g/1JiqcFo29z/?mibextid=wwXIfr', schedule: 'Thursday' }
    ];

    let groupIndex = 0;
    for (const g of groupsData) {
        await db.run(
            'INSERT OR IGNORE INTO groups (id, url, is_active, schedule) VALUES (?, ?, ?, ?)',
            [`group-${groupIndex++}`, g.url, 1, g.schedule]
        );
    }
    console.log(`👉 Seeded ${groupsData.length} Facebook groups.`);

    console.log("🎉 Database initialization completed successfully!");
    await db.close();
}

init().catch(console.error);
