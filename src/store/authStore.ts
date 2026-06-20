import { create } from 'zustand';
import type { UserRole } from '../types';
import type { Perspective } from '../lib/roleRoutes';

export interface DemoProfile {
  displayName: string;
  city: string;
  neighborhoods: string[];
  cuisinePreferences: string[];
  creatorType: string;
  followerCount: number;
  socialLinks: {
    instagram: string;
    tiktok: string;
    youtube: string;
    website: string;
  };
}

interface AuthState {
  userId: string | null;
  email: string | null;
  name: string | null;
  role: UserRole | null;
  groups: string[];
  orgId: string | null;
  /** Which Cognito pool this session authenticated against */
  poolType: 'creator' | 'restaurant' | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isDemoMode: boolean;
  demoOnboarded: boolean;
  demoProfile: DemoProfile | null;
  /**
   * Admin/demo perspective lens. When set (and the user is admin or in demo
   * mode), the app renders nav + enforces route guards as if the user had this
   * role. null ⇒ fall back to the real `role`. Client-side view-state only —
   * mutations still run as the signed-in identity.
   */
  activePerspective: Perspective | null;
  setActivePerspective: (perspective: Perspective | null) => void;
  setAuth: (payload: {
    userId: string;
    email: string;
    name: string;
    role: UserRole;
    groups: string[];
    orgId?: string;
    poolType?: 'creator' | 'restaurant';
  }) => void;
  setDemoMode: (demo: boolean) => void;
  setDemoOnboarded: (onboarded: boolean) => void;
  setDemoProfile: (profile: DemoProfile) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

const initialState = {
  userId: null,
  email: null,
  name: null,
  role: null as UserRole | null,
  groups: [] as string[],
  orgId: null,
  poolType: null as 'creator' | 'restaurant' | null,
  isAuthenticated: false,
  isLoading: true,
  isDemoMode: false,
  demoOnboarded: false,
  demoProfile: null as DemoProfile | null,
  activePerspective: (() => {
    try {
      const v = sessionStorage.getItem('spot.activePerspective');
      return v === 'creator' || v === 'partner' || v === 'audience' ? v : null;
    } catch {
      return null;
    }
  })() as Perspective | null,
};

export const useAuthStore = create<AuthState>((set) => ({
  ...initialState,
  setAuth: (payload) =>
    set({
      userId: payload.userId,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      groups: payload.groups,
      orgId: payload.orgId ?? null,
      poolType: payload.poolType ?? 'creator',
      isAuthenticated: true,
      isLoading: false,
    }),
  setActivePerspective: (perspective) => {
    try {
      if (perspective) sessionStorage.setItem('spot.activePerspective', perspective);
      else sessionStorage.removeItem('spot.activePerspective');
    } catch {
      // sessionStorage unavailable (e.g. SSR/private mode) — in-memory only
    }
    set({ activePerspective: perspective });
  },
  setDemoMode: (demo) => set({ isDemoMode: demo }),
  setDemoOnboarded: (onboarded) => set({ demoOnboarded: onboarded }),
  setDemoProfile: (profile) => set({ demoProfile: profile }),
  setLoading: (loading) => set({ isLoading: loading }),
  reset: () => {
    // Revoke Cognito session on logout (fire-and-forget)
    import('aws-amplify/auth')
      .then(({ signOut }) => signOut({ global: true }))
      .catch(() => {}); // Ignore errors (e.g. demo mode, already signed out)
    try {
      sessionStorage.removeItem('spot.activePerspective');
    } catch {
      // ignore
    }
    set({ ...initialState, activePerspective: null });
  },
}));
