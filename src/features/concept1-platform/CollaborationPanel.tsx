import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { api } from '../../services/ApiService';
import { isDemoMode } from '../../data/demoData';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';

const DEMO_COLLABORATORS = [
  {
    campaignId: 'c1',
    collaboratorId: 'creator-2',
    status: 'accepted' as const,
    role: 'co-creator' as const,
    sharePercent: 50,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    campaignId: 'c1',
    collaboratorId: 'creator-3',
    status: 'pending' as const,
    role: 'co-creator' as const,
    sharePercent: 30,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const DEMO_MY_COLLABS = [
  {
    campaignId: 'c5',
    campaignName: 'Rasika',
    status: 'accepted' as const,
    role: 'co-creator' as const,
    sharePercent: 40,
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

interface Collaborator {
  campaignId: string;
  collaboratorId?: string;
  campaignName?: string;
  invitedBy?: string;
  status: 'pending' | 'accepted' | 'declined';
  role: 'co-creator' | 'viewer';
  sharePercent: number;
  createdAt: string;
}

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (creatorId: string, sharePercent: number) => void;
  isLoading: boolean;
}

function InviteModal({ isOpen, onClose, onSubmit, isLoading }: InviteModalProps) {
  const [creatorId, setCreatorId] = useState('');
  const [sharePercent, setSharePercent] = useState(50);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!creatorId.trim()) return;
    onSubmit(creatorId.trim(), sharePercent);
    setCreatorId('');
    setSharePercent(50);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '400px',
          width: '90%',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#1B2838', fontSize: '18px', fontWeight: 600 }}>
          Invite Collaborator
        </h3>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '6px', color: '#1B2838', fontSize: '14px', fontWeight: 500 }}>
            Creator ID
          </label>
          <input
            type="text"
            value={creatorId}
            onChange={(e) => setCreatorId(e.target.value)}
            placeholder="Enter creator ID"
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ccc',
              borderRadius: '6px',
              fontSize: '14px',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '6px', color: '#1B2838', fontSize: '14px', fontWeight: 500 }}>
            Revenue Share: {sharePercent}%
          </label>
          <input
            type="range"
            min="1"
            max="99"
            value={sharePercent}
            onChange={(e) => setSharePercent(Number(e.target.value))}
            style={{
              width: '100%',
              cursor: 'pointer',
            }}
          />
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
            Your share: {100 - sharePercent}%
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={isLoading}
            style={{
              padding: '10px 16px',
              border: '1px solid #ccc',
              borderRadius: '6px',
              backgroundColor: '#f5f5f5',
              color: '#333',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!creatorId.trim() || isLoading}
            style={{
              padding: '10px 16px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: '#E8673C',
              color: '#fff',
              cursor: creatorId.trim() && !isLoading ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              fontWeight: 600,
              opacity: creatorId.trim() && !isLoading ? 1 : 0.6,
            }}
          >
            {isLoading ? 'Sending...' : 'Send Invite'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface StatusBadgeProps {
  status: 'pending' | 'accepted' | 'declined';
}

function StatusBadge({ status }: StatusBadgeProps) {
  const styles = {
    pending: { backgroundColor: '#FFF4E6', color: '#D97706' },
    accepted: { backgroundColor: '#DBEAFE', color: '#0284C7' },
    declined: { backgroundColor: '#FEE2E2', color: '#DC2626' },
  };

  const style = styles[status];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 12px',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: 600,
        backgroundColor: style.backgroundColor,
        color: style.color,
        textTransform: 'capitalize',
      }}
    >
      {status}
    </span>
  );
}

interface RevenueSplitChartProps {
  collaborators: Collaborator[];
}

