# Code Review — `omer` Worker + Email Sending

_Date: 2026-04-19_

## Will the email flow work?

**Probably yes — after you verify the domain is onboarded to the new Email Service (not just Email Routing).** Your wrangler binding and payload shape match the new `env.EMAIL.send({ to, from, subject, html, text, attachments, headers })` API exactly. But there are four issues that will bite you on first test, plus a couple of security holes.

---

## Blocking prerequisites (do these before testing)

1. **Onboard `omercount.com` in Cloudflare Dashboard → Compute & AI → Email Sending**. Email Routing is a separate product. Email Sending adds records on the `cf-bounce.omercount.com` subdomain (SPF, DKIM, DMARC, bounce MX). If you haven't done this, every `env.EMAIL.send()` fails. (Email Routing alone would only let you send to pre-verified destinations — not arbitrary subscribers.)
2. Email Service is Workers **Paid** only.

---

## Critical bugs

### 1. Attachment will break `wrangler dev` (`src/worker.js:592`)
```js
content: new TextEncoder().encode(attachmentBody).buffer,  // ArrayBuffer
```
Cloudflare's local simulator cannot serialize `ArrayBuffer` attachments — you'll hit *"Cannot serialize value: [object ArrayBuffer]"*. Production works, but local testing is blocked. For a plain-text attachment, pass a base64 **string**:
```js
content: btoa(unescape(encodeURIComponent(attachmentBody))), // base64 of UTF-8
```
Also — the attachment is a text duplicate of what's in the body; consider dropping it entirely.

### 2. Unsubscribe on GET is a footgun (`src/worker.js:304-346`)
`handleUnsubscribe` mutates DB on GET. Gmail image proxies, Microsoft Defender SafeLinks, Apple Mail link previewers, and every security scanner out there will **pre-fetch** every link in a sent email — and silently unsubscribe your users. Pattern:
- GET → render a confirm page with a POST form.
- POST → do the actual update (you already accept POST for `List-Unsubscribe-Post` one-click; keep that path).

### 3. Duplicate-send race (`src/worker.js:388-405`)
You call `env.EMAIL.send()` **before** updating `last_sent_local_date`. If the D1 write fails, the next 15-min cron resends. Flip it: do an optimistic conditional UPDATE first (`WHERE id = ? AND (last_sent_local_date IS NULL OR last_sent_local_date <> ?)`) and only send if `meta.changes === 1`. If the email then fails, you have a minor missed-day issue rather than a duplicate-send issue, which is the right tradeoff.

### 4. Late-send has no ceiling (`src/worker.js:472-474`)
```js
if (localNow.totalMinutes < targetMinutes) { return { shouldSend: false }; }
```
A subscriber activated at 10 PM (sunset was 7:30 PM, target was 7 PM) will still satisfy `localNow >= target` and receive a "Tonight after sunset" email at 10 PM. Also if a cron tick is skipped. Cap the window:
```js
if (localNow.totalMinutes < targetMinutes || localNow.totalMinutes > targetMinutes + 60) { ... }
```

---

## Header / API correctness

- `List-Unsubscribe`, `List-Unsubscribe-Post`, `List-Id`, `Auto-Submitted`, `Precedence`, and `X-*` are all on Cloudflare's whitelist ✓.
- **`List-Id: Omer Count Reminders <omercount.com>`** (`src/worker.js:602`) — the bracketed portion must look like a hostname label, e.g. `<reminders.omercount.com>`. Raw `omercount.com` is ambiguous; some validators reject it.
- You reference `error.code === 'E_RECIPIENT_SUPPRESSED'` (`src/worker.js:419`). That code isn't documented — the public list is `E_DELIVERY_FAILED`, `E_RATE_LIMIT_EXCEEDED`, `E_DAILY_LIMIT_EXCEEDED`, `E_INTERNAL_SERVER_ERROR`, and header errors. Confirm via a dashboard test or plan to mark `suppressed` based on `E_DELIVERY_FAILED` permanent bounces, otherwise bounced subscribers get retried forever.
- `from: { email, name: 'Omer Count' }` is correct. If you add a Reply-To later, use the top-level `replyTo:` API field — setting `Reply-To` in `headers` returns `E_HEADER_USE_API_FIELD`.
- Max 50 recipients per call (not relevant here; you send 1:1).

