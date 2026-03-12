import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../services/ApiService';
import type { Raffle } from '../../types';

/* ─── Demo Data (matches RaffleManager demo) ──────────────────────────────── */

function demoISO(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString();
}

const DEMO_RAFFLES: Record<string, Raffle> = {
  'raffle-demo-1': {
    raffleId: 'raffle-demo-1',
    creatorId: 'creator-demo',
    creatorName: 'Demo Creator',
    restaurantId: 'r1',
    restaurantName: 'Rasika',
    title: 'Win a 3-Course Dinner at Rasika',
    description: "Watch my feature on Rasika's legendary lamb dishes and enter for a chance to win!",
    prizeDescription: '3-course tasting menu + wine pairing for two ($200 value)',
    videoUrl: 'https://instagram.com/p/demo-rasika',
    startsAt: demoISO(-3),
    endsAt: demoISO(4),
    status: 'active',
    entryCount: 127,
    maxEntries: 10000,
    platformFee: 50,
    creatorRevenue: 18,
    winner: null,
    createdAt: demoISO(-3),
    updatedAt: demoISO(-1),
  },
  'raffle-demo-2': {
    raffleId: 'raffle-demo-2',
    creatorId: 'creator-demo',
    creatorName: 'Demo Creator',
    restaurantId: 'r12',
    restaurantName: 'Le Diplomate',
    title: 'Brunch for Two at Le Diplomate',
    description: 'Tag a friend who loves French brunch! Entry includes both of you.',
    prizeDescription: 'Brunch for two with bottomless mimosas ($150 value)',
    videoUrl: 'https://tiktok.com/@demo/video/1234',
    startsAt: demoISO(2),
    endsAt: demoISO(9),
    status: 'draft',
    entryCount: 0,
    maxEntries: 5000,
    platformFee: 50,
    creatorRevenue: 18,
    winner: null,
    createdAt: demoISO(-1),
    updatedAt: demoISO(-1),
  },
  'raffle-demo-3': {
    raffleId: 'raffle-demo-3',
    creatorId: 'creator-demo',
    creatorName: 'Demo Creator',
    restaurantId: 'r6',
    restaurantName: "Rose's Luxury",
    title: "Chef's Table Experience at Rose's Luxury",
    description: "Exclusive 7-course chef's table experience. One lucky winner!",
    prizeDescription: "7-course chef's table for two ($400 value)",
    videoUrl: 'https://instagram.com/p/demo-roses',
    startsAt: demoISO(-14),
    endsAt: demoISO(-2),
    status: 'drawn',
    entryCount: 843,
    maxEntries: 10000,
    platformFee: 75,
    creatorRevenue: 20,
    winner: { email: 'sarah.k@example.com', name: 'Sarah Kim', claimCode: 'SPOT-A3F2', drawnAt: demoISO(-2) },
    createdAt: demoISO(-14),
    updatedAt: demoISO(-2),
  },
};

function isDemoRaffle(id: string): boolean {
  return id.startsWith('raffle-demo');
}

/* ─── Countdown Hook ──────────────────────────────────────────────────────── */

function useCountdown(endsAt: string | undefined) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  if (!endsAt) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };

  const diff = new Date(endsAt).getTime() - now;
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    expired: false,
  };
}

/* ─── Confetti Effect ─────────────────────────────────────────────────────── */

function ConfettiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#ff6b35', '#ffd23f', '#10b981', '#6366f1', '#f472b6', '#38bdf8'];
    const pieces: { x: number; y: number; w: number; h: number; color: string; vx: number; vy: number; rot: number; vr: number; opacity: number }[] = [];

    for (let i = 0; i < 80; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 200,
        w: 6 + Math.random() * 8,
        h: 4 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4,
        vy: 2 + Math.random() * 3,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.2,
        opacity: 1,
      });
    }

    let frame: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of pieces) {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.vy += 0.05;
        if (p.y > canvas.height) p.opacity -= 0.02;
        if (p.opacity <= 0) continue;
        alive = true;
        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (alive) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 100 }}
    />
  );
}

/* ─── Main Component ──────────────────────────────────────────────────────── */

