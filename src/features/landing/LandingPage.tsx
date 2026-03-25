import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { useAuthStore } from '../../store/authStore';
import './LandingPage.css';

/* ─── Interactive Dashboard Tab Preview ─────────────────────────────────── */

type DashboardTab = 'attribution' | 'pipeline' | 'pos' | 'content';

const dashboardTabs: { id: DashboardTab; label: string; icon: ReactNode }[] = [
  {
    id: 'attribution',
    label: 'Attribution',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
      </svg>
    ),
  },
  {
    id: 'pipeline',
    label: 'Deal Pipeline',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    id: 'pos',
    label: 'POS Tracking',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    ),
  },
  {
    id: 'content',
    label: 'Content Studio',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
      </svg>
    ),
  },
];

function DashboardPreviewTab({ activeTab }: { activeTab: DashboardTab }) {
  if (activeTab === 'attribution') {
    return (
      <div className="preview-tab-content">
        <div className="preview-metric-row">
          <div className="preview-metric">
            <span className="preview-metric-value" style={{ color: 'var(--color-accent)' }}>247</span>
            <span className="preview-metric-label">Attributed Visits</span>
          </div>
          <div className="preview-metric">
            <span className="preview-metric-value" style={{ color: 'var(--color-success)' }}>$18.4K</span>
            <span className="preview-metric-label">Revenue Tracked</span>
          </div>
          <div className="preview-metric">
            <span className="preview-metric-value" style={{ color: 'var(--color-info)' }}>5.6x</span>
            <span className="preview-metric-label">Avg. ROAS</span>
          </div>
        </div>
        <div className="preview-chart">
          <div className="preview-chart-label">Revenue attribution over 90 days</div>
          <div className="preview-chart-bars">
            {[28, 45, 38, 62, 55, 72, 68, 85, 78, 92, 88, 95].map((h, i) => (
              <div key={i} className="preview-chart-bar" style={{ '--bar-height': `${h}%`, '--bar-delay': `${i * 60}ms` } as React.CSSProperties} />
            ))}
          </div>
        </div>
        <div className="preview-insight">
          <span className="preview-insight-icon">&#x2728;</span>
          <span>Creator Sarah K. drove <strong>89 new customers</strong> in the last 30 days — 3.2x above average</span>
        </div>
      </div>
    );
  }

  if (activeTab === 'pipeline') {
    return (
      <div className="preview-tab-content">
        <div className="preview-pipeline">
          <div className="preview-pipeline-col">
            <div className="preview-pipeline-header preview-pipeline-header--blue">Proposed (3)</div>
            <div className="preview-pipeline-card">
              <div className="preview-pipeline-card-name">Rasika</div>
              <div className="preview-pipeline-card-meta">$800 &middot; 2 reels + 1 story</div>
            </div>
            <div className="preview-pipeline-card">
              <div className="preview-pipeline-card-name">Tail Up Goat</div>
              <div className="preview-pipeline-card-meta">$500 &middot; 1 reel + 1 post</div>
            </div>
          </div>
          <div className="preview-pipeline-col">
            <div className="preview-pipeline-header preview-pipeline-header--green">Active (2)</div>
            <div className="preview-pipeline-card preview-pipeline-card--active">
              <div className="preview-pipeline-card-name">Bad Saint</div>
              <div className="preview-pipeline-card-meta">$1,200 earned &middot; 89 visits</div>
            </div>
            <div className="preview-pipeline-card preview-pipeline-card--active">
              <div className="preview-pipeline-card-name">Rose&rsquo;s Luxury</div>
              <div className="preview-pipeline-card-meta">$2,400 earned &middot; 132 visits</div>
            </div>
          </div>
          <div className="preview-pipeline-col">
            <div className="preview-pipeline-header preview-pipeline-header--gold">Completed (5)</div>
            <div className="preview-pipeline-card">
              <div className="preview-pipeline-card-name">Le Dip</div>
              <div className="preview-pipeline-card-meta">$1,800 paid &middot; 4.2x ROAS</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 'pos') {
    return (
      <div className="preview-tab-content">
        <div className="preview-pos-header">
          <div className="preview-pos-integrations">
            <span className="preview-pos-badge">Square</span>
            <span className="preview-pos-badge preview-pos-badge--green">Connected</span>
          </div>
          <div className="preview-pos-integrations">
            <span className="preview-pos-badge">Clover</span>
            <span className="preview-pos-badge preview-pos-badge--green">Connected</span>
          </div>
          <div className="preview-pos-integrations">
            <span className="preview-pos-badge">Toast</span>
            <span className="preview-pos-badge preview-pos-badge--pending">Pending</span>
          </div>
        </div>
        <div className="preview-pos-transactions">
          <div className="preview-pos-tx">
            <span className="preview-pos-tx-time">2:34 PM</span>
            <span className="preview-pos-tx-desc">Table 12 &middot; QR scan from @sarah.eats</span>
            <span className="preview-pos-tx-amount">$47.80</span>
          </div>
          <div className="preview-pos-tx">
            <span className="preview-pos-tx-time">1:15 PM</span>
            <span className="preview-pos-tx-desc">Online order &middot; Promo MARCUS20</span>
            <span className="preview-pos-tx-amount">$32.50</span>
          </div>
          <div className="preview-pos-tx">
            <span className="preview-pos-tx-time">12:48 PM</span>
            <span className="preview-pos-tx-desc">Table 7 &middot; QR scan from @priya.food</span>
            <span className="preview-pos-tx-amount">$65.20</span>
          </div>
        </div>
        <div className="preview-insight">
          <span className="preview-insight-icon">&#x1F517;</span>
          <span>Real POS data — no codes needed. We match transactions to creator content automatically.</span>
        </div>
      </div>
    );
  }

  // content tab
  return (
    <div className="preview-tab-content">
      <div className="preview-content-grid">
        {[
          { status: 'Published', platform: 'Instagram Reel', reach: '45.2K', color: 'var(--color-success)' },
          { status: 'In Review', platform: 'TikTok', reach: '—', color: 'var(--color-warning)' },
          { status: 'Published', platform: 'Instagram Story', reach: '12.8K', color: 'var(--color-success)' },
          { status: 'Draft', platform: 'Instagram Post', reach: '—', color: 'var(--color-textMuted)' },
        ].map((item, i) => (
          <div key={i} className="preview-content-card">
            <div className="preview-content-thumb" style={{ '--thumb-i': i } as React.CSSProperties} />
            <div className="preview-content-info">
              <span className="preview-content-platform">{item.platform}</span>
              <span className="preview-content-status" style={{ color: item.color }}>{item.status}</span>
            </div>
            {item.reach !== '—' && <span className="preview-content-reach">{item.reach} reach</span>}
          </div>
        ))}
      </div>
      <div className="preview-insight">
        <span className="preview-insight-icon">&#x1F4F7;</span>
        <span>Restaurant approves content before it goes live. You keep full creative control.</span>
      </div>
    </div>
  );
}

/* ─── Hooks ──────────────────────────────────────────────────────────────── */

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const targets = el.querySelectorAll('.reveal, .reveal-stagger');
    if (!targets.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
    );

    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  return ref;
}

