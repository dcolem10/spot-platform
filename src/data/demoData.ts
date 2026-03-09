/**
 * Centralized demo data used by all components when VITE_DEMO_MODE=true and API returns empty.
 * All IDs cross-reference correctly. Metrics are example data for demonstration purposes.
 */
import type {
  Restaurant,
  Campaign,
  PartnershipPipeline,
  ContentItem,
  EditorialSlot,
  CampaignReport,
  Offer,
  DealOffer,
  SavedRestaurant,
  CreatorProfile,
} from '../types';

import { useAuthStore } from '../store/authStore';

/**
 * Runtime demo mode check. Returns true only when the user is browsing
 * in demo mode (not signed in with a real Cognito account).
 */
export function isDemoMode(): boolean {
  return useAuthStore.getState().isDemoMode;
}

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function demoDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

function demoISO(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString();
}

/* ─── Creator Profile ──────────────────────────────────────────────────────── */

export const DEMO_CREATOR_PROFILE: CreatorProfile = {
  creatorId: 'creator-demo',
  brandName: 'Demo Creator',
  platforms: {
    instagram: { handle: '@yourhandle', followers: 0 },
    tiktok: { handle: '@yourhandle', followers: 0 },
  },
  city: 'Washington, DC',
  niche: 'Food & Restaurants',
  monthlyRate: { min: 0, max: 0 },
};

/* ─── Restaurants ──────────────────────────────────────────────────────────── */

// City-keyed restaurant data — every supported city has recognizable restaurants.
// Real data is loaded from API when the backend is deployed; these are for demo only.

const DC_RESTAURANTS: Restaurant[] = [
  { restaurantId: 'r1', name: 'Rasika', address: '633 D St NW', neighborhood: 'Penn Quarter', coords: { lat: 38.8949, lng: -77.0218 }, cuisine: ['Indian', 'Modern'], vibes: ['Date Night', 'Special Occasion'], priceLevel: 3, spotRating: 4.8, isPartner: true, photos: [], reservationUrl: 'https://rasika.com', createdAt: demoISO(-90), updatedAt: demoISO(-5) },
  { restaurantId: 'r2', name: 'Bad Saint', address: '3226 11th St NW', neighborhood: 'Columbia Heights', coords: { lat: 38.9314, lng: -77.0257 }, cuisine: ['Filipino'], vibes: ['Casual', 'Group Friendly'], priceLevel: 2, spotRating: 4.7, isPartner: true, photos: [], createdAt: demoISO(-80), updatedAt: demoISO(-10) },
  { restaurantId: 'r3', name: 'The Dabney', address: '122 Blagden Alley NW', neighborhood: 'Shaw', coords: { lat: 38.9088, lng: -77.0221 }, cuisine: ['American', 'Mid-Atlantic'], vibes: ['Date Night'], priceLevel: 4, spotRating: 4.9, isPartner: true, photos: [], reservationUrl: 'https://thedabney.com', createdAt: demoISO(-85), updatedAt: demoISO(-3) },
  { restaurantId: 'r4', name: 'Tail Up Goat', address: '1827 Adams Mill Rd NW', neighborhood: 'Adams Morgan', coords: { lat: 38.9222, lng: -77.0425 }, cuisine: ['Mediterranean', 'Caribbean'], vibes: ['Date Night', 'Brunch'], priceLevel: 3, spotRating: 4.6, isPartner: false, photos: [], createdAt: demoISO(-70), updatedAt: demoISO(-8) },
  { restaurantId: 'r5', name: 'Compass Rose', address: '1346 T St NW', neighborhood: 'U Street', coords: { lat: 38.9157, lng: -77.0300 }, cuisine: ['International', 'Tapas'], vibes: ['Date Night', 'Group Friendly'], priceLevel: 3, spotRating: 4.5, isPartner: true, photos: [], createdAt: demoISO(-75), updatedAt: demoISO(-12) },
  { restaurantId: 'r6', name: "Rose's Luxury", address: '717 8th St SE', neighborhood: 'Capitol Hill', coords: { lat: 38.8809, lng: -76.9953 }, cuisine: ['American', 'Modern'], vibes: ['Special Occasion', 'Date Night'], priceLevel: 4, spotRating: 4.9, isPartner: true, photos: [], createdAt: demoISO(-95), updatedAt: demoISO(-2) },
  { restaurantId: 'r7', name: 'Maydan', address: '1346 Florida Ave NW', neighborhood: 'U Street', coords: { lat: 38.9168, lng: -77.0297 }, cuisine: ['Middle Eastern', 'North African'], vibes: ['Group Friendly', 'Special Occasion'], priceLevel: 3, spotRating: 4.7, isPartner: false, photos: [], createdAt: demoISO(-65), updatedAt: demoISO(-15) },
  { restaurantId: 'r8', name: 'Tiger Fork', address: '922 N St NW', neighborhood: 'Shaw', coords: { lat: 38.9082, lng: -77.0232 }, cuisine: ['Chinese', 'Hong Kong'], vibes: ['Casual', 'Late Night'], priceLevel: 2, spotRating: 4.4, isPartner: true, photos: [], createdAt: demoISO(-60), updatedAt: demoISO(-7) },
  { restaurantId: 'r9', name: 'Centrolina', address: '974 Palmer Alley NW', neighborhood: 'CityCenterDC', coords: { lat: 38.9009, lng: -77.0245 }, cuisine: ['Italian'], vibes: ['Brunch', 'Date Night'], priceLevel: 3, spotRating: 4.5, isPartner: false, photos: [], createdAt: demoISO(-55), updatedAt: demoISO(-20) },
  { restaurantId: 'r10', name: 'Thip Khao', address: '3462 14th St NW', neighborhood: 'Columbia Heights', coords: { lat: 38.9340, lng: -77.0326 }, cuisine: ['Laotian', 'Thai'], vibes: ['Casual', 'Group Friendly'], priceLevel: 2, spotRating: 4.6, isPartner: true, photos: [], createdAt: demoISO(-50), updatedAt: demoISO(-6) },
  { restaurantId: 'r11', name: 'Founding Farmers', address: '1924 Pennsylvania Ave NW', neighborhood: 'Foggy Bottom', coords: { lat: 38.9009, lng: -77.0460 }, cuisine: ['American', 'Farm-to-Table'], vibes: ['Brunch', 'Group Friendly'], priceLevel: 2, spotRating: 4.2, isPartner: false, photos: [], createdAt: demoISO(-45), updatedAt: demoISO(-18) },
  { restaurantId: 'r12', name: 'Le Diplomate', address: '1601 14th St NW', neighborhood: 'Logan Circle', coords: { lat: 38.9115, lng: -77.0326 }, cuisine: ['French', 'Bistro'], vibes: ['Brunch', 'Date Night', 'Outdoor'], priceLevel: 3, spotRating: 4.5, isPartner: true, photos: [], reservationUrl: 'https://lediplomatedc.com', createdAt: demoISO(-40), updatedAt: demoISO(-4) },
  { restaurantId: 'r13', name: 'Estadio', address: '1520 14th St NW', neighborhood: 'Logan Circle', coords: { lat: 38.9098, lng: -77.0326 }, cuisine: ['Spanish', 'Tapas'], vibes: ['Date Night', 'Group Friendly'], priceLevel: 3, spotRating: 4.4, isPartner: false, photos: [], createdAt: demoISO(-35), updatedAt: demoISO(-22) },
  { restaurantId: 'r14', name: 'Ambar', address: '523 8th St SE', neighborhood: 'Capitol Hill', coords: { lat: 38.8825, lng: -76.9953 }, cuisine: ['Balkan', 'Mediterranean'], vibes: ['Brunch', 'Group Friendly'], priceLevel: 2, spotRating: 4.3, isPartner: true, photos: [], createdAt: demoISO(-30), updatedAt: demoISO(-9) },
  { restaurantId: 'r15', name: 'Unconventional Diner', address: '1207 9th St NW', neighborhood: 'Shaw', coords: { lat: 38.9070, lng: -77.0232 }, cuisine: ['American', 'Diner'], vibes: ['Casual', 'Brunch'], priceLevel: 2, spotRating: 4.1, isPartner: false, photos: [], createdAt: demoISO(-25), updatedAt: demoISO(-14) },
  { restaurantId: 'r16', name: 'Doi Moi', address: '1800 14th St NW', neighborhood: 'U Street', coords: { lat: 38.9137, lng: -77.0326 }, cuisine: ['Vietnamese', 'Thai'], vibes: ['Date Night', 'Late Night'], priceLevel: 2, spotRating: 4.3, isPartner: true, photos: [], createdAt: demoISO(-20), updatedAt: demoISO(-11) },
  { restaurantId: 'r17', name: 'Chloe', address: '1331 4th St SE', neighborhood: 'Navy Yard', coords: { lat: 38.8756, lng: -77.0001 }, cuisine: ['American', 'Modern'], vibes: ['Brunch', 'Outdoor'], priceLevel: 3, spotRating: 4.4, isPartner: false, photos: [], createdAt: demoISO(-15), updatedAt: demoISO(-16) },
  { restaurantId: 'r18', name: 'Chercher', address: '1334 9th St NW', neighborhood: 'Shaw', coords: { lat: 38.9082, lng: -77.0232 }, cuisine: ['Ethiopian'], vibes: ['Casual', 'Group Friendly'], priceLevel: 2, spotRating: 4.5, isPartner: true, photos: [], createdAt: demoISO(-10), updatedAt: demoISO(-1) },
];

