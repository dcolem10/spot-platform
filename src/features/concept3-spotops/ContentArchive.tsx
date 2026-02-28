import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ContentItem } from '../../types';
import { api } from '../../services/ApiService';

/* ─── Types ────────────────────────────────────────────────────────────────── */

type PlatformFilter = 'all' | 'instagram' | 'tiktok';
type PerformanceTier = 'all' | 'top10' | 'aboveAvg' | 'belowAvg';

interface DateRange {
  start: string;
  end: string;
}

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

const PLATFORM_ICON: Record<string, string> = {
  instagram: '\u{1F4F8}',
  tiktok: '\u{1F3B5}',
};

const PLATFORM_LABEL: Record<string, string> = {
  instagram: 'IG',
  tiktok: 'TikTok',
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function engagementScore(item: ContentItem): number {
  const m = item.metrics;
  return m.saves * 3 + m.shares * 2 + m.comments + m.likes * 0.5 + m.reach * 0.01;
}

/* ─── Styles ───────────────────────────────────────────────────────────────── */

const styles = {
  controls: {
    display: 'flex',
    gap: 'var(--space-3)',
    alignItems: 'center',
    marginBottom: 'var(--space-6)',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  searchInput: {
    flex: '1 1 260px',
    padding: 'var(--space-3) var(--space-4)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-bgElevated)',
    color: 'var(--color-textPrimary)',
    fontSize: 'var(--font-sm)',
    outline: 'none',
    transition: 'border-color var(--transition-fast)',
    minWidth: 0,
  } as React.CSSProperties,
  select: {
    padding: 'var(--space-3) var(--space-4)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-bgElevated)',
    color: 'var(--color-textPrimary)',
    fontSize: 'var(--font-sm)',
    cursor: 'pointer',
    outline: 'none',
  } as React.CSSProperties,
  dateInput: {
    padding: 'var(--space-2) var(--space-3)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-bgElevated)',
    color: 'var(--color-textPrimary)',
    fontSize: 'var(--font-xs)',
    outline: 'none',
  } as React.CSSProperties,
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 'var(--space-5)',
  } as React.CSSProperties,
  card: {
    background: 'var(--color-bgSecondary)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    transition: 'transform var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast)',
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'block',
    color: 'inherit',
  } as React.CSSProperties,
  thumbnail: {
    width: '100%',
    height: '180px',
    background: 'var(--color-bgElevated)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative' as const,
    overflow: 'hidden',
  } as React.CSSProperties,
  thumbnailIcon: {
    fontSize: 'var(--font-3xl)',
    color: 'var(--color-textMuted)',
    opacity: 0.4,
  } as React.CSSProperties,
  platformBadge: {
    position: 'absolute' as const,
    top: 'var(--space-3)',
    right: 'var(--space-3)',
    padding: 'var(--space-1) var(--space-3)',
    borderRadius: 'var(--radius-full)',
    fontSize: 'var(--font-xs)',
    fontWeight: 600,
    background: 'rgba(0,0,0,0.7)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-1)',
  } as React.CSSProperties,
  tierBadge: {
    position: 'absolute' as const,
    top: 'var(--space-3)',
    left: 'var(--space-3)',
  } as React.CSSProperties,
  cardBody: {
    padding: 'var(--space-4)',
  } as React.CSSProperties,
  cardRestaurant: {
    fontSize: 'var(--font-sm)',
    fontWeight: 600,
    color: 'var(--color-textPrimary)',
    marginBottom: 'var(--space-1)',
  } as React.CSSProperties,
  cardDate: {
    fontSize: 'var(--font-xs)',
    color: 'var(--color-textMuted)',
    marginBottom: 'var(--space-3)',
  } as React.CSSProperties,
  metricsRow: {
    display: 'flex',
    gap: 'var(--space-4)',
  } as React.CSSProperties,
  metric: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
  } as React.CSSProperties,
  metricValue: {
    fontSize: 'var(--font-sm)',
    fontWeight: 700,
    color: 'var(--color-textPrimary)',
  } as React.CSSProperties,
  metricLabel: {
    fontSize: 'var(--font-xs)',
    color: 'var(--color-textMuted)',
  } as React.CSSProperties,
  tags: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 'var(--space-1)',
    marginTop: 'var(--space-3)',
  } as React.CSSProperties,
  tag: {
    padding: '2px var(--space-2)',
    borderRadius: 'var(--radius-full)',
    fontSize: '10px',
    fontWeight: 600,
    background: 'var(--color-bgElevated)',
    color: 'var(--color-textMuted)',
    border: '1px solid var(--color-border)',
  } as React.CSSProperties,
  resultCount: {
    fontSize: 'var(--font-sm)',
    color: 'var(--color-textMuted)',
    marginBottom: 'var(--space-4)',
  } as React.CSSProperties,
  errorBanner: {
    padding: 'var(--space-4)',
    background: 'var(--color-errorMuted)',
    color: 'var(--color-error)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-sm)',
    marginBottom: 'var(--space-6)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as React.CSSProperties,
} as const;

