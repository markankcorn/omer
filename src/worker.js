import MEDITATIONS from './generated/meditations-data.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_FROM = 'noreply@omercount.com';
const DEFAULT_SITE_URL = 'https://omercount.com';
const DEFAULT_REMINDER_OFFSET_MINUTES = 30;

const SEFIROT = [
  { he: 'חֶסֶד', en: 'Love', tr: 'Hesed' },
  { he: 'גְּבוּרָה', en: 'Strength', tr: 'Gevurah' },
  { he: 'תִּפְאֶרֶת', en: 'Compassion', tr: 'Tiferet' },
  { he: 'נֶצַח', en: 'Endurance', tr: 'Netzach' },
  { he: 'הוֹד', en: 'Humility', tr: 'Hod' },
  { he: 'יְסוֹד', en: 'Foundation', tr: 'Yesod' },
  { he: 'מַלְכוּת', en: 'Nobility', tr: 'Malchut' },
];

const TZ_LOCATION_MAP = {
  '-10': { lat: 21, lng: -157 },
  '-9': { lat: 61, lng: -150 },
  '-8': { lat: 37, lng: -122 },
  '-7': { lat: 40, lng: -105 },
  '-6': { lat: 41, lng: -87 },
  '-5': { lat: 40, lng: -74 },
  '-4': { lat: 18, lng: -66 },
  '-3': { lat: -23, lng: -43 },
  '0': { lat: 51, lng: 0 },
  '1': { lat: 48, lng: 2 },
  '2': { lat: 32, lng: 34 },
  '3': { lat: 55, lng: 37 },
  '5.5': { lat: 19, lng: 73 },
  '8': { lat: 31, lng: 121 },
  '9': { lat: 35, lng: 139 },
  '10': { lat: -34, lng: 151 },
  '12': { lat: -36, lng: 175 },
};

const dateTimeFormatterCache = new Map();
const hebrewMonthDayFormatterCache = new Map();
const localDateFormatterCache = new Map();

export default {
  async fetch(request, env) {
    try {
      return await routeRequest(request, env);
    } catch (error) {
      console.error('request_failed', JSON.stringify(serializeError(error)));
      return json(
        {
          success: false,
          error: 'Something went wrong. Please try again in a minute.',
        },
        500,
      );
    }
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(handleScheduled(controller, env));
  },
};

async function routeRequest(request, env) {
  const url = new URL(request.url);

  if (request.method === 'POST' && url.pathname === '/api/subscriptions') {
    return handleSubscriptionSignup(request, env);
  }

  if (url.pathname === '/confirm' && request.method === 'GET') {
    return handleConfirmation(request, env);
  }

  if (url.pathname === '/unsubscribe' && (request.method === 'GET' || request.method === 'POST')) {
    return handleUnsubscribe(request, env);
  }

  return env.ASSETS.fetch(request);
}

