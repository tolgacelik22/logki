# Technical Architecture

This document describes the technical architecture of klog-ai and its supporting infrastructure.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER ENVIRONMENT                                │
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │   kubectl    │───▶│   klog-ai    │───▶│  report.md   │                   │
│  │   (logs)     │    │   CLI        │    │  (local)     │                   │
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
│  │  Cloudflare  │───▶│   Traefik    │───▶│ klog-landing │                   │
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

1. **klog-ai CLI** - Runs locally on user machines, analyzes Kubernetes logs, generates reports
2. **Landing/Backend** - Captures leads, issues tokens, serves landing page

These components communicate minimally. The CLI validates tokens against the backend but never uploads log data.

---

## klog-ai CLI Architecture

### Log Collection

Logs are collected via `kubectl logs` using the user's existing kubeconfig. The CLI does not connect directly to Kubernetes API servers unless explicitly configured.

```
User runs: klog-ai quickstart
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

### LLM Analysis

When the `explain` command is invoked, grouped log data is sent to an LLM (OpenAI) for deeper analysis.

**What is sent:**

- Normalized log patterns (not raw logs)
- Group counts and timestamps
- Quality findings detected by heuristics

**What is NOT sent:**

- Raw log content
- Pod names, namespace names
- IP addresses, user IDs
- Any identifiable cluster metadata

The LLM provides natural language explanations and fix suggestions based on patterns.

### Token Consumption Model

```
Token = { id: string, credits: number }

On each CLI run:
  1. Load token from ~/.klogai/token
  2. Validate token against backend (optional, can be offline)
  3. If valid and credits > 0: proceed, decrement credit locally
  4. If credits = 0: prompt user to purchase more
```

Tokens are reused across purchases. When a user buys more credits, the same token is topped up.

### Output Formats

**Report structure:**

```
reports/
├── report.md           # Human-readable markdown report
├── bundle.jsonl        # Raw collected logs
└── ignore.yaml         # User-defined ignore rules
```

**Report contents:**

- Summary statistics (noise score, level counts, sources)
- Assessment (classification, severity, trend analysis)
- Quality findings with evidence and suggestions
- Top WARN/ERROR groups with examples

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

---

## Landing and Backend Architecture

### Express Server

The landing backend is a single Express.js application with these responsibilities:

1. Serve static landing page files
2. Capture email leads via API
3. Validate admin access for lead export
4. Health check endpoint for load balancer

**No authentication system.** No user sessions. No cookies. The only persistent data is the leads table.

### API Endpoints

```
POST /api/lead
  Request:  { email, source?, ua? }
  Response: { ok: true, status: "created" | "exists" }
  
  - Validates email format
  - Normalizes to lowercase
  - Stores in SQLite
  - Returns 200 if already exists (idempotent)

GET /api/health
  Response: { ok: true }
  
  - Used by Traefik/Docker health checks

GET /api/admin/leads?key=...
  Response: { ok: true, leads: [...] }
  
  - Protected by ADMIN_KEY environment variable
  - Returns last 200 leads
  - No pagination (intentionally simple)
```

### Email Capture Flow

```
User enters email on landing
         ↓
Frontend validates format
         ↓
POST /api/lead { email, source: "landing" }
         ↓
Server validates, normalizes, checks uniqueness
         ↓
INSERT into leads table
         ↓
Return success, frontend shows confirmation
```

**Current state:** Email is captured but not acted upon. Token issuance is not yet implemented. The flow ends at lead capture.

### Token Issuance (Conceptual)

When implemented, the flow will be:

```
1. User submits email
2. Backend sends verification email with code
3. User enters code
4. Backend creates token: { id: uuid, email, credits: 5 }
5. Token sent to user via email
6. User stores token locally
```

Token storage in backend:

```sql
CREATE TABLE tokens (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  credits INTEGER DEFAULT 5,
  created_at TEXT NOT NULL,
  last_used_at TEXT
);
```

**Not yet built.** Current backend only captures leads.

### SQLite Usage

Single database file at `/data/leads.db`.

**Schema:**

```sql
CREATE TABLE leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  source TEXT,
  user_agent TEXT,
  ip TEXT,
  created_at TEXT NOT NULL
);
```

**Configuration:**

- WAL mode enabled for crash safety
- Single writer, no concurrent write conflicts expected
- Volume-mounted for persistence across container restarts

### Security

**Rate limiting:**

- 10 requests per minute per IP
- In-memory map, cleared on restart
- Applied only to POST /api/lead

**Headers (via Helmet):**

- Content-Security-Policy (self + Google Fonts)
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security (via Traefik)

**Request handling:**

- Body size limited to 16KB
- Request bodies not logged
- IP extracted from X-Forwarded-For (trust proxy enabled)

**Admin endpoint:**

- Protected by ADMIN_KEY environment variable
- No key = endpoint disabled
- Wrong key = 401 response

---

## Infrastructure

### Docker

**Container configuration:**

- Base image: node:20-alpine
- Multi-stage build (builder for native deps, runtime for production)
- Non-root user (appuser:1001)
- Health check via wget to /api/health
- Data volume at /data for SQLite persistence

**Build process:**

```dockerfile
# Stage 1: Build native dependencies
FROM node:20-alpine AS builder
RUN apk add python3 make g++
RUN npm ci

# Stage 2: Runtime
FROM node:20-alpine
RUN apk add libstdc++
COPY --from=builder /app/node_modules ./node_modules
```

### Traefik Routing

**Labels in compose.prod.yml:**

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.docker.network=traefik-net"
  - "traefik.http.routers.klog.entrypoints=websecure"
  - "traefik.http.routers.klog.rule=Host(`klog.atlas-di.app`)"
  - "traefik.http.routers.klog.tls=true"
  - "traefik.http.routers.klog.tls.certresolver=letsencrypt"
  - "traefik.http.services.klog.loadbalancer.server.port=8080"
```

**Traffic flow:**

```
Internet → Cloudflare (DNS) → Server:443 → Traefik → klog-landing:8080
```

### Cloudflare

- DNS A record: klog.atlas-di.app → server IP
- Proxy status: DNS only (Traefik handles TLS)
- Or: Proxied (Cloudflare TLS termination, Traefik re-encryption)

TLS certificates issued by Let's Encrypt via Traefik's ACME challenge.

---

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
| Multiple databases | SQLite is sufficient for lead capture scale |
| Background workers | All processing is request-driven |
| Message queues | No async processing required |
| Caching layer | Static files cached by browser, no dynamic cache needed |

The architecture is intentionally minimal. Complexity is avoided unless it directly serves the core use case.

