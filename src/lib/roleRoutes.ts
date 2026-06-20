import type { UserRole } from '../types';

/**
 * The "perspective" an admin (or demo user) is currently viewing the app
 * through. Uses the same vocabulary as UserRole so route guards and nav
 * selection can share one source of truth. 'partner' is labelled
 * "Restaurant" in the UI.
 */
export type Perspective = 'creator' | 'partner' | 'audience';

/** Landing route for a given role/perspective. */
export function homeFor(role: UserRole | Perspective | null | undefined): string {
  switch (role) {
    case 'partner':
      return '/app/partner';
    case 'audience':
      return '/app/discover';
    case 'creator':
    case 'admin':
    default:
      return '/app/dashboard';
  }
}
