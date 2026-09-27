import { memo, useRef } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';
import { VerifiedBadge } from '../artists/FollowButton.jsx';
import { gsap, motionOK } from '../../utils/motion.js';
import { cx, formatCount, formatDuration, timeAgo } from '../../utils/format.js';

/** Large 16:9 video card with a subtle GSAP hover lift. */
function VideoCard({ video, size = 'md' }) {
  const ref = useRef(null);
  const hover = (on) => {
    if (!motionOK() || !ref.current) return;
    gsap.to(ref.current.querySelector('.vcard__thumb img, .vcard__thumb .vcard__fallback'), { scale: on ? 1.05 : 1, duration: 0.5, ease: 'power3.out' });
    gsap.to(ref.current.querySelector('.vcard__play'), { autoAlpha: on ? 1 : 0, scale: on ? 1 : 0.85, duration: 0.3 });
  };
  return (
    <article ref={ref} className={cx('vcard', `vcard--${size}`)} onPointerEnter={() => hover(true)} onPointerLeave={() => hover(false)}>
      <Link to={`/videos/${video.id}`} className="vcard__thumb" aria-label={`Watch ${video.title} by ${video.artist.name}`} onFocus={() => hover(true)} onBlur={() => hover(false)}>
        {video.thumbnailUrl ? (
          <img src={video.thumbnailUrl} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="vcard__fallback">
            <Icon name="film" size={32} />
          </span>
        )}
        <span className="vcard__play" aria-hidden="true">
          <Icon name="play" size={22} />
        </span>
        {video.duration ? <span className="vcard__duration">{formatDuration(video.duration)}</span> : null}
        {video.subtitleCount ? (
          <span className="vcard__cc" title="Subtitles available">
            <Icon name="captions" size={14} />
          </span>
        ) : null}
      </Link>
      <div className="vcard__body">
        <h3 className="vcard__title">
          <Link to={`/videos/${video.id}`}>{video.title}</Link>
        </h3>
        <p className="vcard__meta">
          <Link to={`/artists/${video.artist.id}`}>{video.artist.name}</Link>
          {video.artist.verified ? <VerifiedBadge size={13} /> : null}
        </p>
        <p className="vcard__meta text-subtle">
          {formatCount(video.viewCount)} views{video.publishedAt ? ` · ${timeAgo(video.publishedAt)}` : ''}
        </p>
      </div>
    </article>
  );
}

export default memo(VideoCard);