function useScrolledNav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return scrolled;
}

function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const start = performance.now();
          const animate = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
          io.disconnect();
        }
      },
      { threshold: 0.5 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [target, duration]);

  return { value, ref };
}

/* ─── Floating Orbs — Ambient background motion ──────────────────────────── */

function FloatingOrbs() {
  return (
    <div className="floating-orbs" aria-hidden="true">
      <div className="floating-orb floating-orb--1" />
      <div className="floating-orb floating-orb--2" />
      <div className="floating-orb floating-orb--3" />
    </div>
  );
}

/* ─── BentoCard with mouse-tracking spotlight ────────────────────────────── */

function BentoCard({
  children,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
  }, []);

  return (
    <div
      ref={cardRef}
      className={`bento-card ${className}`}
      onMouseMove={handleMouseMove}
      {...props}
    >
      {children}
    </div>
  );
}

/* ─── Mini UI Mockups ────────────────────────────────────────────────────── */

function MiniPipeline() {
  return (
    <div className="mini-pipeline">
      <div className="mini-pipeline-col">
        <div className="mini-pipeline-label">Planned</div>
        <div className="mini-pipeline-item mini-pipeline-item--blue">
          <span className="mini-pipeline-name">Rasika</span>
          <span className="mini-pipeline-value">$800 deal</span>
        </div>
        <div className="mini-pipeline-item mini-pipeline-item--blue">
          <span className="mini-pipeline-name">Tail Up Goat</span>
          <span className="mini-pipeline-value">$500 deal</span>
        </div>
      </div>
      <div className="mini-pipeline-col">
        <div className="mini-pipeline-label">Active</div>
        <div className="mini-pipeline-item mini-pipeline-item--green">
          <span className="mini-pipeline-name">Bad Saint</span>
          <span className="mini-pipeline-value">$1,200 earned</span>
        </div>
        <div className="mini-pipeline-item mini-pipeline-item--green">
          <span className="mini-pipeline-name">Rose&rsquo;s Luxury</span>
          <span className="mini-pipeline-value">$2,400 earned</span>
        </div>
        <div className="mini-pipeline-item mini-pipeline-item--green">
          <span className="mini-pipeline-name">Maydan</span>
          <span className="mini-pipeline-value">$3,100 earned</span>
        </div>
      </div>
      <div className="mini-pipeline-col">
        <div className="mini-pipeline-label">Complete</div>
        <div className="mini-pipeline-item mini-pipeline-item--orange">
          <span className="mini-pipeline-name">Le Dip</span>
          <span className="mini-pipeline-value">$1,800 paid</span>
        </div>
      </div>
    </div>
  );
}

