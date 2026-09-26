import { memo } from 'react';
import { Link } from 'react-router-dom';
import Artwork from '../ui/Artwork.jsx';
import { DownloadButton, FavoriteButton, NowPlayingBars, PlayButton, SongMenu } from './SongActions.jsx';
import { usePlayer } from '../../context/PlayerContext.jsx';
import { cx, formatCount, formatDuration } from '../../utils/format.js';

/** Compact list row used for tracklists, search results, favorites and playlists. */
function SongRow({ song, list, position, showAlbum = true, showPlays = false, menuItems, trailing }) {
  const { isCurrent, isPlaying, playSong } = usePlayer();
  const active = isCurrent(song.id);

  return (
    <li className={cx('song-row', active && 'song-row--active')} onDoubleClick={() => playSong(song, list)}>
      <div className="song-row__index">
        {active ? <NowPlayingBars paused={!isPlaying} /> : <span className="song-row__number">{position}</span>}
        <PlayButton song={song} list={list} size="sm" className="song-row__play" />
      </div>
      <Artwork src={song.artworkUrl} alt="" size={44} className="song-row__art" />
      <div className="song-row__main">
        <Link to={`/song/${song.id}`} className="song-row__title">
          {song.title}
        </Link>
        <span className="song-row__sub">
          <Link to={`/artists/${song.artist.id}`}>{song.artist.name}</Link>
          {showAlbum && song.album ? (
            <>
              <span aria-hidden="true"> · </span>
              <Link to={`/albums/${song.album.id}`} className="hide-sm">
                {song.album.title}
              </Link>
            </>
          ) : null}
        </span>
      </div>
      <span className="song-row__genre hide-md">{song.genre?.name}</span>
      {showPlays ? <span className="song-row__plays hide-sm">{formatCount(song.playCount)} plays</span> : null}
      <div className="song-row__actions">
        <FavoriteButton song={song} className="hide-sm" />
        <DownloadButton song={song} className="hide-xs" />
        <span className="song-row__duration">{formatDuration(song.duration)}</span>
        {trailing}
        <SongMenu song={song} extraItems={menuItems} />
      </div>
    </li>
  );
}

export default memo(SongRow);

export function SongList({ songs, showAlbum, showPlays, numbered = true, menuItems, label }) {
  return (
    <ol className="song-list" aria-label={label}>
      {songs.map((song, i) => (
        <SongRow
          key={song.id}
          song={song}
          list={songs}
          position={numbered ? song.trackNumber && !showAlbum ? song.trackNumber : i + 1 : ''}
          showAlbum={showAlbum}
          showPlays={showPlays}
          menuItems={menuItems?.(song)}
        />
      ))}
    </ol>
  );
}
