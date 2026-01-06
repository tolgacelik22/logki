# Technical Architecture

This document describes the technical architecture of nois and its supporting infrastructure.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER ENVIRONMENT                                │
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │   kubectl    │───▶│    nois      │───▶│  report.md   │                   │
│  │   (logs)     │    │    CLI       │    │  (local)     │                   │
│  └──────────────┘    └──────┬───────┘    └──────────────┘                   │
│                             │                                                │
│                             │ token validation (optional)                    │
│                             ▼                                                │
└─────────────────────────────┼────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ATLAS INFRASTRUCTURE                               │
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │  Cloudflare  │───▶│   Traefik    │───▶│ nois-landing │                   │
│  │  (DNS/TLS)   │    │   (proxy)    │    │  (Express)   │                   │
│  └──────────────┘    └──────────────┘    └──────┬───────┘                   │
│                                                  │                           │
│                                                  ▼                           │
│                                          ┌──────────────┐                   │
│                                          │   SQLite     │                   │
│                                          │   (leads)    │                   │
│                                          └──────────────┘                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

The system consists of two independent components:

1. **nois CLI** - Runs locally on user machines, analyzes Kubernetes logs, generates reports
2. **Landing/Backend** - Captures leads, issues tokens, serves landing page

These components communicate minimally. The CLI validates tokens against the backend but never uploads log data.

## nois CLI Architecture

### Log Collection

Logs are collected via `kubectl logs` using the user's existing kubeconfig. The CLI does not connect directly to Kubernetes API servers unless explicitly configured.

```
User runs: nois quickstart
         ↓
kubectl get pods --show-labels (discover selectors)
         ↓
kubectl logs -l app=xyz --since=30m (fetch logs)
         ↓
Write to local JSONL bundle (bundle.jsonl)
```

**Key design decisions:**

- Uses kubectl as the transport layer (leverages user's existing auth)
- Stores logs as newline-delimited JSON (one log entry per line)
- Each entry contains: timestamp, pod name, container name, log line
- Bundle files are written to local filesystem only

### Log Processing Pipeline

```
bundle.jsonl
    ↓
Parse log lines (timestamp, level, message)
    ↓
Group similar messages (pattern normalization)
    ↓
Classify groups by kind (timeout, auth, websocket, generic)
    ↓
Calculate noise score
    ↓
Detect quality findings (semantic mismatches, misleveled logs)
    ↓
Generate markdown report
```

**Pattern normalization:**

- Hex strings (UUIDs, hashes) replaced with `<hex>`
- Numbers replaced with `<n>`
- IP addresses replaced with `<ip>`
- Email addresses replaced with `<email>`

This allows grouping of semantically similar log lines regardless of specific values.

### Token Consumption Model

```
Token = { id: string, credits: number }

On each CLI run:
  1. Load token from ~/.nois/token
  2. Validate token against backend (optional, can be offline)
  3. If valid and credits > 0: proceed, decrement credit locally
  4. If credits = 0: prompt user to purchase more
```

Tokens are reused across purchases. When a user buys more credits, the same token is topped up.

### Privacy Guarantees

| Data Type | Stored Locally | Sent to Backend | Sent to LLM |
|-----------|----------------|-----------------|-------------|
| Raw logs | Yes | No | No |
| Pod names | Yes | No | No |
| Namespace names | Yes | No | No |
| IP addresses | Yes | No | No |
| Normalized patterns | Yes | No | Yes (explain only) |
| Group statistics | Yes | No | Yes (explain only) |
| Token ID | Yes | Yes | No |
| Run count | Yes | Yes | No |

## Landing and Backend Architecture

### Express Server

The landing backend is a single Express.js application with these responsibilities:

1. Serve static landing page files
2. Handle email verification flow
3. Issue access tokens
4. Capture email leads via API
5. Health check endpoint for load balancer

**No authentication system.** No user sessions. No cookies. The only persistent data is leads, users, and tokens.

### Email Verification Flow

```
1. User submits email
   POST /api/request-verification { email }
   
2. Server generates 64-char random code
   Stores in email_verifications table
   Sends verification email with link
   
3. User clicks verification link
   GET /api/verify-email?code=xxx
   
4. Server validates code
   - Not expired (15 min)
   - Not already used
   
5. Server creates user (if new)
   Creates token with 5 credits (if no token exists)
   Sends token via email
   
6. User receives token
   nois_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Token Generation

Tokens are prefixed with `nois_` followed by 48 random hex characters:

```javascript
function generateAccessToken() {
    return 'nois_' + crypto.randomBytes(24).toString('hex');
}
```

Tokens are:
- Never regenerated for the same user
- Reused across purchases
- Not stored in frontend
- Not included in URLs

### Database Schema

```sql
-- Leads (early access signups)
CREATE TABLE leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    source TEXT,
    user_agent TEXT,
    ip TEXT,
    created_at TEXT NOT NULL
);

-- Verified users
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    verified_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- Access tokens
CREATE TABLE tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    credits_remaining INTEGER DEFAULT 5,
    created_at TEXT NOT NULL
);

-- Verification codes
CREATE TABLE email_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL
);
```

### Security

**Rate limiting:**

- 10 requests per minute per IP (general)
- 3 verification requests per minute per IP
- 3 verification requests per hour per email

**Headers (via Helmet):**

- Content-Security-Policy
- X-Frame-Options
- X-Content-Type-Options

**Verification codes:**

- 64 characters (32 random bytes, hex encoded)
- Single use
- 15 minute expiry
- Constant-time response (prevents email enumeration)

## Infrastructure

### Docker

**Container configuration:**

- Base image: node:20-alpine
- Multi-stage build (builder for native deps, runtime for production)
- Non-root user (appuser:1001)
- Health check via wget to /api/health
- Data volume at /data for SQLite persistence

### Traefik Routing

**Labels in compose.prod.yml:**

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.docker.network=traefik-net"
  - "traefik.http.routers.nois.entrypoints=websecure"
  - "traefik.http.routers.nois.rule=Host(`nois.atlas-di.app`)"
  - "traefik.http.routers.nois.tls=true"
  - "traefik.http.routers.nois.tls.certresolver=letsencrypt"
  - "traefik.http.services.nois.loadbalancer.server.port=8080"
```

**Traffic flow:**

```
Internet → Cloudflare (DNS) → Server:443 → Traefik → nois-landing:8080
```

## What Is Not Built

These features are intentionally excluded from the architecture:

| Feature | Reason |
|---------|--------|
| User accounts | Email-only identity is simpler and sufficient |
| Password authentication | Tokens are the only credential |
| Dashboard | Reports are markdown files, not live views |
| Real-time log ingestion | CLI pulls logs on-demand |
| Log storage backend | Logs never leave user environment |
| WebSocket connections | No need for real-time updates |
| Payment processing | Not yet implemented |
| Token rotation | Not needed for current use case |

The architecture is intentionally minimal.