const NYC_RESTAURANTS: Restaurant[] = [
  { restaurantId: 'ny1', name: 'Carbone', address: '181 Thompson St', neighborhood: 'Greenwich Village', coords: { lat: 40.7271, lng: -74.0003 }, cuisine: ['Italian', 'American'], vibes: ['Special Occasion', 'Date Night'], priceLevel: 4, spotRating: 4.8, isPartner: true, photos: [], createdAt: demoISO(-60), updatedAt: demoISO(-2) },
  { restaurantId: 'ny2', name: 'Tatiana', address: '10 Hudson Yards', neighborhood: 'Hudson Yards', coords: { lat: 40.7536, lng: -74.0022 }, cuisine: ['American', 'Modern'], vibes: ['Date Night', 'Special Occasion'], priceLevel: 4, spotRating: 4.9, isPartner: true, photos: [], createdAt: demoISO(-55), updatedAt: demoISO(-3) },
  { restaurantId: 'ny3', name: "L'Artusi", address: '228 W 10th St', neighborhood: 'West Village', coords: { lat: 40.7339, lng: -74.0027 }, cuisine: ['Italian', 'Modern'], vibes: ['Date Night', 'Group Friendly'], priceLevel: 3, spotRating: 4.6, isPartner: false, photos: [], createdAt: demoISO(-50), updatedAt: demoISO(-5) },
  { restaurantId: 'ny4', name: "Di An Di", address: '68 Greenpoint Ave', neighborhood: 'Greenpoint', coords: { lat: 40.7296, lng: -73.9583 }, cuisine: ['Vietnamese'], vibes: ['Casual', 'Brunch'], priceLevel: 2, spotRating: 4.5, isPartner: true, photos: [], createdAt: demoISO(-45), updatedAt: demoISO(-7) },
  { restaurantId: 'ny5', name: 'Dhamaka', address: '119 First Ave', neighborhood: 'East Village', coords: { lat: 40.7266, lng: -73.9854 }, cuisine: ['Indian'], vibes: ['Group Friendly', 'Special Occasion'], priceLevel: 3, spotRating: 4.7, isPartner: true, photos: [], createdAt: demoISO(-40), updatedAt: demoISO(-4) },
  { restaurantId: 'ny6', name: 'Thai Diner', address: '186 Mott St', neighborhood: 'Nolita', coords: { lat: 40.7213, lng: -73.9959 }, cuisine: ['Thai', 'American'], vibes: ['Casual', 'Brunch'], priceLevel: 2, spotRating: 4.4, isPartner: false, photos: [], createdAt: demoISO(-35), updatedAt: demoISO(-8) },
  { restaurantId: 'ny7', name: 'Lilia', address: '567 Union Ave', neighborhood: 'Williamsburg', coords: { lat: 40.7133, lng: -73.9513 }, cuisine: ['Italian', 'Pasta'], vibes: ['Date Night'], priceLevel: 3, spotRating: 4.8, isPartner: true, photos: [], createdAt: demoISO(-30), updatedAt: demoISO(-1) },
  { restaurantId: 'ny8', name: 'Los Tacos No.1', address: '75 9th Ave', neighborhood: 'Chelsea Market', coords: { lat: 40.7425, lng: -74.0060 }, cuisine: ['Mexican'], vibes: ['Casual', 'Quick Bite'], priceLevel: 1, spotRating: 4.6, isPartner: false, photos: [], createdAt: demoISO(-25), updatedAt: demoISO(-10) },
  { restaurantId: 'ny9', name: "Jua", address: '36 E 1st St', neighborhood: 'East Village', coords: { lat: 40.7249, lng: -73.9907 }, cuisine: ['Korean', 'Modern'], vibes: ['Date Night', 'Special Occasion'], priceLevel: 4, spotRating: 4.7, isPartner: true, photos: [], createdAt: demoISO(-20), updatedAt: demoISO(-6) },
  { restaurantId: 'ny10', name: 'Russ & Daughters Cafe', address: '127 Orchard St', neighborhood: 'Lower East Side', coords: { lat: 40.7194, lng: -73.9892 }, cuisine: ['Jewish', 'American'], vibes: ['Brunch', 'Casual'], priceLevel: 2, spotRating: 4.5, isPartner: false, photos: [], createdAt: demoISO(-15), updatedAt: demoISO(-12) },
];