async function handleSubscriptionSignup(request, env) {
  const body = await safeJson(request);
  if (!body) {
    return json({ success: false, error: 'Please send valid JSON.' }, 400);
  }

  const email = normalizeEmail(body.email);
  const timeZone = typeof body.timeZone === 'string' ? body.timeZone.trim() : '';
  const zipCode = normalizeZipCode(body.zipCode);
  const latitude = sanitizeLatitude(body.latitude);
  const longitude = sanitizeLongitude(body.longitude);
  const reminderOffsetMinutes = DEFAULT_REMINDER_OFFSET_MINUTES;
  const hasCoordinates = latitude !== null && longitude !== null;

  if (!email || !isValidEmail(email)) {
    return json({ success: false, error: 'Please enter a valid email address.' }, 400);
  }

  if (!timeZone || !isValidTimeZone(timeZone)) {
    return json({ success: false, error: 'We could not determine your time zone.' }, 400);
  }

  if (!zipCode && !hasCoordinates) {
    return json({ success: false, error: 'Use your location or enter a valid US ZIP code.' }, 400);
  }

  let locationRecord;
  if (zipCode) {
    const zipLookup = await lookupZipCode(zipCode);
    if (!zipLookup) {
      return json({ success: false, error: 'We could not find that ZIP code.' }, 400);
    }
    locationRecord = {
      zipCode: zipLookup.zipCode,
      placeName: zipLookup.placeName,
      stateCode: zipLookup.stateCode,
      latitude: zipLookup.latitude,
      longitude: zipLookup.longitude,
      sunsetMode: 'zip',
    };
  } else {
    locationRecord = {
      zipCode: '',
      placeName: '',
      stateCode: '',
      latitude,
      longitude,
      sunsetMode: 'precise',
    };
  }

  const now = new Date().toISOString();
  const existing = await getSubscriberByEmail(env.DB, email);

  if (existing && existing.status === 'active') {
    await env.DB
      .prepare(
        `
          UPDATE subscribers
          SET timezone = ?, zip_code = ?, place_name = ?, state_code = ?, latitude = ?, longitude = ?, sunset_mode = ?, reminder_offset_minutes = ?, updated_at = ?
          WHERE id = ?
        `,
      )
      .bind(
        timeZone,
        locationRecord.zipCode,
        locationRecord.placeName,
        locationRecord.stateCode,
        locationRecord.latitude,
        locationRecord.longitude,
        locationRecord.sunsetMode,
        reminderOffsetMinutes,
        now,
        existing.id,
      )
      .run();

    return json({
      success: true,
      message: 'You are already subscribed. Your reminder settings are updated.',
    });
  }

  const confirmToken = crypto.randomUUID();
  const unsubscribeToken = existing?.unsubscribe_token || crypto.randomUUID();

  if (existing) {
    await env.DB
      .prepare(
        `
          UPDATE subscribers
          SET timezone = ?, zip_code = ?, place_name = ?, state_code = ?, latitude = ?, longitude = ?, sunset_mode = ?, reminder_offset_minutes = ?,
              status = 'pending', confirm_token = ?, unsubscribe_token = ?, updated_at = ?
          WHERE id = ?
        `,
      )
      .bind(
        timeZone,
        locationRecord.zipCode,
        locationRecord.placeName,
        locationRecord.stateCode,
        locationRecord.latitude,
        locationRecord.longitude,
        locationRecord.sunsetMode,
        reminderOffsetMinutes,
        confirmToken,
        unsubscribeToken,
        now,
        existing.id,
      )
      .run();
  } else {
    await env.DB
      .prepare(
        `
          INSERT INTO subscribers (
            email,
            timezone,
            zip_code,
            place_name,
            state_code,
            latitude,
            longitude,
            sunset_mode,
            reminder_offset_minutes,
            status,
            confirm_token,
            unsubscribe_token,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
        `,
      )
      .bind(
        email,
        timeZone,
        locationRecord.zipCode,
        locationRecord.placeName,
        locationRecord.stateCode,
        locationRecord.latitude,
        locationRecord.longitude,
        locationRecord.sunsetMode,
        reminderOffsetMinutes,
        confirmToken,
        unsubscribeToken,
        now,
        now,
      )
      .run();
  }

  await sendConfirmationEmail(env, {
    email,
    timeZone,
    zipCode: locationRecord.zipCode,
    placeName: locationRecord.placeName,
    stateCode: locationRecord.stateCode,
    sunsetMode: locationRecord.sunsetMode,
    confirmToken,
    reminderOffsetMinutes,
  });

  return json({
    success: true,
    message: 'Check your inbox for a confirmation link to start evening reminders.',
  });
}

async function handleConfirmation(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) {
    return htmlResponse(
      renderMessagePage({
        title: 'Missing confirmation link',
        body: 'That confirmation link is missing a token. Head back to the site and request a new email reminder link.',
        actionLabel: 'Return to omercount.com',
        actionHref: siteUrl(env),
      }),
      400,
    );
  }

  const subscriber = await env.DB
    .prepare('SELECT * FROM subscribers WHERE confirm_token = ? LIMIT 1')
    .bind(token)
    .first();

  if (!subscriber) {
    return htmlResponse(
      renderMessagePage({
        title: 'That link is no longer active',
        body: 'This confirmation link has already been used or has expired. You can sign up again from the site in a few seconds.',
        actionLabel: 'Open omercount.com',
        actionHref: siteUrl(env),
      }),
    );
  }

  const now = new Date().toISOString();
  await env.DB
    .prepare(
      `
        UPDATE subscribers
        SET status = 'active', confirm_token = NULL, confirmed_at = ?, updated_at = ?
        WHERE id = ?
      `,
    )
    .bind(now, now, subscriber.id)
    .run();

  return htmlResponse(
    renderMessagePage({
      title: 'Evening reminder confirmed',
      body:
        'You are set. Starting with the next active Omer evening, you will get the upcoming day count and meditation essay about half an hour before sunset.',
      actionLabel: 'Open tonight\'s count',
      actionHref: siteUrl(env),
    }),
  );
}

async function handleUnsubscribe(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return request.method === 'POST'
      ? new Response('Missing token', { status: 400 })
      : htmlResponse(
          renderMessagePage({
            title: 'Missing unsubscribe link',
            body: 'That unsubscribe link is missing a token. Open the latest reminder email and try again.',
            actionLabel: 'Return to omercount.com',
            actionHref: siteUrl(env),
          }),
          400,
        );
  }

  const subscriber = await env.DB
    .prepare('SELECT * FROM subscribers WHERE unsubscribe_token = ? LIMIT 1')
    .bind(token)
    .first();

  if (subscriber && subscriber.status !== 'unsubscribed') {
    await env.DB
      .prepare('UPDATE subscribers SET status = ?, updated_at = ? WHERE id = ?')
      .bind('unsubscribed', new Date().toISOString(), subscriber.id)
      .run();
  }

  if (request.method === 'POST') {
    return new Response('Unsubscribed', { status: 200 });
  }

  return htmlResponse(
    renderMessagePage({
      title: 'You are unsubscribed',
      body: 'Evening Omer reminders are turned off for this address. You can subscribe again anytime from the site.',
      actionLabel: 'Open omercount.com',
      actionHref: siteUrl(env),
    }),
  );
}

