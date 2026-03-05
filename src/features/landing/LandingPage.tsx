import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '../../store/authStore';
import './LandingPage.css';

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
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  return ref;
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
        <div className="mini-pipeline-label">Lead</div>
        <div className="mini-pipeline-item mini-pipeline-item--blue">
          <span className="mini-pipeline-name">Rasika</span>
          <span className="mini-pipeline-value">$1,200</span>
        </div>
        <div className="mini-pipeline-item mini-pipeline-item--blue">
          <span className="mini-pipeline-name">Tail Up Goat</span>
          <span className="mini-pipeline-value">$800</span>
        </div>
      </div>
      <div className="mini-pipeline-col">
        <div className="mini-pipeline-label">Active</div>
        <div className="mini-pipeline-item mini-pipeline-item--green">
          <span className="mini-pipeline-name">Bad Saint</span>
          <span className="mini-pipeline-value">$2,500</span>
        </div>
        <div className="mini-pipeline-item mini-pipeline-item--green">
          <span className="mini-pipeline-name">Rose&rsquo;s Luxury</span>
          <span className="mini-pipeline-value">$1,800</span>
        </div>
        <div className="mini-pipeline-item mini-pipeline-item--green">
          <span className="mini-pipeline-name">Maydan</span>
          <span className="mini-pipeline-value">$3,000</span>
        </div>
      </div>
      <div className="mini-pipeline-col">
        <div className="mini-pipeline-label">Complete</div>
        <div className="mini-pipeline-item mini-pipeline-item--orange">
          <span className="mini-pipeline-name">Le Dip</span>
          <span className="mini-pipeline-value">$1,500</span>
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
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="chartGradBright" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      {bars.map((bar, i) => (
        <rect
          key={i}
          x={i * (barW + gap)}
          y={80 - bar.h}
          width={barW}
          height={bar.h}
          rx={4}
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

/* ─── Pricing Tiers ──────────────────────────────────────────────────────── */

const pricingTiers = [
  {
    name: 'Starter',
    price: '$49',
    description: 'For creators just starting to monetize',
    features: ['Up to 5 active campaigns', 'Content archive', 'Basic ROI reports', 'Restaurant directory'],
  },
  {
    name: 'Pro',
    price: '$99',
    description: 'For creators with consistent partnerships',
    features: ['Unlimited campaigns', 'Editorial calendar', 'Advanced ROI + benchmarks', 'QR & offer attribution', 'Audience discovery app'],
    highlighted: true,
  },
  {
    name: 'Scale',
    price: '$149',
    description: 'For creators building a team',
    features: ['Everything in Pro', 'Team member access', 'White-label reports', 'API access', 'Priority support'],
  },
];

/* ─── Landing Page ───────────────────────────────────────────────────────── */

export default function LandingPage() {
  const rootRef = useScrollReveal();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setDemoMode = useAuthStore((s) => s.setDemoMode);

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

  return (
    <div ref={rootRef} style={{ minHeight: '100vh', background: 'var(--color-bgPrimary)' }}>
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-4) var(--space-6)',
          maxWidth: 1200,
          margin: '0 auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-full)',
              background: 'var(--color-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 'var(--font-base)',
              color: '#fff',
            }}
          >
            S
          </div>
          <span style={{ fontWeight: 700, fontSize: 'var(--font-lg)' }}>Spot</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link
            to="/auth"
            style={{
              fontSize: 'var(--font-sm)',
              padding: '8px 20px',
              color: '#1B2838',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Sign In
          </Link>
          <Link
            to="/auth"
            className="btn btn-primary"
            style={{ fontSize: 'var(--font-sm)', padding: '8px 24px' }}
          >
            Get Started
          </Link>
          <button
            onClick={() => enterDemo('/app/dashboard')}
            style={{
              fontSize: 'var(--font-sm)',
              padding: '8px 16px',
              color: '#666',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              borderLeft: '1px solid #ddd',
              marginLeft: 4,
              paddingLeft: 16,
            }}
          >
            Demo
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="landing-hero">
        <div
          className="badge badge--accent"
          style={{ marginBottom: 'var(--space-4)', display: 'inline-flex' }}
        >
          Built for food creators
        </div>
        <h1
          style={{
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 700,
            lineHeight: 1.15,
            marginBottom: 'var(--space-5)',
          }}
        >
          Stop running your business on{' '}
          <span style={{ color: 'var(--color-accent)' }}>spreadsheets and DMs</span>
        </h1>
        <p
          style={{
            fontSize: 'var(--font-lg)',
            color: 'var(--color-textSecondary)',
            maxWidth: 600,
            margin: '0 auto var(--space-8)',
            lineHeight: 1.7,
          }}
        >
          Spot replaces your scattered tools with one platform: track partnerships, schedule content,
          prove ROI to restaurants, and give your audience a discovery app they&rsquo;ll actually use.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => enterDemo('/app/dashboard')}
            className="btn btn-primary"
            style={{ padding: '14px 36px', fontSize: 'var(--font-base)' }}
          >
            I&rsquo;m a Creator
          </button>
          <button
            onClick={() => enterDemo('/app/discover')}
            className="btn btn-secondary"
            style={{ padding: '14px 36px', fontSize: 'var(--font-base)' }}
          >
            Explore Restaurants
          </button>
        </div>
      </section>

      {/* ── Creator Features Bento ──────────────────────────────────────────── */}
      <section className="landing-section">
        <div className="landing-section-header reveal">
          <h2>Everything you need to run your creator business</h2>
          <p>
            No more juggling spreadsheets, DMs, and screenshots.
            One platform for partnerships, content, and your audience.
          </p>
        </div>

        <div className="landing-bento reveal-stagger">
          {/* Partnership Pipeline — primary feature card */}
          <BentoCard className="bento-card--large bento-card--hero bento-card--glow-orange">
            <h3>Partnership Pipeline &amp; CRM</h3>
            <p>
              Track every restaurant deal from first DM to final payment.
              See your entire business at a glance &mdash; who&rsquo;s interested,
              who&rsquo;s active, and who&rsquo;s paid.
            </p>
            <MiniPipeline />
          </BentoCard>

          {/* ROI Reports — SVG chart with gradient fills */}
          <BentoCard className="bento-card--medium bento-card--glow-blue">
            <h3>Auto-Generated ROI Reports</h3>
            <p>
              One-click reports that prove your value.
              Show restaurants exactly what they got for their investment.
            </p>
            <MiniChartSVG />
          </BentoCard>

          {/* Content Archive */}
          <BentoCard className="bento-card--third bento-card--glow-purple">
            <h3>Content Archive</h3>
            <p>Every post, metric, and performance tier in one searchable library.</p>
            <MiniPhotos />
          </BentoCard>

          {/* Editorial Calendar */}
          <BentoCard className="bento-card--third bento-card--glow-green">
            <h3>Editorial Calendar</h3>
            <p>Plan sponsored and organic content on a visual timeline.</p>
            <MiniCalendar />
          </BentoCard>

          {/* Offer Tracking — count-up stats */}
          <BentoCard className="bento-card--third bento-card--glow-orange">
            <h3>QR Codes &amp; Offer Tracking</h3>
            <p>Promo codes and QR links that attribute every scan and redemption back to you.</p>
            <MiniQROffer />
          </BentoCard>
        </div>
      </section>

      {/* ── For Foodies ─────────────────────────────────────────────────────── */}
      <section className="landing-section landing-section--alt">
        <div className="landing-section-header reveal">
          <h2>Follow food creators? This is for you.</h2>
          <p>
            Discover curated restaurant picks, save your favorites, and unlock exclusive deals
            &mdash; all powered by the creators you already trust.
          </p>
        </div>

        <div className="landing-bento reveal-stagger">
          {/* Discover */}
          <BentoCard className="bento-card--large bento-card--glow-green">
            <h3>Discover</h3>
            <p>Browse curated restaurants with filters for cuisine, vibe, and neighborhood.</p>
            <div className="mini-restaurant-list">
              {[
                { emoji: '\u{1F363}', name: 'Omakase Room', area: 'Georgetown', bg: 'var(--color-accentMuted)' },
                { emoji: '\u{1F35D}', name: 'Trattoria Nova', area: 'Dupont Circle', bg: 'var(--color-successMuted)' },
                { emoji: '\u{1F32E}', name: 'El Cielo', area: '14th Street', bg: 'var(--color-warningMuted)' },
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

          {/* Deals */}
          <BentoCard className="bento-card--medium bento-card--glow-orange">
            <h3>Exclusive Deals</h3>
            <p>Discounts and offers you won&rsquo;t find on any other app.</p>
            <div className="mini-deal-card">
              <div className="mini-deal-pct">20% off</div>
              <div className="mini-deal-name">Omakase Room &mdash; Tasting Menu</div>
              <span className="mini-deal-code">SPOT-OMAKASE</span>
            </div>
          </BentoCard>

          {/* Save Lists — full width */}
          <BentoCard style={{ gridColumn: '1 / -1' }} className="bento-card--glow-purple">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
              <div>
                <h3>Save Lists</h3>
                <p>Organize your favorites by occasion &mdash; date night, brunch, group dinners, solo adventures.</p>
              </div>
              <div className="save-tags">
                {['Date Night', 'Brunch', 'Group Dinners', 'Solo'].map((tag) => (
                  <span key={tag} className="badge badge--accent">{tag}</span>
                ))}
              </div>
            </div>
          </BentoCard>
        </div>

        <div style={{ textAlign: 'center', marginTop: 'var(--space-8)' }} className="reveal">
          <button
            onClick={() => enterDemo('/app/discover')}
            className="btn btn-primary"
            style={{ padding: '14px 36px', fontSize: 'var(--font-base)' }}
          >
            Explore Restaurants
          </button>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────────── */}
      <section id="pricing" className="landing-section landing-section--alt">
        <div className="landing-section-header reveal">
          <h2>Simple, transparent pricing</h2>
          <p>Start free with the demo. Upgrade when you&rsquo;re ready.</p>
        </div>

        <div className="pricing-grid reveal-stagger">
          {pricingTiers.map((tier) => (
            <div
              key={tier.name}
              className={`card pricing-card${tier.highlighted ? ' pricing-card--highlighted' : ''}`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                <h3 style={{ fontSize: 'var(--font-xl)', fontWeight: 700 }}>
                  {tier.name}
                </h3>
                {tier.highlighted && (
                  <span className="badge badge--accent">
                    Recommended
                  </span>
                )}
              </div>
              <div style={{ marginBottom: 'var(--space-3)' }}>
                <span style={{ fontSize: 'var(--font-3xl)', fontWeight: 700, color: 'var(--color-accent)' }}>
                  {tier.price}
                </span>
                <span style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textMuted)' }}>/mo</span>
              </div>
              <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textSecondary)', marginBottom: 'var(--space-6)' }}>
                {tier.description}
              </p>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
                {tier.features.map((f) => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--font-sm)', color: 'var(--color-textSecondary)' }}>
                    <span style={{ color: 'var(--color-success)' }}>&#x2713;</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => enterDemo('/app/dashboard')}
                className={`btn ${tier.highlighted ? 'btn-primary' : 'btn-secondary'}`}
                style={{ width: '100%', textAlign: 'center', display: 'block' }}
              >
                Try Creator Demo
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--color-border)',
          padding: 'var(--space-6)',
          textAlign: 'center',
          color: 'var(--color-textMuted)',
          fontSize: 'var(--font-sm)',
        }}
      >
        Spot &mdash; Creator tools for food influencers.
      </footer>
    </div>
  );
}