const ATL_RESTAURANTS: Restaurant[] = [
  { restaurantId: 'atl1', name: 'Bacchanalia', address: '1460 Ellsworth Industrial Blvd', neighborhood: 'Westside', coords: { lat: 33.7951, lng: -84.4253 }, cuisine: ['American', 'Modern'], vibes: ['Special Occasion', 'Date Night'], priceLevel: 4, spotRating: 4.9, isPartner: true, photos: [], createdAt: demoISO(-80), updatedAt: demoISO(-2) },
  { restaurantId: 'atl2', name: 'Fox Bros. Bar-B-Q', address: '1238 DeKalb Ave NE', neighborhood: 'Candler Park', coords: { lat: 33.7667, lng: -84.3346 }, cuisine: ['BBQ', 'American'], vibes: ['Casual', 'Group Friendly'], priceLevel: 2, spotRating: 4.6, isPartner: true, photos: [], createdAt: demoISO(-70), updatedAt: demoISO(-5) },
  { restaurantId: 'atl3', name: 'Gunshow', address: '924 Garrett St SE', neighborhood: 'Glenwood Park', coords: { lat: 33.7382, lng: -84.3458 }, cuisine: ['American', 'Modern'], vibes: ['Group Friendly', 'Special Occasion'], priceLevel: 3, spotRating: 4.7, isPartner: false, photos: [], createdAt: demoISO(-60), updatedAt: demoISO(-8) },
  { restaurantId: 'atl4', name: 'Busy Bee Cafe', address: '810 Martin Luther King Jr Dr', neighborhood: 'Vine City', coords: { lat: 33.7553, lng: -84.4089 }, cuisine: ['Southern', 'Soul Food'], vibes: ['Casual', 'Group Friendly'], priceLevel: 1, spotRating: 4.5, isPartner: true, photos: [], createdAt: demoISO(-50), updatedAt: demoISO(-3) },
  { restaurantId: 'atl5', name: 'Staplehouse', address: '541 Edgewood Ave SE', neighborhood: 'Old Fourth Ward', coords: { lat: 33.7557, lng: -84.3676 }, cuisine: ['American', 'Farm-to-Table'], vibes: ['Date Night', 'Special Occasion'], priceLevel: 4, spotRating: 4.8, isPartner: true, photos: [], createdAt: demoISO(-40), updatedAt: demoISO(-1) },
  { restaurantId: 'atl6', name: 'Hattie B\'s Hot Chicken', address: '299 N Highland Ave NE', neighborhood: 'Inman Park', coords: { lat: 33.7676, lng: -84.3534 }, cuisine: ['Southern', 'American'], vibes: ['Casual'], priceLevel: 2, spotRating: 4.4, isPartner: false, photos: [], createdAt: demoISO(-30), updatedAt: demoISO(-10) },
  { restaurantId: 'atl7', name: 'Lazy Betty', address: '1530 DeKalb Ave NE', neighborhood: 'Candler Park', coords: { lat: 33.7695, lng: -84.3253 }, cuisine: ['American', 'Modern'], vibes: ['Date Night', 'Special Occasion'], priceLevel: 4, spotRating: 4.8, isPartner: true, photos: [], createdAt: demoISO(-20), updatedAt: demoISO(-4) },
  { restaurantId: 'atl8', name: 'BuHi', address: '5000 Buford Hwy NE', neighborhood: 'Buford Highway', coords: { lat: 33.8518, lng: -84.3105 }, cuisine: ['Vietnamese', 'Chinese'], vibes: ['Casual', 'Group Friendly'], priceLevel: 1, spotRating: 4.3, isPartner: false, photos: [], createdAt: demoISO(-10), updatedAt: demoISO(-6) },
];

const CHI_RESTAURANTS: Restaurant[] = [
  { restaurantId: 'chi1', name: 'Alinea', address: '1723 N Halsted St', neighborhood: 'Lincoln Park', coords: { lat: 41.9134, lng: -87.6484 }, cuisine: ['American', 'Molecular'], vibes: ['Special Occasion'], priceLevel: 4, spotRating: 4.9, isPartner: true, photos: [], createdAt: demoISO(-85), updatedAt: demoISO(-1) },
  { restaurantId: 'chi2', name: 'Girl & The Goat', address: '809 W Randolph St', neighborhood: 'West Loop', coords: { lat: 41.8843, lng: -87.6477 }, cuisine: ['American', 'Modern'], vibes: ['Group Friendly', 'Date Night'], priceLevel: 3, spotRating: 4.7, isPartner: true, photos: [], createdAt: demoISO(-70), updatedAt: demoISO(-3) },
  { restaurantId: 'chi3', name: 'Portillo\'s', address: '100 W Ontario St', neighborhood: 'River North', coords: { lat: 41.8934, lng: -87.6320 }, cuisine: ['American', 'Fast Casual'], vibes: ['Casual', 'Group Friendly'], priceLevel: 1, spotRating: 4.4, isPartner: false, photos: [], createdAt: demoISO(-60), updatedAt: demoISO(-8) },
  { restaurantId: 'chi4', name: 'Virtue', address: '1462 E 53rd St', neighborhood: 'Hyde Park', coords: { lat: 41.7997, lng: -87.5873 }, cuisine: ['Southern', 'American'], vibes: ['Brunch', 'Date Night'], priceLevel: 3, spotRating: 4.6, isPartner: true, photos: [], createdAt: demoISO(-50), updatedAt: demoISO(-5) },
  { restaurantId: 'chi5', name: 'Kasama', address: '1001 N Winchester Ave', neighborhood: 'Ukrainian Village', coords: { lat: 41.9002, lng: -87.6737 }, cuisine: ['Filipino', 'French'], vibes: ['Brunch', 'Special Occasion'], priceLevel: 3, spotRating: 4.8, isPartner: true, photos: [], createdAt: demoISO(-40), updatedAt: demoISO(-2) },
  { restaurantId: 'chi6', name: 'Birrieria Zaragoza', address: '4852 S Pulaski Rd', neighborhood: 'Archer Heights', coords: { lat: 41.8048, lng: -87.7222 }, cuisine: ['Mexican'], vibes: ['Casual'], priceLevel: 1, spotRating: 4.5, isPartner: false, photos: [], createdAt: demoISO(-30), updatedAt: demoISO(-7) },
  { restaurantId: 'chi7', name: 'Parachute', address: '3500 N Elston Ave', neighborhood: 'Avondale', coords: { lat: 41.9454, lng: -87.7084 }, cuisine: ['Korean', 'American'], vibes: ['Date Night'], priceLevel: 3, spotRating: 4.7, isPartner: true, photos: [], createdAt: demoISO(-20), updatedAt: demoISO(-4) },
  { restaurantId: 'chi8', name: 'Au Cheval', address: '800 W Randolph St', neighborhood: 'West Loop', coords: { lat: 41.8843, lng: -87.6474 }, cuisine: ['American', 'Diner'], vibes: ['Casual', 'Late Night'], priceLevel: 2, spotRating: 4.6, isPartner: false, photos: [], createdAt: demoISO(-10), updatedAt: demoISO(-9) },
];

