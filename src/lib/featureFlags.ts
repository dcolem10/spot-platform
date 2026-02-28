const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

function flag(envKey: string, defaultInDemo: boolean): boolean {
  const val = import.meta.env[envKey];
  if (val === 'true') return true;
  if (val === 'false') return false;
  return isDemoMode ? defaultInDemo : false;
}

export const flags = {
  restaurantPortal: flag('VITE_ENABLE_RESTAURANT_PORTAL', true),
  membership: flag('VITE_ENABLE_MEMBERSHIP', true),
  multiCreator: flag('VITE_ENABLE_MULTI_CREATOR', false),
} as const;

export type FeatureFlagKey = keyof typeof flags;
