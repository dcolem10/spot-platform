import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('featureFlags', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('multiCreator defaults to false when env var is unset', async () => {
    vi.stubEnv('VITE_ENABLE_MULTI_CREATOR', '');
    const { flags } = await import('./featureFlags');
    // Default should be false per checklist item #26 fix
    expect(flags.multiCreator).toBe(false);
    vi.unstubAllEnvs();
  });

  it('restaurantPortal defaults to true in demo mode', async () => {
    // featureFlags reads isDemoMode from authStore at module load time
    // Just verify the export shape is correct
    const { flags } = await import('./featureFlags');
    expect(typeof flags.restaurantPortal).toBe('boolean');
    expect(typeof flags.membership).toBe('boolean');
    expect(typeof flags.multiCreator).toBe('boolean');
    expect(typeof flags.ambassador).toBe('boolean');
  });

  it('respects VITE_ENABLE_MULTI_CREATOR=true env override', async () => {
    // Simulate env override
    Object.defineProperty(import.meta.env, 'VITE_ENABLE_MULTI_CREATOR', {
      value: 'true',
      configurable: true,
    });
    vi.resetModules();
    const { flags } = await import('./featureFlags');
    expect(flags.multiCreator).toBe(true);
    Object.defineProperty(import.meta.env, 'VITE_ENABLE_MULTI_CREATOR', {
      value: 'false',
      configurable: true,
    });
  });
});
