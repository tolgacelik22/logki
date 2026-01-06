# Sales and Growth Strategy

This document explains how nois is sold and how it grows.

## Pricing Model

### Pay-Per-Run Credits

| Tier | Runs | Price | Per Run |
|------|------|-------|---------|
| Starter | 5 | Free | - |
| Small | 20 | $9 | $0.45 |
| Medium | 100 | $29 | $0.29 |
| Large | 500 | $79 | $0.16 |

Credits never expire. Unused credits carry forward indefinitely.

### Rationale

**Why not subscriptions:**

Subscriptions work when users derive continuous value. Log analysis is episodic. A team might run nois intensively during a reliability sprint, then not touch it for months. Charging $29/month for months of zero usage creates resentment and churn.

Pay-per-run aligns payment with value. Users pay when they get something. When they do not use it, they do not pay.

**Why not usage-based pricing (per log line):**

Log volume is unpredictable. A user running analysis on a high-traffic namespace might consume 10x more logs than expected. Surprise bills destroy trust. Fixed-price runs are predictable.

**Why volume discounts:**

Larger packs cost less per run. This rewards committed users and increases average order value.

**Why credits never expire:**

Expiring credits create urgency but also frustration. A user who bought 100 credits and only used 50 feels punished. Non-expiring credits remove this friction.

## Free Tier Strategy

Every new user gets 5 free runs.

### Purpose

**Reduce friction to first value:**

The decision to try nois should not require payment. A user should be able to install, run, and see a report before any financial commitment.

**Prove value before asking for money:**

5 runs is enough to:
- Analyze 2-3 namespaces
- See the report format
- Understand the noise score
- Decide if the findings are actionable

If 5 runs do not demonstrate value, the product has failed, not the user.

**Filter serious users:**

5 free runs is enough for evaluation but not enough for ongoing use. Users who find value will need to purchase more.

### What Free Tier Is Not

It is not a perpetual free plan. There is no "free forever with limitations" tier. Free runs are a trial, not a product tier.

## Email Identity

### Why Email Only

**No passwords to manage:**

Password systems require reset flows, breach notifications, credential storage. Email-only identity removes all of this. The token is the credential.

**No accounts to create:**

Account creation adds friction. Name, password, confirm password, verify email, log in. Email-only is: enter email, verify, receive token, done.

**Sales and growth leverage:**

Email is a direct channel. It enables:
- Token delivery
- Usage notifications ("You have 2 credits remaining")
- Upgrade prompts ("Buy more credits")
- Product updates ("New feature: CI integration")

An email address is more valuable than a username. It is a communication channel, not just an identifier.

## Distribution Channels

### OSS Adjacency

nois is not open source, but it operates in the open source ecosystem.

**GitHub presence:**

- Public repository with documentation
- Issues and discussions for feedback
- Sample reports and examples

**Integration with OSS tools:**

- Uses kubectl (standard Kubernetes CLI)
- Outputs markdown (universal format)
- No proprietary lock-in

### CLI Virality

CLIs spread differently than SaaS products.

**Install command sharing:**

```bash
curl -fsSL https://nois.atlas-di.app/install.sh | sh
```

This command can be pasted in Slack, added to a README, or included in a blog post. One line gets someone from zero to installed.

**Report sharing:**

A nois report is a markdown file. It can be:
- Attached to a PR: "Here's the log quality analysis for this service"
- Pasted in a Slack thread: "This is why we're getting paged"
- Included in an incident postmortem: "Pre-incident noise score was 73/100"

Every shared report is an implicit product endorsement.

### Engineering Word-of-Mouth

The target audience (senior engineers, SREs) operates in tight professional networks.

**Conference talks:**

"How we reduced on-call noise by 60%" with nois as a supporting tool.

**Blog posts:**

Engineering blog posts about logging best practices, with nois analysis as evidence.

**Team recommendations:**

"We used this tool at my last company, it found 12 semantic mismatches in our payment service."

This channel is slow but high-converting.

## Metrics That Matter

### Leading Indicators

| Metric | Why It Matters |
|--------|----------------|
| Email signups | Top of funnel, measures awareness |
| Token activations | Conversion from signup to usage |
| First run completion | Did the user get value on first try |
| Reports generated per user | Engagement depth |

### Lagging Indicators

| Metric | Why It Matters |
|--------|----------------|
| Credit purchases | Revenue, product-market fit signal |
| Repeat purchases | Retention, ongoing value |
| Credits used / credits purchased | Are users finding value |

### Metrics That Do Not Matter (Yet)

| Metric | Why Not |
|--------|---------|
| DAU/MAU | This is not a daily-use product |
| Session duration | CLI runs are seconds, not sessions |
| Page views | Landing page is a means to an end |
| Social followers | Vanity metric at this stage |

## Early Stage vs Later Stage

### Early Stage (Current)

**Goal:** Find product-market fit with individual engineers.

**Strategy:**
- Simple landing page
- Email verification
- Free tier to reduce friction
- Direct user feedback via email
- Iterate on CLI based on usage patterns

**Do not do:**
- Enterprise sales outreach
- Paid advertising
- Integration partnerships
- Feature expansion before core is solid

### Later Stage (Future)

**Goal:** Scale adoption across teams and organizations.

**Strategy:**
- Team plans with shared billing
- CI/CD integrations (run on PR)
- Enterprise security features (SSO, audit logs)
- Partner integrations (logging platforms, incident tools)
- Content marketing at scale

**Trigger to transition:**
- Consistent repeat purchases from multiple unrelated users
- Organic team expansion (multiple users from same domain)
- Inbound enterprise inquiries

## Summary

nois sells itself when it delivers clear value quickly. The growth strategy is:

1. Make first run effortless (free tier, simple install)
2. Generate reports that users want to share
3. Let word-of-mouth carry adoption
4. Capture email to enable upgrade path
5. Price fairly to encourage repeat usage

No sales team. No advertising. No growth hacks. Just a useful tool that spreads through engineering networks.
