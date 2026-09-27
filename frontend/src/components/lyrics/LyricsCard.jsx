import Icon from '../ui/Icon.jsx';
import LyricsView, { LyricsState } from './LyricsView.jsx';
import { usePlayer } from '../../context/PlayerContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useLyricSync, useSongLyrics } from '../../hooks/useLyrics.js';

/**
 * Lyrics on the song page. When this song is playing the card follows along;
 * otherwise tapping a synced line starts the song from that moment.
 */
export default function LyricsCard({ song, list }) {
  const { settings } = useSettings();
  const { isCurrent, seek, playSong, setView } = usePlayer();
  const { lyrics, loading, error, retry } = useSongLyrics(song.id, { enabled: settings.lyricsEnabled !== false });
  const active = isCurrent(song.id);
  const { activeIndex } = useLyricSync(active ? lyrics : null);

  if (settings.lyricsEnabled === false) return null;
  if (!loading && !error && !lyrics) return null;

  const onSeek = (seconds) => (active ? seek(seconds) : playSong(song, list, { startAt: seconds }));

  return (
    <section className="lyrics-card section" aria-labelledby="lyrics-heading">
      <header className="section__header" style={{ marginBottom: 0 }}>
        <h2 id="lyrics-heading" className="section__title" style={{ marginBottom: 0 }}>
          <Icon name="lyrics" size={22} className="text-accent" /> Lyrics
        </h2>
        {lyrics ? (
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => {
              if (!active) playSong(song, list);
              setView('lyrics');
            }}
          >
            <Icon name="maximize" size={14} /> Lyrics mode
          </button>
        ) : null}
      </header>
      {lyrics ? (
        <>
          {lyrics.isSynced && !active ? <p className="text-sm text-muted">Tap a line to play from there.</p> : null}
          <LyricsView lyrics={lyrics} activeIndex={active ? activeIndex : -1} onSeek={onSeek} />
        </>
      ) : (
        <LyricsState loading={loading} error={error} onRetry={retry} />
      )}
    </section>
  );
}
