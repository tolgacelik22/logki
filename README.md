# nois Landing

Landing page for nois with lead capture and email verification.

## What is nois

nois surfaces the noise hiding your real incidents. Run it locally. Get a report. Fix your logging.

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
│                  nois-landing                            │
│                                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Express   │───▶│   SQLite    │    │   Static    │  │
│  │   Server    │    │   (WAL)     │    │   Files     │  │
│  └─────────────┘    └─────────────┘    └─────────────┘  │
│                                                          │
│  Endpoints:                                              │
│  - GET  /                     (landing page)             │
│  - POST /api/request-verification  (start verification) │
│  - GET  /api/verify-email     (complete verification)   │
│  - GET  /api/health           (health check)            │
│  - GET  /api/admin/leads      (admin only)              │
└─────────────────────────────────────────────────────────┘
```

## API Endpoints

### POST /api/request-verification

Request email verification to receive access token.

**Request:**
```json
{ "email": "user@example.com" }
```

**Response:**
```json
{ "ok": true, "message": "If this email is valid, you will receive a verification link." }
```

### GET /api/verify-email?code=...

Complete email verification. Issues token and sends it via email.

### GET /api/health

Health check for load balancer.

**Response:**
```json
{ "ok": true }
```

### GET /api/admin/leads?key=...

Retrieve recent leads (requires ADMIN_KEY).

## Deployment

### Prerequisites

1. **Traefik** running with letsencrypt certresolver
2. **External network**: `docker network create traefik-net`
3. **DNS**: Point `nois.atlas-di.app` A record to your server IP

### Deploy to Production

```bash
# Set environment variables
export ADMIN_KEY=$(openssl rand -hex 32)
export BASE_URL=https://nois.atlas-di.app

# SMTP (optional)
export SMTP_HOST=smtp.example.com
export SMTP_USER=user
export SMTP_PASS=pass
export SMTP_FROM="nois <noreply@atlas-di.app>"

# Build and deploy
docker build -t nois-landing .
docker compose -f compose.prod.yml up -d

# Check status
docker compose -f compose.prod.yml logs -f
```

### View Leads

```bash
curl "https://nois.atlas-di.app/api/admin/leads?key=$ADMIN_KEY"
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
| DB_PATH    | ./data/leads.db    | SQLite database path                 |
| ADMIN_KEY  | (none)             | Key for admin endpoints              |
| BASE_URL   | http://localhost:8080 | Base URL for verification links   |
| SMTP_HOST  | (none)             | SMTP server for sending emails       |
| SMTP_USER  | (none)             | SMTP username                        |
| SMTP_PASS  | (none)             | SMTP password                        |
| SMTP_FROM  | nois <noreply@...> | From address for emails              |

## Project Structure

```
nois-landing/
├── server/
│   └── index.js        # Express server + API
├── public/
│   ├── index.html      # Landing page
│   ├── styles.css      # Styles
│   └── main.js         # Form handling
├── docs/               # Documentation
├── compose.prod.yml    # Production Docker Compose
├── Dockerfile          # Production image
├── package.json        # Node.js dependencies
└── README.md           # This file
```

## Security

- Email format strictly validated
- Rate limiting: 10 requests/minute per IP
- Verification rate limiting: 3 per email per hour
- Security headers via Helmet
- Request body size limited to 16KB
- Request bodies not logged
- Non-root container user
- WAL mode for SQLite (crash-safe)
- Single-use verification codes
- 15-minute code expiry

## Related

- [nois CLI](https://github.com/atlas-tools/nois) — The command-line tool

## License

MIT
