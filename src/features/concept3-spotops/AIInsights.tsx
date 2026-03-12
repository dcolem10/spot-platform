import { useState, useMemo, useCallback, memo } from 'react';
import { api } from '../../services/ApiService';
import {
  isDemoMode,
  DEMO_CAMPAIGNS,
  DEMO_CAMPAIGN_REPORTS,
  DEMO_CONTENT,
  DEMO_RESTAURANTS,
} from '../../data/demoData';
import type { Campaign, CampaignReport, ContentItem, Restaurant } from '../../types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Insight {
  id: string;
  icon: string;
  title: string;
  detail: string;
  type: 'success' | 'info' | 'warning' | 'action';
}

interface Recommendation {
  name: string;
  neighborhood: string;
  cuisine: string;
  whyRecommended: string;
  priceLevel: number;
  vibes: string[];
}

interface ContentIdea {
  title: string;
  description: string;
  type: 'reel' | 'story' | 'tiktok' | 'post';
}

// ─── Demo Insights Engine ───────────────────────────────────────────────────

function deriveDemoInsights(
  campaigns: Campaign[],
  reports: CampaignReport[],
  content: ContentItem[],
): Insight[] {
  const insights: Insight[] = [];

  // 1. Top-performing campaign
  const sortedReports = [...reports].sort(
    (a, b) => b.metrics.engagementRate - a.metrics.engagementRate,
  );
  if (sortedReports.length > 0) {
    const top = sortedReports[0];
    insights.push({
      id: 'top-campaign',
      icon: '\u{1F3C6}',
      title: `${top.restaurantName} leads in engagement`,
      detail: `${(top.metrics.engagementRate * 100).toFixed(1)}% engagement rate with ${formatNum(top.metrics.totalReach)} reach. This campaign outperformed your average by ${Math.round(((top.metrics.engagementRate / avgEngagement(reports)) - 1) * 100)}%.`,
      type: 'success',
    });
  }

  // 2. Campaign pipeline
  const activeCampaigns = campaigns.filter((c) => c.status === 'active').length;
  const completedCampaigns = campaigns
    .filter((c) => c.status === 'completed')
    .length;
  const negotiatingCampaigns = campaigns.filter((c) => c.status === 'negotiation').length;
  insights.push({
    id: 'revenue',
    icon: '\u{1F4B0}',
    title: `${activeCampaigns} active campaigns in pipeline`,
    detail: `You have ${completedCampaigns} campaigns completed with attribution tracking and ${activeCampaigns} actively in progress. ${negotiatingCampaigns} additional deals in negotiation could expand your reach.`,
    type: 'info',
  });

  // 3. Content performance pattern
  const platformPerf = content.reduce(
    (acc, c) => {
      const p = c.platform;
      acc[p] = acc[p] || { total: 0, engagement: 0 };
      acc[p].total++;
      acc[p].engagement += c.metrics.saves + c.metrics.shares + c.metrics.comments;
      return acc;
    },
    {} as Record<string, { total: number; engagement: number }>,
  );
  const platforms = Object.entries(platformPerf);
  if (platforms.length > 1) {
    const [bestPlatform] = platforms.sort(
      (a, b) => b[1].engagement / b[1].total - a[1].engagement / a[1].total,
    );
    insights.push({
      id: 'platform-pattern',
      icon: '\u{1F4CA}',
      title: `${bestPlatform[0] === 'tiktok' ? 'TikTok' : 'Instagram'} drives higher engagement per post`,
      detail: `Your ${bestPlatform[0] === 'tiktok' ? 'TikTok' : 'Instagram'} content averages ${formatNum(Math.round(bestPlatform[1].engagement / bestPlatform[1].total))} interactions per post. Consider prioritizing this platform for sponsored content.`,
      type: 'action',
    });
  }

  // 4. Deliverable completion rate
  const allDeliverables = campaigns.flatMap((c) => c.deliverables);
  const completed = allDeliverables.filter((d) => d.completed).length;
  const total = allDeliverables.length;
  if (total > 0) {
    const pct = Math.round((completed / total) * 100);
    insights.push({
      id: 'deliverables',
      icon: pct >= 70 ? '\u2705' : '\u26A0\uFE0F',
      title: `${pct}% deliverables completed (${completed}/${total})`,
      detail: pct >= 70
        ? 'You\'re on track with your deliverables. Keep this pace to maintain strong partner relationships.'
        : `${total - completed} deliverables pending across active campaigns. Prioritize these to maintain your completion rate.`,
      type: pct >= 70 ? 'success' : 'warning',
    });
  }

  // 5. QR / offer performance
  const totalScans = reports.reduce((s, r) => s + r.metrics.qrScans, 0);
  const totalRedemptions = reports.reduce((s, r) => s + r.metrics.offerRedemptions, 0);
  if (totalScans > 0) {
    const convRate = Math.round((totalRedemptions / totalScans) * 100);
    insights.push({
      id: 'qr-performance',
      icon: '\u{1F4F1}',
      title: `${convRate}% QR-to-redemption conversion`,
      detail: `${formatNum(totalScans)} QR scans converted to ${formatNum(totalRedemptions)} redemptions. ${convRate >= 12 ? 'This is above average for food creator campaigns.' : 'Consider adding urgency ("limited time") to boost conversions.'}`,
      type: convRate >= 12 ? 'success' : 'action',
    });
  }

  return insights;
}

