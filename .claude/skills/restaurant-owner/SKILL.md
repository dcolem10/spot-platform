---
name: restaurant-owner
description: "Restaurant business representation and data modeling skill for the Spot Platform. Use this skill whenever working with restaurant data — seeding restaurants, building restaurant profiles, classifying cuisine types, setting price tiers, understanding what makes a restaurant discoverable by food creators, or designing restaurant-facing features. Also trigger when discussing restaurant partnerships, menu categorization, neighborhood dining scenes, or creator-restaurant matching. This skill understands restaurants from both the business owner's perspective AND the food creator's perspective, which is critical for Spot's two-sided marketplace."
---

# Restaurant Owner & Business Representation Skill

This skill provides deep domain knowledge about how restaurants operate, how they should be represented in a creator-first platform, and how to build rich restaurant data that serves both restaurant discovery and creator-restaurant matching.

## Why This Matters

Spot Platform connects food creators with restaurants. The restaurant data model is the bridge between these two sides. Poor data means creators can't find the right restaurants, restaurants don't get matched with the right creators, and the platform fails at its core mission. This skill ensures every restaurant in the system is represented with the richness that both sides need.

## Cuisine Classification Taxonomy

Restaurants often span multiple cuisine categories. Always assign a **primary cuisine** (the first in the array) and up to 3 secondary cuisines. The taxonomy below is designed for how food creators think about and search for restaurants — not how restaurant owners categorize themselves.

### Primary Cuisine Categories

These are the top-level categories that creators use when looking for content opportunities:

| Category | Description | Common Sub-styles |
|----------|-------------|-------------------|
| American | Broad American cuisine | New American, Southern, BBQ, Cajun, Soul Food, Comfort Food, Farm-to-Table, Diner |
| Italian | Italian and Italian-American | Neapolitan, Sicilian, Roman, Northern Italian, Italian-American, Pizza |
| Mexican | Mexican and Tex-Mex | Oaxacan, Yucatecan, Street Tacos, Tex-Mex, Modern Mexican |
| Japanese | Japanese cuisine | Sushi, Ramen, Izakaya, Omakase, Robata, Tempura, Kaiseki |
| Chinese | Chinese regional cuisines | Cantonese, Sichuan, Hunan, Dim Sum, Hot Pot, Taiwanese, Hong Kong |
| Korean | Korean cuisine | Korean BBQ, Fried Chicken, Bibimbap, Pojangmacha, Modern Korean |
| Thai | Thai cuisine | Northern Thai, Southern Thai, Isaan, Street Food |
| Vietnamese | Vietnamese cuisine | Pho, Banh Mi, Modern Vietnamese, Southern Vietnamese |
| Indian | Indian subcontinent | North Indian, South Indian, Indo-Chinese, Modern Indian, Pakistani |
| Mediterranean | Broad Mediterranean | Greek, Turkish, Lebanese, Israeli, Moroccan |
| French | French cuisine | Bistro, Brasserie, Fine Dining, Provencal, Patisserie |
| Spanish | Spanish cuisine | Tapas, Basque, Catalan, Modern Spanish |
| Ethiopian | East African | Ethiopian, Eritrean |
| Caribbean | Caribbean cuisine | Jamaican, Haitian, Cuban, Puerto Rican, Trinidadian |
| Middle Eastern | Middle Eastern cuisine | Lebanese, Persian, Turkish, Israeli, Afghan |
| Latin American | Central/South American | Peruvian, Brazilian, Colombian, Argentinian, Salvadoran |
| Seafood | Seafood-focused | Raw Bar, Oyster House, Fish & Chips, Poke, Ceviche |
| Steakhouse | Steak-focused | Classic Steakhouse, Modern Steakhouse, Brazilian Churrascaria |
| Pizza | Pizza-focused | Neapolitan, New York Style, Detroit Style, Wood-Fired |
| Brunch | Brunch-focused | All-Day Brunch, Cafe, Breakfast |
| Bakery/Cafe | Bakery and cafe | Patisserie, Coffee Shop, Tea House, Dessert Bar |
| Filipino | Filipino cuisine | Traditional, Modern Filipino, Kamayan |
| African | West/Central African | Nigerian, Ghanaian, Senegalese, Pan-African |

### Fusion & Cross-Category

When a restaurant genuinely blends two traditions, use both as cuisines:
- `["Japanese", "Peruvian"]` for Nikkei
- `["Korean", "Mexican"]` for Korean-Mexican fusion
- `["French", "Vietnamese"]` for French-Vietnamese

