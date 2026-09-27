import { useEffect, useId, useRef, useState } from 'react';
import Icon from '../ui/Icon.jsx';
import { cx, formatBytes, formatNumber } from '../../utils/format.js';

export function AdminHeader({ title, description, actions }) {
  return (
    <header className="admin-header">
      <div>
        <h1 className="admin-header__title">{title}</h1>
        {description ? <p className="text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="row-gap wrap">{actions}</div> : null}
    </header>
  );
}

export function StatCard({ label, value, icon, hint, tone = 'sky' }) {
  return (
    <div className={`stat-card stat-card--${tone}`}>
      <span className="stat-card__icon">
        <Icon name={icon} size={20} />
      </span>
      <div>
        <p className="stat-card__label">{label}</p>
        <p className="stat-card__value">{value === undefined ? '—' : typeof value === 'string' ? value : formatNumber(value)}</p>
        {hint ? <p className="stat-card__hint">{hint}</p> : null}
      </div>
    </div>
  );
}

/**
 * Lightweight SVG column chart (no chart library). Each series is drawn as
 * grouped bars; values are also exposed in a visually hidden table for screen readers.
 */
export function BarChart({ data, series, height = 220, labelKey = 'day', formatLabel = (v) => v }) {
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0)));
  const groupWidth = 100 / Math.max(1, data.length);
  const barWidth = (groupWidth * 0.72) / series.length;
  const step = Math.max(1, Math.ceil(data.length / 8));
  const ticks = [max, Math.round(max / 2), 0];

  return (
    <figure className="chart">
      <div className="chart__legend">
        {series.map((s) => (
          <span key={s.key} className="chart__legend-item">
            <span className="chart__swatch" style={{ background: s.color }} aria-hidden="true" />
            {s.label}
          </span>
        ))}
      </div>
      <div className="chart__plot" style={{ height }}>
        <div className="chart__ticks" aria-hidden="true">
          {ticks.map((t, i) => (
            <span key={i}>{formatNumber(t)}</span>
          ))}
        </div>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="chart__svg" aria-hidden="true">
          {[0, 50, 100].map((y) => (
            <line key={y} x1="0" x2="100" y1={y} y2={y} className="chart__grid" vectorEffect="non-scaling-stroke" />
          ))}
          {data.map((d, i) =>
            series.map((s, j) => {
              const v = Number(d[s.key]) || 0;
              const h = (v / max) * 100;
              return (
                <rect key={`${i}-${s.key}`} x={i * groupWidth + groupWidth * 0.14 + j * barWidth} y={100 - h} width={barWidth * 0.9} height={h} fill={s.color}>
                  <title>{`${formatLabel(d[labelKey])} — ${s.label}: ${v}`}</title>
                </rect>
              );
            })
          )}
        </svg>
      </div>
      <div className="chart__labels" aria-hidden="true">
        {data.map((d, i) => (
          <span key={i} style={{ width: `${groupWidth}%` }}>
            {i % step === 0 ? formatLabel(d[labelKey]) : ''}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Activity by day</caption>
        <thead>
          <tr>
            <th>Date</th>
            {series.map((s) => (
              <th key={s.key}>{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={i}>
              <td>{formatLabel(d[labelKey])}</td>
              {series.map((s) => (
                <td key={s.key}>{d[s.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function Pagination({ meta, onPage }) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <button type="button" className="btn btn--ghost btn--sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>
        <Icon name="chevron-left" size={16} /> Previous
      </button>
      <span className="text-muted text-sm">
        Page {meta.page} of {meta.totalPages} · {formatNumber(meta.total)} total
      </span>
      <button type="button" className="btn btn--ghost btn--sm" disabled={!meta.hasMore} onClick={() => onPage(meta.page + 1)}>
        Next <Icon name="chevron-right" size={16} />
      </button>
    </nav>
  );
}

export function StatusBadge({ published }) {
  return (
    <span className={cx('badge', published ? 'badge--success' : 'badge--muted')}>
      <Icon name={published ? 'eye' : 'eye-off'} size={12} />
      {published ? 'Published' : 'Draft'}
    </span>
  );
}

/** Image picker with preview, validation message and remove option. */
export function ImagePicker({ label, currentUrl, file, onChange, onRemove, removed, error, hint, round = false }) {
  const id = useId();
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const shown = preview || (!removed ? currentUrl : null);

  return (
    <div className={cx('field', error && 'field--invalid')}>
      <span className="field__label" id={`${id}-label`}>
        {label}
      </span>
      <div className="image-picker">
        <div className={cx('image-picker__preview', round && 'image-picker__preview--round')}>{shown ? <img src={shown} alt="" /> : <Icon name="image" size={28} />}</div>
        <div className="stack-sm">
          <div className="row-gap wrap">
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => inputRef.current?.click()} aria-describedby={`${id}-label`}>
              <Icon name="upload" size={16} /> {shown ? 'Replace' : 'Choose image'}
            </button>
            {shown && onRemove ? (
              <button type="button" className="btn btn--ghost btn--sm" onClick={onRemove}>
                Remove
              </button>
            ) : null}
          </div>
          {file ? (
            <span className="text-sm text-muted">
              {file.name} · {formatBytes(file.size)}
            </span>
          ) : null}
          {error ? (
            <p className="field__error">
              <Icon name="alert-circle" size={14} /> {error}
            </p>
          ) : hint ? (
            <p className="field__hint">{hint}</p>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => {
            onChange(e.target.files[0] || null);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }) {
  return (
    <div className="search-box search-box--inline">
      <Icon name="search" size={16} className="search-box__icon" />
      <input type="search" className="search-box__input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </div>
  );
}