function deriveDemoRecommendations(
  campaigns: Campaign[],
  restaurants: Restaurant[],
): Recommendation[] {
  const partneredIds = new Set(campaigns.map((c) => c.restaurantId));

  return restaurants
    .filter((r) => !partneredIds.has(r.restaurantId) && !r.isPartner)
    .slice(0, 4)
    .map((r) => ({
      name: r.name,
      neighborhood: r.neighborhood,
      cuisine: r.cuisine[0] || 'American',
      whyRecommended: getRecommendationReason(r, campaigns),
      priceLevel: r.priceLevel,
      vibes: r.vibes.slice(0, 3),
    }));
}

function getRecommendationReason(r: Restaurant, campaigns: Campaign[]): string {
  const activeCuisines = new Set(
    campaigns
      .filter((c) => c.status === 'completed' || c.status === 'active')
      .map((c) => {
        const match = DEMO_RESTAURANTS.find((dr) => dr.restaurantId === c.restaurantId);
        return match?.cuisine[0];
      })
      .filter(Boolean),
  );

  if (r.cuisine.some((c) => activeCuisines.has(c))) {
    return `Similar cuisine to your successful campaigns. ${r.neighborhood} is an underrepresented neighborhood in your portfolio.`;
  }
  if (r.spotRating && r.spotRating >= 4.5) {
    return `Highly rated (${r.spotRating}) in ${r.neighborhood}. Adding ${r.cuisine[0]} content would diversify your feed.`;
  }
  return `${r.neighborhood} location with ${r.vibes[0]?.toLowerCase() || 'great'} vibes. A fresh cuisine angle for your audience.`;
}