export default function RaffleEntryPage() {
  const { id } = useParams<{ id: string }>();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [social, setSocial] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  /* Fetch raffle */
  const raffleQuery = useQuery({
    queryKey: ['raffle-public', id],
    queryFn: async (): Promise<Raffle | null> => {
      if (!id) return null;
      if (isDemoRaffle(id)) return DEMO_RAFFLES[id] ?? null;
      const res = await api.get(`/api/raffles/${id}`);
      if (res.status !== 'success' || !res.data) return null;
      return res.data as Raffle;
    },
    enabled: !!id,
  });

  const raffle = raffleQuery.data;
  const countdown = useCountdown(raffle?.endsAt);

  /* Entry mutation */
  const entryMutation = useMutation({
    mutationFn: async () => {
      if (!id || !raffle) throw new Error('No raffle');

      // Demo mode: simulate success
      if (isDemoRaffle(id)) {
        await new Promise(resolve => setTimeout(resolve, 800));
        return { entryId: 'demo-entry-new', position: (raffle.entryCount || 0) + 1 };
      }

      const res = await api.post(`/api/raffles/${id}/enter`, {
        name: name.trim(),
        email: email.trim(),
        socialHandle: social.trim() || undefined,
      });

      if (res.status !== 'success') {
        throw new Error(res.error || 'Failed to enter raffle');
      }
      return res.data;
    },
    onSuccess: () => {
      setSubmitted(true);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4000);
    },
    onError: (err: Error) => {
      if (err.message.includes('already entered')) {
        setEntryError('You have already entered this raffle!');
      } else if (err.message.includes('full') || err.message.includes('max')) {
        setEntryError('This raffle has reached maximum entries.');
      } else {
        setEntryError(err.message);
      }
    },
  });

  const canSubmit = name.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isActive = raffle?.status === 'active' && !countdown.expired;
  const isEnded = raffle?.status === 'closed' || raffle?.status === 'drawn' || countdown.expired;
  const isFull = raffle ? raffle.entryCount >= raffle.maxEntries : false;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEntryError(null);
    entryMutation.mutate();
  };

  /* ─── Loading ─── */
  if (raffleQuery.isLoading) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner} />
          <div style={{ color: 'rgba(255,255,255,0.6)', marginTop: 16 }}>Loading raffle...</div>
        </div>
      </div>
    );
  }

  /* ─── Not Found ─── */
  if (!raffle) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎟️</div>
            <h1 style={{ color: '#fff', fontSize: 24, marginBottom: 8 }}>Raffle Not Found</h1>
            <p style={{ color: 'rgba(255,255,255,0.6)' }}>
              This raffle may have ended or the link is incorrect.
            </p>
            <Link to="/" style={{ color: 'var(--color-accent, #ff6b35)', textDecoration: 'none', marginTop: 24, display: 'inline-block' }}>
              Explore Spot &rarr;
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Success State ─── */
  if (submitted) {
    return (
      <div style={styles.page}>
        {showConfetti && <ConfettiCanvas />}
        <div style={styles.container}>
          <div style={styles.successCard}>
            <div style={{ fontSize: 56, marginBottom: 16, animation: 'successBounce 0.6s ease-out' }}>🎉</div>
            <h1 style={styles.successTitle}>You're In!</h1>
            <p style={styles.successSub}>
              Your entry for <strong>{raffle.title}</strong> has been submitted.
            </p>
            <div style={styles.successDetail}>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Prize</div>
              <div style={{ fontSize: 16, color: '#fff' }}>{raffle.prizeDescription}</div>
            </div>
            <div style={styles.successDetail}>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Restaurant</div>
              <div style={{ fontSize: 16, color: '#fff' }}>{raffle.restaurantName}</div>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 24 }}>
              Winner will be notified by email. Good luck!
            </p>
            <div style={styles.spotFooter}>
              <Link to="/" style={styles.spotLink}>
                Discover more restaurants on Spot &rarr;
              </Link>
            </div>
          </div>
        </div>
        <style>{keyframeStyles}</style>
      </div>
    );
  }

  /* ─── Main Entry Page ─── */
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.creatorBadge}>
            <span style={{ fontSize: 14, opacity: 0.7 }}>by</span>{' '}
            <strong>{raffle.creatorName}</strong>
          </div>
        </div>

        {/* Hero Card */}
        <div style={styles.heroCard}>
          <div style={styles.restaurantTag}>
            🍽️ {raffle.restaurantName}
          </div>

          <h1 style={styles.title}>{raffle.title}</h1>

          <p style={styles.description}>{raffle.description}</p>

          {/* Prize Box */}
          <div style={styles.prizeBox}>
            <div style={styles.prizeLabel}>🎁 Prize</div>
            <div style={styles.prizeValue}>{raffle.prizeDescription}</div>
          </div>

          {/* Countdown */}
          {isActive && (
            <div style={styles.countdownRow}>
              <CountdownUnit value={countdown.days} label="Days" />
              <span style={styles.countdownSep}>:</span>
              <CountdownUnit value={countdown.hours} label="Hrs" />
              <span style={styles.countdownSep}>:</span>
              <CountdownUnit value={countdown.minutes} label="Min" />
              <span style={styles.countdownSep}>:</span>
              <CountdownUnit value={countdown.seconds} label="Sec" />
            </div>
          )}

          {/* Entry count */}
          <div style={styles.entryCountBadge}>
            {raffle.entryCount.toLocaleString()} entries so far
          </div>

          {/* Entry Form or Status */}
          {isActive && !isFull ? (
            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.inputGroup}>
                <label htmlFor="raffle-name" style={styles.label}>Name *</label>
                <input
                  id="raffle-name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                  maxLength={100}
                  style={styles.input}
                  required
                  autoComplete="name"
                />
              </div>

              <div style={styles.inputGroup}>
                <label htmlFor="raffle-email" style={styles.label}>Email *</label>
                <input
                  id="raffle-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  maxLength={255}
                  style={styles.input}
                  required
                  autoComplete="email"
                />
              </div>

              <div style={styles.inputGroup}>
                <label htmlFor="raffle-social" style={styles.label}>Social Handle (optional)</label>
                <input
                  id="raffle-social"
                  type="text"
                  value={social}
                  onChange={e => setSocial(e.target.value)}
                  placeholder="@yourusername"
                  maxLength={50}
                  style={styles.input}
                />
              </div>

              {entryError && (
                <div style={styles.errorBox}>{entryError}</div>
              )}

              <button
                type="submit"
                disabled={!canSubmit || entryMutation.isPending}
                style={{
                  ...styles.submitBtn,
                  opacity: !canSubmit || entryMutation.isPending ? 0.5 : 1,
                  cursor: !canSubmit || entryMutation.isPending ? 'not-allowed' : 'pointer',
                }}
              >
                {entryMutation.isPending ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                    <span style={styles.btnSpinner} /> Entering...
                  </span>
                ) : (
                  'Enter Raffle 🎟️'
                )}
              </button>

              <p style={styles.terms}>
                By entering, you agree to Spot's{' '}
                <Link to="/terms" target="_blank" style={{ color: 'var(--color-accent, #ff6b35)' }}>Terms</Link>
                {' '}and{' '}
                <Link to="/privacy" target="_blank" style={{ color: 'var(--color-accent, #ff6b35)' }}>Privacy Policy</Link>.
              </p>
            </form>
          ) : isEnded ? (
            <div style={styles.endedBanner}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>⏰</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#fff' }}>Raffle Has Ended</div>
              {raffle.status === 'drawn' && raffle.winner && (
                <div style={{ marginTop: 12, color: 'rgba(255,255,255,0.7)' }}>
                  Winner: <strong style={{ color: '#10b981' }}>{raffle.winner.name}</strong>
                </div>
              )}
              <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: 8, fontSize: 14 }}>
                {raffle.entryCount.toLocaleString()} people entered
              </p>
            </div>
          ) : isFull ? (
            <div style={styles.endedBanner}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🚫</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#fff' }}>Raffle Is Full</div>
              <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: 8, fontSize: 14 }}>
                Maximum entries ({raffle.maxEntries.toLocaleString()}) reached
              </p>
            </div>
          ) : (
            <div style={styles.endedBanner}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#fff' }}>Raffle Not Yet Open</div>
              <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: 8, fontSize: 14 }}>
                Check back when this raffle goes live
              </p>
            </div>
          )}
        </div>

        {/* Spot Branding Footer */}
        <div style={styles.footerBrand}>
          <div style={styles.poweredBy}>
            Powered by <strong style={{ color: 'var(--color-accent, #ff6b35)' }}>Spot</strong>
          </div>
          <p style={styles.footerTagline}>
            Discover the best restaurants in your city
          </p>
          <Link to="/" style={styles.footerCta}>
            Explore Deals &rarr;
          </Link>
        </div>
      </div>
      <style>{keyframeStyles}</style>
    </div>
  );
}

