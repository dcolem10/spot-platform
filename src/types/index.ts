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

export interface Offer {
  offerId: string;
  restaurantId: string;
  restaurantName?: string;
  linkedCampaignId?: string;
  code: string;
  type: 'qr' | 'promo' | 'link';
  description: string;
  landingPageUrl: string;
  scans: number;
  redemptions: number;
  scansBySource?: Record<string, number>;
  expiresAt?: string;
  isActive: boolean;
  createdAt: string;
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
