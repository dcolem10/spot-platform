import { Link } from 'react-router-dom';

const concepts = [
  {
    id: 'platform',
    title: 'Spot Platform',
    subtitle: 'Creator-Led Restaurant Discovery + Partnership Hub',
    who: 'Restaurants pay',
    price: '$299–$499/mo',
    color: '#f97316',
    description:
      'Turn your restaurant recommendations into a searchable, trackable platform. Restaurants get credible ROI reports, QR attribution, and a partner portal. Your audience gets a discovery app. You get a CRM that scales.',
    features: [
      'Searchable restaurant directory with your ratings',
      'Campaign management & partnership CRM',
      'QR/NFC attribution kits for partner restaurants',
      'Auto-generated post-campaign ROI reports',
      'Restaurant partner portal with live metrics',
      'Audience email/SMS capture',
    ],
    cta: 'Explore Platform',
    link: '/app/restaurants',
  },
  {
    id: 'insider',
    title: 'Spot Insider',
    subtitle: 'Digital Membership + Discovery App',
    who: 'Audience pays',
    price: '$4.99/mo',
    color: '#8b5cf6',
    description:
      'Your audience wants fast answers to "where should I eat tonight?" Give them a filterable, saveable, shareable discovery app — with exclusive deals for paying members. Build an owned audience off-platform.',
    features: [
      'Searchable discovery with cuisine/vibe/occasion filters',
      'Personal "want to try" lists with sharing',
      'Exclusive deals for Insider members',
      'AI-powered "mood match" recommendations',
      'One-tap reserve/directions/call actions',
      'Ad-free, algorithm-free experience',
    ],
    cta: 'Explore Insider',
    link: '/app/discover',
  },
  {
    id: 'spotops',
    title: 'SpotOps',
    subtitle: 'SaaS for Local Food Creators',
    who: 'Creators pay',
    price: '$49–$149/mo',
    color: '#06b6d4',
    description:
      'Every food creator with 50K+ followers has the same problem: too many inbound requests, no way to track deliverables, and restaurants asking "what was my ROI?" SpotOps solves all three.',
    features: [
      'Partnership CRM with pipeline tracking',
      'Inbound request intake form (embed anywhere)',
      'Content archive with performance metrics',
      'Editorial calendar for content planning',
      'Auto-generated ROI reports per campaign',
      'Cross-platform analytics (IG + TikTok)',
    ],
    cta: 'Explore SpotOps',
    link: '/app/dashboard',
  },
];

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bgPrimary)' }}>
      {/* Hero */}
      <header
        style={{
          textAlign: 'center',
          padding: 'var(--space-12) var(--space-6)',
          maxWidth: 800,
          margin: '0 auto',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-6)',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 'var(--radius-full)',
              background: 'var(--color-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 'var(--font-lg)',
              color: '#fff',
            }}
          >
            SP
          </div>
          <span style={{ fontWeight: 700, fontSize: 'var(--font-2xl)' }}>Spot Platform</span>
        </div>

        <h1
          style={{
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 700,
            lineHeight: 1.15,
            marginBottom: 'var(--space-5)',
          }}
        >
          Technology for{' '}
          <span style={{ color: 'var(--color-accent)' }}>food creators</span> who are
          ready to scale
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
          Three products. One platform. Turn your restaurant recommendations into a
          searchable directory, your partnerships into measurable campaigns, and your audience
          into an owned community.
        </p>

        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/app/dashboard" className="btn btn-primary" style={{ padding: '12px 32px', fontSize: 'var(--font-base)' }}>
            Open Dashboard
          </Link>
          <a href="#concepts" className="btn btn-secondary" style={{ padding: '12px 32px', fontSize: 'var(--font-base)' }}>
            See All Concepts
          </a>
        </div>
      </header>

      {/* Cost Summary Banner */}
      <section
        style={{
          background: 'var(--color-bgSecondary)',
          borderTop: '1px solid var(--color-border)',
          borderBottom: '1px solid var(--color-border)',
          padding: 'var(--space-8) var(--space-6)',
        }}
      >
        <div
          style={{
            maxWidth: 1000,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--space-5)',
            textAlign: 'center',
          }}
        >
          {[
            { label: 'Infrastructure Floor', value: '~$1.50/mo', sub: 'at zero users' },
            { label: 'With 25 Partners', value: '~$450/mo', sub: '93% gross margin' },
            { label: 'Reuse from Networth', value: '~60%', sub: 'of infrastructure' },
            { label: 'Time to MVP', value: '30 days', sub: 'for all 3 concepts' },
          ].map((stat) => (
            <div key={stat.label}>
              <div style={{ fontSize: 'var(--font-3xl)', fontWeight: 700, color: 'var(--color-accent)' }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--color-textPrimary)' }}>
                {stat.label}
              </div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)' }}>
                {stat.sub}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Concepts */}
      <section
        id="concepts"
        style={{ maxWidth: 1200, margin: '0 auto', padding: 'var(--space-12) var(--space-6)' }}
      >
        <h2
          style={{
            fontSize: 'var(--font-2xl)',
            fontWeight: 700,
            textAlign: 'center',
            marginBottom: 'var(--space-10)',
          }}
        >
          Three Products, One Shared Platform
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
          {concepts.map((concept, i) => (
            <div
              key={concept.id}
              className="card"
              style={{
                display: 'grid',
                gridTemplateColumns: i % 2 === 0 ? '1fr 1fr' : '1fr 1fr',
                gap: 'var(--space-6)',
                padding: 'var(--space-8)',
                borderLeft: `4px solid ${concept.color}`,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                  <h3 style={{ fontSize: 'var(--font-xl)', fontWeight: 700 }}>
                    {concept.title}
                  </h3>
                  <span
                    className="badge"
                    style={{ background: `${concept.color}22`, color: concept.color }}
                  >
                    {concept.who}
                  </span>
                </div>
                <p style={{ color: 'var(--color-textSecondary)', marginBottom: 'var(--space-2)', fontWeight: 500 }}>
                  {concept.subtitle}
                </p>
                <p style={{ color: 'var(--color-textSecondary)', fontSize: 'var(--font-sm)', lineHeight: 1.7, marginBottom: 'var(--space-5)' }}>
                  {concept.description}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                  <Link to={concept.link} className="btn btn-primary">
                    {concept.cta}
                  </Link>
                  <span style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: concept.color }}>
                    {concept.price}
                  </span>
                </div>
              </div>
              <div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  {concept.features.map((f) => (
                    <li
                      key={f}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 'var(--space-3)',
                        fontSize: 'var(--font-sm)',
                        color: 'var(--color-textSecondary)',
                      }}
                    >
                      <span style={{ color: concept.color, flexShrink: 0 }}>&#x2713;</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
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
        Spot Platform &mdash; Built on production-grade infrastructure.
        Powered by AWS Serverless.
      </footer>
    </div>
  );
}
