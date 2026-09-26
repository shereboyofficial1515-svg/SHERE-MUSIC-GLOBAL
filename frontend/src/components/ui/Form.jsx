import { useId, useState } from 'react';
import Icon from './Icon.jsx';
import { cx } from '../../utils/format.js';

/** Label + control + hint/error, wired up with aria-describedby. */
export function Field({ label, error, hint, children, required, className }) {
  const id = useId();
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cx('field', error && 'field--invalid', className)}>
      {label ? (
        <label className="field__label" htmlFor={id}>
          {label}
          {required ? <span aria-hidden="true" className="field__required"> *</span> : null}
        </label>
      ) : null}
      {children({ id, 'aria-invalid': Boolean(error) || undefined, 'aria-describedby': describedBy, required })}
      {hint && !error ? (
        <p id={`${id}-hint`} className="field__hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="field__error">
          <Icon name="alert-circle" size={14} /> {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({ label, error, hint, className, required, ...props }) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={className}>
      {(a11y) => <input className="input" {...a11y} {...props} />}
    </Field>
  );
}

export function PasswordField({ label = 'Password', error, hint, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label} error={error} hint={hint} required={props.required}>
      {(a11y) => (
        <div className="input-group">
          <input className="input" type={visible ? 'text' : 'password'} {...a11y} {...props} />
          <button type="button" className="input-group__btn" onClick={() => setVisible((v) => !v)} aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible}>
            <Icon name={visible ? 'eye-off' : 'eye'} size={18} />
          </button>
        </div>
      )}
    </Field>
  );
}

export function TextArea({ label, error, hint, required, ...props }) {
  return (
    <Field label={label} error={error} hint={hint} required={required}>
      {(a11y) => <textarea className="input textarea" {...a11y} {...props} />}
    </Field>
  );
}

export function Select({ label, error, hint, required, children, ...props }) {
  return (
    <Field label={label} error={error} hint={hint} required={required}>
      {(a11y) => (
        <div className="select-wrap">
          <select className="input select" {...a11y} {...props}>
            {children}
          </select>
          <Icon name="chevron-down" size={16} className="select-wrap__icon" />
        </div>
      )}
    </Field>
  );
}

export function Toggle({ label, description, checked, onChange, disabled }) {
  const id = useId();
  return (
    <div className="toggle-row">
      <div>
        <label htmlFor={id} className="toggle-row__label">
          {label}
        </label>
        {description ? <p className="field__hint">{description}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        className={cx('switch', checked && 'switch--on')}
        onClick={() => onChange(!checked)}
        disabled={disabled}
      >
        <span className="switch__thumb" />
        <span className="sr-only">{checked ? 'On' : 'Off'}</span>
      </button>
    </div>
  );
}