async function handleScheduled(controller, env) {
  const now = new Date(controller.scheduledTime || Date.now());
  const rows = await env.DB
    .prepare(
      `
        SELECT
          id,
          email,
          timezone,
          zip_code,
          place_name,
          state_code,
          latitude,
          longitude,
          sunset_mode,
          reminder_offset_minutes,
          unsubscribe_token,
          last_sent_local_date,
          status
        FROM subscribers
        WHERE status = 'active'
      `,
    )
    .all();

  const subscribers = rows.results || [];
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const subscriber of subscribers) {
    try {
      const reminder = getReminderForSubscriber(subscriber, now);

      if (!reminder.shouldSend) {
        skipped += 1;
        continue;
      }

      const message = buildReminderEmail(env, subscriber, reminder);
      await env.EMAIL.send(message);

      await env.DB
        .prepare(
          `
            UPDATE subscribers
            SET last_sent_local_date = ?, last_sent_omer_day = ?, last_sent_at = ?, updated_at = ?
            WHERE id = ?
          `,
        )
        .bind(
          reminder.localDateKey,
          reminder.omerDay,
          now.toISOString(),
          now.toISOString(),
          subscriber.id,
        )
        .run();

      sent += 1;
    } catch (error) {
      failed += 1;
      console.error(
        'scheduled_send_failed',
        JSON.stringify({
          subscriberId: subscriber.id,
          email: subscriber.email,
          ...serializeError(error),
        }),
      );

      if (error && error.code === 'E_RECIPIENT_SUPPRESSED') {
        await env.DB
          .prepare('UPDATE subscribers SET status = ?, updated_at = ? WHERE id = ?')
          .bind('suppressed', now.toISOString(), subscriber.id)
          .run();
      }
    }
  }

  console.log(
    JSON.stringify({
      event: 'scheduled_complete',
      at: now.toISOString(),
      totalSubscribers: subscribers.length,
      sent,
      skipped,
      failed,
    }),
  );
}

function getReminderForSubscriber(subscriber, now) {
  const timeZone = subscriber.timezone;
  const localNow = getDateTimeParts(now, timeZone);
  const localDate = {
    year: localNow.year,
    month: localNow.month,
    day: localNow.day,
  };
  const localDateKey = formatLocalDateKey(localDate);
  const yearForSeason = localDate.year;
  const nisan16 = findNisan16Gregorian(yearForSeason, timeZone);
  const omerStartLocalDate = addDaysToLocalDate(nisan16, -1);
  const currentOffsetMinutes = getTimeZoneOffsetMinutes(zonedDateTimeToUtc(localDate, 12, 0, timeZone), timeZone);
  const location = getSubscriberLocation(subscriber, timeZone, yearForSeason);
  const sunsetMinutes = calcSunsetMinutes(localDate, location.lat, location.lng, currentOffsetMinutes);
  const diffDays = daysBetweenLocalDates(localDate, omerStartLocalDate);
  const omerDay = diffDays + 1;

  if (subscriber.last_sent_local_date === localDateKey) {
    return { shouldSend: false, reason: 'already-sent' };
  }

  if (omerDay < 1 || omerDay > 49) {
    return { shouldSend: false, reason: 'outside-season' };
  }

  if (sunsetMinutes === null) {
    return { shouldSend: false, reason: 'no-sunset' };
  }

  const reminderOffsetMinutes = sanitizeReminderOffset(subscriber.reminder_offset_minutes);
  const targetMinutes = sunsetMinutes - reminderOffsetMinutes;
  if (localNow.totalMinutes < targetMinutes) {
    return { shouldSend: false, reason: 'before-target' };
  }

  const dateLabel = getLocalDateLabel(now, timeZone);
  const sunsetLabel = formatClockMinutes(sunsetMinutes);
  const reminderLabel = formatClockMinutes(targetMinutes);

  return {
    shouldSend: true,
    dateLabel,
    localDateKey,
    omerDay,
    sunsetLabel,
    reminderLabel,
    reminderOffsetMinutes,
    zipCode: subscriber.zip_code,
    placeName: subscriber.place_name,
    stateCode: subscriber.state_code,
    sunsetMode: subscriber.sunset_mode || (subscriber.zip_code ? 'zip' : subscriber.latitude !== null ? 'precise' : 'estimated'),
    timeZone,
  };
}

