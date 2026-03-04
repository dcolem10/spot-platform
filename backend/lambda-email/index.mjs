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
    await ses.send(new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: template.subject },
        Body: {
          Html: { Data: template.html },
          Text: { Data: template.text },
        },
      },
    }));
    console.log(`Email sent: type=${type}, to=${to}`);
    return { statusCode: 200, message: 'Sent' };
  } catch (err) {
    console.error(`SES send error: type=${type}, to=${to}, error=${err.message}`);
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

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offer ${action.charAt(0).toUpperCase() + action.slice(1)}</title>
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
      <h1>Offer ${action.charAt(0).toUpperCase() + action.slice(1)}</h1>
    </div>
    <div class="alert-box">
      <p>Your offer at ${escapeHtml(restaurantName)} was ${action}!</p>
    </div>
    <div class="content">
      <p>Hi ${escapeHtml(userName)},</p>
      <p>Great news! Your offer has been ${action}.</p>
      <div class="details">
        <p><strong>Restaurant:</strong> ${escapeHtml(restaurantName)}</p>
        <p><strong>Offer:</strong> ${escapeHtml(offerTitle)}</p>
        <p><strong>Status:</strong> ${action.charAt(0).toUpperCase() + action.slice(1)}</p>
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

  const text = `Offer ${action.charAt(0).toUpperCase() + action.slice(1)}

Hi ${userName},

Great news! Your offer has been ${action}.

Restaurant: ${restaurantName}
Offer: ${offerTitle}
Status: ${action.charAt(0).toUpperCase() + action.slice(1)}

Thank you for using Spot Platform!

---
Spot Platform • Creator-powered Restaurant Discovery
Unsubscribe: https://spot-platform.com/unsubscribe`;

  return {
    subject: `Offer ${action.charAt(0).toUpperCase() + action.slice(1)}: ${restaurantName}`,
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
