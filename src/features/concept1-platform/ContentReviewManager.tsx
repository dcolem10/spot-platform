import { useState, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/ApiService';
import { useAuth } from '../../hooks/useAuth';
import { isDemoMode } from '../../data/demoData';
import { logger } from '../../services/logger';
import type { ContentReview, ContentReviewStatus, ContentPlatform, ContentType } from '../../types';

/* ─── Demo Data ─────────────────────────────────────────────────────────────── */

function demoISO(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString();
}

const DEMO_REVIEWS: ContentReview[] = [
  {
    contentReviewId: 'review-demo-1',
    creatorId: 'creator-demo',
    restaurantId: 'r3',
    restaurantName: 'Nobu Downtown',
    platform: 'instagram',
    contentType: 'reel',
    contentUrl: 'https://instagram.com/p/demo-nobu',
    caption: 'Just experienced the most incredible omakase at Nobu Downtown. The attention to detail in every piece was insane!',
    hashtagsProposed: ['#NobuDowntown', '#Omakase', '#FoodieLife', '#NYC'],
    status: 'approved',
    submittedAt: demoISO(-7),
    approvedAt: demoISO(-5),
    approvedBy: 'r3',
    revisionCount: 0,
    revisionHistory: [],
    messages: [],
    createdAt: demoISO(-10),
    updatedAt: demoISO(-5),
  },
  {
    contentReviewId: 'review-demo-2',
    creatorId: 'creator-demo',
    restaurantId: 'r2',
    restaurantName: 'Carbone',
    platform: 'tiktok',
    contentType: 'tiktok',
    contentUrl: 'https://tiktok.com/@demo/video/5678',
    caption: 'Carbone absolutely delivered. This pasta is why I drive into the city every week',
    hashtagsProposed: ['#Carbone', '#PastaTok', '#FoodieLife', '#NYC'],
    status: 'submitted',
    submittedAt: demoISO(-2),
    revisionCount: 0,
    revisionHistory: [],
    messages: [],
    createdAt: demoISO(-5),
    updatedAt: demoISO(-2),
  },
  {
    contentReviewId: 'review-demo-3',
    creatorId: 'creator-demo',
    restaurantId: 'r5',
    restaurantName: 'Le Bernardin',
    platform: 'youtube',
    contentType: 'shorts',
    contentUrl: 'https://youtube.com/shorts/demo-le-bernardin',
    caption: 'Le Bernardin seafood experience - every course was a masterpiece',
    hashtagsProposed: ['#LeBernardin', '#SeafoodReview', '#FineDining', '#NYC'],
    status: 'revision_requested',
    submittedAt: demoISO(-3),
    revisionCount: 1,
    revisionHistory: [{ reason: 'Please remove the brand collaboration mention and resubmit with original content focus only.', requestedAt: demoISO(-3) }],
    messages: [],
    createdAt: demoISO(-8),
    updatedAt: demoISO(-3),
  },
  {
    contentReviewId: 'review-demo-4',
    creatorId: 'creator-demo',
    restaurantId: 'r4',
    restaurantName: 'Peter Luger',
    platform: 'instagram',
    contentType: 'story',
    contentUrl: 'https://instagram.com/stories/demo-peter-luger',
    caption: 'Peter Luger Steak House - still the best in NYC after all these years',
    hashtagsProposed: ['#PeterLuger', '#Steakhouse', '#NYC'],
    status: 'draft',
    revisionCount: 0,
    revisionHistory: [],
    messages: [],
    createdAt: demoISO(-1),
    updatedAt: demoISO(-1),
  },
  {
    contentReviewId: 'review-demo-5',
    creatorId: 'creator-demo',
    restaurantId: 'r1',
    restaurantName: 'Eleven Madison Park',
    platform: 'tiktok',
    contentType: 'tiktok',
    contentUrl: 'https://tiktok.com/@demo/video/9999',
    caption: 'Tried Eleven Madison Park today...',
    hashtagsProposed: ['#ElevenMadisonPark', '#FoodieLife'],
    status: 'rejected',
    submittedAt: demoISO(-6),
    rejectedAt: demoISO(-6),
    rejectionReason: 'This content does not align with our brand values. Please contact us directly to discuss partnership guidelines.',
    revisionCount: 0,
    revisionHistory: [],
    messages: [],
    createdAt: demoISO(-9),
    updatedAt: demoISO(-6),
  },
  {
    contentReviewId: 'review-demo-6',
    creatorId: 'creator-demo',
    restaurantId: 'r3',
    restaurantName: 'Nobu Downtown',
    platform: 'instagram',
    contentType: 'reel',
    contentUrl: 'https://instagram.com/p/demo-nobu-draft',
    publishedUrl: 'https://instagram.com/reel/demo-nobu-live',
    caption: 'The omakase experience at Nobu Downtown — 12 courses of pure artistry',
    hashtagsProposed: ['#NobuDowntown', '#Omakase', '#FoodCreator'],
    status: 'published',
    submittedAt: demoISO(-14),
    approvedAt: demoISO(-12),
    approvedBy: 'r3',
    publishedAt: demoISO(-10),
    metrics: {
      likes: 2340,
      comments: 87,
      shares: 45,
      saves: 312,
      impressions: 34500,
      reach: 28900,
      views: 18200,
      engagementRate: 7.16,
    },
    metricsUpdatedAt: demoISO(-1),
    revisionCount: 0,
    revisionHistory: [],
    messages: [],
    createdAt: demoISO(-18),
    updatedAt: demoISO(-1),
  },
];

/* ─── Status & Platform Config ──────────────────────────────────────────────── */

const STATUS_CONFIG: Record<ContentReviewStatus, { bg: string; color: string; label: string; icon: string }> = {
  draft:              { bg: 'rgba(107, 114, 128, 0.15)', color: '#9ca3af', label: 'Draft',              icon: '📝' },
  submitted:          { bg: 'rgba(59, 130, 246, 0.15)',  color: '#3b82f6', label: 'Submitted',          icon: '📤' },
  revision_requested: { bg: 'rgba(249, 115, 22, 0.15)',  color: '#f97316', label: 'Revision Requested', icon: '🔄' },
  revised:            { bg: 'rgba(59, 130, 246, 0.15)',  color: '#3b82f6', label: 'Revised',            icon: '📤' },
  approved:           { bg: 'rgba(16, 185, 129, 0.15)',  color: '#10b981', label: 'Approved',           icon: '✅' },
  rejected:           { bg: 'rgba(239, 68, 68, 0.15)',   color: '#ef4444', label: 'Rejected',           icon: '❌' },
  published:          { bg: 'rgba(16, 185, 129, 0.25)',  color: '#10b981', label: 'Published',          icon: '🚀' },
};

const PLATFORM_CONFIG: Record<ContentPlatform, { bg: string; color: string; label: string; icon: string }> = {
  instagram: { bg: 'rgba(225, 48, 108, 0.15)', color: '#E1306C', label: 'Instagram', icon: '📸' },
  tiktok:    { bg: 'rgba(0, 0, 0, 0.15)',       color: '#fff',    label: 'TikTok',   icon: '🎵' },
  youtube:   { bg: 'rgba(255, 0, 0, 0.15)',     color: '#FF0000', label: 'YouTube',  icon: '🎬' },
};

/* ─── Content Card ──────────────────────────────────────────────────────────── */

const ContentCard = memo(function ContentCard({
  review,
  isCreatorView,
  index,
  onSubmit,
  onRevise,
  onApprove,
  onRequestRevision,
  onReject,
  onPublish,
  onFetchMetrics,
}: {
  review: ContentReview;
  isCreatorView: boolean;
  index: number;
  onSubmit?: (id: string) => void;
  onRevise?: (id: string) => void;
  onApprove?: (id: string) => void;
  onRequestRevision?: (id: string) => void;
  onReject?: (id: string) => void;
  onPublish?: (id: string) => void;
  onFetchMetrics?: (id: string) => void;
}) {
  const statusCfg = STATUS_CONFIG[review.status];
  const platformCfg = PLATFORM_CONFIG[review.platform];

  return (
    <div style={{
      padding: 'var(--space-5)',
      background: 'var(--color-bgSecondary)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      transition: 'all var(--transition-fast)',
      animation: 'fadeSlideIn 0.4s ease both',
      animationDelay: `${index * 60}ms`,
      cursor: 'default',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.borderColor = 'var(--color-borderHover)';
      e.currentTarget.style.boxShadow = 'var(--shadow-md)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor = 'var(--color-border)';
      e.currentTarget.style.boxShadow = 'none';
    }}
    >
      {/* Header: Restaurant + Badges */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 'var(--space-3)',
        marginBottom: 'var(--space-3)',
      }}>
        <div style={{ flex: 1 }}>
          <h3 style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--font-md)',
            fontWeight: 600,
            color: 'var(--color-textPrimary)',
            marginBottom: 'var(--space-2)',
            letterSpacing: '-0.01em',
          }}>
            {review.restaurantName}
          </h3>
          <div style={{
            display: 'flex',
            gap: 'var(--space-2)',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}>
            <span style={{
              padding: '3px 10px',
              borderRadius: 'var(--radius-full)',
              fontSize: 'var(--font-xs)',
              fontWeight: 600,
              background: platformCfg.bg,
              color: platformCfg.color,
              letterSpacing: '0.02em',
            }}>
              {platformCfg.icon} {platformCfg.label}
            </span>
            <span style={{
              padding: '3px 10px',
              borderRadius: 'var(--radius-full)',
              fontSize: 'var(--font-xs)',
              fontWeight: 600,
              background: statusCfg.bg,
              color: statusCfg.color,
              letterSpacing: '0.02em',
            }}>
              {statusCfg.label}
            </span>
            {review.contentType && (
              <span style={{
                padding: '3px 10px',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--font-xs)',
                color: 'var(--color-textMuted)',
                background: 'var(--color-bgElevated)',
                textTransform: 'capitalize',
              }}>
                {review.contentType}
              </span>
            )}
          </div>
        </div>
        {/* Revision count badge */}
        {review.revisionCount > 0 && (
          <span style={{
            padding: '3px 10px',
            borderRadius: 'var(--radius-full)',
            fontSize: 'var(--font-xs)',
            fontWeight: 600,
            background: 'rgba(249, 115, 22, 0.1)',
            color: '#f97316',
            whiteSpace: 'nowrap',
          }}>
            {review.revisionCount} revision{review.revisionCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Caption */}
      <p style={{
        margin: 0,
        fontSize: 'var(--font-sm)',
        color: 'var(--color-textPrimary)',
        lineHeight: 1.6,
        marginBottom: 'var(--space-3)',
      }}>
        {review.caption}
      </p>

      {/* Hashtags */}
      {review.hashtagsProposed && review.hashtagsProposed.length > 0 && (
        <div style={{
          display: 'flex',
          gap: 'var(--space-1)',
          flexWrap: 'wrap',
          marginBottom: 'var(--space-3)',
        }}>
          {review.hashtagsProposed.map((tag) => (
            <span key={tag} style={{
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              fontSize: '11px',
              color: 'var(--color-accent)',
              background: 'rgba(249, 115, 22, 0.08)',
              fontWeight: 500,
            }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Content URL */}
      {review.contentUrl && (
        <div style={{
          marginBottom: 'var(--space-3)',
          paddingBottom: 'var(--space-3)',
          borderBottom: '1px solid var(--color-border)',
        }}>
          <a
            href={review.contentUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 'var(--font-xs)',
              color: 'var(--color-accent)',
              textDecoration: 'none',
              wordBreak: 'break-all',
              transition: 'opacity var(--transition-fast)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            {review.contentUrl}
          </a>
        </div>
      )}

      {/* Revision Request Callout */}
      {review.revisionHistory?.[review.revisionHistory.length - 1]?.reason && (
        <div style={{
          padding: 'var(--space-3) var(--space-4)',
          background: 'rgba(249, 115, 22, 0.06)',
          borderLeft: '3px solid #f97316',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--space-3)',
        }}>
          <div style={{
            fontSize: 'var(--font-xs)',
            fontWeight: 600,
            color: '#f97316',
            marginBottom: 'var(--space-1)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            Revision Requested
          </div>
          <div style={{
            fontSize: 'var(--font-sm)',
            color: 'var(--color-textPrimary)',
            lineHeight: 1.5,
          }}>
            {review.revisionHistory[review.revisionHistory.length - 1].reason}
          </div>
        </div>
      )}

      {/* Rejection Reason Callout */}
      {review.rejectionReason && (
        <div style={{
          padding: 'var(--space-3) var(--space-4)',
          background: 'rgba(239, 68, 68, 0.06)',
          borderLeft: '3px solid #ef4444',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--space-3)',
        }}>
          <div style={{
            fontSize: 'var(--font-xs)',
            fontWeight: 600,
            color: '#ef4444',
            marginBottom: 'var(--space-1)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            Rejected
          </div>
          <div style={{
            fontSize: 'var(--font-sm)',
            color: 'var(--color-textPrimary)',
            lineHeight: 1.5,
          }}>
            {review.rejectionReason}
          </div>
        </div>
      )}

      {/* Published URL */}
      {review.publishedUrl && (
        <div style={{
          marginBottom: 'var(--space-3)',
          padding: 'var(--space-3) var(--space-4)',
          background: 'rgba(16, 185, 129, 0.06)',
          borderLeft: '3px solid #10b981',
          borderRadius: 'var(--radius-md)',
        }}>
          <div style={{
            fontSize: 'var(--font-xs)',
            fontWeight: 600,
            color: '#10b981',
            marginBottom: 'var(--space-1)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            🚀 Published
          </div>
          <a
            href={review.publishedUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 'var(--font-xs)',
              color: 'var(--color-accent)',
              textDecoration: 'none',
              wordBreak: 'break-all',
            }}
          >
            {review.publishedUrl}
          </a>
        </div>
      )}

      {/* Engagement Metrics */}
      {review.metrics && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 'var(--space-2)',
          padding: 'var(--space-3)',
          background: 'rgba(16, 185, 129, 0.04)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid rgba(16, 185, 129, 0.1)',
          marginBottom: 'var(--space-3)',
        }}>
          {[
            { label: 'Likes', value: review.metrics.likes },
            { label: 'Comments', value: review.metrics.comments },
            { label: 'Shares', value: review.metrics.shares },
            { label: 'Views', value: review.metrics.views },
            { label: 'Saves', value: review.metrics.saves },
            { label: 'Reach', value: review.metrics.reach },
            { label: 'Impressions', value: review.metrics.impressions },
            { label: 'Eng. Rate', value: `${review.metrics.engagementRate}%` },
          ].map((m) => (
            <div key={m.label} style={{ textAlign: 'center', padding: '4px 0' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-textPrimary)' }}>
                {typeof m.value === 'number' ? m.value.toLocaleString() : m.value}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--color-textMuted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {m.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer: Timestamps + Actions */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 'var(--space-3)',
      }}>
        {/* Timestamps */}
        <div style={{
          display: 'flex',
          gap: 'var(--space-4)',
          fontSize: 'var(--font-xs)',
          color: 'var(--color-textMuted)',
        }}>
          {review.publishedAt && (
            <span>Published {new Date(review.publishedAt).toLocaleDateString()}</span>
          )}
          {review.submittedAt && !review.publishedAt && (
            <span>Submitted {new Date(review.submittedAt).toLocaleDateString()}</span>
          )}
          {review.approvedAt && !review.publishedAt && (
            <span>Approved {new Date(review.approvedAt).toLocaleDateString()}</span>
          )}
          {!review.submittedAt && review.createdAt && (
            <span>Created {new Date(review.createdAt).toLocaleDateString()}</span>
          )}
          {review.metricsUpdatedAt && (
            <span>Metrics updated {new Date(review.metricsUpdatedAt).toLocaleDateString()}</span>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: 'var(--space-2)',
          flexWrap: 'wrap',
        }}>
          {isCreatorView ? (
            <>
              {review.status === 'approved' && (
                <button
                  onClick={() => onPublish?.(review.contentReviewId)}
                  style={{
                    padding: 'var(--space-2) var(--space-4)',
                    background: '#10b981',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-xs)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    letterSpacing: '0.01em',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
                >
                  🚀 Mark as Published
                </button>
              )}
              {review.status === 'published' && (
                <button
                  onClick={() => onFetchMetrics?.(review.contentReviewId)}
                  style={{
                    padding: 'var(--space-2) var(--space-4)',
                    background: 'transparent',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-xs)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    letterSpacing: '0.01em',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.background = 'rgba(16, 185, 129, 0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)'; e.currentTarget.style.background = 'transparent'; }}
                >
                  📊 Fetch Metrics
                </button>
              )}
              {review.status === 'draft' && (
                <button
                  onClick={() => onSubmit?.(review.contentReviewId)}
                  style={{
                    padding: 'var(--space-2) var(--space-4)',
                    background: 'var(--color-accent)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-xs)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    letterSpacing: '0.01em',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
                >
                  Submit for Review
                </button>
              )}
              {review.status === 'revision_requested' && (
                <button
                  onClick={() => onRevise?.(review.contentReviewId)}
                  style={{
                    padding: 'var(--space-2) var(--space-4)',
                    background: 'var(--color-accent)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-xs)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    letterSpacing: '0.01em',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
                >
                  Revise & Resubmit
                </button>
              )}
            </>
          ) : (
            <>
              {(review.status === 'submitted' || review.status === 'revised') && (
                <>
                  <button
                    onClick={() => onApprove?.(review.contentReviewId)}
                    style={{
                      padding: 'var(--space-2) var(--space-4)',
                      background: 'var(--color-success)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--font-xs)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => onRequestRevision?.(review.contentReviewId)}
                    style={{
                      padding: 'var(--space-2) var(--space-4)',
                      background: 'transparent',
                      color: '#f97316',
                      border: '1px solid rgba(249, 115, 22, 0.3)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--font-xs)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#f97316'; e.currentTarget.style.background = 'rgba(249, 115, 22, 0.08)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(249, 115, 22, 0.3)'; e.currentTarget.style.background = 'transparent'; }}
                  >
                    Request Revision
                  </button>
                  <button
                    onClick={() => onReject?.(review.contentReviewId)}
                    style={{
                      padding: 'var(--space-2) var(--space-4)',
                      background: 'transparent',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--font-xs)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)'; e.currentTarget.style.background = 'transparent'; }}
                  >
                    Reject
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
});

/* ─── Reason Modal (for revision request / reject) ──────────────────────────── */

function ReasonModal({
  isOpen,
  title,
  placeholder,
  confirmLabel,
  confirmColor,
  onConfirm,
  onClose,
}: {
  isOpen: boolean;
  title: string;
  placeholder: string;
  confirmLabel: string;
  confirmColor: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        animation: 'fadeSlideIn 0.2s ease both',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--color-bgPrimary)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--color-border)',
        width: '100%',
        maxWidth: '480px',
        boxShadow: 'var(--shadow-xl)',
        padding: 'var(--space-6)',
        animation: 'fadeSlideIn 0.3s ease both',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--font-lg)',
            fontWeight: 700,
            color: 'var(--color-textPrimary)',
            letterSpacing: '-0.01em',
          }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-textMuted)',
              fontSize: '20px',
              cursor: 'pointer',
              padding: 'var(--space-1)',
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>

        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={placeholder}
          rows={4}
          style={{
            width: '100%',
            padding: 'var(--space-3)',
            background: 'var(--color-bgSurface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-textPrimary)',
            fontSize: 'var(--font-sm)',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
            resize: 'vertical',
            lineHeight: 1.5,
          }}
          autoFocus
        />

        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-textMuted)',
              fontSize: 'var(--font-sm)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!reason.trim()}
            onClick={() => {
              onConfirm(reason.trim());
              setReason('');
              onClose();
            }}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              background: confirmColor,
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: '#fff',
              fontSize: 'var(--font-sm)',
              fontWeight: 600,
              cursor: 'pointer',
              opacity: !reason.trim() ? 0.5 : 1,
              transition: 'all var(--transition-fast)',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Publish Modal (URL input for marking content as published) ──────────── */

function PublishModal({
  isOpen,
  onConfirm,
  onClose,
}: {
  isOpen: boolean;
  onConfirm: (url: string) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState('');

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        animation: 'fadeSlideIn 0.2s ease both',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--color-bgPrimary)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--color-border)',
        width: '100%',
        maxWidth: '480px',
        boxShadow: 'var(--shadow-xl)',
        padding: 'var(--space-6)',
        animation: 'fadeSlideIn 0.3s ease both',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--font-lg)',
            fontWeight: 700,
            color: 'var(--color-textPrimary)',
            letterSpacing: '-0.01em',
          }}>
            Mark as Published
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-textMuted)',
              fontSize: '20px',
              cursor: 'pointer',
              padding: 'var(--space-1)',
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>

        <p style={{
          margin: '0 0 var(--space-3)',
          fontSize: 'var(--font-sm)',
          color: 'var(--color-textSecondary)',
          lineHeight: 1.5,
        }}>
          Enter the live URL where this content was published.
        </p>

        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://instagram.com/reel/..."
          style={{
            width: '100%',
            padding: 'var(--space-3)',
            background: 'var(--color-bgSurface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-textPrimary)',
            fontSize: 'var(--font-sm)',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
            lineHeight: 1.5,
          }}
          autoFocus
        />

        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-textMuted)',
              fontSize: 'var(--font-sm)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!url.trim()}
            onClick={() => {
              onConfirm(url.trim());
              setUrl('');
              onClose();
            }}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              background: '#10b981',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: '#fff',
              fontSize: 'var(--font-sm)',
              fontWeight: 600,
              cursor: 'pointer',
              opacity: !url.trim() ? 0.5 : 1,
              transition: 'all var(--transition-fast)',
            }}
          >
            Confirm Published
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Create Review Form ────────────────────────────────────────────────────── */

function CreateReviewForm({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    platform: 'instagram' as ContentPlatform,
    contentType: 'reel' as ContentType,
    contentUrl: '',
    caption: '',
    hashtags: '',
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (isDemoMode()) return;
      return api.post('/api/content-reviews', form);
    },
    onSuccess: () => {
      onCreated();
      onClose();
      setForm({
        platform: 'instagram',
        contentType: 'reel',
        contentUrl: '',
        caption: '',
        hashtags: '',
      });
    },
  });

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: 'var(--space-3)',
    background: 'var(--color-bgSurface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-textPrimary)',
    fontSize: 'var(--font-sm)',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    transition: 'border-color var(--transition-fast)',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--font-xs)',
    fontWeight: 600,
    color: 'var(--color-textMuted)',
    display: 'block',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        animation: 'fadeSlideIn 0.2s ease both',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--color-bgPrimary)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--color-border)',
          width: '100%',
          maxWidth: '540px',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-xl)',
          padding: 'var(--space-6)',
          animation: 'fadeSlideIn 0.3s ease both',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
          <h2 style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--font-xl)',
            fontWeight: 700,
            color: 'var(--color-textPrimary)',
            letterSpacing: '-0.01em',
          }}>
            New Content Draft
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-textMuted)',
              fontSize: '20px',
              cursor: 'pointer',
              padding: 'var(--space-1)',
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Platform & Content Type Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={labelStyle}>Platform</label>
              <select
                value={form.platform}
                onChange={(e) => setForm((prev) => ({ ...prev, platform: e.target.value as ContentPlatform }))}
                style={inputStyle}
              >
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="youtube">YouTube</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Content Type</label>
              <select
                value={form.contentType}
                onChange={(e) => setForm((prev) => ({ ...prev, contentType: e.target.value as ContentType }))}
                style={inputStyle}
              >
                <option value="reel">Reel</option>
                <option value="post">Post</option>
                <option value="story">Story</option>
                <option value="tiktok">TikTok</option>
                <option value="shorts">Shorts</option>
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Content URL</label>
            <input
              type="url"
              value={form.contentUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, contentUrl: e.target.value }))}
              placeholder="https://instagram.com/p/..."
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Caption</label>
            <textarea
              value={form.caption}
              onChange={(e) => setForm((prev) => ({ ...prev, caption: e.target.value }))}
              placeholder="Write your caption..."
              rows={4}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
              maxLength={500}
            />
            <div style={{
              fontSize: '11px',
              color: 'var(--color-textMuted)',
              textAlign: 'right',
              marginTop: '4px',
            }}>
              {form.caption.length}/500
            </div>
          </div>

          <div>
            <label style={labelStyle}>Hashtags</label>
            <input
              type="text"
              value={form.hashtags}
              onChange={(e) => setForm((prev) => ({ ...prev, hashtags: e.target.value }))}
              placeholder="#restaurant #foodie #nyc"
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', marginTop: 'var(--space-5)' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-textMuted)',
              fontSize: 'var(--font-sm)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!form.caption || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              background: 'var(--color-accent)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: '#fff',
              fontSize: 'var(--font-sm)',
              fontWeight: 600,
              cursor: 'pointer',
              opacity: !form.caption ? 0.5 : 1,
              transition: 'all var(--transition-fast)',
              boxShadow: form.caption ? 'var(--shadow-glow)' : 'none',
            }}
          >
            {createMutation.isPending ? 'Creating...' : 'Create Draft'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────────────────────────── */

type TabType = 'all' | 'drafts' | 'pending' | 'approved' | 'published' | 'rejected';

const TABS: { key: TabType; label: string; icon: string }[] = [
  { key: 'all',       label: 'All Content', icon: '📋' },
  { key: 'drafts',    label: 'Drafts',      icon: '📝' },
  { key: 'pending',   label: 'Pending',     icon: '📤' },
  { key: 'approved',  label: 'Approved',    icon: '✅' },
  { key: 'published', label: 'Published',   icon: '🚀' },
  { key: 'rejected',  label: 'Rejected',    icon: '❌' },
];

export default function ContentReviewManager() {
  const [tab, setTab] = useState<TabType>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [revisionModal, setRevisionModal] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<string | null>(null);
  const [publishModal, setPublishModal] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { userId } = useAuth();

  const reviewsQuery = useQuery({
    queryKey: ['content-reviews', userId],
    queryFn: async () => {
      if (isDemoMode()) return DEMO_REVIEWS;
      const res = await api.get<{ reviews: ContentReview[] }>('/api/content-reviews');
      return res.data?.reviews || [];
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const submitMutation = useMutation({
    mutationFn: async (id: string) => {
      if (isDemoMode()) return;
      return api.put(`/api/content-reviews/${id}/submit`, {});
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['content-reviews'] }),
    onError: (err: Error) => logger.error('Content review submit failed', { mutation: 'submit', err }),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      if (isDemoMode()) return;
      return api.put(`/api/content-reviews/${id}/approve`, {});
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['content-reviews'] }),
    onError: (err: Error) => logger.error('Content review approve failed', { mutation: 'approve', err }),
  });

  const requestRevisionMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      if (isDemoMode()) return;
      return api.put(`/api/content-reviews/${id}/request-revision`, { reason });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['content-reviews'] }),
    onError: (err: Error) => logger.error('Content revision request failed', { mutation: 'requestRevision', err }),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      if (isDemoMode()) return;
      return api.put(`/api/content-reviews/${id}/reject`, { reason });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['content-reviews'] }),
    onError: (err: Error) => logger.error('Content review reject failed', { mutation: 'reject', err }),
  });

  const publishMutation = useMutation({
    mutationFn: async ({ id, publishedUrl }: { id: string; publishedUrl: string }) => {
      if (isDemoMode()) return;
      return api.put(`/api/content-reviews/${id}/publish`, { publishedUrl });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['content-reviews'] }),
    onError: (err: Error) => logger.error('Content publish failed', { mutation: 'publish', err }),
  });

  const fetchMetricsMutation = useMutation({
    mutationFn: async (id: string) => {
      if (isDemoMode()) return;
      return api.post(`/api/content-reviews/${id}/fetch-metrics`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['content-reviews'] }),
    onError: (err: Error) => logger.error('Fetch metrics failed', { mutation: 'fetchMetrics', err }),
  });

  const reviews = reviewsQuery.data || [];
  const isLoading = reviewsQuery.isLoading;

  // Stats
  const stats = {
    total: reviews.length,
    drafts: reviews.filter((r) => r.status === 'draft').length,
    pending: reviews.filter((r) => ['submitted', 'revised', 'revision_requested'].includes(r.status)).length,
    approved: reviews.filter((r) => r.status === 'approved').length,
    published: reviews.filter((r) => r.status === 'published').length,
    rejected: reviews.filter((r) => r.status === 'rejected').length,
  };

  // Filter by tab
  const filtered = reviews.filter((r) => {
    if (tab === 'all') return true;
    if (tab === 'drafts') return r.status === 'draft';
    if (tab === 'pending') return ['submitted', 'revised', 'revision_requested'].includes(r.status);
    if (tab === 'approved') return r.status === 'approved';
    if (tab === 'published') return r.status === 'published';
    if (tab === 'rejected') return r.status === 'rejected';
    return true;
  });

  const statCards = [
    { label: 'Total Content', value: stats.total, color: 'var(--color-accent)' },
    { label: 'Drafts', value: stats.drafts, color: '#9ca3af' },
    { label: 'Pending Review', value: stats.pending, color: '#3b82f6' },
    { label: 'Approved', value: stats.approved, color: 'var(--color-success)' },
    { label: 'Published', value: stats.published, color: '#10b981' },
    { label: 'Rejected', value: stats.rejected, color: 'var(--color-error)' },
  ];

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 'var(--space-6)',
        gap: 'var(--space-4)',
      }}>
        <div>
          <h1 style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--font-2xl)',
            fontWeight: 700,
            color: 'var(--color-textPrimary)',
            letterSpacing: '-0.02em',
          }}>
            Content Reviews
          </h1>
          <p style={{
            margin: 'var(--space-2) 0 0',
            fontSize: 'var(--font-sm)',
            color: 'var(--color-textSecondary)',
            lineHeight: 1.5,
          }}>
            Manage your content drafts, track submissions, and review approvals.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          style={{
            padding: 'var(--space-3) var(--space-5)',
            background: 'var(--color-accent)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            color: '#fff',
            fontSize: 'var(--font-sm)',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all var(--transition-fast)',
            boxShadow: 'var(--shadow-glow)',
            letterSpacing: '0.01em',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
        >
          + New Draft
        </button>
      </div>

      {/* Stat Cards */}
      {!isLoading && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}>
          {statCards.map((stat, i) => (
            <div key={stat.label} style={{
              background: 'var(--color-bgSecondary)',
              border: '1px solid var(--color-border)',
              borderLeft: `3px solid ${stat.color}`,
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-5)',
              animation: 'fadeSlideIn 0.4s ease both',
              animationDelay: `${i * 60}ms`,
            }}>
              <div style={{
                fontSize: 'var(--font-xs)',
                fontWeight: 600,
                color: 'var(--color-textMuted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 'var(--space-2)',
              }}>
                {stat.label}
              </div>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--font-3xl)',
                fontWeight: 800,
                color: 'var(--color-textPrimary)',
                lineHeight: 1.2,
                letterSpacing: '-0.02em',
              }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-5)',
          borderBottom: '2px solid var(--color-border)',
          paddingBottom: 'var(--space-2)',
          overflowX: 'auto',
        }}
        role="tablist"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: 'var(--space-3) var(--space-5)',
              background: tab === t.key ? 'var(--color-accent)' : 'transparent',
              color: tab === t.key ? '#fff' : 'var(--color-textSecondary)',
              border: tab === t.key ? 'none' : '1px solid transparent',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-sm)',
              fontWeight: tab === t.key ? 600 : 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all var(--transition-fast)',
              letterSpacing: '0.01em',
              whiteSpace: 'nowrap',
            }}
          >
            {t.icon} {t.label}
            {tab !== t.key && t.key !== 'all' && (
              <span style={{
                marginLeft: '6px',
                padding: '1px 6px',
                borderRadius: 'var(--radius-full)',
                fontSize: '11px',
                fontWeight: 600,
                background: 'var(--color-bgElevated)',
                color: 'var(--color-textMuted)',
              }}>
                {t.key === 'drafts' ? stats.drafts :
                 t.key === 'pending' ? stats.pending :
                 t.key === 'approved' ? stats.approved :
                 t.key === 'published' ? stats.published :
                 stats.rejected}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: '140px',
                background: 'var(--color-bgSecondary)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: 'var(--space-12) var(--space-6)',
          background: 'var(--color-bgSecondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Warm gradient overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(249, 115, 22, 0.03) 0%, transparent 60%)',
            pointerEvents: 'none',
          }} />

          <div style={{
            fontSize: '64px',
            marginBottom: 'var(--space-4)',
            animation: 'float 3s ease-in-out infinite',
            display: 'inline-block',
            position: 'relative',
          }}>
            {tab === 'drafts' ? '📝' : tab === 'pending' ? '📤' : tab === 'approved' ? '🎉' : tab === 'published' ? '🚀' : tab === 'rejected' ? '📦' : '🎬'}
          </div>

          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--font-xl)',
            fontWeight: 700,
            color: 'var(--color-textPrimary)',
            margin: '0 0 var(--space-2)',
            letterSpacing: '-0.01em',
            position: 'relative',
          }}>
            {tab === 'drafts' ? 'No drafts yet' :
             tab === 'pending' ? 'No pending reviews' :
             tab === 'approved' ? 'No approved content' :
             tab === 'published' ? 'No published content' :
             tab === 'rejected' ? 'No rejected content' :
             'No content yet'}
          </h3>

          <p style={{
            fontSize: 'var(--font-sm)',
            color: 'var(--color-textSecondary)',
            maxWidth: '360px',
            margin: '0 auto',
            lineHeight: 1.6,
            position: 'relative',
            marginBottom: 'var(--space-5)',
          }}>
            {tab === 'drafts' ? 'Start creating content drafts and submit them for partner review.' :
             tab === 'pending' ? 'All submissions have been reviewed. Nice work!' :
             tab === 'approved' ? 'Your approved content will appear here once partners sign off.' :
             tab === 'published' ? 'Mark approved content as published to track engagement metrics.' :
             tab === 'rejected' ? 'Rejected submissions with feedback will show here.' :
             'Create your first content draft to kick off the review process.'}
          </p>

          {(tab === 'all' || tab === 'drafts') && (
            <button
              onClick={() => setShowCreate(true)}
              style={{
                padding: 'var(--space-3) var(--space-5)',
                background: 'var(--color-accent)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                color: '#fff',
                fontSize: 'var(--font-sm)',
                fontWeight: 600,
                cursor: 'pointer',
                position: 'relative',
                boxShadow: 'var(--shadow-glow)',
                transition: 'all var(--transition-fast)',
                letterSpacing: '0.01em',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
            >
              + Create Your First Draft
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }} role="tabpanel">
          {filtered.map((review, i) => (
            <ContentCard
              key={review.contentReviewId}
              review={review}
              isCreatorView={true}
              index={i}
              onSubmit={(id) => submitMutation.mutate(id)}
              onRevise={(id) => submitMutation.mutate(id)}
              onApprove={(id) => approveMutation.mutate(id)}
              onRequestRevision={(id) => setRevisionModal(id)}
              onReject={(id) => setRejectModal(id)}
              onPublish={(id) => setPublishModal(id)}
              onFetchMetrics={(id) => fetchMetricsMutation.mutate(id)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <CreateReviewForm
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ['content-reviews'] })}
      />

      <ReasonModal
        isOpen={!!revisionModal}
        title="Request Revision"
        placeholder="Explain what changes you'd like the creator to make..."
        confirmLabel="Send Revision Request"
        confirmColor="#f97316"
        onConfirm={(reason) => {
          if (revisionModal) requestRevisionMutation.mutate({ id: revisionModal, reason });
        }}
        onClose={() => setRevisionModal(null)}
      />

      <ReasonModal
        isOpen={!!rejectModal}
        title="Reject Content"
        placeholder="Explain why this content is being rejected..."
        confirmLabel="Reject Content"
        confirmColor="#ef4444"
        onConfirm={(reason) => {
          if (rejectModal) rejectMutation.mutate({ id: rejectModal, reason });
        }}
        onClose={() => setRejectModal(null)}
      />

      <PublishModal
        isOpen={!!publishModal}
        onConfirm={(url) => {
          if (publishModal) publishMutation.mutate({ id: publishModal, publishedUrl: url });
        }}
        onClose={() => setPublishModal(null)}
      />
    </div>
  );
}