const LA_RESTAURANTS: Restaurant[] = [
  { restaurantId: 'la1', name: 'Bestia', address: '2121 E 7th Pl', neighborhood: 'Arts District', coords: { lat: 34.0336, lng: -118.2290 }, cuisine: ['Italian', 'Modern'], vibes: ['Date Night', 'Special Occasion'], priceLevel: 3, spotRating: 4.8, isPartner: true, photos: [], createdAt: demoISO(-80), updatedAt: demoISO(-1) },
  { restaurantId: 'la2', name: 'Guerrilla Tacos', address: '2000 E 7th St', neighborhood: 'Arts District', coords: { lat: 34.0336, lng: -118.2320 }, cuisine: ['Mexican', 'Modern'], vibes: ['Casual', 'Quick Bite'], priceLevel: 2, spotRating: 4.5, isPartner: false, photos: [], createdAt: demoISO(-65), updatedAt: demoISO(-4) },
  { restaurantId: 'la3', name: 'Republique', address: '624 S La Brea Ave', neighborhood: 'Mid-Wilshire', coords: { lat: 34.0613, lng: -118.3443 }, cuisine: ['French', 'American'], vibes: ['Brunch', 'Date Night'], priceLevel: 3, spotRating: 4.7, isPartner: true, photos: [], createdAt: demoISO(-55), updatedAt: demoISO(-3) },
  { restaurantId: 'la4', name: 'Jitlada', address: '5233 Sunset Blvd', neighborhood: 'Thai Town', coords: { lat: 34.0978, lng: -118.3050 }, cuisine: ['Thai'], vibes: ['Casual', 'Group Friendly'], priceLevel: 2, spotRating: 4.6, isPartner: true, photos: [], createdAt: demoISO(-45), updatedAt: demoISO(-6) },
  { restaurantId: 'la5', name: 'Sushi Ginza Onodera', address: '609 La Cienega Blvd', neighborhood: 'West Hollywood', coords: { lat: 34.0793, lng: -118.3765 }, cuisine: ['Japanese', 'Sushi'], vibes: ['Special Occasion', 'Date Night'], priceLevel: 4, spotRating: 4.9, isPartner: true, photos: [], createdAt: demoISO(-35), updatedAt: demoISO(-2) },
  { restaurantId: 'la6', name: 'Howlin\' Ray\'s', address: '727 N Broadway', neighborhood: 'Chinatown', coords: { lat: 34.0619, lng: -118.2397 }, cuisine: ['Southern', 'American'], vibes: ['Casual'], priceLevel: 2, spotRating: 4.5, isPartner: false, photos: [], createdAt: demoISO(-25), updatedAt: demoISO(-8) },
  { restaurantId: 'la7', name: 'Gjelina', address: '1429 Abbot Kinney Blvd', neighborhood: 'Venice', coords: { lat: 33.9924, lng: -118.4677 }, cuisine: ['American', 'Mediterranean'], vibes: ['Brunch', 'Outdoor'], priceLevel: 3, spotRating: 4.6, isPartner: true, photos: [], createdAt: demoISO(-15), updatedAt: demoISO(-5) },
  { restaurantId: 'la8', name: 'Bavel', address: '500 Mateo St', neighborhood: 'Arts District', coords: { lat: 34.0361, lng: -118.2322 }, cuisine: ['Middle Eastern', 'Mediterranean'], vibes: ['Date Night', 'Group Friendly'], priceLevel: 3, spotRating: 4.7, isPartner: false, photos: [], createdAt: demoISO(-10), updatedAt: demoISO(-7) },
];

const MIA_RESTAURANTS: Restaurant[] = [
  { restaurantId: 'mia1', name: 'Ariete', address: '3540 Main Hwy', neighborhood: 'Coconut Grove', coords: { lat: 25.7281, lng: -80.2409 }, cuisine: ['American', 'Latin'], vibes: ['Date Night', 'Brunch'], priceLevel: 3, spotRating: 4.7, isPartner: true, photos: [], createdAt: demoISO(-70), updatedAt: demoISO(-2) },
  { restaurantId: 'mia2', name: 'Versailles', address: '3555 SW 8th St', neighborhood: 'Little Havana', coords: { lat: 25.7652, lng: -80.2455 }, cuisine: ['Cuban'], vibes: ['Casual', 'Group Friendly'], priceLevel: 2, spotRating: 4.5, isPartner: false, photos: [], createdAt: demoISO(-60), updatedAt: demoISO(-5) },
  { restaurantId: 'mia3', name: 'KYU', address: '251 NW 25th St', neighborhood: 'Wynwood', coords: { lat: 25.7983, lng: -80.1994 }, cuisine: ['Asian', 'BBQ'], vibes: ['Date Night', 'Group Friendly'], priceLevel: 3, spotRating: 4.6, isPartner: true, photos: [], createdAt: demoISO(-50), updatedAt: demoISO(-3) },
  { restaurantId: 'mia4', name: 'Joe\'s Stone Crab', address: '11 Washington Ave', neighborhood: 'South Beach', coords: { lat: 25.7693, lng: -80.1348 }, cuisine: ['Seafood', 'American'], vibes: ['Special Occasion'], priceLevel: 4, spotRating: 4.7, isPartner: true, photos: [], createdAt: demoISO(-40), updatedAt: demoISO(-1) },
  { restaurantId: 'mia5', name: 'Zak the Baker', address: '405 NW 26th St', neighborhood: 'Wynwood', coords: { lat: 25.7996, lng: -80.2007 }, cuisine: ['American', 'Bakery'], vibes: ['Brunch', 'Casual'], priceLevel: 2, spotRating: 4.4, isPartner: false, photos: [], createdAt: demoISO(-30), updatedAt: demoISO(-7) },
  { restaurantId: 'mia6', name: 'Cvi.che 105', address: '105 NE 3rd Ave', neighborhood: 'Downtown', coords: { lat: 25.7745, lng: -80.1900 }, cuisine: ['Peruvian'], vibes: ['Casual', 'Group Friendly'], priceLevel: 2, spotRating: 4.5, isPartner: true, photos: [], createdAt: demoISO(-20), updatedAt: demoISO(-4) },
  { restaurantId: 'mia7', name: 'Mandolin Aegean Bistro', address: '4312 NE 2nd Ave', neighborhood: 'Design District', coords: { lat: 25.8149, lng: -80.1919 }, cuisine: ['Mediterranean', 'Greek'], vibes: ['Date Night', 'Outdoor'], priceLevel: 3, spotRating: 4.6, isPartner: true, photos: [], createdAt: demoISO(-10), updatedAt: demoISO(-6) },
];

