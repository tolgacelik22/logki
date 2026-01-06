# Sales and Growth Strategy

This document explains how klog-ai is sold and how it grows.

---

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

Subscriptions work when users derive continuous value. Log analysis is episodic. A team might run klog-ai intensively during a reliability sprint, then not touch it for months. Charging $29/month for months of zero usage creates resentment and churn.

Pay-per-run aligns payment with value. Users pay when they get something. When they do not use it, they do not pay.

**Why not usage-based pricing (per log line):**

Log volume is unpredictable. A user running analysis on a high-traffic namespace might consume 10x more logs than expected. Surprise bills destroy trust. Fixed-price runs are predictable.

**Why volume discounts:**

Larger packs cost less per run. This rewards committed users and increases average order value. A user deciding between 20 and 100 runs sees that 100 runs is better value, encouraging a larger purchase.

**Why credits never expire:**

Expiring credits create urgency but also frustration. A user who bought 100 credits and only used 50 feels punished. Non-expiring credits remove this friction. Users buy with confidence.

---

## Free Tier Strategy

Every new user gets 5 free runs.

### Purpose

**Reduce friction to first value:**

The decision to try klog-ai should not require payment. A user should be able to install, run, and see a report before any financial commitment.

**Prove value before asking for money:**

5 runs is enough to:
- Analyze 2-3 namespaces
- See the report format
- Understand the noise score
- Decide if the findings are actionable

If 5 runs do not demonstrate value, the product has failed, not the user.

**Filter serious users:**

5 free runs is enough for evaluation but not enough for ongoing use. Users who find value will need to purchase more. This naturally segments evaluators from adopters.

### What Free Tier Is Not

It is not a perpetual free plan. There is no "free forever with limitations" tier. Free runs are a trial, not a product tier.

---

## Email Identity

### Why Email Only

**No passwords to manage:**

Password systems require reset flows, breach notifications, credential storage. Email-only identity removes all of this. The token is the credential.

**No accounts to create:**

Account creation adds friction. Name, password, confirm password, verify email, log in. Email-only is: enter email, receive token, done.

**Sales and growth leverage:**

Email is a direct channel. It enables:
- Token delivery
- Usage notifications ("You have 2 credits remaining")
- Upgrade prompts ("Buy more credits")
- Product updates ("New feature: CI integration")

An email address is more valuable than a username. It is a communication channel, not just an identifier.

### Email Capture Flow

```
Landing page → User enters email → Lead stored → Verification email sent
→ User clicks link → Token generated → Token emailed to user
```

Current state: Lead capture is implemented. Verification and token issuance are not yet built.

---

## Upgrade and Expansion

### Individual User Path

```
Free (5 runs) → Small (20 runs) → Medium (100 runs) → Large (500 runs)
```

Triggers for upgrade:
- "You have 0 credits remaining"
- User wants to run analysis again
- User wants to analyze more namespaces

### Team Expansion

Individual users do not share tokens. Each team member gets their own token.

Expansion happens organically:
1. Engineer A uses klog-ai, finds value
2. Engineer A shares report with team
3. Engineer B wants to run their own analysis
4. Engineer B signs up, gets own token

This is peer-to-peer distribution. No sales call required. No enterprise license negotiation.

### Future: Team Plans

When demand warrants, team plans may be added:
- Shared credit pool
- Centralized billing
- Usage visibility across team

This is not currently built. Individual tokens are sufficient for early stage.

---

## Distribution Channels

### OSS Adjacency

klog-ai is not open source, but it operates in the open source ecosystem.

**GitHub presence:**

- Public repository with documentation
- Issues and discussions for feedback
- Sample reports and examples

**Integration with OSS tools:**

- Uses kubectl (standard Kubernetes CLI)
- Outputs markdown (universal format)
- No proprietary lock-in

Engineers in OSS-heavy environments are comfortable with CLI tools that integrate with their existing workflow.

### CLI Virality

CLIs spread differently than SaaS products.

**Install command sharing:**

```bash
curl -fsSL https://klog.atlas-di.app/install.sh | sh
```

This command can be pasted in Slack, added to a README, or included in a blog post. One line gets someone from zero to installed.

**Report sharing:**

A klog-ai report is a markdown file. It can be:
- Attached to a PR: "Here's the log quality analysis for this service"
- Pasted in a Slack thread: "This is why we're getting paged"
- Included in an incident postmortem: "Pre-incident noise score was 73/100"

Every shared report is an implicit product endorsement.

### Engineering Word-of-Mouth

The target audience (senior engineers, SREs) operates in tight professional networks.

**Conference talks:**

"How we reduced on-call noise by 60%" with klog-ai as a supporting tool.

**Blog posts:**

Engineering blog posts about logging best practices, with klog-ai analysis as evidence.

**Team recommendations:**

"We used this tool at my last company, it found 12 semantic mismatches in our payment service."

This channel is slow but high-converting. A recommendation from a trusted peer is worth more than any ad.

---

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

---

## What Not to Optimize For

### Do Not Optimize for Volume

More signups is not better if they do not convert. A smaller list of qualified leads who run the tool and buy credits is more valuable than a large list of curious visitors who never install.

### Do Not Optimize for Virality

Artificial referral programs ("Get 5 free runs for each friend") create low-quality signups. Organic word-of-mouth from satisfied users is slower but more durable.

### Do Not Optimize for Enterprise Sales (Yet)

Enterprise sales requires: sales team, legal review, security questionnaire, SOC 2, custom contracts. This is expensive and distracting at early stage. Focus on individual users and small teams. Enterprise will come later, organically, when teams within enterprises are already using the product.

---

## Early Stage vs Later Stage

### Early Stage (Current)

**Goal:** Find product-market fit with individual engineers.

**Strategy:**
- Simple landing page
- Email capture
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

---

## Growth Constraints

### What Slows Growth

**Category creation:**

"Log quality analysis" is not an established category. Users do not search for it. Education is required before purchase.

**CLI barrier:**

Some potential users are not comfortable with CLIs. They will not adopt regardless of value proposition.

**Episodic use:**

Users do not need this tool every day. Forgetting about it between uses is a real risk.

### What Accelerates Growth

**Pain severity:**

Alert fatigue is a real problem. Engineers who have been woken up at 3am for non-issues are motivated to fix the root cause.

**Quick time to value:**

5 minutes from install to first report. If the report surfaces something actionable, the user is hooked.

**Shareable output:**

Reports are artifacts that spread. A good report shared in the right channel reaches multiple potential users.

---

## Summary

klog-ai sells itself when it delivers clear value quickly. The growth strategy is:

1. Make first run effortless (free tier, simple install)
2. Generate reports that users want to share
3. Let word-of-mouth carry adoption
4. Capture email to enable upgrade path
5. Price fairly to encourage repeat usage

No sales team. No advertising. No growth hacks. Just a useful tool that spreads through engineering networks.

