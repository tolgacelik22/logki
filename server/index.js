/**
 * nois Landing Server
 */

const express = require('express');
const helmet = require('helmet');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const app = express();

/* =====================
   CONFIG
===================== */
const PORT = process.env.PORT || 8080;
const DB_PATH = process.env.DB_PATH || './data/leads.db';
const ADMIN_KEY = process.env.ADMIN_KEY || null;
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const SMTP_HOST = process.env.SMTP_HOST || null;
const SMTP_PORT = process.env.SMTP_PORT || 587;
const SMTP_USER = process.env.SMTP_USER || null;
const SMTP_PASS = process.env.SMTP_PASS || null;
const SMTP_FROM = process.env.SMTP_FROM || 'nois <noreply@atlas-di.app>';

const VERIFICATION_EXPIRY_MINUTES = 15;
const DEFAULT_CREDITS = 5;

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
   STATIC FILES
===================== */
const PUBLIC_DIR = path.join(__dirname, '../public');
app.use(express.static(PUBLIC_DIR, { maxAge: '1h', etag: true }));

/* =====================
   RATE LIMIT
===================== */
const rateLimitMap = new Map();
const WINDOW = 60_000;
const MAX_REQ = 10;
const MAX_VERIFY_REQ = 3;

function rateLimit(maxReq = MAX_REQ) {
    return (req, res, next) => {
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

        if (r.count >= maxReq) {
            return res.status(429).json({ ok: false, error: 'Too many requests' });
        }

        r.count++;
        next();
    };
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

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    verified_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    credits_remaining INTEGER DEFAULT ${DEFAULT_CREDITS},
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS email_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL
  )
`);

/* =====================
   PREPARED STATEMENTS
===================== */
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

const findUserByEmail = db.prepare(`SELECT id, email FROM users WHERE email = ?`);
const insertUser = db.prepare(`
  INSERT INTO users (email, verified_at, created_at)
  VALUES (?, ?, ?)
`);

const findTokenByUserId = db.prepare(`SELECT token, credits_remaining FROM tokens WHERE user_id = ?`);
const insertToken = db.prepare(`
  INSERT INTO tokens (user_id, token, credits_remaining, created_at)
  VALUES (?, ?, ?, ?)
`);

const insertVerification = db.prepare(`
  INSERT INTO email_verifications (email, code, expires_at, created_at)
  VALUES (?, ?, ?, ?)
`);
const findVerificationByCode = db.prepare(`
  SELECT id, email, expires_at, used_at
  FROM email_verifications
  WHERE code = ?
`);
const markVerificationUsed = db.prepare(`
  UPDATE email_verifications
  SET used_at = ?
  WHERE id = ?
`);
const countRecentVerifications = db.prepare(`
  SELECT COUNT(*) as count
  FROM email_verifications
  WHERE email = ? AND created_at > ?
`);

/* =====================
   HELPERS
===================== */
function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    if (email.length > 254) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateSecureCode() {
    return crypto.randomBytes(32).toString('hex');
}

function generateAccessToken() {
    return 'nois_' + crypto.randomBytes(24).toString('hex');
}

/* =====================
   EMAIL
===================== */
let transporter = null;

async function initEmailTransport() {
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
        console.log('[email] SMTP not configured, emails will be logged to console');
        return;
    }

    try {
        const nodemailer = require('nodemailer');
        transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: parseInt(SMTP_PORT, 10),
            secure: parseInt(SMTP_PORT, 10) === 465,
            auth: {
                user: SMTP_USER,
                pass: SMTP_PASS,
            },
        });
        await transporter.verify();
        console.log('[email] SMTP transport ready');
    } catch (err) {
        console.error('[email] SMTP init failed:', err.message);
        transporter = null;
    }
}

async function sendEmail(to, subject, text, html) {
    const mailOptions = {
        from: SMTP_FROM,
        to,
        subject,
        text,
        html,
    };

    if (transporter) {
        try {
            await transporter.sendMail(mailOptions);
            console.log(`[email] sent to ${to}: ${subject}`);
            return true;
        } catch (err) {
            console.error(`[email] failed to send to ${to}:`, err.message);
            return false;
        }
    } else {
        console.log('');
        console.log('='.repeat(60));
        console.log('[EMAIL - NOT SENT (SMTP not configured)]');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log('-'.repeat(60));
        console.log(text);
        console.log('='.repeat(60));
        console.log('');
        return true;
    }
}

async function sendVerificationEmail(email, code) {
    const verifyUrl = `${BASE_URL}/api/verify-email?code=${code}`;

    const subject = 'Verify your email for nois';
    const text = `