const BALT_RESTAURANTS: Restaurant[] = [
  { restaurantId: 'balt1', name: 'Ekiben', address: '1622 Eastern Ave', neighborhood: 'Fells Point', coords: { lat: 39.2846, lng: -76.5917 }, cuisine: ['Asian', 'Fusion'], vibes: ['Casual', 'Quick Bite'], priceLevel: 2, spotRating: 4.6, isPartner: true, photos: [], createdAt: demoISO(-50), updatedAt: demoISO(-3) },
  { restaurantId: 'balt2', name: 'Thames Street Oyster House', address: '1728 Thames St', neighborhood: 'Fells Point', coords: { lat: 39.2822, lng: -76.5927 }, cuisine: ['Seafood', 'American'], vibes: ['Date Night', 'Special Occasion'], priceLevel: 3, spotRating: 4.7, isPartner: true, photos: [], createdAt: demoISO(-40), updatedAt: demoISO(-1) },
  { restaurantId: 'balt3', name: 'LP Steamers', address: '1100 E Fort Ave', neighborhood: 'Locust Point', coords: { lat: 39.2698, lng: -76.5879 }, cuisine: ['Seafood'], vibes: ['Casual', 'Group Friendly'], priceLevel: 2, spotRating: 4.5, isPartner: false, photos: [], createdAt: demoISO(-30), updatedAt: demoISO(-5) },
  { restaurantId: 'balt4', name: 'Alma Cocina Latina', address: '2400 Boston St', neighborhood: 'Canton', coords: { lat: 39.2812, lng: -76.5761 }, cuisine: ['Latin', 'Venezuelan'], vibes: ['Brunch', 'Date Night'], priceLevel: 3, spotRating: 4.6, isPartner: true, photos: [], createdAt: demoISO(-20), updatedAt: demoISO(-4) },
  { restaurantId: 'balt5', name: 'Dylan\'s Oyster Cellar', address: '3823 Chestnut Ave', neighborhood: 'Hampden', coords: { lat: 39.3307, lng: -76.6357 }, cuisine: ['Seafood', 'American'], vibes: ['Casual', 'Date Night'], priceLevel: 2, spotRating: 4.4, isPartner: false, photos: [], createdAt: demoISO(-10), updatedAt: demoISO(-8) },
];

/** City-keyed map of all demo restaurants. */
export const DEMO_RESTAURANTS_BY_CITY: Record<string, Restaurant[]> = {
  'Washington, DC': DC_RESTAURANTS,
  'New York, NY': NYC_RESTAURANTS,
  'Atlanta, GA': ATL_RESTAURANTS,
  'Chicago, IL': CHI_RESTAURANTS,
  'Los Angeles, CA': LA_RESTAURANTS,
  'Miami, FL': MIA_RESTAURANTS,
  'Baltimore, MD': BALT_RESTAURANTS,
};

/** Flat list of all demo restaurants (for backwards compat with campaigns/offers). */
export const DEMO_RESTAURANTS: Restaurant[] = DC_RESTAURANTS;

/* ─── Campaigns ────────────────────────────────────────────────────────────── */

