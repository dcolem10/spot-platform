import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../store/authStore';
import type { UserRole } from '../types';

export function useAuth() {
  const store = useAuthStore(useShallow((s) => ({
    userId: s.userId,
    email: s.email,
    name: s.name,
    role: s.role,
    groups: s.groups,
    orgId: s.orgId,
    isAuthenticated: s.isAuthenticated,
    isLoading: s.isLoading,
    isDemoMode: s.isDemoMode,
    activePerspective: s.activePerspective,
  })));

  const isAdmin = Array.isArray(store.groups) && store.groups.some((g) => g === 'admin');

  // Admins (and demo users) can view the app through a chosen perspective lens.
  // Everyone else is locked to their real role. effectiveRole is the single
  // source of truth for nav selection and route guards.
  const canSwitchPerspective = isAdmin || store.isDemoMode;
  const effectiveRole: UserRole | null = canSwitchPerspective
    ? (store.activePerspective ?? store.role ?? (store.isDemoMode ? 'creator' : null))
    : store.role;

  return {
    ...store,
    isCreator: store.role === 'creator' || store.groups.includes('creator'),
    isPartner: store.role === 'partner' || store.groups.includes('partner'),
    isAudience: store.role === 'audience',
    isAdmin,
    canSwitchPerspective,
    effectiveRole,
  };
}