Verify your email to get your nois access token.

Click this link to verify:
${verifyUrl}

This link expires in ${VERIFICATION_EXPIRY_MINUTES} minutes.

If you did not request this, you can ignore this email.

- nois
`.trim();

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; max-width: 500px; margin: 0 auto; padding: 20px;">
  <h2 style="margin-bottom: 20px;">Verify your email</h2>
  <p>Click the button below to verify your email and receive your nois access token.</p>
  <p style="margin: 30px 0;">
    <a href="${verifyUrl}" style="background: #111; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Verify Email</a>
  </p>
  <p style="color: #666; font-size: 14px;">This link expires in ${VERIFICATION_EXPIRY_MINUTES} minutes.</p>
  <p style="color: #666; font-size: 14px;">If you did not request this, you can ignore this email.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px;">nois - Find the noise in your logs</p>
</body>
</html>
`.trim();

    return sendEmail(email, subject, text, html);
}

async function sendTokenEmail(email, token) {
    const subject = 'Your nois access token';
    const text = `
Your email has been verified. Here is your nois access token:

${token}

Getting started:
1. Install nois: curl -fsSL https://nois.atlas-di.app/install.sh | sh
2. Save your token: mkdir -p ~/.nois && echo "${token}" > ~/.nois/token
3. Run: nois quickstart

You have ${DEFAULT_CREDITS} free runs included.

When you run out of credits, visit https://nois.atlas-di.app to purchase more.
Your token will be reused - no need to get a new one.

Keep this token safe. Do not share it publicly.

- nois
`.trim();

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; max-width: 500px; margin: 0 auto; padding: 20px;">
  <h2 style="margin-bottom: 20px;">Your nois access token</h2>
  <p>Your email has been verified. Here is your access token:</p>
  <div style="background: #f5f5f5; padding: 16px; border-radius: 4px; font-family: monospace; font-size: 14px; margin: 20px 0; word-break: break-all;">
    ${token}
  </div>
  <h3 style="margin-top: 30px;">Getting started</h3>
  <ol style="line-height: 1.8;">
    <li>Install nois:<br><code style="background: #f5f5f5; padding: 2px 6px; border-radius: 2px;">curl -fsSL https://nois.atlas-di.app/install.sh | sh</code></li>
    <li>Save your token:<br><code style="background: #f5f5f5; padding: 2px 6px; border-radius: 2px;">mkdir -p ~/.nois && echo "${token}" > ~/.nois/token</code></li>
    <li>Run:<br><code style="background: #f5f5f5; padding: 2px 6px; border-radius: 2px;">nois quickstart</code></li>
  </ol>
  <p style="margin-top: 20px;"><strong>You have ${DEFAULT_CREDITS} free runs included.</strong></p>
  <p style="color: #666;">When you run out of credits, visit <a href="https://nois.atlas-di.app">nois.atlas-di.app</a> to purchase more. Your token will be reused.</p>
  <p style="color: #c00; font-size: 14px; margin-top: 20px;">Keep this token safe. Do not share it publicly.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px;">nois - Find the noise in your logs</p>
</body>
</html>
`.trim();

    return sendEmail(email, subject, text, html);
}

/* =====================
   ROUTES
===================== */
app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
});

app.post('/api/lead', rateLimit(), (req, res) => {
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

app.post('/api/request-verification', rateLimit(MAX_VERIFY_REQ), async (req, res) => {
    try {
        const { email } = req.body;

        if (!isValidEmail(email)) {
            return res.status(400).json({ ok: false, error: 'Invalid email' });
        }

        const normalized = email.toLowerCase().trim();
        const now = new Date();

        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
        const recentCount = countRecentVerifications.get(normalized, oneHourAgo);
        if (recentCount && recentCount.count >= 3) {
            return res.json({ ok: true, message: 'If this email is valid, you will receive a verification link.' });
        }

        const code = generateSecureCode();
        const expiresAt = new Date(now.getTime() + VERIFICATION_EXPIRY_MINUTES * 60 * 1000).toISOString();

        insertVerification.run(normalized, code, expiresAt, now.toISOString());

        sendVerificationEmail(normalized, code).catch(err => {
            console.error('[verification] email send failed:', err.message);
        });

        res.json({ ok: true, message: 'If this email is valid, you will receive a verification link.' });
    } catch (e) {
        console.error('[verification] error:', e.message);
        res.status(500).json({ ok: false, error: 'Internal error' });
    }
});

app.get('/api/verify-email', async (req, res) => {
    try {
        const { code } = req.query;

        if (!code || typeof code !== 'string' || code.length !== 64) {
            return res.status(400).send(verificationErrorPage('Invalid verification link.'));
        }

        const verification = findVerificationByCode.get(code);

        if (!verification) {
            return res.status(400).send(verificationErrorPage('Invalid or expired verification link.'));
        }

        if (verification.used_at) {
            return res.status(400).send(verificationErrorPage('This verification link has already been used.'));
        }

        const now = new Date();
        if (new Date(verification.expires_at) < now) {
            return res.status(400).send(verificationErrorPage('This verification link has expired. Please request a new one.'));
        }

        markVerificationUsed.run(now.toISOString(), verification.id);

        const email = verification.email;

        let user = findUserByEmail.get(email);
        if (!user) {
            const result = insertUser.run(email, now.toISOString(), now.toISOString());
            user = { id: result.lastInsertRowid, email };
        }

        let tokenRecord = findTokenByUserId.get(user.id);
        let accessToken;

        if (tokenRecord) {
            accessToken = tokenRecord.token;
        } else {
            accessToken = generateAccessToken();
            insertToken.run(user.id, accessToken, DEFAULT_CREDITS, now.toISOString());
        }

        sendTokenEmail(email, accessToken).catch(err => {
            console.error('[token] email send failed:', err.message);
        });

        res.send(verificationSuccessPage());
    } catch (e) {
        console.error('[verify-email] error:', e.message);
        res.status(500).send(verificationErrorPage('An error occurred. Please try again.'));
    }
});

app.get('/api/admin/leads', (req, res) => {
    if (!ADMIN_KEY) return res.status(403).json({ ok: false });
    if (req.query.key !== ADMIN_KEY) return res.status(401).json({ ok: false });

    res.json({ ok: true, leads: getRecentLeads.all() });
});

/* =====================
   HTML PAGES
===================== */
function verificationSuccessPage() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verified - nois</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0a0a0b;
            color: #e4e4e7;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            max-width: 480px;
            text-align: center;
        }
        h1 {
            font-size: 1.5rem;
            margin-bottom: 1rem;
            color: #4ade80;
        }
        p {
            color: #a1a1aa;
            line-height: 1.6;
            margin-bottom: 1rem;
        }
        .highlight {
            color: #e4e4e7;
        }
        a {
            color: #a1a1aa;
            text-decoration: underline;
        }
        a:hover {
            color: #e4e4e7;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Email verified</h1>
        <p class="highlight">Check your inbox for your access token.</p>
        <p>Your token includes ${DEFAULT_CREDITS} free runs. Follow the instructions in the email to get started.</p>
        <p><a href="/">Return to nois</a></p>
    </div>
</body>
</html>
`.trim();
}

function verificationErrorPage(message) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verification Failed - nois</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0a0a0b;
            color: #e4e4e7;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            max-width: 480px;
            text-align: center;
        }
        h1 {
            font-size: 1.5rem;
            margin-bottom: 1rem;
            color: #f87171;
        }
        p {
            color: #a1a1aa;
            line-height: 1.6;
            margin-bottom: 1rem;
        }
        a {
            color: #a1a1aa;
            text-decoration: underline;
        }
        a:hover {
            color: #e4e4e7;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Verification failed</h1>
        <p>${message}</p>
        <p><a href="/">Return to nois</a></p>
    </div>
</body>
</html>
`.trim();
}

/* =====================
   SPA FALLBACK
===================== */
app.get('*', (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

/* =====================
   START
===================== */
initEmailTransport().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`[nois] running on :${PORT}`);
    });
});
