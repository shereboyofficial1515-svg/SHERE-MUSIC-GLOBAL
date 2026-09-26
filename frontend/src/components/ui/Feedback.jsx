import Icon from './Icon.jsx';
import { cx } from '../../utils/format.js';

export function Spinner({ size = 20, label = 'Loading', className }) {
  return (
    <span className={cx('spinner', className)} style={{ width: size, height: size }} role="status">
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function PageLoader({ label = 'Loading' }) {
  return (
    <div className="page-loader">
      <Spinner size={32} label={label} />
    </div>
  );
}

export function Skeleton({ width, height = 14, radius, className }) {
  return <span className={cx('skeleton', className)} style={{ width, height, borderRadius: radius }} aria-hidden="true" />;
}

export function EmptyState({ icon = 'music', title, message, action }) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon">
        <Icon name={icon} size={28} />
      </span>
      <h3 className="empty-state__title">{title}</h3>
      {message ? <p className="empty-state__message">{message}</p> : null}
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'Something went wrong' }) {
  const offline = error?.code === 'NETWORK_ERROR';
  return (
    <div className="empty-state empty-state--error" role="alert">
      <span className="empty-state__icon">
        <Icon name={offline ? 'wifi' : 'alert-triangle'} size={28} />
      </span>
      <h3 className="empty-state__title">{offline ? 'You appear to be offline' : title}</h3>
      <p className="empty-state__message">{error?.message || 'Please try again.'}</p>
      {onRetry ? (
        <button type="button" className="btn btn--secondary" onClick={onRetry}>
          <Icon name="refresh" size={16} /> Try again
        </button>
      ) : null}
    </div>
  );
}

export function Alert({ type = 'info', children }) {
  const icon = { info: 'info', error: 'alert-circle', success: 'check-circle', warning: 'alert-triangle' }[type];
  return (
    <div className={`alert alert--${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <Icon name={icon} size={18} />
      <div>{children}</div>
    </div>
  );
}

export function ProgressBar({ value, label }) {
  const indeterminate = value === undefined || value < 0;
  return (
    <div
      className={cx('progress', indeterminate && 'progress--indeterminate')}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : value}
    >
      <span className="progress__bar" style={indeterminate ? undefined : { width: `${value}%` }} />
    </div>
  );
}
