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

/* ─── Rotating Text Hook ─────────────────────────────────────────────────── */

function useRotatingText(phrases: string[], interval = 3000) {
  const [index, setIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % phrases.length);
        setIsAnimating(false);
      }, 400);
    }, interval);
    return () => clearInterval(timer);
  }, [phrases.length, interval]);

  return { text: phrases[index], isAnimating };
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
          <span>First-Party Tracking</span>
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

/* ─── Integration Trust Bar ────────────────────────────────────────────── */

function IntegrationTrustBar() {
  return (
    <div className="integration-trust-bar reveal">
      <span className="integration-trust-label">Integrated with</span>
      <div className="integration-logos">
        <div className="integration-logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
          </svg>
          <span>Square</span>
        </div>
        <div className="integration-logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Z" /><path d="M12 6v6l4 2" />
          </svg>
          <span>Clover</span>
        </div>
        <div className="integration-logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>Toast</span>
        </div>
        <div className="integration-logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
          <span>Instagram</span>
        </div>
        <div className="integration-logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /><path d="M15 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
            <path d="M9 20a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /><path d="M15 20a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
          </svg>
          <span>TikTok</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Brand Logo Carousel ───────────────────────────────────────────────── */

const partnerRestaurants = [
  { name: 'Bad Saint', cuisine: 'Filipino' },
  { name: 'Compass Rose', cuisine: 'Global' },
  { name: 'Tail Up Goat', cuisine: 'American' },
  { name: 'Estadio', cuisine: 'Spanish' },
  { name: 'Cranes', cuisine: 'Japanese-Spanish' },
  { name: 'Immigrant Food', cuisine: 'Global' },
  { name: 'Maketto', cuisine: 'Cambodian-Taiwanese' },
  { name: 'Thip Khao', cuisine: 'Laotian' },
];

function BrandLogoCarousel() {
  // Duplicate the list so the marquee loops seamlessly
  const doubled = [...partnerRestaurants, ...partnerRestaurants];

  return (
    <section className="brand-logos-section reveal">
      <p className="brand-logos-eyebrow">Trusted by DC&rsquo;s top independent restaurants</p>
      <div className="brand-logos-track-wrapper" aria-hidden="true">
        <div className="brand-logos-track">
          {doubled.map((r, i) => (
            <div key={i} className="brand-logo-card">
              <span className="brand-logo-name">{r.name}</span>
              <span className="brand-logo-cuisine">{r.cuisine}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Testimonials Section ─────────────────────────────────────────────── */

const testimonials = [
  {
    quote: "I went from free meals to $4,800/month in paid partnerships. The attribution data is what convinced restaurants to pay real money.",
    name: 'Sarah K.',
    role: 'Food Creator',
    metric: '$4.8K/mo',
    metricLabel: 'Monthly Income',
    followers: '45K followers',
    accentColor: 'var(--color-accent)',
  },
  {
    quote: "We saw 247 new customers in the first 90 days. No other marketing channel gives us this level of attribution certainty.",
    name: 'Chef Marcus',
    role: 'Restaurant Owner, Bad Saint',
    metric: '247',
    metricLabel: 'New Customers',
    followers: '',
    accentColor: 'var(--color-success)',
  },
  {
    quote: "The POS integration is a game-changer. I can show restaurants exactly which diners came from my content — down to the receipt.",
    name: 'Priya D.',
    role: 'Food Creator',
    metric: '5.6x',
    metricLabel: 'Avg. ROAS',
    followers: '28K followers',
    accentColor: 'var(--color-info)',
  },
];

function TestimonialsSection() {
  return (
    <section className="landing-section">
      <div className="landing-section-header reveal">
        <h2>Real results from real partnerships</h2>
        <p>
          Creators and restaurants using Spot to prove ROI and grow revenue together.
        </p>
      </div>

      <div className="testimonials-grid reveal-stagger">
        {testimonials.map((t) => (
          <div key={t.name} className="testimonial-card">
            <div className="testimonial-metric" style={{ color: t.accentColor }}>
              <span className="testimonial-metric-value">{t.metric}</span>
              <span className="testimonial-metric-label">{t.metricLabel}</span>
            </div>
            <blockquote className="testimonial-quote">
              &ldquo;{t.quote}&rdquo;
            </blockquote>
            <div className="testimonial-author">
              <div className="testimonial-avatar" style={{ borderColor: t.accentColor }} />
              <div className="testimonial-author-info">
                <span className="testimonial-author-name">{t.name}</span>
                <span className="testimonial-author-role">{t.role}</span>
              </div>
              {t.followers && <span className="testimonial-followers">{t.followers}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="testimonial-stats reveal">
        <div className="testimonial-stat">
          <span className="testimonial-stat-value">5.6x</span>
          <span className="testimonial-stat-label">Average ROAS for creators</span>
        </div>
        <div className="testimonial-stat">
          <span className="testimonial-stat-value">90 days</span>
          <span className="testimonial-stat-label">Attribution window</span>
        </div>
        <div className="testimonial-stat">
          <span className="testimonial-stat-value">3 POS</span>
          <span className="testimonial-stat-label">Integrations live</span>
        </div>
        <div className="testimonial-stat">
          <span className="testimonial-stat-value">$0</span>
          <span className="testimonial-stat-label">For restaurants to join</span>
        </div>
      </div>
    </section>
  );
}

/* ─── HeroVisual — CSS-only animated dashboard ──────────────────────────── */

const HLD_BARS = [28, 45, 38, 62, 55, 72, 68, 85, 78, 92, 88, 95];

function HeroVisual() {
  return (
    <div className="landing-hero-3d">
      <div className="hero-device-wrap">
        <div className="hero-device-glow" aria-hidden="true" />
        <div className="hld-card">
          {/* Window chrome */}
          <div className="hld-chrome">
            <div className="hld-dots" aria-hidden="true">
              <span className="hld-dot hld-dot--r" />
              <span className="hld-dot hld-dot--y" />
              <span className="hld-dot hld-dot--g" />
            </div>
            <span className="hld-chrome-title">Spot — Creator Analytics</span>
            <div className="hld-chrome-live">
              <span className="hld-live-dot" aria-hidden="true" />
              Live
            </div>
          </div>

          {/* Stats row */}
          <div className="hld-stats">
            <div className="hld-stat">
              <span className="hld-stat-v hld-stat-v--orange">$18.4K</span>
              <span className="hld-stat-k">Revenue</span>
            </div>
            <div className="hld-stat">
              <span className="hld-stat-v hld-stat-v--green">247</span>
              <span className="hld-stat-k">Visits</span>
            </div>
            <div className="hld-stat">
              <span className="hld-stat-v hld-stat-v--blue">5.6x</span>
              <span className="hld-stat-k">ROAS</span>
            </div>
            <div className="hld-stat">
              <span className="hld-stat-v hld-stat-v--purple">12</span>
              <span className="hld-stat-k">Active</span>
            </div>
          </div>

          {/* Animated bar chart */}
          <div className="hld-chart-wrap">
            <div className="hld-chart-label">Revenue attribution — 90 days</div>
            <div className="hld-chart-bars">
              {HLD_BARS.map((h, i) => (
                <div
                  key={i}
                  className="hld-bar"
                  style={{ '--hld-h': `${h}%`, '--hld-d': `${i * 80}ms` } as React.CSSProperties}
                />
              ))}
            </div>
          </div>

          {/* Live activity feed */}
          <div className="hld-feed">
            <div className="hld-feed-item hld-feed-item--1">
              <span className="hld-feed-pulse hld-feed-pulse--green" aria-hidden="true" />
              <span className="hld-feed-msg">Sarah K. drove <strong>89 new visits</strong></span>
              <span className="hld-feed-chip hld-feed-chip--green">+$2.1K</span>
            </div>
            <div className="hld-feed-item hld-feed-item--2">
              <span className="hld-feed-pulse hld-feed-pulse--blue" aria-hidden="true" />
              <span className="hld-feed-msg">Rasika — content approved</span>
              <span className="hld-feed-chip hld-feed-chip--blue">Live</span>
            </div>
            <div className="hld-feed-item hld-feed-item--3">
              <span className="hld-feed-pulse hld-feed-pulse--orange" aria-hidden="true" />
              <span className="hld-feed-msg">QR scan — Table 7, Tail Up Goat</span>
              <span className="hld-feed-chip hld-feed-chip--orange">Now</span>
            </div>
          </div>
        </div>

        {/* Floating metric badges */}
        <div className="hbf hbf--1" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
          </svg>
          <div className="hbf-text">
            <span className="hbf-v">+340%</span>
            <span className="hbf-k">Creator Reach</span>
          </div>
        </div>
        <div className="hbf hbf--2" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" />
          </svg>
          <div className="hbf-text">
            <span className="hbf-v">90-day</span>
            <span className="hbf-k">Attribution</span>
          </div>
        </div>
        <div className="hbf hbf--3" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          <div className="hbf-text">
            <span className="hbf-v">$0</span>
            <span className="hbf-k">For Restaurants</span>
          </div>
        </div>
      </div>
    </div>
  );
}


/* ─── Landing Page ───────────────────────────────────────────────────────── */

export default function LandingPage() {
  const rootRef = useScrollReveal();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setDemoMode = useAuthStore((s) => s.setDemoMode);
  const setDemoOnboarded = useAuthStore((s) => s.setDemoOnboarded);
  const navScrolled = useScrolledNav();
  const [activeContentTab, setActiveContentTab] = useState<'creators' | 'restaurants' | 'how-it-works'>('creators');
  const [showDemoChooser, setShowDemoChooser] = useState(false);
  const tabNavRef = useRef<HTMLElement>(null);
  const tabSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showDemoChooser) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowDemoChooser(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showDemoChooser]);

  const switchTab = useCallback((tab: 'creators' | 'restaurants' | 'how-it-works') => {
    setActiveContentTab(tab);
    // Use a non-sticky sentinel div — sticky nav's getBoundingClientRect().top
    // always returns its stuck position (72px), making the scroll a no-op.
    const el = tabSentinelRef.current;
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 72;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
  }, []);

  const enterDemo = useCallback(async (path: string, role: 'creator' | 'partner' = 'creator') => {
    // Clear any stale Cognito session so demo mode doesn't conflict
    try {
      const { signOut } = await import('aws-amplify/auth');
      await signOut();
    } catch { /* no session to clear */ }

    const isPartner = role === 'partner';
    setDemoMode(true);
    setDemoOnboarded(false); // Reset so new demo session goes through onboarding
    setAuth({
      userId: isPartner ? 'demo-partner' : 'demo-user',
      email: isPartner ? 'demo-restaurant@spot.app' : 'demo@spot.app',
      name: isPartner ? 'Demo Restaurant' : 'Demo Creator',
      role,
      groups: [role],
      orgId: 'org-demo',
    });
    navigate(path);
  }, [setDemoMode, setDemoOnboarded, setAuth, navigate]);

  // Rotating hero phrases for dynamic value prop showcase
  const heroPhrases = [
    'drives real sales',
    'sends paying customers',
    'earns you recurring revenue',
    'proves your ROI',
  ];
  const rotatingText = useRotatingText(heroPhrases, 3200);

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
          <button onClick={() => switchTab('restaurants')} className="landing-nav-link landing-nav-link--restaurants">For Restaurants</button>
          <button onClick={() => switchTab('creators')} className="landing-nav-link landing-nav-link--pricing">Pricing</button>
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
            Get Started Free
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
            Early Access &mdash; Limited Creator Spots
          </div>
          <h1>
            Prove your food content{' '}
            <span className="hero-rotating-wrapper">
              {/* Hidden sizers — tallest phrase sets the container height, preventing layout shifts */}
              {heroPhrases.map((phrase) => (
                <span key={phrase} className="hero-rotating-sizer text-gradient" aria-hidden="true">{phrase}</span>
              ))}
              <span className={`hero-rotating-text text-gradient${rotatingText.isAnimating ? ' hero-rotating-text--exit' : ''}`}>
                {rotatingText.text}
              </span>
            </span>
          </h1>
          <p className="landing-hero-desc">
            Other platforms track impressions. Spot tracks every customer your
            content sends &mdash; through real POS data from Square, Clover, and Toast.
            Restaurants see exactly what they got, and you earn a share of every
            sale you drive.
          </p>

          {/* Dual-path CTAs for both audiences */}
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
              onClick={() => enterDemo('/app/partner', 'partner')}
              className="btn btn-secondary btn-lg"
            >
              I&rsquo;m a Restaurant &mdash; Join Free
            </button>
          </div>

          {/* Low-friction reassurance directly under the CTAs */}
          <p className="hero-reassurance">
            Free to explore &middot; No credit card &middot; Restaurants always free
          </p>

          {/* Inline social proof below CTAs */}
          <div className="hero-social-proof">
            <div className="hero-proof-item">
              <span className="hero-proof-value">5.6x</span>
              <span className="hero-proof-label">Avg. ROAS</span>
            </div>
            <div className="hero-proof-divider" />
            <div className="hero-proof-item">
              <span className="hero-proof-value">90-day</span>
              <span className="hero-proof-label">Attribution</span>
            </div>
            <div className="hero-proof-divider" />
            <div className="hero-proof-item">
              <span className="hero-proof-value">$0</span>
              <span className="hero-proof-label">For Restaurants</span>
            </div>
          </div>
        </div>

        {/* Right: Animated live dashboard visual */}
        <HeroVisual />
      </section>

      {/* ── Tab Navigation ───────────────────────────────────────────────── */}
      <div ref={tabSentinelRef} style={{ height: 0, overflow: 'hidden' }} aria-hidden="true" />
      <nav className="content-tab-nav" aria-label="Content sections" ref={tabNavRef}>
        <div className="content-tab-nav-inner">
          {(['creators', 'restaurants', 'how-it-works'] as const).map((tab) => (
            <button
              key={tab}
              className={`content-tab-pill${activeContentTab === tab ? ' content-tab-pill--active' : ''}`}
              onClick={() => switchTab(tab)}
            >
              {tab === 'creators' ? 'For Creators' : tab === 'restaurants' ? 'For Restaurants' : 'How It Works'}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Tab: For Creators ────────────────────────────────────────────── */}
      {activeContentTab === 'creators' && (
        <div className="tab-panel">
          <IntegrationTrustBar />

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

          <DashboardPreviewSection enterDemo={enterDemo} />

          <section id="creators" className="landing-section">
            <div className="landing-section-header reveal">
              <h2>Creators: turn your food content into a real income</h2>
              <p>
                Stop guessing whether your posts drive customers. Spot gives you the
                attribution data to command higher rates and the pipeline to keep deals flowing.
              </p>
            </div>

            <div className="landing-bento reveal-stagger">
              <BentoCard className="bento-card--large bento-card--hero bento-card--glow-orange">
                <h3>Your Earnings Pipeline</h3>
                <p>
                  Every restaurant deal at a glance &mdash; what&rsquo;s planned, what&rsquo;s
                  active, and how much you&rsquo;ve earned from each partnership.
                </p>
                <MiniPipeline />
              </BentoCard>

              <BentoCard className="bento-card--medium bento-card--glow-blue">
                <h3>Prove Your Impact</h3>
                <p>
                  One-click reports showing how many customers your content actually
                  sent to each restaurant &mdash; the data that grows your earnings.
                </p>
                <MiniChartSVG />
              </BentoCard>

              <BentoCard className="bento-card--third bento-card--glow-purple">
                <h3>Content Archive</h3>
                <p>Every post, metric, and performance tier in one searchable library &mdash; your portfolio for landing bigger deals.</p>
                <MiniPhotos />
              </BentoCard>

              <BentoCard className="bento-card--third bento-card--glow-green">
                <h3>Editorial Calendar</h3>
                <p>Plan restaurant visits and content drops on a visual timeline. More consistency means more revenue.</p>
                <MiniCalendar />
              </BentoCard>

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

          <section id="pricing" className="landing-section landing-section--alt">
            <div className="landing-section-header reveal">
              <h2>Creator plans that pay for themselves</h2>
              <p>
                Your plan is for the tools &mdash; analytics, attribution, and the pipeline
                to land deals. The income comes from the partnerships: you earn a share of
                every sale your content drives. Most creators cover their plan with a single deal.
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
                onClick={() => enterDemo('/app/partner', 'partner')}
                className="btn btn-primary"
                style={{ padding: 'var(--space-3) var(--space-6)', whiteSpace: 'nowrap' }}
              >
                Get Started Free
              </button>
            </div>
          </section>

          <TestimonialsSection />
        </div>
      )}

      {/* ── Tab: For Restaurants ─────────────────────────────────────────── */}
      {activeContentTab === 'restaurants' && (
        <div className="tab-panel">
          <section id="restaurants" className="landing-section landing-section--alt">
            <div className="landing-section-header reveal">
              <h2>Restaurants: free to join, built to prove ROI</h2>
              <p>
                Spot is free for restaurants. You only invest in creator partnerships
                that deliver measurable results &mdash; and you see the data before you spend a dime.
              </p>
            </div>

            <div className="landing-bento reveal-stagger">
              <BentoCard className="bento-card--large bento-card--hero bento-card--glow-green">
                <h3>Attribution Dashboard</h3>
                <p>
                  See exactly how many new customers each creator sent you and how much they spent.
                  Tracked through QR codes, promo codes, and POS integration with Square and Clover.
                </p>
                <MiniROIDashboard />
              </BentoCard>

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
                onClick={() => enterDemo('/app/partner', 'partner')}
                className="btn btn-primary btn-lg"
              >
                Explore the Restaurant View
              </button>
            </div>
          </section>

          <SocialProofSection />

          <BrandLogoCarousel />

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
        </div>
      )}

      {/* ── Tab: How It Works ────────────────────────────────────────────── */}
      {activeContentTab === 'how-it-works' && (
        <div className="tab-panel">
          <section id="how-it-works" className="landing-section landing-section--alt">
            <div className="landing-section-header reveal">
              <h2>How Spot works</h2>
              <p>
                A simple loop where everyone profits. Creators earn a share of the sales they drive,
                restaurants earn customers, and Spot earns its fee only when both sides see results.
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
                <p>A food creator partners with a restaurant they love &mdash; or receives an inbound request. Restaurants join free and set up an exclusive offer to promote. Nobody pays upfront for unproven results.</p>
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
                <p>When someone scans, clicks, or redeems &mdash; Spot matches it against real POS data to attribute that visit and sale back to the creator. Real customers, real revenue.</p>
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
                <p>Restaurants pay a small fee only on the sales Spot proves their partnership drove. The creator who drove the visit earns a share of that fee, paid out automatically via Stripe Connect. No proven results, no fee.</p>
              </div>
            </div>
          </section>

          <section className="landing-section">
            <div className="landing-section-header reveal">
              <h2>Frequently asked questions</h2>
            </div>
            <div className="faq-grid reveal-stagger">
              <div className="faq-item">
                <h3 className="faq-question">Do I need a minimum follower count?</h3>
                <p className="faq-answer">No minimum. Spot values engagement and attribution over raw follower counts. If your content drives customers to restaurants, Spot will help you prove it regardless of audience size.</p>
              </div>
              <div className="faq-item">
                <h3 className="faq-question">How do I get my first restaurant deal?</h3>
                <p className="faq-answer">Browse the restaurant directory, find places you genuinely love, and send a partnership proposal directly through Spot. You set the offer, deliverables, and timeline &mdash; then earn a share of every sale your content drives.</p>
              </div>
              <div className="faq-item">
                <h3 className="faq-question">Is Spot really free for restaurants?</h3>
                <p className="faq-answer">Yes. Restaurants never pay a subscription or setup fee. Spot takes a small platform fee only on successful creator partnerships that deliver measurable new customers.</p>
              </div>
              <div className="faq-item">
                <h3 className="faq-question">What if I don&rsquo;t like the content a creator makes?</h3>
                <p className="faq-answer">Restaurants review and approve all content before it goes live. You always have final say over what gets published about your business.</p>
              </div>
              <div className="faq-item">
                <h3 className="faq-question">How does POS integration work?</h3>
                <p className="faq-answer">Connect your Square, Clover, or Toast account in under 2 minutes. Spot uses read-only access to match customer visits to creator content &mdash; no new hardware, no staff training, no disruption to service.</p>
              </div>
              <div className="faq-item">
                <h3 className="faq-question">Can I use Spot alongside my existing brand deals?</h3>
                <p className="faq-answer">Absolutely. Spot is specifically for restaurant partnerships. Your existing brand deals, sponsorships, and agency relationships stay exactly as they are.</p>
              </div>
            </div>
          </section>

          <section className="landing-section landing-section--alt landing-booking-section">
            <div className="landing-booking-inner reveal">
              <div className="landing-booking-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                  <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
                </svg>
              </div>
              <div className="landing-booking-copy">
                <h2>See Spot in action</h2>
                <p>
                  Schedule a 20-minute call with the Spot team. We&rsquo;ll walk you through the attribution
                  dashboard, answer your questions, and set up your first creator partnership on the spot.
                </p>
                <div className="landing-booking-targets">
                  <span className="landing-booking-target">&#x1F37D;&#xFE0F;&nbsp; Restaurant owners</span>
                  <span className="landing-booking-target">&#x1F4F8;&nbsp; Food creators</span>
                  <span className="landing-booking-target">&#x23F0;&nbsp; 20 minutes</span>
                  <span className="landing-booking-target">&#x2615;&nbsp; Free consultation</span>
                </div>
              </div>
              <a
                href={import.meta.env.VITE_CALENDLY_URL || 'https://calendly.com/spot-platform/demo'}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-gradient btn-lg landing-booking-btn"
              >
                Book a Free Demo
              </a>
            </div>
          </section>
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <span>&copy; {new Date().getFullYear()} Spot Platform. All rights reserved.</span>
          <div className="landing-footer-links">
            <a href="#pricing" className="landing-footer-link">Pricing</a>
            <button
              onClick={() => setShowDemoChooser(true)}
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

      {/* ── Demo role chooser ───────────────────────────────────────────── */}
      {showDemoChooser && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Choose a demo experience"
          onClick={() => setShowDemoChooser(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1.5rem',
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 520,
              background: 'var(--color-bgElevated, #16181d)',
              border: '1px solid var(--color-border, #2a2d34)',
              borderRadius: 'var(--radius-md, 16px)',
              padding: '2rem',
              boxShadow: 'var(--shadow-lg, 0 24px 64px rgba(0,0,0,0.5))',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--color-textPrimary, #fff)' }}>
                Try the demo as…
              </h3>
              <button
                onClick={() => setShowDemoChooser(false)}
                aria-label="Close"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '1.5rem', lineHeight: 1, color: 'var(--color-textMuted, #8b909a)',
                }}
              >
                ×
              </button>
            </div>
            <p style={{ margin: '0 0 1.5rem', color: 'var(--color-textSecondary, #b6bcc6)' }}>
              Explore Spot from either side of the marketplace — no signup required.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <button
                onClick={() => { setShowDemoChooser(false); enterDemo('/app/dashboard'); }}
                style={{
                  textAlign: 'left', cursor: 'pointer',
                  background: 'var(--color-bgSecondary, #1c1f26)',
                  border: '1px solid var(--color-border, #2a2d34)',
                  borderRadius: 'var(--radius-md, 12px)', padding: '1.25rem',
                  color: 'var(--color-textPrimary, #fff)', fontFamily: 'inherit',
                }}
              >
                <div style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>🎬</div>
                <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>I'm a Creator</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-textSecondary, #b6bcc6)' }}>
                  Run campaigns, track redemptions, and measure ROI.
                </div>
              </button>
              <button
                onClick={() => { setShowDemoChooser(false); enterDemo('/app/partner', 'partner'); }}
                style={{
                  textAlign: 'left', cursor: 'pointer',
                  background: 'var(--color-bgSecondary, #1c1f26)',
                  border: '1px solid var(--color-border, #2a2d34)',
                  borderRadius: 'var(--radius-md, 12px)', padding: '1.25rem',
                  color: 'var(--color-textPrimary, #fff)', fontFamily: 'inherit',
                }}
              >
                <div style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>🍽️</div>
                <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>I'm a Restaurant</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-textSecondary, #b6bcc6)' }}>
                  Review proposals, approve content, and track attribution.
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
