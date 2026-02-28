import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';

const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

export function useAuthInit() {
  const ran = useRef(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const setLoading = useAuthStore((s) => s.setLoading);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (isDemoMode) {
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

    // Real auth — dynamically import to avoid bundling Amplify in demo builds
    initRealAuth(setAuth, setLoading);
  }, [setAuth, setLoading]);
}

async function initRealAuth(
  setAuth: ReturnType<typeof useAuthStore.getState>['setAuth'],
  setLoading: ReturnType<typeof useAuthStore.getState>['setLoading'],
) {
  try {
    const { getCurrentUser, fetchAuthSession } = await import('aws-amplify/auth');
    const user = await getCurrentUser();
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken;

    if (!idToken) {
      setLoading(false);
      return;
    }

    const claims = idToken.payload;
    setAuth({
      userId: user.userId,
      email: (claims['email'] as string) ?? '',
      name: (claims['name'] as string) ?? (claims['email'] as string) ?? '',
      role: (claims['custom:role'] as 'creator' | 'partner' | 'audience') ?? 'audience',
      groups: (claims['cognito:groups'] as string[]) ?? [],
      orgId: (claims['custom:orgId'] as string) ?? undefined,
    });
  } catch {
    // Not signed in — leave auth in default state
    setLoading(false);
  }
}
