import { memo, useState } from 'react';
import Icon from './Icon.jsx';
import { cx } from '../../utils/format.js';

/** Square (or round) image container with lazy loading and a branded fallback. */
function Artwork({ src, alt, size, rounded = false, className, icon = 'music', eager = false }) {
  const [failed, setFailed] = useState(false);
  const style = size ? { width: size, height: size } : undefined;
  return (
    <div className={cx('artwork', rounded && 'artwork--round', className)} style={style}>
      {src && !failed ? (
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailed(true)}
          draggable="false"
        />
      ) : (
        <span className="artwork__fallback" role="img" aria-label={alt}>
          <Icon name={icon} size={size ? Math.max(16, Math.round(size / 3)) : 32} />
        </span>
      )}
    </div>
  );
}

export default memo(Artwork);
