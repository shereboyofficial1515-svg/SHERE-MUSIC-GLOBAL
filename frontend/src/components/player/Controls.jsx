import { memo, useRef, useState } from 'react';
import Icon from '../ui/Icon.jsx';
import { Spinner } from '../ui/Feedback.jsx';
import { usePlayer, usePlayerProgress } from '../../context/PlayerContext.jsx';
import { gsap, motionOK, useGSAP } from '../../utils/motion.js';
import { cx, formatDuration } from '../../utils/format.js';

/** Seek slider: a native range input, so keyboard and screen readers work. */
export const SeekBar = memo(function SeekBar({ compact = false, className }) {
  const { seek, current } = usePlayer();
  const { currentTime, duration, buffered } = usePlayerProgress();
  const [dragValue, setDragValue] = useState(null);
  const total = duration || current?.duration || 0;
  const value = dragValue ?? currentTime;
  const pct = total ? (value / total) * 100 : 0;
  const bufferedPct = total ? Math.min(100, (buffered / total) * 100) : 0;
  const commit = () => {
    if (dragValue !== null) seek(dragValue);
    setDragValue(null);
  };

  const input = (
    <input
      type="range"
      className="range range--seek"
      min={0}
      max={total || 1}
      step="any"
      value={Math.min(value, total || 1)}
      onChange={(e) => setDragValue(Number(e.target.value))}
      onPointerUp={commit}
      onKeyUp={commit}
      onBlur={() => setDragValue(null)}
      aria-label="Seek"
      aria-valuetext={`${formatDuration(value)} of ${formatDuration(total)}`}
      disabled={!current}
      style={{ '--pct': `${pct}%`, '--buf': `${bufferedPct}%` }}
    />
  );
  if (compact) return <div className={cx('seek seek--compact', className)}>{input}</div>;
  return (
    <div className={cx('seek', className)}>
      <span className="seek__time">{formatDuration(value)}</span>
      {input}
      <span className="seek__time">{formatDuration(total)}</span>
    </div>
  );
});

export function VolumeControl() {
  const { volume, muted, setVolume, toggleMute } = usePlayer();
  const effective = muted ? 0 : volume;
  const icon = effective === 0 ? 'volume-x' : effective < 0.5 ? 'volume-low' : 'volume';
  return (
    <div className="volume">
      <button type="button" className="icon-btn" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} aria-pressed={muted}>
        <Icon name={icon} size={20} />
      </button>
      <input
        type="range"
        className="range"
        min={0}
        max={1}
        step={0.01}
        value={effective}
        onChange={(e) => setVolume(Number(e.target.value))}
        aria-label="Volume"
        aria-valuetext={`${Math.round(effective * 100)}%`}
        style={{ '--pct': `${effective * 100}%` }}
      />
    </div>
  );
}

export function PlayPauseButton({ size = 22, className }) {
  const { isPlaying, isLoading, toggle, current } = usePlayer();
  return (
    <button type="button" className={cx('transport__play', className)} onClick={toggle} aria-label={isPlaying ? 'Pause' : 'Play'} disabled={!current}>
      {isLoading && isPlaying ? <Spinner size={size - 4} label="Buffering" /> : <Icon name={isPlaying ? 'pause' : 'play'} size={size} />}
    </button>
  );
}

export function Transport({ large = false, withModes = false }) {
  const { next, previous, hasNext, current, shuffle, repeat, toggleShuffle, cycleRepeat } = usePlayer();
  const size = large ? 30 : 22;
  const repeatLabel = { off: 'Repeat off', all: 'Repeat all', one: 'Repeat one' }[repeat];
  return (
    <div className={cx('transport', large && 'transport--large')}>
      {withModes ? (
        <button type="button" className={cx('icon-btn', shuffle && 'is-on')} onClick={toggleShuffle} aria-pressed={shuffle} aria-label={shuffle ? 'Shuffle on' : 'Shuffle off'} title="Shuffle">
          <Icon name="shuffle" size={large ? 22 : 18} />
        </button>
      ) : null}
      <button type="button" className="icon-btn" onClick={previous} aria-label="Previous song" disabled={!current}>
        <Icon name="skip-back" size={size - 6} />
      </button>
      <PlayPauseButton size={size} />
      <button type="button" className="icon-btn" onClick={next} aria-label="Next song" disabled={!current || (!hasNext && !current)}>
        <Icon name="skip-forward" size={size - 6} />
      </button>
      {withModes ? (
        <button type="button" className={cx('icon-btn', repeat !== 'off' && 'is-on')} onClick={cycleRepeat} aria-label={repeatLabel} title={repeatLabel} style={{ position: 'relative' }}>
          <Icon name="repeat" size={large ? 22 : 18} />
          {repeat === 'one' ? <span className="repeat-badge" aria-hidden="true">1</span> : null}
        </button>
      ) : null}
    </div>
  );
}

/**
 * Ambient visualiser. It reacts to play/pause (it does not analyse the audio,
 * which would require re-routing playback through Web Audio). Turned off by
 * reduced motion.
 */
export function Visualizer({ bars = 24 }) {
  const { isPlaying } = usePlayer();
  const ref = useRef(null);
  useGSAP(
    () => {
      const spans = ref.current?.querySelectorAll('span');
      if (!spans?.length) return;
      if (!isPlaying || !motionOK()) {
        gsap.to(spans, { scaleY: 0.18, duration: 0.4, overwrite: true });
        return;
      }
      spans.forEach((span, i) => {
        gsap.to(span, {
          scaleY: () => 0.25 + Math.random() * 0.75,
          duration: () => 0.28 + Math.random() * 0.3,
          repeat: -1,
          yoyo: true,
          repeatRefresh: true,
          ease: 'sine.inOut',
          delay: (i % 6) * 0.04,
          overwrite: true,
        });
      });
    },
    { dependencies: [isPlaying], scope: ref }
  );
  return (
    <div className="viz" ref={ref} aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => (
        <span key={i} />
      ))}
    </div>
  );
}