---

## Security

### 5. Subscription endpoint has no abuse protection (`src/worker.js:81`)
`/api/subscriptions` accepts any email, no rate limit, no Turnstile. Someone can script "subscription bombing" — hit you 10k times with victim emails. You'll send 10k confirmation emails, damage your Cloudflare sender reputation, and possibly trip `E_DAILY_LIMIT_EXCEEDED`. Add Cloudflare's Rate Limiting binding (per-IP) and/or Turnstile on the signup form.

### 6. Enumeration oracle (`src/worker.js:160`)
You return "You are already subscribed…" vs. "Check your inbox…" — trivially reveals whether an address is registered. Return an identical message in both branches.

### 7. Privacy — coordinate precision (`src/worker.js:1031`)
`sanitizeLatitude/Longitude` rounds to 6 decimals (~10 cm). Sunset calculation needs ≤ 1 km. Round to 2 decimals.

### 8. Logging PII (`src/worker.js:414`)
`console.error` includes `subscriber.email` → lands in Workers Logs/Logpush. Log `subscriber.id` only, or a hash of the email.

### 9. Confirm tokens never expire
Pending rows sit forever. Add a cleanup step (e.g., in the cron, delete `status='pending' AND created_at < now - 48h`).

---

## Scalability

- **Subrequest budget**: scheduled invocation has 10k subrequests on Paid. Each active subscriber costs ≥2 (send + UPDATE). Add a hard LIMIT in the SELECT and paginate, or fan out via Queues / Workflows once you have real volume.
- **Hebrew-calendar scan**: `findNisan16Gregorian` scans ~60 days × `Intl.DateTimeFormat` per subscriber per cron (`src/worker.js:743`). Cache by `(year, timeZone)` at module scope — you already have `hebrewMonthDayFormatterCache` but not for the resolved date.
- **Cron SELECT** has no `LIMIT` or indexed filter — acceptable today, but consider adding `WHERE last_sent_local_date IS NULL OR last_sent_local_date <> ?` and an index on `(status, last_sent_local_date)` to skip already-sent rows cheaply.

---

## Nits

- `run_worker_first = ["/api/*", "/confirm*", "/unsubscribe*"]` — the `*` after `confirm` matches `/confirmation-sale`, etc. Use `/confirm` and `/unsubscribe` (exact) or `/confirm/*`.
- `wrangler.toml` has `database_id = "00000000-0000-0000-0000-000000000000"` — placeholder; make sure your actual ID is wired up correctly in whatever environment you deploy from.
- `isValidTimeZone` constructs a new formatter on every call — cache or just rely on the constructor throwing.
- In the reminder email, `reminder.reminderOffsetMinutes` is computed but the timing copy hardcodes "about ${x} minutes before sunset" — fine.
- `src/generated/` in `.gitignore` would be cleaner; the file is fully derivable from `meditations/`.

---

## Test plan before going live

1. Send yourself a confirmation email by signing up with your own email. Check spam folder and headers (look for `dkim=pass`, `spf=pass`, `dmarc=pass`).
2. Manually invoke the scheduled handler with `wrangler dev --test-scheduled` and a test subscriber row whose `reminder_offset_minutes` window lines up with "now". Use a base64-string attachment during local dev (see issue #1).
3. Click the List-Unsubscribe one-click from Gmail to verify the POST path.
4. Verify GET `/unsubscribe?token=...` does **not** immediately unsubscribe once you've fixed issue #2.
5. Check the Email Sending dashboard for the first live send — look at delivery status, bounces, and any `E_HEADER_*` errors.

The core logic (Hebrew calendar lookup, sunset calculation, count-text generation, sefirah math) is solid. Fix the five numbered bugs above and you're in good shape.
