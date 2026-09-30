import { useCallback, useEffect, useRef } from 'react';
import Icon from '../ui/Icon.jsx';
import Artwork from '../ui/Artwork.jsx';
import { FavoriteButton, NowPlayingBars } from '../music/SongActions.jsx';
import { PlayPauseButton, SeekBar, Transport, VolumeControl } from './Controls.jsx';
import ExpandedPlayer from './ExpandedPlayer.jsx';
import LyricsMode from './LyricsMode.jsx';
import { usePlayer } from '../../context/PlayerContext.jsx';
import { usePreferences } from '../../context/PreferencesContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { gsap, motionOK, useGSAP } from '../../utils/motion.js';

// Swipe-to-dismiss tuning (px, px/ms).
const START_SLOP = 10; // movement before we decide horizontal vs vertical
const DISMISS_DISTANCE = 80;
const DISMISS_VELOCITY = 0.5;

// Entrance tweens start from an invisible state; if animation frames are throttled
// (background tab, hidden pane) jump to the end so the control is never left hidden.
function settle(tween, ms = 800) {
  setTimeout(() => {
    if (tween.progress() < 1) tween.progress(1);
  }, ms);
}

/**
 * Horizontal swipe on the mini bar. Swiping left past a distance or velocity
 * threshold dismisses it; anything else springs back. Vertical movement is left
 * to the browser (touch-action: pan-y), taps never count as swipes, and drags
 * that start on the seek bar are ignored. Only the bar's visibility changes —
 * the audio keeps playing.
 */
function useSwipeToDismiss(ref, onDismiss) {
  const gesture = useRef(null);
  const suppressClickUntil = useRef(0);

  const reset = useCallback(
    (animate = true) => {
      const el = ref.current;
      if (!el) return;
      el.classList.remove('mini--dragging');
      const home = { x: 0, opacity: 1, scale: 1 };
      if (!animate || !motionOK()) return gsap.set(el, home);
      const tween = gsap.to(el, { ...home, duration: 0.45, ease: 'back.out(1.6)' });
      // Never leave the bar stranded half-way if animation frames are throttled.
      setTimeout(() => {
        if (tween.progress() < 1) {
          tween.kill();
          gsap.set(el, home);
        }
      }, 700);
    },
    [ref]
  );

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' || !e.isPrimary) return; // desktop uses the hide button
    if (e.target.closest('.seek, input[type="range"]')) return; // let the seek bar work
    gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, dx: 0, dragging: false, lastX: e.clientX, lastT: e.timeStamp, vx: 0 };
  };

  const onPointerMove = (e) => {
    const g = gesture.current;
    const el = ref.current;
    if (!g || e.pointerId !== g.id || !el) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (!g.dragging) {
      if (Math.abs(dx) < START_SLOP && Math.abs(dy) < START_SLOP) return;
      // Vertical first: this is a page scroll, not a swipe.
      if (Math.abs(dy) >= Math.abs(dx)) {
        gesture.current = null;
        return;
      }
      g.dragging = true;
      el.classList.add('mini--dragging');
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* not supported */
      }
    }
    const dt = Math.max(1, e.timeStamp - g.lastT);
    g.vx = (e.clientX - g.lastX) / dt;
    g.lastX = e.clientX;
    g.lastT = e.timeStamp;
    // Follow the finger to the left; resist to the right (nothing to reveal there).
    g.dx = dx < 0 ? dx : dx * 0.25;
    const progress = Math.min(1, Math.abs(g.dx) / el.offsetWidth);
    gsap.set(el, { x: g.dx, opacity: 1 - progress * 0.5, scale: 1 - progress * 0.04 });
  };

  const onPointerEnd = (e) => {
    const g = gesture.current;
    const el = ref.current;
    gesture.current = null;
    if (!g || e.pointerId !== g.id || !g.dragging || !el) return;
    // A click right after a drag isn't a tap. Only for a moment: many touch
    // browsers never send that click, and the next real tap must still work.
    suppressClickUntil.current = performance.now() + 350;
    const dismiss = e.type !== 'pointercancel' && (g.dx <= -DISMISS_DISTANCE || (g.dx < -START_SLOP && g.vx <= -DISMISS_VELOCITY));
    if (!dismiss) return reset();
    el.classList.remove('mini--dragging');
    if (!motionOK()) return onDismiss();
    const duration = Math.max(0.16, Math.min(0.35, (el.offsetWidth + g.dx) / 1600));
    gsap.to(el, { x: -(el.offsetWidth + 40), opacity: 0, duration, ease: 'power2.in', onComplete: once(onDismiss) });
  };

  // Hiding must not depend on the tween finishing (animation frames can be throttled).
  const once = (fn) => {
    let done = false;
    const run = () => {
      if (!done) {
        done = true;
        fn();
      }
    };
    setTimeout(run, 450);
    return run;
  };

  // Capture phase: swallow the click generated at the end of a drag.
  const onClickCapture = (e) => {
    if (performance.now() > suppressClickUntil.current) return;
    suppressClickUntil.current = 0;
    e.preventDefault();
    e.stopPropagation();
  };

  return { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd, onClickCapture };
}

