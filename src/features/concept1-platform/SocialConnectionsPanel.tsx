import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/ApiService';
import { useAuth } from '../../hooks/useAuth';
import { isDemoMode } from '../../data/demoData';
import type { SocialConnection, SocialConnectResponse, ContentPlatform } from '../../types';

/* ─── Demo Data ─────────────────────────────────────────────────────────────── */

const DEMO_CONNECTIONS: SocialConnection[] = [
  {
    platform: 'instagram',
    status: 'connected',
    username: 'spotcreator',
    displayName: 'Spot Creator',
    followerCount: 12500,
    connectedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    environment: 'development',
  },
  {
    platform: 'tiktok',
    status: 'disconnected',
  },
  {
    platform: 'youtube',
    status: 'disconnected',
  },
];

/* ─── Platform Config ──────────────────────────────────────────────────────── */

const PLATFORM_CONFIG: Record<ContentPlatform, {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  description: string;
}> = {
  instagram: {
    label: 'Instagram',
    icon: '📸',
    color: '#E1306C',
    bgColor: 'rgba(225, 48, 108, 0.1)',
    description: 'Connect your Instagram Business or Creator account to track post engagement.',
  },
  tiktok: {
    label: 'TikTok',
    icon: '🎵',
    color: '#00F2EA',
    bgColor: 'rgba(0, 242, 234, 0.1)',
    description: 'Connect your TikTok account to track video performance and follower growth.',
  },
  youtube: {
    label: 'YouTube',
    icon: '▶️',
    color: '#FF0000',
    bgColor: 'rgba(255, 0, 0, 0.1)',
    description: 'Connect your YouTube channel to track video views and subscriber metrics.',
  },
};

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function formatFollowers(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return String(count);
}

/* ─── Component ────────────────────────────────────────────────────────────── */

