import { useAuthStore } from '../store/authStore';

function flag(envKey: string, defaultInDemo: boolean): boolean {
  const val = import.meta.env[envKey];
  if (val === 'true') return true;
  if (val === 'false') return false;
  return useAuthStore.getState().isDemoMode ? defaultInDemo : false;
}

export const flags = {
  restaurantPortal: flag('VITE_ENABLE_RESTAURANT_PORTAL', true),
  membership: flag('VITE_ENABLE_MEMBERSHIP', true),
  multiCreator: flag('VITE_ENABLE_MULTI_CREATOR', true),
  ambassador: flag('VITE_ENABLE_AMBASSADOR', true),
} as const;

export type FeatureFlagKey = keyof typeof flags;