/** Small access point shown while the mini bar is hidden. Playback is untouched. */
function MiniRestore({ current, isPlaying, onRestore }) {
  const ref = useRef(null);
  useGSAP(() => {
    if (motionOK()) settle(gsap.from(ref.current, { x: -24, opacity: 0, scale: 0.9, duration: 0.35, ease: 'back.out(1.7)' }));
  });
  return (
    <button ref={ref} type="button" className="mini-restore" onClick={onRestore} aria-label="Show mini player" title={`${current.title} — ${current.artist.name}`}>
      <Artwork src={current.artworkUrl} alt="" size={32} className="mini-restore__art" />
      {isPlaying ? <NowPlayingBars /> : <Icon name="music" size={16} />}
      <Icon name="chevron-up" size={16} />
    </button>
  );
}

/**
 * Persistent player. The mini bar is a view of the global player state (one
 * audio element, owned by PlayerContext); the expanded view and lyrics mode are
 * overlays on top of it, so switching modes — or hiding the bar — never
 * touches the audio.
 */
export default function Player() {
  const { current, error, next, view, setView, setPanel, isPlaying, miniHidden, setMiniHidden } = usePlayer();
  const { prefs } = usePreferences();
  const { settings } = useSettings();
  const barRef = useRef(null);
  const returnTo = useRef('mini');
  const restored = useRef(false);

  const hide = useCallback(() => setMiniHidden(true), [setMiniHidden]);
  const swipe = useSwipeToDismiss(barRef, hide);

  // Entrance: slide up when music starts, slide in from the left when restored.
  useGSAP(
    () => {
      if (!current || miniHidden || !barRef.current || !motionOK()) return;
      if (restored.current) settle(gsap.from(barRef.current, { x: -60, opacity: 0, duration: 0.4, ease: 'back.out(1.4)' }));
      else settle(gsap.from(barRef.current, { yPercent: 110, duration: 0.5, ease: 'power3.out' }));
      restored.current = false;
    },
    { dependencies: [Boolean(current), miniHidden] }
  );

  // "Persistent lyrics": listeners who prefer lyrics get the lyrics tab by default.
  useEffect(() => {
    if (prefs.lyricsAutoOpen) setPanel('lyrics');
  }, [prefs.lyricsAutoOpen, current?.id, setPanel]);

  const openExpanded = useCallback(
    (panel) => {
      if (panel) setPanel(panel);
      setView('expanded');
    },
    [setPanel, setView]
  );
  const openLyricsMode = useCallback(() => {
    returnTo.current = view === 'lyrics' ? 'mini' : view;
    setView('lyrics');
  }, [view, setView]);

  const restore = useCallback(() => {
    restored.current = true;
    setMiniHidden(false);
  }, [setMiniHidden]);

  // Button alternative to the gesture (desktop, keyboard, switch access).
  const hideWithAnimation = useCallback(() => {
    const el = barRef.current;
    if (!el || !motionOK()) return hide();
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        hide();
      }
    };
    gsap.to(el, { yPercent: 110, opacity: 0, duration: 0.25, ease: 'power2.in', onComplete: finish });
    setTimeout(finish, 400); // don't depend on the tween finishing
  }, [hide]);

  if (!current) return null;
  const lyricsOn = settings.lyricsEnabled !== false;

  return (
    <>
      {miniHidden ? (
        <MiniRestore current={current} isPlaying={isPlaying} onRestore={restore} />
      ) : (
        <div className="mini" ref={barRef} role="region" aria-label="Music player" {...swipe}>
          <SeekBar compact className="mini__progress" />
          <div className="mini__inner">
            <button type="button" className="mini__track" onClick={() => openExpanded()} aria-label={`Open player: ${current.title} by ${current.artist.name}`}>
              <Artwork src={current.artworkUrl} alt="" size={50} className="mini__art" />
              <span className="mini__text">
                <span className="mini__title">{current.title}</span>
                <span className="mini__artist">{error ? <span className="text-danger">{error}</span> : current.artist.name}</span>
              </span>
            </button>

            <div className="mini__center hide-sm">
              <Transport withModes />
              <SeekBar />
            </div>

            <div className="mini__right">
              <FavoriteButton song={current} className="hide-xs" />
              {lyricsOn ? (
                <button type="button" className="icon-btn hide-sm" onClick={openLyricsMode} aria-label="Lyrics mode" title="Lyrics">
                  <Icon name="lyrics" size={20} />
                </button>
              ) : null}
              <button type="button" className="icon-btn hide-sm" onClick={() => openExpanded('queue')} aria-label="Up next" title="Up next">
                <Icon name="list-music" size={20} />
              </button>
              <div className="hide-md">
                <VolumeControl />
              </div>
              <span className="show-sm">
                <PlayPauseButton size={20} />
              </span>
              <button type="button" className="icon-btn show-sm" onClick={next} aria-label="Next song">
                <Icon name="skip-forward" size={18} />
              </button>
              <button type="button" className="icon-btn hide-sm" onClick={() => openExpanded()} aria-label="Expand player" title="Expand">
                <Icon name="maximize" size={18} />
              </button>
              <button type="button" className="icon-btn mini__hide" onClick={hideWithAnimation} aria-label="Hide mini player" title="Hide player (music keeps playing)">
                <Icon name="chevron-down" size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
      {view === 'expanded' ? <ExpandedPlayer onClose={() => setView('mini')} onLyricsMode={openLyricsMode} /> : null}
      {view === 'lyrics' ? <LyricsMode onExit={() => setView(returnTo.current === 'expanded' ? 'expanded' : 'mini')} /> : null}
    </>
  );
}
