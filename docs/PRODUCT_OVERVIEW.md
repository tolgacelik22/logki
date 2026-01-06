# Product Overview

This document defines what klog-ai is, who it serves, and why it exists.

---

## What klog-ai Is

klog-ai is a command-line tool that analyzes Kubernetes log output for semantic consistency, noise patterns, and log design issues.

It runs locally on an engineer's machine. It pulls logs via kubectl. It generates a markdown report. It does not run continuously, does not install agents, and does not require a SaaS account.

**Core function:** Tell you which of your WARN and ERROR logs are actually meaningful, and which are noise you should fix or downgrade.

---

## What klog-ai Is Not

| klog-ai is NOT | Why |
|----------------|-----|
| An APM | Does not trace requests or measure latency |
| An alerting system | Does not page anyone or integrate with PagerDuty |
| A log viewer | Does not provide dashboards or search |
| A log aggregator | Does not store or index logs |
| An AI chatbot | Does not answer arbitrary questions |
| A SaaS dashboard | Has no login, no web UI for users |
| An agent | Does not run in your cluster |

---

## The Problem

### WARN and ERROR Have Lost Their Meaning

Most production Kubernetes deployments have log streams filled with warnings that are not actionable. Over time, engineers stop trusting these signals.

Common patterns:

- Business logic outcomes logged as WARN (e.g., "payment declined")
- Successful retries logged as WARN (e.g., "retrying, attempt 2/3")
- Expected client errors logged as ERROR (e.g., "user not found")
- Domain-specific codes treated as operational issues

The result: when a real incident happens, the warning is buried in thousands of false positives.

### Why Existing Tools Fail

**Log aggregators (Datadog, Splunk, Elastic):**
- Excellent at storing and searching logs
- Do not distinguish meaningful warnings from noise
- No opinion on log quality
- Cost scales with log volume, incentivizing less logging rather than better logging

**APM tools (New Relic, Dynatrace):**
- Focus on traces and metrics, not log semantics
- Treat logs as secondary data
- Do not analyze log message structure or level appropriateness

**AI-powered log tools:**
- Often focused on anomaly detection (statistical outliers)
- Do not understand the difference between business logic and operational errors
- Require continuous log ingestion (cost, privacy concerns)

**Manual review:**
- Does not scale
- Depends on tribal knowledge
- Often happens only after an incident

klog-ai fills a gap: structured, opinionated analysis of log semantics without requiring log ingestion or continuous monitoring.

---

## Target Audience

### Primary

**Senior backend engineers** who write and maintain services that generate logs. They care about on-call quality and understand the difference between a domain event and an infrastructure failure.

**SREs and platform engineers** who set logging standards across multiple teams. They need tools that can identify systemic log quality issues, not just individual bugs.

**On-call engineers** who are tired of being woken up for non-issues. They want to reduce alert fatigue by fixing the source, not by adding more ignore rules.

**Tech leads** responsible for service reliability. They need to make the case for logging improvements with concrete evidence.

### Secondary

**DevOps engineers** setting up new clusters or services who want to establish good logging patterns from the start.

**Consultants or contractors** auditing Kubernetes deployments and needing to quickly assess log quality.

### Explicitly Not For

| Who | Why |
|-----|-----|
| Beginners learning Kubernetes | Tool assumes familiarity with log levels, pods, and selectors |
| Hobby projects | Pay-per-run model is overkill for non-production use |
| Teams wanting dashboards | No web UI, no visualizations |
| Teams wanting real-time alerts | This is a batch analysis tool |
| Teams preferring SaaS subscriptions | No subscription model |
| Anyone expecting AI magic | Heuristics first, LLM second |

---

## Core Product Principles

### CLI-First

The primary interface is the command line. Reports are markdown files. There is no web dashboard, no mobile app, no Slack bot.

**Rationale:** Engineers already live in terminals. Adding a web UI creates maintenance burden, security surface, and UX debt without adding value. A markdown report can be attached to a PR, pasted in Slack, or read in any text editor.

### Local-Only Data

Logs never leave the user's machine. Analysis happens locally. The only network call is token validation (optional).

