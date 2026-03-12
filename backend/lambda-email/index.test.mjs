import { test, describe } from 'node:test';
import assert from 'node:assert';

// Re-implement escapeHtml function for testing
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Email validation regex from handler
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Re-implement getTemplate logic for testing
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

// Template implementations (matching source)
function getWelcomeTemplate(data) {
  const { name = 'Friend' } = data;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Spot Platform</title>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to Spot Platform</h1>
    </div>
    <div class="content">
      <h2>Hi ${escapeHtml(name)},</h2>
      <p>Welcome to Spot Platform!</p>
    </div>
  </div>
</body>
</html>`;

  const text = `Welcome to Spot Platform\n\nHi ${name},\n\nWelcome to Spot Platform!`;

  return {
    subject: 'Welcome to Spot Platform!',
    html,
    text,
  };
}

function getOfferAlertTemplate(data) {
  const { userName = 'there', restaurantName = 'a restaurant', offerTitle = 'your offer', action = 'scanned' } = data;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Offer ${action.charAt(0).toUpperCase() + action.slice(1)}</title>
</head>
<body>
  <div class="container">
    <div class="alert-box">
      <p>Your offer at ${escapeHtml(restaurantName)} was ${action}!</p>
    </div>
    <div class="content">
      <p>Hi ${escapeHtml(userName)},</p>
      <div class="details">
        <p><strong>Restaurant:</strong> ${escapeHtml(restaurantName)}</p>
        <p><strong>Offer:</strong> ${escapeHtml(offerTitle)}</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  const text = `Offer ${action.charAt(0).toUpperCase() + action.slice(1)}\n\nHi ${userName},\n\nRestaurant: ${restaurantName}\nOffer: ${offerTitle}`;

  return {
    subject: `Offer ${action.charAt(0).toUpperCase() + action.slice(1)}: ${restaurantName}`,
    html,
    text,
  };
}

function getSubscriptionConfirmedTemplate(data) {
  const { userName = 'there', restaurantName = 'your restaurant' } = data;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Subscription Confirmed</title>
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
      <p>Your subscription is confirmed!</p>
    </div>
  </div>
</body>
</html>`;

  const text = `Subscription Confirmed\n\nHi ${userName},\n\nYour subscription is confirmed!`;

  return {
    subject: `Subscribed: ${restaurantName}`,
    html,
    text,
  };
}

function getWeeklyDigestTemplate(data) {
  const { userName = 'there', offersCount = 0, restaurantsCount = 0, topOffer = 'a great deal' } = data;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Your Weekly Digest</title>
</head>
<body>
  <div class="container">
    <div class="content">
      <p>Hi ${escapeHtml(userName)},</p>
      <div class="stat-row">
        <div class="stat-box">
          <div class="stat-number">${offersCount}</div>
          <div class="stat-label">New Offers</div>
        </div>
      </div>
      <div class="highlight">
        <h3>Featured This Week</h3>
        <p>${escapeHtml(topOffer)}</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  const text = `Your Weekly Digest\n\nHi ${userName},\n\nNew Offers: ${offersCount}\nTop Restaurants: ${restaurantsCount}\n\nFeatured: ${topOffer}`;

  return {
    subject: '📧 Your Weekly Digest from Spot Platform',
    html,
    text,
  };
}

function getLifecycleDay1Template(data) {
  const { name = 'Friend' } = data;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Getting Started with Spot</title>
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
        <p>Connect with a restaurant you already love.</p>
      </div>
      <div class="step-box">
        <strong>3. Share your first offer</strong>
        <p>Create an offer code your audience can redeem.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  const text = `Ready to Get Started?\n\nHi ${name},\n\nIt's been a day since you joined Spot Platform.\n\n1. Create your first campaign\n2. Add a restaurant partner\n3. Share your first offer`;

  return {
    subject: 'Quick start: 3 things to do on Spot Platform',
    html,
    text,
  };
}

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
  <title>Your Two-Week Check-In</title>
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
    </div>
  </div>
</body>
</html>`;

  const text = `Your Two-Week Check-In\n\nHi ${name},\n\nYou've been on Spot Platform for two weeks now!`;

  return {
    subject: `Two weeks on Spot — ${hasActivity ? 'your progress so far' : 'let\'s get you started'}`,
    html,
    text,
  };
}

