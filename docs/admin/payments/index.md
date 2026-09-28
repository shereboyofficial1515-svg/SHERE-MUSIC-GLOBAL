---
title: Monetization
description: Plus, submission fees, Paystack, transactions, subscriptions and revenue.
icon: credit-card
order: 7
---
@article shere-music-plus
title: SHERE MUSIC Plus
summary: How the membership works end to end.
keywords: plus, membership, entitlement, downloads, how plus works

SHERE MUSIC Plus is a monthly Paystack subscription (currently {{plusPrice}}). It unlocks device downloads, Plus-only offers and the PLUS badge.

- **Entitlement is computed on the server** from stored subscription periods: a member has Plus while a subscription's paid period hasn't ended. Nothing the browser sends can grant Plus.
- **Downloads** (`GET /api/songs/:id/download`) require Plus — or an admin, or the song's own artist. Everyone else gets `403 PLUS_REQUIRED`, however the endpoint is called. The API streams the file itself and records the download (with its type) only after it completes.
- **Cancelling** keeps Plus until the end of the paid period.

Turning **Sell SHERE MUSIC Plus** off (Settings → Monetization) stops new sign-ups and lets every signed-in listener download again. Existing members keep their paid period.

@article plus-pricing
title: Plus pricing
summary: Change the Plus price and benefits.
keywords: plus price, change price, benefits, plan

**Settings → Monetization**:

- **Monthly price** (in the configured currency; minimum 50). Stored in the smallest unit, e.g. ₦600 = 60000 kobo.
- **Benefits** (one per line) — shown on the Plus page and upgrade prompt. List only features that actually exist.

Changing the price or currency creates a **new Paystack plan** automatically on the next checkout. Existing members keep the plan (and price) they signed up with.

@article artist-submission-fees
title: Artist submission fees
summary: Configure the one-time fee for song submissions.
keywords: submission fee, artist fee, change fee, turn off fee

**Settings → Monetization → Artist music submissions**:

- **Charge a submission fee** — when on, creators pay before a song goes to review. Admin accounts never pay.
- **Submission fee** — currently {{submissionFee}}.

When off, creators submit for free and the normal review (or auto-publish) rules apply. Paid songs always go to review, even when "Publish without review" is on.

@article paystack
title: Paystack
summary: How SHERE MUSIC uses Paystack.
keywords: paystack, payment provider, checkout, test mode, live mode, webhook

- Checkout redirects to Paystack's hosted page (no card data touches SHERE MUSIC).
- The server holds the **secret key** (`PAYSTACK_SECRET_KEY`). `sk_test_…` keys run in **Test** mode, `sk_live_…` keys in **Live** mode. The mode is shown on **Revenue** and **Settings → Monetization**.
- Paystack notifies the API at `POST /api/payments/paystack/webhook`. Set this URL in the Paystack dashboard (Settings → API Keys & Webhooks) for each mode you use.
- Currency: NGN by default. USD, GHS, ZAR and KES can be chosen only if your Paystack account supports them. Prices are never converted.

Setup steps are in [Technical Operations → Paystack](/admin/docs/operations/paystack).

@article transactions
title: Transactions
summary: The Payments page.
keywords: transactions, payments page, reference, payment status, failed payments

**Payments** lists every payment attempt and renewal: reference, user, product, amount, status and date. Filter by status (Paid, Pending, Failed, Not completed, Reversed) and product (Plus, Artist submissions), or search by reference, name or email.

| Status | Meaning |
| --- | --- |
| Pending | Checkout created, not completed yet |
| Paid | Verified with Paystack and fulfilled |
| Failed | Declined, or the amount/currency didn't match |
| Not completed | The customer left checkout |
| Reversed | Reversed by Paystack |

Payments are read-only. Every reference is unique (`SM-PLUS-…`, `SM-SUB-…`); renewals use Paystack's reference and are marked "renewal". Card details are never stored.

![Payments](admin-payments.png)

@article subscriptions
title: Subscriptions
summary: Plus subscription lifecycle.
keywords: subscriptions, renewal, cancelled, attention, expired, non renewing

| Status | Meaning | Has Plus? |
| --- | --- | --- |
| Active | Renews monthly | Yes |
| Payment failed (attention) | Last renewal failed | Until the paid period ends |
| Not renewing / Cancelled | Won't renew | Until the paid period ends |
| Expired | Paid period over | No |

- **Renewals** (Paystack `charge.success` / `invoice.update`) extend the paid period and add a payment row.
- **Failed renewals** (`invoice.payment_failed`) mark the membership and email the member.
- **Cancellation** from Billing & Membership disables the Paystack subscription; Paystack's `subscription.disable` / `subscription.not_renew` do the same. The member gets one cancellation email.

Each checkout creates one subscription row; history is kept.

@article payment-verification
title: Payment verification
summary: How a payment becomes "Paid" — and why duplicates are safe.
keywords: verification, verify payment, webhook, idempotency, duplicate, fulfilment

A payment is fulfilled only with data from Paystack:

1. **Webhook** — Paystack signs each webhook (HMAC-SHA512 of the body with the secret key). The API rejects any request whose signature doesn't match.
2. **Verify call** — when the customer returns from checkout, the return page asks the API, which calls Paystack's verify endpoint.

Both go through one database function that locks the payment row, checks the amount and currency against what was charged, and marks it paid **once**. Repeated webhooks, a webhook racing the return page, or retries can't grant Plus twice, create a second submission or send a second email. Exact duplicate webhook deliveries are also recorded and skipped.

If the webhook can't reach the server (for example on a local computer), the return page's verify call still completes the payment, and the Plus subscription is linked from the Paystack customer when the member opens Billing.

@article revenue-analytics
title: Revenue analytics
summary: The Revenue dashboard.
keywords: revenue, income, analytics, money, dashboard, earnings

**Revenue** (Monetization) shows, for **Today**, **7 days**, **30 days**, **This month** or a **Custom** range:

- total revenue, Plus revenue and submission revenue
- successful and failed payments
- active Plus members (right now) and new Plus members
- artist submissions paid and pending artist reviews (right now)
- revenue by day

Amounts are shown in the configured currency; payments in other currencies are listed separately. Revenue is gross (before Paystack fees). Only admins can see this data.
