import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({ region: 'us-east-1' });
const FROM_EMAIL = process.env.FROM_EMAIL || 'networth589@gmail.com';
const MAX_EMAILS = 10; // Safety cap per invocation

export const handler = async (event) => {
  const { type, to, data } = event;

  if (!type || !to) return { statusCode: 400, error: 'Missing type or to' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { statusCode: 400, error: 'Invalid email' };

  const template = getTemplate(type, data || {});
  if (!template) return { statusCode: 400, error: `Unknown template: ${type}` };

  try {
    const emailParams = {
      Source: FROM_EMAIL,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: template.subject },
        Body: {
          Html: { Data: template.html },
          Text: { Data: template.text },
        },
      },
    };
    // Attach SES Configuration Set for bounce/complaint tracking
    if (process.env.SES_CONFIG_SET) {
      emailParams.ConfigurationSetName = process.env.SES_CONFIG_SET;
    }
    await ses.send(new SendEmailCommand(emailParams));
    console.log(`Email sent: type=${type}`);
    return { statusCode: 200, message: 'Sent' };
  } catch (err) {
    console.error(`SES send error: type=${type}, error=${err.message}`);
    return { statusCode: 500, error: 'Send failed' };
  }
};

/**
 * Returns email template by type
 * NOTE: In SES sandbox mode, can only send TO verified email addresses.
 * In production, FROM address must also be verified.
 */
function getTemplate(type, data) {
  const templates = {
    welcome: getWelcomeTemplate(data),
    offer_alert: getOfferAlertTemplate(data),
    subscription_confirmed: getSubscriptionConfirmedTemplate(data),
    weekly_digest: getWeeklyDigestTemplate(data),
    lifecycle_day1: getLifecycleDay1Template(data),
    lifecycle_day14: getLifecycleDay14Template(data),
    lifecycle_day28: getLifecycleDay28Template(data),
  };

  return templates[type] || null;
}

/**
 * Welcome email — sent when user signs up
 */
