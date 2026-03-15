import { Link } from 'react-router-dom';

const EFFECTIVE_DATE = 'March 6, 2026';
const LAST_UPDATED = 'March 6, 2026';
const CONTACT_EMAIL = 'legal@spotplatform.io';

export default function TermsOfService() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bgSurface)' }}>
      {/* Header bar */}
      <header style={{
        padding: 'var(--space-4) var(--space-6)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'var(--color-bgPrimary)',
      }}>
        <Link to="/" style={{ textDecoration: 'none', fontWeight: 700, fontSize: 'var(--font-xl)', color: 'var(--color-accent)' }}>
          Spot
        </Link>
        <Link to="/privacy" style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textSecondary)', textDecoration: 'none' }}>
          Privacy Policy &rarr;
        </Link>
      </header>

      <main style={{ maxWidth: '760px', margin: '0 auto', padding: 'var(--space-8) var(--space-6)' }}>
        <h1 style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--color-textPrimary)', marginBottom: 'var(--space-2)' }}>
          Terms of Service
        </h1>
        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textMuted)', marginBottom: 'var(--space-8)' }}>
          Effective: {EFFECTIVE_DATE} &middot; Last updated: {LAST_UPDATED}
        </p>

        <Section title="1. Acceptance of Terms">
          <P>
            By accessing or using Spot Platform ("Spot," "we," "us," or "our"), including our website,
            application, and related services (collectively, the "Service"), you agree to be bound by
            these Terms of Service ("Terms"). If you do not agree, do not use the Service.
          </P>
          <P>
            By creating an account, you confirm that you are at least 18 years of age and have the legal
            capacity to enter into these Terms. If you are using the Service on behalf of a business or
            organization, you represent that you have the authority to bind that entity to these Terms.
          </P>
        </Section>

        <Section title="2. Description of the Service">
          <P>
            Spot is a two-sided marketplace connecting food content creators with restaurants for paid
            partnerships. The Service enables food content creators ("Creators") to earn income by creating
            content for restaurants, with attribution tracking (QR codes, promo codes, POS integration) that
            proves how many customers their content drives. Restaurant operators ("Partners") can use the
            Service to find creators, manage partnerships, and see measurable ROI on their marketing spend.
          </P>
          <P>
            The Service includes AI-powered features (content insights, campaign recommendations) that
            are provided for informational purposes only and should not be relied upon as financial,
            legal, or business advice.
          </P>
        </Section>

        <Section title="3. Accounts">
          <SubSection title="3.1 Registration">
            <P>
              To access certain features, you must create an account by providing accurate and complete
              information. You are responsible for maintaining the confidentiality of your account
              credentials and for all activity under your account. Notify us immediately at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--color-accent)' }}>{CONTACT_EMAIL}</a>{' '}
              if you suspect unauthorized access.
            </P>
          </SubSection>

          <SubSection title="3.2 Demo Mode">
            <P>
              The Service may offer a demo mode that allows you to explore features with synthetic data
              without creating an account. Demo mode data is not stored and does not create a binding
              relationship. Features and data in demo mode may not reflect the full production experience.
            </P>
          </SubSection>
        </Section>

        <Section title="4. Subscriptions and Payments">
          <SubSection title="4.1 Plans">
            <P>
              Spot offers subscription plans with different feature sets and usage limits. Current plans,
              pricing, and included features are displayed on our pricing page. We reserve the right to
              change pricing with 30 days' notice to existing subscribers.
            </P>
          </SubSection>

          <SubSection title="4.2 Billing">
            <P>
              Subscriptions are billed monthly in advance through Stripe, our payment processor. By
              subscribing, you authorize us to charge your selected payment method on a recurring basis.
              All fees are stated in US dollars and are non-refundable except as required by law.
            </P>
          </SubSection>

          <SubSection title="4.3 Cancellation">
            <P>
              You may cancel your subscription at any time through your account settings or the Stripe
              customer portal. Cancellation takes effect at the end of the current billing period. You
              will retain access to paid features until the end of the period you have already paid for.
            </P>
          </SubSection>

          <SubSection title="4.4 Free Tier">
            <P>
              Certain features may be available without a paid subscription. We reserve the right to
              modify, limit, or discontinue free features at any time.
            </P>
          </SubSection>
        </Section>

        <Section title="5. Content and Intellectual Property">
          <SubSection title="5.1 Your Content">
            <P>
              You retain ownership of all content you upload, create, or share through the Service
              ("Your Content"), including profile information, campaign details, and creative materials.
              By using the Service, you grant Spot a non-exclusive, worldwide, royalty-free license to
              use, display, and process Your Content solely for the purpose of providing the Service.
            </P>
          </SubSection>

          <SubSection title="5.2 Our Content">
            <P>
              The Service, including its design, features, analytics methodology, algorithms, and
              documentation, is owned by Spot and protected by copyright, trademark, and other
              intellectual property laws. You may not copy, modify, distribute, reverse engineer, or
              create derivative works from our Service or its underlying technology.
            </P>
          </SubSection>

          <SubSection title="5.3 Feedback">
            <P>
              If you provide feedback, suggestions, or ideas about the Service, you grant Spot an
              unrestricted, irrevocable, worldwide, royalty-free license to use that feedback for any
              purpose without obligation to you.
            </P>
          </SubSection>
        </Section>

        <Section title="6. Attribution and Analytics">
          <SubSection title="6.1 No Guarantee of Accuracy">
            <P>
              Spot provides restaurant visit attribution and performance analytics on a best-effort basis.
              Attribution data (QR scans, offer redemptions, estimated visits) is approximate and should
              not be treated as exact measurements. We do not guarantee that attribution data will be
              complete, accurate, or reflect actual restaurant visits. Spot is not responsible for
              business decisions made based on attribution data.
            </P>
          </SubSection>

          <SubSection title="6.2 Offer Tracking">
            <P>
              QR codes and offer links distributed through the Service track scan events and redemptions.
              You are responsible for the terms and conditions of any offers you create and distribute.
              Spot is not a party to transactions between Creators, Partners, and their audiences.
            </P>
          </SubSection>
        </Section>

        <Section title="7. Acceptable Use">
          <P>You agree not to:</P>
          <BulletList items={[
            'Use the Service for any unlawful purpose or in violation of applicable laws',
            'Provide false or misleading information in your profile, campaigns, or offers',
            'Attempt to access accounts, data, or features you are not authorized to use',
            'Circumvent rate limits, security measures, or access controls',
            'Scrape, harvest, or systematically collect data from the Service',
            'Use the Service to transmit spam, malware, or harmful content',
            'Interfere with or disrupt the Service or its infrastructure',
            'Create fraudulent offers, inflated metrics, or fake redemptions',
            'Resell, sublicense, or redistribute the Service without our written consent',
            'Attempt to reverse engineer, decompile, or extract source code from the Service',
          ]} />
        </Section>

        <Section title="8. Confidentiality">
          <SubSection title="8.1 Campaign Data">
            <P>
              Campaign performance data, partnership terms, and financial details shared between
              Creators and Partners through the Service are confidential. Neither party may publicly
              disclose the other party's campaign data, deal terms, or attribution metrics without prior
              written consent.
            </P>
          </SubSection>

          <SubSection title="8.2 Platform Data">
            <P>
              Aggregated, anonymized platform statistics may be used by Spot for marketing and
              informational purposes (e.g., "Spot creators have driven 50,000 restaurant visits").
              Individual user data will not be identified in such disclosures.
            </P>
          </SubSection>
        </Section>

        <Section title="9. Third-Party Services">
          <P>
            The Service integrates with third-party services including Stripe (payments), AWS
            (infrastructure), Anthropic (AI), and Google (restaurant data). Your use of these
            integrations is subject to their respective terms and privacy policies. Spot is not
            responsible for the availability, accuracy, or conduct of third-party services.
          </P>
        </Section>

        <Section title="10. Termination">
          <SubSection title="10.1 By You">
            <P>
              You may terminate your account at any time by contacting us or using the account deletion
              feature (when available). Upon termination, your access to the Service will cease and your
              data will be deleted in accordance with our{' '}
              <Link to="/privacy" style={{ color: 'var(--color-accent)' }}>Privacy Policy</Link>.
            </P>
          </SubSection>

          <SubSection title="10.2 By Us">
            <P>
              We may suspend or terminate your account if you violate these Terms, engage in activity
              harmful to the Service or other users, or if we are required to do so by law. We will
              provide reasonable notice when possible. In case of material breach, we may terminate
              immediately.
            </P>
          </SubSection>
        </Section>

        <Section title="11. Disclaimers">
          <P>
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS
            OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR
            A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. SPOT DOES NOT WARRANT THAT THE SERVICE WILL BE
            UNINTERRUPTED, ERROR-FREE, OR SECURE, OR THAT ANY DEFECTS WILL BE CORRECTED.
          </P>
          <P>
            AI-POWERED FEATURES ARE PROVIDED FOR INFORMATIONAL PURPOSES ONLY. SPOT DOES NOT GUARANTEE
            THE ACCURACY, COMPLETENESS, OR USEFULNESS OF AI-GENERATED INSIGHTS AND RECOMMENDATIONS.
          </P>
        </Section>

        <Section title="12. Limitation of Liability">
          <P>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, SPOT AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND
            AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
            DAMAGES, OR ANY LOSS OF PROFITS, DATA, USE, OR GOODWILL, ARISING OUT OF OR IN CONNECTION
            WITH THE SERVICE, WHETHER BASED ON WARRANTY, CONTRACT, TORT, OR ANY OTHER LEGAL THEORY,
            EVEN IF SPOT HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
          </P>
          <P>
            SPOT'S TOTAL AGGREGATE LIABILITY FOR ANY CLAIMS ARISING OUT OF OR RELATING TO THESE TERMS
            OR THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID TO SPOT IN THE TWELVE (12) MONTHS
            PRECEDING THE CLAIM.
          </P>
        </Section>

        <Section title="13. Indemnification">
          <P>
            You agree to indemnify, defend, and hold harmless Spot and its officers, directors,
            employees, and agents from any claims, losses, damages, liabilities, and expenses
            (including reasonable attorney fees) arising from your use of the Service, violation of
            these Terms, or infringement of any third-party rights.
          </P>
        </Section>

        <Section title="14. Dispute Resolution">
          <P>
            Any disputes arising out of or relating to these Terms or the Service shall be resolved
            through binding arbitration in Washington, D.C., under the rules of the American Arbitration
            Association. You and Spot agree to waive the right to a jury trial and to participate in
            class actions. This arbitration clause does not prevent either party from seeking injunctive
            relief in a court of competent jurisdiction.
          </P>
        </Section>

        <Section title="15. Governing Law">
          <P>
            These Terms are governed by and construed in accordance with the laws of the District of
            Columbia, United States, without regard to conflict of law principles.
          </P>
        </Section>

        <Section title="16. Modifications">
          <P>
            We may update these Terms from time to time. Material changes will be communicated through
            the Service or by email at least 30 days before taking effect. Your continued use of the
            Service after changes constitutes acceptance of the updated Terms. If you disagree with
            the changes, you should discontinue use and cancel your account.
          </P>
        </Section>

        <Section title="17. General">
          <P>
            If any provision of these Terms is found to be unenforceable, the remaining provisions will
            continue in effect. Our failure to enforce any right or provision does not constitute a
            waiver. These Terms, together with our{' '}
            <Link to="/privacy" style={{ color: 'var(--color-accent)' }}>Privacy Policy</Link>,
            constitute the entire agreement between you and Spot regarding the Service.
          </P>
        </Section>

        <Section title="18. Contact">
          <P>
            For questions about these Terms, contact us at:
          </P>
          <P>
            Spot Platform<br />
            Email: <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--color-accent)' }}>{CONTACT_EMAIL}</a>
          </P>
        </Section>

        {/* Footer nav */}
        <div style={{
          marginTop: 'var(--space-8)',
          paddingTop: 'var(--space-6)',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 'var(--font-sm)',
          color: 'var(--color-textMuted)',
        }}>
          <Link to="/" style={{ color: 'var(--color-accent)', textDecoration: 'none' }}>&larr; Back to Spot</Link>
          <Link to="/privacy" style={{ color: 'var(--color-accent)', textDecoration: 'none' }}>Privacy Policy &rarr;</Link>
        </div>
      </main>
    </div>
  );
}

/* ─── Reusable sub-components ─────────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 'var(--space-8)' }}>
      <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, color: 'var(--color-textPrimary)', marginBottom: 'var(--space-3)' }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 'var(--space-4)', marginLeft: 'var(--space-2)' }}>
      <h3 style={{ fontSize: 'var(--font-base)', fontWeight: 600, color: 'var(--color-textPrimary)', marginBottom: 'var(--space-2)' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 'var(--font-sm)', lineHeight: 1.7, color: 'var(--color-textSecondary)', marginBottom: 'var(--space-3)' }}>
      {children}
    </p>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul style={{ paddingLeft: 'var(--space-6)', marginBottom: 'var(--space-3)' }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: 'var(--font-sm)', lineHeight: 1.7, color: 'var(--color-textSecondary)', marginBottom: 'var(--space-1)' }}>
          {item}
        </li>
      ))}
    </ul>
  );
}
