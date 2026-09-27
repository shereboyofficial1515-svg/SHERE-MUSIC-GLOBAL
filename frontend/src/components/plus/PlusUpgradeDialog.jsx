import { useRef } from 'react';
import Dialog from '../ui/Dialog.jsx';
import Icon from '../ui/Icon.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { usePlusCheckout } from '../../hooks/usePlusCheckout.js';
import { formatMoney } from '../../utils/format.js';
import { gsap, motionOK, useGSAP } from '../../utils/motion.js';

const HEADLINES = {
  download: 'SHERE MUSIC Plus is required to download music to your device.',
  offer: 'This offer is for SHERE MUSIC Plus members.',
  plus: 'Unlock more from your music.',
};

/**
 * Upgrade prompt. The benefits listed come from the server's Plus settings,
 * which only describe features that are actually enabled.
 */
export default function PlusUpgradeDialog({ reason = 'plus', onClose }) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { start, busy } = usePlusCheckout();
  const ref = useRef(null);
  const m = settings.monetization;
  const price = formatMoney(m?.plus?.price ?? 60000, m?.currency || 'NGN');
  const benefits = m?.plus?.benefits?.length ? m.plus.benefits : ['Download music to your device'];

  useGSAP(
    () => {
      if (!motionOK()) return;
      gsap.from('.plus-dialog__hero', { autoAlpha: 0, y: 10, duration: 0.4 });
      gsap.from('.plus-dialog__benefits li', { autoAlpha: 0, x: -8, stagger: 0.06, delay: 0.12, duration: 0.35, clearProps: 'transform' });
    },
    { scope: ref }
  );

  const available = m?.plus?.enabled !== false;

  return (
    <Dialog
      title="SHERE MUSIC PLUS"
      onClose={onClose}
      size="sm"
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Maybe later
          </button>
          {available ? (
            <button type="button" className="btn btn--primary" onClick={start} disabled={busy} autoFocus>
              {busy ? 'Opening checkout…' : user ? `Get Plus — ${price}/month` : 'Sign in to get Plus'}
            </button>
          ) : null}
        </>
      }
    >
      <div ref={ref} className="plus-dialog">
        <div className="plus-dialog__hero">
          <span className="plus-dialog__icon" aria-hidden="true">
            <Icon name="sparkles" size={22} />
          </span>
          <p className="plus-dialog__headline">{HEADLINES[reason] || HEADLINES.plus}</p>
          <p className="plus-dialog__price">
            <strong>{price}</strong> / month
          </p>
        </div>
        {available ? (
          <ul className="plus-dialog__benefits">
            {benefits.map((b) => (
              <li key={b}>
                <Icon name="check" size={16} /> {b}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">SHERE MUSIC Plus is not available right now. Please check back later.</p>
        )}
        <p className="text-sm text-muted">Billed monthly through Paystack. Cancel any time in Settings → Billing &amp; Membership.</p>
      </div>
    </Dialog>
  );
}
