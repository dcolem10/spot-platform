import { useQuery } from '@tanstack/react-query';
import { api } from '../services/ApiService';
import { useAuthStore } from '../store/authStore';

export type SubscriptionTier = 'free' | 'starter' | 'pro' | 'scale';

interface SubscriptionResponse {
  tier: SubscriptionTier;
  status: string;
  priceId?: string;
  currentPeriodEnd?: string;
}

/**
 * Tier hierarchy — higher index = more access.
 * Use `meetsMinTier(tier, 'pro')` to check access.
 */
const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  scale: 3,
};

export function meetsMinTier(userTier: SubscriptionTier, required: SubscriptionTier): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[required];
}

export function useSubscriptionTier() {
  const isDemoMode = useAuthStore((s) => s.isDemoMode);

  const query = useQuery({
    queryKey: ['user-subscription'],
    queryFn: async () => {
      const res = await api.get<SubscriptionResponse>('/api/user/subscription');
      if (res.status === 'error' && res.statusCode === 404) {
        return { tier: 'free' as SubscriptionTier, status: 'none' };
      }
      if (res.status !== 'success' || !res.data) {
        return { tier: 'free' as SubscriptionTier, status: 'unknown' };
      }
      return res.data;
    },
    // Cache for 5 minutes — subscription changes are infrequent
    staleTime: 5 * 60 * 1000,
    // Don't fetch in demo mode
    enabled: !isDemoMode,
  });

  // Demo mode: grant full scale access so all features are visible
  if (isDemoMode) {
    return {
      tier: 'scale' as SubscriptionTier,
      status: 'active',
      isLoading: false,
      meetsMinTier: (_required: SubscriptionTier) => true,
    };
  }

  const tier: SubscriptionTier = query.data?.tier ?? 'free';

  return {
    tier,
    status: query.data?.status ?? 'none',
    isLoading: query.isLoading,
    meetsMinTier: (required: SubscriptionTier) => meetsMinTier(tier, required),
  };
}
