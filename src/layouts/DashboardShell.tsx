import { Suspense, useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../store/authStore';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { ScrollToTop } from '../components/ScrollToTop';
import { WelcomeModal } from '../components/WelcomeModal';
import NotificationBell from '../components/NotificationBell';
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
    group: 'Campaigns',
    items: [
      { to: '/app/crm', label: 'Partnership CRM', icon: '\uD83D\uDC65' },
      { to: '/app/campaigns', label: 'Campaign Pipeline', icon: '\uD83D\uDCC8' },
      { to: '/app/proposals', label: 'Proposals', icon: '📩' },
      { to: '/app/raffles', label: 'Raffles', icon: '🎟️' },
      { to: '/app/content-reviews', label: 'Content Reviews', icon: '📝' },
      { to: '/app/offers', label: 'Deals & QR', icon: '\uD83C\uDF9F' },
      { to: '/app/reports', label: 'Attribution', icon: '\uD83D\uDCCA' },
      { to: '/app/insights', label: 'AI Insights', icon: '\u2728' },
    ],
  },
  {
    group: 'Content',
    items: [
      { to: '/app/archive', label: 'Archive', icon: '\uD83D\uDCF7' },
      { to: '/app/calendar', label: 'Calendar', icon: '\uD83D\uDCC5' },
      { to: '/app/social', label: 'Social Accounts', icon: '🔗' },
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
      { to: '/app/partner/proposals', label: 'Proposals', icon: '📩' },
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
  { to: '/app/campaigns', label: 'Pipeline', icon: '\uD83D\uDCC8' },
  { to: '/app/crm', label: 'CRM', icon: '\uD83D\uDC65' },
  { to: '/app/restaurants', label: 'Restaurants', icon: '\uD83C\uDF7D' },
  { to: '/app/reports', label: 'Attribution', icon: '\uD83D\uDCCA' },
];

const partnerMobileNavItems: NavItem[] = [
  { to: '/app/partner', label: 'Home', icon: '\u2302' },
  { to: '/app/partner/proposals', label: 'Proposals', icon: '📩' },
  { to: '/app/partner/campaigns', label: 'Campaigns', icon: '\uD83D\uDCC8' },
  { to: '/app/partner/offers', label: 'Offers', icon: '\uD83C\uDF9F' },
];

const audienceMobileNavItems: NavItem[] = [
  { to: '/app/restaurants', label: 'Discover', icon: '\uD83D\uDD0D' },
  { to: '/app/deals', label: 'Deals', icon: '\u2B50' },
  { to: '/app/saved', label: 'Saved', icon: '\uD83D\uDD16' },
];

const CONSUMER_PATHS = ['/app/discover', '/app/deals', '/app/saved'];

export default function DashboardShell() {
  const { name, role, email } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const resetAuth = useAuthStore((s) => s.reset);
  const isDemoMode = useAuthStore((s) => s.isDemoMode);
  const [demoBannerDismissed, setDemoBannerDismissed] = useState(false);

  const handleSignOut = useCallback(async () => {
    try {
      const { signOut } = await import('aws-amplify/auth');
      await signOut();
    } catch {
      // ignore signOut errors
    }
    resetAuth();
    navigate('/', { replace: true });
  }, [resetAuth, navigate]);

  // Explicit view mode — only switches via the toggle link, not on navigation
  const initialMode = CONSUMER_PATHS.some((p) => location.pathname.startsWith(p)) ? 'audience' : 'creator';
  const [viewMode, setViewMode] = useState<'creator' | 'audience'>(initialMode);

  // Scroll to top on page navigation
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const effectiveRole = viewMode === 'audience' ? 'audience' : (role || (isDemoMode ? 'creator' : 'viewer'));
  const nav = effectiveRole === 'partner' ? partnerNav : effectiveRole === 'audience' ? audienceNav : creatorNav;
  const displayName = name || (isDemoMode ? (viewMode === 'audience' ? 'Foodie' : 'Demo Creator') : null);
  const displayRole = effectiveRole;
  const initials = displayName ? displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : '?';

  return (
    <>
      <aside className="sidebar">
        <Link
          to={isDemoMode ? '/' : '/app/dashboard'}
          className="sidebar-logo"
          style={{ textDecoration: 'none' }}
          onClick={() => {
            if (!isDemoMode) window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <div className="sidebar-logo-circle">S</div>
          <span className="sidebar-logo-text">Spot</span>
        </Link>

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
          <NotificationBell />
          <button
            onClick={isDemoMode ? () => { resetAuth(); navigate('/', { replace: true }); } : handleSignOut}
            title={isDemoMode ? 'Exit demo' : 'Sign out'}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-textMuted, #999)',
              cursor: 'pointer',
              fontSize: 14,
              padding: '4px 8px',
              borderRadius: 6,
              marginLeft: 'auto',
              transition: 'color 0.2s',
            }}
            onMouseOver={(e) => { (e.target as HTMLElement).style.color = 'var(--color-accent)'; }}
            onMouseOut={(e) => { (e.target as HTMLElement).style.color = 'var(--color-textMuted)'; }}
          >
            {isDemoMode ? 'Exit Demo' : 'Sign Out'}
          </button>
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
        <WelcomeModal />
      </main>

      <nav className="mobile-nav">
        <div className="mobile-nav-items">
          {(viewMode === 'audience' ? audienceMobileNavItems : effectiveRole === 'partner' ? partnerMobileNavItems : creatorMobileNavItems).map((item) => (
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

      <ScrollToTop />
    </>
  );
}
