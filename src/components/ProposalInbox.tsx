import { useState, memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/ApiService';
import { isDemoMode } from '../data/demoData';
import ProposalWizard from './ProposalWizard';
import type { Proposal, ProposalStatus, ProposalType } from '../types';

/* ─── Demo Data ─────────────────────────────────────────────────────────────── */

function demoISO(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString();
}

const DEMO_PROPOSALS: Proposal[] = [
  {
    proposalId: 'prop-1',
    proposalType: 'deal',
    initiatedBy: 'restaurant',
    initiatorId: 'rest-rasika',
    targetId: 'creator-demo',
    initiatorName: 'Rasika',
    targetName: 'Demo Creator',
    status: 'pending',
    terms: {
      dealType: 'discount',
      discountPercent: 15,
      duration: '30 days',
      deliverables: '2 Reels + 3 Stories',
      budget: 500,
      description: "We are launching our new spring tasting menu and would love your coverage. 15% off for your followers + $500 flat fee.",
    },
    counterTerms: null,
    expiresAt: demoISO(5),
    messages: [],
    createdAt: demoISO(-2),
    updatedAt: demoISO(-2),
  },
  {
    proposalId: 'prop-2',
    proposalType: 'qr_code',
    initiatedBy: 'restaurant',
    initiatorId: 'rest-le-diplomate',
    targetId: 'creator-demo',
    initiatorName: 'Le Diplomate',
    targetName: 'Demo Creator',
    status: 'pending',
    terms: {
      dealType: 'qr_tracked',
      discountPercent: 20,
      redemptionLimit: 100,
      blackoutDates: ['2026-03-14', '2026-03-15'],
      description: "QR code deal: 20% off brunch for your audience. Limited to 100 redemptions. No Valentine's weekend.",
    },
    counterTerms: null,
    expiresAt: demoISO(4),
    messages: [
      { from: 'rest-le-diplomate', text: 'Would love to partner on our brunch series!', timestamp: demoISO(-1) },
    ],
    createdAt: demoISO(-1),
    updatedAt: demoISO(-1),
  },
  {
    proposalId: 'prop-3',
    proposalType: 'campaign',
    initiatedBy: 'creator',
    initiatorId: 'creator-demo',
    targetId: 'rest-bad-saint',
    initiatorName: 'Demo Creator',
    targetName: 'Bad Saint',
    status: 'countered',
    terms: {
      dealType: 'flat_fee',
      budget: 750,
      deliverables: '1 Reel + 2 Stories + 1 TikTok',
      duration: '2 weeks',
      description: "I would love to feature your kamayan feast for my Filipino food series.",
    },
    counterTerms: {
      budget: 500,
      deliverables: '1 Reel + 3 Stories',
      duration: '2 weeks',
      note: "We can do $500 + a complimentary dinner for two. Would that work?",
    },
    expiresAt: demoISO(3),
    messages: [
      { from: 'creator-demo', text: 'Your kamayan feast would be perfect for my series!', timestamp: demoISO(-3) },
      { from: 'rest-bad-saint', text: "We would love to work together! Counter-offer: $500 + dinner for two.", timestamp: demoISO(-2) },
    ],
    createdAt: demoISO(-3),
    updatedAt: demoISO(-2),
  },
  {
    proposalId: 'prop-4',
    proposalType: 'deal',
    initiatedBy: 'creator',
    initiatorId: 'creator-demo',
    targetId: 'rest-tail-up-goat',
    initiatorName: 'Demo Creator',
    targetName: 'Tail Up Goat',
    status: 'accepted',
    terms: {
      dealType: 'revenue_share',
      revenueSharePercent: 8,
      deliverables: '2 Reels + 1 Post',
      duration: '60 days',
      description: 'Revenue share partnership: 8% of tracked redemptions over 60 days.',
    },
    counterTerms: null,
    expiresAt: demoISO(30),
    acceptedAt: demoISO(-1),
    messages: [],
    createdAt: demoISO(-5),
    updatedAt: demoISO(-1),
  },
  {
    proposalId: 'prop-5',
    proposalType: 'deal',
    initiatedBy: 'restaurant',
    initiatorId: 'rest-compass-rose',
    targetId: 'creator-demo',
    initiatorName: 'Compass Rose',
    targetName: 'Demo Creator',
    status: 'declined',
    terms: {
      dealType: 'barter',
      description: 'Free dinner for two in exchange for 1 Instagram post.',
    },
    counterTerms: null,
    expiresAt: demoISO(-2),
    declineReason: "Budget does not align with deliverable expectations.",
    messages: [],
    createdAt: demoISO(-8),
    updatedAt: demoISO(-5),
  },
];

/* ─── Helpers ───────────────────────────────────────────────────────────────── */

const STATUS_COLORS: Record<ProposalStatus, string> = {
  pending: 'var(--color-warning, #f59e0b)',
  accepted: 'var(--color-success, #10b981)',
  countered: 'var(--color-accent, #6366f1)',
  declined: 'var(--color-error, #ef4444)',
  expired: 'var(--color-textMuted, #6b7280)',
};

const STATUS_LABELS: Record<ProposalStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  countered: 'Countered',
  declined: 'Declined',
  expired: 'Expired',
};