function MiniChartSVG() {
  const bars = [
    { h: 35, opacity: 0.5 },
    { h: 52, opacity: 0.6 },
    { h: 30, opacity: 0.45 },
    { h: 68, opacity: 0.85 },
    { h: 45, opacity: 0.55 },
    { h: 58, opacity: 0.7 },
    { h: 80, opacity: 1 },
    { h: 50, opacity: 0.6 },
  ];
  const barW = 20;
  const gap = 5;
  const svgW = bars.length * (barW + gap) - gap;

  return (
    <svg viewBox={`0 0 ${svgW} 80`} className="mini-chart-svg" preserveAspectRatio="none">
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id="chartGradBright" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.4" />
        </linearGradient>
      </defs>
      {bars.map((bar, i) => (
        <rect
          key={i}
          x={i * (barW + gap)}
          y={80 - bar.h}
          width={barW}
          height={bar.h}
          rx={5}
          fill={bar.opacity >= 0.8 ? 'url(#chartGradBright)' : 'url(#chartGrad)'}
          opacity={bar.opacity}
          style={{ '--bar-i': i } as React.CSSProperties}
        />
      ))}
    </svg>
  );
}

function MiniCalendar() {
  const days = Array.from({ length: 21 }, (_, i) => i);
  const filled = new Set([2, 5, 9, 12, 16, 19]);
  const active = new Set([9, 12]);

  return (
    <div className="mini-calendar">
      {days.map((d) => (
        <div
          key={d}
          className={`mini-cal-day${active.has(d) ? ' mini-cal-day--active' : filled.has(d) ? ' mini-cal-day--filled' : ''}`}
        >
          {d + 1}
        </div>
      ))}
    </div>
  );
}