function getWelcomeTemplate(data) {
  const { name = 'Friend' } = data;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Spot Platform</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background: linear-gradient(135deg, #E8673C 0%, #d84d1f 100%); color: white; padding: 40px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
    .content { padding: 40px 20px; color: #333333; }
    .content h2 { color: #1B2838; font-size: 22px; margin-top: 0; }
    .content p { line-height: 1.6; margin: 15px 0; }
    .cta-button { display: inline-block; background-color: #E8673C; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: 600; margin: 20px 0; }
    .footer { background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666666; border-top: 1px solid #e0e0e0; }
    .footer a { color: #E8673C; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to Spot Platform</h1>
    </div>
    <div class="content">
      <h2>Hi ${escapeHtml(name)},</h2>
      <p>Welcome to Spot Platform! We're excited to help you discover amazing restaurant deals and partner with the best creators in your area.</p>
      <p>Here's what you can do:</p>
      <ul>
        <li>Browse exclusive restaurant offers and deals</li>
        <li>Subscribe to your favorite restaurants for updates</li>
        <li>Manage your preferences and notifications</li>
        <li>Discover curated recommendations just for you</li>
      </ul>
      <p>Get started by exploring our restaurant directory and find your next favorite spot!</p>
      <a href="https://spot-platform.com" class="cta-button">Explore Now</a>
      <p>Questions? We're here to help. Reply to this email or visit our support page.</p>
    </div>
    <div class="footer">
      <p>Spot Platform • Creator-powered Restaurant Discovery</p>
      <p><a href="https://spot-platform.com/unsubscribe">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`;

  const text = `Welcome to Spot Platform

Hi ${name},

Welcome to Spot Platform! We're excited to help you discover amazing restaurant deals and partner with the best creators in your area.

Here's what you can do:
- Browse exclusive restaurant offers and deals
- Subscribe to your favorite restaurants for updates
- Manage your preferences and notifications
- Discover curated recommendations just for you

Get started by exploring our restaurant directory and find your next favorite spot!

Visit: https://spot-platform.com

Questions? We're here to help. Reply to this email or visit our support page.

---
Spot Platform • Creator-powered Restaurant Discovery
Unsubscribe: https://spot-platform.com/unsubscribe`;

  return {
    subject: 'Welcome to Spot Platform!',
    html,
    text,
  };
}

/**
 * Offer alert — sent when offer is scanned or redeemed
 */
function getOfferAlertTemplate(data) {
  const { userName = 'there', restaurantName = 'a restaurant', offerTitle = 'your offer', action = 'scanned' } = data;
  const safeAction = escapeHtml(action);
  const capitalAction = safeAction.charAt(0).toUpperCase() + safeAction.slice(1);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offer ${capitalAction}</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background-color: #1B2838; color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .alert-box { background-color: #E8673C; color: white; padding: 20px; margin: 20px; border-radius: 4px; text-align: center; }
    .alert-box p { margin: 0; font-size: 18px; font-weight: 600; }
    .content { padding: 40px 20px; color: #333333; }
    .content p { line-height: 1.6; margin: 15px 0; }
    .details { background-color: #f9f9f9; padding: 15px; border-left: 4px solid #E8673C; margin: 20px 0; }
    .details strong { color: #1B2838; }
    .footer { background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666666; border-top: 1px solid #e0e0e0; }
    .footer a { color: #E8673C; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Offer ${capitalAction}</h1>
    </div>
    <div class="alert-box">
      <p>Your offer at ${escapeHtml(restaurantName)} was ${safeAction}!</p>
    </div>
    <div class="content">
      <p>Hi ${escapeHtml(userName)},</p>
      <p>Great news! Your offer has been ${safeAction}.</p>
      <div class="details">
        <p><strong>Restaurant:</strong> ${escapeHtml(restaurantName)}</p>
        <p><strong>Offer:</strong> ${escapeHtml(offerTitle)}</p>
        <p><strong>Status:</strong> ${capitalAction}</p>
      </div>
      <p>Thank you for using Spot Platform!</p>
    </div>
    <div class="footer">
      <p>Spot Platform • Creator-powered Restaurant Discovery</p>
      <p><a href="https://spot-platform.com/unsubscribe">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`;

  const text = `Offer ${capitalAction}

Hi ${userName},

Great news! Your offer has been ${safeAction}.

Restaurant: ${restaurantName}
Offer: ${offerTitle}
Status: ${capitalAction}

Thank you for using Spot Platform!

---
Spot Platform • Creator-powered Restaurant Discovery
Unsubscribe: https://spot-platform.com/unsubscribe`;

  return {
    subject: `Offer ${capitalAction}: ${escapeHtml(restaurantName)}`,
    html,
    text,
  };
}

/**
 * Subscription confirmation — sent when user subscribes to a restaurant
 */
function getSubscriptionConfirmedTemplate(data) {
  const { userName = 'there', restaurantName = 'your restaurant' } = data;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Confirmed</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background-color: #1B2838; color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .success-box { background-color: #4CAF50; color: white; padding: 20px; margin: 20px; border-radius: 4px; text-align: center; }
    .success-box p { margin: 0; font-size: 18px; font-weight: 600; }
    .content { padding: 40px 20px; color: #333333; }
    .content h2 { color: #1B2838; font-size: 20px; margin-top: 0; }
    .content p { line-height: 1.6; margin: 15px 0; }
    .benefit-list { background-color: #f9f9f9; padding: 20px; border-radius: 4px; margin: 20px 0; }
    .benefit-list li { margin: 10px 0; }
    .footer { background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666666; border-top: 1px solid #e0e0e0; }
    .footer a { color: #E8673C; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Subscription Confirmed</h1>
    </div>
    <div class="success-box">
      <p>You're now subscribed to ${escapeHtml(restaurantName)}</p>
    </div>
    <div class="content">
      <h2>Hi ${escapeHtml(userName)},</h2>
      <p>Your subscription is confirmed! You'll now receive updates about new offers, events, and exclusive deals from ${escapeHtml(restaurantName)}.</p>
      <div class="benefit-list">
        <h3 style="margin-top: 0; color: #1B2838;">What to expect:</h3>
        <ul>
          <li>Exclusive offers available only to subscribers</li>
          <li>Early access to special promotions</li>
          <li>Event announcements and updates</li>
          <li>Creator-curated recommendations</li>
        </ul>
      </div>
      <p>You can manage your subscriptions anytime from your account settings.</p>
    </div>
    <div class="footer">
      <p>Spot Platform • Creator-powered Restaurant Discovery</p>
      <p><a href="https://spot-platform.com/manage-subscriptions">Manage Subscriptions</a> | <a href="https://spot-platform.com/unsubscribe">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`;

  const text = `Subscription Confirmed

Hi ${userName},

Your subscription is confirmed! You'll now receive updates about new offers, events, and exclusive deals from ${restaurantName}.

What to expect:
- Exclusive offers available only to subscribers
- Early access to special promotions
- Event announcements and updates
- Creator-curated recommendations

You can manage your subscriptions anytime from your account settings.

---
Spot Platform • Creator-powered Restaurant Discovery
Manage Subscriptions: https://spot-platform.com/manage-subscriptions
Unsubscribe: https://spot-platform.com/unsubscribe`;

  return {
    subject: `Subscribed: ${restaurantName}`,
    html,
    text,
  };
}

/**
 * Weekly digest — sent every week with campaign summary
 */
function getWeeklyDigestTemplate(data) {
  const { userName = 'there', offersCount = 0, restaurantsCount = 0, topOffer = 'a great deal' } = data;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Weekly Digest</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background: linear-gradient(135deg, #E8673C 0%, #d84d1f 100%); color: white; padding: 40px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
    .header p { margin: 10px 0 0 0; font-size: 16px; opacity: 0.9; }
    .content { padding: 40px 20px; color: #333333; }
    .stat-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 30px 0; }
    .stat-box { background-color: #f9f9f9; padding: 20px; border-radius: 4px; border-left: 4px solid #E8673C; text-align: center; }
    .stat-number { font-size: 32px; font-weight: 700; color: #E8673C; }
    .stat-label { font-size: 12px; color: #666666; text-transform: uppercase; margin-top: 5px; }
    .highlight { background-color: #fff3e0; padding: 20px; border-radius: 4px; margin: 20px 0; }
    .highlight h3 { color: #1B2838; margin-top: 0; }
    .cta-button { display: inline-block; background-color: #E8673C; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: 600; margin: 20px 0; }
    .footer { background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666666; border-top: 1px solid #e0e0e0; }
    .footer a { color: #E8673C; text-decoration: none; }
    @media (max-width: 600px) {
      .stat-row { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Your Weekly Digest</h1>
      <p>This week's restaurant deals & updates</p>
    </div>
    <div class="content">
      <p>Hi ${escapeHtml(userName)},</p>
      <p>Here's what's been happening in your Spot Platform this week:</p>

      <div class="stat-row">
        <div class="stat-box">
          <div class="stat-number">${offersCount}</div>
          <div class="stat-label">New Offers</div>
        </div>
        <div class="stat-box">
          <div class="stat-number">${restaurantsCount}</div>
          <div class="stat-label">Top Restaurants</div>
        </div>
      </div>

      <div class="highlight">
        <h3>✨ Featured This Week</h3>
        <p>${escapeHtml(topOffer)}</p>
        <a href="https://spot-platform.com" class="cta-button">Browse More Offers</a>
      </div>

      <p>Want to see more? Check out your personalized recommendations and exclusive deals on the platform.</p>
    </div>
    <div class="footer">
      <p>Spot Platform • Creator-powered Restaurant Discovery</p>
      <p><a href="https://spot-platform.com/unsubscribe">Unsubscribe from digest</a></p>
    </div>
  </div>
</body>
</html>`;

  const text = `Your Weekly Digest

Hi ${userName},

Here's what's been happening in your Spot Platform this week:

New Offers: ${offersCount}
Top Restaurants: ${restaurantsCount}

Featured This Week:
${topOffer}

Browse More Offers: https://spot-platform.com

Want to see more? Check out your personalized recommendations and exclusive deals on the platform.

---
Spot Platform • Creator-powered Restaurant Discovery
Unsubscribe from digest: https://spot-platform.com/unsubscribe`;

  return {
    subject: '📧 Your Weekly Digest from Spot Platform',
    html,
    text,
  };
}

/**
 * Day 1 check-in — sent 24 hours after signup
 */
function getLifecycleDay1Template(data) {
  const { name = 'Friend' } = data;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Getting Started with Spot</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background: linear-gradient(135deg, #E8673C 0%, #d84d1f 100%); color: white; padding: 40px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 26px; font-weight: 600; }
    .content { padding: 40px 20px; color: #333333; }
    .content h2 { color: #1B2838; font-size: 20px; margin-top: 0; }
    .content p { line-height: 1.6; margin: 15px 0; }
    .step-box { background-color: #f9f9f9; padding: 20px; border-left: 4px solid #E8673C; margin: 15px 0; border-radius: 0 4px 4px 0; }
    .step-box strong { color: #E8673C; }
    .cta-button { display: inline-block; background-color: #E8673C; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: 600; margin: 20px 0; }
    .footer { background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666666; border-top: 1px solid #e0e0e0; }
    .footer a { color: #E8673C; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Ready to Get Started?</h1>
    </div>
    <div class="content">
      <h2>Hi ${escapeHtml(name)},</h2>
      <p>It's been a day since you joined Spot Platform — here are three quick things to help you hit the ground running:</p>
      <div class="step-box">
        <strong>1. Create your first campaign</strong>
        <p>Set up a campaign to start tracking how your content drives real restaurant visits.</p>
      </div>
      <div class="step-box">
        <strong>2. Add a restaurant partner</strong>
        <p>Connect with a restaurant you already love — our onboarding wizard makes it quick.</p>
      </div>
      <div class="step-box">
        <strong>3. Share your first offer</strong>
        <p>Create an offer code your audience can redeem. You'll see scans and redemptions in real time.</p>
      </div>
      <a href="https://spot-platform.com" class="cta-button">Open Your Dashboard</a>
      <p>Need help? Just reply to this email — we read every message.</p>
    </div>
    <div class="footer">
      <p>Spot Platform &bull; Creator-powered Restaurant Discovery</p>
      <p><a href="https://spot-platform.com/unsubscribe">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`;

  const text = `Ready to Get Started?

Hi ${name},

It's been a day since you joined Spot Platform — here are three quick things to help you hit the ground running:

1. Create your first campaign — Set up a campaign to start tracking how your content drives real restaurant visits.

2. Add a restaurant partner — Connect with a restaurant you already love — our onboarding wizard makes it quick.

3. Share your first offer — Create an offer code your audience can redeem. You'll see scans and redemptions in real time.

Open Your Dashboard: https://spot-platform.com

Need help? Just reply to this email — we read every message.

---
Spot Platform • Creator-powered Restaurant Discovery
Unsubscribe: https://spot-platform.com/unsubscribe`;

  return {
    subject: 'Quick start: 3 things to do on Spot Platform',
    html,
    text,
  };
}

/**
 * Day 14 engagement — sent two weeks after signup
 */
function getLifecycleDay14Template(data) {
  const { name = 'Friend', campaignCount = 0, scanCount = 0 } = data;
  const hasActivity = campaignCount > 0 || scanCount > 0;

  const activitySection = hasActivity
    ? `<div class="stat-row">
        <div class="stat-box">
          <div class="stat-number">${escapeHtml(String(campaignCount))}</div>
          <div class="stat-label">Campaigns</div>
        </div>
        <div class="stat-box">
          <div class="stat-number">${escapeHtml(String(scanCount))}</div>
          <div class="stat-label">Offer Scans</div>
        </div>
      </div>
      <p>Nice progress! Here are some tips to keep the momentum going:</p>`
    : `<p>You haven't launched a campaign yet — that's okay! Here are a few ideas to get started:</p>`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Two-Week Check-In</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background: linear-gradient(135deg, #1B2838 0%, #2d4052 100%); color: white; padding: 40px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 26px; font-weight: 600; }
    .content { padding: 40px 20px; color: #333333; }
    .content p { line-height: 1.6; margin: 15px 0; }
    .stat-row { display: flex; gap: 20px; margin: 25px 0; }
    .stat-box { flex: 1; background-color: #f9f9f9; padding: 20px; border-radius: 4px; text-align: center; border-top: 3px solid #E8673C; }
    .stat-number { font-size: 32px; font-weight: 700; color: #E8673C; }
    .stat-label { font-size: 12px; color: #666; text-transform: uppercase; margin-top: 5px; }
    .tip-box { background-color: #fff3e0; padding: 15px 20px; border-radius: 4px; margin: 10px 0; }
    .tip-box strong { color: #1B2838; }
    .cta-button { display: inline-block; background-color: #E8673C; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: 600; margin: 20px 0; }
    .footer { background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666666; border-top: 1px solid #e0e0e0; }
    .footer a { color: #E8673C; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Your Two-Week Check-In</h1>
    </div>
    <div class="content">
      <p>Hi ${escapeHtml(name)},</p>
      <p>You've been on Spot Platform for two weeks now!</p>
      ${activitySection}
      <div class="tip-box">
        <strong>Tip:</strong> Use AI Content Ideas to generate post captions and campaign angles tailored to your audience.
      </div>
      <div class="tip-box">
        <strong>Tip:</strong> Restaurants with active offers get 3x more engagement from creator audiences.
      </div>
      <a href="https://spot-platform.com" class="cta-button">View Your Dashboard</a>
    </div>
    <div class="footer">
      <p>Spot Platform &bull; Creator-powered Restaurant Discovery</p>
      <p><a href="https://spot-platform.com/unsubscribe">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`;

  const text = `Your Two-Week Check-In

Hi ${name},

You've been on Spot Platform for two weeks now!

${hasActivity ? `Your progress so far:\nCampaigns: ${campaignCount}\nOffer Scans: ${scanCount}\n\nNice progress! Here are some tips:` : `You haven't launched a campaign yet — here are a few ideas:`}

Tip: Use AI Content Ideas to generate post captions and campaign angles tailored to your audience.
Tip: Restaurants with active offers get 3x more engagement from creator audiences.

View Your Dashboard: https://spot-platform.com

---
Spot Platform • Creator-powered Restaurant Discovery
Unsubscribe: https://spot-platform.com/unsubscribe`;

  return {
    subject: `Two weeks on Spot — ${hasActivity ? 'your progress so far' : 'let\'s get you started'}`,
    html,
    text,
  };
}

/**
 * Day 28 renewal/retention — sent four weeks after signup
 */
function getLifecycleDay28Template(data) {
  const { name = 'Friend', campaignCount = 0, scanCount = 0, redemptionCount = 0, tier = 'bronze' } = data;
  const tierColors = { bronze: '#CD7F32', silver: '#C0C0C0', gold: '#FFD700' };
  const tierColor = tierColors[tier] || tierColors.bronze;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your First Month on Spot</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background: linear-gradient(135deg, #E8673C 0%, #d84d1f 100%); color: white; padding: 40px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 26px; font-weight: 600; }
    .header p { margin: 10px 0 0; font-size: 16px; opacity: 0.9; }
    .content { padding: 40px 20px; color: #333333; }
    .content p { line-height: 1.6; margin: 15px 0; }
    .tier-badge { display: inline-block; background-color: ${tierColor}; color: ${tier === 'silver' ? '#333' : 'white'}; padding: 8px 20px; border-radius: 20px; font-weight: 600; text-transform: uppercase; font-size: 14px; letter-spacing: 1px; }
    .stat-row { display: flex; gap: 15px; margin: 25px 0; }
    .stat-box { flex: 1; background-color: #f9f9f9; padding: 15px; border-radius: 4px; text-align: center; }
    .stat-number { font-size: 28px; font-weight: 700; color: #E8673C; }
    .stat-label { font-size: 11px; color: #666; text-transform: uppercase; margin-top: 5px; }
    .next-steps { background-color: #f0f7ff; padding: 20px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #1B2838; }
    .next-steps h3 { color: #1B2838; margin-top: 0; }
    .cta-button { display: inline-block; background-color: #E8673C; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: 600; margin: 20px 0; }
    .footer { background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666666; border-top: 1px solid #e0e0e0; }
    .footer a { color: #E8673C; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Your First Month on Spot</h1>
      <p>Here's how it's going</p>
    </div>
    <div class="content">
      <p>Hi ${escapeHtml(name)},</p>
      <p>One month in! Here's a snapshot of your journey so far:</p>
      <p style="text-align:center;"><span class="tier-badge">${escapeHtml(tier)} Ambassador</span></p>
      <div class="stat-row">
        <div class="stat-box">
          <div class="stat-number">${escapeHtml(String(campaignCount))}</div>
          <div class="stat-label">Campaigns</div>
        </div>
        <div class="stat-box">
          <div class="stat-number">${escapeHtml(String(scanCount))}</div>
          <div class="stat-label">Scans</div>
        </div>
        <div class="stat-box">
          <div class="stat-number">${escapeHtml(String(redemptionCount))}</div>
          <div class="stat-label">Redemptions</div>
        </div>
      </div>
      <div class="next-steps">
        <h3>What's Next</h3>
        <p>Keep building momentum — the most successful creators on Spot run at least 2 campaigns per month and partner with 3+ restaurants.</p>
        <p>Need fresh ideas? Try our <strong>AI Content Ideas</strong> tool to generate personalized campaign angles.</p>
      </div>
      <a href="https://spot-platform.com" class="cta-button">Go to Dashboard</a>
    </div>
    <div class="footer">
      <p>Spot Platform &bull; Creator-powered Restaurant Discovery</p>
      <p><a href="https://spot-platform.com/unsubscribe">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`;

  const text = `Your First Month on Spot

Hi ${name},

One month in! Here's a snapshot of your journey so far:

Ambassador Tier: ${tier}
Campaigns: ${campaignCount}
Scans: ${scanCount}
Redemptions: ${redemptionCount}

What's Next:
Keep building momentum — the most successful creators on Spot run at least 2 campaigns per month and partner with 3+ restaurants.

Need fresh ideas? Try our AI Content Ideas tool to generate personalized campaign angles.

Go to Dashboard: https://spot-platform.com

---
Spot Platform • Creator-powered Restaurant Discovery
Unsubscribe: https://spot-platform.com/unsubscribe`;

  return {
    subject: `Your first month on Spot — ${tier} ambassador recap`,
    html,
    text,
  };
}

/**
 * Escape HTML special characters to prevent injection
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
