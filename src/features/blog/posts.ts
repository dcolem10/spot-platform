export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  author: string;
  category: string;
  readTime: number; // minutes
  content: string; // markdown-like HTML content
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'why-food-creators-drive-restaurant-growth',
    title: 'Why Food Creators Drive Real Restaurant Growth in 2026',
    excerpt:
      'Influencer marketing has matured — restaurants that partner with authentic local food creators are seeing measurable foot traffic increases, not just likes.',
    date: '2026-03-15',
    author: 'Spot Platform',
    category: 'Strategy',
    readTime: 5,
    content: `
<p>For years, restaurant owners viewed social media as a nice-to-have — a place to post pretty photos and hope for the best. That era is over.</p>

<p>In 2026, food creators with hyper-local audiences are the most efficient customer acquisition channel a restaurant can access. Here's why, and what separates campaigns that convert from ones that just rack up impressions.</p>

<h2>The Trust Gap</h2>
<p>Traditional restaurant advertising — Google Ads, Yelp, even food delivery banners — competes in a space where consumers are skeptical. They've been burned by misleading photos and inflated reviews.</p>
<p>A food creator's audience, by contrast, has built a relationship of trust over months or years. When they say "this ramen is worth the drive," their followers believe it in a way no ad can replicate.</p>

<h2>Local Audience = Local Customers</h2>
<p>National food influencers have reach. Local food creators have relevance. A creator with 8,000 followers who are all within 10 miles of your restaurant is more valuable than one with 500,000 followers spread across 50 states.</p>
<p>Spot's data shows that campaigns with geo-aligned creators (audience 70%+ within the restaurant's city) generate 3–4× the redemption rate of campaigns using influencers with broad national followings.</p>

<h2>Attribution Changes Everything</h2>
<p>The reason restaurants historically underinvested in creator partnerships was the inability to measure impact. Social media felt like a cost center, not a revenue driver.</p>
<p>QR codes, promo codes, and POS integrations now close the loop. You can see exactly which content drove which visits, calculate cost-per-acquisition, and optimize accordingly.</p>

<h2>Getting Started</h2>
<p>If you're a restaurant owner ready to run your first creator campaign, start with one clear objective: new customer acquisition, lapsed customer win-back, or new menu launch. Match that objective to a creator whose audience fits your target demographic, agree on a redemption mechanism, and measure everything.</p>
<p>The restaurants growing fastest in 2026 aren't outspending their competitors — they're out-authenticating them.</p>
    `.trim(),
  },
  {
    slug: 'how-to-price-your-first-restaurant-partnership',
    title: 'How to Price Your First Restaurant Partnership as a Food Creator',
    excerpt:
      'Setting rates for brand deals is one of the hardest parts of being a food creator. Here\'s a framework for pricing your first restaurant partnership without leaving money on the table.',
    date: '2026-03-01',
    author: 'Spot Platform',
    category: 'Creator Tips',
    readTime: 6,
    content: `
<p>You've built a genuine audience of local food lovers. A restaurant just slid into your DMs asking about a partnership. Now comes the awkward part: what do you charge?</p>

<p>Pricing is where many food creators undersell themselves — or alternatively, overprice and lose the deal. Here's how to think about it.</p>

<h2>Understand What You're Actually Selling</h2>
<p>You're not selling Instagram posts. You're selling trust, reach, and attribution. A restaurant that partners with you gets access to your audience's attention in a context where they're already thinking about where to eat — and they get measurable data on whether it worked.</p>

<h2>The CPM Baseline</h2>
<p>Start with your average views per post over the last 90 days. A rough benchmark: food content campaigns on Instagram and TikTok typically run $15–30 CPM (cost per thousand impressions) for engaged local audiences. If your last 10 posts averaged 12,000 views, that's a baseline of $180–$360 per deliverable.</p>

<h2>Add Value Layers</h2>
<p>Raw reach is just the floor. Add to it:</p>
<ul>
  <li><strong>Exclusivity window</strong> — if you're agreeing not to post about competing restaurants for 30 days, price that in</li>
  <li><strong>Usage rights</strong> — if the restaurant wants to repost your content or use it in their ads, that's worth 1.5–2× the base rate</li>
  <li><strong>Story + Feed combo</strong> — multi-placement packages command a premium over single placements</li>
</ul>

<h2>Performance-Based Upside</h2>
<p>If a restaurant is hesitant on your base rate, offer a hybrid: lower guaranteed fee plus a bonus per redemption. This aligns incentives and lets you demonstrate your value. Once you have a track record of driving real visits, negotiating flat rates becomes much easier.</p>

<h2>What to Avoid</h2>
<p>Don't accept free meals as full compensation unless you're just starting out and building a portfolio. Your audience's trust has real monetary value — treat it that way. The restaurants you most want to work with long-term will respect a creator who knows their worth.</p>
    `.trim(),
  },
  {
    slug: 'measuring-restaurant-influencer-roi',
    title: 'Measuring ROI from Restaurant Influencer Campaigns: A Practical Guide',
    excerpt:
      'Vanity metrics are easy to collect. Actual ROI from restaurant creator campaigns requires closing the loop from content view to table visit — here\'s how.',
    date: '2026-02-15',
    author: 'Spot Platform',
    category: 'Analytics',
    readTime: 7,
    content: `
<p>Restaurant marketing has always been hard to measure. Even today, many operators track influencer campaign success by counting likes and comments — metrics that feel good but don't map to revenue.</p>

<p>Closing the loop from content to customer is now possible. Here's the framework we use at Spot to measure real ROI.</p>

<h2>Define Your Objective First</h2>
<p>Before you can measure success, you need to know what success looks like. Creator campaigns can drive different outcomes:</p>
<ul>
  <li><strong>New customer acquisition</strong> — first-time visits from people who hadn't heard of you</li>
  <li><strong>Lapsed customer reactivation</strong> — bringing back customers who haven't visited in 90+ days</li>
  <li><strong>New menu launch awareness</strong> — trial of a specific item</li>
  <li><strong>Event promotion</strong> — ticket sales or RSVPs to a specific event</li>
</ul>
<p>Each objective needs a different measurement approach.</p>

<h2>The Attribution Stack</h2>
<p>For content-driven attribution to work, you need a mechanism that links a specific piece of content to a specific visit. The most effective options:</p>
<ul>
  <li><strong>Unique promo codes</strong> — each creator gets a code (e.g., CHEF_MAYA). Track redemptions by code at POS</li>
  <li><strong>QR codes</strong> — link to a landing page or directly to a redemption form. Scans are timestamped and attributed</li>
  <li><strong>POS integration</strong> — if your POS syncs with Spot, redemption data flows automatically without manual tracking</li>
</ul>

<h2>The Metrics That Matter</h2>
<p>Once attribution is in place, calculate:</p>
<ul>
  <li><strong>Cost per redemption</strong> = total campaign cost ÷ total redemptions</li>
  <li><strong>Cost per new customer</strong> = total cost ÷ first-time visitor redemptions</li>
  <li><strong>Average ticket from campaign customers</strong> — compare to your restaurant average</li>
  <li><strong>30-day return rate</strong> — did campaign customers come back?</li>
</ul>

<h2>Benchmarks</h2>
<p>Based on Spot campaign data, healthy benchmarks for local food creator campaigns:</p>
<ul>
  <li>Redemption rate: 2–8% of content views</li>
  <li>Cost per redemption: $8–25</li>
  <li>30-day return rate: 15–35%</li>
</ul>
<p>Campaigns above these benchmarks signal a creator whose audience genuinely trusts their recommendations and is local enough to act on them.</p>
    `.trim(),
  },
];

export function getPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

export function formatBlogDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
