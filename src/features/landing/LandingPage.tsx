import { Link } from 'react-router-dom';

const features = [
  {
    icon: '\u{1F91D}',
    title: 'Partnership CRM',
    description: 'Track every restaurant partnership from inquiry to completion. Pipeline view, deliverable tracking, budget management.',
  },
  {
    icon: '\u{1F4F7}',
    title: 'Content Archive',
    description: 'All your posts in one place with engagement metrics. Filter by platform, performance tier, or restaurant.',
  },
  {
    icon: '\u{1F4C5}',
    title: 'Editorial Calendar',
    description: 'Plan your content schedule with a visual calendar. Sponsored, organic, and reshoot slots at a glance.',
  },
  {
    icon: '\u{1F4CA}',
    title: 'ROI Reports',
    description: 'Auto-generated campaign reports with reach, engagement, QR attribution, and benchmark comparisons.',
  },
  {
    icon: '\u{1F37D}',
    title: 'Restaurant Directory',
    description: 'Your curated restaurant database with ratings, neighborhoods, and partner status. Searchable by your audience.',
  },
  {
    icon: '\u{1F50D}',
    title: 'Audience Discovery',
    description: 'Let your followers explore your picks with filters, save lists, and exclusive Insider deals.',
  },
];

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

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bgPrimary)' }}>
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
        <Link
          to="/app/dashboard"
          className="btn btn-primary"
          style={{ fontSize: 'var(--font-sm)', padding: '8px 24px' }}
        >
          Creator Demo
        </Link>
      </header>

      {/* Hero */}
      <section
        style={{
          textAlign: 'center',
          padding: 'var(--space-12) var(--space-6) var(--space-10)',
          maxWidth: 800,
          margin: '0 auto',
        }}
      >
        <h1
          style={{
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 700,
            lineHeight: 1.15,
            marginBottom: 'var(--space-5)',
          }}
        >
          You&rsquo;re running a business on{' '}
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
          Spot is the business OS for food creators. Track partnerships, manage content,
          generate ROI reports, and give your audience a discovery app &mdash; all in one place.
        </p>

        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            to="/app/dashboard"
            className="btn btn-primary"
            style={{ padding: '14px 36px', fontSize: 'var(--font-base)' }}
          >
            I&rsquo;m a Creator
          </Link>
          <Link
            to="/app/discover"
            className="btn btn-secondary"
            style={{ padding: '14px 36px', fontSize: 'var(--font-base)' }}
          >
            Explore Restaurants
          </Link>
        </div>
      </section>

      {/* Value Props Row */}
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
            maxWidth: 900,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 'var(--space-5)',
            textAlign: 'center',
          }}
        >
          {[
            { icon: '\u{1F4BC}', label: 'Partnership pipeline & CRM' },
            { icon: '\u{1F4CA}', label: 'Auto-generated ROI reports' },
            { icon: '\u{1F4F1}', label: 'QR codes & offer tracking' },
            { icon: '\u{1F37D}', label: 'Audience discovery app' },
          ].map((item) => (
            <div key={item.label}>
              <div
                style={{
                  fontSize: 'var(--font-2xl)',
                  marginBottom: 'var(--space-2)',
                }}
              >
                {item.icon}
              </div>
              <div
                style={{
                  fontSize: 'var(--font-sm)',
                  color: 'var(--color-textSecondary)',
                }}
              >
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Feature Grid */}
      <section
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: 'var(--space-12) var(--space-6)',
        }}
      >
        <h2
          style={{
            fontSize: 'var(--font-2xl)',
            fontWeight: 700,
            textAlign: 'center',
            marginBottom: 'var(--space-3)',
          }}
        >
          Everything you need to run your creator business
        </h2>
        <p
          style={{
            textAlign: 'center',
            color: 'var(--color-textSecondary)',
            fontSize: 'var(--font-base)',
            marginBottom: 'var(--space-10)',
            maxWidth: 500,
            margin: '0 auto var(--space-10)',
          }}
        >
          No more juggling spreadsheets, DMs, and screenshots. One platform for partnerships, content, and audience.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 'var(--space-6)',
          }}
        >
          {features.map((feature) => (
            <div
              key={feature.title}
              className="card"
              style={{
                padding: 'var(--space-6)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
              }}
            >
              <span style={{ fontSize: 'var(--font-2xl)' }}>{feature.icon}</span>
              <h3
                style={{
                  fontSize: 'var(--font-lg)',
                  fontWeight: 600,
                  color: 'var(--color-textPrimary)',
                }}
              >
                {feature.title}
              </h3>
              <p
                style={{
                  fontSize: 'var(--font-sm)',
                  color: 'var(--color-textSecondary)',
                  lineHeight: 1.6,
                }}
              >
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* For Foodies */}
      <section
        style={{
          background: 'var(--color-bgSecondary)',
          borderTop: '1px solid var(--color-border)',
          padding: 'var(--space-12) var(--space-6)',
        }}
      >
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <h2
            style={{
              fontSize: 'var(--font-2xl)',
              fontWeight: 700,
              marginBottom: 'var(--space-3)',
            }}
          >
            Follow your favorite food creators? This is for you.
          </h2>
          <p
            style={{
              color: 'var(--color-textSecondary)',
              fontSize: 'var(--font-base)',
              marginBottom: 'var(--space-8)',
              maxWidth: 500,
              margin: '0 auto var(--space-8)',
              lineHeight: 1.7,
            }}
          >
            Discover curated restaurant picks, save your favorites, and unlock exclusive deals
            &mdash; all powered by the creators you trust.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 'var(--space-5)',
              marginBottom: 'var(--space-8)',
            }}
          >
            {[
              { icon: '\u{1F50D}', title: 'Discover', desc: 'Browse curated restaurants with filters for cuisine, vibe, and neighborhood' },
              { icon: '\u{2B50}', title: 'Deals', desc: 'Exclusive discounts and offers from partner restaurants' },
              { icon: '\u{1F516}', title: 'Save Lists', desc: 'Organize your favorites by occasion &mdash; date night, brunch, group dinners' },
            ].map((item) => (
              <div
                key={item.title}
                className="card"
                style={{ padding: 'var(--space-5)', textAlign: 'left' }}
              >
                <span style={{ fontSize: 'var(--font-2xl)' }}>{item.icon}</span>
                <h3
                  style={{
                    fontSize: 'var(--font-base)',
                    fontWeight: 600,
                    color: 'var(--color-textPrimary)',
                    margin: 'var(--space-3) 0 var(--space-2)',
                  }}
                >
                  {item.title}
                </h3>
                <p
                  style={{
                    fontSize: 'var(--font-sm)',
                    color: 'var(--color-textSecondary)',
                    lineHeight: 1.6,
                  }}
                  dangerouslySetInnerHTML={{ __html: item.desc }}
                />
              </div>
            ))}
          </div>

          <Link
            to="/app/discover"
            className="btn btn-primary"
            style={{ padding: '14px 36px', fontSize: 'var(--font-base)' }}
          >
            Explore Restaurants
          </Link>
        </div>
      </section>

      {/* Pricing */}
      <section
        id="pricing"
        style={{
          background: 'var(--color-bgSecondary)',
          borderTop: '1px solid var(--color-border)',
          padding: 'var(--space-12) var(--space-6)',
        }}
      >
        <h2
          style={{
            fontSize: 'var(--font-2xl)',
            fontWeight: 700,
            textAlign: 'center',
            marginBottom: 'var(--space-3)',
          }}
        >
          Simple, transparent pricing
        </h2>
        <p
          style={{
            textAlign: 'center',
            color: 'var(--color-textSecondary)',
            fontSize: 'var(--font-base)',
            marginBottom: 'var(--space-10)',
          }}
        >
          Start free with the demo. Upgrade when you&rsquo;re ready.
        </p>

        <div
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'var(--space-6)',
          }}
        >
          {pricingTiers.map((tier) => (
            <div
              key={tier.name}
              className="card"
              style={{
                padding: 'var(--space-8)',
                border: tier.highlighted
                  ? '2px solid var(--color-accent)'
                  : '1px solid var(--color-border)',
                position: 'relative',
              }}
            >
              {tier.highlighted && (
                <span
                  className="badge badge--accent"
                  style={{
                    position: 'absolute',
                    top: '-10px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                  }}
                >
                  Recommended
                </span>
              )}
              <h3
                style={{
                  fontSize: 'var(--font-xl)',
                  fontWeight: 700,
                  marginBottom: 'var(--space-2)',
                }}
              >
                {tier.name}
              </h3>
              <div style={{ marginBottom: 'var(--space-3)' }}>
                <span
                  style={{
                    fontSize: 'var(--font-3xl)',
                    fontWeight: 700,
                    color: 'var(--color-accent)',
                  }}
                >
                  {tier.price}
                </span>
                <span
                  style={{
                    fontSize: 'var(--font-sm)',
                    color: 'var(--color-textMuted)',
                  }}
                >
                  /mo
                </span>
              </div>
              <p
                style={{
                  fontSize: 'var(--font-sm)',
                  color: 'var(--color-textSecondary)',
                  marginBottom: 'var(--space-6)',
                }}
              >
                {tier.description}
              </p>
              <ul
                style={{
                  listStyle: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-3)',
                  marginBottom: 'var(--space-6)',
                }}
              >
                {tier.features.map((f) => (
                  <li
                    key={f}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      fontSize: 'var(--font-sm)',
                      color: 'var(--color-textSecondary)',
                    }}
                  >
                    <span style={{ color: 'var(--color-success)' }}>&#x2713;</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/app/dashboard"
                className={`btn ${tier.highlighted ? 'btn-primary' : 'btn-secondary'}`}
                style={{ width: '100%', textAlign: 'center', display: 'block' }}
              >
                Try Creator Demo
              </Link>
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
