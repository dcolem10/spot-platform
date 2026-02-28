/**
 * DynamoDB seed script — populates spot-data-{env} with demo data.
 * Usage: TABLE_NAME=spot-data-dev node seed.mjs
 * Or:    npm run seed  (from repo root, defaults to spot-data-dev)
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

const TABLE = process.env.TABLE_NAME || 'spot-data-dev';
const REGION = process.env.AWS_REGION || 'us-east-1';

const client = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(client);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function demoDate(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

function demoISO(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString();
}

// ─── Restaurants ──────────────────────────────────────────────────────────────

const restaurants = [
  { restaurantId: 'r1', name: 'Rasika', address: '633 D St NW', neighborhood: 'Penn Quarter', coords: { lat: 38.8949, lng: -77.0218 }, cuisine: ['Indian', 'Modern'], vibes: ['Date Night', 'Special Occasion'], priceLevel: 3, spotRating: 4.8, isPartner: true, photos: [], reservationUrl: 'https://rasika.com' },
  { restaurantId: 'r2', name: 'Bad Saint', address: '3226 11th St NW', neighborhood: 'Columbia Heights', coords: { lat: 38.9314, lng: -77.0257 }, cuisine: ['Filipino'], vibes: ['Casual', 'Group Friendly'], priceLevel: 2, spotRating: 4.7, isPartner: true, photos: [] },
  { restaurantId: 'r3', name: 'The Dabney', address: '122 Blagden Alley NW', neighborhood: 'Shaw', coords: { lat: 38.9088, lng: -77.0221 }, cuisine: ['American', 'Mid-Atlantic'], vibes: ['Date Night'], priceLevel: 4, spotRating: 4.9, isPartner: true, photos: [], reservationUrl: 'https://thedabney.com' },
  { restaurantId: 'r4', name: 'Tail Up Goat', address: '1827 Adams Mill Rd NW', neighborhood: 'Adams Morgan', coords: { lat: 38.9222, lng: -77.0425 }, cuisine: ['Mediterranean', 'Caribbean'], vibes: ['Date Night', 'Brunch'], priceLevel: 3, spotRating: 4.6, isPartner: false, photos: [] },
  { restaurantId: 'r5', name: 'Compass Rose', address: '1346 T St NW', neighborhood: 'U Street', coords: { lat: 38.9157, lng: -77.0300 }, cuisine: ['International', 'Tapas'], vibes: ['Date Night', 'Group Friendly'], priceLevel: 3, spotRating: 4.5, isPartner: true, photos: [] },
  { restaurantId: 'r6', name: "Rose's Luxury", address: '717 8th St SE', neighborhood: 'Capitol Hill', coords: { lat: 38.8809, lng: -76.9953 }, cuisine: ['American', 'Modern'], vibes: ['Special Occasion', 'Date Night'], priceLevel: 4, spotRating: 4.9, isPartner: true, photos: [] },
  { restaurantId: 'r7', name: 'Maydan', address: '1346 Florida Ave NW', neighborhood: 'U Street', coords: { lat: 38.9168, lng: -77.0297 }, cuisine: ['Middle Eastern', 'North African'], vibes: ['Group Friendly', 'Special Occasion'], priceLevel: 3, spotRating: 4.7, isPartner: false, photos: [] },
  { restaurantId: 'r8', name: 'Tiger Fork', address: '922 N St NW', neighborhood: 'Shaw', coords: { lat: 38.9082, lng: -77.0232 }, cuisine: ['Chinese', 'Hong Kong'], vibes: ['Casual', 'Late Night'], priceLevel: 2, spotRating: 4.4, isPartner: true, photos: [] },
  { restaurantId: 'r9', name: 'Centrolina', address: '974 Palmer Alley NW', neighborhood: 'CityCenterDC', coords: { lat: 38.9009, lng: -77.0245 }, cuisine: ['Italian'], vibes: ['Brunch', 'Date Night'], priceLevel: 3, spotRating: 4.5, isPartner: false, photos: [] },
  { restaurantId: 'r10', name: 'Thip Khao', address: '3462 14th St NW', neighborhood: 'Columbia Heights', coords: { lat: 38.9340, lng: -77.0326 }, cuisine: ['Laotian', 'Thai'], vibes: ['Casual', 'Group Friendly'], priceLevel: 2, spotRating: 4.6, isPartner: true, photos: [] },
  { restaurantId: 'r11', name: 'Founding Farmers', address: '1924 Pennsylvania Ave NW', neighborhood: 'Foggy Bottom', coords: { lat: 38.9009, lng: -77.0460 }, cuisine: ['American', 'Farm-to-Table'], vibes: ['Brunch', 'Group Friendly'], priceLevel: 2, spotRating: 4.2, isPartner: false, photos: [] },
  { restaurantId: 'r12', name: 'Le Diplomate', address: '1601 14th St NW', neighborhood: 'Logan Circle', coords: { lat: 38.9115, lng: -77.0326 }, cuisine: ['French', 'Bistro'], vibes: ['Brunch', 'Date Night', 'Outdoor'], priceLevel: 3, spotRating: 4.5, isPartner: true, photos: [], reservationUrl: 'https://lediplomatedc.com' },
  { restaurantId: 'r13', name: 'Estadio', address: '1520 14th St NW', neighborhood: 'Logan Circle', coords: { lat: 38.9098, lng: -77.0326 }, cuisine: ['Spanish', 'Tapas'], vibes: ['Date Night', 'Group Friendly'], priceLevel: 3, spotRating: 4.4, isPartner: false, photos: [] },
  { restaurantId: 'r14', name: 'Ambar', address: '523 8th St SE', neighborhood: 'Capitol Hill', coords: { lat: 38.8825, lng: -76.9953 }, cuisine: ['Balkan', 'Mediterranean'], vibes: ['Brunch', 'Group Friendly'], priceLevel: 2, spotRating: 4.3, isPartner: true, photos: [] },
  { restaurantId: 'r15', name: 'Unconventional Diner', address: '1207 9th St NW', neighborhood: 'Shaw', coords: { lat: 38.9070, lng: -77.0232 }, cuisine: ['American', 'Diner'], vibes: ['Casual', 'Brunch'], priceLevel: 2, spotRating: 4.1, isPartner: false, photos: [] },
  { restaurantId: 'r16', name: 'Doi Moi', address: '1800 14th St NW', neighborhood: 'U Street', coords: { lat: 38.9137, lng: -77.0326 }, cuisine: ['Vietnamese', 'Thai'], vibes: ['Date Night', 'Late Night'], priceLevel: 2, spotRating: 4.3, isPartner: true, photos: [] },
  { restaurantId: 'r17', name: 'Chloe', address: '1331 4th St SE', neighborhood: 'Navy Yard', coords: { lat: 38.8756, lng: -77.0001 }, cuisine: ['American', 'Modern'], vibes: ['Brunch', 'Outdoor'], priceLevel: 3, spotRating: 4.4, isPartner: false, photos: [] },
  { restaurantId: 'r18', name: 'Chercher', address: '1334 9th St NW', neighborhood: 'Shaw', coords: { lat: 38.9082, lng: -77.0232 }, cuisine: ['Ethiopian'], vibes: ['Casual', 'Group Friendly'], priceLevel: 2, spotRating: 4.5, isPartner: true, photos: [] },
];

// ─── Campaigns ────────────────────────────────────────────────────────────────

const campaigns = [
  { campaignId: 'c1', restaurantId: 'r9', restaurantName: 'Centrolina', status: 'inquiry', package: 'Spotlight', budget: 2500, deliverables: [], notes: 'Reached out about their new spring menu' },
  { campaignId: 'c2', restaurantId: 'r13', restaurantName: 'Estadio', status: 'inquiry', package: 'Feature', budget: 3500, deliverables: [], notes: 'Interested in tapas night coverage' },
  { campaignId: 'c3', restaurantId: 'r7', restaurantName: 'Maydan', status: 'negotiation', package: 'Series', budget: 5000, startDate: demoDate(14), endDate: demoDate(44), deliverables: [{ id: 'd1', type: 'reel', description: 'Dining experience reel', completed: false }, { id: 'd2', type: 'story', description: 'Story series (3 frames)', completed: false }, { id: 'd3', type: 'tiktok', description: 'TikTok review', completed: false }], notes: 'Negotiating deliverable scope' },
  { campaignId: 'c4', restaurantId: 'r4', restaurantName: 'Tail Up Goat', status: 'negotiation', package: 'Spotlight', budget: 2800, deliverables: [{ id: 'd4', type: 'reel', description: 'Kitchen feature reel', completed: false }, { id: 'd5', type: 'post', description: 'Feed post with review', completed: false }] },
  { campaignId: 'c5', restaurantId: 'r1', restaurantName: 'Rasika', status: 'active', package: 'Feature', budget: 4000, startDate: demoDate(-14), endDate: demoDate(16), deliverables: [{ id: 'd6', type: 'reel', description: 'Signature dishes reel', completed: true, completedAt: demoISO(-5) }, { id: 'd7', type: 'story', description: 'Behind-the-scenes stories', completed: true, completedAt: demoISO(-3) }, { id: 'd8', type: 'tiktok', description: 'TikTok taste test', completed: false }, { id: 'd9', type: 'post', description: 'Carousel post', completed: false }] },
  { campaignId: 'c6', restaurantId: 'r3', restaurantName: 'The Dabney', status: 'active', package: 'Series', budget: 4500, startDate: demoDate(-7), endDate: demoDate(23), deliverables: [{ id: 'd10', type: 'reel', description: 'Farm-to-table journey', completed: true, completedAt: demoISO(-2) }, { id: 'd11', type: 'reel', description: 'Chef interview reel', completed: false }, { id: 'd12', type: 'tiktok', description: 'Day in the life at Dabney', completed: false }] },
  { campaignId: 'c7', restaurantId: 'r12', restaurantName: 'Le Diplomate', status: 'active', package: 'Takeover', budget: 3200, startDate: demoDate(-5), endDate: demoDate(25), deliverables: [{ id: 'd13', type: 'story', description: 'Weekend brunch takeover', completed: false }, { id: 'd14', type: 'reel', description: 'Brunch highlights reel', completed: false }] },
  { campaignId: 'c8', restaurantId: 'r6', restaurantName: "Rose's Luxury", status: 'completed', package: 'Feature', budget: 3500, startDate: demoDate(-60), endDate: demoDate(-30), deliverables: [{ id: 'd15', type: 'reel', description: 'Tasting menu reel', completed: true, completedAt: demoISO(-35) }, { id: 'd16', type: 'story', description: 'Stories with owner', completed: true, completedAt: demoISO(-33) }, { id: 'd17', type: 'tiktok', description: 'TikTok review', completed: true, completedAt: demoISO(-31) }] },
  { campaignId: 'c9', restaurantId: 'r2', restaurantName: 'Bad Saint', status: 'completed', package: 'Spotlight', budget: 2000, startDate: demoDate(-45), endDate: demoDate(-25), deliverables: [{ id: 'd18', type: 'reel', description: 'Filipino food intro', completed: true, completedAt: demoISO(-28) }, { id: 'd19', type: 'post', description: 'Feed post', completed: true, completedAt: demoISO(-26) }] },
  { campaignId: 'c10', restaurantId: 'r11', restaurantName: 'Founding Farmers', status: 'cancelled', package: 'Custom', budget: 1500, deliverables: [], notes: 'Budget mismatch' },
];

// ─── Offers ───────────────────────────────────────────────────────────────────

const offers = [
  { offerId: 'o1', restaurantId: 'r1', code: 'SPOT-RASIKA', type: 'qr', description: '15% off when you show this QR to your server', scans: 342, redemptions: 48, isActive: true, expiresAt: demoDate(30) },
  { offerId: 'o2', restaurantId: 'r6', code: 'SPOT20ROSES', type: 'promo', description: '$20 off your first visit — mention Demo Creator', scans: 0, redemptions: 186, isActive: true },
  { offerId: 'o3', restaurantId: 'r3', code: 'spot-dabney-spring', type: 'link', description: 'Track visits from The Dabney spring campaign', scans: 215, redemptions: 32, isActive: true, expiresAt: demoDate(45) },
  { offerId: 'o4', restaurantId: 'r2', code: 'SPOT-BS', type: 'qr', description: 'Complimentary dessert with entree purchase', scans: 520, redemptions: 123, isActive: false, expiresAt: demoDate(-5) },
  { offerId: 'o5', restaurantId: 'r12', code: 'BRUNCH-DIPLO', type: 'promo', description: 'Free mimosa with brunch — mention Demo Creator', scans: 0, redemptions: 67, isActive: true, expiresAt: demoDate(20) },
];

// ─── Deals ────────────────────────────────────────────────────────────────────

const deals = [
  { dealId: 'dl1', restaurantId: 'r1', restaurantName: 'Rasika', title: '15% Off Dinner for Two', description: 'Enjoy 15% off your dinner bill when dining as a party of 2 or more. Valid Sunday through Thursday.', insiderOnly: true, expiresAt: demoDate(14) },
  { dealId: 'dl2', restaurantId: 'r6', restaurantName: "Rose's Luxury", title: 'Priority Seating', description: 'Skip the walk-in line with Insider priority seating. Show your membership at the door.', insiderOnly: true, expiresAt: demoDate(30) },
  { dealId: 'dl3', restaurantId: 'r3', restaurantName: 'The Dabney', title: 'Complimentary Dessert', description: 'Enjoy a complimentary dessert course with any tasting menu order.', insiderOnly: true, expiresAt: demoDate(21) },
  { dealId: 'dl4', restaurantId: 'r12', restaurantName: 'Le Diplomate', title: 'Free Mimosa at Brunch', description: 'One complimentary mimosa with any brunch entree purchase. Weekends only.', insiderOnly: false, expiresAt: demoDate(10) },
  { dealId: 'dl5', restaurantId: 'r10', restaurantName: 'Thip Khao', title: '$10 Off Your First Visit', description: 'New visitors get $10 off orders of $40 or more. Show this deal at checkout.', insiderOnly: false, expiresAt: demoDate(7) },
  { dealId: 'dl6', restaurantId: 'r14', restaurantName: 'Ambar', title: 'Unlimited Small Plates', description: 'Upgrade to the unlimited small plates experience for free with any drink purchase.', insiderOnly: false },
];

// ─── Creator Profile ──────────────────────────────────────────────────────────

const creatorProfile = {
  creatorId: 'creator-demo',
  brandName: 'Demo Creator',
  platforms: {
    instagram: { handle: '@democreator', followers: 393000 },
    tiktok: { handle: '@democreator', followers: 187000 },
  },
  city: 'Washington, DC',
  niche: 'Food & Restaurants',
  monthlyRate: { min: 2500, max: 5000 },
};

// ─── Build DynamoDB Items ─────────────────────────────────────────────────────

function buildItems() {
  const items = [];
  const now = new Date().toISOString();

  // Restaurants
  for (const r of restaurants) {
    items.push({
      PK: `RESTAURANT#${r.restaurantId}`,
      SK: 'PROFILE',
      GSI1PK: 'RESTAURANTS',
      GSI1SK: `RESTAURANT#${r.restaurantId}`,
      ...r,
      createdAt: demoISO(-90),
      updatedAt: now,
    });
  }

  // Campaigns
  for (const c of campaigns) {
    items.push({
      PK: `RESTAURANT#${c.restaurantId}`,
      SK: `CAMPAIGN#${c.campaignId}`,
      GSI1PK: 'CAMPAIGNS',
      GSI1SK: `CAMPAIGN#${c.campaignId}`,
      ...c,
      createdAt: demoISO(-30),
      updatedAt: now,
    });
  }

  // Offers + OFFER_CODE lookup records
  for (const o of offers) {
    const offerItem = {
      PK: `RESTAURANT#${o.restaurantId}`,
      SK: `OFFER#${o.offerId}`,
      GSI1PK: 'OFFERS',
      GSI1SK: `OFFER#${o.offerId}`,
      ...o,
      landingPageUrl: `/r/${o.restaurantId}`,
      createdAt: demoISO(-30),
    };
    items.push(offerItem);

    // Lookup record for code-based scan/redeem
    items.push({
      PK: `OFFER_CODE#${o.code}`,
      SK: 'LOOKUP',
      restaurantPK: `RESTAURANT#${o.restaurantId}`,
      offerSK: `OFFER#${o.offerId}`,
      offerId: o.offerId,
      restaurantId: o.restaurantId,
      code: o.code,
      description: o.description,
      landingPageUrl: offerItem.landingPageUrl,
      isActive: o.isActive,
      expiresAt: o.expiresAt || null,
      createdAt: offerItem.createdAt,
    });
  }

  // Deals
  for (const d of deals) {
    items.push({
      PK: `RESTAURANT#${d.restaurantId}`,
      SK: `DEAL#${d.dealId}`,
      GSI1PK: 'DEALS',
      GSI1SK: `DEAL#${d.dealId}`,
      ...d,
      createdAt: demoISO(-14),
    });
  }

  // Creator profile
  items.push({
    PK: 'CREATOR#creator-demo',
    SK: 'PROFILE',
    GSI1PK: 'CREATORS',
    GSI1SK: 'CREATOR#creator-demo',
    ...creatorProfile,
    createdAt: demoISO(-90),
    updatedAt: now,
  });

  return items;
}

// ─── BatchWrite ───────────────────────────────────────────────────────────────

async function seed() {
  const items = buildItems();
  console.log(`Seeding ${items.length} items into ${TABLE}...`);

  // DynamoDB BatchWrite supports max 25 items per request
  const BATCH_SIZE = 25;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    await ddb.send(
      new BatchWriteCommand({
        RequestItems: {
          [TABLE]: batch.map((item) => ({
            PutRequest: { Item: item },
          })),
        },
      })
    );
    console.log(`  Wrote items ${i + 1}–${Math.min(i + BATCH_SIZE, items.length)}`);
  }

  console.log(`\nSeed complete! ${items.length} items written to ${TABLE}`);
  console.log('  - 18 restaurants');
  console.log('  - 10 campaigns');
  console.log(`  - ${offers.length} offers (+ ${offers.length} lookup records)`);
  console.log(`  - ${deals.length} deals`);
  console.log('  - 1 creator profile');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