export const DEMO_CAMPAIGNS: Campaign[] = [
  // Inquiry (2)
  { campaignId: 'c1', restaurantId: 'r9', restaurantName: 'Centrolina', status: 'inquiry', package: 'Spotlight', budget: 2500, deliverables: [], notes: 'Reached out about their new spring menu', createdAt: demoISO(-3), updatedAt: demoISO(-1) },
  { campaignId: 'c2', restaurantId: 'r13', restaurantName: 'Estadio', status: 'inquiry', package: 'Feature', budget: 3500, deliverables: [], notes: 'Interested in tapas night coverage', createdAt: demoISO(-2), updatedAt: demoISO(-1) },
  // Negotiation (2)
  { campaignId: 'c3', restaurantId: 'r7', restaurantName: 'Maydan', status: 'negotiation', package: 'Series', budget: 5000, startDate: demoDate(14), endDate: demoDate(44), deliverables: [{ id: 'd1', type: 'reel', description: 'Dining experience reel', completed: false }, { id: 'd2', type: 'story', description: 'Story series (3 frames)', completed: false }, { id: 'd3', type: 'tiktok', description: 'TikTok review', completed: false }], notes: 'Negotiating deliverable scope', createdAt: demoISO(-10), updatedAt: demoISO(-2) },
  { campaignId: 'c4', restaurantId: 'r4', restaurantName: 'Tail Up Goat', status: 'negotiation', package: 'Spotlight', budget: 2800, deliverables: [{ id: 'd4', type: 'reel', description: 'Kitchen feature reel', completed: false }, { id: 'd5', type: 'post', description: 'Feed post with review', completed: false }], createdAt: demoISO(-8), updatedAt: demoISO(-1) },
  // Active (3)
  { campaignId: 'c5', restaurantId: 'r1', restaurantName: 'Rasika', status: 'active', package: 'Feature', budget: 4000, startDate: demoDate(-14), endDate: demoDate(16), deliverables: [{ id: 'd6', type: 'reel', description: 'Signature dishes reel', completed: true, completedAt: demoISO(-5) }, { id: 'd7', type: 'story', description: 'Behind-the-scenes stories', completed: true, completedAt: demoISO(-3) }, { id: 'd8', type: 'tiktok', description: 'TikTok taste test', completed: false }, { id: 'd9', type: 'post', description: 'Carousel post', completed: false }], createdAt: demoISO(-30), updatedAt: demoISO(-1) },
  { campaignId: 'c6', restaurantId: 'r3', restaurantName: 'The Dabney', status: 'active', package: 'Series', budget: 4500, startDate: demoDate(-7), endDate: demoDate(23), deliverables: [{ id: 'd10', type: 'reel', description: 'Farm-to-table journey', completed: true, completedAt: demoISO(-2) }, { id: 'd11', type: 'reel', description: 'Chef interview reel', completed: false }, { id: 'd12', type: 'tiktok', description: 'Day in the life at Dabney', completed: false }], createdAt: demoISO(-25), updatedAt: demoISO(-1) },
  { campaignId: 'c7', restaurantId: 'r12', restaurantName: 'Le Diplomate', status: 'active', package: 'Takeover', budget: 3200, startDate: demoDate(-5), endDate: demoDate(25), deliverables: [{ id: 'd13', type: 'story', description: 'Weekend brunch takeover', completed: false }, { id: 'd14', type: 'reel', description: 'Brunch highlights reel', completed: false }], createdAt: demoISO(-20), updatedAt: demoISO(-1) },
  // Completed (2)
  { campaignId: 'c8', restaurantId: 'r6', restaurantName: "Rose's Luxury", status: 'completed', package: 'Feature', budget: 3500, startDate: demoDate(-60), endDate: demoDate(-30), deliverables: [{ id: 'd15', type: 'reel', description: 'Tasting menu reel', completed: true, completedAt: demoISO(-35) }, { id: 'd16', type: 'story', description: 'Stories with owner', completed: true, completedAt: demoISO(-33) }, { id: 'd17', type: 'tiktok', description: 'TikTok review', completed: true, completedAt: demoISO(-31) }], createdAt: demoISO(-75), updatedAt: demoISO(-30) },
  { campaignId: 'c9', restaurantId: 'r2', restaurantName: 'Bad Saint', status: 'completed', package: 'Spotlight', budget: 2000, startDate: demoDate(-45), endDate: demoDate(-25), deliverables: [{ id: 'd18', type: 'reel', description: 'Filipino food intro', completed: true, completedAt: demoISO(-28) }, { id: 'd19', type: 'post', description: 'Feed post', completed: true, completedAt: demoISO(-26) }], createdAt: demoISO(-60), updatedAt: demoISO(-25) },
  // Cancelled (1)
  { campaignId: 'c10', restaurantId: 'r11', restaurantName: 'Founding Farmers', status: 'cancelled', package: 'Custom', budget: 1500, deliverables: [], notes: 'Budget mismatch', createdAt: demoISO(-40), updatedAt: demoISO(-35) },
];

/* ─── Pipeline ─────────────────────────────────────────────────────────────── */

export const DEMO_PIPELINE: PartnershipPipeline = {
  total: 10,
  byStatus: {
    inquiry: 2,
    negotiation: 2,
    active: 3,
    completed: 2,
    cancelled: 1,
  },
  totalRevenue: 31500,
  avgDealSize: 3150,
};

/* ─── Content ──────────────────────────────────────────────────────────────── */

