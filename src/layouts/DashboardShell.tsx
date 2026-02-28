import { Suspense, useState } from 'react';
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { isDemoMode } from '../data/demoData';
import './Sidebar.css';

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

const creatorNav: { group: string; items: NavItem[] }[] = [
  {
    group: 'Overview',
    items: [
      { to: '/app/dashboard', label: 'Dashboard', icon: '\u2302' },
      { to: '/app/restaurants', label: 'Restaurants', icon: '\uD83C\uDF7D' },
    ],
  },
  {
    group: 'Partnerships',
    items: [
      { to: '/app/crm', label: 'CRM', icon: '\uD83D\uDC65' },
      { to: '/app/campaigns', label: 'Campaigns', icon: '\uD83D\uDCC8' },
      { to: '/app/offers', label: 'Offers & QR', icon: '\uD83C\uDF9F' },
      { to: '/app/reports', label: 'Reports', icon: '\uD83D\uDCCA' },
    ],
  },
  {
    group: 'Content',
    items: [
      { to: '/app/archive', label: 'Archive', icon: '\uD83D\uDCF7' },
      { to: '/app/calendar', label: 'Calendar', icon: '\uD83D\uDCC5' },
    ],
  },
  {
    group: 'Audience',
    items: [
      { to: '/app/discover', label: 'Discovery', icon: '\uD83D\uDD0D' },
      { to: '/app/deals', label: 'Deals', icon: '\u2B50' },
    ],
  },
];

const partnerNav: { group: string; items: NavItem[] }[] = [
  {
    group: 'Overview',
    items: [
      { to: '/app/partner', label: 'Dashboard', icon: '\u2302' },
    ],
  },
  {
    group: 'Campaigns',
    items: [
      { to: '/app/partner/campaigns', label: 'My Campaigns', icon: '\uD83D\uDCC8' },
      { to: '/app/partner/offers', label: 'My Offers', icon: '\uD83C\uDF9F' },
    ],
  },
];

const audienceNav: { group: string; items: NavItem[] }[] = [
  {
    group: 'Explore',
    items: [
      { to: '/app/discover', label: 'Restaurants', icon: '\uD83D\uDD0D' },
      { to: '/app/deals', label: 'Deals', icon: '\u2B50' },
      { to: '/app/saved', label: 'Saved', icon: '\uD83D\uDD16' },
    ],
  },
];

const creatorMobileNavItems: NavItem[] = [
  { to: '/app/dashboard', label: 'Home', icon: '\u2302' },
  { to: '/app/campaigns', label: 'Campaigns', icon: '\uD83D\uDCC8' },
  { to: '/app/discover', label: 'Discover', icon: '\uD83D\uDD0D' },
  { to: '/app/archive', label: 'Content', icon: '\uD83D\uDCF7' },
  { to: '/app/offers', label: 'Offers', icon: '\uD83C\uDF9F' },
];

const audienceMobileNavItems: NavItem[] = [
  { to: '/app/discover', label: 'Discover', icon: '\uD83D\uDD0D' },
  { to: '/app/deals', label: 'Deals', icon: '\u2B50' },
  { to: '/app/saved', label: 'Saved', icon: '\uD83D\uDD16' },
];

const CONSUMER_PATHS = ['/app/discover', '/app/deals', '/app/saved'];

export default function DashboardShell() {
  const { name, role, email } = useAuth();
  const location = useLocation();
  const [demoBannerDismissed, setDemoBannerDismissed] = useState(false);

  // Explicit view mode — only switches via the toggle link, not on navigation
  const initialMode = CONSUMER_PATHS.some((p) => location.pathname.startsWith(p)) ? 'audience' : 'creator';
  const [viewMode, setViewMode] = useState<'creator' | 'audience'>(initialMode);

  const effectiveRole = viewMode === 'audience' ? 'audience' : (role || (isDemoMode ? 'creator' : 'viewer'));
  const nav = effectiveRole === 'partner' ? partnerNav : effectiveRole === 'audience' ? audienceNav : creatorNav;
  const displayName = name || (isDemoMode ? (viewMode === 'audience' ? 'Foodie' : 'Demo Creator') : null);
  const displayRole = effectiveRole;
  const initials = displayName ? displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : '?';

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-circle">S</div>
          <span className="sidebar-logo-text">Spot</span>
        </div>

        <nav className="sidebar-nav">
          {nav.map((group) => (
            <div key={group.group} className="sidebar-group">
              <div className="sidebar-group-label">{group.group}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `sidebar-link${isActive ? ' active' : ''}`
                  }
                >
                  <span className="sidebar-link-icon">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {isDemoMode && (
          <div style={{ padding: '0 var(--space-3) var(--space-3)' }}>
            <NavLink
              to={viewMode === 'audience' ? '/app/dashboard' : '/app/discover'}
              className="sidebar-link"
              style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)' }}
              onClick={() => setViewMode(viewMode === 'audience' ? 'creator' : 'audience')}
            >
              <span className="sidebar-link-icon">{viewMode === 'audience' ? '\u{1F4BC}' : '\uD83D\uDD0D'}</span>
              {viewMode === 'audience' ? 'Switch to Creator' : 'Switch to Foodie'}
            </NavLink>
          </div>
        )}

        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{displayName || email || 'User'}</div>
            <div className="sidebar-user-role">{displayRole}</div>
          </div>
        </div>
      </aside>

      <main className="dashboard-main">
        {isDemoMode && !demoBannerDismissed && (
          <div className="demo-banner">
            <span>
              <strong>Demo Mode</strong> &mdash; You&rsquo;re viewing example data.{' '}
              {viewMode === 'audience' ? (
                <Link to="/app/dashboard" style={{ color: 'inherit', fontWeight: 600 }} onClick={() => setViewMode('creator')}>
                  Switch to Creator View &rarr;
                </Link>
              ) : (
                <Link to="/app/discover" style={{ color: 'inherit', fontWeight: 600 }} onClick={() => setViewMode('audience')}>
                  Switch to Foodie View &rarr;
                </Link>
              )}
            </span>
            <button
              onClick={() => setDemoBannerDismissed(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                fontSize: 'var(--font-base)',
                cursor: 'pointer',
                padding: 'var(--space-1)',
                opacity: 0.7,
              }}
              aria-label="Dismiss demo banner"
            >
              &times;
            </button>
          </div>
        )}
        <Suspense
          fallback={
            <div style={{ padding: 'var(--space-6)' }}>
              <LoadingSkeleton height="32px" width="200px" />
              <div style={{ marginTop: 'var(--space-4)' }}>
                <LoadingSkeleton height="200px" count={3} />
              </div>
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>

      <nav className="mobile-nav">
        <div className="mobile-nav-items">
          {(viewMode === 'audience' ? audienceMobileNavItems : creatorMobileNavItems).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `mobile-nav-item${isActive || location.pathname.startsWith(item.to) ? ' active' : ''}`
              }
            >
              <span className="mobile-nav-item-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}
