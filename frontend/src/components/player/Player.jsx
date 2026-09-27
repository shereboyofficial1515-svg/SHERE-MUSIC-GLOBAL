import { useCallback, useEffect, useRef } from 'react';
import Icon from '../ui/Icon.jsx';
import Artwork from '../ui/Artwork.jsx';
import { FavoriteButton } from '../music/SongActions.jsx';
import { PlayPauseButton, SeekBar, Transport, VolumeControl } from './Controls.jsx';
import ExpandedPlayer from './ExpandedPlayer.jsx';
import LyricsMode from './LyricsMode.jsx';
import { usePlayer } from '../../context/PlayerContext.jsx';
import { usePreferences } from '../../context/PreferencesContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { gsap, motionOK, useGSAP } from '../../utils/motion.js';

/**
 * Persistent player. The mini bar is always mounted while something is
 * loaded; the expanded view and lyrics mode are overlays on top of it, so
 * switching modes never touches the audio element.
 */
export default function Player() {
  const { current, error, next, view, setView, setPanel } = usePlayer();
  const { prefs } = usePreferences();
  const { settings } = useSettings();
  const barRef = useRef(null);
  const returnTo = useRef('mini');

  useGSAP(
    () => {
      if (current && motionOK()) gsap.from(barRef.current, { yPercent: 110, duration: 0.5, ease: 'power3.out' });
    },
    { dependencies: [Boolean(current)] }
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

  if (!current) return null;
  const lyricsOn = settings.lyricsEnabled !== false;

  return (
    <>
      <div className="mini" ref={barRef} role="region" aria-label="Music player">
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
          </div>
        </div>
      </div>
      {view === 'expanded' ? <ExpandedPlayer onClose={() => setView('mini')} onLyricsMode={openLyricsMode} /> : null}
      {view === 'lyrics' ? <LyricsMode onExit={() => setView(returnTo.current === 'expanded' ? 'expanded' : 'mini')} /> : null}
    </>
  );
}
