import { useRef } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import { Alert } from '../../components/ui/Feedback.jsx';
import { PlusBadge } from '../../components/plus/PlusBadge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePlus } from '../../context/PlusContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { usePlusCheckout } from '../../hooks/usePlusCheckout.js';
import { paymentService } from '../../services/paymentService.js';
import { cx, formatDate, formatMoney } from '../../utils/format.js';
import { motionOK, revealChildren, useGSAP } from '../../utils/motion.js';

function OfferCard({ offer }) {
  const { openUpgrade } = usePlus();
  const external = offer.linkUrl && /^https?:/i.test(offer.linkUrl);
  return (
    <article className={cx('offer-card', offer.locked && 'offer-card--locked')}>
      <div className="offer-card__media">{offer.imageUrl ? <img src={offer.imageUrl} alt="" loading="lazy" /> : <Icon name="gift" size={32} />}</div>
      <div className="offer-card__body">
        <div className="row-gap">
          <h3 className="panel__title" style={{ margin: 0 }}>
            {offer.title}
          </h3>
          {offer.plusOnly ? <PlusBadge /> : null}
        </div>
        {offer.description ? <p className="text-muted text-sm">{offer.description}</p> : null}
        {offer.endsAt ? <p className="text-sm text-muted">Ends {formatDate(offer.endsAt)}</p> : null}
        {offer.locked ? (
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => openUpgrade('offer')}>
            <Icon name="lock" size={14} /> Plus members only
          </button>
        ) : offer.linkUrl ? (
          external ? (
            <a href={offer.linkUrl} className="btn btn--primary btn--sm" target="_blank" rel="noopener noreferrer">
              {offer.linkLabel || 'Open offer'} <Icon name="external-link" size={14} />
            </a>
          ) : (
            <Link to={offer.linkUrl} className="btn btn--primary btn--sm">
              {offer.linkLabel || 'Open offer'}
            </Link>
          )
        ) : null}
      </div>
    </article>
  );
}

/** SHERE MUSIC Plus: price and benefits from the server, checkout through Paystack. */
export default function PlusPage() {
  useMeta({ title: 'SHERE MUSIC Plus', description: 'Download music to your device with SHERE MUSIC Plus.' });
  const { user } = useAuth();
  const { isPlus, plusEnabled, plus, currency } = usePlus();
  const { start, busy } = usePlusCheckout();
  const offers = useAsync(() => paymentService.offers(), [user?.id, isPlus]);
  const ref = useRef(null);

  useGSAP(
    () => {
      if (motionOK()) revealChildren(ref.current.querySelectorAll('[data-reveal]'), { stagger: 0.08 });
    },
    { scope: ref }
  );

  const price = formatMoney(plus?.price ?? 60000, currency);
  const benefits = plus?.benefits || [];

  return (
    <div className="container page stack-lg" ref={ref}>
      <section className="plus-hero">
        <div data-reveal>
          <span className="plus-hero__eyebrow">
            <Icon name="sparkles" size={16} /> SHERE MUSIC PLUS
          </span>
          <h1 className="plus-hero__title">Unlock more from your music.</h1>
          <p className="text-muted" style={{ maxWidth: 520 }}>
            Streaming, lyrics, playlists and music videos stay free for everyone. Plus adds device downloads and member offers, for {price} a month.
          </p>
        </div>

        <div className="plus-card" data-reveal>
          {isPlus ? (
            <>
              <div className="row-gap">
                <PlusBadge />
                <strong>You're a Plus member</strong>
              </div>
              <p className="text-muted">
                {user?.plus?.currentPeriodEnd ? `Your benefits are active until ${formatDate(user.plus.currentPeriodEnd)}.` : 'Your benefits are active.'}
              </p>
              <Link to="/settings/billing" className="btn btn--secondary btn--block">
                <Icon name="credit-card" size={16} /> Billing &amp; Membership
              </Link>
            </>
          ) : (
            <>
              <p className="plus-card__price">
                <strong>{price}</strong> / month
              </p>
              <ul className="plus-benefits">
                {benefits.map((b) => (
                  <li key={b}>
                    <Icon name="check" size={16} /> {b}
                  </li>
                ))}
              </ul>
              {plusEnabled ? (
                <button type="button" className="btn btn--primary btn--lg btn--block" onClick={start} disabled={busy}>
                  {busy ? 'Opening secure checkout…' : user ? 'Get SHERE MUSIC PLUS' : 'Sign in to get Plus'}
                </button>
              ) : (
                <Alert type="info">SHERE MUSIC Plus is not available right now.</Alert>
              )}
              <p className="plus-note">
                <Icon name="lock" size={14} /> Secure payment by Paystack. Renews monthly; cancel any time.
              </p>
            </>
          )}
        </div>
      </section>

      <section className="stack" data-reveal>
        <h2 className="section__title">How downloads work</h2>
        <p className="plus-note">
          <Icon name="download" size={14} /> Plus members can download the original audio file of published songs to their device. Your browser saves it to its downloads folder.
        </p>
        <p className="plus-note">
          <Icon name="info" size={14} /> Offline listening inside the SHERE MUSIC web app is not available yet — downloaded files play in your device's own music player.
        </p>
      </section>

      {offers.data?.length ? (
        <section className="stack" data-reveal>
          <h2 className="section__title">Plus offers</h2>
          <div className="offer-grid">
            {offers.data.map((o) => (
              <OfferCard key={o.id} offer={o} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
