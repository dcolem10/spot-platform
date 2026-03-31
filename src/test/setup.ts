import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock AWS Amplify — not available in test environment
vi.mock('aws-amplify', () => ({
  Amplify: { configure: vi.fn() },
}));

vi.mock('@aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn().mockResolvedValue({
    tokens: { idToken: { toString: () => 'mock-token' } },
  }),
  getCurrentUser: vi.fn().mockResolvedValue({ userId: 'test-user-id', username: 'test@example.com' }),
  signIn: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
}));

// Mock import.meta.env
Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_API_BASE_URL: 'https://test-api.example.com',
    VITE_DEMO_MODE: 'false',
    VITE_ENABLE_RESTAURANT_PORTAL: 'true',
    VITE_ENABLE_MEMBERSHIP: 'true',
    VITE_ENABLE_MULTI_CREATOR: 'false',
    VITE_ENABLE_AMBASSADOR: 'true',
  },
  writable: true,
});
