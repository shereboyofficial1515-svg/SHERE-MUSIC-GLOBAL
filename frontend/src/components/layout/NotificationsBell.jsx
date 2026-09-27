import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';
import { Spinner } from '../ui/Feedback.jsx';
import { userService } from '../../services/userService.js';
import { useDismiss } from '../../hooks/useDismiss.js';
import { timeAgo } from '../../utils/format.js';

const POLL_MS = 60_000;

/** In-app notifications (new releases, followers, review decisions…). */
export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState(null);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  const load = useCallback(async () => {
    try {
      const res = await userService.notifications();
      setItems(res.data);
      setUnread(res.meta?.unread ?? 0);
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, []);

  // Poll while the tab is visible.
  useEffect(() => {
    load();
    const timer = window.setInterval(() => document.visibilityState === 'visible' && load(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      userService.markNotificationsRead().catch(() => {});
      window.setTimeout(() => setItems((list) => list?.map((n) => ({ ...n, isRead: true }))), 4000);
    }
  };

  return (
    <div className="menu bell" ref={ref}>
      <button type="button" className="icon-btn" onClick={toggle} aria-haspopup="true" aria-expanded={open} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
        <Icon name="bell" size={20} />
        {unread ? <span className="bell__dot">{unread > 9 ? '9+' : unread}</span> : null}
      </button>
      {open ? (
        <div className="menu__list menu__list--right notif-panel" role="dialog" aria-label="Notifications">
          <div className="notif-panel__head">
            <strong>Notifications</strong>
            <Link to="/settings/notifications" className="text-sm" onClick={close}>
              Settings
            </Link>
          </div>
          {error ? (
            <div className="center-pad stack-sm" style={{ justifyItems: 'center' }}>
              <p className="text-muted text-sm">Unable to load notifications.</p>
              <button type="button" className="btn btn--secondary btn--sm" onClick={load}>
                Try again
              </button>
            </div>
          ) : !items ? (
            <div className="center-pad">
              <Spinner />
            </div>
          ) : !items.length ? (
            <p className="text-muted text-sm center-pad">You&apos;re all caught up.</p>
          ) : (
            <ul>
              {items.map((n) => (
                <li key={n.id}>
                  <Link to={n.link || '#'} className={`notif ${n.isRead ? '' : 'notif--unread'}`} onClick={close}>
                    <span style={{ minWidth: 0 }}>
                      <span className="notif__title">{n.title}</span>
                      {n.body ? <span className="notif__body" style={{ display: 'block' }}>{n.body}</span> : null}
                      <span className="notif__body">{timeAgo(n.createdAt)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