function buildReminderEmail(env, subscriber, reminder) {
  const day = reminder.omerDay;
  const countText = buildCountText(day);
  const sefirah = getSefirahForDay(day);
  const meditation = MEDITATIONS[day] || '';
  const meditationHtml = meditation ? formatMeditationHtml(meditation) : '<p style="margin:0;color:#d7d9e5;">No meditation essay is available for tonight.</p>';
  const websiteUrl = siteUrl(env);
  const unsubscribeUrl = new URL('/unsubscribe', websiteUrl);
  unsubscribeUrl.searchParams.set('token', subscriber.unsubscribe_token);

  const placeLabel = formatLocationLabel(reminder);
  const timingLine = `Sent about ${reminder.reminderOffsetMinutes} minutes before sunset for ${placeLabel}.`;

  const html = `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#0b1026;color:#e8e8f0;font-family:Inter,Arial,sans-serif;">
    <div style="background:#0b1026;padding:32px 16px;">
      <div style="max-width:640px;margin:0 auto;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="font-family:Georgia,serif;font-size:34px;line-height:1.1;color:#ffffff;">Counting the Omer</div>
          <div style="margin-top:8px;font-size:13px;letter-spacing:0.18em;text-transform:uppercase;color:#c8a34e;">ספירת העומר</div>
        </div>

        <div style="background:#131836;border:1px solid rgba(200,163,78,0.18);border-radius:16px;padding:28px 24px;margin-bottom:20px;">
          <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#c8a34e;margin-bottom:8px;">Tonight's Count</div>
          <div style="font-size:14px;color:#9898b0;margin-bottom:6px;">${escapeHtml(reminder.dateLabel)}</div>
          <div style="font-family:Georgia,serif;font-size:76px;line-height:1;color:#c8a34e;margin:14px 0 18px;">${day}</div>
          <div style="font-family:Georgia,serif;font-size:24px;line-height:1.3;color:#f3f4f8;margin-bottom:8px;">Tonight after sunset: Day ${day}</div>
          <div style="font-size:15px;line-height:1.6;color:#b6b8c7;margin-bottom:18px;">${escapeHtml(timingLine)} Sunset is ${escapeHtml(reminder.sunsetLabel)} today, so this landed around ${escapeHtml(reminder.reminderLabel)}.</div>
          <div style="padding-top:18px;border-top:1px solid rgba(200,163,78,0.15);">
            <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#9898b0;margin-bottom:6px;">Sefirah of the Day</div>
            <div style="font-size:24px;line-height:1.3;color:#e8d5a3;margin-bottom:4px;">${escapeHtml(sefirah.hebrew)}</div>
            <div style="font-family:Georgia,serif;font-size:18px;color:#d7d9e5;">${escapeHtml(sefirah.english)}</div>
          </div>
        </div>

        <div style="background:rgba(22,28,62,0.86);border:1px solid rgba(200,163,78,0.15);border-radius:16px;padding:24px;margin-bottom:20px;">
          <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#9898b0;margin-bottom:12px;">The Count</div>
          <div style="direction:rtl;text-align:right;font-size:25px;line-height:1.8;color:#ffffff;margin-bottom:10px;">${escapeHtml(countText.he)}</div>
          <div style="font-family:Georgia,serif;font-size:18px;line-height:1.7;color:#e8d5a3;margin-bottom:10px;">${escapeHtml(countText.tr)}</div>
          <div style="font-size:15px;line-height:1.7;color:#c8cad7;">${escapeHtml(countText.en)}</div>
        </div>

        <div style="background:rgba(22,28,62,0.86);border:1px solid rgba(200,163,78,0.15);border-radius:16px;padding:24px;margin-bottom:20px;">
          <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#9898b0;margin-bottom:14px;">Meditation</div>
          ${meditationHtml}
        </div>

        <div style="text-align:center;margin-bottom:18px;">
          <a href="${escapeAttribute(websiteUrl)}" style="display:inline-block;background:#c8a34e;color:#0b1026;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px;">Open tonight's count</a>
        </div>

        <div style="text-align:center;font-size:12px;line-height:1.7;color:#8f93a8;">
          You asked for evening Omer reminders from omercount.com.<br>
          <a href="${escapeAttribute(unsubscribeUrl.toString())}" style="color:#c8a34e;">Unsubscribe</a>
        </div>
      </div>
    </div>
  </body>
</html>`;

  const text = [
    `Tonight after sunset: Day ${day} of the Omer`,
    reminder.dateLabel,
    '',
    `Reminder timing: ${reminder.reminderLabel} local time for ${placeLabel}. Sunset is ${reminder.sunsetLabel}.`,
    '',
    countText.en,
    countText.he,
    countText.tr,
    '',
    `Sefirah: ${sefirah.english} (${sefirah.hebrew})`,
    '',
    meditation || 'No meditation essay is available for tonight.',
    '',
    `Open tonight's count: ${websiteUrl}`,
    `Unsubscribe: ${unsubscribeUrl.toString()}`,
  ].join('\n');

  const attachmentBody = [
    `Tonight after sunset: Day ${day} of the Omer`,
    countText.en,
    '',
    `Sefirah: ${sefirah.english}`,
    '',
    meditation || 'No meditation essay is available for tonight.',
  ].join('\n');

  return {
    to: subscriber.email,
    from: { email: env.EMAIL_FROM || DEFAULT_FROM, name: 'Omer Count' },
    subject: `Tonight after sunset: Day ${day} of the Omer`,
    html,
    text,
    attachments: [
      {
        content: new TextEncoder().encode(attachmentBody).buffer,
        filename: `omer-day-${String(day).padStart(2, '0')}-meditation.txt`,
        type: 'text/plain; charset=utf-8',
        disposition: 'attachment',
      },
    ],
    headers: {
      'Auto-Submitted': 'auto-generated',
      'List-Unsubscribe': `<${unsubscribeUrl.toString()}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      'List-Id': 'Omer Count Reminders <omercount.com>',
      Precedence: 'list',
      'X-Omer-Day': String(day),
      'X-Omer-Timezone': reminder.timeZone,
    },
  };
}

async function sendConfirmationEmail(env, payload) {
  const confirmationUrl = new URL('/confirm', siteUrl(env));
  confirmationUrl.searchParams.set('token', payload.confirmToken);

  const locationLabel = formatLocationLabel(payload);
  const timingCopy =
    payload.sunsetMode === 'precise'
      ? `We will send it about ${payload.reminderOffsetMinutes} minutes before sunset using your saved location.`
      : `We will send it about ${payload.reminderOffsetMinutes} minutes before sunset for ${locationLabel}.`;

  const html = `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#0b1026;color:#e8e8f0;font-family:Inter,Arial,sans-serif;">
    <div style="background:#0b1026;padding:32px 16px;">
      <div style="max-width:640px;margin:0 auto;background:#131836;border:1px solid rgba(200,163,78,0.18);border-radius:16px;padding:28px 24px;">
        <div style="text-align:center;margin-bottom:22px;">
          <div style="font-family:Georgia,serif;font-size:34px;line-height:1.1;color:#ffffff;">Counting the Omer</div>
          <div style="margin-top:8px;font-size:13px;letter-spacing:0.18em;text-transform:uppercase;color:#c8a34e;">Evening Reminder</div>
        </div>
        <div style="font-size:16px;line-height:1.7;color:#d7d9e5;margin-bottom:16px;">
          Confirm your subscription to evening Omer reminders for <strong style="color:#ffffff;">${escapeHtml(payload.email)}</strong>.
        </div>
        <div style="font-size:15px;line-height:1.7;color:#b8bbca;margin-bottom:20px;">
          ${escapeHtml(timingCopy)} Your current time zone is ${escapeHtml(payload.timeZone)}.
        </div>
        <div style="text-align:center;margin:28px 0 22px;">
          <a href="${escapeAttribute(confirmationUrl.toString())}" style="display:inline-block;background:#c8a34e;color:#0b1026;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px;">Confirm Reminder</a>
        </div>
        <div style="font-size:12px;line-height:1.7;color:#8f93a8;text-align:center;">
          If you did not ask for this, you can ignore this email.
        </div>
      </div>
    </div>
  </body>
</html>`;

  const text = [
    'Confirm your evening Omer reminder.',
    '',
    `Email: ${payload.email}`,
    timingCopy,
    `Time zone: ${payload.timeZone}`,
    '',
    `Confirm here: ${confirmationUrl.toString()}`,
  ].join('\n');

  return env.EMAIL.send({
    to: payload.email,
    from: { email: env.EMAIL_FROM || DEFAULT_FROM, name: 'Omer Count' },
    subject: 'Confirm your evening Omer reminder',
    html,
    text,
    headers: {
      'Auto-Submitted': 'auto-generated',
      'X-Omer-Confirmation': 'true',
    },
  });
}

function renderMessagePage({ title, body, actionLabel, actionHref }) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#0b1026;color:#e8e8f0;font-family:Inter,Arial,sans-serif;">
    <div style="min-height:100vh;padding:32px 16px;display:flex;align-items:center;justify-content:center;">
      <div style="max-width:640px;width:100%;background:#131836;border:1px solid rgba(200,163,78,0.18);border-radius:16px;padding:32px 24px;text-align:center;">
        <div style="font-family:Georgia,serif;font-size:34px;line-height:1.1;color:#ffffff;margin-bottom:10px;">Counting the Omer</div>
        <div style="font-size:13px;letter-spacing:0.18em;text-transform:uppercase;color:#c8a34e;margin-bottom:24px;">ספירת העומר</div>
        <div style="font-family:Georgia,serif;font-size:28px;line-height:1.2;color:#ffffff;margin-bottom:16px;">${escapeHtml(title)}</div>
        <div style="font-size:16px;line-height:1.8;color:#c8cad7;margin-bottom:26px;">${escapeHtml(body)}</div>
        <a href="${escapeAttribute(actionHref)}" style="display:inline-block;background:#c8a34e;color:#0b1026;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px;">${escapeHtml(actionLabel)}</a>
      </div>
    </div>
  </body>
</html>`;
}

function getSubscriberLocation(subscriber, timeZone, year) {
  if (subscriber.latitude !== null && subscriber.longitude !== null) {
    return { lat: Number(subscriber.latitude), lng: Number(subscriber.longitude) };
  }

  const janOffset = getTimeZoneOffsetMinutes(zonedDateTimeToUtc({ year, month: 1, day: 1 }, 12, 0, timeZone), timeZone) / 60;
  const julOffset = getTimeZoneOffsetMinutes(zonedDateTimeToUtc({ year, month: 7, day: 1 }, 12, 0, timeZone), timeZone) / 60;
  const standardOffset = Math.min(janOffset, julOffset);
  return TZ_LOCATION_MAP[String(standardOffset)] || { lat: 40, lng: -74 };
}

function calcSunsetMinutes(localDate, lat, lng, timeZoneOffsetMinutes) {
  const dayOfYear = getDayOfYear(localDate);
  const gamma = (2 * Math.PI / 365) * (dayOfYear - 1);

  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.04089 * Math.sin(2 * gamma));

  const latRad = lat * (Math.PI / 180);
  const cosHA =
    Math.cos(90.833 * (Math.PI / 180)) / (Math.cos(latRad) * Math.cos(decl)) -
    Math.tan(latRad) * Math.tan(decl);

  if (Math.abs(cosHA) > 1) {
    return null;
  }

  const ha = Math.acos(cosHA) * (180 / Math.PI);
  const sunsetUTC = 720 - 4 * lng + 4 * ha - eqTime;
  return sunsetUTC + timeZoneOffsetMinutes;
}

function getDayOfYear(localDate) {
  const start = Date.UTC(localDate.year, 0, 0);
  const current = Date.UTC(localDate.year, localDate.month - 1, localDate.day);
  return Math.floor((current - start) / DAY_MS);
}

function findNisan16Gregorian(year, timeZone) {
  const formatter = getHebrewMonthDayFormatter(timeZone);

  for (let month = 3; month <= 5; month += 1) {
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
      const localNoon = zonedDateTimeToUtc({ year, month, day }, 12, 0, timeZone);
      if (formatter.format(localNoon) === '16 Nisan') {
        return { year, month, day };
      }
    }
  }

  throw new Error(`Could not find 16 Nisan for ${year} in ${timeZone}`);
}

