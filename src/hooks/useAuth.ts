import { useAuthStore } from '../store/authStore';

export function useAuth() {
  const store = useAuthStore();
  return {
    userId: store.userId,
    email: store.email,
    name: store.name,
    role: store.role,
    groups: store.groups,
    orgId: store.orgId,
    isAuthenticated: store.isAuthenticated,
    isLoading: store.isLoading,
    isCreator: store.role === 'creator' || store.groups.includes('creator'),
    isPartner: store.role === 'partner' || store.groups.includes('partner'),
    isAudience: store.role === 'audience',
    isAdmin: Array.isArray(store.groups) && store.groups.some((g) => g === 'admin'),
  };
}
