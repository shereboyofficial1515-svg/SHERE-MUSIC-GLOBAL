import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import Icon from '../components/ui/Icon.jsx';

const ToastContext = createContext(null);

const ICONS = { success: 'check-circle', error: 'alert-circle', info: 'info', warning: 'alert-triangle' };
const LABELS = { success: 'Success', error: 'Error', info: 'Notice', warning: 'Warning' };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (type, message, { duration = type === 'error' ? 6000 : 3500 } = {}) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-3), { id, type, message }]);
      if (duration) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  const toast = useMemo(
    () => ({
      success: (m, o) => show('success', m, o),
      error: (m, o) => show('error', m, o),
      info: (m, o) => show('info', m, o),
      warning: (m, o) => show('warning', m, o),
      dismiss,
    }),
    [show, dismiss]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-region" role="region" aria-label="Notifications">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.type}`} role={t.type === 'error' ? 'alert' : 'status'} aria-live={t.type === 'error' ? 'assertive' : 'polite'}>
            <Icon name={ICONS[t.type]} size={20} className="toast__icon" />
            <span className="sr-only">{LABELS[t.type]}: </span>
            <p className="toast__message">{t.message}</p>
            <button type="button" className="icon-btn icon-btn--sm" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
              <Icon name="x" size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
