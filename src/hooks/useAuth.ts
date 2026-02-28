import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../store/authStore';

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
  })));

  return {
    ...store,
    isCreator: store.role === 'creator' || store.groups.includes('creator'),
    isPartner: store.role === 'partner' || store.groups.includes('partner'),
    isAudience: store.role === 'audience',
    isAdmin: Array.isArray(store.groups) && store.groups.some((g) => g === 'admin'),
  };
}
