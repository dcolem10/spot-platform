import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Legal.css';

const EFFECTIVE_DATE = 'March 6, 2026';
const LAST_UPDATED = 'March 6, 2026';
const CONTACT_EMAIL = 'privacy@spotplatform.io';

// Set to false once attorney has reviewed and signed off
const PENDING_LEGAL_REVIEW = true;

const TOC_SECTIONS = [
  { id: 'who-we-are', label: '1. Who We Are' },
  { id: 'information-we-collect', label: '2. Information We Collect' },
  { id: 'how-we-use', label: '3. How We Use Your Information' },
  { id: 'how-we-share', label: '4. How We Share Your Information' },
  { id: 'ai-features', label: '5. AI-Powered Features' },
  { id: 'data-retention', label: '6. Data Retention' },
  { id: 'your-rights', label: '7. Your Rights' },
  { id: 'security', label: '8. Security' },
  { id: 'cookies', label: '9. Cookies' },
  { id: 'childrens-privacy', label: "10. Children's Privacy" },
  { id: 'changes', label: '11. Changes to This Policy' },
  { id: 'contact', label: '12. Contact Us' },
];

export default function PrivacyPolicy() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="legal-page">
      <header className="legal-header">
        <Link to="/" className="legal-header-logo">Spot</Link>
        <Link to="/terms" className="legal-header-link">Terms of Service &rarr;</Link>
      </header>

      {PENDING_LEGAL_REVIEW && (
        <div className="legal-review-notice">
          <strong>Notice:</strong>&nbsp;This Privacy Policy is pending attorney review and has not yet been finalized for legal compliance. Do not rely on this document until attorney sign-off is confirmed.
        </div>
      )}

      <main className="legal-main">
        <h1 className="legal-title">Privacy Policy</h1>
        <p className="legal-meta">
          Effective: {EFFECTIVE_DATE} &middot; Last updated: {LAST_UPDATED}
        </p>

        <nav className="legal-toc" aria-label="Table of contents">
          <div className="legal-toc-title">Contents</div>
          <ul className="legal-toc-list">
            {TOC_SECTIONS.map(({ id, label }) => (
              <li key={id}>
                <a href={`#${id}`}>{label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <Section id="who-we-are" title="1. Who We Are">
          <P>
            Spot Platform ("Spot," "we," "us," or "our") is a two-sided marketplace that connects food content
            creators with restaurants for paid partnerships — tracking attribution from content to customer visit.
            This Privacy Policy explains how we collect, use, share, and protect your information when you
            use our website, application, and services (collectively, the "Service").
          </P>
          <P>
            If you have questions about this policy, contact us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </P>
        </Section>

        <Section id="information-we-collect" title="2. Information We Collect">
          <SubSection title="2.1 Information You Provide">
            <P>When you create an account or use our Service, you may provide:</P>
            <BulletList items={[
              'Account information: name, email address, and password (managed through AWS Cognito)',
              'Creator profile: display name, bio, creator type, city, preferred neighborhoods, and cuisine preferences',
              'Social media handles: Instagram, TikTok, YouTube, and personal website URLs',
              'Follower count range (self-reported)',
              'Restaurant partner information: restaurant name, address, phone number, cuisine types, and neighborhood',
              'Offer details: discount types, descriptions, and expiration dates',
              'Campaign data: restaurant campaigns, content deliverables, deal details, and notes',
            ]} />
          </SubSection>

          <SubSection title="2.2 Information Collected Automatically">
            <P>When you use the Service, we automatically collect:</P>
            <BulletList items={[
              'Device and browser information: IP address, browser type, and operating system (used for rate limiting and security)',
              'Usage data: pages visited, features used, and actions taken within the Service',
              'Authentication tokens: session data necessary to keep you signed in (managed by AWS Cognito)',
            ]} />
          </SubSection>

          <SubSection title="2.3 Information from Third Parties">
            <P>We may receive information from:</P>
            <BulletList items={[
              'Stripe: payment status, subscription details, and billing period (we never receive or store your credit card number)',
              'Google Places API: restaurant details, ratings, and location data when you search for restaurants',
            ]} />
          </SubSection>

          <SubSection title="2.4 QR Code and Offer Tracking">
            <P>
              When your audience scans a QR code or redeems an offer, we collect the scan event, the
              associated offer code, a hashed version of the scanner's IP address (for deduplication), and
              the date. We do not collect personal information about the people who scan your codes beyond
              what is necessary to count unique redemptions.
            </P>
          </SubSection>
        </Section>

        <Section id="how-we-use" title="3. How We Use Your Information">
          <P>We use the information we collect to:</P>
          <BulletList items={[
            'Provide the Service: create your profile, display restaurants, manage campaigns, and track attribution',
            'Generate analytics: calculate campaign performance, engagement rates, and attribution reports',
            "Power AI features: provide content insights and recommendations (your data is sent to Anthropic's Claude API for analysis; see Section 5)",
            'Process payments: manage your subscription through Stripe',
            'Communicate with you: send transactional emails about your account, campaigns, and offers (via Amazon SES)',
            'Improve the Service: understand usage patterns and fix issues',
            'Enforce security: rate limiting, fraud prevention, and abuse detection',
          ]} />
        </Section>

        <Section id="how-we-share" title="4. How We Share Your Information">
          <P>We do not sell your personal information. We share information only in these circumstances:</P>

          <SubSection title="4.1 Service Providers">
            <P>We use the following third-party services to operate Spot:</P>
            <BulletList items={[
              "Amazon Web Services (AWS): cloud infrastructure, database (DynamoDB), authentication (Cognito), email (SES), and hosting (Amplify). Data is stored in the us-east-1 (N. Virginia) region.",
              "Stripe: payment processing. Stripe receives your email and subscription selection. Stripe's privacy policy governs their handling of payment data.",
              'Anthropic (Claude API): AI-powered insights. Campaign and content data may be sent for analysis. Anthropic\'s usage policy governs their data handling.',
              'Google Places API: restaurant search and details. Search queries are sent to Google.',
            ]} />
          </SubSection>

          <SubSection title="4.2 Restaurant Partners">
            <P>
              If you are a creator with an active campaign, the restaurant partner can see campaign
              performance metrics (reach, impressions, QR scans, redemptions) but not your personal
              account details, social media analytics, or financial information.
            </P>
          </SubSection>

          <SubSection title="4.3 Legal Requirements">
            <P>
              We may disclose your information if required by law, regulation, legal process, or
              government request, or if we believe disclosure is necessary to protect the rights,
              property, or safety of Spot, our users, or the public.
            </P>
          </SubSection>
        </Section>

        <Section id="ai-features" title="5. AI-Powered Features">
          <P>
            Spot uses Anthropic's Claude API to provide content insights, campaign recommendations, and
            performance analysis. When you use AI features, relevant data (such as campaign metrics,
            content performance, and restaurant information) is sent to Anthropic for processing.
          </P>
          <P>
            Anthropic does not use your data to train their models. AI-generated insights are
            informational and should not be relied upon as financial, legal, or business advice.
          </P>
        </Section>

        <Section id="data-retention" title="6. Data Retention">
          <P>We retain your information for as long as your account is active. Specific retention periods:</P>
          <BulletList items={[
            'Account and profile data: retained until you delete your account',
            'Campaign and analytics data: retained for the duration of your account plus 90 days',
            'QR scan and redemption logs: retained for 30 days (automatically deleted via TTL)',
            'Rate limiting records: retained for 24 hours (automatically deleted via TTL)',
            'Stripe webhook events: retained for 30 days for audit purposes',
            'AI query cache: retained for 1 hour',
          ]} />
          <P>
            After account deletion, we will remove your personal data within 30 days. Anonymized,
            aggregated analytics may be retained indefinitely.
          </P>
        </Section>

        <Section id="your-rights" title="7. Your Rights">
          <SubSection title="7.1 All Users">
            <P>You have the right to:</P>
            <BulletList items={[
              'Access: request a copy of the personal data we hold about you',
              'Correction: update or correct inaccurate information through your account settings',
              'Deletion: request deletion of your account and associated data',
              'Portability: request your data in a machine-readable format',
            ]} />
            <P>
              To exercise these rights, contact us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
              We will respond within 30 days.
            </P>
          </SubSection>

          <SubSection title="7.2 California Residents (CCPA)">
            <P>
              Under the California Consumer Privacy Act, you have additional rights including the right to
              know what personal information is collected, the right to delete, and the right to
              opt-out of the sale of personal information. We do not sell personal information. To submit
              a CCPA request, contact us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </P>
          </SubSection>

          <SubSection title="7.3 European Residents (GDPR)">
            <P>
              If you are located in the European Economic Area, you have additional rights under the
              General Data Protection Regulation, including the right to object to processing and the
              right to lodge a complaint with a supervisory authority. Our legal basis for processing
              is contract performance (providing the Service) and legitimate interest (security and
              improvement). To submit a GDPR request or inquire about a Data Processing Agreement,
              contact us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </P>
          </SubSection>

          <SubSection title="7.4 Do Not Track">
            <P>
              Our Service does not currently respond to "Do Not Track" signals from browsers. We will
              update this section when industry standards for DNT are established.
            </P>
          </SubSection>
        </Section>

        <Section id="security" title="8. Security">
          <P>
            We implement industry-standard security measures to protect your data, including:
            encryption in transit (HTTPS/TLS), authentication via AWS Cognito with secure token handling,
            IAM least-privilege access controls, rate limiting on all public endpoints, and security
            headers (Content Security Policy, HSTS, X-Frame-Options). No method of transmission or
            storage is 100% secure, but we take reasonable measures to protect your information.
          </P>
        </Section>

        <Section id="cookies" title="9. Cookies">
          <P>
            Spot uses strictly necessary cookies for authentication session management (AWS Cognito).
            We do not use advertising cookies or third-party tracking cookies. By using the Service, you
            consent to the use of these essential cookies required for the Service to function.
          </P>
          <P>
            See our cookie consent notice for additional controls over non-essential cookies.
          </P>
        </Section>

        <Section id="childrens-privacy" title="10. Children's Privacy">
          <P>
            Spot is not intended for users under the age of 13. We do not knowingly collect personal
            information from children under 13. If you believe we have collected such information,
            please contact us and we will promptly delete it.
          </P>
        </Section>

        <Section id="changes" title="11. Changes to This Policy">
          <P>
            We may update this Privacy Policy from time to time. We will notify you of material changes
            by posting the updated policy on this page and updating the "Last updated" date. For
            significant changes, we will also notify you by email. Your continued use of the Service
            after changes constitutes acceptance of the updated policy.
          </P>
        </Section>

        <Section id="contact" title="12. Contact Us">
          <P>
            For questions, concerns, or data requests related to this Privacy Policy, contact us at:
          </P>
          <P>
            Spot Platform<br />
            Email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </P>
        </Section>

        <div className="legal-footer-nav">
          <Link to="/">&larr; Back to Spot</Link>
          <Link to="/terms">Terms of Service &rarr;</Link>
        </div>
      </main>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="legal-section">
      <h2 className="legal-section-title">{title}</h2>
      {children}
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="legal-subsection">
      <h3 className="legal-subsection-title">{title}</h3>
      {children}
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="legal-p">{children}</p>;
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="legal-list">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}
