import { useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/ApiService';
import { isDemoMode, DEMO_RESTAURANTS_BY_CITY, DEMO_CAMPAIGNS, DEMO_OFFERS } from '../../data/demoData';
import type { Restaurant, Campaign, Offer } from '../../types';

const PRICE_LABELS: Record<number, string> = { 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };

const GRADIENT_PALETTES = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
];

function getGradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENT_PALETTES[Math.abs(hash) % GRADIENT_PALETTES.length];
}

export default function RestaurantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: restaurant, isLoading } = useQuery({
    queryKey: ['restaurant', id],
    queryFn: async () => {
      if (isDemoMode()) {
        // Search all city lists for this restaurant ID
        for (const list of Object.values(DEMO_RESTAURANTS_BY_CITY)) {
          const found = list.find((r) => r.restaurantId === id);
          if (found) return found;
        }
        return null;
      }
      const res = await api.get<Restaurant>(`/api/restaurants/${id}`);
      return res.data ?? null;
    },
    enabled: Boolean(id),
  });

  const { data: campaigns } = useQuery({
    queryKey: ['restaurantCampaigns', id],
    queryFn: async () => {
      if (isDemoMode()) {
        return DEMO_CAMPAIGNS.filter((c) => c.restaurantId === id);
      }
      const res = await api.get<Campaign[]>(`/api/campaigns?restaurantId=${id}`);
      return res.data ?? [];
    },
    enabled: Boolean(id),
  });

  const { data: offers } = useQuery({
    queryKey: ['restaurantOffers', id],
    queryFn: async () => {
      if (isDemoMode()) {
        return DEMO_OFFERS.filter((o) => o.restaurantId === id);
      }
      const res = await api.get<Offer[]>(`/api/offers?restaurantId=${id}`);
      return res.data ?? [];
    },
    enabled: Boolean(id),
  });

  const activeCampaigns = useMemo(() => campaigns?.filter((c) => c.status === 'active') ?? [], [campaigns]);
  const pastCampaigns = useMemo(() => campaigns?.filter((c) => c.status === 'completed') ?? [], [campaigns]);

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="skeleton" style={{ width: '100%', height: '240px', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-6)' }} />
        <div className="skeleton" style={{ width: '60%', height: '32px', marginBottom: 'var(--space-3)' }} />
        <div className="skeleton" style={{ width: '40%', height: '20px' }} />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <h3>Restaurant not found</h3>
          <p>This restaurant doesn't exist or has been removed.</p>
          <button className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }} onClick={() => navigate('/app/restaurants')}>
            Back to Directory
          </button>
        </div>
      </div>
    );
  }

  const photoUrl = restaurant.photos?.[0];
  const statusColor: Record<string, string> = {
    inquiry: 'var(--color-info)',
    negotiation: 'var(--color-warning)',
    active: 'var(--color-success)',
    completed: 'var(--color-textMuted)',
    cancelled: 'var(--color-error)',
  };

  return (
    <div className="page-container">
      {/* Back button */}
      <button
        className="btn btn-ghost"
        onClick={() => navigate('/app/restaurants')}
        style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--font-sm)' }}
      >
        &larr; Back to Directory
      </button>

      {/* Hero banner */}
      <div
        style={{
          width: '100%',
          height: '260px',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          position: 'relative',
          background: photoUrl ? undefined : getGradient(restaurant.restaurantId),
          marginBottom: 'var(--space-6)',
        }}
      >
        {photoUrl && (
          <img
            src={photoUrl}
            alt={restaurant.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}

        {/* Overlay info */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: 'var(--space-6)',
            background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
            color: '#fff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, margin: 0 }}>{restaurant.name}</h1>
            {restaurant.isPartner && (
              <span className="badge badge--accent">Spot Partner</span>
            )}
          </div>
          <p style={{ margin: 'var(--space-1) 0 0', opacity: 0.9, fontSize: 'var(--font-sm)' }}>
            {restaurant.address} &middot; {restaurant.neighborhood}
          </p>
        </div>
      </div>

      {/* Info grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        {/* Details card */}
        <div className="card" style={{ padding: 'var(--space-5)' }}>
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, color: 'var(--color-textPrimary)', marginBottom: 'var(--space-4)' }}>
            Details
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <DetailRow label="Price" value={PRICE_LABELS[restaurant.priceLevel]} />
            {restaurant.spotRating != null && (
              <DetailRow label="Spot Rating" value={`${restaurant.spotRating.toFixed(1)} / 5.0`} />
            )}
            <DetailRow label="Cuisine" value={restaurant.cuisine.join(', ')} />
            {restaurant.vibes.length > 0 && (
              <DetailRow label="Vibes" value={restaurant.vibes.join(', ')} />
            )}
            {restaurant.phone && <DetailRow label="Phone" value={restaurant.phone} />}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-5)', flexWrap: 'wrap' }}>
            {restaurant.reservationUrl && (
              <a href={restaurant.reservationUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ fontSize: 'var(--font-sm)' }}>
                Reserve a Table
              </a>
            )}
            {restaurant.website && (
              <a href={restaurant.website} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ fontSize: 'var(--font-sm)' }}>
                Visit Website
              </a>
            )}
            {!restaurant.isPartner && (
              <Link to="/app/crm" className="btn btn-secondary" style={{ fontSize: 'var(--font-sm)', textDecoration: 'none' }}>
                Pitch Partnership
              </Link>
            )}
          </div>
        </div>

        {/* Campaigns card */}
        <div className="card" style={{ padding: 'var(--space-5)' }}>
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, color: 'var(--color-textPrimary)', marginBottom: 'var(--space-4)' }}>
            Campaigns
          </h2>

          {(!campaigns || campaigns.length === 0) ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-6) 0' }}>
              <p style={{ color: 'var(--color-textMuted)', marginBottom: 'var(--space-3)' }}>
                No campaigns yet with {restaurant.name}.
              </p>
              <Link
                to={`/app/campaigns?restaurantId=${restaurant.restaurantId}&restaurantName=${encodeURIComponent(restaurant.name)}&restaurantPhoto=${encodeURIComponent(restaurant.photos?.[0] ?? '')}&restaurantCuisine=${encodeURIComponent(restaurant.cuisine.join(','))}&restaurantNeighborhood=${encodeURIComponent(restaurant.neighborhood)}&restaurantPrice=${restaurant.priceLevel}`}
                className="btn btn-primary"
                style={{ fontSize: 'var(--font-sm)', textDecoration: 'none' }}
              >
                Start a Campaign
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {[...activeCampaigns, ...pastCampaigns].slice(0, 5).map((c) => (
                <Link
                  key={c.campaignId}
                  to={`/app/campaigns`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--color-bgSecondary)',
                      transition: 'background var(--transition-fast)',
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.background = 'var(--color-bgElevated)')}
                    onMouseOut={(e) => (e.currentTarget.style.background = 'var(--color-bgSecondary)')}
                  >
                    <div>
                      <span style={{ fontWeight: 500, fontSize: 'var(--font-sm)', color: 'var(--color-textPrimary)' }}>
                        {c.package} Package
                      </span>
                      <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', marginLeft: 'var(--space-2)' }}>
                        ${c.budget.toLocaleString()}
                      </span>
                    </div>
                    <span
                      className="badge"
                      style={{
                        background: statusColor[c.status] ?? 'var(--color-textMuted)',
                        color: '#fff',
                        fontSize: '10px',
                        textTransform: 'capitalize',
                      }}
                    >
                      {c.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* About this restaurant */}
      {(restaurant.description || (restaurant.vibes && restaurant.vibes.length > 0) || restaurant.knownFor) && (
        <div className="card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, color: 'var(--color-textPrimary)', marginBottom: 'var(--space-4)' }}>
            About {restaurant.name}
          </h2>

          {restaurant.description && (
            <p style={{ color: 'var(--color-textSecondary)', lineHeight: 1.7, fontSize: 'var(--font-sm)', marginBottom: 'var(--space-4)' }}>
              {restaurant.description}
            </p>
          )}

          {restaurant.knownFor && restaurant.knownFor.length > 0 && (
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--color-textMuted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 'var(--space-2)' }}>
                Known For
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {restaurant.knownFor.map((item) => (
                  <span
                    key={item}
                    className="badge"
                    style={{
                      background: 'rgba(249, 115, 22, 0.1)',
                      color: 'var(--color-accent)',
                      fontSize: 'var(--font-xs)',
                      fontWeight: 500,
                      padding: 'var(--space-1) var(--space-3)',
                    }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {restaurant.vibes && restaurant.vibes.length > 0 && (
            <div>
              <h3 style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--color-textMuted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 'var(--space-2)' }}>
                Vibe
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {restaurant.vibes.map((vibe) => (
                  <span
                    key={vibe}
                    className="badge"
                    style={{
                      background: 'var(--color-bgElevated)',
                      color: 'var(--color-textSecondary)',
                      fontSize: 'var(--font-xs)',
                      fontWeight: 500,
                      padding: 'var(--space-1) var(--space-3)',
                    }}
                  >
                    {vibe}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Offers section */}
      {offers && offers.length > 0 && (
        <div className="card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, color: 'var(--color-textPrimary)', marginBottom: 'var(--space-4)' }}>
            Active Offers
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
            {offers.filter((o) => o.isActive).map((offer) => (
              <div
                key={offer.offerId}
                style={{
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-bgSecondary)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)', color: 'var(--color-textPrimary)', marginBottom: 'var(--space-1)' }}>
                  {offer.description}
                </div>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', marginBottom: 'var(--space-2)' }}>
                  Code: <code style={{ color: 'var(--color-accent)', fontWeight: 600 }}>{offer.code}</code>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--font-xs)', color: 'var(--color-textSecondary)' }}>
                  <span>{offer.scans} scans</span>
                  <span>{offer.redemptions} redeemed</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spot Review */}
      {restaurant.spotReview && (
        <div className="card" style={{ padding: 'var(--space-5)' }}>
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, color: 'var(--color-textPrimary)', marginBottom: 'var(--space-3)' }}>
            Your Spot Review
          </h2>
          <p style={{ color: 'var(--color-textSecondary)', lineHeight: 1.6, fontSize: 'var(--font-sm)' }}>
            {restaurant.spotReview}
          </p>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-sm)' }}>
      <span style={{ color: 'var(--color-textMuted)', fontWeight: 500 }}>{label}</span>
      <span style={{ color: 'var(--color-textPrimary)', textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  );
}
