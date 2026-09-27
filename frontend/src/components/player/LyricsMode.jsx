import { useCallback, useEffect, useRef } from 'react';
import Icon from '../ui/Icon.jsx';
import Artwork from '../ui/Artwork.jsx';
import LyricsView, { LyricsState } from '../lyrics/LyricsView.jsx';
import { SeekBar, Transport } from './Controls.jsx';
import { usePlayer } from '../../context/PlayerContext.jsx';
import { useScrollLock } from '../../hooks/useScrollLock.js';
import { useArtworkColors } from '../../utils/artworkColors.js';
import { gsap, motionOK, useGSAP } from '../../utils/motion.js';
import { useLyricsForCurrent } from './ExpandedPlayer.jsx';

/**
 * Immersive lyrics: the words take centre stage over a blurred, artwork-tinted
 * background. Leaving the mode never stops the music.
 */
export default function LyricsMode({ onExit }) {
  const { current } = usePlayer();
  const colors = useArtworkColors(current.artworkUrl);
  const lyrics = useLyricsForCurrent(true);
  const rootRef = useRef(null);
  useScrollLock(true);

  useGSAP(
    () => {
      if (!motionOK()) return;
      gsap.from(rootRef.current, { autoAlpha: 0, duration: 0.4 });
      gsap.from('.lm__body', { y: 30, autoAlpha: 0, duration: 0.6, delay: 0.1 });
    },
    { scope: rootRef }
  );

  const exit = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (!motionOK()) return onExit();
    gsap.to(rootRef.current, { autoAlpha: 0, duration: 0.25, onComplete: onExit });
    return undefined;
  }, [onExit]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !document.fullscreenElement && exit();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [exit]);

  return (
    <div
      ref={rootRef}
      className="lm force-dark"
      role="dialog"
      aria-modal="true"
      aria-label={`Lyrics: ${current.title}`}
      style={colors ? { '--c1': colors.primary, '--c2': colors.secondary } : undefined}
    >
      <div className="lm__bg" aria-hidden="true" />
      {current.artworkUrl ? <div className="lm__art-bg" style={{ backgroundImage: `url("${current.artworkUrl}")` }} aria-hidden="true" /> : null}
      <header className="lm__header">
        <div className="lm__song">
          <Artwork src={current.artworkUrl} alt="" size={48} />
          <div style={{ minWidth: 0 }}>
            <strong>{current.title}</strong>
            <span className="text-sm text-muted">{current.artist.name}</span>
          </div>
        </div>
        <button type="button" className="btn btn--secondary btn--sm" onClick={exit} autoFocus>
          <Icon name="x" size={16} /> Exit lyrics mode
        </button>
      </header>
      <div className="lm__body">
        {lyrics.lyrics ? (
          <LyricsView lyrics={lyrics.lyrics} activeIndex={lyrics.activeIndex} onSeek={lyrics.seek} />
        ) : (
          <LyricsState loading={lyrics.loading} error={lyrics.error} onRetry={lyrics.retry} empty />
        )}
      </div>
      <footer className="lm__footer">
        <SeekBar />
        <Transport withModes />
      </footer>
    </div>
  );
}