function RevenueSplitChart({ collaborators }: RevenueSplitChartProps) {
  const acceptedCollabs = collaborators.filter((c) => c.status === 'accepted');
  if (acceptedCollabs.length === 0) {
    return (
      <div
        style={{
          padding: '16px',
          backgroundColor: '#f9fafb',
          borderRadius: '6px',
          textAlign: 'center',
          color: '#666',
          fontSize: '14px',
        }}
      >
        No active collaborations
      </div>
    );
  }

  const total = acceptedCollabs.reduce((sum, c) => sum + c.sharePercent, 0) + 100;
  const myShare = 100;

  const segments = [
    { label: 'You', share: myShare, color: '#E8673C' },
    ...acceptedCollabs.map((c) => ({
      label: c.collaboratorId || 'Unknown',
      share: c.sharePercent,
      color: '#94A3B8',
    })),
  ];

  const percentages = segments.map((s) => (s.share / total) * 100);

  return (
    <div style={{ marginTop: '16px' }}>
      <h4 style={{ margin: '0 0 12px 0', color: '#1B2838', fontSize: '14px', fontWeight: 600 }}>
        Revenue Split (Active Collaborators)
      </h4>
      <div
        style={{
          display: 'flex',
          height: '32px',
          borderRadius: '6px',
          overflow: 'hidden',
          backgroundColor: '#f0f0f0',
        }}
      >
        {segments.map((seg, idx) => (
          <div
            key={idx}
            style={{
              flex: percentages[idx],
              backgroundColor: seg.color,
              position: 'relative',
            }}
            title={`${seg.label}: ${seg.share}%`}
          />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '12px', fontSize: '13px' }}>
        {segments.map((seg, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: seg.color, borderRadius: '2px' }} />
            <span style={{ color: '#666' }}>
              {seg.label}: {seg.share}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CollaborationPanel() {
  const { id: campaignId } = useParams<{ id?: string }>();
  const queryClient = useQueryClient();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'collaborators' | 'myCollabs'>('collaborators');

  // Collaborators for current campaign
  const { data: collaborators, isLoading: collabsLoading } = useQuery({
    queryKey: ['collaborators', campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      if (isDemoMode) return DEMO_COLLABORATORS;
      const res = await api.get<Collaborator[]>(`/api/campaigns/${campaignId}/collaborators`);
      if (res.error) throw new Error(res.error);
      return res.data ?? [];
    },
    enabled: !!campaignId,
  });

  // Campaigns where user is a collaborator
  const { data: myCollabs, isLoading: myCollabsLoading } = useQuery({
    queryKey: ['myCollaborations'],
    queryFn: async () => {
      if (isDemoMode) return DEMO_MY_COLLABS;
      const res = await api.get<Collaborator[]>('/api/campaigns/collaborations');
      if (res.error) throw new Error(res.error);
      return res.data ?? [];
    },
  });

  // Pending invitations for current user
  const pendingInvites = myCollabs?.filter((c) => c.status === 'pending') ?? [];

  const inviteMutation = useMutation({
    mutationFn: async ({ creatorId, sharePercent }: { creatorId: string; sharePercent: number }) => {
      if (!campaignId) throw new Error('Campaign ID required');
      const res = await api.post(`/api/campaigns/${campaignId}/collaborators`, {
        creatorId,
        role: 'co-creator',
        sharePercent,
      });
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators', campaignId] });
      setShowInviteModal(false);
    },
  });

  const respondMutation = useMutation({
    mutationFn: async ({ accept }: { accept: boolean }) => {
      if (!campaignId) throw new Error('Campaign ID required');
      const res = await api.put(`/api/campaigns/${campaignId}/collaborators/respond`, { accept });
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myCollaborations'] });
    },
  });

  const removeCollabMutation = useMutation({
    mutationFn: async (creatorId: string) => {
      if (!campaignId) throw new Error('Campaign ID required');
      const res = await api.delete(`/api/campaigns/${campaignId}/collaborators/${creatorId}`);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators', campaignId] });
    },
  });

  const collabList = collaborators ?? [];

  if (!campaignId && activeTab === 'collaborators') {
    return (
      <div style={{ padding: '24px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
        <p style={{ color: '#666', margin: 0 }}>Select a campaign to manage collaborations</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e5e7eb' }}>
        <button
          onClick={() => setActiveTab('collaborators')}
          disabled={!campaignId}
          style={{
            padding: '12px 16px',
            border: 'none',
            backgroundColor: 'transparent',
            color: activeTab === 'collaborators' ? '#E8673C' : '#666',
            borderBottom: activeTab === 'collaborators' ? '3px solid #E8673C' : 'none',
            cursor: campaignId ? 'pointer' : 'not-allowed',
            fontSize: '14px',
            fontWeight: 600,
            opacity: campaignId ? 1 : 0.5,
          }}
        >
          Campaign Collaborators
        </button>
        <button
          onClick={() => setActiveTab('myCollabs')}
          style={{
            padding: '12px 16px',
            border: 'none',
            backgroundColor: 'transparent',
            color: activeTab === 'myCollabs' ? '#E8673C' : '#666',
            borderBottom: activeTab === 'myCollabs' ? '3px solid #E8673C' : 'none',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          My Collaborations ({pendingInvites.length > 0 ? `${pendingInvites.length}` : '0'})
        </button>
      </div>

      {/* Campaign Collaborators Tab */}
      {activeTab === 'collaborators' && campaignId && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, color: '#1B2838', fontSize: '16px', fontWeight: 600 }}>Collaborators</h3>
            <button
              onClick={() => setShowInviteModal(true)}
              disabled={collabList.length >= 5}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: '#E8673C',
                color: '#fff',
                cursor: collabList.length >= 5 ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                opacity: collabList.length >= 5 ? 0.5 : 1,
              }}
            >
              Invite Collaborator
            </button>
          </div>

          {collabsLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <LoadingSkeleton height="60px" />
              <LoadingSkeleton height="60px" />
            </div>
          ) : collabList.length === 0 ? (
            <div
              style={{
                padding: '20px',
                backgroundColor: '#f9fafb',
                borderRadius: '6px',
                textAlign: 'center',
                color: '#666',
              }}
            >
              No collaborators yet. Invite someone to get started.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {collabList.map((collab) => (
                <div
                  key={collab.collaboratorId}
                  style={{
                    padding: '12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    backgroundColor: '#fff',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ color: '#1B2838', fontSize: '14px', fontWeight: 500 }}>
                      {collab.collaboratorId || 'Unknown'}
                    </div>
                    <div style={{ color: '#666', fontSize: '13px', marginTop: '4px' }}>
                      Share: {collab.sharePercent}%
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <StatusBadge status={collab.status} />
                    {collab.status === 'accepted' && (
                      <button
                        onClick={() => removeCollabMutation.mutate(collab.collaboratorId!)}
                        disabled={removeCollabMutation.isPending}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #fee2e2',
                          borderRadius: '4px',
                          backgroundColor: '#fef2f2',
                          color: '#dc2626',
                          cursor: removeCollabMutation.isPending ? 'not-allowed' : 'pointer',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {collabList.length > 0 && <RevenueSplitChart collaborators={collabList} />}
        </div>
      )}

      {/* My Collaborations Tab */}
      {activeTab === 'myCollabs' && (
        <div>
          <h3 style={{ margin: '0 0 16px 0', color: '#1B2838', fontSize: '16px', fontWeight: 600 }}>
            Campaigns I'm Collaborating On
          </h3>

          {myCollabsLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <LoadingSkeleton height="60px" />
              <LoadingSkeleton height="60px" />
            </div>
          ) : !myCollabs || myCollabs.length === 0 ? (
            <div
              style={{
                padding: '20px',
                backgroundColor: '#f9fafb',
                borderRadius: '6px',
                textAlign: 'center',
                color: '#666',
              }}
            >
              No collaborations yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {myCollabs.map((collab) => (
                <div
                  key={collab.campaignName}
                  style={{
                    padding: '12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    backgroundColor: '#fff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#1B2838', fontSize: '14px', fontWeight: 600 }}>
                        {collab.campaignName || 'Unknown Campaign'}
                      </div>
                      <div style={{ color: '#666', fontSize: '13px', marginTop: '4px' }}>
                        Your share: {collab.sharePercent}%
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <StatusBadge status={collab.status} />
                      {collab.status === 'pending' && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => respondMutation.mutate({ accept: true })}
                            disabled={respondMutation.isPending}
                            style={{
                              padding: '6px 12px',
                              border: 'none',
                              borderRadius: '4px',
                              backgroundColor: '#DBEAFE',
                              color: '#0284C7',
                              cursor: respondMutation.isPending ? 'not-allowed' : 'pointer',
                              fontSize: '12px',
                              fontWeight: 600,
                            }}
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => respondMutation.mutate({ accept: false })}
                            disabled={respondMutation.isPending}
                            style={{
                              padding: '6px 12px',
                              border: '1px solid #fee2e2',
                              borderRadius: '4px',
                              backgroundColor: '#fef2f2',
                              color: '#dc2626',
                              cursor: respondMutation.isPending ? 'not-allowed' : 'pointer',
                              fontSize: '12px',
                              fontWeight: 600,
                            }}
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <InviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onSubmit={(creatorId, sharePercent) => inviteMutation.mutate({ creatorId, sharePercent })}
        isLoading={inviteMutation.isPending}
      />
    </div>
  );
}
