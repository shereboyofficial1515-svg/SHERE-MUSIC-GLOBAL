import { cx } from '../../utils/format.js';

/** Subtle membership / role markers. */
export function PlusBadge({ className, title = 'SHERE MUSIC Plus member' }) {
  return (
    <span className={cx('tag-badge tag-badge--plus', className)} title={title}>
      PLUS
    </span>
  );
}

export function ArtistBadge({ className }) {
  return (
    <span className={cx('tag-badge tag-badge--artist', className)} title="SHERE MUSIC artist">
      ARTIST
    </span>
  );
}
