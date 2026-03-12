import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ContentItem } from '../../types';
import { api } from '../../services/ApiService';
import { isDemoMode, DEMO_CONTENT, DEMO_CAMPAIGNS } from '../../data/demoData';
import { EmptyState } from '../../components/EmptyState';

/* ─── Types ────────────────────────────────────────────────────────────────── */

type PlatformFilter = 'all' | 'instagram' | 'tiktok' | 'youtube';
type PerformanceTier = 'all' | 'top10' | 'aboveAvg' | 'belowAvg';
type SortMode = 'recent' | 'engagement' | 'reach' | 'saves';

interface DateRange {
  start: string;
  end: string;
}

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

const PLATFORM_ICON: Record<string, string> = {
  instagram: '\u{1F4F8}',
  tiktok: '\u{1F3B5}',
  youtube: '\u{1F3AC}',
};

const PLATFORM_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
};

const PLATFORM_COLOR: Record<string, { bg: string; color: string }> = {
  instagram: { bg: 'rgba(225, 48, 108, 0.1)', color: '#E1306C' },
  tiktok: { bg: 'rgba(0, 0, 0, 0.06)', color: '#000' },
  youtube: { bg: 'rgba(255, 0, 0, 0.08)', color: '#FF0000' },
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

function engagementRate(item: ContentItem): number {
  const m = item.metrics;
  if (!m.reach || m.reach === 0) return 0;
  return ((m.saves + m.shares + m.comments + m.likes) / m.reach) * 100;
}

/* ─── Styles ───────────────────────────────────────────────────────────────── */

const styles = {
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 'var(--space-4)',
    marginBottom: 'var(--space-6)',
  } as React.CSSProperties,
  statCard: {
    background: 'var(--color-bgSecondary)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-4) var(--space-5)',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  statValue: {
    fontSize: 'var(--font-2xl)',
    fontWeight: 700,
    color: 'var(--color-textPrimary)',
    lineHeight: 1.2,
  } as React.CSSProperties,
  statLabel: {
    fontSize: 'var(--font-xs)',
    color: 'var(--color-textMuted)',
    marginTop: 'var(--space-1)',
  } as React.CSSProperties,
  controls: {
    display: 'flex',
    gap: 'var(--space-3)',
    alignItems: 'center',
    marginBottom: 'var(--space-4)',
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
    fontFamily: 'inherit',
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
    fontFamily: 'inherit',
  } as React.CSSProperties,
  dateInput: {
    padding: 'var(--space-2) var(--space-3)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-bgElevated)',
    color: 'var(--color-textPrimary)',
    fontSize: 'var(--font-xs)',
    outline: 'none',
    fontFamily: 'inherit',
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
  platformBadge: (platform: string) => ({
    position: 'absolute' as const,
    top: 'var(--space-3)',
    right: 'var(--space-3)',
    padding: 'var(--space-1) var(--space-3)',
    borderRadius: 'var(--radius-full)',
    fontSize: 'var(--font-xs)',
    fontWeight: 600,
    background: PLATFORM_COLOR[platform]?.bg || 'rgba(0,0,0,0.7)',
    color: PLATFORM_COLOR[platform]?.color || '#fff',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-1)',
  }) as React.CSSProperties,
  tierBadge: {
    position: 'absolute' as const,
    top: 'var(--space-3)',
    left: 'var(--space-3)',
  } as React.CSSProperties,
  campaignBadge: {
    position: 'absolute' as const,
    bottom: 'var(--space-3)',
    left: 'var(--space-3)',
    padding: '2px var(--space-2)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '10px',
    fontWeight: 600,
    background: 'rgba(0,0,0,0.7)',
    color: 'var(--color-accent)',
  } as React.CSSProperties,
  cardBody: {
    padding: 'var(--space-4)',
  } as React.CSSProperties,
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 'var(--space-3)',
  } as React.CSSProperties,
  cardRestaurant: {
    fontSize: 'var(--font-sm)',
    fontWeight: 600,
    color: 'var(--color-textPrimary)',
    lineHeight: 1.3,
  } as React.CSSProperties,
  cardDate: {
    fontSize: 'var(--font-xs)',
    color: 'var(--color-textMuted)',
  } as React.CSSProperties,
  engagementBadge: {
    fontSize: 'var(--font-xs)',
    fontWeight: 600,
    color: 'var(--color-accent)',
    whiteSpace: 'nowrap' as const,
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
  guidance: {
    background: 'var(--color-accentMuted)',
    border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-5)',
    marginBottom: 'var(--space-6)',
    display: 'flex',
    gap: 'var(--space-4)',
    alignItems: 'flex-start',
  } as React.CSSProperties,
} as const;

