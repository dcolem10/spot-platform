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
  setAuth: (payload: {
    userId: string;
    email: string;
    name: string;
    role: UserRole;
    groups: string[];
    orgId?: string;
  }) => void;
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
  setLoading: (loading) => set({ isLoading: loading }),
  reset: () => set(initialState),
}));
