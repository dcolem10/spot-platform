# Spot Platform: Influencer-Restaurant Interconnectivity Plan

## The Problem Today

The platform is creator-centric. Restaurants are passive — they can view campaigns and offers on the Partner Portal but can't initiate, approve, counter, or manage anything. QR codes and deals are created unilaterally by the creator. There's no handshake, no approval flow, no shared workspace.

## What the Research Says

Industry data (2024-2026) reveals restaurants care about more than just margins, but margins are the entry point:

- **$6.50 return per $1 spent** on influencer campaigns (restaurant industry average)
- **59% of restaurant marketers** are increasing influencer budgets in 2025
- **Micro-influencers (5K-50K followers)** deliver the best ROI — higher engagement, more authentic, more affordable
- **Top restaurant pain points:** finding the right creator, unclear communication, measuring ROI, pricing negotiation, logistics coordination
- **Dashboard preference:** simple summaries by default, with drill-down when investigating underperformance

**Key insight:** Restaurants don't want another complex dashboard. They want to know: "Did this partnership bring people through my door, and was it worth the cost?" Everything else is secondary.

---

## Architecture: The Handshake Model

### Core Concept: Proposals + Approvals

Every partnership action flows through a **proposal → approval** cycle. Either side can initiate. The other side accepts, counters, or declines.

### New Data Model

```
PROPOSAL (new entity)
├── PK: CREATOR#{creatorId} or RESTAURANT#{restaurantId}
├── SK: PROPOSAL#{proposalId}
├── GSI1PK: PROPOSAL#PENDING#{targetId}  (for inbox queries)
├── GSI1SK: {createdAt}
├── proposalType: "deal" | "campaign" | "qr_code" | "content_review"
├── initiatedBy: "creator" | "restaurant"
├── initiatorId: string
├── targetId: string
├── status: "pending" | "accepted" | "countered" | "declined" | "expired"
├── terms: { ... }  (flexible JSON — deal details, dates, deliverables)
├── counterTerms: { ... } | null
├── expiresAt: ISO string (auto-expire after 7 days)
├── messages: [{ from, text, timestamp }]  (negotiation thread)
├── createdAt / updatedAt
└── TTL: auto-cleanup expired proposals after 30 days
```

### New API Endpoints

```
POST   /api/proposals              — Create a proposal (either party)
GET    /api/proposals/inbox        — Get pending proposals for current user
GET    /api/proposals/sent         — Get proposals initiated by current user
PUT    /api/proposals/{id}/accept  — Accept a proposal
PUT    /api/proposals/{id}/counter — Counter with modified terms
PUT    /api/proposals/{id}/decline — Decline a proposal
POST   /api/proposals/{id}/message — Add negotiation message
```

---

## Phase 1: Core Handshake (Build First)

### 1A. Deal Proposals

**Creator initiates:** "I'd like to offer my followers 15% off at your restaurant"

- Creator fills out proposal form: deal type, discount amount, duration, expected deliverables
- Restaurant receives notification in their Partner Portal inbox
- Restaurant can: Accept as-is, Counter with different terms ("How about 10% + a free appetizer?"), or Decline

**Restaurant initiates:** "We're launching a new menu and want creator coverage"

- Restaurant posts an open opportunity: budget, timeline, what they're looking for
- Creators in the area see it in a "Partnership Opportunities" feed
- Creator applies with their pitch (audience size, content style, past work)
- Restaurant accepts/declines applications

### 1B. QR Code Mutual Approval

Current flow: Creator generates QR code unilaterally.

New flow:
1. Creator proposes a QR-tracked deal (e.g., "Scan for 20% off")
2. Restaurant reviews: confirms the discount they'll honor, sets redemption limits, blackout dates
3. Both approve → QR code generates with both parties' terms locked in
4. Either party can pause/deactivate the QR code

### 1C. Proposal Inbox (Both Sides)

**Creator view:** New section in Campaign Pipeline or sidebar — "Partnership Requests" showing incoming proposals from restaurants.

**Restaurant view:** Partner Portal gets an "Inbox" tab showing pending proposals from creators, with accept/counter/decline actions.

---

## Phase 2: Restaurant Dashboard (Build Second)

Based on research, the restaurant dashboard should be **"margin-first, details-on-demand."**

### Default View: The Numbers That Matter

```
┌─────────────────────────────────────────────────┐
│  YOUR PARTNERSHIPS AT A GLANCE                  │
│                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ 3 Active │  │ 247 QR   │  │ $1,850   │     │
│  │ Campaigns│  │ Scans    │  │ Est.     │     │
│  │          │  │ This Mo. │  │ Revenue  │     │
│  └──────────┘  └──────────┘  └──────────┘     │
│                                                 │
│  PENDING ACTIONS (2)                            │
│  • @dcfoodie wants to partner — Review          │
│  • QR code for "Summer Menu" expires in 3 days  │
│                                                 │
│  RECENT REDEMPTIONS                             │
│  Today: 12 scans, 8 redemptions (67% conv.)    │
│  This week: 47 scans, 31 redemptions           │
└─────────────────────────────────────────────────┘
```

### Key Metrics for Restaurants

- **Estimated revenue from partnerships** (redemptions x avg check value)
- **QR scan → redemption conversion rate** ("Are people actually coming in?")
- **Top-performing creator** (which partnership drives the most traffic)
- **Cost per acquisition** (what they gave away vs. customers gained)
- **Repeat visit rate** (do creator-referred customers come back?)

