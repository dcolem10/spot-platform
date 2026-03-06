import { create } from 'zustand';
import type { UserRole } from '../types';

interface AuthState {
  userId: string | null;
  email: string | null;
  name: string | null;
  role: UserRole | null;
  groups: string[];
  orgId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isDemoMode: boolean;
  demoOnboarded: boolean;
  setAuth: (payload: {
    userId: string;
    email: string;
    name: string;
    role: UserRole;
    groups: string[];
    orgId?: string;
  }) => void;
  setDemoMode: (demo: boolean) => void;
  setDemoOnboarded: (onboarded: boolean) => void;
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
  isAuthenticated: false,
  isLoading: true,
  isDemoMode: false,
  demoOnboarded: false,
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
      isAuthenticated: true,
      isLoading: false,
    }),
  setDemoMode: (demo) => set({ isDemoMode: demo }),
  setDemoOnboarded: (onboarded) => set({ demoOnboarded: onboarded }),
  setLoading: (loading) => set({ isLoading: loading }),
  reset: () => set(initialState),
}));