**Rationale:** Log data is sensitive. It may contain user IDs, IP addresses, internal service names, and error messages that reveal system architecture. Uploading this data creates legal, compliance, and trust issues. Keeping it local removes these concerns entirely.

### Pay-Per-Run

Users pay for what they use. No monthly fees. No annual contracts. One analysis = one credit.

**Rationale:** Log analysis is episodic. Teams do not run it continuously. A subscription model would charge users for months when they are not using the tool. Pay-per-run aligns cost with value delivered.

### Zero Dashboards

There is no user account. There is no login page. There is no usage dashboard. Identity is email. Authorization is token.

**Rationale:** Dashboards require authentication systems, session management, password resets, RBAC, audit logs. All of this is complexity that does not serve the core function: analyzing logs and producing reports. Removing the dashboard removes 80% of typical SaaS infrastructure.

---

## User Journey

### 1. Discovery

User finds klog-ai through:
- Engineering blog post or talk
- Recommendation from colleague
- Search for "kubernetes log quality" or "alert fatigue"
- GitHub discovery

### 2. Landing Page

User reads landing page at klog.atlas-di.app. Key messages:
- "Your logs are lying"
- Pay-per-run, no subscription
- Privacy-first, logs stay local
- First 5 runs free

### 3. Email Submission

User enters email to request early access. No password. No account creation.

### 4. Token Receipt

User receives token via email. Token includes 5 free credits.

### 5. CLI Installation

```bash
curl -fsSL https://klog.atlas-di.app/install.sh | sh
```

Or via pipx:

```bash
pipx install git+https://github.com/atlas-tools/klog-ai.git
```

### 6. First Run

```bash
klog-ai quickstart
```

Interactive flow:
- Detect kubectl connectivity
- Select namespace and selectors
- Fetch logs
- Generate report

### 7. Report Review

User opens report.md. Sees:
- Noise score (e.g., 73/100)
- Quality findings with evidence
- Top WARN/ERROR groups with examples
- Suggested fixes

### 8. Action

User takes action:
- Opens PR to fix log levels
- Updates alerting thresholds
- Shares report with team
- Adds ignore rules for known issues

### 9. Repeat

User runs klog-ai periodically:
- After major deployments
- When on-call noise increases
- As part of quarterly reliability reviews

### 10. Credit Top-Up

When credits run out, user returns to landing page, purchases more credits using the same email. Credits are added to existing token.

---

## Product Philosophy

### Opinionated by Default

klog-ai has opinions about what constitutes good logging practice. It will flag a successful retry logged at WARN. It will flag a domain-specific error code logged as an operational warning. These opinions are based on real-world experience with production Kubernetes systems.

Users can override these opinions with ignore rules, but the default is to surface potential issues.

### Deterministic First, AI Second

The core analysis is rule-based and deterministic. Pattern matching, grouping, and classification use heuristics that produce consistent results.

LLM analysis (via the `explain` command) is optional and additive. It provides natural language explanations but does not change the core findings.

This means:
- Reports are reproducible
- No surprise variations between runs
- LLM costs are opt-in

### Reports, Not Dashboards

The output is a markdown file. It can be:
- Committed to a repository
- Attached to a Jira ticket
- Pasted in a Slack thread
- Diffed against previous reports

Dashboards require users to visit a website. Reports go where users already work.

### Ephemeral Execution

klog-ai is not a daemon. It does not run in the background. It does not install cron jobs. It runs when invoked, produces output, and exits.

This means:
- No resource consumption when not in use
- No version drift between cluster and analyzer
- No security surface when not actively analyzing

---

## Long-Term Vision

### Near-Term (Current)

- Lead capture and early access distribution
- Core CLI functionality (fetch, report, explain)
- Pay-per-run credit system

### Medium-Term

- CI/CD integration (run on PR, fail if noise score increases)
- Team sharing (reports uploaded to shared workspace, opt-in)
- Historical comparison (diff reports over time)

### Long-Term

- Language-aware analysis (understand log formats by framework)
- Fix generation (suggest code changes, not just log level changes)
- Integration with logging libraries (emit warnings at development time)

### What Will Not Change

- CLI-first interface
- Local-only log processing
- Pay-per-run pricing
- No user accounts or dashboards

