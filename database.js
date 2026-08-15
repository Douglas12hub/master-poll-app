import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { promisify } from 'util';

const db = new sqlite3.Database('polls.db');
const run = promisify(db.run.bind(db));
const all = promisify(db.all.bind(db));
const get = promisify(db.get.bind(db));

// Initialize DB
await run(`CREATE TABLE IF NOT EXISTS polls (
    id TEXT PRIMARY KEY, 
    title TEXT, 
    is_active INTEGER DEFAULT 1
)`);
await run(`CREATE TABLE IF NOT EXISTS options (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    poll_id TEXT, 
    text TEXT, 
    votes INTEGER DEFAULT 0
)`);

export const createPoll = async (title, optionTexts) => {
    const id = uuidv4().slice(0, 8);
    await run('INSERT INTO polls (id, title) VALUES (?, ?)', [id, title]);
    for (let text of optionTexts) {
        if (text.trim()) await run('INSERT INTO options (poll_id, text) VALUES (?, ?)', [id, text]);
    }
    return id;
};

export const getPoll = async (pollId) => {
    const poll = await get('SELECT * FROM polls WHERE id = ?', [pollId]);
    if (!poll) return null;
    const options = await all('SELECT * FROM options WHERE poll_id = ?', [pollId]);
    return { ...poll, options };
};

export const vote = async (optionId) => {
    await run('UPDATE options SET votes = votes + 1 WHERE id = ?', [optionId]);
    const result = await get('SELECT votes, poll_id FROM options WHERE id = ?', [optionId]);
    return result;
};

export const closePoll = async (pollId) => {
    await run('UPDATE polls SET is_active = 0 WHERE id = ?', [pollId]);
};

// ============================================
// NEW: Get all polls for the dashboard
// ============================================
export const getAllPolls = async () => {
    const polls = await all(`
        SELECT p.id, p.title, p.is_active, 
               COUNT(o.id) as option_count,
               COALESCE(SUM(o.votes), 0) as total_votes
        FROM polls p
        LEFT JOIN options o ON o.poll_id = p.id
        GROUP BY p.id
        ORDER BY p.rowid DESC 
        LIMIT 20
    `);
    return polls;
};