Add "Fusion" as a tag only if the restaurant self-identifies that way. Don't use "International" as a primary cuisine — it's meaningless for search.

## Price Level Classification

Price levels 1-4 map to real per-person dinner costs (excluding drinks, tax, tip):

| Level | Symbol | Per Person | Creator Relevance |
|-------|--------|------------|-------------------|
| 1 | $ | Under $15 | Street food, fast casual, food trucks. High-volume content, casual vibe. |
| 2 | $$ | $15-30 | Casual dining, neighborhood spots. Bread-and-butter for most creators. |
| 3 | $$$ | $30-60 | Upscale casual, notable chef-driven. Strong content opportunities, special occasion angle. |
| 4 | $$$$ | $60+ | Fine dining, tasting menus. Premium content, brand partnership opportunities. |

**Classification rules:**
- Base the price level on a typical dinner entree, not lunch/happy hour prices
- When in doubt, use the higher of two levels (it's better to under-promise on price)
- Pizza places and ramen shops with $15-18 entrees = level 2
- Places with no entrees (tapas, dim sum) — estimate 3-4 plates per person

## What Makes a Restaurant Profile Rich for Creators

Creators care about different things than diners. A good restaurant profile for Spot should emphasize:

### Must-Have Fields
- **name**: Official restaurant name
- **cuisine[]**: Primary + secondary cuisines (from taxonomy above)
- **priceLevel**: 1-4 classification
- **neighborhood**: Specific neighborhood name (not just city). This is how creators talk about dining — "Shaw" not "Northwest DC"
- **address**: Full street address
- **city**: City, State format
- **isPartner**: Whether the restaurant has a formal Spot partnership

### High-Value Fields
- **vibes[]**: Atmosphere tags that help creators decide if the restaurant fits their content style. Examples: "date-night", "lively", "intimate", "rooftop", "speakeasy", "hidden-gem", "instagrammable", "family-friendly", "outdoor-dining", "late-night", "brunch-spot", "waterfront", "cozy", "trendy", "upscale-casual", "divey", "historic"
- **spotRating**: 1.0-5.0 rating. For seeded data without real reviews, use a reasonable estimate based on the restaurant's reputation (popular/acclaimed = 4.5-4.9, solid neighborhood spot = 4.0-4.4, newer/unproven = 3.8-4.0)
- **coords**: lat/lng for mapping
- **photos[]**: Photo URLs (empty for seeds)

### Partnership Signals
Partner restaurants (`isPartner: true`) get priority in creator recommendations. When seeding data:
- Mark ~20-30% of restaurants as partners
- Partners should be weighted toward higher-quality, content-friendly spots
- Include a mix of price levels in partners (not just expensive)

## City-Specific Knowledge

Read `references/city-dining-guide.md` for detailed guidance on each of the 9 Spot cities, including: key dining neighborhoods, cuisine strengths, local dining culture, and notable restaurants to include.

## Neighborhood Mapping

Each city has distinct dining neighborhoods. Using the right neighborhood name matters for creator discoverability — creators search by neighborhood, not zip code.

Always use the locally recognized neighborhood name:
- "Shaw" not "Northwest DC"
- "Williamsburg" not "Brooklyn North"
- "Little Havana" not "Southwest Miami"
- "Buckhead" not "North Atlanta"

## Restaurant Density Guidelines

When building a restaurant database for a city, aim for this distribution:

- **50-100 restaurants per city** provides meaningful filtering
- **Cuisine diversity**: No single cuisine should exceed 25% of a city's restaurants. Reflect the city's actual dining scene
- **Price distribution**: Roughly 15% level 1, 35% level 2, 35% level 3, 15% level 4 (varies by city)
- **Partner ratio**: 20-30% of restaurants marked as partners
- **Neighborhood spread**: Cover at least 6-8 distinct neighborhoods per city

## Data Quality Principles

1. **Use real restaurant names and addresses** when possible. Curated data should reference actual, currently operating restaurants
2. **Cuisine accuracy**: Classify based on what the restaurant actually serves, not what the name implies. "Estadio" sounds Italian but serves Spanish tapas
3. **Avoid chains** unless they're regionally significant (e.g., Shake Shack in NYC is fine, McDonald's is not)
4. **Recency bias**: Favor restaurants that opened in the last 5-10 years alongside established institutions. Creators want fresh content
5. **Content-worthiness**: Include restaurants where a food creator would realistically want to film/photograph. Consider visual appeal, story angle, uniqueness
