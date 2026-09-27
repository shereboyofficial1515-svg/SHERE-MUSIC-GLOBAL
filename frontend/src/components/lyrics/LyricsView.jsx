import { memo, useEffect, useRef } from 'react';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { gsap, motionOK } from '../../utils/motion.js';
import { cx } from '../../utils/format.js';
import { Spinner } from '../ui/Feedback.jsx';
import Icon from '../ui/Icon.jsx';

gsap.registerPlugin(ScrollToPlugin);

const RESUME_FOLLOW_MS = 3500;

/** Attribution / copyright shown under lyrics (required for provider lyrics). */
export function LyricsCredit({ lyrics }) {
  const parts = [lyrics.attribution, lyrics.copyrightNotice, lyrics.license].filter(Boolean);
  if (!parts.length && lyrics.source !== 'external') return null;
  return <p className="lyrics__credit">{parts.length ? parts.join(' · ') : `Lyrics provided by ${lyrics.provider || 'an external provider'}`}</p>;
}

/**
 * Lyrics that follow the song. The current line eases to the centre (GSAP
 * scrollTo) and scales up slightly; past lines dim, upcoming lines stay
 * readable. Listeners can scroll freely — auto-follow resumes after a moment.
 * Clicking a timed line seeks the song there.
 */
function LyricsView({ lyrics, activeIndex, onSeek, className }) {
  const scrollerRef = useRef(null);
  const lastUserScroll = useRef(0);
  const prevActive = useRef(-1);

  // Note manual scrolling so we don't fight the listener.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;
    const mark = () => {
      lastUserScroll.current = Date.now();
    };
    el.addEventListener('wheel', mark, { passive: true });
    el.addEventListener('touchmove', mark, { passive: true });
    el.addEventListener('keydown', mark);
    return () => {
      el.removeEventListener('wheel', mark);
      el.removeEventListener('touchmove', mark);
      el.removeEventListener('keydown', mark);
    };
  }, [lyrics]);

  // Follow the active line.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !lyrics?.isSynced) return;
    const lines = el.querySelectorAll('[data-line]');
    const current = lines[activeIndex];
    const previous = lines[prevActive.current];
    const animate = motionOK();

    if (previous && previous !== current) gsap.to(previous, { scale: 1, duration: animate ? 0.4 : 0, overwrite: 'auto' });
    if (current) gsap.to(current, { scale: 1.035, duration: animate ? 0.45 : 0, overwrite: 'auto' });
    prevActive.current = activeIndex;

    if (Date.now() - lastUserScroll.current < RESUME_FOLLOW_MS) return;
    const target = current ? current.offsetTop - el.clientHeight / 2 + current.offsetHeight / 2 : 0;
    // Large jumps (seeking) snap quickly; normal progression glides.
    const distance = Math.abs(el.scrollTop - target);
    gsap.to(el, {
      scrollTo: { y: Math.max(0, target), autoKill: false },
      duration: !animate ? 0 : distance > el.clientHeight ? 0.25 : 0.6,
      ease: 'power2.out',
      overwrite: 'auto',
    });
  }, [activeIndex, lyrics]);

  if (!lyrics) return null;

  if (!lyrics.isSynced) {
    return (
      <div ref={scrollerRef} className={cx('lyrics lyrics--free', className)} tabIndex={0} aria-label="Lyrics">
        <p className="text-sm text-muted" style={{ marginBottom: 12 }}>
          <Icon name="info" size={14} /> These lyrics aren&apos;t synced to the music.
        </p>
        <div className="lyrics__plain">{lyrics.lines.map((l) => l.text).join('\n')}</div>
        <LyricsCredit lyrics={lyrics} />
      </div>
    );
  }

  return (
    <div ref={scrollerRef} className={cx('lyrics', className)} style={{ overflowY: 'auto' }} tabIndex={0} aria-label="Synced lyrics">
      <ol className="lyrics__list">
        {lyrics.lines.map((line, i) => {
          const timed = Number.isFinite(line.startTimeMs);
          if (!line.text.trim()) return <li key={i} className="lyric lyric--spacer" data-line aria-hidden="true" />;
          const state = i === activeIndex ? 'is-active' : activeIndex >= 0 && i < activeIndex ? 'is-past' : '';
          return (
            <li key={i} data-line className={cx('lyric', state)} aria-current={i === activeIndex ? 'true' : undefined}>
              {timed && onSeek ? (
                <button type="button" className="lyric__btn" onClick={() => onSeek(line.startTimeMs / 1000)} aria-label={`Play from: ${line.text}`}>
                  {line.text}
                </button>
              ) : (
                line.text
              )}
            </li>
          );
        })}
      </ol>
      <LyricsCredit lyrics={lyrics} />
    </div>
  );
}

export default memo(LyricsView);

export function LyricsState({ loading, error, onRetry, empty }) {
  if (loading) {
    return (
      <div className="lyrics__state">
        <Spinner size={24} label="Loading lyrics" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="lyrics__state" role="alert">
        <p>Unable to load lyrics.</p>
        <button type="button" className="btn btn--secondary btn--sm" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }
  if (empty) {
    return (
      <div className="lyrics__state">
        <Icon name="lyrics" size={28} />
        <p>No lyrics for this song yet.</p>
      </div>
    );
  }
  return null;
}
