-- ═══════════════════════════════════════════════════════════════════════════
-- SHERE MUSIC — Monetization: SHERE MUSIC Plus, artist submission fees,
-- Paystack payments, Plus offers and download types.
--
-- Run AFTER 002_studio_video_lyrics.sql. Safe to re-run.
--
-- Access model is unchanged: only the backend (service role) reads or writes
-- these tables. RLS is enabled with no policies and anon/authenticated have no
-- grants, so no browser can read another user's payments or change a status,
-- a price or an entitlement. Every per-user check happens in the API.
--
-- Money is stored in the currency's minor unit (kobo for NGN): 60000 = ₦600.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Settings ───────────────────────────────────────────────────────────────
alter table public.site_settings add column if not exists plus_enabled boolean not null default true;
alter table public.site_settings add column if not exists plus_price bigint not null default 60000 check (plus_price >= 100);
alter table public.site_settings add column if not exists plus_benefits jsonb not null default
  '["Download music to your device", "Plus-only offers", "PLUS badge on your account"]'::jsonb;
alter table public.site_settings add column if not exists artist_submission_enabled boolean not null default true;
alter table public.site_settings add column if not exists artist_submission_fee bigint not null default 50000 check (artist_submission_fee >= 100);
alter table public.site_settings add column if not exists payment_currency text not null default 'NGN'
  check (payment_currency in ('NGN', 'USD', 'GHS', 'ZAR', 'KES'));
-- Paystack plan created by the API for the current Plus price (recreated when the price, currency or key mode changes)
alter table public.site_settings add column if not exists paystack_plan_code text;
alter table public.site_settings add column if not exists paystack_plan_amount bigint;
alter table public.site_settings add column if not exists paystack_plan_currency text;
alter table public.site_settings add column if not exists paystack_plan_mode text;

-- ─── Payment transactions (one row per checkout attempt or renewal charge) ──
create table if not exists public.payment_transactions (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid references public.users (id) on delete set null,
  reference               text not null,
  provider                text not null default 'paystack',
  product_type            text not null check (product_type in ('plus_subscription', 'artist_submission')),
  product_id              uuid,             -- plus_subscriptions.id or artist_submissions.id
  amount                  bigint not null check (amount >= 0),
  currency                text not null,
  status                  text not null default 'pending'
                            check (status in ('pending', 'success', 'failed', 'abandoned', 'reversed')),
  paid_at                 timestamptz,
  channel                 text,             -- card, bank, ussd… (never card details)
  gateway_response        text,
  provider_customer_code  text,
  customer_email          text,
  provider_transaction_id bigint,
  is_renewal              boolean not null default false,
  metadata                jsonb not null default '{}'::jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (provider, reference)
);
create index if not exists payment_tx_user_idx on public.payment_transactions (user_id, created_at desc);
create index if not exists payment_tx_status_idx on public.payment_transactions (status, paid_at desc);
create index if not exists payment_tx_product_idx on public.payment_transactions (product_type, product_id);
drop trigger if exists payment_transactions_updated_at on public.payment_transactions;
create trigger payment_transactions_updated_at before update on public.payment_transactions
  for each row execute function public.set_updated_at();

