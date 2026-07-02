// ─── Core Entities ───────────────────────────────────────────────────────────

export type UserRole = 'creator' | 'partner' | 'audience' | 'admin';

export interface UserProfile {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  orgId?: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface Organization {
  orgId: string;
  name: string;
  type: 'creator_team' | 'restaurant';
  slug: string;
  logoUrl?: string;
}

// ─── Partnerships & Restaurants ──────────────────────────────────────────────

export interface Restaurant {
  restaurantId: string;
  name: string;
  address: string;
  neighborhood: string;
  coords: { lat: number; lng: number };
  cuisine: string[];
  vibes: string[];
  priceLevel: 1 | 2 | 3 | 4;
  phone?: string;
  website?: string;
  hours?: WeeklyHours;
  googlePlaceId?: string;
  spotRating?: number;
  description?: string;
  knownFor?: string[];
  spotVideoUrl?: string;
  spotReview?: string;
  lastVisited?: string;
  isPartner: boolean;
  photos: string[];
  reservationUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyHours {
  [day: string]: { open: string; close: string }[];
}

export type CampaignStatus = 'inquiry' | 'negotiation' | 'active' | 'completed' | 'cancelled';

export interface Campaign {
  campaignId: string;
  restaurantId: string;
  restaurantName: string;
  status: CampaignStatus;
  package: string;
  budget: number;
  startDate?: string;
  endDate?: string;
  deliverables: Deliverable[];
  dealType?: string;
  dealDescription?: string;
  trackingMethods?: string[];
  goal?: string;
  contentDeliverables?: string[];
  notes?: string;
  linkedOfferId?: string;
  linkedOfferCode?: string;
  activity?: CampaignActivity[];
  createdAt: string;
  updatedAt: string;
}

export interface CampaignActivity {
  id: string;
  type: 'status_change' | 'outreach' | 'note' | 'offer_linked' | 'deal_updated';
  message: string;
  timestamp: string;
}

export interface Deliverable {
  id: string;
  type: 'reel' | 'story' | 'post' | 'tiktok' | 'mention';
  description: string;
  completed: boolean;
  completedAt?: string;
  postUrl?: string;
}

export type SocialPlatform = 'instagram' | 'tiktok' | 'youtube' | 'twitter';

export type OfferApprovalStatus = 'creator_only' | 'pending_restaurant' | 'approved' | 'paused_by_creator' | 'paused_by_restaurant' | 'rejected' | 'published';

/**
 * How an offer came to exist:
 * - 'creator'           — a creator built it (legacy default; absent ⇒ this)
 * - 'restaurant'        — a restaurant published a template open for creators to adopt
 * - 'restaurant_adopted'— a creator adopted a restaurant template (their own tracked code)
 */
export type OfferOrigin = 'creator' | 'restaurant' | 'restaurant_adopted';

export interface OfferTerms {
  discountType: 'percent' | 'fixed' | 'freeItem';
  discountValue: number;
  freeItemDescription?: string;
  maxRedemptions?: number;
  blackoutDates?: string[];
  validDays?: string[];
  minSpend?: number;
  notes?: string;
}

export interface Offer {
  offerId: string;
  restaurantId: string;
  restaurantName?: string;
  linkedCampaignId?: string;
  code: string;
  type: 'qr' | 'promo' | 'link';
  description: string;
  /** Structured deal value — the diner's incentive to actually use the code. */
  terms?: OfferTerms;
  landingPageUrl: string;
  scans: number;
  redemptions: number;
  scansBySource?: Record<string, number>;
  expiresAt?: string;
  isActive: boolean;
  createdAt: string;
  // Mutual approval fields
  approvalStatus: OfferApprovalStatus;
  creatorTerms?: OfferTerms;
  restaurantTerms?: OfferTerms;
  mutuallyApproved?: boolean;
  approvedAt?: string;
  pausedBy?: 'creator' | 'restaurant';
  pausedAt?: string;
  pauseReason?: string;
  // Marketplace fields
  /** Provenance of the offer. Absent ⇒ legacy creator-created. */
  origin?: OfferOrigin;
  /** For adopted offers: the restaurant-published template this was minted from. */
  parentOfferId?: string;
  /** For restaurant-published templates: how many creators have adopted it. */
  adoptedCount?: number;
}

// ─── Restaurant commission bill (mirrors GET /api/restaurants/:id/commissions) ──
export interface CommissionPeriod {
  period: string;           // 'YYYY-MM'
  grossAttributed: number;  // attributed sales (dollars)
  feeCharged: number;       // 12% fee charged (dollars)
  monthlyCap: number;       // per-restaurant monthly cap (dollars)
  capReached: boolean;
  status: string;           // 'accruing' | 'billed' | 'paid' | ...
}

export interface CommissionBill {
  restaurantId: string;
  periods: CommissionPeriod[];
}

export interface CampaignReport {
  reportId: string;
  campaignId: string;
  restaurantName: string;
  period: { start: string; end: string };
  metrics: {
    totalReach: number;
    totalImpressions: number;
    totalSaves: number;
    totalShares: number;
    totalComments: number;
    qrScans: number;
    offerRedemptions: number;
    estimatedVisits: number;
    engagementRate: number;
  };
  posts: PostMetrics[];
  generatedAt: string;
}

export interface PostMetrics {
  postId: string;
  platform: 'instagram' | 'tiktok';
  postUrl: string;
  postedAt: string;
  impressions: number;
  reach: number;
  saves: number;
  shares: number;
  comments: number;
  likes: number;
}

// ─── Audience & Discovery ────────────────────────────────────────────────────

export type MembershipTier = 'free' | 'insider';

export interface SavedRestaurant {
  restaurantId: string;
  savedAt: string;
  notes?: string;
  occasion?: string;
}

export interface DealOffer {
  dealId: string;
  restaurantId: string;
  restaurantName: string;
  title: string;
  description: string;
  insiderOnly: boolean;
  expiresAt?: string;
  /** Redeemable promo code — present when this deal is backed by a tracked offer. */
  code?: string;
  /** Structured deal value — the diner's incentive to actually use the code. */
  terms?: OfferTerms;
  /** 'offer' when projected from the attributed offer system. */
  source?: 'offer' | 'insider';
}

export interface RecommendationRequest {
  query: string;
  filters?: {
    cuisine?: string[];
    neighborhood?: string[];
    priceLevel?: number[];
    vibes?: string[];
    occasion?: string;
  };
}

// ─── Creator Tools ──────────────────────────────────────────────────────────

export interface CreatorProfile {
  creatorId: string;
  brandName: string;
  platforms: {
    instagram?: { handle: string; followers: number };
    tiktok?: { handle: string; followers: number };
    youtube?: { handle: string; subscribers: number };
  };
  city: string;
  niche: string;
  monthlyRate?: { min: number; max: number };
}

export interface PartnershipPipeline {
  total: number;
  byStatus: Record<CampaignStatus, number>;
  totalRevenue: number;
  avgDealSize: number;
}

export interface ContentItem {
  contentId: string;
  platform: 'instagram' | 'tiktok' | 'youtube';
  postUrl: string;
  restaurantId?: string;
  restaurantName?: string;
  campaignId?: string;
  postedAt: string;
  metrics: PostMetrics;
  tags: string[];
}

export interface EditorialSlot {
  slotId: string;
  date: string;
  restaurantId?: string;
  restaurantName?: string;
  type: 'sponsored' | 'organic' | 'reshoot';
  status: 'planned' | 'shot' | 'editing' | 'published';
  notes?: string;
  campaignId?: string;
}

// ─── Creator Earnings & Payouts (revenue-split engine) ───────────────────────
// Shapes mirror the backend exactly: GET /api/earnings, GET /api/stripe/connect/status,
// POST /api/stripe/payouts/run. See docs/revenue-split-design.md.

export type PayoutOnboardingStatus =
  | 'not_started'
  | 'pending'
  | 'pending_review'
  | 'complete';

export type EarningPeriodStatus = 'accruing' | 'pending_payout' | 'paid' | 'failed';

/** One billing month of a creator's commission earnings (dollars). */
export interface EarningPeriod {
  period: string; // YYYY-MM
  grossAttributed: number; // attributed sales this creator drove
  earned: number; // their 60% share of the fee
  paid: number;
  pending: number;
  status: EarningPeriodStatus;
}

export interface CreatorEarnings {
  periods: EarningPeriod[];
  totals: { earned: number; pending: number };
  payouts: {
    connected: boolean;
    onboardingStatus: PayoutOnboardingStatus;
    payoutsEnabled: boolean;
  };
}

/** Stripe Connect payout readiness for the current creator. */
export interface ConnectStatus {
  connected: boolean;
  onboardingStatus: PayoutOnboardingStatus;
  payoutsEnabled: boolean;
  detailsSubmitted?: boolean;
}

export interface PayoutResult {
  paid: boolean;
  period: string;
  amount: number;
  transferId: string;
}

// ─── Proposals (Handshake Model) ─────────────────────────────────────────────

export type ProposalType = 'deal' | 'campaign' | 'qr_code' | 'content_review';
export type ProposalStatus = 'pending' | 'accepted' | 'countered' | 'declined' | 'expired';
export type ProposalInitiator = 'creator' | 'restaurant';

export interface ProposalMessage {
  from: string;
  text: string;
  timestamp: string;
}

export interface Proposal {
  proposalId: string;
  proposalType: ProposalType;
  initiatedBy: ProposalInitiator;
  initiatorId: string;
  targetId: string;
  initiatorName: string;
  targetName: string;
  status: ProposalStatus;
  terms: Record<string, unknown>;
  counterTerms: Record<string, unknown> | null;
  expiresAt: string;
  messages: ProposalMessage[];
  acceptedAt?: string;
  declineReason?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Raffles (Spot Raffles) ───────────────────────────────────────────────────

export type RaffleStatus = 'draft' | 'active' | 'closed' | 'drawn' | 'cancelled';

export interface RaffleWinner {
  email: string;
  name: string;
  claimCode: string;
  drawnAt: string;
  claimedAt?: string;
}

export interface Raffle {
  raffleId: string;
  creatorId: string;
  creatorName: string;
  restaurantId: string;
  restaurantName: string;
  title: string;
  description: string;
  prizeDescription: string;
  videoUrl: string;
  startsAt: string;
  endsAt: string;
  status: RaffleStatus;
  entryCount: number;
  maxEntries: number;
  platformFee: number;
  creatorRevenue: number;
  winner: RaffleWinner | null;
  createdAt: string;
  updatedAt: string;
}

export interface RaffleEntry {
  entryId: string;
  raffleId: string;
  email: string;
  name: string;
  socialHandle?: string;
  createdAt: string;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: 'success' | 'error' | 'timeout' | 'offline';
  statusCode?: number;
}

// ─── Filters ─────────────────────────────────────────────────────────────────

export interface RestaurantFilters {
  search?: string;
  cuisine?: string[];
  neighborhood?: string[];
  priceLevel?: number[];
  vibes?: string[];
  isPartner?: boolean;
  occasion?: string;
}

// ─── Content Reviews ──────────────────────────────────────────────────────────

export type ContentReviewStatus = 'draft' | 'submitted' | 'revision_requested' | 'revised' | 'approved' | 'rejected' | 'published';
export type ContentPlatform = 'instagram' | 'tiktok' | 'youtube';
export type ContentType = 'reel' | 'story' | 'post' | 'tiktok' | 'shorts';

export interface RevisionEntry {
  reason: string;
  requestedAt: string;
  revisedAt?: string;
  revisedCaption?: string;
}

export interface ReviewMessage {
  from: string;
  role: 'creator' | 'restaurant' | 'system';
  text: string;
  timestamp: string;
}

export interface ContentMetrics {
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  impressions: number;
  reach: number;
  views: number;
  engagementRate: number;
}

export interface MetricsSnapshot {
  fetchedAt: string;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
}

export interface ContentReview {
  contentReviewId: string;
  creatorId: string;
  restaurantId: string;
  restaurantName: string;
  campaignId?: string;
  platform: ContentPlatform;
  contentType: ContentType;
  contentUrl: string;
  caption: string;
  hashtagsProposed?: string[];
  callToAction?: string;
  status: ContentReviewStatus;
  submittedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  publishedUrl?: string;
  publishedAt?: string;
  metrics?: ContentMetrics | null;
  metricsUpdatedAt?: string;
  metricsHistory?: MetricsSnapshot[];
  revisionCount: number;
  revisionHistory: RevisionEntry[];
  messages: ReviewMessage[];
  createdAt: string;
  updatedAt: string;
}

// ─── POS Integration ──────────────────────────────────────────────────────────

export type PosProvider = 'square' | 'toast' | 'clover';

export interface PosConnectionStatus {
  connected: boolean;
  provider?: PosProvider;
  status?: 'connected' | 'pending_oauth' | 'failed' | 'revoked';
  merchantId?: string;
  merchantName?: string;
  connectedAt?: string;
  lastSyncedAt?: string;
  lastMetrics?: {
    avgCheckValue: number;
    repeatCustomerRate: number;
  };
}

export interface RedemptionSyncResult {
  date: string;
  syncedAt: string;
  provider: PosProvider;
  totalRedemptions: number;
  matchedRedemptions: number;
  unmatchedRedemptions: number;
  matchRate: number;
  totalRevenue: number;
  avgTransactionValue: number;
  repeatCustomerCount: number;
  environment?: string;
}

// ─── Social Media Connections ────────────────────────────────────────────────

export type SocialConnectionStatus = 'pending_oauth' | 'connected' | 'disconnected' | 'failed' | 'revoked' | 'expired';

export interface SocialConnection {
  platform: ContentPlatform;
  status: SocialConnectionStatus;
  platformUserId?: string;
  username?: string;
  displayName?: string;
  followerCount?: number;
  connectedAt?: string;
  lastMetricsFetchedAt?: string;
  environment?: string;
}

export interface SocialConnectResponse {
  authorizationUrl: string;
  state: string;
  expiresIn: number;
  mode?: 'development';
}

// ─── Notifications ──────────────────────────────────────────────────────────

export type NotificationType =
  | 'proposal_received'
  | 'proposal_accepted'
  | 'proposal_declined'
  | 'proposal_countered'
  | 'offer_approval_requested'
  | 'offer_approved'
  | 'offer_rejected'
  | 'offer_paused'
  | 'raffle_entry'
  | 'raffle_winner'
  | 'qr_milestone'
  | 'proposal_expiring'
  | 'content_review_submitted'
  | 'content_review_revision_requested'
  | 'content_review_approved'
  | 'content_review_rejected';

export interface Notification {
  notificationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  isRead: boolean;
  emailSent?: boolean;
  createdAt: string;
}