function getDemoContentIdeas(): ContentIdea[] {
  return [
    {
      title: 'Neighborhood Crawl: Shaw Edition',
      description: 'Hit 3-4 spots in Shaw (The Dabney, Tiger Fork, Chercher) in one day. Great for a "What I eat in a day" format.',
      type: 'reel',
    },
    {
      title: 'Behind the Kitchen at Maydan',
      description: 'Their open-fire cooking is incredibly visual. A behind-the-scenes reel could go viral with the right hook.',
      type: 'reel',
    },
    {
      title: 'DC Brunch Bracket',
      description: 'Pit your top brunch spots against each other in a bracket format. Drives engagement through voting in comments.',
      type: 'tiktok',
    },
    {
      title: 'Le Diplomate Date Night Guide',
      description: 'What to order, what to wear, where to sit. Practical date night content performs well on saves.',
      type: 'story',
    },
    {
      title: '$20 Challenge: Columbia Heights',
      description: 'Best meal under $20 at Thip Khao, Bad Saint, or a new find. Affordable finds drive huge reach.',
      type: 'tiktok',
    },
  ];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function avgEngagement(reports: CampaignReport[]): number {
  if (reports.length === 0) return 0;
  return reports.reduce((s, r) => s + r.metrics.engagementRate, 0) / reports.length;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  reel: { label: 'Reel', color: 'var(--color-accent)' },
  story: { label: 'Story', color: 'var(--color-info)' },
  tiktok: { label: 'TikTok', color: 'var(--color-success)' },
  post: { label: 'Post', color: 'var(--color-warning)' },
};

const INSIGHT_STYLES: Record<string, { border: string; bg: string }> = {
  success: { border: 'var(--color-success)', bg: 'var(--color-successMuted)' },
  info: { border: 'var(--color-info)', bg: 'var(--color-infoMuted)' },
  warning: { border: 'var(--color-warning)', bg: 'var(--color-warningMuted)' },
  action: { border: 'var(--color-accent)', bg: 'var(--color-accentMuted)' },
};

// ─── Sub-components ─────────────────────────────────────────────────────────

const InsightCard = memo(function InsightCard({ insight }: { insight: Insight }) {
  const style = INSIGHT_STYLES[insight.type] || INSIGHT_STYLES.info;
  return (
    <div
      className="card"
      style={{
        borderLeft: `3px solid ${style.border}`,
        display: 'flex',
        gap: 'var(--space-4)',
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: 'var(--radius-md)',
          background: style.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 'var(--font-lg)',
          flexShrink: 0,
        }}
      >
        {insight.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3
          style={{
            fontSize: 'var(--font-sm)',
            fontWeight: 600,
            color: 'var(--color-textPrimary)',
            marginBottom: 'var(--space-1)',
          }}
        >
          {insight.title}
        </h3>
        <p
          style={{
            fontSize: 'var(--font-sm)',
            color: 'var(--color-textSecondary)',
            lineHeight: 1.6,
          }}
        >
          {insight.detail}
        </p>
      </div>
    </div>
  );
});

const RecommendationCard = memo(function RecommendationCard({ rec }: { rec: Recommendation }) {
  const priceStr = '$'.repeat(rec.priceLevel);
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 'var(--space-3)',
        }}
      >
        <div>
          <h3
            style={{
              fontSize: 'var(--font-base)',
              fontWeight: 600,
              color: 'var(--color-textPrimary)',
              marginBottom: 'var(--space-1)',
            }}
          >
            {rec.name}
          </h3>
          <span
            style={{
              fontSize: 'var(--font-xs)',
              color: 'var(--color-textMuted)',
            }}
          >
            {rec.neighborhood} &middot; {rec.cuisine} &middot; {priceStr}
          </span>
        </div>
        <span
          className="badge badge--accent"
          style={{ flexShrink: 0, fontSize: 'var(--font-xs)' }}
        >
          Suggested
        </span>
      </div>
      <p
        style={{
          fontSize: 'var(--font-sm)',
          color: 'var(--color-textSecondary)',
          lineHeight: 1.5,
          flex: 1,
        }}
      >
        {rec.whyRecommended}
      </p>
      {rec.vibes.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
            flexWrap: 'wrap',
            marginTop: 'var(--space-3)',
          }}
        >
          {rec.vibes.map((v) => (
            <span
              key={v}
              className="badge"
              style={{
                background: 'var(--color-bgElevated)',
                border: '1px solid var(--color-border)',
                fontSize: '11px',
              }}
            >
              {v}
            </span>
          ))}
        </div>
      )}
    </div>
  );
});

const ContentIdeaCard = memo(function ContentIdeaCard({ idea, index }: { idea: ContentIdea; index: number }) {
  const typeInfo = TYPE_LABELS[idea.type] || TYPE_LABELS.post;
  return (
    <div
      className="card"
      style={{
        display: 'flex',
        gap: 'var(--space-4)',
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: 'var(--radius-full)',
          background: 'var(--color-bgElevated)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 'var(--font-sm)',
          fontWeight: 700,
          color: 'var(--color-textMuted)',
          flexShrink: 0,
        }}
      >
        {index + 1}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-2)',
          }}
        >
          <h3
            style={{
              fontSize: 'var(--font-sm)',
              fontWeight: 600,
              color: 'var(--color-textPrimary)',
            }}
          >
            {idea.title}
          </h3>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: typeInfo.color,
              background: 'var(--color-bgElevated)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
            }}
          >
            {typeInfo.label}
          </span>
        </div>
        <p
          style={{
            fontSize: 'var(--font-sm)',
            color: 'var(--color-textSecondary)',
            lineHeight: 1.5,
          }}
        >
          {idea.description}
        </p>
      </div>
    </div>
  );
});

