---
name: business-context
description: "Core business identity and strategic context for the Spot Platform. This skill MUST be consulted before making any product decisions, feature changes, UI/UX modifications, pricing adjustments, or strategic pivots. It encodes the founder's vision, business model, competitive positioning, and go-to-market strategy. Trigger on any work that affects what Spot IS, who it serves, how it earns money, or how it differs from competitors. Also trigger when discussing roadmap, revenue, positioning, partnerships, or business model. This context is the anchor — code changes serve the business, not the other way around."
---

# Spot Platform — Business Context Skill

**Purpose:** This skill ensures every code change, feature addition, and product decision stays aligned with Spot's core identity and business strategy. Read this BEFORE making changes. Reference files contain deeper detail.

## The One-Liner

**Spot closes the attribution gap between food creators and restaurants.**

## Mission

Enable food creators to turn restaurant collaborations into recurring revenue by proving which partnerships drive real traffic, giving restaurants measurable ROI, and giving audiences a curated discovery experience.

## Vision

Become the standard platform for food creator-restaurant attribution — the "Google Analytics for creator partnerships."

## Core Philosophy: Nobody Gets Exploited

This is non-negotiable and shapes every feature:

- **Restaurants should NOT pay creators upfront** to eat and post. That's exploitative.
- **Creators create content because that's their craft.** They eat, film, and post. Spot is the attribution layer that proves when that content drives real business.
- **Value flows from proven results.** Restaurants offer deals/perks via creator's Spot link. When those drive traffic, both sides see the data and profit.
- **The deal IS the mutual benefit.** No one pays for something that hasn't generated results.

> When evaluating any feature: "Does this make someone pay for unproven value?" If yes, redesign it.

## Three User Roles

| Role | Who | Pain Point | What Spot Gives Them |
|------|-----|-----------|---------------------|
| **Creator** | Food influencer (1K–500K followers) | Can't prove content drives restaurant visits | Attribution portfolio, recurring revenue, professional tools |
| **Partner** (Restaurant) | Independent/small-chain restaurants | Spend on creators with zero measurable ROI | Tracked attribution, content approval, real customer data |
| **Insider** (Audience) | Food enthusiasts following creators | No centralized creator-endorsed restaurant deals | Exclusive deals, discovery, saved lists |

## Revenue Model

| Tier | Price | Target | Key Features |
|------|-------|--------|-------------|
| Starter | $49/mo | Emerging creators (1K–10K) | Campaign management, basic analytics, 2 active campaigns |
| Pro | $99/mo | Growing creators (10K–100K) | Full analytics, ROI reporting, calendar, AI insights, unlimited campaigns |
| Scale | $149/mo | Established creators (100K+) | Multi-creator collabs, ambassador program, API access, priority support |

**Restaurants join FREE.** They only invest in partnerships that deliver measurable results. Spot takes a small platform fee on successful partnerships.

**Unit economics:** ~95% gross margin, breakeven at ~5 paying creators, LTV:CAC target >7:1

## Competitive Positioning

**Spot's unique position:** No competitor owns creator-first attribution in the restaurant space.

| Competitor | Their Model | Spot's Advantage |
|-----------|------------|-----------------|
| Mustard | Restaurant-pays-creator marketplace ($299+/mo) | Spot is creator-first, 6x cheaper, attribution-focused |
| Beli | Consumer restaurant discovery (free) | No creator tools, no attribution, no B2B revenue |
| Yelp | Consumer reviews (ad-based) | Spot tracks actual foot traffic, not reviews |
| Spreadsheets + DMs | How creators manage partnerships today | Spot replaces manual workflows with SaaS tooling |

**Moats:** Closed-loop POS attribution, creator-first model, data network effects (more creators = better benchmarks), low price point accessibility.

## Go-to-Market

1. **Phase 1 (Current): DC Market** — 20–50 DC food creators, 50–100 DC restaurants. Direct outreach via Darren's existing DC Spot network. Prove attribution in one city.
2. **Phase 2: Regional** — NYC, LA, Chicago, Miami. Ambassador referral program + social proof from DC success.
3. **Phase 3: National** — Self-serve onboarding, content marketing, industry events.

## Three Product Concepts

| Concept | Name | What It Does | Current Status |
|---------|------|-------------|---------------|
| Concept 1 | Platform | Creator-Restaurant partnerships (campaigns, proposals, content review, offers) | Polished |
| Concept 2 | Insider | Consumer discovery app (deals, saved restaurants, membership) | Functional (deprioritized per strategy) |
| Concept 3 | SpotOps | Creator tools (dashboard, CRM, calendar, content archive, AI insights, ROI reporter) | Polished |

**Strategic priority:** Lead with Concept 1 + 3 (creator-facing). Concept 2 grows organically as audiences discover creator deals.

## Decision Framework

When making any product/code decision, apply these filters in order:

1. **Does it serve attribution?** Spot's core value is proving creator content drives restaurant traffic.
2. **Does it help creators?** Creator adoption drives the flywheel. If creators don't use it, nothing else matters.
3. **Does it maintain the "nobody gets exploited" philosophy?** No feature should force upfront payment for unproven value.
4. **Does it fit the current phase?** DC launch first. Don't build for national scale before proving local product-market fit.
5. **Does it stay within budget?** $50/mo AWS cap. Every new resource needs a cost justification.

## Reference Files

For deeper context on specific topics, see:
- `references/value-proposition.md` — Full value prop, unit economics, and revenue projections
- `references/competitive-landscape.md` — Detailed competitive analysis including dcspot.com relationship
- `references/launch-checklist.md` — Remaining items before real user launch
- `references/security-posture.md` — Current security status and remaining gaps
