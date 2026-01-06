/**
 * klog-ai Landing Server
 * 
 * Express server serving static landing page + lead capture API.
 * Stores leads in SQLite with WAL mode.
 */

const express = require('express');
const helmet = require('helmet');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();

// Configuration
const PORT = process.env.PORT || 8080;
const DB_PATH = process.env.DB_PATH || './data/leads.db';
const ADMIN_KEY = process.env.ADMIN_KEY || null;

// Trust proxy (Traefik)
app.set('trust proxy', true);

// Security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:"],
            scriptSrc: ["'self'"],
        },
    },
}));

// Body parser with size limit
app.use(express.json({ limit: '16kb' }));

// Rate limiting (simple in-memory per IP)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute per IP

function rateLimit(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    
    if (!rateLimitMap.has(ip)) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return next();
    }
    
    const record = rateLimitMap.get(ip);
    
    if (now > record.resetAt) {
        record.count = 1;
        record.resetAt = now + RATE_LIMIT_WINDOW_MS;
        return next();
    }
    
    if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
        return res.status(429).json({ ok: false, error: 'Too many requests' });
    }
    
    record.count++;
    return next();
}

// Clean up rate limit map periodically
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of rateLimitMap) {
        if (now > record.resetAt) {
            rateLimitMap.delete(ip);
        }
    }
}, 60 * 1000);

// Initialize SQLite database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Create leads table
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

// Prepared statements
const insertLead = db.prepare(`
    INSERT INTO leads (email, source, user_agent, ip, created_at)
    VALUES (?, ?, ?, ?, ?)
`);

const findLead = db.prepare(`
    SELECT id FROM leads WHERE email = ?
`);

const getRecentLeads = db.prepare(`
    SELECT email, created_at, source
    FROM leads
    ORDER BY id DESC
    LIMIT 200
`);

// Email validation
function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    if (email.length > 254) return false;
    
    // RFC 5322 compliant regex (simplified but strict)
    const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return re.test(email);
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ ok: true });
});

// Lead capture endpoint
app.post('/api/lead', rateLimit, (req, res) => {
    try {
        const { email, source, ts, ua } = req.body;
        
        // Validate email
        if (!isValidEmail(email)) {
            return res.status(400).json({ ok: false, error: 'Invalid email format' });
        }
        
        const normalizedEmail = email.toLowerCase().trim();
        const userAgent = ua || req.get('User-Agent') || null;
        const ip = req.ip || req.connection.remoteAddress || null;
        const createdAt = new Date().toISOString();
        const leadSource = source || 'landing';
        
        // Check if email already exists
        const existing = findLead.get(normalizedEmail);
        if (existing) {
            return res.status(200).json({ ok: true, status: 'exists' });
        }
        
        // Insert new lead
        insertLead.run(normalizedEmail, leadSource, userAgent, ip, createdAt);
        
        return res.status(201).json({ ok: true, status: 'created' });
    } catch (err) {
        // Handle unique constraint violation (race condition)
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(200).json({ ok: true, status: 'exists' });
        }
        
        console.error('[ERROR] Lead capture failed:', err.message);
        return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
});

// Admin endpoint - protected by ADMIN_KEY
app.get('/api/admin/leads', (req, res) => {
    const key = req.query.key;
    
    if (!ADMIN_KEY) {
        return res.status(403).json({ ok: false, error: 'Admin disabled' });
    }
    
    if (!key || key !== ADMIN_KEY) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    
    try {
        const leads = getRecentLeads.all();
        return res.json({ ok: true, count: leads.length, leads });
    } catch (err) {
        console.error('[ERROR] Admin leads fetch failed:', err.message);
        return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public'), {
    maxAge: '1h',
    etag: true,
}));

// SPA fallback - serve index.html for unmatched routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[klog-landing] Server running on port ${PORT}`);
    console.log(`[klog-landing] Database: ${DB_PATH}`);
    console.log(`[klog-landing] Admin endpoint: ${ADMIN_KEY ? 'enabled' : 'disabled'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('[klog-landing] Shutting down...');
    db.close();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('[klog-landing] Shutting down...');
    db.close();
    process.exit(0);
});