export const DEMO_CONTENT: ContentItem[] = [
  { contentId: 'ct1', platform: 'instagram', postUrl: '#', restaurantId: 'r1', restaurantName: 'Rasika', postedAt: demoISO(-5), metrics: { postId: 'ct1', platform: 'instagram', postUrl: '#', postedAt: demoISO(-5), impressions: 185000, reach: 142000, saves: 8200, shares: 3100, comments: 890, likes: 24500 }, tags: ['indian', 'dc-food', 'rasika', 'fine-dining'] },
  { contentId: 'ct2', platform: 'tiktok', postUrl: '#', restaurantId: 'r1', restaurantName: 'Rasika', postedAt: demoISO(-4), metrics: { postId: 'ct2', platform: 'tiktok', postUrl: '#', postedAt: demoISO(-4), impressions: 210000, reach: 178000, saves: 9500, shares: 5200, comments: 1200, likes: 31000 }, tags: ['indian-food', 'dc', 'rasika', 'taste-test'] },
  { contentId: 'ct3', platform: 'instagram', postUrl: '#', restaurantId: 'r3', restaurantName: 'The Dabney', postedAt: demoISO(-3), metrics: { postId: 'ct3', platform: 'instagram', postUrl: '#', postedAt: demoISO(-3), impressions: 165000, reach: 128000, saves: 7800, shares: 2800, comments: 720, likes: 21000 }, tags: ['farm-to-table', 'the-dabney', 'dc-eats', 'shaw'] },
  { contentId: 'ct4', platform: 'instagram', postUrl: '#', restaurantId: 'r6', restaurantName: "Rose's Luxury", postedAt: demoISO(-35), metrics: { postId: 'ct4', platform: 'instagram', postUrl: '#', postedAt: demoISO(-35), impressions: 198000, reach: 156000, saves: 11200, shares: 4100, comments: 980, likes: 28000 }, tags: ['roses-luxury', 'capitol-hill', 'tasting-menu', 'dc-food'] },
  { contentId: 'ct5', platform: 'tiktok', postUrl: '#', restaurantId: 'r6', restaurantName: "Rose's Luxury", postedAt: demoISO(-33), metrics: { postId: 'ct5', platform: 'tiktok', postUrl: '#', postedAt: demoISO(-33), impressions: 245000, reach: 201000, saves: 12800, shares: 6700, comments: 1500, likes: 38000 }, tags: ['roses-luxury', 'dc-food', 'fine-dining', 'must-try'] },
  { contentId: 'ct6', platform: 'instagram', postUrl: '#', restaurantId: 'r2', restaurantName: 'Bad Saint', postedAt: demoISO(-28), metrics: { postId: 'ct6', platform: 'instagram', postUrl: '#', postedAt: demoISO(-28), impressions: 145000, reach: 112000, saves: 6500, shares: 2400, comments: 650, likes: 18500 }, tags: ['bad-saint', 'filipino', 'columbia-heights', 'hidden-gem'] },
  { contentId: 'ct7', platform: 'tiktok', postUrl: '#', restaurantId: 'r2', restaurantName: 'Bad Saint', postedAt: demoISO(-26), metrics: { postId: 'ct7', platform: 'tiktok', postUrl: '#', postedAt: demoISO(-26), impressions: 178000, reach: 145000, saves: 7200, shares: 3800, comments: 920, likes: 22000 }, tags: ['filipino-food', 'dc', 'bad-saint', 'food-review'] },
  { contentId: 'ct8', platform: 'instagram', postUrl: '#', restaurantId: 'r5', restaurantName: 'Compass Rose', postedAt: demoISO(-20), metrics: { postId: 'ct8', platform: 'instagram', postUrl: '#', postedAt: demoISO(-20), impressions: 132000, reach: 98000, saves: 5400, shares: 1900, comments: 480, likes: 15200 }, tags: ['compass-rose', 'u-street', 'tapas', 'international'] },
  { contentId: 'ct9', platform: 'instagram', postUrl: '#', restaurantId: 'r8', restaurantName: 'Tiger Fork', postedAt: demoISO(-18), metrics: { postId: 'ct9', platform: 'instagram', postUrl: '#', postedAt: demoISO(-18), impressions: 118000, reach: 88000, saves: 4800, shares: 1700, comments: 420, likes: 13800 }, tags: ['tiger-fork', 'dim-sum', 'shaw', 'chinese-food'] },
  { contentId: 'ct10', platform: 'tiktok', postUrl: '#', restaurantId: 'r10', restaurantName: 'Thip Khao', postedAt: demoISO(-15), metrics: { postId: 'ct10', platform: 'tiktok', postUrl: '#', postedAt: demoISO(-15), impressions: 195000, reach: 162000, saves: 8900, shares: 4600, comments: 1100, likes: 26500 }, tags: ['thip-khao', 'laotian', 'spicy-food', 'dc-hidden-gem'] },
  { contentId: 'ct11', platform: 'instagram', postUrl: '#', restaurantId: 'r12', restaurantName: 'Le Diplomate', postedAt: demoISO(-12), metrics: { postId: 'ct11', platform: 'instagram', postUrl: '#', postedAt: demoISO(-12), impressions: 155000, reach: 121000, saves: 7100, shares: 2600, comments: 680, likes: 19800 }, tags: ['le-diplomate', 'french', 'brunch', 'logan-circle'] },
  { contentId: 'ct12', platform: 'tiktok', postUrl: '#', restaurantId: 'r14', restaurantName: 'Ambar', postedAt: demoISO(-10), metrics: { postId: 'ct12', platform: 'tiktok', postUrl: '#', postedAt: demoISO(-10), impressions: 168000, reach: 138000, saves: 7600, shares: 3500, comments: 870, likes: 21500 }, tags: ['ambar', 'balkan', 'unlimited-brunch', 'capitol-hill'] },
  { contentId: 'ct13', platform: 'instagram', postUrl: '#', restaurantId: 'r16', restaurantName: 'Doi Moi', postedAt: demoISO(-8), metrics: { postId: 'ct13', platform: 'instagram', postUrl: '#', postedAt: demoISO(-8), impressions: 128000, reach: 95000, saves: 5100, shares: 1800, comments: 450, likes: 14200 }, tags: ['doi-moi', 'vietnamese', 'u-street', 'cocktails'] },
  { contentId: 'ct14', platform: 'tiktok', postUrl: '#', restaurantId: 'r18', restaurantName: 'Chercher', postedAt: demoISO(-6), metrics: { postId: 'ct14', platform: 'tiktok', postUrl: '#', postedAt: demoISO(-6), impressions: 152000, reach: 125000, saves: 6800, shares: 3200, comments: 780, likes: 19000 }, tags: ['chercher', 'ethiopian', 'shaw', 'injera'] },
  { contentId: 'ct15', platform: 'instagram', postUrl: '#', restaurantId: 'r7', restaurantName: 'Maydan', postedAt: demoISO(-2), metrics: { postId: 'ct15', platform: 'instagram', postUrl: '#', postedAt: demoISO(-2), impressions: 172000, reach: 135000, saves: 8500, shares: 3400, comments: 820, likes: 23000 }, tags: ['maydan', 'middle-eastern', 'fire-cooking', 'u-street'] },
];

/* ─── Editorial Calendar Slots ─────────────────────────────────────────────── */

export const DEMO_EDITORIAL_SLOTS: EditorialSlot[] = [
  { slotId: 'es1', date: demoDate(-2), restaurantId: 'r1', restaurantName: 'Rasika', type: 'sponsored', status: 'published', notes: 'Feature reel posted' },
  { slotId: 'es2', date: demoDate(-1), restaurantId: 'r3', restaurantName: 'The Dabney', type: 'sponsored', status: 'editing' },
  { slotId: 'es3', date: demoDate(0), restaurantId: 'r18', restaurantName: 'Chercher', type: 'organic', status: 'shot', notes: 'Quick bite content' },
  { slotId: 'es4', date: demoDate(1), restaurantId: 'r12', restaurantName: 'Le Diplomate', type: 'sponsored', status: 'planned', notes: 'Brunch takeover' },
  { slotId: 'es5', date: demoDate(2), restaurantId: 'r7', restaurantName: 'Maydan', type: 'organic', status: 'planned' },
  { slotId: 'es6', date: demoDate(3), restaurantName: 'Thip Khao', type: 'organic', status: 'planned', notes: 'Laotian food explainer' },
  { slotId: 'es7', date: demoDate(5), restaurantId: 'r5', restaurantName: 'Compass Rose', type: 'sponsored', status: 'planned' },
  { slotId: 'es8', date: demoDate(6), restaurantName: 'Tiger Fork', type: 'reshoot', status: 'planned', notes: 'Re-shoot dim sum content' },
  { slotId: 'es9', date: demoDate(8), restaurantId: 'r14', restaurantName: 'Ambar', type: 'organic', status: 'planned' },
  { slotId: 'es10', date: demoDate(10), restaurantId: 'r16', restaurantName: 'Doi Moi', type: 'sponsored', status: 'planned', notes: 'New cocktail menu' },
  { slotId: 'es11', date: demoDate(12), restaurantName: 'Bad Saint', type: 'reshoot', status: 'planned' },
  { slotId: 'es12', date: demoDate(14), restaurantId: 'r6', restaurantName: "Rose's Luxury", type: 'organic', status: 'planned', notes: 'Summer menu preview' },
];

/* ─── Campaign Reports ─────────────────────────────────────────────────────── */