function zonedDateTimeToUtc(localDate, hour, minute, timeZone) {
  const base = Date.UTC(localDate.year, localDate.month - 1, localDate.day, hour, minute, 0);
  let candidate = base;

  for (let i = 0; i < 3; i += 1) {
    const offsetMinutes = getTimeZoneOffsetMinutes(new Date(candidate), timeZone);
    const adjusted = base - offsetMinutes * 60 * 1000;
    if (adjusted === candidate) {
      break;
    }
    candidate = adjusted;
  }

  return new Date(candidate);
}

function getTimeZoneOffsetMinutes(date, timeZone) {
  const parts = getDateTimeParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return (asUtc - date.getTime()) / 60000;
}

function getDateTimeParts(date, timeZone) {
  const formatter = getDateTimeFormatter(timeZone);
  const parts = formatter.formatToParts(date);
  const values = {};

  for (const part of parts) {
    if (part.type !== 'literal') {
      values[part.type] = Number(part.value);
    }
  }

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
    totalMinutes: values.hour * 60 + values.minute,
  };
}

function getDateTimeFormatter(timeZone) {
  if (!dateTimeFormatterCache.has(timeZone)) {
    dateTimeFormatterCache.set(
      timeZone,
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      }),
    );
  }

  return dateTimeFormatterCache.get(timeZone);
}

