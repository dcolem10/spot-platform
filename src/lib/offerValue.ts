import type { OfferTerms } from '../types';

/**
 * Short human label for a deal's structured value, e.g. "15% OFF",
 * "$10 OFF", "FREE Dessert". This is the viewer's incentive to use a promo
 * code, so surfaces should render it prominently. Returns null when no
 * structured value exists (legacy free-text offers).
 */
export function formatOfferValue(terms?: OfferTerms | null): string | null {
  if (!terms) return null;
  if (terms.discountType === 'percent' && terms.discountValue > 0) {
    return `${terms.discountValue}% OFF`;
  }
  if (terms.discountType === 'fixed' && terms.discountValue > 0) {
    return `$${terms.discountValue} OFF`;
  }
  if (terms.discountType === 'freeItem') {
    return terms.freeItemDescription ? `FREE ${terms.freeItemDescription}` : 'FREE Item';
  }
  return null;
}

/** Secondary qualifier line, e.g. "Min. spend $40" — shown under the value badge. */
export function formatOfferQualifier(terms?: OfferTerms | null): string | null {
  if (!terms) return null;
  const parts: string[] = [];
  if (terms.minSpend && terms.minSpend > 0) parts.push(`Min. spend $${terms.minSpend}`);
  if (terms.validDays && terms.validDays.length > 0 && terms.validDays.length < 7) {
    parts.push(terms.validDays.join(', '));
  }
  return parts.length ? parts.join(' · ') : null;
}