/* ─── Component ────────────────────────────────────────────────────────────── */

export default function ContentArchive() {
  // Filters
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [performanceTier, setPerformanceTier] = useState<PerformanceTier>('all');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [dateRange, setDateRange] = useState<DateRange>({ start: '', end: '' });

  // Data fetching via React Query
  const { data: items = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['contentArchive'],
    queryFn: async () => {
      if (isDemoMode()) return DEMO_CONTENT;
      const res = await api.get<ContentItem[]>('/api/spotops/content');
      if (res.error) throw new Error(res.error);
      return res.data ?? [];
    },
  });

  // Get campaign names for linked content
  const { data: campaigns = [] } = useQuery({
    queryKey: ['archiveCampaigns'],
    queryFn: async () => {
      if (isDemoMode()) return DEMO_CAMPAIGNS;
      const res = await api.get<Array<{ campaignId: string; restaurantName: string }>>('/api/campaigns');
      return res.data ?? [];
    },
  });

  const campaignMap = useMemo(() => {
    const map = new Map<string, string>();
    campaigns.forEach((c: { campaignId: string; restaurantName: string }) => map.set(c.campaignId, c.restaurantName));
    return map;
  }, [campaigns]);

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

  // Summary stats
  const stats = useMemo(() => {
    const totalReach = items.reduce((s, i) => s + (i.metrics.reach || 0), 0);
    const totalSaves = items.reduce((s, i) => s + (i.metrics.saves || 0), 0);
    const totalShares = items.reduce((s, i) => s + (i.metrics.shares || 0), 0);
    const avgEngagement = items.length > 0
      ? items.reduce((s, i) => s + engagementRate(i), 0) / items.length
      : 0;
    const igCount = items.filter(i => i.platform === 'instagram').length;
    const tkCount = items.filter(i => i.platform === 'tiktok').length;
    const ytCount = items.filter(i => i.platform === 'youtube').length;
    return { totalReach, totalSaves, totalShares, avgEngagement, igCount, tkCount, ytCount };
  }, [items]);

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
      const endMs = new Date(dateRange.end).getTime() + 86400000;
      result = result.filter((item) => new Date(item.postedAt).getTime() < endMs);
    }

    // Performance tier
    if (performanceTier !== 'all') {
      result = result.filter((item) => getTier(item) === performanceTier);
    }

    // Sort
    switch (sortMode) {
      case 'engagement':
        result.sort((a, b) => engagementScore(b) - engagementScore(a));
        break;
      case 'reach':
        result.sort((a, b) => (b.metrics.reach || 0) - (a.metrics.reach || 0));
        break;
      case 'saves':
        result.sort((a, b) => (b.metrics.saves || 0) - (a.metrics.saves || 0));
        break;
      default:
        result.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
    }

    return result;
  }, [items, search, platformFilter, performanceTier, sortMode, dateRange, avgScore, topThreshold]);

  /* ─── Loading ──────────────────────────────────────────────────────────── */

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div className="skeleton" style={{ width: '200px', height: '32px', marginBottom: 'var(--space-3)' }} />
          <div className="skeleton" style={{ width: '240px', height: '18px' }} />
        </div>
        <div style={styles.statsRow}>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="skeleton" style={{ height: '80px', borderRadius: 'var(--radius-lg)' }} />
          ))}
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
        <p className="page-subtitle">Browse and analyze all your published content across platforms</p>
      </div>

      {/* Error */}
      {isError && (
        <div style={styles.errorBanner}>
          <span>{(error as Error)?.message || 'Failed to load content'}</span>
          <button className="btn btn-ghost" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      )}

      {/* Summary Stats */}
      {items.length > 0 && (
        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{items.length}</div>
            <div style={styles.statLabel}>Total Posts</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{formatNumber(stats.totalReach)}</div>
            <div style={styles.statLabel}>Total Reach</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{formatNumber(stats.totalSaves)}</div>
            <div style={styles.statLabel}>Total Saves</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.avgEngagement.toFixed(1)}%</div>
            <div style={styles.statLabel}>Avg Engagement</div>
          </div>
          <div style={styles.statCard}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-3)' }}>
              {stats.igCount > 0 && (
                <span style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: '#E1306C' }}>
                  {stats.igCount} IG
                </span>
              )}
              {stats.tkCount > 0 && (
                <span style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--color-textPrimary)' }}>
                  {stats.tkCount} TT
                </span>
              )}
              {stats.ytCount > 0 && (
                <span style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: '#FF0000' }}>
                  {stats.ytCount} YT
                </span>
              )}
            </div>
            <div style={styles.statLabel}>By Platform</div>
          </div>
        </div>
      )}

      {/* Guidance Callout */}
      {items.length > 0 && items.length < 5 && (
        <div style={styles.guidance}>
          <span style={{ fontSize: 'var(--font-xl)' }}>💡</span>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--color-textPrimary)', marginBottom: 'var(--space-1)', fontSize: 'var(--font-sm)' }}>
              Build your portfolio
            </div>
            <div style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textSecondary)', lineHeight: 1.5 }}>
              Your content archive grows automatically as you complete campaigns. Each post you publish gets tracked here with performance metrics.
              The more content you create, the stronger your pitch to new restaurant partners.
            </div>
          </div>
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
          <option value="youtube">YouTube</option>
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
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          style={styles.select}
        >
          <option value="recent">Most Recent</option>
          <option value="engagement">Top Engagement</option>
          <option value="reach">Most Reach</option>
          <option value="saves">Most Saves</option>
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
        {search || platformFilter !== 'all' || performanceTier !== 'all' || dateRange.start || dateRange.end
          ? ` (filtered from ${items.length})`
          : ''}
      </div>

      {/* Grid */}
      {filtered.length === 0 && items.length > 0 ? (
        <div className="empty-state">
          <h3>No content matches your filters</h3>
          <p>Try adjusting your filters or search query</p>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={'\uD83D\uDCF7'}
          title="No content yet"
          description="Your content archive will grow as you create campaigns and upload photos, videos, and posts from your restaurant visits."
          ctaLabel="Start a Campaign"
          ctaTo="/app/campaigns"
        />
      ) : (
        <div style={styles.grid} className="stagger-children">
          {filtered.map((item) => {
            const tier = getTier(item);
            const rate = engagementRate(item);
            const linkedCampaign = item.campaignId ? campaignMap.get(item.campaignId) : null;
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
                  <div style={styles.platformBadge(item.platform)}>
                    <span>{PLATFORM_ICON[item.platform]}</span>
                    <span>{PLATFORM_LABEL[item.platform]}</span>
                  </div>

                  {/* Tier badge */}
                  <div style={styles.tierBadge}>
                    <span className={`badge ${TIER_BADGE[tier].cls}`}>{TIER_BADGE[tier].label}</span>
                  </div>

                  {/* Campaign link badge */}
                  {linkedCampaign && (
                    <div style={styles.campaignBadge}>
                      🔗 {linkedCampaign}
                    </div>
                  )}
                </div>

                {/* Body */}
                <div style={styles.cardBody}>
                  <div style={styles.cardHeader}>
                    <div>
                      <div style={styles.cardRestaurant}>{item.restaurantName ?? 'Unknown Restaurant'}</div>
                      <div style={styles.cardDate}>{formatDate(item.postedAt)}</div>
                    </div>
                    <div style={styles.engagementBadge}>{rate.toFixed(1)}% ER</div>
                  </div>

                  <div style={styles.metricsRow}>
                    <div style={styles.metric}>
                      <span style={styles.metricValue}>{formatNumber(item.metrics.reach)}</span>
                      <span style={styles.metricLabel}>Reach</span>
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
                    <div style={styles.metric}>
                      <span style={styles.metricValue}>{formatNumber(item.metrics.comments)}</span>
                      <span style={styles.metricLabel}>Comments</span>
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
