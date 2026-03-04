import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';

const demoEnabled = import.meta.env.VITE_DEMO_MODE === 'true';

export function useAuthInit() {
  const ran = useRef(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const setLoading = useAuthStore((s) => s.setLoading);
  const setDemoMode = useAuthStore((s) => s.setDemoMode);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    initAuth(setAuth, setLoading, setDemoMode);
  }, [setAuth, setLoading, setDemoMode]);
}

async function initAuth(
  setAuth: ReturnType<typeof useAuthStore.getState>['setAuth'],
  setLoading: ReturnType<typeof useAuthStore.getState>['setLoading'],
  setDemoMode: ReturnType<typeof useAuthStore.getState>['setDemoMode'],
) {
  // Always try real auth first — check for an existing Cognito session
  try {
    const { getCurrentUser, fetchAuthSession } = await import('aws-amplify/auth');
    const user = await getCurrentUser();
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken;

    if (idToken) {
      // Real user session found — NOT demo mode
      const claims = idToken.payload;
      setDemoMode(false);
      setAuth({
        userId: user.userId,
        email: (claims['email'] as string) ?? '',
        name: (claims['name'] as string) ?? (claims['email'] as string) ?? '',
        role: (claims['custom:role'] as 'creator' | 'partner' | 'audience') ?? 'creator',
        groups: (claims['cognito:groups'] as string[]) ?? [],
        orgId: (claims['custom:orgId'] as string) ?? undefined,
      });
      return;
    }
  } catch {
    // No active Cognito session — fall through
  }

  // No real session — if demo is enabled, set up demo user
  if (demoEnabled) {
    setDemoMode(true);
    setAuth({
      userId: 'demo-user',
      email: 'demo@spot.app',
      name: 'Demo Creator',
      role: 'creator',
      groups: ['creator'],
      orgId: 'org-demo',
    });
    return;
  }

  // Neither real auth nor demo — leave unauthenticated
  setLoading(false);
}
