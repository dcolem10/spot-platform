import { useState, useMemo, useEffect, useCallback } from 'react';
import type { SavedRestaurant, Restaurant } from '../../types';
import { api } from '../../services/ApiService';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { isDemoMode, DEMO_SAVED, DEMO_RESTAURANTS } from '../../data/demoData';

// ─── Constants ────────────────────────────────────────────────────────────────

const OCCASION_OPTIONS = [
  'Date Night', 'Brunch', 'Casual', 'Group Friendly',
  'Late Night', 'Outdoor', 'Special Occasion', 'Business',
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface SavedRestaurantWithDetails extends SavedRestaurant {
  restaurant?: Restaurant;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SavedCardProps {
  item: SavedRestaurantWithDetails;
  onRemove: (restaurantId: string) => void;
  onUpdateNotes: (restaurantId: string, notes: string) => void;
}

function SavedCard({ item, onRemove, onUpdateNotes }: SavedCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [notesValue, setNotesValue] = useState(item.notes ?? '');
  const [isRemoving, setIsRemoving] = useState(false);

  const restaurant = item.restaurant;
  const savedDate = new Date(item.savedAt);
  const formattedDate = savedDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const handleSaveNotes = useCallback(() => {
    onUpdateNotes(item.restaurantId, notesValue.trim());
    setIsEditing(false);
  }, [item.restaurantId, notesValue, onUpdateNotes]);

  const handleRemove = useCallback(async () => {
    setIsRemoving(true);
    onRemove(item.restaurantId);
  }, [item.restaurantId, onRemove]);

  return (
    <article
      className="card"
      style={{
        display: 'flex',
        gap: 'var(--space-4)',
        opacity: isRemoving ? 0.5 : 1,
        transition: 'opacity var(--transition-base)',
      }}
    >
      {/* Photo thumbnail */}
      <div
        style={{
          width: '80px',
          height: '80px',
          flexShrink: 0,
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          background: restaurant?.photos?.[0]
            ? undefined
            : 'linear-gradient(135deg, var(--color-accentMuted) 0%, var(--color-infoMuted) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {restaurant?.photos?.[0] ? (
          <img
            src={restaurant.photos[0]}
            alt={restaurant.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span
            style={{
              fontSize: 'var(--font-xl)',
              fontWeight: 700,
              color: 'var(--color-accent)',
            }}
          >
            {(restaurant?.name ?? '?').slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>

      {/* Details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 'var(--space-2)',
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
              {restaurant?.name ?? 'Unknown Restaurant'}
            </h3>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                fontSize: 'var(--font-xs)',
                color: 'var(--color-textMuted)',
              }}
            >
              {restaurant?.neighborhood && <span>{restaurant.neighborhood}</span>}
              {restaurant?.cuisine?.[0] && (
                <>
                  <span aria-hidden="true" style={{ opacity: 0.4 }}>|</span>
                  <span>{restaurant.cuisine[0]}</span>
                </>
              )}
              <span aria-hidden="true" style={{ opacity: 0.4 }}>|</span>
              <span>Saved {formattedDate}</span>
            </div>
          </div>

          <button
            className="btn btn-ghost"
            style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', flexShrink: 0 }}
            onClick={handleRemove}
            disabled={isRemoving}
            aria-label={`Remove ${restaurant?.name ?? 'restaurant'} from saved`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Remove
          </button>
        </div>

        {/* Occasion tag */}
        {item.occasion && (
          <div style={{ marginTop: 'var(--space-2)' }}>
            <span className="badge badge--info">{item.occasion}</span>
          </div>
        )}

        {/* Notes */}
        <div style={{ marginTop: 'var(--space-2)' }}>
          {isEditing ? (
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start' }}>
              <textarea
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                placeholder="Add a note..."
                rows={2}
                style={{
                  flex: 1,
                  padding: 'var(--space-2) var(--space-3)',
                  background: 'var(--color-bgElevated)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-textPrimary)',
                  fontSize: 'var(--font-sm)',
                  resize: 'vertical',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                aria-label="Notes"
                autoFocus
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                <button
                  className="btn btn-primary"
                  style={{ fontSize: 'var(--font-xs)', padding: 'var(--space-1) var(--space-3)' }}
                  onClick={handleSaveNotes}
                >
                  Save
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 'var(--font-xs)', padding: 'var(--space-1) var(--space-3)' }}
                  onClick={() => {
                    setNotesValue(item.notes ?? '');
                    setIsEditing(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              className="btn btn-ghost"
              style={{
                fontSize: 'var(--font-xs)',
                padding: 'var(--space-1) 0',
                color: item.notes ? 'var(--color-textSecondary)' : 'var(--color-textMuted)',
              }}
              onClick={() => setIsEditing(true)}
            >
              {item.notes ? (
                <span style={{ fontStyle: 'normal' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: '4px' }}>
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  {item.notes}
                </span>
              ) : (
                '+ Add a note'
              )}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

interface OccasionFilterProps {
  selected: string | null;
  onSelect: (occasion: string | null) => void;
}

function OccasionFilter({ selected, onSelect }: OccasionFilterProps) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
      <button
        className={selected === null ? 'badge badge--accent' : 'badge'}
        style={{
          cursor: 'pointer',
          border: selected === null ? 'none' : '1px solid var(--color-border)',
          background: selected === null ? undefined : 'var(--color-bgElevated)',
          color: selected === null ? undefined : 'var(--color-textSecondary)',
        }}
        onClick={() => onSelect(null)}
      >
        All
      </button>
      {OCCASION_OPTIONS.map((occ) => (
        <button
          key={occ}
          className={selected === occ ? 'badge badge--accent' : 'badge'}
          style={{
            cursor: 'pointer',
            border: selected === occ ? 'none' : '1px solid var(--color-border)',
            background: selected === occ ? undefined : 'var(--color-bgElevated)',
            color: selected === occ ? undefined : 'var(--color-textSecondary)',
          }}
          onClick={() => onSelect(occ)}
        >
          {occ}
        </button>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SavedList() {
  const [savedItems, setSavedItems] = useState<SavedRestaurantWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [occasionFilter, setOccasionFilter] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchSaved() {
      setIsLoading(true);
      setError(null);

      if (isDemoMode()) {
        const enriched = DEMO_SAVED.map((saved) => ({
          ...saved,
          restaurant: DEMO_RESTAURANTS.find((r) => r.restaurantId === saved.restaurantId),
        }));
        setSavedItems(enriched);
        setIsLoading(false);
        return;
      }

      const result = await api.get<SavedRestaurantWithDetails[]>('/api/insider/saved');

      if (cancelled) return;

      if (result.status === 'success' && result.data && result.data.length > 0) {
        setSavedItems(result.data);
      } else if (result.error) {
        setError(result.error);
      }
      setIsLoading(false);
    }

    fetchSaved();
    return () => { cancelled = true; };
  }, []);

  const handleRemove = useCallback(async (restaurantId: string) => {
    const result = await api.delete(`/api/insider/saved/${restaurantId}`);
    if (result.status === 'success') {
      setSavedItems((prev) => prev.filter((item) => item.restaurantId !== restaurantId));
    }
  }, []);

  const handleUpdateNotes = useCallback(async (restaurantId: string, notes: string) => {
    const result = await api.put(`/api/insider/saved/${restaurantId}`, { notes });
    if (result.status === 'success') {
      setSavedItems((prev) =>
        prev.map((item) =>
          item.restaurantId === restaurantId ? { ...item, notes: notes || undefined } : item
        )
      );
    }
  }, []);

  const filteredItems = useMemo(() => {
    if (!occasionFilter) return savedItems;
    return savedItems.filter((item) => item.occasion === occasionFilter);
  }, [savedItems, occasionFilter]);

  return (
    <div className="page-container">
      <header className="page-header">
        <h1 className="page-title">Saved Spots</h1>
        <p className="page-subtitle">
          Your personal list of restaurants to try.
        </p>
      </header>

      {/* Occasion filter */}
      {!isLoading && savedItems.length > 0 && (
        <OccasionFilter selected={occasionFilter} onSelect={setOccasionFilter} />
      )}

      {/* Content */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="card" style={{ display: 'flex', gap: 'var(--space-4)' }}>
              <LoadingSkeleton width="80px" height="80px" borderRadius="var(--radius-md)" />
              <div style={{ flex: 1 }}>
                <LoadingSkeleton height="18px" width="50%" />
                <div style={{ marginTop: 'var(--space-2)' }}>
                  <LoadingSkeleton height="14px" width="70%" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="empty-state">
          <h3>Something went wrong</h3>
          <p style={{ color: 'var(--color-error)' }}>{error}</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="empty-state">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-textMuted)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginBottom: 'var(--space-4)', opacity: 0.5 }}
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
          {savedItems.length > 0 && occasionFilter ? (
            <>
              <h3>No saved restaurants for "{occasionFilter}"</h3>
              <p>Try selecting a different occasion or view all saved spots.</p>
              <button
                className="btn btn-secondary"
                style={{ marginTop: 'var(--space-4)' }}
                onClick={() => setOccasionFilter(null)}
              >
                View all
              </button>
            </>
          ) : (
            <>
              <h3>No saved spots yet</h3>
              <p>Start exploring to save restaurants you want to try.</p>
              <a
                className="btn btn-primary"
                href="/app/discover"
                style={{ marginTop: 'var(--space-4)', textDecoration: 'none' }}
              >
                Discover restaurants
              </a>
            </>
          )}
        </div>
      ) : (
        <>
          <div
            style={{
              fontSize: 'var(--font-sm)',
              color: 'var(--color-textMuted)',
              marginBottom: 'var(--space-4)',
            }}
          >
            {filteredItems.length} saved spot{filteredItems.length !== 1 ? 's' : ''}
            {occasionFilter ? ` for ${occasionFilter}` : ''}
          </div>
          <div
            className="stagger-children"
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
          >
            {filteredItems.map((item) => (
              <SavedCard
                key={item.restaurantId}
                item={item}
                onRemove={handleRemove}
                onUpdateNotes={handleUpdateNotes}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default SavedList;