function getHebrewMonthDayFormatter(timeZone) {
  if (!hebrewMonthDayFormatterCache.has(timeZone)) {
    hebrewMonthDayFormatterCache.set(
      timeZone,
      new Intl.DateTimeFormat('en-u-ca-hebrew', {
        timeZone,
        month: 'long',
        day: 'numeric',
      }),
    );
  }

  return hebrewMonthDayFormatterCache.get(timeZone);
}

function getLocalDateLabel(date, timeZone) {
  if (!localDateFormatterCache.has(timeZone)) {
    localDateFormatterCache.set(
      timeZone,
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
    );
  }

  return localDateFormatterCache.get(timeZone).format(date);
}

function addDaysToLocalDate(localDate, days) {
  const date = new Date(Date.UTC(localDate.year, localDate.month - 1, localDate.day + days));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function daysBetweenLocalDates(a, b) {
  const aUtc = Date.UTC(a.year, a.month - 1, a.day);
  const bUtc = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((aUtc - bUtc) / DAY_MS);
}

function formatLocalDateKey(localDate) {
  return `${localDate.year}-${pad(localDate.month)}-${pad(localDate.day)}`;
}

function getSefirahForDay(day) {
  const weekIdx = Math.floor((day - 1) / 7);
  const dayIdx = (day - 1) % 7;
  const weekSefirah = SEFIROT[weekIdx];
  const daySefirah = SEFIROT[dayIdx];

  return {
    hebrew: `${daySefirah.he} שֶׁבְּ${weekSefirah.he}`,
    english: `${daySefirah.en} within ${weekSefirah.en}`,
  };
}

function formatMeditationHtml(text) {
  return text
    .split('\n\n')
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p style="margin:0 0 16px;color:#d7d9e5;font-size:15px;line-height:1.8;">${formatInlineMeditationText(paragraph)}</p>`)
    .join('');
}

function formatInlineMeditationText(text) {
  const escaped = escapeHtml(text);
  return escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function buildCountText(day) {
  const num = englishNumber(day);
  const weeks = Math.floor(day / 7);
  const rem = day % 7;

  let he;
  let tr;
  let en;

  if (day === 1) {
    he = 'הַיּוֹם יוֹם אֶחָד לָעֹמֶר.';
    tr = "HaYom yom echad la'Omer.";
    en = 'Today is one day of the Omer.';
  } else {
    const { heNum, trNum } = hebrewNumber(day);
    const yamim = day >= 11 ? 'יוֹם' : 'יָמִים';
    const yamimTr = day >= 11 ? 'yom' : 'yamim';
    he = `הַיּוֹם ${heNum} ${yamim}`;
    tr = `HaYom ${trNum} ${yamimTr}`;
    en = `Today is ${num} days`;

    if (weeks >= 1) {
      he += `, שֶׁהֵם ${HEB_WEEKS[weeks]}`;
      tr += `, shehem ${TR_WEEKS[weeks]}`;
      en += `, which is ${weeks} week${weeks > 1 ? 's' : ''}`;

      if (rem > 0) {
        he += ` ${HEB_REM_DAYS[rem]}`;
        tr += ` ${TR_REM_DAYS[rem]}`;
        en += ` and ${rem} day${rem > 1 ? 's' : ''}`;
      }
    }

    he += ' לָעֹמֶר.';
    tr += " la'Omer.";
    en += ' of the Omer.';
  }

  return { he, tr, en };
}

const HEB_ONES = ['', 'אֶחָד', 'שְׁנֵי', 'שְׁלֹשָׁה', 'אַרְבָּעָה', 'חֲמִשָּׁה', 'שִׁשָּׁה', 'שִׁבְעָה', 'שְׁמוֹנָה', 'תִּשְׁעָה'];
const TR_ONES = ['', 'echad', 'shnei', 'shlosha', "arba'a", 'chamisha', 'shisha', "shiv'a", 'shmonah', "tish'a"];
const HEB_ONES_ABS = ['', 'אֶחָד', 'שְׁנַיִם', 'שְׁלֹשָׁה', 'אַרְבָּעָה', 'חֲמִשָּׁה', 'שִׁשָּׁה', 'שִׁבְעָה', 'שְׁמוֹנָה', 'תִּשְׁעָה'];
const TR_ONES_ABS = ['', 'echad', 'shnayim', 'shlosha', "arba'a", 'chamisha', 'shisha', "shiv'a", 'shmonah', "tish'a"];
const HEB_TEENS = ['עֲשָׂרָה', 'אַחַד עָשָׂר', 'שְׁנֵים עָשָׂר', 'שְׁלֹשָׁה עָשָׂר', 'אַרְבָּעָה עָשָׂר', 'חֲמִשָּׁה עָשָׂר', 'שִׁשָּׁה עָשָׂר', 'שִׁבְעָה עָשָׂר', 'שְׁמוֹנָה עָשָׂר', 'תִּשְׁעָה עָשָׂר'];
const TR_TEENS = ['asara', 'achad asar', 'shneim asar', 'shlosha asar', "arba'a asar", 'chamisha asar', 'shisha asar', "shiv'a asar", 'shmonah asar', "tish'a asar"];
const HEB_TENS = { 20: 'עֶשְׂרִים', 30: 'שְׁלֹשִׁים', 40: 'אַרְבָּעִים' };
const TR_TENS = { 20: 'esrim', 30: 'shloshim', 40: "arba'im" };
const HEB_CONN = { 20: 'וְ', 30: 'וּ', 40: 'וְ' };
const TR_CONN = { 20: "v'", 30: 'u', 40: "v'" };
const HEB_WEEKS = ['', 'שָׁבוּעַ אֶחָד', 'שְׁנֵי שָׁבוּעוֹת', 'שְׁלֹשָׁה שָׁבוּעוֹת', 'אַרְבָּעָה שָׁבוּעוֹת', 'חֲמִשָּׁה שָׁבוּעוֹת', 'שִׁשָּׁה שָׁבוּעוֹת', 'שִׁבְעָה שָׁבוּעוֹת'];
const TR_WEEKS = ['', 'shavua echad', 'shnei shavuot', 'shlosha shavuot', "arba'a shavuot", 'chamisha shavuot', 'shisha shavuot', "shiv'a shavuot"];
const HEB_REM_DAYS = ['', 'וְיוֹם אֶחָד', 'וּשְׁנֵי יָמִים', 'וּשְׁלֹשָׁה יָמִים', 'וְאַרְבָּעָה יָמִים', 'וַחֲמִשָּׁה יָמִים', 'וְשִׁשָּׁה יָמִים'];
const TR_REM_DAYS = ['', "v'yom echad", 'ushnei yamim', 'ushlosha yamim', "v'arba'a yamim", 'vachamisha yamim', "v'shisha yamim"];

function hebrewNumber(n) {
  if (n <= 9) {
    return { heNum: HEB_ONES[n], trNum: TR_ONES[n] };
  }
  if (n <= 19) {
    return { heNum: HEB_TEENS[n - 10], trNum: TR_TEENS[n - 10] };
  }

  const tens = Math.floor(n / 10) * 10;
  const ones = n % 10;

  if (ones === 0) {
    return { heNum: HEB_TENS[tens], trNum: TR_TENS[tens] };
  }

  return {
    heNum: `${HEB_ONES_ABS[ones]} ${HEB_CONN[tens]}${HEB_TENS[tens]}`,
    trNum: `${TR_ONES_ABS[ones]} ${TR_CONN[tens]}${TR_TENS[tens]}`,
  };
}

function englishNumber(day) {
  if (day === 1) {
    return 'one';
  }
  return String(day);
}

async function getSubscriberByEmail(db, email) {
  return db.prepare('SELECT * FROM subscribers WHERE email = ? LIMIT 1').bind(email).first();
}

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function normalizeZipCode(zipCode) {
  if (typeof zipCode !== 'string') {
    return '';
  }

  const match = zipCode.trim().match(/^(\d{5})(?:-\d{4})?$/);
  return match ? match[1] : '';
}

function formatLocationLabel(location) {
  if (location.placeName && location.stateCode && location.zipCode) {
    return `${location.placeName}, ${location.stateCode} ${location.zipCode}`;
  }

  if (location.zipCode) {
    return `ZIP ${location.zipCode}`;
  }

  return 'your saved location';
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function sanitizeLatitude(value) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number) || number < -90 || number > 90) {
    return null;
  }
  return Number(number.toFixed(6));
}

function sanitizeLongitude(value) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number) || number < -180 || number > 180) {
    return null;
  }
  return Number(number.toFixed(6));
}

function sanitizeReminderOffset(value) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) {
    return DEFAULT_REMINDER_OFFSET_MINUTES;
  }
  return Math.max(0, Math.min(180, Math.round(number)));
}

async function lookupZipCode(zipCode) {
  const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`, {
    headers: {
      accept: 'application/json',
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`ZIP lookup failed with status ${response.status}`);
  }

  const payload = await response.json();
  const place = Array.isArray(payload.places) ? payload.places[0] : null;

  if (!place) {
    return null;
  }

  return {
    zipCode,
    placeName: place['place name'] || '',
    stateCode: place['state abbreviation'] || '',
    latitude: sanitizeLatitude(place.latitude),
    longitude: sanitizeLongitude(place.longitude),
  };
}

function siteUrl(env) {
  return env.SITE_URL || DEFAULT_SITE_URL;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function htmlResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

async function safeJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function formatClockMinutes(totalMinutes) {
  let minutes = Math.round(totalMinutes);
  while (minutes < 0) {
    minutes += 1440;
  }
  minutes %= 1440;
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${pad(minute)} ${ampm}`;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function serializeError(error) {
  if (!error || typeof error !== 'object') {
    return { message: String(error) };
  }

  return {
    code: error.code,
    message: error.message,
    stack: error.stack,
  };
}