const TYPE_LABELS: Record<ProposalType, string> = {
  deal: 'Deal Proposal',
  campaign: 'Campaign Partnership',
  qr_code: 'QR Code Deal',
  content_review: 'Content Review',
};

const TYPE_ICONS: Record<ProposalType, string> = {
  deal: '🤝',
  campaign: '📈',
  qr_code: '📱',
  content_review: '📝',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

/* ─── Sub-components ────────────────────────────────────────────────────────── */

interface ProposalCardProps {
  proposal: Proposal;
  viewAs: 'initiator' | 'target';
  onSelect: (p: Proposal) => void;
}

const ProposalCard = memo(function ProposalCard({ proposal, viewAs, onSelect }: ProposalCardProps) {
  const isIncoming = viewAs === 'target';
  const partnerName = isIncoming ? proposal.initiatorName : proposal.targetName;
  const expiryDays = daysUntil(proposal.expiresAt);

  return (
    <button
      type="button"
      onClick={() => onSelect(proposal)}
      style={{
        display: 'flex',
        gap: 'var(--space-4)',
        padding: 'var(--space-4)',
        background: 'var(--color-bgElevated)',
        border: proposal.status === 'pending' && isIncoming
          ? '1px solid var(--color-accent)'
          : '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left',
        fontFamily: 'inherit',
        transition: 'box-shadow var(--transition-fast), border-color var(--transition-fast)',
        boxShadow: proposal.status === 'pending' && isIncoming
          ? '0 0 0 2px var(--color-accentMuted)'
          : 'none',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = proposal.status === 'pending' && isIncoming
          ? '0 0 0 2px var(--color-accentMuted)' : 'none';
      }}
    >
      {/* Icon */}
      <div style={{
        fontSize: '24px',
        width: '40px',
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bgPrimary)',
        borderRadius: 'var(--radius-md)',
        flexShrink: 0,
      }}>
        {TYPE_ICONS[proposal.proposalType]}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '2px' }}>
          <span style={{
            fontWeight: 600,
            color: 'var(--color-textPrimary)',
            fontSize: 'var(--font-sm)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {partnerName}
          </span>
          <span style={{
            fontSize: 'var(--font-xs)',
            color: 'var(--color-textMuted)',
            flexShrink: 0,
          }}>
            · {timeAgo(proposal.createdAt)}
          </span>
        </div>

        <div style={{
          fontSize: 'var(--font-xs)',
          color: 'var(--color-textSecondary)',
          marginBottom: 'var(--space-2)',
        }}>
          {TYPE_LABELS[proposal.proposalType]}
          {isIncoming ? ' — wants to partner with you' : ' — your proposal'}
        </div>

        {/* Terms summary */}
        {typeof proposal.terms.description === 'string' && proposal.terms.description && (
          <div style={{
            fontSize: 'var(--font-xs)',
            color: 'var(--color-textMuted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '400px',
          }}>
            {proposal.terms.description.slice(0, 120)}
          </div>
        )}
      </div>

      {/* Status + Expiry */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--space-1)', flexShrink: 0 }}>
        <span style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: 'var(--radius-full)',
          fontSize: 'var(--font-xs)',
          fontWeight: 600,
          background: `${STATUS_COLORS[proposal.status]}22`,
          color: STATUS_COLORS[proposal.status],
        }}>
          {STATUS_LABELS[proposal.status]}
        </span>
        {proposal.status === 'pending' && expiryDays > 0 && (
          <span style={{
            fontSize: '11px',
            color: expiryDays <= 2 ? 'var(--color-error, #ef4444)' : 'var(--color-textMuted)',
          }}>
            {expiryDays}d left
          </span>
        )}
        {proposal.messages.length > 0 && (
          <span style={{ fontSize: '11px', color: 'var(--color-textMuted)' }}>
            💬 {proposal.messages.length}
          </span>
        )}
      </div>
    </button>
  );
});