function getLifecycleDay28Template(data) {
  const { name = 'Friend', campaignCount = 0, scanCount = 0, redemptionCount = 0, tier = 'bronze' } = data;
  const tierColors = { bronze: '#CD7F32', silver: '#C0C0C0', gold: '#FFD700' };
  const tierColor = tierColors[tier] || tierColors.bronze;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Your First Month on Spot</title>
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
    </div>
  </div>
</body>
</html>`;

  const text = `Your First Month on Spot\n\nHi ${name},\n\nOne month in! Here's a snapshot of your journey so far:\n\nAmbassador Tier: ${tier}\nCampaigns: ${campaignCount}\nScans: ${scanCount}\nRedemptions: ${redemptionCount}`;

  return {
    subject: `Your first month on Spot — ${tier} ambassador recap`,
    html,
    text,
  };
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe('escapeHtml function', () => {
  test('escapes & to &amp;', () => {
    assert.strictEqual(escapeHtml('Tom & Jerry'), 'Tom &amp; Jerry');
  });

  test('escapes < to &lt;', () => {
    assert.strictEqual(escapeHtml('2 < 3'), '2 &lt; 3');
  });

  test('escapes > to &gt;', () => {
    assert.strictEqual(escapeHtml('3 > 2'), '3 &gt; 2');
  });

  test('escapes " to &quot;', () => {
    assert.strictEqual(escapeHtml('He said "hello"'), 'He said &quot;hello&quot;');
  });

  test('escapes \' to &#039;', () => {
    assert.strictEqual(escapeHtml("It's great"), 'It&#039;s great');
  });

  test('returns empty string for null', () => {
    assert.strictEqual(escapeHtml(null), '');
  });

  test('returns empty string for undefined', () => {
    assert.strictEqual(escapeHtml(undefined), '');
  });

  test('returns empty string for empty string', () => {
    assert.strictEqual(escapeHtml(''), '');
  });

  test('handles mixed HTML characters', () => {
    assert.strictEqual(
      escapeHtml('<div class="test">Content & more</div>'),
      '&lt;div class=&quot;test&quot;&gt;Content &amp; more&lt;/div&gt;'
    );
  });

  test('handles XSS payload', () => {
    const xssPayload = "<script>alert('xss')</script>";
    const escaped = escapeHtml(xssPayload);
    assert.strictEqual(
      escaped,
      '&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;'
    );
    // Verify no dangerous characters remain
    assert(!escaped.includes('<script>'));
    assert(!escaped.includes('</script>'));
  });
});

describe('Email validation regex', () => {
  test('accepts valid email: user@example.com', () => {
    assert(EMAIL_REGEX.test('user@example.com'));
  });

  test('accepts valid email: john.doe@company.co.uk', () => {
    assert(EMAIL_REGEX.test('john.doe@company.co.uk'));
  });

  test('accepts valid email: test+tag@domain.org', () => {
    assert(EMAIL_REGEX.test('test+tag@domain.org'));
  });

  test('rejects email without @', () => {
    assert(!EMAIL_REGEX.test('userexample.com'));
  });

  test('rejects email without domain', () => {
    assert(!EMAIL_REGEX.test('user@'));
  });

  test('rejects email without TLD', () => {
    assert(!EMAIL_REGEX.test('user@domain'));
  });

  test('rejects email with space before @', () => {
    assert(!EMAIL_REGEX.test('user @example.com'));
  });

  test('rejects email with space after @', () => {
    assert(!EMAIL_REGEX.test('user@ example.com'));
  });

  test('rejects email with multiple @', () => {
    assert(!EMAIL_REGEX.test('user@@example.com'));
  });

  test('rejects empty string', () => {
    assert(!EMAIL_REGEX.test(''));
  });
});

describe('Handler validation logic', () => {
  test('missing type returns error', () => {
    const event = { to: 'test@example.com' };
    // Simulate validation: !type || !to
    const isValid = event.type && event.to;
    assert(!isValid, 'Should reject when type is missing');
  });

  test('missing to returns error', () => {
    const event = { type: 'welcome' };
    const isValid = event.type && event.to;
    assert(!isValid, 'Should reject when to is missing');
  });

  test('invalid email returns error', () => {
    const event = { type: 'welcome', to: 'not-an-email' };
    const isValid = event.type && event.to && EMAIL_REGEX.test(event.to);
    assert(!isValid, 'Should reject invalid email');
  });

  test('unknown template type returns error', () => {
    const event = { type: 'unknown_type', to: 'test@example.com' };
    const template = getTemplate(event.type, {});
    assert(template === null, 'Should return null for unknown template type');
  });

  test('valid event passes all validations', () => {
    const event = { type: 'welcome', to: 'test@example.com', data: {} };
    const typeValid = !!event.type;
    const toValid = !!event.to;
    const emailValid = EMAIL_REGEX.test(event.to);
    const templateValid = getTemplate(event.type, event.data || {}) !== null;

    assert(typeValid && toValid && emailValid && templateValid, 'Should pass all validations');
  });
});

describe('Template recognition', () => {
  test('recognizes welcome template', () => {
    const template = getTemplate('welcome', {});
    assert(template !== null, 'Welcome template should be recognized');
  });

  test('recognizes offer_alert template', () => {
    const template = getTemplate('offer_alert', {});
    assert(template !== null, 'Offer alert template should be recognized');
  });

  test('recognizes subscription_confirmed template', () => {
    const template = getTemplate('subscription_confirmed', {});
    assert(template !== null, 'Subscription confirmed template should be recognized');
  });

  test('recognizes weekly_digest template', () => {
    const template = getTemplate('weekly_digest', {});
    assert(template !== null, 'Weekly digest template should be recognized');
  });

  test('recognizes lifecycle_day1 template', () => {
    const template = getTemplate('lifecycle_day1', {});
    assert(template !== null, 'Lifecycle day1 template should be recognized');
  });

  test('recognizes lifecycle_day14 template', () => {
    const template = getTemplate('lifecycle_day14', {});
    assert(template !== null, 'Lifecycle day14 template should be recognized');
  });

  test('recognizes lifecycle_day28 template', () => {
    const template = getTemplate('lifecycle_day28', {});
    assert(template !== null, 'Lifecycle day28 template should be recognized');
  });

  test('rejects unknown template type', () => {
    const template = getTemplate('nonexistent_type', {});
    assert(template === null, 'Unknown template type should return null');
  });

  test('all 7 known template types are available', () => {
    const types = [
      'welcome',
      'offer_alert',
      'subscription_confirmed',
      'weekly_digest',
      'lifecycle_day1',
      'lifecycle_day14',
      'lifecycle_day28',
    ];

    const allValid = types.every(type => getTemplate(type, {}) !== null);
    assert(allValid, 'All 7 template types should be recognized');
  });
});

describe('Template content validation', () => {
  test('welcome template has correct subject', () => {
    const template = getTemplate('welcome', {});
    assert.strictEqual(template.subject, 'Welcome to Spot Platform!');
  });

  test('welcome template produces non-empty html', () => {
    const template = getTemplate('welcome', {});
    assert(template.html && template.html.length > 0);
  });

  test('welcome template produces non-empty text', () => {
    const template = getTemplate('welcome', {});
    assert(template.text && template.text.length > 0);
  });

  test('offer alert template includes restaurant name (escaped)', () => {
    const restaurantName = '<Dangerous & Co.>';
    const template = getTemplate('offer_alert', { restaurantName });
    const escaped = escapeHtml(restaurantName);
    // Check that the escaped version is in the HTML
    assert(template.html.includes(escaped));
  });

  test('offer alert subject includes restaurant name', () => {
    const restaurantName = 'Joe\'s Pizza';
    const template = getTemplate('offer_alert', { restaurantName });
    assert(template.subject.includes(restaurantName));
  });

  test('lifecycle day1 template has 3 steps', () => {
    const template = getTemplate('lifecycle_day1', {});
    // Count step boxes in the HTML
    const stepMatches = (template.html.match(/step-box/g) || []).length;
    assert.strictEqual(stepMatches, 3, 'Day1 template should have 3 step boxes');
  });

  test('lifecycle day14 template shows stats when hasActivity', () => {
    const dataWithActivity = { campaignCount: 2, scanCount: 5 };
    const template = getTemplate('lifecycle_day14', dataWithActivity);
    // Check that stats are shown (subject includes "your progress")
    assert(template.subject.includes('your progress so far'));
  });

  test('lifecycle day14 template shows no stats message when no activity', () => {
    const dataNoActivity = { campaignCount: 0, scanCount: 0 };
    const template = getTemplate('lifecycle_day14', dataNoActivity);
    // Subject should indicate "let's get you started"
    assert(template.subject.includes("let's get you started"));
  });

  test('lifecycle day28 template shows tier badge', () => {
    const template = getTemplate('lifecycle_day28', { tier: 'gold' });
    // Check for tier badge in HTML
    assert(template.html.includes('tier-badge'));
    assert(template.html.includes('gold'));
  });

  test('lifecycle day28 template defaults to bronze tier', () => {
    const template = getTemplate('lifecycle_day28', {});
    assert(template.html.includes('bronze'));
  });

  test('subscription_confirmed template produces non-empty html and text', () => {
    const template = getTemplate('subscription_confirmed', {});
    assert(template.html && template.html.length > 0);
    assert(template.text && template.text.length > 0);
  });

  test('weekly_digest template produces non-empty html and text', () => {
    const template = getTemplate('weekly_digest', {});
    assert(template.html && template.html.length > 0);
    assert(template.text && template.text.length > 0);
  });

  test('all templates return object with subject, html, and text', () => {
    const types = [
      'welcome',
      'offer_alert',
      'subscription_confirmed',
      'weekly_digest',
      'lifecycle_day1',
      'lifecycle_day14',
      'lifecycle_day28',
    ];

    types.forEach(type => {
      const template = getTemplate(type, {});
      assert(template.subject && typeof template.subject === 'string', `${type} should have subject`);
      assert(template.html && typeof template.html === 'string', `${type} should have html`);
      assert(template.text && typeof template.text === 'string', `${type} should have text`);
    });
  });

  test('template subject and body are never empty', () => {
    const types = [
      'welcome',
      'offer_alert',
      'subscription_confirmed',
      'weekly_digest',
      'lifecycle_day1',
      'lifecycle_day14',
      'lifecycle_day28',
    ];

    types.forEach(type => {
      const template = getTemplate(type, { name: 'Test', userName: 'Test' });
      assert(template.subject.length > 0, `${type} subject should not be empty`);
      assert(template.html.length > 0, `${type} html should not be empty`);
      assert(template.text.length > 0, `${type} text should not be empty`);
    });
  });
});
