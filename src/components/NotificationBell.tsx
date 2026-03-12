import { useState, useRef, useEffect, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/ApiService';
import { isDemoMode } from '../data/demoData';
import type { Notification, NotificationType } from '../types';

/* ─── Demo Data ────────────────────────────────────────────────────────────── */

function demoISO(minutesAgo: number): string {
  return new Date(Date.now() - minutesAgo * 60000).toISOString();
}

const DEMO_NOTIFICATIONS: Notification[] = [
  {
    notificationId: 'n1',
    userId: 'demo',
    type: 'proposal_received',
    title: 'New Proposal from Rasika',
    body: 'Rasika wants to partner on a weeknight dinner campaign.',
    link: '/app/proposals',
    isRead: false,
    createdAt: demoISO(15),
  },
  {
    notificationId: 'n2',
    userId: 'demo',
    type: 'offer_approved',
    title: 'Deal Approved!',
    body: 'Le Diplomate approved your 15% off QR code deal.',
    link: '/app/offers',
    isRead: false,
    createdAt: demoISO(120),
  },
  {
    notificationId: 'n3',
    userId: 'demo',
    type: 'raffle_entry',
    title: 'Raffle Milestone',
    body: 'Your Rasika raffle just hit 100 entries!',
    link: '/app/raffles',
    isRead: false,
    createdAt: demoISO(360),
  },
  {
    notificationId: 'n4',
    userId: 'demo',
    type: 'proposal_accepted',
    title: 'Proposal Accepted',
    body: "Bad Saint accepted your tasting menu proposal. Let's go!",
    link: '/app/proposals',
    isRead: true,
    createdAt: demoISO(1440),
  },
  {
    notificationId: 'n5',
    userId: 'demo',
    type: 'qr_milestone',
    title: 'QR Scans Milestone',
    body: "Your Rose's Luxury QR code hit 500 scans this month.",
    link: '/app/offers',
    isRead: true,
    createdAt: demoISO(2880),
  },
];

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

const TYPE_ICONS: Record<NotificationType, string> = {
  proposal_received: '📩',
  proposal_accepted: '✅',
  proposal_declined: '❌',
  proposal_countered: '🔄',
  offer_approval_requested: '📋',
  offer_approved: '🤝',
  offer_rejected: '🚫',
  offer_paused: '⏸️',
  raffle_entry: '🎟️',
  raffle_winner: '🏆',
  qr_milestone: '📈',
  proposal_expiring: '⏰',
  content_review_submitted: '📝',
  content_review_revision_requested: '🔄',
  content_review_approved: '✅',
  content_review_rejected: '❌',
};

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString();
}

/* ─── NotificationItem ─────────────────────────────────────────────────────── */

const NotificationItem = memo(function NotificationItem({
  notification,
  onClick,
}: {
  notification: Notification;
  onClick: (n: Notification) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(notification)}
      style={{
        display: 'flex',
        gap: 12,
        padding: '12px 16px',
        background: notification.isRead ? 'transparent' : 'rgba(255, 107, 53, 0.06)',
        border: 'none',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = notification.isRead
          ? 'transparent'
          : 'rgba(255, 107, 53, 0.06)';
      }}
    >
      <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>
        {TYPE_ICONS[notification.type] || '🔔'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13,
          fontWeight: notification.isRead ? 400 : 600,
          color: notification.isRead ? 'rgba(255,255,255,0.6)' : '#fff',
          marginBottom: 2,
        }}>
          {notification.title}
        </div>
        <div style={{
          fontSize: 12,
          color: 'rgba(255,255,255,0.45)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {notification.body}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
          {timeAgo(notification.createdAt)}
        </div>
      </div>
      {!notification.isRead && (
        <span style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#ff6b35',
          flexShrink: 0,
          marginTop: 6,
        }} />
      )}
    </button>
  );
});

/* ─── Main Component ───────────────────────────────────────────────────────── */

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Fetch notifications
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      if (isDemoMode()) return { notifications: DEMO_NOTIFICATIONS, unreadCount: 3 };
      const res = await api.get('/api/notifications?limit=20');
      if (res.status !== 'success') return { notifications: [], unreadCount: 0 };
      return res.data as { notifications: Notification[]; unreadCount: number };
    },
    refetchInterval: 60000, // Poll every 60s
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  // Mark all as read
  const markAllRead = useMutation({
    mutationFn: async () => {
      if (isDemoMode()) return;
      await api.put('/api/notifications/read', { markAll: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const handleNotificationClick = (n: Notification) => {
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        style={{
          position: 'relative',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 20,
          padding: 8,
          color: 'rgba(255,255,255,0.7)',
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fff'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)'; }}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: 4,
            right: 4,
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            background: '#ff6b35',
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          width: 360,
          maxHeight: 480,
          background: 'var(--color-surface, #1a1a2e)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 14,
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          zIndex: 1000,
          animation: 'notifSlideIn 0.15s ease-out',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-accent, #ff6b35)',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: 'rgba(255,255,255,0.4)',
                fontSize: 14,
              }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔕</div>
                No notifications yet
              </div>
            ) : (
              notifications.map(n => (
                <NotificationItem
                  key={n.notificationId}
                  notification={n}
                  onClick={handleNotificationClick}
                />
              ))
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes notifSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