// ─── Main Component ─────────────────────────────────────────────────────────

export default function AIInsights() {
  const [activeTab, setActiveTab] = useState<'insights' | 'recommendations' | 'content'>(
    'insights',
  );
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiRecommendations, setAiRecommendations] = useState<Recommendation[] | null>(null);
  const [aiContentIdeas, setAiContentIdeas] = useState<ContentIdea[] | null>(null);
  const [aiInsights, setAiInsights] = useState<string[] | null>(null);

  // Demo-derived data
  const demoInsights = useMemo(
    () => deriveDemoInsights(DEMO_CAMPAIGNS, DEMO_CAMPAIGN_REPORTS, DEMO_CONTENT),
    [],
  );

  const demoRecommendations = useMemo(
    () => deriveDemoRecommendations(DEMO_CAMPAIGNS, DEMO_RESTAURANTS),
    [],
  );

  const demoContentIdeas = useMemo(() => getDemoContentIdeas(), []);

  // API calls for real mode (wrapped in try-catch for resilience)
  const fetchAIInsights = useCallback(async () => {
    if (isDemoMode()) return;
    setIsLoadingAI(true);
    setAiError(null);
    try {
      const result = await api.post<{ insights: string[] }>('/api/ai/campaign-insights', {
        campaignData: {
          campaigns: DEMO_CAMPAIGNS.length,
          active: DEMO_CAMPAIGNS.filter((c) => c.status === 'active').length,
          completed: DEMO_CAMPAIGNS.filter((c) => c.status === 'completed').length,
        },
      });
      if (result.status === 'success' && result.data) {
        setAiInsights(result.data.insights);
      } else {
        setAiError(result.error || 'Failed to load AI insights.');
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed to load AI insights.');
    } finally {
      setIsLoadingAI(false);
    }
  }, []);

  const fetchAIRecommendations = useCallback(async () => {
    if (isDemoMode()) return;
    setIsLoadingAI(true);
    setAiError(null);
    try {
      const result = await api.post<{ recommendations: Recommendation[] }>(
        '/api/ai/recommendations',
        { query: 'Recommend new DC restaurants for a food creator to partner with' },
      );
      if (result.status === 'success' && result.data) {
        setAiRecommendations(result.data.recommendations);
      } else {
        setAiError(result.error || 'Failed to load recommendations.');
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed to load recommendations.');
    } finally {
      setIsLoadingAI(false);
    }
  }, []);

  const fetchAIContentIdeas = useCallback(async () => {
    if (isDemoMode()) return;
    setIsLoadingAI(true);
    setAiError(null);
    try {
      const result = await api.post<{ ideas: ContentIdea[] }>('/api/ai/content-ideas', {
        context: { city: 'DC', niche: 'food', platforms: ['instagram', 'tiktok'] },
      });
      if (result.status === 'success' && result.data) {
        setAiContentIdeas(result.data.ideas);
      } else {
        setAiError(result.error || 'Failed to load content ideas.');
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed to load content ideas.');
    } finally {
      setIsLoadingAI(false);
    }
  }, []);

  const handleTabChange = useCallback(
    (tab: 'insights' | 'recommendations' | 'content') => {
      setActiveTab(tab);
      if (!isDemoMode()) {
        if (tab === 'insights' && !aiInsights) fetchAIInsights();
        if (tab === 'recommendations' && !aiRecommendations) fetchAIRecommendations();
        if (tab === 'content' && !aiContentIdeas) fetchAIContentIdeas();
      }
    },
    [aiInsights, aiRecommendations, aiContentIdeas, fetchAIInsights, fetchAIRecommendations, fetchAIContentIdeas],
  );

  const tabs: { key: 'insights' | 'recommendations' | 'content'; label: string; icon: string }[] = [
    { key: 'insights', label: 'Campaign Insights', icon: '\u{1F4CA}' },
    { key: 'recommendations', label: 'Partner Suggestions', icon: '\u{1F3AF}' },
    { key: 'content', label: 'Content Ideas', icon: '\u{1F4A1}' },
  ];

  return (
    <div className="page-container">
      <header className="page-header">
        <h1 className="page-title">AI Insights</h1>
        <p className="page-subtitle">
          Analytics, patterns, and recommendations powered by your campaign data.
        </p>
      </header>

      {/* Tab Bar */}
      <div
        role="tablist"
        aria-label="AI Insights sections"
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-6)',
          overflowX: 'auto',
          paddingBottom: 'var(--space-2)',
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-controls={`tabpanel-${tab.key}`}
            onClick={() => handleTabChange(tab.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              background:
                activeTab === tab.key
                  ? 'var(--color-accent)'
                  : 'var(--color-bgElevated)',
              color:
                activeTab === tab.key
                  ? '#fff'
                  : 'var(--color-textSecondary)',
              fontSize: 'var(--font-sm)',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all var(--transition-base)',
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {aiError && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
            padding: 'var(--space-3) var(--space-4)',
            marginBottom: 'var(--space-4)',
            background: 'var(--color-errorMuted)',
            border: '1px solid var(--color-error)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-sm)',
            color: 'var(--color-error)',
          }}
        >
          <span>{aiError}</span>
          <button
            onClick={() => setAiError(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-error)',
              cursor: 'pointer',
              fontSize: 'var(--font-base)',
              lineHeight: 1,
              padding: '2px',
              flexShrink: 0,
            }}
            aria-label="Dismiss error"
          >
            &times;
          </button>
        </div>
      )}

      {/* Loading state for API mode */}
      {isLoadingAI && (
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--space-8)',
            color: 'var(--color-textMuted)',
          }}
        >
          <div
            style={{
              width: '24px',
              height: '24px',
              border: '3px solid var(--color-border)',
              borderTopColor: 'var(--color-accent)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto var(--space-3)',
            }}
          />
          <p style={{ fontSize: 'var(--font-sm)' }}>Analyzing your data...</p>
        </div>
      )}

      {/* ── Campaign Insights Tab ── */}
      {activeTab === 'insights' && !isLoadingAI && (
        <section role="tabpanel" id="tabpanel-insights" aria-label="Campaign Insights">
          {isDemoMode() ? (
            <div
              className="stagger-children"
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
            >
              {demoInsights.map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          ) : aiInsights ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {aiInsights.map((text, i) => (
                <InsightCard
                  key={i}
                  insight={{
                    id: `ai-${i}`,
                    icon: '\u{1F916}',
                    title: text.split('.')[0] || 'Insight',
                    detail: text,
                    type: 'info',
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>Click the tab to generate AI-powered insights from your campaign data.</p>
            </div>
          )}
        </section>
      )}

      {/* ── Partner Suggestions Tab ── */}
      {activeTab === 'recommendations' && !isLoadingAI && (
        <section role="tabpanel" id="tabpanel-recommendations" aria-label="Partner Suggestions">
          <p
            style={{
              fontSize: 'var(--font-sm)',
              color: 'var(--color-textMuted)',
              marginBottom: 'var(--space-5)',
            }}
          >
            Restaurants you haven't partnered with yet that align with your audience and content style.
          </p>
          {isDemoMode() ? (
            <div className="card-grid stagger-children">
              {demoRecommendations.map((rec) => (
                <RecommendationCard key={rec.name} rec={rec} />
              ))}
            </div>
          ) : aiRecommendations ? (
            <div className="card-grid stagger-children">
              {aiRecommendations.map((rec) => (
                <RecommendationCard key={rec.name} rec={rec} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>Click the tab to get AI-powered restaurant recommendations.</p>
            </div>
          )}
        </section>
      )}

      {/* ── Content Ideas Tab ── */}
      {activeTab === 'content' && !isLoadingAI && (
        <section role="tabpanel" id="tabpanel-content" aria-label="Content Ideas">
          <p
            style={{
              fontSize: 'var(--font-sm)',
              color: 'var(--color-textMuted)',
              marginBottom: 'var(--space-5)',
            }}
          >
            Tailored content ideas based on your active campaigns and audience trends.
          </p>
          {isDemoMode() ? (
            <div
              className="stagger-children"
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
            >
              {demoContentIdeas.map((idea, i) => (
                <ContentIdeaCard key={idea.title} idea={idea} index={i} />
              ))}
            </div>
          ) : aiContentIdeas ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {aiContentIdeas.map((idea, i) => (
                <ContentIdeaCard key={idea.title} idea={idea} index={i} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>Click the tab to generate fresh content ideas.</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