/* ─── Component ────────────────────────────────────────────────────────────── */

export default function ContentArchive() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [performanceTier, setPerformanceTier] = useState<PerformanceTier>('all');
  const [dateRange, setDateRange] = useState<DateRange>({ start: '', end: '' });

  const fetchContent = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api.get<ContentItem[]>('/api/spotops/content');
    if (res.error) {
      setError(res.error);
    }
    if (res.data) {
      setItems(res.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  // Compute score thresholds for performance tiers
  const { avgScore, topThreshold } = useMemo(() => {
    if (items.length === 0) return { avgScore: 0, topThreshold: 0 };
    const scores = items.map(engagementScore).sort((a, b) => b - a);
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
    const top10Index = Math.max(0, Math.floor(scores.length * 0.1) - 1);
    return { avgScore: avg, topThreshold: scores[top10Index] ?? avg };
  }, [items]);

  function getTier(item: ContentItem): 'top10' | 'aboveAvg' | 'belowAvg' {
    const score = engagementScore(item);
    if (score >= topThreshold && topThreshold > 0) return 'top10';
    if (score >= avgScore) return 'aboveAvg';
    return 'belowAvg';
  }

  const TIER_BADGE: Record<string, { cls: string; label: string }> = {
    top10: { cls: 'badge--accent', label: 'Top 10%' },
    aboveAvg: { cls: 'badge--success', label: 'Above Avg' },
    belowAvg: { cls: 'badge--warning', label: 'Below Avg' },
  };

  const filtered = useMemo(() => {
    let result = [...items];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) =>
          (item.restaurantName?.toLowerCase().includes(q)) ||
          item.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Platform
    if (platformFilter !== 'all') {
      result = result.filter((item) => item.platform === platformFilter);
    }

    // Date range
    if (dateRange.start) {
      const startMs = new Date(dateRange.start).getTime();
      result = result.filter((item) => new Date(item.postedAt).getTime() >= startMs);
    }
    if (dateRange.end) {
      const endMs = new Date(dateRange.end).getTime() + 86400000; // end of day
      result = result.filter((item) => new Date(item.postedAt).getTime() < endMs);
    }

    // Performance tier
    if (performanceTier !== 'all') {
      result = result.filter((item) => getTier(item) === performanceTier);
    }

    // Sort by date desc
    result.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());

    return result;
  }, [items, search, platformFilter, performanceTier, dateRange, avgScore, topThreshold]);

  /* ─── Loading ──────────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div className="skeleton" style={{ width: '200px', height: '32px', marginBottom: 'var(--space-3)' }} />
          <div className="skeleton" style={{ width: '240px', height: '18px' }} />
        </div>
        <div className="skeleton" style={{ height: '44px', marginBottom: 'var(--space-6)' }} />
        <div style={styles.grid}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton" style={{ height: '320px', borderRadius: 'var(--radius-lg)' }} />
          ))}
        </div>
      </div>
    );
  }

  /* ─── Render ───────────────────────────────────────────────────────────── */

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Content Archive</h1>
        <p className="page-subtitle">Browse and search all your published content</p>
      </div>

      {/* Error */}
      {error && (
        <div style={styles.errorBanner}>
          <span>{error}</span>
          <button className="btn btn-ghost" onClick={fetchContent}>
            Retry
          </button>
        </div>
      )}

      {/* Controls */}
      <div style={styles.controls}>
        <input
          type="text"
          placeholder="Search by restaurant or tag..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.searchInput}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
        />
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value as PlatformFilter)}
          style={styles.select}
        >
          <option value="all">All Platforms</option>
          <option value="instagram">Instagram</option>
          <option value="tiktok">TikTok</option>
        </select>
        <select
          value={performanceTier}
          onChange={(e) => setPerformanceTier(e.target.value as PerformanceTier)}
          style={styles.select}
        >
          <option value="all">All Performance</option>
          <option value="top10">Top 10%</option>
          <option value="aboveAvg">Above Average</option>
          <option value="belowAvg">Below Average</option>
        </select>
        <input
          type="date"
          value={dateRange.start}
          onChange={(e) => setDateRange((r) => ({ ...r, start: e.target.value }))}
          style={styles.dateInput}
          title="Start date"
        />
        <input
          type="date"
          value={dateRange.end}
          onChange={(e) => setDateRange((r) => ({ ...r, end: e.target.value }))}
          style={styles.dateInput}
          title="End date"
        />
      </div>

      {/* Result count */}
      <div style={styles.resultCount}>
        {filtered.length} {filtered.length === 1 ? 'post' : 'posts'} found
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <h3>No content found</h3>
          <p>Try adjusting your filters or search query</p>
        </div>
      ) : (
        <div style={styles.grid} className="stagger-children">
          {filtered.map((item) => {
            const tier = getTier(item);
            return (
              <a
                key={item.contentId}
                href={item.postUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.card}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-borderHover)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Thumbnail placeholder */}
                <div style={styles.thumbnail}>
                  <span style={styles.thumbnailIcon}>{PLATFORM_ICON[item.platform] ?? '\u{1F4F7}'}</span>

                  {/* Platform badge */}
                  <div style={styles.platformBadge}>
                    <span>{PLATFORM_ICON[item.platform]}</span>
                    <span>{PLATFORM_LABEL[item.platform]}</span>
                  </div>

                  {/* Tier badge */}
                  <div style={styles.tierBadge}>
                    <span className={`badge ${TIER_BADGE[tier].cls}`}>{TIER_BADGE[tier].label}</span>
                  </div>
                </div>

                {/* Body */}
                <div style={styles.cardBody}>
                  <div style={styles.cardRestaurant}>{item.restaurantName ?? 'Unknown Restaurant'}</div>
                  <div style={styles.cardDate}>{formatDate(item.postedAt)}</div>

                  <div style={styles.metricsRow}>
                    <div style={styles.metric}>
                      <span style={styles.metricValue}>{formatNumber(item.metrics.reach)}</span>
                      <span style={styles.metricLabel}>Views</span>
                    </div>
                    <div style={styles.metric}>
                      <span style={styles.metricValue}>{formatNumber(item.metrics.saves)}</span>
                      <span style={styles.metricLabel}>Saves</span>
                    </div>
                    <div style={styles.metric}>
                      <span style={styles.metricValue}>{formatNumber(item.metrics.shares)}</span>
                      <span style={styles.metricLabel}>Shares</span>
                    </div>
                    <div style={styles.metric}>
                      <span style={styles.metricValue}>{formatNumber(item.metrics.likes)}</span>
                      <span style={styles.metricLabel}>Likes</span>
                    </div>
                  </div>

                  {item.tags.length > 0 && (
                    <div style={styles.tags}>
                      {item.tags.slice(0, 5).map((tag) => (
                        <span key={tag} style={styles.tag}>
                          #{tag}
                        </span>
                      ))}
                      {item.tags.length > 5 && (
                        <span style={styles.tag}>+{item.tags.length - 5}</span>
                      )}
                    </div>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
