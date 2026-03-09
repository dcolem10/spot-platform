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
          <Link to="/auth" className="landing-nav-link">Sign In</Link>
          <button
            onClick={() => enterDemo('/app/dashboard')}
            className="landing-nav-link"
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
            Built for food creators
          </div>
          <h1>
            Stop running your business on{' '}
            <span className="text-gradient">spreadsheets and DMs</span>
          </h1>
          <p className="landing-hero-desc">
            Spot replaces your scattered tools with one platform: track partnerships, schedule content,
            prove ROI to restaurants, and give your audience a discovery app they&rsquo;ll actually use.
          </p>
          <div className="landing-hero-actions">
            <div className="cta-pulse-wrap">
              <button
                onClick={() => enterDemo('/app/dashboard')}
                className="btn btn-gradient btn-lg"
              >
                I&rsquo;m a Creator
              </button>
            </div>
            <button
              onClick={() => enterDemo('/app/discover')}
              className="btn btn-secondary btn-lg"
            >
              Explore Restaurants
            </button>
          </div>
        </div>

        {/* Right: Floating dashboard mockup */}
        <div className="landing-hero-3d">
          <div className="hero-device-wrap">
            <div className="hero-device-glow" aria-hidden="true" />
            <img
              src="/hero-dashboard.png"
              alt="Spot Platform dashboard showing Partnership Pipeline with analytics charts"
              className="hero-device-img"
              loading="eager"
              width={600}
              height={340}
            />
          </div>
        </div>
      </section>

      {/* ── Social Proof Stats ───────────────────────────────────────────── */}
      {/* ── Platform Capabilities (truthful — not fake user counts) ──── */}
      <section className="landing-stats reveal">
        <div className="landing-stat">
          <div className="landing-stat-value"><span ref={cities.ref}>{cities.value}</span></div>
          <div className="landing-stat-label">Cities Supported</div>
        </div>
        <div className="landing-stat">
          <div className="landing-stat-value"><span ref={restaurants.ref}>{restaurants.value.toLocaleString()}</span>+</div>
          <div className="landing-stat-label">Restaurants in Directory</div>
        </div>
        <div className="landing-stat">
          <div className="landing-stat-value"><span ref={features.ref}>{features.value}</span></div>
          <div className="landing-stat-label">Built-In Tools</div>
        </div>
      </section>

      {/* ── Creator Features Bento ──────────────────────────────────────── */}
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
          <BentoCard className="bento-card--third bento-card--glow-gold">
            <h3>QR Codes &amp; Offer Tracking</h3>
            <p>Promo codes and QR links that attribute every scan and redemption back to you.</p>
            <MiniQROffer />
          </BentoCard>
        </div>
      </section>

      {/* ── For Foodies ─────────────────────────────────────────────────── */}
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
          <BentoCard className="bento-card--medium bento-card--glow-coral">
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

        <div style={{ textAlign: 'center', marginTop: 'var(--space-10)' }} className="reveal">
          <button
            onClick={() => enterDemo('/app/discover')}
            className="btn btn-primary btn-lg"
          >
            Explore Restaurants
          </button>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────── */}
      <section id="pricing" className="landing-section">
        <div className="landing-section-header reveal">
          <h2>Simple, transparent pricing</h2>
          <p>Try the full demo free. Subscribe when you&rsquo;re ready.</p>
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
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--font-4xl)', fontWeight: 800, color: 'var(--color-accent)', letterSpacing: '-0.03em' }}>
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
                Try Creator Demo
              </button>
            </div>
          ))}
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