function MiniPhotos() {
  const items = [
    { bg: 'var(--color-accentMuted)', badge: null },
    { bg: 'var(--color-successMuted)', badge: { text: 'Top', color: 'var(--color-success)' } },
    { bg: 'var(--color-infoMuted)', badge: null },
    { bg: 'var(--color-warningMuted)', badge: { text: '10%', color: 'var(--color-warning)' } },
    { bg: 'var(--color-accentMuted)', badge: null },
    { bg: 'var(--color-successMuted)', badge: { text: 'Top', color: 'var(--color-success)' } },
  ];
  return (
    <div className="mini-photos">
      {items.map((item, i) => (
        <div key={i} className="mini-photo" style={{ background: item.bg }}>
          {item.badge && (
            <span className="mini-photo-badge" style={{ background: item.badge.color }}>
              {item.badge.text}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function MiniQROffer() {
  const scans = useCountUp(342);
  const redeemed = useCountUp(89, 1400);

  // 7x7 QR-like pattern
  const pattern = [
    1, 1, 1, 0, 1, 1, 1,
    1, 0, 1, 1, 0, 0, 1,
    1, 1, 0, 2, 1, 1, 0,
    0, 1, 1, 0, 0, 1, 1,
    1, 0, 2, 1, 1, 0, 1,
    1, 1, 0, 0, 1, 1, 1,
    1, 0, 1, 1, 0, 1, 0,
  ];

  return (
    <div className="mini-qr-offer-wrap">
      <div className="mini-qr">
        {pattern.map((v, i) => (
          <div
            key={i}
            className={`mini-qr-dot${v === 0 ? ' mini-qr-dot--empty' : v === 2 ? ' mini-qr-dot--accent' : v === 1 && (i < 7 || i % 7 === 0) ? ' mini-qr-dot--bright' : ''}`}
          />
        ))}
        <div className="mini-qr-scanline" />
      </div>
      <div className="mini-offer-stats">
        <div className="mini-offer-stat">
          <span className="mini-offer-stat-value" ref={scans.ref}>{scans.value}</span>
          <span className="mini-offer-stat-label">Scans</span>
        </div>
        <div className="mini-offer-stat">
          <span className="mini-offer-stat-value" ref={redeemed.ref}>{redeemed.value}</span>
          <span className="mini-offer-stat-label">Redeemed</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Mini Restaurant ROI Mockup ─────────────────────────────────────────── */

function MiniROIDashboard() {
  const newCustomers = useCountUp(247, 1400);
  const revenue = useCountUp(18, 1600);
  const spend = useCountUp(3200, 1200);

  return (
    <div className="mini-roi-dashboard">
      <div className="mini-roi-row">
        <div className="mini-roi-metric">
          <span className="mini-roi-metric-value" ref={newCustomers.ref}>{newCustomers.value}</span>
          <span className="mini-roi-metric-label">New Customers</span>
        </div>
        <div className="mini-roi-metric">
          <span className="mini-roi-metric-value" style={{ color: 'var(--color-textMuted)' }}>$<span ref={spend.ref}>{spend.value.toLocaleString()}</span></span>
          <span className="mini-roi-metric-label">Creator Spend</span>
        </div>
        <div className="mini-roi-metric">
          <span className="mini-roi-metric-value" style={{ color: 'var(--color-success)' }}>$<span ref={revenue.ref}>{revenue.value}</span>K</span>
          <span className="mini-roi-metric-label">Attributed Revenue</span>
        </div>
      </div>
      <div className="mini-roi-creators">
        {[
          { name: 'Sarah K.', followers: '45K', visits: 89 },
          { name: 'Marcus T.', followers: '120K', visits: 132 },
          { name: 'Priya D.', followers: '28K', visits: 47 },
        ].map((c) => (
          <div key={c.name} className="mini-roi-creator-row">
            <div className="mini-roi-creator-avatar" />
            <div className="mini-roi-creator-info">
              <span className="mini-roi-creator-name">{c.name}</span>
              <span className="mini-roi-creator-meta">{c.followers} followers</span>
            </div>
            <span className="mini-roi-creator-visits">{c.visits} visits sent</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Pricing Tiers ──────────────────────────────────────────────────────── */

const pricingTiers = [
  {
    name: 'Starter',
    price: '$49',
    description: 'For creators landing their first paid restaurant deals. One partnership covers your subscription.',
    features: ['Up to 5 active partnerships', 'Content portfolio archive', 'Proof your content drives real customers', '850+ restaurant directory'],
  },
  {
    name: 'Pro',
    price: '$99',
    description: 'For creators earning consistent income. Most creators earn 10-30x their subscription in deals.',
    features: ['Unlimited partnerships', 'Editorial calendar', 'Advanced attribution + benchmarks', 'QR & deal tracking', 'Audience discovery app'],
    highlighted: true,
  },
  {
    name: 'Scale',
    price: '$149',
    description: 'For creator teams running a full content business with multiple revenue streams.',
    features: ['Everything in Pro', 'Team member access', 'White-label reports for restaurants', 'API access', 'Priority support'],
  },
];

/* ─── Dashboard Preview Section ─────────────────────────────────────────── */

function DashboardPreviewSection({ enterDemo }: { enterDemo: (path: string) => void }) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('attribution');

  return (
    <section className="landing-section landing-section--alt">
      <div className="landing-section-header reveal">
        <h2>See the platform in action</h2>
        <p>
          Not a mockup. This is what Spot actually looks like &mdash; the same dashboard
          creators and restaurants use to track every partnership, every dollar.
        </p>
      </div>

      <div className="dashboard-preview reveal">
        <div className="dashboard-preview-chrome">
          <div className="dashboard-preview-dots">
            <span /><span /><span />
          </div>
          <div className="dashboard-preview-tabs">
            {dashboardTabs.map((tab) => (
              <button
                key={tab.id}
                className={`dashboard-preview-tab${activeTab === tab.id ? ' dashboard-preview-tab--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="dashboard-preview-body">
          <DashboardPreviewTab activeTab={activeTab} />
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 'var(--space-8)' }} className="reveal">
        <button onClick={() => enterDemo('/app/dashboard')} className="btn btn-gradient btn-lg">
          Try the Full Dashboard
        </button>
      </div>
    </section>
  );
}

/* ─── Social Proof Section ──────────────────────────────────────────────── */

function SocialProofSection() {
  return (
    <section className="landing-section">
      <div className="landing-section-header reveal">
        <h2>What sets Spot apart</h2>
        <p>Other platforms track clicks and impressions. Spot tracks actual revenue through direct POS integration.</p>
      </div>

      <div className="comparison-grid reveal-stagger">
        <div className="comparison-card comparison-card--others">
          <div className="comparison-card-header">
            <span className="comparison-card-label">Other Platforms</span>
          </div>
          <ul className="comparison-list comparison-list--negative">
            <li>Link-click attribution only</li>
            <li>7-day attribution windows</li>
            <li>Discount code dependent</li>
            <li>No POS integration</li>
            <li>Agencies manage campaigns</li>
            <li>Revenue estimates, not actuals</li>
          </ul>
        </div>

        <div className="comparison-card comparison-card--spot">
          <div className="comparison-card-header">
            <div className="comparison-card-logo-mark">S</div>
            <span className="comparison-card-label">Spot Platform</span>
          </div>
          <ul className="comparison-list comparison-list--positive">
            <li>POS-verified transaction attribution</li>
            <li>90-day attribution windows</li>
            <li>QR codes + POS &mdash; no codes needed</li>
            <li>Square, Clover, Toast integration</li>
            <li>Direct creator-restaurant partnerships</li>
            <li>Real revenue from real receipts</li>
          </ul>
        </div>
      </div>

      <div className="trust-signals reveal">
        <div className="trust-signal">
          <span className="trust-signal-icon">&#x1F4B3;</span>
          <span>POS-Verified Attribution</span>
        </div>
        <div className="trust-signal">
          <span className="trust-signal-icon">&#x1F512;</span>
          <span>SOC 2 Compliant</span>
        </div>
        <div className="trust-signal">
          <span className="trust-signal-icon">&#x26A1;</span>
          <span>Real-Time Tracking</span>
        </div>
        <div className="trust-signal">
          <span className="trust-signal-icon">&#x1F4CA;</span>
          <span>90-Day Windows</span>
        </div>
      </div>
    </section>
  );
}

/* ─── Landing Page ───────────────────────────────────────────────────────── */

export default function LandingPage() {
  const rootRef = useScrollReveal();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setDemoMode = useAuthStore((s) => s.setDemoMode);
  const navScrolled = useScrolledNav();

  const enterDemo = useCallback(async (path: string) => {
    // Clear any stale Cognito session so demo mode doesn't conflict
    try {
      const { signOut } = await import('aws-amplify/auth');
      await signOut();
    } catch { /* no session to clear */ }

    setDemoMode(true);
    setAuth({
      userId: 'demo-user',
      email: 'demo@spot.app',
      name: 'Demo Creator',
      role: 'creator',
      groups: ['creator'],
      orgId: 'org-demo',
    });
    navigate(path);
  }, [setDemoMode, setAuth, navigate]);

  // Platform capability highlights (not user counts — we're pre-launch)
  const cities = useCountUp(6, 1200);
  const restaurants = useCountUp(850, 1600);
  const features = useCountUp(19, 1000);

  return (
    <div ref={rootRef} style={{ minHeight: '100vh', background: 'var(--color-bgPrimary)' }}>
      {/* ── Floating Glassmorphic Navbar ─────────────────────────────────── */}
      <nav className={`landing-nav${navScrolled ? ' landing-nav--scrolled' : ''}`}>
        <div className="landing-nav-logo">
          <div className="landing-nav-logo-mark">S</div>
          <span className="landing-nav-logo-text">Spot</span>
        </div>
        <div className="landing-nav-actions">
          <a href="#restaurants" className="landing-nav-link landing-nav-link--restaurants">For Restaurants</a>
          <Link to="/auth" className="landing-nav-link">Sign In</Link>
          <button
            onClick={() => enterDemo('/app/dashboard')}
            className="landing-nav-link landing-nav-link--demo"
            style={{ color: 'var(--color-textMuted)' }}
          >
            Demo
          </button>
          <Link
            to="/auth?mode=signUp"
            className="btn btn-primary"
            style={{ padding: '8px 20px', fontSize: 'var(--font-sm)' }}
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* ── Hero — Split Layout: Copy Left + Dashboard Right ─────────── */}
      <section className="landing-hero landing-hero--split">
        <FloatingOrbs />

        {/* Left: Text content */}
        <div className="landing-hero-content">
          <div className="landing-hero-badge">
            <span className="landing-hero-badge-dot" />
            Beyond Impressions. Into Revenue.
          </div>
          <h1>
            Stop guessing if your food content drives sales.{' '}
            <span className="text-gradient">Start proving it.</span>
          </h1>
          <p className="landing-hero-desc">
            Most food creators can&rsquo;t prove they sent a single customer through the door.
            Spot changes that &mdash; with POS-integrated attribution that tracks every visit, every
            dollar, every partnership. Set your rate, create content, and let the data speak.
          </p>
          <div className="landing-hero-actions">
            <div className="cta-pulse-wrap">
              <button
                onClick={() => enterDemo('/app/dashboard')}
                className="btn btn-gradient btn-lg"
              >
                Start Landing Paid Deals
              </button>
            </div>
            <button
              onClick={() => enterDemo('/app/partner')}
              className="btn btn-secondary btn-lg"
            >
              I&rsquo;m a Restaurant &mdash; Join Free
            </button>
          </div>
        </div>

        {/* Right: Floating dashboard mockup */}
        <div className="landing-hero-3d">
          <div className="hero-device-wrap">
            <div className="hero-device-glow" aria-hidden="true" />
            <img
              src="/hero-dashboard.png"
              alt="Spot Platform dashboard showing campaign pipeline with attribution analytics"
              className="hero-device-img"
              loading="eager"
              width={600}
              height={340}
            />
          </div>
        </div>
      </section>

      {/* ── Platform Capabilities ──────────────────────────────────────── */}
      <section className="landing-stats reveal">
        <div className="landing-stat">
          <div className="landing-stat-value"><span ref={cities.ref}>{cities.value}</span></div>
          <div className="landing-stat-label">Cities Supported</div>
        </div>
        <div className="landing-stat">
          <div className="landing-stat-value"><span ref={restaurants.ref}>{restaurants.value.toLocaleString()}</span>+</div>
          <div className="landing-stat-label">Restaurants Open to Partnerships</div>
        </div>
        <div className="landing-stat">
          <div className="landing-stat-value"><span ref={features.ref}>{features.value}</span></div>
          <div className="landing-stat-label">Built-In Tools</div>
        </div>
      </section>

      {/* ── Pain Points — Problem-First Messaging ────────────────────── */}
      <section className="landing-section">
        <div className="landing-section-header reveal">
          <h2>The problem every food creator faces</h2>
          <p>You create content that fills restaurants. But you can&rsquo;t prove it — and that&rsquo;s costing you thousands in partnerships you deserve.</p>
        </div>

        <div className="pain-point-grid reveal-stagger">
          <div className="pain-point-card">
            <div className="pain-point-icon pain-point-icon--red">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" />
              </svg>
            </div>
            <h3>No attribution data</h3>
            <p>You post, customers show up, but the restaurant has no idea you sent them. Without attribution, you&rsquo;re just &ldquo;exposure.&rdquo;</p>
          </div>
          <div className="pain-point-card">
            <div className="pain-point-icon pain-point-icon--red">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /><path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <h3>Discount codes fail</h3>
            <p>Customers forget codes, share them, or buy later. Studies show coupon-based tracking misses 60%+ of influencer-driven revenue.</p>
          </div>
          <div className="pain-point-card">
            <div className="pain-point-icon pain-point-icon--red">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <h3>Underpriced partnerships</h3>
            <p>Without data proving your ROI, restaurants lowball you &mdash; or offer free meals instead of real pay. Your content is worth more.</p>
          </div>
        </div>

        <div className="pain-point-solution reveal">
          <div className="pain-point-solution-inner">
            <span className="pain-point-solution-badge">Spot&rsquo;s Answer</span>
            <p>POS-integrated attribution that tracks every customer from content to checkout &mdash; through Square, Clover, QR codes, and promo links. No discount codes required. Restaurants see the ROI. You get paid what you&rsquo;re worth.</p>
          </div>
        </div>
      </section>

      {/* ── Interactive Dashboard Preview ──────────────────────────────── */}
      <DashboardPreviewSection enterDemo={enterDemo} />

      {/* ── How It Works — The Value Loop ──────────────────────────────── */}
      <section className="landing-section landing-section--alt">
        <div className="landing-section-header reveal">
          <h2>How Spot works</h2>
          <p>
            A simple loop where everyone profits. Creators earn money, restaurants earn customers,
            and Spot earns its fee only when both sides see results.
          </p>
        </div>

        <div className="how-it-works-grid reveal-stagger">
          <div className="how-it-works-step">
            <div className="how-it-works-number">1</div>
            <div className="how-it-works-icon how-it-works-icon--orange">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m11 17 2 2a1 1 0 1 0 3-3" /><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88" />
                <path d="m9.5 16.5-1-1a1 1 0 0 0-3 3l2 2a1 1 0 0 0 3-3" />
                <path d="M3 7V5a1 1 0 0 1 1-1h3" /><path d="M21 7V5a1 1 0 0 0-1-1h-3" />
                <path d="M6 12H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h3" /><path d="M18 12h2a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-3" />
              </svg>
            </div>
            <h3>Creator partners with restaurant</h3>
            <p>A food creator proposes a paid content campaign to a restaurant they love &mdash; or receives an inbound request. They agree on deliverables and a flat fee or per-visit rate.</p>
          </div>

          <div className="how-it-works-step">
            <div className="how-it-works-number">2</div>
            <div className="how-it-works-icon how-it-works-icon--blue">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                <path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" />
              </svg>
            </div>
            <h3>Creator publishes content</h3>
            <p>The creator visits, eats, creates authentic content, and publishes with a tracked link, QR code, or deal code attached.</p>
          </div>

          <div className="how-it-works-step">
            <div className="how-it-works-number">3</div>
            <div className="how-it-works-icon how-it-works-icon--green">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
              </svg>
            </div>
            <h3>Spot tracks every customer</h3>
            <p>When someone scans, clicks, or redeems &mdash; Spot attributes that visit back to the creator. Real customers, real data.</p>
          </div>

          <div className="how-it-works-step">
            <div className="how-it-works-number">4</div>
            <div className="how-it-works-icon how-it-works-icon--gold">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
                <path d="M12 18V6" />
              </svg>
            </div>
            <h3>Everyone gets paid</h3>
            <p>Creators receive their agreed fee &mdash; flat rate, per-visit, or hybrid. Restaurants see exactly what they got for their spend. Spot takes a small platform fee only when both sides see value.</p>
          </div>
        </div>
      </section>

      {/* ── Creator Value: Get Paid for Your Content ───────────────────── */}
      <section className="landing-section">
        <div className="landing-section-header reveal">
          <h2>Creators: turn your food content into a real income</h2>
          <p>
            Stop guessing whether your posts drive customers. Spot gives you the
            attribution data to command higher rates and the pipeline to keep deals flowing.
          </p>
        </div>

        <div className="landing-bento reveal-stagger">
          {/* Campaign Pipeline — primary feature card */}
          <BentoCard className="bento-card--large bento-card--hero bento-card--glow-orange">
            <h3>Your Earnings Pipeline</h3>
            <p>
              Every restaurant deal at a glance &mdash; what&rsquo;s planned, what&rsquo;s
              active, and how much you&rsquo;ve earned from each partnership.
            </p>
            <MiniPipeline />
          </BentoCard>

          {/* Attribution Reports — SVG chart with gradient fills */}
          <BentoCard className="bento-card--medium bento-card--glow-blue">
            <h3>Prove Your Impact</h3>
            <p>
              One-click reports showing how many customers your content actually
              sent to each restaurant &mdash; the data that justifies your rate.
            </p>
            <MiniChartSVG />
          </BentoCard>

          {/* Content Archive */}
          <BentoCard className="bento-card--third bento-card--glow-purple">
            <h3>Content Archive</h3>
            <p>Every post, metric, and performance tier in one searchable library &mdash; your portfolio for landing bigger deals.</p>
            <MiniPhotos />
          </BentoCard>

          {/* Editorial Calendar */}
          <BentoCard className="bento-card--third bento-card--glow-green">
            <h3>Editorial Calendar</h3>
            <p>Plan restaurant visits and content drops on a visual timeline. More consistency means more revenue.</p>
            <MiniCalendar />
          </BentoCard>

          {/* Offer Tracking — count-up stats */}
          <BentoCard className="bento-card--third bento-card--glow-gold">
            <h3>QR Codes &amp; Deals</h3>
            <p>Promo codes and QR links that attribute every scan and redemption back to you &mdash; so you get credit for every customer.</p>
            <MiniQROffer />
          </BentoCard>
        </div>

        <div style={{ textAlign: 'center', marginTop: 'var(--space-10)' }} className="reveal">
          <button
            onClick={() => enterDemo('/app/dashboard')}
            className="btn btn-gradient btn-lg"
          >
            See Your Earnings Pipeline
          </button>
        </div>
      </section>

      {/* ── Restaurant Value: Measurable New Customers ─────────────────── */}
      <section id="restaurants" className="landing-section landing-section--alt">
        <div className="landing-section-header reveal">
          <h2>Restaurants: free to join, built to prove ROI</h2>
          <p>
            Spot is free for restaurants. You only invest in creator partnerships
            that deliver measurable results &mdash; and you see the data before you spend a dime.
          </p>
        </div>

        <div className="landing-bento reveal-stagger">
          {/* ROI Dashboard — primary feature card */}
          <BentoCard className="bento-card--large bento-card--hero bento-card--glow-green">
            <h3>Attribution Dashboard</h3>
            <p>
              See exactly how many new customers each creator sent you and how much they spent.
              Tracked through QR codes, promo codes, and POS integration with Square and Clover.
            </p>
            <MiniROIDashboard />
          </BentoCard>

          {/* Creator Marketplace */}
          <BentoCard className="bento-card--medium bento-card--glow-coral">
            <h3>Receive Creator Proposals</h3>
            <p>
              Get partnership proposals from food creators whose audiences match your neighborhood and cuisine.
              Every creator comes with a track record of attributed visits.
            </p>
            <div className="mini-restaurant-list">
              {[
                { emoji: '\u{1F4F8}', name: 'Sarah K.', area: '45K followers', bg: 'var(--color-accentMuted)' },
                { emoji: '\u{1F3AC}', name: 'Marcus T.', area: '120K followers', bg: 'var(--color-successMuted)' },
                { emoji: '\u{2B50}', name: 'Priya D.', area: '28K followers', bg: 'var(--color-warningMuted)' },
              ].map((r) => (
                <div key={r.name} className="mini-restaurant-row">
                  <div className="mini-restaurant-avatar" style={{ background: r.bg }}>
                    <span role="img" aria-label={r.name}>{r.emoji}</span>
                  </div>
                  <span className="mini-restaurant-name">{r.name}</span>
                  <span className="mini-restaurant-meta">{r.area}</span>
                </div>
              ))}
            </div>
          </BentoCard>

          {/* Full-width: Pay for Results */}
          <BentoCard style={{ gridColumn: '1 / -1' }} className="bento-card--glow-gold">
            <div className="pay-for-results-inner">
              <div>
                <h3>Pay for Results, Not Promises</h3>
                <p>You set the partnership terms upfront. Review and approve all content before it publishes. After it goes live, Spot tracks every customer via QR codes, promo codes, and POS integration. You see the full attribution report before deciding to continue.</p>
              </div>
              <div className="save-tags">
                {['Content Approval', 'QR Tracking', 'POS Integration', 'ROI Reports'].map((tag) => (
                  <span key={tag} className="badge badge--accent">{tag}</span>
                ))}
              </div>
            </div>
          </BentoCard>
        </div>

        <div style={{ textAlign: 'center', marginTop: 'var(--space-10)' }} className="reveal">
          <button
            onClick={() => enterDemo('/app/partner')}
            className="btn btn-primary btn-lg"
          >
            Explore the Restaurant View
          </button>
        </div>
      </section>

      {/* ── Social Proof / Comparison ──────────────────────────────────── */}
      <SocialProofSection />

      {/* ── Spot's Role — Platform Value Proposition ───────────────────── */}
      <section className="landing-section">
        <div className="landing-section-header reveal">
          <h2>Spot only wins when creators and restaurants win</h2>
          <p>
            We don&rsquo;t sell ads. We don&rsquo;t sell data. Spot charges a platform fee
            on successful partnerships &mdash; which means our incentive is to make both sides profitable.
          </p>
        </div>

        <div className="value-prop-grid reveal-stagger">
          <div className="value-prop-card value-prop-card--creator">
            <div className="value-prop-card-header">
              <span className="value-prop-card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </span>
              <h3>For Creators</h3>
            </div>
            <ul className="value-prop-list">
              <li>Get paid to create content you already love</li>
              <li>Prove your ROI to command higher rates</li>
              <li>Build a portfolio of attributed restaurant partnerships</li>
              <li>Pipeline of deals keeps income consistent</li>
            </ul>
          </div>

          <div className="value-prop-card value-prop-card--restaurant">
            <div className="value-prop-card-header">
              <span className="value-prop-card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><path d="M7 2v20" />
                  <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
                </svg>
              </span>
              <h3>For Restaurants</h3>
            </div>
            <ul className="value-prop-list">
              <li>Get measurable new customers, not just impressions</li>
              <li>POS integration (Square, Clover) tracks actual transactions</li>
              <li>Approve content before it goes live</li>
              <li>Always free to join &mdash; pay only for results</li>
            </ul>
          </div>

          <div className="value-prop-card value-prop-card--spot">
            <div className="value-prop-card-header">
              <span className="value-prop-card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
                  <path d="M12 18V6" />
                </svg>
              </span>
              <h3>How Spot Earns</h3>
            </div>
            <ul className="value-prop-list">
              <li>Platform fee on successful partnerships</li>
              <li>Creator subscriptions for tools &amp; analytics</li>
              <li>We profit only when both sides profit</li>
              <li>No ads, no data selling, no hidden fees</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────── */}
      <section id="pricing" className="landing-section landing-section--alt">
        <div className="landing-section-header reveal">
          <h2>Creator plans that pay for themselves</h2>
          <p>
            The tools to land restaurant deals, prove your impact, and grow your income.
            Try the full demo free &mdash; subscribe when you land your first partnership.
          </p>
        </div>

        <div className="pricing-grid reveal-stagger">
          {pricingTiers.map((tier) => (
            <div
              key={tier.name}
              className={`card pricing-card${tier.highlighted ? ' pricing-card--highlighted' : ''}`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--font-xl)', fontWeight: 700, letterSpacing: '-0.01em' }}>
                  {tier.name}
                </h3>
                {tier.highlighted && (
                  <span className="badge badge--gradient">
                    Most Popular
                  </span>
                )}
              </div>
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <span className="pricing-card-price" style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--font-4xl)', fontWeight: 800, color: 'var(--color-accent)', letterSpacing: '-0.03em' }}>
                  {tier.price}
                </span>
                <span style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textMuted)', marginLeft: 4 }}>/mo</span>
              </div>
              <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textSecondary)', marginBottom: 'var(--space-6)', lineHeight: 1.6 }}>
                {tier.description}
              </p>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-8)' }}>
                {tier.features.map((f) => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--font-sm)', color: 'var(--color-textSecondary)' }}>
                    <span style={{ color: 'var(--color-success)', fontSize: 'var(--font-base)' }}>&#x2713;</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => enterDemo('/app/dashboard')}
                className={`btn ${tier.highlighted ? 'btn-gradient' : 'btn-secondary'}`}
                style={{ width: '100%', textAlign: 'center', display: 'block', padding: 'var(--space-3) var(--space-5)' }}
              >
                {tier.highlighted ? 'Get Started' : 'Try Creator Demo'}
              </button>
            </div>
          ))}
        </div>

        <div className="restaurant-pricing-callout reveal" style={{ maxWidth: '1100px', margin: 'var(--space-8) auto 0', padding: 'var(--space-6) var(--space-8)', background: 'var(--color-bgElevated)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)', overflow: 'hidden' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--font-xl)', fontWeight: 700, color: 'var(--color-success)', marginBottom: 'var(--space-1)' }}>
              Restaurants: always free to join
            </h3>
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textSecondary)', lineHeight: 1.6, maxWidth: '500px' }}>
              No subscription. No upfront cost. Spot takes a small platform fee only on successful creator partnerships that deliver measurable new customers.
            </p>
          </div>
          <button
            onClick={() => enterDemo('/app/partner')}
            className="btn btn-primary"
            style={{ padding: 'var(--space-3) var(--space-6)', whiteSpace: 'nowrap' }}
          >
            Get Started Free
          </button>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <span>&copy; {new Date().getFullYear()} Spot Platform. All rights reserved.</span>
          <div className="landing-footer-links">
            <a href="#pricing" className="landing-footer-link">Pricing</a>
            <button
              onClick={() => enterDemo('/app/dashboard')}
              className="landing-footer-link"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Try Demo
            </button>
            <a href="/privacy" className="landing-footer-link">Privacy</a>
            <a href="/terms" className="landing-footer-link">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
