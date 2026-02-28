import { Suspense } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
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

const mobileNavItems: NavItem[] = [
  { to: '/app/dashboard', label: 'Home', icon: '\u2302' },
  { to: '/app/campaigns', label: 'Campaigns', icon: '\uD83D\uDCC8' },
  { to: '/app/discover', label: 'Discover', icon: '\uD83D\uDD0D' },
  { to: '/app/archive', label: 'Content', icon: '\uD83D\uDCF7' },
  { to: '/app/offers', label: 'Offers', icon: '\uD83C\uDF9F' },
];

export default function DashboardShell() {
  const { name, role, email } = useAuth();
  const location = useLocation();
  const nav = role === 'partner' ? partnerNav : creatorNav;
  const displayName = name || (isDemoMode ? 'DC Spot' : null);
  const displayRole = role || (isDemoMode ? 'creator' : 'viewer');
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

        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{displayName || email || 'User'}</div>
            <div className="sidebar-user-role">{displayRole}</div>
          </div>
        </div>
      </aside>

      <main className="dashboard-main">
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
          {mobileNavItems.map((item) => (
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
