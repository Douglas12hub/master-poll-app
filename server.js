import express from 'express';
import { createPoll, getPoll, vote, closePoll, getAllPolls } from './database.js';

const app = express();

// --- MIDDLEWARE ---
app.use(express.json());
app.use(express.static('public'));

// --- TECHNICAL DEBT (TD1): In-memory SSE clients. Resets on server restart. ---
const clients = {};

// ============================================
// 1. CREATE POLL (Page 1 → Page 2)
// ============================================
app.post('/api/polls', async (req, res) => {
    const { title, options } = req.body;
    const id = await createPoll(title, options);
    res.json({ id, url: `/poll/${id}` });
});

// ============================================
// 2. GET ALL POLLS (Dashboard / Homepage) - FIXED!
// ============================================
app.get('/api/polls', async (req, res) => {
    try {
        const polls = await getAllPolls();
        res.json(polls);
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// ============================================
// 3. GET SINGLE POLL DATA (Page 3)
// ============================================
app.get('/api/polls/:id', async (req, res) => {
    const data = await getPoll(req.params.id);
    if (!data) return res.status(404).json({ error: 'Not found' });
    res.json(data);
});

// ============================================
// 4. VOTE (Triggers real-time SSE update)
// ============================================
app.post('/api/vote', async (req, res) => {
    const { optionId } = req.body;
    const updated = await vote(optionId);

    if (clients[updated.poll_id]) {
        clients[updated.poll_id].forEach(client => {
            client.write(`data: ${JSON.stringify({ optionId, votes: updated.votes })}\n\n`);
        });
    }
    res.json(updated);
});

// ============================================
// 5. CLOSE POLL (Admin function)
// ============================================
app.post('/api/close/:id', async (req, res) => {
    await closePoll(req.params.id);
    res.json({ status: 'closed' });
});

// ============================================
// 6. SERVER-SENT EVENTS (REAL-TIME STREAM)
// ============================================
app.get('/stream/:pollId', (req, res) => {
    const { pollId } = req.params;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    if (!clients[pollId]) clients[pollId] = [];
    clients[pollId].push(res);

    const ping = setInterval(() => res.write('data: ping\n\n'), 20000);

    req.on('close', () => {
        clearInterval(ping);
        clients[pollId] = clients[pollId].filter(c => c !== res);
        if (clients[pollId].length === 0) delete clients[pollId];
    });
});

// ============================================
// 7. CATCH-ALL ROUTE (MUST BE LAST!)
// Serves the frontend for ANY route not matched above.
// ============================================
app.get('*', (req, res) => {
    res.sendFile('index.html', { root: 'public' });
});

// ============================================
// 8. START THE SERVER
// ============================================
app.listen(3000, () => console.log('🚀 Master Poll running on http://localhost:3000'));