/* ─── Countdown Unit ──────────────────────────────────────────────────────── */

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div style={styles.countdownUnit}>
      <div style={styles.countdownNumber}>{String(value).padStart(2, '0')}</div>
      <div style={styles.countdownLabel}>{label}</div>
    </div>
  );
}

/* ─── Keyframe Animations ─────────────────────────────────────────────────── */

const keyframeStyles = `
  @keyframes successBounce {
    0% { transform: scale(0); opacity: 0; }
    60% { transform: scale(1.2); }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes pulseGlow {
    0%, 100% { box-shadow: 0 0 20px rgba(255, 107, 53, 0.3); }
    50% { box-shadow: 0 0 40px rgba(255, 107, 53, 0.5); }
  }
`;

/* ─── Styles (inline, dark-first, mobile-first) ───────────────────────────── */

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1025 50%, #0a0a0f 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px 16px 40px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  container: {
    width: '100%',
    maxWidth: 480,
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
  },
  spinner: {
    width: 40,
    height: 40,
    border: '3px solid rgba(255,255,255,0.1)',
    borderTopColor: '#ff6b35',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },

  /* Header */
  header: {
    textAlign: 'center' as const,
    marginBottom: 20,
  },
  creatorBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 16px',
    borderRadius: 20,
    background: 'rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    backdropFilter: 'blur(10px)',
  },

  /* Hero Card */
  heroCard: {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: '28px 24px',
    backdropFilter: 'blur(20px)',
  },
  restaurantTag: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: 12,
    background: 'rgba(255, 107, 53, 0.15)',
    color: '#ff6b35',
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: 700,
    color: '#ffffff',
    lineHeight: 1.2,
    margin: '0 0 12px 0',
  },
  description: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 1.5,
    margin: '0 0 20px 0',
  },

  /* Prize Box */
  prizeBox: {
    background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.12) 0%, rgba(255, 210, 63, 0.08) 100%)',
    border: '1px solid rgba(255, 107, 53, 0.25)',
    borderRadius: 14,
    padding: '16px 20px',
    marginBottom: 24,
  },
  prizeLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 6,
  },
  prizeValue: {
    fontSize: 17,
    fontWeight: 600,
    color: '#fff',
    lineHeight: 1.4,
  },

  /* Countdown */
  countdownRow: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  countdownUnit: {
    textAlign: 'center' as const,
    minWidth: 52,
  },
  countdownNumber: {
    fontSize: 28,
    fontWeight: 700,
    color: '#fff',
    fontVariantNumeric: 'tabular-nums',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: '8px 4px',
    lineHeight: 1,
  },
  countdownLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  countdownSep: {
    fontSize: 24,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: 700,
    paddingBottom: 18,
  },

  /* Entry count */
  entryCountBadge: {
    textAlign: 'center' as const,
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 24,
  },

  /* Form */
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 500,
    color: 'rgba(255,255,255,0.6)',
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    fontSize: 16,
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box' as const,
    WebkitAppearance: 'none' as const,
  },
  errorBox: {
    padding: '10px 14px',
    borderRadius: 10,
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#fca5a5',
    fontSize: 14,
  },
  submitBtn: {
    width: '100%',
    padding: '14px 20px',
    borderRadius: 14,
    border: 'none',
    background: 'linear-gradient(135deg, #ff6b35 0%, #e85d26 100%)',
    color: '#fff',
    fontSize: 17,
    fontWeight: 700,
    letterSpacing: 0.3,
    animation: 'pulseGlow 3s ease-in-out infinite',
    transition: 'transform 0.15s, opacity 0.2s',
  },
  btnSpinner: {
    display: 'inline-block',
    width: 16,
    height: 16,
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  terms: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center' as const,
    lineHeight: 1.5,
  },

  /* Ended / Full */
  endedBanner: {
    textAlign: 'center' as const,
    padding: '32px 20px',
    borderRadius: 14,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
  },

  /* Success */
  successCard: {
    background: 'linear-gradient(180deg, rgba(16,185,129,0.1) 0%, rgba(255,255,255,0.04) 100%)',
    border: '1px solid rgba(16,185,129,0.25)',
    borderRadius: 20,
    padding: '40px 24px',
    textAlign: 'center' as const,
    marginTop: 40,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: '#10b981',
    margin: '0 0 8px 0',
  },
  successSub: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 1.5,
    margin: '0 0 24px 0',
  },
  successDetail: {
    padding: '12px 0',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    textAlign: 'left' as const,
  },
  spotFooter: {
    marginTop: 32,
    paddingTop: 20,
    borderTop: '1px solid rgba(255,255,255,0.08)',
  },
  spotLink: {
    color: 'var(--color-accent, #ff6b35)',
    textDecoration: 'none',
    fontSize: 15,
    fontWeight: 600,
  },

  /* Footer Brand */
  footerBrand: {
    textAlign: 'center' as const,
    marginTop: 32,
    padding: '24px 16px',
  },
  poweredBy: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
  },
  footerTagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.3)',
    margin: '6px 0 16px 0',
  },
  footerCta: {
    display: 'inline-block',
    padding: '10px 24px',
    borderRadius: 10,
    border: '1px solid rgba(255, 107, 53, 0.3)',
    color: '#ff6b35',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 600,
    transition: 'background 0.2s',
  },
};