### Drill-Down (On Demand)

- Click any campaign → see content performance, reach, engagement
- Click any offer → see scan/redemption timeline, geographic heatmap
- Monthly summary email auto-sent (no login required)

---

## Phase 3: Shared Workspace (Build Third)

### Content Review Flow

1. Creator uploads draft content (photo, caption, hashtags)
2. Restaurant reviews: approves, requests edits, or flags concerns
3. Creator revises and resubmits
4. Both approve → content goes live
5. Post-publish: both see engagement metrics

### Mutual Benefit Options

Beyond QR codes and deals, other partnership models:

- **Revenue share:** Restaurant pays creator a % of tracked redemptions
- **Event partnerships:** Restaurant hosts creator's audience event, both promote
- **Menu collaboration:** Creator helps design a limited-time menu item, both get attribution
- **Exclusive access:** Restaurant gives creator early access to new menu/location for first-look content
- **Referral bonus:** Creator brings in another restaurant partner, gets a referral fee
- **Cross-promotion:** Restaurant features creator content on their own social/in-store displays

---

## Data Model Changes Summary

### New DynamoDB Entities

| Entity | PK | SK | Purpose |
|--------|----|----|---------|
| Proposal | `CREATOR#{id}` or `RESTAURANT#{id}` | `PROPOSAL#{proposalId}` | Deal/campaign proposals |
| ProposalInbox | GSI1PK: `PROPOSAL#PENDING#{targetId}` | `{createdAt}` | Query pending proposals |
| Notification | `USER#{id}` | `NOTIF#{timestamp}` | In-app notifications |
| ContentReview | `CAMPAIGN#{id}` | `REVIEW#{reviewId}` | Content approval workflow |

### Modified Entities

| Entity | Change |
|--------|--------|
| Campaign | Add `approvalStatus`, `proposalId`, `restaurantApprovedAt` |
| Offer/QR | Add `mutuallyApproved`, `restaurantTerms`, `creatorTerms`, `pausedBy` |

### New GSI

| GSI | PK | SK | Purpose |
|-----|----|----|---------|
| GSI2 | `PROPOSAL#PENDING#{targetId}` | `{createdAt}` | Inbox queries for pending proposals |

---

## Implementation Order

**Session 1 (Next):** Phase 1A + 1C — Deal proposal CRUD, proposal inbox UI for both creator and restaurant views, accept/counter/decline flow.

**Session 2:** Phase 1B — QR code mutual approval, pause/deactivate flow, redemption limit enforcement.

**Session 3:** Phase 2 — Restaurant dashboard redesign with margin-first metrics, monthly summary email.

**Session 4:** Phase 3 — Content review workflow, revenue share tracking, mutual benefit options.

---

## Finalized Decisions

### 1. Restaurant Auth: Separate Cognito Pool (SRE-Recommended)

Separate pools for creators and restaurants. Key benefits:

- **Security isolation:** Compromised creator pool doesn't affect restaurant operations
- **Cost savings:** Restaurants under 10K MAU stay in Cognito free tier (~$1,800/yr saved)
- **POS-ready:** Square, Toast, and Clover OAuth can be added as identity providers on the restaurant pool only
- **Token clarity:** Pool issuer in JWT inherently identifies user type — no group-claim parsing needed
- **Hybrid users:** `creator_id <-> restaurant_id` mapping table in DynamoDB handles people who are both

Restaurant pool auth flow:
- Email + password (default)
- Optional: Sign up via Square / Toast / Clover OAuth (auto-links POS data)
- Stricter password policy + optional MFA for business accounts

### 2. Notifications: Both In-App + Email

- In-app notification bell with unread count (real-time via polling or WebSocket)
- Email notifications via SES for: new proposals, proposal accepted/declined, QR code expiring, weekly summary
- Email is low-cost: SES charges $0.10 per 1,000 emails

### 3. Proposal Expiration: 7 Days

- Auto-expire pending proposals after 7 days
- Notification at day 5: "Your proposal to [restaurant] expires in 2 days"
- Expired proposals can be re-sent as new proposals
- TTL cleanup in DynamoDB removes expired proposals after 30 days

### 4. POS Integration: Square, Toast, Clover (Phased)

All three support OAuth 2.0:

- **Square:** Standard OAuth code flow + PKCE, 30-day access tokens, refresh supported. Access to transactions, inventory, payroll.
- **Toast:** Bearer token auth via `/authentication/login`. Partner API for multi-restaurant access. Orders, staff, inventory APIs.
- **Clover:** Authorization code grant. Sandbox + production environments. Sales, inventory, payroll APIs.

Integration roadmap:
- **Phase 3:** Add Square OAuth (largest market share among SMB restaurants)
- **Phase 4:** Add Toast + Clover OAuth
- **Phase 5:** Auto-sync redemption data from POS to calculate real ROI (not self-reported)

---

## Updated Implementation Order

**Session 1 (Next):** Phase 1A + 1C — Deal proposal CRUD, proposal inbox UI, accept/counter/decline flow. Create restaurant Cognito pool.

**Session 2:** Phase 1B — QR code mutual approval, pause/deactivate flow, in-app notifications + SES email alerts.

**Session 3:** Phase 2 — Restaurant dashboard with margin-first metrics, 7-day proposal expiration with reminders.

**Session 4:** Phase 3 — Square OAuth integration, content review workflow, revenue share tracking.

**Session 5:** Phase 4 — Toast + Clover OAuth, auto-redemption sync, mutual benefit options.



