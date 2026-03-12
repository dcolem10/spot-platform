import { useState, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/ApiService';
import { useAuth } from '../../hooks/useAuth';
import { isDemoMode } from '../../data/demoData';
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
];

/* ─── Status Colors ─────────────────────────────────────────────────────────── */

const STATUS_COLORS: Record<ContentReviewStatus, { bg: string; color: string; label: string }> = {
  draft: { bg: 'rgba(107, 114, 128, 0.15)', color: '#9ca3af', label: 'Draft' },
  submitted: { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', label: 'Submitted' },
  revision_requested: { bg: 'rgba(249, 115, 22, 0.15)', color: '#f97316', label: 'Revision Requested' },
  revised: { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', label: 'Revised' },
  approved: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', label: 'Approved' },
  rejected: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', label: 'Rejected' },
};

const PLATFORM_COLORS: Record<ContentPlatform, { bg: string; color: string; label: string }> = {
  instagram: { bg: 'rgba(225, 48, 108, 0.15)', color: '#E1306C', label: 'Instagram' },
  tiktok: { bg: 'rgba(0, 0, 0, 0.08)', color: '#000', label: 'TikTok' },
  youtube: { bg: 'rgba(255, 0, 0, 0.15)', color: '#FF0000', label: 'YouTube' },
};

/* ─── Sub-components ────────────────────────────────────────────────────────── */

const ContentCard = memo(function ContentCard({
  review,
  isCreatorView,
  onSubmit,
  onRevise,
  onApprove,
  onRequestRevision,
  onReject,
}: {
  review: ContentReview;
  isCreatorView: boolean;
  onSubmit?: (id: string) => void;
  onRevise?: (id: string) => void;
  onApprove?: (id: string) => void;
  onRequestRevision?: (id: string) => void;
  onReject?: (id: string) => void;
}) {
  const statusConfig = STATUS_COLORS[review.status];
  const platformConfig = PLATFORM_COLORS[review.platform];

  return (
    <div style={{
      padding: 'var(--space-4)',
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      transition: 'box-shadow var(--transition-fast)',
    }}>
      {/* Header: Badges and Restaurant */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 'var(--space-3)',
        marginBottom: 'var(--space-3)',
      }}>
        <div>
          <h3 style={{
            margin: 0,
            fontSize: 'var(--font-md)',
            fontWeight: 600,
            color: 'var(--color-text)',
            marginBottom: 'var(--space-1)',
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
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              fontSize: 'var(--font-xs)',
              fontWeight: 600,
              background: platformConfig.bg,
              color: platformConfig.color,
            }}>
              {platformConfig.label}
            </span>
            <span style={{
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              fontSize: 'var(--font-xs)',
              fontWeight: 600,
              background: statusConfig.bg,
              color: statusConfig.color,
              textTransform: 'capitalize',
            }}>
              {statusConfig.label}
            </span>
            {review.contentType && (
              <span style={{
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--font-xs)',
                color: 'var(--color-text-muted)',
                background: 'var(--color-bg)',
                textTransform: 'capitalize',
              }}>
                {review.contentType}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Caption */}
      <p style={{
        margin: 0,
        fontSize: 'var(--font-sm)',
        color: 'var(--color-text)',
        lineHeight: 1.5,
        marginBottom: 'var(--space-3)',
      }}>
        {review.caption}
      </p>

      {/* Hashtags */}
      {review.hashtagsProposed?.join(' ') && (
        <p style={{
          margin: 0,
          fontSize: 'var(--font-xs)',
          color: 'var(--color-primary)',
          marginBottom: 'var(--space-3)',
          wordBreak: 'break-word',
        }}>
          {review.hashtagsProposed?.join(' ')}
        </p>
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
              color: 'var(--color-primary)',
              textDecoration: 'none',
              wordBreak: 'break-all',
            }}
          >
            {review.contentUrl}
          </a>
        </div>
      )}

      {/* Revision Request Reason */}
      {review.revisionHistory?.[review.revisionHistory.length - 1]?.reason && (
        <div style={{
          padding: 'var(--space-3)',
          background: 'rgba(249, 115, 22, 0.08)',
          borderLeft: '2px solid #f97316',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--space-3)',
        }}>
          <div style={{
            fontSize: 'var(--font-xs)',
            fontWeight: 600,
            color: '#f97316',
            marginBottom: 'var(--space-1)',
          }}>
            Revision Request
          </div>
          <div style={{
            fontSize: 'var(--font-sm)',
            color: 'var(--color-text)',
            lineHeight: 1.4,
          }}>
            {review.revisionHistory?.[review.revisionHistory.length - 1]?.reason}
          </div>
        </div>
      )}

      {/* Rejection Reason */}
      {review.rejectionReason && (
        <div style={{
          padding: 'var(--space-3)',
          background: 'rgba(239, 68, 68, 0.08)',
          borderLeft: '2px solid #ef4444',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--space-3)',
        }}>
          <div style={{
            fontSize: 'var(--font-xs)',
            fontWeight: 600,
            color: '#ef4444',
            marginBottom: 'var(--space-1)',
          }}>
            Rejection Reason
          </div>
          <div style={{
            fontSize: 'var(--font-sm)',
            color: 'var(--color-text)',
            lineHeight: 1.4,
          }}>
            {review.rejectionReason}
          </div>
        </div>
      )}

      {/* Timestamps */}
      <div style={{
        display: 'flex',
        gap: 'var(--space-4)',
        fontSize: 'var(--font-xs)',
        color: 'var(--color-text-muted)',
        marginBottom: 'var(--space-3)',
      }}>
        {review.submittedAt && (
          <span>Submitted: {new Date(review.submittedAt).toLocaleDateString()}</span>
        )}
        {review.approvedAt && (
          <span>Approved: {new Date(review.approvedAt).toLocaleDateString()}</span>
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
            {review.status === 'draft' && (
              <button
                onClick={() => onSubmit?.(review.contentReviewId)}
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  background: 'var(--color-primary)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-xs)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Submit for Review
              </button>
            )}
            {review.status === 'revision_requested' && (
              <button
                onClick={() => onRevise?.(review.contentReviewId)}
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  background: 'var(--color-primary)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-xs)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Revise & Resubmit
              </button>
            )}
          </>
        ) : (
          <>
            {review.status === 'submitted' && (
              <>
                <button
                  onClick={() => onApprove?.(review.contentReviewId)}
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    background: 'var(--color-success)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-xs)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Approve
                </button>
                <button
                  onClick={() => onRequestRevision?.(review.contentReviewId)}
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    background: 'transparent',
                    color: 'var(--color-warning)',
                    border: '1px solid var(--color-warning)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-xs)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Request Revision
                </button>
                <button
                  onClick={() => onReject?.(review.contentReviewId)}
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    background: 'transparent',
                    color: 'var(--color-danger)',
                    border: '1px solid var(--color-danger)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-xs)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Reject
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
});

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
    padding: 'var(--space-2) var(--space-3)',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text)',
    fontSize: 'var(--font-sm)',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
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
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--color-bg)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--color-border)',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-xl)',
          padding: 'var(--space-5)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--font-lg)', color: 'var(--color-text)' }}>
            Create Draft Review
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted)',
              fontSize: '20px',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div>
            <label style={{
              fontSize: 'var(--font-xs)',
              color: 'var(--color-text-muted)',
              display: 'block',
              marginBottom: '4px',
            }}>
              Platform *
            </label>
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
            <label style={{
              fontSize: 'var(--font-xs)',
              color: 'var(--color-text-muted)',
              display: 'block',
              marginBottom: '4px',
            }}>
              Content Type *
            </label>
            <select
              value={form.contentType}
              onChange={(e) => setForm((prev) => ({ ...prev, contentType: e.target.value as ContentType }))}
              style={inputStyle}
            >
              <option value="reel">Reel</option>
              <option value="post">Post</option>
              <option value="story">Story</option>
              <option value="short">Short</option>
              <option value="shorts">Shorts</option>
            </select>
          </div>

          <div>
            <label style={{
              fontSize: 'var(--font-xs)',
              color: 'var(--color-text-muted)',
              display: 'block',
              marginBottom: '4px',
            }}>
              Content URL
            </label>
            <input
              type="url"
              value={form.contentUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, contentUrl: e.target.value }))}
              placeholder="https://instagram.com/p/..."
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{
              fontSize: 'var(--font-xs)',
              color: 'var(--color-text-muted)',
              display: 'block',
              marginBottom: '4px',
            }}>
              Caption *
            </label>
            <textarea
              value={form.caption}
              onChange={(e) => setForm((prev) => ({ ...prev, caption: e.target.value }))}
              placeholder="Write your caption..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
              maxLength={500}
            />
          </div>

          <div>
            <label style={{
              fontSize: 'var(--font-xs)',
              color: 'var(--color-text-muted)',
              display: 'block',
              marginBottom: '4px',
            }}>
              Hashtags
            </label>
            <input
              type="text"
              value={form.hashtags}
              onChange={(e) => setForm((prev) => ({ ...prev, hashtags: e.target.value }))}
              placeholder="#restaurant #foodie #nyc"
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-muted)',
              fontSize: 'var(--font-sm)',
              cursor: 'pointer',
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
              background: 'var(--color-primary)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: '#fff',
              fontSize: 'var(--font-sm)',
              fontWeight: 600,
              cursor: 'pointer',
              opacity: !form.caption ? 0.5 : 1,
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

