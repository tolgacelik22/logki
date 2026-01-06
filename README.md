# klog-ai Landing

Landing page for klog-ai with lead capture API.

## What is klog-ai

klog-ai analyzes your Kubernetes logs to detect semantic mismatches, log design bugs, and alert noise — before they become incidents.

- CLI tool (runs on your machine)
- Pay-per-run (credit-based, no subscriptions)
- Token-based access (no passwords, no dashboards)
- Privacy-first (logs never leave your machine)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Traefik                              │
│                  (TLS termination)                       │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                 klog-landing                             │
│                                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Express   │───▶│   SQLite    │    │   Static    │  │
│  │   Server    │    │   (WAL)     │    │   Files     │  │
│  └─────────────┘    └─────────────┘    └─────────────┘  │
│                                                          │
│  Endpoints:                                              │
│  - GET  /              (landing page)                    │
│  - POST /api/lead      (capture email)                   │
│  - GET  /api/health    (health check)                    │
│  - GET  /api/admin/leads?key=...  (admin only)          │
└─────────────────────────────────────────────────────────┘
```

## API Endpoints

### POST /api/lead

Capture early access email.

**Request:**
```json
{
  "email": "user@example.com",
  "source": "landing",
  "ts": 1704556800000,
  "ua": "Mozilla/5.0..."
}
```

**Response (201 - created):**
```json
{ "ok": true, "status": "created" }
```

**Response (200 - already exists):**
```json
{ "ok": true, "status": "exists" }
```

**Response (400 - invalid email):**
```json
{ "ok": false, "error": "Invalid email format" }
```

**Response (429 - rate limited):**
```json
{ "ok": false, "error": "Too many requests" }
```

### GET /api/admin/leads?key=...

Retrieve recent leads (requires ADMIN_KEY).

**Response:**
```json
{
  "ok": true,
  "count": 42,
  "leads": [
    { "email": "user@example.com", "created_at": "2024-01-06T12:00:00.000Z", "source": "landing" }
  ]
}
```

### GET /api/health

Health check for load balancer.

**Response:**
```json
{ "ok": true }
```

## Deployment

### Prerequisites

1. **Traefik** running with letsencrypt certresolver
2. **External network**: `docker network create traefik-net`
3. **DNS**: Point `klog.atlas-di.app` A record to your server IP (via Cloudflare or other DNS provider)

### Deploy to Production

```bash
# Clone repository
git clone https://github.com/atlas-tools/klog-landing.git
cd klog-landing

# Set admin key (generate a random string)
export ADMIN_KEY=$(openssl rand -hex 32)
echo "ADMIN_KEY=$ADMIN_KEY" >> .env

# Deploy
docker compose -f compose.prod.yml up -d --build

# Check status
docker compose -f compose.prod.yml ps
docker compose -f compose.prod.yml logs -f
```

### View Leads

```bash
curl "https://klog.atlas-di.app/api/admin/leads?key=$ADMIN_KEY"
```

### Update

```bash
git pull
docker compose -f compose.prod.yml up -d --build
```

### Backup Database

```bash
# Copy SQLite database from volume
docker cp klog-landing:/data/leads.db ./backup-$(date +%Y%m%d).db
```

## Local Development

```bash
# Install dependencies
npm install

# Create data directory
mkdir -p data

# Run server
npm start

# Or with environment variables
PORT=3000 ADMIN_KEY=dev-key npm start
```

Open http://localhost:8080

## Environment Variables

| Variable   | Default            | Description                          |
|------------|--------------------|------------------------------------- |
| PORT       | 8080               | Server port                          |
| DB_PATH    | /data/leads.db     | SQLite database path                 |
| ADMIN_KEY  | (none)             | Key for /api/admin/leads endpoint    |

## Project Structure

```
logki/
├── server/
│   └── index.js        # Express server + API
├── public/
│   ├── index.html      # Landing page
│   ├── styles.css      # Styles
│   └── main.js         # Form handling
├── compose.prod.yml    # Production Docker Compose
├── Dockerfile          # Production image
├── package.json        # Node.js dependencies
└── README.md           # This file
```

## Security

- Email format strictly validated
- Rate limiting: 10 requests/minute per IP
- Security headers via Helmet
- Request body size limited to 16KB
- Request bodies not logged
- Non-root container user
- WAL mode for SQLite (crash-safe)

## Related

- [klog-ai CLI](https://github.com/atlas-tools/klog-ai) — The command-line tool
- [ATLAS Decision Intelligence](https://atlas-di.app) — Parent project

## License

MIT