/* ─── Proposal Detail Modal ──────────────────────────────────────────────── */

interface ProposalDetailProps {
  proposal: Proposal;
  viewAs: 'initiator' | 'target';
  onClose: () => void;
  onAccept: (id: string) => void;
  onDecline: (id: string, reason: string) => void;
  onCounter: (id: string, terms: Record<string, unknown>) => void;
  onMessage: (id: string, text: string) => void;
  isActing: boolean;
}

function ProposalDetail({
  proposal,
  viewAs,
  onClose,
  onAccept,
  onDecline,
  onCounter,
  onMessage,
  isActing,
}: ProposalDetailProps) {
  const [showCounter, setShowCounter] = useState(false);
  const [counterNote, setCounterNote] = useState('');
  const [counterBudget, setCounterBudget] = useState(String(proposal.terms.budget || ''));
  const [counterDeliverables, setCounterDeliverables] = useState(String(proposal.terms.deliverables || ''));
  const [declineReason, setDeclineReason] = useState('');
  const [showDecline, setShowDecline] = useState(false);
  const [messageText, setMessageText] = useState('');

  const isTarget = viewAs === 'target';
  const canAct = isTarget && (proposal.status === 'pending' || proposal.status === 'countered');
  const partnerName = isTarget ? proposal.initiatorName : proposal.targetName;

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
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--color-bgSecondary)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--color-border)',
        width: 'calc(100% - 48px)',
        maxWidth: '620px',
        maxHeight: '85vh',
        overflowY: 'auto',
        boxShadow: 'var(--shadow-xl)',
        margin: '0 24px',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-6) var(--space-6) var(--space-4)',
          borderBottom: '1px solid var(--color-border)',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <span style={{ fontSize: '24px' }}>{TYPE_ICONS[proposal.proposalType]}</span>
              <h2 style={{
                margin: 0,
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--font-xl)',
                fontWeight: 700,
                color: 'var(--color-textPrimary)',
                letterSpacing: '-0.01em',
              }}>
                {TYPE_LABELS[proposal.proposalType]}
              </h2>
            </div>
            <div style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textMuted)', marginTop: 'var(--space-1)' }}>
              {isTarget ? `From ${partnerName}` : `To ${partnerName}`} · {timeAgo(proposal.createdAt)}
            </div>
          </div>
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
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Status Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          padding: 'var(--space-4) var(--space-6)',
          background: `${STATUS_COLORS[proposal.status]}11`,
          borderBottom: '1px solid var(--color-border)',
        }}>
          <span style={{
            display: 'inline-block',
            padding: '3px 10px',
            borderRadius: 'var(--radius-full)',
            fontSize: 'var(--font-xs)',
            fontWeight: 600,
            background: `${STATUS_COLORS[proposal.status]}22`,
            color: STATUS_COLORS[proposal.status],
          }}>
            {STATUS_LABELS[proposal.status]}
          </span>
          {proposal.status === 'pending' && (
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)' }}>
              Expires in {daysUntil(proposal.expiresAt)} days
            </span>
          )}
          {proposal.acceptedAt && (
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)' }}>
              Accepted {timeAgo(proposal.acceptedAt)}
            </span>
          )}
        </div>

        {/* Terms */}
        <div style={{ padding: 'var(--space-5) var(--space-6)' }}>
          <h3 style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--font-sm)', color: 'var(--color-textSecondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Terms
          </h3>
          <div style={{
            background: 'var(--color-bgElevated)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            border: '1px solid var(--color-border)',
          }}>
            {Object.entries(proposal.terms).map(([key, val]) => (
              <div key={key} style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: 'var(--space-2) 0',
                borderBottom: '1px solid var(--color-border)',
                fontSize: 'var(--font-sm)',
              }}>
                <span style={{ color: 'var(--color-textMuted)', textTransform: 'capitalize' }}>
                  {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}
                </span>
                <span style={{
                  color: 'var(--color-textPrimary)',
                  fontWeight: 500,
                  maxWidth: '60%',
                  textAlign: 'right',
                  wordBreak: 'break-word',
                }}>
                  {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                </span>
              </div>
            ))}
          </div>

          {/* Counter Terms */}
          {proposal.counterTerms && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <h3 style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--font-sm)', color: 'var(--color-accent, #6366f1)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Counter-Offer
              </h3>
              <div style={{
                background: 'var(--color-bgElevated)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-4)',
                border: '1px solid #6366f133',
              }}>
                {Object.entries(proposal.counterTerms).map(([key, val]) => (
                  <div key={key} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: 'var(--space-2) 0',
                    borderBottom: '1px solid var(--color-border)',
                    fontSize: 'var(--font-sm)',
                  }}>
                    <span style={{ color: 'var(--color-textMuted)', textTransform: 'capitalize' }}>
                      {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}
                    </span>
                    <span style={{ color: 'var(--color-textPrimary)', fontWeight: 500, maxWidth: '60%', textAlign: 'right', wordBreak: 'break-word' }}>
                      {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Messages Thread */}
        {proposal.messages.length > 0 && (
          <div style={{ padding: '0 var(--space-6) var(--space-5)' }}>
            <h3 style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--font-sm)', color: 'var(--color-textSecondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Conversation ({proposal.messages.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {proposal.messages.map((msg, i) => {
                const isMe = msg.from === proposal.initiatorId ? viewAs === 'initiator' : viewAs === 'target';
                return (
                  <div key={i} style={{
                    padding: 'var(--space-3)',
                    background: isMe ? 'var(--color-accentMuted)' : 'var(--color-bgElevated)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    maxWidth: '85%',
                    alignSelf: isMe ? 'flex-end' : 'flex-start',
                  }}>
                    <div style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textPrimary)' }}>{msg.text}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-textMuted)', marginTop: '2px' }}>{timeAgo(msg.timestamp)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Message Input */}
        {(proposal.status === 'pending' || proposal.status === 'countered') && (
          <div style={{
            padding: '0 var(--space-6) var(--space-5)',
            display: 'flex',
            gap: 'var(--space-2)',
          }}>
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Send a message..."
              style={{
                flex: 1,
                padding: 'var(--space-2) var(--space-3)',
                background: 'var(--color-bgElevated)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-textPrimary)',
                fontSize: 'var(--font-sm)',
                fontFamily: 'inherit',
                outline: 'none',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && messageText.trim()) {
                  onMessage(proposal.proposalId, messageText.trim());
                  setMessageText('');
                }
              }}
            />
            <button
              type="button"
              disabled={!messageText.trim() || isActing}
              onClick={() => {
                if (messageText.trim()) {
                  onMessage(proposal.proposalId, messageText.trim());
                  setMessageText('');
                }
              }}
              style={{
                padding: 'var(--space-2) var(--space-3)',
                background: 'var(--color-accent)',
                color: 'var(--color-textOnAccent, #fff)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-sm)',
                fontWeight: 600,
                cursor: 'pointer',
                opacity: !messageText.trim() ? 0.5 : 1,
              }}
            >
              Send
            </button>
          </div>
        )}

        {/* Counter Form */}
        {showCounter && (
          <div style={{
            padding: 'var(--space-5) var(--space-6)',
            borderTop: '1px solid var(--color-border)',
            background: '#6366f108',
          }}>
            <h3 style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--font-sm)', color: 'var(--color-accent, #6366f1)' }}>
              Submit Counter-Offer
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <label style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', display: 'block', marginBottom: '4px' }}>Budget ($)</label>
                <input
                  type="number"
                  value={counterBudget}
                  onChange={(e) => setCounterBudget(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 'var(--space-2) var(--space-3)',
                    background: 'var(--color-bgElevated)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-textPrimary)',
                    fontSize: 'var(--font-sm)',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', display: 'block', marginBottom: '4px' }}>Deliverables</label>
                <input
                  type="text"
                  value={counterDeliverables}
                  onChange={(e) => setCounterDeliverables(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 'var(--space-2) var(--space-3)',
                    background: 'var(--color-bgElevated)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-textPrimary)',
                    fontSize: 'var(--font-sm)',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', display: 'block', marginBottom: '4px' }}>Note</label>
                <textarea
                  value={counterNote}
                  onChange={(e) => setCounterNote(e.target.value)}
                  rows={2}
                  style={{
                    width: '100%',
                    padding: 'var(--space-2) var(--space-3)',
                    background: 'var(--color-bgElevated)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-textPrimary)',
                    fontSize: 'var(--font-sm)',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowCounter(false)}
                  style={{
                    padding: 'var(--space-2) var(--space-4)',
                    background: 'transparent',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-textSecondary)',
                    fontSize: 'var(--font-sm)',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isActing}
                  onClick={() => {
                    onCounter(proposal.proposalId, {
                      budget: Number(counterBudget) || undefined,
                      deliverables: counterDeliverables || undefined,
                      note: counterNote || undefined,
                    });
                    setShowCounter(false);
                  }}
                  style={{
                    padding: 'var(--space-2) var(--space-4)',
                    background: 'var(--color-accent, #6366f1)',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-textOnAccent, #fff)',
                    fontSize: 'var(--font-sm)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    opacity: isActing ? 0.6 : 1,
                  }}
                >
                  Submit Counter
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Decline Form */}
        {showDecline && (
          <div style={{
            padding: 'var(--space-5) var(--space-6)',
            borderTop: '1px solid var(--color-border)',
            background: '#ef444408',
          }}>
            <h3 style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--font-sm)', color: 'var(--color-error, #ef4444)' }}>
              Decline Proposal
            </h3>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Reason (optional) — helps the other party understand..."
              rows={2}
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                background: 'var(--color-bgElevated)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-textPrimary)',
                fontSize: 'var(--font-sm)',
                fontFamily: 'inherit',
                resize: 'vertical',
                marginBottom: 'var(--space-3)',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowDecline(false)}
                style={{
                  padding: 'var(--space-2) var(--space-4)',
                  background: 'transparent',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-textSecondary)',
                  fontSize: 'var(--font-sm)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isActing}
                onClick={() => {
                  onDecline(proposal.proposalId, declineReason);
                  setShowDecline(false);
                }}
                style={{
                  padding: 'var(--space-2) var(--space-4)',
                  background: 'var(--color-error, #ef4444)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-textOnAccent, #fff)',
                  fontSize: 'var(--font-sm)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: isActing ? 0.6 : 1,
                }}
              >
                Decline
              </button>
            </div>
          </div>
        )}

        {/* Action Footer */}
        <div style={{
          display: 'flex',
          gap: 'var(--space-3)',
          padding: 'var(--space-5) var(--space-6)',
          borderTop: '1px solid var(--color-border)',
          justifyContent: 'flex-end',
        }}>
          {canAct && !showCounter && !showDecline && (
            <>
              <button
                type="button"
                onClick={() => { setShowDecline(true); setShowCounter(false); }}
                style={{
                  padding: 'var(--space-2) var(--space-4)',
                  background: 'transparent',
                  border: '1px solid var(--color-error, #ef4444)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-error, #ef4444)',
                  fontSize: 'var(--font-sm)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => { setShowCounter(true); setShowDecline(false); }}
                style={{
                  padding: 'var(--space-2) var(--space-4)',
                  background: 'transparent',
                  border: '1px solid var(--color-accent, #6366f1)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-accent, #6366f1)',
                  fontSize: 'var(--font-sm)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Counter
              </button>
              <button
                type="button"
                disabled={isActing}
                onClick={() => onAccept(proposal.proposalId)}
                style={{
                  padding: 'var(--space-2) var(--space-4)',
                  background: 'var(--color-success, #10b981)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-textOnAccent, #fff)',
                  fontSize: 'var(--font-sm)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: isActing ? 0.6 : 1,
                }}
              >
                {isActing ? 'Accepting...' : 'Accept'}
              </button>
            </>
          )}
          {!canAct && !showCounter && !showDecline && (
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                background: 'var(--color-bgElevated)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-textSecondary)',
                fontSize: 'var(--font-sm)',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────────────────────────── */

interface ProposalInboxProps {
  /** Which role is viewing: 'creator' shows proposals TO creator, 'restaurant' shows proposals TO restaurant */
  role: 'creator' | 'restaurant';
}

export default function ProposalInbox({ role }: ProposalInboxProps) {
  const [tab, setTab] = useState<'inbox' | 'sent' | 'all'>('inbox');
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | 'all'>('all');
  const [showWizard, setShowWizard] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // ─── Queries ─────────────────────────────────────────────────────────
  const inboxQuery = useQuery({
    queryKey: ['proposals', 'inbox', role],
    queryFn: async () => {
      if (isDemoMode()) {
        // In demo, show proposals targeted at the current user
        return DEMO_PROPOSALS.filter(p =>
          role === 'creator'
            ? p.targetId === 'creator-demo'
            : p.initiatedBy === 'creator' // restaurants see creator-initiated
        );
      }
      const res = await api.get<{ proposals: Proposal[] }>(`/api/proposals/inbox?role=${role}`);
      return res.data?.proposals || [];
    },
    staleTime: 30_000,
  });

  const sentQuery = useQuery({
    queryKey: ['proposals', 'sent', role],
    queryFn: async () => {
      if (isDemoMode()) {
        return DEMO_PROPOSALS.filter(p =>
          role === 'creator'
            ? p.initiatorId === 'creator-demo'
            : p.initiatedBy === 'restaurant'
        );
      }
      const res = await api.get<{ proposals: Proposal[] }>(`/api/proposals/sent?role=${role}`);
      return res.data?.proposals || [];
    },
    staleTime: 30_000,
  });

  // ─── Mutations ───────────────────────────────────────────────────────
  const acceptMutation = useMutation({
    mutationFn: async (id: string) => {
      if (isDemoMode()) return;
      return api.put(`/api/proposals/${id}/accept`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      setSelectedProposal(null);
    },
  });

  const declineMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      if (isDemoMode()) return;
      return api.put(`/api/proposals/${id}/decline`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      setSelectedProposal(null);
    },
  });

  const counterMutation = useMutation({
    mutationFn: async ({ id, terms }: { id: string; terms: Record<string, unknown> }) => {
      if (isDemoMode()) return;
      return api.put(`/api/proposals/${id}/counter`, { counterTerms: terms });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      setSelectedProposal(null);
    },
  });

  const messageMutation = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      if (isDemoMode()) return;
      return api.post(`/api/proposals/${id}/message`, { text });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: { proposalType: ProposalType; targetId: string; targetName: string; terms: Record<string, unknown> }) => {
      if (isDemoMode()) return;
      const res = await api.post('/api/proposals', payload);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      setShowWizard(false);
      setMutationError(null);
      setTab('sent');
    },
    onError: (err: Error) => {
      setMutationError(`Failed to send proposal: ${err.message}`);
    },
  });

  const handleAccept = useCallback((id: string) => acceptMutation.mutate(id), [acceptMutation]);
  const handleDecline = useCallback((id: string, reason: string) => declineMutation.mutate({ id, reason }), [declineMutation]);
  const handleCounter = useCallback((id: string, terms: Record<string, unknown>) => counterMutation.mutate({ id, terms }), [counterMutation]);
  const handleMessage = useCallback((id: string, text: string) => messageMutation.mutate({ id, text }), [messageMutation]);

  // ─── Computed ────────────────────────────────────────────────────────
  const inboxData = inboxQuery.data || [];
  const sentData = sentQuery.data || [];
  const allData = [...inboxData, ...sentData].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const currentList = tab === 'inbox' ? inboxData : tab === 'sent' ? sentData : allData;
  const filteredList = statusFilter === 'all'
    ? currentList
    : currentList.filter(p => p.status === statusFilter);

  const pendingCount = inboxData.filter(p => p.status === 'pending').length;
  const acceptedCount = allData.filter(p => p.status === 'accepted').length;
  const totalProposals = allData.length;
  const responseRate = sentData.length > 0
    ? Math.round((sentData.filter(p => p.status === 'accepted').length / sentData.length) * 100)
    : 0;
  const isLoading = inboxQuery.isLoading || sentQuery.isLoading;
  const navigate = useNavigate();

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--space-5)',
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
            Partnership Proposals
          </h1>
          <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-sm)', color: 'var(--color-textMuted)' }}>
            {role === 'creator'
              ? 'Review partnership requests from restaurants and manage your proposals.'
              : 'Review proposals from creators and manage partnership requests.'}
          </p>
          <div style={{
            width: '48px',
            height: '3px',
            background: 'linear-gradient(135deg, #f97316, #ef4444)',
            borderRadius: 'var(--radius-full)',
            marginTop: 'var(--space-2)',
          }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {pendingCount > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-4)',
              background: 'color-mix(in srgb, var(--color-warning, #f59e0b) 13%, transparent)',
              borderRadius: 'var(--radius-full)',
              color: 'var(--color-warning, #f59e0b)',
              fontSize: 'var(--font-sm)',
              fontWeight: 600,
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--color-warning, #f59e0b)',
                animation: 'pulse 2s infinite',
              }} />
              {pendingCount} pending
            </div>
          )}
          <button
            type="button"
            onClick={() => { setMutationError(null); setShowWizard(true); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-4)',
              background: 'var(--color-accent)',
              color: 'var(--color-textOnAccent, #fff)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-sm)',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'opacity var(--transition-fast)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            + New Proposal
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
      }}>
        {[
          { label: 'Total Proposals', value: totalProposals, color: 'var(--color-accent, #f97316)' },
          { label: 'Pending', value: pendingCount, color: 'var(--color-warning, #eab308)' },
          { label: 'Active Partnerships', value: acceptedCount, color: 'var(--color-success, #22c55e)' },
          { label: 'Response Rate', value: `${responseRate}%`, color: 'var(--color-info, #3b82f6)' },
        ].map((stat, i) => (
          <div
            key={stat.label}
            style={{
              background: 'var(--color-bgSecondary)',
              border: '1px solid var(--color-border)',
              borderLeft: `3px solid ${stat.color}`,
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-5)',
              animation: 'fadeSlideIn 0.4s ease both',
              animationDelay: `${i * 60}ms`,
            }}
          >
            <div style={{
              fontSize: 'var(--font-xs)',
              fontWeight: 600,
              color: 'var(--color-textMuted)',
              textTransform: 'uppercase' as const,
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

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 'var(--space-2)',
        marginBottom: 'var(--space-4)',
        borderBottom: '2px solid var(--color-border)',
        paddingBottom: 'var(--space-2)',
      }}
        role="tablist"
      >
        {([
          { key: 'inbox' as const, label: 'Inbox', count: inboxData.length },
          { key: 'sent' as const, label: 'Sent', count: sentData.length },
          { key: 'all' as const, label: 'All', count: allData.length },
        ]).map(t => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: 'var(--space-3) var(--space-5)',
              background: tab === t.key ? 'var(--color-accent)' : 'transparent',
              color: tab === t.key ? 'var(--color-textOnAccent, #fff)' : 'var(--color-textSecondary)',
              border: tab === t.key ? 'none' : '1px solid transparent',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-sm)',
              fontWeight: tab === t.key ? 600 : 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all var(--transition-fast)',
              letterSpacing: '0.01em',
            }}
          >
            {t.label}
            {t.count > 0 && (
              <span style={{
                marginLeft: 'var(--space-2)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                fontSize: '11px',
                fontWeight: 600,
                background: tab === t.key ? 'rgba(255,255,255,0.2)' : 'var(--color-bgPrimary)',
              }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Status filter */}
      <div style={{
        display: 'flex',
        gap: 'var(--space-2)',
        marginBottom: 'var(--space-5)',
        flexWrap: 'wrap',
      }}>
        {(['all', 'pending', 'countered', 'accepted', 'declined'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-full)',
              border: statusFilter === s ? 'none' : '1px solid var(--color-border)',
              background: statusFilter === s
                ? s === 'all' ? 'var(--color-textSecondary)' : STATUS_COLORS[s]
                : 'transparent',
              color: statusFilter === s ? 'var(--color-textOnAccent, #fff)' : 'var(--color-textMuted)',
              fontSize: 'var(--font-xs)',
              fontWeight: statusFilter === s ? 600 : 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all var(--transition-fast)',
              letterSpacing: '0.02em',
            }}
          >
            {s === 'all' ? 'All Statuses' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              height: '80px',
              background: 'var(--color-bgElevated)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
          ))}
        </div>
      ) : filteredList.length === 0 ? (
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

          {/* Animated emoji */}
          <div style={{
            fontSize: '64px',
            marginBottom: 'var(--space-4)',
            animation: 'float 3s ease-in-out infinite',
            display: 'inline-block',
            position: 'relative',
          }}>
            📭
          </div>

          <h3 style={{
            margin: '0 0 var(--space-2)',
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--font-xl)',
            fontWeight: 700,
            color: 'var(--color-textPrimary)',
            letterSpacing: '-0.01em',
            position: 'relative',
          }}>
            {tab === 'inbox' ? 'No incoming proposals yet' : tab === 'sent' ? 'No sent proposals yet' : 'No proposals yet'}
          </h3>

          <p style={{
            margin: '0 0 var(--space-6)',
            fontSize: 'var(--font-sm)',
            color: 'var(--color-textSecondary)',
            maxWidth: '360px',
            marginLeft: 'auto',
            marginRight: 'auto',
            lineHeight: 1.6,
            position: 'relative',
          }}>
            {tab === 'inbox'
              ? 'Partnership requests will appear here when restaurants reach out.'
              : 'Proposals you send to restaurants will appear here.'}
          </p>

          <div style={{
            display: 'flex',
            gap: 'var(--space-3)',
            justifyContent: 'center',
            flexWrap: 'wrap',
            position: 'relative',
          }}>
            <button
              type="button"
              onClick={() => { setMutationError(null); setShowWizard(true); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-3) var(--space-6)',
                background: 'var(--color-accent)',
                color: 'var(--color-textOnAccent, #fff)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-sm)',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: '0 0 20px rgba(249, 115, 22, 0.15)',
                transition: 'all var(--transition-fast)',
              }}
            >
              + New Proposal
            </button>
            <button
              type="button"
              onClick={() => navigate('/app/restaurants')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-3) var(--space-6)',
                background: 'transparent',
                color: 'var(--color-textSecondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-sm)',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all var(--transition-fast)',
              }}
            >
              Browse Restaurants
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }} role="tabpanel">
          {filteredList.map(p => (
            <ProposalCard
              key={p.proposalId}
              proposal={p}
              viewAs={
                tab === 'inbox' ? 'target' :
                tab === 'sent' ? 'initiator' :
                (p.initiatorId === 'creator-demo' && role === 'creator') || (p.initiatedBy === 'restaurant' && role === 'restaurant')
                  ? 'initiator' : 'target'
              }
              onSelect={setSelectedProposal}
            />
          ))}
        </div>
      )}

      {/* Quick Action Cards — shown when few proposals */}
      {!isLoading && totalProposals < 3 && (
        <div style={{
          marginTop: 'var(--space-8)',
          padding: 'var(--space-6)',
          background: 'var(--color-bgSecondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
        }}>
          <h3 style={{
            margin: '0 0 var(--space-1)',
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--font-lg)',
            fontWeight: 600,
            color: 'var(--color-textPrimary)',
            letterSpacing: '-0.01em',
          }}>
            Send a Proposal
          </h3>
          <p style={{
            margin: '0 0 var(--space-5)',
            fontSize: 'var(--font-sm)',
            color: 'var(--color-textMuted)',
          }}>
            Get started by choosing a proposal type below
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 'var(--space-4)',
          }}>
            {([
              { icon: '🤝', label: 'Deal Proposal', desc: 'Discount, BOGO, or flat fee' },
              { icon: '📈', label: 'Campaign', desc: 'Multi-deliverable partnership' },
              { icon: '📱', label: 'QR Code Deal', desc: 'Tracked discount code' },
              { icon: '📝', label: 'Content Review', desc: 'Pre-publish approval' },
            ]).map((action, i) => (
              <button
                key={action.label}
                type="button"
                onClick={() => { setMutationError(null); setShowWizard(true); }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  padding: 'var(--space-5)',
                  background: 'var(--color-bgElevated)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  gap: 'var(--space-2)',
                  transition: 'all var(--transition-fast)',
                  animation: 'fadeSlideIn 0.4s ease both',
                  animationDelay: `${i * 60}ms`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-accent)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 0 20px rgba(249, 115, 22, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <span style={{ fontSize: 'var(--font-2xl)' }}>{action.icon}</span>
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--font-sm)',
                  fontWeight: 600,
                  color: 'var(--color-textPrimary)',
                }}>
                  {action.label}
                </span>
                <span style={{
                  fontSize: 'var(--font-xs)',
                  color: 'var(--color-textMuted)',
                  lineHeight: 1.4,
                }}>
                  {action.desc}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedProposal && (
        <ProposalDetail
          proposal={selectedProposal}
          viewAs={
            (selectedProposal.initiatorId === 'creator-demo' && role === 'creator') ||
            (selectedProposal.initiatedBy === 'restaurant' && role === 'restaurant')
              ? 'initiator' : 'target'
          }
          onClose={() => setSelectedProposal(null)}
          onAccept={handleAccept}
          onDecline={handleDecline}
          onCounter={handleCounter}
          onMessage={handleMessage}
          isActing={acceptMutation.isPending || declineMutation.isPending || counterMutation.isPending}
        />
      )}

      {/* Create Proposal Wizard */}
      <ProposalWizard
        isOpen={showWizard}
        onClose={() => { setShowWizard(false); setMutationError(null); }}
        onSubmit={(payload) => createMutation.mutate(payload)}
        isSubmitting={createMutation.isPending}
        submitError={mutationError}
      />
    </div>
  );
}