-- ─── Plus subscriptions (history is kept: one row per subscription) ────────
create table if not exists public.plus_subscriptions (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references public.users (id) on delete cascade,
  provider                    text not null default 'paystack',
  provider_customer_code      text,
  provider_subscription_code  text unique,
  provider_plan_code          text,
  provider_email_token        text,        -- needed to cancel through Paystack; never sent to a browser
  status                      text not null default 'pending'
                                check (status in ('pending', 'active', 'non_renewing', 'attention', 'cancelled', 'expired')),
  amount                      bigint not null,
  currency                    text not null,
  interval                    text not null default 'monthly',
  started_at                  timestamptz,
  current_period_start        timestamptz,
  current_period_end          timestamptz,
  next_payment_date           timestamptz,
  cancelled_at                timestamptz,
  cancellation_notified_at    timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create index if not exists plus_subs_user_idx on public.plus_subscriptions (user_id, created_at desc);
create index if not exists plus_subs_customer_idx on public.plus_subscriptions (provider_customer_code);
-- At most one checkout in progress per user (a retry reuses it)
create unique index if not exists plus_subs_one_pending on public.plus_subscriptions (user_id) where status = 'pending';
drop trigger if exists plus_subscriptions_updated_at on public.plus_subscriptions;
create trigger plus_subscriptions_updated_at before update on public.plus_subscriptions
  for each row execute function public.set_updated_at();

-- ─── Artist submissions (paid song submissions) ────────────────────────────
create table if not exists public.artist_submissions (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid references public.users (id) on delete set null,
  artist_id               uuid references public.artists (id) on delete set null,
  song_id                 uuid references public.songs (id) on delete set null,
  song_title              text not null,     -- kept for the payment history if the song is deleted
  artist_name             text,
  payment_transaction_id  uuid references public.payment_transactions (id) on delete set null,
  submission_fee          bigint not null,
  currency                text not null,
  payment_status          text not null default 'payment_pending'
                            check (payment_status in ('payment_pending', 'payment_successful')),
  review_status           text not null default 'not_submitted'
                            check (review_status in ('not_submitted', 'pending_review', 'approved', 'rejected')),
  rejection_reason        text,
  submitted_at            timestamptz,
  reviewed_at             timestamptz,
  reviewed_by             uuid references public.users (id) on delete set null,
  decision_notified_at    timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index if not exists artist_submissions_user_idx on public.artist_submissions (user_id, created_at desc);
create index if not exists artist_submissions_review_idx on public.artist_submissions (review_status, submitted_at);
-- One unpaid submission per song (payment retries reuse it) and one open review per song
create unique index if not exists artist_submissions_one_unpaid on public.artist_submissions (song_id) where payment_status = 'payment_pending';
create unique index if not exists artist_submissions_one_open on public.artist_submissions (song_id) where review_status = 'pending_review';
drop trigger if exists artist_submissions_updated_at on public.artist_submissions;
create trigger artist_submissions_updated_at before update on public.artist_submissions
  for each row execute function public.set_updated_at();

-- ─── Webhook events (de-duplication: the same delivery is processed once) ──
create table if not exists public.payment_events (
  id            bigint generated always as identity primary key,
  provider      text not null default 'paystack',
  event         text not null,
  event_key     text not null unique,        -- sha256 of the raw signed payload
  reference     text,
  payload       jsonb not null,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz
);
create index if not exists payment_events_reference_idx on public.payment_events (reference);

-- ─── Plus offers ────────────────────────────────────────────────────────────
create table if not exists public.plus_offers (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 1 and 120),
  description  text check (description is null or char_length(description) <= 1000),
  image_path   text,
  link_url     text check (link_url is null or char_length(link_url) <= 500),
  link_label   text check (link_label is null or char_length(link_label) <= 40),
  starts_at    timestamptz,
  ends_at      timestamptz,
  is_active    boolean not null default true,
  plus_only    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
drop trigger if exists plus_offers_updated_at on public.plus_offers;
create trigger plus_offers_updated_at before update on public.plus_offers
  for each row execute function public.set_updated_at();

-- ─── Downloads: record what kind of authorised download it was ─────────────
alter table public.downloads add column if not exists download_type text not null default 'legacy'
  check (download_type in ('legacy', 'plus_device_download', 'admin_download', 'artist_download', 'free_download'));

drop function if exists public.record_download(uuid, uuid);
create or replace function public.record_download(p_song_id uuid, p_user_id uuid default null, p_type text default 'plus_device_download')
returns boolean language plpgsql set search_path = public as $$
begin
  update songs set download_count = download_count + 1 where id = p_song_id;
  if not found then return false; end if;
  insert into downloads (song_id, user_id, download_type) values (p_song_id, p_user_id, p_type);
  return true;
end $$;

-- ─── Entitlement ────────────────────────────────────────────────────────────
-- A user has Plus while any subscription's paid period has not ended. A
-- cancelled subscription keeps its benefits until the end of the paid period.
create or replace function public.has_active_plus(p_user_id uuid)
returns boolean language sql stable set search_path = public as $$
  select exists (
    select 1 from plus_subscriptions
    where user_id = p_user_id
      and status in ('active', 'non_renewing', 'attention', 'cancelled')
      and current_period_end > now()
  );
$$;

-- ─── Fulfilment (idempotent) ────────────────────────────────────────────────
-- Called with data the API verified with Paystack (webhook or verify call).
-- Locks the transaction row, so concurrent webhook + verify calls cannot both
-- fulfil it. Returns newlyFulfilled = true exactly once per reference.
create or replace function public.fulfill_payment(
  p_reference text,
  p_amount bigint,
  p_currency text,
  p_paid_at timestamptz,
  p_channel text default null,
  p_customer_code text default null,
  p_customer_email text default null,
  p_transaction_id bigint default null,
  p_gateway_response text default null
) returns jsonb language plpgsql set search_path = public as $$
declare
  tx payment_transactions%rowtype;
  sub plus_subscriptions%rowtype;
  subm artist_submissions%rowtype;
begin
  select * into tx from payment_transactions where provider = 'paystack' and reference = p_reference for update;
  if not found then return jsonb_build_object('found', false); end if;
  if tx.status = 'success' then
    return jsonb_build_object('found', true, 'newlyFulfilled', false, 'productType', tx.product_type, 'transactionId', tx.id, 'userId', tx.user_id);
  end if;

  -- Never fulfil a payment that does not match what we asked for.
  if p_amount < tx.amount or upper(p_currency) <> upper(tx.currency) then
    update payment_transactions
       set status = 'failed', gateway_response = 'Amount or currency mismatch', provider_transaction_id = coalesce(p_transaction_id, provider_transaction_id)
     where id = tx.id;
    return jsonb_build_object('found', true, 'newlyFulfilled', false, 'mismatch', true, 'productType', tx.product_type, 'transactionId', tx.id, 'userId', tx.user_id);
  end if;

  update payment_transactions
     set status = 'success', paid_at = coalesce(p_paid_at, now()), channel = p_channel,
         provider_customer_code = coalesce(p_customer_code, provider_customer_code),
         customer_email = coalesce(p_customer_email, customer_email),
         provider_transaction_id = coalesce(p_transaction_id, provider_transaction_id),
         gateway_response = p_gateway_response
   where id = tx.id;

  if tx.product_type = 'plus_subscription' then
    update plus_subscriptions
       set status = 'active',
           started_at = coalesce(started_at, coalesce(p_paid_at, now())),
           current_period_start = coalesce(p_paid_at, now()),
           current_period_end = greatest(coalesce(current_period_end, now()), coalesce(next_payment_date, coalesce(p_paid_at, now()) + interval '1 month')),
           provider_customer_code = coalesce(p_customer_code, provider_customer_code)
     where id = tx.product_id
     returning * into sub;
    return jsonb_build_object('found', true, 'newlyFulfilled', true, 'productType', tx.product_type, 'transactionId', tx.id,
                              'userId', tx.user_id, 'subscriptionId', sub.id, 'periodEnd', sub.current_period_end);
  end if;

  -- artist_submission: paid → pending review (never published automatically)
  update artist_submissions
     set payment_status = 'payment_successful', review_status = 'pending_review', submitted_at = now(),
         payment_transaction_id = tx.id, rejection_reason = null
   where id = tx.product_id
   returning * into subm;
  if subm.song_id is not null then
    update songs set status = 'pending', submitted_at = now(), rejection_reason = null
     where id = subm.song_id and status in ('draft', 'rejected');
  end if;
  return jsonb_build_object('found', true, 'newlyFulfilled', true, 'productType', tx.product_type, 'transactionId', tx.id,
                            'userId', tx.user_id, 'submissionId', subm.id, 'songId', subm.song_id);
end $$;

-- Recurring Plus charge (Paystack bills the saved card each month). Records the
-- charge once per reference and extends the matching subscription.
create or replace function public.record_plus_renewal(
  p_reference text,
  p_subscription_code text,
  p_customer_code text,
  p_amount bigint,
  p_currency text,
  p_paid_at timestamptz,
  p_period_end timestamptz default null,
  p_channel text default null,
  p_transaction_id bigint default null
) returns jsonb language plpgsql set search_path = public as $$
declare
  sub plus_subscriptions%rowtype;
  new_id uuid;
begin
  select * into sub from plus_subscriptions
   where (p_subscription_code is not null and provider_subscription_code = p_subscription_code)
      or (p_subscription_code is null and p_customer_code is not null and provider_customer_code = p_customer_code
          and status in ('active', 'non_renewing', 'attention'))
   order by created_at desc limit 1
   for update;
  if not found then return jsonb_build_object('found', false); end if;

  insert into payment_transactions (user_id, reference, product_type, product_id, amount, currency, status, paid_at, channel,
                                    provider_customer_code, provider_transaction_id, is_renewal)
  values (sub.user_id, p_reference, 'plus_subscription', sub.id, p_amount, upper(p_currency), 'success', coalesce(p_paid_at, now()),
          p_channel, p_customer_code, p_transaction_id, true)
  on conflict (provider, reference) do nothing
  returning id into new_id;
  if new_id is null then
    return jsonb_build_object('found', true, 'newlyFulfilled', false, 'userId', sub.user_id);
  end if;

  update plus_subscriptions
     set status = case when status = 'attention' then 'active' else status end,
         current_period_start = coalesce(p_paid_at, now()),
         current_period_end = greatest(coalesce(current_period_end, now()), coalesce(p_period_end, coalesce(p_paid_at, now()) + interval '1 month'))
   where id = sub.id;
  return jsonb_build_object('found', true, 'newlyFulfilled', true, 'userId', sub.user_id, 'subscriptionId', sub.id, 'transactionId', new_id);
end $$;

-- Keep paid submissions in step with the song review, whatever path the admin
-- used (Reviews queue, Artist Submissions, song list or song editor).
create or replace function public.sync_submission_review()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status is distinct from old.status and old.status = 'pending' then
    if new.status in ('approved', 'published') then
      update artist_submissions
         set review_status = 'approved', reviewed_at = now(), reviewed_by = new.reviewed_by, rejection_reason = null
       where song_id = new.id and review_status = 'pending_review';
    elsif new.status = 'rejected' then
      update artist_submissions
         set review_status = 'rejected', reviewed_at = now(), reviewed_by = new.reviewed_by, rejection_reason = new.rejection_reason
       where song_id = new.id and review_status = 'pending_review';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists songs_sync_submission on public.songs;
create trigger songs_sync_submission after update of status on public.songs
  for each row execute function public.sync_submission_review();

-- ─── Revenue analytics (admin only; the API checks the role) ───────────────
create or replace function public.monetization_summary(p_from timestamptz, p_to timestamptz)
returns jsonb language sql stable set search_path = public as $$
  with paid as (
    select * from payment_transactions where status = 'success' and paid_at >= p_from and paid_at < p_to
  )
  select jsonb_build_object(
    'revenue', (select coalesce(jsonb_agg(jsonb_build_object('currency', currency, 'total', total, 'plus', plus, 'submissions', subs)), '[]'::jsonb)
                from (select currency, sum(amount) as total,
                             sum(amount) filter (where product_type = 'plus_subscription') as plus,
                             sum(amount) filter (where product_type = 'artist_submission') as subs
                      from paid group by currency) r),
    'successfulPayments', (select count(*) from paid),
    'failedPayments', (select count(*) from payment_transactions
                       where status in ('failed', 'abandoned') and created_at >= p_from and created_at < p_to),
    'activePlusMembers', (select count(distinct user_id) from plus_subscriptions
                          where status in ('active', 'non_renewing', 'attention', 'cancelled') and current_period_end > now()),
    'newPlusMembers', (select count(distinct user_id) from plus_subscriptions where started_at >= p_from and started_at < p_to),
    'submissionsPaid', (select count(*) from paid where product_type = 'artist_submission'),
    'pendingArtistReviews', (select count(*) from artist_submissions where review_status = 'pending_review'),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'plus', d.plus, 'submissions', d.subs) order by d.day), '[]'::jsonb)
              from (select date_trunc('day', paid_at)::date as day,
                           sum(amount) filter (where product_type = 'plus_subscription') as plus,
                           sum(amount) filter (where product_type = 'artist_submission') as subs
                    from paid group by 1) d)
  );
$$;

-- ─── Security ───────────────────────────────────────────────────────────────
alter table public.payment_transactions enable row level security;
alter table public.plus_subscriptions   enable row level security;
alter table public.artist_submissions   enable row level security;
alter table public.payment_events       enable row level security;
alter table public.plus_offers          enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

notify pgrst, 'reload schema';