export default function ContentReviewManager() {
  const [tab, setTab] = useState<'drafts' | 'inbox' | 'archive'>('drafts');
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();
  const { userId } = useAuth();

  const draftsQuery = useQuery({
    queryKey: ['content-reviews', userId, 'my-drafts'],
    queryFn: async () => {
      if (isDemoMode()) return DEMO_REVIEWS;
      const res = await api.get<{ reviews: ContentReview[] }>('/api/content-reviews');
      return res.data?.reviews || [];
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const inboxQuery = useQuery({
    queryKey: ['content-reviews', userId, 'inbox'],
    queryFn: async () => {
      if (isDemoMode()) return DEMO_REVIEWS;
      const res = await api.get<{ reviews: ContentReview[] }>('/api/content-reviews?inbox=true');
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
    onError: (err: Error) => console.error('Submit failed:', err.message),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      if (isDemoMode()) return;
      return api.put(`/api/content-reviews/${id}/approve`, {});
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['content-reviews'] }),
    onError: (err: Error) => console.error('Approve failed:', err.message),
  });

  const requestRevisionMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      if (isDemoMode()) return;
      return api.put(`/api/content-reviews/${id}/request-revision`, { reason });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['content-reviews'] }),
    onError: (err: Error) => console.error('Revision request failed:', err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      if (isDemoMode()) return;
      return api.put(`/api/content-reviews/${id}/reject`, { reason });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['content-reviews'] }),
    onError: (err: Error) => console.error('Reject failed:', err.message),
  });

  const reviews = tab === 'inbox' ? inboxQuery.data || [] : draftsQuery.data || [];
  const isLoading = tab === 'inbox' ? inboxQuery.isLoading : draftsQuery.isLoading;

  const filtered = reviews.filter((r) => {
    if (tab === 'drafts') return r.status === 'draft';
    if (tab === 'inbox') return ['submitted', 'revised'].includes(r.status);
    return ['approved', 'rejected', 'revision_requested'].includes(r.status);
  });

  const isCreatorView = tab !== 'inbox';

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--space-5)',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--font-xl)', color: 'var(--color-text)' }}>
            Content Review Manager
          </h1>
          <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-sm)', color: 'var(--color-text-muted)' }}>
            {isCreatorView ? 'Manage your social content drafts and submissions.' : 'Review creator content submissions.'}
          </p>
        </div>
        {isCreatorView && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              background: 'var(--color-primary)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: '#fff',
              fontSize: 'var(--font-sm)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + New Draft
          </button>
        )}
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-1)',
          marginBottom: 'var(--space-4)',
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: 'var(--space-1)',
        }}
        role="tablist"
      >
        {isCreatorView ? (
          <>
            <button
              role="tab"
              aria-selected={tab === 'drafts'}
              onClick={() => setTab('drafts')}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                background: tab === 'drafts' ? 'var(--color-primary)' : 'transparent',
                color: tab === 'drafts' ? '#fff' : 'var(--color-text-muted)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-sm)',
                fontWeight: tab === 'drafts' ? 600 : 400,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              My Drafts
            </button>
            <button
              role="tab"
              aria-selected={tab === 'archive'}
              onClick={() => setTab('archive')}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                background: tab === 'archive' ? 'var(--color-primary)' : 'transparent',
                color: tab === 'archive' ? '#fff' : 'var(--color-text-muted)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-sm)',
                fontWeight: tab === 'archive' ? 600 : 400,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Archive
            </button>
          </>
        ) : (
          <button
            role="tab"
            aria-selected={tab === 'inbox'}
            onClick={() => setTab('inbox')}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              background: tab === 'inbox' ? 'var(--color-primary)' : 'transparent',
              color: tab === 'inbox' ? '#fff' : 'var(--color-text-muted)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-sm)',
              fontWeight: tab === 'inbox' ? 600 : 400,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Inbox
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: '120px',
                background: 'var(--color-surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8) var(--space-4)', color: 'var(--color-text-muted)' }}>
          <div style={{ fontSize: '48px', marginBottom: 'var(--space-3)' }}>
            {tab === 'drafts' ? '✏️' : tab === 'inbox' ? '📥' : '📦'}
          </div>
          <div style={{ fontSize: 'var(--font-md)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
            {tab === 'drafts'
              ? 'No drafts yet'
              : tab === 'inbox'
              ? 'No pending reviews'
              : 'No archived content'}
          </div>
          <div style={{ fontSize: 'var(--font-sm)' }}>
            {tab === 'drafts'
              ? 'Create your first draft to get started.'
              : tab === 'inbox'
              ? 'All submissions have been reviewed.'
              : 'Your approved and rejected content will appear here.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }} role="tabpanel">
          {filtered.map((review) => (
            <ContentCard
              key={review.contentReviewId}
              review={review}
              isCreatorView={isCreatorView}
              onSubmit={(id) => submitMutation.mutate(id)}
              onRevise={(id) => {
                // In a real app, this would open a form to update the content
                submitMutation.mutate(id);
              }}
              onApprove={(id) => approveMutation.mutate(id)}
              onRequestRevision={(id) => {
                // In a real app, this would open a modal for reason
                requestRevisionMutation.mutate({
                  id,
                  reason: 'Please make revisions and resubmit.',
                });
              }}
              onReject={(id) => {
                // In a real app, this would open a modal for reason
                rejectMutation.mutate({
                  id,
                  reason: 'This content does not meet our guidelines.',
                });
              }}
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
    </div>
  );
}