export default function SocialConnectionsPanel() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const [connectingPlatform, setConnectingPlatform] = useState<ContentPlatform | null>(null);

  const { data: connections = [], isLoading, isError, error, refetch } = useQuery<SocialConnection[]>({
    queryKey: ['social-connections', userId],
    queryFn: async () => {
      if (isDemoMode()) return DEMO_CONNECTIONS;
      const res = await api.get<SocialConnection[]>('/api/social/connections');
      return res.data || [];
    },
  });

  const connectMutation = useMutation({
    mutationFn: async (platform: ContentPlatform) => {
      setConnectingPlatform(platform);
      const res = await api.post<SocialConnectResponse>(`/api/social/connect/${platform}`);
      if (!res.data) throw new Error('Failed to initiate connection');

      if (res.data.mode === 'development') {
        // Dev mode: call callback directly with mock code
        await api.get(`/api/social/callback/${platform}?code=MOCK_CODE&state=${res.data.state}`);
        return { mode: 'development' };
      }
      // Production: redirect to OAuth URL
      window.location.href = res.data.authorizationUrl;
      return { mode: 'production' };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-connections'] });
      setConnectingPlatform(null);
    },
    onError: () => {
      setConnectingPlatform(null);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (platform: ContentPlatform) => {
      if (isDemoMode()) return;
      return api.put(`/api/social/disconnect/${platform}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-connections'] });
    },
  });

  const getConnection = (platform: ContentPlatform): SocialConnection | undefined => {
    return connections.find((c) => c.platform === platform);
  };

  if (isLoading) {
    return (
      <div className="page-container">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{
              height: 120,
              borderRadius: 'var(--radius-lg)',
              background: 'var(--color-bgSecondary)',
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page-container">
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--font-2xl)',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: 'var(--color-textPrimary)',
          marginBottom: 'var(--space-2)',
        }}>
          Social Accounts
        </h1>
        <p style={{
          color: 'var(--color-textMuted)',
          fontSize: 'var(--font-sm)',
          marginBottom: 'var(--space-6)',
        }}>
          Connect your social media accounts to track content performance and engagement metrics.
        </p>

        <div style={{
          padding: 'var(--space-4)',
          background: 'var(--color-errorMuted)',
          color: 'var(--color-error)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-sm)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>{(error as Error)?.message || 'Unable to load your social connections. Please try again.'}</span>
          <button
            className="btn btn-ghost"
            onClick={() => refetch()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <h1 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--font-2xl)',
        fontWeight: 700,
        letterSpacing: '-0.02em',
        color: 'var(--color-textPrimary)',
        marginBottom: 'var(--space-2)',
      }}>
        Social Accounts
      </h1>
      <p style={{
        color: 'var(--color-textMuted)',
        fontSize: 'var(--font-sm)',
        marginBottom: 'var(--space-6)',
      }}>
        Connect your social media accounts to track content performance and engagement metrics.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {(['instagram', 'tiktok', 'youtube'] as ContentPlatform[]).map((platform, idx) => {
          const config = PLATFORM_CONFIG[platform];
          const conn = getConnection(platform);
          const isConnected = conn?.status === 'connected';
          const isConnecting = connectingPlatform === platform;
          const isDisconnecting = disconnectMutation.isPending && disconnectMutation.variables === platform;

          return (
            <div
              key={platform}
              style={{
                background: 'var(--color-bgCard)',
                border: `1px solid ${isConnected ? config.color + '40' : 'var(--color-border)'}`,
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-5)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-4)',
                transition: 'all 0.2s ease',
                animation: `fadeSlideIn 0.4s ease both`,
                animationDelay: `${idx * 80}ms`,
              }}
            >
              {/* Platform Icon */}
              <div style={{
                width: 56,
                height: 56,
                borderRadius: 'var(--radius-md)',
                background: config.bgColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                flexShrink: 0,
              }}>
                {config.icon}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 2 }}>
                  <span style={{
                    fontWeight: 600,
                    fontSize: 'var(--font-base)',
                    color: 'var(--color-textPrimary)',
                  }}>
                    {config.label}
                  </span>
                  {isConnected && (
                    <span style={{
                      fontSize: 'var(--font-xs)',
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                      fontWeight: 600,
                    }}>
                      Connected
                    </span>
                  )}
                  {isConnected && conn?.environment === 'development' && (
                    <span style={{
                      fontSize: 'var(--font-xs)',
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: 'rgba(251, 191, 36, 0.15)',
                      color: '#fbbf24',
                      fontWeight: 600,
                    }}>
                      Dev
                    </span>
                  )}
                </div>

                {isConnected && conn?.username ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--color-textSecondary)', fontSize: 'var(--font-sm)' }}>
                      @{conn.username}
                    </span>
                    {conn.followerCount != null && (
                      <span style={{ color: 'var(--color-textMuted)', fontSize: 'var(--font-xs)' }}>
                        {formatFollowers(conn.followerCount)} followers
                      </span>
                    )}
                    {conn.connectedAt && (
                      <span style={{ color: 'var(--color-textMuted)', fontSize: 'var(--font-xs)' }}>
                        Connected {new Date(conn.connectedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                ) : (
                  <p style={{
                    color: 'var(--color-textMuted)',
                    fontSize: 'var(--font-xs)',
                    margin: 0,
                    lineHeight: 1.4,
                  }}>
                    {config.description}
                  </p>
                )}
              </div>

              {/* Action Button */}
              {isConnected ? (
                <button
                  onClick={() => disconnectMutation.mutate(platform)}
                  disabled={isDisconnecting}
                  style={{
                    padding: '8px 20px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    background: 'rgba(239, 68, 68, 0.08)',
                    color: '#ef4444',
                    fontSize: 'var(--font-sm)',
                    fontWeight: 600,
                    cursor: isDisconnecting ? 'not-allowed' : 'pointer',
                    opacity: isDisconnecting ? 0.6 : 1,
                    transition: 'all 0.15s ease',
                    flexShrink: 0,
                  }}
                >
                  {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
              ) : (
                <button
                  onClick={() => connectMutation.mutate(platform)}
                  disabled={isConnecting || connectMutation.isPending}
                  style={{
                    padding: '8px 20px',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    background: config.color,
                    color: '#fff',
                    fontSize: 'var(--font-sm)',
                    fontWeight: 600,
                    cursor: (isConnecting || connectMutation.isPending) ? 'not-allowed' : 'pointer',
                    opacity: (isConnecting || connectMutation.isPending) ? 0.6 : 1,
                    transition: 'all 0.15s ease',
                    flexShrink: 0,
                  }}
                >
                  {isConnecting ? 'Connecting...' : 'Connect'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Info section */}
      <div style={{
        marginTop: 'var(--space-6)',
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius-md)',
        background: 'rgba(99, 102, 241, 0.06)',
        border: '1px solid rgba(99, 102, 241, 0.15)',
      }}>
        <p style={{
          color: 'var(--color-textSecondary)',
          fontSize: 'var(--font-sm)',
          margin: 0,
          lineHeight: 1.6,
        }}>
          <strong style={{ color: 'var(--color-textPrimary)' }}>Why connect?</strong> Linking your social accounts lets you track engagement metrics on published content reviews — likes, comments, shares, and impressions — all from your Spot dashboard.
        </p>
      </div>
    </div>
  );
}
