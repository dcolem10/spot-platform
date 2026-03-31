import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
    // Reset to clean loading state for each test
    useAuthStore.setState({ isLoading: false, isAuthenticated: false });
  });

  it('starts unauthenticated', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.userId).toBeNull();
    expect(state.role).toBeNull();
  });

  it('sets authenticated state on setAuth', () => {
    useAuthStore.getState().setAuth({
      userId: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'creator',
      groups: ['creators'],
    });
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.userId).toBe('user-123');
    expect(state.role).toBe('creator');
    expect(state.orgId).toBeNull();
  });

  it('stores orgId for partner role', () => {
    useAuthStore.getState().setAuth({
      userId: 'partner-456',
      email: 'partner@restaurant.com',
      name: 'Restaurant Owner',
      role: 'partner',
      groups: ['partners'],
      orgId: 'restaurant-789',
    });
    expect(useAuthStore.getState().orgId).toBe('restaurant-789');
  });

  it('resets state on reset()', () => {
    useAuthStore.getState().setAuth({
      userId: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'creator',
      groups: [],
    });
    useAuthStore.getState().reset();
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.userId).toBeNull();
  });

  it('enables demo mode', () => {
    useAuthStore.getState().setDemoMode(true);
    expect(useAuthStore.getState().isDemoMode).toBe(true);
  });
});
