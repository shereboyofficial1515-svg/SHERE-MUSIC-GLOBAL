import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { goToCheckout, paymentService } from '../services/paymentService.js';

/**
 * Start a Plus checkout: the API creates the Paystack transaction (price from
 * the server) and we redirect to Paystack. Plus is activated only after the
 * API verifies the payment — never by this page.
 */
export function usePlusCheckout() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const start = async () => {
    if (!user) {
      navigate('/login', { state: { from: '/plus' } });
      return;
    }
    setBusy(true);
    try {
      const { data } = await paymentService.startPlus();
      goToCheckout(data); // leaves the page
    } catch (err) {
      setBusy(false);
      if (err.code === 'ALREADY_PLUS') {
        await refresh();
        toast.info('You already have SHERE MUSIC Plus.');
      } else {
        toast.error(err.message);
      }
    }
  };

  return { start, busy };
}
