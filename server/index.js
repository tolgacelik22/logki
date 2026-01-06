/**
 * klog-ai Landing Server
 */

const express = require('express');
const helmet = require('helmet');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();

/* =====================
   CONFIG
===================== */
const PORT = process.env.PORT || 8080;
const DB_PATH = process.env.DB_PATH || './data/leads.db';
const ADMIN_KEY = process.env.ADMIN_KEY || null;

app.set('trust proxy', true);

/* =====================
   SECURITY
===================== */
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "https://fonts.googleapis.com"],
                fontSrc: ["'self'", "https://fonts.gstatic.com"],
                imgSrc: ["'self'", "data:"],
                scriptSrc: ["'self'"],
            },
        },
    })
);

app.use(express.json({ limit: '16kb' }));

/* =====================
   STATIC FILES (ÖNCE)
===================== */
const PUBLIC_DIR = path.join(__dirname, '../public');
app.use(express.static(PUBLIC_DIR, { maxAge: '1h', etag: true }));

/* =====================
   RATE LIMIT
===================== */
const rateLimitMap = new Map();
const WINDOW = 60_000;
const MAX_REQ = 10;

function rateLimit(req, res, next) {
    const ip = req.ip || 'unknown';
    const now = Date.now();

    if (!rateLimitMap.has(ip)) {
        rateLimitMap.set(ip, { count: 1, reset: now + WINDOW });
        return next();
    }

    const r = rateLimitMap.get(ip);

    if (now > r.reset) {
        r.count = 1;
        r.reset = now + WINDOW;
        return next();
    }

    if (r.count >= MAX_REQ) {
        return res.status(429).json({ ok: false, error: 'Too many requests' });
    }

    r.count++;
    next();
}

setInterval(() => {
    const now = Date.now();
    for (const [ip, r] of rateLimitMap) {
        if (now > r.reset) rateLimitMap.delete(ip);
    }
}, WINDOW);

/* =====================
   DATABASE
===================== */
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    source TEXT,
    user_agent TEXT,
    ip TEXT,
    created_at TEXT NOT NULL
  )
`);

const insertLead = db.prepare(`
  INSERT INTO leads (email, source, user_agent, ip, created_at)
  VALUES (?, ?, ?, ?, ?)
`);

const findLead = db.prepare(`SELECT id FROM leads WHERE email = ?`);
const getRecentLeads = db.prepare(`
  SELECT email, created_at, source
  FROM leads
  ORDER BY id DESC
  LIMIT 200
`);

/* =====================
   HELPERS
===================== */
function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    if (email.length > 254) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* =====================
   ROUTES
===================== */
app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
});

app.post('/api/lead', rateLimit, (req, res) => {
    try {
        const { email, source, ua } = req.body;
        if (!isValidEmail(email)) {
            return res.status(400).json({ ok: false, error: 'Invalid email' });
        }

        const normalized = email.toLowerCase().trim();
        const exists = findLead.get(normalized);
        if (exists) return res.json({ ok: true, status: 'exists' });

        insertLead.run(
            normalized,
            source || 'landing',
            ua || req.get('User-Agent') || null,
            req.ip || null,
            new Date().toISOString()
        );

        res.status(201).json({ ok: true, status: 'created' });
    } catch (e) {
        if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.json({ ok: true, status: 'exists' });
        }
        res.status(500).json({ ok: false });
    }
});

app.get('/api/admin/leads', (req, res) => {
    if (!ADMIN_KEY) return res.status(403).json({ ok: false });
    if (req.query.key !== ADMIN_KEY) return res.status(401).json({ ok: false });

    res.json({ ok: true, leads: getRecentLeads.all() });
});

/* =====================
   SPA FALLBACK
===================== */
app.get('*', (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

/* =====================
   START
===================== */
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[klog-landing] running on :${PORT}`);
});