export const DEMO_CAMPAIGN_REPORTS: CampaignReport[] = [
  {
    reportId: 'rpt1', campaignId: 'c8', restaurantName: "Rose's Luxury",
    period: { start: demoDate(-60), end: demoDate(-30) },
    metrics: { totalReach: 357000, totalImpressions: 443000, totalSaves: 24000, totalShares: 10800, totalComments: 2480, qrScans: 1240, offerRedemptions: 186, estimatedVisits: 310, engagementRate: 0.084 },
    posts: [
      { postId: 'p1', platform: 'instagram', postUrl: '#', postedAt: demoISO(-35), impressions: 198000, reach: 156000, saves: 11200, shares: 4100, comments: 980, likes: 28000 },
      { postId: 'p2', platform: 'tiktok', postUrl: '#', postedAt: demoISO(-33), impressions: 245000, reach: 201000, saves: 12800, shares: 6700, comments: 1500, likes: 38000 },
    ],
    generatedAt: demoISO(-29),
  },
  {
    reportId: 'rpt2', campaignId: 'c9', restaurantName: 'Bad Saint',
    period: { start: demoDate(-45), end: demoDate(-25) },
    metrics: { totalReach: 257000, totalImpressions: 323000, totalSaves: 13700, totalShares: 6200, totalComments: 1570, qrScans: 820, offerRedemptions: 123, estimatedVisits: 205, engagementRate: 0.066 },
    posts: [
      { postId: 'p3', platform: 'instagram', postUrl: '#', postedAt: demoISO(-28), impressions: 145000, reach: 112000, saves: 6500, shares: 2400, comments: 650, likes: 18500 },
      { postId: 'p4', platform: 'tiktok', postUrl: '#', postedAt: demoISO(-26), impressions: 178000, reach: 145000, saves: 7200, shares: 3800, comments: 920, likes: 22000 },
    ],
    generatedAt: demoISO(-24),
  },
  {
    reportId: 'rpt3', campaignId: 'c5', restaurantName: 'Rasika',
    period: { start: demoDate(-14), end: demoDate(0) },
    metrics: { totalReach: 320000, totalImpressions: 395000, totalSaves: 17700, totalShares: 8300, totalComments: 2090, qrScans: 980, offerRedemptions: 147, estimatedVisits: 245, engagementRate: 0.071 },
    posts: [
      { postId: 'p5', platform: 'instagram', postUrl: '#', postedAt: demoISO(-5), impressions: 185000, reach: 142000, saves: 8200, shares: 3100, comments: 890, likes: 24500 },
      { postId: 'p6', platform: 'tiktok', postUrl: '#', postedAt: demoISO(-4), impressions: 210000, reach: 178000, saves: 9500, shares: 5200, comments: 1200, likes: 31000 },
    ],
    generatedAt: demoISO(0),
  },
];

/* ─── Offers ───────────────────────────────────────────────────────────────── */

export const DEMO_OFFERS: Offer[] = [
  { offerId: 'o1', restaurantId: 'r1', code: 'SPOT-RASIKA', type: 'qr', description: '15% off when you show this QR to your server', landingPageUrl: '#', scans: 342, redemptions: 48, isActive: true, createdAt: demoISO(-30), expiresAt: demoDate(30) },
  { offerId: 'o2', restaurantId: 'r6', code: 'SPOT20ROSES', type: 'promo', description: '$20 off your first visit — use code at checkout', landingPageUrl: '#', scans: 0, redemptions: 186, isActive: true, createdAt: demoISO(-60) },
  { offerId: 'o3', restaurantId: 'r3', code: 'spot-dabney-spring', type: 'link', description: 'Track visits from The Dabney spring campaign', landingPageUrl: '#', scans: 215, redemptions: 32, isActive: true, createdAt: demoISO(-14), expiresAt: demoDate(45) },
  { offerId: 'o4', restaurantId: 'r2', code: 'SPOT-BS', type: 'qr', description: 'Complimentary dessert with entree purchase', landingPageUrl: '#', scans: 520, redemptions: 123, isActive: false, createdAt: demoISO(-45), expiresAt: demoDate(-5) },
  { offerId: 'o5', restaurantId: 'r12', code: 'BRUNCH-DIPLO', type: 'promo', description: 'Free mimosa with brunch — use code at checkout', landingPageUrl: '#', scans: 0, redemptions: 67, isActive: true, createdAt: demoISO(-5), expiresAt: demoDate(20) },
];

/* ─── Deals (Insider) ──────────────────────────────────────────────────────── */

export const DEMO_DEALS: DealOffer[] = [
  { dealId: 'dl1', restaurantId: 'r1', restaurantName: 'Rasika', title: '15% Off Dinner for Two', description: 'Enjoy 15% off your dinner bill when dining as a party of 2 or more. Valid Sunday through Thursday.', insiderOnly: true, expiresAt: demoDate(14) },
  { dealId: 'dl2', restaurantId: 'r6', restaurantName: "Rose's Luxury", title: 'Priority Seating', description: 'Skip the walk-in line with Insider priority seating. Show your membership at the door.', insiderOnly: true, expiresAt: demoDate(30) },
  { dealId: 'dl3', restaurantId: 'r3', restaurantName: 'The Dabney', title: 'Complimentary Dessert', description: 'Enjoy a complimentary dessert course with any tasting menu order.', insiderOnly: true, expiresAt: demoDate(21) },
  { dealId: 'dl4', restaurantId: 'r12', restaurantName: 'Le Diplomate', title: 'Free Mimosa at Brunch', description: 'One complimentary mimosa with any brunch entree purchase. Weekends only.', insiderOnly: false, expiresAt: demoDate(10) },
  { dealId: 'dl5', restaurantId: 'r10', restaurantName: 'Thip Khao', title: '$10 Off Your First Visit', description: 'New visitors get $10 off orders of $40 or more. Show this deal at checkout.', insiderOnly: false, expiresAt: demoDate(7) },
  { dealId: 'dl6', restaurantId: 'r14', restaurantName: 'Ambar', title: 'Unlimited Small Plates', description: 'Upgrade to the unlimited small plates experience for free with any drink purchase.', insiderOnly: false },
];

/* ─── Saved Restaurants (Insider) ──────────────────────────────────────────── */

export const DEMO_SAVED: SavedRestaurant[] = [
  { restaurantId: 'r7', savedAt: demoISO(-5), notes: 'Want to try the wood-fired dishes', occasion: 'Date Night' },
  { restaurantId: 'r4', savedAt: demoISO(-12), notes: 'Heard the brunch is amazing', occasion: 'Brunch' },
  { restaurantId: 'r9', savedAt: demoISO(-8), occasion: 'Business' },
  { restaurantId: 'r17', savedAt: demoISO(-3), notes: 'Outdoor seating looks great', occasion: 'Casual' },
  { restaurantId: 'r15', savedAt: demoISO(-15), occasion: 'Brunch' },
];
